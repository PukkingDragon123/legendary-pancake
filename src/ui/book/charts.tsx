// Pixel-art charts for the diary: drawn at texel resolution on a canvas (hard edges, no
// anti-aliasing, no round shapes), shown at T CSS px per texel, with their labels set in the
// pixel font in the DOM. Stepped bars, stepped lines with square markers, a stepped hypnogram and
// a segmented stage bar.
import { useEffect, useRef } from 'preact/hooks';
import { P } from '../../gfx/palette.ts';
import type { Stage } from '../../sleep/types.ts';
import { hexOf, Px, SCORE_TINT } from './art.ts';
import type { Night } from './stats.ts';

export interface Label { x: number; y: number; text: string; align?: 'l' | 'c' | 'r'; color?: string; small?: boolean; up?: boolean }

/** A texel canvas with a few hard-edged tools. */
export class Ink extends Px {
  hline(x0: number, x1: number, y: number, c: number) { for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) this.set(x, Math.round(y), c); }
  vline(x: number, y0: number, y1: number, c: number) { for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++) this.set(Math.round(x), y, c); }
  dashH(x0: number, x1: number, y: number, c: number, on = 2, off = 2) { for (let x = Math.round(x0); x <= x1; x++) if ((x - Math.round(x0)) % (on + off) < on) this.set(x, Math.round(y), c); }
  box(x: number, y: number, w: number, h: number, c: number) { this.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), c); }
  /** a filled bar with a lit left edge, a shaded right edge and a 1px ink cap */
  bar(x: number, y: number, w: number, h: number, fill: number, ink: number) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    if (h <= 0) return;
    const lit = mixHex(fill, P.paper, 0.35), dark = mixHex(fill, ink, 0.4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let c = fill;
      if (i === 0) c = lit; else if (i === w - 1) c = dark;
      if ((i + j) % 4 === 0 && i > 0 && i < w - 1) c = mixHex(fill, dark, 0.5);   // a woven texture
      if (j === 0) c = ink;
      this.set(x + i, y + j, c);
    }
  }
}
const mixHex = (a: number, b: number, t: number) => {
  const ch = (h: number, s: number) => (h >> s) & 255, m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};
const INK = P.ink2, FAINT = P.straw, LABEL = hexOf(P.ink3);

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
    cv.getContext('2d')?.putImageData(new ImageData(g.d, tw, th), 0, 0);
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

/** Hours asleep on each of the last seven days: stepped bars coloured by score, the goal dashed. */
export function weekBars(week: { day: Date; night?: Night }[], goalMin: number) {
  return (g: Ink): Label[] => {
    const most = week.reduce((m, d) => Math.max(m, d.night ? d.night.report.asleep / 3.6e6 : 0), 0);
    const L = 2, R = g.w - 3, top = 6, bot = g.h - 10, max = Math.ceil(Math.max(goalMin / 60 + 1.5, most + 1));
    const yOf = (h: number) => Math.round(bot - (h / max) * (bot - top));
    // faint hour rules every 2 hours
    for (let h = 2; h < max; h += 2) g.dashH(L, R, yOf(h), FAINT, 1, 3);
    g.hline(L, R, bot + 1, INK);
    const labels: Label[] = [];
    const slot = (R - L) / 7, bw = Math.max(5, Math.round(slot * 0.58));
    week.forEach((d, i) => {
      const cx = L + slot * (i + 0.5), x0 = Math.round(cx - bw / 2);
      labels.push({ x: cx, y: bot + 2, text: d.day.toLocaleDateString([], { weekday: 'narrow' }), align: 'c', small: true, color: LABEL });
      if (!d.night) { g.dashH(x0, x0 + bw - 1, bot, P.pebble, 1, 1); return; }
      const hrs = d.night.report.asleep / 3.6e6, y = yOf(Math.min(max, hrs));
      const [fill, ink] = SCORE_TINT(d.night.report.score);
      g.bar(x0, y, bw, bot - y + 1, fill, ink);
      labels.push({ x: cx, y: y + 2, text: hrs.toFixed(1).replace('.0', ''), align: 'c', small: true, color: hexOf(P.paper) });
    });
    const gy = yOf(goalMin / 60);
    g.dashH(L, R, gy, P.terracotta, 3, 2);
    labels.push({ x: R, y: gy - 1, text: `goal ${Math.round((goalMin / 60) * 10) / 10}h`, align: 'r', small: true, up: true, color: hexOf(P.clay) });
    return labels;
  };
}

