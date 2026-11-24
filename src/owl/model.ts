// Pip and every owl: hand-painted faceted toys, modelled in Blender in the style of the owner's Gacha Garage capsule
// toys (art/blender/owls/owl.py, docs/ART-STYLE.md). Each model is a GLB in public/models/owls/<id>.glb: a rigid-part
// hierarchy (body > head > tufts, jaw ...; wings, tail; legs) on one 2048 px brush-painted atlas, plus two eye decal
// patches cut from the head's own facets on which the game draws simple ink-dot eyes (src/owl/eyes.ts), so Pip can
// blink, smile and swoon. Anchor nodes (anchor_head / face / neck / chest / back / hold) carry outfit pieces
// (src/owl/outfits.ts), scaled to the wearer.
//
// buildOwl(look) returns at once: the joints are laid out from the rig sheet (src/owl/rig.gen.ts) so OwlActor can
// animate straight away, and the painted meshes drop in when the GLB has loaded (`ready`; instantly when it is
// already cached: preloadOwls()). Nothing is shown until then: no stand-in owl.
import * as THREE from 'three';
import { PX, type Vec3 } from '../gfx/box.ts';
import { col } from '../gfx/color.ts';
import { loadGLB } from '../gfx/glb.ts';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Eye, type EyeColours } from './eyes.ts';
import { geoOf, type Geo } from './geo.ts';
import { dressModel, type Dressing } from './outfits.ts';
import { OWL_RIGS } from './rig.gen.ts';
import type { OwlRigData } from './rigtypes.ts';
import { SPECIAL_SKIN } from './skins.ts';
import { resolveSpecies, speciesOf, type SpeciesDef } from './species.ts';
export { owlBoxes } from './legacy.ts';

/** Model px (the old voxel unit, 16 per world unit) per toy millimetre: a tawny's ~44 mm is the old Pip's height. */
export const MM = 0.56;
/** World units per toy millimetre. */
export const MM_WORLD = MM * PX;

export type OutfitSlot = 'head' | 'face' | 'neck' | 'body' | 'back';

export interface OwlLook {
  /** 'owl' (plain species plumage), 'meowl' (kitten head), or a special skin id (gingerbread...) */
  skin?: string;
  /** real owl species the body is modelled on (see species registry). Source of truth. */
  species?: string;
  /** legacy coat id; still read for old saves and Meowl coats */
  palette: string;
  outfit: Partial<Record<OutfitSlot, string>>;
  /** Queen Neve's model (an elegant snowy owl lady with her regalia) */
  feminine?: boolean;
  /** something carried under the right wing ('scepter': part of the queen's model) */
  held?: string;
}

export type BoneName = 'body' | 'head' | 'tuftL' | 'tuftR' | 'browL' | 'browR' | 'jaw' | 'wingL' | 'wingR' | 'handL' | 'handR' | 'tail' | 'legL' | 'legR';
export const BONES: BoneName[] = ['body', 'head', 'tuftL', 'tuftR', 'browL', 'browR', 'jaw', 'wingL', 'wingR', 'handL', 'handR', 'tail', 'legL', 'legR'];
/** The GLB's joint node names. */
const GLB: Record<BoneName, string> = {
  body: 'body', head: 'head', tuftL: 'tuft_l', tuftR: 'tuft_r', browL: 'brow_l', browR: 'brow_r', jaw: 'jaw',
  wingL: 'wing_l', wingR: 'wing_r', handL: 'hand_l', handR: 'hand_r', tail: 'tail', legL: 'leg_l', legR: 'leg_r',
};
const PARENT: Partial<Record<BoneName, BoneName>> = {
  head: 'body', tuftL: 'head', tuftR: 'head', browL: 'head', browR: 'head', jaw: 'head', wingL: 'body', wingR: 'body',
  handL: 'wingL', handR: 'wingR', tail: 'body',
};
export type Pivots = Record<BoneName, Vec3>;
export type AnchorName = 'anchor_head' | 'anchor_face' | 'anchor_neck' | 'anchor_chest' | 'anchor_back' | 'anchor_hold';

export interface OwlRig {
  root: THREE.Group;
  /** one group per joint (the actor turns these); missing joints are empty groups */
  bones: Record<BoneName, THREE.Group>;
  /** world-unit height of the model */
  height: number;
  dispose(): void;
}

