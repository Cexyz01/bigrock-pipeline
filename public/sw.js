// BigRock Hub — Service Worker (network-first with cache fallback)
// Bump CACHE_NAME on every deploy of substantive client changes so an old
// SW on a returning device drops its cached bundles instead of replaying
// the previous app version (which kept Alessandra stuck on broken code
// even after the fix was deployed).
const CACHE_NAME = 'bigrock-v4-2026-05-15b'

// Install: take over immediately, don't wait for tabs to close
self.addEventListener('install', () => {
  self.skipWaiting()
})

// Allow the page to force a waiting SW to activate right away.
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting()
})

// Activate: nuke every cache that isn't the current one, then claim all
// open clients so the new SW takes control of the existing tab.
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

// Fetch: network-first strategy
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  const url = new URL(e.request.url)
  // Never intercept Supabase / Google API calls
  if (url.hostname.includes('supabase') || url.hostname.includes('googleapis')) return
  // Never cache the HTML shell — always fetch fresh so a new deploy is
  // picked up the moment the tab reloads.
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')))
    return
  }
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        }
        return response
      })
      .catch(() => caches.match(e.request).then(cached =>
        cached || new Response('Offline', { status: 503 })
      ))
  )
})
