// [ui4] The big cuckoo clock, v4: a hand-carved Black Forest chalet clock modelled and lit with the relief
// painter (relief.ts) at one art pixel per CSS pixel. A steep shingled roof with carved oak-leaf
// bargeboards, a carved bird with spread wings on the ridge, a little arched cuckoo door (a painted cuckoo
// pops out and calls on the hour, or when you tap), a varnished case with carved leaves, acorns and two
// songbirds perched round a brass-bezelled enamel dial with Roman numerals and pierced blued-steel hands
// that show the real time, a scalloped apron, a carved-leaf pendulum that swings, and two cast pine-cone
// weights on brass chains that drop through the day.
// The layout is in design units (CW x CH); the art is CK art px per unit.
import { Art } from './sleepart.ts';
import {
  and, clamp, disc, dome, ell, flat, hash, hex, MAT, metal, not, or, PAL, poly, rampAt, rect, Relief, ring, seg,
  slab, solid, torus, tubeY, vnoise, woodGrain, type AFn, type RGB, type Shape,
} from './relief.ts';

export const CW = 100, CH = 196;
/** art pixels per design unit */
export const CK = 3;
export const PIVOT = { x: 50, y: 125 };
export const PEND_LEN = 38;
/** x of the two weight chains and their counter rings */
export const WEIGHTS = [{ x: 34, ring: 25 }, { x: 66, ring: 75 }];
const CHAIN_TOP = 137;
export const DOOR = { x: 43, y: 29, w: 14, h: 13 };
export const FACE = { x: 50, y: 83, r: 24 };

export interface Finish { id: string; name: string; ramp: string; roof: string; carve: string }
export const FINISHES: Finish[] = [
  { id: 'oak', name: 'Honey oak', ramp: 'oak', roof: 'walnut', carve: 'oak' },
  { id: 'walnut', name: 'Dark walnut', ramp: 'walnut', roof: 'walnut', carve: 'walnut' },
  { id: 'cherry', name: 'Cherry', ramp: 'cherry', roof: 'walnut', carve: 'cherry' },
  { id: 'linden', name: 'Linden', ramp: 'linden', roof: 'oak', carve: 'linden' },
];
const LINDEN = [hex('#5a3c1e'), hex('#7a5530'), hex('#987044'), hex('#b48a58'), hex('#caa36e'), hex('#dbba86'), hex('#e8cfa0'), hex('#f2e0b8'), hex('#f8ecd0')];
const woodRamp = (n: string): RGB[] => (n === 'linden' ? LINDEN : (PAL as unknown as Record<string, RGB[]>)[n] ?? PAL.walnut);

const brass = (o: Parameters<typeof metal>[1] = {}) => metal(PAL.brass, { base: 0.6, ...o });
const IRON_B = [hex('#0f0d0b'), hex('#1d1915'), hex('#2c2620'), hex('#3d342b'), hex('#504437'), hex('#665645'), hex('#806b55'), hex('#9c8468')];

// ------------------------------------------------------------------ carving helpers

