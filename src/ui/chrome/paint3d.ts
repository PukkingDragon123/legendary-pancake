// [tex7] Realistic textures for the interface's 3D models (the props in src/ui/chrome/props3d.ts and the icon bake,
// src/dev/iconbake.ts, which renders them into the pixel-art icons and shelf sprites), and the texture coordinates that
// lay them on. Dev only: nothing here ships in the app.
//
// Photo textures (Poly Haven, CC0: oak veneer (in colour and as grain to tint), two leathers, linen, knitted fleece and
// velour; prepared in art/tex7 and loaded by the bake from there) give wood, leather and cloth their grain
// (`setSwatch` / `swatchAt`). Everything else is painted at run time (or bake time) into a canvas: a procedural base
// (tileable noise, cells, growth rings) worked over with painted strokes (scratches, engraving, stitches, veins,
// numerals), in full colour from a ramp round one base colour, with cavity darkening baked in and no directional
// light (the light comes from the scene). The painted textures also stand in for the photo ones until those load.
// Most textures tile; `fitUV` gives any model texture coordinates at one density (repeats per model unit).
//
//   wood, leather, brass, steel, enamel, cloth (weave, knit, burlap, felt, velvet), paper, glass, leaf, gem, bark,
//   stone, feather, scales, wax, flame, water, cloud      the painters (each returns { map, bump? } textures)
//   setSwatch / swatchAt                                the photo textures
//   fitUV(object, density)                              world-scale texture coordinates for every mesh under object
import * as THREE from 'three';

export type RGB = [number, number, number];
type Col = string | number;

/** texture repeats per model unit (a painted 128-texel tile spans about 1.4 units: a hand's breadth of oak) */
export const DENSITY = 0.7;

