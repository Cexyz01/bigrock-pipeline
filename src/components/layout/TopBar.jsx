export default function TopBar({ viewLabel, viewIcon }) {
  return (
    <div style={{
      height: 60, borderBottom: '1px solid #1a1a28',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', background: '#0b0b12', position: 'sticky', top: 0, zIndex: 10,
    }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f0' }}>{viewIcon} {viewLabel}</span>
    </div>
  )
}
