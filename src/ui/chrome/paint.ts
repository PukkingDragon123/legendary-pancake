// Procedural pixel painting for the chrome: carved wooden boards, ropes, chains, leafy branches,
// the carved plaques of the main buttons, the hanging tool tags and the shelf. Everything is
// painted at art-pixel resolution (1 texel = 2 CSS px on screen) into a small RGBA buffer,
// cached as a data URL, and shown with `image-rendering: pixelated`.
import { RAMPS } from '../px/sprites.js';

type C = [number, number, number];
const hexc = (h: string): C => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const RAMP = (name: string): C[] => (RAMPS[name] ?? RAMPS.wood).map(hexc);
export const INK: C = [42, 26, 20];
const mix = (a: C, b: C, t: number): C => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];

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
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];

export class Buf {
  d: Uint8ClampedArray<ArrayBuffer>;
  constructor(public w: number, public h: number) { this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4)); }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  a(x: number, y: number) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  set(x: number, y: number, c: C, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (!this.in(x, y)) return this;
    const i = (y * this.w + x) * 4;
    if (a >= 255 || !this.d[i + 3]) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a; return this; }
    const t = a / 255;
    this.d[i] = this.d[i] + (c[0] - this.d[i]) * t; this.d[i + 1] = this.d[i + 1] + (c[1] - this.d[i + 1]) * t; this.d[i + 2] = this.d[i + 2] + (c[2] - this.d[i + 2]) * t;
    this.d[i + 3] = Math.max(this.d[i + 3], a);
    return this;
  }
  get(x: number, y: number): C { const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2]]; }
  rect(x: number, y: number, w: number, h: number, c: C) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  /** Dark outline (4-neighbour) around everything opaque. */
  outline(c: C = INK) {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.a(x, y)) continue;
      if (this.a(x - 1, y) > 200 || this.a(x + 1, y) > 200 || this.a(x, y - 1) > 200 || this.a(x, y + 1) > 200) add.push(x, y);
    }
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c);
    return this;
  }
  canvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    cv.getContext('2d')!.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return cv;
  }
  url() { return this.canvas().toDataURL('image/png'); }
}

const urls = new Map<string, string>();
export function cached(key: string, make: () => Buf): string {
  let u = urls.get(key);
  if (u === undefined) {
    try { u = typeof document === 'undefined' ? '' : make().url(); } catch (e) { console.warn('paint failed', key, e); u = ''; }
    urls.set(key, u);
  }
  return u;
}

// ------------------------------------------------------------------ wood

function woodTone(x: number, y: number, seed: number, plank: number): number {
  const g = vnoise(x * 0.06 + plank * 17, y * 0.6 + plank * 3, seed) * 0.65 + vnoise(x * 0.22, y * 1.3, seed + 7) * 0.35;
  let t = g > 0.68 ? 4 : g > 0.4 ? 3 : 2;
  if (vnoise(x * 0.035, y * 2.2, seed + 11) > 0.8) t = 2;
  if (hash(x >> 2, y, seed) > 0.985) t = 1;
  return t;
}

export interface PlankOpts { tone?: string; seed?: number; planks?: number; carve?: boolean; nails?: [number, number][]; notch?: number }
/** A carved wooden board: grain, knots, bevelled edges, plank seams, an engraved inner border and brass nails. */
export function plank(w: number, h: number, o: PlankOpts = {}): string {
  const key = `plank:${w}x${h}:${JSON.stringify(o)}`;
  return cached(key, () => {
    const R = RAMP(o.tone ?? 'wood'), B = RAMP('brass'), seed = o.seed ?? 1, n = o.notch ?? 2, planks = o.planks ?? 1;
    const b = new Buf(w, h);
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !(x + y < n || w - 1 - x + y < n || x + h - 1 - y < n || w - 1 - x + h - 1 - y < n);
    const ph = (h - 2) / planks;
    const knots: [number, number][] = [];
    for (let i = 0; i < Math.max(1, Math.round(w / 40)); i++) knots.push([6 + hash(i, 1, seed) * (w - 12), 3 + hash(i, 2, seed) * (h - 6)]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) { b.set(x, y, INK); continue; }
      const pi = Math.min(planks - 1, Math.floor((y - 1) / ph));
      let t = woodTone(x, y, seed, pi);
      for (const [kx, ky] of knots) { const d = Math.hypot((x - kx) / 2.6, (y - ky) / 1.3); if (d < 1) t = d < 0.5 ? 1 : 2; else if (d < 1.5 && t > 2) t = 3; }
      const top = !inside(x, y - 2), left = !inside(x - 2, y), bottom = !inside(x, y + 2), right = !inside(x + 2, y);
      const py = (y - 1) - pi * ph;
      if (planks > 1 && pi > 0 && py < 1) t = 0;
      else if (planks > 1 && pi > 0 && py < 2) t = 4;
      if (top) t = 5; else if (left) t = Math.max(t, 4);
      if (bottom) t = 1; else if (right) t = Math.min(t, 2);
      if (!bottom && !inside(x, y + 3)) t = Math.min(t, 2);
      if (o.carve) {
        const gx0 = 3, gy0 = 3, gx1 = w - 4, gy1 = h - 4;
        const onH = (y === gy0 || y === gy1) && x >= gx0 && x <= gx1, onV = (x === gx0 || x === gx1) && y >= gy0 && y <= gy1;
        if (onH || onV) t = 1;
        else if ((y === gy0 + 1 && x > gx0 && x < gx1) || (x === gx0 + 1 && y > gy0 && y < gy1)) t = Math.min(t, 2);
        else if ((y === gy1 + 1 && x >= gx0 && x <= gx1 + 1) || (x === gx1 + 1 && y >= gy0 && y <= gy1 + 1)) t = 5;
      }
      b.set(x, y, R[t]);
    }
    for (const [nx, ny] of o.nails ?? []) rivet(b, nx, ny, B);
    return b;
  });
}
function rivet(b: Buf, x: number, y: number, B: C[]) {
  b.set(x - 1, y - 1, B[4]).set(x, y - 1, B[3]).set(x + 1, y - 1, B[2]);
  b.set(x - 1, y, B[3]).set(x, y, B[5]).set(x + 1, y, B[1]);
  b.set(x - 1, y + 1, B[2]).set(x, y + 1, B[1]).set(x + 1, y + 1, INK);
}

