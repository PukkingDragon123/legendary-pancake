// Queen Neve's boutique: a snug winter shop seen from just in front of the counter. Oak floorboards,
// sage panelling under striped wallpaper, a frosted bay window with snow falling on a moonlit
// evening outside and fairy lights along the pelmet, tall shelves crowded with boxed goods, a glass
// display case, a garment rail, a hat stand and dress forms, a little wood stove, hanging lanterns.
// Every prop is a lowpix model (art/lowpix/shop/*.json -> public/models/shop/*.glb): low poly with
// dense hand-painted pixel textures, lit by warm lamplight and the cool window. Today's three deals
// are physically on display: outfit pieces on dress forms, plumages as owls on a plinth, furniture
// on a velvet plinth, and the middle deal on a riser on the counter. Queen Neve stands behind the
// counter. OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';
import { box, buildProp, propMesh, type BoxSpec, type Texel } from '../../gfx/box.ts';
import { instanceGLB } from '../../gfx/glb.ts';
import { P } from '../../gfx/palette.ts';
import { ITEMS } from '../../assets/registry.ts';
import { OwlActor, type OwlAction, type OwlFx, type OwlMood } from '../../owl/actor.ts';
import { owlBoxes, type BoneName, type OwlLook } from '../../owl/model.ts';
import { PIECE } from '../../owl/outfits.ts';
import { QUEEN_LOOK } from '../../owl/queen.ts';
import { sceneSound, sound } from '../../audio/sound.ts';
import { Fx, SPR } from '../fx.ts';
import type { Stage } from '../scene.ts';
import { bulbTexture, frostTexture, glassTexture, haloTexture, outdoorTexture, poolTexture } from './shopart.ts';

export interface DisplayItem { kind: 'item' | 'piece' | 'species' | 'skin' | 'finish'; id: string }
export type BoutiqueLayout = 'side' | 'top';

/** lowpix models are built in units of 1/16 world unit */
const U = 1 / 16;
// the window opening in the back wall (see art/lowpix/shop/make.py: WX, WY0, WY1, WZ)
const WIN = { x: 20 * U, y0: 18 * U, y1: 50 * U, z: -45 * U, glass: -52 * U };

// ------------------------------------------------------------------ model helpers

/** A lowpix shop model, scaled to world units; parts named *glow* light up. */
async function shopModel(id: string): Promise<THREE.Object3D> {
  const { root } = await instanceGLB(`shop/${id}.glb`);
  root.scale.setScalar(U);
  root.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    let o: THREE.Object3D | null = m, glow = false;
    for (let k = 0; o && k < 3; k++, o = o.parent) if (/glow/.test(o.name)) glow = true;
    if (glow) {
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveMap = mat.map;
      mat.emissiveIntensity = 0.7;
      mat.userData.flicker = /stove/.test(m.name) || /stove/.test(m.parent?.name ?? '');
      m.material = mat;
      m.castShadow = false;
      m.userData.glow = mat;
    }
  });
  return root;
}
const named = (root: THREE.Object3D, name: string) => root.getObjectByName(name) ?? null;

