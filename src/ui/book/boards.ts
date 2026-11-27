// What the briefing room shows, painted on canvases: the numbers worked out from the save (Brief), the rolling
// whiteboard (a glossy board with ghosts of old meetings, and this week in marker: hand-lettered numbers, a hatched
// bar chart, doodles), sticky notes, and the projector's slides (clean keynote charts: hours, score, the make-up of
// a night, bed and wake times) with a projector's soft hot spot. With no nights yet everything shows a clearly
// labelled sample week.
import type { Save } from '../../game/store.ts';
import { STACK, textSafe } from '../font.ts';
import { averages, eveningMin, dayMin, fromDay, fromEvening, reported, statNights, type Averages, type Night } from './stats.ts';

export type SlideId = 'hours' | 'score' | 'stages' | 'window';
export const SLIDES: { id: SlideId; name: string; title: string }[] = [
  { id: 'hours', name: 'Hours', title: 'Hours asleep' },
  { id: 'score', name: 'Score', title: 'Sleep score' },
  { id: 'stages', name: 'Stages', title: 'What a night is made of' },
  { id: 'window', name: 'Bed & wake', title: 'Bedtime and wake-up' },
];

export interface Day { day: Date; night?: Night }
export interface Brief {
  /** no nights at all: everything below is a made-up sample week */
  sample: boolean;
  /** only pretend (demo) nights so far */
  demo: boolean;
  nights: Night[];
  days14: Day[];
  week: Day[];
  /** the last 7 days' nights (null when none) and the 7 before them */
  wk: Averages | null;
  prev: Averages | null;
  all: Averages;
  goalMin: number;
  streak: number;
  best?: Night;
  /** spread of the time you fell asleep over the last 7 nights (minutes, standard deviation) */
  bedSpread: number | null;
  h12: boolean;
  name: string;
  /** "Nov 21 – 27" */
  range: string;
}

