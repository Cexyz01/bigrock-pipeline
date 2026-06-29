import { useState, useEffect, useRef, useCallback } from 'react'
import { DEPTS, CHAT_EMOJIS, isStaff, displayRole } from '../../lib/constants'
import { getChatMessages, sendChatMessage, supabase, subscribeToChatChannel, getDMConversations, getDMMessages, sendDM, markDMsRead, subscribeToDMs, uploadChatFile } from '../../lib/supabase'
import Av from '../ui/Av'
import { IconX, IconSmile, IconSend, IconDownload } from '../ui/Icons'

const MAX_FILE_BYTES = 100 * 1024 * 1024 // 100MB

function formatBytes(n) {
  if (!n && n !== 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function ChatPanel({ user, open, onToggle, profiles, projectMembers = [], currentProject, dmUnreadCount = 0, onDmRead, isMobile = false }) {
  const staff = isStaff(user)
  const projectId = currentProject?.id || null

  // Per-project department assignment from project_members.project_role.
  // Staff sees every department channel; students see only the channels for
  // the departments they are assigned to in the CURRENT project.
  const myAssignments = projectMembers
    .filter(pm => pm.user_id === user.id && pm.project_role)
    .map(pm => pm.project_role)

  const channels = projectId ? ['general'] : []
  if (projectId) {
    if (staff) {
      DEPTS.forEach(d => channels.push(d.id))
    } else {
      myAssignments.forEach(d => {
        if (DEPTS.find(x => x.id === d) && !channels.includes(d)) channels.push(d)
      })
    }
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
  const [pendingFiles, setPendingFiles] = useState([])   // File[] queued for the next message
  const [attachError, setAttachError] = useState('')      // inline (non-toast) error near composer
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const openRef = useRef(open)
  const channelRef = useRef(channel)

  useEffect(() => { openRef.current = open }, [open])
  useEffect(() => { channelRef.current = channel }, [channel])

  // ── MSN-style "trillo" on new DM ──
  const prevUnreadRef = useRef(dmUnreadCount)
  const audioCtxRef = useRef(null)

  const playNudge = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (!AC) return
        audioCtxRef.current = new AC()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      const now = ctx.currentTime
      // Three quick attention beeps (MSN-ish): high, higher, high
      const tones = [880, 1320, 880]
      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const t0 = now + i * 0.11
        gain.gain.setValueAtTime(0, t0)
        gain.gain.linearRampToValueAtTime(0.2, t0 + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t0)
        osc.stop(t0 + 0.12)
      })
    } catch {}
  }, [])

  const triggerNudge = useCallback(() => {
    playNudge()
    document.body.classList.add('chat-nudge-shake')
    setTimeout(() => document.body.classList.remove('chat-nudge-shake'), 800)
  }, [playNudge])

  // Loud-mode rule: only students with an unread DM from a staff member get
  // the full nagging treatment. Staff users and student-to-student DMs stay
  // visual-only (red wobbling tab, no sound/shake/toast).
  const hasStaffUnread = !staff && conversations.some(c => c.unread > 0 && isStaff(c.user))
  const loud = !staff && hasStaffUnread

  // Make sure conversations are loaded when there's an unread DM, so we can
  // decide whether to nag. Otherwise `loud` would always be false on first paint.
  useEffect(() => {
    if (dmUnreadCount > 0 && conversations.length === 0) {
      getDMConversations(user.id).then(setConversations)
    }
  }, [dmUnreadCount, conversations.length, user.id])

  // Fire on count increase (only in loud mode)
  useEffect(() => {
    if (loud && dmUnreadCount > prevUnreadRef.current) triggerNudge()
    prevUnreadRef.current = dmUnreadCount
  }, [dmUnreadCount, triggerNudge, loud])

  // Re-nudge every 7s while there are unread DMs AND chat is closed AND loud.
  useEffect(() => {
    if (!loud || open || dmUnreadCount === 0) return undefined
    const id = setInterval(triggerNudge, 7000)
    return () => clearInterval(id)
  }, [open, dmUnreadCount, triggerNudge, loud])

  // ── Channel logic (existing) ──
  const fetchMessages = useCallback((ch) => {
    if (!projectId) { setMessages([]); return Promise.resolve([]) }
    return getChatMessages(ch || channelRef.current, projectId).then(data => {
      setMessages(data)
      return data
    })
  }, [projectId])

  // If the active channel disappears (e.g. project switch or assignment change),
  // fall back to 'general' so we never query a stale channel.
  useEffect(() => {
    if (channels.length > 0 && !channels.includes(channel)) {
      setChannel(channels[0])
    }
  }, [channels, channel])

  useEffect(() => {
    if (open && mode === 'channels') fetchMessages(channel)
  }, [channel, open, mode, fetchMessages])

  useEffect(() => {
    if (!projectId) return undefined
    const sub = subscribeToChatChannel(channel, projectId, (payload) => {
      if (payload.eventType === 'INSERT' && payload.new) fetchMessages(channel)
    })
    return () => supabase.removeChannel(sub)
  }, [channel, projectId, fetchMessages])

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

  // ── Attachment handlers ──
  const addFiles = (fileList) => {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    const tooBig = files.filter(f => f.size > MAX_FILE_BYTES)
    const ok = files.filter(f => f.size <= MAX_FILE_BYTES)
    if (tooBig.length) {
      setAttachError(`${tooBig.length === 1 ? 'Il file supera' : 'Alcuni file superano'} il limite di 100MB`)
    } else {
      setAttachError('')
    }
    if (ok.length) setPendingFiles(prev => [...prev, ...ok])
  }

  const handleFileInput = (e) => {
    addFiles(e.target.files)
    e.target.value = '' // allow re-selecting the same file
  }

  const removePendingFile = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx))

  // Upload all queued files to R2 and return the attachments array, or null on
  // failure (r2Upload already retries transient blips internally per
  // feedback_uploads_must_succeed — only a hard failure lands here).
  const uploadPending = async (files) => {
    const results = await Promise.all(files.map(f => uploadChatFile(f).then(r => ({ r, f }))))
    if (results.some(({ r }) => r.error || !r.url)) return null
    return results.map(({ r, f }) => ({
      url: r.url,
      name: f.name,
      type: f.type || 'application/octet-stream',
      size: f.size,
    }))
  }

  // ── Send handlers ──
  const handleSendChannel = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || sending) return
    const body = input.trim()
    const files = pendingFiles
    setInput(''); setPendingFiles([]); setAttachError(''); setSending(true); setShowEmoji(false)
    let attachments = []
    if (files.length) {
      attachments = await uploadPending(files)
      if (!attachments) {
        // Restore the composer so the user can retry; nothing was sent.
        setPendingFiles(files); setInput(body); setSending(false)
        setAttachError('Caricamento file non riuscito, riprova')
        return
      }
    }
    const optimisticMsg = {
      id: `temp-${Date.now()}`, channel, author_id: user.id, body, attachments,
      created_at: new Date().toISOString(),
      author: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, role: user.role, mood_emoji: user.mood_emoji },
    }
    setMessages(prev => [...prev, optimisticMsg])
    const { data, error } = await sendChatMessage(channel, user.id, body, projectId, attachments)
    setSending(false)
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      return
    }
    // Replace optimistic row with the real one returned by Supabase so the
    // message is visible immediately without waiting for realtime/polling.
    if (data) {
      setMessages(prev => {
        if (prev.some(m => m.id === data.id)) {
          return prev.filter(m => m.id !== optimisticMsg.id)
        }
        return prev.map(m => m.id === optimisticMsg.id ? data : m)
      })
    }
  }

  const handleSendDM = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || sending || !dmPeer) return
    const body = input.trim()
    const files = pendingFiles
    setInput(''); setPendingFiles([]); setAttachError(''); setSending(true); setShowEmoji(false)
    let attachments = []
    if (files.length) {
      attachments = await uploadPending(files)
      if (!attachments) {
        setPendingFiles(files); setInput(body); setSending(false)
        setAttachError('Caricamento file non riuscito, riprova')
        return
      }
    }
    const optimisticMsg = {
      id: `temp-${Date.now()}`, sender_id: user.id, recipient_id: dmPeer.id, body, attachments,
      created_at: new Date().toISOString(),
      sender: { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, role: user.role, mood_emoji: user.mood_emoji },
    }
    setDmMessages(prev => [...prev, optimisticMsg])
    const { data, error } = await sendDM(user.id, dmPeer.id, body, attachments)
    setSending(false)
    if (error) {
      setDmMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      return
    }
    // Replace optimistic row with the real one so the sent message stays
    // visible without waiting for realtime/polling (realtime DM sub only
    // fires for the recipient, not the sender).
    if (data) {
      setDmMessages(prev => {
        if (prev.some(m => m.id === data.id)) {
          return prev.filter(m => m.id !== optimisticMsg.id)
        }
        return prev.map(m => m.id === optimisticMsg.id ? data : m)
      })
    }
    fetchConversations()
  }

  const handleSend = mode === 'channels' ? handleSendChannel : handleSendDM

  const deptLabel = (ch) => {
    if (ch === 'general') return 'Gen'
    const d = DEPTS.find(dep => dep.id === ch)
    return d ? d.label : ch
  }

  // People available for DM: staff sees everyone (students + other staff),
  // students see only staff. RLS allows DMs whenever at least one side is staff.
  const dmContacts = (profiles || []).filter(p => {
    if (p.id === user.id) return false
    if (staff) return true
    return isStaff(p)
  })

  const totalDMUnread = conversations.reduce((s, c) => s + c.unread, 0)

  // Format timestamp with relative date prefix when the message is not from today.
  // Today → "03:21 PM"; yesterday → "Ieri 03:21 PM"; within 7 days → "lun 03:21 PM";
  // older → "21/05 03:21 PM"; different year → "21/05/25 03:21 PM".
  const formatMsgTime = (iso) => {
    const d = new Date(iso)
    const time = d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
    const now = new Date()
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000)
    if (diffDays <= 0) return time
    if (diffDays === 1) return `Ieri ${time}`
    if (diffDays < 7) {
      const wd = d.toLocaleDateString('it', { weekday: 'short' }).replace('.', '')
      return `${wd} ${time}`
    }
    if (d.getFullYear() === now.getFullYear()) {
      return `${d.toLocaleDateString('it', { day: '2-digit', month: '2-digit' })} ${time}`
    }
    return `${d.toLocaleDateString('it', { day: '2-digit', month: '2-digit', year: '2-digit' })} ${time}`
  }

  // ── Single attachment renderer: image preview, else downloadable chip ──
  const renderAttachment = (a, i) => {
    if (!a || !a.url) return null
    const isImage = (a.type || '').startsWith('image/')
    if (isImage) {
      return (
        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
          <img
            src={a.url}
            alt={a.name || 'immagine'}
            style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 12, display: 'block', objectFit: 'cover' }}
          />
        </a>
      )
    }
    return (
      <a
        key={i}
        href={a.url}
        target="_blank"
        rel="noopener noreferrer"
        download={a.name || true}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          background: 'rgba(0,0,0,0.25)', border: '1px solid #3a3a3a', borderRadius: 10,
          textDecoration: 'none', maxWidth: 240,
        }}
      >
        <span style={{
          flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'rgba(242,140,40,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconDownload size={15} color="#F28C28" />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 12, color: '#E4E4E7', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {a.name || 'file'}
          </span>
          {a.size ? <span style={{ display: 'block', fontSize: 10, color: '#71717a' }}>{formatBytes(a.size)}</span> : null}
        </span>
      </a>
    )
  }

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
          {m.body && <div style={{ fontSize: 13, color: '#E4E4E7', lineHeight: 1.6, wordBreak: 'break-word' }}>{m.body}</div>}
          {Array.isArray(m.attachments) && m.attachments.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: m.body ? 8 : 0 }}>
              {m.attachments.map((a, i) => renderAttachment(a, i))}
            </div>
          )}
          <div style={{ fontSize: 9, color: '#71717a', marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>
            {formatMsgTime(m.created_at)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: side tab handle / Mobile: FAB */}
      {!isMobile ? (
        <>
          <button
            className={`chat-tab-handle${dmUnreadCount > 0 && !open ? ' chat-tab-unread' : ''}`}
            onClick={onToggle}
            style={{ right: open ? 380 : 0 }}
          >
            Chat
            {dmUnreadCount > 0 && !open && (
              <span className="chat-tab-badge">{dmUnreadCount > 99 ? '99+' : dmUnreadCount}</span>
            )}
          </button>
          {loud && dmUnreadCount > 0 && !open && (
            <button
              className="chat-nag-toast"
              onClick={onToggle}
              title="Apri chat"
            >
              <span className="chat-nag-toast-emoji">📬</span>
              <span className="chat-nag-toast-text">
                <strong>{dmUnreadCount} nuov{dmUnreadCount === 1 ? 'o messaggio' : 'i messaggi'} dallo staff</strong>
                <span className="chat-nag-toast-sub">clicca per leggere</span>
              </span>
            </button>
          )}
        </>
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
              <button key={m} onClick={() => { setMode(m); setShowEmoji(false); setInput(''); setPendingFiles([]); setAttachError('') }}
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
                {!projectId ? (
                  <div style={{ textAlign: 'center', color: '#71717a', fontSize: 12, padding: 48 }}>Seleziona un progetto per usare la chat</div>
                ) : channels.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#71717a', fontSize: 12, padding: 48 }}>Non sei assegnato a nessun reparto in questo progetto</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#71717a', fontSize: 12, padding: 48 }}>Nessun messaggio</div>
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
                        {formatMsgTime(conv.lastMessage.created_at)}
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

              {/* Pending attachments + inline error */}
              {(pendingFiles.length > 0 || attachError) && (
                <div style={{ padding: '10px 18px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pendingFiles.map((f, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                      background: '#222222', border: '1px solid #2d2d2d', borderRadius: 10,
                    }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12, color: '#E4E4E7', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                        <span style={{ display: 'block', fontSize: 10, color: '#71717a' }}>{formatBytes(f.size)}</span>
                      </span>
                      <button onClick={() => removePendingFile(i)} disabled={sending}
                        style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: sending ? 'not-allowed' : 'pointer', padding: 2, display: 'flex' }}>
                        <IconX size={14} />
                      </button>
                    </div>
                  ))}
                  {attachError && <div style={{ fontSize: 11, color: '#EF4444' }}>{attachError}</div>}
                </div>
              )}

              <div style={{ padding: '14px 18px', borderTop: '1px solid #2d2d2d', display: 'flex', gap: 10, alignItems: 'center' }}>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} style={{ display: 'none' }} />
                <button onClick={() => setShowEmoji(!showEmoji)}
                  style={{
                    background: showEmoji ? 'rgba(242,140,40,0.12)' : 'transparent',
                    border: 'none', fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 12,
                  }}><IconSmile size={20} color={showEmoji ? '#F28C28' : '#94A3B8'} /></button>
                <button onClick={() => fileInputRef.current?.click()} disabled={sending} title="Allega file (max 100MB)"
                  style={{
                    background: 'transparent', border: 'none', cursor: sending ? 'not-allowed' : 'pointer',
                    padding: 4, borderRadius: 12, display: 'flex', opacity: sending ? 0.4 : 1,
                  }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
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
                <button onClick={handleSend} disabled={sending || (!input.trim() && pendingFiles.length === 0)}
                  style={{
                    background: '#F28C28',
                    border: 'none', borderRadius: 14, padding: '11px 16px',
                    color: '#fff', fontWeight: 800, fontSize: 15,
                    opacity: sending || (!input.trim() && pendingFiles.length === 0) ? 0.4 : 1,
                    cursor: sending || (!input.trim() && pendingFiles.length === 0) ? 'not-allowed' : 'pointer',
                  }}><IconSend size={18} /></button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
