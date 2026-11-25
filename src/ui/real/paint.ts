// Real: the interface's high-resolution material painter (replaces the v4 pixel "relief" painter for the UI).
// Every object is a stack of parts. A part is a signed-distance shape (rounded plaques, carved scrolls, torn
// paper, rings, polygons) with a height profile (round bevels, chamfers, domes, mouldings) and a material
// (photo-textured walnut, oak, leather, bookcloth, linen, velvet, felt, parchment, kraft, cork; procedural
// brass, enamel, glass, glow). Rendered at device resolution: anti-aliased edges, normals from the height
// field, one warm key light from the top left with cool ambient fill, ambient occlusion in the hollows, Blinn
// specular, a clear coat on varnish and enamel, a soft studio reflected in metal and glass, velvet sheen, and a
// soft cast shadow. Nothing is stepped or dithered.
import { DETAIL, sampleTex, texReady, type TexName } from './tex.ts';

export type RGB = [number, number, number];
export type BB = [number, number, number, number];
/** signed distance in design units (CSS px): < 0 inside. `bb` (optional) bounds the inside. */
export type SDF = ((x: number, y: number) => number) & { bb?: BB };
/** height (units) at (x, y), given how far inside the shape the point is (`ins` = -sdf, units) */
export type HFn = (x: number, y: number, ins: number) => number;

export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const hex = (h: string): RGB => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

// ------------------------------------------------------------------ noise (smooth, resolution free)
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
export function fbm(x: number, y: number, s = 0, oct = 3): number {
  let sum = 0, amp = 1, n = 0, f = 1;
  for (let o = 0; o < oct; o++) { sum += vnoise(x * f, y * f, s + o * 31) * amp; n += amp; amp *= 0.5; f *= 2.03; }
  return sum / n;
}

