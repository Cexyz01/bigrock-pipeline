import { useState, useEffect, useRef, useCallback } from 'react';

const CATEGORY_COLORS = {
  cinema: '#EF4444',
  animazione: '#8B5CF6',
  vfx: '#3B82F6',
  pipeline: '#F28C28',
  fotografia: '#EC4899',
  citazioni: '#A855F7',
  generale: '#22C55E',
};
const CATEGORY_ICONS = {
  cinema: '🎬', animazione: '🎨', vfx: '💥', pipeline: '🔧',
  fotografia: '📷', citazioni: '💬', generale: '🧠',
};

const TIME_PER_Q = 15;
const REVEAL_TIME = 2; // seconds to show correct answer before next question

export default function TriviaQuizGame({ gameState, onMove, isMobile }) {
  const questions = gameState.questions || [];
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [timer, setTimer] = useState(TIME_PER_Q);
  const [phase, setPhase] = useState('question'); // question | selected | reveal | done
  const [selectedIdx, setSelectedIdx] = useState(null);
  const timerRef = useRef(null);
  const revealRef = useRef(null);
  const answeredRef = useRef(false);

  // Question countdown timer
  useEffect(() => {
    if (phase !== 'question') return;
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          if (!answeredRef.current) {
            answeredRef.current = true;
            handleAnswer(-1); // timeout
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase, currentQ]);

  // Cleanup
  useEffect(() => {
    return () => { clearInterval(timerRef.current); clearTimeout(revealRef.current); };
  }, []);

  const handleAnswer = useCallback((idx) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    setSelectedIdx(idx);
    setPhase('selected');
    clearInterval(timerRef.current);

    const q = questions[currentQ];
    const correct = idx === q?.correctIndex;
    const newScore = score + (correct ? 1 : 0);
    setScore(newScore);

    // Show neutral "selected" briefly, then reveal correct/incorrect
    revealRef.current = setTimeout(() => {
      setPhase('reveal');

      // After reveal, advance or finish
      revealRef.current = setTimeout(() => {
        const nextQ = currentQ + 1;
        if (nextQ >= questions.length) {
          setPhase('done');
          onMove({ score: newScore, totalQuestions: questions.length, won: newScore >= 7 });
        } else {
          setCurrentQ(nextQ);
          setSelectedIdx(null);
          setTimer(TIME_PER_Q);
          setPhase('question');
          answeredRef.current = false;
        }
      }, REVEAL_TIME * 1000);
    }, 600); // 600ms neutral selection before reveal
  }, [currentQ, questions, score, onMove]);

  if (questions.length === 0) {
    return <div style={{ color: '#888', textAlign: 'center', padding: 40 }}>Nessuna domanda disponibile</div>;
  }

  const q = questions[currentQ];
  if (!q) return null;

  const cat = q.category || 'generale';
  const catColor = CATEGORY_COLORS[cat] || '#888';
  const catIcon = CATEGORY_ICONS[cat] || '🧠';
  const diff = q.difficulty || 'easy';
  const diffLabel = { easy: 'Facile', medium: 'Media', hard: 'Difficile' }[diff];
  const diffColor = { easy: '#22C55E', medium: '#F28C28', hard: '#EF4444' }[diff];
  const isReveal = phase === 'reveal' || phase === 'done';
  const totalQ = questions.length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: '100%', maxWidth: 520, gap: 16,
    }}>
      {/* Score + progress bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', padding: '10px 16px',
        background: '#1a1a1a', borderRadius: 12, border: '1px solid #2a2a2a',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#22C55E' }}>{score}</span>
          <span style={{ fontSize: 12, color: '#555' }}>/{totalQ}</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#555', fontWeight: 700 }}>
            Domanda {currentQ + 1}/{totalQ}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <span style={{
              fontSize: 10, color: catColor, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 1,
            }}>
              {catIcon} {cat}
            </span>
            <span style={{
              fontSize: 9, color: diffColor, fontWeight: 700,
              padding: '1px 6px', borderRadius: 4,
              background: `${diffColor}18`, border: `1px solid ${diffColor}40`,
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {diffLabel}
            </span>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#666', textAlign: 'right', lineHeight: 1.3 }}>
          <div>7+ = 1 bustina</div>
          <div>10 = 2 bustine</div>
        </div>
      </div>

      {/* Question progress dots — colored by difficulty */}
      <div style={{ display: 'flex', gap: 4 }}>
        {questions.map((qItem, i) => {
          const dColor = { easy: '#22C55E', medium: '#F28C28', hard: '#EF4444' }[qItem.difficulty || 'easy'];
          return (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: i < currentQ ? dColor
                : i === currentQ ? '#F1F5F9'
                : `${dColor}40`,
              transition: 'background 0.3s',
              boxShadow: i === currentQ ? '0 0 6px rgba(255,255,255,0.5)' : 'none',
            }} />
          );
        })}
      </div>

      {/* Timer bar */}
      {(phase === 'question') && (
        <div style={{
          width: '100%', height: 4, borderRadius: 2, background: '#2a2a2a',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: timer <= 3 ? '#EF4444' : timer <= 7 ? '#F28C28' : '#22C55E',
            width: `${(timer / TIME_PER_Q) * 100}%`,
            transition: 'width 1s linear, background 0.3s ease',
          }} />
        </div>
      )}

      {/* Question card */}
      <div style={{
        width: '100%', padding: '20px 24px',
        background: `linear-gradient(135deg, ${catColor}15, transparent)`,
        border: `1px solid ${catColor}30`,
        borderRadius: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: isMobile ? 15 : 17, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.5 }}>
          {q.text}
        </div>
      </div>

      {/* Timer number */}
      {phase === 'question' && (
        <div style={{
          fontSize: 28, fontWeight: 900, fontFamily: '"Courier New", monospace',
          color: timer <= 3 ? '#EF4444' : timer <= 7 ? '#F28C28' : '#22C55E',
          animation: timer <= 3 ? 'pulse 0.5s ease infinite' : 'none',
        }}>
          {timer}
        </div>
      )}

      {/* Answer options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isMyPick = selectedIdx === i;
          let bg = '#1a1a1a';
          let border = '1px solid #333';
          let color = '#F1F5F9';

          if (isReveal) {
            if (isCorrect) { bg = 'rgba(34,197,94,0.15)'; border = '1.5px solid #22C55E'; color = '#22C55E'; }
            else if (isMyPick && !isCorrect) { bg = 'rgba(239,68,68,0.15)'; border = '1.5px solid #EF4444'; color = '#EF4444'; }
          } else if (isMyPick) {
            // Neutral "selected" — no green/red before reveal
            bg = 'rgba(148,163,184,0.15)'; border = '1.5px solid #94A3B8'; color = '#CBD5E1';
          }

          return (
            <button
              key={i}
              onClick={() => { if (phase === 'question') handleAnswer(i); }}
              disabled={phase !== 'question'}
              style={{
                padding: '14px 18px', borderRadius: 12,
                background: bg, border, color,
                fontSize: isMobile ? 13 : 14, fontWeight: 600,
                cursor: phase === 'question' ? 'pointer' : 'default',
                textAlign: 'left', position: 'relative',
                opacity: isReveal && !isCorrect && !isMyPick ? 0.5 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ marginRight: 10, opacity: 0.5 }}>{String.fromCharCode(65 + i)}.</span>
              {opt}
              {isReveal && isMyPick && (
                <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
                  {isCorrect ? '✅' : '❌'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Status line */}
      <div style={{ fontSize: 12, color: '#555', textAlign: 'center', minHeight: 20 }}>
        {phase === 'selected' && 'Verifica...'}
        {phase === 'reveal' && (selectedIdx === q?.correctIndex ? '✅ Corretto!' : '❌ Sbagliato!')}
      </div>
    </div>
  );
}
