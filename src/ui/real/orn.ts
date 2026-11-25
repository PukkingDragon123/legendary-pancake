// [ui10] Ornament: the hand-made details the interface's objects are dressed in, painted by the material
// painter (paint.ts) onto a Real surface. Every piece is modelled (height, material, a thin ink line where it
// sits on something) so it catches the same warm top-left light as the rest:
//
//   rivet / rosette / acanthus / cScroll    domed rivets, carved rosettes, lobed acanthus leaves, curling C-scrolls
//   filigreeCorner                          a pierced, engraved brass corner piece with three rivets
//   carvedCorner                            a carved acanthus-and-scroll corner block standing proud of a frame
//   alongRect                               places repeating elements round a rounded rectangle (9-slice safe)
//   stitches / beads / milgrain / rope       stitched thread, gilt pearls, a beaded rim, twisted rope
//   stringing                               an inlaid line of contrasting wood (marquetry stringing)
//   waxSeal                                 a poured wax seal with a moon-and-star stamp
//   flourish                                a printed (inked) corner flourish for paper borders
import {
  BRASS_OLD, GOLD, Real, bevel, box, circle, clamp, cloth, curve, cutBox, dome, ellipse, enamel, hex, metal, mix, pillow, polygon, rotate, segment,
  spiralPts, subtract, union, warp, type Material, type RGB, type SDF,
} from './paint.ts';

export type Pt = [number, number];
const brass = (p = 0.6, col: RGB = BRASS_OLD) => metal(col, { polish: p });

/** a domed rivet (or a nail head), inked round its edge */
export function rivet(r: Real, x: number, y: number, rad = 1.5, z = 0, col: RGB = BRASS_OLD, polish = 0.65) {
  r.part(circle(x, y, rad), dome(x, y, rad, rad, rad * 0.85, z + 0.4), metal(col, { polish }), { line: true });
}

/** a carved rosette: `n` rounded petals round a domed boss */
export function rosette(r: Real, cx: number, cy: number, rad: number, z: number, m: Material, n = 8, boss?: Material) {
  const pet: SDF[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pet.push(rotate(ellipse(cx + Math.cos(a) * rad * 0.55, cy + Math.sin(a) * rad * 0.55, rad * 0.46, rad * 0.26), a, cx + Math.cos(a) * rad * 0.55, cy + Math.sin(a) * rad * 0.55));
  }
  const fl = union(...pet);
  r.part(fl, (x, y) => z + rad * 0.32 * Math.max(0.2, 1 - Math.hypot(x - cx, y - cy) / rad) + 0.5, m, { line: true });
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    r.carve(segment(cx + Math.cos(a) * rad * 0.3, cy + Math.sin(a) * rad * 0.3, cx + Math.cos(a) * rad * 0.82, cy + Math.sin(a) * rad * 0.82, rad * 0.05), rad * 0.12, rad * 0.06);
  }
  const br = rad * 0.32;
  r.part(circle(cx, cy, br), dome(cx, cy, br, br, br * 0.9, z + rad * 0.3), boss ?? m, { line: true });
}

/** a lobed acanthus leaf from `p` pointing along `ang`, `len` long: three lobes a side, a carved midrib */
export function acanthus(r: Real, px: number, py: number, len: number, ang: number, z: number, m: Material, wid = 0.42) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const at = (u: number, v: number): Pt => [px + c * u - s * v, py + s * u + c * v];
  const parts: SDF[] = [];
  const W = len * wid;
  for (let i = 0; i < 4; i++) {
    const u = len * (0.22 + i * 0.2), sz = W * (1 - i * 0.2);
    for (const side of [-1, 1]) {
      const [x, y] = at(u, side * sz * 0.35);
      parts.push(rotate(ellipse(x, y, sz * 0.42, sz * 0.24), ang + side * 0.7, x, y));
    }
  }
  const [tx, ty] = at(len * 0.92, 0);
  parts.push(curve([[...at(0, 0), W * 0.22], [...at(len * 0.6, 0), W * 0.2], [tx, ty, W * 0.06]]));
  const leaf = union(...parts);
  r.part(leaf, (x, y, ins) => z + Math.min(1.6, ins * 0.9) + 0.4, m, { line: true });
  const [mx, my] = at(len * 0.82, 0);
  r.carve(segment(px, py, mx, my, Math.max(0.18, W * 0.04)), 0.6, 0.25);
  for (let i = 0; i < 3; i++) {
    const u = len * (0.25 + i * 0.2);
    for (const side of [-1, 1]) { const [a0, b0] = at(u, 0), [a1, b1] = at(u + len * 0.08, side * W * 0.3); r.carve(segment(a0, b0, a1, b1, 0.14), 0.4, 0.2); }
  }
}

