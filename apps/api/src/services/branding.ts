import path from 'path'
import { readFile } from './storage'

export async function getOrgBranding(prisma: any, organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } })

  let logoBase64: string | undefined
  if (org?.logo) {
    const buffer = await readFile(org.logo)
    if (buffer) {
      const ext = path.extname(org.logo).toLowerCase().replace('.', '')
      const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg'
      logoBase64 = `data:${mime};base64,${buffer.toString('base64')}`
    }
  }

  return {
    primaryColor: org?.primaryColor || '#1B4F72',
    logoBase64,
    phone: org?.phone || undefined,
    contactEmail: org?.contactEmail || undefined,
    address: org?.address || undefined,
    website: org?.website || undefined,
    tagline: org?.tagline || undefined,
    taxId: org?.taxId || undefined,
  }
}
