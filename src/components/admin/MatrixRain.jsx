import { useRef, useEffect } from 'react';

const CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&';

export default function MatrixRain() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const fontSize = 15;
    let columns = Math.floor(canvas.width / fontSize);
    let drops = Array(columns).fill(0).map(() => Math.random() * -100 | 0);

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < drops.length; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // bright head
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.fillText(char, x, y);

        // trail
        ctx.fillStyle = `rgba(0, 255, 65, ${0.6 + Math.random() * 0.4})`;
        ctx.font = `${fontSize}px monospace`;
        const prev = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillText(prev, x, y - fontSize);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animId = requestAnimationFrame(draw);
    };

    // initial black fill
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    animId = requestAnimationFrame(draw);

    const onResize = () => {
      resize();
      columns = Math.floor(canvas.width / fontSize);
      drops = Array(columns).fill(0).map(() => Math.random() * -50 | 0);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        pointerEvents: 'none',
      }}
    />
  );
}
