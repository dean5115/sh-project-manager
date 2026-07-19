import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  description: z.string().optional(),
  developerName: z.string().optional(),
  mainContractor: z.string().optional(),
  managerId: z.string().optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  status: z.enum(['TENDER', 'PERMIT', 'PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  contractAmount: z.number().min(0).optional(),
})

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/projects', async (request) => {
    if (request.user.role === 'CONTRACTOR') {
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { email: true },
      })
      const contractor = await fastify.prisma.contractor.findFirst({
        where: { email: user?.email, organizationId: request.user.organizationId },
        include: {
          projects: {
            include: { _count: { select: { tasks: true, defects: true, journals: true } } },
          },
        },
      })
      return { data: contractor?.projects ?? [] }
    }

    const projects = await fastify.prisma.project.findMany({
      where: { organizationId: request.user.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { tasks: true, defects: true, journals: true } },
      },
    })
    return { data: projects }
  })

  fastify.get('/projects/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        _count: { select: { tasks: true, defects: true, journals: true, documents: true } },
      },
    })
    if (!project) return reply.status(404).send({ error: 'Not found' })
    return { data: project }
  })

  fastify.post('/projects', {
    preHandler: [requireMinRole('ENGINEER')],
  }, async (request, reply) => {
    const body = createSchema.parse(request.body)
    const project = await fastify.prisma.project.create({
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : null,
        targetDate: body.targetDate ? new Date(body.targetDate) : null,
        status: body.status ?? 'ACTIVE',
        organizationId: request.user.organizationId,
      },
    })
    return reply.status(201).send({ data: project })
  })

  fastify.put('/projects/:id', {
    preHandler: [requireMinRole('ENGINEER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createSchema.partial().parse(request.body)
    const project = await fastify.prisma.project.updateMany({
      where: { id, organizationId: request.user.organizationId },
      data: {
        ...body,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        targetDate: body.targetDate ? new Date(body.targetDate) : undefined,
      },
    })
    if (!project.count) return reply.status(404).send({ error: 'Not found' })
    return { data: await fastify.prisma.project.findUnique({ where: { id } }) }
  })

  fastify.delete('/projects/:id', {
    preHandler: [requireMinRole('PROJECT_MANAGER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.project.deleteMany({
      where: { id, organizationId: request.user.organizationId },
    })
    return reply.status(204).send()
  })
}