// ------------------------------------------------------------------ noise (tileable, fast)
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const P = 256, PM = P - 1;
let FIELD: Float32Array | null = null;
/** a 256 x 256 tileable fbm field (four octaves of value noise), built once */
function field(): Float32Array {
  if (FIELD) return FIELD;
  const f = new Float32Array(P * P);
  const oct: [number, number][] = [[8, 0.5], [16, 0.26], [32, 0.15], [64, 0.09]];
  for (const [L, w] of oct) {
    const cell = P / L, g = new Float32Array(L * L);
    for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) g[j * L + i] = hash(i, j, L * 7 + 1);
    for (let y = 0; y < P; y++) {
      const fy = y / cell, j0 = Math.floor(fy), ty = fy - j0, v = ty * ty * (3 - 2 * ty), j1 = (j0 + 1) % L;
      for (let x = 0; x < P; x++) {
        const fx = x / cell, i0 = Math.floor(fx), tx = fx - i0, u = tx * tx * (3 - 2 * tx), i1 = (i0 + 1) % L;
        const a = g[j0 * L + i0], b = g[j0 * L + i1], c = g[j1 * L + i0], d = g[j1 * L + i1];
        f[y * P + x] += (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * w;
      }
    }
  }
  return (FIELD = f);
}
/** the fbm field at field coordinates (wraps every 256; 8 blobs per 256) */
function nf(x: number, y: number): number {
  const f = FIELD ?? field();
  const xi = Math.floor(x), yi = Math.floor(y), tx = x - xi, ty = y - yi;
  const x0 = xi & PM, y0 = yi & PM, x1 = (x0 + 1) & PM, y1 = (y0 + 1) & PM;
  const a = f[y0 * P + x0], b = f[y0 * P + x1], c = f[y1 * P + x0], d = f[y1 * P + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
/** fast smooth noise (not tiled) at texel coordinates: blobs about 32 texels across; about 0.25..0.75 */
export const noise = (x: number, y: number, s = 0) => nf(x + s * 53, y + s * 91);
/**
 * Tileable noise for a w x h texture at (x, y): `kx`, `ky` whole numbers of noise periods across the tile (about 8
 * blobs each), `s` a seed. Returns about 0.25..0.75, centred on 0.5.
 */
function tn(x: number, y: number, w: number, h: number, kx: number, ky: number, s = 0): number {
  return nf((x / w) * P * kx + s * 53, (y / h) * P * ky + s * 91);
}
/** tileable cells (Worley): n x m cells across the tile; returns [F1, F2] in cell units and the nearest cell's id */
function cells(x: number, y: number, w: number, h: number, n: number, m: number, s = 0, jit = 0.85): [number, number, number] {
  const fx = (x / w) * n, fy = (y / h) * m, ci = Math.floor(fx), cj = Math.floor(fy);
  let d1 = 9, d2 = 9, id = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const i = ci + di, j = cj + dj, wi = ((i % n) + n) % n, wj = ((j % m) + m) % m;
    const px = i + 0.5 + (hash(wi, wj, s) - 0.5) * jit, py = j + 0.5 + (hash(wi, wj, s + 1) - 0.5) * jit;
    const d = Math.hypot(fx - px, fy - py);
    if (d < d1) { d2 = d1; d1 = d; id = hash(wi, wj, s + 2); } else if (d < d2) d2 = d;
  }
  return [d1, d2, id];
}

// ------------------------------------------------------------------ colour: a painter's ramp round a base colour
export function rgbOf(c: Col): RGB {
  const n = typeof c === 'number' ? c : parseInt(c.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl(h: number, s: number, l: number): RGB {
  const f = (p: number, q: number, t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  return [f(p, q, h + 1 / 3) * 255, f(p, q, h) * 255, f(p, q, h - 1 / 3) * 255];
}
const lerpHue = (h: number, to: number, t: number) => { let d = to - h; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return (h + d * t + 1) % 1; };
const ramps = new Map<string, RGB[]>();
/** 65 shades of a base colour: index 0 the deepest (cooler, leaning violet-blue) .. 32 the base .. 64 the lightest (warmer, leaning gold) */
export function ramp(base: Col): RGB[] {
  const key = String(base);
  let r = ramps.get(key);
  if (r) return r;
  const [h, s, l] = hsl(rgbOf(base));
  r = [];
  for (let i = 0; i <= 64; i++) {
    const v = (i - 32) / 32;
    if (v < 0) { const t = -v; r.push(fromHsl(s > 0.06 ? lerpHue(h, 0.7, t * 0.1) : 0.68, clamp(s > 0.06 ? s * (1 + t * 0.12) : 0.08 * t), l * (1 - t * 0.72))); }
    else r.push(fromHsl(s > 0.06 ? lerpHue(h, 0.13, v * 0.08) : 0.12, clamp(s > 0.06 ? s * (1 - v * 0.25) : 0.1 * v), l + (1 - l) * v * 0.78));
  }
  ramps.set(key, r);
  return r;
}
/** a shade of a ramp, v -1 .. 1 */
const sh = (R: RGB[], v: number): RGB => R[Math.round(clamp((v + 1) * 32, 0, 64))];
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ------------------------------------------------------------------ the canvas painter
/** one painted texture in progress: colour per texel plus a height field (for the bump map) */
export class Canvas3 {
  readonly c: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  readonly hgt: Float32Array;
  hasBump = false;
  constructor(readonly w: number, readonly h: number) {
    this.c = document.createElement('canvas');
    this.c.width = w; this.c.height = h;
    this.g = this.c.getContext('2d', { willReadFrequently: true })!;
    this.hgt = new Float32Array(w * h).fill(0.5);
  }
  /** paint every texel: f returns the colour (and optionally sets the height via `this.hgt`) */
  each(f: (x: number, y: number, i: number) => RGB | [number, number, number, number]): this {
    const img = this.g.createImageData(this.w, this.h), d = img.data;
    for (let y = 0, i = 0; y < this.h; y++) for (let x = 0; x < this.w; x++, i++) {
      const v = f(x, y, i), o = i * 4;
      d[o] = v[0]; d[o + 1] = v[1]; d[o + 2] = v[2]; d[o + 3] = v.length > 3 ? (v as number[])[3] : 255;
    }
    this.g.putImageData(img, 0, 0);
    return this;
  }
  /** draw with the 2D context, wrapped round the tile's edges (strokes near an edge repeat on the other side) */
  wrap(draw: (g: CanvasRenderingContext2D) => void): this {
    for (const dx of [-this.w, 0, this.w]) for (const dy of [-this.h, 0, this.h]) { this.g.save(); this.g.translate(dx, dy); draw(this.g); this.g.restore(); }
    return this;
  }
  /** set the height field from the painted colour (darker is lower): for carving, tooling and engraving drawn with strokes */
  heightFromColour(k = 1): this {
    const d = this.g.getImageData(0, 0, this.w, this.h).data;
    for (let i = 0; i < this.hgt.length; i++) this.hgt[i] = 0.5 + ((d[i * 4] * 0.3 + d[i * 4 + 1] * 0.55 + d[i * 4 + 2] * 0.15) / 255 - 0.5) * k;
    this.hasBump = true;
    return this;
  }
  /** the colour texture (smooth, mipmapped) */
  map(repeat = true): THREE.Texture { return toTex(this.c, repeat, false); }
  /** the height field as a bump texture (smooth) */
  bump(repeat = true): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d')!, img = g.createImageData(this.w, this.h), d = img.data;
    // softened (3 x 3) so the relief reads as shape, not as sparkle under the banded light
    const W = this.w, H = this.h, hg = this.hgt;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      let t = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t += hg[((y + dy + H) % H) * W + ((x + dx + W) % W)];
      const v = clamp(t / 9) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return toTex(c, repeat, true);
  }
}
function toTex(c: HTMLCanvasElement, repeat: boolean, data: boolean): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export interface Painted { map: THREE.Texture; bump?: THREE.Texture; bumpScale?: number; rough?: number }
const cache = new Map<string, Painted>();
function cached(key: string, make: () => Painted): Painted {
  let p = cache.get(key);
  if (!p) { p = make(); cache.set(key, p); }
  return p;
}
const TAU = Math.PI * 2;
const rnd = (s: number) => { let k = s * 9301 + 49297; return () => { k = (k * 9301 + 49297) % 233280; return k / 233280; }; };

// ------------------------------------------------------------------ wood

export interface WoodOpt { seed?: number; size?: number; rings?: number; knots?: number; contrast?: number; figure?: number }
/**
 * Wood: growth rings that wander and swirl round knots (the grain runs along v), thin dark latewood lines, broad
 * colour streaks, open pores as short dark dashes, medullary flecks, and long painted figure strokes.
 */
export function woodCanvas(base: Col, o: WoodOpt = {}): Canvas3 {
  const s = o.seed ?? 3, W = o.size ?? 128, H = W, R = ramp(base), con = o.contrast ?? 1;
  const rings = o.rings ?? 6;
  const kn: [number, number, number][] = [];
  const r0 = rnd(s * 13 + 7);
  for (let i = 0; i < (o.knots ?? 1); i++) kn.push([r0() * W, r0() * H, W * (0.05 + r0() * 0.04)]);
  const cv = new Canvas3(W, H);
  cv.each((x, y, i) => {
    // knots: a dark heart with tight rings; the grain sweeps round them
    let bend = 0, knot = -1;
    for (const [kx, ky, kr] of kn) {
      let dx = x - kx, dy = y - ky;
      dx -= Math.round(dx / W) * W; dy -= Math.round(dy / H) * H;
      const d = Math.hypot(dx, dy * 0.55);
      if (d < kr) knot = Math.max(knot, 1 - d / kr);
      bend += (kr * 2.6 * Math.sign(dx || 1)) * Math.exp(-(d * d) / (kr * kr * 9));
    }
    // long lines along v that meander gently (whole waves per tile, so it tiles), with a little wobble
    const sp = W / rings, X = x / W, Y = y / H;
    const warp = sp * (0.75 * Math.sin(TAU * (Y + X + s * 0.13)) + 0.3 * Math.sin(TAU * (2 * Y - X) + s)) + (tn(x, y, W, H, 1, 1, s) - 0.5) * sp * 0.9 + bend;
    const ring = (x + warp) / sp;
    const f = ring - Math.floor(ring);
    // earlywood pale to latewood deep across each ring, then the dark latewood line
    const late = f < 0.13 ? -0.5 : f < 0.22 ? -0.24 : 0.12 - f * 0.22;
    const streak = (tn(x, y, W, H, 2, 1, s + 9) - 0.5) * 0.5 + (tn(x, y, W, H, 4, 1, s + 5) - 0.5) * 0.15;
    const pore = hash(Math.floor(x / 2), Math.floor(y / 9), s + 3) > 0.985 ? -0.3 : 0;
    const fleck = hash(Math.floor(x / 3), Math.floor(y / 3), s + 6) > 0.996 ? 0.3 : 0;
    let v = (late + streak + pore + fleck) * con;
    if (knot >= 0) v = -0.55 + Math.sin(knot * 14) * 0.18 - knot * 0.25;
    cv.hgt[i] = 0.55 + (late < -0.3 ? -0.25 : 0) + pore * 0.6 + (knot > 0 ? -0.2 * knot : 0);
    return sh(R, v * 0.75);
  });
  cv.hasBump = true;
  // long painted figure strokes along the grain: a warm sheen and a few darker streaks
  const rr = rnd(s * 31 + 1);
  cv.wrap((g) => {
    g.lineCap = 'round';
    for (let i = 0; i < (o.figure ?? 14); i++) {
      const x = rr() * W, y = rr() * H, len = H * (0.2 + rr() * 0.4), light = rr() > 0.4;
      const c = sh(R, light ? 0.35 + rr() * 0.2 : -0.4);
      g.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${light ? 0.32 : 0.26})`;
      g.lineWidth = 1 + rr() * 2.2;
      g.beginPath(); g.moveTo(x, y);
      g.bezierCurveTo(x + (rr() - 0.5) * 6, y + len / 3, x + (rr() - 0.5) * 6, y + (len * 2) / 3, x + (rr() - 0.5) * 4, y + len);
      g.stroke();
    }
  });
  return cv;
}
export function wood(base: Col, o: WoodOpt = {}): Painted {
  return cached('wood' + base + JSON.stringify(o), () => { const c = woodCanvas(base, o); return { map: c.map(), bump: c.bump(), bumpScale: 0.5 }; });
}

// ------------------------------------------------------------------ leather

export interface LeatherOpt { seed?: number; size?: number; tooled?: boolean; stitch?: boolean }
/** Leather: a pebbled grain (cells), creases, a mottle, pale scuffs; optional blind-tooled diamonds; tileable */
export function leatherCanvas(base: Col, o: LeatherOpt = {}): Canvas3 {
  const s = o.seed ?? 5, N = o.size ?? 128, R = ramp(base);
  const cv = new Canvas3(N, N);
  cv.each((x, y, i) => {
    const [f1, f2] = cells(x, y, N, N, 16, 16, s);
    const peb = sstep(0.0, 0.24, f2 - f1); // soft dark seams between pebbles
    const dome = 1 - f1 * 1.1;
    const crease = Math.abs(tn(x, y, N, N, 1, 1, s + 2) - 0.5) < 0.016 ? -0.42 : Math.abs(tn(x, y, N, N, 2, 2, s + 4) - 0.5) < 0.012 ? -0.3 : 0;
    const mott = (tn(x, y, N, N, 1, 1, s + 6) - 0.5) * 0.9;
    const scuff = tn(x, y, N, N, 4, 2, s + 8) > 0.68 ? 0.22 : 0;
    let v = mott + (peb - 1) * 0.18 + dome * 0.08 + crease + scuff;
    let hgt = 0.5 + dome * 0.22 + (peb - 1) * 0.25 + crease * 0.5;
    if (o.tooled) {
      // blind-tooled diamonds: a pressed lattice, darker and lower
      const u = ((x + y) % 32 + 32) % 32, w = ((x - y) % 32 + 32) % 32;
      if (u < 2 || w < 2) { v -= 0.3; hgt -= 0.3; }
      else if (Math.hypot(((x % 32) + 32) % 32 - 16, ((y % 32) + 32) % 32 - 0) < 3) { v -= 0.2; hgt -= 0.2; }
    }
    cv.hgt[i] = hgt;
    return sh(R, v * 0.8);
  });
  cv.hasBump = true;
  return cv;
}
export function leather(base: Col, o: LeatherOpt = {}): Painted {
  return cached('lea' + base + JSON.stringify(o), () => { const c = leatherCanvas(base, o); return { map: c.map(), bump: c.bump(), bumpScale: 0.4 }; });
}
/** a running stitch along a path on a painter's canvas (thread over leather or cloth: a dark hole, a pale stitch) */
export function stitches(g: CanvasRenderingContext2D, pts: [number, number][], thread: Col, len = 5, gap = 3, wd = 1.6) {
  const T = rgbOf(thread), D = mixc(T, [30, 16, 20], 0.7);
  let carry = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    for (let t = carry; t < L; t += len + gap) {
      const a = [x0 + ux * t, y0 + uy * t], b = [x0 + ux * Math.min(L, t + len), y0 + uy * Math.min(L, t + len)];
      g.lineCap = 'butt';
      g.strokeStyle = `rgb(${D[0] | 0},${D[1] | 0},${D[2] | 0})`; g.lineWidth = wd + 1;
      g.beginPath(); g.moveTo(a[0] + 0.6, a[1] + 0.8); g.lineTo(b[0] + 0.6, b[1] + 0.8); g.stroke();
      g.strokeStyle = `rgb(${T[0]},${T[1]},${T[2]})`; g.lineWidth = wd;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      carry = t + len + gap - L;
    }
  }
}

// ------------------------------------------------------------------ metal

export interface MetalOpt { seed?: number; size?: number; patina?: number; engrave?: 'rings' | 'scroll' | 'none'; wear?: number; brush?: 'u' | 'v' }
/**
 * Metal (brass, gold, silver, steel): brushed streaks, fine scratches, pits, a tarnished mottle and verdigris in
 * the low places; engraved bands of lines and a twisted rope, or tileable acanthus scrolls.
 */
export function metalCanvas(base: Col, o: MetalOpt = {}): Canvas3 {
  const s = o.seed ?? 2, N = o.size ?? 128, R = ramp(base), pat = o.patina ?? 0.25, verd = rgbOf('#4f9a80');
  const cv = new Canvas3(N, N);
  const alongV = o.brush === 'v';
  cv.each((x, y, i) => {
    const bx = alongV ? y : x, by = alongV ? x : y;
    const brush = (tn(bx, by, N, N, 1, 16, s) - 0.5) * 1.1 + (tn(bx, by, N, N, 1, 48, s + 1) - 0.5) * 0.5;
    const tarn = tn(x, y, N, N, 1, 1, s + 3);
    const pit = hash(x >> 1, y >> 1, s + 7) > 0.997 ? -0.5 : 0;
    let c = sh(R, brush * 0.55 + (tarn - 0.5) * 0.7 + pit);
    if (pat > 0 && tarn < 0.5 - (1 - pat) * 0.22) c = mixc(c, verd, clamp((0.5 - (1 - pat) * 0.22 - tarn) * 6) * 0.65);
    cv.hgt[i] = 0.5 + pit * 0.4;
    return c;
  });
  const rr = rnd(s * 17 + 3);
  // fine scratches: hairlines, some catching the light, some dark
  cv.wrap((g) => {
    for (let i = 0; i < 14; i++) {
      const x = rr() * N, y = rr() * N, a = (alongV ? Math.PI / 2 : 0) + (rr() - 0.5) * 0.9, l = 6 + rr() * 22, c = sh(R, rr() > 0.5 ? 0.7 : -0.5);
      g.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},0.5)`; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
  if (o.engrave === 'rings') engraveRings(cv, R, s);
  if (o.engrave === 'scroll') engraveScroll(cv, R, s);
  cv.hasBump = o.engrave !== undefined && o.engrave !== 'none';
  return cv;
}
/** engraved bands across v: paired fine lines and a twisted rope between them, cut dark with a bright lip */
function engraveRings(cv: Canvas3, R: RGB[], s: number) {
  const N = cv.w, D = sh(R, -0.85), L = sh(R, 0.75);
  const img = cv.g.getImageData(0, 0, N, cv.h), d = img.data;
  const put = (x: number, y: number, c: RGB, h: number) => { const i = ((y + cv.h) % cv.h) * N + ((x + N) % N); d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; cv.hgt[i] = h; };
  const band = (y0: number) => {
    for (let x = 0; x < N; x++) for (const [dy, c, h] of [[0, D, 0.2], [1, D, 0.2], [2, L, 0.7], [12, D, 0.2], [13, D, 0.2], [14, L, 0.7]] as [number, RGB, number][]) put(x, y0 + dy, c, h);
    // the rope: slanted cuts between the lines
    for (let x = 0; x < N; x++) for (let k = 4; k < 11; k++) { const t = ((x + k * 1.4) % 8 + 8) % 8; if (t < 2) put(x, y0 + k, D, 0.25); else if (t < 3) put(x, y0 + k, L, 0.65); }
  };
  band(Math.floor(N * 0.18) + (s % 3));
  band(Math.floor(N * 0.68));
  cv.g.putImageData(img, 0, 0);
}
/** engraved acanthus scrolls (tileable): S-curves with little leaves, cut dark with a bright lip */
function engraveScroll(cv: Canvas3, R: RGB[], s: number) {
  const N = cv.w, D = sh(R, -0.8), L = sh(R, 0.8), rr = rnd(s * 7 + 11);
  const cut = (g: CanvasRenderingContext2D, path: () => void, w: number) => {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = `rgb(${L[0] | 0},${L[1] | 0},${L[2] | 0})`; g.lineWidth = w; g.save(); g.translate(0.8, 0.8); path(); g.stroke(); g.restore();
    g.strokeStyle = `rgb(${D[0] | 0},${D[1] | 0},${D[2] | 0})`; g.lineWidth = w; path(); g.stroke();
  };
  cv.wrap((g) => {
    for (let k = 0; k < 2; k++) {
      const y = N * (0.25 + k * 0.5), ph = k * N * 0.5;
      cut(g, () => { g.beginPath(); for (let x = -8; x <= N + 8; x += 2) { const yy = y + Math.sin(((x + ph) / N) * Math.PI * 4) * N * 0.09; if (x === -8) g.moveTo(x, yy); else g.lineTo(x, yy); } }, 2.2);
      for (let j = 0; j < 4; j++) {
        const x0 = ((j + 0.25) / 4) * N - ph * 0, up = j % 2 ? 1 : -1, yy = y + Math.sin(((x0 + ph) / N) * Math.PI * 4) * N * 0.09;
        cut(g, () => { g.beginPath(); g.moveTo(x0, yy); g.bezierCurveTo(x0 + 6, yy + up * 12, x0 + 18, yy + up * 5, x0 + 14, yy - up * 2); }, 2);
        cut(g, () => { g.beginPath(); g.arc(x0 + 13, yy + up * 1, 2.6 + rr(), 0, Math.PI * 2); }, 1.8);
      }
    }
  });
}
export function metal(base: Col, o: MetalOpt = {}): Painted {
  return cached('met' + base + JSON.stringify(o), () => { const c = metalCanvas(base, o); return { map: c.map(), bump: c.hasBump ? c.bump() : undefined, bumpScale: 0.7 }; });
}

// ------------------------------------------------------------------ enamel, lacquer, glaze, painted wood

export interface EnamelOpt { seed?: number; size?: number; craze?: number; chips?: boolean }
/** Enamel: a deep glossy colour with soft brushwork, fine crazing in the glaze, the odd chip showing the ground */
export function enamelCanvas(base: Col, o: EnamelOpt = {}): Canvas3 {
  const s = o.seed ?? 6, N = o.size ?? 128, R = ramp(base), cz = o.craze ?? 1;
  const cv = new Canvas3(N, N);
  cv.each((x, y, i) => {
    const brush = (tn(x, y, N, N, 1, 2, s) - 0.5) * 0.9 + (tn(x, y, N, N, 3, 1, s + 2) - 0.5) * 0.4;
    const [f1, f2] = cells(x, y, N, N, 18, 18, s + 3, 1);
    const craze = cz > 0 && f2 - f1 < 0.05 ? -0.09 * cz : 0;
    const chip = o.chips !== false && hash(Math.floor(x / 3), Math.floor(y / 3), s + 9) > 0.998 ? 0.6 : 0;
    cv.hgt[i] = craze ? 0.35 : 0.5;
    return chip ? sh(R, 0.85) : sh(R, brush * 0.3 + craze);
  });
  cv.hasBump = cz > 0;
  return cv;
}
export function enamel(base: Col, o: EnamelOpt = {}): Painted {
  return cached('ena' + base + JSON.stringify(o), () => { const c = enamelCanvas(base, o); return { map: c.map(), bump: c.hasBump ? c.bump() : undefined, bumpScale: 0.2 }; });
}

// ------------------------------------------------------------------ cloth

export type ClothKind = 'weave' | 'knit' | 'burlap' | 'felt' | 'velvet' | 'twill';
/** Cloth: real threads (over-under weave with slubs, a knitted V stitch, open burlap, matted felt, napped velvet) */
export function clothCanvas(base: Col, kind: ClothKind = 'weave', seed = 4, N = 128): Canvas3 {
  const R = ramp(base), s = seed;
  const cv = new Canvas3(N, N);
  cv.each((x, y, i) => {
    const mott = (tn(x, y, N, N, 1, 1, s) - 0.5) * 0.7;
    let v = 0, h = 0.5;
    if (kind === 'weave' || kind === 'twill') {
      const p = 4, X = Math.floor(x / p), Y = Math.floor(y / p), fx = (x % p) / p, fy = (y % p) / p;
      const over = kind === 'twill' ? ((X + Y) % 4) < 2 : ((X + Y) & 1) === 0;
      const t = over ? Math.sin(fy * Math.PI) : Math.sin(fx * Math.PI); // the thread's roundness across it
      const slub = (over ? hash(X, 0, s) : hash(0, Y, s + 1)) - 0.5;
      v = (t - 0.6) * 0.5 + slub * 0.35 + (over ? 0.06 : -0.06);
      h = 0.3 + t * 0.5;
    } else if (kind === 'knit') {
      // columns of V stitches: each a pair of slanted loops
      const cw = 8, rh = 6, X = Math.floor(x / cw), fx = (x % cw) / cw, fy = ((y + (X % 2) * 0) % rh) / rh;
      const left = fx < 0.5, k = left ? fx * 2 : (1 - fx) * 2; // 0 at the column edge .. 1 at the middle
      const slant = Math.abs(fy - (left ? 1 - k : 1 - k) * 0.8 - 0.1);
      const loop = 1 - clamp(slant * 3.2);
      v = (loop - 0.5) * 0.85 - (k < 0.12 ? 0.35 : 0) + (hash(X, Math.floor(y / rh), s) - 0.5) * 0.2;
      h = 0.25 + loop * 0.6;
    } else if (kind === 'burlap') {
      const p = 6, X = Math.floor(x / p), Y = Math.floor(y / p), fx = (x % p) / p, fy = (y % p) / p;
      const over = ((X + Y) & 1) === 0, t = over ? Math.sin(fy * Math.PI) : Math.sin(fx * Math.PI);
      const gap = (fx > 0.82 && fy > 0.82) ? -0.6 : 0;
      v = (t - 0.55) * 0.7 + (over ? hash(X, Y, s) - 0.5 : hash(Y, X, s + 1) - 0.5) * 0.45 + gap;
      if (hash(x, y, s + 4) > 0.985) v += 0.45; // stray fibres
      h = 0.25 + t * 0.6 + gap * 0.3;
    } else if (kind === 'felt') {
      v = (tn(x, y, N, N, 4, 4, s + 2) - 0.5) * 0.9 + (hash(x, y, s) - 0.5) * 0.25;
      h = 0.5 + v * 0.3;
    } else {
      // velvet: a soft nap, brushed one way, crushed in places
      v = (tn(x, y, N, N, 2, 1, s + 2) - 0.5) * 1.1 + (hash(x >> 1, y, s) - 0.5) * 0.12;
    }
    cv.hgt[i] = h;
    return sh(R, (v + mott) * 0.8);
  });
  cv.hasBump = kind !== 'velvet' && kind !== 'felt';
  return cv;
}
export function cloth(base: Col, kind: ClothKind = 'weave', seed = 4): Painted {
  return cached('clo' + base + kind + seed, () => { const c = clothCanvas(base, kind, seed); return { map: c.map(), bump: c.hasBump ? c.bump() : undefined, bumpScale: 0.5 }; });
}

// ------------------------------------------------------------------ paper

/** Paper: fibres, a soft mottle, foxing specks; `ink` adds ruled lines and a hand-written scrawl (planar, not tiled) */
export function paperCanvas(base: Col, o: { seed?: number; size?: number; ink?: Col; ruled?: Col; lines?: number } = {}): Canvas3 {
  const s = o.seed ?? 5, N = o.size ?? 128, R = ramp(base);
  const cv = new Canvas3(N, N);
  cv.each((x, y) => {
    const mott = (tn(x, y, N, N, 1, 1, s) - 0.5) * 0.5;
    const fib = tn(x, y, N, N, 2, 12, s + 2) > 0.66 ? 0.12 : tn(x, y, N, N, 12, 2, s + 3) > 0.7 ? -0.1 : 0;
    const fox = tn(x, y, N, N, 3, 3, s + 5) < 0.3 ? -0.2 : 0;
    const speck = hash(x, y, s) > 0.995 ? -0.5 : 0;
    return sh(R, mott + fib + fox + speck);
  });
  const rr = rnd(s * 5 + 2);
  if (o.ruled) {
    const c = rgbOf(o.ruled);
    cv.g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.75)`;
    const n = o.lines ?? 8;
    for (let k = 1; k <= n; k++) cv.g.fillRect(N * 0.08, Math.round(N * (0.12 + (k / (n + 1)) * 0.8)), N * 0.84, Math.max(1, N / 96));
  }
  if (o.ink) {
    const c = rgbOf(o.ink), n = o.lines ?? 8;
    cv.g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},0.9)`; cv.g.lineWidth = Math.max(1, N / 80); cv.g.lineCap = 'round';
    for (let k = 1; k < n; k++) {
      const yy = N * (0.12 + (k / (n + 1)) * 0.8) - N * 0.03, x1 = N * (0.45 + rr() * 0.42);
      cv.g.beginPath(); cv.g.moveTo(N * 0.12, yy);
      for (let x = N * 0.12; x < x1; x += N / 40) cv.g.lineTo(x, yy + Math.sin(x * 0.9 + k) * N * 0.012 - (rr() > 0.8 ? N * 0.02 : 0));
      cv.g.stroke();
    }
  }
  return cv;
}
export function paper(base: Col, o: { seed?: number; ink?: Col; ruled?: Col } = {}): Painted {
  return cached('pap' + base + JSON.stringify(o), () => { const c = paperCanvas(base, o); return { map: c.map(!o.ink && !o.ruled) }; });
}

// ------------------------------------------------------------------ glass, water, ice

/** Glass: a faint tint, frosted patches, and painted window reflections (bright slanted streaks) and bubbles */
export function glass(base: Col, o: { seed?: number; frost?: number } = {}): Painted {
  return cached('gla' + base + JSON.stringify(o), () => {
    const N = 128, R = ramp(base), s = o.seed ?? 8, fr = o.frost ?? 0.3;
    const cv = new Canvas3(N, N);
    cv.each((x, y) => {
      const frost = tn(x, y, N, N, 2, 2, s) > 1 - fr * 0.5 ? 0.35 + (hash(x, y, s) - 0.5) * 0.3 : 0;
      // two window reflections: slanted bright streaks
      const d1 = Math.abs(((x + y * 0.5) % N + N) % N - N * 0.3), d2 = Math.abs(((x + y * 0.5) % N + N) % N - N * 0.4);
      const refl = d1 < 5 ? 0.9 : d2 < 2 ? 0.7 : 0;
      const bub = hash(x >> 1, y >> 1, s + 3) > 0.995 ? 0.6 : 0;
      return sh(R, (tn(x, y, N, N, 1, 1, s + 2) - 0.5) * 0.3 + frost + refl + bub);
    });
    return { map: cv.map() };
  });
}
/** Water: wandering caustic lines and ripples */
export function water(base: Col, seed = 9): Painted {
  return cached('wat' + base + seed, () => {
    const N = 128, R = ramp(base), cv = new Canvas3(N, N);
    cv.each((x, y) => {
      const [f1, f2] = cells(x + (tn(x, y, N, N, 1, 1, seed) - 0.5) * 30, y, N, N, 5, 5, seed, 1);
      const caustic = f2 - f1 < 0.08 ? 0.55 : 0;
      return sh(R, (tn(x, y, N, N, 1, 2, seed + 2) - 0.5) * 0.6 + caustic + (y / N) * -0.2);
    });
    return { map: cv.map() };
  });
}

// ------------------------------------------------------------------ plants, bark, stone, feathers, scales

/** A leaf blade laid out on 0..1 (planar): a pale midrib up v, paired side veins, darker edges, a soft mottle */
export function leafTex(base: Col, o: { seed?: number; veins?: number; carved?: boolean } = {}): Painted {
  return cached('leaf' + base + JSON.stringify(o), () => {
    const N = 128, R = ramp(base), s = o.seed ?? 3, nv = o.veins ?? 7, k = o.carved ? -1.1 : 1;
    const cv = new Canvas3(N, N);
    cv.each((x, y, i) => {
      const u = x / N - 0.5, v = 1 - y / N;
      const mid = Math.abs(u) < 0.025 ? 0.75 : Math.abs(u) < 0.04 ? 0.4 : 0;
      // side veins run up and out from the midrib
      const vp = (v - Math.abs(u) * 0.9) * nv, f = vp - Math.floor(vp);
      const vein = Math.abs(u) > 0.04 && (f < 0.09 || f > 0.95) ? 0.42 : 0;
      const edge = -Math.abs(u) * (o.carved ? 0.5 : 0.9);
      const mott = o.carved ? (tn(x, y, N, N, 1, 4, s) - 0.5) * 0.7 : (tn(x, y, N, N, 2, 2, s) - 0.5) * 0.6;
      cv.hgt[i] = mid || vein ? (o.carved ? 0.2 : 0.4) : 0.55;
      return sh(R, mott + edge + (mid + vein) * k);
    });
    return { map: cv.map(false), bump: cv.bump(false), bumpScale: 0.5 };
  });
}
/** Bark: deep vertical furrows between ridged plates, lichen and moss in the cracks */
export function bark(base: Col, seed = 7): Painted {
  return cached('bark' + base + seed, () => {
    const N = 128, R = ramp(base), cv = new Canvas3(N, N), moss = rgbOf('#6a9a3a');
    cv.each((x, y, i) => {
      const r = tn(x, y, N, N, 4, 1, seed), plate = Math.abs(r - 0.5) * 2;
      const furrow = plate < 0.14 ? -0.7 : 0;
      const v = (plate - 0.5) * 0.5 + furrow + (tn(x, y, N, N, 6, 3, seed + 2) - 0.5) * 0.5;
      cv.hgt[i] = 0.3 + plate * 0.6;
      const c = sh(R, v);
      return furrow && tn(x, y, N, N, 2, 2, seed + 4) > 0.58 ? mixc(c, moss, 0.6) : c;
    });
    return { map: cv.map(), bump: cv.bump(), bumpScale: 1 };
  });
}
/** Stone: grains and speckles with a few hairline cracks */
export function stone(base: Col, seed = 11): Painted {
  return cached('sto' + base + seed, () => {
    const N = 128, R = ramp(base), cv = new Canvas3(N, N);
    cv.each((x, y) => {
      const [f1, f2] = cells(x, y, N, N, 4, 4, seed, 1);
      const crack = f2 - f1 < 0.025 ? -0.6 : 0;
      return sh(R, (tn(x, y, N, N, 2, 2, seed) - 0.5) * 0.8 + (hash(x, y, seed) - 0.5) * 0.35 + crack);
    });
    return { map: cv.map() };
  });
}
/** Feathers: overlapping rows of rounded feathers, each with a dark shaft and a darker tip bar */
export function feathers(base: Col, o: { seed?: number; tip?: Col; size?: number } = {}): Painted {
  return cached('fea' + base + JSON.stringify(o), () => {
    const N = o.size ?? 64, R = ramp(base), s = o.seed ?? 12, tip = o.tip ? rgbOf(o.tip) : sh(R, -0.75);
    const cv = new Canvas3(N, N), fw = N / 8, fh = N / 8;
    cv.each((x, y, i) => {
      const row = Math.floor(y / fh), xx = (x + (row % 2) * fw / 2) % N, col = Math.floor(xx / fw);
      const fx = (xx % fw) / fw - 0.5, fy = (y % fh) / fh; // fy 0 top (under the row above) .. 1 the rounded tip
      const r = Math.hypot(fx * 1.3, (fy - 0.15) * 0.9);
      const edge = r > 0.62 ? -0.5 : 0;
      const shaft = Math.abs(fx) < 0.06 && fy > 0.2 ? -0.3 : 0;
      const bar = fy > 0.72 && r < 0.62 ? 1 : 0;
      cv.hgt[i] = 0.3 + (1 - r) * 0.5;
      const c = sh(R, (hash(col, row, s) - 0.5) * 0.4 + edge + shaft + (0.5 - fy) * 0.35);
      return bar ? mixc(c, tip, 0.65) : c;
    });
    return { map: cv.map(), bump: cv.bump(), bumpScale: 0.5 };
  });
}
/** Scales (an acorn cap, a pine cone): staggered rows of pointed scales with dark gaps and pale tips */
export function scales(base: Col, seed = 13): Painted {
  return cached('sca' + base + seed, () => {
    const N = 64, R = ramp(base), cv = new Canvas3(N, N), w = 8, h = 8;
    cv.each((x, y, i) => {
      const row = Math.floor(y / h), xx = (x + (row % 2) * w / 2) % N, fx = (xx % w) / w - 0.5, fy = (y % h) / h;
      const inside = Math.abs(fx) < 0.5 * (1 - fy * 0.75);
      cv.hgt[i] = inside ? 0.4 + fy * 0.5 : 0.1;
      return inside ? sh(R, -0.3 + fy * 0.8 + (hash(Math.floor(xx / w), row, seed) - 0.5) * 0.3) : sh(R, -0.85);
    });
    return { map: cv.map(), bump: cv.bump(), bumpScale: 0.7 };
  });
}
/** Shingles: staggered rows of rounded wooden shingles, each with its own grain and shade, dark gaps between (rows run across u) */
export function shingles(base: Col, seed = 18): Painted {
  return cached('shi' + base + seed, () => {
    const N = 128, R = ramp(base), cv = new Canvas3(N, N), w = 16, h = 16;
    cv.each((x, y, i) => {
      const row = Math.floor(y / h), xx = (x + (row % 2) * w / 2) % N, col = Math.floor(xx / w), fx = (xx % w) / w - 0.5, fy = (y % h) / h;
      const round = fy > 0.7 ? Math.hypot(fx, (fy - 0.7) * 1.6) > 0.5 : false; // the rounded butt end
      const gap = Math.abs(fx) > 0.44 || round;
      const grain = (tn(x, y, N, N, 8, 1, seed + col) - 0.5) * 0.8;
      cv.hgt[i] = gap ? 0.1 : 0.3 + fy * 0.6;
      return gap ? sh(R, -0.9) : sh(R, (hash(col, row, seed) - 0.5) * 0.5 + grain - (1 - fy) * 0.35 + (fy > 0.86 ? 0.25 : 0));
    });
    return { map: cv.map(), bump: cv.bump(), bumpScale: 1 };
  });
}
/** A cut gem: flat facets of different brightness, colour zoning and little inner sparkles */
export function gem(base: Col, seed = 14): Painted {
  return cached('gem' + base + seed, () => {
    const N = 128, R = ramp(base), cv = new Canvas3(N, N);
    cv.each((x, y) => {
      const [f1, f2, id] = cells(x, y, N, N, 5, 5, seed, 0.9);
      const edge = f2 - f1 < 0.05 ? 0.55 : 0;
      const sp = hash(x, y, seed) > 0.994 ? 1 : 0;
      return sh(R, (id - 0.5) * 1.1 + edge + sp + (tn(x, y, N, N, 1, 1, seed + 1) - 0.5) * 0.4);
    });
    // a few four-point sparkles inside
    const rr = rnd(seed);
    cv.wrap((g) => {
      for (let i = 0; i < 4; i++) {
        const x = rr() * N, y = rr() * N, a = 3 + rr() * 4;
        g.fillStyle = 'rgba(255,252,240,0.95)';
        g.fillRect(x - a, y - 0.7, a * 2, 1.4); g.fillRect(x - 0.7, y - a, 1.4, a * 2);
      }
    });
    return { map: cv.map() };
  });
}
/** Wax: a soft translucent mottle and a few drip runs */
export function wax(base: Col, seed = 15): Painted {
  return cached('wax' + base + seed, () => {
    const N = 64, R = ramp(base), cv = new Canvas3(N, N);
    cv.each((x, y) => {
      const drip = Math.abs(tn(x, y, N, N, 4, 1, seed) - 0.5) < 0.03 ? 0.3 : 0;
      return sh(R, (tn(x, y, N, N, 1, 2, seed + 1) - 0.5) * 0.5 + drip);
    });
    return { map: cv.map() };
  });
}
/** Flame: rising licks, white-gold at the heart, orange at the edges (unlit) */
export function flame(base: Col, seed = 16): Painted {
  return cached('fla' + base + seed, () => {
    const N = 64, R = ramp(base), cv = new Canvas3(N, N);
    cv.each((x, y) => sh(R, (tn(x, y, N, N, 3, 1, seed) - 0.5) * 1.6 + (Math.abs(tn(x, y, N, N, 4, 1, seed + 2) - 0.5) < 0.04 ? 0.6 : 0)));
    return { map: cv.map() };
  });
}
/** A cloud: soft painted puffs with a cool shaded underside wash */
export function cloudTex(base: Col, seed = 17): Painted {
  return cached('clou' + base + seed, () => {
    const N = 64, R = ramp(base), cv = new Canvas3(N, N);
    cv.each((x, y) => { const [f1] = cells(x, y, N, N, 4, 4, seed, 1); return sh(R, 0.3 - f1 * 0.9 + (tn(x, y, N, N, 2, 2, seed) - 0.5) * 0.4); });
    return { map: cv.map() };
  });
}

// ------------------------------------------------------------------ texture coordinates at one density

/** keep a mesh's own texture coordinates (a dial, a painted face) */
export const keepUV = <T extends THREE.Material>(m: T): T => { m.userData.keepUV = true; return m; };

/**
 * Give every mesh under `root` texture coordinates in model units x `density` (tiles per unit), so every surface
 * shows its texture at the same texel size: turned parts (lathes, cylinders) wrap round with whole repeats, tubes and
 * tori run along their length, extrusions use their outline, anything else a box projection. Meshes whose material
 * says `keepUV` are left alone. Run it before merging meshes.
 */
export function fitUV(root: THREE.Object3D, density = 0.5): void {
  root.updateMatrixWorld(true);
  const rs = new THREE.Vector3();
  root.getWorldScale(rs);
  const seen = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.some((x) => x.userData.keepUV)) return;
    if (seen.has(m.geometry)) return;
    seen.add(m.geometry);
    const ws = new THREE.Vector3();
    m.getWorldScale(ws);
    const k = density * ((ws.x + ws.y + ws.z) / 3) / ((rs.x + rs.y + rs.z) / 3 || 1);
    worldUV(m.geometry, k);
  });
}
function worldUV(g: THREE.BufferGeometry, k: number) {
  const p = g.attributes.position as THREE.BufferAttribute;
  if (!p) return;
  let uv = g.attributes.uv as THREE.BufferAttribute | undefined;
  const type = g.type, prm = (g as unknown as { parameters?: Record<string, unknown> }).parameters ?? {};
  if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(p.count * 2), 2); g.setAttribute('uv', uv); }
  // always start from the geometry's own coordinates, so fitting again (at another density) doesn't compound
  const own = (g.userData.uv0 ??= Float32Array.from(uv.array as Float32Array)) as Float32Array;
  const U = (i: number) => own[i * 2], V = (i: number) => own[i * 2 + 1];
  const ring = (r: number) => Math.max(1, Math.round(2 * Math.PI * r * k));
  if (type === 'LatheGeometry') {
    const pts = prm.points as THREE.Vector2[], seg = prm.segments as number, n = pts.length;
    const arc = [0]; let rMax = 0;
    for (let j = 1; j < n; j++) arc.push(arc[j - 1] + pts[j].distanceTo(pts[j - 1]));
    for (const q of pts) rMax = Math.max(rMax, q.x);
    const reps = ring(rMax);
    for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) { const idx = i * n + j; if (idx < uv.count) uv.setXY(idx, (i / seg) * reps, arc[j] * k); }
  } else if (type === 'TorusGeometry') {
    const R = prm.radius as number, r = prm.tube as number, arcA = prm.arc as number;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, U(i) * Math.max(1, Math.round(R * arcA * k)), V(i) * ring(r));
  } else if (type === 'TubeGeometry') {
    const path = prm.path as THREE.Curve<THREE.Vector3>, r = prm.radius as number;
    const len = path.getLength();
    for (let i = 0; i < uv.count; i++) uv.setXY(i, U(i) * len * k, V(i) * ring(r));
  } else if (type === 'CylinderGeometry') {
    const r = Math.max(prm.radiusTop as number, prm.radiusBottom as number), h = prm.height as number;
    const side = (prm.radialSegments as number + 1) * (prm.heightSegments as number + 1);
    for (let i = 0; i < uv.count; i++) {
      if (i < side) uv.setXY(i, U(i) * ring(r), V(i) * h * k);
      else uv.setXY(i, (U(i) - 0.5) * 2 * r * k, (V(i) - 0.5) * 2 * r * k);
    }
  } else if (type === 'SphereGeometry') {
    const r = prm.radius as number;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, U(i) * ring(r), V(i) * Math.PI * r * k);
  } else if (type === 'ExtrudeGeometry') {
    // caps carry the outline's coordinates, walls (along the outline, depth): both already in model units
    for (let i = 0; i < uv.count; i++) uv.setXY(i, U(i) * k, V(i) * k);
  } else {
    // a box projection by each face's main axis
    const nrm = g.attributes.normal as THREE.BufferAttribute | undefined;
    if (!nrm) g.computeVertexNormals();
    const N = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(N.getX(i)), ay = Math.abs(N.getY(i)), az = Math.abs(N.getZ(i));
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (ay >= ax && ay >= az) uv.setXY(i, x * k, z * k); else if (ax >= az) uv.setXY(i, z * k, y * k); else uv.setXY(i, x * k, y * k);
    }
  }
  uv.needsUpdate = true;
}

