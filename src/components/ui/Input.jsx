export default function Input({ value, onChange, placeholder, style = {}, multiline, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', background: '#141420', border: '1px solid #1e1e2e', borderRadius: 14,
        padding: '12px 16px', color: '#f0f0f5', fontSize: 14, outline: 'none',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        resize: multiline ? 'vertical' : undefined,
        minHeight: multiline ? 80 : undefined, ...style,
      }}
      onFocus={e => { e.target.style.borderColor = 'rgba(205,255,0,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(205,255,0,0.08)' }}
      onBlur={e => { e.target.style.borderColor = '#1e1e2e'; e.target.style.boxShadow = 'none' }}
      {...props}
    />
  )
}
