import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { z } from 'zod'

const e2u = (v: unknown) => (v === '' ? undefined : v)

const createSchema = z.object({
  date: z.string(),
  weather: z.preprocess(e2u, z.string().optional()),
  workforce: z.preprocess((v) => (v === '' || v === null ? undefined : typeof v === 'string' ? parseInt(v) : v), z.number().int().optional()),
  contractors: z.array(z.string()).optional().default([]),
  workDone: z.string().min(1),
  equipment: z.preprocess(e2u, z.string().optional()),
  issues: z.preprocess(e2u, z.string().optional()),
  signedBy: z.preprocess(e2u, z.string().optional()),
  signatureUrl: z.preprocess(e2u, z.string().optional()),
})

export default async function journalRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/projects/:projectId/journals', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const journals = await fastify.prisma.dailyJournal.findMany({
      where: { projectId },
      orderBy: { date: 'desc' },
      include: { photos: true, createdBy: { select: { id: true, name: true } } },
    })
    return { data: journals }
  })

  fastify.get('/projects/:projectId/journals/:id', async (request, reply) => {
    const { projectId, id } = request.params as { projectId: string; id: string }
    const journal = await fastify.prisma.dailyJournal.findFirst({
      where: { id, projectId },
      include: { photos: true, createdBy: { select: { id: true, name: true } } },
    })
    if (!journal) return reply.status(404).send({ error: 'Not found' })
    return { data: journal }
  })

  fastify.post('/projects/:projectId/journals', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = createSchema.parse(request.body)
    const journal = await fastify.prisma.dailyJournal.create({
      data: {
        ...body,
        date: new Date(body.date),
        contractors: body.contractors ?? [],
        projectId,
        createdById: request.user.userId,
      },
      include: { photos: true },
    })
    return reply.status(201).send({ data: journal })
  })

  fastify.put('/projects/:projectId/journals/:id', async (request, reply) => {
    const { projectId, id } = request.params as { projectId: string; id: string }
    const body = createSchema.partial().parse(request.body)
    const updated = await fastify.prisma.dailyJournal.updateMany({
      where: { id, projectId, project: { organizationId: request.user.organizationId } },
      data: { ...body, date: body.date ? new Date(body.date) : undefined },
    })
    if (!updated.count) return reply.status(404).send({ error: 'Not found' })
    return { data: await fastify.prisma.dailyJournal.findUnique({ where: { id } }) }
  })
}
