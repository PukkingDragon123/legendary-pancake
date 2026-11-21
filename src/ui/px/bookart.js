// Pip's Big Book, in pixel art: the tooled midnight-leather cover with its brass owl-and-moon
// medallion, brass corners and clasp, the thick page block, ribbon bookmarks and cloth index tabs,
// paper pages, wax seals, ink stamps, washi tape, an inked adventure map, and little Pip himself
// (drawn with the BME sprite kit so he shades like every other icon) straining on a rope.
//
// The look and the painting technique (dithered texel buffers, hue-ramped leather, brass caps,
// pages curving into the gutter) come from The Bear Must Eat's MenuBook.
//
// Everything is painted at TEXEL resolution and cached as a data URL; the book shows each image at
// T CSS px per texel with `image-rendering: pixelated`. Importing this module never touches the DOM.
import { Grid, icon, RAMPS, render } from './sprites.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ noise & dither
const HEX = new Map();
function hexc(h) {
  let c = HEX.get(h);
  if (!c) { const n = parseInt(h.slice(1, 7), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; HEX.set(h, c); }
  return c;
}
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];
function h2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function rnd(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mixHex = (a, b, t) => { const A = hexc(a), B = hexc(b); return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); };

// ------------------------------------------------------------------ texel buffer
export class Px {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const i = (y * this.w + x) * 4, k = typeof c === 'string' ? hexc(c) : c;
    this.d[i] = k[0]; this.d[i + 1] = k[1]; this.d[i + 2] = k[2]; this.d[i + 3] = a;
    return this;
  }
  /** paint over what is there (alpha 0..1); transparent texels stay transparent unless `force` */
  mix(x, y, c, a, force = false) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const i = (y * this.w + x) * 4, k = typeof c === 'string' ? hexc(c) : c;
    if (!this.d[i + 3]) { if (force) { this.d[i] = k[0]; this.d[i + 1] = k[1]; this.d[i + 2] = k[2]; this.d[i + 3] = Math.round(a * 255); } return this; }
    for (let j = 0; j < 3; j++) this.d[i + j] = Math.round(this.d[i + j] + (k[j] - this.d[i + j]) * a);
    return this;
  }
  a(x, y) { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  clear(x, y) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[(y * this.w + x) * 4 + 3] = 0; return this; }
  rect(x, y, w, h, c, a) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c, a); return this; }
  line(x0, y0, x1, y1, c, a) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return this;
  }
  path(pts, c, a) { for (let i = 1; i < pts.length; i++) this.line(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], c, a); return this; }
  ell(cx, cy, rx, ry, c, a0 = 0, a1 = TAU, wob = 0, seed = 1) {
    const n = Math.max(8, Math.ceil((rx + ry) * 3)), pts = [];
    for (let i = 0; i <= n; i++) {
      const t = a0 + (a1 - a0) * (i / n), w = wob ? 1 + (vn((i / n) * 5, 0, seed) - 0.5) * wob : 1;
      pts.push([cx + Math.cos(t) * rx * w, cy + Math.sin(t) * ry * w]);
    }
    return this.path(pts, c);
  }
  disc(cx, cy, r, c, a) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if (Math.hypot(x - cx, y - cy) <= r) this.set(x, y, c, a); return this; }
  fill(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (this.a(x, y)) return this;
    const st = [[x, y]], seen = new Uint8Array(this.w * this.h);
    while (st.length) {
      const [i, j] = st.pop();
      if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
      const k = j * this.w + i;
      if (seen[k] || this.d[k * 4 + 3]) continue;
      seen[k] = 1;
      this.set(i, j, c);
      st.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
    }
    return this;
  }
  outline(c, eight = false) {
    const o = new Uint8Array(this.w * this.h);
    const nb = eight ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.d[(y * this.w + x) * 4 + 3]) continue;
      for (const [dx, dy] of nb) if (this.a(x + dx, y + dy) > 128) { o[y * this.w + x] = 1; break; }
    }
    for (let i = 0; i < o.length; i++) if (o[i]) this.set(i % this.w, (i / this.w) | 0, c);
    return this;
  }
  /** copy another buffer in (alpha over) */
  draw(src, ox = 0, oy = 0, flip = false) {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const sx = flip ? src.w - 1 - x : x, i = (y * src.w + sx) * 4, a = src.d[i + 3];
      if (!a) continue;
      if (a === 255) this.set(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2]]);
      else this.mix(ox + x, oy + y, [src.d[i], src.d[i + 1], src.d[i + 2]], a / 255, true);
    }
    return this;
  }
  canvas() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    cv.getContext('2d').putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return cv;
  }
}

const ART = new Map();
/** Paint once, cache the data URL. Returns { url, w, h } in texels. */
export function art(key, paint) {
  let a = ART.get(key);
  if (!a) {
    const p = paint();
    a = { url: p.canvas().toDataURL(), w: p.w, h: p.h };
    ART.set(key, a);
    if (ART.size > 400) ART.delete(ART.keys().next().value);
  }
  return a;
}

// the BME sprite kit's auto-shaded render, as a Px
function kit(g, key, opt) { const pix = render(g, key, opt); const p = new Px(pix.w, pix.h); p.d.set(pix.d); return p; }

// ------------------------------------------------------------------ palette
export const LEA = ['#07081a', '#0f1230', '#171c44', '#202858', '#2a346c', '#354280', '#435296', '#5868ac'];
export const BRASS = ['#3e2408', '#6e4410', '#a26a1a', '#cf9a2c', '#efc650', '#fff0a8'];
export const PAPER = ['#9c8460', '#c2ad86', '#dccba6', '#eadcbc', '#f4ead2', '#fbf5e6'];
export const INK = '#3b2414', INK_L = '#7a5a3c', RED = '#a8302a', BLUE = '#2b3d8f', RULE = '#a9bcd8', MARGIN = '#d98c84', GRAPHITE = '#57545e';
export const RIBBONS = {
  red: ['#3a0c10', '#7a1a20', '#b0302e', '#e0645a', '#f4a08a'],
  gold: ['#3e2408', '#a26a1a', '#e0aa30', '#ffe07a', '#fff4c0'],
  green: ['#10301c', '#1e5a32', '#2e7a46', '#58a865', '#9ad49a'],
  blue: ['#141e40', '#24407a', '#3462a8', '#6a92d0', '#a8c8ee'],
  purple: ['#1e1030', '#41225e', '#6c3b90', '#9a6ac0', '#c8a8e4'],
  ochre: ['#3a2408', '#7a4e14', '#b07a22', '#dcae4a', '#f4d890'],
  pink: ['#4a1428', '#8a2a50', '#c04a78', '#ec86a8', '#fcc4d4'],
  teal: ['#0e2e30', '#1a5458', '#26807e', '#4cb2a6', '#9ae0d0'],
};

// extra material ramps for the sprite kit (unique names, so nothing else is touched)
Object.assign(RAMPS, {
  bk_lea: ['#0f1230', '#171c44', '#202858', '#2a346c', '#435296', '#5868ac'],
  bk_wax_red: ['#3e0c12', '#6a1620', '#94222c', '#c0343a', '#e05a52', '#f8907a'],
  bk_wax_gold: ['#5a3006', '#8a520c', '#b87a18', '#e0a430', '#f6cc5a', '#fff0a0'],
  bk_wax_green: ['#0e2a1a', '#1a4a2c', '#2a6a40', '#3e8c56', '#62b072', '#9ad69a'],
  bk_wax_blue: ['#0e1a3e', '#182c62', '#24408a', '#3460b4', '#5a88d4', '#94b8ee'],
  bk_wax_purple: ['#1e0e34', '#341a56', '#50287e', '#6e3ca4', '#9466c8', '#c4a0e8'],
  bk_wax_pink: ['#46102a', '#741c46', '#a02c62', '#cc4a84', '#ec7ea8', '#fcb8d0'],
});

