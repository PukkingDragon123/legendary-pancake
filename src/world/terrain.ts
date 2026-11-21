// Blocky stepped terrain with one continuous, non-repeating painted top texture. [world3] Painted in
// the calm palette like a picture-book forest floor: sage and moss grass with sunny and shaded
// patches, cushions of moss and leaf litter under the trees, a warm trodden earth path with worn ruts
// and pebbles pressed into it, a pebbly shore round the pond, and soil banks with roots, stones and
// strata where the ground steps down, a lip of grass and moss hanging over each edge.
import * as THREE from 'three';
import { buildProp, propMesh, type BoxSpec, type Painter } from '../gfx/box.ts';
import { tone, type Ramp } from '../gfx/color.ts';
import { fbm, hash } from '../gfx/noise.ts';
import { cellH, clearing, HALF, inGarden, N, pathD, POND, pondD, SEED, WATER_Y, type Collider } from './layout.ts';

const S = N * 16;
/** [world3] The pond surface sits a little below the grass so it covers the stepped bed; ripples, pads and koi use it. */
export const SURFACE_Y = WATER_Y + 0.26;
const R = (c: number[], mid = Math.floor(c.length / 2)): Ramp => ({ c, mid });
// ramps run dark -> light, shadows leaning slate and lights leaning lamp-gold (src/gfx/palette.ts)
const GRASS_R = R([0x24342a, 0x2e4230, 0x3a5236, 0x4b6640, 0x5c7748, 0x6e8752, 0x82985e, 0x98aa70, 0xb0bd88], 4);
const MOSS_R = R([0x2c4030, 0x3f5a3b, 0x557343, 0x66844f, 0x7e9a5c, 0x99b06e], 3);
const SOIL_R = R([0x231d1b, 0x2f2622, 0x3d3129, 0x4c3d31, 0x5d4b3b, 0x705a46, 0x86705a], 3);
const PATH_R = R([0x54443a, 0x6a5747, 0x806b56, 0x967f66, 0xa99276, 0xbaa588, 0xcab79c, 0xd9c8ae], 4);
const SAND_R = R([0x6e6656, 0x8a806a, 0xa49a80, 0xbab096, 0xccc2a8, 0xdcd3bb], 3);
const BED_R = R([0x1f2c2e, 0x283a3c, 0x324746, 0x3d5552, 0x4a635e, 0x587268], 3);
const STONE_R = R([0x3d3d3e, 0x4d4c4a, 0x5e5c57, 0x716d66, 0x858076, 0x9a9486, 0xafa999, 0xc6bfae], 4);
const WET_R = R([0x1f2a2a, 0x2a3836, 0x354644, 0x425450, 0x50625c], 2);
const LITTER_C = [0x9c6a42, 0xc59a52, 0xa66c55, 0x6f553d, 0x8a8a4a, 0xb0703f];
const SPECK_C = [0xf4eedd, 0xd9aca4, 0xb4a9c9, 0xdcb072, 0xd3cce0];

