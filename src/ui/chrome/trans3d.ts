// Realistic 3D transitions on their own small WebGL overlay, with true motion blur: every frame is rendered several
// times across the shutter interval and averaged, so fast things smear the way a camera sees them.
//
//   acorns   glossy acorns in scaly cups tumble down in a wave; a warm walnut dusk follows them in, and a second wave
//            sweeps it away
//   plumes   real down and wing feathers (translucent vanes, a quill) flutter down over oat paper, then blow away
//   clouds   banks of lit cumulus roll in from both sides until the sky is white, then part in the middle
//   dream    the edges close in with a lavender haze, bokeh lights spiral into the middle and the world underneath goes
//            soft (a real backdrop blur); it opens again from the centre like waking into a dream
//
// Every object's path is a pure function of the run's clock T (0..1 covering, 1..2 uncovering), so the motion is
// continuous through the swap in the middle and each blur sample can be evaluated exactly.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type Kind3D = 'acorns' | 'plumes' | 'clouds' | 'dream';
export const KINDS_3D: Kind3D[] = ['acorns', 'plumes', 'clouds', 'dream'];
export const is3D = (k: string): k is Kind3D => (KINDS_3D as string[]).includes(k);

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const hh = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ painted textures

function canvas(w: number, h: number, f: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** the cup's overlapping scales */
function cupTex() {
  return canvas(256, 128, (g) => {
    g.fillStyle = '#6e5232'; g.fillRect(0, 0, 256, 128);
    for (let row = 0; row < 9; row++) for (let i = 0; i < 18; i++) {
      const x = i * 14.2 + (row % 2) * 7, y = row * 14 + 4;
      const gr = g.createLinearGradient(x, y - 8, x, y + 8); gr.addColorStop(0, '#a8875a'); gr.addColorStop(0.6, '#7d5f3a'); gr.addColorStop(1, '#3e2c18');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 8, 9, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(30,18,8,.6)'; g.lineWidth = 1.2; g.beginPath(); g.arc(x, y + 1, 7.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    }
  });
}
/** the nut: chestnut with fine lengthwise streaks, a pale tip */
function nutTex() {
  return canvas(256, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#c99a58'); gr.addColorStop(0.14, '#8e4f1c'); gr.addColorStop(0.65, '#6a3410'); gr.addColorStop(1, '#3e1c06');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${hh(i, 1) > 0.5 ? '255,220,160' : '50,24,8'},${0.05 + hh(i, 2) * 0.08})`; g.lineWidth = 1 + hh(i, 3) * 2; const x = hh(i, 4) * 256; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 6, 80, x - 6, 170, x + 2, 256); g.stroke(); }
  });
}
/** a feather: rachis down the middle, barbs angled out, a fluffy afterfeather near the quill; alpha in A */
function featherTex(seed: number, tone: [string, string, string]) {
  return canvas(128, 256, (g) => {
    g.clearRect(0, 0, 128, 256);
    const shape = (y: number) => { const t = y / 256; return Math.sin(Math.min(1, t * 1.15) * Math.PI) * 50 * (t < 0.15 ? t / 0.15 : 1) + 4; };
    for (let y = 6; y < 236; y += 1.6) {
      const w = shape(y), fluff = y > 190;
      for (const side of [-1, 1]) {
        const ang = -0.55 - (y / 256) * 0.35, len = w * (0.85 + hh(y, seed + side) * 0.2) * (side > 0 ? 1 : 0.8);
        const gr = g.createLinearGradient(64, y, 64 + side * len, y + ang * len * 0.6);
        gr.addColorStop(0, tone[0]); gr.addColorStop(0.55, tone[1]); gr.addColorStop(1, fluff ? 'rgba(255,255,255,0)' : tone[2]);
        g.strokeStyle = gr; g.globalAlpha = fluff ? 0.35 : 0.85 - hh(y, seed) * 0.25; g.lineWidth = fluff ? 1.4 : 1.1;
        g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + side * len * 0.5, y + ang * len * 0.15, 64 + side * len, y + ang * len * 0.55); g.stroke();
      }
      // the odd split in the vane
      if (hh(y, seed + 9) > 0.985) { g.clearRect(64 + (hh(y, 2) > 0.5 ? 6 : -40), y - 2, 34, 3); }
    }
    // an owl's barring: soft dark bands across the vane (not on the down)
    g.globalCompositeOperation = 'source-atop';
    for (let y = 18; y < 190; y += 22 + (seed % 3) * 4) { g.fillStyle = 'rgba(48,26,10,0.5)'; g.beginPath(); g.ellipse(64, y, 60, 4.5, -0.25, 0, Math.PI * 2); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    const q = g.createLinearGradient(60, 0, 68, 0); q.addColorStop(0, '#cfc2a8'); q.addColorStop(0.5, '#fbf3e2'); q.addColorStop(1, '#b8a888');
    g.strokeStyle = q; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 4); g.quadraticCurveTo(66, 130, 63, 252); g.stroke();
  });
}
/** a lit cumulus puff: sphere shading from the upper left, eroded edges; alpha in A */
function puffTex() {
  return canvas(256, 256, (g) => {
    const img = g.createImageData(256, 256), d = img.data;
    const sn = (x: number, y: number, c: number) => { const ix = Math.floor(x / c), iy = Math.floor(y / c), fx = x / c - ix, fy = y / c - iy; const a = hh(ix, iy), b = hh(ix + 1, iy), e = hh(ix, iy + 1), f = hh(ix + 1, iy + 1); const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return a + (b - a) * u + (e - a) * v + (a - b - e + f) * u * v; };
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const nx = (x - 128) / 120, ny = (y - 128) / 120, r2 = nx * nx + ny * ny;
      const n = sn(x, y, 24) * 0.5 + sn(x + 300, y, 10) * 0.3 + sn(x, y + 500, 4) * 0.2;
      const edge = 1 - r2 - (n - 0.5) * 0.45;
      const a = clamp01(edge * 3.2);
      const nz = Math.sqrt(Math.max(0, 1 - r2));
      const lit = clamp01(-nx * 0.4 - ny * 0.7 + nz * 0.55);
      const base = 0.5 + lit * 0.55, warm = Math.pow(lit, 3) * 0.12;
      const i = (y * 256 + x) * 4;
      d[i] = Math.min(255, (base + warm) * 240); d[i + 1] = Math.min(255, (base + warm * 0.6) * 240); d[i + 2] = Math.min(255, (base * 0.96 + 0.06) * 252); d[i + 3] = a * 255;
    }
    g.putImageData(img, 0, 0);
  });
}
/** a soft bokeh disc with a brighter rim */
function bokehTex() {
  return canvas(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.78, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.92, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(32, 32, 31, 0, 7); g.fill();
  });
}

