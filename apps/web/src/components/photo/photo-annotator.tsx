'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight, Undo2, Eraser, Check } from 'lucide-react'

interface Stroke {
  color: string
  points: { x: number; y: number }[]
}

const COLORS = [
  { value: '#EF4444', label: 'אדום' },
  { value: '#FACC15', label: 'צהוב' },
  { value: '#3B82F6', label: 'כחול' },
  { value: '#FFFFFF', label: 'לבן' },
]

const STROKE_WIDTH = 6
// מגבילים את רזולוציית העבודה — תמונות מצלמת פלאפון יכולות להגיע ל-4000px+,
// וזה מכביד מיותר על הציור בזמן אמת בלי שיפור נראה לעין בתוצאה הסופית
const MAX_DIM = 1280

interface Props {
  file: File
  onConfirm: (file: File, previewUrl: string) => void
  onCancel: () => void
}

export function PhotoAnnotator({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef(false)
  const [color, setColor] = useState(COLORS[0].value)
  const [hasStrokes, setHasStrokes] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      imgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return
      const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      redraw()
      setLoading(false)
    }
    img.src = url
    return () => { cancelled = true; URL.revokeObjectURL(url) }
  }, [file])

  function redraw() {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const stroke of strokesRef.current) {
      if (stroke.points.length < 2) continue
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = STROKE_WIDTH
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
      for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
      ctx.stroke()
    }
  }

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (loading) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawingRef.current = true
    strokesRef.current.push({ color, points: [pointFromEvent(e)] })
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    strokesRef.current[strokesRef.current.length - 1].points.push(pointFromEvent(e))
    redraw()
  }

  function handlePointerUp() {
    if (!drawingRef.current) return
    drawingRef.current = false
    setHasStrokes(strokesRef.current.length > 0)
  }

  function undo() {
    strokesRef.current.pop()
    setHasStrokes(strokesRef.current.length > 0)
    redraw()
  }

  function clearAll() {
    strokesRef.current = []
    setHasStrokes(false)
    redraw()
  }

  function confirm() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const newFile = new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' })
      onConfirm(newFile, URL.createObjectURL(blob))
    }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight size={18} />
        </button>
        <p className="text-sm font-semibold text-neutral-dark flex-1">סמן על התמונה</p>
        <button onClick={undo} disabled={!hasStrokes} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30">
          <Undo2 size={17} />
        </button>
        <button onClick={clearAll} disabled={!hasStrokes} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-30">
          <Eraser size={17} />
        </button>
      </div>

      {/* Color palette */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-100 shrink-0">
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setColor(c.value)}
            className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c.value ? 'scale-110 border-primary' : 'border-gray-200'}`}
            style={{ backgroundColor: c.value }}
            aria-label={c.label}
          />
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-2">
        {loading && (
          <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        )}
        <canvas
          ref={canvasRef}
          className="touch-none rounded-lg"
          style={{ display: loading ? 'none' : 'block', maxWidth: '100%', maxHeight: '100%' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 bg-white border-t border-gray-100 shrink-0">
        <Button className="flex-1" onClick={confirm} disabled={loading}>
          <Check size={15} />
          שמור סימונים
        </Button>
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </div>
  )
}
