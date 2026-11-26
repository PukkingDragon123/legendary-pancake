// [clock12] The game's cuckoo clock, painted in Canvas 2D at any resolution: one design shared by the loading screen
// (#boot in index.html: tools/bootart.mjs inlines this module, minified, so the clock and the real time show before
// the app's bundle loads), the office's wall clock (wallclock.ts paints its textures from it), the shelf's Clock button
// (src/dev/iconbake.ts bakes its sprites from it) and, as a 3D model, the big Clock screen (world/stages/cuckoo.ts
// follows the same plan, see PLAN_M).
//
// A believable Black Forest chalet clock in carved walnut: a shingled gable roof with a plain scalloped bargeboard, a
// carved owl crest between two big oak leaves, an arched door over a little balcony (Pip lives behind it), a square
// walnut case with a raised frame, four big carved oak leaves and four acorns round a clean enamel dial (Roman
// numerals, a minute track, blued spade hands), a scalloped apron, a carved oak-leaf pendulum and two cast pine-cone
// weights on brass chains. Painted like an illustration: warm key light from the top left, real wood grain, soft
// bevels, cast shadows, rich saturated colour, and a bold near-black outline round the silhouette and every main part.
//
// Coordinates are art units (u): x right, y down, the clock's centre line at x = CX; 1 u = 1/140 m on the 3D clocks.
// A caller sets the canvas transform (px per u) and calls a paint function; every function draws in art units.

/** the centre line */
export const CX = 88;
/** metres per art unit on the 3D clocks */
export const U_M = 1 / 140;
/** The plan (art units). */
export const G = {
  W: 176,
  /** the case painting's height (crest top to the apron) and the whole stage (down to the lowest weight) */
  H: 248, SH: 352,
  ridge: 51, slope: 0.775, eave: 80, band: 9, barge: 9,
  gable: { hw: 54, y: 100, top: 58 },
  corn: { hw: 61, y0: 99, y1: 105 },
  box: { hw: 56, y0: 105, y1: 220 },
  base: { hw: 61, y0: 220, y1: 227 },
  apron: { hw: 57, y0: 227, y1: 245 },
  dial: { y: 160, r: 35, bez: 38.6, board: 41 },
  door: { hw: 9.8, top: 73.4, sill: 98.6 },
  bal: { hw: 34, y: 98.6, rail: 91 },
  owl: 26.6,
  pivot: { y: 225 }, pendLen: 70,
  /** chain centre x offsets: the weights, the rings */
  wx: 21.7, rx: 32.5,
  /** the weights' loops: wound (top) and run down (bottom); the rings' centres run the other way */
  wTop: 246.6, wBot: 309.6, rTop: 251.6, rBot: 314.6,
  chainTop: 233,
} as const;
/** how far the weights travel (u) */
export const TRAVEL = G.wBot - G.wTop;
/** the 3D plan (metres, y up from the case's bottom, z out of the wall) the Clock screen's model follows */
export const PLAN_M = { CW: 0.8, CH: 0.82, dialY: 0.43, dialR: 0.25, ridge: 1.205, tan: 0.775, eave: 0.57, gableY: 0.855, door: { w: 0.14, h: 0.18, y: 0.867 }, bal: { y: 0.855, w: 0.48 } };

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];
const INK = '#140c10';
// ramps: [deep, shadow, mid, light, highlight]
const WAL = ['#2a0f08', '#4d1f10', '#7a3518', '#a8582a', '#d6874a'];
const HON = ['#4a1e04', '#8c4612', '#c8742a', '#eca44c', '#ffd88a'];
const ROOFC = ['#220c08', '#46190e', '#702a14', '#9c4422', '#c86e3a'];
const BRASS = ['#3a2206', '#86581a', '#d29c34', '#f4d27a', '#fffbe2'];

// ------------------------------------------------------------------ canvases, paths, noise

/** a canvas of w x h px */
export function mk(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
const ctx2 = (c: HTMLCanvasElement) => c.getContext('2d')!;
/** px per art unit of a context */
const pxu = (g: Ctx) => Math.hypot(g.getTransform().a, g.getTransform().b) || 1;

/** A Path2D that remembers its bounding box. */
class Sh {
  p = new Path2D(); x0 = 1e9; y0 = 1e9; x1 = -1e9; y1 = -1e9;
  private b(x: number, y: number) { if (x < this.x0) this.x0 = x; if (x > this.x1) this.x1 = x; if (y < this.y0) this.y0 = y; if (y > this.y1) this.y1 = y; }
  m(x: number, y: number) { this.p.moveTo(x, y); this.b(x, y); return this; }
  l(x: number, y: number) { this.p.lineTo(x, y); this.b(x, y); return this; }
  q(cx: number, cy: number, x: number, y: number) { this.p.quadraticCurveTo(cx, cy, x, y); this.b(cx, cy); this.b(x, y); return this; }
  c(ax: number, ay: number, bx: number, by: number, x: number, y: number) { this.p.bezierCurveTo(ax, ay, bx, by, x, y); this.b(ax, ay); this.b(bx, by); this.b(x, y); return this; }
  arc(x: number, y: number, r: number, a0 = 0, a1 = Math.PI * 2, ccw = false) { this.p.arc(x, y, r, a0, a1, ccw); this.b(x - r, y - r); this.b(x + r, y + r); return this; }
  ell(x: number, y: number, rx: number, ry: number, rot = 0) { this.p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); const r = Math.max(rx, ry); this.b(x - r, y - r); this.b(x + r, y + r); return this; }
  rect(x: number, y: number, w: number, h: number) { this.p.rect(x, y, w, h); this.b(x, y); this.b(x + w, y + h); return this; }
  z() { this.p.closePath(); return this; }
  poly(pts: Pt[]) { pts.forEach(([x, y], i) => (i ? this.l(x, y) : this.m(x, y))); return this.z(); }
  /** a closed smooth curve through the midpoints of `pts` */
  smooth(pts: Pt[]) {
    const n = pts.length, mid = (i: number): Pt => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
    const s = mid(0); this.m(s[0], s[1]);
    for (let i = 1; i <= n; i++) { const m = mid(i); this.q(pts[i % n][0], pts[i % n][1], m[0], m[1]); }
    return this.z();
  }
  get w() { return this.x1 - this.x0; }
  get h() { return this.y1 - this.y0; }
}
const sh = () => new Sh();
/** rotate/scale/move local points (base at the origin, along +x) into place */
const xf = (pts: Pt[], x: number, y: number, a: number, s = 1): Pt[] => { const c = Math.cos(a) * s, n = Math.sin(a) * s; return pts.map(([u, v]) => [x + u * c - v * n, y + u * n + v * c]); };

