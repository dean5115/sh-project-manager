'use client'
import { useState } from 'react'
import { ZoomIn, ZoomOut, Maximize2, Minimize2, Download, RotateCw, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PdfViewerProps {
  url: string
  filename?: string
  className?: string
}

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200, 300]

export function PdfViewer({ url, filename, className }: PdfViewerProps) {
  const [zoomIdx, setZoomIdx] = useState(4) // 150%
  const [rotation, setRotation] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  const zoom = ZOOM_LEVELS[zoomIdx]

  // כתובת עם פרמטרי Chrome PDF viewer
  const pdfSrc = `${url}#zoom=${zoom}&toolbar=0&navpanes=0`

  return (
    <div className={cn(
      'flex flex-col bg-neutral-800 rounded-xl overflow-hidden',
      fullscreen && 'fixed inset-0 z-50 rounded-none',
      className
    )}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 text-white shrink-0 flex-wrap">
        {filename && (
          <span className="text-neutral-300 text-xs truncate max-w-[200px]">{filename}</span>
        )}

        <div className="flex items-center gap-1 mr-auto">
          <button
            onClick={() => setZoomIdx(i => Math.max(i - 1, 0))}
            disabled={zoomIdx === 0}
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ZoomOut size={15} />
          </button>
          <span className="text-xs w-12 text-center">{zoom}%</span>
          <button
            onClick={() => setZoomIdx(i => Math.min(i + 1, ZOOM_LEVELS.length - 1))}
            disabled={zoomIdx === ZOOM_LEVELS.length - 1}
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
          >
            <ZoomIn size={15} />
          </button>
        </div>

        <button
          onClick={() => setRotation(r => (r + 90) % 360)}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="סיבוב"
        >
          <RotateCw size={15} />
        </button>

        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="פתח בחלון חדש"
        >
          <ExternalLink size={15} />
        </a>

        <a
          href={url}
          download={filename}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="הורדה"
        >
          <Download size={15} />
        </a>

        <button
          onClick={() => setFullscreen(f => !f)}
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
        >
          {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* PDF iframe — מנצל את ה-viewer המובנה של Chrome */}
      <div
        className="flex-1 overflow-hidden"
        style={{ transform: rotation ? `rotate(${rotation}deg)` : undefined }}
      >
        <iframe
          src={pdfSrc}
          className="w-full h-full border-0 min-h-[500px]"
          title={filename || 'PDF'}
        />
      </div>
    </div>
  )
}