export interface OwlModel {
  /** the GLB this look shows (a species id, a skin id or 'queen') */
  id: string;
  rig: OwlRig;
  eyes: [Eye, Eye];
  /** the eye decals (empty until the GLB is in); their position is the eye centre in the head's frame */
  eyeMeshes: THREE.Mesh[];
  look: OwlLook;
  height: number;
  /** this owl's measurements in model px (legacy Geo, overridden from the toy's rig sheet) */
  g: Geo;
  /** joint pivots (model px, absolute) and the joints' rest offsets from their parents (model px) */
  pivots: Pivots;
  rest: Pivots;
  /** the head's centre above its pivot (model px) */
  headUp: number;
  species: SpeciesDef;
  /** outfit anchors (filled when the GLB is in) */
  anchors: Partial<Record<AnchorName, THREE.Object3D>>;
  /** resolves once the painted model is in place (and the outfit pieces that exist are on) */
  ready: Promise<void>;
  loaded: boolean;
  /** the wing meshes (left, right) whose 'spread' morph target opens the folded wing to its full span */
  spread: [THREE.Mesh[], THREE.Mesh[]];
  dispose(): void;
}

/** Which GLB a look shows: the queen, a special skin, or the species (falling back to the tawny while a model is missing). */
export function modelIdOf(look: Pick<OwlLook, 'skin' | 'species' | 'palette' | 'feminine'>): string {
  if (look.feminine && OWL_RIGS.queen) return 'queen';
  const skin = look.skin && look.skin !== 'owl' ? look.skin : null;
  if (skin && OWL_RIGS[skin]) return skin;
  const sp = resolveSpecies(look).id;
  return OWL_RIGS[sp] ? sp : 'tawny';
}

export const owlPath = (id: string) => `owls/${id}.glb`;

// ------------------------------------------------------------------ loading
type GLTFLike = { scene: THREE.Object3D };
const loaded = new Map<string, GLTFLike>();
const loading = new Map<string, Promise<GLTFLike | null>>();

function fetchOwl(id: string): Promise<GLTFLike | null> {
  let p = loading.get(id);
  if (!p) {
    p = loadGLB(owlPath(id)).then((g) => { prepare(g.scene); loaded.set(id, g); return g; }, (e) => { console.warn('owl model failed', id, e); return null; });
    loading.set(id, p);
  }
  return p;
}

/** The owls are lit like everything else (v4: ACES, sun, sky fill, an environment map): a matte feathered coat whose
 * roughness map makes the bill and talons glossy, and whose normal map (the painted feathers' relief) catches the light.
 * The eye decals never cast shadows. (An old faceted toy shipped without normals is still shaded flat.) */
function prepare(scene: THREE.Object3D) {
  scene.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.name.startsWith('eye_')) { m.castShadow = false; m.receiveShadow = false; return; }
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat && !m.geometry.attributes.normal && !mat.flatShading) { mat.flatShading = true; mat.needsUpdate = true; }
    if (mat && mat.map && !mat.userData.owl) {
      mat.userData.owl = true;
      if (mat.roughnessMap) { mat.roughness = 1; mat.roughnessMap.magFilter = THREE.LinearFilter; } // (feathers ~0.86, bill and talons ~0.35)
      else mat.roughness = Math.max(mat.roughness ?? 1, 0.72);
      mat.metalness = 0;
      if (mat.normalMap) mat.normalMap.magFilter = THREE.LinearFilter;
      if (mat.emissiveMap) mat.emissiveMap.magFilter = THREE.NearestFilter; // (the celestial owl's stars)
      mat.needsUpdate = true;
    }
  });
}

/** Start loading these looks' models (e.g. Pip's during the loading clock); resolves when they are in. */
export function preloadOwls(looks: (Partial<OwlLook> | string)[]): Promise<unknown> {
  return Promise.all(looks.map((l) => fetchOwl(typeof l === 'string' ? l : modelIdOf({ palette: 'tawny', ...l }))));
}
/** Resolves when the model for this look is loaded (so a snapshot of `buildOwl(look)` shows the painted toy). */
export const owlReady = (look: OwlLook) => fetchOwl(modelIdOf(look)).then(() => undefined);

// ------------------------------------------------------------------ measurements
const toPx = (v: number[]): Vec3 => [v[0] * MM, v[1] * MM, v[2] * MM];

function rigOf(id: string): OwlRigData | undefined {
  return OWL_RIGS[id];
}

