// Barnaby's Lodge Store: the beaver's furniture workshop and store inside his lodge, a Stage the app shows instead of
// the forest. Peeled-log walls chinked with river mud, a ceiling of timber beams under a lattice of sticks, worn
// floorboards strewn with sawdust and curled shavings, warm lanterns hung from the beams, a window onto the real forest.
// [shop11] It is a working shop: Barnaby stands at his workbench in front of his tool board and makes furniture while
// you browse (marking out, sawing, planing, chopping a mortise, sanding, blowing the dust off, admiring the stool he
// finished: src/world/stages/beaver.ts, workshop.ts); he stops to greet you, talk and show you things, then goes back
// to work. Timber seasons on the rack, a shaving horse stands by the wall, a chair takes shape in its clamps over the
// day, a cabinet waits for its doors, glue warms on the finishing table, and finished pieces stand on a dais and hang
// on the peg rail with their paper price tags. Everything the shop sells is a real thing in the room:
//   - today's three deals stand on display plinths (paper price tags hang off them in the DOM, shop.tsx);
//   - the acorn stash (a bowl, a sack, a wicker basket, a mountain of acorns) on the floor by the right wall, the moon
//     gem chests on the shelf above;
//   - the free daily gift is a wrapped parcel on the counter, beside the brass scales, the till and a chalk slate;
//   - the weekly series hang as cloth banners on the back wall over the Lucky Barrel, where wishes are made.
// Barnaby stands at the end of his counter. Taps on things call onPick; focus(id) flies the camera to a thing (leaving
// room for its detail card); wish() plays the barrel's big reveal. Lighting: warm lanterns (point lights), a shadowed
// key, the window's daylight or moonlight, an environment map for brass and glass; the app's post chain grades it.
// OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { instanceGLB, loadGLB } from '../../gfx/glb.ts';
import { ITEMS, FINISH } from '../../assets/registry.ts';
import { OwlActor } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { PIECE } from '../../owl/outfits.ts';
import { sound } from '../../audio/sound.ts';
import { Fx, SPR } from '../fx.ts';
import type { Stage } from '../scene.ts';
import type { Look } from '../post.ts';
import { HOUSE, groundY } from '../layout.ts';
import { Beaver, CRAFT, type BeaverClip } from './beaver.ts';
import {
  M, acornHeap, banner, contactShadow, disposeMats, disposeTextures, gem, gemHeap, hangingSign, herbBundle, logGeo, merged, mtx, parcel, sack, scales, taperTube,
  shavings, slate, stump, tex, type Banner, type Sign, type Slate,
} from './lodgekit.ts';
import {
  BOARD, CUT_X, MORTISE, Plank, carcass, chairInProgress, finishingTable, plinth, priceTag, sawdustPatch, shavingHorse, timberRack, toolBoard, workbench,
} from './workshop.ts';
import type { WorkClip } from './beaver.ts';
import { pottedFir, swayPlants, type Plant } from './shopplants.ts';
import { box, buildProp, propMesh } from '../../gfx/box.ts';
import { alagardReady, alagardText } from '../../ui/font.ts'; // [font6]

/** The real world the window looks out on (the app's Scene). */
export interface WorldView {
  scene: THREE.Scene;
  weather?: { vis: { snow: number } };
  sky?: { night: number; hour: number };
  renderView?(camera: THREE.Camera, target: THREE.WebGLRenderTarget): void;
  viewTarget?(w: number, h: number): THREE.WebGLRenderTarget;
}
export interface DisplayItem { kind: 'item' | 'piece' | 'species' | 'skin' | 'finish'; id: string }
export type LodgeLayout = 'side' | 'top';
export type Section = 'home' | 'deals' | 'stash' | 'series';

// ------------------------------------------------------------------ the floor plan (metres; y up, the camera looks toward -z)
const ROOM = { w: 4.6, back: -3.0, front: 7.5, h: 3.75 };
const WIN = { x0: 1.55, x1: 3.35, y0: 1.15, y1: 2.6, glass: -3.32 };
const COUNTER = { x0: 1.95, x1: 4.05, z: -1.28, d: 0.7, h: 0.92 };
/** [shop11] Barnaby at his workbench (the bench is built in his own frame, so it stands where he does) */
const BEAVER = { x: 0.05, z: -1.8, yaw: 0.28, scale: 1.24 };
/** [shop11] the dais of finished furniture, before the counter */
const DAIS = { x: 1.78, z: 0.02 };
const BARREL = { x: -2.72, z: -1.72, h: 1.08, r: 0.44 };
const SHELF = { x: 4.12, z0: -0.55, z1: 1.75, y: 0.92, d: 0.56 };
/** the deal plinths: spread across the floor on a wide screen, gathered in front of the workbench on a tall one */
const STUMPS: Record<LodgeLayout, { x: number; z: number; h: number }[]> = {
  side: [{ x: -2.3, z: 0.25, h: 0.3 }, { x: -1.58, z: 0.55, h: 0.36 }, { x: -0.86, z: 0.25, h: 0.3 }],
  top: [{ x: -0.68, z: 0.5, h: 0.42 }, { x: -0.06, z: 1.12, h: 0.34 }, { x: 0.56, z: 0.5, h: 0.42 }],
};
/** acorn packs on the floor before the shelf (ids from ACORN_PACKS), gem packs on the shelf (GEM_PACKS) */
const ACORN_SPOTS = [{ id: 'handful', z: -0.25 }, { id: 'sack', z: 0.3 }, { id: 'basket', z: 0.88 }, { id: 'mountain', z: 1.5 }];
const GEM_SPOTS = [{ id: 'gems_80', z: -0.3 }, { id: 'gems_420', z: 0.26 }, { id: 'gems_1300', z: 0.86 }, { id: 'gems_2800', z: 1.5 }];
const BANNERS = [{ x: -3.48, w: 1.05 }, { x: -2.0, w: 1.05 }];
const BANNER_TOP = 3.22, BANNER_H = 1.36;

interface Shot { target: THREE.Vector3; yaw: number; pitch: number; dist: number; fov: number; cx: number; cy: number }
interface Spot { id: string; obj: THREE.Object3D; hit: THREE.Object3D; anchor: THREE.Vector3; focus: (l: LodgeLayout) => Shot }
interface Deal { def: { x: number; z: number; h: number }; group: THREE.Group; stump: THREE.Group; holder: THREE.Group; model: THREE.Object3D | null; owl: OwlActor | null; sold: boolean; soldSign: THREE.Object3D | null; bounce: number; item: DisplayItem | null }
interface Lamp { light: THREE.PointLight; flame: THREE.Sprite; halo: THREE.Sprite; base: number; phase: number; swing?: THREE.Object3D }

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** The store's own grade over the app's post chain: warm, rich, a little bloom on the lanterns. */
/** The store's look on the app's post chain (src/world/post.ts): warm and rich, bloom on the lanterns, a tilt-shift
 * depth of field focused on whatever the camera is looking at (set every frame in update). */
const LOOK: Look = { exposure: 1.02, contrast: 1.08, saturation: 1.06, vibrance: 0.2, warm: 0.06, split: 0.45, vignette: 0.3, grain: 0.016, bloom: 0.55, bloomThreshold: 1.1, focus: 6, focusRange: 2.2, blur: 0.4, cold: 0 };

