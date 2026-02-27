export default function EmptyState({ icon, title, sub }) {
  const isJsx = typeof icon !== 'string'
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px' }}>
      <div style={{
        fontSize: isJsx ? undefined : 48,
        marginBottom: 16, opacity: 0.3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isJsx ? icon : icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#94A3B8' }}>{sub}</div>
    </div>
  )
}
