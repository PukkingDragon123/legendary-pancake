// Shared bits for building the hollow oak: per-floor geometry buckets (so build mode can hide what's
// above the floor being edited), turning parts around the trunk axis, the house's own painters, and
// the see-through-walls shader patch used in the top-down build view.
import * as THREE from 'three';
import { box, type BoxSpec, type Painter } from '../../gfx/box.ts';
import { ramp, tone } from '../../gfx/color.ts';
import { bark, lvl, R, wood } from '../../gfx/mats.ts';
import { fbm, hash } from '../../gfx/noise.ts';
import { FLOOR_Y, ROOF_Y, RO, SLAB, type FloorId } from './plan.ts';

/** 0..2 = the band of floor f1..f3 (its walls plus the slab it stands on), 3 = roof and canopy */
export type Band = 0 | 1 | 2 | 3;
export const BAND_FLOOR: FloorId[] = ['f1', 'f2', 'f3'];
export const bandOfY = (y: number): Band => (y < FLOOR_Y.f2 - SLAB ? 0 : y < FLOOR_Y.f3 - SLAB ? 1 : y < ROOF_Y ? 2 : 3);
/** y range of a band's walls */
export const bandRange = (b: Band): [number, number] => (b === 0 ? [0, FLOOR_Y.f2 - SLAB] : b === 1 ? [FLOOR_Y.f2 - SLAB, FLOOR_Y.f3 - SLAB] : b === 2 ? [FLOOR_Y.f3 - SLAB, ROOF_Y] : [ROOF_Y, 400]);

export class Buckets {
  readonly b: BoxSpec[][] = [[], [], [], []];
  add(band: Band, ...boxes: BoxSpec[]) { this.b[band].push(...boxes); return this; }
  /** add boxes to whichever band their base sits in */
  auto(...boxes: BoxSpec[]) { for (const x of boxes) this.b[bandOfY(x.at[1] + 0.01)].push(x); return this; }
}

