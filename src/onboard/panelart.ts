// [ui7] The interview's form layer as real materials, drawn smooth at device resolution and cached as data URLs:
// cream laid paper with a deckled edge, a dog-ear and the odd coffee ring; a stitched tan leather folio; a brass
// bulldog clip; ink ticks and loops that draw themselves; hand-ruled lines; masking tape; a sticky note with a lifting corner; a brass slider rail and knob; little acorns.
// Sizes stay in texels (the form's `--u` unit); each piece is painted at S device px per texel.
import { BRASS_OLD, GOLD, Real, bevel, box, circle, deviceK, dome, metal, polygon, tubeX, union } from '../ui/real/paint.ts';
import { texCanvas } from '../ui/real/tex.ts';

const cache = new Map<string, string>();
const S = () => 3 * deviceK(3);
/** paint `w` x `h` texels on a smooth canvas scaled to texels */
function art(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): string {
  const kk = key + '@' + S();
  let u = cache.get(kk);
  if (!u) {
    const s = S(), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    const g = c.getContext('2d')!;
    g.scale(s, s); g.lineCap = 'round'; g.lineJoin = 'round';
    paint(g);
    u = c.toDataURL('image/webp', 0.9);
    if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/png');
    cache.set(kk, u);
  }
  return u;
}
const hash = (x: number, y: number, s = 0) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
function pat(g: CanvasRenderingContext2D, n: 'paper' | 'pebble' | 'kraft', size: number, tint?: string, ox = 0, oy = 0): CanvasPattern | string {
  const c = texCanvas(n, tint);
  if (!c) return tint ?? '#efe3c6';
  const p = g.createPattern(c, 'repeat')!;
  p.setTransform(new DOMMatrix().translate(ox, oy).scale(size / c.width));
  return p;
}
const INK = '#1d2552', INK2 = '#39457a';

/** a deckled rectangle path */
function deckle(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, amp = 0.6, dog = 0) {
  g.beginPath();
  const n = (i: number, k: number) => (hash(i, k, seed) - 0.5) * amp;
  g.moveTo(x + 1.5, y + n(0, 1));
  for (let i = 2; i < w - 1; i += 2) g.lineTo(x + i, y + n(i, 1));
  g.lineTo(x + w + n(0, 2), y + 1.5);
  for (let i = 2; i < h - dog - 1; i += 2) g.lineTo(x + w + n(i, 2), y + i);
  if (dog) { g.lineTo(x + w, y + h - dog); g.lineTo(x + w - dog, y + h); }
  else g.lineTo(x + w - 1.5, y + h + n(1, 3));
  for (let i = w - dog - 2; i > 1; i -= 2) g.lineTo(x + i, y + h + n(i, 3));
  g.lineTo(x + n(0, 4), y + h - 1.5);
  for (let i = h - 2; i > 1; i -= 2) g.lineTo(x + n(i, 4), y + i);
  g.closePath();
}

// ------------------------------------------------------------------ paper