// ------------------------------------------------------------------ the backdrop (a screen-space shader)

const QUAD_VS = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const BACK_FS = /* glsl */ `
uniform float uKind; uniform float uT; uniform float uTime; uniform float uAspect;
varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fb(vec2 p){ return n(p) * 0.55 + n(p * 2.1) * 0.28 + n(p * 4.3) * 0.17; }
vec3 srgb(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec2 uv = vUv; vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);
  float T = uT; float a = 0.0; vec3 col = vec3(0.0); float glow = 0.0;
  if (uKind < 0.5 || (uKind > 0.5 && uKind < 1.5)) {
    // acorns (0) and plumes (1): a front sweeping down; covered above it while covering, clear above it after
    float edgeN = (fb(vec2(uv.x * 7.0, T * 2.0)) - 0.5) * 0.09;
    float y = 1.0 - uv.y;
    if (T < 1.0) { float f = smoothstep(0.0, 1.0, T) * 1.18 - 0.06 + edgeN; a = 1.0 - smoothstep(f - 0.035, f + 0.035, y); glow = exp(-pow((y - f) / 0.02, 2.0)); }
    else { float f = smoothstep(0.0, 1.0, T - 1.0) * 1.18 - 0.06 + edgeN; a = smoothstep(f - 0.035, f + 0.035, y); glow = exp(-pow((y - f) / 0.02, 2.0)) * 0.6; }
    if (uKind < 0.5) {
      // warm walnut dusk, grain running across, a soft lamp in the middle
      float grain = fb(vec2(uv.x * 2.0, uv.y * 40.0)) * 0.5 + fb(vec2(uv.x * 9.0, uv.y * 90.0)) * 0.2;
      col = mix(srgb(vec3(0.16, 0.09, 0.05)), srgb(vec3(0.34, 0.2, 0.1)), grain);
      col *= 0.7 + 0.5 * exp(-dot(p, p) * 2.2);
      col += srgb(vec3(1.0, 0.7, 0.35)) * glow * 0.35;
    } else {
      // oat paper, softly lit
      float fib = fb(uv * vec2(60.0, 80.0)) * 0.08 + fb(uv * 6.0) * 0.06;
      col = srgb(vec3(0.93, 0.89, 0.8)) * (0.88 + fib) * (0.82 + 0.25 * exp(-dot(p, p) * 1.6));
      col += srgb(vec3(1.0, 0.95, 0.85)) * glow * 0.15;
    }
  } else if (uKind < 2.5) {
    // clouds: white sky closing in from both sides, opening in the middle
    float x = abs(uv.x - 0.5) * 2.0;
    float edgeN = (fb(vec2(uv.y * 5.0, T * 1.5)) - 0.5) * 0.12;
    if (T < 1.0) { float f = 1.0 - smoothstep(0.0, 1.0, T) * 1.15 + edgeN; a = smoothstep(f - 0.06, f + 0.06, x); }
    else { float f = smoothstep(0.0, 1.0, T - 1.0) * 1.15 + edgeN; a = smoothstep(f - 0.06, f + 0.06, x); }
    float sh = fb(uv * vec2(3.0, 4.0) + vec2(uTime * 0.03, 0.0));
    col = mix(srgb(vec3(0.72, 0.78, 0.9)), srgb(vec3(0.97, 0.96, 0.95)), smoothstep(0.2, 0.9, uv.y * 0.7 + sh * 0.5));
  } else {
    // dream: a lavender haze closing in from the edges (opening from the middle), stars and drifting nebula
    float r = length(p) / (0.5 * sqrt(uAspect * uAspect + 1.0));
    float edgeN = (fb(vec2(atan(p.y, p.x) * 3.0, uTime * 0.2)) - 0.5) * 0.18;
    if (T < 1.0) { float f = 1.0 - smoothstep(0.0, 1.0, T) * 1.25 + edgeN; a = smoothstep(f - 0.12, f + 0.12, r); }
    else { float f = smoothstep(0.0, 1.0, T - 1.0) * 1.3 + edgeN; a = smoothstep(f - 0.12, f + 0.12, r); }
    float neb = fb(p * 3.0 + vec2(uTime * 0.05, -uTime * 0.03));
    col = mix(srgb(vec3(0.07, 0.06, 0.2)), srgb(vec3(0.36, 0.25, 0.56)), smoothstep(0.25, 0.85, neb) * (0.4 + r * 0.8));
    col += srgb(vec3(0.95, 0.75, 0.9)) * pow(smoothstep(0.55, 0.95, neb), 3.0) * 0.25;
    float st = step(0.996, h(floor(uv * vec2(260.0 * uAspect, 260.0))));
    col += vec3(1.0, 0.95, 0.85) * st * (0.5 + 0.5 * sin(uTime * 3.0 + h(floor(uv * 200.0)) * 40.0));
  }
  gl_FragColor = vec4(col * a, a);
}`;

