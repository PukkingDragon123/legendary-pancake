// Build mode's 3D side: a free top-down camera over the floor being edited (pan, pinch/wheel zoom,
// twist or buttons to orbit, tilt between top-down and 3/4), tap to select furniture, drag to move it
// on the grid with a green/red footprint (stacked things ride along, wall things slide along the
// wall), and the ghost of a new piece waiting to be placed. The UI (src/ui/build.tsx) drives it.
import * as THREE from 'three';
import { signal } from '@preact/signals';
import { PX } from '../gfx/box.ts';
import { ITEMS } from '../assets/registry.ts';
import {
  canAfford, checkFit, childrenOf, defaultWallY, doMove, doPlace, doStore, findSpot, kindOf, moveItem, pay, priceOfItem, rectOf, rotSize,
} from '../game/home.ts';
import { edit, save, type Placed, type Save } from '../game/store.ts';
import { sound } from '../audio/sound.ts';
import type { Scene, CamShot } from '../world/scene.ts';
import { CELL, FLOOR_Y, R_IN, ROOM_H, slotOf, WALL_SLOTS, wrapA, type FloorId } from '../world/house/plan.ts';
import { HOUSE } from '../world/layout.ts';
import { BlueprintGrid } from './grid.ts';

export interface SelInfo { uid?: string; pending?: boolean; id: string; ok: boolean; reason?: string; source?: 'inv' | 'buy' }
/** Reactive state the build UI reads. */
export const bstate = {
  floor: signal<FloorId>('f1'),
  sel: signal<SelInfo | null>(null),
  tilt: signal(false),
  moveMode: signal(false),
  /** a short chalk note shown over the room */
  note: signal(''),
  busy: signal(false),
};

interface Pending { id: string; source: 'inv' | 'buy'; p: Placed; mesh: THREE.Mesh; ok: boolean; base: number; on?: string }
type Mode = 'none' | 'pan' | 'drag-item' | 'drag-pending' | 'pinch';

const STEEP = 1.3, TILTED = 0.82;
const blip = (id: string, volume = 0.5) => sound.play(id, { volume, gap: 50 });

export class BuildController {
  readonly grid = new BlueprintGrid();
  private yaw = 0;
  private yawGoal = 0;
  private pitch = STEEP;
  private zoom = 1;
  private pan = new THREE.Vector3();
  private on = false;
  private show: { until: number; shot: CamShot; done: () => void } | null = null;
  private pts = new Map<number, { x: number; y: number }>();
  private mode: Mode = 'none';
  private moved = 0;
  private downAt = 0;
  private downHit: ReturnType<Scene['rooms']['pick']> = null;
  private pinch = { d: 0, a: 0 };
  private drag: { uid: string; grab: [number, number]; cand: Placed | null; ok: boolean; base: number; startWorld: Map<string, THREE.Vector3>; lastKey: string } | null = null;
  private pending: Pending | null = null;
  private wasVisible = true;
  private time = 0;

  constructor(readonly scene: Scene) {}

  // ---------------------------------------------------------------- enter / exit

  enter(fid: FloorId) {
    const sc = this.scene;
    this.on = true;
    this.wasVisible = sc.owl.node.visible;
    sc.owl.node.visible = false;
    sc.house.group.add(this.grid.mesh);
    sc.director = (dt, t) => this.shot(dt, t);
    sc.interceptor = (type, x, y, ray, e) => this.input(type, x, y, ray, e);
    this.yaw = this.yawGoal = 0;
    this.pitch = bstate.tilt.value ? TILTED : STEEP;
    this.setFloor(fid);
  }

  exit() {
    const sc = this.scene;
    this.cancelPending();
    this.select(null);
    this.on = false;
    sc.director = null;
    sc.interceptor = null;
    sc.house.setBuildView(null);
    sc.rooms.hidden.clear();
    sc.shift = 0;
    this.grid.mesh.parent?.remove(this.grid.mesh);
    sc.owl.node.visible = this.wasVisible && sc.owlPlace !== 'away';
    sc.setHome(save.value.home);
    sc.setView('home');
  }

