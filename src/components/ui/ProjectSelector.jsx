import { useState, useRef, useEffect } from 'react'
import { ACCENT } from '../../lib/constants'

export default function ProjectSelector({ projects, currentProject, onSelectProject, expanded }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!projects || projects.length === 0) return null

  const initials = (currentProject?.name || '?').slice(0, 2).toUpperCase()

  // Single project — just display, no dropdown
  if (projects.length === 1) {
    return (
      <div style={{ padding: expanded ? '8px 16px' : '8px 0', display: 'flex', justifyContent: 'center' }}>
        {expanded ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
            borderRadius: 10, background: 'rgba(255,255,255,0.08)', width: '100%',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, background: ACCENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>{initials}</div>
            <span style={{
              fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{currentProject?.name}</span>
          </div>
        ) : (
          <div title={currentProject?.name} style={{
            width: 36, height: 36, borderRadius: 10, background: ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'default',
          }}>{initials}</div>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} style={{ padding: expanded ? '8px 16px' : '8px 0', position: 'relative', display: 'flex', justifyContent: 'center' }}>
      {expanded ? (
        <button onClick={() => setOpen(!open)} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          borderRadius: 10, background: open ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
          border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left',
          transition: 'background 0.15s',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: ACCENT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>{initials}</div>
          <span style={{
            fontSize: 13, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{currentProject?.name}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
        </button>
      ) : (
        <button onClick={() => setOpen(!open)} title={currentProject?.name} style={{
          width: 36, height: 36, borderRadius: 10, background: ACCENT,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff', border: 'none', cursor: 'pointer',
        }}>{initials}</button>
      )}

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: expanded ? 16 : 0,
          width: expanded ? 'calc(100% - 32px)' : 220,
          background: '#1E293B', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)', zIndex: 100, overflow: 'hidden',
          marginTop: 4,
        }}>
          <div style={{ padding: '8px 0' }}>
            {projects.map(p => {
              const active = p.id === currentProject?.id
              return (
                <button key={p.id} onClick={() => { onSelectProject(p); setOpen(false) }} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '10px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: active ? 'rgba(242,140,40,0.15)' : 'transparent',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: active ? ACCENT : 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>{p.name.slice(0, 2).toUpperCase()}</div>
                  <span style={{
                    fontSize: 13, color: active ? ACCENT : '#CBD5E1',
                    fontWeight: active ? 600 : 400, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                  }}>{p.name}</span>
                  {active && <span style={{ color: ACCENT, fontSize: 14 }}>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
