// Thumbnails are small renders of the real 3D models (the toy owls, an owl wearing a piece, species, skins, and the
// furniture: its hand-made GLB when the item has one, else its built model), made with one offscreen renderer and
// cached as data URLs. The owls are hand-painted Blender toys loaded from GLBs, so a portrait can only be shot once
// its model is in: the synchronous exports answer at once when it is (and otherwise return '' and shoot it as soon
// as it arrives, bumping `iconVersion` so components that read it re-render); the async helpers (`owlIconAsync`,
// `useOwlIcon`, `usePieceIcon`) wait for the model, render one per frame from a queue and never stall a tap.
// No 2D drawing of the owl anywhere: every owl picture is a render of its 3D toy.
import * as THREE from 'three';
import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { buildProp, propMesh } from '../gfx/box.ts';
import { instanceGLB, loadGLB, modelUrl } from '../gfx/glb.ts';
import { buildOwl, modelIdOf, owlReady, type OwlLook, type OwlModel } from '../owl/model.ts';
import { OWL_RIGS } from '../owl/rig.gen.ts';
import { piecesLoaded, piecesReady } from '../owl/outfits.ts';
import { ITEMS } from '../world/scene.ts';

const S = 192;
let R: THREE.WebGLRenderer | null = null, scene: THREE.Scene, cam: THREE.OrthographicCamera;
const cache = new Map<string, string>();
/** Bumped whenever a portrait that was asked for synchronously (and was not ready) has been rendered. */
export const iconVersion = signal(0);

function setup() {
  const c = document.createElement('canvas');
  R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setSize(S, S, false);
  R.setClearColor(0x000000, 0);
  R.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  // the hollow's lamplight: warm key, soft sky fill, a cool moonlit rim
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a6458, 1.5));
  const d = new THREE.DirectionalLight(0xfff0d8, 2.0);
  d.position.set(-3, 6, 7);
  const rim = new THREE.DirectionalLight(0xc4d4dc, 0.8);
  rim.position.set(5, 3, -5);
  scene.add(d, rim);
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
}

function shoot(obj: THREE.Object3D, yaw: number, pitch: number, crop?: THREE.Box3, pad = 1.08): string {
  if (!R) setup();
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const b = crop ?? new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  cam.position.copy(c).addScaledVector(dir, 60);
  cam.lookAt(c);
  cam.updateMatrixWorld();
  const pb = new THREE.Box3();
  for (let i = 0; i < 8; i++) pb.expandByPoint(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(cam.matrixWorldInverse));
  const half = (Math.max(pb.max.x - pb.min.x, pb.max.y - pb.min.y) / 2) * pad + 0.02, mx = (pb.max.x + pb.min.x) / 2, my = (pb.max.y + pb.min.y) / 2;
  cam.left = mx - half; cam.right = mx + half; cam.top = my + half; cam.bottom = my - half;
  cam.updateProjectionMatrix();
  R!.render(scene, cam);
  scene.remove(obj);
  return R!.domElement.toDataURL('image/png');
}

const memo = (key: string, make: () => string): string => {
  let u = cache.get(key);
  if (u === undefined) { try { u = make(); } catch (e) { console.warn('icon failed', key, e); u = ''; } cache.set(key, u); }
  return u;
};

/**
 * Answer now if `isReady()`; otherwise return '' and render as soon as `wait()` resolves (then bump iconVersion).
 * Reading iconVersion here subscribes a rendering Preact component, so it re-renders when the picture lands.
 */
const later = new Set<string>();
function syncOrLater(key: string, isReady: () => boolean, wait: () => Promise<unknown>, make: () => string): string {
  void iconVersion.value;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (isReady()) return memo(key, make);
  if (!later.has(key)) {
    later.add(key);
    void wait().then(() => enqueue(key, make)).then(() => { later.delete(key); iconVersion.value++; });
  }
  return '';
}

