import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { z } from 'zod'

const e2u = (v: unknown) => (v === '' ? undefined : v)

const createSchema = z.object({
  title: z.string().min(1),
  location: z.preprocess(e2u, z.string().optional()),
  category: z.enum([
    'STRUCTURE', 'CONCRETE', 'IRON', 'WATERPROOFING', 'PLUMBING',
    'ELECTRICAL', 'HVAC', 'DRYWALL', 'FLOORING', 'CLADDING',
    'PAINT', 'ALUMINUM', 'CARPENTRY', 'METALWORK', 'SAFETY', 'LANDSCAPING', 'OTHER',
  ]).default('OTHER'),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  assignedToId: z.preprocess(e2u, z.string().optional()),
  contractorId: z.preprocess(e2u, z.string().optional()),
  dueDate: z.preprocess(e2u, z.string().optional()),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED']).default('OPEN'),
})

export default async function defectRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  // ליקויים שמשויכים לי או שפתחתי (לפורטל קבלנים) — ללא סגורים
  fastify.get('/defects/mine', async (request) => {
    const defects = await fastify.prisma.defect.findMany({
      where: {
        project: { organizationId: request.user.organizationId },
        status: { not: 'CLOSED' },
        OR: [
          { assignedToId: request.user.userId },
          { createdById: request.user.userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
      },
    })
    return { data: defects }
  })

  fastify.get('/projects/:projectId/defects', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const defects = await fastify.prisma.defect.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
        beforePhotos: true,
        afterPhotos: true,
        comments: {
          include: { author: { select: { id: true, name: true } } },
        },
      },
    })
    return { data: defects }
  })

  fastify.get('/projects/:projectId/defects/:id', async (request, reply) => {
    const { projectId, id } = request.params as { projectId: string; id: string }
    const defect = await fastify.prisma.defect.findFirst({
      where: { id, projectId, project: { organizationId: request.user.organizationId } },
      include: {
        assignedTo: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
        beforePhotos: true,
        afterPhotos: true,
        comments: { include: { author: { select: { id: true, name: true } } } },
      },
    })
    if (!defect) return reply.status(404).send({ error: 'Not found' })
    return { data: defect }
  })

  fastify.post('/projects/:projectId/defects', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = createSchema.parse(request.body)

    // Auto-assign: אם לא הוגדר assignedToId ידנית,
    // מחפש משתמש בארגון שה-specialty שלו תואם את קטגוריית הליקוי
    let assignedToId = body.assignedToId || null
    if (!assignedToId && body.category) {
      const specialist = await fastify.prisma.user.findFirst({
        where: {
          organizationId: request.user.organizationId,
          specialty: body.category as any,
        },
        select: { id: true },
      })
      if (specialist) assignedToId = specialist.id
    }

    const defect = await fastify.prisma.defect.create({
      data: {
        ...body,
        assignedToId,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        projectId,
        createdById: request.user.userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
      },
    })

    if (defect.assignedToId) {
      await fastify.prisma.notification.create({
        data: {
          userId: defect.assignedToId,
          title: `ליקוי חדש שויך אליך — ${body.category}`,
          body: defect.title,
          link: `/projects/${projectId}/defects/${defect.id}`,
        },
      }).catch(() => {})
    }

    return reply.status(201).send({ data: defect })
  })

  fastify.put('/projects/:projectId/defects/:id', async (request, reply) => {
    const { projectId, id } = request.params as { projectId: string; id: string }
    const body = createSchema.partial().parse(request.body)
    const updated = await fastify.prisma.defect.updateMany({
      where: { id, projectId, project: { organizationId: request.user.organizationId } },
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined },
    })
    if (!updated.count) return reply.status(404).send({ error: 'Not found' })
    return { data: await fastify.prisma.defect.findUnique({ where: { id } }) }
  })

  fastify.post('/projects/:projectId/defects/:id/comments', async (request, reply) => {
    const { projectId, id } = request.params as { projectId: string; id: string }
    const { content } = z.object({ content: z.string().min(1) }).parse(request.body)
    const defect = await fastify.prisma.defect.findFirst({
      where: { id, projectId, project: { organizationId: request.user.organizationId } },
    })
    if (!defect) return reply.status(404).send({ error: 'Not found' })
    const comment = await fastify.prisma.comment.create({
      data: { content, defectId: id, authorId: request.user.userId },
      include: { author: { select: { id: true, name: true } } },
    })
    return reply.status(201).send({ data: comment })
  })
}
