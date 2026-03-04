import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

const GRID = 20;
const CELL_EMPTY = 0;
const CELL_FOOD = 3;
const BASE_SPEED = 180;
const MIN_SPEED = 100;

const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

const COLORS = {
  1: { head: '#22C55E', body: '#16A34A', trail: '#15803D' },
  2: { head: '#F28C28', body: '#EA580C', trail: '#C2410C' },
};

function spawnFood(snakes) {
  const occupied = new Set();
  Object.values(snakes).forEach(s => s.body.forEach(([x, y]) => occupied.add(`${x},${y}`)));
  const free = [];
  for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if (!occupied.has(`${x},${y}`)) free.push([x, y]);
  return free.length > 0 ? free[Math.floor(Math.random() * free.length)] : null;
}

function moveSnake(snake, grow) {
  const [dx, dy] = DIR[snake.dir];
  const [hx, hy] = snake.body[0];
  // Wrap around edges
  const newHead = [((hx + dx) % GRID + GRID) % GRID, ((hy + dy) % GRID + GRID) % GRID];
  const newBody = [newHead, ...snake.body];
  if (!grow) newBody.pop();
  return { ...snake, body: newBody };
}

function checkCollision(head, snakes, selfId) {
  const [hx, hy] = head;
  // No wall collision — snake wraps around
  for (const [id, s] of Object.entries(snakes)) {
    const start = id === selfId ? 1 : 0;
    for (let i = start; i < s.body.length; i++) {
      if (s.body[i][0] === hx && s.body[i][1] === hy) return id === selfId ? 'self' : 'opponent';
    }
  }
  return null;
}