  setFloor(fid: FloorId) {
    this.cancelPending();
    this.select(null);
    bstate.floor.value = fid;
    this.scene.house.setBuildView(fid);
    this.grid.paintBase(fid);
    this.pan.set(0, 0, 0);
  }

  // ---------------------------------------------------------------- camera

  private baseDist(): number {
    const cam = this.scene.camera;
    const t2 = 2 * Math.tan((cam.fov * Math.PI) / 360);
    const need = (R_IN * 2 + 14) * PX;
    const portrait = cam.aspect < 1;
    const dw = need / (cam.aspect * t2), dh = need / ((portrait ? 0.56 : 0.62) * t2);
    return Math.max(dw, dh);
  }

  private shot(dt: number, t: number): CamShot {
    this.time = t;
    const sc = this.scene;
    // the drawer covers the bottom of the screen: frame the room above it
    sc.shift = sc.camera.aspect < 1 ? 0.34 : 0.26;
    if (this.show) {
      if (t > this.show.until) { const d = this.show.done; this.show = null; d(); }
      else return this.show.shot;
    }
    this.yaw += (this.yawGoal - this.yaw) * Math.min(1, dt * 7);
    const want = bstate.tilt.value ? TILTED : STEEP;
    this.pitch += (want - this.pitch) * Math.min(1, dt * 5);
    const fid = bstate.floor.value;
    const target = new THREE.Vector3(HOUSE.x, FLOOR_Y[fid] * PX, HOUSE.z).add(this.pan);
    this.grid.fade(this.on ? 1 : 0, dt);
    // wall items on the walls nearest the camera hide with the walls
    const cam = new THREE.Vector2(Math.sin(this.yaw), Math.cos(this.yaw));
    sc.rooms.hidden.clear();
    for (const r of sc.rooms.itemsOn(fid)) {
      if (!kindOf(r.id).wall) continue;
      const p = r.mesh.position;
      const v = new THREE.Vector2(p.x, p.z).normalize();
      if (v.dot(cam) > 0.25) sc.rooms.hidden.add(r.uid);
    }
    // the selected thing bobs gently
    if (this.pending) this.pending.mesh.position.y = (FLOOR_Y[fid] + this.pending.base + 1.5 + Math.sin(t * 5) * 0.8) * PX;
    return { yaw: this.yaw, pitch: this.pitch, dist: this.baseDist() * this.zoom, target };
  }

  /** Pan so a world point sits in the middle of the view. */
  focusOn(at: THREE.Vector3) {
    this.pan.set(at.x - HOUSE.x, 0, at.z - HOUSE.z);
    const lim = R_IN * PX * 0.75, l = Math.hypot(this.pan.x, this.pan.z);
    if (l > lim) this.pan.multiplyScalar(lim / l);
  }
  rotateView(dir: 1 | -1) { this.yawGoal += (dir * Math.PI) / 2; blip('rotate_item', 0.4); }
  toggleTilt() { bstate.tilt.value = !bstate.tilt.value; blip('ui_toggle', 0.4); }
  zoomBy(k: number) { this.zoom = Math.max(0.55, Math.min(1.5, this.zoom * k)); }

  /** A front-on camera shot for a while (e.g. to watch the boards come off a floor). */
  playShot(shot: CamShot, secs: number, done: () => void) { this.show = { until: this.time + secs, shot, done }; }
  frontShot(fid: FloorId): CamShot {
    const portrait = this.scene.camera.aspect < 1;
    return { yaw: 0.12, pitch: 0.12, dist: portrait ? 24 : 17, target: new THREE.Vector3(HOUSE.x, (FLOOR_Y[fid] + 30) * PX, HOUSE.z + 2) };
  }

  // ---------------------------------------------------------------- picking helpers

