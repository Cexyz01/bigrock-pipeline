export default function Av({ name, size = 30, url, mood }) {
  if (url) return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <img src={url} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
      {mood && <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: size * 0.4, lineHeight: 1 }}>{mood}</span>}
    </div>
  )
  const ini = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `hsl(${hue},30%,18%)`, border: `1.5px solid hsl(${hue},55%,65%,0.3)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 600, color: `hsl(${hue},55%,65%)`,
      }}>{ini}</div>
      {mood && <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: size * 0.4, lineHeight: 1 }}>{mood}</span>}
    </div>
  )
}
