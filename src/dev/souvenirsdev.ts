// [globe] Dev contact sheet for the souvenirs: every souvenir GLB lit like the house, plus the small pixel
// portraits the globe's postcards use (window.__icons: id -> PNG data URL, written to
// public/models/souvenirs/<id>.png by the screenshot script). ?only=<id> shows one.
import * as THREE from 'three';
import { SOUVENIR_INFO, SOUVENIRS } from '../assets/souvenirs.ts';
import { instanceGLB } from '../gfx/glb.ts';

const q = new URLSearchParams(location.search);
const list = SOUVENIRS.filter((s) => !q.get('only') || s.id === q.get('only'));
const COLS = Number(q.get('cols') ?? 6), CELL = Number(q.get('cell') ?? 200), ICON = 64;
const rows = Math.ceil(list.length / COLS);

const grid = document.getElementById('grid') as HTMLCanvasElement;
grid.style.width = `${COLS * CELL}px`; grid.style.height = `${rows * (CELL + 18)}px`;
const big = new THREE.WebGLRenderer({ canvas: grid, antialias: true, preserveDrawingBuffer: true });
big.setPixelRatio(1);
big.setSize(COLS * CELL, rows * (CELL + 18), false);
big.outputColorSpace = THREE.SRGBColorSpace;
big.setScissorTest(true);
const small = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true });
small.setPixelRatio(1);
small.setSize(ICON, ICON, false);
small.outputColorSpace = THREE.SRGBColorSpace;
small.setClearColor(0x000000, 0);

function lights(scene: THREE.Scene) {
  scene.add(new THREE.HemisphereLight(0xf4eedd, 0x4a392b, 1.6));
  const key = new THREE.DirectionalLight(0xfff0d8, 2.6);
  key.position.set(-3, 5, 4);
  const rim = new THREE.DirectionalLight(0xaec8cc, 0.9);
  rim.position.set(4, 3, -4);
  scene.add(key, rim);
}

function frame(cam: THREE.PerspectiveCamera, obj: THREE.Object3D, wall: boolean) {
  const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
  const yaw = wall ? 0.18 : 0.62, pitch = wall ? 0.08 : 0.42;
  const d = r / Math.sin((cam.fov / 2) * Math.PI / 180) * 0.92;
  cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
  cam.lookAt(c);
  cam.near = d / 20; cam.far = d * 4;
  cam.updateProjectionMatrix();
}

/** Small portrait: hard pixels, a 1 px ink outline round the silhouette, clear background. */
function outline(src: HTMLCanvasElement): string {
  const c = document.createElement('canvas');
  c.width = c.height = ICON;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, ICON, ICON), d = img.data, a = new Uint8Array(ICON * ICON);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  for (let i = 0; i < a.length; i++) {
    if (!a[i]) { d[i * 4 + 3] = 0; continue; }
    d[i * 4 + 3] = 255;
  }
  for (let y = 0; y < ICON; y++) for (let x = 0; x < ICON; x++) {
    const i = y * ICON + x;
    if (a[i]) continue;
    const n = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < ICON && yy < ICON && a[yy * ICON + xx] === 1;
    if (n(x - 1, y) || n(x + 1, y) || n(x, y - 1) || n(x, y + 1)) { d[i * 4] = 46; d[i * 4 + 1] = 43; d[i * 4 + 2] = 36; d[i * 4 + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

const icons: Record<string, string> = {};
(window as unknown as { __icons: typeof icons }).__icons = icons;
const ctx2 = document.getElementById('labels') as HTMLDivElement;

async function run() {
  for (let i = 0; i < list.length; i++) {
    const s = list[i], info = SOUVENIR_INFO[s.id];
    let root: THREE.Object3D;
    try { root = (await instanceGLB(s.model!)).root; } catch { continue; }
    const scene = new THREE.Scene();
    lights(scene);
    scene.add(root);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.01, 100);
    frame(cam, root, !!info?.wall);
    // the big cell
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * (CELL + 18);
    const H = rows * (CELL + 18);
    big.setViewport(cx, H - cy - CELL, CELL, CELL);
    big.setScissor(cx, H - cy - CELL, CELL, CELL);
    big.setClearColor(0x27313f, 1);
    big.render(scene, cam);
    const lab = document.createElement('div');
    lab.textContent = `${s.id} · ${info?.place ?? ''}`;
    Object.assign(lab.style, { position: 'absolute', left: `${cx + 4}px`, top: `${cy + CELL}px` });
    ctx2.append(lab);
    // the pixel portrait
    small.clear();
    small.render(scene, cam);
    icons[s.id] = outline(small.domElement);
    const im = new Image();
    im.src = icons[s.id];
    Object.assign(im.style, { position: 'absolute', left: `${cx + CELL - 68}px`, top: `${cy + CELL - 68}px`, width: '64px', height: '64px', imageRendering: 'pixelated' });
    ctx2.append(im);
  }
  // one preview atlas of every portrait, in SOUVENIRS order (8 per row)
  if (!q.get('only')) {
    const A = document.createElement('canvas');
    A.width = 8 * ICON; A.height = Math.ceil(SOUVENIRS.length / 8) * ICON;
    const g = A.getContext('2d')!;
    const loads = SOUVENIRS.map((s, i) => new Promise<void>((res) => {
      if (!icons[s.id]) { res(); return; }
      const im = new Image();
      im.onload = () => { g.drawImage(im, (i % 8) * ICON, Math.floor(i / 8) * ICON); res(); };
      im.src = icons[s.id];
    }));
    await Promise.all(loads);
    (window as unknown as { __atlas: string }).__atlas = A.toDataURL('image/png');
  }
  (window as unknown as { __done: boolean }).__done = true;
}
void run();
