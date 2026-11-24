// [look4] Hoot Hollow's leaf atlas, painted leaf by leaf as pixel art (no photos, no filters): 4 x 4 cells of 256 px,
// each a dense cluster of hand-shaped leaves (oak lobes, maple palms, serrated birch, fir combs, pine tufts, fern
// fronds, blossom, elder umbels, boxwood, holly and berries, lilac), back leaves deeper, front leaves brighter, a
// one-pixel ink outline and a midrib on every leaf, colours picked from short hue-shifted ramps (no smooth
// gradients). Baked AO only (inner leaves darker); no directional light is painted in.
//
//   node_modules/.bin/vite-node art/leaves/paint.ts <out.png>
// then convert to public/textures/leaves.webp (lossless). The cell layout is LEAF_CELL in src/world/foliage.ts.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CELL = 256, COLS = 4, W = CELL * COLS, H = CELL * COLS;
const img = new Uint8ClampedArray(W * H * 4);

let seed = 1;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const range = (a: number, b: number) => a + (b - a) * rnd();
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
type RGB = [number, number, number];
type Ramp = RGB[];
const ramp = (...h: string[]): Ramp => h.map(hex);
const pick = (r: Ramp, t: number): RGB => r[Math.max(0, Math.min(r.length - 1, Math.round(t * (r.length - 1))))];

interface Box { x0: number; y0: number; x1: number; y1: number }
let clip: Box = { x0: 0, y0: 0, x1: W, y1: H };
function put(x: number, y: number, c: RGB, a = 255) {
  if (x < clip.x0 || y < clip.y0 || x >= clip.x1 || y >= clip.y1) return;
  const k = (y * W + x) * 4;
  img[k] = c[0]; img[k + 1] = c[1]; img[k + 2] = c[2]; img[k + 3] = a;
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, w = 1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) + 1;
  for (let i = 0; i <= n; i++) {
    const x = x0 + (x1 - x0) * (i / n), y = y0 + (y1 - y0) * (i / n);
    for (let dy = 0; dy < w; dy++) for (let dx = 0; dx < w; dx++) put(Math.floor(x + dx - (w - 1) / 2), Math.floor(y + dy - (w - 1) / 2), c);
  }
}
function disc(cx: number, cy: number, r: number, c: RGB) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
    if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) put(x, y, c);
  }
}

// ------------------------------------------------------------------ leaf shapes: half-width (0..1) along u (0 base .. 1 tip)
type Shape = (u: number) => number;
const ovate: Shape = (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.72)), 0.85);
const elliptic: Shape = (u) => Math.pow(Math.sin(Math.PI * u), 0.7);
const lance: Shape = (u) => Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 1.1) * (1 - u * 0.25);
const oakShape = (lobes: number, ph: number): Shape => (u) => ovate(u) * (0.62 + 0.38 * Math.abs(Math.sin(u * Math.PI * lobes + ph))) * (u < 0.08 ? u / 0.08 * 0.5 + 0.5 : 1);
const serrate = (s: Shape, teeth: number, depth: number): Shape => (u) => Math.max(0, s(u) - depth * (1 - ((u * teeth) % 1)) * s(u));
const hollyShape: Shape = (u) => elliptic(u) * (0.7 + 0.3 * Math.abs(Math.cos(u * Math.PI * 3.5)));

