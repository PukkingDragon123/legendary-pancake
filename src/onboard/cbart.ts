// Pixel art for the interview clipboard that the BME kit doesn't have: the spring clip, pencil
// tick boxes, the rubber stamp, a stepped (pixel-rounded) corner shape and the hardboard.
// Each is painted once into a small canvas at art resolution and shown with image-rendering:
// pixelated.
import { paperTexture } from './paper.js';

type RGB = [number, number, number];
const hexc = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

class Pix {
  readonly d: Uint8ClampedArray<ArrayBuffer>;
  constructor(readonly w: number, readonly h: number) { this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4)); }
  set(x: number, y: number, c: string | RGB | null, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, v = typeof c === 'string' ? hexc(c) : c;
    this.d[i] = v[0]; this.d[i + 1] = v[1]; this.d[i + 2] = v[2]; this.d[i + 3] = a;
  }
  a(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  rect(x: number, y: number, w: number, h: number, c: string | ((x: number, y: number) => string | null)) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, typeof c === 'function' ? c(i, j) : c);
  }
  ell(cx: number, cy: number, rx: number, ry: number, c: (nx: number, ny: number) => string | null) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this.set(x, y, c(nx, ny));
    }
  }
  outline(col = '#22140c') {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.a(x, y) && (this.a(x + 1, y) > 200 || this.a(x - 1, y) > 200 || this.a(x, y + 1) > 200 || this.a(x, y - 1) > 200)) add.push([x, y]);
    for (const [x, y] of add) this.set(x, y, col);
    return this;
  }
  url() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c.toDataURL();
  }
}
const cache = new Map<string, string>();
const once = (k: string, f: () => string) => { let v = cache.get(k); if (!v) { v = f(); cache.set(k, v); } return v; };

const STEEL = ['#2e3240', '#4c5064', '#7a7e94', '#a8acc0', '#d0d4e2', '#f2f4fa'];
const BRASS = ['#3a2610', '#5c4219', '#8d6c32', '#b8924c', '#dcbd72', '#f6e6ac'];

/** The clipboard's spring clip: a chrome plate with rivets, a rolled spring and a lever. */
export function clipURL() {
  return once('clip', () => {
    const W = 58, H = 30, p = new Pix(W, H);
    // the base plate riveted to the board
    p.rect(7, 12, W - 14, 14, (x, y) => STEEL[y === 12 ? 5 : y < 15 ? 4 : y > 23 ? 1 : (x + y) % 11 === 0 ? 4 : 3]);
    p.rect(9, 24, W - 18, 2, STEEL[1]);
    for (const x of [11, W - 12]) { p.ell(x, 19, 2.2, 2.2, (nx, ny) => STEEL[nx + ny < -0.4 ? 5 : nx + ny > 0.6 ? 1 : 3]); }
    // the rolled spring
    p.rect(12, 7, W - 24, 6, (x, y) => STEEL[[2, 4, 5, 4, 3, 1][y - 7]]);
    for (let x = 13; x < W - 12; x += 3) p.rect(x, 7, 1, 6, STEEL[1]);
    // the lever: a bent wire loop on top
    for (let x = 16; x < W - 16; x++) { p.set(x, 1, STEEL[4]); p.set(x, 2, STEEL[2]); }
    for (let y = 1; y < 8; y++) { p.set(15, y, STEEL[4]); p.set(16, y, STEEL[2]); p.set(W - 17, y, STEEL[3]); p.set(W - 16, y, STEEL[1]); }
    // a little brass maker's badge
    p.rect(W / 2 - 5, 16, 10, 5, (x, y) => BRASS[y === 16 ? 5 : y === 20 ? 1 : 3]);
    p.set(W / 2 - 3, 18, BRASS[0]); p.set(W / 2, 18, BRASS[0]); p.set(W / 2 + 2, 18, BRASS[0]);
    return p.outline().url();
  });
}

