// Charts drawn into the book by hand: pencil lines with a little wobble, coloured-pencil hatching,
// ink dots and a red-pen circle round the latest night. They are painted at texel resolution on a
// canvas (so they are pixel art like the rest of the book) with the labels set in the book's font.
import { useEffect, useRef } from 'preact/hooks';
import type { Night } from './stats.ts';
import { dayMin, eveningMin, scoreInk } from './stats.ts';
import { BLUE, GRAPHITE, INK, Px, RED } from '../px/bookart.js';

export interface Label { x: number; y: number; text: string; align?: 'l' | 'c' | 'r'; color?: string; small?: boolean; up?: boolean }

const hexc = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hash = (x: number, y: number) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** A texel canvas with pencil tools. */
export class Ink {
  p: Px;
  constructor(public w: number, public h: number) { this.p = new Px(w, h); }
  dot(x: number, y: number, c: string, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.p.d, k = hexc(c);
    const sa = a / 255, da = d[i + 3] / 255, oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    for (let j = 0; j < 3; j++) d[i + j] = Math.round((k[j] * sa + d[i + j] * da * (1 - sa)) / oa);
    d[i + 3] = Math.round(oa * 255);
  }
  /** a pencil stroke: Bresenham with grain (a few texels skipped or lighter) */
  line(x0: number, y0: number, x1: number, y1: number, c = GRAPHITE, a = 220, grain = 0.12) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      const g = hash(x0, y0);
      if (g > grain) this.dot(x0, y0, c, g < grain * 2.5 ? a * 0.55 : a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
  }
  dashed(x0: number, y0: number, x1: number, y1: number, c: string, a = 200, on = 3, off = 2) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) if (i % (on + off) < on) this.dot(x0 + ((x1 - x0) * i) / Math.max(1, n), y0 + ((y1 - y0) * i) / Math.max(1, n), c, a);
  }
  disc(cx: number, cy: number, r: number, c: string, a = 255) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r + 0.15) this.dot(x, y, c, a); }
  ring(cx: number, cy: number, r: number, c: string, a = 230) { const n = Math.ceil(r * 7); for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2.1 - 0.3, w = 1 + Math.sin(i * 1.7) * 0.06; this.dot(cx + Math.cos(t) * r * w, cy + Math.sin(t) * r * 0.85 * w, c, a); } }
  /** coloured-pencil hatching inside a rect (diagonal strokes) */
  hatch(x: number, y: number, w: number, h: number, c: string, a = 150, step = 3) {
    for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) if (((i + j) % step + step) % step === 0 || hash(i, j) < 0.08) this.dot(i, j, c, a);
  }
  /** hatch under a polyline down to `base` */
  hatchUnder(pts: [number, number][], base: number, c: string, a = 110, step = 3) {
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      for (let x = Math.ceil(x0); x <= x1; x++) {
        const t = (x - x0) / Math.max(1, x1 - x0), top = y0 + (y1 - y0) * t;
        for (let y = Math.ceil(top) + 1; y < base; y++) if (((x - y) % step + step) % step === 0) this.dot(x, y, c, a);
      }
    }
  }
}

/** Mounts an Ink drawing (texel canvas scaled by T) plus its DOM labels. */
export function Chart(p: { w: number; h: number; T: number; draw: (g: Ink) => Label[]; dep: string; class?: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tw = Math.max(20, Math.floor(p.w / p.T)), th = Math.max(10, Math.floor(p.h / p.T));
  const g = new Ink(tw, th);
  const labels = p.draw(g);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = tw; cv.height = th;
    cv.getContext('2d')?.putImageData(new ImageData(g.p.d, tw, th), 0, 0);
  }, [p.dep, tw, th]);
  return (
    <div class={'bk-chart ' + (p.class ?? '')} style={{ width: `${tw * p.T}px`, height: `${th * p.T}px` }} role="img" aria-label={p.label}>
      <canvas ref={ref} style={{ width: `${tw * p.T}px`, height: `${th * p.T}px` }} />
      {labels.map((l) => (
        <span class={'bk-cl' + (l.small ? ' s' : '') + (l.align === 'r' ? ' r' : l.align === 'c' ? ' c' : '') + (l.up ? ' up' : '')} style={{ left: `${l.x * p.T}px`, top: `${l.y * p.T}px`, color: l.color }}>{l.text}</span>
      ))}
    </div>
  );
}

const shortDate = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });

