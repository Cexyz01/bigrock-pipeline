import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { getImageAnnotations, upsertImageAnnotation, subscribeImageAnnotations } from '../lib/supabase'

// Shared cache for image annotations. AnnotatedImage components subscribe to
// their URL via useImageAnnotation(url); the provider batches network reads
// (~20 URLs at a time, debounced by 50 ms) so a screen with a dozen WIP
// thumbnails fires a single SELECT instead of one-per-image.

const AnnotationsCtx = createContext(null)

const EMPTY = []

export function AnnotationsProvider({ user, children }) {
  // Map<url, { strokes, updated_by, updated_at }>
  const cacheRef = useRef(new Map())
  // URLs whose result is in flight, so we don't re-request mid-fetch
  const inflightRef = useRef(new Set())
  // URLs queued for the next batch
  const pendingRef = useRef(new Set())
  const timerRef = useRef(null)
  // Tick counter — components subscribe to it (via the hook) to know when to
  // re-read from the cache. Bumped on every successful fetch / save.
  const [tick, setTick] = useState(0)
  const bump = useCallback(() => setTick(t => t + 1), [])

  const flush = useCallback(async () => {
    timerRef.current = null
    const urls = Array.from(pendingRef.current)
    pendingRef.current.clear()
    if (urls.length === 0) return
    urls.forEach(u => inflightRef.current.add(u))
    const rows = await getImageAnnotations(urls)
    const seen = new Set()
    for (const row of rows) {
      cacheRef.current.set(row.image_url, {
        strokes: row.strokes || EMPTY,
        updated_by: row.updated_by,
        updated_at: row.updated_at,
      })
      seen.add(row.image_url)
    }
    // URLs we asked about but got no row → cache as empty so we don't refetch
    for (const u of urls) {
      if (!seen.has(u)) cacheRef.current.set(u, { strokes: EMPTY, updated_by: null, updated_at: null })
      inflightRef.current.delete(u)
    }
    bump()
  }, [bump])

  const requestLoad = useCallback((url) => {
    if (!url) return
    if (cacheRef.current.has(url) || inflightRef.current.has(url)) return
    pendingRef.current.add(url)
    if (!timerRef.current) timerRef.current = setTimeout(flush, 50)
  }, [flush])

  const getEntry = useCallback((url) => {
    if (!url) return null
    return cacheRef.current.get(url) || null
  }, [])

  const saveStrokes = useCallback(async (url, strokes) => {
    // Optimistic local update so the overlay redraws instantly on save.
    cacheRef.current.set(url, {
      strokes: strokes || EMPTY,
      updated_by: user?.id || null,
      updated_at: new Date().toISOString(),
    })
    bump()
    return upsertImageAnnotation(url, strokes, user?.id)
  }, [user, bump])

  // Realtime: keep cache in sync when another staff member saves on the same image.
  useEffect(() => {
    const sub = subscribeImageAnnotations((payload) => {
      const row = payload.new || payload.old
      if (!row?.image_url) return
      if (payload.eventType === 'DELETE') {
        cacheRef.current.delete(row.image_url)
      } else {
        cacheRef.current.set(row.image_url, {
          strokes: row.strokes || EMPTY,
          updated_by: row.updated_by,
          updated_at: row.updated_at,
        })
      }
      bump()
    })
    return () => { try { sub.unsubscribe() } catch {} }
  }, [bump])

  const value = { requestLoad, getEntry, saveStrokes, tick }
  return <AnnotationsCtx.Provider value={value}>{children}</AnnotationsCtx.Provider>
}

export function useImageAnnotation(url) {
  const ctx = useContext(AnnotationsCtx)
  useEffect(() => {
    if (ctx && url) ctx.requestLoad(url)
  }, [ctx, url])
  if (!ctx) return { strokes: EMPTY, loaded: false, save: async () => {} }
  const entry = ctx.getEntry(url)
  return {
    strokes: entry?.strokes || EMPTY,
    loaded: !!entry,
    save: (strokes) => ctx.saveStrokes(url, strokes),
  }
}
