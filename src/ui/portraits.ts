// Thumbnails are small renders of the real 3D models (furniture, Pip wearing an outfit, coats),
// made once with an offscreen renderer and cached as data URLs.
import * as THREE from 'three';
import { buildProp, propMesh } from '../gfx/box.ts';
import { buildOwl, G, type OwlLook } from '../owl/model.ts';
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
  scene.add(d);
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

const lookKey = (l: OwlLook) => (l.skin ?? 'owl') + '|' + l.palette + '|' + JSON.stringify(l.outfit);

function owlShot(look: OwlLook, part: 'face' | 'full'): string {
  const o = buildOwl(look);
  // pose the eyes open and happy for portraits
  o.eyes.forEach((e) => e.draw({ lid: 0, low: 0.18, tilt: 0, lx: 0, ly: 0, pupil: 5.4, mode: 'normal', tear: false }));
  const root = o.rig.root;
  o.rig.bones.jaw.visible = false;
  root.updateMatrixWorld(true);
  const full = new THREE.Box3().setFromObject(root), px = 1 / 16;
  const crop = part === 'face' ? new THREE.Box3(new THREE.Vector3(-G.headW / 2 * px - 0.04, (G.headY - 0.6) * px, -0.4), new THREE.Vector3(G.headW / 2 * px + 0.04, Math.min(full.max.y + 0.02, (G.headTop + 3.2) * px), 0.6)) : undefined;
  const url = shoot(root, part === 'face' ? 0.28 : 0.42, part === 'face' ? 0.1 : 0.18, crop, part === 'face' ? 1.02 : 1.08);
  o.dispose();
  return url;
}

export const portrait = (look: OwlLook) => memo('p:' + lookKey(look), () => owlShot(look, 'face'));
export const owlFull = (look: OwlLook) => memo('f:' + lookKey(look), () => owlShot(look, 'full'));
export const pieceIcon = (id: string, slot: string, look: OwlLook) => memo('o:' + id + lookKey(look), () => owlShot({ skin: look.skin, palette: look.palette, outfit: { [slot]: id } }, slot === 'head' || slot === 'face' ? 'face' : 'full'));
export const coatIcon = (palette: string, skin: OwlLook['skin']) => memo('c:' + skin + palette, () => owlShot({ skin, palette, outfit: {} }, 'face'));
