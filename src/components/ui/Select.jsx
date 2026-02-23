export default function Select({ value, onChange, options, placeholder, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#141420', border: '1px solid #1e1e2e', borderRadius: 14,
        padding: '12px 16px', color: '#f0f0f5', fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s ease', cursor: 'pointer', ...style,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
