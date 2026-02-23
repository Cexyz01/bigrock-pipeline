import { useState, useEffect, useRef, useCallback } from 'react'
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
  const openRef = useRef(open)
  const channelRef = useRef(channel)

  // Keep refs in sync
  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => { channelRef.current = channel }, [channel])

  // Fetch messages helper
  const fetchMessages = useCallback((ch) => {
    return getChatMessages(ch || channelRef.current).then(data => {
      setMessages(data)
      return data
    })
  }, [])

  // Load messages when channel changes or panel opens
  useEffect(() => {
    if (open) fetchMessages(channel)
  }, [channel, open, fetchMessages])

  // Realtime subscription — always active, re-subscribes on channel change
  useEffect(() => {
    const sub = subscribeToChatChannel(channel, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        // Refetch to get full author data (join)
        fetchMessages(channel)
      }
    })
    return () => supabase.removeChannel(sub)
  }, [channel, fetchMessages])

  // Polling fallback — every 5 seconds when panel is open
  // This ensures messages appear even if Realtime has issues
  useEffect(() => {
    if (!open) return
    const interval = setInterval(() => {
      fetchMessages(channelRef.current)
    }, 5000)
    return () => clearInterval(interval)
  }, [open, fetchMessages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    const body = input.trim()
    setInput('')
    setSending(true)
    setShowEmoji(false)

    // Optimistic: add message immediately so sender sees it right away
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      channel,
      author_id: user.id,
      body,
      created_at: new Date().toISOString(),
      author: {
        id: user.id,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        role: user.role,
        mood_emoji: user.mood_emoji,
      },
    }
    setMessages(prev => [...prev, optimisticMsg])

    const { error } = await sendChatMessage(channel, user.id, body)
    setSending(false)

    if (error) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
    }
    // On success, the realtime subscription or polling will refetch with real data
  }

  const deptLabel = (ch) => {
    if (ch === 'general') return 'Gen'
    const d = DEPTS.find(dep => dep.id === ch)
    return d ? d.label : ch
  }

  return (
    <>
      {/* Tab handle — always visible, moves with panel */}
      <button
        className="chat-tab-handle"
        onClick={onToggle}
        style={{ right: open ? 380 : 0 }}
      >
        Chat
      </button>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#6C5CE7' }}>Chat</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s ease infinite' }} title="Live" />
            </div>
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
              const isOptimistic = typeof m.id === 'string' && m.id.startsWith('temp-')
              return (
                <div key={m.id} style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  flexDirection: isMine ? 'row-reverse' : 'row',
                  opacity: isOptimistic ? 0.6 : 1,
                  transition: 'opacity 0.2s ease',
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

          {/* Emoji picker */}
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
