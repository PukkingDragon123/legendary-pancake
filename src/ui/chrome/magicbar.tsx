// The level bar as a glowing glass tube between two turned brass caps, filled with swirling liquid
// moonlight: deep violet at the walls, sky blue, a bright cyan-white core, threads of light that wind
// through it, a wobbling meniscus, rising bubbles that pop into tiny sparkles. XP gains surge the fill
// with sparks flying off the surface; a level-up fills it to the brim, flashes gold, drains and refills.
// [ui4] painted per texel at k texels per design unit (2 on phones, 3 on desktop, 4 for the big one), so it
// shares the fine pixel grid of the other v4 objects; lit from the top left like everything else.
import { useEffect, useRef, useState } from 'preact/hooks';
import { vnoise } from '../px/relief.ts';
import { clockNow } from './pxanim.tsx';
import { uiBurst } from './uifx.ts';
import { DESK_HUD, kFor } from './objects.ts';
import { reducedMotion } from './swing.ts';

type C3 = [number, number, number];
const hx = (h: string): C3 => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const LIQ = ['#140c3a', '#24206e', '#2f3fa8', '#3a6ed6', '#4fa3ea', '#86d4f6', '#c8f2ff', '#ffffff'].map(hx);
const GOLD = ['#5a3608', '#9a6410', '#d49a1e', '#f2c440', '#ffe27a', '#fff3c0', '#ffffff', '#ffffff'].map(hx);
const BRASS = ['#2b1a06', '#4a300b', '#6e4a12', '#94661a', '#b88524', '#d4a432', '#e8c24e', '#f6dc7f', '#fff1bd'].map(hx);
const INK: C3 = [26, 14, 8];
const GLASS_IN: C3 = [16, 20, 44];

interface Bub { x: number; y: number; v: number }

