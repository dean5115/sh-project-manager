import path from 'path'
import sharp from 'sharp'
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
    // דוח בדק בית — פרטי בודק וטקסטים קבועים
    inspectorTitle: org?.inspectorTitle || undefined,
    inspectorEducation: org?.inspectorEducation || undefined,
    inspectorExperience: org?.inspectorExperience || undefined,
    hiLegalDeclaration: org?.hiLegalDeclaration || undefined,
    hiLegalBasisList: org?.hiLegalBasisList || undefined,
    hiMethodology: org?.hiMethodology || undefined,
    hiWarrantyExplainer: org?.hiWarrantyExplainer || undefined,
    hiAdditionalContent: org?.hiAdditionalContent || undefined,
  }
}

type Branding = Awaited<ReturnType<typeof getOrgBranding>>

export function reportLogoPrefix(organizationId: string) {
  return `report-logo-${organizationId}-`
}

// בחירת לוגו לדוח בודד: 'org' (ברירת מחדל) = לוגו הארגון, 'none' = בלי לוגו, 'custom' = לוגו שהועלה לדוח הזה.
// לוגו מותאם מתקבל רק מקובץ שהועלה דרך /organization/report-logo של אותו ארגון, ורק אם הוא באמת תמונה.
// מי שבחר "לוגו אחר" לא רוצה את לוגו הארגון — אם הלוגו המותאם לא זמין, הדוח יוצא בלי לוגו (שם העסק בטקסט).
export async function applyReportLogo(
  branding: Branding,
  metadata: { logoMode?: string; logoUrl?: string } | null | undefined,
  organizationId: string,
): Promise<Branding> {
  const mode = metadata?.logoMode
  if (mode !== 'custom' && mode !== 'none') return branding
  const noLogo = { ...branding, logoBase64: undefined }
  if (mode === 'none' || !metadata?.logoUrl) return noLogo

  const key = path.basename(metadata.logoUrl)
  if (!key.startsWith(reportLogoPrefix(organizationId))) return noLogo
  const buffer = await readFile(key)
  if (!buffer) return noLogo
  try {
    const png = await sharp(buffer)
      .resize({ width: 600, height: 300, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
    return { ...branding, logoBase64: `data:image/png;base64,${png.toString('base64')}` }
  } catch {
    return noLogo
  }
}
