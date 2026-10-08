'use client'
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { FileText, Download, Plus, CheckCircle2, Trash2, Pencil, FolderInput, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate, formatDateTime } from '@/lib/utils'
import { loadDraft } from '@/lib/field-report-draft'
import { useState } from 'react'

const REPORT_TYPES = [
  {
    value: 'DAILY',
    label: 'דוח יומי',
    desc: 'סיכום יומני עבודה: עבודות שבוצעו, כוח אדם, מזג אוויר ובעיות',
    icon: '📋',
  },
  {
    value: 'DEFECTS',
    label: 'דוח ליקויים',
    desc: 'רשימת כל הליקויים בפרויקט לפי קטגוריה, חומרה וסטטוס טיפול',
    icon: '🔧',
  },
  {
    value: 'TASKS',
    label: 'דוח משימות',
    desc: 'סטטוס כלל המשימות בפרויקט לפי עדיפות ואחראי',
    icon: '✅',
  },
  {
    value: 'PROGRESS',
    label: 'דוח התקדמות',
    desc: 'סיכום כולל של מצב הפרויקט, אחוז השלמה ואבני דרך',
    icon: '📊',
  },
  {
    value: 'HANDOVER',
    label: 'דוח מסירה',
    desc: 'דוח רשמי למסירת פרויקט ליזם / לקוח, כולל נספחים',
    icon: '🏗️',
  },
  {
    value: 'INSPECTION',
    label: 'דוח פיקוח',
    desc: 'ממצאי ביקור פיקוח: תצפיות, המלצות ודרישות תיקון',
    icon: '🔍',
  },
]

// דוח בדק בית נוצר רק דרך flow "דוח שטח" (לא דרך המודל הידני של הפקת דוח) —
// לכן לא נכלל ב-REPORT_TYPES עצמו, רק ברשימה הזו לצורך תצוגת אייקון/badge בלבד
const HOME_INSPECTION_TYPE = { value: 'HOME_INSPECTION', label: 'דוח בדק בית', icon: '🏠' }
const ALL_REPORT_TYPES = [...REPORT_TYPES, HOME_INSPECTION_TYPE]

// דוחות פיקוח ומסירה בנויים מתמונות וממצאים שנאספים בשטח — הפקה ידנית מכאן הייתה יוצרת PDF ריק,
// לכן מפנים אותם ל-flow "דוח שטח" של הפרויקט
const FIELD_REPORT_TYPES = ['INSPECTION', 'HANDOVER']

// דוחות שטח שנשמרו עם הממצאים (sourceItems) — אפשר לערוך אותם ולהעביר לפרויקט אחר
function isEditableFieldReport(report: any) {
  return ['INSPECTION', 'HANDOVER', 'HOME_INSPECTION'].includes(report.type) && !!report.sourceItems
}

