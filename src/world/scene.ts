// The living diorama: renderer, camera views, day/night sky, the forest clearing (terrain, voxel
// flora, Moleforge pixel grass, critters, fireflies), Pip's tree house with its furniture slots,
// and Pip. Exposes a small API for the UI and emits events for taps and sounds.
import * as THREE from 'three';
import { buildProp, propMesh, PX, wind, type Prop } from '../gfx/box.ts';
import { FURNITURE, type ItemDef } from '../assets/furniture.ts';
import { HOME_ITEMS } from '../assets/home.ts';
import { OwlActor, type OwlFx, type OwlSound } from '../owl/actor.ts';
import { featherColour, type OwlLook } from '../owl/model.ts';
import { Critters } from './critters.ts';
import { Fireflies } from './fireflies.ts';
import { buildFlora, planForest, type Flora, type ForestPlan } from './flora.ts';
import { Fx, SPR } from './fx.ts';
import { GRASS, makeGrass, FG, type GrassItem } from './grass.ts';
import { buildGardenFence, buildHouse, type House, type Slot, type Zone } from './house.ts';
import { GARDEN, groundY, HOUSE, MEADOW } from './layout.ts';
import { hourFor, Sky, type SkyMode } from './sky.ts';
import { buildTerrain, type Terrain } from './terrain.ts';

export type View = 'home' | 'interior' | 'loft' | 'owl' | 'breathe' | 'sleep' | 'garden' | 'deck' | 'wake';
export type Quality = 'low' | 'high';

export type SceneEvent =
  | { type: 'tapOwl' }
  | { type: 'tapSlot'; id: string }
  | { type: 'tapGround'; x: number; z: number }
  | { type: 'sound'; id: string };

export const ALL_ITEMS: ItemDef[] = [...HOME_ITEMS, ...FURNITURE];
export const ITEMS: Record<string, ItemDef> = Object.fromEntries(ALL_ITEMS.map((i) => [i.id, i]));

