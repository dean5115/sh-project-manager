import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { requireMinRole } from '../middleware/rbac'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const SPECIALTIES = [
  'STRUCTURE', 'CONCRETE', 'IRON', 'WATERPROOFING', 'PLUMBING',
  'ELECTRICAL', 'HVAC', 'DRYWALL', 'FLOORING', 'CLADDING',
  'PAINT', 'ALUMINUM', 'CARPENTRY', 'METALWORK', 'SAFETY', 'LANDSCAPING', 'OTHER',
] as const

const inviteSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['PROJECT_MANAGER', 'ENGINEER', 'SUPERVISOR', 'CONTRACTOR', 'CLIENT']),
  phone: z.string().optional(),
  password: z.string().min(6).default('Change1234!'),
  specialty: z.enum(SPECIALTIES).optional(),
})

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/users', async (request) => {
    const users = await fastify.prisma.user.findMany({
      where: { organizationId: request.user.organizationId },
      select: { id: true, name: true, email: true, role: true, phone: true, createdAt: true },
      orderBy: { name: 'asc' },
    })
    return { data: users }
  })

  fastify.post('/users/invite', {
    preHandler: [requireMinRole('PROJECT_MANAGER')],
  }, async (request, reply) => {
    const body = inviteSchema.parse(request.body)
    const exists = await fastify.prisma.user.findUnique({ where: { email: body.email } })
    if (exists) return reply.status(409).send({ error: 'Email already registered' })

    const passwordHash = await bcrypt.hash(body.password, 10)
    const user = await fastify.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        role: body.role,
        phone: body.phone,
        specialty: body.specialty as any ?? null,
        passwordHash,
        organizationId: request.user.organizationId,
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
    return reply.status(201).send({ data: user })
  })

  fastify.put('/users/:id/role', {
    preHandler: [requireMinRole('OWNER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { role } = z.object({ role: z.enum(['PROJECT_MANAGER', 'ENGINEER', 'SUPERVISOR', 'CONTRACTOR', 'CLIENT']) }).parse(request.body)
    const user = await fastify.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true, specialty: true },
    })
    return { data: user }
  })

  fastify.put('/users/:id/specialty', {
    preHandler: [requireMinRole('PROJECT_MANAGER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { specialty } = z.object({
      specialty: z.enum(SPECIALTIES).nullable(),
    }).parse(request.body)
    const user = await fastify.prisma.user.update({
      where: { id },
      data: { specialty: specialty as any },
      select: { id: true, name: true, email: true, role: true, specialty: true },
    })
    return { data: user }
  })

  fastify.delete('/users/:id', {
    preHandler: [requireMinRole('OWNER')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    if (id === request.user.userId) {
      return reply.status(400).send({ error: 'לא ניתן להסיר את החשבון שלך' })
    }
    await fastify.prisma.user.deleteMany({
      where: { id, organizationId: request.user.organizationId },
    })
    return reply.status(204).send()
  })
}
