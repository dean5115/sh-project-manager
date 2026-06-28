import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { saveFile, deleteFile } from '../services/storage'
import path from 'path'

export default async function photoRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.post('/photos/upload', async (request, reply) => {
    const parts = request.parts()
    const fields: Record<string, string> = {}
    let fileUrl = ''

    for await (const part of parts) {
      if (part.type === 'file') {
        const ext = path.extname(part.filename || '.jpg')
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
        const buffer = await part.toBuffer()
        fileUrl = await saveFile(buffer, filename, part.mimetype)
      } else {
        fields[part.fieldname] = part.value as string
      }
    }

    if (!fileUrl) return reply.status(400).send({ error: 'No file uploaded' })

    const photo = await fastify.prisma.photo.create({
      data: {
        url: fileUrl,
        caption: fields.caption,
        projectId: fields.projectId || null,
        journalId: fields.journalId || null,
        taskId: fields.taskId || null,
        defectBeforeId: fields.defectBeforeId || null,
        defectAfterId: fields.defectAfterId || null,
        uploadedById: request.user.userId,
        takenAt: new Date(),
      },
    })

    return reply.status(201).send({ data: photo })
  })

  fastify.get('/projects/:projectId/photos', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const photos = await fastify.prisma.photo.findMany({
      where: { projectId },
      orderBy: { takenAt: 'desc' },
    })
    return { data: photos }
  })

  fastify.put('/photos/:id/annotations', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { annotations } = request.body as { annotations: object }
    const photo = await fastify.prisma.photo.update({
      where: { id },
      data: { annotations },
    })
    return { data: photo }
  })

  fastify.delete('/photos/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const photo = await fastify.prisma.photo.findUnique({ where: { id } })
    if (photo) {
      await deleteFile(photo.url)
      await fastify.prisma.photo.delete({ where: { id } })
    }
    return reply.status(204).send()
  })
}