interface Cam { yaw: number; pitch: number; dist: number; target: THREE.Vector3 }

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
  readonly quality: Quality;
  view: View = 'home';
  skyMode: SkyMode | 'dawn' = 'clock';
  paused = false;
  time = 0;
  /** fraction of the screen covered by a bottom sheet; the view shifts up to compensate */
  shift = 0;
  /** decorate mode: show slot markers and accept slot taps */
  decorating = false;
  /** where the owl is supposed to be */
  owlPlace: 'porch' | 'bed' | 'inside' | 'away' | 'log' | 'loft' = 'porch';

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
  private props = new Map<string, Prop>();
  private placed = new Map<string, { item: string; mesh: THREE.Mesh; light?: THREE.PointLight }>();
  private markers = new Map<string, THREE.Mesh>();
  private trip: Trip | null = null;
  private room: THREE.PointLight;
  private lantern: THREE.PointLight;
  private gardenFence: THREE.Mesh;
  private weeds: THREE.Group;
  private smokeT = 0;
  private hourOverride: number | null = null;

  constructor(canvas: HTMLCanvasElement, look: OwlLook, quality: Quality) {
    this.quality = quality;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false }));
    r.setPixelRatio(Math.min(devicePixelRatio || 1, quality === 'high' ? 2 : 1.25));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;

    this.plan = planForest(quality);
    this.sky = new Sky(this.scene, quality === 'high' ? 2048 : 1024);
    this.terrain = buildTerrain(this.plan.shade);
    this.flora = buildFlora(this.plan);
    this.fx = new Fx(quality === 'high' ? 1800 : 900);
    this.critters = new Critters(this.plan, this.fx, quality, (id) => this.emit({ type: 'sound', id }));
    this.house = buildHouse();
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

    // lights inside the hollow: a soft fill so the room reads by day, the lantern at night
    this.room = new THREE.PointLight(0xffd7a0, 0, 9, 1.6);
    this.room.position.set(HOUSE.x, 2.6, HOUSE.z + 0.4);
    this.lantern = new THREE.PointLight(0xffc06a, 0, 8, 1.4);
    this.lantern.position.copy(this.house.lampAt);
    this.scene.add(this.room, this.lantern);

    this.fireflies = new Fireflies(quality === 'high' ? 90 : 50, new THREE.Vector3(0, 0, 0), 11);
    this.scene.add(this.fireflies.mesh);

    this.owl = new OwlActor(look, {
      fx: (k, at, n) => this.owlFx(k, at, n),
      sound: (id) => this.emit({ type: 'sound', id: 'owl_' + id }),
    });
    this.scene.add(this.owl.node);
    this.placeOwl('porch');

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
    if (p === 'log') return new THREE.Vector3(MEADOW.x, 0.66, 2.6);
    return new THREE.Vector3(0, 9, -30);
  }

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
    if (p === this.owlPlace && !this.trip) { done?.(); return; }
    const from = this.owl.node.position.clone(), to = this.spot(p);
    const d = from.distanceTo(to);
    const fly = d > 2.4 || Math.abs(to.y - from.y) > 0.6;
    this.owlPlace = p;
    this.owl.node.visible = true;
    this.owl.pose = fly ? 'fly' : 'stand';
    if (fly) this.emit({ type: 'sound', id: 'owl_flap' });
    this.trip = { from, to, t: 0, dur: fly ? Math.max(1.1, d * 0.28) : d * 0.55 + 0.3, mode: fly ? 'fly' : 'hop', done, arc: fly ? Math.max(1.2, d * 0.25) : 0 };
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

  // ---------------------------------------------------------------- furniture

  private propFor(id: string): Prop | null {
    if (this.props.has(id)) return this.props.get(id)!;
    const def = ITEMS[id];
    if (!def) return null;
    const p = buildProp(def.build());
    this.props.set(id, p);
    return p;
  }

  /** Make the furniture in every slot match the save. */
  setFurniture(map: Record<string, string>) {
    for (const [slot, rec] of this.placed) if (map[slot] !== rec.item) { this.scene.remove(rec.mesh); if (rec.light) this.scene.remove(rec.light); this.placed.delete(slot); }
    for (const [slotId, item] of Object.entries(map)) {
      if (!item || this.placed.get(slotId)?.item === item) continue;
      const slot = this.house.slots.find((s) => s.id === slotId);
      const prop = this.propFor(item);
      if (!slot || !prop) continue;
      const mesh = propMesh(prop);
      mesh.position.copy(slot.pos);
      mesh.rotation.y = slot.rot;
      mesh.name = 'item:' + slotId;
      this.scene.add(mesh);
      const def = ITEMS[item];
      let light: THREE.PointLight | undefined;
      if (def.light) {
        light = new THREE.PointLight(def.light.color, 0, 5, 1.6);
        light.position.copy(slot.pos).add(new THREE.Vector3(def.light.x * PX, def.light.y * PX, def.light.z * PX));
        light.userData.power = def.light.power;
        this.scene.add(light);
      }
      this.placed.set(slotId, { item, mesh, light });
    }
    this.applySky();
  }

  /** Spawn a sparkle burst over a slot (after placing something). */
  celebrate(slotId: string) {
    const s = this.house.slots.find((x) => x.id === slotId);
    if (s) { this.fx.burst('sparkle', s.pos.x, s.pos.y + 0.5, s.pos.z, 12); this.fx.burst('stars', s.pos.x, s.pos.y + 0.3, s.pos.z, 6); }
  }

  setZones(z: Partial<Record<Zone, boolean>>) {
    for (const [k, v] of Object.entries(z) as [Zone, boolean][]) {
      this.house.setZone(k, v);
      if (k === 'garden') { this.gardenFence.visible = v; this.weeds.visible = !v; }
    }
  }

  setDecorating(on: boolean, zone: Slot['zone'] | 'all' = 'all') {
    this.decorating = on;
    for (const m of this.markers.values()) this.scene.remove(m);
    this.markers.clear();
    if (!on) return;
    const tex = ringTexture();
    for (const s of this.house.slots) {
      if (zone !== 'all' && s.zone !== zone) continue;
      if (s.zone !== 'ground' && !this.house.zones[s.zone as Zone]) continue;
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, color: 0xffe6a0 });
      const geo = s.kind === 'wall' ? new THREE.PlaneGeometry(1.1, 1.1) : new THREE.PlaneGeometry(1.2, 1.2);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(s.pos);
      if (s.kind === 'wall') m.position.z += 0.08; else { m.rotation.x = -Math.PI / 2; m.position.y += 0.02; }
      m.userData.slot = s.id;
      m.renderOrder = 9;
      this.markers.set(s.id, m);
      this.scene.add(m);
    }
  }

  setLook(look: OwlLook) { this.owl.rebuild(look); }

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
    this.fireflies.alpha = night > 0.4 ? 1 : 0;
    for (const p of this.placed.values()) if (p.light) p.light.intensity = (0.4 + night * 3.2) * (p.light.userData.power ?? 1);
  }

  resize() {
    const c = this.renderer.domElement, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const hf = (30 * Math.PI) / 180;
    this.camera.fov = Math.min(56, Math.max(30, (2 * Math.atan(Math.tan(hf / 2) / Math.min(1, this.camera.aspect)) * 180) / Math.PI));
    this.camera.updateProjectionMatrix();
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
    switch (this.view) {
      case 'interior': return { yaw: 0, pitch: 0.2, dist: portrait ? 11.5 : 8.5, target: new THREE.Vector3(H.x, 2.4, H.z + 0.4) };
      case 'loft': return { yaw: 0, pitch: 0.12, dist: portrait ? 9 : 7, target: new THREE.Vector3(H.x, 4.2, H.z - 0.4) };
      case 'owl': return { yaw: -0.15, pitch: 0.1, dist: portrait ? 5.2 : 4.2, target: new THREE.Vector3(o.x, o.y + 0.9, o.z) };
      case 'breathe': return { yaw: 0, pitch: 0.08, dist: portrait ? 6.4 : 5.2, target: new THREE.Vector3(MEADOW.x, 1.55, 2.6) };
      case 'sleep': return { yaw: 0.1, pitch: 0.24, dist: portrait ? 26 : 20, target: new THREE.Vector3(0, 4.2, -3.5) };
      case 'wake': return { yaw: -0.08, pitch: 0.2, dist: portrait ? 15 : 12, target: new THREE.Vector3(0, 2.2, -0.5) };
      case 'garden': return { yaw: -0.25, pitch: 0.55, dist: portrait ? 15 : 12, target: new THREE.Vector3(GARDEN.x, 0.4, GARDEN.z) };
      case 'deck': return { yaw: -0.4, pitch: 0.18, dist: portrait ? 12 : 9, target: new THREE.Vector3(HOUSE.x + 4, 9.6, HOUSE.z) };
      default: return { yaw: 0, pitch: 0.3, dist: portrait ? 24 : 18, target: new THREE.Vector3(0, portrait ? 3.6 : 3.0, -2.2) };
    }
  }

  step(dt: number, draw = true) {
    this.time += dt;
    const t = this.time;
    wind.uTime.value = t;
    GRASS.uTime.value = t;
    const gust = 0.07 + 0.05 * Math.sin(t * 0.21) + 0.03 * Math.sin(t * 0.53 + 1.3);
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

    // chimney smoke and a lantern flicker
    if ((this.smokeT -= dt) <= 0) {
      this.smokeT = 0.5;
      const c = this.house.chimneyTop;
      this.fx.emit({ x: c.x + (Math.random() - 0.5) * 0.2, y: c.y, z: c.z, vx: 0.15, vy: 0.55, vz: 0.05, life: 3.2, frame: SPR.puff1, frames: 3, fps: 1.2, color: this.sky.night > 0.5 ? 0x6a7090 : 0xe8e4dc, size: 0.5, grow: 1.2, drag: 0.3, wind: 0.4, fadeOut: 1 });
    }
    if (this.sky.night > 0.4) this.lantern.intensity = 6 * this.sky.night * (0.92 + Math.sin(t * 13) * 0.04 + Math.sin(t * 7.3) * 0.04);
    for (const m of this.markers.values()) { const s = 1 + Math.sin(t * 3 + m.position.x) * 0.08; m.scale.setScalar(s); (m.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(t * 3) * 0.25; }

    // camera
    const g = this.goal();
    g.yaw += this.userYaw; g.dist *= this.userZoom;
    const k = 1 - Math.exp(-dt * 3.2), c = this.cur;
    c.yaw += (g.yaw - c.yaw) * k; c.pitch += (g.pitch - c.pitch) * k; c.dist += (g.dist - c.dist) * k; c.target.lerp(g.target, k);
    const cp = Math.cos(c.pitch);
    // a slow drift keeps the diorama feeling alive even when nobody touches it
    const drift = this.view === 'home' || this.view === 'sleep' ? Math.sin(t * 0.07) * 0.05 : 0;
    this.camera.position.set(c.target.x + Math.sin(c.yaw + drift) * cp * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw + drift) * cp * c.dist);
    this.camera.lookAt(c.target);
    this.shiftCur += (this.shift - this.shiftCur) * k;
    const el = this.renderer.domElement, w = el.clientWidth, h = el.clientHeight;
    if (Math.abs(this.shiftCur) > 0.002) this.camera.setViewOffset(w, h, 0, (this.shiftCur * h) / 2, w, h); else this.camera.clearViewOffset();

    this.sky.update(t, this.camera);
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
    let moved = 0, pinch = 0, downAt = 0;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; downAt = performance.now();
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    el.addEventListener('pointermove', (e) => {
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
      if (moved > 6 && this.view !== 'breathe' && this.view !== 'sleep') this.userYaw = Math.max(-0.7, Math.min(0.7, this.userYaw - dx * 0.004));
    });
    const up = (e: PointerEvent) => {
      const had = pts.delete(e.pointerId);
      if (!had || pts.size > 0) return;
      if (moved > 8 || performance.now() - downAt > 600) return;
      const r = el.getBoundingClientRect();
      this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      if (this.decorating) {
        const hit = this.ray.intersectObjects([...this.markers.values()], false)[0];
        if (hit) { this.emit({ type: 'tapSlot', id: hit.object.userData.slot }); return; }
        // tapping furniture also selects its slot
        const items = [...this.placed.entries()];
        const hit2 = this.ray.intersectObjects(items.map(([, v]) => v.mesh), false)[0];
        if (hit2) { const found = items.find(([, v]) => v.mesh === hit2.object); if (found) { this.emit({ type: 'tapSlot', id: found[0] }); return; } }
      }
      if (this.owl.node.visible) {
        const c = this.owl.node.position.clone().add(new THREE.Vector3(0, 0.85, 0));
        if (this.ray.ray.distanceToPoint(c) < 0.9) { this.emit({ type: 'tapOwl' }); return; }
      }
      const o = this.ray.ray, tt = -o.origin.y / o.direction.y;
      if (tt > 0) { const g = o.origin.clone().addScaledVector(o.direction, tt); this.emit({ type: 'tapGround', x: g.x, z: g.z }); }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); });
    el.addEventListener('wheel', (e) => { this.userZoom = Math.max(0.6, Math.min(1.35, this.userZoom * (1 + Math.sign(e.deltaY) * 0.06))); e.preventDefault(); }, { passive: false });
  }
}

let ringTex: THREE.CanvasTexture | null = null;
/** A soft pixel ring with a plus in the middle: marks an empty furniture slot. */
function ringTexture(): THREE.CanvasTexture {
  if (ringTex) return ringTex;
  const n = 32, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!, img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2);
    let a = 0;
    if (d > 12 && d < 14.5) a = 255;
    else if (d < 12) a = 50;
    if ((Math.abs(x + 0.5 - n / 2) < 1.2 && d < 6) || (Math.abs(y + 0.5 - n / 2) < 1.2 && d < 6)) a = 255;
    const i = (y * n + x) * 4;
    img.data[i] = 255; img.data[i + 1] = 245; img.data[i + 2] = 215; img.data[i + 3] = a;
  }
  g.putImageData(img, 0, 0);
  ringTex = new THREE.CanvasTexture(c);
  ringTex.magFilter = THREE.NearestFilter; ringTex.minFilter = THREE.NearestFilter;
  return ringTex;
}