const DEG = 180 / Math.PI, RAD = Math.PI / 180;
const _m = new THREE.Matrix4(), _ry = new THREE.Matrix4(), _e = new THREE.Euler();
/** Swing boxes built facing the front (+z) round the trunk axis by `a` radians, keeping their own rotations. */
export function swing(boxes: BoxSpec[], a: number): BoxSpec[] {
  const c = Math.cos(a), s = Math.sin(a);
  _ry.makeRotationY(a);
  return boxes.map((b) => {
    const r = b.rot ?? [0, 0, 0];
    const p = b.pivot ?? [b.at[0] + b.size[0] / 2, b.at[1] + b.size[1] / 2, b.at[2] + b.size[2] / 2];
    // rotate the pivot about the y axis by a (three's Ry: x' = x cos + z sin, z' = -x sin + z cos)
    const np: [number, number, number] = [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
    let rot: [number, number, number];
    if (!r[0] && !r[2]) rot = [0, r[1] + a * DEG, 0];
    else {
      _m.makeRotationFromEuler(_e.set(r[0] * RAD, r[1] * RAD, r[2] * RAD, 'ZYX')).premultiply(_ry);
      _e.setFromRotationMatrix(_m, 'ZYX');
      rot = [_e.x * DEG, _e.y * DEG, _e.z * DEG];
    }
    return { ...b, at: [b.at[0] - p[0] + np[0], b.at[1], b.at[2] - p[2] + np[2]], rot, pivot: np };
  });
}
/** A point built facing the front, swung round the trunk axis. */
export const swingPt = (x: number, y: number, z: number, a: number): [number, number, number] => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
/** A box lying along a direction (yaw a, pitch up `tilt` radians), its base centred at (x, y, z). */
export function beam(x: number, y: number, z: number, len: number, th: number, a: number, tilt: number, mat: Painter, o: Partial<BoxSpec> = {}): BoxSpec {
  // built along +z from the base, then pitched (about x) and turned (about y) at the base
  return { ...box(x, y - th / 2, z + len / 2, th, th, len, mat, o), rot: [-tilt * DEG, a * DEG, 0], pivot: [x, y, z] };
}

// ------------------------------------------------------------------ painters

/** The cut face of the trunk: bark rim, then light sapwood and darker heartwood rings. */
export function ringWood(seed = 4): Painter {
  const sap = ramp(0xd9a865), heart = ramp(0xa8703f), barkR = ramp(0x5a3a22);
  return (t) => {
    const d = Math.hypot(t.x, t.z);
    if (RO - d < 2.4) return tone(barkR, -0.4 + (hash(Math.floor(t.x), Math.floor(t.y), Math.floor(t.z), seed) - 0.5) * 1.2);
    const ring = Math.floor((d + fbm(t.x / 9, t.y / 9, t.z / 9, seed) * 3) / 1.7);
    const r = d > RO - 14 ? sap : heart;
    return tone(r, (ring % 2 ? -0.6 : 0.35) + (hash(Math.floor(t.x * 2), Math.floor(t.y), Math.floor(t.z * 2), seed + 1) - 0.5) * 0.5 + (RO - d < 4.5 ? -0.5 : 0));
  };
}

/** Deep old-oak bark with mossy patches low down and on the north side. */
export function oakBark(seed: number, mossTo = 70): Painter {
  const b = bark('#6b4a2e', { seed, moss: '#5c9440', mossTo });
  const dark = R('#3e2a1c');
  return (t) => {
    // deep vertical furrows every few texels
    const a = Math.atan2(t.x, t.z) * RO;
    const f = fbm(a / 3.2, t.y / 26, seed * 0.37, seed);
    if (f < 0.34 && t.face !== 2 && t.face !== 3) return tone(dark, lvl(t, { noise: 0.3 }) * 0.5 - 0.6);
    return b(t);
  };
}

/** A wall segment: bark outside (+z), rings on cut faces, plain carved wood inside. */
export function wallPainter(seed: number, mossTo: number): Painter {
  const b = oakBark(seed, mossTo), rings = ringWood(seed), inner = R('#8a5a34');
  return (t) => {
    if (t.face === 4) return b(t);
    if (t.face === 5) return tone(inner, lvl(t, { noise: 0.4 }) * 0.6 - 0.6);
    return rings(t);
  };
}

export const plank = (c: string, seed = 0, axis: 'x' | 'y' | 'z' = 'x', p = 4) => wood(c, { axis, plank: p, seed });

// ------------------------------------------------------------------ see-through walls (build mode)

/** Shared uniforms: when on, walls between the camera and the room dissolve on a dither grid. */
export const CUT = {
  uCutOn: { value: 0 },
  uCutCam: { value: new THREE.Vector3() },
  uCutCenter: { value: new THREE.Vector3() },
  /** world y above which walls may dissolve */
  uCutY: { value: 0 },
  /** world y above which everything dissolves (the floors above) */
  uCutTop: { value: 999 },
};

/** Patch a material so it honours CUT. Safe to call once per material. */
export function patchCut(m: THREE.Material) {
  if ((m as { userData: Record<string, unknown> }).userData.cut) return;
  m.userData.cut = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, CUT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\nvCutW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n#else\nvCutW = (modelMatrix * vec4(transformed, 1.0)).xyz;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutW;\nuniform float uCutOn; uniform vec3 uCutCam; uniform vec3 uCutCenter; uniform float uCutY; uniform float uCutTop;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
if (uCutOn > 0.0) {
  vec2 dp = vCutW.xz - uCutCenter.xz;
  vec2 dc = uCutCam.xz - uCutCenter.xz;
  float side = dot(normalize(dp + 1e-4), normalize(dc + 1e-4));
  vec2 q = floor(gl_FragCoord.xy / 2.0);
  float th = fract(dot(q, vec2(0.5, 0.25)) + 0.125 * mod(q.x, 2.0));
  float k = smoothstep(-0.05, 0.35, side) * smoothstep(uCutY, uCutY + 0.25, vCutW.y) * uCutOn;
  if (vCutW.y > uCutTop) k = 1.0;
  if (k > th + 0.02) discard;
}`);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|cut';
}

// ------------------------------------------------------------------ voxel crowns

/** A blocky leaf volume: unions of rough ellipsoids on a grid, emitted as cubes with hidden faces dropped. */
export class Crown {
  private set = new Set<number>();
  cells: [number, number, number][] = [];
  constructor(public cell: number) {}
  private key(i: number, j: number, k: number) { return (i + 128) | ((j + 128) << 8) | ((k + 128) << 16); }
  has(i: number, j: number, k: number) { return this.set.has(this.key(i, j, k)); }
  add(i: number, j: number, k: number) { const key = this.key(i, j, k); if (!this.set.has(key)) { this.set.add(key); this.cells.push([i, j, k]); } }
  /** fill a rough ellipsoid (px); `cut` trims the underside (0 keeps it whole) */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, seed: number, rough = 0.4, cut = 0.45) {
    const c = this.cell;
    for (let i = Math.floor((cx - rx) / c); i <= Math.ceil((cx + rx) / c); i++)
      for (let j = Math.floor((cy - ry) / c); j <= Math.ceil((cy + ry) / c); j++)
        for (let k = Math.floor((cz - rz) / c); k <= Math.ceil((cz + rz) / c); k++) {
          const x = (i + 0.5) * c - cx, y = (j + 0.5) * c - cy, z = (k + 0.5) * c - cz;
          if (y < -ry * (1 - cut)) continue;
          const d = (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2;
          if (d + (hash(i, j, k, seed) - 0.5) * rough * 2 < 1) this.add(i, j, k);
        }
    return this;
  }
  /** clear cells where `test` says so (keeps the dollhouse cut and windows clear) */
  carve(test: (x: number, y: number, z: number) => boolean) {
    const c = this.cell;
    this.cells = this.cells.filter(([i, j, k]) => { const hit = test((i + 0.5) * c, (j + 0.5) * c, (k + 0.5) * c); if (hit) this.set.delete(this.key(i, j, k)); return !hit; });
  }
  emit(mats: Painter[], sway: number, out: BoxSpec[], seed: number, tufts = 0.3, strands?: Painter) {
    const c = this.cell;
    const dirs: [number, number, number, string][] = [[1, 0, 0, 'e'], [-1, 0, 0, 'w'], [0, 1, 0, 'u'], [0, -1, 0, 'd'], [0, 0, 1, 's'], [0, 0, -1, 'n']];
    for (const [i, j, k] of this.cells) {
      let skip = '';
      for (const [dx, dy, dz, f] of dirs) if (this.has(i + dx, j + dy, k + dz)) skip += f;
      if (skip.length === 6) continue;
      const mat = mats[Math.floor(hash(i, j, k, seed + 11) * mats.length)];
      const x = (i + 0.5) * c, y = j * c, z = (k + 0.5) * c;
      out.push(box(x, y, z, c, c, c, mat, { sway, skip }));
      if (hash(i, j, k, seed + 12) < tufts) {
        const open = dirs.filter((d) => d[3] !== 'd' && !skip.includes(d[3]));
        if (open.length) {
          const [dx, dy, dz] = open[Math.floor(hash(i, j, k, seed + 13) * open.length)];
          const s = Math.max(3, Math.round(c * (0.38 + hash(i, j, k, seed + 14) * 0.26)));
          const off = (c + s) / 2 - 0.5, jx = (hash(i, j, k, seed + 15) - 0.5) * (c - s), jz = (hash(i, j, k, seed + 16) - 0.5) * (c - s);
          out.push(box(x + dx * off + (dx ? 0 : jx), y + c / 2 - s / 2 + dy * off + (dy ? 0 : jx * 0.5), z + dz * off + (dz ? 0 : jz), s, s, s, mat, { sway: sway * 1.3 }));
        }
      }
      if (strands && !skip.includes('d') && hash(i, j, k, seed + 17) < 0.22) {
        const len = 4 + Math.floor(hash(i, j, k, seed + 18) * 14);
        out.push(box(x + (hash(i, j, k, seed + 19) - 0.5) * (c - 2), y - len, z + (hash(i, j, k, seed + 20) - 0.5) * (c - 2), 2, len + 1, 1, strands, { sway: sway * 2.5, skip: 'u' }));
      }
    }
  }
}

/** Rows of axis-aligned boxes approximating a ring (rIn = 0 for a disc) in the x/y plane at depth z. */
export function ringXY(cx: number, cy: number, z: number, rOut: number, rIn: number, depth: number, mat: Painter, row = 2, o: Partial<BoxSpec> = {}): BoxSpec[] {
  const out: BoxSpec[] = [];
  for (let y = -rOut; y < rOut; y += row) {
    const yc = y + row / 2;
    const xo = Math.sqrt(Math.max(0, rOut * rOut - yc * yc));
    if (xo < 0.5) continue;
    const xi = rIn > 0 && Math.abs(yc) < rIn ? Math.sqrt(rIn * rIn - yc * yc) : 0;
    if (xi > 0) {
      if (xo - xi > 0.3) out.push(box(cx - (xo + xi) / 2, cy + y, z, xo - xi, row, depth, mat, o), box(cx + (xo + xi) / 2, cy + y, z, xo - xi, row, depth, mat, o));
    } else out.push(box(cx, cy + y, z, xo * 2, row, depth, mat, o));
  }
  return out;
}

/** Strips of a disc (radius r) on the x/z plane from y0 to y1, with square holes [cx, cz, half]. */
export function discStrips(r: number, y0: number, y1: number, mat: Painter, holes: [number, number, number][] = [], strip = 4, o: Partial<BoxSpec> = {}): BoxSpec[] {
  const out: BoxSpec[] = [];
  for (let z = -r; z < r; z += strip) {
    const zc = z + strip / 2, w = 2 * Math.sqrt(Math.max(0, r * r - zc * zc));
    if (w < 2) continue;
    let spans: [number, number][] = [[-w / 2, w / 2]];
    for (const [hx, hz, hh] of holes) {
      if (zc < hz - hh || zc > hz + hh) continue;
      spans = spans.flatMap(([a, b]): [number, number][] => (hx + hh <= a || hx - hh >= b ? [[a, b]] : [[a, Math.max(a, hx - hh)], [Math.min(b, hx + hh), b]])).filter(([a, b]) => b - a > 0.5);
    }
    for (const [a, b] of spans) out.push(box((a + b) / 2, y0, zc, b - a, y1 - y0, strip, mat, o));
  }
  return out;
}
