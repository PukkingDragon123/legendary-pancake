// The 3D elements of the interview's 2D form layer: a transparent WebGL layer above the form that draws live 3D
// models standing on the paper (each in its own window, with a soft contact shadow, gently alive, sliding forward
// when chosen), and the 3D things that move over the paper in screen space: the floating fountain pen (a persistent
// actor drawn with a perspective camera, so it tilts and foreshortens like a real pen), the rubber stamp, a cassette
// flying into the recorder.
//
// [dialog10] Drawn at full device resolution, anti-aliased (4x MSAA into a half-float buffer, filmic tone mapping in
// the composite), with crisp near-black ink outlines that match the world's: a ~2 device px silhouette round each
// object and thinner lines where surfaces crease or one part passes in front of another. Each region (a slot's
// window, a moving object's screen box) is drawn as: soft shadows on the paper; the object's colour and, in a second
// pass, its normals and depth; then a composite that inks the edges; then glows and steam on top.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SlotOpts {
  /** sway speed (0: still) */
  spin?: number; pitch?: number; zoom?: number; yaw?: number; lift?: number; box?: boolean;
  /**
   * 'h' (the default for answer objects): the model's projected height fills a common share of its window, so a
   * little espresso cup reads as large as a tall can; a wide model is limited by the window's width instead
   */
  fit?: 'h';
  /** sway amplitude in radians (0.5) */
  sway?: number;
  /** a soft contact shadow under the model (true) */
  shadow?: boolean;
  focus?: { c: THREE.Vector3; r: number };
  tick?: (o: THREE.Object3D, t: number, dt: number) => void;
}
export type SlotState = 'off' | 'on' | 'back';
interface Slot { el: HTMLElement; obj: THREE.Object3D; cam: THREE.PerspectiveCamera; r: number; c: THREE.Vector3; bw: number; bd: number; bh: number; o: SlotOpts; sel: number; selV: number; born: number; home: THREE.Vector3; fits: number; fwd: number; want: number; hidden: boolean; shadow: THREE.Mesh | null; rect: { x: number; y: number; w: number; h: number } }
interface Moment { obj: THREE.Object3D; t: number; dur: number; f: (k: number, o: THREE.Object3D) => void; done?: () => void; persp: boolean }
interface Actor { obj: THREE.Object3D; f: (dt: number, t: number) => void }
/** a region of the canvas in device px (top-left origin) */
interface Box { x: number; y: number; w: number; h: number }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const sm01 = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** the ink of every outline (near-black, a touch warm, as in the world) */
const INK = { r: 0x14 / 255, g: 0x0c / 255, b: 0x10 / 255 };
/** render layers: what goes in the inked pass, soft shadows under it, glows and steam over it */
const L_SOLID = 1, L_UNDER = 2, L_OVER = 3, L_NONE = 4;

let shadowTex: THREE.Texture | null = null;
/** a soft round contact shadow: dense in the middle where the object meets the paper, feathering out */
function shadowMap() {
  if (shadowTex) return shadowTex;
  const n = 128, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  for (let i = 0; i <= 12; i++) { const d = i / 12, a = sm01(1 - d / 0.94) ** 1.5; gr.addColorStop(d, `rgba(28,14,6,${a.toFixed(3)})`); }
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}
/** A model's bounding box, leaving out decorative effects (steam, glows) marked userData.noFit. */
export function boxOf(o: THREE.Object3D): THREE.Box3 {
  const b = new THREE.Box3(), tmp = new THREE.Box3();
  o.updateWorldMatrix(true, true);
  const walk = (n: THREE.Object3D) => {
    if (n.userData.noFit) return;
    const m = n as THREE.Mesh;
    if (m.isMesh && m.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); tmp.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld); b.union(tmp); }
    for (const c of n.children) walk(c);
  };
  walk(o);
  return b;
}
export function softShadow(opacity = 0.5): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowMap(), transparent: true, depthWrite: false, opacity, toneMapped: false }));
  m.renderOrder = -1;
  return m;
}

