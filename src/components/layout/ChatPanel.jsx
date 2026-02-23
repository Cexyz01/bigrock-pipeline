import { useState, useEffect, useRef } from 'react'
import { DEPTS, CHAT_EMOJIS, isStaff } from '../../lib/constants'
import { getChatMessages, sendChatMessage, supabase, subscribeToChatChannel } from '../../lib/supabase'
import Av from '../ui/Av'

export default function ChatPanel({ user, open, onToggle }) {
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
  const [showEmoji, setShowEmoji] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    if (open) getChatMessages(channel).then(setMessages)
  }, [channel, open])

  // #9 Fix: realtime — subscribe properly, append new msg directly
  useEffect(() => {
    const sub = subscribeToChatChannel(channel, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        // Refetch to get full author data
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
    setShowEmoji(false)
  }

  const deptLabel = (ch) => {
    if (ch === 'general') return 'Gen'
    const d = DEPTS.find(dep => dep.id === ch)
    return d ? d.label : ch
  }

  return (
    <>
      {/* Tab handle on right edge — #4 */}
      {!open && (
        <button className="chat-tab-handle" onClick={onToggle}>
          Chat
        </button>
      )}

      {/* Slide-out panel */}
      {open && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
          background: '#fff', borderLeft: '1px solid #E8ECF1',
          display: 'flex', flexDirection: 'column', zIndex: 55,
          animation: 'slideInRight 0.25s ease',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.06)',
        }}>
          {/* Header */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #E8ECF1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#6C5CE7' }}>Chat</span>
            <button onClick={onToggle} style={{ background: '#F1F5F9', border: 'none', color: '#64748B', fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>

          {/* Channel tabs */}
          <div style={{ display: 'flex', gap: 6, padding: '12px 16px', overflowX: 'auto', borderBottom: '1px solid #E8ECF1' }}>
            {channels.map(ch => (
              <button key={ch} onClick={() => setChannel(ch)}
                style={{
                  padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: channel === ch ? 700 : 400,
                  background: channel === ch ? 'rgba(108,92,231,0.08)' : 'transparent',
                  color: channel === ch ? '#6C5CE7' : '#94A3B8',
                  border: `1px solid ${channel === ch ? 'rgba(108,92,231,0.15)' : 'transparent'}`,
                  cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s ease',
                }}
              >{deptLabel(ch)}</button>
            ))}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: 48 }}>Nessun messaggio</div>
            ) : messages.map(m => {
              const isMine = m.author_id === user.id
              return (
                <div key={m.id} style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  flexDirection: isMine ? 'row-reverse' : 'row',
                }}>
                  <Av name={m.author?.full_name} size={26} url={m.author?.avatar_url} mood={m.author?.mood_emoji} />
                  <div style={{
                    maxWidth: '70%', padding: '10px 14px', borderRadius: 20,
                    background: isMine ? 'rgba(108,92,231,0.06)' : '#F8FAFC',
                    border: `1px solid ${isMine ? 'rgba(108,92,231,0.15)' : '#E8ECF1'}`,
                  }}>
                    {!isMine && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748B', marginBottom: 3 }}>
                        {m.author?.full_name}
                        {m.author?.role !== 'studente' && <span style={{ color: '#6C5CE7', marginLeft: 4 }}>{m.author?.role}</span>}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: '#1a1a2e', lineHeight: 1.6, wordBreak: 'break-word' }}>{m.body}</div>
                    <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>
                      {new Date(m.created_at).toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>

          {/* Emoji picker — #10 */}
          {showEmoji && (
            <div style={{
              padding: '10px 18px', borderTop: '1px solid #E8ECF1', background: '#F8FAFC',
            }}>
              <div className="emoji-picker-grid">
                {CHAT_EMOJIS.map(e => (
                  <button key={e} onClick={() => setInput(prev => prev + e)}>{e}</button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '14px 18px', borderTop: '1px solid #E8ECF1', display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setShowEmoji(!showEmoji)}
              style={{
                background: showEmoji ? 'rgba(108,92,231,0.08)' : 'transparent',
                border: 'none', fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 12,
              }}>😊</button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Scrivi un messaggio..."
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              style={{
                flex: 1, padding: '11px 16px', fontSize: 13,
                background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 16,
                color: '#1a1a2e', outline: 'none',
              }}
            />
            <button onClick={handleSend} disabled={sending || !input.trim()}
              style={{
                background: '#6C5CE7',
                border: 'none', borderRadius: 14, padding: '11px 16px',
                color: '#fff', fontWeight: 800, fontSize: 15,
                opacity: sending || !input.trim() ? 0.4 : 1,
                cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              }}>↑</button>
          </div>
        </div>
      )}
    </>
  )
}
