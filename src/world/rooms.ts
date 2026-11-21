// Draws what's in each room of the hollow oak from save.home: the wallpaper and flooring (painted
// from the room's Finish), every placed piece of furniture (with its moving parts and night light),
// and the moving boxes still waiting to be unpacked. Also: picking for taps, the fly-in arc when a
// box pops its furniture out, and the glowing outline build mode uses for the selected item.
import * as THREE from 'three';
import { box, buildProp, propMesh, PX, type BoxSpec, type Painter, type Prop } from '../gfx/box.ts';
import { FINISH, ITEMS } from '../assets/registry.ts';
import type { Save, Placed } from '../game/store.ts';
import { BOX, kindOf, rotSize } from '../game/home.ts';
import type { Fx } from './fx.ts';
import type { House } from './house.ts';
import { buildMovingBox, stepBoxIdle, stepBoxOpen, type BoxAnim, type BoxModel } from './house/boxes.ts';
import { discStrips, patchCut, swing } from './house/kit.ts';
import { NSEG } from './house/oak.ts';
import { HOLES } from './house/oak.ts';
import { CELL, FLOOR_IDS, FLOOR_Y, OPEN_A, PLANS, R_IN, ROOM_H, wallCenterA, wrapA, type FloorId } from './house/plan.ts';

type Home = Save['home'];
const shade = (c: number, k: number) => {
  const r = Math.max(0, Math.min(255, ((c >> 16) & 255) * k)), g = Math.max(0, Math.min(255, ((c >> 8) & 255) * k)), b = Math.max(0, Math.min(255, (c & 255) * k));
  return (r << 16) | (g << 8) | b;
};

/** Where a placed item's model sits, in house px: position, yaw and the y it rests on. */
export function poseOf(fid: FloorId, p: Placed, base: number): { x: number; y: number; z: number; yaw: number } {
  const k = kindOf(p.id);
  if (k.wall) {
    const a = wallCenterA(p.x, k.w), r = R_IN - 0.4 + k.minZ;
    return { x: Math.sin(a) * r, y: FLOOR_Y[fid] + (p.wall ?? 0), z: Math.cos(a) * r, yaw: a + Math.PI };
  }
  const [w, d] = rotSize(k, p.rot);
  const cx = (p.x + w / 2) * CELL, cz = (p.z + d / 2) * CELL;
  // centre the model's bounds on its footprint, whichever way it faces
  const mx = (k.minX + k.maxX) / 2, mz = (k.minZ + k.maxZ) / 2, yaw = (p.rot * Math.PI) / 2;
  const ox = mx * Math.cos(yaw) + mz * Math.sin(yaw), oz = -mx * Math.sin(yaw) + mz * Math.cos(yaw);
  return { x: cx - ox, y: FLOOR_Y[fid] + base, z: cz - oz, yaw };
}

interface ItemRec { uid: string; id: string; fid: FloorId; mesh: THREE.Mesh; key: string; def: (typeof ITEMS)[string] }
interface BoxRec { id: string; fid: FloorId; holder: THREE.Group; model: BoxModel; anim: BoxAnim | null; onBurst?: () => void; phase: number }
interface Fly { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; yaw: number; t: number; dur: number; h: number; landed: boolean }
export interface RoomHooks { fx: Fx; sound(id: string, volume?: number): void; night: number }

export class Rooms {
  private props = new Map<string, Prop>();
  private items = new Map<string, ItemRec>();
  private boxes = new Map<string, BoxRec>();
  private shells: Partial<Record<FloorId, { key: string; mesh: THREE.Mesh }>> = {};
  private flies: Fly[] = [];
  private lights: THREE.PointLight[] = [];
  private lightOwners: (ItemRec | null)[] = [];
  private outline: THREE.Mesh | null = null;
  private outlineMat = new THREE.MeshBasicMaterial({ color: 0xfff0a0, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  private pending: { kind: 'dust' | 'sparkle' | 'land'; at: THREE.Vector3 }[] = [];
  private home: Home | null = null;
  /** items hidden by build mode (the one being dragged is drawn by the drag ghost) */
  hidden = new Set<string>();

  constructor(readonly house: House) {
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffd98a, 0, 5.5, 1.6);
      house.group.add(l);
      this.lights.push(l);
      this.lightOwners.push(null);
    }
  }

  // ---------------------------------------------------------------- models

