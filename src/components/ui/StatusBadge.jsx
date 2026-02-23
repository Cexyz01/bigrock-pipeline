import { getShotStatus, getTaskStatus } from '../../lib/constants'

export default function StatusBadge({ status, type = 'shot' }) {
  const s = type === 'shot' ? getShotStatus(status) : getTaskStatus(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}
