// Anchor points of one owl, derived from its species shape. Everything that has to line up with the
// body (the painters, outfit pieces, the actor's neck and eye math, portraits) reads from here, so
// a hat sits on a flat-headed Little Owl and on a domed Great Grey alike. Units: model px.
// The body and head are smooth profiled volumes: at each height they have a half width and a front
// and back depth. The model slices them into stepped voxel layers; painters use the same profile to
// paint light that follows the rounded form.
import type { Shape } from './species.ts';

export interface Profile {
  /** bottom and height of the volume (model px) and its centre line depth */
  y0: number; h: number; zc: number;
  /** at relative height k (0 bottom .. 1 top): half width, front z and back z (absolute) */
  hw(k: number): number;
  front(k: number): number;
  back(k: number): number;
}

export interface Geo {
  shape: Shape;
  toeH: number;
  legX: number;
  /** where the leg disappears into the belly feathers */
  legTop: number;
  /** body: bottom of the belly, its height and footprint, and its top (the shoulders) */
  bodyY: number; bodyH: number; bodyW: number; bodyD: number; bodyTop: number;
  /** front of the breast at its fullest */
  chestZ: number;
  shoulderY: number;
  /** the head: base (sits in the shoulders), size, centre depth, top and front */
  neckY: number;
  headY: number; headH: number; headW: number; headD: number; headZ: number;
  headTop: number; headFront: number;
  /** face planes: the dished disc, the eyes, the raised ruff around it */
  discFront: number; faceFront: number; rimFront: number;
  eyeX: number; eyeY: number; eyeS: number;
  /** beak: top of the cere and the hooked tip */
  beakY: number; beakTip: number; noseY: number;
  wingX: number;
  /** highest point of the ear tufts (or the crown) */
  tuftTop: number;
  body: Profile;
  head: Profile;
}

/** Piecewise-linear lookup through (k, v) pairs. */
function curve(pts: [number, number][]): (k: number) => number {
  return (k) => {
    if (k <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (k <= pts[i][0]) {
        const [k0, v0] = pts[i - 1], [k1, v1] = pts[i];
        const t = (k - k0) / (k1 - k0), s = t * t * (3 - 2 * t);
        return v0 + (v1 - v0) * (0.5 * t + 0.5 * s);
      }
    }
    return pts[pts.length - 1][1];
  };
}

/** Bake a profile into lookup tables (it is sampled for every texel, so it must be cheap). */
function baked(p: Profile): Profile {
  const N = 256, hw = new Float32Array(N + 1), fr = new Float32Array(N + 1), bk = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { const k = i / N; hw[i] = p.hw(k); fr[i] = p.front(k); bk[i] = p.back(k); }
  const at = (a: Float32Array) => (k: number) => {
    const x = (k < 0 ? 0 : k > 1 ? 1 : k) * N, i = Math.min(N - 1, Math.floor(x)), t = x - i;
    return a[i] + (a[i + 1] - a[i]) * t;
  };
  return { y0: p.y0, h: p.h, zc: p.zc, hw: at(hw), front: at(fr), back: at(bk) };
}

function bodyProfile(s: Shape, y0: number): Profile {
  const W = s.bodyW / 2, D = s.bodyD / 2, br = s.breast;
  const hw = curve([[0, 0.6], [0.05, 0.8], [0.13, 0.93], [0.28, 1], [0.45, 1], [0.6, 0.97], [0.74, 0.9], [0.86, 0.79], [0.95, 0.64], [1, 0.5]]);
  const fr = curve([[0, 0.5], [0.06, 0.78], [0.16, 0.93], [0.32, 1], [0.48, 1 + br / D], [0.62, 1 + (br * 0.9) / D], [0.76, 0.95], [0.88, 0.76], [1, 0.42]]);
  const bk = curve([[0, 0.55], [0.08, 0.84], [0.22, 0.97], [0.45, 1], [0.65, 0.96], [0.82, 0.86], [0.93, 0.7], [1, 0.52]]);
  return { y0, h: s.bodyH, zc: 0, hw: (k) => W * hw(k), front: (k) => D * fr(k), back: (k) => -D * bk(k) };
}

function headProfile(s: Shape, y0: number, zc: number): Profile {
  const W = s.headW / 2, D = s.headD / 2;
  // a domed skull (superellipse crown: higher exponent = flatter top), a soft chin into the neck
  const p = 2.1 + s.flat * 3.2;
  const dome = (k: number) => (k < 0.48 ? 0.8 + 0.2 * (1 - ((0.48 - k) / 0.48) ** 2) : Math.pow(Math.max(0, 1 - Math.pow((k - 0.48) / 0.52, p)), 1 / p));
  return {
    y0, h: s.headH, zc,
    hw: (k) => W * Math.max(0.34, dome(k)),
    front: (k) => zc + D * Math.max(0.32, k < 0.48 ? 0.88 + 0.12 * (1 - ((0.48 - k) / 0.48) ** 2) : dome(k)),
    back: (k) => zc - D * Math.max(0.36, k < 0.48 ? 0.78 + 0.22 * (1 - ((0.48 - k) / 0.48) ** 2) : dome(k)),
  };
}

export function geoOf(s: Shape): Geo {
  const toeH = 0.9;
  const legTop = toeH + s.legH;
  const bodyY = legTop - 0.6;
  const bodyTop = bodyY + s.bodyH;
  const headY = bodyTop - s.neck;
  const headTop = headY + s.headH;
  const headZ = 0.6;
  const head = baked(headProfile(s, headY, headZ));
  const eyeY = headY + s.headH * s.eyeV;
  const headFront = head.front(s.eyeV);
  const discFront = headFront + 0.45;
  const beakY = eyeY - s.eyeS * 0.3;
  const tuftTop = s.tuft ? headTop - 0.6 + s.tuft.len * Math.cos((s.tuft.lean * Math.PI) / 180) : headTop;
  const body = baked(bodyProfile(s, bodyY));
  return {
    shape: s, toeH, legX: s.legX, legTop,
    bodyY, bodyH: s.bodyH, bodyW: s.bodyW, bodyD: s.bodyD, bodyTop,
    chestZ: body.front(0.55),
    shoulderY: bodyTop - 1.6,
    neckY: headY,
    headY, headH: s.headH, headW: s.headW, headD: s.headD, headZ, headTop, headFront,
    discFront, faceFront: discFront, rimFront: headFront + 1.2,
    eyeX: s.eyeX, eyeY, eyeS: s.eyeS,
    beakY, beakTip: beakY - 2.6, noseY: beakY - 1.2,
    wingX: s.bodyW / 2 + 0.5,
    tuftTop,
    body, head,
  };
}

/** Half-width of the body at height y. */
export function bodyHalfW(g: Geo, y: number): number {
  return g.body.hw(Math.max(0, Math.min(1, (y - g.bodyY) / g.bodyH)));
}
/** Front and back of the body at height y. */
export function bodyDepth(g: Geo, y: number): { front: number; back: number } {
  const k = Math.max(0, Math.min(1, (y - g.bodyY) / g.bodyH));
  return { front: g.body.front(k), back: g.body.back(k) };
}