  propFor(id: string): Prop | null {
    let p = this.props.get(id);
    if (p) return p;
    const def = ITEMS[id];
    if (!def) return null;
    try { p = buildProp(def.build()); } catch (e) { console.warn('item build failed', id, e); return null; }
    this.props.set(id, p);
    return p;
  }
  /** A fresh mesh of an item (its moving parts attached), not added anywhere. */
  makeItem(id: string): THREE.Mesh | null {
    const p = this.propFor(id), def = ITEMS[id];
    if (!p || !def) return null;
    const m = propMesh(p);
    try { for (const o of def.parts?.() ?? []) m.add(o); } catch (e) { console.warn('item parts failed', id, e); }
    return m;
  }
  /** Set an object's transform from a placement (house-local, inside its floor group). */
  place(obj: THREE.Object3D, fid: FloorId, p: Placed, base: number) {
    const q = poseOf(fid, p, base);
    obj.position.set(q.x * PX, q.y * PX, q.z * PX);
    obj.rotation.set(0, q.yaw, 0);
  }

  // ---------------------------------------------------------------- shells (wallpaper + flooring)

  private shell(fid: FloorId, wallId: string, floorId: string): THREE.Mesh {
    const wf = FINISH[wallId] ?? FINISH.wall_heartwood, ff = FINISH[floorId] ?? FINISH.floor_planks;
    const y0 = FLOOR_Y[fid];
    const floorP: Painter = (t) => {
      const c = ff.paint(t.x + R_IN, t.z + R_IN);
      return t.face === 2 ? c : shade(c, 0.62);
    };
    const out: BoxSpec[] = discStrips(R_IN + 1.5, y0 - 2, y0, floorP, HOLES[fid], 4, { skip: 'd', tag: 'floor' });
    const step = (Math.PI * 2) / NSEG, segW = (2 * Math.PI * R_IN) / NSEG + 0.5;
    const wins = PLANS[fid].windows.map((w) => ({ ...w, y: y0 + w.v }));
    for (let i = 0; i < NSEG; i++) {
      const a = -Math.PI + (i + 0.5) * step;
      if (Math.abs(a) < OPEN_A) continue;
      const near = wins.filter((w) => Math.abs(wrapA(a - w.a)) < step / 2 + (w.r + 1) / R_IN);
      const p: Painter = (t) => {
        const ta = Math.atan2(t.x, t.z);
        if (t.face === 5 || t.face === 4) for (const w of near) if (Math.hypot(wrapA(ta - w.a) * R_IN, t.y - w.y) < w.r) return -1;
        const u = (wrapA(ta) + Math.PI) * R_IN, v = t.y - y0;
        const c = wf.paint(u, v);
        return t.face === 5 ? c : shade(c, 0.55);
      };
      out.push(...swing([box(0, y0, R_IN + 0.5, segW, ROOM_H, 1, p, { cut: near.length > 0, tag: 'lining' })], a));
    }
    const prop = buildProp(out);
    prop.mats.forEach(patchCut);
    const m = propMesh(prop);
    m.name = 'shell:' + fid;
    return m;
  }

  // ---------------------------------------------------------------- sync with the save

