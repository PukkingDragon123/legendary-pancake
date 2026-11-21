// The Meowl skin: a kitten's head (pointy ears, white muzzle, pink nose, whiskers, tabby coat) on a
// real owl's body. The head is modelled in its own frame (M) and moved onto the species' neck.
import { box, type BoxSpec, type Painter, type Texel } from '../gfx/box.ts';
import { col, ramp, tone } from '../gfx/color.ts';
import { fbm, hash } from '../gfx/noise.ts';
import { fr, lit } from './plumage.ts';
import type { OwlPalette } from './palette.ts';

/** The kitten head's own frame (the old Pip proportions). */
export const M = { headY: 12.4, headH: 12.8, headW: 16.4, headD: 12.6, headZ: 0.2, headTop: 25.2, headFront: 6.5, faceFront: 7.4, eyeX: 3.95, eyeY: 19.5, eyeS: 5.1, noseY: 17.6 };

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
function strokes(a: number, b: number, len = 1.7, wid = 0.67, seed = 0): number {
  const colI = Math.floor(a / wid), off = hash(colI, 0, 0, seed) * len;
  const h = hash(colI, Math.floor((b + off) / len), 1, seed);
  return h > 0.72 ? 0.32 : h < 0.22 ? -0.3 : 0;
}

/** Iris colours for the kitten eyes, by coat. */
export const MEOWL_IRIS: Record<string, string> = {
  tabby: '#9cc43c', ginger: '#e3a12c', snow: '#6fb4ea', tuxedo: '#bcd23e', calico: '#d9a22e', siamese: '#3f7fe0', midnight: '#a993ff', ember: '#ffb444', aurora: '#5fe0c2',
};

