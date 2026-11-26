// Hand-painted pixel textures for Hollow & Co.'s office, painted texel by texel at runtime (no image files):
// mahogany and walnut with flowing grain and pores, tooled leather, oak herringbone parquet, an emerald damask
// wallpaper, a Persian rug, brass, paper with fibres, book cloth. Colours are rich and warm (the v4 "golden
// diorama" look); light is never baked in, only cavity/AO and wear. Every texture is crisp pixel art up close
// (nearest magnification) and calm far away (mipmapped minification).
import * as THREE from 'three';
import { textSafe } from '../ui/font.ts';

export type RGB = [number, number, number];
export const rgb = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const mix3 = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul3 = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ noise

export function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, y: number, s = 0) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.03, y * 2.03, s + 7) * 0.28 + vnoise(x * 4.1, y * 4.1, s + 13) * 0.17;
/** value noise that tiles with period p (integer) */
export function tnoise(x: number, y: number, p: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const m = (k: number) => ((k % p) + p) % p;
  const a = hash(m(xi), m(yi), s), b = hash(m(xi + 1), m(yi), s), c = hash(m(xi), m(yi + 1), s), d = hash(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

// ------------------------------------------------------------------ the canvas

/** A float RGBA painting surface; `texture()` quantises it into a crisp pixel texture. */
export class Tex {
  readonly d: Float32Array;
  readonly a: Float32Array;
  constructor(readonly w: number, readonly h: number, fill?: RGB) {
    this.d = new Float32Array(w * h * 3);
    this.a = new Float32Array(w * h).fill(1);
    if (fill) for (let i = 0; i < w * h; i++) { this.d[i * 3] = fill[0]; this.d[i * 3 + 1] = fill[1]; this.d[i * 3 + 2] = fill[2]; }
  }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x: number, y: number, c: RGB, a = 1) {
    x |= 0; y |= 0;
    if (!this.in(x, y)) return;
    const i = (y * this.w + x) * 3;
    if (a >= 1) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; return; }
    this.d[i] += (c[0] - this.d[i]) * a; this.d[i + 1] += (c[1] - this.d[i + 1]) * a; this.d[i + 2] += (c[2] - this.d[i + 2]) * a;
  }
  get(x: number, y: number): RGB { x = clamp(x | 0, 0, this.w - 1); y = clamp(y | 0, 0, this.h - 1); const i = (y * this.w + x) * 3; return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
  /** multiply a texel (AO, wear) */
  shade(x: number, y: number, k: number) { x |= 0; y |= 0; if (!this.in(x, y)) return; const i = (y * this.w + x) * 3; this.d[i] *= k; this.d[i + 1] *= k; this.d[i + 2] *= k; }
  alpha(x: number, y: number, v: number) { x |= 0; y |= 0; if (this.in(x, y)) this.a[y * this.w + x] = v; }
  rect(x0: number, y0: number, w: number, h: number, c: RGB | ((x: number, y: number) => RGB), a = 1) {
    for (let y = Math.max(0, y0 | 0); y < Math.min(this.h, (y0 + h) | 0); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(this.w, (x0 + w) | 0); x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c, a);
  }
  each(f: (x: number, y: number) => RGB | null) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = f(x, y); if (c) this.set(x, y, c); } }
  /** a bevelled frame inside a rectangle: lit top/left, shadowed bottom/right (cavity, not directional light) */
  bevel(x0: number, y0: number, w: number, h: number, k = 0.14, n = 1) {
    for (let i = 0; i < n; i++) {
      for (let x = x0 + i; x < x0 + w - i; x++) { this.shade(x, y0 + i, 1 + k); this.shade(x, y0 + h - 1 - i, 1 - k * 1.3); }
      for (let y = y0 + i + 1; y < y0 + h - 1 - i; y++) { this.shade(x0 + i, y, 1 + k * 0.7); this.shade(x0 + w - 1 - i, y, 1 - k); }
    }
  }
  /** soft AO band along the edges of a rectangle (contact shadows in corners and grooves) */
  ao(x0: number, y0: number, w: number, h: number, r = 4, k = 0.35) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      const d = Math.min(x - x0, y - y0, x0 + w - 1 - x, y0 + h - 1 - y);
      if (d < r) this.shade(x, y, 1 - k * (1 - d / r) ** 2);
    }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 1) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c, a);
  }
  /** the pixels as an RGBA ImageData (quantised to a limited print with ordered dither) */
  image(q = 48): ImageData {
    const img = new ImageData(this.w, this.h), o = img.data;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x, b = (bayer(x, y) - 0.5) * 0.9;
      for (let k = 0; k < 3; k++) o[i * 4 + k] = clamp(Math.floor(this.d[i * 3 + k] * q + 0.5 + b) / q) * 255;
      o[i * 4 + 3] = clamp(this.a[i]) * 255;
    }
    return img;
  }
  canvas(q = 48): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(this.image(q), 0, 0);
    return c;
  }
  texture(o: { repeat?: boolean; q?: number; mips?: boolean; aniso?: number } = {}): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(this.canvas(o.q));
    return pixelTex(t, o);
  }
}
/** crisp texels up close, calm mips far away */
export function pixelTex<T extends THREE.Texture>(t: T, o: { repeat?: boolean; mips?: boolean; aniso?: number } = {}): T {
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = o.mips === false ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = o.mips !== false;
  t.anisotropy = o.aniso ?? 4;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ colour ramps (rich, warm, saturated)

export const C = {
  mahogany: [rgb(0x240a07), rgb(0x3a120d), rgb(0x521b13), rgb(0x67241a), rgb(0x7d3020), rgb(0x94402a), rgb(0xa85434)] as RGB[],
  walnut: [rgb(0x24160e), rgb(0x3b2516), rgb(0x553621), rgb(0x70492c), rgb(0x8c5e38), rgb(0xa87747)] as RGB[],
  oak: [rgb(0x5a3a1c), rgb(0x7d5428), rgb(0x9c6d35), rgb(0xb98743), rgb(0xd3a35a), rgb(0xe6bf78)] as RGB[],
  leatherGreen: [rgb(0x0f2418), rgb(0x173621), rgb(0x1f4a2c), rgb(0x2b5f39), rgb(0x3a7648)] as RGB[],
  leatherRed: [rgb(0x2a0c0a), rgb(0x45140f), rgb(0x621d14), rgb(0x7e2a1b), rgb(0x9a3b25)] as RGB[],
  leatherBrown: [rgb(0x26140b), rgb(0x3d2112), rgb(0x57311a), rgb(0x734426), rgb(0x8f5a34)] as RGB[],
  gilt: [rgb(0x6b4a14), rgb(0x9c7323), rgb(0xc99a35), rgb(0xe8c15a), rgb(0xfbe49a)] as RGB[],
  brass: [rgb(0x5e4316), rgb(0x8c6a2a), rgb(0xb88f3e), rgb(0xd9b25a), rgb(0xf2d88c)] as RGB[],
  emerald: [rgb(0x0b2a21), rgb(0x113a2d), rgb(0x174b3a), rgb(0x1f5d48), rgb(0x2b7158)] as RGB[],
  paper: [rgb(0xd9ccb0), rgb(0xe7dcc2), rgb(0xf1e8d3), rgb(0xf8f2e4), rgb(0xfdfaf2)] as RGB[],
  ink: rgb(0x1c2340), inkBlack: rgb(0x16140f), red: rgb(0xb3262a), navy: rgb(0x1d2c52),
};
/** pick from a ramp with dithering between steps (t 0..1) */
export function ramp(r: RGB[], t: number, x = 0, y = 0, d = 0.6): RGB {
  const f = clamp(t) * (r.length - 1) + (bayer(x, y) - 0.5) * d;
  const i = clamp(Math.round(f), 0, r.length - 1);
  return r[i];
}
/** smooth pick (no steps) */
export function lerpRamp(r: RGB[], t: number): RGB {
  const f = clamp(t) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f));
  return mix3(r[i], r[i + 1], f - i);
}