/** averages the blur samples (premultiplied) */
const ACC_FS = /* glsl */ `uniform sampler2D uTex; uniform float uW; varying vec2 vUv; void main(){ gl_FragColor = texture2D(uTex, vUv) * uW; }`;
/** tone maps and composites the averaged objects (premultiplied, linear) */
const OUT_FS = /* glsl */ `
uniform sampler2D uTex; varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main(){ vec4 c = texture2D(uTex, vUv); if (c.a < 0.001) { gl_FragColor = vec4(0.0); return; }
  vec3 s = c.rgb / c.a; s = pow(aces(s * 1.1), vec3(1.0 / 2.2)); gl_FragColor = vec4(s * c.a, c.a); }`;
/** the backdrop drawn straight to the screen in sRGB */
const BACK_OUT = /* glsl */ `vec3 toSRGB(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }`;

// ------------------------------------------------------------------ the runner

interface Obj { o: THREE.Object3D; i: number }

class Trans3D {
  readonly canvas: HTMLCanvasElement;
  private r: THREE.WebGLRenderer;
  private cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private scenes = new Map<Kind3D, { scene: THREE.Scene; objs: Obj[]; pose: (o: Obj, T: number) => void }>();
  private tmp: THREE.WebGLRenderTarget;
  private acc: THREE.WebGLRenderTarget;
  private quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  private qScene = new THREE.Scene();
  private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private backMat: THREE.ShaderMaterial;
  private accMat: THREE.ShaderMaterial;
  private outMat: THREE.ShaderMaterial;
  private env: THREE.Texture | null = null;
  private W = 1; private H = 1;
  samples = 7;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hh-trans3d';
    Object.assign(this.canvas.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '61', pointerEvents: 'none', display: 'none' });
    document.body.appendChild(this.canvas);
    this.r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    this.r.setClearColor(0x000000, 0);
    this.r.autoClear = false;
    const o = { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 };
    this.tmp = new THREE.WebGLRenderTarget(4, 4, o);
    this.acc = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.backMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: BACK_FS.replace('gl_FragColor = vec4(col * a, a);', 'gl_FragColor = vec4(toSRGB(col) * a, a);').replace('float h(vec2 p)', BACK_OUT + '\nfloat h(vec2 p)'), uniforms: { uKind: { value: 0 }, uT: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 } }, transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    this.accMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: ACC_FS, uniforms: { uTex: { value: null }, uW: { value: 1 } }, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor });
    this.outMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: OUT_FS, uniforms: { uTex: { value: this.acc.texture } }, depthTest: false, depthWrite: false, transparent: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
    try { const pm = new THREE.PMREMGenerator(this.r); this.env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch { /* no reflections */ }
    this.cam.position.set(0, 0, 0);
    // the blur costs several renders: fewer samples on small or weak devices
    const nav = navigator as Navigator & { deviceMemory?: number };
    if ((nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4) this.samples = 4;
  }

  private size() {
    const k = Math.min(2, devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    if (W === this.W && H === this.H) return;
    this.W = W; this.H = H;
    this.r.setPixelRatio(k);
    this.r.setSize(W, H, false);
    this.tmp.setSize(Math.round(W * k), Math.round(H * k));
    this.acc.setSize(Math.round(W * k), Math.round(H * k));
    this.cam.aspect = W / H;
    this.cam.updateProjectionMatrix();
  }
  /** half-size of the view at distance d */
  private view(d: number) { const hv = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2)) * d; return { hw: hv * this.cam.aspect, hv }; }

  // ---------------------------------------------------------------- the sets

  private light(scene: THREE.Scene, warm = 0xffe2b8, amb = 0x6a7aa8) {
    scene.add(new THREE.HemisphereLight(amb, 0x1a120c, 0.55));
    const key = new THREE.DirectionalLight(warm, 2.6); key.position.set(-4, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9ab8ff, 1.6); rim.position.set(5, 2, -4); scene.add(rim);
    if (this.env) { scene.environment = this.env; (scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.3; }
  }

  private build(kind: Kind3D) {
    const have = this.scenes.get(kind);
    if (have) return have;
    const scene = new THREE.Scene();
    const objs: Obj[] = [];
    let pose: (o: Obj, T: number) => void = () => {};
    const D = 12;
    if (kind === 'acorns') {
      this.light(scene);
      const nut = new THREE.LatheGeometry([[0, -0.62], [0.12, -0.58], [0.3, -0.4], [0.4, -0.12], [0.42, 0.1], [0.4, 0.22], [0.36, 0.28], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
      const cup = new THREE.LatheGeometry([[0.37, 0.18], [0.46, 0.22], [0.48, 0.34], [0.42, 0.46], [0.24, 0.53], [0.05, 0.55], [0, 0.55]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
      const stem = new THREE.CylinderGeometry(0.035, 0.05, 0.22, 8); stem.translate(0, 0.64, 0); stem.rotateZ(0.2);
      const nm = new THREE.MeshPhysicalMaterial({ map: nutTex(), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.2 });
      const cm = new THREE.MeshStandardMaterial({ map: cupTex(), roughness: 0.92, bumpScale: 2 });
      const sm = new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 0.9 });
      const n = this.samples >= 5 ? 150 : 100;
      for (let i = 0; i < n; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(nut, nm), new THREE.Mesh(cup, cm), new THREE.Mesh(stem, sm));
        scene.add(g);
        objs.push({ o: g, i });
      }
      pose = ({ o, i }, T) => {
        const wave = i % 2, d0 = wave ? 1.0 + hh(i, 1) * 0.45 : hh(i, 1) * 0.45;
        const z = -D + (hh(i, 2) - 0.5) * 6, { hw, hv } = this.view(-z);
        const t = (T - d0) / 0.78;
        o.visible = t > -0.02 && t < 1.05;
        if (!o.visible) return;
        const s = 0.55 + hh(i, 3) * 0.5;
        o.scale.setScalar(s);
        o.position.set((hh(i, 4) * 2.2 - 1.1) * hw, hv + 1 - (t * t * 0.55 + t * 0.45) * (2 * hv + 2.4), z);
        o.rotation.set(hh(i, 5) * 6 + t * (4 + hh(i, 6) * 6), hh(i, 7) * 6 + t * 3, hh(i, 8) * 6 + t * (3 + hh(i, 9) * 5));
      };
    } else if (kind === 'plumes') {
      this.light(scene, 0xfff0d8, 0x9aa8c8);
      const tones: [string, string, string][] = [['#f3e6cc', '#d8b888', '#9a7046'], ['#e0bc86', '#a8703a', '#5e3a18'], ['#f6f0e6', '#ddd2c0', '#b0a28c'], ['#cfa06a', '#8e5a2a', '#4a2a10']];
      const mats = tones.map((t, k) => new THREE.MeshStandardMaterial({ map: featherTex(k * 7 + 1, t), transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, roughness: 0.85, depthWrite: false }));
      const geo = new THREE.PlaneGeometry(1.1, 2.2, 6, 12);
      { const p = geo.attributes.position as THREE.BufferAttribute; for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k); p.setZ(k, x * x * 0.35 - (y * y) * 0.08); } geo.computeVertexNormals(); }
      const n = this.samples >= 5 ? 110 : 80;
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(geo, mats[i % mats.length]); m.renderOrder = i; scene.add(m); objs.push({ o: m, i }); }
      pose = ({ o, i }, T) => {
        const wave = i % 2, d0 = wave ? 1.0 + hh(i, 1) * 0.5 : hh(i, 1) * 0.5;
        const z = -D + (hh(i, 2) - 0.5) * 6, { hw, hv } = this.view(-z);
        const t = (T - d0) / 0.95;
        o.visible = t > -0.02 && t < 1.05;
        if (!o.visible) return;
        const sway = Math.sin(t * 7 + hh(i, 3) * 6) * (0.6 + hh(i, 4) * 0.6);
        o.scale.setScalar(0.8 + hh(i, 5) * 0.9);
        o.position.set((hh(i, 6) * 2.2 - 1.1) * hw + sway, hv + 1.6 - t * (2 * hv + 3.2), z);
        o.rotation.set(Math.sin(t * 5 + i) * 0.7 + 0.3, t * 2 + hh(i, 7) * 6, sway * 0.5 + hh(i, 8) * 6.28);
      };
    } else if (kind === 'clouds') {
      const tex = puffTex();
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(1.05, 1.03, 1.0) });
      const shade = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(0.72, 0.78, 0.9) });
      const nClouds = 16;
      for (let c = 0; c < nClouds; c++) {
        const g = new THREE.Group();
        const puffs = 12 + Math.floor(hh(c, 1) * 8);
        for (let k = 0; k < puffs; k++) {
          const sp = new THREE.Sprite(k < puffs * 0.35 ? shade : mat);
          const a = hh(c * 31 + k, 2) * Math.PI * 2, rr = hh(c * 31 + k, 3);
          sp.position.set(Math.cos(a) * rr * 2.4, Math.sin(a) * rr * 1.1 + (k < puffs * 0.35 ? -0.5 : 0.25), (hh(c, k) - 0.5) * 0.8);
          sp.scale.setScalar(1.4 + hh(c * 7 + k, 4) * 1.6);
          sp.renderOrder = k < puffs * 0.35 ? 0 : 1;
          g.add(sp);
        }
        scene.add(g);
        objs.push({ o: g, i: c });
      }
      pose = ({ o, i }, T) => {
        const side = i % 2 ? 1 : -1, z = -D + (hh(i, 5) - 0.5) * 4, { hw, hv } = this.view(-z);
        const home = side * (0.05 + hh(i, 6) * 0.55) * hw; // where it rests at full cover
        const out = side * (hw + 4);
        const e = T < 1 ? smooth(T * 1.05 - hh(i, 7) * 0.05) : 1 - smooth(T - 1 - hh(i, 8) * 0.04);
        o.position.set(out + (home - out) * e, (hh(i, 9) * 2 - 1) * hv * 0.95, z);
        o.scale.setScalar(1.3 + hh(i, 10) * 0.9);
        o.visible = e > 0.001;
      };
    } else {
      const tex = bokehTex();
      const cols = [0xffd6f0, 0xbfa8ff, 0xffe8b0, 0x9fd8ff];
      const n = 90;
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(cols[i % cols.length]).multiplyScalar(0.5 + hh(i, 1) * 0.7) }));
        scene.add(sp);
        objs.push({ o: sp, i });
      }
      pose = ({ o, i }, T) => {
        // spiral in while covering, spiral out while opening
        const z = -D + (hh(i, 2) - 0.5) * 8, { hw, hv } = this.view(-z);
        const R0 = Math.hypot(hw, hv) * (0.7 + hh(i, 3) * 0.6);
        const k = T < 1 ? smooth(T) : 1 - smooth(T - 1) * 0.0;
        const r = T < 1 ? R0 * (1 - k * 0.75) : R0 * (0.25 + smooth(T - 1) * 1.1);
        const a = hh(i, 4) * 6.28 + T * (1.6 + hh(i, 5)) * (i % 2 ? 1 : -1);
        o.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.75, z);
        const s = (0.25 + hh(i, 6) * 0.9) * (0.6 + 0.4 * Math.sin(T * 6 + i));
        o.scale.setScalar(s);
        (o as THREE.Sprite).material.opacity = Math.min(1, T * 3) * (T > 1.6 ? Math.max(0, (2 - T) / 0.4) : 1);
      };
    }
    const set = { scene, objs, pose };
    this.scenes.set(kind, set);
    return set;
  }

  // ---------------------------------------------------------------- drawing

  /** draw the frame for clock T (0..2) at wall time `time` (s); `dt` is the frame's clock step for the shutter */
  draw(kind: Kind3D, T: number, time: number, dT: number) {
    this.size();
    const set = this.build(kind);
    const r = this.r;
    const n = Math.max(1, this.samples);
    // a 120-degree shutter, its start jittered each frame so a few samples still read as one smooth smear
    const shutter = Math.min(0.03, dT * 0.34), jit = Math.random() / Math.max(1, n);
    // the objects, several times across the shutter, averaged
    r.setRenderTarget(this.acc); r.setClearColor(0x000000, 0); r.clear(true, false, false);
    this.accMat.uniforms.uTex.value = this.tmp.texture; this.accMat.uniforms.uW.value = 1 / n;
    for (let s = 0; s < n; s++) {
      const Ts = T - shutter * Math.min(1, (s + jit) / Math.max(1, n - 1));
      for (const ob of set.objs) set.pose(ob, Ts);
      r.setRenderTarget(this.tmp); r.clear(true, true, false);
      r.render(set.scene, this.cam);
      r.setRenderTarget(this.acc);
      this.quad.material = this.accMat; r.render(this.qScene, this.qCam);
    }
    // the backdrop, then the objects over it
    r.setRenderTarget(null); r.clear(true, true, false);
    const u = this.backMat.uniforms;
    u.uKind.value = KINDS_3D.indexOf(kind); u.uT.value = T; u.uTime.value = time; u.uAspect.value = this.W / this.H;
    this.quad.material = this.backMat; r.render(this.qScene, this.qCam);
    this.quad.material = this.outMat; r.render(this.qScene, this.qCam);
    // the world under the dream goes soft
    if (kind === 'dream') { const c = T < 1 ? smooth(T) : 1 - smooth(T - 1); this.canvas.style.backdropFilter = `blur(${(c * 14).toFixed(1)}px) saturate(${(1 - c * 0.3).toFixed(2)})`; }
  }
  show(on: boolean) { this.canvas.style.display = on ? 'block' : 'none'; if (!on) this.canvas.style.backdropFilter = ''; this.canvas.style.pointerEvents = on ? 'auto' : 'none'; }
}

