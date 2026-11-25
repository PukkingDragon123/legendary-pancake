// [ui5] The portrait frames (a cosmetic, see src/assets/frames.ts): eleven round frames for the live owl portrait,
// each an organic painted object modelled with the relief painter: a brass porthole, carved walnut, a mossy willow
// ring with mushrooms, cranberry knit, silver filigree with pearls, a toadstool fairy ring, a golden laurel wreath,
// frost crystals, a celestial orrery, iced gingerbread and a ring of night sky studded with stars. Bright, clean
// light (a high ambient, no cast shadow), real material texture, a coloured outline, chunky art pixels. The opening
// is cut clear; the owl (src/ui/chrome/livepip.tsx) shows through it over a little painted sky (`portraitSky`).
import {
  and, clamp, disc, dome, ell, fbm, flat, hash, hex, metal, MAT, mix, not, PAL, poly, puff, rampAt, Relief, ring, seg, solid, torus, vnoise, weave, woodGrain,
  type AFn, type Mat, type RGB, type Shape,
} from '../px/relief.ts';
import { cachedRelief } from './objects.ts';

/** design units across a frame; the opening's and the ring's radii */
export const FRAME_D = 38;
const C = FRAME_D / 2;
/** the opening's radius in design units (the owl shows inside it) */
export const FRAME_OPEN = 12.6;
const R1 = 17.2;

const ENAMEL: Mat = { spec: 0.8, shin: 40, env: 0.2, bands: 5 };
const SATIN: Mat = { spec: 0.35, shin: 18, bands: 5 };
const ang = (x: number, y: number) => Math.atan2(y - C, x - C);
const dist = (x: number, y: number) => Math.hypot(x - C, y - C);
const at = (a: number, r: number): [number, number] => [C + Math.cos(a) * r, C + Math.sin(a) * r];
/** a ring's surface: albedo by arc length (u) and radius (v), so grain and stitches run round the ring */
const around = (f: (u: number, v: number, a: number) => RGB): AFn => (_x, _y, mx, my) => f(ang(mx, my) * 15, dist(mx, my), ang(mx, my));
const band = (r0 = FRAME_OPEN, r1 = R1) => ring(C, C, r0, r1);
const mid = (FRAME_OPEN + R1) / 2, half = (R1 - FRAME_OPEN) / 2;
const brass = (base = 0.66) => metal(PAL.brass, { base });
const leaf = (cx: number, cy: number, len: number, wid: number, a: number): Shape => {
  const ca = Math.cos(a), sa = Math.sin(a);
  return (x, y) => { const dx = x - cx, dy = y - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; const t = u / len; return t >= -0.5 && t <= 0.5 && Math.abs(v) <= wid * Math.sqrt(Math.max(0, 0.25 - t * t)) * 2; };
};
const star = (cx: number, cy: number, R: number, r0 = 0.45, rot = -Math.PI / 2): Shape => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) { const a = rot + (i / 10) * Math.PI * 2, rr = i % 2 ? R * r0 : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return poly(pts);
};