// ------------------------------------------------------------------ shapes (signed distance, units)
const withBB = (f: (x: number, y: number) => number, bb?: BB): SDF => { const g = f as SDF; if (bb) g.bb = bb; return g; };
/** a rounded rectangle, top-left (x, y), size w x h, corner radius r */
export const box = (x: number, y: number, w: number, h: number, r = 0): SDF => {
  const cx = x + w / 2, cy = y + h / 2, hw = w / 2, hh = h / 2, rr = Math.min(r, hw, hh);
  return withBB((px, py) => {
    const qx = Math.abs(px - cx) - hw + rr, qy = Math.abs(py - cy) - hh + rr;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
  }, [x, y, x + w, y + h]);
};
export const circle = (cx: number, cy: number, r: number): SDF => withBB((x, y) => Math.hypot(x - cx, y - cy) - r, [cx - r, cy - r, cx + r, cy + r]);
/** an ellipse (good-enough distance) */
export const ellipse = (cx: number, cy: number, rx: number, ry: number): SDF => withBB((x, y) => {
  const px = x - cx, py = y - cy;
  const k0 = Math.hypot(px / rx, py / ry), k1 = Math.hypot(px / (rx * rx), py / (ry * ry));
  if (k1 < 1e-9) return -Math.min(rx, ry);
  return (k0 * (k0 - 1)) / k1;
}, [cx - rx, cy - ry, cx + rx, cy + ry]);
export const ring = (cx: number, cy: number, r0: number, r1: number): SDF => withBB((x, y) => Math.abs(Math.hypot(x - cx, y - cy) - (r0 + r1) / 2) - (r1 - r0) / 2, [cx - r1, cy - r1, cx + r1, cy + r1]);
/** a capsule along a segment */
export const segment = (x0: number, y0: number, x1: number, y1: number, r: number): SDF => withBB((x, y) => {
  const dx = x1 - x0, dy = y1 - y0, t = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - x0 - dx * t, y - y0 - dy * t) - r;
}, [Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r]);
/** a polygon (exact distance) */
export function polygon(pts: [number, number][]): SDF {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const n = pts.length;
  return withBB((px, py) => {
    let d = (px - pts[0][0]) ** 2 + (py - pts[0][1]) ** 2, s = 1;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const ex = pts[j][0] - pts[i][0], ey = pts[j][1] - pts[i][1], wx = px - pts[i][0], wy = py - pts[i][1];
      const t = clamp((wx * ex + wy * ey) / (ex * ex + ey * ey || 1));
      const bx = wx - ex * t, by = wy - ey * t;
      d = Math.min(d, bx * bx + by * by);
      const c1 = py >= pts[i][1], c2 = py < pts[j][1], c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  }, [x0, y0, x1, y1]);
}
const bbU = (s: SDF[]): BB | undefined => s.some((f) => !f.bb) ? undefined : s.reduce((b, f) => [Math.min(b[0], f.bb![0]), Math.min(b[1], f.bb![1]), Math.max(b[2], f.bb![2]), Math.max(b[3], f.bb![3])] as BB, [Infinity, Infinity, -Infinity, -Infinity] as BB);
export const union = (...s: SDF[]): SDF => withBB((x, y) => { let d = Infinity; for (const f of s) d = Math.min(d, f(x, y)); return d; }, bbU(s));
export const inter = (...s: SDF[]): SDF => withBB((x, y) => { let d = -Infinity; for (const f of s) d = Math.max(d, f(x, y)); return d; }, s[0].bb);
export const subtract = (a: SDF, b: SDF): SDF => withBB((x, y) => Math.max(a(x, y), -b(x, y)), a.bb);
/** grow (r > 0) or shrink a shape */
export const offset = (a: SDF, r: number): SDF => withBB((x, y) => a(x, y) - r, a.bb && [a.bb[0] - r, a.bb[1] - r, a.bb[2] + r, a.bb[3] + r]);
export const smoothUnion = (a: SDF, b: SDF, k: number): SDF => withBB((x, y) => {
  const da = a(x, y), db = b(x, y), h = clamp(0.5 + 0.5 * (db - da) / k);
  return db + (da - db) * h - k * h * (1 - h);
}, bbU([a, b]));
/** wobble the outline by `amp` units of smooth noise (hand-made, organic edges) */
export const warp = (a: SDF, amp: number, freq = 0.08, seed = 1): SDF => withBB((x, y) => a(x, y) + (fbm(x * freq, y * freq, seed, 2) - 0.5) * 2 * amp, a.bb && [a.bb[0] - amp, a.bb[1] - amp, a.bb[2] + amp, a.bb[3] + amp]);
/** a torn / deckled paper edge: coarse wander plus fine fibrous teeth */
export const torn = (a: SDF, amp = 2, seed = 1): SDF => withBB((x, y) => a(x, y) + (fbm(x * 0.07, y * 0.07, seed, 2) - 0.5) * 2 * amp + (vnoise(x * 0.9, y * 0.9, seed + 7) - 0.5) * amp * 0.7, a.bb && [a.bb[0] - amp * 2, a.bb[1] - amp * 2, a.bb[2] + amp * 2, a.bb[3] + amp * 2]);
export const translate = (a: SDF, dx: number, dy: number): SDF => withBB((x, y) => a(x - dx, y - dy), a.bb && [a.bb[0] + dx, a.bb[1] + dy, a.bb[2] + dx, a.bb[3] + dy]);
/** rotate a shape by `ang` radians around (cx, cy) */
export const rotate = (a: SDF, ang: number, cx: number, cy: number): SDF => {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  let bb: BB | undefined;
  if (a.bb) { const r = Math.hypot(Math.max(Math.abs(a.bb[0] - cx), Math.abs(a.bb[2] - cx)), Math.max(Math.abs(a.bb[1] - cy), Math.abs(a.bb[3] - cy))); bb = [cx - r, cy - r, cx + r, cy + r]; }
  return withBB((x, y) => { const dx = x - cx, dy = y - cy; return a(cx + dx * c - dy * s, cy + dx * s + dy * c); }, bb);
};

