// Pip's hollow oak, built in code: a huge, gnarled old oak whose trunk is the house. The bark surface is an
// organic shell (slow lobes, fluted ridges, buttress roots swelling out of the foot, burls), lit with the bark scan,
// its normal map and moss/lichen masks; roots snake out over the ground; great limbs fork out of the top into the
// leaf-card crown (crown.ts). Into it are set arched and round windows with carved frames, a front door with a
// hood, the porch and balcony with railings and lanterns, a rope ladder up to the platform on the great limb, a
// stove pipe with a smoking cap, a mailbox, a signpost, fairy lights, ivy, ferns and shelf fungus.
//
// The front of each floor is a dollhouse cut (its walls show the heartwood rings). A locked floor's front is still
// whole bark, with shuttered windows (a sliver of warm light between the shutters), a dusty dark round window and
// a brass plaque and padlock with the level it opens at; its two halves swing open like a dollhouse when it unlocks
// (locks.ts). Everything is in house px (16 px = 1 world unit), grouped per floor band so build mode can hide what
// is above the floor it edits.
import * as THREE from 'three';
import { PX } from '../../gfx/box.ts';
import { fbm, rng } from '../../gfx/noise.ts';
import { Cards, CELL, fillCrown, type Mass } from './crown.ts';
import { Geo, mat, spline, type V3 } from './geo.ts';
import { canvasTex, houseMat, pixelText, textWidth, woodFill, type HouseMat } from './kit.ts';
import {
  CHIMNEY_A, CHIMNEY_TOP, DOOR_A, FLOOR_IDS, FLOOR_Y, HOLES, inOpening, LADDER_A, LAMP_AT, LAUNCH, LIMB_A, OPEN_A, openingOutline, openings, PLATFORM,
  R_IN, ROOF_Y, RO, SLAB, trunkR, UNLOCK, wrapA, type FloorId, type Opening,
} from './plan.ts';

export type Band = FloorId | 'roof';
export const BANDS: Band[] = ['f1', 'f2', 'f3', 'roof'];
const TAU = Math.PI * 2;
/** where each band of the trunk starts and ends (px) */
export const BAND_Y: Record<Band, [number, number]> = { f1: [-10, FLOOR_Y.f2 - SLAB], f2: [FLOOR_Y.f2 - SLAB, FLOOR_Y.f3 - SLAB], f3: [FLOOR_Y.f3 - SLAB, ROOF_Y], roof: [ROOF_Y, 266] };
export const TOP = 266;

const P = (a: number, y: number, r: number): V3 => [Math.sin(a) * r, y, Math.cos(a) * r];
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ the bark surface

/** buttress roots: angle, how far they swell out (px), width (rad), height they climb (px) */
export const ROOTS: { a: number; amp: number; w: number; h: number; len: number }[] = [
  { a: -1.0, amp: 18, w: 0.11, h: 30, len: 70 }, { a: -1.5, amp: 30, w: 0.14, h: 46, len: 110 }, { a: -2.02, amp: 26, w: 0.13, h: 40, len: 92 },
  { a: -2.55, amp: 30, w: 0.14, h: 44, len: 104 }, { a: 3.0, amp: 24, w: 0.12, h: 38, len: 86 }, { a: 2.5, amp: 30, w: 0.14, h: 46, len: 112 },
  { a: 1.96, amp: 26, w: 0.13, h: 40, len: 96 }, { a: 1.68, amp: 16, w: 0.1, h: 26, len: 60 }, { a: 0.99, amp: 10, w: 0.09, h: 20, len: 40 },
];
/** fluted ridges running up the trunk, clear of the windows and the door */
const RIDGES: { a: number; amp: number; w: number; top: number }[] = [
  { a: -2.72, amp: 6, w: 0.1, top: 250 }, { a: -2.02, amp: 7, w: 0.12, top: 240 }, { a: -1.25, amp: 5, w: 0.09, top: 200 },
  { a: -0.62, amp: 4, w: 0.08, top: 260 }, { a: 0.64, amp: 4, w: 0.08, top: 260 }, { a: 1.48, amp: 5, w: 0.1, top: 230 },
  { a: 1.95, amp: 7, w: 0.12, top: 250 }, { a: 2.72, amp: 6, w: 0.11, top: 245 }, { a: 3.1, amp: 4, w: 0.07, top: 200 },
  { a: -0.3, amp: 2.5, w: 0.06, top: 266 }, { a: 0.18, amp: 2.5, w: 0.06, top: 266 },
];
/** burls and swellings (angle, height, px out, radius px) */
const BURLS: { a: number; y: number; amp: number; rad: number }[] = [
  { a: -1.62, y: 120, amp: 6, rad: 12 }, { a: 1.52, y: 168, amp: 5, rad: 10 }, { a: -0.42, y: 232, amp: 5, rad: 14 }, { a: 2.3, y: 30, amp: 6, rad: 14 },
  { a: 0.5, y: 236, amp: 4, rad: 12 },
];

const smoothR = (a: number, y: number) => {
  let r = trunkR(Math.min(y, 210)) + 2.5;
  if (y > 200) r += smooth(200, 262, y) * 9;
  return r + 3 * Math.cos(2 * a - 1.1 + y * 0.006) + 1.8 * Math.cos(3 * a + 0.4 - y * 0.009);
};

/** Outer radius of the bark at angle a, height y (px). */
export function barkR(a: number, y: number): number {
  let r = smoothR(a, y);
  for (const g of RIDGES) {
    const d = wrapA(a - g.a - y * 0.0004);
    r += g.amp * clamp((g.top - y) / 40) * Math.exp(-((d / g.w) ** 2)) * (1 + 0.3 * Math.sin(y * 0.05 + g.a * 3));
  }
  for (const b of ROOTS) {
    if (y >= b.h) continue;
    const k = 1 - Math.max(0, y) / b.h, d = wrapA(a - b.a);
    r += b.amp * k ** 2.2 * Math.exp(-((d / (b.w * (1 + 0.9 * k))) ** 2));
  }
  for (const u of BURLS) { const d = wrapA(a - u.a) * 88, dy = y - u.y; r += u.amp * Math.exp(-(d * d + dy * dy) / (u.rad * u.rad)); }
  r += (fbm(Math.cos(a) * 2.4 + 5, y / 24, Math.sin(a) * 2.4, 11) - 0.5) * 4.5;
  return Math.max(r, R_IN + 7);
}

function barkNormal(a: number, y: number): V3 {
  const R = barkR(a, y), h = 0.004;
  const Ra = (barkR(a + h, y) - barkR(a - h, y)) / (2 * h), Ry = (barkR(a, y + 0.7) - barkR(a, y - 0.7)) / 1.4;
  const s = Math.sin(a), c = Math.cos(a);
  const A = [c * R + s * Ra, 0, -s * R + c * Ra], B = [s * Ry, 1, c * Ry];
  const n = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  return [n[0] / l, n[1] / l, n[2] / l];
}

/** bark vertex colour: r = ambient occlusion, g = where moss may grow, b = lichen */
function barkCol(a: number, y: number, r: number): V3 {
  const ridge = clamp(0.9 + (r - smoothR(a, y)) * 0.025, 0.72, 1.06);
  const ao = (0.55 + 0.45 * smooth(-8, 26, y)) * ridge * (y > 236 ? 0.85 : 1);
  const n = fbm(Math.cos(a) * 3 + 1, y / 30, Math.sin(a) * 3, 23);
  const moss = clamp(0.95 - y / 70) * 0.9 + clamp(-Math.sin(a + 0.5)) * 0.32 + (n - 0.5) * 0.7 + (y > 226 ? 0.45 : 0) + clamp(1 - Math.abs(y - 140) / 30) * clamp(-Math.cos(a)) * 0.3;
  const lichen = 0.35 + (fbm(a * 3 + 9, y / 18, 2, 31) - 0.5) * 1.1 + y / 600;
  return [ao, clamp(moss), clamp(lichen)];
}

// ------------------------------------------------------------------ sets of meshes by material

class Sets {
  private g = new Map<string, Geo>();
  get(band: Band, m: HouseMat, key = ''): Geo {
    const k = band + '|' + m + '|' + key;
    let g = this.g.get(k);
    if (!g) { g = new Geo(); this.g.set(k, g); }
    return g;
  }
  /** turn every collected geometry into meshes under the band groups (scaled px -> world) */
  flush(groups: Record<Band, THREE.Group>, extra: Map<string, THREE.Material> = new Map()) {
    for (const [k, g] of this.g) {
      if (!g.idx.length) continue;
      const [band, m, key] = k.split('|') as [Band, HouseMat, string];
      const mesh = new THREE.Mesh(g.build(), extra.get(key) ?? houseMat(m));
      mesh.name = `oak:${band}:${m}${key ? ':' + key : ''}`;
      mesh.scale.setScalar(PX);
      const glassy = m === 'glow' || m === 'pane' || m === 'sliver';
      mesh.castShadow = !glassy;
      mesh.receiveShadow = !glassy;
      groups[band].add(mesh);
    }
    this.g.clear();
  }
}

// ------------------------------------------------------------------ helpers for boxes, posts, etc.

const BOX = new THREE.BoxGeometry(1, 1, 1);
/** A box (px) centred at c, size s, rotated r; uv scaled to texel size `tu` px per texture repeat. */
function box(g: Geo, c: V3, s: V3, r: V3 = [0, 0, 0], col: V3 = [1, 1, 1], tu = 40) {
  const b = BOX.clone();
  // uv in px so textures keep their density whatever the box size
  const uv = b.getAttribute('uv') as THREE.BufferAttribute, nrm = b.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    const [w, h] = nx > 0.5 ? [s[2], s[1]] : ny > 0.5 ? [s[0], s[2]] : [s[0], s[1]];
    uv.setXY(i, (uv.getX(i) * Math.max(w, h)) / tu, (uv.getY(i) * Math.min(w, h)) / tu);
  }
  g.add(b, mat(c, r, s), col);
}
function cyl(g: Geo, c: V3, rad: number, h: number, r: V3 = [0, 0, 0], col: V3 = [1, 1, 1], seg = 8, rTop = rad) {
  const b = new THREE.CylinderGeometry(rTop, rad, h, seg, 1);
  const uv = b.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (rad * 6.28) / 40, (uv.getY(i) * h) / 40);
  g.add(b, mat(c, r), col);
}
function ball(g: Geo, c: V3, rad: number, col: V3 = [1, 1, 1], s: V3 = [1, 1, 1], seg = 8) {
  g.add(new THREE.SphereGeometry(rad, seg, Math.max(4, seg - 2)), mat(c, [0, 0, 0], s), col);
}
/** A segment between two points as a square beam of thickness t (px). */
function beam(g: Geo, a: V3, b: V3, t: number, col: V3 = [1, 1, 1], t2 = t) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, new THREE.Vector3(t, len, t2));
  const bx = BOX.clone();
  const uv = bx.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * t / 40, uv.getY(i) * len / 40);
  g.add(bx, m, col);
}
function rope(g: Geo, a: V3, b: V3, sag: number, rad: number, col: V3) {
  const pts: V3[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t]); }
  g.tube(pts, pts.map(() => rad), 4, { col: () => col });
}