/** A carved oak leaf: lobed outline, a domed body, a grooved midrib and side veins. */
function leaf(r: Relief, x: number, y: number, ang: number, len: number, wid: number, A: AFn, base: number, hgt = 2.2, id = 30) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const loc = (px: number, py: number) => [(px - x) * c + (py - y) * s, -(px - x) * s + (py - y) * c];
  const half = (u: number) => { const t = u / len; return t <= 0 || t >= 1 ? 0 : Math.sin(t * Math.PI) ** 0.8 * wid * (0.72 + 0.28 * Math.abs(Math.sin(t * Math.PI * 3.4 + 0.3))); };
  const R = Math.max(len, wid) + 1;
  const sh: Shape = Object.assign((px: number, py: number) => { const [u, v] = loc(px, py); return u > 0 && u < len && Math.abs(v) <= half(u); }, { bb: [x - R, y - R, x + R, y + R] as [number, number, number, number] });
  r.fill(sh, (px, py) => {
    const [u, v] = loc(px, py), h = half(u) || 1;
    const curl = Math.sin((u / len) * Math.PI);
    return base + hgt * curl * Math.sqrt(Math.max(0, 1 - (v / h) ** 2)) + (u / len) * 0.6;
  }, A, MAT.varnish, { id, seam: true });
  r.carve(sh, (px, py) => {
    const [u, v] = loc(px, py);
    if (Math.abs(v) < 0.32 && u < len * 0.88) return -0.9;
    const side = (u - Math.abs(v) * 1.1) % 3.2;
    return Math.abs(v) > 0.7 && side > 0 && side < 0.5 && u < len * 0.85 ? -0.5 : 0;
  });
}
function acorn(r: Relief, x: number, y: number, A: AFn, base: number) {
  r.fill(ell(x, y + 2.2, 2.1, 2.7), dome(x, y + 2.2, 2.1, 2.7, 2.2, base), A, MAT.varnish, { id: 40, seam: true });
  r.fill(ell(x, y, 2.7, 1.6), dome(x, y, 2.7, 1.6, 1.8, base + 0.8), A, MAT.wood, { id: 41, seam: true });
  r.carve(ell(x, y, 2.7, 1.6), (px, py) => (((Math.floor(px * 2) + Math.floor(py * 2)) & 1) ? -0.35 : 0));
  r.fill(seg(x, y - 1.4, x + 0.8, y - 2.8, 0.45), flat(base + 2), A, MAT.wood, { id: 41 });
}
/** A carved songbird in profile on a twig: plump body, cocked tail, a wing in relief, a dot eye. dir 1 faces right. */
function songbird(r: Relief, x: number, y: number, dir: number, A: AFn, base: number, sc = 1) {
  const X = (u: number) => x + u * dir * sc, Y = (v: number) => y + v * sc;
  r.fill(poly([[X(-4.6), Y(-0.6)], [X(-10), Y(-4.4)], [X(-10.6), Y(-2.6)], [X(-5.2), Y(1.6)]]), (px) => base + 1.4 - Math.abs(px - X(-7)) * 0.08, A, MAT.varnish, { id: 50, seam: true });
  r.fill(ell(X(0), Y(0), 5.2 * sc, 3.8 * sc), dome(X(0), Y(0), 5.2 * sc, 3.8 * sc, 3 * sc, base), A, MAT.varnish, { id: 51, seam: true });
  r.fill(disc(X(4), Y(-3), 2.7 * sc), dome(X(4), Y(-3), 2.7 * sc, 2.7 * sc, 2.4 * sc, base + 0.8), A, MAT.varnish, { id: 52, seam: true });
  r.fill(poly([[X(6.2), Y(-3.6)], [X(8.6), Y(-2.9)], [X(6.4), Y(-2.2)]]), flat(base + 2), A, MAT.varnish, { id: 53, seam: true });
  r.fill(ell(X(-1), Y(-0.6), 3.6 * sc, 2.2 * sc), dome(X(-1), Y(-0.6), 3.6 * sc, 2.2 * sc, 1.4 * sc, base + 2.2), A, MAT.varnish, { id: 54, seam: true });
  r.carve(ell(X(-1), Y(-0.6), 3.6 * sc, 2.2 * sc), (px) => (Math.floor((px - X(-1)) * dir * 1.4) % 2 ? -0.35 : 0));
  r.carve(disc(X(4.6), Y(-3.4), 0.55 * sc), () => -1.2);
  for (const lx of [-0.6, 1.4]) r.fill(seg(X(lx), Y(3.2), X(lx + 0.4), Y(5.2), 0.35 * sc), flat(base + 0.8), A, MAT.wood, { id: 55 });
}

// ------------------------------------------------------------------ the case (static, cached per finish)

