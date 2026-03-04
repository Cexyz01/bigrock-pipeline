import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, subscribeToGameSession, declineGameInvite, cancelGame } from '../../lib/supabase';

const GAME_LABELS = { connect4: 'Forza 4', othello: 'Othello', chess: 'Scacchi', uno: 'UNO', snake_battle: 'Snake Battle', trivia_quiz: 'Trivia Quiz' };
const GAME_ICONS = { connect4: '🔴', othello: '⚫', chess: '♟️', uno: '🃏', snake_battle: '🐍', trivia_quiz: '🧠' };
const TIMEOUT = 15; // seconds

export default function GameInviteOverlay({ gameId, game, role, onAccepted, onClose, addToast }) {
  const [countdown, setCountdown] = useState(TIMEOUT);
  const [status, setStatus] = useState('waiting'); // waiting | accepted | declined | cancelled | timeout
  const closedRef = useRef(false);
  const subRef = useRef(null);

  const proposer = game.proposer || {};
  const target = game.target || {};
  const otherName = role === 'proposer' ? (target.full_name || 'Player') : (proposer.full_name || 'Player');
  const gameLabel = GAME_LABELS[game.game_type] || game.game_type;
  const gameIcon = GAME_ICONS[game.game_type] || '🎮';

  const doClose = useCallback((msg) => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (msg && addToast) addToast(msg, 'info');
    onClose();
  }, [onClose, addToast]);

  // Subscribe to game status changes
  useEffect(() => {
    subRef.current = subscribeToGameSession(gameId, (payload) => {
      const g = payload.new;
      if (g.status === 'active') {
        setStatus('accepted');
        // Trivia: proposer doesn't play — just show confirmation and close
        if (role === 'proposer' && game.game_type === 'trivia_quiz') {
          setTimeout(() => doClose(`${otherName} ha accettato la sfida trivia!`), 1200);
          return;
        }
        setTimeout(() => {
          if (!closedRef.current) { closedRef.current = true; onAccepted(gameId); }
        }, 400);
      } else if (g.status === 'declined') {
        setStatus('declined');
        setTimeout(() => doClose(`${otherName} ha rifiutato la sfida`), 1500);
      } else if (g.status === 'cancelled') {
        setStatus('cancelled');
        setTimeout(() => doClose('Sfida annullata'), 1000);
      }
    });
    return () => { if (subRef.current) supabase.removeChannel(subRef.current); };
  }, [gameId, onAccepted, doClose, otherName]);

  // Countdown timer
  useEffect(() => {
    if (status !== 'waiting') return;
    const iv = setInterval(() => {
      setCountdown(p => {
        if (p <= 1) {
          clearInterval(iv);
          cancelGame(gameId);
          setStatus('timeout');
          setTimeout(() => doClose('Tempo scaduto'), 1000);
          return 0;
        }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [status, gameId, doClose]);

  const handleAccept = async () => {
    const { acceptGameInvite } = await import('../../lib/supabase');
    await acceptGameInvite(gameId);
  };

  const handleDecline = async () => {
    await declineGameInvite(gameId);
  };

  const handleCancel = async () => {
    await cancelGame(gameId);
  };

  const exitAnim = status === 'accepted' || status === 'declined' || status === 'cancelled' || status === 'timeout';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)',
      animation: 'tradeOverlayIn 0.3s ease',
      opacity: exitAnim ? 0.5 : 1,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{
        background: '#1a1a1a', borderRadius: 20, padding: '36px 48px',
        minWidth: 320, maxWidth: 420, textAlign: 'center',
        border: '1px solid #333',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'tradePopIn 0.3s ease',
        transform: exitAnim ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.3s ease',
      }}>
        {/* Game icon */}
        <div style={{ fontSize: 56, marginBottom: 12 }}>{gameIcon}</div>

        {/* Title */}
        <div style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', marginBottom: 6 }}>
          {role === 'target' ? `${otherName} ti sfida!` : `Sfida inviata a ${otherName}`}
        </div>

        {/* Game type */}
        <div style={{ fontSize: 16, color: '#F28C28', fontWeight: 600, marginBottom: 20 }}>
          {gameLabel}
        </div>

        {/* Status message */}
        <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>
          {status === 'waiting' && role === 'proposer' && 'Attesa risposta...'}
          {status === 'waiting' && role === 'target' && 'Vuoi accettare la sfida?'}
          {status === 'accepted' && '✅ Sfida accettata!'}
          {status === 'declined' && '❌ Sfida rifiutata'}
          {status === 'cancelled' && '⚠️ Sfida annullata'}
          {status === 'timeout' && '⏰ Tempo scaduto'}
        </div>

        {/* Countdown bar */}
        {status === 'waiting' && (
          <div style={{
            height: 4, borderRadius: 2, background: '#2a2a2a',
            marginBottom: 24, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: countdown <= 3 ? '#EF4444' : '#F28C28',
              width: `${(countdown / TIMEOUT) * 100}%`,
              transition: 'width 1s linear, background 0.3s ease',
            }} />
          </div>
        )}

        {/* Countdown number */}
        {status === 'waiting' && (
          <div style={{
            fontSize: 32, fontWeight: 900, fontFamily: '"Courier New", monospace',
            color: countdown <= 3 ? '#EF4444' : '#F28C28',
            marginBottom: 24,
            animation: countdown <= 3 ? 'pulse 0.5s ease infinite' : 'none',
          }}>
            {countdown}
          </div>
        )}

        {/* Buttons */}
        {status === 'waiting' && role === 'target' && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={handleAccept} style={{
              padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: '#22C55E', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              Accetta
            </button>
            <button onClick={handleDecline} style={{
              padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: '#333', color: '#aaa', border: '1px solid #444', cursor: 'pointer',
            }}>
              Rifiuta
            </button>
          </div>
        )}

        {status === 'waiting' && role === 'proposer' && (
          <button onClick={handleCancel} style={{
            padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
            background: '#333', color: '#aaa', border: '1px solid #444', cursor: 'pointer',
          }}>
            Annulla
          </button>
        )}
      </div>
    </div>
  );
}
