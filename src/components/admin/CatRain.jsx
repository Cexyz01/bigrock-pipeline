import { useEffect, useRef, useState } from 'react'

// SVG cats from Twemoji (Twitter open-source emoji set, MIT licensed).
// Identical glyphs everywhere — no OS emoji drift.
const CAT_URLS = [
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.0/assets/svg/1f408.svg',          // 🐈
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.0/assets/svg/1f408-200d-2b1b.svg', // 🐈‍⬛
]

function detectTier() {
  if (typeof navigator === 'undefined') return 'normal'
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  const coarse = typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)')?.matches
  if (cores <= 4 || mem <= 4 || coarse) return 'low'
  return 'normal'
}

export default function CatRain() {
  const canvasRef = useRef(null)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let W = window.innerWidth
    let H = window.innerHeight

    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = Math.floor(W * dpr)
      canvas.height = Math.floor(H * dpr)
      canvas.style.width = W + 'px'
      canvas.style.height = H + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const images = CAT_URLS.map(url => {
      const im = new Image()
      im.crossOrigin = 'anonymous'
      im.src = url
      return im
    })

    const tier = detectTier()
    const SPAWN_MS = tier === 'low' ? 320 : 160
    // Safety ceiling only — the real gate is the "spawn point blocked" check
    // below, so rain naturally stops when the pile fills the screen.
    const HARD_CEILING = tier === 'low' ? 600 : 1500

    const cats = []
    let running = true
    let lastSpawn = 0
    let lastTime = performance.now()

    const GRAVITY = 1400  // px/s^2
    const REST = 0.15     // bounce
    const AIR = 0.001     // linear air drag
    const ROT_DRAG = 1.8  // angular air drag — middle ground: visible spin, eventual stop
    const CONTACT_FRIC = 4 // extra LINEAR damping multiplier per contact
    const CONTACT_ROT_FRIC = 1.5 // gentler rotational friction per contact (don't kill spin)
    const FLOOR_FRIC = 6  // ground friction multiplier
    const ITERS = 4       // solver iterations per frame
    const SLOP = 0.7      // ignore micro-overlaps to kill jitter
    const POS_PCT = 0.7   // positional correction percent
    const SLEEP_V = 9     // sleep speed threshold (px/s)
    const SLEEP_VR = 0.2  // sleep angular threshold (rad/s)
    const SLEEP_TICKS = 22 // frames of low-motion-while-touching before sleep
    const WAKE_PEN = 1.8  // overlap that wakes a sleeping cat

    // Invisible cursor body — pushes cats around like a hand swiping.
    const CURSOR_R = 65
    const cursor = { x: -9999, y: -9999, px: -9999, py: -9999, vx: 0, vy: 0, active: false, init: false }
    const setCursor = (cx, cy) => {
      if (!cursor.init) { cursor.px = cx; cursor.py = cy; cursor.init = true }
      cursor.x = cx; cursor.y = cy
      cursor.active = true
    }
    const onMouseMove = (e) => setCursor(e.clientX, e.clientY)
    const onMouseLeave = () => { cursor.active = false; cursor.init = false }
    const onTouch = (e) => {
      if (e.touches && e.touches.length > 0) setCursor(e.touches[0].clientX, e.touches[0].clientY)
      else { cursor.active = false; cursor.init = false }
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mouseout', onMouseLeave)
    window.addEventListener('blur', onMouseLeave)
    window.addEventListener('touchstart', onTouch, { passive: true })
    window.addEventListener('touchmove', onTouch, { passive: true })
    window.addEventListener('touchend', onTouch, { passive: true })

    // Uniform grid for O(n*k) broadphase. Cell sized for the largest cat.
    const CELL = 70
    let cols = Math.ceil(W / CELL) + 1
    let rows = Math.ceil(H / CELL) + 2
    let grid = new Array(cols * rows).fill(null)
    const recomputeGrid = () => {
      cols = Math.ceil(W / CELL) + 1
      rows = Math.ceil(H / CELL) + 2
      grid = new Array(cols * rows).fill(null)
    }
    window.addEventListener('resize', recomputeGrid)

    const spawn = () => {
      if (cats.length >= HARD_CEILING) return
      // 1% chance of a chonker — much bigger than the others.
      const isGiant = Math.random() < 0.01
      const size = isGiant ? 100 + Math.random() * 40 : 28 + Math.random() * 32
      const r = size * 0.42 // hitbox a touch smaller than visual
      // Try a few x positions: skip if spawn point is already blocked
      // (this is what makes the rain *stop* once the pile reaches the top).
      for (let attempt = 0; attempt < 6; attempt++) {
        const x = r + Math.random() * Math.max(1, W - 2 * r)
        const y = -r - 10
        let blocked = false
        for (const c of cats) {
          if (c.y > 120) continue
          const dx = c.x - x, dy = c.y - y
          const rs = c.r + r + 2
          if (dx * dx + dy * dy < rs * rs) { blocked = true; break }
        }
        if (!blocked) {
          const img = images[Math.floor(Math.random() * images.length)]
          cats.push({
            x, y,
            vx: (Math.random() - 0.5) * 60,
            vy: 0,
            r, size,
            rot: (Math.random() - 0.5) * 0.8,
            vr: (Math.random() - 0.5) * 4,
            img,
            contacts: 0,
            sleepTicks: 0,
            sleeping: false,
          })
          return
        }
      }
    }

    const rebuildGrid = () => {
      grid.fill(null)
      for (const c of cats) {
        const gx = Math.max(0, Math.min(cols - 1, Math.floor(c.x / CELL)))
        const gy = Math.max(0, Math.min(rows - 1, Math.floor((c.y < 0 ? 0 : c.y) / CELL)))
        const idx = gy * cols + gx
        if (!grid[idx]) grid[idx] = []
        grid[idx].push(c)
      }
    }

    const resolvePair = (a, b, iter) => {
      if (a.sleeping && b.sleeping) return
      const dx = b.x - a.x
      const dy = b.y - a.y
      const rs = a.r + b.r
      const d2 = dx * dx + dy * dy
      if (d2 >= rs * rs || d2 < 0.0001) return
      const d = Math.sqrt(d2)
      const nx = dx / d
      const ny = dy / d
      const pen = rs - d
      if (iter === 0) { a.contacts++; b.contacts++ }
      if (pen > WAKE_PEN) {
        if (a.sleeping) { a.sleeping = false; a.sleepTicks = 0 }
        if (b.sleeping) { b.sleeping = false; b.sleepTicks = 0 }
      }
      if (pen > SLOP) {
        const corr = (pen - SLOP) * POS_PCT * 0.5
        if (a.sleeping) {
          b.x += nx * corr * 2; b.y += ny * corr * 2
        } else if (b.sleeping) {
          a.x -= nx * corr * 2; a.y -= ny * corr * 2
        } else {
          a.x -= nx * corr; a.y -= ny * corr
          b.x += nx * corr; b.y += ny * corr
        }
      }
      const rvx = b.vx - a.vx
      const rvy = b.vy - a.vy
      const vn = rvx * nx + rvy * ny
      if (vn < 0) {
        const j2 = -(1 + REST) * vn * 0.5
        if (!a.sleeping) { a.vx -= j2 * nx; a.vy -= j2 * ny }
        if (!b.sleeping) { b.vx += j2 * nx; b.vy += j2 * ny }
        // Rotational kick only on genuine impacts (not jitter at rest).
        if (-vn > 80) {
          const tangential = (rvx * -ny + rvy * nx) * 0.006
          if (!a.sleeping) a.vr -= tangential
          if (!b.sleeping) b.vr += tangential
        }
      }
    }

    const resolveCursor = () => {
      if (!cursor.active) return
      const gx0 = Math.max(0, Math.floor((cursor.x - CURSOR_R) / CELL))
      const gx1 = Math.min(cols - 1, Math.floor((cursor.x + CURSOR_R) / CELL))
      const gy0 = Math.max(0, Math.floor((cursor.y - CURSOR_R) / CELL))
      const gy1 = Math.min(rows - 1, Math.floor((cursor.y + CURSOR_R) / CELL))
      for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
          const bucket = grid[gy * cols + gx]
          if (!bucket) continue
          for (const c of bucket) {
            const dx = c.x - cursor.x
            const dy = c.y - cursor.y
            const rs = c.r + CURSOR_R
            const d2 = dx * dx + dy * dy
            if (d2 < rs * rs && d2 > 0.0001) {
              const d = Math.sqrt(d2)
              const nx = dx / d
              const ny = dy / d
              const pen = rs - d
              if (c.sleeping) { c.sleeping = false; c.sleepTicks = 0 }
              // Cursor is kinematic — push the cat the full overlap.
              c.x += nx * pen
              c.y += ny * pen
              // Impulse from cursor velocity (livelier than just position push)
              const rvx = c.vx - cursor.vx
              const rvy = c.vy - cursor.vy
              const vn = rvx * nx + rvy * ny
              if (vn < 0) {
                const j2 = -(1 + 0.4) * vn
                c.vx += j2 * nx
                c.vy += j2 * ny
              }
              // Tangential cursor motion adds spin
              c.vr += (-cursor.vx * ny + cursor.vy * nx) * 0.008
            }
          }
        }
      }
    }

    const step = (dt) => {
      const rotDamp = Math.exp(-ROT_DRAG * dt)
      // Cursor velocity (px/s) — clamped so a window-edge teleport doesn't yeet everything.
      if (cursor.active && dt > 0) {
        const cap = 4000
        cursor.vx = Math.max(-cap, Math.min(cap, (cursor.x - cursor.px) / dt))
        cursor.vy = Math.max(-cap, Math.min(cap, (cursor.y - cursor.py) / dt))
      } else {
        cursor.vx = 0; cursor.vy = 0
      }
      cursor.px = cursor.x
      cursor.py = cursor.y
      // Integrate (skip sleepers)
      for (const c of cats) {
        c.contacts = 0
        if (c.sleeping) continue
        c.vy += GRAVITY * dt
        c.vx *= 1 - AIR
        c.vy *= 1 - AIR
        c.vr *= rotDamp
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.rot += c.vr * dt
      }
      // Walls + floor
      for (const c of cats) {
        if (c.sleeping) continue
        if (c.x - c.r < 0) { c.x = c.r; if (c.vx < 0) c.vx = -c.vx * REST }
        if (c.x + c.r > W) { c.x = W - c.r; if (c.vx > 0) c.vx = -c.vx * REST }
        if (c.y + c.r > H) {
          c.y = H - c.r
          if (c.vy > 0) c.vy = -c.vy * REST
          const f = Math.exp(-FLOOR_FRIC * dt)
          c.vx *= f
          c.vr *= f
          c.contacts++
        }
      }
      // Broadphase via uniform grid + narrow resolve (iterated for stability).
      for (let iter = 0; iter < ITERS; iter++) {
        rebuildGrid()
        resolveCursor()
        for (let gy = 0; gy < rows; gy++) {
          for (let gx = 0; gx < cols; gx++) {
            const bucket = grid[gy * cols + gx]
            if (!bucket) continue
            // Same-cell pairs
            for (let i = 0; i < bucket.length; i++) {
              for (let j = i + 1; j < bucket.length; j++) {
                resolvePair(bucket[i], bucket[j], iter)
              }
            }
            // Forward neighbors only (avoid double-checking)
            for (let dy = 0; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dy === 0 && dx <= 0) continue
                const ngx = gx + dx, ngy = gy + dy
                if (ngx < 0 || ngx >= cols || ngy >= rows) continue
                const other = grid[ngy * cols + ngx]
                if (!other) continue
                for (const a of bucket) for (const b of other) resolvePair(a, b, iter)
              }
            }
          }
        }
      }
      // Per-contact damping + sleep pass. Extra friction scales with contacts
      // so sandwiched cats lose energy fast and stop oscillating/spinning.
      for (const c of cats) {
        if (c.sleeping) continue
        if (c.contacts > 0) {
          const f = Math.exp(-CONTACT_FRIC * c.contacts * dt)
          const fr = Math.exp(-CONTACT_ROT_FRIC * c.contacts * dt)
          c.vx *= f
          c.vy *= f
          c.vr *= fr
        }
        const speed2 = c.vx * c.vx + c.vy * c.vy
        const tickThresh = c.contacts >= 2 ? Math.floor(SLEEP_TICKS / 2) : SLEEP_TICKS
        if (c.contacts > 0 && speed2 < SLEEP_V * SLEEP_V && Math.abs(c.vr) < SLEEP_VR) {
          c.sleepTicks++
          if (c.sleepTicks >= tickThresh) {
            c.sleeping = true
            c.vx = 0; c.vy = 0; c.vr = 0
          }
        } else {
          c.sleepTicks = 0
        }
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, W, H)
      for (const c of cats) {
        if (!c.img.complete || !c.img.naturalWidth) continue
        ctx.save()
        ctx.translate(c.x, c.y)
        ctx.rotate(c.rot)
        ctx.drawImage(c.img, -c.size / 2, -c.size / 2, c.size, c.size)
        ctx.restore()
      }
    }

    const loop = (t) => {
      if (!running) return
      const dt = Math.min((t - lastTime) / 1000, 0.033)
      lastTime = t
      if (document.hidden) {
        requestAnimationFrame(loop)
        return
      }
      if (t - lastSpawn > SPAWN_MS) {
        spawn()
        lastSpawn = t
      }
      step(dt)
      render()
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    return () => {
      running = false
      window.removeEventListener('resize', resize)
      window.removeEventListener('resize', recomputeGrid)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseout', onMouseLeave)
      window.removeEventListener('blur', onMouseLeave)
      window.removeEventListener('touchstart', onTouch)
      window.removeEventListener('touchmove', onTouch)
      window.removeEventListener('touchend', onTouch)
    }
  }, [reduced])

  if (reduced) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9996,
        pointerEvents: 'none',
      }}
    />
  )
}
