import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { sendOtpEmail } from '../services/email.service'
import { checkAccountLockout, recordFailedAttempt, clearFailedAttempts } from '../services/login-guard'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'change-me')

// אחסון OTP בזיכרון — מפתח: email, ערך: { otp, expiresAt }
const otpStore = new Map<string, { otp: string; expiresAt: number; organizationId: string }>()

const registerSchema = z.object({
  organizationName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    // הרשמה פתוחה רק להקמת הארגון הראשון — לאחר מכן נסגרת, וצוות נוסף מתווסף דרך הזמנה פנימית (Settings → Users)
    const orgCount = await fastify.prisma.organization.count()
    if (orgCount > 0) {
      return reply.status(403).send({ error: 'ההרשמה סגורה. לקבלת גישה למערכת פנה למנהל הארגון.' })
    }

    const body = registerSchema.parse(request.body)
    const exists = await fastify.prisma.user.findUnique({ where: { email: body.email } })
    if (exists) return reply.status(409).send({ error: 'Email already registered' })

    const org = await fastify.prisma.organization.create({
      data: { name: body.organizationName },
    })

    const passwordHash = await bcrypt.hash(body.password, 10)
    const user = await fastify.prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        phone: body.phone,
        role: 'OWNER',
        passwordHash,
        organizationId: org.id,
      },
    })

    const token = await makeToken(user.id, org.id, user.role, user.email)
    return reply.status(201).send({
      token,
      user: sanitizeUser(user),
      organization: org,
    })
  })

  fastify.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = loginSchema.parse(request.body)

    const lockMsg = checkAccountLockout(body.email)
    if (lockMsg) return reply.status(429).send({ error: lockMsg })

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email },
      include: { organization: true },
    })
    if (!user) {
      recordFailedAttempt(body.email)
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) {
      recordFailedAttempt(body.email)
      return reply.status(401).send({ error: 'Invalid credentials' })
    }
    clearFailedAttempts(body.email)

    const token = await makeToken(user.id, user.organizationId, user.role, user.email)
    return reply.send({
      token,
      user: sanitizeUser(user),
      organization: user.organization,
    })
  })

  // בדיקת מייל קבלן — מחזיר האם צריך הגדרת סיסמה ראשונה
  fastify.post('/auth/contractor/check', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body)

    const contractor = await fastify.prisma.contractor.findFirst({ where: { email } })
    if (!contractor) {
      return reply.status(404).send({ error: 'לא נמצא קבלן עם כתובת מייל זו' })
    }

    const user = await fastify.prisma.user.findUnique({ where: { email } })
    const hasPassword = !!(user?.passwordHash)
    return reply.send({ ok: true, needsSetup: !hasPassword })
  })

  // הגדרת סיסמה ראשונה לקבלן (ללא OTP)
  fastify.post('/auth/contractor/create-password', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(6),
    }).parse(request.body)

    const contractor = await fastify.prisma.contractor.findFirst({
      where: { email },
      include: { organization: true },
    })
    if (!contractor) {
      return reply.status(404).send({ error: 'לא נמצא קבלן עם כתובת מייל זו' })
    }

    // מאפשר יצירת סיסמה רק אם עדיין אין
    const existingUser = await fastify.prisma.user.findUnique({ where: { email } })
    if (existingUser?.passwordHash) {
      return reply.status(400).send({ error: 'כבר הוגדרה סיסמה — השתמש בכניסה רגילה' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = existingUser
      ? await fastify.prisma.user.update({
          where: { email },
          data: { passwordHash },
          include: { organization: true },
        })
      : await fastify.prisma.user.create({
          data: {
            email,
            name: contractor.contactName || contractor.name,
            role: 'CONTRACTOR',
            passwordHash,
            organizationId: contractor.organizationId,
          },
          include: { organization: true },
        })

    const token = await makeToken(user.id, user.organizationId, user.role, user.email)
    return reply.send({ token, user: sanitizeUser(user), organization: (user as any).organization })
  })

  // שלב 1 — בקשת OTP לקבלן (נשאר כגיבוי)
  fastify.post('/auth/contractor/request-otp', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body)

    const contractor = await fastify.prisma.contractor.findFirst({
      where: { email },
      include: { organization: true },
    })
    if (!contractor) {
      return reply.status(404).send({ error: 'לא נמצא קבלן עם כתובת מייל זו' })
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      organizationId: contractor.organizationId,
    })

    try {
      await sendOtpEmail(email, otp, contractor.organization.name)
    } catch (err) {
      console.warn(`[OTP-FALLBACK] Email failed for ${email}. Code: ${otp}`)
    }
    return reply.send({ ok: true, message: 'קוד נשלח למייל' })
  })

  // שלב 2 — אימות OTP
  fastify.post('/auth/contractor/verify-otp', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email, otp } = z.object({
      email: z.string().email(),
      otp: z.string().length(6),
    }).parse(request.body)

    const lockMsg = checkAccountLockout(email)
    if (lockMsg) return reply.status(429).send({ error: lockMsg })

    const stored = otpStore.get(email)
    if (!stored) return reply.status(400).send({ error: 'לא נמצא קוד — בקש קוד חדש' })
    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email)
      return reply.status(400).send({ error: 'הקוד פג תוקף — בקש קוד חדש' })
    }
    if (stored.otp !== otp) {
      recordFailedAttempt(email)
      return reply.status(400).send({ error: 'קוד שגוי' })
    }
    otpStore.delete(email)
    clearFailedAttempts(email)

    const contractor = await fastify.prisma.contractor.findFirst({
      where: { email, organizationId: stored.organizationId },
    })

    let user = await fastify.prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await fastify.prisma.user.create({
        data: {
          email,
          name: contractor?.contactName || contractor?.name || email,
          role: 'CONTRACTOR',
          passwordHash: '',
          organizationId: stored.organizationId,
        },
      })
    }

    // אם אין סיסמה — מחזיר setup token להגדרת סיסמה
    if (!user.passwordHash) {
      const setupToken = `setup_${Math.random().toString(36).slice(2)}_${Date.now()}`
      otpStore.set(setupToken, { otp: '', expiresAt: Date.now() + 30 * 60 * 1000, organizationId: stored.organizationId })
      // שומר גם את ה-userId
      ;(setupToken as any)
      const tokenData = otpStore.get(setupToken)!
      ;(tokenData as any).userId = user.id
      return reply.send({ needsPasswordSetup: true, setupToken, email })
    }

    const org = await fastify.prisma.organization.findUnique({ where: { id: stored.organizationId } })
    const token = await makeToken(user.id, user.organizationId, user.role, user.email)
    return reply.send({ token, user: sanitizeUser(user), organization: org })
  })

  // הגדרת סיסמה לאחר OTP ראשון
  fastify.post('/auth/contractor/set-password', async (request, reply) => {
    const { setupToken, password } = z.object({
      setupToken: z.string(),
      password: z.string().min(6),
    }).parse(request.body)

    const stored = otpStore.get(setupToken) as any
    if (!stored || Date.now() > stored.expiresAt) {
      return reply.status(400).send({ error: 'הטוקן פג תוקף — התחל מחדש' })
    }
    otpStore.delete(setupToken)

    const user = await fastify.prisma.user.update({
      where: { id: stored.userId },
      data: { passwordHash: await bcrypt.hash(password, 10) },
      include: { organization: true },
    })

    const token = await makeToken(user.id, user.organizationId, user.role, user.email)
    return reply.send({ token, user: sanitizeUser(user), organization: user.organization })
  })

  // כניסת קבלן עם סיסמה (לאחר שהוגדרה)
  fastify.post('/auth/contractor/login', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string(),
    }).parse(request.body)

    const lockMsg = checkAccountLockout(email)
    if (lockMsg) return reply.status(429).send({ error: lockMsg })

    const user = await fastify.prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    })
    if (!user || user.role !== 'CONTRACTOR') {
      recordFailedAttempt(email)
      return reply.status(401).send({ error: 'לא נמצא קבלן עם פרטים אלו' })
    }
    if (!user.passwordHash) return reply.status(400).send({ error: 'יש לבצע כניסה ראשונה עם קוד מייל' })

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      recordFailedAttempt(email)
      return reply.status(401).send({ error: 'סיסמה שגויה' })
    }
    clearFailedAttempts(email)

    const token = await makeToken(user.id, user.organizationId, user.role, user.email)
    return reply.send({ token, user: sanitizeUser(user), organization: user.organization })
  })

  // endpoint לאדמין בלבד — מחזיר OTP ממתין לקבלן ספציפי
  fastify.get('/auth/contractor/pending-otp/:email', {
    preHandler: [require('../middleware/auth').authenticate],
  }, async (request: any, reply) => {
    if (!['OWNER', 'MANAGER'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'אין הרשאה' })
    }
    const { email } = request.params as { email: string }
    const stored = otpStore.get(email)
    if (!stored || Date.now() > stored.expiresAt) {
      return reply.send({ otp: null })
    }
    return reply.send({ otp: stored.otp, expiresAt: stored.expiresAt })
  })

  fastify.get('/auth/me', {
    preHandler: [require('../middleware/auth').authenticate],
  }, async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: request.user.userId },
      include: { organization: true },
    })
    if (!user) return reply.status(404).send({ error: 'User not found' })
    return reply.send({ user: sanitizeUser(user), organization: user.organization })
  })
}

async function makeToken(userId: string, organizationId: string, role: string, email: string) {
  return new SignJWT({ userId, organizationId, role, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(JWT_SECRET)
}

function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user
  return safe
}
