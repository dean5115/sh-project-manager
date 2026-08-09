const API_BASE = '/api'

function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('sitepilot_token')
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
    throw new Error(err.error || `HTTP ${res.status}`)
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
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    if (!res.ok) {
      if (res.status === 401 && token) handleSessionExpired()
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  },
}
