// [ui7] The diary as real materials, painted smooth at device resolution: an oxblood pebbled-leather board with a
// stitched edge, brass corner protectors and the page block peeking out, the front cover (blind-tooled and gilt
// frames round a blind-tooled panel, a ribbon, a brass title plate, a strap and catch), cream laid paper with a soft
// shadow into the gutter, linen index tabs with a coloured running stitch, inked score stamps, mood icons,
// achievement postage stamps, section icons, satin ribbon bookmarks and brass page-turn buttons.
// Sizes stay in texels (T CSS px each, see layout.ts); each piece is painted at S device px per texel.
import { P } from '../../gfx/palette.ts';
import { BRASS_OLD, GOLD, Real, bevel, box, circle, cutBox, deviceK, dome, metal, polygon, segment, union } from '../real/paint.ts';
import { texCanvas, texReady, type TexName } from '../real/tex.ts';

type RGB = [number, number, number];
const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
export const hexOf = (c: number) => '#' + c.toString(16).padStart(6, '0');
export function h2(x: number, y: number, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** A texel-sized RGBA buffer (kept for older callers). */
export class Px {
  d: Uint8ClampedArray<ArrayBuffer>;
  constructor(public w: number, public h: number) { this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4)); }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x: number, y: number, c: RGB | number, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.in(x, y)) return this;
    const k = typeof c === 'number' ? rgb(c) : c, i = (y * this.w + x) * 4;
    this.d[i] = k[0]; this.d[i + 1] = k[1]; this.d[i + 2] = k[2]; this.d[i + 3] = a;
    return this;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB | number) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
}

export interface Art { url: string; w: number; h: number }
const CACHE = new Map<string, Art>();
/** device px per texel for the diary's art */
const S = () => 2 * deviceK(3);
/** paint an Art `w` x `h` texels with a 2D context scaled to texels */
function art(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): Art {
  const kk = key + '@' + S();
  let a = CACHE.get(kk);
  if (!a) {
    const s = S(), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    const g = c.getContext('2d')!;
    g.scale(s, s);
    paint(g);
    let url = c.toDataURL('image/webp', 0.9);
    if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
    a = { url, w, h };
    if (texReady.peek()) CACHE.set(kk, a); // [ui12] leather and paper need the photo tiles: repaint until they are in
    if (CACHE.size > 300) CACHE.delete(CACHE.keys().next().value!);
  }
  return a;
}
/** a material tile as a pattern, `size` texels per tile */
function pat(g: CanvasRenderingContext2D, n: TexName, size: number, tint?: string, ox = 0, oy = 0): CanvasPattern | string {
  const c = texCanvas(n, tint);
  if (!c) return tint ?? '#7a2a24';
  const p = g.createPattern(c, 'repeat')!;
  p.setTransform(new DOMMatrix().translate(ox, oy).scale(size / c.width));
  return p;
}
const LEATHER = '#8c1d26';
/** the leather margin round the pages (texels; layout.ts uses the same) */
export const BOOK_B = 8;
/** a brass corner protector (n texels), painted once */
const cornerImgs = new Map<string, HTMLCanvasElement>();
function brassCorner(n: number): HTMLCanvasElement {
  const key = n + ':' + S();
  let c = cornerImgs.get(key);
  if (!c) {
    const r = new Real(n, n, S(), 0);
    r.part(polygon([[0, 0], [n, 0], [0, n]]), bevel(1.4, 1.2), metal(BRASS_OLD, { polish: 0.6 }));
    for (const [x, y] of [[2, n * 0.42], [n * 0.42, 2]]) r.part(circle(x, y, 0.9), dome(x, y, 0.9, 0.9, 0.8, 1.4), metal(GOLD, { polish: 0.9 }));
    c = r.canvas({ shadow: false });
    cornerImgs.set(key, c);
  }
  return c;
}
function corners(g: CanvasRenderingContext2D, w: number, h: number, n: number, which = [0, 1, 2, 3]) {
  const im = brassCorner(n);
  for (const q of which) {
    g.save();
    g.translate(q % 2 ? w : 0, q > 1 ? h : 0); g.scale(q % 2 ? -1 : 1, q > 1 ? -1 : 1);
    g.shadowColor = 'rgba(20,6,4,.5)'; g.shadowBlur = 1.2 * S(); g.shadowOffsetY = 0.4 * S();
    g.drawImage(im, 0, 0, n, n);
    g.restore();
  }
}
/** a bevel of light and shade round a rectangle (inside), `b` texels wide */
function bevelEdge(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, b: number, a = 0.4) {
  const side = (x0: number, y0: number, x1: number, y1: number, col: string) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); return gr; };
  g.fillStyle = side(0, y, 0, y + b, `rgba(255,220,190,${a * 0.8})`); g.fillRect(x, y, w, b);
  g.fillStyle = side(x, 0, x + b, 0, `rgba(255,220,190,${a * 0.5})`); g.fillRect(x, y, b, h);
  g.fillStyle = side(0, y + h, 0, y + h - b, `rgba(10,0,0,${a})`); g.fillRect(x, y + h - b, w, b);
  g.fillStyle = side(x + w, 0, x + w - b, 0, `rgba(10,0,0,${a})`); g.fillRect(x + w - b, y, b, h);
}
function stitch(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col = 'rgba(240,210,150,.85)') {
  g.save();
  g.strokeStyle = col; g.lineWidth = 0.55; g.setLineDash([1.6, 1.1]); g.lineCap = 'round';
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 0.5 * S(); g.shadowOffsetY = 0.25 * S();
  g.strokeRect(x, y, w, h);
  g.restore();
}

// ------------------------------------------------------------------ [ui12] a real old book: shared touches

