import { useState, useEffect, useCallback } from 'react'
import TimelinePage from './TimelinePage'
import { IconTimeline } from '../ui/Icons'
import { ACCENT } from '../../lib/constants'
import {
  getTimeline2Shots, updateTimeline2Shot, seedTimeline2FromLive,
  uploadTimelineFile, uploadOutputImage,
} from '../../lib/supabase'

// ── Timeline 2 — staff-only sandbox ──
//
// Reuses the exact TimelinePage UI, but every data write goes to the separate
// `timeline2_shots` table instead of the live `shots` table. So the professor
// can test freely across sessions (it's persisted server-side, shared among
// staff) without ever touching the real Timeline. A "Ricopia dalla timeline
// reale" button re-seeds the sandbox from the current live shots.
export default function Timeline2Page({ user, currentProject, addToast, requestConfirm, onGoToShotTasks }) {
  const [shots, setShots] = useState([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const projectId = currentProject?.id

  const reload = useCallback(async () => {
    if (!projectId) { setShots([]); setLoading(false); return }
    setLoading(true)
    const data = await getTimeline2Shots(projectId)
    setShots(data)
    setLoading(false)
  }, [projectId])

  useEffect(() => { reload() }, [reload])

  const doSeed = useCallback(async () => {
    if (!projectId || seeding) return
    setSeeding(true)
    const { count, error } = await seedTimeline2FromLive(projectId)
    setSeeding(false)
    if (error) { addToast?.('Copia fallita: ' + (error.message || 'errore'), 'danger'); return }
    addToast?.(`Timeline 2: copiati ${count} shot dalla timeline reale`, 'success')
    reload()
  }, [projectId, seeding, addToast, reload])

  const confirmSeed = useCallback(() => {
    const msg = shots.length
      ? 'Ricopiare tutto dalla timeline reale?\n\nLe modifiche di test attualmente nella Timeline 2 verranno CANCELLATE e sostituite con una copia fresca della timeline reale.'
      : 'Creare una copia della timeline reale da usare come sandbox di test?'
    if (requestConfirm) requestConfirm(msg, doSeed)
    else if (window.confirm(msg)) doSeed()
  }, [shots.length, requestConfirm, doSeed])

  // ── Sandbox mutations: write ONLY to timeline2_shots ──
  const handleUpdateShot = useCallback(async (id, updates) => {
    setShots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s)) // optimistic
    const { error } = await updateTimeline2Shot(id, updates)
    if (error) reload() // revert on failure
  }, [reload])

  const handleUploadShotAudio = useCallback(async (shotId, file) => {
    const { url, error } = await uploadTimelineFile(shotId, file)
    if (url) {
      await updateTimeline2Shot(shotId, { audio_url: url })
      reload()
      addToast?.('Audio caricato', 'success')
    } else {
      addToast?.('Upload audio fallito: ' + (error?.message || 'sconosciuto'), 'danger')
    }
  }, [addToast, reload])

  const handleUploadOutput = useCallback(async (shotId, file) => {
    const { url, width, height } = await uploadOutputImage(shotId, file)
    if (url) {
      await updateTimeline2Shot(shotId, { output_cloud_url: url, output_img_width: width || 0, output_img_height: height || 0 })
      reload()
      addToast?.('Output caricato', 'success')
    } else {
      addToast?.('Upload output fallito', 'danger')
    }
  }, [addToast, reload])

  const copiedAt = shots[0]?.sandbox_copied_at
    ? new Date(shots[0].sandbox_copied_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0A0A0F', overflow: 'hidden' }}>
      {/* Sandbox banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '8px 20px', background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.25)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', color: '#FBBF24', background: 'rgba(251,191,36,0.16)', border: '1px solid rgba(251,191,36,0.45)', padding: '2px 7px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Sandbox di test</span>
          <span style={{ fontSize: 12, color: '#CBD5E1' }}>
            Copia indipendente — le modifiche <b style={{ color: '#FBBF24' }}>non</b> influiscono sulla timeline reale.
          </span>
          {copiedAt && <span style={{ fontSize: 11, color: '#64748B' }}>· ultima copia {copiedAt}</span>}
        </div>
        {shots.length > 0 && (
          <button onClick={confirmSeed} disabled={seeding} style={{
            background: '#1E293B', border: '1px solid #334155', borderRadius: 6,
            padding: '5px 12px', fontSize: 11, color: '#E2E8F0', fontWeight: 600,
            cursor: seeding ? 'default' : 'pointer', opacity: seeding ? 0.5 : 1, whiteSpace: 'nowrap',
          }}>{seeding ? 'Copia in corso…' : '↻ Ricopia dalla timeline reale'}</button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: 14 }}>
            Caricamento…
          </div>
        ) : shots.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>
            <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
              <IconTimeline size={48} color="#CBD5E1" />
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 16, color: '#E2E8F0' }}>Sandbox vuoto</div>
              <div style={{ fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                Crea una copia della timeline reale per iniziare a testare. Tutte le modifiche resteranno confinate alla Timeline 2.
              </div>
              <button onClick={confirmSeed} disabled={seeding} style={{
                marginTop: 20, background: ACCENT, border: 'none', borderRadius: 8,
                padding: '10px 20px', fontSize: 13, color: '#fff', fontWeight: 700,
                cursor: seeding ? 'default' : 'pointer', opacity: seeding ? 0.6 : 1,
              }}>{seeding ? 'Copia in corso…' : 'Crea copia dalla timeline reale'}</button>
            </div>
          </div>
        ) : (
          <TimelinePage
            sandbox
            shots={shots}
            user={user}
            onUpdateShot={handleUpdateShot}
            onUploadShotAudio={handleUploadShotAudio}
            onUploadOutput={handleUploadOutput}
            addToast={addToast}
            requestConfirm={requestConfirm}
            onGoToShotTasks={onGoToShotTasks}
            accessMode="edit"
            currentProject={currentProject}
            onUpdateTimelineViewers={() => {}}
          />
        )}
      </div>
    </div>
  )
}
