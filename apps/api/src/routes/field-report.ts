import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { generateFieldReportPdf, generateHomeInspectionPdf } from '../services/pdf.service'
import { getOrgBranding } from '../services/branding'
import { saveFile, deleteFile } from '../services/storage'
import { z } from 'zod'

const itemSchema = z.object({
  photoId: z.string(),
  planPhotoId: z.string().optional(),
  note: z.string().optional(),
  room: z.string().optional(),
  planId: z.string().optional(),
  planName: z.string().optional(),
  planPin: z.object({ x: z.number(), y: z.number() }).optional(),
  // דוח בדק בית בלבד — שדות אדיטיביים, לא נוגעים בשלושת סוגי הדוח האחרים
  title: z.string().optional(),
  recommendation: z.string().optional(),
  category: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  standardIds: z.array(z.string()).optional(),
  extraPhotoIds: z.array(z.string()).optional(),
})

const createSchema = z.object({
  type: z.enum(['INSPECTION', 'HANDOVER', 'HOME_INSPECTION']),
  title: z.string().optional(),
  // פורמט ישן — רשימת תמונות שטוחה; נשמר לתאימות לאחור
  photoIds: z.array(z.string()).optional(),
  // פורמט חדש — כל ממצא עם תמונת תוכנית מוצמדת אופציונלית
  items: z.array(itemSchema).optional(),
}).refine((d) => (d.items?.length || d.photoIds?.length), { message: 'נדרשת לפחות תמונה אחת' })

const updateSchema = z.object({
  title: z.string().optional(),
  items: z.array(itemSchema).min(1),
})

const draftUpsertSchema = z.object({
  type: z.enum(['DEFECTS', 'INSPECTION', 'HANDOVER', 'HOME_INSPECTION']),
  title: z.string().optional(),
  items: z.array(itemSchema),
})

type ReqItem = z.infer<typeof itemSchema>

const DEFAULT_TITLE_BY_TYPE: Record<string, string> = {
  INSPECTION: 'פיקוח',
  HANDOVER: 'מסירה',
  HOME_INSPECTION: 'בדק בית',
}

// בונה את שורת המיקום+הערה שמופיעה מתחת לתמונה בדוח שטח רגיל (לא בדק בית — שם יש שורות מתויגות נפרדות)
function itemNote(it: ReqItem, fallbackCaption: string): string {
  const parts = [it.room, it.planName ? `תוכנית: ${it.planName}` : '', it.note].filter(Boolean)
  return parts.length ? parts.join(' | ') : fallbackCaption
}