export class Lodge implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
  readonly fx = new Fx(1200);
  readonly beaver = new Beaver();
  readonly ready: Promise<void>;
  layout: LodgeLayout = 'side';
  /** a tap on something in the store (ids: deal:<i>, acorn:<id>, gem:<id>, gift, series:<id>, barrel, beaver, till, scales, slate) */
  onPick: ((id: string) => void) | null = null;
  private spots = new Map<string, Spot>();
  private deals: Deal[] = [];
  private lamps: Lamp[] = [];
  private banners: { id: string; b: Banner; sign: Sign | null }[] = [];
  private signs: Sign[] = [];
  /** boards hung twice, one per layout: on a phone they hang lower and further left, clear of the purse and the Leave sign */
  private boards: { side: THREE.Object3D; top: THREE.Object3D }[] = [];
  private board: Slate | null = null;
  private plants: Plant[] = [];
  private herbs: THREE.Group[] = [];
  private clock: { group: THREE.Group; set(d: Date): void; dispose(): void } | null = null;
  private gift: THREE.Group | null = null;
  private giftOpen = 0;
  private scalesObj: THREE.Group | null = null;
  private barrelParts: { group: THREE.Group; lid: THREE.Object3D; glow: THREE.PointLight; beam: THREE.Mesh; shake: number; open: number; col: THREE.Color } | null = null;
  private prize: { obj: THREE.Object3D; owl: OwlActor | null; t: number } | null = null;
  private world: WorldView | null = null;
  private gl: THREE.WebGLRenderer | null = null;
  private viewCam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 400);
  private viewRT: THREE.WebGLRenderTarget | null = null;
  private outside: THREE.MeshBasicMaterial;
  private viewFrame = 0;
  /** post knobs for the app's chain (read every frame) */
  readonly look: Look = { ...LOOK };
  private hemi = new THREE.HemisphereLight(0xffe4bc, 0x5a3a24, 1.0);
  private key = new THREE.DirectionalLight(0xffd9a0, 1.6);
  private sun = new THREE.SpotLight(0xfff0d0, 0, 9, 0.62, 0.7, 1.2);
  private focusLight = new THREE.SpotLight(0xffe6b8, 0, 6, 0.3, 0.65, 1.4);
  private shafts: THREE.Mesh[] = [];
  private pmrem: THREE.PMREMGenerator | null = null;
  private envTex: THREE.Texture | null = null;
  private disposables: (() => void)[] = [];
  private cur: Shot;
  private from: Shot;
  private to: Shot;
  private camT = 1;
  /** when the current camera move started (wall clock: a slow device still arrives on time) */
  private camStart = 0;
  private camDur = 1;
  private shotName = 'home';
  private section: Section = 'home';
  private w = 1; private h = 1;
  private ray = new THREE.Raycaster();
  private downAt: { x: number; y: number; t: number } | null = null;
  private dealKey = '';
  private dealToken = 0;
  /** resolves when today's deals are on their stumps */
  dealsReady: Promise<unknown> = Promise.resolve();
  private time = 0;
  private moteT = 0;
  private night = 0;
  private dead = false;
  private enterT = 0;
  private lookT = 0;
  private idleT = 6;

  constructor(deals: DisplayItem[] = []) {
    const S = this.scene;
    S.background = new THREE.Color(0x1d140e);
    S.fog = new THREE.Fog(0x2a1c12, 16, 40);
    this.outside = new THREE.MeshBasicMaterial({ map: paintedView(), fog: false });
    this.buildLights();
    this.buildRoom();
    this.buildWindow();
    this.buildCounter();
    this.buildStash();
    this.buildSeries();
    this.buildDecor();
    S.add(this.fx.group);
    this.fx.setLight(new THREE.Color(0xffe8c8));
    // Barnaby at the end of his counter, turned a little toward the deals
    const b = this.beaver.node;
    b.position.set(BEAVER.x, 0, BEAVER.z);
    b.rotation.y = BEAVER.yaw;
    b.scale.setScalar(BEAVER.scale);
    S.add(b);
    b.add(contactShadow(0.9, 0.8, 0.55));
    this.beaver.onEvent = (e) => this.beaverEvent(e);
    this.beaver.onCraft = (clip, kind, data) => this.craftEvent(clip, kind, data);
    this.beaver.working = true;
    this.spot('beaver', b, this.hitBox(0.6, 1.2, 0.5, v3(BEAVER.x, 0.6, BEAVER.z)), v3(BEAVER.x, 1.38, BEAVER.z), (l) => ({ target: v3(BEAVER.x - 0.04, 0.98, BEAVER.z), yaw: -0.22, pitch: 0.05, dist: l === 'side' ? 2.3 : 2.6, fov: 40, cx: l === 'side' ? 0.62 : 0.5, cy: l === 'side' ? 0.5 : 0.42 }));
    this.layout = innerWidth >= innerHeight * 1.05 && innerWidth >= 640 ? 'side' : 'top';
    for (let i = 0; i < 3; i++) this.deals.push(this.makeStump(i));
    this.cur = this.shot('home');
    this.from = { ...this.cur, target: this.cur.target.clone() };
    this.to = { ...this.cur, target: this.cur.target.clone() };
    this.ready = Promise.all([this.beaver.ready, this.loadProps()]).then(() => undefined);
    this.setDeals(deals);
    this.applyLight();
  }

  // ---------------------------------------------------------------- attach to the app

  /** Draw through the app's renderer: the real forest goes in the window, the store's grade goes on the post chain. */
  attach(renderer: THREE.WebGLRenderer, world?: WorldView) {
    this.gl = renderer;
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(renderer);
      const env = new RoomEnvironment();
      this.envTex = this.pmrem.fromScene(env, 0.04).texture;
      this.scene.environment = this.envTex;
      (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.22;
      env.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    }
    if (world && !this.world) {
      this.world = world;
      if (!world.renderView && !world.scene.children.length) { this.applyLight(); return; }
      // look out from the porch of the tree house across the clearing, at a beaver's eye height
      const x = HOUSE.x + 1.5, z = HOUSE.z + 8.5;
      this.viewCam.position.set(x, groundY(x, z) + 1.4, z);
      this.viewCam.lookAt(x + 2, groundY(x, z) + 2.4, z + 12);
      this.viewRT = world.viewTarget ? world.viewTarget(320, 210) : new THREE.WebGLRenderTarget(320, 210, { type: THREE.HalfFloatType });
      this.outside.map = this.viewRT.texture;
      this.outside.color.set(0xffffff);
      this.outside.needsUpdate = true;
      this.disposables.push(() => this.viewRT?.dispose());
    }
    this.applyLight();
  }

  private renderOutside() {
    const w = this.world, rt = this.viewRT;
    if (!w || !rt || this.viewFrame++ % 4 !== 0) return;
    if (w.renderView) { w.renderView(this.viewCam, rt); return; }
    const gl = this.gl;
    if (!gl) return;
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(rt); gl.clear(); gl.render(w.scene, this.viewCam); gl.setRenderTarget(prev);
  }

  // ---------------------------------------------------------------- light

  private buildLights() {
    const S = this.scene;
    S.add(this.hemi);
    const k = this.key;
    k.position.set(-2.6, 6.2, 6.4);
    k.target.position.set(0.4, 0.4, -1.2);
    k.castShadow = true;
    k.shadow.mapSize.set(2048, 2048);
    const sc = k.shadow.camera;
    sc.left = -5.4; sc.right = 5.4; sc.top = 4.6; sc.bottom = -3.2; sc.near = 2; sc.far = 18;
    k.shadow.bias = -0.0004; k.shadow.normalBias = 0.025; k.shadow.radius = 3;
    S.add(k, k.target);
    // daylight (or moonlight) falling through the window into the store
    this.sun.position.set((WIN.x0 + WIN.x1) / 2, 4.6, WIN.glass - 0.4);
    this.sun.target.position.set((WIN.x0 + WIN.x1) / 2 - 0.3, 0, 0.4);
    S.add(this.sun, this.sun.target);
    this.focusLight.position.set(0, 3.3, 1.5);
    S.add(this.focusLight, this.focusLight.target);
  }

  /** Day or night: the window's light, the lanterns' share, the fill. */
  private applyLight() {
    const n = this.world?.sky?.night ?? nightNow();
    this.night = n;
    const L = THREE.MathUtils.lerp;
    this.hemi.intensity = L(0.4, 0.16, n);
    this.hemi.color.setHex(n > 0.5 ? 0x8a9ac8 : 0xdde6f2);
    this.hemi.groundColor.setHex(n > 0.5 ? 0x2a1a12 : 0x4a2e1c);
    this.key.intensity = L(0.62, 0.3, n);
    this.key.color.setHex(n > 0.5 ? 0xffc48a : 0xffe4bc);
    this.sun.intensity = L(34, 14, n);
    this.sun.color.setHex(n > 0.5 ? 0x8fa8e8 : 0xeef4ff);
    for (const s of this.shafts) (s.material as THREE.MeshBasicMaterial).color.setHex(n > 0.5 ? 0x1c3058 : 0x6c6450);
    for (const l of this.lamps) l.base = L(4.6, 6.2, n);
    if (!this.viewRT) this.outside.color.setHex(n > 0.5 ? 0x3a4a78 : 0xffffff);
  }

  // ---------------------------------------------------------------- the room

  private add<T extends THREE.Object3D>(o: T): T { this.scene.add(o); return o; }
  private track(g: THREE.BufferGeometry) { this.disposables.push(() => g.dispose()); return g; }

  private buildRoom() {
    const R = ROOM;
    // floorboards
    const fg = this.track(new THREE.PlaneGeometry(2 * R.w + 0.4, R.front - R.back + 0.4));
    const uv = fg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (2 * R.w + 0.4) / 2, uv.getY(i) * (R.front - R.back + 0.4) / 2);
    const floor = new THREE.Mesh(fg, M.floor());
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, (R.front + R.back) / 2);
    floor.receiveShadow = true;
    this.add(floor);
    // the back wall: peeled logs stacked on mud chinking, cut round the window
    const step = 0.318, r = 0.155;
    const back: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    let row = 0;
    for (let y = r - 0.02; y < R.h + r; y += step, row++) {
      const z = R.back - 0.02;
      const inWin = y + r * 0.6 > WIN.y0 && y - r * 0.6 < WIN.y1;
      const segs: [number, number][] = inWin ? [[-R.w - 0.3, WIN.x0 - 0.06], [WIN.x1 + 0.06, R.w + 0.3]] : [[-R.w - 0.3, R.w + 0.3]];
      for (const [a, b] of segs) back.push({ geo: logGeo(b - a, r, row * 7 + Math.round(a * 3) + 11), m: mtx((a + b) / 2, y, z) });
    }
    this.add(this.meshOf(merged(back), M.log()));
    // side walls: the logs cross the back wall's at the corners (alternate courses)
    for (const sx of [-1, 1]) {
      const side: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
      row = 0;
      for (let y = r - 0.02 + step / 2; y < R.h + r; y += step, row++) {
        const len = R.front - R.back + 0.35;
        side.push({ geo: logGeo(len, r, row * 5 + (sx > 0 ? 3 : 1)), m: mtx(sx * (R.w + 0.02), y, (R.front + R.back) / 2 - 0.17, Math.PI / 2) });
      }
      this.add(this.meshOf(merged(side), M.log()));
      // mud chinking behind the logs
      const cg = this.track(new THREE.PlaneGeometry(R.front - R.back, R.h + 0.3));
      const cu = cg.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < cu.count; i++) cu.setXY(i, cu.getX(i) * (R.front - R.back), cu.getY(i) * (R.h + 0.3));
      const ch = new THREE.Mesh(cg, M.chink());
      ch.position.set(sx * (R.w + 0.02 - r * 0.5), (R.h + 0.3) / 2, (R.front + R.back) / 2);
      ch.rotation.y = -sx * Math.PI / 2;
      ch.receiveShadow = true;
      this.add(ch);
    }
    const cg = this.track(new THREE.PlaneGeometry(2 * R.w, R.h + 0.3));
    const cu = cg.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < cu.count; i++) cu.setXY(i, cu.getX(i) * 2 * R.w, cu.getY(i) * (R.h + 0.3));
    const chink = new THREE.Mesh(cg, M.chink());
    chink.position.set(0, (R.h + 0.3) / 2, R.back - 0.02 + r * 0.45);
    chink.receiveShadow = true;
    // (cut out where the window is: two side pieces and the strips above and below)
    chink.visible = false;
    const strips: [number, number, number, number][] = [[-R.w, WIN.x0, 0, R.h + 0.3], [WIN.x1, R.w, 0, R.h + 0.3], [WIN.x0, WIN.x1, 0, WIN.y0], [WIN.x0, WIN.x1, WIN.y1, R.h + 0.3]];
    for (const [x0, x1, y0, y1] of strips) {
      const g = this.track(new THREE.PlaneGeometry(x1 - x0, y1 - y0));
      const u = g.attributes.uv as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < u.count; i++) u.setXY(i, p.getX(i) + (x0 + x1) / 2, p.getY(i) + (y0 + y1) / 2);
      const m = new THREE.Mesh(g, M.chink());
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, R.back - 0.02 + r * 0.45);
      m.receiveShadow = true;
      this.add(m);
    }
    // the ceiling: big timber beams across, a lattice of barked sticks laid over them
    const beams: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    for (const [k, z] of [-2.35, -0.75, 0.85, 2.45, 4.05].entries()) beams.push({ geo: logGeo(2 * R.w + 0.4, 0.15, 40 + k), m: mtx(0, R.h - 0.18, z) });
    this.add(this.meshOf(merged(beams), M.log()));
    const sticks: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    const rr = mulberry(5);
    for (let x = -R.w; x <= R.w; x += 0.085) {
      const rad = 0.026 + rr() * 0.018;
      sticks.push({ geo: logGeo(R.front - R.back, rad, Math.floor(rr() * 999), 6), m: mtx(x + (rr() - 0.5) * 0.03, R.h + rad - 0.02 + (rr() - 0.5) * 0.02, (R.front + R.back) / 2, Math.PI / 2 + (rr() - 0.5) * 0.02) });
    }
    const st = this.meshOf(merged(sticks), M.barkLog());
    st.castShadow = false;
    this.add(st);
    // a dark mud roof over the sticks (no light leaks)
    const roof = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2 * R.w + 1, R.front - R.back + 1)), new THREE.MeshBasicMaterial({ color: 0x140d08 }));
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, R.h + 0.08, (R.front + R.back) / 2);
    this.add(roof);
    // wood shavings: by the counter, round the stumps, under the tool wall, by the barrel
    this.add(shavings([{ x: -4.05, z: -0.85, r: 0.42, n: 22 }, { x: -3.7, z: -0.25, r: 0.28, n: 9 }, { x: 0.15, z: -2.25, r: 0.3, n: 8 }]));
  }

  private meshOf(g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh {
    const o = new THREE.Mesh(g, m);
    o.castShadow = true; o.receiveShadow = true;
    this.track(g);
    return o;
  }

  /** the window: a timber frame with a cross of glazing bars, a sill, and the real forest outside */
  private buildWindow() {
    const W = WIN, z = ROOM.back;
    const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    const bx = (sx: number, sy: number, sz: number, x: number, y: number, zz: number) => parts.push({ geo: new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(sx, sy, sz) * 0.22), m: mtx(x, y, zz) });
    const cx = (W.x0 + W.x1) / 2, cy = (W.y0 + W.y1) / 2, dep = z - W.glass + 0.12;
    bx(0.12, W.y1 - W.y0 + 0.24, dep, W.x0 - 0.06, cy, z - dep / 2 + 0.12);
    bx(0.12, W.y1 - W.y0 + 0.24, dep, W.x1 + 0.06, cy, z - dep / 2 + 0.12);
    bx(W.x1 - W.x0 + 0.36, 0.14, dep, cx, W.y1 + 0.07, z - dep / 2 + 0.12);
    bx(W.x1 - W.x0 + 0.5, 0.09, dep + 0.16, cx, W.y0 - 0.045, z - dep / 2 + 0.2);
    // sash and glazing bars
    bx(W.x1 - W.x0, 0.06, 0.05, cx, W.y1 - 0.03, W.glass + 0.03);
    bx(W.x1 - W.x0, 0.06, 0.05, cx, W.y0 + 0.03, W.glass + 0.03);
    bx(0.05, W.y1 - W.y0, 0.05, cx, cy, W.glass + 0.03);
    bx(W.x1 - W.x0, 0.045, 0.045, cx, cy + 0.1, W.glass + 0.03);
    const frame = this.meshOf(merged(parts), M.board());
    this.add(frame);
    // outside: the world (a live render), a painted daylight colour until it's attached
    const bg = new THREE.Mesh(this.track(new THREE.PlaneGeometry(3.6, 2.4)), this.outside);
    bg.position.set(cx, cy + 0.15, W.glass - 0.9);
    this.add(bg);
    // light shafts slanting in through the glass, faint
    for (const [k, off] of [[0, -0.5], [1, 0.25], [2, 0.8]] as const) {
      const g = this.track(new THREE.PlaneGeometry(0.42 + k * 0.08, 3.4));
      g.translate(0, -1.7, 0);
      const m = new THREE.MeshBasicMaterial({ color: 0x6a5a3a, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, map: shaftTexture(), fog: false });
      this.disposables.push(() => m.dispose());
      const s = new THREE.Mesh(g, m);
      s.position.set(cx + off, W.y1 - 0.05, W.glass + 0.15);
      s.rotation.set(-0.62, 0, 0.04 * k);
      s.renderOrder = 5;
      this.add(s);
      this.shafts.push(s);
    }
  }

  /** the counter: a thick plank top on a front of split logs, with its goods */
  private buildCounter() {
    const C = COUNTER;
    const len = C.x1 - C.x0, cx = (C.x0 + C.x1) / 2;
    const fronts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    // vertical half logs along the front and the two ends
    const n = Math.round(len / 0.24);
    for (let i = 0; i < n; i++) {
      const g = logGeo(C.h - 0.06, 0.13, 70 + i, 10);
      g.rotateZ(Math.PI / 2);
      fronts.push({ geo: g, m: mtx(C.x0 + 0.12 + i * (len - 0.24) / (n - 1), (C.h - 0.06) / 2, C.z + C.d / 2 - 0.1) });
    }
    for (const x of [C.x0 + 0.1, C.x1 - 0.1]) for (const dz of [-0.14, 0.08]) {
      const g = logGeo(C.h - 0.06, 0.12, 90 + Math.round(x * 10 + dz * 10), 10);
      g.rotateZ(Math.PI / 2);
      fronts.push({ geo: g, m: mtx(x, (C.h - 0.06) / 2, C.z + dz) });
    }
    this.add(this.meshOf(merged(fronts), M.log()));
    const topG = this.track(new RoundedBoxGeometry(len + 0.16, 0.07, C.d + 0.1, 3, 0.02));
    const tu = topG.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < tu.count; i++) tu.setXY(i, tu.getX(i) * (len / 2), tu.getY(i) * 0.4);
    const top = new THREE.Mesh(topG, M.board());
    top.position.set(cx, C.h - 0.035, C.z);
    top.castShadow = top.receiveShadow = true;
    this.add(top);
    this.add(contactShadow(len + 0.6, C.d + 0.5, 0.6)).position.set(cx, 0.004, C.z);
    // brass scales and the gift parcel on top
    const sc = scales();
    sc.position.set(cx + 0.18, C.h, C.z - 0.05);
    sc.rotation.y = -0.2;
    this.add(sc);
    this.scalesObj = sc;
    this.spot('scales', sc, this.hitBox(0.4, 0.45, 0.25, v3(cx + 0.18, C.h + 0.22, C.z)), v3(cx + 0.18, C.h + 0.45, C.z));
    const gift = parcel(0.3);
    gift.position.set(C.x0 + 0.3, C.h, C.z + 0.12);
    gift.rotation.y = 0.35;
    this.add(gift);
    this.gift = gift;
    this.spot('gift', gift, this.hitBox(0.36, 0.34, 0.36, v3(C.x0 + 0.3, C.h + 0.16, C.z + 0.12)), v3(C.x0 + 0.3, C.h + 0.36, C.z + 0.12),
      (l) => ({ target: v3(C.x0 - 0.18, C.h + (l === 'side' ? 0.02 : 0.12), C.z + 0.25), yaw: 0.62, pitch: 0.2, dist: l === 'side' ? 2.7 : 3.7, fov: 42, cx: l === 'side' ? 0.66 : 0.5, cy: l === 'side' ? 0.5 : 0.3 }));
    // the chalk slate leaning on the counter front: today's deals and when they change
    const sl = slate(0.62, 0.44);
    sl.group.position.set(C.x1 - 0.55, 0.3, C.z + C.d / 2 + 0.06);
    sl.group.rotation.x = -0.16;
    this.add(sl.group);
    this.board = sl;
    this.disposables.push(() => sl.dispose());
    this.spot('slate', sl.group, this.hitBox(0.62, 0.5, 0.1, v3(C.x1 - 0.55, 0.3, C.z + C.d / 2 + 0.06)), v3(C.x1 - 0.55, 0.56, C.z + C.d / 2 + 0.06));
    // the shop's name, carved and hung from the beam over the counter
    const nm = hangingSign(1.7, 0.4, "Barnaby's Lodge Store", 'general goods · est. under the old willow', 0.42, 3);
    nm.group.position.set((WIN.x0 + WIN.x1) / 2, 3.02, ROOM.back + 0.42);
    this.add(nm.group);
    this.signs.push(nm);
    const nm2 = hangingSign(1.7, 0.4, "Barnaby's Lodge Store", 'general goods · est. under the old willow', 0.8, 3);
    nm2.group.position.set((WIN.x0 + WIN.x1) / 2 - 0.76, 2.64, ROOM.back + 0.42);
    this.add(nm2.group);
    this.signs.push(nm2);
    this.boards.push({ side: nm.group, top: nm2.group });
  }

  /** the stash: a log-and-plank shelf on the right wall, acorns heaped on the floor before it, gem chests on top */
  private buildStash() {
    const S = SHELF, len = S.z1 - S.z0, cz = (S.z0 + S.z1) / 2;
    const parts: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    // two plank shelves on short log legs
    for (const y of [0.42, S.y]) {
      const b = new RoundedBoxGeometry(S.d, 0.05, len, 2, 0.012);
      const u = b.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * len * 0.5, u.getY(i) * 0.3 + y);
      parts.push({ geo: b, m: mtx(S.x, y - 0.025, cz) });
    }
    this.add(this.meshOf(merged(parts), M.board()));
    const legs: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    for (const z of [S.z0 + 0.06, cz, S.z1 - 0.06]) for (const dx of [-S.d / 2 + 0.06, S.d / 2 - 0.06]) {
      const g = logGeo(S.y - 0.05, 0.045, Math.round(z * 31 + dx * 7), 8);
      g.rotateZ(Math.PI / 2);
      legs.push({ geo: g, m: mtx(S.x + dx, (S.y - 0.05) / 2, z) });
    }
    this.add(this.meshOf(merged(legs), M.log()));
    this.add(contactShadow(S.d + 0.4, len + 0.4, 0.5)).position.set(S.x, 0.004, cz);
    const sign = hangingSign(1.1, 0.3, 'Acorns & Moon Gems', '', 0.9, 5);
    sign.group.position.set(S.x + 0.05, 2.35, cz);
    sign.group.rotation.y = -Math.PI / 2;
    this.add(sign.group);
    this.signs.push(sign);
    const sign2 = hangingSign(1.1, 0.3, 'Acorns & Moon Gems', '', 1.3, 5);
    sign2.group.position.set(S.x + 0.05, 1.95, cz - 0.6);
    sign2.group.rotation.y = -Math.PI / 2;
    this.add(sign2.group);
    this.signs.push(sign2);
    this.boards.push({ side: sign.group, top: sign2.group });
    // acorn packs (on the floor, in front of the shelf, growing toward the front of the store)
    const AX = S.x - 0.5;
    ACORN_SPOTS.forEach((a, i) => {
      let o: THREE.Group;
      if (a.id === 'handful') { o = new THREE.Group(); const heap = acornHeap(18, 0.1, 0.05, 0.026, 21); heap.position.y = 0.1; o.add(heap); o.userData.bowl = true; }
      else if (a.id === 'sack') o = sack(0.42, 0.17, 3, 34);
      else if (a.id === 'basket') { o = new THREE.Group(); const heap = acornHeap(40, 0.15, 0.1, 0.028, 23); heap.position.y = 0.34; o.add(heap); }
      else { o = sack(0.66, 0.27, 7, 60); const spill = acornHeap(40, 0.34, 0.08, 0.03, 29); spill.position.set(-0.2, 0, 0.12); o.add(spill); }
      o.position.set(AX - (i === 3 ? 0.12 : 0), 0, a.z);
      o.rotation.y = -Math.PI / 2 + (i - 1.5) * 0.25;
      this.add(o);
      const sz = [0.3, 0.42, 0.5, 0.8][i];
      this.spot('acorn:' + a.id, o, this.hitBox(sz, sz + 0.05, sz, v3(AX, sz / 2, a.z)), v3(AX - [0.2, 0.24, 0.26, 0.38][i], 0.03, a.z), (l) => this.stashShot(l, a.z, 0.4));
    });
    // gem packs on the shelf: a pouch, a box, a chest, a big chest
    GEM_SPOTS.forEach((g, i) => {
      let o: THREE.Group;
      if (i === 0) { o = new THREE.Group(); const pouch = sack(0.13, 0.06, 41, 0); pouch.scale.set(1, 1, 1); o.add(pouch); const gm = gem(0.05, 0xb9a6ff); gm.position.set(0, 0.16, 0); o.add(gm); }
      else { o = new THREE.Group(); o.userData.chest = { w: [0.3, 0.38, 0.5][i - 1], gems: [8, 13, 20][i - 1], seed: 5 + i }; }
      o.position.set(S.x - 0.03, S.y, g.z);
      o.rotation.y = -Math.PI / 2;
      this.add(o);
      if (i === 3) { const crown = gem(0.07, 0xf4e7ff); crown.position.set(0, 0.36, 0); o.add(crown); o.userData.crown = crown; }
      const sz = [0.2, 0.3, 0.36, 0.48][i];
      this.spot('gem:' + g.id, o, this.hitBox(sz, sz, sz, v3(S.x - 0.03, S.y + sz / 2, g.z)), v3(S.x - S.d / 2 - 0.01, S.y - 0.03, g.z), (l) => this.stashShot(l, g.z, 0.95));
    });
    // a lantern over the stash
    this.lamp(v3(S.x - 0.6, 2.55, cz - 0.1), true);
  }

  private stashShot(l: LodgeLayout, z: number, y: number): Shot {
    return { target: v3(SHELF.x - 0.3, y, z), yaw: -1.2, pitch: 0.42, dist: l === 'side' ? 2.2 : 2.8, fov: 42, cx: l === 'side' ? 0.68 : 0.5, cy: l === 'side' ? 0.5 : 0.3 };
  }

  /** the weekly series: cloth banners on the back wall, the Lucky Barrel before them */
  private buildSeries() {
    // the beam the banners hang from
    const rail = this.meshOf(logGeo(3.4, 0.06, 77), M.log());
    rail.position.set(-2.75, BANNER_TOP + 0.12, ROOM.back + 0.3);
    this.add(rail);
    for (const [k, b] of BANNERS.entries()) {
      const ban = banner(b.w, BANNER_H, k ? 0x8f6db8 : 0xc0383e, k + 1);
      ban.group.position.set(b.x, BANNER_TOP, ROOM.back + 0.3);
      this.add(ban.group);
      this.banners.push({ id: '', b: ban, sign: null });
      this.disposables.push(() => ban.dispose());
    }
    // the Lucky Barrel: a fat oak barrel with brass hoops on a cradle, a crank on its side, light leaking from inside
    const B = BARREL;
    const group = new THREE.Group();
    group.position.set(B.x, 0.12, B.z);
    this.add(group);
    const lid = new THREE.Group();
    // two chocks shaped to the barrel's belly, pegged together
    const chock = new THREE.Shape();
    const cw = B.r * 1.15;
    chock.moveTo(-cw, 0); chock.lineTo(cw, 0); chock.lineTo(cw, 0.13); chock.lineTo(cw * 0.78, 0.15);
    chock.absarc(0, B.r * 1.05 + 0.01, B.r * 1.02, -Math.PI * 0.2, -Math.PI * 0.8, true);
    chock.lineTo(-cw, 0.13); chock.closePath();
    const cradle: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    for (const dz of [-0.26, 0.26]) { const cg = new THREE.ExtrudeGeometry(chock, { depth: 0.08, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 10 }); cg.translate(0, 0, -0.04); cradle.push({ geo: cg, m: mtx(B.x, 0, B.z + dz) }); }
    this.add(this.meshOf(merged(cradle), M.boardDark()));
    // the crank: a turned boss, a forged arm with rounded ends, a turned wooden handle
    const crank = new THREE.Group();
    const boss = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.034, 0], [0.036, 0.012], [0.026, 0.03], [0.02, 0.07], [0.026, 0.08], [0.001, 0.082]].map(([x, y]) => new THREE.Vector2(x, y)), 14), M.brassDark());
    boss.rotation.z = -Math.PI / 2;
    const armShape = new THREE.Shape();
    armShape.absarc(0, 0, 0.026, Math.PI / 2, Math.PI * 1.5, false); armShape.lineTo(0, -0.026); armShape.lineTo(0.0, -0.026);
    armShape.absarc(0, -0.22, 0.02, Math.PI, 0, false); armShape.lineTo(0.02, -0.0); armShape.absarc(0, 0, 0.026, -Math.PI / 2, Math.PI / 2, false);
    const armG = new THREE.ExtrudeGeometry(armShape, { depth: 0.014, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 8 });
    armG.rotateY(Math.PI / 2);
    const arm = new THREE.Mesh(armG, M.brass());
    arm.position.x = 0.08;
    const handle = new THREE.Mesh(new THREE.LatheGeometry([[0.001, 0], [0.014, 0], [0.02, 0.02], [0.024, 0.06], [0.02, 0.1], [0.022, 0.11], [0.001, 0.116]].map(([x, y]) => new THREE.Vector2(x, y)), 12), M.boardDark());
    handle.rotation.z = -Math.PI / 2;
    handle.position.set(0.09, -0.22, 0);
    crank.add(boss, arm, handle);
    crank.position.set(B.x + B.r * 0.98, 0.12 + B.h * 0.55, B.z);
    crank.traverse((n) => { (n as THREE.Mesh).castShadow = true; });
    this.add(crank);
    // the light inside: a warm point light and a beam that shoots up when it opens
    const glow = new THREE.PointLight(0xffd27a, 0.6, 3, 2);
    glow.position.set(B.x, 0.12 + B.h + 0.15, B.z);
    this.add(glow);
    // a brass star nailed to its belly, and the glow leaking round the lid
    const star = new THREE.Shape();
    for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k / 10) * Math.PI * 2, rr = k % 2 ? 0.055 : 0.13; if (k) star.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else star.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    const sg = this.track(new THREE.ExtrudeGeometry(star, { depth: 0.015, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1 }));
    const st = new THREE.Mesh(sg, M.brass());
    st.position.set(B.x, 0.12 + B.h * 0.52, B.z + B.r + 0.004);
    st.castShadow = true;
    this.add(st);
    const leakM = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.disposables.push(() => leakM.dispose());
    const leak = new THREE.Mesh(this.track(new THREE.TorusGeometry(B.r * 0.83, 0.012, 4, 28)), leakM);
    leak.rotation.x = Math.PI / 2;
    leak.position.set(B.x, 0.12 + B.h - 0.02, B.z);
    this.add(leak);
    const beamM = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, map: shaftTexture(true), side: THREE.FrontSide, fog: false });
    const beam = new THREE.Mesh(this.track(new THREE.CylinderGeometry(B.r * 0.62, B.r * 0.5, 3.6, 20, 1, true)), beamM);
    beam.position.set(B.x, 0.12 + B.h + 1.8, B.z);
    beam.renderOrder = 6;
    this.add(beam);
    this.disposables.push(() => beamM.dispose());
    this.barrelParts = { group, lid, glow, beam, shake: 0, open: 0, col: new THREE.Color(0xffd27a) };
    const sign = hangingSign(1.05, 0.3, 'The Lucky Barrel', 'wishes · weekly series', 0.32, 9);
    sign.group.position.set(-2.75, BANNER_TOP + 0.52, ROOM.back + 0.36);
    this.add(sign.group);
    this.signs.push(sign);
    this.spot('barrel', group, this.hitBox(B.r * 2.2, B.h + 0.2, B.r * 2.2, v3(B.x, B.h / 2 + 0.12, B.z)), v3(B.x, B.h + 0.3, B.z), (l) => this.barrelShot(l));
    this.lamp(v3(-4.05, 2.5, -0.55), true);
  }

  private barrelShot(l: LodgeLayout, close = false): Shot {
    const B = BARREL;
    // close: the reveal (the barrel and the prize rising out of it, centred); otherwise the series board is open
    // beside it (desktop: the board on the left) or below it (phone: the barrel and banners in the top third)
    return close
      ? { target: v3(B.x, B.h + 0.62, B.z), yaw: 0.12, pitch: 0.12, dist: l === 'side' ? 3.4 : 4.6, fov: 44, cx: 0.5, cy: l === 'side' ? 0.36 : 0.34 }
      : { target: v3(B.x + 0.15, l === 'side' ? 1.5 : 1.75, B.z - 0.25), yaw: 0.1, pitch: 0.1, dist: l === 'side' ? 4.2 : 5.4, fov: 46, cx: l === 'side' ? 0.7 : 0.5, cy: l === 'side' ? 0.5 : 0.17 };
  }

  /** lanterns, goods, tools, crates and a plant (models from props.glb, placed once it's in) */
  private buildDecor() {
    this.lamp(v3(-1.25, 2.65, 1.45), true);
    this.lamp(v3(2.95, 2.5, -1.25), true);
    this.lamp(v3(0.3, 2.7, -1.3), true);   // [shop11] over the workbench
    // (two barrels of stock come with hero.glb, in loadProps)
    const lean = sack(0.4, 0.16, 11, 22);
    lean.position.set(-3.55, 0, 1.75);
    lean.rotation.set(0, 0.6, 0.08);
    this.add(lean);
    // bundles of herbs drying under the beams
    const beamY = ROOM.h - 0.18 - 0.14;
    for (const [k, [x, z, drop]] of ([[2.95, -0.75, 0.36], [3.3, -0.75, 0.5], [-3.9, -0.75, 0.4], [-3.6, -0.75, 0.3], [-3.25, -0.75, 0.46]] as [number, number, number][]).entries()) {
      const hb = herbBundle(k * 13 + 5, drop);
      hb.position.set(x, beamY - drop, z);
      this.add(hb);
      this.herbs.push(hb);
    }
    const fir = pottedFir(1.5);
    fir.group.position.set(4.12, 0, 1.95);
    this.add(fir.group);
    this.plants.push(fir);
    this.disposables.push(() => fir.dispose());
    this.buildWorkshop();
  }

  // ---------------------------------------------------------------- [shop11] the workshop

  private plank: Plank | null = null;
  private wip: { group: THREE.Group; stage: number } | null = null;
  private benchNode: THREE.Group | null = null;

  /** The furniture maker's half of the store: his workbench and plank (in his own frame), the tool board and the peg
   * rail on the wall behind him, the timber rack, the shaving horse, the finishing table, the cabinet waiting for its
   * doors, the chair taking shape over the day, sawdust and shavings on the floor. */
  private buildWorkshop() {
    const b = this.beaver.node;
    const own = <T extends THREE.Object3D>(o: T): T => { o.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.userData.own = true; }); return o; };
    const bench = own(workbench());
    b.add(bench);
    this.benchNode = bench;
    this.plank = new Plank(b);
    this.disposables.push(() => this.plank?.dispose());
    // the tool board and, above it, the peg rail with finished pieces hung on it
    const tb = toolBoard(2.7, 1.3, 0.95);
    tb.group.position.set(0.05, 0, ROOM.back + 0.15);
    this.add(own(tb.group));
    this.toolSlots = tb.slots;
    const rail: { geo: THREE.BufferGeometry; m: THREE.Matrix4 }[] = [];
    const rg = new RoundedBoxGeometry(3.0, 0.09, 0.03, 2, 0.01);
    rail.push({ geo: rg, m: mtx(0.05, 2.95, ROOM.back + 0.165) });
    for (let k = 0; k < 7; k++) {
      const pg = new THREE.CylinderGeometry(0.012, 0.016, 0.1, 8);
      pg.rotateX(Math.PI / 2);
      rail.push({ geo: pg, m: mtx(-1.25 + k * 0.42, 2.95, ROOM.back + 0.23) });
    }
    this.add(this.meshOf(merged(rail), M.boardDark()));
    // the timber rack along the left wall, a chopping block with the hatchet by it
    const tr = own(timberRack(3.3, 4));
    tr.position.set(-ROOM.w + 0.16, 0, -1.05);
    tr.rotation.y = Math.PI / 2;
    this.add(tr);
    const block = own(stump(0.42, 0.2, 21));
    block.position.set(-3.55, 0, -2.45);
    this.add(block);
    this.chopBlock = block;
    // the shaving horse by the wall
    const sh = own(shavingHorse());
    sh.position.set(-3.3, 0, -0.42);
    sh.rotation.y = 0.32;
    this.add(sh);
    // the finishing table to his left, the carcass to his right, against the back wall
    const ft = own(finishingTable());
    ft.position.set(1.25, 0, ROOM.back + 0.42);
    ft.rotation.y = -0.08;
    this.add(ft);
    const cc = own(carcass());
    cc.position.set(-1.05, 0, ROOM.back + 0.16);
    cc.rotation.y = 0.05;
    this.add(cc);
    // the chair he's making today, a stage for each part of the day
    this.setWip();
    // sawdust and shavings on the floor round the bench, the horse and the rack
    for (const [x, z, r] of [[-0.75, -1.05, 1.1], [0.6, -1.15, 0.9], [-3.2, -0.35, 0.9], [-3.9, -1.6, 0.8], [-1.5, -1.25, 0.7]] as [number, number, number][]) {
      const d = sawdustPatch(r, 0.8);
      d.position.set(x, 0.003, z);
      d.rotation.z = x * 2.3;
      this.add(d);
      this.disposables.push(() => d.geometry.dispose());
    }
    this.add(shavings([{ x: -0.9, z: -0.95, r: 0.45, n: 18 }, { x: 0.5, z: -1.0, r: 0.5, n: 14 }, { x: -3.1, z: -0.3, r: 0.4, n: 14 }, { x: -1.5, z: -1.2, r: 0.3, n: 8 }, { x: -2.2, z: -1.2, r: 0.3, n: 6 }], 13));
    // the dais of finished furniture at the front right (the pieces arrive with the props)
    const dais = this.meshOf(new RoundedBoxGeometry(1.25, 0.1, 0.8, 2, 0.02), M.board());
    dais.position.set(DAIS.x, 0.05, DAIS.z);
    dais.rotation.y = -0.12;
    this.add(dais);
    this.add(contactShadow(1.6, 1.15, 0.5)).position.set(DAIS.x, 0.004, DAIS.z);
  }
  private toolSlots: Record<string, THREE.Vector3> = {};
  private chopBlock: THREE.Group | null = null;

  /** The chair in progress follows the time of day: parts laid out in the morning, glued up in clamps by midday, the
   * seat on, the back going in, finished and oiled by evening. */
  private setWip() {
    const h = new Date().getHours();
    const stage = h < 9 ? 0 : h < 12 ? 1 : h < 15 ? 2 : h < 18 ? 3 : 4;
    if (this.wip?.stage === stage) return;
    if (this.wip) { this.wip.group.removeFromParent(); this.wip.group.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); }
    const g = chairInProgress(stage);
    g.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.userData.own = true; });
    g.position.set(-1.55, 0, -1.35);
    g.rotation.y = 0.5;
    this.scene.add(g);
    this.wip = { group: g, stage };
  }

  /** a craft event from Barnaby's clip: the plank and the room react */
  private craftEvent(clip: WorkClip, kind: string, data: Record<string, number> | undefined) {
    const P = this.plank;
    if (!P) return;
    const fx = this.fx, w = (x: number, y: number, z: number) => P.world(x, y, z);
    const R = (a: number, b: number) => a + Math.random() * (b - a);
    if (kind === 'sawdust') {
      P.sawdust();
      const p = w(CUT_X, BOARD.bottom, (BOARD.near + BOARD.far) / 2);
      for (let i = 0; i < 9; i++) fx.emit({ x: p.x, y: p.y, z: p.z, vx: R(-0.15, 0.15), vy: R(-0.1, 0.25), vz: R(-0.15, 0.2), life: R(0.6, 1.0), frame: SPR.crumb, color: [0xf0d9a8, 0xe2c08a, 0xd2a86c][i % 3], size: R(0.035, 0.055), gravity: 2.2, drag: 1.2, flutter: 0.2, land: true, delay: i * 0.025 });
      sound.play('paper_rustle', { volume: 0.1, rate: 0.62 + Math.random() * 0.1, gap: 150 });
    } else if (kind === 'offcut') {
      P.offcut();
      sound.play('wood_knock', { volume: 0.4, rate: 1.1, gap: 200 });
      setTimeout(() => { if (!this.dead) sound.play('place_wood', { volume: 0.4, rate: 0.95 }); }, 650);
    } else if (kind === 'chop') {
      P.chop(data?.depth ?? 0.005);
      const p = w(MORTISE.x, BOARD.top + 0.01, MORTISE.z);
      sound.play('wood_knock', { volume: 0.35, rate: 1.4 + Math.random() * 0.2, gap: 80 });
      for (let i = 0; i < 6; i++) { const a = Math.random() * Math.PI * 2; fx.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * R(0.2, 0.6), vy: R(0.5, 1.1), vz: Math.sin(a) * R(0.2, 0.6), life: R(0.6, 0.9), frame: SPR.crumb, color: [0xf0d6a0, 0xd8b078][i % 2], size: R(0.05, 0.08), gravity: 5, drag: 0.6, land: true }); }
    } else if (kind === 'dust') {
      const c = this.beaver.craft;
      const x = 0.1 + (c ? 0.075 * Math.sin(((c.t * 24 - 26) / 10) * Math.PI * 2) : 0);
      const p = w(x, BOARD.top + 0.01, (BOARD.near + BOARD.far) / 2);
      for (let i = 0; i < 3; i++) fx.emit({ x: p.x + R(-0.03, 0.03), y: p.y, z: p.z + R(-0.03, 0.03), vx: R(-0.08, 0.08), vy: R(0.06, 0.18), vz: R(0.02, 0.12), life: R(0.9, 1.4), frame: SPR.puff1, frames: 3, fps: 3, color: 0xf3e6c8, size: R(0.06, 0.1), grow: 0.8, drag: 1.5, fadeOut: 0.6, delay: i * 0.05 });
      sound.play('paper_rustle', { volume: 0.06, rate: 1.35, gap: 200 });
    } else if (kind === 'blow') {
      // a cloud of dust blown off the plank toward the front of the bench (it hides a fresh plank going down)
      const h = this.beaver.headWorld();
      const p = w(0, BOARD.top + 0.02, (BOARD.near + BOARD.far) / 2);
      sound.play('wind_gust', { volume: 0.12, rate: 1.4, gap: 300 });
      for (let i = 0; i < 16; i++) fx.emit({ x: p.x + R(-0.35, 0.35), y: p.y + R(0, 0.06), z: p.z + R(-0.05, 0.05), vx: (p.x - h.x) * 0.4 + R(-0.2, 0.2), vy: R(0.1, 0.35), vz: (p.z - h.z) * 1.2 + R(0.2, 0.5), life: R(1.0, 1.6), frame: i % 3 ? SPR.puff1 : SPR.cloud2, frames: i % 3 ? 3 : 1, fps: 3, color: 0xf0e2c2, size: R(0.08, 0.16), grow: 1.4, drag: 1.6, fadeOut: 0.7, delay: i * 0.02 });
      setTimeout(() => { if (!this.dead) P.freshIfShort(); }, 250);
    } else if (kind === 'admire') {
      const p = this.beaver.headWorld();
      fx.burst('sparkle', p.x, p.y - 0.2, p.z + 0.25, 6);
    }
    void clip;
  }

  /** the continuous part of the craft: the plank sliding, the pencil line, the kerf, a shaving growing */
  private craftTick() {
    const P = this.plank, c = this.beaver.craft;
    if (!P || !c) { if (this.growing) { P?.releaseShaving(); this.growing = false; } return; }
    const ev = (kind: string) => CRAFT[c.clip].ev.filter((e) => e[1] === kind);
    const prog = (t0: number, t1: number) => THREE.MathUtils.clamp((c.t - t0) / Math.max(1e-3, t1 - t0), 0, 1);
    const sm = (x: number) => x * x * (3 - 2 * x);
    if (c.clip === 'measure') {
      for (const [t0, , d] of ev('slide')) if (c.t >= t0) P.slide(sm(prog(t0, d!.t1)));
      for (const [t0, , d] of ev('line')) if (c.t >= t0) P.drawLine(sm(prog(t0, d!.t1)));
    } else if (c.clip === 'saw') {
      for (const [t0, , d] of ev('kerf')) if (c.t >= t0 && c.t < d!.t1) P.kerf(Math.min(1, sm(prog(t0, d!.t1)) * 1.23));
    } else if (c.clip === 'plane') {
      let on = false;
      for (const [t0, , d] of ev('stroke')) {
        if (c.t >= t0 && c.t < d!.t1) { const k = prog(t0, d!.t1); P.shaving(d!.x0 + (d!.x1 - d!.x0) * sm(k), k); on = true; }
      }
      if (!on && this.growing) P.releaseShaving();
      if (on && !this.growing) sound.play('box_tape', { volume: 0.1, rate: 0.75, gap: 300 });
      this.growing = on;
    }
  }
  private growing = false;

  private lamp(at: THREE.Vector3, hang: boolean) {
    const light = new THREE.PointLight(0xffc684, 3.0, 7, 1.5);
    light.position.copy(at).add(v3(0, -0.12, 0));
    this.add(light);
    const flame = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff0c0, map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    flame.scale.setScalar(0.12);
    flame.position.copy(light.position);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffb060, map: haloTexture(), blending: THREE.AdditiveBlending, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
    halo.scale.setScalar(0.7);
    halo.position.copy(light.position);
    halo.renderOrder = 7;
    this.add(flame); this.add(halo);
    this.disposables.push(() => { (flame.material as THREE.Material).dispose(); (halo.material as THREE.Material).dispose(); });
    const l: Lamp = { light, flame, halo, base: 2.6, phase: this.lamps.length * 1.9 };
    this.lamps.push(l);
    l.swing = new THREE.Group();
    l.swing.position.copy(at);
    l.swing.userData.hang = hang;
    this.add(l.swing);
  }

  /** Poly Haven's wine barrel, treasure chest and mantel clock (public/models/shop/hero.glb). */
  private async loadHero() {
    let h: THREE.Object3D;
    try { h = (await loadGLB('shop/hero.glb')).scene; } catch (e) { console.warn('lodge hero props missing', e); return; }
    if (this.dead) return;
    const grab = (name: string, height: number) => {
      const src = h.getObjectByName(name);
      if (!src) return null;
      const c = src.clone(true);
      c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.scale.set(1, 1, 1);
      c.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(c, true), k = height / Math.max(1e-3, b.max.y - b.min.y), ctr = b.getCenter(new THREE.Vector3());
      c.scale.setScalar(k);
      c.position.set(-ctr.x * k, -b.min.y * k, -ctr.z * k);
      const w = new THREE.Group();
      w.add(c);
      w.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      return w;
    };
    /** take a part out of a model into a pivot at `hinge` (world), so it can swing about it */
    const pivotOf = (root: THREE.Object3D, name: string, parent: THREE.Object3D, hinge: (b: THREE.Box3) => THREE.Vector3) => {
      const part = root.getObjectByName(name);
      if (!part) return null;
      parent.updateWorldMatrix(true, true);
      root.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(part);
      const pv = new THREE.Group();
      parent.add(pv);
      parent.updateMatrixWorld(true);
      pv.position.copy(parent.worldToLocal(hinge(b)));
      pv.updateMatrixWorld(true);
      pv.attach(part);
      return pv;
    };
    // the Lucky Barrel, its lid free to pop
    const B = this.barrelParts;
    const lb = grab('barrel', BARREL.h);
    if (lb && B) {
      B.group.add(lb);
      const lid = pivotOf(lb, 'wine_barrel_01_Lid', B.group, (b) => new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, b.min.z));
      if (lid) B.lid = lid;
    }
    // two plain barrels of stock: behind the counter, and by the door with a sack leaning on it
    for (const [x, z, hh, yaw] of [[4.22, -2.42, 0.86, 2.1], [-3.95, 1.4, 0.78, 0.7]]) {
      const b = grab('barrel', hh);
      if (!b) continue;
      b.position.set(x, 0, z);
      b.rotation.y = yaw;
      this.add(b);
      this.add(contactShadow(0.85, 0.85, 0.55)).position.set(x, 0.004, z);
    }
    // the gem chests on the stash shelf, lids thrown open on heaps of moon gems
    for (const g of GEM_SPOTS) {
      const sp = this.spots.get('gem:' + g.id);
      const spec = sp?.obj.userData.chest as { w: number; gems: number; seed: number } | undefined;
      if (!sp || !spec) continue;
      const c = grab('chest', spec.w * 0.65);
      if (!c) continue;
      sp.obj.add(c);
      sp.obj.updateMatrixWorld(true);
      const lid = pivotOf(c, 'treasure_chest_lid', sp.obj, (b) => new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2 - (b.max.y - b.min.y) * 0.2, 0).setZ(b.min.z));
      if (lid) lid.rotation.x = -1.75;
      const body = c.getObjectByName('treasure_chest_bottom');
      const bb = new THREE.Box3().setFromObject(body ?? c);
      const top = sp.obj.worldToLocal(new THREE.Vector3(0, bb.max.y, 0)).y;
      const heap = gemHeap(spec.gems, spec.w * 0.62, spec.w * 0.34, spec.w * 0.11, spec.seed);
      heap.position.y = top - spec.w * 0.04;
      sp.obj.add(heap);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xb9a6ff, map: haloTexture(), blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      glow.scale.setScalar(spec.w * 1.4);
      glow.position.y = top + 0.04;
      glow.renderOrder = 6;
      sp.obj.add(glow);
      this.disposables.push(() => (glow.material as THREE.Material).dispose());
      sp.obj.add(contactShadow(spec.w * 1.3, spec.w * 0.9, 0.5));
    }
    // the mantel clock on the counter, its hands set to the real time
    const C = COUNTER;
    const mc = grab('mclock', 0.3);
    if (mc) {
      mc.position.set(C.x0 + 0.78, C.h, C.z - 0.18);
      mc.rotation.y = -0.15;
      this.add(mc);
      const glass = mc.getObjectByName('mantel_clock_01_glass');
      if (glass) {
        mc.updateMatrixWorld(true);
        const gb = new THREE.Box3().setFromObject(glass);
        const ctr = gb.getCenter(new THREE.Vector3()), rad = Math.min(gb.max.x - gb.min.x, gb.max.y - gb.min.y) / 2;
        this.clock = clockFace(rad * 0.94);
        mc.add(this.clock.group);
        this.clock.group.position.copy(mc.worldToLocal(ctr.clone()));
        this.clock.group.position.z -= (gb.max.z - gb.min.z) * 0.35;
        (glass as THREE.Mesh).renderOrder = 3;
        this.disposables.push(() => this.clock?.dispose());
      }
    }
  }

  private async loadProps() {
    void this.loadHero();
    let g: THREE.Object3D;
    try { g = (await loadGLB('shop/props.glb')).scene; } catch (e) { console.warn('lodge props missing', e); return; }
    if (this.dead) return;
    const put = (name: string, at: THREE.Vector3, o: { yaw?: number; h?: number; w?: number; parent?: THREE.Object3D; shadow?: number; roll?: number; pitch?: number; pre?: [number, number, number] } = {}) => {
      const src = g.getObjectByName(name);
      if (!src) return null;
      const c0 = src.clone(true);
      c0.position.set(0, 0, 0); c0.rotation.set(0, 0, 0); c0.scale.set(1, 1, 1);
      const c = new THREE.Group();
      c.add(c0);
      if (o.pre) c0.rotation.set(...o.pre);
      const wrap = new THREE.Group();
      wrap.add(c);
      c.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(c, true), s = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3());
      const k = o.h ? o.h / Math.max(1e-3, s.y) : o.w ? o.w / Math.max(1e-3, s.x) : 1;
      c.scale.setScalar(k);
      c.position.set(-ctr.x * k, -b.min.y * k, -ctr.z * k);
      wrap.position.copy(at);
      wrap.rotation.set(o.pitch ?? 0, o.yaw ?? 0, o.roll ?? 0);
      wrap.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      (o.parent ?? this.scene).add(wrap);
      if (o.shadow) { const sh = contactShadow(s.x * k * 1.5, s.z * k * 1.5, o.shadow); sh.position.set(at.x, 0.004, at.z); this.scene.add(sh); }
      return wrap;
    };
    const C = COUNTER;
    // the till on the counter, a lantern and a candle
    const till = put('register', v3(C.x1 - 0.42, C.h, C.z - 0.08), { h: 0.42, yaw: -0.18 });
    if (till) this.spot('till', till, this.hitBox(0.5, 0.45, 0.45, v3(C.x1 - 0.42, C.h + 0.22, C.z - 0.08)), v3(C.x1 - 0.42, C.h + 0.48, C.z - 0.08));
    put('candle', v3(C.x1 - 0.12, C.h, C.z + 0.2), { h: 0.22 });
    put('books', v3(C.x0 + 1.25, C.h, C.z - 0.2), { h: 0.14, yaw: 0.5 });
    // behind the counter, right of the window: the stocked bookshelf
    const shelf = put('bookshelf', v3(3.98, 0, ROOM.back + 0.36), { h: 2.15, shadow: 0.5 });
    if (shelf) void this.stockShelf(shelf, g);
    // [shop11] the borrowed tools on the tool board: two handsaws hanging, two planes on the shelf, a hatchet; the
    // chopping block's axe; a bucket of offcuts by the shaving horse; crates by the timber rack
    const S = this.toolSlots, board = (k: string) => S[k] ? v3(0.05 + S[k].x, S[k].y, ROOM.back + 0.15 + S[k].z) : null;
    const sv1 = board('saw1'), sv2 = board('saw2'), pl1 = board('plane1'), pl2 = board('plane2'), ht = board('hatchet');
    if (sv1) put('saw', sv1.clone().add(v3(0, -0.3, 0)), { h: 0.56, pre: [-Math.PI / 2, 0, 0], yaw: Math.PI / 2, roll: 0.04 });
    if (sv2) put('saw', sv2.clone().add(v3(0, -0.26, 0)), { h: 0.46, pre: [-Math.PI / 2, 0, 0], yaw: Math.PI / 2, roll: -0.06 });
    if (pl1) put('plane', pl1, { h: 0.13, yaw: 0.15 });
    if (pl2) put('plane', pl2, { h: 0.105, yaw: -0.2 });
    if (ht) put('hatchet', ht.clone().add(v3(0, -0.18, 0)), { h: 0.36, yaw: Math.PI / 2, roll: 0.06 });
    if (this.chopBlock) put('axe', v3(-3.52, 0.42, -2.42), { h: 0.62, roll: -0.35, yaw: 0.6 });
    put('bucket', v3(-3.2, 0, 1.55), { h: 0.38, yaw: 0.6, shadow: 0.5 });
    put('milcrate', v3(-4.0, 0, 1.45), { h: 0.42, yaw: 1.62, shadow: 0.5 });
    put('crate2', v3(-4.0, 0.42, 1.45), { h: 0.32, yaw: 1.3 });
    put('crate1', v3(3.9, 0, 3.1), { h: 0.42, yaw: -0.5, shadow: 0.5 });
    put('cheese', v3(3.9, 0.42, 3.1), { h: 0.1, yaw: 0.3 });
    put('pot', v3(4.05, 0, 2.35), { h: 0.34, shadow: 0.5 });
    await this.loadWorkshop();
    // the stash's bowl and wicker basket
    const bowl = this.spots.get('acorn:handful');
    if (bowl) put('bowl', v3(0, 0, 0), { w: 0.3, parent: bowl.obj });
    const pail = this.spots.get('acorn:basket');
    if (pail) put('bucket', v3(0, 0, 0), { h: 0.38, parent: pail.obj });
    // lanterns: brass hurricane lamps hung under the light points, a wooden one on the window sill
    for (const l of this.lamps) {
      const hang = l.swing!;
      const lan = put('lantern', v3(0, -0.34, 0), { h: 0.34, parent: hang });
      if (lan) { const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, ROOM.h - hang.position.y, 4), M.rope()); cord.position.y = (ROOM.h - hang.position.y) / 2; hang.add(cord); }
      l.light.position.copy(hang.position).add(v3(0, -0.2, 0));
      l.flame.position.copy(l.light.position);
      l.halo.position.copy(l.light.position);
    }
    put('wlantern', v3(WIN.x0 + 0.25, WIN.y0, ROOM.back + 0.05), { h: 0.3 });
    put('vase', v3(WIN.x1 - 0.25, WIN.y0, ROOM.back + 0.05), { h: 0.24 });
  }

  /** [shop11] Poly Haven's hand drill and claw hammer on the tool board (shop/workshop.glb); finished furniture from the
   * catalogue on the dais and hung on the peg rail, each with a paper price tag. */
  private async loadWorkshop() {
    try {
      const w = (await loadGLB('shop/workshop.glb')).scene;
      if (this.dead) return;
      const S = this.toolSlots;
      const hang = (name: string, slot: string, h: number, yaw = 0) => {
        const src = w.getObjectByName(name), at = S[slot];
        if (!src || !at) return;
        const o = new THREE.Group();
        const c = src.clone(true);
        c.position.set(0, 0, 0);
        o.add(c);
        fit(o, 1, h, 1);
        const b = new THREE.Box3().setFromObject(o);
        // hung from its top on the peg
        o.position.set(0.05 + at.x, at.y + 0.02 - (b.max.y - o.position.y), ROOM.back + 0.15 + at.z + 0.02);
        o.rotation.y = yaw;
        o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        this.scene.add(o);
      };
      hang('drill', 'drill', 0.42, 0.3);
      hang('hammer', 'hammer', 0.3, 0.0);
    } catch (e) { console.warn('workshop tools missing', e); }
    // finished pieces: on the dais at the front right, and hung on the peg rail over the tool board
    const pieces: { id: string; at: THREE.Vector3; h: number; yaw: number; price: number; hang?: boolean; tag: THREE.Vector3 }[] = [
      { id: 'rocking_chair', at: v3(DAIS.x - 0.26, 0.1, DAIS.z + 0.02), h: 0.86, yaw: 0.5, price: 480, tag: v3(0.16, 0.7, 0.12) },
      { id: 'stool', at: v3(DAIS.x + 0.34, 0.1, DAIS.z + 0.1), h: 0.42, yaw: -0.3, price: 90, tag: v3(0.0, 0.38, 0.16) },
      { id: 'chair', at: v3(-0.83, 2.18, ROOM.back + 0.33), h: 0.84, yaw: 0, price: 180, hang: true, tag: v3(0.12, 0.43, 0.2) },
      { id: 'chair', at: v3(0.85, 2.18, ROOM.back + 0.33), h: 0.84, yaw: 0, price: 180, hang: true, tag: v3(0.12, 0.43, 0.2) },
    ];
    await Promise.all(pieces.map(async (pc, k) => {
      const def = ITEMS[pc.id];
      if (!def?.model) return;
      try {
        const { root } = await instanceGLB(def.model);
        if (this.dead) return;
        const o = new THREE.Group();
        o.add(root);
        fit(o, 2, pc.h, 2);
        const g = new THREE.Group();
        g.add(o);
        g.position.copy(pc.at);
        g.rotation.y = pc.yaw;
        g.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        this.scene.add(g);
        if (!pc.hang) { const sh = contactShadow(0.7, 0.7, 0.5); sh.position.set(pc.at.x, pc.at.y + 0.003, pc.at.z); this.scene.add(sh); }
        const tag = priceTag(pc.price, 40 + k);
        tag.position.copy(pc.tag);
        g.add(tag);
        this.disposables.push(() => tag.userData.dispose?.());
      } catch { /* skip */ }
    }));
  }

  /** Put goods for sale on the bookshelf behind the counter: real furniture models from the catalogue. */
  private async stockShelf(unit: THREE.Object3D, props: THREE.Object3D) {
    unit.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(unit), ray = new THREE.Raycaster();
    const cz = (b.min.z + b.max.z) / 2 + 0.03, w = b.max.x - b.min.x;
    ray.set(v3(b.min.x + w * 0.25, b.max.y + 0.5, cz), v3(0, -1, 0));
    const ys = ray.intersectObject(unit, true).map((h) => h.point.y);
    const levels = ys.filter((y, i) => i === 0 || Math.abs(ys[i - 1] - y) > 0.2).filter((y) => y > b.min.y + 0.15 && y < b.max.y - 0.15).sort((a, c) => a - c);
    const goods = ['candles', 'books', 'bonsai', 'cactus', 'candelabra', 'apothecary', 'cactus_trio', 'basket_nest'];
    let k = 0;
    for (const y of levels.slice(0, 4)) {
      for (const fx of [0.26, 0.72]) {
        const id = goods[k++ % goods.length];
        const def = ITEMS[id];
        if (!def?.model) continue;
        try {
          const { root } = await instanceGLB(def.model);
          if (this.dead) return;
          const o = new THREE.Group();
          o.add(root);
          fit(o, w * 0.36, 0.3, 0.3);
          o.position.add(v3(b.min.x + w * fx, y, cz));
          o.rotation.y = (k % 3 - 1) * 0.3;
          this.scene.add(o);
        } catch { /* skip */ }
      }
    }
    void props;
  }

  // ---------------------------------------------------------------- picking and anchors

  private hitBox(w: number, h: number, d: number, at: THREE.Vector3): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.copy(at);
    this.scene.add(m);
    this.disposables.push(() => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
    return m;
  }
  private spot(id: string, obj: THREE.Object3D, hit: THREE.Object3D, anchor: THREE.Vector3, focus?: (l: LodgeLayout) => Shot) {
    hit.userData.spot = id;
    this.spots.set(id, { id, obj, hit, anchor, focus: focus ?? ((l) => ({ target: anchor.clone().add(v3(0, -0.2, 0)), yaw: 0, pitch: 0.2, dist: l === 'side' ? 2.4 : 3, fov: 42, cx: l === 'side' ? 0.68 : 0.5, cy: l === 'side' ? 0.5 : 0.32 })) });
  }

  /** Screen position (CSS px) of a thing's anchor (for DOM tags and bubbles); `on` is false when it's off screen. */
  anchor(id: string, lift = 0): { x: number; y: number; on: boolean } {
    let p: THREE.Vector3 | null = null;
    if (id === 'beaver') p = this.beaver.headWorld().add(v3(0, 0.16 + lift, 0));
    else if (id.startsWith('deal:')) { const d = this.deals[+id.slice(5)]; if (d) p = d.group.position.clone().add(v3(0, d.def.h + lift, d.def.h > 0.45 ? 0.2 : 0.18)); }
    else p = this.spots.get(id)?.anchor.clone().add(v3(0, lift, 0)) ?? null;
    if (!p) return { x: 0, y: 0, on: false };
    const q = p.project(this.camera);
    const x = (q.x * 0.5 + 0.5) * this.w, y = (-q.y * 0.5 + 0.5) * this.h;
    return { x, y, on: q.z < 1 && x > -20 && x < this.w + 20 && y > -20 && y < this.h + 20 };
  }

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray, e?: PointerEvent): boolean {
    const at = e?.timeStamp ?? performance.now();
    if (type === 'down') { this.downAt = { x, y, t: at }; return true; }
    if (type !== 'up' || !this.downAt) return true;
    const d = this.downAt;
    this.downAt = null;
    if (Math.hypot(x - d.x, y - d.y) > 14 || at - d.t > 900) return true;
    this.ray.ray.copy(ray);
    const hits = [...this.spots.values()].map((s) => s.hit);
    for (const dl of this.deals) hits.push(dl.group.userData.hit as THREE.Object3D);
    for (const b of this.banners) hits.push(b.b.cloth);
    const h = this.ray.intersectObjects(hits, false)[0];
    if (h) {
      const id = (h.object.userData.spot as string | undefined) ?? '';
      if (id) this.onPick?.(id);
    }
    return true;
  }

  // ---------------------------------------------------------------- the deals

  private makeStump(i: number): Deal {
    const def = STUMPS[this.layout][i];
    const group = new THREE.Group();
    const st = plinth(def.h, 0.46, i + 3);
    st.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.userData.own = true; });
    group.add(st);
    const holder = new THREE.Group();
    holder.position.y = def.h;
    group.add(holder);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.6, def.h + 0.6, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = (def.h + 0.6) / 2;
    hit.userData.spot = 'deal:' + i;
    group.add(hit);
    group.userData.hit = hit;
    this.disposables.push(() => { hit.geometry.dispose(); (hit.material as THREE.Material).dispose(); });
    group.position.set(def.x, 0, def.z);
    group.rotation.y = (1 - i) * 0.25;
    this.scene.add(group);
    return { def, group, stump: st, holder, model: null, owl: null, sold: false, soldSign: null, bounce: 0, item: null };
  }

  private placeStumps() {
    const P = STUMPS[this.layout];
    this.deals.forEach((d, i) => {
      d.def = P[i];
      d.group.position.set(P[i].x, 0, P[i].z);
      if (Math.abs((d.stump.userData.top as number) - P[i].h) > 1e-3) {
        // a plinth of this layout's height
        const st = plinth(P[i].h, 0.46, i + 3);
        st.traverse((n) => { if ((n as THREE.Mesh).isMesh) n.userData.own = true; });
        d.group.remove(d.stump);
        d.stump.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.userData.own) m.geometry.dispose(); });
        d.group.add(st);
        d.stump = st;
      }
      d.holder.position.y = P[i].h;
    });
    const sign = this.signs.find((s) => s.group.userData.deals);
    if (sign) sign.group.position.set(P[1].x, 2.05, 0.85);
    for (const b of this.boards) { b.side.visible = this.layout === 'side'; b.top.visible = this.layout === 'top'; }
  }

  /** Put today's deals on the stumps. */
  setDeals(deals: DisplayItem[]) {
    const key = deals.map((d) => d.kind + ':' + d.id).join('|');
    if (key === this.dealKey) return;
    this.dealKey = key;
    const token = ++this.dealToken;
    const jobs: Promise<void>[] = [];
    this.deals.forEach((s, i) => {
      for (const c of [...s.holder.children]) { if (c === s.soldSign) continue; s.holder.remove(c); c.userData.dispose?.(); }
      if (s.owl) { s.owl.model.dispose(); s.owl = null; }
      s.model = null;
      s.item = deals[i] ?? null;
      if (deals[i]) jobs.push(this.dress(s, deals[i], token));
    });
    this.dealsReady = Promise.all(jobs);
  }

  private async dress(s: Deal, d: DisplayItem, token: number) {
    const r = await displayModel(d, 0.5, 0.5);
    if (token !== this.dealToken || this.dead || !r) { r?.owl?.model.dispose(); return; }
    s.holder.add(r.obj);
    s.model = r.obj; s.owl = r.owl;
    this.setSold(this.deals.indexOf(s), s.sold);
  }

  /** A deal sold today: the item leaves the stump; a little SOLD card is stuck in its top. */
  setSold(i: number, sold: boolean) {
    const s = this.deals[i];
    if (!s) return;
    s.sold = sold;
    if (s.model) s.model.visible = !sold;
    if (sold && !s.soldSign) {
      const sg = hangingSign(0.36, 0.16, 'SOLD', '', 0.001, 31 + i);
      sg.group.position.set(0, 0.16, 0.0);
      sg.group.rotation.x = -0.25;
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), M.boardDark());
      stake.position.y = -0.1;
      sg.group.add(stake);
      s.holder.add(sg.group);
      s.soldSign = sg.group;
      this.disposables.push(() => sg.dispose());
    }
    if (s.soldSign) s.soldSign.visible = sold;
  }

  // ---------------------------------------------------------------- series banners and the slate

  /** The weekly series' banner art (image URLs) and names, in order. */
  setSeries(list: { id: string; art: string; on: boolean }[]) {
    list.slice(0, this.banners.length).forEach((s, k) => {
      const b = this.banners[k];
      b.id = s.id;
      b.b.setArt(s.art);
      b.b.cloth.userData.spot = 'series:' + s.id;
      const x = BANNERS[k].x;
      this.spots.set('series:' + s.id, {
        id: 'series:' + s.id, obj: b.b.group, hit: b.b.cloth, anchor: v3(x, BANNER_TOP - BANNER_H - 0.12, ROOM.back + 0.32),
        focus: (l) => ({ target: v3(x, BANNER_TOP - BANNER_H / 2 - 0.15, ROOM.back + 0.3), yaw: 0.05, pitch: 0.02, dist: l === 'side' ? 2.9 : 3.9, fov: 44, cx: l === 'side' ? 0.7 : 0.5, cy: l === 'side' ? 0.5 : 0.3 }),
      });
      (b.b.cloth.material as THREE.MeshStandardMaterial).color.setScalar(s.on ? 1 : 0.62);
    });
  }

  /** Chalk the slate: today's deals and when they change. */
  chalk(lines: { text: string; size: number; col?: string }[]) { this.board?.draw(lines); }

  // ---------------------------------------------------------------- the camera

  private shot(name: string): Shot {
    const l = this.layout;
    if (name === 'home') return l === 'side'
      ? { target: v3(-0.38, 1.0, -1.15), yaw: 0.03, pitch: 0.12, dist: 4.6, fov: 46, cx: 0.5, cy: 0.5 }
      : { target: v3(-0.05, 0.9, -0.95), yaw: 0.0, pitch: 0.32, dist: 4.8, fov: 58, cx: 0.5, cy: 0.42 };
    if (name === 'deals') { const p = STUMPS[l][1]; return l === 'side' ? { target: v3(p.x, 0.75, p.z - 0.3), yaw: 0.05, pitch: 0.2, dist: 3.9, fov: 44, cx: 0.5, cy: 0.5 } : this.shot('home'); }
    if (name === 'stash') return { target: v3(SHELF.x - 0.45, 0.6, (SHELF.z0 + SHELF.z1) / 2 + 0.05), yaw: -1.12, pitch: l === 'side' ? 0.4 : 0.5, dist: l === 'side' ? 3.5 : 5.4, fov: l === 'side' ? 46 : 52, cx: 0.5, cy: l === 'side' ? 0.48 : 0.42 };
    if (name === 'series') return this.barrelShot(l, false);
    if (name === 'barrel') return this.barrelShot(l, true);
    const s = this.spots.get(name);
    if (s) return s.focus(l);
    if (name.startsWith('deal:')) {
      const d = this.deals[+name.slice(5)];
      if (d) { const p = d.group.position; return { target: v3(p.x, d.def.h + 0.25, p.z), yaw: -d.group.rotation.y * 0.6, pitch: 0.2, dist: l === 'side' ? 1.9 : 2.35, fov: 42, cx: l === 'side' ? 0.68 : 0.5, cy: l === 'side' ? 0.5 : 0.3 }; }
    }
    return this.shot('home');
  }

  /** Fly the camera to a section or a thing (`instant` jumps there). */
  focus(name: string, instant = false) {
    this.shotName = name;
    if (['home', 'deals', 'stash', 'series'].includes(name)) this.section = name as Section;
    const to = this.shot(name);
    this.from = { ...this.cur, target: this.cur.target.clone() };
    this.to = to;
    this.camT = instant ? 1 : 0;
    this.camStart = performance.now();
    const d = this.from.target.distanceTo(to.target) + Math.abs(this.from.yaw - to.yaw) * 2;
    this.camDur = THREE.MathUtils.clamp(0.7 + d * 0.16, 0.8, 1.6);
    if (instant) this.cur = { ...to, target: to.target.clone() };
    // light what's in focus
    const sp = this.spots.get(name) ?? (name.startsWith('deal:') ? { anchor: this.deals[+name.slice(5)]?.group.position.clone().add(v3(0, 0.6, 0)) } : null);
    if (sp?.anchor) {
      this.focusLight.target.position.copy(sp.anchor).add(v3(0, -0.25, 0));
      this.focusLight.position.copy(sp.anchor).add(v3(0.3, 2.4, 1.6));
      this.focusOn = 1;
    } else this.focusOn = 0;
    if (name.startsWith('deal:')) { const d = this.deals[+name.slice(5)]; if (d) d.bounce = 1; }
  }
  private focusOn = 0;
  get current() { return this.shotName; }
  get currentSection() { return this.section; }

  private applyCamera() {
    const c = this.camera, s = this.cur;
    const cp = Math.cos(s.pitch);
    c.position.set(s.target.x + Math.sin(s.yaw) * cp * s.dist, s.target.y + Math.sin(s.pitch) * s.dist, s.target.z + Math.cos(s.yaw) * cp * s.dist);
    c.lookAt(s.target);
    c.fov = s.fov;
    c.aspect = this.w / this.h;
    // put the target at (cx, cy) of the screen (the detail cards cover the rest)
    c.setViewOffset(this.w, this.h, (0.5 - s.cx) * this.w, (0.5 - s.cy) * this.h, this.w, this.h);
    c.updateProjectionMatrix();
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const side = w >= h * 1.05 && w >= 640;
    this.layout = side ? 'side' : 'top';
    // the stumps stand where this layout's camera wants them
    this.placeStumps();
    const to = this.shot(this.shotName);
    this.cur = { ...to, target: to.target.clone() };
    this.to = to;
    this.camT = 1;
    this.applyCamera();
  }

  // ---------------------------------------------------------------- Barnaby

  /** He reacts with a gesture (and optionally looks at a thing). */
  act(clip: BeaverClip, lookAt?: string) {
    this.beaver.play(clip);
    if (lookAt) this.lookAt(lookAt);
  }
  /** He looks at a thing for a while. */
  lookAt(id: string | null, sec = 3) {
    if (!id) { this.beaver.lookAt = null; return; }
    const s = this.spots.get(id);
    const p = s?.anchor ?? (id.startsWith('deal:') ? this.deals[+id.slice(5)]?.group.position.clone().add(v3(0, 0.7, 0)) : null);
    if (p) { this.beaver.lookAt = p.clone(); this.lookT = sec; }
  }
  talk(sec: number) { this.beaver.talk(sec); }

  private beaverEvent(e: 'gnaw' | 'land' | 'clap') {
    const h = this.beaver.headWorld();
    if (e === 'gnaw') {
      sound.play('eat_crunch', { volume: 0.35, rate: 1.3 });
      for (let i = 0; i < 10; i++) this.fx.emit({ x: h.x - 0.05, y: h.y - 0.18, z: h.z + 0.18, vx: (Math.random() - 0.5) * 0.8, vy: 0.4 + Math.random() * 0.6, vz: 0.3 + Math.random() * 0.4, life: 1.2, frame: SPR.crumb, color: 0xe8c690, size: 0.08, gravity: 3, drag: 0.6, land: true, delay: i * 0.08 });
    }
    if (e === 'land') { sound.play('pet_land', { volume: 0.4 }); this.fx.burst('dust', BEAVER.x, 0.02, BEAVER.z, 6); }
  }

  /** A purchase or a gift: he hops for joy, sparkles rain over the thing. */
  celebrate(id?: string) {
    this.beaver.play('hop');
    const h = this.beaver.headWorld();
    this.fx.burst('hearts', h.x, h.y + 0.1, h.z, 3);
    let p: THREE.Vector3 | null = null;
    if (id?.startsWith('deal:')) { const d = this.deals[+id.slice(5)]; if (d) { d.bounce = 1; p = d.group.position.clone().add(v3(0, d.def.h + 0.4, 0)); } }
    else if (id) p = this.spots.get(id)?.anchor.clone() ?? null;
    if (p) { this.fx.burst('stars', p.x, p.y, p.z, 12); this.sparkleRain(p.x, p.y + 0.7, p.z, 14); }
  }
  /** Coins or gems fly up from a thing (a pack bought). */
  shower(id: string, kind: 'coin' | 'gem') {
    const p = this.spots.get(id)?.anchor;
    if (!p) return;
    for (let i = 0; i < 18; i++) this.fx.emit({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 1.6, vy: 1.4 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 1.6, life: 1.1, frame: kind === 'gem' ? SPR.spark1 : SPR.coin, frames: kind === 'gem' ? 3 : 1, fps: 8, color: kind === 'gem' ? 0xc8b4ff : 0xdcb072, size: 0.16, gravity: 4, drag: 0.5, add: kind === 'gem', delay: i * 0.02 });
  }

  /** The gift parcel opens: the bow pops, the lid flies, sparkles. */
  openGift() {
    this.giftOpen = 0.001;
    const p = this.spots.get('gift')?.anchor;
    if (p) { this.fx.burst('confetti', p.x, p.y, p.z, 24); this.fx.burst('stars', p.x, p.y, p.z, 10); }
    sound.play('fabric', { volume: 0.4 });
  }
  setGiftClaimed(claimed: boolean) {
    if (!this.gift) return;
    this.gift.visible = !claimed || this.giftOpen > 0;
    if (!claimed) { this.giftOpen = 0; const bow = this.gift.userData.bow as THREE.Object3D; bow.position.y = 0.3 * 0.79; bow.rotation.set(0, 0, 0); bow.visible = true; }
  }

  /** a ring of small glittering sparks flying out from a point */
  private pop(p: THREE.Vector3, col: number, n: number) {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.3, s = 0.8 + Math.random() * 1.4;
      this.fx.emit({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: 0.6 + Math.random() * 1.6, vz: Math.sin(a) * s * 0.6, life: 0.9 + Math.random() * 0.6, frame: SPR.spark1, frames: 3, fps: 10, color: k % 3 ? col : 0xffffff, size: 0.05 + Math.random() * 0.06, add: true, gravity: 1.6, drag: 1.4, delay: k * 0.008 });
    }
  }
  private sparkleRain(x: number, y: number, z: number, n: number) {
    for (let k = 0; k < n; k++) this.fx.emit({ x: x + (Math.random() - 0.5) * 1.2, y: y + Math.random() * 0.4, z: z + (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.4, life: 1 + Math.random() * 0.8, frame: SPR.spark1, frames: 3, fps: 8, color: k % 3 ? 0xfff0c0 : 0xf1d39a, size: 0.06 + Math.random() * 0.06, add: true, delay: k * 0.03, flutter: 0.3 });
  }

  // ---------------------------------------------------------------- the Lucky Barrel

  /** The wish: the barrel rumbles, the lid pops, light shoots up in the colour of the best rarity. Resolves when the
   * lid is open (time to show the first prize). */
  wish(best: 3 | 4 | 5): Promise<void> {
    const B = this.barrelParts;
    if (!B) return Promise.resolve();
    this.focus('barrel');
    const col = best === 5 ? 0xffc94a : best === 4 ? 0xc79bff : 0x8fd0ff;
    B.col.setHex(col);
    B.shake = 1;
    this.beaver.play(best === 5 ? 'hop' : 'present');
    this.lookAt('barrel', 4);
    sound.play('drawer', { volume: 0.5, rate: 0.7 });
    return new Promise((res) => {
      setTimeout(() => { if (this.dead) return res(); sound.play('wood_knock', { volume: 0.5 }); }, 500);
      setTimeout(() => {
        if (this.dead) return res();
        B.open = 1;
        const p = v3(BARREL.x, BARREL.h + 0.3, BARREL.z);
        this.pop(p, B.col.getHex(), best === 5 ? 46 : best === 4 ? 30 : 18);
        this.sparkleRain(p.x, p.y + 1.6, p.z, best === 5 ? 24 : 10);
        sound.play(best === 5 ? 'reward_levelup' : best === 4 ? 'reward_unlock' : 'sparkle', { volume: 0.6 });
        res();
      }, best === 5 ? 1700 : 1300);
    });
  }
  /** Show one prize rising out of the barrel (replaces the last). */
  async showPrize(d: DisplayItem, stars: 3 | 4 | 5) {
    this.clearPrize();
    const B = this.barrelParts;
    if (B) { B.col.setHex(stars === 5 ? 0xffc94a : stars === 4 ? 0xc79bff : 0x8fd0ff); B.open = Math.max(B.open, 0.8); }
    const r = await displayModel(d, 0.55, 0.55);
    if (!r || this.dead) return;
    r.obj.position.set(BARREL.x, BARREL.h + 0.1, BARREL.z + 0.06);
    this.scene.add(r.obj);
    this.prize = { obj: r.obj, owl: r.owl, t: 0 };
    this.pop(v3(BARREL.x, BARREL.h + 0.55, BARREL.z), stars === 5 ? 0xffd27a : stars === 4 ? 0xd8b8ff : 0xb8e4ff, stars === 5 ? 26 : 12);
  }
  clearPrize() {
    if (this.barrelParts) this.barrelParts.open = Math.min(this.barrelParts.open, 0.25);
    if (!this.prize) return;
    this.prize.obj.removeFromParent();
    this.prize.obj.userData.dispose?.();
    this.prize.owl?.model.dispose();
    this.prize = null;
  }
  /** Close the barrel (after the reveal). */
  closeBarrel() { if (this.barrelParts) this.barrelParts.open = 0; this.clearPrize(); }

  // ---------------------------------------------------------------- per frame

  update(dt: number, t: number) {
    this.time += dt;
    this.enterT = Math.min(1, this.enterT + dt * 0.5);
    if ((Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2))) this.applyLight();
    // camera
    if (this.camT < 1) {
      this.camT = Math.min(1, Math.max(this.camT + Math.min(dt, 0.05) / this.camDur, (performance.now() - this.camStart) / 1000 / this.camDur));
      const k = ease(this.camT), a = this.from, b = this.to;
      this.cur = {
        target: a.target.clone().lerp(b.target, k), yaw: a.yaw + (b.yaw - a.yaw) * k, pitch: a.pitch + (b.pitch - a.pitch) * k,
        dist: a.dist + (b.dist - a.dist) * k + Math.sin(k * Math.PI) * 0.35, fov: a.fov + (b.fov - a.fov) * k, cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k,
      };
    }
    const e = 1 - Math.pow(1 - this.enterT, 3);
    const s = this.cur;
    const breathe = Math.sin(t * 0.21) * 0.035;
    this.cur = { ...s, dist: s.dist + (1 - e) * 1.6, yaw: s.yaw + breathe * 0.4, pitch: s.pitch + (1 - e) * 0.08 };
    this.applyCamera();
    this.look.focus = s.dist;
    this.look.focusRange = THREE.MathUtils.clamp(s.dist * 0.34, 0.7, 2.6);
    this.look.blur = s.dist < 4 ? 0.55 : 0.38;
    this.cur = s;

    // lanterns sway and flicker
    for (const l of this.lamps) {
      const f = 0.86 + Math.sin(t * 8.3 + l.phase) * 0.06 + Math.sin(t * 13.1 + l.phase * 2) * 0.05 + Math.sin(t * 2.7 + l.phase) * 0.04;
      l.light.intensity = l.base * f;
      (l.halo.material as THREE.SpriteMaterial).opacity = 0.3 + f * 0.18;
      if (l.swing?.userData.hang) { l.swing.rotation.z = Math.sin(t * 0.7 + l.phase) * 0.025; l.swing.rotation.x = Math.sin(t * 0.55 + l.phase * 1.3) * 0.02; }
    }
    this.focusLight.intensity += ((this.focusOn ? 9 : 0) - this.focusLight.intensity) * Math.min(1, dt * 3);
    for (const b of this.banners) b.b.sway(t, 1);
    for (const h of this.herbs) { const ph = h.userData.phase as number; h.rotation.z = Math.sin(t * 0.8 + ph) * 0.04; h.rotation.x = Math.sin(t * 0.6 + ph * 1.7) * 0.03; }
    swayPlants(t);

    // Barnaby: idle moments, looking around
    if (this.lookT > 0) { this.lookT -= dt; if (this.lookT <= 0) this.beaver.lookAt = null; }
    if ((this.idleT -= dt) <= 0) {
      this.idleT = 8 + Math.random() * 9;
      if (!this.beaver.busy && !this.beaver.working) {
        const r = Math.random();
        if (r < 0.28) this.beaver.play('gnaw');
        else if (r < 0.48) this.beaver.play('think');
        else if (r < 0.7) { this.lookAt('deal:' + Math.floor(Math.random() * 3), 2.6); }
        else this.beaver.lookAt = this.camera.position.clone();
      }
    }
    this.beaver.update(dt);
    this.craftTick();
    this.plank?.update(dt);
    if (Math.floor(this.time / 30) !== Math.floor((this.time - dt) / 30)) this.setWip();

    // deals: a slow turn on the stump, a bounce when picked
    for (const d of this.deals) {
      d.bounce = Math.max(0, d.bounce - dt * 1.6);
      const b = Math.sin((1 - d.bounce) * Math.PI * 3) * d.bounce * 0.12;
      d.holder.position.y = d.def.h + Math.max(0, b);
      if (d.model) d.model.rotation.y = Math.sin(t * 0.35 + d.def.x) * 0.35;
      d.owl?.update(dt);
      (d.model?.userData.animate as ((t: number, dt: number) => void) | undefined)?.(t, dt);
    }
    // the gift opening
    if (this.gift && this.giftOpen > 0 && this.giftOpen < 1) {
      this.giftOpen = Math.min(1, this.giftOpen + dt * 0.8);
      const bow = this.gift.userData.bow as THREE.Object3D;
      bow.position.y = 0.3 * 0.79 + this.giftOpen * 0.5;
      bow.rotation.z = this.giftOpen * 3;
      bow.visible = this.giftOpen < 0.7;
      this.gift.scale.setScalar(1 + Math.sin(this.giftOpen * Math.PI) * 0.15);
      if (this.giftOpen >= 1) this.gift.visible = false;
    }
    this.clock?.set(new Date());
    // the scales see-saw gently
    if (this.scalesObj) (this.scalesObj.userData.beam as THREE.Object3D).rotation.z = Math.sin(t * 0.9) * 0.05;
    // the barrel
    const B = this.barrelParts;
    if (B) {
      B.shake = Math.max(0, B.shake - dt * 0.45);
      const sh = B.shake > 0 ? Math.sin(t * 38) * 0.02 * B.shake : 0;
      B.group.rotation.z = sh;
      B.group.position.y = 0.12 + (B.shake > 0 ? Math.abs(Math.sin(t * 19)) * 0.02 * B.shake : 0);
      const want = B.open;
      const ly = (B.lid.userData.baseY as number | undefined) ?? B.lid.position.y;
      B.lid.userData.baseY = ly;
      // the lid swings up on its back edge and leans open behind the mouth (a hop of lift while it swings)
      B.lid.userData.lift = THREE.MathUtils.lerp((B.lid.userData.lift as number | undefined) ?? 0, want * 0.025, Math.min(1, dt * 6));
      B.lid.position.y = ly + (B.lid.userData.lift as number);
      B.lid.rotation.x = THREE.MathUtils.lerp(B.lid.rotation.x, Math.min(1, want * 1.25) * -1.92, Math.min(1, dt * 5));
      const bm = B.beam.material as THREE.MeshBasicMaterial;
      bm.color.lerp(B.col, Math.min(1, dt * 4));
      bm.opacity += (want * 0.32 - bm.opacity) * Math.min(1, dt * 4);
      B.beam.visible = bm.opacity > 0.01;
      B.glow.color.lerp(B.col, Math.min(1, dt * 4));
      B.glow.intensity = 0.8 + want * 9 + B.shake * 3 + Math.sin(t * 3) * 0.2;
      // sparkles always drift from the barrel's lid
      if (Math.random() < dt * (2 + want * 9)) this.fx.emit({ x: BARREL.x + (Math.random() - 0.5) * 0.5, y: BARREL.h + 0.15, z: BARREL.z + (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * (0.5 + want * 1.5), life: 1.4, frame: SPR.spark1, frames: 3, fps: 8, color: want > 0 ? B.col.getHex() : 0xffe09a, size: 0.06 + Math.random() * 0.05, add: true, flutter: 0.3 });
    }
    if (this.prize) {
      const p = this.prize;
      p.t += dt;
      const rise = Math.min(1, p.t / 0.9);
      p.obj.position.y = BARREL.h + 0.1 + ease(rise) * 0.42 + Math.sin(p.t * 1.8) * 0.03;
      p.obj.rotation.y += dt * 0.9;
      p.owl?.update(dt);
      (p.obj.userData.animate as ((t: number, dt: number) => void) | undefined)?.(t, dt);
    }
    // warm dust motes in the lantern light
    this.moteT -= dt;
    if (this.moteT <= 0) {
      this.moteT = 0.22;
      this.fx.emit({ x: (Math.random() - 0.5) * 7, y: 0.8 + Math.random() * 2.2, z: -2 + Math.random() * 3.4, vx: (Math.random() - 0.5) * 0.04, vy: 0.015 + Math.random() * 0.03, life: 7, frame: SPR.mote, color: 0xffe2a8, size: 0.03 + Math.random() * 0.025, flutter: 0.15, fadeIn: 1.5, fadeOut: 2, add: true });
    }
    this.fx.update(dt, t);
    this.renderOutside();
  }

  dispose() {
    this.dead = true;
    for (const d of this.deals) { d.owl?.model.dispose(); for (const c of d.holder.children) c.userData.dispose?.(); }
    this.clearPrize();
    // [shop11] the workshop's own geometry (built in code; the borrowed models share theirs with the GLB cache)
    const own = new Set<THREE.BufferGeometry>();
    for (const o of [this.scene, this.beaver.node]) o.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.userData.own) own.add(m.geometry); });
    for (const g of own) g.dispose();
    this.beaver.dispose();
    for (const s of this.signs) s.dispose();
    for (const f of this.disposables) f();
    this.envTex?.dispose();
    this.pmrem?.dispose();
    disposeMats();
    disposeTextures();
  }
}

