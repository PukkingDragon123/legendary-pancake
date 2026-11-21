// Pip, modelled on real owls. Each species gets its own proportions (a Saw-whet's huge round head,
// a Burrowing Owl's stilts, a Great Grey's dish of a face). The egg-shaped body and the domed head
// are sliced from smooth profiles into stepped voxel layers; on top sit many plates: a dished facial
// disc framed by a raised ruff, brows, rictal bristles and a hooked beak with its cere, nape and
// mantle feathers, flank feathers fluffing over the wings, folded wings in layers (scapulars, covert
// rows with hanging tips, secondaries, separated primaries crossing over the tail), a barred tail
// fan, feathered legs, toes and curved talons. Everything is painted at four texels per pixel.
import * as THREE from 'three';
import { box, buildRig, lean, PX, type BoneSpec, type BoxSpec, type Painter, type Rig, type Vec3 } from '../gfx/box.ts';
import { col, mix } from '../gfx/color.ts';
import { Eye, EYE_PLANE, type EyeColours } from './eyes.ts';
import { bodyDepth, bodyHalfW, geoOf, type Geo, type Profile } from './geo.ts';
import { M, MEOWL_IRIS, meowlHead, shiftBoxes } from './meowl.ts';
import { palette, PALETTE, type OwlPalette } from './palette.ts';
import { paintKit, type Kit } from './plumage.ts';
import { dressOwl, holdItem } from './outfits.ts';
import { skinEyes, skinExtras, skinKit, SPECIAL_SKIN } from './skins.ts';
import { resolveSpecies, speciesOf, type SpeciesDef } from './species.ts';

/** Texels per model pixel. */
export const OWL_DENS = 4;

export type BoneName = 'body' | 'head' | 'tuftL' | 'tuftR' | 'browL' | 'browR' | 'jaw' | 'wingL' | 'wingR' | 'handL' | 'handR' | 'tail' | 'legL' | 'legR';
const BONES: BoneName[] = ['body', 'head', 'tuftL', 'tuftR', 'browL', 'browR', 'jaw', 'wingL', 'wingR', 'handL', 'handR', 'tail', 'legL', 'legR'];
const PARENT: Partial<Record<BoneName, BoneName>> = {
  tuftL: 'head', tuftR: 'head', browL: 'head', browR: 'head', jaw: 'head', wingL: 'body', wingR: 'body', handL: 'wingL', handR: 'wingR', tail: 'body',
};

export type Pivots = Record<BoneName, Vec3>;

/** Where the primaries root on the folded wing (the hand bone's pivot). */
const handAt = (g: Geo, sd: number): Vec3 => {
  const y = g.bodyY + g.bodyH * 0.42;
  return [sd * (bodyHalfW(g, y) + 0.9), y, bodyDepth(g, y).back * 0.45];
};

export function pivotsOf(g: Geo): Pivots {
  const t = g.shape.tuft;
  const hw = bodyHalfW(g, g.shoulderY);
  return {
    body: [0, g.bodyY, 0],
    head: [0, g.neckY, g.headZ - 0.2],
    tuftL: [-(t?.x ?? 4.6), g.headTop - 0.8, g.headZ + 0.4],
    tuftR: [t?.x ?? 4.6, g.headTop - 0.8, g.headZ + 0.4],
    browL: [-g.eyeX, g.eyeY + g.eyeS * 0.5, g.discFront],
    browR: [g.eyeX, g.eyeY + g.eyeS * 0.5, g.discFront],
    jaw: [0, g.beakY - 1.7, g.discFront + 0.4],
    wingL: [-(hw + 0.4), g.shoulderY, 0.2],
    wingR: [hw + 0.4, g.shoulderY, 0.2],
    handL: handAt(g, -1),
    handR: handAt(g, 1),
    tail: [0, g.bodyY + 1.6, bodyDepth(g, g.bodyY + 1.6).back + 1.2],
    legL: [-g.legX, g.legTop, 0.6],
    legR: [g.legX, g.legTop, 0.6],
  };
}

/** Key measurements of the default (Tawny) owl. Per-model values live on `OwlModel.g`. */
export const G: Geo = geoOf(speciesOf('tawny').shape);
export const PIVOTS: Pivots = pivotsOf(G);

// ------------------------------------------------------------------ rounded volumes

