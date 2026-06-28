import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth'
import { generateReceiptPdf } from '../services/pdf.service'
import { getOrgBranding } from '../services/branding'
import { saveFile, deleteFile } from '../services/storage'
import { z } from 'zod'

const createSchema = z.object({
  clientName: z.string().optional(),
})

export default async function receiptRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/projects/:projectId/receipts', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id: projectId, organizationId: request.user.organizationId },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const receipts = await fastify.prisma.receipt.findMany({
      where: { projectId },
      orderBy: { number: 'desc' },
    })
    return { data: receipts }
  })

  fastify.post('/payments/:id/receipt', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = createSchema.parse(request.body)

    const milestone = await fastify.prisma.paymentMilestone.findFirst({
      where: { id, project: { organizationId: request.user.organizationId } },
      include: { project: { include: { organization: true } } },
    })
    if (!milestone) return reply.status(404).send({ error: 'Not found' })
    if (!milestone.project.contractAmount) {
      return reply.status(400).send({ error: 'יש להגדיר סכום חוזה לפרויקט לפני הפקת קבלה' })
    }

    const amount = (milestone.project.contractAmount * milestone.percentage) / 100
    const clientName = body.clientName || milestone.project.developerName || milestone.project.name

    const branding = await getOrgBranding(fastify.prisma, request.user.organizationId)
    const count = await fastify.prisma.receipt.count({ where: { organizationId: request.user.organizationId } })
    const number = 1001 + count
    const issueDate = new Date()

    const pdfBuffer = await generateReceiptPdf({
      number,
      amount,
      clientName,
      issueDate,
      project: milestone.project,
      milestoneTitle: milestone.title,
      branding,
    })

    const filename = `receipt-${Date.now()}.pdf`
    const pdfUrl = await saveFile(pdfBuffer, filename, 'application/pdf')

    const receipt = await fastify.prisma.receipt.create({
      data: {
        organizationId: request.user.organizationId,
        projectId: milestone.projectId,
        milestoneId: milestone.id,
        number,
        amount,
        clientName,
        issueDate,
        pdfUrl,
        generatedBy: request.user.userId,
      },
    })

    return reply.status(201).send({ data: receipt })
  })

  fastify.delete('/receipts/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const receipt = await fastify.prisma.receipt.findFirst({
      where: { id, organizationId: request.user.organizationId },
    })
    if (!receipt) return reply.status(404).send({ error: 'Not found' })

    if (receipt.pdfUrl) {
      await deleteFile(receipt.pdfUrl)
    }

    await fastify.prisma.receipt.delete({ where: { id } })
    return reply.status(204).send()
  })
}