const hash = (x: number, y: number, s: number) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** value noise that tiles with period (px, py) */
function pn(x: number, y: number, px: number, py: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const H = (i: number, j: number) => hash(((i % px) + px) % px, ((j % py) + py) % py, s);
  const a = H(xi, yi), b = H(xi + 1, yi), c = H(xi, yi + 1), d = H(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
let rs = 7;
const rnd = () => { rs = (Math.imul(rs, 1664525) + 1013904223) | 0; return (rs >>> 0) / 4294967296; };

// ------------------------------------------------------------------ the wood grain (a tiling multiply texture)

let grainC: HTMLCanvasElement | null = null;
/** Straight-grained walnut: dark late-wood lines that wander, open pores, a soft figure (128 x 512, grain along y). */
function grainTile(): HTMLCanvasElement {
  if (grainC) return grainC;
  const W = 128, H = 512, c = mk(W, H), g = ctx2(c), im = g.createImageData(W, H), d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const warp = pn(u * 4, v * 3, 4, 3, 1) * 1.6 + pn(u * 8, v * 12, 8, 12, 2) * 0.35;
    const r = u * 11 + warp, f = r - Math.floor(r);
    const line = Math.max(0, 1 - Math.abs(f - 0.82) / 0.13) * (0.55 + 0.45 * pn(u * 22, v * 6, 22, 6, 3));
    const fine = Math.max(0, 1 - Math.abs(((u * 37 + warp * 2) % 1) - 0.5) / 0.08) * 0.25;
    const fig = pn(u * 3, v * 10, 3, 10, 4);
    const pore = hash(x, y >> 1, 5) > 0.93 ? 0.22 : 0;
    const val = 1 - line * 0.5 - fine * 0.3 - fig * 0.16 - pore;
    const i = (y * W + x) * 4;
    d[i] = Math.round(255 * Math.min(1, val + 0.04)); d[i + 1] = Math.round(255 * val); d[i + 2] = Math.round(255 * Math.max(0, val - 0.05)); d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return (grainC = c);
}

// ------------------------------------------------------------------ painting a part

interface Mat { pal: string[]; grain?: number; dir?: number; scale?: number; rim?: number; ink?: number; cast?: number; gloss?: number }
/** a linear light across a shape: highlight at the top left, shadow at the bottom right */
function lightGrad(g: Ctx, s: Sh, pal: string[], k = 1) {
  const gr = g.createLinearGradient(s.x0 + s.w * 0.15, s.y0, s.x0 + s.w * 0.85 * k, s.y1);
  gr.addColorStop(0, pal[3]); gr.addColorStop(0.45, pal[2]); gr.addColorStop(1, pal[1]);
  return gr;
}
/** drop the shape's cast shadow onto what is below it (down and right) */
function cast(g: Ctx, s: Sh, d: number, a = 0.45) {
  const k = pxu(g);
  g.save();
  g.shadowColor = `rgba(24,6,0,${a})`; g.shadowBlur = d * 1.6 * k; g.shadowOffsetX = d * 0.7 * k + 4000; g.shadowOffsetY = d * k;
  g.translate(-4000 / k, 0);
  g.fillStyle = '#000'; g.fill(s.p);
  g.restore();
}
/** soft bevels inside the shape: a lit edge at the top left, a dark one at the bottom right */
function rim(g: Ctx, s: Sh, w: number, a = 1) {
  g.save();
  g.clip(s.p);
  for (const [lw, al] of [[w * 2.2, 0.3], [w, 0.5]]) {
    const gr = g.createLinearGradient(s.x0, s.y0, s.x1, s.y1);
    gr.addColorStop(0, `rgba(255,240,200,${al * a})`); gr.addColorStop(0.42, 'rgba(255,240,200,0)');
    gr.addColorStop(0.58, 'rgba(30,8,0,0)'); gr.addColorStop(1, `rgba(30,8,0,${al * 1.2 * a})`);
    g.strokeStyle = gr; g.lineWidth = lw; g.lineJoin = 'round';
    g.stroke(s.p);
  }
  g.restore();
}
/** grain multiplied over the shape (dir: radians from vertical) */
function grain(g: Ctx, s: Sh, a: number, dir = 0, scale = 0.42) {
  const pat = g.createPattern(grainTile(), 'repeat');
  if (!pat) return;
  const m = new DOMMatrix().translateSelf(rnd() * 300, rnd() * 300).rotateSelf((dir * 180) / Math.PI).scaleSelf(scale, scale);
  pat.setTransform(m);
  g.save();
  g.clip(s.p);
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = a;
  g.fillStyle = pat;
  g.fillRect(s.x0 - 2, s.y0 - 2, s.w + 4, s.h + 4);
  // the figure catches the light: the same grain lifts the lighter wood a little
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = a * 0.35;
  g.fillRect(s.x0 - 2, s.y0 - 2, s.w + 4, s.h + 4);
  g.restore();
}
function inkLine(g: Ctx, s: Sh, w: number) {
  g.save(); g.strokeStyle = INK; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(s.p); g.restore();
}
/** paint one part: cast shadow, lit fill, grain, bevels, outline */
function part(g: Ctx, s: Sh, m: Mat, fill?: string | CanvasGradient) {
  if (m.cast) cast(g, s, m.cast);
  g.fillStyle = fill ?? lightGrad(g, s, m.pal);
  g.fill(s.p);
  if (m.grain) grain(g, s, m.grain, m.dir ?? 0, m.scale);
  if (m.gloss) { g.save(); g.clip(s.p); const gr = g.createLinearGradient(s.x0, s.y0, s.x0 + s.w * 0.5, s.y0 + s.h * 0.6); gr.addColorStop(0, `rgba(255,250,230,${m.gloss})`); gr.addColorStop(1, 'rgba(255,250,230,0)'); g.fillStyle = gr; g.fill(s.p); g.restore(); }
  if (m.rim !== 0) rim(g, s, m.rim ?? 0.9);
  if (m.ink !== 0) inkLine(g, s, m.ink ?? 0.75);
}
const wal = (o: Partial<Mat> = {}): Mat => ({ pal: WAL, grain: 0.85, ...o });
const hon = (o: Partial<Mat> = {}): Mat => ({ pal: HON, grain: 0.45, ...o });

// ------------------------------------------------------------------ carved pieces

/** an oak leaf (local: base at the origin, tip at (len, 0)): round lobes with deep sinuses, a round tip */
const LOBES = 3.5;
function leafPts(len: number, wid: number, seed = 1): Pt[] {
  const top: Pt[] = [], bot: Pt[] = [], N = 56;
  for (let i = 1; i < N; i++) {
    const t = i / N, env = Math.sin(Math.PI * Math.pow(t, 0.72)) * (wid / 2);
    for (const [arr, ph] of [[top, 0], [bot, 0.18]] as [Pt[], number][]) {
      const lobe = 0.5 + 0.5 * Math.pow(Math.abs(Math.sin(Math.PI * (LOBES * t + ph))), 0.55);
      const jig = 1 + (hash(Math.floor(LOBES * t + ph), seed + (arr === top ? 0 : 7), 9) - 0.5) * 0.18;
      arr.push([t * len, (arr === top ? -1 : 1) * Math.max(0.3, env * lobe * jig)]);
    }
  }
  return [[-len * 0.03, 0], ...bot, [len * 1.01, 0], ...top.reverse()];
}
/** where the lobes peak along the leaf (0..1), for the veins */
const lobeTs = (ph: number) => Array.from({ length: 4 }, (_, k) => (k + 0.5 - ph) / LOBES).filter((t) => t > 0.08 && t < 0.92);
/** a carved oak leaf in honey walnut: two lit halves, a raised midrib, veins to the lobes, a cast shadow */
function leaf(g: Ctx, x: number, y: number, a: number, len: number, wid: number, o: { seed?: number; curl?: number; pal?: string[]; castD?: number } = {}) {
  const pal = o.pal ?? HON, seed = o.seed ?? 1;
  const pts = leafPts(len, wid, seed);
  const curl = o.curl ?? 0.12;
  const bent: Pt[] = pts.map(([u, v]) => [u, v + Math.sin((u / len) * Math.PI) * len * curl * 0.3]);
  const P = xf(bent, x, y, a), s = sh().poly(P);
  cast(g, s, o.castD ?? 1.3, 0.55);
  // the two halves: the one facing the light is brighter
  const nx = -Math.sin(a), ny = Math.cos(a), litBelow = nx * -0.6 + ny * -0.8 < 0;
  g.save(); g.clip(s.p);
  g.fillStyle = lightGrad(g, s, pal); g.fill(s.p);
  const mid = xf(Array.from({ length: 9 }, (_, i): Pt => { const u = (i / 8) * len; return [u, Math.sin((u / len) * Math.PI) * len * curl * 0.3]; }), x, y, a);
  const half = sh().m(P[0][0], P[0][1]);
  for (const [px, py] of mid) half.l(px, py);
  half.l(mid[mid.length - 1][0] + nx * wid, mid[mid.length - 1][1] + ny * wid).l(x + nx * wid, y + ny * wid).z();
  g.fillStyle = litBelow ? 'rgba(255,214,140,0.16)' : 'rgba(60,14,0,0.3)';
  g.fill(half.p);
  // veins from the midrib to each lobe
  g.lineCap = 'round';
  for (const sd of [-1, 1]) for (const t of lobeTs(sd < 0 ? 0 : 0.18)) {
    const bow = Math.sin((t * len / len) * Math.PI) * len * curl * 0.3;
    const v = xf([[t * len - len * 0.1, bow], [t * len, sd * wid * 0.36 * Math.sin(Math.PI * Math.pow(t, 0.72)) + bow]], x, y, a);
    g.strokeStyle = 'rgba(60,20,0,0.5)'; g.lineWidth = len * 0.02;
    g.beginPath(); g.moveTo(v[0][0], v[0][1]); g.lineTo(v[1][0], v[1][1]); g.stroke();
  }
  // the midrib: a groove with a lit ridge, thinning toward the tip
  const rib = (dx: number, dy: number, col: string, w: number) => {
    const p = xf([[0, 0], [len * 0.5, len * curl * 0.3], [len * 0.92, 0]], x, y, a);
    g.strokeStyle = col; g.lineWidth = w;
    g.beginPath(); g.moveTo(p[0][0] + dx, p[0][1] + dy); g.quadraticCurveTo(p[1][0] + dx, p[1][1] + dy, p[2][0] + dx, p[2][1] + dy); g.stroke();
  };
  rib(0.2, 0.25, 'rgba(60,18,0,0.55)', len * 0.04);
  rib(-0.15, -0.2, 'rgba(255,236,190,0.4)', len * 0.016);
  g.restore();
  rim(g, s, len * 0.04);
  inkLine(g, s, 0.75);
}
/** a carved acorn hanging from (x, y) at angle a (0 = straight down) */
function acorn(g: Ctx, x: number, y: number, a: number, s = 1) {
  const L = 9 * s, R = 3.1 * s;
  const at = (u: number, v: number): Pt => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];
  const nut = sh().smooth([at(-R, 2.6 * s), at(-R * 1.05, 5.4 * s), at(-R * 0.6, 8.2 * s), at(0, L), at(R * 0.6, 8.2 * s), at(R * 1.05, 5.4 * s), at(R, 2.6 * s)]);
  cast(g, nut, 1.1, 0.5);
  const [cx, cy] = at(-R * 0.45, 5);
  const gr = g.createRadialGradient(cx, cy, 0.3, cx, cy, L * 0.8);
  gr.addColorStop(0, '#ffe6a8'); gr.addColorStop(0.25, HON[3]); gr.addColorStop(0.7, HON[2]); gr.addColorStop(1, HON[1]);
  g.fillStyle = gr; g.fill(nut.p); inkLine(g, nut, 0.65);
  const cup = sh().smooth([at(-R * 1.25, 0.6 * s), at(-R * 1.3, 2.6 * s), at(-R * 0.9, 3.8 * s), at(0, 3.4 * s), at(R * 0.9, 3.8 * s), at(R * 1.3, 2.6 * s), at(R * 1.25, 0.6 * s), at(0, -0.6 * s)]);
  part(g, cup, { pal: WAL, grain: 0, rim: 0.6, ink: 0.65 });
  g.save(); g.clip(cup.p); g.strokeStyle = 'rgba(30,8,0,0.45)'; g.lineWidth = 0.35 * s;
  for (let i = -3; i <= 3; i++) { const [p0x, p0y] = at(i * 1.2 * s - 2 * s, 0), [p1x, p1y] = at(i * 1.2 * s + 2 * s, 4 * s); g.beginPath(); g.moveTo(p0x, p0y); g.lineTo(p1x, p1y); g.stroke(); const [q0x, q0y] = at(i * 1.2 * s + 2 * s, 0), [q1x, q1y] = at(i * 1.2 * s - 2 * s, 4 * s); g.beginPath(); g.moveTo(q0x, q0y); g.lineTo(q1x, q1y); g.stroke(); }
  g.restore();
  const [sx, sy] = at(0, -0.4 * s), [ex, ey] = at(0.6 * s, -2.2 * s);
  g.strokeStyle = INK; g.lineWidth = 1.3 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
  g.strokeStyle = WAL[2]; g.lineWidth = 0.6 * s; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
}
/** a brass dome (a nut, a boss, a knob) */
function brassDome(g: Ctx, x: number, y: number, r: number) {
  const s = sh().arc(x, y, r);
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  gr.addColorStop(0, BRASS[4]); gr.addColorStop(0.35, BRASS[3]); gr.addColorStop(0.75, BRASS[2]); gr.addColorStop(1, BRASS[1]);
  g.fillStyle = gr; g.fill(s.p); inkLine(g, s, Math.min(0.6, r * 0.3));
}

// ------------------------------------------------------------------ the owls

export type OwlPose = 'in' | 'peek' | 'out' | 'call' | 'bow';
/**
 * Pip, the tawny owl who lives behind the door, standing with feet at (x, foot), `h` tall: chestnut feathers with dark
 * streaks, a pale chest with chevrons, a two-lobed facial disc, big amber eyes, ear tufts. `call` opens the beak and
 * lifts the head, `bow` dips it with the eyes shut.
 */
export function paintOwl(g: Ctx, x: number, foot: number, h: number, pose: OwlPose) {
  const k = h / 26, up = pose === 'call' ? -1.2 * k : pose === 'bow' ? 2.4 * k : 0, lean = pose === 'bow' ? 0.12 : pose === 'call' ? -0.05 : 0;
  g.save();
  g.translate(x, foot); g.rotate(lean); g.translate(-x, -foot);
  const top = foot - h;
  const C1 = ['#2e1206', '#5a260e', '#94461c', '#c4702e', '#eaa25a'];
  // feet
  g.fillStyle = '#e2a040';
  for (const sd of [-1, 1]) { const f = sh().ell(x + sd * 3 * k, foot - 0.6 * k, 2.2 * k, 1.1 * k); g.fillStyle = '#e8a640'; g.fill(f.p); inkLine(g, f, 0.5); }
  // body
  const body = sh().smooth([[x, top + 7 * k], [x + 8.8 * k, top + 9.5 * k], [x + 10 * k, top + 17 * k], [x + 7.5 * k, foot - 1 * k], [x, foot + 0.2 * k], [x - 7.5 * k, foot - 1 * k], [x - 10 * k, top + 17 * k], [x - 8.8 * k, top + 9.5 * k]]);
  part(g, body, { pal: C1, grain: 0, rim: 1.1 * k, ink: 0.8, cast: 1.2 });
  // the pale chest with chevrons
  const chest = sh().smooth([[x, top + 12 * k], [x + 5.4 * k, top + 14 * k], [x + 5.6 * k, foot - 4 * k], [x, foot - 1.2 * k], [x - 5.6 * k, foot - 4 * k], [x - 5.4 * k, top + 14 * k]]);
  const cg = g.createLinearGradient(x - 4 * k, top + 12 * k, x + 4 * k, foot);
  cg.addColorStop(0, '#fff0d0'); cg.addColorStop(0.6, '#ecc48e'); cg.addColorStop(1, '#c48a52');
  g.fillStyle = cg; g.fill(chest.p);
  g.save(); g.clip(chest.p); g.strokeStyle = 'rgba(110,46,14,0.75)'; g.lineWidth = 0.55 * k; g.lineCap = 'round';
  for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) {
    const cx = x + c * 2.3 * k + (r % 2 ? 1.15 * k : 0), cy = top + 15 * k + r * 2.4 * k;
    g.beginPath(); g.moveTo(cx - 0.8 * k, cy - 0.5 * k); g.lineTo(cx, cy + 0.3 * k); g.lineTo(cx + 0.8 * k, cy - 0.5 * k); g.stroke();
  }
  g.restore();
  // folded wings with dark bars
  for (const sd of [-1, 1]) {
    const open = pose === 'call' ? 1.6 * k : 0;
    const w = sh().smooth([[x + sd * 7 * k, top + 10 * k], [x + sd * (10.4 * k + open), top + 14 * k], [x + sd * (10 * k + open * 1.2), foot - 4 * k], [x + sd * (8 * k + open), foot - 0.6 * k], [x + sd * 6.4 * k, foot - 5 * k], [x + sd * 6.2 * k, top + 14 * k]]);
    part(g, w, { pal: ['#24100a', '#4a1e0c', '#7a3616', '#a85a26', '#d4884a'], grain: 0, rim: 0.7 * k, ink: 0.7 });
    g.save(); g.clip(w.p); g.strokeStyle = 'rgba(255,222,170,0.5)'; g.lineWidth = 0.6 * k;
    for (let i = 0; i < 4; i++) { const yy = top + 14 * k + i * 2.6 * k; g.beginPath(); g.moveTo(x + sd * 6 * k, yy); g.lineTo(x + sd * 11 * k, yy + 1.2 * k); g.stroke(); }
    g.restore();
  }
  // the head
  const hy = top + up;
  const head = sh().smooth([[x, hy + 1.2 * k], [x + 4 * k, hy + 1.6 * k], [x + 6.4 * k, hy - 0.6 * k], [x + 8.4 * k, hy + 3 * k], [x + 8.6 * k, hy + 8 * k], [x + 5 * k, hy + 12.4 * k], [x, hy + 13 * k], [x - 5 * k, hy + 12.4 * k], [x - 8.6 * k, hy + 8 * k], [x - 8.4 * k, hy + 3 * k], [x - 6.4 * k, hy - 0.6 * k], [x - 4 * k, hy + 1.6 * k]]);
  part(g, head, { pal: C1, grain: 0, rim: 1 * k, ink: 0.8, cast: 0.8 });
  // the facial disc: two pale lobes with a dark rim
  for (const sd of [-1, 1]) {
    const d = sh().ell(x + sd * 3.3 * k, hy + 6.6 * k, 3.6 * k, 3.9 * k);
    const dg = g.createRadialGradient(x + sd * 3.3 * k, hy + 6.6 * k, 0.5, x + sd * 3.3 * k, hy + 6.6 * k, 4 * k);
    dg.addColorStop(0, '#f6dcb0'); dg.addColorStop(0.75, '#dcae74'); dg.addColorStop(1, '#8a4a1e');
    g.fillStyle = dg; g.fill(d.p);
  }
  // eyes
  for (const sd of [-1, 1]) {
    const ex = x + sd * 3.2 * k, ey = hy + 6.4 * k;
    if (pose === 'bow') { g.strokeStyle = INK; g.lineWidth = 0.8 * k; g.lineCap = 'round'; g.beginPath(); g.arc(ex, ey - 0.6 * k, 2 * k, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); continue; }
    const e = sh().arc(ex, ey, 2.5 * k);
    const eg = g.createRadialGradient(ex - 0.6 * k, ey - 0.8 * k, 0.2, ex, ey, 2.5 * k);
    eg.addColorStop(0, '#fff2a0'); eg.addColorStop(0.5, '#ffb81e'); eg.addColorStop(1, '#c86a06');
    g.fillStyle = eg; g.fill(e.p); inkLine(g, e, 0.6 * k);
    g.fillStyle = INK; g.beginPath(); g.arc(ex + sd * 0.15 * k, ey + 0.1 * k, 1.3 * k, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 0.55 * k, ey - 0.7 * k, 0.5 * k, 0, Math.PI * 2); g.fill();
  }
  // the beak (open when calling)
  const by = hy + 8.6 * k;
  const beak = sh().poly([[x - 1.2 * k, by - 0.6 * k], [x + 1.2 * k, by - 0.6 * k], [x, by + (pose === 'call' ? 1.6 : 2.4) * k]]);
  part(g, beak, { pal: ['#3a2a10', '#7a6030', '#d8b050', '#f4d888', '#fff4c8'], grain: 0, rim: 0, ink: 0.55 });
  if (pose === 'call') { const lo = sh().poly([[x - 1 * k, by + 1.4 * k], [x + 1 * k, by + 1.4 * k], [x, by + 2.8 * k]]); g.fillStyle = '#c03a2a'; g.fill(sh().poly([[x - 1 * k, by + 0.8 * k], [x + 1 * k, by + 0.8 * k], [x, by + 1.8 * k]]).p); part(g, lo, { pal: ['#3a2a10', '#7a6030', '#c8a048', '#e8c878', '#fff4c8'], grain: 0, rim: 0, ink: 0.5 }); }
  g.restore();
}

