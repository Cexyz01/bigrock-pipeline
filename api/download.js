// Same-origin download proxy. R2 public URLs are cross-origin and don't send
// Content-Disposition, so a browser opens the image in a tab instead of
// downloading it. This streams the file back from our own origin with an
// attachment disposition so the download starts directly — no extra tab.
const ALLOWED_HOSTS = [
  'pub-8ac8b6b594594dd59ff520c81cc243ea.r2.dev',
]

export default async function handler(req, res) {
  const { url, name } = req.query
  if (!url) { res.status(400).send('Missing url'); return }

  let parsed
  try { parsed = new URL(url) } catch { res.status(400).send('Bad url'); return }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.status(403).send('Host not allowed'); return
  }

  try {
    const upstream = await fetch(parsed.toString())
    if (!upstream.ok) { res.status(upstream.status).send('Upstream error'); return }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const safeName = String(name || 'download').replace(/[^\w.\-]+/g, '_').slice(0, 200) || 'download'
    const buf = Buffer.from(await upstream.arrayBuffer())

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
    res.setHeader('Content-Length', buf.length)
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.status(200).send(buf)
  } catch (e) {
    res.status(502).send('Fetch failed')
  }
}
