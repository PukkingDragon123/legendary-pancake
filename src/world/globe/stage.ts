// The globe: a hand-painted pixel-art Earth on a carved oak stand inside a brass meridian ring, floating in
// a starry night. It is a Stage (see src/world/scene.ts): the scene renders it instead of the forest.
//
// Everything is drawn into a small render target (one texel per "art pixel", 2-3 CSS px) and blown up with
// nearest filtering, so the planet's outline, the ring, the stars and the atmosphere are real pixel art with
// stepped edges, never smooth circles. Light is banded and Bayer-dithered per art pixel. The planet uses a
// hand-made mip chain (earth.webp: each level painted at its own size by tools/paint_earth.py), the
// real sun position for the day/night terminator (warm town lights on the night side), drifting procedural
// clouds with cloud shadows, wave marks that twinkle and a glint of sun on the sea.
// [globe] OWNED BY THE GLOBE BUILDER.
import * as THREE from 'three';
import type { Stage } from '../scene.ts';
import { OwlActor } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { flightArc, latLonToVec3, subsolar } from './earth.ts';
import { Sparks } from './sparks.ts';
import { buildStand } from './stand.ts';

const TILT = 23.44 * Math.PI / 180;
const BASE = import.meta.env.BASE_URL;

export interface PinView { id: string; x: number; y: number; facing: number; depth: number }
export interface GlobePlace { id: string; lat: number; lon: number }

// ------------------------------------------------------------------ shaders

const NOISE = /* glsl */ `
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return s / 0.9375; }
float bayer(vec2 p){ vec2 q = mod(floor(p), 4.0);
  float b = q.x == 0.0 ? (q.y == 0.0 ? 0.0 : q.y == 1.0 ? 12.0 : q.y == 2.0 ? 3.0 : 15.0)
          : q.x == 1.0 ? (q.y == 0.0 ? 8.0 : q.y == 1.0 ? 4.0 : q.y == 2.0 ? 11.0 : 7.0)
          : q.x == 2.0 ? (q.y == 0.0 ? 2.0 : q.y == 1.0 ? 14.0 : q.y == 2.0 ? 1.0 : 13.0)
          : (q.y == 0.0 ? 10.0 : q.y == 1.0 ? 6.0 : q.y == 2.0 ? 9.0 : 5.0);
  return (b + 0.5) / 16.0; }
// clouds: banded by latitude (storm belts, a tropical band), drifting with their own spin
float cloud(vec3 n, float rot){
  float c = cos(rot), s = sin(rot);
  vec3 p = vec3(c * n.x + s * n.z, n.y, -s * n.x + c * n.z);
  float lat = abs(p.y);
  float belt = 0.10 * smoothstep(0.75, 0.45, lat) * smoothstep(0.25, 0.55, lat) + 0.06 * smoothstep(0.2, 0.0, abs(p.y - 0.08));
  vec3 q = vec3(p.x, p.y * 2.3, p.z) * 2.4 + vec3(fbm(p * 3.1) * 1.6, 0.0, fbm(p * 3.1 + 4.0) * 1.6);
  return fbm(q * 2.7) * 0.92 + fbm(p * 11.0) * 0.12 + belt - smoothstep(0.85, 1.0, lat) * 0.2;
}
`;

const earthVS = /* glsl */ `
varying vec3 vN; varying vec2 vUv; varying vec3 vVN; varying vec3 vVP;
void main(){ vN = normalize(position); vUv = uv; vVN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0); vVP = mv.xyz; gl_Position = projectionMatrix * mv; }`;

