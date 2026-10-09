import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import { saveFile } from '../services/storage'
import { reportLogoPrefix } from '../services/branding'
import { z } from 'zod'
import path from 'path'

const updateSchema = z.object({
  name:         z.string().min(1).optional(),
  phone:        z.string().optional(),
  contactEmail: z.string().optional(),
  address:      z.string().optional(),
  website:      z.string().optional(),
  primaryColor: z.string().optional(),
  tagline:      z.string().optional(),
  taxId:        z.string().optional(),
  // דוח בדק בית — פרטי בודק וטקסטים קבועים
  inspectorTitle:      z.string().optional(),
  inspectorEducation:  z.string().optional(),
  inspectorExperience: z.string().optional(),
  hiLegalDeclaration:  z.string().optional(),
  hiLegalBasisList:    z.string().optional(),
  hiMethodology:       z.string().optional(),
  hiWarrantyExplainer: z.string().optional(),
  hiAdditionalContent: z.string().optional(),
})

export default async function organizationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/organization', async (request) => {
    const org = await fastify.prisma.organization.findUnique({
      where: { id: request.user.organizationId },
    })
    return { data: org }
  })

  fastify.put('/organization', async (request, reply) => {
    const body = updateSchema.parse(request.body)
    const org = await fastify.prisma.organization.update({
      where: { id: request.user.organizationId },
      data: body,
    })
    return { data: org }
  })

  fastify.post('/organization/logo', async (request, reply) => {
    const parts = request.parts()
    let logoUrl = ''
    for await (const part of parts) {
      if (part.type === 'file') {
        const ext = path.extname(part.filename || '.png')
        const filename = `logo-${request.user.organizationId}-${Date.now()}${ext}`
        logoUrl = await saveFile(await part.toBuffer(), filename, part.mimetype)
      }
    }
    if (!logoUrl) return reply.status(400).send({ error: 'No file' })
    const org = await fastify.prisma.organization.update({
      where: { id: request.user.organizationId },
      data: { logo: logoUrl },
    })
    return { data: org }
  })

  // הסרת לוגו הארגון — הדוחות יציגו את שם החברה בטקסט במקום
  fastify.delete('/organization/logo', { preHandler: requireMinRole('SUPERVISOR') }, async (request) => {
    const org = await fastify.prisma.organization.update({
      where: { id: request.user.organizationId },
      data: { logo: null },
    })
    return { data: org }
  })

  // לוגו לדוח בודד — לא משנה את לוגו הארגון (למשל כשמפיקים דוח בשם עסק אחר).
  // שם הקובץ כולל את מזהה הארגון, וההפקה מקבלת רק קבצים בתבנית הזו (ראה applyReportLogo)
  fastify.post('/organization/report-logo', { preHandler: requireMinRole('SUPERVISOR') }, async (request, reply) => {
    let file: { buffer: Buffer; mimetype: string; ext: string } | null = null
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const ext = path.extname(part.filename || '').toLowerCase()
        file = { buffer: await part.toBuffer(), mimetype: part.mimetype, ext }
      }
    }
    if (!file) return reply.status(400).send({ error: 'No file' })
    if (!file.mimetype.startsWith('image/')) return reply.status(400).send({ error: 'יש להעלות קובץ תמונה' })
    const ext = REPORT_LOGO_EXTS.has(file.ext) ? file.ext : '.png'
    const filename = `${reportLogoPrefix(request.user.organizationId)}${Date.now()}${ext}`
    const url = await saveFile(file.buffer, filename, file.mimetype)
    return { data: { url } }
  })
}

const REPORT_LOGO_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'])