// ------------------------------------------------------------------ the ink passes

/** normals and depth of the solid parts: rg = view normal xy, b = depth across the region's range, a = coverage */
const ND_VERT = /* glsl */ `
#include <common>
#include <batching_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
varying vec3 vN; varying float vZ; varying vec2 vUv2;
void main() {
  vUv2 = uv;
  #include <batching_vertex>
  #include <beginnormal_vertex>
  #include <morphinstance_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  #include <project_vertex>
  vN = normalize(transformedNormal);
  vZ = -mvPosition.z;
}`;
const ND_FRAG = /* glsl */ `
uniform vec2 uZ; uniform sampler2D map; uniform float uCut;
varying vec3 vN; varying float vZ; varying vec2 vUv2;
void main() {
  if (uCut > 0.0 && texture2D(map, vUv2).a < uCut) discard;
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  gl_FragColor = vec4(n.xy * 0.5 + 0.5, clamp((vZ - uZ.x) / max(1e-5, uZ.y - uZ.x), 0.0, 1.0), 1.0);
}`;
/** the composite: tone-mapped colour, an ink silhouette round the coverage, ink where depth or normals break */
const COMP_FRAG = /* glsl */ `
uniform sampler2D tC; uniform sampler2D tN; uniform vec2 uTex; uniform vec2 uUse; uniform float uR; uniform float uExp; uniform vec3 uInk; uniform float uLine;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= uExp / 0.6; c = I * c; c = RRTAndODTFit(c); c = O * c; return clamp(c, 0.0, 1.0);
}
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec2 uvAt(vec2 o) { return vUv * uUse + o * uTex; }
float cov(vec2 o) { return texture2D(tN, uvAt(o)).a; }
void main() {
  vec4 c = texture2D(tC, uvAt(vec2(0.0)));
  vec4 n0 = texture2D(tN, uvAt(vec2(0.0)));
  vec3 col = c.a > 1e-4 ? srgb(aces(max(c.rgb / c.a, 0.0))) * c.a : vec3(0.0);
  vec4 o = vec4(col, min(c.a, 1.0));
  // the silhouette: how near the covered texels come (two rings and the axes), outside the coverage only
  float s = 0.0;
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.785398;
    vec2 d = vec2(cos(a), sin(a));
    s = max(s, cov(d));
    s = max(s, cov(d * (uR - 0.5)));
    s = max(s, cov(d * uR) * 0.9);
    s = max(s, cov((d + vec2(-d.y, d.x) * 0.414) * (uR + 0.25) * 0.92) * 0.6);
  }
  s *= 1.0 - n0.a;
  o.rgb += uInk * s; o.a = min(1.0, o.a + s);
  // creases and overlaps: inside the coverage, against the four neighbours
  if (n0.a > 0.5) {
    vec3 N0 = vec3(n0.xy / n0.a * 2.0 - 1.0, 0.0); N0.z = sqrt(max(0.0, 1.0 - dot(N0.xy, N0.xy)));
    float z0 = n0.b / n0.a, e = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 d = i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
      vec4 m = texture2D(tN, uvAt(d * uLine));
      if (m.a < 0.5) continue;
      float z1 = m.b / m.a;
      vec3 N1 = vec3(m.xy / m.a * 2.0 - 1.0, 0.0); N1.z = sqrt(max(0.0, 1.0 - dot(N1.xy, N1.xy)));
      e = max(e, smoothstep(0.012, 0.03, z1 - z0));
      e = max(e, smoothstep(0.3, 0.62, 1.0 - dot(N0, N1)) * 0.7);
    }
    e *= 0.9 * min(1.0, n0.a);
    o = vec4(o.rgb * (1.0 - e) + uInk * e, o.a * (1.0 - e) + e);
  }
  gl_FragColor = o;
}`;

