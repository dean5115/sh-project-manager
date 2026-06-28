'use client'
import { useRef, useState, useEffect } from 'react'
import { Stage, Layer, Image as KonvaImage, Arrow, Circle, Rect, Text } from 'react-konva'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowUpRight, Circle as CircleIcon, Square, Type, Undo, Save, X } from 'lucide-react'

type Tool = 'arrow' | 'circle' | 'rect' | 'text'

interface AnnotationEditorProps {
  imageUrl: string
  onSave: (annotations: object) => void
  onClose: () => void
  initialAnnotations?: any
}

export function AnnotationEditor({ imageUrl, onSave, onClose, initialAnnotations }: AnnotationEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tool, setTool] = useState<Tool>('arrow')
  const [color, setColor] = useState('#E74C3C')
  const [shapes, setShapes] = useState<any[]>(initialAnnotations?.shapes || [])
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [stageSize, setStageSize] = useState({ width: 600, height: 400 })
  const [img, setImg] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.src = imageUrl
    image.onload = () => {
      setImg(image)
      const maxW = containerRef.current?.clientWidth || 600
      const ratio = image.height / image.width
      setStageSize({ width: maxW, height: Math.round(maxW * ratio) })
    }
  }, [imageUrl])

  const handleMouseDown = (e: any) => {
    const pos = e.target.getStage().getPointerPosition()
    setStartPos(pos)
    setDrawing(true)
  }

  const handleMouseUp = (e: any) => {
    if (!drawing) return
    const pos = e.target.getStage().getPointerPosition()
    const id = Date.now().toString()

    if (tool === 'arrow') {
      setShapes((s) => [...s, { id, type: 'arrow', points: [startPos.x, startPos.y, pos.x, pos.y], color }])
    } else if (tool === 'circle') {
      const r = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2))
      setShapes((s) => [...s, { id, type: 'circle', x: startPos.x, y: startPos.y, radius: r, color }])
    } else if (tool === 'rect') {
      setShapes((s) => [...s, { id, type: 'rect', x: startPos.x, y: startPos.y, width: pos.x - startPos.x, height: pos.y - startPos.y, color }])
    } else if (tool === 'text') {
      const text = window.prompt('הכנס טקסט:')
      if (text) setShapes((s) => [...s, { id, type: 'text', x: startPos.x, y: startPos.y, text, color }])
    }
    setDrawing(false)
  }

  const undo = () => setShapes((s) => s.slice(0, -1))
  const save = () => onSave({ shapes })

  const TOOLS = [
    { id: 'arrow', icon: ArrowUpRight, label: 'חץ' },
    { id: 'circle', icon: CircleIcon, label: 'עיגול' },
    { id: 'rect', icon: Square, label: 'מסגרת' },
    { id: 'text', icon: Type, label: 'טקסט' },
  ] as const

  const COLORS = ['#E74C3C', '#F39C12', '#27AE60', '#1B4F72', '#FFFFFF', '#000000']

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {TOOLS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTool(id as Tool)}
              title={label}
              className={cn(
                'p-2 rounded-md transition-colors',
                tool === id ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-neutral-dark'
              )}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                'w-6 h-6 rounded-full border-2 transition-transform',
                color === c ? 'border-primary scale-110' : 'border-gray-200'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-2 mr-auto">
          <Button variant="ghost" size="sm" onClick={undo} disabled={shapes.length === 0}>
            <Undo size={14} />
          </Button>
          <Button size="sm" onClick={save}><Save size={14} />שמור</Button>
          <Button variant="ghost" size="sm" onClick={onClose}><X size={14} /></Button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="border border-gray-200 rounded-xl overflow-hidden cursor-crosshair">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            {img && (
              <KonvaImage image={img} width={stageSize.width} height={stageSize.height} />
            )}
            {shapes.map((shape) => {
              if (shape.type === 'arrow') {
                return <Arrow key={shape.id} points={shape.points} stroke={shape.color} strokeWidth={3} fill={shape.color} pointerLength={12} pointerWidth={10} />
              }
              if (shape.type === 'circle') {
                return <Circle key={shape.id} x={shape.x} y={shape.y} radius={shape.radius} stroke={shape.color} strokeWidth={3} />
              }
              if (shape.type === 'rect') {
                return <Rect key={shape.id} x={shape.x} y={shape.y} width={shape.width} height={shape.height} stroke={shape.color} strokeWidth={3} />
              }
              if (shape.type === 'text') {
                return <Text key={shape.id} x={shape.x} y={shape.y} text={shape.text} fill={shape.color} fontSize={18} fontStyle="bold" />
              }
              return null
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
