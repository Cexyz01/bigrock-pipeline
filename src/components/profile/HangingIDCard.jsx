import { useRef, useEffect } from 'react'
import { DEPTS, displayRole, isSuperAdmin } from '../../lib/constants'
import Av from '../ui/Av'

const ROLE_COLORS = {
  super_admin:  { lanyard: '#DC2626', header: '#991B1B', text: '#fff' },
  admin:        { lanyard: '#F28C28', header: '#C2410C', text: '#fff' },
  docente:      { lanyard: '#2563EB', header: '#1D4ED8', text: '#fff' },
  coordinatore: { lanyard: '#7C3AED', header: '#5B21B6', text: '#fff' },
  studente:     { lanyard: '#10B981', header: '#047857', text: '#fff' },
}

function paletteFor(user) {
  if (isSuperAdmin(user)) return ROLE_COLORS.super_admin
  const slug = user?.role_slug || user?.role || 'studente'
  return ROLE_COLORS[slug] || ROLE_COLORS.studente
}

function barcodeBars(seed) {
  const s = String(seed || 'br')
  const bars = []
  let acc = 7
  for (let i = 0; i < 30; i++) {
    acc = (acc * 33 + s.charCodeAt(i % s.length) + i * 13) % 9973
    bars.push({ w: 1 + (acc % 3), h: 0.45 + ((acc >> 4) % 6) / 10 })
  }
  return bars
}