  sync(home: Home) {
    this.home = home;
    // shells
    for (const fid of FLOOR_IDS) {
      const r = home.floors[fid];
      const key = r ? r.wall + '|' + r.floor : '';
      const cur = this.shells[fid];
      if (cur && cur.key === key) continue;
      if (cur) { this.house.floors[fid].remove(cur.mesh); cur.mesh.geometry.dispose(); (cur.mesh.material as THREE.Material[]).forEach((m) => m.dispose()); delete this.shells[fid]; }
      if (r && home.unlocked.includes(fid)) {
        const mesh = this.shell(fid, r.wall, r.floor);
        this.house.floors[fid].add(mesh);
        this.shells[fid] = { key, mesh };
      }
    }
    // items
    const seen = new Set<string>();
    for (const fid of FLOOR_IDS) {
      const r = home.floors[fid];
      if (!r) continue;
      for (const p of r.items) {
        seen.add(p.uid);
        const host = p.on ? r.items.find((q) => q.uid === p.on) : undefined;
        const base = host ? kindOf(host.id).surface ?? 0 : 0;
        const key = `${fid}|${p.id}|${p.x}|${p.z}|${p.rot}|${p.wall ?? ''}|${base}`;
        let rec = this.items.get(p.uid);
        if (rec && rec.id !== p.id) { this.dropItem(rec); rec = undefined; }
        if (!rec) {
          const mesh = this.makeItem(p.id);
          if (!mesh) continue;
          mesh.name = 'item:' + p.uid;
          mesh.userData = { uid: p.uid, fid };
          rec = { uid: p.uid, id: p.id, fid, mesh, key: '', def: ITEMS[p.id] };
          this.items.set(p.uid, rec);
          this.house.floors[fid].add(mesh);
        }
        if (rec.fid !== fid) { this.house.floors[rec.fid].remove(rec.mesh); this.house.floors[fid].add(rec.mesh); rec.fid = fid; rec.mesh.userData.fid = fid; }
        if (rec.key !== key) { rec.key = key; if (!this.flies.some((f) => f.obj === rec!.mesh)) this.place(rec.mesh, fid, p, base); }
      }
    }
    for (const rec of [...this.items.values()]) if (!seen.has(rec.uid)) this.dropItem(rec);
    // boxes
    for (const id of home.boxes) {
      if (this.boxes.has(id)) continue;
      const b = BOX[id];
      if (!b || !home.unlocked.includes(b.floor)) continue;
      const model = buildMovingBox(b.label, b.tint, id.length * 7 + b.x * 3);
      const holder = new THREE.Group();
      holder.add(model.root);
      holder.position.set((b.x + 1) * CELL * PX, FLOOR_Y[b.floor] * PX, (b.z + 1) * CELL * PX);
      holder.rotation.y = (b.rot * Math.PI) / 2 + (((b.x * 7 + b.z * 3) % 5) - 2) * 0.06;
      holder.name = 'box:' + id;
      holder.userData = { box: id, fid: b.floor };
      model.root.traverse((o) => { o.userData = { box: id, fid: b.floor }; });
      this.house.floors[b.floor].add(holder);
      this.boxes.set(id, { id, fid: b.floor, holder, model, anim: null, phase: (b.x * 1.7 + b.z * 0.9 + 9) % 4.2 });
    }
    for (const rec of [...this.boxes.values()]) if (!home.boxes.includes(rec.id) && !rec.anim) this.dropBox(rec);
    this.assignLights();
  }

  private dropItem(rec: ItemRec) {
    rec.mesh.parent?.remove(rec.mesh);
    this.items.delete(rec.uid);
    if (this.outline?.parent === rec.mesh) this.outline = null;
  }
  private dropBox(rec: BoxRec) { rec.holder.parent?.remove(rec.holder); rec.model.dispose(); this.boxes.delete(rec.id); }

