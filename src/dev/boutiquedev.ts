// Dev preview of the Snow Queen's boutique stage on its own (no app around it).
// ?deals=piece:scarf,species:horned,item:fireplace  ?t=seconds to fast-forward
// ?gallery=shop/cand  (or ?gallery=a.glb,b.glb under public/models): a labelled contact sheet of models
import * as THREE from 'three';
import { Boutique, type DisplayItem } from '../world/stages/boutique.ts';
import { instanceGLB } from '../gfx/glb.ts';
import { dailyDeals } from '../game/shop.ts';
import { save } from '../game/store.ts';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(1);
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFSoftShadowMap;
r.outputColorSpace = THREE.SRGBColorSpace;

if (q.get('gallery')) void gallery(q.get('gallery')!.split(','));
else stage();

async function gallery(list: string[]) {
  const W = innerWidth, H = innerHeight, cols = +(q.get('cols') ?? 8), cell = Math.floor(W / cols);
  r.setSize(W, H, false);
  r.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x27313f);
  scene.add(new THREE.HemisphereLight(0xe8e0cc, 0x3d3229, 1.2));
  const k = new THREE.DirectionalLight(0xf6e2b4, 1.6); k.position.set(-3, 5, 4); scene.add(k);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
  const labels = document.createElement('div');
  labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:11px monospace;color:#f4eedd';
  document.body.appendChild(labels);
  let i = 0;
  for (const name of list) {
    const path = name.endsWith('.glb') ? name : name;
    let root: THREE.Object3D;
    try { root = (await instanceGLB(path)).root; } catch (e) { console.warn('fail', path, e); continue; }
    scene.add(root);
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const rad = Math.max(s.x, s.y, s.z) * 0.62;
    cam.position.copy(c).add(new THREE.Vector3(0.55, 0.42, 1).normalize().multiplyScalar(rad / Math.tan(THREE.MathUtils.degToRad(15))));
    cam.lookAt(c);
    const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
    r.setViewport(x, H - y - cell, cell, cell); r.setScissor(x, H - y - cell, cell, cell);
    r.render(scene, cam);
    scene.remove(root);
    let tris = 0;
    root.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; });
    const l = document.createElement('div');
    l.style.cssText = `position:absolute;left:${x + 3}px;top:${y + 2}px`;
    l.textContent = `${path.split('/').pop()} ${s.x.toFixed(2)}x${s.y.toFixed(2)}x${s.z.toFixed(2)} ${Math.round(tris)}t`;
    labels.appendChild(l);
    i++;
  }
  (window as unknown as { done: number }).done = 1;
}

function stage() {
  const deals: DisplayItem[] = q.get('deals')
    ? q.get('deals')!.split(',').map((s) => { const [kind, id] = s.split(':'); return { kind: kind as DisplayItem['kind'], id }; })
    : dailyDeals(save.value).map((d) => ({ kind: d.kind, id: d.id }));
  const b = new Boutique(deals);
  if (!q.get('raw')) b.attach(r);
  const size = () => { r.setSize(innerWidth, innerHeight, false); b.resize(innerWidth, innerHeight); };
  size();
  addEventListener('resize', size);
  let t = 0;
  const ff = +(q.get('t') ?? 3);
  for (let i = 0; i < ff * 30; i++) { t += 1 / 30; b.update(1 / 30, t); }
  if (q.get('present')) b.present(+q.get('present')!);
  if (q.get('celebrate')) b.celebrate(0);
  let last = performance.now();
  const loop = (ms: number) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ms - last) / 1000);
    last = ms; t += dt;
    b.update(dt, t);
    r.render(b.scene, b.camera);
  };
  requestAnimationFrame(loop);
  (window as unknown as { boutique: Boutique }).boutique = b;
}
