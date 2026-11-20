// Pip: a plump little owl with a raised facial disc, a hooked beak, feathery ear tufts and small,
// simple bead eyes, built from rounded voxel volumes and painted at three texels per model pixel.
// Feathers are painted, not noised: every scalloped feather has a soft dome of light, a shaft, a lit
// rim and a shadow on the feather beneath, with freckles and barring placed by hand-tuned rules.
// The Meowl skin swaps the head for a kitten's (pointy ears, white muzzle, pink nose, whiskers).
import * as THREE from 'three';
import { box, buildRig, lean, PX, type BoneSpec, type BoxSpec, type Painter, type Rig, type Texel, type Vec3 } from '../gfx/box.ts';
import { col, mix, ramp, toLch, tone, type Ramp } from '../gfx/color.ts';
import { fbm, hash } from '../gfx/noise.ts';
import { Eye, eyeColours } from './eyes.ts';
import { palette, type OwlPalette, type Skin } from './palette.ts';
import { dressOwl } from './outfits.ts';

/** Texels per model pixel. */
export const OWL_DENS = 3;

/** Key measurements in model px (16 px = one block). Pip faces +z. */
export const G = {
  bodyY: 3, bodyH: 11, bodyW: 13, bodyD: 11,
  headY: 12.4, headH: 12.8, headW: 16.4, headD: 12.6, headZ: 0.2,
  headTop: 25.2, headFront: 6.5, faceFront: 7.4,
  eyeX: 3.95, eyeY: 19.5, eyeS: 5.1,
  neckY: 13.4,
  wingX: 7.5, shoulderY: 13.4,
  noseY: 17.6,
  /** front of the owl's facial disc */
  discFront: 7.45,
} as const;

export type BoneName = 'body' | 'head' | 'tuftL' | 'tuftR' | 'browL' | 'browR' | 'jaw' | 'wingL' | 'wingR' | 'tail' | 'legL' | 'legR';

export const PIVOTS: Record<BoneName, Vec3> = {
  body: [0, G.bodyY, 0],
  head: [0, G.neckY, 0.4],
  tuftL: [-4.9, 24.4, 0.2],
  tuftR: [4.9, 24.4, 0.2],
  browL: [-G.eyeX, 23, G.headFront],
  browR: [G.eyeX, 23, G.headFront],
  jaw: [0, 16.3, G.faceFront],
  wingL: [-6.4, G.shoulderY, -0.4],
  wingR: [6.4, G.shoulderY, -0.4],
  tail: [0, 4.6, -5.2],
  legL: [-2.7, 2.8, 0.8],
  legR: [2.7, 2.8, 0.8],
};
const PARENT: Partial<Record<BoneName, BoneName>> = {
  tuftL: 'head', tuftR: 'head', browL: 'head', browR: 'head', jaw: 'head', wingL: 'body', wingR: 'body', tail: 'body',
};

// ------------------------------------------------------------------ rounded volumes

/** A box with stepped (chamfered) edges: reads as rounded at pixel scale. Thin axes stay square. */
export function rbox(x: number, y: number, z: number, w: number, h: number, d: number, mat: Painter, o: Partial<BoxSpec> = {}, r = 1): BoxSpec[] {
  const rx = Math.min(r, w / 2 - 0.2), ry = Math.min(r, h / 2 - 0.2), rz = Math.min(r, d / 2 - 0.2);
  const out: BoxSpec[] = [];
  if (rz > 0.05 && ry > 0.05) out.push(box(x, y + ry, z, w, h - 2 * ry, d - 2 * rz, mat, o));
  if (rx > 0.05 && rz > 0.05) out.push(box(x, y, z, w - 2 * rx, h, d - 2 * rz, mat, o));
  if (rx > 0.05 && ry > 0.05) out.push(box(x, y + ry, z, w - 2 * rx, h - 2 * ry, d, mat, o));
  return out.length ? out : [box(x, y, z, w, h, d, mat, o)];
}

/** A rounded-rectangle footprint as non-overlapping strips following a quarter circle of radius c. */
function rounded(x: number, y: number, z: number, w: number, h: number, d: number, c: number, m: Painter, o: Partial<BoxSpec>, axis: 'xz' | 'xy'): BoxSpec[] {
  const along = axis === 'xz' ? d : h;
  c = Math.max(0, Math.min(c, along / 2 - 0.3, w / 2 - 0.3));
  const out: BoxSpec[] = [];
  const core = along - 2 * c;
  if (axis === 'xz') out.push(box(x, y, z, w, h, core, m, o)); else out.push(box(x, y + c, z, w, core, d, m, o));
  const n = 2, step = c / n;
  for (let k = 0; k < n; k++) {
    const s = (k + 0.5) * step, inset = c - Math.sqrt(Math.max(0, c * c - s * s));
    const ww = w - 2 * inset, off = core / 2 + k * step + step / 2;
    for (const sd of [-1, 1]) {
      if (axis === 'xz') out.push(box(x, y, z + sd * off, ww, h, step, m, o));
      else out.push(box(x, y + c + core / 2 + sd * off - step / 2, z, ww, step, d, m, o));
    }
  }
  return out;
}