// ------------------------------------------------------------------ materials

export interface WoodOpts { ramp?: RGB[]; seed?: number; dir?: 'h' | 'v'; scale?: number; base?: number; contrast?: number; ox?: number; oy?: number; knots?: boolean; ray?: boolean }
/**
 * Fine-figured hardwood: long flowing grain lines warped by low-frequency noise, a broad light/dark figure,
 * dark pores, the odd knot. Painted into a rectangle of the texture.
 */
export function wood(t: Tex, x0: number, y0: number, w: number, h: number, o: WoodOpts = {}) {
  const r = o.ramp ?? C.mahogany, s = o.seed ?? 1, sc = o.scale ?? 1, base = o.base ?? 0.5, con = o.contrast ?? 1;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    let u = (o.dir === 'v' ? x : y) + (o.oy ?? 0), v = (o.dir === 'v' ? y : x) + (o.ox ?? 0);
    u /= sc; v /= sc;
    const warp = (vnoise(v * 0.008, u * 0.035, s) - 0.5) * 16 + (vnoise(v * 0.03, u * 0.08, s + 3) - 0.5) * 2.5;
    const g = u + warp;
    const band = (((g / 3.4) % 1) + 1) % 1;
    const fig = fbm(v * 0.006, u * 0.03, s + 11) - 0.5;
    const ray = o.ray ? (vnoise(v * 0.3, u * 0.9, s + 5) > 0.82 ? 0.06 : 0) : 0;
    let k = base + fig * 0.42 * con + ray;
    if (band < 0.16) k -= 0.1 * con * (0.7 + vnoise(v * 0.02, g * 0.3, s + 2) * 0.6);
    else if (band > 0.5 && band < 0.6) k += 0.035 * con;
    if (band < 0.16 && hash(x, y, s + 9) > 0.97) k -= 0.08; // pores sit in the dark latewood
    t.set(x, y, ramp(r, k, x, y, 0.3));
  }
  if (o.knots) {
    const n = Math.floor((w * h) / 40000) + 1;
    for (let i = 0; i < n; i++) {
      const kx = x0 + hash(i, 1, s) * w, ky = y0 + hash(i, 2, s) * h, rr = 2 + hash(i, 3, s) * 3;
      for (let y = Math.floor(ky - rr * 2); y < ky + rr * 2; y++) for (let x = Math.floor(kx - rr * 3); x < kx + rr * 3; x++) {
        if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) continue;
        const d = Math.hypot((x - kx) / 1.6, y - ky);
        if (d < rr) t.set(x, y, ramp(r, 0.12 + (d / rr) * 0.25, x, y));
        else if (d < rr * 1.8 && Math.sin(d * 2.2) > 0.4) t.shade(x, y, 0.86);
      }
    }
  }
}

