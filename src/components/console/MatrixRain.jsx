import { useEffect, useRef } from 'react'

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const FONT_SIZE = 15
const FPS = 33 // ~30fps

export default function MatrixRain() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let columns, drops, animId

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      columns = Math.floor(canvas.width / FONT_SIZE)
      drops = new Array(columns).fill(0).map(() => Math.random() * -50)
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      // Fading trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < columns; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]
        const x = i * FONT_SIZE
        const y = drops[i] * FONT_SIZE

        // Head character: bright white-green
        ctx.fillStyle = '#AAFFAA'
        ctx.font = `bold ${FONT_SIZE}px monospace`
        ctx.fillText(char, x, y)

        // Trail characters: green
        ctx.fillStyle = '#00FF41'
        ctx.font = `${FONT_SIZE}px monospace`
        const trailChar = CHARS[Math.floor(Math.random() * CHARS.length)]
        ctx.fillText(trailChar, x, y - FONT_SIZE)

        // Reset when off screen
        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0
        }
        drops[i]++
      }
    }

    const interval = setInterval(draw, FPS)

    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <>
      {/* Dark overlay behind the rain */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 349,
        background: 'rgba(0,0,0,0.8)',
        pointerEvents: 'none',
      }} />
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 350,
          pointerEvents: 'none',
          display: 'block',
        }}
      />
    </>
  )
}
