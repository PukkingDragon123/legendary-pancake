// Pip's home: a grand hollow oak cut open like a dollhouse, three floors stacked inside the trunk and
// a brass observatory dome in the canopy. The geometry lives in ./house/* (plan, oak, locks, boxes);
// this file assembles it into per-floor groups, keeps the window panes and the boarded-up floors, and
// exposes the spots Pip uses (porch, bed, inside, loft, launch). Furniture is drawn by ./rooms.ts.
import * as THREE from 'three';
import { box, buildProp, propMesh, PX, type BoxSpec } from '../gfx/box.ts';
import { dirt, wood } from '../gfx/mats.ts';
import type { Fx } from './fx.ts';
import { SPR } from './fx.ts';
import { HOUSE } from './layout.ts';
import { CUT, patchCut } from './house/kit.ts';
import { buildLock, stepLock, type Lock, type LockEvent } from './house/locks.ts';
import { buildOak } from './house/oak.ts';
import { FLOOR_IDS, FLOOR_Y, OPEN_A, R_IN, RO, ROOM_H, UNLOCK, WALL_T, type FloorId } from './house/plan.ts';

export type Zone = 'loft' | 'deck' | 'garden';

/** @deprecated the old fixed furniture slots; rooms are a build grid now (src/game/home.ts) */
export interface Slot {
  id: string;
  zone: 'ground' | Zone;
  pos: THREE.Vector3;
  rot: number;
  kind: 'floor' | 'wall' | 'rug';
  label: string;
}

export interface HouseSpots { porch: THREE.Vector3; bed: THREE.Vector3; inside: THREE.Vector3; loft: THREE.Vector3; launch: THREE.Vector3; balcony: THREE.Vector3; platform: THREE.Vector3 }
export interface HouseHooks { fx: Fx; sound(id: string, volume?: number): void; night: number }

export interface House {
  group: THREE.Group;
  /** one group per floor (its walls, slab, fittings; rooms.ts adds furniture here) */
  floors: Record<FloorId, THREE.Group>;
  /** the roof, dome, branches and canopy */
  roof: THREE.Group;
  /** @deprecated always empty */
  slots: Slot[];
  /** window panes of open floors: day = dark glass, night = warm light */
  panes: THREE.MeshBasicMaterial;
  /** the ground floor's hanging lantern (world) */
  lampAt: THREE.Vector3;
  lamps: Record<FloorId, THREE.Vector3>;
  chimneyTop: THREE.Vector3;
  /** where Pip stands on the porch / sleeps / hangs out / takes off for adventures (world) */
  spots: HouseSpots;
  /** world y of a floor's walking surface */
  floorY(fid: FloorId): number;
  /** house-local px to world */
  toWorld(x: number, y: number, z: number): THREE.Vector3;
  /** world to house-local px */
  toLocal(v: THREE.Vector3): THREE.Vector3;
  isOpen(fid: FloorId): boolean;
  /** board a floor up or clear it (animate: planks pop off with dust and sparkles) */
  setFloorOpen(fid: FloorId, open: boolean, animate?: boolean): void;
  /** build mode: show floors up to `fid` and dissolve the walls nearest the camera; null = normal */
  setBuildView(fid: FloorId | null): void;
  /** the floor a ray hits a lock sign / boarded opening of, if any */
  pickLock(ray: THREE.Ray): FloorId | null;
  update(dt: number, t: number, hooks: HouseHooks): void;
  /** @deprecated zones became floors; kept so older callers compile */
  zones: Record<Zone, boolean>;
  setZone(z: Zone, open: boolean): void;
}