/** Rounded voxel volume from horizontal slices: [y0, y1, inset, corner] relative to the bottom. */
export function sculpt(x: number, y: number, z: number, w: number, d: number, prof: [number, number, number, number][], m: Painter, o: Partial<BoxSpec> = {}): BoxSpec[] {
  return prof.flatMap(([y0, y1, inset, c]) => rounded(x, y + y0, z, w - 2 * inset, y1 - y0, d - 2 * inset, c, m, o, 'xz'));
}

/** A flat rounded plate facing +z. */
export function plate(x: number, y: number, z: number, w: number, h: number, d: number, c: number, m: Painter, o: Partial<BoxSpec> = {}): BoxSpec[] {
  return rounded(x, y, z, w, h, d, c, m, o, 'xy');
}

// ------------------------------------------------------------------ painting

/** Ramps with warm shadows for warm colours (no grey-lavender mud on cream and white). */
function fr(c: string, step = 0.05): Ramp {
  const [, C, h] = toLch(col(c));
  const warm = (h > 15 && h < 115) || C < 0.05;
  return ramp(col(c), warm ? { cool: 40, warm: 88, shift: 0.045, step } : { step });
}

/** Baked light per face: east, west, up, down, front, back (softer than the world's). */
const FACE = [0.05, -0.35, 0.7, -1.2, 0.2, -0.45];

/** Soft painterly shading: face light, a world-space top-to-bottom gradient and a gentle edge falloff. */
function soft(t: Texel, top: number, span: number): number {
  let L = FACE[t.face] + ((t.y - top) / span) * 0.9 + 0.35;
  if (t.face !== 2 && t.face !== 3 && t.w >= 4 && (t.u === 0 || t.u === t.w - 1)) L -= 0.25;
  return L;
}

/** Directional brush strokes: short, slightly offset dabs that read as fur or feathers. */
function strokes(a: number, b: number, len = 1.7, wid = 0.67, seed = 0): number {
  const colI = Math.floor(a / wid), off = hash(colI, 0, 0, seed) * len;
  const row = Math.floor((b + off) / len);
  const h = hash(colI, row, 1, seed);
  return h > 0.72 ? 0.32 : h < 0.22 ? -0.3 : 0;
}

function surf(t: Texel): [number, number] {
  switch (t.face) {
    case 4: return [t.x, -t.y];
    case 5: return [-t.x + 40, -t.y];
    case 0: return [-t.z + 20, -t.y];
    case 1: return [t.z + 60, -t.y];
    case 2: return [t.x, -t.z];
    default: return [t.x, t.z];
  }
}

/**
 * One painted feather in a field of overlapping scales: a soft dome of light, darker edges, a faint
 * shaft down the middle, a lit rim along the rounded tip and a shadow cast on the feather beneath.
 */
function feather(a: number, b: number, fw: number, fh: number, seed: number) {
  const fy = b / fh, row = Math.floor(fy), v = fy - row;
  const fx = a / fw + (row & 1) * 0.5, c = Math.floor(fx), u = fx - c;
  const arc = 0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2));
  const dd = v - arc;
  let L: number;
  if (dd >= 0) L = -0.95 + Math.min(dd, 0.3) * 2.2;
  else {
    L = 0.4 - v * 0.55 - Math.abs(u - 0.5) * 0.6;
    if (dd > -0.15) L += 0.6;
    else if (Math.abs(u - 0.5) < 0.07 && v > 0.12) L -= 0.32;
  }
  L += (hash(row, c, 3, seed) - 0.5) * 0.45;
  return { L, row, col: c, u, v, dd };
}

