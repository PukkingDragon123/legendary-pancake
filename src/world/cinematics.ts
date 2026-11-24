// [world] Cinematic moments in the forest. Goodnight: the camera finds Pip on the porch, a satchel
// pops into being and little travel things hop into it, goggles go on, Pip waves at you, hops to
// the edge, crouches and bursts into the air in a flurry of feathers; the camera climbs with him
// past the canopy into a huge night sky (milky way, a big moon in today's real phase, a shooting
// star) and his silhouette crosses the moon. Good morning: a pink-gold sunrise, Pip flies in from
// the horizon with a bundle of presents, lands on the porch in a puff of dust, sets the bundle down
// in a burst of sparkles and does a happy dance. Both are skippable with a tap and return a cancel
// function. They drive the camera through scene.director and Pip through scene.owl.
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import { box, buildProp, propMesh, PX, type BoxSpec, type Painter } from '../gfx/box.ts';
import { ramp, tone } from '../gfx/color.ts';
import { cloth, lamp, lvl, metal, smooth, solid } from '../gfx/mats.ts';
import { loadGLB } from '../gfx/glb.ts';
import { SPR } from './fx.ts';
import type { CamShot, Scene } from './scene.ts';
import { HOUSE } from './layout.ts';

export interface CineOpts { onDone?: () => void }

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const smooth01 = (k: number) => { k = clamp01(k); return k * k * (3 - 2 * k); };
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Field of view for a shot framed for landscape, widened on tall screens the way the scene does. */
let fovK = 1;
function setAspect(aspect: number) {
  const base = Math.min(56, Math.max(30, (2 * Math.atan(Math.tan((15 * Math.PI) / 180) / Math.min(1, aspect)) * 180) / Math.PI));
  fovK = Math.tan((base * Math.PI) / 360) / Math.tan((15 * Math.PI) / 180);
}
const fovFor = (f: number) => (2 * Math.atan(Math.tan((f * Math.PI) / 360) * fovK) * 180) / Math.PI;

/** A camera shot from a position looking at a point. */
function look(from: THREE.Vector3, at: THREE.Vector3, fov?: number, snap = false): CamShot {
  const d = from.clone().sub(at), dist = Math.max(0.01, d.length());
  return { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y / dist, -0.985, 0.985)), dist, target: at.clone(), fov: fov === undefined ? undefined : fovFor(fov), snap };
}

/** Catmull-Rom through a list of points, k in 0..1. */
function path(pts: THREE.Vector3[], k: number): THREE.Vector3 {
  const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  return c.getPoint(clamp01(k));
}

// ---------------------------------------------------------------- props

const leather = (c: string): Painter => { const r = ramp(c); return (t) => tone(r, lvl(t, { noise: 0.45, scale: 1.6, rim: 0.8 }) + (t.u % 5 === 0 && t.face >= 4 ? -0.5 : 0)); };

