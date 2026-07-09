import { useState, useEffect, useMemo, useRef } from 'react'
import { getAllWipUpdates, subscribeToTable, supabase } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import { DEPTS } from '../../lib/constants'
import Fade from '../ui/Fade'
import { IconX } from '../ui/Icons'
import { createStudioEngine } from '../office/studioEngine'

const todayStr = () => new Date().toISOString().split('T')[0]
const ASSET_BASE = '/studio/'
const CHAR_COUNT = 6

// avatar picker swatch — shows the down-idle frame (0,0) of a character sheet
function AvatarSwatch({ idx, active, onClick }) {
  return (
    <button onClick={onClick} title={`Avatar ${idx + 1}`} style={{
      width: 40, height: 52, borderRadius: 8, cursor: 'pointer', padding: 0, overflow: 'hidden',
      border: active ? '2px solid #F28C28' : '1px solid #2a3140', background: active ? 'rgba(242,140,40,0.12)' : '#12151d',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div style={{
        width: 32, height: 48, imageRendering: 'pixelated',
        backgroundImage: `url(${ASSET_BASE}characters/char_${idx}.png)`,
        backgroundPosition: '0px 0px', backgroundSize: '224px 192px', // 112x96 *2
      }} />
    </button>
  )
}

export default function OfficePage({ tasks = [], profiles = [], projectMembers, user, currentProject, onlineUsers = [], onNavigate }) {
  const isMobile = useIsMobile()
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const [allWips, setAllWips] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [wipView, setWipView] = useState(null) // { wip, img } — inline WIP lightbox
  const [avatarOverrides, setAvatarOverrides] = useState({}) // id -> idx (persisted studio_avatar)
  const selectedIdRef = useRef(null)

  // ── students of the current project, dept overridden by project_role ──
  const students = useMemo(() => {
    const memberByUser = new Map((projectMembers || []).map(m => [m.user_id, m]))
    return profiles
      .filter(p => p.role_slug === 'studente' && (projectMembers ? memberByUser.has(p.id) : true))
      .map(p => { const m = memberByUser.get(p.id); const dept = m ? (m.project_role || p.department || null) : p.department; return { id: p.id, name: p.full_name || 'Studente', dept } })
  }, [profiles, projectMembers])
  const studentsSig = students.map(s => s.id + ':' + (s.dept || '')).join('|')
  const profileById = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles])

  // ── live signals ──
  const onlineIds = useMemo(() => new Set((onlineUsers || []).map(u => u.user_id)), [onlineUsers])
  const statusByUser = useMemo(() => {
    const today = todayStr(), out = {}
    for (const w of allWips) if (w.created_at?.split('T')[0] === today && w.user_id && out[w.user_id] !== 'green') out[w.user_id] = 'blue'
    for (const t of tasks) if (t.status === 'approved' && t.updated_at?.split('T')[0] === today) for (const a of (t.assignees || [])) out[a.user.id] = 'green'
    return out
  }, [allWips, tasks])

  // ── load WIPs + persisted avatars ──
  useEffect(() => { getAllWipUpdates().then(d => setAllWips(d || [])).catch(() => setAllWips([])) }, [])
  useEffect(() => {
    supabase.from('profiles').select('id, studio_avatar').then(({ data }) => {
      if (!data) return
      const o = {}; for (const r of data) if (r.studio_avatar != null) o[r.id] = r.studio_avatar
      setAvatarOverrides(o)
    }).catch(() => {})
  }, [])

  // ── realtime: new WIP → pop bubble + refresh ──
  useEffect(() => {
    const ch = subscribeToTable('task_wip_updates', (payload) => {
      getAllWipUpdates().then(d => setAllWips(d || [])).catch(() => {})
      const uid = payload?.new?.user_id
      if (uid && engineRef.current) engineRef.current.pop(uid)
    })
    return () => ch?.unsubscribe?.()
  }, [])

  // ── build engine when roster changes ──
  useEffect(() => {
    if (!canvasRef.current || students.length === 0) return
    const eng = createStudioEngine(canvasRef.current, ASSET_BASE, students, {
      onSelect: (id) => { selectedIdRef.current = id; setSelectedId(id) },
    })
    engineRef.current = eng
    return () => { eng.destroy(); engineRef.current = null }
  }, [studentsSig]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── push live data into the engine ──
  useEffect(() => {
    if (!engineRef.current) return
    engineRef.current.setLive({ online: onlineIds, status: statusByUser, avatar: avatarOverrides })
  }, [onlineIds, statusByUser, avatarOverrides, studentsSig])

  const totalOnline = students.filter(s => onlineIds.has(s.id)).length
  const activeToday = Object.keys(statusByUser).length

  // ── selected student data ──
  const selected = selectedId ? students.find(s => s.id === selectedId) : null
  const selProfile = selectedId ? profileById[selectedId] : null
  const selWips = useMemo(() => selectedId ? allWips.filter(w => w.user_id === selectedId).slice(0, 12) : [], [allWips, selectedId])
  const selOnline = selectedId ? onlineIds.has(selectedId) : false
  const selStatus = selectedId ? (statusByUser[selectedId] || 'none') : 'none'
  const selDept = selected ? DEPTS.find(d => d.id === selected.dept) : null

  const setAvatar = async (idx) => {
    if (!selectedId) return
    setAvatarOverrides(o => ({ ...o, [selectedId]: idx }))
    try { await supabase.from('profiles').update({ studio_avatar: idx }).eq('id', selectedId) } catch (e) { /* non-blocking */ }
  }

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: 16, gap: 8 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Studio</h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>Ufficio in tempo reale{currentProject ? ` · ${currentProject.name}` : ''} · clicca una persona per i dettagli</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#059669' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'office-live 1.6s ease-in-out infinite' }} />LIVE
            </span>
            <span style={{ fontSize: 12, color: '#64748B' }}><b style={{ color: '#1a1a1a' }}>{totalOnline}</b> online</span>
            <span style={{ fontSize: 12, color: '#64748B' }}><b style={{ color: '#1a1a1a' }}>{activeToday}</b> attivi oggi</span>
          </div>
        </div>
      </Fade>

      <style>{`@keyframes office-live{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      <Fade delay={60}>
        <div style={{ position: 'relative', background: 'linear-gradient(160deg,#1b1f28,#12151d)', borderRadius: 18, border: '1px solid #262d38', boxShadow: '0 12px 44px rgba(0,0,0,0.22)', padding: 10 }}>
          <div style={{ overflow: 'auto', maxHeight: isMobile ? '64vh' : '74vh', borderRadius: 12, background: '#0d1017' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', imageRendering: 'pixelated', display: 'block' }} />
          </div>

          {/* legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10, padding: '10px 6px 2px', borderTop: '1px solid #262d38' }}>
            {[{ c: '#3B82F6', l: 'sta lavorando (WIP)' }, { c: '#10B981', l: 'ha approvato oggi' }, { c: '#f5b862', l: 'in pausa (relax / bagno)' }, { c: '#475569', l: 'sedia vuota = offline' }].map(x => (
              <span key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#94a3b8' }}>
                <i style={{ width: 11, height: 11, borderRadius: 3, background: x.c, display: 'inline-block' }} />{x.l}
              </span>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: '#5b6472' }}>personaggi: MetroCity — JIK-A-4 · arredo: pixel-agents (MIT)</span>
          </div>

          {/* ── person drawer ── */}
          {selected && (
            <div style={{
              position: 'absolute', top: 10, right: 10, bottom: 10, width: isMobile ? 'calc(100% - 20px)' : 340,
              background: '#161a22', border: '1px solid #2a313d', borderRadius: 14, boxShadow: '-8px 0 30px rgba(0,0,0,0.35)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 5,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 14px 12px', borderBottom: '1px solid #262d38' }}>
                <div style={{ width: 34, height: 44, imageRendering: 'pixelated', borderRadius: 6, backgroundImage: `url(${ASSET_BASE}characters/char_${(avatarOverrides[selectedId] ?? 0)}.png)`, backgroundPosition: '0 0', backgroundSize: '238px 204px', backgroundColor: '#0f1219' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#eef2f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selected.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    {selDept && <span style={{ fontSize: 11, color: selDept.color, fontWeight: 600 }}>{selDept.label}</span>}
                    <span style={{ fontSize: 11, color: selOnline ? '#34d399' : '#64748b', fontWeight: 600 }}>{selOnline ? '● online' : '○ offline'}</span>
                    {selStatus === 'green' && <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#052e22', padding: '1px 6px', borderRadius: 5 }}>approvato oggi</span>}
                    {selStatus === 'blue' && <span style={{ fontSize: 10, fontWeight: 700, color: '#3B82F6', background: '#0c1c33', padding: '1px 6px', borderRadius: 5 }}>WIP oggi</span>}
                  </div>
                </div>
                <button onClick={() => { setSelectedId(null); selectedIdRef.current = null }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}><IconX size={18} /></button>
              </div>

              {/* avatar editor */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid #262d38' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Avatar</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Array.from({ length: CHAR_COUNT }, (_, i) => (
                    <AvatarSwatch key={i} idx={i} active={(avatarOverrides[selectedId] ?? -1) === i} onClick={() => setAvatar(i)} />
                  ))}
                </div>
              </div>

              {/* WIPs */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>WIP recenti ({selWips.length})</div>
                {selWips.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: '#5b6472', padding: '10px 0' }}>Nessun WIP caricato.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {selWips.map(w => (
                      <div key={w.id} onClick={() => setWipView({ wip: w, img: 0 })}
                        style={{ background: '#1b2029', border: '1px solid #262d38', borderRadius: 10, padding: '9px 11px', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#dbe2ea', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.task?.title || 'Task'}</span>
                          <span style={{ fontSize: 10.5, color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(w.created_at).toLocaleDateString('it', { day: '2-digit', month: 'short' })}</span>
                        </div>
                        {w.note && <div style={{ fontSize: 11.5, color: '#9aa7b5', marginTop: 3 }}>{w.note}</div>}
                        {w.images?.length > 0 && (
                          <div style={{ display: 'flex', gap: 5, marginTop: 7, flexWrap: 'wrap' }}>
                            {w.images.slice(0, 4).map((url, i) => (
                              <img key={i} src={url} alt="" loading="lazy" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid #2a313d' }} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Fade>

      {/* ── inline WIP lightbox (simulation keeps running behind) ── */}
      {wipView && (() => {
        const w = wipView.wip, imgs = w.images || [], i = Math.min(wipView.img, Math.max(0, imgs.length - 1)), url = imgs[i]
        return (
          <div onClick={() => setWipView(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(6,8,12,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#161a22', border: '1px solid #2a313d', borderRadius: 14, maxWidth: 'min(920px, 94vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #262d38' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#eef2f6', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.task?.title || 'WIP'}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{selected?.name} · {new Date(w.created_at).toLocaleString('it', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                {w.task_id && onNavigate && <button onClick={() => { const wp = w; setWipView(null); onNavigate('tasks', wp.task_id, { wipId: wp.id }) }} style={{ fontSize: 12, fontWeight: 600, color: '#F28C28', background: 'rgba(242,140,40,0.1)', border: '1px solid rgba(242,140,40,0.25)', borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>Apri task ↗</button>}
                <button onClick={() => setWipView(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}><IconX size={18} /></button>
              </div>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d1017', position: 'relative' }}>
                {url ? <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', display: 'block' }} />
                     : <div style={{ padding: 60, color: '#64748b', fontSize: 13 }}>Nessuna immagine</div>}
                {imgs.length > 1 && (
                  <>
                    <button onClick={() => setWipView(v => ({ ...v, img: (i - 1 + imgs.length) % imgs.length }))} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>‹</button>
                    <button onClick={() => setWipView(v => ({ ...v, img: (i + 1) % imgs.length }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>›</button>
                    <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 11, color: '#cbd5e1', background: 'rgba(0,0,0,0.5)', padding: '2px 8px', borderRadius: 10 }}>{i + 1} / {imgs.length}</div>
                  </>
                )}
              </div>
              {w.note && <div style={{ padding: '10px 14px', fontSize: 13, color: '#c7d0da', borderTop: '1px solid #262d38', maxHeight: 120, overflowY: 'auto' }}>{w.note}</div>}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
