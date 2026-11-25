// Dev-only sheets for the anime layer (dev-anime.html):
//   ?sheet=pip&sp=tawny     Pip's anime expressions (any species or skin id in sp)
//   ?sheet=species          one expression on each species and skin
//   ?sheet=beaver           Barnaby's anime faces
//   ?sheet=emotes&t=0.45    every emote mark beside Pip, frozen t seconds in
//   ?fx=levelup&t=0.3&bg=/dist/shot.png   a big moment over a backdrop, frozen t seconds in
import * as THREE from 'three';
import { artPx } from '../../gfx/artpx.ts';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OwlActor, type OwlMood } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { SPECIES } from '../../owl/species.ts';
import { Beaver, BEAVER_FACES } from '../../world/stages/beaver.ts';
import { animeMoment, setChibi, sfxArt, type AnimeMoment } from './anime.ts';
import { EMOTES, popEmote, project, type EmoteKind } from './emotes.ts';

const q = new URLSearchParams(location.search);
const W = innerWidth, H = innerHeight;
const canvas = document.getElementById('c') as HTMLCanvasElement;
const done = () => { (window as unknown as { __ready: boolean }).__ready = true; };
// the lettering font for local checks (the app ships its own @font-face)
if (q.get('font')) { const f = new FontFace('Alagard', `url(${q.get('font')})`); void f.load().then((ff) => { document.fonts.add(ff); }).catch(() => undefined); }

function stage3d() {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1);
  r.setSize(W, H, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(q.get('bg') ? parseInt(q.get('bg')!, 16) : 0x9cc7d8);
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  const sun = new THREE.DirectionalLight(0xffe6c0, 2.6);
  sun.position.set(-3, 6, 7);
  scene.add(sun, new THREE.HemisphereLight(0xcfe6ff, 0x6a7a3a, 1.2));
  return { r, scene };
}
const label = (text: string, x: number, y: number) => { const el = document.createElement('div'); el.className = 'lbl'; el.textContent = text; el.style.left = `${x}px`; el.style.top = `${y}px`; document.body.appendChild(el); };
const sp = (id: string): OwlLook => (['gingerbread', 'snowman', 'celestial', 'meowl'].includes(id) ? { skin: id, species: 'tawny', palette: id === 'meowl' ? 'tabby' : 'tawny', outfit: {} } : { skin: 'owl', species: id, palette: id, outfit: {} });

/** A grid of owls, each close on the face. */
async function owlGrid(items: { look: OwlLook; mood: OwlMood; label: string; emote?: EmoteKind }[], cols: number, zoom = 1) {
  const { r, scene } = stage3d();
  const rows = Math.ceil(items.length / cols), tw = W / cols, th = H / rows;
  const cam = new THREE.PerspectiveCamera(24, tw / th, 0.05, 50);
  const actors = items.map((it) => { const a = new OwlActor(it.look); a.still = true; scene.add(a.node); a.node.visible = false; return a; });
  await Promise.all(actors.map((a) => a.ready));
  r.setScissorTest(true);
  const tiles: HTMLDivElement[] = [];
  items.forEach((it, i) => {
    const a = actors[i];
    a.setMood(it.mood);
    a.settle();
    for (let k = 0; k < 20; k++) a.update(1 / 60);
    a.node.visible = true;
    a.node.updateMatrixWorld(true);
    const f = a.faceCentre(), rad = a.faceRadius();
    const dist = (rad * 6.2) / zoom;
    cam.position.set(f.x + dist * 0.12, f.y + dist * 0.06, f.z + dist);
    cam.lookAt(f.x, f.y - rad * 0.15, f.z);
    cam.updateMatrixWorld();
    const c = i % cols, row = Math.floor(i / cols), x = c * tw, y = row * th;
    r.setViewport(x, H - y - th, tw, th); r.setScissor(x, H - y - th, tw, th);
    r.render(scene, cam);
    a.node.visible = false;
    label(it.label, x + tw / 2, y + th - 18);
    // a box over the tile so the emote layer can project into it
    const tile = document.createElement('div');
    Object.assign(tile.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${tw}px`, height: `${th}px`, pointerEvents: 'none' });
    document.body.appendChild(tile);
    tiles.push(tile);
    if (it.emote) {
      const camI = cam.clone(), fc = f.clone();
      popEmote(it.emote, { screen: () => project(fc, rad, { camera: camI, el: tile }) });
    }
  });
  done();
}

async function beaverSheet() {
  const { r, scene } = stage3d();
  const b = new Beaver();
  b.node.scale.setScalar(1.24);
  scene.add(b.node);
  await b.ready;
  (window as unknown as { __beaver: Beaver }).__beaver = b;
  const faces = BEAVER_FACES;
  const cols = +(q.get('cols') ?? 4), rows = Math.ceil(faces.length / cols), tw = W / cols, th = H / rows;
  const cam = new THREE.PerspectiveCamera(26, tw / th, 0.05, 50);
  r.setScissorTest(true);
  b.update(0.5);
  faces.forEach((f, i) => {
    b.setFace(f);
    b.update(1 / 60);
    b.node.updateMatrixWorld(true);
    const c = b.faceCentre()!;
    const yaw = +(q.get('yaw') ?? 0.35);
    const dd = +(q.get("dist") ?? 0.95);
    cam.position.set(c.x + Math.sin(yaw) * dd, c.y + 0.03, c.z + Math.cos(yaw) * dd);
    cam.lookAt(c.x, c.y - 0.03, c.z);
    const cc = i % cols, row = Math.floor(i / cols), x = cc * tw, y = row * th;
    r.setViewport(x, H - y - th, tw, th); r.setScissor(x, H - y - th, tw, th);
    r.render(scene, cam);
    label(f, x + tw / 2, y + th - 18);
    // ?marks=1: the emote mark that goes with each face, pinned to his head through this tile's camera
    const mark: Partial<Record<string, EmoteKind>> = { happy: 'notes', joy: 'sparkle', sparkly: 'sparkle', shock: 'bang', sleepy: 'zzz', teary: 'gloom', determined: 'anger', shy: 'hearts', flustered: 'sweat', thinking: 'ask', normal: 'bulb' };
    if (q.get('marks') && mark[f]) {
      const tile = document.createElement('div');
      Object.assign(tile.style, { position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${tw}px`, height: `${th}px`, pointerEvents: 'none' });
      document.body.appendChild(tile);
      const camI = cam.clone(), fc = c.clone(), rad = +(q.get('rad') ?? 0.075);
      popEmote(mark[f]!, { screen: () => project(fc, rad, { camera: camI, el: tile }) });
    }
  });
  if (q.get('t')) (window as unknown as { __animeT?: number }).__animeT = +q.get('t')!;
  done();
}