type Paint = (r: Relief) => void;
const PAINT: Record<string, Paint> = {
  // a ship's porthole: a fat polished brass ring, a moulded inner lip, four domed rivets
  porthole: (r) => {
    r.fill(band(), torus(C, C, mid, half, 3.4, 0.4), brass(0.68), MAT.brass, { id: 1 });
    r.fill(ring(C, C, FRAME_OPEN, FRAME_OPEN + 1.4), torus(C, C, FRAME_OPEN + 0.7, 0.7, 1.4, 2.4), brass(0.5), MAT.brass, { id: 2, seam: true });
    for (let i = 0; i < 4; i++) { const [x, y] = at(-Math.PI * 0.75 + (i * Math.PI) / 2, mid + 0.3); r.fill(disc(x, y, 1.5), dome(x, y, 1.5, 1.5, 1.4, 3.4), brass(0.74), MAT.brass, { id: 3 + i, seam: true }); }
  },
  // carved walnut: honey-oiled grain running round the ring, a beaded outer edge, a cove on the inside
  walnut: (r) => {
    const grain = woodGrain(PAL.walnut, { seed: 8, base: 0.62, scale: 0.7 });
    r.fill(band(), torus(C, C, mid, half, 3, 0.4), around((u, v) => grain(0, 0, u, v * 2)), MAT.varnish, { id: 1 });
    for (let i = 0; i < 20; i++) { const [x, y] = at((i / 20) * Math.PI * 2, R1 - 0.6); r.carve(disc(x, y, 0.55), () => -1.1); }
    r.carve(ring(C, C, FRAME_OPEN + 1.6, FRAME_OPEN + 2.3), () => -0.9);
    for (let i = 0; i < 4; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 2, [x, y] = at(a, mid); r.carve(leaf(x, y, 3.4, 1.3, a + Math.PI / 2), () => 0.8); }
  },
  // a willow twig bent into a ring: bark, knots, clumps of moss, two red mushrooms and a fresh leaf
  moss: (r) => {
    const bark: AFn = around((u, v) => rampAt(PAL.tan, clamp(0.42 + (vnoise(u * 0.9, v * 3, 5) - 0.5) * 0.4 + (hash(Math.floor(u * 2), Math.floor(v * 4), 7) > 0.9 ? -0.18 : 0))));
    r.fill(ring(C, C, FRAME_OPEN, R1 - 0.8), torus(C, C, mid - 0.4, half - 0.4, 3, 0.4), bark, MAT.wood, { id: 1 });
    const mossA: AFn = (_x, _y, mx, my) => rampAt(PAL.moss, clamp(0.55 + (vnoise(mx * 1.4, my * 1.4, 11) - 0.5) * 0.5));
    for (const [a, s] of [[-2.3, 3.2], [-0.9, 2.4], [0.5, 3.4], [2.0, 2.8], [2.9, 2.2]] as [number, number][]) {
      const [x, y] = at(a, mid + 0.6);
      r.fill(and(ell(x, y, s, s * 0.8), (px, py) => vnoise(px * 1.3, py * 1.3, 3) > 0.28), puff(x, y, s, s * 0.8, 2.4, 2.2, 2.6), mossA, MAT.moss, { id: 10, add: true });
    }
    for (const [a, s] of [[-0.55, 1], [-0.25, 0.75]] as [number, number][]) {
      const [x, y] = at(a, R1 - 0.4);
      r.fill(seg(x, y, x + 0.3, y + 2 * s, 0.5 * s), flat(4.2), solid(hex('#f1e4c6')), MAT.paper, { id: 20, seam: true });
      r.fill(and(ell(x, y, 2 * s, 1.5 * s), (_px, py) => py <= y + 0.2), dome(x, y, 2 * s, 1.5 * s, 1.6, 4.6), (_x, _y, mx, my) => (hash(Math.floor(mx * 1.5), Math.floor(my * 1.5), 2) > 0.8 ? hex('#fff6e4') : rampAt(PAL.rose, 0.42)), ENAMEL, { id: 21, seam: true });
    }
    const [lx, ly] = at(2.5, R1);
    r.fill(leaf(lx, ly, 6, 2.2, 2.5 + 0.9), flat(4), (_x, _y, mx, my) => rampAt(PAL.emerald, clamp(0.62 + (vnoise(mx, my, 9) - 0.5) * 0.2)), MAT.moss, { id: 30, seam: true });
  },
  // cranberry wool knitted round, a cable stitch down the middle, a wooden button
  knit: (r) => {
    const R = PAL.rose;
    const wool: AFn = around((u, v) => {
      const row = Math.floor(u * 1.1), side = v < mid ? -1 : 1, k = ((u * 1.1) % 1 + 1) % 1;
      const vv = (v - mid) * side * 1.1, stitch = Math.abs(k - 0.5) * 2 - vv * 0.4; // V stitches
      const cable = Math.abs(v - mid) < 0.9 ? (Math.sin(u * 0.9) * 0.12) : 0;
      return rampAt(R, clamp(0.44 + (stitch > 0.55 ? -0.12 : 0.04) + cable + (hash(row, Math.floor(v * 2), 3) - 0.5) * 0.08));
    });
    r.fill(band(FRAME_OPEN, R1), torus(C, C, mid, half, 3.6, 0.6), wool, MAT.cloth, { id: 1 });
    r.carve(ring(C, C, mid - 0.15, mid + 0.15), () => -0.5);
    const [bx, by] = at(Math.PI * 0.72, mid);
    r.fill(disc(bx, by, 2), dome(bx, by, 2, 2, 1.6, 3.6), woodGrain(PAL.oak, { seed: 2, base: 0.6 }), MAT.varnish, { id: 2, seam: true });
    for (const [dx, dy] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) r.carve(disc(bx + dx, by + dy, 0.35), () => -1.6);
  },
  // silver filigree: a slim polished ring, wire curls all round, a pearl at each quarter
  filigree: (r) => {
    const silver = (b = 0.7) => metal(PAL.iron.map((c) => mix(c, [214, 224, 236] as RGB, 0.45)) as RGB[], { base: b });
    r.fill(ring(C, C, FRAME_OPEN, FRAME_OPEN + 2.2), torus(C, C, FRAME_OPEN + 1.1, 1.1, 2, 0.6), silver(0.74), MAT.brass, { id: 1 });
    r.fill(ring(C, C, R1 - 1.4, R1 - 0.2), torus(C, C, R1 - 0.8, 0.6, 1.4, 0.6), silver(0.7), MAT.brass, { id: 2 });
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const curl: Shape = (x, y) => { const a = ang(x, y), d = dist(x, y); let da = a - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; if (da < 0 || da > 0.5) return false; const want = FRAME_OPEN + 2.4 + (Math.sin(da * 6.28) * 0.5 + 0.5) * 2.4; return Math.abs(d - want) < 0.55; };
      r.fill(curl, flat(1.4), silver(0.78), MAT.brass, { id: 3, seam: true });
    }
    for (let i = 0; i < 4; i++) { const [x, y] = at(-Math.PI / 2 + (i * Math.PI) / 2, mid); r.fill(disc(x, y, 1.7), dome(x, y, 1.7, 1.7, 1.8, 2.2), (_x, _y, mx, my) => mix(hex('#f3ece4'), hex('#ffd9e8'), clamp(0.2 + (mx - x + my - y) * -0.15)), { spec: 1, shin: 60, env: 0.3, bands: 5 }, { id: 10 + i, seam: true }); }
  },
  // a fairy ring: a mossy ground ring with red toadstools growing round it
  mushroom: (r) => {
    const mossA: AFn = (_x, _y, mx, my) => rampAt(PAL.moss, clamp(0.5 + (vnoise(mx * 1.3, my * 1.3, 4) - 0.5) * 0.45));
    r.fill(band(FRAME_OPEN, R1 - 1.2), torus(C, C, mid - 0.6, half - 0.6, 2.6, 0.4), mossA, MAT.moss, { id: 1 });
    const caps: [number, number][] = [[-1.95, 1.1], [-0.75, 0.85], [0.25, 1], [1.25, 0.8], [2.35, 1.05], [-2.95, 0.8]];
    caps.forEach(([a, s], i) => {
      const [x, y] = at(a, R1 - 1.6);
      r.fill(seg(x, y, x, y + 2.2 * s, 0.75 * s), flat(3), solid(hex('#f4e8cc'), 0.1), MAT.paper, { id: 10 + i * 2, seam: true });
      r.fill(and(ell(x, y, 2.6 * s, 2 * s), (_px, py) => py <= y + 0.3), dome(x, y, 2.6 * s, 2 * s, 2, 3.4), (_x, _y, mx, my) => {
        const sp = hash(Math.floor((mx - x) * 1.4 + 9), Math.floor((my - y) * 1.4 + 9), i) > 0.78;
        return sp ? hex('#fff8ec') : rampAt(PAL.rose, 0.4 + (vnoise(mx, my, i) - 0.5) * 0.12);
      }, ENAMEL, { id: 11 + i * 2, seam: true });
    });
  },
  // a golden laurel wreath: two gilded branches meeting under a red ribbon
  laurel: (r) => {
    r.fill(ring(C, C, mid - 0.45, mid + 0.45), flat(1.2), brass(0.5), MAT.brass, { id: 1 });
    for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
      const a = Math.PI / 2 + side * (0.32 + i * 0.31);
      for (const off of [-1.6, 1.6]) {
        const [x, y] = at(a, mid + off * 0.95);
        r.fill(leaf(x, y, 4.2, 1.6, a + side * Math.PI / 2 + off * 0.18 * side), dome(x, y, 2.1, 1.2, 1.6, 1.4), (_x, _y, mx, my) => rampAt(PAL.gold, clamp(0.55 + (vnoise(mx * 0.9, my * 0.9, i) - 0.5) * 0.3)), MAT.brass, { id: 2 + i * 2 + (off > 0 ? 1 : 0), seam: true });
      }
    }
    const [bx, by] = at(Math.PI / 2, mid + 0.4);
    r.fill(or2(poly([[bx - 4.6, by - 1.6], [bx, by], [bx - 4, by + 2.4]]), poly([[bx + 4.6, by - 1.6], [bx, by], [bx + 4, by + 2.4]])), flat(2.6), weave(PAL.leather, { base: 0.68 }), SATIN, { id: 40, seam: true });
    r.fill(ell(bx, by, 1.6, 1.3), dome(bx, by, 1.6, 1.3, 1.2, 2.8), weave(PAL.leather, { base: 0.72 }), SATIN, { id: 41, seam: true });
  },
  // frost: a ring of pale blue ice with crystal shards growing outward and feathery rime
  frost: (r) => {
    const ice: AFn = (_x, _y, mx, my) => { const d = dist(mx, my); return mix(rampAt(PAL.sky, clamp(0.62 + (d - mid) * 0.06)), hex('#ffffff'), clamp(0.18 + (fbm(mx * 0.4, my * 0.4, 6) - 0.5) * 0.6)); };
    const GLASS: Mat = { spec: 1, shin: 70, env: 0.5, bands: 5 };
    r.fill(band(FRAME_OPEN, R1 - 1.6), torus(C, C, mid - 0.8, half - 0.8, 2.6, 0.4), ice, GLASS, { id: 1 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2, len = i % 2 ? 2.6 : 3.6;
      const [x0, y0] = at(a, R1 - 2.4), [x1, y1] = at(a, R1 - 2.4 + len), [xl, yl] = at(a - 0.14, R1 - 1.6), [xr, yr] = at(a + 0.14, R1 - 1.6);
      r.fill(poly([[xl, yl], [x1, y1], [xr, yr], [x0, y0]]), flat(2), ice, GLASS, { id: 5 + i, seam: true });
    }
    r.paint((x, y) => { const d = dist(x, y); return d > FRAME_OPEN + 0.4 && d < R1 - 2 && hash(Math.floor(x * 1.5), Math.floor(y * 1.5), 4) > 0.9; }, solid(hex('#ffffff')));
  },
  // a celestial orrery: midnight enamel between brass rims, gold stars, a brass sun and a silver moon
  celestial: (r) => {
    r.fill(band(), torus(C, C, mid, half, 2.4, 0.6), (_x, _y, mx, my) => (hash(Math.floor(mx * 2), Math.floor(my * 2), 5) > 0.97 ? hex('#dfe8ff') : rampAt(PAL.sapphire, clamp(0.38 + (vnoise(mx * 0.5, my * 0.5, 2) - 0.5) * 0.2))), ENAMEL, { id: 1 });
    r.fill(ring(C, C, FRAME_OPEN, FRAME_OPEN + 1), flat(2.8), brass(0.66), MAT.brass, { id: 2, seam: true });
    r.fill(ring(C, C, R1 - 1, R1), flat(2.6), brass(0.62), MAT.brass, { id: 3, seam: true });
    for (let i = 0; i < 7; i++) { const [x, y] = at(0.5 + i * 0.62, mid); r.fill(star(x, y, 1.3), flat(3), brass(0.8), MAT.brass, { id: 4 + i, seam: true }); }
    const [sx, sy] = at(-Math.PI * 0.75, mid);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; r.fill(poly([[sx + Math.cos(a - 0.3) * 2.2, sy + Math.sin(a - 0.3) * 2.2], [sx + Math.cos(a) * 4, sy + Math.sin(a) * 4], [sx + Math.cos(a + 0.3) * 2.2, sy + Math.sin(a + 0.3) * 2.2]]), flat(3.6), brass(0.76), MAT.brass, { id: 20, seam: true }); }
    r.fill(disc(sx, sy, 2.6), dome(sx, sy, 2.6, 2.6, 1.6, 3.8), metal(PAL.gold, { base: 0.68 }), MAT.brass, { id: 21, seam: true });
    const [mx0, my0] = at(Math.PI * 0.25, mid);
    r.fill(and(disc(mx0, my0, 3), not(disc(mx0 + 1.4, my0 - 1, 2.5))), dome(mx0, my0, 3, 3, 1.6, 3.6), metal(PAL.iron.map((c) => mix(c, [226, 232, 244] as RGB, 0.55)) as RGB[], { base: 0.74 }), MAT.brass, { id: 22, seam: true });
  },
  // gingerbread: a baked golden ring, white piped icing, red and green gumdrops
  gingerbread: (r) => {
    const bake: AFn = (_x, _y, mx, my) => rampAt(PAL.tan, clamp(0.6 + (vnoise(mx * 0.7, my * 0.7, 3) - 0.5) * 0.3 + (hash(Math.floor(mx * 2), Math.floor(my * 2), 8) > 0.95 ? -0.15 : 0)));
    r.fill(band(), torus(C, C, mid, half, 3, 0.8), bake, { spec: 0.15, shin: 8, bands: 5 }, { id: 1 });
    const icing: Shape = (x, y) => { const a = ang(x, y), d = dist(x, y), want = mid + Math.sin(a * 12) * 1.9; return Math.abs(d - want) < 0.6; };
    r.fill(icing, flat(4), solid(hex('#fffaf2'), 0.05), { spec: 0.5, shin: 20, bands: 5 }, { id: 2, add: true });
    const cols = ['#d9343f', '#3f9e52', '#f2b630', '#d9343f', '#3f9e52', '#f2b630'];
    cols.forEach((c, i) => { const [x, y] = at((i / cols.length) * Math.PI * 2 + 0.26, mid); const base = hex(c); r.fill(disc(x, y, 1.5), dome(x, y, 1.5, 1.5, 1.6, 4), (_x, _y, mx, my) => mix(base, hex('#ffffff'), clamp((x - mx + y - my) * 0.25)), ENAMEL, { id: 10 + i, seam: true }); });
  },
  // a ring of deep night sky with gold stars come to rest on it, a fine brass rim each side
  starry: (r) => {
    const sky: AFn = (_x, _y, mx, my) => { const n = hash(Math.floor(mx * 2), Math.floor(my * 2), 9); return n > 0.96 ? hex('#ffffff') : n > 0.93 ? hex('#b8c8ff') : mix(rampAt(PAL.sapphire, 0.3), rampAt(PAL.plum, 0.4), clamp(0.5 + (fbm(mx * 0.2, my * 0.2, 4) - 0.5) * 1.4)); };
    r.fill(band(), torus(C, C, mid, half, 2.8, 0.4), sky, { spec: 0.4, shin: 20, sheen: 0.3, bands: 5 }, { id: 1 });
    r.fill(ring(C, C, FRAME_OPEN, FRAME_OPEN + 0.8), flat(2.6), brass(0.64), MAT.brass, { id: 2, seam: true });
    r.fill(ring(C, C, R1 - 0.8, R1), flat(2.4), brass(0.62), MAT.brass, { id: 3, seam: true });
    const stars: [number, number, number][] = [[-2.2, mid, 2.2], [-1.2, mid + 0.6, 1.4], [-0.4, mid - 0.4, 1.8], [0.6, mid + 0.3, 1.3], [1.4, mid, 2], [2.4, mid - 0.4, 1.4], [3.0, mid + 0.5, 1.7]];
    stars.forEach(([a, d, s], i) => { const [x, y] = at(a, d); r.fill(star(x, y, s, 0.44, -Math.PI / 2 + i * 0.3), dome(x, y, s, s, 1.2, 3), metal(PAL.gold, { base: 0.72 }), MAT.brass, { id: 10 + i, seam: true }); });
  },
};
function or2(a: Shape, b: Shape): Shape { return (x, y) => a(x, y) || b(x, y); }

