// ════════════════════════════════════════════════════════════════════
// THUMBNAIL LAYER for R2-hosted images
// ════════════════════════════════════════════════════════════════════
//
// R2 has no on-the-fly resize endpoint (Cloudinary removed). To stop the
// storyboard from downloading dozens of multi-MB originals on every visit, we
// store a small WebP sibling next to each raster original:
//
//     <originalKey>_t512.webp
//
// The board paints these first (tens of KB each → instant) and upgrades to the
// full-res original only for cells the user has actually zoomed into. If a
// thumb doesn't exist yet (an older image not backfilled, or a non-raster file)
// callers transparently fall back to the original — nothing breaks.
//
// Keep this convention in sync with:
//   - the signer action `r2_sign_thumb` in supabase/functions/miro-sync
//   - scripts/backfill-thumbs.mjs (generates thumbs for existing objects)

export const THUMB_SUFFIX = '_t512.webp'
export const THUMB_MAX_EDGE = 512

// Public R2 dev host. Only objects served from here can have a thumb sibling.
const R2_PUBLIC_HOST = 'pub-8ac8b6b594594dd59ff520c81cc243ea.r2.dev'
const RASTER_RE = /\.(jpe?g|png|webp|bmp|avif|tiff?)$/i // gif excluded (keep animation)

// True for a full-res R2 raster original that can have a thumb sibling.
export function isThumbable(url) {
  if (!url || typeof url !== 'string') return false
  if (!url.includes(R2_PUBLIC_HOST)) return false
  if (url.includes(THUMB_SUFFIX)) return false
  const path = url.split(/[?#]/)[0] // strip query/hash before extension test
  return RASTER_RE.test(path)
}

// Thumb URL for an original (or the original unchanged if not thumbable).
export function thumbUrlFor(url) {
  return isThumbable(url) ? url + THUMB_SUFFIX : url
}

// Generate a small WebP thumbnail Blob from an image File/Blob, longest edge
// clamped to THUMB_MAX_EDGE. Returns null on any failure or for non-raster
// files — callers treat that as "no thumb" (best-effort: the original still
// uploads, and the board just serves the original until a thumb exists).
export async function generateThumbBlob(file, maxEdge = THUMB_MAX_EDGE, quality = 0.72) {
  try {
    if (!file || !file.type || !file.type.startsWith('image/')) return null
    if (file.type === 'image/gif') return null // animated; not worth a static thumb

    let bitmap = null
    try {
      bitmap = await createImageBitmap(file)
    } catch {
      bitmap = await imageFromBlob(file) // Safari/older fallback
    }
    const srcW = bitmap.width || bitmap.naturalWidth || 0
    const srcH = bitmap.height || bitmap.naturalHeight || 0
    if (!srcW || !srcH) { bitmap.close?.(); return null }

    const ratio = Math.min(1, maxEdge / Math.max(srcW, srcH))
    const w = Math.max(1, Math.round(srcW * ratio))
    const h = Math.max(1, Math.round(srcH * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close?.(); return null }
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', quality))
    return blob || null
  } catch {
    return null
  }
}

function imageFromBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}
