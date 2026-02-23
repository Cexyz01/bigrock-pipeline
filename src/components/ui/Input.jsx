export default function Input({ value, onChange, placeholder, style = {}, multiline, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
        padding: '11px 14px', color: '#1a1a2e', fontSize: 13, outline: 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        resize: multiline ? 'vertical' : undefined,
        minHeight: multiline ? 80 : undefined, ...style,
      }}
      onFocus={e => { e.target.style.borderColor = '#6C5CE7'; e.target.style.boxShadow = '0 0 0 3px rgba(108,92,231,0.08)' }}
      onBlur={e => { e.target.style.borderColor = '#E2E8F0'; e.target.style.boxShadow = 'none' }}
      {...props}
    />
  )
}
