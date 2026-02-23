export default function Select({ value, onChange, options, placeholder, style = {} }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#1a1a32', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16,
        padding: '13px 18px', color: '#EEEEF5', fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s ease', cursor: 'pointer', ...style,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
