// Boarded-up floors: weathered planks nailed across the dollhouse cut, cobwebs in the corners, a dark
// room of dust-sheeted junk behind, and a little wooden sign swinging from chains with a brass
// padlock and the level it opens at. Unlocking pops the planks off one by one in puffs of dust.
import * as THREE from 'three';
import { box, buildRig, type BoneSpec, type BoxSpec, type Painter } from '../../gfx/box.ts';
import { ramp, tone } from '../../gfx/color.ts';
import { lvl, metal, R, wood } from '../../gfx/mats.ts';
import { fbm, hash } from '../../gfx/noise.ts';
import { ringXY } from './kit.ts';
import { FLOOR_Y, OPEN_A, R_IN, RO, ROOM_H, type FloorId } from './plan.ts';

/** 3x5 pixel digits and the letters we need, rows top to bottom */
const FONT: Record<string, string[]> = {
  L: ['#..', '#..', '#..', '#..', '###'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'], 6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
};
/** Is (u, v) on a glyph of `text` drawn with its bottom-left at (x0, y0), `px` units per font pixel? */
export function onText(text: string, u: number, v: number, x0: number, y0: number, px: number): boolean {
  const cw = 4 * px;
  const i = Math.floor((u - x0) / cw);
  if (i < 0 || i >= text.length) return false;
  const g = FONT[text[i]];
  if (!g) return false;
  const gx = Math.floor((u - x0 - i * cw) / px), gy = 4 - Math.floor((v - y0) / px);
  return gx >= 0 && gx < 3 && gy >= 0 && gy < 5 && g[gy][gx] === '#';
}

const grey = (seed: number): Painter => {
  const w = wood('#8a6f55', { axis: 'x', plank: 0, seed }), nail = ramp(0x9aa0aa);
  return (t) => {
    // nails near each end, a darker weathered streak, splintered ends
    if ((t.face === 4) && (Math.abs(t.bx - 4) < 0.8 || Math.abs(t.bx - (t.sx - 4)) < 0.8) && Math.abs(t.by - t.sy / 2) < 0.8) return tone(nail, 1);
    if (t.face === 4 && fbm(t.bx / 6, t.by / 2, seed, 3) < 0.3) return tone(R('#5e4a3a'), lvl(t, { noise: 0.3 }) * 0.5);
    return w(t);
  };
};

export interface Lock {
  fid: FloorId;
  group: THREE.Group;
  rig: ReturnType<typeof buildRig>;
  planks: THREE.Group[];
  sign: THREE.Group;
  webs: THREE.Group;
  curtain: THREE.Group;
  state: 'locked' | 'opening' | 'open';
  t: number;
  vel: THREE.Vector3[];
  spin: THREE.Vector3[];
}

export function buildLock(fid: FloorId, level: number): Lock {
  const y0 = FLOOR_Y[fid], zf = Math.cos(OPEN_A) * RO + 5;
  const bones: BoneSpec[] = [];
  const NB = 5;
  for (let i = 0; i < NB; i++) {
    const y = y0 + 9 + i * 11.4 + (hash(i, 2, 3, 1) - 0.5) * 3, len = 146 + hash(i, 4, 5, 1) * 14, rz = (hash(i, 7, 8, 1) - 0.5) * 16;
    bones.push({ name: 'p' + i, pivot: [0, y, zf + i * 0.6], boxes: [{ ...box(0, y - 4.5, zf + i * 0.6, len, 9 - (i % 2) * 1.5, 2.4, grey(i)), rot: [0, 0, rz] }] });
  }
  // the dusty room behind: dark boards and the shapes of dust-sheeted furniture
  const sheetC = ramp(0xb8b0a4), dark = ramp(0x2a1e18);
  const back: Painter = (t) => {
    if (t.face !== 4) return tone(dark, -1);
    const u = t.bx - t.sx / 2, v = t.by;
    const hump = (cx: number, w: number, h: number) => { const d = (u - cx) / w; return Math.abs(d) < 1 && v < h * (1 - d * d * 0.6); };
    if (hump(-34, 18, 30) || hump(-6, 14, 18) || hump(26, 22, 40) || hump(50, 9, 14)) {
      const fold = Math.sin(u * 0.6 + v * 0.2) * 0.5;
      return tone(sheetC, -1.6 + fold + v * 0.02 + (hash(Math.floor(u), Math.floor(v), 1, 2) - 0.5) * 0.3);
    }
    return tone(dark, lvl(t, { noise: 0.6 }) * 0.4 + (Math.floor(u / 9) % 2 ? -0.3 : 0.2) - 0.5);
  };
  bones.push({ name: 'curtain', pivot: [0, y0, 26], boxes: [box(0, y0 - 1, 26, R_IN * 2 - 14, ROOM_H, 1, back), box(-R_IN + 9, y0 - 1, 2, 2, ROOM_H, 48, back), box(R_IN - 9, y0 - 1, 2, 2, ROOM_H, 48, back)] });
  // cobwebs in the top corners of the cut
  const web: Painter = (t) => { const u = t.bx, v = t.sy - t.by; const d = Math.hypot(u, v), a = Math.atan2(v, u); return (Math.abs(d % 3.2) < 0.45 || Math.abs((a * 7) % 1) < 0.1) && d < t.sx ? 0xeeece6 : -1; };
  const webR: Painter = (t) => web({ ...t, bx: t.sx - t.bx });
  const wx = Math.sin(OPEN_A) * RO - 4;
  bones.push({ name: 'webs', pivot: [0, y0 + ROOM_H, zf + 4], boxes: [box(-wx + 9, y0 + ROOM_H - 18, zf + 4, 18, 18, 0.3, web, { cut: true }), box(wx - 9, y0 + ROOM_H - 16, zf + 4, 16, 16, 0.3, webR, { cut: true }), box(-wx + 6, y0 + 2, zf + 4, 12, 10, 0.3, webR, { cut: true })] });
  // the sign: chains, a board with "LV n" burnt in, and a brass padlock on top
  const lv = 'LV' + level;
  const board: Painter = (t) => {
    if (t.face === 4) {
      const tw = lv.length * 8 - 2;
      if (onText(lv, t.bx, t.by, (t.sx - tw) / 2, 3, 2)) return tone(ramp(0x3a2214), -0.5);
      if (t.bx < 1 || t.by < 1 || t.bx > t.sx - 1 || t.by > t.sy - 1) return tone(ramp(0x6a4428), 0);
    }
    return wood('#b07a44', { axis: 'x', plank: 5, seed: 9 })(t);
  };
  const sy = y0 + ROOM_H - 30, sz = zf + 7;
  const chain = metal('#6b6f7a'), brass = metal('#e0b040');
  const signBoxes: BoxSpec[] = [
    box(0, sy, sz, 32, 16, 2, board),
    box(-12, sy + 16, sz, 0.8, ROOM_H - 14, 0.8, chain), box(12, sy + 16, sz, 0.8, ROOM_H - 14, 0.8, chain),
    box(0, sy + 16, sz + 1.4, 7, 6, 2.4, brass), box(0, sy + 18, sz + 2.7, 1.2, 2, 0.4, metal('#3a3020')),
    ...ringXY(0, sy + 22, sz + 1.4, 3.6, 2.2, 1.4, metal('#b8b8c4'), 1).filter((b) => b.at[1] >= sy + 22),
  ];
  bones.push({ name: 'sign', pivot: [0, y0 + ROOM_H, sz], boxes: signBoxes });
  const rig = buildRig(bones);
  const group = rig.root;
  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; } });
  const planks = bones.filter((b) => b.name.startsWith('p')).map((b) => rig.bones[b.name]);
  return { fid, group, rig, planks, sign: rig.bones.sign, webs: rig.bones.webs, curtain: rig.bones.curtain, state: 'locked', t: 0, vel: planks.map(() => new THREE.Vector3()), spin: planks.map(() => new THREE.Vector3()) };
}

