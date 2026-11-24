// [world3] Materials for the borrowed BUSHED trees and ground cover, re-wired to Hoot Hollow's sky and wind:
// matte MeshStandardMaterials patched with BUSHED's wind (trunk sway, branch bob, leaf flutter driven by the
// per-vertex aWind attribute), outward-bent normals and sun-through-the-leaves glow on foliage, painted moss on
// bark (aMoss). Season tints come from instance colours (foliage) multiplied in by three.js.
import * as THREE from 'three';
import { wind } from '../../gfx/box.ts';
import { tex } from './textures.ts';
import type { SpeciesId } from './species.ts';

const COMMON_V = /* glsl */ `
attribute vec4 aWind;
uniform float uTime;
uniform vec3 uWind;
uniform float uWindAmt;
vec3 twWind(vec3 o, vec3 p, vec4 w) {
  float ws = clamp(uWind.z * 4.0, 0.0, 1.4) * uWindAmt;
  vec2 wd = normalize(uWind.xy + 1e-4);
  vec3 dir = vec3(wd.x, 0.0, wd.y);
  vec3 side = vec3(-wd.y, 0.0, wd.x);
  float ph = dot(o.xz, vec2(0.71, 0.93));
  float g = sin(dot(o.xz, wd) * 0.45 - uTime * 0.6) * 0.5 + 0.5;
  float gust = g * g * ws;
  float sway = ws * (0.3 + 0.9 * gust) + ws * (0.22 * sin(uTime * 0.71 + ph) + 0.1 * sin(uTime * 1.63 + ph * 1.7));
  vec3 off = (dir * sway + side * ws * 0.12 * sin(uTime * 0.93 + ph * 2.3)) * w.x;
  float bp = w.w * 6.2831 + ph;
  float bob = sin(uTime * (1.4 + w.w * 0.9) + bp) * (0.35 + gust);
  float flap = sin(uTime * (1.9 + w.w) + bp * 1.3);
  off += (vec3(0.0, bob * 0.6, 0.0) + dir * (0.55 * gust + 0.3 * flap) + side * 0.18 * flap) * w.y * ws;
  float fl = 0.015 + 0.06 * ws + 0.08 * gust;
  off += vec3(sin(uTime * 7.3 + bp * 3.1 + p.y * 2.1), sin(uTime * 8.7 + bp * 1.7 + p.x * 2.3), sin(uTime * 6.9 + bp * 2.3 + p.z * 1.9)) * w.z * fl;
  return off;
}
`;
const BEGIN_V = /* glsl */ `
#include <begin_vertex>
{
  mat4 twM = modelMatrix;
  #ifdef USE_INSTANCING
  twM = modelMatrix * instanceMatrix;
  #endif
  vec3 twO = twM[3].xyz;
  vec3 twP = (twM * vec4(transformed, 1.0)).xyz;
  mat3 twM3 = mat3(twM);
  float twS2 = max(1e-6, dot(twM3[0], twM3[0]));
  // aWind is in model units; the forest scales models down to blocks, so scale the sway with them
  vec3 twD = twWind(twO, twP, aWind) * sqrt(twS2);
  transformed += (transpose(twM3) * twD) / twS2;
  #ifndef TW_DEPTH
  vTwUp = normalize(twM3 * objectNormal).y;
  #endif
  vTwSeed = twO.xz;
}
`;

export interface TreeUniforms { uWindAmt: { value: number } }
export type MatKind = 'bark' | 'foliage' | 'veg';

/** Patch a standard material with the wind (and the extras for its kind). */
export function patchBushed(m: THREE.MeshStandardMaterial, kind: MatKind, u: TreeUniforms, o: { translucency?: number; backTint?: THREE.Color } = {}) {
  const trans = { value: o.translucency ?? 0.55 }, back = { value: o.backTint ?? new THREE.Color(1, 1, 1) };
  const moss = { value: kind === 'bark' ? tex('moss', { repeat: true }) : null };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime;
    sh.uniforms.uWind = wind.uWind;
    sh.uniforms.uWindAmt = u.uWindAmt;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vTwUp;\nvarying vec2 vTwSeed;\n' + (kind === 'bark' ? 'attribute float aMoss;\nvarying float vTwMoss;\n' : '') + COMMON_V)
      .replace('#include <begin_vertex>', BEGIN_V + (kind === 'bark' ? 'vTwMoss = aMoss;\n' : ''));
    let fs = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTwUp;\nvarying vec2 vTwSeed;\n');
    if (kind === 'foliage' || kind === 'veg') {
      sh.uniforms.uTrans = trans;
      sh.uniforms.uBackTint = back;
      fs = fs.replace('#include <common>', '#include <common>\nuniform float uTrans;\nuniform vec3 uBackTint;\n');
      fs = fs.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
      fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= uBackTint;');
      fs = fs.replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>
        #if NUM_DIR_LIGHTS > 0
        {
          float twT = pow(max(dot(-geometryViewDir, directLight.direction), 0.0), 3.0);
          reflectedLight.directDiffuse += directLight.color * diffuseColor.rgb * twT * uTrans;
          reflectedLight.directDiffuse += directLight.color * diffuseColor.rgb * 0.08 * uTrans;
        }
        #endif`);
    }
    if (kind === 'bark') {
      sh.uniforms.uMossMap = moss;
      fs = fs.replace('#include <common>', `#include <common>
        uniform sampler2D uMossMap; varying float vTwMoss;
        float twH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float twVN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(twH(i), twH(i + vec2(1, 0)), f.x), mix(twH(i + vec2(0, 1)), twH(i + vec2(1, 1)), f.x), f.y); }`);
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
        #ifdef USE_MAP
        {
          float twN = twVN(vMapUv * 9.0 + vTwSeed * 0.37) * 0.65 + twVN(vMapUv * 31.0 + vTwSeed) * 0.35;
          float twMs = vTwMoss * (0.6 + 0.7 * max(vTwUp, 0.0)) + (twN - 0.5) * 0.9;
          if (twMs > 0.42) {
            vec3 mc = texture2D(uMossMap, vMapUv * 1.7).rgb;
            diffuseColor.rgb = mix(mc, mc * vec3(0.8, 0.9, 0.7), step(twMs, 0.5));
          }
        }
        #endif`);
    }
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => `hh-bushed:${kind}`;
  return u;
}

