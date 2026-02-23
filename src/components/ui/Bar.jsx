export default function Bar({ value, h = 6 }) {
  return (
    <div style={{ width: '100%', height: h, borderRadius: h, background: '#E8ECF1', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: '100%', borderRadius: h,
        background: value > 70
          ? 'linear-gradient(90deg, #34D399, #10B981)'
          : value > 35
            ? 'linear-gradient(90deg, #60A5FA, #6C5CE7)'
            : 'linear-gradient(90deg, #F87171, #EF4444)',
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  )
}
