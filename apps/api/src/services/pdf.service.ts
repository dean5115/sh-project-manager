import puppeteer, { Browser } from 'puppeteer'
import path from 'path'
import sharp from 'sharp'
import { readFile } from './storage'

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])

// תמונות מהפלאפון מגיעות לעיתים בכמה MB כל אחת — בלי דחיסה, מסמך עם כמה תמונות
// יכול לגרום ל-Puppeteer לצרוך יותר זיכרון ממה שיש בשרת ה-free tier ולקרוס.
// ממירים תמיד ל-JPEG מכווץ, מספיק גדול להצגה ברורה בדוח אך קטן בהרבה מהמקור.
async function photoToBase64(url: string | undefined | null): Promise<string | null> {
  if (!url) return null
  const ext = path.extname(url).toLowerCase()
  if (!IMAGE_EXT.has(ext)) return null // skip videos — can't embed in a PDF
  try {
    const buffer = await readFile(url)
    if (!buffer) return null
    try {
      const resized = await sharp(buffer)
        .rotate() // מתקן כיוון לפי EXIF (תמונות פלאפון)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer()
      return `data:image/jpeg;base64,${resized.toString('base64')}`
    } catch {
      // אם הדחיסה נכשלת (פורמט לא נתמך וכו') — נופלים חזרה למקור
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg'
      return `data:${mime};base64,${buffer.toString('base64')}`
    }
  } catch {
    return null
  }
}

// מעבדים תמונה-תמונה ברצף (לא Promise.all) — עיבוד מקבילי של הרבה תמונות
// מחזיק את כל הבאפרים בזיכרון בו-זמנית ומציף את השרת ה-free tier (512MB).
async function photosSequential(urls: (string | undefined | null)[]): Promise<(string | null)[]> {
  const results: (string | null)[] = []
  for (const url of urls) {
    results.push(await photoToBase64(url))
  }
  return results
}

async function photoGrid(photos: { url: string }[] | undefined): Promise<string> {
  if (!photos?.length) return ''
  const imgs = (await photosSequential(photos.map((p) => p.url))).filter(Boolean) as string[]
  if (!imgs.length) return ''
  return `<div class="photo-grid">${imgs.map((src) => `<img class="photo-thumb" src="${src}" />`).join('')}</div>`
}

interface Branding {
  primaryColor: string
  logoBase64?: string
  phone?: string
  contactEmail?: string
  address?: string
  website?: string
  tagline?: string
  taxId?: string
}

interface PdfOptions {
  type: string
  title: string
  project: any
  data: any
  branding?: Branding
  generatedByName?: string
}

let browserPromise: Promise<Browser> | null = null
async function getBrowser(): Promise<Browser> {
  // אם דפדפן קודם קרס (OOM וכו') — browserPromise נשאר מצביע לתהליך מת לצמיתות
  // עד שהשרת יופעל מחדש; בודקים חיבור ומשגרים דפדפן חדש אם צריך.
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null)
    if (existing?.connected) return existing
    browserPromise = null
  }
  browserPromise = puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // /dev/shm מוגבל מאוד בשרתים כמו Render — בלי זה Chrome קורס תחת עומס זיכרון
      '--disable-gpu',
      '--single-process', // תהליך Chrome יחיד במקום כמה — פחות זיכרון בשרת חלש
    ],
  })
  return browserPromise
}

// מריצים הפקת PDF אחת בכל פעם — שני דוחות שנוצרים בו-זמנית מכפילים את צריכת הזיכרון
// (כל אחד עם תמונות משלו ב-Chrome), וזה בדיוק מה שהציף את השרת ה-free tier (512MB) בעבר.
let pdfQueue: Promise<unknown> = Promise.resolve()
function enqueuePdf<T>(task: () => Promise<T>): Promise<T> {
  const run = pdfQueue.then(task, task)
  pdfQueue = run.then(() => {}, () => {})
  return run
}

