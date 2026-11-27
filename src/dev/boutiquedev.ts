// Dev preview of Barnaby's Lodge Store on its own (no app around it), through the app's post chain.
// ?deals=piece:scarf,species:horned,item:fireplace  ?shot=home|deals|stash|series|beaver|gift|deal:0|acorn:sack|gem:gems_80|series:frostlight
// ?clip=wave|talk|present|hop|think|gnaw (Barnaby plays it, ?at=seconds into it)  ?night=1  ?wish=5 (the barrel opens)
// ?gallery=shop/props.glb,...  (models under public/models): a labelled contact sheet
import * as THREE from 'three';
import { Lodge, type DisplayItem } from '../world/stages/lodge.ts';
import { instanceGLB } from '../gfx/glb.ts';
import { dailyDeals, handmadeShelf, weeklyBundles } from '../game/shop.ts';
import { save } from '../game/store.ts';
import { Post } from '../world/post.ts';
import type { BeaverClip } from '../world/stages/beaver.ts';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
r.setPixelRatio(1);
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFSoftShadowMap;
r.outputColorSpace = THREE.SRGBColorSpace;
r.toneMapping = THREE.NoToneMapping;

if (q.get('gallery')) void gallery(q.get('gallery')!.split(','));
else void stage();

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
  for (const path of list) {
    let root: THREE.Object3D;
    try { root = (await instanceGLB(path)).root; } catch (e) { console.warn('fail', path, e); continue; }
    const items = q.get('split') ? [...root.children] : [root];
    for (const it of items) {
      scene.add(it);
      it.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(it), c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
      const rad = Math.max(s.x, s.y, s.z) * 0.62;
      cam.position.copy(c).add(new THREE.Vector3(0.55, 0.42, 1).normalize().multiplyScalar(rad / Math.tan(THREE.MathUtils.degToRad(15))));
      cam.lookAt(c);
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
      r.setViewport(x, H - y - cell, cell, cell); r.setScissor(x, H - y - cell, cell, cell);
      r.render(scene, cam);
      scene.remove(it);
      const l = document.createElement('div');
      l.style.cssText = `position:absolute;left:${x + 3}px;top:${y + 2}px`;
      l.textContent = `${it.name || path.split('/').pop()} ${s.x.toFixed(2)}x${s.y.toFixed(2)}x${s.z.toFixed(2)}`;
      labels.appendChild(l);
      i++;
    }
  }
  (window as unknown as { done: number }).done = 1;
}

async function stage() {
  const deals: DisplayItem[] = q.get('deals')
    ? q.get('deals')!.split(',').map((s) => { const [kind, id] = s.split(':'); return { kind: kind as DisplayItem['kind'], id }; })
    : dailyDeals(save.value).map((d) => ({ kind: d.kind, id: d.id }));
  const b = new Lodge(deals);
  const post = new Post(r, 'high');
  const sky = { night: q.get('night') ? 1 : 0, hour: q.get('night') ? 22 : 14 };
  b.attach(r, { scene: new THREE.Scene(), sky });
  b.setWares(handmadeShelf().map((o) => o.id), weeklyBundles(save.value).map((o) => ({ ribbon: o.def.ribbon })));
  b.chalk([{ text: "Today's deals", size: 26 }, { text: 'new stock in 11h 22m', size: 18, col: '#f1d39a' }]);
  const size = () => { r.setSize(innerWidth, innerHeight, false); post.resize(innerWidth, innerHeight); b.resize(innerWidth, innerHeight); };
  size();
  addEventListener('resize', size);
  if (q.get('shot')) b.focus(q.get('shot')!, true);
  await Promise.race([Promise.all([b.ready, b.dealsReady]), new Promise((res) => setTimeout(res, 90000))]);
  let t = 0;
  const step = (n: number) => { for (let i = 0; i < n; i++) { t += 1 / 30; b.update(1 / 30, t); } };
  step(+(q.get('t') ?? 3) * 30);
  if (q.get('clip')) { b.beaver.play(q.get('clip') as BeaverClip, 0.01); step(Math.round(+(q.get('at') ?? 0.6) * 30)); }
  if (q.get('wish')) { void b.wish(+q.get('wish')! as 3 | 4 | 5); step(70); if (deals[0]) await b.showPrize(deals[0], +q.get('wish')! as 3 | 4 | 5); step(40); }
  if (q.get('sold')) b.setSold(+q.get('sold')!, true);
  post.render(b.scene, b.camera, t, b.look);
  (window as unknown as { __ready: number }).__ready = 1;
  (window as unknown as { lodge: Lodge }).lodge = b;
  (window as unknown as { redraw: () => void }).redraw = () => post.render(b.scene, b.camera, t, b.look);
  if (q.get('still')) return;
  let last = performance.now();
  const loop = (ms: number) => {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ms - last) / 1000);
    last = ms; t += dt;
    b.update(dt, t);
    post.render(b.scene, b.camera, t, b.look);
  };
  requestAnimationFrame(loop);
}
