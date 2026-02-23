import { useState } from 'react'
import EmptyState from '../ui/EmptyState'

export default function StoryboardPage() {
  const boardId = import.meta.env.VITE_MIRO_BOARD_ID
  const [activated, setActivated] = useState(false)

  // #8: Maximum size — use full viewport minus sidebar and topbar
  return (
    <div style={{ margin: '-28px -36px', height: 'calc(100vh - 60px)' }}>
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
                background: 'rgba(11,11,18,0.4)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(2px)',
              }}>
              <div style={{
                background: '#12121c', border: '1px solid #2a2a3a', borderRadius: 16,
                padding: '18px 32px', fontSize: 15, fontWeight: 600, color: '#ccc',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              }}>
                Clicca per attivare la board Miro
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '28px 36px' }}>
          <EmptyState icon="🗂" title="Miro non configurato" sub="Aggiungi VITE_MIRO_BOARD_ID al file .env" />
        </div>
      )}
    </div>
  )
}