/** A twisted rope, 3 texels wide, tiling vertically. */
export function ropeTile(): string {
  return cached('rope', () => {
    const S = RAMP('straw'), b = new Buf(3, 3);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { const t = [4, 3, 1][(x + y) % 3]; b.set(x, y, S[x === 2 ? Math.max(0, t - 1) : t]); }
    return b;
  });
}
/** A brass chain, 4 texels wide, tiling vertically. */
export function chainTile(metal = 'brass'): string {
  return cached('chain:' + metal, () => {
    const M = RAMP(metal), b = new Buf(4, 6);
    const rows = ['.BB.', 'B..b', 'B..b', '.Bb.', '.Hd.', '.Hd.'];
    rows.forEach((r, y) => { for (let x = 0; x < 4; x++) { const ch = r[x]; if (ch === 'B') b.set(x, y, M[4]); if (ch === 'b') b.set(x, y, M[2]); if (ch === 'H') b.set(x, y, M[5]); if (ch === 'd') b.set(x, y, M[1]); } });
    return b;
  });
}

// ------------------------------------------------------------------ branch

/**
 * A gnarled branch growing in from one screen edge, with bark, moss, twigs and leaf clusters.
 * `from` is the edge it grows from. Returns the URL; the rope anchor points are along `y≈h*0.45`.
 */
export function branch(w: number, h: number, from: 'left' | 'right', seed = 3): string {
  return cached(`branch:${w}x${h}:${from}:${seed}`, () => {
    const b = new Buf(w, h), BK = RAMP('bear'), L = RAMP('leaf'), M = RAMP('moss');
    const U = (x: number) => (from === 'left' ? x : w - 1 - x);
    const cy = (u: number) => h * 0.42 + Math.sin(u * 0.06 + seed) * 1.3 + (u / w) * 1.5;
    const th = (u: number) => 7.5 - (u / w) * 4.2;
    // bark
    for (let x = 0; x < w; x++) {
      const u = U(x), c = cy(u), t = th(u);
      if (u > w - 3) continue;
      const y0 = Math.round(c - t / 2), y1 = Math.round(c + t / 2);
      for (let y = y0; y <= y1; y++) {
        const k = (y - y0) / Math.max(1, y1 - y0);
        let tone = k < 0.2 ? 4 : k < 0.45 ? 3 : k < 0.75 ? 2 : 1;
        if (hash(u >> 1, y, seed) > 0.86 && k > 0.2) tone = Math.max(0, tone - 1);
        if (vnoise(u * 0.3, y * 0.8, seed) > 0.72 && k > 0.3 && k < 0.8) tone = 1;
        b.set(x, y, BK[tone]);
        if (k < 0.2 && vnoise(u * 0.15, 0, seed + 5) > 0.55) b.set(x, y, M[hash(u, y) > 0.5 ? 4 : 3]);
      }
    }
    // twigs
    const twig = (u0: number, dir: number, len: number) => {
      let x = u0, y = cy(u0) - th(u0) / 2;
      for (let i = 0; i < len; i++) { x += dir * 0.7; y -= 1; const X = from === 'left' ? x : w - 1 - x; b.set(X, y, BK[3]); b.set(X + 1, y, BK[2]); }
    };
    twig(w * 0.3, 1, 4); twig(w * 0.62, -1, 3);
    // leaf clusters
    const leaf = (x: number, y: number, flipL: boolean, s: number) => {
      const pat = ['.ab.', 'abbc', '.bcc', '..c.'];
      pat.forEach((r, j) => { for (let i = 0; i < 4; i++) { const ch = r[flipL ? 3 - i : i]; if (ch === '.') continue; const t = ch === 'a' ? 5 : ch === 'b' ? (s > 0.5 ? 4 : 3) : 2; b.set(x + i, y + j, L[t]); } });
    };
    const spots = [0.08, 0.2, 0.33, 0.45, 0.58, 0.7, 0.82, 0.94];
    spots.forEach((p, i) => {
      const u = p * w, c = cy(u);
      const n = 5 + Math.round(hash(i, 0, seed) * 4);
      for (let k = 0; k < n; k++) {
        const ox = (hash(i, k, seed + 1) - 0.5) * 12, oy = (hash(i, k, seed + 2) - 0.5) * 9 + (k % 2 ? -3 : 3);
        const X = from === 'left' ? u + ox : w - 1 - (u + ox);
        leaf(Math.round(X - 2), Math.round(c + oy - 2), (k + i) % 2 === 0, hash(i, k, seed + 3));
      }
    });
    b.outline([30, 22, 16]);
    return b;
  });
}