/** The frame ids that have art. */
export const FRAME_ART_IDS = Object.keys(PAINT);

/**
 * A frame's art as a data URL, `px` art pixels across (it is shown at whatever CSS size it sits in; pick `px` ~ CSS size
 * / 1.33 for chunky pixels). The opening is clear.
 */
export function frameArt(id: string, px = 56): string {
  return cachedRelief(`frame5:${id}:${px}`, () => frameCanvas(id, px).toDataURL('image/png'));
}
const canvases = new Map<string, HTMLCanvasElement>();
function frameCanvas(id: string, px: number): HTMLCanvasElement {
  const key = id + ':' + px;
  let c = canvases.get(key);
  if (!c) {
    const r = new Relief(FRAME_D, FRAME_D, 1, px / FRAME_D);
    r.wobble = 0.3; r.chip = 0.15;
    (PAINT[id] ?? PAINT.porthole)(r);
    r.cut(disc(C, C, FRAME_OPEN));
    c = r.canvas({ ambient: 0.56, light: 0.95 });
    canvases.set(key, c);
  }
  return c;
}

/** A frame with its little painted sky inside (no owl): for prize cards and lists. */
export function frameWithSky(id: string, px = 64): string {
  return cachedRelief(`framesky5:${id}:${px}`, () => {
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const g = c.getContext('2d')!;
    const o = Math.round(px * (0.5 - FRAME_OPEN / FRAME_D)) - 1, d = px - o * 2;
    g.imageSmoothingEnabled = false;
    g.drawImage(skyCanvas(frameSkyOf(id) === 'night', d), o, o, d, d);
    // keep only the round opening's part of the sky (stepped edge), then lay the frame over it
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = '#000';
    for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) if (Math.hypot(x + 0.5 - px / 2, y + 0.5 - px / 2) <= d / 2) g.fillRect(x, y, 1, 1);
    g.globalCompositeOperation = 'source-over';
    g.drawImage(frameCanvas(id, px), 0, 0);
    return c.toDataURL('image/png');
  });
}

