// Fun things that move: a goldfish bowl, an aquarium, a toy train on its loop, a music box with a
// turning dancer, the Moth Catcher arcade cabinet, a hamster wheel and a bird feeder.
import * as THREE from 'three';
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../../gfx/box.ts';
import { tone } from '../../gfx/color.ts';
import { lamp, leaves, lvl, metal, R, rock, smooth, solid } from '../../gfx/mats.ts';
import { hash } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';
import { ball, chain, disc, drawerFace, fab, glassP, gravel, joinery, MET, part, phase, pix, pixBoxes, PX, ring8, turn, waterP, WD, wx, wy, wz } from './kit.ts';

const items: ItemDef[] = [];
const add = (d: ItemDef) => items.push(d);

// ------------------------------------------------------------------ fish

interface FishLook { len: number; body: string; belly: string; fin: string; stripe?: string }
const GOLDFISH: FishLook = { len: 4.6, body: '#f2742a', belly: '#ffc46a', fin: '#ffb070' };

/** A little fish facing +x, centred on the origin: a body part and a tail part that wags. */
function fish(name: string, key: string, f: FishLook): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  const L = f.len, H = L * 0.55, W = L * 0.36;
  const br = R(f.body), bl = R(f.belly), st = f.stripe ? R(f.stripe) : null;
  const skin: Painter = (t) => {
    const v = (t.y + H / 2) / H;
    if ((t.face === 4 || t.face === 5) && Math.abs(t.x - L * 0.28) < 0.45 && Math.abs(t.y - H * 0.12) < 0.45) return 0x1a1418;
    if ((t.face === 4 || t.face === 5) && Math.abs(t.x - L * 0.28 - 0.3) < 0.3 && Math.abs(t.y - H * 0.18 - 0.3) < 0.3) return 0xffffff;
    if (st && Math.abs(t.y - H * 0.05) < 0.4 && t.x < L * 0.2) return tone(st, 1.2);
    if (v < 0.35 || t.face === 3) return tone(bl, 0.4);
    return tone(br, (v - 0.5) * 1.4 + ((Math.floor(t.x * 2 + 64) + Math.floor(t.y * 2 + 64)) % 3 === 0 ? 0.5 : 0) + (t.face === 2 ? 0.4 : 0));
  };
  const fin = solid(f.fin, { noise: 0.1, speck: 0 });
  g.add(part('body', key + ':body', [0, 0, 0], () => [
    box(0, -H / 2, 0, L * 0.8, H, W, skin), box(L * 0.45, -H * 0.32, 0, L * 0.18, H * 0.62, W * 0.8, skin),
    box(-L * 0.05, H / 2, 0, L * 0.4, H * 0.3, 0.3, fin), box(L * 0.1, -H / 2 - 0.4, W / 2, 0.8, 0.6, 0.3, fin), box(L * 0.1, -H / 2 - 0.4, -W / 2, 0.8, 0.6, 0.3, fin),
  ]));
  g.add(part('tail', key + ':tail', [-L * 0.4, 0, 0], () => [
    { ...box(-L * 0.55, -0.2, 0, L * 0.36, H * 0.6, 0.3, fin), rot: [0, 0, 24] as Vec3, pivot: [-L * 0.4, 0, 0] as Vec3 },
    { ...box(-L * 0.55, -H * 0.4, 0, L * 0.36, H * 0.6, 0.3, fin), rot: [0, 0, -24] as Vec3, pivot: [-L * 0.4, 0, 0] as Vec3 },
  ]));
  return g;
}

/** Point a fish group along its velocity and wag its tail. */
function swim(g: THREE.Object3D | undefined, x: number, y: number, z: number, vx: number, vz: number, t: number) {
  if (!g) return;
  g.position.set(x * PX, y * PX, z * PX);
  g.rotation.y = Math.atan2(-vz, vx);
  const tail = g.getObjectByName('tail');
  if (tail) tail.rotation.y = Math.sin(t * 9) * 0.45;
}

function bubbles(n: number, key: string): THREE.Object3D[] {
  return Array.from({ length: n }, (_, i) => part('bubble' + i, key, [0, 0, 0], () => [box(0, 0, 0, 0.8, 0.8, 0.8, solid('#f4fcff', { noise: 0, speck: 0 })), box(0.3, 0.6, 0.3, 0.3, 0.3, 0.3, () => 0xffffff)]));
}
function rise(obj: THREE.Object3D, t: number, at: Vec3, height: number, spread = 0.6) {
  const ph = phase(obj);
  obj.children.forEach((c) => {
    if (!c.name.startsWith('bubble')) return;
    const i = +c.name.slice(6), k = ((t * 0.45 + i / 3 + ph) % 1 + 1) % 1;
    c.position.set((at[0] + Math.sin(t * 3 + i * 2) * spread) * PX, (at[1] + k * height) * PX, (at[2] + Math.cos(t * 2.4 + i) * spread * 0.5) * PX);
    c.scale.setScalar(0.6 + k * 0.6);
    c.visible = k < 0.96;
  });
}

// ------------------------------------------------------------------ goldfish bowl

const BOWL: [number, number, number][] = [[0, 2, 3.8], [2, 2, 5.2], [4, 2, 6.1], [6, 2, 6.4], [8, 2, 6.1], [10, 1.6, 5.3]];

