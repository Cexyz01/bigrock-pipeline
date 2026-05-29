import Img from './Img'

export default function Av({ name, size = 30, url, mood }) {
  // Lock the avatar to a perfect square regardless of the flex/grid context it
  // lands in: fixed width+height + flexShrink:0 on the wrapper, and the inner
  // element fills it at a 1:1 aspect ratio. Without the hard square, a tight
  // flex line could compress the box into an oval.
  const box = { position: 'relative', flexShrink: 0, width: size, height: size, lineHeight: 0 }
  if (url) return (
    <div style={box}>
      <Img src={url} w={size * 2} h={size * 2} fit="fill" style={{ width: '100%', height: '100%', display: 'block', aspectRatio: '1 / 1', borderRadius: '50%', objectFit: 'cover', border: '2px solid #F0F2F5', boxSizing: 'border-box' }} />
      {mood && <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: size * 0.38, lineHeight: 1 }}>{mood}</span>}
    </div>
  )
  const ini = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={box}>
      <div style={{
        width: '100%', height: '100%', aspectRatio: '1 / 1', borderRadius: '50%',
        background: `hsl(${hue},65%,92%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.36, fontWeight: 700, color: `hsl(${hue},55%,45%)`, lineHeight: 1,
      }}>{ini}</div>
      {mood && <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: size * 0.38, lineHeight: 1 }}>{mood}</span>}
    </div>
  )
}
