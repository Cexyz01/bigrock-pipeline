import { useEffect, useState, useRef } from 'react'

// Post-migration safety net: after the Cloudinary -> R2 move on 2026-05-27
// any URL pointing at res.cloudinary.com is, by definition, a leftover bug.
// This component instruments two detection paths:
//
// 1. PerformanceObserver — picks up every browser-level resource load
//    (img/video/audio/fetch/css). Catches the real source of truth even
//    if a URL slipped past a code review.
//
// 2. In-memory data scan — walks the currently loaded shots/assets/tasks/
//    profiles/notifications/etc. and grep-counts cloudinary URLs. Catches
//    rows that haven't been rendered yet but still live in DB state.
//
// Either path triggers a red banner top-right + console.error with the
// URL and where it was loaded from. Renders nothing in a clean state.
//
// Remove this component once Cloudinary is fully decommissioned.

const MARKER = 'res.cloudinary.com'

function findCloudinaryUrlsIn(obj, path = '', out = []) {
  if (out.length > 50) return out // cap to keep this cheap
  if (obj == null) return out
  if (typeof obj === 'string') {
    if (obj.includes(MARKER)) out.push({ url: obj, path })
    return out
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) findCloudinaryUrlsIn(obj[i], `${path}[${i}]`, out)
    return out
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) findCloudinaryUrlsIn(obj[k], path ? `${path}.${k}` : k, out)
  }
  return out
}

export default function CloudinaryAlarm({ datasets }) {
  // Hits from PerformanceObserver (browser-level loads).
  const [loadHits, setLoadHits] = useState([])
  // Hits from data scan (in-memory state).
  const [dataHits, setDataHits] = useState([])
  const [expanded, setExpanded] = useState(false)
  const seenRef = useRef(new Set())

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined') return
    let po
    try {
      po = new PerformanceObserver(list => {
        const fresh = []
        for (const e of list.getEntries()) {
          if (!e.name || !e.name.includes(MARKER)) continue
          if (seenRef.current.has(e.name)) continue
          seenRef.current.add(e.name)
          fresh.push({ url: e.name, type: e.initiatorType || 'unknown' })
          console.error('[LEGACY CLOUDINARY LOAD]', e.initiatorType, e.name)
        }
        if (fresh.length) setLoadHits(prev => [...prev, ...fresh])
      })
      po.observe({ type: 'resource', buffered: true })
    } catch (err) {
      console.warn('[CloudinaryAlarm] PerformanceObserver failed:', err)
    }
    return () => { try { po && po.disconnect() } catch {} }
  }, [])

  useEffect(() => {
    if (!datasets) return
    const out = []
    for (const [name, value] of Object.entries(datasets)) {
      findCloudinaryUrlsIn(value, name, out)
    }
    if (out.length) {
      console.error('[LEGACY CLOUDINARY URL IN STATE]', out)
    }
    setDataHits(out)
  }, [datasets])

  const totalLoads = loadHits.length
  const totalData = dataHits.length
  if (totalLoads === 0 && totalData === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 14, right: 14, zIndex: 99999,
      background: '#FEE2E2', border: '2px solid #DC2626', borderRadius: 12,
      padding: '10px 14px', boxShadow: '0 6px 24px rgba(220,38,38,0.25)',
      fontSize: 12, color: '#991B1B', maxWidth: 460,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span style={{ flex: 1 }}>
          Legacy Cloudinary {totalLoads ? `· ${totalLoads} load${totalLoads > 1 ? 's' : ''}` : ''}{totalLoads && totalData ? ' · ' : ''}{totalData ? `${totalData} in data` : ''}
        </span>
        <button onClick={() => setExpanded(v => !v)} style={{
          background: 'transparent', border: '1px solid #991B1B33', color: '#991B1B',
          padding: '2px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 600,
        }}>{expanded ? 'Hide' : 'Show'}</button>
      </div>
      {expanded && (
        <div style={{ fontSize: 10, fontFamily: 'monospace', maxHeight: 280, overflow: 'auto', borderTop: '1px dashed #DC262655', paddingTop: 6 }}>
          {loadHits.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>Resource loads ({loadHits.length}):</div>
              {loadHits.slice(0, 20).map((h, i) => (
                <div key={i} style={{ marginBottom: 2, wordBreak: 'break-all' }}>
                  <span style={{ background: '#991B1B22', padding: '0 4px', borderRadius: 3, marginRight: 4 }}>{h.type}</span>
                  {h.url}
                </div>
              ))}
              {loadHits.length > 20 && <div>… and {loadHits.length - 20} more</div>}
            </div>
          )}
          {dataHits.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 3 }}>In-memory references ({dataHits.length}):</div>
              {dataHits.slice(0, 20).map((h, i) => (
                <div key={i} style={{ marginBottom: 2, wordBreak: 'break-all' }}>
                  <span style={{ background: '#991B1B22', padding: '0 4px', borderRadius: 3, marginRight: 4 }}>{h.path}</span>
                  {h.url}
                </div>
              ))}
              {dataHits.length > 20 && <div>… and {dataHits.length - 20} more</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
