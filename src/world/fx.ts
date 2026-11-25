// Particles living in the 3D world, made to look real: leaves, petals, feathers, gold-leaf flakes, coins, paper and
// wood shavings are small hand-painted pixel-art cards that tumble through the air in 3D and take the scene's own sun
// or moon (lit on the side facing the light, glowing through when the light is behind them, metal flashing as it
// turns), then lie flat where they land; puffs of dust and breath, rain splashes, snow crystals and moths are lit
// pixel sprites facing the camera; and every light (golden motes, glints, embers, fireflies, dream motes, a breath of
// light, a ring of light) is a soft additive glow drawn in high dynamic range, so the bloom picks it up. Light comes
// from the scene's strongest directional light (found once a second while drawing), so day, dusk, night and the
// lamplit stages all match. Cheap: two instanced draws per scene, pooled, capped by tier.
//   fx.burst(kind, x, y, z, n, colour?)    presets (BurstKind)
//   fx.emit({...})                         one particle (sprites by SPR name)
//   sceneFx.burst(kind, at), sceneFx.cue(kind, actor, at, r)   from anywhere: the scene that draws `actor`
// [fx10] No cartoon shapes any more: the old heart, note, Zzz, "!" and "?" sprites are drawn as warm motes and glints.
import * as THREE from 'three';
import { surfaceY } from './terrain.ts';
import { bayer, coinFrames, flatTone, hash, outline, paintPx, puffFrames, shavingFrames, snowFrames, tidy, type Raster } from '../ui/fx/pixel.ts';

// ---------------------------------------------------------------- the sprites

/** how a sprite is drawn: a pixel card facing the camera (lit), a pixel card tumbling in 3D (lit), or a soft light */
type Mode = 'card' | 'tumble' | 'glow';
/** glow shapes: a mote, a glint (cross flare), an ember, an orb, a breath of light, a ring of light */
const G = { mote: 0, glint: 1, ember: 2, orb: 3, breath: 4, ring: 5 } as const;
interface Look { mode: Mode; cell?: string; frames?: number; start?: number; shape?: number; warm?: number; cool?: number; spin?: [number, number]; metal?: boolean }

// the names callers use (kept from the old sprite sheet) and what each is now
const LOOKS = {
  leaf1: { mode: 'tumble', cell: 'leaf', spin: [2.4, 5] }, leaf2: { mode: 'tumble', cell: 'leafOak', spin: [2.4, 5] }, leaf3: { mode: 'tumble', cell: 'leafWillow', spin: [3, 6] },
  petal: { mode: 'tumble', cell: 'petal', spin: [3, 6.5] },
  mote: { mode: 'glow', shape: G.mote },
  spark1: { mode: 'glow', shape: G.glint }, spark2: { mode: 'glow', shape: G.glint }, spark3: { mode: 'glow', shape: G.glint },
  heart: { mode: 'glow', shape: G.mote, warm: 0.5 }, // a rose-gold mote
  note: { mode: 'glow', shape: G.glint, warm: 0.3 }, // a musical shimmer
  star: { mode: 'glow', shape: G.glint }, zed: { mode: 'glow', shape: G.mote, cool: 0.6 }, // a dream mote
  puff1: { mode: 'card', cell: 'puff', frames: 3 }, puff2: { mode: 'card', cell: 'puff', frames: 3, start: 1 }, puff3: { mode: 'card', cell: 'puff', frames: 3, start: 2 },
  drop: { mode: 'card', cell: 'drop' },
  glow: { mode: 'glow', shape: G.mote },
  pixel: { mode: 'tumble', cell: 'flake', spin: [6, 12], metal: true },
  bang: { mode: 'glow', shape: G.glint }, ask: { mode: 'glow', shape: G.glint },
  ring: { mode: 'card', cell: 'ring' },
  coin: { mode: 'tumble', cell: 'coin', spin: [8, 13], metal: true },
  crumb: { mode: 'tumble', cell: 'shaving', spin: [5, 10] },
  streak: { mode: 'card', cell: 'seed' },
  dots: { mode: 'glow', shape: G.glint },
  flame1: { mode: 'glow', shape: G.ember }, flame2: { mode: 'glow', shape: G.ember },
  feather1: { mode: 'tumble', cell: 'feather', spin: [1.6, 3.4] }, feather2: { mode: 'tumble', cell: 'feather', spin: [1.6, 3.4] }, feather3: { mode: 'tumble', cell: 'feather', spin: [1.6, 3.4] },
  moon: { mode: 'glow', shape: G.glint }, bigstar: { mode: 'glow', shape: G.glint },
  splat1: { mode: 'card', cell: 'splat', frames: 3 }, splat2: { mode: 'card', cell: 'splat', frames: 3, start: 1 }, splat3: { mode: 'card', cell: 'splat', frames: 3, start: 2 },
  flake: { mode: 'card', cell: 'snow' },
  cloud: { mode: 'card', cell: 'puff', frames: 3 }, cloud2: { mode: 'card', cell: 'puff', frames: 3, start: 1 },
  swirl1: { mode: 'glow', shape: G.orb }, swirl2: { mode: 'glow', shape: G.orb }, orb: { mode: 'glow', shape: G.orb },
  diamond: { mode: 'glow', shape: G.glint },
  wisp: { mode: 'card', cell: 'wisp' }, wisp2: { mode: 'card', cell: 'wisp2' },
  moth1: { mode: 'card', cell: 'moth', frames: 2 }, moth2: { mode: 'card', cell: 'moth', frames: 2, start: 1 },
  ember: { mode: 'glow', shape: G.ember }, pollen: { mode: 'glow', shape: G.mote },
  // [fx10] new
  breath: { mode: 'glow', shape: G.breath }, lightring: { mode: 'glow', shape: G.ring },
  shaving: { mode: 'tumble', cell: 'shaving', spin: [4, 9] }, paper: { mode: 'tumble', cell: 'paper', spin: [2.5, 5] },
  ink: { mode: 'card', cell: 'drop' },
} satisfies Record<string, Look>;
const NAMES = Object.keys(LOOKS) as (keyof typeof LOOKS)[];
export const SPR = Object.fromEntries(NAMES.map((n, i) => [n, i])) as Record<keyof typeof LOOKS, number>;
const LOOK: Look[] = NAMES.map((n) => LOOKS[n]);

