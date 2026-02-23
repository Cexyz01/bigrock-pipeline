export default function Bar({ value, h = 4 }) {
  return (
    <div style={{ width: '100%', height: h, borderRadius: h, background: '#1e1e2e', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: '100%', borderRadius: h,
        background: value > 70
          ? 'linear-gradient(90deg, #4ecdc4, #45b7aa)'
          : value > 35
            ? 'linear-gradient(90deg, #7c5cfc, #a78bfa)'
            : 'linear-gradient(90deg, #f0c36d, #f5d98a)',
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  )
}
