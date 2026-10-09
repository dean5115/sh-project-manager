'use client'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { absoluteUrl, CATEGORY_LABELS, SEVERITY_COLORS } from '@/lib/utils'
import { AppLayout } from '@/components/layout/app-layout'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Camera, Trash2, ArrowRight, AlertTriangle, Search, ClipboardCheck, ClipboardList,
  Check, X, Download, MessageCircle, Mail, FileText, MapPin, Map, Save, Pencil, PenLine,
  Plus, BookMarked, ChevronDown, ChevronUp,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PlanPinPicker } from '@/components/pdf/plan-pin-picker'
import { PhotoAnnotator } from '@/components/photo/photo-annotator'
import { generateAnnotatedPlanImage } from '@/lib/plan-annotation'
import { saveDraft, loadDraft, deleteDraft, type FieldReportDraft } from '@/lib/field-report-draft'
import { useAuthStore } from '@/store/auth'
import { StandardChipPicker } from '@/components/standards/standard-chip-picker'
import type { Standard, FindingTemplate } from '@sitepilot/types'

// מעלים תמונות אחת-אחת ולא במקביל — העלאה בו-זמנית של 10+ תמונות מהפלאפון מציפה את השרת
// (free tier, 512MB) ומסתיימת ב-HTTP 502
async function mapSeq<T, R>(arr: T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < arr.length; i++) out.push(await fn(arr[i], i))
  return out
}

type ReportType = 'DEFECTS' | 'INSPECTION' | 'HANDOVER' | 'HOME_INSPECTION'

const TYPES: { value: ReportType; label: string; desc: string; icon: typeof AlertTriangle }[] = [
  { value: 'DEFECTS', label: 'דוח ליקויים', desc: 'כל תמונה תהפוך לליקוי מתועד ומשויך', icon: AlertTriangle },
  { value: 'INSPECTION', label: 'דוח פיקוח', desc: 'תצפיות והערות מסיבוב פיקוח בשטח', icon: Search },
  { value: 'HANDOVER', label: 'דוח מסירה', desc: 'תיעוד מצב הנכס לקראת מסירה', icon: ClipboardCheck },
  { value: 'HOME_INSPECTION', label: 'דוח בדק בית', desc: 'ממצאים לפי חדר, עם תקנים ותקנות מצוטטים', icon: ClipboardList },
]

const ROOMS = [
  'מטבח', 'סלון', 'כניסה', 'מסדרון',
  'חדר שינה 1', 'חדר שינה 2', 'חדר שינה 3',
  'חדר אמבטיה', 'שירותים', 'מרפסת',
  'חניה', 'חדר ילדים', 'חדר עבודה', 'גג',
]

// התאמת אוטוקומפליט סלחנית להטיות בעברית (יחיד/רבים וכו') — משווה מילים לפי תת-מחרוזת או תחילית משותפת
function heWords(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean)
}
function heWordMatch(a: string, b: string): boolean {
  const prefixLen = Math.min(4, a.length, b.length)
  if (prefixLen === 0) return false
  return a.slice(0, prefixLen) === b.slice(0, prefixLen)
}
function stripSpaces(s: string): string {
  return s.replace(/\s+/g, '')
}
// ציון התאמה בין מה שהוקלד לבין כותרת תבנית — לא בוליאני, כדי שאפשר לדרג "הכי קרוב" גם כשאין התאמה מושלמת.
// תופס גם ערכים דבוקים למילת יחס בלי רווח (כמו "מ1%" או "ל-60") כי הוא בודק גם התאמת תת-מחרוזת רציפה על כל הכותרת.
function titleMatchScore(query: string, title: string): number {
  const q = query.trim()
  if (!q) return 0
  const queryWords = heWords(q)
  const titleWords = heWords(title)
  const strippedTitle = stripSpaces(title)
  const strippedQuery = stripSpaces(q)

  let matchedWords = 0
  for (const qw of queryWords) {
    const hit = titleWords.some((tw) => tw.includes(qw) || heWordMatch(qw, tw))
    if (hit) matchedWords++
  }
  const wordRatio = queryWords.length ? matchedWords / queryWords.length : 0

  // בונוס גדול אם כל השאילתה (בלי רווחים) מופיעה כרצף אחד בתוך הכותרת — תופס ערכים דבוקים כמו "מ1%"
  const substringBonus = strippedTitle.includes(strippedQuery) ? 1 : 0

  if (wordRatio === 0 && substringBonus === 0) return 0
  return wordRatio * 10 + substringBonus * 5
}

const SEVERITIES = [
  { value: 'LOW', label: 'נמוכה' },
  { value: 'MEDIUM', label: 'בינונית' },
  { value: 'HIGH', label: 'גבוהה' },
  { value: 'CRITICAL', label: 'קריטי' },
]
const SEVERITY_LABELS: Record<string, string> = { LOW: 'נמוכה', MEDIUM: 'בינונית', HIGH: 'גבוהה', CRITICAL: 'קריטי' }

const SOURCE_TYPES = [
  { value: 'REGULATION', label: 'תקנות התכנון והבניה', color: 'bg-red-100 text-red-700' },
  { value: 'HALAT', label: 'הל"ת', color: 'bg-amber-100 text-amber-700' },
  { value: 'STANDARD', label: 'תקן', color: 'bg-blue-100 text-blue-700' },
]

interface ExtraPhoto {
  file?: File
  photoId?: string
  previewUrl: string
  caption?: string
}

interface Item {
  id: string
  file?: File           // תמונה חדשה מהמכשיר
  photoId?: string      // תמונה שכבר קיימת בשרת (מצב עריכה)
  photoCaption?: string // כיתוב לתמונה הראשית — דוח בדק בית בלבד
  planPhotoId?: string  // תמונת תוכנית מסומנת שכבר קיימת בשרת
  previewUrl: string
  note: string           // דוח בדק בית: משמש כתוכן "המלצה"
  room: string
  planId?: string
  planName?: string
  planUrl?: string
  planPin?: { x: number; y: number }
  // דוח בדק בית בלבד — אדיטיבי, לא נוגע בשלושת סוגי הדוח האחרים
  title?: string
  remark?: string
  category?: string
  severity?: string
  standardIds?: string[]
  extraPhotos?: ExtraPhoto[]
}

interface PropertyDetails {
  clientName: string
  visitDate: string
  propertyType: string
  roomsIncluded: string
  occupied: string
  electricityConnected: boolean | null
  waterConnected: boolean | null
  generalNotes: string
}
// דוח פיקוח/מסירה — פרטי כותרת הדוח (ריק = ברירת מחדל מהפרויקט/היום)
type LogoMode = 'org' | 'custom' | 'none'
interface ReportHeader {
  visitDate: string
  projectName: string
  projectAddress: string
  contractorName: string
  attendees: string
  generalNotes: string
  // מיתוג וחתימה — ריק/org = פרטי הארגון מההגדרות
  logoMode: LogoMode
  logoUrl: string
  companyName: string
  footerText: string
  signerName: string
  signerTitle: string
  signerPhone: string
}
const EMPTY_REPORT_HEADER: ReportHeader = {
  visitDate: '', projectName: '', projectAddress: '', contractorName: '', attendees: '', generalNotes: '',
  logoMode: 'org', logoUrl: '', companyName: '', footerText: '', signerName: '', signerTitle: '', signerPhone: '',
}
const LOGO_MODES: { value: LogoMode; label: string }[] = [
  { value: 'org', label: 'לוגו החברה' },
  { value: 'custom', label: 'לוגו אחר' },
  { value: 'none', label: 'ללא לוגו' },
]
function asLogoMode(v: unknown): LogoMode {
  return v === 'custom' || v === 'none' ? v : 'org'
}
function headerFromMetadata(m: any): ReportHeader {
  if (!m) return EMPTY_REPORT_HEADER
  return {
    visitDate: m.visitDate || '', projectName: m.projectName || '', projectAddress: m.projectAddress || '',
    contractorName: m.contractorName || '', attendees: m.attendees || '', generalNotes: m.generalNotes || '',
    logoMode: asLogoMode(m.logoMode), logoUrl: m.logoUrl || '', companyName: m.companyName || '',
    footerText: m.footerText || '', signerName: m.signerName || '', signerTitle: m.signerTitle || '',
    signerPhone: m.signerPhone || '',
  }
}