/** a C-scroll: a tapered stroke that curls into a volute at its end (`dir` 1 / -1 sets the hand) */
export function cScroll(r: Real, cx: number, cy: number, rad: number, a0: number, z: number, m: Material, dir = 1, w = 1.2) {
  const pts = spiralPts(cx, cy, rad, rad * 0.22, a0, dir * 1.15, w, w * 0.45, 26);
  const s = curve(pts);
  r.part(s, (_x, _y, ins) => z + Math.min(1.2, ins * 1.4) + 0.3, m, { line: true });
  const e = pts[pts.length - 1];
  r.part(circle(e[0], e[1], w * 0.75), dome(e[0], e[1], w * 0.75, w * 0.75, 0.8, z + 1), m, { line: true });
}

/**
 * A brass filigree corner piece at the corner (cx, cy) (sx, sy = +1/-1 the way the arms run): two arms `L`
 * long ending in trefoils, an ogee lobe on the diagonal, scalloped inner edges, pierced holes, engraved scrolls
 * and three domed rivets.
 */
export function filigreeCorner(r: Real, cx: number, cy: number, sx: number, sy: number, L: number, z: number, col: RGB = BRASS_OLD, B = L * 0.3) {
  const P = (u: number, v: number): Pt => [cx + sx * u, cy + sy * v];
  const C = (u: number, v: number, rad: number) => { const [x, y] = P(u, v); return circle(x, y, rad); };
  const boxUV = (u0: number, v0: number, u1: number, v1: number) => { const [x0, y0] = P(u0, v0), [x1, y1] = P(u1, v1); return box(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0), 0.6); };
  let plate: SDF = union(
    boxUV(-0.6, -0.6, L - B * 0.5, B), boxUV(-0.6, -0.6, B, L - B * 0.5),
    C(B * 1.15, B * 1.15, B * 0.78),
    C(L - B * 0.45, B * 0.5, B * 0.52), C(L - B * 0.95, B * 0.95, B * 0.34), C(L - B * 0.05, B * 0.05, B * 0.3),
    C(B * 0.5, L - B * 0.45, B * 0.52), C(B * 0.95, L - B * 0.95, B * 0.34), C(B * 0.05, L - B * 0.05, B * 0.3),
  );
  // scalloped inner edges and pierced work
  const holes: SDF[] = [];
  for (let u = B * 2.15; u < L - B * 1.4; u += B * 0.78) { holes.push(C(u, B * 1.28, B * 0.36), C(B * 1.28, u, B * 0.36)); }
  holes.push(C(L * 0.62, B * 0.5, B * 0.15), C(B * 0.5, L * 0.62, B * 0.15), C(B * 1.25, B * 1.25, B * 0.22));
  plate = subtract(plate, union(...holes));
  r.part(plate, bevel(1.3, Math.max(0.6, B * 0.25), z), metal(col, { polish: 0.62 }), { line: true });
  // engraved scroll lines along the arms
  const eng = (pts: [number, number, number][]) => r.carve(curve(pts), 0.5, 0.25);
  const sp = (u0: number, v0: number, flip: boolean) => {
    const out: [number, number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, u = u0 + t * (L * 0.38), v = v0 + Math.sin(t * Math.PI * 1.5) * B * 0.18;
      const [x, y] = flip ? P(v, u) : P(u, v);
      out.push([x, y, 0.16]);
    }
    return out;
  };
  eng(sp(B * 1.7, B * 0.42, false)); eng(sp(B * 1.7, B * 0.42, true));
  // three rivets
  const rv = Math.max(0.9, B * 0.24);
  let [x, y] = P(B * 0.55, B * 0.55); rivet(r, x, y, rv * 1.1, z + 1.1, col);
  [x, y] = P(L - B * 0.45, B * 0.5); rivet(r, x, y, rv, z + 1.1, col);
  [x, y] = P(B * 0.5, L - B * 0.45); rivet(r, x, y, rv, z + 1.1, col);
}

/**
 * A carved corner block standing proud of a frame's corner (cx, cy): a cartouche that breaks out past the
 * outline, C-scrolls running off along both rails and an acanthus leaf on the diagonal, with a gilt boss.
 */