add({
  id: 'goldfish_bowl', name: 'Goldfish Bowl', cat: 'fun', price: 260, rarity: 'uncommon', size: [1, 1], small: true,
  blurb: 'Home of Marmalade, who swims laps all night and has opinions about the castle.',
  build: () => {
    const out: BoxSpec[] = [];
    out.push(...disc(0, 0, 0, 5, 0.8, joinery(WD.walnut, { axis: 'x' })), ...disc(0, 0.8, 0, 4, 0.4, metal(MET.brass)));
    // the bowl: tinted glass bands with a bright lip, a water surface and a couple of painted glints
    const tint = R('#8fd8f0');
    const gl: Painter = (t) => (t.v === t.h - 1 && t.h > 1 ? tone(tint, 1.4) : tone(tint, 0.2 + (t.face === 4 ? 0.4 : 0)));
    for (const [y, h, r] of BOWL) out.push(...ring8(0, 1.2 + y, 0, r, h, 0.3, gl, { glass: true }, 10));
    out.push(...ring8(0, 12.8, 0, 4.6, 0.8, 0.8, glassP('#f4fcff'), { glass: true }, 10));
    out.push(...disc(0, 10.8, 0, 5.6, 0.2, waterP('#8fdcf4'), { glass: true, skip: 'd' }));
    out.push(box(-3.6, 6, 4.6, 0.6, 3, 0.4, solid('#ffffff', { noise: 0, speck: 0 })), box(-4.4, 4.6, 4, 0.6, 1.2, 0.4, solid('#ffffff', { noise: 0, speck: 0 })), box(-2.6, 9.6, 5, 0.6, 0.8, 0.4, solid('#ffffff', { noise: 0, speck: 0 })));
    // gravel, a little castle, a sprig of waterweed and a snail
    out.push(...disc(0, 1.4, 0, 3.6, 0.8, gravel()), ...disc(0, 2.2, 0, 5, 0.8, gravel(undefined, 2)));
    const st = rock('#b8b0c8', { seed: 4 });
    const crenel: Painter = (t) => (t.face !== 2 && t.face !== 3 && t.v === t.h - 1 && t.u % 2 === 1 ? -1 : st(t));
    out.push(box(-2.6, 3, -2.2, 2.6, 3.4, 2.6, st), box(-2.6, 6.4, -2.2, 3, 1, 3, crenel, { cut: true }), box(-2.6, 3, -0.85, 1, 1.6, 0.2, solid('#3a2a40', { noise: 0 })));
    out.push(box(-1.4, 3, -3.2, 1.4, 5.2, 1.4, st), box(-1.4, 8.2, -3.2, 1.8, 0.8, 1.8, metal('#d8433f')), box(-1.4, 9, -3.2, 0.3, 1.6, 0.3, metal(MET.iron)), box(-0.9, 10, -3.2, 1, 0.6, 0.2, smooth('#f2c84a')));
    out.push(...chain([[3.4, 3, -2.6], [3.8, 6, -2.2], [3, 9, -2.8]], 0.6, leaves('#3faa6a', { seed: 1 }), { sway: 0.2 }), box(4, 5.6, -2.4, 1.4, 0.8, 0.4, leaves('#4ab87a', { seed: 2 })), box(2.6, 7.6, -2.8, 1.4, 0.8, 0.4, leaves('#4ab87a', { seed: 3 })));
    out.push(box(2.4, 3, 2.6, 1.4, 1, 1, smooth('#e8c070')), box(2.2, 3.4, 2.6, 1, 1.2, 1, (t) => tone(R('#a8704a'), (t.u + t.v) % 2 ? 0.6 : -0.4)));
    return out;
  },
  parts: () => [fish('fish', 'goldfish', GOLDFISH), ...bubbles(3, 'bowl_bubble')],
  animate: (obj, t) => {
    const k = t * 0.9 + phase(obj), r = 2.4;
    swim(obj.getObjectByName('fish'), 0.8 + Math.cos(k) * r, 7 + Math.sin(t * 1.3) * 1.2, 0.8 + Math.sin(k) * r, -Math.sin(k), Math.cos(k), t);
    rise(obj, t, [-1.4, 9.4, -3.2], 1.6, 0.2);
  },
});

// ------------------------------------------------------------------ aquarium

const TETRA: FishLook = { len: 3, body: '#4a8ae8', belly: '#e84a4a', fin: '#c8e0ff', stripe: '#8af0ff' };
const PLATY: FishLook = { len: 3.6, body: '#f2a83a', belly: '#ffe08a', fin: '#f8c060' };
const ANGEL: FishLook = { len: 4.2, body: '#e8e0d0', belly: '#f6f0e4', fin: '#f6f0e4', stripe: '#3a3040' };

