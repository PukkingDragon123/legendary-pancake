// The living diorama: renderer, camera views, day/night sky, the forest clearing (terrain, voxel
// flora, Moleforge pixel grass, critters, fireflies), Pip's grand hollow oak with its rooms, moving
// boxes and boarded-up floors, and Pip. Exposes a small API for the UI and emits events for taps
// and sounds.
import * as THREE from 'three';
import { PX, wind } from '../gfx/box.ts';
import { vivid } from '../gfx/glb.ts';
import { ALL_ITEMS, ITEMS } from '../assets/registry.ts';
import { OwlActor, type OwlFx, type OwlSound } from '../owl/actor.ts';
import { setFurQuality } from '../owl/fur.ts'; // [owl4]
import { featherColour, type OwlLook } from '../owl/model.ts';
import { Critters } from './critters.ts';
import { Fireflies } from './fireflies.ts';
import { buildFlora, planForest, type Flora, type ForestPlan } from './flora.ts';
import { Fx, SPR } from './fx.ts';
import { GRASS, makeGrass, FG, type GrassItem } from './grass.ts';
import { buildGardenFence, buildHouse, type House, type Slot, type Zone } from './house.ts';
import { CUT, HOUSE_LOOK, syncLooks } from './house/kit.ts';
import { FACE, FLOOR_IDS, FLOOR_Y, OPEN_A, R_IN, RO, SLAB, type FloorId } from './house/plan.ts';
import { GARDEN, groundY, HOUSE, MEADOW, walkable } from './layout.ts';
import { Rooms } from './rooms.ts';
import type { Save } from '../game/store.ts';
import { hourFor, Sky, type SkyMode } from './sky.ts';
import { buildTerrain, type Terrain } from './terrain.ts';
import { Weather } from './weather.ts'; // [world]
import { Post, type Look } from './post.ts'; // [world3]
import { Vista } from './vista.ts'; // [look4]

export type View = 'home' | 'interior' | 'loft' | 'attic' | 'owl' | 'breathe' | 'sleep' | 'garden' | 'deck' | 'wake';
export type Quality = 'low' | 'high';
/** [look4] Cost tier the scene runs at (see Scene.setTier). */
export type Tier = 'high' | 'medium' | 'low';

const RANK: Record<Tier, number> = { low: 0, medium: 1, high: 2 };
/** [look4] The tier a device starts on: phones, low-memory and few-core machines start on medium, the rest high. */
export function deviceTier(): Tier {
  if (typeof navigator === 'undefined') return 'high';
  const nav = navigator as Navigator & { deviceMemory?: number };
  const ua = nav.userAgent || '';
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const small = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 820;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (touch && small);
  if (mobile || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4) return 'medium';
  return 'high';
}

export type SceneEvent =
  | { type: 'tapOwl' }
  | { type: 'tapSlot'; id: string }
  | { type: 'tapBox'; id: string; x: number; y: number }
  | { type: 'tapItem'; uid: string; fid: FloorId; x: number; y: number }
  | { type: 'tapLock'; floor: FloorId }
  | { type: 'tapGround'; x: number; z: number }
  | { type: 'sound'; id: string }
  | { type: 'catch'; x: number; y: number }
  | { type: 'pet'; x: number; y: number }
  /** [look5] the home view went outside (the whole oak) or back into the living room */
  | { type: 'outside'; on: boolean };

export { ALL_ITEMS, ITEMS };

interface Cam { yaw: number; pitch: number; dist: number; target: THREE.Vector3 }

/**
 * A self-contained set the renderer can show instead of the forest (the interview room, the Snow
 * Barnaby's lodge store...). The world keeps its state but stops updating while a stage is up.
 */
export interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  update(dt: number, t: number): void;
  resize?(w: number, h: number): void;
  /** pointer input in CSS px with a ray through the stage camera; return true when handled */
  pointer?(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray, e: PointerEvent): boolean;
  dispose?(): void;
  /**
   * [look4] Post-processing knobs for this stage (read every frame; any subset, the rest come from STAGE_LOOK in
   * post.ts): exposure, contrast, saturation, vibrance, warm, split, vignette, grain, bloom, bloomThreshold,
   * focus (world units from the camera; 0 = auto-focus on whatever is at focusAt), focusRange, blur (0 = no depth
   * of field .. 1 strong), focusAt ([u, v], default the centre), cold.
   */
  look?: Look;
}
/** A camera shot for directors (cinematics, build mode). */
export interface CamShot { yaw: number; pitch: number; dist: number; target: THREE.Vector3; fov?: number; snap?: boolean }
export type PointerHook = (type: 'down' | 'move' | 'up' | 'wheel', x: number, y: number, ray: THREE.Ray, e: PointerEvent | WheelEvent) => boolean;

interface Trip { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; mode: 'hop' | 'fly' | 'leave' | 'arrive'; done?: () => void; arc: number }