/** the carved crest: an owl with half-spread wings on a branch between two big oak leaves (honey walnut) */
function crest(g: Ctx) {
  const y = G.ridge + 1, x = CX;
  // two big oak leaves fanning out low over the roof
  const ra = Math.atan(G.slope) * 0.55;
  leaf(g, x - 6, y - 3, Math.PI - ra, 33, 20, { seed: 3, curl: -0.14 });
  leaf(g, x + 6, y - 3, ra, 33, 20, { seed: 4, curl: 0.14 });
  // the wings: carved feathers spread behind the body
  for (const sd of [-1, 1]) {
    const pts: Pt[] = [[x + sd * 3, y - 22], [x + sd * 10, y - 30], [x + sd * 18, y - 33], [x + sd * 17, y - 27], [x + sd * 19.5, y - 25], [x + sd * 15, y - 19.5], [x + sd * 16.5, y - 16.5], [x + sd * 11, y - 12], [x + sd * 6, y - 8]];
    const w = sh().smooth(pts);
    part(g, w, hon({ grain: 0.3, dir: sd * 0.8, cast: 1.2, rim: 1 }));
    g.save(); g.clip(w.p); g.strokeStyle = 'rgba(70,26,0,0.6)'; g.lineWidth = 0.7; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + sd * 5, y - 12 - i * 3); g.quadraticCurveTo(x + sd * 12, y - 18 - i * 3.6, x + sd * (17 + i), y - 17 - i * 4); g.stroke(); }
    g.restore();
  }
  // the branch
  const br = sh().smooth([[x - 14, y - 2.5], [x, y - 4.5], [x + 14, y - 2.5], [x + 14, y + 0.5], [x, y - 1], [x - 14, y + 0.5]]);
  part(g, br, wal({ grain: 0.5, dir: Math.PI / 2, rim: 0.6 }));
  // the body and head (one carved piece) with feather scallops
  const body = sh().smooth([[x, y - 26], [x + 6, y - 25.5], [x + 8.2, y - 30], [x + 8, y - 21], [x + 7.8, y - 13], [x + 5, y - 4], [x, y - 2.5], [x - 5, y - 4], [x - 7.8, y - 13], [x - 8, y - 21], [x - 8.2, y - 30], [x - 6, y - 25.5]]);
  part(g, body, hon({ grain: 0.25, cast: 1.2, rim: 1.1 }));
  g.save(); g.clip(body.p); g.strokeStyle = 'rgba(80,30,0,0.5)'; g.lineWidth = 0.6;
  for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) { const cx = x + c * 2.6 + (r % 2 ? 1.3 : 0), cy = y - 15 + r * 2.6; g.beginPath(); g.arc(cx, cy, 1.2, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  g.restore();
  // facial discs and amber glass eyes, a beak
  for (const sd of [-1, 1]) {
    const d = sh().arc(x + sd * 3.4, y - 21.5, 3.6);
    part(g, d, hon({ grain: 0, rim: 0.9, ink: 0.6, pal: ['#5a2c0a', '#9a5a20', '#d89848', '#f4c674', '#fff0c0'] }));
    const e = sh().arc(x + sd * 3.4, y - 21.5, 1.7);
    const eg = g.createRadialGradient(x + sd * 3.4 - 0.5, y - 22.2, 0.1, x + sd * 3.4, y - 21.5, 1.7);
    eg.addColorStop(0, '#fff0a0'); eg.addColorStop(0.45, '#ff9c14'); eg.addColorStop(1, '#8a3404');
    g.fillStyle = eg; g.fill(e.p); inkLine(g, e, 0.5);
    g.fillStyle = INK; g.beginPath(); g.arc(x + sd * 3.4, y - 21.4, 0.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x + sd * 3.4 - 0.5, y - 22, 0.32, 0, Math.PI * 2); g.fill();
  }
  part(g, sh().poly([[x - 1.2, y - 19.6], [x + 1.2, y - 19.6], [x, y - 16.6]]), hon({ grain: 0, rim: 0, ink: 0.5 }));
  // talons on the branch
  g.fillStyle = HON[1];
  for (const sd of [-1, 1]) for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(x + sd * 3 + i * 1.1, y - 3.3, 0.7, 0, Math.PI * 2); g.fill(); }
}