add({
  id: 'aquarium', name: 'Planted Aquarium', cat: 'fun', price: 0, gems: 80, rarity: 'epic', size: [2, 1],
  blurb: 'A whole river in a box: tetras, a platy, an angelfish and a sunken treasure chest.',
  light: { x: 0, y: 30, z: 0, color: 0x9fe0ff, power: 1.2 },
  build: () => {
    const out: BoxSpec[] = [];
    const c = WD.walnut;
    // the cabinet
    out.push(box(0, 0, 0, 31, 1.4, 13, joinery(WD.dark, { axis: 'x' })), box(0, 1.4, 0, 30, 10, 12, joinery(c, { axis: 'y' })));
    for (const x of [-7.4, 7.4]) out.push(box(x, 2, 6.1, 14, 8.6, 0.6, drawerFace(c, { pull: MET.brass })));
    out.push(box(0, 11.4, 0, 31, 1.2, 13, joinery(c, { axis: 'x' })));
    // the tank: painted backdrop, glass, a frame and a lit hood
    const y0 = 12.6, H = 15, Wd = 28, D = 10;
    const back: Painter = (t) => {
      if (t.face !== 4) return solid('#2a3a4a')(t);
      const v = t.v / t.h, u = t.u;
      const reed = Math.abs(Math.sin(u * 0.9) * 2 + Math.sin(u * 0.37) * 3) * 0.08 + 0.25 > v - 0.1 && hash(u, 3, 3) > 0.35;
      if (reed) return tone(R('#2f6a4a'), -0.4 + v);
      return tone(R('#4a9ac8'), v * 2 - 1.2 + (hash(u, t.v, 2) > 0.97 ? 1 : 0));
    };
    out.push(box(0, y0, -D / 2, Wd, H, 0.6, back));
    const gl = glassP('#d8f4fa');
    out.push(box(0, y0, D / 2, Wd, H, 0.3, gl, { glass: true }), box(-Wd / 2, y0, 0, 0.3, H, D, gl, { glass: true }), box(Wd / 2, y0, 0, 0.3, H, D, gl, { glass: true }));
    out.push(box(0, y0 + 0.6, 0, Wd - 0.6, H - 2.4, D - 0.8, glassP('#58bce0'), { glass: true }));
    const fr = metal('#3a3a44');
    for (const [x, z] of [[-Wd / 2, -D / 2], [Wd / 2, -D / 2], [-Wd / 2, D / 2], [Wd / 2, D / 2]]) out.push(box(x, y0, z, 1, H, 1, fr));
    for (const y of [y0, y0 + H - 0.6]) out.push(box(0, y, D / 2, Wd + 1, 1, 1, fr), box(0, y, -D / 2, Wd + 1, 1, 1, fr), box(-Wd / 2, y, 0, 1, 1, D, fr), box(Wd / 2, y, 0, 1, 1, D, fr));
    out.push(box(0, y0 + H + 0.4, 0, Wd + 1.6, 2, D + 1.6, solid('#2a2a34', { noise: 0.2 })), box(0, y0 + H + 0.2, 0, Wd - 2, 0.4, D - 2, lamp('#e8f8ff'), { glow: true }));
    // substrate, rocks, driftwood, plants and a treasure chest
    out.push(box(0, y0 + 0.4, 0, Wd - 0.8, 2, D - 0.8, gravel(['#d8c8a0', '#b8a888', '#8a7a6a', '#e8dcc0'], 4)));
    out.push(box(-8, y0 + 2.4, -2, 5, 3, 3.6, rock('#8a8a98', { seed: 3, moss: '#4a8a4a' })), box(-5.6, y0 + 2.4, -2.6, 3, 2, 2.4, rock('#9a9aa8', { seed: 5 })));
    out.push(...chain([[2, y0 + 2.4, -2], [5, y0 + 4.4, -1.4], [9, y0 + 7, -2.2], [10.4, y0 + 9.6, -2.6]], 1.4, wz(WD.drift, 0)));
    const weed = (x: number, z: number, h: number, c: string, seed: number) => {
      const lf = leaves(c, { seed });
      return Array.from({ length: Math.ceil(h / 2) }, (_, i) => box(x + Math.sin(i * 1.3 + seed) * 0.6, y0 + 2.4 + i * 2, z, 1.4 - i * 0.08, 2.2, 1.2, lf, { sway: 0.3 }));
    };
    out.push(...weed(-12, -3, 11, '#3faa5a', 1), ...weed(-10.6, -1.8, 8, '#4ab86a', 2), ...weed(12, -3, 10, '#3faa5a', 3), ...weed(6, -3.4, 7, '#c8503a', 4), ...weed(7.4, -2.6, 9, '#d8603a', 5), ...weed(-2, -3.6, 6, '#5ac86a', 6));
    out.push(box(1, y0 + 2.4, 2, 3.4, 2, 2.2, wx(WD.dark, 0)), { ...box(1, y0 + 4.4, 1, 3.4, 0.8, 2.2, wx(WD.oak, 0)), rot: [-40, 0, 0] as Vec3, pivot: [1, y0 + 4.4, 0.9] as Vec3 }, box(1, y0 + 4, 2, 2.4, 0.6, 1.6, metal(MET.gold)));
    out.push(box(11, y0 + 2.4, 3, 1.2, 1, 1.2, solid('#3a3a44')));
    return out;
  },
  parts: () => [fish('fishA', 'tetra', TETRA), fish('fishB', 'tetra', TETRA), fish('fishC', 'platy', PLATY), fish('fishD', 'angel', ANGEL), ...bubbles(4, 'tank_bubble')],
  animate: (obj, t) => {
    const ph = phase(obj);
    const lanes: [string, number, number, number, number][] = [['fishA', 0.7, 20, 0.5, 0], ['fishB', 0.75, 22, 1.5, 0.8], ['fishC', 0.45, 16, -1, 2.2], ['fishD', 0.3, 13, 2.5, 4]];
    for (const [n, sp, y, z, off] of lanes) {
      const k = t * sp + ph + off, x = Math.sin(k) * 10.5, vx = Math.cos(k);
      swim(obj.getObjectByName(n), x, y + Math.sin(t * 1.7 + off) * 1.2, z + Math.sin(k * 2) * 0.8, vx, Math.cos(k * 2) * 0.3, t + off);
    }
    rise(obj, t, [11, 15.4, 3], 11, 0.4);
  },
});

// ------------------------------------------------------------------ toy train