export function carvedCorner(r: Real, cx: number, cy: number, sx: number, sy: number, L: number, z: number, m: Material, boss?: Material) {
  const P = (u: number, v: number): Pt => [cx + sx * u, cy + sy * v];
  const ang = (a: number) => Math.atan2(sy * Math.sin(a), sx * Math.cos(a));
  // the cartouche: an ogee shield on the diagonal, breaking out past the outer corner
  const [kx, ky] = P(L * 0.3, L * 0.3);
  const shield = warp(union(circle(kx, ky, L * 0.3), ...[0, 1].map((i) => { const [a, b] = i ? P(L * 0.58, L * 0.12) : P(L * 0.12, L * 0.58); return ellipse(a, b, L * 0.16, L * 0.16); })), L * 0.02, 0.4, 3);
  r.part(shield, (_x, _y, ins) => z + Math.min(2.2, ins * 0.8), m, { line: true });
  // scrolls running along each rail
  const [ax, ay] = P(L * 0.72, L * 0.16), [bx, by] = P(L * 0.16, L * 0.72);
  cScroll(r, ax, ay, L * 0.14, ang(Math.PI * 0.5), z + 1, m, sx * sy, L * 0.07);
  cScroll(r, bx, by, L * 0.14, ang(0), z + 1, m, -sx * sy, L * 0.07);
  // the leaf on the diagonal, pointing in
  const [lx, ly] = P(L * 0.08, L * 0.08);
  acanthus(r, lx, ly, L * 0.62, ang(Math.PI / 4), z + 1.4, m, 0.5);
  const [ox, oy] = P(L * 0.27, L * 0.27);
  r.part(circle(ox, oy, L * 0.085), dome(ox, oy, L * 0.085, L * 0.085, L * 0.07, z + 3), boss ?? metal(GOLD, { polish: 0.85 }), { line: true });
}

/**
 * Call `fn(x, y, ang)` at evenly spaced points round a rounded rectangle (x, y, w, h, corner radius rad):
 * along the straight sides every `P` units in step with the tiled middles of a 9-slice ([tx0, tx0 + period] on
 * x, [ty0, ...] on y, so `border-image-repeat: round` never breaks the rhythm), and about every `P` round the
 * corners. `ang` is the direction of travel (clockwise).
 */
export function alongRect(x: number, y: number, w: number, h: number, rad: number, Pxy: number | [number, number], tx0: number, ty0: number, fn: (x: number, y: number, ang: number) => void, o: { sides?: string; round?: boolean } = {}) {
  const sides = o.sides ?? 'trbl';
  const [Px, Py] = typeof Pxy === 'number' ? [Pxy, Pxy] : Pxy, P = (Px + Py) / 2;
  const xs: number[] = [], ys: number[] = [];
  for (let v = tx0 + Px / 2 - Math.ceil((tx0 - x - rad) / Px) * Px; v <= x + w - rad + 1e-6; v += Px) if (v >= x + rad - 1e-6) xs.push(v);
  for (let v = ty0 + Py / 2 - Math.ceil((ty0 - y - rad) / Py) * Py; v <= y + h - rad + 1e-6; v += Py) if (v >= y + rad - 1e-6) ys.push(v);
  if (sides.includes('t')) for (const v of xs) fn(v, y, 0);
  if (sides.includes('b')) for (const v of xs) fn(v, y + h, Math.PI);
  if (sides.includes('l')) for (const v of ys) fn(x, v, -Math.PI / 2);
  if (sides.includes('r')) for (const v of ys) fn(x + w, v, Math.PI / 2);
  if (rad > 0.5 && o.round) {
    const n = Math.max(1, Math.round((rad * Math.PI / 2) / P));
    const corners: [number, number, number, string][] = [[x + w - rad, y + rad, -Math.PI / 2, 'tr'], [x + w - rad, y + h - rad, 0, 'rb'], [x + rad, y + h - rad, Math.PI / 2, 'bl'], [x + rad, y + rad, Math.PI, 'lt']];
    for (const [ccx, ccy, a0, sd] of corners) {
      if (!sides.includes(sd[0]) || !sides.includes(sd[1])) continue;
      for (let i = 0; i < n; i++) { const a = a0 + ((i + 0.5) / n) * Math.PI / 2; fn(ccx + Math.cos(a) * rad, ccy + Math.sin(a) * rad, a + Math.PI / 2); }
    }
  } else if (rad > 0.5) {
    // [ui10] bevel-cut corners: elements along each 45-degree cut
    const n = Math.max(1, Math.round((rad * Math.SQRT2) / P));
    const cuts: [number, number, number, number, string][] = [[x + w - rad, y, x + w, y + rad, 'tr'], [x + w, y + h - rad, x + w - rad, y + h, 'rb'], [x + rad, y + h, x, y + h - rad, 'bl'], [x, y + rad, x + rad, y, 'lt']];
    for (const [ax, ay, bx, by, sd] of cuts) {
      if (!sides.includes(sd[0]) || !sides.includes(sd[1])) continue;
      const a = Math.atan2(by - ay, bx - ax);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; fn(ax + (bx - ax) * t, ay + (by - ay) * t, a); }
    }
  }
}

