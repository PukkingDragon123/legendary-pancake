// [world3] The ground: one smooth heightfield (rounded hills where the layout steps up, a soft bowl for the
// pond, a gentle roll under the trees, the clearing kept level for the house), textured like BUSHED's forest
// floor: Poly Haven forest-floor, bare-earth, cushion-moss and mossy-rock scans re-made as crisp
// high-resolution pixel art (calm palette, public/textures/bushed), blended by height with a dither so the edges
// read as hand-placed pixels, under a low-resolution painted tint map (meadow green, leafy shade, trodden path,
// sandy shore). Nearest magnification, mipmapped minification.
import * as THREE from 'three';
import { fbm, hash } from '../gfx/noise.ts';
import { cellH, clearing, HALF, houseD, inGarden, N, pathD, POND, pondD, SEED, type Collider } from './layout.ts';
import { tex } from './bushed/textures.ts';

/** [world3] The pond surface sits a hair above the grass so its rounded edge hides the bowl; ripples, pads and koi use it. */
export const SURFACE_Y = 0.02;

const sm = (t: number) => t * t * (3 - 2 * t);
let hs: Float32Array | null = null;
/** cell heights blurred over their neighbours, so a one-block step becomes a slope over three */
function smoothCells(): Float32Array {
  if (hs) return hs;
  const a = new Float32Array((N + 2) * (N + 2));
  for (let j = -1; j <= N; j++) for (let i = -1; i <= N; i++) {
    let s = 0, w = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const k = di === 0 && dj === 0 ? 2 : 1; s += Math.max(0, cellH(i + di, j + dj)) * k; w += k; }
    a[(j + 1) * (N + 2) + i + 1] = s / w;
  }
  return (hs = a);
}

/** The ground height (blocks) at a world position: what everything in the woods stands on. */
export function surfaceY(x: number, z: number): number {
  const a = smoothCells(), W = N + 2;
  const fx = Math.max(-1, Math.min(N, x + HALF - 0.5)), fz = Math.max(-1, Math.min(N, z + HALF - 0.5));
  const i = Math.min(N - 1, Math.floor(fx)), j = Math.min(N - 1, Math.floor(fz)), u = sm(Math.max(0, Math.min(1, fx - i))), v = sm(Math.max(0, Math.min(1, fz - j)));
  const at = (ii: number, jj: number) => a[(jj + 1) * W + ii + 1];
  let h = (at(i, j) * (1 - u) + at(i + 1, j) * u) * (1 - v) + (at(i, j + 1) * (1 - u) + at(i + 1, j + 1) * u) * v;
  // a gentle roll under the trees (the clearing and the house stay level)
  const keep = Math.max(clearing(x, z), 1 - Math.min(1, Math.max(0, houseD(x, z) - 1) / 3));
  h += (fbm(x / 5, 3, z / 5, SEED) - 0.5) * 0.7 * (1 - keep);
  // the pond's bowl
  const pd = pondD(x, z);
  if (pd < 1) h -= 0.85 * sm(Math.min(1, (1 - pd) / 0.45));
  return h;
}