interface LeafOpts { x: number; y: number; ang: number; len: number; wid: number; shape: Shape; ramp: Ramp; tone: number; vein?: boolean; veins?: number; outline?: RGB; gloss?: boolean }
/** One leaf: two halves a tone apart (the fold), a midrib, side veins on big leaves, a dark outline, a lighter tip. */
function leaf(o: LeafOpts) {
  const dx = Math.cos(o.ang), dy = Math.sin(o.ang), hw = o.wid / 2;
  const tipx = o.x + dx * o.len, tipy = o.y + dy * o.len;
  const xs = [o.x, tipx, o.x - dy * hw, o.x + dy * hw, tipx - dy * hw, tipx + dy * hw], ys = [o.y, tipy, o.y + dx * hw, o.y - dx * hw, tipy + dx * hw, tipy - dx * hw];
  const x0 = Math.floor(Math.min(...xs)) - 1, x1 = Math.ceil(Math.max(...xs)) + 1, y0 = Math.floor(Math.min(...ys)) - 1, y1 = Math.ceil(Math.max(...ys)) + 1;
  const lightHalf = rnd() < 0.5 ? 1 : -1;
  const inside = (px: number, py: number) => {
    const rx = px - o.x, ry = py - o.y;
    const u = (rx * dx + ry * dy) / o.len, v = (-rx * dy + ry * dx) / hw;
    return u >= 0 && u <= 1 && Math.abs(v) <= o.shape(u);
  };
  const outline = o.outline ?? pick(o.ramp, 0);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (!inside(px, py)) continue;
    const rx = px - o.x, ry = py - o.y;
    const u = (rx * dx + ry * dy) / o.len, v = (-rx * dy + ry * dx) / hw;
    const edge = !inside(px + 1, py) || !inside(px - 1, py) || !inside(px, py + 1) || !inside(px, py - 1);
    if (edge) { put(x, y, outline); continue; }
    let t = o.tone + (Math.sign(v) === lightHalf ? 0.14 : -0.04) + (u - 0.5) * 0.12;
    if (o.vein !== false && Math.abs(v) * hw < 0.6 && u < 0.88 && u > 0.04) t -= 0.2;
    if (o.veins && o.vein !== false) {
      const s = (u - Math.abs(v) * 0.35) * o.veins;
      if (s % 1 < 1.2 / (o.len / o.veins) && Math.abs(v) < 0.8 && u > 0.12 && u < 0.85) t -= 0.12;
    }
    if (o.gloss && Math.sign(v) === lightHalf && Math.abs(v) > 0.25 && Math.abs(v) < 0.5 && u > 0.25 && u < 0.6) t += 0.22;
    put(x, y, pick(o.ramp, Math.max(0.12, Math.min(1, t))));
  }
}

/** A palmate maple leaf: five pointed lobes round the stalk, veins to each lobe tip. */
function maple(cx: number, cy: number, ang: number, r: number, rp: Ramp, tone: number) {
  const outline = pick(rp, 0);
  const R = (th: number) => {
    const a = th - ang;
    const lobe = Math.pow(Math.abs(Math.cos(a * 2.5)), 0.55);
    const serr = 0.05 * (1 - ((a * 9 / Math.PI + 10) % 1));
    const back = Math.cos(a) < -0.6 ? 0.55 : 1;
    return r * (0.5 + 0.5 * lobe - serr) * back;
  };
  const inside = (px: number, py: number) => { const rx = px - cx, ry = py - cy; return Math.hypot(rx, ry) <= R(Math.atan2(ry, rx)); };
  const lightSide = rnd() * Math.PI * 2;
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    const px = x + 0.5, py = y + 0.5;
    if (!inside(px, py)) continue;
    const edge = !inside(px + 1, py) || !inside(px - 1, py) || !inside(px, py + 1) || !inside(px, py - 1);
    if (edge) { put(x, y, outline); continue; }
    const th = Math.atan2(py - cy, px - cx), d = Math.hypot(px - cx, py - cy) / r;
    let t = tone + 0.12 * Math.cos(th - lightSide) + d * 0.08;
    // veins to the five lobe tips
    const a = th - ang, k = Math.round(a * 2.5 / Math.PI) * Math.PI / 2.5;
    if (Math.abs(Math.sin(a - k)) * d * r < 0.6 && d > 0.08) t -= 0.2;
    put(x, y, pick(rp, Math.max(0.12, Math.min(1, t))));
  }
  line(cx, cy, cx - Math.cos(ang) * r * 0.5, cy - Math.sin(ang) * r * 0.5, pick(rp, 0.1));
}

/** A five-petal blossom (cherry, apple), ~r px. */
function blossom(cx: number, cy: number, r: number, petals: Ramp, eye: RGB) {
  const rot = rnd() * Math.PI;
  for (let i = 0; i < 5; i++) {
    const a = rot + i * Math.PI * 2 / 5;
    const px = cx + Math.cos(a) * r * 0.55, py = cy + Math.sin(a) * r * 0.55;
    disc(px, py, r * 0.55, pick(petals, 0.15));
  }
  for (let i = 0; i < 5; i++) {
    const a = rot + i * Math.PI * 2 / 5;
    disc(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.42, pick(petals, 0.55 + rnd() * 0.45));
  }
  disc(cx, cy, Math.max(1, r * 0.22), eye);
}

