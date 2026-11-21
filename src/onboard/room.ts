// The interview room: Pip's little office inside the oak, shown as a Stage (see world/scene.ts). Every piece of
// furniture is a hand-made lowpix model (props.ts, art/lowpix/interview/): heartwood walls with a panelled
// wainscot, a partners' desk with a sliding drawer, a banker's lamp, a bookcase crammed with books, a pendulum
// clock whose hands really turn, a round window with velvet curtains and the real sky behind it, a cork board
// of sleep notes, a woven rug, a globe, plants, a lantern. A cinematic camera with named shots, slow push-ins,
// handheld drift and hard cuts; Pip in reading glasses with a clipboard; and props that pop in with squash and
// stretch for the answer vignettes.
import * as THREE from 'three';
import { PX } from '../gfx/box.ts';
import { P as PAL } from '../gfx/palette.ts';
import { sceneSound, sound } from '../audio/sound.ts';
import { OwlActor, type OwlFx } from '../owl/actor.ts';
import { featherColour, G, type OwlLook } from '../owl/model.ts';
import { Fx, SPR } from '../world/fx.ts';
import type { Stage } from '../world/scene.ts';
import { DESK, loadModels, model, onWall, release, ROOM, type ModelId } from './props.ts';
import { SkyView, type Weather } from './skyview.ts';

export type ShotName = 'establish' | 'pip' | 'pipL' | 'pipR' | 'close' | 'desk' | 'window' | 'clock' | 'clockwin' | 'board' | 'floor' | 'bed' | 'low' | 'wide' | 'tower';
interface Shot { target: THREE.Vector3; yaw: number; pitch: number; dist: number; fov?: number; /** distance on a portrait screen */ pd?: number }

const U = (px: number) => px * PX;
const R0 = 80;
const WIN_A = -0.72, BOARD_A = 0.72;
/** where things are */
export const SPOT = {
  desk: new THREE.Vector3(0, 0.962, -3.625),
  floor: new THREE.Vector3(U(26), 0, U(10)),
  bed: new THREE.Vector3(1.35, 0.58, 0.25),
  window: new THREE.Vector3(Math.sin(WIN_A) * U(R0 - 2), U(50), -Math.cos(WIN_A) * U(R0 - 2)),
  board: new THREE.Vector3(Math.sin(BOARD_A) * U(R0 - 2), U(52), -Math.cos(BOARD_A) * U(R0 - 2)),
  clock: new THREE.Vector3(0, 4.0, -4.85),
  lamp: new THREE.Vector3(-0.6, DESK.h, -2.78),
};
const DESK_TOP = DESK.h;
/** the seat of Pip's chair (a stack of books on it brings Pip up to SPOT.desk) */
const CHAIR_SEAT = 0.52;

const SHOTS: Record<ShotName, () => Shot> = {
  establish: () => ({ target: new THREE.Vector3(0, 2.0, -1.4), yaw: 0, pitch: 0.12, dist: 11.5, pd: 7.4 }),
  wide: () => ({ target: new THREE.Vector3(0.2, 1.8, -1.0), yaw: 0.32, pitch: 0.2, dist: 10, pd: 7.2 }),
  pip: () => ({ target: new THREE.Vector3(0, 1.85, -3.3), yaw: 0, pitch: 0.22, dist: 5.2 }),
  pipL: () => ({ target: new THREE.Vector3(-0.1, 1.8, -3.2), yaw: -0.42, pitch: 0.16, dist: 5.4 }),
  pipR: () => ({ target: new THREE.Vector3(0.15, 1.95, -3.1), yaw: 0.45, pitch: 0.14, dist: 6.4 }),
  close: () => ({ target: new THREE.Vector3(0, 2.05, -3.5), yaw: 0.08, pitch: 0.24, dist: 3.6 }),
  low: () => ({ target: new THREE.Vector3(0, 1.8, -3.0), yaw: -0.18, pitch: 0.0, dist: 6 }),
  desk: () => ({ target: new THREE.Vector3(0.45, 1.0, -2.3), yaw: 0.2, pitch: 0.48, dist: 5.4 }),
  window: () => ({ target: SPOT.window.clone().add(new THREE.Vector3(1.1, -0.6, 0.8)), yaw: -0.36, pitch: 0.06, dist: 5.4 }),
  clock: () => ({ target: SPOT.clock.clone().add(new THREE.Vector3(0, -0.5, 0.6)), yaw: 0.05, pitch: -0.04, dist: 4.4 }),
  clockwin: () => ({ target: SPOT.clock.clone().lerp(SPOT.window, 0.45).add(new THREE.Vector3(0.1, -0.7, 1.2)), yaw: -0.2, pitch: 0.02, dist: 6.2 }),
  tower: () => ({ target: SPOT.floor.clone().add(new THREE.Vector3(-0.2, 1.5, 0)), yaw: 0.3, pitch: 0.18, dist: 7.2 }),
  board: () => ({ target: SPOT.board.clone().add(new THREE.Vector3(-0.9, -0.4, 0.8)), yaw: 0.36, pitch: 0.05, dist: 5 }),
  floor: () => ({ target: SPOT.floor.clone().add(new THREE.Vector3(-0.4, 0.95, 0.2)), yaw: 0.3, pitch: 0.36, dist: 6.6 }),
  bed: () => ({ target: SPOT.bed.clone().add(new THREE.Vector3(-0.2, 0.3, 0.5)), yaw: 0.36, pitch: 0.34, dist: 7 }),
};