export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.3, 900);
  readonly sky: Sky;
  readonly plan: ForestPlan;
  readonly terrain: Terrain;
  readonly flora: Flora;
  readonly fx: Fx;
  readonly critters: Critters;
  readonly house: House;
  readonly owl: OwlActor;
  readonly fireflies: Fireflies;
  /** [world] real-world weather and seasons (see weather.ts) */
  readonly weather: Weather;
  readonly quality: Quality;
  /** [look4] "Golden Diorama" post chain: modest internal resolution, bloom, tilt-shift depth of field, ACES and a
   * warm grade (post.enabled = false to bypass; post.grade holds the world's live knobs, Stage.look a stage's) */
  readonly post: Post;
  /** [look4] the world beyond the clearing: forest to the horizon, hills and mountains in the haze */
  readonly vista: Vista;
  private pmrem: THREE.PMREMGenerator;
  private grass: THREE.Group;
  private envScene = new THREE.Scene();
  private envRT: THREE.WebGLRenderTarget | null = null;
  private envT = 0;
  view: View = 'home';
  skyMode: SkyMode | 'dawn' = 'clock';
  paused = false;
  time = 0;
  /** fraction of the screen covered by a bottom sheet; the view shifts up to compensate */
  shift = 0;
  /** @deprecated the slot decorator is gone; build mode (src/build) edits rooms directly */
  decorating = false;
  /** where the owl is supposed to be */
  owlPlace: 'porch' | 'bed' | 'inside' | 'away' | 'log' | 'loft' | 'roam' | 'launch' | 'balcony' | 'seat' = 'porch';
  private roamAt = new THREE.Vector3();
  private seatAt = new THREE.Vector3();
  /** furniture, wallpaper and moving boxes inside the oak */
  readonly rooms: Rooms;

  private cam: Cam = { yaw: 0, pitch: 0.3, dist: 19, target: new THREE.Vector3(0, 2.6, -2.2) };
  private cur: Cam = { yaw: 0, pitch: 0.3, dist: 19, target: new THREE.Vector3(0, 2.6, -2.2) };
  private userYaw = 0;
  private userZoom = 1;
  private shiftCur = 0;
  private listeners: ((e: SceneEvent) => void)[] = [];
  private raf = 0;
  private last = 0;
  private skyT = 0;
  private ray = new THREE.Raycaster();
  private trip: Trip | null = null;
  private room: THREE.PointLight;
  private lantern: THREE.PointLight;
  /** [look4] a warm porch lamp glow at night (the porch is where Pip leaves from and lands) */
  private porchGlow: THREE.PointLight;
  private gardenFence: THREE.Mesh;
  private weeds: THREE.Group;
  private smokeT = 0;
  private hourOverride: number | null = null;
  /** breathing: a warm glow at the owl's chest and a gentle camera dolly */
  private glow: THREE.PointLight;
  private breathZoom = 1;
  /** a stage shown instead of the world (see Stage) */
  stage: Stage | null = null;
  /** takes over the camera while set (cinematics, build mode); return null to fall back to the view */
  director: ((dt: number, t: number) => CamShot | null) | null = null;
  /** sees world pointer input first (build mode); return true to swallow it */
  interceptor: PointerHook | null = null;
  /** called every world frame after the built-in updates (weather, house animations...) */
  readonly tickers = new Set<(dt: number, t: number) => void>();
  private baseFov = 32;
  /**
   * [look5] The home view normally looks into Pip's living room (a warm, close view through the open front of the
   * oak); `outside` pulls the camera back out through the opening to the whole tree. Toggle with setOutside() (the
   * HUD's window button), a pinch or the mouse wheel. `outK` is the eased dolly between the two (0 inside, 1 out).
   */
  outside = false;
  private outT = 0;
  private outK = 0;
  /** where the inside camera thinks Pip is (house-local x/z, eased so the view follows him calmly) */
  private pipL = new THREE.Vector2(0, -0.6);
  /** wheel / pinch accumulators and a short lock after a switch so one gesture never flips twice */
  private zoomAcc = 0;
  private zoomLock = 0;
  /** a warm lamp-and-window light rig for the living room, on while the camera is inside */
  private insideLights: { key: THREE.PointLight; win: THREE.SpotLight; beam: THREE.Mesh; bounce: THREE.PointLight } | null = null;
  private porchWait = 0;

  /** [look4] the running cost tier, and whether it adapts to the frame rate ('auto') */
  tier: Tier;
  readonly autoTier: boolean;
  /** the highest tier auto mode may climb back to (the device's starting tier) */
  private maxTier: Tier = 'high';
  private perf = { ema: 16.7, slow: 0, fast: 0, warm: 4, lastDown: -1e9, lastUp: -1e9, locked: false, frame: 0 };
  private casterT = 0;
  constructor(canvas: HTMLCanvasElement, look: OwlLook, quality: Quality | 'medium' | 'auto') {
    // [look4] 'auto' picks a tier for the device and lets it adapt; the build-time detail follows the starting tier
    this.autoTier = quality === 'auto';
    this.tier = quality === 'auto' ? deviceTier() : quality;
    this.maxTier = this.tier;
    quality = this.tier === 'high' ? 'high' : 'low';
    this.quality = quality;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false }));
    r.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.25));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.post = new Post(r, this.tier); // [world3]
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NoToneMapping; // [look4] the post chain tone-maps (ACES) after bloom and depth of field
    this.pmrem = new THREE.PMREMGenerator(r);

    this.plan = planForest(this.tier);
    this.sky = new Sky(this.scene, quality === 'high' ? 2048 : 1024, quality); // [world]
    this.terrain = buildTerrain(this.plan.shade);
    this.flora = buildFlora(this.plan, quality); // [world]
    this.fx = new Fx(quality === 'high' ? 1800 : 900);
    this.critters = new Critters(this.plan, this.fx, quality, (id) => this.emit({ type: 'sound', id }));
    this.house = buildHouse();
    this.rooms = new Rooms(this.house);
    const grass = makeGrass(this.plan.grass, quality === 'high' ? 16 : 24);
    this.grass = grass;
    this.vista = new Vista(this.plan, quality); // [look4]
    this.vista.bake(r);
    this.scene.add(this.terrain.group, this.flora.group, grass, this.house.group, this.critters.group, this.fx.group, this.vista.group);
    // [look4] the environment light (reflections on wood, brass, glass, water) is baked from the live sky dome
    this.envScene.add(new THREE.Mesh(this.sky.dome.geometry, this.sky.dome.material));

    // garden: a tidy fenced plot once unlocked, a tangle of weeds before that
    this.gardenFence = buildGardenFence(GARDEN.x, GARDEN.z, GARDEN.hw, GARDEN.hd);
    this.scene.add(this.gardenFence);
    const weedItems: GrassItem[] = [];
    for (let i = 0; i < 240; i++) {
      const x = GARDEN.x + (Math.random() * 2 - 1) * GARDEN.hw, z = GARDEN.z + (Math.random() * 2 - 1) * GARDEN.hd;
      weedItems.push({ x, y: groundY(x, z), z, rot: Math.random() * 3, size: 0.8 + Math.random() * 0.6, cell: [FG.tall, FG.dry, FG.bracken, FG.woodrush, FG.seed][i % 5], tint: 0.95 });
    }
    this.weeds = makeGrass(weedItems);
    this.scene.add(this.weeds);

    // lights inside the hollow: a soft fill so the living room reads by day, the lantern at night
    this.room = new THREE.PointLight(0xffd7a0, 0, 11, 1.5);
    this.room.position.set(HOUSE.x, 2.6, HOUSE.z + 1.6);
    this.lantern = new THREE.PointLight(0xffc06a, 0, 10, 1.4);
    this.lantern.position.copy(this.house.lampAt);
    this.porchGlow = new THREE.PointLight(0xffb866, 0, 7, 1.6);
    this.porchGlow.position.copy(this.house.spots.porch).add(new THREE.Vector3(0.6, 1.9, 1.1));
    this.scene.add(this.room, this.lantern, this.porchGlow);

    this.glow = new THREE.PointLight(0xffd59a, 0, 5, 1.4);
    this.scene.add(this.glow);
    this.fireflies = new Fireflies(quality === 'high' ? 90 : 50, new THREE.Vector3(0, 0, 0), 11);
    this.scene.add(this.fireflies.mesh);

    this.owl = new OwlActor(look, {
      fx: (k, at, n) => this.owlFx(k, at, n),
      sound: (id) => this.emit({ type: 'sound', id: 'owl_' + id }),
    });
    this.scene.add(this.owl.node);
    this.placeOwl('inside'); // [house] Pip hangs out in the living room by day

    this.weather = new Weather(this); // [world] after the owl, house and flora exist
    this.resize();
    this.applySky();
    this.input(canvas);
    this.applyTier();
  }

  on(f: (e: SceneEvent) => void) { this.listeners.push(f); return () => { this.listeners = this.listeners.filter((x) => x !== f); }; }
  private emit(e: SceneEvent) { for (const f of this.listeners) f(e); }

  private owlFx(k: OwlFx, at: THREE.Vector3, n = 3) {
    const fx = this.fx;
    if (k === 'heart') fx.burst('hearts', at.x, at.y, at.z, n);
    else if (k === 'note') fx.burst('notes', at.x, at.y, at.z, n);
    else if (k === 'zzz') fx.burst('zzz', at.x + 0.2, at.y, at.z, Math.max(2, n));
    else if (k === 'sparkle') fx.burst('sparkle', at.x, at.y, at.z, n);
    else if (k === 'dust') fx.burst('dust', at.x, at.y, at.z, n);
    else if (k === 'feather') {
      const col = featherColour(this.owl.model.look.palette);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        fx.emit({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * 0.9, vy: 0.6 + Math.random() * 0.8, vz: Math.sin(a) * 0.9, life: 1.6 + Math.random(), frame: SPR.feather1, frames: 3, fps: 3, color: col, size: 0.22, gravity: 1.1, drag: 2.2, flutter: 0.6, land: true });
      }
    }
  }

  // ---------------------------------------------------------------- owl placement & travel

  spot(p: Scene['owlPlace']): THREE.Vector3 {
    const s = this.house.spots;
    if (p === 'porch') return s.porch.clone();
    if (p === 'bed') return s.bed.clone();
    if (p === 'inside') return s.inside.clone();
    if (p === 'loft') return s.loft.clone();
    if (p === 'launch') return s.launch.clone();
    if (p === 'balcony') return s.balcony.clone();
    if (p === 'seat') return this.seatAt.clone();
    if (p === 'log') return new THREE.Vector3(MEADOW.x, 0.66, 2.6);
    if (p === 'roam') return this.roamAt.clone();
    return new THREE.Vector3(0, 12, -34);
  }
  /** Perch Pip on a seat (a world point from rooms.seats()). */
  sitAt(at: THREE.Vector3, done?: () => void) { this.seatAt.copy(at); this.moveOwl('seat', done); }

  placeOwl(p: Scene['owlPlace']) {
    this.trip = null;
    this.owlPlace = p;
    const at = this.spot(p);
    this.owl.node.position.copy(at);
    this.owl.node.rotation.y = 0;
    this.owl.node.visible = p !== 'away';
    this.owl.pose = p === 'bed' ? 'sleep' : 'stand';
  }

  /** Hop or fly to another spot. */
  moveOwl(p: Scene['owlPlace'], done?: () => void) {
    // [look5] while we look into the living room, Pip stays in it (the porch is out of sight round the trunk)
    if (p === 'porch' && this.view === 'home' && !this.outside && !this.director) p = 'inside';
    if (p === this.owlPlace && p !== 'roam' && !this.trip) { done?.(); return; }
    const from = this.owl.node.position.clone(), to = this.spot(p);
    const d = from.distanceTo(to);
    const fly = d > 2.4 || Math.abs(to.y - from.y) > 0.6;
    this.owlPlace = p;
    this.owl.node.visible = true;
    this.owl.pose = fly ? 'fly' : 'stand';
    if (fly) this.emit({ type: 'sound', id: 'owl_flap' });
    this.trip = { from, to, t: 0, dur: fly ? Math.max(1.1, d * 0.28) : d * 0.55 + 0.3, mode: fly ? 'fly' : 'hop', done, arc: fly ? Math.max(1.2, d * 0.25) : 0 };
  }

  /** Hop to a spot on the meadow the player tapped. Returns false if Pip can't go there. */
  hopTo(x: number, z: number): boolean {
    if (this.trip || this.owl.pose !== 'stand') return false;
    // [house] inside the living room Pip can wander the floor too
    const inRoom = Math.hypot(x - HOUSE.x, z - HOUSE.z) < R_IN * PX - 0.6;
    if (!inRoom && !walkable(x, z)) return false;
    this.roamAt.set(x, inRoom ? FLOOR_Y.f1 * PX : groundY(x, z), z);
    this.owlPlace = 'roam' as never;
    this.moveOwl('roam');
    return true;
  }

  /** Fly off into the night for an adventure. */
  leave(done?: () => void) {
    const from = this.owl.node.position.clone();
    this.owl.pose = 'fly';
    this.emit({ type: 'sound', id: 'owl_flap' });
    this.owl.setMood('excited', 1.4);
    this.trip = { from, to: new THREE.Vector3(from.x - 6, from.y + 14, from.z - 26), t: 0, dur: 3.4, mode: 'leave', done: () => { this.owl.node.visible = false; this.owlPlace = 'away'; done?.(); }, arc: 3 };
  }

  /** Come home from an adventure and land on the porch. */
  arrive(done?: () => void) {
    const to = this.spot('porch');
    this.owl.node.visible = true;
    this.owl.pose = 'fly';
    this.owl.node.position.set(to.x + 8, to.y + 12, to.z - 20);
    this.emit({ type: 'sound', id: 'owl_flap' });
    this.trip = { from: this.owl.node.position.clone(), to, t: 0, dur: 3.2, mode: 'arrive', done: () => { this.owlPlace = 'porch'; done?.(); }, arc: 2.5 };
  }

  private stepTrip(dt: number) {
    const tr = this.trip;
    if (!tr) return;
    tr.t += dt;
    const k = Math.min(1, tr.t / tr.dur);
    const n = this.owl.node;
    if (tr.mode === 'hop') {
      // a string of little hops
      const hops = Math.max(1, Math.round(tr.from.distanceTo(tr.to) / 0.55));
      const e = k;
      n.position.lerpVectors(tr.from, tr.to, e);
      n.position.y += Math.abs(Math.sin(e * Math.PI * hops)) * 0.22;
      const dx = tr.to.x - tr.from.x, dz = tr.to.z - tr.from.z;
      n.rotation.y = Math.atan2(dx, dz);
      if (Math.floor(e * hops * 2) !== Math.floor((tr.t - dt) / tr.dur * hops * 2) && Math.random() < 0.5) this.emit({ type: 'sound', id: 'step' });
    } else {
      const e = tr.mode === 'leave' ? k * k : tr.mode === 'arrive' ? 1 - (1 - k) * (1 - k) : THREE.MathUtils.smootherstep(k, 0, 1);
      n.position.lerpVectors(tr.from, tr.to, e);
      n.position.y += Math.sin(e * Math.PI) * tr.arc;
      const dx = tr.to.x - tr.from.x, dz = tr.to.z - tr.from.z;
      n.rotation.y = Math.atan2(dx, dz);
      if (tr.mode === 'leave' && k > 0.85) n.scale.setScalar(1 - (k - 0.85) * 6);
      else n.scale.setScalar(1);
    }
    if (k >= 1) {
      const done = tr.done;
      this.trip = null;
      n.position.copy(tr.to);
      n.scale.setScalar(1);
      n.rotation.y = this.owlPlace === 'log' ? 0 : 0;
      if (tr.mode !== 'leave') {
        this.owl.pose = this.owlPlace === 'bed' ? 'sleep' : 'stand';
        this.owl.play('hop');
        this.fx.burst('dust', n.position.x, n.position.y, n.position.z, 5);
      }
      done?.();
    }
  }

  // ---------------------------------------------------------------- the house: rooms, boxes, floors

  /** Make the rooms, boxes and boarded-up floors match the save (call whenever save.home changes). */
  setHome(home: Save['home'], animateUnlock = false) {
    for (const f of FLOOR_IDS) {
      const want = home.unlocked.includes(f);
      if (want !== this.house.isOpen(f)) this.house.setFloorOpen(f, want, animateUnlock && want);
    }
    this.rooms.sync(home);
    this.refreshSpots();
  }
  /** Pip's bed and hangout spots follow the furniture. */
  refreshSpots() {
    const bed = this.rooms.bedSpot();
    const s = this.house.spots;
    if (bed) s.bed.copy(bed.at); else s.bed.copy(this.rooms.freeSpot('f1', -6, -40));
    s.inside.copy(this.rooms.freeSpot('f1', -4, 2)); // [look5] the middle of the living room, on the rug, where the inside view looks
    s.loft.copy(this.house.isOpen('f2') ? this.rooms.freeSpot('f2', -8, 28) : s.inside);
    if (this.owlPlace === 'bed' && !this.trip) this.owl.node.position.copy(s.bed);
  }
  /** World y of a floor's walking surface. */
  floorY(fid: FloorId) { return FLOOR_Y[fid] * PX; }

  /** @deprecated rooms come from save.home now (see setHome); kept so older callers compile. */
  setFurniture(_map: Record<string, string>) { /* superseded by setHome */ }
  /** Spawn a sparkle burst somewhere in the house (world point), e.g. after placing something. */
  celebrate(at: THREE.Vector3 | string) {
    if (typeof at === 'string') return;
    this.fx.burst('sparkle', at.x, at.y + 0.5, at.z, 12); this.fx.burst('stars', at.x, at.y + 0.3, at.z, 6);
  }

  setZones(z: Partial<Record<Zone, boolean>>) {
    for (const [k, v] of Object.entries(z) as [Zone, boolean][]) {
      this.house.setZone(k, v);
      if (k === 'garden') { this.gardenFence.visible = v; this.weeds.visible = !v; }
    }
  }

  /** @deprecated the slot decorator is gone (build mode lives in src/build). */
  setDecorating(on: boolean, _zone: Slot['zone'] | 'all' = 'all') { this.decorating = on; }

  setLook(look: OwlLook) { this.owl.rebuild(look); }

  /** Show a stage instead of the forest (null returns to the world). */
  setStage(st: Stage | null) {
    if (this.stage === st) return;
    this.stage?.dispose?.();
    this.stage = st;
    if (st) st.resize?.(innerWidth, innerHeight);
  }
  /** Normalised device coords -> ray through the given camera. */
  rayAt(cx: number, cy: number, cam: THREE.Camera = this.camera): THREE.Ray {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), cam);
    return this.ray.ray.clone();
  }

  /** Drive the scene from the breathing exercise (null ends it). */
  breathFx(lung: number | null, kind: 'in' | 'out' | 'hold' | 'rest' = 'rest') {
    const chest = this.owl.node.position.clone().add(new THREE.Vector3(0, 0.75, 0.35));
    if (lung === null) {
      this.glow.intensity = 0; this.fireflies.gather = null; this.fireflies.pull = 0; this.fireflies.release = 0; this.breathZoom = 1;
      this.fireflies.rehome(new THREE.Vector3(0, 0, 0), 11, [0.4, 3.2]);
      if (this.owl.pose === 'breathe') this.owl.pose = 'stand';
      return;
    }
    if (this.owl.pose !== 'breathe') {
      this.owl.pose = 'breathe';
      this.fireflies.rehome(chest, 3.6, [0.4, 2.8]);
    }
    this.owl.breath = lung;
    this.glow.position.copy(chest).add(new THREE.Vector3(0, 0.2, 0.6));
    this.glow.intensity = 1.2 + lung * 4;
    this.fireflies.gather = chest;
    this.fireflies.pull = kind === 'in' ? 0.55 + lung * 0.6 : kind === 'hold' ? 0.4 : 0;
    this.fireflies.release = kind === 'out' ? 0.7 : 0;
    this.breathZoom = 1 - lung * 0.07;
  }
  chestScreen() { return this.screenOf(this.owl.node.position.clone().add(new THREE.Vector3(0, 0.72, 0.3))); }

  // ---------------------------------------------------------------- views & sky

  setView(v: View) {
    this.view = v;
    this.userYaw = 0; this.userZoom = 1;
    if (v === 'breathe' || v === 'sleep') this.skyMode = 'night';
    else if (v === 'wake') this.skyMode = 'dawn';
    else this.skyMode = 'clock';
    this.applySky();
  }

  /** Force a time of day (e.g. for previews); null returns to the clock. */
  setHour(h: number | null) { this.hourOverride = h; this.applySky(); }

  applySky() {
    const h = this.hourOverride ?? (this.skyMode === 'dawn' ? 6.5 : hourFor(this.skyMode as SkyMode));
    this.sky.setHour(h);
    const night = this.sky.night, L = THREE.MathUtils.lerp, sm = THREE.MathUtils.smoothstep;
    // [look4] the pond mirrors the real sky: blue by day, gold at the ends of the day, sapphire at night
    (this.terrain.water.uniforms.uLight.value as THREE.Color).copy(this.sky.ambient).multiplyScalar(1.25);
    (this.terrain.water.uniforms.uDeep.value as THREE.Color).copy(this.sky.hemi.color).lerp(new THREE.Color(0x0e3a4a), 0.7).multiplyScalar(night > 0.5 ? 0.5 : 0.9);
    (this.terrain.water.uniforms.uSky.value as THREE.Color).copy(this.sky.horizon).lerp(this.sky.hemi.color, 0.4);
    this.fx.setLight(this.sky.ambient);
    this.flora.setNight(sm(night, 0.35, 0.9)); // [world3] moonglow caps
    this.vista.setSky(this.sky);
    // [look4] the grade follows the light: bright warm days, honey-gold evenings, sapphire moonlit nights
    {
      const g = this.post.grade, hr = this.sky.hour;
      const golden = Math.max(sm(hr, 16.6, 18.2) * (1 - sm(hr, 19.0, 19.8)), sm(hr, 5.6, 6.4) * (1 - sm(hr, 7.4, 8.6)));
      g.exposure = (L(1.0, 1.45, night) + golden * 0.18) * (1 + (this.weather?.vis.overcast ?? 0) * 0.25);
      g.warm = L(0.08, -0.06, night) + golden * 0.08;
      g.saturation = L(1.1, 0.9, night);
      g.vibrance = L(0.22, 0.1, night);
      g.contrast = L(1.06, 1.1, night);
      g.split = L(0.5, 0.75, night);
      g.bloom = L(0.5, 0.95, night) + golden * 0.15;
      g.bloomThreshold = L(1.05, 0.7, night);
      g.vignette = L(0.2, 0.32, night);
      g.lift.set(0, 0.004, 0.016).multiplyScalar(1 + night);
      g.cold = (this.weather?.vis.cold ?? 0) * 0.6;
      this.gradeBase = { exposure: g.exposure, bloom: g.bloom, bloomThreshold: g.bloomThreshold, vignette: g.vignette, vibrance: g.vibrance, saturation: g.saturation, warm: g.warm }; // [look5]
    }
    GRASS.uKey.value.copy(this.sky.sun.color).multiplyScalar(this.sky.sun.intensity * 0.42);
    GRASS.uSky.value.copy(this.sky.hemi.color).multiplyScalar(this.sky.hemi.intensity * 0.85);
    GRASS.uGround.value.copy(this.sky.hemi.groundColor).multiplyScalar(this.sky.hemi.intensity);
    GRASS.uSunDir.value.copy(this.sky.sunDir);
    GRASS.uDapple.value = night > 0.5 ? 0.25 : 1;
    // [look4] lamp-gold windows bloom at night; by day the glass holds a little of the sky
    if (night > 0.4) this.house.panes.color.setRGB(3.4, 2.0, 0.8).multiplyScalar(L(0.6, 1, sm(night, 0.4, 0.9)));
    else this.house.panes.color.copy(this.sky.hemi.color).multiplyScalar(0.42).lerp(new THREE.Color(0x2a3a4a), 0.4);
    this.paneBase.copy(this.house.panes.color); // [look5]
    this.room.intensity = 1.4 + night * 9; // the open rooms glow warm at night
    this.room.distance = 16;
    this.lantern.intensity = night * 8;
    this.porchGlow.intensity = THREE.MathUtils.smoothstep(night, 0.3, 0.8) * 5;
    this.fireflies.alpha = night > 0.4 && (this.weather?.firefliesOk ?? true) ? 1 : 0; // [world] not in winter or rain
    this.scene.environmentIntensity = L(0.4, 0.3, night);
    // furniture lights follow the sky every frame in rooms.update
  }

  /** [look4] Re-bake the environment light from the live sky dome (cheap; only when the sky has changed). */
  private bakeEnv() {
    if (!this.sky.envDirty) return;
    this.sky.envDirty = false;
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 400);
    this.envRT?.dispose();
    this.envRT = rt;
    this.scene.environment = rt.texture;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const hf = (30 * Math.PI) / 180;
    this.camera.fov = this.baseFov = Math.min(56, Math.max(30, (2 * Math.atan(Math.tan(hf / 2) / Math.min(1, this.camera.aspect)) * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
    this.post?.resize(w, h); // [world3]
    this.stage?.resize?.(w, h);
  }

  /**
   * [look4] Set the cost tier: high (full detail), medium (impostor woods, 3 bloom levels, shadows every other frame
   * from the bigger casters only, 1024 shadow map, no light shafts), low (as medium plus a coarser internal grid, a
   * quarter-res depth of field, shadows every third frame, a thinner meadow and far wood). Cheap: nothing is rebuilt.
   */
  setTier(t: Tier) {
    if (t === this.tier) return;
    this.tier = t;
    this.applyTier();
  }
  private applyTier() {
    const t = this.tier;
    this.post.setTier(t);
    setFurQuality(t); // [owl4] the owl's fluff: 8 shells on high, 5 on medium, 3 on low
    this.vista.setTier(t);
    this.sky.shafts = t === 'high';
    this.house.setTier(t); // [house4] the oak drops its foot rocks and extra lamps on low
    const size = t === 'high' ? 2048 : 1024, sh = this.sky.sun.shadow;
    if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); sh.map?.dispose(); sh.map = null; }
    // the meadow thins out on low
    for (const c of this.grass.children) {
      const g = (c as THREE.Mesh).geometry as THREE.InstancedBufferGeometry;
      g.userData.full ??= g.instanceCount;
      g.instanceCount = t === 'low' ? Math.floor((g.userData.full as number) * 0.6) : (g.userData.full as number);
    }
    this.casterT = 0;
  }
  /** [look4] Shadow casters: everything on high; on medium and low only the big things (and Pip) cast. */
  private cullCasters() {
    vivid(this.owl.node, 0.24); // [look5] a little more colour in Pip's painted feathers (once per material, as they load)
    const small = this.tier === 'high' ? 0 : this.tier === 'medium' ? 0.55 : 1.1;
    const sp = new THREE.Sphere();
    const owl = this.owl.node;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.userData.cast0 === undefined) { if (!m.castShadow) return; m.userData.cast0 = true; }
      if (!small) { m.castShadow = true; return; }
      let inOwl = false;
      for (let p: THREE.Object3D | null = m; p; p = p.parent) if (p === owl) { inOwl = true; break; }
      if (inOwl) { m.castShadow = true; return; }
      // the woods' crowns cast only on high; shrubs, rocks and logs keep their shadows
      if ((m as unknown as THREE.InstancedMesh).isInstancedMesh) { m.castShadow = !/:(bark|leaves)$/.test(m.name); return; }
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      sp.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld);
      m.castShadow = sp.radius >= small;
    });
  }
  /**
   * [look4] Auto tier: if frames stay slower than ~22 ms for 3 s, step down a tier; after 25 s of smooth frames below
   * the device's starting tier, try one step back up (if it has to come down again within 45 s, it stays down).
   */
  private lastMs = 0;
  private watchFrames(ms: number) {
    const P = this.perf, raw = this.lastMs ? ms - this.lastMs : 16.7;
    this.lastMs = ms;
    if (!this.autoTier || document.hidden || raw > 250) return;
    if (P.warm > 0) { P.warm -= raw / 1000; return; }
    P.ema += (raw - P.ema) * 0.08;
    const now = ms / 1000;
    if (P.ema > 22) { P.slow += raw / 1000; P.fast = 0; } else { P.slow = Math.max(0, P.slow - raw / 2000); P.fast = P.ema < 18.5 ? P.fast + raw / 1000 : 0; }
    if (P.slow > 3 && this.tier !== 'low') {
      // stepping down again soon after a step up: this device can't hold the higher tier, stay down from now on
      if (now - P.lastUp < 45) P.locked = true;
      this.setTier(this.tier === 'high' ? 'medium' : 'low');
      P.slow = 0; P.fast = 0; P.lastDown = now; P.warm = 2; P.ema = 16.7;
    } else if (!P.locked && P.fast > 25 && RANK[this.tier] < RANK[this.maxTier]) {
      this.setTier(this.tier === 'low' ? 'medium' : 'high');
      P.fast = 0; P.warm = 2; P.ema = 16.7; P.lastUp = now;
    }
  }

  start() {
    const loop = (ms: number) => {
      this.raf = requestAnimationFrame(loop);
      const t = ms / 1000, dt = Math.min(0.05, this.last ? t - this.last : 0.016);
      this.last = t;
      if (!this.paused) { this.step(dt); this.watchFrames(ms); }
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { cancelAnimationFrame(this.raf); }

  private goal(): Cam {
    const o = this.owl.node.position, H = new THREE.Vector3(HOUSE.x, 0, HOUSE.z);
    const portrait = this.camera.aspect < 1;
    const L = this.house.spots.launch;
    switch (this.view) {
      // [house] framing for the grand oak: three floors, a canopy above and a launch platform on the limb
      // [house3] one open floor of the dollhouse filling the frame
      case 'interior': return { yaw: 0.08, pitch: 0.17, dist: this.fitDist(portrait ? 8.6 : 11, 6.4), target: new THREE.Vector3(H.x + 0.1, 2.2, H.z + 1.2) };
      case 'loft': return { yaw: 0.06, pitch: 0.16, dist: this.fitDist(portrait ? 8.6 : 11, 6.4), target: new THREE.Vector3(H.x + 0.1, 6.7, H.z + 1.2) }; // [house3]
      case 'attic': return { yaw: 0.06, pitch: 0.14, dist: this.fitDist(portrait ? 8.6 : 11, 6.4), target: new THREE.Vector3(H.x + 0.1, 11.2, H.z + 1.2) }; // [house3]
      case 'owl': return { yaw: -0.15, pitch: 0.12, dist: portrait ? 7.4 : 4.6, target: new THREE.Vector3(o.x, o.y + 0.85, o.z) };
      case 'breathe': return { yaw: 0, pitch: 0.1, dist: portrait ? 9.2 : 5.6, target: new THREE.Vector3(MEADOW.x, portrait ? 1.35 : 1.45, 2.6) };
      // [house3] the whole oak under the night sky
      case 'sleep': return { yaw: 0.1, pitch: 0.2, dist: this.fitDist(24, 34) * 1.05, target: new THREE.Vector3(0.2, 12.4, H.z + 1) };
      case 'wake': return { yaw: -0.08, pitch: 0.18, dist: portrait ? 24 : 20, target: new THREE.Vector3(1.5, 3.6, H.z + 3) };
      case 'garden': return { yaw: -0.25, pitch: 0.55, dist: portrait ? 15 : 12, target: new THREE.Vector3(GARDEN.x, 0.4, GARDEN.z) };
      case 'deck': return { yaw: 0.55, pitch: 0.16, dist: portrait ? 16 : 12, target: new THREE.Vector3(L.x - 1.5, L.y - 0.6, L.z + 1) };
      default: {
        // [house3] the whole oak in frame, crown to roots, porch and limb, with the forest round it; the HUD
        // signs sit over the sky at the top and the big buttons over the meadow at the bottom
        // the open rooms sit about a third of the way up, clear of the big buttons; the crown fills the sky above
        const d = this.fitDist(portrait ? 23 : 28, portrait ? 42 : 42) * this.userZoom;
        const out: Cam = { yaw: 0.1, pitch: portrait ? 0.13 : 0.09, dist: d, target: new THREE.Vector3(0.35, portrait ? 8.4 : 10.8, H.z + 0.6) }; // [look4] wide screens look across the valley: headroom over the crown, the far hills and the clouds
        // [look5] normally the camera is inside the living room; the dolly runs in a straight line out through the open
        // front (camera positions blend, not angles, so it never swings through the bark)
        const e = this.outK;
        if (e >= 0.999) return out;
        const ins = this.insideShot();
        if (e <= 0.001) return ins;
        const pos = (c: Cam) => new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch)).multiplyScalar(c.dist).add(c.target);
        const p = pos(ins).lerp(pos(out), e), tg = ins.target.clone().lerp(out.target, e), dv = p.clone().sub(tg), dist = dv.length();
        return { yaw: Math.atan2(dv.x, dv.z), pitch: Math.asin(THREE.MathUtils.clamp(dv.y / dist, -1, 1)), dist, target: tg };
      }
    }
  }

  /** [look5] Look at the whole oak (true) or into Pip's living room (false, the usual home view). */
  setOutside(on: boolean) {
    if (on === this.outside) return;
    this.outside = on;
    this.zoomAcc = 0;
    this.zoomLock = 0.7;
    if (!on) this.userZoom = 1;
    this.userYaw = 0;
    this.emit({ type: 'outside', on });
  }
  /** [look5] Is the home camera (mostly) inside the living room right now? */
  get inside() { return this.view === 'home' && this.outK < 0.5 && !this.director; }

  /**
   * [look5] The living room, close: the camera stands in the open front of the oak at Pip's eye level and looks across
   * the room at him, with the back wall, its windows and the furniture round him filling the frame. It follows Pip
   * calmly as he potters about, never far enough to the side to see the cut edges of the trunk.
   */
  private insideShot(): Cam {
    const M = THREE.MathUtils, a = this.camera.aspect;
    const w = M.smoothstep(a, 0.6, 1.3); // 0 tall phone .. 1 wide screen
    const fy = FLOOR_Y.f1 * PX, P = this.pipL;
    const fx = M.clamp(P.x, -2.6, 2.6), fz = M.clamp(P.y, -3.2, 2.4);
    // the camera stands in the open front at about Pip's eye level, backing off a little when he comes forward
    const camZ = M.clamp(fz + M.lerp(6.0, 7.4, w), M.lerp(6.4, 7.2, w), M.lerp(7.6, 8.6, w));
    const camX = fx * 0.3, camY = fy + M.lerp(2.7, 2.6, w);
    const C = new THREE.Vector3(HOUSE.x + camX, camY, HOUSE.z + camZ);
    const A = new THREE.Vector3(HOUSE.x + fx, fy + 1.0, HOUSE.z + fz);
    // compose: on a phone Pip stands in the middle of the clear band between the signs and the bedtime card; on a
    // wide screen a little right of centre, clear of the big buttons, with the room opening out to his left
    const tanV = Math.tan((this.insideFov() * Math.PI) / 360), tanH = tanV * a, halfH = Math.atan(tanH), halfV = Math.atan(tanV);
    const d = A.clone().sub(C);
    let yaw = Math.atan2(d.x, -d.z) - Math.atan(M.lerp(0, 0.3, w) * tanH);
    let pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) - Math.atan(M.lerp(0.05, 0.1, w) * tanV);
    // never let the frame reach the cut edges of the trunk (left and right) or the lintel over the opening
    const lip = (s: number) => Math.atan2(s * Math.sin(OPEN_A) * R_IN * PX - camX, camZ - Math.cos(OPEN_A) * R_IN * PX);
    const lo = lip(-1) + halfH + 0.07, hi = lip(1) - halfH - 0.07;
    yaw = lo < hi ? M.clamp(yaw, lo, hi) : (lo + hi) / 2;
    pitch = Math.min(pitch, Math.atan2((FLOOR_Y.f2 - SLAB) * PX - camY, camZ - RO * PX - 0.1) - halfV - 0.04);
    const dist = d.length();
    const T = C.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist));
    const v = C.sub(T);
    return { yaw: Math.atan2(v.x, v.z), pitch: Math.asin(v.y / dist), dist, target: T };
  }
  /** [look5] Per frame: the inside/outside dolly, Pip-following, Pip walking in from the porch, the room's lamp light. */
  private stepInside(dt: number) {
    const home = this.view === 'home' && !this.director;
    // the dolly: ~1.6 s, eased at both ends
    if (this.view === 'home') this.outT += THREE.MathUtils.clamp((this.outside ? 1 : 0) - this.outT, -dt / 1.6, dt / 1.6);
    this.outK = THREE.MathUtils.smootherstep(this.outT, 0, 1);
    this.zoomLock = Math.max(0, this.zoomLock - dt);
    this.zoomAcc *= Math.exp(-dt * 1.5);
    // follow Pip round the living room (a calm lag, and only while he's in it)
    const o = this.owl.node.position, fy = FLOOR_Y.f1 * PX;
    const lx = o.x - HOUSE.x, lz = o.z - HOUSE.z;
    if (this.owl.node.visible && Math.hypot(lx, lz) < R_IN * PX + 0.3 && o.y < fy + 2.2) this.pipL.lerp(new THREE.Vector2(lx, lz), 1 - Math.exp(-dt * 1.2));
    // back from the porch (after the morning landing, or a stroll): Pip hops in through the door when we're inside
    if (home && !this.outside && this.owlPlace === 'porch' && !this.trip && this.owl.pose === 'stand' && this.owl.node.visible) {
      if ((this.porchWait += dt) > 1.4) { this.porchWait = 0; this.walkIn(); }
    } else this.porchWait = 0;
    this.stepRoomLight(dt);
  }
  /**
   * [look5] Cosy light for the living room while the camera is inside: the hanging lantern lit even by day, the sky's
   * flat fill turned down so lamp pools and shadows read, and a sunbeam slanting in through the back window on the
   * sun's side (a pale moonbeam on clear nights) with dust drifting in it.
   */
  private inLight = 0;
  private moteT = 0;
  /** the sky-driven grade and window glass, before the inside view's adjustments */
  private gradeBase = { exposure: 1, bloom: 0.5, bloomThreshold: 1, vignette: 0.2, vibrance: 0.2, saturation: 1.1, warm: 0.08 };
  private paneBase = new THREE.Color();
  private stepRoomLight(dt: number) {
    const want = this.view === 'home' && !this.director && !this.stage ? 1 - this.outK : 0;
    this.inLight += (want - this.inLight) * Math.min(1, dt * 3);
    const k = this.inLight, night = this.sky.night, day = 1 - THREE.MathUtils.smoothstep(night, 0.25, 0.75);
    this.sky.hemi.intensity = this.sky.hemiBase * (1 - k * (0.34 + night * 0.24));
    if (k < 0.005 && !this.insideLights) return;
    if (!this.insideLights) {
      const key = new THREE.PointLight(0xffc27a, 0, 0, 2);
      const bounce = new THREE.PointLight(0xffa860, 0, 6, 1.6);
      const win = new THREE.SpotLight(0xffe2b0, 0, 11, 0.5, 0.85, 1.2);
      const beamGeo = new THREE.CylinderGeometry(0.42, 1.05, 1, 16, 1, true);
      beamGeo.translate(0, -0.5, 0);
      const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
        uniforms: { uCol: { value: new THREE.Color(1, 0.86, 0.6) }, uA: { value: 0 } },
        vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying float vT; varying vec3 vP;
          void main() { vT = -position.y; vP = position; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uA; varying vec3 vN; varying vec3 vV; varying float vT; varying vec3 vP;
          float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          void main() {
            float edge = pow(abs(dot(normalize(vN), vV)), 1.6);
            float along = smoothstep(0.0, 0.12, vT) * (1.0 - smoothstep(0.55, 1.0, vT));
            // a few streaks of brighter air, like light through leaves on the other side of the glass
            float a = atan(vP.x, vP.z);
            float streak = 0.75 + 0.25 * sin(a * 5.0 + 1.3) * sin(a * 3.0 - 0.4);
            gl_FragColor = vec4(uCol * uA * edge * along * streak, 1.0);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      }));
      beam.renderOrder = 5;
      beam.frustumCulled = false;
      this.scene.add(key, bounce, win, win.target, beam);
      this.insideLights = { key, win, beam, bounce };
    }
    const L = this.insideLights, fy = FLOOR_Y.f1 * PX, H = new THREE.Vector3(HOUSE.x, 0, HOUSE.z);
    const flick = 0.94 + Math.sin(this.time * 11.3) * 0.03 + Math.sin(this.time * 6.1) * 0.03;
    // the lantern's warm pool, a low amber bounce off the floorboards near the camera
    L.key.position.copy(this.house.lampAt).add(new THREE.Vector3(0, -0.35, 0.25));
    L.key.color.setHex(0xffc27a).lerp(new THREE.Color(0xffe0bc), day * 0.6);
    L.key.intensity = k * (7 * day + 16 * night) * flick;
    L.bounce.position.set(H.x + this.pipL.x * 0.8, fy + 1.5, H.z + Math.min(4.2, this.pipL.y + 2.4));
    L.bounce.intensity = k * (1.1 * day + 3.6 * night);
    // the beam comes in through the back window on the sun's side, falling across the floor towards the room's middle
    const right = this.sky.sunDir.x >= 0;
    const wa = right ? FACE * 19 : -FACE * 18, wr = R_IN * PX - 0.15;
    const top = new THREE.Vector3(H.x + Math.sin(wa) * wr, fy + 2.3, H.z + Math.cos(wa) * wr);
    const foot = new THREE.Vector3(H.x + (right ? 0.7 : -0.7), fy, H.z - 0.6);
    const overcast = this.weather?.vis.overcast ?? 0;
    const sunny = day * (1 - overcast * 0.8) * Math.min(1, this.sky.sun.intensity * 0.6);
    const moon = THREE.MathUtils.smoothstep(night, 0.6, 0.95) * (1 - overcast) * 0.35;
    L.win.color.setRGB(1, 0.88, 0.66).lerp(new THREE.Color(0.55, 0.68, 1), moon > sunny ? 1 : 0);
    L.win.position.copy(top);
    L.win.target.position.copy(foot);
    L.win.intensity = k * (sunny * 9 + moon * 5);
    const len = top.distanceTo(foot) * 1.15;
    L.beam.position.copy(top);
    L.beam.scale.set(1, len, 1);
    L.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), foot.clone().sub(top).normalize());
    const bu = (L.beam.material as THREE.ShaderMaterial).uniforms;
    (bu.uCol.value as THREE.Color).copy(L.win.color);
    bu.uA.value = k * (sunny * 0.16 + moon * 0.1);
    L.beam.visible = bu.uA.value > 0.003;
    // dust motes drifting in the light
    if (L.beam.visible && (this.moteT -= dt) <= 0) {
      this.moteT = 0.35;
      const u = Math.random(), p = top.clone().lerp(foot, 0.15 + u * 0.75).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.7));
      this.fx.emit({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.05, vy: 0.03, vz: (Math.random() - 0.5) * 0.05, life: 3.2, frame: SPR.spark1, frames: 1, color: moon > sunny ? 0xc8d8ff : 0xfff0c8, size: 0.06, add: true, fadeOut: 1.2, flutter: 0.2 });
    }
    // the lantern glass glows when its light is on; from inside, the window glass shows the sky, not the lamplight
    // that makes the windows glow gold from outside
    this.house.panes.color.copy(this.paneBase).lerp(new THREE.Color(this.sky.hemi.color).multiplyScalar(0.3 + day * 0.25), k);
    if (k > 0.01) {
      HOUSE_LOOK.glow.multiplyScalar(1 + k * day * 1.1);
      HOUSE_LOOK.pane.copy(this.house.panes.color);
      syncLooks();
    }
    // the grade: lamplit rooms need no moonlight lift; a touch more vignette and colour for the cosy close view
    const g = this.post.grade, b = this.gradeBase;
    g.exposure = b.exposure * (1 - k * night * 0.52) * (1 + k * day * 0.1);
    g.bloomThreshold = b.bloomThreshold + k * night * 0.45;
    g.bloom = b.bloom * (1 + k * night * 0.15);
    g.vignette = b.vignette + k * (0.06 + night * 0.14);
    g.vibrance = b.vibrance + k * 0.1;
    g.saturation = b.saturation + k * 0.04;
    g.warm = b.warm + k * 0.03;
    // the open rooms' flood of warm light is for the oak seen from outside; inside, the lamps make the pools
    this.room.intensity = (1.4 + night * 9) * (1 - k * (0.5 + night * 0.35));
    // fireflies belong to the clearing, not the living room
    this.fireflies.mesh.visible = k < 0.4;
  }
  /** [look5] Pip strolls in from the porch through the front door (a string of little hops, under the lintel). */
  private walkIn() {
    const from = this.owl.node.position.clone(), to = this.spot('inside');
    this.owlPlace = 'inside';
    this.owl.pose = 'stand';
    this.trip = { from, to, t: 0, dur: from.distanceTo(to) * 0.5 + 0.3, mode: 'hop', arc: 0 };
  }
  /** [look5] The inside view's field of view: a little wider than the outdoor one, more so on tall screens. */
  private insideFov(): number {
    const a = this.camera.aspect, hf = (34 * Math.PI) / 180;
    // very wide windows: no more than ~52 degrees across, or the frame would reach the cut edges of the trunk
    const wide = (2 * Math.atan(Math.tan((26 * Math.PI) / 180) / a) * 180) / Math.PI;
    return THREE.MathUtils.clamp((2 * Math.atan(Math.tan(hf / 2) / a) * 180) / Math.PI, Math.min(34, wide), 62);
  }

  /** [house3] Camera distance that fits a w x h (world units) frame at the current aspect and field of view. */
  private fitDist(w: number, h: number): number {
    const v = (this.baseFov * Math.PI) / 360, hz = Math.atan(Math.tan(v) * this.camera.aspect);
    return Math.max(h / 2 / Math.tan(v), w / 2 / Math.tan(hz));
  }

  step(dt: number, draw = true) {
    this.time += dt;
    const t = this.time;
    if (this.stage) {
      this.renderer.shadowMap.autoUpdate = true; // [look4] stages run their own lights
      this.stage.update(dt, t);
      if (draw) this.post.render(this.stage.scene, this.stage.camera, t, this.stage.look ?? {}); // [look4] every stage goes through the chain
      return;
    }
    wind.uTime.value = t;
    GRASS.uTime.value = t;
    // [world] the weather sets how hard the wind blows (calm fog .. storm)
    const windK = this.weather ? 0.55 + this.weather.vis.wind * 1.4 : 1;
    const gust = (0.07 + 0.05 * Math.sin(t * 0.21) + 0.03 * Math.sin(t * 0.53 + 1.3)) * windK;
    wind.uWind.value.z = gust;
    GRASS.uWind.value.set(0.82, 0.57).multiplyScalar(0.6 + gust * 5);
    this.fx.windX = wind.uWind.value.x * gust * 9; this.fx.windZ = wind.uWind.value.y * gust * 9;
    this.terrain.water.uniforms.uTime.value = t;
    if ((this.skyT -= dt) <= 0) { this.skyT = 20; if (this.skyMode === 'clock') this.applySky(); }

    this.stepTrip(dt);
    this.owl.dark = this.sky.night;
    this.owl.update(dt);
    const op = this.owl.node.position;
    GRASS.uPush.value[0].set(op.x, op.z, this.owl.node.visible ? 0.7 : 0, 1);

    this.critters.update(dt, t, this.owl.node.visible ? [op] : [], this.sky.night, wind.uWind.value.x, wind.uWind.value.y, gust);
    this.fireflies.update(dt, t);
    this.fx.update(dt, t);
    const hooks = { fx: this.fx, sound: (id: string) => this.emit({ type: 'sound', id }), night: this.sky.night };
    this.house.update(dt, t, hooks);
    this.rooms.update(dt, t, hooks);

    // chimney smoke and a lantern flicker
    if ((this.smokeT -= dt) <= 0) {
      this.smokeT = 0.5;
      const c = this.house.chimneyTop;
      this.fx.emit({ x: c.x + (Math.random() - 0.5) * 0.2, y: c.y, z: c.z, vx: 0.15, vy: 0.55, vz: 0.05, life: 3.2, frame: SPR.puff1, frames: 3, fps: 1.2, color: this.sky.night > 0.5 ? 0x6a7090 : 0xe8e4dc, size: 0.5, grow: 1.2, drag: 0.3, wind: 0.4, fadeOut: 1 });
    }
    if (this.sky.night > 0.4) this.lantern.intensity = 6 * this.sky.night * (0.92 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.04);
    for (const f of this.tickers) f(dt, t);

    // camera
    this.stepInside(dt);
    const shot = this.director?.(dt, t) ?? null;
    const g: Cam = shot ?? this.goal();
    const home = this.view === 'home';
    if (!shot) { g.yaw += this.userYaw * (home ? THREE.MathUtils.lerp(0.1, 1, this.outK) : 1); g.dist *= (home ? 1 : this.userZoom) * (this.view === 'breathe' ? this.breathZoom : 1); }
    const wantFov = shot?.fov ?? (home ? THREE.MathUtils.lerp(this.insideFov(), this.baseFov, this.outK) : this.baseFov);
    if (Math.abs(this.camera.fov - wantFov) > 0.01) { this.camera.fov += (wantFov - this.camera.fov) * (shot?.snap ? 1 : Math.min(1, dt * 4)); this.camera.updateProjectionMatrix(); } // [look5] a cut cuts the lens too
    const k = shot?.snap ? 1 : 1 - Math.exp(-dt * 3.2), c = this.cur;
    c.yaw += (g.yaw - c.yaw) * k; c.pitch += (g.pitch - c.pitch) * k; c.dist += (g.dist - c.dist) * k; c.target.lerp(g.target, k);
    const cp = Math.cos(c.pitch);
    // a slow drift keeps the diorama feeling alive even when nobody touches it
    const drift = !shot && (this.view === 'home' || this.view === 'sleep') ? Math.sin(t * 0.07) * 0.05 * (this.view === 'home' ? 0.3 + this.outK * 0.7 : 1) : 0;
    this.camera.position.set(c.target.x + Math.sin(c.yaw + drift) * cp * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw + drift) * cp * c.dist);
    this.camera.lookAt(c.target);
    // [look4] aerial perspective only beyond the subject: the oak and the clearing stay clear, the far forest and the
    // hills melt into the horizon colour (mist weather pulls it in)
    {
      const wf = this.weather?.vis.fog ?? 0, oc = this.weather?.vis.overcast ?? 0;
      this.sky.fog.near = (c.dist + 18) * (1 - wf * 0.5) * (1 - oc * 0.15);
      this.sky.fog.far = (c.dist + 480) * (1 - wf * 0.6) * (1 - oc * 0.25);
      // focus the depth of field on the subject the camera looks at
      this.post.grade.focus = c.dist;
      this.post.grade.focusRange = Math.max(3, c.dist * 0.3);
      this.post.grade.blur = this.view === 'home' || this.view === 'sleep' || this.view === 'wake' ? 0.6 : 0.45;
      // [look5] inside the living room: Pip and what's round him sharp, the back wall a little soft and the world
      // outside the windows melting into bokeh
      const ink = home && !shot ? 1 - this.outK : 0;
      if (ink > 0.001) {
        const pd = this.owl.node.visible ? this.camera.position.distanceTo(this.owl.node.position.clone().add(new THREE.Vector3(0, 0.9, 0))) : c.dist * 0.8;
        const g = this.post.grade, L = THREE.MathUtils.lerp;
        g.focus = L(g.focus, Math.min(pd, c.dist), ink);
        g.focusRange = L(g.focusRange, 1.5, ink);
        g.blur = L(g.blur, 0.7, ink);
      }
    }
    CUT.uCutCam.value.copy(this.camera.position);
    this.shiftCur += (this.shift - this.shiftCur) * k;
    const w = innerWidth, h = innerHeight;
    if (Math.abs(this.shiftCur) > 0.002) this.camera.setViewOffset(w, h, 0, (this.shiftCur * h) / 2, w, h); else this.camera.clearViewOffset();

    this.sky.setViewport(innerWidth, innerHeight, this.renderer.getPixelRatio()); // [world]
    this.sky.update(t, this.camera, dt);
    this.vista.update(t, this.camera);
    if ((this.envT -= dt) <= 0) { this.envT = 2; this.bakeEnv(); } // [look4]
    if (!draw) return;
    // [look4] shadows every frame on high, every other / third frame on medium / low; small casters dropped there
    {
      const every = this.tier === 'high' ? 1 : this.tier === 'medium' ? 3 : 4;
      this.renderer.shadowMap.autoUpdate = every === 1;
      if (every > 1 && this.perf.frame++ % every === 0) this.renderer.shadowMap.needsUpdate = true;
      if ((this.casterT -= dt) <= 0) { this.casterT = 3; this.cullCasters(); }
    }
    this.post.render(this.scene, this.camera, t); // [world3]
  }

  /**
   * [world3] Render the real forest (sky, weather, season, time of day) from `camera` into `target`, e.g. for the
   * window of a stage (the shop, the interview office). Call it once when the stage opens and then every few frames;
   * the world keeps its clock and wind moving while a stage is up. Use viewTarget() for a suitable target.
   */
  renderView(camera: THREE.Camera, target: THREE.WebGLRenderTarget) {
    const r = this.renderer, prev = r.getRenderTarget();
    wind.uTime.value = this.time; GRASS.uTime.value = this.time;
    this.sky.update(this.time, camera);
    r.setRenderTarget(target);
    r.clear();
    r.render(this.scene, camera);
    r.setRenderTarget(prev);
    this.sky.update(this.time, this.camera);
  }
  /** [world3] A render target for renderView (linear HDR colour; use its .texture as a map). */
  viewTarget(w: number, h: number): THREE.WebGLRenderTarget {
    return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
  }

  snapCamera() {
    // [look5] the home view starts where it rests (inside or out), with its lens
    const o = this.owl.node.position;
    if (Math.hypot(o.x - HOUSE.x, o.z - HOUSE.z) < R_IN * PX + 0.3) this.pipL.set(o.x - HOUSE.x, o.z - HOUSE.z);
    if (this.view === 'home') { this.outT = this.outside ? 1 : 0; this.outK = this.outT; this.camera.fov = this.outside ? this.baseFov : this.insideFov(); this.camera.updateProjectionMatrix(); }
    const g = this.goal(); this.cur.yaw = g.yaw; this.cur.pitch = g.pitch; this.cur.dist = g.dist; this.cur.target.copy(g.target);
  }

  /** Screen position (CSS px) of a world point, for anchoring speech bubbles. */
  screenOf(v: THREE.Vector3): { x: number; y: number; behind: boolean } {
    const p = v.clone().project(this.camera), c = this.renderer.domElement;
    return { x: (p.x * 0.5 + 0.5) * c.clientWidth, y: (-p.y * 0.5 + 0.5) * c.clientHeight, behind: p.z > 1 };
  }

  // ---------------------------------------------------------------- input

  private input(el: HTMLCanvasElement) {
    const pts = new Map<number, { x: number; y: number }>();
    let moved = 0, pinch = 0, downAt = 0, onOwl = false, rub = 0;
    const owlHit = (cx: number, cy: number) => {
      if (!this.owl.node.visible) return false;
      const r = el.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), this.camera);
      return this.ray.ray.distanceToPoint(this.owl.node.position.clone().add(new THREE.Vector3(0, 0.85, 0))) < 0.9;
    };
    el.style.touchAction = 'none';
    // stages and the build mode get first look at every pointer event
    const hook = (type: 'down' | 'move' | 'up', e: PointerEvent): boolean => {
      if (this.stage) { this.stage.pointer?.(type, e.clientX, e.clientY, this.rayAt(e.clientX, e.clientY, this.stage.camera), e); return true; }
      if (this.interceptor) return this.interceptor(type, e.clientX, e.clientY, this.rayAt(e.clientX, e.clientY), e);
      return false;
    };
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      if (hook('down', e)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; downAt = performance.now(); rub = 0;
      onOwl = pts.size === 1 && owlHit(e.clientX, e.clientY);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    el.addEventListener('pointermove', (e) => {
      if (hook('move', e)) return;
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoomBy(pinch / d, 'pinch'); // [look5] pinch out of the living room to the whole oak, and back in
        pinch = d;
        return;
      }
      if (onOwl) { rub += Math.abs(dx) + Math.abs(dy); if (rub > 70) { rub = 0; this.emit({ type: 'pet', x: e.clientX, y: e.clientY }); } return; }
      if (moved > 6 && this.view !== 'breathe' && this.view !== 'sleep') this.userYaw = Math.max(-0.7, Math.min(0.7, this.userYaw - dx * 0.004)); // [look5] (inside the room the turn is scaled down in step)
    });
    const up = (e: PointerEvent) => {
      if (hook('up', e)) { pts.delete(e.pointerId); return; }
      const had = pts.delete(e.pointerId);
      if (!had || pts.size > 0) return;
      if (moved > 8 || performance.now() - downAt > 600) return;
      const r = el.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      const fi = this.fireflies.pick(this.ray.ray);
      if (fi >= 0) {
        const p = this.fireflies.position(fi);
        this.fx.burst('sparkle', p.x, p.y, p.z, 10);
        this.fireflies.respawn(fi);
        this.emit({ type: 'catch', x: e.clientX, y: e.clientY });
        return;
      }
      if (this.owl.node.visible) {
        const c = this.owl.node.position.clone().add(new THREE.Vector3(0, 0.85, 0));
        if (this.ray.ray.distanceToPoint(c) < 0.9) { this.emit({ type: 'tapOwl' }); return; }
      }
      // [house] moving boxes, boarded-up floors and furniture
      const pk = this.rooms.pick(this.ray.ray);
      if (pk?.kind === 'box') { this.emit({ type: 'tapBox', id: pk.id, x: e.clientX, y: e.clientY }); return; }
      const lock = this.house.pickLock(this.ray.ray);
      if (lock) { this.emit({ type: 'tapLock', floor: lock }); return; }
      if (pk?.kind === 'item') { this.emit({ type: 'tapItem', uid: pk.id, fid: pk.fid, x: e.clientX, y: e.clientY }); return; }
      // a tap on the living room floor walks Pip over there
      const fy = FLOOR_Y.f1 * PX, tf = (fy - this.ray.ray.origin.y) / this.ray.ray.direction.y;
      if (tf > 0) {
        const g = this.ray.ray.origin.clone().addScaledVector(this.ray.ray.direction, tf);
        if (Math.hypot(g.x - HOUSE.x, g.z - HOUSE.z) < R_IN * PX - 0.6) { this.emit({ type: 'tapGround', x: g.x, z: g.z }); return; }
      }
      const o = this.ray.ray, tt = -o.origin.y / o.direction.y;
      if (tt > 0) { const g = o.origin.clone().addScaledVector(o.direction, tt); this.emit({ type: 'tapGround', x: g.x, z: g.z }); }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); });
    el.addEventListener('wheel', (e) => {
      if (this.interceptor && !this.stage && this.interceptor('wheel', e.clientX, e.clientY, this.rayAt(e.clientX, e.clientY), e)) { e.preventDefault(); return; }
      e.preventDefault();
      if (this.stage) return;
      // [look5] trackpads send many small deltas, mice a few big ones: scale to a gentle step either way
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      this.zoomBy(1 + THREE.MathUtils.clamp(dy, -120, 120) / 1000, 'wheel');
    }, { passive: false }); // [house3]
  }

  /**
   * [look5] Zoom by a factor (> 1 out, < 1 in). Inside the living room a zoom out takes the camera out to the whole oak;
   * outside it zooms the tree view as before, and zooming in past its closest takes the camera back inside.
   */
  zoomBy(f: number, src: 'pinch' | 'wheel' | 'ui' = 'ui') {
    if (this.view !== 'home') { this.userZoom = THREE.MathUtils.clamp(this.userZoom * f, 0.32, 1.25); return; }
    if (this.zoomLock > 0 || this.director) return;
    const lf = Math.log(f), th = src === 'pinch' ? 0.16 : 0.09;
    // keep going the same way to build up a switch; turning back resets it
    this.zoomAcc = Math.sign(lf) === Math.sign(this.zoomAcc) ? this.zoomAcc + lf : lf;
    if (!this.outside) {
      if (this.zoomAcc > th) this.setOutside(true);
      return;
    }
    if (f < 1 && this.userZoom <= 0.56) { if (this.zoomAcc < -th) this.setOutside(false); return; }
    this.userZoom = THREE.MathUtils.clamp(this.userZoom * f, 0.55, 1.25);
    this.zoomAcc = 0;
  }
}
