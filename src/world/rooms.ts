// Draws what's in each room of the hollow oak from save.home: the wallpaper and flooring (painted at two texels
// per px from the room's Finish onto the inner wall and the floor), every placed piece of furniture (its
// hand-made GLB when it has one, with its animation clips looping; the box model while that loads or when there
// is none), and the moving boxes still waiting to be unpacked. Also: picking for taps, the fly-in arc when a box
// pops its furniture out, and the glowing outline build mode uses for the selected item.
import * as THREE from 'three';
import { buildProp, propMesh, PX, type Prop } from '../gfx/box.ts';
import { instanceGLB } from '../gfx/glb.ts';
import { FINISH, ITEMS } from '../assets/registry.ts';
import type { Finish } from '../assets/finishes.ts';
import type { Save, Placed } from '../game/store.ts';
import { BOX, kindOf, rotSize, setModelBounds } from '../game/home.ts';
import type { Fx } from './fx.ts';
import type { House } from './house.ts';
import { buildMovingBox, stepBoxIdle, stepBoxOpen, type BoxAnim, type BoxModel } from './house/boxes.ts';
import { patchCut } from './house/kit.ts';
import { CELL, FLOOR_IDS, FLOOR_Y, HOLES, OPEN_A, R_IN, ROOM_H, trunkR, wallCenterA, windowHoles, wrapA, type FloorId } from './house/plan.ts';

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

// ------------------------------------------------------------------ finishes on the walls and floors

/** texels per px of the painted wallpaper and flooring */
const TEX = 3;

function finishTexture(w: number, h: number, at: (i: number, j: number) => number): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = at(i, j), k = (j * w + i) * 4;
    data[k] = (c >> 16) & 255; data[k + 1] = (c >> 8) & 255; data[k + 2] = c & 255; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

const ARC = Math.PI * 2 - OPEN_A * 2;

/** The inner wall of a room: the back of the trunk from cut edge to cut edge, facing in, painted with the wallpaper. */
function wallMesh(fid: FloorId, wf: Finish): THREE.Mesh {
  const y0 = FLOOR_Y[fid], segs = 72, R = R_IN;
  const W = Math.round(R * ARC * TEX), H = ROOM_H * TEX;
  const tex = finishTexture(W, H, (i, j) => {
    const a = OPEN_A + ((i + 0.5) / W) * ARC;
    const u = (wrapA(a) + Math.PI) * R, v = (j + 0.5) / TEX;
    let c = wf.paint(u, v);
    // a soft painted shadow where the wall meets the floor and the ceiling
    if (v < 3) c = shade(c, 0.74 + v * 0.07);
    else if (v > ROOM_H - 5) c = shade(c, 0.8 + (ROOM_H - v) * 0.04);
    return c;
  });
  // the wall is cut into columns, with the window openings left out (the glass in them shows the real world)
  const holes = windowHoles(fid);
  const edges = new Set<number>();
  for (let s = 0; s <= segs; s++) edges.add(OPEN_A + (s / segs) * ARC);
  const toArc = (a: number) => { let d = a - OPEN_A; while (d < 0) d += Math.PI * 2; return OPEN_A + d; };
  for (const h of holes) { edges.add(toArc(h.a - h.half)); edges.add(toArc(h.a + h.half)); }
  const cols = [...edges].filter((a) => a >= OPEN_A - 1e-6 && a <= OPEN_A + ARC + 1e-6).sort((a, b) => a - b);
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const quad = (a0: number, a1: number, ya: number, yb: number) => {
    const k = pos.length / 3;
    for (const [a, y] of [[a0, ya], [a1, ya], [a0, yb], [a1, yb]]) { pos.push(Math.sin(a) * R * PX, y * PX, Math.cos(a) * R * PX); uv.push((a - OPEN_A) / ARC, (y - y0) / ROOM_H); }
    idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
  };
  for (let i = 0; i < cols.length - 1; i++) {
    const a0 = cols[i], a1 = cols[i + 1], am = (a0 + a1) / 2;
    if (a1 - a0 < 1e-5) continue;
    const h = holes.find((w) => Math.abs(Math.atan2(Math.sin(am - w.a), Math.cos(am - w.a))) < w.half);
    if (!h) { quad(a0, a1, y0, y0 + ROOM_H); continue; }
    const hb = Math.max(y0, h.y0), ht = Math.min(y0 + ROOM_H, h.y1);
    if (hb > y0) quad(a0, a1, y0, hb);
    if (ht < y0 + ROOM_H) quad(a0, a1, ht, y0 + ROOM_H);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // normals point at the room
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) { const p = new THREE.Vector3().fromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute, i); const d = new THREE.Vector3(-p.x, 0, -p.z).normalize(); n.setXYZ(i, d.x, d.y, d.z); }
  const m = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
  patchCut(m);
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.name = 'wallpaper:' + fid;
  return mesh;
}