// ------------------------------------------------------------------ furniture
function itemShot(id: string): string {
  const def = ITEMS[id];
  if (!def) return '';
  const p = buildProp(def.build());
  const url = shoot(propMesh(p), 0.62, 0.5);
  p.geo.dispose(); p.tex.dispose();
  return url;
}
const itemModelShots = new Map<string, Promise<string>>();
/** A furniture item's icon: its hand-made GLB when it has one (rendered once it has loaded), else its built model. */
export const itemIcon = (id: string): string => {
  const def = ITEMS[id];
  if (!def) return '';
  if (!def.model) return memo('i:' + id, () => itemShot(id));
  void iconVersion.value;
  const key = 'i:' + id;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!itemModelShots.has(id)) {
    const path = def.model;
    itemModelShots.set(id, instanceGLB(path).then(({ root }) => {
      const url = shoot(root, 0.62, 0.5);
      cache.set(key, url);
      iconVersion.value++;
      return url;
    }, () => { const url = itemShot(id); cache.set(key, url); iconVersion.value++; return url; }));
  }
  return '';
};
/** Resolves with an item's icon (waits for its GLB). */
export function itemIconAsync(id: string): Promise<string> {
  const now = itemIcon(id);
  if (now) return Promise.resolve(now);
  return itemModelShots.get(id) ?? Promise.resolve('');
}
/** Warm the GLB of an item so its icon is instant later. */
export const preloadItemModel = (id: string) => { const m = ITEMS[id]?.model; if (m) void loadGLB(m).catch(() => undefined); };

// ------------------------------------------------------------------ owls
export type OwlShot = 'face' | 'full' | 'bust';
const lookKey = (l: OwlLook) => JSON.stringify([l.skin ?? 'owl', l.species ?? '', l.palette, l.outfit, l.feminine ? 1 : 0, l.held ?? '']);

function frame(o: OwlModel, part: OwlShot): string {
  // eyes open and bright, a hint of a smile
  o.eyes.forEach((e) => e.draw({ lid: 0, low: 0.0, tilt: 0, lx: 0, ly: 0, pupil: 5.4, mode: 'normal', tear: false, nict: 0 }));
  const root = o.rig.root;
  o.rig.bones.jaw.visible = false;
  root.updateMatrixWorld(true);
  const full = new THREE.Box3().setFromObject(root), px = 1 / 16, g = o.g;
  let crop: THREE.Box3 | undefined;
  if (part === 'face') {
    const top = Math.min(full.max.y + 0.02, (Math.max(g.headTop, g.tuftTop) + 0.6) * px);
    crop = new THREE.Box3(new THREE.Vector3((-g.headW / 2 - 0.6) * px, (g.headY - 0.4) * px, -0.4), new THREE.Vector3((g.headW / 2 + 0.6) * px, top, 0.6));
  } else if (part === 'bust') {
    crop = new THREE.Box3(new THREE.Vector3(full.min.x, (g.bodyY + g.bodyH * 0.3) * px, full.min.z), full.max.clone());
  }
  return shoot(root, part === 'face' ? 0.3 : 0.42, part === 'face' ? 0.1 : 0.16, crop, part === 'face' ? 1.04 : 1.06);
}

/** Shoot an owl now (only when its model is already in; '' otherwise). */
function owlShotNow(look: OwlLook, part: OwlShot): string {
  const o = buildOwl(look);
  try { return o.loaded ? frame(o, part) : ''; } finally { o.dispose(); }
}
/** Wait for an owl's model (and outfit pieces), then shoot it. */
async function owlShotWhenReady(look: OwlLook, part: OwlShot): Promise<string> {
  await Promise.all([owlReady(look), piecesReady(look)]);
  const o = buildOwl(look);
  try { await o.ready; return o.loaded ? frame(o, part) : ''; } finally { o.dispose(); }
}
const owlIsIn = (look: OwlLook) => { const o = buildOwl({ ...look, outfit: {} }); const ok = o.loaded; o.dispose(); return ok; };

/** The shipped still of a look's model (no outfit), for the moments before its GLB is in. */
function still(look: OwlLook, part: OwlShot): string {
  const id = modelIdOf(look), shot = part === 'face' ? 'face' : 'full';
  return OWL_RIGS[id]?.shots?.includes(shot) ? modelUrl(`owls/${id}.${shot}.webp`) : '';
}
const owlSync = (key: string, look: OwlLook, part: OwlShot) =>
  syncOrLater(key, () => owlIsIn(look) && piecesLoaded(look), () => Promise.all([owlReady(look), piecesReady(look)]), () => owlShotNow(look, part)) || still(look, part);
