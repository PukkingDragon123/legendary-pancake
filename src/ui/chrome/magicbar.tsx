// The level bar: a glass tube between two turned brass caps, filled with swirling liquid moonlight (deep
// violet at the walls, sky blue, a bright cyan-white core, threads of light winding through it, a wobbling
// meniscus, rising bubbles). XP gains surge the fill with sparks flying off the surface; a level-up fills it
// to the brim, flashes gold, drains and refills. [ui7] Drawn smooth at device resolution: the caps are painted
// once by the material painter, the glass and the liquid with gradients every frame.
import { useEffect, useRef } from 'preact/hooks';
import { clockNow } from './pxanim.tsx';
import { uiBurst } from './uifx.ts';
import { reducedMotion } from './swing.ts';
import { GOLD, Real, deviceK, metal, tubeX, box, circle, cutBox, dome, cached } from '../real/paint.ts';

interface Bub { x: number; y: number; v: number; r: number }

/** one turned brass end cap, `h` CSS px tall, `w` wide (left cap; mirror for the right) */
function capArt(w: number, h: number): HTMLImageElement {
  const url = cached(`tubecap:${w}x${h}`, () => {
    const r = new Real(w, h, deviceK(3) * 2, 0), brass = metal(GOLD, { polish: 0.8, along: 'y' });
    r.part(cutBox(0, 0, w * 0.72, h, h * 0.18), (x, y) => tubeX(h / 2, h / 2, 0)(x, y, 0) * 0.9 + 0.6, brass, { line: true });
    r.carve(box(w * 0.24, -1, w * 0.06, h + 2, 0), 0.6, 0.3); r.carve(box(w * 0.44, -1, w * 0.06, h + 2, 0), 0.6, 0.3);
    r.part(box(w * 0.58, h * 0.14, w * 0.42, h * 0.72, 0), (x, y) => tubeX(h / 2, h * 0.36, 0)(x, y, 0) + 0.4, brass, { line: 0.8 });
    r.part(circle(w * 0.3, h / 2, h * 0.14), dome(w * 0.3, h / 2, h * 0.14, h * 0.14, 1.2, h * 0.5), metal(GOLD, { polish: 0.95 }));
    return r.url({ shadow: false });
  });
  const im = new Image(); im.src = url;
  return im;
}