/** Splat weights (r earth, g moss, b rock, a sand) and a tint map, painted at 8 texels a block. */
function paintMaps(shade: Collider[]): { splat: THREE.DataTexture; tint: THREE.DataTexture } {
  const T = 8, S = N * T;
  const G = N * 4, sg = new Float32Array(G * G);
  for (const o of shade) {
    const r = o.r, x0 = Math.floor((o.x - r + HALF) * 4), x1 = Math.ceil((o.x + r + HALF) * 4), z0 = Math.floor((o.z - r + HALF) * 4), z1 = Math.ceil((o.z + r + HALF) * 4);
    for (let j = Math.max(0, z0); j < Math.min(G, z1); j++) for (let i = Math.max(0, x0); i < Math.min(G, x1); i++) {
      const d = Math.hypot((i + 0.5) / 4 - HALF - o.x, (j + 0.5) / 4 - HALF - o.z) / r;
      if (d < 1) sg[j * G + i] = Math.max(sg[j * G + i], 1 - d * d);
    }
  }
  const sp = new Uint8Array(S * S * 4), tn = new Uint8Array(S * S * 4);
  const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
  for (let pz = 0; pz < S; pz++) {
    const z = (pz + 0.5) / T - HALF;
    for (let px = 0; px < S; px++) {
      const x = (px + 0.5) / T - HALF;
      const open = clearing(x, z), sh = sg[Math.min(G - 1, Math.floor(pz / 2)) * G + Math.min(G - 1, Math.floor(px / 2))];
      const pd = pondD(x, z), p = pathD(x, z) + (fbm(x * 2, 7, z * 2, SEED) - 0.5) * 0.35;
      const slope = Math.hypot(surfaceY(x + 0.25, z) - surfaceY(x - 0.25, z), surfaceY(x, z + 0.25) - surfaceY(x, z - 0.25)) * 2;
      const n1 = fbm(x / 2.4, 2, z / 2.4, SEED), n2 = fbm(x / 1.2, 9, z / 1.2, SEED);
      let earth = 0, moss = 0, rock = 0, sand = 0;
      // tint (1 = as scanned): meadow greener and lighter, shade darker and cooler, path warm
      let tr = 1, tg = 1, tb = 1;
      const meadow = clamp01(open * 1.2);
      tr = 0.98 - meadow * 0.1; tg = 1.06 + meadow * 0.2; tb = 0.88 - meadow * 0.1;
      const dark = 1 - sh * 0.28;
      tr *= dark; tg *= dark; tb *= dark * 1.04;
      // trodden path with a lighter middle, grass creeping in at the edge
      earth = Math.max(earth, clamp01((0.95 - p) / 0.3));
      if (p < 0.2) { tr *= 1.08; tg *= 1.06; tb *= 1.03; }
      // bare soil and leaf litter under the trees
      if (open < 0.35) earth = Math.max(earth, clamp01((n1 - 0.52 - open) * 3) * 0.8);
      // moss cushions in the shade and on the hills
      moss = clamp01((n2 - 0.55) * 4) * clamp01(sh * 1.5 + (1 - open) * 0.4);
      // steep banks show mossy stone
      rock = clamp01((slope - 0.45) * 2.5);
      // the pond: a sandy, pebbly shore and a dark bed
      if (pd < 1.2) { sand = clamp01((1.2 - pd) / 0.1); earth = Math.max(earth, sand * 0.4); }
      if (pd < 1.0) { tr *= 0.62; tg *= 0.7; tb *= 0.72; }
      if (inGarden(x, z, 0.2)) { const st = Math.floor((x + z) * 0.8 + 40) % 2 ? 1.06 : 0.97; tr *= st; tg *= st * 1.04; tb *= st; earth *= 0.2; moss = 0; }
      // a little hand-painted variety
      const v = 0.94 + hash(px >> 1, 3, pz >> 1, SEED) * 0.08;
      const k = (pz * S + px) * 4;
      sp[k] = Math.round(clamp01(earth) * 255); sp[k + 1] = Math.round(clamp01(moss) * 255); sp[k + 2] = Math.round(clamp01(rock) * 255); sp[k + 3] = Math.round(clamp01(sand) * 255);
      tn[k] = Math.round(clamp01(tr * v * 0.5) * 255); tn[k + 1] = Math.round(clamp01(tg * v * 0.5) * 255); tn[k + 2] = Math.round(clamp01(tb * v * 0.5) * 255); tn[k + 3] = 255;
    }
  }
  const mk = (d: Uint8Array<ArrayBuffer>) => {
    const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { splat: mk(sp), tint: mk(tn) };
}

const GROUND_PARS = /* glsl */ `
varying vec3 vGroundW;
uniform sampler2D uSplat; uniform sampler2D uFloor; uniform sampler2D uEarth; uniform sampler2D uMoss; uniform sampler2D uRock;
float gBayer(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))) * 0.25 + fract(dot(floor(a * 0.5), vec2(0.5, floor(a.y * 0.5) * 0.75))); }
float gLum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
// height blend: the brighter (higher) texture wins where weights are close, broken up by a pixel dither
float gBlend(float w, vec3 a, vec3 b) { return clamp((w - 0.5 + (gLum(b) - gLum(a)) * 0.8 + (gBayer(gl_FragCoord.xy) - 0.5) * 0.22) * 6.0 + 0.5, 0.0, 1.0); }
`;
const GROUND_MAP = /* glsl */ `
{
  vec2 wp = vGroundW.xz;
  vec4 sp = texture2D(uSplat, vMapUv);
  vec3 c = texture2D(uFloor, wp / 3.0).rgb;
  vec3 e = texture2D(uEarth, wp / 2.0).rgb;
  vec3 m = texture2D(uMoss, wp / 1.6).rgb;
  vec3 r = texture2D(uRock, wp / 3.0).rgb;
  vec3 s = e * vec3(1.32, 1.28, 1.16);
  c = mix(c, e, gBlend(sp.r, c, e));
  c = mix(c, m, gBlend(sp.g, c, m));
  c = mix(c, r, gBlend(sp.b, c, r));
  c = mix(c, s, gBlend(sp.a, c, s));
  diffuseColor.rgb = c * texture2D(map, vMapUv).rgb * 2.0;
}
`;

const WATER_VS = /* glsl */ `
varying vec2 vW;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const WATER_FS = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform vec3 uLight; uniform vec3 uSky;
uniform vec4 uPond; uniform float uIce;
varying vec2 vW;
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main() {
  vec2 q = (floor(vW * 16.0) + 0.5) / 16.0;
  vec2 d = (q - uPond.xy) / uPond.zw;
  float a = atan(d.y, d.x);
  float pd = length(d) + 0.08 * sin(a * 3.0 + 1.3) + 0.05 * sin(a * 7.0 + 0.4);
  if (pd > 1.04) discard;
  float n = sin(q.x * 3.1 + uTime * 0.7) * sin(q.y * 4.3 - uTime * 0.5) + 0.5 * sin((q.x + q.y) * 6.0 + uTime * 1.1);
  float band = floor((n * 0.4 + 0.5) * 4.0) / 4.0;
  vec3 col = mix(uDeep, uShallow, clamp(smoothstep(0.25, 1.0, pd) * 0.7 + band * 0.25, 0.0, 1.0));
  // [world3] the misty sky mirrored in the middle, the dark banks and reeds reflected round the edge
  float mirror = (1.0 - smoothstep(0.15, 0.75, pd)) * (0.55 + 0.45 * step(0.5, fract(q.y * 2.0 + floor(q.x * 4.0) * 0.37 + uTime * 0.05)));
  col = mix(col, uSky, mirror * 0.32);
  float bank = step(0.78 + 0.05 * sin(a * 11.0 + 1.7) + 0.03 * sin(a * 23.0), pd);
  col = mix(col, uDeep * 0.7, bank * 0.5);
  float foam = step(0.95 + 0.02 * sin(uTime * 1.4 + a * 9.0), pd);
  col = mix(col, uFoam, foam * 0.7);
  float sp = step(0.99, h21(q * 16.0 + floor(uTime * 2.5) * 7.0)) * (1.0 - foam) * (1.0 - bank);
  col = col * uLight + sp * uFoam * 0.45;
  float alpha = 0.86 + foam * 0.12 + sp * 0.1;
  // [world] frozen pond: pale blue ice with white cracks and frosted rim
  if (uIce > 0.01) {
    float crack = step(0.93, h21(floor(q * 4.0))) + step(abs(sin(q.x * 2.1 + q.y * 3.3) + sin(q.y * 1.7 - q.x * 0.9)), 0.05);
    vec3 ice = mix(vec3(0.48, 0.62, 0.68), vec3(0.72, 0.8, 0.82), clamp(smoothstep(0.3, 1.0, pd) + band * 0.15, 0.0, 1.0));
    ice = mix(ice, vec3(0.9, 0.92, 0.88), clamp(crack, 0.0, 1.0) * 0.7 + foam * 0.6);
    col = mix(col, ice * uLight * 1.1, uIce);
    alpha = mix(alpha, 0.94, uIce);
  }
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export interface Terrain {
  group: THREE.Group;
  water: THREE.ShaderMaterial;
  dispose(): void;
}

export function buildTerrain(shade: Collider[]): Terrain {
  const group = new THREE.Group();

  // [world3] one smooth heightfield, two vertices a block
  const R = 2, M = N * R;
  const pos = new Float32Array((M + 1) * (M + 1) * 3), uv = new Float32Array((M + 1) * (M + 1) * 2), idx: number[] = [];
  for (let j = 0; j <= M; j++) for (let i = 0; i <= M; i++) {
    const x = i / R - HALF, z = j / R - HALF, k = j * (M + 1) + i;
    pos.set([x, surfaceY(x, z), z], k * 3);
    uv.set([i / M, j / M], k * 2);
    if (i < M && j < M) idx.push(k, k + M + 1, k + M + 2, k, k + M + 2, k + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const { splat, tint } = paintMaps(shade);
  const detail = (name: string) => { const t = tex(name, { repeat: true }); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  const topMat = new THREE.MeshLambertMaterial({ map: tint });
  const gu = { uSplat: { value: splat }, uFloor: { value: detail('forest_floor') }, uEarth: { value: detail('earth') }, uMoss: { value: detail('moss') }, uRock: { value: detail('mossy_rock') } };
  topMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, gu);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundW = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GROUND_PARS)
      .replace('#include <map_fragment>', GROUND_MAP);
  };
  topMat.customProgramCacheKey = () => 'hh-ground';
  const top = new THREE.Mesh(geo, topMat);
  top.receiveShadow = true;
  top.name = 'ground';
  group.add(top);

  // pond surface
  const water = new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, fog: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uDeep: { value: new THREE.Color(0x3f6670) }, uShallow: { value: new THREE.Color(0x86a9b0) }, uFoam: { value: new THREE.Color(0xdfe9ea) }, uSky: { value: new THREE.Color(0xd2dfd8) },
      uLight: { value: new THREE.Color(1, 1, 1) }, uPond: { value: new THREE.Vector4(POND.x, POND.z, POND.rx, POND.rz) }, uIce: { value: 0 },
    }]),
  });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(POND.rx * 2.4, POND.rz * 2.4), water);
  wm.rotation.x = -Math.PI / 2;
  wm.position.set(POND.x, SURFACE_Y, POND.z);
  wm.renderOrder = 2;
  group.add(wm);

  return {
    group, water,
    dispose() { geo.dispose(); splat.dispose(); tint.dispose(); water.dispose(); },
  };
}