/** Pebbled, creased leather (a hide's soft folds and pores), optional gilt tooling round the edge. */
export function leather(t: Tex, x0: number, y0: number, w: number, h: number, r: RGB[], o: { seed?: number; tool?: number; base?: number } = {}) {
  const s = o.seed ?? 3, base = o.base ?? 0.55;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const n = fbm(x * 0.03, y * 0.03, s) - 0.5;
    const crease = Math.abs(vnoise(x * 0.06 + n * 2, y * 0.015, s + 4) - 0.5) < 0.025 ? -0.16 : 0;
    const pebble = (vnoise(x * 0.7, y * 0.7, s + 8) - 0.5) * 0.14;
    t.set(x, y, ramp(r, base + n * 0.45 + crease + pebble, x, y, 0.7));
  }
  if (o.tool) {
    // a double gilt fillet with a dotted roll between, inset from the edge
    const g = C.gilt, k = o.tool;
    const frame = (inset: number, f: (x: number, y: number) => void) => {
      for (let x = x0 + inset; x < x0 + w - inset; x++) { f(x, y0 + inset); f(x, y0 + h - 1 - inset); }
      for (let y = y0 + inset + 1; y < y0 + h - 1 - inset; y++) { f(x0 + inset, y); f(x0 + w - 1 - inset, y); }
    };
    const wear = (x: number, y: number) => 0.45 + vnoise(x * 0.2, y * 0.2, s + 9) * 0.6;
    frame(k, (x, y) => t.set(x, y, ramp(g, wear(x, y), x, y)));
    frame(k + 3, (x, y) => t.set(x, y, ramp(g, wear(x, y) - 0.1, x, y)));
    frame(k + 1.5 | 0, (x, y) => { if ((x + y) % 3 === 0) t.set(x, y, ramp(g, wear(x, y) - 0.15, x, y)); });
    // corner fleurons
    for (const [cx, cy] of [[x0 + k + 7, y0 + k + 7], [x0 + w - k - 8, y0 + k + 7], [x0 + k + 7, y0 + h - k - 8], [x0 + w - k - 8, y0 + h - k - 8]]) {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (Math.abs(dx) + Math.abs(dy) === 3 || (dx === 0 && dy === 0)) t.set(cx + dx, cy + dy, ramp(g, 0.7, cx + dx, cy + dy));
    }
  }
}

/** Brushed brass with patina freckles and rubbed-bright high spots (the material does the shine). */
export function brass(t: Tex, x0: number, y0: number, w: number, h: number, o: { seed?: number; base?: number } = {}) {
  const s = o.seed ?? 5;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const n = fbm(x * 0.05, y * 0.05, s) - 0.5, brush = (vnoise(x * 0.04, y * 1.2, s + 2) - 0.5) * 0.12;
    let k = (o.base ?? 0.6) + n * 0.35 + brush;
    if (hash(x, y, s) > 0.985) k -= 0.3;
    t.set(x, y, ramp(C.brass, k, x, y, 0.5));
  }
}

/** Cream laid paper with fibres and a faint mottle. */
export function paper(t: Tex, x0: number, y0: number, w: number, h: number, o: { seed?: number; base?: number; tone?: RGB[] } = {}) {
  const s = o.seed ?? 7, r = o.tone ?? C.paper;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    let k = (o.base ?? 0.78) + (fbm(x * 0.04, y * 0.04, s) - 0.5) * 0.12;
    if (vnoise(x * 0.9, y * 0.08, s + 3) > 0.86) k -= 0.05;
    if (hash(x, y, s) > 0.992) k -= 0.12;
    t.set(x, y, lerpRamp(r, k));
  }
}

