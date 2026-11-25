// Dev-only sheets for the effects (dev-fx.html):
//   ?sheet=pixel&scale=4&bg=3a4a3c      every pixel-art particle sprite, frame by frame
//   ?sheet=pip&sp=tawny                 Pip's expressions (any species or skin id in sp)
//   ?sheet=beaver                       Barnaby's faces
//   ?world=leaves,petals,coins&t=0.8&night=1   3D particle presets in a small lit scene, t seconds in
//   ?cue=hearts,notes,sparkle,zzz&t=0.6 Pip's reactions (body language and their touch of light)
//   ?ui=leaves,petals,acorns&t=0.5&bg=/shot.png   interface particles over a backdrop, t seconds in
//   ?fx=levelup&t=0.4&bg=/shot.png      a big moment over a backdrop, t seconds in
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OwlActor, type EmoteKind, type OwlMood } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { Beaver, BEAVER_FACES } from '../../world/stages/beaver.ts';
import { Fx, type BurstKind } from '../../world/fx.ts';
import { Fireflies } from '../../world/fireflies.ts';
import { fxMoment, type MomentKind } from './moment.ts';
import { sheet as pixelSheet } from './pixel.ts';
import { uiAdvance, uiBurst, type UiFxKind } from '../chrome/uifx.ts';

const q = new URLSearchParams(location.search);
const W = innerWidth, H = innerHeight;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const done = () => { (window as unknown as { __ready: boolean }).__ready = true; };
const label = (text: string, x: number, y: number) => { const el = document.createElement('div'); el.className = 'lbl'; el.textContent = text; el.style.left = `${x}px`; el.style.top = `${y}px`; document.body.appendChild(el); };
const sp = (id: string): OwlLook => (['gingerbread', 'snowman', 'celestial', 'meowl'].includes(id) ? { skin: id, species: 'tawny', palette: id === 'meowl' ? 'tabby' : 'tawny', outfit: {} } : { skin: 'owl', species: id, palette: id, outfit: {} });
const night = !!q.get('night');

function stage3d() {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(W, H, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? 0x14203a : 0x9cc7d8);
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = night ? 0.1 : 0.4;
  const sun = new THREE.DirectionalLight(night ? 0x9ab0ff : 0xffe6c0, night ? 0.6 : 2.6);
  sun.position.set(-3, 6, 4);
  scene.add(sun, new THREE.HemisphereLight(night ? 0x34406a : 0xcfe6ff, night ? 0x141a24 : 0x6a7a3a, night ? 0.5 : 1.2));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: night ? 0x1e2c24 : 0x5f8a3e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  return { r, scene };
}

/** A grid of owls, each close on the face (an optional reaction played and stepped to t). */
async function owlGrid(items: { look: OwlLook; mood: OwlMood; label: string; cue?: EmoteKind }[], cols: number, zoom = 1) {
  const { r, scene } = stage3d();
  const fx = new Fx(600);
  scene.add(fx.group);
  fx.setLight(new THREE.Color(night ? 0x506080 : 0xffffff));
  const rows = Math.ceil(items.length / cols), tw = W / cols, th = H / rows;
  const cam = new THREE.PerspectiveCamera(24, tw / th, 0.05, 50);
  const actors = items.map((it) => { const a = new OwlActor(it.look); a.still = true; scene.add(a.node); a.node.visible = false; return a; });
  await Promise.all(actors.map((a) => a.ready));
  r.setScissorTest(true);
  const t = +(q.get('t') ?? 0.6);
  items.forEach((it, i) => {
    const a = actors[i];
    a.node.position.set(i * 3, 0, 0);
    a.setMood(it.mood);
    for (let k = 0; k < 20; k++) a.update(1 / 60);
    a.node.visible = true;
    a.node.updateMatrixWorld(true);
    const f = a.faceCentre(), rad = a.faceRadius();
    fx.clear();
    if (it.cue) { fx.cue(it.cue, f, rad); for (let k = 0; k < Math.round(t * 60); k++) { fx.update(1 / 60, k / 60); a.update(1 / 60); } }
    const dist = (rad * 7.5) / zoom;
    cam.position.set(f.x + Math.sin(0.12) * dist, f.y + dist * 0.06, f.z + Math.cos(0.12) * dist);
    cam.lookAt(f.x, f.y, f.z);
    cam.updateMatrixWorld();
    const c = i % cols, row = Math.floor(i / cols), x = c * tw, y = row * th;
    r.setViewport(x, H - y - th, tw, th); r.setScissor(x, H - y - th, tw, th);
    r.render(scene, cam);
    a.node.visible = false;
    label(it.label, x + tw / 2, y + th - 18);
  });
  done();
}

async function beaverSheet() {
  const { r, scene } = stage3d();
  const b = new Beaver();
  b.node.scale.setScalar(1.24);
  scene.add(b.node);
  await b.ready;
  const faces = BEAVER_FACES, cols = +(q.get('cols') ?? 4), rows = Math.ceil(faces.length / cols), tw = W / cols, th = H / rows;
  const cam = new THREE.PerspectiveCamera(26, tw / th, 0.05, 50);
  r.setScissorTest(true);
  b.update(0.5);
  faces.forEach((f, i) => {
    b.setFace(f);
    b.update(1 / 60);
    b.node.updateMatrixWorld(true);
    const c = b.faceCentre()!;
    cam.position.set(c.x + Math.sin(0.35) * 0.95, c.y + 0.03, c.z + Math.cos(0.35) * 0.95);
    cam.lookAt(c.x, c.y - 0.03, c.z);
    const cc = i % cols, row = Math.floor(i / cols), x = cc * tw, y = row * th;
    r.setViewport(x, H - y - th, tw, th); r.setScissor(x, H - y - th, tw, th);
    r.render(scene, cam);
    label(f, x + tw / 2, y + th - 18);
  });
  done();
}

