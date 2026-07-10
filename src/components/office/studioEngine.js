// ─────────────────────────────────────────────────────────────────────────────
// studioEngine — top-down pixel office (pixel-agents assets, MIT; MetroCity
// characters by JIK-A-4). Fixed perimeter workstations, living deterministic
// characters. The simulation is a pure function of (seed, wall-clock time) so
// every client shows the characters in the same place. Pure canvas + rAF.
// ─────────────────────────────────────────────────────────────────────────────

const TILE = 16, SC = 2;
const VOID = 0, FLOOR = 1, WALL = 2, DESKB = 3, GRASS = 4;
const SEED = 20260709;          // fixed → deterministic across clients
const WINDOW = 240;             // s — rolling anchor; all clients re-sync each window
const STEP = 0.1;               // s — fixed timestep
const MAX_CATCHUP = 3200;       // steps simulated per frame (covers a full window)
const REACTS = ['💡', '🔥', '🎧', '⌨️', '🤔', '✨', '😤', '👀', '🎨', '📐', '🚀', '☕'];

const ASSET_PATHS = {
  c0: 'characters/char_0.png', c1: 'characters/char_1.png', c2: 'characters/char_2.png',
  c3: 'characters/char_3.png', c4: 'characters/char_4.png', c5: 'characters/char_5.png',
  wall: 'walls/wall_0.png', floor: 'floors/floor_1.png',
  desk: 'furniture/DESK/DESK_FRONT.png', deskS: 'furniture/DESK/DESK_SIDE.png',
  pc1: 'furniture/PC/PC_FRONT_ON_1.png', pc2: 'furniture/PC/PC_FRONT_ON_2.png', pc3: 'furniture/PC/PC_FRONT_ON_3.png',
  pcoff: 'furniture/PC/PC_FRONT_OFF.png', pcback: 'furniture/PC/PC_BACK.png', pcside: 'furniture/PC/PC_SIDE.png',
  chairB: 'furniture/WOODEN_CHAIR/WOODEN_CHAIR_BACK.png', chairS: 'furniture/WOODEN_CHAIR/WOODEN_CHAIR_SIDE.png',
  lplant: 'furniture/LARGE_PLANT/LARGE_PLANT.png', plant: 'furniture/PLANT/PLANT.png', plant2: 'furniture/PLANT_2/PLANT_2.png',
  pot: 'furniture/POT/POT.png', bench: 'furniture/WOODEN_BENCH/WOODEN_BENCH.png', sofaF: 'furniture/SOFA/SOFA_FRONT.png',
  shelf2: 'furniture/DOUBLE_BOOKSHELF/DOUBLE_BOOKSHELF.png',
  board: 'furniture/WHITEBOARD/WHITEBOARD.png', paintL: 'furniture/LARGE_PAINTING/LARGE_PAINTING.png',
  paintS: 'furniture/SMALL_PAINTING/SMALL_PAINTING.png', paintS2: 'furniture/SMALL_PAINTING_2/SMALL_PAINTING_2.png',
  clock: 'furniture/CLOCK/CLOCK.png',
};

const hashStr = (s = '') => { let h = 0; for (let i = 0; i < ('' + s).length; i++) h = (h * 31 + ('' + s).charCodeAt(i)) | 0; return Math.abs(h); };
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export function studentRoomId(dept) { if (dept === 'concept') return 'concept'; if (dept === 'sound') return 'sound'; return 'cg'; }