// ------------------------------------------------------------------ painted signs

function plaqueTex(level: number): THREE.CanvasTexture {
  return canvasTex(48, 32, (g) => {
    // brass plate with a bevelled rim, rivets and the level engraved
    g.fillStyle = '#5a3c16'; g.fillRect(0, 0, 48, 32);
    g.fillStyle = '#b98a3c'; g.fillRect(1, 1, 46, 30);
    g.fillStyle = '#e8c477'; g.fillRect(1, 1, 46, 2); g.fillRect(1, 1, 2, 30);
    g.fillStyle = '#7c5520'; g.fillRect(1, 29, 46, 2); g.fillRect(45, 1, 2, 30);
    g.fillStyle = '#d7a957'; g.fillRect(4, 4, 40, 24);
    for (let i = 0; i < 40; i += 3) { g.fillStyle = i % 2 ? '#ddb262' : '#cfa04e'; g.fillRect(4 + i, 4, 1, 24); }
    g.fillStyle = '#8a5f22'; for (const [x, y] of [[3, 3], [43, 3], [3, 27], [43, 27]]) g.fillRect(x, y, 2, 2);
    const t = 'LV ' + level, w = textWidth(t, 1) * 2;
    pixelText(g, t, Math.round(24 - w / 2), 9, 2, '#4a2e0e', '#f6dc98');
  });
}

function signTex(): THREE.CanvasTexture {
  return canvasTex(96, 28, (g) => {
    g.fillStyle = '#3c2614'; g.fillRect(0, 0, 96, 28);
    woodFill(g, 1, 1, 94, 26, [176, 122, 70], 3);
    g.fillStyle = '#5c3a1c'; g.fillRect(1, 13, 94, 1);
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(1, 24, 94, 3);
    const t = 'HOOT HOLLOW';
    pixelText(g, t, Math.round(48 - textWidth(t, 1) / 2), 4, 1, '#f3e6c4', '#3a2410');
    const t2 = 'PIP';
    pixelText(g, t2, Math.round(48 - textWidth(t2, 1) / 2), 15, 1, '#f3e6c4', '#3a2410');
  });
}

function mailTex(): THREE.CanvasTexture {
  return canvasTex(32, 16, (g) => {
    g.fillStyle = '#9c3a2a'; g.fillRect(0, 0, 32, 16);
    for (let i = 0; i < 32; i++) { g.fillStyle = i % 5 === 0 ? '#8c3224' : '#a6402e'; g.fillRect(i, 0, 1, 16); }
    pixelText(g, 'PIP', 8, 5, 1, '#f4e8cc', '#5a1e14');
  });
}

function matTex(): THREE.CanvasTexture {
  return canvasTex(32, 16, (g) => {
    for (let j = 0; j < 16; j++) for (let i = 0; i < 32; i++) {
      const weave = ((i >> 1) + (j >> 1)) % 2;
      g.fillStyle = weave ? '#b48a52' : '#9c7442';
      if (i < 2 || j < 2 || i > 29 || j > 13) g.fillStyle = weave ? '#6e4a2a' : '#5e3e22';
      g.fillRect(i, j, 1, 1);
    }
    pixelText(g, 'HOOT', 5, 5, 1, '#5a3a1a');
  });
}

/** dusty dark glass: a dim room behind, a cobweb in the corner, a warm glow low down */
function dustyTex(): THREE.CanvasTexture {
  return canvasTex(64, 64, (g) => {
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
      const d = Math.hypot(i - 32, j - 44) / 40;
      const k = Math.max(0, 1 - d);
      const r = 26 + k * 70, gg = 22 + k * 40, b = 26 + k * 14;
      const dust = ((i * 7 + j * 13) % 17 === 0) ? 18 : 0;
      g.fillStyle = `rgb(${Math.round(r + dust)},${Math.round(gg + dust)},${Math.round(b + dust)})`;
      g.fillRect(i, j, 1, 1);
    }
    // a cobweb in the top left corner
    g.fillStyle = 'rgba(220,220,210,0.75)';
    for (let k = 0; k < 6; k++) { const a = (k / 5) * (Math.PI / 2); for (let t = 0; t < 26; t++) g.fillRect(Math.round(4 + Math.cos(a) * t), Math.round(4 + Math.sin(a) * t), 1, 1); }
    for (let ring = 6; ring < 26; ring += 5) for (let t = 0; t <= 20; t++) { const a = (t / 20) * (Math.PI / 2); g.fillRect(Math.round(4 + Math.cos(a) * ring), Math.round(4 + Math.sin(a) * ring), 1, 1); }
    // shelf silhouette with jars
    g.fillStyle = '#140f0c'; g.fillRect(8, 40, 48, 2);
    for (const [x, h] of [[12, 7], [20, 9], [30, 6], [44, 8]]) g.fillRect(x, 40 - h, 5, h);
  });
}

/** A strand of ivy climbing the bark from y0 to y1 near angle a0 (flat leaf cards hugging the surface; off = origin). */
function ivyStrand(cards: Cards, a0: number, y0: number, y1: number, drift: number, w = 13, off: V3 = [0, 0, 0], proud = 1.2) {
  const h = 20;
  const o = (p: V3): V3 => [p[0] - off[0], p[1] - off[1], p[2] - off[2]];
  for (let y = y0; y < y1; y += h) {
    const k = (y - y0) / Math.max(1, y1 - y0);
    const a = a0 + Math.sin(k * 5 + a0) * drift;
    const a2 = a0 + Math.sin(((y + h - y0) / Math.max(1, y1 - y0)) * 5 + a0) * drift;
    const r = barkR(a, y) + proud, r2 = barkR(a2, y + h) + proud;
    const T: V3 = [Math.cos(a), 0, -Math.sin(a)];
    const bl = P(a, y, r), tl = P(a2, y + h, r2);
    const n = barkNormal(a, y + h / 2);
    cards.flat([o([bl[0] - T[0] * w / 2, bl[1], bl[2] - T[2] * w / 2]), o([bl[0] + T[0] * w / 2, bl[1], bl[2] + T[2] * w / 2]), o([tl[0] + T[0] * w / 2, tl[1], tl[2] + T[2] * w / 2]), o([tl[0] - T[0] * w / 2, tl[1], tl[2] - T[2] * w / 2])],
      CELL.ivy[Math.floor(y / h) % 2], n, [0.9, 0.95, 0.9], 0.15, 0.25);
  }
}

// ------------------------------------------------------------------ the oak

let dusty: THREE.MeshStandardMaterial | null = null;
/** the dusty dark glass of a locked floor's windows (it glows a little warmer at night: see house.ts) */
export function DUSTY(): THREE.MeshStandardMaterial {
  if (!dusty) { const t = dustyTex(); dusty = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, roughness: 0.5, metalness: 0, emissive: 0xffb060, emissiveIntensity: 0.1 }); dusty.name = 'house:dusty'; }
  return dusty;
}

export interface FrontHalf { group: THREE.Group; hinge: number; side: -1 | 1 }
export interface LockFront {
  fid: FloorId;
  group: THREE.Group;
  halves: FrontHalf[];
  shutters: { obj: THREE.Object3D; side: -1 | 1 }[];
  padlock: THREE.Group;
  plaque: THREE.Object3D;
  sliver: THREE.Object3D[];
}

export interface Oak {
  bands: Record<Band, THREE.Group>;
  fronts: Partial<Record<FloorId, LockFront>>;
  /** lantern glow points (world, house-local px) for lights */
  porchLamp: V3;
  /** the rope ladder (sways) */
  ladder: THREE.Group;
  dispose(): void;
}

interface OpenStyle { inner: boolean; glass: 'clear' | 'dusty' | 'none'; shutters?: boolean; sill?: boolean; box?: boolean; trim?: V3 }

