'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ArrowRight, FileText, Upload, Download } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { useRef, useState } from 'react'

const DOC_TYPES = [
  { value: 'PLAN', label: 'תוכנית' }, { value: 'SPEC', label: 'מפרט' },
  { value: 'APPROVAL', label: 'אישור' }, { value: 'INVOICE', label: 'חשבון' },
  { value: 'PROTOCOL', label: 'פרוטוקול' }, { value: 'REPORT', label: 'דוח' },
  { value: 'OTHER', label: 'אחר' },
]

const DISCIPLINES = [
  { value: 'ARCHITECTURE', label: 'אדריכלות' }, { value: 'STRUCTURE', label: 'קונסטרוקציה' },
  { value: 'ELECTRICAL', label: 'חשמל' }, { value: 'PLUMBING', label: 'אינסטלציה' },
  { value: 'HVAC', label: 'מיזוג אוויר' }, { value: 'FIRE_PROTECTION', label: 'כיבוי אש' },
  { value: 'MECHANICAL', label: 'מכניקה' }, { value: 'INTERIOR', label: 'עיצוב פנים' },
  { value: 'INFRASTRUCTURE', label: 'תשתיות' }, { value: 'LANDSCAPING', label: 'פיתוח' },
  { value: 'OTHER', label: 'אחר' },
]

const TYPE_COLORS: Record<string, string> = {
  PLAN: 'bg-blue-100 text-blue-700', SPEC: 'bg-purple-100 text-purple-700',
  APPROVAL: 'bg-green-100 text-green-700', INVOICE: 'bg-yellow-100 text-yellow-700',
  PROTOCOL: 'bg-orange-100 text-orange-700', REPORT: 'bg-teal-100 text-teal-700',
  OTHER: 'bg-gray-100 text-gray-600',
}

export default function DocumentsPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [docName, setDocName] = useState('')
  const [docType, setDocType] = useState('OTHER')
  const [discipline, setDiscipline] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const { data } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => api.get<{ data: any[] }>(`/projects/${projectId}/documents`),
    enabled: !!projectId,
  })
  const docs = data?.data ?? []

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('name', docName || selectedFile.name)
      fd.append('type', docType)
      if (docType === 'PLAN' && discipline) fd.append('discipline', discipline)
      return api.upload(`/projects/${projectId}/documents`, fd)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', projectId] })
      setOpen(false)
      setSelectedFile(null)
      setDocName('')
      setDiscipline('')
      setDocType('OTHER')
    },
  })

  // מסמכים בלבד — ללא תוכניות
  const otherDocs = docs.filter((d) => d.type !== 'PLAN')

  return (
    <AppLayout title="מסמכים">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link href={`/projects/${projectId}`} className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
            <ArrowRight size={13} />חזרה
          </Link>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Upload size={14} />העלאת מסמך
          </Button>
        </div>

        {/* ─── מסמכים ─── */}
        {otherDocs.length > 0 && (
          <div>
            <div className="space-y-2">
              {otherDocs.map((doc) => (
                <div key={doc.id} className="card flex items-center gap-3">
                  <FileText size={20} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-neutral-dark text-sm">{doc.name}</p>
                    <p className="text-xs text-gray-400">{formatDate(doc.createdAt)}</p>
                  </div>
                  <Badge className={TYPE_COLORS[doc.type]}>
                    {DOC_TYPES.find((t) => t.value === doc.type)?.label}
                  </Badge>
                  <a href={doc.url} download target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm"><Download size={14} /></Button>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {otherDocs.length === 0 && (
          <div className="card text-center py-14">
            <FileText size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">אין מסמכים עדיין</p>
          </div>
        )}
      </div>

      {/* Modal — העלאה */}
      <Modal open={open} onClose={() => setOpen(false)} title="העלאת מסמך" size="sm">
        <div className="space-y-4">
          <input ref={fileRef} type="file" className="hidden"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
          <div onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
            {selectedFile
              ? <p className="text-sm text-primary font-medium">{selectedFile.name}</p>
              : <><Upload size={24} className="text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-500">לחץ לבחירת קובץ</p></>
            }
          </div>
          <Input label="שם המסמך" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="שם תיאורי" />
          <Select label="סוג מסמך" value={docType} onChange={(e) => { setDocType(e.target.value); if (e.target.value !== 'PLAN') setDiscipline('') }} options={DOC_TYPES} />
          {docType === 'PLAN' && (
            <Select
              label="מקצוע / תחום"
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              options={DISCIPLINES}
              placeholder="בחר מקצוע..."
            />
          )}
          <div className="flex gap-2">
            <Button onClick={() => uploadMutation.mutate()} loading={uploadMutation.isPending} disabled={!selectedFile}>
              העלה
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

    </AppLayout>
  )
}