function boxMesh(boxes: BoxSpec[]): THREE.Mesh {
  const m = propMesh(buildProp(boxes, { wind: false }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Scale and lift an object so it fits a W x H x D box with its feet at y = 0. */
function fit(o: THREE.Object3D, W: number, H: number, D = W) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const k = Math.min(W / Math.max(0.01, s.x), H / Math.max(0.01, s.y), D / Math.max(0.01, s.z));
  o.scale.multiplyScalar(k);
  o.position.x -= c.x * k; o.position.z -= c.z * k;
  o.position.y -= b.min.y * k;
}

// the bare snowy owl's body, measured once: dress forms are fitted to it so pieces sit right
let owlBody: { box: THREE.Box3; bare: Record<BoneName, BoxSpec[]> } | null = null;
const BASE_OWL: OwlLook = { species: 'snowy', palette: 'snowy', outfit: {} };
function bareOwl() {
  if (owlBody) return owlBody;
  const bare = owlBoxes(BASE_OWL);
  const box = new THREE.Box3();
  for (const bone of ['body', 'head'] as BoneName[]) for (const b of bare[bone] ?? []) {
    const [x, y, z] = b.at, [w, h, d] = b.size;
    box.expandByPoint(new THREE.Vector3(x * U, y * U, z * U));
    box.expandByPoint(new THREE.Vector3((x + w) * U, (y + h) * U, (z + d) * U));
  }
  owlBody = { box, bare };
  return owlBody;
}

/** Just the boxes an outfit piece adds to the snowy owl (the piece itself, in owl space). */
function pieceBoxes(id: string): BoxSpec[] | null {
  const def = PIECE[id];
  if (!def) return null;
  try {
    const { bare } = bareOwl();
    const dressed = owlBoxes({ ...BASE_OWL, outfit: { [def.slot]: id } });
    const out: BoxSpec[] = [];
    for (const bone of Object.keys(dressed) as BoneName[]) dressed[bone].slice(bare[bone]?.length ?? 0).forEach((b) => out.push(b));
    return out.length ? out : null;
  } catch { return null; }
}

/** An owl dress form wearing a piece: the form is fitted to the owl's body so the piece sits on it. */
async function dressedForm(id: string): Promise<THREE.Object3D> {
  const g = new THREE.Group();
  const form = await shopModel('bust');
  const { box } = bareOwl();
  // the form's linen body spans y 15..37.4, x +-6.3, z +-5.5 (model units)
  const fw = 12.6 * U, fh = 22.4 * U, fd = 11 * U;
  const ow = box.max.x - box.min.x, oh = box.max.y - box.min.y, od = box.max.z - box.min.z;
  const k = oh / fh;
  form.scale.set(U * Math.max(k * 0.9, (ow / fw) * 0.98), U * k, U * Math.max(k * 0.9, (od / fd) * 0.98));
  form.position.set((box.min.x + box.max.x) / 2, box.min.y - 15 * U * k, (box.min.z + box.max.z) / 2);
  g.add(form);
  const model = (PIECE[id] as unknown as { model?: string })?.model;
  if (model) {
    try { const { root } = await instanceGLB(model); g.add(root); return g; } catch { /* fall back to the boxes */ }
  }
  const boxes = pieceBoxes(id);
  if (boxes) g.add(boxMesh(boxes));
  return g;
}

/** Today's item: its hand-made GLB when it has one, else its built model. */
async function itemModel(id: string): Promise<THREE.Object3D | null> {
  const def = ITEMS[id];
  if (!def) return null;
  const g = new THREE.Group();
  if (def.model) {
    try {
      const { root, clips } = await instanceGLB(def.model);
      g.add(root);
      if (clips.length) {
        const mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(clips.find((c) => c.name === 'idle') ?? clips[0]).play();
        g.userData.animate = (_t: number, dt: number) => mixer.update(dt);
      }
      return g;
    } catch { /* fall back */ }
  }
  const m = boxMesh(def.build());
  for (const p of def.parts?.() ?? []) m.add(p);
  g.add(m);
  if (def.animate) g.userData.animate = (t: number, dt: number) => def.animate!(m, t, dt);
  g.userData.dispose = () => m.userData.dispose?.();
  return g;
}

// ------------------------------------------------------------------ the props and where they stand

interface Place { id: string; at: [number, number, number]; yaw?: number; scale?: number; mirror?: boolean }
const PROPS: Place[] = [
  { id: 'room', at: [0, 0, 0] },
  { id: 'window', at: [0, 0, 0] },
  { id: 'shelves', at: [-2.56, 0, -2.5] },
  { id: 'shelves', at: [2.56, 0, -2.5], mirror: true },
  { id: 'counter', at: [0, 0, -0.75] },
  { id: 'case', at: [-3.2, 0, -0.05], yaw: 0.6 },
  { id: 'rail', at: [-3.62, 0, -1.32], yaw: 1.15 },
  { id: 'bust_dressed', at: [-2.78, 0, -1.78], yaw: 0.35, scale: 0.62 },
  { id: 'stove', at: [3.62, 0, -1.5], yaw: -0.75 },
  { id: 'hatstand', at: [3.3, 0, 0.12], yaw: -0.4 },
  { id: 'bust_dressed', at: [2.9, 0, -0.62], yaw: -0.5, scale: 0.6, mirror: true },
  { id: 'fir', at: [-3.88, 0, -2.42] },
  { id: 'plant', at: [0.86, WIN.y0 + 2.2 * U, -2.62] },
  { id: 'plant', at: [-1.98, 49.2 * U, -2.46], scale: 0.9 },
  { id: 'garland', at: [0, 3.76 - 16 * U, -2.58] },
  { id: 'garland', at: [-2.56, 3.2 - 16 * U, -2.2], scale: 0.7 },
  { id: 'garland', at: [2.56, 3.2 - 16 * U, -2.2], scale: 0.7 },
  { id: 'doormat', at: [0, 0.005, 1.55] },
  { id: 'lantern', at: [-1.42, 2.58, -0.45] },
  { id: 'lantern', at: [1.42, 2.58, -0.45] },
];

// display spots: two dress-form / plinth spots on the floor, one riser on the counter
interface SpotDef { x: number; y: number; z: number; floor: boolean }
const SPOTS: SpotDef[] = [
  { x: -1.86, y: 0, z: 0.16, floor: true },
  { x: -0.92, y: 17 * U, z: -0.72, floor: false },
  { x: 1.86, y: 0, z: 0.16, floor: true },
];

interface Stand {
  def: SpotDef;
  group: THREE.Group;
  /** what stands at the spot (plinth / riser / form) */
  base: THREE.Group;
  /** the deal itself, which turns and bounces */
  holder: THREE.Group;
  top: number;
  model: THREE.Object3D | null;
  owl: OwlActor | null;
  pool: THREE.Mesh;
  hit: THREE.Mesh;
  focus: number;
  bounce: number;
  sold: boolean;
}

interface Bulb { s: THREE.Sprite; h: THREE.Sprite; c: THREE.Color; phase: number }

export class Boutique implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.3, 80);
  readonly queen: OwlActor;
  readonly fx = new Fx(900);
  /** resolves when the room's models are in */
  readonly ready: Promise<void>;
  layout: BoutiqueLayout = 'side';
  /** where the boutique's centre sits on screen (fractions), set by resize() */
  focus = { x: 0.72, y: 0.5 };
  /** taps on a display (0..2) or the queen */
  onPick: ((i: number) => void) | null = null;
  onQueen: (() => void) | null = null;
  private queenRig = new THREE.Group();
  private stands: Stand[] = [];
  private bulbs: Bulb[] = [];
  private lanterns: THREE.Object3D[] = [];
  private lanternLights: THREE.PointLight[] = [];
  private glows: THREE.MeshStandardMaterial[] = [];
  private stoveLight = new THREE.PointLight(0xefb85a, 4, 4.5, 1.6);
  private focusLight = new THREE.SpotLight(0xf9e9c4, 0, 7, 0.32, 0.6, 1.2);
  private bell: THREE.Object3D | null = null;
  private bellT = 0;
  private disposables: (() => void)[] = [];
  private time = 0;
  private snowT = 0;
  private moteT = 0;
  private curtsy = 0;
  private idleT = 4;
  private lookT = 0;
  private enter = 0;
  private cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(0, 1.5, -0.9) };
  private w = 1; private h = 1;
  private ray = new THREE.Raycaster();
  private downAt: { x: number; y: number; t: number } | null = null;
  private dealKey = '';
  private dealToken = 0;
  private dead = false;

  constructor(deals: DisplayItem[] = []) {
    const S = this.scene;
    S.background = new THREE.Color(P.night);
    S.fog = new THREE.Fog(P.night, 14, 40);

    // light: lamp-warm key from the front left, a cool fill from the window, lanterns and the stove
    S.add(new THREE.HemisphereLight(0xdcd6c6, 0x3d3229, 0.78));
    const key = new THREE.DirectionalLight(0xf6e2b4, 1.05);
    key.position.set(-3.5, 6.5, 6); key.target.position.set(0.4, 0.8, -1.2);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -5.5; sc.right = 5.5; sc.top = 5; sc.bottom = -3; sc.near = 1; sc.far = 20;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
    S.add(key, key.target);
    const moon = new THREE.DirectionalLight(0xaec8cc, 0.55);
    moon.position.set(0.6, 4, -8); moon.target.position.set(0, 1, 0);
    S.add(moon, moon.target);
    const winFill = new THREE.PointLight(0xaec8cc, 2.2, 5, 1.6);
    winFill.position.set(0, 2.2, -2.5);
    S.add(winFill);
    this.stoveLight.position.set(3.35, 0.7, -1.0);
    S.add(this.stoveLight);
    for (const x of [-1.42, 1.42]) {
      const l = new THREE.PointLight(0xf4dca6, 3.2, 5.5, 1.5);
      l.position.set(x, 2.85, -0.45);
      S.add(l);
      this.lanternLights.push(l);
    }
    this.focusLight.position.set(0, 4.1, 1.2);
    S.add(this.focusLight, this.focusLight.target);

    // Queen Neve on a little step behind her counter
    this.queen = new OwlActor(QUEEN_LOOK, { fx: (k, at, n) => this.owlFx(k, at, n), sound: (id) => sceneSound('owl_' + id) });
    this.queen.node.scale.setScalar(1.08);
    this.queen.setMood('happy');
    this.queenRig.position.set(0.1, 0.3, -1.6);
    this.queenRig.add(this.queen.node);
    S.add(this.queenRig);
    S.add(this.fx.group);
    this.fx.setLight(new THREE.Color(0xf4ecd8));

    this.buildWindow();
    this.buildBulbs();
    SPOTS.forEach((d, i) => this.stands.push(this.makeStand(i, d)));
    this.ready = this.loadProps();
    this.setDeals(deals);
    for (let i = 0; i < 30; i++) this.queen.update(1 / 30);
  }

  // ---------------------------------------------------------------- building the shop

  private async loadProps() {
    await Promise.all(PROPS.map(async (p) => {
      let o: THREE.Object3D;
      try { o = await shopModel(p.id); } catch (e) { console.warn('shop model missing', p.id, e); return; }
      if (this.dead) return;
      const g = new THREE.Group();
      g.add(o);
      g.position.set(...p.at);
      g.rotation.y = p.yaw ?? 0;
      g.scale.set((p.mirror ? -1 : 1) * (p.scale ?? 1), p.scale ?? 1, p.scale ?? 1);
      if (p.id === 'room') o.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.castShadow = false; });
      if (p.id === 'lantern') { g.userData.phase = this.lanterns.length * 1.7; this.lanterns.push(g); }
      if (p.id === 'counter') this.bell = named(o, 'bell_dome');
      o.traverse((n) => { const m = n.userData.glow as THREE.MeshStandardMaterial | undefined; if (m) { this.glows.push(m); this.disposables.push(() => m.dispose()); } });
      if (p.id === 'case') this.addCaseGlass(g);
      this.scene.add(g);
    }));
  }

  private addCaseGlass(g: THREE.Group) {
    const tex = glassTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const geo = new THREE.BoxGeometry(22 * U * 0.98, 6 * U, 9 * U * 0.96);
    const glass = new THREE.Mesh(geo, mat);
    glass.position.set(0, 13 * U, 0);
    glass.renderOrder = 3;
    g.add(glass);
    this.disposables.push(() => { tex.dispose(); mat.dispose(); geo.dispose(); });
  }

  private buildWindow() {
    const out = outdoorTexture();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.3), new THREE.MeshBasicMaterial({ map: out, fog: false }));
    bg.position.set(0, 2.05, WIN.glass - 0.95);
    this.scene.add(bg);
    const fr = frostTexture([0, 1 / 3, 2 / 3, 1], [0, 0.38, 1]);
    const frost = new THREE.Mesh(new THREE.PlaneGeometry(2 * WIN.x, WIN.y1 - WIN.y0), new THREE.MeshBasicMaterial({ map: fr, transparent: true, depthWrite: false }));
    frost.position.set(0, (WIN.y0 + WIN.y1) / 2, WIN.glass + 0.05);
    frost.renderOrder = 2;
    this.scene.add(frost);
    this.disposables.push(() => { out.dispose(); fr.dispose(); bg.geometry.dispose(); (bg.material as THREE.Material).dispose(); frost.geometry.dispose(); (frost.material as THREE.Material).dispose(); });
  }

  /** fairy lights strung along the pelmet and over both shelf units */
  private buildBulbs() {
    const bt = bulbTexture(), ht = haloTexture();
    const cols = [P.lamp, P.honey, P.rose, P.sageLight, P.ice, P.blush];
    const wire = new THREE.LineBasicMaterial({ color: P.ink2 });
    this.disposables.push(() => { bt.dispose(); ht.dispose(); wire.dispose(); });
    const string = (x0: number, x1: number, y: number, z: number, hooks: number, sag: number, n: number) => {
      const pts: THREE.Vector3[] = [];
      const at = (t: number) => { const seg = t * hooks, f = seg - Math.floor(seg); return new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(f * Math.PI) * sag, z); };
      for (let i = 0; i <= 60; i++) pts.push(at(i / 60));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, wire);
      this.scene.add(line);
      this.disposables.push(() => geo.dispose());
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, p = at(t);
        const c = new THREE.Color(cols[(i * 7 + Math.round(x0 * 3)) % cols.length]);
        const sm = new THREE.SpriteMaterial({ map: bt, color: c, fog: false });
        const s = new THREE.Sprite(sm);
        s.scale.set(0.055, 0.07, 1);
        s.position.copy(p).add(new THREE.Vector3(0, -0.035, 0.01));
        const hm = new THREE.SpriteMaterial({ map: ht, color: c, transparent: true, opacity: 0.8, depthWrite: false, fog: false });
        const h = new THREE.Sprite(hm);
        h.scale.setScalar(0.2);
        h.position.copy(s.position);
        h.renderOrder = 4;
        this.scene.add(s, h);
        this.bulbs.push({ s, h, c, phase: i * 0.9 + x0 });
        this.disposables.push(() => { sm.dispose(); hm.dispose(); });
      }
    };
    string(-1.62, 1.62, 3.24, -2.6, 4, 0.12, 22);
    string(-3.56, -1.56, 3.02, -2.2, 3, 0.1, 13);
    string(1.56, 3.56, 3.02, -2.2, 3, 0.1, 13);
  }

  private makeStand(i: number, d: SpotDef): Stand {
    const group = new THREE.Group();
    group.position.set(d.x, d.y, d.z);
    const base = new THREE.Group(), holder = new THREE.Group();
    group.add(base, holder);
    // a stepped pixel pool of light on the floor (or the counter) under the display
    const pt = poolTexture();
    const pm = new THREE.MeshBasicMaterial({ map: pt, color: P.lamp, transparent: true, opacity: 0, depthWrite: false });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(d.floor ? 1.5 : 0.7, d.floor ? 1.5 : 0.7), pm);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.012;
    pool.renderOrder = 1;
    group.add(pool);
    const hh = d.floor ? 1.9 : 0.85;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(d.floor ? 1.25 : 0.75, hh, d.floor ? 1.1 : 0.6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = hh / 2;
    hit.userData.stand = i;
    group.add(hit);
    this.disposables.push(() => { pt.dispose(); pm.dispose(); pool.geometry.dispose(); hit.geometry.dispose(); (hit.material as THREE.Material).dispose(); });
    this.scene.add(group);
    return { def: d, group, base, holder, top: 0, model: null, owl: null, pool, hit, focus: 0, bounce: 0, sold: false };
  }

  /** Put today's deals on display (unknown ids show a wrapped mystery parcel). */
  setDeals(deals: DisplayItem[]) {
    const key = deals.map((d) => d.kind + ':' + d.id).join('|');
    if (key === this.dealKey) return;
    this.dealKey = key;
    const token = ++this.dealToken;
    this.stands.forEach((s, i) => {
      this.clearStand(s);
      const d = deals[i];
      if (d) void this.dress(s, d, token);
    });
  }

  private clearStand(s: Stand) {
    for (const g of [s.base, s.holder]) for (const c of [...g.children]) { g.remove(c); c.userData.dispose?.(); }
    if (s.owl) { s.owl.model.dispose(); s.owl = null; }
    s.model = null;
  }

  private async dress(s: Stand, d: DisplayItem, token: number) {
    const floor = s.def.floor;
    try {
      if (d.kind === 'piece' && PIECE[d.id]) {
        // a dress form wearing the piece, on its own stand
        const g = await dressedForm(d.id);
        if (token !== this.dealToken || this.dead) return;
        fit(g, floor ? 1.0 : 0.5, floor ? 1.72 : 0.62, floor ? 1.0 : 0.5);
        if (!floor) { const r = await shopModel('riser'); if (token !== this.dealToken) return; s.base.add(r); s.top = 4.6 * U; }
        else s.top = 0;
        s.holder.add(g);
        s.model = g;
        return;
      }
      // everything else stands on a plinth (floor) or the riser (counter)
      const plinth = await shopModel(floor ? 'pedestal' : 'riser');
      if (token !== this.dealToken || this.dead) return;
      s.base.add(plinth);
      s.top = floor ? 12.2 * U : 4.6 * U;
      if (d.kind === 'species' || d.kind === 'skin') {
        const look: OwlLook = d.kind === 'species' ? { skin: 'owl', species: d.id, palette: d.id, outfit: {} } : { skin: d.id, species: 'snowy', palette: 'snowy', outfit: {} };
        const owl = new OwlActor(look, {});
        owl.setMood('happy');
        const g = new THREE.Group();
        g.add(owl.node);
        for (let k = 0; k < 20; k++) owl.update(1 / 30);
        fit(g, floor ? 0.95 : 0.5, floor ? 1.05 : 0.55, floor ? 0.95 : 0.5);
        s.holder.add(g);
        s.owl = owl; s.model = g;
        return;
      }
      let m = d.kind === 'item' ? await itemModel(d.id) : null;
      if (token !== this.dealToken || this.dead) { m?.userData.dispose?.(); return; }
      if (!m) m = boxMesh(parcelBoxes());
      fit(m, floor ? 1.05 : 0.5, floor ? 1.0 : 0.5, floor ? 0.95 : 0.45);
      s.holder.add(m);
      s.model = m;
    } catch (e) { console.warn('display failed', d, e); }
  }

  /** Dim a display whose deal is sold. */
  setSold(i: number, sold: boolean) { const s = this.stands[i]; if (s) s.sold = sold; }

  // ---------------------------------------------------------------- the queen's moments

  /** She waves hello (call when the shop opens). */
  greet() { this.enter = 0; setTimeout(() => { this.queen.play('wave'); this.queen.setMood('joy', 1.6); }, 700); }
  /** She turns and presents a display; it lights up and bounces. */
  present(i: number) {
    const s = this.stands[i];
    if (!s) return;
    this.stands.forEach((x, k) => (x.focus = k === i ? 1 : 0));
    s.bounce = 1;
    const p = this.standTop(s);
    this.queen.lookAt = p.clone().add(new THREE.Vector3(0, 0.3, 0));
    this.lookT = 3.2;
    this.queen.play('present');
    this.fx.burst('sparkle', p.x, p.y + 0.4, p.z, 12);
  }
  clearFocus() { this.stands.forEach((x) => (x.focus = 0)); }
  /** A purchase: a curtsy, the bell dings, sparkles rain on the display. */
  celebrate(i?: number) {
    this.curtsy = 1;
    this.bellT = 1;
    this.queen.setMood('love', 2.2);
    setTimeout(() => this.queen.play('flap'), 650);
    const h = this.queen.headWorld;
    this.fx.burst('hearts', h.x, h.y + 0.1, h.z, 4);
    this.sparkleRain(h.x, h.y + 0.4, h.z, 16);
    if (i !== undefined && this.stands[i]) { const s = this.stands[i], p = this.standTop(s); s.bounce = 1; this.fx.burst('stars', p.x, p.y + 0.5, p.z, 12); this.sparkleRain(p.x, p.y + 1.0, p.z, 14); }
  }
  /** Any reaction by name (for lines that come with a gesture). */
  react(a: OwlAction, mood?: OwlMood) { this.queen.play(a); if (mood) this.queen.setMood(mood, 2); }
  /** Screen point (CSS px) above the queen's head, for her speech bubble. */
  queenScreen(): { x: number; y: number } {
    const p = this.queen.headWorld.clone().add(new THREE.Vector3(0, 0.5, 0)).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  standScreen(i: number): { x: number; y: number } {
    const p = this.standTop(this.stands[i]).add(new THREE.Vector3(0, 0.5, 0)).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  private standTop(s: Stand) { return s.group.position.clone().add(new THREE.Vector3(0, s.top + (s.def.floor ? 0.5 : 0.2), 0)); }

  private sparkleRain(x: number, y: number, z: number, n: number) {
    for (let k = 0; k < n; k++) this.fx.emit({ x: x + (Math.random() - 0.5) * 1.4, y: y + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.4, life: 1 + Math.random() * 0.8, frame: SPR.spark1, frames: 3, fps: 8, color: k % 3 ? P.frost : P.lamp, size: 0.16 + Math.random() * 0.12, add: true, delay: k * 0.03, flutter: 0.3 });
  }
  private owlFx(k: OwlFx, at: THREE.Vector3, n = 4) {
    if (k === 'heart') this.fx.burst('hearts', at.x, at.y, at.z, n);
    else if (k === 'note') this.fx.burst('notes', at.x, at.y, at.z, n);
    else if (k === 'sparkle') this.fx.burst('sparkle', at.x, at.y, at.z, n);
    else if (k === 'feather') for (let i = 0; i < n; i++) this.fx.emit({ x: at.x, y: at.y, z: at.z + 0.2, vx: (Math.random() - 0.5) * 1.2, vy: 0.4 + Math.random() * 0.6, vz: Math.random() * 0.5, life: 1.6, frame: SPR.feather1, frames: 3, fps: 4, color: P.snow, size: 0.24, gravity: 0.6, drag: 1.5, flutter: 0.4 });
  }

  // ---------------------------------------------------------------- framing

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const side = w >= h * 1.05 && w >= 640;
    this.layout = side ? 'side' : 'top';
    const c = this.camera;
    // a natural lens across the part of the screen the shop shows in (the UI covers the rest), with the
    // camera's axis on the shop's centre: an off-centre window into a wider frustum
    const th = Math.tan(THREE.MathUtils.degToRad((side ? 50 : 54) / 2));
    if (side) {
      const fx = Math.min(0.75, 0.5 + Math.max(0.2, Math.min(0.25, 470 / w)));
      const dx = (fx - 0.5) * w, fullW = w + 2 * dx, free = 2 * (1 - fx) * w;
      c.aspect = fullW / h;
      c.setViewOffset(fullW, h, 0, 0, w, h);
      c.fov = THREE.MathUtils.radToDeg(2 * Math.atan((th * fullW) / free / c.aspect));
      this.focus = { x: fx, y: 0.5 };
      this.place(6.3 / (2 * th), 0.12, 1.68);
    } else {
      // portrait: the boutique fills the top of the screen above the shop sheet
      const fy = 0.235, dy = 0.3 * h, fullH = h + 2 * dy, y0 = h / 2 + dy - fy * h;
      c.aspect = w / fullH;
      c.setViewOffset(w, fullH, 0, Math.max(0, Math.min(2 * dy, y0)), w, h);
      c.fov = THREE.MathUtils.radToDeg(2 * Math.atan(th / c.aspect));
      this.focus = { x: 0.5, y: fy };
      this.place(6.0 / (2 * th), 0.08, 1.62);
    }
    c.updateProjectionMatrix();
  }
  private place(dist: number, pitch: number, ty: number) {
    const t = this.cam.target;
    t.set(0, ty, -0.9);
    this.cam.pos.set(t.x, t.y + Math.sin(pitch) * dist, t.z + Math.cos(pitch) * dist);
    this.camera.near = 0.2;
    this.camera.far = dist + 30;
    const f = this.scene.fog as THREE.Fog;
    f.near = dist + 8; f.far = dist + 30;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number, t: number) {
    this.time += dt;
    this.enter = Math.min(1, this.enter + dt * 0.55);
    // camera: a slow drift and a gentle push-in on arrival
    const e = 1 - Math.pow(1 - this.enter, 3);
    const drift = Math.sin(t * 0.13) * 0.12;
    this.camera.position.copy(this.cam.pos).add(new THREE.Vector3(drift, (1 - e) * 0.5, (1 - e) * 1.8));
    this.camera.lookAt(this.cam.target.x + drift * 0.4, this.cam.target.y, this.cam.target.z);

    // lanterns sway on their chains, their light breathes; the stove flickers
    for (const l of this.lanterns) { const ph = l.userData.phase as number; l.rotation.z = Math.sin(t * 0.9 + ph) * 0.025; l.rotation.x = Math.sin(t * 0.7 + ph * 1.3) * 0.02; }
    this.lanternLights.forEach((l, i) => (l.intensity = 3.1 + Math.sin(t * 2.3 + i * 2) * 0.18 + Math.sin(t * 7.1 + i) * 0.08));
    const fl = 0.75 + Math.sin(t * 9.3) * 0.12 + Math.sin(t * 13.7 + 1) * 0.1 + Math.sin(t * 3.1) * 0.08;
    this.stoveLight.intensity = 4 * fl;
    for (const m of this.glows) m.emissiveIntensity = m.userData.flicker ? fl * 1.1 : 0.62 + Math.sin(t * 2.3) * 0.04;
    // fairy lights: a slow chase of brightness along each string
    for (const b of this.bulbs) {
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.6 + b.phase));
      (b.s.material as THREE.SpriteMaterial).color.copy(b.c).multiplyScalar(0.55 + k * 0.6);
      (b.h.material as THREE.SpriteMaterial).opacity = 0.15 + k * 0.55;
    }
    // the bell wobbles after a ding
    if (this.bell) { this.bellT = Math.max(0, this.bellT - dt * 1.6); this.bell.rotation.z = Math.sin(this.time * 38) * 0.18 * this.bellT; this.bell.scale.y = 1 + Math.sin(this.time * 30) * 0.05 * this.bellT; }

    // the queen: idle elegance, a curtsy on purchases, glances at her displays
    if (this.curtsy > 0) {
      this.curtsy = Math.max(0, this.curtsy - dt * 0.9);
      const p = 1 - this.curtsy, dip = Math.sin(Math.min(1, p * 1.4) * Math.PI);
      this.queen.node.position.y = -dip * 0.14;
      this.queen.node.rotation.x = dip * 0.16;
    } else { this.queen.node.position.y = 0; this.queen.node.rotation.x = 0; }
    this.queen.node.rotation.y = Math.sin(t * 0.35) * 0.08;
    if ((this.lookT -= dt) <= 0 && this.queen.lookAt) { this.queen.lookAt = null; this.clearFocus(); }
    if ((this.idleT -= dt) <= 0) {
      this.idleT = 7 + Math.random() * 8;
      const r = Math.random();
      if (r < 0.35) { const s = this.stands[Math.floor(Math.random() * 3)]; this.queen.lookAt = this.standTop(s); this.lookT = 2.4; }
      else if (r < 0.55) this.queen.play('ruffle');
      else if (r < 0.7) this.queen.play('nod');
      else if (r < 0.8) this.queen.setMood('proud', 2.5);
      else { const h = this.queen.headWorld; this.fx.burst('sparkle', h.x, h.y + 0.3, h.z, 6); }
    }
    this.queen.update(dt);

    // displays: a gentle turn, focus light, bounces
    let lit: Stand | null = null;
    for (const s of this.stands) {
      s.bounce = Math.max(0, s.bounce - dt * 1.6);
      const b = Math.sin((1 - s.bounce) * Math.PI * 3) * s.bounce * 0.14;
      s.holder.position.y = s.top + Math.max(0, b);
      if (s.model) s.model.rotation.y = Math.sin(t * 0.4 + s.def.x * 0.7) * (s.owl ? 0.35 : 0.5) + (s.def.floor ? -Math.sign(s.def.x) * 0.25 : 0.2);
      s.owl?.update(dt);
      (s.model?.userData.animate as ((t: number, dt: number) => void) | undefined)?.(t, dt);
      const pm = s.pool.material as THREE.MeshBasicMaterial;
      const want = s.sold ? 0 : s.focus ? 0.95 : 0.4 + Math.sin(t * 1.8 + s.def.x) * 0.08;
      pm.opacity += (want - pm.opacity) * Math.min(1, dt * 4);
      if (s.focus && !s.sold) lit = s;
    }
    const fwant = lit ? 26 : 0;
    this.focusLight.intensity += (fwant - this.focusLight.intensity) * Math.min(1, dt * 4);
    if (lit) { const p = this.standTop(lit); this.focusLight.position.set(p.x * 0.6, 4.1, p.z + 1.6); this.focusLight.target.position.copy(p); }

    // snow falling past the window, and a few warm motes drifting in the lamp light
    this.snowT -= dt;
    while (this.snowT <= 0) {
      this.snowT += 0.05;
      this.fx.emit({ x: (Math.random() - 0.5) * 3.2, y: 3.4 + Math.random() * 0.2, z: WIN.glass - 0.15 - Math.random() * 0.6, vx: 0.06 + Math.random() * 0.1, vy: -0.32 - Math.random() * 0.2, life: 8, frame: Math.random() < 0.2 ? SPR.flake : SPR.mote, color: P.snow, size: 0.05 + Math.random() * 0.05, flutter: 0.25, fadeIn: 0.4, fadeOut: 0.8 });
    }
    this.moteT -= dt;
    if (this.moteT <= 0) {
      this.moteT = 0.35;
      const x = (Math.random() - 0.5) * 5, y = 1.2 + Math.random() * 2;
      this.fx.emit({ x, y, z: -1.8 + Math.random() * 2.4, vx: (Math.random() - 0.5) * 0.05, vy: 0.02 + Math.random() * 0.04, life: 6, frame: SPR.mote, color: P.lamp, size: 0.03 + Math.random() * 0.02, flutter: 0.15, fadeIn: 1.5, fadeOut: 2 });
    }
    this.fx.update(dt, t);
  }

  // ---------------------------------------------------------------- input

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray, e?: PointerEvent): boolean {
    // event timestamps, not the clock: a slow frame between down and up must not cancel the tap
    const at = e?.timeStamp ?? performance.now();
    if (type === 'down') { this.downAt = { x, y, t: at }; return true; }
    if (type !== 'up' || !this.downAt) return true;
    const d = this.downAt;
    this.downAt = null;
    if (Math.hypot(x - d.x, y - d.y) > 12 || at - d.t > 900) return true;
    this.ray.ray.copy(ray);
    const head = this.queen.headWorld;
    if (ray.distanceToPoint(head) < 0.6) { this.queen.poke(); this.onQueen?.(); return true; }
    const hit = this.ray.intersectObjects(this.stands.map((s) => s.hit), false)[0];
    if (hit) { this.onPick?.(hit.object.userData.stand as number); return true; }
    if (ray.distanceToPoint(this.queen.node.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.1, 0))) < 0.7) { this.queen.poke(); this.onQueen?.(); return true; }
    if (this.bell && ray.distanceToPoint(this.bell.getWorldPosition(new THREE.Vector3())) < 0.18) { this.bellT = 1; sound.play('ui_tap', { volume: 0.5, rate: 1.6 }); }
    return true;
  }

  dispose() {
    this.dead = true;
    for (const s of this.stands) this.clearStand(s);
    this.queen.model.dispose();
    for (const f of this.disposables) f();
  }
}

/** A wrapped parcel for a deal whose model has not arrived yet. */
function parcelBoxes(): BoxSpec[] {
  const paper = (t: Texel) => ((Math.floor(t.x) * 7 + Math.floor(t.y) * 3 + Math.floor(t.z) * 5) % 11 === 0 ? 0x96744f : (Math.floor(t.y) % 4 === 0 ? 0xa3825a : 0xab8a62));
  const ribbon = (t: Texel) => (Math.floor(t.x + t.z) % 3 === 0 ? P.berry : 0xb5797b);
  return [
    box(0, 0, 0, 14, 11, 12, paper), box(0, 0, 0, 3, 11.2, 12.2, ribbon), box(0, 0, 0, 14.2, 11.2, 3, ribbon),
    box(-2.4, 11, 0, 4, 3, 2, ribbon), box(2.4, 11, 0, 4, 3, 2, ribbon),
  ];
}
