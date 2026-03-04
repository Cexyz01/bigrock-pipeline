import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, getGameById, makeGameMove, cancelGame, subscribeToGameSession, grantPackReward } from '../../lib/supabase';
import { IconX } from '../ui/Icons';
import Connect4Game from './Connect4Game';
import OthelloGame from './OthelloGame';
import ChessGame from './ChessGame';
import UnoGame from './UnoGame';
import SnakeBattleGame from './SnakeBattleGame';
import TriviaQuizGame from './TriviaQuizGame';
import TriviaRewardOverlay from './TriviaRewardOverlay';

const GAME_LABELS = { connect4: 'Forza 4', othello: 'Othello', chess: 'Scacchi', uno: 'UNO', snake_battle: 'Snake Battle', trivia_quiz: 'Trivia Quiz' };
const GAME_ICONS = { connect4: '🔴', othello: '⚫', chess: '♟️', uno: '🃏', snake_battle: '🐍', trivia_quiz: '🧠' };

// Keys from the raw DB row that realtime sends (no joined data)
const RAW_KEYS = ['id', 'game_type', 'proposer_id', 'target_id', 'status', 'game_state', 'current_turn', 'winner_id', 'created_at', 'updated_at'];

export default function GameSession({ gameId, user, onClose, addToast }) {
  const [game, setGame] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [endState, setEndState] = useState(null); // null | { winner, draw }
  const [triviaResult, setTriviaResult] = useState(null); // { score, totalQuestions, packsWon, tcgGranted }
  const [isMobile] = useState(() => window.innerWidth < 768);
  const subRef = useRef(null);
  const closedRef = useRef(false);
  const profilesRef = useRef(null); // preserve joined profile data

  // Load game data with retry
  useEffect(() => {
    let cancelled = false;
    const load = async (retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const { data, error } = await getGameById(gameId);
          if (cancelled) return;
          if (data) {
            // Store profile data separately so realtime can't overwrite it
            profilesRef.current = { proposer: data.proposer, target: data.target };
            setGame(data);
            setLoadError(false);
            return;
          }
          if (error) console.warn('[GameSession] getGameById error:', error.message);
        } catch (err) {
          if (cancelled) return;
          console.warn('[GameSession] getGameById exception:', err);
        }
        // Wait before retry (200ms, 600ms, 1200ms)
        if (i < retries - 1) await new Promise(r => setTimeout(r, 200 * (i + 1) * (i + 1)));
      }
      if (!cancelled) setLoadError(true);
    };
    load();
    return () => { cancelled = true; };
  }, [gameId]);

  // Realtime subscription
  useEffect(() => {
    subRef.current = subscribeToGameSession(gameId, (payload) => {
      const raw = payload.new;

      // Merge only raw DB fields — preserve joined profile data
      setGame(prev => {
        if (!prev) {
          // Game not yet loaded via getGameById — use raw data + any cached profiles
          return { ...raw, ...(profilesRef.current || {}) };
        }
        // Merge: only overwrite raw DB keys, keep joined profile objects intact
        const merged = { ...prev };
        for (const k of RAW_KEYS) {
          if (k in raw) merged[k] = raw[k];
        }
        return merged;
      });

      if (raw.status === 'completed') {
        setEndState({
          winner: raw.winner_id,
          draw: !raw.winner_id,
        });
      } else if (raw.status === 'cancelled') {
        setEndState({ cancelled: true, cancelledBy: raw.winner_id });
      }
    });
    return () => { if (subRef.current) supabase.removeChannel(subRef.current); };
  }, [gameId]);

  // Derived values (safe even when game is null)
  const amProposer = game ? user.id === game.proposer_id : false;
  const myColor = amProposer ? 1 : 2; // proposer = P1 (red), target = P2 (yellow)
  const isMyTurn = game ? game.current_turn === user.id : false;
  const gameState = game?.game_state || {};
  const proposerName = game?.proposer?.full_name || 'Player 1';
  const targetName = game?.target?.full_name || 'Player 2';
  const gameLabel = GAME_LABELS[game?.game_type] || game?.game_type || '';
  const gameIcon = GAME_ICONS[game?.game_type] || '🎮';

  const handleClose = useCallback(async () => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (!endState && game?.status === 'active') {
      // Forfeit: cancel game, other player wins
      await cancelGame(gameId);
    }
    onClose();
  }, [endState, game, gameId, onClose]);

  // Handle move from game component
  const handleMove = useCallback(async (moveResult) => {
    let nextTurn = amProposer ? game.target_id : game.proposer_id;
    const winnerId = moveResult.won ? user.id : moveResult.draw ? 'draw' : null;

    // Othello: if opponent has no moves, current player goes again
    if (moveResult.skipNextTurn) nextTurn = user.id;

    // UNO: skip opponent (draw2, wild_draw4, skip) or keep turn (after drawing)
    if (moveResult.skipOpponent) nextTurn = user.id;
    if (moveResult.keepTurn) nextTurn = user.id;

    // Snake Battle & Trivia Quiz: real-time games, only write DB on game end
    if (game.game_type === 'snake_battle') {
      // Snake only calls onMove at game end with { won, draw }
      await makeGameMove(gameId, gameState, nextTurn, winnerId);
      return;
    }
    if (game.game_type === 'trivia_quiz') {
      // Solo challenge — only called once at game end with { score, totalQuestions, won }
      const triviaScore = moveResult.score || 0;
      const packsWon = triviaScore >= 10 ? 2 : triviaScore >= 7 ? 1 : 0;
      const finalWinner = moveResult.won ? user.id : null;

      // Grant packs if earned
      let tcgGranted = false;
      if (packsWon > 0) {
        const result = await grantPackReward(user.id, packsWon);
        tcgGranted = result.granted;
      }

      // Save final result to DB
      const newState = { ...gameState, score: triviaScore, completed: true };
      await makeGameMove(gameId, newState, game.proposer_id, finalWinner);

      // Show trivia reward overlay instead of standard end popup
      setTriviaResult({ score: triviaScore, totalQuestions: moveResult.totalQuestions || 10, packsWon, tcgGranted });
      return;
    }

    let newState = {};
    if (game.game_type === 'chess') {
      newState.fen = moveResult.fen;
      newState.lastMove = moveResult.lastMove;
      if (moveResult.moveNotation) newState.moveNotation = moveResult.moveNotation;
      if (moveResult.clocks) newState.clocks = moveResult.clocks;
      newState.lastMoveTime = Date.now();
    } else if (game.game_type === 'uno') {
      // UNO: full state replacement
      newState = {
        hands: moveResult.hands,
        drawPile: moveResult.drawPile,
        discardPile: moveResult.discardPile,
        direction: moveResult.direction,
        chosenColor: moveResult.chosenColor,
        lastAction: moveResult.lastAction,
      };
    } else {
      newState.board = moveResult.board;
      newState.lastMove = moveResult.lastMove;
    }

    await makeGameMove(gameId, newState, nextTurn, winnerId);
  }, [gameId, game, amProposer, user.id]);

  // ── Loading state: show dark backdrop with spinner ──
  if (!game) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ textAlign: 'center' }}>
          {loadError ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
              <div style={{ color: '#F28C28', fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
                Errore caricamento partita
              </div>
              <button onClick={onClose} style={{
                padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
                background: '#333', color: '#aaa', border: '1px solid #444', cursor: 'pointer',
              }}>
                Chiudi
              </button>
            </>
          ) : (
            <>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: '3px solid #333', borderTopColor: '#F28C28',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }} />
              <div style={{ color: '#888', fontSize: 14 }}>Caricamento partita...</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // End state popup content
  const renderEndPopup = () => {
    if (!endState) return null;

    let title, emoji, color;
    if (endState.cancelled) {
      title = 'Partita annullata';
      emoji = '⚠️';
      color = '#F28C28';
    } else if (endState.draw) {
      title = 'Pareggio!';
      emoji = '🤝';
      color = '#F28C28';
    } else if (endState.winner === user.id) {
      title = 'Hai vinto!';
      emoji = '🎉';
      color = '#22C55E';
    } else {
      title = 'Hai perso!';
      emoji = '😢';
      color = '#EF4444';
    }

    return (
      <div style={{
        position: 'absolute', inset: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        borderRadius: 16,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>{emoji}</div>
          <div style={{ fontSize: 28, fontWeight: 900, color, marginBottom: 24 }}>{title}</div>
          <button onClick={handleClose} style={{
            padding: '12px 36px', borderRadius: 10, fontSize: 16, fontWeight: 700,
            background: color, color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            OK
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      animation: 'tradeOverlayIn 0.3s ease',
    }}>
      <div style={{
        position: 'relative',
        width: isMobile ? '95%' : '60%',
        maxWidth: 700,
        maxHeight: '90vh',
        background: '#1a1a1a',
        borderRadius: 16,
        border: '1px solid #333',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'tradePopIn 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '12px 16px' : '16px 24px',
          borderBottom: '1px solid #2a2a2a',
          background: '#111',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{gameIcon}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9' }}>{gameLabel}</span>
          </div>

          {/* Player names */}
          {game.game_type !== 'snake_battle' && game.game_type !== 'trivia_quiz' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{
                color: game.current_turn === game.proposer_id ? (game.game_type === 'chess' ? '#F1F5F9' : '#EF4444') : '#666',
                fontWeight: game.current_turn === game.proposer_id ? 700 : 400,
              }}>
                {game.game_type === 'chess' ? '♔' : game.game_type === 'othello' ? '⚫' : game.game_type === 'uno' ? '🃏' : '🔴'} {proposerName}
              </span>
              <span style={{ color: '#444' }}>vs</span>
              <span style={{
                color: game.current_turn === game.target_id ? (game.game_type === 'chess' ? '#F1F5F9' : '#EAB308') : '#666',
                fontWeight: game.current_turn === game.target_id ? 700 : 400,
              }}>
                {game.game_type === 'chess' ? '♚' : game.game_type === 'othello' ? '⚪' : game.game_type === 'uno' ? '🃏' : '🟡'} {targetName}
              </span>
            </div>
          )}

          <button onClick={handleClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#666', padding: 4,
          }}>
            <IconX size={20} />
          </button>
        </div>

        {/* Game area */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: isMobile ? 16 : 32,
          overflowY: 'auto',
        }}>
          {game.game_type === 'connect4' && (
            <Connect4Game
              board={gameState.board || Array.from({ length: 6 }, () => Array(7).fill(0))}
              myColor={myColor}
              isMyTurn={isMyTurn && !endState}
              onMove={handleMove}
              lastMove={gameState.lastMove}
              isMobile={isMobile}
            />
          )}

          {game.game_type === 'othello' && (
            <OthelloGame
              board={gameState.board || (() => {
                const b = Array.from({ length: 8 }, () => Array(8).fill(0));
                b[3][3] = 2; b[3][4] = 1; b[4][3] = 1; b[4][4] = 2;
                return b;
              })()}
              myColor={myColor}
              isMyTurn={isMyTurn && !endState}
              onMove={handleMove}
              lastMove={gameState.lastMove}
              isMobile={isMobile}
            />
          )}

          {game.game_type === 'chess' && (
            <ChessGame
              fen={gameState.fen || 'start'}
              myColor={myColor}
              isMyTurn={isMyTurn && !endState}
              onMove={handleMove}
              isMobile={isMobile}
              clocks={gameState.clocks || { w: 600, b: 600 }}
              lastMoveTime={gameState.lastMoveTime}
            />
          )}

          {game.game_type === 'uno' && (
            <UnoGame
              gameState={gameState}
              myId={user.id}
              opponentId={amProposer ? game.target_id : game.proposer_id}
              isMyTurn={isMyTurn && !endState}
              onMove={handleMove}
              isMobile={isMobile}
            />
          )}

          {game.game_type === 'snake_battle' && (
            <SnakeBattleGame
              gameState={gameState}
              myId={user.id}
              opponentId={amProposer ? game.target_id : game.proposer_id}
              onMove={handleMove}
              isMobile={isMobile}
              gameId={gameId}
            />
          )}

          {game.game_type === 'trivia_quiz' && !triviaResult && (
            <TriviaQuizGame
              gameState={gameState}
              onMove={handleMove}
              isMobile={isMobile}
            />
          )}
        </div>

        {/* End state overlay */}
        {game.game_type === 'trivia_quiz' && triviaResult && (
          <TriviaRewardOverlay
            score={triviaResult.score}
            totalQuestions={triviaResult.totalQuestions}
            packsWon={triviaResult.packsWon}
            tcgGranted={triviaResult.tcgGranted}
            onClose={handleClose}
          />
        )}
        {game.game_type !== 'trivia_quiz' && renderEndPopup()}
      </div>
    </div>
  );
}
