// Moving boxes: scuffed voxel cardboard with packing tape, folded flaps and a hand-written label
// ("PIP'S STUFF", "FRAGILE", "COZY"...). Tap one and it wobbles, the tape rips off, the flaps burst
// open in a puff of dust and sparkles, and then it folds itself away.
import * as THREE from 'three';
import { box, buildRig, type BoneSpec, type Painter, type Texel } from '../../gfx/box.ts';
import { ramp, tone } from '../../gfx/color.ts';
import { lvl, R } from '../../gfx/mats.ts';
import { fbm, hash } from '../../gfx/noise.ts';

/** 3x5 capitals for box labels */
const G: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'], G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'], M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'], "'": ['.#.', '.#.', '...', '...', '...'], ' ': ['...', '...', '...', '...', '...'],
};
const glyphAt = (line: string, u: number, v: number, x0: number, y0: number, px: number) => {
  const cw = 4 * px, i = Math.floor((u - x0) / cw);
  if (i < 0 || i >= line.length) return false;
  const g = G[line[i]]; if (!g) return false;
  const gx = Math.floor((u - x0 - i * cw) / px), gy = 4 - Math.floor((v - y0) / px);
  return gx >= 0 && gx < 3 && gy >= 0 && gy < 5 && g[gy][gx] === '#';
};
/** split a label into at most two short lines */
export function labelLines(s: string): string[] {
  if (s.length <= 7) return [s];
  const sp = s.indexOf(' ');
  return sp > 0 ? [s.slice(0, sp), s.slice(sp + 1)] : [s.slice(0, 7), s.slice(7)];
}

export interface BoxModel {
  root: THREE.Group;
  bones: Record<string, THREE.Group>;
  dispose(): void;
}

