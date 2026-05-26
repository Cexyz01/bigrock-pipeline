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
    const SPAWN_MS = tier === 'low' ? 320 : 180
    // Cap on total cats: fills ~half the screen at most so we don't melt the CPU.
    const computeMax = () => {
      const avg = 36 * 36
      const target = tier === 'low' ? 0.30 : 0.55
      const hardCap = tier === 'low' ? 120 : 240
      return Math.min(hardCap, Math.max(20, Math.floor((W * H * target) / avg)))
    }
    let maxCats = computeMax()
    const onResizeMax = () => { maxCats = computeMax() }
    window.addEventListener('resize', onResizeMax)

    const cats = []
    let running = true
    let lastSpawn = 0
    let lastTime = performance.now()

    const GRAVITY = 1400  // px/s^2
    const REST = 0.18     // bounce
    const AIR = 0.001     // air drag coeff
    const FLOOR_FRIC = 6  // ground friction multiplier
    const ITERS = 3       // solver iterations per frame

    const spawn = () => {
      if (cats.length >= maxCats) return
      const size = 28 + Math.random() * 18
      const r = size * 0.42 // hitbox a touch smaller than visual
      // Try a few x positions: skip if spawn point is already blocked
      // (this is what makes the rain *stop* once the pile reaches the top).
      for (let attempt = 0; attempt < 4; attempt++) {
        const x = r + Math.random() * Math.max(1, W - 2 * r)
        const y = -r - 10
        let blocked = false
        for (const c of cats) {
          if (c.y > 80) continue
          const dx = c.x - x, dy = c.y - y
          const rs = c.r + r
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
            vr: (Math.random() - 0.5) * 3,
            img,
          })
          return
        }
      }
    }

    const step = (dt) => {
      // Integrate
      for (const c of cats) {
        c.vy += GRAVITY * dt
        c.vx *= 1 - AIR
        c.vy *= 1 - AIR
        c.x += c.vx * dt
        c.y += c.vy * dt
        c.rot += c.vr * dt
      }
      // Walls + floor
      for (const c of cats) {
        if (c.x - c.r < 0) { c.x = c.r; if (c.vx < 0) c.vx = -c.vx * REST }
        if (c.x + c.r > W) { c.x = W - c.r; if (c.vx > 0) c.vx = -c.vx * REST }
        if (c.y + c.r > H) {
          c.y = H - c.r
          if (c.vy > 0) c.vy = -c.vy * REST
          const f = Math.exp(-FLOOR_FRIC * dt)
          c.vx *= f
          c.vr *= f
        }
      }
      // Pairwise collisions — circle vs circle, position + impulse correction.
      // O(n^2) but n is capped so this stays well under a frame.
      for (let iter = 0; iter < ITERS; iter++) {
        for (let i = 0; i < cats.length; i++) {
          const a = cats[i]
          for (let j = i + 1; j < cats.length; j++) {
            const b = cats[j]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const rs = a.r + b.r
            const d2 = dx * dx + dy * dy
            if (d2 < rs * rs && d2 > 0.0001) {
              const d = Math.sqrt(d2)
              const nx = dx / d
              const ny = dy / d
              const overlap = (rs - d) * 0.5
              a.x -= nx * overlap; a.y -= ny * overlap
              b.x += nx * overlap; b.y += ny * overlap
              const rvx = b.vx - a.vx
              const rvy = b.vy - a.vy
              const vn = rvx * nx + rvy * ny
              if (vn < 0) {
                const j2 = -(1 + REST) * vn * 0.5
                a.vx -= j2 * nx; a.vy -= j2 * ny
                b.vx += j2 * nx; b.vy += j2 * ny
                // Tiny rotational kick on contact, sells the chaos.
                const tangential = (rvx * -ny + rvy * nx) * 0.02
                a.vr -= tangential
                b.vr += tangential
              }
            }
          }
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
      window.removeEventListener('resize', onResizeMax)
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
