import { useState, useMemo, useCallback } from 'react';

/* ─── UNO Constants ─── */
const COLORS = ['red', 'blue', 'green', 'yellow'];
const COLOR_HEX = { red: '#DC2626', blue: '#2563EB', green: '#16A34A', yellow: '#EAB308', wild: '#1a1a1a' };

/* ─── SVG Sprite Constants ─── */
// Wikimedia UNO deck sprite: 3362×2882, 14 cols × 8 rows, each card ~240×360
const SPRITE_URL = '/assets/uno-deck.svg';
const SPRITE_COLS = 14;
const SPRITE_ROWS = 8;

// Row layout: Red(0), Yellow(1), Green(2), Blue(3), Red2(4), Yellow2(5), Green2(6), Blue2(7)
const COLOR_SPRITE_ROW = { red: 0, yellow: 1, green: 2, blue: 3 };

// Column layout: 0-9 numbers, 10 skip, 11 reverse, 12 draw2, 13 wild
const VALUE_SPRITE_COL = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'skip': 10, 'reverse': 11, 'draw2': 12,
};

function getCardSpritePos(card) {
  // Wild cards: use row 0 for wild, row 4 for wild_draw4
  if (card.value === 'wild') return { row: 0, col: 13 };
  if (card.value === 'wild_draw4') return { row: 4, col: 13 };
  const row = COLOR_SPRITE_ROW[card.color] ?? 0;
  const col = VALUE_SPRITE_COL[card.value] ?? 0;
  return { row, col };
}

/* ─── UNO Logic Helpers ─── */
function createDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ color, value: '0' }); // one 0 per color
    for (let i = 1; i <= 9; i++) { deck.push({ color, value: String(i) }); deck.push({ color, value: String(i) }); }
    for (const sp of ['skip', 'reverse', 'draw2']) { deck.push({ color, value: sp }); deck.push({ color, value: sp }); }
  }
  for (let i = 0; i < 4; i++) { deck.push({ color: 'wild', value: 'wild' }); deck.push({ color: 'wild', value: 'wild_draw4' }); }
  // Shuffle (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