/** Shoot a look (waits for its model and outfit): the dev stills page and anyone who wants a fresh render. */
export const shootOwl = (look: OwlLook, part: OwlShot = 'face') => owlShotWhenReady(look, part);

export const portrait = (look: OwlLook) => owlSync('p:' + lookKey(look), look, 'face');
export const owlFull = (look: OwlLook) => owlSync('f:' + lookKey(look), look, 'full');
const pieceLook = (id: string, slot: string, look: OwlLook): OwlLook => ({ skin: look.skin, species: look.species, palette: look.palette, feminine: look.feminine, outfit: { [slot]: id } });
const pieceShot = (slot: string): OwlShot => (slot === 'head' || slot === 'face' ? 'face' : 'bust');
export const pieceIcon = (id: string, slot: string, look: OwlLook) => owlSync('o:' + id + lookKey(look), pieceLook(id, slot, look), pieceShot(slot));
export const coatIcon = (palette: string, skin: OwlLook['skin']) => owlSync('c:' + skin + palette, { skin, palette, species: palette, outfit: {} }, 'face');

// ------------------------------------------------------------------ async queue
type Job = { key: string; make: () => string | Promise<string>; done: ((url: string) => void)[] };
const queue: Job[] = [];
const pending = new Map<string, Job>();
let pumping = false;
function pump() {
  if (pumping) return;
  pumping = true;
  const step = async () => {
    const job = queue.shift();
    if (!job) { pumping = false; return; }
    pending.delete(job.key);
    let url = cache.get(job.key);
    if (url === undefined) {
      try { url = await job.make(); } catch (e) { console.warn('icon failed', job.key, e); url = ''; }
      if (url) cache.set(job.key, url);
    }
    job.done.forEach((f) => f(url!));
    // one owl per frame keeps taps and scrolling smooth while a shelf of portraits fills in
    requestAnimationFrame(() => void step());
  };
  requestAnimationFrame(() => void step());
}
function enqueue(key: string, make: () => string | Promise<string>, front = false): Promise<string> {
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((res) => {
    let job = pending.get(key);
    if (!job) { job = { key, make, done: [] }; pending.set(key, job); if (front) queue.unshift(job); else queue.push(job); }
    job.done.push(res);
    pump();
  });
}

/** Render an owl portrait without blocking: resolves once its model is in and it has been shot (instantly when cached). */
export function owlIconAsync(look: OwlLook, part: OwlShot = 'face', front = false): Promise<string> {
  const key = (part === 'face' ? 'p:' : part === 'full' ? 'f:' : 'b:') + lookKey(look);
  return enqueue(key, () => owlShotWhenReady(look, part), front);
}
export function pieceIconAsync(id: string, slot: string, look: OwlLook): Promise<string> {
  return enqueue('o:' + id + lookKey(look), () => owlShotWhenReady(pieceLook(id, slot, look), pieceShot(slot)));
}
/** Cached URL if this portrait is ready. */
export const owlIconCached = (look: OwlLook, part: OwlShot = 'face') => cache.get((part === 'face' ? 'p:' : part === 'full' ? 'f:' : 'b:') + lookKey(look));

/** Preact hook: the portrait URL once rendered ('' until then). */
export function useOwlIcon(look: OwlLook, part: OwlShot = 'face'): string {
  const key = (part === 'face' ? 'p:' : part === 'full' ? 'f:' : 'b:') + lookKey(look);
  const [url, setUrl] = useState(() => cache.get(key) ?? '');
  useEffect(() => {
    let live = true;
    const hit = cache.get(key);
    if (hit) { setUrl(hit); return; }
    setUrl('');
    void owlIconAsync(look, part).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [key]);
  return url;
}
/** Preact hook: an owl wearing one outfit piece. */
export function usePieceIcon(id: string, slot: string, look: OwlLook): string {
  const key = 'o:' + id + lookKey(look);
  const [url, setUrl] = useState(() => cache.get(key) ?? '');
  useEffect(() => {
    let live = true;
    const hit = cache.get(key);
    if (hit) { setUrl(hit); return; }
    setUrl('');
    void pieceIconAsync(id, slot, look).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [key]);
  return url;
}
