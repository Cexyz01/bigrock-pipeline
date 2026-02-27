import { useState, useRef, useEffect } from 'react';
import { IconX } from '../ui/Icons'

/* ── Command definitions ── */
const CMDS = [
  { id: 'say',    icon: '📢', label: 'Say',    needsMsg: true,  needsDur: true,  needsTarget: true,  defDur: 5  },
  { id: 'ban',    icon: '🔨', label: 'Ban',    needsMsg: false, needsDur: true,  needsTarget: 'required', defDur: 10 },
  { id: 'shake',  icon: '🫨', label: 'Shake',  needsMsg: false, needsDur: true,  needsTarget: true,  defDur: 3  },
  { id: 'disco',  icon: '🪩', label: 'Disco',  needsMsg: false, needsDur: true,  needsTarget: true,  defDur: 5  },
  { id: 'flip',   icon: '🙃', label: 'Flip',   needsMsg: false, needsDur: true,  needsTarget: true,  defDur: 5  },
  { id: 'matrix', icon: '🟢', label: 'Matrix', needsMsg: false, needsDur: false, needsTarget: false, defDur: 0  },
];
const DURATIONS = [3, 5, 10, 15, 30];

const HELP = [
  ['help',              'Mostra tutti i comandi'],
  ['say <msg> [sec]',   'Messaggio a tutti (default 5s)'],
  ['sayto <nome> <msg> [sec]','Messaggio a un utente (default 5s)'],
  ['matrix',            'Attiva/disattiva Matrix mode'],
  ['ban <nome> <sec>',  'Ban scherzoso temporaneo a un utente'],
  ['shake [nome] [sec]','Scuoti schermo (tutti o persona)'],
  ['disco [nome] [sec]','Disco mode (tutti o persona)'],
  ['flip [nome] [sec]', 'Capovolgi schermo (tutti o persona)'],
  ['users',             'Lista utenti registrati'],
  ['whoami',            'Mostra info admin corrente'],
  ['clear',             'Pulisci la console'],
];

