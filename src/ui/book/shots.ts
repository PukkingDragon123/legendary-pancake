// Pictures for the book: polaroid renders of owls by species and skin, pencil-sketch silhouettes of
// things not found yet, and a tiny queue so 3D thumbnails render one per frame instead of stalling a
// page turn.
import { useEffect, useState } from 'preact/hooks';
import * as THREE from 'three';
import { buildOwl, G, type OwlLook } from '../../owl/model.ts';

// ------------------------------------------------------------------ one-at-a-time render queue
const jobs: (() => void)[] = [];
let running = false;
function pump() {
  if (running) return;
  running = true;
  const step = () => {
    const t0 = performance.now();
    while (jobs.length && performance.now() - t0 < 12) { try { jobs.shift()!(); } catch (e) { console.warn('book thumb', e); } }
    if (jobs.length) setTimeout(step, 16); else running = false;
  };
  setTimeout(step, 0);
}
const done = new Map<string, string>();
/** A data URL made by `make()` later (one job per frame), cached by key. '' until ready. */
export function useLazy(key: string, make: () => string | Promise<string>): string {
  const [url, setUrl] = useState(() => done.get(key) ?? '');
  useEffect(() => {
    const have = done.get(key);
    if (have !== undefined) { setUrl(have); return; }
    let live = true;
    jobs.push(() => {
      const r = make();
      const fin = (u: string) => { done.set(key, u); if (live) setUrl(u); };
      if (typeof r === 'string') fin(r); else void r.then(fin, () => fin(''));
    });
    pump();
    return () => { live = false; };
  }, [key]);
  return url;
}

// ------------------------------------------------------------------ owl portraits keyed by species/skin
const S = 160;
let R: THREE.WebGLRenderer | null = null, scene: THREE.Scene, cam: THREE.OrthographicCamera;
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
/** A head-and-shoulders render of an owl with this look (no outfit), cached by species + skin + coat. */
export function owlFace(look: OwlLook): string {
  if (!R) setup();
  const o = buildOwl({ ...look, outfit: {} });
  try {
    o.eyes.forEach((e) => e.draw({ lid: 0, low: 0.18, tilt: 0, lx: 0, ly: 0, pupil: 5.4, mode: 'normal', tear: false }));
    o.rig.bones.jaw.visible = false;
    const root = o.rig.root;
    scene.add(root);
    root.updateMatrixWorld(true);
    const full = new THREE.Box3().setFromObject(root), px = 1 / 16;
    const crop = new THREE.Box3(new THREE.Vector3((-G.headW / 2) * px - 0.04, (G.headY - 2.4) * px, -0.4), new THREE.Vector3((G.headW / 2) * px + 0.04, Math.min(full.max.y + 0.02, (G.headTop + 3.2) * px), 0.6));
    const c = crop.getCenter(new THREE.Vector3()), yaw = 0.3, pitch = 0.1;
    cam.position.copy(c).add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(60));
    cam.lookAt(c);
    cam.updateMatrixWorld();
    const pb = new THREE.Box3();
    for (let i = 0; i < 8; i++) pb.expandByPoint(new THREE.Vector3(i & 1 ? crop.max.x : crop.min.x, i & 2 ? crop.max.y : crop.min.y, i & 4 ? crop.max.z : crop.min.z).applyMatrix4(cam.matrixWorldInverse));
    const half = (Math.max(pb.max.x - pb.min.x, pb.max.y - pb.min.y) / 2) * 1.04, mx = (pb.max.x + pb.min.x) / 2, my = (pb.max.y + pb.min.y) / 2;
    cam.left = mx - half; cam.right = mx + half; cam.top = my + half; cam.bottom = my - half;
    cam.updateProjectionMatrix();
    R!.render(scene, cam);
    scene.remove(root);
    return R!.domElement.toDataURL('image/png');
  } finally { o.dispose(); }
}

// ------------------------------------------------------------------ pencil sketches
const sketches = new Map<string, Promise<string>>();
/**
 * Turn a thumbnail into a pencil sketch of its silhouette (outline + light hatching) at `n` texels,
 * for the album's empty slots.
 */
export function sketch(src: string, n = 48): Promise<string> {
  if (!src) return Promise.resolve('');
  const key = n + ':' + src.length + ':' + src.slice(-48);
  let pr = sketches.get(key);
  if (pr) return pr;
  pr = new Promise<string>((res) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = n; c.height = n;
      const x = c.getContext('2d')!;
      x.drawImage(img, 0, 0, n, n);
      const d = x.getImageData(0, 0, n, n), a = new Uint8Array(n * n);
      for (let i = 0; i < n * n; i++) a[i] = d.data[i * 4 + 3] > 90 ? 1 : 0;
      const out = x.createImageData(n, n), put = (i: number, r: number, g: number, b: number, al: number) => { out.data[i * 4] = r; out.data[i * 4 + 1] = g; out.data[i * 4 + 2] = b; out.data[i * 4 + 3] = al; };
      const at = (X: number, Y: number) => (X < 0 || Y < 0 || X >= n || Y >= n ? 0 : a[Y * n + X]);
      for (let y = 0; y < n; y++) for (let X = 0; X < n; X++) {
        const i = y * n + X;
        if (!a[i]) continue;
        const edge = !at(X + 1, y) || !at(X - 1, y) || !at(X, y + 1) || !at(X, y - 1);
        const h = (Math.imul(X, 374761393) + Math.imul(y, 668265263)) >>> 0;
        if (edge) { if (h % 9) put(i, 70, 66, 78, 210); }
        else if ((X + y) % 4 === 0 && h % 5) put(i, 87, 84, 94, 90);
      }
      x.putImageData(out, 0, 0);
      res(c.toDataURL());
    };
    img.onerror = () => res('');
    img.src = src;
  });
  sketches.set(key, pr);
  return pr;
}