// ------------------------------------------------------------------ photo textures

/** the photo swatches, in the order they sit in the interface atlas */
export const SWATCHES = ['wood', 'woodg', 'leather', 'grain', 'linen', 'knit', 'velvet'] as const;
export type Swatch = (typeof SWATCHES)[number];
const photos = new Map<Swatch, HTMLCanvasElement>();
const photoTex = new Map<string, THREE.Texture>();
/** register a photo swatch: the `rect` [x, y, w, h] of `src` (an atlas or a single image) */
export function setSwatch(name: Swatch, src: CanvasImageSource, rect: [number, number, number, number]) {
  const c = document.createElement('canvas');
  c.width = rect[2]; c.height = rect[3];
  c.getContext('2d')!.drawImage(src, rect[0], rect[1], rect[2], rect[3], 0, 0, rect[2], rect[3]);
  photos.set(name, c);
}
export const hasSwatch = (name: Swatch) => photos.has(name);
/** a photo swatch's image (null until it is registered) */
export const swatchCanvas = (name: Swatch): HTMLCanvasElement | null => photos.get(name) ?? null;
/** a photo swatch as a repeating texture, `rep` times per texture-coordinate unit (null until it is registered) */
export function swatchAt(name: Swatch, rep = 1): THREE.Texture | null {
  const c = photos.get(name);
  if (!c) return null;
  const key = name + rep;
  let t = photoTex.get(key);
  if (!t) {
    t = toTex(c, true, false);
    t.repeat.set(rep, rep);
    photoTex.set(key, t);
  }
  return t;
}
