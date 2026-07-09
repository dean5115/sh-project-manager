import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { generateFieldReportPdf } from '../services/pdf.service'
import { getOrgBranding } from '../services/branding'
import { saveFile } from '../services/storage'
import { z } from 'zod'

const createSchema = z.object({
  type: z.enum(['INSPECTION', 'HANDOVER']),
  title: z.string().optional(),
  // פורמט ישן — רשימת תמונות שטוחה; נשמר לתאימות לאחור
  photoIds: z.array(z.string()).optional(),
  // פורמט חדש — כל ממצא עם תמונת תוכנית מוצמדת אופציונלית
  items: z.array(z.object({
    photoId: z.string(),
    planPhotoId: z.string().optional(),
  })).optional(),
}).refine((d) => (d.items?.length || d.photoIds?.length), { message: 'נדרשת לפחות תמונה אחת' })

export default async function fieldReportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.post('/projects/:projectId/field-report', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = createSchema.parse(request.body)

    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
      include: { organization: true },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const reqItems = body.items ?? (body.photoIds ?? []).map((pid) => ({ photoId: pid, planPhotoId: undefined as string | undefined }))
    const allIds = reqItems.flatMap((it) => [it.photoId, it.planPhotoId]).filter((id): id is string => !!id)
    const photos = await fastify.prisma.photo.findMany({
      where: { id: { in: allIds }, projectId },
    })
    const photoById = new Map(photos.map((p) => [p.id, p]))
    const items = reqItems
      .map((it) => {
        const p = photoById.get(it.photoId)
        if (!p) return null
        const plan = it.planPhotoId ? photoById.get(it.planPhotoId) : undefined
        return { photoUrl: p.url, note: p.caption || '', planUrl: plan?.url }
      })
      .filter((it): it is NonNullable<typeof it> => !!it)

    if (!items.length) return reply.status(400).send({ error: 'No valid photos found' })

    const branding = await getOrgBranding(fastify.prisma, request.user.organizationId)
    const title = body.title || `דוח ${body.type === 'INSPECTION' ? 'פיקוח' : 'מסירה'} — ${project.name}`
    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } })

    const pdfBuffer = await generateFieldReportPdf({ title, project, items, branding, generatedByName: user?.name })

    const filename = `report-${Date.now()}.pdf`
    const pdfUrl = await saveFile(pdfBuffer, filename, 'application/pdf')

    const report = await fastify.prisma.report.create({
      data: {
        projectId,
        type: body.type,
        title,
        pdfUrl,
        generatedBy: request.user.userId,
      },
    })

    return reply.status(201).send({ data: report })
  })
}
