// Cloudinary URL optimizer — inject q_auto,f_auto (and optionally resize) into
// any Cloudinary delivery URL. q_auto picks perceptually-lossless quality
// (usually 50-70% smaller than original). f_auto serves WebP/AVIF to browsers
// that support it, falls back to the original format otherwise.
//
// Use `cld(url)` for a passive optimization, or `cld(url, { w, h, fit })` to
// also resize. Returns the URL unchanged if it isn't a Cloudinary URL or
// already has the transformation applied.

const MARKER = '/upload/'

export function cld(url, { w, h, fit = 'fit' } = {}) {
  if (!url || typeof url !== 'string') return url
  const idx = url.indexOf(MARKER)
  if (idx === -1) return url // not a Cloudinary /upload/ URL

  const after = url.slice(idx + MARKER.length)
  // already optimized — don't double-wrap
  if (/^(c_|w_|h_|q_|f_)/.test(after)) return url

  const parts = ['q_auto', 'f_auto']
  if (w || h) {
    parts.unshift(`c_${fit}`)
    if (w) parts.push(`w_${Math.floor(w)}`)
    if (h) parts.push(`h_${Math.floor(h)}`)
  }
  return url.slice(0, idx + MARKER.length) + parts.join(',') + '/' + after
}
