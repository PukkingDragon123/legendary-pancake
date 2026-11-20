// The bedside alarm clock, drawn as pixel art on a 64x72 canvas and scaled up crisp: twin brass
// bells with a hammer, a turned wooden case with growth rings, a brass bezel, a cream face with
// tonight's sleep shaded as a starry indigo arc, pixel numerals, live hands, and a golden alarm hand
// you drag round the dial (snaps to 5 minutes; passing 12 flips AM/PM naturally).
import { useEffect, useRef } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { haptic, useTick } from './kit.tsx';

const W = 64, H = 72, CX = 32, CY = 39;
const R = {
  wood: ['#3b2414', '#55331a', '#6b4220', '#8b5a2b', '#a86d38', '#c98f55'],
  gold: ['#7a4a12', '#b0661a', '#e5a320', '#ffd23f', '#ffe98a', '#fffbe0'],
  cream: ['#a88a6a', '#d4b894', '#eedcbc', '#f9efdc', '#fffaf0', '#ffffff'],
  night: ['#141a3a', '#26307a', '#36449a', '#4a5cb8', '#7f93e6', '#c8d4ff'],
};
const INK = '#2a1a14';
const GLYPH: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'], '6': ['###', '#..', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'], P: ['##.', '#.#', '##.', '#..', '#..'], M: ['#.#', '###', '###', '#.#', '#.#'],
};
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m: number) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const angOf = (min: number) => ((((min % 720) + 720) % 720) / 720) * Math.PI * 2;

function paint(g: CanvasRenderingContext2D, o: { now: number; wake: number; bed: number; ring: boolean; t: number }) {
  g.clearRect(0, 0, W, H);
  const px = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const disc = (cx: number, cy: number, r: number, f: (dx: number, dy: number, d: number) => string | null) => {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d <= r) { const c = f(dx, dy, d); if (c) px(x, y, c); }
    }
  };
  const line = (x0: number, y0: number, x1: number, y1: number, c: string) => {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) { px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  };
  const lit = (dx: number, dy: number, d: number, r: number) => { const l = (-dx * 0.6 - dy * 0.8) / Math.max(1, r); return l; };
  const shake = o.ring ? (Math.floor(o.t * 14) % 2 ? 1 : -1) : 0;

  // feet
  for (const sd of [-1, 1]) for (let i = 0; i < 6; i++) { px(CX + sd * (17 + i * 0.6), CY + 23 + i, i < 5 ? R.gold[2 + (i < 2 ? 1 : 0)] : R.gold[1]); px(CX + sd * (18 + i * 0.6), CY + 23 + i, R.gold[1]); }
  // bells and hammer
  for (const sd of [-1, 1]) {
    const bx = CX + sd * 17 + (sd < 0 ? -shake : shake), by = 13;
    disc(bx, by, 8.5, (dx, dy, d) => {
      if (dy > 3 + dx * sd * 0.2) return null;
      if (d > 7.6) return INK;
      const l = lit(dx, dy, d, 8);
      return R.gold[Math.max(1, Math.min(5, Math.round(3 + l * 2.4)))];
    });
    line(bx - sd * 4, by + 4, bx + sd * 3, by + 5, INK);
  }
  line(CX, 4, CX, 12, INK); px(CX - 1, 4, INK); px(CX + 1, 4, INK);
  for (let y = 5; y < 12; y++) px(CX, y, R.gold[3]);
  disc(CX + shake, 4, 2.2, (dx, dy, d) => (d > 1.6 ? INK : R.gold[4]));
  // handle arc
  for (let a = -2.4; a <= -0.74; a += 0.02) px(CX + Math.cos(a) * 26, CY - 2 + Math.sin(a) * 30, INK);
  for (let a = -2.38; a <= -0.76; a += 0.02) px(CX + Math.cos(a) * 25, CY - 2 + Math.sin(a) * 29, R.gold[3]);

  // case: turned wood with growth rings, lit from the top-left
  disc(CX, CY, 28, (dx, dy, d) => {
    if (d > 27.2) return INK;
    if (d > 24.6) {
      const l = lit(dx, dy, d, 28);
      const ring = Math.floor(d) % 2 ? -0.6 : 0;
      return R.wood[Math.max(0, Math.min(5, Math.round(3 + l * 2.2 + ring)))];
    }
    if (d > 23.8) return INK;
    if (d > 22.2) { const l = lit(dx, dy, d, 23); return R.gold[Math.max(1, Math.min(5, Math.round(3 + l * 2.6)))]; }
    return null;
  });
  // face
  disc(CX, CY, 22.2, (dx, dy) => R.cream[dy > 10 ? 2 : dy < -12 && dx < 0 ? 4 : 3]);
  // tonight's sleep: an indigo band from bedtime round to the wake time, sprinkled with stars
  const span = Math.min(720, ((o.wake - o.bed + 1440) % 1440) || 1440);
  const a0 = angOf(o.bed), sweep = (span / 720) * Math.PI * 2;
  disc(CX, CY, 21.5, (dx, dy, d) => {
    if (d < 14.6) return null;
    let a = Math.atan2(dx, -dy); if (a < 0) a += Math.PI * 2;
    let rel = a - a0; if (rel < 0) rel += Math.PI * 2;
    if (rel > sweep) return null;
    const star = (Math.floor(d * 3) * 7 + Math.floor(a * 40)) % 23 === 0;
    return star ? R.night[5] : R.night[d > 19.5 ? 2 : 3];
  });
  // hour marks and numerals
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, big = i % 3 === 0;
    const x1 = CX + Math.sin(a) * 21, y1 = CY - Math.cos(a) * 21;
    px(x1, y1, INK);
    if (big) px(CX + Math.sin(a) * 20, CY - Math.cos(a) * 20, INK);
  }
  const glyphs = (s: string, x: number, y: number, c: string) => {
    let cx = x;
    for (const ch of s) { const gl = GLYPH[ch]; if (gl) gl.forEach((row, ry) => row.split('').forEach((v, rx) => { if (v === '#') px(cx + rx, y + ry, c); })); cx += 4; }
  };
  glyphs('12', CX - 3, CY - 18, INK); glyphs('3', CX + 15, CY - 2, INK); glyphs('6', CX - 1, CY + 13, INK); glyphs('9', CX - 17, CY - 2, INK);
  // AM/PM plate
  g.fillStyle = '#3b2414'; g.fillRect(CX - 5, CY + 5, 11, 7);
  glyphs(o.wake >= 720 ? 'PM' : 'AM', CX - 3, CY + 6, R.gold[4]);
  // hands
  const ha = angOf(o.now), ma = ((o.now % 60) / 60) * Math.PI * 2, wa = angOf(o.wake);
  line(CX, CY, CX + Math.sin(ha) * 10, CY - Math.cos(ha) * 10, INK);
  line(CX + 1, CY, CX + 1 + Math.sin(ha) * 9, CY - Math.cos(ha) * 9, INK);
  line(CX, CY, CX + Math.sin(ma) * 15, CY - Math.cos(ma) * 15, INK);
  line(CX, CY, CX + Math.sin(wa) * 17, CY - Math.cos(wa) * 17, R.gold[1]);
  const kx = CX + Math.sin(wa) * 17.5, ky = CY - Math.cos(wa) * 17.5;
  disc(kx, ky, 2.9, (dx, dy, d) => (d > 2.2 ? INK : dx + dy < -0.5 ? R.gold[5] : R.gold[3]));
  disc(CX, CY, 1.9, (dx, dy, d) => (d > 1.3 ? INK : R.gold[4]));
}

