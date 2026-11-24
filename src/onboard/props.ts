// The interview office's models: hand-made lowpix models (low poly with dense hand-painted pixel-art
// textures) built from the specs in art/lowpix/interview/ into public/models/interview/<id>.glb. This module
// knows the ids, where things stand (in world units), and how to load, clone and tint them.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadGLB } from '../gfx/glb.ts';

/** The office furniture and fittings: hand-made ones (lowpix specs) and borrowed, restyled props (b_ from BUSHED,
 * g_ from Gacha Garage; see art/lowpix/interview/borrow.py and docs/credits/interview3.md). */
export const ROOM_MODELS = ['room', 'desk_drawer', 'clock', 'window', 'curtains', 'corkboard', 'rug', 'ivy', 'teacup', 'papers', 'inkwell', 'books_stack', 'books_row',
  'candle', 'nameplate', 'wallshelf', 'painting', 'globe', 'glasses', 'clipboard_small',
  'plant_floor', 'plant_pothos', 'plant_fern',
  'b_desk', 'b_chair', 'b_bookcase', 'b_oillamp', 'b_lantern', 'b_mantelclock', 'b_sidetable', 'b_cabinet', 'b_basket', 'b_suitcase', 'b_jug', 'b_bowl',
  'g_books'] as const;
/** Props that pop in while Pip acts out your answers. */
export const PROP_MODELS = ['b_daybed', 'pillow', 'sheep', 'fence', 'phone', 'microphone', 'milk', 'g_teapot', 'beans', 'g_radio', 'g_gramophone', 'stove', 'book_open', 'sunflower',
  'mug_sun', 'mug_moon'] as const;
export type ModelId = (typeof ROOM_MODELS)[number] | (typeof PROP_MODELS)[number];

const path = (id: string) => `interview/${id}.glb`;
const templates = new Map<string, THREE.Object3D>();
let all: Promise<void> | null = null;

/** Load every interview model (once); resolves when they are all in (failures are logged and skipped). */
export function loadModels(): Promise<void> {
  if (!all) {
    all = Promise.all([...ROOM_MODELS, ...PROP_MODELS].map(async (id) => {
      try {
        const g = await loadGLB(path(id));
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          const mat = m.material as THREE.MeshStandardMaterial;
          // painted light lives in the texture: keep the scene's light soft on it
          mat.roughness = 0.95; mat.metalness = 0; mat.envMapIntensity = 0;
        });
        templates.set(id, flatten(g.scene));
      } catch (e) { console.warn('interview model failed', id, e); }
    })).then(() => undefined);
  }
  return all;
}
export const modelsReady = () => templates.size > 0;

/** Joints the game animates stay separate; everything else in a model is merged into one mesh per material. */
const KEEP = new Set(['hand_h', 'hand_m', 'pendulum', 'flame', 'screen', 'dial', 'star', 'fire', 'leaves']);

/** Merge a lowpix model's many part meshes (one node per part) into a draw call per material. */
function flatten(root: THREE.Object3D): THREE.Object3D {
  root.updateMatrixWorld(true);
  // meshes merge into the space of their nearest animated joint (or the model's root), one mesh per material there
  const groups = new Map<string, { at: THREE.Object3D; mat: THREE.Material; list: THREE.BufferGeometry[] }>();
  const merged: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    let at: THREE.Object3D = root;
    for (let p: THREE.Object3D | null = m; p && p !== root; p = p.parent) if (KEEP.has(p.name)) { if (p === m) return; at = p; break; }
    const inv = at.matrixWorld.clone().invert();
    let g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    if (g.index) g = g.toNonIndexed();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    const mat = m.material as THREE.Material, key = at.uuid + mat.uuid;
    if (!groups.has(key)) groups.set(key, { at, mat, list: [] });
    groups.get(key)!.list.push(g);
    merged.push(m);
  });
  // the merged meshes' nodes become plain groups (their kept children ride along)
  for (const m of merged) {
    const g = new THREE.Group();
    g.name = m.name; g.position.copy(m.position); g.quaternion.copy(m.quaternion); g.scale.copy(m.scale);
    for (const c of [...m.children]) g.add(c);
    m.parent?.add(g);
    m.parent?.remove(m);
  }
  for (const { at, mat, list } of groups.values()) {
    const geo = mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    at.add(mesh);
  }
  return root;
}

/** A fresh copy of a model (an empty group if it is not loaded). Materials are shared unless `tint` is given. */
export function model(id: ModelId, o: { tint?: number; shadows?: boolean } = {}): THREE.Object3D {
  const t = templates.get(id);
  if (!t) return new THREE.Group();
  const c = t.clone(true);
  c.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = o.shadows ?? true; m.receiveShadow = true;
    if (o.tint !== undefined) { const mat = (m.material as THREE.MeshStandardMaterial).clone(); mat.color.setHex(o.tint); m.material = mat; m.userData.ownMat = true; }
  });
  return c;
}
/** Free the materials a tinted copy made for itself. */
export function release(obj: THREE.Object3D) {
  obj.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.userData.ownMat) (m.material as THREE.Material).dispose(); });
}

// ------------------------------------------------------------------ the layout (world units, 16 old px = 1)

export const ROOM = { R: 5.125, H: 5.75 };
/** The desk (front at z + d/2) and its drawer slot. */
export const DESK = { w: 1.72, d: 1.01, h: 1.09, z: -2.5, drawerX: 0.55, drawerY: 0.62 };
/** A point on the curved wall at angle `a` (radians, 0 = straight back, + = to the right), `inset` in front of it. */
export const onWall = (a: number, y: number, inset = 0) => new THREE.Vector3(Math.sin(a) * (ROOM.R - inset), y, -Math.cos(a) * (ROOM.R - inset));
