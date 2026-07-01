'use client'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { absoluteUrl } from '@/lib/utils'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import {
  Camera, Trash2, ArrowRight, AlertTriangle, Search, ClipboardCheck,
  Check, X, Download, MessageCircle, Mail, FileText,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type ReportType = 'DEFECTS' | 'INSPECTION' | 'HANDOVER'

const TYPES: { value: ReportType; label: string; desc: string; icon: typeof AlertTriangle }[] = [
  { value: 'DEFECTS', label: 'דוח ליקויים', desc: 'כל תמונה תהפוך לליקוי מתועד ומשויך', icon: AlertTriangle },
  { value: 'INSPECTION', label: 'דוח פיקוח', desc: 'תצפיות והערות מסיבוב פיקוח בשטח', icon: Search },
  { value: 'HANDOVER', label: 'דוח מסירה', desc: 'תיעוד מצב הנכס לקראת מסירה', icon: ClipboardCheck },
]

interface Item {
  id: string
  file: File
  previewUrl: string
  note: string
}

export default function FieldReportPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()

  // מעיר את שרת ה-API מייד בכניסה לדף — כדי שכשלוחצים "סיום" הוא כבר ער ולא יאחר
  useEffect(() => { api.get(`/projects/${projectId}`).catch(() => {}) }, [projectId])

  const [reportType, setReportType] = useState<ReportType | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; previewUrl: string } | null>(null)
  const [pendingNote, setPendingNote] = useState('')
  const [customTitle, setCustomTitle] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [resultReport, setResultReport] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const typeInfo = TYPES.find((t) => t.value === reportType)

  function handlePhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingPhoto({ file, previewUrl: URL.createObjectURL(file) })
    setPendingNote('')
    e.target.value = ''
  }

  function addItem() {
    if (!pendingPhoto) return
    setItems((prev) => [
      { id: `${Date.now()}-${Math.random()}`, file: pendingPhoto.file, previewUrl: pendingPhoto.previewUrl, note: pendingNote },
      ...prev,
    ])
    setPendingPhoto(null)
    setPendingNote('')
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function finish() {
    if (!reportType || items.length === 0) return
    setFinishing(true)
    setErrorMsg('')
    try {
      if (reportType === 'DEFECTS') {
        // יצירת כל הליקויים ועלייה של כל התמונות במקביל (במקום אחד-אחד)
        await Promise.all(items.map(async (item) => {
          const defectRes = await api.post<{ data: any }>(`/projects/${projectId}/defects`, {
            title: item.note.slice(0, 60) || 'ממצא מהשטח',
            description: item.note || 'ממצא מהשטח',
            category: 'OTHER',
            severity: 'MEDIUM',
            status: 'OPEN',
          })
          const fd = new FormData()
          fd.append('file', item.file)
          fd.append('defectBeforeId', defectRes.data.id)
          fd.append('projectId', projectId)
          await api.upload('/photos/upload', fd)
        }))
        const today = new Date().toISOString().slice(0, 10)
        const reportRes = await api.post<{ data: any }>('/reports/generate', {
          projectId,
          type: 'DEFECTS',
          title: customTitle || undefined,
          dateFrom: today,
          dateTo: today,
        })
        setResultReport(reportRes.data)
      } else {
        // העלאת כל התמונות במקביל — שמירת הסדר ע"י Promise.all
        const uploads = await Promise.all(items.map(async (item) => {
          const fd = new FormData()
          fd.append('file', item.file)
          fd.append('projectId', projectId)
          fd.append('caption', item.note)
          const res = await api.upload<{ data: any }>('/photos/upload', fd)
          return res.data.id
        }))
        const reportRes = await api.post<{ data: any }>(`/projects/${projectId}/field-report`, {
          type: reportType,
          title: customTitle || undefined,
          photoIds: uploads,
        })
        setResultReport(reportRes.data)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בהפקת הדוח')
    } finally {
      setFinishing(false)
    }
  }

  const shareUrl = resultReport?.pdfUrl ? absoluteUrl(resultReport.pdfUrl) : ''
  const shareText = resultReport ? `${resultReport.title}\n${shareUrl}` : ''

  function resetAll() {
    setReportType(null)
    setItems([])
    setPendingPhoto(null)
    setPendingNote('')
    setCustomTitle('')
    setResultReport(null)
    setErrorMsg('')
  }

  return (
    <AppLayout title="דוח שטח">
      <div className="space-y-4 max-w-lg mx-auto">
        <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
          <ArrowRight size={13} />
          חזרה לפרויקט
        </Link>

        {/* Step 1: choose type */}
        {!reportType && !resultReport && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">בחר סוג דוח — תוכל לצלם ולתעד ממצאים בשטח ולקבל PDF מוכן בסוף</p>
            {TYPES.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setReportType(value)}
                className="w-full card flex items-center gap-3 text-right hover:border-primary/30 hover:shadow-md transition-all"
              >
                <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-neutral-dark">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: capture loop */}
        {reportType && !resultReport && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {typeInfo && <typeInfo.icon size={18} className="text-primary" />}
                <p className="font-semibold text-neutral-dark">{typeInfo?.label}</p>
              </div>
              <button onClick={resetAll} className="text-xs text-gray-400 hover:text-danger">החלף סוג דוח</button>
            </div>

            {/* Capture / pending item */}
            {pendingPhoto ? (
              <div className="card space-y-3">
                <img src={pendingPhoto.previewUrl} className="w-full max-h-64 object-contain rounded-xl bg-gray-50" />
                <Textarea
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder="כתוב ממצא לתמונה הזו..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button onClick={addItem} className="flex-1">
                    <Check size={14} />
                    הוסף לדוח
                  </Button>
                  <Button variant="outline" onClick={() => setPendingPhoto(null)}>
                    <X size={14} />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="card flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-primary/30 cursor-pointer hover:bg-primary-50/40 transition-colors">
                <Camera size={32} className="text-primary" />
                <span className="text-sm font-medium text-primary">צלם תמונה</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoPicked} />
              </label>
            )}

            {/* Captured items list */}
            {items.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">{items.length} ממצאים תועדו</p>
                {items.map((item) => (
                  <div key={item.id} className="card flex items-center gap-3">
                    <img src={item.previewUrl} className="w-16 h-16 object-cover rounded-lg shrink-0" />
                    <p className="flex-1 text-sm text-gray-600 line-clamp-2">{item.note || '(ללא הערה)'}</p>
                    <button onClick={() => removeItem(item.id)} className="p-1.5 text-gray-400 hover:text-danger shrink-0">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="card space-y-3">
                <Input
                  label="כותרת מותאמת (אופציונלי)"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={`${typeInfo?.label} — שם הפרויקט`}
                />
                {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
                <Button onClick={finish} loading={finishing} className="w-full" size="lg">
                  <FileText size={16} />
                  סיום והפקת דוח ({items.length})
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: done — share */}
        {resultReport && (
          <div className="space-y-4">
            <div className="card text-center py-6">
              <Check size={36} className="text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-neutral-dark">הדוח הופק בהצלחה!</p>
              <p className="text-sm text-gray-500 mt-1">{resultReport.title}</p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
                <Button variant="outline" className="w-full justify-start bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
                  <MessageCircle size={16} />
                  שלח לקבלן בוואטסאפ
                </Button>
              </a>
              <a href={`mailto:?subject=${encodeURIComponent(resultReport.title)}&body=${encodeURIComponent(shareText)}`}>
                <Button variant="outline" className="w-full justify-start">
                  <Mail size={16} />
                  שלח במייל
                </Button>
              </a>
              {resultReport.pdfUrl && (
                <a href={resultReport.pdfUrl} download target="_blank" rel="noreferrer">
                  <Button variant="outline" className="w-full justify-start">
                    <Download size={16} />
                    הורד PDF
                  </Button>
                </a>
              )}
            </div>

            <Button
              onClick={() => router.push(`/reports?project=${projectId}`)}
              className="w-full"
            >
              <FileText size={16} />
              ראה בדוחות הפרויקט
            </Button>
            <Button variant="ghost" onClick={resetAll} className="w-full">דוח שטח נוסף</Button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
