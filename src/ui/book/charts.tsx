// Charts for the diary [ui7]: laid out on a texel grid (T CSS px each) and drawn smooth at device resolution:
// rounded bars with a lit edge, lines with round markers, a hypnogram and a segmented stage bar; their labels
// are set in the DOM.
import { useEffect, useRef } from 'preact/hooks';
import { P } from '../../gfx/palette.ts';
import type { Stage } from '../../sleep/types.ts';
import { hexOf, SCORE_TINT } from './art.ts';
import type { Night } from './stats.ts';

export interface Label { x: number; y: number; text: string; align?: 'l' | 'c' | 'r'; color?: string; small?: boolean; up?: boolean }

type Op = { k: 'dot' | 'rect' | 'line' | 'bar'; a: number[]; c: number; c2?: number; dash?: number[] };
/** [ui7] A recorder with the old texel tools; the Chart replays it smooth at device resolution. */
export class Ink {
  ops: Op[] = [];
  constructor(public w: number, public h: number) {}
  set(x: number, y: number, c: number) { this.ops.push({ k: 'dot', a: [x + 0.5, y + 0.5], c }); return this; }
  rect(x: number, y: number, w: number, h: number, c: number) { this.ops.push({ k: 'rect', a: [x, y, w, h], c }); return this; }
  hline(x0: number, x1: number, y: number, c: number) { this.ops.push({ k: 'line', a: [Math.min(x0, x1), y + 0.5, Math.max(x0, x1) + 1, y + 0.5], c }); }
  vline(x: number, y0: number, y1: number, c: number) { this.ops.push({ k: 'line', a: [x + 0.5, Math.min(y0, y1), x + 0.5, Math.max(y0, y1) + 1], c }); }
  dashH(x0: number, x1: number, y: number, c: number, on = 2, off = 2) { this.ops.push({ k: 'line', a: [x0, y + 0.5, x1 + 1, y + 0.5], c, dash: [on, off] }); }
  box(x: number, y: number, w: number, h: number, c: number) { this.rect(x, y, w, h, c); }
  /** a rounded bar with a lit left edge, a shaded right edge and an ink cap */
  bar(x: number, y: number, w: number, h: number, fill: number, ink: number) { if (h > 0) this.ops.push({ k: 'bar', a: [x, y, w, h], c: fill, c2: ink }); }
  /** replay at `s` device px per texel */
  draw(g: CanvasRenderingContext2D, s: number) {
    g.setTransform(s, 0, 0, s, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    g.lineCap = 'round';
    for (const o of this.ops) {
      const col = hexOf(o.c);
      if (o.k === 'dot') { g.fillStyle = col; g.beginPath(); g.arc(o.a[0], o.a[1], 0.62, 0, Math.PI * 2); g.fill(); }
      else if (o.k === 'rect') { g.fillStyle = col; g.beginPath(); g.roundRect(o.a[0], o.a[1], o.a[2], o.a[3], Math.min(0.6, o.a[2] / 3, o.a[3] / 3)); g.fill(); }
      else if (o.k === 'line') { g.strokeStyle = col; g.lineWidth = 0.8; g.setLineDash(o.dash ?? []); g.beginPath(); g.moveTo(o.a[0], o.a[1]); g.lineTo(o.a[2], o.a[3]); g.stroke(); g.setLineDash([]); }
      else {
        const [x, y, w, h] = o.a, gr = g.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, hexOf(mixHex(o.c, P.paper, 0.35))); gr.addColorStop(0.45, col); gr.addColorStop(1, hexOf(mixHex(o.c, o.c2!, 0.35)));
        g.fillStyle = gr; g.beginPath(); g.roundRect(x, y, w, h, [Math.min(1.2, w / 3), Math.min(1.2, w / 3), 0.3, 0.3]); g.fill();
        g.fillStyle = hexOf(o.c2!); g.beginPath(); g.roundRect(x, y, w, Math.min(1, h), [Math.min(1.2, w / 3), Math.min(1.2, w / 3), 0, 0]); g.fill();
      }
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
    const s = p.T * Math.min(3, Math.max(1, devicePixelRatio || 1));
    cv.width = Math.round(tw * s); cv.height = Math.round(th * s);
    const ctx = cv.getContext('2d');
    if (ctx) g.draw(ctx, s);
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
      // a pencil-hatched wooden bar; only its cap carries the score's colour
      const [, ink] = SCORE_TINT(d.night.report.score);
      g.bar(x0, y, bw, bot - y + 1, mixHex(P.linen, P.wood, 0.45), P.ink2);
      g.hline(x0 + 1, x0 + bw - 2, y + 1, ink); g.hline(x0 + 1, x0 + bw - 2, y + 2, ink);
      labels.push({ x: cx, y: y + 4, text: hrs.toFixed(1).replace('.0', ''), align: 'c', small: true, color: hexOf(P.ink) });
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
      g.hline(xa, xb, a.y, P.ink2);
      if (i < pts.length - 1) g.vline(xb, a.y, pts[i + 1].y, P.ink2);
      // pencil stipple under the line
      for (let x = xa; x <= xb; x++) for (let y = a.y + 2; y <= bot; y++) if ((x + y) % 3 === 0) g.set(x, y, mixHex(P.paper, P.stone, 0.32));
    }
    for (const q of pts) { const [, ink] = SCORE_TINT(q.s); g.box(q.x - 1, q.y - 1, 3, 3, P.ink2); g.set(q.x, q.y, ink); }
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