function esc(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// נייר מכתבים משותף לכל סוגי הדוחות — לוגו ממורכז בראש העמוד + פס עיטורי בשוליים
// (Chrome חוזר על position:fixed בכל עמוד בהדפסה, כך שגם מסמכים רב-עמודיים מקבלים אותו לאורך כל הדוח)
function letterheadStyles(): string {
  return `
    .side-bar { position: fixed; top: 0; bottom: 0; left: 0; width: 10px; background: #e9e7e2; }
    .letterhead { text-align: center; margin-bottom: 20px; }
    .letterhead-logo { max-width: 150px; max-height: 100px; object-fit: contain; margin: 0 auto; display: block; }
    .letterhead-name { font-size: 19px; font-weight: bold; letter-spacing: 3px; color: #444; }
    .letterhead-tagline { font-size: 9px; color: #999; letter-spacing: 1.5px; margin-top: 5px; text-transform: uppercase; }
    .doc-date { font-size: 11px; color: #888; text-align: left; margin-bottom: 10px; }
  `
}

function letterheadHtml(branding: Branding | undefined, orgName: string): string {
  if (branding?.logoBase64) {
    return `<div class="side-bar"></div><div class="letterhead"><img class="letterhead-logo" src="${branding.logoBase64}" /></div>`
  }
  return `
    <div class="side-bar"></div>
    <div class="letterhead">
      <div class="letterhead-name">${esc(orgName)}</div>
      ${branding?.tagline ? `<div class="letterhead-tagline">${esc(branding.tagline)}</div>` : ''}
    </div>
  `
}

// כותרת תחתונה אמיתית של Puppeteer — חוזרת בכל עמוד (בניגוד ל-div רגיל שמופיע פעם אחת בסוף המסמך)
function footerHtml(branding: Branding | undefined, orgName: string, extra?: string): string {
  const parts = [orgName, branding?.contactEmail, branding?.address, branding?.phone, extra].filter(Boolean) as string[]
  if (!parts.length) return '<span></span>'
  return `
    <div style="width:100%; font-size:8px; color:#999; text-align:center; direction:rtl; font-family:Arial,sans-serif; padding:0 40px;">
      ${parts.map((p) => esc(p)).join(' &nbsp;|&nbsp; ')}
    </div>
  `
}

export function generatePdf(options: PdfOptions): Promise<Buffer> {
  return enqueuePdf(() => generatePdfImpl(options))
}

async function generatePdfImpl(options: PdfOptions): Promise<Buffer> {
  const { title, project, data, type, branding, generatedByName } = options
  const color = branding?.primaryColor || '#1B4F72'
  const now = new Date().toLocaleDateString('he-IL')
  const orgName = project.organization?.name || 'SH - Project Manager'

  let sectionHtml = ''

  // ברצף ולא במקביל (Promise.all) — עם הרבה פריטים ותמונות, עיבוד בו-זמנית מציף את זיכרון השרת
  if (type === 'DAILY' && data.journals) {
    const cards: string[] = []
    for (const j of data.journals) {
      cards.push(`
        <div class="item-card">
          <div class="journal-date">${esc(new Date(j.date).toLocaleDateString('he-IL'))}</div>
          <div class="item-field"><strong>עבודות שבוצעו:</strong> ${esc(j.workDone)}</div>
          ${j.weather ? `<div class="item-field"><strong>מזג אוויר:</strong> ${esc(j.weather)}</div>` : ''}
          ${j.workforce ? `<div class="item-field"><strong>כוח אדם:</strong> ${esc(j.workforce)}</div>` : ''}
          ${j.issues ? `<div class="item-field issue"><strong>בעיות:</strong> ${esc(j.issues)}</div>` : ''}
          ${await photoGrid(j.photos)}
        </div>
      `)
    }
    sectionHtml = `<h2>יומני עבודה</h2>${cards.join('')}`
  } else if (type === 'DEFECTS' && data.defects) {
    const cards: string[] = []
    for (let i = 0; i < data.defects.length; i++) {
      const d = data.defects[i]
      cards.push(`
        <div class="item-card">
          <div class="item-title">${i + 1}. ${esc(d.title)}
            <span class="badge">${esc(severityLabel(d.severity))}</span>
            <span class="badge">${esc(categoryLabel(d.category))}</span>
            <span class="badge">${esc(defectStatusLabel(d.status))}</span>
          </div>
          ${d.location ? `<div class="item-field"><strong>מיקום:</strong> ${esc(d.location)}</div>` : ''}
          <div class="item-field">${esc(d.description)}</div>
          ${d.assignedTo?.name ? `<div class="item-field"><strong>אחראי:</strong> ${esc(d.assignedTo.name)}</div>` : ''}
          ${await photoGrid(d.beforePhotos)}
          ${await photoGrid(d.afterPhotos)}
        </div>
      `)
    }
    sectionHtml = `<h2>ליקויים (${data.defects.length})</h2>${cards.join('')}`
  } else if (type === 'TASKS' && data.tasks) {
    const cards: string[] = []
    for (let i = 0; i < data.tasks.length; i++) {
      const t = data.tasks[i]
      cards.push(`
        <div class="item-card">
          <div class="item-title">${i + 1}. ${esc(t.title)}
            <span class="badge">${esc(priorityLabel(t.priority))}</span>
            <span class="badge">${esc(taskStatusLabel(t.status))}</span>
          </div>
          ${t.description ? `<div class="item-field">${esc(t.description)}</div>` : ''}
          ${t.assignedTo?.name ? `<div class="item-field"><strong>אחראי:</strong> ${esc(t.assignedTo.name)}</div>` : ''}
          ${t.contractor?.name ? `<div class="item-field"><strong>קבלן:</strong> ${esc(t.contractor.name)}</div>` : ''}
          ${await photoGrid(t.photos)}
        </div>
      `)
    }
    sectionHtml = `<h2>משימות (${data.tasks.length})</h2>${cards.join('')}`
  }

  const html = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: 'Arial', 'Segoe UI', sans-serif;
          direction: rtl;
          color: #222;
          margin: 0;
          padding: 36px 40px;
          font-size: 13px;
        }
        ${letterheadStyles()}
        .divider { border: none; border-top: 1px solid ${color}; margin: 10px 0 16px; }
        h1 { font-size: 22px; color: ${color}; margin: 0 0 6px; }
        .project-name { font-size: 15px; font-weight: bold; margin: 0 0 4px; }
        .project-address { font-size: 11px; color: #555; margin: 0 0 2px; }
        h2 { font-size: 15px; color: ${color}; margin: 22px 0 10px; }
        .item-card { border: 1px solid #eee; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; page-break-inside: avoid; }
        .journal-date { font-weight: bold; font-size: 13px; color: ${color}; margin-bottom: 4px; }
        .item-field { font-size: 11px; margin-top: 3px; }
        .item-field.issue { color: #E74C3C; }
        .item-title { font-weight: bold; font-size: 13px; color: #222; margin-bottom: 4px; }
        .badge { display: inline-block; background: #f1f3f5; color: #555; font-size: 9px; font-weight: normal; border-radius: 6px; padding: 2px 7px; margin-right: 5px; }
        .photo-grid { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .photo-thumb { width: 110px; height: 90px; object-fit: cover; border-radius: 6px; border: 1px solid #ddd; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: ${color}; color: #fff; font-size: 11px; padding: 6px 8px; text-align: right; }
        td { font-size: 11px; padding: 6px 8px; border-bottom: 1px solid #eee; }
        .signoff { margin-top: 30px; padding-top: 18px; border-top: 1px solid #eee; font-size: 13px; line-height: 1.6; page-break-inside: avoid; }
        .signoff .name { font-weight: bold; color: ${color}; }
      </style>
    </head>
    <body>
      ${letterheadHtml(branding, orgName)}
      <div class="doc-date">${esc(now)}</div>

      <h1>${esc(title)}</h1>
      <div class="project-name">פרויקט: ${esc(project.name)}</div>
      <div class="project-address">כתובת: ${esc(project.address)}</div>
      <hr class="divider" />

      ${sectionHtml}

      <div class="signoff">
        <div>בברכה,</div>
        <div class="name">${esc(generatedByName || orgName)}</div>
        ${generatedByName && branding?.phone ? `<div>${esc(branding.phone)}</div>` : ''}
      </div>
    </body>
    </html>
  `

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '46px', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerHtml(branding, orgName),
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await page.close()
  }
}

interface FieldReportOptions {
  title: string
  project: any
  items: { photoUrl: string; note: string; planUrl?: string }[]
  branding?: Branding
  generatedByName?: string
}

export function generateFieldReportPdf(options: FieldReportOptions): Promise<Buffer> {
  return enqueuePdf(() => generateFieldReportPdfImpl(options))
}

async function generateFieldReportPdfImpl(options: FieldReportOptions): Promise<Buffer> {
  const { title, project, items, branding, generatedByName } = options
  const color = branding?.primaryColor || '#1B4F72'
  const now = new Date().toLocaleDateString('he-IL')
  const orgName = project.organization?.name || 'SH - Project Manager'

  // ברצף ולא במקביל — עם 20+ ממצאים, עיבוד כל התמונות בו-זמנית מציף את זיכרון השרת ומקריס אותו
  const itemsHtmlParts: string[] = []
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const src = await photoToBase64(item.photoUrl)
    const planSrc = item.planUrl ? await photoToBase64(item.planUrl) : null
    itemsHtmlParts.push(`
      <div class="field-item">
        <div class="field-item-num">${i + 1}</div>
        ${src ? `<img class="field-item-photo" src="${src}" />` : ''}
        <div class="field-item-note">${esc(item.note)}</div>
        ${planSrc ? `
          <div class="field-item-plan-label">מיקום על תוכנית:</div>
          <img class="field-item-plan" src="${planSrc}" />
        ` : ''}
      </div>
    `)
  }
  const itemsHtml = itemsHtmlParts.join('')

  const html = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Arial', 'Segoe UI', sans-serif; direction: rtl; color: #222; margin: 0; padding: 36px 40px; font-size: 13px; }
        ${letterheadStyles()}
        .divider { border: none; border-top: 1px solid ${color}; margin: 10px 0 16px; }
        h1 { font-size: 22px; color: ${color}; margin: 0 0 6px; }
        .project-name { font-size: 15px; font-weight: bold; margin: 0 0 4px; }
        .project-address { font-size: 11px; color: #555; margin: 0 0 2px; }
        .field-item { border: 1px solid #eee; border-radius: 10px; padding: 14px; margin-bottom: 14px; page-break-inside: avoid; position: relative; }
        .field-item-num { position: absolute; top: 10px; left: 10px; background: ${color}; color: #fff; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; }
        .field-item-photo { width: 100%; max-height: 320px; object-fit: contain; border-radius: 8px; margin-bottom: 10px; display: block; background: #f8f9fa; }
        .field-item-note { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
        .field-item-plan-label { font-size: 11px; font-weight: bold; color: ${color}; margin: 10px 0 4px; }
        .field-item-plan { width: 100%; max-height: 300px; object-fit: contain; border-radius: 8px; display: block; background: #f8f9fa; border: 1px solid #eee; }
        .summary { font-size: 11px; color: #666; margin-bottom: 14px; }
        .signoff { margin-top: 30px; padding-top: 18px; border-top: 1px solid #eee; font-size: 13px; line-height: 1.6; page-break-inside: avoid; }
        .signoff .name { font-weight: bold; color: ${color}; }
      </style>
    </head>
    <body>
      ${letterheadHtml(branding, orgName)}
      <div class="doc-date">${esc(now)}</div>

      <h1>${esc(title)}</h1>
      <div class="project-name">פרויקט: ${esc(project.name)}</div>
      <div class="project-address">כתובת: ${esc(project.address)}</div>
      <div class="summary">סך הכל ${items.length} ממצאים תועדו</div>
      <hr class="divider" />

      ${itemsHtml}

      <div class="signoff">
        <div>בברכה,</div>
        <div class="name">${esc(generatedByName || orgName)}</div>
        ${generatedByName && branding?.phone ? `<div>${esc(branding.phone)}</div>` : ''}
      </div>
    </body>
    </html>
  `

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '46px', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerHtml(branding, orgName),
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await page.close()
  }
}

interface ReceiptOptions {
  number: number
  amount: number
  clientName: string
  issueDate: Date
  project: any
  milestoneTitle?: string
  branding?: Branding
}

export function generateReceiptPdf(options: ReceiptOptions): Promise<Buffer> {
  return enqueuePdf(() => generateReceiptPdfImpl(options))
}

async function generateReceiptPdfImpl(options: ReceiptOptions): Promise<Buffer> {
  const { number, amount, clientName, issueDate, project, milestoneTitle, branding } = options
  const color = branding?.primaryColor || '#1B4F72'
  const orgName = project.organization?.name || 'SH - Project Manager'
  const dateStr = issueDate.toLocaleDateString('he-IL')
  const amountStr = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(amount)

  const html = `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Arial', 'Segoe UI', sans-serif; direction: rtl; color: #222; margin: 0; padding: 50px 50px; font-size: 13px; }
        ${letterheadStyles()}
        .receipt-meta { text-align: center; margin-bottom: 8px; }
        .receipt-meta .label { font-size: 20px; font-weight: bold; color: ${color}; }
        .receipt-meta .num { font-size: 13px; color: #666; margin-top: 3px; }
        .divider { border: none; border-top: 2px solid ${color}; margin: 16px 0 28px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 13px; }
        .row .lbl { color: #888; }
        .row .val { font-weight: bold; }
        .amount-box { margin-top: 28px; background: #f8f9fa; border-radius: 10px; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
        .amount-box .lbl { font-size: 14px; color: #555; }
        .amount-box .val { font-size: 26px; font-weight: bold; color: ${color}; }
        .signature { margin-top: 60px; display: flex; justify-content: space-between; }
        .signature .line { width: 200px; border-top: 1px solid #999; text-align: center; font-size: 11px; color: #888; padding-top: 6px; }
      </style>
    </head>
    <body>
      ${letterheadHtml(branding, orgName)}
      <div class="receipt-meta">
        <div class="label">קבלה מס' ${esc(number)}</div>
        <div class="num">תאריך: ${esc(dateStr)}</div>
      </div>
      <hr class="divider" />

      <div class="row"><span class="lbl">התקבל מ</span><span class="val">${esc(clientName)}</span></div>
      <div class="row"><span class="lbl">פרויקט</span><span class="val">${esc(project.name)}</span></div>
      ${milestoneTitle ? `<div class="row"><span class="lbl">בגין</span><span class="val">${esc(milestoneTitle)}</span></div>` : ''}

      <div class="amount-box">
        <span class="lbl">סך התקבול</span>
        <span class="val">${esc(amountStr)}</span>
      </div>

      <div class="signature">
        <div class="line">חתימה</div>
        <div class="line">חותמת</div>
      </div>
    </body>
    </html>
  `

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '46px', left: '0', right: '0' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footerHtml(branding, orgName, branding?.taxId ? `ע.מ/ח.פ ${branding.taxId}` : undefined),
    })
    return Buffer.from(pdfBuffer)
  } finally {
    await page.close()
  }
}

function severityLabel(s: string) { return { LOW: 'נמוכה', MEDIUM: 'בינונית', HIGH: 'גבוהה', CRITICAL: 'קריטי' }[s] || s }
function categoryLabel(c: string) { return { STRUCTURE: 'שלד', CONCRETE: 'בטון', IRON: 'ברזל', WATERPROOFING: 'איטום', PLUMBING: 'אינסטלציה', ELECTRICAL: 'חשמל', HVAC: 'מיזוג', DRYWALL: 'גבס', FLOORING: 'ריצוף', CLADDING: 'חיפוי', PAINT: 'צבע', ALUMINUM: 'אלומיניום', CARPENTRY: 'נגרות', METALWORK: 'מסגרות', SAFETY: 'בטיחות', LANDSCAPING: 'פיתוח', OTHER: 'אחר' }[c] || c }
function defectStatusLabel(s: string) { return { OPEN: 'פתוח', IN_PROGRESS: 'בטיפול', FIXED: 'תוקן', VERIFIED: 'אומת', CLOSED: 'סגור' }[s] || s }
function priorityLabel(p: string) { return { LOW: 'נמוכה', MEDIUM: 'רגילה', HIGH: 'גבוהה', CRITICAL: 'קריטי' }[p] || p }
function taskStatusLabel(s: string) { return { OPEN: 'פתוח', IN_PROGRESS: 'בביצוע', PENDING_APPROVAL: 'ממתין לאישור', DONE: 'הושלם', CANCELLED: 'בוטל' }[s] || s }
