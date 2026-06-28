'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, ArrowRight, AlertTriangle, Send, Camera, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { useRef } from 'react'
import { formatDate, SEVERITY_COLORS, STATUS_COLORS, STATUS_LABELS, CATEGORY_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import type { Defect } from '@sitepilot/types'

const SEVERITY_LABELS: Record<string, string> = { LOW: 'נמוכה', MEDIUM: 'בינונית', HIGH: 'גבוהה', CRITICAL: 'קריטי' }
const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const SEVERITIES = Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label }))
const STATUSES = [
  { value: 'OPEN', label: 'פתוח' }, { value: 'IN_PROGRESS', label: 'בטיפול' },
  { value: 'FIXED', label: 'תוקן' }, { value: 'VERIFIED', label: 'אומת' }, { value: 'CLOSED', label: 'סגור' },
]

const STATUS_ACTIONS: Record<string, { label: string; next: string; variant?: 'default' | 'outline' }[]> = {
  OPEN:        [{ label: 'התחל טיפול', next: 'IN_PROGRESS' }],
  IN_PROGRESS: [{ label: 'סמן כתוקן', next: 'FIXED' }, { label: 'סגור', next: 'CLOSED', variant: 'outline' }],
  FIXED:       [{ label: 'אמת תיקון', next: 'VERIFIED' }, { label: 'פתח מחדש', next: 'OPEN', variant: 'outline' }],
  VERIFIED:    [{ label: 'סגור', next: 'CLOSED' }],
  CLOSED:      [{ label: 'פתח מחדש', next: 'OPEN', variant: 'outline' }],
}

