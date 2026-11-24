// The hollow oak's hand-made parts: lowpix GLBs (art/lowpix/house, built by make.py into public/models/house).
// Each GLB holds up to four meshes by material class, all in house px (16 px = 1 world unit):
//   solid (lit, opaque) · card (lit, double-sided cut-outs: leaves, webs) · glow (lamps) · pane (window glass)
// plus named nodes the game animates (boards, the lock sign, box flaps). This module loads them, swaps in the
// game's materials (lit Lambert so day and night shade them, see-through-walls for build mode, wind on leaves)
// and hands back ready-to-place groups.
import * as THREE from 'three';
import { PX, wind } from '../../gfx/box.ts';
import { instanceGLB, modelUrl } from '../../gfx/glb.ts';
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
  /** keep the texture nearest-filtered (pixel-art props) */
  nearest?: boolean;
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

// ------------------------------------------------------------------ tiling scans (BUSHED's look)

/**
 * The big surfaces (bark, planks, beams, stone) are drawn with crisp high-resolution pixel-art scans that tile in
 * house space (triplanar: they wrap the round trunk, the roots and the boughs without UVs), modulated by the
 * model's own painted atlas, which carries the moss, lichen, wear and painted light. House px per repeat:
 */
const TILE_SCALE: Record<string, number> = { bark: 100, wood: 38, boards: 64, stone: 46, grey: 50 };
const tileTex = new Map<string, THREE.Texture>();
const texLoader = new THREE.TextureLoader();
function tileTexture(kind: string): THREE.Texture {
  let t = tileTex.get(kind);
  if (t) return t;
  t = texLoader.load(modelUrl(`house/tex/${kind}.png`));
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  tileTex.set(kind, t);
  return t;
}

function patchTile(m: THREE.Material, kind: string, base: THREE.Color) {
  const u = { uTile: { value: tileTexture(kind) }, uTileBase: { value: base }, uTileScale: { value: TILE_SCALE[kind] ?? 48 } };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTileP; varying vec3 vTileN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvTileP = (modelMatrix * vec4(transformed, 1.0)).xyz * 16.0;\nvTileN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTileP; varying vec3 vTileN;\nuniform sampler2D uTile; uniform vec3 uTileBase; uniform float uTileScale;')
      .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 tw = pow(abs(normalize(vTileN)), vec3(8.0)); tw /= (tw.x + tw.y + tw.z);
  vec3 p = vTileP / uTileScale;
  vec3 tc = texture2D(uTile, vec2(p.z, -p.y)).rgb * tw.x + texture2D(uTile, vec2(p.x, p.z)).rgb * tw.y + texture2D(uTile, vec2(p.x, -p.y)).rgb * tw.z;
  vec3 k = clamp(diffuseColor.rgb / max(uTileBase, vec3(0.02)), vec3(0.25), vec3(2.4));
  diffuseColor.rgb = tc * k;
}`);
  };
  const key = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (key ? key() : '') + '|tile';
}

function convert(root: THREE.Object3D, o: PartOpts, part: HousePart) {
  const mats = new Map<string, THREE.Material>();
  let smooth: THREE.Texture | null = null;
  root.traverse((n) => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let map = src.map;
    const cls = mesh.name.replace(/_\d+$/, '').replace(/\d+$/, '');
    const tile = cls.startsWith('tile_') ? cls.slice(5) : '';
    // crisp pixels up close (nearest magnification, mipmapped minification); under a tiling scan the painted
    // atlas is only a soft modulation, so that copy is smoothed
    if (map && tile) {
      if (!smooth) { smooth = map.clone(); smooth.magFilter = THREE.LinearFilter; smooth.needsUpdate = true; }
      map = smooth;
    }
    const base = tile ? new THREE.Color().fromArray((mesh.userData.base as number[] | undefined) ?? [0.5, 0.4, 0.3]).convertSRGBToLinear() : null;
    const key = cls + ':' + (map?.uuid ?? '') + (base ? base.getHexString() : '');
    let m = mats.get(key);
    if (!m) {
      if (tile) {
        m = new THREE.MeshLambertMaterial({ map });
        patchTile(m, tile, base!);
        if (o.swaySolid) patchSway(m, o.swaySolid);
      } else if (cls === 'glow') {
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
        m = new THREE.MeshLambertMaterial({ map, alphaTest: src.alphaTest > 0 ? 0.5 : 0, side: src.side });
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

/**
 * Borrowed CC0 nature props bedded round the foot of the oak (Poly Haven scans as restyled for BUSHED, see
 * docs/credits/house3.md): angle round the trunk, distance past the flared foot (px), the model's metres -> px
 * scale, yaw (deg).
 */
export const HOUSE_PROPS: { id: string; a: number; d: number; s: number; yaw: number }[] = [
  { id: 'props/boulder_01', a: -1.26, d: 20, s: 15, yaw: 30 },
  { id: 'props/stone_01', a: -1.4, d: 36, s: 60, yaw: 70 },
  { id: 'props/bark_debris_01', a: -1.84, d: 10, s: 15, yaw: -20 },
  { id: 'props/tree_stump_01', a: 2.12, d: 30, s: 14, yaw: 15 },
  { id: 'props/rock_07', a: 2.28, d: 12, s: 46, yaw: 110 },
  { id: 'props/dry_branches_medium_01', a: -2.74, d: 16, s: 17, yaw: 40 },
  { id: 'props/boulder_01', a: 2.72, d: 8, s: 10, yaw: -60 },
  { id: 'props/rock_09', a: -1.12, d: 44, s: 60, yaw: 10 },
  { id: 'props/stone_01', a: 1.78, d: 34, s: 52, yaw: -35 },
  { id: 'props/rock_07', a: -2.26, d: 30, s: 40, yaw: 200 },
];
