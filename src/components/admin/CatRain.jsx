import { useRef, useEffect } from 'react'

// Variety of cat emojis (and some paws/fish for flavor)
const CATS = ['🐱', '🐈', '🐈‍⬛', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '🐾', '🐟']

export default function CatRain() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = window.innerWidth + 'px'
      canvas.style.height = window.innerHeight + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // Spawn a population of cats
    const density = Math.floor((window.innerWidth * window.innerHeight) / 22000)
    const count = Math.max(18, Math.min(60, density))
    const cats = Array.from({ length: count }, () => spawn(true))

    function spawn(initial = false) {
      const size = 22 + Math.random() * 28
      return {
        emoji: CATS[Math.floor(Math.random() * CATS.length)],
        x: Math.random() * window.innerWidth,
        y: initial ? Math.random() * window.innerHeight : -size - Math.random() * 200,
        vy: 0.4 + Math.random() * 1.6,
        vx: (Math.random() - 0.5) * 0.4,
        size,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.02,
        opacity: 0.55 + Math.random() * 0.4,
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const c of cats) {
        c.y += c.vy
        c.x += c.vx
        c.rot += c.vr

        // Recycle when off-screen
        if (c.y > window.innerHeight + c.size) {
          Object.assign(c, spawn(false))
          continue
        }
        if (c.x < -c.size) c.x = window.innerWidth + c.size
        if (c.x > window.innerWidth + c.size) c.x = -c.size

        ctx.save()
        ctx.globalAlpha = c.opacity
        ctx.translate(c.x, c.y)
        ctx.rotate(c.rot)
        ctx.font = `${c.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(c.emoji, 0, 0)
        ctx.restore()
      }

      animId = requestAnimationFrame(draw)
    }

    animId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9996,
        pointerEvents: 'none',
      }}
    />
  )
}