// ------------------------------------------------------------------ the case

/** the roof's outer top over x */
const roofTop = (x: number) => G.ridge + Math.abs(x - CX) * G.slope;
/** one side of the roof: the shingle band and the bargeboard (sd: -1 left, 1 right) */
function roofSide(g: Ctx, sd: number) {
  const e = G.eave, B = G.band, BB = G.barge;
  const at = (d: number, off: number): Pt => [CX + sd * d, roofTop(CX + d) + off];
  // the shingled band: courses of rounded shingle butts stepping down the slope
  const band = sh().poly([at(0, -0.5), at(e, -0.5), at(e, B), at(0, B)]);
  part(g, band, { pal: ROOFC, grain: 0, rim: 0, ink: 0 });
  g.save(); g.clip(band.p);
  const n = 13, sw = e / n;
  for (let row = 0; row < 2; row++) for (let i = -1; i <= n; i++) {
    const d0 = (i + (row ? 0.5 : 0)) * sw, d1 = d0 + sw;
    const [ax, ay] = at(d0, row * 4.6 - 1.4), [bx, by] = at(d1, row * 4.6 - 1.4);
    const tone = hash(i, row, 3);
    const s = sh().m(ax, ay).l(bx, by).l(bx, by + 3.4).q(bx, by + 5.6, (ax + bx) / 2, (ay + by) / 2 + 5.8).q(ax, ay + 5.6, ax, ay + 3.4).z();
    const gr = g.createLinearGradient(ax, ay, ax + 2, ay + 6);
    gr.addColorStop(0, ROOFC[1]); gr.addColorStop(0.55, tone > 0.6 ? ROOFC[4] : tone > 0.25 ? ROOFC[3] : ROOFC[2]); gr.addColorStop(1, ROOFC[2]);
    g.fillStyle = gr; g.fill(s.p);
    grain(g, s, 0.35, Math.PI / 2, 0.22);
    g.strokeStyle = 'rgba(20,6,4,0.85)'; g.lineWidth = 0.5; g.stroke(s.p);
  }
  g.restore();
  inkLine(g, band, 0.8);
  // the bargeboard: a plain board with big scallops
  const bb = sh().m(...at(0, B)).l(...at(e, B)).l(...at(e, B + BB * 0.55));
  const ns = 7;
  for (let i = ns - 1; i >= 0; i--) {
    const d0 = (i + 1) * (e / ns), d1 = i * (e / ns);
    const [ax, ay] = at(d0, B + BB * 0.55), [bx, by] = at(d1, B + BB * 0.55);
    bb.q((ax + bx) / 2, (ay + by) / 2 + BB * 0.95, bx, by);
  }
  bb.z();
  part(g, bb, hon({ grain: 0.4, dir: sd * (Math.PI / 2 - Math.atan(G.slope)), cast: 1.4, rim: 0.8 }));
  // the eave's turned drop
  const [fx, fy] = at(e - 3, B + BB * 0.5);
  const drop = sh().smooth([[fx - 2.2, fy], [fx + 2.2, fy], [fx + 2.6, fy + 3], [fx + 1.4, fy + 6], [fx + 2.2, fy + 8], [fx, fy + 12], [fx - 2.2, fy + 8], [fx - 1.4, fy + 6], [fx - 2.6, fy + 3]]);
  part(g, drop, hon({ grain: 0, cast: 1, rim: 0.7 }));
}
function doorArch(inset = 0): Sh {
  const d = G.door, r = d.hw - inset;
  return sh().m(CX - r, d.sill).l(CX - r, d.top + d.hw).arc(CX, d.top + d.hw, r, Math.PI, 0).l(CX + r, d.sill).z();
}