// ------------------------------------------------------------------ leather boards
function leatherV(x, y, seed) {
  let v = 3.7 + (vn(x / 7, y / 7, seed) - 0.5) * 0.9 + (vn(x / 2.3, y / 2.3, seed + 3) - 0.5) * 0.7;
  const g = h2(x, y, seed + 7);
  if (g < 0.05) v -= 0.9; else if (g > 0.97) v += 0.8; // pebbled grain
  return v;
}
// brass triangle corner cap: (cx, cy) the corner texel, (dx, dy) into the board, leg n
function brassCorner(p, cx, cy, dx, dy, n) {
  for (let j = 0; j < n; j++) for (let k = 0; k < n - j; k++) {
    const x = cx + dx * k, y = cy + dy * j, d = j + k;
    let c = d === n - 1 ? BRASS[0] : (j === 0 || k === 0) ? BRASS[5] : d < n * 0.45 ? BRASS[4] : BRASS[3];
    if (d < n - 1 && d > n * 0.62 && bay(x, y) < 0.35) c = BRASS[2];
    if ((j === 0 || k === 0) && d > n - 3) c = BRASS[1];
    p.set(x, y, c);
  }
  p.set(cx, cy, BRASS[2]);
  const r = Math.max(1, Math.round(n * 0.28));
  if (n >= 5) { p.set(cx + dx * r, cy + dy * r, BRASS[1]); if (n >= 9) p.set(cx + dx * r - dx, cy + dy * r - dy, BRASS[5]); }
}
/** leather board; side 'L' (outer edge left), 'R' (outer edge right) or 'S' (both) */
function paintBoard(p, w, h, side, seed, n = 10) {
  const outL = side !== 'R', outR = side !== 'L';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const rx = w - 1 - x, ry = h - 1 - y;
    const eL = outL ? x : 99, eR = outR ? rx : 99;
    const cx = Math.min(eL, eR), cy = Math.min(y, ry);
    if (cx < 2 && cy < 2 && Math.hypot(2 - cx, 2 - cy) > 2.3) continue;
    const v = leatherV(x + (side === 'R' ? 400 : 0), y, seed) + 0.2 - (y / h) * 0.5;
    let c = LEA[clamp(Math.floor(v + bay(x, y)), 1, 6)];
    if (Math.min(eL, eR, y, ry) === 0) c = LEA[0];
    else if (y === 1) c = LEA[6];
    else if (ry === 1) c = LEA[2];
    else if (eL === 1) c = LEA[5];
    else if (eR === 1) c = LEA[2];
    p.set(x, y, c);
  }
  if (side === 'L') for (let y = 1; y < h - 1; y++) { p.set(w - 1, y, LEA[1]); p.set(w - 2, y, LEA[2]); }
  if (side === 'R') for (let y = 1; y < h - 1; y++) { p.set(0, y, LEA[1]); p.set(1, y, LEA[3]); }
  if (outL) { brassCorner(p, 0, 0, 1, 1, n); brassCorner(p, 0, h - 1, 1, -1, n); }
  if (outR) { brassCorner(p, w - 1, 0, -1, 1, n); brassCorner(p, w - 1, h - 1, -1, -1, n); }
}
// stacked page edges peeking out under the top page (outer side + tail); depth 0..4
function paintStack(p, x0, y0, pw, ph, dir, depth) {
  for (let i = depth; i >= 1; i--) {
    const ox = x0 + dir * i, oy = y0 + i;
    for (let y = oy; y < oy + ph; y++) for (let x = ox; x < ox + pw; x++) {
      const edge = (dir < 0 ? x === ox : x === ox + pw - 1) || y === oy + ph - 1;
      p.set(x, y, edge ? (i === depth ? PAPER[0] : PAPER[1]) : PAPER[i === 1 ? 3 : 2]);
    }
  }
}
function paintHeadband(p, x0, y0, w) { for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + 2; y++) p.set(x, y, (x + y) % 2 ? '#c8303a' : '#f0dca0'); }

/** One half of the open book (board + page stack), no page on it. side 'L' | 'R' | 'S'. */
export function halfArt(side, pw, ph, B, depth) {
  return art(`half:${side}:${pw}x${ph}:${B}:${depth}`, () => {
    const single = side === 'S';
    const w = single ? pw + 2 * B : pw + B, h = ph + 2 * B, p = new Px(w, h);
    paintBoard(p, w, h, side, side === 'L' ? 21 : 33);
    const px = single || side === 'L' ? B : 0;
    paintStack(p, px, B, pw, ph, side === 'L' ? -1 : 1, depth);
    // the page itself sits on top as its own element; under it, the next sheet's colour
    p.rect(px, B, pw, ph, PAPER[3]);
    if (!single) { paintHeadband(p, side === 'L' ? w - 3 : 0, B - 2, 3); paintHeadband(p, side === 'L' ? w - 3 : 0, B + ph, 3); }
    return p;
  });
}

// ------------------------------------------------------------------ paper
/** A page of paper. side 'L' | 'R' (gutter on the spine side) | 'S'; deco 'plain' | 'frame' | 'rules'. */
export function pageArt(pw, ph, side, deco = 'plain', seed = 5, rules = null) {
  return art(`page:${pw}x${ph}:${side}:${deco}:${seed}:${rules ? rules.r0 + '/' + rules.step : ''}`, () => {
    const p = new Px(pw, ph), w = pw, h = ph;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const g = side === 'L' ? w - 1 - x : side === 'R' ? x : 99; // texels from the spine
      const o = side === 'L' ? x : side === 'R' ? w - 1 - x : Math.min(x, w - 1 - x);
      let v = 3.7 + (vn(x / 11, y / 11, seed) - 0.5) * 0.5 + (vn(x / 3.5, y / 3.5, seed + 2) - 0.5) * 0.3;
      v += (1 - y / h) * 0.3 - 0.12;
      const gw = 20;
      if (g < gw) v -= ((gw - g) / gw) ** 2 * 2.3; // the paper curves into the gutter
      if (side === 'S' && x < 10) v -= ((10 - x) / 10) ** 2 * 1.3;
      if (o < 5) v -= (5 - o) * 0.1;
      let c = PAPER[clamp(Math.floor(v + bay(x, y)), 1, 5)];
      if (g === 0) c = PAPER[0];
      else if (o === 0 || y === 0 || y === h - 1) c = PAPER[2];
      p.set(x, y, c);
    }
    const R = rnd(seed * 7 + 3);
    for (let i = 0; i < (w * h) / 180; i++) {
      const fx = 3 + Math.floor(R() * (w - 6)), fy = 3 + Math.floor(R() * (h - 6)), len = 1 + Math.floor(R() * 3), hz = R() < 0.6;
      for (let k = 0; k < len; k++) p.mix(fx + (hz ? k : 0), fy + (hz ? 0 : k), PAPER[1], 0.35);
    }
    // a faint foxing spot or two
    for (let i = 0; i < 2; i++) {
      const cx = 10 + R() * (w - 20), cy = 10 + R() * (h - 20), r = 2 + R() * 3;
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) < r && h2(x | 0, y | 0, 9) < 0.5) p.mix(x, y, '#c8a070', 0.12);
    }
    if (deco === 'frame') {
      const box = (ins, al) => {
        for (let x = ins; x < w - ins; x++) { p.mix(x, ins, PAPER[0], al); p.mix(x, h - 1 - ins, PAPER[0], al); }
        for (let y = ins; y < h - ins; y++) { p.mix(ins, y, PAPER[0], al); p.mix(w - 1 - ins, y, PAPER[0], al); }
      };
      box(6, 0.5); box(8, 0.3);
      for (const [cx, cy] of [[6, 6], [w - 7, 6], [6, h - 7], [w - 7, h - 7]]) {
        for (const [dx, dy] of [[0, -2], [1, -1], [2, 0], [1, 1], [0, 2], [-1, 1], [-2, 0], [-1, -1]]) p.mix(cx + dx, cy + dy, RED, 0.6);
        p.mix(cx, cy, PAPER[5], 0.9);
      }
    } else if (deco === 'rules' && rules) {
      for (let y = rules.r0; y < h - 4; y += rules.step) for (let x = 3; x < w - 3; x++) p.mix(x, y, RULE, h2(x, y, 4) < 0.06 ? 0.25 : 0.55);
      const mx = side === 'L' ? 16 : side === 'R' ? 26 : 20; // the red margin sits on each page's left
      for (let y = 1; y < h - 1; y++) { p.mix(mx, y, MARGIN, 0.7); p.mix(mx + 2, y, MARGIN, 0.45); }
    }
    return p;
  });
}

/** Marbled endpaper (the inside of the covers). */
function paintEndpaper(pw, ph) {
  const p = new Px(pw, ph);
  for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
    const sw = Math.sin(y / 14 + vn(x / 20, y / 26, 3) * 5) * 2.2;
    const t = vn(x / 13 + sw, y / 7, 9) * 0.78 + vn(x / 4, y / 4, 4) * 0.22;
    let c = t > 0.72 ? '#ecdcb0' : t > 0.68 ? '#c89a3a' : t > 0.55 ? '#34548a' : t > 0.36 ? '#1c2a56' : t > 0.34 ? '#a04450' : '#121a3c';
    if (bay(x, y) < 0.1 && t > 0.53 && t < 0.66) c = '#5a7aaa';
    p.set(x, y, c);
  }
  // a little shadow along the gutter (right edge: this is a left page) and a paper rim
  for (let y = 0; y < ph; y++) for (let k = 0; k < 6; k++) p.mix(pw - 1 - k, y, '#000000', 0.35 - k * 0.055);
  for (let x = 0; x < pw; x++) { p.mix(x, 0, '#000000', 0.2); p.mix(x, ph - 1, '#000000', 0.3); }
  return p;
}
export const endpaperArt = (pw, ph) => art(`endpaper:${pw}x${ph}`, () => paintEndpaper(pw, ph));

/** The bookplate glued to the endpaper (cream label, red rule, gold corners). */
export function plateArt(w, h) {
  return art(`plate:${w}x${h}`, () => {
    const p = new Px(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (e === 0 && (x < 3 || x > w - 4) && (y < 3 || y > h - 4)) continue;
      let c = (vn(x / 6, y / 6, 2) > 0.55 || bay(x, y) < 0.3) ? PAPER[5] : PAPER[4];
      if (e === 0) c = PAPER[1]; else if (e === 3 || e === 5) c = RED; else if (e === 4) c = PAPER[5];
      p.set(x, y, c);
    }
    for (const [cx, cy, dx, dy] of [[1, 1, 1, 1], [w - 2, 1, -1, 1], [1, h - 2, 1, -1], [w - 2, h - 2, -1, -1]]) brassCorner(p, cx, cy, dx, dy, 6);
    // a little flourish under the heading
    return p;
  });
}