export function createStudioEngine(canvas, base, students, opts = {}) {
  const onSelect = opts.onSelect || (() => {});
  const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;

  const imgs = {}; let toLoad = 0, loaded = 0, ready = false;
  for (const k in ASSET_PATHS) { toLoad++; const im = new Image(); im.onload = () => { if (++loaded === toLoad) ready = true; }; im.onerror = () => { if (++loaded === toLoad) ready = true; }; im.src = base + ASSET_PATHS[k]; imgs[k] = im; }
  const tintCache = {};
  function tint(key, img, color) { const ck = key + color; if (tintCache[ck]) return tintCache[ck];
    const c = document.createElement('canvas'); c.width = img.width || 16; c.height = img.height || 16;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(img, 0, 0); tintCache[ck] = c; return c; }

  // ── building ──
  const GW = 52, GH = 38;
  const map = Array.from({ length: GH }, () => new Array(GW).fill(VOID));
  const rmap = Array.from({ length: GH }, () => new Array(GW).fill(null));
  const rooms = {};
  function carve(id, x, y, w, h, color, tintc, label, doors, floorType) {
    rooms[id] = { rect: { x, y, w, h }, color, tint: tintc, label, seats: [], floorType: floorType || FLOOR };
    for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) { const edge = (r === y || r === y + h - 1 || c === x || c === x + w - 1); if (edge) map[r][c] = WALL; else { map[r][c] = rooms[id].floorType; rmap[r][c] = id; } }
    for (const d of (doors || [])) { map[d.r][d.c] = FLOOR; rmap[d.r][d.c] = id; }
  }
  function corridor(x, y, w, h) { for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) { map[r][c] = FLOOR; rmap[r][c] = 'hall'; } }
  carve('cg', 1, 1, 30, 36, '#A78BFA', '#9d97c4', 'CG · 3D', [{ r: 18, c: 30 }, { r: 19, c: 30 }]);
  corridor(31, 1, 4, 36);
  carve('bagni', 35, 1, 16, 8, '#7dd3fc', '#8fa9b3', 'BAGNI', [{ r: 5, c: 35 }]);
  carve('sound', 35, 8, 16, 8, '#22D3EE', '#8bb6bf', 'SOUND', [{ r: 11, c: 35 }]);
  carve('concept', 35, 16, 16, 13, '#E879F9', '#c6a3cf', 'CONCEPT ART', [{ r: 22, c: 35 }]);
  carve('relax', 35, 29, 16, 9, '#7bbf5a', '#7fb85f', 'RELAX (esterno)', [{ r: 33, c: 35 }], GRASS);

  const decor = [], wallDecor = [], rugs = [];
  const block = (c, r) => { if (map[r] && map[r][c] !== WALL) map[r][c] = DESKB; };
  function perimeter(id, count) { const R = rooms[id].rect, list = [];
    const ix0 = R.x + 1, iy0 = R.y + 1, ix1 = R.x + R.w - 2, iy1 = R.y + R.h - 2;
    const push = (sc, sr, orient, dt) => { if (list.length >= count) return; list.push({ sc, sr, orient, deco: (hashStr(sc + '_' + sr) % 10) < 3 }); dt.forEach(([c, r]) => block(c, r)); };
    for (let c = ix0 + 1; c + 1 <= ix1 && list.length < count; c += 3) push(c, iy0 + 1, 'up', [[c - 1, iy0], [c, iy0], [c + 1, iy0]]);
    for (let c = ix0 + 1; c + 1 <= ix1 && list.length < count; c += 3) push(c, iy1 - 1, 'down', [[c - 1, iy1], [c, iy1], [c + 1, iy1]]);
    for (let r = iy0 + 3; r + 1 <= iy1 - 2 && list.length < count; r += 3) push(ix0 + 1, r, 'left', [[ix0, r - 1], [ix0, r], [ix0, r + 1]]);
    for (let r = iy0 + 3; r + 1 <= iy1 - 2 && list.length < count; r += 3) push(ix1 - 1, r, 'right', [[ix1, r - 1], [ix1, r], [ix1, r + 1]]);
    let ring = 2; while (list.length < count && ring < 8) { for (let c = ix0 + 1 + ring; c + 1 <= ix1 - ring && list.length < count; c += 3) push(c, iy0 + 1 + ring, 'up', [[c - 1, iy0 + ring], [c, iy0 + ring], [c + 1, iy0 + ring]]); ring += 3; }
    rooms[id].seats = list;
  }
  const byRoom = { cg: [], concept: [], sound: [] };
  for (const s of students) byRoom[studentRoomId(s.dept)].push(s);
  for (const k in byRoom) byRoom[k].sort((a, b) => ('' + a.id < '' + b.id ? -1 : 1)); // deterministic seating
  perimeter('cg', byRoom.cg.length); perimeter('concept', byRoom.concept.length); perimeter('sound', byRoom.sound.length);

  function decorateRoom(id, artKeys) { const R = rooms[id].rect;
    rugs.push({ x: R.x + 3, y: R.y + 3, w: R.w - 6, h: R.h - 6, color: rooms[id].color });
    const px0 = R.x + 4, py0 = R.y + 4, px1 = R.x + R.w - 5, py1 = R.y + R.h - 5;
    decor.push({ img: 'lplant', cx: px0 * TILE, cy: py0 * TILE + TILE, w: 32, h: 48 }); block(px0 - 1, py0);
    decor.push({ img: 'plant2', cx: px1 * TILE, cy: py1 * TILE + TILE, w: 16, h: 32 }); block(px1, py1);
    decor.push({ img: 'shelf2', cx: (R.x + Math.floor(R.w / 2)) * TILE, cy: (R.y + 2) * TILE + TILE, w: 32, h: 32 });
    const wy = R.y * TILE; let ax = R.x + 3;
    wallDecor.push({ img: 'clock', px: (R.x + Math.floor(R.w / 2)) * TILE, py: wy - 2, w: 16, h: 32 });
    for (const k of artKeys) { const wide = (k === 'board' || k === 'paintL'); wallDecor.push({ img: k, px: ax * TILE, py: wy + 2, w: wide ? 32 : 16, h: 32 }); ax += wide ? 4 : 3; if (ax > R.x + R.w - 5) break; }
  }
  decorateRoom('cg', ['board', 'paintL', 'paintS']); decorateRoom('concept', ['paintL', 'paintS2', 'paintS']); decorateRoom('sound', ['board', 'paintS']);
  for (let k = 0; k < 5; k++) wallDecor.push({ img: k % 2 ? 'paintS' : 'paintS2', px: 30 * TILE - 1, py: (4 + k * 7) * TILE, w: 16, h: 32 });
  decor.push({ img: 'plant', cx: 32 * TILE, cy: 8 * TILE + TILE, w: 16, h: 32 }); block(32, 8);
  decor.push({ img: 'plant', cx: 33 * TILE, cy: 26 * TILE + TILE, w: 16, h: 32 }); block(33, 26);

  // bathroom cabins (closed stalls, occupant hidden)
  const bagniStalls = []; { const R = rooms.bagni.rect; for (let cc = R.x + 2; cc <= R.x + R.w - 3; cc += 3) { map[R.y + 1][cc - 1] = WALL; map[R.y + 1][cc + 1] = WALL; bagniStalls.push({ c: cc, r: R.y + 1, by: null, hidden: true, door: { c: cc, r: R.y + 2 } }); } }

  // outdoor relax
  const RX = rooms.relax.rect;
  const benches = [{ c: RX.x + 3, r: RX.y + 3 }, { c: RX.x + 7, r: RX.y + 3 }, { c: RX.x + 11, r: RX.y + 3 }, { c: RX.x + 5, r: RX.y + 6 }, { c: RX.x + 9, r: RX.y + 6 }];
  const trees = [{ c: RX.x + 1.5, r: RX.y + 1.5 }, { c: RX.x + RX.w - 2.5, r: RX.y + 1.5 }, { c: RX.x + RX.w - 2.5, r: RX.y + RX.h - 2.5 }, { c: RX.x + 2.5, r: RX.y + RX.h - 2 }];
  decor.push({ img: 'sofaF', cx: (RX.x + RX.w - 4) * TILE, cy: (RX.y + 3) * TILE + TILE, w: 32, h: 16 });
  const breakSpots = []; benches.forEach(b => { [[0, 1], [-1, 0], [1, 0]].forEach(o => { const c = b.c + o[0], r = b.r + o[1]; if (map[r] && map[r][c] === GRASS) breakSpots.push({ c, r, by: null }); }); });

  // ── characters ──
  const chars = [];
  for (const id of ['cg', 'concept', 'sound']) { const seats = rooms[id].seats;
    byRoom[id].forEach((s, i) => { const seat = seats.length ? seats[i % seats.length] : { sc: rooms[id].rect.x + 2, sr: rooms[id].rect.y + 2, orient: 'up' };
      chars.push({ id: s.id, name: s.name || 'Studente', dept: id, ci: hashStr('' + s.id) % 6, seed: hashStr('' + s.id),
        home: { c: seat.sc, r: seat.sr }, orient: seat.orient, pos: { c: seat.sc, r: seat.sr }, online: false, st: 'none',
        state: 'off', dir: seat.orient, frame: 0, ft: 0, path: [], timer: 0, spot: null, bubble: null, bubbleT: 0, react: null, reactT: 0, reactNext: 0, rng: mulberry32(s ? hashStr('' + s.id) : 1) });
    });
  }
  const charById = {}; chars.forEach(c => (charById[c.id] = c));
  const seatOwner = {}; chars.forEach(c => (seatOwner[c.home.c + ',' + c.home.r] = c));

  let live = { online: new Set(), status: {}, avatar: {} };
  function applyLive() { for (const ch of chars) { const on = live.online.has(ch.id);
    if (on && ch.state === 'off') { ch.state = 'work'; ch.pos = { c: ch.home.c, r: ch.home.r }; ch.timer = 4 + ch.rng() * 30; }
    if (!on && ch.state !== 'off') { if (ch.spot) { ch.spot.by = null; ch.spot = null; } ch.state = 'off'; ch.pos = { c: ch.home.c, r: ch.home.r }; }
    ch.online = on; ch.st = live.status[ch.id] || 'none'; if (live.avatar[ch.id] != null) ch.ci = live.avatar[ch.id] % 6; } }

  const walkable = (c, r) => { if (c < 0 || r < 0 || c >= GW || r >= GH) return false; const t = map[r][c]; return t === FLOOR || t === GRASS; };
  function bfs(sc, sr, gc, gr) { if (sc === gc && sr === gr) return [];
    const q = [[sc, sr]], prev = {}, seen = new Set([sc + ',' + sr]); const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) { const [c, r] = q.shift(); for (const [dc, dr] of D) { const nc = c + dc, nr = r + dr, k = nc + ',' + nr; if (seen.has(k)) continue; const goal = (nc === gc && nr === gr); if (!goal && !walkable(nc, nr)) continue; seen.add(k); prev[k] = [c, r]; if (goal) { const path = [[nc, nr]]; let cur = [c, r]; while (!(cur[0] === sc && cur[1] === sr)) { path.push(cur); cur = prev[cur[0] + ',' + cur[1]]; } path.reverse(); return path.map(p => ({ c: p[0], r: p[1] })); } q.push([nc, nr]); } }
    return null; }

  const SPEED = 3.4;
  function startWalk(ch, spot) { spot.by = ch; ch.spot = spot; const p = bfs(Math.round(ch.pos.c), Math.round(ch.pos.r), spot.c, spot.r); if (p) { ch.path = p; ch.state = 'walk'; ch.returning = false; } else { spot.by = null; ch.spot = null; ch.timer = 20 + ch.rng() * 30; } }
  function stepSim(dt) {
    const busy = chars.filter(c => c.state === 'break' || c.state === 'walk').length;
    const cap = Math.max(3, chars.length * 0.12);
    for (const ch of chars) { if (ch.state === 'off') continue;
      if (ch.bubbleT > 0) { ch.bubbleT -= dt; if (ch.bubbleT <= 0 && ch.bubble === 'WIP!') ch.bubble = null; }
      ch.ft += dt; ch.timer -= dt;
      if (ch.state === 'work') { if (ch.ft >= 0.36) { ch.ft -= 0.36; ch.frame ^= 1; }
        ch.reactNext -= dt; if (ch.reactT > 0) { ch.reactT -= dt; if (ch.reactT <= 0) ch.react = null; }
        else if (ch.reactNext <= 0) { ch.react = REACTS[(ch.rng() * REACTS.length) | 0]; ch.reactT = 2.6; ch.reactNext = 9 + ch.rng() * 17; }
        if (ch.timer <= 0) { const roll = ch.rng();
          if (busy < cap && roll < 0.10) { const s = bagniStalls.find(x => !x.by); if (s) startWalk(ch, s); else ch.timer = 25 + ch.rng() * 35; }
          else if (busy < cap && roll < 0.22) { const s = breakSpots.find(x => !x.by); if (s) startWalk(ch, s); else ch.timer = 25 + ch.rng() * 35; }
          else ch.timer = 22 + ch.rng() * 33; } }
      else if (ch.state === 'walk') { if (ch.ft >= 0.13) { ch.ft -= 0.13; ch.frame = (ch.frame + 1) % 4; }
        const wp = ch.path[0];
        if (!wp) { if (ch.returning) { ch.state = 'work'; ch.dir = ch.orient; ch.frame = 0; ch.pos.c = ch.home.c; ch.pos.r = ch.home.r; ch.timer = 22 + ch.rng() * 33; ch.reactNext = 6 + ch.rng() * 10; } else { ch.state = 'break'; ch.dir = 'up'; ch.frame = 0; ch.timer = (ch.spot && ch.spot.hidden) ? 12 + ch.rng() * 18 : 30 + ch.rng() * 45; } }
        else { const dx = wp.c - ch.pos.c, dy = wp.r - ch.pos.r, d = Math.hypot(dx, dy), step = SPEED * dt; if (d <= step) { ch.pos.c = wp.c; ch.pos.r = wp.r; ch.path.shift(); } else { ch.pos.c += dx / d * step; ch.pos.r += dy / d * step; ch.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); } } }
      else if (ch.state === 'break') { ch.frame = 0; if (ch.timer <= 0) { const s = ch.spot; if (s) s.by = null; ch.spot = null; const p = bfs(Math.round(ch.pos.c), Math.round(ch.pos.r), ch.home.c, ch.home.r); if (p) { ch.path = p; ch.state = 'walk'; ch.returning = true; } else { ch.state = 'work'; ch.pos.c = ch.home.c; ch.pos.r = ch.home.r; ch.timer = 8; } } }
    }
  }

  // deterministic anchor reset
  let curAnchor = -1, simTime = 0;
  function resetSim(anchor) {
    for (const s of bagniStalls) s.by = null; for (const s of breakSpots) s.by = null;
    for (const ch of chars) { ch.rng = mulberry32((SEED ^ ch.seed ^ (anchor | 0)) >>> 0); ch.pos = { c: ch.home.c, r: ch.home.r }; ch.path = []; ch.spot = null; ch.dir = ch.orient; ch.frame = 0; ch.ft = 0; ch.bubble = null; ch.bubbleT = 0; ch.react = null; ch.reactT = 0; ch.reactNext = 4 + ch.rng() * 16; ch.timer = 4 + ch.rng() * 36; ch.state = ch.online ? 'work' : 'off'; }
    simTime = anchor;
  }

  // ── rendering ──
  canvas.width = GW * TILE * SC; canvas.height = GH * TILE * SC;
  let bg = null;
  function rrectG(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function buildBG() { bg = document.createElement('canvas'); bg.width = canvas.width; bg.height = canvas.height;
    const g = bg.getContext('2d'); g.imageSmoothingEnabled = false; g.scale(SC, SC);
    for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) { const t = map[r][c]; if (t === VOID) continue; const id = rmap[r][c]; const rd = rooms[id]; const tc = id === 'hall' ? '#8a94a3' : (rd ? rd.tint : '#9a8b78');
      if (t === FLOOR || t === DESKB) g.drawImage(tint('fl', imgs.floor, tc), c * TILE, r * TILE, TILE, TILE);
      else if (t === GRASS) { g.fillStyle = (c + r) % 2 ? '#5fa348' : '#6cb054'; g.fillRect(c * TILE, r * TILE, TILE, TILE); g.fillStyle = 'rgba(40,90,40,.25)'; g.fillRect(c * TILE + 3, r * TILE + 9, 2, 2); g.fillRect(c * TILE + 10, r * TILE + 4, 2, 2); } }
    for (const rg of rugs) { g.save(); g.globalAlpha = .5; g.fillStyle = rg.color; rrectG(g, rg.x * TILE + 4, rg.y * TILE + 4, rg.w * TILE - 8, rg.h * TILE - 8, 8); g.fill(); g.globalAlpha = .9; g.lineWidth = 2; g.strokeStyle = rg.color; g.stroke(); g.globalAlpha = .14; g.fillStyle = '#000'; rrectG(g, rg.x * TILE + 9, rg.y * TILE + 9, rg.w * TILE - 18, rg.h * TILE - 18, 6); g.fill(); g.restore(); }
    for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) { if (map[r][c] !== WALL) continue; let m = 0; if (r > 0 && map[r - 1][c] === WALL) m |= 1; if (c < GW - 1 && map[r][c + 1] === WALL) m |= 2; if (r < GH - 1 && map[r + 1][c] === WALL) m |= 4; if (c > 0 && map[r][c - 1] === WALL) m |= 8; const sx = (m % 4) * 16, sy = ((m / 4) | 0) * 32; g.drawImage(tint('wl', imgs.wall, '#6b7385'), sx, sy, 16, 32, c * TILE, r * TILE - 16, 16, 32); }
    for (const w of wallDecor) { const im = imgs[w.img]; if (im && im.complete && im.naturalWidth) g.drawImage(im, w.px, w.py - w.h + 8, w.w, w.h); }
  }
  const di = (px, py, img, w, h) => { if (!img || !img.complete) return; ctx.drawImage(img, px * SC, py * SC, w * SC, h * SC); };
  const dif = (px, py, img, w, h) => { if (!img || !img.complete) return; ctx.save(); ctx.translate((px + w) * SC, py * SC); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w * SC, h * SC); ctx.restore(); };
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const pcFor = (on, which) => { if (!on) return imgs.pcoff; if (which === 'front') return imgs['pc' + (Math.floor(Date.now() / 230) % 3 + 1)]; if (which === 'back') return imgs.pcback; return imgs.pcside; };
  function seatSprite(px, foot, ci, facing, frame) { const im = imgs['c' + ci]; if (!im) return; const col = 3 + (frame & 1); let rowY = 0, flip = false; if (facing === 'down') rowY = 0; else if (facing === 'up') rowY = 32; else { rowY = 64; flip = (facing === 'left'); }
    const dx = (px - 8) * SC, dy = (foot - 32) * SC, dw = 16 * SC, dh = 32 * SC;
    if (flip) { ctx.save(); ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(im, col * 16, rowY, 16, 32, 0, 0, dw, dh); ctx.restore(); } else ctx.drawImage(im, col * 16, rowY, 16, 32, dx, dy, dw, dh); }
  // Monitor sits against the wall, screen toward the centre; person is in front facing the wall.
  function drawStation(s) { const o = seatOwner[s.sc + ',' + s.sr]; const on = o && o.online; const work = o && o.state === 'work'; const cx = s.sc * TILE, cy = s.sr * TILE, px = cx + TILE / 2, fr = o ? o.frame : 0;
    if (s.orient === 'up') { di(cx - 16, cy - 32, imgs.desk, 48, 32); di(cx, cy - 42, pcFor(on, 'front'), 16, 32); if (s.deco) di(cx + 13, cy - 34, imgs.pot, 16, 16); di(cx, cy + 4, imgs.chairB, 16, 32); if (work) { seatSprite(px, cy + 22, o.ci, 'up', fr); drawLabel(px, cy + 22, o); } }
    else if (s.orient === 'down') { di(cx, cy - 14, imgs.chairF, 16, 32); if (work) seatSprite(px, cy + 2, o.ci, 'down', fr); di(cx - 16, cy + 4, imgs.desk, 48, 32); di(cx, cy + 2, pcFor(on, 'back'), 16, 32); if (s.deco) di(cx - 15, cy + 8, imgs.pot, 16, 16); if (work) drawLabel(px, cy + 22, o); }
    else if (s.orient === 'left') { di(cx - 16, cy - 40, imgs.deskS, 16, 64); di(cx - 16, cy - 22, pcFor(on, 'side'), 16, 32); di(cx + 2, cy - 14, imgs.chairS, 16, 32); if (work) { seatSprite(px + 2, cy + 16, o.ci, 'left', fr); drawLabel(px + 2, cy + 16, o); } }
    else if (s.orient === 'right') { dif(cx + 16, cy - 40, imgs.deskS, 16, 64); dif(cx + 16, cy - 22, pcFor(on, 'side'), 16, 32); dif(cx - 2, cy - 14, imgs.chairS, 16, 32); if (work) { seatSprite(px - 2, cy + 16, o.ci, 'right', fr); drawLabel(px - 2, cy + 16, o); } } }
  function bubbleAt(px, foot, text, b, f, big) { const by = foot - 40; ctx.font = '800 ' + ((big ? 8.5 : 7) * SC) + 'px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + (big ? 11 : 8) * SC, h = (big ? 13 : 11) * SC, bx = px * SC, byy = by * SC;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; rrect(bx - w / 2 + 1.5, byy - h + 1.5, w, h, 4.5 * SC); ctx.fill();
    ctx.fillStyle = b; rrect(bx - w / 2, byy - h, w, h, 4.5 * SC); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx - 4 * SC, byy - 2); ctx.lineTo(bx + 4 * SC, byy - 2); ctx.lineTo(bx, byy + 4 * SC); ctx.closePath(); ctx.fill();
    ctx.fillStyle = f; ctx.fillText(text, bx, byy - h / 2); }
  function drawLabel(px, foot, ch) { ctx.font = '700 ' + (7 * SC) + 'px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillText(ch.name, px * SC, (foot + 2) * SC); ctx.fillStyle = ch.online ? '#eef2f6' : '#64748b'; ctx.fillText(ch.name, px * SC, (foot + 2) * SC - 1);
    if (ch.bubble === 'WIP!') bubbleAt(px, foot, 'WIP!', '#2563EB', '#fff', true);
    else if (ch.state === 'break') bubbleAt(px, foot, '☕', '#f5b862', '#3a2f1a', true);
    else if (ch.state === 'work' && ch.react) bubbleAt(px, foot, ch.react, '#ffffff', '#111', false);
    else if (ch.state === 'work' && ch.st === 'green') bubbleAt(px, foot, '✓ approvato', '#10B981', '#04231a', true);
    else if (ch.state === 'work' && ch.st === 'blue') bubbleAt(px, foot, 'WIP', '#3B82F6', '#fff', true); }
  function drawChar(ch) { if (ch.state === 'break' && ch.spot && ch.spot.hidden) return;
    const foot = ch.pos.r * TILE + 16, px = ch.pos.c * TILE + TILE / 2, im = imgs['c' + ch.ci]; if (!im) return;
    let col = 0, rowY = 0, flip = false;
    if (ch.state === 'break') { col = 0; rowY = 0; } else { const seq = [0, 1, 2, 1]; col = seq[ch.frame % 4]; const d = ch.dir; if (d === 'down') rowY = 0; else if (d === 'up') rowY = 32; else { rowY = 64; flip = (d === 'left'); } }
    const dx = (px - 8) * SC, dy = (foot - 32) * SC, dw = 16 * SC, dh = 32 * SC;
    if (flip) { ctx.save(); ctx.translate(dx + dw, dy); ctx.scale(-1, 1); ctx.drawImage(im, col * 16, rowY, 16, 32, 0, 0, dw, dh); ctx.restore(); }
    else ctx.drawImage(im, col * 16, rowY, 16, 32, dx, dy, dw, dh);
    drawLabel(px, foot, ch); }
  function render() { ctx.clearRect(0, 0, canvas.width, canvas.height); if (bg) ctx.drawImage(bg, 0, 0);
    const items = [];
    for (const id of ['cg', 'concept', 'sound']) for (const s of rooms[id].seats) items.push({ y: s.sr * TILE + (s.orient === 'up' ? 22 : s.orient === 'down' ? 4 : 16), kind: 'desk', s });
    for (const d of decor) items.push({ y: d.cy, kind: 'decor', d });
    benches.forEach(b => items.push({ y: b.r * TILE + TILE, kind: 'bench', t: b }));
    trees.forEach(t => items.push({ y: t.r * TILE + TILE, kind: 'tree', t }));
    bagniStalls.forEach(s => { if (s.by) items.push({ y: s.door.r * TILE + 8, kind: 'stalldoor', t: s }); });
    for (const ch of chars) { if (ch.state === 'off' || ch.state === 'work') continue; items.push({ y: ch.pos.r * TILE + TILE, kind: 'char', ch }); }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) {
      if (it.kind === 'desk') drawStation(it.s);
      else if (it.kind === 'decor') { const d = it.d; di(d.cx - (d.w / 2 - 8), d.cy - d.h, imgs[d.img], d.w, d.h); }
      else if (it.kind === 'bench') di(it.t.c * TILE, it.t.r * TILE - 4, imgs.bench, 16, 16);
      else if (it.kind === 'tree') di((it.t.c - 1) * TILE, it.t.r * TILE - 40, imgs.lplant, 32, 48);
      else if (it.kind === 'stalldoor') { const t = it.t; ctx.fillStyle = '#c04b4b'; rrect((t.door.c * TILE + 4) * SC, (t.door.r * TILE - 10) * SC, 8 * SC, 3 * SC, 1.5 * SC); ctx.fill(); }
      else if (it.kind === 'char') drawChar(it.ch);
    }
    for (const id in rooms) { const rd = rooms[id], R = rd.rect; ctx.font = '800 ' + (7 * SC) + 'px ui-sans-serif,system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const label = rd.label, x = (R.x * TILE + 4) * SC, y = (R.y * TILE + 3) * SC, w = ctx.measureText(label).width + 12 * SC;
      ctx.fillStyle = 'rgba(12,15,22,.85)'; rrect(x, y - 7 * SC, w, 14 * SC, 4 * SC); ctx.fill(); ctx.fillStyle = rd.color; ctx.beginPath(); ctx.arc(x + 5 * SC, y, 3 * SC, 0, 7); ctx.fill(); ctx.fillStyle = '#dbe2ea'; ctx.fillText(label, x + 11 * SC, y); }
  }

  function onClick(e) { const rect = canvas.getBoundingClientRect(); const wx = ((e.clientX - rect.left) / rect.width * canvas.width) / SC, wy = ((e.clientY - rect.top) / rect.height * canvas.height) / SC;
    let best = null, bd = 420; for (const ch of chars) { if (ch.state === 'off' || (ch.state === 'break' && ch.spot && ch.spot.hidden)) continue; const px = ch.pos.c * TILE + TILE / 2, py = (ch.state === 'work' ? ch.pos.r * TILE + 8 : ch.pos.r * TILE); const d = (wx - px) ** 2 + (wy - py) ** 2; if (d < bd) { bd = d; best = ch; } }
    if (best) onSelect(best.id); }
  canvas.addEventListener('click', onClick); canvas.style.cursor = 'pointer';

  let raf = 0;
  function loop() {
    if (ready) {
      if (!bg) buildBG();
      const nowSec = Date.now() / 1000;
      const anchor = Math.floor(nowSec / WINDOW) * WINDOW;
      if (anchor !== curAnchor) { curAnchor = anchor; resetSim(anchor); applyLive(); }
      let steps = 0;
      while (simTime + STEP <= nowSec && steps < MAX_CATCHUP) { stepSim(STEP); simTime += STEP; steps++; }
      render();
    }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    setLive(next) { live = { online: next.online || new Set(), status: next.status || {}, avatar: next.avatar || {} }; if (ready) applyLive(); },
    pop(userId) { const ch = charById[userId]; if (ch && ch.online) { ch.bubble = 'WIP!'; ch.bubbleT = 5; } },
    destroy() { cancelAnimationFrame(raf); canvas.removeEventListener('click', onClick); },
  };
}