export function MagicBar(p: { level: number; into: number; need: number; w?: number; big?: boolean; class?: string; overflow?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ shown: p.need ? p.into / p.need : 0, from: 0, to: 0, t0: 0, dur: 0, level: p.level, queue: [] as { to: number; dur: number; flash?: boolean }[], flash: 0, surge: 0, bubs: [] as Bub[], lastSpark: 0 });
  const css = p.big ? 4 : 2, W = (p.w ?? 56) * css, H = 12 * css;
  // new targets
  useEffect(() => {
    const s = st.current, target = p.need ? Math.min(1, p.into / p.need) : 0;
    const now = clockNow();
    if (p.overflow) { s.queue = [{ to: 1, dur: 900 }, { to: 1, dur: 500, flash: true }]; s.t0 = now; s.dur = 0; return; }
    if (p.level > s.level) {
      s.queue = [{ to: 1, dur: 650 }, { to: 1, dur: 380, flash: true }, { to: 0, dur: 280 }, { to: target, dur: 800 }];
      s.level = p.level; s.t0 = now; s.dur = 0;
    } else if (target > s.shown + 0.001) { s.queue = [{ to: target, dur: 1000 }]; s.t0 = now; s.dur = 0; }
    else if (target < s.shown - 0.001 && !s.queue.length) s.shown = target;
    s.level = p.level;
  }, [p.level, p.into, p.need, p.overflow]);

  useEffect(() => {
    const cv = ref.current!;
    const k = Math.min(3, Math.max(1, devicePixelRatio || 1)) * (p.big ? 1 : matchMediaSafe('(min-width: 900px) and (min-height: 640px)') ? 1.5 : 1);
    cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    const g = cv.getContext('2d')!;
    const capW = H * 0.62, cap = capArt(capW, H);
    let raf = 0, lastPaint = 0, lastT = clockNow();
    const still = reducedMotion();
    const x0 = capW * 0.78, x1 = W - capW * 0.78, len = x1 - x0, ty0 = H * 0.16, ty1 = H * 0.84, th = ty1 - ty0, rad = th / 2;
    const tube = () => { g.beginPath(); g.rect(x0 - rad * 0.4, ty0, len + rad * 0.8, th); }; // [ui10] a square glass bore, no rounded ends
    const frame = (now0: number) => {
      raf = requestAnimationFrame(frame);
      if (now0 - lastPaint < 33) return;
      lastPaint = now0;
      const now = clockNow(), t = still ? 2 : now / 1000, dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      const s = st.current;
      if (s.queue.length) {
        if (!s.dur) { s.from = s.shown; s.to = s.queue[0].to; s.dur = s.queue[0].dur; s.t0 = now; s.flash = s.queue[0].flash ? 1 : 0; }
        const kk = Math.min(1, (now - s.t0) / s.dur), e = 1 - (1 - kk) ** 3;
        s.shown = s.from + (s.to - s.from) * e;
        s.surge = s.to > s.from ? 1 - kk * 0.6 : 0;
        if (s.queue[0].flash) s.flash = 1 - kk;
        if (kk >= 1) { s.queue.shift(); s.dur = 0; if (!s.queue.length) { s.surge = 0; s.flash = 0; } }
      } else s.surge = Math.max(0, s.surge - dt * 2);
      const xf = x0 + s.shown * len;
      if (s.surge > 0.2 && now - s.lastSpark > 140 && cv.isConnected) {
        s.lastSpark = now;
        const r = cv.getBoundingClientRect(), sx = r.left + (xf / W) * r.width, sy = r.top + r.height / 2;
        uiBurst('magic', sx, sy, 2);
      }
      if (!still && xf > x0 + 4 && Math.random() < dt * (3 + s.surge * 10)) s.bubs.push({ x: x0 + 2 + Math.random() * (xf - x0 - 4), y: ty1 - 1.5, v: (4 + Math.random() * 6) * (H / 24), r: 0.6 + Math.random() * 0.9 });
      for (const b of s.bubs) { b.y -= b.v * dt; b.x += Math.sin(t * 4 + b.y) * dt * 2; }
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, W, H);
      // the dark glass bore
      tube();
      let gr = g.createLinearGradient(0, ty0, 0, ty1);
      gr.addColorStop(0, '#2a3466'); gr.addColorStop(0.35, '#12183a'); gr.addColorStop(1, '#0a0c22');
      g.fillStyle = gr; g.fill();
      // the liquid
      if (xf > x0 - rad * 0.4) {
        g.save(); tube(); g.clip();
        const gold = s.flash > 0.05;
        const wob = (y: number) => xf + Math.sin(t * 7 + y * 0.6) * (H / 24) * 0.8;
        g.beginPath(); g.moveTo(x0 - rad, ty0);
        for (let y = ty0; y <= ty1; y += 1) g.lineTo(wob(y), y);
        g.lineTo(x0 - rad, ty1); g.closePath();
        gr = g.createLinearGradient(0, ty0, 0, ty1);
        if (gold) { gr.addColorStop(0, '#fff6c8'); gr.addColorStop(0.35, '#ffd860'); gr.addColorStop(0.75, '#d0901c'); gr.addColorStop(1, '#7a4a0c'); }
        else { gr.addColorStop(0, '#bfeeff'); gr.addColorStop(0.3, '#6ccaf4'); gr.addColorStop(0.62, '#3a6ed6'); gr.addColorStop(1, '#241c6a'); }
        g.fillStyle = gr; g.fill();
        // winding threads of light
        g.globalCompositeOperation = 'lighter';
        g.lineWidth = Math.max(0.6, th * 0.09); g.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = gold ? 'rgba(255,240,180,.35)' : `rgba(200,240,255,${0.22 + s.surge * 0.2})`;
          g.beginPath();
          for (let x = x0 - rad; x <= xf; x += 2) {
            const y = ty0 + th * (0.45 + 0.28 * Math.sin((x - t * 26 * (H / 24)) * 0.09 + i * 2.1 + Math.sin(x * 0.05 + t) * 1.2));
            if (x <= x0 - rad + 0.1) g.moveTo(x, y); else g.lineTo(x, y);
          }
          g.stroke();
        }
        // the bright meniscus
        const mg = g.createLinearGradient(xf - 5, 0, xf + 1, 0);
        mg.addColorStop(0, 'rgba(255,255,255,0)'); mg.addColorStop(1, gold ? 'rgba(255,250,220,.75)' : 'rgba(220,250,255,.7)');
        g.fillStyle = mg; g.fillRect(xf - 5, ty0, 6, th);
        g.globalCompositeOperation = 'source-over';
        // bubbles
        s.bubs = s.bubs.filter((b) => b.y > ty0 + 1 && b.x < xf);
        for (const b of s.bubs) { g.fillStyle = 'rgba(235,250,255,.85)'; g.beginPath(); g.arc(b.x, b.y, b.r * (H / 24), 0, Math.PI * 2); g.fill(); }
        g.restore();
      }
      // ticks under the glass and the glass highlights
      g.save(); tube(); g.clip();
      g.strokeStyle = 'rgba(160,180,230,.22)'; g.lineWidth = 0.6;
      for (let i = 1; i < 5; i++) { const x = x0 + (len * i) / 5; g.beginPath(); g.moveTo(x, ty1 - th * 0.35); g.lineTo(x, ty1); g.stroke(); }
      gr = g.createLinearGradient(0, ty0, 0, ty1);
      gr.addColorStop(0, 'rgba(255,255,255,.0)'); gr.addColorStop(0.12, 'rgba(255,255,255,.65)'); gr.addColorStop(0.3, 'rgba(255,255,255,.08)'); gr.addColorStop(0.8, 'rgba(255,255,255,0)'); gr.addColorStop(0.92, 'rgba(190,220,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.3)');
      g.fillStyle = gr; g.fillRect(x0 - rad, ty0, len + 2 * rad, th);
      g.restore();
      tube(); g.strokeStyle = 'rgba(16,10,6,.55)'; g.lineWidth = 0.8; g.stroke();
      // brass caps
      if (cap.complete && cap.naturalWidth) {
        g.drawImage(cap, 0, 0, capW, H);
        g.save(); g.translate(W, 0); g.scale(-1, 1); g.drawImage(cap, 0, 0, capW, H); g.restore();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [W, H, p.big]);
  return <canvas ref={ref} class={'hh-magicbar' + (p.big ? ' big' : '') + (p.class ? ' ' + p.class : '')} style={{ width: `${W}px`, height: `${H}px` }} aria-hidden="true" />;
}

const matchMediaSafe = (q: string) => { try { return matchMedia(q).matches; } catch { return false; } };
