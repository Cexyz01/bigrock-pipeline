import { useEffect, useRef } from 'react';
import Matter from 'matter-js';

/**
 * GravityEffect — Every visible element falls with real physics.
 * Big elements get split into their children. Small elements fall as-is.
 */
export default function GravityEffect({ duration = 6000, onDone }) {
  const rafRef = useRef(null);

  useEffect(() => {
    const { Engine, World, Bodies } = Matter;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const engine = Engine.create({ gravity: { x: 0, y: 2.2 } });

    // Walls
    const wallThick = 60;
    World.add(engine.world, [
      Bodies.rectangle(vw / 2, vh + wallThick / 2, vw * 2, wallThick, { isStatic: true, restitution: 0.3, friction: 0.8 }),
      Bodies.rectangle(-wallThick / 2, vh / 2, wallThick, vh * 3, { isStatic: true }),
      Bodies.rectangle(vw + wallThick / 2, vh / 2, wallThick, vh * 3, { isStatic: true }),
    ]);

    /* ── Collect ALL visible elements ── */
    const collected = [];

    // Max dimension thresholds — anything bigger gets split into children
    const MAX_W = vw * 0.30;
    const MAX_H = vh * 0.30;
    const MAX_AREA = vw * vh * 0.12;

    function walk(el) {
      if (!el || !el.children) return;
      for (const child of el.children) {
        if (child.hasAttribute('data-gravity-overlay')) continue;

        const cs = window.getComputedStyle(child);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        if (cs.position === 'fixed') continue; // skip fixed overlays/navs

        const rect = child.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;
        if (rect.bottom < -20 || rect.top > vh + 20) continue;
        if (rect.right < -20 || rect.left > vw + 20) continue;

        const area = rect.width * rect.height;
        const tooBig = rect.width > MAX_W || rect.height > MAX_H || area > MAX_AREA;

        if (tooBig) {
          // Too big — drill into children
          walk(child);
        } else {
          // Small enough — this falls! Don't walk children (they move with parent)
          collected.push({ el: child, rect });
        }
      }
    }

    const root = document.getElementById('root');
    if (root) walk(root);

    /* ── Create physics bodies ── */
    const items = collected.map(({ el, rect }, i) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const w = Math.max(rect.width, 6);
      const h = Math.max(rect.height, 6);

      const body = Bodies.rectangle(cx, cy, w, h, {
        restitution: 0.15 + Math.random() * 0.2,
        friction: 0.4 + Math.random() * 0.4,
        frictionAir: 0.003 + Math.random() * 0.008,
        angle: (Math.random() - 0.5) * 0.06,
        density: 0.0006 + Math.random() * 0.001,
      });

      // Small random initial nudge
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * 0.04,
        y: -(Math.random() * 0.03),
      });

      World.add(engine.world, body);

      const orig = {
        transform: el.style.transform,
        transition: el.style.transition,
        zIndex: el.style.zIndex,
        willChange: el.style.willChange,
        pointerEvents: el.style.pointerEvents,
      };

      el.style.willChange = 'transform';
      el.style.transition = 'none';
      el.style.zIndex = String(9000 + (i % 500));
      el.style.pointerEvents = 'none';

      return { el, body, cx, cy, orig };
    });

    // Physics loop
    const update = () => {
      Engine.update(engine, 1000 / 60);
      for (const item of items) {
        const dx = item.body.position.x - item.cx;
        const dy = item.body.position.y - item.cy;
        const a = item.body.angle;
        item.el.style.transform = `translate(${dx}px, ${dy}px) rotate(${a}rad)`;
      }
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);

    // Restore
    const restoreTimer = setTimeout(() => {
      cancelAnimationFrame(rafRef.current);
      for (const item of items) {
        item.el.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
        item.el.style.transform = item.orig.transform || '';
      }
      setTimeout(() => {
        for (const item of items) {
          item.el.style.transition = item.orig.transition || '';
          item.el.style.zIndex = item.orig.zIndex || '';
          item.el.style.willChange = item.orig.willChange || '';
          item.el.style.pointerEvents = item.orig.pointerEvents || '';
        }
        World.clear(engine.world);
        Engine.clear(engine);
        onDone();
      }, 900);
    }, duration);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(restoreTimer);
      for (const item of items) {
        item.el.style.transform = item.orig.transform || '';
        item.el.style.transition = item.orig.transition || '';
        item.el.style.zIndex = item.orig.zIndex || '';
        item.el.style.willChange = item.orig.willChange || '';
        item.el.style.pointerEvents = item.orig.pointerEvents || '';
      }
      World.clear(engine.world);
      Engine.clear(engine);
    };
  }, [duration, onDone]);

  return (
    <div
      data-gravity-overlay
      style={{
        position: 'fixed', inset: 0, zIndex: 8999,
        pointerEvents: 'all', cursor: 'default',
        background: 'transparent',
      }}
    />
  );
}
