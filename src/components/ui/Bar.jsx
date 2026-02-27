export default function Bar({ value, h = 6 }) {
  // Vibrant color tiers: red → orange → green
  const color = value >= 70 ? '#10B981' : value >= 35 ? '#F28C28' : '#EF4444'
  return (
    <div style={{ width: '100%', height: h, borderRadius: h, background: '#E8ECF1', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: '100%', borderRadius: h,
        background: color,
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  )
}
