// R2 files live on an external domain that blocks cross-origin fetch — route them
// through the API's /api/files proxy so pdfjs can read them same-origin.
export function sameOriginUrl(url: string): string {
  if (url.startsWith('/') || (typeof window !== 'undefined' && url.startsWith(window.location.origin))) {
    return url
  }
  const filename = url.split('/').pop() || ''
  return `/api/files/${filename}`
}

function drawPin(ctx: CanvasRenderingContext2D, px: number, py: number, r = 24) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 12

  // circle
  ctx.fillStyle = '#EF4444'
  ctx.beginPath()
  ctx.arc(px, py - r - 6, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 4
  ctx.stroke()

  // stem
  ctx.shadowBlur = 0
  ctx.beginPath()
  ctx.moveTo(px - r * 0.35, py - 8)
  ctx.lineTo(px + r * 0.35, py - 8)
  ctx.lineTo(px, py + 4)
  ctx.closePath()
  ctx.fill()

  // white dot
  ctx.fillStyle = 'white'
  ctx.beginPath()
  ctx.arc(px, py - r - 6, r * 0.35, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

export async function generateAnnotatedPlanImage(
  planUrl: string,
  pin: { x: number; y: number }
): Promise<Blob | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    // Worker is copied to /public at build time (see next.config.js) — same origin, no CORS
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

    const pdf = await pdfjsLib.getDocument(sameOriginUrl(planUrl)).promise
    const page = await pdf.getPage(1)
    const native = page.getViewport({ scale: 1 })
    const pageW = native.width
    const pageH = native.height

    const pinX = (pin.x / 100) * pageW
    const pinY = (pin.y / 100) * pageH

    // חלון זום — ~35% מרוחב התוכנית, ממורכז על הפין
    const cropW = Math.min(pageW, pageW * 0.35)
    const cropH = Math.min(pageH, cropW * 0.7)
    const cropX = Math.min(Math.max(pinX - cropW / 2, 0), pageW - cropW)
    const cropY = Math.min(Math.max(pinY - cropH / 2, 0), pageH - cropH)

    const outW = 1600
    const scale = outW / cropW
    const outH = Math.round(cropH * scale)

    // רנדור האזור המוגדל
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, outW, outH)
    const cropVp = page.getViewport({ scale, offsetX: -cropX * scale, offsetY: -cropY * scale })
    await page.render({ canvasContext: ctx as any, viewport: cropVp }).promise

    drawPin(ctx, (pinX - cropX) * scale, (pinY - cropY) * scale)

    // תמונת התמצאות קטנה — התוכנית המלאה עם מסגרת אדומה סביב אזור הזום
    const ovW = 340
    const ovScale = ovW / pageW
    const ovH = Math.round(pageH * ovScale)
    const ovCanvas = document.createElement('canvas')
    ovCanvas.width = ovW
    ovCanvas.height = ovH
    const ovCtx = ovCanvas.getContext('2d')!
    ovCtx.fillStyle = 'white'
    ovCtx.fillRect(0, 0, ovW, ovH)
    await page.render({ canvasContext: ovCtx as any, viewport: page.getViewport({ scale: ovScale }) }).promise
    ovCtx.strokeStyle = '#EF4444'
    ovCtx.lineWidth = 3
    ovCtx.strokeRect(cropX * ovScale, cropY * ovScale, cropW * ovScale, cropH * ovScale)
    ovCtx.fillStyle = '#EF4444'
    ovCtx.beginPath()
    ovCtx.arc(pinX * ovScale, pinY * ovScale, 5, 0, Math.PI * 2)
    ovCtx.fill()

    // הדבקה בפינה הימנית-תחתונה עם רקע לבן וצל
    let insetW = ovW
    let insetH = ovH
    const maxInsetH = outH * 0.4
    if (insetH > maxInsetH) {
      const f = maxInsetH / insetH
      insetH = Math.round(insetH * f)
      insetW = Math.round(insetW * f)
    }
    const margin = 14
    const ix = outW - insetW - margin
    const iy = outH - insetH - margin
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.35)'
    ctx.shadowBlur = 10
    ctx.fillStyle = 'white'
    ctx.fillRect(ix - 4, iy - 4, insetW + 8, insetH + 8)
    ctx.restore()
    ctx.drawImage(ovCanvas, ix, iy, insetW, insetH)
    ctx.strokeStyle = '#94A3B8'
    ctx.lineWidth = 1.5
    ctx.strokeRect(ix - 4, iy - 4, insetW + 8, insetH + 8)

    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9))
  } catch (err) {
    console.error('[PlanAnnotation]', err)
    return null
  }
}
