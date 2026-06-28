import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'

export default async function notificationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/notifications', async (request) => {
    const notifications = await fastify.prisma.notification.findMany({
      where: { userId: request.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return { data: notifications }
  })

  fastify.put('/notifications/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string }
    await fastify.prisma.notification.updateMany({
      where: { id, userId: request.user.userId },
      data: { read: true },
    })
    return reply.status(204).send()
  })

  fastify.put('/notifications/read-all', async (request, reply) => {
    await fastify.prisma.notification.updateMany({
      where: { userId: request.user.userId, read: false },
      data: { read: true },
    })
    return reply.status(204).send()
  })
}
