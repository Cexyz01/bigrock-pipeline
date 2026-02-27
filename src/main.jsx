import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// ── PWA: Register Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
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
    <div style="position:fixed;bottom:72px;left:12px;right:12px;z-index:999;
      background:linear-gradient(135deg,#6C5CE7,#A29BFE);color:#fff;
      border-radius:16px;padding:14px 16px;display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 32px rgba(108,92,231,0.4);animation:slideInUp 0.3s ease">
      <div style="font-size:28px">📱</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700">Aggiungi alla Home</div>
        <div style="font-size:11px;opacity:0.85">Accedi rapidamente a BigRock Hub</div>
      </div>
      <button id="pwa-install" style="background:#fff;color:#6C5CE7;border:none;
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
