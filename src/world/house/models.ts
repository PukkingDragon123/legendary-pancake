// Loading the oak's few model files: the borrowed CC0 rocks, stump and branches bedded round the foot of the trunk
// (Poly Haven scans as restyled for BUSHED, see docs/credits/house3.md). Their materials become lit standard ones
// (so day, night and the lamps shade them) that honour build mode's see-through walls.
import * as THREE from 'three';
import { PX } from '../../gfx/box.ts';
import { instanceGLB } from '../../gfx/glb.ts';
import { patchCut } from './kit.ts';

export interface PartOpts {
  /** dissolve near the camera in the build view */
  cut?: boolean;
  shadows?: boolean;
}

export interface HousePart {
  id: string;
  root: THREE.Group;
  /** the named nodes (animated parts) by name */
  nodes: Record<string, THREE.Object3D>;
  meshes: THREE.Mesh[];
  dispose(): void;
}

function convert(root: THREE.Object3D, o: PartOpts, part: HousePart) {
  const mats = new Map<string, THREE.Material>();
  root.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    const key = src.uuid;
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ map: src.map, color: src.color, alphaTest: src.alphaTest > 0 ? 0.5 : 0, side: src.side, roughness: 0.9, metalness: 0, vertexColors: src.vertexColors });
      if (o.cut) patchCut(m);
      mats.set(key, m);
    }
    mesh.material = m;
    if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
    mesh.castShadow = o.shadows !== false;
    mesh.receiveShadow = o.shadows !== false;
    part.meshes.push(mesh);
  });
  part.dispose = () => { for (const m of mats.values()) m.dispose(); };
}

const failed = new Set<string>();

/** Load a part of the house (house/<id>.glb) as a group in world units (scaled from px). */
export async function loadPart(id: string, o: PartOpts = {}): Promise<HousePart | null> {
  if (failed.has(id)) return null;
  let inst: { root: THREE.Object3D };
  try {
    inst = await instanceGLB(`house/${id}.glb`, { shadows: o.shadows });
  } catch (e) {
    failed.add(id);
    console.warn('house part missing', id, e);
    return null;
  }
  const root = new THREE.Group();
  root.name = 'part:' + id;
  root.scale.setScalar(PX);
  root.add(inst.root);
  const part: HousePart = { id, root, nodes: {}, meshes: [], dispose: () => {} };
  convert(inst.root, o, part);
  inst.root.traverse((n) => { if (n.name && !(n as THREE.Mesh).isMesh && n !== inst.root) part.nodes[n.name] = n; });
  return part;
}

/**
 * Borrowed CC0 nature props bedded round the foot of the oak: angle round the trunk, distance past the flared foot
 * (px), the model's metres -> px scale, yaw (deg).
 */
export const HOUSE_PROPS: { id: string; a: number; d: number; s: number; yaw: number }[] = [
  { id: 'props/boulder_01', a: -1.26, d: 34, s: 15, yaw: 30 },
  { id: 'props/stone_01', a: -1.4, d: 56, s: 60, yaw: 70 },
  { id: 'props/bark_debris_01', a: -1.84, d: 26, s: 15, yaw: -20 },
  { id: 'props/tree_stump_01', a: 2.12, d: 60, s: 14, yaw: 15 },
  { id: 'props/rock_07', a: 2.28, d: 30, s: 46, yaw: 110 },
  { id: 'props/dry_branches_medium_01', a: -2.74, d: 30, s: 17, yaw: 40 },
  { id: 'props/boulder_01', a: 2.72, d: 26, s: 10, yaw: -60 },
  { id: 'props/rock_09', a: -1.12, d: 64, s: 60, yaw: 10 },
  { id: 'props/stone_01', a: 1.78, d: 56, s: 52, yaw: -35 },
  { id: 'props/rock_07', a: -2.26, d: 46, s: 40, yaw: 200 },
];