/** A sheet of cream laid paper, w x h texels: deckle edges, a dog-eared corner, a soft cast shadow. */
export function sheetURL(w: number, h: number, seed = 1, o: { dog?: boolean; stain?: boolean } = {}) {
  return art(`sheet7:${w}x${h}:${seed}:${o.dog ? 1 : 0}${o.stain ? 1 : 0}`, w + 3, h + 3, (g) => {
    const dog = o.dog ? 9 + Math.floor(hash(seed, 1, 2) * 4) : 0;
    g.save();
    g.shadowColor = 'rgba(26,12,6,.38)'; g.shadowBlur = 1.6 * S(); g.shadowOffsetX = 0.6 * S(); g.shadowOffsetY = 1.2 * S();
    deckle(g, 0, 0, w, h, seed, 0.5, dog);
    g.fillStyle = pat(g, 'paper', 150, '#fff8e6', seed * 31, seed * 17); g.fill();
    g.restore();
    g.save(); deckle(g, 0, 0, w, h, seed, 0.5, dog); g.clip();
    g.strokeStyle = 'rgba(150,120,80,.08)'; g.lineWidth = 0.25;
    for (let y = 0; y < h; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const eg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
    eg.addColorStop(0, 'rgba(140,100,50,0)'); eg.addColorStop(1, 'rgba(140,100,50,.18)');
    g.fillStyle = eg; g.fillRect(0, 0, w, h);
    if (o.stain) { g.strokeStyle = 'rgba(140,90,40,.22)'; g.lineWidth = 1.2; g.beginPath(); g.arc(w * 0.78, h * 0.16, 11, 0.3, Math.PI * 1.85); g.stroke(); }
    g.restore();
    if (dog) {
      const gr = g.createLinearGradient(w - dog, h - dog, w - dog / 2, h - dog / 2);
      gr.addColorStop(0, '#d8c8a4'); gr.addColorStop(1, '#f4ead2');
      g.fillStyle = gr; g.beginPath(); g.moveTo(w, h - dog); g.lineTo(w - dog, h); g.lineTo(w - dog * 0.92, h - dog * 0.92); g.closePath();
      g.shadowColor = 'rgba(40,20,8,.35)'; g.shadowBlur = 0.8 * S(); g.fill(); g.shadowColor = 'transparent';
    }
  });
}

// ------------------------------------------------------------------ the leather folio behind the sheet

/** [ui10] a bevel-cut rectangle path (no rounded corners) */
function cutPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number) {
  g.beginPath(); g.moveTo(x + c, y); g.lineTo(x + w - c, y); g.lineTo(x + w, y + c); g.lineTo(x + w, y + h - c); g.lineTo(x + w - c, y + h); g.lineTo(x + c, y + h); g.lineTo(x, y + h - c); g.lineTo(x, y + c); g.closePath();
}
export function folioURL(w: number, h: number) {
  return art(`folio10:${w}x${h}`, w + 4, h + 4, (g) => {
    g.save();
    g.shadowColor = 'rgba(14,5,4,.5)'; g.shadowBlur = 2 * S(); g.shadowOffsetX = 0.8 * S(); g.shadowOffsetY = 1.6 * S();
    cutPath(g, 0, 0, w, h, 6);
    g.fillStyle = pat(g, 'pebble', 120, '#8a4a24'); g.fill();
    g.restore();
    g.save(); cutPath(g, 0, 0, w, h, 6); g.clip();
    const lg = g.createLinearGradient(0, 0, w, h); lg.addColorStop(0, 'rgba(255,220,180,.16)'); lg.addColorStop(0.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.3)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,220,180,.25)'; g.lineWidth = 1.2; cutPath(g, 0.8, 0.8, w - 1.6, h - 1.6, 5.5); g.stroke();
    g.strokeStyle = "rgba(20,12,16,.9)"; g.lineWidth = 0.8; cutPath(g, 0.2, 0.2, w - 0.4, h - 0.4, 6); g.stroke();
    g.restore();
    g.strokeStyle = 'rgba(240,214,166,.85)'; g.lineWidth = 0.55; g.setLineDash([2, 1.4]);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 0.4 * S(); g.shadowOffsetY = 0.3 * S();
    cutPath(g, 4, 4, w - 8, h - 8, 4); g.stroke();
  });
}