  private floorPoint(ray: THREE.Ray, fid: FloorId): THREE.Vector3 | null {
    const y = FLOOR_Y[fid] * PX;
    if (Math.abs(ray.direction.y) < 1e-4) return null;
    const t = (y - ray.origin.y) / ray.direction.y;
    if (t <= 0) return null;
    return this.scene.house.toLocal(ray.origin.clone().addScaledVector(ray.direction, t));
  }
  /** where a ray meets the inner wall (the far side, seen from inside): angle and height in px */
  private wallPoint(ray: THREE.Ray, fid: FloorId): { a: number; v: number } | null {
    const o = this.scene.house.toLocal(ray.origin), d = ray.direction.clone().normalize();
    const R = R_IN - 0.5;
    const A = d.x * d.x + d.z * d.z, B = 2 * (o.x * d.x + o.z * d.z), C = o.x * o.x + o.z * o.z - R * R;
    const disc = B * B - 4 * A * C;
    if (A < 1e-6 || disc < 0) return null;
    // local space is world space scaled by 1/PX, so the unit direction carries over (s in px)
    const sPx = (-B + Math.sqrt(disc)) / (2 * A);
    const p = o.clone().addScaledVector(d, sPx);
    return { a: Math.atan2(p.x, p.z), v: p.y - FLOOR_Y[fid] };
  }
  /** the uids that move with an item (itself and what stands on it) */
  private dragGroup(uid: string): string[] {
    const r = save.value.home.floors[bstate.floor.value];
    return r ? [uid, ...childrenOf(r, uid).map((c) => c.uid)] : [uid];
  }
  private sim(): Save { return { home: structuredClone(save.value.home) } as unknown as Save; }

  /** Candidate placement for an item under a ray. */
  private candidate(id: string, rot: number, ray: THREE.Ray, grab: [number, number] = [0, 0], wallY?: number): Placed | null {
    const fid = bstate.floor.value, k = kindOf(id);
    if (k.wall) {
      const w = this.wallPoint(ray, fid);
      if (!w) return null;
      const s = (((slotOf(w.a) - Math.floor(k.w / 2)) % WALL_SLOTS) + WALL_SLOTS) % WALL_SLOTS;
      const wy = wallY ?? Math.round(Math.max(4 - k.minY, Math.min(ROOM_H - 3 - k.maxY, w.v - (k.minY + k.maxY) / 2)) / 2) * 2;
      return { uid: '__cand', id, x: s > WALL_SLOTS / 2 ? s - WALL_SLOTS : s, z: 0, rot: 0, wall: wy };
    }
    const p = this.floorPoint(ray, fid);
    if (!p) return null;
    const [w, d] = rotSize(k, rot);
    return { uid: '__cand', id, x: Math.round(p.x / CELL - w / 2) + grab[0], z: Math.round(p.z / CELL - d / 2) + grab[1], rot };
  }

  // ---------------------------------------------------------------- selection

  select(uid: string | null) {
    const sc = this.scene;
    bstate.moveMode.value = false;
    if (!uid) { sc.rooms.highlight(null); this.grid.footprint(null); if (!this.pending) bstate.sel.value = null; return; }
    this.cancelPending();
    const fid = bstate.floor.value, p = save.value.home.floors[fid]?.items.find((i) => i.uid === uid);
    const mesh = sc.rooms.meshOf(uid);
    if (!p || !mesh) return;
    sc.rooms.highlight(mesh);
    this.grid.footprint(kindOf(p.id).wall ? null : rectOf(p), true);
    bstate.sel.value = { uid, id: p.id, ok: true };
    blip('pickup_item', 0.45);
  }

  /** Screen point above the selected (or pending) thing, for the action bubble. */
  anchor(): { x: number; y: number; behind: boolean } | null {
    const sc = this.scene, s = bstate.sel.value;
    if (!s) return null;
    const mesh = s.pending ? this.pending?.mesh : s.uid ? sc.rooms.meshOf(s.uid) : undefined;
    if (!mesh) return null;
    const bb = new THREE.Box3().setFromObject(mesh);
    const top = new THREE.Vector3((bb.min.x + bb.max.x) / 2, bb.max.y + 0.15, (bb.min.z + bb.max.z) / 2);
    return sc.screenOf(top);
  }