let runner: Trans3D | null = null;
let runId = 0;
let failed = false;
/** the overlay (made on first use); null if WebGL is not available */
function get(): Trans3D | null {
  if (runner || failed) return runner;
  try { runner = new Trans3D(); } catch (e) { console.warn('3D transitions unavailable', e); failed = true; }
  return runner;
}

/** Animate one half of a 3D transition: 'in' covers (T 0..1), 'out' uncovers (T 1..2). Resolves at the end. */
export function animate3D(kind: Kind3D, half: 'in' | 'out', ms: number): Promise<boolean> {
  const tr = get();
  if (!tr) return Promise.resolve(false);
  tr.show(true);
  const id = ++runId;
  return new Promise((res) => {
    let over = false;
    const end = (ok: boolean) => { if (over) return; over = true; if (half === 'out' && id === runId) tr.show(false); res(ok); };
    const t0 = performance.now();
    let last = t0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const T = (half === 'in' ? 0 : 1) + k;
      const dT = Math.max(0.001, (now - last) / ms);
      last = now;
      if (over) return;
      try { tr.draw(kind, T, now / 1000, dT); } catch (e) { console.warn('3D transition frame failed', e); end(false); return; }
      if (k < 1) requestAnimationFrame(step); else end(true);
    };
    requestAnimationFrame(step);
    // animation frames stall in background tabs: never let the change of place wait on them
    setTimeout(() => end(true), ms + 600);
  });
}
/** hold the covered frame (while the swap in the middle runs) */
export function hold3D(kind: Kind3D) { const tr = get(); if (tr) { tr.show(true); try { tr.draw(kind, 1, performance.now() / 1000, 0.001); } catch { /* */ } } }
export function hide3D() { runner?.show(false); }
/** dev: one still frame */
export function preview3D(kind: Kind3D, T: number) { const tr = get(); if (tr) { tr.show(true); tr.draw(kind, T, performance.now() / 1000, 0.02); } }
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { hhTrans: unknown }).hhTrans = { preview: preview3D, hide: hide3D };