/** A rounded-rectangle footprint as strips following a quarter circle of radius c. */
function rounded(x: number, y: number, z: number, w: number, h: number, d: number, c: number, m: Painter, o: Partial<BoxSpec> = {}): BoxSpec[] {
  c = Math.max(0, Math.min(c, d / 2 - 0.3, w / 2 - 0.3));
  const out: BoxSpec[] = [];
  const core = d - 2 * c;
  out.push(box(x, y, z, w, h, core, m, o));
  const n = c > 1.6 ? 3 : 2, step = c / n;
  for (let k = 0; k < n; k++) {
    const s = (k + 0.5) * step, inset = c - Math.sqrt(Math.max(0, c * c - s * s));
    const off = core / 2 + k * step + step / 2;
    for (const sd of [-1, 1]) out.push(box(x, y, z + sd * off, w - 2 * inset, h, step, m, { ...o, skip: (o.skip ?? '') + (sd > 0 ? 'n' : 's') }));
  }
  return out;
}

/** A box with stepped edges: reads as rounded at pixel scale. */
export function rbox(x: number, y: number, z: number, w: number, h: number, d: number, mat: Painter, o: Partial<BoxSpec> = {}, r = 1): BoxSpec[] {
  const rx = Math.min(r, w / 2 - 0.2), ry = Math.min(r, h / 2 - 0.2), rz = Math.min(r, d / 2 - 0.2);
  const out: BoxSpec[] = [];
  if (rz > 0.05 && ry > 0.05) out.push(box(x, y + ry, z, w, h - 2 * ry, d - 2 * rz, mat, o));
  if (rx > 0.05 && rz > 0.05) out.push(box(x, y, z, w - 2 * rx, h, d - 2 * rz, mat, o));
  if (rx > 0.05 && ry > 0.05) out.push(box(x, y + ry, z, w - 2 * rx, h - 2 * ry, d, mat, o));
  return out.length ? out : [box(x, y, z, w, h, d, mat, o)];
}

/** Rounded voxel volume from horizontal slices: [y0, y1, inset, corner] relative to the bottom. */
export function sculpt(x: number, y: number, z: number, w: number, d: number, prof: [number, number, number, number][], m: Painter, o: Partial<BoxSpec> = {}): BoxSpec[] {
  return prof.flatMap(([y0, y1, inset, c]) => rounded(x, y + y0, z, w - 2 * inset, y1 - y0, d - 2 * inset, c, m, o));
}

/** A flat rounded plate facing +z (rows of boxes). */
export function plate(x: number, y: number, z: number, w: number, h: number, d: number, c: number, m: Painter, o: Partial<BoxSpec> = {}): BoxSpec[] {
  c = Math.max(0, Math.min(c, h / 2 - 0.3, w / 2 - 0.3));
  const out: BoxSpec[] = [box(x, y + c, z, w, h - 2 * c, d, m, o)];
  const n = 2, step = c / n;
  for (let k = 0; k < n; k++) {
    const s = (k + 0.5) * step, inset = c - Math.sqrt(Math.max(0, c * c - s * s));
    out.push(box(x, y + c - (k + 1) * step, z, w - 2 * inset, step, d, m, o), box(x, y + h - c + k * step, z, w - 2 * inset, step, d, m, o));
  }
  return out;
}

/**
 * Slice a profiled volume into stepped layers. A new layer starts whenever the outline drifts by more
 * than `step` px, so domes get many thin steps and straight flanks a few tall ones. Faces fully
 * covered by the neighbouring layer are skipped.
 */
function volume(prof: Profile, m: Painter, o: { k0?: number; k1?: number; step?: number; grow?: number; round?: number; maxH?: number } = {}): BoxSpec[] {
  const k0 = o.k0 ?? 0, k1 = o.k1 ?? 1, step = o.step ?? 0.32, grow = o.grow ?? 0, maxH = o.maxH ?? 2.4;
  const cuts = [k0];
  let ref = k0;
  const N = 200;
  for (let i = 1; i <= N; i++) {
    const k = k0 + ((k1 - k0) * i) / N;
    const drift = Math.max(Math.abs(prof.hw(k) - prof.hw(ref)), Math.abs(prof.front(k) - prof.front(ref)), Math.abs(prof.back(k) - prof.back(ref)));
    if (drift > step || (k - ref) * prof.h > maxH || i === N) { cuts.push(k); ref = k; }
  }
  const layers: { y: number; h: number; hw: number; f: number; bk: number }[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2;
    const hw = prof.hw(mid) + grow, f = prof.front(mid) + grow, bk = prof.back(mid) - grow;
    layers.push({ y: prof.y0 + a * prof.h, h: (b - a) * prof.h, hw, f, bk });
  }
  const out: BoxSpec[] = [];
  layers.forEach((L, i) => {
    const below = layers[i - 1], above = layers[i + 1];
    const covers = (o2: typeof L | undefined) => !!o2 && o2.hw >= L.hw - 0.02 && o2.f >= L.f - 0.02 && o2.bk <= L.bk + 0.02;
    const skip = (covers(below) ? 'd' : '') + (covers(above) ? 'u' : '');
    const w = L.hw * 2, d = L.f - L.bk;
    out.push(...rounded(0, L.y, (L.f + L.bk) / 2, w, L.h, d, Math.min(w, d) * (o.round ?? 0.42), m, skip ? { skip } : {}));
  });
  return out;
}

