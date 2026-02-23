import { useState } from 'react'
import Fade from '../ui/Fade'
import EmptyState from '../ui/EmptyState'

export default function StoryboardPage() {
  const boardId = import.meta.env.VITE_MIRO_BOARD_ID
  const [activated, setActivated] = useState(false)

  return (
    <div>
      <Fade>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>🗂 Storyboard</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 20 }}>Miro Board — Storyboard & WIP</p>
      </Fade>
      <Fade delay={100}>
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid #1e1e2a', height: 'calc(100vh - 170px)' }}>
          {boardId ? (
            <>
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
                    background: 'rgba(14,14,20,0.4)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(2px)',
                  }}>
                  <div style={{
                    background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: 14,
                    padding: '18px 32px', fontSize: 15, fontWeight: 600, color: '#ccc',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                  }}>
                    Clicca per attivare la board Miro
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon="🗂" title="Miro non configurato" sub="Aggiungi VITE_MIRO_BOARD_ID al file .env" />
          )}
        </div>
      </Fade>
    </div>
  )
}