// ------------------------------------------------------------------ main-button plaque

export type Inner = 'night' | 'paper' | 'velvet';
/** A chunky carved frame with a recessed window and a brass name plate along the bottom. */
export function plaque(w: number, h: number, inner: Inner, seed = 5, plateH = 12): string {
  return cached(`plaque:${w}x${h}:${inner}:${seed}:${plateH}`, () => {
    const b = new Buf(w, h), R = RAMP('wood'), D = RAMP('dwood'), B = RAMP('brass');
    const n = 3, fw = 5, wy1 = h - plateH - 1;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !(x + y < n || w - 1 - x + y < n || x + h - 1 - y < n || w - 1 - x + h - 1 - y < n);
    const win = (x: number, y: number) => x >= fw && x < w - fw && y >= fw && y < wy1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) { b.set(x, y, INK); continue; }
      if (win(x, y)) { b.set(x, y, windowPx(inner, x - fw, y - fw, w - 2 * fw, wy1 - fw, seed)); continue; }
      if (win(x + 1, y) || win(x, y + 1) || win(x + 1, y + 1)) { b.set(x, y, INK); continue; } // the window's dark lip
      let t = woodTone(x * 1.3, y * 0.4 + x * 0.05, seed, 0);
      const top = !inside(x, y - 2), left = !inside(x - 2, y), bottom = !inside(x, y + 2), right = !inside(x + 2, y);
      if (top) t = 5; else if (left) t = 4;
      if (bottom) t = 1; else if (right) t = 2;
      // a carved groove halfway into the frame
      const gi = 2;
      const gx0 = gi + 1, gy0 = gi + 1, gx1 = w - gi - 2, gy1 = h - gi - 2;
      if (((y === gy0 || y === gy1) && x >= gx0 && x <= gx1) || ((x === gx0 || x === gx1) && y >= gy0 && y <= gy1)) t = 1;
      // bevel towards the window
      if (win(x - 1, y) || win(x, y - 1)) t = 5;
      b.set(x, y, R[t]);
    }
    // the window's inner shadow (top and left)
    for (let x = fw; x < w - fw; x++) { b.set(x, fw, [0, 0, 0], 70); b.set(x, fw + 1, [0, 0, 0], 35); }
    for (let y = fw; y < wy1; y++) { b.set(fw, y, [0, 0, 0], 70); }
    // brass name plate
    const px0 = 5, px1 = w - 6, py0 = wy1 + 2, py1 = h - 4;
    for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++) {
      const e = x === px0 || x === px1 || y === py0 || y === py1;
      const corner = (x === px0 || x === px1) && (y === py0 || y === py1);
      if (corner) continue;
      if (e) { b.set(x, y, D[0]); continue; }
      let t = 3;
      if (y === py0 + 1) t = 5; else if (y === py1 - 1) t = 1; else if (x === px0 + 1) t = 4; else if (x === px1 - 1) t = 2;
      else if ((x + y * 2) % 11 === 0) t = 4;
      b.set(x, y, B[t]);
    }
    rivet(b, px0 + 3, (py0 + py1) >> 1, B); rivet(b, px1 - 3, (py0 + py1) >> 1, B);
    // brass corner caps
    for (const [cx, cy, sx, sy] of [[1, 1, 1, 1], [w - 2, 1, -1, 1], [1, h - 2, 1, -1], [w - 2, h - 2, -1, -1]]) {
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4 - j; i++) { const x = cx + i * sx, y = cy + j * sy; if (inside(x, y) && b.a(x, y)) b.set(x, y, B[j === 0 || i === 0 ? 4 : 3]); }
      rivet(b, cx + sx * 1, cy + sy * 1, B);
    }
    return b;
  });
}
function windowPx(inner: Inner, x: number, y: number, w: number, h: number, seed: number): C {
  const k = y / h;
  if (inner === 'night') {
    const pal = ['#141a42', '#1b2152', '#232a62', '#2d3370'].map(hexc);
    const i = Math.min(3, Math.floor(k * 3.2 + bayer(x, y) * 0.9));
    if (hash(x, y, seed) > 0.985) return hexc('#b8b4f0');
    if (k > 0.82) return mix(pal[i], hexc('#3a2e5a'), 0.5);
    return pal[i];
  }
  if (inner === 'paper') {
    const base = hexc('#ecd3a0'), stripe = hexc('#e0c18a'), dot = hexc('#c99a6a');
    let c = (x % 6 === 0 || x % 6 === 1) ? stripe : base;
    if (x % 6 === 3 && y % 6 === 2) c = dot;
    if (k > 0.85) c = mix(c, hexc('#8b5a2b'), 0.35);
    return mix(c, hexc('#a06a36'), Math.max(0, (k - 0.55) * 0.4 + (bayer(x, y) - 0.5) * 0.06));
  }
  // velvet: deep teal with a diamond lattice and gold studs
  const base = hexc('#1f3e3a'), dark = hexc('#16302d'), lite = hexc('#2a514a'), gold = hexc('#d9ad4a');
  const u = (x + y) % 8, v = (x - y + 800) % 8;
  if (u === 0 && v === 0) return gold;
  let c = u === 0 || v === 0 ? dark : (u + v) % 7 === 3 ? lite : base;
  if (k > 0.85) c = mix(c, hexc('#0e1e1c'), 0.5);
  return c;
}