// ------------------------------------------------------------------ the look

export type OutfitSlot = 'head' | 'face' | 'neck' | 'body' | 'back';

export interface OwlLook {
  /** 'owl' (plain species plumage), 'meowl' (kitten head), or a special skin id (gingerbread...) */
  skin?: string;
  /** real owl species the body is modelled on (see species registry). Source of truth. */
  species?: string;
  /** legacy coat id; still read for old saves and Meowl coats */
  palette: string;
  outfit: Partial<Record<OutfitSlot, string>>;
  /** feminine styling: long lashes, a soft blush, slimmer and more elegant (Queen Neve) */
  feminine?: boolean;
  /** something carried under the right wing ('scepter') */
  held?: string;
}

export interface OwlParts {
  bones: Record<BoneName, BoxSpec[]>;
  add(bone: BoneName, ...b: BoxSpec[]): void;
  /** legacy coat (Meowl coats); species plumage is in `species` */
  pal: OwlPalette;
  species: SpeciesDef;
  skin: string;
  /** anchor points for this owl's proportions */
  g: Geo;
  kit: Kit;
  /** show the ear tufts (big hats tuck them in) */
  tufts: boolean;
  look: OwlLook;
}

// ------------------------------------------------------------------ the facial disc

type DiscField = (x: number, y: number) => number;

function discField(g: Geo): { f: DiscField; y0: number; y1: number; x1: number; rim: number } {
  const s = g.shape, ex = g.eyeX, ey = g.eyeY, rim = 0.85;
  let rD = s.discR * s.headW;
  rD = Math.min(rD, g.headW / 2 + 0.35 - rim - ex);
  const cap = Math.min(ey + rD * 0.9, g.headTop - 1.4 - rim);
  const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
  let f: DiscField;
  if (s.disc === 'heart') {
    const tipY = ey - rD * 1.8, lx = ex * 0.8, ly = ey + rD * 0.1;
    f = (x, y) => {
      const ax = Math.abs(x);
      let d = ell(ax, y, lx, ly, rD * 1.04, rD * 0.95);
      if (y < ly && y > tipY) {
        const half = ((y - tipY) / (ly - tipY)) ** 0.8 * (lx + rD * 0.95);
        d = Math.min(d, (ax - half) * 0.9);
      }
      return Math.max(d, y - cap);
    };
  } else if (s.disc === 'round') {
    const r = Math.min(g.headW / 2 - rim + 0.3, rD * 1.45), cy = ey - 0.8;
    f = (x, y) => Math.max(ell(x, y, 0, cy, r, r * 0.98), y - cap - 0.8);
  } else {
    const cy = ey - rD * 0.6;
    f = (x, y) => {
      const ax = Math.abs(x);
      const d = Math.min(ell(ax, y, ex, ey, rD, rD * 0.95), ell(ax, y, 0, cy, rD * 0.8, rD));
      return Math.max(d, y - cap);
    };
  }
  return { f, y0: ey - rD * 2.3, y1: cap + rim + 0.5, x1: g.headW / 2 + 1.5, rim };
}

/** How deep the eyes sit in their sockets in the disc. */
const SOCKET = 0.32;