// ------------------------------------------------------------------ the front cover
function inPoly(V, x, y) {
  let o = false;
  for (let i = 0, j = V.length - 1; i < V.length; j = i++) {
    const [xi, yi] = V[i], [xj, yj] = V[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) o = !o;
  }
  return o;
}
export function coverGeo(cw, ch) {
  const cx = Math.round((6 + cw) / 2), r = Math.round(clamp(Math.min((cw - 16) * 0.32, ch * 0.2), 12, 46));
  const cy = Math.round(ch * 0.42);
  const plW = Math.round((cw - 10) * 0.7), plH = Math.round(clamp(r * 0.5, 13, 24));
  return { cx, cy, r, pl: { x: cx - Math.round(plW / 2), y: cy + r + Math.round(r * 0.3) + 4, w: plW, h: plH }, title: cy - r - Math.round(r * 0.3) - 4 };
}
// owl emblem regions in the unit medallion (-1..1)
const TUFT_L = [[-0.56, -0.3], [-0.6, -0.86], [-0.24, -0.5]], TUFT_R = TUFT_L.map(([x, y]) => [-x, y]);
function owlRegion(nx, ny) {
  const head = (nx / 0.56) ** 2 + ((ny + 0.12) / 0.44) ** 2 < 1;
  const body = (nx / 0.5) ** 2 + ((ny - 0.36) / 0.5) ** 2 < 1;
  const tuft = inPoly(TUFT_L, nx, ny) || inPoly(TUFT_R, nx, ny);
  if (!head && !body && !tuft) return 0;
  const ex = Math.abs(nx) - 0.24, ey = ny + 0.1;
  const de = Math.hypot(ex, ey);
  if (de < 0.09) return 3; // eye
  if (de < 0.22) return 2; // facial disc
  if (Math.abs(nx) < 0.07 - (ny - 0.04) * 0.3 && ny > 0 && ny < 0.16) return 4; // beak
  if (body && !head && Math.abs(nx) > 0.3) return 6; // wing
  return 1;
}
function paintOwlEmblem(p, cx, cy, r) {
  const rf = r - 4;
  for (let y = cy - r - 1; y <= cy + r + 1; y++) for (let x = cx - r - 1; x <= cx + r + 1; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > r + 0.5) continue;
    if (d > r - 3.2) { // the brass ring
      const lit = -((x - cx) + (y - cy)) / r;
      p.set(x, y, d > r - 0.6 ? BRASS[0] : BRASS[clamp(Math.floor(3 + lit * 1.2 + bay(x, y) - (d > r - 1.6 ? 0 : 0.6)), 1, 5)]);
      continue;
    }
    const nx = (x - cx) / rf, ny = (y - cy) / rf;
    const reg = owlRegion(nx, ny);
    // the crescent moon behind the owl, upper right
    const moon = Math.hypot(nx - 0.5, ny + 0.5) < 0.36 && Math.hypot(nx - 0.64, ny + 0.62) > 0.3;
    if (reg) {
      const lit = 3.1 + (-nx - ny) * 0.75;
      let c = BRASS[clamp(Math.floor(lit + bay(x, y)), 1, 5)];
      if (reg === 2) c = BRASS[clamp(Math.floor(lit + 0.6 + bay(x, y)), 2, 5)];
      if (reg === 3) c = LEA[0];
      if (reg === 4) c = BRASS[1];
      if (reg === 6) c = BRASS[clamp(Math.floor(lit - 0.9 + bay(x, y)), 1, 4)];
      // breast chevrons
      if (reg === 1 && ny > 0.25 && ny < 0.8 && Math.abs(nx) < 0.3) { const k = (ny - 0.25) * 10 - Math.abs(nx) * 6; if (Math.abs(k - Math.round(k / 2.2) * 2.2) < 0.35) c = BRASS[2]; }
      p.set(x, y, c);
    } else if (moon) {
      p.set(x, y, BRASS[clamp(Math.floor(4 + (-nx - ny) * 0.4 + bay(x, y)), 3, 5)]);
    } else {
      // debossed field with a scatter of stars
      let c = LEA[clamp(Math.floor(2.1 + (vn(x / 3, y / 3, 3) - 0.5) + bay(x, y)), 1, 3)];
      if (h2(x, y, 31) < 0.012 && d < r - 5) c = BRASS[4];
      p.set(x, y, c);
    }
  }
  // outlines around the owl and the moon, a glint in each eye, a little branch
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if (Math.hypot(x - cx, y - cy) > r - 3.5) continue;
    const at = (X, Y) => owlRegion((X - cx) / rf, (Y - cy) / rf) > 0;
    if (at(x, y) && (!at(x + 1, y) || !at(x - 1, y) || !at(x, y + 1) || !at(x, y - 1))) p.set(x, y, BRASS[0]);
  }
  for (const s of [-1, 1]) { p.set(Math.round(cx + s * 0.24 * rf - 1), Math.round(cy - 0.1 * rf - 1), BRASS[5]); }
  const by = Math.round(cy + 0.86 * rf);
  for (let x = Math.round(cx - 0.62 * rf); x <= Math.round(cx + 0.62 * rf); x++) { p.set(x, by, BRASS[3]); p.set(x, by + 1, BRASS[1]); }
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) p.set(Math.round(cx + s * 0.16 * rf) + k - 1, by - 1, BRASS[4]);
}
function starAt(p, x, y, big) {
  p.set(x, y, BRASS[5]);
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) p.set(x + dx, y + dy, BRASS[4]);
  if (big) for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0]]) p.set(x + dx, y + dy, BRASS[3]);
}
/** The front cover: midnight leather, gold tooling, brass corners, the owl-and-moon medallion, a title plate. */
export function coverArt(cw, ch) {
  return art(`cover:${cw}x${ch}`, () => {
    const p = new Px(cw, ch);
    paintBoard(p, cw, ch, 'R', 47, Math.round(clamp(Math.min(cw, ch) * 0.1, 10, 22)));
    for (let y = 1; y < ch - 1; y++) { p.set(4, y, LEA[1]); p.set(5, y, LEA[5]); for (let x = 1; x < 4; x++) p.mix(x, y, LEA[0], 0.35); }
    const G = coverGeo(cw, ch);
    // gold tooling: a double frame, a dotted inner line, corner stars
    const a = 10, x0 = 6 + a - 2, x1 = cw - 1 - a, y0 = a, y1 = ch - 1 - a;
    for (let x = x0; x <= x1; x++) { p.set(x, y0, (x % 6) ? BRASS[3] : BRASS[5]); p.set(x, y1, BRASS[2]); if (x % 2) { p.set(x, y0 + 3, BRASS[2]); p.set(x, y1 - 3, BRASS[2]); } }
    for (let y = y0; y <= y1; y++) { p.set(x0, y, (y % 6) ? BRASS[3] : BRASS[5]); p.set(x1, y, BRASS[2]); if (y % 2) { p.set(x0 + 3, y, BRASS[2]); p.set(x1 - 3, y, BRASS[2]); } }
    for (const [qx, qy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) starAt(p, qx, qy, true);
    // a vine of little stars down each side of the frame
    for (let y = y0 + 12; y < y1 - 8; y += 14) { starAt(p, x0 + 7, y, false); starAt(p, x1 - 7, y + 7, false); }
    // tooled arcs above and below the medallion
    for (let i = 0; i <= 30; i++) {
      const t = Math.PI * (1.15 + (i / 30) * 0.7), rr = G.r + 7;
      p.set(G.cx + Math.cos(t) * rr, G.cy + Math.sin(t) * rr, BRASS[3]);
      p.set(G.cx + Math.cos(t + Math.PI) * rr, G.cy + Math.sin(t + Math.PI) * rr, BRASS[2]);
    }
    paintOwlEmblem(p, G.cx, G.cy, G.r);
    // the title plate
    const { pl } = G;
    for (let x = pl.x + 1; x <= pl.x + pl.w; x++) p.set(x, pl.y + pl.h, LEA[0]);
    for (let y = pl.y + 1; y <= pl.y + pl.h; y++) p.set(pl.x + pl.w, y, LEA[0]);
    for (let y = pl.y; y < pl.y + pl.h; y++) for (let x = pl.x; x < pl.x + pl.w; x++) {
      const lx = x - pl.x, ly = y - pl.y, rx = pl.w - 1 - lx, ry = pl.h - 1 - ly, e = Math.min(lx, ly, rx, ry);
      if (e === 0 && (lx === 0 || rx === 0) && (ly === 0 || ry === 0)) continue;
      let c = (ly / pl.h < 0.5 || bay(x, y) < 0.55) ? PAPER[5] : PAPER[4];
      if (e === 0) c = BRASS[0];
      else if (e === 1) c = ly === 1 ? BRASS[5] : ry === 1 ? BRASS[1] : lx === 1 ? BRASS[4] : BRASS[2];
      else if (e === 2) c = ry === 2 ? PAPER[2] : PAPER[3];
      p.set(x, y, c);
    }
    for (const [sx, sy] of [[pl.x + 3, pl.y + 3], [pl.x + pl.w - 4, pl.y + 3], [pl.x + 3, pl.y + pl.h - 4], [pl.x + pl.w - 4, pl.y + pl.h - 4]]) { p.set(sx, sy, BRASS[2]); p.set(sx - 1, sy - 1, BRASS[4]); }
    // wear: a few scuffs on the leather
    const R = rnd(77);
    for (let i = 0; i < 18; i++) { const x = 8 + R() * (cw - 16), y = 8 + R() * (ch - 16); if (p.a(x, y)) p.mix(x, y, LEA[6], 0.5); }
    return p;
  });
}
/** Inside of the front cover for the one-page book: leather turn-ins around marbled paper. */
export function coverBackArt(cw, ch, B) {
  return art(`coverback:${cw}x${ch}:${B}`, () => {
    const p = new Px(cw, ch);
    paintBoard(p, cw, ch, 'L', 61);
    p.draw(paintEndpaper(cw - 2 * B + 4, ch - 2 * B + 4), B - 2, B - 2);
    return p;
  });
}

/** The spine as seen from the side while Pip drags the shut book in (D texels thick). */
export function spineArt(D, ch) {
  return art(`spine:${D}x${ch}`, () => {
    const p = new Px(D, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < D; x++) {
      const u = x / (D - 1);
      let v = leatherV(x + 90, y, 12) - 0.4 + Math.sin(u * Math.PI) * 1.0;
      let c = LEA[clamp(Math.floor(v + bay(x, y)), 1, 6)];
      if (x === 0 || x === D - 1 || y === 0 || y === ch - 1) c = LEA[0];
      p.set(x, y, c);
    }
    // raised bands with gold lines
    for (const f of [0.12, 0.26, 0.74, 0.88]) {
      const y = Math.round(ch * f);
      for (let x = 1; x < D - 1; x++) { p.set(x, y - 1, LEA[6]); p.set(x, y, BRASS[3]); p.set(x, y + 1, LEA[1]); }
    }
    // a gold star and moon between the bands
    starAt(p, Math.round(D / 2), Math.round(ch * 0.19), false);
    const my = Math.round(ch * 0.81), mx = Math.round(D / 2);
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) < 3.2 && Math.hypot(x - 1.4, y - 1) > 2.6) p.set(mx + x, my + y, BRASS[4]);
    return p;
  });
}
/** Page block edges: 'fore' (D wide, ch tall, lines run down) or 'head' (cw wide, D tall). */
export function blockEdgeArt(w, h, kind) {
  return art(`edge:${kind}:${w}x${h}`, () => {
    const p = new Px(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = kind === 'fore' ? x : y, along = kind === 'fore' ? y : x;
      let c = k % 2 ? PAPER[3] : PAPER[4];
      if (h2(k, Math.floor(along / 9), 5) < 0.18) c = PAPER[2];
      if (kind === 'fore' && (x === 0 || x === w - 1)) c = LEA[1];
      if (kind === 'head' && (y === 0 || y === h - 1)) c = LEA[1];
      p.set(x, y, c);
    }
    return p;
  });
}
/** The brass clasp: a leather strap over the fore edge with a brass tongue and a snap stud. */
export function claspArt() {
  return art('clasp', () => {
    const W = 30, H = 18, p = new Px(W, H);
    // strap (comes from the back board over the fore edge on the right)
    for (let y = 3; y < H - 3; y++) for (let x = 8; x < W; x++) {
      let c = LEA[clamp(Math.floor(leatherV(x, y, 5) - 1.4 + bay(x, y)), 1, 4)];
      if (y === 3) c = LEA[5]; else if (y === H - 4) c = LEA[0];
      if ((y === 5 || y === H - 6) && x % 3 === 0) c = BRASS[2]; // stitching
      p.set(x, y, c);
    }
    // brass tongue plate
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < 14; x++) {
      const lx = x - 1, ly = y - 1, rx = 12 - lx, ry = H - 3 - ly, e = Math.min(lx, ly, rx, ry);
      if (lx < 3 && (ly < 3 - lx || ry < 3 - lx)) continue;
      let c = BRASS[clamp(Math.floor(3.4 - (lx + ly) / 14 + bay(x, y) * 0.8), 2, 4)];
      if (e === 0) c = BRASS[0]; else if (e === 1 && (ly === 1 || lx === 1)) c = BRASS[5];
      p.set(x, y, c);
    }
    // snap stud
    p.disc(7, H / 2 - 0.5, 3.2, BRASS[1]); p.disc(7, H / 2 - 0.5, 2.4, BRASS[4]); p.set(6, 7, BRASS[5]); p.set(8, 10, BRASS[2]);
    for (const [x, y] of [[11, 3], [11, H - 4]]) { p.set(x, y, BRASS[1]); }
    return p;
  });
}
/** Ribbon tail hanging out of the book (swallowtail). */
export function ribbonArt(len, col = 'red') {
  return art(`rib:${col}:${len}`, () => {
    const R4 = RIBBONS[col] || RIBBONS.red, p = new Px(5, len);
    for (let y = 0; y < len; y++) for (let x = 0; x < 5; x++) {
      if (y >= len - 3 && Math.abs(x - 2) < 3 - (len - 1 - y)) continue;
      p.set(x, y, x === 0 ? R4[3] : x === 4 ? R4[1] : y === 0 ? R4[1] : y % 7 === 4 && x === 2 ? R4[1] : R4[2]);
    }
    return p;
  });
}
/** Cloth index tab: w texels out, h tall; 'right' sticks out to the right, 'left' and 'top' likewise. */
export function tabArt(col, w, h, orient = 'right') {
  return art(`tab:${col}:${w}x${h}:${orient}`, () => {
    const R4 = RIBBONS[col] || RIBBONS.green, tuck = 3;
    const q = new Px(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const rx = w - 1 - x, ry = h - 1 - y;
      if (rx < 2 && (y < 2 - rx || ry < 2 - rx)) continue;
      let c = R4[2];
      if (rx === 0 || y === 0 || ry === 0) c = R4[0];
      else if (y === 1) c = R4[3];
      else if (ry === 1 || rx === 1) c = R4[1];
      else if (bay(x, y) < 0.18 && x > tuck + 2) c = R4[1];
      if (x < tuck) { q.set(x, y, c, 200); continue; }
      if (x === tuck) c = R4[0];
      q.set(x, y, c);
    }
    for (let y = 3; y < h - 3; y += 2) q.set(w - 4, y, R4[4]);
    if (orient === 'right') return q;
    if (orient === 'left') { const p = new Px(w, h); p.draw(q, 0, 0, true); return p; }
    // top: rotate a quarter turn (out = up)
    const p = new Px(h, w);
    for (let y = 0; y < w; y++) for (let x = 0; x < h; x++) {
      const i = ((h - 1 - x) * w + (w - 1 - y)) * 4;
      if (q.d[i + 3]) p.set(x, y, [q.d[i], q.d[i + 1], q.d[i + 2]], q.d[i + 3]);
    }
    return p;
  });
}
/** The dog-eared page corner used as the "turn the page" button. side 'R' (bottom right) or 'L' (bottom left). */
export function cornerArt(side, n = 15) {
  return art(`corner:${side}:${n}`, () => {
    const p = new Px(n, n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = x + y - (n - 1); // > 0: the corner is folded away and the sheet below shows
      let c;
      if (d > 0) c = d < 3 ? PAPER[1] : PAPER[2];
      else {
        // the folded flap (the back of the paper), darker toward the crease, outlined on its free edges
        const k = -d;
        c = k < 2 ? PAPER[2] : k < 5 ? PAPER[3] : bay(x, y) < 0.3 ? PAPER[4] : PAPER[5];
        if (x === 0 || y === 0) c = PAPER[1];
      }
      p.set(side === 'R' ? x : n - 1 - x, y, c);
    }
    return p;
  });
}

