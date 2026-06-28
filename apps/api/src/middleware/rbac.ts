import { FastifyRequest, FastifyReply } from 'fastify'
import { Role } from '@sitepilot/types'

const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 6,
  PROJECT_MANAGER: 5,
  ENGINEER: 4,
  SUPERVISOR: 3,
  CONTRACTOR: 2,
  CLIENT: 1,
}

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.user?.role as Role
    if (!userRole || !roles.includes(userRole)) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}

export function requireMinRole(minRole: Role) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const userRole = request.user?.role as Role
    if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY[minRole]) {
      return reply.status(403).send({ error: 'Forbidden' })
    }
  }
}
