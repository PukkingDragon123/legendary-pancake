// Moleforge's forest grass field, ported: an instanced field of crossed pixel-art quads (one atlas of
// 32x32 cells, [look12] Moleforge's own hand-set pixel blades and flowers again, crisp: nearest-filtered) that bends in the wind, takes dappled sun and sky light, glows when backlit by a low
// sun, gets pushed aside by the owl's feet, and fades into the scene fog. Lighting uniforms are fed
// from this app's Sky every frame instead of Moleforge's forest atmosphere module.
import * as THREE from 'three';
import { FG, NCELL, paintGrassAtlas } from './grassAtlas.js';

export { FG };
export interface GrassItem { x: number; y: number; z: number; rot: number; size: number; cell: number; tint: number }

/** Shared uniforms: the scene updates these once per frame. */
export const GRASS = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector2(0.82, 0.57) },
  uKey: { value: new THREE.Color(0xffcf90) },
  uSky: { value: new THREE.Color(0x9fc4e8) },
  uGround: { value: new THREE.Color(0x5a6a3a) },
  uSunDir: { value: new THREE.Vector3(-0.36, 0.44, -0.82).normalize() },
  uBright: { value: 1 },
  uDapple: { value: 1 },
  uCloud: { value: null as THREE.Texture | null },
  /** things pressing the grass down: x, z, radius, strength (up to 4) */
  uPush: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
  // [world] seasons and weather
  /** colour multiplier for the season (golden in autumn, faded in winter) */
  uTint: { value: new THREE.Color(1, 1, 1) },
  /** 0..1 snow lying on the ground: blades sink in and frost at the tips */
  uSnow: { value: 0 },
  /** 0..1 rain-soaked: darker, glossier */
  uWet: { value: 0 },
  /** 0..1 how many wildflowers are in bloom (they go to seed in autumn, vanish in winter) */
  uBloom: { value: 1 },
  /** 0..1 fallen leaves among the short grass (autumn) */
  uLitter: { value: 0 },
};

