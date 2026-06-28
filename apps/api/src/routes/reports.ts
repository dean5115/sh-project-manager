import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { generatePdf } from '../services/pdf.service'
import { getOrgBranding } from '../services/branding'
import { saveFile, deleteFile } from '../services/storage'
import { z } from 'zod'

const createSchema = z.object({
  projectId: z.string(),
  type: z.enum(['DAILY', 'DEFECTS', 'TASKS', 'PROGRESS', 'HANDOVER', 'INSPECTION']),
  title: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/projects/:projectId/reports', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const reports = await fastify.prisma.report.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    return { data: reports }
  })

  fastify.post('/reports/generate', async (request, reply) => {
    const body = createSchema.parse(request.body)

    const project = await fastify.prisma.project.findFirst({
      where: { id: body.projectId, organizationId: request.user.organizationId },
      include: { organization: true },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const dateFrom = body.dateFrom ? new Date(body.dateFrom) : undefined
    // end-of-day so items created any time on the selected "to" date are included
    const dateTo = body.dateTo ? new Date(new Date(body.dateTo).getTime() + 24 * 60 * 60 * 1000 - 1) : undefined

    let reportData: any = {}

    if (body.type === 'DAILY') {
      reportData.journals = await fastify.prisma.dailyJournal.findMany({
        where: { projectId: body.projectId, ...(dateFrom && dateTo ? { date: { gte: dateFrom, lte: dateTo } } : {}) },
        include: { photos: true },
        orderBy: { date: 'asc' },
      })
    } else if (body.type === 'DEFECTS') {
      reportData.defects = await fastify.prisma.defect.findMany({
        where: {
          projectId: body.projectId,
          ...(dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {}),
        },
        include: { beforePhotos: true, afterPhotos: true, assignedTo: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      })
    } else if (body.type === 'TASKS') {
      reportData.tasks = await fastify.prisma.task.findMany({
        where: {
          projectId: body.projectId,
          ...(dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {}),
        },
        include: { assignedTo: { select: { name: true } }, contractor: { select: { name: true } }, photos: true },
        orderBy: { createdAt: 'asc' },
      })
    }

    const branding = await getOrgBranding(fastify.prisma, request.user.organizationId)
    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } })

    const title = body.title || `דוח ${reportTypeLabel(body.type)} — ${project.name}`
    const pdfBuffer = await generatePdf({ type: body.type, title, project, data: reportData, branding, generatedByName: user?.name })

    const filename = `report-${Date.now()}.pdf`
    const pdfUrl = await saveFile(pdfBuffer, filename, 'application/pdf')

    const report = await fastify.prisma.report.create({
      data: {
        projectId: body.projectId,
        type: body.type,
        title,
        pdfUrl,
        generatedBy: request.user.userId,
      },
    })

    return reply.status(201).send({ data: report })
  })

  fastify.delete('/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const report = await fastify.prisma.report.findFirst({
      where: { id, project: { organizationId: request.user.organizationId } },
    })
    if (!report) return reply.status(404).send({ error: 'Not found' })

    if (report.pdfUrl) {
      await deleteFile(report.pdfUrl)
    }

    await fastify.prisma.report.delete({ where: { id } })
    return reply.status(204).send()
  })
}

function reportTypeLabel(type: string) {
  const labels: Record<string, string> = {
    DAILY: 'יומי', DEFECTS: 'ליקויים', TASKS: 'משימות',
    PROGRESS: 'התקדמות', HANDOVER: 'מסירה', INSPECTION: 'פיקוח',
  }
  return labels[type] || type
}