function canPlayCard(card, topCard, chosenColor) {
  if (card.value === 'wild' || card.value === 'wild_draw4') return true;
  const activeColor = chosenColor || topCard.color;
  if (card.color === activeColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

export function createUnoInitialState(proposerId, targetId) {
  const deck = createDeck();
  const hand1 = deck.splice(0, 7);
  const hand2 = deck.splice(0, 7);
  // Find first non-wild card for discard
  let firstIdx = deck.findIndex(c => c.color !== 'wild');
  if (firstIdx === -1) firstIdx = 0;
  const [firstCard] = deck.splice(firstIdx, 1);
  return {
    hands: { [proposerId]: hand1, [targetId]: hand2 },
    drawPile: deck,
    discardPile: [firstCard],
    direction: 1, // 1 = normal, -1 = reversed (only matters in 2-player for reverse card)
    chosenColor: null, // set when wild is played
    lastAction: null,
  };
}

/* ─── UNO Card Component (SVG Sprite) ─── */
function UnoCard({ card, small, faceDown, playable, onClick, style }) {
  const w = small ? 48 : 68;
  const h = small ? 72 : 102;
  const radius = small ? 7 : 10;

  if (faceDown) {
    return (
      <div style={{
        width: w, height: h, borderRadius: radius, flexShrink: 0,
        background: 'linear-gradient(135deg, #1a1a1a 0%, #333 100%)',
        border: '2px solid #555',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        ...style,
      }}>
        <div style={{
          width: w * 0.7, height: h * 0.55, borderRadius: 100,
          background: '#DC2626',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: 'rotate(-20deg)',
        }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: small ? 10 : 14, fontStyle: 'italic', letterSpacing: -0.5 }}>UNO</span>
        </div>
      </div>
    );
  }

  const { row, col } = getCardSpritePos(card);
  const bgPosX = SPRITE_COLS > 1 ? (col / (SPRITE_COLS - 1)) * 100 : 0;
  const bgPosY = SPRITE_ROWS > 1 ? (row / (SPRITE_ROWS - 1)) * 100 : 0;

  return (
    <div
      onClick={playable ? onClick : undefined}
      style={{
        width: w, height: h, borderRadius: radius, flexShrink: 0,
        backgroundImage: `url('${SPRITE_URL}')`,
        backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`,
        backgroundPosition: `${bgPosX}% ${bgPosY}%`,
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
        border: playable ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
        cursor: playable ? 'pointer' : 'default',
        boxShadow: playable
          ? '0 0 14px rgba(255,255,255,0.5), 0 4px 12px rgba(0,0,0,0.3)'
          : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        transform: playable ? 'translateY(-4px)' : 'none',
        ...style,
      }}
      onMouseEnter={e => { if (playable) e.currentTarget.style.transform = 'translateY(-12px) scale(1.05)'; }}
      onMouseLeave={e => { if (playable) e.currentTarget.style.transform = 'translateY(-4px)'; else e.currentTarget.style.transform = 'none'; }}
    />
  );
}

/* ─── Color Picker Modal ─── */
function ColorPicker({ onPick }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', borderRadius: 16,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', marginBottom: 16 }}>Scegli colore</div>
        <div style={{ display: 'flex', gap: 12 }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => onPick(c)} style={{
              width: 56, height: 56, borderRadius: 12,
              background: COLOR_HEX[c], border: '3px solid rgba(255,255,255,0.3)',
              cursor: 'pointer', transition: 'transform 0.15s ease',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Main UNO Game Component ─── */
export default function UnoGame({ gameState, myId, opponentId, isMyTurn, onMove, isMobile }) {
  const [pendingWild, setPendingWild] = useState(null); // card waiting for color pick
  const [drawnThisTurn, setDrawnThisTurn] = useState(false);

  const myHand = gameState.hands?.[myId] || [];
  const oppHand = gameState.hands?.[opponentId] || [];
  const discardTop = gameState.discardPile?.[gameState.discardPile.length - 1];
  const drawPileCount = gameState.drawPile?.length || 0;
  const activeColor = gameState.chosenColor || discardTop?.color;
  const lastAction = gameState.lastAction;

  // Reset drawn state when turn changes
  const playableCards = useMemo(() => {
    if (!isMyTurn || pendingWild) return new Set();
    const set = new Set();
    myHand.forEach((card, i) => {
      if (canPlayCard(card, discardTop, gameState.chosenColor)) set.add(i);
    });
    return set;
  }, [myHand, discardTop, gameState.chosenColor, isMyTurn, pendingWild]);

  const handlePlayCard = useCallback((card, idx) => {
    if (!isMyTurn) return;
    if (!canPlayCard(card, discardTop, gameState.chosenColor)) return;

    // Wild cards need color selection
    if (card.value === 'wild' || card.value === 'wild_draw4') {
      setPendingWild({ card, idx });
      return;
    }

    // Play the card
    const newHands = { ...gameState.hands };
    const newMyHand = [...myHand];
    newMyHand.splice(idx, 1);
    newHands[myId] = newMyHand;

    const newDiscard = [...gameState.discardPile, card];
    let newDrawPile = [...gameState.drawPile];
    let newDirection = gameState.direction;
    let skipOpponent = false;

    // Apply effects
    if (card.value === 'reverse') newDirection *= -1;
    if (card.value === 'skip') skipOpponent = true;
    if (card.value === 'draw2') {
      // Opponent draws 2
      const drawn = newDrawPile.splice(0, 2);
      newHands[opponentId] = [...(newHands[opponentId] || []), ...drawn];
      skipOpponent = true;
    }

    const won = newMyHand.length === 0;

    onMove({
      hands: newHands, drawPile: newDrawPile, discardPile: newDiscard,
      direction: newDirection, chosenColor: null,
      lastAction: { type: 'play', card, player: myId },
      skipOpponent, won, draw: false,
    });
    setDrawnThisTurn(false);
  }, [gameState, myHand, myId, opponentId, discardTop, isMyTurn, onMove]);

  const handleWildColorPick = useCallback((color) => {
    if (!pendingWild) return;
    const { card, idx } = pendingWild;
    setPendingWild(null);

    const newHands = { ...gameState.hands };
    const newMyHand = [...myHand];
    newMyHand.splice(idx, 1);
    newHands[myId] = newMyHand;

    const playedCard = { ...card, color }; // color is just for display
    const newDiscard = [...gameState.discardPile, playedCard];
    let newDrawPile = [...gameState.drawPile];
    let skipOpponent = false;

    if (card.value === 'wild_draw4') {
      const drawn = newDrawPile.splice(0, 4);
      newHands[opponentId] = [...(newHands[opponentId] || []), ...drawn];
      skipOpponent = true;
    }

    const won = newMyHand.length === 0;

    onMove({
      hands: newHands, drawPile: newDrawPile, discardPile: newDiscard,
      direction: gameState.direction, chosenColor: color,
      lastAction: { type: 'play', card: playedCard, player: myId, wildColor: color },
      skipOpponent, won, draw: false,
    });
    setDrawnThisTurn(false);
  }, [pendingWild, gameState, myHand, myId, opponentId, onMove]);

  const handleDraw = useCallback(() => {
    if (!isMyTurn || drawnThisTurn || pendingWild) return;
    if (drawPileCount === 0) return;

    const newDrawPile = [...gameState.drawPile];
    const newHands = { ...gameState.hands };
    const drawn = newDrawPile.splice(0, 1);
    newHands[myId] = [...myHand, ...drawn];

    setDrawnThisTurn(true);

    // Check if drawn card can be played
    const drawnCard = drawn[0];
    if (drawnCard && canPlayCard(drawnCard, discardTop, gameState.chosenColor)) {
      // Player can choose to play it or pass — update state, keep turn
      onMove({
        hands: newHands, drawPile: newDrawPile, discardPile: gameState.discardPile,
        direction: gameState.direction, chosenColor: gameState.chosenColor,
        lastAction: { type: 'draw', player: myId },
        skipOpponent: false, won: false, draw: false, keepTurn: true,
      });
    } else {
      // Can't play drawn card — pass turn
      onMove({
        hands: newHands, drawPile: newDrawPile, discardPile: gameState.discardPile,
        direction: gameState.direction, chosenColor: gameState.chosenColor,
        lastAction: { type: 'draw_pass', player: myId },
        skipOpponent: false, won: false, draw: false,
      });
      setDrawnThisTurn(false);
    }
  }, [isMyTurn, drawnThisTurn, pendingWild, gameState, myHand, myId, discardTop, drawPileCount, onMove]);

  const cardW = isMobile ? 48 : 68;

  return (
    <div style={{
      width: '100%', maxWidth: 600,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: isMobile ? 12 : 20,
      position: 'relative',
    }}>
      {/* Opponent hand (face down) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{
          display: 'flex', justifyContent: 'center',
          maxWidth: isMobile ? 320 : 500, overflow: 'hidden',
        }}>
          {oppHand.map((_, i) => (
            <UnoCard key={i} faceDown small style={{ marginLeft: i > 0 ? -(cardW * 0.45) : 0 }} />
          ))}
        </div>
        <span style={{
          fontSize: 12, fontWeight: 700, color: '#888',
          background: '#2a2a2a', borderRadius: 8, padding: '2px 8px', marginLeft: 8,
        }}>
          {oppHand.length}
        </span>
      </div>

      {/* Center area: discard pile + draw pile */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? 16 : 32,
        padding: isMobile ? 12 : 20,
      }}>
        {/* Draw pile */}
        <div
          onClick={isMyTurn && !drawnThisTurn && !pendingWild ? handleDraw : undefined}
          style={{
            cursor: isMyTurn && !drawnThisTurn && !pendingWild ? 'pointer' : 'default',
            position: 'relative',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={e => { if (isMyTurn && !drawnThisTurn) e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <UnoCard faceDown />
          <span style={{
            position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, color: '#888', fontWeight: 700, background: '#1a1a1a',
            padding: '1px 6px', borderRadius: 4,
          }}>
            {drawPileCount}
          </span>
          {isMyTurn && !drawnThisTurn && !pendingWild && (
            <div style={{
              position: 'absolute', inset: -2, borderRadius: 12,
              border: '2px dashed rgba(255,255,255,0.3)',
              animation: 'pulse 1.5s ease infinite',
            }} />
          )}
        </div>

        {/* Discard pile */}
        <div style={{ position: 'relative' }}>
          {discardTop && <UnoCard card={discardTop} />}
          {/* Active color indicator (when wild was played) */}
          {gameState.chosenColor && (
            <div style={{
              position: 'absolute', top: -10, right: -10,
              width: 24, height: 24, borderRadius: '50%',
              background: COLOR_HEX[gameState.chosenColor],
              border: '2px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }} />
          )}
        </div>
      </div>

      {/* Last action info */}
      {lastAction && (
        <div style={{ fontSize: 11, color: '#666', textAlign: 'center' }}>
          {lastAction.type === 'play' && lastAction.player !== myId && '🎴 L\'avversario ha giocato'}
          {lastAction.type === 'draw_pass' && lastAction.player !== myId && '📥 L\'avversario ha pescato e passato'}
          {lastAction.type === 'draw' && lastAction.player !== myId && '📥 L\'avversario ha pescato'}
        </div>
      )}

      {/* Turn indicator */}
      <div style={{
        fontSize: 13, fontWeight: 700,
        color: isMyTurn ? '#22C55E' : '#888',
      }}>
        {isMyTurn
          ? (playableCards.size > 0 ? 'Il tuo turno — gioca una carta' : (drawnThisTurn ? 'Gioca la carta pescata o passa' : 'Il tuo turno — pesca'))
          : "Turno dell'avversario..."
        }
      </div>

      {/* My hand */}
      <div style={{
        display: 'flex', justifyContent: 'center', flexWrap: 'nowrap',
        maxWidth: '100%', overflowX: 'auto',
        padding: '8px 4px 4px',
        WebkitOverflowScrolling: 'touch',
      }}>
        {myHand.map((card, i) => (
          <UnoCard
            key={`${card.color}-${card.value}-${i}`}
            card={card}
            playable={isMyTurn && playableCards.has(i)}
            onClick={() => handlePlayCard(card, i)}
            style={{ marginLeft: i > 0 ? -(cardW * 0.3) : 0 }}
          />
        ))}
        <span style={{
          fontSize: 12, fontWeight: 700, color: '#888',
          background: '#2a2a2a', borderRadius: 8, padding: '2px 8px',
          alignSelf: 'center', marginLeft: 8,
        }}>
          {myHand.length}
        </span>
      </div>

      {/* Color picker overlay */}
      {pendingWild && <ColorPicker onPick={handleWildColorPick} />}
    </div>
  );
}
