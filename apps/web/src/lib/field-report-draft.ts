// שמירת טיוטות דוח שטח ב-IndexedDB — כולל התמונות עצמן (Blob).
// הטיוטה נשמרת במכשיר בלבד; טיוטה אחת לכל פרויקט.

const DB_NAME = 'sitepilot-drafts'
const STORE = 'field-reports'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export interface DraftItem {
  note: string
  room: string
  planId?: string
  planName?: string
  planUrl?: string
  planPin?: { x: number; y: number }
  fileName: string
  fileType: string
  blob: Blob
}

export interface FieldReportDraft {
  reportType: 'DEFECTS' | 'INSPECTION' | 'HANDOVER'
  customTitle: string
  items: DraftItem[]
  savedAt: number
}

export async function saveDraft(projectId: string, draft: FieldReportDraft): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(draft, projectId)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loadDraft(projectId: string): Promise<FieldReportDraft | null> {
  const db = await openDb()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(projectId)
    req.onsuccess = () => { db.close(); resolve(req.result ?? null) }
    req.onerror = () => { db.close(); resolve(null) }
  })
}

export async function deleteDraft(projectId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(projectId)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); resolve() }
  })
}