export type LockEvent = { kind: 'plank' | 'dust' | 'sparkle' | 'done' | 'sign'; at: THREE.Vector3 };

/** Advance a lock: the sign swings, and while opening the planks fly. */
export function stepLock(L: Lock, dt: number, t: number, emit: (e: LockEvent) => void) {
  if (L.state === 'open') return;
  if (L.state === 'locked') {
    L.sign.rotation.x = Math.sin(t * 1.3 + (L.fid === 'f3' ? 1.4 : 0)) * 0.05;
    L.sign.rotation.z = Math.sin(t * 0.9) * 0.03;
    return;
  }
  const prev = L.t;
  L.t += dt;
  const k = L.t;
  const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  // the sign drops first
  if (prev < 0.05 && k >= 0.05) emit({ kind: 'sign', at: world(L.sign) });
  if (k > 0.05) { const f = Math.min(1, (k - 0.05) / 0.6); L.sign.position.y -= dt * (4 + f * 30) * f; L.sign.rotation.x += dt * 3 * f; L.sign.scale.setScalar(Math.max(0.001, 1 - f)); }
  L.planks.forEach((p, i) => {
    const at = 0.35 + i * 0.2;
    if (prev < at && k >= at) {
      L.vel[i].set((hash(i, 1, 1, 7) - 0.5) * 2.4, 2.2 + hash(i, 2, 1, 7) * 1.6, 2.4 + hash(i, 3, 1, 7) * 1.4);
      L.spin[i].set((hash(i, 4, 1, 7) - 0.5) * 6, (hash(i, 5, 1, 7) - 0.5) * 3, (hash(i, 6, 1, 7) - 0.5) * 8);
      emit({ kind: 'plank', at: world(p) });
      emit({ kind: 'dust', at: world(p) });
    }
    if (k >= at) {
      const v = L.vel[i];
      v.y -= 9 * dt;
      p.position.addScaledVector(v, dt);
      p.rotation.x += L.spin[i].x * dt; p.rotation.y += L.spin[i].y * dt; p.rotation.z += L.spin[i].z * dt;
      const life = k - at;
      if (life > 0.8) p.scale.setScalar(Math.max(0.001, 1 - (life - 0.8) * 2.5));
    }
  });
  const fade = 0.35 + L.planks.length * 0.2;
  if (k > fade) {
    const f = Math.min(1, (k - fade) / 0.5);
    L.curtain.scale.y = Math.max(0.001, 1 - f);
    L.webs.scale.setScalar(Math.max(0.001, 1 - f));
    if (prev <= fade) emit({ kind: 'sparkle', at: world(L.curtain).add(new THREE.Vector3(0, 1.5, 1)) });
  }
  if (k > fade + 1.2) { L.state = 'open'; L.group.visible = false; emit({ kind: 'done', at: world(L.curtain) }); }
}
