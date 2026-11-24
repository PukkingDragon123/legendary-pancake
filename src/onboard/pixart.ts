// A tiny pixel painter for the interview's hand-made UI art: everything is painted pixel by pixel into a
// small canvas at "art resolution" in the calm palette (src/gfx/palette.ts), then shown scaled up with
// image-rendering: pixelated. Round things are stepped pixel circles (no anti-aliasing anywhere), shading
// is hard bands with hue-shifted ramps (cool shadows, warm lights), and materials are clusters of hand-placed
// texels (wood grain, paper fibres, brass, rubber, cork, graphite).
import { P, hex, light, mixc, shadow } from '../gfx/palette.ts';

export type Col = string | null;

/** A 6-step hue-shifted ramp around a palette colour: [deep shadow ... highlight]. */
export function ramp(c: number): string[] {
  return [shadow(c, 0.9), shadow(c, 0.6), shadow(c, 0.3), c, light(c, 0.35), light(c, 0.75)].map(hex);
}

export const R = {
  ink: ramp(P.ink), paper: ramp(P.paper), oat: ramp(P.oat), linen: ramp(P.linen), straw: ramp(P.straw),
  woodPale: ramp(P.woodPale), wood: ramp(P.wood), woodLight: ramp(P.woodLight), woodDark: ramp(P.woodDark), woodDeep: ramp(P.woodDeep),
  sage: ramp(P.sage), moss: ramp(P.moss), fern: ramp(P.fern), leaf: ramp(P.leaf), pine: ramp(P.pine),
  mist: ramp(P.mist), sky: ramp(P.sky), lake: ramp(P.lake), dusk: ramp(P.dusk), slate: ramp(P.slate), night: ramp(P.night), deep: ramp(P.deepNight),
  lamp: ramp(P.lamp), honey: ramp(P.honey), ochre: ramp(P.ochre), terracotta: ramp(P.terracotta), clay: ramp(P.clay),
  rose: ramp(P.rose), blush: ramp(P.blush), berry: ramp(P.berry), plum: ramp(P.plum), lilac: ramp(P.lilac),
  snow: ramp(P.snow), frost: ramp(P.frost), brass: ramp(P.brass), iron: ramp(P.iron), stone: ramp(P.stone), cream: ramp(P.cream), soot: ramp(P.soot),
};
export const INK = hex(mixc(P.ink, P.slate, 0.2));
export const GRAPHITE = hex(mixc(P.ink2, P.slate, 0.35));

export function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise (for clusters, not speckle). */
export function vnoise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x: number, y: number, s = 0) => vnoise(x, y, s) * 0.6 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.1;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];
const clampi = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
/** Pick a ramp step for a tone 0..5 with ordered dithering between steps (d = dither strength 0..1). */
export const step = (r: string[], t: number, x = 0, y = 0, d = 0.5) => r[clampi(Math.floor(t + (bayer(x, y) - 0.5) * d + 0.5), 0, r.length - 1)];

const rgbCache = new Map<string, [number, number, number]>();
function rgb(c: string): [number, number, number] {
  let v = rgbCache.get(c);
  if (!v) { const n = parseInt(c.slice(1, 7), 16); v = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(c, v); }
  return v;
}