/** Book cloth (buckram): a fine weave in a strong colour. */
export function cloth(t: Tex, x0: number, y0: number, w: number, h: number, c: RGB, o: { seed?: number } = {}) {
  const s = o.seed ?? 2;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const weave = ((x + y) & 1 ? 0.96 : 1.03) * (1 + (fbm(x * 0.08, y * 0.08, s) - 0.5) * 0.25);
    t.set(x, y, mul3(c, weave));
  }
}

/** Draw a small 1-bit glyph-like mark (rows of '#'), e.g. a crest or a pictogram, at (x, y). */
export function stamp(t: Tex, x: number, y: number, rows: string[], c: RGB, scale = 1) {
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.' && ch !== ' ') for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) t.set(x + rx * scale + sx, y + ry * scale + sy, c); }));
}

// ------------------------------------------------------------------ text on canvases

/** Draw text in the game's font at full resolution (anti-aliased; `threshold` snaps its alpha to 1-bit). */
export function crispText(g: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, o: { align?: CanvasTextAlign; base?: CanvasTextBaseline; spacing?: number; threshold?: number } = {}) {
  text = textSafe(text);
  const px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? '16'), mid = Math.ceil(px * 1.5);
  const tmp = scratch(Math.max(8, Math.ceil(text.length * px * 1.5 + 40)), mid * 2);
  const t = tmp.getContext('2d', { willReadFrequently: true })!;
  t.clearRect(0, 0, tmp.width, tmp.height);
  t.font = font;
  t.textBaseline = 'alphabetic';
  t.fillStyle = '#000';
  const sp = o.spacing ?? 0;
  if ('letterSpacing' in t) (t as unknown as { letterSpacing: string }).letterSpacing = `${sp}px`;
  const m = t.measureText(text);
  const w = Math.ceil(m.width) + 4;
  const asc = Math.ceil(m.actualBoundingBoxAscent || 12), desc = Math.ceil(m.actualBoundingBoxDescent || 4);
  t.fillText(text, 2, mid);
  const img = t.getImageData(0, mid - asc - 1, w, asc + desc + 2), d = img.data;
  // [font6] full-resolution, anti-aliased lettering; a threshold (0..1) gives hard 1-bit edges where asked
  const thr = o.threshold === undefined ? -1 : o.threshold * 255;
  const [cr, cg, cb] = cssRGB(color);
  for (let i = 0; i < d.length; i += 4) { d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; if (thr >= 0) d[i + 3] = d[i + 3] > thr ? 255 : 0; }
  const out = scratch2(w, asc + desc + 2);
  out.getContext('2d')!.putImageData(img, 0, 0);
  const align = o.align ?? 'left', base = o.base ?? 'alphabetic';
  let dx = x - 2;
  if (align === 'center') dx = x - w / 2;
  else if (align === 'right' || align === 'end') dx = x - w + 2;
  let dy = y - asc - 1;
  if (base === 'top') dy = y - 1;
  else if (base === 'middle') dy = y - (asc + desc) / 2 - 1;
  else if (base === 'bottom') dy = y - asc - desc - 1;
  g.drawImage(out, Math.round(dx), Math.round(dy));
  return w - 4;
}
export function measure(text: string, font: string, spacing = 0): number {
  const t = scratch(8, 8).getContext('2d', { willReadFrequently: true })!;
  t.font = font;
  if ('letterSpacing' in t) (t as unknown as { letterSpacing: string }).letterSpacing = `${spacing}px`;
  return t.measureText(textSafe(text)).width;
}
let sc1: HTMLCanvasElement | null = null, sc2: HTMLCanvasElement | null = null;
function scratch(w: number, h: number) { if (!sc1) sc1 = document.createElement('canvas'); if (sc1.width < w) sc1.width = w; if (sc1.height < h) sc1.height = h; return sc1; }
function scratch2(w: number, h: number) { if (!sc2) sc2 = document.createElement('canvas'); sc2.width = w; sc2.height = h; return sc2; }
const cssCache = new Map<string, [number, number, number]>();
function cssRGB(c: string): [number, number, number] {
  let v = cssCache.get(c);
  if (!v) { const n = parseInt(c.replace('#', '').slice(0, 6), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; cssCache.set(c, v); }
  return v;
}
/** Word-wrap text to a width with a given font. */
export function wrap(text: string, font: string, width: number, spacing = 0): string[] {
  const words = text.split(/\s+/), lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (measure(t, font, spacing) > width && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
export const hexCSS = (c: RGB) => '#' + c.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