export function meowlPainter(p: OwlPalette): Painter {
  const owl = p.skin === 'owl';
  const mark = owl && p.mark ? fr(p.mark) : null;
  const fur = fr(p.fur), stripe = fr(p.stripe), wing = fr(p.wing), speck = fr(p.speck), belly = fr(p.belly, 0.04);
  const muzzle = fr(p.muzzle, 0.04), ear = fr(p.ear), nose = fr(p.nose, 0.07), paw = fr(p.paw, 0.04), liner = fr(p.liner);
  const blush = ramp(col(p.blush)), talon = ramp(0x8a8590, { step: 0.06 }), mouthR = ramp(0xd8546a);
  const patch = p.patch ? fr(p.patch) : stripe;
  const ex = G.eyeX, ey = G.eyeY;
  const pattern = p.pattern;

  /** Coat colour at a texel on the head/back fur: base, tabby stripe, calico patch or siamese point. */
  const coat = (t: Texel, L: number): number => {
    const [a, b] = surf(t);
    L += strokes(a, b, 1.6, 0.67, 3);
    if (pattern === 'tabby') {
      // stripes wrap around the head and back like a real tabby's mackerel bands
      const w = (fbm(t.x / 5, t.y / 5, t.z / 5, 7) - 0.5) * 2.2;
      const band = t.face === 2 ? Math.sin((Math.abs(t.x) + w) * 1.35) : Math.sin((t.y + w + (t.face === 5 ? t.x * 0.2 : 0)) * 1.25);
      if (band > 0.62) return tone(stripe, L * 0.7 + (band > 0.85 ? -0.2 : 0.4));
    } else if (pattern === 'calico') {
      const n = fbm(t.x / 4.5, t.y / 4.5, t.z / 4.5, 21);
      if (n > 0.6) return tone(patch, L);
      if (n < 0.33) return tone(stripe, L * 0.7 + 0.3);
    } else if (pattern === 'tuxedo') {
      return tone(fur, L * 0.8);
    } else if (pattern === 'points') {
      if (t.y > G.headTop - 2 || t.tag === 'ear') return tone(stripe, L * 0.7 + 0.2);
    }
    return tone(fur, L);
  };

  const P: Record<string, Painter> = {
    head(t) {
      const L = soft(t, G.headTop, 12);
      if (t.face === 3) return tone(muzzle, -0.4);
      if (t.face !== 4) return coat(t, L);
      const ax = Math.abs(t.x), dEye = Math.hypot(ax - ex, t.y - ey);
      // eyeliner hugging the lower edge of each eye, flicking out at the outer corner
      if (dEye > 2.5 && dEye < 2.95 && t.y < ey - 0.6 && ax > ex) return tone(liner, 0.2);
      if (ax > ex + 2.2 && ax < ex + 4.6 && Math.abs(t.y - (ey - 0.5 - (ax - ex - 2.2) * 0.38)) < 0.42) return tone(liner, 0);
      if (ax > ex + 2.6 && ax < ex + 4.4 && Math.abs(t.y - (ey - 2.2 - (ax - ex - 2.6) * 0.3)) < 0.36 && pattern !== 'solid') return tone(liner, 0.4);
      // the white blaze between the eyes, narrowing towards the forehead
      const blaze = 1.45 - Math.max(0, t.y - 18.6) * 0.22;
      if (pattern !== 'points' && ax < blaze && t.y < 23.2) return tone(muzzle, L * 0.5 + 0.4);
      // the tabby "M" on the forehead
      if (pattern !== 'solid' && pattern !== 'tuxedo' && t.y > 22.2 && t.y < 24.6 && (Math.abs(ax - 2.1) < 0.42 || (Math.abs(ax - 4.4) < 0.42 && t.y < 23.9))) return tone(stripe, 0);
      if (Math.hypot(ax - 5.4, t.y - 16.7) < 1.2) return tone(blush, 0.5 + (t.y > 17.6 ? 0.4 : 0));
      if (pattern === 'tuxedo' && t.y < 18 && ax < 5.4) return tone(muzzle, L * 0.5);
      if (pattern === 'points' && ax < 4.2 && t.y < 19.4) return tone(stripe, L * 0.5 + (ax > 3 ? 0.6 : 0));
      // the face itself stays clean: no mackerel bands across it, just soft painted fur
      if (pattern === 'tabby' || pattern === 'solid' || pattern === 'tuxedo') return tone(fur, L + 0.15 + strokes(t.x, -t.y, 1.4, 0.67, 3) * 0.7);
      return coat(t, L + 0.15);
    },
    cheek(t) {
      // fluffy cheek ruffs: soft tufts below the ears
      const L = soft(t, 18, 6) + strokes(t.z * 1.4, t.y, 1.1, 0.5, 9);
      return pattern === 'solid' || pattern === 'tuxedo' || pattern === 'calico' ? tone(muzzle, L * 0.6) : coat(t, L);
    },
    muzzle(t) {
      const L = soft(t, 18.8, 5) * 0.6 + 0.3;
      if (t.face === 4) {
        const ax = Math.abs(t.x);
        // the little "w" mouth under the nose
        if (Math.abs(t.x) < 0.17 && t.y > 16.35 && t.y < 17.2) return tone(nose, -1.6);
        if (Math.abs(Math.hypot(ax - 0.62, t.y - 16.6) - 0.6) < 0.17 && t.y < 16.6) return tone(nose, -1.6);
        // whisker pads
        if ([[2.1, 17.0], [2.6, 16.3], [1.8, 15.8]].some(([x, y]) => Math.hypot(ax - x, t.y - y) < 0.3)) return tone(muzzle, -1.4);
        if (pattern === 'points') return tone(stripe, L * 0.5 + 0.8 - Math.max(0, ax - 2) * 0.4);
        return tone(muzzle, L + (t.y < 15.4 ? -0.3 : 0));
      }
      return pattern === 'points' ? tone(stripe, L * 0.5) : tone(muzzle, L - 0.6);
    },
    nose(t) { return tone(nose, (t.face === 2 ? 1.2 : t.face === 4 ? 0.3 : -0.5) + (t.face === 4 && t.bx < t.sx * 0.45 && t.by > t.sy * 0.5 ? 0.9 : 0)); },
    mouth(t) { return tone(mouthR, t.face === 4 ? (t.by < t.sy * 0.45 ? 0.6 : -0.6) : -1); },
    whisker(t) { return tone(ramp(0xfffdf6), t.face === 2 ? 1 : 0); },
    ear(t) {
      const L = soft(t, G.headTop + 5, 6);
      // pink inner ear on the front, with a lighter heart and a dark rim at the tip
      if (t.face === 4) {
        const inset = Math.min(t.bx, t.sx - t.bx);
        if (inset > 0.6 && t.sy > 0) return tone(ear, (inset > 1.3 ? 0.6 : -0.3) + (t.y - G.headTop) * 0.08);
      }
      if (t.y > G.headTop + 3.2 && pattern !== 'solid') return tone(pattern === 'points' ? stripe : liner, 0.4);
      return coat(t, L);
    },
    body(t) {
      // the soft white chest covers the front; golden owl feathers wrap the back
      if (t.face === 3 || t.face === 4) return P.belly(t);
      return P.back(t);
    },
    belly(t) {
      let L = soft(t, G.bodyY + G.bodyH, 12) * 0.55 + 0.45;
      // barely-there feather scallops, painted, not noisy
      const row = Math.floor((G.bodyY + G.bodyH + 2 - t.y) / 1.25), off = (row & 1) * 0.9;
      const u = ((t.x + 40 + off) / 1.8) % 1, v = ((G.bodyY + G.bodyH + 2 - t.y) / 1.25) % 1;
      if (v > 0.62 + Math.abs(u - 0.5) * 0.5) L -= 0.38;
      L += strokes(t.x * 1.2, -t.y, 1.2, 0.6, 5) * 0.6;
      if (t.face === 4 && Math.abs(t.x) > G.bodyW / 2 - 1.4) L -= 0.4;
      return tone(belly, L);
    },
    back(t) {
      const [a, b] = surf(t);
      const L = soft(t, G.bodyY + G.bodyH, 12) + strokes(a, b, 1.4, 0.67, 13);
      if (hash(Math.floor(t.x * 3), Math.floor(t.y * 3), Math.floor(t.z * 3), 4) > 0.93) return tone(speck, 0.3);
      return tone(wing, L);
    },
    wing(t) {
      const outer = (t.face === 0 && t.x > 0) || (t.face === 1 && t.x < 0);
      const top = G.shoulderY + 1;
      if (!outer && t.face !== 2 && t.face !== 4 && t.face !== 5) return tone(wing, -0.9);
      const a = t.face === 4 || t.face === 5 ? t.x * 3 : -t.z, b = top - t.y;
      let L = soft(t, top, 12) * 0.8 + 0.25;
      if (b < 5.2) {
        // coverts: rounded feather tips in soft rows, peppered with fine grey speckles
        const row = Math.floor(b / 1.3), off = (row & 1) * 0.9;
        const u = ((a + 50 + off) / 1.8) % 1, v = (b / 1.3) % 1;
        if (v > 0.66 + Math.abs(u - 0.5) * 0.45) L -= 0.55; else if (v < 0.2) L += 0.25;
        const k = hash(Math.floor(t.x * 3 + t.z * 3), Math.floor(t.y * 3), 2, 7);
        if (k > 0.9) return tone(speck, 0.6);
        if (k < 0.04) return tone(speck, -0.6);
        return tone(wing, L + strokes(a, b, 1.2, 0.5, 2) * 0.6);
      }
      // flight feathers: long vanes with soft darker bars
      const vane = ((a + 100) / 1.5) % 1;
      L += vane < 0.14 ? -0.7 : vane > 0.85 ? 0.3 : 0;
      const bar = Math.floor((b + 0.4) / 1.35) % 2 === 0;
      if (!owl && hash(Math.floor(t.x * 3 + t.z * 3), Math.floor(t.y * 3), 3, 7) > 0.94) return tone(speck, 0.4);
      return bar && owl ? tone(stripe, L + 1.3) : tone(wing, L + (bar ? -0.55 : 0.1));
    },
    prim(t) {
      const vane = ((-t.z * 1.2 + 100) / 1.35) % 1;
      let L = soft(t, 7, 6) * 0.6 + (vane < 0.18 ? -0.8 : 0.1);
      if (t.by < 0.8) L -= 0.5;
      const bar = Math.floor((t.y + 30) / 1.1) % 2 === 0;
      return tone(wing, L + (bar ? -0.7 : 0));
    },
    tail(t) {
      const L = soft(t, 5, 4) * 0.7;
      return tone(wing, L + (Math.floor((t.z + 30) / 1.1) % 2 === 0 ? -0.6 : 0.1));
    },
    leg(t) { return tone(paw, soft(t, 3.3, 3) * 0.5 + 0.2 + strokes(t.x * 2 + t.z, -t.y, 0.9, 0.4, 41) * 0.6); },
    paw(t) { return tone(paw, soft(t, 1.2, 1.2) * 0.5 + 0.3 + (t.face === 4 && Math.floor(t.x * 3 + 30) % 3 === 0 ? -0.7 : 0)); },
    talon(t) { return tone(talon, t.face === 2 ? 0.8 : -0.2); },

    // ---------------- owl skin
    ohead(t) {
      if (t.face === 3) return tone(belly, -0.5);
      // the front of the head behind the disc is the dark ruff that frames it
      if (t.face === 4 && t.y < G.headTop - 1.6) return tone(liner, soft(t, G.headTop, 12) * 0.5 - 0.1 + strokes(t.x, -t.y, 1, 0.5, 4) * 0.6);
      const [a, b] = surf(t);
      const f = feather(a, G.headTop + 2 - t.y + (t.face === 2 ? (G.headFront - t.z) * 0.9 - (G.headTop + 2 - t.y) : 0), 1.75, 1.2, 5);
      const base = soft(t, G.headTop, 12) * 0.75;
      if (f.dd < -0.12 && hash(f.row, f.col, 7, 5) < 0.3 && Math.hypot((f.u - 0.5) * 1.75, (f.v - 0.36) * 1.2) < 0.36) return tone(speck, base * 0.5 + 0.5);
      const dark = hash(f.row, f.col, 9, 5) > 0.84;
      return tone(dark ? stripe : fur, base + f.L + (dark ? 0.9 : 0));
    },
    disc(t) {
      // sides of the raised disc are the ruff: a crisp dark outline around the face
      if (t.face !== 4) return tone(liner, (t.face === 2 ? 0.3 : -0.4) + strokes(t.x * 2, t.y * 2, 0.8, 0.4, 6) * 0.5);
      const dl = Math.hypot(t.x + ex, t.y - ey), dr = Math.hypot(t.x - ex, t.y - ey);
      const near = dl < dr ? -1 : 1, d = Math.min(dl, dr);
      const ang = Math.atan2(t.y - ey, t.x - near * ex);
      let L = 0.7 - Math.max(0, d - 2.6) * 0.32;
      // fine radiating feathers, painted as alternating soft strokes
      const ray = Math.sin(ang * 16 + d * 0.9);
      if (ray > 0.66) L -= 0.42; else if (ray < -0.8) L += 0.18;
      if (d > 2.75 && d < 3.25) L -= 0.55; // a soft socket ring round each eye
      if (Math.hypot(Math.abs(t.x) - 5.4, t.y - 16.5) < 1.1) return tone(blush, 0.5 + (t.y > 16.8 ? 0.4 : 0));
      if (Math.abs(t.x) < 1.9 && t.y < 16.2) L += 0.35;
      return tone(muzzle, L + (hash(Math.floor(t.x * 3), Math.floor(t.y * 3), 2, 8) - 0.5) * 0.14);
    },
    tuft(t) {
      const L = soft(t, G.headTop + 4, 5) * 0.8;
      const streak = Math.abs(((Math.abs(t.x) * 3 + t.z * 2) % 3) - 1.5) < 0.35;
      return tone(streak ? stripe : fur, L + (streak ? 1.1 : 0.2) + strokes(t.x * 2, t.y * 2, 0.7, 0.35, 2) * 0.6);
    },
    tufttip(t) { return tone(ear, soft(t, G.headTop + 5, 4) * 0.4 + 0.5); },
    brow(t) { return tone(muzzle, soft(t, 24, 2) * 0.5 + 0.6 + (Math.floor(t.x * 3 + t.y * 1.5) % 3 === 0 ? -0.45 : 0)); },
    beak(t) {
      let L = FACE[t.face] * 1.2 + 0.1;
      if (t.face === 2 && t.bz < 0.5) L -= 0.8;
      if ((t.face === 4 || t.face === 2) && t.bx < t.sx * 0.42 && t.by > t.sy * 0.45) L += 1.1;
      return tone(nose, L);
    },
    obelly(t) {
      if (t.face !== 4 && t.face !== 3) return P.back(t);
      const top = G.bodyY + G.bodyH + 1, b = top - t.y;
      const f = feather(t.x + 30, b, 1.9, 1.3, 21);
      let L = soft(t, top, 12) * 0.5 + 0.35 + f.L * 0.5;
      if (t.face === 4 && Math.abs(t.x) > G.bodyW / 2 - 1.2) L -= 0.4;
      // little arrowhead chevrons in rows, denser lower down
      if (mark && b > 3.2 && t.face === 4) {
        const rI = Math.floor(b / 2.05), vv = b / 2.05 - rI, off = (rI & 1) * 1.45;
        const cx = Math.round((t.x - off) / 2.9) * 2.9 + off, dx = t.x - cx;
        if (Math.abs(dx) < 1.0 && Math.abs(vv - 0.3 - Math.abs(dx) * 0.34) < 0.15 && hash(rI, Math.round(cx * 3), 4, 0) > 0.15) return tone(mark, L * 0.5 + (dx < 0 ? 0.3 : -0.2));
      }
      return tone(belly, L);
    },
  };
  if (owl) {
    // owls: feathered back and wings with freckles instead of pepper speckles
    P.back = (t) => {
      const [a, b] = surf(t);
      const f = feather(a, b, 2.1, 1.5, 13);
      const base = soft(t, G.bodyY + G.bodyH, 12) * 0.75;
      if (f.dd < -0.12 && hash(f.row, f.col, 7, 13) < 0.22 && Math.hypot((f.u - 0.5) * 2.1, (f.v - 0.36) * 1.5) < 0.4) return tone(speck, base * 0.5 + 0.4);
      return tone(hash(f.row, f.col, 9, 13) > 0.85 ? stripe : wing, base + f.L);
    };
    P.body = (t) => (t.face === 3 || (t.face === 4 && Math.hypot(t.x / 4.9, (t.y - 8.4) / 5.4) < 1) ? P.obelly(t) : P.back(t));
    const meowlWing = P.wing;
    P.wing = (t) => {
      const b = G.shoulderY + 1 - t.y;
      const outer = (t.face === 0 && t.x > 0) || (t.face === 1 && t.x < 0);
      if (b < 5.2 && (outer || t.face === 2)) {
        const a = -t.z;
        const f = feather(a + 50, b, 1.75, 1.2, 31);
        if (f.dd < -0.12 && hash(f.row, f.col, 7, 31) < 0.42 && Math.hypot((f.u - 0.5) * 1.75, (f.v - 0.34) * 1.2) < 0.36) return tone(speck, 0.55);
        return tone(wing, soft(t, G.shoulderY + 1, 12) * 0.7 + 0.2 + f.L);
      }
      return meowlWing(t);
    };
  }
  return (t) => (P[t.tag] ?? P.body)(t);
}