/** Scan the disc field row by row into boxes: the dished disc, the raised ruff and its softer outer edge. */
function buildDisc(P: OwlParts) {
  const g = P.g, k = P.kit;
  const { f, y0, y1, x1, rim } = discField(g);
  const dy = 0.5, dx = 0.25;
  type Run = [number, number, number];
  const rows: { y: number; runs: Run[] }[] = [];
  for (let y = Math.floor(y0 * 2) / 2; y < y1; y += dy) {
    const runs: Run[] = [];
    let cur = 0, start = 0;
    for (let x = 0; x <= x1; x += dx) {
      const px = x + dx / 2, py = y + dy / 2, d = f(px, py);
      const socket = Math.hypot(px - g.eyeX, py - g.eyeY) < g.eyeS / 2 + 0.9;
      const c = d < 0 ? (socket ? 4 : 1) : d < rim * 0.6 ? 2 : d < rim ? 3 : 0;
      if (c !== cur) { if (cur) runs.push([start, x, cur]); cur = c; start = x; }
    }
    if (cur) runs.push([start, x1, cur]);
    rows.push({ y, runs });
  }
  for (let i = 0; i < rows.length;) {
    let j = i + 1;
    const key = JSON.stringify(rows[i].runs);
    while (j < rows.length && JSON.stringify(rows[j].runs) === key) j++;
    const y = rows[i].y, h = (j - i) * dy;
    // the disc fills back to wherever the skull's front is at this height
    const kH = Math.max(0, Math.min(1, (y + h / 2 - g.headY) / g.headH));
    const back = Math.min(g.headFront - 0.8, g.head.front(kH) - 0.6);
    for (const [a, b, c] of rows[i].runs) {
      const front = c === 1 ? g.discFront : c === 4 ? g.discFront - SOCKET : c === 2 ? g.rimFront : g.rimFront - 0.45;
      const m = c === 1 || c === 4 ? k.disc : c === 2 ? k.ruff : k.ruffOut;
      const d = front - back, zc = back + d / 2;
      if (a === 0) P.add('head', box(0, y, zc, b * 2, h, d, m, { skip: 'n' }));
      else for (const sd of [-1, 1]) P.add('head', box((sd * (a + b)) / 2, y, zc, b - a, h, d, m, { skip: 'n' }));
    }
    i = j;
  }
}

// ------------------------------------------------------------------ species body