export default function AdminConsole({ user, profiles, channelRef, onMatrixToggle, onClose, isMobile: isMobileProp }) {
  // Internal mobile detection as failsafe (prop may miss on some devices)
  const [internalMobile, setInternalMobile] = useState(
    () => typeof window !== 'undefined' && (window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 900))
  );
  useEffect(() => {
    const check = () => setInternalMobile(window.innerWidth < 768 || ('ontouchstart' in window && window.innerWidth < 900));
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  const isMobile = isMobileProp || internalMobile;

  // ── shared state ──
  const [log, setLog] = useState([]);
  const addLog = (text, c = '#00ff41') => setLog(p => [...p, { text, c }]);

  const broadcast = (payload) => {
    channelRef.current?.send({ type: 'broadcast', event: 'admin-fx', payload });
  };

  const findUser = (query) => {
    const q = query.toLowerCase().replace(/\./g, ' ');
    return profiles.find(p => {
      const name = (p.full_name || '').toLowerCase();
      const email = (p.email || '').split('@')[0].replace(/\./g, ' ').toLowerCase();
      return name === q || email === q;
    }) || profiles.find(p => {
      const name = (p.full_name || '').toLowerCase();
      const email = (p.email || '').split('@')[0].replace(/\./g, ' ').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  };

  // ══════════════════════════════════════════════
  //  MOBILE UI
  // ══════════════════════════════════════════════
  const [selCmd, setSelCmd] = useState(null);
  const [selTarget, setSelTarget] = useState(null); // null = tutti
  const [selDur, setSelDur] = useState(5);
  const [msg, setMsg] = useState('');
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  // auto-set default duration when command changes
  useEffect(() => {
    const cmd = CMDS.find(c => c.id === selCmd);
    if (cmd) setSelDur(cmd.defDur);
  }, [selCmd]);

  const execMobile = () => {
    const cmd = CMDS.find(c => c.id === selCmd);
    if (!cmd) return;

    // matrix is a toggle, no target/duration
    if (cmd.id === 'matrix') {
      onMatrixToggle();
      setLastResult({ text: 'Matrix mode toggled!', c: '#00ff41' });
      return;
    }

    // ban requires a target
    if (cmd.needsTarget === 'required' && !selTarget) {
      setLastResult({ text: 'Seleziona un utente!', c: '#ff5555' });
      return;
    }

    // say needs a message
    if (cmd.needsMsg && !msg.trim()) {
      setLastResult({ text: 'Scrivi un messaggio!', c: '#ff5555' });
      return;
    }

    const targetId = selTarget?.id || null;
    const targetName = selTarget?.full_name || null;
    const dur = selDur;

    switch (cmd.id) {
      case 'say': {
        const payload = { type: 'broadcast', message: msg.trim(), sender: user.full_name, duration: dur * 1000 };
        if (targetId) payload.targetId = targetId;
        broadcast(payload);
        setLastResult({ text: `📢 "${msg.trim()}" → ${targetName || 'Tutti'} (${dur}s)`, c: '#ffd700' });
        setMsg('');
        break;
      }
      case 'ban': {
        if (selTarget?.id === user.id) { setLastResult({ text: 'Non puoi bannarti 🤦', c: '#ff5555' }); return; }
        broadcast({ type: 'ban', targetId, targetName, duration: dur });
        setLastResult({ text: `🔨 ${targetName} bannato per ${dur}s`, c: '#ff5555' });
        break;
      }
      case 'shake': {
        const payload = { type: 'shake', duration: dur * 1000 };
        if (targetId) payload.targetId = targetId;
        broadcast(payload);
        setLastResult({ text: `🫨 Shake → ${targetName || 'Tutti'} (${dur}s)`, c: '#ffd700' });
        break;
      }
      case 'disco': {
        const payload = { type: 'disco', duration: dur * 1000 };
        if (targetId) payload.targetId = targetId;
        broadcast(payload);
        setLastResult({ text: `🪩 Disco → ${targetName || 'Tutti'} (${dur}s)`, c: '#ff69b4' });
        break;
      }
      case 'flip': {
        const payload = { type: 'flip', duration: dur * 1000 };
        if (targetId) payload.targetId = targetId;
        broadcast(payload);
        setLastResult({ text: `🙃 Flip → ${targetName || 'Tutti'} (${dur}s)`, c: '#ffd700' });
        break;
      }
    }
  };

  if (isMobile) {
    const cmd = CMDS.find(c => c.id === selCmd);
    const S = { // shared styles
      section: { padding: '12px 16px', borderBottom: '1px solid rgba(0,255,65,0.1)' },
      label: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: '#00ff41', textTransform: 'uppercase', marginBottom: 8, opacity: 0.6 },
      chip: (active) => ({
        padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
        border: active ? '1.5px solid #00ff41' : '1.5px solid rgba(255,255,255,0.1)',
        background: active ? 'rgba(0,255,65,0.15)' : 'rgba(255,255,255,0.04)',
        color: active ? '#00ff41' : '#888', cursor: 'pointer',
        transition: 'all 0.15s ease',
      }),
    };

    return (
      <div data-admin-console style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,14,20,0.98)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        animation: 'slideInUp 0.25s ease',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* header */}
        <div style={{
          padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,255,65,0.2)',
        }}>
          <span style={{ color: '#00ff41', fontWeight: 800, fontSize: 15, letterSpacing: 1 }}>ADMIN CONSOLE</span>
          <div onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10, background: 'rgba(255,85,87,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#ff5f57', fontSize: 16, fontWeight: 700, cursor: 'pointer',
          }}><IconX size={16} /></div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
          {/* command grid */}
          <div style={S.section}>
            <div style={S.label}>Comando</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {CMDS.map(c => (
                <div key={c.id} onClick={() => setSelCmd(c.id)} style={{
                  ...S.chip(selCmd === c.id),
                  padding: '14px 8px', textAlign: 'center', borderRadius: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <span style={{ fontSize: 22 }}>{c.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* target picker */}
          {cmd && cmd.needsTarget && (
            <div style={S.section}>
              <div style={S.label}>Destinatario</div>
              <div onClick={() => setShowTargetPicker(!showTargetPicker)} style={{
                ...S.chip(false),
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 12, width: '100%',
              }}>
                <span style={{ color: selTarget ? '#fff' : '#00ff41', fontWeight: 600 }}>
                  {selTarget ? `${selTarget.full_name}` : cmd.needsTarget === 'required' ? 'Scegli utente...' : '👥 Tutti'}
                </span>
                <span style={{ color: '#555', fontSize: 11 }}>▼</span>
              </div>

              {showTargetPicker && (
                <div style={{
                  marginTop: 8, maxHeight: 200, overflowY: 'auto', borderRadius: 12,
                  border: '1px solid rgba(0,255,65,0.15)', background: 'rgba(0,0,0,0.5)',
                }}>
                  {cmd.needsTarget !== 'required' && (
                    <div onClick={() => { setSelTarget(null); setShowTargetPicker(false); }} style={{
                      padding: '10px 14px', cursor: 'pointer', color: '#00ff41', fontWeight: 600,
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      background: !selTarget ? 'rgba(0,255,65,0.1)' : 'transparent',
                    }}>
                      👥 Tutti
                    </div>
                  )}
                  {profiles.filter(p => p.id !== user.id).map(p => (
                    <div key={p.id} onClick={() => { setSelTarget(p); setShowTargetPicker(false); }} style={{
                      padding: '10px 14px', cursor: 'pointer',
                      color: selTarget?.id === p.id ? '#00ff41' : '#ccc',
                      background: selTarget?.id === p.id ? 'rgba(0,255,65,0.1)' : 'transparent',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      fontSize: 13,
                    }}>
                      {p.full_name || p.email}
                      <span style={{ color: '#555', fontSize: 10, marginLeft: 8 }}>{p.role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* duration */}
          {cmd && cmd.needsDur && (
            <div style={S.section}>
              <div style={S.label}>Durata (secondi)</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {DURATIONS.map(d => (
                  <div key={d} onClick={() => setSelDur(d)} style={{
                    ...S.chip(selDur === d), minWidth: 44, textAlign: 'center',
                  }}>
                    {d}s
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* message input */}
          {cmd && cmd.needsMsg && (
            <div style={S.section}>
              <div style={S.label}>Messaggio</div>
              <input
                value={msg}
                onChange={e => setMsg(e.target.value)}
                placeholder="Scrivi il messaggio..."
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14,
                  background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(0,255,65,0.15)',
                  color: '#fff', outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
          )}

          {/* execute */}
          {selCmd && (
            <div style={{ padding: '16px 16px 8px' }}>
              <div onClick={execMobile} style={{
                width: '100%', padding: '14px 0', borderRadius: 14, textAlign: 'center',
                background: 'linear-gradient(135deg, #00ff41 0%, #00cc33 100%)',
                color: '#0a0e14', fontSize: 15, fontWeight: 800, letterSpacing: 1,
                cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,255,65,0.3)',
              }}>
                ▶ ESEGUI
              </div>
            </div>
          )}

          {/* result feedback */}
          {lastResult && (
            <div style={{
              margin: '8px 16px', padding: '10px 14px', borderRadius: 10,
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,255,65,0.1)',
              color: lastResult.c, fontSize: 13, fontWeight: 600,
              fontFamily: '"Courier New", monospace',
            }}>
              {lastResult.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  //  DESKTOP TERMINAL UI (unchanged logic)
  // ══════════════════════════════════════════════
  const [output, setOutput] = useState([
    { text: '  ____  _       ____            _    ', c: '#00ff41' },
    { text: ' | __ )(_) __ _|  _ \\ ___   ___| | __', c: '#00ff41' },
    { text: " |  _ \\| |/ _` | |_) / _ \\ / __| |/ /", c: '#00ff41' },
    { text: ' | |_) | | (_| |  _ < (_) | (__|   < ', c: '#00ff41' },
    { text: ' |____/|_|\\__, |_| \\_\\___/ \\___|_|\\_\\', c: '#00ff41' },
    { text: '          |___/   ADMIN CONSOLE v1.0', c: '#F28C28' },
    { text: '', c: '#888' },
    { text: ' Digita "help" per la lista comandi.', c: '#666' },
    { text: '', c: '#888' },
  ]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const termWidth = Math.min(540, window.innerWidth - 32);
  const [pos, setPos] = useState({ x: 90, y: Math.max(100, window.innerHeight - 420) });
  const [dragging, setDragging] = useState(false);
  const dragOff = useRef({ x: 0, y: 0 });
  const outRef = useRef(null);
  const inRef = useRef(null);

  useEffect(() => { if (outRef.current) outRef.current.scrollTop = outRef.current.scrollHeight; }, [output]);
  useEffect(() => { inRef.current?.focus(); }, []);

  const onDragStart = (e) => { setDragging(true); dragOff.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; };
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => setPos({ x: Math.max(0, Math.min(window.innerWidth - termWidth, e.clientX - dragOff.current.x)), y: Math.max(0, Math.min(window.innerHeight - 80, e.clientY - dragOff.current.y)) });
    const up = () => setDragging(false);
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [dragging]);

  const dlog = (text, c = '#00ff41') => setOutput(p => [...p, { text, c }]);

  const exec = (raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    dlog(`> ${trimmed}`, '#F28C28');
    setHistory(p => [trimmed, ...p.slice(0, 49)]); setHistIdx(-1);
    const [cmd, ...args] = trimmed.split(/\s+/);

    switch (cmd.toLowerCase()) {
      case 'help': {
        dlog('');
        dlog('  ╔══════════════════════════════════════════════════╗', '#00ff41');
        dlog('  ║            COMANDI DISPONIBILI                   ║', '#00ff41');
        dlog('  ╠══════════════════════════════════════════════════╣', '#00ff41');
        HELP.forEach(([c, d]) => dlog(`  ║  ${c.padEnd(22)}${d.padEnd(28)}║`, '#00ff41'));
        dlog('  ╚══════════════════════════════════════════════════╝', '#00ff41');
        dlog(''); break;
      }
      case 'say': case 'broadcast': {
        if (!args.length) { dlog('  Uso: say <messaggio> [secondi]', '#ff5555'); break; }
        const lastNum = parseInt(args[args.length - 1]);
        const hasDur = args.length >= 2 && !isNaN(lastNum) && lastNum > 0;
        const dur = hasDur ? Math.min(lastNum, 30) * 1000 : 5000;
        const m = hasDur ? args.slice(0, -1).join(' ') : args.join(' ');
        if (!m) { dlog('  Manca il messaggio!', '#ff5555'); break; }
        broadcast({ type: 'broadcast', message: m, sender: user.full_name, duration: dur });
        dlog(`  📢 Broadcast: "${m}" (${dur / 1000}s)`, '#ffd700'); break;
      }
      case 'sayto': {
        if (args.length < 2) { dlog('  Uso: sayto <nome> <messaggio> [secondi]', '#ff5555'); break; }
        let target = null; let ms = 1;
        for (let i = 1; i <= Math.min(args.length - 1, 3); i++) { const found = findUser(args.slice(0, i).join(' ')); if (found) { target = found; ms = i; break; } }
        if (!target) { dlog(`  Utente "${args[0]}" non trovato`, '#ff5555'); break; }
        const rest = args.slice(ms);
        const lastNum = parseInt(rest[rest.length - 1]);
        const hasDur = rest.length >= 2 && !isNaN(lastNum) && lastNum > 0;
        const dur = hasDur ? Math.min(lastNum, 30) * 1000 : 5000;
        const m = hasDur ? rest.slice(0, -1).join(' ') : rest.join(' ');
        if (!m) { dlog('  Manca il messaggio!', '#ff5555'); break; }
        broadcast({ type: 'broadcast', targetId: target.id, message: m, sender: user.full_name, duration: dur });
        dlog(`  📢 → ${target.full_name}: "${m}" (${dur / 1000}s)`, '#ffd700'); break;
      }
      case 'matrix': { onMatrixToggle(); dlog('  🟢 Matrix mode toggled!', '#00ff41'); break; }
      case 'ban': {
        if (args.length < 2) { dlog('  Uso: ban <nome> <secondi>', '#ff5555'); break; }
        const secs = parseInt(args[args.length - 1]);
        if (isNaN(secs) || secs <= 0 || secs > 120) { dlog('  Secondi non validi (1-120)', '#ff5555'); break; }
        const target = findUser(args.slice(0, -1).join(' '));
        if (!target) { dlog(`  Utente non trovato`, '#ff5555'); break; }
        if (target.id === user.id) { dlog('  Non puoi bannarti da solo 🤦', '#ff5555'); break; }
        broadcast({ type: 'ban', targetId: target.id, targetName: target.full_name, duration: secs });
        dlog(`  🔨 ${target.full_name} bannato per ${secs}s`, '#ff5555'); break;
      }
      case 'shake': case 'disco': case 'flip': {
        const emoji = cmd === 'shake' ? '🫨' : cmd === 'disco' ? '🪩' : '🙃';
        const maxDur = cmd === 'shake' ? 10 : 15;
        const defDur = cmd === 'shake' ? 3 : 5;
        const lastNum = parseInt(args[args.length - 1]);
        const allMode = args.length === 0 || (args.length === 1 && !isNaN(parseInt(args[0])));
        if (allMode) {
          const dur = Math.min(parseInt(args[0]) || defDur, maxDur);
          broadcast({ type: cmd, duration: dur * 1000 });
          dlog(`  ${emoji} ${cmd} per tutti! (${dur}s)`, '#ffd700');
        } else {
          const hasNum = args.length >= 2 && !isNaN(lastNum);
          const dur = hasNum ? Math.min(lastNum || defDur, maxDur) : defDur;
          const nameQ = hasNum ? args.slice(0, -1).join(' ') : args.join(' ');
          const target = findUser(nameQ);
          if (!target) { dlog(`  Utente "${nameQ}" non trovato`, '#ff5555'); break; }
          broadcast({ type: cmd, targetId: target.id, duration: dur * 1000 });
          dlog(`  ${emoji} ${cmd} → ${target.full_name} (${dur}s)`, '#ffd700');
        }
        break;
      }
      case 'clear': case 'cls': { setOutput([]); break; }
      case 'whoami': { dlog(''); dlog(`  👤 ${user.full_name}`, '#F28C28'); dlog(`  📧 ${user.email}`, '#888'); dlog(`  🎭 ${user.role}`, '#888'); dlog(''); break; }
      case 'users': {
        dlog(''); dlog(`  👥 Utenti (${profiles.length}):`, '#ffd700');
        profiles.forEach(p => { const tag = p.id === user.id ? ' ← tu' : ''; dlog(`  ${(p.full_name || '???').padEnd(24)} ${(p.role || 'studente').padEnd(14)}${tag}`, p.id === user.id ? '#F28C28' : '#888'); });
        dlog(''); break;
      }
      default: dlog(`  Comando sconosciuto: "${cmd}"`, '#ff5555');
    }
  };

  const onKey = (e) => {
    if (e.key === 'Enter') { exec(input); setInput(''); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (history.length > 0) { const n = Math.min(histIdx + 1, history.length - 1); setHistIdx(n); setInput(history[n]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (histIdx > 0) { setHistIdx(histIdx - 1); setInput(history[histIdx - 1]); } else { setHistIdx(-1); setInput(''); } }
  };

  return (
    <div data-admin-console onClick={() => inRef.current?.focus()} style={{
      position: 'fixed', left: pos.x, top: pos.y, width: termWidth, maxWidth: 'calc(100vw - 16px)', zIndex: 9999,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 0 40px rgba(0,255,65,0.25), 0 12px 40px rgba(0,0,0,0.7)',
      border: '1.5px solid rgba(0,255,65,0.4)',
      fontFamily: '"Courier New", Consolas, "Liberation Mono", monospace', fontSize: 12.5,
      backdropFilter: 'blur(12px)',
    }}>
      {/* title bar */}
      <div onMouseDown={onDragStart} style={{
        background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', borderBottom: '1px solid rgba(0,255,65,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', cursor: 'pointer' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <span style={{ color: '#00ff41', fontWeight: 700, fontSize: 12, letterSpacing: 1.5, opacity: 0.8 }}>ADMIN CONSOLE</span>
        </div>
        <span style={{ color: '#333', fontSize: 10 }}>Ctrl+Shift+D</span>
      </div>
      {/* output */}
      <div ref={outRef} style={{ background: 'rgba(13,17,23,0.97)', padding: '10px 14px', height: 280, overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: '#00ff4133 transparent' }}>
        {output.map((line, i) => <div key={i} style={{ color: line.c, lineHeight: 1.65, whiteSpace: 'pre', wordBreak: 'break-all' }}>{line.text || '\u00A0'}</div>)}
      </div>
      {/* input */}
      <div style={{ background: 'rgba(10,14,20,0.98)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(0,255,65,0.12)' }}>
        <span style={{ color: '#00ff41', fontWeight: 700, fontSize: 14 }}>{'❯'}</span>
        <input ref={inRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} spellCheck={false} autoComplete="off" placeholder="Digita un comando..."
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e6e6e6', fontFamily: 'inherit', fontSize: 12.5, caretColor: '#00ff41' }} />
      </div>
    </div>
  );
}