export function buildHouse(): House {
  const group = new THREE.Group();
  group.position.set(HOUSE.x, 0, HOUSE.z);
  const oak = buildOak();
  const floors = { f1: new THREE.Group(), f2: new THREE.Group(), f3: new THREE.Group() } as Record<FloorId, THREE.Group>;
  const roof = new THREE.Group();
  FLOOR_IDS.forEach((f) => { floors[f].name = 'floor:' + f; group.add(floors[f]); });
  roof.name = 'roof';
  group.add(roof);
  const bandMeshes: THREE.Mesh[] = [];
  oak.bk.b.forEach((boxes, i) => {
    if (!boxes.length) return;
    const p = buildProp(boxes, { wind: boxes.some((b) => b.sway) });
    const m = propMesh(p);
    m.name = 'band' + i;
    if (i < 3) { p.mats.forEach(patchCut); floors[FLOOR_IDS[i]].add(m); } else roof.add(m);
    bandMeshes.push(m);
  });
  const canopy = propMesh(buildProp(oak.canopy, { wind: true }));
  canopy.name = 'canopy';
  roof.add(canopy);

  // window panes: warm at night on open floors, dark on boarded-up ones
  const panes = new THREE.MeshBasicMaterial({ color: 0x2a3550, side: THREE.DoubleSide, toneMapped: false });
  const deadPanes = new THREE.MeshBasicMaterial({ color: 0x1c2230, side: THREE.DoubleSide, toneMapped: false });
  const paneMeshes: Record<FloorId, THREE.Mesh[]> = { f1: [], f2: [], f3: [] };
  for (const w of oak.panes) {
    if (w.floor === 'roof') continue;
    const m = new THREE.Mesh(new THREE.CircleGeometry(w.r * PX, 18), panes);
    const rr = R_IN + WALL_T / 2;
    m.position.set(Math.sin(w.a) * rr * PX, w.y * PX, Math.cos(w.a) * rr * PX);
    m.rotation.y = w.a;
    floors[w.floor].add(m);
    paneMeshes[w.floor].push(m);
  }

  const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(HOUSE.x + x * PX, y * PX, HOUSE.z + z * PX);
  const toLocal = (v: THREE.Vector3) => new THREE.Vector3((v.x - HOUSE.x) / PX, v.y / PX, (v.z - HOUSE.z) / PX);
  const W = (p: [number, number, number]) => toWorld(p[0], p[1], p[2]);

  // boarded-up floors
  const locks: Partial<Record<FloorId, Lock>> = {};
  const open: Record<FloorId, boolean> = { f1: true, f2: false, f3: false };
  for (const f of ['f2', 'f3'] as FloorId[]) {
    const L = buildLock(f, UNLOCK[f].level);
    floors[f].add(L.group);
    locks[f] = L;
  }
  let moteT = 0;
  let buildFloor: FloorId | null = null;

  const house: House = {
    group, floors, roof, panes, slots: [],
    lampAt: W(oak.at.lamp.f1),
    lamps: { f1: W(oak.at.lamp.f1), f2: W(oak.at.lamp.f2), f3: W(oak.at.lamp.f3) },
    chimneyTop: W(oak.at.chimneyTop),
    spots: {
      porch: W(oak.at.porch), balcony: W(oak.at.balcony), platform: W(oak.at.platform), launch: W(oak.at.launch),
      bed: toWorld(-4, FLOOR_Y.f1 + 6, -50), inside: toWorld(-14, FLOOR_Y.f1, 34), loft: toWorld(-10, FLOOR_Y.f2, 24),
    },
    floorY: (fid) => FLOOR_Y[fid] * PX,
    toWorld, toLocal,
    isOpen: (fid) => open[fid],
    setFloorOpen(fid, o, animate = false) {
      open[fid] = o;
      const L = locks[fid];
      for (const m of paneMeshes[fid]) m.material = o ? panes : deadPanes;
      if (!L) return;
      if (o) {
        if (animate && L.state === 'locked') { L.state = 'opening'; L.t = 0; }
        else if (!animate) { L.state = 'open'; L.group.visible = false; }
      } else { L.state = 'locked'; L.group.visible = true; }
    },
    setBuildView(fid) {
      buildFloor = fid;
      const i = fid ? FLOOR_IDS.indexOf(fid) : 3;
      FLOOR_IDS.forEach((f, k) => { floors[f].visible = k <= i; });
      roof.visible = !fid;
      CUT.uCutOn.value = fid ? 1 : 0;
      if (fid) { CUT.uCutY.value = (FLOOR_Y[fid] + 3) * PX; CUT.uCutCenter.value.set(HOUSE.x, 0, HOUSE.z); }
      for (const f of ['f2', 'f3'] as FloorId[]) { const L = locks[f]!; if (L.state !== 'open') L.group.visible = !fid || f !== fid; }
    },
    pickLock(ray) {
      const loc = new THREE.Vector3();
      for (const f of ['f2', 'f3'] as FloorId[]) {
        const L = locks[f]!;
        if (L.state !== 'locked' || !floors[f].visible) continue;
        // the boarded front of the floor, a plane facing the camera
        const z = Math.cos(OPEN_A) * RO + 6, y0 = FLOOR_Y[f], plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -(HOUSE.z + z * PX));
        if (!ray.intersectPlane(plane, loc)) continue;
        const lx = (loc.x - HOUSE.x) / PX, ly = loc.y / PX;
        if (Math.abs(lx) < Math.sin(OPEN_A) * RO && ly > y0 && ly < y0 + ROOM_H) return f;
      }
      return null;
    },
    update(dt, t, hooks) {
      const emit = (e: LockEvent) => {
        const p = e.at;
        if (e.kind === 'plank') { hooks.sound('wood_knock', 0.55); hooks.fx.burst('dust', p.x, p.y, p.z + 0.3, 8); }
        if (e.kind === 'dust') hooks.fx.burst('dust', p.x + (Math.random() - 0.5) * 3, p.y, p.z + 0.4, 6);
        if (e.kind === 'sign') { hooks.sound('drawer', 0.4); hooks.fx.burst('dust', p.x, p.y, p.z, 6); }
        if (e.kind === 'sparkle') { hooks.sound('sparkle', 0.6); hooks.fx.burst('sparkle', p.x, p.y, p.z, 24); hooks.fx.burst('stars', p.x, p.y, p.z, 12); }
        if (e.kind === 'done') hooks.sound('reward_unlock', 0.6);
      };
      for (const f of ['f2', 'f3'] as FloorId[]) stepLock(locks[f]!, dt, t, emit);
      // dust motes drifting in the light through the boards
      if ((moteT -= dt) <= 0) {
        moteT = 0.35;
        for (const f of ['f2', 'f3'] as FloorId[]) {
          const L = locks[f]!;
          if (L.state !== 'locked' || !floors[f].visible || buildFloor) continue;
          const p = toWorld((Math.random() - 0.5) * 120, FLOOR_Y[f] + 6 + Math.random() * 54, Math.cos(OPEN_A) * RO + 8);
          hooks.fx.emit({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.12, vy: -0.03 + Math.random() * 0.06, vz: 0.05, life: 4 + Math.random() * 2, frame: SPR.mote, color: hooks.night > 0.5 ? 0x8a90b0 : 0xfff2c8, size: 0.12 + Math.random() * 0.08, fadeIn: 0.8, fadeOut: 1.2, flutter: 0.15 });
        }
      }
    },
    zones: { loft: false, deck: false, garden: false },
    setZone(z, o) { house.zones[z] = o; },
  };
  void bandMeshes;
  return house;
}