const ndCache = new WeakMap<THREE.Material, THREE.ShaderMaterial>();
const zRange = { value: new THREE.Vector2(0, 1) };
function ndOf(src: THREE.Material): THREE.ShaderMaterial {
  let m = ndCache.get(src);
  if (m) return m;
  const s = src as THREE.MeshStandardMaterial;
  const cut = s.alphaTest > 0 && s.map ? s.alphaTest : 0;
  m = new THREE.ShaderMaterial({ vertexShader: ND_VERT, fragmentShader: ND_FRAG, side: src.side, uniforms: { uZ: zRange, map: { value: cut ? s.map : null }, uCut: { value: cut } } });
  ndCache.set(src, m);
  return m;
}
const kindOf = (o: THREE.Mesh): number => {
  const mat = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshBasicMaterial | undefined;
  if (!mat || mat.visible === false) return L_NONE; // framing helpers
  if (!mat.transparent || mat.depthWrite) return L_SOLID;
  if (o.renderOrder < 0) return L_UNDER;
  return mat.isMeshBasicMaterial ? L_OVER : L_SOLID;
};

function tri() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
}

export class Overlay3D {
  readonly canvas = document.createElement('canvas');
  private R: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private slots = new Map<string, Slot>();
  private moments: Moment[] = [];
  private actors = new Set<Actor>();
  private screen = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
  /** a perspective camera over the screen: the plane z = 0 maps 1:1 to CSS px (x right, y up = -CSS y) */
  readonly persp = new THREE.PerspectiveCamera(24, 1, 10, 20000);
  private t = 0;
  private n = 0;
  /** CSS px per pixel of the form's paper art (kept for callers; the models are drawn at device resolution) */
  k = 2;
  private w = 1; private h = 1;
  /** device px per CSS px */
  private pr = 1;
  /** time scale of the moments (1; the dev harness slows them down to look at them) */
  pace = 1;
  /** hold every moment at this point of its play (dev harness), or null */
  freeze: number | null = null;
  exposure = 1.05;
  /** the inked path (WebGL2 with renderable half floats); without it the models are drawn straight, unoutlined */
  private ink: boolean;
  private rtC: THREE.WebGLRenderTarget | null = null;
  private rtN: THREE.WebGLRenderTarget | null = null;
  private rtW = 0; private rtH = 0;
  private comp: THREE.ShaderMaterial;
  private compScene = new THREE.Scene();
  private compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private swap: { m: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[] = [];

  constructor() {
    const c = this.canvas;
    Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '46' });
    this.R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: false, premultipliedAlpha: true });
    this.R.setPixelRatio(1);
    this.R.outputColorSpace = THREE.SRGBColorSpace;
    this.R.toneMapping = THREE.ACESFilmicToneMapping;
    this.R.toneMappingExposure = this.exposure;
    this.R.setClearColor(0x000000, 0);
    this.R.autoClear = false;
    const ex = this.R.extensions;
    this.ink = this.R.capabilities.isWebGL2 && (ex.has('EXT_color_buffer_float') || ex.has('EXT_color_buffer_half_float'));
    // light: a warm key from the upper left (as on the paper), a cool rim, sky and floor fill, and a room's reflections
    try { this.scene.environment = new THREE.PMREMGenerator(this.R).fromScene(new RoomEnvironment(), 0.04).texture; (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.62; } catch { /* plain lights */ }
    const hemi = new THREE.HemisphereLight(0xfff0dc, 0x46301e, 1.05);
    const key = new THREE.DirectionalLight(0xffe2b8, 2.6); key.position.set(-2, 4, 3);
    const rim = new THREE.DirectionalLight(0xa8c8ff, 0.95); rim.position.set(3, 2.2, -3);
    const fill = new THREE.DirectionalLight(0xffd6a8, 0.35); fill.position.set(2.5, 0.6, 3);
    for (const l of [hemi, key, rim, fill]) { l.layers.enableAll(); this.scene.add(l); }
    this.comp = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: COMP_FRAG, depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: { tC: { value: null }, tN: { value: null }, uTex: { value: new THREE.Vector2() }, uUse: { value: new THREE.Vector2() }, uR: { value: 2 }, uExp: { value: 1 }, uInk: { value: new THREE.Vector3(INK.r, INK.g, INK.b) } /* display values: the shader works after the sRGB encode */, uLine: { value: 1 } },
    });
    const q = new THREE.Mesh(tri(), this.comp);
    q.frustumCulled = false;
    this.compScene.add(q);
    document.body.appendChild(c);
    this.resize();
  }

  resize() {
    this.pr = Math.min(3, Math.max(1, devicePixelRatio || 1));
    this.w = Math.max(16, Math.round(innerWidth * this.pr)); this.h = Math.max(16, Math.round(innerHeight * this.pr));
    this.R.setSize(this.w, this.h, false);
    // a screen-space camera in CSS px (x right, y down)
    Object.assign(this.screen, { left: 0, right: innerWidth, top: 0, bottom: -innerHeight });
    this.screen.updateProjectionMatrix();
    const P = this.persp, D = innerHeight / 2 / Math.tan((P.fov * Math.PI) / 360);
    P.aspect = innerWidth / innerHeight;
    P.position.set(innerWidth / 2, -innerHeight / 2, D);
    P.near = D * 0.2; P.far = D * 3;
    P.lookAt(innerWidth / 2, -innerHeight / 2, 0);
    P.updateProjectionMatrix();
    // silhouettes about 2 device px (1.5 on a 1x screen), creases one
    this.comp.uniforms.uR.value = Math.max(1.5, Math.min(2.4, 0.8 * this.pr + 0.5));
  }
  setScale(k: number) { if (k !== this.k) { this.k = k; this.resize(); } }

  /** Put a model in a window (the element's box). The model is fitted and framed in a three-quarter view. */
  setSlot(id: string, el: HTMLElement, obj: THREE.Object3D, o: SlotOpts = {}) {
    this.removeSlot(id);
    const home = V(this.n++ * 50, 0, 0);
    obj.position.add(home);
    this.scene.add(obj);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 200);
    const shadow = o.shadow === false ? null : softShadow(0.55);
    if (shadow) { shadow.rotation.x = -Math.PI / 2; this.scene.add(shadow); }
    const s: Slot = { el, obj, cam, r: 0, c: home.clone(), bw: 0, bd: 0, bh: 0, o, sel: 0, selV: 0, born: this.t, home, fits: 0, fwd: 0, want: 0, hidden: false, shadow, rect: { x: 0, y: 0, w: 0, h: 0 } };
    this.fit(s);
    this.slots.set(id, s);
  }
  /** frame the model (again: models that load late, like the owls, are refitted for their first frames) */
  private fit(s: Slot) {
    if (s.o.focus) { s.c.copy(s.home).add(s.o.focus.c); s.r = s.o.focus.r; return; }
    const rot = s.obj.rotation.y, sc = s.obj.scale.x, py = s.obj.position.y, pz = s.obj.position.z;
    s.obj.rotation.y = 0; s.obj.scale.setScalar(1); s.obj.position.y = s.home.y; s.obj.position.z = s.home.z;
    s.obj.updateMatrixWorld(true);
    const box = boxOf(s.obj);
    s.obj.rotation.y = rot; s.obj.scale.setScalar(sc); s.obj.position.y = py; s.obj.position.z = pz;
    if (box.isEmpty()) return;
    const sph = box.getBoundingSphere(new THREE.Sphere()), sz = box.getSize(V(0, 0, 0));
    s.r = sph.radius; s.c.copy(sph.center); s.bw = Math.max(sz.x, sz.z); s.bd = Math.min(sz.x, sz.z); s.bh = sz.y;
  }
  removeSlot(id: string) { const s = this.slots.get(id); if (!s) return; this.scene.remove(s.obj); if (s.shadow) this.scene.remove(s.shadow); this.slots.delete(id); }
  clearSlots() { for (const id of [...this.slots.keys()]) this.removeSlot(id); }
  has(id: string) { return this.slots.has(id); }
  /** a little hop when picked */
  pick(id: string) { const s = this.slots.get(id); if (s) s.selV += 5; }
  /** chosen (slides forward), not chosen (steps back, a little darker) or neutral */
  setState(id: string, st: SlotState) { const s = this.slots.get(id); if (s) s.want = st === 'on' ? 1 : st === 'back' ? -1 : 0; }
  /** hide a slot's model (it is flying somewhere else for a moment) */
  hide(id: string, on: boolean) { const s = this.slots.get(id); if (s) s.hidden = on; }
  /** where a point given in the slot model's own space lands on screen (CSS px), and how many CSS px a metre there is */
  project(id: string, local: THREE.Vector3): { x: number; y: number; ppm: number } | null {
    const s = this.slots.get(id);
    if (!s || !s.rect.w) return null;
    s.obj.updateMatrixWorld(true);
    const wp = local.clone().applyMatrix4(s.obj.matrixWorld), p = wp.clone().project(s.cam);
    const dist = s.cam.position.distanceTo(wp), tv = Math.tan((s.cam.fov * Math.PI) / 360);
    const ppm = (s.rect.h / 2) / (dist * tv) * s.obj.scale.x;
    return { x: s.rect.x + (p.x * 0.5 + 0.5) * s.rect.w, y: s.rect.y + (-p.y * 0.5 + 0.5) * s.rect.h, ppm };
  }

  /** where a world point seen by a slot's camera lands on screen (CSS px) */
  projectWorld(id: string, wp: THREE.Vector3): { x: number; y: number } | null {
    const s = this.slots.get(id);
    if (!s || !s.rect.w) return null;
    const p = wp.clone().project(s.cam);
    return { x: s.rect.x + (p.x * 0.5 + 0.5) * s.rect.w, y: s.rect.y + (-p.y * 0.5 + 0.5) * s.rect.h };
  }

  /** Play a 3D object over the page in screen space (CSS px; y down): f places it each frame. */
  play(obj: THREE.Object3D, dur: number, f: (k: number, o: THREE.Object3D) => void, done?: () => void, persp = false) {
    this.scene.add(obj);
    this.moments.push({ obj, t: 0, dur, f, done, persp });
  }
  /** A persistent screen-space object (perspective pass): f updates it every frame until the returned stop(). */
  actor(obj: THREE.Object3D, f: (dt: number, t: number) => void): () => void {
    const a: Actor = { obj, f };
    this.scene.add(obj);
    this.actors.add(a);
    return () => { this.actors.delete(a); this.scene.remove(obj); };
  }

  // ---------------------------------------------------------------- drawing

  /** sort the meshes under `roots` into the passes (and let every light in them light every pass) */
  private sortLayers(roots: THREE.Object3D[]) {
    for (const r of roots) r.traverse((o) => {
      if ((o as THREE.Light).isLight) { o.layers.enableAll(); return; }
      const m = o as THREE.Mesh;
      if (m.isMesh) m.layers.set(kindOf(m));
      else o.layers.enableAll();
    });
  }
  private ensureRT(w: number, h: number) {
    if (this.rtC && w <= this.rtW && h <= this.rtH) return;
    const W = Math.min(2048, Math.max(this.rtW, Math.ceil(w / 64) * 64)), H = Math.min(2048, Math.max(this.rtH, Math.ceil(h / 64) * 64));
    this.rtW = W; this.rtH = H;
    const samples = Math.min(4, this.R.capabilities.maxSamples || 0);
    if (!this.rtC) {
      this.rtC = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
      this.rtN = new THREE.WebGLRenderTarget(W, H, { type: THREE.UnsignedByteType, samples, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    } else { this.rtC.setSize(W, H); this.rtN!.setSize(W, H); }
  }
  /**
   * Draw what `cam` sees of the visible scene into a device-px box of the canvas: shadows under, the solid parts
   * inked, glows over. `zr` is the depth range of what is drawn (for the crease test).
   */
  private region(cam: THREE.Camera, b: Box, exposure: number, zr: [number, number]) {
    const R = this.R, gy = this.h - b.y - b.h;
    // shadows on the paper, straight onto the canvas
    R.setRenderTarget(null);
    R.setViewport(b.x, gy, b.w, b.h); R.setScissor(b.x, gy, b.w, b.h); R.setScissorTest(true);
    R.toneMappingExposure = exposure;
    cam.layers.set(L_UNDER); R.clearDepth(); R.render(this.scene, cam);
    if (!this.ink) { cam.layers.set(L_SOLID); cam.layers.enable(L_OVER); R.clearDepth(); R.render(this.scene, cam); cam.layers.enableAll(); return; }
    this.ensureRT(b.w, b.h);
    const C = this.rtC!, N = this.rtN!;
    // the solid parts: their colour, then their normals and depth
    cam.layers.set(L_SOLID);
    // clear a margin round the box too: the ink kernel reads a few texels past its edge
    const cw = Math.min(this.rtW, b.w + 4), chh = Math.min(this.rtH, b.h + 4);
    for (const t of [C, N]) { t.viewport.set(0, 0, b.w, b.h); t.scissor.set(0, 0, cw, chh); t.scissorTest = true; R.setRenderTarget(t); R.clear(true, true, false); t.scissor.set(0, 0, b.w, b.h); }
    R.setRenderTarget(C); R.render(this.scene, cam);
    zRange.value.set(zr[0], zr[1]);
    this.swap.length = 0;
    this.scene.traverseVisible((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.layers.isEnabled(L_SOLID)) return;
      this.swap.push({ m, mat: m.material });
      m.material = Array.isArray(m.material) ? m.material.map(ndOf) : ndOf(m.material);
    });
    R.setRenderTarget(N); R.render(this.scene, cam);
    for (const s of this.swap) s.m.material = s.mat;
    this.swap.length = 0;
    // ink it onto the canvas
    R.setRenderTarget(null);
    R.setViewport(b.x, gy, b.w, b.h); R.setScissor(b.x, gy, b.w, b.h); R.setScissorTest(true);
    const u = this.comp.uniforms;
    u.tC.value = C.texture; u.tN.value = N.texture; u.uExp.value = exposure;
    (u.uTex.value as THREE.Vector2).set(1 / this.rtW, 1 / this.rtH);
    (u.uUse.value as THREE.Vector2).set(b.w / this.rtW, b.h / this.rtH);
    R.render(this.compScene, this.compCam);
    // glows and steam on top
    cam.layers.set(L_OVER); R.clearDepth(); R.render(this.scene, cam);
    cam.layers.enableAll();
  }
  /** the device-px box of an object as `cam` shows it (CSS-px cameras over the screen), padded for the ink */
  private screenBox(o: THREE.Object3D, cam: THREE.Camera): Box | null {
    const bb = boxOf(o);
    if (bb.isEmpty()) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const p = new THREE.Vector3();
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z).project(cam);
      if (p.z > 1) return { x: 0, y: 0, w: this.w, h: this.h };
      const sx = (p.x * 0.5 + 0.5) * this.w, sy = (-p.y * 0.5 + 0.5) * this.h;
      x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    }
    const pad = 6 * this.pr;
    const x = Math.max(0, Math.floor(x0 - pad)), y = Math.max(0, Math.floor(y0 - pad));
    const w = Math.min(this.w, Math.ceil(x1 + pad)) - x, h = Math.min(this.h, Math.ceil(y1 + pad)) - y;
    return w > 1 && h > 1 ? { x, y, w, h } : null;
  }
  /** depth range of an object in a camera's view (for the crease test) */
  private zRangeOf(o: THREE.Object3D, cam: THREE.Camera): [number, number] {
    const bb = boxOf(o), sph = bb.getBoundingSphere(new THREE.Sphere());
    const d = -sph.center.clone().applyMatrix4(cam.matrixWorldInverse).z;
    return [d - sph.radius * 1.05, d + sph.radius * 1.05];
  }

  update(dt: number) {
    this.t += dt;
    const R = this.R;
    R.setRenderTarget(null);
    R.setScissorTest(false);
    R.setViewport(0, 0, this.w, this.h);
    R.clear();
    const hideAll = () => { for (const o of this.slots.values()) { o.obj.visible = false; if (o.shadow) o.shadow.visible = false; } for (const m of this.moments) m.obj.visible = false; for (const a of this.actors) a.obj.visible = false; };
    const pr = this.pr;
    for (const s of this.slots.values()) {
      const b = s.el.getBoundingClientRect();
      s.rect = { x: b.left, y: b.top, w: b.width, h: b.height };
      if (b.width < 4 || b.bottom < 0 || b.top > innerHeight || !s.el.isConnected) continue;
      // refit for the first seconds (and for as long as nothing has loaded): owls arrive late on slow devices
      if (!s.o.focus && (s.r < 1e-4 || this.t - s.born < 8) && s.fits++ % 4 === 0) this.fit(s);
      if (s.r < 1e-4) continue;
      // springy hop when picked; slide forward when chosen, step back when another is
      s.selV += (-s.sel * 120 - s.selV * 10) * dt; s.sel += s.selV * dt;
      s.fwd += (s.want - s.fwd) * Math.min(1, dt * 7);
      const age = Math.min(1, (this.t - s.born) / 0.4), pop = age < 1 ? 1 - (1 - age) ** 3 : 1;
      const sway = (s.o.yaw ?? 0.6) + Math.sin(this.t * (s.o.spin ?? 0.5) + s.home.x * 0.07) * (s.o.sway ?? 0.5);
      s.obj.rotation.y = sway + Math.max(0, s.fwd) * Math.sin(this.t * 1.6) * 0.12;
      s.obj.position.y = s.home.y + Math.max(0, s.sel) * s.r * 0.25;
      s.obj.position.z = s.home.z + s.fwd * s.r * (s.fwd > 0 ? 0.42 : 0.3);
      s.obj.scale.setScalar(Math.max(0.001, pop));
      s.o.tick?.(s.obj, this.t, dt);
      // the window in device px, on whole pixels
      const x = Math.floor(b.left * pr), y = Math.floor(b.top * pr), w = Math.min(this.w - x, Math.ceil(b.right * pr) - x), h = Math.min(this.h - y, Math.ceil(b.bottom * pr) - y);
      if (w < 2 || h < 2 || x >= this.w || y >= this.h) continue;
      const cam = s.cam;
      cam.aspect = w / h;
      const fit = Math.max(1, 1 / Math.min(1, cam.aspect));
      const tv = Math.tan((cam.fov * Math.PI) / 360);
      // a sphere fit for compact things; wide heaps fit their box to the window
      const pitch = s.o.pitch ?? 0.32;
      let dist: number;
      if (s.o.fit === 'h') {
        // what the camera sees of the box at this pitch: its height foreshortened plus the top of its depth
        const depth = Math.max(s.bd, s.bw * 0.7), ph = s.bh * Math.cos(pitch) + depth * Math.sin(pitch);
        dist = (s.o.zoom ?? 1) * Math.max(ph / 2 / (tv * 0.9), s.bw / 2 / (tv * cam.aspect * 0.92)) + depth * 0.3;
      } else dist = s.o.box ? (s.o.zoom ?? 1) * Math.max(s.bh / 2 / tv, s.bw / 2 / (tv * cam.aspect)) + s.bw / 2 : (s.r * (s.o.zoom ?? 1.0) * fit) / tv;
      const c = s.c.clone().add(V(0, s.r * (s.o.lift ?? 0), 0));
      cam.position.set(c.x, c.y + Math.sin(pitch) * dist, c.z + Math.cos(pitch) * dist);
      cam.near = Math.max(1e-3, dist - s.r * 3); cam.far = dist + s.r * 3;
      cam.lookAt(c);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      if (s.hidden) continue;
      // only this slot's object is near its camera; hide the rest for the pass
      hideAll();
      s.obj.visible = true;
      if (s.shadow && !s.o.focus) {
        s.shadow.visible = true;
        const lift = Math.max(0, s.sel) * 0.25;
        s.shadow.position.set(s.obj.position.x, s.home.y + 0.002 * s.r, s.obj.position.z);
        s.shadow.scale.set(s.bw * 1.2 * pop * (1 - lift * 0.5), (s.bd + s.bw) * 0.5 * pop * (1 - lift * 0.5), 1);
        (s.shadow.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - lift);
      }
      this.sortLayers(s.shadow ? [s.obj, s.shadow] : [s.obj]);
      const d = s.cam.position.distanceTo(c);
      this.region(cam, { x, y, w, h }, this.exposure * (s.fwd < 0 ? 1 + s.fwd * 0.32 : 1 + s.fwd * 0.08), [Math.max(1e-3, d - s.r * 1.2), d + s.r * 1.2]);
    }
    // the moments and actors, in screen space over everything, each in its own box
    if (this.moments.length || this.actors.size) {
      const done: Moment[] = [];
      for (const m of this.moments) {
        m.t += dt * this.pace;
        const k = this.freeze ?? Math.min(1, m.t / m.dur);
        m.f(k, m.obj);
        if (k >= 1 && this.freeze === null) done.push(m);
      }
      // everything shows unless it hides itself (the pen when it is put away)
      for (const m of this.moments) m.obj.visible = true;
      for (const a of this.actors) a.obj.visible = true;
      for (const a of this.actors) a.f(dt, this.t);
      this.screen.updateMatrixWorld(); this.persp.updateMatrixWorld();
      const items: { obj: THREE.Object3D; cam: THREE.OrthographicCamera | THREE.PerspectiveCamera }[] = [
        ...this.moments.map((m) => ({ obj: m.obj, cam: m.persp ? this.persp : this.screen })),
        ...[...this.actors].map((a) => ({ obj: a.obj, cam: this.persp })),
      ];
      const shown = new Map(items.map((it) => [it.obj, it.obj.visible]));
      for (const it of items) {
        if (!shown.get(it.obj)) continue;
        hideAll();
        it.obj.visible = true;
        const b = this.screenBox(it.obj, it.cam);
        if (!b) continue;
        this.sortLayers([it.obj]);
        it.cam.setViewOffset(this.w, this.h, b.x, b.y, b.w, b.h);
        this.region(it.cam, b, this.exposure, this.zRangeOf(it.obj, it.cam));
        it.cam.clearViewOffset();
      }
      for (const [o, v] of shown) o.visible = v;
      for (const m of done) { this.scene.remove(m.obj); this.moments.splice(this.moments.indexOf(m), 1); m.done?.(); }
    }
    for (const o of this.slots.values()) o.obj.visible = true;
    R.setScissorTest(false);
  }

  dispose() {
    this.clearSlots();
    for (const a of this.actors) this.scene.remove(a.obj);
    this.actors.clear();
    this.rtC?.dispose(); this.rtN?.dispose();
    this.comp.dispose();
    this.R.dispose();
    this.canvas.remove();
  }
}
