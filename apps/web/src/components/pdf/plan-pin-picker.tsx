'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight, MapPin } from 'lucide-react'
import { sameOriginUrl } from '@/lib/plan-annotation'

interface Props {
  url: string
  planName: string
  onConfirm: (pin: { x: number; y: number } | null) => void
  onBack: () => void
}

export function PlanPinPicker({ url, planName, onConfirm, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        const pdf = await pdfjsLib.getDocument(sameOriginUrl(url)).promise
        if (cancelled) return
        const page = await pdf.getPage(1)
        if (cancelled) return

        const canvas = canvasRef.current
        const wrapper = wrapperRef.current
        if (!canvas || !wrapper) return

        const native = page.getViewport({ scale: 1 })
        const cssWidth = wrapper.clientWidth || 360
        const dpr = window.devicePixelRatio || 1
        const scale = (cssWidth / native.width) * dpr
        const viewport = page.getViewport({ scale })
        canvas.width = viewport.width
        canvas.height = viewport.height
        canvas.style.width = '100%'
        canvas.style.height = 'auto'

        await page.render({ canvasContext: canvas.getContext('2d') as any, viewport }).promise
        if (!cancelled) setLoading(false)
      } catch (err) {
        console.error('[PlanPinPicker]', err)
        if (!cancelled) {
          setError('לא ניתן לטעון את התוכנית')
          setLoading(false)
        }
      }
    })()
    return () => { cancelled = true }
  }, [url])

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    if (loading || error) return
    const rect = e.currentTarget.getBoundingClientRect()
    setPin({
      x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
      y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-dark truncate">{planName}</p>
          <p className="text-xs text-gray-400">
            {pin ? '✓ מיקום מסומן — לחץ שוב לשינוי' : 'הקש על התוכנית לסימון המיקום'}
          </p>
        </div>
        {pin && (
          <button onClick={() => setPin(null)} className="text-xs text-danger shrink-0">נקה</button>
        )}
      </div>

      {/* Plan canvas */}
      <div ref={wrapperRef} className="flex-1 overflow-auto bg-gray-100">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500">טוען תוכנית...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <div
          className="relative select-none"
          style={{ cursor: 'crosshair', display: loading || error ? 'none' : 'block' }}
          onClick={handleTap}
        >
          <canvas ref={canvasRef} className="block" />

          {pin && (
            <div
              className="absolute pointer-events-none"
              style={{ left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}
            >
              <div className="w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <MapPin size={16} className="text-white" />
              </div>
              <div className="w-0.5 h-2 bg-red-500 mx-auto" />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <Button className="flex-1" onClick={() => onConfirm(pin)} disabled={!pin || loading}>
          <MapPin size={15} />
          אשר מיקום
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => onConfirm(null)}>
          דלג
        </Button>
      </div>
    </div>
  )
}
