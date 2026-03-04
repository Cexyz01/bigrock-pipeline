import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Generate random confetti particles
function generateConfetti(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    size: 4 + Math.random() * 6,
    color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#F28C28', '#22C55E', '#8B5CF6', '#EC4899'][Math.floor(Math.random() * 8)],
    rotation: Math.random() * 360,
  }));
}

// Generate firework bursts
function generateFireworks(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 50,
    delay: i * 0.6 + Math.random() * 0.4,
    particles: Array.from({ length: 14 }, (_, j) => ({
      angle: (j / 14) * 360,
      distance: 50 + Math.random() * 60,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#F28C28', '#22C55E', '#8B5CF6'][Math.floor(Math.random() * 6)],
      size: 3 + Math.random() * 4,
    })),
  }));
}

const STYLE_TAG_ID = 'trivia-reward-keyframes';

function injectKeyframes() {
  if (document.getElementById(STYLE_TAG_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_TAG_ID;
  style.textContent = `
    @keyframes triviaConfettiFall {
      0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
      100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
    }
    @keyframes triviaFireworkBurst {
      0% { transform: translate(0, 0) scale(1); opacity: 1; }
      100% { transform: translate(var(--fw-tx), var(--fw-ty)) scale(0); opacity: 0; }
    }
    @keyframes triviaPackFloat {
      0% { transform: translateY(40px) rotate(-8deg) scale(0.2); opacity: 0; }
      30% { transform: translateY(-15px) rotate(4deg) scale(1.08); opacity: 1; }
      50% { transform: translateY(-5px) rotate(-2deg) scale(1); opacity: 1; }
      70% { transform: translateY(-12px) rotate(3deg) scale(1.03); opacity: 1; }
      100% { transform: translateY(-8px) rotate(0deg) scale(1); opacity: 1; }
    }
    @keyframes triviaGoldPulse {
      0% { text-shadow: 0 0 20px rgba(255,215,0,0.5); }
      50% { text-shadow: 0 0 50px rgba(255,215,0,0.9), 0 0 100px rgba(255,215,0,0.3); }
      100% { text-shadow: 0 0 20px rgba(255,215,0,0.5); }
    }
    @keyframes triviaScaleIn {
      0% { transform: scale(0.3); opacity: 0; }
      60% { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes triviaStarSpin {
      0% { transform: rotate(0deg) scale(0); opacity: 0; }
      50% { transform: rotate(180deg) scale(1.3); opacity: 1; }
      100% { transform: rotate(360deg) scale(1); opacity: 0.7; }
    }
    @keyframes triviaShimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
  `;
  document.head.appendChild(style);
}

export default function TriviaRewardOverlay({ score, totalQuestions, packsWon, tcgGranted, onClose }) {
  const [confetti] = useState(() => generateConfetti(60));
  const [fireworks] = useState(() => generateFireworks(8));
  const [visible, setVisible] = useState(false);
  const hasWon = score >= 7;

  useEffect(() => {
    injectKeyframes();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const overlay = (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(12px)',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Confetti — only on win */}
      {hasWon && confetti.map(c => (
        <div key={c.id} style={{
          position: 'absolute',
          left: `${c.x}%`,
          top: -20,
          width: c.size,
          height: c.size * 1.5,
          background: c.color,
          borderRadius: 1,
          animation: `triviaConfettiFall ${c.duration}s ease-in ${c.delay}s infinite`,
          transform: `rotate(${c.rotation}deg)`,
          pointerEvents: 'none',
        }} />
      ))}

      {/* Firework bursts — only on win */}
      {hasWon && fireworks.map(fw => (
        <div key={fw.id} style={{
          position: 'absolute',
          left: `${fw.x}%`,
          top: `${fw.y}%`,
          pointerEvents: 'none',
        }}>
          {fw.particles.map((p, pi) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.distance;
            const ty = Math.sin(rad) * p.distance;
            return (
              <div key={pi} style={{
                position: 'absolute',
                width: p.size,
                height: p.size,
                borderRadius: '50%',
                background: p.color,
                boxShadow: `0 0 8px ${p.color}`,
                '--fw-tx': `${tx}px`,
                '--fw-ty': `${ty}px`,
                animation: `triviaFireworkBurst 1.4s ease-out ${fw.delay}s infinite`,
              }} />
            );
          })}
        </div>
      ))}

      {/* Main content box */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 20, textAlign: 'center',
          padding: '48px 40px',
          minWidth: 360, maxWidth: 500,
          background: 'rgba(20,20,20,0.95)',
          borderRadius: 24,
          border: hasWon ? '2px solid rgba(255,215,0,0.3)' : '1px solid #333',
          boxShadow: hasWon
            ? '0 0 60px rgba(255,215,0,0.15), 0 20px 80px rgba(0,0,0,0.6)'
            : '0 20px 60px rgba(0,0,0,0.5)',
          animation: visible ? 'triviaScaleIn 0.6s ease forwards' : 'none',
          opacity: visible ? 1 : 0,
          cursor: 'default',
        }}
      >
        {hasWon ? (
          <>
            {/* Win title */}
            <div style={{
              fontSize: 52, fontWeight: 900,
              background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              animation: 'triviaGoldPulse 2s ease infinite',
              letterSpacing: 3,
            }}>
              HAI VINTO!
            </div>

            {/* Score */}
            <div style={{ fontSize: 20, color: '#F1F5F9', fontWeight: 600 }}>
              {score}/{totalQuestions} risposte corrette
            </div>

            {/* Pack images — big and prominent */}
            <div style={{
              display: 'flex', gap: 24, justifyContent: 'center',
              margin: '12px 0',
            }}>
              {Array.from({ length: packsWon }, (_, i) => (
                <div key={i} style={{
                  animation: `triviaPackFloat 3s ease ${0.3 + i * 0.5}s both`,
                }}>
                  <img
                    src={`/packs/pack_${['red', 'green', 'blue'][i % 3]}.png`}
                    alt="Pack"
                    style={{
                      width: 140, height: 'auto',
                      filter: 'drop-shadow(0 0 30px rgba(255,215,0,0.6))',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Pack reward text */}
            <div style={{
              fontSize: 26, fontWeight: 900,
              color: '#FFD700',
              letterSpacing: 1,
            }}>
              {packsWon === 1 ? '1 Bustina Vinta!' : `${packsWon} Bustine Vinte!`}
            </div>

            {/* TCG not active note */}
            {!tcgGranted && (
              <div style={{
                fontSize: 13, color: '#888',
                background: 'rgba(255,255,255,0.05)',
                padding: '8px 16px', borderRadius: 8,
              }}>
                Le bustine saranno disponibili quando il TCG sara' attivo
              </div>
            )}

            {/* Decorative stars */}
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} style={{
                position: 'absolute',
                left: `${[5, 90, 10, 85, 50, 50][i]}%`,
                top: `${[10, 15, 85, 80, 5, 90][i]}%`,
                fontSize: 22,
                animation: `triviaStarSpin 2s ease ${i * 0.4}s infinite`,
                pointerEvents: 'none',
              }}>
                ✨
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Lose */}
            <div style={{ fontSize: 64, marginBottom: 4 }}>😔</div>
            <div style={{ fontSize: 30, fontWeight: 900, color: '#94A3B8' }}>
              Non hai vinto
            </div>
            <div style={{ fontSize: 20, color: '#F1F5F9', fontWeight: 600 }}>
              {score}/{totalQuestions} risposte corrette
            </div>
            <div style={{ fontSize: 15, color: '#666' }}>
              Servono almeno 7 risposte corrette per vincere una bustina
            </div>
          </>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            marginTop: 8,
            padding: '14px 48px', borderRadius: 14,
            fontSize: 17, fontWeight: 800,
            background: hasWon ? 'linear-gradient(135deg, #FFD700, #FFA500)' : '#333',
            color: hasWon ? '#000' : '#aaa',
            border: hasWon ? 'none' : '1px solid #444',
            cursor: 'pointer',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
          onMouseLeave={e => e.target.style.transform = 'scale(1)'}
        >
          {hasWon ? 'Fantastico!' : 'Chiudi'}
        </button>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