/** Shadow-casting depth material with the same wind (and the alpha cut for cards). */
export function bushedDepth(u: TreeUniforms, map?: THREE.Texture): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: map ?? null, alphaTest: map ? 0.5 : 0 });
  if (map) m.side = THREE.DoubleSide;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = wind.uTime;
    sh.uniforms.uWind = wind.uWind;
    sh.uniforms.uWindAmt = u.uWindAmt;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n#define TW_DEPTH\nvarying vec2 vTwSeed;\n' + COMMON_V)
      .replace('#include <begin_vertex>', BEGIN_V);
  };
  m.customProgramCacheKey = () => `hh-bushed-depth:${map ? 1 : 0}`;
  return m;
}

const FOLIAGE_OPTS: Record<SpeciesId, { translucency: number; backTint?: THREE.Color }> = {
  spruce: { translucency: 0.35, backTint: new THREE.Color(0.95, 1.0, 1.04) },
  fir: { translucency: 0.35, backTint: new THREE.Color(1.1, 1.14, 1.12) },
  pine: { translucency: 0.45 },
  birch: { translucency: 0.8, backTint: new THREE.Color(1.08, 1.1, 0.95) },
  cedar: { translucency: 0.55, backTint: new THREE.Color(1.05, 1.08, 1.0) },
  oak: { translucency: 0.6, backTint: new THREE.Color(1.05, 1.08, 0.95) },
};
/** which painted textures each species wears (the oak borrows birch leaves and spruce bark) */
const FOLIAGE_TEX: Partial<Record<SpeciesId, SpeciesId>> = { oak: 'birch' };
const BARK_TEX: Partial<Record<SpeciesId, SpeciesId>> = { oak: 'spruce' };

export interface TreeMaterialSet { bark: THREE.MeshStandardMaterial; foliage: THREE.MeshStandardMaterial; barkDepth: THREE.MeshDepthMaterial; foliageDepth: THREE.MeshDepthMaterial; uniforms: TreeUniforms }

/** A fresh bark / foliage material pair for a species. `barkSpecies` borrows another species' bark. */
export function createTreeMaterials(species: SpeciesId, barkSpecies: SpeciesId = BARK_TEX[species] ?? species): TreeMaterialSet {
  const u: TreeUniforms = { uWindAmt: { value: 1 } };
  const bark = new THREE.MeshStandardMaterial({
    map: tex(`bark_${barkSpecies}`, { repeat: true }), normalMap: tex(`bark_${barkSpecies}_n`, { repeat: true, srgb: false }), normalScale: new THREE.Vector2(1.5, 1.5),
    vertexColors: true, roughness: 1, metalness: 0,
  });
  bark.name = `bark_${barkSpecies}`;
  patchBushed(bark, 'bark', u);
  const ftex = tex(`foliage_${FOLIAGE_TEX[species] ?? species}`);
  const foliage = new THREE.MeshStandardMaterial({ map: ftex, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true, roughness: 1, metalness: 0 });
  foliage.name = `foliage_${species}`;
  patchBushed(foliage, 'foliage', u, FOLIAGE_OPTS[species]);
  return { bark, foliage, barkDepth: bushedDepth(u), foliageDepth: bushedDepth(u, ftex), uniforms: u };
}

/** The ground-cover atlas material (grass, ferns, flowers, mushrooms, lily pads...). */
export function vegMaterial(cut = true): { mat: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial; u: TreeUniforms } {
  const u: TreeUniforms = { uWindAmt: { value: 1 } };
  const map = tex('veg_atlas');
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: cut ? 0.5 : 0, side: THREE.DoubleSide, vertexColors: true, roughness: 1, metalness: 0 });
  mat.name = 'veg';
  patchBushed(mat, 'veg', u, { translucency: 0.5 });
  return { mat, depth: bushedDepth(u, map), u };
}