function buildSpecies(P: OwlParts) {
  const g = P.g, s = g.shape, k = P.kit, H = g.bodyH;
  const fem = P.look.feminine ? 0.4 : 0;

  // body: an egg of thin stepped layers, the breast bulging forward
  P.add('body', ...volume({ ...g.body, hw: (q) => g.body.hw(q) - fem }, k.body, { step: 0.55, maxH: 3 }));

  // head: a domed skull sliced the same way, plus a nape stepping down into the mantle
  P.add('head', ...volume(g.head, k.head, { step: 0.42, maxH: 2.4 }));
  const nk = 0.12, nb = g.head.back(nk);
  P.add('head', ...rounded(0, g.headY - 0.8, nb + 1.4, g.head.hw(nk) * 2 - 2, 2.4, 2.6, 0.9, k.head));
  // mantle: two overlapping rows of feather plates across the upper back
  for (const [q, inset] of [[0.8, 0.6], [0.68, 1.4]] as const) {
    const y = g.bodyY + q * H, hw = bodyHalfW(g, y + 1.2) - inset, bk = bodyDepth(g, y + 1.2).back;
    P.add('body', box(0, y, bk + 0.05, hw * 2, 2.6, 0.7, k.scap));
    for (let x = -hw + 1.0; x <= hw - 0.9; x += 1.8) P.add('body', box(x, y - 0.55, bk - 0.05, 1.5, 0.9, 0.55, k.scap));
  }

  buildDisc(P);
  const df = g.discFront, ex = g.eyeX, ey = g.eyeY, es = g.eyeS;
  // a raised ridge of feathers between the eyes down to the bill
  P.add('head', box(0, g.beakY + 0.3, df + 0.05, 0.85, ey + es * 0.3 - g.beakY - 0.3, 0.4, k.ridge));
  // the beak: a waxy cere, the upper mandible and its downward hook; bristles fan over its base
  const by = g.beakY;
  P.add('head', box(0, by - 0.5, df + 0.4, 1.25, 0.6, 0.6, k.cere));
  P.add('head', box(0, by - 1.55, df + 0.75, 1.05, 1.15, 0.9, k.beak), box(0, by - 2.15, df + 0.85, 0.75, 0.7, 0.62, k.beak), box(0, by - 2.5, df + 0.72, 0.45, 0.45, 0.42, k.beak));
  for (const sd of [-1, 1]) P.add('head', { ...box(sd * 0.85, by - 1.35, df + 0.3, 0.8, 1.5, 0.45, k.bristle), rot: [0, sd * 14, -sd * 8] });
  // chin under the bill (the great grey's bow tie sits here)
  if (s.disc === 'round') for (const sd of [-1, 1]) P.add('head', { ...box(sd * 1.3, by - 4.0, df - 0.05, 2.2, 1.2, 0.5, k.chin), rot: [0, 0, sd * 22] }, { ...box(sd * 0.45, by - 3.75, df + 0.05, 0.7, 0.7, 0.45, k.chin) });
  // the lower mandible and mouth (shown when Pip opens the beak)
  P.add('jaw', box(0, by - 2.7, df + 0.85, 1.1, 0.45, 0.95, k.beak), box(0, by - 2.3, df + 0.8, 0.85, 0.25, 0.7, k.tongue), box(0, by - 2.4, df + 0.45, 1.2, 0.9, 0.4, k.gape));

  // brows: soft feather arcs over each eye (white on many species), on their own bones
  const id = P.species.id;
  const frown = id === 'little' ? 16 : id === 'burrowing' ? 9 : id === 'horned' || id === 'eagle' ? 10 : id === 'sawwhet' ? 4 : 0;
  const big = id === 'little' || id === 'burrowing' ? 1.35 : 1;
  for (const [bone, sd] of [['browL', -1], ['browR', 1]] as const) {
    const yb = ey + es * 0.5;
    if (big > 1) P.add(bone, { ...box(sd * (ex - es * 0.05), yb - 0.05, df + 0.06, es * 1.05, 0.75, 0.32, k.brow), rot: [0, 0, sd * (4 - frown * 0.6)] });
    P.add(bone, { ...box(sd * (ex - es * 0.3), yb - 0.15, df + 0.05, es * 0.44, 0.5, 0.35, k.brow), rot: [0, 0, sd * (-6 - frown)] });
    P.add(bone, { ...box(sd * (ex + es * 0.12), yb + 0.08, df + 0.04, es * 0.46, 0.45, 0.3, k.brow), rot: [0, 0, sd * (6 - frown * 0.3)] });
  }

  // ear tufts: fans of stiff feathers
  const tf = s.tuft;
  if (tf) for (const [bone, sd] of [['tuftL', -1], ['tuftR', 1]] as const) {
    // a broad base, then overlapping feathers that narrow towards the tip
    P.add(bone, lean(box(sd * tf.x, g.headTop - 1.8, g.headZ + 0.3, tf.w * 1.05, Math.min(2.4, tf.len * 0.45), 1.5, k.tuft(0)), -6, 0, -sd * tf.lean * 0.8));
    for (let i = 0; i < 3; i++) {
      const c = i - 1, len = tf.len * (i === 1 ? 1 : 0.72);
      const x = sd * (tf.x + c * tf.w * 0.24);
      P.add(bone, lean(box(x, g.headTop - 1.5, g.headZ + 0.45 - Math.abs(c) * 0.3 - (tf.back ?? 0), tf.w * (i === 1 ? 0.55 : 0.45), len + 0.6, 0.75, k.tuft(i + 1)), -8 - Math.abs(c) * 3, 0, -sd * (tf.lean + c * sd * 6)));
    }
  }

  // wings: a folded slab hugging the flank in layers, coverts over the shoulder, primaries crossing the tail
  const top = g.shoulderY + 0.6, bottom = g.bodyY + 1.4;
  const nRows = 9, rowH = (top - bottom) / nRows;
  for (const [bone, sd] of [['wingL', -1], ['wingR', 1]] as const) {
    for (let r = 0; r < nRows; r++) {
      const y = bottom + r * rowH, f = (r + 0.5) / nRows; // 0 bottom .. 1 top
      const half = bodyHalfW(g, y + rowH / 2), dep = bodyDepth(g, y + rowH / 2);
      // a teardrop seen from the side: a rounded shoulder, the wrist bulging forward low on the
      // flank, the trailing edge sweeping back towards the tail
      const zF = dep.front * (f > 0.82 ? 0.62 - (f - 0.82) * 2.6 : -0.25 + 0.9 * Math.sin(f * 1.9)), zB = dep.back - 0.45 - (f < 0.3 ? (0.3 - f) * 1.8 : 0);
      const th = 1.0 + 0.7 * Math.sin(Math.min(1, f * 1.4) * Math.PI * 0.8) * (f > 0.9 ? 0.6 : 1);
      P.add(bone, box(sd * (half + th / 2 - 0.55), y, (zF + zB) / 2, th, rowH + 0.04, zF - zB, k.wing, { skip: sd > 0 ? 'w' : 'e' }));
      // the folded wing wraps round onto the back, leaving a strip of mantle down the spine
      const inner = 0.7 + f * 0.9, wBack = half + th - 0.55 - inner;
      P.add(bone, box(sd * (inner + wBack / 2), y, zB + 0.4, wBack, rowH + 0.04, 0.8, k.wing, { skip: 's' + (sd > 0 ? 'e' : 'w') }));
    }
    // secondaries' rounded tips hanging along the lower edge of the folded wing
    {
      const y = bottom - 0.55, half = bodyHalfW(g, bottom + 0.4) + 0.45, dep = bodyDepth(g, bottom + 0.4);
      for (let z = dep.back + 0.4; z < dep.front * -0.1; z += 1.5) P.add(bone, box(sd * half, y, z, 0.6, 0.9, 1.3, k.wing));
    }
    // coverts: two overlapping rows on the upper wing, each with hanging feather tips
    for (const [row, rh] of [[0, 2.8], [1, 2.4]] as const) {
      const yTop = top + 0.2 - row * 2.2, y = yTop - rh;
      const half = bodyHalfW(g, y + rh / 2) + 0.55 + 0.25 - row * 0.12, dep = bodyDepth(g, y + rh / 2);
      const zF = dep.front * (0.45 - row * 0.15), zB = dep.back * 0.88;
      P.add(bone, box(sd * half, y, (zF + zB) / 2, 0.45, rh, zF - zB, k.cov));
      for (let z = zB + 0.85 + row * 0.7; z < zF - 0.4; z += 1.55) P.add(bone, box(sd * (half + 0.02), y - 0.65, z, 0.42, 0.85, 1.35, k.cov));
    }
    // scapulars: a row of plates along the top back edge of the folded wing
    {
      const y = top - 1.8, half = bodyHalfW(g, y + 1) + 0.3, dep = bodyDepth(g, y + 1);
      P.add(bone, box(sd * (half - 0.6), y, dep.back * 0.55, 1.6, 2.4, dep.back * -0.7, k.scap));
    }
    // primaries: a stepped bunch of long feathers with separated tips, converging over the tail
    const hand = bone === 'wingL' ? 'handL' : 'handR';
    const pv = handAt(g, sd);
    // each runs back along the lower flank from the wrist, then bends over the back so the wing
    // tips cross above the tail
    const D2R = 180 / Math.PI;
    for (let i = 0; i < 5; i++) {
      const yA = pv[1] - i * 0.42, half = bodyHalfW(g, yA - 1) + 1.35 + i * 0.04;
      const zA = bodyDepth(g, yA).front * 0.12 - i * 0.55, zBk = bodyDepth(g, yA - 1.4).back - 0.7 - i * 0.1;
      const yB = yA - 1.2 - i * 0.12;
      // segment along the side (thin in x)
      const dy1 = yB - yA, dz1 = zBk - zA, len1 = Math.hypot(dy1, dz1);
      const a1 = Math.asin(dy1 / len1) * D2R;
      P.add(hand, { at: [sd * half - 0.18, yA - 0.5, zA - len1], size: [0.36, 1.0 - i * 0.05, len1 + 0.3], mat: k.prim(i), rot: [a1, 0, 0], pivot: [sd * half, yA, zA] });
      // segment over the back (thin in z), from the trailing corner to the crossing tip
      const tx = sd * (0.25 - i * 0.3), ty = g.bodyY + 0.4 - s.wingDrop * 0.5 + (4 - i) * 0.1, tz = zBk - 0.35 - s.wingBack * 0.3 - i * 0.08;
      const sx = sd * (half - 0.4), dx = tx - sx, dy = ty - yB, dz = tz - zBk, len2 = Math.hypot(dx, dy, dz);
      const al = Math.asin(-dz / len2) * D2R, ga = Math.atan2(dx, -dy) * D2R;
      P.add(hand, { at: [sx - 0.55, yB - len2, zBk - 0.18], size: [1.1 - i * 0.05, len2 + 0.2, 0.36], mat: k.primTip(i), rot: [al, 0, ga], pivot: [sx, yB, zBk] });
    }
  }
  // tail: a short barred fan under the wing tips
  const tl = s.tailLen + 2.6, tz = pivotsOf(g).tail[2] + 0.4;
  for (let i = -2; i <= 2; i++) {
    const x = i * 1.15, y = g.bodyY + 1.3 - Math.abs(i) * 0.12;
    P.add('tail', { ...box(x, y, tz - tl / 2, 1.45, 0.42, tl, k.tail(i + 2)), rot: [-26 + Math.abs(i) * 2, i * 6, 0], pivot: [x, y, tz] });
  }

  // legs: feathered (or bare) tarsi, toes and curved dark talons
  const bare = s.toes === 'bare', lw = s.legW;
  for (const [bone, sd] of [['legL', -1], ['legR', 1]] as const) {
    const x = sd * g.legX, z = 0.6;
    if (bare || s.legH > 2) {
      P.add(bone, ...rbox(x, g.toeH * 0.5, z, lw, g.legTop - g.toeH * 0.5 + 0.4, lw, k.leg, {}, 0.3));
      P.add(bone, ...rbox(x, g.legTop - 1.6, z - 0.1, lw * 1.6 + 0.6, 2.6, lw * 1.5 + 0.5, k.knicker, {}, 0.6));
    } else {
      P.add(bone, ...rbox(x, g.toeH * 0.4, z, lw, g.legTop - g.toeH * 0.4 + 0.9, lw * 0.95, k.leg, {}, 0.7));
    }
    const toeW = s.toes === 'feathered' ? 1.2 : 0.8, toeL = s.toes === 'feathered' ? 2.4 : 2.2;
    const rootZ = z + lw * 0.3;
    for (const [a, len] of [[-30, toeL * 0.88], [-4, toeL], [24, toeL * 0.92], [180, toeL * 0.55]] as const) {
      const ang = sd * a, rad = (ang * Math.PI) / 180, dx = Math.sin(rad), dz = Math.cos(rad);
      P.add(bone, { ...box(x + (dx * len) / 2, 0, rootZ + (dz * len) / 2, toeW, g.toeH * (s.toes === 'feathered' ? 1.0 : 0.75), len, k.toe), rot: [0, ang, 0] });
      P.add(bone, { ...box(x + dx * (len + 0.25), 0.32, rootZ + dz * (len + 0.25), 0.42, 0.4, 0.7, k.talon), rot: [0, ang, 0] }, { ...box(x + dx * (len + 0.6), 0, rootZ + dz * (len + 0.6), 0.36, 0.62, 0.36, k.talon), rot: [0, ang, 0] });
    }
  }
}

