'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Plus, ClipboardList, Trash2, Pencil, Search, FileUp } from 'lucide-react'
import { useState } from 'react'
import { CATEGORY_LABELS } from '@/lib/utils'
import type { FindingTemplate, Standard } from '@sitepilot/types'

const CATEGORY_OPTIONS = [
  { value: '', label: 'כללי (לא קטגוריה ספציפית)' },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
]

const emptyForm = {
  id: '',
  title: '',
  category: '',
  recommendation: '',
  standardIds: [] as string[],
}

export default function FindingTemplatesPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FindingTemplate | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, errors: [] as string[] })

  const { data } = useQuery({
    queryKey: ['finding-templates'],
    queryFn: () => api.get<{ data: FindingTemplate[] }>('/finding-templates'),
  })
  const templates = (data?.data ?? []).filter((t) => !search || t.title.includes(search))

  const { data: standardsData } = useQuery({
    queryKey: ['standards'],
    queryFn: () => api.get<{ data: Standard[] }>('/standards'),
  })
  const standards = standardsData?.data ?? []
  const relevantStandards = standards.filter((s) => !form.category || !s.category || s.category === form.category)

  function openNew() {
    setForm(emptyForm)
    setOpen(true)
  }

  function openEdit(t: FindingTemplate) {
    setForm({
      id: t.id,
      title: t.title,
      category: t.category || '',
      recommendation: t.recommendation,
      standardIds: t.standardIds || [],
    })
    setOpen(true)
  }

  function toggleStandard(id: string) {
    setForm((f) => ({
      ...f,
      standardIds: f.standardIds.includes(id) ? f.standardIds.filter((s) => s !== id) : [...f.standardIds, id],
    }))
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title,
        category: form.category || undefined,
        recommendation: form.recommendation,
        standardIds: form.standardIds,
      }
      return form.id ? api.put(`/finding-templates/${form.id}`, payload) : api.post('/finding-templates', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finding-templates'] })
      setOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/finding-templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finding-templates'] })
      setDeleteTarget(null)
    },
  })

  // ייבוא מהיר — כל שורה: קטגוריה|כותרת|המלצה|קודי תקנים (מופרדים ב-;, מזוהים לפי טקסט הקוד המדויק בספריית התקנים)
  async function runImport() {
    const lines = importText.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    setImporting(true)
    setImportProgress({ done: 0, total: lines.length, errors: [] })
    const errors: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const [category, title, recommendation, standardCodes] = lines[i].split('|').map((s) => (s ?? '').trim())
      if (!title || !recommendation) {
        errors.push(`שורה ${i + 1}: חסרה כותרת או המלצה`)
      } else {
        const codes = (standardCodes || '').split(';').map((c) => c.trim()).filter(Boolean)
        const standardIds: string[] = []
        const missingCodes: string[] = []
        for (const code of codes) {
          const match = standards.find((s) => s.code.trim() === code)
          if (match) standardIds.push(match.id)
          else missingCodes.push(code)
        }
        if (missingCodes.length) {
          errors.push(`שורה ${i + 1} (${title}): לא נמצאו תקנים בספרייה: ${missingCodes.join(', ')}`)
        }
        try {
          await api.post('/finding-templates', {
            title,
            category: category || undefined,
            recommendation,
            standardIds,
          })
        } catch (err: any) {
          errors.push(`שורה ${i + 1} (${title}): ${err.message || 'שגיאה'}`)
        }
      }
      setImportProgress({ done: i + 1, total: lines.length, errors: [...errors] })
    }
    qc.invalidateQueries({ queryKey: ['finding-templates'] })
    setImporting(false)
  }

  return (
    <AppLayout title="ממצאים נפוצים">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative">
            <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש ממצא..."
              className="border border-gray-200 rounded-lg pr-8 pl-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-56"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp size={14} />
              ייבוא מהיר
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus size={14} />
              ממצא נפוץ חדש
            </Button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="card text-center py-14">
            <ClipboardList size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500">אין ממצאים נפוצים עדיין</p>
            <p className="text-gray-400 text-sm mt-1">
              נבנה גם אוטומטית תוך כדי כתיבת דוחות בדק בית — "שמור כממצא נפוץ"
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((t) => (
              <div key={t.id} className="card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-neutral-dark text-sm flex-1">{t.title}</p>
                  {t.category && (
                    <span className="text-xs text-gray-400 shrink-0">{CATEGORY_LABELS[t.category]}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 line-clamp-3">{t.recommendation}</p>
                {t.standardIds.length > 0 && (
                  <p className="text-xs text-primary">{t.standardIds.length} תקנים משויכים</p>
                )}
                <div className="flex gap-2 pt-2 border-t border-gray-50">
                  <Button size="sm" variant="outline" onClick={() => openEdit(t)} className="flex-1">
                    <Pencil size={13} />
                    ערוך
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setDeleteTarget(t)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={form.id ? 'עריכת ממצא נפוץ' : 'ממצא נפוץ חדש'} size="md">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-dark">כותרת הממצא *</label>
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="משקוף דלת כניסה ראשית אינו צבוע כהלכה (פגום)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <Select
            label="קטגוריה"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={CATEGORY_OPTIONS}
          />
          <Textarea
            label="המלצה (ברירת מחדל)"
            value={form.recommendation}
            onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))}
            placeholder="יש להסיר את הצבע הלקוי ולחדש צביעה..."
          />

          <div>
            <label className="text-sm font-medium text-neutral-dark">תקנים משויכים כברירת מחדל</label>
            {relevantStandards.length === 0 ? (
              <p className="text-xs text-gray-400 mt-1.5">אין תקנים מתאימים — ניתן להוסיף ב"ספריית תקנים"</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {relevantStandards.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleStandard(s.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      form.standardIds.includes(s.id)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40'
                    }`}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
              disabled={!form.title || !form.recommendation}
            >
              שמור
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="מחיקת ממצא נפוץ" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">למחוק את <strong>{deleteTarget?.title}</strong>?</p>
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
        title="ייבוא מהיר של ממצאים נפוצים"
        size="lg"
      >
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            שורה אחת לכל ממצא, בפורמט:{' '}
            <code className="bg-gray-100 px-1 rounded">קטגוריה|כותרת|המלצה|קודי תקנים</code>
            {' '}(קטגוריה וקודי תקנים אופציונליים — אפשר להשאיר ריק). מספר תקנים מופרדים ב-<code className="bg-gray-100 px-1 rounded">;</code>,
            {' '}וכל קוד תקן חייב להתאים בדיוק לטקסט הקוד כפי שמופיע ב"ספריית תקנים" (ייבא תקנים לפני ממצאים).
          </p>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'DOOR_ENTRANCE|משקוף דלת כניסה ראשית אינו צבוע כהלכה|יש להסיר את הצבע הלקוי ולחדש צביעה בהתאם לתקן|ת"י 1068\nELECTRICAL_SAFETY_FIXTURES|אין מפסק פחת בלוח החשמל|יש להתקין מפסק פחת בהתאם לתקנות החשמל|תקנות החשמל'}
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
