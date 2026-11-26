// A tiny pixel-art painter for the globe screen: postcards, passport stamps, pins, plaques. Everything is
// drawn texel by texel on a small canvas (stepped circles and rings, Bayer dither, Bresenham lines, scanline
// polygons, a 3x5 pixel font) and shown scaled up with nearest-neighbour filtering. No smooth shapes.
// [globe] OWNED BY THE GLOBE BUILDER.

import { textSafe, canvasText, textWidth } from '../font.ts';

export type C = number; // 0xRRGGBB
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

export function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 144665) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number, s = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm1 = (x: number, s = 0, oct = 3) => { let t = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, 0.5, s + i * 13); a *= 0.5; f *= 2.1; } return t / (1 - Math.pow(0.5, oct)); };

export const mix = (a: C, b: C, t: number): C => {
  const m = (sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
};
export const mul = (a: C, k: number): C => {
  const m = (sh: number) => Math.max(0, Math.min(255, Math.round(((a >> sh) & 255) * k)));
  return (m(16) << 16) | (m(8) << 8) | m(0);
};
export const css = (c: C) => '#' + c.toString(16).padStart(6, '0');

// 3x5 pixel font (uppercase, digits, a little punctuation); accents fall back to the plain letter
const F: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '010101101101010', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010', '9': '010101011001110',
  '.': '000000000000010', ',': '000000000010100', '-': '000000111000000', '/': '001001010100100', ':': '000010000010000', "'": '010010000000000',
  '·': '000000010000000', '!': '010010010000010', '?': '110001010000010', ' ': '000000000000000', '&': '010101010101011', '°': '010101010000000',
};
const plain = (ch: string) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

export class Pix {
  readonly data: Int32Array;
  constructor(readonly w: number, readonly h: number) { this.data = new Int32Array(w * h).fill(-1); }
  set(x: number, y: number, c: C) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.data[y * this.w + x] = c; }
  get(x: number, y: number): number { x |= 0; y |= 0; return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.data[y * this.w + x] : -1; }
  clear(x: number, y: number) { this.set(x, y, -1 as unknown as C); }
  rect(x: number, y: number, w: number, h: number, c: C) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  /** fill a rect with a Bayer pattern of `c` over what's there (k = 0..1 coverage) */
  dither(x: number, y: number, w: number, h: number, c: C, k: number) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bayer(x + i, y + j) < k) this.set(x + i, y + j, c); }
  hline(x0: number, x1: number, y: number, c: C) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c); }
  vline(x: number, y0: number, y1: number, c: C) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c); }
  line(x0: number, y0: number, x1: number, y1: number, c: C) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) { this.set(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  /** scanline polygon fill (pixel centres) */
  poly(pts: [number, number][], c: C) {
    let y0 = Infinity, y1 = -Infinity;
    for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      const yc = y + 0.5, xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) this.set(x, y, c);
    }
  }
  /** a filled pixel disc (stepped circle) */
  disc(cx: number, cy: number, r: number, c: C) { for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + r * 0.6) this.set(x, y, c); }
  /** a 1px stepped ring */
  ring(cx: number, cy: number, r: number, c: C) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (Math.abs(d - r) < 0.5) this.set(x, y, c);
    }
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: C) { for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05) this.set(x, y, c); }
  /** 3x5 pixel text; returns the width drawn */
  text(x: number, y: number, s: string, c: C, gap = 1): number {
    let cx = x;
    for (const ch0 of s) {
      const g = F[ch0] ?? F[plain(ch0)] ?? F['?'];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') this.set(cx + i, y + j, c);
      cx += 3 + gap;
    }
    return cx - x - gap;
  }
  static textWidth(s: string, gap = 1) { return [...s].length * (3 + gap) - gap; }
  /** an outline (1px, `c`) round every opaque pixel */
  outline(c: C) {
    const src = this.data.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (src[y * this.w + x] !== -1) continue;
      const n = (i: number, j: number) => i >= 0 && j >= 0 && i < this.w && j < this.h && src[j * this.w + i] !== -1;
      if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) this.data[y * this.w + x] = c;
    }
  }
  /** draw sprite rows ('.' transparent, other chars from the key) */
  sprite(x: number, y: number, rows: string[], key: Record<string, C>) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && key[ch] !== undefined) this.set(x + i, y + j, key[ch]); })); }
  canvas(scale = 1): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w * scale; cv.height = this.h * scale;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(this.w, this.h);
    const u = new Uint32Array(img.data.buffer);
    for (let i = 0; i < this.data.length; i++) {
      const c = this.data[i];
      u[i] = c === -1 ? 0 : (0xff000000 | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
    }
    if (scale === 1) { g.putImageData(img, 0, 0); return cv; }
    const tmp = document.createElement('canvas');
    tmp.width = this.w; tmp.height = this.h;
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, 0, 0, cv.width, cv.height);
    return cv;
  }
  url(scale = 1): string { return this.canvas(scale).toDataURL(); }
  /**
   * [font6] The picture with Alegreya lettering drawn at the output resolution: each label centred on `cx`, its
   * baseline at `base` (art pixels), at `ratio` font pixels per art pixel where it fits `maxW` (art pixels),
   * stepping down a whole device pixel at a time; a label that can't fit at one device pixel is left out.
   */
  urlText(scale: number, labels: { text: string; cx: number; base: number; c: C; maxW: number; ratio?: number }[]): string {
    const cv = this.canvas(scale), g = cv.getContext('2d')!;
    for (const l of labels) {
      const s = textSafe(l.text), w = textWidth(s, 1);
      let n = Math.max(1, Math.round((l.ratio ?? 0.5) * scale));
      while (n > 1 && w * n > l.maxW * scale) n--;
      if (w * n > l.maxW * scale) continue;
      canvasText(g, s, Math.round(l.cx * scale), Math.round(l.base * scale), css(l.c), { n, align: 'center' });
    }
    return cv.toDataURL();
  }
}

/** Device-crisp scale for a sprite shown at `css` CSS px per art pixel. */
export const devScale = (cssPx: number) => Math.max(1, Math.round(cssPx * Math.min(3, devicePixelRatio || 1)));