// ------------------------------------------------------------------ small paper props
export function tapeArt(variant = 'pink', w = 26, h = 9, seed = 1) {
  return art(`tape:${variant}:${w}x${h}:${seed}`, () => {
    const V = {
      pink: ['#f4a6ba', '#fbd0dc', 'stripe'], mint: ['#94d8bc', '#d0f2e2', 'dots'], yellow: ['#f2d064', '#fff0a8', 'grid'],
      blue: ['#9cc0ec', '#d6e6fa', 'stripe'], plain: ['#e8dcc0', '#f6eedc', 'plain'], red: ['#e87a6a', '#fbc2b0', 'dots'], lilac: ['#c0a8ec', '#e6dcfa', 'stripe'],
    }[variant] || ['#f4a6ba', '#fbd0dc', 'stripe'];
    const c1 = hexc(V[0]), c2 = hexc(V[1]), pat = V[2], R = rnd(seed);
    const p = new Px(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let on = false;
      if (pat === 'stripe') on = ((x + y) % 6 + 6) % 6 < 2;
      else if (pat === 'dots') on = (x % 5 === 2 && y % 4 === 1) || (x % 5 === 0 && y % 4 === 3);
      else if (pat === 'grid') on = x % 4 === 0 || y % 4 === 0;
      p.set(x, y, on ? c1 : c2, 200 + (R() < 0.2 ? -25 : 0));
      if (y === 0) p.set(x, y, c2, 225);
      if (y === h - 1) p.set(x, y, c1, 205);
    }
    for (let y = 0; y < h; y++) {
      const j1 = (y % 3 === 1 ? 1 : 0) + (R() < 0.3 ? 1 : 0), j2 = (y % 3 === 0 ? 1 : 0) + (R() < 0.3 ? 1 : 0);
      for (let k = 0; k < j1; k++) p.clear(k, y);
      for (let k = 0; k < j2; k++) p.clear(w - 1 - k, y);
    }
    return p;
  });
}
/** A red pen swash to underline headings. */
export function swashArt(w, col = RED) {
  return art(`swash:${w}:${col}`, () => {
    const p = new Px(w, 6);
    for (let x = 0; x < w - 4; x++) {
      const y = 3 + Math.sin((x / w) * 5.2) * 0.9;
      p.set(x, y, col); if (x > 3 && x < w - 12) p.set(x, y + 1, col);
    }
    p.path([[w - 5, 3], [w - 3, 1], [w - 1, 0]], col);
    return p;
  });
}
/** A gold oval portrait frame (centre left clear). */
export function ovalFrameArt(w, h) {
  return art(`oval:${w}x${h}`, () => {
    const p = new Px(w, h), cx = (w - 1) / 2, cy = (h - 1) / 2, rx = w / 2 - 1, ry = h / 2 - 3;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      const th = 4.2 / Math.min(rx, ry);
      if (d > 1 || d < 1 - th) continue;
      const k = (1 - d) / th; // 0 outer .. 1 inner
      const lit = -((x - cx) / rx + (y - cy) / ry) * 0.9;
      let c = BRASS[clamp(Math.floor(3 + lit + bay(x, y) * 0.8 - Math.abs(k - 0.45) * 1.6), 1, 5)];
      if (k < 0.12 || k > 0.88) c = BRASS[0];
      // beading on the ring
      const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
      if (k > 0.35 && k < 0.6 && Math.round(a / (TAU / 48)) % 2 === 0 && Math.abs(a / (TAU / 48) - Math.round(a / (TAU / 48))) < 0.22) c = BRASS[5];
      p.set(x, y, c);
    }
    // a bow at the top, a little star at the bottom
    const tx = Math.round(cx), ty = 1;
    for (const [dx, dy, c] of [[-4, 0, 4], [-3, 0, 4], [-3, 1, 3], [-2, 1, 3], [-1, 1, 2], [0, 1, 1], [1, 1, 2], [2, 1, 3], [3, 1, 3], [3, 0, 4], [4, 0, 4], [-4, 2, 2], [4, 2, 2], [0, 2, 4], [0, 0, 5], [-1, 3, 2], [1, 3, 2], [-2, 4, 1], [2, 4, 1]]) p.set(tx + dx, ty + dy, BRASS[c]);
    starAt(p, Math.round(cx), h - 3, true);
    return p;
  });
}
/** Round score sticker with a scalloped white rim. */
export function stickerArt(col, n = 24) {
  return art(`sticker:${col}:${n}`, () => {
    const p = new Px(n, n), c = (n - 1) / 2, base = hexc(col);
    const dark = mixHex(col, '#1a0a08', 0.45), light = mixHex(col, '#ffffff', 0.35);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x - c, dy = y - c, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
      const R0 = n / 2 - 1 - (Math.cos(a * 10) > 0.3 ? 0 : 0.8);
      if (d > R0) continue;
      let k = d > R0 - 2 ? '#fffaf0' : d > R0 - 3 ? dark : null;
      if (!k) { const lit = -(dx + dy) / n; k = lit > 0.18 ? light : lit < -0.25 ? dark : base; if (bay(x, y) < 0.2 && lit > 0.05) k = light; }
      p.set(x, y, k);
    }
    p.set(Math.round(c - n * 0.22), Math.round(c - n * 0.22), '#ffffff');
    return p;
  });
}
/** A postmark-style ink ring (text goes on top in the DOM). */
export function stampRingArt(col, n = 44, seed = 1) {
  return art(`ring:${col}:${n}:${seed}`, () => {
    const p = new Px(n, n), c = (n - 1) / 2, R = rnd(seed);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const d = Math.hypot(x - c, y - c);
      const on = (d > n / 2 - 2.4 && d < n / 2 - 0.6) || (d > n / 2 - 6 && d < n / 2 - 5);
      if (on && R() > 0.16) p.set(x, y, col, 215);
    }
    for (let k = 0; k < 5; k++) { const a = -0.4 + k * 0.2; p.set(c + Math.cos(a) * (n / 2 - 3.4), c + Math.sin(a) * (n / 2 - 3.4), col, 200); }
    return p;
  });
}

