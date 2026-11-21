// Special skins that replace the species plumage (gacha 5-stars and the Meowl). Ids are fixed by
// src/game/series.ts. Each skin repaints every region of the owl (the shape stays the species') and
// can add its own pieces: gingerbread gets icing piping and gumdrop buttons, the snowman a carrot
// beak, coal buttons, twig tufts and a knitted scarf, the celestial owl constellations and gold.
import { box, lean, type Painter, type Texel } from '../gfx/box.ts';
import { col, ramp, tone, type Ramp } from '../gfx/color.ts';
import { fbm, hash } from '../gfx/noise.ts';
import type { EyeColours } from './eyes.ts';
import { bodyDepth, bodyHalfW, type Geo } from './geo.ts';
import type { OwlParts } from './model.ts';
import { fr, lit, type Kit } from './plumage.ts';

export interface SkinDef2 { id: string; name: string; blurb: string; series?: string; /** particle puff colour */ feather: string }
export const SPECIAL_SKINS: SkinDef2[] = [
  { id: 'meowl', name: 'Meowl', blurb: 'A kitten face on an owl body. Purrs and hoots.', feather: '#cf8f52' },
  { id: 'gingerbread', name: 'Gingerbread Owl', blurb: 'Baked golden, iced with care, smells like cinnamon.', series: 'frostlight', feather: '#b8692e' },
  { id: 'snowman', name: 'Snowman Owl', blurb: 'Packed from the first snow, with a carrot beak and coal buttons.', series: 'frostlight', feather: '#f4f8ff' },
  { id: 'celestial', name: 'Celestial Owl', blurb: 'Feathers of deep night sky, scattered with real constellations.', series: 'starfall', feather: '#3b3486' },
];
export const SPECIAL_SKIN: Record<string, SkinDef2> = Object.fromEntries(SPECIAL_SKINS.map((s) => [s.id, s]));

const FACE = [0.12, -0.28, 0.62, -1.15, 0.22, -0.38];
const pep = (t: Texel, s: number) => hash(Math.floor(t.x * 4 + 0.01), Math.floor(t.y * 4 + 0.01), Math.floor(t.z * 4 + 0.01), s);
/** distance (in face pixels) to the nearest edge of the face this texel is on */
const edgeD = (t: Texel) => Math.min(t.u + 0.5, t.w - t.u - 0.5, t.v + 0.5, t.h - t.v - 0.5) / 4;

// ------------------------------------------------------------------ gingerbread

