'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { PdfViewer } from '@/components/pdf/pdf-viewer'
import { ArrowRight, Upload, FileText, Eye, Download, Trash2, Search } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { useRef, useState } from 'react'

const PLAN_SUBTYPES = [
  { value: 'ARCHITECTURE', label: 'אדריכלות', color: 'bg-blue-100 text-blue-700' },
  { value: 'STRUCTURE', label: 'קונסטרוקציה', color: 'bg-orange-100 text-orange-700' },
  { value: 'PLUMBING', label: 'אינסטלציה', color: 'bg-teal-100 text-teal-700' },
  { value: 'ELECTRICAL', label: 'חשמל', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'HVAC', label: 'מיזוג', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'FIRE', label: 'כיבוי אש', color: 'bg-red-100 text-red-700' },
  { value: 'OTHER', label: 'אחר', color: 'bg-gray-100 text-gray-600' },
]

interface Plan {
  id: string
  name: string
  url: string
  type: string
  version: number
  createdAt: string
  uploadedBy?: { name: string }
}

export default function PlansPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [uploadOpen, setUploadOpen] = useState(false)
  const [viewPlan, setViewPlan] = useState<Plan | null>(null)
  const [docName, setDocName] = useState('')
  const [docSubtype, setDocSubtype] = useState('ARCHITECTURE')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const { data } = useQuery({
    queryKey: ['plans', projectId],
    queryFn: () => api.get<{ data: Plan[] }>(`/projects/${projectId}/documents`),
    enabled: !!projectId,
  })

  // מסנן רק קבצי PDF מסוג PLAN + SPEC
  const allPlans = (data?.data ?? []).filter((d) =>
    d.url.toLowerCase().endsWith('.pdf') || d.type === 'PLAN' || d.type === 'SPEC'
  )

  const filtered = allPlans.filter((p) => {
    const matchSearch = !search || p.name.includes(search)
    const matchType = !filterType || p.type === filterType
    return matchSearch && matchType
  })

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('name', docName || selectedFile.name.replace('.pdf', ''))
      fd.append('type', 'PLAN')
      return api.upload(`/projects/${projectId}/documents`, fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans', projectId] })
      qc.invalidateQueries({ queryKey: ['documents', projectId] })
      setUploadOpen(false)
      setSelectedFile(null)
      setDocName('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${projectId}/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['plans', projectId] }),
  })

  return (
    <AppLayout title="תוכניות">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href={`/projects/${projectId}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
              <ArrowRight size={13} />
              חזרה לפרויקט
            </Link>
            <div className="relative">
              <Search size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש תוכנית..."
                className="border border-gray-200 rounded-lg pr-8 pl-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-48"
              />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="">כל הסוגים</option>
              {PLAN_SUBTYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Upload size={14} />
            העלאת תוכנית PDF
          </Button>
        </div>

        {/* Plans grid */}
        {filtered.length === 0 ? (
          <div className="card text-center py-16">
            <FileText size={44} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">אין תוכניות עדיין</p>
            <p className="text-gray-400 text-sm mt-1">העלה קבצי PDF של תוכניות הפרויקט</p>
            <Button size="sm" className="mt-4" onClick={() => setUploadOpen(true)}>
              <Upload size={14} />
              העלה תוכנית ראשונה
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onView={() => setViewPlan(plan)}
                onDelete={() => deleteMutation.mutate(plan.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="העלאת תוכנית PDF" size="sm">
        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
          />
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary-50/30 transition-colors"
          >
            {selectedFile ? (
              <div>
                <FileText size={28} className="text-primary mx-auto mb-2" />
                <p className="text-sm text-primary font-medium">{selectedFile.name}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <>
                <Upload size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">לחץ לבחירת קובץ PDF</p>
                <p className="text-xs text-gray-400 mt-1">תוכניות אדריכלות, קונסטרוקציה, חשמל ועוד</p>
              </>
            )}
          </div>

          <Input
            label="שם התוכנית"
            value={docName}
            onChange={(e) => setDocName(e.target.value)}
            placeholder="לדוגמה: קומה 1 — אדריכלות גרסה 3"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-dark">סוג תוכנית</label>
            <div className="flex flex-wrap gap-2">
              {PLAN_SUBTYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setDocSubtype(t.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    docSubtype === t.value
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-200 text-gray-600 hover:border-primary/40'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              onClick={() => uploadMutation.mutate()}
              loading={uploadMutation.isPending}
              disabled={!selectedFile}
            >
              העלה תוכנית
            </Button>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      {/* PDF Viewer Modal */}
      <Modal
        open={!!viewPlan}
        onClose={() => setViewPlan(null)}
        title={viewPlan?.name || 'תוכנית'}
        size="xl"
      >
        {viewPlan && (
          <PdfViewer
            url={viewPlan.url}
            filename={viewPlan.name}
            className="h-[70vh]"
          />
        )}
      </Modal>
    </AppLayout>
  )
}

function PlanCard({
  plan,
  onView,
  onDelete,
}: {
  plan: Plan
  onView: () => void
  onDelete: () => void
}) {
  const typeInfo = PLAN_SUBTYPES.find((t) => t.value === plan.type) || PLAN_SUBTYPES[6]

  return (
    <div className="card group flex flex-col gap-3">
      {/* Preview area */}
      <div
        onClick={onView}
        className="bg-gray-100 rounded-lg h-36 flex flex-col items-center justify-center cursor-pointer hover:bg-primary-50 transition-colors border border-gray-200 hover:border-primary/30"
      >
        <FileText size={36} className="text-primary mb-2" />
        <p className="text-xs text-gray-500">לחץ לצפייה</p>
      </div>

      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-neutral-dark text-sm leading-tight">{plan.name}</p>
          <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          <span>{formatDate(plan.createdAt)}</span>
          {plan.version > 1 && <span className="text-primary">גרסה {plan.version}</span>}
          {plan.uploadedBy && <span>· {plan.uploadedBy.name}</span>}
        </div>
      </div>

      <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
        <Button size="sm" className="flex-1" onClick={onView}>
          <Eye size={13} />
          צפה
        </Button>
        <a href={plan.url} download={plan.name} target="_blank" rel="noreferrer">
          <Button size="sm" variant="outline">
            <Download size={13} />
          </Button>
        </a>
        <Button
          size="sm"
          variant="danger"
          onClick={() => confirm('למחוק תוכנית זו?') && onDelete()}
        >
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  )
}
