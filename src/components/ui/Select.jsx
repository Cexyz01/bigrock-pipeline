export default function Select({ value, onChange, options, placeholder, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#1a1a26', border: '1px solid #2a2a36', borderRadius: 10,
        padding: '12px 16px', color: '#e0e0e8', fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s ease', cursor: 'pointer', ...style,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
