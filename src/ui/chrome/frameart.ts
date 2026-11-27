// [ui5, ui7, profile] The portrait frames (a cosmetic, see src/assets/frames.ts), remade as fourteen crafted objects, each
// modelled part by part with the material painter (src/ui/real/paint.ts) at the screen's own resolution and lit like
// everything else (a warm key from the upper left, soft steps, violet shadows, an ink outline), with a silhouette of
// its own so it reads at the name sign's size:
//   walnut       carved walnut: a cushion moulding, a gilt bead at the opening, a wreath of honey-oak leaves and acorns
//   porthole     a cast brass ship's porthole: hex bolts, a hinge lug on the left, a wing-nut dog on the right, glass
//   moss         two willow withies twisted into a ring, cushions of moss, little bonnet mushrooms, a fern crozier
//   knit         a ring knitted in cranberry wool (stockinette Vs, a cable up the middle), a wooden toggle, a pompom
//   filigree     silver filigree: a rope rim, curling S-scrolls of wire, a milgrain edge, pearls and a sapphire
//   mushroom     a fairy ring: turf with grass blades and clover, fly agarics standing up round the outside
//   laurel       two gilt laurel branches with berries meeting at the top, a red silk bow and tails below
//   frost        clear ice with feathery frost dendrites growing out of it, three snowflake crystals
//   celestial    an orrery: engraved brass scale rings round midnight enamel, a rayed sun, a silver moon, a ringed planet
//   gingerbread  a scalloped biscuit ring piped with royal icing, glossy gumdrops, a candy cane
//   starry       a ring of night sky between gold rims, gold stars breaking out of it, a crescent and a shooting star
//   honeycomb    beeswax cells, some full of honey, some capped, honey dripping off the bottom, a bee
//   stained      a rose window: limestone tracery round jewel-coloured leaded glass, cusped all round
//   driftwood    a sea-bleached driftwood ring, bound with hemp, a starfish, a scallop shell and sea glass
// The opening is cut clear: the owl (or the studio photo) shows through it over a little painted sky.
import {
  BRASS_OLD, COPPER, GOLD, Real, SILVER, cached, circle, clamp, cloth, curve, deviceK, dome, ellipse, enamel, fbm, glass, hex, metal, mix, paperMat,
  polygon, ring, rotate, segment, spiralPts, subtract, union, vnoise, warp, wood, type Material, type RGB, type SDF,
} from '../real/paint.ts';
import { texReady } from '../real/tex.ts';

/** design units across a frame */
export const FRAME_D = 38;
const C = FRAME_D / 2;
/** the opening's radius in design units (the owl shows inside it) */
export const FRAME_OPEN = 12.6;
const R1 = 17.4;
const mid = (FRAME_OPEN + R1) / 2, half = (R1 - FRAME_OPEN) / 2;

const at = (a: number, r: number): [number, number] => [C + Math.cos(a) * r, C + Math.sin(a) * r];
const rad = (x: number, y: number) => Math.hypot(x - C, y - C);
const ang = (x: number, y: number) => Math.atan2(y - C, x - C);
const band = (r0 = FRAME_OPEN - 0.4, r1 = R1) => ring(C, C, r0, r1);
/** a round ring's cross-section: a half-round (torus) of height h over the band */
const torusH = (h: number, rm = mid, hw = half, base = 0) => (x: number, y: number) => base + h * Math.sqrt(Math.max(0, 1 - ((rad(x, y) - rm) / hw) ** 2));
/** a radial profile: f(t), t = 0 at r0 .. 1 at r1 */
const prof = (r0: number, r1: number, f: (t: number) => number) => (x: number, y: number) => f(clamp((rad(x, y) - r0) / (r1 - r0)));
const leaf = (cx: number, cy: number, len: number, wid: number, a: number): SDF => rotate(ellipse(cx, cy, len / 2, wid / 2), a, cx, cy);
/** a pointed leaf (two arcs meeting at both ends) from (x, y) pointing along `a` */
function pointed(x: number, y: number, len: number, wid: number, a: number): SDF {
  const ca = Math.cos(a), sa = Math.sin(a);
  const f = ((px: number, py: number) => {
    const u = (px - x) * ca + (py - y) * sa, v = -(px - x) * sa + (py - y) * ca, t = u / len;
    if (t <= 0 || t >= 1) return Math.min(Math.hypot(u, v), Math.hypot(u - len, v)) + 0.01;
    const w = (wid / 2) * Math.pow(Math.sin(t * Math.PI), 0.85) * (1 - 0.15 * t);
    return (Math.abs(v) - w) * 0.85;
  }) as SDF;
  f.bb = [x - len - 1, y - len - 1, x + len + 1, y + len + 1];
  return f;
}
function star(cx: number, cy: number, R: number, r0 = 0.45, rot = -Math.PI / 2, n = 5): SDF {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) { const a = rot + (i / (n * 2)) * Math.PI * 2, rr = i % 2 ? R * r0 : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return polygon(pts);
}
/** a raised star: each arm a ridge from its tip to the middle (a cast or carved star) */
const starH = (cx: number, cy: number, R: number, h: number, base: number) => (x: number, y: number) => base + h * (1 - Math.min(1, Math.hypot(x - cx, y - cy) / R)) ** 0.7;
const gold = (p = 0.8) => metal(GOLD, { polish: p });
const silver = (p = 0.85) => metal(SILVER, { polish: p });
const brass = (p = 0.7) => metal(BRASS_OLD, { polish: p });
const matte = (c: string, o: Partial<Material> = {}): Material => ({ alb: () => hex(c), spec: 0.1, shin: 8, ...o });
const pearl: (x: number, y: number) => Material = (x, y) => ({ alb: (px, py) => mix(hex('#fffaf2'), hex('#d8ccd2'), clamp(Math.hypot(px - x + 0.4, py - y + 0.4) / 1.8)) as RGB, spec: 1, shin: 60, coat: 0.9 });

