import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// ── Disable browser zoom (keep at 100%) ──
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')) {
    e.preventDefault()
  }
})
document.addEventListener('wheel', (e) => {
  if (e.ctrlKey || e.metaKey) e.preventDefault()
}, { passive: false })

// ── PWA: Register Service Worker ──
// Register and quietly check for updates. We DO NOT auto-reload on
// controllerchange — that was kicking devices into a refresh loop where
// every new SW activation reloaded the page mid-load, the queries got
// cut, and the user saw empty data after ~2s. Users now pick up new
// bundles on their next manual refresh, which is fine.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Promote a waiting worker (if any) so it's ready for the user's
      // next navigation. No reload triggered here.
      const promoteWaiting = () => { if (reg.waiting) reg.waiting.postMessage('skip-waiting') }
      promoteWaiting()
      try { reg.update() } catch (_) {}
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing
        if (!nw) return
        nw.addEventListener('statechange', () => { if (nw.state === 'installed') promoteWaiting() })
      })
    }).catch(() => {})
  })
}

// ── Nuclear reset: wipes every browser-side bit of state for this origin
// (service workers, caches, localStorage, sessionStorage, IndexedDB), then
// hard-reloads. Exposed globally so the LoginPage button and a `#reset`
// URL hash can both trigger it. This is the user's safety valve for the
// "stuck on a poisoned device" scenario.
window.bigrockHardReset = async function bigrockHardReset() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch (_) {}
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch (_) {}
  try { localStorage.clear() } catch (_) {}
  try { sessionStorage.clear() } catch (_) {}
  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases()
      await Promise.all(dbs.map(db => db?.name && new Promise(res => {
        const req = indexedDB.deleteDatabase(db.name)
        req.onsuccess = req.onerror = req.onblocked = () => res()
      })))
    }
  } catch (_) {}
  window.location.href = window.location.pathname + '?reset=' + Date.now()
}

// Trigger reset automatically when navigating to #reset (handy if the
// LoginPage button is also somehow broken).
if (typeof window !== 'undefined' && window.location.hash === '#reset') {
  window.bigrockHardReset()
}

// ── PWA: Lock portrait orientation on mobile only ──
if (window.innerWidth < 768 && screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('portrait').catch(() => {})
}

// ── PWA: Install Banner ──
let deferredPrompt = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e

  // Only show on mobile
  if (window.innerWidth >= 768) return

  // Don't show if already dismissed
  if (localStorage.getItem('pwa-dismissed')) return

  // Create and show the install banner
  const banner = document.createElement('div')
  banner.id = 'pwa-banner'
  banner.innerHTML = `
    <div style="position:fixed;bottom:60px;left:12px;right:12px;z-index:999;
      background:linear-gradient(135deg,#F28C28,#F5B862);color:#fff;
      border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 32px rgba(242,140,40,0.4);animation:slideInUp 0.3s ease">
      <div style="font-size:28px">📱</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">Aggiungi alla Home</div>
        <div style="font-size:11px;opacity:0.85">Accedi rapidamente a BigRock Hub</div>
      </div>
      <button id="pwa-install" style="background:#fff;color:#F28C28;border:none;
        border-radius:10px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;
        white-space:nowrap">Installa</button>
      <button id="pwa-close" style="background:none;border:none;color:#fff;
        font-size:18px;cursor:pointer;padding:4px;opacity:0.7">✕</button>
    </div>
  `
  document.body.appendChild(banner)

  document.getElementById('pwa-install').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      deferredPrompt = null
      banner.remove()
    }
  })

  document.getElementById('pwa-close').addEventListener('click', () => {
    localStorage.setItem('pwa-dismissed', '1')
    banner.remove()
  })
})