/** Sleep score over the last nights: pencil line, hatched area, coloured dots, red ring on the latest. */
export function scoreTrend(nights: Night[]) {
  return (g: Ink): Label[] => {
    const L = 14, R = g.w - 6, top = 6, bot = g.h - 9;
    const list = nights.slice(-21);
    const lo = Math.max(0, Math.min(50, Math.floor((Math.min(100, ...list.map((n) => n.report.score)) - 12) / 10) * 10));
    const yOf = (s: number) => bot - ((s - lo) / (100 - lo)) * (bot - top);
    // axes and guides
    g.line(L, top - 2, L, bot, GRAPHITE, 170, 0.05);
    g.line(L, bot, R, bot, GRAPHITE, 170, 0.05);
    const mid = Math.round((lo + 100) / 20) * 10;
    for (const s of [mid, 100]) g.dashed(L + 2, yOf(s), R, yOf(s), GRAPHITE, 90, 2, 3);
    const labels: Label[] = [{ x: L - 2, y: yOf(100), text: '100', align: 'r', small: true, color: '#7a5a3c' }, { x: L - 2, y: yOf(mid), text: String(mid), align: 'r', small: true, color: '#7a5a3c' }, { x: L - 2, y: bot - 4, text: String(lo), align: 'r', small: true, color: '#7a5a3c' }];
    if (list.length < 2) {
      g.dashed(L + 4, yOf(60), R - 4, yOf(72), GRAPHITE, 70, 1, 3);
      labels.push({ x: (L + R) / 2, y: yOf(40), text: list.length ? 'one more night to draw a line' : 'a line appears after two nights', align: 'c', small: true, color: '#7a5a3c' });
      if (list.length) g.disc(L + 6, yOf(list[0].report.score), 1.6, scoreInk(list[0].report.score));
      return labels;
    }
    const xOf = (i: number) => L + 4 + (i / (list.length - 1)) * (R - L - 8);
    const pts = list.map((n, i) => [Math.round(xOf(i)), Math.round(yOf(n.report.score))] as [number, number]);
    g.hatchUnder(pts, bot, BLUE, 60, 4);
    for (let i = 1; i < pts.length; i++) g.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], INK, 235, 0.06);
    list.forEach((n, i) => g.disc(pts[i][0], pts[i][1], 1.5, scoreInk(n.report.score)));
    const [lx, ly] = pts[pts.length - 1];
    g.ring(lx, ly, 4.2, RED);
    labels.push({ x: lx, y: ly - 6, text: String(list[list.length - 1].report.score), align: 'c', color: RED, up: true });
    labels.push({ x: L + 4, y: bot + 1, text: shortDate(list[0].start), small: true, color: '#7a5a3c' });
    labels.push({ x: R, y: bot + 1, text: shortDate(list[list.length - 1].start), align: 'r', small: true, color: '#7a5a3c' });
    return labels;
  };
}

/** Hours asleep for the last seven days against the goal (dashed red line). */
export function weekBars(week: { day: Date; night?: Night }[], goalMin: number) {
  return (g: Ink): Label[] => {
    const L = 4, R = g.w - 4, top = 9, bot = g.h - 9, max = 11;
    const yOf = (h: number) => bot - (h / max) * (bot - top);
    g.line(L, bot, R, bot, GRAPHITE, 170, 0.05);
    const labels: Label[] = [];
    const slot = (R - L) / 7, bw = Math.max(4, Math.round(slot * 0.56));
    week.forEach((d, i) => {
      const cx = L + slot * (i + 0.5), x0 = Math.round(cx - bw / 2);
      const letter = d.day.toLocaleDateString([], { weekday: 'narrow' });
      labels.push({ x: cx, y: bot + 1, text: letter, align: 'c', small: true, color: '#7a5a3c' });
      if (!d.night) { g.dashed(x0, bot - 1, x0 + bw - 1, bot - 1, GRAPHITE, 90, 1, 1); return; }
      const hrs = d.night.report.asleep / 3.6e6, y = Math.round(yOf(Math.min(max, hrs)));
      const col = scoreInk(d.night.report.score);
      g.hatch(x0 + 1, y + 1, bw - 2, bot - y - 1, col, 170, 3);
      g.line(x0, bot, x0, y, INK, 220); g.line(x0, y, x0 + bw - 1, y, INK, 220); g.line(x0 + bw - 1, y, x0 + bw - 1, bot, INK, 220);
      labels.push({ x: cx, y: y - 1, text: hrs.toFixed(1).replace('.0', ''), align: 'c', small: true, up: true, color: INK });
    });
    const gy = Math.round(yOf(goalMin / 60));
    g.dashed(L, gy, R, gy, RED, 210, 4, 2);
    labels.push({ x: R, y: gy - 1, text: `goal ${Math.round((goalMin / 60) * 10) / 10}h`, align: 'r', small: true, up: true, color: RED });
    return labels;
  };
}