export type DoorState = 'closed' | 'ajar' | 'open';
/** the doorway: the dark room, the door (closed, ajar or swung open), the owl and the balcony rail in front */
export function paintDoorway(g: Ctx, door: DoorState, owl: OwlPose | null) {
  const d = G.door;
  // the frame: a carved honey arch round the opening
  const fr = sh(); fr.p.addPath(doorArch(-2.8).p); fr.p.addPath(doorArch(0).p);
  const outer = doorArch(-2.8); fr.x0 = outer.x0; fr.y0 = outer.y0; fr.x1 = outer.x1; fr.y1 = outer.y1;
  g.save(); g.fillStyle = lightGrad(g, outer, HON); g.fill(fr.p, 'evenodd'); g.restore();
  grain(g, outer, 0.3);
  rim(g, outer, 0.8); inkLine(g, outer, 0.8);
  // the room behind
  const hole = doorArch(0);
  const hg = g.createLinearGradient(CX, d.top, CX, d.sill);
  hg.addColorStop(0, '#0c0406'); hg.addColorStop(1, '#2a120a');
  g.fillStyle = hg; g.fill(hole.p);
  if (owl === 'peek' || owl === 'in') { g.save(); g.clip(hole.p); paintOwl(g, CX, d.sill + 5, G.owl * 0.9, 'out'); g.fillStyle = 'rgba(12,4,6,0.35)'; g.fill(hole.p); g.restore(); }
  g.save(); g.clip(hole.p); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.stroke(hole.p); g.restore();
  inkLine(g, hole, 0.7);
  // the door: two vertical boards in an arched leaf, a brass knob; hinged on the left
  const leafW = door === 'closed' ? 1 : door === 'ajar' ? 0.5 : -0.6;
  g.save();
  g.translate(CX - d.hw, 0); g.scale(leafW, 1); g.translate(-(CX - d.hw), 0);
  const lf = doorArch(0.4);
  part(g, lf, { pal: door === 'ajar' ? ['#1e0a06', '#3a160c', '#5a2612', '#7a3a1c', '#a05a30'] : WAL, grain: 0.7, rim: 0.7, ink: 0.7 / Math.max(0.3, Math.abs(leafW)) });
  g.save(); g.clip(lf.p); g.strokeStyle = 'rgba(25,6,0,0.7)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(CX, d.top); g.lineTo(CX, d.sill); g.stroke(); g.restore();
  g.restore();
  if (door === 'closed') brassDome(g, CX + d.hw - 3, d.top + 15, 1.1);
  if (owl === 'out' || owl === 'call' || owl === 'bow') paintOwl(g, CX, d.sill, G.owl, owl);
  balcony(g);
}
/** the little balcony: a floor, a top rail, turned balusters and two newel posts with ball finials */
function balcony(g: Ctx) {
  const b = G.bal, y = b.y;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = CX - b.hw + 6 + i * ((b.hw * 2 - 12) / (n - 1));
    const s = sh().smooth([[x - 0.9, b.rail + 1.6], [x + 0.9, b.rail + 1.6], [x + 1.5, b.rail + 3.6], [x + 0.8, y - 2.4], [x + 1.3, y - 0.4], [x - 1.3, y - 0.4], [x - 0.8, y - 2.4], [x - 1.5, b.rail + 3.6]]);
    part(g, s, hon({ grain: 0, rim: 0.4, ink: 0.55, cast: 0.6 }));
  }
  const rail = sh().rect(CX - b.hw, b.rail, b.hw * 2, 1.9);
  part(g, rail, hon({ grain: 0.4, dir: Math.PI / 2, rim: 0.5, ink: 0.65, cast: 0.8 }));
  const floor = sh().rect(CX - b.hw - 1.5, y, b.hw * 2 + 3, 3.2);
  part(g, floor, hon({ grain: 0.4, dir: Math.PI / 2, rim: 0.6, ink: 0.75, cast: 1.2 }));
  for (const sd of [-1, 1]) {
    const x = CX + sd * (b.hw - 1.6);
    const post = sh().rect(x - 1.8, b.rail - 2.4, 3.6, y - b.rail + 2.4);
    part(g, post, hon({ grain: 0.3, rim: 0.5, ink: 0.65 }));
    brassDomeWood(g, x, b.rail - 3.6, 2);
  }
}
function brassDomeWood(g: Ctx, x: number, y: number, r: number) {
  const s = sh().arc(x, y, r);
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  gr.addColorStop(0, HON[4]); gr.addColorStop(0.4, HON[3]); gr.addColorStop(1, HON[1]);
  g.fillStyle = gr; g.fill(s.p); inkLine(g, s, 0.55);
}

