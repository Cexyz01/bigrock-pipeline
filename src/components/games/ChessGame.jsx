import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

// Chess game component using chess.js for logic + react-chessboard for UI
// myColor: 1 = white (proposer), 2 = black (target)
// clocks: { w: seconds, b: seconds } — 600s = 10 minutes each

const INITIAL_TIME = 600; // 10 minutes in seconds

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ChessGame({ fen, myColor, isMyTurn, onMove, isMobile, clocks, lastMoveTime }) {
  const [moveFrom, setMoveFrom] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [rightClickedSquares, setRightClickedSquares] = useState({});

  // Clock state — local countdown
  const [whiteTime, setWhiteTime] = useState(clocks?.w ?? INITIAL_TIME);
  const [blackTime, setBlackTime] = useState(clocks?.b ?? INITIAL_TIME);
  const clockRef = useRef(null);
  const lastSyncRef = useRef(Date.now());

  const game = useMemo(() => {
    const g = new Chess();
    if (fen && fen !== 'start') g.load(fen);
    return g;
  }, [fen]);

  const myColorStr = myColor === 1 ? 'w' : 'b';
  const boardOrientation = myColor === 1 ? 'white' : 'black';
  const boardWidth = isMobile ? Math.min(window.innerWidth * 0.88, 360) : 480;
  const activeColor = game.turn(); // 'w' or 'b'
  const isGameOver = game.isGameOver();

  // Sync clocks from server state
  useEffect(() => {
    if (!clocks) return;
    let w = clocks.w;
    let b = clocks.b;
    // If there's a lastMoveTime, subtract elapsed time for the active player
    if (lastMoveTime && !isGameOver) {
      const elapsed = (Date.now() - lastMoveTime) / 1000;
      if (activeColor === 'w') w = Math.max(0, w - elapsed);
      else b = Math.max(0, b - elapsed);
    }
    setWhiteTime(w);
    setBlackTime(b);
    lastSyncRef.current = Date.now();
  }, [clocks, lastMoveTime, activeColor, isGameOver]);

  // Local countdown tick (1s interval)
  useEffect(() => {
    if (isGameOver) return;
    clockRef.current = setInterval(() => {
      if (activeColor === 'w') {
        setWhiteTime(t => {
          const next = Math.max(0, t - 1);
          if (next <= 0) {
            clearInterval(clockRef.current);
            // White ran out of time — if I'm white, I lose; if I'm black, I win
            if (myColorStr === 'w') {
              onMove({ fen: game.fen(), lastMove: null, won: false, draw: false, timeout: true, clocks: { w: 0, b: blackTime } });
            } else {
              onMove({ fen: game.fen(), lastMove: null, won: true, draw: false, timeout: true, clocks: { w: 0, b: blackTime } });
            }
          }
          return next;
        });
      } else {
        setBlackTime(t => {
          const next = Math.max(0, t - 1);
          if (next <= 0) {
            clearInterval(clockRef.current);
            if (myColorStr === 'b') {
              onMove({ fen: game.fen(), lastMove: null, won: false, draw: false, timeout: true, clocks: { w: whiteTime, b: 0 } });
            } else {
              onMove({ fen: game.fen(), lastMove: null, won: true, draw: false, timeout: true, clocks: { w: whiteTime, b: 0 } });
            }
          }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(clockRef.current);
  }, [activeColor, isGameOver, myColorStr]); // intentionally omit onMove/game/whiteTime/blackTime to avoid re-creating interval

  // Get possible moves for a square and highlight them
  const getMoveOptions = useCallback((square) => {
    const moves = game.moves({ square, verbose: true });
    if (moves.length === 0) {
      setOptionSquares({});
      return false;
    }
    const newSquares = {};
    moves.forEach((move) => {
      newSquares[move.to] = {
        background: game.get(move.to) && game.get(move.to).color !== game.get(square).color
          ? 'radial-gradient(circle, rgba(0,0,0,.1) 85%, transparent 85%)'
          : 'radial-gradient(circle, rgba(0,0,0,.2) 25%, transparent 25%)',
        borderRadius: '50%',
      };
    });
    newSquares[square] = { background: 'rgba(255, 255, 0, 0.4)' };
    setOptionSquares(newSquares);
    return true;
  }, [game]);

  const makeMove = useCallback((moveData) => {
    let result = null;
    try {
      result = game.move(moveData);
    } catch (e) {
      // Invalid move
    }
    if (result === null) return null;

    const newFen = game.fen();
    const isCheckmate = game.isCheckmate();
    const isDraw = game.isDraw();
    const isStalemate = game.isStalemate();

    // Snapshot current clocks at time of move
    const movingColor = result.color; // 'w' or 'b'
    const newClocks = {
      w: movingColor === 'w' ? Math.max(0, whiteTime) : whiteTime,
      b: movingColor === 'b' ? Math.max(0, blackTime) : blackTime,
    };

    setMoveFrom(null);
    setOptionSquares({});

    onMove({
      fen: newFen,
      lastMove: { from: moveData.from, to: moveData.to },
      won: isCheckmate,
      draw: isDraw || isStalemate,
      moveNotation: result.san,
      clocks: newClocks,
    });

    // Undo the move on our local instance since the state comes from the server
    game.undo();
    return result;
  }, [game, onMove, whiteTime, blackTime]);

  const onSquareClick = useCallback((square) => {
    if (!isMyTurn) return;
    setRightClickedSquares({});

    // If no piece selected, select this one
    if (!moveFrom) {
      const piece = game.get(square);
      if (piece && piece.color === myColorStr) {
        setMoveFrom(square);
        getMoveOptions(square);
      }
      return;
    }

    // Try to make the move
    const result = makeMove({ from: moveFrom, to: square, promotion: 'q' });

    if (result === null) {
      // Invalid move — check if clicking another of our pieces
      const piece = game.get(square);
      if (piece && piece.color === myColorStr) {
        setMoveFrom(square);
        getMoveOptions(square);
      } else {
        setMoveFrom(null);
        setOptionSquares({});
      }
    }
  }, [game, isMyTurn, moveFrom, myColorStr, getMoveOptions, makeMove]);

  // Drag and drop
  const onDrop = useCallback((sourceSquare, targetSquare) => {
    if (!isMyTurn) return false;
    const result = makeMove({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    return result !== null;
  }, [isMyTurn, makeMove]);

  const isDraggablePiece = useCallback(({ piece }) => {
    if (!isMyTurn) return false;
    return piece[0] === myColorStr;
  }, [isMyTurn, myColorStr]);

  // Custom square styles
  const customSquareStyles = useMemo(() => {
    const styles = { ...optionSquares, ...rightClickedSquares };
    if (game.inCheck()) {
      // Highlight king in check
      const board = game.board();
      const turn = game.turn();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c];
          if (p && p.type === 'k' && p.color === turn) {
            const file = String.fromCharCode(97 + c);
            const rank = 8 - r;
            styles[`${file}${rank}`] = {
              background: 'radial-gradient(circle, rgba(255,0,0,0.5) 0%, rgba(255,0,0,0.2) 70%, transparent 70%)',
            };
          }
        }
      }
    }
    return styles;
  }, [game, optionSquares, rightClickedSquares]);

  // Clock component
  const ClockDisplay = ({ time, isActive, label, color }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', borderRadius: 8,
      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
      border: isActive ? '1px solid #444' : '1px solid transparent',
    }}>
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      <span style={{
        fontSize: 20, fontWeight: 900, fontFamily: '"Courier New", monospace',
        color: time <= 30 ? '#EF4444' : time <= 120 ? '#F28C28' : color,
        animation: isActive && time <= 30 ? 'pulse 0.5s ease infinite' : 'none',
      }}>
        {formatClock(time)}
      </span>
    </div>
  );

  // Top clock = opponent, bottom clock = me
  const topTime = myColor === 1 ? blackTime : whiteTime;
  const topActive = myColor === 1 ? activeColor === 'b' : activeColor === 'w';
  const topLabel = myColor === 1 ? '♚' : '♔';
  const topColor = '#F1F5F9';

  const botTime = myColor === 1 ? whiteTime : blackTime;
  const botActive = myColor === 1 ? activeColor === 'w' : activeColor === 'b';
  const botLabel = myColor === 1 ? '♔' : '♚';
  const botColor = '#F1F5F9';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {/* Opponent clock (top) */}
      <ClockDisplay time={topTime} isActive={topActive && !isGameOver} label={topLabel} color={topColor} />

      {/* Turn indicator */}
      <div style={{ fontSize: 13, color: isMyTurn ? '#22C55E' : '#888', fontWeight: 600 }}>
        {game.isCheckmate()
          ? '♔ Scacco matto!'
          : game.isDraw()
          ? '🤝 Patta'
          : game.inCheck()
          ? (isMyTurn ? '⚠️ Sei sotto scacco!' : "⚠️ L'avversario è sotto scacco")
          : (isMyTurn ? 'Il tuo turno' : "Turno dell'avversario...")
        }
      </div>

      {/* Board */}
      <div style={{
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        border: '3px solid #333',
      }}>
        <Chessboard
          id="chess-game"
          position={fen || 'start'}
          boardWidth={boardWidth}
          boardOrientation={boardOrientation}
          onSquareClick={onSquareClick}
          onPieceDrop={onDrop}
          isDraggablePiece={isDraggablePiece}
          customSquareStyles={customSquareStyles}
          customBoardStyle={{
            borderRadius: '0px',
          }}
          customDarkSquareStyle={{ backgroundColor: '#779952' }}
          customLightSquareStyle={{ backgroundColor: '#edeed1' }}
          animationDuration={200}
        />
      </div>

      {/* My clock (bottom) */}
      <ClockDisplay time={botTime} isActive={botActive && !isGameOver} label={botLabel} color={botColor} />
    </div>
  );
}