const TA = 17, TB = 9.5, TY = 2.2;
add({
  id: 'toy_train', name: 'Clockwork Train Loop', cat: 'fun', price: 0, gems: 60, rarity: 'epic', size: [3, 2],
  blurb: 'A tiny engine, a coal tender and one passenger car, forever going round to Snoozeville.',
  build: () => {
    const out: BoxSpec[] = [];
    const felt: Painter = (t) => {
      if (t.face !== 2) return joinery(WD.oak, { axis: 'x' })(t);
      const ex = t.x / (TA + 2.4), ez = t.z / (TB + 2.4), e = Math.hypot(ex, ez);
      if (e < 0.78 && Math.abs(t.z) < 1.2) return tone(R('#b8a888'), (Math.floor(t.x + 64) % 3 === 0 ? 0.6 : 0) - 0.2);
      return tone(R('#6aa84a'), (hash(Math.floor(t.x), Math.floor(t.z), 3) - 0.5) * 0.9 + (e > 1.12 && e < 1.2 ? -0.6 : 0));
    };
    out.push(box(0, 0, 0, 44, 1.6, 28, felt));
    // the oval track: sleepers and two rails
    const N = 36;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, x = Math.cos(a) * TA, z = Math.sin(a) * TB, yaw = (Math.atan2(-TB * Math.cos(a), -TA * Math.sin(a)) * 180) / Math.PI;
      out.push({ ...box(x, 1.6, z, 1, 0.5, 4.2, wz(WD.dark, 0)), rot: [0, yaw, 0] as Vec3 });
    }
    for (const off of [-1.4, 1.4]) {
      const pts: Vec3[] = Array.from({ length: N + 1 }, (_, i) => { const a = (i / N) * Math.PI * 2; return [Math.cos(a) * (TA + off), 2.3, Math.sin(a) * (TB + off)] as Vec3; });
      out.push(...chain(pts, 0.5, metal(MET.silver)));
    }
    // a mountain tunnel at the back, a little station at the front, trees and a signal
    const rk = rock('#9a8e84', { seed: 6, moss: '#6aa84a' });
    out.push(box(-6, 1.6, -TB, 3, 7, 8, rk), box(6, 1.6, -TB, 3, 7, 8, rk), box(0, 7.6, -TB, 15, 3, 8.4, rk), box(0, 10.6, -TB, 11, 2.4, 6, rk), box(0, 13, -TB, 6, 1.6, 4, leaves('#5a9a45', { seed: 2, bloom: '#f6f0d8', rate: 0.06 })));
    out.push(box(-4.4, 1.6, -TB + 4.2, 0.4, 6, 0.4, solid('#2a2420')), box(0, 7, -TB + 4.2, 9.2, 0.6, 0.4, solid('#2a2420')));
    out.push(box(-4, 1.6, TB + 5.6, 9, 0.8, 3.6, wx(WD.light, 0)), box(-4, 2.4, TB + 6.6, 7, 4, 1.6, joinery('#e8d6b0', { axis: 'x' })), { ...box(-4, 6.4, TB + 6, 9, 0.8, 4, wx('#c84a3a', 2)), rot: [12, 0, 0] as Vec3 });
    out.push(box(-4, 3.4, TB + 7.5, 2, 2, 0.2, lamp('#ffe0a0'), { glow: true }), box(-6.6, 3.4, TB + 7.5, 1.4, 1.4, 0.2, lamp('#ffe0a0'), { glow: true }));
    for (const [x, z, s] of [[-19, -11, 1], [19, 11, 0.8], [18, -10, 1.1], [-19, 10, 0.7]] as const) {
      const lf = leaves('#3f7a45', { seed: x });
      out.push(box(x, 1.6, z, 1, 2 * s, 1, solid('#6a4630')), box(x, 3.4 * s, z, 4 * s, 2.4 * s, 4 * s, lf), box(x, 5.6 * s, z, 3 * s, 2 * s, 3 * s, lf), box(x, 7.4 * s, z, 1.8 * s, 1.6 * s, 1.8 * s, lf));
    }
    out.push(box(TA + 3.4, 1.6, 2, 0.6, 7, 0.6, metal(MET.iron)), box(TA + 3.4, 8.6, 2, 1.6, 2.6, 1, solid('#2a2420')), box(TA + 3.4, 9.8, 2.6, 0.8, 0.8, 0.2, lamp('#7aff7a'), { glow: true }), box(TA + 3.4, 8.8, 2.6, 0.8, 0.8, 0.2, solid('#5a1a1a')));
    return out;
  },
  parts: () => {
    const red = smooth('#d8433f'), blk = solid('#2a2a34', { noise: 0.2 }), gold = metal(MET.gold);
    const wheels = (len: number): BoxSpec[] => [-len / 3, len / 3].flatMap((x) => [box(x, 0, 1.7, 1.8, 1.8, 0.5, metal('#3a3a44')), box(x, 0, -1.7, 1.8, 1.8, 0.5, metal('#3a3a44')), box(x, 0.6, 2, 0.6, 0.6, 0.2, red), box(x, 0.6, -2, 0.6, 0.6, 0.2, red)]);
    const engine = part('car0', 'train_engine', [0, 0, 0], () => [
      box(0, 0.6, 0, 8, 1, 3.4, blk), ...wheels(8),
      box(1.4, 1.6, 0, 5, 2.8, 2.8, smooth('#2f6a4a')), box(1.4, 2.4, 0, 5.2, 0.4, 3, gold), box(3.9, 1.8, 0, 0.4, 2.4, 2.4, metal(MET.iron)),
      box(2.8, 4.4, 0, 1.2, 1.8, 1.2, blk), box(2.8, 6.2, 0, 1.8, 0.6, 1.8, blk), box(0.4, 4.4, 0, 1.2, 0.8, 1.2, gold),
      box(-2.4, 1.6, 0, 3, 4, 3.4, red), box(-2.4, 5.6, 0, 3.8, 0.6, 4, blk), box(-2.4, 3.6, 1.75, 1.6, 1.4, 0.1, lamp('#ffe8a0'), { glow: true }), box(-2.4, 3.6, -1.75, 1.6, 1.4, 0.1, lamp('#ffe8a0'), { glow: true }),
      box(4.6, 0.4, 0, 1, 1, 3, red), box(4.2, 3, 0, 0.4, 0.8, 0.8, lamp('#fff2b0'), { glow: true }),
    ]);
    const tender = part('car1', 'train_tender', [0, 0, 0], () => [box(0, 0.6, 0, 4.4, 1, 3.4, blk), ...wheels(4.4), box(0, 1.6, 0, 4.2, 2.4, 3.2, red), box(0, 4, 0, 3.6, 0.8, 2.6, solid('#1a1a20', { noise: 1, scale: 0.6 })), box(0, 3.2, 1.65, 4.2, 0.4, 0.1, gold), box(0, 3.2, -1.65, 4.2, 0.4, 0.1, gold)]);
    const win: Painter = (t) => ((t.face === 4 || t.face === 5) && t.v >= 1 && t.v <= 2 && t.u % 2 === 1 && t.u < t.w - 1 ? 0xffe8a0 : tone(R('#3f6fb4'), lvl(t, { noise: 0.15 })));
    const coach = part('car2', 'train_coach', [0, 0, 0], () => [box(0, 0.6, 0, 6.4, 1, 3.4, blk), ...wheels(6.4), box(0, 1.6, 0, 6.2, 3.6, 3.2, win), box(0, 5.2, 0, 6.8, 0.6, 3.8, red), box(0, 5.8, 0, 5.6, 0.4, 2.8, red), box(0, 2.2, 1.65, 6.2, 0.4, 0.1, gold), box(0, 2.2, -1.65, 6.2, 0.4, 0.1, gold)]);
    const puff = part('puff', 'train_puff', [0, 0, 0], () => [box(0, 0, 0, 1.6, 1.6, 1.6, solid('#f6f4f0', { noise: 0.4 })), box(0.6, 0.8, 0.4, 1, 1, 1, solid('#ffffff', { noise: 0.2 }))]);
    return [engine, tender, coach, puff];
  },
  animate: (obj, t) => {
    const a0 = t * 0.55 + phase(obj);
    const spacing = [0, 0.43, 0.83];
    let eng: THREE.Object3D | undefined;
    spacing.forEach((s, k) => {
      const c = obj.getObjectByName('car' + k);
      if (!c) return;
      const a = a0 - s, x = Math.cos(a) * TA, z = Math.sin(a) * TB, vx = -Math.sin(a) * TA, vz = Math.cos(a) * TB;
      c.position.set(x * PX, TY * PX, z * PX);
      c.rotation.y = Math.atan2(-vz, vx);
      c.position.y += Math.abs(Math.sin(t * 14 + k)) * 0.15 * PX;
      if (k === 0) eng = c;
    });
    const p = obj.getObjectByName('puff');
    if (p && eng) {
      const k = (t * 1.2) % 1, e = eng as THREE.Object3D;
      const fx = Math.cos(e.rotation.y) * 2.8, fz = -Math.sin(e.rotation.y) * 2.8;
      p.position.set(e.position.x + (fx - Math.cos(e.rotation.y) * k * 3) * PX, e.position.y + (6.6 + k * 5) * PX, e.position.z + (fz + Math.sin(e.rotation.y) * k * 3) * PX);
      p.scale.setScalar(0.5 + k * 1.1);
      p.visible = k < 0.9;
    }
  },
});