// ------------------------------------------------------------------ helpers

function nightNow(): number {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h < 5.5 || h > 20 ? 1 : h < 7 ? (7 - h) / 1.5 : h > 18.5 ? (h - 18.5) / 1.5 : 0;
}
function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Scale and lift an object to fit a W x H x D box with its feet at y = 0. */
function fit(o: THREE.Object3D, W: number, H: number, D = W) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o, true), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const k = Math.min(W / Math.max(0.01, s.x), H / Math.max(0.01, s.y), D / Math.max(0.01, s.z));
  o.scale.multiplyScalar(k);
  o.position.x -= c.x * k; o.position.z -= c.z * k;
  o.position.y -= b.min.y * k;
}

/** The model for anything the store sells or a wish gives: furniture (its GLB), an outfit (on a little display owl),
 * a plumage or a skin (the owl itself), a wall or floor finish (a sample board). Fits a w x h box, feet at y = 0. */
export async function displayModel(d: DisplayItem, w: number, h: number): Promise<{ obj: THREE.Object3D; owl: OwlActor | null } | null> {
  try {
    if (d.kind === 'piece' || d.kind === 'species' || d.kind === 'skin') {
      const look: OwlLook = d.kind === 'species' ? { skin: 'owl', species: d.id, palette: d.id, outfit: {} }
        : d.kind === 'skin' ? { skin: d.id as OwlLook['skin'], species: 'snowy', palette: 'snowy', outfit: {} }
        : { skin: 'owl', species: 'tawny', palette: 'tawny', outfit: PIECE[d.id] ? { [PIECE[d.id].slot]: d.id } : {} };
      const owl = new OwlActor(look, {});
      owl.setMood('happy');
      const g = new THREE.Group();
      g.add(owl.node);
      await owl.model.ready;
      for (let k = 0; k < 20; k++) owl.update(1 / 30);
      fit(g, w * 0.9, h, w * 0.9);
      const o = new THREE.Group();
      o.add(g);
      return { obj: o, owl };
    }
    if (d.kind === 'finish') {
      const f = FINISH[d.id];
      const c = document.createElement('canvas');
      c.width = c.height = 48;
      const x = c.getContext('2d')!;
      for (let yy = 0; yy < 48; yy++) for (let xx = 0; xx < 48; xx++) { let col = 0x888888; try { col = f ? f.paint(xx, 47 - yy) : col; } catch { /* */ } x.fillStyle = '#' + col.toString(16).padStart(6, '0'); x.fillRect(xx, yy, 1, 1); }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
      const face = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
      const board = new THREE.Mesh(new RoundedBoxGeometry(w * 0.8, h * 0.8, 0.04, 2, 0.01), face);
      board.position.y = h * 0.4;
      board.rotation.x = -0.15;
      board.castShadow = true;
      const o = new THREE.Group();
      o.add(board);
      o.userData.dispose = () => { t.dispose(); face.dispose(); board.geometry.dispose(); };
      return { obj: o, owl: null };
    }
    const def = ITEMS[d.id];
    const g = new THREE.Group();
    if (def?.model) {
      try {
        const { root, clips } = await instanceGLB(def.model);
        g.add(root);
        if (clips.length) {
          const mixer = new THREE.AnimationMixer(root);
          mixer.clipAction(clips.find((c) => c.name === 'idle') ?? clips[0]).play();
          g.userData.animate = (_t: number, dt: number) => mixer.update(dt);
        }
        fit(g, w, h, w);
        const o = new THREE.Group(); o.add(g); o.userData.animate = g.userData.animate;
        return { obj: o, owl: null };
      } catch { /* fall back */ }
    }
    if (def) {
      const m = propMesh(buildProp(def.build(), { wind: false }));
      m.castShadow = true;
      for (const p of def.parts?.() ?? []) m.add(p);
      g.add(m);
      if (def.animate) g.userData.animate = (t: number, dt: number) => def.animate!(m, t, dt);
      g.userData.dispose = () => m.userData.dispose?.();
      fit(g, w, h, w);
      const o = new THREE.Group(); o.add(g); o.userData.animate = g.userData.animate; o.userData.dispose = g.userData.dispose;
      return { obj: o, owl: null };
    }
    // unknown: a wrapped parcel
    const p = parcel(Math.min(w, h) * 0.7);
    return { obj: p, owl: null };
  } catch (e) { console.warn('display failed', d, e); return null; }
}