// ------------------------------------------------------------------ height profiles
export const flat = (h = 0): HFn => () => h;
/** a rounded (quarter-round) bevel rising over `b` units from the edge to `h` */
export const bevel = (h: number, b: number, base = 0): HFn => (_x, _y, ins) => { const t = clamp(ins / b); return base + h * Math.sqrt(1 - (1 - t) * (1 - t)); };
/** a straight chamfer */
export const chamfer = (h: number, b: number, base = 0): HFn => (_x, _y, ins) => base + h * clamp(ins / b);
/** a soft cushion: rises slowly all the way to the middle (pillows, leather, buttons) */
export const pillow = (h: number, b: number, base = 0): HFn => (_x, _y, ins) => { const t = clamp(ins / b); return base + h * Math.pow(Math.sin(t * Math.PI / 2), 0.7); };
/** a dome over an ellipse */
export const dome = (cx: number, cy: number, rx: number, ry: number, h: number, base = 0): HFn => (x, y) => base + h * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2));
/** a torus-like rim profile across a band `w` wide (rings, bezels): `ins` measured from the band's outer edge */
export const rim = (h: number, w: number, base = 0): HFn => (_x, _y, ins) => { const t = clamp(ins / w) * 2 - 1; return base + h * Math.sqrt(Math.max(0, 1 - t * t)); };
/** a horizontal cylinder centred on cy with radius r */
export const tubeX = (cy: number, r: number, base = 0): HFn => (_x, y) => base + r * Math.sqrt(Math.max(0, 1 - ((y - cy) / r) ** 2));
export const tubeY = (cx: number, r: number, base = 0): HFn => (x) => base + r * Math.sqrt(Math.max(0, 1 - ((x - cx) / r) ** 2));
/**
 * A picture-frame moulding across a rail `t` units wide (ins from the outer edge): a rounded outer lip, a
 * shallow cove, a raised bead, then a drop to the opening.
 */
export const moulding = (h: number, t: number, base = 0): HFn => (_x, _y, ins) => {
  const u = clamp(ins / t);
  const lip = Math.sqrt(clamp(u / 0.22)) * 0.75;
  const cove = -0.22 * Math.sin(clamp((u - 0.28) / 0.34) * Math.PI);
  const bead = 0.32 * Math.sqrt(Math.max(0, 1 - ((u - 0.78) / 0.12) ** 2));
  const fall = u > 0.9 ? -(u - 0.9) / 0.1 * 0.5 : 0;
  return base + h * Math.max(0.05, lip + cove + bead + fall);
};

// ------------------------------------------------------------------ materials
export interface Material {
  /** albedo 0..255 at (x, y) units */
  alb: (x: number, y: number) => RGB;
  /** specular strength / tightness */
  spec?: number; shin?: number;
  /** varnish / enamel clear coat (a second, tighter highlight) */
  coat?: number;
  /** 0..1 metal: reflects the studio tinted by the albedo */
  metal?: number;
  /** cloth rim sheen */
  sheen?: number;
  /** self-lit (lamp glass, glow) */
  emit?: number;
  /** how much the light shapes it (0.6 = soft, 1 = full) */
  diffuse?: number;
}
const tmp = [0, 0, 0];
interface TexOpts { scale?: number; rot?: boolean; ox?: number; oy?: number }
/** sample a colour tile: `scale` texels per unit, `rot` swaps the grain direction */
export const texAlb = (n: TexName, o: TexOpts & { tint?: RGB; gain?: number } = {}) => {
  const sc = o.scale ?? 2, ox = o.ox ?? 0, oy = o.oy ?? 0, g = o.gain ?? 1, t = o.tint;
  return (x: number, y: number): RGB => {
    const u = (o.rot ? y : x) * sc + ox, v = (o.rot ? x : y) * sc + oy;
    sampleTex(n, u, v, tmp);
    return t ? [tmp[0] * t[0] / 255 * g, tmp[1] * t[1] / 255 * g, tmp[2] * t[2] / 255 * g] : [tmp[0] * g, tmp[1] * g, tmp[2] * g];
  };
};
/** a grey detail tile tinted to `col` (overlay): `amt` how strongly the detail shows */
export const detailAlb = (n: TexName, col: RGB, o: TexOpts & { amt?: number } = {}) => {
  const sc = o.scale ?? 2, ox = o.ox ?? 0, oy = o.oy ?? 0, amt = o.amt ?? 1;
  return (x: number, y: number): RGB => {
    const u = (o.rot ? y : x) * sc + ox, v = (o.rot ? x : y) * sc + oy;
    sampleTex(n, u, v, tmp);
    const m = 1 + ((tmp[0] - 128) / 128) * 0.7 * amt;
    return [col[0] * m, col[1] * m, col[2] * m];
  };
};
export const solidAlb = (c: RGB | string) => { const v = typeof c === 'string' ? hex(c) : c; return () => v; };

