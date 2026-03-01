import { useState, useMemo, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';

// Chess game component using chess.js for logic + react-chessboard for UI
// myColor: 1 = white (proposer), 2 = black (target)

export default function ChessGame({ fen, myColor, isMyTurn, onMove, isMobile }) {
  const [moveFrom, setMoveFrom] = useState(null);
  const [optionSquares, setOptionSquares] = useState({});
  const [rightClickedSquares, setRightClickedSquares] = useState({});

  const game = useMemo(() => {
    const g = new Chess();
    if (fen && fen !== 'start') g.load(fen);
    return g;
  }, [fen]);

  const myColorStr = myColor === 1 ? 'w' : 'b';
  const boardOrientation = myColor === 1 ? 'white' : 'black';
  const boardWidth = isMobile ? Math.min(window.innerWidth * 0.88, 360) : 480;

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
    const moveData = {
      from: moveFrom,
      to: square,
      promotion: 'q', // auto-promote to queen
    };

    let result = null;
    try {
      result = game.move(moveData);
    } catch (e) {
      // Invalid move
    }

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
      return;
    }

    // Valid move
    const newFen = game.fen();
    const isCheckmate = game.isCheckmate();
    const isDraw = game.isDraw();
    const isStalemate = game.isStalemate();

    setMoveFrom(null);
    setOptionSquares({});

    onMove({
      fen: newFen,
      lastMove: { from: moveData.from, to: moveData.to },
      won: isCheckmate,
      draw: isDraw || isStalemate,
      moveNotation: result.san,
    });

    // Undo the move on our local instance since the state comes from the server
    game.undo();
  }, [game, isMyTurn, moveFrom, myColorStr, getMoveOptions, onMove]);

  // Drag and drop
  const onDrop = useCallback((sourceSquare, targetSquare) => {
    if (!isMyTurn) return false;

    const moveData = {
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    };

    let result = null;
    try {
      result = game.move(moveData);
    } catch (e) {
      return false;
    }
    if (result === null) return false;

    const newFen = game.fen();
    const isCheckmate = game.isCheckmate();
    const isDraw = game.isDraw();
    const isStalemate = game.isStalemate();

    setMoveFrom(null);
    setOptionSquares({});

    onMove({
      fen: newFen,
      lastMove: { from: sourceSquare, to: targetSquare },
      won: isCheckmate,
      draw: isDraw || isStalemate,
      moveNotation: result.san,
    });

    game.undo();
    return true;
  }, [game, isMyTurn, onMove]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
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
    </div>
  );
}
