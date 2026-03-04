import { useEffect } from 'react'

export default function useConsoleKeyboard(isAdmin, onToggle) {
  useEffect(() => {
    if (!isAdmin) return
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        onToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isAdmin, onToggle])
}