export class Pix {
  readonly d: Uint8ClampedArray<ArrayBuffer>;
  constructor(readonly w: number, readonly h: number) { this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4)); }
  set(x: number, y: number, c: Col, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (!c || x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const i = (y * this.w + x) * 4, v = rgb(c);
    this.d[i] = v[0]; this.d[i + 1] = v[1]; this.d[i + 2] = v[2]; this.d[i + 3] = a;
    return this;
  }
  /** Write a raw colour (0..255 channels, quantised to steps of 6 like a limited print). */
  rgb(x: number, y: number, r: number, g: number, b: number, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, q = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v / 6) * 6);
    this.d[i] = q(r); this.d[i + 1] = q(g); this.d[i + 2] = q(b); this.d[i + 3] = a;
  }
  /** Add to a texel's colour. */
  tint(x: number, y: number, dr: number, dg: number, db: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.rgb(x, y, this.d[i] + dr, this.d[i + 1] + dg, this.d[i + 2] + db, this.d[i + 3]);
  }
  clear(x: number, y: number) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[(y * this.w + x) * 4 + 3] = 0; }
  a(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  get(x: number, y: number): string | null {
    if (!this.a(x, y)) return null;
    const i = (y * this.w + x) * 4;
    return '#' + ((1 << 24) | (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2]).toString(16).slice(1);
  }
  rect(x: number, y: number, w: number, h: number, c: Col | ((x: number, y: number) => Col)) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, typeof c === 'function' ? c(i, j) : c);
    return this;
  }
  hline(x0: number, x1: number, y: number, c: Col) { for (let x = x0; x <= x1; x++) this.set(x, y, c); return this; }
  vline(x: number, y0: number, y1: number, c: Col) { for (let y = y0; y <= y1; y++) this.set(x, y, c); return this; }
  line(x0: number, y0: number, x1: number, y1: number, c: Col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return this;
  }
  /** A filled stepped ellipse; `c` gets the normalised position (-1..1) to shade it. */
  disc(cx: number, cy: number, rx: number, ry: number, c: Col | ((nx: number, ny: number, x: number, y: number) => Col)) {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1) this.set(x, y, typeof c === 'function' ? c(nx, ny, x, y) : c);
    }
    return this;
  }
  /** A stepped ring of width t. */
  ring(cx: number, cy: number, r: number, t: number, c: Col | ((nx: number, ny: number) => Col)) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r && d > r - t) this.set(x, y, typeof c === 'function' ? c((x + 0.5 - cx) / r, (y + 0.5 - cy) / r) : c);
    }
    return this;
  }
  /** Filled polygon (even-odd). */
  poly(pts: [number, number][], c: Col | ((x: number, y: number) => Col)) {
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
    }
    return this;
  }
  /** A 1px outline around everything opaque (only on transparent texels). */
  outline(col = INK, diag = false) {
    const add: [number, number][] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.a(x, y)) continue;
      const n = this.a(x + 1, y) > 160 || this.a(x - 1, y) > 160 || this.a(x, y + 1) > 160 || this.a(x, y - 1) > 160
        || (diag && (this.a(x + 1, y + 1) > 160 || this.a(x - 1, y - 1) > 160 || this.a(x + 1, y - 1) > 160 || this.a(x - 1, y + 1) > 160));
      if (n) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, col);
    return this;
  }
  /** A hard drop shadow (dx, dy) behind the art, in a translucent slate. */
  drop(dx = 1, dy = 2, col = hex(mixc(P.ink, P.slate, 0.4)), alpha = 110) {
    const src = new Uint8ClampedArray(this.d);
    for (let y = this.h - 1; y >= 0; y--) for (let x = this.w - 1; x >= 0; x--) {
      const sx = x - dx, sy = y - dy;
      if (this.a(x, y) || sx < 0 || sy < 0 || sx >= this.w || sy >= this.h) continue;
      if (src[(sy * this.w + sx) * 4 + 3] > 160) this.set(x, y, col, alpha);
    }
    return this;
  }
  /** Stepped (pixel-rounded) corners: clears the corner texels. */
  corners(s = 2) {
    for (let k = 0; k < s; k++) for (let j = 0; j < s - k; j++) {
      this.clear(k, j); this.clear(this.w - 1 - k, j); this.clear(k, this.h - 1 - j); this.clear(this.w - 1 - k, this.h - 1 - j);
    }
    return this;
  }
  canvas() {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
  url() { return this.canvas().toDataURL(); }
}

const cache = new Map<string, string>();
/** Paint once per key, return a data URL. */
export function art(key: string, paint: () => Pix): string {
  let v = cache.get(key);
  if (!v) { v = paint().url(); cache.set(key, v); }
  return v;
}

// ------------------------------------------------------------------ materials

/** Wood: long grain strokes that wobble, darker growth lines, the odd knot; `along` the grain axis. */
export function woodFill(p: Pix, x0: number, y0: number, w: number, h: number, r: string[], o: { seed?: number; along?: 'x' | 'y'; base?: number; bevel?: boolean } = {}) {
  const s = o.seed ?? 1, base = o.base ?? 3, horiz = (o.along ?? 'x') === 'x';
  const kx = x0 + Math.floor(hash(s, 3) * w), ky = y0 + Math.floor(hash(s, 5) * h);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const u = horiz ? x : y, v = horiz ? y : x;
    // grain: the across coordinate warped by slow noise so lines wander and bunch
    const warp = v + Math.sin(u * 0.045 + s) * 2.2 + (vnoise(u * 0.03, v * 0.2, s) - 0.5) * 5;
    const kd = Math.hypot(x - kx, (y - ky) * 1.6);
    const ring = kd < 7 ? Math.sin(kd * 1.4) * 0.9 : 0;
    const g = Math.sin((warp + ring * 2) * 0.9) * 0.5 + Math.sin(warp * 0.37 + 1.3) * 0.5;
    let t = base + (g > 0.72 ? -1 : g < -0.85 ? -0.7 : 0) + (vnoise(u * 0.05, v * 0.5, s + 2) - 0.5) * 1.2;
    // short streaks along the grain
    if (hash(Math.floor(u / 5), v, s) > 0.93) t += 0.8;
    if (kd < 2.2) t -= 1.4;
    if (o.bevel) {
      if (y === y0 || x === x0) t += 1;
      if (y === y0 + h - 1 || x === x0 + w - 1) t -= 1.2;
    }
    p.set(x, y, step(r, t, x, y, 0.4));
  }
}