// ------------------------------------------------------------------ wax seals and ink stamps
const EMB = {
  moon: ['....###....', '..####.....', '.####......', '.###.......', '####.......', '####.......', '####.......', '.###.......', '.####......', '..#####..#.', '....####...'],
  seven: ['.........', '#########', '#########', '......##.', '.....##..', '....##...', '...##....', '...##....', '..##.....', '..##.....', '..##.....'],
  three: ['.#######.', '##.....##', '.......##', '.......##', '...#####.', '.......##', '.......##', '.......##', '##.....##', '.#######.', '.........'],
  eight: ['..#####..', '.##...##.', '.##...##.', '.##...##.', '..#####..', '.##...##.', '##.....##', '##.....##', '.##...##.', '..#####..', '.........'],
  star: ['.....#.....', '.....#.....', '....###....', '....###....', '###########', '.#########.', '..#######..', '..#######..', '.####.####.', '.###...###.', '.##.....##.'],
  flame: ['.....#.....', '....##.....', '....###....', '...####....', '..#####.#..', '..########.', '.####.####.', '.###...###.', '.###...###.', '..###.###..', '...#####...'],
  sun: ['.....#.....', '.#...#...#.', '..#.....#..', '....###....', '...#####...', '##.#####.##', '...#####...', '....###....', '..#.....#..', '.#...#...#.', '.....#.....'],
  hush: ['#####......', '...#.......', '..#........', '.#.........', '#####.####.', '.........#.', '........#..', '.......#...', '......####.', '...........', '...........'],
  feather: ['........##.', '.......###.', '......####.', '.....####..', '....####...', '...#.##....', '..#.##.....', '..###......', '.##........', '.#.........', '#..........'],
  wind: ['.#####.....', '#.....#....', '......#....', '#####.#....', '...........', '#########..', '.........#.', '.........#.', '..#.....#..', '...#####...', '...........'],
  box: ['...........', '..#######..', '.#.......#.', '#########.#', '#...#...#.#', '#...#...#.#', '#..###..#.#', '#.......#.#', '#.......##.', '#########..', '...........'],
  wish: ['.........#.', '........###', '.........#.', '.......#...', '.....##....', '..#.#......', '.###.......', '#####......', '.###.......', '.#.#.......', '...........'],
  face: ['..#######..', '.#.......#.', '#.........#', '#..#...#..#', '#..#...#..#', '#.........#', '#.#.....#.#', '#..#...#..#', '#...###...#', '.#.......#.', '..#######..'],
  quill: ['.........##', '........###', '.......###.', '......###..', '.....###...', '....###....', '...###.....', '..#.#......', '.#.........', '##.........', '#..........'],
  compass: ['.....#.....', '....###....', '....#.#....', '...#...#...', '.##.....##.', '##...#...##', '.##.....##.', '...#...#...', '....#.#....', '....###....', '.....#.....'],
  chair: ['..#######..', '..#.....#..', '..#.....#..', '..#.....#..', '..#######..', '..#.....#..', '.#########.', '.#.......#.', '.#.......#.', '.#.......#.', '.#.......#.'],
  hat: ['......##...', '.....#..#..', '....#......', '....#......', '...#.......', '...#.......', '..#.....#..', '..#########', '.#.........', '###########', '...........'],
  crown: ['...........', '#....#....#', '##..###..##', '###.###.###', '###########', '###########', '#.#.#.#.#.#', '###########', '###########', '...........', '...........'],
  heart: ['...........', '.###...###.', '#####.#####', '###########', '###########', '###########', '.#########.', '..#######..', '...#####...', '....###....', '.....#.....'],
  phases: ['...#####...', '..#..####..', '.#...#####.', '#....######', '#....######', '#....######', '#....######', '#....######', '.#...#####.', '..#..####..', '...#####...'],
};
const SEAL_R = { red: 'bk_wax_red', gold: 'bk_wax_gold', green: 'bk_wax_green', blue: 'bk_wax_blue', purple: 'bk_wax_purple', pink: 'bk_wax_pink' };
/** A pressed wax seal (28 texels) with an embossed emblem. */
export function sealArt(color, emblem) {
  return art(`seal:${color}:${emblem}`, () => {
    const N = 30, c = (N - 1) / 2, ramp = RAMPS[SEAL_R[color] || 'bk_wax_red'];
    const p = new Px(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
      const r = 12.2 + Math.sin(a * 5 + 1) * 1.0 + Math.sin(a * 9) * 0.5 + (vn(a * 3, 0, 7) - 0.5) * 1.2;
      if (d > r) continue;
      let v = 2.5 + (-dx - dy) / r * 1.0;
      if (d > r - 1.4) v -= 0.9;
      if (d > 8.4 && d < 9.6) v -= 1.0; else if (d >= 9.6 && d < 10.6) v += 0.7;
      p.set(x, y, ramp[clamp(Math.floor(v + bay(x, y)), 0, 5)]);
    }
    const E = EMB[emblem] || EMB.star, ew = E[0].length, eh = E.length, ox = Math.round(c - ew / 2 + 0.5), oy = Math.round(c - eh / 2 + 0.5);
    E.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '#') return;
      p.set(ox + i, oy + j, ramp[1]);
      if (E[j - 1]?.[i] !== '#') p.set(ox + i, oy + j - 1, ramp[5]);
      if (E[j]?.[i + 1] !== '#' && E[j + 1]?.[i + 1] !== '#') p.set(ox + i + 1, oy + j + 1, ramp[2]);
    }));
    // a little drip of wax at the bottom
    for (let k = 0; k < 3; k++) p.set(Math.round(c + 6), Math.round(c + 12 + k), ramp[k ? 2 : 3]);
    p.set(Math.round(c + 6), Math.round(c + 15), ramp[1]);
    p.set(Math.round(c - 7), Math.round(c - 9), ramp[5]);
    return p;
  });
}
/** A seal not earned yet: a dashed pencil circle round a faint emblem. */
export function pencilSealArt(emblem) {
  return art(`pseal:${emblem}`, () => {
    const N = 30, c = (N - 1) / 2, p = new Px(N, N);
    for (let i = 0; i < 90; i++) { const a = (i / 90) * TAU; if (i % 6 < 4) p.set(c + Math.cos(a) * 12, c + Math.sin(a) * 12, GRAPHITE, 150); }
    const E = EMB[emblem] || EMB.star, ew = E[0].length, eh = E.length, ox = Math.round(c - ew / 2 + 0.5), oy = Math.round(c - eh / 2 + 0.5);
    E.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#' && h2(i, j, 3) < 0.8) p.set(ox + i, oy + j, GRAPHITE, 90); }));
    return p;
  });
}
const MOOD = [
  // groggy, meh, okay, good, wonderful (18 x 18 ink stamps)
  ['eyes:-', 'mouth:wave'], ['eyes:.', 'mouth:flat'], ['eyes:.', 'mouth:small'], ['eyes:.', 'mouth:smile'], ['eyes:^', 'mouth:grin'],
];
export const MOOD_INK = ['#5a3c8a', '#4a5a7a', '#1f6a7a', '#2f7a3a', '#b0640a'];
/** An ink stamp face for the morning mood (0 groggy .. 4 wonderful). */
export function moodArt(n) {
  return art(`mood:${n}`, () => {
    const N = 20, c = (N - 1) / 2, p = new Px(N, N), col = MOOD_INK[n] || MOOD_INK[2], R = rnd(n + 5);
    const put = (x, y) => { if (R() > 0.08) p.set(x, y, col, 255); };
    for (let i = 0; i < 64; i++) { const a = (i / 64) * TAU; put(c + Math.cos(a) * 8.6, c + Math.sin(a) * 8.6); put(c + Math.cos(a) * 9.4, c + Math.sin(a) * 9.4); }
    const [eyes, mouth] = MOOD[n] || MOOD[2];
    for (const s of [-1, 1]) {
      const ex = Math.round(c + s * 3.4), ey = Math.round(c - 2);
      if (eyes === 'eyes:-') { put(ex - 1, ey); put(ex, ey); put(ex + 1, ey); }
      else if (eyes === 'eyes:^') { put(ex - 1, ey + 1); put(ex, ey); put(ex + 1, ey + 1); }
      else { put(ex, ey); put(ex, ey - 1); put(ex + 1, ey); put(ex + 1, ey - 1); }
    }
    const my = Math.round(c + 3);
    if (mouth === 'mouth:wave') for (let x = -3; x <= 3; x++) put(c + x, my + (x % 2 ? 1 : 0));
    else if (mouth === 'mouth:flat') for (let x = -3; x <= 3; x++) put(c + x, my);
    else if (mouth === 'mouth:small') { for (let x = -2; x <= 2; x++) put(c + x, my + (Math.abs(x) < 2 ? 1 : 0)); }
    else if (mouth === 'mouth:smile') { for (let x = -3; x <= 3; x++) put(c + x, my + (Math.abs(x) < 2 ? 1 : Math.abs(x) < 3 ? 0 : -1)); }
    else { for (let x = -4; x <= 4; x++) { put(c + x, my - (Math.abs(x) === 4 ? 1 : 0)); if (Math.abs(x) < 4) put(c + x, my + (Math.abs(x) < 3 ? 2 : 1)); } put(c - 7, c - 7); put(c + 7, c - 6); }
    return p;
  });
}

