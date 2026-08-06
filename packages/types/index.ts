export type Role = 'OWNER' | 'PROJECT_MANAGER' | 'ENGINEER' | 'SUPERVISOR' | 'CONTRACTOR' | 'CLIENT'

export type ProjectStatus = 'TENDER' | 'PERMIT' | 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'PENDING_APPROVAL' | 'DONE' | 'CANCELLED'
export type DefectStatus = 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type DocumentType = 'PLAN' | 'SPEC' | 'APPROVAL' | 'INVOICE' | 'PROTOCOL' | 'REPORT' | 'OTHER'
export type ReportType = 'DAILY' | 'DEFECTS' | 'TASKS' | 'PROGRESS' | 'HANDOVER' | 'INSPECTION' | 'HOME_INSPECTION'
export type StandardSourceType = 'REGULATION' | 'HALAT' | 'STANDARD'
export type PaymentStatus = 'PENDING' | 'INVOICED' | 'PAID'
export type DefectCategory =
  | 'STRUCTURE' | 'CONCRETE' | 'IRON' | 'WATERPROOFING' | 'PLUMBING'
  | 'ELECTRICAL' | 'HVAC' | 'DRYWALL' | 'FLOORING' | 'CLADDING'
  | 'PAINT' | 'ALUMINUM' | 'CARPENTRY' | 'METALWORK' | 'SAFETY'
  | 'LANDSCAPING'
  | 'DOOR_ENTRANCE' | 'INTERIOR_DOORS_POLYMER' | 'CLEANING' | 'SAFE_ROOM_METALWORK'
  | 'ACCESSIBILITY_SIGNAGE' | 'PLASTER_PAINT_WORK' | 'ELECTRICAL_SAFETY_FIXTURES'
  | 'OTHER'

export interface Organization {
  id: string
  name: string
  logo?: string | null
  phone?: string | null
  address?: string | null
  website?: string | null
  primaryColor?: string | null
  tagline?: string | null
  taxId?: string | null
  createdAt: string
}

export interface User {
  id: string
  email: string
  name: string
  phone?: string | null
  role: Role
  organizationId: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  address: string
  description?: string | null
  developerName?: string | null
  mainContractor?: string | null
  managerId?: string | null
  startDate?: string | null
  targetDate?: string | null
  status: ProjectStatus
  contractAmount?: number | null
  organizationId: string
  createdAt: string
}

export interface PaymentMilestone {
  id: string
  projectId: string
  title: string
  percentage: number
  dueDate?: string | null
  status: PaymentStatus
  paidDate?: string | null
  notes?: string | null
  externalReceiptNumber?: string | null
  order: number
  createdAt: string
}

export interface DailyJournal {
  id: string
  projectId: string
  date: string
  weather?: string | null
  workforce?: number | null
  contractors: string[]
  workDone: string
  equipment?: string | null
  issues?: string | null
  signedBy?: string | null
  signatureUrl?: string | null
  createdById: string
  createdAt: string
  photos?: Photo[]
}

export interface Task {
  id: string
  projectId: string
  title: string
  description?: string | null
  assignedTo?: string | null
  contractorId?: string | null
  dueDate?: string | null
  priority: Priority
  status: TaskStatus
  createdById: string
  createdAt: string
  assignedUser?: User
  contractor?: Contractor
  photos?: Photo[]
  comments?: Comment[]
}

export interface Defect {
  id: string
  projectId: string
  title: string
  location?: string | null
  category: DefectCategory
  description: string
  severity: Severity
  assignedTo?: string | null
  contractorId?: string | null
  dueDate?: string | null
  status: DefectStatus
  createdById: string
  createdAt: string
  beforePhotos?: Photo[]
  afterPhotos?: Photo[]
  comments?: Comment[]
}

export interface Photo {
  id: string
  url: string
  thumbnailUrl?: string | null
  caption?: string | null
  annotations?: PhotoAnnotations | null
  projectId?: string | null
  journalId?: string | null
  taskId?: string | null
  defectId?: string | null
  defectType?: 'before' | 'after' | null
  uploadedById: string
  takenAt: string
}

export interface PhotoAnnotations {
  arrows: Annotation[]
  circles: Annotation[]
  texts: Annotation[]
  rectangles: Annotation[]
}

export interface Annotation {
  id: string
  x: number
  y: number
  width?: number
  height?: number
  text?: string
  color: string
}

export interface Document {
  id: string
  projectId: string
  name: string
  type: DocumentType
  url: string
  version: number
  uploadedById: string
  createdAt: string
}

export interface Contractor {
  id: string
  organizationId: string
  name: string
  trade: string
  contactName?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
  createdAt: string
}

export interface Comment {
  id: string
  content: string
  authorId: string
  taskId?: string | null
  defectId?: string | null
  createdAt: string
  author?: User
}

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  link?: string | null
  read: boolean
  createdAt: string
}

export interface Report {
  id: string
  projectId: string
  type: ReportType
  title: string
  pdfUrl?: string | null
  generatedBy: string
  createdAt: string
}

export interface Receipt {
  id: string
  organizationId: string
  projectId: string
  milestoneId?: string | null
  number: number
  amount: number
  clientName?: string | null
  issueDate: string
  pdfUrl?: string | null
  generatedBy: string
  createdAt: string
}

export interface StandardReference {
  imageUrl: string
  caption: string
}

export interface Standard {
  id: string
  organizationId: string
  sourceType: StandardSourceType
  category?: DefectCategory | null
  code: string
  description?: string | null
  precedenceNote?: string | null
  references?: StandardReference[] | null
  createdAt: string
}

export interface FindingTemplate {
  id: string
  organizationId: string
  title: string
  category?: DefectCategory | null
  recommendation: string
  standardIds: string[]
  createdAt: string
}

export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface AuthResponse {
  token: string
  user: User
  organization: Organization
}
