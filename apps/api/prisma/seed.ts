import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'org-demo' },
    update: {},
    create: {
      id: 'org-demo',
      name: 'חברת בנייה לדוגמה',
    },
  })

  const passwordHash = await bcrypt.hash('Demo1234!', 10)

  await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      email: 'owner@demo.com',
      name: 'דין הייקה',
      role: 'OWNER',
      passwordHash,
      organizationId: org.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'pm@demo.com' },
    update: {},
    create: {
      email: 'pm@demo.com',
      name: 'מנהל פרויקטים',
      role: 'PROJECT_MANAGER',
      passwordHash,
      organizationId: org.id,
    },
  })

  console.log('✅ Seed completed — org-demo created with 2 users')
  console.log('   owner@demo.com / Demo1234!')
  console.log('   pm@demo.com    / Demo1234!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