// ------------------------------------------------------------------ Pip (sprite kit, auto-shaded)
// plumage per species: body ramp, belly/face ramp, tuft size, nightcap colour
const PLUME = {
  tawny: ['cinnamon', 'tan', 1], barn: ['straw', 'cream', 0], snowy: ['white', 'white', 0], burrowing: ['tan', 'sand', 0], sawwhet: ['cinnamon', 'cream', 0],
  little: ['grizzly', 'bone', 0], horned: ['bear', 'tan', 2], longeared: ['syrup', 'orange', 2], greatgrey: ['stone', 'grey', 0], eagle: ['syrup', 'sand', 2],
};
/**
 * Little Pip: frame 'stand' | 'blink' | 'pull' | 'pull2' | 'phew' | 'hop' | 'look'. Faces right.
 * eye: iris colour; cap: wears the nightcap.
 */
export function pipArt(frame, species = 'tawny', eye = '#2a1810', cap = true) {
  return art(`pip:${frame}:${species}:${eye}:${cap ? 1 : 0}`, () => {
    const [bodyR, bellyR, tufts] = PLUME[species] || PLUME.tawny;
    const W = 34, H = 34, g = new Grid(W, H);
    const pull = frame === 'pull' || frame === 'pull2', hop = frame === 'hop';
    const sy = hop ? 0.86 : 1, sx = hop ? 1.1 : 1;
    const foot = 31, bx = 15, by = foot - 10 * sy;
    // wings behind (pulling: the far wing reaches forward too)
    if (pull) g.ellipse(bx + 8, by - 4, 6.5, 2.6, 'w');
    g.ellipse(bx, by, 8.2 * sx, 9 * sy, 'B'); // body
    g.ellipse(bx + 0.5, by - 9.2 * sy, 9.4 * sx, 7.6 * sy, 'B'); // head
    if (tufts) { const t = tufts === 2 ? 3 : 2; g.poly([[bx - 7, by - 13], [bx - 7 - t * 0.4, by - 17 - t], [bx - 3, by - 15]], 'B'); g.poly([[bx + 7, by - 13], [bx + 8 + t * 0.4, by - 17 - t], [bx + 4, by - 15]], 'B'); }
    g.ellipse(bx + 1.5, by + 2, 5.2 * sx, 6.2 * sy, 'b', ['B']); // belly
    for (let k = 0; k < 4; k++) { const yy = by - 1 + k * 2.4; g.set(bx + 0 + (k % 2), yy, 'k'); g.set(bx + 3 - (k % 2), yy + 1, 'k'); }
    // facial disc and eyes (three-quarter view: shifted toward the book)
    const fx = bx + 2, fy = by - 9 * sy;
    g.ellipse(fx - 3.3, fy, 3.8, 3.6, 'D'); g.ellipse(fx + 3.6, fy, 3.8, 3.6, 'D');
    const strain = frame === 'pull2', happy = frame === 'phew', shut = frame === 'blink';
    for (const ex of [fx - 3.3, fx + 3.6]) {
      if (strain) { g.line(ex - 1.5, fy - 1, ex + 1, fy, 'K'); g.line(ex - 1.5, fy + 1, ex + 1, fy, 'K'); }
      else if (happy) { g.set(ex - 1.5, fy, 'K'); g.set(ex - 0.5, fy - 1, 'K'); g.set(ex + 0.5, fy - 1, 'K'); g.set(ex + 1.5, fy, 'K'); }
      else if (shut) { g.line(ex - 1.5, fy, ex + 1.5, fy, 'K'); }
      else { g.ellipse(ex + 0.3, fy, 2.2, 2.2, 'E'); g.ellipse(ex + 0.6, fy + 0.2, 1.1, 1.2, 'K'); g.set(ex - 0.4, fy - 1, '*'); }
    }
    g.poly([[fx - 0.6, fy + 1.4], [fx + 1.6, fy + 1.4], [fx + 0.5, fy + 4]], 'Y'); // beak
    // wings
    if (pull) { g.ellipse(bx + 8, by - 1, 7.2, 2.8, 'W'); g.ellipse(bx + 14, by - 2, 2.2, 2.0, 'W'); }
    else if (happy) { g.ellipse(bx - 7.5, by - 1, 3.2, 6.4, 'W'); g.ellipse(bx + 3, fy - 5, 5.5, 2.2, 'W'); }
    else { g.ellipse(bx - 7.6, by + 0.5, 3.4, 6.8 * sy, 'W'); g.ellipse(bx + 8.2, by + 0.5, 3.0, 6.4 * sy, 'W'); }
    // feet
    const fl = pull ? [bx - 4, bx + 6] : [bx - 3, bx + 3];
    for (const f of fl) { g.rect(f - 1, foot - 1, 3, 2, 'F'); g.set(f + 2, foot, 'F'); }
    // nightcap: a floppy cone that droops back, away from the book, with a pom on the end
    if (cap) {
      const hy = by - 9.2 * sy;
      g.poly([[bx - 8.5, hy - 4.5], [bx + 9, hy - 5.5], [bx + 6, hy - 10], [bx, hy - 13.5], [bx - 6, hy - 14.5], [bx - 11.5, hy - 12.5], [bx - 13, hy - 9]], 'C');
      g.line(bx - 4, hy - 11.5, bx + 4, hy - 9.5, 's'); g.line(bx - 10, hy - 11.5, bx - 6, hy - 13, 's');
      g.ellipse(bx + 0.5, hy - 5, 9.6, 2.2, 'c');
      g.ellipse(bx - 13.2, hy - 7.6, 2.6, 2.6, 'P');
    }
    if (strain || happy) { g.set(bx + 11, fy - 6, 'q'); g.set(bx + 11, fy - 5, 'q'); g.set(bx + 12, fy - 4, 'q'); }
    const key = {
      B: `${bodyR}.R@body`, b: `${bellyR}.r@belly`, D: `${bellyR}.r@disc`, W: `${bodyR}.x@wing`, w: `${bodyR}:1.x@wing2`,
      E: eye === '#2a1810' || eye === '#1a1210' ? '#3a2416' : eye, K: '#1a1014', Y: 'honey.r@beak', F: 'orange.r@feet',
      C: 'blue.R@cap', c: 'white.y@capband', P: 'white.R@pom', s: 'sky:5', q: 'sky.r@sweat',
    };
    return kit(g, key);
  });
}