export function MagicBar(p: { level: number; into: number; need: number; w?: number; big?: boolean; class?: string; overflow?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef({ shown: p.need ? p.into / p.need : 0, from: 0, to: 0, t0: 0, dur: 0, level: p.level, queue: [] as { to: number; dur: number; flash?: boolean }[], flash: 0, surge: 0, bubs: [] as Bub[], lastSpark: 0 });
  const W = p.w ?? 56, H = 12;
  const [k, setK] = useState(() => (p.big ? 4 : kFor(DESK_HUD)));
  useEffect(() => {
    if (p.big) return;
    let mq: MediaQueryList | null = null;
    try { mq = matchMedia(DESK_HUD); } catch { return; }
    const on = () => setK(kFor(DESK_HUD));
    mq.addEventListener?.('change', on);
    return () => mq?.removeEventListener?.('change', on);
  }, [p.big]);
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
    const TW = W * k, TH = H * k;
    cv.width = TW; cv.height = TH;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(TW, TH), d = img.data;
    let raf = 0, lastPaint = 0, lastT = clockNow();
    const set = (x: number, y: number, c: C3, a = 255) => { if (x < 0 || y < 0 || x >= TW || y >= TH) return; const i = (y * TW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };
    const blend = (x: number, y: number, c: C3, t: number) => { if (x < 0 || y < 0 || x >= TW || y >= TH) return; const i = (y * TW + x) * 4; d[i] += (c[0] - d[i]) * t; d[i + 1] += (c[1] - d[i + 1]) * t; d[i + 2] += (c[2] - d[i + 2]) * t; };
    const still = reducedMotion();
    // tube geometry in texels
    const cap = 4 * k, x0 = cap, x1 = TW - cap, len = x1 - x0, ty0 = 1 * k, ty1 = TH - 1 * k, th = ty1 - ty0;
    const frame = (now0: number) => {
      raf = requestAnimationFrame(frame);
      if (now0 - lastPaint < 40) return;
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
      const xf = x0 + Math.round(s.shown * len);
      if (s.surge > 0.2 && now - s.lastSpark > 140 && cv.isConnected) {
        s.lastSpark = now;
        const r = cv.getBoundingClientRect(), sx = r.left + (xf / TW) * r.width, sy = r.top + r.height / 2;
        uiBurst('magic', sx, sy, 2);
      }
      if (!still && xf > x0 + 2 * k && Math.random() < dt * (3 + s.surge * 10)) s.bubs.push({ x: x0 + k + Math.random() * (xf - x0 - 2 * k), y: ty1 - k, v: (5 + Math.random() * 6) * k });
      for (const b of s.bubs) { b.y -= b.v * dt; b.x += Math.sin(t * 4 + b.y) * dt * 2 * k; }
      d.fill(0);
      const PAL = s.flash > 0.05 ? GOLD : LIQ;
      for (let y = 0; y < TH; y++) {
        const cyl = (y - ty0 + 0.5) / th; // 0 top .. 1 bottom inside the glass
        for (let x = 0; x < TW; x++) {
          // ---- brass caps: turned, lit from the top left, a groove ring, inked ends
          if (x < cap || x >= TW - cap) {
            const left = x < cap, cx = left ? x : TW - 1 - x;
            const yy = y / (TH - 1);
            if (cx === 0 || y === 0 || y === TH - 1) { if (!(cx === 0 && (y < k || y >= TH - k))) set(x, y, INK); continue; }
            if (cx === 0 + 1 && (y < k || y >= TH - k)) continue;
            let v = 0.82 - yy * 0.72 + (left ? 0.06 : -0.06) - (cx === cap - 1 ? 0.25 : 0);
            if (Math.abs(cx - cap * 0.5) < k * 0.35) v -= 0.32; // groove
            if (yy < 0.18) v += 0.2;
            const bi = Math.max(0, Math.min(8, Math.round(v * 8 + ((x + y) % 2 ? 0.25 : -0.25))));
            set(x, y, BRASS[bi]);
            continue;
          }
          // ---- glass walls
          if (y < ty0 || y >= ty1) { set(x, y, INK); continue; }
          if (y === ty0 || y === ty1 - 1) { set(x, y, [40, 46, 84]); continue; }
          const xm = xf + Math.round(Math.sin(t * 7 + y * 0.9 / k) * 0.8 * k);
          if (x < xm) {
            // liquid light: winding threads over a cylinder-shaded body, brightest in the core
            const u = x / k, w = y / k;
            let v = Math.sin((u - t * 9) * 0.5 + Math.sin(w * 0.9 + t * 2.2) * 1.8) * 0.5 + 0.5;
            v = v * 0.5 + vnoise(u * 0.3 - t * 3, w * 0.6 + t * 0.7, 1) * 0.5;
            const core = 1 - Math.abs(cyl - 0.42) * 2.2;
            let idx = Math.round(1.2 + v * 2.6 + core * 2.6 + s.surge * 1.2 + s.flash * 2 + ((x + y) % 2 ? 0.2 : -0.2));
            idx = Math.max(0, Math.min(7, idx));
            set(x, y, PAL[idx]);
            if (x >= xm - k) set(x, y, PAL[Math.min(7, idx + 2)]);
          } else {
            // empty glass: dark and cool, with the far wall's faint reflection
            set(x, y, cyl < 0.2 ? [30, 38, 74] : cyl > 0.8 ? [10, 12, 30] : GLASS_IN);
            // a faint wisp of moonlight drifts through the empty glass, so the tube always looks alive
            if (cyl > 0.15 && cyl < 0.85) {
              const wisp = Math.sin((x / k) * 0.35 - t * 1.6 + Math.sin((y / k) * 0.8 + t * 0.9) * 1.4) * 0.5 + 0.5;
              if (wisp > 0.78) blend(x, y, LIQ[3], (wisp - 0.78) * 1.6);
            }
            if (x - xm < 2 * k && xf > x0) blend(x, y, LIQ[4], 0.3 * (1 - (x - xm) / (2 * k)));
            if ((x - x0) % Math.max(4, Math.round(len / 5)) === 0 && cyl > 0.55) set(x, y, [62, 74, 120]);
          }
          // the glass catches the light: a long broken highlight along the top, a faint one below
          const hl = Math.floor(ty0 + th * 0.2);
          if ((y === hl || (k > 2 && y === hl + 1)) && ((x - x0) % (11 * k)) < 8 * k && x > x0 + k) blend(x, y, [255, 255, 255], 0.72);
          if (y === Math.floor(ty0 + th * 0.78) && ((x - x0 + 5 * k) % (17 * k)) < 4 * k) blend(x, y, [190, 220, 255], 0.3);
        }
      }
      s.bubs = s.bubs.filter((b) => {
        const bx = Math.round(b.x), by = Math.round(b.y);
        if (by < ty0 + k || bx >= xf) { if (by < ty0 + k && bx < xf && bx > x0) set(bx, ty0 + 1, [255, 255, 255]); return false; }
        set(bx, by, [230, 250, 255]);
        if (k > 2) set(bx + 1, by, [200, 236, 255]);
        return true;
      });
      if (xf > x0 + 4 * k) for (let i = 0; i < 3; i++) {
        const sx = x0 + k + Math.floor(((t * 3.1 + i * 7.3) % 1) * (xf - x0 - 2 * k)), sy = ty0 + 2 * k + ((Math.floor(t * 5) + i * 3) % Math.max(1, th - 4 * k));
        if (Math.floor(t * 6 + i) % 3 === 0) { set(sx, sy, [255, 255, 255]); set(sx + 1, sy, [200, 240, 255]); set(sx - 1, sy, [200, 240, 255]); }
      }
      g.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [W, k]);
  const css = p.big ? 4 : 2;
  return <canvas ref={ref} class={'hh-magicbar px' + (p.big ? ' big' : '') + (p.class ? ' ' + p.class : '')} style={{ width: `${W * css}px`, height: `${H * css}px` }} aria-hidden="true" />;
}
