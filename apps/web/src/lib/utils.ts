import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Files served from local disk return a relative path (/uploads/x) needing the app's origin;
// files served from Cloudflare R2 are already a full URL — don't double-prefix those.
export function absoluteUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  return typeof window !== 'undefined' ? `${window.location.origin}${url}` : url
}

export function formatDate(date: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('he-IL', opts)
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return '—'
  return new Date(date).toLocaleString('he-IL')
}

export const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  PENDING_APPROVAL: 'bg-purple-100 text-purple-700',
  DONE: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
  FIXED: 'bg-green-100 text-green-700',
  VERIFIED: 'bg-teal-100 text-teal-700',
  CLOSED: 'bg-gray-100 text-gray-500',
  TENDER: 'bg-purple-100 text-purple-700',
  PERMIT: 'bg-orange-100 text-orange-700',
  PLANNING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-green-100 text-green-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-teal-100 text-teal-700',
} as const

export const STATUS_LABELS: Record<string, string> = {
  OPEN: 'פתוח',
  IN_PROGRESS: 'בביצוע',
  PENDING_APPROVAL: 'ממתין לאישור',
  DONE: 'הושלם',
  CANCELLED: 'בוטל',
  FIXED: 'תוקן',
  VERIFIED: 'אומת',
  CLOSED: 'סגור',
  TENDER: 'מכרז',
  PERMIT: 'היתר',
  PLANNING: 'תכנון',
  ACTIVE: 'פעיל',
  ON_HOLD: 'מושהה',
  COMPLETED: 'הושלם',
}

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'נמוכה',
  MEDIUM: 'רגילה',
  HIGH: 'גבוהה',
  CRITICAL: 'קריטי',
}

export const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
}

export const CATEGORY_LABELS: Record<string, string> = {
  STRUCTURE: 'שלד', CONCRETE: 'בטון', IRON: 'ברזל', WATERPROOFING: 'איטום',
  PLUMBING: 'אינסטלציה', ELECTRICAL: 'חשמל', HVAC: 'מיזוג', DRYWALL: 'גבס',
  FLOORING: 'ריצוף', CLADDING: 'חיפוי', PAINT: 'צבע', ALUMINUM: 'אלומיניום',
  CARPENTRY: 'נגרות', METALWORK: 'מסגרות', SAFETY: 'בטיחות', LANDSCAPING: 'פיתוח',
  DOOR_ENTRANCE: 'דלת כניסה', INTERIOR_DOORS_POLYMER: 'דלתות פנים - פולימריות',
  CLEANING: 'ניקיון', SAFE_ROOM_METALWORK: 'מסגרות-ממ"ד', ACCESSIBILITY_SIGNAGE: 'נגישות/שילוט/סימון',
  PLASTER_PAINT_WORK: 'עבודות טיח וצבע', ELECTRICAL_SAFETY_FIXTURES: 'אביזרי חשמל ותקשורת/בטיחות',
  OTHER: 'אחר',
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-600',
  INVOICED: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-green-100 text-green-700',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'ממתין',
  INVOICED: 'הופקה חשבונית',
  PAID: 'שולם',
}

export function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount)
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'בעל עסק',
  PROJECT_MANAGER: 'מנהל פרויקט',
  ENGINEER: 'מהנדס ביצוע',
  SUPERVISOR: 'מפקח',
  CONTRACTOR: 'קבלן',
  CLIENT: 'לקוח',
}