/** thread for stitching */
export const THREAD: Record<string, RGB> = { linen: hex('#efe0b8'), gold: hex('#e8c060'), cream: hex('#f6ecd2'), red: hex('#c8483c'), dark: hex('#3a2416') };
/** one stitch: a short raised thread lying along `ang`, sunk into two needle holes */
export function stitch(r: Real, x: number, y: number, ang: number, len = 2, col: RGB = THREAD.linen, th = 0.42) {
  const c = Math.cos(ang) * len / 2, s = Math.sin(ang) * len / 2;
  r.carve(circle(x - c * 1.15, y - s * 1.15, th * 0.75), 0.6, 0.3);
  r.carve(circle(x + c * 1.15, y + s * 1.15, th * 0.75), 0.6, 0.3);
  const sh = segment(x - c, y - s, x + c, y + s, th);
  r.part(sh, (_x, _y, ins) => 0.45 * Math.sqrt(clamp(ins / th)) + 0.15, { ...cloth('linen', col, { scale: 6, amt: 0.6 }), spec: 0.25, shin: 18 }, { add: true });
  r.line(sh, undefined, 0.45);
}
/** stitches round a rounded rectangle (see alongRect for the tiling rule) */
export function stitches(r: Real, x: number, y: number, w: number, h: number, rad: number, P: number | [number, number], tx0: number, ty0: number, col: RGB = THREAD.linen, o: { sides?: string; len?: number; th?: number; groove?: boolean } = {}) {
  if (o.groove !== false && !o.sides) r.carve(subtract(cutBox(x - 0.35, y - 0.35, w + 0.7, h + 0.7, rad + 0.15), cutBox(x + 0.35, y + 0.35, w - 0.7, h - 0.7, Math.max(0, rad - 0.15))), 0.35, 0.3);
  const pm = typeof P === 'number' ? P : Math.min(P[0], P[1]);
  alongRect(x, y, w, h, rad, P, tx0, ty0, (px, py, a) => stitch(r, px, py, a, o.len ?? pm * 0.58, col, o.th), { sides: o.sides });
}
/** a row of gilt pearls (bead moulding) round a rounded rectangle */
export function beads(r: Real, x: number, y: number, w: number, h: number, rad: number, P: number | [number, number], tx0: number, ty0: number, z: number, m: Material = metal(GOLD, { polish: 0.85 }), br = (typeof P === 'number' ? P : Math.min(P[0], P[1])) * 0.36) {
  alongRect(x, y, w, h, rad, P, tx0, ty0, (px, py) => r.part(circle(px, py, br), dome(px, py, br, br, br * 0.9, z), m, { line: 0.9 }));
}
/** a fine beaded (milgrain) edge: tiny bumps raised out of the surface, no new material */
export function milgrain(r: Real, x: number, y: number, w: number, h: number, rad: number, P: number | [number, number], tx0: number, ty0: number, br = (typeof P === 'number' ? P : Math.min(P[0], P[1])) * 0.32) {
  alongRect(x, y, w, h, rad, P, tx0, ty0, (px, py) => { r.carve(circle(px, py, br), -0.85, br); r.line(circle(px, py, br), 0.7, 0.22); });
}

