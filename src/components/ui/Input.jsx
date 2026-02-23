export default function Input({ value, onChange, placeholder, style = {}, multiline, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', background: '#1a1a32', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16,
        padding: '13px 18px', color: '#EEEEF5', fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        resize: multiline ? 'vertical' : undefined,
        minHeight: multiline ? 80 : undefined, ...style,
      }}
      onFocus={e => { e.target.style.borderColor = 'rgba(197,179,230,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(197,179,230,0.08)' }}
      onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.06)'; e.target.style.boxShadow = 'none' }}
      {...props}
    />
  )
}