// מיתוג וחתימה הם של מי שמפיק את הדוח, לא של דוח מסוים — נזכרים במכשיר (לכל משתמש) כברירת מחדל לדוח הבא
const BRANDING_KEYS = ['logoMode', 'logoUrl', 'companyName', 'footerText', 'signerName', 'signerTitle', 'signerPhone'] as const
type RememberedBranding = Pick<ReportHeader, (typeof BRANDING_KEYS)[number]>
function brandingStorageKey(userId: string | undefined) {
  return `sh-report-branding-v1-${userId || 'anon'}`
}
function loadRememberedBranding(userId: string | undefined): Partial<RememberedBranding> {
  try {
    const raw = JSON.parse(localStorage.getItem(brandingStorageKey(userId)) || 'null')
    if (!raw || typeof raw !== 'object') return {}
    const out: Partial<RememberedBranding> = {}
    for (const k of BRANDING_KEYS) if (typeof raw[k] === 'string') (out as any)[k] = raw[k]
    if (out.logoMode !== undefined) out.logoMode = asLogoMode(out.logoMode)
    return out
  } catch {
    return {}
  }
}
function rememberBranding(userId: string | undefined, header: ReportHeader) {
  try {
    const data: Partial<RememberedBranding> = {}
    for (const k of BRANDING_KEYS) (data as any)[k] = header[k]
    localStorage.setItem(brandingStorageKey(userId), JSON.stringify(data))
  } catch {
    // אחסון חסום (גלישה פרטית וכו') — לא קריטי, פשוט לא נזכרים
  }
}

// סדר המקצועות ברשימה ובדוח — זהה לסדר ב-CATEGORY_LABELS; ממצאים בלי מקצוע ("כללי") בסוף
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)
function categoryRank(c: string | undefined) {
  const i = c ? CATEGORY_ORDER.indexOf(c) : -1
  return i === -1 ? CATEGORY_ORDER.length : i
}
const TRADE_OPTIONS = [{ value: '', label: 'כללי (ללא מקצוע)' }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]

const EMPTY_PROPERTY_DETAILS: PropertyDetails = {
  clientName: '', visitDate: '', propertyType: '', roomsIncluded: '', occupied: '',
  electricityConnected: null, waterConnected: null, generalNotes: '',
}

