// The night flight, as a Stage (world/scene.ts): Pip, backpack on, flies over an endless moonlit forest towards
// tonight's place while you breathe. Everything is generated as he goes, in chunks that recycle ahead of him:
// rolling hills covered in firs and round crowns (instanced, lit by the moon from ahead so their tops glow silver and
// their bodies stay deep blue-green), a winding river that throws back a glittering moon path, valley mist that drifts
// in two layers, clouds he glides past, cottage windows and fireflies glowing warm in the dark, far ridges standing in
// the haze, and a sky of deep indigo with a Milky Way, twinkling stars and a big moon with its halo.
// He rises on the in-breath with full wingbeats and glides down on the out-breath (setBreath). A small warm lantern
// on his pack lights his feathers against the cool night.
import * as THREE from 'three';
import { sceneSound } from '../../audio/sound.ts';
import { OwlActor } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { Fx, SPR } from '../fx.ts';
import type { Look } from '../post.ts';
import type { Stage } from '../scene.ts';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ the land (pure functions of world x, z)

function h2(x: number, y: number) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function vn(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) { return vn(x, y) * 0.55 + vn(x * 2.07, y * 2.07) * 0.28 + vn(x * 4.13, y * 4.13) * 0.17; }
/** the river's centre line (x at a given z) */
export const riverX = (z: number) => Math.sin(z * 0.0105) * 26 + Math.sin(z * 0.027 + 1.3) * 9;
const WATER = -1.4;
/** ground height */
export function groundY(x: number, z: number) {
  const hills = (fbm(x * 0.012, z * 0.012) - 0.45) * 26 + (fbm(x * 0.045 + 7, z * 0.045) - 0.5) * 5;
  const d = Math.abs(x - riverX(z));
  const valley = THREE.MathUtils.smoothstep(d, 5, 34);
  return THREE.MathUtils.lerp(WATER - 1.6, Math.max(hills, WATER + 0.6) + 2.5, valley);
}

// ------------------------------------------------------------------ shaders

const FOG = /* glsl */ `
uniform vec3 uMoonDir; uniform vec3 uFog; uniform vec3 uFogMoon; uniform float uFogDen; uniform vec3 uCam;
vec3 fogged(vec3 c, vec3 w) {
  vec3 d = w - uCam; float dist = length(d);
  float f = 1.0 - exp(-uFogDen * uFogDen * dist * dist);
  // the haze is lifted near the ground (valley haze) and glows towards the moon
  f = clamp(f + (1.0 - smoothstep(-2.0, 10.0, w.y)) * 0.18 * smoothstep(20.0, 120.0, dist), 0.0, 1.0);
  vec3 fc = mix(uFog, uFogMoon, pow(max(dot(normalize(d), uMoonDir), 0.0), 6.0));
  return mix(c, fc, f);
}`;

const SKY_VS = /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FS = /* glsl */ `
uniform vec3 uMoonDir; uniform float uTime; uniform vec3 uZen; uniform vec3 uMid; uniform vec3 uHor;
varying vec3 vDir;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
float fb(vec2 p){ float a = 0.0, w = 0.5; for (int i = 0; i < 5; i++) { a += n2(p) * w; p *= 2.03; w *= 0.5; } return a; }
void main(){
  vec3 d = normalize(vDir); float h = d.y;
  vec3 col = mix(uHor, uMid, smoothstep(-0.02, 0.22, h));
  col = mix(col, uZen, smoothstep(0.22, 0.85, h));
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.20, 0.26, 0.42) * pow(md, 6.0) * 0.55;
  col += vec3(0.45, 0.52, 0.72) * pow(md, 40.0) * 0.6;
  col += vec3(0.9, 0.92, 1.0) * pow(md, 600.0) * 1.2;
  // the Milky Way: a dusty band of light with dark lanes, tilted across the sky
  vec3 axis = normalize(vec3(0.55, 0.25, 0.8));
  float band = 1.0 - abs(dot(d, axis));
  vec2 q = vec2(atan(d.z, d.x) * 2.2, d.y * 3.0);
  float dust = fb(q * 3.0 + 4.0), lanes = smoothstep(0.45, 0.75, fb(q * 6.0 + 11.0));
  float mw = pow(smoothstep(0.78, 1.0, band), 2.0) * (0.55 + dust * 0.7) * (1.0 - lanes * 0.55);
  col += vec3(0.16, 0.17, 0.26) * mw * smoothstep(0.02, 0.3, h) * (1.0 - pow(md, 4.0));
  // below the horizon: the haze over the far forest
  col = mix(col, uHor * 0.55, smoothstep(0.0, -0.12, h));
  gl_FragColor = vec4(col, 1.0);
}`;

