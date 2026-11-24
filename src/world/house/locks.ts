// Locked floors: the floor's front is still whole bark (oak.ts builds it as one piece pivoting on its bottom edge),
// its windows shuttered with a sliver of warm light between the leaves, a dusty dark round window, and a brass
// plaque and padlock showing the level it opens at. Unlocking plays a little show: the padlock rattles and pops off,
// the plaque drops, the shutters creak in a puff of dust, then the whole front tips forward like a dollhouse front
// and shrinks away in sparkles, revealing the room.
import * as THREE from 'three';
import type { LockFront } from './oak.ts';
import type { FloorId } from './plan.ts';

interface Rest { o: THREE.Object3D; p: THREE.Vector3; r: THREE.Euler; s: THREE.Vector3; v: boolean }

export interface Lock {
  fid: FloorId;
  group: THREE.Group;
  front: LockFront;
  state: 'locked' | 'opening' | 'open';
  t: number;
  /** put everything back (after a re-lock) */
  reset(): void;
}

export function buildLock(front: LockFront): Lock {
  const rest: Rest[] = [];
  const keep = (o: THREE.Object3D) => rest.push({ o, p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone(), v: o.visible });
  keep(front.front);
  keep(front.padlock);
  keep(front.plaque);
  const L: Lock = {
    fid: front.fid, group: front.group, front, state: 'locked', t: 0,
    reset() { for (const r of rest) { r.o.position.copy(r.p); r.o.rotation.copy(r.r); r.o.scale.copy(r.s); r.o.visible = r.v; } L.t = 0; },
  };
  return L;
}

export type LockEvent = { kind: 'plank' | 'dust' | 'sparkle' | 'done' | 'sign'; at: THREE.Vector3 };

const easeOutBack = (k: number) => { const c = 1.5; return 1 + (c + 1) * (k - 1) ** 3 + c * (k - 1) ** 2; };
const padVel = new THREE.Vector3();

/** Advance a lock: the padlock sways while locked; the opening show once it starts. */
export function stepLock(L: Lock, dt: number, t: number, emit: (e: LockEvent) => void) {
  const F = L.front;
  if (L.state === 'open') return;
  const ph = L.fid === 'f3' ? 1.3 : 0;
  if (L.state === 'locked') {
    F.padlock.rotation.z = Math.sin(t * 1.4 + ph) * 0.05;
    return;
  }
  const prev = L.t;
  L.t += dt;
  const k = L.t;
  const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  // the padlock rattles, then pops off and tumbles away; the plaque drops after it
  if (k < 0.55) F.padlock.rotation.z = Math.sin(k * 42) * 0.3 * (k / 0.55);
  if (prev < 0.55 && k >= 0.55) { emit({ kind: 'sign', at: at(F.padlock) }); padVel.set(0.6, 2.4, 1.6); }
  if (k >= 0.55) {
    padVel.y -= 7 * dt;
    F.padlock.position.addScaledVector(padVel, dt);
    F.padlock.rotation.z += dt * 9;
    F.padlock.rotation.x += dt * 5;
    F.padlock.scale.setScalar(Math.max(0.001, 1 - (k - 0.55) * 1.4));
    F.plaque.scale.setScalar(Math.max(0.001, 1 - Math.max(0, k - 0.75) * 2.5));
  }
  // the shutters creak in a puff of dust
  if (prev < 0.8 && k >= 0.8) for (const s of F.shutters) emit({ kind: 'plank', at: at(s) });
  // the whole front tips forward on its bottom edge like a dollhouse front, then shrinks away in sparkles
  if (prev < 1.1 && k >= 1.1) emit({ kind: 'dust', at: at(F.plaque) });
  if (k >= 1.1) {
    const e = easeOutBack(Math.min(1, (k - 1.1) / 0.7));
    F.front.rotation.x = e * 0.62;
    F.front.position.y = F.front.userData.y0 ?? (F.front.userData.y0 = F.front.position.y);
  }
  if (prev < 1.9 && k >= 1.9) emit({ kind: 'sparkle', at: at(F.plaque) });
  if (k >= 1.9) F.front.scale.setScalar(Math.max(0.001, 1 - (k - 1.9) / 0.55));
  if (k > 2.6) { L.state = 'open'; L.group.visible = false; emit({ kind: 'done', at: at(F.plaque) }); }
}
