export default function Input({ value, onChange, placeholder, style = {}, multiline, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', background: '#1a1a26', border: '1px solid #2a2a36', borderRadius: 10,
        padding: '12px 16px', color: '#e0e0e8', fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        resize: multiline ? 'vertical' : undefined,
        minHeight: multiline ? 80 : undefined, ...style,
      }}
      onFocus={e => { e.target.style.borderColor = '#6ea8fe55'; e.target.style.boxShadow = '0 0 0 3px rgba(110,168,254,0.1)' }}
      onBlur={e => { e.target.style.borderColor = '#2a2a36'; e.target.style.boxShadow = 'none' }}
      {...props}
    />
  )
}