/** A Geo (the old voxel owl's anchor points, model px) for a model, overridden with the toy's own measurements. */
export function geoFor(id: string, species: SpeciesDef = speciesOf(id)): Geo {
  const g = geoOf(species.shape);
  const r = rigOf(id);
  if (!r) return g;
  const d = r.dims;
  const headY = (d.headZ - d.headH * 0.48) * MM, headTop = (d.headZ + d.headH * 0.52) * MM;
  const disc = d.faceY * MM;
  Object.assign(g, {
    bodyY: d.bodyZ0 * MM, bodyH: (d.bodyZ1 - d.bodyZ0) * MM, bodyTop: d.bodyZ1 * MM, bodyW: d.bodyW * MM, bodyD: d.bodyD * MM,
    chestZ: d.bodyD * 0.5 * MM, shoulderY: (d.bodyZ1 - 3) * MM,
    neckY: (r.pivots.head?.[1] ?? d.bodyZ1) * MM, headY, headH: d.headH * MM, headW: d.headW * MM, headD: d.headD * MM, headZ: 0,
    headTop, headFront: disc - 0.4, discFront: disc, faceFront: disc, rimFront: disc + 0.6,
    eyeX: d.eyeX * MM, eyeY: d.eyeZ * MM, eyeS: (r.eyes.eye_l?.r ?? 1.85) * 4 * MM,
    beakY: (d.eyeZ - 2.4) * MM, beakTip: (d.eyeZ - 5.2) * MM, noseY: (d.eyeZ - 3.2) * MM,
    wingX: (d.bodyW * 0.5 + 1.5) * MM, tuftTop: d.tuftTop * MM, legTop: d.bodyZ0 * MM,
  });
  return g;
}

/** The tawny's measurements (model px): framing code that predates the toys reads these. */
export const G: Geo = geoFor('tawny', speciesOf('tawny'));

function pivotsFor(id: string, g: Geo): { piv: Pivots; rest: Pivots } {
  const r = rigOf(id);
  const piv = {} as Pivots;
  const fallback: Pivots = {
    body: [0, g.bodyY, 0], head: [0, g.neckY, 0], tuftL: [-g.headW * 0.28, g.headTop - 1, 0], tuftR: [g.headW * 0.28, g.headTop - 1, 0],
    browL: [-g.eyeX, g.eyeY + 1.6, g.discFront], browR: [g.eyeX, g.eyeY + 1.6, g.discFront], jaw: [0, g.beakY - 1, g.discFront],
    wingL: [-(g.bodyW / 2), g.shoulderY, 0], wingR: [g.bodyW / 2, g.shoulderY, 0], handL: [-(g.bodyW / 2 + 0.5), g.bodyY + g.bodyH * 0.4, -1],
    handR: [g.bodyW / 2 + 0.5, g.bodyY + g.bodyH * 0.4, -1], tail: [0, g.bodyY + 1.5, -g.bodyD / 2], legL: [-2.8, g.bodyY + 1, 0.4], legR: [2.8, g.bodyY + 1, 0.4],
  };
  for (const b of BONES) {
    const p = r?.pivots[GLB[b]];
    piv[b] = p ? toPx(p) : fallback[b];
  }
  const rest = {} as Pivots;
  for (const b of BONES) {
    const par = PARENT[b];
    const pp = par ? piv[par] : [0, 0, 0];
    rest[b] = [piv[b][0] - pp[0], piv[b][1] - pp[1], piv[b][2] - pp[2]];
  }
  return { piv, rest };
}

// ------------------------------------------------------------------ the eyes
function eyeColoursFor(id: string, look: OwlLook): EyeColours {
  if (id === 'celestial') return { ink: '#f2dc9a', star: '#f6ecc4', heart: '#f2dc9a', glow: true };
  if (id === 'gingerbread') return { ink: '#3a2418', heart: '#b84a44' };
  if (id === 'snowman') return { ink: '#2e2c2a' };
  if (id === 'queen' || look.feminine) return { ink: '#2a2830', lashes: true, heart: '#9a6a8a', star: '#8fb0c4' };
  return { ink: '#231f1b' };
}

