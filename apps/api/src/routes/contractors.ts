import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { z } from 'zod'

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

const createSchema = z.object({
  name: z.string().min(1),
  trade: z.string().min(1),
  contactName: z.preprocess(emptyToUndefined, z.string().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
})

export default async function contractorRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/contractors', async (request) => {
    const contractors = await fastify.prisma.contractor.findMany({
      where: { organizationId: request.user.organizationId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { tasks: true, defects: true } },
        projects: { select: { id: true, name: true } },
      },
    })
    return { data: contractors }
  })

  // שיוך קבלן לפרויקטים
  fastify.put('/contractors/:id/projects', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { projectIds } = z.object({ projectIds: z.array(z.string()) }).parse(request.body)
    const exists = await fastify.prisma.contractor.findFirst({
      where: { id, organizationId: request.user.organizationId },
    })
    if (!exists) return reply.status(404).send({ error: 'Not found' })
    await fastify.prisma.contractor.update({
      where: { id },
      data: { projects: { set: projectIds.map((pid) => ({ id: pid })) } },
    })
    return { ok: true }
  })

  fastify.get('/contractors/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const contractor = await fastify.prisma.contractor.findFirst({
      where: { id, organizationId: request.user.organizationId },
      include: {
        tasks: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        defects: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })
    if (!contractor) return reply.status(404).send({ error: 'Not found' })
    return { data: contractor }
  })

  fastify.post('/contractors', async (request, reply) => {
    const body = createSchema.parse(request.body)
    const contractor = await fastify.prisma.contractor.create({
      data: { ...body, organizationId: request.user.organizationId },
    })
    return reply.status(201).send({ data: contractor })
  })

  fastify.put('/contractors/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createSchema.partial().parse(request.body)
    const contractor = await fastify.prisma.contractor.updateMany({
      where: { id, organizationId: request.user.organizationId },
      data: body,
    })
    if (!contractor.count) return reply.status(404).send({ error: 'Not found' })
    return { data: await fastify.prisma.contractor.findUnique({ where: { id } }) }
  })

  fastify.delete('/contractors/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.contractor.deleteMany({
      where: { id, organizationId: request.user.organizationId },
    })
    return reply.status(204).send()
  })
}