const earthFS = /* glsl */ `
uniform sampler2D uDay; uniform sampler2D uNight; uniform vec3 uSun; uniform float uTime; uniform float uCloud; uniform vec3 uSunView;
varying vec3 vN; varying vec2 vUv; varying vec3 vVN; varying vec3 vVP;
${NOISE}
void main(){
  vec4 d = texture2D(uDay, vUv);
  vec3 night = texture2D(uNight, vUv).rgb;
  vec3 n = normalize(vN);
  float b = bayer(gl_FragCoord.xy);
  float ndl = dot(n, uSun);
  // cloud shadows fall a little away from the sun
  float cs = cloud(normalize(n - uSun * 0.035), uCloud);
  float shadowed = step(0.72, cs) * step(0.0, ndl);
  float k = ndl * 7.0 + (b - 0.5) * 0.9;
  vec3 day = d.rgb;
  bool water = d.a < 0.97;
  // wave marks twinkle: two phases take turns
  float ph = d.a < 0.9 ? (d.a < 0.85 ? 1.0 : 0.0) : -1.0;
  if (ph >= 0.0) { float on = step(0.0, sin(uTime * 1.3 + ph * 3.14159 + vUv.x * 40.0)); if (on < 0.5) day = mix(day, vec3(0.33, 0.42, 0.48), 0.55); }
  if (shadowed > 0.5) day *= vec3(0.78, 0.8, 0.86);
  vec3 col;
  if (k > 1.1) col = day;
  else if (k > 0.15) col = day * vec3(0.86, 0.85, 0.87);
  else if (k > -0.6) col = mix(day * 0.62, vec3(0.62, 0.42, 0.42), 0.22);   // the warm dusk band
  else col = max(night * 1.3, day * vec3(0.42, 0.48, 0.62)) + vec3(0.01, 0.015, 0.03); // moonlit: the land still reads
  // the round form: a stepped darker rim towards the limb
  vec3 vn = normalize(vVN);
  float rim = vn.z;
  if (rim < 0.3 + b * 0.05) col *= 0.88;
  if (rim < 0.13 + b * 0.03) col *= 0.88;
  // a glint of sun on the sea
  if (water && k > 0.15) {
    vec3 v = normalize(-vVP);
    vec3 h = normalize(v + uSunView);
    float sp = pow(max(dot(vn, h), 0.0), 140.0);
    if (sp > 0.6 + b * 0.3) col = mix(col, vec3(0.96, 0.9, 0.74), 0.7);
    else if (sp > 0.3 + b * 0.4) col = mix(col, vec3(0.86, 0.86, 0.8), 0.3);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const cloudFS = /* glsl */ `
uniform vec3 uSun; uniform float uCloud;
varying vec3 vN; varying vec2 vUv; varying vec3 vVN; varying vec3 vVP;
${NOISE}
void main(){
  vec3 n = normalize(vN);
  float c = cloud(n, uCloud);
  float b = bayer(gl_FragCoord.xy);
  if (c < 0.7) discard;
  float ndl = dot(n, uSun);
  float k = ndl * 7.0 + (b - 0.5) * 0.9 + (c - 0.69) * 5.0;
  vec3 col;
  if (c < 0.76 && mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) > 0.5) discard;   // veils: every other pixel
  if (k > 1.8) col = vec3(0.86, 0.87, 0.84);
  else if (k > 0.7) col = vec3(0.74, 0.77, 0.79);
  else if (k > -0.4) col = vec3(0.7, 0.6, 0.63);
  else { if (b > 0.45) discard; col = vec3(0.22, 0.26, 0.34); }
  if (c < 0.735 && b > 0.5) discard;   // thin, ragged pixel edges
  if (c < 0.715 && b > 0.25) discard;
  float rim = normalize(vVN).z;
  if (rim < 0.3 + b * 0.1) col *= 0.88;
  gl_FragColor = vec4(col, 1.0);
}`;

const atmoVS = /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const atmoFS = /* glsl */ `
uniform vec2 uC; uniform float uR; uniform vec2 uSun2;
${NOISE}
void main(){
  vec2 p = gl_FragCoord.xy - uC;
  float d = length(p) - uR;
  float b = bayer(gl_FragCoord.xy);
  float lit = dot(normalize(p), uSun2);
  if (d < -0.5 || d > 6.0) discard;
  vec3 bright = lit > 0.15 ? vec3(0.78, 0.87, 0.86) : lit > -0.3 ? vec3(0.62, 0.66, 0.74) : vec3(0.34, 0.4, 0.52);
  vec3 soft = lit > 0.15 ? vec3(0.56, 0.68, 0.72) : lit > -0.3 ? vec3(0.44, 0.48, 0.6) : vec3(0.22, 0.27, 0.38);
  if (d < 1.0) gl_FragColor = vec4(bright, 1.0);
  else if (d < 2.5) { if (b > 0.55) discard; gl_FragColor = vec4(soft, 1.0); }
  else if (d < 4.5) { if (b > 0.22) discard; gl_FragColor = vec4(soft * 0.9, 1.0); }
  else { if (b > 0.07) discard; gl_FragColor = vec4(soft * 0.8, 1.0); }
}`;

const skyVS = /* glsl */ `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const skyFS = /* glsl */ `
varying vec3 vD;
${NOISE}
void main(){
  vec3 d = normalize(vD);
  float b = bayer(gl_FragCoord.xy);
  float y = d.y * 0.5 + 0.5;
  // stepped night bands, dithered where they meet
  float t = y * 4.0 + (b - 0.5) * 0.9;
  vec3 col = t < 1.0 ? vec3(0.094, 0.118, 0.161) : t < 2.0 ? vec3(0.106, 0.133, 0.176) : t < 3.0 ? vec3(0.125, 0.153, 0.204) : vec3(0.141, 0.169, 0.224);
  // a faint milky way across the sky, plum and dusk
  vec3 ax = normalize(vec3(0.35, 0.82, 0.45));
  float band = 1.0 - abs(dot(d, ax));
  float m = smoothstep(0.82, 1.0, band) * (fbm(d * 5.0) * 0.9 + fbm(d * 17.0) * 0.4);
  if (m > 0.42 + b * 0.22) col = mix(col, vec3(0.2, 0.2, 0.28), 0.8);
  if (m > 0.62 + b * 0.2) col = mix(col, vec3(0.29, 0.27, 0.35), 0.8);
  if (m > 0.8 && b > 0.8) col = vec3(0.44, 0.43, 0.5);
  gl_FragColor = vec4(col, 1.0);
}`;

