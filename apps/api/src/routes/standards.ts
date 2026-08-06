import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { z } from 'zod'

const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

const referenceSchema = z.object({
  imageUrl: z.string(),
  caption: z.string(),
})

const createSchema = z.object({
  sourceType: z.enum(['REGULATION', 'HALAT', 'STANDARD']),
  category: z.preprocess(emptyToUndefined, z.enum([
    'STRUCTURE', 'CONCRETE', 'IRON', 'WATERPROOFING', 'PLUMBING',
    'ELECTRICAL', 'HVAC', 'DRYWALL', 'FLOORING', 'CLADDING',
    'PAINT', 'ALUMINUM', 'CARPENTRY', 'METALWORK', 'SAFETY', 'LANDSCAPING',
    'DOOR_ENTRANCE', 'INTERIOR_DOORS_POLYMER', 'CLEANING', 'SAFE_ROOM_METALWORK',
    'ACCESSIBILITY_SIGNAGE', 'PLASTER_PAINT_WORK', 'ELECTRICAL_SAFETY_FIXTURES', 'OTHER',
  ]).optional()),
  code: z.string().min(1),
  description: z.preprocess(emptyToUndefined, z.string().optional()),
  precedenceNote: z.preprocess(emptyToUndefined, z.string().optional()),
  references: z.array(referenceSchema).optional(),
})

export default async function standardRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/standards', async (request) => {
    const { category } = request.query as { category?: string }
    const standards = await fastify.prisma.standard.findMany({
      where: {
        organizationId: request.user.organizationId,
        ...(category ? { category: category as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return { data: standards }
  })

  fastify.post('/standards', async (request, reply) => {
    const body = createSchema.parse(request.body)
    const standard = await fastify.prisma.standard.create({
      data: { ...body, references: body.references ?? undefined, organizationId: request.user.organizationId },
    })
    return reply.status(201).send({ data: standard })
  })

  fastify.put('/standards/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createSchema.partial().parse(request.body)
    const updated = await fastify.prisma.standard.updateMany({
      where: { id, organizationId: request.user.organizationId },
      data: { ...body, references: body.references ?? undefined },
    })
    if (!updated.count) return reply.status(404).send({ error: 'Not found' })
    return { data: await fastify.prisma.standard.findUnique({ where: { id } }) }
  })

  fastify.delete('/standards/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.standard.deleteMany({
      where: { id, organizationId: request.user.organizationId },
    })
    return reply.status(204).send()
  })
}
