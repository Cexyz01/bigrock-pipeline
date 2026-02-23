import { useState } from 'react'

export default function NavBtn({ icon, label, active, onClick, badge, collapsed }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
        gap: collapsed ? 0 : 12,
        padding: collapsed ? '12px 0' : '10px 16px',
        margin: collapsed ? '2px 8px' : '2px 10px',
        borderRadius: 12,
        cursor: 'pointer', userSelect: 'none', position: 'relative',
        background: active ? 'rgba(108,92,231,0.08)' : h ? '#F1F5F9' : 'transparent',
        color: active ? '#6C5CE7' : h ? '#334155' : '#64748B',
        transition: 'all 0.15s ease',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22 }}>
        {icon}
      </span>
      {!collapsed && <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 500 }}>{label}</span>}
      {badge > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: '#EF4444', color: '#fff',
          padding: '1px 6px', borderRadius: 10,
          position: collapsed ? 'absolute' : 'static',
          top: collapsed ? 4 : undefined, right: collapsed ? 4 : undefined,
          minWidth: 16, textAlign: 'center',
        }}>{badge}</span>
      )}
    </div>
  )
}
