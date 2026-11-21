// [world] 2D pixel-art leaf cards. A hand-painted atlas of leaf clusters (oak, birch, pine needles,
// maple, cherry blossom, shrub sprigs with berries or flowers, dry winter twigs) is scattered as
// crossed, alpha-tested quads over every tree's leaf masses, so the voxel crowns get fluffy, broken
// silhouettes with real depth: cards deep inside or under a mass are shaded darker, the sun side is
// bright, leaves glow when backlit, and every card sways with the same wind as the voxel crown
// (plus its own flutter). Seasons retint, thin or swap the cards; snow settles on their top edges.
import * as THREE from 'three';
import { wind } from '../gfx/box.ts';
import { rng } from '../gfx/noise.ts';
import type { LeafKind } from '../assets/nature.ts';
import type { KitShape } from './forestkit.ts';
import { GRASS } from './grass.ts';
import { WX } from './weather.ts';

// ---------------------------------------------------------------- the atlas

const CS = 32, COLS = 8, ROWS = 2, AW = CS * COLS, AH = CS * ROWS;
/** Cell ids in the atlas. */
export const CELL = { oakA: 0, oakB: 1, oakC: 2, birchA: 3, birchB: 4, pineA: 5, pineB: 6, pineC: 7, mapleA: 8, mapleB: 9, blossomA: 10, blossomB: 11, sprig: 12, berry: 13, flower: 14, dry: 15 } as const;
// shade levels (red channel) and materials (green channel)
const OUT = 46, DARK = 100, MID = 160, LIGHT = 215, HI = 250;
const LEAF = 0, ACCENT = 80, WOOD = 160, EYE = 240;

type Prof = (u: number) => number;
const PROF: Record<'oak' | 'birch' | 'round' | 'dry', Prof> = {
  oak: (u) => Math.pow(Math.sin(Math.PI * u), 0.55) * (0.72 + 0.28 * Math.cos(u * Math.PI * 2 * 3.1 + 0.6)),
  birch: (u) => Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.08)), 0.75) * (1 - 0.28 * u),
  round: (u) => Math.pow(Math.sin(Math.PI * u), 0.5),
  dry: (u) => Math.pow(Math.sin(Math.PI * u), 0.6) * (0.6 + 0.4 * Math.cos(u * 9)),
};