/** A hand-drawn pencil tick box (empty or ticked). */
export function boxURL(ticked: boolean) {
  return once('box' + ticked, () => {
    const p = new Pix(13, 13);
    const g = '#4a4a5a';
    for (let i = 1; i < 11; i++) { p.set(i, 2 + (i === 6 ? 1 : 0) - 1, g); p.set(i, 11, g); p.set(1, i, g); p.set(11 - (i === 4 ? 1 : 0), i, g); }
    if (ticked) {
      const ink = '#2a3f8f', hi = '#4a64c0';
      for (const [x, y] of [[3, 6], [4, 7], [5, 8], [6, 9], [7, 8], [8, 6], [9, 5], [10, 3], [11, 2], [12, 0]] as [number, number][]) { p.set(x, y, ink); p.set(x, y - 1, hi); }
    }
    return p.url();
  });
}

/** The rubber stamp: red rubber, a varnished handle and a round knob. */
export function stampToolURL() {
  return once('stamp', () => {
    const W = 30, H = 34, p = new Pix(W, H);
    const red = ['#4e1422', '#80202e', '#b0303a', '#d9453b', '#f07a52'];
    const wood = ['#3b2414', '#55331a', '#8b5a2b', '#a86d38', '#c98f55', '#e0b07a'];
    p.ell(15, 6, 6, 5.4, (nx, ny) => red[Math.max(0, Math.min(4, Math.round(2.4 - nx * 1.2 - ny * 1.6)))]);
    p.rect(13, 11, 4, 9, (x) => wood[x === 13 ? 4 : x === 16 ? 1 : 3]);
    p.rect(5, 20, 20, 5, (x, y) => wood[y === 20 ? 5 : y === 24 ? 1 : x < 7 ? 4 : 3]);
    p.rect(4, 25, 22, 2, wood[2]);
    p.rect(5, 27, 20, 4, (x, y) => red[y === 27 ? 1 : 3 - (x % 5 === 0 ? 1 : 0)]);
    return p.outline().url();
  });
}

/** Speckle mask for the inked stamp (rubber that didn't quite touch the paper). */
export function speckURL() {
  return once('speck', () => {
    const N = 32, p = new Pix(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, r = h - Math.floor(h);
      const h2 = Math.sin((x >> 2) * 3.1 + (y >> 2) * 7.7) * 9871.3, r2 = h2 - Math.floor(h2);
      p.set(x, y, '#000000', r < 0.1 || (r2 < 0.18 && r < 0.4) ? 50 : 255);
    }
    return p.url();
  });
}

/** Hardboard for the clipboard back. */
export const boardURL = (w: number, h: number) => paperTexture('board', w, h, { px: 3, edge: 0.6, edgeW: 6, seed: 4 });
/** One sheet of ruled paper (lines every 8 texels, a red margin). */
export const sheetURL = (w: number, h: number, seed = 3) => paperTexture('notebook', w, h, { px: 3, rules: 8, ruleTop: 18, margin: 9, edge: 0.35, edgeW: 5, seed });

/** A clip-path polygon with two-step pixel corners (s = step size in px). */
export function pixelCorners(s = 4) {
  const L = (v: number) => `${v}px`, R = (v: number) => `calc(100% - ${v}px)`;
  const pts = [
    [L(0), L(2 * s)], [L(s), L(2 * s)], [L(s), L(s)], [L(2 * s), L(s)], [L(2 * s), L(0)],
    [R(2 * s), L(0)], [R(2 * s), L(s)], [R(s), L(s)], [R(s), L(2 * s)], [R(0), L(2 * s)],
    [R(0), R(2 * s)], [R(s), R(2 * s)], [R(s), R(s)], [R(2 * s), R(s)], [R(2 * s), R(0)],
    [L(2 * s), R(0)], [L(2 * s), R(s)], [L(s), R(s)], [L(s), R(2 * s)], [L(0), R(2 * s)],
  ];
  return `polygon(${pts.map(([x, y]) => `${x} ${y}`).join(',')})`;
}
