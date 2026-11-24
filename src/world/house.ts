// Pip's home: a grand, living hollow oak cut open like a dollhouse, three floors stacked inside the trunk under a
// huge leafy crown. The oak is built in code (./house/oak.ts: bark, roots, limbs, windows, door, porch, balcony,
// platform, lanterns; ./house/crown.ts: the leaf-card crown, ivy and ferns) in one group per floor band, so build
// mode can hide what's above the floor it edits. This file assembles it, keeps the lamps, glass and leaves in step
// with day and night, runs the locked floors (./house/locks.ts) and exposes the spots Pip uses (porch, bed,
// inside, loft, launch). Wallpaper, flooring and furniture are drawn by ./rooms.ts.
import * as THREE from 'three';
import { box, buildProp, propMesh, PX, type BoxSpec } from '../gfx/box.ts';
import { dirt, wood } from '../gfx/mats.ts';
import type { SeasonInfo } from './astro.ts';
import type { Fx } from './fx.ts';
import { HOUSE } from './layout.ts';
import { LEAF } from './house/crown.ts';
import { CUT, HOUSE_LOOK, syncLooks, texturesReady } from './house/kit.ts';
import { buildLock, stepLock, type Lock, type LockEvent } from './house/locks.ts';
import { HOUSE_PROPS, loadPart } from './house/models.ts';
import { buildOak, DUSTY } from './house/oak.ts';
import {
  BALCONY_AT, CHIMNEY_TOP, FLOOR_IDS, FLOOR_Y, LAMP_AT, LAUNCH, PLATFORM, PORCH_AT, trunkR, type FloorId,
} from './house/plan.ts';

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
  /** the trunk's top, limbs and the leafy crown */
  roof: THREE.Group;
  /** @deprecated always empty */
  slots: Slot[];
  /** the window glass tint (the scene sets it from the sky by day and the lamps at night; house/kit.ts HOUSE_LOOK) */
  panes: THREE.MeshBasicMaterial;
  /** the ground floor's hanging lantern (world) */
  lampAt: THREE.Vector3;
  lamps: Record<FloorId, THREE.Vector3>;
  chimneyTop: THREE.Vector3;
  /** where Pip stands on the porch / sleeps / hangs out / takes off for adventures (world) */
  spots: HouseSpots;
  /** resolves when the oak's textures and props have loaded */
  ready: Promise<void>;
  /** world y of a floor's walking surface */
  floorY(fid: FloorId): number;
  /** house-local px to world */
  toWorld(x: number, y: number, z: number): THREE.Vector3;
  /** world to house-local px */
  toLocal(v: THREE.Vector3): THREE.Vector3;
  isOpen(fid: FloorId): boolean;
  /** lock a floor or open it (animate: the padlock pops, the shutters and the front swing open) */
  setFloorOpen(fid: FloorId, open: boolean, animate?: boolean): void;
  /** build mode: show floors up to `fid` and dissolve the walls nearest the camera; null = normal */
  setBuildView(fid: FloorId | null): void;
  /** the floor a ray hits the locked front of, if any */
  pickLock(ray: THREE.Ray): FloorId | null;
  update(dt: number, t: number, hooks: HouseHooks): void;
  /** dress the oak's crown for the season (fresh in spring, golden in autumn, frosted but still leafy in winter: it
   * is a magic home) */
  setSeason(info: SeasonInfo): void;
  /** @deprecated zones became floors; kept so older callers compile */
  zones: Record<Zone, boolean>;
  setZone(z: Zone, open: boolean): void;
}