// ---- the atlas: 32 x 32 cells, read smooth (filtered) like the rest of the 3D world: the flat objects are drawn at the
// full cell size (fine veins, barbs and torn edges), the small pixel sprites (puffs, drops, moths) doubled.
// R: the value (albedo for tumbling cards, lit shade for cards facing the camera), G: 255 for paint, 0 for the edge,
// B: 255 for a glint, A: coverage. Shapes given as functions are drawn on a 16 grid.
const C = 32, COLS = 8;
type Cell = Raster | ((x: number, y: number) => { v: number; a?: number; o?: boolean } | null);
function cells(): Record<string, Cell[]> {
  const pf = puffFrames(), sn = snowFrames(), co = coinFrames();
  const water = (f: number) => (x: number, y: number) => {
    // a raindrop crown: a low splash, droplets thrown out, then a flattening ring
    const X = x - 7.5, Y = 13.5 - y;
    if (f === 0) return Y < 2.2 && Math.abs(X) < 2.6 - Y ? { v: 0.85 - Y * 0.15 } : Y < 4.5 && Y > 2 && (Math.abs(X) === 2.5 || Math.abs(X) === 0.5) && Y < 4 ? { v: 0.95 } : null;
    if (f === 1) return Y < 1.4 && Math.abs(X) < 3.6 ? { v: 0.7 } : (Y > 3 && Y < 5 && Math.abs(Math.abs(X) - 3.5) < 0.6) || (Y > 5 && Y < 7 && Math.abs(X) < 0.6) ? { v: 1 } : null;
    return Y < 1.2 && Math.abs(X) < 5 && Math.abs(X) > 2.2 ? { v: 0.6, a: 0.8 } : null;
  };
  return {
    leaf: [flatTone('leaf', 32)], leafOak: [flatTone('leafOak', 32)], leafWillow: [flatTone('leafWillow', 32)], petal: [flatTone('petal', 30)],
    feather: [flatTone('feather', 32)], flake: [flatTone('flake', 20)], paper: [flatTone('paper', 24)], shaving: [shavingFrames()[1]],
    coin: [co[0]],
    puff: [pf[0], pf[2], pf[4]],
    snow: [sn[0]],
    drop: [outline(paintPx(6, 9, (x, y) => { const t = y + 1.6, rx = t > 0 ? 1.9 * Math.max(0, 1 - t / 4) : Math.sqrt(Math.max(0, 1 - (t / 2.1) ** 2)) * 2.1; return Math.abs(x) > rx ? null : x < -0.3 && x > -1.5 && t < -0.2 && t > -1.4 ? { s: 1, role: 3 } : { s: x < 0 ? 0.75 : 0.5 }; }))],
    splat: [water(0), water(1), water(2)],
    ring: [(x, y) => { const d = Math.hypot((x - 7.5) / 7, (y - 7.5) / 7); return Math.abs(d - 0.86) < 0.08 ? { v: 0.9 } : Math.abs(d - 0.7) < 0.05 ? { v: 0.6, a: 0.6 } : null; }],
    seed: [(x, y) => { const X = x - 7.5, Y = 8.5 - y; if (Math.abs(X) < 0.6 && Y < 0 && Y > -4) return { v: 0.55 }; const r = Math.hypot(X, Y - 1.5); return r < 3.2 && Y > 0.5 && bayer(x, y) < 0.7 ? { v: 0.95, a: r > 2.3 ? 0.55 : 0.9 } : null; }],
    wisp: [(x, y) => { const X = (x - 7.5) / 7.5, Y = (y - 7.5) / 3; const d = X * X + Y * Y * (1 + X * 0.6); return d < 1 && bayer(x, y) < (1 - d) * 1.2 ? { v: 0.9 - Y * 0.1, a: 0.5 } : null; }],
    wisp2: [(x, y) => { const X = (x - 7.5) / 7.5, Y = (y - 8.5 - X * 2) / 2.4; const d = X * X + Y * Y; return d < 1 && bayer(x + 1, y) < (1 - d) * 1.1 ? { v: 0.85, a: 0.45 } : null; }],
    moth: [0, 1].map((f) => outline(tidy(paintPx(13, 11, (x, y, ix, iy) => {
      const body = Math.abs(x) < 0.8 && y > -3 && y < 2.4;
      if (body) return { s: 0.45 + (y > 0 ? 0.15 : 0) };
      const span = f ? 3.6 : 5.6, wy = f ? 1.2 : 0.4;
      const fore = Math.abs(x) < span && y > -0.4 + Math.abs(x) * 0.08 && y < wy + 2.8 - Math.abs(x) * (f ? 0.3 : 0.35);
      const hind = Math.abs(x) < span * 0.7 && y < -0.2 && y > -3.2 + Math.abs(x) * 0.3;
      if (!fore && !hind) return null;
      return { s: 0.7 + (hash(ix, iy, 5) - 0.5) * 0.15 - (fore && Math.abs(x) > span * 0.6 ? 0.18 : 0) - (hind ? 0.1 : 0) };
    })))),
  };
}
let cellIndex: Record<string, number> = {};
function atlas(): THREE.DataTexture {
  const all = cells(), names = Object.keys(all);
  let n = 0;
  cellIndex = {};
  for (const k of names) { cellIndex[k] = n; n += all[k].length; }
  const ROWS = Math.ceil(n / COLS), W = COLS * C, H = ROWS * C, data = new Uint8Array(W * H * 4);
  names.forEach((k) => all[k].forEach((cell, f) => {
    const i = cellIndex[k] + f, cx = (i % COLS) * C, cy = Math.floor(i / COLS) * C;
    const put = (x: number, y: number, v: number, a: number, paint: boolean, glint: boolean) => {
      const o = ((cy + C - 1 - y) * W + cx + x) * 4;
      data[o] = Math.round(Math.max(0, Math.min(1, v)) * 255); data[o + 1] = paint ? 255 : 0; data[o + 2] = glint ? 255 : 0; data[o + 3] = Math.round(a * 255);
    };
    if (typeof cell === 'function') {
      for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) { const q = cell(Math.floor(x / 2), Math.floor(y / 2)); if (q) put(x, y, q.v, q.a ?? 1, !q.o, false); }
    } else {
      // centre the raster in the cell (small ones doubled); tumbling cards keep their albedo, cards facing the camera
      // their painted light
      const k2 = cell.w <= C / 2 && cell.h <= C / 2 ? 2 : 1;
      const ox = Math.floor((C - cell.w * k2) / 2), oy = Math.floor((C - cell.h * k2) / 2), flat = ['leaf', 'leafOak', 'leafWillow', 'petal', 'feather', 'flake', 'paper'].includes(k);
      for (let y = 0; y < cell.h * k2; y++) for (let x = 0; x < cell.w * k2; x++) {
        const j = Math.floor(y / k2) * cell.w + Math.floor(x / k2), role = cell.role[j];
        if (!role) continue;
        put(ox + x, oy + y, role === 2 ? 0 : flat ? cell.tone[j] : cell.s[j], cell.a[j], role !== 2, role === 3);
      }
    }
  }));
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  (t.userData as { rows: number }).rows = ROWS;
  return t;
}

