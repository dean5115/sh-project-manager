import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { saveFile, deleteFile } from '../services/storage'
import path from 'path'

export default async function documentRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/projects/:projectId/documents', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })
    const docs = await fastify.prisma.document.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: { uploadedBy: { select: { id: true, name: true } } },
    })
    return { data: docs }
  })

  fastify.post('/projects/:projectId/documents', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })
    const parts = request.parts()
    const fields: Record<string, string> = {}
    let fileUrl = ''

    for await (const part of parts) {
      if (part.type === 'file') {
        const ext = path.extname(part.filename || '.pdf')
        const filename = `doc-${Date.now()}${ext}`
        fileUrl = await saveFile(await part.toBuffer(), filename, part.mimetype)
      } else {
        fields[part.fieldname] = part.value as string
      }
    }

    if (!fileUrl) return reply.status(400).send({ error: 'No file' })

    const doc = await fastify.prisma.document.create({
      data: {
        projectId,
        name: fields.name || 'מסמך',
        type: (fields.type as any) || 'OTHER',
        discipline: (fields.discipline as any) || null,
        url: fileUrl,
        version: 1,
        uploadedById: request.user.userId,
      },
    })
    return reply.status(201).send({ data: doc })
  })

  fastify.delete('/projects/:projectId/documents/:id', async (request, reply) => {
    const { projectId, id } = request.params as { projectId: string; id: string }
    const doc = await fastify.prisma.document.findFirst({
      where: { id, projectId, project: { organizationId: request.user.organizationId } },
    })
    if (doc) {
      await deleteFile(doc.url)
      await fastify.prisma.document.delete({ where: { id } })
    }
    return reply.status(204).send()
  })
}