// ------------------------------------------------------------------ assembly

export interface OwlModel {
  rig: Rig;
  eyes: [Eye, Eye];
  eyeMeshes: THREE.Mesh[];
  look: OwlLook;
  height: number;
  /** this owl's anchor points and bone pivots (they vary with the species) */
  g: Geo;
  pivots: Pivots;
  species: SpeciesDef;
  dispose(): void;
}

function makeParts(look: OwlLook): OwlParts {
  const skin = look.skin && look.skin !== 'owl' ? look.skin : 'owl';
  const species = resolveSpecies(look);
  const g = geoOf(species.shape);
  const pal = palette(look.palette);
  let kit = paintKit(species, g, { fem: !!look.feminine });
  if (SPECIAL_SKIN[skin] && skin !== 'meowl') kit = skinKit(skin, g, kit);
  const bones = {} as Record<BoneName, BoxSpec[]>;
  for (const k of BONES) bones[k] = [];
  return { bones, add: (bone, ...b) => bones[bone].push(...b), pal, species, skin, g, kit, tufts: true, look };
}

/** Eye colours for an owl: iris, the feathered lid and its dark margin. */
function eyeColoursFor(P: OwlParts): EyeColours {
  const sp = P.species.plumage;
  if (P.skin === 'meowl') {
    const coat = P.pal.skin === 'meowl' ? P.pal : PALETTE.tabby;
    return { iris: MEOWL_IRIS[coat.id] ?? '#9cc43c', lid: coat.fur, rim: coat.liner, slit: true };
  }
  const base: EyeColours = { iris: sp.iris, lid: '#' + mix(sp.disc, sp.rim, 0.18).toString(16).padStart(6, '0'), rim: sp.lidRim, lashes: !!P.look.feminine };
  return skinEyes(P.skin, base);
}