export function WoodClock(p: { wake: string; bedtime: string; onChange?: (hhmm: string) => void; ringing?: boolean; size?: number; hour12: boolean }) {
  useTick(1000);
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ on: boolean; last: number }>({ on: false, last: toMin(p.wake) });
  const wake = toMin(p.wake), bed = toMin(p.bedtime);
  const k = Math.max(2, Math.floor((p.size ?? 256) / W));

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    let raf = 0;
    const draw = (ms: number) => {
      const d = new Date();
      paint(g, { now: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60, wake, bed, ring: !!p.ringing, t: ms / 1000 });
      if (p.ringing) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  });

  const setFromPointer = (e: PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - CX, y = ((e.clientY - r.top) / r.height) * H - CY;
    let a = Math.atan2(x, -y); if (a < 0) a += Math.PI * 2;
    const m12 = (Math.round(((a / (Math.PI * 2)) * 720) / 5) * 5) % 720;
    const prev = drag.current.last;
    const dist = (c: number) => { const d = Math.abs(c - prev) % 1440; return Math.min(d, 1440 - d); };
    const best = dist(m12) <= dist(m12 + 720) ? m12 : m12 + 720;
    if (best !== prev) {
      drag.current.last = best;
      if (best % 15 === 0) haptic(5);
      sound.play('clock_tick', { volume: 0.35, gap: 30 });
      p.onChange?.(toHHMM(best));
    }
  };
  const label = new Date(2020, 0, 1, Math.floor(wake / 60), wake % 60).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: p.hour12 });
  return (
    <div class={p.ringing ? 'shake' : ''} style={{ display: 'flex', justifyContent: 'center', touchAction: 'none' }}>
      <canvas ref={cv} width={W} height={H} class="px" role="img" aria-label={`Alarm set for ${label}. Drag the golden hand to change it.`}
        style={{ width: `${W * k}px`, height: `${H * k}px`, maxWidth: '100%', filter: 'drop-shadow(0 4px 0 rgba(20,10,4,.45))', cursor: p.onChange ? 'grab' : 'default' }}
        onPointerDown={(e) => { if (!p.onChange) return; drag.current.on = true; drag.current.last = wake; (e.currentTarget as Element).setPointerCapture(e.pointerId); setFromPointer(e); }}
        onPointerMove={(e) => { if (drag.current.on) setFromPointer(e); }}
        onPointerUp={() => { drag.current.on = false; }}
        onPointerCancel={() => { drag.current.on = false; }} />
    </div>
  );
}