function gingerKit(g: Geo, base: Kit): Kit {
  const dough = ramp(col('#b8692e'), { step: 0.05, cool: 30, warm: 75, shift: 0.05 });
  const baked = ramp(col('#7f3e17'), { step: 0.05 });
  const icing = ramp(col('#fffaf0'), { step: 0.03, cool: 230 });
  const spice = ramp(col('#4a230d'));
  const candy = ramp(col('#e23a3a'), { step: 0.06 });
  /** golden-baked dough: darker toward the edges of each piece, flour dust and spice flecks */
  const cookie = (t: Texel, L = 0): number => {
    L += FACE[t.face] + (fbm(t.x * 0.7, t.y * 0.7, t.z * 0.7, 3) - 0.5) * 1.2;
    const e = edgeD(t);
    if (e < 0.35 && t.face !== 2) L -= (0.35 - e) * 3;
    const p = pep(t, 5);
    if (p > 0.96) return tone(spice, 0.3);
    if (p < 0.02) return tone(dough, 2.2);
    if (L < -1.4) return tone(baked, L + 1.6);
    return tone(dough, L);
  };
  const ice = (t: Texel, L = 0) => tone(icing, L + FACE[t.face] * 0.6 + 0.4 - (pep(t, 9) > 0.8 ? 0.6 : 0));
  const top = g.bodyTop, bY = g.bodyY;
  const body: Painter = (t) => {
    if (t.face === 3) return tone(baked, -0.5);
    // icing scallops across the chest and a piped hem round the belly
    if (t.face === 4 && Math.abs(t.x) < g.bodyW / 2 - 1.5) {
      const rowY = (top - t.y) / 1.9, r = Math.floor(rowY), v = rowY - r;
      const u = ((t.x + 40 + (r & 1) * 1.1) / 2.2) % 1;
      const arc = 0.68 - 0.42 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
      if (r >= 1 && r <= 3 && Math.abs(v - arc) < 0.09) return ice(t);
    }
    if (Math.abs(t.y - (bY + 2.1)) < 0.22 && t.face !== 2) return ice(t, -0.2);
    return cookie(t, (t.y - top) / g.bodyH * 0.6 + 0.3);
  };
  const piped = (inner: (t: Texel) => number): Painter => (t) => (edgeD(t) < 0.26 && t.face !== 3 && t.face !== 5 ? ice(t) : inner(t));
  const wing: Painter = (t) => {
    const outer = (t.face === 0 && t.x > 0) || (t.face === 1 && t.x < 0);
    if (outer) {
      // a wavy line of icing piped along the wing
      const wave = g.shoulderY - 3.2 + Math.sin(-t.z * 1.4) * 0.5;
      if (Math.abs(t.y - wave) < 0.2) return ice(t);
      if (Math.abs(t.y - (wave - 3.4)) < 0.17 && Math.sin(-t.z * 2.6) > 0) return ice(t);
    }
    return cookie(t, 0.1);
  };
  const disc: Painter = (t) => {
    // the face: lighter dough with an icing ring round each eye and a sugar smile
    const d = Math.min(Math.hypot(t.x - g.eyeX, t.y - g.eyeY), Math.hypot(t.x + g.eyeX, t.y - g.eyeY));
    if (t.face === 4 && Math.abs(d - g.eyeS * 0.5 - 0.45) < 0.2) return ice(t);
    if (t.face === 4 && Math.abs(Math.hypot(t.x * 0.8, t.y - (g.beakY - 0.6)) - 2.6) < 0.18 && t.y < g.beakY - 1.8) return tone(candy, 0.3);
    return cookie(t, 0.6);
  };
  return {
    ...base,
    body, breastTip: piped((t) => cookie(t, 0.2)), head: (t) => cookie(t, (t.y - g.headTop) / g.headH * 0.5 + 0.4), disc,
    ruff: (t) => (t.face === 4 ? ice(t) : cookie(t, -0.2)), ruffOut: (t) => cookie(t, -0.4), ridge: (t) => cookie(t, 0.5), brow: (t) => ice(t, -0.1), bristle: (t) => cookie(t, 0.2), chin: (t) => cookie(t, 0.2),
    beak: (t) => tone(candy, FACE[t.face] + 0.3 + (Math.floor((t.y + t.x) * 3) % 2 ? 0.8 : -0.4)), cere: (t) => ice(t, -0.1),
    wing, cov: piped((t) => cookie(t, 0.2)), scap: piped((t) => cookie(t, 0)),
    prim: () => piped((t) => cookie(t, 0)), primTip: () => piped((t) => cookie(t, 0)), tail: () => piped((t) => cookie(t, -0.1)), tuft: () => piped((t) => cookie(t, 0.3)),
    leg: (t) => cookie(t, 0.1), knicker: (t) => cookie(t, 0.2), toe: (t) => cookie(t, 0), talon: (t) => ice(t, -0.2),
  };
}

// ------------------------------------------------------------------ snowman