// ------------------------------------------------------------------ cluster painters
function cellBox(i: number): Box & { cx: number; cy: number } {
  const c = i % COLS, r = Math.floor(i / COLS);
  return { x0: c * CELL + 2, y0: r * CELL + 2, x1: (c + 1) * CELL - 2, y1: (r + 1) * CELL - 2, cx: c * CELL + CELL / 2, cy: r * CELL + CELL / 2 };
}
interface Spot { x: number; y: number; ang: number; z: number }
/** Spots for leaves on a rounded, dense cluster: a few twigs from the middle (mostly hidden), leaves spread over the
 * whole disc pointing outwards, sorted back to front (z also sets the tone: inner and back leaves deeper). */
function clusterSpots(cx: number, cy: number, rad: number, n: number, twigs: number, twigCol: RGB): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < twigs; i++) {
    const a = (i / twigs) * Math.PI * 2 + range(-0.4, 0.4), l = rad * range(0.5, 0.8);
    line(cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l, twigCol, 2);
  }
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, s = Math.pow(rnd(), 0.6);
    const x = cx + Math.cos(a) * rad * s, y = cy + Math.sin(a) * rad * s;
    const ang = a + range(-0.8, 0.8);
    out.push({ x, y, ang, z: rnd() * 0.55 + s * 0.45 });
  }
  return out.sort((p, q) => p.z - q.z);
}

function broadleaf(i: number, rp: Ramp, o: { rad?: number; n: number; len: [number, number]; wid: number; shape: () => Shape; veins?: number; twigs?: number; gloss?: boolean; extra?: (b: ReturnType<typeof cellBox>) => void }) {
  const b = cellBox(i);
  clip = b;
  const twig = hex('#4a3626');
  // a dark under-layer so the cluster reads solid in the middle
  const spots = clusterSpots(b.cx, b.cy, o.rad ?? 84, o.n, o.twigs ?? 5, twig);
  for (const s of spots) {
    const len = range(o.len[0], o.len[1]);
    leaf({ x: s.x - Math.cos(s.ang) * len * 0.35, y: s.y - Math.sin(s.ang) * len * 0.35, ang: s.ang, len, wid: len * o.wid * range(0.85, 1.1), shape: o.shape(), ramp: rp, tone: 0.16 + s.z * 0.66, veins: o.veins, gloss: o.gloss });
  }
  o.extra?.(b);
  clip = { x0: 0, y0: 0, x1: W, y1: H };
}

function maples(i: number, rp: Ramp) {
  const b = cellBox(i);
  clip = b;
  const spots = clusterSpots(b.cx, b.cy, 88, 84, 5, hex('#5a2a1e'));
  for (const s of spots) maple(s.x, s.y, s.ang, range(18, 26), rp, 0.16 + s.z * 0.64);
  clip = { x0: 0, y0: 0, x1: W, y1: H };
}