const bodyCache = new Map<string, Uint32Array>();
function body(fin: Finish): Uint32Array {
  const hit = bodyCache.get(fin.id);
  if (hit) return hit;
  const r = new Relief(CW, CH, 1, CK);
  const W = woodRamp(fin.ramp), RF = woodRamp(fin.roof), K = woodRamp(fin.carve);
  const o = fin.id === 'walnut' ? -0.16 : fin.id === 'cherry' ? -0.04 : fin.id === 'linden' ? 0.02 : 0;
  const grainV = (seed: number, base = 0.5) => woodGrain(W, { seed, base: base + o, along: 'y', scale: 0.8 });
  const grainH = (seed: number, base = 0.5) => woodGrain(W, { seed, base: base + o, scale: 0.8 });
  const carveA = woodGrain(K, { seed: 21, base: 0.62 + o * 0.6, scale: 0.5 });
  const carveD = woodGrain(K, { seed: 22, base: 0.5 + o * 0.6, scale: 0.5 });

  // ---- side pillars: turned half-columns with beads
  for (const px of [8.5, 87.5]) {
    r.fill(rect(px, 50, 4, 72), tubeY(px + 2, 2, 1), woodGrain(K, { seed: 5 + px, base: 0.58, along: 'y', scale: 0.6 }), MAT.varnish, { id: 2, seam: true });
    for (let y = 54; y < 120; y += 7) r.fill(ell(px + 2, y, 2.7, 1.5), dome(px + 2, y, 2.7, 1.5, 1.8, 2), carveA, MAT.varnish, { id: 3, seam: true });
  }
  // ---- the case: a moulded frame round a recessed panel
  r.fill(rect(13, 46, 74, 78), slab(13, 46, 74, 78, 5, 2.4), grainV(3, 0.52), MAT.varnish, { id: 4 });
  r.carve(rect(17, 50, 66, 70), () => -2.6);
  r.paint(rect(17, 50, 66, 70), grainV(4, 0.38));
  r.carve(and(rect(15, 48, 70, 74), not(rect(15.8, 48.8, 68.4, 72.4))), () => -0.7); // a fillet in the moulding
  // ---- base moulding, apron with scallops
  r.fill(rect(7, 123, 86, 5), (x, y) => 6 + 1.6 * Math.sin(clamp((y - 123) / 5) * Math.PI) - (y > 126 ? 0.8 : 0), grainH(6, 0.56), MAT.varnish, { id: 5, seam: true });
  r.fill(rect(10, 128, 80, 4), flat(4), grainH(7, 0.46), MAT.varnish, { id: 6, seam: true });
  for (let i = 0; i < 7; i++) {
    const cx = 15.7 + i * 11.43;
    r.fill(and(ell(cx, 131.6, 5.5, 4), (_x, y) => y > 131.6), dome(cx, 131.6, 5.5, 4, 1.6, 3), grainH(8 + i, 0.48), MAT.varnish, { id: 6 });
  }
  // carved leaves hanging from the apron, acorns between
  for (const [lx, ang] of [[18, 1.95], [29, 1.62], [71, 1.52], [82, 1.2]] as const) leaf(r, lx, 131, ang, 10, 3.6, carveA, 4.5, 1.8);
  acorn(r, 41, 135, carveA, 5); acorn(r, 59, 135, carveA, 5); acorn(r, 50, 137.5, carveD, 5);

  // ---- the gable and its little door
  r.fill(poly([[50, 18], [12, 47], [88, 47]]), (x, y) => 4 + Math.min(2, (y - 18) * 0.06), grainV(9, 0.5), MAT.varnish, { id: 7 });
  const D = DOOR;
  const arch = or(rect(D.x - 2.4, D.y + 3, D.w + 4.8, D.h - 0.5), and(ell(D.x + D.w / 2, D.y + 3, D.w / 2 + 2.4, 5.6), (_x, y) => y <= D.y + 3));
  r.fill(arch, flat(6.2), carveA, MAT.varnish, { id: 8, seam: true });
  const open = or(rect(D.x, D.y + 3, D.w, D.h - 1), and(ell(D.x + D.w / 2, D.y + 3, D.w / 2, 3.8), (_x, y) => y <= D.y + 3));
  r.fill(open, flat(2), solid(hex('#120804')), MAT.wood, { id: 9, seam: true });
  // the perch: a little balcony with turned posts
  r.fill(rect(D.x - 4, D.y + D.h + 1.4, D.w + 8, 2.2), slab(D.x - 4, D.y + D.h + 1.4, D.w + 8, 2.2, 2, 1, 6), carveA, MAT.varnish, { id: 10, seam: true });
  for (let x = D.x - 3; x <= D.x + D.w + 3; x += 2.5) r.fill(rect(x, D.y + D.h + 3.6, 1.1, 3.4), tubeY(x + 0.55, 0.55, 6), carveD, MAT.varnish, { id: 11 });
  r.fill(rect(D.x - 4, D.y + D.h + 6.8, D.w + 8, 1.4), flat(7), carveA, MAT.varnish, { id: 12, seam: true });
  // leaves fanning out from the door
  leaf(r, 37, 41, Math.PI + 0.45, 12, 3.8, carveA, 5.5); leaf(r, 63, 41, -0.45, 12, 3.8, carveA, 5.5);
  leaf(r, 34.5, 45, Math.PI + 0.12, 10, 3.2, carveD, 5.2); leaf(r, 65.5, 45, -0.12, 10, 3.2, carveD, 5.2);

  // ---- the roof: two shingled boards with leaf-carved bargeboards
  for (const sd of [-1, 1]) {
    const roof = poly([[50, 11.5], [50 + sd * 50, 44], [50 + sd * 50, 49.5], [50, 18]]);
    r.fill(roof, (x, y) => {
      const along = Math.abs(x - 50), down = y - (11.5 + along * 0.65);
      const row = Math.floor(down / 2.3), off = row % 2 ? 1.6 : 0;
      const tab = ((along + off) % 3.2) / 3.2, inRow = (down % 2.3) / 2.3;
      return 7 + inRow * 0.9 + Math.sin(tab * Math.PI) * 0.5;
    }, (_x, _y, mx, my) => {
      const along = Math.abs(mx - 50), down = my - (11.5 + along * 0.65);
      const row = Math.floor(down / 2.3), off = row % 2 ? 1.6 : 0;
      const tabi = Math.floor((along + off) / 3.2);
      return rampAt(RF, clamp(0.36 + (hash(tabi, row, 3) - 0.5) * 0.18 + (vnoise(mx * 1.5, my * 0.4, 4) - 0.5) * 0.12));
    }, MAT.wood, { id: 13, seam: true });
    // shingle seams
    r.carve(roof, (x, y) => {
      const along = Math.abs(x - 50), down = y - (11.5 + along * 0.65);
      const row = Math.floor(down / 2.3), off = row % 2 ? 1.6 : 0;
      return (down % 2.3) < 0.36 || ((along + off) % 3.2) < 0.34 ? -0.8 : 0;
    });
    // the bargeboard: a thick carved board along the eave with a row of leaves hanging from it
    const bx0 = 50, by0 = 13.6, bx1 = 50 + sd * 49.5, by1 = 46;
    r.fill(seg(bx0, by0, bx1, by1, 1.9), (x, y) => 9.2 + 0.6 * Math.cos(clamp(Math.abs((y - by0) - Math.abs(x - bx0) * 0.65) / 1.9) * 1.5), carveD, MAT.varnish, { id: 14, seam: true });
    for (let i = 0; i < 6; i++) { const t = 0.16 + i * 0.15, lx = 50 + sd * 49.5 * t, ly = 15.6 + 31.6 * t; leaf(r, lx, ly, sd > 0 ? 1.3 : Math.PI - 1.3, 7.4, 2.7, carveA, 9.6, 1.6); }
  }
  // ridge cap
  r.fill(rect(46.5, 10, 7, 4.6), slab(46.5, 10, 7, 4.6, 2, 1.2, 9), carveA, MAT.varnish, { id: 15, seam: true });

  // ---- the carved bird on the ridge: wings spread, head turned, on a leafy bough
  leaf(r, 50, 13, Math.PI - 0.15, 12, 3.6, carveA, 10); leaf(r, 50, 13, 0.15, 12, 3.6, carveA, 10);
  for (const sd of [-1, 1]) {
    const wing = poly([[50 + sd * 2, 6], [50 + sd * 13, -0.4], [50 + sd * 19, 1.2], [50 + sd * 16.5, 4], [50 + sd * 18, 5.4], [50 + sd * 13, 7.6], [50 + sd * 14, 9.4], [50 + sd * 4, 10]]);
    r.fill(wing, (x, y) => 11 + 1.6 - Math.abs(x - 50) * 0.05 + (y < 4 ? 0.4 : 0), carveA, MAT.varnish, { id: 16, seam: true });
    r.carve(wing, (x, y) => { const a = Math.atan2(y - 9, (x - 50) * sd); return Math.abs(((a * 7) % 1 + 1) % 1 - 0.5) < 0.09 && Math.abs(x - 50) > 5 ? -0.7 : 0; });
  }
  r.fill(ell(50, 7.4, 3.4, 4.4), dome(50, 7.4, 3.4, 4.4, 3, 12), carveA, MAT.varnish, { id: 17, seam: true });
  r.fill(disc(51, 2.6, 2.4), dome(51, 2.6, 2.4, 2.4, 2.4, 13), carveA, MAT.varnish, { id: 18, seam: true });
  r.fill(poly([[53, 2.2], [55.4, 3], [53, 3.8]]), flat(15), carveD, MAT.varnish, { id: 19 });
  r.carve(disc(51.8, 2, 0.5), () => -1.4);

  // ---- carvings on the case: a leafy garland round the dial, acorns, two songbirds
  for (const sd of [-1, 1]) {
    leaf(r, 50 + sd * 17, 57, sd > 0 ? -0.9 : Math.PI + 0.9, 14, 4.4, carveA, 3.4, 2.4);
    leaf(r, 50 + sd * 21, 62, sd > 0 ? -0.25 : Math.PI + 0.25, 13, 4.2, carveD, 3.4, 2.2);
    leaf(r, 50 + sd * 23, 101, sd > 0 ? 0.55 : Math.PI - 0.55, 12, 4, carveA, 3.4, 2.2);
    leaf(r, 50 + sd * 17, 108, sd > 0 ? 1.1 : Math.PI - 1.1, 11, 3.6, carveD, 3.4, 2);
    acorn(r, 50 + sd * 30, 56, carveA, 4.6); acorn(r, 50 + sd * 32.5, 97, carveA, 4.6);
    // a twig and a little songbird in each bottom corner, facing in
    r.fill(seg(50 + sd * 33, 117, 50 + sd * 22, 115.4, 0.7), flat(3.8), carveD, MAT.varnish, { id: 56, seam: true });
    songbird(r, 50 + sd * 28, 110.6, -sd, carveA, 4, 0.82);
  }
  // a carved crescent moon under the dial
  const moon = and(disc(50, 112, 5), not(disc(52.2, 110.6, 4.3)));
  r.fill(moon, (x, y) => 4.4 + 1.4 * Math.sqrt(Math.max(0, 1 - ((x - 50) ** 2 + (y - 112) ** 2) / 25)), carveA, MAT.varnish, { id: 57, seam: true });

  // ---- the dial: a brass bezel, an enamel face, Roman numerals, a minute track
  const F = FACE;
  r.fill(disc(F.x, F.y, F.r), torus(F.x, F.y, F.r - 2, 2.2, 2.6, 4), brass({ base: 0.64, brush: 'r', cx: F.x, cy: F.y }), MAT.brass, { id: 60, seam: true });
  r.carve(ring(F.x, F.y, F.r - 2.3, F.r - 1.7), () => -0.5);
  r.fill(disc(F.x, F.y, F.r - 4), (x, y) => 5.4 - 0.4 * (((x - F.x) ** 2 + (y - F.y) ** 2) / ((F.r - 4) ** 2)), (_x, _y, mx, my) => {
    const d = Math.hypot(mx - F.x, my - F.y) / (F.r - 4);
    return rampAt(PAL.enamel, clamp(0.8 - d * 0.16 + (vnoise(mx * 0.6, my * 0.6, 7) - 0.5) * 0.04));
  }, MAT.enamel, { id: 61, seam: true });
  const ink = hex('#1c120a');
  // minute track: two fine rings and ticks
  r.paint(or(ring(F.x, F.y, F.r - 5.6, F.r - 5.3), ring(F.x, F.y, F.r - 7.6, F.r - 7.3)), solid(ink));
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2, major = i % 5 === 0;
    const r0 = F.r - (major ? 8.2 : 7.6), r1 = F.r - 5.3;
    r.paint(seg(F.x + Math.sin(a) * r0, F.y - Math.cos(a) * r0, F.x + Math.sin(a) * r1, F.y - Math.cos(a) * r1, major ? 0.42 : 0.2), solid(ink));
  }
  // Roman numerals, drawn as strokes (1 art px wide serifs), radially upright like a real dial
  const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2, rr = F.r - 11.4;
    const cx = F.x + Math.sin(a) * rr, cy = F.y - Math.cos(a) * rr;
    r.paint(numeral(ROMAN[h], cx, cy, a), solid(ink));
  }
  // a little sky-blue enamel moon and star at the centre, and the maker's name plate line
  r.paint(and(disc(F.x, F.y + 8.6, 2.6), not(disc(F.x + 1.2, F.y + 7.8, 2.2))), solid(hex('#2a70a3')));
  r.paint(disc(F.x - 3.2, F.y + 7.4, 0.5), solid(hex('#d4a432')));
  const out = r.render();
  const u32 = new Uint32Array(out.buffer.slice(0));
  bodyCache.set(fin.id, u32);
  return u32;
}

