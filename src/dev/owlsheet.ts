// Dev-only contact sheet for the owl models. Query params:
//   set=species | skins | outfits | expr | series | fly   (default species)
//   one=<species id>  one big owl;  yaw=<rad>  pitch=<rad>  back=1  zoom=<k>  look=<json OwlLook>
//   expr=<mode>  pose=fly|sleep|stand
import * as THREE from 'three';
import { OwlActor, type OwlMood, type OwlPose } from '../owl/actor.ts';
import { defaultEye, type EyeMode, type EyeState } from '../owl/eyes.ts';
import { buildOwl, type OwlLook } from '../owl/model.ts';
import { QUEEN_LOOK } from '../owl/queen.ts';
import { SPECIES } from '../owl/species.ts';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true });
r.setPixelRatio(devicePixelRatio);
r.setSize(innerWidth, innerHeight, false);
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFSoftShadowMap;
r.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x26293c);
const cam = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 0.1, 200);
const sun = new THREE.DirectionalLight(0xffe9cc, 2.4);
sun.position.set(-4, 9, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
const rimL = new THREE.DirectionalLight(0x9fb8ff, 0.9);
rimL.position.set(6, 4, -6);
scene.add(sun, rimL, new THREE.HemisphereLight(0xfff2e2, 0x4a3c34, 1.25));
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x3a3f58 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

type Entry = { look: OwlLook; label: string; eye?: Partial<EyeState>; pose?: OwlPose; mood?: OwlMood };
const sp = (id: string, outfit: OwlLook['outfit'] = {}): OwlLook => ({ skin: 'owl', species: id, palette: id, outfit });
const set = q.get('set') ?? 'species';
let entries: Entry[];
if (set === 'skins') entries = [
  { look: { ...sp('tawny'), skin: 'meowl', palette: 'tabby' }, label: 'Meowl' },
  { look: { ...sp('tawny'), skin: 'gingerbread' }, label: 'Gingerbread' },
  { look: { ...sp('snowy'), skin: 'snowman' }, label: 'Snowman' },
  { look: { ...sp('eagle'), skin: 'celestial' }, label: 'Celestial' },
  { look: QUEEN_LOOK, label: 'Queen Neve' },
];
else if (set === 'outfits') entries = [
  { look: sp('tawny', { head: 'nightcap', neck: 'scarf' }), label: 'nightcap+scarf' },
  { look: sp('barn', { head: 'explorer', back: 'satchel', neck: 'bandana' }), label: 'explorer' },
  { look: sp('little', { head: 'toadstool', body: 'sweater' }), label: 'toadstool' },
  { look: sp('horned', { head: 'wizard', face: 'glasses' }), label: 'wizard' },
  { look: sp('sawwhet', { head: 'bow', face: 'glasses', body: 'cardigan' }), label: 'bow' },
  { look: sp('greatgrey', { head: 'crown', neck: 'moonpendant', body: 'royalcape' }), label: 'crown' },
  { look: sp('burrowing', { head: 'froghat', body: 'raincoat' }), label: 'frog' },
  { look: sp('longeared', { face: 'sleepmask', body: 'pajamas', back: 'fairywings' }), label: 'pajamas' },
  { look: sp('eagle', { face: 'monocle', back: 'backpack', neck: 'bowtie' }), label: 'monocle' },
  { look: sp('snowy', { head: 'beanie', face: 'stargoggles', back: 'lantern' }), label: 'beanie' },
];
else if (set === 'series') entries = [
  { look: sp('tawny', { head: 'santa_hat', neck: 'candy_scarf', body: 'holiday_sweater' }), label: 'Frostlight' },
  { look: sp('barn', { head: 'reindeer_antlers', neck: 'candy_scarf' }), label: 'Antlers' },
  { look: sp('longeared', { head: 'star_crown', back: 'moon_cape' }), label: 'Starfall' },
  { look: { ...sp('snowy'), skin: 'gingerbread', outfit: { head: 'santa_hat' } }, label: 'Ginger santa' },
  { look: { ...sp('little'), skin: 'celestial', outfit: { head: 'star_crown', back: 'moon_cape' } }, label: 'Celestial' },
];
else if (set === 'expr') {
  const id = q.get('sp') ?? 'tawny';
  const modes: [string, Partial<EyeState>][] = [['normal', {}], ['happy', { mode: 'happy' }], ['sleepy', { lid: 0.55, pupil: 6.5 }], ['closed', { mode: 'closed' }], ['heart', { mode: 'heart' }], ['wide', { mode: 'wide', pupil: 3 }], ['star', { mode: 'star' }], ['spiral', { mode: 'spiral' }], ['sparkle', { mode: 'sparkle', pupil: 7 }], ['sad+tear', { tilt: -0.75, lid: 0.3, tear: true }], ['grumpy', { tilt: 0.8, lid: 0.35 }], ['nictitating', { nict: 0.55 }]];
  entries = modes.map(([label, eye]) => ({ look: sp(id), label, eye }));
} else if (set === 'fly') entries = ['tawny', 'barn', 'eagle', 'snowy'].map((id) => ({ look: sp(id), label: id, pose: 'fly' as OwlPose }));
else entries = SPECIES.map((s) => ({ look: sp(s.id), label: s.name }));

const one = q.get('one');
if (one) entries = [{ look: q.get('look') ? JSON.parse(q.get('look')!) : one === 'queen' ? QUEEN_LOOK : sp(one), label: one, pose: (q.get('pose') as OwlPose) ?? undefined, eye: q.get('expr') ? { mode: q.get('expr') as EyeMode } : undefined }];

const t0 = performance.now();
const cols = one ? 1 : Math.min(entries.length, +(q.get('cols') ?? (entries.length > 6 ? Math.ceil(entries.length / 2) : entries.length)));
const rows = Math.ceil(entries.length / cols);
const roots: THREE.Object3D[] = [];
let texels = 0, maxTex = 0;
entries.forEach((e, i) => {
  let root: THREE.Object3D;
  if (e.pose || e.mood) {
    const a = new OwlActor(e.look);
    a.still = true;
    a.pose = e.pose ?? 'stand';
    if (e.mood) a.setMood(e.mood);
    a.settle();
    if (e.pose === 'fly') { a.update(0.05); a.node.position.y = 0.9; }
    root = a.node;
    const tx = a.model.rig.tex.image; texels += tx.width * tx.height; maxTex = Math.max(maxTex, tx.width, tx.height);
  } else {
    const o = buildOwl(e.look);
    const eye = { ...defaultEye(), ...(e.eye ?? {}) } as EyeState;
    o.eyes.forEach((ey) => ey.draw(eye));
    root = o.rig.root;
    const tx = o.rig.tex.image; texels += tx.width * tx.height; maxTex = Math.max(maxTex, tx.width, tx.height);
  }
  root.rotation.y = q.get('yaw') !== null ? +q.get('yaw')! : q.get('back') ? Math.PI + 0.45 : -0.32;
  root.visible = false;
  scene.add(root);
  roots.push(root);
});
const buildMs = performance.now() - t0;
// one viewport tile per owl, each framed on its own
const zoom = +(q.get('zoom') ?? 1);
const W = innerWidth, H = innerHeight, tw = W / cols, th = H / rows;
r.setScissorTest(true);
cam.aspect = tw / th;
cam.updateProjectionMatrix();
const pitch = +(q.get('pitch') ?? 0.14);
const dist = (one ? 4.4 : 5.2) / zoom;
cam.position.set(0, 0.95 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
cam.lookAt(0, 0.9 + (q.get('pose') === 'fly' || set === 'fly' ? 0.35 : 0), 0);
roots.forEach((root, i) => {
  const c = i % cols, row = Math.floor(i / cols);
  const x = c * tw, y = H - (row + 1) * th;
  r.setViewport(x, y, tw, th); r.setScissor(x, y, tw, th);
  root.visible = true;
  r.render(scene, cam);
  root.visible = false;
  const el = document.createElement('div');
  el.textContent = entries[i].label;
  el.style.cssText = `position:fixed;left:${x + tw / 2}px;top:${(row + 1) * th - 22}px;color:#e8e2ff;font:13px monospace;transform:translate(-50%,0);text-shadow:0 1px 0 #000`;
  document.body.appendChild(el);
});
const info = document.createElement('div');
info.style.cssText = 'position:fixed;left:6px;top:4px;color:#9a96c0;font:11px monospace';
info.textContent = `build ${buildMs.toFixed(0)} ms for ${entries.length}; texels ${(texels / 1e6).toFixed(2)}M, max side ${maxTex}`;
document.body.appendChild(info);
(window as unknown as { __ready: boolean }).__ready = true;