// ---------------------------------------------------------------- shaders

const COMMON_VS = /* glsl */ `
attribute vec4 iPos;    // xyz, seed
attribute vec4 iData;   // size, cell or shape, alpha, mode (0 card, 1 tumble, 2 flat on the ground)
attribute vec4 iColor;  // rgb, flags (1: flip, 2: metal)
attribute vec4 iRot;    // axis xyz, angle
vec3 rotA(vec3 v, vec4 q) { float c = cos(q.w), s = sin(q.w); return v * c + cross(q.xyz, v) * s + q.xyz * dot(q.xyz, v) * (1.0 - c); }
`;
const CARD_VS = COMMON_VS + /* glsl */ `
uniform vec2 uGrid; uniform vec3 uSun;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vLit; varying float vBack; varying float vSpec;
void main() {
  float mode = iData.w;
  vec3 corner = vec3(position.xy, 0.0) * iData.x;
  vec4 mv; vLit = 1.0; vBack = 0.0; vSpec = 0.0;
  if (mode > 1.5) {
    mv = viewMatrix * vec4(iPos.xyz + vec3(corner.x, 0.0, -corner.y), 1.0);
    vLit = 0.8 + 0.25 * max(0.0, uSun.y);
  } else if (mode > 0.5) {
    vec3 n = rotA(vec3(0.0, 0.0, 1.0), iRot), wp = iPos.xyz + rotA(corner, iRot);
    mv = viewMatrix * vec4(wp, 1.0);
    vec3 toCam = normalize(cameraPosition - wp);
    float side = dot(n, toCam);
    vBack = side < 0.0 ? 1.0 : 0.0;
    vec3 nn = side < 0.0 ? -n : n;
    float lam = dot(nn, uSun);
    // lit on the side facing the light; light shining through a thin leaf from behind
    vLit = 0.4 + 0.85 * max(0.0, lam) + 0.4 * max(0.0, -lam);
    if (mod(floor(iColor.w / 2.0), 2.0) > 0.5) vSpec = pow(max(0.0, dot(reflect(-uSun, nn), toCam)), 10.0) * 2.4;
  } else {
    mv = viewMatrix * vec4(iPos.xyz, 1.0);
    mv.xy += corner.xy;
  }
  gl_Position = projectionMatrix * mv;
  float f = floor(iData.y + 0.5);
  vec2 cell = vec2(mod(f, uGrid.x), floor(f / uGrid.x));
  vec2 u = uv;
  if (mod(iColor.w, 2.0) > 0.5) u.x = 1.0 - u.x;
  vUv = (cell + u) / uGrid;
  vColor = iColor.rgb; vAlpha = iData.z;
}`;
const CARD_FS = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uLight;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha; varying float vLit; varying float vBack; varying float vSpec;
void main() {
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vAlpha;
  if (a < 0.04) discard;
  // a hue-shifted ramp from the tint: violet-cool darks, warm golden lights
  vec3 base = vColor;
  vec3 dark = base * vec3(0.5, 0.48, 0.66) * 0.62 + vec3(0.012, 0.01, 0.03);
  vec3 lite = mix(base, vec3(1.0, 0.95, 0.8), 0.34) * 1.06;
  float v = t.r;
  vec3 col = v < 0.78 ? mix(dark, base, smoothstep(0.0, 0.78, v)) : mix(base, lite, (v - 0.78) / 0.22);
  col = mix(col, lite, vBack * 0.22);
  // the edge: a darker note of the same colour, softly
  col = mix(dark * 0.7, col, smoothstep(0.2, 0.8, t.g));
  col *= uLight * vLit;
  col += vec3(1.0, 0.94, 0.8) * (vSpec + t.b * 0.6) * uLight;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;
const GLOW_VS = COMMON_VS + /* glsl */ `
uniform float uTime;
varying vec2 vQ; varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vTw;
void main() {
  vec4 mv = viewMatrix * vec4(iPos.xyz, 1.0);
  mv.xy += position.xy * iData.x;
  gl_Position = projectionMatrix * mv;
  vQ = position.xy * 2.0;
  vColor = iColor.rgb; vShape = iData.y;
  // twinkle on its own rhythm; soften right in front of the lens
  float s = iPos.w;
  vTw = 0.62 + 0.38 * sin(uTime * (5.0 + s * 6.0) + s * 40.0);
  vAlpha = iData.z * smoothstep(0.25, 0.9, -mv.z);
}`;
const GLOW_FS = /* glsl */ `
uniform float uGain;
varying vec2 vQ; varying vec3 vColor; varying float vAlpha; varying float vShape; varying float vTw;
void main() {
  float r2 = dot(vQ, vQ), r = sqrt(r2);
  if (r > 1.0) discard;
  float edge = 1.0 - smoothstep(0.7, 1.0, r);
  float core = exp(-r2 * 46.0), halo = exp(-r2 * 7.0) * 0.4 * edge, e = 0.0, white = 0.0;
  int sh = int(vShape + 0.5);
  if (sh == 0) { e = core * 1.5 + halo * (0.8 + 0.2 * vTw); white = core; }
  else if (sh == 1) {
    // a glint: a hot point with a four-ray flare and fainter diagonals at its peak
    float ax = abs(vQ.x), ay = abs(vQ.y);
    float flare = exp(-ay * 34.0) * exp(-ax * 3.2) + exp(-ax * 34.0) * exp(-ay * 3.2);
    float diag = exp(-abs(vQ.x - vQ.y) * 30.0) * exp(-r * 6.0) + exp(-abs(vQ.x + vQ.y) * 30.0) * exp(-r * 6.0);
    e = core * 2.0 + (flare * 1.1 + diag * 0.35 * vTw) * vTw * edge + halo * 0.5;
    white = core + flare * 0.35;
  }
  else if (sh == 2) { float fl = 0.8 + 0.2 * vTw; e = (core * 2.4 + exp(-r2 * 14.0) * 0.7 + halo * 0.6) * fl; white = core * 0.8; }
  else if (sh == 3) { float body = smoothstep(0.42, 0.34, r); e = body * (0.55 + 0.45 * (1.0 - r / 0.42)) + core + halo * 0.9; white = core; }
  else if (sh == 4) { e = exp(-r2 * 3.6) * 0.2 * edge; }
  else { float rr = (r - 0.74) * 10.0; e = exp(-rr * rr) * 0.8 * edge + exp(-r2 * 4.0) * 0.06; }
  vec3 col = mix(vColor, vec3(1.0, 0.98, 0.92), clamp(white, 0.0, 0.85));
  gl_FragColor = vec4(col * e * vAlpha * uGain, 1.0);
}`;

// ---------------------------------------------------------------- particles

export interface Emit {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  life: number;
  size?: number;
  frame: number;
  /** cycle through this many consecutive frames at `fps` (cards; tumbling cards ignore it) */
  frames?: number; fps?: number;
  color?: number;
  gravity?: number; drag?: number; wind?: number;
  /** (old) glow: lights are always glows now, whatever this says */
  add?: boolean;
  /** seconds to fade in / out */
  fadeIn?: number; fadeOut?: number;
  grow?: number;
  /** settle on the ground instead of falling through it */
  land?: boolean;
  /** sideways flutter amplitude */
  flutter?: number;
  /** pull towards a point: used by the teleport */
  tx?: number; ty?: number; tz?: number; pull?: number; swirl?: number;
  delay?: number;
  /** lie flat on the xz plane instead of facing the camera */
  flat?: boolean;
  /** tumbling cards: turns per second (default from the sprite) */
  spin?: number;
  /** the ground height to land on (defaults to the terrain) */
  floor?: number;
}

interface P {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; size: number; frame: number; frames: number; fps: number;
  gravity: number; drag: number; wind: number; fadeIn: number; fadeOut: number; grow: number; land: boolean; flutter: number;
  tx: number; ty: number; tz: number; pull: number; swirl: number; delay: number; flat: boolean; floor: number;
  age: number; seed: number; landed: boolean; r: number; g: number; b: number; look: Look;
  ax: number; ay: number; az: number; ang: number; spin: number;
}

const QUAD = new THREE.PlaneGeometry(1, 1);
class Layer {
  readonly mesh: THREE.Mesh;
  readonly geo = new THREE.InstancedBufferGeometry();
  private pos: Float32Array; private dat: Float32Array; private col: Float32Array; private rot: Float32Array;
  list: P[] = [];
  constructor(readonly max: number, readonly mat: THREE.ShaderMaterial, readonly glow: boolean) {
    this.geo.index = QUAD.index; this.geo.attributes.position = QUAD.attributes.position; this.geo.attributes.uv = QUAD.attributes.uv;
    this.pos = new Float32Array(max * 4); this.dat = new Float32Array(max * 4); this.col = new Float32Array(max * 4); this.rot = new Float32Array(max * 4);
    for (const [n, a] of [['iPos', this.pos], ['iData', this.dat], ['iColor', this.col], ['iRot', this.rot]] as const) {
      const at = new THREE.InstancedBufferAttribute(a, 4);
      at.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(n, at);
    }
    this.geo.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = glow ? 8 : 3;
  }
  /** (when the pool is full a new particle is skipped, never one that is showing: nothing pops) */
  push(p: P) { if (this.list.length < this.max) this.list.push(p); }
  update(dt: number, t: number, wx: number, wz: number) {
    const L = this.list;
    let n = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if (p.delay > 0) { p.delay -= dt; L[n++] = p; continue; }
      p.age += dt;
      if (p.age >= p.life) continue;
      if (!p.landed) {
        if (p.pull) {
          // ease into a swirl around the target point, tightening over the particle's life
          const k = Math.min(1, p.age / p.life), dx = p.tx - p.x, dy = p.ty - p.y, dz = p.tz - p.z;
          p.vx += (dx * p.pull + -dz * p.swirl) * dt; p.vy += dy * p.pull * dt; p.vz += (dz * p.pull + dx * p.swirl) * dt;
          const d = 1 - Math.min(0.9, dt * (2 + k * 6)); p.vx *= d; p.vy *= d; p.vz *= d;
        }
        p.vy -= p.gravity * dt;
        const dr = Math.max(0, 1 - p.drag * dt);
        p.vx = (p.vx + wx * p.wind * dt) * dr; p.vz = (p.vz + wz * p.wind * dt) * dr; p.vy *= dr;
        const fl = p.flutter ? Math.sin(t * 3.1 + p.seed * 9) * p.flutter : 0;
        p.x += (p.vx + fl) * dt; p.y += p.vy * dt; p.z += (p.vz + fl * 0.6) * dt;
        p.ang += p.spin * dt * (p.look.mode === 'tumble' && p.flutter ? 0.75 + 0.5 * Math.sin(t * 2.3 + p.seed * 7) : 1);
        if (p.land) {
          const gy = (Number.isFinite(p.floor) ? p.floor : surfaceY(p.x, p.z)) + 0.02 + p.seed * 0.01;
          if (p.y <= gy) {
            p.y = gy; p.landed = true;
            // tumbling cards come to rest lying flat; keep a little life so they settle and fade on the ground
            if (p.look.mode === 'tumble') { p.ax = 1; p.ay = 0; p.az = 0; p.ang = -Math.PI / 2; p.life = Math.min(p.life, p.age + 1.2 + p.seed); p.fadeOut = Math.max(p.fadeOut, 0.8); }
          }
        }
      }
      const fi = Math.min(1, p.fadeIn ? p.age / p.fadeIn : 1), fo = Math.min(1, p.fadeOut ? (p.life - p.age) / p.fadeOut : 1);
      const o = n * 4;
      this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z; this.pos[o + 3] = p.seed;
      this.dat[o] = p.size * (1 + p.grow * (p.age / p.life));
      this.dat[o + 1] = this.glow ? (p.look.shape ?? 0) : p.frame + (p.frames > 1 && !p.landed ? Math.floor(p.age * p.fps + p.seed * p.frames) % p.frames : 0);
      this.dat[o + 2] = fi * fo;
      this.dat[o + 3] = p.flat ? 2 : p.look.mode === 'tumble' ? 1 : 0;
      this.col[o] = p.r; this.col[o + 1] = p.g; this.col[o + 2] = p.b; this.col[o + 3] = (p.seed > 0.5 ? 1 : 0) + (p.look.metal ? 2 : 0);
      this.rot[o] = p.ax; this.rot[o + 1] = p.ay; this.rot[o + 2] = p.az; this.rot[o + 3] = p.ang;
      L[n++] = p;
    }
    L.length = n;
    this.geo.instanceCount = n;
    if (n) for (const a of ['iPos', 'iData', 'iColor', 'iRot']) {
      const at = this.geo.attributes[a] as THREE.InstancedBufferAttribute;
      at.clearUpdateRanges(); at.addUpdateRange(0, n * 4); at.needsUpdate = true;
    }
  }
}

