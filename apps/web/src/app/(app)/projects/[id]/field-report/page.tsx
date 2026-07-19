'use client'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { absoluteUrl } from '@/lib/utils'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import {
  Camera, Trash2, ArrowRight, AlertTriangle, Search, ClipboardCheck,
  Check, X, Download, MessageCircle, Mail, FileText, MapPin, Map, Save, Pencil, PenLine,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PlanPinPicker } from '@/components/pdf/plan-pin-picker'
import { PhotoAnnotator } from '@/components/photo/photo-annotator'
import { generateAnnotatedPlanImage } from '@/lib/plan-annotation'
import { saveDraft, loadDraft, deleteDraft, type FieldReportDraft } from '@/lib/field-report-draft'

type ReportType = 'DEFECTS' | 'INSPECTION' | 'HANDOVER'

const TYPES: { value: ReportType; label: string; desc: string; icon: typeof AlertTriangle }[] = [
  { value: 'DEFECTS', label: 'דוח ליקויים', desc: 'כל תמונה תהפוך לליקוי מתועד ומשויך', icon: AlertTriangle },
  { value: 'INSPECTION', label: 'דוח פיקוח', desc: 'תצפיות והערות מסיבוב פיקוח בשטח', icon: Search },
  { value: 'HANDOVER', label: 'דוח מסירה', desc: 'תיעוד מצב הנכס לקראת מסירה', icon: ClipboardCheck },
]

const ROOMS = [
  'מטבח', 'סלון', 'כניסה', 'מסדרון',
  'חדר שינה 1', 'חדר שינה 2', 'חדר שינה 3',
  'חדר אמבטיה', 'שירותים', 'מרפסת',
  'חניה', 'חדר ילדים', 'חדר עבודה', 'גג',
]

interface Item {
  id: string
  file?: File           // תמונה חדשה מהמכשיר
  photoId?: string      // תמונה שכבר קיימת בשרת (מצב עריכה)
  planPhotoId?: string  // תמונת תוכנית מסומנת שכבר קיימת בשרת
  previewUrl: string
  note: string
  room: string
  planId?: string
  planName?: string
  planUrl?: string
  planPin?: { x: number; y: number }
}

