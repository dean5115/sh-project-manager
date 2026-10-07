import { compressImage } from './image-compress'

const API_BASE = '/api'

// מכווץ כל תמונה בטופס לפני השליחה — תמונת פלאפון מקורית (3-8MB) איטית להעלאה בשטח ומעמיסה על השרת
async function compressFormImages(formData: FormData): Promise<FormData> {
  const out = new FormData()
  for (const [key, value] of Array.from(formData.entries())) {
    if (value instanceof File) {
      const file = await compressImage(value)
      out.append(key, file, file.name)
    } else {
      out.append(key, value)
    }
  }
  return out
}

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sitepilot_token')
}

// 502/503/504 = השרת קרס, נרדם או לא הגיב בזמן — לא שגיאה בנתונים, אלא בעיית זמינות זמנית
function friendlyError(status: number, fallback: string) {
  if (status === 502 || status === 503 || status === 504) {
    return 'השרת לא הגיב (עומס או הפעלה מחדש). הנתונים שלך לא נמחקו — נסה שוב בעוד דקה'
  }
  return fallback
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    if (res.status === 401 && token) handleSessionExpired()
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(friendlyError(res.status, err.error || `HTTP ${res.status}`))
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// טוקן שנשלח אבל נדחה ע"י השרת (401) = פג תוקף/לא תקף — מתנתקים ומחזירים להתחברות,
// כדי שהמשתמש לא יראה מסכים ריקים שקטים שנראים כמו "אין נתונים" בפועל
function handleSessionExpired() {
  if (typeof window === 'undefined') return
  localStorage.removeItem('sitepilot_token')
  localStorage.removeItem('sitepilot-auth')
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = getToken()
    const body = await compressFormImages(formData)
    let res: Response | null = null
    // ניסיון חוזר אחד אחרי שגיאת זמינות (502/503/504) או ניתוק רשת — נפוץ בקליטה חלשה בשטח
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        res = await fetch(`${API_BASE}${path}`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body,
        })
      } catch (err) {
        if (attempt === 1) throw new Error('אין חיבור לשרת — בדוק את הקליטה ונסה שוב')
        await new Promise((r) => setTimeout(r, 3000))
        continue
      }
      if (![502, 503, 504].includes(res.status) || attempt === 1) break
      await new Promise((r) => setTimeout(r, 3000))
    }
    if (!res!.ok) {
      if (res!.status === 401 && token) handleSessionExpired()
      const err = await res!.json().catch(() => ({ error: res!.statusText }))
      throw new Error(friendlyError(res!.status, err.error || `HTTP ${res!.status}`))
    }
    return res!.json()
  },
}