// ------------------------------------------------------------------ rocking horse

add({
  id: 'rocking_horse', name: 'Dapple Rocking Horse', cat: 'fun', price: 440, rarity: 'rare', size: [2, 1],
  blurb: 'Clip-clop, clip-clop. Named Biscuit. Has been to the moon (allegedly).',
  sit: [{ x: 0, y: 15, z: 0, rot: 90 }],
  build: () => {
    const out: BoxSpec[] = [];
    // curved red rockers with gold tips
    for (const z of [-3.4, 3.4]) {
      const pts: Vec3[] = Array.from({ length: 9 }, (_, i) => { const a = -0.55 + (i / 8) * 1.1; return [Math.sin(a) * 30, 30 - Math.cos(a) * 30 + 0.8, z] as Vec3; });
      out.push(...chain(pts, 1.6, wx('#c8403a', 0)), box(-15.6, 5, z, 1.6, 1.6, 1.8, metal(MET.gold)), box(15.6, 5, z, 1.6, 1.6, 1.8, metal(MET.gold)));
    }
    out.push(box(0, 1.6, 0, 18, 1, 7.6, wx('#c8403a', 0)));
    const dapple: Painter = (t) => {
      const sp = hash(Math.floor((t.x + 64) / 1.8), Math.floor((t.y + 64) / 1.8), Math.floor((t.z + 64) / 1.8), 3) > 0.7;
      return tone(R(sp ? '#c8ccd8' : '#f0f0f4'), lvl(t, { noise: 0.25, rim: 0.8 }) + (sp ? -0.3 : 0.2));
    };
    // legs splayed out like a galloping toy, a body, neck and head
    for (const [x, z, a] of [[-6, -2, -16], [6, -2, 16], [-6, 2, -16], [6, 2, 16]] as const) out.push(lean(box(x, 2.6, z, 2, 7, 2, dapple), 0, 0, -a), lean(box(x + (a > 0 ? 1.8 : -1.8), 2.6, z, 2.4, 1.2, 2.4, solid('#3a3038', { noise: 0.2 })), 0, 0, -a));
    out.push(box(0, 9, 0, 14, 6, 6, dapple), box(-1, 14.6, 0, 6, 0.8, 6.4, fab('#8a3a2a', { stitch: '#f2c84a' })), box(-1, 15.4, 0, 4, 0.8, 5, fab('#a84a3a')));
    out.push(box(-1, 9.4, 3.2, 3.4, 4, 0.4, fab('#3f6fb4', { pipe: '#f2c84a' })), box(-1, 9.4, -3.2, 3.4, 4, 0.4, fab('#3f6fb4', { pipe: '#f2c84a' })));
    out.push({ ...box(7.4, 12, 0, 4.6, 8, 4, dapple), rot: [0, 0, -24] as Vec3 }, box(10.6, 17.4, 0, 6.4, 3.8, 3.8, dapple), box(13.6, 17.2, 0, 1.6, 3, 3.4, dapple));
    out.push(box(14.2, 17.8, 0, 0.6, 0.6, 3.6, solid('#3a3038', { noise: 0 })), box(10.6, 19.8, 1.95, 1, 1, 0.2, solid('#1a1418', { noise: 0 })), box(10.6, 19.8, -1.95, 1, 1, 0.2, solid('#1a1418', { noise: 0 })));
    out.push(box(9, 21.2, 1.2, 1, 2, 0.8, dapple), box(9, 21.2, -1.2, 1, 2, 0.8, dapple));
    // yarn mane and tail, reins and a wooden handle
    const yarn = fab('#d8a24a', { weave: 0.5 });
    for (let i = 0; i < 6; i++) out.push({ ...box(7.6 - i * 0.6, 12 + i * 1.6, 0, 1.6, 2.4, 1.2, yarn), rot: [0, 0, -30] as Vec3 });
    out.push({ ...box(-8, 9, 0, 2, 7, 1.6, yarn), rot: [0, 0, 30] as Vec3, pivot: [-7, 13, 0] as Vec3 });
    out.push(box(10.6, 18.6, 0, 1, 1, 5.4, wz(WD.light, 0)), box(10.6, 18.6, 2.9, 1.4, 1.4, 0.6, metal(MET.gold)), box(10.6, 18.6, -2.9, 1.4, 1.4, 0.6, metal(MET.gold)));
    out.push(...chain([[13, 16.4, 2], [6, 15, 2.8], [3, 15.6, 2.4]], 0.4, solid('#6a2a1a', { noise: 0 })));
    return out;
  },
});

// ------------------------------------------------------------------ music box

