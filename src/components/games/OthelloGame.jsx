import { useState, useMemo, useCallback } from 'react';

// Othello/Reversi — full game logic
// Board: 8x8, 0=empty, 1=black(proposer), 2=white(target)
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function getFlips(board, row, col, player) {
  if (board[row][col] !== 0) return [];
  const opp = player === 1 ? 2 : 1;
  const allFlips = [];
  for (const [dr, dc] of DIRS) {
    const flips = [];
    let r = row + dr, c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opp) {
      flips.push([r, c]);
      r += dr; c += dc;
    }
    if (flips.length > 0 && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === player) {
      allFlips.push(...flips);
    }
  }
  return allFlips;
}

function getValidMoves(board, player) {
  const moves = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (getFlips(board, r, c, player).length > 0) moves.push([r, c]);
    }
  }
  return moves;
}

function countPieces(board) {
  let b = 0, w = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if (board[r][c] === 1) b++;
    else if (board[r][c] === 2) w++;
  }
  return { black: b, white: w };
}

function isGameOver(board) {
  return getValidMoves(board, 1).length === 0 && getValidMoves(board, 2).length === 0;
}

export default function OthelloGame({ board, myColor, isMyTurn, onMove, lastMove, isMobile }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  const validMoves = useMemo(() => {
    if (!isMyTurn) return [];
    return getValidMoves(board, myColor);
  }, [board, myColor, isMyTurn]);

  const validSet = useMemo(() => {
    const s = new Set();
    validMoves.forEach(([r, c]) => s.add(`${r},${c}`));
    return s;
  }, [validMoves]);

  const pieces = useMemo(() => countPieces(board), [board]);

  const handleClick = useCallback((row, col) => {
    if (!isMyTurn) return;
    const flips = getFlips(board, row, col, myColor);
    if (flips.length === 0) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = myColor;
    for (const [fr, fc] of flips) newBoard[fr][fc] = myColor;

    // Check if game is over
    const opp = myColor === 1 ? 2 : 1;
    const oppMoves = getValidMoves(newBoard, opp);
    const myMoves = getValidMoves(newBoard, myColor);
    const gameOver = oppMoves.length === 0 && myMoves.length === 0;
    const noOppMoves = oppMoves.length === 0 && !gameOver; // opponent passes

    const finalPieces = countPieces(newBoard);
    let won = false, draw = false;
    if (gameOver) {
      if (finalPieces.black === finalPieces.white) draw = true;
      else won = (myColor === 1 && finalPieces.black > finalPieces.white) || (myColor === 2 && finalPieces.white > finalPieces.black);
    }

    onMove({
      board: newBoard,
      lastMove: [row, col],
      won,
      draw,
      skipNextTurn: noOppMoves, // opponent has no moves, current player goes again
    });
  }, [board, myColor, isMyTurn, onMove]);

  const cellSize = isMobile ? 40 : 52;
  const boardSize = cellSize * 8;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, fontSize: 15, fontWeight: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: myColor === 1 ? '#F1F5F9' : '#888' }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', background: '#111', border: '2px solid #555',
            display: 'inline-block',
          }} />
          <span>{pieces.black}</span>
        </div>
        <span style={{ color: '#555', fontSize: 13 }}>vs</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: myColor === 2 ? '#F1F5F9' : '#888' }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', background: '#F1F5F9', border: '2px solid #aaa',
            display: 'inline-block',
          }} />
          <span>{pieces.white}</span>
        </div>
      </div>

      {/* Turn indicator */}
      <div style={{ fontSize: 13, color: isMyTurn ? '#22C55E' : '#888', fontWeight: 600 }}>
        {isMyTurn
          ? (validMoves.length > 0 ? 'Il tuo turno' : 'Nessuna mossa disponibile...')
          : "Turno dell'avversario..."
        }
      </div>

      {/* Board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(8, ${cellSize}px)`,
          gridTemplateRows: `repeat(8, ${cellSize}px)`,
          background: '#0B6623',
          borderRadius: 8,
          border: '3px solid #084C1B',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
        onMouseLeave={() => setHoveredCell(null)}
      >
        {board.map((row, r) => row.map((cell, c) => {
          const isValid = validSet.has(`${r},${c}`);
          const isHovered = hoveredCell && hoveredCell[0] === r && hoveredCell[1] === c;
          const isLast = lastMove && lastMove[0] === r && lastMove[1] === c;

          return (
            <div
              key={`${r}-${c}`}
              onClick={() => isValid && handleClick(r, c)}
              onMouseEnter={() => isValid && setHoveredCell([r, c])}
              style={{
                width: cellSize, height: cellSize,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isValid ? 'pointer' : 'default',
                borderRight: c < 7 ? '1px solid #095E1F' : 'none',
                borderBottom: r < 7 ? '1px solid #095E1F' : 'none',
                background: isLast ? 'rgba(255,255,0,0.15)' : isHovered ? 'rgba(255,255,255,0.1)' : 'transparent',
                position: 'relative',
              }}
            >
              {cell !== 0 && (
                <div style={{
                  width: cellSize * 0.72, height: cellSize * 0.72,
                  borderRadius: '50%',
                  background: cell === 1
                    ? 'radial-gradient(circle at 35% 35%, #444, #111)'
                    : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                  boxShadow: cell === 1
                    ? '0 2px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.1)'
                    : '0 2px 6px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.5)',
                  transition: 'all 0.3s ease',
                }} />
              )}

              {/* Valid move indicator */}
              {isValid && cell === 0 && !isHovered && (
                <div style={{
                  width: cellSize * 0.2, height: cellSize * 0.2,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.25)',
                }} />
              )}

              {/* Hover preview */}
              {isHovered && cell === 0 && (
                <div style={{
                  width: cellSize * 0.72, height: cellSize * 0.72,
                  borderRadius: '50%',
                  background: myColor === 1
                    ? 'radial-gradient(circle at 35% 35%, #444, #111)'
                    : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                  opacity: 0.5,
                }} />
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
