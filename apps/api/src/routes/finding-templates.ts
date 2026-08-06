import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { z } from 'zod'

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

const createSchema = z.object({
  title: z.string().min(1),
  category: z.preprocess(emptyToUndefined, z.enum([
    'STRUCTURE', 'CONCRETE', 'IRON', 'WATERPROOFING', 'PLUMBING',
    'ELECTRICAL', 'HVAC', 'DRYWALL', 'FLOORING', 'CLADDING',
    'PAINT', 'ALUMINUM', 'CARPENTRY', 'METALWORK', 'SAFETY', 'LANDSCAPING',
    'DOOR_ENTRANCE', 'INTERIOR_DOORS_POLYMER', 'CLEANING', 'SAFE_ROOM_METALWORK',
    'ACCESSIBILITY_SIGNAGE', 'PLASTER_PAINT_WORK', 'ELECTRICAL_SAFETY_FIXTURES', 'OTHER',
  ]).optional()),
  recommendation: z.string().min(1),
  standardIds: z.array(z.string()).optional(),
})

export default async function findingTemplateRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/finding-templates', async (request) => {
    const { q, category } = request.query as { q?: string; category?: string }
    const templates = await fastify.prisma.findingTemplate.findMany({
      where: {
        organizationId: request.user.organizationId,
        ...(category ? { category: category as any } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return { data: templates }
  })

  fastify.post('/finding-templates', async (request, reply) => {
    const body = createSchema.parse(request.body)
    const template = await fastify.prisma.findingTemplate.create({
      data: { ...body, standardIds: body.standardIds ?? [], organizationId: request.user.organizationId },
    })
    return reply.status(201).send({ data: template })
  })

  fastify.put('/finding-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createSchema.partial().parse(request.body)
    const updated = await fastify.prisma.findingTemplate.updateMany({
      where: { id, organizationId: request.user.organizationId },
      data: body,
    })
    if (!updated.count) return reply.status(404).send({ error: 'Not found' })
    return { data: await fastify.prisma.findingTemplate.findUnique({ where: { id } }) }
  })

  fastify.delete('/finding-templates/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.findingTemplate.deleteMany({
      where: { id, organizationId: request.user.organizationId },
    })
    return reply.status(204).send()
  })
}
