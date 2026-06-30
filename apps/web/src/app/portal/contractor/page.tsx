'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { PdfViewer } from '@/components/pdf/pdf-viewer'
import Link from 'next/link'
import {
  HardHat, LogOut, AlertTriangle, FileText, Layers,
  Plus, ChevronLeft, Calendar, CheckCircle2, Clock,
  BookOpen, Send, MessageCircle, Camera, Wrench, PenLine,
  Users, Cloud,
} from 'lucide-react'
import { formatDate, SEVERITY_COLORS, STATUS_COLORS, STATUS_LABELS, CATEGORY_LABELS } from '@/lib/utils'
import type { Defect, Project, Document, DailyJournal } from '@sitepilot/types'

const DISCIPLINES: { value: string; label: string; color: string }[] = [
  { value: 'ARCHITECTURE',    label: 'אדריכלות',    color: 'bg-violet-100 text-violet-700' },
  { value: 'STRUCTURE',       label: 'קונסטרוקציה', color: 'bg-blue-100 text-blue-700' },
  { value: 'ELECTRICAL',      label: 'חשמל',        color: 'bg-yellow-100 text-yellow-700' },
  { value: 'PLUMBING',        label: 'אינסטלציה',   color: 'bg-cyan-100 text-cyan-700' },
  { value: 'HVAC',            label: 'מיזוג אוויר', color: 'bg-sky-100 text-sky-700' },
  { value: 'FIRE_PROTECTION', label: 'כיבוי אש',    color: 'bg-red-100 text-red-700' },
  { value: 'MECHANICAL',      label: 'מכניקה',      color: 'bg-orange-100 text-orange-700' },
  { value: 'INTERIOR',        label: 'עיצוב פנים',  color: 'bg-pink-100 text-pink-700' },
  { value: 'INFRASTRUCTURE',  label: 'תשתיות',      color: 'bg-stone-100 text-stone-700' },
  { value: 'LANDSCAPING',     label: 'פיתוח',       color: 'bg-green-100 text-green-700' },
  { value: 'OTHER',           label: 'אחר',         color: 'bg-gray-100 text-gray-600' },
]

const SEVERITY_LABELS: Record<string, string> = { LOW: 'נמוכה', MEDIUM: 'בינונית', HIGH: 'גבוהה', CRITICAL: 'קריטי' }
const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
const SEVERITIES = Object.entries(SEVERITY_LABELS).map(([value, label]) => ({ value, label }))

type Tab = 'defects' | 'new' | 'plans' | 'journal'

export default function ContractorPortalPage() {
  return (
    <Suspense fallback={null}>
      <ContractorPortalContent />
    </Suspense>
  )
}