const clock = (d: Date, h12: boolean) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: h12 }).replace(':00', '');

/** Each night's bedtime (moons) and wake time (suns) on two pencil strips. */
export function timeStrips(nights: Night[], h12: boolean) {
  return (g: Ink): Label[] => {
    const L = 30, R = g.w - 6, rows = [Math.round(g.h * 0.3), Math.round(g.h * 0.78)];
    const labels: Label[] = [{ x: 0, y: rows[0] - 4, text: 'asleep', small: true, color: '#7a5a3c' }, { x: 0, y: rows[1] - 4, text: 'awake', small: true, color: '#7a5a3c' }];
    const bed = nights.map((n) => eveningMin(n.report.asleepAt)), wake = nights.map((n) => dayMin(n.report.wokeAt));
    const strip = (vals: number[], row: number, lo: number, hi: number, toDate: (m: number) => Date, col: string) => {
      g.line(L, row, R, row, GRAPHITE, 150, 0.05);
      const xOf = (m: number) => L + ((Math.max(lo, Math.min(hi, m)) - lo) / (hi - lo)) * (R - L);
      for (let m = Math.ceil(lo / 60) * 60; m <= hi; m += 60) { g.line(xOf(m), row - 2, xOf(m), row + 2, GRAPHITE, 150, 0); }
      labels.push({ x: xOf(lo), y: row + 3, text: clock(toDate(lo), h12), small: true, color: '#7a5a3c' });
      labels.push({ x: xOf(hi), y: row + 3, text: clock(toDate(hi), h12), align: 'r', small: true, color: '#7a5a3c' });
      vals.forEach((v) => g.disc(xOf(v), row - 4, 1.6, col, 200));
      if (vals.length) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length, ax = xOf(avg);
        g.line(ax, row - 9, ax, row + 1, RED, 230, 0); g.line(ax - 2, row - 3, ax, row + 1, RED, 230, 0); g.line(ax + 2, row - 3, ax, row + 1, RED, 230, 0);
        labels.push({ x: ax, y: row - 10, text: clock(toDate(avg), h12), align: 'c', small: true, up: true, color: RED });
      }
    };
    const bLo = Math.min(180, ...bed.map((v) => Math.floor(v / 60) * 60)), bHi = Math.max(bLo + 240, ...bed.map((v) => Math.ceil(v / 60) * 60));
    const wLo = Math.min(360, ...wake.map((v) => Math.floor(v / 60) * 60)), wHi = Math.max(wLo + 240, ...wake.map((v) => Math.ceil(v / 60) * 60));
    strip(bed, rows[0], bLo, bHi, (m) => { const d = new Date(2020, 0, 1, 18, 0); d.setMinutes(d.getMinutes() + m); return d; }, BLUE);
    strip(wake, rows[1], wLo, wHi, (m) => new Date(2020, 0, 1, 0, m), '#c07a18');
    return labels;
  };
}

export const STAGE_INK = { deep: '#2b3d8f', light: '#5a8ed0', rem: '#7a4cb0', awake: '#d08a2a' };
/** The night's make-up as one hatched bar. */
export function stageBar(parts: { deep: number; light: number; rem: number; awake: number }) {
  return (g: Ink): Label[] => {
    const L = 1, R = g.w - 2, top = 2, bot = g.h - 2;
    const total = parts.deep + parts.light + parts.rem + parts.awake || 1;
    let x = L;
    for (const k of ['deep', 'light', 'rem', 'awake'] as const) {
      const w = Math.round(((parts[k] / total) * (R - L)));
      if (w <= 0) continue;
      g.hatch(x, top, w, bot - top, STAGE_INK[k], 190, 2);
      g.line(x + w, top, x + w, bot, INK, 160, 0);
      x += w;
    }
    g.line(L, top, R, top, INK, 220); g.line(L, bot, R, bot, INK, 220); g.line(L, top, L, bot, INK, 220); g.line(R, top, R, bot, INK, 220);
    return [];
  };
}
