export default function Bar({ value, h = 4 }) {
  return (
    <div style={{ width: '100%', height: h, borderRadius: h, background: '#1e1e2e', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: '100%', borderRadius: h,
        background: value > 70
          ? 'linear-gradient(90deg, #4ECDC4, #3db8b0)'
          : value > 35
            ? 'linear-gradient(90deg, #CDFF00, #b8e600)'
            : 'linear-gradient(90deg, #FF6B4A, #ff8e70)',
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  )
}