/** The floor of a room: a disc reaching the trunk's outline across the cut, painted with the flooring. */
function floorMesh(fid: FloorId, ff: Finish): THREE.Mesh {
  const y0 = FLOOR_Y[fid];
  const Rcut = trunkR(y0) - 0.6, Rin = R_IN + 1, Rs = Rcut + 1;
  const N = Math.round(Rs * 2 * TEX);
  const holes = HOLES[fid];
  const tex = finishTexture(N, N, (i, j) => {
    const x = (i + 0.5) / TEX - Rs, z = (j + 0.5) / TEX - Rs;
    for (const [hx, hz, hh] of holes) {
      const dx = Math.abs(x - hx), dz = Math.abs(z - hz);
      if (dx < hh && dz < hh) return dx > hh - 1.5 || dz > hh - 1.5 ? 0x4e3a28 : 0x1d1915;
    }
    let c = ff.paint(x + R_IN, z + R_IN);
    // darker towards the walls (ambient occlusion), lighter in the middle of the room
    const d = Math.hypot(x, z), a = Math.abs(wrapA(Math.atan2(x, z)));
    if (a > OPEN_A && d > R_IN - 4) c = shade(c, 0.78 + (R_IN - d) * 0.05);
    else if (a < OPEN_A && d > Rcut - 1.5) c = shade(c, 0.82);
    return c;
  });
  const pos: number[] = [0, y0 * PX, 0], uv: number[] = [0.5, 0.5], idx: number[] = [];
  const add = (a: number, r: number) => { pos.push(Math.sin(a) * r * PX, y0 * PX, Math.cos(a) * r * PX); uv.push((Math.sin(a) * r + Rs) / (2 * Rs), (Math.cos(a) * r + Rs) / (2 * Rs)); };
  const segs = 96;
  // walk the rim from the right cut edge round the back to the left one, then across the open front
  const ring: [number, number][] = [];
  for (let s = 0; s <= segs; s++) ring.push([OPEN_A + (s / segs) * ARC, Rin]);
  const fs = 32;
  for (let s = 0; s <= fs; s++) ring.push([-OPEN_A + (s / fs) * OPEN_A * 2, Rcut]);
  ring.forEach(([a, r]) => add(a, r));
  const n = ring.length;
  for (let i = 1; i < n; i++) idx.push(0, i, i + 1);
  idx.push(0, n, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  // wind the triangles so they face up
  const ix = g.getIndex()!;
  for (let i = 0; i < ix.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute, ix.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute, ix.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute, ix.getX(i + 2));
    if (b.sub(a).cross(c.sub(a)).y < 0) { const t = ix.getX(i + 1); ix.setX(i + 1, ix.getX(i + 2)); ix.setX(i + 2, t); }
  }
  g.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({ map: tex });
  patchCut(m);
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  mesh.name = 'flooring:' + fid;
  return mesh;
}

// ------------------------------------------------------------------ furniture models

interface ItemRec { uid: string; id: string; fid: FloorId; obj: THREE.Group; key: string; def: (typeof ITEMS)[string]; glb: boolean; mixer: THREE.AnimationMixer | null }
interface BoxRec { id: string; fid: FloorId; holder: THREE.Group; model: BoxModel; anim: BoxAnim | null; onBurst?: () => void; phase: number }
interface Fly { obj: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; yaw: number; t: number; dur: number; h: number; landed: boolean }
export interface RoomHooks { fx: Fx; sound(id: string, volume?: number): void; night: number }

/**
 * lowpix exports unlit materials (the light is painted in); in the oak the room light, the lamps and the night
 * should still shade the furniture, so unlit materials become lit Lambert ones (shared per source material).
 * Materials named like a light source ("glow", "lamp", "emissive", "flame") stay unlit.
 */
const litCache = new Map<string, THREE.Material>();
function lightUp(root: THREE.Object3D) {
  root.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    const swap = (mat: THREE.Material): THREE.Material => {
      const b = mat as THREE.MeshBasicMaterial;
      if (!b.isMeshBasicMaterial || /glow|lamp|emissive|flame|light/i.test(b.name)) return mat;
      let lit = litCache.get(b.uuid);
      if (!lit) {
        lit = new THREE.MeshLambertMaterial({ map: b.map, color: b.color, alphaTest: b.alphaTest, transparent: b.transparent, side: b.side, vertexColors: b.vertexColors });
        lit.name = b.name;
        litCache.set(b.uuid, lit);
      }
      return lit;
    };
    m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
    if (!m.geometry.getAttribute('normal')) m.geometry.computeVertexNormals();
  });
}