function satchel(): BoxSpec[] {
  // [world3] calm palette: muted saddle leather, oat stitching, brass buckle
  const body = leather('#8c6448'), flap = leather('#6f553d');
  const stitch: Painter = (t) => (t.u % 2 === 0 && (t.v === 0 || t.v === t.h - 1) ? 0xeae0c8 : flap(t));
  return [
    box(0, 0, 0, 7, 5, 3, body),
    box(0, 2.6, 0.2, 7.4, 2.8, 3.6, stitch),
    box(0, 2.4, 1.95, 1.8, 1.8, 0.5, metal('#c8a764')),
    box(0, 2.9, 2.2, 0.8, 0.8, 0.3, solid('#4a392b', { noise: 0 })),
    box(-3.6, 0.5, 0, 0.5, 3.6, 2.4, flap), box(3.6, 0.5, 0, 0.5, 3.6, 2.4, flap),
  ];
}
function strap(): BoxSpec[] { return [box(0, 0, 0, 1.2, 16, 0.8, leather('#5b4a3c'))]; }
function goggles(): BoxSpec[] {
  const brass = metal('#c8a764');
  const glass: Painter = (t) => { const r = ramp('#86a9b0'); return tone(r, (t.u + t.v) % 4 === 0 ? 2 : t.face === 4 ? 0.4 : -0.6); };
  const band = cloth('#4a392b', { stripe: '#6f553d', stripeEvery: 2 });
  return [
    box(0, 0.4, -1, 17, 1.6, 1, band),
    box(-2.6, 0, 0, 4.2, 4.2, 1.2, brass), box(2.6, 0, 0, 4.2, 4.2, 1.2, brass),
    box(-2.6, 0.7, 0.4, 2.8, 2.8, 1, glass, { glow: true }), box(2.6, 0.7, 0.4, 2.8, 2.8, 1, glass, { glow: true }),
    box(0, 1.6, 0.2, 1.4, 0.8, 0.8, brass),
  ];
}
const ITEMS: (() => BoxSpec[])[] = [
  // a rolled map with a red ribbon
  () => [box(0, 0, 0, 5, 2, 2, solid('#eae0c8', { noise: 0.3 })), box(0, -0.1, 0, 1, 2.2, 2.2, solid('#a8505c', { noise: 0 }))],
  // an acorn
  () => [box(0, 0, 0, 3, 3, 3, smooth('#bf9d74')), box(0, 2.4, 0, 3.6, 1.4, 3.6, solid('#6f553d', { noise: 0.8, scale: 0.8 })), box(0, 3.6, 0, 0.8, 1, 0.8, solid('#4a392b'))],
  // a tiny lantern
  () => [box(0, 0, 0, 2.6, 0.6, 2.6, metal('#46596a')), box(0, 0.6, 0, 2, 2.4, 2, lamp('#f1d39a'), { glow: true }), box(0, 3, 0, 2.6, 0.6, 2.6, metal('#46596a')), box(0, 3.6, 0, 1, 0.8, 0.4, metal('#46596a'))],
  // a star-shaped cookie
  () => {
    const r = ramp('#dcb072');
    const p: Painter = (t) => { const dx = t.bx - 2, dz = t.bz - 2; const a = Math.atan2(dz, dx), d = Math.hypot(dx, dz); return d > 1.3 + 0.9 * Math.abs(Math.cos(a * 2.5)) ? -1 : tone(r, t.face === 2 ? (d < 0.8 ? 1.4 : 0.6) : -0.6); };
    return [box(0, 0, 0, 4, 1, 4, p, { cut: true })];
  },
];
function bundle(): BoxSpec[] {
  const c = cloth('#c0866a', { check: '#eae0c8', seed: 3 });
  return [
    box(0, 0, 0, 8, 6, 8, c), box(0, 1, 0, 9, 3, 9, c), box(0, 6, 0, 4, 2, 4, c),
    { ...box(-2, 7, 0, 3, 2.4, 1.2, c), rot: [0, 0, 35] }, { ...box(2, 7, 0, 3, 2.4, 1.2, c), rot: [0, 0, -35] },
    box(3.2, 3, 4.4, 2.4, 2.4, 0.4, metal('#c8a764')),
  ];
}

// [world3] The hand-made lowpix props (art/lowpix/world/props.py -> public/models/world/props_*.glb)
// load in the background; until they are in, the old voxel props stand in.
const KIT_PROPS = ['satchel', 'strap', 'goggles', 'bundle', 'item0', 'item1', 'item2', 'item3'];
const kitProps = new Map<string, THREE.Object3D>();
let kitLoading: Promise<unknown> | null = null;
/** Load Pip's travel things early (the sleep screen calls this; it is also kicked off on first use). */
export function preloadCinematics(): Promise<unknown> {
  kitLoading ??= Promise.allSettled(KIT_PROPS.map((id) => loadGLB(`world/props_${id}.glb`).then((g) => {
    g.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      // the lantern glass glows
      if (/glow/.test(m.name) || /glow/.test(m.parent?.name ?? '')) {
        const src = m.material as THREE.MeshStandardMaterial;
        m.material = new THREE.MeshBasicMaterial({ map: src.map, toneMapped: false });
      }
    });
    kitProps.set(id, g.scene);
  })));
  return kitLoading;
}

const propCache = new Map<string, ReturnType<typeof buildProp>>();
function mesh(key: string, boxes: () => BoxSpec[]): THREE.Object3D {
  void preloadCinematics();
  const kit = kitProps.get(key);
  if (kit) {
    // wrapped, so the cinematic can pop and squash the outer node freely
    const g = new THREE.Group(), inner = kit.clone(true);
    inner.scale.setScalar(PX);
    g.add(inner);
    return g;
  }
  let p = propCache.get(key);
  if (!p) { p = buildProp(boxes(), { wind: false }); propCache.set(key, p); }
  const m = propMesh(p);
  m.castShadow = true;
  return m;
}

