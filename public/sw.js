// BigRock Hub — Service Worker (network-first with cache fallback)
const CACHE_NAME = 'bigrock-v1'

// Install: cache shell assets
self.addEventListener('install', (e) => {
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch: network-first strategy
self.addEventListener('fetch', (e) => {
  // Only cache GET requests and same-origin
  if (e.request.method !== 'GET') return
  // Skip Supabase API calls, auth, and external APIs
  const url = new URL(e.request.url)
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis')) return

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Clone and cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        }
        return response
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(e.request).then(cached => {
          if (cached) return cached
          // If no cache for navigation, return the app shell
          if (e.request.mode === 'navigate') {
            return caches.match('/index.html')
          }
          return new Response('Offline', { status: 503 })
        })
      })
  )
})
