export default function Select({ value, onChange, options, placeholder, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
        padding: '11px 14px', color: '#1a1a1a', fontSize: 13, outline: 'none',
        transition: 'border-color 0.2s ease', cursor: 'pointer', ...style,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