/** A clock face set to the real time: a painted enamel dial with roman numerals, blued-steel spade hands. */
function clockFace(r: number): { group: THREE.Group; set(d: Date): void; dispose(): void } {
  const g = new THREE.Group();
  // [font6] 192 texels across so the roman numerals fit in Alagard, the game's font, at its 16 px grid
  const N = 192;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d')!;
  const paint = () => {
    x.fillStyle = '#efe4c8'; x.fillRect(0, 0, N, N);
    const rr = mulberry(9);
    for (let i = 0; i < 1600; i++) { x.fillStyle = rr() < 0.5 ? 'rgba(180,150,100,0.12)' : 'rgba(255,250,235,0.25)'; x.fillRect(Math.floor(rr() * N), Math.floor(rr() * N), 1, 1); }
    x.strokeStyle = '#4a3a2a'; x.lineWidth = 4;
    x.beginPath(); x.arc(N / 2, N / 2, N / 2 - 6, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#2e2416';
    const R = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2;
      alagardText(x, R[h], N / 2 + Math.sin(a) * N * 0.34, Math.round(N / 2 - Math.cos(a) * N * 0.34 + 5.5), '#2e2416', { align: 'center' });
      x.fillStyle = '#2e2416';
      for (let m = 0; m < 5; m++) { const b = a + (m / 5) * (Math.PI / 6); x.fillRect(Math.round(N / 2 + Math.sin(b) * N * 0.45) - 1, Math.round(N / 2 - Math.cos(b) * N * 0.45) - 1, 2, 2); }
    }
  };
  paint();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  void alagardReady().then(() => { paint(); t.needsUpdate = true; });
  const dialM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
  const dial = new THREE.Mesh(new THREE.CircleGeometry(r, 32), dialM);
  g.add(dial);
  const steel = new THREE.MeshStandardMaterial({ color: 0x1e2636, metalness: 0.6, roughness: 0.35 });
  const hand = (len: number, w: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w * 0.35, -len * 0.18); s.lineTo(w * 0.35, -len * 0.18); s.lineTo(w * 0.3, len * 0.6);
    s.lineTo(w, len * 0.72); s.lineTo(0, len); s.lineTo(-w, len * 0.72); s.lineTo(-w * 0.3, len * 0.6); s.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: r * 0.02, bevelEnabled: false }), steel);
    const pv = new THREE.Group();
    pv.add(m);
    g.add(pv);
    return pv;
  };
  const hh = hand(r * 0.55, r * 0.07), mh = hand(r * 0.82, r * 0.05);
  hh.position.z = r * 0.02; mh.position.z = r * 0.05;
  const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.06, 12), new THREE.MeshStandardMaterial({ color: 0xc8a764, metalness: 0.8, roughness: 0.3 }));
  cap.position.z = r * 0.09;
  g.add(cap);
  return {
    group: g,
    set(d: Date) {
      const m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      mh.rotation.z = -(m / 60) * Math.PI * 2;
      hh.rotation.z = -(h / 12) * Math.PI * 2;
    },
    dispose() { t.dispose(); dialM.dispose(); steel.dispose(); },
  };
}

