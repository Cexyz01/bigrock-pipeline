export default function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '70px 24px', color: '#606080' }}>
      <div style={{ fontSize: 44, marginBottom: 16, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#9090B0', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{sub}</div>
    </div>
  )
}
