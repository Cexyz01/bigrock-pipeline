import { useState } from 'react'
import EmptyState from '../ui/EmptyState'

export default function StoryboardPage() {
  const boardId = import.meta.env.VITE_MIRO_BOARD_ID
  const [activated, setActivated] = useState(false)

  // #8: Maximum size — use full viewport minus sidebar and topbar
  return (
    <div style={{ margin: '-32px -40px', height: 'calc(100vh - 70px)' }}>
      {boardId ? (
        <div style={{ position: 'relative', height: '100%' }}>
          <iframe
            src={`https://miro.com/app/live-embed/${boardId}/`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="fullscreen"
            allowFullScreen
            loading="lazy"
          />
          {!activated && (
            <div onClick={() => setActivated(true)}
              style={{
                position: 'absolute', inset: 0, zIndex: 2,
                background: 'rgba(240,242,245,0.8)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
              }}>
              <div style={{
                background: '#fff', border: '1px solid #E8ECF1', borderRadius: 24,
                padding: '22px 36px', fontSize: 16, fontWeight: 600, color: '#1a1a2e',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
              }}>
                Clicca per attivare la board Miro
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '32px 40px' }}>
          <EmptyState title="Miro non configurato" sub="Aggiungi VITE_MIRO_BOARD_ID al file .env" />
        </div>
      )}
    </div>
  )
}