// ------------------------------------------------------------------ painted sprites

/** The view out of the window until the real world is attached (and in the dev page): a sunny clearing, a river. */
function paintedView(): THREE.Texture {
  const W = 160, H = 110;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const r = mulberry(17);
  const band = (y0: number, y1: number, a: string, b: string) => { for (let y = y0; y < y1; y++) { g.fillStyle = (y - y0) / (y1 - y0) + (r() - 0.5) * 0.2 < 0.5 ? a : b; g.fillRect(0, y, W, 1); } };
  band(0, 30, '#5f9fd6', '#7db8e6'); band(30, 55, '#7db8e6', '#a9d3ef');
  for (let i = 0; i < 5; i++) { const cx = r() * W, cy = 8 + r() * 26; for (let k = 0; k < 18; k++) { g.fillStyle = k % 3 ? '#f4f8fb' : '#dbe8f2'; g.fillRect(Math.round(cx + (r() - 0.5) * 26), Math.round(cy + (r() - 0.5) * 6), 4, 2); } }
  for (let x = 0; x < W; x++) { const hh = 50 + Math.sin(x * 0.05) * 5 + Math.sin(x * 0.17) * 2; g.fillStyle = '#6f9a8a'; g.fillRect(x, hh, 1, H - hh); }
  for (let x = -6; x < W + 6; x += 4 + r() * 4) { const hh = 12 + r() * 16, b = 62 + r() * 6; for (let y = 0; y < hh; y++) { const w = (y / hh) * 4 + 1; g.fillStyle = y % 3 ? '#2f5a3a' : '#3f7046'; g.fillRect(Math.round(x - w), Math.round(b - hh + y), Math.round(w * 2), 1); } }
  for (let y = 66; y < H; y++) for (let x = 0; x < W; x++) { const riv = Math.abs(y - (88 + Math.sin(x * 0.04) * 6)) < 5 + (y - 66) * 0.12; g.fillStyle = riv ? ((x + y) % 7 === 0 ? '#d8eef6' : '#69a8c8') : ((x * 3 + y) % 11 === 0 ? '#9cc46a' : (x + y) % 5 === 0 ? '#5f9a44' : '#78ac52'); g.fillRect(x, y, 1, 1); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
  return t;
}

let halo: THREE.Texture | null = null;
function haloTexture(): THREE.Texture {
  if (halo) return halo;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const d = g.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const r = Math.hypot(x + 0.5 - 32, y + 0.5 - 32) / 32;
    const a = r >= 1 ? 0 : Math.pow(1 - r, 2.2);
    const i = (y * 64 + x) * 4;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(d, 0, 0);
  halo = new THREE.CanvasTexture(c);
  return halo;
}
let shaft: THREE.Texture | null = null, shaftV: THREE.Texture | null = null;
/** a soft vertical light shaft (fades along its length and at its sides) */
function shaftTexture(vertical = false): THREE.Texture {
  if (vertical ? shaftV : shaft) return (vertical ? shaftV : shaft)!;
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const g = c.getContext('2d')!;
  const d = g.createImageData(32, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) {
    const u = x / 31, v = y / 63;
    const side = Math.sin(u * Math.PI);
    const along = vertical ? Math.pow(1 - v, 0.8) * Math.min(1, v * 2.5 + 0.05) : Math.pow(1 - v, 0.6) * Math.min(1, v * 4 + 0.1);
    const a = side * side * along;
    const i = (y * 32 + x) * 4;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; d.data[i + 3] = Math.round(a * 255);
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  if (vertical) { t.flipY = true; shaftV = t; } else shaft = t;
  return t;
}
void box;
void tex;