/** Pip's measurements in his own space, whatever the model looks like. */
function measure(scene: Scene) {
  const n = scene.owl.node, pos = n.position.clone(), rot = n.rotation.clone(), sc = n.scale.clone();
  n.position.set(0, 0, 0); n.rotation.set(0, 0, 0); n.scale.set(1, 1, 1);
  n.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(scene.owl.model.rig.root);
  const B = scene.owl.model.rig.bones as Record<string, THREE.Object3D | undefined>;
  const head = B.head ? new THREE.Box3().setFromObject(B.head) : all.clone();
  n.position.copy(pos); n.rotation.copy(rot); n.scale.copy(sc);
  n.updateMatrixWorld(true);
  return { all, head, body: B.body ?? scene.owl.model.rig.root, headBone: B.head ?? scene.owl.model.rig.root };
}

/** Attach a mesh to a bone at a point given in Pip's own (node) space. */
function attach(scene: Scene, bone: THREE.Object3D, m: THREE.Object3D, at: THREE.Vector3) {
  const n = scene.owl.node, pos = n.position.clone(), rot = n.rotation.clone(), sc = n.scale.clone();
  n.position.set(0, 0, 0); n.rotation.set(0, 0, 0); n.scale.set(1, 1, 1);
  n.updateMatrixWorld(true);
  bone.updateMatrixWorld(true);
  m.position.copy(bone.worldToLocal(at.clone()));
  bone.add(m);
  n.position.copy(pos); n.rotation.copy(rot); n.scale.copy(sc);
  n.updateMatrixWorld(true);
}

/** Darken Pip into a silhouette against the moon (and back). */
function silhouette(scene: Scene, on: boolean) {
  scene.owl.node.traverse((o) => {
    const mm = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!mm) return;
    for (const m of Array.isArray(mm) ? mm : [mm]) {
      const mat = m as THREE.MeshLambertMaterial;
      if (!mat.color) continue;
      if (on) {
        if (mat.userData.silC === undefined) { mat.userData.silC = mat.color.getHex(); mat.userData.silE = mat.emissiveIntensity; }
        mat.color.setRGB(0.07, 0.08, 0.11);
        if (mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
      } else if (mat.userData.silC !== undefined) {
        mat.color.setHex(mat.userData.silC); if (mat.userData.silE !== undefined) mat.emissiveIntensity = mat.userData.silE;
        delete mat.userData.silC; delete mat.userData.silE;
      }
    }
  });
}

// ---------------------------------------------------------------- runner

interface Run { t: number; done: boolean }
type Ev = [number, () => void];

function runner(scene: Scene, dur: number, evs: Ev[], frame: (t: number, dt: number) => void, shot: (t: number) => CamShot, end: (how: 'done' | 'skip' | 'cancel') => void): () => void {
  const run: Run = { t: 0, done: false };
  evs.sort((a, b) => a[0] - b[0]);
  let ei = 0;
  const prevDirector = scene.director, prevHook = scene.interceptor, prevStill = scene.owl.still;
  const stop = (how: 'done' | 'skip' | 'cancel') => {
    if (run.done) return;
    run.done = true;
    scene.tickers.delete(tick);
    if (scene.director === director) scene.director = prevDirector === director ? null : prevDirector;
    if (scene.interceptor === hook) scene.interceptor = prevHook;
    scene.owl.still = prevStill;
    end(how);
  };
  const tick = (dt: number) => {
    if (run.done) return;
    run.t += dt;
    while (ei < evs.length && evs[ei][0] <= run.t) evs[ei++][1]();
    frame(run.t, dt);
    if (run.t >= dur) stop('done');
  };
  const director = () => shot(run.t);
  // a tap anywhere on the world skips to the end
  const hook = (type: string) => { if (type === 'down' && run.t > 0.4) stop('skip'); return true; };
  scene.tickers.add(tick);
  scene.director = director;
  scene.interceptor = hook;
  scene.owl.still = true;
  return () => stop('cancel');
}

/** Ease the sky's cinematic extras back to normal over a second or two. */
function relaxSky(scene: Scene) {
  const sky = scene.sky;
  let k = 0;
  const startBoost = sky.starBoost, mo = sky.moonOverride, startSize = mo?.size ?? 0.05;
  const f = (dt: number) => {
    k = Math.min(1, k + dt / 1.8);
    sky.starBoost = startBoost * (1 - k);
    // the cinematic moon fades away and the everyday one fades back in its usual place
    if (mo) {
      if (k < 0.5) { mo.size = startSize * (1 - k * 0.6); sky.moonFade = 1 - smooth01(k * 2); }
      else { sky.moonOverride = null; sky.moonFade = smooth01(k * 2 - 1); }
    }
    if (k >= 1) { sky.starBoost = 0; sky.moonOverride = null; sky.moonFade = 1; sky.sunDisc = null; scene.tickers.delete(f); }
  };
  scene.tickers.add(f);
}

// ---------------------------------------------------------------- goodnight