/** Garden plot fence + soil beds, shown when the garden is unlocked; tangled weeds when it is not. */
export function buildGardenFence(cx: number, cz: number, hw: number, hd: number): THREE.Mesh {
  const post = wood('#e9e2d2', { axis: 'y' }), rail = wood('#e2d9c4', { axis: 'x', plank: 0 });
  const out: BoxSpec[] = [];
  const W = hw * 16, D = hd * 16;
  for (let x = -W; x <= W; x += 8) for (const z of [-D, D]) if (!(z > 0 && Math.abs(x) < 9)) out.push(box(x, 0, z, 2, 9, 2, post), box(x, 9, z, 1, 1, 1, post));
  for (let z = -D + 8; z < D; z += 8) for (const x of [-W, W]) out.push(box(x, 0, z, 2, 9, 2, post));
  for (const y of [3, 7]) {
    out.push(box(0, y, -D, W * 2, 1.2, 1, rail), box(-(W + 9) / 2 - 0.5, y, D, W - 9, 1.2, 1, rail), box((W + 9) / 2 + 0.5, y, D, W - 9, 1.2, 1, rail));
    out.push(box(-W, y, 0, 1, 1.2, D * 2, wood('#e2d9c4', { axis: 'z', plank: 0 })), box(W, y, 0, 1, 1.2, D * 2, wood('#e2d9c4', { axis: 'z', plank: 0 })));
  }
  out.push(box(-W + 10, -0.6, -D + 8, 18, 1.4, 8, dirt('#5c3d2a')), box(W - 10, -0.6, -D + 8, 18, 1.4, 8, dirt('#5c3d2a')));
  const m = propMesh(buildProp(out));
  m.position.set(cx, 0, cz);
  return m;
}
