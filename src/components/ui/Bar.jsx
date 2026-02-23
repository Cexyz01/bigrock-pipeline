export default function Bar({ value, h = 4 }) {
  return (
    <div style={{ width: '100%', height: h, borderRadius: h, background: '#1e1e2a', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: '100%', borderRadius: h,
        background: value > 70 ? '#6ee7a0' : value > 35 ? '#6ea8fe' : '#f0c36d',
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  )
}
