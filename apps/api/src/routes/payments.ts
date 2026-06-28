import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1),
  percentage: z.number().min(0).max(100),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

const bulkSchema = z.object({
  items: z.array(z.object({
    title: z.string().min(1),
    percentage: z.number().min(0).max(100),
  })).min(1),
})

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  percentage: z.number().min(0).max(100).optional(),
  dueDate: z.string().nullable().optional(),
  notes: z.string().optional(),
  status: z.enum(['PENDING', 'INVOICED', 'PAID']).optional(),
  paidDate: z.string().nullable().optional(),
  externalReceiptNumber: z.string().nullable().optional(),
})

export default async function paymentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/payments/overview', async (request) => {
    const projects = await fastify.prisma.project.findMany({
      where: { organizationId: request.user.organizationId },
      include: { paymentMilestones: true },
      orderBy: { createdAt: 'desc' },
    })

    const data = projects.map((p) => {
      const totalPercentage = p.paymentMilestones.reduce((sum, m) => sum + m.percentage, 0)
      const totalAmount = p.contractAmount ? (p.contractAmount * totalPercentage) / 100 : 0
      const paidAmount = p.paymentMilestones
        .filter((m) => m.status === 'PAID')
        .reduce((sum, m) => sum + (p.contractAmount ? (p.contractAmount * m.percentage) / 100 : 0), 0)
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        contractAmount: p.contractAmount,
        totalPercentage,
        totalAmount,
        paidAmount,
        pendingAmount: totalAmount - paidAmount,
        milestonesCount: p.paymentMilestones.length,
      }
    })

    const totals = data.reduce(
      (acc, p) => ({
        contractAmount: acc.contractAmount + (p.contractAmount || 0),
        paidAmount: acc.paidAmount + p.paidAmount,
        pendingAmount: acc.pendingAmount + p.pendingAmount,
      }),
      { contractAmount: 0, paidAmount: 0, pendingAmount: 0 }
    )

    return { data: { projects: data, totals } }
  })

  fastify.get('/projects/:projectId/payments', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const milestones = await fastify.prisma.paymentMilestone.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    })
    return { data: { contractAmount: project.contractAmount, milestones } }
  })

  fastify.post('/projects/:projectId/payments', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const body = createSchema.parse(request.body)
    const lastOrder = await fastify.prisma.paymentMilestone.count({ where: { projectId } })

    const milestone = await fastify.prisma.paymentMilestone.create({
      data: {
        projectId,
        title: body.title,
        percentage: body.percentage,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes,
        order: lastOrder,
      },
    })
    return reply.status(201).send({ data: milestone })
  })

  fastify.post('/projects/:projectId/payments/bulk', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const body = bulkSchema.parse(request.body)
    const lastOrder = await fastify.prisma.paymentMilestone.count({ where: { projectId } })

    const created = await fastify.prisma.$transaction(
      body.items.map((item, i) =>
        fastify.prisma.paymentMilestone.create({
          data: { projectId, title: item.title, percentage: item.percentage, order: lastOrder + i },
        })
      )
    )
    return reply.status(201).send({ data: created })
  })

  fastify.put('/payments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const exists = await fastify.prisma.paymentMilestone.findFirst({
      where: { id, project: { organizationId: request.user.organizationId } },
    })
    if (!exists) return reply.status(404).send({ error: 'Not found' })

    const body = updateSchema.parse(request.body)
    const milestone = await fastify.prisma.paymentMilestone.update({
      where: { id },
      data: {
        ...body,
        dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
        paidDate: body.paidDate !== undefined ? (body.paidDate ? new Date(body.paidDate) : null) : undefined,
      },
    })
    return { data: milestone }
  })

  fastify.delete('/payments/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const exists = await fastify.prisma.paymentMilestone.findFirst({
      where: { id, project: { organizationId: request.user.organizationId } },
    })
    if (!exists) return reply.status(404).send({ error: 'Not found' })

    await fastify.prisma.paymentMilestone.delete({ where: { id } })
    return reply.status(204).send()
  })
}
