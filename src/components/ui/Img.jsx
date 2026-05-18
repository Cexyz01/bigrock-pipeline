import { useState, useMemo, useRef, useEffect } from 'react'
import { cld } from '../../lib/cld'

// Drop-in <img> replacement that survives Safari's flakier image pipeline:
//   - retries transient load failures (CDN edge propagation race on freshly
//     uploaded assets — common after a Cloudinary upload finishes locally but
//     hasn't reached the user's PoP yet)
//   - on repeated failures, falls back to the raw URL (no f_auto/AVIF) since
//     Safari has historical AVIF decoder hiccups
//   - shows a soft grey placeholder instead of the browser's "?" broken-image
//     glyph if everything fails
//
// API mirrors <img> plus `w`, `h`, `fit` which are forwarded to cld() so
// callers can stay terse (no need to wrap src in cld() at the call site).

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
    // attempts 0..2: optimized (cld transforms). attempt 3: raw URL, no f_auto.
    const base = attempt >= 3 ? src : cld(src, { w, h, fit })
    if (attempt === 0) return base
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}_r=${attempt}`
  }, [src, w, h, fit, attempt])

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
