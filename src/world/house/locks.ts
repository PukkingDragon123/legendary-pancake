// Boarded-up floors: weathered planks nailed across the dollhouse cut, cobwebs in the corners, a dark room of
// dust-sheeted junk behind, and a wooden sign swinging from chains with a brass padlock and the level it opens
// at. The art is a lowpix model per floor (art/lowpix/house/_src/boards.py -> house/boards_<floor>.glb) whose
// named nodes (p0..p4, sign, webs, curtain) this module animates: unlocking pops the planks off one by one in
// puffs of dust.
import * as THREE from 'three';
import { hash } from '../../gfx/noise.ts';
import { loadPart } from './models.ts';
import type { FloorId } from './plan.ts';

interface Rest { o: THREE.Object3D; p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3 }

export interface Lock {
  fid: FloorId;
  group: THREE.Group;
  planks: THREE.Object3D[];
  sign: THREE.Object3D | null;
  webs: THREE.Object3D | null;
  curtain: THREE.Object3D | null;
  state: 'locked' | 'opening' | 'open';
  t: number;
  vel: THREE.Vector3[];
  spin: THREE.Vector3[];
  /** put every board back (after a re-lock) */
  reset(): void;
}

export function buildLock(fid: FloorId, _level: number): Lock {
  const group = new THREE.Group();
  group.name = 'lock:' + fid;
  const rest: Rest[] = [];
  const L: Lock = {
    fid, group, planks: [], sign: null, webs: null, curtain: null, state: 'locked', t: 0, vel: [], spin: [],
    reset() { for (const r of rest) { r.o.position.copy(r.p); r.o.rotation.copy(r.r); r.o.scale.copy(r.s); } L.t = 0; },
  };
  loadPart('boards_' + fid, { shadows: false }).then((part) => {
    if (!part) return;
    group.add(part.root);
    const n = part.nodes;
    L.planks = [0, 1, 2, 3, 4, 5].map((i) => n['p' + i]).filter(Boolean);
    L.sign = n.sign ?? null;
    L.webs = n.webs ?? null;
    L.curtain = n.curtain ?? null;
    L.vel = L.planks.map(() => new THREE.Vector3());
    L.spin = L.planks.map(() => new THREE.Vector3());
    for (const o of [...L.planks, L.sign, L.webs, L.curtain]) if (o) rest.push({ o, p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() });
    if (L.state === 'open') group.visible = false;
  });
  return L;
}

export type LockEvent = { kind: 'plank' | 'dust' | 'sparkle' | 'done' | 'sign'; at: THREE.Vector3 };

/** Advance a lock: the sign swings, and while opening the planks fly (node units are house px). */
export function stepLock(L: Lock, dt: number, t: number, emit: (e: LockEvent) => void) {
  if (L.state === 'open') return;
  if (L.state === 'locked') {
    if (L.sign) {
      L.sign.rotation.x = Math.sin(t * 1.3 + (L.fid === 'f3' ? 1.4 : 0)) * 0.05;
      L.sign.rotation.z = Math.sin(t * 0.9) * 0.03;
    }
    if (L.webs) L.webs.rotation.x = Math.sin(t * 0.7) * 0.02;
    return;
  }
  const prev = L.t;
  L.t += dt;
  const k = L.t;
  const world = (o: THREE.Object3D | null) => (o ? o.getWorldPosition(new THREE.Vector3()) : L.group.getWorldPosition(new THREE.Vector3()));
  // the sign drops first
  if (prev < 0.05 && k >= 0.05) emit({ kind: 'sign', at: world(L.sign) });
  if (k > 0.05 && L.sign) {
    const f = Math.min(1, (k - 0.05) / 0.6);
    L.sign.position.y -= dt * (60 + f * 480) * f;
    L.sign.rotation.x += dt * 3 * f;
    L.sign.scale.setScalar(Math.max(0.001, 1 - f));
  }
  L.planks.forEach((p, i) => {
    const at = 0.35 + i * 0.2;
    if (prev < at && k >= at) {
      // px per second: up, out towards the camera, tumbling
      L.vel[i].set((hash(i, 1, 1, 7) - 0.5) * 38, 36 + hash(i, 2, 1, 7) * 26, 40 + hash(i, 3, 1, 7) * 22);
      L.spin[i].set((hash(i, 4, 1, 7) - 0.5) * 6, (hash(i, 5, 1, 7) - 0.5) * 3, (hash(i, 6, 1, 7) - 0.5) * 8);
      emit({ kind: 'plank', at: world(p) });
      emit({ kind: 'dust', at: world(p) });
    }
    if (k >= at) {
      const v = L.vel[i];
      v.y -= 150 * dt;
      p.position.addScaledVector(v, dt);
      p.rotation.x += L.spin[i].x * dt; p.rotation.y += L.spin[i].y * dt; p.rotation.z += L.spin[i].z * dt;
      const life = k - at;
      if (life > 0.8) p.scale.setScalar(Math.max(0.001, 1 - (life - 0.8) * 2.5));
    }
  });
  const fade = 0.35 + Math.max(5, L.planks.length) * 0.2;
  if (k > fade) {
    const f = Math.min(1, (k - fade) / 0.5);
    if (L.curtain) L.curtain.scale.y = Math.max(0.001, 1 - f);
    if (L.webs) L.webs.scale.setScalar(Math.max(0.001, 1 - f));
    if (prev <= fade) emit({ kind: 'sparkle', at: world(L.curtain).add(new THREE.Vector3(0, 1.5, 1)) });
  }
  if (k > fade + 1.2) { L.state = 'open'; L.group.visible = false; emit({ kind: 'done', at: world(L.curtain) }); }
}