// ------------------------------------------------------------------ the parts

export interface OwlLook { skin?: Skin; palette: string; outfit: Partial<Record<OutfitSlot, string>> }
export type OutfitSlot = 'head' | 'face' | 'neck' | 'body' | 'back';

export interface OwlParts {
  bones: Record<BoneName, BoxSpec[]>;
  add(bone: BoneName, ...b: BoxSpec[]): void;
  pal: OwlPalette;
  /** show the ears (big hats tuck them in) */
  tufts: boolean;
}

function baseParts(pal: OwlPalette): OwlParts {
  const m = meowlPainter(pal);
  const bones = {} as Record<BoneName, BoxSpec[]>;
  for (const k of Object.keys(PIVOTS) as BoneName[]) bones[k] = [];
  const P: OwlParts = { bones, add: (bone, ...b) => bones[bone].push(...b), pal, tufts: true };

  // body: a plump rounded barrel, white chest in front
  P.add('body', ...sculpt(0, G.bodyY, 0, G.bodyW, G.bodyD, [[0, 1, 1.5, 2.4], [1, 2.2, 0.5, 3], [2.2, 9.6, 0, 3.4], [9.6, 11, 0.6, 3.2]], m, { tag: 'body' }));
  P.add('body', ...plate(0, G.bodyY + 1.2, G.bodyD / 2 - 0.1, 8.6, 6.4, 0.6, 2.8, m, { tag: pal.skin === 'owl' ? 'obelly' : 'belly' }));
  P.add('body', ...sculpt(0, G.bodyY - 0.4, 0, G.bodyW - 3.6, G.bodyD - 3.6, [[0, 0.6, 0, 2]], m, { tag: 'belly' }));

  if (pal.skin === 'owl') {
    // head: big and round, a raised two-disc facial mask, a hooked beak, soft brows and ear tufts
    P.add('head', ...sculpt(0, G.headY, G.headZ, G.headW, G.headD, [[0, 1, 1.4, 3], [1, 2.2, 0.5, 3.6], [2.2, 10, 0, 4], [10, 11.6, 0.6, 3.8], [11.6, 12.8, 1.9, 3.4]], m, { tag: 'ohead' }));
    const pz = G.headFront + 0.5, df = G.discFront;
    P.add('head', ...plate(-G.eyeX, G.eyeY - 4.25, pz, 8.1, 8.5, 0.9, 3.9, m, { tag: 'disc' }));
    P.add('head', ...plate(G.eyeX, G.eyeY - 4.25, pz + 0.08, 8.1, 8.5, 0.9, 3.9, m, { tag: 'disc' }));
    P.add('head', ...plate(0, 14.2, pz - 0.1, 5.2, 5, 0.9, 1.8, m, { tag: 'disc' }));
    P.add('head', box(0, 16.3, df + 0.65, 2.1, 1.9, 1.3, m, { tag: 'beak' }), box(0, 15.7, df + 1.0, 1.25, 0.8, 0.9, m, { tag: 'beak' }), box(0, 17.9, df + 0.35, 1.3, 1.0, 0.8, m, { tag: 'beak' }));
    P.add('jaw', box(0, 15.5, df + 0.3, 1.6, 0.9, 0.3, m, { tag: 'mouth' }));
    for (const [bone, sd] of [['browL', -1], ['browR', 1]] as const) {
      P.add(bone, { ...box(sd * (G.eyeX + 0.4), 23.15, df + 0.15, 3.8, 0.8, 0.8, m, { tag: 'brow' }), rot: [0, 0, -sd * 5], pivot: [sd * G.eyeX, 23.5, df] });
      P.add(bone, { ...box(sd * (G.eyeX + 2.5), 22.85, df + 0.05, 1.3, 0.75, 0.7, m, { tag: 'brow' }), rot: [0, 0, -sd * 24], pivot: [sd * (G.eyeX + 2), 23.2, df] });
    }
    for (const [bone, sd] of [['tuftL', -1], ['tuftR', 1]] as const) {
      const px = sd * 5.3;
      P.add(bone, lean(box(px, 23.9, 0.4, 2.8, 2.8, 2.4, m, { tag: 'tuft' }), 0, 0, -sd * 18));
      P.add(bone, lean(box(px + sd * 0.85, 26.2, 0.3, 1.9, 1.9, 1.8, m, { tag: 'tuft' }), 0, 0, -sd * 34));
      P.add(bone, lean(box(px + sd * 1.9, 27.6, 0.25, 1.1, 1.1, 1.1, m, { tag: 'tufttip' }), 0, 0, -sd * 52));
    }
  } else {
    // head: a round kitten head, cheek ruffs, a raised white muzzle
    P.add('head', ...sculpt(0, G.headY, G.headZ, G.headW, G.headD, [[0, 1, 1.4, 3], [1, 2.2, 0.5, 3.6], [2.2, 10, 0, 4], [10, 11.6, 0.6, 3.8], [11.6, 12.8, 1.9, 3.4]], m, { tag: 'head' }));
    for (const sd of [-1, 1]) {
      P.add('head', { ...box(sd * 7.8, G.headY + 0.5, 1.8, 1.6, 3.4, 5.6, m, { tag: 'cheek' }), rot: [0, 0, sd * 16], pivot: [sd * 7.6, G.headY + 2, 1.8] });
    }
    P.add('head', ...plate(0, 14.6, G.headFront + 0.45, 7.4, 4.4, 0.9, 2, m, { tag: 'muzzle' }));
    P.add('head', ...plate(0, 14.0, G.headFront + 0.2, 4.6, 2.2, 0.9, 1, m, { tag: 'muzzle' }));
    // nose: a tiny pink triangle
    P.add('head', box(0, G.noseY, G.faceFront + 0.25, 1.9, 0.8, 0.6, m, { tag: 'nose' }), box(0, G.noseY - 0.5, G.faceFront + 0.25, 1.0, 0.55, 0.55, m, { tag: 'nose' }));
    // whiskers
    for (const sd of [-1, 1]) for (const [y, a] of [[16.9, 7], [16.2, -5]] as const) {
      P.add('head', { ...box(sd * 4.9, y, G.faceFront - 0.3, 3.0, 0.24, 0.24, m, { tag: 'whisker' }), rot: [0, -sd * 12, sd * a], pivot: [sd * 3.4, y, G.faceFront - 0.3] });
    }
    // the mouth (shown when Pip opens it; the actor scales it)
    P.add('jaw', box(0, 15.7, G.faceFront + 0.05, 1.7, 1.1, 0.3, m, { tag: 'mouth' }));
    // ears: stacked slabs tapering to a point, leaning out a little
    for (const [bone, sd] of [['tuftL', -1], ['tuftR', 1]] as const) {
      const th = 13 * (Math.PI / 180), px = sd * 4.9;
      for (let k = 0; k < 3; k++) {
        const w = 5.6 - k * 1.75, d = 2.6 - k * 0.4, h = 1.45;
        const cx = px + sd * Math.sin(th) * k * h, cy = 24.0 + Math.cos(th) * k * h;
        P.add(bone, { ...box(cx, cy, 0.2, w, h + 0.05, d, m, { tag: 'ear' }), rot: [0, 0, -sd * 13], pivot: [cx, cy, 0.2] });
      }
    }
  }
  // wings: golden barn-owl wings folded along the sides, primaries poking out behind
  for (const [bone, sd] of [['wingL', -1], ['wingR', 1]] as const) {
    const x = sd * G.wingX;
    P.add(bone, ...rbox(x, 3.8, -0.5, 2.3, 10, 9.8, m, { tag: 'wing', rot: [0, 0, -sd * 3], pivot: [sd * 6.4, G.shoulderY, -0.4] }, 1.1));
    P.add(bone, { ...box(x - sd * 0.1, 2.2, -3.8, 1.8, 3.8, 6.2, m, { tag: 'prim' }), rot: [-14, 0, -sd * 3], pivot: [x, 6, -0.6] });
  }
  P.add('tail', { ...box(0, 3.4, -6.6, 7.4, 1.6, 3.6, m, { tag: 'tail' }), rot: [22, 0, 0], pivot: [0, 4.6, -5.2] });
  // fluffy white feathered legs and paws with tiny talons
  for (const [bone, sd] of [['legL', -1], ['legR', 1]] as const) {
    const x = sd * 2.7;
    P.add(bone, box(x, 0.9, 0.8, 3.2, 2.4, 3.2, m, { tag: 'leg' }), box(x, 0, 2.1, 3.6, 1.3, 2.8, m, { tag: 'paw' }));
    for (const k of [-1, 0, 1]) P.add(bone, box(x + k * 1.15, 0, 3.6, 0.6, 0.45, 0.6, m, { tag: 'talon' }));
  }
  return P;
}