/** Conifer sprays: twigs fanning from the base, needles in a comb (fir) or long fans (pine), two layers deep. */
function needles(i: number, rp: Ramp, pine: boolean) {
  const b = cellBox(i);
  clip = b;
  const twig = hex('#4a3020');
  const items: { x: number; y: number; a: number; l: number; z: number }[] = [];
  for (const layer of [0, 1]) {
    const sprays = pine ? 10 : 12;
    for (let k = 0; k < sprays; k++) {
      const f = (k + (layer ? 0.5 : 0)) / sprays - 0.5;
      const a = -Math.PI / 2 + f * 2.9 + range(-0.12, 0.12);
      items.push({ x: b.cx + range(-14, 14), y: b.cy + 92 + range(-8, 8), a, l: range(150, 190) * (1 - Math.abs(f) * 0.42) * (layer ? 0.85 : 1), z: layer * 0.5 + rnd() * 0.5 });
    }
  }
  items.sort((p, q) => p.z - q.z);
  for (const it of items) {
    const tone = 0.2 + it.z * 0.65;
    const ex = it.x + Math.cos(it.a) * it.l, ey = it.y + Math.sin(it.a) * it.l;
    line(it.x, it.y, ex, ey, twig, 2);
    const steps = Math.floor(it.l / (pine ? 8 : 4));
    for (let s = 2; s <= steps; s++) {
      const f = s / steps, x = it.x + (ex - it.x) * f, y = it.y + (ey - it.y) * f;
      if (pine) {
        // bundles of long needles fanning forward, densest towards the tip
        const nb = 9;
        for (let q = 0; q < nb; q++) {
          const aa = it.a + (q / (nb - 1) - 0.5) * 2.0 * (0.6 + f * 0.4);
          const nl = range(20, 32) * (0.75 + f * 0.45);
          const t = tone + (q % 2 ? 0.12 : -0.04) + f * 0.12;
          line(x, y, x + Math.cos(aa) * nl, y + Math.sin(aa) * nl, pick(rp, t), q % 3 === 0 ? 2 : 1);
        }
      } else {
        // flat two-ranked needles, shorter at the tip, lit edge on one side
        const nl = (1 - f * 0.4) * range(17, 22);
        for (const sd of [-1, 1]) {
          const aa = it.a + sd * range(0.8, 1.05);
          const t = tone + (sd > 0 ? 0.12 : -0.03) + (s % 3 === 0 ? 0.08 : 0);
          line(x, y, x + Math.cos(aa) * nl, y + Math.sin(aa) * nl, pick(rp, t), 2);
          line(x + Math.cos(aa) * nl * 0.55, y + Math.sin(aa) * nl * 0.55, x + Math.cos(aa) * nl, y + Math.sin(aa) * nl, pick(rp, t + 0.12));
        }
        if (f > 0.86) for (const sd of [-1, 1]) { const aa = it.a + sd * 0.75; line(x, y, x + Math.cos(aa) * 9, y + Math.sin(aa) * 9, pick(rp, 1), 2); }
      }
    }
  }
  clip = { x0: 0, y0: 0, x1: W, y1: H };
}

/** An upright fern frond filling the cell: a curving rachis and lobed pinnae shrinking to the tip. */
function fern(i: number, rp: Ramp) {
  const b = cellBox(i);
  clip = b;
  const n = 26, base = { x: b.cx, y: b.y1 - 4 };
  const pts: [number, number][] = [];
  for (let k = 0; k <= n; k++) { const f = k / n; pts.push([base.x + Math.sin(f * 1.4) * 26 * f, base.y - f * 240]); }
  for (let k = 2; k < n; k++) {
    const f = k / n, [x, y] = pts[k];
    const L = (1 - f) * 80 + 14, ta = Math.atan2(pts[k + 1][1] - y, pts[k + 1][0] - x);
    for (const sd of [-1, 1]) {
      const a = ta + sd * (1.25 - f * 0.35);
      leaf({ x, y, ang: a, len: L, wid: Math.min(18, L * 0.3), shape: serrate(lance, Math.max(4, Math.round(L / 6)), 0.35), ramp: rp, tone: 0.42 + f * 0.35 + (sd > 0 ? 0.08 : 0), vein: true });
    }
  }
  for (let k = 0; k < n; k++) line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], pick(rp, 0.15), 2);
  clip = { x0: 0, y0: 0, x1: W, y1: H };
}

/** Dense small leaves filling a disc (boxwood hedge) or the whole cell (the dark inside of a canopy). */
function tiny(i: number, rp: Ramp, o: { n: number; len: [number, number]; full?: boolean; tone?: [number, number] }) {
  const b = cellBox(i);
  clip = b;
  if (o.full) for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) put(x, y, pick(rp, 0.1));
  for (let k = 0; k < o.n; k++) {
    const a = rnd() * Math.PI * 2, r = o.full ? 0 : Math.sqrt(rnd()) * 100;
    const x = o.full ? range(b.x0 - 6, b.x1 + 6) : b.cx + Math.cos(a) * r, y = o.full ? range(b.y0 - 6, b.y1 + 6) : b.cy + Math.sin(a) * r;
    const len = range(o.len[0], o.len[1]);
    const [t0, t1] = o.tone ?? [0.25, 0.95];
    leaf({ x, y, ang: rnd() * Math.PI * 2, len, wid: len * 0.6, shape: elliptic, ramp: rp, tone: t0 + (t1 - t0) * (k / o.n), vein: len > 9 });
  }
  clip = { x0: 0, y0: 0, x1: W, y1: H };
}

