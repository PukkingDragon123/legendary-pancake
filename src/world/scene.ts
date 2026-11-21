// The living diorama: renderer, camera views, day/night sky, the forest clearing (terrain, voxel
// flora, Moleforge pixel grass, critters, fireflies), Pip's grand hollow oak with its rooms, moving
// boxes and boarded-up floors, and Pip. Exposes a small API for the UI and emits events for taps
// and sounds.
import * as THREE from 'three';
import { PX, wind } from '../gfx/box.ts';
import { ALL_ITEMS, ITEMS } from '../assets/registry.ts';
import { OwlActor, type OwlFx, type OwlSound } from '../owl/actor.ts';
import { featherColour, type OwlLook } from '../owl/model.ts';
import { Critters } from './critters.ts';
import { Fireflies } from './fireflies.ts';
import { buildFlora, planForest, type Flora, type ForestPlan } from './flora.ts';
import { Fx, SPR } from './fx.ts';
import { GRASS, makeGrass, FG, type GrassItem } from './grass.ts';
import { buildGardenFence, buildHouse, type House, type Slot, type Zone } from './house.ts';
import { CUT } from './house/kit.ts';
import { FLOOR_IDS, FLOOR_Y, R_IN, type FloorId } from './house/plan.ts';
import { GARDEN, groundY, HOUSE, MEADOW, walkable } from './layout.ts';
import { Rooms } from './rooms.ts';
import type { Save } from '../game/store.ts';
import { hourFor, Sky, type SkyMode } from './sky.ts';
import { buildTerrain, type Terrain } from './terrain.ts';
import { Weather } from './weather.ts'; // [world]

export type View = 'home' | 'interior' | 'loft' | 'attic' | 'owl' | 'breathe' | 'sleep' | 'garden' | 'deck' | 'wake';
export type Quality = 'low' | 'high';

export type SceneEvent =
  | { type: 'tapOwl' }
  | { type: 'tapSlot'; id: string }
  | { type: 'tapBox'; id: string; x: number; y: number }
  | { type: 'tapItem'; uid: string; fid: FloorId; x: number; y: number }
  | { type: 'tapLock'; floor: FloorId }
  | { type: 'tapGround'; x: number; z: number }
  | { type: 'sound'; id: string }
  | { type: 'catch'; x: number; y: number }
  | { type: 'pet'; x: number; y: number };

export { ALL_ITEMS, ITEMS };

interface Cam { yaw: number; pitch: number; dist: number; target: THREE.Vector3 }

/**
 * A self-contained set the renderer can show instead of the forest (the interview room, the Snow
 * Queen's boutique...). The world keeps its state but stops updating while a stage is up.
 */
export interface Stage {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  update(dt: number, t: number): void;
  resize?(w: number, h: number): void;
  /** pointer input in CSS px with a ray through the stage camera; return true when handled */
  pointer?(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray, e: PointerEvent): boolean;
  dispose?(): void;
}
/** A camera shot for directors (cinematics, build mode). */
export interface CamShot { yaw: number; pitch: number; dist: number; target: THREE.Vector3; fov?: number; snap?: boolean }
export type PointerHook = (type: 'down' | 'move' | 'up' | 'wheel', x: number, y: number, ray: THREE.Ray, e: PointerEvent | WheelEvent) => boolean;

interface Trip { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; mode: 'hop' | 'fly' | 'leave' | 'arrive'; done?: () => void; arc: number }