  // ---------------------------------------------------------------- new pieces

  /** Bring a new piece in (from storage or the store) as a ghost the player places. */
  startPlacing(id: string, source: 'inv' | 'buy'): string | null {
    const sc = this.scene, fid = bstate.floor.value;
    this.select(null);
    this.cancelPending();
    const k = kindOf(id);
    // somewhere near the middle of the view
    const c = sc.house.toLocal(new THREE.Vector3(HOUSE.x, 0, HOUSE.z).add(this.pan));
    const pref: [number, number, number] = k.wall ? [slotOf(Math.atan2(-Math.sin(this.yaw), -Math.cos(this.yaw))), defaultWallY(id), 0] : [Math.round(c.x / CELL - k.w / 2), Math.round(c.z / CELL - k.d / 2), (4 - Math.round(this.yaw / (Math.PI / 2)) % 4 + 4) % 4];
    const p = findSpot(save.value, fid, id, pref);
    if (!p) return 'No free spot on this floor';
    const mesh = sc.rooms.makeItem(id);
    if (!mesh) return 'Can’t build that';
    sc.house.floors[fid].add(mesh);
    const fit = checkFit(save.value, fid, p);
    this.pending = { id, source, p: { ...p, uid: '__pending' }, mesh, ok: fit.ok, base: fit.base, on: fit.on };
    sc.rooms.place(mesh, fid, this.pending.p, fit.base);
    sc.rooms.highlight(mesh, fit.ok ? 0x9cff9c : 0xff6a5a);
    this.grid.footprint(k.wall ? null : rectOf(p), fit.ok);
    bstate.sel.value = { pending: true, id, ok: fit.ok, reason: fit.reason, source };
    blip('ui_drop', 0.5);
    sc.rooms.puff(mesh.getWorldPosition(new THREE.Vector3()), 'sparkle');
    return null;
  }

  private evalPending(cand: Placed) {
    const P = this.pending!, fid = bstate.floor.value;
    const fit = checkFit(save.value, fid, { ...cand, uid: '__pending' });
    P.p = { ...cand, uid: '__pending' }; P.ok = fit.ok; P.base = fit.base; P.on = fit.on;
    this.scene.rooms.place(P.mesh, fid, P.p, fit.base);
    this.scene.rooms.setHighlightColor(fit.ok ? 0x9cff9c : 0xff6a5a);
    this.grid.footprint(kindOf(P.id).wall ? null : rectOf(P.p), fit.ok);
    bstate.sel.value = { pending: true, id: P.id, ok: fit.ok, reason: fit.reason, source: P.source };
  }

  confirmPending(): string | null {
    const P = this.pending;
    if (!P) return null;
    if (!P.ok) { blip('ui_error', 0.5); return bstate.sel.value?.reason ?? 'Doesn’t fit there'; }
    const fid = bstate.floor.value;
    const at = P.mesh.getWorldPosition(new THREE.Vector3());
    const r = doPlace(fid, { id: P.id, x: P.p.x, z: P.p.z, rot: P.p.rot, wall: P.p.wall, on: P.on }, P.source === 'buy');
    if (r.error) { blip('ui_error', 0.5); return r.error; }
    this.cancelPending();
    blip(P.source === 'buy' ? 'ui_buy' : 'place_item', 0.6);
    this.scene.rooms.puff(at, 'dust');
    this.scene.rooms.puff(at.clone().add(new THREE.Vector3(0, 0.4, 0)), 'sparkle');
    if (r.uid) setTimeout(() => this.select(r.uid!), 60);
    return null;
  }

  cancelPending() {
    if (!this.pending) return;
    this.pending.mesh.parent?.remove(this.pending.mesh);
    this.scene.rooms.highlight(null);
    this.pending = null;
    this.grid.footprint(null);
    bstate.sel.value = null;
  }

  // ---------------------------------------------------------------- actions on the selection

