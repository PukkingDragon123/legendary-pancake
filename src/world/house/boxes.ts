// Moving boxes: scuffed cardboard with packing tape, folded flaps and a hand-written label ("PIP'S STUFF",
// "FRAGILE", "COZY"...), one lowpix model per box (art/lowpix/house/_src/boxes.py -> house/box_<id>.glb) with
// the flaps and the tape as named nodes. Tap one and it wobbles, the tape rips off, the flaps burst open in a
// puff of dust and sparkles, and then it folds itself away.
import * as THREE from 'three';
import { loadPart } from './models.ts';

/** box size in px (the model's body) */
export const BOX_W = 18, BOX_H = 14, BOX_D = 16;

/** split a label into at most two short lines (the box art does the same) */
export function labelLines(s: string): string[] {
  if (s.length <= 7) return [s];
  const sp = s.indexOf(' ');
  return sp > 0 ? [s.slice(0, sp), s.slice(sp + 1)] : [s.slice(0, 7), s.slice(7)];
}

export interface BoxModel {
  /** the whole box (wobbles and squashes); world units */
  root: THREE.Group;
  /** flapF, flapB, flapL, flapR, tape (house px inside the model) once loaded */
  bones: Record<string, THREE.Object3D | undefined>;
  ready: Promise<void>;
  dispose(): void;
}

export function buildMovingBox(id: string): BoxModel {
  const root = new THREE.Group();
  root.name = 'movingbox';
  const m: BoxModel = { root, bones: {}, ready: Promise.resolve(), dispose: () => {} };
  m.ready = loadPart('box_' + id).then((part) => {
    if (!part) return;
    root.add(part.root);
    for (const k of ['flapF', 'flapB', 'flapL', 'flapR', 'tape']) m.bones[k] = part.nodes[k];
    for (const o of part.meshes) o.userData = { ...root.userData };
    m.dispose = () => part.dispose();
  });
  return m;
}

export interface BoxAnim { t: number; burst: boolean; done: boolean; tape0?: THREE.Vector3 }
/** One frame of the opening: returns events as they happen. */
export function stepBoxOpen(m: BoxModel, a: BoxAnim, dt: number): ('knock' | 'rip' | 'burst' | 'fold' | 'gone')[] {
  const ev: ('knock' | 'rip' | 'burst' | 'fold' | 'gone')[] = [];
  const prev = a.t;
  a.t += dt;
  const t = a.t, b = m.bones, body = m.root;
  if (prev === 0) ev.push('knock');
  // wobble, building up
  if (t < 0.5) {
    const k = t / 0.5;
    body.rotation.z = Math.sin(t * 38) * 0.12 * k;
    body.rotation.x = Math.sin(t * 31 + 1) * 0.06 * k;
    body.scale.set(1 + Math.sin(t * 40) * 0.04 * k, 1 - Math.sin(t * 40) * 0.05 * k, 1 + Math.sin(t * 40) * 0.04 * k);
  }
  if (prev < 0.42 && t >= 0.42) ev.push('rip');
  if (t >= 0.42 && b.tape) {
    // the tape peels up and flies off, curling (px)
    if (!a.tape0) a.tape0 = b.tape.position.clone();
    const k = t - 0.42;
    b.tape.position.set(a.tape0.x + k * 22, a.tape0.y + k * 35 - k * k * 48, a.tape0.z);
    b.tape.rotation.z = -k * 7;
    b.tape.rotation.x = k * 3;
    b.tape.scale.setScalar(Math.max(0.001, 1 - k * 1.2));
  }
  if (prev < 0.58 && t >= 0.58) { ev.push('burst'); a.burst = true; body.rotation.set(0, 0, 0); body.scale.set(1.12, 0.84, 1.12); }
  if (t >= 0.58) {
    const k = Math.min(1, (t - 0.58) / 0.28), o = 1 + Math.sin(k * Math.PI) * 0.25; // overshoot
    if (b.flapF) b.flapF.rotation.x = k * 2.2 * o;
    if (b.flapB) b.flapB.rotation.x = -k * 2.2 * o;
    if (b.flapL) b.flapL.rotation.z = k * 2.4 * o;
    if (b.flapR) b.flapR.rotation.z = -k * 2.4 * o;
    const s = body.scale.x + (1 - body.scale.x) * Math.min(1, dt * 10);
    body.scale.set(s, 1 - (s - 1) * 1.3, s);
  }
  if (prev < 1.5 && t >= 1.5) ev.push('fold');
  if (t >= 1.5) {
    const k = Math.min(1, (t - 1.5) / 0.4);
    body.scale.set(1 + k * 0.2, Math.max(0.001, 1 - k), 1 + k * 0.2);
  }
  if (prev < 1.95 && t >= 1.95) { ev.push('gone'); a.done = true; }
  return ev;
}

/** Idle: a little hop and shimmy every few seconds so the box asks to be opened. */
export function stepBoxIdle(m: BoxModel, t: number, phase: number) {
  const c = (t + phase) % 4.2;
  const r = m.root;
  if (c < 0.5) {
    const k = c / 0.5;
    r.position.y = Math.sin(k * Math.PI) * 0.08;
    r.rotation.z = Math.sin(k * Math.PI * 3) * 0.06 * (1 - k);
    r.scale.set(1 + Math.sin(k * Math.PI) * -0.04, 1 + Math.sin(k * Math.PI) * 0.06, 1 + Math.sin(k * Math.PI) * -0.04);
  } else { r.position.y = 0; r.rotation.z = 0; r.scale.set(1, 1, 1); }
  if (m.bones.flapF) m.bones.flapF.rotation.x = c < 0.5 ? Math.sin((c / 0.5) * Math.PI) * 0.18 : 0;
}