export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.3, 400);
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

  constructor(canvas: HTMLCanvasElement, look: OwlLook, quality: Quality) {
    this.quality = quality;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false }));
    r.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.25));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.plan = planForest(quality);
    this.sky = new Sky(this.scene, quality === 'high' ? 2048 : 1024, quality); // [world]
    this.terrain = buildTerrain(this.plan.shade);
    this.flora = buildFlora(this.plan, quality); // [world]
    this.fx = new Fx(quality === 'high' ? 1800 : 900);
    this.critters = new Critters(this.plan, this.fx, quality, (id) => this.emit({ type: 'sound', id }));
    this.house = buildHouse();
    this.rooms = new Rooms(this.house);
    const grass = makeGrass(this.plan.grass);
    this.scene.add(this.terrain.group, this.flora.group, grass, this.house.group, this.critters.group, this.fx.group);

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
    this.scene.add(this.room, this.lantern);

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
    s.inside.copy(this.rooms.freeSpot('f1', -10, 34));
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
    (this.terrain.water.uniforms.uLight.value as THREE.Color).copy(this.sky.ambient).multiplyScalar(1.15);
    (this.terrain.water.uniforms.uDeep.value as THREE.Color).set(this.sky.night > 0.5 ? 0x1c3a6a : 0x2f7fa8);
    this.fx.setLight(this.sky.ambient);
    const night = this.sky.night;
    GRASS.uKey.value.copy(this.sky.sun.color).multiplyScalar(this.sky.sun.intensity * 0.42);
    GRASS.uSky.value.copy(this.sky.hemi.color).multiplyScalar(this.sky.hemi.intensity * 0.85);
    GRASS.uGround.value.copy(this.sky.hemi.groundColor).multiplyScalar(this.sky.hemi.intensity);
    GRASS.uSunDir.value.copy(this.sky.sunDir);
    GRASS.uDapple.value = night > 0.5 ? 0.25 : 1;
    this.house.panes.color.set(night > 0.4 ? 0xffc86a : 0x3a4a6a);
    this.room.intensity = 1.2 + night * 3.5;
    this.lantern.intensity = night * 6;
    this.fireflies.alpha = night > 0.4 && (this.weather?.firefliesOk ?? true) ? 1 : 0; // [world] not in winter or rain
    // furniture lights follow the sky every frame in rooms.update
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const hf = (30 * Math.PI) / 180;
    this.camera.fov = this.baseFov = Math.min(56, Math.max(30, (2 * Math.atan(Math.tan(hf / 2) / Math.min(1, this.camera.aspect)) * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
    this.stage?.resize?.(w, h);
  }

  start() {
    const loop = (ms: number) => {
      this.raf = requestAnimationFrame(loop);
      const t = ms / 1000, dt = Math.min(0.05, this.last ? t - this.last : 0.016);
      this.last = t;
      if (!this.paused) this.step(dt);
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
      case 'interior': return { yaw: 0.1, pitch: 0.42, dist: portrait ? 16 : 12, target: new THREE.Vector3(H.x, 1.5, H.z + 0.6) };
      case 'loft': return { yaw: 0, pitch: 0.16, dist: portrait ? 17 : 12, target: new THREE.Vector3(H.x, 6.6, H.z + 1.2) };
      case 'attic': return { yaw: 0, pitch: 0.12, dist: portrait ? 17 : 12, target: new THREE.Vector3(H.x, 11.1, H.z + 1.2) };
      case 'owl': return { yaw: -0.15, pitch: 0.12, dist: portrait ? 7.4 : 4.6, target: new THREE.Vector3(o.x, o.y + 0.85, o.z) };
      case 'breathe': return { yaw: 0, pitch: 0.1, dist: portrait ? 9.2 : 5.6, target: new THREE.Vector3(MEADOW.x, portrait ? 1.35 : 1.45, 2.6) };
      case 'sleep': return { yaw: 0.1, pitch: 0.22, dist: portrait ? 40 : 42, target: new THREE.Vector3(0, portrait ? 9.5 : 8.5, H.z + 1) };
      case 'wake': return { yaw: -0.08, pitch: 0.18, dist: portrait ? 24 : 20, target: new THREE.Vector3(1.5, 3.6, H.z + 3) };
      case 'garden': return { yaw: -0.25, pitch: 0.55, dist: portrait ? 15 : 12, target: new THREE.Vector3(GARDEN.x, 0.4, GARDEN.z) };
      case 'deck': return { yaw: 0.55, pitch: 0.16, dist: portrait ? 16 : 12, target: new THREE.Vector3(L.x - 1.5, L.y - 0.6, L.z + 1) };
      default: return { yaw: 0.16, pitch: 0.24, dist: portrait ? 33 : 37, target: new THREE.Vector3(0, portrait ? 8.2 : 7.0, H.z + 1.2) };
    }
  }

  step(dt: number, draw = true) {
    this.time += dt;
    const t = this.time;
    if (this.stage) {
      this.stage.update(dt, t);
      if (draw) this.renderer.render(this.stage.scene, this.stage.camera);
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
    const shot = this.director?.(dt, t) ?? null;
    const g: Cam = shot ?? this.goal();
    if (!shot) { g.yaw += this.userYaw; g.dist *= this.userZoom * (this.view === 'breathe' ? this.breathZoom : 1); }
    const wantFov = shot?.fov ?? this.baseFov;
    if (Math.abs(this.camera.fov - wantFov) > 0.01) { this.camera.fov += (wantFov - this.camera.fov) * Math.min(1, dt * 4); this.camera.updateProjectionMatrix(); }
    const k = shot?.snap ? 1 : 1 - Math.exp(-dt * 3.2), c = this.cur;
    c.yaw += (g.yaw - c.yaw) * k; c.pitch += (g.pitch - c.pitch) * k; c.dist += (g.dist - c.dist) * k; c.target.lerp(g.target, k);
    const cp = Math.cos(c.pitch);
    // a slow drift keeps the diorama feeling alive even when nobody touches it
    const drift = !shot && (this.view === 'home' || this.view === 'sleep') ? Math.sin(t * 0.07) * 0.05 : 0;
    this.camera.position.set(c.target.x + Math.sin(c.yaw + drift) * cp * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw + drift) * cp * c.dist);
    this.camera.lookAt(c.target);
    // [house] fog eases back as the camera pulls out to frame the whole oak
    this.sky.fog.near = Math.max(24, c.dist * 0.8); this.sky.fog.far = this.sky.fog.near + 40;
    CUT.uCutCam.value.copy(this.camera.position);
    this.shiftCur += (this.shift - this.shiftCur) * k;
    const w = innerWidth, h = innerHeight;
    if (Math.abs(this.shiftCur) > 0.002) this.camera.setViewOffset(w, h, 0, (this.shiftCur * h) / 2, w, h); else this.camera.clearViewOffset();

    this.sky.setViewport(innerWidth, innerHeight, this.renderer.getPixelRatio()); // [world]
    this.sky.update(t, this.camera, dt);
    if (!draw) return;
    this.renderer.render(this.scene, this.camera);
  }

  snapCamera() { const g = this.goal(); this.cur.yaw = g.yaw; this.cur.pitch = g.pitch; this.cur.dist = g.dist; this.cur.target.copy(g.target); }

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
        if (pinch) this.userZoom = Math.max(0.6, Math.min(1.35, this.userZoom * (pinch / d)));
        pinch = d;
        return;
      }
      if (onOwl) { rub += Math.abs(dx) + Math.abs(dy); if (rub > 70) { rub = 0; this.emit({ type: 'pet', x: e.clientX, y: e.clientY }); } return; }
      if (moved > 6 && this.view !== 'breathe' && this.view !== 'sleep') this.userYaw = Math.max(-0.7, Math.min(0.7, this.userYaw - dx * 0.004));
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
    el.addEventListener('wheel', (e) => { if (this.interceptor && !this.stage && this.interceptor('wheel', e.clientX, e.clientY, this.rayAt(e.clientX, e.clientY), e)) { e.preventDefault(); return; } this.userZoom = Math.max(0.6, Math.min(1.35, this.userZoom * (1 + Math.sign(e.deltaY) * 0.06))); e.preventDefault(); }, { passive: false });
  }
}