// ------------------------------------------------------------------ the model
export function buildOwl(look: OwlLook): OwlModel {
  const id = modelIdOf(look);
  const species = resolveSpecies(look);
  const g = geoFor(id, species);
  const { piv, rest } = pivotsFor(id, g);
  const r = rigOf(id);
  const root = new THREE.Group();
  root.name = 'owl';
  const bones = {} as Record<BoneName, THREE.Group>;
  const frames = {} as Record<BoneName, THREE.Group>;
  for (const b of BONES) {
    const j = new THREE.Group();
    j.name = b;
    j.position.set(rest[b][0] * PX, rest[b][1] * PX, rest[b][2] * PX);
    const f = new THREE.Group(); // the toy's millimetre frame inside the joint
    f.name = b + ':mm';
    f.scale.setScalar(MM_WORLD);
    j.add(f);
    bones[b] = j;
    frames[b] = f;
  }
  for (const b of BONES) (PARENT[b] ? bones[PARENT[b]!] : root).add(bones[b]);
  bones.jaw.visible = false;

  const cols = eyeColoursFor(id, look);
  const eyes: [Eye, Eye] = [new Eye(-1, cols, id.length * 7 + 3), new Eye(1, cols, id.length * 7 + 3)];
  // small, glossy, ink-dark eyes: a painted glint in the dot, the environment's own gleam on the wet surface
  const eyeMats = eyes.map((e) => new THREE.MeshStandardMaterial({
    map: e.tex, alphaTest: 0.5, transparent: false, roughness: 0.14, metalness: 0, envMapIntensity: 1.8,
    emissive: cols.glow ? 0xffffff : 0x000000, emissiveMap: cols.glow ? e.tex : null, emissiveIntensity: cols.glow ? 0.9 : 0,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }));
  // the eye decals: positioned now (from the rig sheet), their facets arrive with the GLB
  const eyeMeshes = (['eye_l', 'eye_r'] as const).map((nm, i) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), eyeMats[i]);
    m.name = nm;
    const e = r?.eyes[nm];
    const hp = r?.pivots.head ?? [0, 0, 0];
    if (e) m.position.set((e.at[0] - hp[0]) * MM_WORLD, (e.at[1] - hp[1]) * MM_WORLD, (e.at[2] - hp[2]) * MM_WORLD);
    m.castShadow = false;
    m.renderOrder = 1;
    bones.head.add(m);
    return m;
  });
  for (const e of eyes) e.draw({ lid: 0, low: 0, tilt: 0, lx: 0, ly: 0, pupil: 5, mode: 'normal', tear: false });

  const anchors: OwlModel['anchors'] = {};
  let disposed = false;
  let dressing: Dressing | null = null;
  const model: OwlModel = {
    id, rig: { root, bones, height: (r?.height ?? 44) * MM_WORLD, dispose: () => model.dispose() }, eyes, eyeMeshes, look,
    height: (r?.height ?? 44) * MM_WORLD, g, pivots: piv, rest,
    headUp: r ? (r.dims.headZ - (r.pivots.head?.[1] ?? r.dims.headZ)) * MM : 5,
    species, anchors, ready: Promise.resolve(), loaded: false, spread: [[], []],
    dispose() {
      disposed = true;
      dressing?.dispose();
      eyeMats.forEach((m) => m.dispose());
      eyes.forEach((e) => e.tex.dispose());
      root.removeFromParent();
    },
  };

  const mount = (gl: GLTFLike) => {
    if (disposed || model.loaded) return;
    const inst = cloneSkinned(gl.scene);
    inst.updateMatrixWorld(true);
    const joint = new Set(Object.values(GLB));
    for (const b of BONES) {
      const node = inst.getObjectByName(GLB[b]);
      if (!node) continue;
      for (const c of [...node.children]) {
        if (joint.has(c.name)) continue; // child joints are laid out by our own hierarchy
        if (c.name === 'eye_l' || c.name === 'eye_r') {
          const m = eyeMeshes[c.name === 'eye_l' ? 0 : 1];
          const src = c as THREE.Mesh;
          if (src.isMesh) { m.geometry.dispose(); m.geometry = src.geometry; m.scale.setScalar(MM_WORLD); } // (shared with the cached GLB: never disposed here)
          continue;
        }
        frames[b].add(c);
        if (c.name.startsWith('anchor_')) anchors[c.name as AnchorName] = c;
        // the wings open through their 'spread' morph target (the actor drives it)
        c.traverse((o) => {
          const mm = o as THREE.Mesh;
          if (mm.isMesh && mm.morphTargetInfluences?.length && (b === 'wingL' || b === 'wingR')) model.spread[b === 'wingL' ? 0 : 1].push(mm);
        });
      }
    }
    model.loaded = true;
    if (look.outfit && Object.keys(look.outfit).length) dressing = dressModel(model, look);
  };

  const dressed = () => (dressing as Dressing | null)?.ready ?? Promise.resolve();
  const have = loaded.get(id);
  if (have) { mount(have); model.ready = dressed(); }
  else model.ready = fetchOwl(id).then((gl) => { if (gl) mount(gl); return dressed(); });
  return model;
}

/** Feather colour for particle puffs: accepts a look or a species / legacy palette id. */
export function featherColour(look: OwlLook | string): number {
  if (typeof look === 'string') {
    const sp = resolveSpecies({ palette: look, species: undefined });
    return col(sp.plumage.wing);
  }
  if (look.feminine) return 0xf4f6f2;
  if (look.skin && SPECIAL_SKIN[look.skin] && look.skin !== 'meowl') return col(SPECIAL_SKIN[look.skin].feather);
  return col(resolveSpecies(look).plumage.wing);
}
