import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ImageLightbox({ src, onClose }) {
  if (!src) return null

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
        animation: 'fadeIn 0.15s ease',
      }}
    >
      <img
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '92vw', maxHeight: '92vh',
          borderRadius: 8, objectFit: 'contain',
          cursor: 'default',
          boxShadow: '0 8px 60px rgba(0,0,0,0.5)',
        }}
      />
    </div>,
    document.body,
  )
}