export type WoodName = 'walnut' | 'oak' | 'cherry' | 'ebony' | 'honey';
const WOOD_T: Record<WoodName, { tex: TexName; tint?: RGB; gain?: number }> = {
  walnut: { tex: 'walnut', tint: [206, 178, 160], gain: 0.92 },
  cherry: { tex: 'walnut', tint: [250, 220, 205], gain: 1.05 },
  ebony: { tex: 'walnut', tint: [140, 120, 112], gain: 0.72 },
  oak: { tex: 'oak' },
  honey: { tex: 'oak', tint: [255, 236, 200], gain: 1.06 },
};
/** varnished wood: grain along x (or y with `along: 'y'`) */
export function wood(kind: WoodName = 'walnut', o: { along?: 'x' | 'y'; scale?: number; ox?: number; oy?: number; varnish?: number } = {}): Material {
  const w = WOOD_T[kind];
  // walnut's tile grain runs along x, oak's along y
  const tileAlongX = w.tex === 'walnut';
  const rot = (o.along ?? 'x') === 'x' ? !tileAlongX : tileAlongX;
  const v = o.varnish ?? 1;
  return { alb: texAlb(w.tex, { scale: o.scale ?? 2.2, rot, ox: o.ox, oy: o.oy, tint: w.tint, gain: w.gain }), spec: 0.22 * v, shin: 18, coat: 0.32 * v };
}
export function leather(col?: RGB | string, o: TexOpts = {}): Material {
  const alb = col ? detailAlb('pebble', typeof col === 'string' ? hex(col) : col, { scale: o.scale ?? 3, amt: 0.75, ox: o.ox, oy: o.oy }) : texAlb('leather', { scale: o.scale ?? 2.4, ox: o.ox, oy: o.oy });
  return { alb, spec: 0.28, shin: 14, coat: 0.08 };
}
export const cloth = (n: 'bookcloth' | 'linen' | 'velvet' | 'felt', col: RGB | string, o: TexOpts & { amt?: number } = {}): Material => ({
  alb: detailAlb(n, typeof col === 'string' ? hex(col) : col, { scale: o.scale ?? 2, amt: o.amt ?? (n === 'velvet' ? 0.5 : 0.7), ox: o.ox, oy: o.oy, rot: o.rot }),
  spec: n === 'velvet' ? 0.04 : 0.05, shin: 6, sheen: n === 'velvet' ? 0.5 : n === 'felt' ? 0.18 : 0.1, diffuse: 0.9,
});
export const paperMat = (kind: 'paper' | 'kraft' = 'paper', o: TexOpts & { tint?: RGB } = {}): Material => ({ alb: texAlb(kind, { scale: o.scale ?? 1.6, ox: o.ox, oy: o.oy, tint: o.tint }), spec: 0.03, shin: 5, diffuse: 0.75 });
export const corkMat = (o: TexOpts = {}): Material => ({ alb: texAlb('cork', { scale: o.scale ?? 1.6, ox: o.ox, oy: o.oy }), spec: 0.04, shin: 4 });