/** The enamel dial (no hands): a cream face, a fine chapter ring with a minute track, radial Roman numerals, a brass bezel. */
export function paintDial(g: Ctx, withBezel = true) {
  const { y, r } = G.dial, x = CX;
  const face = sh().arc(x, y, r);
  const eg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  eg.addColorStop(0, '#fffdf6'); eg.addColorStop(0.6, '#fbf3e2'); eg.addColorStop(0.92, '#eadcc0'); eg.addColorStop(1, '#c8b28c');
  g.fillStyle = eg; g.fill(face.p);
  g.strokeStyle = '#1e1418'; g.fillStyle = '#1e1418'; g.lineCap = 'butt';
  const ring = (rr: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke(); };
  ring(r * 0.93, 0.35); ring(r * 0.84, 0.28);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, five = i % 5 === 0, s = Math.sin(a), c = -Math.cos(a);
    g.lineWidth = five ? 0.75 : 0.32;
    const r0 = five ? r * 0.835 : r * 0.845;
    g.beginPath(); g.moveTo(x + s * r0, y + c * r0); g.lineTo(x + s * r * 0.93, y + c * r * 0.93); g.stroke();
  }
  // numerals: thick and thin strokes with hairline serifs, feet towards the centre
  const ROM = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const h = r * 0.2, thick = h * 0.17, thin = h * 0.065;
  for (let i = 0; i < 12; i++) {
    g.save();
    g.translate(x, y); g.rotate((i / 12) * Math.PI * 2); g.translate(0, -r * 0.665);
    const t = ROM[i], wd = (c: string) => (c === 'I' ? h * 0.2 : h * 0.62), gap = h * 0.08;
    let cx = -([...t].reduce((a, c) => a + wd(c), 0) + gap * (t.length - 1)) / 2;
    const top = -h / 2, bot = h / 2;
    for (const c of t) {
      const w = wd(c);
      const ln = (x0: number, y0: number, x1: number, y1: number, lw: number) => { g.lineWidth = lw; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
      if (c === 'I') ln(cx + w / 2, top, cx + w / 2, bot, thick);
      else if (c === 'V') { ln(cx + w * 0.08, top, cx + w / 2, bot, thick); ln(cx + w * 0.92, top, cx + w / 2, bot, thin); }
      else { ln(cx + w * 0.08, top, cx + w * 0.92, bot, thick); ln(cx + w * 0.92, top, cx + w * 0.08, bot, thin); }
      ln(cx - h * 0.05, top + thin / 2, cx + w + h * 0.05, top + thin / 2, thin);
      ln(cx - h * 0.05, bot - thin / 2, cx + w + h * 0.05, bot - thin / 2, thin);
      cx += w + gap;
    }
    g.restore();
  }
  // a fine inner circle and a soft shadow from the bezel
  ring(r * 0.36, 0.22);
  g.save(); g.clip(face.p);
  const sg = g.createRadialGradient(x + r * 0.1, y + r * 0.12, r * 0.8, x, y, r * 1.02);
  sg.addColorStop(0, 'rgba(60,30,10,0)'); sg.addColorStop(1, 'rgba(60,30,10,0.4)');
  g.fillStyle = sg; g.fill(face.p);
  g.restore();
  if (!withBezel) return;
  // the brass bezel
  const bez = sh().arc(x, y, G.dial.bez); bez.p.arc(x, y, r, 0, Math.PI * 2, true);
  const bg = g.createLinearGradient(x - G.dial.bez, y - G.dial.bez, x + G.dial.bez, y + G.dial.bez);
  bg.addColorStop(0, BRASS[4]); bg.addColorStop(0.2, BRASS[3]); bg.addColorStop(0.5, BRASS[2]); bg.addColorStop(0.75, BRASS[1]); bg.addColorStop(0.9, BRASS[3]); bg.addColorStop(1, BRASS[2]);
  g.fillStyle = bg; g.fill(bez.p, 'evenodd');
  g.strokeStyle = 'rgba(255,250,220,0.8)'; g.lineWidth = 0.4; g.beginPath(); g.arc(x, y, G.dial.bez - 1.2, Math.PI * 0.95, Math.PI * 1.55); g.stroke();
  g.strokeStyle = 'rgba(60,30,0,0.5)'; g.beginPath(); g.arc(x, y, G.dial.bez - 1.2, Math.PI * 1.95, Math.PI * 0.55); g.stroke();
  g.strokeStyle = INK; g.lineWidth = 0.7; g.beginPath(); g.arc(x, y, G.dial.bez, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 0.45; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
}

/** the hands' lengths (u) */
export const HANDS = { hour: 21, minute: 30 };
/**
 * A blued-steel spade hand pointing up from the arbor at (x, y): a tapered shaft, a spade (the hour hand's bigger and
 * pierced), a counterweight tail. With a soft shadow on the dial.
 */
export function paintHand(g: Ctx, x: number, y: number, kind: 'hour' | 'minute', shadow = true) {
  const L = HANDS[kind], H = kind === 'hour';
  const w = H ? 1.5 : 1.0, sp = H ? 4.4 : 2.7, sy = H ? L * 0.68 : L * 0.84, tail = H ? 5 : 7;
  const s = sh().m(x - w * 0.7, y + tail * 0.55)
    .l(x - w * 0.5, y - sy + sp * 0.2)
    .c(x - sp * 1.1, y - sy + sp * 0.5, x - sp * 1.1, y - sy - sp * 0.9, x - w * 0.3, y - sy - sp * 0.95)
    .l(x, y - L)
    .l(x + w * 0.3, y - sy - sp * 0.95)
    .c(x + sp * 1.1, y - sy - sp * 0.9, x + sp * 1.1, y - sy + sp * 0.5, x + w * 0.5, y - sy + sp * 0.2)
    .l(x + w * 0.7, y + tail * 0.55)
    .arc(x, y + tail, w * 1.25, -Math.PI / 2 + 0.6, Math.PI * 1.5 - 0.6).z();
  if (H) s.p.ellipse(x, y - sy - sp * 0.2, sp * 0.3, sp * 0.42, 0, 0, Math.PI * 2);
  if (shadow) { const k = pxu(g); g.save(); g.shadowColor = 'rgba(40,20,0,0.45)'; g.shadowBlur = 1.2 * k; g.shadowOffsetX = 0.8 * k + 4000; g.shadowOffsetY = 1.2 * k; g.translate(-4000 / k, 0); g.fillStyle = '#000'; g.fill(s.p, 'evenodd'); g.restore(); }
  const gr = g.createLinearGradient(x - sp, y - L, x + sp, y);
  gr.addColorStop(0, '#3c4a78'); gr.addColorStop(0.35, '#141a30'); gr.addColorStop(1, '#06070e');
  g.fillStyle = gr; g.fill(s.p, 'evenodd');
  g.strokeStyle = 'rgba(150,175,240,0.55)'; g.lineWidth = 0.25; g.beginPath(); g.moveTo(x - w * 0.25, y); g.lineTo(x - w * 0.15, y - sy); g.stroke();
}
/** the brass arbor nut over the hands */
export const paintBoss = (g: Ctx, x = CX, y: number = G.dial.y) => brassDome(g, x, y, 1.9);

/** The case: roof, crest, gable with its doorway and balcony, cornice, the walnut box with its carvings, the dial, the apron. */
export function paintCase(g: Ctx, o: { door?: DoorState; owl?: OwlPose | null; dial?: boolean } = {}) {
  rs = 7;
  const b = G.box, c = G.corn;
  // the gable wall: vertical boards
  const gab = sh().poly([[CX, G.gable.top], [CX + G.gable.hw + 3, G.gable.y + 2], [CX - G.gable.hw - 3, G.gable.y + 2]]);
  part(g, gab, wal({ rim: 0 }));
  g.save(); g.clip(gab.p); g.strokeStyle = 'rgba(20,6,0,0.55)'; g.lineWidth = 0.45;
  for (let x = CX - 60; x < CX + 60; x += 8.4) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x, 104); g.stroke(); }
  g.restore();
  paintDoorway(g, o.door ?? 'closed', o.owl ?? null);
  // the walnut box: a raised frame round a recessed panel
  const box = sh().rect(CX - b.hw, b.y0, b.hw * 2, b.y1 - b.y0);
  part(g, box, wal({ rim: 1.4, ink: 0.9 }));
  const inset = 5.5, pan = sh().rect(CX - b.hw + inset, b.y0 + inset, (b.hw - inset) * 2, b.y1 - b.y0 - inset * 2);
  part(g, pan, wal({ pal: ['#260c06', '#43190c', '#6a2c14', '#8e4822', '#b8703c'], grain: 0.8, rim: 0, ink: 0.6 }));
  // the recess: shadow along its top and left edges, light along the bottom and right
  g.save(); g.clip(pan.p);
  const rg = g.createLinearGradient(pan.x0, pan.y0, pan.x1, pan.y1);
  rg.addColorStop(0, 'rgba(20,4,0,0.6)'); rg.addColorStop(0.45, 'rgba(20,4,0,0)'); rg.addColorStop(0.6, 'rgba(255,220,170,0)'); rg.addColorStop(1, 'rgba(255,220,170,0.35)');
  g.strokeStyle = rg; g.lineWidth = 3; g.stroke(pan.p);
  g.restore();
  // the varnish catches the lamp: a soft band of light across the panel
  g.save(); g.clip(box.p); g.globalCompositeOperation = 'screen';
  const vg = g.createLinearGradient(CX - b.hw, b.y0, CX + b.hw * 0.2, b.y1);
  vg.addColorStop(0, 'rgba(255,190,120,0.28)'); vg.addColorStop(0.35, 'rgba(255,190,120,0.06)'); vg.addColorStop(0.5, 'rgba(255,190,120,0.16)'); vg.addColorStop(0.62, 'rgba(255,190,120,0)');
  g.fillStyle = vg; g.fill(box.p); g.restore();
  // the carvings: a big oak leaf in each corner, two acorns under each lower leaf
  const d = G.dial;
  const corners: [number, number, number][] = [[-1, -1, 3], [1, -1, 5], [-1, 1, 7], [1, 1, 9]];
  for (const [sx, sy, seed] of corners) {
    const a = Math.atan2(sy * 1.0, sx * 1.0) + sx * sy * 0.05;
    const r0 = d.board - 2.5;
    leaf(g, CX + Math.cos(a) * r0, d.y + Math.sin(a) * r0, a, 34, 21, { seed, curl: 0.12 * sx * sy });
  }
  for (const sx of [-1, 1]) {
    acorn(g, CX + sx * 33, d.y + 34, sx * 0.35, 1.15);
    acorn(g, CX + sx * 39, d.y + 30, -sx * 0.25, 1.05);
  }
  // the turned dial board, the enamel and the bezel
  const board = sh().arc(CX, d.y, d.board);
  part(g, board, hon({ grain: 0.35, dir: 1.2, cast: 1.6, rim: 1.2, ink: 0.85 }));
  g.strokeStyle = 'rgba(60,20,0,0.5)'; g.lineWidth = 0.4; g.beginPath(); g.arc(CX, d.y, d.board - 1.4, 0, Math.PI * 2); g.stroke();
  if (o.dial !== false) paintDial(g);
  // cornice, base and apron
  const corn = sh().poly([[CX - c.hw, c.y0], [CX + c.hw, c.y0], [CX + c.hw, c.y0 + 2.4], [CX + c.hw - 2.5, c.y1 + 0.6], [CX - c.hw + 2.5, c.y1 + 0.6], [CX - c.hw, c.y0 + 2.4]]);
  part(g, corn, wal({ dir: Math.PI / 2, rim: 0.8, ink: 0.85, cast: 1.2, pal: ['#3a1408', '#6a2c12', '#9a4c22', '#c47038', '#eaa060'] }));
  g.strokeStyle = 'rgba(255,226,170,0.45)'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(CX - c.hw + 1, c.y0 + 2.4); g.lineTo(CX + c.hw - 1, c.y0 + 2.4); g.stroke();
  const ap = G.apron;
  const apr = sh().m(CX - ap.hw, ap.y0).l(CX + ap.hw, ap.y0).l(CX + ap.hw, ap.y0 + 5)
    .q(CX + ap.hw - 8, ap.y0 + 12, CX + ap.hw - 18, ap.y0 + 7)
    .q(CX + 26, ap.y0 + 14, CX + 13, ap.y0 + 9)
    .q(CX + 5, ap.y1 - 3, CX, ap.y1)
    .q(CX - 5, ap.y1 - 3, CX - 13, ap.y0 + 9)
    .q(CX - 26, ap.y0 + 14, CX - ap.hw + 18, ap.y0 + 7)
    .q(CX - ap.hw + 8, ap.y0 + 12, CX - ap.hw, ap.y0 + 5).z();
  part(g, apr, hon({ dir: Math.PI / 2, cast: 1.4, rim: 0.9, ink: 0.85 }));
  const base = G.base;
  const bs = sh().poly([[CX - base.hw, base.y0], [CX + base.hw, base.y0], [CX + base.hw, base.y1 - 2], [CX + base.hw - 2, base.y1], [CX - base.hw + 2, base.y1], [CX - base.hw, base.y1 - 2]]);
  part(g, bs, wal({ dir: Math.PI / 2, rim: 0.8, ink: 0.85, cast: 1.2, pal: ['#3a1408', '#6a2c12', '#9a4c22', '#c47038', '#eaa060'] }));
  // the roof and the crest
  for (const sd of [-1, 1]) roofSide(g, sd);
  const cap = sh().smooth([[CX - 4, G.ridge + 1], [CX, G.ridge - 2.4], [CX + 4, G.ridge + 1], [CX, G.ridge + 3]]);
  part(g, cap, { pal: ROOFC, grain: 0, rim: 0.5, ink: 0.7 });
  crest(g);
  shade(g, 0, 0, G.W, G.H);
}
/** the lamp's light over a whole layer: warmer and brighter at the top left, falling off to the bottom right */
function shade(g: Ctx, x: number, y: number, w: number, h: number) {
  g.save();
  g.globalCompositeOperation = 'source-atop';
  const gr = g.createLinearGradient(x + w * 0.2, y, x + w * 0.8, y + h);
  gr.addColorStop(0, 'rgba(255,200,120,0.12)'); gr.addColorStop(0.45, 'rgba(255,200,120,0)'); gr.addColorStop(0.6, 'rgba(30,8,10,0)'); gr.addColorStop(1, 'rgba(30,8,10,0.3)');
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.restore();
}

