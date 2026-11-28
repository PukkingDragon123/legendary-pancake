// The shared kit for the 3D transition sets (src/ui/chrome/trans3d.ts): maths, a light rig (warm key, cool rim, soft
// sky fill), painted canvas textures, a screen-space painted backdrop, instancing helpers and fake soft shadows.
//
// Rules every set keeps (they are what keeps a transition smooth on a phone):
//   - nothing is allocated while a transition plays: poses write into scratch objects and instance buffers
//   - many things are one InstancedMesh; textures are small canvases (128-512 px)
//   - no shadow maps and no post passes: shadows are soft dark quads or a darkening in the backdrop shader
//   - every pose is a pure function of the run's clock T (0..1 covers, 1..2 uncovers): at T = 1 the screen is covered
import * as THREE from 'three';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const ease = (x: number) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** a stable random number 0..1 for (i, k) */
export const hh = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
export const TAU = Math.PI * 2;

/** the run's options, read by the poses every frame (no rebuild) */
export interface Run {
  rev: boolean;
  /** the centre (iris, clock, fireflies, the sun), as fractions of the screen 0..1 from the top left */
  cx: number; cy: number;
}

/** what a set sees of the runner */
export interface Kit {
  cam: THREE.PerspectiveCamera;
  env: THREE.Texture | null;
  run: Run;
  /** the key light's direction (towards the light), view space = world space here */
  key: THREE.Vector3;
}

export interface Set3D {
  scene: THREE.Scene;
  /** pose everything for clock T (0..2) at wall time `time` (s) */
  pose(T: number, time: number): void;
}

/** half-width of the view at distance d */
export const hwAt = (k: Kit, d: number) => Math.tan(THREE.MathUtils.degToRad(k.cam.fov / 2)) * d * k.cam.aspect;
/** half-height of the view at distance d */
export const hvAt = (k: Kit, d: number) => Math.tan(THREE.MathUtils.degToRad(k.cam.fov / 2)) * d;

// ------------------------------------------------------------------ light

export const KEY_DIR = new THREE.Vector3(-4, 6, 5).normalize();

/** warm key from the upper left, cool rim from behind on the right, a soft sky/ground fill and a little reflection */
export function rig(scene: THREE.Scene, k: Kit, o: { key?: number; keyI?: number; rim?: number; rimI?: number; sky?: number; ground?: number; fill?: number; env?: number } = {}) {
  scene.add(new THREE.HemisphereLight(o.sky ?? 0x8090c0, o.ground ?? 0x2a1a10, o.fill ?? 0.7));
  const key = new THREE.DirectionalLight(o.key ?? 0xffe0b0, o.keyI ?? 2.6); key.position.copy(KEY_DIR).multiplyScalar(10); scene.add(key);
  const rim = new THREE.DirectionalLight(o.rim ?? 0x9ab8ff, o.rimI ?? 1.4); rim.position.set(5, 1.5, -3); scene.add(rim);
  void k; void o.env; // reflections only where they matter: brass() takes the room's reflections itself
}
/** light that adds to whatever is under it (the page or the backdrop) without covering it: premultiplied colour, alpha left alone */
export function additive<M extends THREE.Material>(m: M): M {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation; m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor;
  m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor;
  m.transparent = true; m.depthWrite = false; m.premultipliedAlpha = true;
  return m;
}

// ------------------------------------------------------------------ painted textures