/** How many px one GLB unit is: lowpix furniture is authored in px; guard against models made in blocks. */
function unitScale(size: THREE.Vector3, id: string): number {
  const k = kindOf(id);
  const want = Math.max(k.maxX - k.minX, k.maxY - k.minY, k.maxZ - k.minZ, 1);
  const have = Math.max(size.x, size.y, size.z, 1e-6);
  const r = want / have;
  return r > 6 && r < 40 ? 16 : 1;
}

export class Rooms {
  private props = new Map<string, Prop>();
  private items = new Map<string, ItemRec>();
  private boxes = new Map<string, BoxRec>();
  private shells: Partial<Record<FloorId, { key: string; meshes: THREE.Mesh[] }>> = {};
  private flies: Fly[] = [];
  private lights: THREE.PointLight[] = [];
  private lightOwners: (ItemRec | null)[] = [];
  private outline: { target: THREE.Object3D; meshes: THREE.Mesh[] } | null = null;
  private outlineMat = new THREE.MeshBasicMaterial({ color: 0xf1d39a, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false });
  private pending: { kind: 'dust' | 'sparkle' | 'land'; at: THREE.Vector3 }[] = [];
  private home: Home | null = null;
  /** GLB models that finished loading since the last frame (re-place items whose bounds changed) */
  private loaded = new Set<string>();
  /** items hidden by build mode (the one being dragged is drawn by the drag ghost) */
  hidden = new Set<string>();

  constructor(readonly house: House) {
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xf1d39a, 0, 5.5, 1.6);
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

  /**
   * A fresh model of an item, not added anywhere: a group in world units holding the GLB once it loads (the box
   * model and its moving parts until then, or for good when the item has no GLB).
   */
  makeItem(id: string): THREE.Group | null {
    const def = ITEMS[id];
    if (!def) return null;
    const holder = new THREE.Group();
    holder.name = 'item:' + id;
    const fallback = new THREE.Group();
    fallback.name = 'boxmodel';
    const p = this.propFor(id);
    if (p) {
      const m = propMesh(p);
      fallback.add(m);
      try { for (const o of def.parts?.() ?? []) m.add(o); } catch (e) { console.warn('item parts failed', id, e); }
    }
    holder.add(fallback);
    holder.userData.anim = fallback.children[0] ?? fallback;
    if (def.model) {
      instanceGLB(def.model).then(({ root, clips }) => {
        lightUp(root);
        const bb = new THREE.Box3().setFromObject(root);
        const size = bb.getSize(new THREE.Vector3());
        const s = unitScale(size, id);
        const model = new THREE.Group();
        model.name = 'glb';
        model.scale.setScalar(PX * s);
        model.add(root);
        holder.remove(fallback);
        holder.add(model);
        holder.userData.glb = true;
        if (clips.length) {
          const mixer = new THREE.AnimationMixer(root);
          const idle = clips.find((c) => /idle/i.test(c.name));
          for (const c of idle ? [idle] : clips) mixer.clipAction(c).play();
          holder.userData.mixer = mixer;
        }
        if (setModelBounds(id, { minX: bb.min.x * s, maxX: bb.max.x * s, minY: bb.min.y * s, maxY: bb.max.y * s, minZ: bb.min.z * s, maxZ: bb.max.z * s })) this.loaded.add(id);
        if (this.outline?.target === holder) this.highlight(holder, this.outlineMat.color.getHex());
      }).catch((e) => console.warn('item model failed', id, def.model, e));
    }
    return holder;
  }

  /** Set an object's transform from a placement (house-local, inside its floor group). */
  place(obj: THREE.Object3D, fid: FloorId, p: Placed, base: number) {
    const q = poseOf(fid, p, base);
    obj.position.set(q.x * PX, q.y * PX, q.z * PX);
    obj.rotation.set(0, q.yaw, 0);
  }

  // ---------------------------------------------------------------- shells (wallpaper + flooring)

  private dropShell(fid: FloorId) {
    const cur = this.shells[fid];
    if (!cur) return;
    for (const m of cur.meshes) { m.parent?.remove(m); m.geometry.dispose(); const mat = m.material as THREE.MeshLambertMaterial; mat.map?.dispose(); mat.dispose(); }
    delete this.shells[fid];
  }

  // ---------------------------------------------------------------- sync with the save

