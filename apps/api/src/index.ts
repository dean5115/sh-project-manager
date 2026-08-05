import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import rateLimit from '@fastify/rate-limit'
import path from 'path'
import fs from 'fs'
import 'dotenv/config'

import prismaPlugin from './plugins/prisma'
import authRoutes from './routes/auth'
import projectRoutes from './routes/projects'
import journalRoutes from './routes/journals'
import taskRoutes from './routes/tasks'
import defectRoutes from './routes/defects'
import contractorRoutes from './routes/contractors'
import photoRoutes from './routes/photos'
import documentRoutes from './routes/documents'
import reportRoutes from './routes/reports'
import notificationRoutes from './routes/notifications'
import userRoutes from './routes/users'
import organizationRoutes from './routes/organization'
import paymentRoutes from './routes/payments'
import receiptRoutes from './routes/receipts'
import fieldReportRoutes from './routes/field-report'
import fileRoutes from './routes/files'
import standardRoutes from './routes/standards'
import findingTemplateRoutes from './routes/finding-templates'

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in production')
  process.exit(1)
}

const fastify = Fastify({ logger: { level: 'info' } })

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
if (!fs.existsSync(path.resolve(UPLOAD_DIR))) {
  fs.mkdirSync(path.resolve(UPLOAD_DIR), { recursive: true })
}

async function start() {
  // דומיינים נוספים מורשים בפרודקשן (Vercel וכו'), מופרדים בפסיק — מוגדר ב-env
  const extraOrigins = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean)

  await fastify.register(cors, {
    // מאפשר גישה מ-localhost ומכל IP ברשת המקומית (לגישה מהטלפון), מ-Vercel, ומדומיינים שהוגדרו ב-CORS_ORIGINS
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      const allowed =
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.') ||
        origin.startsWith('http://10.') ||
        origin.startsWith('http://192.168.') ||
        origin.startsWith('http://172.') ||
        origin.endsWith('.vercel.app') ||
        extraOrigins.includes(origin)
      cb(null, allowed)
    },
    credentials: true,
  })

  await fastify.register(multipart, {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB — לסרטונים עד 20 שניות
  })

  // הגנה כללית מפני בקשות מרובות; נקודות auth/OTP מקבלות מגבלה מחמירה יותר בקובץ auth.ts
  await fastify.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
  })

  await fastify.register(staticFiles, {
    root: path.resolve(UPLOAD_DIR),
    prefix: '/uploads/',
  })

  await fastify.register(prismaPlugin)

  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  await fastify.register(authRoutes, { prefix: '/api' })
  await fastify.register(projectRoutes, { prefix: '/api' })
  await fastify.register(journalRoutes, { prefix: '/api' })
  await fastify.register(taskRoutes, { prefix: '/api' })
  await fastify.register(defectRoutes, { prefix: '/api' })
  await fastify.register(contractorRoutes, { prefix: '/api' })
  await fastify.register(photoRoutes, { prefix: '/api' })
  await fastify.register(documentRoutes, { prefix: '/api' })
  await fastify.register(reportRoutes, { prefix: '/api' })
  await fastify.register(notificationRoutes, { prefix: '/api' })
  await fastify.register(userRoutes, { prefix: '/api' })
  await fastify.register(organizationRoutes, { prefix: '/api' })
  await fastify.register(paymentRoutes, { prefix: '/api' })
  await fastify.register(receiptRoutes, { prefix: '/api' })
  await fastify.register(fieldReportRoutes, { prefix: '/api' })
  await fastify.register(fileRoutes, { prefix: '/api' })
  await fastify.register(standardRoutes, { prefix: '/api' })
  await fastify.register(findingTemplateRoutes, { prefix: '/api' })

  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error)
    if (error.name === 'ZodError') {
      return reply.status(400).send({ error: 'Validation error', details: error.message })
    }
    return reply.status(error.statusCode || 500).send({ error: error.message || 'Internal error' })
  })

  const port = Number(process.env.PORT) || 3001
  await fastify.listen({ port, host: '0.0.0.0' })
  console.log(`\n🚀 SH - Project Manager API running at http://localhost:${port}`)
}

start().catch((err) => { console.error(err); process.exit(1) })