/** Goodnight: Pip packs the satchel, waves, and flies off across the night sky. */

/** Offsets relative to a spot on the house, turned to face out from the trunk (x right, y up, z outward). */
function facing(spot: THREE.Vector3) {
  const out = spot.clone().sub(new THREE.Vector3(HOUSE.x, spot.y, HOUSE.z)).setY(0);
  if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
  out.normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), out);
  return (x: number, y: number, z: number) => right.clone().multiplyScalar(x).add(new THREE.Vector3(0, y, 0)).addScaledVector(out, z);
}

export function playDeparture(scene: Scene, o: CineOpts = {}): () => void {
  const owl = scene.owl, fx = scene.fx, sky = scene.sky;
  scene.setView('sleep');
  scene.placeOwl('porch');
  owl.node.visible = true;
  owl.lookAt = null;
  owl.setMood('excited', 2.5);
  const H = scene.spot('porch');
  const spots = scene.house.spots as typeof scene.house.spots & { launch?: THREE.Vector3 };
  // take off from the porch step: the launch branch sits up in the canopy, where the camera can't follow
  void spots;
  const launch = H.clone().add(facing(H)(0, 0, 0.65));
  const L = launch;
  const rH = facing(H), rL = facing(L);
  setAspect(scene.camera.aspect);
  scene.applySky();
  // a big moon rising over the open meadow in front of the hollow for the sky shot [look4: the woods round the
  // clearing are dense now, so Pip climbs out over the clear side of the valley]
  const m = V(0.42, 0.5, 0.76).normalize();
  const side = new THREE.Vector3().crossVectors(m, V(0, 1, 0)).normalize(), upv = new THREE.Vector3().crossVectors(side, m).normalize();
  const C = L.clone().add(rL(-3.0, 2.8, 1.6));
  sky.moonOverride = { dir: m.clone(), size: 0.05 };
  sky.moonFade = 1;

  // props
  const M = measure(scene), A = M.all, hgt = A.max.y - A.min.y;
  const bag = mesh('satchel', satchel), band = mesh('strap', strap), gog = mesh('goggles', goggles);
  const hip = V(A.max.x * 0.82, A.min.y + hgt * 0.26, A.max.z * 0.15);
  attach(scene, M.body, bag, hip);
  bag.rotation.set(0, 0.25, -0.1);
  const shoulder = V(A.min.x * 0.55, A.min.y + hgt * 0.56, A.max.z * 0.72);
  const front = V(hip.x - 0.08, hip.y + 0.22, A.max.z * 0.72);
  attach(scene, M.body, band, front);
  const sdir = shoulder.clone().sub(front);
  band.quaternion.setFromUnitVectors(V(0, 1, 0), sdir.clone().normalize());
  band.scale.set(1, sdir.length() / (16 * PX), 1);
  const H2 = M.head, headW = H2.max.x - H2.min.x;
  attach(scene, M.headBone, gog, V(0, H2.min.y + (H2.max.y - H2.min.y) * 0.72, H2.max.z * 0.9));
  gog.scale.setScalar(Math.max(0.7, Math.min(1.4, headW / (17 * PX))));
  for (const p of [bag, band, gog]) p.visible = false;
  const pops: { m: THREE.Object3D; t: number; s: number }[] = [];
  const pop = (mm: THREE.Object3D, s = mm.scale.x) => { mm.visible = true; pops.push({ m: mm, t: 0, s }); };
  const items = ITEMS.map((f, i) => { const it = mesh('item' + i, f); it.visible = false; scene.scene.add(it); return it; });
  const itemFrom = items.map((_, i) => H.clone().add(rH((i - 1.5) * 0.42 + (i % 2 ? 0.1 : -0.1), 0.02, 0.55 + (i % 2) * 0.18)));
  items.forEach((it, i) => { it.position.copy(itemFrom[i]); it.rotation.y = i * 1.3; });
  const hops: { i: number; t: number }[] = [];
  const bagWorld = () => bag.getWorldPosition(new THREE.Vector3()).add(V(0, 0.1, 0));
  const headWorld = () => owl.headWorld;
  scene.weather.hold = null;

  let pipAt = H.clone(), crouch = 0, flyFrom: THREE.Vector3[] = [], trailT = 0, squash = 0;
  // the climb passes right over the low camera, so the shot looks up into open sky
  // a side-on view of the take-off from the left of the launch spot; Pip climbs out over the meadow
  // towards the moon and the camera rises after him, turning to the sky
  const cam0 = L.clone().add(rL(-1.5, 1.5, 3.6));
  const S0 = C.clone().addScaledVector(m, 9).addScaledVector(side, 4.2).addScaledVector(upv, -1.6);
  const climbPts = () => [L.clone(), L.clone().add(rL(0.3, 1.6, 0.9)), L.clone().add(rL(0.8, 4.0, 3.0)), S0.clone()];
  const skyAt = (u: number) => C.clone().addScaledVector(m, 9 + u * 22).addScaledVector(side, (4.2 - u * 9.5) * (1 - u * 0.35)).addScaledVector(upv, -1.6 + u * 2.2 + Math.sin(u * Math.PI) * 0.4);

  const evs: Ev[] = [
    [0.35, () => { owl.play('hop'); }],
    [1.25, () => { pop(bag); const b = bagWorld(); fx.burst('puffs', b.x, b.y, b.z, 7); fx.burst('sparkle', b.x, b.y, b.z, 8); sound.play('fabric', { volume: 0.5 }); sound.play('sparkle', { volume: 0.35 }); owl.setMood('happy', 2); }],
    [1.6, () => { pop(band, 1); band.scale.set(1, band.scale.y, 1); }],
    ...items.map((_, i): Ev => [1.95 + i * 0.6, () => { items[i].visible = true; hops.push({ i, t: 0 }); owl.lookAt = items[i].position.clone(); sound.play('pet_jump', { volume: 0.3, rate: 1.3 + i * 0.08 }); }]),
    [4.5, () => { owl.lookAt = null; pop(gog); const h = headWorld(); fx.burst('magic', h.x, h.y - 0.2, h.z, 12); sound.play('sparkle', { volume: 0.5 }); owl.setMood('proud', 1.6); owl.play('nod'); }],
    [5.3, () => { owl.lookAt = scene.camera.position.clone(); owl.setMood('joy', 2.2); }],
    [5.55, () => { owl.play('wave'); sound.play('owl_hoot', { volume: 0.55 }); const h = headWorld(); fx.burst('hearts', h.x, h.y + 0.1, h.z, 3); }],
    [6.5, () => { const h = headWorld(); fx.burst('puffs', h.x, h.y + 0.2, h.z, 4, 0xf4eedd); }],
    [7.0, () => { owl.lookAt = null; owl.play('hop'); }],
    [7.45, () => { owl.play('hop'); }],
    [8.45, () => {
      owl.pose = 'fly'; owl.setMood('excited', 4);
      const p = owl.node.position;
      fx.burst('feathers', p.x, p.y + 0.5, p.z, 14, 0xd9bf93); fx.burst('puffs', p.x, p.y + 0.05, p.z, 6, 0xeae0c8); fx.burst('dust', p.x, p.y, p.z, 8); fx.burst('stars', p.x, p.y + 0.6, p.z, 6);
      sound.play('wings_flutter', { volume: 0.8 }); sound.play('pet_jump', { volume: 0.5, rate: 0.8 });
      flyFrom = climbPts();
    }],
    [9.6, () => sound.play('wings_flutter', { volume: 0.5, rate: 0.9 })],
    [11.2, () => { silhouette(scene, true); scene.weather.hold = { kind: 'clear', intensity: 0.1, source: 'seasonal', temp: 10 }; scene.weather.snap(); }], // [world3] a clear sky for the moon shot, at once
    [11.9, () => sky.shootingStar(m.clone().addScaledVector(side, -0.42).addScaledVector(upv, 0.3), m.clone().addScaledVector(side, 0.25).addScaledVector(upv, 0.06), 1.1)],
    [12.6, () => sound.play('owl_hoot', { volume: 0.25, rate: 1.1 })],
    [12.8, () => sound.play('sparkle', { volume: 0.2 })],
  ];

  const frame = (t: number, dt: number) => {
    // popping props: overshoot spring
    for (const p of pops) {
      p.t += dt;
      const k = Math.min(1, p.t / 0.45), s = p.s * (k < 1 ? 1 + Math.sin(k * Math.PI * 1.5) * 0.35 * (1 - k) : 1) * smooth01(k * 2.2);
      if (p.m === band) p.m.scale.x = p.m.scale.z = s / p.s; else p.m.scale.setScalar(Math.max(0.001, s));
    }
    // travel things hop into the satchel
    for (const h of hops) {
      h.t += dt;
      const it = items[h.i], k = Math.min(1, h.t / 0.5), to = bagWorld();
      if (k < 1) {
        it.position.lerpVectors(itemFrom[h.i], to, smooth01(k));
        it.position.y += Math.sin(k * Math.PI) * 0.7;
        it.rotation.y += dt * 9; it.rotation.x += dt * 5;
        it.scale.setScalar(1 - Math.max(0, k - 0.7) * 2.6);
        if (Math.random() < 0.5) fx.emit({ x: it.position.x, y: it.position.y, z: it.position.z, life: 0.4, frame: SPR.spark1, frames: 3, fps: 9, color: 0xf1d39a, size: 0.18, add: true });
      } else if (it.visible) {
        it.visible = false; squash = 1;
        fx.burst('sparkle', to.x, to.y + 0.1, to.z, 6); fx.burst('stars', to.x, to.y, to.z, 3);
        sound.play('pickup_item', { volume: 0.45, rate: 1 + h.i * 0.1 });
        owl.play('peck');
      }
    }
    if (squash > 0) { squash = Math.max(0, squash - dt * 3); bag.scale.set(1 + squash * 0.25, 1 - squash * 0.3, 1 + squash * 0.25); }
    // hop to the launch spot, crouch, take off
    const n = owl.node;
    if (t >= 7 && t < 8.45) {
      const k = smooth01(span(t, 7, 7.9));
      pipAt = H.clone().lerp(launch, k);
      // a far launch spot (a balcony, the deck) is a little flutter away rather than a hop
      if (H.distanceTo(launch) > 1.5) { pipAt.y += Math.sin(k * Math.PI) * 1.2; owl.pose = k > 0 && k < 1 ? 'fly' : 'stand'; }
      n.position.copy(pipAt);
      // turn to face the way he'll fly
      const turn = smooth01(span(t, 7.8, 8.35));
      n.rotation.y = turn * Math.atan2(m.x, m.z) * 0.85;
      crouch = smooth01(span(t, 7.95, 8.4));
      n.scale.set(1 + crouch * 0.12, 1 - crouch * 0.2, 1 + crouch * 0.12);
    }
    if (t >= 8.45 && t < 11.2 && flyFrom.length) {
      const k = span(t, 8.45, 11.2), e = k < 0.15 ? k * k / 0.15 * 0.5 + 0 : k; // a burst off the porch, then steady
      const p = path(flyFrom, e * 0.98 + 0.02 * k), ahead = path(flyFrom, Math.min(1, e + 0.03));
      n.position.copy(p);
      const v = ahead.clone().sub(p);
      if (v.lengthSq() > 1e-6) n.rotation.y = Math.atan2(v.x, v.z);
      const st = Math.max(0, 1 - span(t, 8.45, 8.9));
      n.scale.set(1 - st * 0.1, 1 + st * 0.22, 1 - st * 0.1);
    }
    if (t >= 11.2) {
      const u = span(t, 11.2, 13.9), p = skyAt(smooth01(u) * 0.75 + u * 0.25);
      const v = skyAt(Math.min(1, u + 0.02)).sub(p);
      n.position.copy(p);
      if (v.lengthSq() > 1e-6) n.rotation.y = Math.atan2(v.x, v.z);
      n.scale.setScalar(1);
      n.visible = u < 1;
    }
    // a twinkling trail behind Pip in the air
    if (t > 8.5 && t < 13.8 && (trailT -= dt) <= 0) {
      trailT = 0.06;
      const p = n.position;
      fx.emit({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y + 0.5, z: p.z + (Math.random() - 0.5) * 0.3, vy: -0.2, life: 0.9, frame: Math.random() < 0.6 ? SPR.spark1 : SPR.diamond, frames: 1, color: [0xf1d39a, 0xb4a9c9, 0xbcd6dc][Math.floor(Math.random() * 3)], size: 0.11, add: true, fadeOut: 0.5 });
    }
    // the sky opens up as the camera climbs
    sky.starBoost = smooth01(span(t, 9.2, 11.4));
    if (sky.moonOverride) sky.moonOverride.size = 0.05 + 0.11 * smooth01(span(t, 9.4, 11.6));
  };

  const shot = (t: number): CamShot => {
    const fwd = (x: number, y: number, z: number) => H.clone().add(rH(x, y, z));
    if (t < 5.2) { const k = smooth01(span(t, 0, 5.2)); return look(fwd(-1.6 + k * 2.4, 2.1 - k * 0.2, 5.6 - k * 0.7), H.clone().add(rH(0, 0.7, 0)), 30); }
    if (t < 7.0) { const k = smooth01(span(t, 5.2, 7)); return look(fwd(0.6 - k * 0.3, 1.8, 4.3 - k * 0.4), H.clone().add(rH(0, 0.9, 0)), 28); }
    if (t < 8.45) { const k = smooth01(span(t, 7, 8.45)); return look(fwd(-0.8, 1.45, 4.8).lerp(cam0, k), launch.clone().add(V(0, 0.7, 0)), 32); }
    if (t < 11.2) {
      // stay low and tilt up as Pip shoots past overhead, then rise with him into the sky
      const k = span(t, 8.45, 11.2);
      const from = cam0.clone().lerp(C, smooth01(span(k, 0.45, 1)));
      const at = owl.node.position.clone().add(V(0, 0.5, 0)).lerp(C.clone().addScaledVector(m, 14), smooth01(span(k, 0.5, 0.95)));
      return look(from, at, 34 + smooth01(k) * 8);
    }
    const drift = Math.sin(t * 0.3) * 0.15;
    return look(C.clone().addScaledVector(side, drift), C.clone().addScaledVector(m, 14), 42);
  };

  return runner(scene, 14.3, evs, frame, shot, (how) => {
    silhouette(scene, false);
    for (const it of items) { scene.scene.remove(it); }
    for (const p of [bag, band, gog]) p.parent?.remove(p);
    owl.node.scale.setScalar(1);
    owl.lookAt = null;
    scene.placeOwl('away');
    scene.weather.hold = null;
    if (how === 'skip') { sky.starBoost = 0; sky.moonOverride = null; } else relaxSky(scene);
    if (how !== 'cancel') o.onDone?.();
  });
}

