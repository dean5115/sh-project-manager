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
import { FileText, Download, Plus, CheckCircle2, Trash2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
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

export default function ReportsPage() {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ projectId: '', type: 'DAILY', title: '', dateFrom: '', dateTo: '' })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

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

  const projectOptions = (projects?.data ?? []).map((p: any) => ({ value: p.id, label: p.name }))
  const selectedType = REPORT_TYPES.find((t) => t.value === form.type)

  return (
    <AppLayout title="דוחות">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <Select
            options={[{ value: '', label: 'בחר פרויקט לצפייה בדוחות...' }, ...projectOptions]}
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            placeholder=""
          />
          <Button size="sm" onClick={() => { setForm((f) => ({ ...f, projectId: selectedProject })); setOpen(true) }}>
            <Plus size={14} />
            הפק דוח חדש
          </Button>
        </div>

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
                const rt = REPORT_TYPES.find((t) => t.value === report.type)
                return (
                  <div key={report.id} className="card flex items-center gap-3">
                    <span className="text-2xl shrink-0">{rt?.icon || '📄'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-neutral-dark truncate">{report.title}</p>
                      <p className="text-xs text-gray-400">{formatDate(report.createdAt)}</p>
                    </div>
                    <Badge className="bg-primary-50 text-primary shrink-0 hidden sm:inline-flex">
                      {rt?.label}
                    </Badge>
                    {report.pdfUrl && (
                      <a href={report.pdfUrl} download target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm">
                          <Download size={14} />
                          הורד
                        </Button>
                      </a>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(report)}>
                      <Trash2 size={14} className="text-danger" />
                    </Button>
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

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <strong>טיפ:</strong> הדוח יכלול את לוגו החברה, הצבע המותגי ופרטי הקשר שלך.
            ניתן לערוך אותם ב<a href="/settings/organization" className="underline font-medium">הגדרות ארגון</a>.
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => generateMutation.mutate(form)}
              loading={generateMutation.isPending}
              disabled={!form.projectId}
            >
              הפק דוח PDF
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
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
