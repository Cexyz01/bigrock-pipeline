export default function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#555' }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#777', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13 }}>{sub}</div>
    </div>
  )
}