type Paint = (r: Real) => void;
const PAINT: Record<string, Paint> = {
  // ---------------------------------------------------------------- carved walnut (the default)
  walnut: (r) => {
    const r0 = FRAME_OPEN + 1.3, fm = (r0 + R1 - 0.5) / 2, fh = (R1 - 0.5 - r0) / 2;
    const field = torusH(2.2, fm, fh, 0.9);
    r.part(band(r0 - 0.2, R1 - 0.5), field, wood('walnut', { along: 'x', scale: 5 }));
    // a dark cove, then the gilt bead round the opening
    r.part(ring(C, C, FRAME_OPEN + 0.8, r0 + 0.1), 0.5, wood('ebony', { scale: 6 }));
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 1.0), torusH(1.3, FRAME_OPEN + 0.3, 0.7, 0.9), gold(0.85), { line: true });
    // the beaded outer edge
    r.part(ring(C, C, R1 - 1.3, R1), torusH(1.1, R1 - 0.65, 0.65, 0.4), wood('walnut', { along: 'x', scale: 5, ox: 20 }));
    for (let i = 0; i < 34; i++) { const [x, y] = at((i / 34) * Math.PI * 2, R1 - 0.65); r.part(circle(x, y, 0.58), dome(x, y, 0.58, 0.58, 0.6, 1.2), wood('cherry', { scale: 6, ox: i * 3 }), { line: 0.8 }); }
    // oak leaves laid round the ring, each pointing on round it, and a pair of acorns between them
    const oakLeaf = (cx: number, cy: number, len: number, wid: number, a: number): SDF => {
      const ca = Math.cos(a), sa = Math.sin(a), h = len / 2;
      const f = ((x: number, y: number) => {
        const u = (x - cx) * ca + (y - cy) * sa, v = -(x - cx) * sa + (y - cy) * ca, t = u / h;
        if (t <= -1 || t >= 1) return Math.hypot(Math.max(0, Math.abs(u) - h), v);
        const lobes = 0.74 + 0.26 * Math.abs(Math.cos(t * Math.PI * 2.5));
        return (Math.abs(v) - (wid / 2) * Math.pow(Math.cos(t * Math.PI / 2), 0.7) * lobes) * 0.8;
      }) as SDF;
      f.bb = [cx - h - 1, cy - h - 1, cx + h + 1, cy + h + 1];
      return f;
    };
    const N = 5;
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2 + 0.1, [x, y] = at(a, fm + 0.1), tang = a + Math.PI / 2;
      r.part(oakLeaf(x, y, 8.6, 4.1, tang), (px, py, ins) => field(px, py) + 0.6 + Math.min(1, ins * 1.1), { ...wood('honey', { along: 'x', scale: 6, ox: i * 17 }), coat: 0.5 }, { line: true });
      const ux = Math.cos(tang), uy = Math.sin(tang);
      r.carve(segment(x - ux * 3.1, y - uy * 3.1, x + ux * 2.9, y + uy * 2.9, 0.13), 0.45, 0.16);
      for (const t of [-1.6, -0.2, 1.3]) for (const sd of [-1, 1]) {
        const bx = x + ux * t, by = y + uy * t;
        r.carve(segment(bx, by, bx + ux * 0.6 - uy * sd * 0.9, by + uy * 0.6 + ux * sd * 0.9, 0.08), 0.24, 0.1);
      }
      const b0 = a + (Math.PI * 2) / N / 2 + 0.06;
      for (const [da, dr] of [[-0.08, -0.95], [0.09, 0.95]] as [number, number][]) {
        const [nx, ny] = at(b0 + da, fm + dr), rd = Math.atan2(ny - C, nx - C), tilt = dr > 0 ? 0.5 : -0.5;
        const dx = Math.cos(rd + tilt), dy = Math.sin(rd + tilt);
        r.part(rotate(ellipse(nx + dx * 0.42, ny + dy * 0.42, 1.15, 0.88), rd + tilt, nx + dx * 0.42, ny + dy * 0.42), (px, py) => field(px, py) + 0.3 + dome(nx + dx * 0.42, ny + dy * 0.42, 1.15, 1.15, 0.85)(px, py, 0), { ...wood('honey', { scale: 8, ox: i * 9 }), coat: 0.7, spec: 0.5, shin: 40 }, { line: true });
        r.part(rotate(ellipse(nx - dx * 0.44, ny - dy * 0.44, 0.7, 1.02), rd + tilt, nx - dx * 0.44, ny - dy * 0.44), (px, py) => field(px, py) + 0.5 + dome(nx - dx * 0.44, ny - dy * 0.44, 1.0, 1.0, 0.6)(px, py, 0), wood('walnut', { scale: 7, ox: i * 5 }), { line: true });
        for (let q = 0; q < 3; q++) r.carve(circle(nx - dx * (0.25 + 0.2 * q), ny - dy * (0.25 + 0.2 * q), 0.14), 0.2, 0.1);
      }
    }
  },

  // ---------------------------------------------------------------- the brass porthole
  porthole: (r) => {
    const cast = metal(BRASS_OLD, { polish: 0.62 }), bright = gold(0.9);
    // the hinge lug (left) and the dog clamp's lug (right), cast with the ring
    const lugs = union(rotate(polygon([[C - R1 - 0.6, C - 2.1], [C - R1 + 3, C - 3.2], [C - R1 + 3, C + 3.2], [C - R1 - 0.6, C + 2.1]]), 0, C, C), polygon([[C + R1 + 0.9, C - 1.6], [C + R1 - 3, C - 2.8], [C + R1 - 3, C + 2.8], [C + R1 + 0.9, C + 1.6]]));
    r.part(lugs, (x, y, ins) => 1.2 + Math.min(1.6, ins * 1.2), cast, { line: true });
    // the ring: a broad rounded lip outside, a flat face with bolts, a raised collar at the glass
    const face = prof(FRAME_OPEN + 1.4, R1, (t) => 2.6 + (t > 0.78 ? Math.sqrt(1 - ((t - 0.78) / 0.22) ** 2) - 1 : 0) * 1.6 + (t < 0.12 ? -0.6 * (1 - t / 0.12) : 0));
    r.part(band(FRAME_OPEN + 1.2, R1), face, cast);
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 1.6), torusH(2.0, FRAME_OPEN + 0.6, 1.0, 1.6), bright, { line: true });
    // hex bolt heads with washers
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 8 + (i * Math.PI) / 4, [x, y] = at(a, mid + 0.75);
      r.part(circle(x, y, 1.05), 3.0, brass(0.5), { line: 0.8 });
      const hx: [number, number][] = [];
      for (let k = 0; k < 6; k++) { const b = a + 0.3 + (k * Math.PI) / 3; hx.push([x + Math.cos(b) * 0.82, y + Math.sin(b) * 0.82]); }
      r.part(polygon(hx), (px, py) => 3.3 + 0.6 * (1 - Math.min(1, Math.hypot(px - x, py - y) / 0.82)), bright, { line: 0.8 });
    }
    // the hinge: a knuckle and its pin on the left lug; the dog: a wing nut on the right one
    const hx0 = C - R1 + 0.6;
    r.part(segment(hx0, C - 2.6, hx0, C + 2.6, 0.95), (x) => 2.4 + 0.9 * Math.sqrt(Math.max(0, 1 - ((x - hx0) / 0.95) ** 2)), bright, { line: true });
    r.carve(segment(hx0 - 0.9, C - 0.9, hx0 + 0.9, C - 0.9, 0.08), 0.4, 0.1); r.carve(segment(hx0 - 0.9, C + 0.9, hx0 + 0.9, C + 0.9, 0.08), 0.4, 0.1);
    const wx = C + R1 - 0.2;
    r.part(circle(wx, C, 1.1), dome(wx, C, 1.1, 1.1, 0.9, 3), bright, { line: true });
    r.part(union(ellipse(wx, C - 1.8, 0.75, 1.3), ellipse(wx, C + 1.8, 0.75, 1.3)), (x, y) => 3.4 + 0.5 * (1 - Math.abs(y - C) / 3), bright, { line: true });
  },

  // ---------------------------------------------------------------- the mossy willow ring
  moss: (r) => {
    const bark = (seed: number): Material => ({ alb: (x, y) => { const a = ang(x, y) * 14, d = rad(x, y); const v = vnoise(a * 1.8 + seed, d * 3, 5 + seed); const lent = vnoise(a * 6, d * 8, 9 + seed) > 0.86 ? 0.25 : 0; return mix(hex('#5a3c22'), hex('#a8845a'), clamp(v * 1.1 - 0.05 + lent)) as RGB; }, spec: 0.1, shin: 8 });
    // two withies twisted round each other: each strand wanders in and out of the ring; the nearer one draws on top
    const strand = (ph: number, seed: number, over: boolean) => {
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 120; i++) { const a = (i / 120) * Math.PI * 2, rr = mid + Math.sin(a * 5 + ph) * 1.25; pts.push([...at(a, rr), 1.35 - Math.cos(a * 5 + ph) * 0.15]); }
      const s = curve(pts);
      r.part(s, (x, y, ins) => (over ? 2.4 : 1.6) + Math.min(1.3, ins * 1.1) + Math.sin(ang(x, y) * 5 + ph + Math.PI / 2) * 0.9, bark(seed), { line: true });
    };
    strand(Math.PI, 3, false);
    strand(0, 7, true);
    // a snapped twig end poking out at the lower left
    const [tx, ty] = at(2.55, R1 - 1), [ux, uy] = at(2.55, R1 + 1.6);
    r.part(segment(tx, ty, ux, uy, 0.55), 3.2, bark(11), { line: true });
    // cushions of moss: soft, bumpy, catching the light on top
    const moss: Material = { ...cloth('felt', hex('#5f8f2c'), { scale: 7, amt: 1.3 }), alb: (x, y) => mix(hex('#3f6a1c'), hex('#9cc24a'), clamp(fbm(x * 1.4, y * 1.4, 3) * 1.3 - 0.15)) as RGB, sheen: 0.35 };
    for (const [a, s] of [[-2.35, 2.9], [-0.95, 2.3], [0.35, 3.1], [1.55, 2.4], [2.95, 2.2]] as [number, number][]) {
      const [x, y] = at(a, mid + 0.2);
      r.part(warp(ellipse(x, y, s, s * 0.72), 0.55, 1.1, a * 9 + 3), (px, py) => 3.4 + dome(x, y, s, s * 0.72, 1.4)(px, py, 0) + (vnoise(px * 3, py * 3, 4) - 0.5) * 0.7, moss, { line: 0.9 });
    }
    // two little bonnet mushrooms on the top right
    for (const [a, s] of [[-0.62, 1], [-0.32, 0.78]] as [number, number][]) {
      const [x, y] = at(a, R1 - 0.4);
      r.part(segment(x, y + 0.2, x + 0.15, y + 2.4 * s, 0.32 * s), 4.6, matte('#efe2c4'), { line: 0.8 });
      r.part(ellipse(x, y, 1.5 * s, 1.15 * s), (px, py) => 5.2 + dome(x, y + 0.3, 1.5 * s, 1.3 * s, 1.1)(px, py, 0), { alb: (px, py) => mix(hex('#c98a4a'), hex('#7a4a22'), clamp((py - y + 1.2) / 2.2)) as RGB, spec: 0.4, shin: 22, coat: 0.3 }, { line: true });
    }
    // a fern crozier unrolling at the bottom
    const fp = spiralPts(C + 3.4, C + R1 - 0.6, 1.5, 0.35, 0.2, -1.3, 0.42, 0.22, 24);
    r.part(curve(fp), 5.2, { ...cloth('felt', hex('#7cb03c'), { amt: 0.4 }), spec: 0.3, shin: 16 }, { line: 0.9 });
    // and a fresh willow leaf
    const [lx, ly] = at(1.05, R1 - 0.2);
    r.part(pointed(lx - 2.6, ly - 0.8, 5.4, 1.6, 0.3), 5.0, { alb: (x, y) => mix(hex('#9ccc4e'), hex('#4e8a26'), clamp((y - ly + 1) / 2.4)) as RGB, spec: 0.35, shin: 24, coat: 0.2 }, { line: true });
  },

  // ---------------------------------------------------------------- the knitted ring
  knit: (r) => {
    const wool = (c: string, sc = 6): Material => ({ ...cloth('felt', hex(c), { scale: sc, amt: 1.0 }), sheen: 0.4 });
    r.part(band(FRAME_OPEN - 0.4, R1 - 0.2), torusH(3.6, mid - 0.1, half - 0.1), wool('#8e1f30'));
    // stockinette: rows of plump V stitches running round, each V two leaning loops
    const rows = [FRAME_OPEN + 1.0, mid, R1 - 1.2], n = 30;
    for (const [ri, rr] of rows.entries()) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (ri % 2) * (Math.PI / n), tang = a + Math.PI / 2, [x, y] = at(a, rr);
        for (const sd of [-1, 1]) {
          const lx = x + Math.cos(tang) * sd * 0.6, ly = y + Math.sin(tang) * sd * 0.6;
          r.part(leaf(lx, ly, 2.1, 1.05, a + sd * 0.55), (px, py) => torusH(3.6, mid - 0.1, half - 0.1)(px, py) + 0.3 + dome(lx, ly, 1.0, 1.0, 0.45)(px, py, 0), wool(sd > 0 ? '#b8323e' : '#a42a38', 7), { line: 0.7 });
        }
      }
    }
    // a carved wooden toggle on a loop, and a cream pompom
    const [bx, by] = at(-0.6, mid + 0.3);
    r.part(rotate(ellipse(bx, by, 2.7, 0.95), -0.6 + Math.PI / 2 + 0.3, bx, by), dome(bx, by, 2.7, 2.7, 1.1, 4.6), { ...wood('honey', { scale: 8 }), coat: 0.6 }, { line: true });
    for (const sd of [-0.9, 0.9]) r.carve(circle(bx + Math.cos(-0.6 + 0.3 + Math.PI / 2) * sd, by + Math.sin(-0.6 + 0.3 + Math.PI / 2) * sd, 0.28), 0.6, 0.2);
    // the pompom, sewn on at the lower left: a ball of cream wool, fuzzy at the edge
    const [px, py] = at(2.3, R1 - 0.6);
    const fluff: SDF = warp(circle(px, py, 3.2), 0.4, 3.2, 5);
    r.part(fluff, (x, y) => 5.2 + dome(px, py, 3.4, 3.4, 2.6)(x, y, 0) + (vnoise(x * 6, y * 6, 3) - 0.5) * 0.6, { ...cloth('felt', hex('#f3e6cf'), { scale: 9, amt: 1.5 }), sheen: 0.5 }, { line: true });
    for (let i = 0; i < 26; i++) { const b = i * 2.4, d = 0.5 + ((i * 37) % 23) / 23 * 2.3; r.carve(segment(px + Math.cos(b) * d, py + Math.sin(b) * d, px + Math.cos(b) * (d + 0.6), py + Math.sin(b) * (d + 0.6), 0.1), 0.35, 0.1); }
  },

  // ---------------------------------------------------------------- silver filigree
  filigree: (r) => {
    // a twisted silver rope round the opening, a plain band with a milgrain edge outside
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 1.3), torusH(1.5, FRAME_OPEN + 0.45, 0.85, 1.2), silver(), { line: true });
    for (let i = 0; i < 44; i++) { const a = (i / 44) * Math.PI * 2, [x0, y0] = at(a - 0.05, FRAME_OPEN - 0.2), [x1, y1] = at(a + 0.05, FRAME_OPEN + 1.1); r.carve(segment(x0, y0, x1, y1, 0.07), 0.45, 0.1); }
    r.part(ring(C, C, R1 - 1.5, R1), torusH(1.4, R1 - 0.75, 0.75, 1), silver(0.9), { line: true });
    for (let i = 0; i < 60; i++) { const [x, y] = at((i / 60) * Math.PI * 2, R1 - 0.75); r.carve(circle(x, y, 0.3), -0.35, 0.3); }
    // a dark ground behind the wirework (oxidised silver), so the curls read
    r.part(ring(C, C, FRAME_OPEN + 1.1, R1 - 1.3), 0.4, { alb: (x, y) => mix(hex('#3a3a44'), hex('#5a5a66'), fbm(x, y, 7)) as RGB, metal: 0.5, spec: 0.3, shin: 20 });
    // S-scrolls of round wire, two curls each, between the pearls
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12, sgn = i % 2 ? 1 : -1;
      const [cx, cy] = at(a, mid);
      const dir = a + Math.PI / 2;
      const ax = cx - Math.cos(dir) * 1.05, ay = cy - Math.sin(dir) * 1.05, bx = cx + Math.cos(dir) * 1.05, by = cy + Math.sin(dir) * 1.05;
      const s1 = spiralPts(ax, ay, 1.05, 0.25, dir, sgn * 1.1, 0.28, 0.2, 20), s2 = spiralPts(bx, by, 1.05, 0.25, dir + Math.PI, sgn * 1.1, 0.28, 0.2, 20);
      r.part(curve(s1), 2.0, silver(0.95), { line: 0.7 });
      r.part(curve(s2), 2.0, silver(0.95), { line: 0.7 });
    }
    // pearls at the quarters, a sapphire cabochon in a bezel at the top
    for (let i = 1; i < 4; i++) { const [x, y] = at(-Math.PI / 2 + (i * Math.PI) / 2, mid); r.part(circle(x, y, 1.55), dome(x, y, 1.55, 1.55, 1.5, 2.4), pearl(x, y), { line: true }); }
    const [sx, sy] = at(-Math.PI / 2, mid - 0.1);
    r.part(ellipse(sx, sy, 2.5, 2.1), dome(sx, sy, 2.5, 2.1, 0.8, 2.2), silver(0.9), { line: true });
    r.part(ellipse(sx, sy, 1.85, 1.5), dome(sx, sy, 1.85, 1.5, 1.7, 2.8), { ...glass(hex('#2a4fb8'), { metal: 0.2 }), alb: (x, y) => mix(hex('#6a9cf0'), hex('#14266e'), clamp(Math.hypot(x - sx + 0.6, y - sy + 0.5) / 2.2)) as RGB }, { line: true });
  },

  // ---------------------------------------------------------------- the toadstool fairy ring
  mushroom: (r) => {
    const turf: Material = { ...cloth('felt', hex('#4c7a26'), { scale: 7, amt: 1.3 }), alb: (x, y) => mix(hex('#2f5a1a'), hex('#86b23e'), clamp(fbm(x * 1.2, y * 1.2, 2) * 1.3 - 0.1)) as RGB };
    // grass blades round the outer edge (the ring's ragged silhouette)
    for (let i = 0; i < 56; i++) {
      const a = (i / 56) * Math.PI * 2 + (i % 3) * 0.03, L = 1.4 + ((i * 37) % 5) * 0.25, [x0, y0] = at(a, R1 - 1.6), [x1, y1] = at(a + ((i % 2) ? 0.06 : -0.06), R1 - 1.6 + L);
      r.part(curve([[x0, y0, 0.42], [x1, y1, 0.05]]), 1.8, { alb: () => (i % 2 ? hex('#5e9a2e') : hex('#3e7220')), spec: 0.2, shin: 14 });
    }
    r.part(warp(band(FRAME_OPEN - 0.4, R1 - 1.0), 0.3, 0.7, 5), (x, y) => torusH(2.8, mid - 0.3, half - 0.4)(x, y) + (vnoise(x * 2.2, y * 2.2, 3) - 0.5) * 0.6, turf, { line: 0.8 });
    // clover leaves here and there
    for (const a of [-2.9, -1.2, 0.9, 2.2]) {
      const [x, y] = at(a, mid - 0.4);
      for (let k = 0; k < 3; k++) { const b = a + (k / 3) * Math.PI * 2, cx = x + Math.cos(b) * 0.55, cy = y + Math.sin(b) * 0.55; r.part(circle(cx, cy, 0.6), (px, py) => 3.4 + dome(cx, cy, 0.6, 0.6, 0.3)(px, py, 0), { alb: () => hex('#78b848'), spec: 0.3, shin: 20 }, { line: 0.5 }); }
    }
    // fly agarics standing round the ring, caps over its outer edge
    const shrooms: [number, number][] = [[-1.92, 1.25], [-1.2, 0.9], [-0.35, 1.1], [0.55, 0.85], [1.35, 1.2], [2.35, 0.95], [3.05, 0.8]];
    for (const [a, s] of shrooms) {
      const [x, y] = at(a, R1 - 2.1);
      const ux = Math.cos(a), uy = Math.sin(a);
      // stem out from the turf
      r.part(segment(x - ux * 0.6, y - uy * 0.6, x + ux * 1.6 * s, y + uy * 1.6 * s, 0.6 * s), (px, py) => 4.2 + 0.4 * (1 - Math.min(1, Math.hypot(px - x, py - y) / 2)), matte('#f4ead6'), { line: 0.8 });
      const cx = x + ux * 2.2 * s, cy = y + uy * 2.2 * s, w = 2.1 * s, h = 1.45 * s;
      const cap = rotate(ellipse(cx, cy, h, w), a, cx, cy);
      r.part(cap, (px, py) => 5 + dome(cx - ux * 0.4, cy - uy * 0.4, w, w, 1.6 * s)(px, py, 0), { alb: (px, py) => { const d = ((px - cx) * ux + (py - cy) * uy) / h; return mix(hex('#e4402e'), hex('#9a1c16'), clamp(0.5 - d * 0.5)) as RGB; }, spec: 0.7, shin: 40, coat: 0.8 }, { line: true });
      for (const [du, dv, ds] of [[0.35, -0.5, 0.3], [0.1, 0.55, 0.26], [-0.25, -0.05, 0.22], [0.55, 0.15, 0.18]] as [number, number, number][]) {
        const sx = cx + ux * du * h - uy * dv * w, sy = cy + uy * du * h + ux * dv * w, sr = ds * w * 0.7;
        r.part(circle(sx, sy, sr), (px, py) => 6.2 * 0 + 5 + dome(cx - ux * 0.4, cy - uy * 0.4, w, w, 1.6 * s)(px, py, 0) + dome(sx, sy, sr, sr, 0.25)(px, py, 0), matte('#fff6e6', { spec: 0.25 }), { line: 0.5 });
      }
    }
  },

  // ---------------------------------------------------------------- the golden laurel
  laurel: (r) => {
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 0.9), torusH(1.0, FRAME_OPEN + 0.25, 0.65, 0.8), gold(0.75), { line: true });
    // each branch: a stem from the bow at the bottom up its side, leaves in pairs leaning up and out, berries between
    for (const side of [-1, 1]) {
      const stem: [number, number, number][] = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30, a = Math.PI / 2 + side * (0.25 + t * 2.75); stem.push([...at(a, mid + 0.2), 0.38 - t * 0.2]); }
      r.part(curve(stem), 2.0, gold(0.7), { line: 0.8 });
      for (let i = 0; i < 9; i++) {
        const t = (i + 0.4) / 9.4, a = Math.PI / 2 + side * (0.3 + t * 2.65), [x, y] = at(a, mid + 0.2);
        const along = a + side * Math.PI / 2, sz = 1 - t * 0.35;
        for (const io of [-1, 1]) {
          const out = Math.atan2(y - C, x - C) * (io > 0 ? 1 : 1), lean = along + io * side * 0.55 * (io > 0 ? 1 : 1);
          const la = io > 0 ? Math.atan2(Math.sin(along) + Math.sin(out) * 0.9, Math.cos(along) + Math.cos(out) * 0.9) : Math.atan2(Math.sin(along) - Math.sin(out) * 0.9, Math.cos(along) - Math.cos(out) * 0.9);
          void lean;
          const L = 4.4 * sz, W = 1.9 * sz;
          const lf = pointed(x, y, L, W, la);
          const mx = x + Math.cos(la) * L * 0.5, my = y + Math.sin(la) * L * 0.5;
          r.part(lf, (px, py) => 2.6 + i * 0.04 + (io > 0 ? 0.5 : 0) + dome(mx, my, L / 2, L / 2, 0.9)(px, py, 0), { ...gold(io > 0 ? 0.9 : 0.75), alb: (px, py) => { const v = (-(px - mx) * Math.sin(la) + (py - my) * Math.cos(la)) / W; return mix(GOLD, hex('#b07a1e'), clamp(0.4 + v * 0.8)) as RGB; } }, { line: true });
          r.carve(segment(x + Math.cos(la) * 0.4, y + Math.sin(la) * 0.4, x + Math.cos(la) * L * 0.86, y + Math.sin(la) * L * 0.86, 0.08), 0.35, 0.12);
        }
        if (i % 3 === 1) { const [bx, by] = at(a + side * 0.12, mid - 1.4); r.part(circle(bx, by, 0.62), dome(bx, by, 0.62, 0.62, 0.6, 3.2), gold(0.95), { line: 0.7 }); }
      }
    }
    // the bow at the bottom: two loops, the knot, two notched tails hanging down
    const [bx, by] = at(Math.PI / 2, R1 - 0.9);
    const silk = (c: string): Material => ({ ...cloth('velvet', hex(c), { amt: 0.25 }), spec: 0.55, shin: 30, sheen: 0.6 });
    for (const sd of [-1, 1]) {
      r.part(polygon([[bx + sd * 0.5, by + 0.4], [bx + sd * 2.0, by + 3.4], [bx + sd * 1.5, by + 3.0], [bx + sd * 0.9, by + 3.6], [bx + sd * 0.1, by + 0.6]]), (x, y) => 3.6 + (y - by) * -0.15, silk('#a82632'), { line: true });
      r.part(ellipse(bx + sd * 2.0, by - 0.3, 2.0, 1.15), (x, y) => 4.2 + dome(bx + sd * 1.7, by - 0.6, 2.0, 1.2, 0.9)(x, y, 0), silk('#c8343e'), { line: true });
      r.carve(ellipse(bx + sd * 2.1, by - 0.25, 0.9, 0.38), 0.9, 0.35);
    }
    r.part(ellipse(bx, by - 0.2, 0.95, 1.05), dome(bx, by - 0.2, 0.95, 1.05, 0.8, 4.8), silk('#b02c36'), { line: true });
  },

  // ---------------------------------------------------------------- frost
  frost: (r) => {
    const ice: Material = { ...glass(hex('#cfe8f6'), { metal: 0.3 }), alb: (x, y) => mix(hex('#e8f6ff'), hex('#7eb6dc'), clamp(fbm(x * 0.5, y * 0.5, 4) * 1.1 - 0.15 + (rad(x, y) - mid) * 0.06)) as RGB };
    const rime: Material = { alb: (x, y) => mix(hex('#ffffff'), hex('#bfe0f4'), clamp(vnoise(x * 4, y * 4, 2))) as RGB, spec: 0.9, shin: 70, coat: 0.7, metal: 0.15 };
    // dendrites first (they grow out from under the ring): a spine with branches at sixty degrees, and sub-branches
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.09, L = i % 3 === 0 ? 4.4 : i % 3 === 1 ? 3.2 : 2.5;
      const [x0, y0] = at(a, R1 - 2.4), [x1, y1] = at(a, R1 - 2.4 + L);
      r.part(curve([[x0, y0, 0.5], [x1, y1, 0.1]]), 2.2, rime);
      for (let k = 1; k <= 3; k++) {
        const t = k / 4.2, bx = x0 + (x1 - x0) * t, by = y0 + (y1 - y0) * t, bl = L * (0.42 - t * 0.22);
        for (const sd of [-1, 1]) { const b = a + sd * (Math.PI / 3); r.part(curve([[bx, by, 0.3], [bx + Math.cos(b) * bl, by + Math.sin(b) * bl, 0.08]]), 2.1, rime); }
      }
    }
    // the ice ring itself: clear, a little bumpy, brighter at the rim
    r.part(warp(band(FRAME_OPEN - 0.4, R1 - 1.4), 0.25, 0.9, 3), (x, y) => torusH(3, mid - 0.7, half - 0.6)(x, y) + (vnoise(x * 2, y * 2, 8) - 0.5) * 0.5, ice, { line: true });
    // a rime of frost crystals sparkling on top
    for (let i = 0; i < 40; i++) { const a = i * 2.399, rr = mid - 2 + ((i * 53) % 37) / 37 * 3, [x, y] = at(a, rr); r.part(star(x, y, 0.38, 0.35, a, 3), 3.6, rime); }
    // three snowflakes, raised like cut crystal
    for (const [a, s] of [[-2.2, 2.2], [0.35, 1.8], [1.9, 1.5]] as [number, number][]) {
      const [x, y] = at(a, mid - 0.4);
      for (let k = 0; k < 6; k++) {
        const b = a + (k * Math.PI) / 3, ex = x + Math.cos(b) * s, ey = y + Math.sin(b) * s;
        r.part(segment(x, y, ex, ey, 0.22), 4.2, rime, { line: 0.5 });
        for (const sd of [-1, 1]) { const mx = x + Math.cos(b) * s * 0.6, my = y + Math.sin(b) * s * 0.6, c = b + sd * 0.8; r.part(segment(mx, my, mx + Math.cos(c) * s * 0.35, my + Math.sin(c) * s * 0.35, 0.14), 4.2, rime); }
      }
      r.part(circle(x, y, 0.42), dome(x, y, 0.42, 0.42, 0.3, 4.4), rime);
    }
  },

  // ---------------------------------------------------------------- the orrery
  celestial: (r) => {
    const sky: Material = { alb: (x, y) => mix(hex('#0e1640'), hex('#2a2a72'), clamp(fbm(x * 0.35, y * 0.35, 2) * 1.2 - 0.1)) as RGB, spec: 0.7, shin: 60, coat: 0.95 };
    r.part(band(FRAME_OPEN + 0.6, R1 - 1.0), torusH(1.2, mid, half, 1.6), sky);
    // gold-flecked stars and a constellation or two in fine gold line
    for (let i = 0; i < 26; i++) { const a = i * 2.399 + 0.3, rr = mid + (((i * 37) % 11) / 11 - 0.5) * 2.6, [x, y] = at(a, rr); r.part(star(x, y, 0.32 + (i % 3) * 0.12, 0.4, a, 4), 3.0, { alb: () => hex('#fff2b8'), emit: 1 }); }
    const con = [[-0.2, 0.4], [0.05, -0.6], [0.3, 0.5], [0.55, -0.2]].map(([a, d]) => at(a + 2.4, mid + d));
    for (let i = 0; i < con.length - 1; i++) r.inkFill(segment(con[i][0], con[i][1], con[i + 1][0], con[i + 1][1], 0.06), 0);
    for (let i = 0; i < con.length - 1; i++) r.paint(segment(con[i][0], con[i][1], con[i + 1][0], con[i + 1][1], 0.08), { alb: () => hex('#d8b25a'), emit: 1 });
    // the brass scale rings, engraved every five degrees, longer every thirty
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 1.0), torusH(1.3, FRAME_OPEN + 0.3, 0.7, 2.2), gold(0.85), { line: true });
    r.part(ring(C, C, R1 - 1.4, R1), prof(R1 - 1.4, R1, (t) => 3.0 + Math.sqrt(Math.max(0, 1 - ((t - 0.5) / 0.5) ** 2)) * 0.7), brass(0.75), { line: true });
    for (let i = 0; i < 72; i++) { const a = (i / 72) * Math.PI * 2, L = i % 6 === 0 ? 0.9 : 0.5, [x0, y0] = at(a, R1 - 1.35), [x1, y1] = at(a, R1 - 1.35 + L); r.carve(segment(x0, y0, x1, y1, 0.07), 0.35, 0.08); }
    // the sun at the upper left: a disc with a face of hammered gold and wavy rays
    const [sx, sy] = at(-Math.PI * 0.74, mid + 0.3);
    for (let k = 0; k < 12; k++) {
      const b = (k / 12) * Math.PI * 2, L = k % 2 ? 3.1 : 3.9;
      const pts: [number, number, number][] = [];
      for (let q = 0; q <= 8; q++) { const t = q / 8, rr = 1.6 + t * (L - 1.6), w = Math.sin(t * Math.PI * 2) * 0.25; pts.push([sx + Math.cos(b + w * 0.3) * rr, sy + Math.sin(b + w * 0.3) * rr, 0.5 * (1 - t) + 0.08]); }
      r.part(curve(pts), 3.8, gold(0.9), { line: 0.7 });
    }
    r.part(circle(sx, sy, 2.0), dome(sx, sy, 2.0, 2.0, 1.3, 4.2), { ...gold(0.95), alb: (x, y) => mix(hex('#ffe08a'), hex('#d89a26'), clamp(Math.hypot(x - sx + 0.7, y - sy + 0.7) / 2.6)) as RGB }, { line: true });
    // the silver crescent moon at the lower right
    const [mx, my] = at(Math.PI * 0.26, mid + 0.4);
    r.part(subtract(circle(mx, my, 2.7), circle(mx + 1.35, my - 0.9, 2.25)), (x, y) => 3.8 + dome(mx, my, 2.7, 2.7, 1.1)(x, y, 0), silver(0.92), { line: true });
    // a ringed planet on its arm at the bottom left
    const [px, py] = at(Math.PI * 0.78, mid + 0.2);
    r.part(rotate(ellipse(px, py, 2.4, 0.6), -0.4, px, py), 3.7, gold(0.85), { line: 0.8 });
    r.part(circle(px, py, 1.2), dome(px, py, 1.2, 1.2, 1.0, 3.9), enamel('#c8643c'), { line: true });
    r.part(subtract(rotate(ellipse(px, py, 2.4, 0.6), -0.4, px, py), ellipse(px, py - 0.35, 2.6, 0.9)), 4.6, gold(0.85), { line: 0.8 });
  },

  // ---------------------------------------------------------------- gingerbread
  gingerbread: (r) => {
    const biscuit: Material = { ...paperMat('kraft', { tint: [236, 180, 120], scale: 4 }), alb: (x, y) => { const v = vnoise(x * 2.4, y * 2.4, 3); return mix(hex('#94521e'), hex('#d89a56'), clamp(0.55 + (fbm(x * 0.6, y * 0.6, 4) - 0.5) * 0.9 - (v > 0.84 ? 0.3 : 0) - Math.max(0, rad(x, y) - R1 + 1.2) * 0.25)) as RGB; }, spec: 0.18, shin: 10 };
    // the biscuit: a scalloped edge outside, baked rounder at the rim
    const scal: SDF = (x, y) => { const a = ang(x, y), rr = R1 - 0.3 + Math.abs(Math.sin(a * 9)) * 0.9 - 0.45; return Math.max(rad(x, y) - rr, FRAME_OPEN - 0.4 - rad(x, y)); };
    scal.bb = [C - R1 - 1, C - R1 - 1, C + R1 + 1, C + R1 + 1];
    r.part(scal, (x, y, ins) => 1.6 + Math.min(1.6, ins * 1.3) + (vnoise(x * 3.5, y * 3.5, 7) - 0.5) * 0.35, biscuit, { line: true });
    // docker holes and sugar sparkle
    for (let i = 0; i < 18; i++) { const [x, y] = at(i * 0.349 + 0.17, mid + (i % 2 ? 1.6 : -1.6)); r.carve(circle(x, y, 0.2), 0.4, 0.15); }
    // royal icing: a looped line round the scallops, dots at the points, a fine line round the opening
    const icing: Material = { alb: (x, y) => mix(hex('#fffdf6'), hex('#e8e2da'), clamp(vnoise(x * 3, y * 3, 2) * 0.6)), spec: 0.45, shin: 26, coat: 0.2 };
    const loops: [number, number, number][] = [];
    for (let i = 0; i <= 180; i++) { const a = (i / 180) * Math.PI * 2, rr = R1 - 1.6 + Math.abs(Math.sin(a * 9)) * 0.9 - 0.2; loops.push([...at(a, rr), 0.36]); }
    r.part(curve(loops), (x, y) => 3.4 + torusH(0.35, rad(x, y), 0.36)(x, y), icing, { line: 0.6 });
    r.part(ring(C, C, FRAME_OPEN + 0.5, FRAME_OPEN + 1.25), 3.3, icing, { line: 0.6 });
    for (let i = 0; i < 18; i++) { const [x, y] = at((i / 18) * Math.PI * 2 + Math.PI / 18, R1 - 0.5); r.part(circle(x, y, 0.42), dome(x, y, 0.42, 0.42, 0.4, 3.2), icing, { line: 0.5 }); }
    // glossy, sugared gumdrops
    const gum = ['#e03a4a', '#3aa85a', '#f0b020', '#3a7ad8', '#c84ac0'];
    for (let i = 0; i < 5; i++) {
      const [x, y] = at(-Math.PI / 2 + (i / 5) * Math.PI * 2 + 0.6, mid - 0.2);
      r.part(circle(x, y, 1.3), dome(x, y + 0.2, 1.3, 1.4, 1.5, 3.5), { ...glass(hex(gum[i]), { metal: 0.05 }), alb: (px, py) => { const g = hex(gum[i]); return vnoise(px * 9, py * 9, i) > 0.8 ? mix(g, [255, 255, 255], 0.55) as RGB : g; }, diffuse: 0.85 }, { line: true });
    }
    // a little candy cane leaning on the lower right
    const cane: [number, number, number][] = [];
    const [cx, cy] = at(0.75, R1 - 0.3);
    for (let i = 0; i <= 16; i++) { const t = i / 16; cane.push(t < 0.6 ? [cx - 2.4 + t * 2, cy + 2.4 - t * 6, 0.5] : [cx - 1.2 + Math.sin((t - 0.6) / 0.4 * Math.PI) * 1.1, cy - 1.2 - Math.cos((t - 0.6) / 0.4 * Math.PI) * 1.1 + 0.0, 0.5]); }
    r.part(curve(cane), (x, y, ins) => 5 + Math.min(0.5, ins), { alb: (x, y) => (Math.sin((x * 1.3 + y * 1.6) * 2.2) > 0.1 ? hex('#d42a32') : hex('#fbf6ee')), spec: 0.7, shin: 50, coat: 0.8 }, { line: true });
  },

  // ---------------------------------------------------------------- the star-studded night
  starry: (r) => {
    const sky: Material = { alb: (x, y) => { const s = vnoise(x * 7, y * 7, 9); return (s > 0.94 ? hex('#ffffff') : s > 0.9 ? hex('#b8c4ff') : mix(hex('#0c1440'), hex('#3a2268'), clamp(fbm(x * 0.28, y * 0.28, 4) * 1.4 - 0.25))) as RGB; }, spec: 0.35, shin: 24, sheen: 0.45 };
    r.part(band(FRAME_OPEN + 0.4, R1 - 0.6), torusH(2.6, mid, half - 0.3, 0.4), sky);
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 0.8), torusH(1.0, FRAME_OPEN + 0.2, 0.6, 2.2), gold(0.85), { line: true });
    r.part(ring(C, C, R1 - 1.0, R1 - 0.2), torusH(0.9, R1 - 0.6, 0.4, 2.0), gold(0.85), { line: true });
    // a shooting star across the bottom: a fading gold trail and its head
    const trail: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; trail.push([...at(Math.PI * (0.32 + t * 0.34), mid + 0.8 - t * 1.2), 0.08 + (1 - t) * 0.35]); }
    r.part(curve(trail), 3.0, { alb: (x) => mix(hex('#fff4c0'), hex('#c89a3a'), clamp((C + 6 - x) / 12)), emit: 1 });
    // gold stars, some breaking out over the rims
    const stars: [number, number, number][] = [[-2.25, R1 - 0.6, 2.6], [-1.35, mid + 0.4, 1.5], [-0.55, R1 - 0.2, 2.1], [0.35, mid - 0.5, 1.3], [1.0, R1 - 0.7, 1.8], [2.75, R1 - 0.3, 2.3], [3.35, mid - 0.2, 1.4], [1.65, mid + 0.6, 1.1]];
    stars.forEach(([a, d, s], i) => { const [x, y] = at(a, d); r.part(star(x, y, s, 0.44, -Math.PI / 2 + i * 0.25), starH(x, y, s, 1.4, 3.0), gold(0.92), { line: true }); });
    // a crescent moon on the upper right
    const [mx, my] = at(-0.62, mid + 0.6);
    r.part(subtract(circle(mx, my, 2.6), circle(mx + 1.2, my - 0.95, 2.2)), (x, y) => 3.4 + dome(mx, my, 2.6, 2.6, 1.0)(x, y, 0), { ...gold(0.9), alb: () => hex('#f6dc8a') }, { line: true });
  },

  // ---------------------------------------------------------------- honeycomb (new)
  honeycomb: (r) => {
    const wax: Material = { alb: (x, y) => mix(hex('#f2c75a'), hex('#c8902a'), clamp(fbm(x * 0.8, y * 0.8, 6) * 0.9)), spec: 0.35, shin: 24, coat: 0.25 };
    const honey: Material = { ...glass(hex('#e08a14'), { metal: 0.05 }), alb: (x, y) => mix(hex('#ffcc4a'), hex('#a8520a'), clamp(fbm(x * 0.6, y * 0.6, 2) * 0.6 + 0.2)) as RGB, diffuse: 0.7 };
    const cap: Material = { alb: (x, y) => mix(hex('#fbe8b0'), hex('#e8c878'), clamp(vnoise(x * 3, y * 3, 4))), spec: 0.25, shin: 14 };
    // a ring cut from a slab of comb: a wax body with a rounded lip, the hexagonal cells pressed into it (a flat
    // hexagonal lattice, cut off by the ring's edges like real comb), some cells full of honey, some capped
    const hexOf = (x: number, y: number, s0: number, a = Math.PI / 6): SDF => { const p: [number, number][] = []; for (let k = 0; k < 6; k++) { const b = a + (k * Math.PI) / 3; p.push([x + Math.cos(b) * s0, y + Math.sin(b) * s0]); } return polygon(p); };
    const body = warp(band(FRAME_OPEN - 0.4, R1 - 0.3), 0.18, 1.2, 4);
    r.part(body, (x, y, ins) => 1.4 + Math.min(1.4, ins * 1.3), wax, { line: true });
    const S0 = 1.5, dx = S0 * Math.sqrt(3), dy = S0 * 1.5;
    let n = 0;
    for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) {
      const x = C + i * dx + (j % 2 ? dx / 2 : 0), y = C + j * dy, d = rad(x, y);
      if (d < FRAME_OPEN - 0.4 || d > R1 + 0.2) continue;
      const cell = hexOf(x, y, S0 * 0.8);
      const k = (n++ * 7 + j * 3) % 6;
      if (k === 0) r.part(cell, (px, py) => 2.8 + dome(x, y, S0, S0, 0.3)(px, py, 0), cap, { onTop: true });
      else { r.carve(cell, 1.0, 0.35); if (k !== 5) r.paint(hexOf(x, y, S0 * 0.74), honey); }
    }
    // the lip round the opening and the outside, smoothed by the bees
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 0.5), torusH(0.8, FRAME_OPEN + 0.05, 0.45, 2.2), wax, { line: 0.8 });
    // honey running off the bottom in two drips
    for (const [dx, L] of [[-1.6, 3.0], [1.1, 2.1]] as [number, number][]) {
      const x = C + dx, y0 = C + R1 - 2.6, y1 = y0 + L;
      r.part(union(segment(x, y0, x, y1 - 0.4, 0.45), circle(x, y1 - 0.2, 0.75)), (px, py) => 3.0 + dome(x, y1 - 0.2, 0.75, 0.75, 0.7)(px, py, 0) + 0.2, honey, { line: true });
    }
    // a bee resting on the comb at the upper right
    const [bx, by] = at(-0.7, R1 - 0.9), ba = -0.7 + Math.PI / 2 + 0.6;
    const wing = (sd: number) => rotate(ellipse(bx + Math.cos(ba + sd * 1.9) * 1.3, by + Math.sin(ba + sd * 1.9) * 1.3, 1.5, 0.7), ba + sd * 1.3, bx + Math.cos(ba + sd * 1.9) * 1.3, by + Math.sin(ba + sd * 1.9) * 1.3);
    r.part(rotate(ellipse(bx, by, 2.0, 1.25), ba, bx, by), dome(bx, by, 2.0, 2.0, 1.3, 4.2), { alb: (x, y) => { const u = (x - bx) * Math.cos(ba) + (y - by) * Math.sin(ba); return Math.sin(u * 3.2) > 0.2 ? hex('#2a1c10') : hex('#f2b82a'); }, spec: 0.4, shin: 30, sheen: 0.4 }, { line: true });
    const hx = bx - Math.cos(ba) * 2.0, hy = by - Math.sin(ba) * 2.0;
    r.part(circle(hx, hy, 0.85), dome(hx, hy, 0.85, 0.85, 0.7, 4.2), matte('#2a1c10', { spec: 0.4, shin: 30 }), { line: true });
    for (const sd of [-1, 1]) r.part(wing(sd), 5.6, { ...glass(hex('#e8f4ff'), { metal: 0.1 }), alb: () => hex('#e4f0fa') }, { line: 0.7 });
  },

  // ---------------------------------------------------------------- the rose window (new)
  stained: (r) => {
    const stone: Material = { alb: (x, y) => mix(hex('#e6dcc6'), hex('#b4a688'), clamp(fbm(x * 0.9, y * 0.9, 11) * 1.1 - 0.1 + (vnoise(x * 5, y * 5, 3) > 0.85 ? 0.2 : 0))), spec: 0.08, shin: 6 };
    // the cusped stone outline: twelve lobes round the outside
    const lobes: SDF = (x, y) => { const a = ang(x, y), rr = R1 - 0.6 + Math.abs(Math.cos(a * 6)) ** 0.5 * 1.0 - 0.5; return Math.max(rad(x, y) - rr, FRAME_OPEN - 0.4 - rad(x, y)); };
    lobes.bb = [C - R1 - 1, C - R1 - 1, C + R1 + 1, C + R1 + 1];
    r.part(lobes, (x, y, ins) => 1.4 + Math.min(1.4, ins * 1.0), stone, { line: true });
    // the glass between the tracery: jewel colours, lit from behind, a little uneven like old glass
    const jewels = ['#c4202c', '#1f4fb4', '#e2a21c', '#2a8a4a', '#7a2ca0', '#1f4fb4'];
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2 - Math.PI / 12 + 0.05, a1 = a0 + (Math.PI * 2) / 12 - 0.1;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 6; k++) pts.push(at(a0 + (a1 - a0) * (k / 6), FRAME_OPEN + 1.25));
      for (let k = 6; k >= 0; k--) pts.push(at(a0 + (a1 - a0) * (k / 6), R1 - 1.7 + Math.sin((k / 6) * Math.PI) * 0.6));
      const col = hex(jewels[i % jewels.length]);
      const [gx, gy] = at((a0 + a1) / 2, mid);
      r.part(polygon(pts), (x, y) => 1.0 + dome(gx, gy, 3.2, 3.2, 0.35)(x, y, 0), { alb: (x, y) => mix(mix(col, [255, 246, 220], 0.38), mix(col, [10, 6, 20], 0.25), clamp((Math.hypot(x - gx + 1.2, y - gy + 1.2) / 3.2) * 0.8 + (vnoise(x * 1.3, y * 1.3, i) - 0.5) * 0.25)), spec: 0.6, shin: 90, coat: 0.6, diffuse: 0.3 }, { line: 1.2 });
      // a lead came across the middle of each light
      const [m0x, m0y] = at((a0 + a1) / 2, FRAME_OPEN + 1.3), [m1x, m1y] = at((a0 + a1) / 2, R1 - 1.6);
      r.line(segment(m0x, m0y, m1x, m1y, 0.01), 1.4, 0.8);
    }
    // the inner moulding and the little round bosses where the tracery meets
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 1.1), torusH(1.3, FRAME_OPEN + 0.35, 0.75, 1.6), stone, { line: true });
    for (let i = 0; i < 12; i++) { const [x, y] = at((i / 12) * Math.PI * 2 - Math.PI / 12, mid + 0.4); r.part(circle(x, y, 0.75), dome(x, y, 0.75, 0.75, 0.7, 2.4), stone, { line: 0.8 }); r.part(segment(...at((i / 12) * Math.PI * 2 - Math.PI / 12, FRAME_OPEN + 1), ...at((i / 12) * Math.PI * 2 - Math.PI / 12, R1 - 1.2), 0.36), 2.1, stone, { line: 0.8 }); }
    for (let i = 0; i < 12; i++) { const [x, y] = at((i / 12) * Math.PI * 2 - Math.PI / 12, mid + 0.4); r.part(circle(x, y, 0.75), dome(x, y, 0.75, 0.75, 0.7, 2.5), stone, { line: 0.8 }); }
  },

  // ---------------------------------------------------------------- driftwood (new)
  driftwood: (r) => {
    // silvered wood: long grain streaks running round the ring (fine across, long along), warm where the sun bleached less
    const drift: Material = { alb: (x, y) => { const a = ang(x, y), d = rad(x, y); const streak = vnoise(a * 3, d * 7, 4) * 0.6 + vnoise(a * 9, d * 14, 5) * 0.4, warm = fbm(a * 2, d * 0.6, 8, 2); return mix(mix(hex('#7c7468'), hex('#e6dfd0'), clamp(streak * 1.15 - 0.05)), hex('#c8b090'), clamp(warm - 0.45) * 0.8) as RGB; }, spec: 0.1, shin: 8, sheen: 0.15 };
    const body = warp(band(FRAME_OPEN - 0.4, R1 - 0.8), 0.6, 0.55, 13);
    r.part(body, (x, y, ins) => 0.8 + Math.min(2.4, ins * 1.0) + (vnoise(ang(x, y) * 6, rad(x, y) * 4, 6) - 0.5) * 0.25, drift, { line: true });
    // the grain worn into ridges, two knots
    for (let i = 0; i < 7; i++) { const pts: [number, number, number][] = []; const rr = FRAME_OPEN + 0.9 + i * 0.55; for (let k = 0; k <= 40; k++) { const a = -1.3 + (k / 40) * 2.4 + i * 0.9; pts.push([...at(a, rr + Math.sin(a * 4 + i) * 0.25), 0.07]); } r.carve(curve(pts), 0.4, 0.14); }
    for (const a of [-2.5, 1.2]) { const [x, y] = at(a, mid); r.carve(ellipse(x, y, 0.9, 0.6), 0.8, 0.5); r.carve(ellipse(x, y, 0.4, 0.25), -0.4, 0.2); }
    // hemp lashings at two places
    const hemp: Material = { alb: (x, y) => mix(hex('#d8b880'), hex('#9a7844'), clamp(vnoise(x * 5, y * 5, 2) * 0.8)), spec: 0.1, shin: 6, sheen: 0.25 };
    for (const a0 of [-0.75, 2.05]) {
      for (let k = 0; k < 7; k++) {
        const a = a0 + (k - 3) * 0.058, [x0, y0] = at(a - 0.07, FRAME_OPEN - 0.7), [x1, y1] = at(a + 0.07, R1 - 0.5);
        r.part(segment(x0, y0, x1, y1, 0.46), (x, y) => 3.2 + torusH(0.7, mid, half + 0.4)(x, y), hemp, { line: 0.6 });
        for (let q = 0; q < 5; q++) { const t = (q + 0.5) / 5, sx = x0 + (x1 - x0) * t, sy = y0 + (y1 - y0) * t, b = a + Math.PI / 2 + 0.7; r.carve(segment(sx - Math.cos(b) * 0.38, sy - Math.sin(b) * 0.38, sx + Math.cos(b) * 0.38, sy + Math.sin(b) * 0.38, 0.06), 0.25, 0.08); }
      }
    }
    // a starfish clinging on at the lower left
    const [sx, sy] = at(2.45, mid + 0.6);
    const sf = star(sx, sy, 3.0, 0.42, 0.4, 5);
    r.part(warp(sf, 0.15, 2, 3), (x, y) => 3.4 + starH(sx, sy, 3.0, 1.2, 0)(x, y) + (vnoise(x * 6, y * 6, 5) > 0.7 ? 0.25 : 0), { alb: (x, y) => mix(hex('#f08a3a'), hex('#b8441c'), clamp(Math.hypot(x - sx, y - sy) / 3)), spec: 0.25, shin: 16 }, { line: true });
    for (let i = 0; i < 14; i++) { const b = 0.4 + (i % 5) * (Math.PI * 2 / 5), d = 0.6 + Math.floor(i / 5) * 0.8, x = sx + Math.cos(b) * d, y = sy + Math.sin(b) * d; r.part(circle(x, y, 0.2), dome(x, y, 0.2, 0.2, 0.2, 4.4), matte('#ffd2a0')); }
    // a scallop shell at the top right
    const [cx, cy] = at(-0.95, mid + 0.3);
    const shell: SDF = (x, y) => { const dx = x - cx, dy = y - cy; const a = Math.atan2(dx, -dy); if (Math.abs(a) > 1.2 || dy > 0.9) return Math.max(Math.hypot(dx, dy) - 0.8, 0.02); return Math.hypot(dx, dy) - 3.0 - Math.cos(a * 7) * 0.12; };
    shell.bb = [cx - 3.5, cy - 3.5, cx + 3.5, cy + 1];
    r.part(shell, (x, y) => 3.4 + dome(cx, cy - 1, 3.2, 3.2, 1.3)(x, y, 0) + Math.abs(Math.cos(Math.atan2(x - cx, -(y - cy)) * 7)) * 0.3, { alb: (x, y) => mix(hex('#fbe6d6'), hex('#e09a82'), clamp(Math.hypot(x - cx, y - cy) / 3.2)), spec: 0.4, shin: 30, coat: 0.3 }, { line: true });
    r.part(union(polygon([[cx - 0.9, cy + 0.9], [cx - 1.7, cy + 0.3], [cx - 0.4, cy - 0.1]]), polygon([[cx + 0.9, cy + 0.9], [cx + 1.7, cy + 0.3], [cx + 0.4, cy - 0.1]])), 3.6, { alb: () => hex('#f2cdb8'), spec: 0.3, shin: 20 }, { line: 0.7 });
    // a piece of sea glass, frosted green
    const [gx, gy] = at(0.75, R1 - 1.2);
    r.part(warp(ellipse(gx, gy, 1.4, 1.0), 0.2, 1.5, 9), dome(gx, gy, 1.4, 1.0, 0.8, 3.4), { alb: () => hex('#8cd0b0'), spec: 0.5, shin: 20, coat: 0.2, diffuse: 0.7 }, { line: true });
  },

  // ---------------------------------------------------------------- not for sale: the ring round the neighbours' silhouettes
  ebony: (r) => {
    r.part(band(FRAME_OPEN - 0.4, R1), torusH(3, mid, half), wood('ebony', { along: 'x', scale: 4 }));
    r.part(ring(C, C, FRAME_OPEN - 0.4, FRAME_OPEN + 0.8), torusH(1, FRAME_OPEN + 0.2, 0.6, 1.2), gold(0.85), { line: true });
  },
};
void COPPER; void subtract;