function paintTop(shade: Collider[]): THREE.DataTexture {
  // canopy shade, splatted at 4 cells per block then sampled per texel
  const G = N * 4, sg = new Float32Array(G * G);
  for (const o of shade) {
    const r = o.r, x0 = Math.floor((o.x - r + HALF) * 4), x1 = Math.ceil((o.x + r + HALF) * 4), z0 = Math.floor((o.z - r + HALF) * 4), z1 = Math.ceil((o.z + r + HALF) * 4);
    for (let j = Math.max(0, z0); j < Math.min(G, z1); j++) for (let i = Math.max(0, x0); i < Math.min(G, x1); i++) {
      const d = Math.hypot((i + 0.5) / 4 - HALF - o.x, (j + 0.5) / 4 - HALF - o.z) / r;
      if (d < 1) sg[j * G + i] = Math.max(sg[j * G + i], 1 - d * d);
    }
  }

  const data = new Uint8Array(S * S * 4);
  for (let pz = 0; pz < S; pz++) {
    const z = (pz + 0.5) / 16 - HALF, cj = pz >> 4, v = pz & 15;
    for (let px = 0; px < S; px++) {
      const x = (px + 0.5) / 16 - HALF, ci = px >> 4, u = px & 15;
      const h = cellH(ci, cj);
      // clusters, not noise: two octaves of soft patches plus 2x2 tick marks
      let L = (fbm(px / 26, 2, pz / 26, SEED) - 0.5) * 2.4 + (fbm(px / 6, 4, pz / 6, SEED) - 0.5) * 1.5;
      const tick = hash(px >> 1, 9, pz >> 1, SEED);
      if (tick > 0.86) L += 0.8; else if (tick < 0.08) L -= 0.75;
      const open = clearing(x, z), sh = sg[(pz >> 2) * G + (px >> 2)];
      L += (open - 0.5) * 0.9 - sh * 1.5;
      // contact shadow under higher neighbours, bright lip above lower ones
      const hn = cellH(ci, cj - 1), hs = cellH(ci, cj + 1), hw = cellH(ci - 1, cj), he = cellH(ci + 1, cj);
      if (hn > h && v < 4) L -= (4 - v) * 0.45;
      if (hs > h && v > 11) L -= (v - 11) * 0.45;
      if (hw > h && u < 4) L -= (4 - u) * 0.45;
      if (he > h && u > 11) L -= (u - 11) * 0.45;
      if ((hn < h && v === 0) || (hs < h && v === 15) || (hw < h && u === 0) || (he < h && u === 15)) L += 0.8;

      let c: number;
      const pd = pondD(x, z);
      const wob = fbm(px / 5, 7, pz / 5, SEED) - 0.5;
      const dith = hash(px, 5, pz, SEED);
      if (pd < 1.0) {
        // the pond bed: darker towards the middle, silt and the odd pebble
        c = tone(BED_R, L * 0.45 - (1 - pd) * 2.6 + (hash(px >> 1, 3, pz >> 1, SEED) > 0.93 ? 1.2 : 0));
      } else if (pd < 1.17 + wob * 0.12) {
        // the shore: sand with pebbles pressed in
        const peb = hash(px >> 1, 13, pz >> 1, SEED);
        c = peb > 0.82 ? tone(STONE_R, L * 0.5 + (peb > 0.94 ? 1.4 : 0.3) - ((px + pz) & 1) * 0.6) : tone(SAND_R, L * 0.55 + (pd - 1.08) * 5 - 0.2);
      } else {
        const p = pathD(x, z) + wob * 0.5;
        if (p < 0.8 || (p < 1.04 && dith < (1.04 - p) / 0.24)) {
          // trodden earth: lighter down the middle, two worn ruts, pebbles pressed into it, grass creeping in at the edge
          const t = L * 0.55 + (p < 0.16 ? 0.45 : 0) - (Math.abs(p - 0.42) < 0.07 ? 0.9 : 0) - (p > 0.62 ? 0.5 : 0);
          const cell = hash(px >> 2, 21, pz >> 2, SEED), cx = (px & 3) - 1.5 + (hash(px >> 2, 22, pz >> 2, SEED) - 0.5), cz = (pz & 3) - 1.5 + (hash(px >> 2, 23, pz >> 2, SEED) - 0.5);
          if (cell > 0.88 && cx * cx + cz * cz < 2.2) c = tone(STONE_R, 0.6 - cx * 0.5 + cz * 0.6 + (cell > 0.96 ? 0.8 : 0));
          else if (cell > 0.88 && cx * cx + cz * cz < 3.4) c = tone(PATH_R, t - 1.6);
          else c = tone(PATH_R, t + (hash(px, 31, pz, SEED) > 0.93 ? 0.9 : 0));
          if (p > 0.72 && dith > 0.7) c = tone(GRASS_R, L * 0.6 - 0.6);
        } else if (open < 0.32 && fbm(px / 9, 6, pz / 9, SEED) > 0.58 + open) {
          // soil under the trees, strewn with leaf litter
          const lt = hash(px >> 1, 17, pz >> 1, SEED);
          c = lt > 0.8 ? LITTER_C[Math.floor(hash(px >> 1, 18, pz >> 1, SEED) * LITTER_C.length)] : tone(SOIL_R, L * 0.7 + (dith > 0.9 ? 1 : 0));
        } else {
          if (inGarden(x, z, 0.2)) L += (Math.floor((x + z) * 0.8 + 40) % 2 ? 0.4 : 0.05);
          if (p < 1.3) L -= 0.45;
          // cushions of moss in the shade, a scatter of tiny petals in the sunny meadow
          const mz = fbm(px / 7, 11, pz / 7, SEED);
          if (sh > 0.25 && mz > 0.62) c = tone(MOSS_R, L * 0.5 + (mz > 0.7 ? 1 : 0.2) + (tick > 0.8 ? 0.8 : 0));
          else if (open > 0.6 && hash(px, 41, pz, SEED) > 0.996) c = SPECK_C[Math.floor(hash(px, 42, pz, SEED) * SPECK_C.length)];
          else c = tone(GRASS_R, L);
        }
      }
      const k = (pz * S + px) * 4;
      data[k] = (c >> 16) & 255; data[k + 1] = (c >> 8) & 255; data[k + 2] = c & 255; data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Soil banks where the ground steps: a grass lip with moss drips, strata, roots and stones. */
function sidePainter(): Painter {
  return (t) => {
    const col = Math.floor(t.face < 2 ? t.z : t.x), fromTop = t.sy - t.by;
    const fringe = 2 + Math.floor(hash(col, 1, t.face, SEED) * 3.4);
    let L = (fbm(t.x / 3.2, t.y / 3.2, t.z / 3.2, SEED) - 0.5) * 1.8 + (t.by < 3 ? -(3 - t.by) * 0.45 : 0) + (t.face === 0 || t.face === 4 ? 0.25 : -0.35);
    if (t.y < WATER_Y * 16 + 1) return tone(WET_R, L - 0.4);
    // the pond's banks are sand and pebbles down to the waterline
    if (pondD(t.x / 16, t.z / 16) < 1.3) {
      const pe = hash(Math.floor(t.x / 2), Math.floor(t.y / 2), Math.floor(t.z / 2), SEED + 5);
      return pe > 0.7 ? tone(STONE_R, L * 0.5 + (pe > 0.9 ? 1.2 : 0.2) - (t.y < WATER_Y * 16 + 3 ? 1 : 0)) : tone(SAND_R, L * 0.5 - 0.6 - (t.y < WATER_Y * 16 + 3 ? 1.2 : 0));
    }
    // grass lip, with strands of moss hanging further down
    const drip = hash(col, 7, t.face, SEED) > 0.72 ? 2 + Math.floor(hash(col, 8, t.face, SEED) * 4) : 0;
    if (fromTop <= fringe) return tone(GRASS_R, L * 0.5 + 0.6 - fromTop * 0.45);
    if (fromTop <= fringe + drip) return tone(MOSS_R, L * 0.4 - (fromTop - fringe) * 0.4);
    if (fromTop <= fringe + 1) L -= 1.1;
    // roots snaking through the bank
    const along = t.face < 2 ? t.z : t.x;
    const root = Math.abs(t.y - (fbm(along / 6, 3, t.face, SEED + 9) * 10 + 3 + Math.floor(t.y / 16) * 16)) < 0.7;
    if (root && hash(Math.floor(along / 4), 4, t.face, SEED) > 0.45) return tone(SOIL_R, 2.4 + (t.y % 2 < 1 ? 0.6 : 0));
    const pe = hash(Math.floor(t.x / 2), Math.floor(t.y / 2), Math.floor(t.z / 2), SEED + 2);
    if (pe > 0.9) return tone(STONE_R, L * 0.6 + 0.4 + (pe > 0.97 ? 1 : 0));
    // strata
    if (Math.floor(t.y + hash(col >> 2, 2, 0, SEED) * 3) % 6 === 0) L -= 0.75;
    return tone(SOIL_R, L);
  };
}

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

  // top faces: one quad per cell, all sampling the single painted texture
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const y = cellH(i, j), x0 = i - HALF, z0 = j - HALF, b = pos.length / 3;
    pos.push(x0, y, z0, x0, y, z0 + 1, x0 + 1, y, z0 + 1, x0 + 1, y, z0);
    uv.push(i / N, j / N, i / N, (j + 1) / N, (i + 1) / N, (j + 1) / N, (i + 1) / N, j / N);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const topTex = paintTop(shade);
  const top = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: topTex }));
  top.receiveShadow = true;
  top.name = 'ground';
  group.add(top);

  // exposed sides: a column box per stepped cell, hidden faces dropped
  const sides: BoxSpec[] = [], sp = sidePainter();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const h = cellH(i, j);
    const nb: [number, string][] = [[cellH(i + 1, j), 'e'], [cellH(i - 1, j), 'w'], [cellH(i, j + 1), 's'], [cellH(i, j - 1), 'n']];
    const low = Math.min(...nb.map((n) => n[0]));
    if (low >= h) continue;
    const skip = 'ud' + nb.filter((n) => n[0] >= h).map((n) => n[1]).join('');
    sides.push({ at: [(i - HALF) * 16, low * 16, (j - HALF) * 16], size: [16, (h - low) * 16, 16], mat: sp, skip });
  }
  const sideProp = buildProp(sides, { wind: false });
  const sideMesh = propMesh(sideProp);
  sideMesh.castShadow = false;
  group.add(sideMesh);

  // pond surface
  const water = new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, fog: true, depthWrite: false,
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
    dispose() { geo.dispose(); topTex.dispose(); sideProp.geo.dispose(); sideProp.tex.dispose(); water.dispose(); },
  };
}