export const GOLD: RGB = [226, 172, 74];
export const BRASS_OLD: RGB = [196, 150, 72];
export const SILVER: RGB = [200, 204, 210];
export const COPPER: RGB = [214, 128, 84];
export const IRON: RGB = [92, 96, 104];
/** polished / brushed metal tinted `col` (along x or y), with optional patina in the hollows */
export function metal(col: RGB = GOLD, o: { along?: 'x' | 'y'; polish?: number; scale?: number } = {}): Material {
  const pol = o.polish ?? 0.7;
  const det = detailAlb('brushed', col, { scale: o.scale ?? 1.2, rot: o.along === 'y', amt: 0.5 * (1 - pol * 0.6) });
  return { alb: det, metal: 0.9, spec: 0.9, shin: 30 + pol * 50, coat: 0.2 * pol };
}
export const enamel = (col: RGB | string, o: { gloss?: number } = {}): Material => ({ alb: solidAlb(col), spec: 0.5, shin: 40, coat: 0.85 * (o.gloss ?? 1) });
export const glass = (col: RGB | string, o: { metal?: number } = {}): Material => ({ alb: solidAlb(col), spec: 1, shin: 90, coat: 1, metal: o.metal ?? 0.35 });
export const glow = (col: RGB | string | ((x: number, y: number) => RGB)): Material => ({ alb: typeof col === 'function' ? col : solidAlb(col), emit: 1 });
export const matte = (col: RGB | string | ((x: number, y: number) => RGB), o: Partial<Material> = {}): Material => ({ alb: typeof col === 'function' ? col : solidAlb(col), spec: 0.08, shin: 8, ...o });

// ------------------------------------------------------------------ lighting
const norm3 = (v: number[]) => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
const L = norm3([-0.48, -0.62, 0.62]);
const HV = norm3([L[0], L[1], L[2] + 1]);
// [ui7] matched to the 3D's reference light (src/gfx/cel.ts CEL_REF): a warm key (#ffe2bc) from the upper left,
// light falling off in three softened steps (lit, a warm half-tone, shadow), the shadow side pushed towards
// violet-blue (#5a4fa0) with its local colour kept rich, a thin cool rim on the shadow-side silhouette, and
// small crisp glints on hard materials only.
const WARM: RGB = [1.08, 0.99, 0.86];
const COOL: RGB = [0.78, 0.77, 1.06];
const HALF: RGB = [1.04, 0.98, 0.93];
/** three softened light steps (lit 1, half-tone 0.5, shadow 0), a little of the real gradient kept inside each */
function steps(f: number): number {
  const sm = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const banded = 0.5 * sm(0.22, 0.32, f) + 0.5 * sm(0.62, 0.74, f) + Math.max(0, f - 1) * 0.35;
  return banded * 0.65 + f * 0.35;
}
/** the soft studio metal and glass mirror: bright overhead window up-left, warm floor, a dark horizon band */
function envAt(rx: number, ry: number): number {
  const up = -ry;
  let e = 0.62 + 0.42 * up - 0.1 * rx;
  e -= 0.5 * Math.exp(-(((up + 0.18) / 0.2) ** 2));
  e += 0.75 * Math.exp(-(((rx + 0.35) ** 2) / 0.05 + ((up - 0.55) ** 2) / 0.03));
  return clamp(e, 0.1, 1.6);
}

/** device px per CSS px to paint at (DPR, capped) */
export const deviceK = (cap = 3) => { const d = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1; return Math.min(cap, Math.max(1, Math.round(d * 2) / 2)); };

export interface PartOpts {
  /** add the height to what's there (carvings, embossing) */
  add?: boolean;
  /** only where something is already painted */
  onTop?: boolean;
}
export interface Shadow { dx?: number; dy?: number; blur?: number; a?: number; color?: string }
export interface RenderOpts {
  /** cast shadow under the whole object (units) */
  shadow?: Shadow | false;
  /** a second, tight contact shadow */
  contact?: Shadow | false;
  /** ambient level 0..1 */
  ambient?: number;
  /** ambient occlusion radius (units) and strength */
  aoR?: number; ao?: number;
  /** light strength */
  light?: number;
}

/**
 * A painting surface `w` x `h` units (CSS px) with `pad` units of margin all round for shadows; `k` device px
 * per unit. Unit coordinates run from (0, 0) at the top-left of the object area (the margin is outside).
 */