// ------------------------------------------------------------------ high-resolution, realistic materials
// One texel per CSS px, painted like a scan of the real thing (in the manner of the owner's game BUSHED's paper and
// canvas painters): every texel decided by a rule, colours quantised to a limited print, no baked directional light.

const C3 = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

/** Writing paper: mottled pulp, fibres, foxing, ageing towards the edges. `tone` is the paper colour. */
export function paperReal(p: Pix, x0: number, y0: number, w: number, h: number, o: { tone?: number; seed?: number; age?: number; fibres?: number } = {}) {
  const seed = o.seed ?? 3, [br, bg, bb] = C3(o.tone ?? 0xefe7d2), age = o.age ?? 1;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const e = Math.min(x - x0, y - y0, x0 + w - 1 - x, y0 + h - 1 - y);
    let n = (fbm(x * 0.012, y * 0.012, seed) - 0.5) * 14 + (fbm(x * 0.07, y * 0.05, seed + 3) - 0.5) * 7 + (hash(x, y, seed) - 0.5) * 6;
    const ag = e < 16 ? (16 - e) * 0.9 * age * (0.6 + vnoise(x * 0.08, y * 0.08, seed + 5)) : 0;
    if (fbm(x * 0.05, y * 0.05, seed + 9) > 0.74) n -= 6;
    p.rgb(x, y, br + n - ag * 0.6, bg + n - ag * 0.9, bb + n - ag * 1.6);
  }
  // fibres: short strands a shade lighter or darker, in every direction
  const nf = Math.round(w * h * 0.004 * (o.fibres ?? 1));
  for (let k = 0; k < nf; k++) {
    const x = x0 + Math.floor(hash(k, 1, seed) * w), y = y0 + Math.floor(hash(k, 2, seed) * h);
    const a = hash(k, 3, seed) * Math.PI, len = 2 + Math.floor(hash(k, 4, seed) * 6), d = hash(k, 5, seed) > 0.45 ? -7 : 6;
    for (let i = 0; i < len; i++) p.tint(Math.round(x + Math.cos(a) * i), Math.round(y + Math.sin(a) * i), d, d, d * 0.9);
  }
  // foxing: a few rusty freckles
  for (let k = 0; k < Math.round(w * h * 0.00004 * age) + 1; k++) {
    const cx = x0 + hash(k, 7, seed) * w, cy = y0 + hash(k, 8, seed) * h, r = 1 + hash(k, 9, seed) * 2.5;
    for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy <= r * r) p.tint(Math.round(cx + xx), Math.round(cy + yy), -8, -12, -18);
  }
}

/** A hand-ruled ink line: faded, slightly uneven, the odd skip where the nib ran dry. */
export function inkLine(p: Pix, x0: number, x1: number, y: number, col: number, seed = 1, strength = 1) {
  const [r, g, b] = C3(col);
  for (let x = x0; x <= x1; x++) {
    const k = hash(x >> 2, y, seed);
    if (k > 0.97) continue;
    const yy = y + (vnoise(x * 0.02, y, seed) > 0.8 ? 1 : 0);
    const i = (yy * p.w + x) * 4, f = (0.45 + k * 0.25) * strength;
    p.rgb(x, yy, p.d[i] + (r - p.d[i]) * f, p.d[i + 1] + (g - p.d[i + 1]) * f, p.d[i + 2] + (b - p.d[i + 2]) * f);
  }
}

/** Hardboard: warm brown fibreboard, a fine speckle and streaky fibres, a polished face and lighter worn edges. */
export function hardboardReal(p: Pix, x0: number, y0: number, w: number, h: number, seed = 4) {
  const [br, bg, bb] = C3(0x7a5c42);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const e = Math.min(x - x0, y - y0, x0 + w - 1 - x, y0 + h - 1 - y);
    let n = (fbm(x * 0.01, y * 0.03, seed) - 0.5) * 18 + (vnoise(x * 0.4, y * 0.04, seed + 1) - 0.5) * 10 + (hash(x, y, seed) - 0.5) * 12;
    if (hash(x, y, seed + 2) > 0.985) n += 18;
    if (hash(x >> 1, y >> 1, seed + 3) < 0.01) n -= 22;
    // the bevelled edge: a dark lip, a light worn arris, then the face
    if (e === 0) n = -70; else if (e < 3) n += (y - y0 < 3 || x - x0 < 3 ? 34 : -28) + (hash(x, y, 9) - 0.5) * 16;
    else if (e < 9 && fbm(x * 0.15, y * 0.15, seed + 4) > 0.58) n += 14;
    p.rgb(x, y, br + n, bg + n * 0.85, bb + n * 0.7);
  }
}