export interface OwlModel {
  rig: Rig;
  eyes: [Eye, Eye];
  eyeMeshes: THREE.Mesh[];
  look: OwlLook;
  height: number;
  dispose(): void;
}

export function buildOwl(look: OwlLook): OwlModel {
  const pal = palette(look.palette);
  const P = baseParts(pal);
  dressOwl(P, look.outfit);
  if (!P.tufts) { P.bones.tuftL = []; P.bones.tuftR = []; }
  const bones: BoneSpec[] = (Object.keys(PIVOTS) as BoneName[]).map((name) => ({ name, parent: PARENT[name], pivot: PIVOTS[name], boxes: P.bones[name] }));
  const rig = buildRig(bones, { density: OWL_DENS });

  rig.bones.jaw.visible = false;
  const eyes: [Eye, Eye] = [new Eye(-1, eyeColours(pal)), new Eye(1, eyeColours(pal))];
  const head = rig.bones.head, hp = PIVOTS.head;
  const geo = new THREE.PlaneGeometry(G.eyeS * PX, G.eyeS * PX);
  const eyeMeshes = eyes.map((e, i) => {
    const mat = new THREE.MeshLambertMaterial({ map: e.tex, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: e.tex, emissiveIntensity: 0.18, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(((i ? 1 : -1) * G.eyeX - hp[0]) * PX, (G.eyeY - hp[1]) * PX, ((pal.skin === 'owl' ? G.discFront + 0.06 : G.headFront + 0.12) - hp[2]) * PX);
    m.castShadow = false;
    head.add(m);
    return m;
  });
  rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !(eyeMeshes as THREE.Object3D[]).includes(o)) o.castShadow = true; });
  return {
    rig, eyes, eyeMeshes, look, height: rig.height,
    dispose() {
      rig.dispose(); geo.dispose();
      eyeMeshes.forEach((m) => (m.material as THREE.Material).dispose());
      eyes.forEach((e) => e.tex.dispose());
    },
  };
}

/** Feather colour for particle puffs. */
export const featherColour = (paletteId: string): number => col(palette(paletteId).wing);
export { mix };
