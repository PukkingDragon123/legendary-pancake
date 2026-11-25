// [ui7] The diary as real materials, painted smooth at device resolution: an oxblood pebbled-leather board with a
// stitched edge, brass corner protectors and the page block peeking out, the front cover (blind-tooled and gilt
// frames round a blind-tooled panel, a ribbon, a brass title plate, a strap and catch), cream laid paper with a soft
// shadow into the gutter, linen index tabs with a coloured running stitch, inked score stamps, mood icons,
// achievement postage stamps, section icons, satin ribbon bookmarks and brass page-turn buttons.
// Sizes stay in texels (T CSS px each, see layout.ts); each piece is painted at S device px per texel.
import { P } from '../../gfx/palette.ts';
import { BRASS_OLD, GOLD, Real, bevel, box, circle, cutBox, deviceK, dome, metal, polygon, segment, union } from '../real/paint.ts';
import { texCanvas, type TexName } from '../real/tex.ts';

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
    CACHE.set(kk, a);
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
const LEATHER = '#7a1f24';
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

// ------------------------------------------------------------------ the open book's board

/** The board around the open pages: w x h texels; for a spread, a sunken spine down the middle. */
export function boardArt(w: number, h: number, spread: boolean): Art {
  return art(`board7:${w}x${h}:${spread}`, w, h, (g) => {
    g.fillStyle = pat(g, 'pebble', 90, LEATHER);
    g.beginPath(); g.roundRect(0, 0, w, h, 1); g.fill();
    const vg = g.createLinearGradient(0, 0, 0, h); vg.addColorStop(0, 'rgba(255,210,180,.1)'); vg.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    bevelEdge(g, 0, 0, w, h, 2.2, 0.45);
    if (spread) {
      const sg = g.createLinearGradient(w / 2 - 6, 0, w / 2 + 6, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.42, 'rgba(10,0,0,.45)'); sg.addColorStop(0.5, 'rgba(10,0,0,.7)'); sg.addColorStop(0.58, 'rgba(10,0,0,.45)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg; g.fillRect(w / 2 - 6, 0, 12, h);
    }
    // the page block's edges peek out beside the pages
    const B = 6;
    g.fillStyle = '#e8d8b4';
    g.fillRect(B - 0.5, h - B, w - 2 * B + 1, 1.6);
    g.fillRect(w - B, B, 1.6, h - 2 * B + 1);
    if (spread) g.fillRect(B - 1.6, B, 1.6, h - 2 * B + 1);
    g.strokeStyle = 'rgba(150,120,80,.6)'; g.lineWidth = 0.25;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(B, h - B + 0.4 + i * 0.4); g.lineTo(w - B, h - B + 0.4 + i * 0.4); g.stroke(); }
    stitch(g, 3, 3, w - 6, h - 6);
    corners(g, w, h, Math.min(11, Math.floor(Math.min(w, h) / 6)));
  });
}

// ------------------------------------------------------------------ the front cover