/** A Roman numeral as a shape: upright strokes with serifs, rotated to face the centre. 2.2 units tall. */
function numeral(t: string, cx: number, cy: number, ang: number): Shape {
  const H = 3.2, gw = (ch: string) => (ch === 'I' ? 0.7 : 2.1);
  const width = [...t].reduce((w, ch) => w + gw(ch) + 0.35, -0.35);
  const strokes: [number, number, number, number, number][] = [];
  let x = -width / 2;
  for (const ch of t) {
    const w = gw(ch);
    if (ch === 'I') strokes.push([x + w / 2, -H / 2, x + w / 2, H / 2, 0.26]);
    else if (ch === 'V') { strokes.push([x, -H / 2, x + w / 2, H / 2, 0.24]); strokes.push([x + w, -H / 2, x + w / 2, H / 2, 0.18]); }
    else if (ch === 'X') { strokes.push([x, -H / 2, x + w, H / 2, 0.24]); strokes.push([x + w, -H / 2, x, H / 2, 0.18]); }
    x += w + 0.35;
  }
  // serifs: a bar along the top and bottom of the whole numeral
  strokes.push([-width / 2 - 0.2, -H / 2, width / 2 + 0.2, -H / 2, 0.16]);
  strokes.push([-width / 2 - 0.2, H / 2, width / 2 + 0.2, H / 2, 0.16]);
  const c = Math.cos(ang), s = Math.sin(ang), R = width / 2 + H;
  return Object.assign((px: number, py: number) => {
    const dx = px - cx, dy = py - cy, u = dx * c + dy * s, v = -dx * s + dy * c;
    return strokes.some(([x0, y0, x1, y1, w]) => {
      const ex = x1 - x0, ey = y1 - y0, t2 = clamp(((u - x0) * ex + (v - y0) * ey) / (ex * ex + ey * ey || 1));
      return Math.hypot(u - x0 - ex * t2, v - y0 - ey * t2) <= w;
    });
  }, { bb: [cx - R, cy - R, cx + R, cy + R] as [number, number, number, number] });
}