/** a twisted rope lying along a straight line from a to b (`rad` thick, one twist every `P`): hemp or gilt */
export function rope(r: Real, ax: number, ay: number, bx: number, by: number, rad: number, P: number, z: number, m: Material, phase = 0) {
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L, nx = -uy, ny = ux;
  const band = segment(ax, ay, bx, by, rad);
  const hBand = (x: number, y: number) => { const v = (x - ax) * nx + (y - ay) * ny; return z + rad * Math.sqrt(Math.max(0, 1 - (v / rad) ** 2)); };
  r.part(band, (x, y) => hBand(x, y) - 0.3, m);
  for (let t = phase - P; t < L + P; t += P) {
    // one strand: a slanted lozenge across the rope
    const s0x = ax + ux * t, s0y = ay + uy * t;
    const strand = segment(s0x - nx * rad * 0.85 - ux * P * 0.45, s0y - ny * rad * 0.85 - uy * P * 0.45, s0x + nx * rad * 0.85 + ux * P * 0.45, s0y + ny * rad * 0.85 + uy * P * 0.45, P * 0.38);
    const sh: SDF = (x, y) => Math.max(strand(x, y), band(x, y));
    sh.bb = strand.bb;
    r.part(sh, (x, y, ins) => hBand(x, y) + Math.min(0.5, ins * 0.6), m, { line: 0.8 });
  }
}

/** an inlaid stringing line (light boxwood or dark ebony) along a band shape: flush with the surface */
export function stringing(r: Real, band: SDF, col: RGB, a = 1) {
  r.paint(band, { alb: (x, y) => mix(col, [col[0] * 0.8, col[1] * 0.78, col[2] * 0.74] as RGB, (Math.sin(x * 2.1 + y * 0.7) + 1) * 0.12) as RGB, spec: 0.2, shin: 18, coat: 0.3 }, a);
}

/** [ui10] the owl crest's head (an SDF): a broad head with two ear tufts, centred on (cx, cy), `s` half-width */
export function owlHead(cx: number, cy: number, s: number): SDF {
  return union(ellipse(cx, cy + s * 0.12, s * 0.8, s * 0.7),
    polygon([[cx - s * 0.74, cy - s * 0.2], [cx - s * 0.66, cy - s * 0.98], [cx - s * 0.2, cy - s * 0.52]]),
    polygon([[cx + s * 0.74, cy - s * 0.2], [cx + s * 0.66, cy - s * 0.98], [cx + s * 0.2, cy - s * 0.52]]));
}
/**
 * [ui10] An owl crest in relief (the house emblem): the head stands up out of the surface by `h` units, with
 * sunk eye discs, raised rings and pupils, a beak and a carved brow. Works in wax, wood, leather and metal.
 */
export function owlCrest(r: Real, cx: number, cy: number, s: number, h = 0.6) {
  const hw = Math.max(0.2, s * 0.06);
  r.carve(owlHead(cx, cy, s), -h, s * 0.12);
  for (const sx of [-1, 1]) {
    const ex = cx + sx * s * 0.34, ey = cy + s * 0.02;
    r.carve(circle(ex, ey, s * 0.27), h * 0.7, s * 0.08);
    r.carve(subtract(circle(ex, ey, s * 0.27), circle(ex, ey, s * 0.21)), -h * 0.45, s * 0.04);
    r.carve(circle(ex, ey, s * 0.1), -h * 0.8, s * 0.06);
    r.carve(segment(cx + sx * s * 0.06, cy - s * 0.24, cx + sx * s * 0.56, cy - s * 0.34, hw), h * 0.35, hw);
  }
  r.carve(polygon([[cx - s * 0.1, cy + s * 0.14], [cx + s * 0.1, cy + s * 0.14], [cx, cy + s * 0.42]]), -h * 0.6, s * 0.05);
  // breast feathers: three little scallops under the beak
  for (const dx of [-0.24, 0, 0.24]) r.carve(subtract(circle(cx + dx * s, cy + s * 0.56, s * 0.12), circle(cx + dx * s, cy + s * 0.5, s * 0.12)), h * 0.3, s * 0.04);
}
/** [ui10] an oak leaf (lobed) from (px, py) pointing along `ang`, `len` long: an SDF */
export function oakLeaf(px: number, py: number, len: number, ang: number): SDF {
  const c = Math.cos(ang), s = Math.sin(ang), at = (u: number, v: number): Pt => [px + c * u - s * v, py + s * u + c * v];
  const parts: SDF[] = [];
  for (let i = 0; i < 4; i++) {
    const u = len * (0.22 + i * 0.19), w = len * (0.2 - i * 0.025);
    for (const side of [-1, 1]) { const [x, y] = at(u, side * w * 0.55); parts.push(circle(x, y, w * 0.62)); }
  }
  const [tx, ty] = at(len * 0.94, 0);
  parts.push(curve([[...at(0, 0), len * 0.06], [...at(len * 0.5, 0), len * 0.16], [tx, ty, len * 0.06]]));
  return union(...parts);
}
/** [ui10] an acorn (cup and nut) standing at (cx, cy) bottom-centre, `s` tall: [cup, nut] SDFs */
export function acornShapes(cx: number, cy: number, s: number): [SDF, SDF] {
  const nut = ellipse(cx, cy - s * 0.36, s * 0.27, s * 0.36);
  const cup = union(ellipse(cx, cy - s * 0.6, s * 0.34, s * 0.2), box(cx - s * 0.04, cy - s * 0.95, s * 0.08, s * 0.2, s * 0.03));
  return [cup, nut];
}