// ---------------------------------------------------------------- good morning

/** Good morning: Pip flies home at dawn with a bundle of presents and lands on the porch. */
export function playArrival(scene: Scene, o: CineOpts & { onLanded?: () => void } = {}): () => void {
  const owl = scene.owl, fx = scene.fx, sky = scene.sky;
  scene.setView('wake');
  scene.placeOwl('porch');
  const H = scene.spot('porch');
  const rH = facing(H);
  setAspect(scene.camera.aspect);
  const P = 1;
  owl.node.visible = true;
  owl.pose = 'fly';
  owl.lookAt = null;
  owl.setMood('happy', 9);
  scene.weather.hold = { kind: 'clear', intensity: 0.85, source: 'seasonal', temp: 10 };
  scene.weather.snap();
  const sunDir = V(0.52, 0.16, 0.86).normalize(); // [look4] low over the meadow the arrival looks across
  sky.sunDisc = { dir: sunDir, size: 0.05 };

  const M = measure(scene), A = M.all;
  const pack = mesh('bundle', bundle);
  attach(scene, M.body, pack, V(0, A.min.y - 0.22, A.max.z * 0.25));
  pack.scale.setScalar(0.9);
  let landed = false, dropped = false, dropT = 0, landT = 0, trailT = 0;
  const dropTo = H.clone().add(rH(0.42, 0.02, 0.5));
  let dropFrom = new THREE.Vector3();
  // [look4] Pip flies home over the pond and the open meadow in front of the oak (nothing between him and the camera)
  const dirA = V(0.45, 0, 0.9).normalize(), rightA = new THREE.Vector3().crossVectors(V(0, 1, 0), dirA);
  const fA = (x: number, y: number, z: number) => rightA.clone().multiplyScalar(x).add(V(0, y, 0)).addScaledVector(dirA, z);
  const pts = [H.clone().add(fA(5, 7.5, 44)), H.clone().add(fA(3.0, 5.0, 21)), H.clone().add(fA(-1.0, 2.8, 7.4)), H.clone().add(rH(0.3, 1.2, 1.7)), H.clone()];
  // (from the left of the path, so the fallen log stays out of the shot)
  const camFront = () => H.clone().add(rH(-1.7 * P, 2.0, 5.4 * P));

  const evs: Ev[] = [
    [0.2, () => sound.play('wings_flutter', { volume: 0.25 })],
    [1.8, () => sound.play('owl_hoot', { volume: 0.3 })],
    [3.3, () => sound.play('wings_flutter', { volume: 0.6 })],
    [4.9, () => {
      landed = true; owl.pose = 'stand'; owl.play('hop');
      const p = H;
      fx.burst('dust', p.x, p.y, p.z, 10); fx.burst('puffs', p.x, p.y + 0.15, p.z, 8, 0xeae0c8); fx.burst('feathers', p.x, p.y + 0.6, p.z, 5, 0xd9bf93);
      sound.play('pet_land', { volume: 0.6 });
      owl.lookAt = scene.camera.position.clone();
    }],
    [5.45, () => {
      dropped = true;
      dropFrom = pack.getWorldPosition(new THREE.Vector3());
      const q = pack.getWorldQuaternion(new THREE.Quaternion());
      pack.parent?.remove(pack);
      pack.position.copy(dropFrom); pack.quaternion.copy(q); pack.scale.setScalar(0.9);
      scene.scene.add(pack);
      owl.play('present');
    }],
    [6.25, () => { owl.play('dance'); owl.setMood('joy', 3); sound.play('pet_happy', { volume: 0.55 }); const h = owl.headWorld; fx.burst('hearts', h.x, h.y + 0.2, h.z, 4); }],
    [7.3, () => { const h = owl.headWorld; fx.burst('puffs', h.x, h.y + 0.3, h.z, 6, 0xf4eedd); fx.burst('notes', h.x, h.y + 0.2, h.z, 3); }],
  ];

  const frame = (t: number, dt: number) => {
    const n = owl.node;
    if (!landed) {
      const k = span(t, 0, 4.9), e = k * k * 0.35 + k * 0.65;
      const p = path(pts, e), ahead = path(pts, Math.min(1, e + 0.02));
      n.position.copy(p);
      const v = ahead.sub(p);
      if (v.lengthSq() > 1e-7) n.rotation.y = Math.atan2(v.x, v.z);
      n.rotation.z = Math.sin(t * 1.3) * 0.08;
      if ((trailT -= dt) <= 0) { trailT = 0.08; fx.emit({ x: p.x, y: p.y + 0.4, z: p.z, vy: -0.15, life: 0.8, frame: SPR.spark1, frames: 3, fps: 7, color: 0xf1d39a, size: 0.2, add: true }); }
    } else {
      landT += dt;
      n.position.copy(H);
      n.rotation.z = 0;
      const want = Math.atan2(scene.camera.position.x - H.x, scene.camera.position.z - H.z);
      n.rotation.y += (want - n.rotation.y) * Math.min(1, dt * 6);
    }
    if (dropped && dropT < 1) {
      dropT = Math.min(1, dropT + dt / 0.42);
      const k = dropT;
      pack.position.lerpVectors(dropFrom, dropTo, k);
      pack.position.y += Math.sin(k * Math.PI) * 0.35 + (k > 0.8 ? Math.sin((k - 0.8) / 0.2 * Math.PI) * 0.06 : 0);
      if (dropT >= 1) {
        pack.position.copy(dropTo);
        pack.rotation.set(0, -0.4, 0);
        fx.burst('sparkle', dropTo.x, dropTo.y + 0.3, dropTo.z, 16); fx.burst('magic', dropTo.x, dropTo.y + 0.1, dropTo.z, 12); fx.burst('stars', dropTo.x, dropTo.y + 0.4, dropTo.z, 8); fx.burst('dust', dropTo.x, dropTo.y, dropTo.z, 5);
        sound.play('place_item', { volume: 0.55 }); sound.play('sparkle', { volume: 0.55 });
        o.onLanded?.();
      }
    }
    sky.sunDisc = { dir: sunDir, size: 0.05 + 0.01 * Math.sin(t * 0.5) };
  };

  const shot = (t: number): CamShot => {
    if (t < 3.2) {
      // from beside the porch, looking out over the pond and the meadow at the sunrise
      const k = smooth01(span(t, 0, 3.2));
      return look(H.clone().add(fA(-2.2, 1.4 + k * 0.3, 1.0)), H.clone().add(fA(1.6 - k * 0.6, 6.4 - k * 1.6, 30)), 44, t < 0.1);
    }
    const k = smooth01(span(t, 3.2, 8.6));
    const from = camFront().lerp(H.clone().add(rH(-0.9 * P, 1.7, 4.0 * P)), k);
    const at = H.clone().add(rH(0, 0.85, 0)).lerp(owl.node.position.clone().add(V(0, 0.8, 0)), landed ? 0 : 0.35);
    return look(from, at, 36, t < 3.25);
  };

  return runner(scene, 8.7, evs, frame, shot, (how) => {
    if (!landed || !dropped || dropT < 1) {
      // skipped: put everything where it ends up
      pack.parent?.remove(pack);
      if (!dropped || dropT < 1) o.onLanded?.();
    }
    owl.node.rotation.set(0, 0, 0);
    owl.lookAt = null;
    scene.placeOwl('porch');
    owl.setMood('happy', 2);
    scene.weather.hold = null;
    relaxSky(scene);
    // the bundle lingers a moment, then pops away in a puff
    if (pack.parent === scene.scene) {
      let k = 0;
      const f = (dt: number) => { k += dt; if (k > 1.4) { fx.burst('puffs', pack.position.x, pack.position.y + 0.2, pack.position.z, 8); scene.scene.remove(pack); scene.tickers.delete(f); } };
      scene.tickers.add(f);
    }
    if (how !== 'cancel') o.onDone?.();
  });
}
