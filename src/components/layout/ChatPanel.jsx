import { useState, useEffect, useRef, useCallback } from 'react'
import { DEPTS, CHAT_EMOJIS, isStaff, displayRole } from '../../lib/constants'
import { getChatMessages, sendChatMessage, supabase, subscribeToChatChannel, getDMConversations, getDMMessages, sendDM, markDMsRead, subscribeToDMs } from '../../lib/supabase'
import Av from '../ui/Av'
import { IconX, IconSmile, IconSend } from '../ui/Icons'

export default function ChatPanel({ user, open, onToggle, profiles, dmUnreadCount = 0, onDmRead, isMobile = false }) {
  const staff = isStaff(user.role)
  const channels = ['general']
  if (staff) {
    DEPTS.forEach(d => channels.push(d.id))
  } else if (user.department) {
    channels.push(user.department)
  }

  // Mode: 'channels' or 'dm'
  const [mode, setMode] = useState('channels')

  // ── Channel state ──
  const [channel, setChannel] = useState('general')
  const [messages, setMessages] = useState([])

  // ── DM state ──
  const [conversations, setConversations] = useState([])
  const [dmPeer, setDmPeer] = useState(null)  // selected user for DM thread
  const [dmMessages, setDmMessages] = useState([])
  const [showNewDM, setShowNewDM] = useState(false)

  // ── Shared state ──
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const openRef = useRef(open)
  const channelRef = useRef(channel)

  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => { channelRef.current = channel }, [channel])

  // ── Channel logic (existing) ──
  const fetchMessages = useCallback((ch) => {
    return getChatMessages(ch || channelRef.current).then(data => {
      setMessages(data)
      return data
    })
  }, [])

  useEffect(() => {
    if (open && mode === 'channels') fetchMessages(channel)
  }, [channel, open, mode, fetchMessages])

  useEffect(() => {
    const sub = subscribeToChatChannel(channel, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) fetchMessages(channel)
    })
    return () => supabase.removeChannel(sub)
  }, [channel, fetchMessages])

  useEffect(() => {
    if (!open || mode !== 'channels') return
    const interval = setInterval(() => fetchMessages(channelRef.current), 5000)
    return () => clearInterval(interval)
  }, [open, mode, fetchMessages])

  // ── DM logic ──
  const fetchConversations = useCallback(() => {
    return getDMConversations(user.id).then(setConversations)
  }, [user.id])

  const fetchDMThread = useCallback((peerId) => {
    return getDMMessages(user.id, peerId).then(data => {
      setDmMessages(data)
      markDMsRead(user.id, peerId).then(() => {
        if (onDmRead) onDmRead()
      })
    })
  }, [user.id, onDmRead])

  // Load conversations when switching to DM mode
  useEffect(() => {
    if (open && mode === 'dm') fetchConversations()
  }, [open, mode, fetchConversations])

  // Load thread when selecting a peer
  useEffect(() => {
    if (open && mode === 'dm' && dmPeer) fetchDMThread(dmPeer.id)
  }, [open, mode, dmPeer, fetchDMThread])

  // Realtime DM subscription
  useEffect(() => {
    const sub = subscribeToDMs(user.id, () => {
      fetchConversations()
      if (dmPeer) fetchDMThread(dmPeer.id)
      else if (onDmRead) onDmRead() // refresh badge when not in a thread
    })
    return () => supabase.removeChannel(sub)
  }, [user.id, dmPeer, fetchConversations, fetchDMThread, onDmRead])

  // DM polling
  useEffect(() => {
    if (!open || mode !== 'dm') return
    const interval = setInterval(() => {
      fetchConversations()
      if (dmPeer) fetchDMThread(dmPeer.id)
    }, 5000)
    return () => clearInterval(interval)
  }, [open, mode, dmPeer, fetchConversations, fetchDMThread])

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, dmMessages])

  // Auto-focus input when chat opens, mode changes, channel changes, or DM thread opens
  useEffect(() => {
    if (open && (mode === 'channels' || (mode === 'dm' && dmPeer))) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, mode, channel, dmPeer])

  // ── Send handlers ──
  const handleSendChannel = async () => {
    if (!input.trim() || sending) return
    const body = input.trim()
    setInput(''); setSending(true); setShowEmoji(false)
    const optimisticMsg = {
      id: `temp-${Date.now()}`, channel, author_id: user.id, body,
      created_at: new Date().toISOString(),
      author: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, role: user.role, mood_emoji: user.mood_emoji },
    }
    setMessages(prev => [...prev, optimisticMsg])
    const { error } = await sendChatMessage(channel, user.id, body)
    setSending(false)
    if (error) setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
  }

  const handleSendDM = async () => {
    if (!input.trim() || sending || !dmPeer) return
    const body = input.trim()
    setInput(''); setSending(true); setShowEmoji(false)
    const optimisticMsg = {
      id: `temp-${Date.now()}`, sender_id: user.id, recipient_id: dmPeer.id, body,
      created_at: new Date().toISOString(),
      sender: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, role: user.role, mood_emoji: user.mood_emoji },
    }
    setDmMessages(prev => [...prev, optimisticMsg])
    const { error } = await sendDM(user.id, dmPeer.id, body)
    setSending(false)
    if (error) setDmMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
    else fetchConversations()
  }

  const handleSend = mode === 'channels' ? handleSendChannel : handleSendDM

  const deptLabel = (ch) => {
    if (ch === 'general') return 'Gen'
    const d = DEPTS.find(dep => dep.id === ch)
    return d ? d.label : ch
  }

  // People available for DM: staff sees students, students see staff
  const dmContacts = (profiles || []).filter(p => {
    if (p.id === user.id) return false
    if (staff) return p.role === 'studente'
    return isStaff(p.role)
  })

  const totalDMUnread = conversations.reduce((s, c) => s + c.unread, 0)

  // ── Message bubble (shared between channel + DM) ──
  const renderMessage = (m, isDM) => {
    const authorId = isDM ? m.sender_id : m.author_id
    const author = isDM ? m.sender : m.author
    const isMine = authorId === user.id
    const isOptimistic = typeof m.id === 'string' && m.id.startsWith('temp-')
    return (
      <div key={m.id} style={{
        display: 'flex', gap: 8, alignItems: 'flex-start',
        flexDirection: isMine ? 'row-reverse' : 'row',
        opacity: isOptimistic ? 0.6 : 1, transition: 'opacity 0.2s ease',
      }}>
        <Av name={author?.full_name} size={26} url={author?.avatar_url} mood={author?.mood_emoji} />
        <div style={{
          maxWidth: '70%', padding: '10px 14px', borderRadius: 20,
          background: isMine ? 'rgba(242,140,40,0.1)' : '#222222',
          border: `1px solid ${isMine ? 'rgba(242,140,40,0.25)' : '#2d2d2d'}`,
        }}>
          {!isMine && !isDM && (
            <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', marginBottom: 3 }}>
              {author?.full_name}
              {author?.role !== 'studente' && <span style={{ color: '#F28C28', marginLeft: 4 }}>{displayRole(author?.role)}</span>}
            </div>
          )}
          <div style={{ fontSize: 13, color: '#E4E4E7', lineHeight: 1.6, wordBreak: 'break-word' }}>{m.body}</div>
          <div style={{ fontSize: 9, color: '#71717a', marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>
            {new Date(m.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: side tab handle / Mobile: FAB */}
      {!isMobile ? (
        <button
          className={`chat-tab-handle${dmUnreadCount > 0 && !open ? ' chat-tab-unread' : ''}`}
          onClick={onToggle}
          style={{ right: open ? 380 : 0 }}
        >
          Chat
        </button>
      ) : !open ? (
        <button
          className="mobile-chat-fab"
          onClick={onToggle}
          style={{
            position: 'fixed', bottom: 64, right: 16, zIndex: 45,
            width: 52, height: 52, borderRadius: 16,
            background: 'linear-gradient(135deg, #F28C28, #F5B862)',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(242,140,40,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {dmUnreadCount > 0 && (
            <span style={{
              position: 'absolute', top: -2, right: -2,
              fontSize: 9, fontWeight: 700, background: '#EF4444', color: '#fff',
              padding: '2px 6px', borderRadius: 8, minWidth: 16, textAlign: 'center',
            }}>{dmUnreadCount}</span>
          )}
        </button>
      ) : null}

      {open && (
        <div style={{
          position: 'fixed',
          ...(isMobile
            ? { inset: 0, width: '100%', borderRadius: 0, animation: 'slideInUp 0.25s ease' }
            : { right: 0, top: 0, bottom: 0, width: 380, animation: 'slideInRight 0.25s ease', borderLeft: '1px solid #2d2d2d' }
          ),
          background: '#1a1a1a',
          display: 'flex', flexDirection: 'column', zIndex: isMobile ? 100 : 55,
          boxShadow: isMobile ? 'none' : '-4px 0 24px rgba(0,0,0,0.3)',
        }}>
          {/* Header */}
          <div style={{ padding: '18px 20px', borderBottom: '1px solid #2d2d2d', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#F28C28' }}>Chat</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s ease infinite' }} title="Live" />
            </div>
            <button onClick={onToggle} style={{ background: '#2d2d2d', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4, borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={18} /></button>
          </div>

          {/* Mode toggle: Canali | DM */}
          <div style={{ display: 'flex', padding: '10px 16px', gap: 6, borderBottom: '1px solid #2d2d2d' }}>
            {['channels', 'dm'].map(m => (
              <button key={m} onClick={() => { setMode(m); setShowEmoji(false); setInput('') }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, fontSize: 12, fontWeight: mode === m ? 700 : 500,
                  background: mode === m ? 'rgba(242,140,40,0.12)' : '#222222',
                  color: mode === m ? '#F28C28' : '#94A3B8',
                  border: `1px solid ${mode === m ? 'rgba(242,140,40,0.25)' : '#2d2d2d'}`,
                  cursor: 'pointer', transition: 'all 0.12s ease', position: 'relative',
                }}>
                {m === 'channels' ? 'Channels' : 'Messages'}
                {m === 'dm' && (dmUnreadCount || totalDMUnread) > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4,
                    fontSize: 9, fontWeight: 700, background: '#EF4444', color: '#fff',
                    padding: '1px 5px', borderRadius: 8, minWidth: 14, textAlign: 'center',
                  }}>{dmUnreadCount || totalDMUnread}</span>
                )}
              </button>
            ))}
          </div>

          {/* ══════════ CHANNELS MODE ══════════ */}
          {mode === 'channels' && (
            <>
              <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid #2d2d2d' }}>
                {channels.map(ch => (
                  <button key={ch} onClick={() => setChannel(ch)}
                    style={{
                      padding: '6px 14px', borderRadius: 16, fontSize: 11, fontWeight: channel === ch ? 700 : 400,
                      background: channel === ch ? 'rgba(242,140,40,0.12)' : 'transparent',
                      color: channel === ch ? '#F28C28' : '#71717a',
                      border: `1px solid ${channel === ch ? 'rgba(242,140,40,0.25)' : 'transparent'}`,
                      cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.12s ease',
                    }}
                  >{deptLabel(ch)}</button>
                ))}
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#71717a', fontSize: 12, padding: 48 }}>No messages</div>
                ) : messages.map(m => renderMessage(m, false))}
                <div ref={endRef} />
              </div>
            </>
          )}

          {/* ══════════ DM MODE ══════════ */}
          {mode === 'dm' && !dmPeer && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* New DM button */}
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #2d2d2d' }}>
                <button onClick={() => setShowNewDM(!showNewDM)}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 12, fontWeight: 600,
                    background: showNewDM ? 'rgba(242,140,40,0.12)' : '#222222',
                    color: '#F28C28', border: '1px solid rgba(242,140,40,0.25)',
                    cursor: 'pointer', transition: 'all 0.12s ease',
                  }}>
                  + New message
                </button>
              </div>

              {/* Contact picker */}
              {showNewDM && (
                <div style={{ padding: '0 16px 12px', borderBottom: '1px solid #2d2d2d' }}>
                  {dmContacts.length === 0 ? (
                    <div style={{ padding: 16, textAlign: 'center', color: '#71717a', fontSize: 12 }}>No contacts available</div>
                  ) : dmContacts.map(p => (
                    <div key={p.id}
                      onClick={() => { setDmPeer(p); setShowNewDM(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                        borderRadius: 10, cursor: 'pointer', transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#2d2d2d'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Av name={p.full_name} size={28} url={p.avatar_url} mood={p.mood_emoji} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#E4E4E7' }}>{p.full_name}</div>
                        <div style={{ fontSize: 10, color: '#71717a' }}>{displayRole(p.role)}{p.department ? ` · ${p.department}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Conversation list */}
              {conversations.length === 0 && !showNewDM ? (
                <div style={{ padding: 48, textAlign: 'center', color: '#71717a', fontSize: 12 }}>
                  No conversations
                </div>
              ) : conversations.map(conv => (
                <div key={conv.user.id}
                  onClick={() => setDmPeer(conv.user)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                    cursor: 'pointer', borderBottom: '1px solid #2d2d2d',
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#222222'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Av name={conv.user.full_name} size={36} url={conv.user.avatar_url} mood={conv.user.mood_emoji} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: conv.unread > 0 ? 700 : 500, color: '#E4E4E7' }}>{conv.user.full_name}</span>
                      <span style={{ fontSize: 10, color: '#71717a' }}>
                        {new Date(conv.lastMessage.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                        {conv.lastMessage.sender_id === user.id ? 'You: ' : ''}{conv.lastMessage.body}
                      </span>
                      {conv.unread > 0 && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, background: '#F28C28', color: '#fff',
                          padding: '1px 6px', borderRadius: 8, minWidth: 16, textAlign: 'center', marginLeft: 8,
                        }}>{conv.unread}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══════════ DM THREAD ══════════ */}
          {mode === 'dm' && dmPeer && (
            <>
              {/* Thread header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #2d2d2d' }}>
                <button onClick={() => { setDmPeer(null); setDmMessages([]) }}
                  style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#71717a', padding: '2px 6px' }}>←</button>
                <Av name={dmPeer.full_name} size={28} url={dmPeer.avatar_url} mood={dmPeer.mood_emoji} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#E4E4E7' }}>{dmPeer.full_name}</div>
                  <div style={{ fontSize: 10, color: '#71717a' }}>{displayRole(dmPeer.role)}</div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {dmMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#71717a', fontSize: 12, padding: 48 }}>Start the conversation</div>
                ) : dmMessages.map(m => renderMessage(m, true))}
                <div ref={endRef} />
              </div>
            </>
          )}

          {/* ══════════ SHARED: Emoji picker + Input ══════════ */}
          {(mode === 'channels' || (mode === 'dm' && dmPeer)) && (
            <>
              {showEmoji && (
                <div style={{ padding: '10px 18px', borderTop: '1px solid #2d2d2d', background: '#222222' }}>
                  <div className="emoji-picker-grid">
                    {CHAT_EMOJIS.map(e => (
                      <button key={e} onClick={() => setInput(prev => prev + e)}>{e}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ padding: '14px 18px', borderTop: '1px solid #2d2d2d', display: 'flex', gap: 10, alignItems: 'center' }}>
                <button onClick={() => setShowEmoji(!showEmoji)}
                  style={{
                    background: showEmoji ? 'rgba(242,140,40,0.12)' : 'transparent',
                    border: 'none', fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 12,
                  }}><IconSmile size={20} color={showEmoji ? '#F28C28' : '#94A3B8'} /></button>
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder={mode === 'dm' ? `Message to ${dmPeer?.full_name}...` : 'Write a message...'}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                  style={{
                    flex: 1, padding: '11px 16px', fontSize: 13,
                    background: '#222222', border: '1px solid #2d2d2d', borderRadius: 16,
                    color: '#E4E4E7', outline: 'none',
                  }}
                />
                <button onClick={handleSend} disabled={sending || !input.trim()}
                  style={{
                    background: '#F28C28',
                    border: 'none', borderRadius: 14, padding: '11px 16px',
                    color: '#fff', fontWeight: 800, fontSize: 15,
                    opacity: sending || !input.trim() ? 0.4 : 1,
                    cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                  }}><IconSend size={18} /></button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