export default function FieldReportPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const editReportId = searchParams.get('edit')
  const qc = useQueryClient()

  useEffect(() => { api.get(`/projects/${projectId}`).catch(() => {}) }, [projectId])

  const [reportType, setReportType] = useState<ReportType | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; previewUrl: string } | null>(null)
  const [pendingNote, setPendingNote] = useState('')
  const [pendingRoom, setPendingRoom] = useState('')
  const [isCustomRoom, setIsCustomRoom] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [finishing, setFinishing] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [progressMsg, setProgressMsg] = useState('')
  const [resultReport, setResultReport] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // plan annotation state
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [activePlan, setActivePlan] = useState<{ id: string; name: string; url: string } | null>(null)

  // photo drawing state
  const [photoAnnotatorOpen, setPhotoAnnotatorOpen] = useState(false)

  // דוח בדק בית בלבד — כותרת+auto-complete, קטגוריה/חומרה, תקנים, תמונות נוספות
  const [pendingTitle, setPendingTitle] = useState('')
  const [pendingRemark, setPendingRemark] = useState('')
  const [pendingPhotoCaption, setPendingPhotoCaption] = useState('')
  const [pendingCategory, setPendingCategory] = useState('')
  const [pendingSeverity, setPendingSeverity] = useState('')
  const [pendingStandardIds, setPendingStandardIds] = useState<string[]>([])
  const [pendingExtraPhotos, setPendingExtraPhotos] = useState<ExtraPhoto[]>([])
  const [titleSuggestOpen, setTitleSuggestOpen] = useState(false)
  const [browseCategoryOpen, setBrowseCategoryOpen] = useState(false)
  const [matchedTemplateId, setMatchedTemplateId] = useState<string | null>(null)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [newStandardOpen, setNewStandardOpen] = useState(false)
  const [newStandardForm, setNewStandardForm] = useState({ sourceType: 'STANDARD', code: '' })
  const [savingStandard, setSavingStandard] = useState(false)

  // פרטי מזמין/ביקור/נכס — נלכדים פעם אחת לדוח בדק בית, לא לכל ממצא
  const [propertyDetails, setPropertyDetails] = useState<PropertyDetails>(EMPTY_PROPERTY_DETAILS)
  const [propertyDetailsOpen, setPropertyDetailsOpen] = useState(false)

  // פרטי כותרת לדוח פיקוח/מסירה — ניתנים לעריכה בכל שלב, וגם אחרי הפקה דרך "ערוך"
  const [reportHeader, setReportHeader] = useState<ReportHeader>(EMPTY_REPORT_HEADER)
  const [headerOpen, setHeaderOpen] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError, setLogoError] = useState('')
  const authUser = useAuthStore((st) => st.user)

  // draft state — טיוטה יכולה להיות מקומית (במכשיר, כולל תמונות כ-Blob) או מהענן
  // (רק photoId+photoUrl, כי התמונות כבר הועלו לשרת) — הענן מנצח אם הוא מעודכן יותר
  const [draftInfo, setDraftInfo] = useState<{ savedAt: number; count: number; type: ReportType; source: 'local' | 'cloud' } | null>(null)
  const [cloudDraftItems, setCloudDraftItems] = useState<any[] | null>(null)
  const [cloudDraftTitle, setCloudDraftTitle] = useState('')
  const [cloudDraftMetadata, setCloudDraftMetadata] = useState<any>(null)
  const [draftSavedMsg, setDraftSavedMsg] = useState('')

  // edit-mode state
  const [editLoading, setEditLoading] = useState(false)
  // עריכת ממצא — כל השינויים נשמרים בעותק זמני ומוחלים רק ב"שמור" (ביטול מחזיר הכל)
  const [editDraft, setEditDraft] = useState<Item | null>(null)
  const [editError, setEditError] = useState('')
  const [editAnnotateFile, setEditAnnotateFile] = useState<File | null>(null)
  const [annotateLoading, setAnnotateLoading] = useState(false)
  const [planForEdit, setPlanForEdit] = useState(false)

  const typeInfo = TYPES.find((t) => t.value === reportType)
  // בזמן העלאה/הפקה לא משנים את הרשימה — השינויים לא ייכנסו לדוח שכבר בתהליך
  const busy = finishing || savingDraft
  const isHomeInspection = reportType === 'HOME_INSPECTION'
  // דוח פיקוח/מסירה — כותרת ניתנת לעריכה, מקצוע לכל ממצא ותמונות נוספות
  const isFieldReport = reportType === 'INSPECTION' || reportType === 'HANDOVER'
  const supportsExtraPhotos = isHomeInspection || isFieldReport

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get<{ data: any }>(`/projects/${projectId}`),
    enabled: !!projectId,
    staleTime: 60_000,
  })
  const project = projectData?.data

  // פרטי הארגון — לתצוגת הלוגו הנוכחי וברירות המחדל של המיתוג בכותרת הדוח
  const { data: orgData } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get<{ data: any }>('/organization'),
    enabled: isFieldReport,
    staleTime: 60_000,
  })
  const org = orgData?.data
  const brandName = reportHeader.companyName.trim() || org?.name || ''
  const autoFooter = [brandName, ...(reportHeader.companyName.trim() ? [] : [org?.contactEmail, org?.address, org?.phone])]
    .filter(Boolean).join(' | ')

  // הרשימה במסך מסודרת לפי מקצוע — כמו בדוח עצמו
  const displayItems = useMemo(() => {
    if (!isFieldReport || !items.some((it) => it.category)) return items
    return items.map((it, idx) => ({ it, idx }))
      .sort((a, b) => categoryRank(a.it.category) - categoryRank(b.it.category) || a.idx - b.idx)
      .map((x) => x.it)
  }, [items, isFieldReport])
  const groupByTrade = isFieldReport && items.some((it) => it.category)

  // ספריות תקנים/ממצאים נפוצים — נטענות רק עבור דוח בדק בית
  const { data: standardsData } = useQuery({
    queryKey: ['standards'],
    queryFn: () => api.get<{ data: Standard[] }>('/standards'),
    enabled: isHomeInspection,
    staleTime: 60_000,
  })
  const standards = standardsData?.data ?? []
  const relevantStandards = standards.filter((s) => !pendingCategory || !s.category || s.category === pendingCategory)

  const { data: templatesData } = useQuery({
    queryKey: ['finding-templates'],
    queryFn: () => api.get<{ data: FindingTemplate[] }>('/finding-templates'),
    enabled: isHomeInspection,
    staleTime: 60_000,
  })
  const templates = templatesData?.data ?? []
  const titleSuggestions = useMemo(() => {
    const q = pendingTitle.trim()
    if (!q) return []
    // אם נבחרה קטגוריה — ההצעות מוגבלות אך ורק אליה (תבניות ללא קטגוריה לא נכללות, כדי שהתוצאות יהיו רלוונטיות באמת)
    const pool = pendingCategory ? templates.filter((t) => t.category === pendingCategory) : templates
    const scored = pool
      .map((t) => ({ t, score: titleMatchScore(q, t.title) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, 8).map((s) => s.t)
  }, [pendingTitle, templates, pendingCategory])
  // כל תבניות הממצא של הקטגוריה הנבחרת — לעיון חופשי דרך כפתור החץ, גם בלי להקליד כלום
  const categoryTemplates = useMemo(() => {
    if (!pendingCategory) return []
    return [...templates.filter((t) => t.category === pendingCategory)].sort((a, b) => a.title.localeCompare(b.title, 'he'))
  }, [templates, pendingCategory])

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
          photoCaption: it.photoCaption,
          planPhotoId: it.planPhotoId,
          previewUrl: absoluteUrl(it.photoUrl),
          note: it.note || it.recommendation || '',
          room: it.room || '',
          planId: it.planId,
          planName: it.planName,
          planPin: it.planPin,
          title: it.title,
          remark: it.remark,
          category: it.category,
          severity: it.severity,
          standardIds: it.standardIds,
          extraPhotos: (it.extraPhotos ?? []).map((ep: any) => ({ photoId: ep.photoId, previewUrl: absoluteUrl(ep.url), caption: ep.caption })),
        })))
        setPropertyDetails(r.metadata ? { ...EMPTY_PROPERTY_DETAILS, ...r.metadata } : EMPTY_PROPERTY_DETAILS)
        setReportHeader(headerFromMetadata(r.metadata))
      })
      .catch((err: any) => setErrorMsg(err.message || 'טעינת הדוח לעריכה נכשלה'))
      .finally(() => setEditLoading(false))
  }, [editReportId, projectId])

  function startEditItem(item: Item) {
    // מעבר לעריכת ממצא אחר שומר את העריכה הפתוחה, כדי שלא יאבדו שינויים
    if (editDraft && editDraft.id !== item.id) saveEditItem()
    setEditDraft({ ...item, extraPhotos: item.extraPhotos ? [...item.extraPhotos] : undefined })
    setEditError('')
  }

  function saveEditItem() {
    if (!editDraft) return
    const draft = editDraft
    setItems((prev) => prev.map((it) => (it.id === draft.id ? draft : it)))
    setEditDraft(null)
    setEditError('')
  }

  function cancelEditItem() {
    setEditDraft(null)
    setEditError('')
  }

  function updateDraft(patch: Partial<Item>) {
    setEditDraft((d) => (d ? { ...d, ...patch } : d))
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
        setCloudDraftMetadata(cloud.metadata || null)
        setDraftInfo({ savedAt: cloudTime, count: cloud.items.length, type: cloud.type, source: 'cloud' })
      } else if (localTime > 0) {
        setDraftInfo({ savedAt: local!.savedAt, count: local!.items.length, type: local!.reportType, source: 'local' })
      }
    })()
  }, [projectId])

  function metadataPayload() {
    if (isFieldReport) {
      return {
        visitDate: reportHeader.visitDate || undefined,
        projectName: reportHeader.projectName.trim() || undefined,
        projectAddress: reportHeader.projectAddress.trim() || undefined,
        contractorName: reportHeader.contractorName.trim() || undefined,
        attendees: reportHeader.attendees.trim() || undefined,
        generalNotes: reportHeader.generalNotes.trim() || undefined,
        logoMode: reportHeader.logoMode,
        logoUrl: reportHeader.logoMode === 'custom' ? (reportHeader.logoUrl || undefined) : undefined,
        companyName: reportHeader.companyName.trim() || undefined,
        footerText: reportHeader.footerText.trim() || undefined,
        signerName: reportHeader.signerName.trim() || undefined,
        signerTitle: reportHeader.signerTitle.trim() || undefined,
        signerPhone: reportHeader.signerPhone.trim() || undefined,
      }
    }
    if (!isHomeInspection) return undefined
    return {
      clientName: propertyDetails.clientName || undefined,
      visitDate: propertyDetails.visitDate || undefined,
      propertyType: propertyDetails.propertyType || undefined,
      roomsIncluded: propertyDetails.roomsIncluded || undefined,
      occupied: propertyDetails.occupied || undefined,
      electricityConnected: propertyDetails.electricityConnected ?? undefined,
      waterConnected: propertyDetails.waterConnected ?? undefined,
      generalNotes: propertyDetails.generalNotes || undefined,
    }
  }

  // יציאה מהמסך באמצע העלאה קוטעת את השמירה/ההפקה — מזהירים לפני סגירה או רענון
  useEffect(() => {
    if (!finishing && !savingDraft) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [finishing, savingDraft])

  async function saveDraftNow() {
    if (!reportType || savingDraft) return
    setSavingDraft(true)
    setErrorMsg('')
    setDraftSavedMsg('')
    setProgressMsg('שומר טיוטה ומעלה תמונות לענן... נא להישאר במסך')
    try {
      await saveDraftNowImpl()
    } finally {
      setSavingDraft(false)
      setProgressMsg('')
    }
  }

  async function saveDraftNowImpl() {
    if (!reportType) return
    // 1) שמירה מקומית קודם — עובדת תמיד, גם בלי אינטרנט, ומהווה רשת ביטחון
    const localDraft: FieldReportDraft = {
      reportType,
      customTitle,
      savedAt: Date.now(),
      metadata: metadataPayload(),
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
        title: it.title,
        remark: it.remark,
        photoCaption: it.photoCaption,
        category: it.category,
        severity: it.severity,
        standardIds: it.standardIds,
        extraPhotos: (it.extraPhotos ?? [])
          .filter((ep) => ep.file)
          .map((ep) => ({ fileName: ep.file!.name || 'photo.jpg', fileType: ep.file!.type || 'image/jpeg', blob: ep.file!, caption: ep.caption })),
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
      const uploaded = await mapSeq(items, async (item) => {
        let photoId = item.photoId
        if (!photoId && item.file) {
          const fd = new FormData()
          fd.append('file', item.file)
          fd.append('projectId', projectId)
          const res = await api.upload<{ data: any }>('/photos/upload', fd)
          photoId = res.data.id
        }
        let extraPhotoIds: (string | null)[] | undefined
        if (item.extraPhotos?.length) {
          extraPhotoIds = await mapSeq(item.extraPhotos, async (ep) => {
            if (ep.photoId) return ep.photoId
            if (!ep.file) return null
            const fd = new FormData()
            fd.append('file', ep.file)
            fd.append('projectId', projectId)
            const res = await api.upload<{ data: any }>('/photos/upload', fd)
            return res.data.id as string
          })
        }
        return { itemId: item.id, photoId, extraPhotoIds }
      })
      // מסמנים על ה-items שכבר הועלו כדי שלא יועלו שוב בסיבוב הבא (טיוטה נוספת או סיום)
      setItems((prev) => prev.map((it) => {
        const u = uploaded.find((x) => x.itemId === it.id)
        if (!u) return it
        const next = { ...it }
        if (u.photoId && !it.photoId) next.photoId = u.photoId
        if (u.extraPhotoIds && it.extraPhotos) {
          next.extraPhotos = it.extraPhotos.map((ep, i) => (ep.photoId || !u.extraPhotoIds![i] ? ep : { ...ep, photoId: u.extraPhotoIds![i]! }))
        }
        return next
      }))
      const cloudItems = items
        .map((it) => {
          const u = uploaded.find((x) => x.itemId === it.id)
          const photoId = it.photoId || u?.photoId
          if (!photoId) return null
          const extraPhotos = it.extraPhotos
            ?.map((ep, i) => {
              const id = ep.photoId || u?.extraPhotoIds?.[i]
              return id ? { photoId: id, caption: ep.caption } : null
            })
            .filter((ep): ep is { photoId: string; caption: string | undefined } => !!ep)
          return {
            photoId, note: it.note || undefined, room: it.room || undefined,
            planId: it.planId, planName: it.planName, planPin: it.planPin,
            title: it.title, remark: it.remark, photoCaption: it.photoCaption,
            category: it.category, severity: it.severity,
            standardIds: it.standardIds, extraPhotos,
          }
        })
        .filter((it): it is NonNullable<typeof it> => !!it)

      if (cloudItems.length > 0) {
        await api.put(`/projects/${projectId}/field-report-draft`, {
          type: reportType,
          title: customTitle || undefined,
          items: cloudItems,
          metadata: metadataPayload(),
        })
        cloudSynced = true
      }
    } catch {
      // אין אינטרנט או שגיאת שרת זמנית — לא קריטי, הטיוטה המקומית היא רשת הביטחון
    }

    setDraftSavedMsg(cloudSynced
      ? 'הטיוטה נשמרה במכשיר ובענן — נגישה גם ממחשב אחר. זו עדיין טיוטה: כדי שהדוח יופיע ב"דוחות" יש ללחוץ "סיום והפקת דוח"'
      : 'הטיוטה נשמרה במכשיר (בלי קליטה כרגע — תסונכרן לענן אוטומטית כשתהיה). כדי שהדוח יופיע ב"דוחות" יש ללחוץ "סיום והפקת דוח"')
    setTimeout(() => setDraftSavedMsg(''), 10000)
  }

  async function resumeDraft() {
    if (!draftInfo) return
    if (draftInfo.source === 'cloud' && cloudDraftItems) {
      setReportType(draftInfo.type)
      setCustomTitle(cloudDraftTitle)
      setItems(cloudDraftItems.map((it: any) => ({
        id: `${Date.now()}-${Math.random()}`,
        photoId: it.photoId,
        photoCaption: it.photoCaption,
        previewUrl: absoluteUrl(it.photoUrl),
        note: it.note || '',
        room: it.room || '',
        planId: it.planId,
        planName: it.planName,
        planPin: it.planPin,
        title: it.title,
        remark: it.remark,
        category: it.category,
        severity: it.severity,
        standardIds: it.standardIds,
        extraPhotos: (it.extraPhotos ?? []).map((ep: any) => ({ photoId: ep.photoId, previewUrl: absoluteUrl(ep.url), caption: ep.caption })),
      })))
      setPropertyDetails(cloudDraftMetadata ? { ...EMPTY_PROPERTY_DETAILS, ...cloudDraftMetadata } : EMPTY_PROPERTY_DETAILS)
      setReportHeader(headerFromMetadata(cloudDraftMetadata))
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
        title: it.title,
        remark: it.remark,
        photoCaption: it.photoCaption,
        category: it.category,
        severity: it.severity,
        standardIds: it.standardIds,
        extraPhotos: (it.extraPhotos ?? []).map((ep) => ({
          file: new File([ep.blob], ep.fileName, { type: ep.fileType }),
          previewUrl: URL.createObjectURL(ep.blob),
          caption: ep.caption,
        })),
      })))
      setPropertyDetails(d.metadata ? { ...EMPTY_PROPERTY_DETAILS, ...d.metadata } : EMPTY_PROPERTY_DETAILS)
      setReportHeader(headerFromMetadata(d.metadata))
    }
    setPropertyDetailsOpen(false)
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

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPendingTitle(e.target.value)
    setMatchedTemplateId(null)
    setTitleSuggestOpen(true)
  }

  function selectTemplate(t: FindingTemplate) {
    setPendingTitle(t.title)
    setPendingNote(t.recommendation)
    setPendingCategory(t.category || '')
    setPendingStandardIds(t.standardIds || [])
    setMatchedTemplateId(t.id)
    setTitleSuggestOpen(false)
  }

  function toggleStandardSelection(id: string) {
    setPendingStandardIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function saveNewStandardInline() {
    if (!newStandardForm.code.trim()) return
    setSavingStandard(true)
    try {
      const res = await api.post<{ data: Standard }>('/standards', {
        sourceType: newStandardForm.sourceType,
        code: newStandardForm.code,
        category: pendingCategory || undefined,
      })
      qc.invalidateQueries({ queryKey: ['standards'] })
      setPendingStandardIds((prev) => [...prev, res.data.id])
      setNewStandardForm({ sourceType: 'STANDARD', code: '' })
      setNewStandardOpen(false)
    } finally {
      setSavingStandard(false)
    }
  }

  function handleExtraPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingExtraPhotos((prev) => [...prev, { file, previewUrl: URL.createObjectURL(file) }])
    e.target.value = ''
  }

  function removeExtraPhoto(idx: number) {
    setPendingExtraPhotos((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateExtraPhotoCaption(idx: number, caption: string) {
    setPendingExtraPhotos((prev) => prev.map((ep, i) => (i === idx ? { ...ep, caption } : ep)))
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
      ...(isHomeInspection ? {
        title: pendingTitle || undefined,
        remark: pendingRemark || undefined,
        photoCaption: pendingPhotoCaption || undefined,
        category: pendingCategory || undefined,
        severity: pendingSeverity || undefined,
        standardIds: pendingStandardIds.length ? pendingStandardIds : undefined,
        extraPhotos: pendingExtraPhotos.length ? pendingExtraPhotos : undefined,
      } : {}),
      ...(isFieldReport ? {
        category: pendingCategory || undefined,
        extraPhotos: pendingExtraPhotos.length ? pendingExtraPhotos : undefined,
      } : {}),
    }])

    // שמירת ממצא חדש כתבנית לשימוש עתידי — רק אם המשתמש ביקש וזה לא ממצא שכבר הגיע מהספרייה
    if (isHomeInspection && saveAsTemplate && !matchedTemplateId && pendingTitle.trim() && pendingNote.trim()) {
      api.post('/finding-templates', {
        title: pendingTitle,
        category: pendingCategory || undefined,
        recommendation: pendingNote,
        standardIds: pendingStandardIds,
      }).then(() => qc.invalidateQueries({ queryKey: ['finding-templates'] })).catch(() => {})
    }

    setPendingPhoto(null)
    setPendingNote('')
    setPendingRemark('')
    setPendingPhotoCaption('')
    setPendingRoom('')
    setIsCustomRoom(false)
    setPendingTitle('')
    setPendingCategory('')
    setPendingSeverity('')
    setPendingStandardIds([])
    setPendingExtraPhotos([])
    setMatchedTemplateId(null)
    setSaveAsTemplate(false)
    setNewStandardOpen(false)
    setPlanDialogOpen(false)
    setActivePlan(null)
  }

  // עריכת ממצא קיים — פועל על העותק הזמני (editDraft)
  function replaceDraftPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    // photoId מתאפס כדי שהתמונה החדשה תועלה בהפקה
    updateDraft({ file, previewUrl: URL.createObjectURL(file), photoId: undefined })
  }

  // ציור על התמונה הראשית — תמונה שכבר בשרת נטענת דרך ה-proxy (same-origin) כדי שאפשר יהיה לצייר עליה
  async function openDraftAnnotator() {
    if (!editDraft) return
    if (editDraft.file) {
      setEditAnnotateFile(editDraft.file)
      return
    }
    setAnnotateLoading(true)
    setEditError('')
    try {
      const name = editDraft.previewUrl.split('?')[0].split('/').pop() || ''
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      setEditAnnotateFile(new File([blob], name || 'photo.jpg', { type: blob.type || 'image/jpeg' }))
    } catch {
      setEditError('טעינת התמונה לסימון נכשלה — בדוק את החיבור ונסה שוב')
    } finally {
      setAnnotateLoading(false)
    }
  }

  function openPlanForEdit() {
    setPlanForEdit(true)
    setPlanDialogOpen(true)
  }

  function removeDraftPlan() {
    updateDraft({ planId: undefined, planName: undefined, planUrl: undefined, planPin: undefined, planPhotoId: undefined })
  }

  function addDraftExtraPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const photo: ExtraPhoto = { file, previewUrl: URL.createObjectURL(file) }
    setEditDraft((d) => (d ? { ...d, extraPhotos: [...(d.extraPhotos ?? []), photo] } : d))
  }

  function removeDraftExtraPhoto(idx: number) {
    setEditDraft((d) => (d ? { ...d, extraPhotos: (d.extraPhotos ?? []).filter((_, i) => i !== idx) } : d))
  }

  function updateDraftExtraPhotoCaption(idx: number, caption: string) {
    setEditDraft((d) => (d ? { ...d, extraPhotos: (d.extraPhotos ?? []).map((ep, i) => (i === idx ? { ...ep, caption } : ep)) } : d))
  }

  // שינוי סדר ממצא — בתוך אותו מקצוע כשהרשימה מקובצת לפי מקצועות
  function canMove(id: string, dir: -1 | 1) {
    const i = displayItems.findIndex((it) => it.id === id)
    const j = i + dir
    if (i === -1 || j < 0 || j >= displayItems.length) return false
    return !groupByTrade || (displayItems[i].category || '') === (displayItems[j].category || '')
  }

  function moveItem(id: string, dir: -1 | 1) {
    if (!canMove(id, dir)) return
    const i = displayItems.findIndex((it) => it.id === id)
    const a = displayItems[i].id
    const b = displayItems[i + dir].id
    setItems((prev) => {
      const next = [...prev]
      const ia = next.findIndex((it) => it.id === a)
      const ib = next.findIndex((it) => it.id === b)
      ;[next[ia], next[ib]] = [next[ib], next[ia]]
      return next
    })
  }

  function planUrlFor(planId: string | undefined) {
    const plan = planId ? plans.find((d: any) => d.id === planId) : undefined
    return plan ? absoluteUrl(plan.url) : undefined
  }

  // לוגו לדוח הזה בלבד — לא משנה את לוגו הארגון
  async function uploadReportLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLogoUploading(true)
    setLogoError('')
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await api.upload<{ data: { url: string } }>('/organization/report-logo', fd)
      setReportHeader((h) => ({ ...h, logoMode: 'custom', logoUrl: res.data.url }))
    } catch (err: any) {
      setLogoError(err.message || 'העלאת הלוגו נכשלה')
    } finally {
      setLogoUploading(false)
    }
  }

  function removeItem(id: string) {
    if (editDraft?.id === id) cancelEditItem()
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function finish() {
    if (!reportType || items.length === 0 || finishing) return
    setFinishing(true)
    setErrorMsg('')
    setDraftSavedMsg('')
    setProgressMsg(`מעלה ${items.length} תמונות ומפיק את הדוח... זה יכול לקחת עד דקה, נא להישאר במסך`)
    try {
      if (reportType === 'DEFECTS') {
        await mapSeq(items, async (item) => {
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
        })
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
        const reportItems = await mapSeq(items, async (item, idx) => {
          setProgressMsg(`מעלה תמונה ${idx + 1} מתוך ${items.length}... נא להישאר במסך`)
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
          }

          // תמונת תוכנית מסומנת — מוצמדת לאותו ממצא ולא נספרת בנפרד. נוצרת כשעדיין אין:
          // ממצא חדש, מיקום ששונה בעריכה, או טיוטה ששוחזרה (שם אין planUrl — לוקחים מרשימת התוכניות)
          const planUrl = item.planUrl || planUrlFor(item.planId)
          if (!planPhotoId && planUrl && item.planPin) {
            const blob = await generateAnnotatedPlanImage(planUrl, item.planPin)
            if (blob) {
              const planFd = new FormData()
              planFd.append('file', new File([blob], 'plan-annotation.jpg', { type: 'image/jpeg' }))
              planFd.append('projectId', projectId)
              planFd.append('caption', `מיקום על תוכנית: ${item.planName || ''}`)
              const planRes = await api.upload<{ data: any }>('/photos/upload', planFd)
              planPhotoId = planRes.data.id as string
            }
          }

          // תמונות נוספות — מעלים רק אלה שעדיין קבצים מקומיים, שומרים כיתוב לכל אחת
          let extraPhotos: { photoId: string; caption?: string }[] | undefined
          let uploadedExtras: ({ photoId: string; caption?: string } | null)[] = []
          if (item.extraPhotos?.length) {
            uploadedExtras = await mapSeq(item.extraPhotos, async (ep) => {
              if (ep.photoId) return { photoId: ep.photoId, caption: ep.caption }
              if (!ep.file) return null
              const fd = new FormData()
              fd.append('file', ep.file)
              fd.append('projectId', projectId)
              const res = await api.upload<{ data: any }>('/photos/upload', fd)
              return { photoId: res.data.id as string, caption: ep.caption }
            })
            extraPhotos = uploadedExtras.filter((ep): ep is { photoId: string; caption: string | undefined } => !!ep)
          }

          // שומרים את מזהי התמונות שהועלו על הממצא — אם ההפקה נכשלת באמצע, לחיצה חוזרת ממשיכה מאותה נקודה ולא מעלה שוב
          const newExtraIds = (item.extraPhotos ?? []).some((ep, i) => !ep.photoId && uploadedExtras[i])
          if (photoId !== item.photoId || planPhotoId !== item.planPhotoId || newExtraIds) {
            const ids = { photoId, planPhotoId }
            const extras = item.extraPhotos?.map((ep, i) => (ep.photoId || !uploadedExtras[i] ? ep : { ...ep, photoId: uploadedExtras[i]!.photoId }))
            setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ...ids, extraPhotos: extras } : it)))
          }

          return {
            photoId: photoId!,
            photoCaption: isHomeInspection ? (item.photoCaption || undefined) : undefined,
            planPhotoId,
            note: isHomeInspection ? undefined : (item.note || undefined),
            recommendation: isHomeInspection ? (item.note || undefined) : undefined,
            title: isHomeInspection ? (item.title || undefined) : undefined,
            remark: isHomeInspection ? (item.remark || undefined) : undefined,
            category: (isHomeInspection || isFieldReport) ? (item.category || undefined) : undefined,
            severity: isHomeInspection ? (item.severity || undefined) : undefined,
            standardIds: isHomeInspection ? item.standardIds : undefined,
            extraPhotos,
            room: item.room || undefined,
            planId: item.planId,
            planName: item.planName,
            planPin: item.planPin,
          }
        })
        const validItems = reportItems.filter((it) => it.photoId)
        setProgressMsg('כל התמונות הועלו — מפיק את קובץ ה-PDF... זה יכול לקחת עד דקה')
        const reportRes = editReportId
          ? await api.put<{ data: any }>(`/projects/${projectId}/field-report/${editReportId}`, {
              title: customTitle || undefined,
              items: validItems,
              metadata: metadataPayload(),
            })
          : await api.post<{ data: any }>(`/projects/${projectId}/field-report`, {
              type: reportType,
              title: customTitle || undefined,
              items: validItems,
              metadata: metadataPayload(),
            })
        setResultReport(reportRes.data)
      }
      if (isFieldReport) rememberBranding(authUser?.id, reportHeader)
      // הדוח הופק — מוחקים את הטיוטה השמורה (מקומית וגם בענן)
      deleteDraft(projectId).catch(() => {})
      api.delete(`/projects/${projectId}/field-report-draft`).catch(() => {})
      setDraftInfo(null)
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בהפקת הדוח')
    } finally {
      setFinishing(false)
      setProgressMsg('')
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
    setPendingTitle('')
    setPendingRemark('')
    setPendingPhotoCaption('')
    setPendingCategory('')
    setPendingSeverity('')
    setPendingStandardIds([])
    setPendingExtraPhotos([])
    setMatchedTemplateId(null)
    setSaveAsTemplate(false)
    setNewStandardOpen(false)
    setPropertyDetails(EMPTY_PROPERTY_DETAILS)
    setReportHeader(EMPTY_REPORT_HEADER)
    setHeaderOpen(false)
    setEditDraft(null)
    setEditAnnotateFile(null)
    setPlanForEdit(false)
    setPropertyDetailsOpen(false)
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
                onClick={() => {
                  setReportType(value)
                  if (value === 'HOME_INSPECTION') setPropertyDetailsOpen(true)
                  if (value === 'INSPECTION' || value === 'HANDOVER') setReportHeader({ ...EMPTY_REPORT_HEADER, ...loadRememberedBranding(authUser?.id) })
                }}
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
              <div className="flex items-center gap-3">
                {isHomeInspection && !propertyDetailsOpen && (
                  <button onClick={() => setPropertyDetailsOpen(true)} className="text-xs text-primary hover:underline">
                    ערוך פרטי נכס
                  </button>
                )}
                {isFieldReport && !headerOpen && (
                  <button onClick={() => setHeaderOpen(true)} className="text-xs text-primary hover:underline">
                    ערוך כותרת, לוגו וחתימה
                  </button>
                )}
                {editReportId ? (
                  <button onClick={() => router.push(`/reports?project=${projectId}`)} className="text-xs text-gray-400 hover:text-danger">
                    בטל עריכה
                  </button>
                ) : (
                  <button onClick={resetAll} className="text-xs text-gray-400 hover:text-danger">החלף סוג דוח</button>
                )}
              </div>
            </div>

            {/* כותרת הדוח — דוח פיקוח/מסירה; שדה ריק = ברירת המחדל שמוצגת בו */}
            {isFieldReport && headerOpen && (
              <div className="card space-y-3">
                <h3 className="font-semibold text-neutral-dark text-sm">כותרת הדוח</h3>
                <Input
                  label="כותרת"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={`${typeInfo?.label} — ${project?.name || 'שם הפרויקט'}`}
                />
                <Input
                  label="תאריך הביקור"
                  type="date"
                  value={reportHeader.visitDate}
                  onChange={(e) => setReportHeader((h) => ({ ...h, visitDate: e.target.value }))}
                />
                <Input
                  label="שם הפרויקט בדוח"
                  value={reportHeader.projectName}
                  onChange={(e) => setReportHeader((h) => ({ ...h, projectName: e.target.value }))}
                  placeholder={project?.name || ''}
                />
                <Input
                  label="כתובת"
                  value={reportHeader.projectAddress}
                  onChange={(e) => setReportHeader((h) => ({ ...h, projectAddress: e.target.value }))}
                  placeholder={project?.address || ''}
                />
                <Input
                  label="קבלן מבצע"
                  value={reportHeader.contractorName}
                  onChange={(e) => setReportHeader((h) => ({ ...h, contractorName: e.target.value }))}
                />
                <Input
                  label="נוכחים בסיור"
                  value={reportHeader.attendees}
                  onChange={(e) => setReportHeader((h) => ({ ...h, attendees: e.target.value }))}
                  placeholder="למשל: מנהל עבודה, נציג היזם"
                />
                <Textarea
                  label="הערות כלליות (יופיעו בראש הדוח)"
                  value={reportHeader.generalNotes}
                  onChange={(e) => setReportHeader((h) => ({ ...h, generalNotes: e.target.value }))}
                />

                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <h3 className="font-semibold text-neutral-dark text-sm">מיתוג הדוח</h3>
                  <div>
                    <label className="text-sm font-medium text-neutral-dark">לוגו בראש הדוח</label>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {LOGO_MODES.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setReportHeader((h) => ({ ...h, logoMode: m.value }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            reportHeader.logoMode === m.value
                              ? 'bg-primary text-white border-primary'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      {((reportHeader.logoMode === 'org' && org?.logo) || (reportHeader.logoMode === 'custom' && reportHeader.logoUrl)) && (
                        <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                          <img
                            src={absoluteUrl(reportHeader.logoMode === 'custom' ? reportHeader.logoUrl : org.logo)}
                            alt="לוגו בדוח"
                            className="w-full h-full object-contain p-1"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 text-xs text-gray-500">
                        {reportHeader.logoMode === 'org' && (org?.logo ? 'הלוגו שמוגדר בהגדרות הארגון' : 'לא הוגדר לוגו לחברה — יוצג שם העסק')}
                        {reportHeader.logoMode === 'none' && 'בראש הדוח יוצג שם העסק בלבד'}
                        {reportHeader.logoMode === 'custom' && (
                          <label className="inline-flex items-center gap-1.5 font-medium text-primary border border-primary/30 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-primary-50">
                            <Plus size={13} />
                            {logoUploading ? 'מעלה...' : reportHeader.logoUrl ? 'החלף לוגו' : 'העלה לוגו'}
                            <input type="file" accept="image/*" className="hidden" disabled={logoUploading} onChange={uploadReportLogo} />
                          </label>
                        )}
                        {reportHeader.logoMode === 'custom' && !reportHeader.logoUrl && !logoUploading && (
                          <p className="mt-1 text-amber-700">עדיין לא הועלה לוגו — בלי לוגו יוצג שם העסק</p>
                        )}
                      </div>
                    </div>
                    {logoError && <p className="text-xs text-danger mt-1">{logoError}</p>}
                    <p className="text-xs text-gray-400 mt-1.5">
                      "לוגו אחר" משנה רק את הדוחות שלך. להחלפת הלוגו בכל הדוחות של הארגון:{' '}
                      <Link href="/settings/organization" className="underline text-primary">הגדרות ארגון</Link>
                    </p>
                  </div>
                  <Input
                    label="שם העסק בדוח"
                    value={reportHeader.companyName}
                    onChange={(e) => setReportHeader((h) => ({ ...h, companyName: e.target.value }))}
                    placeholder={org?.name || ''}
                  />
                  <Input
                    label="כותרת תחתונה (בתחתית כל עמוד)"
                    value={reportHeader.footerText}
                    onChange={(e) => setReportHeader((h) => ({ ...h, footerText: e.target.value }))}
                    placeholder={autoFooter}
                  />
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-3">
                  <h3 className="font-semibold text-neutral-dark text-sm">חתימה בסוף הדוח</h3>
                  <Input
                    label="שם החותם"
                    value={reportHeader.signerName}
                    onChange={(e) => setReportHeader((h) => ({ ...h, signerName: e.target.value }))}
                    placeholder={authUser?.name || brandName}
                  />
                  <Input
                    label="תפקיד"
                    value={reportHeader.signerTitle}
                    onChange={(e) => setReportHeader((h) => ({ ...h, signerTitle: e.target.value }))}
                    placeholder="למשל: מפקח בנייה"
                  />
                  <Input
                    label="טלפון"
                    value={reportHeader.signerPhone}
                    onChange={(e) => setReportHeader((h) => ({ ...h, signerPhone: e.target.value }))}
                    placeholder={reportHeader.companyName.trim() ? '' : (org?.phone || '')}
                  />
                  <p className="text-xs text-gray-400">אחרי הפקת הדוח, המיתוג והחתימה יוצעו אוטומטית בדוח הבא שלך במכשיר הזה.</p>
                </div>

                <Button onClick={() => setHeaderOpen(false)} className="w-full">
                  <Check size={14} />
                  סיום עריכת כותרת
                </Button>
              </div>
            )}

            {/* פרטי מזמין/ביקור/נכס — נלכדים פעם אחת לדוח, לפני תיעוד הממצאים */}
            {isHomeInspection && propertyDetailsOpen ? (
              <div className="card space-y-4">
                <h3 className="font-semibold text-neutral-dark text-sm">פרטי מזמין וביקור</h3>
                <Input
                  label="לכבוד (שם המזמין)"
                  value={propertyDetails.clientName}
                  onChange={(e) => setPropertyDetails((p) => ({ ...p, clientName: e.target.value }))}
                />
                <Input
                  label="תאריך ביקור בנכס"
                  type="date"
                  value={propertyDetails.visitDate}
                  onChange={(e) => setPropertyDetails((p) => ({ ...p, visitDate: e.target.value }))}
                />

                <h3 className="font-semibold text-neutral-dark text-sm pt-2 border-t border-gray-50">תיאור הנכס</h3>
                <Input
                  label="סוג הנכס"
                  value={propertyDetails.propertyType}
                  onChange={(e) => setPropertyDetails((p) => ({ ...p, propertyType: e.target.value }))}
                  placeholder="דירת מגורים, 5 חדרים"
                />
                <Textarea
                  label="הנכס כולל (רשימת חדרים)"
                  value={propertyDetails.roomsIncluded}
                  onChange={(e) => setPropertyDetails((p) => ({ ...p, roomsIncluded: e.target.value }))}
                  placeholder="חדר דיור (סלון), מטבח, מרפסת שמש, חדר שינה 1..."
                />
                <Input
                  label="הנכס מאוכלס"
                  value={propertyDetails.occupied}
                  onChange={(e) => setPropertyDetails((p) => ({ ...p, occupied: e.target.value }))}
                  placeholder="כן / לא"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-neutral-dark">חיבור לחשמל</label>
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setPropertyDetails((p) => ({ ...p, electricityConnected: true }))}
                        className={`flex-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${propertyDetails.electricityConnected === true ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      >יש</button>
                      <button
                        type="button"
                        onClick={() => setPropertyDetails((p) => ({ ...p, electricityConnected: false }))}
                        className={`flex-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${propertyDetails.electricityConnected === false ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      >אין</button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-neutral-dark">חיבור למים</label>
                    <div className="flex gap-2 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setPropertyDetails((p) => ({ ...p, waterConnected: true }))}
                        className={`flex-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${propertyDetails.waterConnected === true ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      >יש</button>
                      <button
                        type="button"
                        onClick={() => setPropertyDetails((p) => ({ ...p, waterConnected: false }))}
                        className={`flex-1 text-xs px-2.5 py-1.5 rounded-full border transition-colors ${propertyDetails.waterConnected === false ? 'bg-primary text-white border-primary' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                      >אין</button>
                    </div>
                  </div>
                </div>
                <Textarea
                  label="הערות גורפות לדוח"
                  value={propertyDetails.generalNotes}
                  onChange={(e) => setPropertyDetails((p) => ({ ...p, generalNotes: e.target.value }))}
                />

                <Button onClick={() => setPropertyDetailsOpen(false)} className="w-full">
                  המשך לתיעוד ממצאים
                </Button>
              </div>
            ) : (
            <>
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

                {/* כיתוב לתמונה הראשית — דוח בדק בית בלבד */}
                {isHomeInspection && (
                  <input
                    value={pendingPhotoCaption}
                    onChange={(e) => setPendingPhotoCaption(e.target.value)}
                    placeholder="כיתוב לתמונה (אופציונלי, למשל: שריטה על אלומיניום מעקה)"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                  />
                )}

                {/* מקצוע — דוח פיקוח/מסירה; הדוח מסודר לפי מקצועות */}
                {isFieldReport && (
                  <Select
                    label="מקצוע"
                    value={pendingCategory}
                    onChange={(e) => setPendingCategory(e.target.value)}
                    options={TRADE_OPTIONS}
                  />
                )}

                {/* תמונות נוספות לאותו ממצא */}
                {supportsExtraPhotos && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">תמונות נוספות לממצא זה (אופציונלי)</p>
                    <div className="space-y-2">
                      {pendingExtraPhotos.map((ep, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <img src={ep.previewUrl} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                          <input
                            value={ep.caption || ''}
                            onChange={(e) => updateExtraPhotoCaption(i, e.target.value)}
                            placeholder="כיתוב לתמונה..."
                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
                          />
                          <button onClick={() => removeExtraPhoto(i)} className="p-1.5 text-gray-400 hover:text-danger shrink-0">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                      <label className="flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary/40 transition-colors text-xs text-gray-500">
                        <Plus size={14} />
                        הוסף תמונה נוספת
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleExtraPhotoPicked} />
                      </label>
                    </div>
                  </div>
                )}

                {/* כותרת ממצא עם auto-complete — דוח בדק בית בלבד */}
                {isHomeInspection && (
                  <div className="relative">
                    <label className="text-sm font-medium text-neutral-dark">כותרת הממצא</label>
                    <div className="relative mt-1">
                      <input
                        value={pendingTitle}
                        onChange={handleTitleChange}
                        onFocus={() => setTitleSuggestOpen(true)}
                        onBlur={() => setTimeout(() => { setTitleSuggestOpen(false); setBrowseCategoryOpen(false) }, 150)}
                        placeholder="התחל להקליד... (למשל: משקוף דלת אינו צבוע)"
                        className={`w-full text-sm border border-gray-300 rounded-lg pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary ${pendingCategory ? 'pl-9' : 'pl-3'}`}
                      />
                      {pendingCategory && (
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); setBrowseCategoryOpen((v) => !v); setTitleSuggestOpen(false) }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-primary"
                          title="הצג את כל הממצאים בקטגוריה זו"
                        >
                          <ChevronDown size={16} className={browseCategoryOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                      )}
                    </div>
                    {browseCategoryOpen && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                        {categoryTemplates.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-gray-400">אין עדיין ממצאים בספרייה עבור קטגוריה זו</p>
                        ) : (
                          categoryTemplates.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onMouseDown={() => { selectTemplate(t); setBrowseCategoryOpen(false) }}
                              className="w-full text-right px-3 py-2 text-sm hover:bg-primary-50 border-b border-gray-50 last:border-0"
                            >
                              {t.title}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {!browseCategoryOpen && titleSuggestOpen && titleSuggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {titleSuggestions.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onMouseDown={() => selectTemplate(t)}
                            className="w-full text-right px-3 py-2 text-sm hover:bg-primary-50 border-b border-gray-50 last:border-0"
                          >
                            {t.title}
                          </button>
                        ))}
                      </div>
                    )}
                    {matchedTemplateId && (
                      <p className="text-xs text-green-600 mt-1">✓ מולא אוטומטית מהספרייה — ניתן לערוך</p>
                    )}
                  </div>
                )}

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

                {/* קטגוריה + חומרה — דוח בדק בית בלבד */}
                {isHomeInspection && (
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="קטגוריה"
                      value={pendingCategory}
                      onChange={(e) => setPendingCategory(e.target.value)}
                      options={[{ value: '', label: 'כללי' }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]}
                    />
                    <div>
                      <label className="text-sm font-medium text-neutral-dark">חומרה</label>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {SEVERITIES.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => setPendingSeverity(pendingSeverity === s.value ? '' : s.value)}
                            className={`text-xs px-2 py-1.5 rounded-full border transition-colors ${
                              pendingSeverity === s.value
                                ? 'bg-primary text-white border-primary'
                                : `${SEVERITY_COLORS[s.value]} border-transparent`
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* בורר תקנים — דוח בדק בית בלבד */}
                {isHomeInspection && (
                  <div>
                    <label className="text-sm font-medium text-neutral-dark">תקנים משויכים</label>
                    <StandardChipPicker
                      standards={relevantStandards}
                      searchPool={standards}
                      selectedIds={pendingStandardIds}
                      onToggle={toggleStandardSelection}
                      extra={
                        <button
                          type="button"
                          onClick={() => setNewStandardOpen((v) => !v)}
                          className="text-xs px-2.5 py-1 rounded-full border border-dashed border-primary/40 text-primary flex items-center gap-1"
                        >
                          <Plus size={11} />
                          הוסף תקן חדש
                        </button>
                      }
                    />
                    {newStandardOpen && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex gap-1.5 flex-wrap">
                          {SOURCE_TYPES.map((t) => (
                            <button
                              key={t.value}
                              type="button"
                              onClick={() => setNewStandardForm((f) => ({ ...f, sourceType: t.value }))}
                              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                newStandardForm.sourceType === t.value ? 'bg-primary text-white border-primary' : `${t.color} border-transparent`
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            value={newStandardForm.code}
                            onChange={(e) => setNewStandardForm((f) => ({ ...f, code: e.target.value }))}
                            placeholder="תקן 1205 חלק 3 סעיף..."
                            className="flex-1 text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
                          />
                          <Button size="sm" onClick={saveNewStandardInline} loading={savingStandard} disabled={!newStandardForm.code.trim()}>
                            הוסף
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400">אפשר להוסיף תמונות רפרנס (נוסח תקן/פסיקה) מאוחר יותר במסך "ספריית תקנים"</p>
                      </div>
                    )}
                  </div>
                )}

                <Textarea
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder={isHomeInspection ? 'המלצה — מה יש לתקן...' : 'כתוב ממצא לתמונה הזו...'}
                />

                {isHomeInspection && (
                  <Textarea
                    value={pendingRemark}
                    onChange={(e) => setPendingRemark(e.target.value)}
                    placeholder="הערה נוספת (אופציונלי)..."
                  />
                )}

                {isHomeInspection && !matchedTemplateId && pendingTitle.trim() && pendingNote.trim() && (
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAsTemplate}
                      onChange={(e) => setSaveAsTemplate(e.target.checked)}
                      className="w-3.5 h-3.5 accent-primary"
                    />
                    שמור ממצא זה כתבנית לשימוש חוזר בדוחות הבאים
                  </label>
                )}

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
                {displayItems.map((item, idx) => (
                  <div key={item.id} className="space-y-2">
                  {groupByTrade && (idx === 0 || (displayItems[idx - 1].category || '') !== (item.category || '')) && (
                    <p className="text-sm font-semibold text-primary pt-2 border-b border-primary/20 pb-1">
                      {item.category ? CATEGORY_LABELS[item.category] || item.category : 'כללי'}
                    </p>
                  )}
                  <div className="card space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <img src={item.previewUrl} className="w-16 h-16 object-cover rounded-lg" />
                        {(item.extraPhotos?.length ?? 0) > 0 && (
                          <span className="absolute -bottom-1 -left-1 bg-primary text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            +{item.extraPhotos!.length}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {item.room && (
                            <span className="text-xs bg-primary-50 text-primary px-2 py-0.5 rounded-full">
                              {item.room}
                            </span>
                          )}
                          {isFieldReport && !groupByTrade && item.category && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              {CATEGORY_LABELS[item.category] || item.category}
                            </span>
                          )}
                          {item.severity && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_COLORS[item.severity]}`}>
                              {SEVERITY_LABELS[item.severity]}
                            </span>
                          )}
                          {(item.standardIds?.length ?? 0) > 0 && (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <BookMarked size={10} />
                              {item.standardIds!.length}
                            </span>
                          )}
                          {item.planName && (
                            <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <MapPin size={10} />
                              {item.planName}{item.planPin ? ' ✓' : ''}
                            </span>
                          )}
                        </div>
                        {item.title && (
                          <p className="text-sm font-medium text-neutral-dark line-clamp-1">{item.title}</p>
                        )}
                        {editDraft?.id !== item.id && (
                          <p className={`text-gray-600 line-clamp-2 ${item.title ? 'text-xs text-gray-500 mt-0.5' : 'text-sm'}`}>
                            {item.note || (item.title ? '' : '(ללא הערה)')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        {items.length > 1 && (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => moveItem(item.id, -1)}
                              disabled={busy || !canMove(item.id, -1)}
                              aria-label="הזז למעלה"
                              className="p-1.5 text-gray-400 hover:text-primary disabled:opacity-25 disabled:hover:text-gray-400"
                            >
                              <ChevronUp size={15} />
                            </button>
                            <button
                              onClick={() => moveItem(item.id, 1)}
                              disabled={busy || !canMove(item.id, 1)}
                              aria-label="הזז למטה"
                              className="p-1.5 text-gray-400 hover:text-primary disabled:opacity-25 disabled:hover:text-gray-400"
                            >
                              <ChevronDown size={15} />
                            </button>
                          </div>
                        )}
                        <div className="flex flex-col gap-1">
                          <button onClick={() => startEditItem(item)} disabled={busy} aria-label="ערוך ממצא" className="p-1.5 text-gray-400 hover:text-primary disabled:opacity-25">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => removeItem(item.id)} disabled={busy} aria-label="מחק ממצא" className="p-1.5 text-gray-400 hover:text-danger disabled:opacity-25">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {editDraft?.id === item.id && (
                      <div className="space-y-3 border-t border-gray-100 pt-3">
                        {/* תמונה ראשית — החלפה או ציור/סימון */}
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">תמונה ראשית</p>
                          <div className="flex items-center gap-3">
                            <img src={editDraft.previewUrl} className="w-20 h-20 object-cover rounded-lg shrink-0" />
                            <div className="flex flex-col gap-1.5 flex-1">
                              <label className="flex items-center justify-center gap-1.5 text-xs font-medium border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
                                <Camera size={13} />
                                החלף תמונה
                                <input type="file" accept="image/*" className="hidden" onChange={replaceDraftPhoto} />
                              </label>
                              <button
                                type="button"
                                onClick={openDraftAnnotator}
                                disabled={annotateLoading}
                                className="flex items-center justify-center gap-1.5 text-xs font-medium border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
                              >
                                <PenLine size={13} />
                                {annotateLoading ? 'טוען תמונה...' : 'סמן על התמונה'}
                              </button>
                            </div>
                          </div>
                          {isHomeInspection && (
                            <input
                              value={editDraft.photoCaption || ''}
                              onChange={(e) => updateDraft({ photoCaption: e.target.value || undefined })}
                              placeholder="כיתוב לתמונה (אופציונלי)"
                              className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                            />
                          )}
                        </div>

                        {isHomeInspection && (
                          <Input
                            label="כותרת הממצא"
                            value={editDraft.title || ''}
                            onChange={(e) => updateDraft({ title: e.target.value || undefined })}
                          />
                        )}

                        <div>
                          <label className="text-sm font-medium text-neutral-dark">חדר / אזור</label>
                          <input
                            list="field-report-rooms"
                            value={editDraft.room}
                            onChange={(e) => updateDraft({ room: e.target.value })}
                            placeholder="בחר מהרשימה או הקלד..."
                            className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                          />
                        </div>

                        <Textarea
                          label={isHomeInspection ? 'המלצה' : 'ממצא / הערה'}
                          value={editDraft.note}
                          onChange={(e) => updateDraft({ note: e.target.value })}
                          placeholder={isHomeInspection ? 'המלצה...' : 'הערה לממצא...'}
                        />
                        {isHomeInspection && (
                          <Textarea
                            label="הערה נוספת"
                            value={editDraft.remark || ''}
                            onChange={(e) => updateDraft({ remark: e.target.value || undefined })}
                          />
                        )}

                        {isFieldReport && (
                          <Select
                            label="מקצוע"
                            value={editDraft.category || ''}
                            onChange={(e) => updateDraft({ category: e.target.value || undefined })}
                            options={TRADE_OPTIONS}
                          />
                        )}
                        {isHomeInspection && (
                          <div className="grid grid-cols-2 gap-3">
                            <Select
                              label="קטגוריה"
                              value={editDraft.category || ''}
                              onChange={(e) => updateDraft({ category: e.target.value || undefined })}
                              options={[{ value: '', label: 'כללי' }, ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))]}
                            />
                            <div>
                              <label className="text-sm font-medium text-neutral-dark">חומרה</label>
                              <div className="flex gap-1 mt-1.5 flex-wrap">
                                {SEVERITIES.map((sv) => (
                                  <button
                                    key={sv.value}
                                    type="button"
                                    onClick={() => updateDraft({ severity: editDraft.severity === sv.value ? undefined : sv.value })}
                                    className={`text-xs px-2 py-1.5 rounded-full border transition-colors ${
                                      editDraft.severity === sv.value ? 'bg-primary text-white border-primary' : `${SEVERITY_COLORS[sv.value]} border-transparent`
                                    }`}
                                  >
                                    {sv.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* מיקום על תוכנית — שינוי או הסרה; תמונת התוכנית המסומנת תיווצר מחדש בהפקה */}
                        {(plans.length > 0 || editDraft.planName) && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-2">מיקום על תוכנית</p>
                            <div className="flex items-center gap-2">
                              <span className="flex-1 min-w-0 text-sm text-neutral-dark truncate">
                                {editDraft.planName ? `${editDraft.planName}${editDraft.planPin ? ' — מסומן' : ''}` : 'לא סומן'}
                              </span>
                              {plans.length > 0 && (
                                <Button size="sm" variant="outline" onClick={openPlanForEdit}>
                                  <MapPin size={13} />
                                  {editDraft.planName ? 'שנה' : 'סמן'}
                                </Button>
                              )}
                              {editDraft.planName && (
                                <Button size="sm" variant="ghost" onClick={removeDraftPlan}>
                                  <X size={13} />
                                  הסר
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {supportsExtraPhotos && (
                          <div>
                            <p className="text-xs font-medium text-gray-500 mb-2">תמונות נוספות לממצא</p>
                            <div className="space-y-2">
                              {(editDraft.extraPhotos ?? []).map((ep, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <img src={ep.previewUrl} className="w-12 h-12 object-cover rounded-lg shrink-0" />
                                  <input
                                    value={ep.caption || ''}
                                    onChange={(e) => updateDraftExtraPhotoCaption(i, e.target.value)}
                                    placeholder="כיתוב לתמונה..."
                                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-primary"
                                  />
                                  <button onClick={() => removeDraftExtraPhoto(i)} aria-label="הסר תמונה" className="p-1.5 text-gray-400 hover:text-danger shrink-0">
                                    <X size={14} />
                                  </button>
                                </div>
                              ))}
                              <label className="flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-primary/40 transition-colors text-xs text-gray-500">
                                <Plus size={14} />
                                הוסף תמונה
                                <input type="file" accept="image/*" className="hidden" onChange={addDraftExtraPhoto} />
                              </label>
                            </div>
                          </div>
                        )}

                        {editError && <p className="text-xs text-danger">{editError}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEditItem} className="flex-1">
                            <Check size={13} />
                            שמור שינויים בממצא
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEditItem}>
                            ביטול
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="card space-y-3">
                {isFieldReport ? (
                  <button onClick={() => { setHeaderOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="w-full text-right text-sm border border-gray-200 rounded-lg px-3 py-2.5 hover:border-primary/40">
                    <span className="text-xs text-gray-500 block">כותרת הדוח</span>
                    <span className="text-neutral-dark">{customTitle || `${typeInfo?.label} — ${project?.name || 'שם הפרויקט'}`}</span>
                    <span className="text-xs text-primary block mt-0.5">לחץ לעריכת הכותרת, הלוגו והחתימה</span>
                  </button>
                ) : (
                  <Input
                    label="כותרת מותאמת (אופציונלי)"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder={`${typeInfo?.label} — שם הפרויקט`}
                  />
                )}
                {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}
                {progressMsg && <p className="text-sm text-primary text-center">{progressMsg}</p>}
                {draftSavedMsg && <p className="text-sm text-green-600 text-center">{draftSavedMsg}</p>}
                {editDraft && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-center">
                    יש ממצא בעריכה — לחץ "שמור שינויים בממצא" או "ביטול" לפני הפקת הדוח
                  </p>
                )}
                <Button onClick={finish} loading={finishing} disabled={savingDraft || !!editDraft} className="w-full" size="lg">
                  <FileText size={16} />
                  {editReportId ? `שמור שינויים והפק מחדש (${items.length})` : `סיום והפקת דוח (${items.length})`}
                </Button>
                {!editReportId && (
                  <Button variant="outline" onClick={saveDraftNow} loading={savingDraft} disabled={finishing || !!editDraft} className="w-full">
                    <Save size={15} />
                    שמור טיוטה — המשך מאוחר יותר
                  </Button>
                )}
              </div>
            )}
            </>
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
            onClick={() => { setPlanDialogOpen(false); setPlanForEdit(false) }}
          />
          <div className="relative w-full bg-white rounded-t-2xl p-4 space-y-3 max-h-[75vh] overflow-auto">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />
            <div className="flex items-center gap-2 justify-center">
              <Map size={18} className="text-primary" />
              <p className="font-semibold text-neutral-dark">{planForEdit ? 'בחר תוכנית לסימון המיקום' : 'סמן מיקום על תוכנית?'}</p>
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

            {planForEdit ? (
              <Button
                variant="outline"
                onClick={() => { setPlanDialogOpen(false); setPlanForEdit(false) }}
                className="w-full mt-2"
              >
                ביטול
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => { setPlanDialogOpen(false); doAddItem() }}
                className="w-full mt-2"
              >
                דלג — הוסף ללא סימון על תוכנית
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Full-screen plan pin picker */}
      {activePlan && (
        <PlanPinPicker
          url={activePlan.url}
          planName={activePlan.name}
          onConfirm={(pin) => {
            if (planForEdit) {
              // מיקום חדש לממצא קיים — מאפסים את תמונת התוכנית הישנה כדי שתיווצר מחדש בהפקה
              updateDraft({ planId: activePlan.id, planName: activePlan.name, planUrl: activePlan.url, planPin: pin ?? undefined, planPhotoId: undefined })
              setActivePlan(null)
              setPlanForEdit(false)
            } else {
              doAddItem({ planId: activePlan.id, planName: activePlan.name, planUrl: activePlan.url, planPin: pin })
            }
          }}
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

      {/* ציור על התמונה הראשית של ממצא קיים (מתוך חלון העריכה) */}
      {editAnnotateFile && (
        <PhotoAnnotator
          file={editAnnotateFile}
          onConfirm={(newFile, newPreviewUrl) => {
            updateDraft({ file: newFile, previewUrl: newPreviewUrl, photoId: undefined })
            setEditAnnotateFile(null)
          }}
          onCancel={() => setEditAnnotateFile(null)}
        />
      )}

      <datalist id="field-report-rooms">
        {ROOMS.map((room) => <option key={room} value={room} />)}
      </datalist>
    </AppLayout>
  )
}
