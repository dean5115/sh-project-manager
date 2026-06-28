import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { saveFile } from '../services/storage'
import { z } from 'zod'
import path from 'path'

const updateSchema = z.object({
  name:         z.string().min(1).optional(),
  phone:        z.string().optional(),
  address:      z.string().optional(),
  website:      z.string().optional(),
  primaryColor: z.string().optional(),
  tagline:      z.string().optional(),
  taxId:        z.string().optional(),
})

export default async function organizationRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/organization', async (request) => {
    const org = await fastify.prisma.organization.findUnique({
      where: { id: request.user.organizationId },
    })
    return { data: org }
  })

  fastify.put('/organization', async (request, reply) => {
    const body = updateSchema.parse(request.body)
    const org = await fastify.prisma.organization.update({
      where: { id: request.user.organizationId },
      data: body,
    })
    return { data: org }
  })

  fastify.post('/organization/logo', async (request, reply) => {
    const parts = request.parts()
    let logoUrl = ''
    for await (const part of parts) {
      if (part.type === 'file') {
        const ext = path.extname(part.filename || '.png')
        const filename = `logo-${request.user.organizationId}-${Date.now()}${ext}`
        logoUrl = await saveFile(await part.toBuffer(), filename, part.mimetype)
      }
    }
    if (!logoUrl) return reply.status(400).send({ error: 'No file' })
    const org = await fastify.prisma.organization.update({
      where: { id: request.user.organizationId },
      data: { logo: logoUrl },
    })
    return { data: org }
  })
}