export class Real {
  readonly k: number; readonly pad: number;
  readonly W: number; readonly H: number;
  readonly hgt: Float32Array; readonly alb: Float32Array; readonly cov: Float32Array; readonly mi: Uint8Array;
  readonly mats: Material[] = [];
  constructor(readonly w: number, readonly h: number, k = deviceK(), pad = 0) {
    this.k = k; this.pad = pad;
    this.W = Math.ceil((w + pad * 2) * k); this.H = Math.ceil((h + pad * 2) * k);
    const n = this.W * this.H;
    this.hgt = new Float32Array(n); this.alb = new Float32Array(n * 3); this.cov = new Float32Array(n); this.mi = new Uint8Array(n);
  }
  private range(s: SDF, grow = 1): [number, number, number, number] {
    const { k, pad, W, H } = this, b = s.bb;
    if (!b) return [0, 0, W, H];
    return [Math.max(0, Math.floor((b[0] + pad - grow) * k)), Math.max(0, Math.floor((b[1] + pad - grow) * k)), Math.min(W, Math.ceil((b[2] + pad + grow) * k)), Math.min(H, Math.ceil((b[3] + pad + grow) * k))];
  }
  private matIndex(m: Material) { let i = this.mats.indexOf(m); if (i < 0) { this.mats.push(m); i = this.mats.length - 1; } return i; }
  /** Paint a part: shape, height (a number = flat top at that height), material. */
  part(s: SDF, h: HFn | number, m: Material, o: PartOpts = {}) {
    const hf = typeof h === 'number' ? flat(h) : h;
    const mi = this.matIndex(m), { k, pad, W } = this, [x0, y0, x1, y1] = this.range(s);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const x = (px + 0.5) / k - pad, y = (py + 0.5) / k - pad;
      const d = s(x, y);
      let c = clamp(0.5 - d * k);
      if (c <= 0) continue;
      const i = py * W + px, old = this.cov[i];
      if (o.onTop) { c *= old; if (c <= 0) continue; }
      const hv = hf(x, y, Math.max(0, -d));
      if (Number.isNaN(hv)) continue;
      const a = m.alb(x, y);
      if (o.add) {
        this.hgt[i] += hv * c;
        if (c >= 0.5) this.mi[i] = mi;
        const j = i * 3;
        this.alb[j] += (a[0] - this.alb[j]) * c; this.alb[j + 1] += (a[1] - this.alb[j + 1]) * c; this.alb[j + 2] += (a[2] - this.alb[j + 2]) * c;
        continue;
      }
      const j = i * 3;
      if (old <= 0) {
        this.hgt[i] = hv; this.alb[j] = a[0]; this.alb[j + 1] = a[1]; this.alb[j + 2] = a[2]; this.mi[i] = mi;
      } else {
        this.hgt[i] += (hv - this.hgt[i]) * c;
        this.alb[j] += (a[0] - this.alb[j]) * c; this.alb[j + 1] += (a[1] - this.alb[j + 1]) * c; this.alb[j + 2] += (a[2] - this.alb[j + 2]) * c;
        if (c >= 0.5) this.mi[i] = mi;
      }
      this.cov[i] = old + c * (1 - old);
    }
    return this;
  }
  /** Lower (or raise, depth < 0) the surface inside a shape with a soft rounded profile `w` units wide: engraving. */
  carve(s: SDF, depth: number, w = 1) {
    const { k, pad, W } = this, [x0, y0, x1, y1] = this.range(s, w);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const i = py * W + px;
      if (this.cov[i] <= 0) continue;
      const x = (px + 0.5) / k - pad, y = (py + 0.5) / k - pad, d = s(x, y);
      if (d >= 0.5 / k) continue;
      const t = clamp((-d + 0.5 / k) / w);
      this.hgt[i] -= depth * Math.sin(t * Math.PI / 2);
    }
    return this;
  }
  /** Recolour (and optionally re-material) what's painted inside a shape, keeping its height. */
  paint(s: SDF, m: Material, alpha = 1) {
    const mi = this.matIndex(m), { k, pad, W } = this, [x0, y0, x1, y1] = this.range(s);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const i = py * W + px;
      if (this.cov[i] <= 0) continue;
      const x = (px + 0.5) / k - pad, y = (py + 0.5) / k - pad;
      const c = clamp(0.5 - s(x, y) * k) * alpha;
      if (c <= 0) continue;
      const a = m.alb(x, y), j = i * 3;
      this.alb[j] += (a[0] - this.alb[j]) * c; this.alb[j + 1] += (a[1] - this.alb[j + 1]) * c; this.alb[j + 2] += (a[2] - this.alb[j + 2]) * c;
      if (c >= 0.5) this.mi[i] = mi;
    }
    return this;
  }
  /** Erase inside a shape (anti-aliased). */
  cut(s: SDF) {
    const { k, pad, W } = this, [x0, y0, x1, y1] = this.range(s);
    for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
      const i = py * W + px;
      if (this.cov[i] <= 0) continue;
      const x = (px + 0.5) / k - pad, y = (py + 0.5) / k - pad;
      const c = clamp(0.5 - s(x, y) * k);
      if (c > 0) this.cov[i] *= 1 - c;
    }
    return this;
  }

  /** Light the stack; returns RGBA (W x H). */
  pixels(o: RenderOpts = {}): Uint8ClampedArray {
    const { W, H, k } = this, n = W * H;
    const out = new Uint8ClampedArray(n * 4);
    const amb = o.ambient ?? 0.42, kl = o.light ?? 1;
    // ambient occlusion: how far the blurred surroundings stand above each point
    const aoR = Math.max(1, Math.round((o.aoR ?? 5) * k)), aoK = (o.ao ?? 1) * 0.16;
    const hb = boxBlur(boxBlur(this.hgt, W, H, aoR), W, H, aoR);
    const sk = k / 2; // central differences span 2 px = 2/k units
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, c = this.cov[i];
      if (c <= 0.002) continue;
      const m = this.mats[this.mi[i]] ?? this.mats[0];
      const j = i * 3, o4 = i * 4;
      let r = this.alb[j], g = this.alb[j + 1], b = this.alb[j + 2];
      if (!m.emit) {
        const hc = this.hgt[i];
        const hl = x > 0 && this.cov[i - 1] > 0 ? this.hgt[i - 1] : hc, hr = x < W - 1 && this.cov[i + 1] > 0 ? this.hgt[i + 1] : hc;
        const hu = y > 0 && this.cov[i - W] > 0 ? this.hgt[i - W] : hc, hd = y < H - 1 && this.cov[i + W] > 0 ? this.hgt[i + W] : hc;
        let nx = -(hr - hl) * sk, ny = -(hd - hu) * sk, nz = 1;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const ao = 1 - clamp((hb[i] - hc) * aoK, 0, 0.6);
        const ndl = nx * L[0] + ny * L[1] + nz * L[2];
        const dif = m.diffuse ?? 1;
        const lit = steps(Math.max(0, ndl) / L[2]);
        const kd = (1 - amb) * kl * (1 + (lit - 1) * dif) * ao, ka = amb * (0.75 + 0.25 * ao) * (0.92 + 0.08 * -ny);
        // the half-tone at the turning edge is a touch warmer
        const ht = lit > 0.3 && lit < 0.8 ? 1 : 0;
        let rr = r * (COOL[0] * ka + (ht ? HALF[0] : WARM[0]) * kd), gg = g * (COOL[1] * ka + (ht ? HALF[1] : WARM[1]) * kd), bb = b * (COOL[2] * ka + (ht ? HALF[2] : WARM[2]) * kd);
        // a thin cool rim where the form turns away on the shadow side
        const rim = Math.pow(1 - nz, 2.2) * clamp(nx * 0.6 + ny * 0.8) * 0.55;
        if (rim > 0.002) { rr += (r * 0.25 + 46) * rim; gg += (g * 0.25 + 52) * rim; bb += (b * 0.25 + 80) * rim; }
        if (m.metal) {
          const rx = 2 * nz * nx, ry = 2 * nz * ny;
          const e = envAt(rx, ry) * (0.6 + 0.4 * ao);
          const mk = m.metal;
          rr = rr * (1 - mk) + r * e * 1.02 * mk; gg = gg * (1 - mk) + g * e * mk; bb = bb * (1 - mk) + b * e * 0.94 * mk;
        }
        if (m.sheen) {
          const sh = Math.pow(1 - nz, 1.4) * m.sheen * (0.5 + 0.5 * clamp(-ny - nx * 0.4 + 0.4));
          rr += (r * 0.7 + 70) * sh; gg += (g * 0.7 + 66) * sh; bb += (b * 0.7 + 74) * sh;
        }
        const ndh = Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]);
        if (m.spec) {
          const s0 = Math.pow(ndh, m.shin ?? 20) * m.spec * ao;
          // hard materials get a small, crisp glint (a bright core with a soft rim); soft ones keep a gentle sheen
          const s = m.metal || (m.coat ?? 0) > 0.3 ? s0 * 0.45 + clamp((s0 - 0.25) * 3) * 0.55 * m.spec : s0;
          const tint = m.metal ? 0.6 : 0.08;
          rr += (255 * (1 - tint) + r * tint * 1.3) * s; gg += (250 * (1 - tint) + g * tint * 1.3) * s; bb += (236 * (1 - tint) + b * tint * 1.1) * s;
        }
        if (m.coat) {
          const s = Math.pow(ndh, 140) * m.coat * ao;
          rr += 255 * s; gg += 250 * s; bb += 240 * s;
        }
        r = rr; g = gg; b = bb;
      }
      out[o4] = r; out[o4 + 1] = g; out[o4 + 2] = b; out[o4 + 3] = c * 255;
    }
    return out;
  }
  /** Render to a canvas (W x H device px), with the cast shadow under it. */
  canvas(o: RenderOpts = {}): HTMLCanvasElement {
    const { W, H, k } = this;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const img = new ImageData(this.pixels(o) as Uint8ClampedArray<ArrayBuffer>, W, H);
    const sh = o.shadow === undefined ? { dy: 2, blur: 4, a: 0.38 } : o.shadow;
    const ct = o.contact === undefined ? false : o.contact;
    if (!sh && !ct) { g.putImageData(img, 0, 0); return c; }
    const t = document.createElement('canvas');
    t.width = W; t.height = H;
    t.getContext('2d')!.putImageData(img, 0, 0);
    for (const s of [sh, ct]) {
      if (!s) continue;
      g.save();
      g.shadowColor = s.color ?? `rgba(30, 20, 46, ${s.a ?? 0.38})`; // cool violet-brown cast shadows
      g.shadowBlur = (s.blur ?? 4) * k;
      g.shadowOffsetX = (s.dx ?? 0) * k + W * 4; g.shadowOffsetY = (s.dy ?? 2) * k;
      g.drawImage(t, -W * 4, 0); // only the shadow lands on the canvas
      g.restore();
    }
    g.drawImage(t, 0, 0);
    return c;
  }
  url(o: RenderOpts = {}) { return toURL(this.canvas(o)); }
}