/** A small tileable value-noise texture used for dappled light and patchy hue. */
export function noiseTexture(size = 64, seed = 7): THREE.DataTexture {
  const g = 8, grid = new Float32Array(g * g);
  let s = seed;
  for (let i = 0; i < g * g; i++) { s = (s * 1664525 + 1013904223) >>> 0; grid[i] = s / 4294967296; }
  const at = (x: number, y: number) => grid[((y % g + g) % g) * g + ((x % g + g) % g)];
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0, amp = 0.62, f = 1;
    for (let o = 0; o < 3; o++) {
      const fx = (x / size) * g * f, fy = (y / size) * g * f;
      const xi = Math.floor(fx), yi = Math.floor(fy), u = fx - xi, w = fy - yi;
      const su = u * u * (3 - 2 * u), sw = w * w * (3 - 2 * w);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      v += (a + (b - a) * su + (c - a) * sw + (a - b - c + d) * su * sw) * amp;
      amp *= 0.5; f *= 2;
    }
    const k = (y * size + x) * 4;
    data[k] = data[k + 1] = data[k + 2] = Math.round(Math.min(1, v / 1.1) * 255); data[k + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const VERT = /* glsl */ `
attribute vec4 iPos;    // xyz, rotation
attribute vec3 iData;   // size, cell, tint
uniform float uTime;
uniform vec2 uWind;
uniform vec4 uPush[4];
uniform float uSnow; uniform float uBloom; uniform float uLitter;
varying vec2 vUv;
varying vec3 vW;
varying float vTint;
varying float vH;
#include <fog_pars_vertex>
void main() {
  vec3 p = position * iData.x;
  p.y *= 1.0 - uSnow * 0.5;
  float c = cos(iPos.w), s = sin(iPos.w);
  p.xz = mat2(c, -s, s, c) * p.xz;
  vec3 w = (modelMatrix * vec4(iPos.xyz + p, 1.0)).xyz;
  float h = position.y;
  float ph = dot(iPos.xz, uWind) * 0.42 - uTime * 1.7;
  float gust = 0.55 + 0.45 * sin(dot(iPos.xz, vec2(0.07, 0.11)) - uTime * 0.6);
  float sway = (sin(ph) * 0.65 + sin(ph * 2.3 + iPos.x * 3.0) * 0.25 + 0.35) * gust;
  w.xz += uWind * sway * h * h * iData.x * 0.3;
  w.y -= abs(sway) * h * h * iData.x * 0.06;
  for (int i = 0; i < 4; i++) {
    vec4 q = uPush[i];
    if (q.z <= 0.0) continue;
    vec2 d = iPos.xz - q.xy;
    float dist = length(d);
    float k = (1.0 - smoothstep(q.z * 0.3, q.z, dist)) * q.w * h;
    vec2 dir = dist > 0.001 ? d / dist : vec2(0.0, 1.0);
    w.xz += dir * k * 0.35 * iData.x;
    w.y -= k * 0.3 * iData.x;
  }
  // [world] seasons: wildflowers go to seed and dry out, leaves gather in the short grass
  float cellI = iData.y;
  float hb = fract(sin(dot(iPos.xz, vec2(12.9898, 78.233))) * 43758.5453);
  bool bloom = (cellI > 2.5 && cellI < 10.5 && cellI != 9.0) || (cellI > 19.5 && cellI < 22.5);
  if (bloom && hb > uBloom) cellI = hb > 0.78 ? 24.0 : hb > 0.62 ? 19.0 : 13.0;
  if (cellI < 1.5 && hb < uLitter * 0.45) cellI = 24.0;
  vUv = vec2((cellI + uv.x) / ${NCELL.toFixed(1)}, uv.y);
  vW = w;
  vTint = iData.z;
  vH = h;
  vec4 mvPosition = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uCloud;
uniform vec3 uKey; uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uSunDir;
uniform float uBright; uniform float uDapple; uniform float uTime; uniform vec2 uWind;
uniform vec3 uTint; uniform float uSnow; uniform float uWet;
varying vec2 vUv;
varying vec3 vW;
varying float vTint;
varying float vH;
#include <fog_pars_fragment>
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main() {
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.5) discard;
  // dappled sun through the canopy: two drifting octaves of leafy noise, quantised like pixel art
  vec2 sway = uWind * (sin(uTime * 0.9 + vW.x * 0.3) * 0.05 + sin(uTime * 1.7 + vW.z * 0.4) * 0.025);
  float n = texture2D(uCloud, vW.xz * 0.11 + sway).r * 0.65 + texture2D(uCloud, vW.xz * 0.31 - sway * 2.0 + 0.4).r * 0.35;
  float s = smoothstep(0.36, 0.46, n);
  s = floor(s * 3.0 + bayer4(gl_FragCoord.xy) * 0.999) / 3.0;
  float sun = mix(1.0, mix(0.42, 1.0, s), uDapple);
  vec3 amb = mix(uGround, uSky, 0.3 + vH * 0.6) * 0.72;
  vec3 lit = amb + uKey * (0.62 * sun + 0.06);
  float pt = texture2D(uCloud, vW.xz * 0.05).r - 0.5;
  // [look12] sit into the ground: a little deeper overall, and white petals and seed heads soft cream rather than glaring
  vec3 tc = t.rgb * mix(1.0, 0.8, smoothstep(0.55, 0.85, dot(t.rgb, vec3(0.2126, 0.7152, 0.0722))));
  vec3 col = tc * uTint * vTint * lit * uBright * 0.86 * (1.0 + vec3(0.1, 0.04, -0.08) * pt * 2.0);
  col *= 1.0 - uWet * 0.18;
  // frost and snow clinging to the lower blades
  float frost = uSnow * step(vH, uSnow * 0.55 + fract(sin(dot(floor(vW.xz * 16.0), vec2(12.9898, 78.233))) * 43758.5453) * 0.35);
  col = mix(col, vec3(0.92, 0.95, 1.0) * (amb * 1.25 + uKey * 0.55 * sun), frost);
  vec3 V = normalize(vW - cameraPosition);
  float back = pow(max(dot(V, uSunDir), 0.0), 5.0);
  col += t.rgb * uKey * back * (0.35 + vH) * 1.1 * (0.25 + 0.75 * sun);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** Resolves when the field's atlas is ready ([look12] painted in code, so at once). */
export const grassReady = Promise.resolve();

let tex: THREE.Texture | null = null;

/** An instanced field of crossed-quad clumps, chunked so off-screen parts are culled. */
export function makeGrass(items: GrassItem[], cell = 10): THREE.Group {
  const grp = new THREE.Group();
  if (!tex) {
    // [look12] Moleforge's pixel-art atlas, crisp (the user asked for the old pixel grass back)
    const t = new THREE.CanvasTexture(paintGrassAtlas());
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
    t.userData.crisp = true;
    tex = t;
  }
  if (!GRASS.uCloud.value) GRASS.uCloud.value = noiseTexture();
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: tex } }]),
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, fog: true,
  });
  // share the live uniforms (merge clones values, so re-link them)
  Object.assign(mat.uniforms, GRASS, { uMap: { value: tex } });

  const P: number[] = [], U: number[] = [], I: number[] = [];
  for (let q = 0; q < 2; q++) {
    // [look12] square, like Moleforge's 32 x 32 cells
    const a = q * Math.PI / 2 + 0.3, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, o = P.length / 3;
    P.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    U.push(0, 0, 1, 0, 1, 1, 0, 1);
    I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const bins = new Map<string, GrassItem[]>();
  for (const it of items) {
    const key = `${Math.floor(it.x / cell)},${Math.floor(it.z / cell)}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key)!.push(it);
  }
  for (const list of bins.values()) {
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    const n = list.length, pos = new Float32Array(n * 4), dat = new Float32Array(n * 3);
    const box = new THREE.Box3(), v = new THREE.Vector3();
    list.forEach((it, i) => {
      pos.set([it.x, it.y, it.z, it.rot], i * 4);
      dat.set([it.size, it.cell, it.tint], i * 3);
      box.expandByPoint(v.set(it.x, it.y, it.z));
    });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 4));
    g.setAttribute('iData', new THREE.InstancedBufferAttribute(dat, 3));
    g.instanceCount = n;
    box.expandByScalar(1.4);
    g.boundingBox = box;
    g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = false;
    grp.add(m);
  }
  return grp;
}