export function buildHouse(): House {
  const group = new THREE.Group();
  group.name = 'house';
  group.position.set(HOUSE.x, 0, HOUSE.z);
  const oak = buildOak();
  const floors = { f1: oak.bands.f1, f2: oak.bands.f2, f3: oak.bands.f3 } as Record<FloorId, THREE.Group>;
  const roof = oak.bands.roof;
  FLOOR_IDS.forEach((f) => { floors[f].name = 'floor:' + f; group.add(floors[f]); });
  roof.name = 'roof';
  group.add(roof);

  const panes = new THREE.MeshBasicMaterial({ color: 0x3a4a6a, toneMapped: false });
  const open: Record<FloorId, boolean> = { f1: true, f2: false, f3: false };
  const locks: Partial<Record<FloorId, Lock>> = {};
  for (const f of ['f2', 'f3'] as FloorId[]) locks[f] = buildLock(oak.fronts[f]!);

  const toWorld = (x: number, y: number, z: number) => new THREE.Vector3(HOUSE.x + x * PX, y * PX, HOUSE.z + z * PX);
  const toLocal = (v: THREE.Vector3) => new THREE.Vector3((v.x - HOUSE.x) / PX, v.y / PX, (v.z - HOUSE.z) / PX);
  const W = (p: [number, number, number]) => toWorld(p[0], p[1], p[2]);

  // lamplight: the porch lantern, and a warm lamp in each open upper room at night
  const porch = new THREE.PointLight(0xffb866, 0, 7, 1.6);
  porch.position.set(oak.porchLamp[0] * PX, oak.porchLamp[1] * PX, (oak.porchLamp[2] + 6) * PX);
  group.add(porch);
  // the glow of the windows and lanterns spilling onto the bark at night, so the oak reads as a lamplit home
  const spill = new THREE.PointLight(0xffb070, 0, 14, 1.4);
  spill.position.set(0, 6.2, 9.5);
  group.add(spill);
  const upper: Partial<Record<FloorId, THREE.PointLight>> = {};
  for (const f of ['f2', 'f3'] as FloorId[]) {
    const l = new THREE.PointLight(0xffc27a, 0, 9, 1.5);
    const p = LAMP_AT[f];
    l.position.set(p[0] * PX, (p[1] - 4) * PX, (p[2] + 10) * PX);
    floors[f].add(l);
    upper[f] = l;
  }

  // borrowed nature props round the foot of the trunk (they load in their own time)
  const props = HOUSE_PROPS.map(async (pr) => {
    const p = await loadPart(pr.id, { cut: true });
    if (!p) return;
    const r = trunkR(0) + pr.d;
    p.root.scale.setScalar(PX * pr.s);
    p.root.position.set(Math.sin(pr.a) * r * PX, -0.06, Math.cos(pr.a) * r * PX);
    p.root.rotation.y = (pr.yaw * Math.PI) / 180;
    floors.f1.add(p.root);
  });
  const ready = Promise.all([texturesReady(), ...props]).then(() => undefined);

  let buildFloor: FloorId | null = null;
  let sunLight: THREE.DirectionalLight | null = null;
  let sunSearched = 0;
  const rc = new THREE.Raycaster();

  const house: House = {
    group, floors, roof, panes, slots: [], ready,
    lampAt: W(LAMP_AT.f1),
    lamps: { f1: W(LAMP_AT.f1), f2: W(LAMP_AT.f2), f3: W(LAMP_AT.f3) },
    chimneyTop: W(CHIMNEY_TOP),
    spots: {
      porch: W(PORCH_AT), balcony: W(BALCONY_AT), platform: W(PLATFORM), launch: W(LAUNCH),
      bed: toWorld(-4, FLOOR_Y.f1 + 6, -50), inside: toWorld(-14, FLOOR_Y.f1, 34), loft: toWorld(-10, FLOOR_Y.f2, 24),
    },
    floorY: (fid) => FLOOR_Y[fid] * PX,
    toWorld, toLocal,
    isOpen: (fid) => open[fid],
    setFloorOpen(fid, o, animate = false) {
      open[fid] = o;
      const L = locks[fid];
      if (!L) return;
      if (o) {
        if (animate && L.state === 'locked') { L.state = 'opening'; L.t = 0; }
        else if (!animate) { L.state = 'open'; L.group.visible = false; }
      } else { L.state = 'locked'; L.group.visible = true; L.reset(); }
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
      rc.ray.copy(ray);
      rc.far = 400;
      for (const f of ['f2', 'f3'] as FloorId[]) {
        const L = locks[f]!;
        if (L.state !== 'locked' || !floors[f].visible || !L.group.visible) continue;
        if (rc.intersectObject(L.group, true).length) return f;
      }
      return null;
    },
    update(dt, t, hooks) {
      const n = hooks.night;
      // lamps: a soft honey glow by day, bright enough to bloom at night
      HOUSE_LOOK.glow.setRGB(1.05 + n * 2.6, 0.78 + n * 1.5, 0.46 + n * 0.55).multiplyScalar(0.96 + Math.sin(t * 11) * 0.02 + Math.sin(t * 6.3) * 0.02);
      // clear glass: a cool sky sheen by day, the warm lamplit room glowing through it at night
      HOUSE_LOOK.pane.copy(panes.color); // the scene tints the glass with the sky by day and lamplight at night
      HOUSE_LOOK.paneOpacity = 0.16 + n * 0.16;
      HOUSE_LOOK.sliver.setRGB(1.6 + n * 2.6, 0.95 + n * 1.4, 0.38 + n * 0.4);
      DUSTY().emissiveIntensity = 0.12 + n * 1.6;
      syncLooks();
      porch.intensity = n * 6 * (0.94 + Math.sin(t * 9.1) * 0.04 + Math.sin(t * 13.7) * 0.03);
      spill.intensity = n * 2.2;
      for (const f of ['f2', 'f3'] as FloorId[]) upper[f]!.intensity = open[f] ? 0.8 + n * 5 : 0;
      oak.ladder.rotation.z = Math.sin(t * 0.8) * 0.012;
      oak.ladder.rotation.x = Math.sin(t * 0.63 + 1) * 0.01;
      // the leaves glow where the sun comes through them
      if (!sunLight && (sunSearched -= dt) <= 0) {
        sunSearched = 2;
        let root: THREE.Object3D = group;
        while (root.parent) root = root.parent;
        root.traverse((o) => { const d = o as THREE.DirectionalLight; if (d.isDirectionalLight && d.castShadow && !sunLight) sunLight = d; });
      }
      if (sunLight) {
        const s = sunLight as THREE.DirectionalLight;
        LEAF.uSunDir.value.copy(s.position).sub(s.target.position).normalize();
        LEAF.uSunCol.value.copy(s.color).multiplyScalar(Math.min(1.2, s.intensity * 0.5));
      }
      LEAF.uTransl.value = 0.28 * (1 - n * 0.8);
      const emit = (e: LockEvent) => {
        const p = e.at;
        if (e.kind === 'plank') { hooks.sound('door_creak', 0.5); hooks.sound('wood_knock', 0.4); hooks.fx.burst('dust', p.x, p.y, p.z + 0.3, 6); }
        if (e.kind === 'dust') { hooks.sound('wood_knock', 0.55); hooks.fx.burst('dust', p.x, p.y, p.z + 0.4, 12); }
        if (e.kind === 'sign') { hooks.sound('drawer', 0.45); hooks.fx.burst('sparkle', p.x, p.y, p.z + 0.2, 10); }
        if (e.kind === 'sparkle') { hooks.sound('sparkle', 0.6); hooks.fx.burst('sparkle', p.x, p.y, p.z + 1, 26); hooks.fx.burst('stars', p.x, p.y, p.z + 1, 12); }
        if (e.kind === 'done') hooks.sound('reward_unlock', 0.6);
      };
      for (const f of ['f2', 'f3'] as FloorId[]) stepLock(locks[f]!, dt, t, emit);
      void buildFloor;
    },
    setSeason(info) {
      const c = new THREE.Color();
      for (const m of oak.crown) {
        const st = m.geometry.getAttribute('iLeaf') as THREE.InstancedBufferAttribute | undefined;
        let leaf = 0;
        if (info.season === 'spring') c.setHex(0xe2f0c4);
        else if (info.season === 'autumn' && info.t > 0.25) { leaf = 1; c.setHex(0xf4e6c8); }
        else if (info.season === 'winter') c.setHex(0xd6e0dc);
        else c.setHex(0xffffff);
        m.setColorAt(0, c);
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        if (st) { st.setX(0, leaf); st.needsUpdate = true; }
      }
    },
    zones: { loft: false, deck: false, garden: false },
    setZone(z, o) { house.zones[z] = o; },
  };
  return house;
}