const tmp = new THREE.Color(), warmC = new THREE.Color(1, 0.74, 0.5), coolC = new THREE.Color(0.72, 0.78, 1);

export type BurstKind = 'hearts' | 'stars' | 'notes' | 'dust' | 'sparkle' | 'coins' | 'crumbs' | 'splash' | 'zzz' | 'leaves' | 'bang' | 'ask' | 'dots' | 'confetti'
  | 'puffs' | 'magic' | 'feathers' | 'petals' | 'snow' | 'reward' | 'dew' | 'embers'
  | 'motes' | 'glints' | 'flakes' | 'shavings' | 'ink' | 'paper' | 'breath' | 'shock';
/** the reactions Pip and Barnaby show (the old emote marks): body language plus a subtle touch of light */
export type Cue = 'sweat' | 'anger' | 'bang' | 'ask' | 'notes' | 'sparkle' | 'hearts' | 'zzz' | 'bulb' | 'gloom' | 'steam';

const all = new Set<Fx>();
/** Calm motion (the in-app setting) or the system's reduced motion */
const calmNow = () => { try { return document.documentElement.classList.contains('hh-still') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
let live: Fx | null = null, liveAt = 0;
const rootOf = (o: THREE.Object3D) => { let r = o; while (r.parent) r = r.parent; return r; };

export class Fx {
  readonly group = new THREE.Group();
  private solid: Layer; private glow: Layer;
  /** wind push in blocks/s, set by the world each frame */
  windX = 0.5; windZ = 0.35;
  /** fewer particles (phones, Calm motion): presets scale their counts by this */
  density = 1;
  private sun = new THREE.Vector3(-0.5, 0.75, 0.45).normalize();
  private lightsAt = -1e9;
  private lights: THREE.DirectionalLight[] = [];
  private time = 0;
  constructor(max = 1600) {
    const tex = atlas(), rows = (tex.userData as { rows: number }).rows;
    const card = new THREE.ShaderMaterial({
      vertexShader: CARD_VS, fragmentShader: CARD_FS, depthWrite: false, transparent: true, side: THREE.DoubleSide,
      uniforms: { uMap: { value: tex }, uGrid: { value: new THREE.Vector2(COLS, rows) }, uLight: { value: new THREE.Color(1, 1, 1) }, uSun: { value: this.sun } },
    });
    const glow = new THREE.ShaderMaterial({
      vertexShader: GLOW_VS, fragmentShader: GLOW_FS, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uGain: { value: 1 } },
    });
    this.solid = new Layer(max, card, false);
    this.glow = new Layer(Math.floor(max / 2), glow, true);
    this.group.add(this.solid.mesh, this.glow.mesh);
    // learn the scene's light while drawing (and which scene this is, for sceneFx)
    this.solid.mesh.onBeforeRender = (_r, scene) => {
      live = this; liveAt = performance.now();
      if (liveAt - this.lightsAt > 1000) {
        this.lightsAt = liveAt;
        this.density = calmNow() ? 0.5 : 1;
        this.lights = [];
        scene.traverseVisible((o) => { if ((o as THREE.DirectionalLight).isDirectionalLight) this.lights.push(o as THREE.DirectionalLight); });
      }
      let best: THREE.DirectionalLight | null = null;
      for (const l of this.lights) if (l.visible && (!best || l.intensity > best.intensity)) best = l;
      if (best) {
        best.updateMatrixWorld();
        const a = new THREE.Vector3().setFromMatrixPosition(best.matrixWorld), b = new THREE.Vector3().setFromMatrixPosition(best.target.matrixWorld);
        if (a.distanceToSquared(b) > 1e-6) this.sun.copy(a.sub(b).normalize());
      }
    };
    all.add(this);
  }
  setLight(c: THREE.Color) {
    (this.solid.mat.uniforms.uLight.value as THREE.Color).copy(c).multiplyScalar(1.25);
    // lights read stronger against a bright day, gentler in the dark (where the bloom carries them)
    const lum = c.r * 0.3 + c.g * 0.55 + c.b * 0.15;
    this.glow.mat.uniforms.uGain.value = Math.max(0.75, Math.min(1.5, 0.7 + lum * 0.7));
  }
  /** brighter lights at night, gentler by day (the bloom does the rest) */
  setGlow(gain: number) { this.glow.mat.uniforms.uGain.value = gain; }
  emit(e: Emit) {
    const look = LOOK[e.frame] ?? LOOK[SPR.mote];
    tmp.setHex(e.color ?? 0xffffff);
    if (look.warm) tmp.lerp(warmC, look.warm);
    if (look.cool) tmp.lerp(coolC, look.cool);
    const seed = Math.random();
    // a random tumbling axis, mostly across the card so it flips over as it falls
    const th = seed * 40, ax = Math.cos(th), az = Math.sin(th) * 0.6, ay = 0.35 + (seed - 0.5) * 0.4, al = Math.hypot(ax, ay, az);
    const [s0, s1] = look.spin ?? [0, 0];
    const p: P = {
      x: e.x, y: e.y, z: e.z, vx: e.vx ?? 0, vy: e.vy ?? 0, vz: e.vz ?? 0, life: e.life, size: e.size ?? 0.5, frame: 0, frames: 1, fps: e.fps ?? 6,
      gravity: e.gravity ?? 0, drag: e.drag ?? 0, wind: e.wind ?? 0, fadeIn: e.fadeIn ?? 0, fadeOut: e.fadeOut ?? 0.3, grow: e.grow ?? 0, land: !!e.land,
      flutter: e.flutter ?? 0, tx: e.tx ?? 0, ty: e.ty ?? 0, tz: e.tz ?? 0, pull: e.pull ?? 0, swirl: e.swirl ?? 0, delay: e.delay ?? 0, flat: !!e.flat,
      floor: e.floor ?? NaN, age: 0, seed, landed: false, r: tmp.r, g: tmp.g, b: tmp.b, look,
      ax: ax / al, ay: ay / al, az: az / al, ang: seed * 6.28, spin: e.spin ?? (s0 + (s1 - s0) * hash(seed * 1e5, 3)) * (seed > 0.5 ? 1 : -1),
    };
    if (look.mode !== 'glow') {
      // the old frame groups (puff1..3, splat1..3) start where the caller asked and play to the end
      const base = cellIndex[look.cell!] ?? 0, nf = look.frames ?? 1, off = look.start ?? 0;
      p.frame = base + off;
      p.frames = nf > 1 ? Math.max(1, Math.min(e.frames ?? nf, nf - off)) : 1;
    } else p.size *= look.shape === G.breath || look.shape === G.ring ? 1 : 2.2; // a glow is mostly halo
    (look.mode === 'glow' ? this.glow : this.solid).push(p);
  }
  update(dt: number, t: number) {
    this.time += dt;
    this.glow.mat.uniforms.uTime.value = this.time;
    this.solid.update(dt, t, this.windX, this.windZ); this.glow.update(dt, t, this.windX, this.windZ);
  }
  get count() { return this.solid.list.length + this.glow.list.length; }
  /** drop every particle (a scene change) */
  clear() { this.solid.list.length = 0; this.glow.list.length = 0; this.solid.geo.instanceCount = 0; this.glow.geo.instanceCount = 0; }
  dispose() { all.delete(this); if (live === this) live = null; }

  // ---- presets

  burst(kind: BurstKind, x: number, y: number, z: number, n = 6, color?: number) {
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    n = Math.max(1, Math.round(n * this.density));
    const pick = <T,>(a: T[], i: number) => a[i % a.length];
    if (kind === 'hearts') {
      // fondness: a warm rose-gold breath of light round the face and motes rising out of it
      this.emit({ x, y: y + 0.05, z, life: 1.5, frame: SPR.breath, color: 0xffc0a0, size: 1, fadeIn: 0.35, fadeOut: 0.9 });
    }
    if (kind === 'reward' || kind === 'shock') this.emit({ x, y: y + 0.2, z, life: 1.6, frame: SPR.breath, color: color ?? 0xffd89a, size: 1.6, fadeIn: 0.25, fadeOut: 1.1 });
    if (kind === 'shock') { this.emit({ x, y: y + 0.2, z, life: 0.9, frame: SPR.lightring, color: color ?? 0xffe0a0, size: 0.6, grow: 5, fadeIn: 0.05, fadeOut: 0.7 }); return; }
    if (kind === 'breath') { this.emit({ x, y, z, life: 1.4, frame: SPR.breath, color: color ?? 0xffc870, size: 1.4, fadeIn: 0.3, fadeOut: 0.9 }); return; }
    for (let i = 0; i < n; i++) {
      const a = R(0, Math.PI * 2);
      switch (kind) {
        case 'hearts': this.emit({ x: x + R(-0.25, 0.25), y: y + R(-0.15, 0.1), z: z + R(-0.15, 0.15), vy: R(0.35, 0.6), vx: R(-0.08, 0.08), life: R(1.3, 1.9), frame: SPR.mote, color: pick([0xffb090, 0xffd2a0, 0xff9c8c], i), size: R(0.05, 0.08), flutter: 0.15, fadeIn: 0.25, fadeOut: 0.7, delay: 0.1 + i * 0.14 }); break;
        case 'notes': {
          // a musical shimmer: glints rising along a slow wave, one after another, like notes being played
          const sd = i % 2 ? 1 : -1;
          this.emit({ x: x + sd * R(0.15, 0.3), y: y + R(0, 0.1), z, vy: R(0.45, 0.65), vx: sd * 0.08, life: 1.2, frame: SPR.note, color: pick([0xffd890, 0xe8eeff, 0xffe8b8], i), size: R(0.07, 0.1), flutter: 0.35, fadeIn: 0.12, fadeOut: 0.6, delay: i * 0.2 });
          break;
        }
        case 'stars': this.emit({ x, y, z, vx: Math.cos(a) * R(0.6, 1.3), vy: R(0.8, 1.8), vz: Math.sin(a) * R(0.6, 1.3), life: R(0.7, 1.1), frame: SPR.star, color: color ?? pick([0xffd070, 0xfff0c8], i), size: R(0.07, 0.11), gravity: 1.6, drag: 1.6, fadeOut: 0.5 }); break;
        case 'sparkle': case 'glints': case 'dew': this.emit({ x: x + R(-0.45, 0.45), y: y + R(-0.15, 0.55), z: z + R(-0.45, 0.45), vy: R(0.02, 0.12), life: R(0.5, 0.9), frame: SPR.spark1, color: color ?? (kind === 'dew' ? 0xeef6ff : pick([0xffd890, 0xfff2d0], i)), size: kind === 'dew' ? R(0.03, 0.05) : R(0.06, 0.1), fadeIn: 0.12, fadeOut: 0.4, delay: i * 0.05 }); break;
        case 'dust': this.emit({ x: x + R(-0.15, 0.15), y: y + 0.05, z: z + R(-0.15, 0.15), vx: Math.cos(a) * 0.45, vy: R(0.15, 0.4), vz: Math.sin(a) * 0.45, life: R(0.45, 0.7), frame: SPR.puff1, frames: 3, fps: 5, color: color ?? 0xdcd0b4, size: R(0.22, 0.36), grow: 0.6, drag: 2.4, fadeOut: 0.35 }); break;
        case 'coins': this.emit({ x, y, z, vx: Math.cos(a) * R(0.5, 1.3), vy: R(2, 3.2), vz: Math.sin(a) * R(0.5, 1.3), life: R(1.2, 1.7), frame: SPR.coin, color: color ?? 0xe0b048, size: 0.16, gravity: 7, land: true, fadeOut: 0.3 }); break;
        case 'crumbs': case 'shavings': this.emit({ x, y, z, vx: Math.cos(a) * R(0.3, 0.8), vy: R(0.6, 1.3), vz: Math.sin(a) * R(0.3, 0.8), life: R(0.9, 1.4), frame: SPR.shaving, color: color ?? pick([0xe2b878, 0xd8a868, 0xeccb94], i), size: kind === 'crumbs' ? 0.12 : 0.16, gravity: 6, drag: 0.6, land: true }); break;
        case 'splash': this.emit({ x, y, z, vx: Math.cos(a) * R(0.4, 1.1), vy: R(1.2, 2.4), vz: Math.sin(a) * R(0.4, 1.1), life: R(0.5, 0.8), frame: SPR.drop, color: color ?? 0xd8e8f2, size: 0.12, gravity: 7 }); break;
        case 'ink': this.emit({ x, y, z, vx: Math.cos(a) * R(0.3, 0.8), vy: R(0.6, 1.4), vz: Math.sin(a) * R(0.3, 0.8), life: R(0.6, 0.9), frame: SPR.ink, color: color ?? 0x2a2c58, size: 0.08, gravity: 6, land: true }); break;
        case 'zzz': this.emit({ x: x + R(-0.08, 0.08), y: y + i * 0.06, z, vx: R(0.04, 0.1), vy: R(0.12, 0.2), life: 2.6, frame: SPR.zed, color: color ?? pick([0xc8d0ff, 0xe0d8ff], i), size: R(0.07, 0.1), flutter: 0.12, fadeIn: 0.6, fadeOut: 1.2, delay: i * 0.55 }); break;
        case 'leaves': this.emit({ x: x + R(-0.6, 0.6), y: y + R(-0.3, 0.3), z: z + R(-0.6, 0.6), vx: Math.cos(a) * 0.8, vy: R(0.6, 1.6), vz: Math.sin(a) * 0.8, life: R(1.8, 2.6), frame: pick([SPR.leaf1, SPR.leaf2, SPR.leaf3], i), color: color ?? pick([0x6aa040, 0xd6a032, 0xc4542c], i), size: 0.26, gravity: 2.2, drag: 1.6, wind: 0.6, flutter: 0.5, land: true }); break;
        case 'confetti': case 'flakes':
          // gold leaf flakes (and a few petals) that flash as they turn
          if (kind === 'confetti' && i % 4 === 3) this.emit({ x, y, z, vx: Math.cos(a) * R(0.6, 1.5), vy: R(1.6, 3), vz: Math.sin(a) * R(0.6, 1.5), life: R(1.8, 2.4), frame: SPR.petal, color: pick([0xf0a6b4, 0xf4ece4], i), size: R(0.12, 0.16), gravity: 2.6, drag: 1.6, flutter: 0.5, land: true });
          else this.emit({ x, y, z, vx: Math.cos(a) * R(0.6, 1.6), vy: R(1.6, 3.2), vz: Math.sin(a) * R(0.6, 1.6), life: R(1.6, 2.3), frame: SPR.pixel, color: color ?? pick([0xe0a838, 0xf0c860, 0xc88a2c], i), size: R(0.07, 0.11), gravity: 2.8, drag: 1.6, flutter: 0.45, land: true });
          break;
        case 'puffs': this.emit({ x: x + R(-0.15, 0.15), y: y + R(-0.1, 0.2), z: z + R(-0.15, 0.15), vx: Math.cos(a) * R(0.6, 1.3), vy: R(0.2, 0.8), vz: Math.sin(a) * R(0.6, 1.3), life: R(0.7, 1.05), frame: SPR.cloud, frames: 3, fps: 3.5, color: color ?? pick([0xf4eedd, 0xeae0c8], i), size: R(0.26, 0.42), grow: 0.8, drag: 3.2, fadeOut: 0.45, delay: i * 0.015 }); break;
        case 'magic': {
          const r0 = R(0.35, 0.7);
          this.emit({ x: x + Math.cos(a) * r0, y: y + R(-0.2, 0.3), z: z + Math.sin(a) * r0, vx: -Math.sin(a) * 1.2, vy: R(0.6, 1.2), vz: Math.cos(a) * 1.2, life: R(1, 1.5), frame: i % 3 ? SPR.mote : SPR.spark1, color: color ?? pick([0xc0a8ff, 0xa8d4ff, 0xffd890, 0xffb8c8], i), size: R(0.05, 0.09), tx: x, ty: y + 1.6, tz: z, pull: 0.6, swirl: 3, fadeIn: 0.15, fadeOut: 0.5, delay: i * 0.03 });
          break;
        }
        case 'feathers': this.emit({ x: x + R(-0.2, 0.2), y: y + R(-0.1, 0.3), z: z + R(-0.2, 0.2), vx: Math.cos(a) * R(0.6, 1.6), vy: R(0.5, 1.4), vz: Math.sin(a) * R(0.6, 1.6), life: R(1.8, 2.8), frame: SPR.feather1, color: color ?? 0xd9bf93, size: R(0.14, 0.2), gravity: 0.9, drag: 2.4, flutter: 0.6, land: true }); break;
        case 'petals': this.emit({ x: x + R(-0.5, 0.5), y: y + R(-0.2, 0.4), z: z + R(-0.5, 0.5), vx: Math.cos(a) * 0.5, vy: R(0.3, 1), vz: Math.sin(a) * 0.5, life: R(2, 2.8), frame: SPR.petal, color: color ?? pick([0xf0a6b4, 0xf4ece4, 0xe8b8c4], i), size: R(0.12, 0.17), gravity: 1.1, drag: 1.5, wind: 0.6, flutter: 0.6, land: true }); break;
        case 'paper': this.emit({ x, y, z, vx: Math.cos(a) * R(0.3, 0.8), vy: R(0.5, 1.2), vz: Math.sin(a) * R(0.3, 0.8), life: R(1.6, 2.2), frame: SPR.paper, color: color ?? 0xf0e8d6, size: R(0.1, 0.14), gravity: 1.4, drag: 1.8, flutter: 0.5, land: true }); break;
        case 'snow': this.emit({ x: x + R(-0.8, 0.8), y: y + R(0, 0.6), z: z + R(-0.8, 0.8), vy: R(-0.3, -0.1), life: R(2, 3), frame: SPR.flake, color: color ?? 0xf5f8ff, size: R(0.1, 0.15), gravity: 0.2, drag: 1, wind: 0.4, flutter: 0.4, land: true }); break;
        case 'reward': {
          // a reward: golden motes and glints rising round it, the slow ones drifting on afterwards
          const r0 = R(0.2, 0.55);
          this.emit({ x: x + Math.cos(a) * r0, y: y + R(0, 0.3), z: z + Math.sin(a) * r0, vx: Math.cos(a) * R(0.15, 0.5), vy: R(0.9, 1.9), vz: Math.sin(a) * R(0.15, 0.5), life: R(1, 1.6), frame: i % 3 ? SPR.mote : SPR.spark1, color: color ?? pick([0xffd070, 0xffe8b0, 0xffc050], i), size: R(0.05, 0.09), gravity: 0.9, drag: 1.3, flutter: 0.25, fadeOut: 0.6, delay: i * 0.02 });
          if (i % 3 === 0) this.emit({ x: x + R(-0.4, 0.4), y: y + R(0.2, 1), z: z + R(-0.4, 0.4), vy: R(0.1, 0.3), life: R(2, 3), frame: SPR.mote, color: 0xfff0d0, size: R(0.03, 0.05), flutter: 0.3, fadeIn: 0.4, fadeOut: 1.2, delay: 0.3 + i * 0.04 });
          break;
        }
        case 'motes': this.emit({ x: x + R(-0.6, 0.6), y: y + R(0, 1.2), z: z + R(-0.6, 0.6), vx: R(-0.05, 0.05), vy: R(0.05, 0.22), vz: R(-0.05, 0.05), life: R(2, 3.2), frame: SPR.mote, color: color ?? pick([0xffd890, 0xfff0d0], i), size: R(0.03, 0.06), flutter: 0.2, fadeIn: 0.6, fadeOut: 1.2, delay: i * 0.05 }); break;
        case 'embers': this.emit({ x: x + R(-0.1, 0.1), y, z: z + R(-0.1, 0.1), vx: R(-0.15, 0.25), vy: R(0.5, 1.1), vz: R(-0.15, 0.15), life: R(0.9, 1.6), frame: SPR.ember, color: pick([0xffb050, 0xff8a30, 0xffd080], i), size: R(0.03, 0.05), wind: 0.5, flutter: 0.35, fadeOut: 0.6, delay: i * 0.08 }); break;
        case 'bang': case 'ask': case 'dots': this.emit({ x, y, z, vy: 0.1, life: 0.8, frame: SPR.spark1, color: 0xfff0c8, size: 0.09, fadeIn: 0.1, fadeOut: 0.5 }); return;
      }
    }
  }

  /** A ring ripple spreading flat on the pond. */
  ripple(x: number, y: number, z: number) {
    this.emit({ x, y: y + 0.03, z, life: 0.9, frame: SPR.ring, color: 0xdfe9ea, size: 0.3, grow: 2.4, fadeOut: 0.5, flat: true });
  }

  /**
   * A reaction shown on a character, sized by its head (`r`, world units): fondness is a warm breath of light and rising
   * motes, joy a few glints, music a rising shimmer, sleep slow dream motes, surprise a couple of loose down feathers, a
   * huff two little puffs of breath, an idea one glint above the head. Shy, worried and puzzled are body language only.
   */
  cue(kind: Cue, at: THREE.Vector3, r: number, delay = 0) {
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    const { x, y, z } = at;
    switch (kind) {
      case 'hearts':
        this.emit({ x, y, z, life: 1.6, frame: SPR.breath, color: 0xffa080, size: r * 6, fadeIn: 0.35, fadeOut: 1, delay });
        for (let i = 0; i < 4; i++) this.emit({ x: x + R(-1, 1) * r, y: y - r * 0.4, z: z + r * 0.4, vy: r * R(1.6, 2.4), life: R(1.3, 1.8), frame: SPR.mote, color: i % 2 ? 0xffb898 : 0xffd2a0, size: r * R(0.25, 0.4), flutter: r * 0.6, fadeIn: 0.25, fadeOut: 0.7, delay: delay + 0.15 + i * 0.15 });
        break;
      case 'sparkle':
        for (let i = 0; i < 5; i++) { const a = -Math.PI * R(0.05, 0.95); this.emit({ x: x + Math.cos(a) * r * 1.5, y: y - Math.sin(a) * r * 1.3, z: z + r * 0.3, vy: r * 0.5, life: R(0.55, 0.85), frame: SPR.spark1, color: i % 2 ? 0xfff2d0 : 0xffd890, size: r * R(0.4, 0.6), fadeIn: 0.1, fadeOut: 0.35, delay: delay + i * 0.08 }); }
        break;
      case 'notes':
        for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1; this.emit({ x: x + sd * r * 1.3, y: y + r * 0.4, z: z + r * 0.2, vy: r * 2.4, vx: sd * r * 0.3, life: 1.2, frame: SPR.note, color: i % 2 ? 0xe8eeff : 0xffd890, size: r * 0.5, flutter: r * 1.2, fadeIn: 0.12, fadeOut: 0.6, delay: delay + i * 0.22 }); }
        break;
      case 'zzz':
        for (let i = 0; i < 3; i++) this.emit({ x: x + r * 1.1, y: y + r * (0.6 + i * 0.3), z, vx: r * 0.3, vy: r * 0.7, life: 2.6, frame: SPR.zed, color: i % 2 ? 0xe0d8ff : 0xc8d4ff, size: r * R(0.45, 0.6), flutter: r * 0.4, fadeIn: 0.6, fadeOut: 1.2, delay: delay + i * 0.6 });
        break;
      case 'bang':
        for (let i = 0; i < 3; i++) { const a = R(0, Math.PI * 2); this.emit({ x: x + Math.cos(a) * r * 0.6, y: y + r * 0.9, z: z + Math.sin(a) * r * 0.6, vx: Math.cos(a) * r * 2, vy: r * R(3, 5), vz: Math.sin(a) * r * 2, life: R(1.4, 2), frame: SPR.feather1, color: 0xefe2c8, size: r * R(0.45, 0.6), gravity: r * 6, drag: 2.6, flutter: r * 1.4, fadeOut: 0.6, delay }); }
        break;
      case 'anger': case 'steam':
        for (const sd of [-1, 1]) this.emit({ x: x + sd * r * 0.5, y: y - r * 0.35, z: z + r * 0.8, vx: sd * r * 2.2, vy: r * 0.6, vz: r * 0.6, life: 0.7, frame: SPR.puff1, frames: 3, fps: 5, color: 0xf2f0ec, size: r * 0.9, grow: 1.2, drag: 3, fadeIn: 0.05, fadeOut: 0.45, delay: delay + 0.08 });
        break;
      case 'bulb':
        this.emit({ x, y: y + r * 1.9, z, vy: r * 0.2, life: 0.9, frame: SPR.spark1, color: 0xfff0c0, size: r * 0.9, fadeIn: 0.12, fadeOut: 0.5, delay });
        break;
      default: break; // shy, worried, puzzled, gloomy: the body says it
    }
  }
}

/**
 * The particles of whichever scene is drawing: `sceneFx.burst(kind, at)` in the live scene, `sceneFx.cue(kind, actor,
 * at, r)` in the scene that holds `actor` (Pip at home or in the office, Barnaby in his lodge).
 */
export const sceneFx = {
  get live(): Fx | null { return live && performance.now() - liveAt < 800 ? live : null; },
  of(o: THREE.Object3D | null | undefined): Fx | null {
    if (o) { const root = rootOf(o); for (const f of all) if (rootOf(f.group) === root) return f; }
    return this.live;
  },
  burst(kind: BurstKind, at: THREE.Vector3, n = 6, color?: number) { this.live?.burst(kind, at.x, at.y, at.z, n, color); },
  cue(kind: Cue, actor: THREE.Object3D | null, at: THREE.Vector3, r: number, delay = 0) { this.of(actor)?.cue(kind, at, r, delay); },
};