// ------------------------------------------------------------------ moving parts (cached sprites)

interface Sprite { w: number; h: number; d: Uint32Array; ox: number; oy: number }
const spriteCache = new Map<string, Sprite>();
/** paint a relief part in a box of uw x uh units; (ox, oy) = its anchor in units */
function sprite(key: string, uw: number, uh: number, ox: number, oy: number, paint: (r: Relief) => void): Sprite {
  let s = spriteCache.get(key);
  if (s) return s;
  const r = new Relief(uw, uh, 1, CK);
  paint(r);
  const out = r.render();
  s = { w: r.W, h: r.H, d: new Uint32Array(out.buffer.slice(0)), ox: ox * CK, oy: oy * CK };
  spriteCache.set(key, s);
  return s;
}
/** draw a sprite with its anchor at art px (x, y) */
function blit(a: Art, s: Sprite, x: number, y: number, clip?: (X: number, Y: number) => boolean) {
  const X0 = Math.round(x - s.ox), Y0 = Math.round(y - s.oy);
  for (let j = 0; j < s.h; j++) {
    const Y = Y0 + j;
    if (Y < 0 || Y >= a.h) continue;
    for (let i = 0; i < s.w; i++) {
      const v = s.d[j * s.w + i];
      if (!(v >>> 24)) continue;
      const X = X0 + i;
      if (X < 0 || X >= a.w || (clip && !clip(X, Y))) continue;
      a.d[Y * a.w + X] = v;
    }
  }
}
/** draw a sprite rotated by `ang` about its anchor (nearest neighbour keeps it pixel-crisp) */
function blitRot(a: Art, s: Sprite, x: number, y: number, ang: number) {
  const c = Math.cos(ang), si = Math.sin(ang), R = Math.ceil(Math.hypot(Math.max(s.ox, s.w - s.ox), Math.max(s.oy, s.h - s.oy)));
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const sx = Math.round(c * dx + si * dy + s.ox - 0.5), sy = Math.round(-si * dx + c * dy + s.oy - 0.5);
    if (sx < 0 || sy < 0 || sx >= s.w || sy >= s.h) continue;
    const v = s.d[sy * s.w + sx];
    if (!(v >>> 24)) continue;
    const X = Math.round(x + dx), Y = Math.round(y + dy);
    if (X >= 0 && Y >= 0 && X < a.w && Y < a.h) a.d[Y * a.w + X] = v;
  }
}