/** the UI's ink (every silhouette in the interface is outlined in it) */
const INK = '#120a0e';
/** one device px, in texels */
const dpx = () => 1 / S();
/** the bold ink outline round a shape's silhouette (2 device px, drawn just inside the edge) */
function inkOutline(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[] = 1) {
  const lw = 2 * dpx();
  g.save(); g.strokeStyle = INK; g.lineWidth = lw; g.lineJoin = 'round';
  g.beginPath(); g.roundRect(x + lw / 2, y + lw / 2, w - lw, h - lw, r); g.stroke(); g.restore();
}
/** Wear on old leather: rubbed, lighter edges and corners, scuffs, a few scratches and darker handling marks. */
function leatherWear(g: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  g.save();
  // rubbed edges: the grain worn pale where hands hold it
  const edge = (x0: number, y0: number, x1: number, y1: number) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(224,160,124,.42)'); gr.addColorStop(1, 'rgba(214,150,120,0)'); return gr; };
  g.fillStyle = edge(0, 0, 0, 2.6); g.fillRect(0, 0, w, 2.6);
  g.fillStyle = edge(0, h, 0, h - 2.2); g.fillRect(0, h - 2.2, w, 2.2);
  g.fillStyle = edge(w, 0, w - 2.2, 0); g.fillRect(w - 2.2, 0, 2.2, h);
  g.fillStyle = edge(0, 0, 2.2, 0); g.fillRect(0, 0, 2.2, h);
  // scuffs, densest towards the edges and corners
  for (let i = 0; i < Math.round((w + h) * 0.5); i++) {
    const u = h2(i, 1, seed), v = h2(i, 2, seed), side = Math.floor(h2(i, 3, seed) * 4);
    const t = Math.pow(h2(i, 4, seed), 2.2) * Math.min(w, h) * 0.22;
    const x = side === 0 ? t : side === 1 ? w - t : u * w, y = side === 2 ? t : side === 3 ? h - t : v * h;
    const rx = 0.4 + h2(i, 5, seed) * 1.8, ry = 0.25 + h2(i, 6, seed) * 0.7;
    g.fillStyle = h2(i, 7, seed) > 0.3 ? `rgba(226,170,140,${0.08 + h2(i, 8, seed) * 0.16})` : `rgba(20,4,4,${0.1 + h2(i, 8, seed) * 0.16})`;
    g.beginPath(); g.ellipse(x, y, rx, ry, h2(i, 9, seed) * Math.PI, 0, Math.PI * 2); g.fill();
  }
  // fine scratches
  g.lineCap = 'round';
  for (let i = 0; i < Math.round((w + h) / 40); i++) {
    const x = h2(i, 11, seed) * w, y = h2(i, 12, seed) * h, a = h2(i, 13, seed) * Math.PI, l = 2 + h2(i, 14, seed) * 7;
    g.strokeStyle = 'rgba(236,190,160,.22)'; g.lineWidth = 0.22;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 0.6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.restore();
}
/** gilt: a warm gold gradient for tooled lines */
function giltOf(g: CanvasRenderingContext2D, w: number, h: number) {
  const gr = g.createLinearGradient(0, 0, w * 0.6, h); gr.addColorStop(0, '#fff2a4'); gr.addColorStop(0.35, '#f0c23e'); gr.addColorStop(0.7, '#c68a1e'); gr.addColorStop(1, '#ffe27a');
  return gr;
}
/** a tooled gilt fillet (a pressed line with gold laid in): a dark impression, then the gold */
function fillet(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lw: number, gilt: CanvasGradient | string) {
  g.save();
  g.strokeStyle = 'rgba(16,2,2,.55)'; g.lineWidth = lw + 0.35; g.strokeRect(x + 0.12, y + 0.18, w, h);
  g.strokeStyle = gilt; g.lineWidth = lw; g.strokeRect(x, y, w, h);
  g.restore();
}
/** a little gilt fleuron (a tooled leaf-and-dot ornament) at (x, y), turned by `a` */
function fleuron(g: CanvasRenderingContext2D, x: number, y: number, s: number, a: number, gilt: CanvasGradient | string) {
  g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = gilt;
  g.shadowColor = 'rgba(16,2,2,.6)'; g.shadowBlur = 0.3 * S(); g.shadowOffsetY = 0.15 * S();
  for (const d of [-1, 1]) { g.beginPath(); g.ellipse(d * s * 0.55, 0, s * 0.55, s * 0.2, d * 0.5, 0, Math.PI * 2); g.fill(); }
  g.beginPath(); g.ellipse(0, -s * 0.35, s * 0.22, s * 0.5, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(0, s * 0.35, s * 0.18, 0, Math.PI * 2); g.fill();
  g.restore();
}
/** the page block's edge seen from the side: many thin leaves, gilt (`gilt`) or plain cream, along x (or y) */
function pageEdge(g: CanvasRenderingContext2D, x: number, y: number, len: number, depth: number, along: 'x' | 'y', gilt: boolean, seed: number) {
  g.save();
  const w = along === 'x' ? len : depth, h = along === 'x' ? depth : len;
  const base = along === 'x' ? g.createLinearGradient(0, y, 0, y + depth) : g.createLinearGradient(x, 0, x + depth, 0);
  if (gilt) { base.addColorStop(0, '#f6d472'); base.addColorStop(0.5, '#d9a332'); base.addColorStop(1, '#9a6614'); }
  else { base.addColorStop(0, '#f4e6c6'); base.addColorStop(1, '#c9b386'); }
  g.fillStyle = base; g.fillRect(x, y, w, h);
  // the leaves: fine lines, a little uneven
  const n = Math.max(3, Math.round(depth / 0.28));
  for (let i = 1; i < n; i++) {
    const t = i / n, o = depth * t + (h2(i, 3, seed) - 0.5) * 0.08;
    g.fillStyle = gilt ? `rgba(110,64,8,${0.25 + h2(i, 5, seed) * 0.25})` : `rgba(120,96,60,${0.22 + h2(i, 5, seed) * 0.2})`;
    if (along === 'x') g.fillRect(x, y + o, w, 0.1); else g.fillRect(x + o, y, 0.1, h);
  }
  g.fillStyle = 'rgba(16,4,4,.45)';
  if (along === 'x') g.fillRect(x, y + depth - 0.25, w, 0.25); else g.fillRect(x + depth - 0.25, y, 0.25, h);
  g.restore();
}
/** a head/tail band: the striped silk bead at the top and foot of the spine (w x h) */
function endband(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.save();
  g.fillStyle = INK; g.fillRect(x - 0.2, y - 0.2, w + 0.4, h + 0.4);
  const n = Math.max(4, Math.round(w / 0.9));
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#f2e2bc' : '#b8262e'; g.fillRect(x + (i * w) / n, y, w / n + 0.02, h); }
  const sh = g.createLinearGradient(0, y, 0, y + h); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.4)');
  g.fillStyle = sh; g.fillRect(x, y, w, h);
  g.restore();
}

// ------------------------------------------------------------------ the open book's board

/**
 * [ui12] The open book (w x h texels): oxblood goatskin with its grain, rubbed edges, scuffs and scratches, a double
 * gilt fillet with fleurons tooled round it, brass corner protectors, the thick page block showing its gilt edges
 * under the pages, the spine's hollow with silk head and tail bands, and a bold ink outline.
 */
export function boardArt(w: number, h: number, spread: boolean, B = BOOK_B): Art {
  return art(`board12:${w}x${h}:${spread}:${B}`, w, h, (g) => {
    g.save();
    g.beginPath(); g.roundRect(0, 0, w, h, 1.4); g.clip();
    g.fillStyle = pat(g, 'pebble', 70, LEATHER);
    g.fillRect(0, 0, w, h);
    g.save(); g.globalCompositeOperation = 'overlay'; g.fillStyle = pat(g, 'leather', 90, undefined, 13, 7); g.globalAlpha = 0.55; g.fillRect(0, 0, w, h); g.restore();
    const vg = g.createRadialGradient(w * 0.32, h * 0.25, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    vg.addColorStop(0, 'rgba(255,190,160,.14)'); vg.addColorStop(1, 'rgba(10,0,0,.32)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    leatherWear(g, w, h, 3);
    bevelEdge(g, 0, 0, w, h, 2.4, 0.5);
    const gilt = giltOf(g, w, h);
    // the tooled double fillet round the boards, a dotted roll between the lines
    const f0 = Math.max(1.8, B * 0.22), f1 = f0 + Math.max(1.2, B * 0.16);
    fillet(g, f0, f0, w - 2 * f0, h - 2 * f0, 0.6, gilt);
    fillet(g, f1, f1, w - 2 * f1, h - 2 * f1, 0.32, gilt);
    g.fillStyle = gilt;
    const fm = (f0 + f1) / 2;
    for (let x = f1 + 2; x < w - f1 - 2; x += 2.2) { g.beginPath(); g.arc(x, fm, 0.22, 0, Math.PI * 2); g.arc(x, h - fm, 0.22, 0, Math.PI * 2); g.fill(); }
    for (let y = f1 + 2; y < h - f1 - 2; y += 2.2) { g.beginPath(); g.arc(fm, y, 0.22, 0, Math.PI * 2); g.arc(w - fm, y, 0.22, 0, Math.PI * 2); g.fill(); }
    // the page block's soft shadow on the boards
    g.save(); g.shadowColor = 'rgba(10,2,2,.7)'; g.shadowBlur = 2.2 * S(); g.shadowOffsetY = 0.6 * S(); g.fillStyle = '#3a0c10';
    g.fillRect(B - 0.6, B - 0.4, w - 2 * B + 1.2, h - 2 * B + 2.4); g.restore();
    if (spread) {
      // the spine's hollow: a deep fold, the boards curving into it
      const sg = g.createLinearGradient(w / 2 - 9, 0, w / 2 + 9, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.3, 'rgba(255,190,160,.12)'); sg.addColorStop(0.44, 'rgba(10,0,0,.5)'); sg.addColorStop(0.5, 'rgba(6,0,0,.8)');
      sg.addColorStop(0.56, 'rgba(10,0,0,.5)'); sg.addColorStop(0.7, 'rgba(255,190,160,.12)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(w / 2 - 9, 0, 18, h);
    }
    g.restore();
    // the page block: gilt edges below and beside the pages (the leaves stack a little proud of the board)
    pageEdge(g, B - 0.6, h - B, w - 2 * B + 1.2, 2.2, 'x', true, 5);
    pageEdge(g, w - B, B - 0.4, h - 2 * B + 0.4, 2.2, 'y', true, 6);
    if (spread) {
      g.save(); g.translate(B, 0); g.scale(-1, 1); pageEdge(g, 0, B - 0.4, h - 2 * B + 0.4, 2.2, 'y', true, 7); g.restore();
      endband(g, w / 2 - 3, B - 2.2, 6, 1.6);
      endband(g, w / 2 - 3, h - B + 0.4, 6, 1.6);
    } else {
      endband(g, B - 2.4, B - 1.8, 1.8, 1.4);
    }
    const c = Math.min(16, Math.max(11, Math.round(B * 1.35)));
    corners(g, w, h, c);
    for (const [x, y, a] of [[c + 3, fm, 0], [w - c - 3, fm, 0], [c + 3, h - fm, Math.PI], [w - c - 3, h - fm, Math.PI]] as [number, number, number][]) fleuron(g, x, y, 1.4, a + Math.PI / 2, gilt);
    inkOutline(g, 0, 0, w, h, 1.4);
  });
}

// ------------------------------------------------------------------ the front cover

/**
 * [ui12] The closed front cover (w x h texels): worn oxblood goatskin, the spine's raised bands across the hinge, a
 * blind-tooled frame, a double gilt fillet with corner fleurons, a tooled centre panel (no emblem), a brass title
 * plate, a leather strap with a brass catch, gilt page edges at the fore-edge, and the ink outline.
 */
export function coverArt(w: number, h: number): Art {
  return art(`cover12:${w}x${h}`, w, h, (g) => {
    g.save();
    g.beginPath(); g.roundRect(0, 0, w, h, [0.5, 1.4, 1.4, 0.5]); g.clip();
    g.fillStyle = pat(g, 'pebble', 70, LEATHER, 17, 5); g.fillRect(0, 0, w, h);
    g.save(); g.globalCompositeOperation = 'overlay'; g.fillStyle = pat(g, 'leather', 90, undefined, 3, 29); g.globalAlpha = 0.55; g.fillRect(0, 0, w, h); g.restore();
    const lg = g.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    lg.addColorStop(0, 'rgba(255,190,160,.16)'); lg.addColorStop(1, 'rgba(10,0,0,.3)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    leatherWear(g, w, h, 9);
    bevelEdge(g, 0, 0, w, h, 2.4, 0.5);
    // the spine strip and its raised bands (cords under the leather)
    const sp = 8;
    const spg = g.createLinearGradient(0, 0, sp, 0); spg.addColorStop(0, 'rgba(255,190,160,.18)'); spg.addColorStop(0.6, 'rgba(0,0,0,0)'); spg.addColorStop(1, 'rgba(10,0,0,.5)');
    g.fillStyle = spg; g.fillRect(0, 0, sp, h);
    const gilt = giltOf(g, w, h);
    for (let i = 1; i <= 5; i++) {
      const y = (h * i) / 6;
      const bg = g.createLinearGradient(0, y - 1.4, 0, y + 1.4); bg.addColorStop(0, 'rgba(10,0,0,.5)'); bg.addColorStop(0.25, 'rgba(255,200,170,.4)'); bg.addColorStop(0.6, 'rgba(120,30,30,0)'); bg.addColorStop(1, 'rgba(10,0,0,.55)');
      g.fillStyle = bg; g.fillRect(0, y - 1.4, sp - 0.6, 2.8);
      g.fillStyle = gilt; g.fillRect(0.4, y - 1.7, sp - 1.4, 0.22); g.fillRect(0.4, y + 1.5, sp - 1.4, 0.22);
    }
    // the hinge groove
    const hg = g.createLinearGradient(sp - 1, 0, sp + 3, 0); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.5, 'rgba(8,0,0,.6)'); hg.addColorStop(0.75, 'rgba(255,190,160,.25)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hg; g.fillRect(sp - 1, 0, 4, h);
    // a blind-tooled frame, then a double gilt fillet with fleurons in its corners
    g.strokeStyle = 'rgba(16,0,0,.5)'; g.lineWidth = 0.7; g.strokeRect(10.5, 5.5, w - 16, h - 11);
    g.strokeStyle = 'rgba(255,190,160,.18)'; g.lineWidth = 0.35; g.strokeRect(11, 6, w - 16, h - 11);
    fillet(g, 13.5, 8.5, w - 22, h - 17, 0.55, gilt);
    fillet(g, 15, 10, w - 25, h - 20, 0.25, gilt);
    for (const [cx, cy, a] of [[17.6, 12.6, Math.PI * 0.25], [w - 9.6, 12.6, Math.PI * 0.75], [17.6, h - 12.6, -Math.PI * 0.25], [w - 9.6, h - 12.6, -Math.PI * 0.75]] as [number, number, number][]) fleuron(g, cx, cy, 1.6, a, gilt);
    // a tooled centre panel: blind lines, a gilt fillet, a roll of little gilt tool marks, diamonds in its corners
    {
      const px = 20.5, py = 17.5, pw2 = w - 34, ph2 = h * 0.5 - 22;
      g.strokeStyle = 'rgba(16,0,0,.5)'; g.lineWidth = 0.6; g.strokeRect(px, py, pw2, ph2);
      g.strokeStyle = 'rgba(255,190,160,.16)'; g.lineWidth = 0.35; g.strokeRect(px + 0.5, py + 0.5, pw2, ph2);
      fillet(g, px + 2.5, py + 2.5, pw2 - 5, ph2 - 5, 0.45, gilt);
      g.fillStyle = gilt;
      for (let x = px + 6; x < px + pw2 - 4; x += 4) { g.beginPath(); g.ellipse(x, py + 1.2, 0.9, 0.4, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(x, py + ph2 - 1.2, 0.9, 0.4, 0, 0, Math.PI * 2); g.fill(); }
      for (const [cx, cy] of [[px + 2.5, py + 2.5], [px + pw2 - 2.5, py + 2.5], [px + 2.5, py + ph2 - 2.5], [px + pw2 - 2.5, py + ph2 - 2.5]]) { g.beginPath(); g.moveTo(cx, cy - 1.6); g.lineTo(cx + 1.6, cy); g.lineTo(cx, cy + 1.6); g.lineTo(cx - 1.6, cy); g.closePath(); g.fill(); }
      fleuron(g, px + pw2 / 2, py + ph2 / 2, 3.2, 0, gilt);
      fleuron(g, px + pw2 / 2 - 7, py + ph2 / 2, 1.8, Math.PI / 2, gilt);
      fleuron(g, px + pw2 / 2 + 7, py + ph2 / 2, 1.8, -Math.PI / 2, gilt);
    }
    g.restore();
    // gilt page edges showing at the fore-edge, under the board's overhang
    pageEdge(g, w - 1.6, 1.5, h - 3, 1.2, 'y', true, 11);
    // the brass title plate (the title is set in the DOM)
    const pw = Math.round(w * 0.58), ph = 13, px0 = Math.round(w / 2 + 2 - pw / 2), py0 = Math.round(h * 0.64);
    const r = new Real(pw, ph, S(), 1);
    r.part(cutBox(0, 0, pw, ph, 2), bevel(1.6, 1.4), metal(GOLD, { along: 'x', polish: 0.7 }), { line: true });
    r.carve(union(box(1.6, 1.6, pw - 3.2, 0.4), box(1.6, ph - 2, pw - 3.2, 0.4)), 0.3, 0.2);
    g.drawImage(r.canvas({ shadow: { dy: 0.6, blur: 1, a: 0.5 } }), px0 - 1, py0 - 1, pw + 2, ph + 2);
    corners(g, w, h, Math.min(12, Math.floor(Math.min(w, h) / 6)), [1, 3]);
    // a leather strap and a brass catch on the right edge
    const sy = h * 0.5 - 5;
    g.fillStyle = pat(g, 'pebble', 70, '#5a1418');
    g.beginPath(); g.roundRect(w - 15, sy, 15, 10, [2, 0, 0, 2]); g.fill();
    bevelEdge(g, w - 15, sy, 15, 10, 1.4, 0.5);
    g.save(); g.strokeStyle = INK; g.lineWidth = 1.5 * dpx(); g.beginPath(); g.roundRect(w - 15, sy, 15, 10, [2, 0, 0, 2]); g.stroke(); g.restore();
    stitch(g, w - 13.6, sy + 1.4, 13.6, 7.2);
    const cr = new Real(7, 7, S(), 1);
    cr.part(box(0, 0, 7, 7, 1.4), bevel(1.4, 1.2), metal(GOLD, { polish: 0.8 }));
    cr.part(circle(3.5, 3.5, 1), dome(3.5, 3.5, 1, 1, 0.6, 1.6), metal(BRASS_OLD));
    g.drawImage(cr.canvas({ shadow: { dy: 0.5, blur: 0.8, a: 0.5 } }), w - 11, sy + 1.5 - 1, 9, 9);
    // the satin ribbon peeking from the foot
    const rb = g.createLinearGradient(w * 0.3, 0, w * 0.3 + 4, 0); rb.addColorStop(0, '#7a1c24'); rb.addColorStop(0.45, '#e05a62'); rb.addColorStop(1, '#6a1820');
    g.fillStyle = rb; g.beginPath(); g.moveTo(w * 0.3, h - 2); g.lineTo(w * 0.3 + 4, h - 2); g.lineTo(w * 0.3 + 4, h); g.lineTo(w * 0.3 + 2, h - 1.2); g.lineTo(w * 0.3, h); g.closePath(); g.fill();
    inkOutline(g, 0, 0, w, h, [0.5, 1.4, 1.4, 0.5]);
  });
}

// ------------------------------------------------------------------ paper

/**
 * [ui12] A page of thick, cream laid paper: its fibre and chain lines, foxing (little rust-brown age spots) and a
 * faint water stain, a deckled fore-edge, the page curving down into the gutter (a soft shadow, then a gentle
 * highlight where it rises), and a little shade along the head and foot.
 */
export function paperArt(w: number, h: number, side: 'L' | 'R' | 'S', seed = 1): Art {
  return art(`paper12:${w}x${h}:${side}:${seed}`, w, h, (g) => {
    g.fillStyle = pat(g, 'paper', 150, '#fdf3da', seed * 37, seed * 53); g.fillRect(0, 0, w, h);
    // laid paper: faint chain lines, and fibres
    g.fillStyle = 'rgba(150,120,70,.07)';
    for (let x = 6 + (seed % 5); x < w; x += 14) g.fillRect(x, 0, 0.25, h);
    g.lineCap = 'round';
    for (let i = 0; i < Math.round((w * h) / 90); i++) {
      const x = h2(i, 1, seed) * w, y = h2(i, 2, seed) * h, a = h2(i, 3, seed) * Math.PI * 2, l = 0.6 + h2(i, 4, seed) * 2.2;
      g.strokeStyle = h2(i, 5, seed) > 0.5 ? 'rgba(130,100,60,.13)' : 'rgba(255,255,248,.35)'; g.lineWidth = 0.12;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // foxing: rust-brown spots in clusters, more towards the edges
    for (let c = 0; c < 4; c++) {
      const cx = (h2(c, 21, seed) > 0.5 ? 0.08 + h2(c, 22, seed) * 0.25 : 0.65 + h2(c, 22, seed) * 0.3) * w, cy = h2(c, 23, seed) * h;
      for (let i = 0; i < 9; i++) {
        const x = cx + (h2(i, 24 + c, seed) - 0.5) * 16, y = cy + (h2(i, 30 + c, seed) - 0.5) * 16, r = 0.25 + Math.pow(h2(i, 36 + c, seed), 2) * 1.3;
        const fg = g.createRadialGradient(x, y, 0, x, y, r);
        fg.addColorStop(0, `rgba(150,86,34,${0.16 + h2(i, 40, seed) * 0.2})`); fg.addColorStop(0.7, 'rgba(160,96,40,.08)'); fg.addColorStop(1, 'rgba(160,96,40,0)');
        g.fillStyle = fg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
    // a faint old water stain with a darker tide line
    {
      const x = (0.2 + h2(1, 50, seed) * 0.6) * w, y = (h2(1, 51, seed) > 0.5 ? 0.88 : 0.1) * h, r = 10 + h2(1, 52, seed) * 14;
      const sg = g.createRadialGradient(x, y, r * 0.75, x, y, r);
      sg.addColorStop(0, 'rgba(190,150,90,.03)'); sg.addColorStop(0.92, 'rgba(160,110,50,.1)'); sg.addColorStop(1, 'rgba(160,110,50,0)');
      g.fillStyle = sg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    // the page curving into the gutter: a deep shadow, then a soft highlight where the page rises
    const depth = side === 'S' ? 9 : 18, gx = side === 'L' ? w : 0, ex = side === 'L' ? w - depth : depth;
    const gl = g.createLinearGradient(gx, 0, ex, 0);
    gl.addColorStop(0, `rgba(70,44,20,${side === 'S' ? 0.3 : 0.55})`); gl.addColorStop(0.18, `rgba(90,60,30,${side === 'S' ? 0.14 : 0.26})`);
    gl.addColorStop(0.55, 'rgba(255,250,236,.22)'); gl.addColorStop(1, 'rgba(255,250,236,0)');
    g.fillStyle = gl; g.fillRect(side === 'L' ? w - depth : 0, 0, depth, h);
    // a little shade along the head and foot, and towards the fore-edge
    const eg = g.createLinearGradient(0, 0, 0, 3); eg.addColorStop(0, 'rgba(120,80,40,.28)'); eg.addColorStop(1, 'rgba(120,80,40,0)');
    g.fillStyle = eg; g.fillRect(0, 0, w, 3);
    const eb = g.createLinearGradient(0, h, 0, h - 3); eb.addColorStop(0, 'rgba(120,80,40,.28)'); eb.addColorStop(1, 'rgba(120,80,40,0)');
    g.fillStyle = eb; g.fillRect(0, h - 3, w, 3);
    const fx = side === 'L' ? 0 : w, fe = g.createLinearGradient(fx, 0, side === 'L' ? 4 : w - 4, 0); fe.addColorStop(0, 'rgba(140,100,50,.22)'); fe.addColorStop(1, 'rgba(140,100,50,0)');
    g.fillStyle = fe; g.fillRect(side === 'L' ? 0 : w - 4, 0, 4, h);
    // the deckled fore-edge: little torn bites out of the paper
    g.save(); g.globalCompositeOperation = 'destination-out';
    for (let y = 0; y < h; y += 0.7) {
      const d = 0.15 + Math.pow(h2(Math.round(y * 10), 61, seed), 3) * 0.9;
      g.fillRect(side === 'L' ? 0 : w - d, y, d, 0.75);
    }
    g.restore();
  });
}

// ------------------------------------------------------------------ small pieces

const mutec = (c: number, k = 0.45) => { const a = rgb(c), b = rgb(P.linen); return ((Math.round(a[0] + (b[0] - a[0]) * k) << 16) | (Math.round(a[1] + (b[1] - a[1]) * k) << 8) | Math.round(a[2] + (b[2] - a[2]) * k)); };
const inkc = (c: number, k = 0.45) => { const a = rgb(c), b = rgb(P.ink); return ((Math.round(a[0] + (b[0] - a[0]) * k) << 16) | (Math.round(a[1] + (b[1] - a[1]) * k) << 8) | Math.round(a[2] + (b[2] - a[2]) * k)); };
/** Section accents (dark, mid, light). */
export const TAB_COLORS: Record<string, [number, number, number]> = {
  moss: [0x123d24, 0x2f8550, 0x6cbc84], lake: [0x1d5580, 0x3f8cc2, 0x86c3e8],
  berry: [0x5a1820, 0x9c3742, 0xd06e70], honey: [0x86580b, 0xd29e22, 0xfadb6a],
};
/** A linen index tab standing up from the page (w x h texels): rounded top, a coloured running stitch. */
export function tabArt(col: string, w: number, h: number, on: boolean): Art {
  return art(`tab7:${col}:${w}x${h}:${on}`, w, h, (g) => {
    const [d, m, l] = (TAB_COLORS[col] ?? TAB_COLORS.moss).map(hexOf);
    g.save();
    g.beginPath(); g.roundRect(0.3, 0.3, w - 0.6, h + 3, [3, 3, 0, 0]); g.clip();
    g.fillStyle = pat(g, 'linen', 70, on ? '#f6ecd4' : '#e2d4b4'); g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, 0, 0, h); sh.addColorStop(0, on ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.1)'); sh.addColorStop(1, on ? 'rgba(0,0,0,.05)' : 'rgba(40,20,0,.28)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    g.fillStyle = on ? m : d; g.globalAlpha = 0.85; g.fillRect(0, 0, w, 1.4); g.globalAlpha = 1;
    g.restore();
    g.strokeStyle = on ? d : m; g.lineWidth = 0.5; g.setLineDash([1.4, 0.9]);
    g.beginPath(); g.moveTo(2.2, 3.3); g.lineTo(w - 2.2, 3.3); g.stroke(); g.setLineDash([]);
    void l;
  });
}

/** [muted field, ink] for a score: colour stays a small accent. */
export const SCORE_TINT = (s: number): [number, number] => { const c = s >= 85 ? P.fern : s >= 70 ? P.lake : s >= 50 ? P.ochre : P.terracotta; return [mutec(c, 0.62), inkc(c, 0.42)]; };
export const scoreHex = (s: number) => hexOf(SCORE_TINT(s)[1]);
/** A square rubber stamp inked on the page for a score (n x n texels): a double border, uneven ink, a faint wash. */
export function badgeArt(score: number, n: number): Art {
  const [fill, ink] = SCORE_TINT(score);
  return art(`badge7:${fill}:${n}`, n, n, (g) => {
    g.globalAlpha = 0.9;
    g.fillStyle = hexOf(fill); g.globalAlpha = 0.35; g.beginPath(); g.roundRect(1.4, 1.4, n - 2.8, n - 2.8, 1.5); g.fill();
    g.globalAlpha = 0.88; g.strokeStyle = hexOf(ink); g.lineWidth = 0.9; g.beginPath(); g.roundRect(0.6, 0.6, n - 1.2, n - 1.2, 1.8); g.stroke();
    g.lineWidth = 0.45; g.beginPath(); g.roundRect(2.2, 2.2, n - 4.4, n - 4.4, 1); g.stroke();
    // the ink skips here and there
    g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.5;
    for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(h2(i, 1, n) * n, h2(i, 2, n) * n, 0.5 + h2(i, 3, n), 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  });
}

/** A hand-inked frame for 9-slicing (24 x 24, slice 6): wobbly double lines that overshoot at the corners. */
export function inkFrameArt(seed = 1): Art {
  return art(`inkframe7:${seed}`, 24, 24, (g) => {
    const N = 24;
    g.strokeStyle = 'rgba(70,60,48,.8)'; g.lineWidth = 0.55; g.lineCap = 'round';
    const wob = (i: number, s: number) => (h2(i, s, seed) - 0.5) * 0.5;
    const line = (x0: number, y0: number, x1: number, y1: number, s: number) => { g.beginPath(); g.moveTo(x0 + wob(1, s), y0 + wob(2, s)); g.quadraticCurveTo((x0 + x1) / 2 + wob(3, s), (y0 + y1) / 2 + wob(4, s), x1 + wob(5, s), y1 + wob(6, s)); g.stroke(); };
    line(-0.5, 1.5, N + 0.5, 1.5, 1); line(-0.5, N - 1.5, N + 0.5, N - 1.5, 2); line(1.5, -0.5, 1.5, N + 0.5, 3); line(N - 1.5, -0.5, N - 1.5, N + 0.5, 4);
    g.strokeStyle = 'rgba(110,100,84,.4)'; g.lineWidth = 0.35;
    line(0, 3.5, N, 3.5, 5); line(3.5, 0, 3.5, N, 6);
  });
}

export const MOOD_NAMES = ['Groggy', 'Meh', 'Okay', 'Good', 'Wonderful'];
const MOOD_TINT: [number, number, number][] = [[P.slate, P.dusk, P.mist], [P.stoneDark, P.stone, P.pebble], [P.pine, P.fern, P.sage], [P.leaf, P.moss, P.sageLight], [P.brassDark, P.honey, P.lamp]];
function cloud(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  g.beginPath(); g.arc(cx - 2.2 * s, cy + 0.6 * s, 2 * s, 0, Math.PI * 2); g.arc(cx, cy - 0.6 * s, 2.8 * s, 0, Math.PI * 2); g.arc(cx + 2.6 * s, cy + 0.6 * s, 2 * s, 0, Math.PI * 2); g.rect(cx - 2.2 * s, cy + 0.6 * s, 4.8 * s, 2 * s); g.fill();
}
/** Mood icons (12 x 12): rain cloud, cloud, leaf, sprout, star. */
export function moodArt(i: number): Art {
  return art(`mood7:${i}`, 12, 12, (g) => {
    const [d, m, l] = MOOD_TINT[i].map(hexOf);
    const grad = (y0: number, y1: number) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, l); gr.addColorStop(0.6, m); gr.addColorStop(1, d); return gr; };
    g.shadowColor = 'rgba(40,30,20,.35)'; g.shadowBlur = 0.5 * S(); g.shadowOffsetY = 0.3 * S();
    if (i <= 1) {
      g.fillStyle = grad(2, 8); cloud(g, 6, i ? 5.2 : 4.4, 1);
      if (i === 0) { g.shadowColor = 'transparent'; g.strokeStyle = hexOf(P.lake); g.lineWidth = 0.6; g.lineCap = 'round'; for (const x of [3, 6, 9]) { g.beginPath(); g.moveTo(x, 8.6); g.lineTo(x - 0.8, 10.8); g.stroke(); } }
    } else if (i === 2) {
      g.fillStyle = grad(1, 10); g.beginPath(); g.moveTo(2, 10); g.quadraticCurveTo(1.5, 2, 10, 1.5); g.quadraticCurveTo(10.5, 9.5, 2, 10); g.fill();
      g.shadowColor = 'transparent'; g.strokeStyle = d; g.lineWidth = 0.4; g.beginPath(); g.moveTo(2, 10); g.lineTo(8.5, 3); g.stroke();
    } else if (i === 3) {
      g.fillStyle = hexOf(P.woodDark); g.beginPath(); g.ellipse(6, 10.4, 4.6, 1.2, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hexOf(P.fern); g.lineWidth = 0.7; g.beginPath(); g.moveTo(6, 10); g.lineTo(6, 5); g.stroke();
      g.fillStyle = grad(1, 7); g.beginPath(); g.ellipse(3.6, 4, 2.6, 1.4, -0.5, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(8.4, 4, 2.6, 1.4, 0.5, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = grad(0.5, 11); g.beginPath();
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 - Math.PI / 2, r = k % 2 ? 2.3 : 5.4; g.lineTo(6 + Math.cos(a) * r, 6.3 + Math.sin(a) * r); }
      g.closePath(); g.fill();
    }
  });
}

const STAMP_COL: Record<string, [number, number]> = { red: [mutec(P.terracotta), inkc(P.clay)], gold: [mutec(P.honey), inkc(P.brassDark)], green: [mutec(P.moss), inkc(P.pine)], blue: [mutec(P.lake), inkc(P.slate)], purple: [mutec(P.lilac), inkc(P.plum)], pink: [mutec(P.rose), inkc(P.berry)] };
/** an emblem drawn in a 9 x 9 box at (x, y) */
function emblem(g: CanvasRenderingContext2D, name: string, x: number, y: number, col: string) {
  g.save(); g.translate(x, y); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 0.9; g.lineCap = 'round'; g.lineJoin = 'round';
  const text = (t: string) => { g.font = `bold 8px Alegreya, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 4.5, 5); };
  const star = (cx: number, cy: number, R: number, r: number, n = 5) => { g.beginPath(); for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r : R; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  switch (name) {
    case 'heart': g.beginPath(); g.moveTo(4.5, 8); g.bezierCurveTo(-1, 4, 1.5, -0.5, 4.5, 2.6); g.bezierCurveTo(7.5, -0.5, 10, 4, 4.5, 8); g.fill(); break;
    case 'moon': case 'candle': g.fillRect(3.1, 4, 2.8, 4.6); g.fillRect(1.6, 8, 5.8, 0.9); g.beginPath(); g.moveTo(4.5, 0.4); g.bezierCurveTo(6.2, 2.2, 5.6, 3.5, 4.5, 3.6); g.bezierCurveTo(3.4, 3.5, 2.8, 2.2, 4.5, 0.4); g.fill(); break;
    case 'seven': text('7'); break;
    case 'three': text('3'); break;
    case 'eight': text('8'); break;
    case 'phases': for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(1.5 + k * 3, 4.5, 1.3, 0, Math.PI * 2); k === 1 ? g.fill() : g.stroke(); } break;
    case 'flame': g.beginPath(); g.moveTo(4.5, 0.5); g.bezierCurveTo(8, 4, 8.5, 8.5, 4.5, 8.5); g.bezierCurveTo(0.5, 8.5, 1, 4.5, 3.5, 3); g.bezierCurveTo(3.5, 4.5, 4.5, 5, 4.5, 0.5); g.fill(); break;
    case 'star': star(4.5, 4.8, 4.3, 1.8); break;
    case 'sun': g.beginPath(); g.arc(4.5, 4.5, 2.2, 0, Math.PI * 2); g.fill(); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.moveTo(4.5 + Math.cos(a) * 3, 4.5 + Math.sin(a) * 3); g.lineTo(4.5 + Math.cos(a) * 4.3, 4.5 + Math.sin(a) * 4.3); g.stroke(); } break;
    case 'hush': g.font = 'bold 5px Alegreya, Georgia, serif'; g.fillText('z', 2, 4); g.font = 'bold 7px Alegreya, Georgia, serif'; g.fillText('Z', 5, 8); break;
    case 'feather': case 'quill': g.beginPath(); g.moveTo(8.5, 0.5); g.quadraticCurveTo(9, 6, 2.5, 7); g.quadraticCurveTo(3, 1.5, 8.5, 0.5); g.fill(); g.beginPath(); g.moveTo(8, 1); g.lineTo(0.5, 8.5); g.stroke(); break;
    case 'wind': for (const [yy, l] of [[2, 6], [4.5, 8], [7, 5]]) { g.beginPath(); g.moveTo(0.5, yy); g.lineTo(l, yy); g.arc(l, yy - 1, 1, Math.PI / 2, -Math.PI / 2, true); g.stroke(); } break;
    case 'box': g.strokeRect(1, 2, 7, 6); g.beginPath(); g.moveTo(1, 4); g.lineTo(8, 4); g.moveTo(4.5, 2); g.lineTo(4.5, 4); g.stroke(); break;
    case 'wish': star(4.5, 4.5, 4.4, 1, 4); break;
    case 'face': g.beginPath(); g.arc(4.5, 4.5, 3.8, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(3, 3.6, 0.6, 0, Math.PI * 2); g.arc(6, 3.6, 0.6, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(4.5, 4.8, 2, 0.3, Math.PI - 0.3); g.stroke(); break;
    case 'compass': g.beginPath(); g.moveTo(4.5, 0.5); g.lineTo(5.7, 4.5); g.lineTo(4.5, 8.5); g.lineTo(3.3, 4.5); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0.5, 4.5); g.lineTo(8.5, 4.5); g.stroke(); break;
    case 'chair': g.beginPath(); g.moveTo(2, 0.5); g.lineTo(2, 8.5); g.moveTo(2, 5); g.lineTo(7, 5); g.lineTo(7, 8.5); g.stroke(); break;
    case 'hat': g.beginPath(); g.roundRect(2.5, 1.5, 4, 5, 0.8); g.fill(); g.beginPath(); g.ellipse(4.5, 6.5, 4.2, 1.2, 0, 0, Math.PI * 2); g.fill(); break;
    case 'crown': g.beginPath(); g.moveTo(0.5, 7.5); g.lineTo(0.5, 2); g.lineTo(2.7, 4.5); g.lineTo(4.5, 1); g.lineTo(6.3, 4.5); g.lineTo(8.5, 2); g.lineTo(8.5, 7.5); g.closePath(); g.fill(); break;
    default: star(4.5, 4.8, 4.3, 1.8);
  }
  g.restore();
}
/** An achievement as a postage stamp (16 x 18): perforated edge, coloured field, emblem. Pencil outline when not earned. */
export function stampArt(color: string, emblem_: string, done: boolean): Art {
  return art(`stamp7:${color}:${emblem_}:${done}`, 16, 18, (g) => {
    const W = 16, H = 18, [fc, ic] = (STAMP_COL[color] ?? STAMP_COL.green).map(hexOf);
    if (!done) {
      g.strokeStyle = 'rgba(110,100,90,.6)'; g.lineWidth = 0.4; g.setLineDash([0.8, 0.6]); g.strokeRect(0.5, 0.5, W - 1, H - 1); g.setLineDash([]);
      g.strokeRect(3, 3, W - 6, H - 6);
      emblem(g, emblem_, 3.5, 4.5, 'rgba(110,100,90,.55)');
      return;
    }
    g.shadowColor = 'rgba(40,30,20,.35)'; g.shadowBlur = 0.6 * S(); g.shadowOffsetY = 0.3 * S();
    g.fillStyle = '#f8f0dc'; g.fillRect(0.4, 0.4, W - 0.8, H - 0.8);
    g.shadowColor = 'transparent';
    g.globalCompositeOperation = 'destination-out';
    for (let x = 1; x < W; x += 1.6) for (const y of [0.4, H - 0.4]) { g.beginPath(); g.arc(x, y, 0.55, 0, Math.PI * 2); g.fill(); }
    for (let y = 1; y < H; y += 1.6) for (const x of [0.4, W - 0.4]) { g.beginPath(); g.arc(x, y, 0.55, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    const fg = g.createLinearGradient(0, 3, 0, H - 3); fg.addColorStop(0, fc); fg.addColorStop(1, ic);
    g.fillStyle = fg; g.globalAlpha = 0.9; g.fillRect(2.6, 2.6, W - 5.2, H - 5.2); g.globalAlpha = 1;
    emblem(g, emblem_, 3.5, 4.2, '#fff8e8');
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(2.6, 2.6, W - 5.2, 3);
  });
}

/** Section icons (11 x 11): 'stats' (bars), 'nights' (moon over a list), 'things' (a little chest), 'seals' (a pennant). */
export function iconArt(name: string, tint: string): Art {
  return art(`icon10:${name}:${tint}`, 11, 11, (g) => {
    const [d, m] = (TAB_COLORS[tint] ?? TAB_COLORS.moss).map(hexOf);
    const ink = hexOf(P.ink2);
    g.shadowColor = 'rgba(40,30,20,.3)'; g.shadowBlur = 0.4 * S(); g.shadowOffsetY = 0.25 * S();
    if (name === 'stats') { g.fillStyle = m; for (const [x, h] of [[1.5, 4], [4.5, 6], [7.5, 8.5]]) { g.beginPath(); g.roundRect(x, 9.5 - h, 2.2, h, 0.6); g.fill(); } g.fillStyle = ink; g.fillRect(0.5, 9.5, 10, 0.6); }
    else if (name === 'nights') { g.fillStyle = '#efe2c0'; g.fillRect(1.6, 3.6, 2.2, 5.4); g.fillStyle = '#8e7440'; g.fillRect(0.6, 8.8, 4.2, 0.9); g.fillStyle = hexOf(P.ochre); g.beginPath(); g.ellipse(2.7, 2.1, 0.8, 1.4, 0, 0, Math.PI * 2); g.fill(); /* [ui10] a candle, not a moon */ g.strokeStyle = ink; g.lineWidth = 0.7; g.lineCap = 'round'; for (const y of [3, 6, 9]) { g.beginPath(); g.moveTo(5.5, y); g.lineTo(10, y); g.stroke(); } }
    else if (name === 'things') { g.fillStyle = m; g.beginPath(); g.roundRect(0.8, 2, 9.4, 7.6, 1.2); g.fill(); g.fillStyle = d; g.fillRect(0.8, 4.6, 9.4, 0.8); g.fillStyle = hexOf(P.honey); g.beginPath(); g.roundRect(4.6, 4.2, 1.8, 2.2, 0.4); g.fill(); }
    else { g.strokeStyle = ink; g.lineWidth = 0.7; g.beginPath(); g.moveTo(1.5, 0.5); g.lineTo(1.5, 10.5); g.stroke(); g.fillStyle = m; g.beginPath(); g.moveTo(1.8, 1); g.lineTo(9.5, 3.5); g.lineTo(1.8, 6.5); g.closePath(); g.fill(); }
  });
}

/** A satin ribbon bookmark hanging below the book (5 x len), with a forked end: a satin sheen and the ink outline. */
export function ribbonArt(len: number, col: string): Art {
  return art(`rib12:${len}:${col}`, 5, len, (g) => {
    const [d, m, l] = (TAB_COLORS[col] ?? TAB_COLORS.berry).map(hexOf);
    const shape = () => { g.beginPath(); g.moveTo(0.4, 0); g.lineTo(4.6, 0); g.lineTo(4.6, len - 0.3); g.lineTo(2.5, len - 2.4); g.lineTo(0.4, len - 0.3); g.closePath(); };
    const gr = g.createLinearGradient(0, 0, 5, 0); gr.addColorStop(0, d); gr.addColorStop(0.3, l); gr.addColorStop(0.55, m); gr.addColorStop(1, d);
    g.fillStyle = gr; shape(); g.fill();
    // satin: a soft sheen running down it, fine weave lines, the fold shadow at the top
    g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(1.1, 0, 0.5, len - 2.2);
    g.fillStyle = 'rgba(0,0,0,.08)'; for (let y = 0.5; y < len - 2; y += 0.5) g.fillRect(0.4, y, 4.2, 0.1);
    const top = g.createLinearGradient(0, 0, 0, 3); top.addColorStop(0, 'rgba(0,0,0,.45)'); top.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = top; g.fillRect(0.4, 0, 4.2, 3);
    g.strokeStyle = INK; g.lineWidth = 1.5 * dpx(); g.lineJoin = 'round'; shape(); g.stroke();
  });
}

/** A little brass arrow button face (12 x 12) pointing left or right. */
export function arrowArt(dir: 'l' | 'r'): Art {
  return art(`arrow7:${dir}`, 12, 12, (g) => {
    const r = new Real(12, 12, S(), 0);
    r.part(box(0.3, 0.3, 11.4, 11.4, 2.4), bevel(1.6, 1.4), metal(GOLD, { polish: 0.7 }));
    const pts: [number, number][] = dir === 'l' ? [[3.4, 6], [7.8, 2.8], [7.8, 9.2]] : [[8.6, 6], [4.2, 2.8], [4.2, 9.2]];
    r.part(polygon(pts), (x, y) => 2.2, { alb: () => [60, 34, 14], spec: 0.2, shin: 10 });
    g.drawImage(r.canvas({ shadow: false }), 0, 0, 12, 12);
    void segment;
  });
}
