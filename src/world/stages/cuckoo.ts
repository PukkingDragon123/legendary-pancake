// The Clock panel as a 3D stage: a super big carved Black Forest cuckoo clock on a wall in Pip's house, lit by two
// brass candle sconces (and the window's daylight by day). The clock is modelled piece by piece (cuckookit.ts): a
// shingled chalet roof with scalloped bargeboards and a carved owl crest on a fan of oak leaves, a balcony with
// turned balusters under the little arched door, a walnut case with turned columns and garlands of carved oak leaves
// and acorns round a big enamel dial (Roman numerals, pierced Gothic hands that show the real time), a carved
// fretwork apron, a leaf pendulum that swings and ticks, and two cast pine-cone weights on brass chains that drop
// through the day. The player's own owl (species, skin, outfit) lives behind the door: it pops out onto the balcony
// to cuckoo on the hour and the half hour, when you tap the door, to say hello and to present your numbers.
// The panel's information is physical: carved linden tags hanging from brass brackets at the clock's sides (this
// week, per night, streak, asleep by), a row of little painted houses on the shelf below, one per night, as tall as
// the night was long with a lit window when Pip tracked it, a clipboard with the routine and a wall calendar. Taps
// call onPick(id); focus(id) flies the camera to a thing. OWNED BY THE CLOCK BUILDER.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sound } from '../../audio/sound.ts';
import { OwlActor } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { Fx, SPR } from '../fx.ts';
import type { Look } from '../post.ts';
import type { Stage } from '../scene.ts';
import * as K from './cuckookit.ts';
import { CX as PCX, G as PG, layer as pLayer, paintDial } from '../../onboard/clockpaint.ts';

const { mtx } = K;
type Part = K.Part;

// ------------------------------------------------------------------ the plan (metres; the wall is z = 0, y up)

const CW = 0.8, CH = 0.82, CD = 0.26;
const DIAL = { y: 0.43, r: 0.25 };
const RIDGE = 1.205, TANA = 0.775, ANG = Math.atan(TANA), EAVE = 0.57, ROOF_Z = 0.45, ROOF_T = 0.016;
const GABLE_Y = 0.855, GABLE_Z = 0.22;
const DOOR = { w: 0.14, h: 0.18, y: 0.867, z: 0.24 };
const BAL = { y: 0.855, w: 0.48, z0: 0.24, z1: 0.37 };
const OWL_H = 0.19, PERCH_IN = 0.1, PERCH_OUT = 0.305;
const PEND = { y: -0.035, z: 0.05, len: 0.5 };
const CHAIN = { z: 0.13, top: -0.055, wTop: -0.19, wBot: -0.64 };
const WEIGHTS = [{ x: -0.155, ring: -0.232 }, { x: 0.155, ring: 0.232 }];
/** the clock's plan, for the hosts of a bare clock (the loading clock's bake, the office) */
export const CLOCK_PLAN = { CW, CH, CD, DIAL, RIDGE, EAVE, ROOF_Z, DOOR, BAL, PEND, CHAIN, WEIGHTS };
const TAG = { w: 0.4, h: 0.29, t: 0.014 };
const TAG_HOLE_T = TAG.h / 2 - 0.028, TAG_HOLE_B = -TAG.h / 2 + 0.026, TAG_Z = CD * 0.55;
/** the text on a tag: two lines in the game's face */
const TAG_DECAL = { w: 0.38, h: 0.2, px: [164, 86] as [number, number] };
/** where the tags hang: a phone stacks them in pairs under the case, a wide screen hangs them two by two beside it */
const TAG_LAY = {
  top: { k: 1, x: 0.47, hooks: [0.06], hang: 0.24, hang2: 0.09 },
  side: { k: 1.55, x: 0.86, hooks: [0.7, 0.14], hang: 0.06, hang2: 0.06 },
};
const SHELF = { y: -1.24, w: 1.52, h: 0.07, d: 0.28 };
const HOUSE = { w: 0.15, d: 0.12, gable: 0.055, z: 0.09, gap: 0.2 };
const DADO = -1.47;
/** text decals are painted near one texel per internal pixel on a phone (crisp at a glance) */
const DECAL_PPU = 233;
/** [clock14] metres of board per tile of the real wood scans (the grain's scale) */
const WOOD_TILE = 0.55;

export type ClockLayout = 'side' | 'top';
export interface StatTag { id: string; label: string; value: string }
export interface NightHouse { key: string; day: string; hours: number | null; text: string; goal: boolean; today: boolean }
export interface RoutineDay { day: string; bed: number; wake: number; on: boolean; tonight: boolean }
export type Sticker = 'gold' | 'moon' | 'cloud' | 'rain';
export interface MonthPage { month: string; year: number; lead: number; days: number; today: number; marks: Record<number, Sticker> }
export interface CuckooPrefs { finish: string; mute: boolean; wound: [number, number] }

interface Shot { target: THREE.Vector3; yaw: number; pitch: number; w: number; h: number; cx: number; cy: number }
interface Lamp { light: THREE.PointLight; flame: THREE.Mesh; halo: THREE.Sprite; phase: number }
interface Tag { id: string; pivot: THREE.Group; body: THREE.Mesh; decal: THREE.Mesh; twine: THREE.Mesh; c: HTMLCanvasElement; tex: THREE.CanvasTexture; phase: number; label: string; value: string; side: number; row: number }
interface House { group: THREE.Group; data: NightHouse | null; h: number; bounce: number }

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const FOV = 28;
const LOOK: Look = { exposure: 1.04, contrast: 1.06, saturation: 1.18, vibrance: 0.3, warm: 0.04, orange: 0.96, split: 0.3, // [look12]
  vignette: 0.26, grain: 0.012, bloom: 0.55, bloomThreshold: 1.05, focus: 7, focusRange: 2.5, blur: 0.25, cold: 0 };
const HOUSE_COLS = ['#d79c8e', '#a2c290', '#94b6dc', '#e6c46e', '#bba0d6', '#e8966c', '#86c8b6'];

/** the carvings are a lighter wood than the case (honey oak on walnut, like the Clock button's little clock) */
const carveOf = (id: string) => (id === 'oak' ? 'linden' : 'oak');