function ContractorPortalContent() {
  const { user, organization, logout, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('defects')
  const [selectedPlanProject, setSelectedPlanProject] = useState('')
  const [openPlan, setOpenPlan] = useState<Document | null>(null)
  const [viewJournal, setViewJournal] = useState<DailyJournal | null>(null)
  const [openDefect, setOpenDefect] = useState<any>(null)
  const [comment, setComment] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadedMedia, setUploadedMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([])

  const deepLinkDefectId = searchParams.get('defect')

  useEffect(() => {
    if (!isAuthenticated()) {
      const dest = deepLinkDefectId ? `/contractor-login?defect=${deepLinkDefectId}` : '/contractor-login'
      router.replace(dest)
    }
  }, [isAuthenticated, router, deepLinkDefectId])

  const { data: myDefectsData, isLoading: loadingDefects } = useQuery({
    queryKey: ['defects-mine'],
    queryFn: () => api.get<{ data: (Defect & { project: { id: string; name: string }; assignedTo?: any; comments?: any[] })[] }>('/defects/mine'),
  })

  // קישור ישיר מתוך התראת מייל — פותח אוטומטית את הליקוי הספציפי
  useEffect(() => {
    if (!deepLinkDefectId || !myDefectsData?.data) return
    const target = myDefectsData.data.find((d) => d.id === deepLinkDefectId)
    if (target) {
      setTab('defects')
      setOpenDefect(target)
    }
  }, [deepLinkDefectId, myDefectsData])

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<{ data: Project[] }>('/projects'),
  })
  const projects = projectsData?.data ?? []
  const singleProject = projects.length === 1 ? projects[0] : null

  // כשיש פרויקט יחיד — בחר אותו אוטומטית
  useEffect(() => {
    if (!singleProject) return
    setSelectedPlanProject(singleProject.id)
    setJournalProjectId(singleProject.id)
    setNewDefectProjectId(singleProject.id)
  }, [singleProject?.id])

  const { data: plansData } = useQuery({
    queryKey: ['documents', selectedPlanProject],
    queryFn: () => api.get<{ data: Document[] }>(`/projects/${selectedPlanProject}/documents`),
    enabled: !!selectedPlanProject,
  })
  const plans = (plansData?.data ?? []).filter((d) => d.type === 'PLAN')

  // ─── New defect ───
  const [newDefectProjectId, setNewDefectProjectId] = useState('')
  const [defectForm, setDefectForm] = useState({
    title: '', location: '', category: 'OTHER', description: '', severity: 'MEDIUM', dueDate: '',
  })
  const setDF = (k: string) => (e: any) => setDefectForm((f) => ({ ...f, [k]: e.target.value }))

  const createDefect = useMutation({
    mutationFn: () => api.post(`/projects/${newDefectProjectId}/defects`, { ...defectForm, status: 'OPEN' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['defects-mine'] })
      setDefectForm({ title: '', location: '', category: 'OTHER', description: '', severity: 'MEDIUM', dueDate: '' })
      setNewDefectProjectId('')
      setTab('defects')
    },
  })

  // ─── Comment on defect ───
  const addComment = useMutation({
    mutationFn: () => api.post(`/projects/${openDefect?.projectId}/defects/${openDefect?.id}/comments`, { content: comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['defects-mine'] })
      setComment('')
      // refresh the open defect's comments
      setOpenDefect((d: any) => d ? { ...d, comments: [...(d.comments ?? []), { content: comment, author: { name: user?.name }, createdAt: new Date().toISOString() }] } : d)
    },
  })

  // ─── Upload media to defect ───
  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !openDefect) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('defectAfterId', openDefect.id)
      fd.append('projectId', openDefect.projectId)
      const res = await api.upload<{ data: { url: string } }>('/photos/upload', fd)
      const isVideo = file.type.startsWith('video/')
      setUploadedMedia((prev) => [...prev, { url: res.data.url, type: isVideo ? 'video' : 'image' }])
    } catch {}
    setUploading(false)
    e.target.value = ''
  }

  // ─── Update defect status ───
  const updateStatus = useMutation({
    mutationFn: (status: string) => api.put(`/projects/${openDefect?.projectId}/defects/${openDefect?.id}`, { status }),
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['defects-mine'] })
      setOpenDefect((d: any) => d ? { ...d, status } : d)
    },
  })

  // ─── Journal ───
  const [journalProjectId, setJournalProjectId] = useState('')
  const [journalForm, setJournalForm] = useState({
    date: new Date().toISOString().split('T')[0],
    workDone: '', equipment: '', issues: '', workforce: '',
  })
  const setJF = (k: string) => (e: any) => setJournalForm((f) => ({ ...f, [k]: e.target.value }))

  const { data: journalsData } = useQuery({
    queryKey: ['journals', journalProjectId],
    queryFn: () => api.get<{ data: DailyJournal[] }>(`/projects/${journalProjectId}/journals`),
    enabled: !!journalProjectId,
  })
  const journals = (journalsData?.data ?? []).filter((j) => j.createdById === user?.id)

  const createJournal = useMutation({
    mutationFn: () => api.post(`/projects/${journalProjectId}/journals`, {
      ...journalForm,
      workforce: journalForm.workforce ? parseInt(journalForm.workforce) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['journals', journalProjectId] })
      setJournalForm({ date: new Date().toISOString().split('T')[0], workDone: '', equipment: '', issues: '', workforce: '' })
    },
  })

  const myDefects = myDefectsData?.data ?? []

  const statusIcon = (status: string) => {
    if (status === 'OPEN') return <AlertTriangle size={14} className="text-danger" />
    if (status === 'IN_PROGRESS') return <Clock size={14} className="text-warning" />
    return <CheckCircle2 size={14} className="text-success" />
  }

  return (
    <div className="min-h-screen bg-gray-50 rtl flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <header className="bg-primary text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
            <HardHat size={16} />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">SH - Project Manager</p>
            <p className="text-primary-200 text-xs">{organization?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left">
            <p className="text-white text-xs font-medium">{user?.name}</p>
            <p className="text-primary-200 text-xs">קבלן</p>
          </div>
          <button onClick={() => { logout(); router.replace('/login') }} className="p-1.5 rounded-lg hover:bg-white/10 text-primary-200">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <div className="flex items-center justify-center gap-3 text-[11px] text-gray-400 bg-white border-b border-gray-100 py-1 shrink-0">
        <Link href="/terms" className="hover:text-primary hover:underline">תנאי שימוש</Link>
        <span>·</span>
        <Link href="/accessibility" className="hover:text-primary hover:underline">הצהרת נגישות</Link>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">

        {/* ─── TAB: הליקויים שלי ─── */}
        {tab === 'defects' && (
          <div className="p-4 space-y-3">
            <h2 className="text-base font-bold text-neutral-dark">הליקויים שלי</h2>
            {loadingDefects ? (
              <div className="text-center py-12 text-gray-400 text-sm">טוען...</div>
            ) : myDefects.length === 0 ? (
              <div className="card text-center py-12">
                <CheckCircle2 size={36} className="text-gray-200 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">אין ליקויים עדיין</p>
              </div>
            ) : (
              myDefects.map((defect) => (
                <button
                  key={defect.id}
                  onClick={() => setOpenDefect(defect)}
                  className="w-full card text-right"
                >
                  <div className="flex items-start gap-2 mb-2">
                    {statusIcon(defect.status)}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-dark text-sm leading-tight">{defect.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{(defect as any).project?.name}</p>
                    </div>
                    <Badge className={`${SEVERITY_COLORS[defect.severity]} text-[10px]`}>
                      {SEVERITY_LABELS[defect.severity]}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2 text-right">{defect.description}</p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge className={STATUS_COLORS[defect.status as keyof typeof STATUS_COLORS]}>
                      {STATUS_LABELS[defect.status]}
                    </Badge>
                    <span className="text-xs text-gray-400">{CATEGORY_LABELS[defect.category]}</span>
                    {defect.dueDate && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar size={10} />{formatDate(defect.dueDate)}
                      </span>
                    )}
                    {(defect as any).comments?.length > 0 && (
                      <span className="text-xs text-gray-400 flex items-center gap-1 mr-auto">
                        <MessageCircle size={10} />{(defect as any).comments.length}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* ─── TAB: פתח ליקוי חדש ─── */}
        {tab === 'new' && (
          <div className="p-4 space-y-4">
            <h2 className="text-base font-bold text-neutral-dark">פתח ליקוי חדש</h2>
            {singleProject
              ? <p className="text-sm text-gray-500">פרויקט: <span className="font-medium text-neutral-dark">{singleProject.name}</span></p>
              : <Select label="פרויקט *" value={newDefectProjectId} onChange={(e) => setNewDefectProjectId(e.target.value)}
                  options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="בחר פרויקט" />
            }
            {newDefectProjectId && (<>
              <Input label="כותרת *" value={defectForm.title} onChange={setDF('title')} placeholder="תיאור הבעיה" />
              <Input label="מיקום" value={defectForm.location} onChange={setDF('location')} placeholder="קומה / דירה" />
              <Textarea label="פירוט *" value={defectForm.description} onChange={setDF('description') as any} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="קטגוריה" value={defectForm.category} onChange={setDF('category')} options={CATEGORIES} />
                <Select label="חומרה" value={defectForm.severity} onChange={setDF('severity')} options={SEVERITIES} />
              </div>
              <Input label="תאריך יעד" type="date" value={defectForm.dueDate} onChange={setDF('dueDate')} />
              <Button className="w-full" size="lg" onClick={() => createDefect.mutate()}
                loading={createDefect.isPending} disabled={!defectForm.title || !defectForm.description}>
                <Plus size={16} />שלח ליקוי
              </Button>
              {createDefect.isError && <p className="text-danger text-sm text-center">שגיאה — נסה שוב</p>}
            </>)}
          </div>
        )}

        {/* ─── TAB: תוכניות ─── */}
        {tab === 'plans' && (
          <div className="p-4 space-y-4">
            <h2 className="text-base font-bold text-neutral-dark">תוכניות</h2>
            {!openPlan && !singleProject && (
              <Select label="בחר פרויקט" value={selectedPlanProject}
                onChange={(e) => { setSelectedPlanProject(e.target.value); setOpenPlan(null) }}
                options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="בחר פרויקט..." />
            )}
            {selectedPlanProject && plans.length === 0 && !openPlan && (
              <div className="card text-center py-10">
                <Layers size={32} className="text-gray-200 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">אין תוכניות לפרויקט זה</p>
              </div>
            )}
            {plans.length > 0 && !openPlan && (() => {
              const groups = DISCIPLINES
                .map((disc) => ({
                  ...disc,
                  items: plans.filter((p: any) => p.discipline === disc.value || (!p.discipline && disc.value === 'OTHER')),
                }))
                .filter((g) => g.items.length > 0)
              return (
                <div className="space-y-4">
                  {groups.map((group) => (
                    <div key={group.value}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${group.color}`}>{group.label}</span>
                        <span className="text-xs text-gray-400">{group.items.length} קבצים</span>
                      </div>
                      <div className="space-y-1.5">
                        {group.items.map((doc: any) => (
                          <button key={doc.id} onClick={() => setOpenPlan(doc)}
                            className="w-full card flex items-center gap-3 text-right hover:border-primary/30 transition-colors py-2.5">
                            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                              <FileText size={16} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-neutral-dark text-sm truncate">{doc.name}</p>
                              <p className="text-xs text-gray-400">גרסה {doc.version}</p>
                            </div>
                            <ChevronLeft size={14} className="text-gray-300" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
            {openPlan && (
              <div className="space-y-2">
                <button onClick={() => setOpenPlan(null)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
                  <ChevronLeft size={14} className="rotate-180" />חזרה לרשימה
                </button>
                <PdfViewer url={openPlan.url.startsWith('/') ? openPlan.url : `/${openPlan.url}`}
                  filename={openPlan.name} className="h-[calc(100vh-280px)] min-h-[400px]" />
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: יומן עבודה ─── */}
        {tab === 'journal' && (
          <div className="p-4 space-y-4">
            <h2 className="text-base font-bold text-neutral-dark">יומן עבודה</h2>
            {singleProject
              ? <p className="text-sm text-gray-500">פרויקט: <span className="font-medium text-neutral-dark">{singleProject.name}</span></p>
              : <Select label="פרויקט" value={journalProjectId}
                  onChange={(e) => setJournalProjectId(e.target.value)}
                  options={projects.map((p) => ({ value: p.id, label: p.name }))} placeholder="בחר פרויקט..." />
            }

            {journalProjectId && (<>
              <div className="card space-y-3">
                <p className="font-semibold text-sm text-neutral-dark">יומן חדש</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="תאריך" type="date" value={journalForm.date} onChange={setJF('date')} />
                  <Input label="כוח אדם" type="number" value={journalForm.workforce} onChange={setJF('workforce')} placeholder="מספר עובדים" />
                </div>
                <Textarea label="עבודות שבוצעו *" value={journalForm.workDone} onChange={setJF('workDone') as any} placeholder="מה בוצע היום..." />
                <Textarea label="ציוד באתר" value={journalForm.equipment} onChange={setJF('equipment') as any} placeholder="ציוד שהובא / שבו..." />
                <Textarea label="בעיות / עיכובים" value={journalForm.issues} onChange={setJF('issues') as any} placeholder="האם היו בעיות?" />
                <Button className="w-full" onClick={() => createJournal.mutate()}
                  loading={createJournal.isPending} disabled={!journalForm.workDone}>
                  שמור יומן
                </Button>
                {createJournal.isSuccess && <p className="text-success text-sm text-center">היומן נשמר!</p>}
              </div>

              {journals.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-500">היומנים שלי בפרויקט זה</p>
                  {journals.map((j) => (
                    <button key={j.id} onClick={() => setViewJournal(j)} className="w-full card text-right hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="bg-primary-50 rounded-lg p-2 text-center min-w-[48px]">
                          <p className="text-primary font-bold text-sm">{new Date(j.date).getDate()}</p>
                          <p className="text-primary-400 text-xs">{new Date(j.date).toLocaleDateString('he-IL', { month: 'short' })}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-dark line-clamp-1">{j.workDone}</p>
                          {j.workforce && <p className="text-xs text-gray-400">{j.workforce} עובדים</p>}
                        </div>
                        <ChevronLeft size={14} className="text-gray-300 shrink-0" />
                      </div>
                      {j.issues && <p className="text-xs text-danger">⚠️ {j.issues}</p>}
                    </button>
                  ))}
                </div>
              )}
            </>)}
          </div>
        )}
      </div>

      {/* ─── Bottom Tab Bar ─── */}
      <nav className="fixed bottom-0 inset-x-0 max-w-lg mx-auto bg-white border-t border-gray-100 flex shadow-lg z-20">
        {([
          { key: 'defects', label: 'ליקויים', icon: AlertTriangle },
          { key: 'new', label: 'ליקוי חדש', icon: Plus },
          { key: 'plans', label: 'תוכניות', icon: Layers },
          { key: 'journal', label: 'יומן', icon: BookOpen },
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              tab === key ? 'text-primary border-t-2 border-primary -mt-px' : 'text-gray-400'
            }`}>
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      {/* ─── Journal View Modal ─── */}
      <Modal open={!!viewJournal} onClose={() => setViewJournal(null)} title="יומן עבודה" size="lg">
        {viewJournal && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              <div className="bg-primary-50 rounded-xl p-3 text-center min-w-[56px]">
                <p className="text-primary font-bold text-lg leading-tight">{new Date(viewJournal.date).getDate()}</p>
                <p className="text-primary-400 text-xs">{new Date(viewJournal.date).toLocaleDateString('he-IL', { month: 'short', year: 'numeric' })}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                {viewJournal.weather && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600"><Cloud size={14} className="text-sky-400" />{viewJournal.weather}</div>
                )}
                {viewJournal.workforce && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-600"><Users size={14} className="text-primary" />{viewJournal.workforce} עובדים</div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1"><PenLine size={12} />עבודות שבוצעו</p>
              <p className="text-sm text-neutral-dark whitespace-pre-wrap">{viewJournal.workDone}</p>
            </div>

            {viewJournal.equipment && (
              <div>
                <p className="text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1"><Wrench size={12} />ציוד באתר</p>
                <p className="text-sm text-neutral-dark whitespace-pre-wrap">{viewJournal.equipment}</p>
              </div>
            )}

            {viewJournal.issues && (
              <div className="bg-danger/5 border border-danger/20 rounded-xl p-3">
                <p className="text-xs font-semibold text-danger mb-1 flex items-center gap-1"><AlertTriangle size={12} />בעיות ועיכובים</p>
                <p className="text-sm text-danger/80 whitespace-pre-wrap">{viewJournal.issues}</p>
              </div>
            )}

            {viewJournal.signedBy && (
              <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
                <PenLine size={13} className="text-gray-400" />
                <p className="text-sm text-gray-500">חתם: <span className="font-medium text-neutral-dark">{viewJournal.signedBy}</span></p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ─── Defect Detail Modal ─── */}
      <Modal open={!!openDefect} onClose={() => setOpenDefect(null)} title={openDefect?.title || ''} size="lg">
        {openDefect && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className={STATUS_COLORS[openDefect.status as keyof typeof STATUS_COLORS]}>
                {STATUS_LABELS[openDefect.status]}
              </Badge>
              <Badge className={SEVERITY_COLORS[openDefect.severity]}>
                {SEVERITY_LABELS[openDefect.severity]}
              </Badge>
              <span className="text-xs text-gray-400 self-center">{CATEGORY_LABELS[openDefect.category]}</span>
            </div>

            <p className="text-sm text-gray-600">{openDefect.description}</p>
            {openDefect.location && <p className="text-xs text-gray-400">📍 {openDefect.location}</p>}

            {/* עדכון סטטוס */}
            <div className="flex gap-2 flex-wrap">
              {openDefect.status === 'OPEN' && (
                <Button size="sm" variant="outline" onClick={() => updateStatus.mutate('IN_PROGRESS')} loading={updateStatus.isPending}>
                  התחל טיפול
                </Button>
              )}
              {openDefect.status === 'IN_PROGRESS' && (
                <Button size="sm" onClick={() => updateStatus.mutate('FIXED')} loading={updateStatus.isPending}>
                  <CheckCircle2 size={14} />
                  סיימתי לתקן
                </Button>
              )}
            </div>

            {/* מדיה שהועלתה */}
            {uploadedMedia.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {uploadedMedia.map((m, i) => (
                  m.type === 'image'
                    ? <img key={i} src={m.url} className="w-full h-24 object-cover rounded-lg" />
                    : <video key={i} src={m.url} className="w-full h-24 object-cover rounded-lg" controls />
                ))}
              </div>
            )}

            {/* העלאת תמונה/סרטון */}
            <div className="border-t border-gray-100 pt-3">
              <label className={`flex items-center gap-2 text-sm text-primary cursor-pointer hover:underline w-fit ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <Camera size={15} />
                {uploading ? 'מעלה...' : 'הוסף תמונה / סרטון (עד 20 שניות)'}
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaUpload} capture="environment" />
              </label>
            </div>

            {/* תגובות */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-sm font-semibold text-neutral-dark mb-2">הערות</p>
              <div className="space-y-2 max-h-40 overflow-y-auto mb-3">
                {(openDefect.comments ?? []).length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">אין הערות עדיין</p>
                ) : (
                  (openDefect.comments ?? []).map((c: any, i: number) => (
                    <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-gray-500 mb-0.5">{c.author?.name} · {formatDate(c.createdAt)}</p>
                      <p className="text-sm text-neutral-dark">{c.content}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="כתוב הערה..."
                  onKeyDown={(e) => e.key === 'Enter' && comment && addComment.mutate()}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <Button size="sm" onClick={() => addComment.mutate()} disabled={!comment} loading={addComment.isPending}>
                  <Send size={14} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
