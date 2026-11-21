// [globe] Dev page for the globe stage on its own. Query: focus=<place id>, spin=<rad>, t=<ms epoch for the sun>
import * as THREE from 'three';
import { AREAS } from '../game/catalog.ts';
import { GlobeStage } from '../world/globe/stage.ts';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setPixelRatio(Math.min(2, devicePixelRatio));
r.setSize(innerWidth, innerHeight, false);
r.outputColorSpace = THREE.SRGBColorSpace;
const st = new GlobeStage(r);
st.setPlaces(AREAS);
st.resize(innerWidth, innerHeight);
if (q.get('spin')) st.spin = Number(q.get('spin'));
const f = q.get('focus');
if (f) setTimeout(() => st.focus(AREAS.find((a) => a.id === f) ?? null), 50);
if (q.get('route')) st.setRoute({ lat: 51.5, lon: -0.1 }, AREAS.find((a) => a.id === q.get('route'))!);
addEventListener('resize', () => { r.setSize(innerWidth, innerHeight, false); st.resize(innerWidth, innerHeight); });
for (const t of ['down', 'move', 'up'] as const) canvas.addEventListener('pointer' + t, (e) => { const pe = e as PointerEvent; st.pointer(t, pe.clientX, pe.clientY, new THREE.Ray(), pe); });
let last = performance.now();
const loop = () => {
  requestAnimationFrame(loop);
  const now = performance.now(), dt = (now - last) / 1000; last = now;
  st.update(dt, now / 1000);
  r.render(st.scene, st.camera);
};
loop();
(window as unknown as { st: GlobeStage }).st = st;