// ------------------------------------------------------------------ palettes (dark .. light), rich and saturated
const R = {
  oakA: ramp('#142e14', '#1f4a1c', '#2e6824', '#428a2c', '#5fa838', '#86c64a', '#b4e06a'),
  oakB: ramp('#1a3a12', '#28581a', '#3a7822', '#50962a', '#6cb236', '#90cc48', '#bce472'),
  maple: ramp('#163618', '#225424', '#32742c', '#4a9436', '#68b240', '#8ecc52', '#bce67a'),
  birch: ramp('#264416', '#3a621c', '#528424', '#6ca42e', '#8ac23c', '#acd654', '#d6ee86'),
  amber: ramp('#4a1e0a', '#743210', '#a24c16', '#cc6c1e', '#ea9028', '#f8b844', '#ffdc80'),
  copper: ramp('#4a1a0c', '#7a2a10', '#a83e16', '#d0581e', '#ec7a2a', '#f8a046', '#ffc878'),
  crimson: ramp('#3c0a10', '#661416', '#94201c', '#c03424', '#e0522e', '#f47e44', '#ffaa6a'),
  gold: ramp('#4a360c', '#745612', '#a07a18', '#c8a020', '#e6c230', '#f6dc52', '#fff294'),
  petal: ramp('#8a2c4c', '#b84a6e', '#dc7094', '#f09cb8', '#fcc4d6', '#ffe4ee', '#fff8fb'),
  bronze: ramp('#2a2a12', '#3e4416', '#566220', '#70802a', '#8ea036', '#b0bc4c'),
  fir: ramp('#0a221c', '#103426', '#164a32', '#1e6440', '#2a7e4e', '#3c9a60', '#62b87e'),
  pine: ramp('#142a12', '#1e3e18', '#2a5620', '#38702a', '#4a8c34', '#64a842', '#8cc45a'),
  fern: ramp('#143212', '#1e4c18', '#2c6a20', '#3e8a2a', '#56a836', '#78c448', '#a6de6a'),
  elder: ramp('#1a3416', '#26501e', '#367028', '#4a8e32', '#62aa3c', '#84c452'),
  cream: ramp('#b8a870', '#dcd09c', '#f2ecc8', '#fffbe6'),
  hedge: ramp('#10280e', '#1a3e16', '#26581e', '#347428', '#469032', '#60ac40', '#86c85a'),
  inner: ramp('#0a1c0a', '#10280e', '#163614', '#1e4618', '#28581e', '#346a26'),
  holly: ramp('#06180c', '#0c2814', '#123c1c', '#1a5226', '#246a32', '#348444', '#58a866'),
  berry: ramp('#4a060a', '#8c0e14', '#c8201e', '#f04a36', '#ff9a80'),
  lilac: ramp('#2e1e58', '#4a3488', '#6a50b4', '#8c72d4', '#b09ae8', '#d4c6f6', '#f0eaff'),
};