  sync(home: Home) {
    this.home = home;
    // shells
    for (const fid of FLOOR_IDS) {
      const r = home.floors[fid];
      const on = !!r && home.unlocked.includes(fid);
      const key = on ? r!.wall + '|' + r!.floor : '';
      const cur = this.shells[fid];
      if (cur && cur.key === key) continue;
      this.dropShell(fid);
      if (on) {
        const wf = FINISH[r!.wall] ?? FINISH.wall_heartwood, ff = FINISH[r!.floor] ?? FINISH.floor_planks;
        const meshes = [wallMesh(fid, wf), floorMesh(fid, ff)];
        for (const m of meshes) this.house.floors[fid].add(m);
        this.shells[fid] = { key, meshes };
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
          const obj = this.makeItem(p.id);
          if (!obj) continue;
          obj.name = 'item:' + p.uid;
          obj.userData.uid = p.uid;
          obj.userData.fid = fid;
          rec = { uid: p.uid, id: p.id, fid, obj, key: '', def: ITEMS[p.id], glb: false, mixer: null };
          this.items.set(p.uid, rec);
          this.house.floors[fid].add(obj);
        }
        if (rec.fid !== fid) { this.house.floors[rec.fid].remove(rec.obj); this.house.floors[fid].add(rec.obj); rec.fid = fid; rec.obj.userData.fid = fid; }
        if (rec.key !== key) { rec.key = key; if (!this.flies.some((f) => f.obj === rec!.obj)) this.place(rec.obj, fid, p, base); }
      }
    }
    for (const rec of [...this.items.values()]) if (!seen.has(rec.uid)) this.dropItem(rec);
    // boxes
    for (const id of home.boxes) {
      if (this.boxes.has(id)) continue;
      const b = BOX[id];
      if (!b || !home.unlocked.includes(b.floor)) continue;
      const model = buildMovingBox(id);
      const holder = new THREE.Group();
      holder.add(model.root);
      holder.position.set((b.x + 1) * CELL * PX, FLOOR_Y[b.floor] * PX, (b.z + 1) * CELL * PX);
      holder.rotation.y = (b.rot * Math.PI) / 2 + (((b.x * 7 + b.z * 3) % 5) - 2) * 0.06;
      holder.name = 'box:' + id;
      holder.userData = { box: id, fid: b.floor };
      this.house.floors[b.floor].add(holder);
      this.boxes.set(id, { id, fid: b.floor, holder, model, anim: null, phase: (b.x * 1.7 + b.z * 0.9 + 9) % 4.2 });
    }
    for (const rec of [...this.boxes.values()]) if (!home.boxes.includes(rec.id) && !rec.anim) this.dropBox(rec);
    this.assignLights();
  }

  private dropItem(rec: ItemRec) {
    rec.obj.parent?.remove(rec.obj);
    (rec.obj.userData.mixer as THREE.AnimationMixer | undefined)?.stopAllAction();
    this.items.delete(rec.uid);
    if (this.outline?.target === rec.obj) this.outline = null;
  }
  private dropBox(rec: BoxRec) { rec.holder.parent?.remove(rec.holder); rec.model.dispose(); this.boxes.delete(rec.id); }

  private assignLights() {
    const lit = [...this.items.values()].filter((r) => r.def?.light && this.home?.unlocked.includes(r.fid));
    lit.sort((a, b) => FLOOR_IDS.indexOf(a.fid) - FLOOR_IDS.indexOf(b.fid) || (b.def.light!.power - a.def.light!.power));
    this.lights.forEach((l, i) => { this.lightOwners[i] = lit[i] ?? null; if (lit[i]) l.color.setHex(lit[i].def.light!.color); });
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number, t: number, hooks: RoomHooks) {
    // a GLB arrived with different bounds than the box model: re-seat everything of that kind
    if (this.loaded.size && this.home) {
      for (const rec of this.items.values()) if (this.loaded.has(rec.id)) rec.key = '';
      for (const rec of this.items.values()) {
        const r = this.home.floors[rec.fid];
        const host = r?.items.find((q) => q.uid === r.items.find((p) => p.uid === rec.uid)?.on);
        if (host && this.loaded.has(host.id)) rec.key = '';
      }
      this.loaded.clear();
      this.sync(this.home);
    }
    for (const rec of this.items.values()) {
      const mixer = rec.obj.userData.mixer as THREE.AnimationMixer | undefined;
      if (mixer) mixer.update(dt);
      else if (rec.def?.animate && !rec.obj.userData.glb) try { rec.def.animate(rec.obj.userData.anim ?? rec.obj, t, dt); } catch { /* a broken animation shouldn't stop the world */ }
      rec.obj.visible = !this.hidden.has(rec.uid);
    }
    // night lights follow their owners
    this.lights.forEach((l, i) => {
      const o = this.lightOwners[i];
      if (!o || !o.obj.parent?.visible || !o.obj.visible) { l.intensity = 0; return; }
      const L = o.def.light!;
      const v = new THREE.Vector3(L.x * PX, L.y * PX, L.z * PX);
      o.obj.localToWorld(v);
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
    if (this.outline) this.outlineMat.opacity = 0.55 + Math.sin(t * 6) * 0.3;
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
    const to = rec.obj.position.clone();
    const local = rec.obj.parent!.worldToLocal(from.clone());
    this.flies.push({ obj: rec.obj, from: local, to, yaw: rec.obj.rotation.y, t: -delay, dur: 0.75, h: 1.2 + to.distanceTo(local) * 0.25, landed: false });
    rec.obj.visible = false;
    rec.obj.position.copy(local);
  }

  meshOf(uid: string): THREE.Group | undefined { return this.items.get(uid)?.obj; }
  itemsOn(fid: FloorId) { return [...this.items.values()].filter((r) => r.fid === fid).map((r) => ({ uid: r.uid, id: r.id, fid: r.fid, mesh: r.obj })); }

  /** What's under a ray: an item or a box on a visible floor (optionally only `fid`). */
  pick(ray: THREE.Ray, fid?: FloorId): { kind: 'item' | 'box'; id: string; fid: FloorId; point: THREE.Vector3 } | null {
    const rc = new THREE.Raycaster(ray.origin, ray.direction, 0, 200);
    const objs: THREE.Object3D[] = [];
    for (const r of this.items.values()) if ((!fid || r.fid === fid) && r.obj.visible && r.obj.parent?.visible) objs.push(r.obj);
    for (const b of this.boxes.values()) if ((!fid || b.fid === fid) && !b.anim && b.holder.parent?.visible) objs.push(b.holder);
    const hit = rc.intersectObjects(objs, true).find((h) => !(h.object as THREE.Mesh).userData.outline);
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && !o.userData.uid && !o.userData.box) o = o.parent;
    if (!o) return null;
    if (o.userData.box) return { kind: 'box', id: o.userData.box, fid: o.userData.fid, point: hit.point };
    return { kind: 'item', id: o.userData.uid, fid: o.userData.fid, point: hit.point };
  }

  /** A glowing hull round an object and its parts (null clears). */
  highlight(obj: THREE.Object3D | null, color = 0xf1d39a) {
    if (this.outline) { for (const m of this.outline.meshes) m.parent?.remove(m); this.outline = null; }
    if (!obj) return;
    this.outlineMat.color.setHex(color);
    const meshes: THREE.Mesh[] = [];
    const src: THREE.Mesh[] = [];
    obj.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh && !m.userData.outline && !(m as unknown as THREE.SkinnedMesh).isSkinnedMesh) src.push(m); });
    for (const m of src) {
      const g = m.geometry;
      const bb = g.boundingBox ?? (g.computeBoundingBox(), g.boundingBox!);
      const size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const ws = m.getWorldScale(new THREE.Vector3());
      const pad = 0.07;
      const o = new THREE.Mesh(g, this.outlineMat);
      o.userData.outline = true;
      o.scale.set(1 + pad / Math.max(0.05, size.x * ws.x), 1 + pad / Math.max(0.05, size.y * ws.y), 1 + pad / Math.max(0.05, size.z * ws.z));
      o.position.set(c.x * (1 - o.scale.x), c.y * (1 - o.scale.y), c.z * (1 - o.scale.z));
      o.renderOrder = -1;
      o.raycast = () => {};
      m.add(o);
      meshes.push(o);
    }
    this.outline = { target: obj, meshes };
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
    best.obj.updateWorldMatrix(true, false);
    const at = best.obj.localToWorld(new THREE.Vector3(a.x * PX, a.y * PX, a.z * PX));
    return { at, yaw: best.obj.rotation.y + ((a.rot ?? 0) * Math.PI) / 180, fid: best.fid };
  }

  /** A seat anchor Pip can perch on (armchairs, cushions...), world space. */
  seats(fid: FloorId): { at: THREE.Vector3; yaw: number }[] {
    const out: { at: THREE.Vector3; yaw: number }[] = [];
    for (const r of this.items.values()) {
      if (r.fid !== fid || !r.def?.sit) continue;
      r.obj.updateWorldMatrix(true, false);
      for (const a of r.def.sit) out.push({ at: r.obj.localToWorld(new THREE.Vector3(a.x * PX, a.y * PX, a.z * PX)), yaw: r.obj.rotation.y + ((a.rot ?? 0) * Math.PI) / 180 });
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