/** A damped spring for one number. */
class Spring {
  v = 0;
  constructor(public x = 0, public target = 0, public k = 160, public d = 12) {}
  step(dt: number) { const a = (this.target - this.x) * this.k - this.v * this.d; this.v += a * dt; this.x += this.v * dt; return this.x; }
}

interface Spawned { obj: THREE.Object3D; s: Spring; dying: boolean; delay: number; base: THREE.Vector3; tick?: (o: THREE.Object3D, t: number, dt: number) => void; born: number }

export interface Vig { update?(t: number, dt: number): void; exit?(): void; /** a live value from the clipboard (hours of sleep...) */ set?(v: number): void }

export class InterviewRoom implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  /** Pip as he looks right now; one actor per species, built once and reused for previews */
  private actor: OwlActor;
  private actors = new Map<string, OwlActor>();
  get pip(): OwlActor { return this.actor; }
  readonly fx = new Fx(700);
  readonly sky = new SkyView();
  time = 0;
  /** the UI covers part of the screen: shift the picture (fractions of the screen) */
  frame = { x: 0, y: 0 };
  private frameCur = { x: 0, y: 0 };
  private shotName: ShotName = 'establish';
  private shot: Shot = SHOTS.establish();
  private cur: Shot = SHOTS.establish();
  private shotAt = 0;
  private baseFov = 32;
  private spawned: Spawned[] = [];
  private vig: Vig | null = null;
  vigId: string | null = null;
  private disposers: (() => void)[] = [];
  private lampLight: THREE.PointLight;
  private hangLight: THREE.PointLight;
  private candleLight: THREE.PointLight;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private beam: THREE.Mesh;
  private hourHand: THREE.Object3D | null = null;
  private minHand: THREE.Object3D | null = null;
  private pend: THREE.Object3D | null = null;
  private flame: THREE.Object3D | null = null;
  private clockSpin = 0;
  /** previewed clock time in minutes after midnight (null = real time) */
  clockAt: number | null = null;
  ticking = false;
  private tickT = 0;
  private drawerObj = new THREE.Group();
  private drawerS = new Spring(0, 0, 120, 14);
  private plate: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; name: string };
  private plateMesh: THREE.Mesh;
  private props = new THREE.Group();
  private furniture = new THREE.Group();
  private pipAt: keyof typeof SPOT | 'custom' = 'desk';
  private trip: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; done?: () => void } | null = null;
  private moteT = 0;
  private talkT = 0;
  private quality: 'low' | 'high';
  private glassesOn = true;
  private boardOn = true;
  private loaded = false;
  /** world-space point the camera looks at, for anchoring UI */
  readonly focus = new THREE.Vector3();

  constructor(look: OwlLook, quality: 'low' | 'high' = 'high') {
    this.quality = quality;
    const s = this.scene;
    const bg = new THREE.Color(0x1d1813);
    s.background = bg;
    s.fog = new THREE.Fog(bg, 16, 34);
    this.fx.setLight(new THREE.Color(1.0, 0.94, 0.86));
    s.add(this.fx.group, this.props, this.furniture);

    // ---- light: warm fill, the desk lamp, the lantern, a candle, daylight (or moonlight) through the window
    this.hemi = new THREE.HemisphereLight(0xf4ead8, 0x4a392b, 0.75);
    s.add(this.hemi, new THREE.AmbientLight(0x617f8c, 0.22));
    this.lampLight = new THREE.PointLight(PAL.lamp, 3.0, 6, 1.6);
    this.lampLight.position.copy(SPOT.lamp).add(new THREE.Vector3(0.05, 0.55, 0.15));
    s.add(this.lampLight);
    const front = new THREE.PointLight(0xf4e6d0, 1.25, 14, 1.2);
    front.position.set(0.5, 3.2, 3.5);
    s.add(front);
    this.hangLight = new THREE.PointLight(PAL.honey, 1.3, 6, 1.6);
    this.hangLight.position.set(-1.875, 4.75, -0.3);
    this.candleLight = new THREE.PointLight(PAL.lamp, 0.5, 2.2, 1.8);
    this.candleLight.position.set(0.7, DESK_TOP + 0.4, -2.2);
    s.add(this.hangLight, this.candleLight);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    const wdir = SPOT.window.clone().setY(0).normalize();
    this.sun.position.copy(SPOT.window).add(wdir.multiplyScalar(4)).add(new THREE.Vector3(0, 2.2, 0));
    this.sun.target.position.set(0.6, 0, -1.2);
    this.sun.castShadow = true;
    const sz = quality === 'high' ? 1024 : 512;
    this.sun.shadow.mapSize.set(sz, sz);
    Object.assign(this.sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    this.sun.shadow.bias = -0.0015;
    s.add(this.sun, this.sun.target);

    // the window: the painted sky behind the frame (a 16-gon to match the frame), and a beam of light
    const skyMat = new THREE.MeshBasicMaterial({ map: this.sky.tex, toneMapped: false });
    const skyMesh = new THREE.Mesh(new THREE.CircleGeometry(0.96, 16), skyMat);
    const n = new THREE.Vector3(-Math.sin(WIN_A), 0, Math.cos(WIN_A));
    skyMesh.position.copy(SPOT.window).addScaledVector(n, -0.09);
    skyMesh.rotation.y = -WIN_A;
    s.add(skyMesh);
    this.disposers.push(() => { skyMesh.geometry.dispose(); skyMat.dispose(); });
    this.beam = this.makeBeam();
    s.add(this.beam);

    // the drawer slides out of the right pedestal
    this.drawerObj.name = 'ob-drawer';
    this.drawerObj.position.set(DESK.drawerX, DESK.drawerY, DESK.z + DESK.d / 2);
    s.add(this.drawerObj);

    // the name on the plate is a canvas texture over the brass
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 24;
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
    this.plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.186), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
    this.plate = { cv, tex, name: '' };
    this.disposers.push(() => { this.plateMesh.geometry.dispose(); (this.plateMesh.material as THREE.Material).dispose(); tex.dispose(); });

    // ---- Pip
    this.actor = this.makeActor(look);
    s.add(this.pip.node);
    this.pip.node.position.copy(SPOT.desk);

    this.setNameplate('Pip');
    this.applyClock(0);
    this.cut('establish');
    void loadModels().then(() => this.furnish());
  }

  // ---------------------------------------------------------------- the office

  private put(id: ModelId, x: number, y: number, z: number, ry = 0, scale = 1, parent: THREE.Object3D = this.furniture) {
    const m = model(id);
    m.position.set(x, y, z); m.rotation.y = ry; m.scale.setScalar(scale);
    parent.add(m);
    return m;
  }
  /** on the curved wall: angle a, height y, `inset` from the wall, facing into the room */
  private onWall(id: ModelId, a: number, y: number, inset = 0) { const p = onWall(a, y, inset); return this.put(id, p.x, p.y, p.z, -a); }

  /** Place every model once they are loaded. */
  private furnish() {
    if (this.loaded) return;
    this.loaded = true;
    const T = DESK_TOP;
    this.put('room', 0, 0, 0).traverse((o) => { o.castShadow = false; });
    this.put('rug', 0.4, 0.005, 0.5);
    // the desk (an old chest of drawers), Pip's tall chair with a stack of books to stand on
    this.put('b_desk', 0, 0, DESK.z);
    this.put('b_chair', 0, 0, SPOT.desk.z - 0.05);
    this.put('books_stack', 0, CHAIR_SEAT, SPOT.desk.z, 0.3, 1.05);
    // on the desk: an oil lamp, the inkwell, papers, a candle, tea, a stack of books and the name block
    this.put('b_oillamp', SPOT.lamp.x, T, SPOT.lamp.z, 0.4);
    this.put('inkwell', -0.24, T, DESK.z + 0.26, 0.3, 0.85);
    this.put('papers', 0.22, T, DESK.z + 0.2, -0.2, 0.7);
    this.put('candle', 0.7, T, DESK.z + 0.28, 0, 0.8);
    this.put('teacup', -0.66, T, DESK.z + 0.3, 0.4, 0.85);
    this.put('books_stack', 0.56, T, DESK.z - 0.3, -0.25, 0.62);
    const np = this.put('nameplate', 0.02, T, DESK.z + 0.42, 0.05, 0.6);
    this.plateMesh.position.set(0, 0.17, 0.077);
    this.plateMesh.rotation.x = (-20 * Math.PI) / 180;
    np.add(this.plateMesh);
    // the walls: window and curtains over a painted cabinet, cork board, bookcase, clock, painting, the little shelf
    this.onWall('window', WIN_A, U(50), U(4));
    this.onWall('curtains', WIN_A, U(50), U(4));
    const cab = onWall(WIN_A, 0, 0.42);
    this.put('b_cabinet', cab.x, 0, cab.z, -WIN_A, 1.12);
    this.put('g_pothos', cab.x + 0.15, 1.32, cab.z + 0.12, 0.5, 0.48);
    this.onWall('corkboard', BOARD_A, 2.35, 0.06);
    const bc = onWall(1.22, 0, 0.45), bk = 1.35;
    const shelf = this.put('b_bookcase', bc.x, 0, bc.z, -1.22, bk);
    // fill the bookcase: rows of books, a stack of old ones, the jug, a bowl, the mantel clock on top
    const fill: [ModelId, number, number, number, number][] = [
      ['books_row', -0.48, 0.09, 0.0, 0.5], ['books_row', 0.05, 0.09, 0.02, 0.5], ['g_books', -0.25, 0.47, 0.02, 1.3], ['books_row', 0.12, 0.47, 0.0, 0.5],
      ['books_row', -0.5, 0.84, 0.0, 0.5], ['b_jug', 0.3, 0.84, 0.03, 1.0], ['books_row', -0.42, 1.21, 0.0, 0.5], ['b_bowl', 0.28, 1.21, 0.02, 0.9],
      ['b_mantelclock', 0.0, 2.06, 0.02, 1.3],
    ];
    for (const [id, x, y, z, k] of fill) this.put(id, x, y, z, 0, k / bk, shelf);
    this.onWall('painting', -0.25, 1.95, 0.04);
    this.onWall('wallshelf', 0.3, 3.2, 0.02);
    const clock = this.onWall('clock', 0, SPOT.clock.y, 0.02);
    this.hourHand = clock.getObjectByName('hand_h') ?? null;
    this.minHand = clock.getObjectByName('hand_m') ?? null;
    this.pend = clock.getObjectByName('pendulum') ?? null;
    // the floor: a big plant, the globe, a side table with an aloe, a basket of books, a suitcase with books on it
    this.put('g_plant', Math.sin(-1.2) * 4.4, 0, -Math.cos(-1.2) * 4.4, 0.4, 1.35);
    this.put('globe', -3.25, 0, -0.45, 0.6);
    this.put('b_sidetable', -2.55, 0, 1.0, 0.3, 1.8);
    this.put('g_aloe', -2.55, 0.42 * 1.8, 1.0, 0.2, 3.2);
    this.put('b_basket', 1.45, 0, -1.75, 0.5, 1.6);
    this.put('g_books', 1.45, 0.06, -1.75, 0.9, 1.2);
    this.put('b_suitcase', 3.3, 0, 0.2, -0.5, 1.45);
    this.put('books_stack', 3.3, 0.57 * 1.45, 0.2, 0.2, 0.9);
    this.put('ivy', -4.2, ROOM.H, 2.4, 0.2);
    this.put('ivy', 3.3, ROOM.H, 2.7, 2.1, 0.9);
    // the lantern on a chain from the ceiling
    this.put('b_lantern', -1.875, 4.45, -0.375, 0.3, 2.4);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, ROOM.H - 4.45 - 0.66, 4), new THREE.MeshStandardMaterial({ color: PAL.iron, roughness: 1 }));
    chain.position.set(-1.875, (ROOM.H + 4.45 + 0.66) / 2, -0.375);
    this.furniture.add(chain);
    this.disposers.push(() => { chain.geometry.dispose(); (chain.material as THREE.Material).dispose(); });
    this.flame = this.furniture.getObjectByName('flame') ?? null;
    // the drawer that slides out for the phone (hidden in the chest until it opens)
    const dr = model('desk_drawer');
    dr.scale.setScalar(0.62);
    this.drawerObj.add(dr);
    this.drawerObj.visible = false;
    this.dress();
  }

  // ---------------------------------------------------------------- Pip's look

  /** Reading glasses on the nose and a tiny clipboard in the wings. */
  private dress() {
    const B = this.pip.model.rig.bones;
    const eyes = this.pip.model.eyeMeshes as THREE.Mesh[] | undefined;
    const ex = eyes?.[1] ? Math.abs(eyes[1].position.x) / PX : G.eyeX;
    const ey = eyes?.[1] ? eyes[1].position.y / PX : G.eyeY - 13.4;
    const ez = eyes?.[1] ? eyes[1].position.z / PX : G.discFront - 0.4;
    const geo = (this.pip.model as { g?: typeof G }).g ?? G;
    if (this.glassesOn && B.head && this.loaded) {
      const g = model('glasses', { shadows: false });
      // the model's lenses sit 0.2 apart from the middle; stretch to this owl's eyes
      const k = (ex * PX) / 0.2;
      g.scale.set(k, k * 0.95, k);
      g.position.set(0, U(ey - 0.3), U(ez + 0.9));
      g.name = 'ob-glasses';
      B.head.add(g);
    }
    if (this.boardOn && B.body && this.loaded) {
      const c = model('clipboard_small');
      c.position.set(U(2.2), U(1.5), U(geo.bodyD / 2 + 2.6));
      c.rotation.set(-0.95, -0.15, -0.1);
      c.name = 'ob-board';
      B.body.add(c);
    }
  }
  private undress() {
    for (const n of ['ob-glasses', 'ob-board']) {
      const o = this.pip.node.getObjectByName(n);
      if (o) o.parent?.remove(o);
    }
  }
  /** Hold the clipboard (and wear the glasses) or put them down. */
  props3(o: { glasses?: boolean; board?: boolean }) {
    if (o.glasses !== undefined) this.glassesOn = o.glasses;
    if (o.board !== undefined) this.boardOn = o.board;
    this.undress(); this.dress();
  }

  private lookKey = (l: OwlLook) => `${l.skin ?? 'owl'}:${l.species ?? ''}:${l.palette}`;
  private makeActor(look: OwlLook) {
    const a = new OwlActor(look, { fx: (k, at, n) => this.owlFx(k, at, n), sound: (id) => sceneSound('owl_' + id) });
    this.actors.set(this.lookKey(look), a);
    return a;
  }

  /** Swap Pip's look with a puff of feathers (the species preview). Each look is built once. */
  setLook(look: OwlLook, poof = true) {
    const key = this.lookKey(look), old = this.actor;
    const next = this.actors.get(key) ?? this.makeActor(look);
    if (next !== old) {
      this.undress();
      next.node.position.copy(old.node.position);
      next.node.rotation.copy(old.node.rotation);
      next.pose = old.pose; next.lookAt = old.lookAt; next.breath = old.breath;
      next.setMood(old.mood);
      this.scene.remove(old.node);
      this.scene.add(next.node);
      this.actor = next;
      this.dress();
    }
    if (poof) {
      const at = this.pip.node.position.clone().add(new THREE.Vector3(0, 1.0, 0.1));
      this.fx.burst('sparkle', at.x, at.y, at.z, 10);
      this.owlFx('feather', at, 9);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.fx.emit({ x: at.x, y: at.y - 0.3, z: at.z, vx: Math.cos(a) * 1.4, vy: 0.4 + Math.random() * 0.6, vz: Math.sin(a) * 1.4, life: 0.7, frame: SPR.puff1, frames: 3, fps: 6, color: 0xf4eedd, size: 0.55, drag: 3, grow: 0.8 });
      }
      this.pip.play('ruffle');
      sound.play('tp_shimmer', { volume: 0.35, gap: 120 });
    }
  }

  setNameplate(name: string) {
    if (name === this.plate.name) return;
    this.plate.name = name;
    const { cv, tex } = this.plate, g = cv.getContext('2d')!;
    g.clearRect(0, 0, cv.width, cv.height);
    g.font = '18px "TBME Body", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#5c4219'; g.fillText(name || '...', cv.width / 2 + 1, cv.height / 2 + 2);
    g.fillStyle = '#2e2b24'; g.fillText(name || '...', cv.width / 2, cv.height / 2 + 1);
    // no anti-aliased edges on the engraving: snap the alpha
    const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = d[i] > 110 ? 255 : 0;
    g.putImageData(img, 0, 0);
    tex.needsUpdate = true;
  }

  private owlFx(k: OwlFx, at: THREE.Vector3, n = 3) {
    const fx = this.fx;
    if (k === 'heart') fx.burst('hearts', at.x, at.y, at.z, n);
    else if (k === 'note') fx.burst('notes', at.x, at.y, at.z, n);
    else if (k === 'zzz') fx.burst('zzz', at.x + 0.2, at.y, at.z, Math.max(2, n));
    else if (k === 'sparkle') fx.burst('sparkle', at.x, at.y, at.z, n);
    else if (k === 'dust') this.puff(at, n);
    else if (k === 'feather') {
      const col = featherColour(this.pip.model.look.palette);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        fx.emit({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * 0.9, vy: 0.6 + Math.random() * 0.8, vz: Math.sin(a) * 0.9, life: 1.4 + Math.random(), frame: SPR.feather1, frames: 3, fps: 3, color: col, size: 0.2, gravity: 1.1, drag: 2.2, flutter: 0.6 });
      }
    }
  }
  /** a ring of dust puffs (props landing, Pip landing) */
  puff(at: THREE.Vector3, n = 6, col = 0xeae0c8) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      this.fx.emit({ x: at.x + Math.cos(a) * 0.15, y: at.y + 0.05, z: at.z + Math.sin(a) * 0.15, vx: Math.cos(a) * 1.1, vy: 0.25 + Math.random() * 0.3, vz: Math.sin(a) * 1.1, life: 0.45 + Math.random() * 0.2, frame: SPR.puff1, frames: 3, fps: 7, color: col, size: 0.32, drag: 3.2, grow: 0.6 });
    }
  }
  sparkle(at: THREE.Vector3, n = 6) { this.fx.burst('sparkle', at.x, at.y, at.z, n); }

  // ---------------------------------------------------------------- camera

  /** Move the camera to a shot (smoothly), or cut straight to it. */
  go(name: ShotName, cut = false) {
    if (name === this.shotName && !cut) return;
    this.shotName = name;
    this.shot = SHOTS[name]();
    this.shotAt = this.time;
    if (cut) this.snap();
  }
  cut(name: ShotName) { this.go(name, true); }
  get shotNow() { return this.shotName; }
  private snap() { const s = this.shot; this.cur = { target: s.target.clone(), yaw: s.yaw, pitch: s.pitch, dist: this.distOf(s) }; }
  private distOf(s: Shot) { return this.camera.aspect < 0.8 ? s.pd ?? s.dist * 1.12 : s.dist; }

  /** Screen position (CSS px) of a world point under the current camera. */
  screenOf(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
  }
  headScreen() { return this.screenOf(this.pip.headWorld); }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    const a = this.camera.aspect;
    this.baseFov = a >= 1 ? 40 : Math.min(72, (2 * Math.atan(Math.tan((20 * Math.PI) / 180) / Math.min(1, a * 1.08)) * 180) / Math.PI);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  private applyCamera(dt: number) {
    const t = this.time, s = this.shot, c = this.cur;
    // the pillow tower shot rides up with Pip
    if (this.shotName === 'tower') s.target.y = 0.9 + this.pip.node.position.y * 0.8;
    const k = 1 - Math.exp(-dt * 2.1);
    c.yaw += (s.yaw - c.yaw) * k; c.pitch += (s.pitch - c.pitch) * k; c.dist += (this.distOf(s) - c.dist) * k; c.target.lerp(s.target, k);
    // slow push-in after each move, and a soft handheld drift
    const since = t - this.shotAt, push = 1 - 0.075 * Math.min(1, since / 9) * Math.min(1, since / 9);
    const yaw = c.yaw + Math.sin(t * 0.37) * 0.012 + Math.sin(t * 1.13 + 1) * 0.004;
    const pitch = c.pitch + Math.sin(t * 0.51 + 2) * 0.008 + Math.sin(t * 1.7) * 0.002;
    const dist = c.dist * push;
    const cp = Math.cos(pitch);
    const tg = c.target;
    this.camera.position.set(tg.x + Math.sin(yaw) * cp * dist, tg.y + Math.sin(pitch) * dist, tg.z + Math.cos(yaw) * cp * dist);
    this.camera.lookAt(tg.x + Math.sin(t * 0.29) * 0.015, tg.y + Math.sin(t * 0.43) * 0.01, tg.z);
    this.camera.rotation.z += Math.sin(t * 0.23) * 0.004;
    this.focus.copy(tg);
    // framing around the UI
    const kf = 1 - Math.exp(-dt * 3);
    this.frameCur.x += (this.frame.x - this.frameCur.x) * kf; this.frameCur.y += (this.frame.y - this.frameCur.y) * kf;
    const w = innerWidth, h = innerHeight;
    if (Math.abs(this.frameCur.x) > 0.002 || Math.abs(this.frameCur.y) > 0.002) this.camera.setViewOffset(w, h, this.frameCur.x * w, this.frameCur.y * h, w, h);
    else this.camera.clearViewOffset();
    const fov = s.fov ?? this.baseFov;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov += (fov - this.camera.fov) * k; this.camera.updateProjectionMatrix(); }
  }

  // ---------------------------------------------------------------- Pip's moves

  /** Hop Pip to a spot (a little flying arc with flaps and a dusty landing). */
  pipTo(spot: keyof typeof SPOT | THREE.Vector3, done?: () => void) {
    const to = spot instanceof THREE.Vector3 ? spot.clone() : SPOT[spot].clone();
    this.pipAt = spot instanceof THREE.Vector3 ? 'custom' : spot;
    const from = this.pip.node.position.clone();
    if (from.distanceTo(to) < 0.05) { this.trip = null; this.pip.node.position.copy(to); done?.(); return; }
    this.trip = { from, to, t: 0, dur: 0.55 + Math.min(0.5, from.distanceTo(to) * 0.12), done };
    // the clipboard stays on the desk while Pip is off acting things out
    if (this.pipAt !== 'desk' && this.boardOn) this.props3({ board: false });
    this.pip.pose = 'fly';
    sound.play('wings_flutter', { volume: 0.5, gap: 150 });
  }
  get pipSpot() { return this.pipAt; }
  /** Place Pip without the hop. */
  placePip(spot: keyof typeof SPOT) { this.trip = null; this.pipAt = spot; this.pip.node.position.copy(SPOT[spot]); this.pip.pose = 'stand'; this.props3({ board: spot === 'desk' }); }

  private stepTrip(dt: number) {
    const tr = this.trip;
    if (!tr) return;
    tr.t += dt / tr.dur;
    const k = Math.min(1, tr.t), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const p = this.pip.node.position;
    p.lerpVectors(tr.from, tr.to, e);
    p.y += Math.sin(k * Math.PI) * (0.7 + tr.from.distanceTo(tr.to) * 0.12);
    const dx = tr.to.x - tr.from.x, dz = tr.to.z - tr.from.z;
    if (Math.hypot(dx, dz) > 0.1) this.pip.node.rotation.y = Math.atan2(dx, dz) * Math.sin(k * Math.PI) * 0.6;
    if (k >= 1) {
      this.trip = null;
      this.pip.node.rotation.y = 0;
      this.pip.pose = 'stand';
      this.puff(tr.to, 6);
      sound.play('pet_land', { volume: 0.4, gap: 100 });
      if (this.pipAt === 'desk' && !this.boardOn) this.props3({ board: true });
      tr.done?.();
    }
  }

  /** Pip's beak flaps while the floating text is talking. */
  talk() {
    const s = (this.pip as unknown as { s?: { jaw?: Spring; sy?: Spring } }).s;
    s?.jaw?.v !== undefined && (s.jaw.v += 7);
    s?.sy?.v !== undefined && (s.sy.v -= 0.25);
    this.talkT = 0.25;
  }

  // ---------------------------------------------------------------- the clock and the drawer

  /** Spin the clock hands round and let them settle (a steady routine!). */
  spinClock(turns = 3) { this.clockSpin += turns * Math.PI * 2; sound.play('clock_wind', { volume: 0.5, gap: 200 }); }
  drawer(open: boolean) { this.drawerS.target = open ? 0.82 : 0; sound.play('drawer', { volume: 0.55, gap: 150 }); }

  private applyClock(dt: number) {
    const now = new Date();
    const mins = this.clockAt ?? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    if (this.clockSpin > 0) this.clockSpin = Math.max(0, this.clockSpin - dt * (1.2 + this.clockSpin * 2.2));
    const m = (mins % 60) / 60, h = ((mins / 60) % 12) / 12;
    if (this.minHand) this.minHand.rotation.z = -(m * Math.PI * 2 + this.clockSpin * 12);
    if (this.hourHand) this.hourHand.rotation.z = -(h * Math.PI * 2 + this.clockSpin);
    if (this.pend) this.pend.rotation.z = Math.sin(this.time * Math.PI) * 0.16;
    if (this.ticking) {
      this.tickT -= dt;
      if (this.tickT <= 0) { this.tickT = 1; sound.play('clock_tick', { volume: 0.25, gap: 400 }); }
    }
  }

  // ---------------------------------------------------------------- props that pop in

  /**
   * Pop a prop model into the room with squash and stretch and a puff of dust. Returns the object; its
   * `tick` runs every frame while it lives.
   */
  spawn(id: ModelId, at: THREE.Vector3, o: { ry?: number; scale?: number; delay?: number; tint?: number; tick?: Spawned['tick']; quiet?: boolean } = {}): THREE.Object3D {
    const g = new THREE.Group();
    g.add(model(id, { tint: o.tint }));
    g.position.copy(at);
    g.rotation.y = o.ry ?? 0;
    g.userData.scale = o.scale ?? 1;
    g.scale.setScalar(0.001);
    this.props.add(g);
    this.spawned.push({ obj: g, s: new Spring(0, 1, 260, 13), dying: false, delay: o.delay ?? 0, base: at.clone(), tick: o.tick, born: this.time });
    if (!o.quiet) window.setTimeout(() => { sound.play('pickup_item', { volume: 0.35, rate: 1.1 + Math.random() * 0.2, gap: 60 }); }, (o.delay ?? 0) * 1000);
    return g;
  }
  /** Pop one prop out. */
  despawn(obj: THREE.Object3D) { const s = this.spawned.find((x) => x.obj === obj); if (s && !s.dying) { s.dying = true; s.s.target = 0; s.s.k = 300; } }
  /** Pass a live value to the running vignette. */
  param(v: number) { this.vig?.set?.(v); }
  /** Pop every vignette prop out. */
  clearProps() { for (const s of this.spawned) if (!s.dying) { s.dying = true; s.s.target = 0; s.s.k = 300; } }
  private stepProps(dt: number) {
    const keep: Spawned[] = [];
    for (const s of this.spawned) {
      if (s.delay > 0) { s.delay -= dt; if (s.delay <= 0) this.puff(s.obj.position, 7); keep.push(s); continue; }
      if (s.born >= 0 && !s.dying && s.s.x === 0 && s.s.v === 0 && s.delay <= 0) { this.puff(s.obj.position, 7); this.sparkle(s.obj.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 3); s.born = -1; }
      s.s.step(dt);
      const sc = Math.max(0.001, s.s.x) * (s.obj.userData.scale as number);
      const sq = THREE.MathUtils.clamp(s.s.v * 0.025, -0.25, 0.25);
      s.obj.scale.set(sc * (1 - sq * 0.5), sc * (1 + sq), sc * (1 - sq * 0.5));
      s.tick?.(s.obj, this.time, dt);
      if (s.dying && s.s.x < 0.02) {
        s.obj.parent?.remove(s.obj);
        release(s.obj);
        continue;
      }
      keep.push(s);
    }
    this.spawned = keep;
  }

  // ---------------------------------------------------------------- vignettes

  /** Start a vignette (props, Pip's acting, camera); null clears it. */
  setVignette(id: string | null, make?: (r: InterviewRoom) => Vig) {
    if (id === this.vigId) return;
    this.vig?.exit?.();
    this.vig = null;
    this.clearProps();
    this.vigId = id;
    if (id && make) this.vig = make(this);
  }

  /** Weather and hour shown through the window. */
  window(hour: number | null, w: Weather = 'clear') { this.sky.set(hour, w); }

  // ---------------------------------------------------------------- frame

  private makeBeam() {
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 32;
    const g = cv.getContext('2d')!;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 8; x++) {
      const across = 1 - Math.abs(x - 3.5) / 4, along = Math.min(1, y / 6) * (1 - y / 34);
      const a = Math.floor(across * along * 5) / 5;
      g.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(2)})`; g.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const geo = new THREE.PlaneGeometry(1.6, 6.2);
    const m = new THREE.Mesh(geo, mat);
    const from = SPOT.window.clone(), to = new THREE.Vector3(0.4, 0, -1.6);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to); m.rotateX(Math.PI / 2);
    m.position.y += 0.1;
    this.disposers.push(() => { geo.dispose(); mat.dispose(); tex.dispose(); });
    return m;
  }

  update(dt: number, t: number) {
    void t;
    this.time += dt;
    this.sky.update(dt);
    // daylight follows the window
    this.sun.color.copy(this.sky.light);
    this.sun.intensity = this.sky.lightI * 1.2;
    (this.beam.material as THREE.MeshBasicMaterial).color.copy(this.sky.light);
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.05 + this.sky.lightI * 0.07;
    this.hemi.intensity = 0.6 + this.sky.lightI * 0.18;
    this.lampLight.intensity = 3.0 + Math.sin(this.time * 9) * 0.08 + Math.sin(this.time * 23) * 0.05;
    this.hangLight.intensity = 1.3 + Math.sin(this.time * 5.3) * 0.1;
    const fl = Math.sin(this.time * 17) * 0.5 + Math.sin(this.time * 31 + 1) * 0.5;
    this.candleLight.intensity = 0.5 + fl * 0.08;
    if (this.flame) { this.flame.scale.set(1 - fl * 0.08, 1 + fl * 0.15, 1); this.flame.rotation.z = fl * 0.06; }

    this.stepTrip(dt);
    if (this.talkT > 0) this.talkT -= dt;
    this.pip.dark = this.sky.night * 0.4;
    this.pip.update(dt);
    this.drawerS.step(dt);
    this.drawerObj.position.z = DESK.z + DESK.d / 2 + this.drawerS.x * 0.62;
    this.drawerObj.visible = this.drawerS.x > 0.03;
    this.applyClock(dt);
    this.stepProps(dt);
    this.vig?.update?.(this.time, dt);

    // dust motes drifting in the window light
    if ((this.moteT -= dt) <= 0) {
      this.moteT = this.quality === 'high' ? 0.12 : 0.3;
      const k = Math.random(), p = SPOT.window.clone().lerp(new THREE.Vector3(0.4, 0.2, -1.6), k);
      this.fx.emit({ x: p.x + (Math.random() - 0.5) * 0.8, y: p.y + (Math.random() - 0.5) * 0.6, z: p.z + (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.3) * 0.05, vz: (Math.random() - 0.5) * 0.06, life: 4 + Math.random() * 3, frame: SPR.mote, color: 0xf6e8c8, size: 0.12 + Math.random() * 0.08, add: true, fadeIn: 1, fadeOut: 1.5, flutter: 0.05 });
    }
    this.fx.update(dt, this.time);
    this.applyCamera(dt);
  }

  dispose() {
    this.vig?.exit?.();
    for (const d of this.disposers) d?.();
    this.undress();
    for (const a of this.actors.values()) a.dispose();
    this.sky.dispose();
  }
}