const STAR_VS = /* glsl */ `
attribute float aSize; attribute float aPh; attribute vec3 aCol;
uniform float uTime; uniform float uPx;
varying vec3 vCol; varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv; gl_Position.z = gl_Position.w * 0.9999;
  float tw = 0.65 + 0.35 * sin(uTime * (1.2 + aPh * 2.3) + aPh * 40.0);
  vA = tw * smoothstep(-0.02, 0.12, normalize(position).y);
  vCol = aCol;
  gl_PointSize = aSize * uPx * (0.85 + tw * 0.3);
}`;
const STAR_FS = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); float a = smoothstep(0.5, 0.0, r); a = a * a; float cr = max(0.0, 1.0 - abs(c.x) * 14.0) * max(0.0, 1.0 - abs(c.y) * 2.4) + max(0.0, 1.0 - abs(c.y) * 14.0) * max(0.0, 1.0 - abs(c.x) * 2.4);
  gl_FragColor = vec4(vCol * (a * 2.2 + cr * 0.6) * vA, 1.0); }`;

const LAND_VS = /* glsl */ `
attribute vec3 color; varying vec3 vC; varying vec3 vN; varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = color; gl_Position = projectionMatrix * viewMatrix * w; }`;
const LAND_FS = /* glsl */ `
uniform vec3 uMoonCol; uniform vec3 uAmb; ${FOG}
varying vec3 vC; varying vec3 vN; varying vec3 vW;
void main(){ vec3 n = normalize(vN); float l = max(dot(n, uMoonDir), 0.0);
  vec3 c = vC * (uAmb * (0.6 + 0.4 * n.y) + uMoonCol * l);
  gl_FragColor = vec4(fogged(c, vW), 1.0); }`;

const TREE_VS = /* glsl */ `
uniform float uTime; varying vec3 vN; varying vec3 vW; varying float vH; varying vec3 vC;
void main(){
  mat4 m = modelMatrix * instanceMatrix;
  vec4 w = m * vec4(position, 1.0);
  float sway = sin(uTime * 0.9 + w.x * 0.05 + w.z * 0.07) * 0.08 * position.y;
  w.x += sway; w.z += sway * 0.6;
  vW = w.xyz; vN = normalize(mat3(m) * normal); vH = position.y;
  #ifdef USE_INSTANCING_COLOR
  vC = instanceColor;
  #else
  vC = vec3(0.1, 0.2, 0.15);
  #endif
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const TREE_FS = /* glsl */ `
uniform vec3 uMoonCol; uniform vec3 uAmb; uniform vec3 uRim; ${FOG}
varying vec3 vN; varying vec3 vW; varying float vH; varying vec3 vC;
void main(){
  vec3 n = normalize(vN);
  float l = max(dot(n, uMoonDir), 0.0);
  // painted in three soft steps of moonlight, the crown's tip catching the most
  float lit = floor(l * 3.0 + 0.5) / 3.0 * 0.6 + l * 0.4;
  vec3 v = normalize(uCam - vW);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * max(dot(-v, uMoonDir) * 0.5 + 0.5, 0.0);
  vec3 c = vC * mix(0.45, 1.0, vH) * (uAmb * (0.55 + 0.45 * n.y) + uMoonCol * lit * mix(0.5, 1.1, vH));
  c += uRim * rim * vH;
  gl_FragColor = vec4(fogged(c, vW), 1.0);
}`;

const WATER_VS = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const WATER_FS = /* glsl */ `
uniform float uTime; uniform vec3 uMoonCol; ${FOG}
varying vec3 vW;
float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vW.xz;
  float e = 0.15;
  float a = n2(p * 0.9 + vec2(0.0, uTime * 0.6)) + n2(p * 2.3 - vec2(uTime * 0.4, 0.0)) * 0.5;
  float bx = n2((p + vec2(e, 0.0)) * 0.9 + vec2(0.0, uTime * 0.6)) + n2((p + vec2(e, 0.0)) * 2.3 - vec2(uTime * 0.4, 0.0)) * 0.5;
  float bz = n2((p + vec2(0.0, e)) * 0.9 + vec2(0.0, uTime * 0.6)) + n2((p + vec2(0.0, e)) * 2.3 - vec2(uTime * 0.4, 0.0)) * 0.5;
  vec3 n = normalize(vec3((a - bx) * 0.9, 1.0, (a - bz) * 0.9));
  vec3 v = normalize(vW - uCam);
  vec3 r = reflect(v, n);
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-v, n), 0.0), 5.0);
  vec3 sky = mix(uFog * 0.8, uFogMoon, pow(max(dot(r, uMoonDir), 0.0), 4.0));
  float spec = pow(max(dot(r, uMoonDir), 0.0), 400.0) * 4.0 + pow(max(dot(r, uMoonDir), 0.0), 40.0) * 0.18;
  vec3 c = vec3(0.006, 0.012, 0.03) + sky * (0.15 + fres * 0.45) + uMoonCol * spec;
  gl_FragColor = vec4(fogged(c, vW), 1.0);
}`;

const MIST_VS = /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const MIST_FS = /* glsl */ `
uniform sampler2D uNoise; uniform float uTime; uniform float uAmt; uniform vec3 uCol; uniform vec3 uCam; uniform float uScale;
varying vec3 vW;
void main(){
  vec2 p = vW.xz * uScale;
  float a = texture2D(uNoise, p + vec2(uTime * 0.004, uTime * 0.002)).r;
  float b = texture2D(uNoise, p * 2.3 - vec2(uTime * 0.006, -uTime * 0.003)).r;
  float m = smoothstep(0.35, 0.95, a * 0.7 + b * 0.45);
  float d = length(vW.xz - uCam.xz);
  m *= smoothstep(8.0, 40.0, d) * (1.0 - smoothstep(260.0, 420.0, d));
  gl_FragColor = vec4(uCol * m * uAmt, m * uAmt);
}`;

const CLOUD_VS = /* glsl */ `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const CLOUD_FS = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uLit; uniform vec3 uShade; uniform float uA; uniform vec3 uCam; uniform vec3 uMoonDir;
varying vec2 vUv; varying vec3 vW;
void main(){
  vec4 t = texture2D(uMap, vUv);
  float d = length(vW - uCam);
  float near = smoothstep(6.0, 30.0, d);
  // moonlit on the side facing the moon (the texture's green channel is the lit edge)
  float toward = max(dot(normalize(vW - uCam), uMoonDir), 0.0);
  vec3 c = mix(uShade, uLit, t.g * (0.55 + toward * 0.6));
  float a = t.a * uA * near;
  gl_FragColor = vec4(c * a, a);
}`;

const RIDGE_VS = /* glsl */ `attribute float aTop; varying float vTop; varying vec3 vW; void main(){ vTop = aTop; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 p = projectionMatrix * viewMatrix * w; gl_Position = p; }`;
const RIDGE_FS = /* glsl */ `
uniform vec3 uBody; uniform vec3 uHaze; uniform vec3 uMoonDir; uniform vec3 uCam; uniform vec3 uFogMoon;
varying float vTop; varying vec3 vW;
void main(){
  float glow = pow(max(dot(normalize(vW - uCam), uMoonDir), 0.0), 6.0);
  vec3 c = mix(uHaze, uBody, smoothstep(0.0, 0.9, vTop));
  c = mix(c, uFogMoon, glow * 0.6 * (1.0 - vTop));
  gl_FragColor = vec4(c, 1.0);
}`;

// ------------------------------------------------------------------ geometry

/** a fir: three stacked, slightly drooping cones on a short trunk (unit height) */
function firGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const tiers: [number, number, number][] = [[0.36, 0.16, 0.5], [0.28, 0.42, 0.42], [0.19, 0.66, 0.34]];
  for (const [r, y, h] of tiers) {
    const g = new THREE.ConeGeometry(r, h, 7, 1, true);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const yy = p.getY(i); if (yy < -h / 2 + 0.01) { p.setY(i, yy - 0.04); } p.setX(i, p.getX(i) * (1 + (h2(i, y) - 0.5) * 0.25)); p.setZ(i, p.getZ(i) * (1 + (h2(y, i) - 0.5) * 0.25)); }
    g.translate(0, y + h / 2, 0);
    g.computeVertexNormals();
    // soften: lean every normal up a little so the tiers read as soft boughs, not paper cones
    const nn = g.attributes.normal as THREE.BufferAttribute;
    for (let i = 0; i < nn.count; i++) { const v = V(nn.getX(i), nn.getY(i) + 0.35, nn.getZ(i)).normalize(); nn.setXYZ(i, v.x, v.y, v.z); }
    parts.push(g);
  }
  const trunk = new THREE.CylinderGeometry(0.03, 0.045, 0.2, 5); trunk.translate(0, 0.08, 0);
  parts.push(trunk);
  return mergeAll(parts);
}
/** a round broadleaf crown: a lumpy ball on a trunk (unit height) */
function crownGeo(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.36, 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const nrm = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i));
    // smooth, rounded shading (the radial direction), with a lumpy silhouette
    const d = v.clone().normalize();
    nrm.set([d.x, d.y, d.z], i * 3);
    const k = 1 + (vn(v.x * 6 + 3, v.y * 6 + v.z * 4) - 0.5) * 0.3; v.multiplyScalar(k); v.y *= 0.85; p.setXYZ(i, v.x, v.y + 0.6, v.z);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  const trunk = new THREE.CylinderGeometry(0.035, 0.05, 0.36, 5); trunk.translate(0, 0.18, 0);
  return mergeAll([g, trunk]);
}
function mergeAll(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const ng = gs.map((g) => { if (!g.attributes.normal) g.computeVertexNormals(); return g.index ? g.toNonIndexed() : g; });
  let n = 0; for (const g of ng) n += (g.attributes.position as THREE.BufferAttribute).count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of ng) {
    const a = (g.attributes.position as THREE.BufferAttribute).array as Float32Array, b = (g.attributes.normal as THREE.BufferAttribute).array as Float32Array;
    pos.set(a, o); nor.set(b, o); o += a.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

function noiseTex(): THREE.Texture {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!, img = g.createImageData(N, N);
  // tileable fbm (wrapped lattice)
  const P = 8, tile = (x: number, y: number, p: number) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const H = (a: number, b: number) => h2(((a % p) + p) % p, ((b % p) + p) % p);
    const a = H(ix, iy), b = H(ix + 1, iy), cc = H(ix, iy + 1), d = H(ix + 1, iy + 1);
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0, w = 0.5, f = 1;
    for (let o = 0; o < 5; o++) { a += tile((x / N) * P * f, (y / N) * P * f, P * f) * w; w *= 0.5; f *= 2; }
    const v = Math.max(0, Math.min(255, a * 255));
    const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** a soft cumulus puff: alpha in A, the moonlit edge in G */
function cloudTex(seed: number): THREE.Texture {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) { const t = i / 15; blobs.push([30 + t * 196 + (h2(i, seed) - 0.5) * 30, 80 - Math.sin(t * Math.PI) * (26 + h2(seed, i) * 18), 18 + Math.sin(t * Math.PI) * 26 + h2(i, seed + 3) * 10]); }
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let dens = 0, top = 0;
    for (const [bx, by, br] of blobs) { const d = Math.hypot(x - bx, (y - by) * 1.15) / br; if (d < 1) { dens += (1 - d) ** 1.4; top = Math.max(top, (1 - d) * Math.max(0, (by - y) / br + 0.4)); } }
    dens *= 0.8 + vn(x * 0.08 + seed, y * 0.08) * 0.5;
    const a = Math.min(1, dens * 1.3) * Math.min(1, (H - y) / 26);
    const i = (y * W + x) * 4;
    img.data[i] = 255; img.data[i + 1] = Math.min(255, top * 420); img.data[i + 2] = 255; img.data[i + 3] = Math.max(0, Math.min(255, a * 255));
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  return t;
}
function moonTex(): THREE.Texture {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.36, 'rgba(250,244,225,1)'); gr.addColorStop(0.4, 'rgba(220,226,255,0.35)'); gr.addColorStop(0.55, 'rgba(170,190,255,0.10)'); gr.addColorStop(1, 'rgba(120,140,220,0)');
  g.fillStyle = gr; g.fillRect(0, 0, N, N);
  // maria
  g.save(); g.beginPath(); g.arc(N / 2, N / 2, N * 0.36, 0, 7); g.clip();
  for (let i = 0; i < 8; i++) { const x = N / 2 + (h2(i, 1) - 0.5) * N * 0.5, y = N / 2 + (h2(i, 2) - 0.5) * N * 0.45, r = 10 + h2(i, 3) * 24; const m = g.createRadialGradient(x, y, 0, x, y, r); m.addColorStop(0, 'rgba(150,150,165,0.5)'); m.addColorStop(1, 'rgba(150,150,165,0)'); g.fillStyle = m; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 30; i++) { const x = N / 2 + (h2(i, 5) - 0.5) * N * 0.66, y = N / 2 + (h2(i, 6) - 0.5) * N * 0.66, r = 1.5 + h2(i, 7) * 4; g.strokeStyle = 'rgba(140,140,160,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ chunks of land

const CW = 320, CD = 60, SEG_X = 80, SEG_Z = 16;
interface Chunk { z0: number; land: THREE.Mesh; water: THREE.Mesh; firs: THREE.InstancedMesh; crowns: THREE.InstancedMesh; lights: THREE.Points }

// ------------------------------------------------------------------ the stage

export class FlightStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(46, 1, 0.3, 1400);
  look: Look = { exposure: 0.92, contrast: 1.14, saturation: 1.15, vibrance: 0.25, warm: -0.06, split: 0.25, vignette: 0.5, grain: 0.02, bloom: 0.9, bloomThreshold: 0.85, focus: 0, focusRange: 6, blur: 0.2, outline: 0.0, motionBlur: 0.45 };
  /** 0..1 how far along tonight's flight */
  progress = 0;

  private time = 0;
  private quality: 'low' | 'high';
  private moonDir = V(-0.32, 0.36, -1).normalize();
  private u = {
    uMoonDir: { value: this.moonDir }, uFog: { value: new THREE.Color(0.075, 0.1, 0.19) }, uFogMoon: { value: new THREE.Color(0.32, 0.36, 0.5) },
    uFogDen: { value: 0.0042 }, uCam: { value: new THREE.Vector3() }, uMoonCol: { value: new THREE.Color(0.55, 0.62, 0.85) }, uAmb: { value: new THREE.Color(0.1, 0.13, 0.22) },
    uTime: { value: 0 }, uRim: { value: new THREE.Color(0.25, 0.32, 0.5) },
  };
  private chunks: Chunk[] = [];
  private landMat: THREE.ShaderMaterial;
  private treeMat: THREE.ShaderMaterial;
  private waterMat: THREE.ShaderMaterial;
  private lightMat: THREE.PointsMaterial;
  private firG = firGeo();
  private crownG = crownGeo();
  private sky: THREE.Mesh;
  private stars: THREE.Points;
  private moon: THREE.Mesh;
  private ridges = new THREE.Group();
  private mist: THREE.Mesh[] = [];
  private clouds: { m: THREE.Mesh; mat: THREE.ShaderMaterial }[] = [];
  private fx = new Fx(700);
  private noise = noiseTex();
  private disposables: { dispose(): void }[] = [];
  // Pip
  private pip: OwlActor;
  private lantern: THREE.PointLight;
  private camFill: THREE.DirectionalLight;
  private lanternGlow: THREE.Mesh;
  private pos = V(0, 24, 0);
  private speed = 13;
  private breath = 0;
  private breathV = 0;
  private bank = 0;
  private alt = 24;
  // camera
  private camOrbit = 0;
  private camK = { x: 3.4, y: 0.7, z: 3.3 };
  private seed = 1;

  constructor(renderer: THREE.WebGLRenderer, look: OwlLook, quality: 'low' | 'high' = 'high', seed = 1) {
    void renderer;
    this.quality = quality;
    this.seed = seed;
    const s = this.scene;
    s.background = new THREE.Color(0x05070f);
    // sky, stars, moon
    const skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, uniforms: { uMoonDir: this.u.uMoonDir, uTime: this.u.uTime, uZen: { value: new THREE.Color(0.006, 0.01, 0.035) }, uMid: { value: new THREE.Color(0.025, 0.045, 0.12) }, uHor: { value: new THREE.Color(0.12, 0.15, 0.27) } } });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    s.add(this.sky);
    this.stars = this.makeStars();
    s.add(this.stars);
    const mt = moonTex();
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: mt, transparent: true, depthWrite: false, color: new THREE.Color(2.4, 2.35, 2.2), fog: false, blending: THREE.AdditiveBlending }));
    this.moon.renderOrder = -5; this.moon.frustumCulled = false;
    s.add(this.moon);
    this.disposables.push(skyMat, mt, this.noise, this.firG, this.crownG);
    // the far ridges
    this.makeRidges();
    s.add(this.ridges);
    // the land
    this.landMat = new THREE.ShaderMaterial({ vertexShader: LAND_VS, fragmentShader: LAND_FS, uniforms: this.u });
    this.treeMat = new THREE.ShaderMaterial({ vertexShader: TREE_VS, fragmentShader: TREE_FS, uniforms: this.u });
    this.waterMat = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, uniforms: this.u });
    this.lightMat = new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, color: new THREE.Color(3.0, 1.7, 0.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTex() });
    this.disposables.push(this.landMat, this.treeMat, this.waterMat, this.lightMat, this.lightMat.map!);
    const n = this.quality === 'high' ? 9 : 8;
    for (let i = 0; i < n; i++) this.chunks.push(this.makeChunk(-i * CD + CD));
    // valley mist in two layers, and clouds
    for (const [y, amt, sc] of [[WATER + 3.2, 0.26, 0.004], [WATER + 8, 0.12, 0.0026]] as [number, number, number][]) {
      const mm = new THREE.ShaderMaterial({ vertexShader: MIST_VS, fragmentShader: MIST_FS, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, uniforms: { uNoise: { value: this.noise }, uTime: this.u.uTime, uAmt: { value: amt }, uCol: { value: new THREE.Color(0.24, 0.29, 0.45) }, uCam: this.u.uCam, uScale: { value: sc } } });
      const me = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), mm);
      me.position.y = y; me.renderOrder = 2; me.frustumCulled = false;
      this.mist.push(me); s.add(me);
      this.disposables.push(mm);
    }
    for (let i = 0; i < 14; i++) this.clouds.push(this.makeCloud(i));
    // Pip, his lantern, and the moon's light on him
    this.pip = new OwlActor(look, { sound: (id) => { if (id === 'flap') sceneSound('owl_wing'); } });
    this.pip.node.scale.setScalar(0.95 / Math.max(0.3, this.pip.height));
    this.pip.pose = 'fly';
    this.pip.setMood('calm');
    s.add(this.pip.node);
    const key = new THREE.DirectionalLight(0xb8c8ff, 2.6);
    key.position.copy(this.moonDir).multiplyScalar(10);
    key.target = this.pip.node;
    s.add(key);
    const fill = new THREE.HemisphereLight(0x5a6aa8, 0x0c140f, 1.1);
    s.add(fill);
    // a soft cool light from our side, so his back, wings and pack read against the dark woods
    this.camFill = new THREE.DirectionalLight(0x9aa8e8, 1.5);
    this.camFill.target = this.pip.node;
    s.add(this.camFill);
    this.lantern = new THREE.PointLight(0xffb060, 0.5, 1.6, 2);
    s.add(this.lantern);
    this.lanternGlow = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.4, 1.2) }));
    s.add(this.lanternGlow);
    s.add(this.fx.group);
    this.fx.setLight(new THREE.Color(0.7, 0.78, 1));
    this.pos.set(riverX(0), 24, 0);
  }

  private makeStars(): THREE.Points {
    const n = this.quality === 'high' ? 2600 : 1400;
    const pos = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = h2(i, 1.7), v = h2(i, 9.1);
      const th = u * Math.PI * 2, y = 0.02 + Math.pow(v, 0.8) * 0.98, r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(th) * r * 800, y * 800, Math.sin(th) * r * 800], i * 3);
      const big = h2(i, 3.3);
      size[i] = big > 0.985 ? 5.5 : big > 0.92 ? 3.2 : 1.6 + big * 1.2;
      ph[i] = h2(i, 5.5);
      const t = h2(i, 7.7);
      const c = t < 0.15 ? [1, 0.82, 0.62] : t < 0.35 ? [0.75, 0.85, 1] : [0.95, 0.95, 1];
      col.set(c.map((x) => x * (0.6 + big * 0.8)), i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({ vertexShader: STAR_VS, fragmentShader: STAR_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: this.u.uTime, uPx: { value: Math.min(2, devicePixelRatio || 1) } } });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false; p.renderOrder = -9;
    this.disposables.push(g, m);
    return p;
  }

  private makeRidges() {
    const mk = (r: number, amp: number, base: number, body: number[], seed: number) => {
      const n = 320, pos: number[] = [], top: number[] = [], idx: number[] = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const hgt = base + (fbm(i * 0.05 + seed, seed) * 0.8 + Math.pow(vn(i * 0.018 + seed * 3, 1), 2) * 1.2) * amp;
        pos.push(Math.cos(a) * r, -40, Math.sin(a) * r, Math.cos(a) * r, hgt, Math.sin(a) * r);
        top.push(0, 1);
        if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
      g.setIndex(idx);
      const m = new THREE.ShaderMaterial({ vertexShader: RIDGE_VS, fragmentShader: RIDGE_FS, side: THREE.DoubleSide, uniforms: { uBody: { value: new THREE.Color(...body) }, uHaze: { value: new THREE.Color(0.1, 0.13, 0.24) }, uMoonDir: this.u.uMoonDir, uCam: this.u.uCam, uFogMoon: this.u.uFogMoon } });
      const me = new THREE.Mesh(g, m);
      me.frustumCulled = false; me.renderOrder = -6;
      this.ridges.add(me);
      this.disposables.push(g, m);
    };
    mk(900, 120, 10, [0.09, 0.115, 0.21], 3);
    mk(700, 70, 0, [0.05, 0.075, 0.13], 11);
  }

  private makeChunk(z0: number): Chunk {
    const land = new THREE.Mesh(new THREE.PlaneGeometry(CW, CD, SEG_X, SEG_Z).rotateX(-Math.PI / 2), this.landMat);
    land.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array((SEG_X + 1) * (SEG_Z + 1) * 3), 3));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(40, CD, 1, 12).rotateX(-Math.PI / 2), this.waterMat);
    const max = this.quality === 'high' ? 950 : 480;
    const firs = new THREE.InstancedMesh(this.firG, this.treeMat, max);
    const crowns = new THREE.InstancedMesh(this.crownG, this.treeMat, Math.round(max * 0.45));
    firs.frustumCulled = crowns.frustumCulled = false;
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
    const lights = new THREE.Points(lg, this.lightMat);
    lights.frustumCulled = false;
    const c: Chunk = { z0, land, water, firs, crowns, lights };
    this.scene.add(land, water, firs, crowns, lights);
    this.fill(c, z0);
    return c;
  }

  /** (re)generate a chunk for the strip of land starting at z0 (going towards -z) */
  private fill(c: Chunk, z0: number) {
    c.z0 = z0;
    const cx = Math.round(this.pos.x / 20) * 20;
    // the ground
    const g = c.land.geometry, p = g.attributes.position as THREE.BufferAttribute, col = g.attributes.color as THREE.BufferAttribute;
    const base = new THREE.PlaneGeometry(CW, CD, SEG_X, SEG_Z).rotateX(-Math.PI / 2);
    const bp = base.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = bp.getX(i) + cx, z = bp.getZ(i) + z0 - CD / 2;
      const y = groundY(x, z);
      p.setXYZ(i, x, y, z);
      const d = Math.abs(x - riverX(z));
      const meadow = fbm(x * 0.03 + 50, z * 0.03);
      // forest floor deep green-blue, meadows a little lighter, the river banks pale grey-green
      const k = 0.7 + (h2(x, z) - 0.5) * 0.2;
      let r = 0.06, gg = 0.1, b = 0.09;
      if (meadow > 0.62) { r = 0.1; gg = 0.15; b = 0.12; }
      if (d < 10) { const t = 1 - d / 10; r += t * 0.06; gg += t * 0.05; b += t * 0.06; }
      col.setXYZ(i, r * k, gg * k, b * k);
    }
    base.dispose();
    p.needsUpdate = true; col.needsUpdate = true;
    g.computeVertexNormals(); g.computeBoundingSphere();
    // the river ribbon
    const w = c.water.geometry, wp = w.attributes.position as THREE.BufferAttribute;
    const wb = new THREE.PlaneGeometry(40, CD, 1, 12).rotateX(-Math.PI / 2), wbp = wb.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < wp.count; i++) { const z = wbp.getZ(i) + z0 - CD / 2, half = 7 + Math.sin(z * 0.05) * 2; wp.setXYZ(i, riverX(z) + Math.sign(wbp.getX(i)) * half, WATER, z); }
    wb.dispose();
    wp.needsUpdate = true; w.computeBoundingSphere();
    // the trees
    const dm = new THREE.Object3D(), cl = new THREE.Color();
    let nf = 0, nc = 0;
    const tries = c.firs.count * 2.2;
    for (let i = 0; i < tries; i++) {
      // most trees near the flight line, the rest thinning out to the sides (the haze hides them there)
      const u = h2(i + z0 * 0.37, 1.3 + this.seed) - 0.5, spread = h2(i, 21) < 0.72 ? 0.55 : 1;
      const x = cx + u * CW * spread, z = z0 - h2(i * 1.7, z0 * 0.13 + 2.1) * CD;
      const d = Math.abs(x - riverX(z));
      if (d < 9 + h2(i, 4) * 5) continue;
      const meadow = fbm(x * 0.03 + 50, z * 0.03);
      if (meadow > 0.64 && h2(i, 8) > 0.15) continue;
      const y = groundY(x, z);
      const broad = fbm(x * 0.02 + 9, z * 0.02 + 3) > 0.55 && h2(i, 6) > 0.3;
      const hgt = (broad ? 7 : 9) + h2(i, 5) * (broad ? 5 : 8);
      dm.position.set(x, y - 0.3, z);
      dm.rotation.set((h2(i, 11) - 0.5) * 0.08, h2(i, 12) * 6.3, (h2(i, 13) - 0.5) * 0.08);
      dm.scale.set(hgt * (broad ? 1.05 : 0.95), hgt, hgt * (broad ? 1.05 : 0.95));
      dm.updateMatrix();
      const t = h2(i, 14);
      if (broad) {
        if (nc >= c.crowns.count) continue;
        cl.setRGB(0.08 + t * 0.05, 0.19 + t * 0.06, 0.12 + t * 0.03);
        if (t > 0.9) cl.setRGB(0.22, 0.2, 0.12); // an early autumn crown
        c.crowns.setMatrixAt(nc, dm.matrix); c.crowns.setColorAt(nc, cl); nc++;
      } else {
        if (nf >= c.firs.count) continue;
        cl.setRGB(0.04 + t * 0.03, 0.15 + t * 0.06, 0.12 + t * 0.04);
        c.firs.setMatrixAt(nf, dm.matrix); c.firs.setColorAt(nf, cl); nf++;
      }
    }
    // hide the unused instances
    dm.scale.setScalar(0); dm.updateMatrix();
    for (let i = nf; i < c.firs.count; i++) c.firs.setMatrixAt(i, dm.matrix);
    for (let i = nc; i < c.crowns.count; i++) c.crowns.setMatrixAt(i, dm.matrix);
    c.firs.instanceMatrix.needsUpdate = true; c.crowns.instanceMatrix.needsUpdate = true;
    if (c.firs.instanceColor) c.firs.instanceColor.needsUpdate = true;
    if (c.crowns.instanceColor) c.crowns.instanceColor.needsUpdate = true;
    // a cottage window or two by the river, glowing warm
    const lp = c.lights.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) {
      const on = h2(z0, i + 3) > 0.6;
      const z = z0 - h2(i, z0 + 1) * CD, side = h2(i, z0 + 2) > 0.5 ? 1 : -1;
      const x = riverX(z) + side * (12 + h2(i, z0 + 3) * 20);
      lp.setXYZ(i, on ? x : 0, on ? groundY(x, z) + 1.4 : -999, on ? z : 0);
    }
    lp.needsUpdate = true;
  }

  private makeCloud(i: number) {
    const t = cloudTex(i * 7 + 3);
    const mat = new THREE.ShaderMaterial({ vertexShader: CLOUD_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, uniforms: { uMap: { value: t }, uLit: { value: new THREE.Color(0.7, 0.75, 0.95) }, uShade: { value: new THREE.Color(0.1, 0.12, 0.22) }, uA: { value: 0.85 }, uCam: this.u.uCam, uMoonDir: this.u.uMoonDir } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), mat);
    m.renderOrder = 4; m.frustumCulled = false;
    this.placeCloud(m, i, true);
    this.scene.add(m);
    this.disposables.push(t, mat, m.geometry);
    return { m, mat };
  }
  private placeCloud(m: THREE.Mesh, i: number, first = false) {
    const r = (k: number) => h2(i * 3.1 + this.time, k);
    const ahead = first ? 40 + r(1) * 520 : 480 + r(1) * 120;
    const side = (r(2) - 0.5) * 360;
    const y = this.alt + (r(3) - 0.35) * 60;
    const s = 40 + r(4) * 90;
    m.position.set(this.pos.x + side, y, this.pos.z - ahead);
    m.scale.set(s, s, 1);
    m.userData.drift = (r(5) - 0.5) * 1.5;
  }

  // ---------------------------------------------------------------- the breath

  /** 0..1 lung fullness from the breathing exercise: Pip rises with full wingbeats on the in-breath and glides down on the out-breath */
  setBreath(lung: number) { this.breath = lung; }

  // ---------------------------------------------------------------- frame

  update(dt: number, t: number) {
    void t;
    dt = Math.min(dt, 0.1);
    this.time += dt;
    this.u.uTime.value = this.time;
    // fly
    this.pos.z -= this.speed * dt;
    const ahead = this.pos.z - 30;
    const wantX = riverX(ahead) + Math.sin(this.time * 0.05) * 14;
    const dx = THREE.MathUtils.clamp((wantX - this.pos.x) * 0.25, -4, 4);
    this.pos.x += dx * dt;
    const ground = Math.max(groundY(this.pos.x, this.pos.z), groundY(this.pos.x, this.pos.z - 20));
    this.alt += ((ground + 22) - this.alt) * Math.min(1, dt * 0.4);
    // breathing: rise on the in-breath, glide on the out-breath
    const lungV = (this.breath - this.breathV) / Math.max(dt, 1e-3);
    this.breathV += (this.breath - this.breathV) * Math.min(1, dt * 4);
    this.pos.y = this.alt + this.breathV * 1.8 + Math.sin(this.time * 1.3) * 0.12;
    this.pip.wingbeat += ((lungV > 0.02 || this.breath > 0.92 ? 1 : this.breath < 0.08 ? 0.75 : 0.06) - this.pip.wingbeat) * Math.min(1, dt * 2.5);
    this.bank += ((-dx * 0.09) - this.bank) * Math.min(1, dt * 1.5);
    const o = this.pip.node;
    o.position.copy(this.pos);
    o.rotation.set(-0.08 + (0.5 - this.breathV) * 0.06, Math.PI + dx * 0.05, this.bank, 'YXZ');
    this.pip.update(dt);
    // his lantern swings under the pack
    const back = V(0.12, 0.08, -0.22).applyEuler(o.rotation).add(this.pos);
    this.lanternGlow.position.copy(back).add(V(Math.sin(this.time * 3) * 0.02, -0.02, 0));
    this.lantern.position.copy(back);
    this.lantern.intensity = 0.5 + Math.sin(this.time * 11) * 0.03;
    // the camera: three-quarters behind him, slowly drifting round
    this.camOrbit = Math.sin(this.time * 0.035) * 0.35;
    const k = this.camK, a = this.camOrbit;
    const off = V(k.x * Math.cos(a) + k.z * Math.sin(a), k.y, k.z * Math.cos(a) - k.x * Math.sin(a));
    const cam = this.camera;
    const want = this.pos.clone().add(off);
    if (cam.position.lengthSq() < 1e-6) cam.position.copy(want); else cam.position.lerp(want, 1 - Math.exp(-dt * 3));
    const look = this.pos.clone().add(V(-1.6, -0.5, -6));
    cam.lookAt(look);
    cam.rotation.z += this.bank * 0.25;
    cam.updateMatrixWorld();
    this.camFill.position.copy(cam.position).add(V(0, 2.5, 0));
    this.u.uCam.value.copy(cam.position);
    // the sky and its things follow the camera
    this.sky.position.copy(cam.position);
    this.stars.position.copy(cam.position);
    this.ridges.position.set(cam.position.x, 0, cam.position.z);
    this.moon.position.copy(cam.position).addScaledVector(this.moonDir, 700);
    this.moon.lookAt(cam.position);
    this.moon.scale.setScalar(150);
    for (const m of this.mist) m.position.set(cam.position.x, m.position.y, cam.position.z);
    // recycle land that has gone behind
    for (const c of this.chunks) {
      if (c.z0 - CD > cam.position.z + 20) {
        const far = Math.min(...this.chunks.map((x) => x.z0));
        this.fill(c, far - CD);
      }
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      c.m.position.x += c.m.userData.drift * dt;
      c.m.lookAt(cam.position);
      if (c.m.position.z > cam.position.z + 20) this.placeCloud(c.m, i + Math.floor(this.time));
    }
    // fireflies over the canopy and wisps of air streaming past
    if (Math.random() < dt * (this.quality === 'high' ? 14 : 6)) {
      const fx = this.pos.x + (Math.random() - 0.5) * 60, fz = this.pos.z - 10 - Math.random() * 70;
      const fy = groundY(fx, fz) + 8 + Math.random() * 6;
      this.fx.emit({ x: fx, y: fy, z: fz, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.3) * 0.4, vz: (Math.random() - 0.5) * 0.6, life: 3 + Math.random() * 3, frame: SPR.glow, color: Math.random() < 0.8 ? 0xffd27a : 0xd8f08a, size: 0.25 + Math.random() * 0.25, add: true, fadeIn: 0.8, fadeOut: 1.2, flutter: 0.3 });
    }
    if (Math.random() < dt * 3) {
      const wx = this.pos.x + (Math.random() - 0.5) * 6, wy = this.pos.y + (Math.random() - 0.5) * 3, wz = this.pos.z - 8 - Math.random() * 6;
      this.fx.emit({ x: wx, y: wy, z: wz, vz: this.speed * 1.4, life: 0.9, frame: SPR.mote, color: 0xc8d6ff, size: 0.05, add: true, fadeIn: 0.2, fadeOut: 0.4 });
    }
    this.fx.update(dt, this.time);
    this.look.focus = cam.position.distanceTo(this.pos);
  }

  /** Pip's head on screen (CSS px) */
  pipScreen() { const p = this.pip.headWorld.project(this.camera); return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight }; }

  resize(w: number, h: number) {
    this.camera.aspect = w / Math.max(1, h);
    // on tall screens step back a little so the moon and the horizon stay in
    this.camera.fov = this.camera.aspect < 0.8 ? 60 : 46;
    this.camK = this.camera.aspect < 0.8 ? { x: 2.2, y: 1.0, z: 4.4 } : { x: 3.4, y: 0.7, z: 3.3 };
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    try { this.pip.model.dispose(); } catch { /* */ }
    for (const d of this.disposables) { try { d.dispose(); } catch { /* */ } }
    for (const c of this.chunks) { c.land.geometry.dispose(); c.water.geometry.dispose(); c.lights.geometry.dispose(); c.firs.dispose(); c.crowns.dispose(); }
  }
}

function dotTex(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
