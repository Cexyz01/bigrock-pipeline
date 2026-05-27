// Best-effort "auto-number the things on this image" detector. Pure 2D canvas,
// no AI. Works well for clean compositions (character turnarounds, prop sheets,
// asset boards on a mostly-uniform background) and degrades on busy scenes —
// the UI calling this is expected to let the user remove false positives
// before committing.
//
// Pipeline:
//   1. Downscale into an offscreen canvas (max 800px) for speed.
//   2. Estimate background from border pixels (quantised histogram → most
//      common bucket → mean of pixels in that bucket).
//   3. Foreground mask = pixel further than `tol` from background in RGB.
//   4. Morphological closing (separable square SE) to bridge thin gaps inside
//      a single object (open outlines, dashed strokes).
//   5. Connected components (4-conn, iterative BFS) on the closed mask.
//   6. Drop components below `minAreaFrac` of the image area.
//   7. Sort top→bottom, left→right with a row-tolerance so a row that's
//      slightly tilted still numbers left-to-right.
//   8. Return centroids in normalised [0..1] image-space, plus the bounding
//      box (also normalised) so the UI can place badges sensibly.

function loadImageCORS(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    // Cache-bust the CORS fetch. Without this, Chrome can return a previously
    // cached no-CORS response (loaded by the visible <img> tag without
    // crossorigin) for our crossOrigin='anonymous' request — the cached
    // response has no Access-Control-Allow-Origin header (R2 only echoes the
    // request Origin, so a no-origin fetch caches with no CORS), the CORS
    // check fails, and onerror fires. Worked with Cloudinary because it
    // always served ACAO:* regardless of Origin.
    const sep = src.includes('?') ? '&' : '?'
    img.src = src + sep + 'cors=1'
  })
}

// Mean colour of border pixels matching the dominant 4-bit-per-channel bucket.
// Quantising first prevents a few stray dark pixels (a logo, a watermark) from
// dragging the average off the real background colour.
function estimateBackground(data, w, h) {
  const buckets = new Map()
  const bump = (off) => {
    const r = data[off] >> 4
    const g = data[off + 1] >> 4
    const b = data[off + 2] >> 4
    const key = (r << 8) | (g << 4) | b
    buckets.set(key, (buckets.get(key) || 0) + 1)
  }
  for (let x = 0; x < w; x++) { bump((0 * w + x) * 4); bump(((h - 1) * w + x) * 4) }
  for (let y = 1; y < h - 1; y++) { bump((y * w + 0) * 4); bump((y * w + (w - 1)) * 4) }

  let bestKey = 0, bestCount = 0
  for (const [k, c] of buckets) if (c > bestCount) { bestKey = k; bestCount = c }
  const tR = (bestKey >> 8) & 0xf, tG = (bestKey >> 4) & 0xf, tB = bestKey & 0xf

  let rSum = 0, gSum = 0, bSum = 0, n = 0
  const sample = (off) => {
    if ((data[off] >> 4) === tR && (data[off + 1] >> 4) === tG && (data[off + 2] >> 4) === tB) {
      rSum += data[off]; gSum += data[off + 1]; bSum += data[off + 2]; n++
    }
  }
  for (let x = 0; x < w; x++) { sample((0 * w + x) * 4); sample(((h - 1) * w + x) * 4) }
  for (let y = 1; y < h - 1; y++) { sample((y * w + 0) * 4); sample((y * w + (w - 1)) * 4) }
  if (n === 0) return { r: 255, g: 255, b: 255 }
  return { r: rSum / n, g: gSum / n, b: bSum / n }
}

function dilate(src, w, h, r) {
  const tmp = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let v = 0
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r)
      for (let xx = x0; xx <= x1; xx++) if (src[row + xx]) { v = 1; break }
      tmp[row + x] = v
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r)
      for (let yy = y0; yy <= y1; yy++) if (tmp[yy * w + x]) { v = 1; break }
      out[y * w + x] = v
    }
  }
  return out
}

function erode(src, w, h, r) {
  // Out-of-bounds is treated as foreground (we only fail erosion on an
  // *in-bounds* 0), so objects touching the image border don't get amputated
  // by the kernel falling off the edge.
  const tmp = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      let v = 1
      const x0 = Math.max(0, x - r), x1 = Math.min(w - 1, x + r)
      for (let xx = x0; xx <= x1; xx++) if (!src[row + xx]) { v = 0; break }
      tmp[row + x] = v
    }
  }
  const out = new Uint8Array(w * h)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 1
      const y0 = Math.max(0, y - r), y1 = Math.min(h - 1, y + r)
      for (let yy = y0; yy <= y1; yy++) if (!tmp[yy * w + x]) { v = 0; break }
      out[y * w + x] = v
    }
  }
  return out
}