const W = 18, H = 14, D = 16;
export function buildMovingBox(label: string, tint: string, seed: number): BoxModel {
  const card = R(tint), tape = ramp(0xe8c882), ink = ramp(0x3a2a1c), red = ramp(0xc8402e);
  const lines = labelLines(label);
  const fragile = label === 'FRAGILE';
  const cardboard = (inside = false): Painter => (t: Texel) => {
    let L = lvl(t, { noise: 0.25, speck: 0.3 }) * 0.7 + (inside ? -1.6 : 0);
    // corrugation on the cut edges, scuffs and a darker crease near the corners
    if (!inside && (t.face === 4 || t.face === 5 || t.face < 2)) {
      if (fbm(t.x / 3, t.y / 3, t.z / 3, seed) > 0.68) L -= 0.7;
      if (hash(Math.floor(t.x * 2), Math.floor(t.y * 2), Math.floor(t.z * 2), seed) > 0.985) L -= 1.2;
    }
    if (t.face === 2 || t.face === 3) L += Math.floor(t.x * 2) % 2 ? 0.15 : -0.15;
    return tone(card, L);
  };
  const front: Painter = (t) => {
    const base = cardboard()(t);
    if (t.face !== 4) return base;
    const u = t.bx, v = t.by;
    // a white sticker with a ruled edge and the label in marker
    const lw = 15, lh = lines.length > 1 ? 9 : 6, lx = (W - lw) / 2, ly = 3;
    if (u > lx && u < lx + lw && v > ly && v < ly + lh) {
      const px = 0.5;
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i], tw = ln.length * 4 * px - px;
        if (glyphAt(ln, u, v, (W - tw) / 2, ly + lh - 1 - (i + 1) * 3.6 + 0.6, px)) return tone(fragile ? red : ink, -0.2);
      }
      const edge = u < lx + 0.6 || u > lx + lw - 0.6 || v < ly + 0.6 || v > ly + lh - 0.6;
      return tone(ramp(0xf6f0e0), edge ? -0.9 : lvl(t, { noise: 0.15 }) * 0.3 + 0.4);
    }
    // "this side up" arrows on fragile boxes, a stamped star on the others
    if (fragile && v > 10 && v < 13 && (Math.abs(u - 3) < 1.6 - (v - 10) * 0.5 || Math.abs(u - 15) < 1.6 - (v - 10) * 0.5)) return tone(red, 0);
    if (!fragile && Math.hypot(u - 15, v - 11.2) < 1.6 && (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0) return tone(ink, 0.2);
    return base;
  };
  const tapeP: Painter = (t) => tone(tape, lvl(t, { noise: 0.15, speck: 0 }) * 0.5 + 0.6 + (Math.floor(t.x * 4 + t.z * 4) % 5 === 0 ? 0.6 : 0) + (hash(Math.floor(t.x * 3), Math.floor(t.y * 3), Math.floor(t.z * 3), seed) > 0.9 ? -0.5 : 0));
  const inner = cardboard(true), cb = cardboard();
  const bones: BoneSpec[] = [
    {
      name: 'body', pivot: [0, 0, 0], boxes: [
        box(0, 0, 0, W, 1, D, cb), box(0, 1, D / 2 - 0.5, W, H - 1, 1, front), box(0, 1, -D / 2 + 0.5, W, H - 1, 1, cb),
        box(-W / 2 + 0.5, 1, 0, 1, H - 1, D - 2, cb), box(W / 2 - 0.5, 1, 0, 1, H - 1, D - 2, cb),
        box(0, 1, 0, W - 2, H - 3, D - 2, inner),
        // tape running down the front and back
        box(0, H - 6, D / 2 + 0.05, 3, 6, 0.3, tapeP), box(0, H - 6, -D / 2 - 0.05, 3, 6, 0.3, tapeP),
      ],
    },
    // flaps hinge on the top edges: front/back along x, sides along z
    { name: 'flapF', pivot: [0, H, D / 2], boxes: [box(0, H, D / 4, W, 0.8, D / 2, cb)] },
    { name: 'flapB', pivot: [0, H, -D / 2], boxes: [box(0, H, -D / 4, W, 0.8, D / 2, cb)] },
    { name: 'flapL', pivot: [-W / 2, H + 0.8, 0], boxes: [box(-W / 4 - 0.1, H + 0.8, 0, W / 2 - 0.2, 0.6, D - 1, cb)] },
    { name: 'flapR', pivot: [W / 2, H + 0.8, 0], boxes: [box(W / 4 + 0.1, H + 0.8, 0, W / 2 - 0.2, 0.6, D - 1, cb)] },
    { name: 'tape', pivot: [0, H + 1.4, 0], boxes: [box(0, H + 1.4, 0, 3.2, 0.35, D + 0.4, tapeP)] },
  ];
  const rig = buildRig(bones, { density: 2 });
  return { root: rig.root, bones: rig.bones, dispose: () => rig.dispose() };
}

export interface BoxAnim { t: number; burst: boolean; done: boolean }
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
  if (t >= 0.42) {
    // the tape peels up and flies off, curling
    const k = t - 0.42;
    b.tape.position.y = (14 + 1.4) / 16 + k * 2.2 - k * k * 3;
    b.tape.position.x = k * 1.4;
    b.tape.rotation.z = -k * 7;
    b.tape.rotation.x = k * 3;
    b.tape.scale.setScalar(Math.max(0.001, 1 - k * 1.2));
  }
  if (prev < 0.58 && t >= 0.58) { ev.push('burst'); a.burst = true; body.rotation.set(0, 0, 0); body.scale.set(1.12, 0.84, 1.12); }
  if (t >= 0.58) {
    const k = Math.min(1, (t - 0.58) / 0.28), o = 1 + Math.sin(k * Math.PI) * 0.25; // overshoot
    b.flapF.rotation.x = k * 2.2 * o; b.flapB.rotation.x = -k * 2.2 * o;
    b.flapL.rotation.z = k * 2.4 * o; b.flapR.rotation.z = -k * 2.4 * o;
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
  m.bones.flapF.rotation.x = c < 0.5 ? Math.sin((c / 0.5) * Math.PI) * 0.18 : 0;
}
