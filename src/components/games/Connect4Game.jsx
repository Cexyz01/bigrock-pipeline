import { useState } from 'react';

const ROWS = 6, COLS = 7;
const EMPTY = 0, P1 = 1, P2 = 2;

/* ── Pure game logic ── */

function dropPiece(board, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === EMPTY) {
      const nb = board.map(row => [...row]);
      nb[r][col] = player;
      return { board: nb, row: r };
    }
  }
  return null; // column full
}

function checkWin(board, row, col) {
  const p = board[row][col];
  if (!p) return false;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (let s = 1; s <= 3; s++) {
      const r = row + dr * s, c = col + dc * s;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== p) break;
      count++;
    }
    for (let s = 1; s <= 3; s++) {
      const r = row - dr * s, c = col - dc * s;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== p) break;
      count++;
    }
    if (count >= 4) return true;
  }
  return false;
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== EMPTY);
}

/* ── Component ── */

export default function Connect4Game({ board, myColor, isMyTurn, onMove, lastMove, isMobile }) {
  const [hoverCol, setHoverCol] = useState(-1);
  const cellSize = isMobile ? 44 : 60;
  const gap = isMobile ? 3 : 4;

  const handleClick = (col) => {
    if (!isMyTurn) return;
    if (board[0][col] !== EMPTY) return; // full column

    const result = dropPiece(board, col, myColor);
    if (!result) return;

    const won = checkWin(result.board, result.row, col);
    const draw = !won && isBoardFull(result.board);

    onMove({
      board: result.board,
      lastMove: { row: result.row, col },
      won,
      draw,
    });
  };

  const colors = {
    [EMPTY]: '#1a1a2e',
    [P1]: '#EF4444',    // red
    [P2]: '#EAB308',    // yellow
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* Turn indicator */}
      <div style={{
        fontSize: isMobile ? 14 : 16, fontWeight: 700,
        color: isMyTurn ? '#00ff41' : '#888',
        padding: '6px 16px', borderRadius: 8,
        background: isMyTurn ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.05)',
      }}>
        {isMyTurn ? '🎯 Your turn!' : '⏳ Waiting...'}
      </div>

      {/* Board */}
      <div
        style={{
          display: 'inline-grid',
          gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
          gap,
          padding: gap * 2,
          borderRadius: 12,
          background: '#1E40AF',
          boxShadow: '0 8px 32px rgba(30,64,175,0.4)',
        }}
      >
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isLast = lastMove && lastMove.row === r && lastMove.col === c;
            const isHover = hoverCol === c && isMyTurn && board[0][c] === EMPTY;
            const showPreview = isHover && r === (() => {
              for (let rr = ROWS - 1; rr >= 0; rr--) if (board[rr][c] === EMPTY) return rr;
              return -1;
            })();

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleClick(c)}
                onMouseEnter={() => setHoverCol(c)}
                onMouseLeave={() => setHoverCol(-1)}
                style={{
                  width: cellSize, height: cellSize, borderRadius: '50%',
                  background: cell !== EMPTY ? colors[cell]
                    : showPreview ? `${colors[myColor]}44` : colors[EMPTY],
                  cursor: isMyTurn && board[0][c] === EMPTY ? 'pointer' : 'default',
                  transition: 'background 0.15s ease, box-shadow 0.2s ease',
                  boxShadow: isLast
                    ? `0 0 0 3px #fff, 0 0 12px ${colors[cell]}88`
                    : cell !== EMPTY
                      ? `inset 0 -3px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)`
                      : 'inset 0 3px 8px rgba(0,0,0,0.4)',
                }}
              />
            );
          })
        )}
      </div>

      {/* Color legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: isMobile ? 12 : 13, color: '#888' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: colors[myColor], display: 'inline-block' }} />
          You
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: colors[myColor === P1 ? P2 : P1], display: 'inline-block' }} />
          Opponent
        </span>
      </div>
    </div>
  );
}
