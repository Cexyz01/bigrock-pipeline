import { useState, useEffect, useCallback } from 'react';
import MatrixRain from './MatrixRain';
import GravityEffect from './GravityEffect';

/* ── Broadcast Overlay ─────────────────────────────────────────── */
function BroadcastOverlay({ message, sender, duration = 5000, onDone }) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    // fade in
    requestAnimationFrame(() => setOpacity(1));
    // fade out 800ms before end, then clear
    const t = setTimeout(() => setOpacity(0), duration - 800);
    const t2 = setTimeout(onDone, duration);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, [duration, onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      opacity, transition: 'opacity 0.5s ease',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #F28C28 0%, #F5B862 50%, #F28C28 100%)',
        backgroundSize: '200% 200%',
        animation: 'gradientShift 3s ease infinite',
        borderRadius: 24, padding: '48px 64px',
        maxWidth: '80vw', textAlign: 'center',
        boxShadow: '0 0 80px rgba(242,140,40,0.5), 0 0 200px rgba(242,140,40,0.2)',
        transform: opacity ? 'scale(1)' : 'scale(0.9)',
        transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📢</div>
        <div style={{
          color: '#fff', fontSize: 32, fontWeight: 800,
          lineHeight: 1.3, textShadow: '0 2px 20px rgba(0,0,0,0.3)',
          letterSpacing: 0.5,
        }}>
          {message}
        </div>
        {sender && (
          <div style={{
            color: 'rgba(255,255,255,0.6)', fontSize: 15,
            marginTop: 16, fontStyle: 'italic',
          }}>
            — {sender}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Ban Overlay ───────────────────────────────────────────────── */
function BanOverlay({ targetName, duration, onDone }) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    const iv = setInterval(() => {
      setRemaining(p => {
        if (p <= 1) { clearInterval(iv); setTimeout(onDone, 300); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [duration, onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0a',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* scan lines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.03) 2px, rgba(255,0,0,0.03) 4px)',
      }} />

      <div style={{
        fontSize: 90, marginBottom: 24,
        animation: 'pulse 1.5s ease infinite',
      }}>🔨</div>

      <div style={{
        color: '#ff3333', fontSize: 48, fontWeight: 900,
        letterSpacing: 6, textTransform: 'uppercase',
        textShadow: '0 0 30px rgba(255,51,51,0.6), 0 0 60px rgba(255,51,51,0.3)',
        marginBottom: 12,
      }}>
        SEI STATO BANNATO
      </div>

      <div style={{ color: '#555', fontSize: 18, marginBottom: 48 }}>
        Hai violato le regole della pipeline.
      </div>

      <div style={{
        color: '#ff3333', fontSize: 120, fontWeight: 900,
        fontFamily: '"Courier New", monospace',
        textShadow: '0 0 50px rgba(255,51,51,0.5)',
        lineHeight: 1,
        animation: remaining <= 3 ? 'pulse 0.5s ease infinite' : 'none',
      }}>
        {remaining}
      </div>

      <div style={{
        color: '#333', fontSize: 14, marginTop: 48,
        fontStyle: 'italic', letterSpacing: 1,
      }}>
        {remaining > 0 ? 'Riprova tra poco...' : '...scherzavo 😏'}
      </div>

      {/* progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4,
        background: '#1a1a1a',
      }}>
        <div style={{
          height: '100%', background: '#ff3333',
          width: `${(remaining / duration) * 100}%`,
          transition: 'width 1s linear',
          boxShadow: '0 0 10px rgba(255,51,51,0.5)',
        }} />
      </div>
    </div>
  );
}

/* ── Disco Overlay ─────────────────────────────────────────────── */
function DiscoOverlay({ duration, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [duration, onDone]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9997,
      pointerEvents: 'none',
      animation: 'disco 0.4s linear infinite',
      opacity: 0.2,
      mixBlendMode: 'overlay',
    }} />
  );
}

/* ── Main AdminEffects ─────────────────────────────────────────── */
export default function AdminEffects({ effects, userId, matrixMode, onClear }) {
  const { broadcastMsg, banInfo, shaking, disco, flipped, gravity } = effects;

  // shake
  useEffect(() => {
    if (!shaking) return;
    document.body.style.animation = 'adminShake 0.08s linear infinite';
    const t = setTimeout(() => {
      document.body.style.animation = '';
      onClear('shaking');
    }, shaking);
    return () => { document.body.style.animation = ''; clearTimeout(t); };
  }, [shaking, onClear]);

  // flip
  useEffect(() => {
    if (!flipped) return;
    document.body.style.transform = 'rotate(180deg)';
    document.body.style.transition = 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1)';
    const t = setTimeout(() => {
      document.body.style.transform = '';
      setTimeout(() => { document.body.style.transition = ''; onClear('flipped'); }, 700);
    }, flipped);
    return () => {
      document.body.style.transform = '';
      document.body.style.transition = '';
      clearTimeout(t);
    };
  }, [flipped, onClear]);

  const clearBroadcast = useCallback(() => onClear('broadcastMsg'), [onClear]);
  const clearBan = useCallback(() => onClear('banInfo'), [onClear]);
  const clearDisco = useCallback(() => onClear('disco'), [onClear]);
  const clearGravity = useCallback(() => onClear('gravity'), [onClear]);

  return (
    <>
      {matrixMode && <MatrixRain />}

      {broadcastMsg && (
        <BroadcastOverlay
          message={broadcastMsg.message}
          sender={broadcastMsg.sender}
          duration={broadcastMsg.duration || 5000}
          onDone={clearBroadcast}
        />
      )}

      {banInfo && (
        <BanOverlay
          targetName={banInfo.targetName}
          duration={banInfo.duration}
          onDone={clearBan}
        />
      )}

      {disco > 0 && (
        <DiscoOverlay duration={disco} onDone={clearDisco} />
      )}

      {gravity > 0 && (
        <GravityEffect duration={gravity} onDone={clearGravity} />
      )}
    </>
  );
}
