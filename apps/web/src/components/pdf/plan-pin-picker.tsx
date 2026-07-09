'use client'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight, MapPin } from 'lucide-react'

interface Props {
  url: string
  planName: string
  onConfirm: (pin: { x: number; y: number } | null) => void
  onBack: () => void
}

export function PlanPinPicker({ url, planName, onConfirm, onBack }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null)

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setPin({
      x: Math.round(((e.clientX - rect.left) / rect.width) * 100),
      y: Math.round(((e.clientY - rect.top) / rect.height) * 100),
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

      {/* PDF + overlay */}
      <div className="flex-1 relative overflow-hidden">
        {/* PDF in iframe — pointer-events off so overlay catches clicks */}
        <iframe
          src={`${url}#toolbar=0&navpanes=0`}
          className="absolute inset-0 w-full h-full border-0"
          style={{ pointerEvents: 'none' }}
          title={planName}
        />

        {/* Transparent click-capture overlay */}
        <div
          ref={overlayRef}
          className="absolute inset-0"
          style={{ cursor: 'crosshair', background: 'transparent' }}
          onClick={handleTap}
        >
          {/* Pin marker */}
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
        <Button className="flex-1" onClick={() => onConfirm(pin)} disabled={!pin}>
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