/** The closed front cover (w x h texels): blind-tooled and gilt frames round a tooled panel, a title plate, a ribbon (no emblem). */
export function coverArt(w: number, h: number): Art {
  return art(`cover7:${w}x${h}`, w, h, (g) => {
    g.fillStyle = pat(g, 'pebble', 90, LEATHER, 17, 5);
    g.beginPath(); g.roundRect(0, 0, w, h, [0.5, 1, 1, 0.5]); g.fill();
    const lg = g.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    lg.addColorStop(0, 'rgba(255,200,170,.12)'); lg.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    bevelEdge(g, 0, 0, w, h, 2.4, 0.5);
    // the hinge groove
    const hg = g.createLinearGradient(5, 0, 9, 0); hg.addColorStop(0, 'rgba(0,0,0,0)'); hg.addColorStop(0.5, 'rgba(10,0,0,.55)'); hg.addColorStop(0.7, 'rgba(255,200,170,.25)'); hg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hg; g.fillRect(5, 0, 4, h);
    // a blind-tooled frame and a gilt one inside it
    g.strokeStyle = 'rgba(20,0,0,.45)'; g.lineWidth = 0.7; g.strokeRect(10.5, 6.5, w - 17, h - 13);
    g.strokeStyle = 'rgba(255,200,170,.18)'; g.lineWidth = 0.4; g.strokeRect(11, 7, w - 17, h - 13);
    const gilt = g.createLinearGradient(0, 0, w, h); gilt.addColorStop(0, '#fff0a8'); gilt.addColorStop(0.4, '#e3b640'); gilt.addColorStop(1, '#9a6a1a');
    g.strokeStyle = gilt; g.lineWidth = 0.8; g.strokeRect(14.5, 10.5, w - 25, h - 21);
    for (const [cx, cy, sx, sy] of [[14.5, 10.5, 1, 1], [w - 10.5, 10.5, -1, 1], [14.5, h - 10.5, 1, -1], [w - 10.5, h - 10.5, -1, -1]]) {
      g.fillStyle = gilt; g.beginPath(); g.ellipse(cx + sx * 2.4, cy + sy * 2.4, 2.2, 0.9, sx * sy * Math.PI / 4, 0, Math.PI * 2); g.fill();
    }
    // [ui10] no emblem: a blind-tooled centre panel with a gilt fillet, little gilt tool marks round it, and a
    // satin ribbon bookmark hanging from the foot of the page block
    {
      const px = 20.5, py = 17.5, pw2 = w - 37, ph2 = h * 0.5 - 22;
      g.strokeStyle = 'rgba(20,0,0,.5)'; g.lineWidth = 0.6; g.strokeRect(px, py, pw2, ph2);
      g.strokeStyle = 'rgba(255,200,170,.16)'; g.lineWidth = 0.35; g.strokeRect(px + 0.5, py + 0.5, pw2, ph2);
      g.strokeStyle = gilt; g.lineWidth = 0.5; g.strokeRect(px + 2.5, py + 2.5, pw2 - 5, ph2 - 5);
      g.fillStyle = gilt;
      for (let x = px + 6; x < px + pw2 - 4; x += 4) { g.beginPath(); g.ellipse(x, py + 1.2, 0.9, 0.4, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(x, py + ph2 - 1.2, 0.9, 0.4, 0, 0, Math.PI * 2); g.fill(); }
      for (const [cx, cy] of [[px + 2.5, py + 2.5], [px + pw2 - 2.5, py + 2.5], [px + 2.5, py + ph2 - 2.5], [px + pw2 - 2.5, py + ph2 - 2.5]]) { g.beginPath(); g.moveTo(cx, cy - 1.6); g.lineTo(cx + 1.6, cy); g.lineTo(cx, cy + 1.6); g.lineTo(cx - 1.6, cy); g.closePath(); g.fill(); }
      const rb = g.createLinearGradient(w * 0.3, 0, w * 0.3 + 4, 0); rb.addColorStop(0, '#7a1c24'); rb.addColorStop(0.5, '#c8404a'); rb.addColorStop(1, '#6a1820');
      g.fillStyle = rb; g.beginPath(); g.moveTo(w * 0.3, h - 2); g.lineTo(w * 0.3 + 4, h - 2); g.lineTo(w * 0.3 + 4, h); g.lineTo(w * 0.3 + 2, h - 1.2); g.lineTo(w * 0.3, h); g.closePath(); g.fill();
    }
    // the brass title plate (the title is set in the DOM)
    const pw = Math.round(w * 0.58), ph = 13, px0 = Math.round(w / 2 + 2 - pw / 2), py0 = Math.round(h * 0.64);
    const r = new Real(pw, ph, S(), 1);
    r.part(cutBox(0, 0, pw, ph, 2), bevel(1.6, 1.4), metal(GOLD, { along: 'x', polish: 0.7 }));
    r.carve(union(box(1.6, 1.6, pw - 3.2, 0.4), box(1.6, ph - 2, pw - 3.2, 0.4)), 0.3, 0.2);
    g.drawImage(r.canvas({ shadow: { dy: 0.6, blur: 1, a: 0.5 } }), px0 - 1, py0 - 1, pw + 2, ph + 2);
    corners(g, w, h, Math.min(12, Math.floor(Math.min(w, h) / 6)), [1, 3]);
    // a leather strap and a brass catch on the right edge
    const sy = h * 0.5 - 5;
    g.fillStyle = pat(g, 'pebble', 90, '#5a1418');
    g.beginPath(); g.roundRect(w - 15, sy, 15, 10, [2, 0, 0, 2]); g.fill();
    bevelEdge(g, w - 15, sy, 15, 10, 1.4, 0.5);
    const cr = new Real(7, 7, S(), 1);
    cr.part(box(0, 0, 7, 7, 1.4), bevel(1.4, 1.2), metal(GOLD, { polish: 0.8 }));
    cr.part(circle(3.5, 3.5, 1), dome(3.5, 3.5, 1, 1, 0.6, 1.6), metal(BRASS_OLD));
    g.drawImage(cr.canvas({ shadow: { dy: 0.5, blur: 0.8, a: 0.5 } }), w - 11, sy + 1.5 - 1, 9, 9);
  });
}

// ------------------------------------------------------------------ paper

/** A page of cream laid paper with foxing, a soft edge and a shadow curving into the gutter. */
export function paperArt(w: number, h: number, side: 'L' | 'R' | 'S', seed = 1): Art {
  return art(`paper7:${w}x${h}:${side}:${seed}`, w, h, (g) => {
    g.fillStyle = pat(g, 'paper', 160, '#fbf2dc', seed * 37, seed * 53); g.fillRect(0, 0, w, h);
    const gl = side === 'L' ? g.createLinearGradient(w, 0, w - 14, 0) : g.createLinearGradient(0, 0, 14, 0);
    gl.addColorStop(0, `rgba(90,60,30,${side === 'S' ? 0.22 : 0.38})`); gl.addColorStop(1, 'rgba(90,60,30,0)');
    g.fillStyle = gl; side === 'L' ? g.fillRect(w - 14, 0, 14, h) : g.fillRect(0, 0, 14, h);
    const eg = g.createLinearGradient(0, 0, 0, 3); eg.addColorStop(0, 'rgba(120,80,40,.25)'); eg.addColorStop(1, 'rgba(120,80,40,0)');
    g.fillStyle = eg; g.fillRect(0, 0, w, 3);
    const eb = g.createLinearGradient(0, h, 0, h - 3); eb.addColorStop(0, 'rgba(120,80,40,.25)'); eb.addColorStop(1, 'rgba(120,80,40,0)');
    g.fillStyle = eb; g.fillRect(0, h - 3, w, 3);
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
  const text = (t: string) => { g.font = `bold 8px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 4.5, 5); };
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
    case 'hush': g.font = 'bold 5px Georgia, serif'; g.fillText('z', 2, 4); g.font = 'bold 7px Georgia, serif'; g.fillText('Z', 5, 8); break;
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
  return art(`icon7:${name}:${tint}`, 11, 11, (g) => {
    const [d, m] = (TAB_COLORS[tint] ?? TAB_COLORS.moss).map(hexOf);
    const ink = hexOf(P.ink2);
    g.shadowColor = 'rgba(40,30,20,.3)'; g.shadowBlur = 0.4 * S(); g.shadowOffsetY = 0.25 * S();
    if (name === 'stats') { g.fillStyle = m; for (const [x, h] of [[1.5, 4], [4.5, 6], [7.5, 8.5]]) { g.beginPath(); g.roundRect(x, 9.5 - h, 2.2, h, 0.6); g.fill(); } g.fillStyle = ink; g.fillRect(0.5, 9.5, 10, 0.6); }
    else if (name === 'nights') { g.fillStyle = hexOf(P.ochre); g.beginPath(); g.arc(2.6, 3, 2.2, 0, Math.PI * 2); g.arc(3.6, 2.4, 1.8, 0, Math.PI * 2, true); g.fill('evenodd'); g.strokeStyle = ink; g.lineWidth = 0.7; g.lineCap = 'round'; for (const y of [3, 6, 9]) { g.beginPath(); g.moveTo(5.5, y); g.lineTo(10, y); g.stroke(); } }
    else if (name === 'things') { g.fillStyle = m; g.beginPath(); g.roundRect(0.8, 2, 9.4, 7.6, 1.2); g.fill(); g.fillStyle = d; g.fillRect(0.8, 4.6, 9.4, 0.8); g.fillStyle = hexOf(P.honey); g.beginPath(); g.roundRect(4.6, 4.2, 1.8, 2.2, 0.4); g.fill(); }
    else { g.strokeStyle = ink; g.lineWidth = 0.7; g.beginPath(); g.moveTo(1.5, 0.5); g.lineTo(1.5, 10.5); g.stroke(); g.fillStyle = m; g.beginPath(); g.moveTo(1.8, 1); g.lineTo(9.5, 3.5); g.lineTo(1.8, 6.5); g.closePath(); g.fill(); }
  });
}

/** A satin ribbon bookmark hanging below the book (5 x len), with a forked end. */
export function ribbonArt(len: number, col: string): Art {
  return art(`rib7:${len}:${col}`, 5, len, (g) => {
    const [d, m, l] = (TAB_COLORS[col] ?? TAB_COLORS.berry).map(hexOf);
    const gr = g.createLinearGradient(0, 0, 5, 0); gr.addColorStop(0, l); gr.addColorStop(0.35, m); gr.addColorStop(1, d);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0.3, 0); g.lineTo(4.7, 0); g.lineTo(4.7, len); g.lineTo(2.5, len - 2.2); g.lineTo(0.3, len); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(1, 0, 0.6, len - 2);
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