/** separable box blur of a W x H float field (radius r px) */
export function boxBlur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  const tmpA = new Float32Array(src.length), out = new Float32Array(src.length), n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    const row = y * W;
    for (let x = -r; x <= r; x++) acc += src[row + clampI(x, W)];
    for (let x = 0; x < W; x++) {
      tmpA[row + x] = acc / n;
      acc += src[row + clampI(x + r + 1, W)] - src[row + clampI(x - r, W)];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmpA[clampI(y, H) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = acc / n;
      acc += tmpA[clampI(y + r + 1, H) * W + x] - tmpA[clampI(y - r, H) * W + x];
    }
  }
  return out;
}
const clampI = (v: number, n: number) => (v < 0 ? 0 : v >= n ? n - 1 : v);

let webpOK: boolean | null = null;
/** a compact data URL (WebP where the browser can encode it, else PNG) */
export function toURL(c: HTMLCanvasElement, q = 0.92): string {
  if (webpOK === null) { try { webpOK = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); } catch { webpOK = false; } }
  return webpOK ? c.toDataURL('image/webp', q) : c.toDataURL('image/png');
}

const CACHE = new Map<string, string>();
/** paint once per key (and per device scale) */
export function cached(key: string, make: () => string): string {
  const kk = key + '@' + deviceK();
  let v = CACHE.get(kk);
  if (v === undefined) { v = make(); if (texReady.peek()) CACHE.set(kk, v); }
  return v;
}
