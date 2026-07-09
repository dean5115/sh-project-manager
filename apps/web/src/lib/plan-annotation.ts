// R2 files live on an external domain that blocks cross-origin fetch — route them
// through the API's /api/files proxy so pdfjs can read them same-origin.
function sameOriginUrl(url: string): string {
  if (url.startsWith('/') || (typeof window !== 'undefined' && url.startsWith(window.location.origin))) {
    return url
  }
  const filename = url.split('/').pop() || ''
  return `/api/files/${filename}`
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

    const canvas = document.createElement('canvas')
    const viewport = page.getViewport({ scale: 1.5 })
    canvas.width = viewport.width
    canvas.height = viewport.height

    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx as any, viewport }).promise

    // Draw pin marker
    const px = (pin.x / 100) * canvas.width
    const py = (pin.y / 100) * canvas.height

    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = 12

    // Red circle
    ctx.fillStyle = '#EF4444'
    ctx.beginPath()
    ctx.arc(px, py - 22, 20, 0, Math.PI * 2)
    ctx.fill()

    // White border
    ctx.strokeStyle = 'white'
    ctx.lineWidth = 3.5
    ctx.stroke()

    // Triangle stem
    ctx.shadowBlur = 0
    ctx.fillStyle = '#EF4444'
    ctx.beginPath()
    ctx.moveTo(px - 6, py - 6)
    ctx.lineTo(px + 6, py - 6)
    ctx.lineTo(px, py + 6)
    ctx.closePath()
    ctx.fill()

    // White dot
    ctx.fillStyle = 'white'
    ctx.beginPath()
    ctx.arc(px, py - 22, 7, 0, Math.PI * 2)
    ctx.fill()

    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.9))
  } catch (err) {
    console.error('[PlanAnnotation]', err)
    return null
  }
}
