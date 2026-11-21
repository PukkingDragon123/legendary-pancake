// A tiny pixel painter for the sleep, clock and morning screens: an RGBA texel buffer with
// discs, ellipses, polygons, lines, lit material ramps (BME's hue-shifted ramps), dithering and
// an automatic warm-ink outline. Art is drawn at pixel resolution and shown scaled up crisp.
import { RAMPS } from './sprites.js';

export { RAMPS };
export const INK = '#2a1a14';
export type Col = string | number | null;
export type Fill = Col | ((x: number, y: number) => Col);

const packCache = new Map<string, number>();
/** '#rrggbb' (or '#rgb') -> packed little-endian ABGR */
export function pack(c: string): number {
  let v = packCache.get(c);
  if (v === undefined) {
    let s = c.replace('#', '');
    if (s.length === 3) s = s.split('').map((k) => k + k).join('');
    const n = parseInt(s.slice(0, 6), 16), a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255;
    v = ((a << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
    packCache.set(c, v);
  }
  return v;
}
/** tone k (0 dark .. 5 light) of a named ramp, clamped */
export const tone = (ramp: string, k: number) => { const r = RAMPS[ramp] ?? RAMPS.wood; return r[Math.max(0, Math.min(r.length - 1, Math.round(k)))]; };
/** 4x4 ordered dither threshold */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];
/** dithered tone pick: a fractional tone becomes a pattern of the two neighbours */
export const dtone = (ramp: string, k: number, x: number, y: number) => tone(ramp, Math.floor(k + bayer(x, y)));
export function hash(x: number, y: number, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Art {
  readonly w: number;
  readonly h: number;
  readonly d: Uint32Array;
  readonly img: ImageData;
  constructor(w: number, h: number) {
    this.w = w; this.h = h;
    this.img = new ImageData(w, h);
    this.d = new Uint32Array(this.img.data.buffer);
  }
  clear() { this.d.fill(0); return this; }
  copy(o: Art) { this.d.set(o.d); return this; }
  get(x: number, y: number) { x = Math.round(x); y = Math.round(y); return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; }
  has(x: number, y: number) { return (this.get(x, y) >>> 24) > 0; }
  px(x: number, y: number, c: Col) {
    if (c === null) return this;
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.d[y * this.w + x] = typeof c === 'number' ? c : pack(c);
    return this;
  }
  private fill(x: number, y: number, f: Fill) { this.px(x, y, typeof f === 'function' ? f(x, y) : f); }
  rect(x: number, y: number, w: number, h: number, f: Fill) {
    x = Math.round(x); y = Math.round(y);
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.fill(i, j, f);
    return this;
  }
  /** pixels whose centres lie within radius r of (cx, cy); f gets (x, y) */
  disc(cx: number, cy: number, r: number, f: Fill) { return this.ell(cx, cy, r, r, f); }
  ell(cx: number, cy: number, rx: number, ry: number, f: Fill) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.fill(x, y, f);
    }
    return this;
  }
  /** filled polygon (pixel centres inside) */
  poly(pts: [number, number][], f: Fill) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.fill(x, y, f);
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, f: Fill) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 2000; n++) {
      this.fill(x0, y0, f);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return this;
  }
  /** a line from a pivot at an angle (0 = straight down, positive = clockwise from the viewer) */
  ray(x: number, y: number, ang: number, len: number, f: Fill, from = 0) {
    return this.line(x - Math.sin(ang) * from, y + Math.cos(ang) * from, x - Math.sin(ang) * len, y + Math.cos(ang) * len, f);
  }
  /** a 1px outline (4-neighbour) around everything drawn so far, in `ink`; `only` limits where */
  outline(ink: string = INK, only?: (x: number, y: number) => boolean) {
    const W = this.w, H = this.h, src = this.d.slice(), c = pack(ink);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (src[i] >>> 24) continue;
      const n = (x > 0 && src[i - 1] >>> 24) || (x < W - 1 && src[i + 1] >>> 24) || (y > 0 && src[i - W] >>> 24) || (y < H - 1 && src[i + W] >>> 24);
      if (n && (!only || only(x, y))) this.d[i] = c;
    }
    return this;
  }
  /** draw another art on top (transparent pixels skipped) */
  stamp(o: Art, dx: number, dy: number) {
    dx = Math.round(dx); dy = Math.round(dy);
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const v = o.d[y * o.w + x];
      if (v >>> 24) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.d[Y * this.w + X] = v; }
    }
    return this;
  }
  /** darken or lighten existing pixels toward a colour (0..1) */
  tint(x: number, y: number, w: number, h: number, c: string, t: number, mask?: (x: number, y: number) => boolean) {
    const p = pack(c), r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
    for (let j = Math.max(0, y); j < Math.min(this.h, y + h); j++) for (let i = Math.max(0, x); i < Math.min(this.w, x + w); i++) {
      if (mask && !mask(i, j)) continue;
      const k = j * this.w + i, v = this.d[k];
      if (!(v >>> 24)) continue;
      const R = v & 255, G = (v >> 8) & 255, B = (v >> 16) & 255;
      this.d[k] = ((v >>> 24) << 24 | (Math.round(B + (b - B) * t) << 16) | (Math.round(G + (g - G) * t) << 8) | Math.round(R + (r - R) * t)) >>> 0;
    }
    return this;
  }
  put(ctx: CanvasRenderingContext2D, x = 0, y = 0) { ctx.putImageData(this.img, x, y); }
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    this.put(c.getContext('2d')!);
    return c;
  }
  url(scale = 1): string {
    if (scale === 1) return this.canvas().toDataURL();
    const c = document.createElement('canvas');
    c.width = this.w * scale; c.height = this.h * scale;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.canvas(), 0, 0, c.width, c.height);
    return c.toDataURL();
  }
}

/** light from the top-left: returns -1 (shadow) .. 1 (lit) for an offset inside a shape of radius r */
export const lit = (dx: number, dy: number, r: number) => (-dx * 0.6 - dy * 0.8) / Math.max(1, r);
/** a lit, dithered material fill for a disc / ellipse: centre (cx, cy), radius r */
export const ballShade = (ramp: string, cx: number, cy: number, r: number, base = 3, amt = 2.2) => (x: number, y: number) => dtone(ramp, base + lit(x + 0.5 - cx, y + 0.5 - cy, r) * amt, x, y);

// ------------------------------------------------------------------ tiny pixel font (3x5)

const G3: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'], ':': ['.', '#', '.', '#', '.'], ' ': ['.', '.', '.', '.', '.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'], P: ['##.', '#.#', '##.', '#..', '#..'], M: ['#.#', '###', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
};
/** draw text in the 3x5 pixel font; returns the width */
export function text3(a: Art, s: string, x: number, y: number, c: Col) {
  let cx = x;
  for (const ch of s) {
    const g = G3[ch] ?? G3[' '];
    g.forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') a.px(cx + rx, y + ry, c); }));
    cx += g[0].length + 1;
  }
  return cx - x - 1;
}
export const text3w = (s: string) => [...s].reduce((w, ch) => w + (G3[ch] ?? G3[' '])[0].length + 1, -1);
