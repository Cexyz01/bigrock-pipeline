// Force-download a remote media file (R2 is cross-origin and sends no
// Content-Disposition, so a plain <a download> just opens the image in a tab).
// We route through our own /api/download proxy which re-serves the file
// same-origin with an attachment disposition, so the download starts directly.
export function downloadMedia(url, baseName) {
  if (!url) return
  const clean = url.split('?')[0]
  const ext = (clean.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase()
  const safeBase = (baseName || 'download').replace(/[^\w.-]+/g, '_') || 'download'
  const filename = safeBase.toLowerCase().endsWith(`.${ext}`) ? safeBase : `${safeBase}.${ext}`
  const a = document.createElement('a')
  a.href = `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename)}`
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