/** a poured wax seal (`rad` units) stamped with the owl crest; `col` the wax colour */
export function waxSeal(r: Real, cx: number, cy: number, rad: number, z = 0, col: RGB = hex('#a8262c'), seed = 3) {
  const wax: Material = { alb: (x, y) => mix(col, [col[0] * 0.62, col[1] * 0.5, col[2] * 0.55] as RGB, clamp(Math.hypot(x - cx, y - cy) / rad - 0.55) * 0.9) as RGB, spec: 0.55, shin: 34, coat: 0.35 };
  const blob = warp(union(circle(cx, cy, rad), ellipse(cx + rad * 0.62, cy + rad * 0.55, rad * 0.32, rad * 0.26), ellipse(cx - rad * 0.7, cy + rad * 0.35, rad * 0.24, rad * 0.2), ellipse(cx - rad * 0.2, cy - rad * 0.86, rad * 0.22, rad * 0.18)), rad * 0.07, 0.9 / rad * 2, seed);
  r.part(blob, (_x, _y, ins) => z + Math.min(rad * 0.28, ins * 0.5) + 0.3, wax, { line: true });
  // the stamped disc: a raised ring and a sunk face with the owl crest standing up out of it
  const ri = rad * 0.66;
  r.carve(circle(cx, cy, ri), rad * 0.12, rad * 0.12);
  r.carve(subtract(circle(cx, cy, ri * 0.92), circle(cx, cy, ri * 0.82)), -rad * 0.05, rad * 0.04);
  owlCrest(r, cx, cy + ri * 0.04, ri * 0.62, rad * 0.1);
}

/**
 * A printed corner flourish in ink (paper borders): a curl off each rule, a small leaf and a dot, at the corner
 * (cx, cy) with the rules running +sx / +sy.
 */
export function flourish(r: Real, cx: number, cy: number, sx: number, sy: number, L: number, a = 0.6) {
  const P = (u: number, v: number): [number, number] => [cx + sx * u, cy + sy * v];
  const w = Math.max(0.22, L * 0.022);
  const pts = (arr: [number, number, number][]) => arr.map(([u, v, ww]) => { const [x, y] = P(u, v); return [x, y, ww] as [number, number, number]; });
  // two curls leaving the corner along the rules
  const curl = (flip: boolean) => {
    const sp = spiralPts(0, 0, L * 0.2, L * 0.05, flip ? Math.PI : -Math.PI / 2, flip ? -0.9 : 0.9, w * 1.6, w * 0.7, 18).map(([u, v, ww]) => (flip ? [L * 0.5 + v, L * 0.24 + u, ww] : [L * 0.24 + u, L * 0.5 + v, ww]) as [number, number, number]);
    r.inkFill(curve(pts(sp)), a);
  };
  curl(false); curl(true);
  r.inkFill(curve(pts([[L * 0.12, L * 0.12, w * 1.5], [L * 0.32, L * 0.32, w * 0.6]])), a);
  const [dx, dy] = P(L * 0.38, L * 0.38);
  r.inkFill(circle(dx, dy, w * 1.8), a);
  const [lx, ly] = P(L * 0.2, L * 0.2);
  r.inkFill(rotate(ellipse(lx, ly, L * 0.09, L * 0.035), Math.atan2(sy, sx), lx, ly), a);
}

/** beads (or `fn`) every `n` round a circle */
export function aroundCircle(cx: number, cy: number, rad: number, n: number, fn: (x: number, y: number, a: number) => void, a0 = 0) {
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; fn(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, a); }
}

/** the brass used by ornaments, exported for the kit */
export const ORN = { brass, pillow, enamel };
