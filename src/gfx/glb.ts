// Loading the hand-made models: owls (Blender, faceted and hand-painted like the user's Gacha Garage
// toys) and the house, furniture and props (lowpix: low-poly with detailed hand-painted pixel-art
// atlases). Everything lives in public/models/<area>/<id>.glb and is loaded on demand, cached, and
// cloned per use. See docs/ART-STYLE.md.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshoptDecoder as MeshoptReference } from './meshopt_ref.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applyCelShading, CEL_REAL } from './cel.ts'; // [light7] the painted cel light (patches three's light chunks on import)

// The artifact host shows the game in a locked-down frame: it doesn't serve .glb, and it may refuse
// fetches of data:/blob: URLs and WebAssembly compilation. So the artifact build ships each model as
// <name>.glb.json ({"glb": base64}, scripts/glb2json.mjs) that we decode here, textures are read
// through <img> rather than fetch, and meshopt geometry falls back to a pure-JS decoder if wasm fails.
const ARTIFACT = import.meta.env.MODE === 'artifact';

let wasmOk = true;
const meshopt = {
  supported: true,
  ready: MeshoptDecoder.ready.then(() => undefined, () => { wasmOk = false; }),
  decodeGltfBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array, mode: string, filter?: string) {
    if (wasmOk) {
      try { MeshoptDecoder.decodeGltfBuffer(target, count, size, source, mode, filter); return; } catch { wasmOk = false; }
    }
    MeshoptReference.decodeGltfBuffer(target, count, size, source, mode, filter);
  },
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(meshopt as unknown as typeof MeshoptDecoder);
if (ARTIFACT) {
  // read embedded textures through an <img> (blob: URL) instead of fetch()
  loader.register((parser) => {
    parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
    return { name: 'hh_img_textures' } as never;
  });
}
const cache = new Map<string, Promise<GLTF>>();

function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

async function fetchGLTF(url: string): Promise<GLTF> {
  if (!ARTIFACT) return loader.loadAsync(url);
  const r = await fetch(`${url}.json`);
  if (!r.ok) throw new Error(`model ${url}: HTTP ${r.status}`);
  const { glb } = (await r.json()) as { glb: string };
  return loader.parseAsync(fromBase64(glb), url.slice(0, url.lastIndexOf('/') + 1));
}

/** URL of a model under public/models (works with the relative base of the artifact build). */
export const modelUrl = (path: string) => `${import.meta.env.BASE_URL}models/${path.replace(/^\//, '')}`;

/** [light7] Rim light on the silhouette by model set: characters most, the things they own a little, scenery none. */
function rimFor(path: string): number {
  if (/^(owls|outfits)\//.test(path)) return 0.5;
  if (/^(items|souvenirs)\/|^shop\/(beaver|hero)|^world\/(songbird|critter)/.test(path)) return 0.3;
  return 0;
}

/**
 * [light7] Smoothly filtered textures (linear, trilinear mipmaps, anisotropy). [look4] Materials keep their own response to light (polished
 * wood, brass, glass and ceramics catch the environment's highlights); only the extremes are tamed: no mirror-smooth
 * surfaces flashing white, and painted (non-metal) maps never read as chrome. [light7] Baked occlusion stays subtle
 * (creases only), and characters and props get the cel rim (see cel.ts).
 */
function tune(root: THREE.Object3D, o: { shadows: boolean; rim?: number }) {
  root.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = o.shadows;
    m.receiveShadow = o.shadows;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      // [light7] smooth filtering for every map (realistic textures, no pixelated look)
      for (const t of [mat.map, mat.emissiveMap, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap]) {
        if (!t || t.userData.smooth) continue;
        t.userData.smooth = true;
        t.magFilter = THREE.LinearFilter;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = 8;
        t.needsUpdate = true;
      }
      const metal = !!mat.metalnessMap || (mat.metalness ?? 0) > 0.5;
      if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 1, metal ? 0.22 : 0.32);
      if ('metalness' in mat && !mat.metalnessMap) mat.metalness = Math.min(mat.metalness ?? 0, 0.85);
      if (mat.aoMap) mat.aoMapIntensity = Math.min(mat.aoMapIntensity ?? 1, CEL_REAL.on ? 1 : 0.6); // [clock14] real contact darkness
      if (o.rim !== undefined) applyCelShading(mat, { rim: o.rim });
    }
  });
}

/**
 * [look5] A colour lift for painted maps: the duller a texel, the more its own hue is lifted (vibrance, never a flat
 * tint), so faded paint, grey wood and dusty feathers read as colourful under warm light while the brush work and every
 * value in the painting stay where they were. Patched once per material (shared materials are shared); `k` is how much
 * a grey-ish texel's chroma grows.
 */
export function vivid(root: THREE.Object3D, k = 0.32) {
  // [look12] every lit material now gets fuller painted colour (cel.ts, celAlbedo): this is a smaller lift on top of it
  root.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      if (!mat || mat.userData.vivid || !mat.map || !mat.isMeshStandardMaterial) continue;
      mat.userData.vivid = true;
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (sh, r) => {
        prev?.call(mat, sh, r);
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 vc = diffuseColor.rgb;
  float vl = dot(vc, vec3(0.2126, 0.7152, 0.0722));
  float vmx = max(vc.r, max(vc.g, vc.b)), vmn = min(vc.r, min(vc.g, vc.b));
  float vs = (vmx - vmn) / max(vmx, 1e-4);
  diffuseColor.rgb = max(mix(vec3(vl), vc, 1.0 + ${(k * (CEL_REAL.on ? 0.1 : 0.6)).toFixed(3)} * (1.0 - vs) * smoothstep(0.004, 0.04, vl)), 0.0);
}`);
      };
      const key = mat.customProgramCacheKey?.bind(mat);
      mat.customProgramCacheKey = () => (key ? key() : '') + '|vivid' + k;
      mat.needsUpdate = true;
    }
  });
}

/** Load (once) and return the parsed glTF. */
export function loadGLB(path: string): Promise<GLTF> {
  let p = cache.get(path);
  if (!p) {
    p = fetchGLTF(modelUrl(path)).then((g) => { tune(g.scene, { shadows: true, rim: rimFor(path) }); return g; });
    cache.set(path, p);
  }
  return p;
}

/** A fresh copy of a model (skinned meshes and their skeletons are cloned properly), plus its clips. */
export async function instanceGLB(path: string, o: { shadows?: boolean } = {}): Promise<{ root: THREE.Object3D; clips: THREE.AnimationClip[] }> {
  const g = await loadGLB(path);
  const root = cloneSkinned(g.scene);
  if (o.shadows === false) tune(root, { shadows: false });
  return { root, clips: g.animations };
}

/** Start loading a set of models early (e.g. during the loading clock). */
export function preloadGLB(paths: string[]): Promise<unknown> {
  return Promise.allSettled(paths.map(loadGLB));
}