export default function FieldReportPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editReportId = searchParams.get('edit')

  useEffect(() => { api.get(`/projects/${projectId}`).catch(() => {}) }, [projectId])

  const [reportType, setReportType] = useState<ReportType | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; previewUrl: string } | null>(null)
  const [pendingNote, setPendingNote] = useState('')
  const [pendingRoom, setPendingRoom] = useState('')
  const [isCustomRoom, setIsCustomRoom] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [resultReport, setResultReport] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // plan annotation state
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [activePlan, setActivePlan] = useState<{ id: string; name: string; url: string } | null>(null)

  // photo drawing state
  const [photoAnnotatorOpen, setPhotoAnnotatorOpen] = useState(false)

  // draft state — טיוטה יכולה להיות מקומית (במכשיר, כולל תמונות כ-Blob) או מהענן
  // (רק photoId+photoUrl, כי התמונות כבר הועלו לשרת) — הענן מנצח אם הוא מעודכן יותר
  const [draftInfo, setDraftInfo] = useState<{ savedAt: number; count: number; type: ReportType; source: 'local' | 'cloud' } | null>(null)
  const [cloudDraftItems, setCloudDraftItems] = useState<any[] | null>(null)
  const [cloudDraftTitle, setCloudDraftTitle] = useState('')
  const [draftSavedMsg, setDraftSavedMsg] = useState('')

  // edit-mode state
  const [editLoading, setEditLoading] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState('')

  const typeInfo = TYPES.find((t) => t.value === reportType)

  // מצב עריכה — טעינת דוח קיים מהשרת
  useEffect(() => {
    if (!editReportId || !projectId) return
    setEditLoading(true)
    api.get<{ data: any }>(`/projects/${projectId}/field-report/${editReportId}`)
      .then((res) => {
        const r = res.data
        setReportType(r.type)
        setCustomTitle(r.title || '')
        setItems((r.items ?? []).map((it: any) => ({
          id: `${Date.now()}-${Math.random()}`,
          photoId: it.photoId,
          planPhotoId: it.planPhotoId,
          previewUrl: absoluteUrl(it.photoUrl),
          note: it.note || '',
          room: it.room || '',
          planId: it.planId,
          planName: it.planName,
          planPin: it.planPin,
        })))
      })
      .catch((err: any) => setErrorMsg(err.message || 'טעינת הדוח לעריכה נכשלה'))
      .finally(() => setEditLoading(false))
  }, [editReportId, projectId])

  function startEditNote(item: Item) {
    setEditingItemId(item.id)
    setEditingNote(item.note)
  }

  function saveEditNote() {
    setItems((prev) => prev.map((it) => (it.id === editingItemId ? { ...it, note: editingNote } : it)))
    setEditingItemId(null)
    setEditingNote('')
  }

  // בדיקה אם קיימת טיוטה שמורה — מקומית (במכשיר) ו/או בענן; בוחרים את המעודכנת מביניהן
  useEffect(() => {
    if (!projectId) return
    ;(async () => {
      const local = await loadDraft(projectId).catch(() => null)
      const cloudRes = await api.get<{ data: any }>(`/projects/${projectId}/field-report-draft`).catch(() => null)
      const cloud = cloudRes?.data

      const localTime = local?.items?.length ? local.savedAt : 0
      const cloudTime = cloud?.items?.length ? new Date(cloud.updatedAt).getTime() : 0

      if (cloudTime > 0 && cloudTime >= localTime) {
        setCloudDraftItems(cloud.items)
        setCloudDraftTitle(cloud.title || '')
        setDraftInfo({ savedAt: cloudTime, count: cloud.items.length, type: cloud.type, source: 'cloud' })
      } else if (localTime > 0) {
        setDraftInfo({ savedAt: local!.savedAt, count: local!.items.length, type: local!.reportType, source: 'local' })
      }
    })()
  }, [projectId])

  async function saveDraftNow() {
    if (!reportType) return
    // 1) שמירה מקומית קודם — עובדת תמיד, גם בלי אינטרנט, ומהווה רשת ביטחון
    const localDraft: FieldReportDraft = {
      reportType,
      customTitle,
      savedAt: Date.now(),
      items: items.filter((it) => it.file).map((it) => ({
        note: it.note,
        room: it.room,
        planId: it.planId,
        planName: it.planName,
        planUrl: it.planUrl,
        planPin: it.planPin,
        fileName: it.file!.name || 'photo.jpg',
        fileType: it.file!.type || 'image/jpeg',
        blob: it.file!,
      })),
    }
    try {
      await saveDraft(projectId, localDraft)
    } catch {
      setErrorMsg('שמירת הטיוטה במכשיר נכשלה')
      return
    }

    // 2) ניסיון סנכרון לענן — best effort; בלי קליטה זה נכשל בשקט והשמירה המקומית מספיקה
    let cloudSynced = false
    try {
      const uploaded = await Promise.all(items.map(async (item) => {
        let photoId = item.photoId
        if (!photoId && item.file) {
          const fd = new FormData()
          fd.append('file', item.file)
          fd.append('projectId', projectId)
          const res = await api.upload<{ data: any }>('/photos/upload', fd)
          photoId = res.data.id
        }
        return { itemId: item.id, photoId }
      }))
      // מסמנים על ה-items שכבר הועלו כדי שלא יועלו שוב בסיבוב הבא (טיוטה נוספת או סיום)
      setItems((prev) => prev.map((it) => {
        const u = uploaded.find((x) => x.itemId === it.id)
        return u?.photoId && !it.photoId ? { ...it, photoId: u.photoId } : it
      }))
      const cloudItems = items
        .map((it) => {
          const photoId = it.photoId || uploaded.find((x) => x.itemId === it.id)?.photoId
          if (!photoId) return null
          return { photoId, note: it.note || undefined, room: it.room || undefined, planId: it.planId, planName: it.planName, planPin: it.planPin }
        })
        .filter((it): it is NonNullable<typeof it> => !!it)

      if (cloudItems.length > 0) {
        await api.put(`/projects/${projectId}/field-report-draft`, {
          type: reportType,
          title: customTitle || undefined,
          items: cloudItems,
        })
        cloudSynced = true
      }
    } catch {
      // אין אינטרנט או שגיאת שרת זמנית — לא קריטי, הטיוטה המקומית היא רשת הביטחון
    }

    setDraftSavedMsg(cloudSynced
      ? 'הטיוטה נשמרה במכשיר ובענן — נגישה גם ממחשב אחר'
      : 'הטיוטה נשמרה במכשיר (בלי קליטה כרגע — תסונכרן לענן אוטומטית כשתהיה)')
    setTimeout(() => setDraftSavedMsg(''), 5000)
  }

  async function resumeDraft() {
    if (!draftInfo) return
    if (draftInfo.source === 'cloud' && cloudDraftItems) {
      setReportType(draftInfo.type)
      setCustomTitle(cloudDraftTitle)
      setItems(cloudDraftItems.map((it: any) => ({
        id: `${Date.now()}-${Math.random()}`,
        photoId: it.photoId,
        previewUrl: absoluteUrl(it.photoUrl),
        note: it.note || '',
        room: it.room || '',
        planId: it.planId,
        planName: it.planName,
        planPin: it.planPin,
      })))
    } else {
      const d = await loadDraft(projectId)
      if (!d) return
      setReportType(d.reportType)
      setCustomTitle(d.customTitle)
      setItems(d.items.map((it) => ({
        id: `${Date.now()}-${Math.random()}`,
        file: new File([it.blob], it.fileName, { type: it.fileType }),
        previewUrl: URL.createObjectURL(it.blob),
        note: it.note,
        room: it.room,
        planId: it.planId,
        planName: it.planName,
        planUrl: it.planUrl,
        planPin: it.planPin,
      })))
    }
    setDraftInfo(null)
    setCloudDraftItems(null)
  }

  async function discardDraft() {
    await Promise.all([
      deleteDraft(projectId),
      api.delete(`/projects/${projectId}/field-report-draft`).catch(() => {}),
    ])
    setDraftInfo(null)
    setCloudDraftItems(null)
  }

  // fetch project plans
  const { data: docsData } = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => api.get<{ data: any[] }>(`/projects/${projectId}/documents`),
    staleTime: 60_000,
    enabled: !!projectId,
  })
  const plans = (docsData?.data ?? []).filter((d: any) => d.type === 'PLAN')

  function handlePhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingPhoto({ file, previewUrl: URL.createObjectURL(file) })
    setPendingNote('')
    e.target.value = ''
  }

  function handleAddClick() {
    if (!pendingPhoto) return
    if (plans.length > 0) {
      setPlanDialogOpen(true)
    } else {
      doAddItem()
    }
  }

  function doAddItem(planData?: { planId: string; planName: string; planUrl: string; planPin: { x: number; y: number } | null }) {
    if (!pendingPhoto) return
    // מוסיפים בסוף הרשימה — כך התמונה הראשונה שצולמה מופיעה ראשונה בדוח (סדר כרונולוגי)
    setItems((prev) => [...prev, {
      id: `${Date.now()}-${Math.random()}`,
      file: pendingPhoto.file,
      previewUrl: pendingPhoto.previewUrl,
      note: pendingNote,
      room: pendingRoom,
      planId: planData?.planId,
      planName: planData?.planName,
      planUrl: planData?.planUrl,
      planPin: planData?.planPin ?? undefined,
    }])
    setPendingPhoto(null)
    setPendingNote('')
    setPendingRoom('')
    setIsCustomRoom(false)
    setPlanDialogOpen(false)
    setActivePlan(null)
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
        await Promise.all(items.map(async (item) => {
          if (!item.file) return
          const locationParts = [item.room, item.planName ? `תוכנית: ${item.planName}` : ''].filter(Boolean)
          const prefix = locationParts.length ? `[${locationParts.join(' | ')}] ` : ''
          const defectRes = await api.post<{ data: any }>(`/projects/${projectId}/defects`, {
            title: `${prefix}${item.note}`.slice(0, 60) || item.room || item.planName || 'ממצא מהשטח',
            description: [locationParts.join(' | '), item.note || 'ממצא מהשטח'].filter(Boolean).join('\n'),
            category: 'OTHER',
            severity: 'MEDIUM',
            status: 'OPEN',
          })
          // העלאת תמונת השטח
          const fd = new FormData()
          fd.append('file', item.file)
          fd.append('defectBeforeId', defectRes.data.id)
          fd.append('projectId', projectId)
          await api.upload('/photos/upload', fd)
          // אם סומן מיקום על תוכנית — מייצרים תמונה מסומנת ומעלים אותה גם כן
          if (item.planUrl && item.planPin) {
            const blob = await generateAnnotatedPlanImage(item.planUrl, item.planPin)
            if (blob) {
              const planFd = new FormData()
              planFd.append('file', new File([blob], 'plan-annotation.jpg', { type: 'image/jpeg' }))
              planFd.append('defectBeforeId', defectRes.data.id)
              planFd.append('projectId', projectId)
              await api.upload('/photos/upload', planFd)
            }
          }
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
        const reportItems = await Promise.all(items.map(async (item) => {
          // תמונה קיימת בשרת (מצב עריכה) — אין צורך להעלות שוב
          let photoId = item.photoId
          let planPhotoId = item.planPhotoId
          if (!photoId && item.file) {
            const captionParts = [item.room, item.planName ? `תוכנית: ${item.planName}` : '', item.note].filter(Boolean)
            const fd = new FormData()
            fd.append('file', item.file)
            fd.append('projectId', projectId)
            fd.append('caption', captionParts.join(' | '))
            const res = await api.upload<{ data: any }>('/photos/upload', fd)
            photoId = res.data.id as string
            // תמונת תוכנית מסומנת — מוצמדת לאותו ממצא ולא נספרת בנפרד
            if (item.planUrl && item.planPin) {
              const blob = await generateAnnotatedPlanImage(item.planUrl, item.planPin)
              if (blob) {
                const planFd = new FormData()
                planFd.append('file', new File([blob], 'plan-annotation.jpg', { type: 'image/jpeg' }))
                planFd.append('projectId', projectId)
                planFd.append('caption', `מיקום על תוכנית: ${item.planName || ''}`)
                const planRes = await api.upload<{ data: any }>('/photos/upload', planFd)
                planPhotoId = planRes.data.id
              }
            }
          }
          return {
            photoId: photoId!,
            planPhotoId,
            note: item.note || undefined,
            room: item.room || undefined,
            planId: item.planId,
            planName: item.planName,
            planPin: item.planPin,
          }
        }))
        const validItems = reportItems.filter((it) => it.photoId)
        const reportRes = editReportId
          ? await api.put<{ data: any }>(`/projects/${projectId}/field-report/${editReportId}`, {
              title: customTitle || undefined,
              items: validItems,
            })
          : await api.post<{ data: any }>(`/projects/${projectId}/field-report`, {
              type: reportType,
              title: customTitle || undefined,
              items: validItems,
            })
        setResultReport(reportRes.data)
      }
      // הדוח הופק — מוחקים את הטיוטה השמורה (מקומית וגם בענן)
      deleteDraft(projectId).catch(() => {})
      api.delete(`/projects/${projectId}/field-report-draft`).catch(() => {})
      setDraftInfo(null)
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
    setPendingRoom('')
    setIsCustomRoom(false)
    setCustomTitle('')
    setResultReport(null)
    setErrorMsg('')
    setPlanDialogOpen(false)
    setActivePlan(null)
  }

  return (
    <AppLayout title="דוח שטח">
      <div className="space-y-4 max-w-lg mx-auto">
        <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-primary">
          <ArrowRight size={13} />
          חזרה לפרויקט
        </Link>

        {/* Edit mode — loading existing report */}
        {editReportId && editLoading && (
          <div className="card text-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">טוען דוח לעריכה...</p>
          </div>
        )}
        {editReportId && !editLoading && !reportType && errorMsg && (
          <div className="card text-center py-10 space-y-3">
            <p className="text-sm text-danger">{errorMsg}</p>
            <Button variant="outline" size="sm" onClick={() => router.push(`/reports?project=${projectId}`)}>
              חזרה לדוחות
            </Button>
          </div>
        )}

        {/* Step 1: choose type */}
        {!editReportId && !reportType && !resultReport && (
          <div className="space-y-3">
            {/* טיוטה שמורה */}
            {draftInfo && (
              <div className="card border-2 border-secondary/40 bg-orange-50/40 space-y-2">
                <div className="flex items-center gap-2">
                  <Save size={16} className="text-secondary" />
                  <p className="text-sm font-semibold text-neutral-dark">
                    יש דוח שמור — {TYPES.find((t) => t.value === draftInfo.type)?.label}
                  </p>
                  <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-500 border border-gray-200">
                    {draftInfo.source === 'cloud' ? '☁️ מהענן' : '📱 מהמכשיר'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {draftInfo.count} ממצאים · נשמר ב-{new Date(draftInfo.savedAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={resumeDraft} className="flex-1">המשך את הדוח</Button>
                  <Button size="sm" variant="outline" onClick={discardDraft}>מחק</Button>
                </div>
              </div>
            )}
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
                {editReportId && (
                  <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Pencil size={10} />
                    עריכה
                  </span>
                )}
              </div>
              {editReportId ? (
                <button onClick={() => router.push(`/reports?project=${projectId}`)} className="text-xs text-gray-400 hover:text-danger">
                  בטל עריכה
                </button>
              ) : (
                <button onClick={resetAll} className="text-xs text-gray-400 hover:text-danger">החלף סוג דוח</button>
              )}
            </div>

            {/* Capture / pending item */}
            {pendingPhoto ? (
              <div className="card space-y-3">
                <div className="relative">
                  <img src={pendingPhoto.previewUrl} className="w-full max-h-64 object-contain rounded-xl bg-gray-50" />
                  <button
                    type="button"
                    onClick={() => setPhotoAnnotatorOpen(true)}
                    className="absolute bottom-2 left-2 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium text-primary shadow flex items-center gap-1 hover:bg-white transition-colors"
                  >
                    <PenLine size={13} />
                    סמן על התמונה
                  </button>
                </div>

                {/* בחירת חדר / אזור */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">חדר / אזור (אופציונלי)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ROOMS.map((room) => (
                      <button
                        key={room}
                        type="button"
                        onClick={() => { setIsCustomRoom(false); setPendingRoom(pendingRoom === room ? '' : room) }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          pendingRoom === room && !isCustomRoom
                            ? 'bg-primary text-white border-primary'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40'
                        }`}
                      >
                        {room}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setIsCustomRoom(true); setPendingRoom('') }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        isCustomRoom
                          ? 'bg-secondary text-white border-secondary'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-secondary/40'
                      }`}
                    >
                      אחר...
                    </button>
                  </div>
                  {isCustomRoom && (
                    <input
                      type="text"
                      value={pendingRoom}
                      onChange={(e) => setPendingRoom(e.target.value)}
                      placeholder="שם החדר / האזור..."
                      autoFocus
                      className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                    />
                  )}
                </div>

                <Textarea
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder="כתוב ממצא לתמונה הזו..."
                />
                <div className="flex gap-2">
                  <Button onClick={handleAddClick} className="flex-1">
                    <Check size={14} />
                    הוסף לדוח
                  </Button>
                  <Button variant="outline" onClick={() => { setPendingPhoto(null); setPendingRoom(''); setIsCustomRoom(false) }}>
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
                {items.length >= 25 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
                    דוח עם הרבה תמונות (25+) עלול להיכשל בהפקה. מומלץ לסיים ולהפיק את הדוח הנוכחי, ולפתוח דוח שטח נוסף להמשך התיעוד.
                  </div>
                )}
                {items.map((item) => (
                  <div key={item.id} className="card space-y-2">
                    <div className="flex items-center gap-3">
                      <img src={item.previewUrl} className="w-16 h-16 object-cover rounded-lg shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {item.room && (
                            <span className="text-xs bg-primary-50 text-primary px-2 py-0.5 rounded-full">
                              {item.room}
                            </span>
                          )}
                          {item.planName && (
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <MapPin size={10} />
                              {item.planName}{item.planPin ? ' ✓' : ''}
                            </span>
                          )}
                        </div>
                        {editingItemId !== item.id && (
                          <p className="text-sm text-gray-600 line-clamp-2">{item.note || '(ללא הערה)'}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => startEditNote(item)} className="p-1.5 text-gray-400 hover:text-primary">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => removeItem(item.id)} className="p-1.5 text-gray-400 hover:text-danger">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                    {editingItemId === item.id && (
                      <div className="space-y-2">
                        <Textarea
                          value={editingNote}
                          onChange={(e) => setEditingNote(e.target.value)}
                          placeholder="הערה לממצא..."
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEditNote} className="flex-1">
                            <Check size={13} />
                            שמור הערה
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setEditingItemId(null); setEditingNote('') }}>
                            ביטול
                          </Button>
                        </div>
                      </div>
                    )}
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
                {draftSavedMsg && <p className="text-sm text-green-600 text-center">{draftSavedMsg}</p>}
                <Button onClick={finish} loading={finishing} className="w-full" size="lg">
                  <FileText size={16} />
                  {editReportId ? `שמור שינויים והפק מחדש (${items.length})` : `סיום והפקת דוח (${items.length})`}
                </Button>
                {!editReportId && (
                  <Button variant="outline" onClick={saveDraftNow} className="w-full">
                    <Save size={15} />
                    שמור טיוטה — המשך מאוחר יותר
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3: done — share */}
        {resultReport && (
          <div className="space-y-4">
            <div className="card text-center py-6">
              <Check size={36} className="text-green-500 mx-auto mb-2" />
              <p className="font-semibold text-neutral-dark">{editReportId ? 'הדוח עודכן בהצלחה!' : 'הדוח הופק בהצלחה!'}</p>
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

            <Button onClick={() => router.push(`/reports?project=${projectId}`)} className="w-full">
              <FileText size={16} />
              ראה בדוחות הפרויקט
            </Button>
            {!editReportId && (
              <Button variant="ghost" onClick={resetAll} className="w-full">דוח שטח נוסף</Button>
            )}
          </div>
        )}
      </div>

      {/* Plan selection dialog — bottom sheet */}
      {planDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPlanDialogOpen(false)}
          />
          <div className="relative w-full bg-white rounded-t-2xl p-4 space-y-3 max-h-[75vh] overflow-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <div className="flex items-center gap-2 justify-center">
              <Map size={18} className="text-primary" />
              <p className="font-semibold text-neutral-dark">סמן מיקום על תוכנית?</p>
            </div>
            <p className="text-xs text-gray-400 text-center">בחר תוכנית לסימון המיקום המדויק של הממצא</p>

            <div className="space-y-2 pt-1">
              {plans.map((plan: any) => (
                <button
                  key={plan.id}
                  onClick={() => {
                    setPlanDialogOpen(false)
                    setActivePlan({ id: plan.id, name: plan.name, url: absoluteUrl(plan.url) })
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-primary/40 hover:bg-primary-50/30 text-right transition-colors"
                >
                  <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <span className="text-sm font-medium text-neutral-dark flex-1 truncate">{plan.name}</span>
                  <MapPin size={14} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={() => { setPlanDialogOpen(false); doAddItem() }}
              className="w-full mt-2"
            >
              דלג — הוסף ללא סימון על תוכנית
            </Button>
          </div>
        </div>
      )}

      {/* Full-screen plan pin picker */}
      {activePlan && (
        <PlanPinPicker
          url={activePlan.url}
          planName={activePlan.name}
          onConfirm={(pin) => doAddItem({ planId: activePlan.id, planName: activePlan.name, planUrl: activePlan.url, planPin: pin })}
          onBack={() => { setActivePlan(null); setPlanDialogOpen(true) }}
        />
      )}

      {/* Full-screen photo annotator — ציור וסימון על התמונה שצולמה */}
      {photoAnnotatorOpen && pendingPhoto && (
        <PhotoAnnotator
          file={pendingPhoto.file}
          onConfirm={(newFile, newPreviewUrl) => {
            URL.revokeObjectURL(pendingPhoto.previewUrl)
            setPendingPhoto({ file: newFile, previewUrl: newPreviewUrl })
            setPhotoAnnotatorOpen(false)
          }}
          onCancel={() => setPhotoAnnotatorOpen(false)}
        />
      )}
    </AppLayout>
  )
}
