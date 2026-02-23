export default function TopBar({ viewLabel, viewIcon }) {
  return (
    <div style={{
      height: 60, borderBottom: '1px solid #1e1e2e',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', background: '#09090f', position: 'sticky', top: 0, zIndex: 10,
    }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f0f5' }}>{viewIcon} {viewLabel}</span>
    </div>
  )
}