async function fxShot() {
  const bg = q.get('bg');
  if (bg) {
    canvas.style.display = 'none';
    const im = document.createElement('img');
    im.src = bg;
    Object.assign(im.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', objectFit: 'cover' });
    document.body.prepend(im);
    await new Promise((res) => { im.onload = res; im.onerror = res; });
  }
  const look: OwlLook = sp(q.get('sp') ?? 'tawny');
  const { owlIconAsync } = await import('../portraits.ts');
  const { pixelate } = await import('../pxfx.tsx');
  const url = await owlIconAsync(look, 'face').catch(() => '');
  if (url) await setChibi(await pixelate(url, 44));
  await document.fonts.ready;
  await new Promise((res) => setTimeout(res, 300));
  const t = +(q.get('t') ?? 0.3);
  const w = window as unknown as { __animeT?: number };
  w.__animeT = 100;
  const at = q.get('x') ? { x: +q.get('x')!, y: +q.get('y')! } : undefined;
  animeMoment(q.get('fx') as AnimeMoment, at);
  w.__animeT = 100 + t;
  setTimeout(done, 400);
}

const sheet = q.get('sheet');
if (q.get('t') && (sheet === 'emotes' || sheet === 'beaver')) (window as unknown as { __animeT?: number }).__animeT = 0;
if (sheet === 'pip') {
  const id = q.get('sp') ?? 'tawny';
  const moods: [OwlMood, string][] = [['neutral', 'neutral'], ['joy', 'happy ^ ^'], ['starry', 'sparkly'], ['surprised', 'surprised'], ['sleepy', 'sleepy'], ['shy', 'shy + blush'], ['flustered', 'flustered > <'], ['determined', 'determined'], ['grumpy', 'grumpy'], ['teary', 'teary'], ['love', 'love'], ['sad', 'sad']];
  void owlGrid(moods.map(([mood, l]) => ({ look: sp(id), mood, label: l })), +(q.get('cols') ?? 4), +(q.get('zoom') ?? 1));
} else if (sheet === 'species') {
  const moods: OwlMood[] = ['joy', 'starry', 'surprised', 'sleepy', 'shy', 'flustered', 'determined', 'teary', 'grumpy', 'love', 'joy', 'starry'];
  const ids = [...SPECIES.map((s) => s.id), 'gingerbread', 'snowman', 'celestial', 'meowl'];
  void owlGrid(ids.map((id, i) => ({ look: sp(id), mood: moods[i % moods.length], label: `${id}: ${moods[i % moods.length]}` })), +(q.get('cols') ?? 4), +(q.get('zoom') ?? 0.8));
} else if (sheet === 'beaver') void beaverSheet();
else if (sheet === 'emotes') {
  const mood: Record<EmoteKind, OwlMood> = { bang: 'surprised', ask: 'curious', sweat: 'shy', anger: 'grumpy', notes: 'joy', sparkle: 'starry', hearts: 'love', zzz: 'sleepy', bulb: 'excited', gloom: 'sad', steam: 'grumpy' };
  void owlGrid(EMOTES.map((e) => ({ look: sp(q.get('sp') ?? 'tawny'), mood: mood[e], label: e, emote: e })), +(q.get('cols') ?? 4), +(q.get('zoom') ?? 0.62)).then(() => {
    const w = window as unknown as { __animeT?: number };
    if (q.get('t')) w.__animeT = +q.get('t')!;
  });
} else if (q.get('fx')) void fxShot();
else if (q.get('words')) void (async () => {
  await document.fonts.ready;
  await new Promise((res) => setTimeout(res, 400));
  canvas.style.display = 'none';
  const list = q.get('words')!.split(',');
  const styles = [{ fill: '#ffd84a', deep: '#f08a1c' }, { fill: '#c9a6ff', deep: '#7448d8' }, { fill: '#8ff0b8', deep: '#2ea26a' }, { fill: '#ff6a4a', deep: '#b8202c' }, { fill: '#d8d2ff', deep: '#6a62c8', ink: '#1a1430' }, { fill: '#8fe0ff', deep: '#2f8ad8' }];
  const B = artPx(), c = document.createElement('canvas');
  c.width = Math.ceil(W / B); c.height = Math.ceil(H / B);
  Object.assign(c.style, { position: 'fixed', inset: '0', width: `${c.width * B}px`, height: `${c.height * B}px`, imageRendering: 'pixelated' });
  document.body.appendChild(c);
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  list.forEach((w, i) => {
    const art = sfxArt(w, { ...styles[i % styles.length], size: 3 });
    const cx = c.width / 2, cy = 30 + i * 58;
    for (const a of art) g.drawImage(a.img, Math.round(cx + a.x - a.img.width / 2), Math.round(cy + a.y - a.img.height / 2));
  });
  done();
})();