seed = 101;
broadleaf(0, R.oakA, { n: 120, len: [36, 50], wid: 0.62, shape: () => oakShape(range(3, 4.2), range(0, 1)), veins: 5 });
seed = 202;
broadleaf(1, R.oakB, { n: 130, len: [32, 46], wid: 0.6, shape: () => oakShape(range(3, 4.2), range(0, 1)), veins: 5 });
seed = 303;
maples(2, R.maple);
seed = 404;
broadleaf(3, R.birch, { n: 210, len: [22, 32], wid: 0.68, shape: () => serrate(ovate, 9, 0.12), twigs: 7 });
// row 1: the autumn colours of row 0, leaf for leaf (same seeds)
seed = 101;
broadleaf(4, R.amber, { n: 120, len: [36, 50], wid: 0.62, shape: () => oakShape(range(3, 4.2), range(0, 1)), veins: 5 });
seed = 202;
broadleaf(5, R.copper, { n: 130, len: [32, 46], wid: 0.6, shape: () => oakShape(range(3, 4.2), range(0, 1)), veins: 5 });
seed = 303;
maples(6, R.crimson);
seed = 404;
broadleaf(7, R.gold, { n: 210, len: [22, 32], wid: 0.68, shape: () => serrate(ovate, 9, 0.12), twigs: 7 });
seed = 707;
broadleaf(8, R.bronze, { n: 70, len: [26, 36], wid: 0.55, shape: () => serrate(ovate, 8, 0.1), twigs: 6, extra: (b) => {
  for (let k = 0; k < 120; k++) { const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.6) * 92; blossom(b.cx + Math.cos(a) * r, b.cy + Math.sin(a) * r, range(7, 10), R.petal, hex('#d4486e')); }
} });
seed = 808;
needles(9, R.fir, false);
seed = 909;
needles(10, R.pine, true);
seed = 1010;
fern(11, R.fern);
seed = 1111;
broadleaf(12, R.elder, { n: 110, len: [34, 48], wid: 0.42, shape: () => serrate(lance, 10, 0.1), twigs: 5, extra: (b) => {
  // flat umbels of tiny cream flowers
  for (let k = 0; k < 14; k++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 74, ux = b.cx + Math.cos(a) * r, uy = b.cy + Math.sin(a) * r;
    for (let q = 0; q < 34; q++) { const aa = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * 20; disc(ux + Math.cos(aa) * rr, uy + Math.sin(aa) * rr * 0.8, range(1.6, 2.6), pick(R.cream, 0.3 + rnd() * 0.7)); }
  }
} });
seed = 1212;
tiny(13, R.hedge, { n: 1500, len: [11, 16] });
seed = 1414;
broadleaf(14, R.holly, { n: 110, len: [32, 44], wid: 0.55, shape: () => hollyShape, twigs: 5, gloss: true, extra: (b) => {
  for (let k = 0; k < 22; k++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 74, bx = b.cx + Math.cos(a) * r, by = b.cy + Math.sin(a) * r;
    for (let q = 0; q < 3; q++) { const x = bx + range(-6, 6), y = by + range(-6, 6); disc(x, y, 4.2, pick(R.berry, 0.1)); disc(x, y, 3.2, pick(R.berry, 0.55)); put(Math.floor(x - 1), Math.floor(y - 1), pick(R.berry, 1)); }
  }
} });
seed = 1515;
broadleaf(15, R.elder, { n: 90, len: [32, 44], wid: 0.55, shape: () => ovate, twigs: 5, extra: (b) => {
  // lilac panicles: cones of little four-petal florets
  for (let k = 0; k < 11; k++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 66, px = b.cx + Math.cos(a) * r, py = b.cy + Math.sin(a) * r;
    const ang = -Math.PI / 2 + range(-0.6, 0.6), L = range(44, 62);
    for (let q = 0; q < 130; q++) {
      const f = rnd(), w = (1 - f) * 18 + 4;
      const x = px + Math.cos(ang) * L * f + range(-w, w) * Math.sin(ang), y = py + Math.sin(ang) * L * f - range(-w, w) * Math.cos(ang);
      const c = pick(R.lilac, 0.25 + rnd() * 0.75);
      disc(x, y, 2.2, pick(R.lilac, 0.1)); put(Math.floor(x), Math.floor(y), c); put(Math.floor(x) + 1, Math.floor(y), c); put(Math.floor(x), Math.floor(y) + 1, c);
    }
  }
} });

// ------------------------------------------------------------------ bleed colour into the transparent texels (clean mips)
for (let pass = 0; pass < 6; pass++) {
  const src = img.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = (y * W + x) * 4;
    if (src[k + 3] > 0 || (pass > 0 && src[k] + src[k + 1] + src[k + 2] > 0)) continue;
    let r = 0, g = 0, bl = 0, n = 0;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + ox, yy = y + oy;
      if (xx < 0 || yy < 0 || xx >= W || yy >= H || Math.floor(xx / CELL) !== Math.floor(x / CELL) || Math.floor(yy / CELL) !== Math.floor(y / CELL)) continue;
      const q = (yy * W + xx) * 4;
      if (src[q + 3] === 0 && src[q] + src[q + 1] + src[q + 2] === 0) continue;
      r += src[q]; g += src[q + 1]; bl += src[q + 2]; n++;
    }
    if (n) { img[k] = r / n; img[k + 1] = g / n; img[k + 2] = bl / n; }
  }
}

// ------------------------------------------------------------------ PNG out
function png(w: number, h: number, rgba: Uint8ClampedArray): Buffer {
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
writeFileSync(process.argv[2] ?? 'leaves.png', png(W, H, img));
console.log('wrote', process.argv[2] ?? 'leaves.png');