const DAY = 86_400_000;
const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const sd = (a: number[]) => { if (a.length < 2) return null; const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
export const hm = (ms: number) => { const m = Math.max(0, Math.round(ms / 60_000)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
export const clockOf = (d: Date, h12: boolean) => { const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0'); return h12 ? `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}` : `${String(h).padStart(2, '0')}:${m}`; };
/** a goal as "8h" or "7h 30m" */
export const goalTxt = (min: number) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`; };
const hourLabel = (h: number, h12: boolean) => { h = ((h % 24) + 24) % 24; return h12 ? `${h % 12 || 12} ${h < 12 ? 'am' : 'pm'}` : `${String(h).padStart(2, '0')}:00`; };

/** days ending today, oldest first, each with the night that ended on it */
function daysBack(nights: Night[], n: number, now: number): Day[] {
  const out: Day[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    out.push({ day: d, night: [...nights].reverse().find((x) => new Date(x.report.wokeAt ?? x.end ?? x.start).toDateString() === key) });
  }
  return out;
}

/** a believable sample fortnight (deterministic), for the empty briefing room */
export function sampleNights(now = Date.now()): Night[] {
  const out: Night[] = [];
  const hours = [7.2, 6.4, 7.8, 8.1, 6.9, 7.5, 8.4, 7.0, 6.2, 7.6, 8.0, 7.3, 7.9, 8.2];
  const bed = [22.9, 23.6, 23.1, 22.8, 23.9, 23.2, 22.7, 23.4, 0.2, 23.0, 22.9, 23.3, 23.1, 22.8];
  for (let i = 0; i < 14; i++) {
    if (i === 4 || i === 9) continue; // a couple of untracked nights
    const d = new Date(now); d.setDate(d.getDate() - (13 - i)); d.setHours(0, 0, 0, 0);
    const b = bed[i], asleepAt = d.getTime() + (b < 12 ? b + 24 : b) * 3.6e6 - DAY;
    const asleep = hours[i] * 3.6e6, wokeAt = asleepAt + asleep + 12 * 60_000;
    const k = (i * 37) % 11 / 10, score = Math.round(58 + hours[i] * 3.6 + k * 8);
    const deep = 0.16 + k * 0.08, rem = 0.19 + ((i * 13) % 7) / 100, awake = 0.05 + ((i * 7) % 5) / 100;
    out.push({
      id: 'sample' + i, start: asleepAt - 14 * 60_000, end: wokeAt, smartWindowMin: 20, micUsed: true, epochs: [], events: [], simulated: true,
      report: { score: Math.min(96, score), inBed: wokeAt - asleepAt + 14 * 60_000, asleep, asleepAt, wokeAt, latencyMin: 8 + (i % 4) * 4, efficiency: 0.86 + k * 0.08, deep, light: 1 - deep - rem - awake, rem, awake, awakenings: i % 3, snoreMin: (i % 5) * 3, talkCount: i % 2, loudestDb: 60, avgDb: 30, quality: 'good', notes: [] },
    });
  }
  return out;
}

export function briefOf(s: Save, now = Date.now()): Brief {
  const st = statNights(s);
  const sample = reported(s).length === 0;
  const nights = sample ? sampleNights(now) : st.nights;
  const days14 = daysBack(nights, 14, now), week = days14.slice(7);
  const inWeek = week.map((d) => d.night).filter((n): n is Night => !!n);
  const before = days14.slice(0, 7).map((d) => d.night).filter((n): n is Night => !!n);
  const recent = days14.map((d) => d.night).filter((n): n is Night => !!n);
  const best = recent.reduce<Night | undefined>((a, n) => (!a || n.report.score > a.report.score ? n : a), undefined);
  const a = week[0].day, b = week[6].day;
  const mon = (d: Date) => d.toLocaleDateString([], { month: 'short' });
  const range = a.getMonth() === b.getMonth() ? `${mon(a)} ${a.getDate()} – ${b.getDate()}` : `${mon(a)} ${a.getDate()} – ${mon(b)} ${b.getDate()}`;
  return {
    sample, demo: !sample && st.demo, nights, days14, week,
    wk: inWeek.length ? averages(inWeek) : null, prev: before.length ? averages(before) : null, all: averages(nights),
    goalMin: s.sleep.goalMin, streak: sample ? 4 : s.streak, best,
    bedSpread: sd(inWeek.map((n) => eveningMin(n.report.asleepAt))),
    h12: s.settings.hour12, name: s.name, range,
  };
}

// ------------------------------------------------------------------ marker on a whiteboard

const MARK = { blue: '#1f4fa6', red: '#c4302b', green: '#1d7b45', black: '#23252b' };
/** a small seeded random */
function rnd(seed: number) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 10000) / 10000; }; }

/** a marker line through points, gently wobbling, with a drier second pass (the felt tip's streaks) */
function mline(g: CanvasRenderingContext2D, pts: [number, number][], col: string, w: number, seed = 1, wob = 1.6) {
  const r = rnd(seed), dense: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 26));
    for (let k = 0; k < n; k++) dense.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  dense.push(pts[pts.length - 1]);
  const path = dense.map(([x, y], i) => [x + (i && i < dense.length - 1 ? (r() - 0.5) * wob : 0), y + (i && i < dense.length - 1 ? (r() - 0.5) * wob : 0)] as [number, number]);
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = col;
  for (const [a, lw] of [[0.92, w], [0.35, w * 0.55]] as const) {
    g.globalAlpha = a; g.lineWidth = lw;
    g.beginPath(); path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  }
  g.restore();
}
/** hand-lettered marker text: each letter a touch rotated and off the line, like a careful hand */
function mtext(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, col: string, o: { align?: 'left' | 'center' | 'right'; seed?: number; weight?: number; rot?: number } = {}) {
  const s = textSafe(text), r = rnd(o.seed ?? s.length * 31 + Math.round(x));
  g.save();
  g.font = `${o.weight ?? 800} ${size}px ${STACK}`;
  g.textBaseline = 'alphabetic';
  const total = g.measureText(s).width;
  let cx = o.align === 'center' ? x - total / 2 : o.align === 'right' ? x - total : x;
  g.translate(cx, y); g.rotate(o.rot ?? 0); g.translate(-cx, -y);
  g.fillStyle = col;
  for (const ch of s) {
    const w = g.measureText(ch).width;
    g.save();
    g.translate(cx + w / 2, y + (r() - 0.5) * size * 0.04);
    g.rotate((r() - 0.5) * 0.06);
    g.globalAlpha = 0.9 + r() * 0.08;
    g.fillText(ch, -w / 2, 0);
    g.restore();
    cx += w;
  }
  g.restore();
  return total;
}
function underline(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, col: string, w: number, seed: number) {
  mline(g, [[x0, y + 2], [(x0 + x1) / 2, y - 3], [x1, y + 4]], col, w, seed, 3);
}
/** a hand-drawn loop round a box (overshooting where the pen started) */
function loop(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, col: string, w: number, seed: number) {
  const pts: [number, number][] = [], r = rnd(seed);
  for (let i = 0; i <= 26; i++) { const a = -2.2 + (i / 24) * Math.PI * 2, k = 1 + (r() - 0.5) * 0.06; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  mline(g, pts, col, w, seed, 2);
}
function star(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, seed: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  mline(g, pts, col, r * 0.16, seed, 1.5);
}
function flame(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, col: string, seed: number) {
  mline(g, [[cx, cy + s], [cx - s * 0.62, cy + s * 0.2], [cx - s * 0.25, cy - s * 0.55], [cx - s * 0.05, cy - s * 1.05], [cx + s * 0.35, cy - s * 0.35], [cx + s * 0.6, cy + s * 0.25], [cx, cy + s]], col, s * 0.15, seed, 1.2);
  mline(g, [[cx, cy + s * 0.75], [cx - s * 0.22, cy + s * 0.3], [cx + s * 0.05, cy - s * 0.15], [cx + s * 0.25, cy + s * 0.35], [cx, cy + s * 0.75]], col, s * 0.11, seed + 3, 1);
}
function clockDoodle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, seed: number) {
  loop(g, cx, cy, r, r, col, r * 0.13, seed);
  mline(g, [[cx, cy], [cx, cy - r * 0.6]], col, r * 0.12, seed + 1, 0.5);
  mline(g, [[cx, cy], [cx + r * 0.45, cy + r * 0.12]], col, r * 0.12, seed + 2, 0.5);
}
function arrow(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, w: number, seed: number) {
  mline(g, [[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - 8], [x1, y1]], col, w, seed, 2);
  const a = Math.atan2(y1 - y0, x1 - x0), h = w * 3.4;
  mline(g, [[x1 - Math.cos(a - 0.5) * h, y1 - Math.sin(a - 0.5) * h], [x1, y1], [x1 - Math.cos(a + 0.5) * h, y1 - Math.sin(a + 0.5) * h]], col, w, seed + 1, 1);
}

/** The board's own surface: glossy white enamel with faint ghosts of old meetings (no ink of this week). */
export function paintBoardBase(c: HTMLCanvasElement) {
  const W = c.width, H = c.height, g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#f7f8f6'); bg.addColorStop(0.55, '#eef0ee'); bg.addColorStop(1, '#e6e9e7');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const r = rnd(77);
  // ghosts: half-erased words and swirls of the eraser
  g.save();
  g.filter = 'blur(6px)';
  for (let i = 0; i < 14; i++) {
    g.globalAlpha = 0.035 + r() * 0.05;
    g.fillStyle = i % 3 ? '#7f8d9e' : '#b07a7a';
    g.beginPath(); g.ellipse(r() * W, r() * H, 60 + r() * 190, 12 + r() * 30, (r() - 0.5) * 0.4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
  g.save();
  g.globalAlpha = 0.06; g.font = `800 64px ${STACK}`; g.fillStyle = '#5a6a80';
  g.translate(W * 0.58, H * 0.2); g.rotate(-0.04); g.fillText('Q3 nap targets', 0, 0);
  g.restore();
  g.save();
  g.globalAlpha = 0.05; g.strokeStyle = '#5a6a80'; g.lineWidth = 7; g.lineCap = 'round';
  for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x < 360; x += 12) g.lineTo(W * 0.1 + x, H * 0.82 + Math.sin(x * 0.05 + k) * 18 + k * 30); g.stroke(); }
  g.restore();
  // a soft sheen across the top and the frame's shadow at the edges
  const sh = g.createLinearGradient(0, 0, 0, H * 0.4);
  sh.addColorStop(0, 'rgba(255,255,255,0.55)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H * 0.4);
  const ed = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.72);
  ed.addColorStop(0, 'rgba(60,70,80,0)'); ed.addColorStop(1, 'rgba(60,70,80,0.14)');
  g.fillStyle = ed; g.fillRect(0, 0, W, H);
}

/** This week in marker (transparent canvas laid on the board). Returns spots worth pointing at (u, v). */
export function paintBoardInk(c: HTMLCanvasElement, b: Brief): [number, number][] {
  const W = c.width, H = c.height, g = c.getContext('2d')!, k = W / 1536;
  g.clearRect(0, 0, W, H);
  g.save(); g.scale(k, k);
  const wk = b.wk, goalMs = b.goalMin * 60_000;
  // header
  const tw = mtext(g, b.sample ? 'Sample week' : 'This week', 84, 128, 88, MARK.blue, { seed: 3, rot: -0.012 });
  underline(g, 80, 84 + tw + 14, 150, MARK.blue, 7, 4);
  mtext(g, b.range, 84 + tw + 44, 124, 44, MARK.black, { seed: 5, weight: 700 });
  if (b.sample) mtext(g, 'not real yet: sleep with Pip!', 84 + tw + 44, 170, 32, MARK.red, { seed: 6, weight: 700 });
  else if (b.demo) mtext(g, 'pretend nights', 84 + tw + 44, 170, 32, MARK.red, { seed: 6, weight: 700 });

  // the big number
  mtext(g, 'average sleep', 92, 246, 42, MARK.black, { seed: 7, weight: 700 });
  const big = wk ? hm(wk.asleep) : '–';
  const bw = mtext(g, big, 92, 392, 140, MARK.blue, { seed: 8 });
  if (wk && wk.asleep >= goalMs * 0.97) {
    loop(g, 92 + bw / 2, 346, bw / 2 + 40, 92, MARK.red, 7, 9);
    mtext(g, 'goal met!', 92 + bw + 50, 300, 40, MARK.red, { seed: 10, rot: -0.08 });
  } else if (wk) {
    mtext(g, `goal ${goalTxt(b.goalMin)}`, 92 + bw + 36, 372, 40, MARK.red, { seed: 10, rot: -0.05 });
  }
  if (wk && b.prev) {
    const d = Math.round((wk.asleep - b.prev.asleep) / 60_000);
    if (Math.abs(d) >= 5) {
      const up = d > 0;
      arrow(g, 104, 470, 154, up ? 432 : 500, up ? MARK.green : MARK.red, 6, 11);
      mtext(g, `${up ? '+' : '−'}${Math.abs(d)} min vs last week`, 176, 474, 38, up ? MARK.green : MARK.red, { seed: 12, weight: 700 });
    }
  }

  // score and streak
  mtext(g, 'score', 96, 574, 38, MARK.black, { seed: 13, weight: 700 });
  const sv = wk ? String(Math.round(wk.score)) : '–';
  const sw = mtext(g, sv, 92, 686, 104, MARK.green, { seed: 14 });
  if (wk && wk.score >= 75) star(g, 92 + sw + 46, 640, 30, MARK.green, 15);
  mtext(g, 'streak', 392, 574, 38, MARK.black, { seed: 16, weight: 700 });
  const kw = mtext(g, String(b.streak), 392, 686, 104, MARK.red, { seed: 17 });
  mtext(g, b.streak === 1 ? 'night' : 'nights', 392 + kw + 16, 684, 40, MARK.red, { seed: 18, weight: 700 });
  if (b.streak >= 2) flame(g, 392 + kw + 150, 640, 30, MARK.red, 19);

  // bedtime
  clockDoodle(g, 124, 806, 32, MARK.black, 20);
  const avgBed = wk ? clockOf(fromEvening(wk.bedtime), b.h12) : '–';
  mtext(g, `asleep ≈ ${avgBed}`, 178, 822, 50, MARK.black, { seed: 21 });
  if (b.bedSpread !== null) {
    const steady = b.bedSpread <= 30;
    mtext(g, `± ${Math.round(b.bedSpread)} min ${steady ? '· steady!' : '· try a steadier bedtime'}`, 180, 880, 38, steady ? MARK.green : MARK.red, { seed: 22, weight: 700 });
  }
  if (b.best) {
    const d = new Date(b.best.report.wokeAt);
    mtext(g, `best night: ${d.toLocaleDateString([], { weekday: 'short' })} · ${hm(b.best.report.asleep)} · ${b.best.report.score}`, 96, 960, 38, MARK.blue, { seed: 23, weight: 700 });
  }

  // the week in hatched bars
  const X0 = 800, X1 = 1450, Y0 = 290, Y1 = 830;
  mtext(g, 'hours a night', X0, 246, 40, MARK.black, { seed: 24, weight: 700 });
  mline(g, [[X0, Y0 - 10], [X0, Y1], [X1, Y1 + 4]], MARK.black, 6, 25, 2);
  const maxH = Math.max(10, ...b.week.map((d) => (d.night ? d.night.report.asleep / 3.6e6 + 0.8 : 0)));
  const yOf = (h: number) => Y1 - (h / maxH) * (Y1 - Y0);
  const slot = (X1 - X0 - 20) / 7, bwid = slot * 0.56;
  const pts: [number, number][] = [];
  b.week.forEach((d, i) => {
    const cx = X0 + 20 + slot * (i + 0.5);
    mtext(g, d.day.toLocaleDateString([], { weekday: 'narrow' }), cx, Y1 + 58, 40, MARK.black, { align: 'center', seed: 30 + i, weight: 700 });
    if (!d.night) { mline(g, [[cx - 12, Y1 - 14], [cx + 12, Y1 - 14]], '#8b93a0', 5, 40 + i, 1); return; }
    const h = d.night.report.asleep / 3.6e6, top = yOf(h), x0 = cx - bwid / 2, x1 = cx + bwid / 2;
    const col = d.night.report.asleep >= goalMs * 0.97 ? MARK.green : MARK.blue;
    mline(g, [[x0, Y1], [x0, top], [x1, top], [x1, Y1]], col, 6, 50 + i, 2.2);
    g.save(); g.beginPath(); g.rect(x0 + 3, top + 3, bwid - 6, Y1 - top - 3); g.clip();
    for (let y = top - bwid; y < Y1 + bwid; y += 22) mline(g, [[x0, y + bwid], [x1, y]], col, 4, 60 + i + Math.round(y), 1);
    g.restore();
    mtext(g, h.toFixed(1), cx, top - 16, 34, col, { align: 'center', seed: 70 + i, weight: 700 });
    pts.push([cx / 1536, top / 1024]);
  });
  const gy = yOf(b.goalMin / 60);
  for (let x = X0 + 8; x < X1 - 20; x += 44) mline(g, [[x, gy], [x + 24, gy + 1]], MARK.red, 5, 80 + x, 0.8);
  mtext(g, 'goal', X1 + 6, gy + 11, 30, MARK.red, { seed: 90, weight: 700 });
  g.restore();
  // dry felt: fine streaks where the marker ran thin
  g.save();
  g.globalCompositeOperation = 'destination-out';
  const r = rnd(5);
  for (let y = 0; y < H; y += 2) { g.globalAlpha = r() * 0.16; g.fillRect(0, y, W, 1); }
  g.restore();
  return [[0.2, 0.34], [0.15, 0.62], [0.33, 0.62], ...pts];
}

/** A square sticky note (with its own curl drawn in) carrying a short handwritten line. */
export function paintSticky(c: HTMLCanvasElement, lines: string[], tint: 'yellow' | 'pink' | 'mint') {
  const W = c.width, H = c.height, g = c.getContext('2d')!;
  const base = { yellow: ['#ffe680', '#f5d14e'], pink: ['#ffc2cf', '#f59bb0'], mint: ['#c6f0d2', '#97dcae'] }[tint];
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, base[0]); gr.addColorStop(1, base[1]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, W, H * 0.09); // the gummed strip
  const sz = W * 0.16;
  lines.forEach((t, i) => mtext(g, t, W / 2, H * 0.36 + i * sz * 1.25, sz, i === 0 ? '#2b2b33' : '#4a3f5c', { align: 'center', seed: 300 + i * 7 + t.length, weight: i === 0 ? 800 : 700, rot: -0.02 }));
}

// ------------------------------------------------------------------ the projector's slides

const SL = { ink: '#1b2540', sub: '#666c79', grid: '#e4dfd4', faint: '#a9a397', deep: '#2c4a8c', light: '#6aa2d8', rem: '#8a5ab2', awake: '#e2a33e', good: '#3c8a4c', ok: '#2f6fb8', meh: '#c47c18', bad: '#b8343c', goal: '#c4302b' };
export const STAGE_COL = { deep: SL.deep, light: SL.light, rem: SL.rem, awake: SL.awake };
export const scoreCol = (s: number) => (s >= 85 ? SL.good : s >= 70 ? SL.ok : s >= 50 ? SL.meh : SL.bad);

function text(g: CanvasRenderingContext2D, t: string, x: number, y: number, size: number, col: string, o: { align?: CanvasTextAlign; weight?: number } = {}) {
  g.font = `${o.weight ?? 700} ${size}px ${STACK}`; g.fillStyle = col; g.textAlign = o.align ?? 'left'; g.textBaseline = 'alphabetic';
  g.fillText(textSafe(t), x, y);
  return g.measureText(textSafe(t)).width;
}
function frameSlide(g: CanvasRenderingContext2D, W: number, H: number, title: string, sub: string, idx: number, b: Brief) {
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fdfcf8'); bg.addColorStop(1, '#f2efe6');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = '#2c4a8c'; g.fillRect(90, 78, 14, 66);
  text(g, title, 126, 132, 62, SL.ink, { weight: 800 });
  text(g, sub, 126, 186, 32, SL.sub, { weight: 600 });
  g.fillStyle = SL.grid; g.fillRect(90, 926, W - 180, 3);
  text(g, 'Hollow & Co.  ·  Sleep briefing', 90, 968, 26, SL.faint, { weight: 700 });
  text(g, `${idx + 1} / ${SLIDES.length}`, W - 90, 968, 26, SL.faint, { align: 'right', weight: 700 });
  if (b.sample || b.demo) {
    g.save();
    g.translate(W - 250, 120); g.rotate(-0.06);
    g.strokeStyle = SL.goal; g.lineWidth = 5; g.globalAlpha = 0.85;
    g.strokeRect(-150, -46, 300, 80);
    text(g, b.sample ? 'SAMPLE DATA' : 'PRETEND NIGHTS', 0, 8, 34, SL.goal, { align: 'center', weight: 800 });
    g.restore();
  }
}
/** the lamp's hot spot and fall-off, and the faint weave of the screen */
function projectorLight(g: CanvasRenderingContext2D, W: number, H: number) {
  g.save();
  g.globalCompositeOperation = 'multiply';
  const v = g.createRadialGradient(W * 0.5, H * 0.46, H * 0.15, W * 0.5, H * 0.5, W * 0.62);
  v.addColorStop(0, '#ffffff'); v.addColorStop(0.7, '#f1ede6'); v.addColorStop(1, '#cfc9bf');
  g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.restore();
  g.save();
  g.globalAlpha = 0.035; g.fillStyle = '#000';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
  for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
  g.restore();
}
const dayTick = (d: Date) => d.toLocaleDateString([], { weekday: 'narrow' });

/** Paint one slide (1600 x 1000 design units, scaled to the canvas). Returns spots worth pointing at (u, v). */
export function paintSlide(c: HTMLCanvasElement, id: SlideId, b: Brief): [number, number][] {
  const g = c.getContext('2d')!, W = 1600, H = 1000, k = c.width / W;
  g.setTransform(k, 0, 0, k, 0, 0);
  const idx = SLIDES.findIndex((s) => s.id === id), poi: [number, number][] = [];
  const X0 = 170, X1 = 1500, Y0 = 250, Y1 = 830;
  const days = b.days14, slot = (X1 - X0) / days.length;
  const cx = (i: number) => X0 + slot * (i + 0.5);
  const recent = days.map((d) => d.night).filter((n): n is Night => !!n);
  const xLabels = () => days.forEach((d, i) => {
    text(g, dayTick(d.day), cx(i), Y1 + 44, 26, i === days.length - 1 ? SL.ink : SL.sub, { align: 'center', weight: 800 });
    text(g, String(d.day.getDate()), cx(i), Y1 + 76, 22, SL.faint, { align: 'center', weight: 700 });
  });
  if (id === 'hours') {
    const avg = recent.length ? mean(recent.map((n) => n.report.asleep)) : 0;
    frameSlide(g, W, H, 'Hours asleep', recent.length ? `Last 14 nights  ·  average ${hm(avg)}  ·  goal ${goalTxt(b.goalMin)}` : 'Last 14 nights', idx, b);
    const maxH = Math.max(10, Math.ceil(Math.max(0, ...recent.map((n) => n.report.asleep / 3.6e6)) + 1));
    const yOf = (h: number) => Y1 - (h / maxH) * (Y1 - Y0);
    for (let h = 0; h <= maxH; h += 2) { g.fillStyle = SL.grid; g.fillRect(X0, yOf(h) - 1, X1 - X0, 2); text(g, `${h}h`, X0 - 18, yOf(h) + 9, 24, SL.faint, { align: 'right', weight: 700 }); }
    const best = recent.reduce((a, n) => Math.max(a, n.report.asleep), 0);
    days.forEach((d, i) => {
      if (!d.night) { g.fillStyle = '#d9d3c6'; g.beginPath(); g.arc(cx(i), Y1 - 10, 6, 0, Math.PI * 2); g.fill(); return; }
      const h = d.night.report.asleep / 3.6e6, top = yOf(h), w = slot * 0.58, met = d.night.report.asleep >= b.goalMin * 60_000 * 0.97;
      const col = met ? SL.good : SL.ok, gr = g.createLinearGradient(0, top, 0, Y1);
      gr.addColorStop(0, col); gr.addColorStop(1, met ? '#5aa866' : '#5b8fcf');
      g.fillStyle = gr; g.beginPath(); g.roundRect(cx(i) - w / 2, top, w, Y1 - top, [10, 10, 0, 0]); g.fill();
      text(g, h.toFixed(1), cx(i), top - 14, 24, col, { align: 'center', weight: 800 });
      if (d.night.report.asleep === best || i === days.length - 1) poi.push([cx(i) / W, (top + 30) / H]);
    });
    const gy = yOf(b.goalMin / 60);
    g.save(); g.setLineDash([16, 12]); g.strokeStyle = SL.goal; g.lineWidth = 4; g.beginPath(); g.moveTo(X0, gy); g.lineTo(X1, gy); g.stroke(); g.restore();
    g.fillStyle = '#fdfcf8'; g.fillRect(X1 - 118, gy - 40, 118, 32);
    text(g, 'Goal', X1, gy - 14, 26, SL.goal, { align: 'right', weight: 800 });
    poi.push([(X1 - 60) / W, gy / H]);
    xLabels();
  } else if (id === 'score') {
    const pts = days.map((d, i) => (d.night ? { x: cx(i), s: d.night.report.score } : null)).filter((p): p is { x: number; s: number } => !!p);
    const avg = pts.length ? Math.round(mean(pts.map((p) => p.s))) : 0;
    frameSlide(g, W, H, 'Sleep score', pts.length ? `Last 14 nights  ·  average ${avg} out of 100` : 'Last 14 nights', idx, b);
    const yOf = (s: number) => Y1 - (s / 100) * (Y1 - Y0);
    const bands: [number, number, string, string][] = [[85, 100, 'rgba(60,138,76,0.08)', 'Wonderful'], [70, 85, 'rgba(47,111,184,0.07)', 'Good'], [50, 70, 'rgba(196,124,24,0.07)', 'Okay'], [0, 50, 'rgba(184,52,60,0.05)', 'Restless']];
    for (const [a, z, col, name] of bands) { g.fillStyle = col; g.fillRect(X0, yOf(z), X1 - X0, yOf(a) - yOf(z)); text(g, name, X0 - 18, (yOf(a) + yOf(z)) / 2 + 9, 22, SL.faint, { align: 'right', weight: 800 }); }
    if (pts.length) {
      const area = g.createLinearGradient(0, Y0, 0, Y1);
      area.addColorStop(0, 'rgba(44,74,140,0.22)'); area.addColorStop(1, 'rgba(44,74,140,0)');
      g.fillStyle = area; g.beginPath(); g.moveTo(pts[0].x, Y1); pts.forEach((p) => g.lineTo(p.x, yOf(p.s))); g.lineTo(pts[pts.length - 1].x, Y1); g.closePath(); g.fill();
      g.strokeStyle = SL.deep; g.lineWidth = 6; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, yOf(p.s)) : g.moveTo(p.x, yOf(p.s)))); g.stroke();
      g.save(); g.setLineDash([14, 12]); g.strokeStyle = SL.sub; g.lineWidth = 3; g.beginPath(); g.moveTo(X0, yOf(avg)); g.lineTo(X1, yOf(avg)); g.stroke(); g.restore();
      text(g, `avg ${avg}`, X1, yOf(avg) - 12, 24, SL.sub, { align: 'right', weight: 800 });
      let hi = pts[0], lo = pts[0];
      for (const p of pts) { if (p.s > hi.s) hi = p; if (p.s < lo.s) lo = p; }
      pts.forEach((p, i) => {
        const last = i === pts.length - 1;
        g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, yOf(p.s), last ? 17 : 13, 0, Math.PI * 2); g.fill();
        g.fillStyle = scoreCol(p.s); g.beginPath(); g.arc(p.x, yOf(p.s), last ? 12 : 9, 0, Math.PI * 2); g.fill();
        if (last || p === hi || p === lo) text(g, String(p.s), p.x, yOf(p.s) - 26, last ? 34 : 26, scoreCol(p.s), { align: 'center', weight: 800 });
      });
      for (const p of [pts[pts.length - 1], hi, lo]) poi.push([p.x / W, yOf(p.s) / H]);
    }
    xLabels();
  } else if (id === 'stages') {
    const a = recent.length ? averages(recent) : b.all;
    frameSlide(g, W, H, 'What a night is made of', recent.length ? `Average of the last ${recent.length} night${recent.length === 1 ? '' : 's'}` : 'Your average night', idx, b);
    const parts = [['deep', a.deep, 'Deep', 'The body’s repair shift'], ['light', a.light, 'Light', 'Most of the night, and that’s normal'], ['rem', a.rem, 'Dreaming (REM)', 'Memory and mood'], ['awake', a.awake, 'Awake', 'Brief wake-ups you rarely remember']] as const;
    const tot = parts.reduce((s, p) => s + p[1], 0) || 1;
    const DX = 470, DY = 560, R = 250, T = 96;
    let ang = -Math.PI / 2;
    for (const [key, v] of parts) {
      const sweep = (v / tot) * Math.PI * 2;
      g.strokeStyle = STAGE_COL[key]; g.lineWidth = T; g.lineCap = 'butt';
      g.beginPath(); g.arc(DX, DY, R - T / 2, ang + 0.012, ang + sweep - 0.012); g.stroke();
      const mid = ang + sweep / 2;
      poi.push([(DX + Math.cos(mid) * (R - T / 2)) / W, (DY + Math.sin(mid) * (R - T / 2)) / H]);
      ang += sweep;
    }
    text(g, hm(a.asleep), DX, DY + 6, 58, SL.ink, { align: 'center', weight: 800 });
    text(g, 'asleep', DX, DY + 50, 28, SL.sub, { align: 'center', weight: 700 });
    parts.forEach(([key, v, name, note], i) => {
      const y = 330 + i * 140, x = 860;
      g.fillStyle = STAGE_COL[key]; g.beginPath(); g.roundRect(x, y - 36, 44, 44, 10); g.fill();
      text(g, name, x + 70, y, 40, SL.ink, { weight: 800 });
      text(g, `${Math.round((v / tot) * 100)}%`, 1500, y, 44, STAGE_COL[key], { align: 'right', weight: 800 });
      text(g, note, x + 70, y + 42, 26, SL.sub, { weight: 600 });
      g.fillStyle = SL.grid; g.fillRect(x + 70, y + 66, 1500 - x - 70, 8);
      g.fillStyle = STAGE_COL[key]; g.fillRect(x + 70, y + 66, (1500 - x - 70) * (v / tot), 8);
    });
  } else {
    // bed & wake: each night a bar from falling asleep to waking, time running down the page
    const t0 = 20, t1 = 11 + 24; // 8 pm .. 11 am
    const sp = b.bedSpread;
    const lastWeek = recent.slice(-7);
    const avgBed = lastWeek.length ? clockOf(fromEvening(mean(lastWeek.map((n) => eveningMin(n.report.asleepAt)))), b.h12) : '';
    const avgWake = lastWeek.length ? clockOf(fromDay(mean(lastWeek.map((n) => dayMin(n.report.wokeAt)))), b.h12) : '';
    frameSlide(g, W, H, 'Bedtime and wake-up', lastWeek.length ? `Asleep around ${avgBed}${sp !== null ? ` (± ${Math.round(sp)} min)` : ''}  ·  up around ${avgWake}` : 'When you fall asleep and wake', idx, b);
    const yOf = (h: number) => Y0 + ((h - t0) / (t1 - t0)) * (Y1 - Y0);
    const hOf = (t: number) => { const d = new Date(t); let h = d.getHours() + d.getMinutes() / 60; if (h < 12) h += 24; return h; };
    for (let h = t0; h <= t1; h += 3) { g.fillStyle = SL.grid; g.fillRect(X0, yOf(h) - 1, X1 - X0, 2); text(g, hourLabel(h, b.h12), X0 - 18, yOf(h) + 9, 22, SL.faint, { align: 'right', weight: 700 }); }
    days.forEach((d, i) => {
      if (!d.night) return;
      const r = d.night.report, ya = yOf(Math.max(t0, Math.min(t1, hOf(r.asleepAt)))), yb = yOf(Math.max(t0, Math.min(t1, hOf(r.wokeAt)))), w = slot * 0.44;
      const gr = g.createLinearGradient(0, ya, 0, yb);
      gr.addColorStop(0, '#24386e'); gr.addColorStop(1, '#6a9ad6');
      g.fillStyle = gr; g.beginPath(); g.roundRect(cx(i) - w / 2, ya, w, Math.max(8, yb - ya), w / 2); g.fill();
      if (i === days.length - 1) { poi.push([cx(i) / W, ya / H], [cx(i) / W, yb / H]); }
    });
    xLabels();
  }
  projectorLight(g, W, H);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return poi.length ? poi : [[0.5, 0.5]];
}
