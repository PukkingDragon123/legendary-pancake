// 2D pixel-art particles living in the 3D world: falling leaves, petals, pollen, fireflies, footstep
// puffs, hearts and notes above the animals, reward bursts, and the square pixels of the teleport.
// [world3] Every preset draws from the calm palette (src/gfx/palette.ts), and nothing glows as a soft
// additive blob: "glowing" particles are crisp unlit pixel sprites that dissolve on a dither grid.
import * as THREE from 'three';
import { groundY } from './layout.ts';

// Each sprite is 8x8. '#' full, '+' mid, '-' dark, '.' clear. Colour comes from the particle's tint.
const ART: Record<string, string[]> = {
  leaf1: ['........', '.....##.', '...####.', '..####+.', '.###++..', '.#++-...', '.--.....', '........'],
  leaf2: ['........', '........', '..####..', '.######+', '.++++++-', '..----..', '........', '........'],
  leaf3: ['...#....', '..##....', '..##+...', '..#++...', '..#+-...', '..+-....', '...-....', '........'],
  petal: ['........', '........', '...##...', '..###+..', '..##+...', '...+....', '........', '........'],
  mote: ['........', '........', '........', '...##...', '...##...', '........', '........', '........'],
  spark1: ['........', '........', '...#....', '..###...', '...#....', '........', '........', '........'],
  spark2: ['...#....', '...#....', '...#....', '#######.', '...#....', '...#....', '...#....', '........'],
  spark3: ['...#....', '...#....', '..###...', '#######.', '..###...', '...#....', '...#....', '........'],
  heart: ['........', '.##.##..', '#######.', '#######.', '.#####..', '..###...', '...#....', '........'],
  note: ['....##..', '....#.#.', '....#..#', '....#...', '..###...', '.####...', '..##....', '........'],
  star: ['...#....', '..###...', '#######.', '.#####..', '.##.##..', '.#...#..', '........', '........'],
  zed: ['........', '.#####..', '....#...', '...#....', '..#.....', '.#####..', '........', '........'],
  puff1: ['........', '..###...', '.#####..', '.#####+.', '.####++.', '..++++..', '........', '........'],
  puff2: ['..##.#..', '.####.#.', '######..', '#####.+.', '.###.++.', '+.++.+..', '..+.....', '........'],
  puff3: ['.#...#..', '...#....', '#.....#.', '...+....', '.+...+..', '....+...', '..+.....', '........'],
  drop: ['...#....', '...#....', '..###...', '..###...', '.#####..', '.####+..', '..##+...', '........'],
  glow: ['........', '........', '...+....', '..+##+..', '..+##+..', '....+...', '........', '........'],
  pixel: ['########', '########', '########', '########', '########', '########', '########', '########'],
  bang: ['...##...', '...##...', '...##...', '...##...', '...##...', '........', '...##...', '........'],
  ask: ['..####..', '.##..##.', '.....##.', '....##..', '...##...', '........', '...##...', '........'],
  ring: ['..####..', '.#....#.', '#......#', '#......#', '#......#', '#......#', '.#....#.', '..####..'],
  coin: ['..----..', '.-####-.', '-######-', '-##++##-', '-##++##-', '-######-', '.-####-.', '..----..'],
  crumb: ['........', '........', '........', '...##...', '...#+...', '........', '........', '........'],
  streak: ['........', '........', '........', '.######+', '........', '........', '........', '........'],
  dots: ['........', '........', '........', '........', '##.##.##', '##.##.##', '........', '........'],
  flame1: ['...#....', '..##....', '..###...', '.####...', '.#####..', '.##+##..', '..+++...', '........'],
  flame2: ['....#...', '...##...', '..###...', '..####..', '.#####..', '.#++##..', '..+++...', '........'],
  feather1: ['......#.', '.....##.', '....###.', '...###+.', '..###+..', '.##++...', '.#+.....', '#.......'],
  feather2: ['........', '......##', '....####', '..####+.', '.###++..', '.#+-....', '#.......', '........'],
  feather3: ['.....#..', '....##..', '...###..', '..###+..', '..##+...', '.##+....', '.#+.....', '#.......'],
  moon: ['..###...', '.##.....', '##......', '##......', '##......', '.##.....', '..###...', '........'],
  bigstar: ['...#....', '...#....', '..###...', '#######.', '..###...', '..#.#...', '.#...#..', '........'],
  // [world] rain splashes, snow, happy puffs and magic
  splat1: ['........', '........', '........', '........', '........', '...##...', '..####..', '........'],
  splat2: ['........', '........', '........', '.#....#.', '..#..#..', '...##...', '.##..##.', '........'],
  splat3: ['........', '#......#', '........', '.#....#.', '........', '........', '#......#', '........'],
  flake: ['...#....', '.#.#.#..', '..###...', '#######.', '..###...', '.#.#.#..', '...#....', '........'],
  cloud: ['..###...', '.#####+.', '########', '#######+', '+######+', '-+####+-', '.-++++-.', '..----..'],
  cloud2: ['........', '.##..##.', '########', '#######+', '+#####++', '.-+++--.', '........', '........'],
  swirl1: ['..###...', '.#...#..', '#..#..#.', '#.#.#.#.', '#.#..#..', '.#...#..', '..###...', '........'],
  swirl2: ['...##...', '..#..#..', '.#.##.#.', '.#.#..#.', '.#..##..', '..#.....', '...###..', '........'],
  orb: ['........', '..-++-..', '.-+##+-.', '.+####+.', '.+####+.', '.-+##+-.', '..-++-..', '........'],
  diamond: ['...#....', '..#+#...', '.#+#+#..', '#+###+#.', '.#+#+#..', '..#+#...', '...#....', '........'],
};
const NAMES = Object.keys(ART);
export const SPR = Object.fromEntries(NAMES.map((n, i) => [n, i])) as Record<keyof typeof ART, number>;
const COLS = 8, ROWS = Math.ceil(NAMES.length / COLS);

