import { useState, useMemo, useRef, useEffect } from 'react'

// Drop-in <img> replacement that survives Safari's flakier image pipeline:
//   - retries transient load failures (CDN edge propagation race on freshly
//     uploaded assets — the object may not have reached the user's PoP yet)
//   - shows a soft grey placeholder instead of the browser's "?" broken-image
//     glyph if everything fails
//
// `w`, `h`, `fit` are accepted for API compatibility but ignored: media lives
// on R2, which has no on-the-fly transform endpoint (Cloudinary removed).

const RETRY_DELAYS = [250, 1000, 3000]

export default function Img({ src, w, h, fit, alt = '', style, onLoad, onError, ...rest }) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  const timerRef = useRef(null)

  // Reset retry state when src changes (e.g. swapping the image entirely).
  useEffect(() => {
    setAttempt(0)
    setFailed(false)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [src])

  const finalSrc = useMemo(() => {
    if (!src) return ''
    if (attempt === 0) return src
    // On retry, append a cache-busting param so the browser refetches.
    const sep = src.includes('?') ? '&' : '?'
    return `${src}${sep}_r=${attempt}`
  }, [src, attempt])

  if (failed || !src) {
    return <div role="img" aria-label={alt} style={{ background: '#E2E8F0', ...style }} />
  }

  const handleError = (e) => {
    if (attempt < RETRY_DELAYS.length + 1) {
      const delay = RETRY_DELAYS[attempt] ?? 3000
      timerRef.current = setTimeout(() => setAttempt(a => a + 1), delay)
    } else {
      setFailed(true)
      onError?.(e)
    }
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      style={style}
      decoding="async"
      onLoad={onLoad}
      onError={handleError}
      {...rest}
    />
  )
}