  rotateSel(): string | null {
    const s = bstate.sel.value, fid = bstate.floor.value;
    if (!s) return null;
    if (kindOf(s.id).wall) return 'Wall pieces hang flat';
    if (s.pending && this.pending) {
      const P = this.pending, k = kindOf(P.id), rot = (P.p.rot + 1) % 4;
      const [w0, d0] = rotSize(k, P.p.rot), [w, d] = rotSize(k, rot);
      this.evalPending({ ...P.p, rot, x: Math.round(P.p.x + w0 / 2 - w / 2), z: Math.round(P.p.z + d0 / 2 - d / 2) });
      blip('rotate_item', 0.5);
      return null;
    }
    const p = save.value.home.floors[fid]?.items.find((i) => i.uid === s.uid);
    if (!p) return null;
    const k = kindOf(p.id), rot = (p.rot + 1) % 4;
    const [w0, d0] = rotSize(k, p.rot), [w, d] = rotSize(k, rot);
    const cx = p.x + w0 / 2, cz = p.z + d0 / 2;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const to = { x: Math.round(cx - w / 2) + dx, z: Math.round(cz - d / 2) + dz, rot };
      const sim = this.sim();
      if (moveItem(sim, fid, p.uid, to)) { doMove(fid, p.uid, to); blip('rotate_item', 0.55); this.select(p.uid); return null; }
    }
    blip('ui_error', 0.5);
    return 'No room to turn it here';
  }

  storeSel(): string | null {
    const s = bstate.sel.value, fid = bstate.floor.value;
    if (!s) return null;
    if (s.pending) { this.cancelPending(); blip('ui_back', 0.4); return null; }
    const mesh = s.uid ? this.scene.rooms.meshOf(s.uid) : null;
    const at = mesh?.getWorldPosition(new THREE.Vector3());
    this.select(null);
    const ids = doStore(fid, s.uid!);
    blip('drawer', 0.6);
    if (at) this.scene.rooms.puff(at, 'dust');
    return ids.length > 1 ? `Packed ${ids.length} things into storage` : 'Packed into storage';
  }

  /** Buy one more of the selected piece and start placing it. */
  buyAnother(): string | null {
    const s = bstate.sel.value;
    if (!s) return null;
    const d = ITEMS[s.id];
    if (!d || d.series || d.noStore) return 'This one can’t be bought';
    const pr = priceOfItem(s.id);
    if (!canAfford(save.value, pr)) { blip('ui_error', 0.5); return pr.gems ? 'Not enough moon gems' : 'Not enough acorns'; }
    edit((x) => { pay(x, pr); if (!x.owned.items.includes(s.id)) x.owned.items.push(s.id); x.inventory[s.id] = (x.inventory[s.id] ?? 0) + 1; });
    blip('ui_buy', 0.6);
    return this.startPlacing(s.id, 'inv');
  }

  toggleMove() { bstate.moveMode.value = !bstate.moveMode.value; blip('ui_tap', 0.4); }

  // ---------------------------------------------------------------- dragging

  private beginDrag(uid: string, ray: THREE.Ray) {
    const fid = bstate.floor.value, p = save.value.home.floors[fid]?.items.find((i) => i.uid === uid);
    if (!p) return;
    const k = kindOf(p.id);
    const under = this.candidate(p.id, p.rot, ray);
    const grab: [number, number] = under && !k.wall ? [p.x - under.x, p.z - under.z] : [0, 0];
    const startWorld = new Map<string, THREE.Vector3>();
    for (const u of this.dragGroup(uid)) { const m = this.scene.rooms.meshOf(u); if (m) startWorld.set(u, m.position.clone()); }
    this.drag = { uid, grab, cand: null, ok: true, base: 0, startWorld, lastKey: '' };
    blip('pickup_item', 0.5);
  }

  private dragTo(ray: THREE.Ray) {
    const D = this.drag, fid = bstate.floor.value;
    if (!D) return;
    const p = save.value.home.floors[fid]?.items.find((i) => i.uid === D.uid);
    if (!p) return;
    const cand = this.candidate(p.id, p.rot, ray, D.grab, undefined);
    if (!cand) return;
    const key = `${cand.x},${cand.z},${cand.wall}`;
    if (key === D.lastKey) return;
    D.lastKey = key;
    const to = { x: cand.x, z: cand.z, rot: p.rot, wall: cand.wall };
    const sim = this.sim();
    const ok = moveItem(sim, fid, D.uid, to);
    D.cand = { ...p, ...to }; D.ok = ok;
    const rooms = this.scene.rooms;
    const simRoom = sim.home.floors[fid]!;
    if (ok) {
      for (const u of this.dragGroup(D.uid)) {
        const q = simRoom.items.find((i) => i.uid === u), m = rooms.meshOf(u);
        if (!q || !m) continue;
        const host = q.on ? simRoom.items.find((i) => i.uid === q.on) : undefined;
        rooms.place(m, fid, q, (host ? kindOf(host.id).surface ?? 0 : 0) + 2);
      }
    } else {
      const m = rooms.meshOf(D.uid);
      if (m) {
        const before = m.position.clone();
        rooms.place(m, fid, { ...p, ...to }, 2);
        const delta = m.position.clone().sub(before);
        for (const u of this.dragGroup(D.uid).slice(1)) rooms.meshOf(u)?.position.add(delta);
      }
    }
    rooms.setHighlightColor(ok ? 0x9cff9c : 0xff6a5a);
    this.grid.footprint(kindOf(p.id).wall ? null : rectOf(D.cand), ok);
    sound.play('ui_drag', { volume: 0.25, gap: 70, rate: ok ? 1.1 : 0.8 });
    bstate.sel.value = { uid: D.uid, id: p.id, ok, reason: ok ? undefined : checkFit(save.value, fid, D.cand, new Set(this.dragGroup(D.uid))).reason };
  }

  private endDrag() {
    const D = this.drag, fid = bstate.floor.value;
    this.drag = null;
    if (!D) return;
    const rooms = this.scene.rooms;
    const mesh = rooms.meshOf(D.uid);
    if (D.cand && D.ok) {
      doMove(fid, D.uid, { x: D.cand.x, z: D.cand.z, rot: D.cand.rot, wall: D.cand.wall });
      blip('place_item', 0.6);
      if (mesh) rooms.puff(mesh.getWorldPosition(new THREE.Vector3()), 'dust');
      this.select(D.uid);
    } else {
      // snap back home with a little shake
      for (const [u, pos] of D.startWorld) rooms.meshOf(u)?.position.copy(pos);
      if (D.cand) blip('ui_error', 0.45);
      this.select(D.uid);
      if (D.cand) bstate.note.value = 'That spot doesn’t work. Try a green one.';
    }
  }

  private dragPending(ray: THREE.Ray) {
    const P = this.pending;
    if (!P) return;
    const cand = this.candidate(P.id, P.p.rot, ray);
    if (!cand || (cand.x === P.p.x && cand.z === P.p.z && cand.wall === P.p.wall)) return;
    this.evalPending(cand);
    sound.play('ui_drag', { volume: 0.25, gap: 70, rate: P.ok ? 1.1 : 0.8 });
  }

  // ---------------------------------------------------------------- input

  private input(type: 'down' | 'move' | 'up' | 'wheel', x: number, y: number, ray: THREE.Ray, e: PointerEvent | WheelEvent): boolean {
    if (!this.on || this.show) return true;
    const sc = this.scene, fid = bstate.floor.value;
    if (type === 'wheel') { this.zoomBy(1 + Math.sign((e as WheelEvent).deltaY) * 0.08); return true; }
    const id = (e as PointerEvent).pointerId ?? 0;
    if (type === 'down') {
      this.pts.set(id, { x, y });
      if (this.pts.size === 2) {
        if (this.drag) { const D = this.drag; this.drag = null; for (const [u, pos] of D.startWorld) sc.rooms.meshOf(u)?.position.copy(pos); }
        this.mode = 'pinch';
        const [a, b] = [...this.pts.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
        return true;
      }
      this.moved = 0; this.downAt = performance.now();
      const hit = sc.rooms.pick(ray, fid);
      this.downHit = hit;
      const s = bstate.sel.value;
      if (this.pending && this.hitsPending(ray)) this.mode = 'drag-pending';
      else if (s?.uid && hit?.kind === 'item' && hit.id === s.uid) this.mode = 'drag-item';
      else this.mode = 'pan';
      return true;
    }
    if (type === 'move') {
      const p = this.pts.get(id);
      if (!p) return true;
      const dx = x - p.x, dy = y - p.y;
      p.x = x; p.y = y;
      this.moved += Math.abs(dx) + Math.abs(dy);
      if (this.mode === 'pinch' && this.pts.size === 2) {
        const [a, b] = [...this.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (this.pinch.d) this.zoomBy(this.pinch.d / d);
        let da = ang - this.pinch.a;
        if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2;
        this.yawGoal -= da; this.yaw -= da;
        this.pinch = { d, a: ang };
        return true;
      }
      if (this.mode === 'pan' && this.moved > 6) {
        const cam = sc.camera;
        const wpp = (2 * this.baseDist() * this.zoom * Math.tan((cam.fov * Math.PI) / 360)) / innerHeight;
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)), toward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        this.pan.addScaledVector(right, -dx * wpp).addScaledVector(toward, -dy * wpp / Math.max(0.5, Math.sin(this.pitch)));
        const lim = R_IN * PX * 0.75, l = Math.hypot(this.pan.x, this.pan.z);
        if (l > lim) this.pan.multiplyScalar(lim / l);
      }
      if (this.mode === 'drag-item' && this.moved > 5) {
        if (!this.drag && bstate.sel.value?.uid) this.beginDrag(bstate.sel.value.uid, ray);
        this.dragTo(ray);
      }
      if (this.mode === 'drag-pending') this.dragPending(ray);
      return true;
    }
    // up
    this.pts.delete(id);
    if (this.mode === 'pinch') { if (this.pts.size === 0) this.mode = 'none'; return true; }
    const tap = this.moved < 8 && performance.now() - this.downAt < 650;
    if (this.mode === 'drag-item' && this.drag) this.endDrag();
    else if (tap && this.mode !== 'drag-pending') {
      const hit = this.downHit, s = bstate.sel.value;
      if (bstate.moveMode.value && s?.uid) {
        // move mode: the tapped spot is where it goes
        this.beginDrag(s.uid, ray);
        const D = this.drag;
        if (D) { D.grab = [0, 0]; this.dragTo(ray); this.endDrag(); }
      } else if (hit?.kind === 'item') this.select(hit.id);
      else if (hit?.kind === 'box') { bstate.note.value = 'Unpack the boxes outside build mode: just tap them!'; blip('ui_error', 0.3); }
      else if (this.pending) {
        // tapping the floor moves the ghost there
        const P = this.pending, cand = this.candidate(P.id, P.p.rot, ray);
        if (cand) { this.evalPending(cand); blip('ui_drag', 0.4); }
      } else this.select(null);
    }
    this.mode = 'none';
    return true;
  }

  private hitsPending(ray: THREE.Ray): boolean {
    if (!this.pending) return false;
    const rc = new THREE.Raycaster(ray.origin, ray.direction);
    if (rc.intersectObject(this.pending.mesh, true).length) return true;
    // a little forgiveness: near the ghost's footprint also counts
    const p = this.floorPoint(ray, bstate.floor.value);
    if (!p) return false;
    const r = rectOf(this.pending.p);
    return p.x > (r.x - 0.5) * CELL && p.x < (r.x + r.w + 0.5) * CELL && p.z > (r.z - 0.5) * CELL && p.z < (r.z + r.d + 0.5) * CELL;
  }
}

/** One controller per scene. */
let ctl: BuildController | null = null;
export function controller(scene: Scene): BuildController { if (!ctl || ctl.scene !== scene) ctl = new BuildController(scene); return ctl; }
export { wrapA };