function snowKit(g: Geo, base: Kit): Kit {
  const snow = ramp(col('#f4f8ff'), { step: 0.04, cool: 250, shift: 0.07 });
  const twig = ramp(col('#6b4426'));
  const carrot = ramp(col('#f07a1c'), { step: 0.06 });
  /** packed snow: lumpy, cool blue in the hollows, sparkling here and there */
  const packed = (t: Texel, L = 0): number => {
    L += FACE[t.face] * 1.1 + (fbm(t.x * 0.55, t.y * 0.55, t.z * 0.55, 11) - 0.5) * 1.6 + (fbm(t.x * 1.8, t.y * 1.8, t.z * 1.8, 4) - 0.5) * 0.7;
    const p = pep(t, 21);
    if (p > 0.985) return 0xffffff;
    if (p > 0.95) L += 0.8;
    return tone(snow, L);
  };
  const carved = (t: Texel) => packed(t, edgeD(t) < 0.2 ? -1.2 : 0);
  return {
    ...base,
    body: (t) => packed(t, (t.y - g.bodyTop) / g.bodyH * 0.5 + 0.4), breastTip: carved, head: (t) => packed(t, 0.4),
    disc: (t) => packed(t, 0.7), ruff: (t) => packed(t, -0.5), ruffOut: (t) => packed(t, -0.9), ridge: (t) => packed(t, 0.4), brow: (t) => packed(t, 0.1), bristle: (t) => packed(t, 0.3), chin: (t) => packed(t, 0.2),
    beak: (t) => tone(carrot, FACE[t.face] + 0.2 + (Math.floor(t.z * 3) % 3 === 0 ? -0.7 : 0)), cere: (t) => tone(carrot, FACE[t.face] - 0.2),
    wing: carved, cov: carved, scap: carved, prim: () => carved, primTip: () => carved, tail: () => carved, tuft: () => (t) => tone(twig, FACE[t.face] + (pep(t, 4) - 0.5)),
    leg: (t) => packed(t, 0), knicker: (t) => packed(t, 0.2), toe: (t) => packed(t, -0.2), talon: (t) => tone(twig, FACE[t.face] - 0.3),
  };
}

// ------------------------------------------------------------------ celestial