class Painter2D {
  readonly data: Uint8Array<ArrayBuffer> = new Uint8Array(AW * AH * 4);
  private ox = 0; private oy = 0;
  cell(i: number) { this.ox = (i % COLS) * CS; this.oy = Math.floor(i / COLS) * CS; }
  put(x: number, y: number, level: number, mat: number) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 1 || y < 1 || x >= CS - 1 || y >= CS - 1) return;
    const k = ((this.oy + y) * AW + this.ox + x) * 4;
    this.data[k] = level; this.data[k + 1] = mat; this.data[k + 2] = 0; this.data[k + 3] = 255;
  }
  /** Paint a shape given as a mask function, with a dark outline, a lit upper side and optional veins. */
  shape(cx: number, cy: number, R: number, inside: (dx: number, dy: number) => boolean, shade: (dx: number, dy: number) => number, mat: number) {
    const pts: [number, number][] = [], set = new Set<number>();
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      if (inside(x + 0.5 - cx, y + 0.5 - cy)) { pts.push([x, y]); set.add(y * 1000 + x); }
    }
    for (const [x, y] of pts) {
      const edge = !set.has(y * 1000 + x + 1) || !set.has(y * 1000 + x - 1) || !set.has((y + 1) * 1000 + x) || !set.has((y - 1) * 1000 + x);
      this.put(x, y, edge ? OUT : shade(x + 0.5 - cx, y + 0.5 - cy), mat);
    }
  }
  /** A leaf from its base at (x, y) pointing along `ang` (y is up). */
  leaf(x: number, y: number, ang: number, len: number, wid: number, prof: Prof, vein = true, mat = LEAF) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const lightSide = Math.sign(ca * 0.6 + 0.4 * -sa) || 1; // which half faces up-left
    const uv = (dx: number, dy: number) => [(dx * ca + dy * sa) / len, (-dx * sa + dy * ca) / wid];
    this.shape(x, y, len + wid, (dx, dy) => { const [u, v] = uv(dx, dy); return u >= 0 && u <= 1 && Math.abs(v) <= 0.5 * prof(u); },
      (dx, dy) => {
        const [u, v] = uv(dx, dy);
        if (vein && Math.abs(v) < 0.09 && u > 0.1 && u < 0.82) return DARK;
        if (u < 0.14) return DARK;
        const lit = v * lightSide > 0.06;
        if (lit && u > 0.45 && u < 0.75 && Math.abs(v) > 0.18 && Math.abs(v) < 0.3) return HI;
        return lit ? LIGHT : MID;
      }, mat);
  }
  /** Palmate leaf (maple) or five-petal flower. */
  star(cx: number, cy: number, R: number, rot: number, lobes: number, sharp: number, mat: number, veins = true) {
    const rr = (th: number) => R * (0.48 + 0.52 * Math.pow(Math.abs(Math.cos((th - rot) * lobes / 2)), sharp));
    this.shape(cx, cy, R + 1, (dx, dy) => Math.hypot(dx, dy) <= rr(Math.atan2(dy, dx)),
      (dx, dy) => {
        const th = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
        if (veins && d > 0.8 && Math.abs(Math.sin((th - rot) * lobes / 2)) < 0.12) return DARK;
        if (d < 1.1) return mat === LEAF ? DARK : MID;
        return dy > 0.3 ? (d < R * 0.55 ? HI : LIGHT) : MID;
      }, mat);
  }
  line(x0: number, y0: number, x1: number, y1: number, level: number, mat: number) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= n; i++) this.put(x0 + ((x1 - x0) * i) / Math.max(1, n), y0 + ((y1 - y0) * i) / Math.max(1, n), level, mat);
  }
  /** A pine twig with needle pairs along it. */
  spray(x: number, y: number, ang: number, len: number, r: () => number) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let s = 1; s < len; s += 1) {
      const px = x + ca * s, py = y + sa * s, nl = 3 + Math.floor(r() * 2.5) - (s > len - 3 ? 1 : 0);
      for (const side of [-1, 1]) {
        const a2 = ang + side * 0.85;
        const lv = side * (ca >= 0 ? 1 : -1) > 0 ? (s % 2 ? LIGHT : HI) : (s % 2 ? MID : DARK);
        for (let k = 1; k <= nl; k++) this.put(px + Math.cos(a2) * k, py + Math.sin(a2) * k, k === nl ? OUT + 20 : lv, LEAF);
      }
    }
    this.line(x, y, x + ca * len, y + sa * len, DARK, WOOD);
  }
  dot(x: number, y: number, r: number, mat: number) {
    this.shape(x, y, r + 1, (dx, dy) => Math.hypot(dx, dy) <= r, (dx, dy) => (dx < -0.2 && dy > 0.2 ? HI : dy > -0.3 ? LIGHT : MID), mat);
  }
}