const texCache = new Map<string, THREE.Texture>();
/** a canvas texture painted once (cached by key) */
export function paint(key: string, w: number, h: number, f: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { repeat?: boolean; data?: boolean; mips?: boolean } = {}): THREE.Texture {
  const have = texCache.get(key);
  if (have) return have;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  f(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (o.mips === false) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
/** a soft round blob (white, alpha falling off): shadows, glows */
export function blobTex(): THREE.Texture {
  return paint('blob', 64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }, { mips: false });
}
/** paint loose brush strokes (a hand-painted surface): n strokes of colours `cols`, length l, width w */
export function strokes(g: CanvasRenderingContext2D, W: number, H: number, cols: string[], n: number, l: number, w: number, ang = 0, seed = 1, alpha = 0.35) {
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = hh(i, seed) * W, y = hh(i, seed + 1) * H, a = ang + (hh(i, seed + 2) - 0.5) * 0.5, L = l * (0.5 + hh(i, seed + 3));
    g.strokeStyle = cols[i % cols.length]; g.globalAlpha = alpha * (0.5 + hh(i, seed + 4) * 0.5); g.lineWidth = w * (0.5 + hh(i, seed + 5));
    g.beginPath(); g.moveTo(x - Math.cos(a) * L / 2, y - Math.sin(a) * L / 2);
    g.quadraticCurveTo(x + (hh(i, seed + 6) - 0.5) * w * 2, y + (hh(i, seed + 7) - 0.5) * w * 2, x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2); g.stroke();
  }
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ GLSL

export const GLSL_NOISE = /* glsl */ `
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ return vn(p) * 0.5 + vn(p * 2.03 + 17.1) * 0.27 + vn(p * 4.1 + 3.7) * 0.15 + vn(p * 8.3 + 9.2) * 0.08; }
float fbm3(vec2 p){ return vn(p) * 0.56 + vn(p * 2.03 + 17.1) * 0.29 + vn(p * 4.1 + 3.7) * 0.15; }
/** lay a soft black shadow s under a painted cover (c, a) */
void shadeIn(inout vec3 c, inout float a, float s){ s *= 1.0 - a; float A = a + s; c *= a / max(A, 1e-4); a = A; }
/** a painted wash: long brush strokes running along d, with their ridges lit from the upper left (impasto) */
vec3 painted(vec2 p, vec2 d, vec3 a, vec3 b, float k){
  vec2 q = vec2(dot(p, d), dot(p, vec2(-d.y, d.x)));
  float s = fbm3(q * vec2(1.2, 7.0) * k), s2 = fbm3((q + vec2(0.0, 0.013)) * vec2(1.2, 7.0) * k);
  float lit = clamp(0.5 + (s - s2) * 14.0, 0.0, 1.0);
  return mix(a, b, smoothstep(0.25, 0.8, s)) * (0.86 + lit * 0.28);
}
`;
/** the backdrop's vertex shader: a full-screen quad at the far plane (things in the scene stand in front of it) */
const BACK_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`;

/**
 * A full-screen painted backdrop: `body` sets `vec3 col` and `float a` (coverage 0..1) from vUv, p (aspect-corrected,
 * centred) and the uniforms uT, uTime, uAspect, uC (the run's centre in uv), uRev (+ extra). Its output is sRGB, not
 * tone mapped (painted to look right as is).
 */
export function backdrop(body: string, extra: Record<string, THREE.IUniform> = {}, head = ''): THREE.Mesh & { material: THREE.ShaderMaterial } {
  const mat = new THREE.ShaderMaterial({
    vertexShader: BACK_VS,
    fragmentShader: `uniform float uT; uniform float uTime; uniform float uAspect; uniform vec2 uC; uniform float uRev;
varying vec2 vUv;
${GLSL_NOISE}
${head}
void main(){
  vec2 uv = vUv; vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);
  float T = uT; vec3 col = vec3(0.0); float a = 0.0;
  ${body}
  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
}`,
    uniforms: { uT: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 }, uC: { value: new THREE.Vector2(0.5, 0.5) }, uRev: { value: 0 }, ...extra },
    transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat) as THREE.Mesh & { material: THREE.ShaderMaterial };
  m.frustumCulled = false;
  m.renderOrder = -100;
  return m;
}
/** set the backdrop's common uniforms */
export function backPose(b: { material: THREE.ShaderMaterial }, k: Kit, T: number, time: number) {
  const u = b.material.uniforms;
  u.uT.value = T; u.uTime.value = time; u.uAspect.value = k.cam.aspect; u.uRev.value = k.run.rev ? 1 : 0;
  (u.uC.value as THREE.Vector2).set(k.run.cx, 1 - k.run.cy);
}

// ------------------------------------------------------------------ instancing

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
/** write instance i's matrix from position, euler rotation and scale (no allocation) */
export function place(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy = sx, sz = sx) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
  m.setMatrixAt(i, _m.compose(_p, _q, _s));
}
/** hide instance i (a zero scale) */
export function hide(m: THREE.InstancedMesh, i: number) { _m.makeScale(0, 0, 0); m.setMatrixAt(i, _m); }
export function done(...ms: THREE.InstancedMesh[]) { for (const m of ms) m.instanceMatrix.needsUpdate = true; }
export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.frustumCulled = false;
  return m;
}
/** per-instance colours from a palette */
export function tint(m: THREE.InstancedMesh, cols: number[], seed = 3, vary = 0.15) {
  const c = new THREE.Color();
  for (let i = 0; i < m.count; i++) { c.set(cols[Math.floor(hh(i, seed) * cols.length) % cols.length]).multiplyScalar(1 - vary + hh(i, seed + 1) * vary * 2); m.setColorAt(i, c); }
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
}

/**
 * Soft contact shadows: one dark blurred quad per thing, laid on a plane at depth `d` behind them, offset away from
 * the key light (down and to the right) by how far in front of the plane the thing is. Darkens the screen under the
 * overlay too, so falling things shadow the page they fall over.
 */
export class Shadows {
  readonly mesh: THREE.InstancedMesh;
  constructor(n: number, readonly d: number, opacity = 0.28, color = 0x1a0c04) {
    const mat = new THREE.MeshBasicMaterial({ map: blobTex(), color, transparent: true, opacity, depthWrite: false, toneMapped: false });
    this.mesh = instanced(new THREE.PlaneGeometry(1, 1), mat, n);
    this.mesh.renderOrder = -50;
  }
  /** the shadow of a thing of size s at (x, y, z) */
  set(i: number, x: number, y: number, z: number, s: number, sx = 1) {
    const h = Math.max(0.1, -z); // distance from the camera
    const lift = Math.max(0, this.d - h); // how far in front of the plane
    const k = this.d / Math.max(0.1, h);
    const off = lift * 0.16;
    place(this.mesh, i, x * k + off, y * k - off * 1.3, -this.d, 0, 0, 0, s * k * (1 + lift * 0.05) * sx, s * k * (1 + lift * 0.05));
  }
  hide(i: number) { hide(this.mesh, i); }
  done() { done(this.mesh); }
}

/** patch a built-in material's shaders (with a cache key so patched and plain materials do not share a program) */
export function patch(mat: THREE.Material, key: string, f: (s: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }) => void) {
  mat.onBeforeCompile = (s) => f(s as unknown as { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> });
  mat.customProgramCacheKey = () => key;
}

/**
 * A thin translucent thing (a leaf, a feather): lambert-lit, double-sided, a texture atlas of `cols` x `rows` cells
 * picked per instance by the `aCell` attribute (its whole part; the fraction is a phase), and light shining through it
 * when its far side faces the key light. `flutter` bends it in the wind.
 */
export function translucent(map: THREE.Texture, cols: number, rows: number, o: { trans?: number; flutter?: number; alphaTest?: number; transparent?: boolean } = {}): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ map, side: THREE.DoubleSide, alphaTest: o.alphaTest ?? 0.5, transparent: !!o.transparent, depthWrite: !o.transparent });
  const uni = { uKey: { value: KEY_DIR }, uTrans: { value: o.trans ?? 0.6 }, uTime: { value: 0 } };
  mat.userData.u = uni;
  const C = cols.toFixed(1), R = rows.toFixed(1);
  patch(mat, `transl${cols}x${rows}${o.flutter ?? 0}`, (s) => {
    Object.assign(s.uniforms, uni);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCell; uniform float uTime;')
      .replace('#include <uv_vertex>', `#include <uv_vertex>
  { float c = floor(aCell); vMapUv = (vMapUv + vec2(mod(c, ${C}), floor(c / ${C}))) / vec2(${C}, ${R}); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
  ${o.flutter ? `{ float ph = fract(aCell) * 6.283; float w = sin(uTime * 7.0 + ph + position.y * 2.2) * ${o.flutter.toFixed(3)};
    transformed.z += w * (position.y + 0.6); transformed.x += w * 0.25 * position.y; }` : ''}`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uKey; uniform float uTrans;')
      .replace('#include <opaque_fragment>', `outgoingLight += diffuseColor.rgb * uTrans * pow(max(dot(-normal, uKey), 0.0), 1.3) * vec3(1.0, 0.85, 0.6);
#include <opaque_fragment>`);
  });
  return mat;
}
/** give an instanced geometry its per-instance atlas cell (+ a phase in the fraction) */
export function cells(geo: THREE.BufferGeometry, n: number, f: (i: number) => number) {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = f(i);
  geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(a, 1));
}

/** brass: polished, warm, reflecting the room */
export function brass(k: Kit, rough = 0.3): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: 0xc8902e, metalness: 1, roughness: rough, envMap: k.env, envMapIntensity: 0.75 });
}
