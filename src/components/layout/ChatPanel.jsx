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
    if (ch === 'general') return '💬 Gen'
    const d = DEPTS.find(dep => dep.id === ch)
    return d ? `${d.icon}` : ch
  }

  return (
    <>
      {/* Tab handle on right edge — #4 */}
      {!open && (
        <button className="chat-tab-handle" onClick={onToggle}>
          💬 Chat
        </button>
      )}

      {/* Slide-out panel */}
      {open && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
          background: '#0e0e18', borderLeft: '1px solid #1a1a28',
          display: 'flex', flexDirection: 'column', zIndex: 55,
          animation: 'slideInRight 0.25s ease',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
        }}>
          {/* Header */}
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #1a1a28', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#a78bfa' }}>💬 Chat</span>
            <button onClick={onToggle} style={{ background: 'none', border: 'none', color: '#777', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>

          {/* Channel tabs */}
          <div style={{ display: 'flex', gap: 4, padding: '10px 12px', overflowX: 'auto', borderBottom: '1px solid #1a1a28' }}>
            {channels.map(ch => (
              <button key={ch} onClick={() => setChannel(ch)}
                style={{
                  padding: '5px 12px', borderRadius: 10, fontSize: 11, fontWeight: channel === ch ? 600 : 400,
                  background: channel === ch ? 'rgba(124,92,252,0.15)' : 'transparent',
                  color: channel === ch ? '#a78bfa' : '#777',
                  border: `1px solid ${channel === ch ? 'rgba(124,92,252,0.3)' : 'transparent'}`,
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
                    maxWidth: '70%', padding: '8px 12px', borderRadius: 14,
                    background: isMine ? 'rgba(124,92,252,0.15)' : '#161622',
                    border: `1px solid ${isMine ? 'rgba(124,92,252,0.25)' : '#1e1e2e'}`,
                  }}>
                    {!isMine && (
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 2 }}>
                        {m.author?.full_name}
                        {m.author?.role !== 'studente' && <span style={{ color: '#a78bfa', marginLeft: 4 }}>{m.author?.role}</span>}
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

          {/* Emoji picker — #10 */}
          {showEmoji && (
            <div style={{
              padding: '8px 14px', borderTop: '1px solid #1a1a28', background: '#12121c',
            }}>
              <div className="emoji-picker-grid">
                {CHAT_EMOJIS.map(e => (
                  <button key={e} onClick={() => setInput(prev => prev + e)}>{e}</button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #1a1a28', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowEmoji(!showEmoji)}
              style={{
                background: showEmoji ? 'rgba(124,92,252,0.15)' : 'transparent',
                border: 'none', fontSize: 18, cursor: 'pointer', padding: 4, borderRadius: 8,
              }}>😊</button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Scrivi un messaggio..."
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
              style={{
                flex: 1, padding: '10px 14px', fontSize: 13,
                background: '#161622', border: '1px solid #2a2a3a', borderRadius: 12,
                color: '#e8e8f0', outline: 'none',
              }}
            />
            <button onClick={handleSend} disabled={sending || !input.trim()}
              style={{
                background: 'linear-gradient(135deg, #7c5cfc, #a78bfa)',
                border: 'none', borderRadius: 10, padding: '10px 14px',
                color: '#fff', fontWeight: 700, fontSize: 14,
                opacity: sending || !input.trim() ? 0.4 : 1,
                cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              }}>↑</button>
          </div>
        </div>
      )}
    </>
  )
}
