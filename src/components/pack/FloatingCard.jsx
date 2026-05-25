import { useRef, useState } from 'react'
import { ScaledCard } from './CardRenderer'

const DRAG_THRESHOLD = 5

export default function FloatingCard({ float, onMove, onClick, onPickup, onReturn }) {
  const dragRef = useRef(null)
  const [grabbing, setGrabbing] = useState(false)

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onReturn) onReturn(float.uid)
  }

  const handlePointerDown = (e) => {
    if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return
    e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const origX = float.x, origY = float.y
    dragRef.current = { dragging: false }
    if (onPickup) onPickup(float.uid)

    const move = (ev) => {
      const s = dragRef.current
      if (!s) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!s.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        s.dragging = true
        setGrabbing(true)
      }
      if (s.dragging) onMove(float.uid, origX + dx, origY + dy)
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      const dragging = dragRef.current?.dragging
      dragRef.current = null
      setGrabbing(false)
      if (!dragging && onClick) onClick(float)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      style={{
        position: 'fixed',
        left: float.x,
        top: float.y,
        width: float.width,
        zIndex: float.z || 8500,
        cursor: grabbing ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        filter: grabbing
          ? 'drop-shadow(0 22px 36px rgba(0,0,0,0.55))'
          : 'drop-shadow(0 14px 28px rgba(0,0,0,0.45))',
        transform: grabbing ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform 0.18s cubic-bezier(0.22,1,0.36,1), filter 0.18s ease',
        willChange: 'left, top, transform',
      }}
    >
      <ScaledCard
        card={float.card}
        owned={true}
        copyInfo={float.copyInfo}
        totalCopies={float.totalCopies}
      />
    </div>
  )
}