// ------------------------------------------------------------------ ink doodles for empty pages
/** Pip asleep in a nest, in pen and highlighter (for "nothing here yet" pages). */
export function sleepDoodle() {
  return art('doodle:sleep', () => {
    const p = new Px(58, 42);
    const inE = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    for (let y = 0; y < 42; y++) for (let x = 0; x < 58; x++) {
      const owl = inE(x, y, 29, 22, 12, 11) || inE(x, y, 29, 15, 11, 8.5);
      const cap = y < 13 && y > 3 && inE(x, y, 30, 12, 12, 8) && x + y * 0.6 > 22 && !inE(x, y, 29, 15.5, 10.5, 7.5);
      const nest = y >= 28 && inE(x, y, 29, 28, 22, 9);
      if (nest) p.set(x, y, (x + y) % 5 === 0 ? '#b88848' : '#e2c088');
      else if (cap) p.set(x, y, (x + 2 * y) % 7 < 2 ? '#e8f0ff' : '#7aa0d8');
      else if (owl) p.set(x, y, inE(x, y, 25, 15, 3.8, 3.4) || inE(x, y, 33, 15, 3.8, 3.4) ? '#fbe8c4' : '#e8b878');
    }
    p.outline(INK);
    p.path([[22, 15], [23, 16], [26, 16], [27, 15]], INK); p.path([[31, 15], [32, 16], [35, 16], [36, 15]], INK);
    p.set(29, 18, '#d07a20'); p.set(29, 19, '#d07a20'); p.set(28, 18, '#d07a20');
    for (let x = 9; x < 50; x += 4) p.line(x, 30, x + 3, 35, INK_L);
    p.disc(47, 9, 2.2, '#ffffff'); p.ell(47, 9, 2.6, 2.6, INK);
    const z = (x, y, s) => p.path([[x, y], [x + s, y], [x, y + s], [x + s, y + s]], BLUE);
    z(48, 1, 3); z(53, 5, 2); z(42, 2, 2);
    return p;
  });
}
/** A doodled crescent moon with stars. */
export function moonDoodle() {
  return art('doodle:moon', () => {
    const p = new Px(30, 26);
    for (let y = 0; y < 26; y++) for (let x = 0; x < 30; x++) if (Math.hypot(x - 12, y - 13) <= 10 && Math.hypot(x - 17, y - 10) > 8.5) p.set(x, y, bay(x, y) < 0.25 ? '#fff0a0' : '#ffe07a');
    p.outline(INK);
    for (const [x, y] of [[24, 5], [27, 15], [22, 22]]) { p.set(x, y, INK); p.set(x - 1, y, INK); p.set(x + 1, y, INK); p.set(x, y - 1, INK); p.set(x, y + 1, INK); }
    return p;
  });
}

// ------------------------------------------------------------------ the adventure map
/**
 * An inked map of the lands Pip flies to: woods, grotto, lake, caverns and the peak, with the
 * tree house, hills, a compass rose and a border. Areas Pip has seen get a watercolour wash.
 * `areas`: [{ id, x, y, seen }] with x/y in 0..1.
 */
export function mapArt(w, h, areas) {
  const key = `map:${w}x${h}:${areas.map((a) => a.id + (a.seen ? 1 : 0)).join(',')}`;
  return art(key, () => {
    const p = new Px(w, h);
    const R = rnd(42);
    // aged map paper inside a double border
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = 3.3 + (vn(x / 13, y / 13, 8) - 0.5) * 0.8 + (vn(x / 4, y / 4, 2) - 0.5) * 0.3;
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (e < 8) v -= (8 - e) * 0.08;
      p.set(x, y, PAPER[clamp(Math.floor(v + bay(x, y)), 1, 5)]);
    }
    const box = (ins, c, a) => { for (let x = ins; x < w - ins; x++) { p.mix(x, ins, c, a); p.mix(x, h - 1 - ins, c, a); } for (let y = ins; y < h - ins; y++) { p.mix(ins, y, c, a); p.mix(w - 1 - ins, y, c, a); } };
    box(0, INK, 0.9); box(2, INK, 0.6); box(3, PAPER[1], 0.6);
    const wash = (cx, cy, rx, ry, col, a) => {
      for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y++) for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry) + (vn(x / 4, y / 4, 3) - 0.5) * 0.5;
        if (d < 1) p.mix(x, y, col, a * (d > 0.8 ? 0.55 : 1));
        else if (d < 1.08) p.mix(x, y, col, a * 1.4);
      }
    };
    const A = Object.fromEntries(areas.map((a) => [a.id, { ...a, X: 8 + a.x * (w - 16), Y: 8 + a.y * (h - 16) }]));
    const S = Math.min(w, h) / 120; // doodle scale
    // the lake first (it is a shape on the land)
    if (A.lake) { const L = A.lake; wash(L.X, L.Y, 16 * S, 9 * S, '#6aa8d8', L.seen ? 0.5 : 0.18); p.ell(L.X, L.Y, 16 * S, 9 * S, INK, 0, TAU, 0.12, 9); for (let k = 0; k < 4; k++) { const yy = L.Y - 3 * S + k * 2.2 * S; p.line(L.X - 6 * S + k * 2, yy, L.X - 2 * S + k * 2, yy, BLUE, 160); } }
    // hills scattered around
    for (let i = 0; i < 9; i++) {
      const x = 14 + R() * (w - 28), y = 14 + R() * (h - 28), s = (3 + R() * 3) * S;
      if (Object.values(A).some((a) => Math.hypot(a.X - x, a.Y - y) < 18 * S)) continue;
      p.path([[x - s * 1.4, y], [x - s * 0.5, y - s * 0.8], [x + s * 0.2, y - s * 0.5], [x + s * 1.4, y]], INK_L);
    }
    const tree = (x, y, s, col) => {
      p.ell(x, y - s * 1.2, s, s * 1.1, INK, 0, TAU, 0.2, (x * 7 + y) | 0);
      p.fill(Math.round(x), Math.round(y - s * 1.2), col);
      p.line(x, y - s * 0.2, x, y + s * 0.5, INK);
    };
    for (const a of Object.values(A)) {
      const { X, Y } = a, ink = a.seen ? INK : GRAPHITE, al = a.seen ? 255 : 120;
      if (a.id === 'woods') {
        if (a.seen) wash(X, Y, 15 * S, 10 * S, '#7ab060', 0.45);
        for (const [dx, dy] of [[-9, 2], [-3, -3], [4, 1], [10, -2], [-6, 7], [2, 7], [8, 6]]) tree(X + dx * S, Y + dy * S, 2.6 * S, a.seen ? '#5f9a52' : PAPER[2]);
      } else if (a.id === 'grotto') {
        if (a.seen) wash(X, Y, 13 * S, 8 * S, '#d08ab0', 0.4);
        p.ell(X, Y + 2 * S, 9 * S, 7 * S, ink, Math.PI, TAU, 0.05, 2); p.line(X - 9 * S, Y + 2 * S, X + 9 * S, Y + 2 * S, ink, al);
        p.ell(X, Y + 2 * S, 4 * S, 4 * S, ink, Math.PI, TAU, 0, 1); p.fill(Math.round(X), Math.round(Y), '#3a2a40');
        for (const dx of [-11, 10]) { p.ell(X + dx * S, Y - 1 * S, 3 * S, 2 * S, ink, Math.PI, TAU, 0, 3); p.line(X + dx * S, Y - 1 * S, X + dx * S, Y + 3 * S, ink, al); p.fill(Math.round(X + dx * S), Math.round(Y - 2 * S), a.seen ? '#e06aa0' : PAPER[2]); }
      } else if (a.id === 'caverns') {
        if (a.seen) wash(X, Y, 13 * S, 9 * S, '#a08ad8', 0.4);
        for (const [dx, hh] of [[-6, 9], [-1, 13], [4, 10], [8, 7]]) { const x = X + dx * S, y = Y + 5 * S; p.path([[x - 2 * S, y], [x, y - hh * S], [x + 2 * S, y], [x - 2 * S, y]], ink, al); p.fill(Math.round(x), Math.round(y - 2 * S), a.seen ? '#b8a0f0' : PAPER[2]); }
        p.line(X - 10 * S, Y + 5 * S, X + 11 * S, Y + 5 * S, ink, al);
      } else if (a.id === 'peak') {
        if (a.seen) wash(X, Y, 14 * S, 10 * S, '#f0c860', 0.4);
        p.path([[X - 14 * S, Y + 7 * S], [X - 3 * S, Y - 10 * S], [X + 2 * S, Y - 4 * S], [X + 5 * S, Y - 7 * S], [X + 14 * S, Y + 7 * S]], ink, al);
        p.path([[X - 6 * S, Y - 5 * S], [X - 3 * S, Y - 3 * S], [X - 1 * S, Y - 6 * S]], ink, al);
        starAt(p, Math.round(X + 6 * S), Math.round(Y - 13 * S), true);
      } else if (a.id !== 'lake') {
        p.disc(X, Y, 4 * S, a.seen ? '#c0a070' : PAPER[2]); p.ell(X, Y, 4 * S, 4 * S, ink);
      }
      if (!a.seen) { // a pencil question mark over places not visited yet
        const qx = Math.round(X + 7 * S), qy = Math.round(Y - 9 * S);
        p.path([[qx - 2, qy - 1], [qx - 1, qy - 3], [qx + 1, qy - 3], [qx + 2, qy - 1], [qx, qy + 1], [qx, qy + 2]], GRAPHITE); p.set(qx, qy + 4, GRAPHITE);
      }
    }
    // the tree house (home), bottom left
    const hx = 16 * S + 8, hy = h - 18 * S - 8;
    tree(hx, hy, 4.2 * S, '#4f8a46');
    p.rect(Math.round(hx - 2), Math.round(hy - 5 * S), 4, 3, '#a06a36'); p.set(Math.round(hx), Math.round(hy - 4 * S), '#ffd85a');
    // dotted flight paths from home to every place Pip has seen
    for (const a of Object.values(A)) {
      if (!a.seen) continue;
      const mx = (hx + a.X) / 2 + (a.Y - hy) * 0.18, my = (hy + a.Y) / 2 - (a.X - hx) * 0.18;
      for (let i = 2; i < 40; i++) {
        const t = i / 40, x = (1 - t) * (1 - t) * hx + 2 * (1 - t) * t * mx + t * t * a.X, y = (1 - t) * (1 - t) * hy + 2 * (1 - t) * t * my + t * t * a.Y;
        if (i % 3 === 0) p.set(x, y, RED, 220);
      }
    }
    // compass rose, top right
    const cx = w - 16 * S - 6, cy = 16 * S + 6, cr = 9 * S;
    p.ell(cx, cy, cr * 0.7, cr * 0.7, INK);
    p.path([[cx, cy - cr], [cx + 2, cy], [cx, cy + cr], [cx - 2, cy], [cx, cy - cr]], INK); p.fill(Math.round(cx + 1), Math.round(cy - 3), RED);
    p.path([[cx - cr, cy], [cx, cy - 2], [cx + cr, cy], [cx, cy + 2], [cx - cr, cy]], INK);
    // sea serpent? no: a little cloud and a flying owl silhouette for charm
    p.ell(w * 0.55, 14 * S, 6 * S, 2.5 * S, INK_L, Math.PI, TAU, 0.2, 4);
    return p;
  });
}