/** the pendulum bob: a big carved leaf with a brass boss, hung from its top */
const bob = (fin: Finish) => sprite('bob:' + fin.id, 22, 30, 11, 1, (r) => {
  const K = woodRamp(fin.carve), A = woodGrain(K, { seed: 31, base: 0.6, scale: 0.5 });
  leaf(r, 11, 1, Math.PI / 2, 27, 8.6, A, 1, 3);
  leaf(r, 11, 7, Math.PI / 2 + 0.95, 9, 3, woodGrain(K, { seed: 32, base: 0.5, scale: 0.5 }), 3, 1.4);
  leaf(r, 11, 7, Math.PI / 2 - 0.95, 9, 3, woodGrain(K, { seed: 33, base: 0.5, scale: 0.5 }), 3, 1.4);
  r.fill(disc(11, 7, 3.2), dome(11, 7, 3.2, 3.2, 2.4, 4), brass({ base: 0.66 }), MAT.brass, { id: 70, seam: true });
  r.carve(ring(11, 7, 1.6, 2.1), () => -0.6);
});
/** a cast pine-cone weight: rows of overlapping scales, a hook on top */
const cone = () => sprite('cone', 13, 26, 6.5, 0, (r) => {
  r.fill(ring(6.5, 1.6, 0.8, 1.8), torus(6.5, 1.6, 1.3, 0.5, 1, 4), brass({ base: 0.6 }), MAT.brass, { id: 1 });
  r.fill(rect(5.6, 3, 1.8, 2.2), tubeY(6.5, 0.9, 3), metal(IRON_B, { base: 0.5 }), MAT.iron, { id: 2, seam: true });
  r.fill(ell(6.5, 14, 5.6, 9.8), (x, y) => {
    const base = 3 * Math.sqrt(Math.max(0, 1 - ((x - 6.5) / 5.6) ** 2 - ((y - 14) / 9.8) ** 2));
    const row = Math.floor((y - 4) / 1.9), off = row % 2 ? 1.1 : 0;
    const u = ((x - 6.5 + 20 + off) % 2.2) / 2.2, v = ((y - 4) % 1.9) / 1.9;
    return 2 + base + Math.sin(u * Math.PI) * 0.6 * (1 - v) + v * 0.4;
  }, (_x, _y, mx, my) => {
    const row = Math.floor((my - 4) / 1.9), off = row % 2 ? 1.1 : 0, v = ((my - 4) % 1.9) / 1.9;
    const u = ((mx - 6.5 + 20 + off) % 2.2) / 2.2;
    return rampAt(IRON_B, clamp(0.55 - v * 0.35 + Math.sin(u * Math.PI) * 0.12));
  }, { spec: 0.6, shin: 18, env: 0.35, bands: 6 }, { id: 3, seam: true });
});
/** the painted cuckoo, popping out of its door: [beak shut, beak open + wings up] */
const cuckooBird = (hoot: boolean) => sprite('bird:' + hoot, 16, 14, 8, 13, (r) => {
  const breast = (_x: number, _y: number, mx: number, my: number) => (Math.floor(my * 2 + mx * 0.3) % 2 ? hex('#e8d8b8') : hex('#8a7058'));
  const back: AFn = (_x, _y, mx, my) => rampAt([hex('#3a3442'), hex('#55505e'), hex('#706a78'), hex('#8c8794')], clamp(0.5 + (vnoise(mx, my, 3) - 0.5) * 0.3));
  r.fill(ell(8, 9.4, 4.6, 3.8), dome(8, 9.4, 4.6, 3.8, 3, 1), back, MAT.leather, { id: 1 });
  r.fill(ell(8.6, 10.4, 3, 2.6), dome(8.6, 10.4, 3, 2.6, 2, 2.6), breast, MAT.cloth, { id: 2, seam: true });
  r.fill(disc(9.6, 5.4, 2.8), dome(9.6, 5.4, 2.8, 2.8, 2.4, 2), back, MAT.leather, { id: 3, seam: true });
  r.fill(hoot ? or(poly([[12, 4.4], [15.6, 3.2], [12.2, 5.2]]), poly([[12, 5.8], [15.4, 7.2], [12.2, 6.4]])) : poly([[12, 4.8], [15.4, 5.6], [12, 6.4]]), flat(5), solid(hex('#e8a830')), MAT.enamel, { id: 4, seam: true });
  r.fill(disc(10.6, 4.8, 0.7), flat(5), solid(hex('#120a06')), MAT.enamel, { id: 5 });
  r.paint(disc(10.4, 4.5, 0.3), solid(hex('#ffffff')));
  if (hoot) for (const sd of [-1, 1]) r.fill(poly([[8 + sd * 2, 8], [8 + sd * 7, 2.4], [8 + sd * 6.4, 6.4], [8 + sd * 4.4, 9.4]]), flat(4.4), back, MAT.leather, { id: 6, seam: true });
});
/** one leaf of the little door, `w` units wide (narrows as it swings open) */
const doorLeaf = (fin: Finish, w: number, right: boolean) => sprite(`door:${fin.id}:${w}:${right}`, Math.max(1, w), DOOR.h, 0, 0, (r) => {
  const K = woodRamp(fin.carve);
  r.fill(rect(0, 0, w, DOOR.h), slab(0, 0, w, DOOR.h, 1.2, Math.min(0.8, w / 3), 1), woodGrain(K, { seed: right ? 41 : 42, base: 0.62, along: 'y', scale: 0.5 }), MAT.varnish, { id: 1 });
  if (w > 3) { r.carve(rect(w / 2 - 0.25, 1.4, 0.5, DOOR.h - 2.6), () => -0.6); r.fill(disc(right ? 1.3 : w - 1.3, DOOR.h / 2 + 1, 0.6), dome(right ? 1.3 : w - 1.3, DOOR.h / 2 + 1, 0.6, 0.6, 0.6, 2), brass({ base: 0.7 }), MAT.brass, { id: 2 }); }
});