/** A brass bulldog clip, 46 x 22 texels. */
export function clipURL() {
  return art('clip7', 46, 22, (g) => {
    const r = new Real(46, 22, S(), 0);
    r.part(polygon([[2, 3], [44, 3], [40, 16], [6, 16]]), (x, y) => 2 + (y < 6 ? 1.6 * Math.sin((y - 3) / 3 * Math.PI / 2) : 1.6 - (y - 6) * 0.08), metal(GOLD, { along: 'x', polish: 0.75 }));
    r.part(box(3, 2, 40, 4, 2), tubeX(4, 2, 3), metal(GOLD, { along: 'x', polish: 0.85 }));
    r.carve(box(10, 10, 26, 0.8, 0.4), 0.6, 0.4);
    for (const sx of [-1, 1]) r.part(polygon([[23 + sx * 13, 14], [23 + sx * 14, 14], [23 + sx * 11, 22], [23 + sx * 10, 22]]), 2.4, metal(BRASS_OLD, { polish: 0.6 }));
    g.drawImage(r.canvas({ shadow: { dy: 1, blur: 1.4, a: 0.45 } }), 0, 0, 46, 22);
  });
}

// ------------------------------------------------------------------ ink: ticks, loops, rules

/** The frames of an ink tick being drawn (n frames side by side, 16 x 14 each). */
export function tickStripURL(n = 6, seed = 1) {
  return art(`tick7:${n}:${seed}`, 16 * n, 14, (g) => {
    g.strokeStyle = INK;
    const L0 = Math.hypot(3, 4), L1 = Math.hypot(9, 10), T = L0 + L1;
    for (let f = 0; f < n; f++) {
      const upto = ((f + 1) / n) * T;
      g.save(); g.translate(f * 16, 0);
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(2, 7);
      if (upto <= L0) g.lineTo(2 + 3 * upto / L0, 7 + 4 * upto / L0);
      else { g.lineTo(5, 11); const k = (upto - L0) / L1; g.lineTo(5 + 9 * k, 11 - 10 * k + Math.sin(seed) * 0.3); }
      g.stroke(); g.restore();
    }
  });
}
/** An ink loop drawn round something, w x h, the last frame complete (n frames stacked vertically). */
export function loopStripURL(w: number, h: number, n = 6, seed = 1) {
  return art(`loop7:${w}x${h}:${n}:${seed}`, w, h * n, (g) => {
    g.strokeStyle = INK; g.lineWidth = 1.1;
    for (let f = 0; f < n; f++) {
      const steps = 120, upto = ((f + 1) / n) * steps;
      g.beginPath();
      for (let i = 0; i <= upto; i++) {
        const a = -Math.PI * 0.62 + (i / steps) * Math.PI * 2.18, r = 1 + Math.sin(a * 3 + seed) * 0.025 + (i / steps) * 0.04;
        const x = w / 2 + Math.cos(a) * (w / 2 - 2) * r, y = f * h + h / 2 + Math.sin(a) * (h / 2 - 2) * r;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.stroke();
    }
  });
}
/** A wavering hand-ruled line, w texels long. */
export function ruleURL(w: number, seed = 1) {
  return art(`rule7:${w}:${seed}`, w, 3, (g) => {
    g.strokeStyle = INK2; g.globalAlpha = 0.8; g.lineWidth = 0.6;
    g.beginPath(); for (let x = 0; x <= w; x += 2) { const y = 1.5 + Math.sin(x * 0.07 + seed) * 0.4 + (hash(x, 1, seed) - 0.5) * 0.2; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
  });
}

// ------------------------------------------------------------------ small bits: tape, sticky note, slider, acorns

export function tapeURL(seed = 1) {
  return art('tape7' + seed, 30, 10, (g) => {
    g.globalAlpha = 0.78;
    g.beginPath(); g.moveTo(1 + hash(0, 1, seed), 0);
    g.lineTo(29 - hash(0, 2, seed), 0);
    for (let y = 1; y <= 10; y += 1.5) g.lineTo(29 - hash(1, y, seed) * 1.6, y);
    g.lineTo(1 + hash(2, 10, seed), 10);
    for (let y = 9; y >= 0; y -= 1.5) g.lineTo(1 + hash(3, y, seed) * 1.6, y);
    g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, 10); gr.addColorStop(0, '#f8f0da'); gr.addColorStop(1, '#e4d6b0');
    g.fillStyle = gr; g.fill();
    g.globalAlpha = 1;
  });
}
export function stickyURL(w = 62, h = 56) {
  return art(`sticky7${w}x${h}`, w + 2, h + 2, (g) => {
    g.save();
    g.shadowColor = 'rgba(26,12,6,.35)'; g.shadowBlur = 1.4 * S(); g.shadowOffsetX = 0.6 * S(); g.shadowOffsetY = 1 * S();
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h - 7); g.quadraticCurveTo(w - 2, h - 1, w - 8, h); g.lineTo(0, h); g.closePath();
    g.fillStyle = pat(g, 'paper', 120, '#ffe27a'); g.fill();
    g.restore();
    const gl = g.createLinearGradient(0, 0, 0, 9); gl.addColorStop(0, 'rgba(140,100,0,.18)'); gl.addColorStop(1, 'rgba(140,100,0,0)');
    g.fillStyle = gl; g.fillRect(0, 0, w, 9);
    const cg = g.createLinearGradient(w - 10, h - 10, w, h); cg.addColorStop(0, 'rgba(0,0,0,0)'); cg.addColorStop(1, 'rgba(120,80,0,.3)');
    g.fillStyle = cg; g.fillRect(w - 12, h - 12, 12, 12);
  });
}
/** A brass slider rail (w texels) with its engraved ticks. */
export function railURL(w: number) {
  return art('rail7' + w, w, 9, (g) => {
    const r = new Real(w, 9, S(), 0);
    r.part(box(0, 2, w, 5, 2.5), tubeX(4.5, 2.5, 0.5), metal(GOLD, { along: 'x', polish: 0.75 }));
    g.drawImage(r.canvas({ shadow: { dy: 0.8, blur: 1, a: 0.4 } }), 0, 0, w, 9);
  });
}
export function knobURL() {
  return art('knob7', 14, 18, (g) => {
    const r = new Real(14, 18, S(), 0);
    r.part(union(circle(7, 6, 6), polygon([[3, 9], [11, 9], [7, 17.5]])), (x, y) => (y < 12 ? dome(7, 6, 6, 6, 3.4, 1)(x, y, 0) : 1.6), metal(GOLD, { polish: 0.85 }));
    r.part(circle(7, 6, 2.2), dome(7, 6, 2.2, 2.2, 1, 4), metal(BRASS_OLD, { polish: 0.7 }));
    g.drawImage(r.canvas({ shadow: { dy: 1, blur: 1.4, a: 0.45 } }), 0, 0, 14, 18);
    void bevel;
  });
}
/** a little acorn for the progress row: done (inked), now (gold), to come (outline) */
export function acornURL(state: 'done' | 'now' | 'todo') {
  return art('acorn7' + state, 6, 6, (g) => {
    const [cap, nut] = state === 'done' ? ['#6a4420', '#a06a34'] : state === 'now' ? ['#a87a22', '#f0c060'] : ['#d8c8a0', '#efe3c6'];
    if (state === 'todo') { g.strokeStyle = '#b8a47a'; g.lineWidth = 0.5; g.beginPath(); g.ellipse(3, 3.9, 1.8, 1.9, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(3, 2.2, 2.6, 1.3, 0, Math.PI, Math.PI * 2); g.stroke(); return; }
    g.shadowColor = state === 'now' ? 'rgba(255,200,80,.7)' : 'rgba(0,0,0,.3)'; g.shadowBlur = 0.6 * S();
    const ng = g.createLinearGradient(1.2, 2, 4.8, 6); ng.addColorStop(0, nut); ng.addColorStop(1, cap);
    g.fillStyle = ng; g.beginPath(); g.ellipse(3, 3.9, 1.8, 1.9, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = cap; g.beginPath(); g.ellipse(3, 2.4, 2.6, 1.3, 0, Math.PI, Math.PI * 2); g.lineTo(5.6, 2.8); g.lineTo(0.4, 2.8); g.fill();
  });
}