  private assignLights() {
    const lit = [...this.items.values()].filter((r) => r.def?.light && this.home?.unlocked.includes(r.fid));
    lit.sort((a, b) => FLOOR_IDS.indexOf(a.fid) - FLOOR_IDS.indexOf(b.fid) || (b.def.light!.power - a.def.light!.power));
    this.lights.forEach((l, i) => { this.lightOwners[i] = lit[i] ?? null; if (lit[i]) l.color.setHex(lit[i].def.light!.color); });
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number, t: number, hooks: RoomHooks) {
    for (const rec of this.items.values()) {
      if (rec.def?.animate) try { rec.def.animate(rec.mesh, t, dt); } catch { /* a broken animation shouldn't stop the world */ }
      rec.mesh.visible = !this.hidden.has(rec.uid);
    }
    // night lights follow their owners
    this.lights.forEach((l, i) => {
      const o = this.lightOwners[i];
      if (!o || !o.mesh.parent?.visible || !o.mesh.visible) { l.intensity = 0; return; }
      const L = o.def.light!;
      const v = new THREE.Vector3(L.x * PX, L.y * PX, L.z * PX);
      o.mesh.localToWorld(v);
      l.position.copy(this.house.group.worldToLocal(v));
      l.intensity = (0.35 + hooks.night * 3) * L.power * (0.96 + Math.sin(t * 9 + i) * 0.04);
    });
    // boxes: idle shimmy, or the opening sequence
    for (const rec of [...this.boxes.values()]) {
      if (!rec.anim) { stepBoxIdle(rec.model, t, rec.phase); continue; }
      const at = rec.holder.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.6, 0));
      for (const e of stepBoxOpen(rec.model, rec.anim, dt)) {
        if (e === 'knock') hooks.sound('wood_knock', 0.6);
        if (e === 'rip') { hooks.sound('fabric', 0.7); hooks.fx.burst('dust', at.x, at.y + 0.3, at.z, 4); }
        if (e === 'burst') {
          hooks.sound('ui_drop', 0.6); hooks.sound('sparkle', 0.5);
          hooks.fx.burst('dust', at.x, at.y + 0.2, at.z, 14); hooks.fx.burst('sparkle', at.x, at.y + 0.5, at.z, 16); hooks.fx.burst('stars', at.x, at.y + 0.6, at.z, 8);
          rec.onBurst?.();
        }
        if (e === 'fold') hooks.fx.burst('dust', at.x, at.y - 0.4, at.z, 8);
        if (e === 'gone') { this.dropBox(rec); }
      }
    }
    // furniture flying out of a box
    for (const f of [...this.flies]) {
      f.t += dt;
      if (f.t < 0) { f.obj.visible = false; continue; }
      f.obj.visible = true;
      const k = Math.min(1, f.t / f.dur), e = 1 - (1 - k) ** 2;
      f.obj.position.lerpVectors(f.from, f.to, e);
      f.obj.position.y += Math.sin(k * Math.PI) * f.h;
      f.obj.rotation.y = f.yaw + (1 - e) * Math.PI * 2;
      const s = k < 1 ? 0.25 + 0.75 * Math.min(1, k * 1.6) : 1;
      f.obj.scale.setScalar(s);
      if (k >= 1 && !f.landed) {
        f.landed = true;
        const w = f.obj.getWorldPosition(new THREE.Vector3());
        hooks.fx.burst('dust', w.x, w.y + 0.05, w.z, 8); hooks.fx.burst('sparkle', w.x, w.y + 0.4, w.z, 6);
        hooks.sound('place_item', 0.55);
      }
      if (f.landed) {
        const lt = f.t - f.dur;
        f.obj.scale.set(1 + Math.sin(lt * 18) * 0.12 * Math.max(0, 1 - lt * 3), 1 - Math.sin(lt * 18) * 0.16 * Math.max(0, 1 - lt * 3), 1 + Math.sin(lt * 18) * 0.12 * Math.max(0, 1 - lt * 3));
        if (lt > 0.4) { f.obj.scale.setScalar(1); f.obj.position.copy(f.to); f.obj.rotation.y = f.yaw; this.flies.splice(this.flies.indexOf(f), 1); }
      }
    }
    for (const e of this.pending.splice(0)) hooks.fx.burst(e.kind === 'sparkle' ? 'sparkle' : 'dust', e.at.x, e.at.y, e.at.z, 8);
    if (this.outline) (this.outline.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 6) * 0.3;
  }

  // ---------------------------------------------------------------- interactions

  /** Start the unpacking show for a box; `burst` fires when the flaps fly open. */
  openBox(id: string, burst: () => void): boolean {
    const rec = this.boxes.get(id);
    if (!rec || rec.anim) return false;
    rec.anim = { t: 0, burst: false, done: false };
    rec.onBurst = burst;
    rec.model.root.position.y = 0;
    return true;
  }
  isOpening(id: string) { return !!this.boxes.get(id)?.anim; }
  boxWorld(id: string): THREE.Vector3 | null { const r = this.boxes.get(id); return r ? r.holder.getWorldPosition(new THREE.Vector3()) : null; }

  /** Fly a freshly placed item out of a box (world point) to its spot. */
  flyIn(uid: string, from: THREE.Vector3, delay = 0) {
    const rec = this.items.get(uid);
    if (!rec) return;
    const to = rec.mesh.position.clone();
    const local = rec.mesh.parent!.worldToLocal(from.clone());
    this.flies.push({ obj: rec.mesh, from: local, to, yaw: rec.mesh.rotation.y, t: -delay, dur: 0.75, h: 1.2 + to.distanceTo(local) * 0.25, landed: false });
    rec.mesh.visible = false;
    rec.mesh.position.copy(local);
  }

  meshOf(uid: string) { return this.items.get(uid)?.mesh; }
  itemsOn(fid: FloorId) { return [...this.items.values()].filter((r) => r.fid === fid); }

  /** What's under a ray: an item or a box on a visible floor (optionally only `fid`). */
  pick(ray: THREE.Ray, fid?: FloorId): { kind: 'item' | 'box'; id: string; fid: FloorId; point: THREE.Vector3 } | null {
    const rc = new THREE.Raycaster(ray.origin, ray.direction, 0, 200);
    const objs: THREE.Object3D[] = [];
    for (const r of this.items.values()) if ((!fid || r.fid === fid) && r.mesh.visible && r.mesh.parent?.visible) objs.push(r.mesh);
    for (const b of this.boxes.values()) if ((!fid || b.fid === fid) && !b.anim && b.holder.parent?.visible) objs.push(b.holder);
    const hit = rc.intersectObjects(objs, true)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.userData.uid && !o.userData.box) o = o.parent;
    if (!o) return null;
    if (o.userData.box) return { kind: 'box', id: o.userData.box, fid: o.userData.fid, point: hit.point };
    return { kind: 'item', id: o.userData.uid, fid: o.userData.fid, point: hit.point };
  }

  /** Glow round an object (null clears). */
  highlight(obj: THREE.Mesh | null, color = 0xfff0a0) {
    if (this.outline) { this.outline.parent?.remove(this.outline); this.outline = null; }
    if (!obj) return;
    const o = new THREE.Mesh(obj.geometry, this.outlineMat);
    this.outlineMat.color.setHex(color);
    const bb = obj.geometry.boundingBox ?? (obj.geometry.computeBoundingBox(), obj.geometry.boundingBox!);
    const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const pad = 0.09;
    o.scale.set(1 + pad / Math.max(0.1, size.x), 1 + pad / Math.max(0.1, size.y), 1 + pad / Math.max(0.1, size.z));
    o.position.set(c.x * (1 - o.scale.x), c.y * (1 - o.scale.y), c.z * (1 - o.scale.z));
    o.renderOrder = -1;
    obj.add(o);
    this.outline = o;
  }
  setHighlightColor(color: number) { this.outlineMat.color.setHex(color); }

  /** Where Pip sleeps: the sleep anchor of the best placed bed (bedroom first), in world space. */
  bedSpot(): { at: THREE.Vector3; yaw: number; fid: FloorId } | null {
    let best: ItemRec | null = null, score = -1;
    for (const r of this.items.values()) {
      if (!r.def?.sleep || !this.home?.unlocked.includes(r.fid)) continue;
      const s = (r.def.cat === 'beds' ? 10 : 0) + (r.fid === 'f2' ? 3 : r.fid === 'f1' ? 2 : 1);
      if (s > score) { score = s; best = r; }
    }
    if (!best) return null;
    const a = best.def.sleep!;
    best.mesh.updateWorldMatrix(true, false);
    const at = best.mesh.localToWorld(new THREE.Vector3(a.x * PX, a.y * PX, a.z * PX));
    return { at, yaw: best.mesh.rotation.y + ((a.rot ?? 0) * Math.PI) / 180, fid: best.fid };
  }

  /** A seat anchor Pip can perch on (armchairs, cushions...), world space. */
  seats(fid: FloorId): { at: THREE.Vector3; yaw: number }[] {
    const out: { at: THREE.Vector3; yaw: number }[] = [];
    for (const r of this.items.values()) {
      if (r.fid !== fid || !r.def?.sit) continue;
      r.mesh.updateWorldMatrix(true, false);
      for (const a of r.def.sit) out.push({ at: r.mesh.localToWorld(new THREE.Vector3(a.x * PX, a.y * PX, a.z * PX)), yaw: r.mesh.rotation.y + ((a.rot ?? 0) * Math.PI) / 180 });
    }
    return out;
  }

  /** A clear bit of floor near a preferred point (house px), world space. */
  freeSpot(fid: FloorId, px: number, pz: number): THREE.Vector3 {
    const r = this.home?.floors[fid];
    const occ: { x: number; z: number; w: number; d: number }[] = [];
    for (const p of r?.items ?? []) { const k = kindOf(p.id); if (k.rug || k.wall || p.on) continue; const [w, d] = rotSize(k, p.rot); occ.push({ x: p.x, z: p.z, w, d }); }
    for (const id of this.home?.boxes ?? []) { const b = BOX[id]; if (b?.floor === fid) occ.push({ x: b.x, z: b.z, w: 2, d: 2 }); }
    let best: [number, number] = [px, pz], bd = Infinity;
    for (let x = -7; x <= 6; x++) for (let z = -6; z <= 6; z++) {
      const cx = (x + 0.5) * CELL, cz = (z + 0.5) * CELL;
      if (Math.hypot(cx, cz) > R_IN - 12) continue;
      if (occ.some((o) => x >= o.x - 1 && x < o.x + o.w + 1 && z >= o.z - 1 && z < o.z + o.d + 1)) continue;
      const d = Math.hypot(cx - px, cz - pz);
      if (d < bd) { bd = d; best = [cx, cz]; }
    }
    return this.house.toWorld(best[0], FLOOR_Y[fid], best[1]);
  }

  /** Puff of dust at a world point (used when build mode drops something). */
  puff(at: THREE.Vector3, kind: 'dust' | 'sparkle' = 'dust') { this.pending.push({ kind, at }); }
}
