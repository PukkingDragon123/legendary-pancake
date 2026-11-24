// Material swatches for Hoot Hollow's interface, in the manner of BUSHED's UI (the owner's lumberjack game):
// real materials (worn wood boards, duck canvas, brown leather, herringbone wool, oat paper, brass) as crisp,
// detailed, high-resolution pixel art. Photo-derived tiles come from BUSHED (textiles.js); paper and brass are
// painted texel by texel like BUSHED's paper.ts and the Book of Cryptids textures (value noise, fibres, foxing,
// ordered dithering). Every colour is graded into the calm, quiet palette (calm.js).
// OWNED BY THE UI BUILDER (ui3).
import { TEXTILES } from './textiles.js';
import { calmRGB } from './calm.js';

// ---------------------------------------------------------------- noise and dithering
export function hash(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
/** ordered dither offset in (-0.5, 0.5) */
export const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
/** periodic value noise: period px x py lattice cells (so textures tile) */
export function pnoise(x, y, px, py, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const m = (a, p) => ((a % p) + p) % p;
  const x0 = m(xi, px), x1 = m(xi + 1, px), y0 = m(yi, py), y1 = m(yi + 1, py);
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** periodic fbm over a W x H texel tile, cell = size of the biggest feature in texels; result 0..1 */
export function pfbm(x, y, W, H, cell, oct = 3, s = 0) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    const c = Math.max(1, cell / (1 << o));
    sum += amp * pnoise(x / c, y / c, Math.max(1, Math.round(W / c)), Math.max(1, Math.round(H / c)), s + o * 17);
    norm += amp; amp *= 0.5;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- colour
export const hexRGB = (h) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mixRGB = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mulRGB = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
/** a graded ramp from hex stops (dark to light) */
export const ramp = (...hs) => hs.map((h) => calmRGB(hexRGB(h)));
/** pick a ramp entry for v in 0..1 with ordered dithering between neighbours */
export function rampAt(r, v, x, y, dither = 0.9) {
  const f = v * (r.length - 1) + bayer(x, y) * dither;
  return r[Math.max(0, Math.min(r.length - 1, Math.round(f)))];
}

// ---------------------------------------------------------------- BUSHED tiles
const tiles = new Map();
/** decode a textile tile (graded into the calm palette): { w, h, px: Uint8Array rgb, l: Float32Array luminance } */
export function tile(name) {
  let t = tiles.get(name);
  if (t) return t;
  const src = TEXTILES[name];
  const pal = src.pal.map((h) => calmRGB(hexRGB(h)));
  const bin = typeof atob === 'function' ? atob(src.idx) : Buffer.from(src.idx, 'base64').toString('binary');
  const n = src.w * src.h, px = new Uint8Array(n * 3), l = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) { const c = pal[bin.charCodeAt(i)] ?? pal[0]; px[i * 3] = c[0]; px[i * 3 + 1] = c[1]; px[i * 3 + 2] = c[2]; l[i] = lum(c); sum += l[i]; }
  t = { w: src.w, h: src.h, px, l, mean: sum / n };
  tiles.set(name, t);
  return t;
}
/** the tile's colour at a texel (wrapping) */
export function sample(name, x, y) {
  const t = tile(name), X = ((Math.floor(x) % t.w) + t.w) % t.w, Y = ((Math.floor(y) % t.h) + t.h) % t.h, i = (Y * t.w + X) * 3;
  return [t.px[i], t.px[i + 1], t.px[i + 2]];
}
/** the tile's luminance at a texel (wrapping), 0..1 */
export function lumAt(name, x, y) {
  const t = tile(name), X = ((Math.floor(x) % t.w) + t.w) % t.w, Y = ((Math.floor(y) % t.h) + t.h) % t.h;
  return t.l[Y * t.w + X];
}
/**
 * The tile's texture re-coloured onto a ramp: its light and shade (weave, grain, pores) carry over, the hue
 * comes from the ramp. `contrast` scales the texture's swing round `mid`.
 */
export function onRamp(name, r, x, y, mid = 0.5, contrast = 1.6, lift = 0) {
  const t = tile(name);
  const v = (lumAt(name, x, y) - t.mean) * contrast + mid + lift;
  return rampAt(r, Math.max(0, Math.min(1, v)), x, y, 0.6);
}

// ---------------------------------------------------------------- painted materials
/**
 * Oat paper (like BUSHED's paper.ts): fibres, cloudy mottling, foxing specks, a grain of single texels;
 * `age` (0..1) darkens and warms it (edges of a sheet). Tiles with period W x H texels.
 */
export function paperAt(x, y, W, H, o = {}) {
  const R = o.ramp ?? PAPER;
  const base = o.base ?? 0.62;
  const mott = pfbm(x, y, W, H, 24, 3, (o.seed ?? 1) + 3) - 0.5;
  const fib = pnoise(x / 9, y / 1.6, Math.max(1, Math.round(W / 9)), Math.max(1, Math.round(H / 1.6)), (o.seed ?? 1) + 8);
  const fibre = fib > 0.82 ? 0.09 : fib < 0.12 ? -0.07 : 0;
  const grain = (hash(((x % W) + W) % W, ((y % H) + H) % H, (o.seed ?? 1) + 21) - 0.5) * 0.08;
  const fox = hash(((x % W) + W) % W, ((y % H) + H) % H, (o.seed ?? 1) + 33) > 0.9985 ? -0.22 : 0;
  const age = (o.age ?? 0) * 0.35;
  return rampAt(R, base + mott * 0.22 + fibre + grain + fox - age, x, y, 0.7);
}
export const PAPER = ramp('#8e7c5e', '#b3a07e', '#cbbb98', '#dccfb0', '#e6dcc2', '#eee6d1', '#f5efe0');
export const PAPER_DARK = ramp('#7a6a50', '#9c8a6a', '#b6a482', '#cbbb98', '#d8caa8', '#e2d6b9', '#ebe2ca');

/** brushed, worn brass with engraved lines and a breath of verdigris in the hollows */
export function brassAt(x, y, v, o = {}) {
  const R = BRASS;
  const brush = (hash(x, y >> 1, 5) - 0.5) * 0.08 + (pnoise(x / 3, y / 8, 64, 16, 9) - 0.5) * 0.12;
  const c = rampAt(R, Math.max(0, Math.min(1, v + brush)), x, y, 0.8);
  if (o.patina && pnoise(x / 5, y / 5, 64, 64, 13) > 0.72) return mixRGB(c, VERDI, 0.35);
  return c;
}
export const BRASS = ramp('#2f2614', '#4e3f22', '#6e5a33', '#8e7650', '#ab9163', '#c4ab7a', '#dcc79a', '#efe2bf');
const VERDI = calmRGB(hexRGB('#6f8c78'));

/** a texel of BUSHED's worn floor boards (grain runs along x), toned (lift about -0.5..0.5), darker for walnut */
export function woodPx(x, y, lift = 0, dark = false) {
  const c = sample('boards', x, y);
  const k = (dark ? 0.62 : 1.02) * (1 + lift);
  return [c[0] * k, c[1] * k * 0.99, c[2] * k * 0.97];
}