export function buildOak(): Oak {
  const bands = { f1: new THREE.Group(), f2: new THREE.Group(), f3: new THREE.Group(), roof: new THREE.Group() } as Record<Band, THREE.Group>;
  for (const b of BANDS) bands[b].name = 'oakband:' + b;
  const S = new Sets();
  const extra = new Map<string, THREE.Material>();
  const R = rng(1234);
  const ivy = new Cards('flat');
  const ivyBand: Record<Band, Cards> = { f1: ivy, f2: new Cards('flat'), f3: new Cards('flat'), roof: new Cards('flat') };

  // ---------------------------------------------------------------- bark shells
  const NA = 144, DA = TAU / NA;
  const angleCols = (a0: number, a1: number) => { const n = Math.max(1, Math.round((a1 - a0) / DA)); return Array.from({ length: n + 1 }, (_, i) => a0 + ((a1 - a0) * i) / n); };
  const rows = (y0: number, y1: number, step = 4) => { const n = Math.max(1, Math.round((y1 - y0) / step)); return Array.from({ length: n + 1 }, (_, i) => y0 + ((y1 - y0) * i) / n); };
  const holesOf = (band: Band, front: Opening[] = []): Opening[] => (band === 'roof' ? [] : openings(band as FloorId)).concat(front);
  const inHole = (hs: Opening[], a: number, y: number, r: number, m: number) => hs.some((o) => {
    const d = wrapA(a - o.a);
    if (Math.cos(d) < 0.6) return false;
    return inOpening(o, r * Math.sin(d), y, m);
  });
  const shell = (g: Geo, as: number[], ys: number[], hs: Opening[], off: V3 = [0, 0, 0], proud = 0) => {
    g.grid(0, 0, (a, y) => {
      const r = barkR(a, y) + proud;
      const p = P(a, y, r);
      return { p: [p[0] - off[0], p[1] - off[1], p[2] - off[2]], uv: [(a / TAU) * 4, y / 128], c: barkCol(a, y, r), n: barkNormal(a, y) };
    }, { us: as, vs: ys, skip: (a0, a1, y0, y1) => { const am = (a0 + a1) / 2, ym = (y0 + y1) / 2; return inHole(hs, am, ym, barkR(am, ym), 1.5); } });
  };

  // the front windows of locked floors (they go with the front halves)
  const frontWins: Record<'f2' | 'f3', Opening[]> = {
    f2: [{ a: -0.4, hw: 9, y0: FLOOR_Y.f2 + 18, y1: FLOOR_Y.f2 + 46, kind: 'arch' }, { a: 0.4, hw: 9, y0: FLOOR_Y.f2 + 18, y1: FLOOR_Y.f2 + 46, kind: 'arch' }],
    f3: [{ a: 0, hw: 12, y0: FLOOR_Y.f3 + 16, y1: FLOOR_Y.f3 + 40, kind: 'round' }],
  };

  for (const band of BANDS) {
    const [y0, y1] = BAND_Y[band];
    const g = S.get(band, 'bark');
    const ys = rows(y0, y1);
    if (band === 'roof') {
      shell(g, angleCols(-Math.PI, Math.PI), ys, []);
    } else {
      shell(g, angleCols(OPEN_A, TAU - OPEN_A), ys, holesOf(band));
    }
  }
  // the top of the trunk: a cap among the limbs
  {
    const g = S.get('roof', 'bark');
    const c = g.vert([0, TOP + 10, 0], [0, 0], [0.5, 0.8, 0.2], [0, 1, 0]);
    const ring: number[] = [];
    for (let i = 0; i <= NA; i++) { const a = -Math.PI + (i / NA) * TAU; const r = barkR(a, TOP); ring.push(g.vert(P(a, TOP, r), [(a / TAU) * 4, r / 128], [0.6, 0.8, 0.2], [Math.sin(a) * 0.5, 0.85, Math.cos(a) * 0.5])); }
    for (let i = 0; i < ring.length - 1; i++) g.tri(c, ring[i], ring[i + 1]);
  }

  // ---------------------------------------------------------------- the cut: heartwood lips, slab fronts, ceilings
  for (const fid of FLOOR_IDS) {
    const [y0, y1] = BAND_Y[fid];
    const lip = S.get(fid, 'lip');
    for (const side of [-1, 1] as const) {
      const a = side * OPEN_A;
      const nr = 6, ys = rows(Math.max(0, y0), y1);
      lip.grid(nr, 0, (u, y) => {
        const ro = barkR(a, y), r = R_IN - 0.6 + (ro - R_IN + 0.6) * u;
        return { p: P(a, y, r), uv: [u, y], c: [0.95, 1, 1] };
      }, { vs: ys, flip: side < 0 });
    }
    // the slab's front edge: a carved honey beam across the opening
    const fy0 = FLOOR_Y[fid] - (fid === 'f1' ? 8 : SLAB), fy1 = FLOOR_Y[fid];
    const fas = S.get(fid, 'planks');
    fas.grid(24, 2, (u, v) => {
      const a = -OPEN_A + u * 2 * OPEN_A, y = fy0 + (fy1 - fy0) * v;
      const r = barkR(a, y) - 0.9;
      return { p: P(a, y, r), uv: [v * 0.25, (a * r) / 40], c: [0.82 + v * 0.18, 0.78 + v * 0.16, 0.72 + v * 0.12] };
    });
    // a moulded lip on top of the beam
    fas.grid(24, 1, (u, v) => {
      const a = -OPEN_A + u * 2 * OPEN_A, y = fy1 - 0.2 + v * 0.01;
      const r = barkR(a, fy1) - 0.9 - 1.4 * v;
      return { p: P(a, fy1 + 0.4 * (1 - v), r), uv: [0.02, (a * r) / 40], c: [1.05, 1, 0.92] };
    });
  }
  // ceilings (the underside of the floor above): planks, radial beams, a hub where the lantern hangs, the hatch
  const ceilings: [Band, number, FloorId | null][] = [['f2', FLOOR_Y.f2 - SLAB, 'f2'], ['f3', FLOOR_Y.f3 - SLAB, 'f3'], ['roof', ROOF_Y, null]];
  for (const [band, cy, above] of ceilings) {
    const g = S.get(band, 'planks', 'ceil');
    const segs = 96, ring: number[] = [];
    const c = g.vert([0, cy, 0], [0, 0], [1, 1, 1]);
    for (let s = 0; s <= segs; s++) {
      const a = -Math.PI + (s / segs) * TAU;
      const r = Math.abs(wrapA(a)) < OPEN_A ? barkR(a, cy) - 0.4 : R_IN + 1;
      const k = Math.abs(wrapA(a)) < OPEN_A ? 0.9 : 0.62;
      ring.push(g.vert(P(a, cy, r), [(Math.sin(a) * r) / 48, (Math.cos(a) * r) / 48], [k, k * 0.96, k * 0.9]));
    }
    for (let s = 0; s < segs; s++) g.tri(c, ring[s + 1], ring[s]);
    const bm = S.get(band, 'planks');
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + 0.26;
      const inCut = Math.abs(wrapA(a)) < OPEN_A;
      const r1 = inCut ? barkR(a, cy - 3) - 1 : R_IN + 1;
      beam(bm, P(a, cy - 2.6, 7), P(a, cy - 2.6, r1), 5, [0.78, 0.7, 0.62], 5);
    }
    cyl(bm, [0, cy - 3.5, 0], 8, 7, [0, 0, 0], [0.75, 0.68, 0.6], 10);
    // crown moulding round the top of the wall
    {
      const trim = S.get(band, 'planks');
      trim.grid(64, 1, (u, v) => {
        const a = OPEN_A + u * (TAU - 2 * OPEN_A);
        return { p: P(a, cy - 3 * v, R_IN - 0.5 - 1.4 * (1 - v)), uv: [v * 0.1, (a * R_IN) / 40], c: [0.72, 0.62, 0.52] };
      });
    }
    // the hatch to the floor above
    if (above) for (const [hx, hz, hh] of HOLES[above]) {
      const d = S.get(band, 'dark');
      box(d, [hx, cy - 0.3, hz], [hh * 2 - 2, 0.6, hh * 2 - 2]);
      const fr = S.get(band, 'planks');
      for (const [ox, oz, w, dd] of [[0, -hh, hh * 2 + 2, 2], [0, hh, hh * 2 + 2, 2], [-hh, 0, 2, hh * 2], [hh, 0, 2, hh * 2]] as const) box(fr, [hx + ox, cy - 1.2, hz + oz], [w, 2.4, dd], [0, 0, 0], [0.7, 0.6, 0.5]);
    }
  }
  // baseboards round each room
  for (const fid of FLOOR_IDS) {
    const g = S.get(fid, 'planks');
    const y = FLOOR_Y[fid];
    const hs = openings(fid).filter((o) => o.kind === 'door');
    g.grid(96, 1, (u, v) => {
      const a = OPEN_A + u * (TAU - 2 * OPEN_A);
      return { p: P(a, y + 3.2 * v, R_IN - 0.8), uv: [v * 0.08, (a * R_IN) / 40], c: [0.62, 0.52, 0.44] };
    }, { flip: true, skip: (a0, a1) => hs.some((o) => Math.abs(wrapA((a0 + a1) / 2 - o.a)) < (o.hw + 3) / R_IN) });
    // the chair rail above the wainscot
    g.grid(96, 1, (u, v) => {
      const a = OPEN_A + u * (TAU - 2 * OPEN_A);
      return { p: P(a, y + 18 + 1.6 * v, R_IN - 0.9), uv: [v * 0.05, (a * R_IN) / 40], c: [0.7, 0.58, 0.48] };
    }, { flip: true, skip: (a0, a1) => openings(fid).some((o) => Math.abs(wrapA((a0 + a1) / 2 - o.a)) < (o.hw + 4) / R_IN && o.y0 < y + 21) });
  }

  // ---------------------------------------------------------------- ladders and lanterns inside
  const ladder = (band: Band, a: number, r: number, y0: number, y1: number) => {
    const g = S.get(band, 'planks');
    const lean = 6;
    const base = P(a, y0, r), top = P(a, y1, r + lean);
    const t: V3 = [Math.cos(a), 0, -Math.sin(a)];
    for (const s of [-1, 1]) beam(g, [base[0] + t[0] * 6 * s, base[1], base[2] + t[2] * 6 * s], [top[0] + t[0] * 6 * s, top[1], top[2] + t[2] * 6 * s], 2.2, [0.85, 0.74, 0.6]);
    for (let y = y0 + 7; y < y1 - 2; y += 8) {
      const k = (y - y0) / (y1 - y0), c = P(a, y, r + lean * k);
      beam(g, [c[0] - t[0] * 6, y, c[2] - t[2] * 6], [c[0] + t[0] * 6, y, c[2] + t[2] * 6], 1.6, [0.9, 0.8, 0.66]);
    }
  };
  ladder('f1', LADDER_A.f1, 58, FLOOR_Y.f1, FLOOR_Y.f2);
  ladder('f2', LADDER_A.f2, 58, FLOOR_Y.f2, FLOOR_Y.f3);
  ladder('f3', Math.atan2(30, -38), 50, FLOOR_Y.f3, ROOF_Y);

  const lantern = (band: Band, c: V3, s = 1, hang = 0) => {
    const ir = S.get(band, 'iron'), gl = S.get(band, 'glow');
    const [x, y, z] = c;
    box(ir, [x, y + 6 * s, z], [7 * s, 1.2 * s, 7 * s]);
    cyl(ir, [x, y + 8 * s, z], 0.4 * s, 3.4 * s, [0, 0, 0], [1, 1, 1], 4, 4.6 * s);
    box(ir, [x, y - 6 * s, z], [6.4 * s, 1.4 * s, 6.4 * s]);
    for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(ir, [x + ox * 3 * s, y, z + oz * 3 * s], [0.9 * s, 11 * s, 0.9 * s]);
    box(gl, [x, y, z], [5 * s, 10 * s, 5 * s]);
    if (hang) {
      for (let k = 0; k < hang; k += 2.4) box(ir, [x, y + 10 * s + k, z], [0.7, 1.6, k % 4.8 < 2.4 ? 0.7 : 1.4]);
    }
  };
  lantern('f2', LAMP_AT.f1, 0.9, FLOOR_Y.f2 - SLAB - LAMP_AT.f1[1] - 9);
  lantern('f3', LAMP_AT.f2, 0.9, FLOOR_Y.f3 - SLAB - LAMP_AT.f2[1] - 9);
  lantern('roof', LAMP_AT.f3, 0.9, ROOF_Y - LAMP_AT.f3[1] - 9);

  // ---------------------------------------------------------------- windows and doors
  const opening = (band: Band, o: Opening, st: OpenStyle, off: V3 = [0, 0, 0], target?: THREE.Group, SS: Sets = S) => {
    const L: V3 = [Math.cos(o.a), 0, -Math.sin(o.a)], D: V3 = [Math.sin(o.a), 0, Math.cos(o.a)];
    const at = (x: number, y: number, z: number): V3 => [L[0] * x + D[0] * z - off[0], y - off[1], L[2] * x + D[2] * z - off[2]];
    const zBark = (x: number, y: number) => { const a = o.a + Math.atan2(x, 90); return Math.sqrt(Math.max(1, barkR(a, y) ** 2 - x * x)); };
    const zIn = (x: number) => Math.sqrt(Math.max(1, (R_IN - 0.7) ** 2 - x * x));
    const nReq = o.kind === 'round' ? 28 : 30, fw = o.kind === 'door' ? 4.5 : 3.8;
    const p0 = openingOutline(o, nReq, 0), p1 = openingOutline(o, nReq, fw), n = p0.length;
    const zf = p0.map(([x, y], i) => Math.max(zBark(x, y), zBark(p1[i][0], p1[i][1])) + 2.2);
    const key = target ? 'front' + o.a.toFixed(2) : '';
    const fr = SS.get(band, 'planks', key);
    const trim = st.trim ?? [1, 0.92, 0.8];
    const wrapIdx = (i: number) => (i + n) % n;
    let len = 0;
    for (let i = 0; i < n; i++) {
      const j = wrapIdx(i + 1);
      const seg = Math.hypot(p0[j][0] - p0[i][0], p0[j][1] - p0[i][1]);
      const u0 = len / 30, u1 = (len + seg) / 30;
      len += seg;
      // face
      const a = fr.vert(at(p0[i][0], p0[i][1], zf[i]), [u0, 0], trim), b = fr.vert(at(p1[i][0], p1[i][1], zf[i] - 0.3), [u0, 0.12], trim);
      const c = fr.vert(at(p1[j][0], p1[j][1], zf[j] - 0.3), [u1, 0.12], trim), d = fr.vert(at(p0[j][0], p0[j][1], zf[j]), [u1, 0], trim);
      fr.quad(a, d, c, b);
      // outer side, sinking into the bark
      const e = fr.vert(at(p1[i][0], p1[i][1], zf[i] - 0.3), [u0, 0.12], [trim[0] * 0.7, trim[1] * 0.7, trim[2] * 0.7]), f = fr.vert(at(p1[j][0], p1[j][1], zf[j] - 0.3), [u1, 0.12], [trim[0] * 0.7, trim[1] * 0.7, trim[2] * 0.7]);
      const zb1 = zBark(p1[i][0], p1[i][1]) - 3, zb2 = zBark(p1[j][0], p1[j][1]) - 3;
      const g2 = fr.vert(at(p1[j][0], p1[j][1], zb2), [u1, 0.22], [0.5, 0.45, 0.4]), h = fr.vert(at(p1[i][0], p1[i][1], zb1), [u0, 0.22], [0.5, 0.45, 0.4]);
      fr.quad(e, f, g2, h);
      // tunnel lining through the wall
      const zi1 = st.inner ? zIn(p0[i][0]) : zf[i] - 6, zi2 = st.inner ? zIn(p0[j][0]) : zf[j] - 6;
      const t0 = fr.vert(at(p0[i][0], p0[i][1], zf[i]), [u0, 0.3], [0.8, 0.72, 0.62]), t1 = fr.vert(at(p0[j][0], p0[j][1], zf[j]), [u1, 0.3], [0.8, 0.72, 0.62]);
      const t2 = fr.vert(at(p0[j][0], p0[j][1], zi2), [u1, 0.6], [0.55, 0.48, 0.42]), t3 = fr.vert(at(p0[i][0], p0[i][1], zi1), [u0, 0.6], [0.55, 0.48, 0.42]);
      fr.quad(t0, t3, t2, t1);
      if (st.inner) {
        // the inner architrave on the room side
        const q1 = openingOutline(o, nReq, 4.5);
        const za = (x: number) => Math.sqrt(Math.max(1, (R_IN - 1.1) ** 2 - x * x));
        const ia = fr.vert(at(p0[i][0], p0[i][1], za(p0[i][0])), [u0, 0.7], [0.78, 0.68, 0.58]), ib = fr.vert(at(q1[i][0], q1[i][1], za(q1[i][0])), [u0, 0.8], [0.7, 0.6, 0.5]);
        const ic = fr.vert(at(q1[j][0], q1[j][1], za(q1[j][0])), [u1, 0.8], [0.7, 0.6, 0.5]), id = fr.vert(at(p0[j][0], p0[j][1], za(p0[j][0])), [u1, 0.7], [0.78, 0.68, 0.58]);
        fr.quad(ia, ib, ic, id);
      }
    }
    const zMid = (x: number, y: number) => (st.inner ? (zIn(x) + zBark(x, y)) / 2 : zBark(x, y) - 2.5);
    const cy = o.kind === 'round' ? (o.y0 + o.y1) / 2 : (o.y0 + o.y1) / 2;
    if (o.kind === 'door') {
      // the door itself: boards with iron straps, a porthole and a brass knob
      const dg = SS.get(band, 'door', key);
      const zc = zMid(0, cy);
      const c0 = dg.vert(at(0, cy, zc), [0.5, 0.5]);
      const rim = p0.map(([x, y]) => dg.vert(at(x * 1.01, y, zc), [x / (o.hw * 2) + 0.5, (y - o.y0) / (o.y1 - o.y0)]));
      for (let i = 0; i < n; i++) dg.tri(c0, rim[i], rim[wrapIdx(i + 1)]);
      const ir = SS.get(band, 'iron', key);
      for (const y of [o.y0 + 8, o.y1 - 14]) box(ir, at(-1, y, zc + 0.7), [o.hw * 1.7, 1.6, 0.7], [0, o.a, 0]);
      for (const y of [o.y0 + 8, o.y1 - 14]) for (const x of [-o.hw + 3, o.hw * 0.6]) ball(ir, at(x, y, zc + 1.1), 0.7);
      const br = SS.get(band, 'brass', key);
      ball(br, at(o.hw - 4, o.y0 + 18, zc + 1.6), 1.3);
      box(br, at(o.hw - 4, o.y0 + 18, zc + 0.6), [1.6, 3.2, 0.8], [0, o.a, 0]);
      // porthole
      const py = o.y1 - 13;
      const ring = new THREE.TorusGeometry(3.4, 0.9, 5, 14);
      ir.add(ring, mat(at(0, py, zc + 0.8), [0, o.a, 0]));
      const pg = SS.get(band, 'pane');
      cyl(pg, at(0, py, zc + 0.3), 3.2, 0.4, [Math.PI / 2, o.a, 0], [1, 1, 1], 12);
      // the hood over the door: a little shingled roof on two brackets
      const hd = SS.get(band, 'planks', key);
      const hy = o.y1 + 5;
      const zt = zBark(0, hy);
      box(hd, at(0, hy + 2.5, zt + 6), [o.hw * 2 + 12, 1.6, 14], [0.42, o.a, 0], [0.6, 0.42, 0.32]);
      for (let k = 0; k < 4; k++) box(hd, at(0, hy + 1.8 + k * 1.3, zt + 11.5 - k * 2.8), [o.hw * 2 + 13, 0.8, 3.2], [0.42, o.a, 0], [0.55 + k * 0.04, 0.38, 0.28]);
      for (const s of [-1, 1]) beam(hd, at(s * (o.hw + 3), hy - 6, zt - 1), at(s * (o.hw + 3), hy + 1, zt + 10), 1.6, [0.7, 0.58, 0.46]);
    } else if (st.glass !== 'none') {
      const gm: HouseMat = st.glass === 'clear' ? 'pane' : 'paint';
      const gg = SS.get(band, gm, st.glass === 'dusty' ? 'dusty' + key : key);
      if (st.glass === 'dusty' && !extra.has('dusty' + key)) extra.set('dusty' + key, DUSTY());
      const zc = zMid(0, cy);
      const c0 = gg.vert(at(0, cy, zc), [0.5, 0.5]);
      const rim = p0.map(([x, y]) => gg.vert(at(x, y, zMid(x, y)), [x / (o.hw * 2) + 0.5, (y - o.y0) / (o.y1 - o.y0)]));
      for (let i = 0; i < n; i++) gg.tri(c0, rim[i], rim[wrapIdx(i + 1)]);
      // mullions
      const mu = SS.get(band, 'planks', key);
      const tint: V3 = [trim[0] * 0.9, trim[1] * 0.9, trim[2] * 0.9];
      if (o.kind === 'round') {
        beam(mu, at(-o.hw, cy, zc + 0.4), at(o.hw, cy, zc + 0.4), 1.4, tint);
        beam(mu, at(0, o.y0, zc + 0.4), at(0, o.y1, zc + 0.4), 1.4, tint);
      } else {
        const spring = o.y1 - o.hw;
        beam(mu, at(0, o.y0, zMid(0, o.y0) + 0.4), at(0, o.y1, zMid(0, o.y1) + 0.4), 1.4, tint);
        beam(mu, at(-o.hw, spring, zMid(0, spring) + 0.4), at(o.hw, spring, zMid(0, spring) + 0.4), 1.4, tint);
        beam(mu, at(-o.hw, (o.y0 + spring) / 2, zMid(0, spring) + 0.4), at(o.hw, (o.y0 + spring) / 2, zMid(0, spring) + 0.4), 1.2, tint);
      }
    }
    if (st.sill !== false && o.kind !== 'door') {
      const sy = o.kind === 'round' ? o.y0 - 1 : o.y0 - 1.2;
      const zs = zBark(0, sy);
      const sg = SS.get(band, 'planks', key);
      box(sg, at(0, sy - 1.2, zs + 1.5), [o.hw * 2 + 10, 2.4, 7], [0, o.a, 0], [0.92, 0.82, 0.7]);
      box(sg, at(0, sy - 3.2, zs - 0.5), [o.hw * 2 + 4, 2, 3], [0, o.a, 0], [0.6, 0.52, 0.44]);
      if (st.box) {
        // a flower box under the sill
        box(sg, at(0, sy - 6.5, zs + 3.5), [o.hw * 2 + 6, 5, 6], [0, o.a, 0], [0.64, 0.82, 0.7]);
        const cards = target ? frontCards : ivyBand[band];
        for (let k = 0; k < 6; k++) {
          const x = -o.hw - 1 + (k / 5) * (o.hw * 2 + 2);
          const base = at(x, sy - 5, zs + 4.2), top = at(x, sy + 8, zs + 4.6);
          const tw = 5.5;
          const q: [V3, V3, V3, V3] = [[base[0] - L[0] * tw, base[1], base[2] - L[2] * tw], [base[0] + L[0] * tw, base[1], base[2] + L[2] * tw], [top[0] + L[0] * tw, top[1], top[2] + L[2] * tw], [top[0] - L[0] * tw, top[1], top[2] - L[2] * tw]];
          cards.flat(q, k % 2 ? CELL.acorn[k % 4] : CELL.fern[k % 2], D, [1, 1, 1], 0.6, 0.4, 0, 0.75);
        }
      }
    }
    if (st.shutters) {
      // two closed shutter leaves meeting in the middle, a Z brace on each, a sliver of light between
      const sh = new THREE.Group();
      const zs = Math.max(...zf) + 0.4;
      const tint: V3 = [0.5, 0.74, 0.68];
      for (const side of [-1, 1] as const) {
        const leaf = new THREE.Group();
        const hingeX = side * (o.hw + 1.2);
        const piv = at(hingeX, 0, zs);
        leaf.position.set(piv[0] * PX, piv[1] * PX, piv[2] * PX);
        const lg = new Geo();
        const lw = o.hw + 1.2 - 0.8, top = o.kind === 'round' ? o.y1 + 1 : o.y1 + 1, bot = o.y0 - 1;
        const loc = (x: number, y: number, dz: number): V3 => { const p = at(x, y, zs + dz); return [p[0] - piv[0], p[1] - piv[1], p[2] - piv[2]]; };
        // boards (planks texture), the arch head clipped by the outline
        const cols = 4;
        for (let k = 0; k < cols; k++) {
          const xa = side * (lw - (k * lw) / cols), xb = side * (lw - ((k + 1) * lw) / cols);
          const headY = (x: number) => { const cy2 = o.y1 - o.hw; const r = o.hw + 1; return o.kind === 'round' ? top : cy2 + Math.sqrt(Math.max(0, r * r - x * x)); };
          const hA = headY(xa), hB = headY(xb);
          const v0 = lg.vert(loc(xa, bot, 0), [k / cols, 0], tint), v1 = lg.vert(loc(xb, bot, 0), [(k + 1) / cols, 0], tint);
          const v2 = lg.vert(loc(xb, hB, 0), [(k + 1) / cols, (hB - bot) / 40], tint), v3 = lg.vert(loc(xa, hA, 0), [k / cols, (hA - bot) / 40], tint);
          if (side > 0) lg.quad(v1, v0, v3, v2); else lg.quad(v0, v1, v2, v3);
        }
        // battens
        for (const y of [bot + 4, (bot + top) / 2 - 2]) box(lg, loc(side * lw / 2, y, 0.8), [lw - 1, 2.2, 1.2], [0, o.a, 0], [tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8]);
        const ir = new Geo();
        for (const y of [bot + 4, (bot + top) / 2 - 2]) box(ir, loc(side * (lw - 2.5), y, 1.6), [5, 1, 0.6], [0, o.a, 0]);
        const m1 = new THREE.Mesh(lg.build(), houseMat('painted')), m2 = new THREE.Mesh(ir.build(), houseMat('iron'));
        for (const m of [m1, m2]) { m.scale.setScalar(PX); m.castShadow = true; m.receiveShadow = true; leaf.add(m); }
        sh.add(leaf);
        shutterOut.push({ obj: leaf, side });
      }
      // the sliver of warm light between the closed shutters
      const sl = new Geo();
      box(sl, at(0, (o.y0 + o.y1) / 2 - 1, zs - 0.5), [1.8, o.y1 - o.y0 - 4, 0.4], [0, o.a, 0]);
      box(sl, at(0, o.y0 + 1.2, zs - 0.5), [o.hw * 1.6, 1.2, 0.4], [0, o.a, 0]);
      const slm = new THREE.Mesh(sl.build(), houseMat('sliver'));
      slm.scale.setScalar(PX);
      sh.add(slm);
      sliverOut.push(slm);
      (target ?? bands[band]).add(sh);
    }
  };

  // windows and doors in the walls of every floor (they go through to the room)
  let frontCards = new Cards('flat');
  const shutterOut: { obj: THREE.Object3D; side: -1 | 1 }[] = [];
  const sliverOut: THREE.Object3D[] = [];
  for (const fid of FLOOR_IDS) for (const o of openings(fid)) opening(fid, o, { inner: true, glass: 'clear', box: o.kind === 'arch' && Math.abs(o.a) < 2.2 });

  // ---------------------------------------------------------------- the locked fronts (whole bark, shuttered)
  const fronts: Partial<Record<FloorId, LockFront>> = {};
  for (const fid of ['f2', 'f3'] as const) {
    const [y0, y1] = BAND_Y[fid];
    const group = new THREE.Group();
    group.name = 'front:' + fid;
    const halves: FrontHalf[] = [];
    shutterOut.length = 0; sliverOut.length = 0;
    const shutters: { obj: THREE.Object3D; side: -1 | 1 }[] = [];
    for (const side of [-1, 1] as const) {
      const hingeA = side * OPEN_A;
      const hy = (y0 + y1) / 2;
      const piv = P(hingeA, hy, barkR(hingeA, hy));
      const hg = new THREE.Group();
      hg.position.set(piv[0] * PX, piv[1] * PX, piv[2] * PX);
      const sub = new Sets();
      const g = sub.get(fid, 'bark');
      const as = side < 0 ? angleCols(-OPEN_A, 0) : angleCols(0, OPEN_A);
      shell(g, as, rows(y0, y1), frontWins[fid], piv, 0.35);
      // everything on this half is built relative to its hinge, so the half can swing open like a dollhouse front
      const tmp = { f1: new THREE.Group(), f2: hg, f3: hg, roof: new THREE.Group() } as Record<Band, THREE.Group>;
      frontCards = new Cards('flat');
      for (const o of frontWins[fid]) if ((o.a < 0) === (side < 0) || (o.a === 0 && side > 0)) {
        const isRound = o.kind === 'round';
        opening(fid, o, { inner: false, glass: 'dusty', shutters: !isRound, box: !isRound, trim: [0.72, 0.58, 0.46] }, piv, hg, sub);
        shutters.push(...shutterOut.splice(0));
      }
      // ivy creeping up over the shut front
      for (const [a, y0, y1] of (fid === 'f2' ? [[-0.72, 66, 128], [0.12, 66, 100], [0.7, 80, 136]] : [[-0.55, 138, 196], [0.45, 150, 204]]) as [number, number, number][]) {
        if ((a < 0) === (side < 0)) ivyStrand(frontCards, a, y0, y1, 0.05, 13, piv, 1.6);
      }
      const flowers = frontCards;
      sub.flush(tmp, extra);
      if (flowers.size) hg.add(flowers.mesh('front-flowers'));
      group.add(hg);
      halves.push({ group: hg, hinge: hingeA, side });
    }
    // the plaque and padlock in the middle
    const level = UNLOCK[fid].level;
    const py = fid === 'f2' ? FLOOR_Y.f2 + 40 : FLOOR_Y.f3 + 8;
    const zr = barkR(0, py);
    const plaque = new THREE.Group();
    const pm = new THREE.Mesh(new THREE.BoxGeometry(16, 10.5, 1.2), [houseMat('brass'), houseMat('brass'), houseMat('brass'), houseMat('brass'), new THREE.MeshStandardMaterial({ map: plaqueTex(level), metalness: 0.3, roughness: 0.38 }), houseMat('brass')]);
    pm.scale.setScalar(PX);
    plaque.position.set(0, py * PX, (zr + 1.4) * PX);
    pm.castShadow = true;
    plaque.add(pm);
    const padlock = new THREE.Group();
    {
      const g = new Geo(), ir = new Geo();
      box(g, [0, 0, 0], [9, 8, 3.2], [0, 0, 0], [1, 1, 1]);
      ir.add(new THREE.TorusGeometry(3.1, 0.95, 6, 14, Math.PI), mat([0, 4, 0], [0, 0, 0]));
      box(ir, [0, -0.8, 1.65], [1.3, 3, 0.3], [0, 0, 0], [0.2, 0.2, 0.2]);
      ball(ir, [0, 0.9, 1.65], 0.9, [0.2, 0.2, 0.2]);
      const m1 = new THREE.Mesh(g.build(), houseMat('brass')), m2 = new THREE.Mesh(ir.build(), houseMat('iron'));
      for (const m of [m1, m2]) { m.scale.setScalar(PX); m.castShadow = true; padlock.add(m); }
      padlock.position.set(0, (py - 13) * PX, (zr + 2.8) * PX);
      // the hasp it hangs from
      const hasp = new Geo();
      box(hasp, [0, -6.8, -0.4], [2.6, 4.2, 1.2]);
      const hm = new THREE.Mesh(hasp.build(), houseMat('iron'));
      hm.scale.setScalar(PX);
      plaque.add(hm);
    }
    group.add(plaque, padlock);
    fronts[fid] = { fid, group, halves, shutters, padlock, plaque, sliver: [...sliverOut] };
    bands[fid].add(group);
  }

  // ---------------------------------------------------------------- roots
  {
    const g = S.get('f1', 'bark');
    for (const rt of ROOTS) {
      const pts: V3[] = [];
      const ctrl: V3[] = [];
      const len = rt.len, bend = (R() - 0.5) * 0.25;
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        const a = rt.a + bend * t * t + Math.sin(t * 5 + rt.a * 3) * 0.03;
        const r = barkR(rt.a, rt.h * 0.6) - 6 + t * len;
        const y = rt.h * 0.62 * (1 - t) ** 1.6 - 9 * t ** 2 + (t > 0.25 && t < 0.8 ? Math.sin((t - 0.25) / 0.55 * Math.PI) * 3 : 0);
        ctrl.push(P(a, y, r));
      }
      pts.push(...spline(ctrl, 22));
      const rad = pts.map((_, i) => { const t = i / (pts.length - 1); return Math.max(1.6, (rt.amp * 0.5 + 4) * (1 - t) ** 1.2 + 1.5); });
      g.tube(pts, rad, 9, {
        uRep: 1, vScale: 128, squash: 0.7,
        col: (t, _u, n) => [0.55 + 0.45 * clamp(n.y + 0.4), clamp(0.55 + n.y * 0.6 + t * 0.3), 0.4],
      });
      // a side root
      if (rt.len > 80) {
        const i0 = 9, base = pts[i0];
        const sa = rt.a + (R() < 0.5 ? -0.35 : 0.35);
        const side = spline([base, P(sa, -1, Math.hypot(base[0], base[2]) + 18), P(sa + 0.05, -6, Math.hypot(base[0], base[2]) + 40)], 10);
        g.tube(side, side.map((_, i) => Math.max(1.2, rad[i0] * 0.45 * (1 - i / 10) + 1)), 6, { uRep: 1, vScale: 128, squash: 0.75, col: (t, _u, n) => [0.6 + 0.4 * clamp(n.y + 0.4), clamp(0.6 + n.y * 0.5), 0.4] });
      }
    }
  }

  // ---------------------------------------------------------------- limbs and the crown
  // The crown is a cumulus of leaf lobes: a ring of low lobes out at the ends of the great limbs, a ring of higher
  // ones, a few on top, and a dark core filling the middle. Each limb climbs out of the top of the trunk and
  // sweeps out under its lobe, so the limbs show beneath the leaves.
  const lobes: Mass[] = [];
  const LOBE_TINTS: V3[] = [[1, 1, 1], [1.08, 1.06, 0.82], [0.88, 0.98, 0.96], [0.96, 1.02, 0.9], [1.04, 1.0, 0.86], [0.9, 0.96, 0.88]];
  {
    const g = S.get('roof', 'bark');
    const base = 8;
    for (let k = 0; k < base; k++) {
      const a = (k / base) * TAU + 0.35 + (R() - 0.5) * 0.25;
      const rr = 168 + R() * 34, ly = (k % 2 ? 286 : 310) + R() * 18;
      const c = P(a, ly, rr);
      lobes.push({ c: [c[0], c[1], c[2] * 0.82 - 8], r: [86 + R() * 22, 58 + R() * 16, 80 + R() * 18], tint: LOBE_TINTS[k % LOBE_TINTS.length] });
      // the limb under it
      const y0 = 232 + R() * 22, tip = P(a, ly - 18, rr * 0.86);
      const ctrl: V3[] = [P(a, y0 - 16, 36), P(a + 0.03, y0 + 4, barkR(a, y0) - 3), P(a + 0.06, (y0 + ly) / 2 - 6, rr * 0.48), [tip[0], tip[1], tip[2] * 0.84 - 8]];
      const pts = spline(ctrl, 16);
      const r0 = 15 + R() * 4;
      g.tube(pts, pts.map((_, i) => r0 * (1 - (i / 15) * 0.72)), 9, { uRep: 1, vScale: 128, col: (t, _u, n) => [0.55 + 0.45 * clamp(n.y + 0.5), clamp(0.25 + n.y * 0.55 + t * 0.15), 0.62] });
      // a fork up into the leaves
      const b2 = pts[9], up = P(a + (R() - 0.5) * 0.5, ly + 20, rr * 0.7);
      const br = spline([b2, [(b2[0] + up[0]) / 2, (b2[1] + up[1]) / 2 + 6, (b2[2] + up[2]) / 2], up], 8);
      g.tube(br, br.map((_, i) => Math.max(1.6, r0 * 0.38 * (1 - i / 8))), 6, { uRep: 1, vScale: 128, col: () => [0.75, 0.3, 0.6] });
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + 1.0 + (R() - 0.5) * 0.3;
      const c = P(a, 366 + R() * 22, 96 + R() * 24);
      lobes.push({ c: [c[0], c[1], c[2] * 0.85 - 8], r: [88 + R() * 16, 60 + R() * 10, 82 + R() * 14], tint: LOBE_TINTS[(k + 3) % LOBE_TINTS.length] });
    }
    lobes.push({ c: [14, 420, -12], r: [96, 50, 80] }, { c: [-70, 408, 30], r: [72, 44, 62] }, { c: [80, 402, 26], r: [70, 44, 60] });
    // the skirts: lobes drooping low at the sides on the ends of long limbs, framing the trunk like an old oak's
    for (const [a, ly] of [[-1.72, 262], [-1.22, 278], [1.28, 272], [1.86, 256], [2.6, 268], [-2.55, 270]] as const) {
      const rr = 214 + R() * 20;
      const c = P(a, ly, rr);
      lobes.push({ c: [c[0], c[1], c[2] * 0.85 - 8], r: [70 + R() * 14, 48 + R() * 10, 64 + R() * 12], tint: LOBE_TINTS[Math.floor(R() * LOBE_TINTS.length)] });
      const y0 = 226 + R() * 12;
      const ctrl: V3[] = [P(a, y0 - 14, 40), P(a + 0.02, y0 + 4, barkR(a, y0) - 3), P(a + 0.05, ly + 8, rr * 0.55), P(a + 0.06, ly - 6, rr * 0.92)];
      const pts = spline(ctrl, 14);
      S.get('roof', 'bark').tube(pts.map((p) => [p[0], p[1], p[2] * 0.88 - 6] as V3), pts.map((_, i) => 12 * (1 - (i / 13) * 0.7)), 8, { uRep: 1, vScale: 128, col: (t, _u, n) => [0.55 + 0.45 * clamp(n.y + 0.5), clamp(0.3 + n.y * 0.5 + t * 0.15), 0.62] });
    }
    lobes.push({ c: [0, 346, -10], r: [170, 84, 132], core: true });
  }
  {
    const crown = new Cards('bill');
    fillCrown(crown, lobes, [0, 346, -10]);
    const m = crown.mesh('crown');
    if (import.meta.env.DEV) console.warn('crown cards', crown.size);
    bands.roof.add(m);
  }

  // ---------------------------------------------------------------- the great limb and its platform (Pip's launch perch)
  {
    const g = S.get('f2', 'bark');
    // the great limb sweeps out under the platform and climbs into the crown's lower right lobes
    const ctrl: V3[] = [P(LIMB_A, 52, barkR(LIMB_A, 52) - 7), P(LIMB_A, 60, barkR(LIMB_A, 60) - 2), P(LIMB_A + 0.02, 70, 128), P(LIMB_A + 0.03, 75, 168), P(LIMB_A + 0.06, 100, 206), P(LIMB_A + 0.12, 160, 228), P(LIMB_A + 0.22, 236, 226)];
    const pts = spline(ctrl, 26);
    g.tube(pts, pts.map((_, i) => 14 * (1 - (i / 25) * 0.72)), 10, { uRep: 1, vScale: 128, col: (t, _u, n) => [0.6 + 0.4 * clamp(n.y + 0.5), clamp(0.35 + n.y * 0.6), 0.5] });
    const tip = pts[pts.length - 1];
    const lc = new Cards('bill');
    fillCrown(lc, [{ c: [pts[17][0], pts[17][1] + 10, pts[17][2]], r: [38, 28, 38] }], [0, 346, -10], 9);
    bands.f2.add(lc.mesh('limb-leaves'));
    // the platform: an octagonal deck on the limb with a railing and the perch
    const dk = S.get('f2', 'deck'), pl = S.get('f2', 'planks');
    const [px, py, pz] = PLATFORM;
    const rr = 19;
    const c = dk.vert([px, py, pz], [px / 40, pz / 40]);
    const ring: number[] = [];
    for (let k = 0; k <= 8; k++) { const a = (k / 8) * TAU + Math.PI / 8; ring.push(dk.vert([px + Math.sin(a) * rr, py, pz + Math.cos(a) * rr], [(px + Math.sin(a) * rr) / 40, (pz + Math.cos(a) * rr) / 40])); }
    for (let k = 0; k < 8; k++) dk.tri(c, ring[k], ring[k + 1]);
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * TAU + Math.PI / 8, a1 = ((k + 1) / 8) * TAU + Math.PI / 8;
      const p0: V3 = [px + Math.sin(a0) * rr, py, pz + Math.cos(a0) * rr], p1: V3 = [px + Math.sin(a1) * rr, py, pz + Math.cos(a1) * rr];
      beam(pl, [p0[0], py - 1.5, p0[2]], [p1[0], py - 1.5, p1[2]], 3, [0.7, 0.6, 0.5]);
      // railing (open on the side facing the trunk)
      const mid = (a0 + a1) / 2;
      const toTrunk = Math.cos(mid - (LIMB_A + Math.PI)) > 0.6;
      if (!toTrunk) {
        beam(pl, p0, [p0[0], py + 12, p0[2]], 1.8, [0.85, 0.74, 0.6]);
        beam(pl, [p0[0], py + 12, p0[2]], [p1[0], py + 12, p1[2]], 1.6, [0.9, 0.8, 0.64]);
        rope(pl, [p0[0], py + 7, p0[2]], [p1[0], py + 7, p1[2]], 1.2, 0.5, [0.8, 0.7, 0.5]);
      }
    }
    // the perch Pip takes off from
    const [lx, ly, lz] = LAUNCH;
    const base: V3 = [lx, py, lz];
    beam(pl, base, [lx, ly - 1, lz], 2.4, [0.8, 0.68, 0.54]);
    const t: V3 = [Math.cos(LIMB_A), 0, -Math.sin(LIMB_A)];
    beam(pl, [lx - t[0] * 7, ly - 1, lz - t[2] * 7], [lx + t[0] * 7, ly - 1, lz + t[2] * 7], 2, [0.86, 0.74, 0.6]);
    // a little pennant on top
    const pf = S.get('f2', 'paint');
    beam(pf, [lx, ly - 1, lz], [lx, ly + 14, lz], 0.8, [0.4, 0.3, 0.2]);
    box(pf, [lx + t[0] * 4, ly + 11, lz + t[2] * 4], [7, 4, 0.5], [0, LIMB_A + Math.PI / 2, 0], [0.82, 0.26, 0.2]);
  }

  // ---------------------------------------------------------------- the rope ladder from the platform to the ground
  const ladderGroup = new THREE.Group();
  {
    const [px, py, pz] = PLATFORM;
    const out = 17, a = 1.3;
    const top: V3 = [px + Math.sin(a) * out, py - 1, pz + Math.cos(a) * out];
    ladderGroup.position.set(top[0] * PX, top[1] * PX, top[2] * PX);
    const g = new Geo();
    const t: V3 = [Math.cos(a), 0, -Math.sin(a)];
    const len = py + 2;
    for (const s of [-1, 1]) g.tube([[t[0] * 5 * s, 0, t[2] * 5 * s], [t[0] * 5 * s, -len * 0.5, t[2] * 5 * s], [t[0] * 5 * s, -len, t[2] * 5 * s]], [0.6, 0.6, 0.6], 4, { col: () => [0.82, 0.72, 0.5] });
    const w = new Geo();
    for (let y = -7; y > -len + 2; y -= 7) beam(w, [-t[0] * 6, y, -t[2] * 6], [t[0] * 6, y, t[2] * 6], 1.5, [0.9, 0.78, 0.6]);
    const m1 = new THREE.Mesh(g.build(), houseMat('paint')), m2 = new THREE.Mesh(w.build(), houseMat('planks'));
    for (const m of [m1, m2]) { m.scale.setScalar(PX); m.castShadow = true; m.receiveShadow = true; ladderGroup.add(m); }
    bands.f2.add(ladderGroup);
  }

  // ---------------------------------------------------------------- porch
  const porchLamp: V3 = [0, 0, 0];
  {
    const a0 = 0.8, a1 = 1.62, RP = RO + 34, top = 4.6;
    const dk = S.get('f1', 'deck'), pl = S.get('f1', 'planks'), bk = S.get('f1', 'bark');
    const rOut = (a: number) => RP + Math.sin(a * 9) * 2;
    dk.grid(28, 3, (u, v) => {
      const a = a0 + (a1 - a0) * u, r0 = barkR(a, top) - 4, r = r0 + (rOut(a) - r0) * v;
      return { p: P(a, top, r), uv: [(a * r) / 40, r / 40], c: [0.75 + 0.25 * v, 0.72 + 0.26 * v, 0.68 + 0.26 * v] };
    }, { flip: true });
    // fascia
    pl.grid(28, 1, (u, v) => { const a = a0 + (a1 - a0) * u; return { p: P(a, top - 4 + v * 4, rOut(a)), uv: [v * 0.1, (a * RP) / 40], c: [0.62, 0.52, 0.44] }; });
    for (const a of [a0, a1]) pl.grid(1, 1, (u, v) => { const r0 = barkR(a, top) - 4, r = r0 + (rOut(a) - r0) * u; return { p: P(a, top - 4 + v * 4, r), uv: [v * 0.1, r / 40], c: [0.62, 0.52, 0.44] }; }, { flip: a === a1 });
    // log posts under the outer edge
    for (let a = a0 + 0.06; a < a1; a += 0.2) cyl(bk, P(a, top - 6, rOut(a) - 3), 2.4, 10, [0, 0, 0], [0.6, 0.6, 0.4], 7);
    // the step down to the path
    const sa = 1.2;
    for (const [i, h] of [[0, 2.6]] as const) {
      const r = RP + 5 + i * 7;
      box(pl, P(sa, h / 2, r), [26, h, 8], [0, sa, 0], [0.88, 0.78, 0.66]);
    }
    // railing: posts round the edge, a gap at the step
    const posts = [a0 + 0.02, a0 + 0.14, a0 + 0.26, sa - 0.13, sa + 0.13, sa + 0.26, sa + 0.38, a1 - 0.02];
    posts.forEach((a, i) => {
      const r = rOut(a) - 2, b = P(a, top, r), tp = P(a, top + 15, r);
      beam(pl, b, [tp[0], top + 16, tp[2]], 2.6, [0.86, 0.72, 0.58]);
      ball(pl, [tp[0], top + 16.8, tp[2]], 1.5, [0.9, 0.78, 0.62], [1, 1, 1], 6);
      const n = posts[i + 1];
      if (n === undefined || (a < sa && n > sa)) return;
      const q = P(n, top, rOut(n) - 2);
      beam(pl, [b[0], top + 15, b[2]], [q[0], top + 15, q[2]], 2, [0.95, 0.82, 0.66], 2.6);
      beam(pl, [b[0], top + 2.5, b[2]], [q[0], top + 2.5, q[2]], 1.6, [0.86, 0.72, 0.58]);
      for (let k = 1; k < 4; k++) { const f = k / 4; beam(pl, [b[0] + (q[0] - b[0]) * f, top + 2.5, b[2] + (q[2] - b[2]) * f], [b[0] + (q[0] - b[0]) * f, top + 15, b[2] + (q[2] - b[2]) * f], 1.1, [0.8, 0.68, 0.54]); }
    });
    // lantern on the post beside the step, and one on a bracket by the door
    const lp = P(sa + 0.13, top + 22.6, rOut(sa + 0.13) - 2);
    lantern('f1', lp, 0.62);
    porchLamp[0] = lp[0]; porchLamp[1] = lp[1]; porchLamp[2] = lp[2];
    const dl = P(DOOR_A - 0.2, 34, barkR(DOOR_A - 0.2, 34) + 7);
    const ir = S.get('f1', 'iron');
    beam(ir, P(DOOR_A - 0.2, 42, barkR(DOOR_A - 0.2, 42) - 1), P(DOOR_A - 0.2, 42, barkR(DOOR_A - 0.2, 42) + 8), 1);
    beam(ir, P(DOOR_A - 0.2, 42, barkR(DOOR_A - 0.2, 42) + 7.5), P(DOOR_A - 0.2, 40, barkR(DOOR_A - 0.2, 42) + 7.5), 0.8);
    lantern('f1', dl, 0.55);
    // welcome mat
    const mt = S.get('f1', 'paint', 'mat');
    extra.set('mat', new THREE.MeshStandardMaterial({ map: matTex(), roughness: 0.95 }));
    box(mt, P(DOOR_A, top + 0.35, barkR(DOOR_A, top) + 6), [18, 0.7, 9], [0, DOOR_A, 0]);
    // fairy lights along the top rail
    const fl = S.get('f1', 'glow', 'bulbs'), wire = S.get('f1', 'iron');
    const wp: V3[] = [];
    for (let k = 0; k <= 40; k++) { const a = a0 + 0.02 + (a1 - a0 - 0.04) * (k / 40); const sag = Math.abs(Math.sin(k / 40 * Math.PI * 7)) * 2.2; wp.push(P(a, top + 14 - sag, rOut(a) - 1)); }
    wire.tube(wp, wp.map(() => 0.25), 3);
    for (let k = 1; k < 40; k += 2) ball(fl, wp[k], 0.75, [1, 1, 1], [1, 1, 1], 4);
    extra.set('bulbs', new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false }));
  }

  // ---------------------------------------------------------------- balcony on the second floor
  {
    const a0 = 0.86, a1 = 1.56, RB = RO + 22, top = FLOOR_Y.f2 + 0.6;
    const dk = S.get('f2', 'deck'), pl = S.get('f2', 'planks');
    dk.grid(20, 2, (u, v) => {
      const a = a0 + (a1 - a0) * u, r0 = barkR(a, top) - 4, r = r0 + (RB - r0) * v;
      return { p: P(a, top, r), uv: [(a * r) / 40, r / 40], c: [0.8 + 0.2 * v, 0.76 + 0.22 * v, 0.72 + 0.2 * v] };
    }, { flip: true });
    // underside
    dk.grid(20, 1, (u, v) => { const a = a0 + (a1 - a0) * u, r0 = barkR(a, top - 3) - 4, r = r0 + (RB - r0) * v; return { p: P(a, top - 3, r), uv: [(a * r) / 40, r / 40], c: [0.45, 0.4, 0.36] }; });
    pl.grid(20, 1, (u, v) => { const a = a0 + (a1 - a0) * u; return { p: P(a, top - 3 + v * 3, RB), uv: [v * 0.1, (a * RB) / 40], c: [0.62, 0.52, 0.44] }; });
    for (const a of [a0, a1]) pl.grid(1, 1, (u, v) => { const r0 = barkR(a, top) - 4, r = r0 + (RB - r0) * u; return { p: P(a, top - 3 + v * 3, r), uv: [v * 0.1, r / 40], c: [0.62, 0.52, 0.44] }; }, { flip: a === a1 });
    // struts down into the trunk
    for (const a of [a0 + 0.08, (a0 + a1) / 2, a1 - 0.08]) beam(pl, P(a, top - 2, RB - 3), P(a, top - 22, barkR(a, top - 22) - 1), 2.4, [0.7, 0.6, 0.5]);
    // railing
    let prev: V3 | null = null;
    for (let a = a0 + 0.02; a <= a1 + 0.001; a += (a1 - a0 - 0.04) / 6) {
      const b = P(a, top, RB - 1.5), tp = P(a, top + 14, RB - 1.5);
      beam(pl, b, tp, 2.4, [0.86, 0.72, 0.58]);
      if (prev) {
        beam(pl, [prev[0], top + 14, prev[2]], tp, 1.9, [0.95, 0.82, 0.66], 2.4);
        for (let k = 1; k < 4; k++) { const f = k / 4; beam(pl, [prev[0] + (b[0] - prev[0]) * f, top, prev[2] + (b[2] - prev[2]) * f], [prev[0] + (b[0] - prev[0]) * f, top + 14, prev[2] + (b[2] - prev[2]) * f], 1.1, [0.8, 0.68, 0.54]); }
      }
      prev = b;
    }
    // flower box on the rail, lantern by the door
    const fa = (a0 + a1) / 2 + 0.12;
    box(pl, P(fa, top + 16.5, RB - 1), [16, 5, 5], [0, fa, 0], [0.62, 0.8, 0.7]);
    for (let k = 0; k < 4; k++) {
      const a = fa - 0.06 + k * 0.04, base = P(a, top + 17, RB - 1), tp2 = P(a, top + 26, RB - 1);
      const L: V3 = [Math.cos(a), 0, -Math.sin(a)];
      ivyBand.f2.flat([[base[0] - L[0] * 4, base[1], base[2] - L[2] * 4], [base[0] + L[0] * 4, base[1], base[2] + L[2] * 4], [tp2[0] + L[0] * 4, tp2[1], tp2[2] + L[2] * 4], [tp2[0] - L[0] * 4, tp2[1], tp2[2] - L[2] * 4]], k % 2 ? CELL.acorn[k] : CELL.fern[k % 2], [Math.sin(a), 0, Math.cos(a)], [1, 1, 1], 0.6, 0.4, 0, 0.75);
    }
    const ir = S.get('f2', 'iron');
    beam(ir, P(DOOR_A + 0.22, top + 42, barkR(DOOR_A + 0.22, top + 42) - 1), P(DOOR_A + 0.22, top + 42, barkR(DOOR_A + 0.22, top + 42) + 7), 1);
    lantern('f2', P(DOOR_A + 0.22, top + 34, barkR(DOOR_A + 0.22, top + 34) + 6.5), 0.55);
  }

  // ---------------------------------------------------------------- the stove pipe and its smoking cap
  {
    const a = CHIMNEY_A, rp = RO + 22;
    const yb = 36;
    const path: V3[] = [P(a, yb, barkR(a, yb) - 3), P(a, yb, rp - 4), P(a, yb + 6, rp), P(a, 100, rp + 1), P(a, CHIMNEY_TOP[1] - 22, rp + 2), P(a, CHIMNEY_TOP[1] - 12, rp + 5), P(a, CHIMNEY_TOP[1] - 4, Math.hypot(CHIMNEY_TOP[0], CHIMNEY_TOP[2]))];
    const pts = spline(path, 40);
    for (const band of BANDS) {
      const [y0, y1] = BAND_Y[band];
      const seg = pts.filter((p, i) => (p[1] >= y0 - 2 && p[1] <= y1 + 2) || (band === 'f1' && i < 4));
      if (seg.length < 2) continue;
      S.get(band, 'iron').tube(seg, seg.map(() => 3.6), 10, { col: (_t, _u, n) => [0.8 + 0.2 * n.y, 0.75, 0.72] });
    }
    const ir = S.get('f3', 'iron');
    const tp = pts[pts.length - 1];
    cyl(ir, [tp[0], tp[1] + 2, tp[2]], 4.6, 3, [0, 0, 0], [0.9, 0.85, 0.8], 10);
    cyl(ir, [tp[0], tp[1] + 7, tp[2]], 7, 4, [0, 0, 0], [1, 0.95, 0.9], 10, 0.8);
    for (const k of [0, 1, 2, 3]) beam(ir, [tp[0] + Math.sin(k * 1.57) * 3.8, tp[1] + 3, tp[2] + Math.cos(k * 1.57) * 3.8], [tp[0] + Math.sin(k * 1.57) * 3.8, tp[1] + 6, tp[2] + Math.cos(k * 1.57) * 3.8], 0.7);
    // brackets to the bark
    for (const y of [62, 118]) {
      const band: Band = y < BAND_Y.f2[0] ? 'f1' : y < BAND_Y.f3[0] ? 'f2' : y < ROOF_Y ? 'f3' : 'roof';
      beam(S.get(band, 'iron'), P(a, y, barkR(a, y) - 1), P(a, y, rp + 1), 1.2);
      S.get(band, 'iron').add(new THREE.TorusGeometry(4.2, 0.6, 4, 12), mat(P(a, y, rp + 1), [Math.PI / 2, 0, 0]));
    }
  }

  // ---------------------------------------------------------------- mailbox and signpost by the path
  {
    const a = 0.98, r = RO + 52;
    const pl = S.get('f1', 'planks');
    const base = P(a, 0, r);
    beam(pl, base, [base[0], 17, base[2]], 2.6, [0.78, 0.66, 0.54]);
    const mb = S.get('f1', 'paint');
    const T: V3 = [Math.cos(a), 0, -Math.sin(a)];
    box(mb, [base[0], 20.5, base[2]], [6, 6, 11], [0, a, 0], [0.62, 0.22, 0.16]);
    mb.add(new THREE.CylinderGeometry(3, 3, 11, 10, 1, false, Math.PI / 2, Math.PI), mat([base[0], 23.4, base[2]], [Math.PI / 2, a, 0]), [0.66, 0.24, 0.18]);
    // the flag (up: post for Pip)
    box(mb, [base[0] + T[0] * 3.4, 25, base[2] + T[2] * 3.4], [0.6, 7, 1], [0, a, 0], [0.3, 0.3, 0.3]);
    box(mb, [base[0] + T[0] * 3.6, 27.5, base[2] + T[2] * 3.6 + 0], [0.6, 2.6, 3.6], [0, a, 0], [0.95, 0.8, 0.2]);
    const lbl = S.get('f1', 'paint', 'mail');
    extra.set('mail', new THREE.MeshStandardMaterial({ map: mailTex(), roughness: 0.6 }));
    const lc = [base[0] + T[0] * 3.05, 21.5, base[2] + T[2] * 3.05] as V3;
    const pg = new THREE.PlaneGeometry(9, 4.5);
    lbl.add(pg, mat(lc, [0, a + Math.PI / 2, 0]));
    // signpost
    const sa = 0.5, sr = RO + 64;
    const sb = P(sa, 0, sr);
    beam(pl, sb, [sb[0], 30, sb[2]], 2.6, [0.7, 0.58, 0.46]);
    const sg = S.get('f1', 'paint', 'sign');
    extra.set('sign', new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.8 }));
    const yaw = 0.25;
    const bx = new THREE.BoxGeometry(30, 9, 1.4);
    sg.add(bx, mat([sb[0], 24, sb[2] + 1.2], [0, yaw, -0.04]));
  }

  // ---------------------------------------------------------------- shelf fungus and a knothole
  {
    const fungi: [Band, number, number][] = [['f1', -1.82, 50], ['f2', -1.6, 98], ['f2', -2.1, 112], ['f3', 1.9, 190], ['f1', 2.2, 52]];
    for (const [band, a, y] of fungi) for (let k = 0; k < 3; k++) {
      const yy = y + k * 4.5, aa = a + (k - 1) * 0.03;
      const r = barkR(aa, yy) - 1;
      const g = S.get(band, 'paint');
      const s = 4.5 - k * 0.8;
      g.add(new THREE.SphereGeometry(s, 9, 4, 0, TAU, 0, Math.PI / 2), mat(P(aa, yy, r + s * 0.3), [0, aa, 0], [1.25, 0.42, 1.1]), [0.86, 0.72 - k * 0.06, 0.5 - k * 0.04]);
    }
    // a knothole with a dark inside on the left front of the second floor's bark
    const ka = -1.32, ky = 104;
    const kr = barkR(ka, ky);
    const bk = S.get('f2', 'bark');
    bk.add(new THREE.TorusGeometry(5, 2.4, 6, 14), mat(P(ka, ky, kr + 0.4), [0, ka, 0], [1, 1.35, 1]), [0.75, 0.4, 0.5]);
    const dk = S.get('f2', 'dark');
    dk.add(new THREE.CircleGeometry(5.2, 12), mat(P(ka, ky, kr + 0.8), [0, ka, 0], [1, 1.35, 1]));
  }

  // ---------------------------------------------------------------- ivy climbing the bark, ferns round the foot
  {
    const strand = (cards: Cards, a0: number, y0: number, y1: number, drift: number) => ivyStrand(cards, a0, y0, y1, drift);
    const bandOf = (y: number): Band => (y < BAND_Y.f2[0] ? 'f1' : y < BAND_Y.f3[0] ? 'f2' : y < ROOF_Y ? 'f3' : 'roof');
    const climb = (a: number, y0: number, y1: number, drift: number) => {
      for (let y = y0; y < y1; y += 20) { const b = bandOf(y + 10); strand(ivyBand[b], a, y, Math.min(y + 20, y1), drift); }
    };
    climb(-1.12, 0, 160, 0.06); climb(-1.2, 0, 100, 0.05); climb(-2.3, 0, 140, 0.08); climb(1.38, 0, 60, 0.04); climb(2.2, 0, 220, 0.07); climb(-1.58, 120, 250, 0.05);
    climb(1.86, 90, 200, 0.06); climb(-2.85, 0, 120, 0.05);
    // ferns between the roots
    const fernAt = (a: number, d: number, s: number) => {
      const r = barkR(a, 0) + d;
      for (let k = 0; k < 2; k++) {
        const yaw = a + k * Math.PI / 2 + 0.4;
        const T: V3 = [Math.cos(yaw), 0, -Math.sin(yaw)];
        const c = P(a, -1, r);
        ivy.flat([[c[0] - T[0] * s, -1, c[2] - T[2] * s], [c[0] + T[0] * s, -1, c[2] + T[2] * s], [c[0] + T[0] * s, s * 2.2, c[2] + T[2] * s], [c[0] - T[0] * s, s * 2.2, c[2] - T[2] * s]],
          CELL.fern[k], [Math.sin(a), 0.4, Math.cos(a)], [0.7, 0.8, 0.66], 0.9, 0.2);
      }
    };
    for (const [a, d, s] of [[-1.25, 6, 9], [-1.75, 14, 10], [-2.3, 8, 10], [-2.8, 10, 10], [2.75, 6, 10], [2.25, 12, 11], [1.8, 4, 8], [-0.98, 18, 8], [-0.7, 30, 7]] as const) fernAt(a, d, s);
  }

  S.flush(bands, extra);
  for (const b of BANDS) if (ivyBand[b].size) bands[b].add(ivyBand[b].mesh('ivy:' + b));

  return {
    bands, fronts, porchLamp, ladder: ladderGroup,
    dispose() { for (const b of BANDS) bands[b].traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); },
  };
}
