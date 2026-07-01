import { useCallback, useRef } from 'react'
import { TILT_MAX_DEG, TILT_RETURN_MS } from '../lib/cardConstants'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

/**
 * useTilt3D — direct-DOM 3D tilt + diagonal shine reflection.
 * Bypasses React re-renders for 60fps. Returns refs + the four handlers.
 *
 *   const { tiltRef, shineRef, handlers } = useTilt3D({ max: 15 })
 *   <div ref={tiltRef} {...handlers}>…<div ref={shineRef}/></div>
 *
 * Use the dedicated touch handlers (or spread `handlers`) so taps that
 * don't move close the modal rather than firing tilt forever.
 */
export default function useTilt3D({ max = TILT_MAX_DEG, onTap } = {}) {
  const tiltRef = useRef(null)
  const shineRef = useRef(null)
  const touchRef = useRef(null)

  const setTilt = useCallback((tx, ty, animate) => {
    const el = tiltRef.current
    if (!el) return
    el.style.transition = animate ? `transform ${TILT_RETURN_MS}ms ease-out` : 'none'
    el.style.transform = `perspective(800px) rotateX(${tx}deg) rotateY(${ty}deg)`
    const shine = shineRef.current
    if (!shine) return
    const mag = Math.sqrt(tx * tx + ty * ty)
    const intensity = Math.min(mag / max, 1)
    shine.style.transition = animate ? `opacity ${TILT_RETURN_MS}ms ease-out` : 'none'
    shine.style.opacity = intensity > 0.01 ? '1' : '0'
    if (intensity > 0.01) {
      const a = 135 + ty * 0.5
      const p = 50 + tx * 5
      const pk = (0.15 * intensity).toFixed(3)
      const lo = (0.04 * intensity).toFixed(3)
      shine.style.background = `linear-gradient(${a}deg, transparent ${p - 40}%, rgba(255,255,255,${lo}) ${p - 20}%, rgba(255,255,255,${pk}) ${p}%, rgba(255,255,255,${lo}) ${p + 20}%, transparent ${p + 40}%)`
    }
  }, [max])

  const onMouseMove = useCallback((e) => {
    const el = tiltRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const nx = (e.clientX - cx) / (rect.width / 2)
    const ny = (e.clientY - cy) / (rect.height / 2)
    // "Push away from cursor" model: the corner under the cursor recedes
    // (as if pressing that spot down), the opposite corner lifts toward
    // the viewer.
    //  - cursor right (nx>0) → rotateY positive → right edge recedes
    //  - cursor below (ny>0) → rotateX negative → bottom edge recedes
    setTilt(clamp(ny * -max, -max, max), clamp(nx * max, -max, max), true)
  }, [setTilt, max])

  const onMouseLeave = useCallback(() => setTilt(0, 0, true), [setTilt])

  const onTouchStart = useCallback((e) => {
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, moved: false }
  }, [])

  const onTouchMove = useCallback((e) => {
    if (!touchRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchRef.current.x
    const dy = t.clientY - touchRef.current.y
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) touchRef.current.moved = true
    // Same "push away from finger" model as mouse.
    setTilt(clamp(dy * -0.12, -max, max), clamp(dx * 0.12, -max, max), false)
  }, [setTilt, max])

  const onTouchEnd = useCallback((e) => {
    const wasTap = touchRef.current && !touchRef.current.moved
    touchRef.current = null
    setTilt(0, 0, true)
    if (wasTap && onTap) {
      e.preventDefault()
      onTap(e)
    }
  }, [setTilt, onTap])

  const onTouchCancel = useCallback(() => {
    touchRef.current = null
    setTilt(0, 0, true)
  }, [setTilt])

  return {
    tiltRef,
    shineRef,
    setTilt,
    handlers: { onMouseMove, onMouseLeave, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel },
  }
}
