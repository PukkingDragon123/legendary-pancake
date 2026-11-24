// [world3] Hoot Hollow's woods, borrowed from BUSHED (the owner's lumberjack game) and restyled: procedural
// low-poly trees with irregular trunks, root flare, curved branches and V-folded foliage cards painted from
// Poly Haven twig scans (bushed/build.ts), and ground-cover prototypes (ferns, cattails, mushrooms, shrubs, lily
// pads) from bushed/protos.ts, all wearing the calm-palette versions of BUSHED's hand-made textures.
// Everything here is a prototype geometry (metres, origin on the ground) that flora.ts instances.
import * as THREE from 'three';
import { buildTree } from './bushed/build.ts';
import { createTreeMaterials, vegMaterial, type TreeMaterialSet } from './bushed/materials.ts';
import * as V from './bushed/protos.ts';
import type { SpeciesId } from './bushed/species.ts';
import type { MeshBuilder } from './bushed/geom.ts';
import { tex } from './bushed/textures.ts';

export interface TreeProto { species: SpeciesId; height: number; crown: number; lod0: { bark: THREE.BufferGeometry; foliage: THREE.BufferGeometry | null }; lod1: { bark: THREE.BufferGeometry; foliage: THREE.BufferGeometry | null } }

const treeCache = new Map<string, TreeProto>();
/** A tree prototype (both levels of detail), cached by species, seed and age. */
export function treeProto(species: SpeciesId, seed: number, age: number, near = true): TreeProto {
  const key = `${species}:${seed}:${age}:${near}`;
  let t = treeCache.get(key);
  if (!t) {
    const m = buildTree(species, seed, { age, moss: species === 'oak' ? 0.4 : 0.15 });
    const l1 = m.lod(1);
    const l0 = near ? m.lod(0) : l1;
    t = { species, height: m.height, crown: m.crownRadius, lod0: { bark: l0.bark, foliage: l0.foliage }, lod1: { bark: l1.bark, foliage: l1.foliage } };
    treeCache.set(key, t);
  }
  return t;
}

const matCache = new Map<SpeciesId, TreeMaterialSet>();
/** Shared bark and foliage materials for a species. */
export function treeMaterials(species: SpeciesId): TreeMaterialSet {
  let m = matCache.get(species);
  if (!m) matCache.set(species, (m = createTreeMaterials(species)));
  return m;
}

let veg: ReturnType<typeof vegMaterial> | null = null;
/** The ground-cover atlas material. */
export function vegMat() { return (veg ??= vegMaterial()); }
let moss: THREE.MeshStandardMaterial | null = null;
/** Cushion moss (tiled moss scan, the mounds carry their own uv). */
export function mossMat() { return (moss ??= new THREE.MeshStandardMaterial({ map: tex('moss', { repeat: true }), vertexColors: true, roughness: 1, metalness: 0 })); }

/** Ground-cover prototypes (metres). Each returns leaf/card geometry on the veg atlas and optional wood. */
export type VegKind = 'alder' | 'blueberry' | 'raspberry' | 'juniper' | 'swordFern' | 'ostrich' | 'bracken' | 'cattails' | 'lilies'
  | 'agaric' | 'bolete' | 'chanterelle' | 'honey' | 'puffball' | 'cones' | 'moss';
const vegCache = new Map<string, { leaves: THREE.BufferGeometry; wood?: THREE.BufferGeometry }>();
export function vegProto(kind: VegKind, seed = 1): { leaves: THREE.BufferGeometry; wood?: THREE.BufferGeometry } {
  const key = kind + ':' + seed;
  let p = vegCache.get(key);
  if (p) return p;
  const b = (mb: MeshBuilder) => mb.build({ moss: false });
  switch (kind) {
    case 'alder': { const a = V.alder(seed, 1.5); p = { leaves: b(a.leaves), wood: a.wood.build({ moss: true }) }; break; }
    case 'blueberry': p = { leaves: b(V.sprigBush(seed, ['blueberry_a', 'blueberry_b'], 22, [0.22, 0.38], [0.15, 1.1], [0.95, 1, 0.95], 0.18)) }; break;
    case 'raspberry': p = { leaves: b(V.sprigBush(seed, ['raspberry', 'labrador'], 18, [0.3, 0.5], [0.3, 1.2], [1, 1, 0.95], 0.15)) }; break;
    case 'juniper': p = { leaves: b(V.sprigBush(seed, ['juniper'], 20, [0.3, 0.5], [0.0, 0.7], [0.95, 1, 1], 0.12)) }; break;
    case 'swordFern': p = { leaves: b(V.swordFern(seed, 'fern_a', 9, 0.75)) }; break;
    case 'ostrich': p = { leaves: b(V.ostrich(seed, 8, 0.9)) }; break;
    case 'bracken': p = { leaves: b(V.bracken(seed, 4, 0.75)) }; break;
    case 'cattails': p = { leaves: b(V.cattails(seed, 14, 3, 0.25)) }; break;
    case 'lilies': p = { leaves: b(V.flats(seed, ['lilypad', 'lilypad', 'lilypad_old', 'water_lily'], 5, [0.2, 0.32], 0.45, [0.0, 0.005], 0.02)) }; break;
    case 'cones': p = { leaves: b(V.cones(seed, 4, 0.12)) }; break;
    case 'moss': p = { leaves: b(V.mossMound(seed, 0.3, 0.08)) }; break;
    default: p = { leaves: b(V.mushrooms(seed, kind, kind === 'honey' ? 7 : kind === 'puffball' ? 4 : 4)) };
  }
  vegCache.set(key, p);
  return p;
}
