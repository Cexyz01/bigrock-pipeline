import { useState, useEffect, useRef } from 'react'
import { DEPTS, isStaff } from '../../lib/constants'
import { getChatMessages, sendChatMessage, supabase, subscribeToChatChannel } from '../../lib/supabase'
import Av from '../ui/Av'
import Input from '../ui/Input'
import Btn from '../ui/Btn'

export default function ChatPanel({ user, onClose }) {
  const staff = isStaff(user.role)
  const channels = ['general']
  if (staff) {
    DEPTS.forEach(d => channels.push(d.id))
  } else if (user.department) {
    channels.push(user.department)
  }

  const [channel, setChannel] = useState('general')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    getChatMessages(channel).then(setMessages)
  }, [channel])

  useEffect(() => {
    const sub = subscribeToChatChannel(channel, (payload) => {
      if (payload.new) {
        getChatMessages(channel).then(setMessages)
      }
    })
    return () => supabase.removeChannel(sub)
  }, [channel])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    await sendChatMessage(channel, user.id, input.trim())
    setInput('')
    setSending(false)
  }

  const deptLabel = (ch) => {
    if (ch === 'general') return '💬 Generale'
    const d = DEPTS.find(dep => dep.id === ch)
    return d ? `${d.icon} ${d.label}` : ch
  }

  return (
    <div style={{
      width: 340, background: '#111118', borderLeft: '1px solid #1c1c26',
      display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #1c1c26', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>💬 Chat</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#777', fontSize: 16, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Channel tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '10px 12px', overflowX: 'auto', borderBottom: '1px solid #1c1c26' }}>
        {channels.map(ch => (
          <button key={ch} onClick={() => setChannel(ch)}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: channel === ch ? 600 : 400,
              background: channel === ch ? '#6ea8fe18' : 'transparent',
              color: channel === ch ? '#6ea8fe' : '#777',
              border: `1px solid ${channel === ch ? '#6ea8fe30' : 'transparent'}`,
              cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s ease',
            }}
          >{deptLabel(ch)}</button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#444', fontSize: 12, padding: 40 }}>Nessun messaggio</div>
        ) : messages.map(m => {
          const isMine = m.author_id === user.id
          return (
            <div key={m.id} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              flexDirection: isMine ? 'row-reverse' : 'row',
            }}>
              <Av name={m.author?.full_name} size={24} url={m.author?.avatar_url} mood={m.author?.mood_emoji} />
              <div style={{
                maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                background: isMine ? '#6ea8fe18' : '#1a1a26',
                border: `1px solid ${isMine ? '#6ea8fe20' : '#2a2a36'}`,
              }}>
                {!isMine && (
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 2 }}>
                    {m.author?.full_name}
                    {m.author?.role !== 'studente' && <span style={{ color: '#6ea8fe', marginLeft: 4 }}>{m.author?.role}</span>}
                  </div>
                )}
                <div style={{ fontSize: 13, color: '#ddd', lineHeight: 1.5, wordBreak: 'break-word' }}>{m.body}</div>
                <div style={{ fontSize: 9, color: '#444', marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>
                  {new Date(m.created_at).toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #1c1c26', display: 'flex', gap: 8 }}>
        <Input value={input} onChange={setInput} placeholder="Scrivi un messaggio..."
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          style={{ flex: 1, padding: '10px 14px', fontSize: 13 }} />
        <Btn variant="primary" onClick={handleSend} loading={sending} style={{ padding: '10px 14px' }}>↑</Btn>
      </div>
    </div>
  )
}
