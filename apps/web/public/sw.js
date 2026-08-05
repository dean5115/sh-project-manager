// v2 — עמודי HTML/ניווט תמיד ברשת קודם, כדי שדיפלוי חדש יגיע מיד ולא יישאר תקוע בקאש ישן לצמיתות.
// רק קבצים סטטיים עם hash בשם (_next/static) בטוחים לקאש-קודם — דיפלוי חדש = URL חדש ממילא.
const CACHE_NAME = 'sh-pm-v2'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  // לא שומרים בקאש קריאות API — תמיד מידע עדכני בזמן אמת
  if (request.method !== 'GET' || request.url.includes('/api/')) return

  const url = new URL(request.url)
  const isImmutableAsset = url.pathname.startsWith('/_next/static/')

  if (!isImmutableAsset) {
    // דפי HTML, ניווט וקריאות RSC של Next.js — רשת קודם עם נפילה לקאש רק כשאין אינטרנט בכלל
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => caches.match(request))
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request)
        .then((response) => {
          if (response.ok && request.url.startsWith(self.location.origin)) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached)
    })
  )
})