add({
  id: 'music_box', name: 'Owlet Music Box', cat: 'fun', price: 420, rarity: 'rare', size: [1, 1], small: true,
  blurb: 'Wind the crank and a tiny owlet pirouettes to a lullaby only you can hear.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = WD.cherry;
    const inlay: Painter = (t) => {
      const base = joinery(c, { axis: 'x' })(t);
      if (t.face !== 2 && t.face !== 4 && t.face !== 3) return base;
      if (t.face === 4) return t.v === 1 && t.u % 3 === 1 ? tone(R(MET.gold), 1) : base;
      return base;
    };
    out.push(box(0, 0, 0, 14, 0.8, 10, joinery(WD.walnut, { axis: 'x' })), box(0, 0.8, 0, 13, 5.4, 9, inlay));
    out.push(box(0, 6.2, 0, 13.4, 0.2, 9.4, metal(MET.gold)));
    out.push(box(0, 5.6, 0, 11.4, 0.8, 7.4, fab('#8a1a3a', { tuft: 3 })));
    // the lid, open, with a little mirror inside and a star inlay outside
    const lidIn: Painter = (t) => {
      if (t.face !== 3) return joinery(c, { axis: 'x' })(t);
      const u = (t.u + 0.5) / t.w - 0.5, v = (t.v + 0.5) / t.h - 0.5;
      if (Math.abs(u) < 0.36 && Math.abs(v) < 0.34) return Math.abs(u - v + 0.1) < 0.05 ? 0xffffff : tone(R('#b8d4e0'), 0.6 + v);
      return tone(R('#8a1a3a'), lvl(t, { noise: 0.2 }));
    };
    out.push({ ...box(0, 6.2, -4.5, 13, 1.2, 9, lidIn), rot: [-100, 0, 0] as Vec3, pivot: [0, 6.4, -4.5] as Vec3 });
    out.push({ ...box(0, 7.4, -4.5, 3, 0.2, 3, metal(MET.gold)), at: [-1.5, 7.4, -2.5] as Vec3, rot: [-100, 0, 0] as Vec3, pivot: [0, 6.4, -4.5] as Vec3 });
    // a glass window over the comb and pin cylinder
    out.push(box(3.6, 6.2, 2, 4, 0.3, 3, glassP('#f4fbff'), { glass: true }), box(3.6, 5.4, 2.2, 3, 0.8, 0.8, metal(MET.brass)), box(3.6, 5.2, 1, 3.2, 0.4, 1, metal(MET.silver)));
    out.push(...disc(-1.4, 6.4, 1, 1.8, 0.6, metal(MET.gold)));
    return out;
  },
  parts: () => [
    part('dancer', 'music_dancer', [-1.4, 7, 1], () => {
      const x = -1.4, z = 1, wh = smooth('#f6f0f8'), tutu = fab('#f2a7c8', { weave: 0.2 });
      return [box(x, 7, z, 0.6, 1.4, 0.6, wh), ...ring8(x, 8.2, z, 1.8, 0.8, 0.6, tutu, {}, 8), box(x, 8.2, z, 2, 2.4, 1.8, wh), box(x, 10.6, z, 2.2, 2, 2, wh),
        box(x - 0.6, 11.6, z + 1, 0.6, 0.6, 0.2, solid('#1a1418', { noise: 0 })), box(x + 0.6, 11.6, z + 1, 0.6, 0.6, 0.2, solid('#1a1418', { noise: 0 })), box(x, 11.2, z + 1.05, 0.5, 0.5, 0.3, smooth('#f2b632')),
        box(x - 0.8, 12.6, z, 0.5, 0.8, 0.5, wh), box(x + 0.8, 12.6, z, 0.5, 0.8, 0.5, wh), { ...box(x - 1.6, 10.6, z, 0.6, 2.4, 1.2, wh), rot: [0, 0, 40] as Vec3 }, { ...box(x + 1.6, 10.6, z, 0.6, 2.4, 1.2, wh), rot: [0, 0, -40] as Vec3 }, box(x, 13.2, z, 0.8, 0.8, 0.8, metal(MET.gold))];
    }),
    part('crank', 'music_crank', [6.6, 3.4, 0], () => [box(7, 3, 0, 1, 0.8, 0.8, metal(MET.brass)), box(7.4, 3.4, 0, 0.5, 3, 0.5, metal(MET.brass)), box(8, 5.6, 0, 1.4, 0.8, 0.8, wx(WD.light, 0))]),
  ],
  animate: (obj, t) => {
    const ph = phase(obj), d = obj.getObjectByName('dancer'), c = obj.getObjectByName('crank');
    if (d) { d.rotation.y = t * 1.6 + ph; d.position.y = ((d.userData.home as THREE.Vector3)?.y ?? 0) + Math.abs(Math.sin(t * 3.2)) * 0.3 * PX; }
    if (c) c.rotation.x = -t * 2;
  },
});

// ------------------------------------------------------------------ moth catcher arcade

const MOTH_TITLE = [
  'x.x.xxx.xxx.x.x',
  'xxx.x.x..x..x.x',
  'xxx.x.x..x..xxx',
  'x.x.x.x..x..x.x',
  'x.x.xxx..x..x.x',
];

