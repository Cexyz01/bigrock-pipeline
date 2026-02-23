export default function Bar({ value, h = 4 }) {
  return (
    <div style={{ width: '100%', height: h, borderRadius: h, background: '#232345', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: '100%', borderRadius: h,
        background: value > 70
          ? 'linear-gradient(90deg, #A8E6CF, #88D8C0)'
          : value > 35
            ? 'linear-gradient(90deg, #9DC4E8, #C5B3E6)'
            : 'linear-gradient(90deg, #FFB7B2, #FFB8A1)',
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  )
}
