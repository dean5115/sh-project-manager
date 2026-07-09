import { FastifyInstance } from 'fastify'
import { readFile } from '../services/storage'
import path from 'path'

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

export default async function fileRoutes(fastify: FastifyInstance) {
  // proxy same-origin לקבצים ב-R2 — נדרש ל-pdfjs בדפדפן (fetch נחסם cross-origin)
  fastify.get('/files/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string }
    const buf = await readFile(filename)
    if (!buf) return reply.status(404).send({ error: 'File not found' })
    const ext = path.extname(filename).toLowerCase()
    reply.header('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
    reply.header('Cache-Control', 'public, max-age=3600')
    return reply.send(buf)
  })
}
