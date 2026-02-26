import { useState, useEffect, useRef, useCallback } from 'react'

const C = {
  bg: '#0D1117',
  header: '#161B22',
  border: '#30363D',
  text: '#C9D1D9',
  dim: '#8B949E',
  cmd: '#79C0FF',
  result: '#56D364',
  error: '#F85149',
  info: '#8B949E',
  prompt: '#56D364',
  input: '#E6EDF3',
}

const FONT = "'Cascadia Code', 'Fira Code', 'Consolas', 'Courier New', monospace"

export default function DevConsole({ open, onClose, sendCommand, profiles, addToast }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState([
    { text: 'DevConsole v1.0 — scrivi "help" per i comandi', type: 'info' },
  ])
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [position, setPosition] = useState({ x: window.innerWidth - 540, y: 80 })
  const [dragging, setDragging] = useState(false)
  const [matrixOn, setMatrixOn] = useState(false)

  const inputRef = useRef(null)
  const outputRef = useRef(null)
  const dragStart = useRef(null)

  // Auto-focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output])

  // Drag logic
  const handleDragStart = (e) => {
    dragStart.current = {
      startX: e.clientX - position.x,
      startY: e.clientY - position.y,
    }
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      setPosition({
        x: e.clientX - dragStart.current.startX,
        y: e.clientY - dragStart.current.startY,
      })
    }
    const handleUp = () => setDragging(false)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragging])

  const addLine = useCallback((text, type = 'info') => {
    setOutput(prev => [...prev, { text, type }])
  }, [])

  const executeCommand = useCallback((raw) => {
    const trimmed = raw.trim()
    if (!trimmed) return

    setHistory(prev => [trimmed, ...prev])
    setHistoryIndex(-1)
    addLine(`> ${trimmed}`, 'cmd')

    const parts = trimmed.split(/\s+/)
    const cmd = parts[0].toLowerCase()

    switch (cmd) {
      case 'help':
        addLine('Comandi disponibili:', 'info')
        addLine('  broadcast <msg>        Invia messaggio overlay a tutti', 'info')
        addLine('  matrix                 Toggle modalita Matrix', 'info')
        addLine('  ban <nome.cognome> <s> Finto ban per N secondi', 'info')
        addLine('  clear                  Pulisci console', 'info')
        addLine('  help                   Mostra questo aiuto', 'info')
        break

      case 'clear':
        setOutput([])
        break

      case 'broadcast': {
        const message = parts.slice(1).join(' ')
        if (!message) {
          addLine('Errore: broadcast <messaggio>', 'error')
          break
        }
        sendCommand('broadcast_message', { message })
        addLine(`Broadcast inviato: "${message}"`, 'result')
        break
      }

      case 'matrix': {
        const newState = !matrixOn
        setMatrixOn(newState)
        sendCommand('matrix_toggle', {})
        addLine(`Matrix mode ${newState ? 'ATTIVATO' : 'DISATTIVATO'}`, 'result')
        break
      }

      case 'ban': {
        const target = parts[1]
        const seconds = parseInt(parts[2], 10)
        if (!target || !seconds || isNaN(seconds)) {
          addLine('Errore: ban <nome.cognome> <secondi>', 'error')
          break
        }
        const match = profiles.find(p =>
          p.email?.split('@')[0]?.toLowerCase() === target.toLowerCase() ||
          p.full_name?.toLowerCase().replace(/\s+/g, '.') === target.toLowerCase()
        )
        if (!match) {
          addLine(`Utente "${target}" non trovato`, 'error')
          const suggestions = profiles
            .filter(p => {
              const prefix = p.email?.split('@')[0]?.toLowerCase() || ''
              const name = p.full_name?.toLowerCase().replace(/\s+/g, '.') || ''
              return prefix.includes(target.toLowerCase()) || name.includes(target.toLowerCase())
            })
            .slice(0, 3)
          if (suggestions.length) {
            addLine('Forse intendevi:', 'info')
            suggestions.forEach(s =>
              addLine(`  ${s.email?.split('@')[0]} (${s.full_name})`, 'info')
            )
          }
          break
        }
        sendCommand('ban_user', { target: match.full_name, email: match.email, seconds })
        addLine(`${match.full_name} bannato per ${seconds}s`, 'result')
        break
      }

      default:
        addLine(`Comando sconosciuto: "${cmd}". Scrivi "help"`, 'error')
    }
  }, [addLine, sendCommand, profiles, matrixOn])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeCommand(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHistoryIndex(prev => {
        const next = Math.min(prev + 1, history.length - 1)
        if (next >= 0) setInput(history[next])
        return next
      })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHistoryIndex(prev => {
        const next = Math.max(prev - 1, -1)
        setInput(next === -1 ? '' : history[next])
        return next
      })
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const lineColor = (type) => {
    switch (type) {
      case 'cmd': return C.cmd
      case 'result': return C.result
      case 'error': return C.error
      default: return C.dim
    }
  }

  if (!open) return null

  return (
    <div style={{
      position: 'fixed',
      left: position.x,
      top: position.y,
      width: 500,
      height: 350,
      zIndex: 300,
      background: C.bg,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
      fontFamily: FONT,
      fontSize: 12,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      animation: 'scaleIn 0.2s ease',
      resize: 'both',
    }}>
      {/* Title bar */}
      <div
        onMouseDown={handleDragStart}
        style={{
          height: 36,
          background: C.header,
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          cursor: dragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          gap: 8,
        }}
      >
        {/* macOS dots */}
        <div style={{ display: 'flex', gap: 6 }}>
          <div
            onClick={onClose}
            style={{
              width: 12, height: 12, borderRadius: '50%',
              background: '#FF5F56', cursor: 'pointer',
            }}
          />
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: '#FFBD2E',
          }} />
          <div style={{
            width: 12, height: 12, borderRadius: '50%',
            background: '#27C93F',
          }} />
        </div>
        <div style={{
          flex: 1, textAlign: 'center',
          fontSize: 11, fontWeight: 600, color: C.dim,
          letterSpacing: 0.5,
        }}>
          Admin Console
        </div>
        <div style={{ width: 54 }} />
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="dev-console-output"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          lineHeight: 1.7,
        }}
      >
        {output.map((line, i) => (
          <div key={i} style={{
            color: lineColor(line.type),
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {line.text}
          </div>
        ))}
      </div>

      {/* Input area */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 14px',
        borderTop: `1px solid ${C.border}`,
        gap: 8,
      }}>
        <span style={{ color: C.prompt, fontWeight: 700, fontSize: 14 }}>&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="scrivi un comando..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: C.input,
            fontFamily: FONT,
            fontSize: 12,
            lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  )
}