/** A long shelf board with dark iron brackets underneath. */
export function shelf(w: number): string {
  return cached(`shelf:${w}`, () => {
    const h = 12, b = new Buf(w, h), top = plankBuf(w, 6, 'lwood', 9), I = RAMP('iron');
    b.d.set(top.d.subarray(0, w * 6 * 4), 0);
    for (const bx of [8, w - 16]) {
      for (let y = 6; y < h; y++) for (let x = bx; x < bx + 8; x++) {
        const k = x - bx, j = y - 6;
        if (k > 7 - j - 1 + 1 && k > 1) continue; // triangular bracket
        b.set(x, y, k === 0 || j === 0 ? I[4] : I[2]);
      }
    }
    b.outline();
    return b;
  });
}
function plankBuf(w: number, h: number, tone: string, seed: number): Buf {
  const b = new Buf(w, h), R = RAMP(tone);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { b.set(x, y, INK); continue; }
    let t = woodTone(x, y, seed, 0);
    if (y === 1) t = 5; else if (y === h - 2) t = 1; else if (y === h - 3) t = 2;
    b.set(x, y, R[t]);
  }
  return b;
}

/** A square wooden tool tag with a recessed panel, brass studs and an eyelet at the top. */
export function tag(w: number, h: number, seed = 2): string {
  return cached(`tag:${w}x${h}:${seed}`, () => {
    const ring = 5, b = new Buf(w, h + ring), R = RAMP('wood'), B = RAMP('brass');
    const n = 3;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !(x + y < n || w - 1 - x + y < n || x + h - 1 - y < n || w - 1 - x + h - 1 - y < n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const Y = y + ring;
      if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)) { b.set(x, Y, INK); continue; }
      let t = woodTone(x, y * 1.5, seed, 0);
      const top = !inside(x, y - 2), left = !inside(x - 2, y), bottom = !inside(x, y + 2), right = !inside(x + 2, y);
      if (top) t = 5; else if (left) t = 4;
      if (bottom) t = 1; else if (right) t = 2;
      // recessed panel
      const p = 3;
      if (x >= p && x < w - p && y >= p && y < h - p) {
        t = Math.max(1, t - 1);
        if (y === p || x === p) t = 1;
        if (y === h - p - 1 || x === w - p - 1) t = 4;
      }
      b.set(x, Y, R[t]);
    }
    for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) { b.set(x, y + ring, B[5]); b.set(x + 1, y + ring + 1, B[1]); }
    // eyelet ring
    const cx = (w - 1) / 2;
    for (let y = 0; y < ring + 3; y++) for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, (y - 3) * 1.1);
      if (d < 3.4 && d > 1.6) b.set(x, y, B[d < 2.4 ? 2 : (x < cx ? 5 : 3)]);
      else if (d >= 3.4 && d < 4.4 && !b.a(x, y)) b.set(x, y, INK);
    }
    return b;
  });
}