/** Which backdrop a frame's opening shows: the time of day's sky, or always the night (the starry frames). */
export const frameSkyOf = (id: string): 'auto' | 'night' => (id === 'starry' || id === 'celestial' ? 'night' : 'auto');

/** A painted sky for behind the owl, `n` art px square: clear cerulean with a soft cloud, or deep blue night with stars. */
export function portraitSky(night: boolean, n = 40): string {
  return cachedRelief(`psky5:${night}:${n}`, () => skyCanvas(night, n).toDataURL('image/png'));
}
const skies = new Map<string, HTMLCanvasElement>();
function skyCanvas(night: boolean, n: number): HTMLCanvasElement {
  const key = night + ':' + n;
  let c0 = skies.get(key);
  if (c0) return c0;
  c0 = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const g = c.getContext('2d')!, img = g.createImageData(n, n), d = img.data;
    const day = [hex('#5ea8d9'), hex('#86c3e8'), hex('#b4dcf2'), hex('#e0f1fa')];
    const nite = [hex('#0d1638'), hex('#14224f'), hex('#1c3168'), hex('#2b4a86')];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const t = y / (n - 1), ramp = night ? nite : day;
      const k = clamp(t * 0.95 + (vnoise(x * 0.25, y * 0.25, 3) - 0.5) * 0.18 + (hash(x, y, 1) - 0.5) * 0.06);
      let col = ramp[Math.min(3, Math.floor(k * 4))];
      if (!night) { const cl = fbm(x * 0.12, y * 0.3, 7); if (cl > 0.6 && y > n * 0.25) col = mix(col, hex('#fbfdff'), cl > 0.68 ? 0.9 : 0.5); }
      else { const s = hash(x, y, 7); if (s > 0.985) col = hex('#f4eedd'); else if (s > 0.975) col = hex('#9fb4e8'); }
      const i = (y * n + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  })();
  skies.set(key, c0);
  return c0;
}
