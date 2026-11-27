// The Clock panel as a 3D stage: a super big carved Black Forest cuckoo clock hanging on the log wall of Barnaby's
// workshop (clockshop.ts builds the room and Barnaby at his bench), lit by two brass candle sconces, the shop lamp and
// the window's daylight by day. The clock is modelled piece by piece (cuckookit.ts): a shingled chalet roof with
// scalloped bargeboards (no crest: the only owl is the one behind the door), a balcony with turned balusters under the
// little arched door, a walnut case with turned columns and carved oak leaves and acorns round a big enamel dial (Roman
// numerals, pierced Gothic hands that show the real time), a carved fretwork apron, a leaf pendulum that swings and
// ticks, and two cast pine-cone weights on brass chains that drop through the day. The player's own owl (species, skin,
// outfit) lives behind the door: it pops out onto the balcony to cuckoo on the hour and the half hour, and when you tap
// the door.
// The dial sets the night: two brass setting hands ride under the steel ones, a bedtime hand tipped with a moon enamel
// and a wake hand tipped with a sun, and the night between them is shaded round the minute track (night blue fading to
// dawn gold). Drag a tip round the dial (snaps to 5 minutes, ticks as it goes); onSet reports every step. Taps on
// other things call onPick(id); focus(id) flies the camera to a thing. OWNED BY THE CLOCK BUILDER.
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
import { ClockShop } from './clockshop.ts';

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
const WOOD_TILE = 0.55;

export type ClockLayout = 'side' | 'top';
/** finish: the case's wood; mute: no ticking; chime: the owl calls the hours (default on); wound: when each weight was last pulled up */
export interface CuckooPrefs { finish: string; mute: boolean; chime?: boolean; wound: [number, number] }
/** which setting hand */
export type SetHand = 'bed' | 'wake';
/** the earliest time each setting hand can show (its 12 hours run from here): bedtime 6 PM..5:55 AM, wake 3 AM..2:55 PM */
export const SET_FROM: Record<SetHand, number> = { bed: 18 * 60, wake: 3 * 60 };
/** the shortest and longest night the hands allow (minutes) */
export const NIGHT_MIN = 180, NIGHT_MAX = 720;
const SET_Z = 0.0146, TIP_R = 0.268, TIP_Z = 0.034, ARC = { r0: 0.207, r1: 0.2325, z: 0.0131 };
/** minutes since midnight -> angle on a 12-hour dial (radians, clockwise from XII) */
const angOf = (min: number) => ((((min % 720) + 720) % 720) / 720) * Math.PI * 2;
/**
 * Keep a time a setting hand would show sensible: within the hand's 12 hours (SET_FROM: just past the end it stops
 * at the end, just before the start at the start) and a night of 3 to 12 hours against the other hand's time (minutes).
 */
export function fitSet(hand: SetHand, t: number, other: number): number {
  const base = SET_FROM[hand];
  let o = ((((t - base) % 1440) + 1440) % 1440);
  if (o > 715) o = o >= 1080 ? 0 : 715;
  t = (base + o) % 1440;
  const dur = hand === 'bed' ? (((other - t) % 1440) + 1440) % 1440 : (((t - other) % 1440) + 1440) % 1440;
  if (dur < NIGHT_MIN) t = hand === 'bed' ? other - NIGHT_MIN : other + NIGHT_MIN;
  else if (dur > NIGHT_MAX) t = hand === 'bed' ? other - NIGHT_MAX : other + NIGHT_MAX;
  return ((t % 1440) + 1440) % 1440;
}

