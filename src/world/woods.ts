// [world3] Hoot Hollow's woods, borrowed from BUSHED (the owner's lumberjack game) and restyled: procedural
// low-poly trees with irregular trunks, root flare, curved branches and V-folded foliage cards painted from
// Poly Haven twig scans (bushed/build.ts), and ground-cover prototypes (ferns, cattails, mushrooms, shrubs, lily
// pads) from bushed/protos.ts, all wearing the calm-palette versions of BUSHED's hand-made textures.
// Everything here is a prototype geometry (metres, origin on the ground) that flora.ts instances.
import * as THREE from 'three';
import { buildTree, leafPoints } from './bushed/build.ts';
import { canopy, conifer, fronds, puffsFromPoints, type LeafCell, type Puff } from './foliage.ts';
import { createTreeMaterials, vegMaterial, type TreeMaterialSet } from './bushed/materials.ts';
import * as V from './bushed/protos.ts';
import type { SpeciesId } from './bushed/species.ts';
import type { MeshBuilder } from './bushed/geom.ts';
import { tex } from './bushed/textures.ts';

export interface TreeProto { species: SpeciesId; height: number; crown: number; lod0: { bark: THREE.BufferGeometry; foliage: THREE.BufferGeometry | null }; lod1: { bark: THREE.BufferGeometry; foliage: THREE.BufferGeometry | null } }

const treeCache = new Map<string, TreeProto>();
/**
 * A tree prototype (both levels of detail), cached by species, seed, age and leaves. [look4] The trunk and limbs are
 * BUSHED's; the crown is Hoot Hollow's bushy leaf-card canopy (foliage.ts) grown where BUSHED put its leaves.
 */
export function treeProto(species: SpeciesId, seed: number, age: number, near = true, leaves: LeafCell[] = ['oak']): TreeProto {
  const key = `${species}:${seed}:${age}:${near}:${leaves.join('+')}`;
  let t = treeCache.get(key);
  if (!t) {
    const m = buildTree(species, seed, { age, moss: species === 'oak' ? 0.4 : 0.15 });
    const l1 = m.lod(1);
    const l0 = near ? m.lod(0) : l1;
    const pts = leafPoints(m);
    const crown = (detail: number) => {
      if (!pts.length) return null;
      if (species === 'spruce' || species === 'fir' || species === 'pine' || species === 'cedar') {
        let base = Infinity, top = 0, rad = 0;
        for (const p of pts) { base = Math.min(base, p.y); top = Math.max(top, p.y); rad = Math.max(rad, Math.hypot(p.x, p.z)); }
        return conifer({ cell: leaves[0], seed, base: Math.max(m.height * 0.12, base), top: Math.max(top, m.height * 0.98), radius: rad * 0.95, detail, size: species === 'pine' ? 0.9 : 1 });
      }
      const R = Math.max(1, m.crownRadius);
      const puffs: Puff[] = puffsFromPoints(pts, { cell: R * (species === 'birch' ? 0.55 : 0.6), grow: 0.88, max: 22, minR: R * 0.34 })
        .map((p) => ({ ...p, sy: 0.85 }));
      return canopy(puffs, { cells: leaves, seed, size: R * (detail < 1 ? 0.44 : 0.36), cover: detail < 1 ? 1.6 : 2.4, height: m.height, sway: 0.025, core: true, depthDark: 0.34 });
    };
    const foliage = crown(near ? 1 : 0.6);
    t = { species, height: m.height, crown: m.crownRadius, lod0: { bark: l0.bark, foliage }, lod1: { bark: l1.bark, foliage } };
    treeCache.set(key, t);
  }
  return t;
}

/** [look4] Leafy shrubs, hedges and ferns on the leaf atlas (block units, origin on the ground). */
export type ShrubKind = 'round' | 'hedge' | 'holly' | 'elder' | 'lilac' | 'fern' | 'bracken';
const shrubCache = new Map<string, THREE.BufferGeometry>();
export function shrubProto(kind: ShrubKind, seed = 1): THREE.BufferGeometry {
  const key = kind + ':' + seed;
  let g = shrubCache.get(key);
  if (g) return g;
  const rnd = (k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  const mound = (n: number, r: number, h: number): Puff[] => {
    const out: Puff[] = [{ x: 0, y: h * 0.55, z: 0, r, sy: h / r * 0.62 }];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd(i) * 1.2, d = r * (0.45 + rnd(i + 9) * 0.3);
      out.push({ x: Math.cos(a) * d, y: h * (0.4 + rnd(i + 3) * 0.25), z: Math.sin(a) * d, r: r * (0.55 + rnd(i + 5) * 0.25), sy: 0.8 });
    }
    return out;
  };
  switch (kind) {
    case 'round': g = canopy(mound(3, 0.62, 0.95), { cells: ['hedge', 'hedge', 'oakFresh'], seed, size: 0.5, cover: 2.6, floor: 0.02, sway: 0.05 }); break;
    case 'hedge': g = canopy(mound(4, 0.7, 0.9), { cells: ['hedge'], seed, size: 0.48, cover: 2.8, floor: 0.02, sway: 0.04 }); break;
    case 'holly': g = canopy(mound(3, 0.6, 1.1), { cells: ['holly', 'holly', 'hedge'], seed, size: 0.55, cover: 2.6, floor: 0.02, sway: 0.04 }); break;
    case 'elder': g = canopy(mound(3, 0.7, 1.2), { cells: ['elder', 'elder', 'oakFresh'], seed, size: 0.6, cover: 2.4, floor: 0.02, sway: 0.06 }); break;
    case 'lilac': g = canopy(mound(3, 0.66, 1.25), { cells: ['lilac', 'lilac', 'birch'], seed, size: 0.6, cover: 2.4, floor: 0.02, sway: 0.06 }); break;
    case 'fern': g = fronds({ cell: 'fern', seed, n: 9, len: 0.95, width: 0.5, lift: [0.55, 1.15] }); break;
    default: g = fronds({ cell: 'fern', seed, n: 6, len: 1.25, width: 0.62, lift: [0.3, 0.75] }); break;
  }
  shrubCache.set(key, g);
  return g;
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