// Reclassify any "background" pocket that's surrounded by foreground (i.e.
// not reachable from the image border via background pixels) as foreground.
// This is what turns an outlined character with light-skin interior — where
// the skin gets confused for background — into a single solid blob instead
// of a hollow ring that connected-components would break into 3-5 fragments.
function fillHoles(mask, w, h) {
  const visited = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  let top = 0
  const push = (i) => { if (!mask[i] && !visited[i]) { visited[i] = 1; stack[top++] = i } }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 1; y < h - 1; y++) { push(y * w); push(y * w + w - 1) }
  while (top > 0) {
    const p = stack[--top]
    const x = p % w
    const y = (p / w) | 0
    if (x > 0 && !mask[p - 1] && !visited[p - 1]) { visited[p - 1] = 1; stack[top++] = p - 1 }
    if (x < w - 1 && !mask[p + 1] && !visited[p + 1]) { visited[p + 1] = 1; stack[top++] = p + 1 }
    if (y > 0 && !mask[p - w] && !visited[p - w]) { visited[p - w] = 1; stack[top++] = p - w }
    if (y < h - 1 && !mask[p + w] && !visited[p + w]) { visited[p + w] = 1; stack[top++] = p + w }
  }
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = (mask[i] || !visited[i]) ? 1 : 0
  return out
}

function connectedComponents(mask, w, h) {
  const visited = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  const out = []
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || visited[i]) continue
    let top = 0
    stack[top++] = i
    visited[i] = 1
    let area = 0, sumX = 0, sumY = 0
    let minX = w, maxX = 0, minY = h, maxY = 0
    while (top > 0) {
      const p = stack[--top]
      const x = p % w
      const y = (p / w) | 0
      area++
      sumX += x; sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && mask[p - 1] && !visited[p - 1]) { visited[p - 1] = 1; stack[top++] = p - 1 }
      if (x < w - 1 && mask[p + 1] && !visited[p + 1]) { visited[p + 1] = 1; stack[top++] = p + 1 }
      if (y > 0 && mask[p - w] && !visited[p - w]) { visited[p - w] = 1; stack[top++] = p - w }
      if (y < h - 1 && mask[p + w] && !visited[p + w]) { visited[p + w] = 1; stack[top++] = p + w }
    }
    out.push({ area, cx: sumX / area, cy: sumY / area, minX, maxX, minY, maxY })
  }
  return out
}

export async function detectObjects(src, opts = {}) {
  const {
    maxSize = 800,
    tol = 32,           // RGB distance from background → foreground
    closeFrac = 0.012,  // closing radius as fraction of min(w, h)
    minAreaFrac = 0.003 // discard blobs smaller than this fraction of image area
  } = opts

  const img = await loadImageCORS(src)
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
  const w0 = Math.max(1, Math.round(img.naturalWidth * scale))
  const h0 = Math.max(1, Math.round(img.naturalHeight * scale))

  // Pass 1 — draw the image into a plain canvas just so we can estimate the
  // background colour from its border before we decide how to fill the pad.
  const tmpCanvas = document.createElement('canvas')
  tmpCanvas.width = w0; tmpCanvas.height = h0
  const tmpCtx = tmpCanvas.getContext('2d', { willReadFrequently: true })
  tmpCtx.drawImage(img, 0, 0, w0, h0)
  const bgData = tmpCtx.getImageData(0, 0, w0, h0).data
  const bg = estimateBackground(bgData, w0, h0)

  // Pass 2 — render the image on a padded canvas pre-filled with the
  // estimated background. The pad is wider than the closing radius so a
  // character whose outline reaches the original image edge cannot have its
  // dilated outline touch the canvas border. This means the background
  // outside every figure is always reachable from the canvas border (no
  // sealed-off corridors between vertically-adjacent figures), and the
  // hole-fill only fills genuine interior pockets — never merges two
  // characters into one blob.
  const closeR = Math.max(1, Math.round(Math.min(w0, h0) * closeFrac))
  const pad = closeR + 4
  const w = w0 + pad * 2
  const h = h0 + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, pad, pad, w0, h0)
  const { data } = ctx.getImageData(0, 0, w, h)

  const tol2 = tol * tol
  const mask = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const dr = data[i] - bg.r, dg = data[i + 1] - bg.g, db = data[i + 2] - bg.b
    if (dr * dr + dg * dg + db * db > tol2) mask[p] = 1
  }

  const closed = erode(dilate(mask, w, h, closeR), w, h, closeR)
  const filled = fillHoles(closed, w, h)

  const comps = connectedComponents(filled, w, h)
  const minArea = w0 * h0 * minAreaFrac
  const filtered = comps.filter(c => c.area >= minArea)

  const rowTol = h0 * 0.06
  filtered.sort((a, b) => {
    const dy = a.cy - b.cy
    if (Math.abs(dy) > rowTol) return dy
    return a.cx - b.cx
  })

  // Translate centroids and bboxes back into the original (un-padded) image
  // coordinate system, normalised to [0..1] of the original image.
  return filtered.map(c => ({
    x: (c.cx - pad) / w0,
    y: (c.cy - pad) / h0,
    bbox: {
      x: (c.minX - pad) / w0,
      y: (c.minY - pad) / h0,
      w: (c.maxX - c.minX + 1) / w0,
      h: (c.maxY - c.minY + 1) / h0,
    },
    area: c.area / (w0 * h0),
  }))
}