interface Shot { target: THREE.Vector3; yaw: number; pitch: number; w: number; h: number; cx: number; cy: number }
interface Lamp { light: THREE.PointLight; flame: THREE.Mesh; halo: THREE.Sprite; phase: number }

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = (t: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const FOV = 28;
const LOOK: Look = { exposure: 1.04, contrast: 1.06, saturation: 1.18, vibrance: 0.3, warm: 0.04, orange: 0.96, split: 0.3, // [look12]
  vignette: 0.26, grain: 0.012, bloom: 0.55, bloomThreshold: 1.05, focus: 7, focusRange: 2.5, blur: 0.25, cold: 0 };

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
  /** a tap on a thing: dial, door, owl, pendulum, weight:<i>, barnaby */
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
  /** the workshop round the clock (Clock screen only) */
  shop: ClockShop | null = null;
  // ---- the setting hands: their pivots, the night arc, the times they show and the drag
  /** a setting hand moved (`phase`: start, move (each 5-minute step), end) */
  onSet: ((hand: SetHand, min: number, phase: 'start' | 'move' | 'end') => void) | null = null;
  private setPivot: Record<SetHand, THREE.Group> = { bed: new THREE.Group(), wake: new THREE.Group() };
  private setMin: Record<SetHand, number> = { bed: 23 * 60, wake: 7 * 60 };
  private setAng: Record<SetHand, { a: number; v: number }> = { bed: { a: angOf(23 * 60), v: 0 }, wake: { a: angOf(7 * 60), v: 0 } };
  private setOn = true;
  private arc: THREE.Mesh | null = null;
  private arcKey = '';
  private dragHand: SetHand | null = null;
  private hoverHand: SetHand | null = null;
  private dragUnwrap = 0;
  private dom: HTMLElement | null = null;
  private dialPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(CD + SET_Z));

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
    if (!this.bare) { this.buildLights(); this.buildShop(); }
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
    this.buildSetHands();
    this.buildLamps();
    S.add(this.fx.group);
    this.fx.setLight(new THREE.Color(0xffe8c8));
    this.addOwl(look ?? { skin: 'owl', species: 'tawny', palette: 'tawny', outfit: {} });
    this.layout = innerWidth >= innerHeight * 1.05 && innerWidth >= 640 ? 'side' : 'top';
    this.cur = this.shot('home');
    this.from = this.copy(this.cur); this.to = this.copy(this.cur);
    this.setDrops(true);
    this.applyLight();
    this.ready = Promise.all([K.fontReady(), this.useRealWood(), this.shop?.ready]).then(() => undefined);
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
    this.dom = renderer.domElement;
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
      roof: std({ map: this.keep(K.ctex(K.shingleCanvas())), vertexColors: true, roughness: 0.82 }),
      dark: std({ color: 0x1a0e08, roughness: 0.95, side: THREE.BackSide }),
      // [clock14] brass with a patina: polished where hands touch it, a brown tarnish in blotches, duller there
      brass: std({ map: bmap, roughnessMap: brough, color: 0xffffff, metalness: 0.95, roughness: 1, envMapIntensity: 1.2 }),
      brassDark: std({ map: bmap, roughnessMap: brough, color: 0xb08a58, metalness: 0.9, roughness: 1, envMapIntensity: 1.05 }),
      steel: std({ color: 0x141a30, metalness: 0.75, roughness: 0.3, envMapIntensity: 1.1 }),
      bronze: std({ color: 0x8a6a46, vertexColors: true, metalness: 0.78, roughness: 0.42, envMapIntensity: 1.1 }),
      enamel: std({ map: this.keep(dialTex()), roughness: 0.16, envMapIntensity: 0.7 }),
      glass: std({ color: 0xd77a1e, roughness: 0.08, metalness: 0.1, emissive: 0x3a1600, envMapIntensity: 1.5 }),
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
    // the carved leaves (not on the plain clock)
    if (!this.plain) {
      put(this.M.leaf, K.realLeafCanvas(src, cid), 1, 0.5, 0.3);
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
    sc.left = -3.4; sc.right = 3.2; sc.top = 2.4; sc.bottom = -2.8; sc.near = 1; sc.far = 12;
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
    this.shop?.setNight(n);
  }

  // ---------------------------------------------------------------- the workshop

  /** The workshop round the clock: the log wall, the floor, Barnaby at his bench, the shop lamp (clockshop.ts). */
  private buildShop() {
    this.shop = new ClockShop(this.fx);
    this.scene.add(this.shop.group);
    // soft contact darkening on the logs behind the clock (it hangs close to the wall)
    const ao = this.mesh(new THREE.PlaneGeometry(1.4, 2.6), this.M.shadow, false, false);
    ao.position.set(0.04, 0.3, -0.011);
    ao.renderOrder = 1;
    this.scene.add(ao);
  }

  // ---------------------------------------------------------------- the setting hands

  /** Two brass setting hands under the steel ones (bedtime, tipped with a moon enamel; wake, with a sun) and the
   * night between them shaded round the minute track. */
  private buildSetHands() {
    const S = this.scene;
    const L = 0.232, tail = 0.052;
    const needle = new THREE.Shape();
    needle.moveTo(-0.0046, -tail + 0.012);
    needle.lineTo(-0.003, L - 0.028);
    needle.lineTo(-0.0078, L - 0.019);
    needle.lineTo(0, L);
    needle.lineTo(0.0078, L - 0.019);
    needle.lineTo(0.003, L - 0.028);
    needle.lineTo(0.0046, -tail + 0.012);
    needle.closePath();
    const needleG = K.extrude(needle, 0.0016, 0.0005, 1, 4);
    const enamel = (hand: SetHand) => {
      const [c, g] = K.canvas(256, 256);
      const night = hand === 'bed';
      const gr = g.createRadialGradient(100, 92, 10, 128, 128, 128);
      if (night) { gr.addColorStop(0, '#3e56a8'); gr.addColorStop(0.7, '#1f2c66'); gr.addColorStop(1, '#141b42'); }
      else { gr.addColorStop(0, '#fff6d8'); gr.addColorStop(0.65, '#f6d58a'); gr.addColorStop(1, '#d99a3c'); }
      g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
      if (night) {
        // a gold crescent and three little stars
        g.fillStyle = '#f3cf6a';
        g.beginPath(); g.arc(122, 130, 70, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(152, 108, 62, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        // (the cut-out shows the canvas through: put the enamel back behind the crescent)
        g.globalCompositeOperation = 'destination-over';
        g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 128, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = 'source-over';
        const star = (x: number, y: number, r: number) => { g.fillStyle = '#fbe7a4'; g.beginPath(); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 - Math.PI / 2, rr = k % 2 ? r * 0.38 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
        star(178, 152, 20); star(196, 86, 12); star(146, 200, 10);
      } else {
        // a round sun with sixteen rays
        g.fillStyle = '#e8862e';
        for (let k = 0; k < 16; k++) {
          const a = (k / 16) * Math.PI * 2, r0 = 52, r1 = k % 2 ? 86 : 104, hw = 0.12;
          g.beginPath(); g.moveTo(128 + Math.cos(a - hw) * r0, 128 + Math.sin(a - hw) * r0); g.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); g.lineTo(128 + Math.cos(a + hw) * r0, 128 + Math.sin(a + hw) * r0); g.fill();
        }
        const sg = g.createRadialGradient(116, 116, 6, 128, 128, 56);
        sg.addColorStop(0, '#fff0a8'); sg.addColorStop(0.6, '#f7b840'); sg.addColorStop(1, '#e07a22');
        g.fillStyle = sg; g.beginPath(); g.arc(128, 128, 54, 0, Math.PI * 2); g.fill();
      }
      // a fine dark line inside the brass rim and a glint
      g.strokeStyle = night ? 'rgba(8, 10, 30, 0.7)' : 'rgba(110, 60, 10, 0.55)'; g.lineWidth = 6;
      g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255, 255, 255, 0.35)'; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.arc(128, 128, 104, Math.PI * 1.1, Math.PI * 1.4); g.stroke();
      const t = this.keep(K.ctex(c));
      t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
      return t;
    };
    const hubG = this.keepG(K.prep(K.turned([[0.0005, 0], [0.0105, 0], [0.011, 0.0018], [0.008, 0.0032], [0.0005, 0.0036]], 24, 20)).rotateX(Math.PI / 2));
    const weightG = this.keepG(K.prep(K.turned([[0.0005, 0], [0.0078, 0], [0.0082, 0.0012], [0.0068, 0.0024], [0.0005, 0.0026]], 20, 20)).rotateX(Math.PI / 2));
    const discG = this.keepG(K.prep(K.turned([[0.0005, 0], [0.0315, 0], [0.0338, 0.0026], [0.0332, 0.0058], [0.0288, 0.0076], [0.0005, 0.0076]], 40, 20)).rotateX(Math.PI / 2));
    const faceG = this.keepG(new THREE.CircleGeometry(0.0278, 40));
    // a little brass bridge from the needle's tip up over the bezel to the enamel
    const bridgeG = this.keepG(K.prep(K.slab(0.0048, 0.034, 0.0016, 0.0004)));
    this.M.setBrass = new THREE.MeshStandardMaterial({ color: 0xe6bf6a, metalness: 0.92, roughness: 0.26, envMapIntensity: 1.35 });
    for (const hand of ['bed', 'wake'] as SetHand[]) {
      const P = this.setPivot[hand];
      P.position.set(0, DIAL.y, CD + SET_Z);
      const nd = this.mesh(this.keepG(K.prep(needleG.clone())), this.M.setBrass, true, false);
      const hub = this.mesh(hubG, this.M.setBrass, true, false);
      const cw = this.mesh(weightG, this.M.setBrass, true, false);
      cw.position.set(0, -tail + 0.008, 0);
      const br = this.mesh(bridgeG, this.M.setBrass, true, false);
      br.position.set(0, L + 0.005, 0.009);
      br.rotation.x = -0.62;
      const tip = new THREE.Group();
      tip.position.set(0, TIP_R, TIP_Z - SET_Z);
      const disc = this.mesh(discG, this.M.setBrass, true, false);
      const mat = new THREE.MeshStandardMaterial({ map: enamel(hand), roughness: 0.14, metalness: 0, envMapIntensity: 0.9 });
      this.M['set_' + hand] = mat;
      const face = new THREE.Mesh(faceG, mat);
      face.position.z = 0.0077;
      const spin = new THREE.Group();
      spin.add(disc, face);
      tip.add(spin);
      tip.userData.spin = spin;
      P.add(nd, hub, cw, br, tip);
      P.userData.tip = tip;
      // generous invisible grips: the tip and the needle
      const grip = new THREE.Mesh(this.keepG(new THREE.CircleGeometry(0.05, 16)), new THREE.MeshBasicMaterial({ visible: false }));
      grip.position.set(0, TIP_R, TIP_Z - SET_Z + 0.002);
      const shaft = new THREE.Mesh(this.keepG(new THREE.PlaneGeometry(0.04, 0.17)), new THREE.MeshBasicMaterial({ visible: false }));
      shaft.position.set(0, 0.15, 0.004);
      P.add(grip, shaft);
      grip.userData.hand = hand; shaft.userData.hand = hand;
      this.setGrips.push(grip, shaft);
      S.add(P);
    }
    needleG.dispose();
    // the night arc: a soft band round the minute track, night blue at the bedtime end fading to dawn gold
    const N = 120;
    const pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx: number[] = [];
    for (let i = 0; i <= N; i++) { uv.set([i / N, 0, i / N, 1], i * 4); if (i < N) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ag.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    ag.setIndex(idx);
    const [c, g] = K.canvas(256, 32);
    const lg = g.createLinearGradient(0, 0, 256, 0);
    lg.addColorStop(0, '#24306e'); lg.addColorStop(0.45, '#3f3a8c'); lg.addColorStop(0.72, '#7a4a8a'); lg.addColorStop(0.9, '#d9825a'); lg.addColorStop(1, '#f2c25a');
    g.fillStyle = lg; g.fillRect(0, 0, 256, 32);
    // soft edges across the band, and a row of small stars along the night half
    const im = g.getImageData(0, 0, 256, 32);
    for (let y = 0; y < 32; y++) { const e = Math.min(1, Math.min(y + 0.5, 31.5 - y) / 7); for (let x = 0; x < 256; x++) { const end = Math.min(1, Math.min(x + 0.5, 255.5 - x) / 5); im.data[(y * 256 + x) * 4 + 3] = Math.round(255 * e * end); } }
    g.putImageData(im, 0, 0);
    g.fillStyle = 'rgba(255, 236, 180, 0.9)';
    for (let x = 14; x < 150; x += 22) { g.beginPath(); g.arc(x, 16 + ((x / 22) % 2 ? 3 : -3), 1.6, 0, Math.PI * 2); g.fill(); }
    const at = this.keep(K.ctex(c));
    at.magFilter = THREE.LinearFilter; at.wrapS = THREE.ClampToEdgeWrapping;
    this.M.arc = new THREE.MeshBasicMaterial({ map: at, transparent: true, opacity: 0.86, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.arc = new THREE.Mesh(this.keepG(ag), this.M.arc);
    this.arc.position.set(0, DIAL.y, CD + ARC.z);
    this.arc.renderOrder = 2;
    this.arc.frustumCulled = false;
    S.add(this.arc);
    this.layArc();
  }
  private setGrips: THREE.Object3D[] = [];

  /** Show the night on the dial: bedtime and wake (minutes since midnight), and whether it is a planned night. */
  setPlan(bed: number, wake: number, on: boolean, instant = false) {
    if (this.dragHand === 'bed') bed = this.setMin.bed;
    if (this.dragHand === 'wake') wake = this.setMin.wake;
    this.setMin = { bed, wake };
    this.setOn = on;
    if (instant) for (const h of ['bed', 'wake'] as SetHand[]) { this.setAng[h].a = angOf(this.setMin[h]); this.setAng[h].v = 0; }
    const am = this.M.arc as THREE.MeshBasicMaterial | undefined;
    if (am) { am.color.setHex(on ? 0xffffff : 0xa0a0a0); am.opacity = on ? 0.86 : 0.42; }
    this.arcKey = '';
  }
  get dragging() { return this.dragHand; }

  /** lay the arc's vertices from the bedtime hand round to the wake hand (as the hands show them now) */
  private layArc() {
    const g = this.arc?.geometry;
    if (!g) return;
    const a0 = this.setAng.bed.a, a1 = this.setAng.wake.a;
    const dur = (((this.setMin.wake - this.setMin.bed) % 1440) + 1440) % 1440;
    let len = (((a1 - a0) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (len < 0.02 && dur >= 700) len = Math.PI * 2;
    const key = a0.toFixed(4) + len.toFixed(4);
    if (key === this.arcKey) return;
    this.arcKey = key;
    const p = g.attributes.position as THREE.BufferAttribute, N = p.count / 2 - 1;
    for (let i = 0; i <= N; i++) {
      const a = a0 + (len * i) / N, s = Math.sin(a), c = Math.cos(a);
      p.setXYZ(i * 2, s * ARC.r0, c * ARC.r0, 0);
      p.setXYZ(i * 2 + 1, s * ARC.r1, c * ARC.r1, 0);
    }
    p.needsUpdate = true;
  }

  /** the setting hand under a ray, if any */
  private handAt(ray: THREE.Ray): SetHand | null {
    this.ray.ray.copy(ray);
    const hits = this.ray.intersectObjects(this.setGrips, false);
    if (!hits.length) return null;
    // the tips first (they overlap where the hands cross)
    const tip = hits.find((h) => (h.object as THREE.Mesh).geometry.type === 'CircleGeometry');
    return ((tip ?? hits[0]).object.userData.hand as SetHand) ?? null;
  }
  /** the time a setting hand would show if it pointed at the ray's spot on the dial (snapped to 5 minutes, kept within
   * its window and to a 3 to 12 hour night), or null near the dial's middle */
  private timeAt(hand: SetHand, ray: THREE.Ray): number | null {
    const p = ray.intersectPlane(this.dialPlane, v3(0, 0, 0));
    if (!p) return null;
    const dx = p.x, dy = p.y - DIAL.y;
    if (Math.hypot(dx, dy) < 0.025) return null;
    const ang = (Math.atan2(dx, dy) + Math.PI * 2) % (Math.PI * 2);
    const m12 = (ang / (Math.PI * 2)) * 720, base = SET_FROM[hand];
    const o = Math.min(715, Math.round(((((m12 - (base % 720)) % 720) + 720) % 720) / 5) * 5);
    return fitSet(hand, base + o, hand === 'bed' ? this.setMin.wake : this.setMin.bed);
  }
  private dragTo(ray: THREE.Ray) {
    const h = this.dragHand;
    if (!h) return;
    const t = this.timeAt(h, ray);
    if (t === null || t === this.setMin[h]) return;
    this.setMin[h] = t;
    sound.play('clock_tick', { volume: 0.24, rate: h === 'bed' ? 1.18 : 1.32, gap: 28 });
    this.onSet?.(h, t, 'move');
  }
  private endDrag() {
    const h = this.dragHand;
    if (!h) return;
    this.dragHand = null;
    if (this.dom) this.dom.style.cursor = '';
    sound.play('wood_knock', { volume: 0.22, rate: 1.7, gap: 60 });
    this.shop?.approve(v3(0, DIAL.y, CD));
    this.onSet?.(h, this.setMin[h], 'end');
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
    // no carved owl crest on the roof: the only owl is the one behind the little door
    const carveG = K.carveShade(K.merge(carve, WOOD_TILE), { lo: 0.36 });
    S.add(this.mesh(woodG, this.M.wood), this.mesh(carveG, this.M.carve));
    if (leaves.length) S.add(this.mesh(K.carveShade(K.merge(leaves), { lo: 0.22, z0: CD, z1: CD + 0.035 }), this.M.leaf));
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
    // a pick box round the gable and the balcony
    this.hitBox(0.4, 0.32, 0.2, v3(0, DOOR.y + 0.11, 0.3), 'door');
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

  // ---------------------------------------------------------------- the candle sconces

  private buildLamps() {
    const halo = this.keep(new THREE.CanvasTexture(K.haloCanvas()));
    for (const sx of [-1, 1]) {
      const G = new THREE.Group();
      G.position.set(sx * 0.82, 0.36, 0);
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
    this.shop?.heard(v3(0, DOOR.y + 0.1, PERCH_OUT));
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
    sound.play('owl_hoot', { volume: 0.42, rate: 1.34 + (i % 2) * 0.02, gap: 0 });
    setTimeout(() => { if (!this.dead) sound.play('owl_hoot', { volume: 0.38, rate: 1.08, gap: 0 }); }, 300);
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
        if (s.mode === 'hello' && s.done === s.calls && s.t > 0.15 + s.calls * gap + 0.4 && !s.look && this.shop) { s.look = this.shop.beaver.headWorld(); }
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
    if (id === 'set:bed' || id === 'set:wake') {
      const P = this.setPivot[id.slice(4) as SetHand];
      return (P.userData.tip as THREE.Object3D).getWorldPosition(v3(0, 0, 0));
    }
    if (id === 'dial') return v3(0, DIAL.y, CD + 0.02);
    if (id.startsWith('weight:')) return this.cones[+id.slice(7)].position.clone().add(v3(0, -0.1, 0));
    if (id === 'door' || id === 'owl') return v3(0, DOOR.y + 0.08, PERCH_OUT);
    if (id === 'pendulum') return v3(0, PEND.y - PEND.len, PEND.z);
    if (id === 'barnaby' && this.shop) return this.shop.beaver.headWorld();
    return v3(0, 0.3, 0.2);
  }
  /** Screen position (CSS px) of a thing (for DOM labels); `on` is false when it's off screen. */
  anchor(id: string): { x: number; y: number; on: boolean } {
    const q = this.anchorWorld(id).project(this.camera);
    const x = (q.x * 0.5 + 0.5) * this.w, y = (-q.y * 0.5 + 0.5) * this.h;
    return { x, y, on: q.z < 1 && x > -20 && x < this.w + 20 && y > -20 && y < this.h + 20 };
  }

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray, e?: PointerEvent): boolean {
    const at = e?.timeStamp ?? performance.now();
    if (type === 'down') {
      // a setting hand: pick it up and turn it round the dial
      const hand = this.handAt(ray);
      if (hand) {
        this.dragHand = hand;
        this.downAt = null;
        if (this.dom) this.dom.style.cursor = 'grabbing';
        sound.play('clock_wind', { volume: 0.2, rate: 1.6, gap: 80 });
        this.shop?.look(v3(0, DIAL.y, CD), 30);
        this.onSet?.(hand, this.setMin[hand], 'start');
        return true;
      }
      this.downAt = { x, y, t: at };
      return true;
    }
    if (type === 'move') {
      if (this.dragHand) { this.dragTo(ray); return true; }
      if (e && e.pointerType === 'mouse' && e.buttons === 0) {
        const h = this.handAt(ray);
        if (h !== this.hoverHand) { this.hoverHand = h; if (this.dom) this.dom.style.cursor = h ? 'grab' : ''; }
      }
      return true;
    }
    if (this.dragHand) { this.endDrag(); return true; }
    if (!this.downAt) return true;
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
    // Barnaby: a pick box round him and his bench
    if (!id && this.shop) {
      const b = this.shop.beaver.headWorld();
      if (ray.distanceToPoint(b.clone().add(v3(0, -0.25, 0))) < 0.42) id = 'barnaby';
    }
    if (id) this.onPick?.(id);
    return true;
  }

  // ---------------------------------------------------------------- the camera

  /** The part of the screen the 2D panel covers (CSS px): the shots frame what's left. */
  private inset = { right: 0, bottom: 0, top: 0 };
  setInset(right: number, bottom: number, top = 0) {
    if (Math.abs(right - this.inset.right) < 1 && Math.abs(bottom - this.inset.bottom) < 1 && Math.abs(top - this.inset.top) < 1) return;
    this.inset = { right, bottom, top };
    // ease to the new framing
    this.focus(this.shotName);
  }

  private homeShot(): Shot {
    // a wide screen: the clock and Barnaby at his bench to its left; a phone: the whole clock
    return this.layout === 'side'
      ? { target: v3(-0.56, 0.2, 0.3), yaw: 0.05, pitch: 0.05, w: 2.45, h: 2.3, cx: 0.5, cy: 0.5 }
      : { target: v3(0, 0.42, 0.25), yaw: 0.0, pitch: 0.04, w: 1.3, h: 2.0, cx: 0.5, cy: 0.5 };
  }
  private shot(name: string): Shot {
    const side = this.layout === 'side';
    if (name === 'home') return this.homeShot();
    const p = this.anchorWorld(name);
    const card = (w: number, h: number, yaw = 0, pitch = 0.04): Shot => ({ target: p, yaw, pitch, w, h, cx: 0.5, cy: 0.5 });
    if (name === 'dial') return side ? card(0.92, 0.92, 0, 0.02) : card(0.74, 0.74, 0, 0.02);
    if (name === 'door' || name === 'owl') return card(0.7, 0.62, 0.12, 0.08);
    if (name === 'barnaby') return { target: p.clone().add(v3(0.1, -0.25, 0.2)), yaw: 0.25, pitch: 0.06, w: 1.4, h: 1.25, cx: 0.5, cy: 0.5 };
    if (name === 'intro') return side ? { target: v3(-0.1, 0.72, 0.28), yaw: 0.1, pitch: 0.06, w: 2.1, h: 1.45, cx: 0.5, cy: 0.5 } : { target: v3(0, 0.74, 0.28), yaw: 0.1, pitch: 0.06, w: 1.0, h: 1.3, cx: 0.5, cy: 0.5 };
    if (name.startsWith('weight:') || name === 'pendulum') return card(0.8, 0.95, 0, 0.04);
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
  }
  get current() { return this.shotName; }

  /** the distance that fits a shot into the part of the screen the panel leaves free */
  private fitDist(s: Shot): number {
    const t = Math.tan((FOV * Math.PI) / 360) * 2, rw = Math.max(80, this.w - this.inset.right), rh = Math.max(80, this.h - this.inset.bottom - this.inset.top);
    return Math.max((s.h * this.h) / rh, (s.w * this.h) / rw) / t;
  }
  private applyCamera(s: Shot) {
    const c = this.camera, dist = this.fitDist(s);
    const cp = Math.cos(s.pitch);
    c.position.set(s.target.x + Math.sin(s.yaw) * cp * dist, s.target.y + Math.sin(s.pitch) * dist, s.target.z + Math.cos(s.yaw) * cp * dist);
    c.lookAt(s.target);
    c.fov = FOV;
    c.aspect = this.w / this.h;
    // the target sits at (cx, cy) of the free part of the screen
    const rw = this.w - this.inset.right, rh = Math.max(80, this.h - this.inset.bottom - this.inset.top);
    c.setViewOffset(this.w, this.h, this.w / 2 - s.cx * rw, this.h / 2 - this.inset.top - s.cy * rh, this.w, this.h);
    c.updateProjectionMatrix();
    return dist;
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const side = w >= h * 1.05 && w >= 640;
    const was = this.layout;
    this.layout = side ? 'side' : 'top';
    void was;
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
    const s = this.cur, drift = this.dragHand ? 0 : Math.sin(t * 0.17) * 0.012;
    const dist = this.applyCamera({ ...s, w: s.w * (1 + (1 - e) * 0.22), h: s.h * (1 + (1 - e) * 0.22), yaw: s.yaw + drift + (1 - e) * 0.1, pitch: s.pitch + (1 - e) * 0.05 });
    this.look.focus = dist;
    this.look.focusRange = Math.max(0.6, dist * (this.shotName === 'home' ? 0.32 : 0.2));
    this.look.blur = this.shotName === 'home' ? 0.16 : 0.34;

    // the time: hands, the hourly and half-hourly cuckoo
    const now = new Date();
    const m = now.getMinutes() + now.getSeconds() / 60 + now.getMilliseconds() / 60000, hr = (now.getHours() % 12) + m / 60;
    this.minute.rotation.z = -(m / 60) * Math.PI * 2;
    this.hour.rotation.z = -(hr / 12) * Math.PI * 2;
    if ((this.clockT -= dt) <= 0) {
      this.clockT = 0.5;
      const key = `${now.getHours()}:${now.getMinutes()}`;
      if (now.getSeconds() < 4 && key !== this.lastChime && this.enterT >= 1 && this.prefs.chime !== false) {
        if (now.getMinutes() === 0) { this.lastChime = key; this.cuckoo(now.getHours() % 12 || 12); }
        else if (now.getMinutes() === 30) { this.lastChime = key; this.cuckoo(1); }
      }
      this.setDrops();
    }
    // the setting hands chase their times (quick while dragged), the night arc follows them
    for (const h of ['bed', 'wake'] as SetHand[]) {
      const A = this.setAng[h], P = this.setPivot[h];
      let diff = angOf(this.setMin[h]) - A.a;
      diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      const k = this.dragHand === h ? 900 : 120, damp = 2 * Math.sqrt(k);
      A.v += (diff * k - A.v * damp) * dt;
      A.a += A.v * dt;
      A.a = ((A.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      P.rotation.z = -A.a;
      // the enamel stays upright as the hand goes round; the one being held lifts a touch
      const tip = P.userData.tip as THREE.Object3D;
      (tip.userData.spin as THREE.Object3D).rotation.z = A.a;
      const lift = this.dragHand === h ? 1.18 : this.hoverHand === h ? 1.1 : 1;
      tip.scale.setScalar(THREE.MathUtils.lerp(tip.scale.x, lift, 1 - Math.exp(-dt * 14)));
    }
    this.layArc();
    // the pendulum: a soft tick at each end of its swing
    const sw = Math.sin((t / 1.6) * Math.PI * 2);
    this.pend.rotation.z = sw * 0.11;
    const sign = Math.sign(Math.cos((t / 1.6) * Math.PI * 2));
    if (sign !== this.lastSign && this.lastSign !== 0 && !this.prefs.mute && !document.hidden) sound.play('clock_tick', { volume: 0.1, rate: sign > 0 ? 1 : 0.9, gap: 200 });
    this.lastSign = sign;
    // candles flicker
    for (const l of this.lamps) {
      const f = 0.86 + Math.sin(t * 9.1 + l.phase) * 0.05 + Math.sin(t * 15.3 + l.phase * 2) * 0.05 + Math.sin(t * 2.3 + l.phase) * 0.04;
      l.light.intensity = (l.light.userData.base as number ?? 2) * f;
      l.flame.scale.set(1, 0.9 + f * 0.15, 1);
      (l.halo.material as THREE.SpriteMaterial).opacity = (0.28 + this.night * 0.3) * f;
    }
    this.stepOwl(dt, Math.min(1, rawDt));
    if (this.shop) { this.shop.setCamera(this.camera.position); this.shop.update(dt, t); }
    // warm motes drifting in the lamp light
    if ((this.moteT -= dt) <= 0) {
      this.moteT = 0.3;
      this.fx.emit({ x: -2.2 + Math.random() * (this.layout === 'side' ? 3.4 : 1.4) + (this.layout === 'side' ? 0 : 1.5), y: -0.9 + Math.random() * 2.3, z: 0.25 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.01, vy: 0.006 + Math.random() * 0.01, life: 8, frame: SPR.mote, color: 0xffe2a8, size: 0.01 + Math.random() * 0.01, flutter: 0.04, fadeIn: 2, fadeOut: 2.5, add: true });
    }
    this.fx.update(dt, t);
  }

  dispose() {
    this.dead = true;
    if (this.dom) this.dom.style.cursor = '';
    this.shop?.dispose();
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