const starVS = /* glsl */ `
attribute float aSize; attribute float aPhase; attribute vec3 aCol; uniform float uTime; varying vec3 vCol; varying float vSize;
void main(){
  float tw = sin(uTime * (0.7 + aPhase * 1.9) + aPhase * 30.0);
  vSize = aSize >= 3.0 ? (tw > 0.2 ? 3.0 : 1.0) : aSize;
  vCol = aCol * (tw > -0.5 ? 1.0 : 0.6);
  gl_PointSize = vSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const starFS = /* glsl */ `
varying vec3 vCol; varying float vSize;
void main(){
  if (vSize >= 3.0) { vec2 q = abs(gl_PointCoord - 0.5); if (q.x > 0.2 && q.y > 0.2) discard; if (q.x < 0.2 && q.y < 0.2) { gl_FragColor = vec4(1.0, 0.98, 0.9, 1.0); return; } }
  gl_FragColor = vec4(vCol, 1.0);
}`;

const routeVS = /* glsl */ `attribute float aT; uniform float uTime; varying float vT; void main(){ vT = aT; gl_PointSize = 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const routeFS = /* glsl */ `uniform float uTime; uniform float uFade; varying float vT;
void main(){ float s = fract(vT * 34.0 - uTime * 0.9); if (s > 0.55 || vT > uFade) discard; gl_FragColor = vec4(s < 0.18 ? vec3(0.98, 0.9, 0.7) : vec3(0.85, 0.62, 0.42), 1.0); }`;

const blitVS = /* glsl */ `uniform vec2 uCover; varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(-1.0 + (position.x + 1.0) * uCover.x, 1.0 - (1.0 - position.y) * uCover.y, 0.0, 1.0); }`;
// The grade, after BUSHED's renderer (the user's lumberjack game): the low-res frame is lifted and split-toned
// (warm lamplight highs, cool slate shadows), a touch desaturated, vignetted, given a living film grain per art
// pixel, then ordered-dithered and quantised so gradients band like hand-placed pixel art.
const blitFS = /* glsl */ `uniform sampler2D uTex; uniform vec2 uArt; uniform float uTime; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float bayer4(vec2 p){ vec2 q = mod(floor(p), 4.0);
  float b = q.x == 0.0 ? (q.y == 0.0 ? 0.0 : q.y == 1.0 ? 12.0 : q.y == 2.0 ? 3.0 : 15.0)
          : q.x == 1.0 ? (q.y == 0.0 ? 8.0 : q.y == 1.0 ? 4.0 : q.y == 2.0 ? 11.0 : 7.0)
          : q.x == 2.0 ? (q.y == 0.0 ? 2.0 : q.y == 1.0 ? 14.0 : q.y == 2.0 ? 1.0 : 13.0)
          : (q.y == 0.0 ? 10.0 : q.y == 1.0 ? 6.0 : q.y == 2.0 ? 9.0 : 5.0);
  return (b + 0.5) / 16.0; }
void main(){
  vec2 px = floor(vUv * uArt);
  vec3 col = texture2D(uTex, vUv).rgb;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col += vec3(0.045, 0.02, -0.03) * smoothstep(0.35, 0.9, l);          // warm highlights
  col += vec3(-0.012, 0.004, 0.02) * (1.0 - smoothstep(0.0, 0.35, l)); // slate shadows
  col = mix(vec3(l), col, 0.9);
  col = col * 1.03 + vec3(0.006, 0.008, 0.014);                          // a gentle lift
  vec2 cc = vUv - 0.5;
  col *= 1.0 - 0.28 * smoothstep(0.18, 0.75, dot(cc, cc) * 1.6);         // vignette
  float g = hash(px + floor(uTime * 12.0) * 17.0) - 0.5;
  col += g * 0.035 * (1.15 - l);                                          // grain per art pixel
  col = floor(col * 40.0 + 0.5 + (bayer4(px) - 0.5) * 0.9) / 40.0;      // ordered dither + quantise
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// ------------------------------------------------------------------ textures

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
/** Where each hand-painted level sits in public/models/globe/earth.webp (tools/paint_earth.py LAYOUT). */
const LAYOUT: Record<string, [number, number]> = {
  'day:1024': [0, 0], 'night:1024': [0, 512], 'day:512': [0, 1024], 'night:512': [512, 1024],
  'day:256': [0, 1280], 'night:256': [256, 1280], 'day:128': [512, 1280], 'night:128': [640, 1280],
};
let earthImg: Promise<HTMLImageElement> | null = null;
/** A texture from the hand-painted mip levels (1024 down to 128, sliced from the one packed image) plus
 * box-shrunk tiny levels down to 1x1. */
async function mipTexture(kind: 'day' | 'night'): Promise<THREE.Texture> {
  earthImg ??= loadImage(`${BASE}models/globe/earth.webp`);
  const im = await earthImg;
  const levels: HTMLCanvasElement[] = [];
  for (const w of [1024, 512, 256, 128]) {
    const [x, y] = LAYOUT[`${kind}:${w}`];
    const c = document.createElement('canvas');
    c.width = w; c.height = w / 2;
    c.getContext('2d')!.drawImage(im, x, y, w, w / 2, 0, 0, w, w / 2);
    levels.push(c);
  }
  let w = 64;
  while (w >= 1) {
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.max(1, w / 2);
    c.getContext('2d')!.drawImage(levels[3], 0, 0, c.width, c.height);
    levels.push(c);
    w /= 2;
  }
  const t = new THREE.Texture(levels[0]);
  t.mipmaps = levels as unknown as THREE.Texture['mipmaps'];
  t.generateMipmaps = false;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.wrapS = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ the stage

interface Orbit { yaw: number; pitch: number; dist: number; ty: number }
const ease = (a: number, b: number, k: number) => a + (b - a) * k;
const wrapPI = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class GlobeStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 10);
  readonly world = new THREE.Scene();
  readonly cam = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  /** CSS px per art pixel */
  px = 2;
  /** render target size (art pixels) */
  rw = 1; rh = 1;
  private rt = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  private blit: THREE.ShaderMaterial;
  readonly tilt = new THREE.Group();
  readonly spinG = new THREE.Group();
  private earthMat: THREE.ShaderMaterial;
  private cloudMat: THREE.ShaderMaterial;
  private atmo: THREE.Mesh;
  private atmoMat: THREE.ShaderMaterial;
  private stars: THREE.Points;
  private route: THREE.Points | null = null;
  private routePts: THREE.Vector3[] = [];
  private routeT = 0;
  /** pixel particles: Pip's trail, place sparkles, the flight-path mote, shooting stars */
  readonly sparks = new Sparks(700);
  private sparkT = 0;
  /** tonight's place (sparkles gently even when not picked) */
  tonight: GlobePlace | null = null;
  private routeFade = 0;
  private stand: THREE.Object3D | null = null;
  ready = false;
  /** Pip, flying slow loops round the globe */
  private owl: OwlActor | null = null;
  private owlPivot = new THREE.Group();
  private owlA = 0;
  private owlPos = new THREE.Vector3(1.5, 0.3, 0);
  spin = 0; spinVel = 0;
  private spinGoal: number | null = null;
  private cur: Orbit = { yaw: 0, pitch: 0.16, dist: 7, ty: 0 };
  private goal: Orbit = { yaw: 0, pitch: 0.16, dist: 7, ty: 0 };
  private focusId: string | null = null;
  /** screen-space shift of the globe (CSS px) so cards can sit beside or below it */
  private shift = { x: 0, y: 0 };
  private shiftCur = { x: 0, y: 0 };
  private zoom = 1;
  private places: GlobePlace[] = [];
  private idle = 0;
  private w = 1; private h = 1;
  private drag: { id: number; x: number; y: number; moved: number; t: number; vx: number } | null = null;
  private t = 0;
  /** called every frame with where each place sits on screen */
  onFrame: ((pins: PinView[]) => void) | null = null;
  /** a tap on the globe near a place (id), or on empty space (null) */
  onTap: ((id: string | null) => void) | null = null;
  onSpin: ((speed: number) => void) | null = null;

  constructor(private renderer: THREE.WebGLRenderer) {
    this.camera.position.z = 1;
    this.blit = new THREE.ShaderMaterial({ vertexShader: blitVS, fragmentShader: blitFS, uniforms: { uTex: { value: this.rt.texture }, uCover: { value: new THREE.Vector2(1, 1) }, uArt: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 } }, depthTest: false, depthWrite: false });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blit);
    q.frustumCulled = false;
    this.scene.add(q);

    // sky dome and stars
    const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), new THREE.ShaderMaterial({ vertexShader: skyVS, fragmentShader: skyFS, side: THREE.BackSide, depthWrite: false }));
    this.world.add(sky);
    const N = 6000, pos = new Float32Array(N * 3), size = new Float32Array(N), ph = new Float32Array(N), col = new Float32Array(N * 3);
    const cols = [[0.96, 0.92, 0.78], [0.87, 0.91, 0.92], [0.83, 0.8, 0.88], [0.94, 0.83, 0.6], [0.7, 0.76, 0.84]];
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * r * 60, u * 60, Math.sin(a) * r * 60], i * 3);
      const k = rnd();
      size[i] = k > 0.985 ? 3 : k > 0.9 ? 2 : 1;
      ph[i] = rnd();
      const c = cols[Math.floor(rnd() * cols.length)], dim = size[i] === 1 ? 0.55 + rnd() * 0.3 : 1;
      col.set([c[0] * dim, c[1] * dim, c[2] * dim], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    sg.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
    sg.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    this.stars = new THREE.Points(sg, new THREE.ShaderMaterial({ vertexShader: starVS, fragmentShader: starFS, uniforms: { uTime: { value: 0 } }, depthWrite: false }));
    this.world.add(this.stars);

    // the planet
    this.tilt.rotation.z = -TILT;
    this.world.add(this.tilt);
    this.tilt.add(this.spinG);
    const sun = { value: new THREE.Vector3(1, 0, 0) }, sunView = { value: new THREE.Vector3(1, 0, 0) }, cl = { value: 0 }, time = { value: 0 };
    const white = new THREE.DataTexture(new Uint8Array([120, 150, 160, 240]), 1, 1);
    white.needsUpdate = true;
    this.earthMat = new THREE.ShaderMaterial({ vertexShader: earthVS, fragmentShader: earthFS, uniforms: { uDay: { value: white }, uNight: { value: white }, uSun: sun, uSunView: sunView, uTime: time, uCloud: cl } });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 80), this.earthMat);
    this.spinG.add(earth);
    this.cloudMat = new THREE.ShaderMaterial({ vertexShader: earthVS, fragmentShader: cloudFS, uniforms: { uSun: sun, uCloud: cl } });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.016, 96, 64), this.cloudMat);
    this.spinG.add(clouds);
    this.atmoMat = new THREE.ShaderMaterial({ vertexShader: atmoVS, fragmentShader: atmoFS, uniforms: { uC: { value: new THREE.Vector2() }, uR: { value: 50 }, uSun2: { value: new THREE.Vector2(1, 0) } }, depthWrite: false });
    this.atmo = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), this.atmoMat);
    this.world.add(this.atmo);

    void Promise.all([mipTexture('day'), mipTexture('night')]).then(([d, n]) => {
      this.earthMat.uniforms.uDay.value = d;
      this.earthMat.uniforms.uNight.value = n;
      this.ready = true;
    }).catch(() => { this.ready = true; });
    // light for Pip (the planet, stand and sky use their own banded shaders)
    const key = new THREE.DirectionalLight(0xfff0d8, 3.2);
    key.position.set(-3, 4, 5);
    this.world.add(new THREE.HemisphereLight(0xeef2ff, 0x5a4a3c, 2.4), key, this.owlPivot, this.sparks.points);
    void buildStand().then((s) => { this.stand = s; this.world.add(s); this.tilt.add(s.userData.ring as THREE.Object3D); });
  }

  // -------------------------------------------------------------- layout

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    this.px = Math.min(w, h) > 1100 ? 3 : 2;
    this.rw = Math.ceil(w / this.px); this.rh = Math.ceil(h / this.px);
    this.rt.setSize(this.rw, this.rh);
    this.blit.uniforms.uCover.value.set((this.rw * this.px) / w, (this.rh * this.px) / h);
    this.blit.uniforms.uArt.value.set(this.rw, this.rh);
    this.cam.aspect = this.rw / this.rh;
    this.cam.updateProjectionMatrix();
    this.frame();
  }

  /** where the globe should sit on screen: centre (CSS px) and the planet's radius (CSS px) */
  private view = { x: 0, y: 0, r: 0 };
  /** Frame the globe: its centre and radius on screen, in CSS px (the UI lays out around it). */
  setView(cx: number, cy: number, r: number) { this.view = { x: cx, y: cy, r }; this.frame(); }
  private frame() {
    if (!this.view.r) this.view = { x: this.w / 2, y: this.h * 0.45, r: Math.min(this.w * 0.42, this.h * 0.3) };
    const tan = Math.tan((this.cam.fov / 2) * Math.PI / 180);
    const H = this.rh * this.px;
    const q = H / (2 * this.view.r * this.zoom * tan);
    this.goal.dist = Math.sqrt(1 + q * q);
    this.goal.ty = 0;
    this.shift.x = this.view.x - this.w / 2;
    this.shift.y = this.view.y - this.h / 2;
  }

  setPlaces(p: GlobePlace[]) { this.places = p; }

  /** Fly to a place (spin it to the front, swing the camera to its latitude, zoom in), or back out. */
  focus(p: GlobePlace | null) {
    this.focusId = p?.id ?? null;
    this.spinVel = 0;
    if (!p) { this.spinGoal = null; this.goal.yaw = 0; this.goal.pitch = 0.16; this.frame(); return; }
    const v = latLonToVec3(p.lat, p.lon);
    const s = Math.atan2(-v.x, v.z);
    this.spinGoal = this.spin + wrapPI(s - this.spin);
    const r = Math.hypot(v.x, v.z);
    // tilt is a rotation about z by -TILT: (0, y, r) -> (sin(TILT) * y, cos(TILT) * y, r)
    const d = new THREE.Vector3(Math.sin(TILT) * v.y, Math.cos(TILT) * v.y, r).normalize();
    this.goal.yaw = Math.atan2(d.x, d.z);
    this.goal.pitch = Math.max(-0.62, Math.min(0.62, Math.asin(d.y)));
    this.frame();
  }

  /** The dotted flight path from home to tonight's place (null hides it). */
  setRoute(a: { lat: number; lon: number } | null, b: { lat: number; lon: number } | null) {
    if (this.route) { this.spinG.remove(this.route); this.route.geometry.dispose(); this.route = null; }
    this.routePts = [];
    if (!a || !b) return;
    const pts = flightArc(a, b, 220);
    this.routePts = pts;
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(pts.map((_, i) => i / (pts.length - 1))), 1));
    this.route = new THREE.Points(g, new THREE.ShaderMaterial({ vertexShader: routeVS, fragmentShader: routeFS, uniforms: { uTime: { value: 0 }, uFade: { value: 0 } } }));
    this.routeFade = 0;
    this.spinG.add(this.route);
  }

  /** Let Pip fly round the globe in the given look (null: no owl). */
  setOwl(look: OwlLook | null) {
    if (this.owl) { this.owlPivot.remove(this.owl.node); this.owl = null; }
    if (!look) return;
    try {
      const o = new OwlActor(look, {});
      o.pose = 'fly';
      o.node.scale.setScalar(0.11);
      o.node.traverse((n) => { n.castShadow = false; n.receiveShadow = false; });
      this.owlPivot.add(o.node);
      this.owl = o;
    } catch (e) { console.warn('globe owl', e); }
  }

  setZoom(z: number) { this.zoom = Math.max(0.8, Math.min(1.7, z)); this.frame(); }

  // -------------------------------------------------------------- input

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, _ray: THREE.Ray, e: PointerEvent): boolean {
    if (type === 'down') { this.drag = { id: e.pointerId, x, y, moved: 0, t: performance.now(), vx: 0 }; this.spinVel = 0; this.spinGoal = null; return true; }
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return false;
    if (type === 'move') {
      const dx = x - d.x, dy = y - d.y;
      d.x = x; d.y = y; d.moved += Math.abs(dx) + Math.abs(dy);
      const R = this.globeRadiusPx() || 150;
      const a = dx / R;
      this.spin += a;
      d.vx = d.vx * 0.6 + a * 0.4 / Math.max(1 / 120, 1 / 60);
      this.goal.pitch = Math.max(-0.95, Math.min(0.95, this.goal.pitch + dy / R * 0.8));
      this.cur.pitch = this.goal.pitch;
      if (d.moved > 6) this.idle = 0;
      return true;
    }
    // up
    this.drag = null;
    if (d.moved < 8 && performance.now() - d.t < 500) {
      this.onTap?.(this.nearest(x, y));
    } else {
      this.spinVel = Math.max(-4, Math.min(4, d.vx));
      this.onSpin?.(Math.abs(this.spinVel));
    }
    return true;
  }

  private lastPins: PinView[] = [];
  private nearest(x: number, y: number): string | null {
    let best: string | null = null, bd = 34;
    for (const p of this.lastPins) {
      if (p.facing < 0.1) continue;
      const d = Math.hypot(p.x - x, p.y - y + 10);
      if (d < bd) { bd = d; best = p.id; }
    }
    return best;
  }

  /** Radius of the planet on screen in CSS px. */
  globeRadiusPx(): number {
    const tan = Math.tan((this.cam.fov / 2) * Math.PI / 180);
    return (1 / (this.cur.dist * tan)) * (this.rh * this.px) / 2;
  }

  // -------------------------------------------------------------- frame

  update(dt: number, t: number) {
    this.t = t;
    dt = Math.min(dt, 0.1);
    const k = 1 - Math.exp(-dt * 3.0);
    // spin: fly to a place, coast after a flick, or drift slowly when idle
    if (this.spinGoal !== null) {
      this.spin = ease(this.spin, this.spinGoal, 1 - Math.exp(-dt * 3.4));
      if (Math.abs(this.spin - this.spinGoal) < 0.0005) this.spinGoal = null;
    } else if (!this.drag) {
      this.spin += this.spinVel * dt;
      this.spinVel *= Math.exp(-dt * 1.6);
      if (!this.focusId) { this.idle += dt; this.spin += dt * 0.07 * Math.min(1, this.idle / 2); }
    }
    this.spinG.rotation.y = this.spin;
    const c = this.cur, g = this.goal;
    c.yaw = c.yaw + wrapPI(g.yaw - c.yaw) * k; c.pitch = ease(c.pitch, g.pitch, k); c.dist = ease(c.dist, g.dist, k); c.ty = ease(c.ty, g.ty, k);
    const cp = Math.cos(c.pitch);
    this.cam.position.set(Math.sin(c.yaw) * cp * c.dist, c.ty + Math.sin(c.pitch) * c.dist, Math.cos(c.yaw) * cp * c.dist);
    this.cam.lookAt(0, c.ty, 0);
    this.shiftCur.x = ease(this.shiftCur.x, this.shift.x, k); this.shiftCur.y = ease(this.shiftCur.y, this.shift.y, k);
    // shift by whole art pixels so the pixel grid never swims
    const sx = Math.round(this.shiftCur.x / this.px), sy = Math.round(this.shiftCur.y / this.px);
    if (sx || sy) this.cam.setViewOffset(this.rw, this.rh, -sx, -sy, this.rw, this.rh); else this.cam.clearViewOffset();
    this.cam.updateMatrixWorld();

    // the real sun
    const ss = subsolar();
    const sunObj = latLonToVec3(ss.lat, ss.lon);
    this.earthMat.uniforms.uSun.value.copy(sunObj);
    this.world.updateMatrixWorld();
    const sunWorld = sunObj.clone().transformDirection(this.spinG.matrixWorld);
    this.earthMat.uniforms.uSunView.value.copy(sunWorld).transformDirection(this.cam.matrixWorldInverse);
    this.earthMat.uniforms.uTime.value = t;
    this.blit.uniforms.uTime.value = t;
    this.earthMat.uniforms.uCloud.value = t * 0.012;
    (this.stars.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
    if (this.route) {
      this.routeFade = Math.min(1, this.routeFade + dt * 0.8);
      const u = (this.route.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = t; u.uFade.value = this.routeFade;
    }
    (this.stand?.userData.animate as ((t: number) => void) | undefined)?.(t);
    if (this.owl) {
      // a lazy tilted loop just outside the ring, rising and dipping, banking into the turn
      this.owlA += dt * 0.32;
      const a = this.owlA, R = 1.52;
      let pos = new THREE.Vector3(Math.cos(a) * R, Math.sin(a * 2) * 0.12 + Math.sin(a) * 0.38, Math.sin(a) * R * 0.92);
      let ahead = new THREE.Vector3(Math.cos(a + 0.05) * R, Math.sin((a + 0.05) * 2) * 0.12 + Math.sin(a + 0.05) * 0.38, Math.sin(a + 0.05) * R * 0.92);
      // with a place picked, Pip circles just above it instead, small and to one side, never over the pin
      const fp = this.focusId ? this.places.find((x) => x.id === this.focusId) : null;
      if (fp) {
        const c = latLonToVec3(fp.lat, fp.lon, 1.0).applyMatrix4(this.spinG.matrixWorld);
        const up = c.clone().normalize(), side = new THREE.Vector3(0, 1, 0).cross(up).normalize(), fwd = up.clone().cross(side);
        const ring = (t: number) => c.clone().addScaledVector(up, 0.22 + Math.sin(t * 2) * 0.02).addScaledVector(side, Math.cos(t) * 0.2 + 0.12).addScaledVector(fwd, Math.sin(t) * 0.2);
        pos = ring(a * 1.6); ahead = ring(a * 1.6 + 0.08);
      }
      this.owlPos.lerp(pos, 1 - Math.exp(-dt * 2.2));
      const o = this.owl.node;
      o.position.copy(this.owlPos);
      o.scale.setScalar(fp ? 0.075 : 0.11);
      o.rotation.set(0, Math.atan2(ahead.x - pos.x, ahead.z - pos.z), 0);
      o.rotateZ(-0.35);
      o.position.y -= 0.08;
      this.owl.dark = 0.6;
      this.owl.update(dt);
    }

    // particles
    this.sparkT += dt;
    if (this.sparkT > 0.05) {
      this.sparkT = 0;
      if (this.owl) {
        const back = this.owl.node.getWorldDirection(new THREE.Vector3()).multiplyScalar(-0.25);
        this.sparks.emit(this.owl.node.position.clone().add(new THREE.Vector3(0, 0.05, 0)), back.add(new THREE.Vector3(0, -0.04, 0)), 0.9, Math.random() < 0.6 ? 'gold' : 'cool');
      }
      for (const pl of [this.focusId ? this.places.find((x) => x.id === this.focusId) : null, this.tonight]) {
        if (!pl || (pl === this.tonight && Math.random() < 0.6)) continue;
        const at = latLonToVec3(pl.lat, pl.lon, 1.0).applyMatrix4(this.spinG.matrixWorld);
        if (at.clone().normalize().dot(this.cam.position.clone().normalize()) > 0.05) this.sparks.rise(at, at.clone().normalize(), pl.id === this.focusId ? 'gold' : 'cool');
      }
    }
    if (this.routePts.length) {
      // a bright mote runs along the flight path, home to tonight's place, leaving a fading trail
      this.routeT = (this.routeT + dt * 0.22) % 1.3;
      if (this.routeT < 1) {
        const f = this.routeT * (this.routePts.length - 1), i = Math.floor(f);
        const q = this.routePts[i].clone().lerp(this.routePts[Math.min(i + 1, this.routePts.length - 1)], f - i).applyMatrix4(this.spinG.matrixWorld);
        this.sparks.emit(q, new THREE.Vector3(), 0.7, 'gold', i % 3 === 0 ? 2 : 1);
      }
    }
    this.sparks.update(dt, this.cam.position);

    // atmosphere: a billboard at the centre; the ring itself is drawn per art pixel in the shader
    this.atmo.quaternion.copy(this.cam.quaternion);
    const cen = new THREE.Vector3(0, 0, 0).project(this.cam);
    const cx = (cen.x * 0.5 + 0.5) * this.rw, cy = (cen.y * 0.5 + 0.5) * this.rh;
    const tan = Math.tan((this.cam.fov / 2) * Math.PI / 180);
    const camD = this.cam.position.length();
    const Rpx = (1 / (Math.sqrt(camD * camD - 1) * tan)) * this.rh / 2;
    this.atmoMat.uniforms.uC.value.set(Math.floor(cx) + 0.5, Math.floor(cy) + 0.5);
    this.atmoMat.uniforms.uR.value = Rpx;
    const sv = sunWorld.clone().project(this.cam).sub(cen);
    this.atmoMat.uniforms.uSun2.value.set(sv.x * this.rw, sv.y * this.rh).normalize();

    // render the pixel world
    const r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.rt);
    r.setClearColor(0x1b222d, 1);
    r.clear();
    r.render(this.world, this.cam);
    r.setRenderTarget(prev);

    // where the pins go (snapped to art pixels)
    if (this.onFrame) {
      const out: PinView[] = [];
      const camPos = this.cam.position;
      const v = new THREE.Vector3(), n = new THREE.Vector3();
      for (const p of this.places) {
        latLonToVec3(p.lat, p.lon, 1.004, v).applyMatrix4(this.spinG.matrixWorld);
        n.copy(v).normalize();
        const facing = n.dot(camPos.clone().sub(v).normalize());
        const s = v.clone().project(this.cam);
        const px = Math.floor((s.x * 0.5 + 0.5) * this.rw), py = Math.floor((-s.y * 0.5 + 0.5) * this.rh);
        out.push({ id: p.id, x: (px + 0.5) * this.px, y: (py + 0.5) * this.px, facing, depth: s.z });
      }
      this.lastPins = out;
      this.onFrame(out);
    }
  }

  /** Screen position (CSS px) of a lat/lon on the globe, and whether it faces us. */
  project(lat: number, lon: number): { x: number; y: number; facing: number } {
    const v = latLonToVec3(lat, lon, 1.004).applyMatrix4(this.spinG.matrixWorld);
    const facing = v.clone().normalize().dot(this.cam.position.clone().sub(v).normalize());
    const s = v.project(this.cam);
    return { x: (Math.floor((s.x * 0.5 + 0.5) * this.rw) + 0.5) * this.px, y: (Math.floor((-s.y * 0.5 + 0.5) * this.rh) + 0.5) * this.px, facing };
  }

  dispose() {
    this.rt.dispose();
    this.world.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const x of mats) { for (const v of Object.values((x as THREE.ShaderMaterial).uniforms ?? {})) (v.value as THREE.Texture)?.isTexture && (v.value as THREE.Texture).dispose(); x.dispose(); }
    });
  }
}
