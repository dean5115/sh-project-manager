import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { z } from 'zod'

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToId: z.string().optional(),
  contractorId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'PENDING_APPROVAL', 'DONE', 'CANCELLED']).default('OPEN'),
})

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/projects/:projectId/tasks', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const tasks = await fastify.prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        contractor: { select: { id: true, name: true, trade: true } },
        photos: true,
        comments: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    return { data: tasks }
  })

  fastify.post('/projects/:projectId/tasks', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const body = createSchema.parse(request.body)
    const task = await fastify.prisma.task.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        projectId,
        createdById: request.user.userId,
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        contractor: { select: { id: true, name: true } },
      },
    })

    await createNotificationForTask(fastify, task, projectId)
    return reply.status(201).send({ data: task })
  })

  fastify.put('/projects/:projectId/tasks/:id', async (request, reply) => {
    const { id } = request.params as { projectId: string; id: string }
    const body = createSchema.partial().parse(request.body)
    const task = await fastify.prisma.task.update({
      where: { id },
      data: { ...body, dueDate: body.dueDate ? new Date(body.dueDate) : undefined },
    })
    return { data: task }
  })

  fastify.delete('/projects/:projectId/tasks/:id', async (request, reply) => {
    const { id } = request.params as { projectId: string; id: string }
    await fastify.prisma.task.delete({ where: { id } })
    return reply.status(204).send()
  })

  fastify.post('/projects/:projectId/tasks/:id/comments', async (request, reply) => {
    const { id } = request.params as { projectId: string; id: string }
    const { content } = z.object({ content: z.string().min(1) }).parse(request.body)
    const comment = await fastify.prisma.comment.create({
      data: { content, taskId: id, authorId: request.user.userId },
      include: { author: { select: { id: true, name: true } } },
    })
    return reply.status(201).send({ data: comment })
  })
}

async function createNotificationForTask(fastify: FastifyInstance, task: any, projectId: string) {
  if (!task.assignedToId) return
  await fastify.prisma.notification.create({
    data: {
      userId: task.assignedToId,
      title: 'משימה חדשה שויכה אליך',
      body: task.title,
      link: `/projects/${projectId}/tasks/${task.id}`,
    },
  }).catch(() => {})
}
