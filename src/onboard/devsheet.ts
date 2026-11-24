// Dev contact sheet for the interview's models (dev-office.html): every model under public/models/interview/
// in a grid, lit like the office (warm lamp + cool fill), slowly turning. ?ids=a,b,c picks models,
// ?dir=interview/_cand picks a folder, ?cols=6 the grid.
import * as THREE from 'three';
import { loadGLB } from '../gfx/glb.ts';
import { PROP_MODELS, ROOM_MODELS } from './props.ts';

const q = new URLSearchParams(location.search);
const dir = q.get('dir') ?? 'interview';
const ids = (q.get('ids')?.split(',') ?? [...ROOM_MODELS, ...PROP_MODELS].filter((x) => x !== 'room')).filter(Boolean);
const cols = Number(q.get('cols') ?? 6);
const cv = document.getElementById('c') as HTMLCanvasElement;
const R = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
R.setPixelRatio(1);
R.setSize(innerWidth, innerHeight);
R.setScissorTest(true);
R.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xf4ead8, 0x4a392b, 1.1));
const key = new THREE.DirectionalLight(0xf1d39a, 2.2); key.position.set(-3, 5, 4); scene.add(key);
const fill = new THREE.DirectionalLight(0x86a9b0, 0.7); fill.position.set(4, 2, -3); scene.add(fill);
const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
const items: { obj: THREE.Object3D; r: number; c: THREE.Vector3; label: string }[] = [];
const labels = document.getElementById('labels')!;
const rows = Math.ceil(ids.length / cols);
const cw = innerWidth / cols, ch = innerHeight / rows;
ids.forEach((id, i) => {
  const d = document.createElement('div');
  d.textContent = id;
  Object.assign(d.style, { position: 'fixed', left: `${(i % cols) * cw + 4}px`, top: `${Math.floor(i / cols) * ch + 2}px` });
  labels.appendChild(d);
});
void Promise.all(ids.map(async (id, i) => {
  try {
    const g = await loadGLB(`${dir}/${id}.glb`);
    const obj = g.scene;
    const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3());
    items[i] = { obj, r: Math.max(s.x, s.y, s.z), c: b.getCenter(new THREE.Vector3()), label: `${id} ${s.x.toFixed(2)}x${s.y.toFixed(2)}x${s.z.toFixed(2)}` };
    labels.children[i].textContent = items[i].label;
  } catch (e) { labels.children[i].textContent = id + ' FAILED'; }
}));
const t0 = performance.now();
function frame() {
  const t = (performance.now() - t0) / 1000;
  R.setScissor(0, 0, innerWidth, innerHeight); R.setViewport(0, 0, innerWidth, innerHeight);
  R.setClearColor(0x27313f); R.clear();
  items.forEach((it, i) => {
    if (!it) return;
    const x = (i % cols) * cw, y = innerHeight - (Math.floor(i / cols) + 1) * ch;
    R.setScissor(x, y, cw, ch); R.setViewport(x, y, cw, ch);
    R.setClearColor(i % 2 ? 0x2c3846 : 0x27313f); R.clear();
    scene.add(it.obj);
    cam.aspect = cw / ch; cam.updateProjectionMatrix();
    const a = q.has('spin') ? t * 0.4 : 0.6;
    cam.position.set(it.c.x + Math.sin(a) * it.r * 2.1, it.c.y + it.r * 0.7, it.c.z + Math.cos(a) * it.r * 2.1);
    cam.lookAt(it.c);
    R.render(scene, cam);
    scene.remove(it.obj);
  });
  requestAnimationFrame(frame);
}
frame();