/** Real constellations, as star positions (unit square, y up) and the lines that join them. */
const CONST: Record<string, { s: [number, number, number][]; l: [number, number][] }> = {
  // Orion: shoulders, belt, feet (third value = brightness)
  orion: { s: [[0.2, 0.92, 1], [0.78, 0.86, 0.8], [0.42, 0.52, 0.7], [0.5, 0.5, 0.7], [0.58, 0.48, 0.7], [0.26, 0.08, 0.8], [0.8, 0.12, 1], [0.5, 1, 0.5]], l: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 7], [1, 7]] },
  // the Plough / Big Dipper
  dipper: { s: [[0, 0.62, 0.8], [0.2, 0.72, 0.8], [0.38, 0.66, 0.8], [0.52, 0.56, 0.9], [0.56, 0.28, 0.8], [0.88, 0.22, 0.9], [0.92, 0.5, 0.8]], l: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  // Cassiopeia's W
  cassio: { s: [[0, 0.8, 0.8], [0.25, 0.3, 0.9], [0.5, 0.62, 0.8], [0.74, 0.2, 0.9], [1, 0.72, 0.8]], l: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  // Cygnus, the Northern Cross
  cygnus: { s: [[0.5, 1, 1], [0.5, 0.62, 0.8], [0.5, 0.3, 0.7], [0.5, 0, 0.8], [0.1, 0.7, 0.7], [0.9, 0.56, 0.7]], l: [[0, 1], [1, 2], [2, 3], [4, 1], [1, 5]] },
  // Lyra
  lyra: { s: [[0.3, 1, 1], [0.45, 0.66, 0.6], [0.7, 0.58, 0.6], [0.4, 0.2, 0.6], [0.66, 0.12, 0.6]], l: [[0, 1], [1, 2], [2, 4], [4, 3], [3, 1]] },
};

function celestialKit(g: Geo, base: Kit): Kit {
  const night = ramp(col('#2a2670'), { step: 0.05, cool: 280, warm: 300, shift: 0.04 });
  const deep = ramp(col('#151340'), { step: 0.04 });
  const neb = ramp(col('#7b4fc4'), { step: 0.05 }), teal = ramp(col('#2f8fb0'), { step: 0.05 });
  const gold = ramp(col('#ffd36a'), { step: 0.07 });
  const starC = [0xffffff, 0xfff4c2, 0xd8e6ff];
  /** a constellation stamped into a rectangle of a face's 2D coordinates */
  const stamp = (a: number, b: number, name: string, x0: number, y0: number, w: number, h: number): number => {
    const C = CONST[name];
    const px = (a - x0) / w, py = (b - y0) / h;
    if (px < -0.1 || px > 1.1 || py < -0.1 || py > 1.1) return -1;
    for (const [sx, sy, br] of C.s) {
      const d = Math.hypot((px - sx) * w, (py - sy) * h);
      if (d < 0.18 + br * 0.14) return 2;
      if (br > 0.85 && ((Math.abs((px - sx) * w) < 0.12 && Math.abs((py - sy) * h) < 0.55) || (Math.abs((py - sy) * h) < 0.12 && Math.abs((px - sx) * w) < 0.55))) return 2;
    }
    for (const [i, j] of C.l) {
      const [ax, ay] = C.s[i], [bx, by] = C.s[j];
      const vx = (bx - ax) * w, vy = (by - ay) * h, qx = (px - ax) * w, qy = (py - ay) * h;
      const k = Math.max(0, Math.min(1, (qx * vx + qy * vy) / (vx * vx + vy * vy)));
      if (Math.hypot(qx - vx * k, qy - vy * k) < 0.09) return 1;
    }
    return 0;
  };
  /** night sky: nebula clouds, a dust of faint stars, constellations where the texel lies inside one */
  const sky = (t: Texel, L: number, cons?: number): number => {
    if (cons === 2) return starC[Math.floor(pep(t, 3) * 3)];
    if (cons === 1) return tone(gold, -1.2);
    const n = fbm(t.x * 0.22, t.y * 0.22, t.z * 0.22, 41), n2 = fbm(t.x * 0.4 + 9, t.y * 0.4, t.z * 0.4, 7);
    const p = pep(t, 13);
    if (p > 0.992) return starC[Math.floor(p * 1000) % 3];
    if (p > 0.975) return tone(night, 2.5);
    if (n > 0.64) return tone(neb, L * 0.6 + (n - 0.64) * 6 - 1);
    if (n2 > 0.7) return tone(teal, L * 0.6 - 1.2 + (n2 - 0.7) * 6);
    return L < -0.4 ? tone(deep, L + 0.6) : tone(night, L);
  };
  const body: Painter = (t) => {
    const L = FACE[t.face] + (t.y - g.bodyTop) / g.bodyH * 0.6 + 0.2;
    let c = -1;
    if (t.face === 4) c = stamp(t.x, t.y, 'orion', -3.4, g.bodyY + 2.4, 6.6, g.bodyH * 0.6);
    else if (t.face === 5) c = stamp(-t.x, t.y, 'cygnus', -3.2, g.bodyY + 1.5, 6.4, g.bodyH * 0.7);
    return sky(t, L, c);
  };
  const wing: Painter = (t) => {
    const L = FACE[t.face] + 0.1;
    let c = -1;
    if (t.face === 1 && t.x < 0) c = stamp(-t.z, t.y, 'dipper', -g.bodyD * 0.2, g.bodyY + g.bodyH * 0.25, g.bodyD * 0.7, g.bodyH * 0.45);
    if (t.face === 0 && t.x > 0) c = stamp(-t.z, t.y, 'cassio', -g.bodyD * 0.15, g.bodyY + g.bodyH * 0.3, g.bodyD * 0.65, g.bodyH * 0.35);
    return sky(t, L, c);
  };
  const head: Painter = (t) => {
    const L = FACE[t.face] + 0.2;
    const c = t.face === 2 ? stamp(t.x, -t.z, 'lyra', -2, -g.headZ - 2.5, 4, 4.5) : -1;
    return sky(t, L, c);
  };
  const plain: Painter = (t) => sky(t, FACE[t.face]);
  const goldP: Painter = (t) => tone(gold, FACE[t.face] * 1.2 + 0.3 + (Math.floor((t.u + t.v) % 5) === 0 ? 1 : 0));
  return {
    ...base,
    body, breastTip: plain, head,
    disc: (t) => {
      // a moonlit halo: the disc fades lighter around each eye
      const d = Math.min(Math.hypot(t.x - g.eyeX, t.y - g.eyeY), Math.hypot(t.x + g.eyeX, t.y - g.eyeY)) - g.eyeS / 2;
      if (t.face === 4 && d < 1.4) return tone(night, 1.4 - d * 0.8 + (pep(t, 2) - 0.5) * 0.4);
      return sky(t, FACE[t.face] + 0.4);
    },
    ruff: (t) => (pep(t, 8) > 0.55 ? tone(gold, 0.2) : tone(gold, -1)), ruffOut: (t) => sky(t, -0.4), ridge: plain, brow: (t) => tone(gold, FACE[t.face] + 0.2), bristle: plain, chin: plain,
    beak: goldP, cere: goldP, wing, cov: wing, scap: plain, prim: () => wing, primTip: () => plain, tail: () => plain, tuft: () => plain,
    leg: plain, knicker: plain, toe: plain, talon: goldP,
  };
}

export function skinKit(id: string, g: Geo, base: Kit): Kit {
  if (id === 'gingerbread') return gingerKit(g, base);
  if (id === 'snowman') return snowKit(g, base);
  if (id === 'celestial') return celestialKit(g, base);
  return base;
}

/** Extra pieces a skin adds on top of the species body. */
export function skinExtras(id: string, P: OwlParts) {
  const g = P.g, front = (y: number) => g.bodyD / 2 + (y > g.bodyY + g.bodyH * 0.45 && y < g.bodyY + g.bodyH * 0.78 ? g.shape.breast * 0.6 : 0);
  if (id === 'gingerbread') {
    // three glossy gumdrop buttons down the chest
    const cols = ['#e8333c', '#3fae4a', '#f4c430'];
    [0.72, 0.52, 0.32].forEach((h, i) => {
      const y = g.bodyY + g.bodyH * h, r = ramp(col(cols[i]), { step: 0.07 });
      const m: Painter = (t) => tone(r, FACE[t.face] + (t.face === 2 || (t.face === 4 && t.by > t.sy * 0.6 && t.bx < t.sx * 0.5) ? 1.6 : 0.2));
      P.add('body', box(0, y - 0.8, front(y) + 0.45, 1.8, 1.6, 0.9, m), box(0, y - 0.4, front(y) + 0.85, 1.1, 0.9, 0.5, m));
    });
  }
  if (id === 'snowman') {
    const coal = ramp(col('#2a2a30'), { step: 0.05 });
    const cm: Painter = (t) => tone(coal, FACE[t.face] + (pep(t, 3) > 0.8 ? 1.4 : 0) - 0.2);
    [0.68, 0.46, 0.24].forEach((h) => { const y = g.bodyY + g.bodyH * h; P.add('body', box(0, y - 0.7, front(y) + 0.2, 1.5, 1.4, 0.8, cm), box(0.2, y - 0.4, front(y) + 0.5, 0.8, 0.8, 0.5, cm)); });
    // a carrot nose poking out of the beak
    const carrot = ramp(col('#f07a1c'), { step: 0.06 });
    const cr: Painter = (t) => tone(carrot, FACE[t.face] + 0.2 + (Math.floor(t.z * 2.5) % 3 === 0 ? -0.8 : 0));
    const by = g.beakY, z0 = g.discFront + 1.6;
    P.add('head', box(0, by - 1.8, z0 + 0.6, 1.3, 1.2, 1.4, cr), box(0, by - 1.55, z0 + 1.6, 0.9, 0.8, 1.0, cr), box(0, by - 1.35, z0 + 2.35, 0.5, 0.45, 0.8, cr));
    // twig tufts (instead of feathers)
    const twig = ramp(col('#6b4426'));
    const tw: Painter = (t) => tone(twig, FACE[t.face] + (pep(t, 4) - 0.5) * 0.8);
    P.bones.tuftL = []; P.bones.tuftR = [];
    for (const [bone, sd] of [['tuftL', -1], ['tuftR', 1]] as const) {
      const x = sd * Math.min(4.6, g.headW / 2 - 2.2), y = g.headTop - 1;
      P.add(bone, lean(box(x, y, g.headZ, 0.55, 4.6, 0.55, tw), -6, 0, -sd * 18));
      P.add(bone, lean(box(x + sd * 0.9, y + 2.4, g.headZ, 0.45, 2.2, 0.45, tw), -6, 0, -sd * 52));
      P.add(bone, lean(box(x + sd * 0.4, y + 3.5, g.headZ, 0.4, 1.6, 0.4, tw), 0, 0, sd * 22));
    }
    // a little knitted scarf
    const red = ramp(col('#d6343c'), { step: 0.06 }), cream = ramp(col('#f6efe0'), { step: 0.04 });
    const knit: Painter = (t) => {
      const row = Math.floor(t.y * 2.5), across = t.face < 2 ? t.z : t.x;
      const v = fractional(across * 2.5);
      const L = FACE[t.face] + (Math.abs(v - 0.5) > 0.32 ? -0.6 : 0.3);
      return Math.floor(across / 1.6) % 2 === 0 && t.face !== 2 ? tone(cream, L) : tone(red, L + (row % 2 ? 0 : -0.2));
    };
    const ny = g.bodyTop - g.shape.neck - 1.9, hw = bodyHalfW(g, ny + 1), dep = bodyDepth(g, ny + 1);
    P.add('body', box(0, ny, (dep.front + dep.back) / 2, hw * 2 + 1.6, 2.2, dep.front - dep.back + 1.6, knit));
    P.add('body', { ...box(hw * 0.45, ny - 4.6, dep.front + 0.6, 2.2, 5, 0.7, knit), rot: [6, 0, 8] });
    for (const k2 of [-1, 0, 1]) P.add('body', box(hw * 0.45 + k2 * 0.7 + 0.3, ny - 5.4, dep.front + 0.95, 0.35, 1.0, 0.35, knit));
  }
  if (id === 'celestial') {
    // a tiny golden crescent moon pinned at the chest
    const gold = ramp(col('#ffd36a'), { step: 0.07 });
    const gm: Painter = (t) => tone(gold, FACE[t.face] + 0.6);
    const y = g.bodyY + g.bodyH * 0.84, z = front(y) - 0.4;
    P.add('body', box(-0.6, y, z, 0.7, 2.2, 0.5, gm, { glow: true }), box(0, y + 1.8, z, 0.9, 0.6, 0.5, gm, { glow: true }), box(0, y - 0.3, z, 0.9, 0.6, 0.5, gm, { glow: true }));
  }
}

const fractional = (v: number) => v - Math.floor(v);

/** Eye colours per skin: candy eyes, coal eyes, glowing star-gold eyes. */
export function skinEyes(id: string, base: EyeColours): EyeColours {
  if (id === 'gingerbread') return { ...base, iris: '#fbf7ee', lid: '#b8692e', rim: '#fffaf0', style: 'candy' };
  if (id === 'snowman') return { ...base, iris: '#1c1c22', lid: '#eef3fb', rim: '#2a2a30', style: 'coal' };
  if (id === 'celestial') return { ...base, iris: '#ffd65a', lid: '#2a2670', rim: '#0d0b2e', glow: true, style: 'star' };
  return base;
}

/** A painted swatch for wardrobe icons (falls back gracefully if a skin has no swatch). */
export const skinRamp = (id: string): Ramp => fr(SPECIAL_SKIN[id]?.feather ?? '#888888');
export { lit };
