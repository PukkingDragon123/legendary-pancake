// The level bar as a glass tube between two brass caps, filled with swirling liquid moonlight
// (lake, mist and dusk blues from the calm palette): a flowing noise pattern, a bright wobbling meniscus, rising bubbles that pop into tiny
// sparkles. XP gains surge the fill with sparks flying off the surface; a level-up fills it to the
// brim, flashes, drains and refills. Painted per texel on a tiny canvas (2 CSS px per texel).
import { useEffect, useRef } from 'preact/hooks';
import { vnoise } from './paint.ts';
import { clockNow } from './pxanim.tsx';
import { uiBurst } from './uifx.ts';
import { calmRGB } from '../px/calm.js';

const PAL = ['#2b3a4c', '#46596a', '#617f8c', '#86a9b0', '#c6dcd8', '#f4f1e4'].map((h) => { const n = parseInt(h.slice(1), 16); return calmRGB([(n >> 16) & 255, (n >> 8) & 255, n & 255]); });
const GOLD = [[142, 116, 64], [168, 138, 78], [197, 154, 82], [220, 176, 114], [241, 211, 154], [248, 236, 210]].map(calmRGB);
const BRASS = [[51, 41, 26], [123, 101, 56], [142, 116, 64], [200, 167, 100], [214, 184, 118], [241, 211, 154]].map(calmRGB);
const INK = [46, 43, 36];
const CYL = [1, 0.7, 0.35, 0.1, 0, -0.2, -0.45, -0.75];

interface Bub { x: number; y: number; v: number }

export function MagicBar(p: { level: number; into: number; need: number; w?: number; big?: boolean; class?: string; overflow?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ shown: p.need ? p.into / p.need : 0, from: 0, to: 0, t0: 0, dur: 0, level: p.level, queue: [] as { to: number; dur: number; flash?: boolean }[], flash: 0, surge: 0, bubs: [] as Bub[], lastSpark: 0 });
  const W = p.w ?? 56, H = 12;
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
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(W, H), d = img.data;
    let raf = 0, lastPaint = 0, lastT = clockNow();
    const set = (x: number, y: number, c: number[], a = 255) => { const i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };
    const blend = (x: number, y: number, c: number[], k: number) => { const i = (y * W + x) * 4; d[i] += (c[0] - d[i]) * k; d[i + 1] += (c[1] - d[i + 1]) * k; d[i + 2] += (c[2] - d[i + 2]) * k; };
    const frame = (now0: number) => {
      raf = requestAnimationFrame(frame);
      if (now0 - lastPaint < 38) return;
      lastPaint = now0;
      const now = clockNow(), t = now / 1000, dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      const s = st.current;
      // advance the queued fills
      if (s.queue.length) {
        if (!s.dur) { s.from = s.shown; s.to = s.queue[0].to; s.dur = s.queue[0].dur; s.t0 = now; s.flash = s.queue[0].flash ? 1 : 0; }
        const k = Math.min(1, (now - s.t0) / s.dur), e = 1 - (1 - k) ** 3;
        s.shown = s.from + (s.to - s.from) * e;
        s.surge = s.to > s.from ? 1 - k * 0.6 : 0;
        if (s.queue[0].flash) s.flash = 1 - k;
        if (k >= 1) { s.queue.shift(); s.dur = 0; if (!s.queue.length) { s.surge = 0; s.flash = 0; } }
      } else s.surge = Math.max(0, s.surge - dt * 2);
      const x0 = 3, x1 = W - 4, len = x1 - x0;
      const xf = x0 + Math.round(s.shown * len);
      // sparks fly off the surface while it surges
      if (s.surge > 0.2 && now - s.lastSpark > 140 && cv.isConnected) {
        s.lastSpark = now;
        const r = cv.getBoundingClientRect(), sx = r.left + (xf / W) * r.width, sy = r.top + r.height / 2;
        uiBurst('magic', sx, sy, 2);
      }
      // bubbles
      if (xf > x0 + 2 && Math.random() < dt * (3 + s.surge * 10)) s.bubs.push({ x: x0 + 1 + Math.random() * (xf - x0 - 2), y: 9, v: 6 + Math.random() * 6 });
      for (const b of s.bubs) { b.y -= b.v * dt; b.x += Math.sin(t * 4 + b.y) * dt * 2; }
      d.fill(0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        // brass caps
        if (x < 3 || x >= W - 3) {
          if (y === 0 || y === H - 1) { if (x > 0 && x < W - 1) set(x, y, INK); continue; }
          if (x === 0 || x === W - 1) { set(x, y, INK); continue; }
          const tone = y === 1 ? 5 : y === 2 ? 4 : y < 6 ? 3 : y < 9 ? 2 : 1;
          set(x, y, BRASS[(x === 1 || x === W - 2) && tone > 1 ? tone - 1 : tone]);
          continue;
        }
        if (y === 0 || y === H - 1) continue;
        if (y === 1 || y === H - 2) { set(x, y, INK); continue; }
        const r = y - 2; // 0..7 inside the glass
        const xm = xf + Math.round(Math.sin(t * 7 + y * 1.3) * 0.6);
        if (x < xm) {
          let v = Math.sin((x - t * 10) * 0.42 + Math.sin(y * 0.9 + t * 2.4) * 1.7) * 0.5 + 0.5;
          v = v * 0.55 + vnoise(x * 0.28 - t * 3.2, y * 0.55 + t * 0.8, 1) * 0.45;
          let idx = Math.round(v * 3 + CYL[r] * 1.3 + s.surge * 0.8 - 0.2);
          idx = Math.max(0, Math.min(5, idx));
          set(x, y, s.flash > 0.05 ? GOLD[Math.min(5, idx + Math.round(s.flash * 3))] : PAL[idx]);
          if (x >= xm - 1) set(x, y, PAL[r < 2 ? 5 : 4]);
        } else {
          // empty glass: dark, with a faint inner glow next to the surface
          set(x, y, r === 0 ? [52, 64, 80] : r === 7 ? [22, 28, 37] : [33, 42, 54]);
          if (x - xm < 2 && xf > x0) blend(x, y, PAL[3], 0.35);
          if ((x - x0) % Math.max(4, Math.round(len / 4)) === 0 && r > 5) set(x, y, [70, 89, 106]);
        }
        // glass reflection streak
        if (r === 1 && (x + 2) % 9 < 6) blend(x, y, [244, 238, 221], 0.38);
      }
      // bubbles and twinkles inside the liquid
      s.bubs = s.bubs.filter((b) => {
        const bx = Math.round(b.x), by = Math.round(b.y);
        if (by < 2 || bx >= xf) { if (by < 2 && bx < xf && bx > x0) { set(bx, 2, [244, 238, 221]); } return false; }
        set(bx, by, [211, 224, 220]);
        return true;
      });
      if (xf > x0 + 4) for (let i = 0; i < 2; i++) {
        const sx = x0 + 1 + Math.floor(((t * 3.1 + i * 7.3) % 1) * (xf - x0 - 2)), sy = 3 + ((Math.floor(t * 5) + i * 3) % 5);
        if (Math.floor(t * 6 + i) % 3 === 0) set(sx, sy, [244, 238, 221]);
      }
      g.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [W]);
  return <canvas ref={ref} class={'hh-magicbar px' + (p.big ? ' big' : '') + (p.class ? ' ' + p.class : '')} style={{ width: `${W * (p.big ? 4 : 2)}px`, height: `${H * (p.big ? 4 : 2)}px` }} aria-hidden="true" />;
}