/** Score over recent nights as a stepped line with square markers; the latest gets a bracket. */
export function scoreSteps(nights: Night[]) {
  return (g: Ink): Label[] => {
    const L = 15, R = g.w - 4, top = 8, bot = g.h - 9;
    const list = nights.slice(-21);
    const lo = 30;
    const yOf = (s: number) => Math.round(bot - ((Math.max(lo, s) - lo) / (100 - lo)) * (bot - top));
    for (const s of [50, 70, 85]) g.dashH(L, R, yOf(s), FAINT, 1, 2);
    g.vline(L - 1, top - 2, bot, INK); g.hline(L - 1, R, bot + 1, INK);
    const labels: Label[] = [100, 70, 50].map((s) => ({ x: L - 3, y: yOf(s) - 3, text: String(s), align: 'r' as const, small: true, color: LABEL }));
    if (list.length < 2) {
      labels.push({ x: (L + R) / 2, y: (top + bot) / 2 - 2, text: list.length ? 'one more night to draw a line' : 'a line appears after two nights', align: 'c', small: true, color: LABEL });
      return labels;
    }
    const step = (R - L - 4) / (list.length - 1);
    const pts = list.map((n, i) => ({ x: Math.round(L + 2 + i * step), y: yOf(n.report.score), s: n.report.score }));
    // the stepped line: flat until halfway to the next night, then a hard step
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], xa = i ? Math.round((pts[i - 1].x + a.x) / 2) : a.x, xb = i < pts.length - 1 ? Math.round((a.x + pts[i + 1].x) / 2) : a.x;
      g.hline(xa, xb, a.y, P.slate);
      if (i < pts.length - 1) g.vline(xb, a.y, pts[i + 1].y, P.slate);
      // shade the ground below in a light stipple
      for (let x = xa; x <= xb; x++) for (let y = a.y + 2; y <= bot; y++) if ((x + y) % 3 === 0) g.set(x, y, mixHex(P.paper, P.lake, 0.35));
    }
    for (const q of pts) { const [fill, ink] = SCORE_TINT(q.s); g.box(q.x - 1, q.y - 1, 3, 3, ink); g.set(q.x, q.y, fill); }
    const last = pts[pts.length - 1];
    g.vline(last.x - 4, last.y - 4, last.y + 4, P.terracotta); g.hline(last.x - 4, last.x - 3, last.y - 4, P.terracotta); g.hline(last.x - 4, last.x - 3, last.y + 4, P.terracotta);
    labels.push({ x: last.x - 6, y: last.y - 4, text: String(last.s), align: 'r', color: hexOf(P.clay) });
    labels.push({ x: L + 2, y: bot + 2, text: shortDate(list[0].start), small: true, color: LABEL });
    labels.push({ x: R, y: bot + 2, text: shortDate(list[list.length - 1].start), align: 'r', small: true, color: LABEL });
    return labels;
  };
}

export const STAGE_INK: Record<Stage, number> = { deep: P.slate, light: P.lake, rem: P.plum, awake: P.ochre };
export const STAGE_NAME: Record<Stage, string> = { deep: 'deep', light: 'light', rem: 'dreaming', awake: 'awake' };
const STAGE_ROW: Record<Stage, number> = { awake: 0, rem: 1, light: 2, deep: 3 };

/** The night's stages as a stepped hypnogram over four tinted rows, hours marked along the bottom. */
export function hypnoSteps(s: { stages?: Stage[]; start: number; end?: number }, h12: boolean) {
  return (g: Ink): Label[] => {
    const st = s.stages ?? [];
    const L = 30, R = g.w - 2, top = 2, bot = g.h - 9, rowH = (bot - top) / 4;
    const labels: Label[] = [];
    (Object.keys(STAGE_ROW) as Stage[]).forEach((k) => {
      const y0 = Math.round(top + STAGE_ROW[k] * rowH), y1 = Math.round(top + (STAGE_ROW[k] + 1) * rowH) - 1;
      for (let y = y0; y <= y1; y++) for (let x = L; x <= R; x++) if ((x + y) % 2 === 0) g.set(x, y, mixHex(P.paper, STAGE_INK[k], 0.14));
      labels.push({ x: L - 2, y: (y0 + y1) / 2 - 3, text: STAGE_NAME[k], align: 'r', small: true, color: hexOf(STAGE_INK[k]) });
    });
    if (!st.length) return labels;
    const n = st.length, xOf = (i: number) => Math.round(L + (i / n) * (R - L));
    const yOf = (k: Stage) => Math.round(top + (STAGE_ROW[k] + 0.5) * rowH);
    for (let i = 0; i < n; i++) {
      const x0 = xOf(i), x1 = xOf(i + 1), y = yOf(st[i]);
      // a coloured block under the line for that stage
      for (let x = x0; x < Math.max(x0 + 1, x1); x++) for (let yy = y - 1; yy <= y + 1; yy++) g.set(x, yy, STAGE_INK[st[i]]);
      if (i && st[i] !== st[i - 1]) g.vline(x0, yOf(st[i - 1]), y, P.ink);
    }
    const start = s.start, end = s.end ?? start + n * 30000;
    for (let t = Math.ceil(start / 3.6e6) * 3.6e6; t < end; t += 3.6e6) {
      const x = Math.round(L + ((t - start) / (end - start)) * (R - L));
      g.vline(x, bot + 1, bot + 2, INK);
      labels.push({ x, y: bot + 2, text: new Date(t).toLocaleTimeString([], { hour: 'numeric', hour12: h12 }).replace(':00', '').replace(/\s?[AP]M/i, (m) => m.trim().toLowerCase()[0]), align: 'c', small: true, color: LABEL });
    }
    g.hline(L, R, bot + 1, INK);
    return labels;
  };
}

/** The make-up of a night (or an average) as one segmented bar. */
export function stageBar(parts: { deep: number; light: number; rem: number; awake: number }) {
  return (g: Ink): Label[] => {
    const L = 0, R = g.w - 1, top = 0, bot = g.h - 1;
    const total = parts.deep + parts.light + parts.rem + parts.awake || 1;
    let x = L + 1;
    const order: Stage[] = ['deep', 'light', 'rem', 'awake'];
    order.forEach((k, i) => {
      const w = i === order.length - 1 ? R - x : Math.round((parts[k] / total) * (R - L - 1));
      if (w <= 0) return;
      for (let j = top + 1; j < bot; j++) for (let ii = 0; ii < w; ii++) g.set(x + ii, j, j === top + 1 ? mixHex(STAGE_INK[k], P.paper, 0.35) : (ii + j) % 4 === 0 ? mixHex(STAGE_INK[k], P.ink, 0.2) : STAGE_INK[k]);
      x += w;
      if (i < order.length - 1) g.vline(x, top, bot, P.paper);
    });
    g.hline(L, R, top, P.ink2); g.hline(L, R, bot, P.ink2); g.vline(L, top, bot, P.ink2); g.vline(R, top, bot, P.ink2);
    return [];
  };
}