add({
  id: 'moth_arcade', name: 'Moth Catcher Arcade', cat: 'fun', price: 0, gems: 150, rarity: 'legendary', size: [1, 1],
  blurb: 'Catch the moths before they reach the lamp! Pip’s high score is 4,210. Nobody believes it.',
  light: { x: 0, y: 22, z: 6, color: 0xb88aff, power: 1.4 },
  build: () => {
    const out: BoxSpec[] = [];
    const side: Painter = (t) => {
      if (t.face === 0 || t.face === 1) {
        const k = hash(Math.floor(t.bz / 1.5), Math.floor(t.by / 1.5), 7);
        if (k > 0.93) return 0xfff2b0;
        if (t.by < 10 + Math.sin(t.bz * 0.6) * 1.4) return tone(R('#3a2a6a'), -0.4);
        if (t.u === 0 || t.u === t.w - 1 || t.v === t.h - 1) return tone(R('#f2c84a'), 0.4);
        return tone(R('#5a3aa8'), (t.by / t.sy) * 1.2 - 0.6 + lvl(t, { noise: 0.2, rim: 0 }) * 0.4);
      }
      return tone(R('#2a1a4a'), lvl(t, { noise: 0.2 }));
    };
    const W = 16;
    out.push(box(0, 0, 0, W, 2, 12, solid('#1a1a24', { noise: 0.2 })));
    for (const s of [-1, 1]) out.push(box(s * (W / 2 - 0.6), 0, 0, 1.2, 38, 12, side));
    out.push(box(0, 2, -3, W - 2.4, 34, 6, solid('#2a1a4a', { noise: 0.2 })), box(0, 2, 4, W - 2.4, 11, 4, joinery('#3a2a6a', { axis: 'x' })));
    // coin door with a glowing slot
    out.push(box(0, 3.6, 6.1, 6, 6, 0.4, solid('#24242c', { noise: 0.2 })), box(-1.2, 7, 6.4, 0.6, 1.6, 0.2, lamp('#ff6a5a'), { glow: true }), box(1.2, 7, 6.4, 0.6, 1.6, 0.2, lamp('#ff6a5a'), { glow: true }), box(0, 4.6, 6.4, 2.4, 0.6, 0.2, metal(MET.silver)));
    // control deck: joystick and two buttons
    out.push({ ...box(0, 13, 4.4, W - 2.4, 1.2, 6, solid('#24242c', { noise: 0.2 })), rot: [12, 0, 0] as Vec3 });
    out.push(box(-3.4, 14.2, 4.8, 1.4, 1, 1.4, solid('#1a1a20')), box(-3.4, 15.2, 4.8, 0.5, 2, 0.5, metal(MET.silver)), ...ball(-3.4, 16.8, 4.8, 1, smooth('#e83a3a')));
    // the screen inside a bezel
    const screen: Painter = (t) => {
      const u = t.u, v = t.v, w = t.w, h = t.h;
      if (t.face !== 4) return 0x101018;
      if (Math.hypot(u - w * 0.78, v - h * 0.8) < 1.6) return 0xfff2c0;
      if (Math.abs(u - w * 0.5) < 0.6 && v < h * 0.42) return 0x6a6a7a;
      if (Math.abs(u - w * 0.5) < 1.6 && v >= h * 0.42 && v < h * 0.42 + 2) return 0xffd060;
      if (v < 2) return 0x2a5a3a;
      if (v === h - 1 && u > 1 && u < 9 && u % 2 === 0) return 0x8affb0;
      if (hash(u, v, 9) > 0.95) return 0xc8c8ff;
      const glow = Math.max(0, 1 - Math.hypot(u - w * 0.5, v - h * 0.48) / 6);
      return tone(R('#2a2a6a'), -0.6 + glow * 2.4);
    };
    out.push(box(0, 15.6, 0.4, W - 2.4, 14, 1, solid('#1a1a20', { noise: 0.1 })), box(0, 16.6, 0.9, W - 4.4, 11.4, 0.4, screen, { glow: true }));
    // glowing marquee with the title and a moth on each side
    const title = pix(['.'.repeat(17), ...MOTH_TITLE.map((r) => '.' + r + '.'), '.'.repeat(17)], { x: 0xfff2c0 }, (t) => tone(R('#b85ae8'), 0.8 - Math.abs((t.v + 0.5) / t.h - 0.5) * 1.6), 4);
    out.push(box(0, 30, 2, 17, 7, 1.4, title, { glow: true }), box(0, 37.4, 0, W + 0.6, 1.6, 12.6, solid('#2a1a4a', { noise: 0.2 })), box(0, 29.4, 2.4, W, 0.8, 2, metal(MET.gold)));
    return out;
  },
  parts: () => [
    part('moth', 'arcade_moth', [0, 22, 1.2], () => pixBoxes(['x.x', 'xxx', '.x.'], 0, 21, 1.2, 0.2, (ch) => lamp(ch === 'x' ? '#e8d8ff' : '#ffffff'), { glow: true })),
    part('btnA', 'arcade_btn_a', [2, 14.6, 5], () => [box(2, 14.4, 5, 1.6, 0.8, 1.6, lamp('#5ad8ff'), { glow: true })]),
    part('btnB', 'arcade_btn_b', [4.6, 14.4, 4.6], () => [box(4.6, 14.2, 4.6, 1.6, 0.8, 1.6, lamp('#ffd84a'), { glow: true })]),
  ],
  animate: (obj, t) => {
    const m = obj.getObjectByName('moth');
    const ph = phase(obj);
    if (m) {
      const k = t * 0.9 + ph;
      m.position.set(Math.sin(k) * 4 * PX, (22.4 + Math.sin(k * 2) * 3) * PX, 1.2 * PX);
      m.scale.x = 0.6 + Math.abs(Math.sin(t * 16)) * 0.6;
    }
    const a = obj.getObjectByName('btnA'), b = obj.getObjectByName('btnB');
    if (a) a.scale.y = Math.sin(t * 5 + ph) > 0.6 ? 0.5 : 1;
    if (b) b.scale.y = Math.sin(t * 4 + ph + 2) > 0.7 ? 0.5 : 1;
  },
});

// ------------------------------------------------------------------ hamster wheel

add({
  id: 'hamster_wheel', name: 'Dormouse Exercise Wheel', cat: 'fun', price: 210, rarity: 'uncommon', size: [1, 1],
  blurb: 'Clover the dormouse runs about four steps, then naps for an hour. Very relatable.',
  build: () => {
    const out: BoxSpec[] = [];
    out.push(box(0, 0, 0, 16, 1.4, 11, joinery(WD.light, { axis: 'x' })));
    for (let i = 0; i < 14; i++) out.push({ ...box(-6 + hash(i, 1, 4) * 12, 1.4, -4 + hash(i, 2, 4) * 8, 1.4, 0.3, 0.6, solid('#f2dca8', { noise: 0 })), rot: [0, hash(i, 3, 4) * 180, 0] as Vec3 });
    // stand behind the wheel
    out.push(lean(box(-2, 1.4, -4, 1.4, 12, 1.4, wy(WD.dark)), 0, 0, -12), lean(box(2, 1.4, -4, 1.4, 12, 1.4, wy(WD.dark)), 0, 0, 12), box(0, 11.4, -3.6, 2, 2, 2.4, metal(MET.brass)));
    // water bottle and a food bowl
    out.push(box(6, 1.4, -3.4, 2.4, 9, 2.4, glassP('#d8f0ff'), { glass: true }), box(6, 1.6, -3.4, 2, 6, 2, solid('#7ac8f0', { noise: 0 })), box(6, 10.4, -3.4, 2.6, 1, 2.6, metal(MET.pewter)), box(6, 0.4, -3.4, 0.6, 1.2, 0.6, metal(MET.silver)));
    out.push(...disc(5.4, 1.4, 3, 2.2, 1.2, smooth('#e86a5a')), box(5.4, 2.4, 3, 3, 0.4, 3, (t) => [0xe8c87a, 0x8a5a3a, 0xf2e6c0][Math.floor(hash(Math.floor(t.x * 2 + 64), 0, Math.floor(t.z * 2 + 64), 4) * 3)]));
    return out;
  },
  parts: () => {
    const wheel = part('wheel', 'hamster_wheel', [0, 12, 0], () => {
      const out: BoxSpec[] = [];
      const rim = metal(MET.silver), rung = metal('#a8b0c0');
      for (const z of [-2.8, 2.8]) {
        const pts: Vec3[] = Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return [Math.cos(a) * 9, 12 + Math.sin(a) * 9, z] as Vec3; });
        out.push(...chain(pts, 0.7, rim));
      }
      for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; out.push(box(Math.cos(a) * 8.8, 12 + Math.sin(a) * 8.8 - 0.25, 0, 0.5, 0.5, 5.6, rung)); }
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; out.push(...chain([[0, 12, -2.8], [Math.cos(a) * 9, 12 + Math.sin(a) * 9, -2.8]], 0.5, rim)); }
      out.push(box(0, 11.4, -3, 1.6, 1.6, 1.4, metal(MET.brass)));
      return out;
    });
    const mouse = part('mouse', 'hamster_mouse', [0, 3.6, 0.6], () => {
      const fur = smooth('#c8a07a');
      return [box(0, 3.6, 0.6, 4, 3, 3, fur), box(2.4, 4.4, 0.6, 2.6, 2.4, 2.4, fur), box(3.8, 5, 0.6, 0.8, 0.8, 0.8, smooth('#f2a7b8')),
        box(2.2, 6.8, 1.4, 1.4, 1.4, 0.4, smooth('#e8b8c8')), box(2.2, 6.8, -0.2, 1.4, 1.4, 0.4, smooth('#e8b8c8')), box(3.2, 5.6, 1.85, 0.5, 0.6, 0.2, solid('#1a1418', { noise: 0 })),
        box(-0.8, 3.4, 1.8, 1, 1, 0.6, fur), box(1.2, 3.4, 1.8, 1, 1, 0.6, fur), box(-2.8, 4.4, 0.6, 3, 0.5, 0.5, smooth('#e8b8a8'))];
    });
    return [wheel, mouse];
  },
  animate: (obj, t, dt) => {
    const ph = phase(obj), w = obj.getObjectByName('wheel'), m = obj.getObjectByName('mouse');
    // run, slow down, nap, repeat
    const cyc = ((t + ph) % 9) / 9, speed = cyc < 0.45 ? 3.2 : cyc < 0.55 ? 3.2 * (1 - (cyc - 0.45) * 10) : 0;
    if (w) { w.userData.a = (w.userData.a ?? 0) + speed * Math.min(0.1, dt); w.rotation.z = w.userData.a; }
    if (m) { const home = m.userData.home as THREE.Vector3; m.position.y = home.y + (speed > 0.1 ? Math.abs(Math.sin(t * 16)) * 0.5 * PX : 0); m.rotation.z = speed > 0.1 ? 0.12 : 0; m.scale.y = speed > 0.1 ? 1 : 0.9 + Math.sin(t * 2) * 0.03; }
  },
});

