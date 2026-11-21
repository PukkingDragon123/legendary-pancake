// [world3] The hand-made forest kit: lowpix models (art/lowpix/world, built to public/models/world)
// turned into instancing-ready pieces. Each GLB is split by part name into wood (trunk, roots, limbs,
// twigs, stumps, rocks...), crown (the low-poly leaf masses the seasons recolour) and glow (moonglow
// caps), baked into one geometry each in world blocks (16 model units = 1 block), with a per-vertex
// wind weight so trunks, crowns and the 2D leaf cards (foliage.ts) all sway together.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wind } from '../gfx/box.ts';
import { loadGLB } from '../gfx/glb.ts';
import SHAPE_DATA from '../assets/nature/shapes.json';
import type { LeafKind } from '../assets/nature.ts';

/** A tree or bush's leaf masses (model units) for the leaf cards, from art/lowpix/world/make.py. */
export interface KitShape { leaf: LeafKind; top: number; sway: number; blobs: { x: number; y: number; z: number; rx: number; ry: number; rz: number }[] }
export const SHAPES = SHAPE_DATA as unknown as Record<string, KitShape>;

export interface KitPiece { geo: THREE.BufferGeometry; mat: THREE.Material; depth?: THREE.Material }
export interface KitModel { wood: KitPiece | null; crown: KitPiece | null; glow: KitPiece | null; map: THREE.Texture; height: number }

const UNIT = 1 / 16;

const WIND_PARS = /* glsl */ `
attribute float aSway;
uniform float uTime;
uniform vec3 uWind;
`;
// the same sway as gfx/box.ts WIND_MAIN and the leaf cards (foliage.ts), without the push
const WIND_MAIN = /* glsl */ `
#ifdef USE_INSTANCING
  vec3 swBase = instanceMatrix[3].xyz; mat3 swM = mat3(instanceMatrix);
#else
  vec3 swBase = modelMatrix[3].xyz; mat3 swM = mat3(modelMatrix);
#endif
float swPh = dot(swBase.xz, vec2(0.37, 0.29)) + position.y * 0.6;
float swG = sin(uTime * 1.35 + swPh) * 0.55 + sin(uTime * 2.8 + swPh * 2.1) * 0.22 + sin(uTime * 0.43 + swPh * 0.33) * 0.5;
vec3 swOff = vec3(uWind.x * swG, -0.25 * abs(swG), uWind.y * swG) * (uWind.z * aSway);
transformed += (transpose(swM) * swOff) / dot(swM[0], swM[0]);
`;

/** Add the wind sway to a material (chains any patch already on it). */
export function patchKitWind(m: THREE.Material) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.uniforms.uTime = wind.uTime;
    sh.uniforms.uWind = wind.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + WIND_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + WIND_MAIN);
  };
  const base = prevKey.call(m);
  m.customProgramCacheKey = () => base + '|kitwind';
  m.needsUpdate = true;
}

type Kind = 'wood' | 'crown' | 'glow';
const kindOf = (name: string): Kind => (name.startsWith('crown') ? 'crown' : name.startsWith('glow') ? 'glow' : 'wood');

const cache = new Map<string, Promise<KitModel>>();

/** Load a kit model by id (public/models/world/<id>.glb). `sway` and `top` (model units) give the wind weights. */
export function loadKit(id: string, o: { sway?: number; top?: number } = {}): Promise<KitModel> {
  let p = cache.get(id);
  if (p) return p;
  p = loadGLB(`world/${id}.glb`).then((g) => {
    const lists: Record<Kind, THREE.BufferGeometry[]> = { wood: [], crown: [], glow: [] };
    let map: THREE.Texture | null = null;
    g.scene.updateMatrixWorld(true);
    let top = 0;
    g.scene.traverse((n) => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      map ??= mat.map;
      // part name: the node, or its parent when the loader split primitives
      const name = (mesh.name && !/^mesh_?\d*$/i.test(mesh.name) ? mesh.name : mesh.parent?.name) ?? '';
      const geo = mesh.geometry.clone();
      geo.applyMatrix4(mesh.matrixWorld);
      for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
      if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
      geo.computeBoundingBox();
      top = Math.max(top, geo.boundingBox!.max.y);
      lists[kindOf(name)].push(geo);
    });
    const height = o.top ?? top;
    const make = (k: Kind): KitPiece | null => {
      if (!lists[k].length) return null;
      const geo = mergeGeometries(lists[k], false)!;
      lists[k].forEach((x) => x.dispose());
      const pos = geo.attributes.position as THREE.BufferAttribute, sw = new Float32Array(pos.count);
      const sway = o.sway ?? 0;
      for (let i = 0; i < pos.count; i++) sw[i] = sway * Math.pow(Math.max(0, Math.min(1, pos.getY(i) / Math.max(1, height))), 1.4);
      geo.scale(UNIT, UNIT, UNIT);
      geo.setAttribute('aSway', new THREE.BufferAttribute(sw, 1));
      geo.computeBoundingSphere();
      const mat = k === 'glow'
        ? new THREE.MeshLambertMaterial({ map, emissiveMap: map, emissive: 0x000000 })
        : new THREE.MeshLambertMaterial({ map });
      mat.name = `kit:${id}:${k}`;
      let depth: THREE.Material | undefined;
      if (sway > 0) {
        patchKitWind(mat);
        depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
        patchKitWind(depth);
      }
      return { geo, mat, depth };
    };
    if (!map) throw new Error('kit model without a texture: ' + id);
    return { wood: make('wood'), crown: make('crown'), glow: make('glow'), map, height: height * UNIT };
  });
  cache.set(id, p);
  return p;
}

/** Every kit model the forest uses (for preloading behind the loading clock). */
export const KIT_IDS = ['oak_a', 'oak_b', 'maple', 'blossom', 'birch', 'pine_a', 'pine_b', 'sapling', 'bush', 'stump', 'log', 'rock_a', 'rock_b', 'toadstools', 'boletes', 'chanterelles', 'moonglow'];
