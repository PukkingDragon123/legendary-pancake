// Dev preview of the Snow Queen's boutique stage on its own (no app around it).
// ?deals=piece:scarf,species:horned,item:fireplace  ?t=seconds to fast-forward  ?layout=top|side
import * as THREE from 'three';
import { Boutique, type DisplayItem } from '../world/stages/boutique.ts';
import { dailyDeals } from '../game/shop.ts';
import { save } from '../game/store.ts';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setPixelRatio(1);
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFSoftShadowMap;
r.outputColorSpace = THREE.SRGBColorSpace;
const deals: DisplayItem[] = q.get('deals')
  ? q.get('deals')!.split(',').map((s) => { const [kind, id] = s.split(':'); return { kind: kind as DisplayItem['kind'], id }; })
  : dailyDeals(save.value).map((d) => ({ kind: d.kind, id: d.id }));
const b = new Boutique(deals);
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
