// Dev preview of Hollow & Co.'s office without the forest (dev-office.html; the window shows its painted view).
//   ?shot=establish|pip|form|...   just the office, a camera shot     ?hour=9.5   time of day     ?species=barn
//   ?intro=1&ob=<step>&obsel=...    the real interview on a light stand-in scene (same dev params as the app)
//   ?intro=1&boot=1                 the whole opening: the loading clock, the dive, the pull-back
import * as THREE from 'three';
import { h, render } from 'preact';
import { Office, type ShotName } from './office.ts';
import { sceneRef } from '../ui/state.ts';
import { Post } from '../world/post.ts';
import type { Stage } from '../world/scene.ts';

const q = new URLSearchParams(location.search);
const cv = document.getElementById('c') as HTMLCanvasElement;
const R = new THREE.WebGLRenderer({ canvas: cv, antialias: false });
R.setPixelRatio(Math.min(2, devicePixelRatio));
R.outputColorSpace = THREE.SRGBColorSpace;
R.shadowMap.enabled = true;
R.shadowMap.type = THREE.PCFSoftShadowMap;
const W = window as unknown as Record<string, unknown>;

if (q.has('intro')) {
  // a stand-in for world/scene.ts's Scene: just what the interview uses
  const stand = {
    renderer: R, quality: 'high' as const, stage: null as Stage | null, post: new Post(R, 'high'),
    setStage(st: Stage | null) { if (this.stage === st) return; this.stage?.dispose?.(); this.stage = st; st?.resize?.(innerWidth, innerHeight); },
    setView() { /* */ }, snapCamera() { /* */ }, owl: { play() { /* */ } },
  };
  stand.post.enabled = true;
  (sceneRef as { current: unknown }).current = stand;
  W.stand = stand;
  const ray = new THREE.Raycaster();
  const fwd = (type: 'down' | 'move' | 'up') => (e: PointerEvent) => {
    const st = stand.stage;
    if (!st) return;
    if (type === 'down') cv.setPointerCapture(e.pointerId);
    ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), st.camera);
    st.pointer?.(type, e.clientX, e.clientY, ray.ray.clone(), e);
  };
  cv.style.touchAction = 'none';
  cv.addEventListener('pointerdown', fwd('down')); cv.addEventListener('pointermove', fwd('move')); cv.addEventListener('pointerup', fwd('up'));
  const resize = () => { R.setSize(innerWidth, innerHeight, false); stand.stage?.resize?.(innerWidth, innerHeight); };
  addEventListener('resize', resize);
  resize();
  // ?warp=N runs N simulation steps per drawn frame (slow software GL in screenshots)
  const warp = Math.max(1, Number(q.get('warp') ?? 1));
  let last = performance.now(), t = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const st = stand.stage as (Stage & { step?: (dt: number, t: number) => void }) | null;
    if (st) {
      for (let i = 1; i < warp; i++) { t += 1 / 30; st.step?.(1 / 30, t); }
      t += dt; st.update(dt, t); R.setRenderTarget(null); R.render(st.scene, st.camera);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // the loading clock (copied from index.html) for the opening
  if (q.has('boot')) {
    const html = await (await fetch('/index.html')).text();
    const a = html.indexOf('<!-- boot:begin'), z = html.indexOf('<!-- boot:end -->');
    const box = document.createElement('div');
    box.innerHTML = html.slice(a, z);
    document.body.append(...Array.from(box.childNodes));
    const b = document.getElementById('boot')!;
    b.classList.add('hold');
    await import('./boot.ts');
    setTimeout(() => b.classList.add('gone'), 1500);
  }
  const { Intro } = await import('./intro.tsx');
  const root = document.createElement('div');
  document.body.appendChild(root);
  render(h(Intro, {}), root);
} else {
  const species = q.get('species') ?? 'tawny';
  const office = new Office({ skin: 'owl', species, palette: species, outfit: {} }, R, 'high', null);
  const resize = () => { R.setSize(innerWidth, innerHeight, false); office.resize(innerWidth, innerHeight); };
  addEventListener('resize', resize);
  resize();
  if (q.get('hour')) office.window(Number(q.get('hour')));
  office.cut((q.get('shot') as ShotName) ?? 'establish');
  W.office = office;
  let last = performance.now();
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    office.update(dt, now / 1000);
    R.setRenderTarget(null);
    R.render(office.scene, office.camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  void office.ready.then(() => { setTimeout(() => { W.__ready = true; }, 1500); });
}
