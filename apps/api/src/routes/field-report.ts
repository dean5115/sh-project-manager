import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import { generateFieldReportPdf, generateHomeInspectionPdf } from '../services/pdf.service'
import { getOrgBranding, applyReportLogo } from '../services/branding'
import { saveFile, deleteFile } from '../services/storage'
import { z } from 'zod'

const extraPhotoSchema = z.object({
  photoId: z.string(),
  caption: z.string().optional(),
})

const itemSchema = z.object({
  photoId: z.string(),
  photoCaption: z.string().optional(),
  planPhotoId: z.string().optional(),
  note: z.string().optional(),
  room: z.string().optional(),
  planId: z.string().optional(),
  planName: z.string().optional(),
  planPin: z.object({ x: z.number(), y: z.number() }).optional(),
  // דוח בדק בית בלבד — שדות אדיטיביים, לא נוגעים בשלושת סוגי הדוח האחרים
  title: z.string().optional(),
  recommendation: z.string().optional(),
  remark: z.string().optional(),
  category: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  standardIds: z.array(z.string()).optional(),
  extraPhotos: z.array(extraPhotoSchema).optional(),
})

// פרטי מזמין/ביקור/נכס — דוח בדק בית בלבד, נשמרים ברמת הדוח (לא לכל ממצא)
const metadataSchema = z.object({
  clientName: z.string().optional(),
  visitDate: z.string().optional(),
  propertyType: z.string().optional(),
  roomsIncluded: z.string().optional(),
  occupied: z.string().optional(),
  electricityConnected: z.boolean().optional(),
  waterConnected: z.boolean().optional(),
  generalNotes: z.string().optional(),
  // דוח פיקוח/מסירה — פרטי כותרת הדוח, ניתנים לעריכה גם אחרי הפקה
  projectName: z.string().optional(),
  projectAddress: z.string().optional(),
  contractorName: z.string().optional(),
  attendees: z.string().optional(),
  // מיתוג וחתימה לדוח זה — ריק = פרטי הארגון מההגדרות
  logoMode: z.enum(['org', 'custom', 'none']).optional(),
  logoUrl: z.string().optional(),
  companyName: z.string().optional(),
  footerText: z.string().optional(),
  signerName: z.string().optional(),
  signerTitle: z.string().optional(),
  signerPhone: z.string().optional(),
}).optional()

const createSchema = z.object({
  type: z.enum(['INSPECTION', 'HANDOVER', 'HOME_INSPECTION']),
  title: z.string().optional(),
  // פורמט ישן — רשימת תמונות שטוחה; נשמר לתאימות לאחור
  photoIds: z.array(z.string()).optional(),
  // פורמט חדש — כל ממצא עם תמונת תוכנית מוצמדת אופציונלית
  items: z.array(itemSchema).optional(),
  metadata: metadataSchema,
}).refine((d) => (d.items?.length || d.photoIds?.length), { message: 'נדרשת לפחות תמונה אחת' })

const updateSchema = z.object({
  title: z.string().optional(),
  items: z.array(itemSchema).min(1),
  metadata: metadataSchema,
})

const draftUpsertSchema = z.object({
  type: z.enum(['DEFECTS', 'INSPECTION', 'HANDOVER', 'HOME_INSPECTION']),
  title: z.string().optional(),
  items: z.array(itemSchema),
  metadata: metadataSchema,
})

const moveSchema = z.object({
  targetProjectId: z.string().min(1),
})

type ReqItem = z.infer<typeof itemSchema>

const DEFAULT_TITLE_BY_TYPE: Record<string, string> = {
  INSPECTION: 'פיקוח',
  HANDOVER: 'מסירה',
  HOME_INSPECTION: 'בדק בית',
}

// דוחות שנבנים מממצאי שטח (ולא מנתוני הפרויקט) — רק אותם אפשר להפיק מחדש בפרויקט אחר
const MOVABLE_TYPES = ['INSPECTION', 'HANDOVER', 'HOME_INSPECTION']

function defaultTitle(type: string, projectName: string) {
  return type === 'HOME_INSPECTION'
    ? `חוות דעת הנדסית - בדק בית — ${projectName}`
    : `דוח ${DEFAULT_TITLE_BY_TYPE[type]} — ${projectName}`
}

