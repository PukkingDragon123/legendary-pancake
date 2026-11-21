// Loading the hand-made models: owls (Blender, faceted and hand-painted like the user's Gacha Garage
// toys) and the house, furniture and props (lowpix: low-poly with detailed hand-painted pixel-art
// atlases). Everything lives in public/models/<area>/<id>.glb and is loaded on demand, cached, and
// cloned per use. See docs/ART-STYLE.md.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map<string, Promise<GLTF>>();

/** URL of a model under public/models (works with the relative base of the artifact build). */
export const modelUrl = (path: string) => `${import.meta.env.BASE_URL}models/${path.replace(/^\//, '')}`;

/** Crisp pixel-art texels up close, no shimmer far away; a soft painted sheen, never a white flash. */
function tune(root: THREE.Object3D, o: { shadows: boolean }) {
  root.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = o.shadows;
    m.receiveShadow = o.shadows;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats as THREE.MeshStandardMaterial[]) {
      if (mat.map) {
        mat.map.magFilter = THREE.NearestFilter;
        mat.map.minFilter = THREE.LinearMipmapLinearFilter;
        mat.map.generateMipmaps = true;
        mat.map.anisotropy = 4;
        mat.map.needsUpdate = true;
      }
      if ('roughness' in mat) mat.roughness = Math.max(mat.roughness ?? 1, 0.6);
      if ('metalness' in mat) mat.metalness = Math.min(mat.metalness ?? 0, 0.5);
    }
  });
}

/** Load (once) and return the parsed glTF. */
export function loadGLB(path: string): Promise<GLTF> {
  let p = cache.get(path);
  if (!p) {
    p = loader.loadAsync(modelUrl(path)).then((g) => { tune(g.scene, { shadows: true }); return g; });
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
