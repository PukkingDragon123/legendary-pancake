// The hollow oak's hand-made parts: lowpix GLBs (art/lowpix/house, built by make.py into public/models/house).
// Each GLB holds up to four meshes by material class, all in house px (16 px = 1 world unit):
//   solid (lit, opaque) · card (lit, double-sided cut-outs: leaves, webs) · glow (lamps) · pane (window glass)
// plus named nodes the game animates (boards, the lock sign, box flaps). This module loads them, swaps in the
// game's materials (lit Lambert so day and night shade them, see-through-walls for build mode, wind on leaves)
// and hands back ready-to-place groups.
import * as THREE from 'three';
import { PX, wind } from '../../gfx/box.ts';
import { instanceGLB } from '../../gfx/glb.ts';
import { patchCut } from './kit.ts';

/** Shared looks the house drives every frame (night glow, window glass, wind). */
export const HOUSE_LOOK = {
  /** lamp glass: dim by day, bright at night */
  glow: new THREE.Color(1, 1, 1),
  /** lit window glass on open floors */
  pane: new THREE.Color(0x3a4a6a),
  /** window glass on boarded-up floors */
  dead: new THREE.Color(0x1c2230),
};

const glowMats = new Set<THREE.MeshBasicMaterial>();
const paneMats = new Set<{ m: THREE.MeshBasicMaterial; dead: boolean }>();

/** Copy the shared looks into every live material (call once a frame). */
export function syncLooks() {
  for (const m of glowMats) m.color.copy(HOUSE_LOOK.glow);
  for (const p of paneMats) p.m.color.copy(p.dead ? HOUSE_LOOK.dead : HOUSE_LOOK.pane);
}

/** Leaves sway in the shared wind (box.ts uniforms): tips move more than the stems. */
function patchSway(m: THREE.Material, amp: number) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uTime = wind.uTime;
    sh.uniforms.uWind = wind.uWind;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime; uniform vec3 uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec4 wp = modelMatrix * vec4(transformed, 1.0);
  float ph = wp.x * 0.37 + wp.z * 0.29 + wp.y * 0.11;
  float s = sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.7) * 0.25;
  float k = ${amp.toFixed(3)} * (0.6 + uWind.z * 6.0);
  transformed.x += s * k * 32.0; transformed.z += cos(uTime * 1.3 + ph) * k * 20.0; transformed.y += s * k * 8.0; }`);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|hsway' + amp;
}

export interface PartOpts {
  /** dissolve near the camera in the build view (walls of the floors) */
  cut?: boolean;
  /** cards sway in the wind (leaves); amplitude in house px */
  sway?: number;
  /** solids sway too (the whole canopy) */
  swaySolid?: number;
  /** panes start dark (boarded-up floor) */
  dead?: boolean;
  shadows?: boolean;
}

export interface HousePart {
  id: string;
  root: THREE.Group;
  /** the named nodes (animated parts) by name */
  nodes: Record<string, THREE.Object3D>;
  panes: { m: THREE.MeshBasicMaterial; dead: boolean }[];
  meshes: THREE.Mesh[];
  dispose(): void;
}

function convert(root: THREE.Object3D, o: PartOpts, part: HousePart) {
  const mats = new Map<string, THREE.Material>();
  root.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    const map = src.map;
    const cls = mesh.name.replace(/_\d+$/, '').replace(/\d+$/, '');
    const key = cls + ':' + (map?.uuid ?? '');
    let m = mats.get(key);
    if (!m) {
      if (cls === 'glow') {
        const g = new THREE.MeshBasicMaterial({ map, toneMapped: false, alphaTest: 0.5 });
        glowMats.add(g);
        m = g;
      } else if (cls === 'pane') {
        const p = new THREE.MeshBasicMaterial({ map, toneMapped: false, side: THREE.DoubleSide });
        const rec = { m: p, dead: !!o.dead };
        paneMats.add(rec);
        part.panes.push(rec);
        m = p;
      } else if (cls === 'card') {
        m = new THREE.MeshLambertMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide });
        if (o.sway) patchSway(m, o.sway);
      } else {
        m = new THREE.MeshLambertMaterial({ map });
        if (o.swaySolid) patchSway(m, o.swaySolid);
      }
      if (o.cut) patchCut(m);
      mats.set(key, m);
    }
    src.dispose();
    mesh.material = m;
    if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
    mesh.castShadow = o.shadows !== false && cls !== 'glow' && cls !== 'pane';
    mesh.receiveShadow = o.shadows !== false && cls !== 'glow' && cls !== 'pane';
    if (cls === 'card' && o.sway) {
      // leaves cast shadows through their cut-outs
      mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map, alphaTest: 0.5 });
    }
    part.meshes.push(mesh);
  });
  part.dispose = () => {
    for (const m of mats.values()) { glowMats.delete(m as THREE.MeshBasicMaterial); for (const p of paneMats) if (p.m === m) paneMats.delete(p); m.dispose(); }
  };
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
  const part: HousePart = { id, root, nodes: {}, panes: [], meshes: [], dispose: () => {} };
  convert(inst.root, o, part);
  inst.root.traverse((n) => { if (n.name && !(n as THREE.Mesh).isMesh && n !== inst.root) part.nodes[n.name] = n; });
  return part;
}

/** Which GLBs make up each floor band of the oak (and the crown). */
export const HOUSE_PARTS: { id: string; band: 'f1' | 'f2' | 'f3' | 'roof'; opts: PartOpts }[] = [
  { id: 'trunk_f1', band: 'f1', opts: { cut: true } },
  { id: 'roots', band: 'f1', opts: { cut: true, sway: 0.5 } },
  { id: 'porch', band: 'f1', opts: { cut: true, sway: 0.4 } },
  { id: 'room_f1', band: 'f1', opts: { cut: true } },
  { id: 'trunk_f2', band: 'f2', opts: { cut: true } },
  { id: 'balcony', band: 'f2', opts: { cut: true, sway: 0.6 } },
  { id: 'room_f2', band: 'f2', opts: { cut: true } },
  { id: 'trunk_f3', band: 'f3', opts: { cut: true } },
  { id: 'room_f3', band: 'f3', opts: { cut: true } },
  { id: 'roof', band: 'roof', opts: { sway: 0.5 } },
  { id: 'canopy', band: 'roof', opts: { swaySolid: 0.25 } },
  { id: 'leaves', band: 'roof', opts: { sway: 0.9, swaySolid: 0.25 } },
];