export function meowlHead(p: OwlPalette): { boxes: Record<'head' | 'jaw' | 'tuftL' | 'tuftR', BoxSpec[]>; } {
  const fur = fr(p.fur), stripe = fr(p.stripe), muzzle = fr(p.muzzle, 0.04), ear = fr(p.ear), nose = fr(p.nose, 0.07), liner = fr(p.liner);
  const blush = ramp(col(p.blush)), mouthR = ramp(0xd8546a), whisk = ramp(0xfffdf6);
  const patch = p.patch ? fr(p.patch) : stripe;
  const ex = M.eyeX, ey = M.eyeY, pattern = p.pattern;
  const coat = (t: Texel, L: number): number => {
    const [a, b] = surf(t);
    L += strokes(a, b, 1.6, 0.67, 3);
    if (pattern === 'tabby') {
      const w = (fbm(t.x / 5, t.y / 5, t.z / 5, 7) - 0.5) * 2.2;
      const band = t.face === 2 ? Math.sin((Math.abs(t.x) + w) * 1.35) : Math.sin((t.y + w + (t.face === 5 ? t.x * 0.2 : 0)) * 1.25);
      if (band > 0.62) return tone(stripe, L * 0.7 + (band > 0.85 ? -0.2 : 0.4));
    } else if (pattern === 'calico') {
      const n = fbm(t.x / 4.5, t.y / 4.5, t.z / 4.5, 21);
      if (n > 0.6) return tone(patch, L);
      if (n < 0.33) return tone(stripe, L * 0.7 + 0.3);
    } else if (pattern === 'tuxedo') return tone(fur, L * 0.8);
    else if (pattern === 'points' && (t.y > M.headTop - 2 || t.tag === 'ear')) return tone(stripe, L * 0.7 + 0.2);
    return tone(fur, L);
  };
  const P: Record<string, Painter> = {
    head(t) {
      const L = lit(t, M.headTop, 12);
      if (t.face === 3) return tone(muzzle, -0.4);
      if (t.face !== 4) return coat(t, L);
      const ax = Math.abs(t.x);
      if (ax > ex + 2.2 && ax < ex + 4.6 && Math.abs(t.y - (ey - 0.5 - (ax - ex - 2.2) * 0.38)) < 0.42) return tone(liner, 0);
      const blaze = 1.45 - Math.max(0, t.y - 18.6) * 0.22;
      if (pattern !== 'points' && ax < blaze && t.y < 23.2) return tone(muzzle, L * 0.5 + 0.4);
      if (pattern !== 'solid' && pattern !== 'tuxedo' && t.y > 22.2 && t.y < 24.6 && (Math.abs(ax - 2.1) < 0.42 || (Math.abs(ax - 4.4) < 0.42 && t.y < 23.9))) return tone(stripe, 0);
      if (Math.hypot(ax - 5.4, t.y - 16.7) < 1.2) return tone(blush, 0.5 + (t.y > 17.6 ? 0.4 : 0));
      if (pattern === 'tuxedo' && t.y < 18 && ax < 5.4) return tone(muzzle, L * 0.5);
      if (pattern === 'points' && ax < 4.2 && t.y < 19.4) return tone(stripe, L * 0.5 + (ax > 3 ? 0.6 : 0));
      if (pattern === 'tabby' || pattern === 'solid' || pattern === 'tuxedo') return tone(fur, L + 0.15 + strokes(t.x, -t.y, 1.4, 0.67, 3) * 0.7);
      return coat(t, L + 0.15);
    },
    cheek(t) {
      const L = lit(t, 18, 6) + strokes(t.z * 1.4, t.y, 1.1, 0.5, 9);
      return pattern === 'solid' || pattern === 'tuxedo' || pattern === 'calico' ? tone(muzzle, L * 0.6) : coat(t, L);
    },
    muzzle(t) {
      const L = lit(t, 18.8, 5) * 0.6 + 0.3;
      if (t.face === 4) {
        const ax = Math.abs(t.x);
        if (ax < 0.17 && t.y > 16.35 && t.y < 17.2) return tone(nose, -1.6);
        if (Math.abs(Math.hypot(ax - 0.62, t.y - 16.6) - 0.6) < 0.17 && t.y < 16.6) return tone(nose, -1.6);
        if ([[2.1, 17.0], [2.6, 16.3], [1.8, 15.8]].some(([x, y]) => Math.hypot(ax - x, t.y - y) < 0.3)) return tone(muzzle, -1.4);
        if (pattern === 'points') return tone(stripe, L * 0.5 + 0.8 - Math.max(0, ax - 2) * 0.4);
        return tone(muzzle, L + (t.y < 15.4 ? -0.3 : 0));
      }
      return pattern === 'points' ? tone(stripe, L * 0.5) : tone(muzzle, L - 0.6);
    },
    nose(t) { return tone(nose, (t.face === 2 ? 1.2 : t.face === 4 ? 0.3 : -0.5) + (t.face === 4 && t.bx < t.sx * 0.45 && t.by > t.sy * 0.5 ? 0.9 : 0)); },
    mouth(t) { return tone(mouthR, t.face === 4 ? (t.by < t.sy * 0.45 ? 0.6 : -0.6) : -1); },
    whisker(t) { return tone(whisk, t.face === 2 ? 1 : 0); },
    ear(t) {
      const L = lit(t, M.headTop + 5, 6);
      if (t.face === 4) {
        const inset = Math.min(t.bx, t.sx - t.bx);
        if (inset > 0.6 && t.sy > 0) return tone(ear, (inset > 1.3 ? 0.6 : -0.3) + (t.y - M.headTop) * 0.08);
      }
      if (t.y > M.headTop + 3.2 && pattern !== 'solid') return tone(pattern === 'points' ? stripe : liner, 0.4);
      return coat(t, L);
    },
  };
  const m: Painter = (t) => (P[t.tag] ?? P.head)(t);
  const head: BoxSpec[] = [], jaw: BoxSpec[] = [], tuftL: BoxSpec[] = [], tuftR: BoxSpec[] = [];
  const prof: [number, number, number, number][] = [[0, 1, 1.4, 3], [1, 2.2, 0.5, 3.6], [2.2, 10, 0, 4], [10, 11.6, 0.6, 3.8], [11.6, 12.8, 1.9, 3.4]];
  for (const [y0, y1, inset] of prof) {
    const w = M.headW - 2 * inset, d = M.headD - 2 * inset, c = Math.min(4, w / 2 - 0.3, d / 2 - 0.3);
    head.push(box(0, M.headY + y0, M.headZ, w, y1 - y0, d - 2 * c, m, { tag: 'head' }));
    for (let k = 0; k < 2; k++) {
      const st = c / 2, s = (k + 0.5) * st, inS = c - Math.sqrt(Math.max(0, c * c - s * s)), off = (d - 2 * c) / 2 + k * st + st / 2;
      for (const sd of [-1, 1]) head.push(box(0, M.headY + y0, M.headZ + sd * off, w - 2 * inS, y1 - y0, st, m, { tag: 'head' }));
    }
  }
  for (const sd of [-1, 1]) head.push({ ...box(sd * 7.8, M.headY + 0.5, 1.8, 1.6, 3.4, 5.6, m, { tag: 'cheek' }), rot: [0, 0, sd * 16], pivot: [sd * 7.6, M.headY + 2, 1.8] });
  head.push(box(0, 14.6 + 0.6, M.headFront + 0.45, 7.4, 3.2, 0.9, m, { tag: 'muzzle' }), box(0, 14.6, M.headFront + 0.45, 5.4, 0.6, 0.9, m, { tag: 'muzzle' }));
  head.push(box(0, 14.0, M.headFront + 0.2, 4.6, 2.2, 0.9, m, { tag: 'muzzle' }));
  head.push(box(0, M.noseY, M.faceFront + 0.25, 1.9, 0.8, 0.6, m, { tag: 'nose' }), box(0, M.noseY - 0.5, M.faceFront + 0.25, 1.0, 0.55, 0.55, m, { tag: 'nose' }));
  for (const sd of [-1, 1]) for (const [y, a] of [[16.9, 7], [16.2, -5]] as const) {
    head.push({ ...box(sd * 4.9, y, M.faceFront - 0.3, 3.0, 0.24, 0.24, m, { tag: 'whisker' }), rot: [0, -sd * 12, sd * a], pivot: [sd * 3.4, y, M.faceFront - 0.3] });
  }
  jaw.push(box(0, 15.7, M.faceFront + 0.05, 1.7, 1.1, 0.3, m, { tag: 'mouth' }));
  for (const [arr, sd] of [[tuftL, -1], [tuftR, 1]] as const) {
    const th = 13 * (Math.PI / 180), px = sd * 4.9;
    for (let k = 0; k < 3; k++) {
      const w = 5.6 - k * 1.75, d = 2.6 - k * 0.4, h = 1.45;
      const cx = px + sd * Math.sin(th) * k * h, cy = 24.0 + Math.cos(th) * k * h;
      arr.push({ ...box(cx, cy, 0.2, w, h + 0.05, d, m, { tag: 'ear' }), rot: [0, 0, -sd * 13], pivot: [cx, cy, 0.2] });
    }
  }
  return { boxes: { head, jaw, tuftL, tuftR } };
}

/** Move boxes built in the kitten frame by (0, dy, dz), shifting the texels the painter sees back. */
export function shiftBoxes(boxes: BoxSpec[], dy: number, dz: number): BoxSpec[] {
  return boxes.map((b) => {
    const mat = b.mat;
    const shifted: Painter = (t) => { t.y -= dy; t.z -= dz; const c = mat(t); t.y += dy; t.z += dz; return c; };
    return {
      ...b, mat: shifted,
      at: [b.at[0], b.at[1] + dy, b.at[2] + dz],
      pivot: b.pivot ? [b.pivot[0], b.pivot[1] + dy, b.pivot[2] + dz] : undefined,
    };
  });
}
