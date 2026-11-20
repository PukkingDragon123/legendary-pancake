// Dev-only contact sheet: renders owls in different palettes, outfits and expressions.
import * as THREE from 'three';
import { buildOwl } from '../owl/model.ts';
import { defaultEye, type EyeState } from '../owl/eyes.ts';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setPixelRatio(devicePixelRatio);
r.setSize(innerWidth, innerHeight, false);
r.shadowMap.enabled = true;
r.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b3046);
const cam = new THREE.PerspectiveCamera(28, innerWidth / innerHeight, 0.1, 100);
const sun = new THREE.DirectionalLight(0xffe7c4, 2.6);
sun.position.set(4, 8, 6); sun.castShadow = true;
scene.add(sun, new THREE.HemisphereLight(0xffeedd, 0x5a4638, 1.2));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshLambertMaterial({ color: 0x3a4060 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const looks = (q.get('set') ?? 'palettes') === 'palettes'
  ? ['tabby', 'ginger', 'snow', 'tuxedo', 'calico', 'siamese', 'midnight', 'aurora'].map((p) => ({ palette: p, outfit: {} }))
  : [
    { palette: 'tabby', outfit: { head: 'nightcap', neck: 'scarf' } },
    { palette: 'snow', outfit: { head: 'wizard', body: 'cloudcloak' } },
    { palette: 'ginger', outfit: { head: 'explorer', back: 'satchel', neck: 'bandana' } },
    { palette: 'calico', outfit: { head: 'toadstool', body: 'sweater' } },
    { palette: 'siamese', outfit: { head: 'bow', face: 'glasses', body: 'cardigan' } },
    { palette: 'midnight', outfit: { head: 'crown', body: 'royalcape', neck: 'moonpendant' } },
    { palette: 'tuxedo', outfit: { head: 'froghat', body: 'raincoat' } },
    { palette: 'aurora', outfit: { face: 'sleepmask', body: 'pajamas', back: 'fairywings' } },
  ];
const exprs: Partial<EyeState>[] = [{}, { mode: 'happy' }, { lid: 0.55, pupil: 6.5 }, { mode: 'heart' }, { mode: 'wide' }, { tilt: 0.8, lid: 0.35 }, { mode: 'closed' }, { mode: 'sparkle', pupil: 6.5, lx: 0.4 }];
looks.forEach((look, i) => {
  const o = buildOwl(look);
  const c = i % 4, row = Math.floor(i / 4);
  o.rig.root.position.set((c - 1.5) * 2.4, 0, row * -2.6 + 1.2);
  o.rig.root.rotation.y = q.get('back') ? Math.PI + 0.5 : -0.35 + c * 0.15;
  scene.add(o.rig.root);
  const e = { ...defaultEye(), ...(q.get('expr') ? exprs[i] : {}) } as EyeState;
  o.eyes.forEach((ey) => ey.draw(e));
});
if (q.get('one')) {
  scene.children.filter((c) => c.type === 'Group').forEach((g, i) => { g.visible = i === 0; g.position.set(0, 0, 0); g.rotation.y = -0.4; });
  cam.position.set(0, 1.4, 4.2); cam.lookAt(0, 0.85, 0);
} else { cam.position.set(0, 4.2, 13); cam.lookAt(0, 0.6, -0.2); }
r.render(scene, cam);
(window as any).__ready = true;