// ------------------------------------------------------------------ bird feeder

add({
  id: 'bird_feeder', name: 'Bluebird Feeder', cat: 'fun', price: 230, rarity: 'uncommon', size: [1, 1],
  blurb: 'A seed house on a post. Sid the bluebird visits daily and leaves the shells everywhere.',
  build: () => {
    const out: BoxSpec[] = [];
    out.push(box(0, 0, 0, 6, 1.4, 6, rock('#9a9aa4', { seed: 3, moss: '#6aa84a' })), box(0, 1.4, 0, 1.8, 20, 1.8, wy(WD.dark)));
    for (const [x, z] of [[1.4, 0], [-1.4, 0], [0, 1.4], [0, -1.4]]) out.push(lean(box(x, 1.4, z, 0.8, 3, 0.8, wy(WD.dark)), z * 18, 0, -x * 18));
    // tray with seeds and a perch rail
    const seeds: Painter = (t) => [0xe8c87a, 0x6a4a2a, 0xf2e6c0, 0xb8884a][Math.floor(hash(Math.floor(t.x * 2 + 64), Math.floor(t.y * 2), Math.floor(t.z * 2 + 64), 2) * 4)];
    out.push(box(0, 21.4, 0, 11, 1, 11, joinery(WD.oak, { axis: 'x' })), box(0, 22.4, 0, 9.6, 0.6, 9.6, seeds));
    for (const s of [-1, 1]) out.push(box(s * 5.2, 22.4, 0, 0.6, 1.4, 11, wz(WD.light, 0)), box(0, 22.4, s * 5.2, 11, 1.4, 0.6, wx(WD.light, 0)));
    // the glass hopper full of seed, under a little red roof
    out.push(box(0, 23, 0, 5, 7, 5, glassP('#e8f4f0'), { glass: true }), box(0, 23.2, 0, 4.4, 5, 4.4, seeds));
    for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) out.push(box(x, 23, z, 0.8, 7, 0.8, wy(WD.oak)));
    out.push(...turn([box(-3.4, 30.4, 0, 7.6, 1, 9, wz('#c84a3a', 3))], [0, 0, 32], [0, 33.6, 0]), ...turn([box(3.4, 30.4, 0, 7.6, 1, 9, wz('#c84a3a', 3))], [0, 0, -32], [0, 33.6, 0]));
    out.push(box(0, 30, 0, 6, 1.6, 6, wy(WD.oak)), box(0, 33.4, 0, 1.4, 1.4, 9.4, wz(WD.dark, 0)));
    // sunflower seeds spilled on the ground and a shell or two on the base
    for (let i = 0; i < 6; i++) out.push(box(-2.6 + hash(i, 1, 6) * 5, 1.4, -2.6 + hash(i, 2, 6) * 5, 0.6, 0.3, 0.4, solid(i % 2 ? '#3a3030' : '#f2e6c0', { noise: 0 })));
    return out;
  },
  parts: () => [part('bird', 'feeder_bird', [3.4, 23.8, 2.4], () => {
    const blue = smooth('#4a7ad8'), x = 3.4, y = 23.8, z = 2.4;
    return [box(x, y, z, 2.6, 2.4, 3.4, blue), box(x, y + 0.2, z + 0.4, 2, 1.4, 2.4, smooth('#e8844a')), box(x, y + 2.4, z + 1.2, 2.4, 2.2, 2.2, blue),
      box(x, y + 2.8, z + 2.6, 0.8, 0.6, 1, smooth('#3a3038')), box(x - 1.25, y + 3.4, z + 1.8, 0.2, 0.6, 0.6, solid('#1a1418', { noise: 0 })), box(x + 1.25, y + 3.4, z + 1.8, 0.2, 0.6, 0.6, solid('#1a1418', { noise: 0 })),
      box(x, y + 1, z - 2.4, 1.6, 0.6, 2, smooth('#3a5aa8')), box(x - 1.4, y + 0.8, z, 0.4, 1.6, 2.6, smooth('#3a5aa8')), box(x + 1.4, y + 0.8, z, 0.4, 1.6, 2.6, smooth('#3a5aa8'))];
  })],
  animate: (obj, t) => {
    const b = obj.getObjectByName('bird'), ph = phase(obj);
    if (!b) return;
    const k = (t * 0.8 + ph) % 3;
    b.rotation.x = k < 0.5 ? Math.sin(k * Math.PI * 4) * 0.5 : 0;
    b.rotation.y = k > 1.6 && k < 2.4 ? 0.6 : 0;
  },
});

export const FUN: ItemDef[] = items;