/**
 * The garden plot's fence. The old voxel picket fence and soil beds don't belong in the realistic woods, so the
 * plot is just meadow now (the scene still toggles this object and the weeds by the garden zone).
 */
export function buildGardenFence(cx: number, cz: number, _hw: number, _hd: number): THREE.Mesh {
  const m = new THREE.Mesh();
  m.name = 'garden-plot';
  m.position.set(cx, 0, cz);
  return m;
}

/** @deprecated the voxel picket fence, kept for reference by older dev pages */
export function buildVoxelGardenFence(cx: number, cz: number, hw: number, hd: number): THREE.Mesh {
  const post = wood('#d8c8a8', { axis: 'y' }), rail = wood('#cdbb98', { axis: 'x', plank: 0 });
  const out: BoxSpec[] = [];
  const W = hw * 16, D = hd * 16;
  for (let x = -W; x <= W; x += 8) for (const z of [-D, D]) if (!(z > 0 && Math.abs(x) < 9)) out.push(box(x, 0, z, 2, 9, 2, post), box(x, 9, z, 1, 1, 1, post));
  for (let z = -D + 8; z < D; z += 8) for (const x of [-W, W]) out.push(box(x, 0, z, 2, 9, 2, post));
  for (const y of [3, 7]) {
    out.push(box(0, y, -D, W * 2, 1.2, 1, rail), box(-(W + 9) / 2 - 0.5, y, D, W - 9, 1.2, 1, rail), box((W + 9) / 2 + 0.5, y, D, W - 9, 1.2, 1, rail));
    out.push(box(-W, y, 0, 1, 1.2, D * 2, wood('#cdbb98', { axis: 'z', plank: 0 })), box(W, y, 0, 1, 1.2, D * 2, wood('#cdbb98', { axis: 'z', plank: 0 })));
  }
  out.push(box(-W + 10, -0.6, -D + 8, 18, 1.4, 8, dirt('#5c4636')), box(W - 10, -0.6, -D + 8, 18, 1.4, 8, dirt('#5c4636')));
  const m = propMesh(buildProp(out));
  m.position.set(cx, 0, cz);
  return m;
}
