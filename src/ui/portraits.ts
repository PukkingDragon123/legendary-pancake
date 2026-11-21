// Thumbnails are small renders of the real 3D models (furniture, Pip wearing an outfit, species,
// skins), made with one offscreen renderer and cached as data URLs. Owls are heavy to build, so the
// async helpers (`owlIconAsync`, `useOwlIcon`) render one per frame from a queue and never stall
// a tap; the old synchronous exports stay for callers that need an answer right away.
import * as THREE from 'three';
import { useEffect, useState } from 'preact/hooks';
import { buildProp, propMesh } from '../gfx/box.ts';
import { buildOwl, type OwlLook } from '../owl/model.ts';
import { ITEMS } from '../world/scene.ts';

const S = 192;
let R: THREE.WebGLRenderer | null = null, scene: THREE.Scene, cam: THREE.OrthographicCamera;
const cache = new Map<string, string>();

function setup() {
  const c = document.createElement('canvas');
  R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  R.setSize(S, S, false);
  R.setClearColor(0x000000, 0);
  R.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a7a90, 1.6));
  const d = new THREE.DirectionalLight(0xfff0d8, 1.9);
  d.position.set(-3, 6, 7);
  const rim = new THREE.DirectionalLight(0xb8c8ff, 0.7);
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
  if (!u) { try { u = make(); } catch (e) { console.warn('icon failed', key, e); u = ''; } cache.set(key, u); }
  return u;
};

export const itemIcon = (id: string) => memo('i:' + id, () => {
  const def = ITEMS[id];
  if (!def) return '';
  const p = buildProp(def.build());
  const url = shoot(propMesh(p), 0.62, 0.5);
  p.geo.dispose(); p.tex.dispose();
  return url;
});

export type OwlShot = 'face' | 'full' | 'bust';
const lookKey = (l: OwlLook) => JSON.stringify([l.skin ?? 'owl', l.species ?? '', l.palette, l.outfit, l.feminine ? 1 : 0, l.held ?? '']);

function owlShot(look: OwlLook, part: OwlShot): string {
  const o = buildOwl(look);
  // pose the eyes open and bright for portraits
  o.eyes.forEach((e) => e.draw({ lid: 0, low: 0.12, tilt: 0, lx: 0, ly: 0, pupil: 5.6, mode: 'normal', tear: false, nict: 0 }));
  const root = o.rig.root;
  o.rig.bones.jaw.visible = false;
  root.updateMatrixWorld(true);
  const full = new THREE.Box3().setFromObject(root), px = 1 / 16, g = o.g;
  let crop: THREE.Box3 | undefined;
  if (part === 'face') {
    const top = Math.min(full.max.y + 0.02, (Math.max(g.headTop, g.tuftTop) + 1) * px);
    crop = new THREE.Box3(new THREE.Vector3((-g.headW / 2 - 0.8) * px, (g.headY - 0.8) * px, -0.4), new THREE.Vector3((g.headW / 2 + 0.8) * px, top, 0.6));
  } else if (part === 'bust') {
    crop = new THREE.Box3(new THREE.Vector3(full.min.x, (g.bodyY + g.bodyH * 0.35) * px, full.min.z), full.max.clone());
  }
  const url = shoot(root, part === 'face' ? 0.3 : 0.42, part === 'face' ? 0.08 : 0.16, crop, part === 'face' ? 1.04 : 1.06);
  o.dispose();
  return url;
}

export const portrait = (look: OwlLook) => memo('p:' + lookKey(look), () => owlShot(look, 'face'));
export const owlFull = (look: OwlLook) => memo('f:' + lookKey(look), () => owlShot(look, 'full'));
const pieceLook = (id: string, slot: string, look: OwlLook): OwlLook => ({ skin: look.skin, species: look.species, palette: look.palette, outfit: { [slot]: id } });
const pieceShot = (slot: string): OwlShot => (slot === 'head' || slot === 'face' ? 'face' : 'bust');
export const pieceIcon = (id: string, slot: string, look: OwlLook) => memo('o:' + id + lookKey(look), () => owlShot(pieceLook(id, slot, look), pieceShot(slot)));
export const coatIcon = (palette: string, skin: OwlLook['skin']) => memo('c:' + skin + palette, () => owlShot({ skin, palette, species: palette, outfit: {} }, 'face'));

// ------------------------------------------------------------------ async queue

type Job = { key: string; make: () => string; done: ((url: string) => void)[] };
const queue: Job[] = [];
const pending = new Map<string, Job>();
let pumping = false;
function pump() {
  if (pumping) return;
  pumping = true;
  const step = () => {
    const job = queue.shift();
    if (!job) { pumping = false; return; }
    pending.delete(job.key);
    const url = memo(job.key, job.make);
    job.done.forEach((f) => f(url));
    // one owl per frame keeps taps and scrolling smooth while a shelf of portraits fills in
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function enqueue(key: string, make: () => string, front = false): Promise<string> {
  const hit = cache.get(key);
  if (hit !== undefined) return Promise.resolve(hit);
  return new Promise((res) => {
    let job = pending.get(key);
    if (!job) { job = { key, make, done: [] }; pending.set(key, job); if (front) queue.unshift(job); else queue.push(job); }
    job.done.push(res);
    pump();
  });
}

/** Render an owl portrait without blocking: resolves on a later frame (instantly when cached). */
export function owlIconAsync(look: OwlLook, part: OwlShot = 'face', front = false): Promise<string> {
  return enqueue(part[0] + 'a:' + lookKey(look), () => owlShot(look, part), front);
}
export function pieceIconAsync(id: string, slot: string, look: OwlLook): Promise<string> {
  return enqueue('o:' + id + lookKey(look), () => owlShot(pieceLook(id, slot, look), pieceShot(slot)));
}
/** Cached URL if this portrait is ready. */
export const owlIconCached = (look: OwlLook, part: OwlShot = 'face') => cache.get(part[0] + 'a:' + lookKey(look));

/** Preact hook: the portrait URL once rendered ('' until then). */
export function useOwlIcon(look: OwlLook, part: OwlShot = 'face'): string {
  const key = part[0] + 'a:' + lookKey(look);
  const [url, setUrl] = useState(() => cache.get(key) ?? '');
  useEffect(() => {
    let live = true;
    const hit = cache.get(key);
    if (hit !== undefined) { setUrl(hit); return; }
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
    if (hit !== undefined) { setUrl(hit); return; }
    setUrl('');
    void pieceIconAsync(id, slot, look).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [key]);
  return url;
}