/** [clock12] the enamel: the loading clock's own dial painting (clockpaint.ts), fine enough for the closest shot */
function dialTex(): THREE.CanvasTexture {
  const r = PG.dial.r, [c, g] = pLayer(PCX - r, PG.dial.y - r, r * 2, r * 2, 2048 / (r * 2));
  paintDial(g, false);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function nightNow(): number {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  return h < 5.5 || h > 20.5 ? 1 : h < 7 ? (7 - h) / 1.5 : h > 19 ? (h - 19) / 1.5 : 0;
}

export class CuckooStage implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 40);
  readonly look: Look = { ...LOOK };
  readonly fx = new Fx(600);
  readonly ready: Promise<void>;
  layout: ClockLayout = 'top';
  /** a tap on a thing: dial, door, owl, crest, pendulum, weight:<i>, tag:<id>, house:<i>, routine, calendar */
  onPick: ((id: string) => void) | null = null;
  /** the owl went back in (after a pop-out) */
  onOwlHome: (() => void) | null = null;
  prefs: CuckooPrefs;

  private M: Record<string, THREE.Material> = {};
  private tex: THREE.Texture[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private picks: THREE.Object3D[] = [];
  private hour: THREE.Group; private minute: THREE.Group;
  private pend = new THREE.Group();
  private doorPivot = new THREE.Group();
  private perch = new THREE.Group();
  readonly owl!: OwlActor;
  private cones: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private links: THREE.InstancedMesh;
  private drop: [number, number] = [0, 0];
  private wind: [number, number] = [0, 0];
  private tags: Tag[] = [];
  private brackets: { top: THREE.Mesh; side: THREE.Mesh } = {} as never;
  private houses: House[] = [];
  private houseAtlas: { c: HTMLCanvasElement; glow: HTMLCanvasElement; tex: THREE.CanvasTexture; glowTex: THREE.CanvasTexture } | null = null;
  private shelfLabels: { c: HTMLCanvasElement; tex: THREE.CanvasTexture } | null = null;
  private boards: { routine: THREE.Group; calendar: THREE.Group } = { routine: new THREE.Group(), calendar: new THREE.Group() };
  private paper: Record<'routine' | 'calendar', { c: HTMLCanvasElement; tex: THREE.CanvasTexture }> = {} as never;
  private lamps: Lamp[] = [];
  private hemi = new THREE.HemisphereLight(0xfff0dc, 0x5a3a24, 0.4);
  private key = new THREE.DirectionalLight(0xffe2bc, 1.2);
  private sun = new THREE.SpotLight(0xfff2da, 0, 12, 0.5, 0.9, 1.2);
  private moon = new THREE.DirectionalLight(0x8ea6e8, 0);
  private pmrem: THREE.PMREMGenerator | null = null;
  private env: THREE.Texture | null = null;
  private night = 0;
  private nightFn: (() => number) | null = null;
  private time = 0;
  private w = 1; private h = 1;
  private cur!: Shot; private from!: Shot; private to!: Shot;
  private camT = 1; private camStart = 0; private camDur = 1;
  private shotName = 'home';
  private enterT = 0;
  private ray = new THREE.Raycaster();
  private downAt: { x: number; y: number; t: number } | null = null;
  private lastSign = 0;
  private clockT = 0;
  private lastChime = '';
  private moteT = 0;
  private dead = false;
  // the owl's trip out: door 0..1, perch 0..1
  private doorK = 0; private outK = 0;
  private seq: { phase: 'idle' | 'open' | 'out' | 'show' | 'back' | 'close'; t: number; calls: number; done: number; hold: number; mode: 'cuckoo' | 'hello' | 'present'; look: THREE.Vector3 | null } = { phase: 'idle', t: 0, calls: 0, done: 0, hold: 0, mode: 'cuckoo', look: null };
  private bow = 0;
  private shadowBlob: THREE.Texture;

  /** `bare`: only the clock itself (no wall, lights, tags, shelf, boards or lamps; the owl only with a look), for the
   * loading clock's bake and the office's wall clock, which light it themselves. `plain`: no carved leaves or acorns
   * round the dial and a brass disc pendulum bob. */
  readonly bare: boolean;
  private plain: boolean;
  constructor(look: OwlLook | null, prefs: CuckooPrefs, o: { bare?: boolean; plain?: boolean } = {}) {
    this.prefs = prefs;
    this.bare = !!o.bare; this.plain = !!o.plain;
    const S = this.scene;
    S.background = this.bare ? null : new THREE.Color(0x140d09);
    this.shadowBlob = this.keep(K.ctex(K.blobCanvas()));
    this.buildMaterials();
    if (!this.bare) { this.buildLights(); this.buildWall(); }
    const hands = this.buildClock();
    this.hour = hands.hour; this.minute = hands.minute;
    this.links = this.buildWeights();
    if (this.bare) {
      if (look) this.addOwl(look);
      this.setDrops(true);
      const wood = this.useRealWood();
      this.ready = look ? Promise.all([this.owl.ready, wood]).then(() => undefined) : wood;
      return;
    }
    this.buildTags();
    this.buildShelf();
    this.buildBoards();
    this.buildLamps();
    S.add(this.fx.group);
    this.fx.setLight(new THREE.Color(0xffe8c8));
    this.addOwl(look ?? { skin: 'owl', species: 'tawny', palette: 'tawny', outfit: {} });
    this.layout = innerWidth >= innerHeight * 1.05 && innerWidth >= 640 ? 'side' : 'top';
    this.placeBoards(); this.placeLamps(); this.placeTags();
    this.cur = this.shot('home');
    this.from = this.copy(this.cur); this.to = this.copy(this.cur);
    this.setDrops(true);
    this.applyLight();
    this.ready = Promise.all([K.fontReady(), this.useRealWood()]).then(() => undefined);
  }

  /** The owl, at home behind the door. */
  private addOwl(look: OwlLook) {
    const S = this.scene;
    (this as { owl: OwlActor }).owl = new OwlActor(look, { sound: (id) => { if (id === 'flap') sound.play('owl_wing', { volume: 0.25, rate: 1.3, gap: 300 }); } });
    this.owl.node.scale.setScalar(OWL_H / Math.max(0.1, this.owl.height));
    this.owl.node.position.set(0, 0.009, 0);
    this.perch.add(this.owl.node);
    this.perch.position.set(0, DOOR.y, PERCH_IN);
    const perchBoard = new THREE.Mesh(this.keepG(K.prep(K.slab(0.12, 0.1, 0.009, 0.002), null).rotateX(-Math.PI / 2).translate(0, 0, 0.0)), this.M.carve);
    perchBoard.castShadow = true;
    this.perch.add(perchBoard);
    this.owl.node.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    S.add(this.perch);
    this.perch.visible = false;
  }

  /** The moving parts, for a host that drives them itself (the office, the loading clock's bake). */
  get parts() { return { hour: this.hour, minute: this.minute, pend: this.pend, door: this.doorPivot, perch: this.perch, cones: this.cones, rings: this.rings, links: this.links }; }
  /** Pose the door (0 shut .. 1 open), the owl's trip out (0 in .. 1 on the balcony) and its bow (radians). */
  poseDoor(door: number, out: number, bow = 0) {
    this.doorPivot.rotation.y = -door * 1.9;
    this.perch.position.z = THREE.MathUtils.lerp(PERCH_IN, PERCH_OUT, out);
    this.perch.visible = !!this.owl && door > 0.05;
    this.perch.rotation.x = bow;
  }
  /** Hang both weights at `f` of their drop (0 just wound .. 1 run down). */
  setDrop(f: number) { this.drop = [f, f]; this.placeChains(); }

  // ---------------------------------------------------------------- bookkeeping

  private keep<T extends THREE.Texture>(t: T): T { this.tex.push(t); return t; }
  private keepG<T extends THREE.BufferGeometry>(g: T): T { this.geos.push(g); return g; }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, cast = true, recv = true): THREE.Mesh {
    this.keepG(g);
    const o = new THREE.Mesh(g, m);
    o.castShadow = cast; o.receiveShadow = recv;
    return o;
  }
  private pick(o: THREE.Object3D, id: string) { o.userData.pick = id; this.picks.push(o); }
  private copy(s: Shot): Shot { return { ...s, target: s.target.clone() }; }

  /** Draw through the app's renderer (an environment map for brass and enamel), and follow the world's day and night. */
  attach(renderer: THREE.WebGLRenderer, o: { night?: () => number } = {}) {
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(renderer);
      const env = new RoomEnvironment();
      this.env = this.pmrem.fromScene(env, 0.04).texture;
      this.scene.environment = this.env;
      (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.32;
      env.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    }
    this.nightFn = o.night ?? null;
    this.applyLight();
    this.resize(innerWidth, innerHeight);
  }

  // ---------------------------------------------------------------- materials

  private woodTex(id: string, bright = 0) {
    const t = this.keep(K.ctex(K.woodCanvas(K.finishOf(id).ramp, 128, 256, 3, bright), true));
    return t;
  }
  private buildMaterials() {
    const f = K.finishOf(this.prefs.finish), cf = K.finishOf(carveOf(f.id));
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
    const brass = K.brassCanvases();
    const bmap = this.keep(K.rtex(brass.map)), brough = this.keep(K.rtex(brass.rough, false));
    this.M = {
      // [clock14] the woods start as the painted stand-ins and take the real scans (useRealWood) once loaded
      wood: std({ map: this.woodTex(f.id, -0.1), color: 0x957a6c, vertexColors: true, roughness: 0.5, envMapIntensity: 0.55 }),
      carve: std({ map: this.woodTex(cf.id, -0.08), vertexColors: true, roughness: 0.46, envMapIntensity: 0.6 }),
      leaf: std({ map: this.keep(K.ctex(K.leafCanvas(cf.ramp))), vertexColors: true, roughness: 0.48, envMapIntensity: 0.6 }),
      feather: std({ map: this.keep(K.ctex(K.featherCanvas(cf.ramp), true)), vertexColors: true, roughness: 0.5, envMapIntensity: 0.6 }),
      roof: std({ map: this.keep(K.ctex(K.shingleCanvas())), vertexColors: true, roughness: 0.82 }),
      dark: std({ color: 0x1a0e08, roughness: 0.95, side: THREE.BackSide }),
      // [clock14] brass with a patina: polished where hands touch it, a brown tarnish in blotches, duller there
      brass: std({ map: bmap, roughnessMap: brough, color: 0xffffff, metalness: 0.95, roughness: 1, envMapIntensity: 1.2 }),
      brassDark: std({ map: bmap, roughnessMap: brough, color: 0xb08a58, metalness: 0.9, roughness: 1, envMapIntensity: 1.05 }),
      steel: std({ color: 0x141a30, metalness: 0.75, roughness: 0.3, envMapIntensity: 1.1 }),
      bronze: std({ color: 0x8a6a46, vertexColors: true, metalness: 0.78, roughness: 0.42, envMapIntensity: 1.1 }),
      enamel: std({ map: this.keep(dialTex()), roughness: 0.16, envMapIntensity: 0.7 }),
      glass: std({ color: 0xd77a1e, roughness: 0.08, metalness: 0.1, emissive: 0x3a1600, envMapIntensity: 1.5 }),
      linden: std({ map: this.keep(K.ctex(K.woodCanvas(K.FINISHES[3].ramp, 128, 256, 17, 0.04), true)), vertexColors: true, roughness: 0.6, envMapIntensity: 0.4 }),
      oak: std({ map: this.keep(K.ctex(K.woodCanvas(K.FINISHES[1].ramp, 128, 256, 29), true)), vertexColors: true, roughness: 0.55, envMapIntensity: 0.45 }),
      wallpaper: std({ map: this.keep(K.ctex(K.wallpaperCanvas(), true)), roughness: 0.88, envMapIntensity: 0.25 }),
      wainscot: std({ map: this.keep(K.ctex(K.wainscotCanvas(), true)), roughness: 0.6, envMapIntensity: 0.35 }),
      twine: std({ color: 0xc9ad7c, roughness: 1 }),
      iron: std({ color: 0x2e2a28, metalness: 0.6, roughness: 0.5 }),
      wax: std({ color: 0xf4e6c8, roughness: 0.6, emissive: 0x2a1404 }),
      flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffc46a).multiplyScalar(3.2), toneMapped: true }),
      chimney: std({ color: 0xfff4e4, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, envMapIntensity: 1.6, depthWrite: false }),
      shadow: new THREE.MeshBasicMaterial({ map: this.shadowBlob, transparent: true, depthWrite: false, opacity: 0.5, color: 0x1a0f08 }),
      red: std({ color: 0x8a2620, roughness: 0.7 }),
    };
    this.M.roof.userData.k = 1;
  }

  /** [clock14] The real wood (scans through our finishes), the aged shingles; resolves when they're on. */
  private real: K.RealWood | null = null;
  private bumps: THREE.Texture[] = [];
  private useRealWood(): Promise<void> {
    return K.realWood().then((src) => {
      if (!src || this.dead) return;
      this.real = src;
      const bump = (tile: number) => (this.bumps[tile] ??= this.keep(K.rtex(K.realBumpCanvas(src, tile), false)));
      const set = (m: THREE.Material, map: THREE.Texture, tile: number, o: { rough?: number; env?: number; bump?: number } = {}) => {
        const s = m as THREE.MeshStandardMaterial;
        s.map = map; s.color.setHex(0xffffff);
        s.bumpMap = bump(tile); s.bumpScale = o.bump ?? 1.2;
        s.roughness = o.rough ?? 0.52; s.envMapIntensity = o.env ?? 0.32;
        s.needsUpdate = true;
      };
      this.realFinish(this.prefs.finish);
      // the tags, the shelf, the boards and the dado rail (only on the Clock screen's wall)
      if (!this.bare) {
        set(this.M.linden, this.keep(K.rtex(K.realWoodCanvas(src, 'linden', -0.03, 512))), 1, { rough: 0.62 });
        set(this.M.oak, this.keep(K.rtex(K.realWoodCanvas(src, 'oak', 0, 512))), 1, { rough: 0.55 });
      }
      set(this.M.roof, this.keep(K.rtex(K.realShingleCanvas(src))), 2, { rough: 0.86, env: 0.15, bump: 2.2 });
    });
  }
  /** The case and the carvings in a finish, from the scans. */
  private realFinish(id: string) {
    const src = this.real;
    if (!src) return;
    const cid = carveOf(id);
    const bump = (tile: number) => this.bumps[tile] ?? (this.bumps[tile] = this.keep(K.rtex(K.realBumpCanvas(src, tile), false)));
    const put = (m: THREE.Material, c: HTMLCanvasElement, tile: number, rough: number, env: number) => {
      const s = m as THREE.MeshStandardMaterial;
      if (s.map && !this.bumps.includes(s.map)) { this.tex = this.tex.filter((t) => t !== s.map); s.map.dispose(); }
      s.map = this.keep(K.rtex(c)); s.color.setHex(0xffffff);
      s.bumpMap = bump(tile); s.bumpScale = 1.2; s.roughness = rough; s.envMapIntensity = env;
      s.needsUpdate = true;
    };
    put(this.M.wood, K.realWoodCanvas(src, id, -0.02), K.REAL[id]?.tile ?? 0, 0.5, 0.3);
    put(this.M.carve, K.realWoodCanvas(src, cid, -0.07), K.REAL[cid]?.tile ?? 1, 0.48, 0.32);
    // the carved leaves and the crest's plumage (not on the plain clock)
    if (!this.plain) {
      put(this.M.leaf, K.realLeafCanvas(src, cid), 1, 0.5, 0.3);
      put(this.M.feather, K.realFeatherCanvas(src, cid), 1, 0.52, 0.3);
    }
  }

  /** Change the wood of the case and the carvings. */
  setFinish(id: string) {
    const f = K.finishOf(id);
    this.prefs.finish = f.id;
    if (this.real) { this.realFinish(f.id); return; }
    const cf = K.finishOf(carveOf(f.id));
    const swap = (m: THREE.Material, t: THREE.Texture) => { const s = m as THREE.MeshStandardMaterial; s.map?.dispose(); s.map = t; s.needsUpdate = true; };
    swap(this.M.wood, this.woodTex(f.id, -0.1));
    swap(this.M.carve, this.woodTex(cf.id, -0.08));
    swap(this.M.leaf, this.keep(K.ctex(K.leafCanvas(cf.ramp))));
    swap(this.M.feather, this.keep(K.ctex(K.featherCanvas(cf.ramp), true)));
  }

  // ---------------------------------------------------------------- light

  private buildLights() {
    const S = this.scene;
    S.add(this.hemi);
    const k = this.key;
    k.position.set(-2.8, 3.4, 3.0);
    k.target.position.set(0.1, -0.2, 0);
    k.castShadow = true;
    k.shadow.mapSize.set(2048, 2048);
    const sc = k.shadow.camera;
    sc.left = -2.1; sc.right = 2.1; sc.top = 2.0; sc.bottom = -2.4; sc.near = 1; sc.far = 12;
    k.shadow.bias = -0.0003; k.shadow.normalBias = 0.012; k.shadow.radius = 4;
    S.add(k, k.target);
    // daylight through a window off to the left: a soft warm pool across the wall
    this.sun.position.set(-2.6, 2.6, 2.4);
    this.sun.target.position.set(0.2, 0.2, 0);
    S.add(this.sun, this.sun.target);
    this.moon.position.set(3, 2.5, 3);
    S.add(this.moon);
  }

  /** Day, dusk or night: the window's share, the candles' share, the fill. */
  private applyLight() {
    const n = this.nightFn ? this.nightFn() : nightNow();
    this.night = n;
    const L = THREE.MathUtils.lerp;
    this.hemi.intensity = L(0.4, 0.09, n);
    this.hemi.color.setHex(n > 0.5 ? 0x7d8cc4 : 0xfff0dc);
    this.hemi.groundColor.setHex(n > 0.5 ? 0x24160e : 0x5a3a24);
    this.key.intensity = L(1.35, 0.2, n);
    this.key.color.setHex(n > 0.5 ? 0xffc890 : 0xffe6c4);
    this.sun.intensity = L(15, 0, n);
    this.moon.intensity = L(0, 0.22, n);
    for (const l of this.lamps) l.light.userData.base = L(1.1, 2.6, n);
    this.look.exposure = L(1.02, 1.04, n);
    this.look.warm = L(0.04, 0.07, n); // [look12] cosy, not orange
  }

  // ---------------------------------------------------------------- the wall

  private buildWall() {
    const S = this.scene;
    const paper = new THREE.PlaneGeometry(9, 5.2);
    K.scaleUV(paper, 9 / 0.2, 5.2 / 0.2);
    const wp = this.mesh(paper, this.M.wallpaper, false, true);
    wp.position.set(0, DADO + 2.6, 0);
    S.add(wp);
    const wg = new THREE.PlaneGeometry(9, 3);
    K.scaleUV(wg, 9 / 0.44, 3 / 0.44);
    const wa = this.mesh(wg, this.M.wainscot, false, true);
    wa.position.set(0, DADO - 1.5, 0.02);
    S.add(wa);
    // the dado rail: a moulded oak rail between the wallpaper and the panelling
    const rail = K.merge([
      { geo: K.slab(9, 0.05, 0.03, 0.006), m: mtx(0, DADO + 0.005, 0) },
      { geo: K.slab(9, 0.018, 0.04, 0.006), m: mtx(0, DADO + 0.03, 0) },
      { geo: K.slab(9, 0.014, 0.034, 0.004), m: mtx(0, DADO - 0.022, 0) },
    ], WOOD_TILE);
    K.carveShade(rail, { lo: 0.55 });
    S.add(this.mesh(rail, this.M.oak, true, true));
    // soft contact darkening behind the clock (it hangs close to the wall)
    const ao = this.mesh(new THREE.PlaneGeometry(1.5, 2.7), this.M.shadow, false, false);
    ao.position.set(0.04, 0.32, 0.003);
    ao.renderOrder = 1;
    S.add(ao);
  }

  // ---------------------------------------------------------------- the clock

  private buildClock(): { hour: THREE.Group; minute: THREE.Group } {
    const S = this.scene;
    const wood: Part[] = [], carve: Part[] = [], leaves: Part[] = [], brass: Part[] = [];
    // ---- the case: back, sides, front panel, a moulded frame, turned columns, plinth and cornice
    wood.push({ geo: K.slab(CW - 0.02, CH, 0.02), m: mtx(0, CH / 2, 0.002) });
    wood.push({ geo: K.slab(CD - 0.02, CH, 0.02), m: mtx(CW / 2 - 0.02, CH / 2, CD / 2, 0, Math.PI / 2, 0) });
    wood.push({ geo: K.slab(CD - 0.02, CH, 0.02), m: mtx(-CW / 2 + 0.02, CH / 2, CD / 2, 0, -Math.PI / 2, 0) });
    wood.push({ geo: K.slab(CW, CH, 0.02), m: mtx(0, CH / 2, CD - 0.02) });
    const frame = K.rect(CW, CH, 0, CH / 2);
    frame.holes.push(K.rectPath(CW - 0.07, CH - 0.07, 0, CH / 2));
    carve.push({ geo: K.scaleUV(K.extrude(frame, 0.016, 0.006, 2), 4, 2), m: mtx(0, 0, CD), frame: true });
    const inner = K.rect(CW - 0.1, CH - 0.1, 0, CH / 2);
    inner.holes.push(K.rectPath(CW - 0.13, CH - 0.13, 0, CH / 2));
    carve.push({ geo: K.scaleUV(K.extrude(inner, 0.008, 0.003, 1), 4, 2), m: mtx(0, 0, CD), frame: true });
    // side panels: a raised frame on each side
    for (const sx of [-1, 1]) {
      const sf = K.rect(CD - 0.02, CH, 0, CH / 2);
      sf.holes.push(K.rectPath(CD - 0.08, CH - 0.08, 0, CH / 2));
      carve.push({ geo: K.scaleUV(K.extrude(sf, 0.01, 0.003), 4, 2), m: mtx(sx * CW / 2, 0, CD / 2 - 0.0, 0, sx * Math.PI / 2, 0), frame: true });
    }
    wood.push({ geo: K.slab(CW + 0.07, 0.055, CD + 0.04, 0.008), m: mtx(0, -0.0275, 0) });
    wood.push({ geo: K.slab(CW + 0.03, 0.02, CD + 0.02, 0.005), m: mtx(0, 0.008, 0) });
    wood.push({ geo: K.slab(CW + 0.08, 0.035, CD + 0.05, 0.008), m: mtx(0, CH + 0.0175, 0) });
    wood.push({ geo: K.slab(CW + 0.035, 0.016, CD + 0.025, 0.004), m: mtx(0, CH - 0.004, 0) });
    // ---- the apron: carved fretwork under the plinth
    carve.push({ geo: K.scaleUV(K.extrude(K.apronShape(CW + 0.02, 0.128), 0.014, 0.004, 1, 10), 4, 2), m: mtx(0, -0.055, CD + 0.01) });
    // ---- the gable: a wall with the arched door opening, a carved arch round the door and a crescent moon
    const gb = (RIDGE - GABLE_Y - 0.018) / TANA;
    const gable = new THREE.Shape();
    gable.moveTo(-gb, 0); gable.lineTo(gb, 0); gable.lineTo(0, gb * TANA); gable.closePath();
    gable.holes.push(K.archPath(DOOR.w, DOOR.h, 0, DOOR.y - GABLE_Y));
    wood.push({ geo: K.scaleUV(K.extrude(gable, 0.02, 0.003), 4, 2), m: mtx(0, GABLE_Y, GABLE_Z) });
    const archS = K.arch(DOOR.w + 0.036, DOOR.h + 0.02, 0, -0.002);
    archS.holes.push(K.archPath(DOOR.w, DOOR.h, 0, 0));
    carve.push({ geo: K.scaleUV(K.extrude(archS, 0.012, 0.004, 2), 4, 2), m: mtx(0, DOOR.y, GABLE_Z + 0.02) });
    // the dark little room behind the door
    const room = this.mesh(new THREE.BoxGeometry(0.19, 0.23, 0.2), this.M.dark, false, false);
    room.position.set(0, GABLE_Y + 0.115, GABLE_Z - 0.1);
    S.add(room);
    // ---- the roof: boards, shingles, a ridge cap, scalloped bargeboards, acorn drops at the eaves
    const roofParts: Part[] = [];
    const L = EAVE / Math.cos(ANG), D = ROOF_Z - 0.005;
    const shingle = (() => {
      const w = 0.058, sl = 0.085, rc = 0.013, s = new THREE.Shape();
      s.moveTo(-w / 2, sl); s.lineTo(-w / 2, rc); s.quadraticCurveTo(-w / 2, 0, -w / 2 + rc, 0); s.lineTo(w / 2 - rc, 0); s.quadraticCurveTo(w / 2, 0, w / 2, rc); s.lineTo(w / 2, sl); s.closePath();
      const g = K.extrude(s, 0.006, 0.0014, 1, 3);
      return { g, w, sl };
    })();
    const rnd = K.seeded(41);
    for (const sx of [1, -1]) {
      const d = v3(sx * Math.cos(ANG), -Math.sin(ANG), 0), n = v3(sx * Math.sin(ANG), Math.cos(ANG), 0), e = n.clone().cross(d);
      const basis = new THREE.Matrix4().makeBasis(d, e, n);
      const at = (lx: number, ly: number, lz: number) => new THREE.Matrix4().makeTranslation(0, RIDGE, (ROOF_Z + 0.005) / 2).multiply(basis).multiply(new THREE.Matrix4().makeTranslation(lx, ly, lz));
      wood.push({ geo: K.slab(L, D, ROOF_T, 0.003), m: at(L / 2, 0, 0) });
      // shingle rows from the eave up to the ridge
      const rows = Math.ceil(L / 0.056);
      for (let r = 0; r < rows; r++) {
        const lx = L - 0.004 - r * 0.056;
        const cols = Math.ceil(D / shingle.w) + 1;
        for (let c = 0; c < cols; c++) {
          const ly = -D / 2 + (c + (r % 2 ? 0.5 : 0)) * shingle.w - 0.004;
          if (ly > D / 2 + 0.01 || ly < -D / 2 - 0.02) continue;
          const g = shingle.g.clone();
          const v = Math.floor(rnd() * 4), tone = 0.78 + rnd() * 0.3;
          const uv = g.attributes.uv as THREE.BufferAttribute, p = g.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < uv.count; i++) uv.setXY(i, (v + p.getX(i) / shingle.w + 0.5) / 4, p.getY(i) / shingle.sl);
          const col = new Float32Array(p.count * 3).fill(tone);
          g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
          // the rounded end toward the eave, tilted so each row laps over the one below
          const m = at(Math.max(shingle.sl + 0.004, Math.min(L, lx)), Math.max(-D / 2 + 0.03, Math.min(D / 2 - 0.03, ly)) , ROOF_T + 0.0005).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationX(-0.075)).multiply(new THREE.Matrix4().makeTranslation(0, 0, shingle.sl * 0.075));
          roofParts.push({ geo: g, m });
        }
      }
      // the bargeboard under the front edge (the left one is the right one turned round)
      const bh = 0.062, bl = L * 1.0;
      const bb = K.scaleUV(K.extrude(K.bargeboard(bl, bh, 7, false), 0.014, 0.0035, 1, 6), 4, 2);
      const mR = new THREE.Matrix4().makeTranslation(0, RIDGE, ROOF_Z - 0.012).multiply(new THREE.Matrix4().makeRotationZ(-ANG)).multiply(new THREE.Matrix4().makeTranslation(0, -bh, 0));
      carve.push({ geo: bb, m: sx > 0 ? mR : new THREE.Matrix4().makeTranslation(0, 0, 2 * (ROOF_Z - 0.012) + 0.014).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(mR) });
      // an acorn drop under each eave
      carve.push({ geo: K.turned(K.finialProfile(0.07, 0.018), 10, 8), m: mtx(sx * (EAVE - 0.02), RIDGE - (EAVE - 0.02) * TANA - 0.032, ROOF_Z - 0.006, Math.PI, 0, 0) });
    }
    shingle.g.dispose();
    // the ridge cap: a rounded board along the top
    wood.push({ geo: K.turned([[0.0005, 0], [0.018, 0.004], [0.022, 0.02], [0.018, ROOF_Z - 0.03], [0.0005, ROOF_Z - 0.02]], 10, 6), m: mtx(0, RIDGE + 0.012, 0.01, Math.PI / 2, 0, 0) });
    const roofG = K.merge(roofParts);
    S.add(this.mesh(roofG, this.M.roof));
    // ---- the balcony: a floor, turned balusters, rails, newel posts with acorn finials
    const balF = K.slab(BAL.w, BAL.z1 - BAL.z0, 0.012, 0.003);
    carve.push({ geo: balF, m: mtx(0, BAL.y, (BAL.z0 + BAL.z1) / 2, -Math.PI / 2, 0, 0) });
    const bH = 0.046, bY = BAL.y + 0.012;
    const bal = K.balusterProfile(bH, 0.008);
    for (let i = 0; i < 7; i++) carve.push({ geo: K.turned(bal, 8, 8), m: mtx(-BAL.w / 2 + 0.043 + i * ((BAL.w - 0.086) / 6), bY, BAL.z1 - 0.012) });
    for (const sx of [-1, 1]) for (const z of [0.285, 0.322]) carve.push({ geo: K.turned(bal, 8, 8), m: mtx(sx * (BAL.w / 2 - 0.012), bY, z) });
    carve.push({ geo: K.slab(BAL.w, 0.022, 0.011, 0.003), m: mtx(0, bY + bH, BAL.z1 - 0.012, -Math.PI / 2, 0, 0) });
    for (const sx of [-1, 1]) {
      carve.push({ geo: K.slab(0.022, BAL.z1 - BAL.z0 - 0.02, 0.011, 0.003), m: mtx(sx * (BAL.w / 2 - 0.012), bY + bH, (BAL.z0 + BAL.z1) / 2 - 0.01, -Math.PI / 2, 0, 0) });
      carve.push({ geo: K.turned(K.columnProfile(bH + 0.02, 0.011), 10, 8), m: mtx(sx * (BAL.w / 2 - 0.012), bY - 0.002, BAL.z1 - 0.012) });
      carve.push({ geo: K.turned(K.finialProfile(0.04, 0.013), 10, 8), m: mtx(sx * (BAL.w / 2 - 0.012), bY + bH + 0.018, BAL.z1 - 0.012) });
    }
    // ---- carved oak leaves and acorns: a garland over the dial, clusters in the corners
    const nut: Part[] = [], cup: Part[] = [];
    const { nut: nutG, cup: cupG } = K.acornGeo(1);
    const acorn = (x: number, y: number, z: number, rz: number, s = 1) => {
      nut.push({ geo: nutG.clone(), m: mtx(x, y, z, 0, 0, rz, s) });
      cup.push({ geo: cupG.clone(), m: mtx(x, y, z, 0, 0, rz, s) });
    };
    const leaf = (x: number, y: number, z: number, rz: number, len: number, wid: number, seed: number, curl = 0.25) =>
      leaves.push({ geo: K.leafGeo(len, wid, { seed, curl, fold: 0.16, t: 0.3, lobes: 3.2 + (seed % 3) * 0.3 }), m: mtx(x, y, z, 0, 0, rz) });
    const fz = CD + 0.004;
    // [clock12] four big carved oak leaves in the corners round the dial, two acorns under each lower one (as painted)
    if (!this.plain) for (const [sx, sy, seed] of [[-1, 1, 3], [1, 1, 5], [-1, -1, 7], [1, -1, 9]] as [number, number, number][]) {
      const a = Math.atan2(sy, sx) - sx * sy * 0.05, r0 = 0.275;
      leaf(Math.cos(a) * r0, DIAL.y + Math.sin(a) * r0, fz, a, 0.24, 0.15, seed, 0.16);
    }
    if (!this.plain) for (const sx of [-1, 1]) {
      acorn(sx * 0.236, DIAL.y - 0.243, fz + 0.045, -sx * 0.35, 1.25);
      acorn(sx * 0.279, DIAL.y - 0.214, fz + 0.04, sx * 0.25, 1.15);
    }
    // ---- the crest: a carved owl with spread wings on a fan of oak leaves
    const crest = K.owlCrest(0.36, 0, this.plain ? 0 : 0.62);
    const crestAt = mtx(0, RIDGE - 0.004, ROOF_Z - 0.05);
    crest.geo.applyMatrix4(crestAt); crest.feather.applyMatrix4(crestAt); crest.eyes.applyMatrix4(crestAt);
    // ---- the pendulum: a brass rod and a carved leaf bob with a brass boss
    this.pend.position.set(0, PEND.y, PEND.z);
    const rod = this.mesh(K.prep(K.slab(0.007, PEND.len, 0.003, 0.001)).translate(0, -PEND.len / 2, 0), this.M.brass);
    this.pend.add(rod);
    let bobM: THREE.Mesh;
    if (this.plain) {
      // a domed brass disc with a turned rim
      bobM = this.mesh(K.prep(K.turned([[0.0005, 0], [0.068, 0], [0.074, 0.005], [0.07, 0.011], [0.058, 0.016], [0.03, 0.02], [0.0005, 0.021]], 40, 20)).rotateX(Math.PI / 2).translate(0, -PEND.len - 0.04, 0.004), this.M.brass);
    } else {
      const bob = K.leafGeo(0.2, 0.15, { seed: 77, curl: 0.12, fold: 0.1, lobes: 3.6 });
      bob.applyMatrix4(mtx(0, -PEND.len + 0.03, 0.002, 0, 0, -Math.PI / 2));
      bobM = this.mesh(K.carveShade(K.prep(bob), { lo: 0.5 }), this.M.leaf);
    }
    this.pend.add(bobM);
    const boss = this.mesh(K.prep(K.turned([[0.0005, 0], [0.024, 0.002], [0.026, 0.008], [0.016, 0.014], [0.0005, 0.016]], 14, 20)).rotateX(Math.PI / 2).translate(0, -PEND.len - 0.04, 0.028), this.M.brass);
    if (!this.plain) this.pend.add(boss);
    this.pick(bobM, 'pendulum');
    S.add(this.pend);
    // ---- the dial: a turned wooden dial board, the enamel, a brass bezel, the hands
    const board = K.turned([[0.0005, 0], [DIAL.r + 0.03, 0], [DIAL.r + 0.034, 0.005], [DIAL.r + 0.028, 0.012], [0.0005, 0.012]], 40, 6);
    carve.push({ geo: board, m: mtx(0, DIAL.y, CD, Math.PI / 2, 0, 0) });
    const face = this.mesh(new THREE.CircleGeometry(DIAL.r, 64), this.M.enamel, false, true);
    face.position.set(0, DIAL.y, CD + 0.0125);
    S.add(face);
    this.pick(face, 'dial');
    brass.push({ geo: K.turned([[DIAL.r - 0.004, 0], [DIAL.r + 0.001, 0.009], [DIAL.r + 0.012, 0.014], [DIAL.r + 0.022, 0.01], [DIAL.r + 0.026, 0.003], [DIAL.r + 0.026, 0]], 64, 6), m: mtx(0, DIAL.y, CD + 0.011, Math.PI / 2, 0, 0) });
    const handG = (g: THREE.BufferGeometry, z: number) => { const grp = new THREE.Group(); grp.position.set(0, DIAL.y, z); const m = this.mesh(K.prep(g), this.M.steel, true, false); grp.add(m); S.add(grp); return grp; };
    const hour = handG(K.handGeo(0.15, 'hour'), CD + 0.017);
    const minute = handG(K.handGeo(0.215, 'minute'), CD + 0.0215);
    brass.push({ geo: K.turned([[0.0005, 0], [0.013, 0], [0.012, 0.004], [0.007, 0.008], [0.004, 0.012], [0.0005, 0.013]], 14, 20), m: mtx(0, DIAL.y, CD + 0.025, Math.PI / 2, 0, 0) });
    // ---- merge and add
    const woodG = K.carveShade(K.merge(wood, WOOD_TILE), { lo: 0.5 });
    // the plain clock (loading screen, office) has no carved owl crest on the roof
    const carveG = K.carveShade(K.merge(this.plain ? carve : [...carve, { geo: crest.geo }], WOOD_TILE), { lo: 0.36 });
    S.add(this.mesh(woodG, this.M.wood), this.mesh(carveG, this.M.carve));
    if (!this.plain) S.add(this.mesh(K.carveShade(crest.feather, { lo: 0.45 }), this.M.feather));
    if (leaves.length) S.add(this.mesh(K.carveShade(K.merge(leaves), { lo: 0.22, z0: CD, z1: CD + 0.035 }), this.M.leaf));
    if (!this.plain) S.add(this.mesh(crest.eyes, this.M.glass, false, false));
    S.add(this.mesh(K.merge(brass), this.M.brass));
    if (nut.length) S.add(this.mesh(K.carveShade(K.merge(nut), { lo: 0.5 }), this.M.carve), this.mesh(K.carveShade(K.merge(cup), { lo: 0.3, hi: 0.75 }), this.M.wood));
    nutG.dispose(); cupG.dispose();
    // the door: planked, with iron strap hinges and a brass knob, hinged on its left
    const door = K.scaleUV(K.extrude(K.arch(DOOR.w - 0.004, DOOR.h - 0.003, 0, 0), 0.01, 0.0025, 1, 10), 4, 2);
    const doorM = this.mesh(K.carveShade(K.woodUV(K.prep(door), WOOD_TILE, 77), { lo: 0.55 }), this.M.wood);
    doorM.position.set(DOOR.w / 2, 0, 0);
    this.doorPivot.add(doorM);
    for (const y of [0.03, DOOR.h - 0.06]) {
      const hinge = this.mesh(K.prep(K.slab(0.05, 0.008, 0.002, 0.0006)), this.M.iron);
      hinge.position.set(0.027, y, 0.0105);
      this.doorPivot.add(hinge);
    }
    const knob = this.mesh(K.prep(K.turned([[0.0005, 0], [0.006, 0.001], [0.004, 0.006], [0.007, 0.01], [0.0005, 0.013]], 10, 20)).rotateX(Math.PI / 2), this.M.brass);
    knob.position.set(DOOR.w - 0.018, 0.06, 0.011);
    this.doorPivot.add(knob);
    this.doorPivot.position.set(-DOOR.w / 2, DOOR.y, DOOR.z);
    S.add(this.doorPivot);
    this.pick(doorM, 'door');
    // pick boxes: the gable and balcony, the crest
    this.hitBox(0.4, 0.32, 0.2, v3(0, DOOR.y + 0.11, 0.3), 'door');
    if (!this.plain) this.hitBox(0.44, 0.34, 0.14, v3(0, RIDGE + 0.15, ROOF_Z - 0.02), 'crest');
    return { hour, minute };
  }

  private hitBox(w: number, h: number, d: number, at: THREE.Vector3, id: string) {
    const m = new THREE.Mesh(this.keepG(new THREE.BoxGeometry(w, h, d)), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.copy(at);
    this.scene.add(m);
    this.pick(m, id);
    return m;
  }

  // ---------------------------------------------------------------- weights and chains

  private buildWeights(): THREE.InstancedMesh {
    const cone = this.keepG(K.pineConeGeo(0.22, 0.05));
    const ringG = this.keepG(new THREE.TorusGeometry(0.02, 0.0042, 8, 20));
    for (let i = 0; i < 2; i++) {
      const c = new THREE.Mesh(cone, this.M.bronze);
      c.castShadow = true; c.receiveShadow = true;
      this.scene.add(c);
      this.cones.push(c);
      this.pick(c, 'weight:' + i);
      const r = new THREE.Mesh(ringG, this.M.brass);
      r.castShadow = true;
      this.scene.add(r);
      this.rings.push(r);
      this.pick(r, 'weight:' + i);
    }
    const links = new THREE.InstancedMesh(this.keepG(K.linkGeo()), this.M.brass, 4 * 60);
    links.castShadow = true;
    links.frustumCulled = false;
    this.scene.add(links);
    // a pick box round each pair of chains
    for (let i = 0; i < 2; i++) this.hitBox(0.14, 0.6, 0.1, v3((WEIGHTS[i].x + WEIGHTS[i].ring) / 2, -0.42, CHAIN.z), 'weight:' + i);
    return links;
  }

  /** How far the weights have dropped (0 = just wound, 1 = run down) from the prefs, plus a live winding pull. */
  private setDrops(snap = false) {
    for (let i = 0; i < 2; i++) {
      const want = Math.max(0, Math.min(1, (Date.now() - this.prefs.wound[i]) / 86400_000));
      this.drop[i] = snap ? want : this.drop[i] + (want - this.drop[i]) * 0.12;
    }
    this.placeChains();
  }
  private placeChains() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), qy = new THREE.Quaternion().setFromAxisAngle(v3(0, 1, 0), Math.PI / 2), sc = v3(1, 1, 1);
    let n = 0;
    const SP = 0.0155;
    for (let i = 0; i < 2; i++) {
      const W = WEIGHTS[i], f = this.drop[i];
      const wy = THREE.MathUtils.lerp(CHAIN.wTop, CHAIN.wBot, f), ry = THREE.MathUtils.lerp(CHAIN.wBot, CHAIN.wTop, f) - 0.02;
      this.cones[i].position.set(W.x, wy, CHAIN.z);
      this.rings[i].position.set(W.ring, ry - 0.016, CHAIN.z);
      for (const [x, bottom] of [[W.x, wy + 0.012], [W.ring, ry + 0.004]] as [number, number][]) {
        for (let y = CHAIN.top; y > bottom && n < 240; y -= SP) {
          m.compose(v3(x, y, CHAIN.z), (Math.round((CHAIN.top - y) / SP) % 2) ? qy : q, sc);
          this.links.setMatrixAt(n++, m);
        }
      }
    }
    this.links.count = n;
    this.links.instanceMatrix.needsUpdate = true;
  }

  /** Pull a weight up to the top (winding the clock). */
  windUp(i: number) {
    this.prefs.wound[i] = Date.now();
    sound.play('clock_wind', { volume: 0.45 });
    setTimeout(() => { if (!this.dead) sound.play('clock_wind', { volume: 0.35, rate: 1.15 }); }, 380);
  }

  // ---------------------------------------------------------------- the tags

  private buildTags() {
    const ids: [string, number, number][] = [['week', -1, 0], ['avg', -1, 1], ['streak', 1, 0], ['bed', 1, 1]];
    const shape = new THREE.Shape(), w = TAG.w, h = TAG.h, c = 0.06;
    shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2 - c); shape.lineTo(w / 2 - c, h / 2); shape.lineTo(-w / 2 + c, h / 2); shape.lineTo(-w / 2, h / 2 - c); shape.closePath();
    const top = shape.clone(); top.holes = [K.circlePath(0.011, 0, TAG_HOLE_T, 10)];
    const both = shape.clone(); both.holes = [K.circlePath(0.011, 0, TAG_HOLE_T, 10), K.circlePath(0.011, 0, TAG_HOLE_B, 10)];
    const geoTop = this.keepG(K.carveShade(K.prep(K.scaleUV(K.extrude(top, TAG.t, 0.004, 2), 3, 1.5)), { lo: 0.5 }));
    const geoBoth = this.keepG(K.carveShade(K.prep(K.scaleUV(K.extrude(both, TAG.t, 0.004, 2), 3, 1.5)), { lo: 0.5 }));
    const decalG = this.keepG(new THREE.PlaneGeometry(TAG_DECAL.w, TAG_DECAL.h));
    const twineG = this.keepG(new THREE.CylinderGeometry(0.0026, 0.0026, 1, 5).translate(0, -0.5, 0));
    // brass brackets from the case sides: a rod with a ring at the end. Two under-the-case arms on a phone, four
    // long arms beside the case on a wide screen.
    const bracket = (y: number, reach: number): Part[] => [-1, 1].flatMap((sx) => [
      { geo: K.turned([[0.0005, 0], [0.016, 0], [0.016, 0.004], [0.006, 0.008], [0.0045, reach - CW / 2 + 0.002], [0.0005, reach - CW / 2 + 0.004]], 8, 10), m: mtx(sx * CW / 2, y, TAG_Z, 0, 0, -sx * Math.PI / 2) },
      { geo: new THREE.TorusGeometry(0.011, 0.0038, 6, 12), m: mtx(sx * reach, y - 0.011, TAG_Z, 0, Math.PI / 2, 0) },
    ]);
    this.brackets.top = this.mesh(K.merge(bracket(TAG_LAY.top.hooks[0], TAG_LAY.top.x)), this.M.brass);
    this.brackets.side = this.mesh(K.merge([...bracket(TAG_LAY.side.hooks[0], TAG_LAY.side.x), ...bracket(TAG_LAY.side.hooks[1], TAG_LAY.side.x)]), this.M.brass);
    this.scene.add(this.brackets.top, this.brackets.side);
    for (const [id, side, row] of ids) {
      const [cv] = K.canvas(TAG_DECAL.px[0], TAG_DECAL.px[1]);
      const tex = this.keep(K.ctex(cv));
      const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
      this.M['tag_' + id] = mat;
      const body = this.mesh(row === 0 ? geoBoth : geoTop, this.M.linden);
      const decal = new THREE.Mesh(decalG, mat);
      decal.receiveShadow = true;
      const twine = this.mesh(twineG, this.M.twine, true, false);
      const pivot = new THREE.Group();
      pivot.add(body, decal, twine);
      this.scene.add(pivot);
      this.pick(body, 'tag:' + id); this.pick(decal, 'tag:' + id);
      this.tags.push({ id, pivot, body, decal, twine, c: cv, tex, phase: side * 1.7 + row * 2.3, label: '', value: '', side, row });
    }
  }

  /** Hang the tags for the layout: stacked in pairs under the case (phone), or two by two beside it (wide). */
  private placeTags() {
    const L = TAG_LAY[this.layout];
    this.brackets.top.visible = this.layout === 'top';
    this.brackets.side.visible = this.layout === 'side';
    for (const t of this.tags) {
      const k = L.k, hang = (t.row === 0 || this.layout === 'side' ? L.hang : L.hang2) / k;
      t.pivot.scale.setScalar(k);
      t.twine.scale.set(1, hang + 0.006, 1);
      t.body.position.set(0, -hang - TAG_HOLE_T, -TAG.t / 2);
      t.decal.position.set(0, t.body.position.y - 0.004, TAG.t / 2 + 0.0008);
      t.pivot.position.set(t.side * L.x, (this.layout === 'side' ? L.hooks[t.row] : L.hooks[0]) - 0.022, TAG_Z);
    }
  }

  /** Paint the four number tags (label above, the number below), two texels to a font pixel. */
  setStats(list: StatTag[]) {
    for (const s of list) {
      const t = this.tags.find((x) => x.id === s.id);
      if (!t || (t.label === s.label && t.value === s.value)) continue;
      t.label = s.label; t.value = s.value;
      const c = t.c, g = c.getContext('2d')!;
      g.clearRect(0, 0, c.width, c.height);
      K.pxText(g, s.label, c.width / 2, 18, 32, '#8c2c1e', { maxW: c.width - 4 });
      // a burnt rule under the label
      g.fillStyle = '#5a3a22';
      for (let x = 16; x < c.width - 16; x += 4) g.fillRect(x, 38, 2, 2);
      K.pxText(g, s.value, c.width / 2, 60, 32, '#26140b', { maxW: c.width - 4 });
      t.tex.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- the shelf and the little houses

  private buildShelf() {
    const parts: Part[] = [];
    parts.push({ geo: K.slab(SHELF.w, SHELF.h, SHELF.d, 0.008), m: mtx(0, SHELF.y - SHELF.h / 2, 0) });
    parts.push({ geo: K.slab(SHELF.w + 0.02, 0.016, SHELF.d + 0.012, 0.005), m: mtx(0, SHELF.y + 0.002 - 0.008, 0) });
    // carved scroll brackets fixed to the wall
    const br = new THREE.Shape();
    br.moveTo(0, 0); br.lineTo(0.22, 0); br.quadraticCurveTo(0.235, -0.03, 0.2, -0.045); br.quadraticCurveTo(0.12, -0.05, 0.08, -0.1);
    br.quadraticCurveTo(0.05, -0.15, 0.06, -0.19); br.quadraticCurveTo(0.03, -0.2, 0, -0.17); br.closePath();
    br.holes.push(K.circlePath(0.02, 0.13, -0.035, 10));
    for (const x of [-0.5, 0.5]) parts.push({ geo: K.scaleUV(K.extrude(br, 0.03, 0.006, 2), 4, 2), m: mtx(x + 0.015, SHELF.y - SHELF.h, 0, 0, -Math.PI / 2, 0) });
    this.scene.add(this.mesh(K.carveShade(K.merge(parts, WOOD_TILE), { lo: 0.5 }), this.M.oak));
    // painted day labels on the shelf's front edge
    const [lc] = K.canvas(Math.round(SHELF.w * DECAL_PPU), 16);
    const ltex = this.keep(K.ctex(lc));
    this.shelfLabels = { c: lc, tex: ltex };
    const lab = new THREE.Mesh(this.keepG(new THREE.PlaneGeometry(SHELF.w, 16 / DECAL_PPU)), new THREE.MeshStandardMaterial({ map: ltex, alphaTest: 0.5, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
    lab.position.set(0, SHELF.y - SHELF.h / 2 - 0.004, SHELF.d + 0.0008);
    this.scene.add(lab);
    this.M.labels = lab.material as THREE.Material;
    // the house atlas: seven fronts side by side (plus a glow map for the lit windows)
    const CWp = 40, CHp = 64;
    const [ac] = K.canvas(CWp * 7, CHp), [gc] = K.canvas(CWp * 7, CHp);
    const atex = this.keep(K.ctex(ac)), gtex = this.keep(K.ctex(gc));
    this.houseAtlas = { c: ac, glow: gc, tex: atex, glowTex: gtex };
    this.M.houseFront = new THREE.MeshStandardMaterial({ map: atex, emissiveMap: gtex, emissive: 0xffc070, emissiveIntensity: 1, roughness: 0.8 });
    this.M.house = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    for (let i = 0; i < 7; i++) { const g = new THREE.Group(); g.position.set((i - 3) * HOUSE.gap, SHELF.y, 0); this.scene.add(g); this.houses.push({ group: g, data: null, h: 0, bounce: 0 }); }
    // a contact shadow strip along the shelf under the houses
    const sh = this.mesh(new THREE.PlaneGeometry(SHELF.w - 0.06, SHELF.d - 0.04), this.M.shadow, false, false);
    sh.rotation.x = -Math.PI / 2; sh.position.set(0, SHELF.y + 0.0015, SHELF.d / 2);
    (sh.material as THREE.Material).opacity = 0.5;
    this.scene.add(sh);
  }

  /** The last seven nights as little houses: height = hours asleep, a lit window when the night was tracked. */
  setNights(list: NightHouse[]) {
    const A = this.houseAtlas, L = this.shelfLabels;
    if (!A || !L) return;
    const CWp = 40, CHp = 64;
    const g = A.c.getContext('2d')!, gg = A.glow.getContext('2d')!;
    g.clearRect(0, 0, A.c.width, A.c.height); gg.fillStyle = '#000'; gg.fillRect(0, 0, A.glow.width, A.glow.height);
    const lg = L.c.getContext('2d')!;
    lg.clearRect(0, 0, L.c.width, L.c.height);
    list.slice(0, 7).forEach((d, i) => {
      const H = this.houses[i];
      H.data = d;
      const hb = d.hours === null ? 0.07 : THREE.MathUtils.clamp(0.075 + (Math.max(0, d.hours - 4) / 6) * 0.13, 0.075, 0.205);
      const changed = Math.abs(H.h - hb) > 0.001;
      H.h = hb;
      if (changed) this.buildHouse(i, hb);
      // ---- the painted front (cell i), bottom-aligned: wall hb, gable above
      const wallPx = Math.round(hb * DECAL_PPU), gabPx = Math.round(HOUSE.gable * DECAL_PPU), x0 = i * CWp, yb = CHp - 1;
      const [pr, pg, pb] = K.hex(HOUSE_COLS[i % 7]);
      const lit = d.hours !== null;
      for (let y = 0; y < wallPx + gabPx; y++) for (let x = 0; x < CWp; x++) {
        const inG = y >= wallPx && Math.abs(x - CWp / 2 + 0.5) > (CWp / 2) * (1 - (y - wallPx) / gabPx);
        if (inG) continue;
        const n = (K.hex('#000000')[0] + ((x * 7 + y * 13 + i * 5) % 9) - 4) / 60;
        const k = (lit ? 1 : 0.72) * (1 + n);
        g.fillStyle = `rgb(${Math.round(pr * k)},${Math.round(pg * k)},${Math.round(pb * k)})`;
        g.fillRect(x0 + x, yb - y, 1, 1);
      }
      // timber frame: corner posts, the eaves beam, the gable rafters
      g.fillStyle = '#4a2c1a';
      g.fillRect(x0, yb - wallPx + 1, 2, wallPx); g.fillRect(x0 + CWp - 2, yb - wallPx + 1, 2, wallPx);
      g.fillRect(x0, yb - wallPx + 1, CWp, 2);
      for (let y = 0; y < gabPx; y++) { const hw = Math.round((CWp / 2) * (1 - y / gabPx)); g.fillRect(x0 + CWp / 2 - hw, yb - wallPx - y, 2, 1); g.fillRect(x0 + CWp / 2 + hw - 2, yb - wallPx - y, 2, 1); }
      // a round attic window in the gable
      const wx = x0 + CWp / 2, wy = yb - wallPx - Math.round(gabPx * 0.38);
      const win = (cx: number, cy: number, w: number, h: number, round: boolean) => {
        g.fillStyle = '#3a2416'; g.fillRect(cx - w / 2 - 1, cy - h / 2 - 1, w + 2, h + 2);
        g.fillStyle = lit ? '#ffd27a' : '#2b3550';
        if (round) { g.fillRect(cx - w / 2 + 1, cy - h / 2, w - 2, h); g.fillRect(cx - w / 2, cy - h / 2 + 1, w, h - 2); } else g.fillRect(cx - w / 2, cy - h / 2, w, h);
        g.fillStyle = '#3a2416'; g.fillRect(cx - 0.5, cy - h / 2, 1, h); g.fillRect(cx - w / 2, cy - 0.5, w, 1);
        if (lit) { gg.fillStyle = '#ffcf80'; gg.fillRect(cx - w / 2, cy - h / 2, w, h); gg.fillStyle = '#000'; gg.fillRect(cx - 0.5, cy - h / 2, 1, h); gg.fillRect(cx - w / 2, cy - 0.5, w, 1); }
      };
      win(wx, wy, 6, 6, true);
      if (wallPx > 30) win(wx, yb - wallPx + 3 + Math.round((wallPx - 20) / 2) - 2, 10, 9, false);
      // the hours on a cream plaque at the bottom
      g.fillStyle = '#3a2416'; g.fillRect(x0 + 2, yb - 15, CWp - 4, 15);
      g.fillStyle = d.today ? '#fff2c8' : '#efe0bd'; g.fillRect(x0 + 3, yb - 14, CWp - 6, 13);
      K.pxText(g, d.text, x0 + CWp / 2, yb - 7, 16, lit ? '#2a160c' : '#7a6650', { maxW: CWp - 6 });
      // the day under the house, on the shelf edge
      const lx = Math.round((((i - 3) * HOUSE.gap + SHELF.w / 2) / SHELF.w) * L.c.width);
      K.pxText(lg, d.day, lx, 8, 16, d.today ? '#8c2c1e' : '#2a160c');
    });
    A.tex.needsUpdate = true; A.glowTex.needsUpdate = true; L.tex.needsUpdate = true;
  }

  private buildHouse(i: number, hb: number) {
    const H = this.houses[i], G = H.group;
    for (const c of [...G.children]) { G.remove(c); (c as THREE.Mesh).geometry?.dispose(); }
    const w = HOUSE.w, d = HOUSE.d, gh = HOUSE.gable;
    // the walls with the gable, one extrusion (front at z = HOUSE.z + d)
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, hb); s.lineTo(0, hb + gh); s.lineTo(-w / 2, hb); s.closePath();
    const col = K.hex(HOUSE_COLS[i % 7]);
    const body = new THREE.Mesh(K.prep(K.extrude(s, d, 0.003, 1), col), this.M.house);
    body.position.z = HOUSE.z;
    body.castShadow = true; body.receiveShadow = true;
    // the front: painted (atlas cell i)
    const fg = new THREE.ShapeGeometry(s);
    const uv = fg.attributes.uv as THREE.BufferAttribute, p = fg.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (i + (p.getX(k) + w / 2) / w) / 7, (p.getY(k) * DECAL_PPU + 0.5) / 64);
    const front = new THREE.Mesh(fg, this.M.houseFront);
    front.position.z = HOUSE.z + d + 0.0006;
    front.receiveShadow = true;
    // the roof: two shingled boards meeting at the ridge, overhanging all round
    const ang = Math.atan(gh / (w / 2)), rl = (w / 2 + 0.022) / Math.cos(ang), rd = d + 0.036;
    const roof: Part[] = [];
    for (const sx of [1, -1]) {
      const dd = v3(sx * Math.cos(ang), -Math.sin(ang), 0), n = v3(sx * Math.sin(ang), Math.cos(ang), 0), e = n.clone().cross(dd);
      const m = new THREE.Matrix4().makeTranslation(0, hb + gh + 0.004, HOUSE.z + d / 2).multiply(new THREE.Matrix4().makeBasis(dd, e, n)).multiply(new THREE.Matrix4().makeTranslation(rl / 2, 0, 0));
      roof.push({ geo: K.scaleUV(K.slab(rl, rd, 0.01, 0.003), 1, 1), m });
    }
    // a little chimney on the right slope
    roof.push({ geo: K.slab(0.024, 0.05, 0.024, 0.003), m: mtx(w * 0.22, hb + gh * 0.55 + 0.022, HOUSE.z + d * 0.35) });
    const rg = K.merge(roof);
    const ruv = rg.attributes.uv as THREE.BufferAttribute, rp = rg.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < ruv.count; k++) ruv.setXY(k, ((rp.getX(k) + rp.getZ(k)) * 9) % 1 * 0.25 + (i % 4) * 0.25, rp.getY(k) * 9 + rp.getZ(k) * 4);
    const roofM = new THREE.Mesh(K.carveShade(rg, { lo: 0.6, hi: 0.95 }), this.M.roof);
    roofM.castShadow = true; roofM.receiveShadow = true;
    G.add(body, front, roofM);
    for (const m of [body, front, roofM]) this.pick(m, 'house:' + i);
    H.bounce = 1;
  }

  // ---------------------------------------------------------------- the clipboard and the calendar

  private buildBoards() {
    // the routine clipboard: an oak board, a brass clip, a sheet of paper, hung on a nail by a loop of twine
    {
      const G = this.boards.routine, bw = 0.56, bh = 0.74;
      const board = this.mesh(K.carveShade(K.prep(K.slab(bw, bh, 0.016, 0.005)), { lo: 0.6 }), this.M.oak);
      G.add(board);
      const pw = 0.5, ph = 0.62;
      const [c] = K.canvas(Math.round(pw * DECAL_PPU * 2), Math.round(ph * DECAL_PPU * 2));
      const tex = this.keep(K.ctex(c));
      this.paper.routine = { c, tex };
      paperBg(c.getContext('2d')!, c.width, c.height, '#f4ecd8', '#e6d9bc', 7);
      const paper = new THREE.Mesh(this.keepG(new THREE.PlaneGeometry(pw, ph)), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }));
      paper.position.set(0, -0.035, 0.0168);
      paper.receiveShadow = true;
      G.add(paper);
      const clip = new THREE.Shape();
      clip.moveTo(-0.11, -0.03); clip.lineTo(0.11, -0.03); clip.lineTo(0.12, 0.02); clip.quadraticCurveTo(0.12, 0.05, 0.08, 0.05); clip.lineTo(0.04, 0.05); clip.quadraticCurveTo(0.03, 0.08, 0, 0.08); clip.quadraticCurveTo(-0.03, 0.08, -0.04, 0.05); clip.lineTo(-0.08, 0.05); clip.quadraticCurveTo(-0.12, 0.05, -0.12, 0.02); clip.closePath();
      clip.holes.push(K.circlePath(0.014, 0, 0.055, 10));
      const cg = K.merge([{ geo: K.extrude(clip, 0.008, 0.0025, 2, 8), m: mtx(0, bh / 2 - 0.05, 0.016) }, { geo: K.turned([[0.0005, 0], [0.008, 0], [0.007, 0.005], [0.0005, 0.007]], 10, 20), m: mtx(-0.085, bh / 2 - 0.065, 0.024, Math.PI / 2) }, { geo: K.turned([[0.0005, 0], [0.008, 0], [0.007, 0.005], [0.0005, 0.007]], 10, 20), m: mtx(0.085, bh / 2 - 0.065, 0.024, Math.PI / 2) }]);
      G.add(this.mesh(cg, this.M.brass));
      this.hangOn(G, bw, bh);
      for (const m of [board, paper]) this.pick(m, 'routine');
      this.scene.add(G);
    }
    // the wall calendar: a kraft backing card, a pad of pages under a red header, a tin binding strip
    {
      const G = this.boards.calendar, bw = 0.52, bh = 0.72;
      const back = this.mesh(K.carveShade(K.prep(K.slab(bw, bh, 0.008, 0.002)), { lo: 0.7 }), this.M.linden);
      G.add(back);
      const pw = 0.48, ph = 0.64;
      const [c] = K.canvas(Math.round(pw * DECAL_PPU * 2), Math.round(ph * DECAL_PPU * 2));
      const tex = this.keep(K.ctex(c));
      this.paper.calendar = { c, tex };
      paperBg(c.getContext('2d')!, c.width, c.height, '#f6eedb', '#e8dcc0', 11);
      // a few pages under the top one
      for (let k = 2; k >= 0; k--) {
        const pg = new THREE.Mesh(this.keepG(new THREE.PlaneGeometry(pw, ph)), k === 0 ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }) : this.M.wax);
        pg.position.set(k * 0.002, -0.02 - k * 0.003, 0.0085 + (2 - k) * 0.0006);
        pg.receiveShadow = true;
        G.add(pg);
        if (k === 0) this.pick(pg, 'calendar');
      }
      const strip = this.mesh(K.prep(K.slab(bw - 0.02, 0.034, 0.008, 0.002)), this.M.brassDark);
      strip.position.set(0, bh / 2 - 0.03, 0.009);
      G.add(strip);
      this.hangOn(G, bw, bh);
      this.pick(back, 'calendar');
      this.scene.add(G);
    }
  }

  /** A nail above the board and a twine loop to its top corners; a soft shadow on the wall behind. */
  private hangOn(G: THREE.Group, bw: number, bh: number) {
    const nail = this.mesh(K.prep(K.turned([[0.0005, 0], [0.004, 0], [0.004, 0.03], [0.009, 0.032], [0.009, 0.036], [0.0005, 0.037]], 8, 20)).rotateX(Math.PI / 2), this.M.iron);
    nail.position.set(0, bh / 2 + 0.11, -0.006);
    nail.userData.stays = true;
    G.add(nail);
    for (const sx of [-1, 1]) {
      const a = v3(sx * (bw / 2 - 0.03), bh / 2 - 0.01, 0.008), b = v3(0, bh / 2 + 0.115, 0.024);
      const len = a.distanceTo(b);
      const g = new THREE.CylinderGeometry(0.0025, 0.0025, len, 5);
      const tw = this.mesh(g, this.M.twine, true, false);
      tw.position.copy(a).add(b).multiplyScalar(0.5);
      tw.quaternion.setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize());
      G.add(tw);
    }
    const sh = this.mesh(new THREE.PlaneGeometry(bw + 0.2, bh + 0.24), this.M.shadow, false, false);
    sh.position.set(0.015, -0.02, -0.004);
    G.add(sh);
  }

  /** Take the clipboard or the calendar off its nail while its editor is open (null puts it back). */
  lift(id: 'routine' | 'calendar' | null) {
    for (const k of ['routine', 'calendar'] as const) for (const c of this.boards[k].children) if (!c.userData.stays) c.visible = k !== id;
  }
  private placeLamps() {
    for (const l of this.lamps) { const g = l.light.parent!; g.position.x = Math.sign(g.position.x) * (this.layout === 'side' ? 1.4 : 0.98); }
  }
  private placeBoards() {
    const side = this.layout === 'side';
    // on a wide screen they hang either side of the clock; on a phone, below the shelf (their tops peek in)
    this.boards.routine.position.set(side ? -1.98 : -0.34, side ? 0.12 : -1.95, 0.012);
    this.boards.calendar.position.set(side ? 1.98 : 0.34, side ? 0.12 : -1.95, 0.012);
    this.boards.routine.rotation.z = side ? 0.015 : 0.02;
    this.boards.calendar.rotation.z = side ? -0.02 : -0.015;
  }

  /** Paint the routine onto the clipboard's paper: a title, the week's nights as bars from bedtime to waking, the goal. */
  setRoutine(days: RoutineDay[], goal: string, h12: boolean) {
    const P = this.paper.routine;
    if (!P) return;
    const c = P.c, g = c.getContext('2d')!, W = c.width, H = c.height;
    paperBg(g, W, H, '#f4ecd8', '#e6d9bc', 7);
    // ruled lines
    g.fillStyle = '#b8c8d8';
    for (let y = 70; y < H - 10; y += 16) g.fillRect(8, y, W - 16, 1);
    g.fillStyle = '#d89a8a'; g.fillRect(30, 0, 1, H);
    K.pxText(g, 'Routine', W / 2, 34, 32, '#8c2c1e');
    // the chart: 7 columns, 8 PM at the top to noon at the bottom
    const top = 74, bot = H - 52, x0 = 46, cw = (W - x0 - 12) / 7;
    const pos = (m: number) => top + ((((m - 20 * 60) % 1440) + 1440) % 1440) / (16 * 60) * (bot - top);
    for (const [hh, lab] of [[22, h12 ? '10p' : '22'], [0, h12 ? '12a' : '0'], [2, h12 ? '2a' : '2'], [4, h12 ? '4a' : '4'], [6, h12 ? '6a' : '6'], [8, h12 ? '8a' : '8'], [10, h12 ? '10a' : '10']] as [number, string][]) {
      const y = Math.round(pos(hh * 60));
      g.fillStyle = '#8a95a8';
      for (let x = x0; x < W - 12; x += 3) g.fillRect(x, y, 1, 1);
      K.pxText(g, lab, x0 - 4, y, 16, '#6a6c82', { align: 'right' });
    }
    days.forEach((d, i) => {
      const cx = Math.round(x0 + cw * (i + 0.5));
      const y0 = Math.round(pos(d.bed)), y1 = Math.round(pos(d.wake));
      const bw = Math.round(cw * 0.56);
      if (d.tonight) { g.fillStyle = 'rgba(232, 198, 112, 0.45)'; g.fillRect(Math.round(cx - cw / 2) + 1, top - 4, Math.round(cw) - 2, bot - top + 8); }
      g.fillStyle = '#23283a'; g.fillRect(cx - bw / 2 - 1, y0 - 1, bw + 2, y1 - y0 + 2);
      g.fillStyle = d.on ? (d.tonight ? '#5b66a8' : '#55607a') : '#b9bccb';
      g.fillRect(cx - bw / 2, y0, bw, y1 - y0);
      g.fillStyle = d.on ? '#8792c0' : '#d6d8e2'; g.fillRect(cx - bw / 2, y0, 2, y1 - y0);
      // a moon at the top, a sun at the bottom
      moonPx(g, cx, y0 - 2); sunPx(g, cx, y1 + 3);
      K.pxText(g, d.day.slice(0, 2), cx, H - 40, 16, d.tonight ? '#8c2c1e' : '#384456');
    });
    K.pxText(g, `Goal ${goal}`, W / 2, H - 16, 16, '#2a160c');
    P.tex.needsUpdate = true;
  }

  /** Paint this month onto the calendar: a red header with the month, the days, a sticker on every tracked night. */
  setMonth(m: MonthPage) {
    const P = this.paper.calendar;
    if (!P) return;
    const c = P.c, g = c.getContext('2d')!, W = c.width, H = c.height;
    paperBg(g, W, H, '#f6eedb', '#e8dcc0', 11);
    g.fillStyle = '#8e3236'; g.fillRect(0, 0, W, 64);
    g.fillStyle = '#c45452'; g.fillRect(0, 0, W, 3);
    g.fillStyle = '#5a1820'; g.fillRect(0, 60, W, 4);
    K.pxText(g, m.month, W / 2, 26, 32, '#f8f1e7', { shadow: '#3e1c1c' });
    K.pxText(g, String(m.year), W / 2, 50, 16, '#f3d4c9');
    const cw = (W - 12) / 7, top = 76, ch = Math.min(34, (H - top - 8) / 7);
    'MTWTFSS'.split('').forEach((d, i) => K.pxText(g, d, 6 + cw * (i + 0.5), top + 6, 16, i >= 5 ? '#8c2c1e' : '#644d3a'));
    for (let d = 1; d <= m.days; d++) {
      const k = m.lead + d - 1, col = k % 7, row = Math.floor(k / 7);
      const x = Math.round(6 + cw * col), y = Math.round(top + 16 + ch * row);
      g.fillStyle = 'rgba(113, 92, 68, 0.25)'; g.fillRect(x, y, Math.round(cw) - 1, 1); g.fillRect(x, y, 1, Math.round(ch) - 1);
      const mk = m.marks[d];
      if (mk) stickerPx(g, x + cw / 2, y + ch / 2 + 2, mk);
      K.pxText(g, String(d), x + 9, y + 9, 16, col >= 5 ? '#8c2c1e' : '#4a3a2a');
      if (d === m.today) { g.strokeStyle = '#c0392b'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, Math.round(cw) - 5, Math.round(ch) - 5); }
    }
    P.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the candle sconces

  private buildLamps() {
    const halo = this.keep(new THREE.CanvasTexture(K.haloCanvas()));
    for (const sx of [-1, 1]) {
      const G = new THREE.Group();
      G.position.set(sx * 0.98, 0.38, 0);
      const parts: Part[] = [];
      parts.push({ geo: K.turned([[0.0005, 0], [0.07, 0], [0.072, 0.006], [0.06, 0.014], [0.03, 0.02], [0.014, 0.026], [0.0005, 0.028]], 18, 12), m: mtx(0, 0, 0.0, Math.PI / 2, 0, 0) });
      const arm = new THREE.CatmullRomCurve3([v3(0, 0, 0.02), v3(0, -0.02, 0.09), v3(0, 0.02, 0.15), v3(0, 0.08, 0.16)]);
      parts.push({ geo: new THREE.TubeGeometry(arm, 12, 0.008, 6, false) });
      parts.push({ geo: K.turned([[0.0005, 0], [0.012, 0], [0.04, 0.012], [0.046, 0.02], [0.03, 0.022], [0.0005, 0.022]], 16, 12), m: mtx(0, 0.08, 0.16) });
      this.scene.add(Object.assign(G, {}));
      G.add(this.mesh(K.merge(parts), this.M.brass));
      const candle = this.mesh(K.prep(K.turned([[0.0005, 0], [0.017, 0], [0.017, 0.09], [0.019, 0.096], [0.015, 0.105], [0.006, 0.11], [0.0005, 0.108]], 12, 12)), this.M.wax);
      candle.position.set(0, 0.1, 0.16);
      G.add(candle);
      const chim = this.mesh(K.prep(K.turned([[0.03, 0], [0.034, 0.02], [0.048, 0.07], [0.042, 0.13], [0.03, 0.18], [0.032, 0.2]], 18, 4)), this.M.chimney, false, false);
      chim.position.set(0, 0.1, 0.16);
      G.add(chim);
      const flame = this.mesh(K.prep(K.turned([[0.0005, 0], [0.006, 0.006], [0.008, 0.016], [0.004, 0.03], [0.0005, 0.038]], 8, 12)), this.M.flame, false, false);
      flame.position.set(0, 0.212, 0.16);
      G.add(flame);
      const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffc078, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
      hs.scale.setScalar(0.22);
      hs.position.set(0, 0.228, 0.165);
      G.add(hs);
      const light = new THREE.PointLight(0xffb468, 2, 5, 1.6);
      light.position.set(0, 0.24, 0.2);
      G.add(light);
      this.lamps.push({ light, flame, halo: hs, phase: sx * 2.1 });
    }
  }

  // ---------------------------------------------------------------- the owl's trips out

  /** Pop out and cuckoo `n` times (on the hour, at the half hour, or when the door is tapped). */
  cuckoo(n: number) { this.trip('cuckoo', Math.max(1, Math.min(12, n)), null); }
  /** Pop out, wave hello and look over the numbers. */
  hello() { this.trip('hello', 2, null); }
  /** Open on the little door: the owl pops out, cuckoos and waves, then the camera pulls back to the whole clock. */
  intro() {
    this.focus('intro', true);
    this.introBack = true;
    setTimeout(() => { if (!this.dead) this.hello(); }, 900);
  }
  private introBack = false;
  /** Pop out and show off something (a tag, a house...): look at it, a proud little flourish. */
  present(id: string) {
    const p = this.anchorWorld(id);
    this.trip('present', 1, p);
  }
  private trip(mode: 'cuckoo' | 'hello' | 'present', calls: number, look: THREE.Vector3 | null) {
    const s = this.seq;
    if (s.phase === 'idle' || s.phase === 'close') {
      Object.assign(s, { phase: 'open', t: 0, calls, done: 0, hold: 0, mode, look });
      sound.play('door_open', { volume: 0.22, rate: 1.7, gap: 150 });
    } else {
      // already out: more calls, a new thing to look at
      s.calls = Math.max(s.calls, s.done + calls);
      s.mode = mode; s.look = look ?? s.look;
      if (s.phase === 'back') { s.phase = 'out'; s.t = this.outK * 0.45; }
      if (s.phase === 'show') s.hold = 0;
    }
  }
  get owlOut() { return this.seq.phase !== 'idle'; }

  private call(i: number) {
    // "cu-ckoo": a high note then a low one; the owl bows and opens its beak on each
    if (!this.prefs.mute || true) {
      sound.play('owl_hoot', { volume: 0.42, rate: 1.34 + (i % 2) * 0.02, gap: 0 });
      setTimeout(() => { if (!this.dead) sound.play('owl_hoot', { volume: 0.38, rate: 1.08, gap: 0 }); }, 300);
    }
    this.bow = 1;
    this.owl.setMood('joy', 0.32);
    setTimeout(() => { if (!this.dead) this.owl.setMood('joy', 0.3); }, 300);
    const p = this.owl.headWorld;
    this.fx.emit({ x: p.x + (i % 2 ? 0.05 : -0.05), y: p.y + 0.02, z: p.z + 0.06, vx: (i % 2 ? 0.06 : -0.06), vy: 0.18, life: 1.1, frame: SPR.note, color: 0xf1d39a, size: 0.05, flutter: 0.1, fadeIn: 0.05, fadeOut: 0.4, add: true });
  }

  private stepOwl(dt: number, real: number) {
    const s = this.seq;
    s.t += real;
    const D = { open: 0.32, out: 0.45, back: 0.4, close: 0.28 };
    switch (s.phase) {
      case 'open': this.doorK = backOut(Math.min(1, s.t / D.open)); if (s.t >= D.open) { s.phase = 'out'; s.t = 0; this.owl.play('nod'); this.owl.setMood('excited', 1.2); } break;
      case 'out': this.outK = backOut(Math.min(1, s.t / D.out)); if (s.t >= D.out) { s.phase = 'show'; s.t = 0; s.hold = 0; if (s.mode === 'hello') { this.owl.play('wave'); this.owl.setMood('happy', 2.4); } if (s.mode === 'present') { this.owl.play('present'); } } break;
      case 'show': {
        const gap = 0.9;
        if (s.done < s.calls && s.t >= 0.15 + s.done * gap) { this.call(s.done); s.done++; }
        const end = 0.15 + s.calls * gap + (s.mode === 'hello' ? 2.6 : s.mode === 'present' ? 2.4 : 0.5);
        if (s.mode === 'hello' && s.done === s.calls && s.t > 0.15 + s.calls * gap + 0.4 && !s.look) { s.look = this.tags[0].pivot.getWorldPosition(v3(0, 0, 0)).add(v3(0, -0.2, 0)); }
        if (this.introBack && s.done === s.calls && s.t > 0.15 + s.calls * gap + 0.1) { this.introBack = false; if (this.shotName === 'intro') this.focus('home'); }
        if (s.t >= end) { s.phase = 'back'; s.t = 0; }
        break;
      }
      case 'back': this.outK = 1 - ease(Math.min(1, s.t / D.back)); if (s.t >= D.back) { s.phase = 'close'; s.t = 0; } break;
      case 'close': this.doorK = 1 - ease(Math.min(1, s.t / D.close)); if (s.t >= D.close) { s.phase = 'idle'; s.t = 0; s.look = null; sound.play('wood_knock', { volume: 0.18, rate: 1.6, gap: 100 }); this.onOwlHome?.(); } break;
    }
    this.doorPivot.rotation.y = -this.doorK * 1.9;
    this.perch.position.z = THREE.MathUtils.lerp(PERCH_IN, PERCH_OUT, this.outK);
    this.perch.visible = this.doorK > 0.05;
    this.bow = Math.max(0, this.bow - real * 3.2);
    this.perch.rotation.x = Math.sin((1 - this.bow) * Math.PI) * this.bow * 0.4;
    this.owl.lookAt = s.phase === 'show' && s.look ? s.look : this.camera.position;
    if (this.perch.visible) this.owl.update(dt);
  }

  // ---------------------------------------------------------------- picking and anchors

  private anchorWorld(id: string): THREE.Vector3 {
    if (id.startsWith('tag:')) { const t = this.tags.find((x) => 'tag:' + x.id === id); if (t) return t.body.getWorldPosition(v3(0, 0, 0)); }
    if (id.startsWith('house:')) { const H = this.houses[+id.slice(6)]; if (H) return H.group.position.clone().add(v3(0, H.h / 2 + 0.03, HOUSE.z + HOUSE.d)); }
    if (id === 'routine' || id === 'calendar') return this.boards[id].position.clone().add(v3(0, 0.0, 0.03));
    if (id === 'dial') return v3(0, DIAL.y, CD + 0.02);
    if (id.startsWith('weight:')) return this.cones[+id.slice(7)].position.clone().add(v3(0, -0.1, 0));
    if (id === 'door' || id === 'owl') return v3(0, DOOR.y + 0.08, PERCH_OUT);
    if (id === 'crest') return v3(0, RIDGE + 0.12, ROOF_Z);
    if (id === 'pendulum') return v3(0, PEND.y - PEND.len, PEND.z);
    return v3(0, 0.3, 0.2);
  }
  /** Screen position (CSS px) of a thing (for DOM hints); `on` is false when it's off screen. */
  anchor(id: string): { x: number; y: number; on: boolean } {
    const q = this.anchorWorld(id).project(this.camera);
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
    const hits = this.ray.intersectObjects(this.picks, false);
    const h = hits.find((x) => x.object.visible !== false || (x.object as THREE.Mesh).material instanceof THREE.MeshBasicMaterial);
    let id = (h?.object.userData.pick as string | undefined) ?? '';
    if (this.perch.visible && this.outK > 0.5) {
      const o = this.owl.node.getWorldPosition(v3(0, 0, 0)).add(v3(0, OWL_H * 0.5, 0));
      if (ray.distanceToPoint(o) < OWL_H * 0.6 && (!h || h.distance > ray.origin.distanceTo(o) - 0.1)) id = 'owl';
    }
    if (id) this.onPick?.(id);
    return true;
  }

  // ---------------------------------------------------------------- the camera

  private homeShot(): Shot {
    return this.layout === 'side'
      ? { target: v3(0, 0.07, 0.2), yaw: 0.0, pitch: 0.04, w: 4.7, h: 2.98, cx: 0.5, cy: 0.5 }
      : { target: v3(0, -0.08, 0.2), yaw: 0.0, pitch: 0.04, w: 2.02, h: 3.36, cx: 0.5, cy: 0.5 }; // phone: wide enough that the hanging tags stay on screen
  }
  private shot(name: string): Shot {
    const side = this.layout === 'side';
    if (name === 'home') return this.homeShot();
    const p = this.anchorWorld(name);
    const card = (w: number, h: number, yaw = 0, pitch = 0.04): Shot => side ? { target: p, yaw, pitch, w: w * 1.6, h, cx: 0.36, cy: 0.5 } : { target: p, yaw, pitch, w, h: h * 1.7, cx: 0.5, cy: 0.3 };
    if (name.startsWith('tag:')) {
      const k = TAG_LAY[this.layout].k;
      if (side) return card(0.62 * k, 0.5 * k, 0, 0.02);
      // a phone frames the pair hanging together on that side
      const t = this.tags.find((x) => 'tag:' + x.id === name);
      const pair = this.tags.filter((x) => t && x.side === t.side).map((x) => x.body.getWorldPosition(v3(0, 0, 0)));
      const mid = pair.length === 2 ? pair[0].add(pair[1]).multiplyScalar(0.5) : p;
      return { target: mid, yaw: 0, pitch: 0.02, w: 0.66, h: 1.2, cx: 0.5, cy: 0.34 };
    }
    if (name.startsWith('house:')) return card(0.58, 0.44, 0, 0.16);
    if (name === 'routine' || name === 'calendar') return side ? { target: p, yaw: 0, pitch: 0.02, w: 1.9, h: 1.05, cx: 0.27, cy: 0.5 } : { target: p.clone().add(v3(0, 0.12, 0)), yaw: 0, pitch: 0.02, w: 0.7, h: 1.7, cx: 0.5, cy: 0.22 };
    if (name === 'dial') return card(0.78, 0.74, 0, 0.03);
    if (name === 'door' || name === 'owl' || name === 'crest') return card(0.62, 0.52, 0.12, 0.08);
    if (name === 'intro') return side ? { target: v3(0, 0.72, 0.28), yaw: 0.1, pitch: 0.06, w: 2.4, h: 1.45, cx: 0.5, cy: 0.5 } : { target: v3(0, 0.74, 0.28), yaw: 0.1, pitch: 0.06, w: 1.05, h: 1.5, cx: 0.5, cy: 0.42 };
    if (name.startsWith('weight:') || name === 'pendulum') return card(0.78, 0.9, 0, 0.04);
    return this.homeShot();
  }

  /** Fly the camera to a thing (or 'home'); `instant` jumps there. */
  focus(name: string, instant = false) {
    this.shotName = name;
    const to = this.shot(name);
    this.from = this.copy(this.cur);
    this.to = to;
    this.camT = instant ? 1 : 0;
    this.camStart = performance.now();
    const d = this.from.target.distanceTo(to.target) + Math.abs(this.from.w - to.w) * 0.3;
    this.camDur = THREE.MathUtils.clamp(0.7 + d * 0.25, 0.8, 1.5);
    if (instant) this.cur = this.copy(to);
    if (name.startsWith('house:')) { const H = this.houses[+name.slice(6)]; if (H) H.bounce = 1; }
  }
  get current() { return this.shotName; }

  private fitDist(s: Shot): number {
    const v = (FOV * Math.PI) / 360, a = this.w / this.h, hz = Math.atan(Math.tan(v) * a);
    return Math.max(s.h / 2 / Math.tan(v), s.w / 2 / Math.tan(hz));
  }
  private applyCamera(s: Shot) {
    const c = this.camera, dist = this.fitDist(s);
    const cp = Math.cos(s.pitch);
    c.position.set(s.target.x + Math.sin(s.yaw) * cp * dist, s.target.y + Math.sin(s.pitch) * dist, s.target.z + Math.cos(s.yaw) * cp * dist);
    c.lookAt(s.target);
    c.fov = FOV;
    c.aspect = this.w / this.h;
    c.setViewOffset(this.w, this.h, (0.5 - s.cx) * this.w, (0.5 - s.cy) * this.h, this.w, this.h);
    c.updateProjectionMatrix();
    return dist;
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const side = w >= h * 1.05 && w >= 640;
    const was = this.layout;
    this.layout = side ? 'side' : 'top';
    if (was !== this.layout) { this.placeBoards(); this.placeLamps(); }
    this.placeTags();
    const to = this.shot(this.shotName);
    this.cur = this.copy(to); this.to = to; this.camT = 1;
    this.applyCamera(this.cur);
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number, t: number) {
    if (this.dead) return;
    this.time += dt;
    const rawDt = dt;
    dt = Math.min(dt, 0.05);
    this.enterT = Math.min(1, this.enterT + dt * 0.6);
    if (Math.floor(this.time / 2) !== Math.floor((this.time - dt) / 2)) this.applyLight();
    // camera
    if (this.camT < 1) {
      this.camT = Math.min(1, Math.max(this.camT + dt / this.camDur, (performance.now() - this.camStart) / 1000 / this.camDur));
      const k = ease(this.camT), a = this.from, b = this.to;
      this.cur = { target: a.target.clone().lerp(b.target, k), yaw: a.yaw + (b.yaw - a.yaw) * k, pitch: a.pitch + (b.pitch - a.pitch) * k, w: a.w + (b.w - a.w) * k, h: a.h + (b.h - a.h) * k, cx: a.cx + (b.cx - a.cx) * k, cy: a.cy + (b.cy - a.cy) * k };
    }
    const e = 1 - Math.pow(1 - this.enterT, 3);
    const s = this.cur, drift = Math.sin(t * 0.17) * 0.012;
    const dist = this.applyCamera({ ...s, w: s.w * (1 + (1 - e) * 0.22), h: s.h * (1 + (1 - e) * 0.22), yaw: s.yaw + drift + (1 - e) * 0.1, pitch: s.pitch + (1 - e) * 0.05 });
    this.look.focus = dist;
    this.look.focusRange = Math.max(0.5, dist * 0.18);
    this.look.blur = this.shotName === 'home' ? 0.22 : 0.42;

    // the time: hands, the hourly and half-hourly cuckoo
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000, hr = (now.getHours() % 12) + m / 60;
    this.minute.rotation.z = -(m / 60) * Math.PI * 2;
    this.hour.rotation.z = -(hr / 12) * Math.PI * 2;
    if ((this.clockT -= dt) <= 0) {
      this.clockT = 0.5;
      const key = `${now.getHours()}:${now.getMinutes()}`;
      if (now.getSeconds() < 4 && key !== this.lastChime && this.enterT >= 1) {
        if (now.getMinutes() === 0) { this.lastChime = key; this.cuckoo(now.getHours() % 12 || 12); }
        else if (now.getMinutes() === 30) { this.lastChime = key; this.cuckoo(1); }
      }
      this.setDrops();
    }
    // the pendulum: a soft tick at each end of its swing
    const sw = Math.sin((t / 1.6) * Math.PI * 2);
    this.pend.rotation.z = sw * 0.11;
    const sign = Math.sign(Math.cos((t / 1.6) * Math.PI * 2));
    if (sign !== this.lastSign && this.lastSign !== 0 && !this.prefs.mute && !document.hidden) sound.play('clock_tick', { volume: 0.1, rate: sign > 0 ? 1 : 0.9, gap: 200 });
    this.lastSign = sign;
    // tags sway on their twine
    for (const tg of this.tags) tg.pivot.rotation.z = Math.sin(t * 0.8 + tg.phase) * 0.028 + Math.sin(t * 1.9 + tg.phase * 2) * 0.008;
    if (this.layout === 'top') for (const tg of this.tags) {
      if (tg.row !== 1) continue;
      const a = this.tags.find((x) => x.side === tg.side && x.row === 0)!;
      a.pivot.updateMatrixWorld();
      tg.pivot.position.copy(a.pivot.localToWorld(v3(0, a.body.position.y + TAG_HOLE_B, 0)));
    }
    // houses settle with a bounce when they change or are picked
    for (const H of this.houses) {
      if (H.bounce <= 0) continue;
      H.bounce = Math.max(0, H.bounce - dt * 1.8);
      const b = Math.sin((1 - H.bounce) * Math.PI * 3) * H.bounce;
      H.group.scale.set(1 - b * 0.06, 1 + b * 0.12, 1);
    }
    // candles flicker
    for (const l of this.lamps) {
      const f = 0.86 + Math.sin(t * 9.1 + l.phase) * 0.05 + Math.sin(t * 15.3 + l.phase * 2) * 0.05 + Math.sin(t * 2.3 + l.phase) * 0.04;
      l.light.intensity = (l.light.userData.base as number ?? 2) * f;
      l.flame.scale.set(1, 0.9 + f * 0.15, 1);
      (l.halo.material as THREE.SpriteMaterial).opacity = (0.28 + this.night * 0.3) * f;
    }
    (this.M.houseFront as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + this.night * 1.6;
    this.stepOwl(dt, Math.min(1, rawDt));
    // warm motes drifting in the candle light
    if ((this.moteT -= dt) <= 0) {
      this.moteT = 0.35;
      this.fx.emit({ x: (Math.random() - 0.5) * (this.layout === 'side' ? 3.6 : 1.4), y: -1.1 + Math.random() * 2.4, z: 0.15 + Math.random() * 0.5, vx: (Math.random() - 0.5) * 0.01, vy: 0.006 + Math.random() * 0.01, life: 8, frame: SPR.mote, color: 0xffe2a8, size: 0.012 + Math.random() * 0.01, flutter: 0.04, fadeIn: 2, fadeOut: 2.5, add: true });
    }
    this.fx.update(dt, t);
  }

  dispose() {
    this.dead = true;
    if (this.owl) { this.perch.remove(this.owl.node); this.owl.model.dispose(); }
    for (const g of this.geos) g.dispose();
    this.scene.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.geometry && !this.geos.includes(m.geometry)) m.geometry.dispose(); });
    for (const t of this.tex) t.dispose();
    for (const m of Object.values(this.M)) m.dispose();
    this.scene.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && m.material && !(Object.values(this.M) as THREE.Material[]).includes(m.material as THREE.Material)) (m.material as THREE.Material).dispose(); });
    this.env?.dispose();
    this.pmrem?.dispose();
  }
}

