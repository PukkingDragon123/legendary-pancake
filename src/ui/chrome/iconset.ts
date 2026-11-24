// [ui4] The v4 icon family: every everyday icon in the interface (actions, arrows, status, sleep, sounds,
// wardrobe and build categories, quests, stats) remade as one family of realistic hand-painted pixel
// objects with the relief painter: the same top-left light, the same materials (brass, enamel, walnut,
// leather, linen, paper, glass), a coloured outline and a soft cast shadow, bold silhouettes that read at
// 20 px. Each is a 20 x 20 unit model painted at 2 art px per unit (40 x 40 texels) and registered under
// the existing sprite name, so every <Px name> in the app picks it up; painting is lazy (first use).
import { SPRITES } from '../px/sprites.js';
import {
  and, clamp, disc, dome, ell, flat, hash, hex, leatherGrain, MAT, metal, mix, not, or, PAL, paperGrain, poly, puff, rampAt, rect, Relief, ring,
  roundRect, rrect, seg, slab, solid, torus, tubeX, tubeY, vnoise, weave, woodGrain, type AFn, type Mat, type RGB, type Shape,
} from '../px/relief.ts';

const U = 20, K = 2;
const brass = (base = 0.64) => metal(PAL.brass, { base });
const gold = (base = 0.64) => metal(PAL.gold, { base });
const iron = (base = 0.6) => metal(PAL.iron, { base });
const en = (R: RGB[], v = 0.55) => solid(rampAt(R, v));
const ENAMEL: Mat = { spec: 0.9, shin: 36, env: 0.22, bands: 6 };
const GLASS: Mat = { spec: 1, shin: 60, env: 0.4, bands: 6 };
const wood = (R: RGB[] = PAL.walnut, along: 'x' | 'y' = 'x', base = 0.55) => woodGrain(R, { seed: 5, base, along, scale: 0.5 });
/** a domed profile for a shape: rises `h` over `b` units from its edge (by sampling the shape) */
function pillow(sh: Shape, h: number, b = 2.4, base = 1): (x: number, y: number) => number {
  return (x, y) => {
    let d = b;
    for (let a = 0; a < 8; a++) {
      const dx = Math.cos((a / 8) * Math.PI * 2), dy = Math.sin((a / 8) * Math.PI * 2);
      for (let t = 0.5; t < d; t += 0.5) if (!sh(x + dx * t, y + dy * t)) { d = t; break; }
    }
    return base + h * Math.sqrt(clamp(d / b));
  };
}
/** fill a shape as a puffy, rounded solid */
const blob = (r: Relief, sh: Shape, A: AFn, m: Mat, h = 3, b = 2.4, base = 1, id = 1) => r.fill(sh, pillow(sh, h, b, base), A, m, { id, seam: true });
/** a five-pointed star */
function star5(cx: number, cy: number, R: number, r0 = 0.45, rot = 0): Shape {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = rot - Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? R * r0 : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return poly(pts);
}
/** a chunky arrow pointing right (flipped for left) */
function arrowShape(dir: 1 | -1): Shape {
  const P: [number, number][] = [[3, 8], [10, 8], [10, 3.5], [17.5, 10], [10, 16.5], [10, 12], [3, 12]];
  return poly(P.map(([x, y]) => [dir > 0 ? x : U - x, y] as [number, number]));
}
const crescent = (cx: number, cy: number, R: number, ox = 0.42, oy = -0.18, k = 0.82) => and(disc(cx, cy, R), not(disc(cx + R * ox, cy + R * oy, R * k)));