/** 3D presets side by side in a small lit scene, stepped to t seconds. */
function worldSheet(kinds: BurstKind[]) {
  const { r, scene } = stage3d();
  const fx = new Fx(2000);
  scene.add(fx.group);
  fx.setLight(new THREE.Color(night ? 0x5a6a90 : 0xffffff));
  const span = 2.4, n = kinds.length, mid = ((n - 1) * span) / 2;
  const cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 80);
  const dist = Math.max(3, (n * span) / (2 * Math.tan(THREE.MathUtils.degToRad(20)) * (W / H)) * 0.95) / +(q.get('zoom') ?? 1);
  cam.position.set(mid, 2.2, dist);
  cam.lookAt(mid, 1.25, 0);
  cam.updateMatrixWorld();
  kinds.forEach((k, i) => {
    const x = i * span;
    fx.burst(k, x, 1.2, 0, +(q.get('n') ?? 14));
    const p = new THREE.Vector3(x, 0.15, 0).project(cam);
    label(k, (p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H);
  });
  const t = +(q.get('t') ?? 0.8);
  // ?flies=1: the fireflies round the scene as well
  const flies = q.get('flies') ? new Fireflies(40, new THREE.Vector3(mid, 0, -1), 3.5, [0.3, 2.4]) : null;
  if (flies) { flies.alpha = 1; scene.add(flies.mesh); }
  for (let s = 0; s < Math.round(t * 60); s++) { fx.update(1 / 60, s / 60); flies?.update(1 / 60, s / 60); }
  r.render(scene, cam);
  done();
}

async function backdrop() {
  const bg = q.get('bg');
  canvas.style.display = 'none';
  if (q.get('bgc')) document.body.style.background = '#' + q.get('bgc');
  if (!bg) return;
  const im = document.createElement('img');
  im.src = bg;
  Object.assign(im.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'cover' });
  document.body.prepend(im);
  await new Promise((res) => { im.onload = res; im.onerror = res; });
}

const w = window as unknown as { __fxT?: number; __chromeT?: number };
const sheetQ = q.get('sheet');
if (sheetQ === 'pixel') {
  canvas.style.display = 'none';
  const scale = +(q.get('scale') ?? 4);
  for (const bg of ['#3a4a3c', '#e8dcc0', '#141a2c']) {
    const c = pixelSheet(scale, undefined, bg);
    c.style.cssText = 'display:inline-block;margin:4px;image-rendering:pixelated';
    document.body.appendChild(c);
  }
  done();
} else if (sheetQ === 'pip') {
  const id = q.get('sp') ?? 'tawny';
  const moods: OwlMood[] = ['neutral', 'joy', 'starry', 'surprised', 'sleepy', 'shy', 'flustered', 'determined', 'grumpy', 'teary', 'love', 'sad'];
  void owlGrid(moods.map((mood) => ({ look: sp(id), mood, label: mood })), +(q.get('cols') ?? 4), +(q.get('zoom') ?? 1));
} else if (sheetQ === 'beaver') void beaverSheet();
else if (q.get('cue')) {
  const mood: Record<string, OwlMood> = { bang: 'surprised', ask: 'curious', sweat: 'shy', anger: 'grumpy', notes: 'joy', sparkle: 'starry', hearts: 'love', zzz: 'sleepy', bulb: 'excited', gloom: 'sad', steam: 'grumpy' };
  const cues = q.get('cue')!.split(',') as EmoteKind[];
  void owlGrid(cues.map((c) => ({ look: sp(q.get('sp') ?? 'tawny'), mood: mood[c] ?? 'neutral', label: c, cue: c })), +(q.get('cols') ?? 3), +(q.get('zoom') ?? 0.7));
} else if (q.get('world')) worldSheet(q.get('world')!.split(',') as BurstKind[]);
else if (q.get('ui')) void (async () => {
  await backdrop();
  w.__chromeT = 0;
  const list = q.get('ui')!.split(',') as UiFxKind[], cols = Math.min(list.length, 3), rows = Math.ceil(list.length / cols);
  list.forEach((k, i) => {
    const x = ((i % cols) + 0.5) * (W / cols), y = (Math.floor(i / cols) + 0.4) * (H / rows);
    uiBurst(k, x, y, +(q.get('n') ?? 14));
    label(k, x, y + H / rows * 0.45);
  });
  uiAdvance(+(q.get('t') ?? 0.5));
  setTimeout(done, 300);
})();
else if (q.get('fx')) void (async () => {
  await backdrop();
  w.__fxT = 100; w.__chromeT = 0;
  const at = q.get('x') ? { x: +q.get('x')!, y: +q.get('y')! } : undefined;
  fxMoment(q.get('fx') as MomentKind, at);
  const t = +(q.get('t') ?? 0.4);
  w.__fxT = 100 + t;
  uiAdvance(t);
  setTimeout(done, 400);
})();
