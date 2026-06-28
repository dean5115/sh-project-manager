import { FastifyRequest, FastifyReply } from 'fastify'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me')

export interface JwtPayload {
  userId: string
  organizationId: string
  role: string
  email: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  try {
    const token = auth.slice(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)
    request.user = payload as unknown as JwtPayload
  } catch {
    return reply.status(401).send({ error: 'Invalid token' })
  }
}