type Paint = (r: Relief) => void;
const ICONS: Record<string, Paint> = {
  // ---------------------------------------------------------------- actions
  check: (r) => blob(r, or(seg(3.2, 10.6, 8, 15.4, 2.1), seg(8, 15.4, 16.8, 4.6, 2.1)), en(PAL.emerald, 0.62), ENAMEL, 2.4, 1.6),
  cross: (r) => blob(r, or(seg(4.5, 4.5, 15.5, 15.5, 2.2), seg(15.5, 4.5, 4.5, 15.5, 2.2)), en(PAL.rose, 0.5), ENAMEL, 2.4, 1.6),
  plus: (r) => { r.fill(disc(10, 10, 8), dome(10, 10, 8, 8, 2.4, 1), en(PAL.emerald, 0.5), ENAMEL, { id: 1 }); const p = or(rect(5.6, 8.6, 8.8, 2.8), rect(8.6, 5.6, 2.8, 8.8)); r.paint(p, solid(hex('#fff4d6'))); r.carve(p, () => 1); },
  minus: (r) => { r.fill(disc(10, 10, 8), dome(10, 10, 8, 8, 2.4, 1), en(PAL.rose, 0.5), ENAMEL, { id: 1 }); const p = rect(5.6, 8.6, 8.8, 2.8); r.paint(p, solid(hex('#fff4d6'))); r.carve(p, () => 1); },
  arrow_right: (r) => blob(r, arrowShape(1), en(PAL.emerald, 0.6), ENAMEL, 2.6, 2),
  arrow_left: (r) => blob(r, arrowShape(-1), en(PAL.emerald, 0.6), ENAMEL, 2.6, 2),
  arrow_up: (r) => blob(r, poly([[8, 17], [8, 10], [3.5, 10], [10, 2.5], [16.5, 10], [12, 10], [12, 17]]), en(PAL.emerald, 0.6), ENAMEL, 2.6, 2),
  arrow_down: (r) => blob(r, poly([[8, 3], [8, 10], [3.5, 10], [10, 17.5], [16.5, 10], [12, 10], [12, 3]]), en(PAL.rose, 0.55), ENAMEL, 2.6, 2),
  rotate_right: (r) => { blob(r, and(ring(10, 10.5, 4.4, 7.4), not(and(rect(10, 0, 10, 10.5), (x, y) => x > 10 && y < 10.5))), en(PAL.sky, 0.5), ENAMEL, 2.2, 1.4); blob(r, poly([[10.5, 13.2], [17.6, 9.4], [18.6, 16.6]]), en(PAL.sky, 0.5), ENAMEL, 2.2, 1.4, 1, 2); },
  rotate_left: (r) => { blob(r, and(ring(10, 10.5, 4.4, 7.4), not(and(rect(0, 0, 10, 10.5), (x, y) => x < 10 && y < 10.5))), en(PAL.sky, 0.5), ENAMEL, 2.2, 1.4); blob(r, poly([[9.5, 13.2], [2.4, 9.4], [1.4, 16.6]]), en(PAL.sky, 0.5), ENAMEL, 2.2, 1.4, 1, 2); },
  play: (r) => blob(r, poly([[5, 3], [17, 10], [5, 17]]), en(PAL.emerald, 0.6), ENAMEL, 2.6, 2.4),
  pause: (r) => blob(r, or(rect(4.5, 3.5, 4, 13), rect(11.5, 3.5, 4, 13)), en(PAL.sapphire, 0.55), ENAMEL, 2.2, 1.6),
  info: (r) => { r.fill(disc(10, 10, 8.4), dome(10, 10, 8.4, 8.4, 2.6, 1), en(PAL.sapphire, 0.5), ENAMEL, { id: 1 }); const i = or(disc(10, 5.8, 1.5), rect(8.8, 8.6, 2.4, 7)); r.paint(i, solid(hex('#fff4d6'))); r.carve(i, () => 1); },
  // ---------------------------------------------------------------- status
  lock: (r) => {
    r.fill(and(ring(10, 8, 3.2, 5.2), (_x, y) => y < 9.5), torus(10, 8, 4.2, 1, 1.8, 4), iron(0.68), MAT.iron, { id: 1 });
    r.fill(rect(4.2, 8.5, 11.6, 9.5), slab(4.2, 8.5, 11.6, 9.5, 3.4, 1.6, 1), brass(0.66), MAT.brass, { id: 2, seam: true });
    r.carve(or(disc(10, 12.2, 1.4), rect(9.4, 12.2, 1.2, 3)), () => -1.6);
  },
  star: (r) => blob(r, star5(10, 10.6, 9, 0.46), gold(0.66), MAT.brass, 3, 3),
  heart: (r) => blob(r, or(disc(6.4, 7.4, 4.4), disc(13.6, 7.4, 4.4), poly([[2.3, 9], [10, 17.6], [17.7, 9], [10, 7]])), en(PAL.rose, 0.55), ENAMEL, 3.2, 3.4),
  sparkle: (r) => {
    blob(r, poly([[10, 1], [12, 8], [19, 10], [12, 12], [10, 19], [8, 12], [1, 10], [8, 8]]), gold(0.72), MAT.brass, 2.6, 2.6);
    blob(r, poly([[16, 2], [16.8, 4.2], [19, 5], [16.8, 5.8], [16, 8], [15.2, 5.8], [13, 5], [15.2, 4.2]]), solid(hex('#fff6d2')), MAT.glow, 1, 1, 1, 2);
  },
  moon: (r) => {
    const c = crescent(10.6, 10, 8.4, 0.42, -0.2, 0.82);
    blob(r, c, (_x, _y, mx, my) => rampAt([hex('#c49a3a'), hex('#ecc860'), hex('#fadb7a'), hex('#fff0b0')], clamp(0.6 + (vnoise(mx * 0.8, my * 0.8, 4) > 0.7 ? -0.18 : 0))), { spec: 0.4, shin: 20, bands: 6 }, 3, 3.4);
  },
  sun: (r) => {
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; r.fill(poly([[10 + Math.cos(a - 0.22) * 6, 10 + Math.sin(a - 0.22) * 6], [10 + Math.cos(a) * 9.6, 10 + Math.sin(a) * 9.6], [10 + Math.cos(a + 0.22) * 6, 10 + Math.sin(a + 0.22) * 6]]), flat(1.6), gold(0.62), MAT.brass, { id: 1, seam: true }); }
    r.fill(disc(10, 10, 5.6), dome(10, 10, 5.6, 5.6, 3, 1.6), (_x, _y, mx, my) => rampAt([hex('#e07820'), hex('#f2a830'), hex('#fcd050'), hex('#fff0a0')], clamp(0.7 - Math.hypot(mx - 9, my - 9) * 0.05)), { spec: 0.6, shin: 20, bands: 6 }, { id: 2, seam: true });
  },
  shield: (r) => { const sh = poly([[3.5, 3], [16.5, 3], [16.5, 10], [10, 18], [3.5, 10]]); blob(r, sh, en(PAL.sapphire, 0.5), ENAMEL, 2.4, 2); r.carve(and(sh, not(poly([[5, 4.5], [15, 4.5], [15, 9.6], [10, 16], [5, 9.6]]))), () => 0.6); r.paint(and(sh, not(poly([[5, 4.5], [15, 4.5], [15, 9.6], [10, 16], [5, 9.6]]))), brass(0.66), MAT.brass); r.paint(star5(10, 9.6, 3.6, 0.45), gold(0.7), MAT.brass); },
  zzz: (r) => { for (const [x, y, s] of [[3, 11, 1], [10, 6, 0.8], [15, 2, 0.6]] as [number, number, number][]) blob(r, poly([[x, y], [x + 5 * s, y], [x + 5 * s, y + 1.4 * s], [x + 1.8 * s, y + 4.4 * s], [x + 5 * s, y + 4.4 * s], [x + 5 * s, y + 6 * s], [x, y + 6 * s], [x, y + 4.6 * s], [x + 3.2 * s, y + 1.6 * s], [x, y + 1.6 * s]]), en(PAL.sky, 0.72), ENAMEL, 1.6, 1, 1); },
  // ---------------------------------------------------------------- time and sleep
  alarm: (r) => {
    for (const sd of [-1, 1]) r.fill(and(ell(10 + sd * 5.6, 4.6, 3.6, 3.2), (_x, y) => y < 5.6), dome(10 + sd * 5.6, 5.6, 3.6, 3.6, 2.4, 2), brass(0.68), MAT.brass, { id: 1, seam: true });
    for (const sd of [-1, 1]) r.fill(seg(10 + sd * 4, 16, 10 + sd * 6, 19, 0.9), flat(2), brass(0.6), MAT.brass, { id: 2 });
    r.fill(disc(10, 11.4, 7.4), torus(10, 11.4, 6.4, 1.3, 2.4, 2), brass(0.66), MAT.brass, { id: 3, seam: true });
    r.fill(disc(10, 11.4, 5.4), flat(3.4), en(PAL.enamel, 0.86), MAT.enamel, { id: 4, seam: true });
    r.paint(or(seg(10, 11.4, 10, 7.6, 0.45), seg(10, 11.4, 12.8, 12.4, 0.45)), solid(hex('#1d2738')));
  },
  clock: (r) => {
    r.fill(disc(10, 10, 8.8), torus(10, 10, 7.6, 1.4, 2.6, 2), wood(PAL.walnut, 'x', 0.55), MAT.varnish, { id: 1 });
    r.fill(disc(10, 10, 6.4), flat(3), en(PAL.enamel, 0.86), MAT.enamel, { id: 2, seam: true });
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; r.paint(disc(10 + Math.sin(a) * 5.2, 10 - Math.cos(a) * 5.2, i % 3 ? 0.35 : 0.6), solid(hex('#2a1a10'))); }
    r.paint(or(seg(10, 10, 10, 5.4, 0.5), seg(10, 10, 13.4, 11.4, 0.5)), solid(hex('#1d2738')));
  },
  hourglass: (r) => {
    for (const y of [1.6, 16.4]) r.fill(rect(3.4, y, 13.2, 2.2), slab(3.4, y, 13.2, 2.2, 2, 0.8, 2), wood(PAL.walnut), MAT.varnish, { id: 1, seam: true });
    for (const x of [4.4, 14.6]) r.fill(rect(x, 3.6, 1.2, 13), tubeY(x + 0.6, 0.6, 2), wood(PAL.walnut, 'y'), MAT.varnish, { id: 2 });
    const g = poly([[6, 3.8], [14, 3.8], [10.6, 10], [14, 16.2], [6, 16.2], [9.4, 10]]);
    r.fill(g, flat(1.4), (x, y) => (y > 12.6 || (y < 7.4 && y > 5.4 && Math.abs(x - 10) < 2.8) || (Math.abs(x - 10) < 0.5 && y > 9) ? rampAt(PAL.oak, 0.82) : mix(hex('#cfe8f4'), hex('#ffffff'), 0.3)), GLASS, { id: 3, seam: true });
  },
  calendar: (r) => {
    r.fill(rect(2.6, 4, 14.8, 14), slab(2.6, 4, 14.8, 14, 1.6, 1, 1), paperGrain(PAL.paper, { base: 0.82 }), MAT.paper, { id: 1 });
    r.fill(rect(2.6, 4, 14.8, 4.6), slab(2.6, 4, 14.8, 4.6, 1.6, 1, 1.4), en(PAL.rose, 0.5), MAT.leather, { id: 2, seam: true });
    for (const x of [6, 14]) r.fill(rect(x - 0.7, 2.2, 1.4, 4), tubeY(x, 0.7, 3), iron(0.7), MAT.iron, { id: 3 });
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) r.paint(rect(4.2 + i * 3.1, 10 + j * 2.6, 1.8, 1.4), solid(j === 1 && i === 2 ? hex('#c4302b') : hex('#6a5a48')));
  },
  candle: (r) => {
    r.fill(ell(10, 17.4, 6.4, 1.8), dome(10, 17.4, 6.4, 1.8, 1.4, 1), brass(0.62), MAT.brass, { id: 1 });
    r.fill(rect(7, 7, 6, 10.6), tubeY(10, 3, 1.6), (x, y, mx) => rampAt(PAL.linen, clamp(0.86 - Math.abs(mx - 9) * 0.04)), { spec: 0.2, shin: 10, bands: 6 }, { id: 2, seam: true });
    r.fill(seg(10, 5.2, 10, 7.2, 0.3), flat(3), solid(hex('#2a1a10')), MAT.wood, { id: 3 });
    r.fill(and(ell(10, 3.6, 1.9, 3.2), (_x, y) => y < 5.6), flat(4), (_x, _y, mx, my) => rampAt([hex('#e06818'), hex('#f8b030'), hex('#ffe890'), hex('#ffffff')], clamp(1 - Math.hypot(mx - 10, (my - 4.4) * 0.6) * 0.42)), MAT.glow, { id: 4 });
  },
  lantern: (r) => {
    r.fill(ring(10, 2.6, 1, 2.2), torus(10, 2.6, 1.6, 0.6, 1, 3), brass(0.62), MAT.brass, { id: 1 });
    r.fill(poly([[5.6, 6.6], [10, 3.8], [14.4, 6.6]]), flat(3), brass(0.6), MAT.brass, { id: 2, seam: true });
    r.fill(rect(5.4, 6.4, 9.2, 10.4), flat(2), (_x, _y, mx, my) => rampAt([hex('#c86818'), hex('#f0a830'), hex('#ffd870'), hex('#fff4c0')], clamp(0.95 - Math.hypot(mx - 10, my - 11.6) * 0.12)), MAT.glow, { id: 3 });
    for (const x of [5, 14]) r.fill(rect(x, 6.2, 1.2, 11), tubeY(x + 0.6, 0.6, 3), brass(0.6), MAT.brass, { id: 4, seam: true });
    r.fill(rect(4.6, 16.6, 10.8, 2.2), slab(4.6, 16.6, 10.8, 2.2, 1.8, 0.8, 2), brass(0.58), MAT.brass, { id: 5, seam: true });
  },
  nest: (r) => {
    r.fill(ell(10, 12.6, 9, 5), (x, y) => 1 + 3.4 * Math.sqrt(Math.max(0, 1 - ((x - 10) / 9) ** 2 - ((y - 12.6) / 5) ** 2)), (_x, _y, mx, my) => rampAt(PAL.oak, clamp(0.4 + (Math.abs(Math.sin(mx * 2.2 + my * 0.8)) > 0.8 ? 0.3 : 0) + (hash(Math.floor(mx * 2), Math.floor(my * 2), 2) - 0.5) * 0.3)), MAT.wood, { id: 1 });
    for (const [x, c] of [[7.4, '#a8d0e8'], [12.6, '#f4ecd8']] as [number, string][]) r.fill(ell(x, 9.6, 2.6, 3.2), dome(x, 9.6, 2.6, 3.2, 2.6, 3), solid(hex(c)), { spec: 0.5, shin: 30, bands: 6 }, { id: 2, seam: true });
    r.carve(ell(10, 11.8, 6.6, 2.2), () => 0);
  },
  bell: (r) => {
    r.fill(and(ell(10, 10.6, 7.4, 8.4), (_x, y) => y < 15.4), (x, y) => 1 + 4 * Math.sqrt(Math.max(0, 1 - ((x - 10) / 7.4) ** 2 - ((y - 10.6) / 8.4) ** 2)), brass(0.66), MAT.brass, { id: 1 });
    r.fill(ell(10, 15.4, 8.6, 1.8), dome(10, 15.4, 8.6, 1.8, 1.4, 2), brass(0.6), MAT.brass, { id: 2, seam: true });
    r.fill(disc(10, 18, 1.8), dome(10, 18, 1.8, 1.8, 1.4, 2), iron(0.66), MAT.iron, { id: 3, seam: true });
    r.fill(ring(10, 2.2, 0.8, 1.8), torus(10, 2.2, 1.3, 0.5, 1, 3), brass(0.6), MAT.brass, { id: 4 });
  },
  phone_off: (r) => {
    r.fill(rrect(5, 2, 10, 16, 1.4), slab(5, 2, 10, 16, 2, 1, 1), iron(0.36), MAT.iron, { id: 1 });
    r.fill(rect(6.2, 3.8, 7.6, 11.6), flat(2.6), (_x, _y, mx, my) => rampAt(PAL.sapphire, clamp(0.22 + (mx + my) * 0.008)), GLASS, { id: 2, seam: true });
    r.paint(crescent(10, 9.4, 2.6), solid(hex('#fadb7a')));
    blob(r, seg(3.4, 17, 16.6, 3, 1.3), en(PAL.rose, 0.5), ENAMEL, 1.4, 1, 3.4, 3);
  },
  // ---------------------------------------------------------------- sounds
  music: (r) => { blob(r, or(ell(6.4, 15, 3.2, 2.4), ell(14.4, 13, 3.2, 2.4)), en(PAL.sapphire, 0.4), ENAMEL, 2.4, 1.6); r.fill(or(rect(8.6, 4.4, 1.6, 10.6), rect(16.6, 2.4, 1.6, 10.6), poly([[8.6, 4.4], [18.2, 2], [18.2, 5.2], [8.6, 7.6]])), flat(2.4), en(PAL.sapphire, 0.36), ENAMEL, { id: 2, seam: true }); },
  note: (r) => { blob(r, ell(7.6, 15, 3.6, 2.6), en(PAL.sapphire, 0.4), ENAMEL, 2.4, 1.6); r.fill(or(rect(10, 2.6, 1.8, 12.6), poly([[11.8, 2.6], [16.4, 6.4], [15.6, 8.2], [11.8, 5.8]])), flat(2.4), en(PAL.sapphire, 0.36), ENAMEL, { id: 2, seam: true }); },
  mic: (r) => {
    r.fill(and(ring(10, 9, 5.2, 6.4), (_x, y) => y > 9), torus(10, 9, 5.8, 0.6, 1, 1), iron(0.62), MAT.iron, { id: 1 });
    r.fill(rect(9.2, 15, 1.6, 3), tubeY(10, 0.8, 1), iron(0.6), MAT.iron, { id: 2 });
    r.fill(rect(5.6, 17.6, 8.8, 1.6), flat(1.6), iron(0.5), MAT.iron, { id: 3, seam: true });
    r.fill(roundRect(6.4, 1.6, 7.2, 11.6, 3.6), (x) => 2 + 3 * Math.sqrt(Math.max(0, 1 - ((x - 10) / 3.6) ** 2)), (_x, _y, mx, my) => ((Math.floor(mx * 2) + Math.floor(my * 2)) % 2 ? rampAt(PAL.iron, 0.62) : rampAt(PAL.iron, 0.78)), MAT.iron, { id: 4, seam: true });
  },
  speaker_on: (r) => { blob(r, poly([[2.6, 7], [6.4, 7], [11, 3], [11, 17], [6.4, 13], [2.6, 13]]), brass(0.62), MAT.brass, 2, 1.6); for (const rr of [3.2, 6]) r.fill(and(ring(11, 10, rr, rr + 1.3), (x) => x > 12.4), flat(1.6), en(PAL.sky, 0.6), ENAMEL, { id: 2, seam: true }); },
  speaker_off: (r) => { blob(r, poly([[2.6, 7], [6.4, 7], [11, 3], [11, 17], [6.4, 13], [2.6, 13]]), brass(0.6), MAT.brass, 2, 1.6); blob(r, or(seg(12.6, 7, 18, 13, 1.2), seg(18, 7, 12.6, 13, 1.2)), en(PAL.rose, 0.5), ENAMEL, 1.6, 1, 1, 2); },
  rain: (r) => {
    blob(r, or(disc(6.4, 7.6, 3.6), disc(11, 5.6, 4.6), disc(15, 8, 3.2), rect(6.4, 7, 8.6, 4.4)), (_x, _y, mx, my) => rampAt([hex('#5a6878'), hex('#8a9aae'), hex('#c4d2e0'), hex('#eef4f8')], clamp(0.75 - my * 0.03)), MAT.cloth, 2.6, 2.4);
    for (const [x, y] of [[6.4, 14], [10.4, 15.6], [14.4, 14]] as [number, number][]) r.fill(and(ell(x, y + 1, 1.3, 2.2), (_px, py) => py > y - 1.4), dome(x, y + 1, 1.3, 2.2, 1.4, 1), en(PAL.sky, 0.66), GLASS, { id: 2, seam: true });
  },
  drop: (r) => blob(r, or(and(disc(10, 12.4, 5.6)), poly([[10, 1.6], [15, 10.2], [5, 10.2]])), (_x, _y, mx, my) => rampAt(PAL.sky, clamp(0.4 + (20 - my - mx) * 0.02)), GLASS, 3, 3),
  waves: (r) => { for (const [y, v] of [[5.4, 0.7], [10.4, 0.55], [15.4, 0.42]] as [number, number][]) r.fill((x, py) => Math.abs(py - y - Math.sin(x * 0.75) * 1.6) < 1.5, (x, py) => 1.6 - Math.abs(py - y - Math.sin(x * 0.75) * 1.6) * 0.4, en(PAL.sky, v), GLASS, { id: 1 + y, seam: true }); },
  wind: (r) => { for (const [y, l, v] of [[5.6, 12, 0.72], [10, 15, 0.6], [14.4, 10, 0.66]] as [number, number, number][]) { r.fill(rect(2, y - 0.9, l, 1.8), tubeX(y, 0.9, 1), en(PAL.linen, v), MAT.cloth, { id: 1 }); r.fill(and(ring(2 + l, y - 1.8, 1, 2.8), (x) => x > 2 + l - 0.2), flat(1.2), en(PAL.linen, v), MAT.cloth, { id: 2 }); } },
  campfire: (r) => {
    for (const [a, b] of [[[3, 17], [17, 13]], [[3, 13], [17, 17]]] as [number, number][][]) r.fill(seg(a[0], a[1], b[0], b[1], 1.6), (x, y) => 2 + 1.2 * Math.sqrt(Math.max(0, 1 - ((y - (a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))) / 1.6) ** 2)), wood(PAL.walnut, 'x', 0.5), MAT.wood, { id: 1, seam: true });
    r.fill(poly([[5, 14], [7, 7], [9.4, 10], [10.6, 2.4], [13, 9], [14.6, 6.6], [15.6, 14]]), flat(4), (_x, _y, mx, my) => rampAt([hex('#c03818'), hex('#f07020'), hex('#fcb838'), hex('#fff0a0')], clamp(1.1 - my * 0.06 - Math.abs(mx - 10.4) * 0.06)), MAT.glow, { id: 2 });
  },
  leaf: (r) => { const sh = and(ell(10.6, 9.4, 5.6, 8.4), not(ell(4, 2, 2, 2))); blob(r, poly([[10, 18.6], [4.4, 11], [5.4, 4.6], [10, 1.4], [15, 4.4], [16, 10.6]]), (_x, _y, mx, my) => rampAt(PAL.moss, clamp(0.55 + (Math.abs(mx - 10 - (my - 10) * 0.05) < 0.5 ? 0.2 : 0))), MAT.moss, 2.4, 3); r.carve(seg(10, 17, 10.6, 3, 0.4), () => -0.8); void sh; },
  // ---------------------------------------------------------------- objects
  book: (r) => {
    r.fill(poly([[4.4, 4], [6, 2.4], [17, 2.4], [17, 15.6], [15.4, 17.2], [4.4, 17.2]]), flat(1.6), paperGrain(PAL.paper, { base: 0.8 }), MAT.paper, { id: 1 });
    r.fill(rect(3, 4, 12.4, 14.6), slab(3, 4, 12.4, 14.6, 2.6, 1.2, 2), leatherGrain(PAL.leather, { base: 0.56 }), MAT.leather, { id: 2, seam: true });
    r.paint(crescent(9.8, 11, 3.2), gold(0.7), MAT.brass); r.carve(crescent(9.8, 11, 3.2), () => 0.5);
    r.fill(rect(3, 4, 2, 14.6), tubeY(4, 1, 2.6), leatherGrain(PAL.leather, { base: 0.42 }), MAT.leather, { id: 3, seam: true });
  },
  pen: (r) => {
    r.fill(seg(4.6, 15.4, 15.4, 4.6, 2), (x, y) => 1 + 2 * Math.cos(clamp(Math.abs((x - y) / Math.SQRT2) / 2) * 1.5), (_x, _y, mx, my) => rampAt(PAL.sapphire, clamp(0.5 + ((mx + my) % 3 < 1 ? 0.1 : 0))), ENAMEL, { id: 1 });
    r.fill(poly([[3.4, 13.4], [6.6, 16.6], [1.6, 18.4]]), flat(2), gold(0.68), MAT.brass, { id: 2, seam: true });
    r.fill(seg(12, 6, 13.6, 4.4, 2.1), flat(3.2), gold(0.62), MAT.brass, { id: 3, seam: true });
  },
  jar: (r) => {
    r.fill(rect(6.4, 1.8, 7.2, 3), slab(6.4, 1.8, 7.2, 3, 1.6, 0.8, 1), iron(0.6), MAT.iron, { id: 1 });
    r.fill(roundRect(4.4, 4.4, 11.2, 14, 2.4), (x) => 1 + 2.4 * Math.sqrt(Math.max(0, 1 - ((x - 10) / 5.6) ** 2)), (_x, _y, mx, my) => mix(rampAt(PAL.sky, 0.82), hex('#fff4b0'), clamp(0.5 - Math.hypot(mx - 10, my - 12) * 0.08)), GLASS, { id: 2, seam: true });
    for (const [x, y] of [[8, 10], [12, 13.4], [9.6, 15.4], [12.4, 8.6]] as [number, number][]) r.fill(disc(x, y, 1), flat(3.4), solid(hex('#fff27a')), MAT.glow, { id: 3 });
  },
  hanger: (r) => {
    r.fill(and(ring(10, 4, 1.6, 2.7), not(rect(10, 3.4, 3, 3))), torus(10, 4, 2.15, 0.55, 1, 3), iron(0.66), MAT.iron, { id: 1 });
    r.fill(seg(10, 6.4, 10, 8, 0.55), flat(3), iron(0.66), MAT.iron, { id: 1 });
    r.fill(or(seg(10, 8, 2, 14.6, 1.2), seg(10, 8, 18, 14.6, 1.2), seg(2.6, 15, 17.4, 15, 0.9)), flat(3), wood(PAL.cherry, 'x', 0.6), MAT.varnish, { id: 2, seam: true });
  },
  brush: (r) => {
    r.fill(seg(14.6, 5.4, 6.4, 13.6, 1.6), flat(2), wood(PAL.oak, 'x', 0.62), MAT.varnish, { id: 1 });
    r.fill(seg(6.4, 13.6, 5, 15, 2), flat(3), brass(0.64), MAT.brass, { id: 2, seam: true });
    r.fill(poly([[3.2, 13.8], [6.2, 16.8], [3.4, 19], [1, 18.4], [1.2, 16]]), flat(3.2), en(PAL.sky, 0.5), MAT.cloth, { id: 3, seam: true });
  },
  pushpin: (r) => { r.fill(seg(10.6, 11, 14, 18.4, 0.7), flat(1), iron(0.75), MAT.iron, { id: 1 }); r.fill(and(disc(10, 11.4, 5.6), (_x, y) => y > 8.4), dome(10, 11.4, 5.6, 3.6, 2.2, 2), en(PAL.rose, 0.5), ENAMEL, { id: 2, seam: true }); r.fill(disc(10, 7.2, 4.8), dome(10, 7.2, 4.8, 4.8, 4.2, 3), en(PAL.rose, 0.66), ENAMEL, { id: 3, seam: true }); },
  magnifier: (r) => { r.fill(seg(12.6, 12.6, 17.6, 17.6, 1.8), flat(2), wood(PAL.walnut, 'x', 0.5), MAT.varnish, { id: 1 }); r.fill(ring(8.4, 8.4, 4.4, 6.6), torus(8.4, 8.4, 5.5, 1.1, 2, 2), brass(0.66), MAT.brass, { id: 2, seam: true }); r.fill(disc(8.4, 8.4, 4.4), dome(8.4, 8.4, 4.4, 4.4, 1, 2.6), (_x, _y, mx, my) => mix(hex('#cfe8f4'), hex('#ffffff'), clamp((10 - mx - my) * 0.08 + 0.3)), GLASS, { id: 3, seam: true }); },
  clipboard: (r) => {
    r.fill(rect(3, 3, 14, 16), slab(3, 3, 14, 16, 1.6, 1, 1), wood(PAL.oak, 'y', 0.6), MAT.varnish, { id: 1 });
    r.fill(rect(4.6, 5.6, 10.8, 12), flat(2), paperGrain(PAL.paper, { base: 0.86 }), MAT.paper, { id: 2, seam: true });
    for (let i = 0; i < 4; i++) r.paint(rect(6, 8.4 + i * 2.4, i === 3 ? 5 : 8, 0.7), solid(hex('#6a8fb8')));
    r.fill(rect(7, 1.6, 6, 3.8), slab(7, 1.6, 6, 3.8, 1.6, 0.8, 2.4), brass(0.66), MAT.brass, { id: 3, seam: true });
  },
  satchel: (r) => {
    r.fill(and(ring(10, 9, 5, 6.4), (_x, y) => y < 9), torus(10, 9, 5.7, 0.7, 1, 1), leatherGrain(PAL.tan, { base: 0.5 }), MAT.leather, { id: 1 });
    r.fill(rrect(2.6, 8, 14.8, 10.4, 1.6), slab(2.6, 8, 14.8, 10.4, 3, 2, 1), leatherGrain(PAL.tan, { base: 0.56 }), MAT.leather, { id: 2, seam: true });
    r.fill(poly([[2.6, 8], [17.4, 8], [17.4, 12.6], [10, 14.4], [2.6, 12.6]]), flat(4.4), leatherGrain(PAL.tan, { base: 0.46 }), MAT.leather, { id: 3, seam: true });
    r.fill(rect(8.6, 12, 2.8, 2.8), slab(8.6, 12, 2.8, 2.8, 1.4, 0.6, 4.6), brass(0.7), MAT.brass, { id: 4, seam: true });
  },
  map: (r) => {
    const P = [[2, 4.6], [7, 2.6], [13, 4.6], [18, 2.6], [18, 15.4], [13, 17.4], [7, 15.4], [2, 17.4]] as [number, number][];
    r.fill(poly(P), (x) => 1.6 + (x < 7 ? (x - 2) * 0.15 : x < 13 ? 0.8 - (x - 7) * 0.12 : (x - 13) * 0.12), paperGrain(PAL.paper, { base: 0.78 }), MAT.paper, { id: 1 });
    r.paint(or(ell(6, 9, 2.6, 3.4), ell(13.4, 11, 3, 2.4)), en(PAL.moss, 0.6)); r.paint(ell(10, 6.4, 1.8, 1.2), en(PAL.sky, 0.6));
    r.paint(or(seg(5, 13, 8, 11, 0.25), seg(8, 11, 11, 12.6, 0.25), seg(11, 12.6, 14.6, 8, 0.25)), solid(hex('#b0302a')));
    r.paint(or(seg(14, 7, 15.4, 8.4, 0.35), seg(15.4, 7, 14, 8.4, 0.35)), solid(hex('#b0302a')));
  },
  gear: (r) => {
    const sh: Shape = (x, y) => { const d = Math.hypot(x - 10, y - 10), a = Math.atan2(y - 10, x - 10); return d < 6.4 + ((Math.cos(a * 8) + 1) / 2 > 0.45 ? 2.6 : 0) && d > 2.6; };
    r.fill(sh, (x, y) => { const d = Math.hypot(x - 10, y - 10); return 2 + 1.6 * clamp((d - 2.6) / 1.2) - (d > 4.6 && d < 5.4 ? 0.6 : 0); }, metal(PAL.brass, { base: 0.66, brush: 'r', cx: 10, cy: 10 }), MAT.brass, { id: 1 });
  },
  treehouse: (r) => {
    blob(r, or(disc(10, 6.6, 6.2), disc(5, 8.6, 4), disc(15, 8.6, 4)), (_x, _y, mx, my) => rampAt(PAL.moss, clamp(0.52 + (vnoise(mx * 1.2, my * 1.2, 3) - 0.5) * 0.5)), MAT.moss, 2.6, 2.6);
    r.fill(rect(7.4, 10, 5.2, 9), tubeY(10, 2.6, 1), wood(PAL.walnut, 'y', 0.5), MAT.wood, { id: 2, seam: true });
    r.fill(rect(8.8, 13, 2.4, 3), flat(3.6), (_x, _y, mx, my) => rampAt([hex('#c86818'), hex('#ffd870')], clamp(1 - my * 0.03)), MAT.glow, { id: 3 });
  },
  birdhouse: (r) => {
    r.fill(poly([[2.4, 9], [10, 2.4], [17.6, 9]]), flat(3), wood(PAL.cherry, 'x', 0.5), MAT.varnish, { id: 1, seam: true });
    r.fill(rect(4.6, 8.6, 10.8, 8.6), slab(4.6, 8.6, 10.8, 8.6, 2, 1, 1), wood(PAL.oak, 'y', 0.6), MAT.varnish, { id: 2, seam: true });
    r.carve(disc(10, 12, 1.8), () => -2.4);
    r.fill(rect(9.4, 17, 1.2, 2.6), flat(1), wood(PAL.walnut, 'y'), MAT.wood, { id: 3 });
  },
  bolt: (r) => blob(r, poly([[11.6, 1.4], [4.4, 11], [9.6, 11], [7.6, 18.6], [15.6, 8.4], [10.4, 8.4]]), gold(0.7), MAT.brass, 2.4, 2),
  cursor_hand: (r) => {
    // a pointing index finger on the left, the other fingers curled to its right, the thumb tucked low
    const sh = or(roundRect(3.4, 1.6, 3.6, 11, 1.8), roundRect(3, 9.4, 13.6, 9, 2.6), roundRect(6.8, 8.6, 3.2, 4.4, 1.4), roundRect(9.8, 9.2, 3.2, 4, 1.4), roundRect(12.8, 9.8, 3.2, 3.6, 1.4), roundRect(15, 11.4, 3.4, 4.6, 1.6));
    blob(r, sh, (_x, _y, mx, my) => rampAt([hex('#c88860'), hex('#e8b08a'), hex('#f8d4b8'), hex('#fff0e4')], clamp(0.66 - (mx + my) * 0.008)), { spec: 0.15, shin: 8, bands: 6 }, 2.6, 2);
  },
  // ---------------------------------------------------------------- the diary's sections
  stats: (r) => {
    r.fill(rect(2, 17, 16, 1.6), flat(1), wood(PAL.walnut), MAT.wood, { id: 1 });
    for (const [x, h, R] of [[3.4, 6, PAL.sky], [8.2, 10, PAL.emerald], [13, 14, PAL.gold]] as [number, number, RGB[]][]) r.fill(rect(x, 17 - h, 3.8, h), slab(x, 17 - h, 3.8, h, 2, 1, 1), en(R, 0.56), ENAMEL, { id: 2 + x, seam: true });
  },
  nights: (r) => { blob(r, crescent(8.6, 10, 7.4), (_x, _y, mx, my) => rampAt([hex('#c49a3a'), hex('#ecc860'), hex('#fff0b0')], clamp(0.7 - (mx + my) * 0.01)), { spec: 0.4, shin: 20, bands: 6 }, 2.6, 3); for (const [x, y, s] of [[15, 4, 2.6], [16.4, 12.6, 1.8]] as [number, number, number][]) blob(r, star5(x, y, s, 0.45), gold(0.76), MAT.brass, 1.4, 1, 1, 2); },
  things: (r) => {
    r.fill(rect(2.4, 7.8, 15.2, 10.6), slab(2.4, 7.8, 15.2, 10.6, 2.4, 1, 1), wood(PAL.walnut, 'x', 0.55), MAT.varnish, { id: 1 });
    r.fill(and(ell(10, 8.4, 7.6, 5.4), (_x, y) => y < 8.4), (x, y) => 2 + 2.4 * Math.sqrt(Math.max(0, 1 - ((y - 8.4) / 5.4) ** 2)), wood(PAL.walnut, 'x', 0.62), MAT.varnish, { id: 2, seam: true });
    for (const x of [4.4, 15.6]) r.fill(rect(x - 0.9, 3.4, 1.8, 15), flat(3.8), brass(0.62), MAT.brass, { id: 3, seam: true });
    r.fill(rect(8.6, 8.2, 2.8, 3.4), slab(8.6, 8.2, 2.8, 3.4, 1.4, 0.6, 3.6), brass(0.72), MAT.brass, { id: 4, seam: true });
  },
  seals: (r) => {
    r.fill(or(poly([[7, 12], [5, 19], [8, 17.6], [10, 19.4], [10, 13]]), poly([[13, 12], [15, 19], [12, 17.6], [10, 19.4], [10, 13]])), flat(1.4), weave(PAL.sapphire, { base: 0.5 }), MAT.cloth, { id: 1 });
    r.fill(disc(10, 8.6, 7), (x, y) => 2 + 1.6 * Math.sqrt(Math.max(0, 1 - ((x - 10) ** 2 + (y - 8.6) ** 2) / 49)) + (vnoise(x * 2, y * 2, 3) - 0.5) * 0.6, solid(hex('#b8232a')), { spec: 0.7, shin: 30, bands: 6 }, { id: 2, seam: true });
    r.carve(star5(10, 8.8, 3.6, 0.45), () => -0.8);
  },
};
// ---------------------------------------------------------------- the wardrobe's drawers
Object.assign(ICONS, {
  wd_feather: (r) => {
    const sh = poly([[4, 18], [6, 12], [9, 6], [14, 1.6], [16.4, 3.4], [14.6, 9], [10.6, 14], [6, 17]]);
    r.fill(sh, (x, y) => 1.6 + 1.4 * Math.sin(clamp((x + y - 8) / 18) * Math.PI), (_x, _y, mx, my) => rampAt(PAL.tan, clamp(0.55 + (Math.floor((mx - my) * 1.6) % 2 ? 0.08 : -0.06) + (my < 6 ? 0.15 : 0))), MAT.cloth, { id: 1, seam: true });
    r.fill(seg(3.4, 18.6, 14.8, 2.6, 0.45), flat(3.2), solid(hex('#f4e4c4')), MAT.cloth, { id: 2 });
  },
  tophat: (r) => {
    r.fill(ell(10, 15.4, 9, 2.6), dome(10, 15.4, 9, 2.6, 1.6, 1), en(PAL.iron, 0.32), MAT.leather, { id: 1 });
    r.fill(rect(4.6, 3.4, 10.8, 12), tubeY(10, 5.4, 1.6), (_x, _y, mx) => rampAt(PAL.iron, clamp(0.3 + (Math.floor(mx * 2) % 2 ? 0.03 : 0))), { spec: 0.4, shin: 16, sheen: 0.3, bands: 6 }, { id: 2, seam: true });
    r.fill(rect(4.6, 11.2, 10.8, 2.6), tubeY(10, 5.4, 1.9), weave(PAL.rose, { base: 0.5 }), MAT.cloth, { id: 3, seam: true });
    r.fill(ell(10, 3.4, 5.4, 1.4), flat(7), en(PAL.iron, 0.42), MAT.leather, { id: 4 });
  },
  wd_glasses: (r) => {
    for (const x of [5.6, 14.4]) { r.fill(ring(x, 11, 2.8, 4.2), torus(x, 11, 3.5, 0.7, 1.4, 1), gold(0.64), MAT.brass, { id: 1 }); r.fill(disc(x, 11, 2.8), dome(x, 11, 2.8, 2.8, 0.6, 1.8), (_x, _y, mx, my) => mix(hex('#bfe0f0'), hex('#ffffff'), clamp((x + 1 - mx + 10 - my) * 0.12)), GLASS, { id: 2, seam: true }); }
    r.fill(and(ring(10, 11.6, 1.6, 2.4), (_x, y) => y < 11), flat(2), gold(0.64), MAT.brass, { id: 3 });
  },
  wd_scarf: (r) => {
    const A: AFn = (_x, _y, mx, my) => rampAt((Math.floor((my + mx * 0.2) / 2.4) % 2 ? PAL.rose : PAL.linen), clamp(0.55 + (((Math.floor(mx * 2) + Math.floor(my * 2)) & 1) ? 0.05 : -0.05)));
    // a striped knitted scarf in a loose S, fringed at both ends
    const band: Shape = Object.assign((x: number, y: number) => { const c = 10 + Math.sin((y - 2) * 0.42) * 4.2; return y > 2.4 && y < 17 && Math.abs(x - c) < 2.6; }, { bb: [2, 2, 18, 17] as [number, number, number, number] });
    r.fill(band, (x, y) => { const c = 10 + Math.sin((y - 2) * 0.42) * 4.2; return 1.6 + 1.6 * Math.sqrt(Math.max(0, 1 - ((x - c) / 2.6) ** 2)); }, A, MAT.cloth, { id: 1 });
    for (const [y0, dy] of [[2.6, -1], [16.8, 1]] as [number, number][]) { const c = 10 + Math.sin((y0 - 2) * 0.42) * 4.2; for (let i = 0; i < 4; i++) r.fill(seg(c - 1.8 + i * 1.2, y0, c - 1.8 + i * 1.2, y0 + dy * 1.8, 0.3), flat(2), en(PAL.rose, 0.5), MAT.cloth, { id: 3 }); }
  },
  wd_sweater: (r) => {
    const sh = poly([[6, 3], [8.4, 2.4], [10, 4], [11.6, 2.4], [14, 3], [18.6, 7.4], [16.2, 10.4], [15, 9.4], [15, 18], [5, 18], [5, 9.4], [3.8, 10.4], [1.4, 7.4]]);
    r.fill(sh, pillow(sh, 2.2, 2.4, 1), (_x, _y, mx, my) => rampAt(PAL.emerald, clamp(0.55 + (Math.floor(my * 2) % 3 === 0 ? -0.06 : 0) + (Math.abs(((mx * 2) % 3) - 1.5) < 0.5 ? 0.05 : 0))), MAT.cloth, { id: 1, seam: true });
    r.paint(or(rect(5, 15.6, 10, 2.4), rect(5.6, 12, 8.8, 1)), en(PAL.linen, 0.8));
  },
  wd_cape: (r) => {
    const sh = poly([[7.4, 2.6], [12.6, 2.6], [17.4, 17.4], [13.6, 18.4], [10, 17.2], [6.4, 18.4], [2.6, 17.4]]);
    r.fill(sh, (x, y) => 1.4 + Math.abs(Math.sin((x - 10) * 0.9)) * 1.2 + y * 0.04, (_x, _y, mx, my) => rampAt(PAL.plum, clamp(0.46 + Math.sin((mx - 10) * 0.9) * 0.1)), MAT.velvet, { id: 1 });
    r.fill(disc(10, 3.6, 1.6), dome(10, 3.6, 1.6, 1.6, 1.4, 3), gold(0.7), MAT.brass, { id: 2, seam: true });
  },
  wd_mirror: (r) => {
    r.fill(ell(10, 9, 6.4, 8), (x, y) => 1 + 2.4 * Math.sqrt(Math.max(0, 1 - ((x - 10) / 6.4) ** 2 - ((y - 9) / 8) ** 2)), gold(0.64), MAT.brass, { id: 1 });
    r.fill(ell(10, 9, 4.6, 6.2), flat(2.4), (_x, _y, mx, my) => mix(hex('#a8c8e0'), hex('#ffffff'), clamp(0.2 + (Math.abs((mx - 10) + (my - 9) * 0.5 + 1.6) < 1 ? 0.6 : 0))), GLASS, { id: 2, seam: true });
    r.fill(rect(9, 16.6, 2, 2.4), flat(1.6), gold(0.6), MAT.brass, { id: 3 });
  },
  wd_frame: (r) => {
    r.fill(rect(2, 2, 16, 16), slab(2, 2, 16, 16, 2.4, 2.4, 1), gold(0.62), MAT.brass, { id: 1 });
    r.fill(rect(5, 5, 10, 10), flat(1.4), en(PAL.sky, 0.7), MAT.paper, { id: 2, seam: true });
  },
  // ---------------------------------------------------------------- the build tabs
  bp_box: (r) => {
    r.fill(poly([[2.6, 7.4], [10, 4.4], [17.4, 7.4], [17.4, 16.4], [10, 19], [2.6, 16.4]]), (x) => 1.6 + (x < 10 ? 1.2 : 0.8), (x, _y, mx, my) => rampAt(PAL.tan, clamp((x < 10 ? 0.62 : 0.48) + (vnoise(mx, my, 4) - 0.5) * 0.08)), MAT.paper, { id: 1 });
    r.carve(seg(10, 10.4, 10, 19, 0.3), () => -0.8);
    r.fill(poly([[2.6, 7.4], [10, 4.4], [17.4, 7.4], [10, 10.4]]), flat(3.4), (_x, _y, mx, my) => rampAt(PAL.tan, clamp(0.72 + (vnoise(mx, my, 5) - 0.5) * 0.08)), MAT.paper, { id: 2, seam: true });
    r.paint(seg(6.2, 5.9, 13.8, 8.9, 0.8), solid(hex('#e8d8b0')));
  },
  bp_bed: (r) => {
    r.fill(rect(2, 5, 3, 13), slab(2, 5, 3, 13, 2, 1, 1), wood(PAL.cherry, 'y'), MAT.varnish, { id: 1 });
    r.fill(rect(15, 9, 3, 9), slab(15, 9, 3, 9, 2, 1, 1), wood(PAL.cherry, 'y'), MAT.varnish, { id: 1 });
    r.fill(rect(4, 10, 12, 5), pillow(rect(4, 10, 12, 5), 2.4, 1.6, 1.6), weave(PAL.sapphire, { base: 0.5 }), MAT.cloth, { id: 2, seam: true });
    blob(r, ell(7.4, 9.4, 3, 1.8), weave(PAL.linen, { base: 0.82 }), MAT.cloth, 2.2, 1.4, 2, 3);
    r.fill(rect(4, 14.6, 12, 1.8), flat(1.4), wood(PAL.cherry), MAT.varnish, { id: 4, seam: true });
  },
  bp_chair: (r) => {
    r.fill(rect(4.6, 2.4, 10.8, 8), slab(4.6, 2.4, 10.8, 8, 2, 1.4, 1), weave(PAL.plum, { base: 0.5 }), MAT.velvet, { id: 1 });
    r.fill(rect(3.4, 10, 13.2, 4), pillow(rect(3.4, 10, 13.2, 4), 2.4, 1.6, 2), weave(PAL.plum, { base: 0.58 }), MAT.velvet, { id: 2, seam: true });
    for (const x of [4.4, 14.6]) r.fill(rect(x, 13.6, 1.4, 5), tubeY(x + 0.7, 0.7, 1), wood(PAL.walnut, 'y'), MAT.varnish, { id: 3, seam: true });
  },
  bp_table: (r) => {
    r.fill(rect(1.6, 6, 16.8, 3), slab(1.6, 6, 16.8, 3, 2.4, 1, 2), wood(PAL.oak, 'x', 0.62), MAT.varnish, { id: 1 });
    for (const x of [3.4, 15.2]) r.fill(rect(x, 9, 1.6, 9.4), tubeY(x + 0.8, 0.8, 1), wood(PAL.oak, 'y', 0.5), MAT.varnish, { id: 2, seam: true });
    r.fill(and(ell(10, 4.6, 2.2, 2.4), (_x, y) => y < 6.2), dome(10, 6, 2.2, 2.4, 1.6, 4), en(PAL.enamel, 0.86), MAT.enamel, { id: 3, seam: true });
  },
  bp_shelf: (r) => {
    r.fill(rect(3, 1.6, 14, 17), slab(3, 1.6, 14, 17, 2, 1, 1), wood(PAL.walnut, 'y', 0.5), MAT.varnish, { id: 1 });
    for (const y of [3.4, 10.4]) { r.carve(rect(4.6, y, 10.8, 5.6), () => -1.4); }
    for (const [x, c] of [[5, PAL.leather], [6.8, PAL.sapphire], [8.4, PAL.emerald], [10.2, PAL.gold]] as [number, RGB[]][]) r.fill(rect(x, 4.2, 1.6, 4.8), flat(1.4), en(c, 0.5), MAT.leather, { id: 2 + x, seam: true });
    r.fill(disc(13, 13.2, 1.8), dome(13, 13.2, 1.8, 1.8, 1.4, 1.2), brass(0.66), MAT.brass, { id: 9, seam: true });
  },
  bp_lamp: (r) => {
    r.fill(poly([[5, 9.4], [7.6, 2.4], [12.4, 2.4], [15, 9.4]]), (x) => 1.6 + 1.4 * Math.sin(clamp((x - 5) / 10) * Math.PI), (_x, _y, mx, my) => rampAt([hex('#c87830'), hex('#f0b850'), hex('#ffe090'), hex('#fff8d0')], clamp(0.9 - Math.abs(mx - 10) * 0.06 - my * 0.02)), MAT.glow, { id: 1 });
    r.fill(rect(9.2, 9.4, 1.6, 7), tubeY(10, 0.8, 1), brass(0.62), MAT.brass, { id: 2, seam: true });
    r.fill(ell(10, 17.4, 5, 1.8), dome(10, 17.4, 5, 1.8, 1.4, 1), brass(0.6), MAT.brass, { id: 3, seam: true });
  },
  bp_plant: (r) => {
    for (const [a, l] of [[-2.3, 8], [-1.6, 9], [-0.9, 8], [-2.9, 6], [-0.3, 6]] as [number, number][]) {
      const cx = 10 + Math.cos(a) * l * 0.5, cy = 10 + Math.sin(a) * l * 0.5;
      r.fill(ell(cx, cy, 2.2, l * 0.5), (x, y) => 1.6 + 1.4 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 2.2) ** 2 - ((y - cy) / (l * 0.5)) ** 2)), (_x, _y, mx, my) => rampAt(PAL.emerald, clamp(0.5 + (my < cy ? 0.12 : 0) + (vnoise(mx, my, 2) - 0.5) * 0.1)), MAT.moss, { id: 1 + Math.round(a * 10), seam: true });
    }
    r.fill(poly([[5, 12], [15, 12], [13.6, 18.6], [6.4, 18.6]]), (x) => 1.6 + 1.6 * Math.sin(clamp((x - 5) / 10) * Math.PI), en(PAL.copper, 0.55), { spec: 0.3, shin: 14, bands: 6 }, { id: 9, seam: true });
    r.fill(rect(4.6, 11.4, 10.8, 2), slab(4.6, 11.4, 10.8, 2, 1.4, 0.8, 3.4), en(PAL.copper, 0.62), { spec: 0.3, shin: 14, bands: 6 }, { id: 10, seam: true });
  },
  bp_rug: (r) => {
    const sh = poly([[1.4, 11.4], [7, 5], [18.6, 8.6], [13, 15]]);
    r.fill(sh, flat(1.4), (_x, _y, mx, my) => { const u = Math.abs((mx - 10) * 0.6 + (my - 10) * 0.4), v = Math.abs((my - 10) - (mx - 10) * 0.4); return u + v < 2 ? rampAt(PAL.gold, 0.6) : u + v < 3.4 ? rampAt(PAL.sapphire, 0.5) : rampAt(PAL.rose, 0.5 + (((Math.floor(mx * 2) + Math.floor(my * 2)) & 1) ? 0.04 : 0)); }, MAT.cloth, { id: 1 });
    for (let i = 0; i < 6; i++) { const x = 1.6 + i * 1.1, y = 11.8 + i * 0.6; r.fill(seg(x, y, x - 0.8, y + 1.4, 0.3), flat(1), en(PAL.linen, 0.8), MAT.cloth, { id: 2 }); }
  },
  bp_wall: (r) => {
    r.fill(rect(2, 3, 16, 14), slab(2, 3, 16, 14, 2.4, 2.2, 1), gold(0.62), MAT.brass, { id: 1 });
    r.fill(rect(4.6, 5.6, 10.8, 8.8), flat(1.6), (_x, _y, mx, my) => (my > 11 - Math.sin(mx * 0.8) * 0.8 ? rampAt(PAL.moss, 0.55) : my > 9 && Math.abs(mx - 11) < 3 - (my - 9) * -0.5 ? rampAt(PAL.walnut, 0.4) : rampAt(PAL.sky, 0.7 - my * 0.02)), MAT.paper, { id: 2, seam: true });
    r.paint(disc(7, 7.6, 1.2), solid(hex('#fff0a0')));
  },
  bp_decor: (r) => {
    r.fill(poly([[7.4, 8], [12.6, 8], [14.6, 12.4], [12.6, 18.4], [7.4, 18.4], [5.4, 12.4]]), (x) => 1.6 + 2 * Math.sin(clamp((x - 5.4) / 9.2) * Math.PI), en(PAL.sky, 0.55), { spec: 0.9, shin: 40, env: 0.2, bands: 6 }, { id: 1 });
    for (const [x, y, c] of [[7, 4.2, PAL.rose], [12.6, 3.6, PAL.gold], [10, 2.4, PAL.rose]] as [number, number, RGB[]][]) { r.fill(seg(10, 8, x, y + 1.4, 0.35), flat(2), en(PAL.moss, 0.5), MAT.moss, { id: 2 }); blob(r, disc(x, y, 1.9), en(c, 0.6), MAT.cloth, 1.6, 1.2, 2.6, 3); }
  },
  bp_fun: (r) => {
    r.fill(disc(10, 11, 7.6), (x, y) => 1 + 3.4 * Math.sqrt(Math.max(0, 1 - ((x - 10) ** 2 + (y - 11) ** 2) / 57.8)), (_x, _y, mx, my) => (my > 11.4 ? mix(rampAt(PAL.sky, 0.5), hex('#ffffff'), 0.15) : mix(hex('#dff0f8'), hex('#ffffff'), 0.4)), GLASS, { id: 1 });
    blob(r, or(ell(9.4, 14, 2.8, 1.6), poly([[11.6, 14], [14, 12.4], [14, 15.6]])), en(PAL.copper, 0.62), ENAMEL, 1.4, 1, 3.4, 2);
    r.fill(ell(10, 4, 5, 1.2), flat(4), solid(mix(hex('#cfe8f4'), hex('#ffffff'), 0.5)), GLASS, { id: 3 });
  },
  bp_wallpaper: (r) => {
    r.fill(rect(4, 2, 9, 16), flat(1.6), (_x, _y, mx, my) => (((Math.floor(mx / 2) + Math.floor(my / 2)) % 3 === 0) ? rampAt(PAL.rose, 0.6) : rampAt(PAL.linen, 0.8)), MAT.paper, { id: 1 });
    r.fill(rect(12, 2, 4.4, 16), tubeY(14.2, 2.2, 1.6), (_x, _y, mx, my) => (((Math.floor(mx / 2) + Math.floor(my / 2)) % 3 === 0) ? rampAt(PAL.rose, 0.6) : rampAt(PAL.linen, 0.8)), MAT.paper, { id: 2, seam: true });
  },
  bp_floor: (r) => {
    for (let i = 0; i < 4; i++) r.fill(rect(2, 2.4 + i * 4, 16, 3.8), slab(2, 2.4 + i * 4, 16, 3.8, 1.6, 0.8, 1), woodGrain(PAL.oak, { seed: i + 2, base: 0.5 + (i % 2) * 0.08, scale: 0.5 }), MAT.varnish, { id: 1 + i, seam: true });
  },
  bp_season: (r) => {
    r.fill(rrect(3, 7, 14, 11, 1), slab(3, 7, 14, 11, 2.4, 1.2, 1), weave(PAL.rose, { base: 0.5 }), MAT.cloth, { id: 1 });
    r.fill(or(rect(8.8, 7, 2.4, 11), rect(3, 11.4, 14, 2.4)), flat(3.6), gold(0.66), MAT.brass, { id: 2, seam: true });
    blob(r, or(ell(7.4, 5.4, 3, 2), ell(12.6, 5.4, 3, 2)), gold(0.7), MAT.brass, 1.6, 1.2, 3, 3);
  },
  bp_move: (r) => {
    const A = or(rect(9, 4, 2, 12), rect(4, 9, 12, 2), poly([[10, 1], [13.6, 4.6], [6.4, 4.6]]), poly([[10, 19], [13.6, 15.4], [6.4, 15.4]]), poly([[1, 10], [4.6, 6.4], [4.6, 13.6]]), poly([[19, 10], [15.4, 6.4], [15.4, 13.6]]));
    blob(r, A, en(PAL.sky, 0.55), ENAMEL, 1.8, 1.2);
  },
  bp_buy: (r) => {
    r.fill(poly([[2.6, 6], [8, 2.4], [17.4, 2.4], [17.4, 13.6], [8, 13.6]]), slab(2.6, 2.4, 14.8, 11.2, 1.6, 1, 1), paperGrain(PAL.oak, { base: 0.72 }), MAT.paper, { id: 1 });
    r.carve(disc(6.4, 8, 1.2), () => -1.6);
    const p = or(rect(10.4, 7, 5, 1.8), rect(12, 5.4, 1.8, 5)); r.paint(p, en(PAL.emerald, 0.5)); r.carve(p, () => 0.6);
    r.fill(seg(6.4, 8, 2.6, 17.6, 0.45), flat(2), en(PAL.rose, 0.5), MAT.cloth, { id: 2 });
  },
  ice_flake: (r) => { for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI; r.fill(seg(10 - Math.cos(a) * 8, 10 - Math.sin(a) * 8, 10 + Math.cos(a) * 8, 10 + Math.sin(a) * 8, 1), flat(2), en(PAL.sky, 0.78), GLASS, { id: 1 }); } r.fill(disc(10, 10, 2), dome(10, 10, 2, 2, 1, 2), en(PAL.sky, 0.9), GLASS, { id: 2, seam: true }); },
} as Record<string, Paint>);
// names that share a model
ICONS.wd_hanger = ICONS.hanger;

const cache = new Map<string, { w: number; h: number; rows: string[]; pal: Record<string, string>; hi: { w: number; h: number; rows: string[]; pal: Record<string, string>; px: { d: Uint8ClampedArray } }; res: number }>();
function paintIcon(name: string) {
  const r = new Relief(U, U, 1, K);
  ICONS[name](r);
  r.shadow = { dx: 0.5, dy: 0.5, a: 90 };
  const d = r.render();
  return { w: U, h: U, rows: [], pal: {}, hi: { w: U * K, h: U * K, rows: [], pal: {}, px: { d } }, res: K };
}

let done = false;
/** Register the whole family over the sprite names (lazy: each is painted the first time it's drawn). */
export function installIconSet() {
  if (done) return;
  done = true;
  for (const name of Object.keys(ICONS)) {
    Object.defineProperty(SPRITES, name, {
      enumerable: true, configurable: true,
      get() { let s = cache.get(name); if (!s) { s = paintIcon(name); cache.set(name, s); } return s; },
    });
  }
}
/** the names in the family (for the dev sheet) */
export const ICON_NAMES = () => Object.keys(ICONS);

void puff; void rrect; void dome;