/** Paint the leaf atlas (red: shade level, green: material, alpha: coverage). Deterministic. */
export function paintLeafAtlas(): Uint8Array<ArrayBuffer> {
  const p = new Painter2D(), r = rng(9071);
  const C = 16;
  const rosette = (n: number, len: [number, number], wid: number, prof: Prof, spread = 3) => {
    const a0 = r() * Math.PI * 2;
    const order = Array.from({ length: n }, (_, i) => i).sort(() => r() - 0.5);
    for (const i of order) {
      const a = a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5, d = r() * spread;
      const l = len[0] + r() * (len[1] - len[0]);
      p.leaf(C + Math.cos(a) * d, C + Math.sin(a) * d - 1, a, l, wid * (0.85 + r() * 0.3), prof);
    }
  };
  // oak: wavy lobed leaves in a rosette around a twig
  for (const [cell, n, len] of [[CELL.oakA, 8, [10, 12.5]], [CELL.oakB, 9, [9, 12]], [CELL.oakC, 7, [8, 10]]] as const) {
    p.cell(cell); p.line(C, 3, C, C - 2, DARK, WOOD); rosette(n, len as unknown as [number, number], 6.4, PROF.oak);
  }
  // birch: lots of small pointed leaves; B dangles a few catkins
  p.cell(CELL.birchA); p.line(C - 6, 6, C + 3, C, DARK, WOOD); rosette(12, [6, 8], 4.4, PROF.birch, 5);
  p.cell(CELL.birchB); rosette(10, [6, 7.5], 4.2, PROF.birch, 5);
  for (const x of [C - 5, C + 2, C + 7]) for (let k = 0; k < 5; k++) p.put(x + (k > 2 ? 1 : 0), C - 4 - k, k === 4 ? DARK : k % 2 ? MID : LIGHT, ACCENT);
  // pine: needle sprays fanning out and drooping
  p.cell(CELL.pineA); for (const a of [-0.35, 0.5, 1.6, 2.6, 3.5]) p.spray(C, C, a, 11, r);
  p.cell(CELL.pineB); for (const a of [-0.15, 3.3, 1.2]) p.spray(C, C - 2, a, 14, r); p.spray(C - 4, C + 2, 0.4, 9, r);
  p.cell(CELL.pineC); for (const a of [-0.6, -0.1, 0.4, 2.7, 3.2, 3.8]) p.spray(C, C + 3, a, 12, r);
  // maple: palmate leaves on stalks
  for (const cell of [CELL.mapleA, CELL.mapleB]) {
    p.cell(cell);
    const n = cell === CELL.mapleA ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.6, d = 4 + r() * 3, x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
      p.line(C, C - 2, x, y, DARK, WOOD);
      p.star(x, y, 6 + r() * 1.5, Math.PI / 2 + (r() - 0.5) * 0.6, 5, 2.4, LEAF);
    }
  }
  // cherry blossom: a few leaves behind sprays of five-petal flowers
  p.cell(CELL.blossomA); rosette(5, [7, 9], 4.6, PROF.birch, 4);
  for (let i = 0; i < 4; i++) { const a = r() * Math.PI * 2, d = 2 + r() * 6, x = C + Math.cos(a) * d, y = C + Math.sin(a) * d; p.star(x, y, 3.6, r() * 6, 5, 0.8, ACCENT, false); p.put(x, y, MID, EYE); }
  p.cell(CELL.blossomB); rosette(3, [7, 8], 4.4, PROF.birch, 3);
  for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = 1 + r() * 8, x = C + Math.cos(a) * d, y = C + Math.sin(a) * d; p.star(x, y, 3.2, r() * 6, 5, 0.8, ACCENT, false); p.put(x, y, MID, EYE); }
  // shrub sprigs: small rounded leaves; with berries; with little flowers
  for (const cell of [CELL.sprig, CELL.berry, CELL.flower]) {
    p.cell(cell); rosette(12, [5.5, 7.5], 4.6, PROF.round, 5);
    if (cell === CELL.berry) for (let i = 0; i < 6; i++) p.dot(C + (r() - 0.5) * 16, C + (r() - 0.5) * 14, 1.6, ACCENT);
    if (cell === CELL.flower) for (let i = 0; i < 5; i++) { const x = C + (r() - 0.5) * 16, y = C + (r() - 0.5) * 14; p.star(x, y, 2.7, r() * 6, 5, 0.8, ACCENT, false); p.put(x, y, MID, EYE); }
  }
  // winter: bare twigs with a couple of curled brown leaves hanging on
  p.cell(CELL.dry);
  p.line(4, 6, C, C, DARK, WOOD); p.line(C, C, 27, 25, DARK, WOOD); p.line(C, C, 9, 26, DARK, WOOD); p.line(C + 5, C + 4, 26, 12, DARK, WOOD);
  p.leaf(C + 4, C - 1, -0.9, 8, 4.5, PROF.dry); p.leaf(10, 23, 2.2, 7, 4, PROF.dry);
  return p.data;
}