// ------------------------------------------------------------------ hands

/** pierced blued-steel hands: a spade hour hand and a long minute hand with an open loop */
function hands(a: Art, now: number) {
  const F = FACE, cx = F.x * CK, cy = F.y * CK;
  const hA = ((now / 720) % 1) * Math.PI * 2, mA = ((now % 60) / 60) * Math.PI * 2;
  const put = (x: number, y: number, c: number) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < a.w && y < a.h) a.d[y * a.w + x] = c; };
  const C = (h: string, al = 255) => { const v = hex(h); return ((al << 24) | (v[2] << 16) | (v[1] << 8) | v[0]) >>> 0; };
  const STEEL = C('#1e2a44'), STEEL_HI = C('#4f6a9a'), SHADOW = C('#3a2a1a', 90), BRASS_C = C('#e8c24e'), BRASS_D = C('#94661a');
  const hand = (ang: number, len: number, wid: number, tip: 'spade' | 'loop', col: number, hi: number, shadow: boolean) => {
    const s = Math.sin(ang), c = -Math.cos(ang);
    const nx = Math.cos(ang), ny = Math.sin(ang);
    for (let t = -len * 0.18; t <= len; t += 0.5) {
      const w = t < 0 ? wid * 1.1 : t > len * 0.62 && tip === 'spade' ? wid * (1.9 - (t - len * 0.62) / (len * 0.38) * 1.9) : wid * (1 - (t / len) * 0.5);
      for (let q = -w; q <= w; q += 0.5) {
        const x = cx + s * t + nx * q, y = cy + c * t + ny * q;
        if (shadow) put(x + 2, y + 2, SHADOW);
        else put(x, y, q < -w * 0.3 ? hi : col);
      }
    }
    if (tip === 'loop') {
      const lx = cx + s * len * 0.7, ly = cy + c * len * 0.7;
      for (let an = 0; an < Math.PI * 2; an += 0.08) for (const rr of [3.2, 3.8]) {
        const x = lx + Math.cos(an) * rr, y = ly + Math.sin(an) * rr;
        if (shadow) put(x + 2, y + 2, SHADOW); else put(x, y, Math.cos(an + 2.2) > 0.4 ? hi : col);
      }
      if (!shadow) for (let an = 0; an < Math.PI * 2; an += 0.15) for (let rr = 0; rr < 2.8; rr += 0.5) put(lx + Math.cos(an) * rr, ly + Math.sin(an) * rr, 0); // pierced
    }
  };
  for (const sh of [true, false]) {
    hand(hA, (F.r - 12) * CK, 2.2, 'spade', STEEL, STEEL_HI, sh);
    hand(mA, (F.r - 6.4) * CK, 1.5, 'loop', STEEL, STEEL_HI, sh);
  }
  // the brass boss over the arbor
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.hypot(dx, dy); if (d <= 4) put(cx + dx, cy + dy, d > 3.2 ? BRASS_D : dx + dy < -2 ? C('#fff1bd') : BRASS_C); }
  // the glass over the dial catches the window
  const G = C('#ffffff', 150), G2 = C('#ffffff', 220);
  for (let an = 0; an < 0.9; an += 0.012) { const rr = (F.r - 6.2) * CK, x = cx + Math.cos(Math.PI * 1.12 + an) * rr, y = cy + Math.sin(Math.PI * 1.12 + an) * rr; blendPx(a, x, y, an < 0.1 || an > 0.8 ? G : G2); }
}
function blendPx(a: Art, x: number, y: number, c: number) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= a.w || y >= a.h) return;
  const i = y * a.w + x, v = a.d[i], al = (c >>> 24) / 255;
  const r0 = v & 255, g0 = (v >> 8) & 255, b0 = (v >> 16) & 255;
  const r1 = c & 255, g1 = (c >> 8) & 255, b1 = (c >> 16) & 255;
  a.d[i] = ((255 << 24) | (Math.round(b0 + (b1 - b0) * al) << 16) | (Math.round(g0 + (g1 - g0) * al) << 8) | Math.round(r0 + (r1 - r0) * al)) >>> 0;
}

// ------------------------------------------------------------------ chains