function reportPhotoIds(items: ReqItem[]) {
  return items
    .flatMap((it) => [it.photoId, it.planPhotoId, ...(it.extraPhotos ?? []).map((ep) => ep.photoId)])
    .filter((id): id is string => !!id)
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
      .flatMap((it) => [it.photoId, it.planPhotoId, ...(it.extraPhotos ?? []).map((ep) => ep.photoId)])
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
          const extraPhotos = (it.extraPhotos ?? [])
            .map((ep) => {
              const photo = photoById.get(ep.photoId)
              return photo ? { url: photo.url, caption: ep.caption } : null
            })
            .filter((ep): ep is { url: string; caption: string | undefined } => !!ep)
          const standardRefs = (it.standardIds ?? [])
            .map((id) => standardById.get(id))
            .filter((s): s is NonNullable<typeof s> => !!s)
          return {
            photoUrl: p.url,
            photoCaption: it.photoCaption,
            note: itemNote(it, p.caption || ''),
            planUrl: plan?.url,
            title: it.title,
            recommendation: it.recommendation,
            remark: it.remark,
            room: it.room,
            category: it.category,
            severity: it.severity,
            extraPhotos,
            standards: standardRefs.map((s) => ({
              sourceType: s.sourceType,
              code: s.code,
              description: s.description ?? undefined,
              precedenceNote: s.precedenceNote ?? undefined,
              references: (s.references as any) ?? [],
            })),
          }
        })
        .filter((it): it is NonNullable<typeof it> => !!it),
    }
  }

  // הפקת קובץ ה-PDF של דוח שטח — משותף ליצירה, לעריכה ולהעברה בין פרויקטים
  async function renderReportPdf(type: string, opts: {
    title: string
    project: any
    items: Awaited<ReturnType<typeof buildPdfItems>>['items']
    metadata: any
    generatedByName?: string
    organizationId: string
  }) {
    const branding = await getOrgBranding(fastify.prisma, opts.organizationId)
    const { title, project, items, metadata, generatedByName } = opts
    return type === 'HOME_INSPECTION'
      ? generateHomeInspectionPdf({ title, project, items, branding, generatedByName, metadata })
      : generateFieldReportPdf({
          title, project, items, generatedByName, header: metadata,
          branding: await applyReportLogo(branding, metadata, opts.organizationId),
        })
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

    const title = body.title || defaultTitle(body.type, project.name)
    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } })

    const pdfBuffer = await renderReportPdf(body.type, {
      title, project, items, metadata: body.metadata, generatedByName: user?.name, organizationId: request.user.organizationId,
    })

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
        metadata: body.metadata as any,
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
      .flatMap((it) => [it.photoId, it.planPhotoId, ...(it.extraPhotos ?? []).map((ep) => ep.photoId)])
      .filter((id): id is string => !!id)
    const photos = await fastify.prisma.photo.findMany({ where: { id: { in: allPhotoIds }, projectId } })
    const photoById = new Map(photos.map((p) => [p.id, p]))

    const items = reqItems
      .filter((it) => photoById.has(it.photoId))
      .map((it) => ({
        ...it,
        photoUrl: photoById.get(it.photoId)!.url,
        planPhotoUrl: it.planPhotoId ? photoById.get(it.planPhotoId)?.url : undefined,
        extraPhotos: (it.extraPhotos ?? [])
          .map((ep) => (photoById.has(ep.photoId) ? { photoId: ep.photoId, url: photoById.get(ep.photoId)!.url, caption: ep.caption } : null))
          .filter((p): p is { photoId: string; url: string; caption: string | undefined } => !!p),
      }))

    return reply.send({
      data: { id: report.id, type: report.type, title: report.title, items, metadata: report.metadata },
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

    const title = body.title || report.title
    const user = await fastify.prisma.user.findUnique({ where: { id: request.user.userId } })
    const metadata = body.metadata ?? (report.metadata as any)

    const pdfBuffer = await renderReportPdf(report.type, {
      title, project, items, metadata, generatedByName: user?.name, organizationId: request.user.organizationId,
    })

    const filename = `report-${Date.now()}.pdf`
    const pdfUrl = await saveFile(pdfBuffer, filename, 'application/pdf')

    // מוחקים את קובץ ה-PDF הישן — הרשומה נשארת עם אותו מזהה
    if (report.pdfUrl) await deleteFile(report.pdfUrl).catch(() => {})

    const updated = await fastify.prisma.report.update({
      where: { id: reportId },
      data: { title, pdfUrl, sourceItems: body.items as any, metadata: metadata as any },
    })

    return reply.send({ data: updated })
  })

  // העברת דוח שטח לפרויקט אחר (למשל כשנוצר בטעות בפרויקט הלא נכון): הדוח והתמונות שלו עוברים,
  // וה-PDF מופק מחדש עם פרטי הפרויקט החדש. קודם מפיקים — ורק אם זה הצליח מעבירים, בטרנזקציה אחת.
  fastify.post('/projects/:projectId/field-report/:reportId/move', { preHandler: requireMinRole('SUPERVISOR') }, async (request, reply) => {
    const { projectId, reportId } = request.params as { projectId: string; reportId: string }
    const { targetProjectId } = moveSchema.parse(request.body)
    const organizationId = request.user.organizationId
    if (targetProjectId === projectId) return reply.status(400).send({ error: 'הדוח כבר נמצא בפרויקט הזה' })

    const report = await fastify.prisma.report.findFirst({
      where: { id: reportId, projectId, project: { organizationId } },
      include: { project: true },
    })
    if (!report) return reply.status(404).send({ error: 'Report not found' })
    if (!MOVABLE_TYPES.includes(report.type) || !report.sourceItems) {
      return reply.status(400).send({ error: 'אפשר להעביר רק דוחות שטח (פיקוח, מסירה, בדק בית) שניתנים לעריכה' })
    }

    const target = await fastify.prisma.project.findFirst({
      where: { id: targetProjectId, organizationId },
      include: { organization: true },
    })
    if (!target) return reply.status(404).send({ error: 'Project not found' })

    // בשלב הזה התמונות עדיין בפרויקט המקורי
    const reqItems = report.sourceItems as unknown as ReqItem[]
    const { items } = await buildPdfItems(projectId, organizationId, reqItems)
    if (!items.length) return reply.status(400).send({ error: 'No valid photos found' })

    // כותרת ברירת מחדל ("דוח פיקוח — <פרויקט>") עוברת לשם הפרויקט החדש; כותרת שנכתבה ידנית נשארת
    const title = report.title === defaultTitle(report.type, report.project.name)
      ? defaultTitle(report.type, target.name)
      : report.title
    // שם/כתובת פרויקט שהוקלדו ידנית בכותרת הדוח שייכים לפרויקט הקודם
    let metadata = report.metadata as Record<string, unknown> | null
    if (metadata) {
      const { projectName: _name, projectAddress: _address, ...rest } = metadata
      metadata = rest
    }
    // העברה לא משנה את מחבר הדוח
    const author = await fastify.prisma.user.findUnique({ where: { id: report.generatedBy } })

    const pdfBuffer = await renderReportPdf(report.type, {
      title, project: target, items, metadata, generatedByName: author?.name, organizationId,
    })
    const pdfUrl = await saveFile(pdfBuffer, `report-${Date.now()}.pdf`, 'application/pdf')

    const [, updated] = await fastify.prisma.$transaction([
      // רק תמונות הדוח שאינן משויכות לליקוי/יומן/משימה של הפרויקט המקורי
      fastify.prisma.photo.updateMany({
        where: {
          id: { in: reportPhotoIds(reqItems) }, projectId,
          journalId: null, taskId: null, defectBeforeId: null, defectAfterId: null,
        },
        data: { projectId: targetProjectId },
      }),
      fastify.prisma.report.update({
        where: { id: reportId },
        data: { projectId: targetProjectId, title, pdfUrl, ...(metadata ? { metadata: metadata as any } : {}) },
      }),
    ])

    if (report.pdfUrl) await deleteFile(report.pdfUrl).catch(() => {})
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
    const photoIds = reqItems
      .flatMap((it) => [it.photoId, ...(it.extraPhotos ?? []).map((ep) => ep.photoId)])
      .filter(Boolean)
    const photos = await fastify.prisma.photo.findMany({ where: { id: { in: photoIds }, projectId } })
    const photoById = new Map(photos.map((p) => [p.id, p]))
    const items = reqItems
      .filter((it) => photoById.has(it.photoId))
      .map((it) => ({
        ...it,
        photoUrl: photoById.get(it.photoId)!.url,
        extraPhotos: (it.extraPhotos ?? [])
          .map((ep) => (photoById.has(ep.photoId) ? { photoId: ep.photoId, url: photoById.get(ep.photoId)!.url, caption: ep.caption } : null))
          .filter((p): p is { photoId: string; url: string; caption: string | undefined } => !!p),
      }))

    return reply.send({
      data: { type: draft.type, title: draft.title, items, metadata: draft.metadata, updatedAt: draft.updatedAt },
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
      create: { projectId, userId: request.user.userId, type: body.type, title: body.title, items: body.items as any, metadata: body.metadata as any },
      update: { type: body.type, title: body.title, items: body.items as any, metadata: body.metadata as any },
    })
    return reply.send({ data: { updatedAt: draft.updatedAt } })
  })

  fastify.delete('/projects/:projectId/field-report-draft', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    await fastify.prisma.fieldReportDraft.deleteMany({ where: { projectId, userId: request.user.userId } })
    return reply.status(204).send()
  })
}