/** Accent colours per cell (petals, berries, catkins). */
// [world3] calm palette: straw catkins, rose and blush petals, berry red, paper-white blossom
const ACCENTS: Record<number, number> = { [CELL.birchB]: 0xb9b07a, [CELL.blossomA]: 0xe8bcb8, [CELL.blossomB]: 0xf1d4cf, [CELL.berry]: 0xa8505c, [CELL.flower]: 0xf4eedd };

/** Which cells each leaf kind draws from. */
export const CELLS: Record<LeafKind, number[]> = {
  oak: [CELL.oakA, CELL.oakB, CELL.oakC], birch: [CELL.birchA, CELL.birchA, CELL.birchB], pine: [CELL.pineA, CELL.pineB, CELL.pineC],
  maple: [CELL.mapleA, CELL.mapleB], blossom: [CELL.blossomA, CELL.blossomB, CELL.birchA], bush: [CELL.sprig], berry: [CELL.sprig, CELL.berry], flowerbush: [CELL.sprig, CELL.flower],
};
const SIZE: Record<LeafKind, [number, number]> = { oak: [11, 15], birch: [9, 12], pine: [12, 16], maple: [11, 15], blossom: [10, 13], bush: [7, 10], berry: [7, 10], flowerbush: [7, 10] };

// ---------------------------------------------------------------- the cards