function atlas(): THREE.DataTexture {
  const W = COLS * 8, H = ROWS * 8, data = new Uint8Array(W * H * 4);
  NAMES.forEach((n, i) => {
    const cx = (i % COLS) * 8, cy = Math.floor(i / COLS) * 8;
    ART[n].forEach((row, ry) => {
      for (let x = 0; x < 8; x++) {
        const ch = row[x];
        if (ch === '.') continue;
        const v = ch === '#' ? 255 : ch === '+' ? 200 : 140, k = ((cy + 7 - ry) * W + cx + x) * 4;
        data[k] = data[k + 1] = data[k + 2] = v; data[k + 3] = 255;
      }
    });
  });
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

const VS = /* glsl */ `
attribute vec3 iPos; attribute vec4 iData; attribute vec3 iColor;
uniform vec2 uGrid;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
void main() {
  bool isFlat = iData.w > 1.5;
  if (isFlat) {
    // lying on the ground or the water: ripples, puddle rings
    gl_Position = projectionMatrix * viewMatrix * vec4(iPos + vec3(position.x, 0.0, -position.y) * iData.x, 1.0);
  } else {
    vec4 mv = viewMatrix * vec4(iPos, 1.0);
    mv.xy += position.xy * iData.x;
    gl_Position = projectionMatrix * mv;
  }
  float f = floor(iData.y + 0.5);
  vec2 cell = vec2(mod(f, uGrid.x), floor(f / uGrid.x));
  vec2 u = uv;
  if (mod(iData.w, 2.0) > 0.5) u.x = 1.0 - u.x;
  vUv = (cell + u) / uGrid;
  vColor = iColor; vAlpha = iData.z;
}`;
const FS = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uLight; uniform float uAdd;
varying vec2 vUv; varying vec3 vColor; varying float vAlpha;
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  // fade by dissolving on an ordered dither grid instead of blending, so pixels stay crisp
  vec2 p = floor(gl_FragCoord.xy / 2.0);
  float th = fract(dot(p, vec2(0.5, 0.25)) + 0.125 * mod(p.x, 2.0));
  if (vAlpha < 0.98 && vAlpha < th + 0.06) discard;
  // [world3] lit particles take the scene light; "glowing" ones are unlit pixels in their own colour
  gl_FragColor = vec4(t.rgb * vColor * (uAdd > 0.5 ? vec3(1.0) : uLight), 1.0);
  #include <colorspace_fragment>
}`;

export interface Emit {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  life: number;
  size?: number;
  frame: number;
  /** cycle through this many consecutive frames at `fps` */
  frames?: number; fps?: number;
  color?: number;
  gravity?: number; drag?: number; wind?: number;
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
}

interface P extends Required<Omit<Emit, 'tx' | 'ty' | 'tz'>> { age: number; seed: number; tx: number; ty: number; tz: number; landed: boolean; r: number; g: number; b: number }

class Layer {
  readonly mesh: THREE.Mesh;
  private geo = new THREE.InstancedBufferGeometry();
  private pos: Float32Array; private dat: Float32Array; private col: Float32Array;
  readonly mat: THREE.ShaderMaterial;
  list: P[] = [];
  constructor(private max: number, tex: THREE.Texture, add: boolean) {
    const q = new THREE.PlaneGeometry(1, 1);
    this.geo.index = q.index; this.geo.attributes.position = q.attributes.position; this.geo.attributes.uv = q.attributes.uv;
    this.pos = new Float32Array(max * 3); this.dat = new Float32Array(max * 4); this.col = new Float32Array(max * 3);
    for (const [n, a, s] of [['iPos', this.pos, 3], ['iData', this.dat, 4], ['iColor', this.col, 3]] as const) {
      const at = new THREE.InstancedBufferAttribute(a, s);
      at.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(n, at);
    }
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, depthWrite: !add, transparent: false, blending: THREE.NormalBlending,
      uniforms: { uMap: { value: tex }, uGrid: { value: new THREE.Vector2(COLS, ROWS) }, uLight: { value: new THREE.Color(1, 1, 1) }, uAdd: { value: add ? 1 : 0 } },
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = add ? 8 : 3;
  }
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
        if (p.land) { const gy = groundY(p.x, p.z) + 0.04; if (p.y <= gy) { p.y = gy; p.landed = true; } }
      }
      const fi = Math.min(1, p.fadeIn ? p.age / p.fadeIn : 1), fo = Math.min(1, p.fadeOut ? (p.life - p.age) / p.fadeOut : 1);
      const frame = p.frame + (p.frames > 1 && !p.landed ? Math.floor(p.age * p.fps + p.seed * p.frames) % p.frames : 0);
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.dat[n * 4] = p.size * (1 + p.grow * (p.age / p.life)); this.dat[n * 4 + 1] = frame; this.dat[n * 4 + 2] = fi * fo; this.dat[n * 4 + 3] = (p.seed > 0.5 ? 1 : 0) + (p.flat ? 2 : 0);
      this.col[n * 3] = p.r; this.col[n * 3 + 1] = p.g; this.col[n * 3 + 2] = p.b;
      L[n++] = p;
    }
    L.length = n;
    this.geo.instanceCount = n;
    for (const a of ['iPos', 'iData', 'iColor']) (this.geo.attributes[a] as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
}

const tmp = new THREE.Color();

export type BurstKind = 'hearts' | 'stars' | 'notes' | 'dust' | 'sparkle' | 'coins' | 'crumbs' | 'splash' | 'zzz' | 'leaves' | 'bang' | 'ask' | 'dots' | 'confetti'
  | 'puffs' | 'magic' | 'feathers' | 'petals' | 'snow';

export class Fx {
  readonly group = new THREE.Group();
  private solid: Layer; private glow: Layer;
  /** wind push in blocks/s, set by the world each frame */
  windX = 0.5; windZ = 0.35;
  constructor(max = 1600) {
    const tex = atlas();
    this.solid = new Layer(max, tex, false);
    this.glow = new Layer(Math.floor(max / 2), tex, true);
    this.group.add(this.solid.mesh, this.glow.mesh);
  }
  setLight(c: THREE.Color) { (this.solid.mat.uniforms.uLight.value as THREE.Color).copy(c).multiplyScalar(1.25); }
  emit(e: Emit) {
    tmp.setHex(e.color ?? 0xffffff);
    const p: P = {
      vx: 0, vy: 0, vz: 0, size: 0.5, frames: 1, fps: 6, color: 0xffffff, gravity: 0, drag: 0, wind: 0, add: false, fadeIn: 0, fadeOut: 0.3, grow: 0, land: false, flutter: 0, pull: 0, swirl: 0, delay: 0,
      tx: 0, ty: 0, tz: 0, flat: false, ...e, age: 0, seed: Math.random(), landed: false, r: tmp.r, g: tmp.g, b: tmp.b,
    };
    (e.add ? this.glow : this.solid).push(p);
  }
  update(dt: number, t: number) { this.solid.update(dt, t, this.windX, this.windZ); this.glow.update(dt, t, this.windX, this.windZ); }
  get count() { return this.solid.list.length + this.glow.list.length; }

  // ---- presets

  burst(kind: BurstKind, x: number, y: number, z: number, n = 6, color?: number) {
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < n; i++) {
      const a = R(0, Math.PI * 2);
      switch (kind) {
        case 'hearts': this.emit({ x: x + R(-0.3, 0.3), y, z: z + R(-0.2, 0.2), vy: R(0.5, 0.9), life: R(1, 1.5), frame: SPR.heart, color: i % 2 ? 0xc9828a : 0xe8b4ae, size: R(0.32, 0.46), flutter: 0.25, fadeIn: 0.1, delay: i * 0.12 }); break;
        case 'notes': this.emit({ x: x + R(-0.3, 0.3), y, z, vy: R(0.5, 0.8), vx: R(-0.2, 0.2), life: 1.4, frame: SPR.note, color: [0x86a9b0, 0xdcb072, 0xd9aca4][i % 3], size: 0.4, flutter: 0.3, delay: i * 0.18 }); break;
        case 'stars': this.emit({ x, y, z, vx: Math.cos(a) * R(0.8, 1.6), vy: R(1, 2.2), vz: Math.sin(a) * R(0.8, 1.6), life: R(0.7, 1.1), frame: SPR.star, color: i % 2 ? 0xdcb072 : 0xf1d39a, size: R(0.3, 0.45), gravity: 3, drag: 1.2 }); break;
        case 'sparkle': this.emit({ x: x + R(-0.5, 0.5), y: y + R(-0.2, 0.6), z: z + R(-0.5, 0.5), life: R(0.4, 0.8), frame: SPR.spark1, frames: 3, fps: 8, color: 0xf1d39a, size: R(0.3, 0.5), add: true, delay: i * 0.05 }); break;
        case 'dust': this.emit({ x: x + R(-0.15, 0.15), y: y + 0.05, z: z + R(-0.15, 0.15), vx: Math.cos(a) * 0.4, vy: R(0.2, 0.5), vz: Math.sin(a) * 0.4, life: R(0.35, 0.55), frame: SPR.puff1, frames: 3, fps: 7, color: 0xdccfb0, size: R(0.25, 0.4), drag: 2 }); break;
        case 'coins': this.emit({ x, y, z, vx: Math.cos(a) * R(0.6, 1.5), vy: R(2, 3.4), vz: Math.sin(a) * R(0.6, 1.5), life: R(0.9, 1.3), frame: SPR.coin, color: 0xc8a764, size: 0.34, gravity: 7, land: true, fadeOut: 0.2 }); break;
        case 'crumbs': this.emit({ x, y, z, vx: Math.cos(a) * R(0.3, 0.8), vy: R(0.6, 1.3), vz: Math.sin(a) * R(0.3, 0.8), life: R(0.5, 0.8), frame: SPR.crumb, color: [0xc59a52, 0xf4eedd, 0xbf9d74][i % 3], size: 0.4, gravity: 6, land: true }); break;
        case 'splash': this.emit({ x, y, z, vx: Math.cos(a) * R(0.4, 1.1), vy: R(1.2, 2.4), vz: Math.sin(a) * R(0.4, 1.1), life: R(0.5, 0.8), frame: SPR.drop, color: 0xdfe9ea, size: 0.28, gravity: 7 }); break;
        case 'zzz': this.emit({ x: x + i * 0.12, y: y + i * 0.1, z, vx: 0.12, vy: 0.3, life: 1.8, frame: SPR.zed, color: 0xd3cce0, size: 0.28 + i * 0.08, fadeIn: 0.2, delay: i * 0.5 }); break;
        case 'leaves': this.emit({ x: x + R(-0.6, 0.6), y: y + R(-0.3, 0.3), z: z + R(-0.6, 0.6), vx: Math.cos(a) * 0.8, vy: R(0.6, 1.6), vz: Math.sin(a) * 0.8, life: R(1.2, 2), frame: SPR.leaf1, frames: 3, fps: 5, color: [0x66844f, 0x86a06a, 0xa7b788][i % 3], size: 0.4, gravity: 2.2, drag: 1.4, wind: 0.6, flutter: 0.5, land: true }); break;
        case 'confetti': this.emit({ x, y, z, vx: Math.cos(a) * R(0.8, 2), vy: R(2, 3.6), vz: Math.sin(a) * R(0.8, 2), life: R(1.1, 1.7), frame: SPR.pixel, color: [0xd9aca4, 0xdcb072, 0x86a9b0, 0xa7b788, 0xb4a9c9][i % 5], size: R(0.1, 0.16), gravity: 5, drag: 1, flutter: 0.6, land: true }); break;
        // [world] happy puffs, magic swirls, feathers, petals and snow
        case 'puffs': this.emit({ x: x + R(-0.15, 0.15), y: y + R(-0.1, 0.2), z: z + R(-0.15, 0.15), vx: Math.cos(a) * R(0.9, 1.8), vy: R(0.3, 1.1), vz: Math.sin(a) * R(0.9, 1.8), life: R(0.6, 0.95), frame: i % 3 ? SPR.cloud : SPR.cloud2, color: color ?? [0xf4eedd, 0xeae0c8, 0xd3cce0][i % 3], size: R(0.26, 0.44), grow: 0.9, drag: 3.4, fadeOut: 0.35, delay: i * 0.015 }); break;
        case 'magic': {
          const r0 = R(0.35, 0.7);
          this.emit({ x: x + Math.cos(a) * r0, y: y + R(-0.2, 0.3), z: z + Math.sin(a) * r0, vx: -Math.sin(a) * 1.4, vy: R(0.7, 1.4), vz: Math.cos(a) * 1.4, life: R(0.9, 1.4), frame: [SPR.spark1, SPR.diamond, SPR.orb][i % 3], frames: i % 3 ? 1 : 3, fps: 9, color: color ?? [0xb4a9c9, 0xbcd6dc, 0xf1d39a, 0xd9aca4][i % 4], size: R(0.22, 0.4), add: true, tx: x, ty: y + 1.6, tz: z, pull: 0.6, swirl: 3.2, fadeIn: 0.1, fadeOut: 0.4, delay: i * 0.03 });
          break;
        }
        case 'feathers': this.emit({ x: x + R(-0.2, 0.2), y: y + R(-0.1, 0.3), z: z + R(-0.2, 0.2), vx: Math.cos(a) * R(0.8, 2), vy: R(0.6, 1.8), vz: Math.sin(a) * R(0.8, 2), life: R(1.6, 2.6), frame: SPR.feather1, frames: 3, fps: 3, color: color ?? 0xd9bf93, size: R(0.2, 0.3), gravity: 1.1, drag: 2.4, flutter: 0.7, land: true }); break;
        case 'petals': this.emit({ x: x + R(-0.6, 0.6), y: y + R(-0.2, 0.4), z: z + R(-0.6, 0.6), vx: Math.cos(a) * 0.6, vy: R(0.4, 1.2), vz: Math.sin(a) * 0.6, life: R(1.6, 2.4), frame: SPR.petal, color: color ?? [0xe8b4ae, 0xf4eedd, 0xd9aca4][i % 3], size: R(0.22, 0.32), gravity: 1.2, drag: 1.5, wind: 0.6, flutter: 0.7, land: true }); break;
        case 'snow': this.emit({ x: x + R(-0.8, 0.8), y: y + R(0, 0.6), z: z + R(-0.8, 0.8), vy: R(-0.3, -0.1), life: R(2, 3), frame: SPR.flake, color: color ?? 0xf5f7f2, size: R(0.14, 0.22), gravity: 0.2, drag: 1, wind: 0.4, flutter: 0.4, land: true }); break;
        case 'bang': case 'ask': case 'dots': this.emit({ x, y, z, vy: 0.25, life: 1.2, frame: kind === 'bang' ? SPR.bang : kind === 'ask' ? SPR.ask : SPR.dots, color: kind === 'bang' ? 0xdcb072 : 0xf4eedd, size: 0.5, fadeIn: 0.08 }); return;
      }
    }
  }

  /** A ring ripple spreading flat on the pond. */
  ripple(x: number, y: number, z: number) {
    this.emit({ x, y: y + 0.03, z, life: 0.9, frame: SPR.ring, color: 0xdfe9ea, size: 0.3, grow: 2.4, fadeOut: 0.5, flat: true });
  }
}