/** The boxes of an owl's species body per bone, without building meshes (dev tools, stats). */
export function owlBoxes(look: OwlLook): Record<BoneName, BoxSpec[]> {
  const P = makeParts(look);
  buildSpecies(P);
  dressOwl(P, look.outfit);
  return P.bones;
}

export function buildOwl(look: OwlLook): OwlModel {
  const P = makeParts(look);
  const g = P.g;
  let eyeAt: { x: number; y: number; z: number; s: number } = { x: g.eyeX, y: g.eyeY, z: g.discFront - SOCKET + 0.06, s: g.eyeS };
  buildSpecies(P);
  if (P.skin === 'meowl') {
    // a kitten head on the owl's body: swap the head
    const coat = P.pal.skin === 'meowl' ? P.pal : PALETTE.tabby;
    const mh = meowlHead(coat);
    const dy = g.headY - M.headY, dz = g.headZ - M.headZ;
    P.bones.head = shiftBoxes(mh.boxes.head, dy, dz);
    P.bones.jaw = shiftBoxes(mh.boxes.jaw, dy, dz);
    P.bones.tuftL = shiftBoxes(mh.boxes.tuftL, dy, dz);
    P.bones.tuftR = shiftBoxes(mh.boxes.tuftR, dy, dz);
    P.bones.browL = []; P.bones.browR = [];
    // outfits read the kitten's face planes
    Object.assign(g, { headTop: M.headTop + dy, headFront: M.headFront + dz, discFront: M.headFront + 0.9 + dz, faceFront: M.headFront + 0.9 + dz, rimFront: M.faceFront + dz, eyeX: M.eyeX, eyeY: M.eyeY + dy, eyeS: M.eyeS, headW: M.headW, headD: M.headD, headH: M.headH, tuftTop: M.headTop + 4 + dy });
    eyeAt = { x: M.eyeX, y: M.eyeY + dy, z: M.headFront + 0.12 + dz, s: M.eyeS * 0.82 };
  } else if (SPECIAL_SKIN[P.skin]) skinExtras(P.skin, P);
  if (look.feminine) femininity(P);
  dressOwl(P, look.outfit);
  if (look.held) holdItem(P, look.held);
  if (!P.tufts) { P.bones.tuftL = []; P.bones.tuftR = []; }
  const piv = pivotsOf(g);
  if (P.skin === 'meowl') { const dy = g.headY - M.headY, dz = g.headZ - M.headZ; piv.jaw = [0, 16.3 + dy, M.faceFront + dz]; piv.tuftL = [-4.9, 24.4 + dy, 0.2 + dz]; piv.tuftR = [4.9, 24.4 + dy, 0.2 + dz]; }
  const bones: BoneSpec[] = BONES.map((name) => ({ name, parent: PARENT[name], pivot: piv[name], boxes: P.bones[name] }));
  const rig = buildRig(bones, { density: OWL_DENS });

  rig.bones.jaw.visible = false;
  const cols = eyeColoursFor(P);
  const eyes: [Eye, Eye] = [new Eye(-1, cols), new Eye(1, cols)];
  const head = rig.bones.head, hp = piv.head;
  const geo = new THREE.PlaneGeometry(eyeAt.s * EYE_PLANE * PX, eyeAt.s * EYE_PLANE * PX);
  const eyeMeshes = eyes.map((e, i) => {
    const mat = new THREE.MeshLambertMaterial({ map: e.tex, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: e.tex, emissiveIntensity: cols.glow ? 0.75 : 0.22, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(((i ? 1 : -1) * eyeAt.x - hp[0]) * PX, (eyeAt.y - hp[1]) * PX, (eyeAt.z - hp[2]) * PX);
    m.castShadow = false;
    head.add(m);
    return m;
  });
  rig.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !(eyeMeshes as THREE.Object3D[]).includes(o)) o.castShadow = true; });
  return {
    rig, eyes, eyeMeshes, look, height: rig.height, g, pivots: piv, species: P.species,
    dispose() {
      rig.dispose(); geo.dispose();
      eyeMeshes.forEach((m) => (m.material as THREE.Material).dispose());
      eyes.forEach((e) => e.tex.dispose());
    },
  };
}

/** Queen Neve's touches: a soft blush under each eye (her lashes are drawn by the eye itself). */
function femininity(P: OwlParts) {
  const g = P.g;
  const blush: Painter = (t) => {
    const d = Math.hypot((t.bx - t.sx / 2) / (t.sx / 2), (t.by - t.sy / 2) / (t.sy / 2));
    return d < 0.55 ? 0xffb8cc : d < 0.85 ? 0xffcddb : 0xffe0e8;
  };
  for (const sd of [-1, 1]) P.add('head', box(sd * (g.eyeX + 0.5), g.eyeY - g.eyeS * 0.78, g.discFront + 0.03, 2.4, 1.1, 0.1, blush));
}

/** Feather colour for particle puffs: accepts a look or a species / legacy palette id. */
export function featherColour(look: OwlLook | string): number {
  if (typeof look === 'string') {
    const sp = resolveSpecies({ palette: look, species: undefined });
    return col(sp.plumage.wing);
  }
  if (look.skin && SPECIAL_SKIN[look.skin] && look.skin !== 'meowl') return col(SPECIAL_SKIN[look.skin].feather);
  return col(resolveSpecies(look).plumage.wing);
}
export { mix };
