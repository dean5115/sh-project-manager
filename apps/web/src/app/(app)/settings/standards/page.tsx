'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, BookMarked, Trash2, Pencil, Upload, X, ImageIcon, FileUp, FileText, ExternalLink } from 'lucide-react'
import { useRef, useState } from 'react'
import { CATEGORY_LABELS } from '@/lib/utils'
import type { Standard, StandardReference } from '@sitepilot/types'

const SOURCE_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'REGULATION', label: 'תקנות התכנון והבניה', color: 'bg-red-100 text-red-700' },
  { value: 'HALAT', label: 'הל"ת', color: 'bg-amber-100 text-amber-700' },
  { value: 'STANDARD', label: 'תקן', color: 'bg-blue-100 text-blue-700' },
]

const CATEGORY_OPTIONS = [
  { value: '', label: 'כללי (לא קטגוריה ספציפית)' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
]

const emptyForm = {
  id: '',
  sourceType: 'STANDARD',
  category: '',
  code: '',
  description: '',
  precedenceNote: '',
  references: [] as StandardReference[],
  fullDocumentUrl: '',
}

export default function StandardsPage() {
  const qc = useQueryClient()
  const refFileInput = useRef<HTMLInputElement>(null)
  const fullDocFileInput = useRef<HTMLInputElement>(null)
  const [uploadingFullDoc, setUploadingFullDoc] = useState(false)
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Standard | null>(null)
  const [filterSource, setFilterSource] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [uploadingRef, setUploadingRef] = useState(false)
  const [pendingCaption, setPendingCaption] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: [] as string[] })

  const { data } = useQuery({
    queryKey: ['standards'],
    queryFn: () => api.get<{ data: Standard[] }>('/standards'),
  })
  const standards = (data?.data ?? []).filter((s) => !filterSource || s.sourceType === filterSource)

  function openNew() {
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(s: Standard) {
    setForm({
      id: s.id,
      sourceType: s.sourceType,
      category: s.category || '',
      code: s.code,
      description: s.description || '',
      precedenceNote: s.precedenceNote || '',
      references: s.references || [],
      fullDocumentUrl: s.fullDocumentUrl || '',
    })
    setOpen(true)
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        sourceType: form.sourceType,
        category: form.category || undefined,
        code: form.code,
        description: form.description || undefined,
        precedenceNote: form.precedenceNote || undefined,
        references: form.references,
        fullDocumentUrl: form.fullDocumentUrl || undefined,
      }
      return form.id ? api.put(`/standards/${form.id}`, payload) : api.post('/standards', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standards'] })
      setOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/standards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['standards'] })
      setDeleteTarget(null)
    },
  })

  async function handleRefUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingRef(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.upload<{ data: { url: string } }>('/photos/upload', fd)
      setForm((f) => ({
        ...f,
        references: [...f.references, { imageUrl: res.data.url, caption: pendingCaption || f.code || 'מסמך רפרנס' }],
      }))
      setPendingCaption('')
    } finally {
      setUploadingRef(false)
      e.target.value = ''
    }
  }

  async function handleFullDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFullDoc(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.upload<{ data: { url: string } }>('/photos/upload', fd)
      setForm((f) => ({ ...f, fullDocumentUrl: res.data.url }))
    } finally {
      setUploadingFullDoc(false)
      e.target.value = ''
    }
  }

  function removeRef(idx: number) {
    setForm((f) => ({ ...f, references: f.references.filter((_, i) => i !== idx) }))
  }

  function updateRefCaption(idx: number, caption: string) {
    setForm((f) => ({ ...f, references: f.references.map((r, i) => (i === idx ? { ...r, caption } : r)) }))
  }

  // ייבוא מהיר — כל שורה: sourceType|category|code|description (category/description אופציונליים)
  async function runImport() {
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    setImporting(true)
    setImportProgress({ done: 0, total: lines.length, errors: [] })
    const errors: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const [sourceType, category, code, description, precedenceNote] = lines[i].split('|').map((s) => (s ?? '').trim())
      if (!sourceType || !code) {
        errors.push(`שורה ${i + 1}: חסר סוג מקור או קוד`)
      } else {
        try {
          await api.post('/standards', {
            sourceType,
            category: category || undefined,
            code,
            description: description || undefined,
            precedenceNote: precedenceNote || undefined,
          })
        } catch (err: any) {
          errors.push(`שורה ${i + 1} (${code}): ${err.message || 'שגיאה'}`)
        }
      }
      setImportProgress({ done: i + 1, total: lines.length, errors: [...errors] })
    }
    qc.invalidateQueries({ queryKey: ['standards'] })
    setImporting(false)
  }

  return (
    <AppLayout title="ספריית תקנים">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterSource('')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                !filterSource ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              הכל
            </button>
            {SOURCE_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setFilterSource(filterSource === t.value ? '' : t.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterSource === t.value ? 'bg-primary text-white border-primary' : `${t.color} border-transparent`
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp size={14} />
              ייבוא מהיר
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus size={14} />
              תקן חדש
            </Button>
          </div>
        </div>

        {standards.length === 0 ? (
          <div className="card text-center py-14">
            <BookMarked size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">אין תקנים עדיין</p>
            <p className="text-gray-400 text-sm mt-1">הוסף תקנים, תקנות והל"ת לשימוש בדוחות בדק בית</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {standards.map((s) => {
              const st = SOURCE_TYPES.find((t) => t.value === s.sourceType)
              return (
                <div key={s.id} className="card space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st?.color}`}>{st?.label}</span>
                    {s.category && (
                      <span className="text-xs text-gray-400">{CATEGORY_LABELS[s.category]}</span>
                    )}
                  </div>
                  <p className="font-medium text-neutral-dark text-sm">{s.code}</p>
                  {s.description && <p className="text-xs text-gray-500 line-clamp-2">{s.description}</p>}
                  {s.precedenceNote && (
                    <p className="text-xs text-red-600 font-medium bg-red-50 rounded-lg px-2 py-1">{s.precedenceNote}</p>
                  )}
                  {(s.references?.length ?? 0) > 0 && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <ImageIcon size={12} />
                      {s.references!.length} תמונות רפרנס
                    </p>
                  )}
                  {s.fullDocumentUrl && (
                    <a
                      href={s.fullDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary flex items-center gap-1 hover:underline w-fit"
                    >
                      <FileText size={12} />
                      צפה בתקן המלא
                      <ExternalLink size={11} />
                    </a>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-gray-50">
                    <Button size="sm" variant="outline" onClick={() => openEdit(s)} className="flex-1">
                      <Pencil size={13} />
                      ערוך
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setDeleteTarget(s)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'עריכת תקן' : 'תקן חדש'} size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-neutral-dark">סוג מקור *</label>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {SOURCE_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, sourceType: t.value }))}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    form.sourceType === t.value ? 'bg-primary text-white border-primary' : `${t.color} border-transparent`
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <Select
            label="קטגוריה"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={CATEGORY_OPTIONS}
          />
          <Input
            label="קוד / מספר תקן *"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder='תקן 5044 חלק 2 שנת 2003 סעיף 3.3.1'
          />
          <Textarea
            label="תיאור (פנימי, לא מודפס בדוח)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <Textarea
            label='הערת עדיפות (אופציונלי — למשל "בנושא מרחבי שימוש: ראה הל״ת")'
            value={form.precedenceNote}
            onChange={(e) => setForm((f) => ({ ...f, precedenceNote: e.target.value }))}
          />

          <div>
            <label className="text-sm font-medium text-neutral-dark">קובץ PDF מלא של התקן (אופציונלי)</label>
            <div className="mt-1.5">
              {form.fullDocumentUrl ? (
                <div className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                  <FileText size={16} className="text-gray-400 shrink-0" />
                  <a
                    href={form.fullDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-primary hover:underline truncate"
                  >
                    צפה בקובץ שהועלה
                  </a>
                  <button
                    onClick={() => setForm((f) => ({ ...f, fullDocumentUrl: '' }))}
                    className="p-1.5 text-gray-400 hover:text-danger shrink-0"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <Button variant="outline" size="sm" loading={uploadingFullDoc} type="button" onClick={() => fullDocFileInput.current?.click()}>
                  <Upload size={13} />
                  העלה קובץ PDF
                </Button>
              )}
              <input ref={fullDocFileInput} type="file" accept="application/pdf" className="hidden" onChange={handleFullDocUpload} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-dark">תמונות רפרנס (נוסח תקן, פסיקה וכו')</label>
            <div className="space-y-2 mt-1.5">
              {form.references.map((ref, i) => (
                <div key={i} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                  <img src={ref.imageUrl} className="w-12 h-12 object-cover rounded-md shrink-0" />
                  <input
                    value={ref.caption}
                    onChange={(e) => updateRefCaption(i, e.target.value)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
                    placeholder="כיתוב..."
                  />
                  <button onClick={() => removeRef(i)} className="p-1.5 text-gray-400 hover:text-danger shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={pendingCaption}
                  onChange={(e) => setPendingCaption(e.target.value)}
                  placeholder="כיתוב לתמונה הבאה..."
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
                />
                <Button variant="outline" size="sm" loading={uploadingRef} type="button" onClick={() => refFileInput.current?.click()} className="shrink-0">
                  <Upload size={13} />
                  העלה
                </Button>
                <input ref={refFileInput} type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending} disabled={!form.code}>
              שמור
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="מחיקת תקן" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">למחוק את <strong>{deleteTarget?.code}</strong>?</p>
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => deleteMutation.mutate(deleteTarget!.id)} loading={deleteMutation.isPending}>
              מחק
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => { if (!importing) { setImportOpen(false); setImportText(''); setImportProgress({ done: 0, total: 0, errors: [] }) } }}
        title="ייבוא מהיר של תקנים"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            שורה אחת לכל תקן, בפורמט: <code className="bg-gray-100 px-1 rounded">STANDARD|קטגוריה|קוד|תיאור|הערת עדיפות</code>
            {' '}(קטגוריה, תיאור והערת עדיפות אופציונליים — אפשר להשאיר ריק). סוג מקור: REGULATION / HALAT / STANDARD.
          </p>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'STANDARD|PLUMBING|ת"י 1205 חלק 3|קבועות שרברבות ואבזריהן\nREGULATION||תקנות התכנון והבניה|בקשה להיתר, תנאיו ואגרות|גובר על כל תקן והל"ת'}
            rows={14}
            className="font-mono text-xs"
            disabled={importing}
          />
          {importProgress.total > 0 && (
            <div className="space-y-1">
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">{importProgress.done} / {importProgress.total}</p>
              {importProgress.errors.length > 0 && (
                <div className="text-xs text-danger space-y-0.5 max-h-24 overflow-auto">
                  {importProgress.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={runImport} loading={importing} disabled={!importText.trim()}>
              ייבא
            </Button>
            <Button
              variant="outline"
              disabled={importing}
              onClick={() => { setImportOpen(false); setImportText(''); setImportProgress({ done: 0, total: 0, errors: [] }) }}
            >
              {importProgress.done > 0 && importProgress.done === importProgress.total ? 'סגור' : 'ביטול'}
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