/** Paper: an off-white field with fibres (short light and dark strands), soft foxing clusters, deckle grain. */
export function paperFill(p: Pix, x0: number, y0: number, w: number, h: number, r: string[] = R.paper, seed = 3, base = 4) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    let t = base + (fbm(x * 0.05, y * 0.05, seed) - 0.5) * 0.9;
    const f = hash(x >> 1, y, seed), f2 = hash(x, y >> 1, seed + 1);
    if (f > 0.985) t -= 0.9;
    if (f2 > 0.988) t += 0.7;
    if (fbm(x * 0.09, y * 0.09, seed + 9) > 0.78) t -= 0.7;
    p.set(x, y, step(r, t, x, y, 0.35));
  }
}

/** Hardboard (the clipboard back): a fine dark speckle on warm brown, chunky bevel, worn lighter edges. */
export function boardFill(p: Pix, x0: number, y0: number, w: number, h: number, seed = 4) {
  const r = R.woodDark;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const e = Math.min(x - x0, y - y0, x0 + w - 1 - x, y0 + h - 1 - y);
    let t = 3 + (fbm(x * 0.04, y * 0.12, seed) - 0.5) * 1.1;
    const sp = hash(x, y, seed);
    if (sp > 0.94) t -= 1; else if (sp < 0.03) t += 1;
    if (hash(x >> 2, y, seed + 3) > 0.97) t += 0.6;
    if (e === 0) t = 0; else if (e === 1) t = y - y0 === 1 || x - x0 === 1 ? 5 : 1; else if (e === 2) t += y - y0 === 2 || x - x0 === 2 ? 1 : -0.6;
    if (e > 2 && e < 6 && fbm(x * 0.2, y * 0.2, seed + 5) > 0.62) t += 0.8;
    p.set(x, y, step(r, t, x, y, 0.3));
  }
}

/** A metal band (brass/steel) lit from the top: rows of ramp steps with a hot highlight line. */
export function metalRows(rows: number, r: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < rows; i++) {
    const k = i / Math.max(1, rows - 1);
    out.push(k < 0.12 ? r[5] : k < 0.3 ? r[4] : k < 0.6 ? r[3] : k < 0.85 ? r[2] : r[1]);
  }
  return out;
}

/** A screw head: a slotted stepped disc. */
export function screw(p: Pix, cx: number, cy: number, r = 3, rr = R.iron, ang = 0.6) {
  p.disc(cx, cy, r, r, (nx, ny) => rr[nx + ny < -0.5 ? 5 : nx + ny < 0.1 ? 4 : nx + ny < 0.7 ? 3 : 2]);
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let k = -r + 1; k <= r - 1; k++) p.set(Math.round(cx - 0.5 + dx * k), Math.round(cy - 0.5 + dy * k), rr[1]);
  p.ring(cx, cy, r + 1, 1, rr[0]);
}

// ------------------------------------------------------------------ 9-slice frames

export interface Frame9 { url: string; slice: number; w: number }
const frames = new Map<string, Frame9>();
/** A 9-slice frame painted once: `paint(p, size)` draws a size x size tile; the border is `slice` texels. */
export function frame9(name: string, size: number, slice: number, paint: (p: Pix, n: number) => void): Frame9 {
  let f = frames.get(name);
  if (!f) {
    const p = new Pix(size, size);
    paint(p, size);
    f = { url: p.url(), slice, w: size };
    frames.set(name, f);
  }
  return f;
}
/** CSS for a 9-slice frame drawn at `k` CSS px per texel. */
export function frameCSS(f: Frame9, k = 2, fill = true) {
  return `border-style:solid;border-width:${f.slice * k}px;border-image:url(${f.url}) ${f.slice} ${fill ? "fill" : ""} / ${f.slice * k}px / 0 repeat;image-rendering:pixelated;`;
}

/** A pixel-stepped rounded-rectangle clip-path (s = step size in CSS px). */
export function pixelCorners(s = 4) {
  const L = (v: number) => `${v}px`, Rr = (v: number) => `calc(100% - ${v}px)`;
  const pts = [
    [L(0), L(2 * s)], [L(s), L(2 * s)], [L(s), L(s)], [L(2 * s), L(s)], [L(2 * s), L(0)],
    [Rr(2 * s), L(0)], [Rr(2 * s), L(s)], [Rr(s), L(s)], [Rr(s), L(2 * s)], [Rr(0), L(2 * s)],
    [Rr(0), Rr(2 * s)], [Rr(s), Rr(2 * s)], [Rr(s), Rr(s)], [Rr(2 * s), Rr(s)], [Rr(2 * s), Rr(0)],
    [L(2 * s), Rr(0)], [L(2 * s), Rr(s)], [L(s), Rr(s)], [L(s), Rr(2 * s)], [L(0), Rr(2 * s)],
  ];
  return `polygon(${pts.map(([x, y]) => `${x} ${y}`).join(',')})`;
}