export default function DefectsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [detailDefect, setDetailDefect] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [comment, setComment] = useState('')
  const [uploading, setUploading] = useState(false)
  const [localPhotos, setLocalPhotos] = useState<string[]>([])
  const [quickPhoto, setQuickPhoto] = useState<File | null>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '', location: '', category: 'OTHER', description: '',
    severity: 'MEDIUM', dueDate: '', status: 'OPEN',
  })
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const { data, refetch } = useQuery({
    queryKey: ['defects', projectId],
    queryFn: () => api.get<{ data: (Defect & { assignedTo?: any; contractor?: any; comments?: any[]; beforePhotos?: any[]; afterPhotos?: any[] })[] }>(`/projects/${projectId}/defects`),
    enabled: !!projectId,
  })

  const filtered = (data?.data ?? []).filter((d) => !statusFilter || d.status === statusFilter)

  const createMutation = useMutation({
    mutationFn: async (d: typeof form) => {
      const res = await api.post<{ data: any }>(`/projects/${projectId}/defects`, d)
      if (quickPhoto) {
        const fd = new FormData()
        fd.append('file', quickPhoto)
        fd.append('defectBeforeId', res.data.id)
        fd.append('projectId', projectId)
        await api.upload('/photos/upload', fd)
      }
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['defects', projectId] })
      setCreateOpen(false)
      setForm({ title: '', location: '', category: 'OTHER', description: '', severity: 'MEDIUM', dueDate: '', status: 'OPEN' })
      setQuickPhoto(null)
    },
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/projects/${projectId}/defects/${id}`, { status }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['defects', projectId] })
      setDetailDefect((d: any) => d ? { ...d, status: res.data.status } : d)
    },
  })

  const addComment = useMutation({
    mutationFn: (content: string) =>
      api.post(`/projects/${projectId}/defects/${detailDefect?.id}/comments`, { content }),
    onSuccess: (res: any) => {
      setComment('')
      setDetailDefect((d: any) => d ? { ...d, comments: [...(d.comments ?? []), res.data] } : d)
      qc.invalidateQueries({ queryKey: ['defects', projectId] })
    },
  })

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') {
    const file = e.target.files?.[0]
    if (!file || !detailDefect) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append(type === 'before' ? 'defectBeforeId' : 'defectAfterId', detailDefect.id)
      fd.append('projectId', projectId)
      const res = await api.upload<{ data: { url: string } }>('/photos/upload', fd)
      setLocalPhotos((prev) => [...prev, res.data.url])
      qc.invalidateQueries({ queryKey: ['defects', projectId] })
    } catch {}
    setUploading(false)
    e.target.value = ''
  }

  function openDetail(defect: any) {
    setDetailDefect(defect)
    setComment('')
    setLocalPhotos([])
    setTimeout(() => commentInputRef.current?.focus(), 300)
  }

  const afterPhotos = [
    ...(detailDefect?.afterPhotos ?? []).map((p: any) => p.url),
    ...localPhotos,
  ]

  return (
    <AppLayout title="ליקויים">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/projects/${projectId}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
              <ArrowRight size={13} />חזרה
            </Link>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40">
              <option value="">כל הסטטוסים</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />ליקוי חדש
          </Button>
        </div>

        {filtered.length === 0 ? (
          <div className="card text-center py-14">
            <AlertTriangle size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">אין ליקויים</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((defect) => (
              <button key={defect.id} onClick={() => openDetail(defect)}
                className="w-full card text-right hover:border-primary/30 hover:shadow-md transition-all">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold text-neutral-dark">{defect.title}</h3>
                      <Badge className={SEVERITY_COLORS[defect.severity]}>{SEVERITY_LABELS[defect.severity]}</Badge>
                      <Badge className={STATUS_COLORS[defect.status as keyof typeof STATUS_COLORS]}>{STATUS_LABELS[defect.status]}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mb-1 line-clamp-2">{defect.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                      <span>{CATEGORY_LABELS[defect.category]}</span>
                      {defect.location && <span>📍 {defect.location}</span>}
                      {defect.dueDate && <span>יעד: {formatDate(defect.dueDate)}</span>}
                      {(defect as any).assignedTo && <span>משויך: {(defect as any).assignedTo.name}</span>}
                      {(defect as any).comments?.length > 0 && <span>💬 {(defect as any).comments.length} הערות</span>}
                    </div>
                  </div>
                  <ArrowRight size={15} className="text-gray-300 rotate-180 shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Modal: יצירת ליקוי ─── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ליקוי חדש" size="lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="כותרת *" value={form.title} onChange={set('title')} placeholder="תיאור הליקוי" />
            <Input label="מיקום" value={form.location} onChange={set('location')} placeholder="קומה / דירה / מיקום" />
          </div>
          <Textarea label="פירוט *" value={form.description} onChange={set('description') as any} />
          <div className="grid sm:grid-cols-3 gap-3">
            <Select label="קטגוריה" value={form.category} onChange={set('category')} options={CATEGORIES} />
            <Select label="חומרה" value={form.severity} onChange={set('severity')} options={SEVERITIES} />
            <Input label="תאריך יעד" type="date" value={form.dueDate} onChange={set('dueDate')} />
          </div>

          {/* תמונה מהשטח — לצילום מהיר תוך כדי סיבוב באתר */}
          <div>
            {quickPhoto ? (
              <div className="flex items-center gap-3">
                <img src={URL.createObjectURL(quickPhoto)} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                <button onClick={() => setQuickPhoto(null)} className="text-sm text-danger hover:underline">
                  הסר תמונה
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline w-fit">
                <Camera size={15} />
                צלם / הוסף תמונה (אופציונלי)
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => setQuickPhoto(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={() => createMutation.mutate(form)} loading={createMutation.isPending} disabled={!form.title || !form.description}>
              שמור ליקוי
            </Button>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setQuickPhoto(null) }}>ביטול</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Modal: פרטי ליקוי ─── */}
      <Modal open={!!detailDefect} onClose={() => setDetailDefect(null)} title={detailDefect?.title || ''} size="lg">
        {detailDefect && (
          <div className="space-y-5">
            {/* פרטים */}
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS_COLORS[detailDefect.status as keyof typeof STATUS_COLORS]}>
                {STATUS_LABELS[detailDefect.status]}
              </Badge>
              <Badge className={SEVERITY_COLORS[detailDefect.severity]}>
                {SEVERITY_LABELS[detailDefect.severity]}
              </Badge>
              <span className="text-xs text-gray-400 self-center">{CATEGORY_LABELS[detailDefect.category]}</span>
              {detailDefect.location && <span className="text-xs text-gray-400 self-center">📍 {detailDefect.location}</span>}
            </div>

            <p className="text-sm text-gray-700">{detailDefect.description}</p>

            {detailDefect.dueDate && (
              <p className="text-xs text-gray-400">תאריך יעד: {formatDate(detailDefect.dueDate)}</p>
            )}
            {detailDefect.assignedTo && (
              <p className="text-xs text-gray-500">משויך ל: <span className="font-medium">{detailDefect.assignedTo.name}</span></p>
            )}

            {/* עדכון סטטוס */}
            {STATUS_ACTIONS[detailDefect.status]?.length > 0 && (
              <div className="flex gap-2 flex-wrap border-t border-gray-100 pt-4">
                {STATUS_ACTIONS[detailDefect.status].map(({ label, next, variant }) => (
                  <Button key={next} size="sm" variant={variant as any}
                    onClick={() => updateStatus.mutate({ id: detailDefect.id, status: next })}
                    loading={updateStatus.isPending}>
                    {next === 'FIXED' && <CheckCircle2 size={14} />}
                    {next === 'IN_PROGRESS' && <Clock size={14} />}
                    {next === 'CLOSED' && <XCircle size={14} />}
                    {label}
                  </Button>
                ))}
              </div>
            )}

            {/* תמונות לפני */}
            {detailDefect.beforePhotos?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2">תמונות לפני תיקון</p>
                <div className="grid grid-cols-3 gap-2">
                  {detailDefect.beforePhotos.map((p: any) => (
                    <img key={p.id} src={p.url} className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80" onClick={() => window.open(p.url)} />
                  ))}
                </div>
              </div>
            )}

            {/* העלאת תמונות/סרטון */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-sm font-semibold text-neutral-dark">תמונות תיקון</p>

              {afterPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {afterPhotos.map((url, i) => {
                    const isVideo = url.match(/\.(mp4|mov|webm|avi)$/i)
                    return isVideo
                      ? <video key={i} src={url} className="w-full h-24 object-cover rounded-lg" controls />
                      : <img key={i} src={url} className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-80" onClick={() => window.open(url)} />
                  })}
                </div>
              )}

              <div className="flex gap-3">
                <label className={`flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Camera size={15} />
                  {uploading ? 'מעלה...' : 'הוסף תמונה לפני תיקון'}
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'before')} />
                </label>
                <label className={`flex items-center gap-2 text-sm text-success cursor-pointer hover:underline ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Camera size={15} />
                  {uploading ? '' : 'תמונה אחרי תיקון'}
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'after')} />
                </label>
              </div>
            </div>

            {/* תגובות */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-neutral-dark mb-3">הערות ותגובות</p>
              <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                {(detailDefect.comments ?? []).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">אין הערות עדיין</p>
                ) : (
                  (detailDefect.comments ?? []).map((c: any, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-gray-500 mb-1 font-medium">{c.author?.name} · {formatDate(c.createdAt)}</p>
                      <p className="text-sm text-neutral-dark">{c.content}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  ref={commentInputRef}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="כתוב הערה ולחץ שלח..."
                  onKeyDown={(e) => { if (e.key === 'Enter' && comment.trim()) addComment.mutate(comment.trim()) }}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <button
                  onClick={() => { if (comment.trim()) addComment.mutate(comment.trim()) }}
                  className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                    comment.trim()
                      ? 'bg-primary text-white hover:bg-primary-600 shadow-sm'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                  title={comment.trim() ? 'שלח הערה' : 'כתוב הערה תחילה'}
                >
                  {addComment.isPending
                    ? <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : <Send size={16} />
                  }
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  )
}