export default function ReportsPage() {
  const qc = useQueryClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ projectId: '', type: 'DAILY', title: '', dateFrom: '', dateTo: '' })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [moveTarget, setMoveTarget] = useState<any>(null)
  const [moveTo, setMoveTo] = useState('')
  const [movedNotice, setMovedNotice] = useState<{ title: string; projectId: string; projectName: string } | null>(null)

  const [selectedProject, setSelectedProject] = useState('')

  // קריאת ?project= מהכתובת (למשל כשמגיעים מדף דוח השטח)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('project')
    if (p) setSelectedProject(p)
  }, [])

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: any[] }>('/projects'),
  })

  const { data: reports } = useQuery({
    queryKey: ['reports', selectedProject],
    queryFn: () => api.get<{ data: any[] }>(`/projects/${selectedProject}/reports`),
    enabled: !!selectedProject,
  })

  // טיוטת דוח שטח שנשמרה ("שמור טיוטה") אינה דוח מופק — מציגים אותה כאן כדי שיהיה ברור שהיא קיימת ואיך ממשיכים
  const { data: draft } = useQuery({
    queryKey: ['field-report-draft-summary', selectedProject],
    queryFn: async () => {
      const [cloudRes, local] = await Promise.all([
        api.get<{ data: any }>(`/projects/${selectedProject}/field-report-draft`).catch(() => null),
        loadDraft(selectedProject).catch(() => null),
      ])
      const cloud = cloudRes?.data
      const cloudTime = cloud?.items?.length ? new Date(cloud.updatedAt).getTime() : 0
      const localTime = local?.items?.length ? local.savedAt : 0
      if (!cloudTime && !localTime) return null
      return cloudTime >= localTime
        ? { type: cloud.type as string, count: cloud.items.length as number, savedAt: cloudTime }
        : { type: local!.reportType as string, count: local!.items.length, savedAt: localTime }
    },
    enabled: !!selectedProject,
  })

  const generateMutation = useMutation({
    mutationFn: (d: typeof form) => api.post<{ data: any }>('/reports/generate', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports', form.projectId] })
      if (form.projectId !== selectedProject) setSelectedProject(form.projectId)
      setOpen(false)
      setForm((f) => ({ ...f, title: '' }))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports', selectedProject] })
      setDeleteTarget(null)
    },
  })

  const moveMutation = useMutation({
    mutationFn: () => api.post<{ data: any }>(`/projects/${selectedProject}/field-report/${moveTarget.id}/move`, { targetProjectId: moveTo }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['reports', selectedProject] })
      qc.invalidateQueries({ queryKey: ['reports', moveTo] })
      setMovedNotice({
        title: res.data.title,
        projectId: moveTo,
        projectName: (projects?.data ?? []).find((p: any) => p.id === moveTo)?.name || '',
      })
      setMoveTarget(null)
      setMoveTo('')
    },
  })

  function openMove(report: any) {
    moveMutation.reset()
    setMoveTo('')
    setMoveTarget(report)
  }

  const projectOptions = (projects?.data ?? []).map((p: any) => ({ value: p.id, label: p.name }))
  const selectedType = REPORT_TYPES.find((t) => t.value === form.type)
  const isFieldReportType = FIELD_REPORT_TYPES.includes(form.type)

  return (
    <AppLayout title="דוחות">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <Select
            options={[{ value: '', label: 'בחר פרויקט לצפייה בדוחות...' }, ...projectOptions]}
            value={selectedProject}
            onChange={(e) => { setSelectedProject(e.target.value); setMovedNotice(null) }}
            placeholder=""
          />
          <Button size="sm" onClick={() => { generateMutation.reset(); setForm((f) => ({ ...f, projectId: selectedProject })); setOpen(true) }}>
            <Plus size={14} />
            הפק דוח חדש
          </Button>
        </div>

        {movedNotice && (
          <div className="card flex flex-wrap items-center gap-3 bg-green-50 border border-green-200">
            <CheckCircle2 size={18} className="text-green-600 shrink-0" />
            <p className="flex-1 min-w-0 text-sm text-green-800">
              הדוח <strong>{movedNotice.title}</strong> הועבר לפרויקט <strong>{movedNotice.projectName}</strong>
            </p>
            <Button size="sm" variant="outline" onClick={() => { setSelectedProject(movedNotice.projectId); setMovedNotice(null) }}>
              עבור לפרויקט
            </Button>
            <button onClick={() => setMovedNotice(null)} aria-label="סגור" className="p-1 text-green-700 hover:text-green-900">
              <X size={14} />
            </button>
          </div>
        )}

        {selectedProject && draft && (
          <div className="card flex items-center gap-3 border-2 border-dashed border-amber-300 bg-amber-50">
            <span className="text-2xl shrink-0">📝</span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-neutral-dark">
                טיוטה שמורה — {ALL_REPORT_TYPES.find((t) => t.value === draft.type)?.label || 'דוח שטח'} ({draft.count} ממצאים)
              </p>
              <p className="text-xs text-gray-500">נשמרה {formatDateTime(new Date(draft.savedAt))} · עדיין לא הופקה כדוח</p>
            </div>
            <Link href={`/projects/${selectedProject}/field-report`}>
              <Button size="sm">
                <Pencil size={14} />
                המשך והפק דוח
              </Button>
            </Link>
          </div>
        )}

        {selectedProject && (
          <div className="space-y-3">
            {(reports?.data ?? []).length === 0 ? (
              <div className="card text-center py-12">
                <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm font-medium">אין דוחות עדיין לפרויקט זה</p>
                <p className="text-gray-400 text-xs mt-1">לחץ "הפק דוח חדש" כדי ליצור את הדוח הראשון</p>
              </div>
            ) : (
              (reports?.data ?? []).map((report: any) => {
                const rt = ALL_REPORT_TYPES.find((t) => t.value === report.type)
                return (
                  // בטלפון: שם הדוח בשורה אחת והכפתורים מתחתיו, כדי שהשם לא יידחס
                  <div key={report.id} className="card flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-2xl shrink-0">{rt?.icon || '📄'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-neutral-dark truncate">{report.title}</p>
                        <p className="text-xs text-gray-400">{formatDate(report.createdAt)}</p>
                      </div>
                      <Badge className="bg-primary-50 text-primary shrink-0 hidden sm:inline-flex">
                        {rt?.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                      {isEditableFieldReport(report) && (
                        <Link href={`/projects/${selectedProject}/field-report?edit=${report.id}`}>
                          <Button variant="outline" size="sm">
                            <Pencil size={14} />
                            ערוך
                          </Button>
                        </Link>
                      )}
                      {isEditableFieldReport(report) && projectOptions.length > 1 && (
                        <Button variant="outline" size="sm" onClick={() => openMove(report)}>
                          <FolderInput size={14} />
                          העבר
                        </Button>
                      )}
                      {report.pdfUrl && (
                        <a href={report.pdfUrl} download target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            <Download size={14} />
                            הורד
                          </Button>
                        </a>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(report)} aria-label="מחק דוח">
                        <Trash2 size={14} className="text-danger" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {!selectedProject && (
          <div className="card text-center py-10">
            <FileText size={36} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">בחר פרויקט כדי לראות את הדוחות שלו</p>
          </div>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="הפקת דוח חדש" size="md">
        <div className="space-y-4">
          <Select
            label="פרויקט *"
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            options={[{ value: '', label: 'בחר פרויקט...' }, ...projectOptions]}
            placeholder=""
          />

          {/* Report type selector */}
          <div>
            <p className="text-sm font-medium text-neutral-dark mb-2">סוג דוח</p>
            <div className="grid grid-cols-2 gap-2">
              {REPORT_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setForm((f) => ({ ...f, type: rt.value }))}
                  className={`flex items-start gap-2 p-3 rounded-xl border-2 text-right transition-colors ${
                    form.type === rt.value
                      ? 'border-primary bg-primary-50'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-xl shrink-0 mt-0.5">{rt.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${form.type === rt.value ? 'text-primary' : 'text-neutral-dark'}`}>
                      {rt.label}
                    </p>
                    {form.type === rt.value && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{rt.desc}</p>
                    )}
                  </div>
                  {form.type === rt.value && (
                    <CheckCircle2 size={14} className="text-primary shrink-0 mt-0.5 mr-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="כותרת מותאמת אישית (אופציונלי)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder={`דוח ${selectedType?.label} — שם הפרויקט`}
          />

          {(form.type === 'DAILY' || form.type === 'DEFECTS' || form.type === 'TASKS') && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="מתאריך"
                type="date"
                value={form.dateFrom}
                onChange={(e) => setForm((f) => ({ ...f, dateFrom: e.target.value }))}
              />
              <Input
                label="עד תאריך"
                type="date"
                value={form.dateTo}
                onChange={(e) => setForm((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
          )}

          {isFieldReportType && (
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
              {selectedType?.label} נבנה מתמונות וממצאים מהשטח. לחיצה על "המשך לדוח שטח" תעביר אותך למסך
              שבו מצלמים, מוסיפים הערות ומפיקים את הדוח.
            </div>
          )}

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <strong>טיפ:</strong> הדוח יכלול את לוגו החברה, הצבע המותגי ופרטי הקשר שלך.
            ניתן לערוך אותם ב<a href="/settings/organization" className="underline font-medium">הגדרות ארגון</a>.
          </div>

          {generateMutation.isError && (
            <p className="text-sm text-danger">
              הפקת הדוח נכשלה: {(generateMutation.error as Error)?.message || 'שגיאה לא ידועה'}
            </p>
          )}
          {!form.projectId && (
            <p className="text-xs text-gray-500">יש לבחור פרויקט כדי להפיק דוח</p>
          )}

          <div className="flex gap-2">
            {isFieldReportType ? (
              <Button
                onClick={() => router.push(`/projects/${form.projectId}/field-report`)}
                disabled={!form.projectId}
              >
                המשך לדוח שטח
              </Button>
            ) : (
              <Button
                onClick={() => generateMutation.mutate(form)}
                loading={generateMutation.isPending}
                disabled={!form.projectId}
              >
                הפק דוח PDF
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!moveTarget}
        onClose={() => { if (!moveMutation.isPending) setMoveTarget(null) }}
        title="העברת דוח לפרויקט אחר"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            להעביר את הדוח <strong>{moveTarget?.title}</strong> לפרויקט:
          </p>
          <Select
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value)}
            options={[{ value: '', label: 'בחר פרויקט...' }, ...projectOptions.filter((p) => p.value !== selectedProject)]}
            placeholder=""
          />
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p>הדוח והתמונות שלו יעברו לפרויקט שתבחר, וקובץ ה-PDF יופק מחדש עם שם הפרויקט החדש והכתובת שלו.</p>
            <p>ההעברה יכולה לקחת עד דקה — נא להישאר במסך.</p>
          </div>
          {moveMutation.isError && (
            <p className="text-sm text-danger">
              ההעברה נכשלה: {(moveMutation.error as Error)?.message || 'שגיאה לא ידועה'}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={() => moveMutation.mutate()} loading={moveMutation.isPending} disabled={!moveTo}>
              <FolderInput size={14} />
              העבר דוח
            </Button>
            <Button variant="outline" onClick={() => setMoveTarget(null)} disabled={moveMutation.isPending}>ביטול</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="מחיקת דוח" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            למחוק את הדוח <strong>{deleteTarget?.title}</strong>? לא ניתן לשחזר פעולה זו.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              loading={deleteMutation.isPending}
            >
              מחק דוח
            </Button>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>ביטול</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  )
}