/** the case layer's box (art units): the painting with room for its outline and its shadow on the wall */
export const CASE_BOX = { x: -6, y: 0, w: G.W + 12, h: G.H + 12 };
/** the doorway's box (art units): what paintDoorway changes, with room for the owl's head */
export const DOOR_BOX = { x: CX - G.bal.hw - 4, y: G.door.top - 9, w: G.bal.hw * 2 + 8, h: G.bal.y + 4 - (G.door.top - 9) };

/** The pendulum: a brass rod from the pivot and a carved oak-leaf bob with a brass boss (pivot at (CX, G.pivot.y)). */
export function paintPendulum(g: Ctx, len: number = G.pendLen) {
  const x = CX, y = G.pivot.y;
  const rod = sh().rect(x - 0.6, y, 1.2, len - 2);
  part(g, rod, { pal: BRASS, grain: 0, rim: 0, ink: 0.5 });
  leaf(g, x, y + len - 5, Math.PI / 2, 29, 21, { seed: 11, curl: 0.06, castD: 0.6 });
  brassDome(g, x, y + len - 3, 2.6);
}
/** the pendulum's box (art units, around the pivot) */
export const PEND_BOX = (len: number = G.pendLen) => ({ x: CX - 16, y: G.pivot.y - 2, w: 32, h: len + 30 });

