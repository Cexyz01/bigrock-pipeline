export default function TopBar({ viewLabel, viewIcon }) {
  return (
    <div style={{
      height: 70, borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px', background: '#0f0f1a', position: 'sticky', top: 0, zIndex: 10,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: '#EEEEF5' }}>{viewIcon} {viewLabel}</span>
    </div>
  )
}