// ------------------------------------------------------------------ painted paper and pixel stickers

function paperBg(g: CanvasRenderingContext2D, W: number, H: number, a: string, b: string, seed: number) {
  const im = g.createImageData(W, H), A = K.hex(a), B = K.hex(b);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = Math.sin(x * 0.9 + seed) * Math.sin(y * 0.7 + seed * 2) * 0.5 + 0.5;
    const f = ((x * 13 + y * 7 + seed) % 11) / 11 * 0.25 + n * 0.15 + (x < 3 || y < 3 || x > W - 4 || y > H - 4 ? 0.5 : 0);
    const i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) im.data[i + k] = Math.round(A[k] + (B[k] - A[k]) * Math.min(1, f));
    im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
}
function moonPx(g: CanvasRenderingContext2D, cx: number, cy: number) {
  const rows = ['.###.', '##...', '##...', '##...', '.###.'];
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') { g.fillStyle = '#c99a3c'; g.fillRect(cx - 3 + i, cy - 5 + j, 1, 1); } }));
}
function sunPx(g: CanvasRenderingContext2D, cx: number, cy: number) {
  const rows = ['#.#.#', '.###.', '#####', '.###.', '#.#.#'];
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') { g.fillStyle = '#e0a030'; g.fillRect(cx - 2 + i, cy + j, 1, 1); } }));
}
function stickerPx(g: CanvasRenderingContext2D, cx: number, cy: number, k: Sticker) {
  const S: Record<Sticker, [string[], string, string]> = {
    gold: [['...#...', '..###..', '#######', '.#####.', '.##.##.', '##...##'], '#e0a826', '#8a5a10'],
    moon: [['..###..', '.##....', '##.....', '##.....', '.##....', '..###..'], '#e8d27a', '#7a6420'],
    cloud: [['..##...', '.####..', '######.', '#######', '.#####.', '.......'], '#a9c4dc', '#4a6684'],
    rain: [['...#...', '..###..', '.#####.', '.#####.', '..###..', '.......'], '#7aa6d8', '#2a4a7a'],
  };
  const [rows, fill, edge] = S[k];
  const s = 2;
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch !== '#') return;
    g.fillStyle = edge; g.fillRect(cx - 7 + i * s + 1, cy - 6 + j * s + 1, s, s);
  }));
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch !== '#') return;
    g.fillStyle = fill; g.fillRect(cx - 7 + i * s, cy - 6 + j * s, s, s);
  }));
}