function chain(a: Art, x: number, y0: number, y1: number) {
  const X = Math.round(x * CK), Y0 = Math.round(y0 * CK), Y1 = Math.round(y1 * CK);
  const B = PAL.brass.map((c) => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0);
  for (let y = Y0; y < Y1; y++) {
    const link = Math.floor((y - Y0) / 4) % 2, p = (y - Y0) % 4;
    if (link === 0) {
      // a link seen face on: an open oval
      if (p === 0 || p === 3) { a.d[y * a.w + X] = B[p === 0 ? 7 : 3]; }
      else { a.d[y * a.w + X - 1] = B[6]; a.d[y * a.w + X + 1] = B[3]; }
    } else {
      // a link edge on: a short bar
      a.d[y * a.w + X] = B[p < 2 ? 6 : 4];
      if (X + 1 < a.w) a.d[y * a.w + X + 1] = B[2];
    }
    if (X + 2 < a.w && !(a.d[y * a.w + X + 2] >>> 24)) a.d[y * a.w + X + 2] = (90 << 24) | 0x0a0e1a;
  }
}

// ------------------------------------------------------------------ one frame

export interface ClockState {
  /** minutes past midnight, fractional */
  now: number;
  /** pendulum angle, radians */
  swing: number;
  /** 0..1 how far the cuckoo is out; 0 = doors shut */
  cuckoo: number;
  /** the cuckoo's beak is open (mid-call) */
  hoot: boolean;
  /** chain drop of each weight, units (0 = fully wound) */
  drop: [number, number];
  finish: Finish;
}

/** Paint one frame of the clock into `a` (CW*CK x CH*CK art px). */
export function paintCuckoo(a: Art, s: ClockState) {
  a.clear();
  // ---- the pendulum hangs behind the case: a brass rod, then the carved bob
  const P = PIVOT, sw = s.swing;
  const BR = PAL.brass.map((c) => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0);
  for (let t = 0; t < PEND_LEN * CK; t++) {
    const x = Math.round(P.x * CK - Math.sin(sw) * t), y = Math.round(P.y * CK + Math.cos(sw) * t);
    if (y < 0 || y >= a.h) continue;
    a.d[y * a.w + x - 1] = BR[6]; a.d[y * a.w + x] = BR[4]; a.d[y * a.w + x + 1] = BR[2];
  }
  blitRot(a, bob(s.finish), P.x * CK - Math.sin(sw) * PEND_LEN * CK, P.y * CK + Math.cos(sw) * PEND_LEN * CK, sw);
  // ---- the case
  const b = body(s.finish);
  for (let i = 0; i < b.length; i++) if (b[i] >>> 24) a.d[i] = b[i];
  // ---- the cuckoo door and the bird
  const D = DOOR;
  const doorOpen = Math.min(1, s.cuckoo / 0.3), out = Math.max(0, (s.cuckoo - 0.3) / 0.7);
  const inDoor = (X: number, Y: number) => X >= D.x * CK && X < (D.x + D.w) * CK && Y < (D.y + D.h + 2) * CK && (Y >= (D.y + 3) * CK || ((X / CK - D.x - D.w / 2) / (D.w / 2)) ** 2 + ((Y / CK - D.y - 3) / 3.8) ** 2 <= 1);
  if (out > 0) blit(a, cuckooBird(s.hoot), (D.x + D.w / 2) * CK, (D.y + D.h + 1 - (1 - out) * 9 + out * 1.5) * CK, (X, Y) => inDoor(X, Y) || Y < (D.y + D.h + 6) * CK && out > 0.7 && Y > (D.y + D.h - 2) * CK && Math.abs(X / CK - D.x - D.w / 2) < 7);
  const lw = Math.max(1, Math.round((D.w / 2) * (1 - doorOpen)));
  if (doorOpen < 1) {
    blit(a, doorLeaf(s.finish, lw, false), D.x * CK, (D.y + 1) * CK, inDoor);
    blit(a, doorLeaf(s.finish, lw, true), (D.x + D.w - lw) * CK, (D.y + 1) * CK, inDoor);
  }
  if (doorOpen > 0) {
    // the leaves swung out, seen edge on beside the doorway
    const ew = Math.max(1, Math.round(doorOpen * 2.4));
    blit(a, doorLeaf(s.finish, ew, false), (D.x - ew - 0.6) * CK, (D.y + 1.4) * CK);
    blit(a, doorLeaf(s.finish, ew, true), (D.x + D.w + 0.6) * CK, (D.y + 1.4) * CK);
  }
  // ---- hands
  hands(a, s.now);
  // ---- chains, counter rings and the pine-cone weights in front
  WEIGHTS.forEach((w, i) => {
    const drop = s.drop[i], len = 10 + drop;
    chain(a, w.x, CHAIN_TOP, CHAIN_TOP + len);
    blit(a, cone(), w.x * CK, (CHAIN_TOP + len - 0.4) * CK);
    const rlen = 44 - drop;
    chain(a, w.ring, CHAIN_TOP, CHAIN_TOP + rlen);
    blit(a, ringSprite(), w.ring * CK, (CHAIN_TOP + rlen) * CK);
  });
}
const ringSprite = () => sprite('ring', 7, 7, 3.5, 0.4, (r) => {
  r.fill(ring(3.5, 3.5, 1.5, 3.2), torus(3.5, 3.5, 2.35, 0.9, 1.6, 1), metal(PAL.brass, { base: 0.62 }), MAT.brass, { id: 1 });
});

/** The chain drop range for a weight (units). */
export const DROP_MIN = 0, DROP_MAX = 34;
