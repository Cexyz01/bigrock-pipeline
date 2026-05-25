// One ResizeObserver shared by every ScaledCard (and anything else that
// just needs to react to its own width). 120 cards × 1 RO each used to
// create 120 native observers and 120 GC roots — this collapses them.

let ro = null
const callbacks = new WeakMap()

function getRO() {
  if (ro) return ro
  if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return null
  ro = new ResizeObserver(entries => {
    for (const e of entries) {
      const cb = callbacks.get(e.target)
      if (cb) cb(e.contentRect.width, e.contentRect.height)
    }
  })
  return ro
}

export function observeWidth(el, cb) {
  const obs = getRO()
  if (!el || !obs) return () => {}
  callbacks.set(el, cb)
  obs.observe(el)
  return () => {
    try { obs.unobserve(el) } catch {}
    callbacks.delete(el)
  }
}
