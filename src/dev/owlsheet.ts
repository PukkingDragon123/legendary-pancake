// Dev-only contact sheet for the toy owls (public/models/owls/*.glb). Query params:
//   set=species | skins | outfits | expr | series | fly | actions   (default species)
//   one=<model id or species>  one big owl;  yaw=<rad>  pitch=<rad>  back=1  zoom=<k>  look=<json OwlLook>
//   expr=<mode>  pose=fly|sleep|stand  mood=<mood>  bg=<hex>
import * as THREE from 'three';
import { OwlActor, type OwlAction, type OwlMood, type OwlPose } from '../owl/actor.ts';
import { defaultEye, type EyeMode, type EyeState } from '../owl/eyes.ts';
import { buildOwl, type OwlLook, type OwlModel } from '../owl/model.ts';
import { QUEEN_LOOK } from '../owl/queen.ts';
import { SPECIES } from '../owl/species.ts';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(Math.min(2, devicePixelRatio));
r.setSize(innerWidth, innerHeight, false);
r.shadowMap.enabled = true;
r.shadowMap.type = THREE.PCFSoftShadowMap;
r.outputColorSpace = THREE.SRGBColorSpace;
// the v4 look: ACES, a warm golden-hour sun with soft shadows, a sky / meadow fill and an environment map for the
// glossy bits (beak, talons, eyes); ?night=1 for moonlight and a warm lamp
r.toneMapping = THREE.ACESFilmicToneMapping;
r.toneMappingExposure = +(q.get('exposure') ?? 1.0);
const night = q.get('night') === '1';
const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') ? parseInt(q.get('bg')!, 16) : night ? 0x1c2a4a : 0x8fc0dc);
const pm = new THREE.PMREMGenerator(r);
scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = night ? 0.12 : 0.35;
const cam = new THREE.PerspectiveCamera(24, innerWidth / innerHeight, 0.1, 200);
const sun = new THREE.DirectionalLight(night ? 0xa8c0ff : 0xffe2b8, night ? 0.9 : 3.2);
sun.position.set(-5, 8, 7); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 });
scene.add(sun, new THREE.HemisphereLight(night ? 0x4a5a90 : 0xbfe0ff, night ? 0x1a2018 : 0x6a7a3a, night ? 0.5 : 1.1));
if (night) { const lamp = new THREE.PointLight(0xffa850, 18, 12, 1.6); lamp.position.set(2.5, 2.2, 2.5); scene.add(lamp); }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: night ? 0x2a3a2a : 0x6f9a3e, roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

type Entry = { look: OwlLook; label: string; eye?: Partial<EyeState>; pose?: OwlPose; mood?: OwlMood; action?: OwlAction; at?: number };
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
  { look: sp(q.get('sp') ?? 'tawny', { head: 'nightcap' }), label: 'nightcap' },
  { look: sp(q.get('sp') ?? 'barn', { head: 'explorer', back: 'satchel', neck: 'bandana' }), label: 'explorer' },
  { look: sp(q.get('sp') ?? 'snowy', { head: 'beanie', face: 'glasses' }), label: 'beanie+glasses' },
  { look: sp(q.get('sp') ?? 'sawwhet', { head: 'bow', face: 'monocle' }), label: 'bow+monocle' },
  { look: sp(q.get('sp') ?? 'greatgrey', { head: 'crown', back: 'backpack' }), label: 'crown+backpack' },
  { look: sp(q.get('sp') ?? 'burrowing', { head: 'froghat' }), label: 'froghat' },
  { look: sp(q.get('sp') ?? 'horned', { head: 'beret', face: 'stargoggles' }), label: 'beret' },
  { look: sp(q.get('sp') ?? 'eagle', { head: 'flowercrown' }), label: 'flowercrown' },
  { look: sp(q.get('sp') ?? 'horned', { head: 'stargoggles' }), label: 'goggles' },
  { look: sp(q.get('sp') ?? 'burrowing', { head: 'santa_hat', body: 'holiday_sweater' }), label: 'santa+jumper' },
];
else if (set === 'series') entries = [
  { look: sp('tawny', { head: 'santa_hat', neck: 'candy_scarf', body: 'holiday_sweater' }), label: 'Frostlight' },
  { look: sp('barn', { head: 'reindeer_antlers', neck: 'candy_scarf' }), label: 'Antlers' },
  { look: sp('greatgrey', { head: 'star_crown', back: 'moon_cape' }), label: 'Starfall' },
  { look: sp('snowy', { head: 'nightcap' }), label: 'Nightcap' },
  { look: sp('eagle', { head: 'ice_crown', back: 'frost_cape' }), label: 'Ice regalia' },
];
else if (set === 'expr') {
  const id = q.get('sp') ?? 'tawny';
  const modes: [string, Partial<EyeState>][] = [['normal', {}], ['happy', { mode: 'happy' }], ['sleepy', { lid: 0.55, pupil: 6.5 }], ['closed', { mode: 'closed' }], ['heart', { mode: 'heart' }], ['wide', { mode: 'wide', pupil: 3 }], ['star', { mode: 'star' }], ['spiral', { mode: 'spiral' }], ['sparkle', { mode: 'sparkle', pupil: 7 }], ['sad+tear', { tilt: -0.75, lid: 0.3, tear: true }], ['grumpy', { tilt: 0.8, lid: 0.35 }], ['smile', { low: 0.7 }]];
  entries = modes.map(([label, eye]) => ({ look: id === 'queen' ? QUEEN_LOOK : sp(id), label, eye }));
} else if (set === 'fly') entries = ['tawny', 'barn', 'eagle', 'snowy'].map((id) => ({ look: sp(id), label: id, pose: 'fly' as OwlPose }));
else if (set === 'actions') {
  const id = q.get('sp') ?? 'tawny';
  const acts: [OwlAction, number][] = [['hop', 0.25], ['dance', 0.5], ['wave', 0.6], ['yawn', 0.9], ['stretch', 0.9], ['flap', 0.5], ['spin', 0.6], ['present', 1.2], ['ruffle', 0.5], ['peck', 0.3]];
  entries = acts.map(([a, at]) => ({ look: sp(id), label: a, action: a, at }));
} else entries = SPECIES.map((s) => ({ look: sp(s.id), label: s.name }));