export default function SnakeBattleGame({ gameState, myId, opponentId, onMove, isMobile, gameId }) {
  const [snakes, setSnakes] = useState(gameState.snakes);
  const [food, setFood] = useState(gameState.food);
  const [gameOver, setGameOver] = useState(false);
  const [scores, setScores] = useState({ [myId]: 0, [opponentId]: 0 });
  const [countdown, setCountdown] = useState(3);

  const myDirRef = useRef(snakes[myId]?.dir || 'right');
  const oppDirRef = useRef(snakes[opponentId]?.dir || 'left');
  const snakesRef = useRef(snakes);
  const foodRef = useRef(food);
  const scoresRef = useRef(scores);
  const gameOverRef = useRef(false);
  const channelRef = useRef(null);
  const isHost = myId < opponentId; // deterministic: lower UUID hosts

  // Keep refs in sync
  useEffect(() => { snakesRef.current = snakes; }, [snakes]);
  useEffect(() => { foodRef.current = food; }, [food]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);

  // Broadcast channel for real-time sync
  useEffect(() => {
    const ch = supabase.channel(`snake-${gameId}`, { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'snake-state' }, ({ payload }) => {
      if (!isHost && payload) {
        setSnakes(payload.snakes);
        setFood(payload.food);
        setScores(payload.scores);
        if (payload.gameOver) {
          gameOverRef.current = true;
          setGameOver(true);
        }
      }
    });
    ch.on('broadcast', { event: 'snake-dir' }, ({ payload }) => {
      if (isHost && payload?.playerId === opponentId) {
        oppDirRef.current = payload.dir;
      }
      if (!isHost && payload?.playerId === myId) {
        // echo back
      }
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => supabase.removeChannel(ch);
  }, [gameId, isHost, myId, opponentId]);

  // Send direction change
  const sendDir = useCallback((dir) => {
    if (gameOverRef.current) return;
    if (dir === OPPOSITE[myDirRef.current]) return; // can't reverse
    myDirRef.current = dir;
    if (!isHost) {
      channelRef.current?.send({ type: 'broadcast', event: 'snake-dir', payload: { playerId: myId, dir } });
    }
  }, [isHost, myId]);

  // Keyboard controls
  useEffect(() => {
    const keyMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const onKey = (e) => {
      const dir = keyMap[e.key];
      if (dir) { e.preventDefault(); sendDir(dir); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sendDir]);

  // Touch/swipe controls
  useEffect(() => {
    if (!isMobile) return;
    let startX = 0, startY = 0;
    const onStart = (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; };
    const onEnd = (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) sendDir(dx > 0 ? 'right' : 'left');
      else sendDir(dy > 0 ? 'down' : 'up');
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => { window.removeEventListener('touchstart', onStart); window.removeEventListener('touchend', onEnd); };
  }, [isMobile, sendDir]);

  // Countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Host game loop
  useEffect(() => {
    if (!isHost || countdown > 0) return;

    const totalLen = () => Object.values(snakesRef.current).reduce((s, sn) => s + sn.body.length, 0);
    const getSpeed = () => Math.max(MIN_SPEED, BASE_SPEED - Math.floor(totalLen() / 3) * 5);

    let timer = null;
    const tick = () => {
      if (gameOverRef.current) return;

      const cur = snakesRef.current;
      // Apply directions
      const updated = {};
      updated[myId] = { ...cur[myId], dir: myDirRef.current };
      updated[opponentId] = { ...cur[opponentId], dir: oppDirRef.current };

      // Move both snakes
      const fd = foodRef.current;
      const ateFood = {};
      for (const id of [myId, opponentId]) {
        const [dx, dy] = DIR[updated[id].dir];
        const [hx, hy] = updated[id].body[0];
        const nh = [((hx + dx) % GRID + GRID) % GRID, ((hy + dy) % GRID + GRID) % GRID];
        ateFood[id] = fd && nh[0] === fd[0] && nh[1] === fd[1];
        updated[id] = moveSnake(updated[id], ateFood[id]);
      }

      // Check collisions
      const dead = {};
      for (const id of [myId, opponentId]) {
        const col = checkCollision(updated[id].body[0], updated, id);
        if (col) dead[id] = col;
      }

      // Head-on collision (both heads at same cell)
      const h1 = updated[myId].body[0];
      const h2 = updated[opponentId].body[0];
      if (h1[0] === h2[0] && h1[1] === h2[1]) {
        dead[myId] = 'headon';
        dead[opponentId] = 'headon';
      }

      const newScores = { ...scoresRef.current };
      let newFood = fd;
      if (ateFood[myId] || ateFood[opponentId]) {
        if (ateFood[myId]) newScores[myId] = (newScores[myId] || 0) + 1;
        if (ateFood[opponentId]) newScores[opponentId] = (newScores[opponentId] || 0) + 1;
        newFood = spawnFood(updated);
      }

      snakesRef.current = updated;
      foodRef.current = newFood;
      scoresRef.current = newScores;
      setSnakes({ ...updated });
      setFood(newFood);
      setScores({ ...newScores });

      const bothDead = dead[myId] && dead[opponentId];
      const onlyMyDead = dead[myId] && !dead[opponentId];
      const onlyOppDead = !dead[myId] && dead[opponentId];

      // Broadcast state
      channelRef.current?.send({
        type: 'broadcast', event: 'snake-state',
        payload: { snakes: updated, food: newFood, scores: newScores, gameOver: !!(bothDead || onlyMyDead || onlyOppDead) },
      });

      if (bothDead || onlyMyDead || onlyOppDead) {
        gameOverRef.current = true;
        setGameOver(true);
        clearInterval(timer);
        // Report result
        if (bothDead) onMove({ won: false, draw: true });
        else if (onlyOppDead) onMove({ won: true, draw: false });
        else onMove({ won: false, draw: false });
        return;
      }

      // Schedule next tick with dynamic speed
      clearInterval(timer);
      timer = setTimeout(tick, getSpeed());
    };

    timer = setTimeout(tick, getSpeed());
    return () => { clearTimeout(timer); clearInterval(timer); };
  }, [isHost, countdown, myId, opponentId, onMove]);

  // Render
  const cellSize = isMobile ? Math.floor((window.innerWidth * 0.88) / GRID) : Math.floor(Math.min(500, window.innerHeight * 0.6) / GRID);
  const gridPx = cellSize * GRID;

  const buildGrid = () => {
    const cells = [];

    // Food
    if (food) {
      cells.push(
        <div key="food" style={{
          position: 'absolute',
          left: food[0] * cellSize, top: food[1] * cellSize,
          width: cellSize, height: cellSize,
          borderRadius: '50%',
          background: '#EF4444',
          boxShadow: '0 0 8px rgba(239,68,68,0.6)',
          animation: 'pulse 1s ease infinite',
        }} />
      );
    }

    // Snakes
    for (const [id, snake] of Object.entries(snakes)) {
      const color = id === myId ? COLORS[1] : COLORS[2];
      snake.body.forEach(([x, y], i) => {
        const isHead = i === 0;
        cells.push(
          <div key={`${id}-${i}`} style={{
            position: 'absolute',
            left: x * cellSize + 1, top: y * cellSize + 1,
            width: cellSize - 2, height: cellSize - 2,
            borderRadius: isHead ? 5 : 3,
            background: isHead ? color.head : i < 3 ? color.body : color.trail,
            boxShadow: isHead ? `0 0 6px ${color.head}88` : 'none',
            transition: 'left 0.08s linear, top 0.08s linear',
            zIndex: isHead ? 2 : 1,
          }} />
        );
      });
    }

    return cells;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      {/* Scoreboard */}
      <div style={{ display: 'flex', gap: 24, fontSize: 14, fontWeight: 700 }}>
        <span style={{ color: COLORS[1].head }}>
          {myId === Object.keys(snakes)[0] ? 'Tu' : 'Avversario'}: {scores[Object.keys(snakes)[0]] || 0}
        </span>
        <span style={{ color: '#444' }}>vs</span>
        <span style={{ color: COLORS[2].head }}>
          {myId === Object.keys(snakes)[1] ? 'Tu' : 'Avversario'}: {scores[Object.keys(snakes)[1]] || 0}
        </span>
      </div>

      {/* Grid */}
      <div style={{
        position: 'relative',
        width: gridPx, height: gridPx,
        background: '#111',
        borderRadius: 8,
        border: '2px solid #333',
        overflow: 'hidden',
      }}>
        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: `${cellSize}px ${cellSize}px`,
        }} />

        {countdown > 0 ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
          }}>
            <div style={{
              fontSize: 72, fontWeight: 900, color: '#F28C28',
              animation: 'pulse 0.8s ease infinite',
              textShadow: '0 0 30px rgba(242,140,40,0.5)',
            }}>
              {countdown}
            </div>
          </div>
        ) : buildGrid()}

        {gameOver && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#F1F5F9', textAlign: 'center' }}>
              GAME OVER
            </div>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div style={{ fontSize: 11, color: '#555', textAlign: 'center' }}>
        {isMobile ? 'Swipe per muoverti' : 'Frecce o WASD per muoverti'}
      </div>
    </div>
  );
}