const VS = /* glsl */ `
attribute vec3 iPos; attribute vec4 iRot; attribute vec4 iCol; attribute vec3 iNor; attribute vec4 iBase;
uniform float uTime; uniform vec3 uWind;
varying vec2 vUv; varying vec2 vLocal; varying vec3 vCol; varying float vAo; varying vec3 vN; varying vec3 vW; varying float vCell;
#include <fog_pars_vertex>
void main() {
  vec3 p = position * iRot.z;
  // per-card flutter: a little extra tilt that comes and goes with the wind
  float fl = sin(uTime * 3.3 + iBase.w * 40.0 + iPos.x * 2.0) * 0.12 * (0.3 + uWind.z * 6.0);
  float tilt = iRot.y + fl;
  float ct = cos(tilt), st = sin(tilt);
  p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
  float cy = cos(iRot.x), sy = sin(iRot.x);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  // the same sway as the voxel crown (see WIND_MAIN in gfx/box.ts), so cards stay on their branch
  float swPh = dot(iBase.xy, vec2(0.37, 0.29)) + iBase.z * 0.6;
  float swG = sin(uTime * 1.35 + swPh) * 0.55 + sin(uTime * 2.8 + swPh * 2.1) * 0.22 + sin(uTime * 0.43 + swPh * 0.33) * 0.5;
  float aS = fract(iBase.w) * 2.0;
  vec3 swOff = vec3(uWind.x * swG, -0.25 * abs(swG), uWind.y * swG) * (uWind.z * aS);
  vec3 w = iPos + p + swOff;
  float cell = iRot.w;
  vCell = cell;
  vec2 c = vec2(mod(cell, ${COLS.toFixed(1)}), floor(cell / ${COLS.toFixed(1)}));
  vUv = (c + uv) / vec2(${COLS.toFixed(1)}, ${ROWS.toFixed(1)});
  vLocal = uv;
  vCol = iCol.rgb; vAo = iCol.a; vN = iNor; vW = w;
  vec4 mvPosition = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FS = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uKey; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uSunDir;
uniform vec3 uAccent[16]; uniform float uSnow; uniform float uWet;
varying vec2 vUv; varying vec2 vLocal; varying vec3 vCol; varying float vAo; varying vec3 vN; varying vec3 vW; varying float vCell;
#include <fog_pars_fragment>
vec3 rampC(vec3 t, float L) {
  if (L < 0.27) return t * vec3(0.3, 0.34, 0.42) + vec3(0.02, 0.025, 0.035);
  if (L < 0.5) return t * vec3(0.62, 0.67, 0.74);
  if (L < 0.74) return t;
  if (L < 0.93) return t * 1.22 + vec3(0.035, 0.03, 0.0);
  return t * 1.42 + vec3(0.08, 0.07, 0.03);
}
void main() {
  vec4 tx = texture2D(uMap, vUv);
  if (tx.a < 0.5) discard;
  float L = tx.r, m = tx.g;
  vec3 base;
  if (m < 0.15) base = rampC(vCol, L);
  else if (m < 0.47) base = rampC(uAccent[int(vCell + 0.5)], L);
  else if (m < 0.78) base = rampC(vec3(0.27, 0.22, 0.18), L + 0.2);
  else base = vec3(0.86, 0.69, 0.45);
  vec3 N = normalize(vN);
  float ndl = max(dot(N, uSunDir), 0.0);
  vec3 amb = mix(uGround, uSky, N.y * 0.5 + 0.5) * 0.78;
  vec3 lit = (amb + uKey * (0.18 + 0.8 * ndl)) * vAo;
  float back = pow(max(dot(normalize(vW - cameraPosition), uSunDir), 0.0), 4.0);
  lit += uKey * back * 0.4 * vAo;
  vec3 col = base * lit * (1.0 - uWet * 0.12);
  // snow settles on the top edge of every leaf facing the sky
  if (uSnow > 0.02 && N.y > 0.0) {
    float t1 = vLocal.y + 1.0 / ${CS.toFixed(1)} < 1.0 ? texture2D(uMap, vUv + vec2(0.0, 1.0 / ${AH.toFixed(1)})).a : 0.0;
    float t2 = vLocal.y + 2.0 / ${CS.toFixed(1)} < 1.0 ? texture2D(uMap, vUv + vec2(0.0, 2.0 / ${AH.toFixed(1)})).a : 0.0;
    float edge = t1 < 0.5 ? 1.0 : (t2 < 0.5 ? 0.6 : 0.0);
    float k = edge * smoothstep(0.0, 0.5, N.y + 0.2) * step(0.35, uSnow + fract(sin(dot(floor(vW * 16.0), vec3(12.99, 78.23, 37.7))) * 43758.5) * 0.4);
    col = mix(col, vec3(0.93, 0.96, 1.0) * (amb * 1.1 + uKey * 0.6), clamp(k, 0.0, 1.0));
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

let atlasTex: THREE.DataTexture | null = null;
function atlas(): THREE.DataTexture {
  if (atlasTex) return atlasTex;
  const t = new THREE.DataTexture(paintLeafAtlas(), AW, AH, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return (atlasTex = t);
}

/** [world3] a plant's leaf masses (model units, 16 = 1 block) come from the lowpix kit (forestkit.ts) */
export interface CardSource { kind: string; model: KitShape; spots: { x: number; y: number; z: number; yaw: number; s: number }[] }
/** What a season does to one plant's cards. */
export interface CardLook { tint: number; keep: number; cells?: number[]; dry?: number }

interface Bin {
  mesh: THREE.Mesh; geo: THREE.InstancedBufferGeometry;
  rot: Float32Array; col: Float32Array;
  src: Uint16Array; inst: Uint16Array; rand: Float32Array; size: Float32Array; cellPick: Float32Array; ao: Float32Array;
}

export class Foliage {
  readonly group = new THREE.Group();
  readonly mat: THREE.ShaderMaterial;
  private bins: Bin[] = [];
  private sources: CardSource[];
  count = 0;

  constructor(sources: CardSource[], quality: 'low' | 'high', cellSize = 12) {
    this.sources = sources;
    const accents = Array.from({ length: 16 }, (_, i) => new THREE.Color(ACCENTS[i] ?? 0xffffff));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, side: THREE.DoubleSide, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uAccent: { value: accents } }]),
    });
    Object.assign(this.mat.uniforms, { uMap: { value: atlas() }, uTime: wind.uTime, uWind: wind.uWind, uKey: GRASS.uKey, uSky: GRASS.uSky, uGround: GRASS.uGround, uSunDir: GRASS.uSunDir, uSnow: WX.uSnow, uWet: WX.uWet });

    // card geometry: two crossed unit quads
    const P = [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0, 0, -0.5, -0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 0, 0.5, -0.5];
    const U = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
    const I = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];

    // generate every card in model space once per plant kind, then place it for each instance
    const density = quality === 'high' ? 1 : 0.5;
    type Card = { src: number; inst: number; x: number; y: number; z: number; nx: number; ny: number; nz: number; yaw: number; tilt: number; size: number; ao: number; rand: number; pick: number; bx: number; bz: number; ly: number; sw: number };
    const all: Card[] = [];
    sources.forEach((s, si) => {
      const m = s.model, r = rng(1301 + si * 17);
      const sz = SIZE[m.leaf];
      const local: Omit<Card, 'src' | 'inst' | 'bx' | 'bz'>[] = [];
      for (const b of m.blobs) {
        const area = (4 * Math.PI * ((b.rx * b.ry + b.rx * b.rz + b.ry * b.rz) / 3)) / 256;
        const per = m.leaf === 'pine' ? 6.5 : m.leaf === 'bush' || m.leaf === 'berry' || m.leaf === 'flowerbush' ? 9 : 7.5;
        const n = Math.max(3, Math.round(area * per * density));
        for (let i = 0; i < n; i++) {
          let ux = 0, uy = 0, uz = 0;
          do { ux = r() * 2 - 1; uy = r() * 2 - 1; uz = r() * 2 - 1; } while (ux * ux + uy * uy + uz * uz > 1 || ux * ux + uy * uy + uz * uz < 0.05);
          const l = Math.hypot(ux, uy, uz); ux /= l; uy /= l; uz /= l;
          if (m.leaf === 'pine') { uy *= 0.45; const l2 = Math.hypot(ux, uy, uz); ux /= l2; uy /= l2; uz /= l2; }
          else if (uy < -0.55 && r() < 0.7) uy = -uy * 0.5;
          const inner = r() < 0.22, k = inner ? 0.45 + r() * 0.35 : 0.86 + r() * 0.24;
          const x = b.x + ux * b.rx * k, y = b.y + uy * b.ry * k, z = b.z + uz * b.rz * k;
          let nx = ux / b.rx, ny = uy / b.ry + 0.012, nz = uz / b.rz;
          const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
          const ao = Math.max(0.42, Math.min(1, 0.5 + (k - 0.45) * 0.62 + uy * 0.16 + (y / m.top) * 0.12));
          const sw = m.sway * Math.pow(Math.max(0, Math.min(1, y / m.top)), 1.4);
          local.push({ x, y, z, nx, ny, nz, yaw: r() * Math.PI, tilt: m.leaf === 'pine' ? (r() - 0.5) * 1.1 - uy * 0.4 : (r() - 0.5) * 1.2, size: sz[0] + r() * (sz[1] - sz[0]), ao, rand: r(), pick: r(), ly: y / 16, sw });
        }
      }
      s.spots.forEach((sp, inst) => {
        const c = Math.cos(sp.yaw), sn = Math.sin(sp.yaw), sc = sp.s / 16;
        for (const L of local) {
          // instance rotation about y matches THREE's Quaternion.setFromAxisAngle(up, yaw)
          const wx = sp.x + (L.x * c + L.z * sn) * sc, wz = sp.z + (-L.x * sn + L.z * c) * sc, wy = sp.y + L.y * sc;
          all.push({ ...L, src: si, inst, x: wx, y: wy, z: wz, nx: L.nx * c + L.nz * sn, nz: -L.nx * sn + L.nz * c, yaw: L.yaw + sp.yaw, size: L.size * sc, bx: sp.x, bz: sp.z });
        }
      });
    });
    this.count = all.length;

    // bin by area so the renderer can cull what's off screen
    const bins = new Map<string, Card[]>();
    for (const cd of all) {
      const key = `${Math.floor(cd.x / cellSize)},${Math.floor(cd.z / cellSize)}`;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key)!.push(cd);
    }
    for (const list of bins.values()) {
      const n = list.length, g = new THREE.InstancedBufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
      g.setIndex(I);
      const pos = new Float32Array(n * 3), rot = new Float32Array(n * 4), col = new Float32Array(n * 4), nor = new Float32Array(n * 3), base = new Float32Array(n * 4);
      const bin: Bin = { mesh: null as unknown as THREE.Mesh, geo: g, rot, col, src: new Uint16Array(n), inst: new Uint16Array(n), rand: new Float32Array(n), size: new Float32Array(n), cellPick: new Float32Array(n), ao: new Float32Array(n) };
      const box = new THREE.Box3(), v = new THREE.Vector3();
      list.forEach((cd, i) => {
        pos.set([cd.x, cd.y, cd.z], i * 3);
        rot.set([cd.yaw, cd.tilt, cd.size, 0], i * 4);
        col.set([1, 1, 1, cd.ao], i * 4);
        nor.set([cd.nx, cd.ny, cd.nz], i * 3);
        // w packs a per-card random (integer part) and the sway weight (fraction, halved)
        base.set([cd.bx, cd.bz, cd.ly, Math.floor(cd.rand * 1000) + Math.min(0.999, cd.sw / 2)], i * 4);
        bin.src[i] = cd.src; bin.inst[i] = cd.inst; bin.rand[i] = cd.rand; bin.size[i] = cd.size; bin.cellPick[i] = cd.pick; bin.ao[i] = cd.ao;
        box.expandByPoint(v.set(cd.x, cd.y, cd.z));
      });
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
      g.setAttribute('iRot', new THREE.InstancedBufferAttribute(rot, 4));
      g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 4));
      g.setAttribute('iNor', new THREE.InstancedBufferAttribute(nor, 3));
      g.setAttribute('iBase', new THREE.InstancedBufferAttribute(base, 4));
      g.instanceCount = n;
      box.expandByScalar(1.2);
      g.boundingBox = box;
      g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
      const mesh = new THREE.Mesh(g, this.mat);
      mesh.name = 'leafcards';
      bin.mesh = mesh;
      this.group.add(mesh);
      this.bins.push(bin);
    }
  }

  /** Retint, thin out or swap cards for the season. `look(source, instance)` decides per plant. */
  setSeason(look: (src: number, inst: number) => CardLook) {
    const c = new THREE.Color(), cache = new Map<number, CardLook>();
    for (const b of this.bins) {
      const n = b.src.length;
      for (let i = 0; i < n; i++) {
        const key = b.src[i] * 65536 + b.inst[i];
        let L = cache.get(key);
        if (!L) { L = look(b.src[i], b.inst[i]); cache.set(key, L); }
        const r = b.rand[i];
        const shown = r < L.keep, dry = !shown && L.dry !== undefined && r < L.keep + (L.dry ? 0.12 : 0);
        const cells = dry ? [CELL.dry] : L.cells ?? CELLS[this.sources[b.src[i]].model.leaf];
        b.rot[i * 4 + 2] = shown || dry ? b.size[i] : 0;
        b.rot[i * 4 + 3] = cells[Math.floor(b.cellPick[i] * cells.length) % cells.length];
        c.setHex(dry ? L.dry! : L.tint);
        // a little per-card variation keeps big crowns from looking flat
        const j = 0.9 + ((r * 7919) % 1) * 0.2;
        b.col[i * 4] = c.r * j; b.col[i * 4 + 1] = c.g * j; b.col[i * 4 + 2] = c.b * (0.95 + ((r * 104729) % 1) * 0.1);
      }
      (b.geo.attributes.iRot as THREE.InstancedBufferAttribute).needsUpdate = true;
      (b.geo.attributes.iCol as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  }

  dispose() { for (const b of this.bins) b.geo.dispose(); this.mat.dispose(); }
}