// stills: render each model's face and full portrait (portraits.ts) for art/blender/owls/stills.cjs to save
if (set === 'stills') {
  void (async () => {
    const { shootOwl } = await import('../ui/portraits.ts');
    const { OWL_RIGS } = await import('../owl/rig.gen.ts');
    const out: Record<string, { face: string; full: string }> = {};
    for (const id of Object.keys(OWL_RIGS)) {
      const look: OwlLook = id === 'queen' ? { ...QUEEN_LOOK, outfit: {} } : ['gingerbread', 'snowman', 'celestial', 'meowl'].includes(id) ? { ...sp('tawny'), skin: id } : sp(id);
      out[id] = { face: await shootOwl(look, 'face'), full: await shootOwl(look, 'full') };
      const im = document.createElement('img'); im.src = out[id].face; im.style.cssText = 'width:96px;image-rendering:pixelated'; document.body.appendChild(im);
    }
    (window as unknown as { __stills: unknown }).__stills = out;
    (window as unknown as { __ready: boolean }).__ready = true;
  })();
  throw new Error('stills mode');
}
const one = q.get('one');
if (one) entries = [{
  look: q.get('look') ? JSON.parse(q.get('look')!) : one === 'queen' ? QUEEN_LOOK : ['gingerbread', 'snowman', 'celestial', 'meowl'].includes(one) ? { ...sp('tawny'), skin: one } : sp(one),
  label: one, pose: (q.get('pose') as OwlPose) ?? undefined, mood: (q.get('mood') as OwlMood) ?? undefined,
  eye: q.get('expr') ? { mode: q.get('expr') as EyeMode } : undefined,
}];

const t0 = performance.now();
const cols = one ? 1 : Math.min(entries.length, +(q.get('cols') ?? (entries.length > 6 ? Math.ceil(entries.length / 2) : entries.length)));
const rows = Math.ceil(entries.length / cols);
const roots: THREE.Object3D[] = [];
const models: OwlModel[] = [];
const actors: (OwlActor | null)[] = [];
entries.forEach((e) => {
  let root: THREE.Object3D;
  if (e.pose || e.mood || e.action) {
    const a = new OwlActor(e.look);
    a.still = true;
    a.pose = e.pose ?? 'stand';
    if (e.mood) a.setMood(e.mood);
    a.settle();
    if (e.action) { a.play(e.action); for (let t = 0; t < (e.at ?? 0.5); t += 1 / 60) a.update(1 / 60); }
    if (e.pose === 'fly') { a.update(0.05); a.node.position.y = 0.9; }
    root = a.node;
    models.push(a.model);
    actors.push(a);
  } else {
    const o = buildOwl(e.look);
    const eye = { ...defaultEye(), ...(e.eye ?? {}) } as EyeState;
    o.eyes.forEach((ey) => ey.draw(eye));
    root = o.rig.root;
    models.push(o);
    actors.push(null);
  }
  root.rotation.y = q.get('yaw') !== null ? +q.get('yaw')! : q.get('back') ? Math.PI + 0.45 : -0.32;
  root.visible = false;
  scene.add(root);
  roots.push(root);
});

Promise.all(models.map((m) => m.ready)).then(() => {
  const buildMs = performance.now() - t0;
  const zoom = +(q.get('zoom') ?? 1);
  const W = innerWidth, H = innerHeight, tw = W / cols, th = H / rows;
  r.setScissorTest(true);
  cam.aspect = tw / th;
  cam.updateProjectionMatrix();
  const pitch = +(q.get('pitch') ?? 0.14);
  const dist = (one ? 4.6 : 5.6) / zoom;
  cam.position.set(0, 0.95 + Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  cam.lookAt(0, 0.85 + (q.get('pose') === 'fly' || set === 'fly' ? 0.35 : 0), 0);
  let tris = 0;
  roots.forEach((root, i) => {
    const c = i % cols, row = Math.floor(i / cols);
    const x = c * tw, y = H - (row + 1) * th;
    r.setViewport(x, y, tw, th); r.setScissor(x, y, tw, th);
    root.visible = true;
    r.render(scene, cam);
    tris = Math.max(tris, r.info.render.triangles);
    root.visible = false;
    const el = document.createElement('div');
    el.textContent = entries[i].label;
    el.style.cssText = `position:fixed;left:${x + tw / 2}px;top:${(row + 1) * th - 22}px;color:#f4eedd;font:13px monospace;transform:translate(-50%,0);text-shadow:0 1px 0 #2e2b24`;
    document.body.appendChild(el);
  });
  const info = document.createElement('div');
  info.style.cssText = 'position:fixed;left:6px;top:4px;color:#f4eedd;font:11px monospace';
  info.textContent = `loaded ${entries.length} in ${buildMs.toFixed(0)} ms; max tris/tile ${tris}; models ${[...new Set(models.map((m) => m.id))].join(' ')}`;
  document.body.appendChild(info);
  (window as unknown as { __ready: boolean }).__ready = true;
});