export default async function fieldReportRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  async function buildPdfItems(projectId: string, organizationId: string, reqItems: ReqItem[]) {
    const allPhotoIds = reqItems
      .flatMap((it) => [it.photoId, it.planPhotoId, ...(it.extraPhotoIds ?? [])])
      .filter((id): id is string => !!id)
    const photos = await fastify.prisma.photo.findMany({
      where: { id: { in: allPhotoIds }, projectId },
    })
    const photoById = new Map(photos.map((p) => [p.id, p]))

    const allStandardIds = [...new Set(reqItems.flatMap((it) => it.standardIds ?? []))]
    const standards = allStandardIds.length
      ? await fastify.prisma.standard.findMany({ where: { id: { in: allStandardIds }, organizationId } })
      : []
    const standardById = new Map(standards.map((s) => [s.id, s]))

    return {
      photoById,
      items: reqItems
        .map((it) => {
          const p = photoById.get(it.photoId)
          if (!p) return null
          const plan = it.planPhotoId ? photoById.get(it.planPhotoId) : undefined
          const extraPhotoUrls = (it.extraPhotoIds ?? [])
            .map((id) => photoById.get(id)?.url)
            .filter((u): u is string => !!u)
          const standardRefs = (it.standardIds ?? [])
            .map((id) => standardById.get(id))
            .filter((s): s is NonNullable<typeof s> => !!s)
          return {
            photoUrl: p.url,
            note: itemNote(it, p.caption || ''),
            planUrl: plan?.url,
            title: it.title,
            recommendation: it.recommendation,
            room: it.room,
            severity: it.severity,
            extraPhotoUrls,
            standards: standardRefs.map((s) => ({
              sourceType: s.sourceType,
              code: s.code,
              precedenceNote: s.precedenceNote ?? undefined,
              references: (s.references as any) ?? [],
            })),
          }
        })
        .filter((it): it is NonNullable<typeof it> => !!it),
    }
  }

  fastify.post('/projects/:projectId/field-report', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = createSchema.parse(request.body)

    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
      include: { organization: true },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const reqItems: ReqItem[] = body.items ?? (body.photoIds ?? []).map((pid) => ({ photoId: pid }))
    const { items } = await buildPdfItems(projectId, request.user.organizationId, reqItems)
    if (!items.length) return reply.status(400).send({ error: 'No valid photos found' })

    const branding = await getOrgBranding(fastify.prisma, request.user.organizationId)
    const title = body.title || `דוח ${DEFAULT_TITLE_BY_TYPE[body.type]} — ${project.name}`
    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } })

    const pdfBuffer = body.type === 'HOME_INSPECTION'
      ? await generateHomeInspectionPdf({ title, project, items, branding, generatedByName: user?.name })
      : await generateFieldReportPdf({ title, project, items, branding, generatedByName: user?.name })

    const filename = `report-${Date.now()}.pdf`
    const pdfUrl = await saveFile(pdfBuffer, filename, 'application/pdf')

    const report = await fastify.prisma.report.create({
      data: {
        projectId,
        type: body.type,
        title,
        pdfUrl,
        generatedBy: request.user.userId,
        sourceItems: reqItems as any,
      },
    })

    return reply.status(201).send({ data: report })
  })

  // שליפת דוח לעריכה — מחזיר את הממצאים המקוריים עם כתובות התמונות
  fastify.get('/projects/:projectId/field-report/:reportId', async (request, reply) => {
    const { projectId, reportId } = request.params as { projectId: string; reportId: string }
    const report = await fastify.prisma.report.findFirst({
      where: { id: reportId, projectId, project: { organizationId: request.user.organizationId } },
    })
    if (!report) return reply.status(404).send({ error: 'Report not found' })
    if (!report.sourceItems) {
      return reply.status(400).send({ error: 'דוח זה נוצר לפני תמיכת העריכה ולא ניתן לערוך אותו' })
    }

    const reqItems = report.sourceItems as unknown as ReqItem[]
    const allPhotoIds = reqItems
      .flatMap((it) => [it.photoId, it.planPhotoId, ...(it.extraPhotoIds ?? [])])
      .filter((id): id is string => !!id)
    const photos = await fastify.prisma.photo.findMany({ where: { id: { in: allPhotoIds }, projectId } })
    const photoById = new Map(photos.map((p) => [p.id, p]))

    const items = reqItems
      .filter((it) => photoById.has(it.photoId))
      .map((it) => ({
        ...it,
        photoUrl: photoById.get(it.photoId)!.url,
        planPhotoUrl: it.planPhotoId ? photoById.get(it.planPhotoId)?.url : undefined,
        // זוגות {id, url} ולא שתי מערכים מקבילים — כך הלקוח יודע לדלג על העלאה חוזרת לפי photoId
        extraPhotos: (it.extraPhotoIds ?? [])
          .map((id) => (photoById.has(id) ? { photoId: id, url: photoById.get(id)!.url } : null))
          .filter((p): p is { photoId: string; url: string } => !!p),
      }))

    return reply.send({
      data: { id: report.id, type: report.type, title: report.title, items },
    })
  })

  // עדכון דוח קיים — הפקה מחדש של ה-PDF עם הממצאים המעודכנים
  fastify.put('/projects/:projectId/field-report/:reportId', async (request, reply) => {
    const { projectId, reportId } = request.params as { projectId: string; reportId: string }
    const body = updateSchema.parse(request.body)

    const report = await fastify.prisma.report.findFirst({
      where: { id: reportId, projectId, project: { organizationId: request.user.organizationId } },
    })
    if (!report) return reply.status(404).send({ error: 'Report not found' })

    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId },
      include: { organization: true },
    })

    const { items } = await buildPdfItems(projectId, request.user.organizationId, body.items)
    if (!items.length) return reply.status(400).send({ error: 'No valid photos found' })

    const branding = await getOrgBranding(fastify.prisma, request.user.organizationId)
    const title = body.title || report.title
    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } })

    const pdfBuffer = report.type === 'HOME_INSPECTION'
      ? await generateHomeInspectionPdf({ title, project, items, branding, generatedByName: user?.name })
      : await generateFieldReportPdf({ title, project, items, branding, generatedByName: user?.name })

    const filename = `report-${Date.now()}.pdf`
    const pdfUrl = await saveFile(pdfBuffer, filename, 'application/pdf')

    // מוחקים את קובץ ה-PDF הישן — הרשומה נשארת עם אותו מזהה
    if (report.pdfUrl) await deleteFile(report.pdfUrl).catch(() => {})

    const updated = await fastify.prisma.report.update({
      where: { id: reportId },
      data: { title, pdfUrl, sourceItems: body.items as any },
    })

    return reply.send({ data: updated })
  })

  // טיוטת דוח שטח בענן — מסונכרנת מהמכשיר לענן כדי שתהיה נגישה גם ממכשיר/מחשב אחר
  // (למשל אם המכשיר בשטח נשאר ללא קליטה או אבד). טיוטה אחת פעילה למשתמש בכל פרויקט.
  fastify.get('/projects/:projectId/field-report-draft', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const draft = await fastify.prisma.fieldReportDraft.findUnique({
      where: { projectId_userId: { projectId, userId: request.user.userId } },
    })
    if (!draft) return reply.send({ data: null })

    const reqItems = draft.items as unknown as ReqItem[]
    const photoIds = reqItems.flatMap((it) => [it.photoId, ...(it.extraPhotoIds ?? [])]).filter(Boolean)
    const photos = await fastify.prisma.photo.findMany({ where: { id: { in: photoIds }, projectId } })
    const photoById = new Map(photos.map((p) => [p.id, p]))
    const items = reqItems
      .filter((it) => photoById.has(it.photoId))
      .map((it) => ({
        ...it,
        photoUrl: photoById.get(it.photoId)!.url,
        extraPhotos: (it.extraPhotoIds ?? [])
          .map((id) => (photoById.has(id) ? { photoId: id, url: photoById.get(id)!.url } : null))
          .filter((p): p is { photoId: string; url: string } => !!p),
      }))

    return reply.send({
      data: { type: draft.type, title: draft.title, items, updatedAt: draft.updatedAt },
    })
  })

  fastify.put('/projects/:projectId/field-report-draft', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = draftUpsertSchema.parse(request.body)

    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const draft = await fastify.prisma.fieldReportDraft.upsert({
      where: { projectId_userId: { projectId, userId: request.user.userId } },
      create: { projectId, userId: request.user.userId, type: body.type, title: body.title, items: body.items as any },
      update: { type: body.type, title: body.title, items: body.items as any },
    })
    return reply.send({ data: { updatedAt: draft.updatedAt } })
  })

  fastify.delete('/projects/:projectId/field-report-draft', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    await fastify.prisma.fieldReportDraft.deleteMany({ where: { projectId, userId: request.user.userId } })
    return reply.status(204).send()
  })
}