// ------------------------------------------------------------------ the HUD book icon
// 24 x 30 texels: the shut book in three layers so the cover can lift on hover (like BME's menu book)
const HW = 24, HH = 30, HCW = 20, HCH = 25;
export const HUD_BOOK = { w: HW, h: HH, cw: HCW, ch: HCH, rib: [6, 25, 3, 5] };
export function hudCover() {
  return art('hud:cover', () => {
    const p = new Px(HW, HH);
    for (let y = 0; y < HCH; y++) for (let x = 0; x < HCW; x++) {
      const rx = HCW - 1 - x, ry = HCH - 1 - y;
      let v = leatherV(x, y, 5) + 0.4 - (x / HCW + y / HCH) * 0.5;
      if (x <= 3) v -= 0.8;
      let c = LEA[clamp(Math.floor(v + bay(x, y)), 1, 6)];
      if (x === 4) c = LEA[1]; else if (x === 5) c = LEA[5];
      if (x === 0 || y === 0 || rx === 0 || ry === 0) c = LEA[0];
      else if (y === 1) c = x <= 3 ? LEA[4] : LEA[6];
      else if (ry === 1 || rx === 1) c = LEA[2];
      else if (x === 1) c = LEA[4];
      p.set(x, y, c);
    }
    for (const by of [4, 19]) for (let x = 1; x <= 3; x++) { p.set(x, by, BRASS[4]); p.set(x, by + 1, BRASS[2]); p.set(x, by + 2, LEA[1]); }
    // the medallion: brass ring, owl face, moon
    const cx = 12.5, cy = 10.5;
    for (let y = 4; y < 18; y++) for (let x = 6; x < 20; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > 6.2) continue;
      if (d > 5) { p.set(x, y, (x + y) < cx + cy ? BRASS[4] : BRASS[2]); continue; }
      p.set(x, y, LEA[2]);
    }
    const OWL = ['.#.....#.', '.##...##.', '.#######.', '##o###o##', '#ooo#ooo#', '##o#y#o##', '.###y###.', '..#####..', '...###...'];
    OWL.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const x = 8 + i, y = 6 + j;
      p.set(x, y, ch === 'o' ? (j === 4 && (i === 2 || i === 6) ? LEA[0] : BRASS[5]) : ch === 'y' ? BRASS[1] : j < 3 ? BRASS[4] : BRASS[3]);
    }));
    p.set(17, 6, BRASS[5]); p.set(18, 7, BRASS[4]); p.set(17, 8, BRASS[4]);
    // little title plate
    for (let x = 7; x < 18; x++) { p.set(x, 19, PAPER[5]); p.set(x, 20, PAPER[4]); p.set(x, 21, BRASS[1]); }
    for (let x = 8; x < 17; x += 2) p.set(x, 20, INK);
    brassCornerSmall(p, HCW - 1, 0, -1, 1); brassCornerSmall(p, HCW - 1, HCH - 1, -1, -1);
    return p;
  });
}
function brassCornerSmall(p, cx, cy, dx, dy) { brassCorner(p, cx, cy, dx, dy, 5); }
export function hudBase() {
  return art('hud:base', () => {
    const p = new Px(HW, HH);
    for (let y = 3; y < HCH + 3; y++) for (let x = 3; x < HCW + 3; x++) {
      const e = x === HCW + 2 || y === HCH + 2 || x === 3 || y === 3;
      p.set(x, y, e ? LEA[0] : LEA[clamp(Math.floor(leatherV(x, y, 9) - 1.2 + bay(x, y)), 1, 3)]);
    }
    for (let y = 1; y < HCH + 2; y++) for (let x = 1; x < HCW + 2; x++) {
      let c = PAPER[4];
      if (x >= HCW) c = x === HCW ? PAPER[4] : y % 2 ? PAPER[3] : PAPER[2];
      if (y >= HCH) c = y === HCH ? PAPER[4] : x % 3 === 0 ? PAPER[1] : PAPER[2];
      if (x === HCW + 1 && y >= HCH) c = PAPER[1];
      p.set(x, y, c);
    }
    for (let y = 1; y < HCH - 1; y++) for (let x = 1; x < HCW - 1; x++) p.set(x, y, x < 3 ? PAPER[3] : bay(x, y) < 0.15 ? PAPER[4] : PAPER[5]);
    for (let y = 7; y < HCH - 2; y += 3) for (let x = 3; x < HCW - 2; x++) p.set(x, y, '#c4cfe0');
    for (let y = 1; y < HCH - 1; y++) p.set(5, y, MARGIN);
    // a tiny hypnogram scribble on page one
    p.path([[7, 5], [9, 5], [9, 9], [11, 9], [11, 6], [13, 6], [13, 10], [15, 10], [15, 5], [17, 5]], BLUE);
    p.path([[7, 13], [12, 13]], INK); p.path([[7, 16], [15, 16]], INK);
    return p;
  });
}
export function hudRibbon() {
  return art('hud:rib', () => {
    const [, , w, h] = HUD_BOOK.rib, p = new Px(w, h), R4 = RIBBONS.red;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (y === h - 1 && x === 1) continue; p.set(x, y, y === 0 ? R4[1] : x === 0 ? R4[3] : x === 1 ? R4[2] : R4[1]); }
    return p;
  });
}

// a plain 20 x 20 dock icon in the shared sprite set: <Px name="bigbook" />
icon('bigbook', { L: 'bk_lea.f@cover', l: 'bk_lea:1', S: 'bk_lea.x@spine', G: 'gold.R@g', g: 'gold:2', P: 'parch.f@pages', p: 'parch:2', r: 'red.x@rib', y: 'gold:5' }, () => {
  const g = new Grid(20, 20);
  g.rect(4, 2, 14, 15, 'P');
  for (let y = 3; y < 17; y += 2) g.set(17, y, 'p');
  g.rect(2, 1, 14, 16, 'L');
  g.rect(2, 1, 3, 16, 'S');
  g.ellipse(10.5, 7.5, 3.6, 3.6, 'G');
  g.set(9, 7, 'l').set(12, 7, 'l').set(10, 9, 'g').set(11, 9, 'g');
  g.set(8, 4, 'G').set(13, 4, 'G');
  g.rect(7, 12, 8, 2, 'G');
  g.set(15, 3, 'y').set(14, 15, 'g');
  g.rect(9, 17, 2, 3, 'r');
  return g.rows();
});