/** frames whose outline isn't the usual near-black ink (ice reads as ice with a cold blue edge) */
const INK_OF: Record<string, [RGB, number]> = { frost: [[34, 64, 110], 0.85] };

/** The frame ids that have art. */
export const FRAME_ART_IDS = Object.keys(PAINT).filter((id) => id !== 'ebony');

/** A frame's art (a data URL) for showing at `px` CSS px across; the opening is clear. */
export function frameArt(id: string, px = 56): string {
  return cached(`frame15:${id}:${px}`, () => frameCanvas(id, px).toDataURL('image/png'));
}
const canvases = new Map<string, HTMLCanvasElement>();
function frameCanvas(id: string, px: number): HTMLCanvasElement {
  const key = id + ':' + px + ':' + deviceK();
  let c = canvases.get(key);
  if (!c) {
    const k = (px / FRAME_D) * deviceK(3);
    const r = new Real(FRAME_D, FRAME_D, k, 0);
    (PAINT[id] ?? PAINT.walnut)(r);
    r.cut(circle(C, C, FRAME_OPEN));
    const ink = INK_OF[id];
    c = r.canvas({ shadow: { dx: 0.35, dy: 0.8, blur: 1.1, a: 0.42 }, ambient: 0.5, aoR: 1.1, ...(ink ? { inkCol: ink[0], inkA: ink[1] } : {}) });
    if (id === 'porthole' || id === 'stained') glare(c, k, id === 'stained' ? 0.06 : 0.16);
    if (texReady.peek()) canvases.set(key, c); // [ui12] wood grain needs the photo tiles: repaint until they are in
  }
  return c;
}
/** a sheet of glass across the opening: a soft reflection of the window up-left, a thin bright rim at the edge */
function glare(c: HTMLCanvasElement, k: number, a: number) {
  const g = c.getContext('2d')!, x = C * k, y = C * k, R = FRAME_OPEN * k;
  g.save();
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.clip();
  const gr = g.createLinearGradient(x - R, y - R, x + R * 0.3, y + R * 0.3);
  gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.42, `rgba(255,255,255,${a * 0.5})`); gr.addColorStop(0.43, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
  g.strokeStyle = `rgba(255,255,255,${a * 1.6})`; g.lineWidth = Math.max(1, k * 0.35);
  g.beginPath(); g.arc(x, y, R - k * 0.5, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
  g.restore();
}

/** A frame with its little painted sky inside (no owl): for prize cards and lists, `px` CSS px across. */
export function frameWithSky(id: string, px = 64): string {
  return cached(`framesky15:${id}:${px}`, () => {
    const k = deviceK(3), c = document.createElement('canvas'), n = Math.round(px * k);
    c.width = c.height = n;
    const g = c.getContext('2d')!;
    const rr = (FRAME_OPEN / FRAME_D) * n + 1;
    g.save(); g.beginPath(); g.arc(n / 2, n / 2, rr, 0, Math.PI * 2); g.clip();
    g.drawImage(skyCanvas(frameSkyOf(id) === 'night', Math.round(rr * 2)), n / 2 - rr, n / 2 - rr, rr * 2, rr * 2);
    g.restore();
    g.drawImage(frameCanvas(id, px), 0, 0, n, n);
    return c.toDataURL('image/png');
  });
}

/** Which backdrop a frame's opening shows: the time of day's sky, or always the night (the starry frames). */
export const frameSkyOf = (id: string): 'auto' | 'night' => (id === 'starry' || id === 'celestial' ? 'night' : 'auto');

/** A painted sky for behind the owl, `n` px square: clear cerulean with soft clouds, or deep blue night with stars. */
export function portraitSky(night: boolean, n = 40): string {
  return cached(`psky7:${night}:${n}`, () => skyCanvas(night, n).toDataURL('image/png'));
}
const skies = new Map<string, HTMLCanvasElement>();
function skyCanvas(night: boolean, n: number): HTMLCanvasElement {
  const key = night + ':' + n;
  let c = skies.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, n);
  if (night) { gr.addColorStop(0, '#0c1436'); gr.addColorStop(0.6, '#1c2e64'); gr.addColorStop(1, '#3a5290'); }
  else { gr.addColorStop(0, '#4f9fd8'); gr.addColorStop(0.6, '#94cdee'); gr.addColorStop(1, '#dcf0fa'); }
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  if (night) {
    for (let i = 0; i < n / 3; i++) { const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * n, y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * n * 0.7, s = 0.3 + ((i * 7) % 5) * 0.12; g.fillStyle = `rgba(255,250,230,${0.4 + ((i * 3) % 4) * 0.15})`; g.beginPath(); g.arc(x, y, s * n / 60, 0, Math.PI * 2); g.fill(); }
  } else {
    for (const [cx, cy, rr] of [[0.25, 0.62, 0.16], [0.4, 0.58, 0.2], [0.58, 0.64, 0.15], [0.8, 0.5, 0.12]]) {
      const cg = g.createRadialGradient(cx * n, cy * n, 0, cx * n, cy * n, rr * n);
      cg.addColorStop(0, 'rgba(255,255,255,.85)'); cg.addColorStop(0.6, 'rgba(255,255,255,.4)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg; g.beginPath(); g.arc(cx * n, cy * n, rr * n, 0, Math.PI * 2); g.fill();
    }
  }
  skies.set(key, c);
  return c;
}