export default function HangingIDCard({ user }) {
  const containerRef = useRef(null)
  const swingRef = useRef(null)
  const stateRef = useRef({
    angle: 0,
    angVel: 0,
    dragging: false,
    pivot: { x: 0, y: 0 },
    samples: [],
  })

  useEffect(() => {
    const MAX_ANGLE = Math.PI * 0.5   // ±90° hard wall
    const SPRING = 0.014              // restoring spring constant
    const DAMPING = 0.975             // per-frame damping (~3 swings then settle)

    const idleTimer = setInterval(() => {
      const s = stateRef.current
      if (!s.pointerDown && Math.abs(s.angVel) < 0.004 && Math.abs(s.angle) < 0.015) {
        s.angVel += (Math.random() - 0.5) * 0.03
      }
    }, 7000)

    let last = performance.now()
    let raf = 0

    const tick = (now) => {
      const dt = Math.min(now - last, 32) / 16
      last = now
      const s = stateRef.current
      if (!s.dragging) {
        s.angVel += -SPRING * s.angle * dt
        s.angVel *= Math.pow(DAMPING, dt)
        if (s.angVel > 0.35) s.angVel = 0.35
        if (s.angVel < -0.35) s.angVel = -0.35
        s.angle += s.angVel * dt
        if (s.angle > MAX_ANGLE) { s.angle = MAX_ANGLE; s.angVel = -Math.abs(s.angVel) * 0.35 }
        if (s.angle < -MAX_ANGLE) { s.angle = -MAX_ANGLE; s.angVel = Math.abs(s.angVel) * 0.35 }
        if (Math.abs(s.angle) < 0.0005 && Math.abs(s.angVel) < 0.0005) {
          s.angle = 0
          s.angVel = 0
        }
      }
      if (swingRef.current) {
        // Note: CSS rotate(+θ) is clockwise on screen, which for a down-hanging
        // assembly swings the bottom LEFT. We keep the internal convention
        // "s.angle > 0 means card leans right" and negate only at render time.
        swingRef.current.style.transform = `translateX(-50%) rotate(${-s.angle}rad)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(idleTimer)
    }
  }, [])

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const s = stateRef.current

    const getXY = (ev) => {
      if (ev.touches && ev.touches[0]) return { x: ev.touches[0].clientX, y: ev.touches[0].clientY }
      return { x: ev.clientX, y: ev.clientY }
    }

    const { x: startX, y: startY } = getXY(e)
    s.pivot = { x: rect.left + rect.width / 2, y: rect.top + 22 }
    s.dragStartX = startX
    s.dragStartY = startY
    s.pointerDown = true
    s.dragging = false   // only commit to drag after enough movement — pure clicks keep physics running
    s.samples = [{ angle: s.angle, time: performance.now() }]

    const onMove = (ev) => {
      if (ev.cancelable) ev.preventDefault()
      const { x, y } = getXY(ev)
      if (!s.dragging) {
        const moved = Math.hypot(x - s.dragStartX, y - s.dragStartY)
        if (moved < 4) return
        // Commit to drag: freeze physics, anchor the touched point on the card
        s.dragging = true
        s.angVel = 0
        const dx = x - s.pivot.x
        const dy = Math.max(20, y - s.pivot.y)
        s.dragOffset = s.angle - Math.atan2(dx, dy)
      }
      const dx = x - s.pivot.x
      const dy = Math.max(20, y - s.pivot.y)
      let a = Math.atan2(dx, dy) + s.dragOffset
      const MAX = Math.PI * 0.45
      if (a > MAX) a = MAX
      if (a < -MAX) a = -MAX
      s.angle = a
      s.samples.push({ angle: a, time: performance.now() })
      if (s.samples.length > 6) s.samples.shift()
    }

    const onUp = () => {
      s.pointerDown = false
      if (s.dragging) {
        s.dragging = false
        const samples = s.samples
        if (samples.length >= 2) {
          const recent = samples.slice(-3)
          const f = recent[0]
          const l = recent[recent.length - 1]
          const ddt = (l.time - f.time) || 16
          s.angVel = ((l.angle - f.angle) / ddt) * 16
          if (s.angVel > 0.25) s.angVel = 0.25
          if (s.angVel < -0.25) s.angVel = -0.25
        }
      } else {
        // Pure click — preserve current physics momentum and add a nudge toward the click side
        const sideDx = s.dragStartX - s.pivot.x
        const dir = Math.abs(sideDx) < 4 ? (Math.random() > 0.5 ? 1 : -1) : Math.sign(sideDx)
        s.angVel += dir * 0.09
      }

      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
      window.removeEventListener('touchcancel', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    window.addEventListener('touchcancel', onUp)
  }

  const palette = paletteFor(user)
  const dept = DEPTS.find(d => d.id === user.department)
  const bars = barcodeBars((user.full_name || user.email || 'br') + (user.id || ''))
  const year = user.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear()
  const idCode = (user.id || user.email || 'br000').replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: 500,
        display: 'flex',
        justifyContent: 'center',
        overflow: 'visible',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* pivot dot */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: palette.lanyard,
          boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15)',
          transform: 'translateX(-50%)',
          zIndex: 3,
        }}
      />

      {/* swinging assembly: rope + clip + card */}
      <div
        ref={swingRef}
        style={{
          position: 'absolute',
          top: 22,
          left: '50%',
          transformOrigin: 'top center',
          transform: 'translateX(-50%) rotate(0rad)',
          willChange: 'transform',
        }}
      >
        {/* rope */}
        <div
          style={{
            width: 5,
            height: 110,
            margin: '0 auto',
            background: `linear-gradient(180deg, ${palette.lanyard}, ${palette.header})`,
            borderRadius: 3,
            boxShadow: 'inset -1px 0 0 rgba(0,0,0,0.18), inset 1px 0 0 rgba(255,255,255,0.18)',
          }}
        />

        {/* clip */}
        <div
          style={{
            width: 42,
            height: 16,
            margin: '-2px auto 0',
            background: 'linear-gradient(180deg, #e4e4e7 0%, #a1a1aa 60%, #71717a 100%)',
            borderRadius: 4,
            boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.4)',
          }}
        />

        {/* card */}
        <div
          onMouseDown={onPointerDown}
          onTouchStart={onPointerDown}
          style={{
            width: 240,
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 18px 40px rgba(0,0,0,0.22), 0 4px 10px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            cursor: 'grab',
            marginTop: -4,
            position: 'relative',
          }}
        >
          {/* hole punch */}
          <div
            style={{
              position: 'absolute',
              top: 9,
              left: '50%',
              width: 34,
              height: 6,
              background: '#0f172a',
              borderRadius: 4,
              transform: 'translateX(-50%)',
              zIndex: 2,
              boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15)',
            }}
          />

          {/* header strip */}
          <div
            style={{
              height: 112,
              background: `linear-gradient(135deg, ${palette.lanyard} 0%, ${palette.header} 100%)`,
              position: 'relative',
              paddingTop: 28,
              textAlign: 'center',
              color: palette.text,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.22em',
                opacity: 0.95,
              }}
            >
              BIGROCKER
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                marginTop: 4,
                letterSpacing: '0.15em',
                opacity: 0.75,
              }}
            >
              OFFICIAL ID · {idCode}
            </div>

            {/* decorative diagonal stripes */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'repeating-linear-gradient(45deg, transparent 0 8px, rgba(255,255,255,0.06) 8px 16px)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* avatar overlapping header/body */}
          <div
            style={{
              position: 'absolute',
              top: 74,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#fff',
              padding: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
              zIndex: 1,
            }}
          >
            <Av name={user.full_name} size={72} url={user.avatar_url} mood={user.mood_emoji} />
          </div>

          {/* body */}
          <div style={{ padding: '46px 18px 20px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: '#0f172a',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user.full_name || 'Senza nome'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: '#64748B',
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              {displayRole(user)}
            </div>

            <div style={{ height: 1, background: '#E2E8F0', margin: '14px 0' }} />

            {/* barcode */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 1,
                height: 30,
              }}
            >
              {bars.map((b, i) => (
                <div
                  key={i}
                  style={{
                    width: b.w,
                    height: `${b.h * 100}%`,
                    background: '#0f172a',
                  }}
                />
              ))}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: palette.header,
                marginTop: 6,
                letterSpacing: '0.22em',
              }}
            >
              BR · {year}
            </div>

            <div
              style={{
                display: 'inline-block',
                marginTop: 12,
                padding: '5px 14px',
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                borderRadius: 999,
                color: '#fff',
                background: dept ? dept.color : palette.lanyard,
                boxShadow: `0 2px 8px ${(dept ? dept.color : palette.lanyard)}55`,
              }}
            >
              {dept ? dept.label : 'Active'}
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: 6,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 11,
          color: '#94A3B8',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        Trascina o clicca la card ↔
      </div>
    </div>
  )
}