/** A cast pine-cone weight hanging from its loop at (x, y): spiralling scales, darker deep in, bronze at the lips. */
export function paintCone(g: Ctx, x: number, y: number) {
  const L = 31, R = 7.2;
  const prof = (t: number) => R * Math.pow(Math.sin(Math.PI * Math.min(1, 0.14 + t * 0.92)), 0.75) * (1 - t * 0.2);
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([x + prof(t), y + 4 + t * L]); }
  pts.push([x, y + 4 + L + 1.2]);
  for (let i = 10; i >= 0; i--) { const t = i / 10; pts.push([x - prof(t), y + 4 + t * L]); }
  const body = sh().smooth(pts);
  cast(g, body, 1.6, 0.5);
  const bg = g.createLinearGradient(x - R, y, x + R, y);
  bg.addColorStop(0, '#5a3418'); bg.addColorStop(0.35, '#3a1e0e'); bg.addColorStop(1, '#140806');
  g.fillStyle = bg; g.fill(body.p);
  // scales: rows of rounded tips pointing down, offset each row
  g.save(); g.clip(body.p);
  for (let r = 8; r >= 0; r--) {
    const t = (r + 0.6) / 9.4, yy = y + 4 + t * L, w = prof(t);
    const n = 3, ph = r % 2 ? 0.5 : 0;
    for (let i = -1; i <= n; i++) {
      const u = ((i + ph) / n) * 2 - 1;
      if (Math.abs(u) > 1.05) continue;
      const sx = x + Math.sin(u * Math.PI * 0.5) * w * 0.95, sw = ((w * 2.3) / n) * Math.cos(u * 1.1) + 1.6, sl = 5;
      const s = sh().m(sx - sw / 2, yy - sl * 0.6).q(sx - sw / 2, yy + sl * 0.5, sx, yy + sl * 0.62).q(sx + sw / 2, yy + sl * 0.5, sx + sw / 2, yy - sl * 0.6).z();
      const lit = 0.5 - u * 0.5;
      const gr = g.createLinearGradient(sx, yy - sl * 0.6, sx, yy + sl * 0.6);
      gr.addColorStop(0, '#2a140a'); gr.addColorStop(0.7, lit > 0.55 ? '#c08442' : lit > 0.3 ? '#8e5a2a' : '#5e361a'); gr.addColorStop(1, lit > 0.55 ? '#f0c27a' : '#a06a34');
      g.fillStyle = gr; g.fill(s.p);
      g.strokeStyle = 'rgba(14,6,4,0.85)'; g.lineWidth = 0.4; g.stroke(s.p);
    }
  }
  g.restore();
  inkLine(g, body, 0.85);
  // the cap and loop
  const cap = sh().smooth([[x - 3.2, y + 3], [x + 3.2, y + 3], [x + 4.2, y + 5.4], [x - 4.2, y + 5.4]]);
  part(g, cap, { pal: BRASS, grain: 0, rim: 0.4, ink: 0.55 });
  ringAt(g, x, y + 1.2, 1.5, 0.55);
}
function ringAt(g: Ctx, x: number, y: number, r: number, t: number) {
  g.lineWidth = t + 0.9; g.strokeStyle = INK; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  const gr = g.createLinearGradient(x - r, y - r, x + r, y + r);
  gr.addColorStop(0, BRASS[4]); gr.addColorStop(0.5, BRASS[2]); gr.addColorStop(1, BRASS[1]);
  g.lineWidth = t; g.strokeStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
}
/** the brass ring on the free end of a chain, centred at (x, y) */
export const paintRing = (g: Ctx, x: number, y: number) => ringAt(g, x, y, 2.8, 1.1);
/** a brass chain from (x, y0) down to y1: alternating face-on and edge-on links */
export function paintChain(g: Ctx, x: number, y0: number, y1: number) {
  const P = 2.17;
  for (let i = 0, y = y0; y < y1; i++, y += P) {
    if (i % 2) { g.fillStyle = INK; g.fillRect(x - 0.55, y - 0.4, 1.1, P + 0.8); g.fillStyle = BRASS[2]; g.fillRect(x - 0.2, y - 0.1, 0.4, P + 0.2); }
    else {
      g.lineWidth = 0.95; g.strokeStyle = INK; g.beginPath(); g.ellipse(x, y + P / 2, 0.95, 1.55, 0, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 0.45; g.strokeStyle = BRASS[3]; g.beginPath(); g.ellipse(x, y + P / 2, 0.95, 1.55, 0, 0, Math.PI * 2); g.stroke();
    }
  }
}

/** The shelf's stand: a walnut plinth with two turned posts under the case (top at G.base.y1, plinth top at `y`). */
export function paintStand(g: Ctx, y: number) {
  for (const sd of [-1, 1]) {
    const x = CX + sd * 47, t = G.base.y1 - 1, hgt = y - t;
    const pts: Pt[] = [];
    const prof = [[3.6, 0], [4.4, 0.06], [2.8, 0.14], [2.4, 0.3], [4.2, 0.5], [2.4, 0.68], [2.6, 0.84], [4.4, 0.93], [4.6, 1]];
    for (const [r, f] of prof) pts.push([x + r, t + f * hgt]);
    for (const [r, f] of [...prof].reverse()) pts.push([x - r, t + f * hgt]);
    part(g, sh().poly(pts), wal({ grain: 0.5, rim: 0.9, ink: 0.85, cast: 1.2 }));
  }
  const pl = sh().poly([[CX - 66, y], [CX + 66, y], [CX + 68, y + 3], [CX + 68, y + 8], [CX - 68, y + 8], [CX - 68, y + 3]]);
  part(g, pl, wal({ dir: Math.PI / 2, rim: 1, ink: 0.9, cast: 1 }));
}

// ------------------------------------------------------------------ finishing a layer

/**
 * Finish a painted layer: a bold ink outline round its whole silhouette (r art units) and, optionally, a soft shadow
 * on the wall behind it. Returns a new canvas the same size.
 */
export function finish(src: HTMLCanvasElement, k: number, r: number, shadow: { dx: number; dy: number; blur: number; a: number } | null = null): HTMLCanvasElement {
  const out = mk(src.width, src.height), g = ctx2(out);
  const inkC = mk(src.width, src.height), ig = ctx2(inkC);
  ig.drawImage(src, 0, 0); ig.globalCompositeOperation = 'source-in'; ig.fillStyle = INK; ig.fillRect(0, 0, inkC.width, inkC.height);
  if (shadow) {
    g.save();
    g.shadowColor = `rgba(4,10,6,${shadow.a})`; g.shadowBlur = shadow.blur * k; g.shadowOffsetX = shadow.dx * k + 8000; g.shadowOffsetY = shadow.dy * k;
    g.drawImage(inkC, -8000, 0);
    g.restore();
  }
  const R = r * k, n = Math.max(8, Math.min(24, Math.round(R * 3)));
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.drawImage(inkC, Math.cos(a) * R, Math.sin(a) * R); }
  g.drawImage(src, 0, 0);
  return out;
}
/** A canvas for the art-unit box (x, y, w, h) at k px per unit, with its context set up to draw in art units. */
export function layer(x: number, y: number, w: number, h: number, k: number): [HTMLCanvasElement, Ctx] {
  const c = mk(w * k, h * k), g = ctx2(c);
  g.setTransform(k, 0, 0, k, -x * k, -y * k);
  g.lineJoin = 'round';
  return [c, g];
}

// ------------------------------------------------------------------ the loading screen (inlined into index.html)

/**
 * Paint the loading clock into #boot's canvases at the screen's resolution and keep them crisp when the screen
 * changes. Exposes window.__hhClock = { door(state, owl), k } for src/onboard/boot.ts.
 */
export function bootMain() {
  const b = document.getElementById('boot');
  if (!b) return;
  const q = <T extends Element>(s: string) => b.querySelector<T>(s);
  let painted = 0;
  let doorState: [DoorState, OwlPose | null] = ['closed', null];
  const put = (c: HTMLCanvasElement | null, src: HTMLCanvasElement) => { if (!c) return; c.width = src.width; c.height = src.height; ctx2(c).drawImage(src, 0, 0); };
  const paintDoor = (k: number) => {
    const c = q<HTMLCanvasElement>('.bt-door');
    if (!c) return;
    const D = DOOR_BOX, [t, g] = layer(D.x, D.y, D.w, D.h, k);
    paintDoorway(g, doorState[0], doorState[1]);
    put(c, t);
  };
  const paint = () => {
    const css = parseFloat(getComputedStyle(b).fontSize) || 2;
    const k = Math.min(9, css * Math.min(3, devicePixelRatio || 1));
    if (painted && Math.abs(k / painted - 1) < 0.15) return;
    painted = k;
    try {
      { const B = CASE_BOX, [c, g] = layer(B.x, B.y, B.w, B.h, k); paintCase(g, { dial: true }); put(q('.bt-case'), finish(c, k, 1.15, { dx: 4, dy: 7, blur: 7, a: 0.6 })); }
      paintDoor(k);
      const dk = Math.min(16, k * 2.2), R = G.dial.bez + 1;
      { const [c, g] = layer(CX - R, G.dial.y - R, R * 2, R * 2, dk); paintDial(g); put(q('.bt-dial'), c); }
      for (const kind of ['hour', 'minute'] as const) {
        const L = HANDS.minute + 2, [c, g] = layer(CX - L, G.dial.y - L, L * 2, L * 2, dk);
        paintHand(g, CX, G.dial.y, kind); if (kind === 'minute') paintBoss(g);
        put(q(kind === 'hour' ? '.bt-hh' : '.bt-mh'), c);
      }
      { const P = PEND_BOX(), [c, g] = layer(P.x, P.y, P.w, P.h, k); paintPendulum(g); put(q('.bt-pend'), finish(c, k, 1, { dx: 3, dy: 5, blur: 5, a: 0.45 })); }
      { const [c, g] = layer(CX - 10, G.wTop - 92, 20, 92 + 44, k); paintChain(g, CX, G.wTop - 92, G.wTop + 0.5); paintCone(g, CX, G.wTop); const f = finish(c, k, 0.9, { dx: 2.5, dy: 4, blur: 4, a: 0.45 }); b.querySelectorAll<HTMLCanvasElement>('.bt-wt').forEach((e) => put(e, f)); }
      { const [c, g] = layer(CX - 6, G.rBot - 100, 12, 106, k); paintChain(g, CX, G.rBot - 100, G.rBot - 2.6); paintRing(g, CX, G.rBot); const f = finish(c, k, 0.6); b.querySelectorAll<HTMLCanvasElement>('.bt-rg').forEach((e) => put(e, f)); }
    } catch { /* the CSS background still shows */ }
  };
  paint();
  addEventListener('resize', paint);
  (window as unknown as { __hhClock: unknown }).__hhClock = {
    door(state: DoorState, owl: OwlPose | null) { doorState = [state, owl]; if (painted) paintDoor(painted); },
  };
}
