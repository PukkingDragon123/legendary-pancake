// House plants and rugs: split-leaf monsteras, cacti, trailing ivy, bonsai, terrariums and soft floors.
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../../gfx/box.ts';
import { tone } from '../../gfx/color.ts';
import { dirt, leaves, lvl, metal, R, rock, smooth, solid } from '../../gfx/mats.ts';
import { fbm, hash } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';
import { ball, chain, disc, fab, fluff, glassP, glaze, joinery, MET, patchwork, ring8, sag, WD, wickerP, wx, wy } from './kit.ts';

const items: ItemDef[] = [];
const add = (d: ItemDef) => items.push(d);
const soil = dirt('#5c3d2a', { seed: 2 });
const terracotta = (c = '#c9683f'): Painter => glaze(c, { band: '#e8956a', bands: [1], seed: 4 });

/**
 * A flat leaf blade lying along +z from its base, then tilted up/down (pitch) and swung round (yaw).
 * `shape(along, across)` returns 0 for empty, 1 for leaf, 2 for a vein; along 0..1 base to tip, across -1..1.
 */
function blade(base: Vec3, len: number, w: number, pitch: number, yaw: number, c: string, shape: (a: number, x: number) => number, seed = 0): BoxSpec {
  const r = R(c);
  const p: Painter = (t) => {
    if (t.face !== 2 && t.face !== 3) return -1;
    const a = (t.bz + 0.5) / t.sz, x = ((t.bx + 0.5) / t.sx) * 2 - 1;
    const k = shape(a, x);
    if (!k) return -1;
    const L = (t.face === 2 ? 0.4 : -0.8) + (fbm(t.bx / 3, t.bz / 3, 0, seed) - 0.5) * 1.2 + (Math.abs(x) > 0.7 ? -0.3 : 0.2);
    return k === 2 ? tone(r, L + 1.1) : tone(r, L);
  };
  return { ...box(base[0], base[1], base[2] + len / 2, w, 0.4, len, p, { cut: true, sway: 0.1 }), rot: [-pitch, yaw, 0] as Vec3, pivot: base };
}

// ------------------------------------------------------------------ plants

add({
  id: 'monstera', model: 'items/monstera.glb', name: 'Swiss-Cheese Monstera', cat: 'plants', price: 340, rarity: 'uncommon', size: [2, 2],
  blurb: 'Big split leaves that make any corner feel like a jungle nap spot.',
  build: () => {
    const out: BoxSpec[] = [];
    out.push(...disc(0, 0, 0, 5.4, 8, wickerP('#d4a868')), ...disc(0, 8, 0, 5.8, 1.2, wickerP('#b8884a')), ...disc(0, 8.6, 0, 4.8, 0.6, soil, { skip: 'd' }));
    const split = (a: number, x: number) => {
      const half = Math.sin(Math.PI * Math.pow(Math.max(0, a), 0.55)) * (1 - 0.12 * a);
      const ax = Math.abs(x);
      if (ax > half || a < 0.02) return 0;
      if (ax < 0.09) return 2;
      if (ax > 0.42 * half + 0.1 && ((a * 6 + ax * 1.6) % 1) < 0.16) return 0;
      if (ax > 0.25 && ax < 0.4 && ((a * 6 + 0.5) % 1) < 0.12) return 0;
      return 1;
    };
    const leavesAt: [number, number, number, number, number][] = [[0, 20, 22, 0, 14], [70, 25, 14, 1, 13], [150, 17, 26, 2, 13], [215, 23, 12, 3, 14], [290, 19, 18, 4, 13], [35, 29, 34, 5, 11]];
    for (const [yaw, h, pitch, seed, len] of leavesAt) {
      const rad = (yaw * Math.PI) / 180, bx = Math.sin(rad) * 3.4, bz = Math.cos(rad) * 3.4;
      out.push(...chain([[Math.sin(rad) * 0.8, 8.6, Math.cos(rad) * 0.8], [bx * 0.6, h * 0.7, bz * 0.6], [bx, h, bz]], 0.7, solid('#4f8a3a', { noise: 0.2 })));
      out.push(blade([bx, h, bz], len, 13, pitch, yaw, seed % 2 ? '#3f8a45' : '#4a9a4a', split, seed));
    }
    return out;
  },
});

add({
  id: 'cactus_trio', model: 'items/cactus_trio.glb', name: 'Prickly Pals Trio', cat: 'plants', price: 150, rarity: 'common', size: [1, 1], small: true,
  blurb: 'A barrel, a column and a bunny-ear cactus. Low water, high personality.',
  build: () => {
    const out: BoxSpec[] = [box(0, 0, 0, 15, 0.8, 7, wx(WD.light, 0))];
    const ribs = (c: string): Painter => (t) => tone(R(c), lvl(t, { noise: 0.25 }) + (t.u % 2 ? -0.6 : 0.35) + (hash(t.u, t.v, t.face, 3) > 0.9 ? 1.8 : 0));
    // barrel cactus in a terracotta pot, with a pink flower
    out.push(...disc(-5, 0.8, 0, 2.4, 3.4, terracotta()), ...disc(-5, 4.2, 0, 2.8, 0.8, terracotta()));
    out.push(...ball(-5, 4.6, 0, 2.6, ribs('#5aa85a')), box(-5, 9.6, 0, 1.6, 1, 1.6, smooth('#f58fb0')), box(-5, 10.4, 0, 0.6, 0.6, 0.6, smooth('#f6d04a')));
    // a columnar cactus with one arm in a white glazed pot
    out.push(...disc(0, 0.8, 0, 2.2, 4, glaze('#f2ece0', { band: '#3f6fb4', bands: [2] })), box(0, 4.6, 0, 3, 11, 3, ribs('#4f9a5a')), box(0, 15.6, 0, 2, 0.8, 2, ribs('#4f9a5a')));
    out.push(box(2.6, 8, 0, 2.6, 1.6, 1.8, ribs('#4f9a5a')), box(3.2, 9.6, 0, 1.8, 3.6, 1.8, ribs('#4f9a5a')), box(-2.4, 10.4, 0, 2.2, 1.4, 1.6, ribs('#4f9a5a')), box(-2.9, 11.8, 0, 1.4, 2, 1.4, ribs('#4f9a5a')));
    // bunny-ear pads in a blue pot
    const pad: Painter = (t) => tone(R('#6aaa5a'), lvl(t, { noise: 0.3 }) + (hash(Math.floor(t.x * 1.5), Math.floor(t.y * 1.5), Math.floor(t.z * 1.5), 2) > 0.82 ? 1.6 : 0));
    out.push(...disc(5.2, 0.8, 0, 2.2, 3, glaze('#5a7ac8', { dots: '#f6f0e4', dotRate: 0.08 })), ...disc(5.2, 3.8, 0, 2.6, 0.8, glaze('#5a7ac8')));
    out.push(box(5.2, 4.4, 0, 3.4, 4.6, 1.2, pad), { ...box(6.8, 8.4, 0, 2.6, 3.4, 1, pad), rot: [0, 0, -24] as Vec3 }, { ...box(3.8, 8, 0, 2.2, 3, 1, pad), rot: [0, 0, 30] as Vec3 }, box(7.6, 11.6, 0, 1, 1, 1, smooth('#f6d04a')));
    return out;
  },
});

add({
  id: 'hanging_ivy', model: 'items/hanging_ivy.glb', name: 'Trailing Ivy Pot', cat: 'plants', price: 200, rarity: 'uncommon', size: [1, 1], wall: true,
  blurb: 'A macrame-hung pot with ivy that tumbles halfway down the wall.',
  build: () => {
    const out: BoxSpec[] = [box(0, 20, 0, 1.4, 1.4, 3, metal(MET.iron)), box(0, 19, 2.6, 1, 2, 1, metal(MET.iron)), box(0, 20.6, -0.6, 3, 3, 0.6, metal(MET.iron))];
    const cord = fab('#f2e6c8', { weave: 0.3 });
    for (const a of [0, 120, 240]) {
      const r = (a * Math.PI) / 180;
      out.push(...chain([[0, 19, 3], [Math.sin(r) * 2.4, 12, 3 + Math.cos(r) * 2.4], [Math.sin(r) * 3.4, 6, 3 + Math.cos(r) * 3.4]], 0.5, cord));
    }
    out.push(box(0, 13, 3, 1.6, 1.6, 1.6, cord));
    out.push(...disc(0, 0, 3, 3.6, 6, glaze('#e8e0cc', { dip: '#3f8a6a', dipH: 2 })), ...disc(0, 5.4, 3, 3, 0.6, soil, { skip: 'd' }));
    const ivy = leaves('#3f8a3a', { seed: 5 }), ivy2 = leaves('#5aa84a', { seed: 6 });
    out.push(...disc(0, 6, 3, 3.4, 2.4, ivy), box(1, 8.4, 3, 3, 1.6, 2.4, ivy2));
    // trailing strands: a stem with leaves hanging off it
    const strands: [number, number, number][] = [[-3, 3, 16], [2.6, 5.4, 22], [3.4, 1.6, 12], [-1.4, 6, 19], [-3.6, 1, 9]];
    strands.forEach(([x, z, len], i) => {
      const pts: Vec3[] = Array.from({ length: 7 }, (_, k) => [x + Math.sin(k * 0.9 + i) * 1.2 + (x > 0 ? k * 0.3 : -k * 0.3), 6 - (k / 6) * len, z + Math.cos(k * 0.7) * 0.6] as Vec3);
      out.push(...chain(pts, 0.4, solid('#5a7a3a', { noise: 0 })));
      pts.forEach((p, k) => { if (k) out.push(box(p[0] + (k % 2 ? 0.8 : -0.8), p[1] - 0.6, p[2], 1.8, 1.4, 1.4, k % 2 ? ivy : ivy2, { sway: 0.2 })); });
    });
    return out;
  },
});

add({
  id: 'maple_bonsai', model: 'items/maple_bonsai.glb', name: 'Ember Maple Bonsai', cat: 'plants', price: 0, gems: 40, rarity: 'epic', size: [1, 1], small: true,
  blurb: 'A tiny maple in permanent autumn. Somebody trims it with nail scissors at midnight.',
  build: () => {
    const out: BoxSpec[] = [];
    const tray = glaze('#3a4a6a', { band: '#c9a050', bands: [0.5] });
    out.push(box(0, 0, 0, 16, 1, 10, solid('#2a2a30', { noise: 0.2 })), box(-6, 0, 3.4, 2, 1, 2, solid('#2a2a30')), box(6, 0, 3.4, 2, 1, 2, solid('#2a2a30')));
    out.push(box(0, 1, 0, 14, 3, 8.4, tray), box(0, 3.4, 0, 12.6, 0.6, 7, soil, { skip: 'd' }));
    out.push(...disc(-1, 4, 0, 4.6, 1, leaves('#6a9a3a', { seed: 3, bloom: '#e8e0a0', rate: 0.05 }), { skip: 'd' }, 3.2), box(4.6, 4, 1.6, 3.4, 2.4, 2.6, rock('#8a8a90', { seed: 2, moss: '#6a9a3a' })));
    const bk = (t: Parameters<Painter>[0]) => tone(R('#5a3a2a'), lvl(t, { noise: 0.5, scale: 1.4 }) + ((t.v + t.u) % 3 === 0 ? -0.6 : 0));
    out.push(lean(box(-1.6, 4, 0, 2.6, 6, 2.6, bk), 0, 0, -20), { ...box(-0.6, 9, 0, 2, 5, 2, bk), rot: [0, 0, 34] as Vec3, pivot: [-0.2, 9.2, 0] as Vec3 }, { ...box(1.8, 9, 0, 1.6, 6, 1.6, bk), rot: [0, 0, -50] as Vec3, pivot: [0.6, 9.2, 0] as Vec3 }, { ...box(-2, 12.4, 0, 1.4, 4, 1.4, bk), rot: [0, 0, 22] as Vec3, pivot: [-2, 12.4, 0] as Vec3 });
    const red = leaves('#d8502a', { seed: 8, bloom: '#f6b03a', rate: 0.18 }), orange = leaves('#e88a2a', { seed: 9, bloom: '#f6d04a', rate: 0.1 });
    for (const [x, y, z, w, h, p] of [[-6, 13, 0, 7, 3, red], [5.6, 11.6, 0.6, 7, 3, orange], [-2.6, 16.6, -0.6, 8, 3, red], [2, 15, 1.4, 5, 2.4, orange], [-7.4, 11.4, 1.6, 3, 2, orange]] as const) {
      out.push(box(x, y, z, w, h, w * 0.8, p, { sway: 0.15 }), box(x, y + h, z, w - 2.4, 1.4, w * 0.8 - 2, p, { sway: 0.15, skip: 'd' }));
    }
    for (const [x, z] of [[3, -2.4], [-4.4, 2.6]]) out.push(box(x, 4, z, 1.4, 0.4, 1.2, solid('#e86a2a', { noise: 0 })));
    return out;
  },
});

add({
  id: 'window_flower_box', model: 'items/window_flower_box.glb', name: 'Geranium Window Box', cat: 'plants', price: 170, rarity: 'common', size: [2, 1], small: true,
  blurb: 'Scarlet geraniums, cheerful daisies and lobelia spilling blue over the edge.',
  build: () => {
    const out: BoxSpec[] = [];
    const boxP: Painter = (t) => {
      const base = joinery('#f2ece0', { axis: 'x', plank: 3 })(t);
      if (t.face === 4) { const u = ((t.u + 3) % 7) - 3, v = t.v - 2; if ((v === 1 && (u === -1 || u === 1)) || (v === 0 && Math.abs(u) <= 1 && !(u === 0 && false)) || (v === -1 && u === 0)) return tone(R('#e8708a'), 0.3); }
      return base;
    };
    out.push(box(0, 0, 0, 22, 6, 7, boxP), box(0, 6, 0, 23, 0.8, 7.6, wx(WD.light, 0)), box(0, 5.4, 0, 20.4, 0.8, 5.6, soil, { skip: 'd' }));
    for (const x of [-9.4, 9.4]) out.push(box(x, -0.6, 0, 2, 0.8, 7.4, wx(WD.dark, 0)));
    const lf = leaves('#4f8a3a', { seed: 4 });
    out.push(box(0, 6.2, -0.6, 19, 3, 4, lf));
    // geranium heads: clusters of tiny red florets on short stalks
    const ger = leaves('#d8302a', { seed: 2, bloom: '#ff8a7a', rate: 0.3, lift: 0.6 });
    for (const x of [-7, 0.4, 7.4]) out.push(box(x, 9, -0.6, 0.6, 2, 0.6, solid('#4f8a3a')), ...ball(x, 10.4, -0.6, 2, ger));
    for (const [x, z] of [[-3.6, 1.6], [4, 1.8]]) {
      out.push(box(x, 9, z, 0.4, 2.4, 0.4, solid('#5a9a45')), box(x, 11.4, z, 2.6, 0.4, 2.6, (t) => (Math.abs(t.bx - 1.3) < 0.5 && Math.abs(t.bz - 1.3) < 0.5 ? 0xf6c531 : 0xfbfaf2)));
    }
    // lobelia trailing over the front edge
    const lob = leaves('#4f7a3a', { seed: 7, bloom: '#6a7aea', rate: 0.35 });
    for (let i = 0; i < 6; i++) out.push(box(-9 + i * 3.6, 3.4 - (i % 2) * 1.4, 3.8, 2.6, 3.4 + (i % 2) * 1.4, 1.4, lob, { sway: 0.2 }));
    return out;
  },
});

add({
  id: 'moss_terrarium', model: 'items/moss_terrarium.glb', name: 'Moss Terrarium', cat: 'plants', price: 260, rarity: 'rare', size: [1, 1], small: true,
  blurb: 'A whole forest floor under glass, with two toadstools and a very tiny path.',
  build: () => {
    const out: BoxSpec[] = [];
    out.push(...disc(0, 0, 0, 6, 1.6, joinery(WD.walnut, { axis: 'x' })), ...disc(0, 1.6, 0, 5.4, 0.6, metal(MET.brass)));
    out.push(...disc(0, 2.2, 0, 5, 1.6, solid('#8a6a4a', { noise: 0.8, scale: 1 })));
    out.push(...disc(-0.6, 3.8, -0.4, 4, 1.4, leaves('#5f9a45', { seed: 3, bloom: '#d8e8a0', rate: 0.06 })), ...disc(1.6, 5, -1.6, 2, 1.2, leaves('#4f8a3a', { seed: 4 })));
    out.push(box(2, 3.9, 2.4, 1.2, 0.4, 1, solid('#c9c0b0')), box(0.6, 3.9, 3.4, 1, 0.4, 0.8, solid('#b8b0a0')), box(3, 3.9, 1, 1, 0.4, 1, solid('#c9c0b0')));
    out.push(box(-2.4, 5.2, 1.4, 0.6, 1.6, 0.6, smooth('#f6ead6')), box(-2.4, 6.8, 1.4, 2, 0.8, 2, smooth('#d8402f')), box(-1, 5.2, 2.4, 0.4, 1, 0.4, smooth('#f6ead6')), box(-1, 6.2, 2.4, 1.2, 0.6, 1.2, smooth('#e8963a')));
    out.push(lean(box(2, 5, -2, 0.4, 4, 0.4, solid('#4f8a3a')), -20, 0, 10), box(2.6, 8.4, -2.6, 2, 0.4, 1.4, leaves('#5aa84a', { seed: 1 })));
    // the glass dome with a brass knob
    const gl = glassP('#e4f6f0');
    out.push(...ring8(0, 2.2, 0, 5.4, 6, 0.3, gl, { glass: true }, 10), ...ring8(0, 8.2, 0, 4.6, 2, 0.3, gl, { glass: true }, 10), ...disc(0, 10.2, 0, 3.4, 0.4, gl, { glass: true }));
    out.push(box(0, 10.6, 0, 1.4, 1, 1.4, metal(MET.brass)), box(0, 11.6, 0, 0.8, 0.8, 0.8, metal(MET.gold)));
    return out;
  },
});

add({
  id: 'fiddle_fig', model: 'items/fiddle_fig.glb', name: 'Fiddle-Leaf Fig', cat: 'plants', price: 380, rarity: 'uncommon', size: [1, 1],
  blurb: 'Tall, glossy and a little dramatic. Turns its leaves towards the morning window.',
  build: () => {
    const out: BoxSpec[] = [];
    const pot = glaze('#f2ece0', { band: '#2f3f6a', bands: [8, 9], seed: 5 });
    out.push(...disc(0, 0, 0, 4.6, 1, pot), ...disc(0, 1, 0, 5.4, 9, pot), ...disc(0, 9.4, 0, 4.8, 0.6, soil, { skip: 'd' }));
    const trunk = solid('#7a5a3a', { noise: 0.4 });
    out.push(...chain([[0, 9.4, 0], [0.6, 20, 0.4], [-0.4, 30, -0.2], [0.4, 38, 0]], 1.2, trunk));
    const fiddle = (a: number, x: number) => {
      const half = a < 0.6 ? 0.5 + a * 0.8 : 0.98 - (a - 0.6) * 1.6 + (a > 0.4 && a < 0.55 ? -0.1 : 0);
      if (Math.abs(x) > Math.max(0, Math.min(1, half)) || a < 0.03) return 0;
      if (Math.abs(x) < 0.1) return 2;
      if (Math.abs(((a * 5 - Math.abs(x) * 1.2) % 1)) < 0.08 && Math.abs(x) < 0.8) return 2;
      return 1;
    };
    const ls: [number, number, number, number][] = [[18, 20, 40, 0], [21, 140, 30, 1], [24, 260, 35, 2], [27, 60, 20, 3], [30, 190, 25, 4], [33, 320, 30, 5], [36, 100, 10, 6], [39, 230, 5, 7], [41, 0, -40, 8]];
    for (const [y, yaw, pitch, i] of ls) out.push(blade([Math.sin((yaw * Math.PI) / 180) * 0.6, y, Math.cos((yaw * Math.PI) / 180) * 0.6], 9.6, 7.4, pitch * 0.6, yaw, i % 2 ? '#2f7a3a' : '#3f8a45', fiddle, i));
    return out;
  },
});

// ------------------------------------------------------------------ rugs

add({
  id: 'braided_rug', model: 'items/braided_rug.glb', name: 'Braided Rag Rug', cat: 'rugs', price: 160, rarity: 'common', size: [2, 2], rug: true, flatItem: true,
  blurb: 'Coiled from old scarves in sunset colours. Warm under cold morning feet.',
  sit: [{ x: 0, y: 1, z: 0 }],
  build: () => {
    const cols = ['#c9656f', '#f2c84a', '#e8823a', '#8a5a7a', '#f6ecd6', '#6aa8a0'].map((c) => R(c));
    const p: Painter = (t) => {
      const d = Math.hypot(t.x, t.z), ring = Math.floor(d / 1.6), a = Math.atan2(t.z, t.x);
      const braid = (Math.floor(a * (d + 2) * 0.9 + (ring % 2) * 0.5 + 64) % 2) ? 0.45 : -0.35;
      const edgeR = (d / 1.6) % 1 < 0.18 ? -0.9 : 0;
      return tone(cols[ring % cols.length], braid + edgeR + (t.face === 2 ? 0.1 : -0.8) + (hash(Math.floor(t.x * 2), Math.floor(t.z * 2), 3) - 0.5) * 0.3);
    };
    return disc(0, 0, 0, 15.5, 0.8, p, { skip: 'd' });
  },
});

add({
  id: 'kilim_runner', model: 'items/kilim_runner.glb', name: 'Kilim Hall Runner', cat: 'rugs', price: 220, rarity: 'uncommon', size: [3, 1], rug: true, flatItem: true,
  blurb: 'Long, flat-woven and full of little diamonds. Points the way to the kitchen.',
  build: () => {
    const red = R('#b8433a'), cream = R('#f2e4c8'), navy = R('#2f3f6a'), gold = R('#e8b04a');
    const p: Painter = (t) => {
      const x = Math.floor(t.x + 64) - 64, z = Math.floor(t.z + 64) - 64, ax = Math.abs(x), az = Math.abs(z);
      const L = (t.face === 2 ? 0.1 : -0.8) + ((x + z) & 1 ? 0.18 : -0.18);
      if (ax > 21.5) return (z % 2 === 0) ? -1 : tone(cream, L - 0.3);
      if (ax > 20.5 || az > 6.5) return tone(navy, L);
      if (az > 5.5 || ax > 19.5) return tone(gold, L);
      const cx = ((x + 64) % 10) - 5, d = Math.abs(cx) + az;
      if (d === 5 || d === 2) return tone(navy, L);
      if (d < 2) return tone(gold, L + 0.3);
      if (d === 3 || d === 4) return tone(cream, L);
      return tone(red, L + (az === 4 ? -0.4 : 0));
    };
    return [box(0, 0, 0, 46, 0.6, 15, p, { cut: true, skip: 'd' })];
  },
});

add({
  id: 'patch_rug', model: 'items/patch_rug.glb', name: 'Patchwork Quilt Rug', cat: 'rugs', price: 240, rarity: 'uncommon', size: [2, 2], rug: true, flatItem: true,
  blurb: 'Every square is a different pyjama Pip has outgrown. There have been many growth spurts.',
  sit: [{ x: 0, y: 1, z: 0 }], sleep: { x: 0, y: 1, z: 0, rot: 90 },
  build: () => {
    const pw = patchwork(['#e9a9a1', '#f6e6c6', '#9ec3d9', '#b9d49a', '#f2c84a', '#c9a0d8'], { size: 5, seam: '#fbf4e4', seed: 7 });
    const p: Painter = (t) => {
      const ex = Math.min(t.bx, t.sx - t.bx), ez = Math.min(t.bz, t.sz - t.bz);
      if (ex < 1 || ez < 1) return tone(R('#7a4a5a'), ((Math.floor(t.x + t.z + 64)) % 2 ? 0.5 : -0.3) + (t.face === 2 ? 0 : -0.8));
      if ((ex < 1.6 || ez < 1.6) && (Math.floor(t.x + t.z + 64) % 2 === 0)) return tone(R('#f6ecd6'), 0.6);
      return pw(t);
    };
    return [box(0, 0, 0, 30, 0.8, 24, p, { skip: 'd' })];
  },
});

add({
  id: 'sheepskin_rug', model: 'items/sheepskin_rug.glb', name: 'Cloud Sheepskin', cat: 'rugs', price: 280, rarity: 'rare', size: [2, 2], rug: true, flatItem: true,
  blurb: 'Impossibly fluffy. Pip insists it is a cloud that fell down and decided to stay.',
  sit: [{ x: 0, y: 2, z: 0 }], sleep: { x: 0, y: 2, z: 0 },
  build: () => {
    const f = fluff('#f6f0e4', { seed: 4, curl: 1.1 });
    const out: BoxSpec[] = [];
    // a soft irregular outline: overlapping ellipses with four little "legs"
    out.push(...disc(0, 0, 0, 10, 1.4, f, { skip: 'd' }, 12), ...disc(0, 1.4, 0, 8, 0.8, f, { skip: 'd' }, 10));
    for (const [x, z] of [[-8, -9], [8, -9], [-8.6, 9], [8.6, 9]]) out.push(...disc(x, 0, z, 3, 1, f, { skip: 'd' }, 2.4));
    out.push(...disc(0, 0, -12, 4, 1, f, { skip: 'd' }, 2), ...disc(0, 0, 12.4, 3, 0.8, f, { skip: 'd' }, 1.6));
    return out;
  },
});

add({
  id: 'oak_leaf_rug', model: 'items/oak_leaf_rug.glb', name: 'Oak Leaf Rug', cat: 'rugs', price: 200, rarity: 'uncommon', size: [2, 2], rug: true, flatItem: true,
  blurb: 'A giant felt oak leaf, veins and all, that fell straight off the hollow’s own tree.',
  build: () => {
    const g = R('#6a9a45'), vein = R('#c9d88a');
    const p: Painter = (t) => {
      const a = (t.z + 15) / 30, x = Math.abs(t.x) / 10;
      const lobes = 0.55 + 0.45 * Math.abs(Math.sin(a * Math.PI * 3.5)) ;
      const w = Math.sin(Math.PI * Math.min(1, Math.max(0, a))) * lobes;
      if (a < 0 || a > 1 || x > w) return (a < 0 && a > -0.18 && Math.abs(t.x) < 0.8) ? tone(R('#8a6a3a'), 0) : -1;
      if (Math.abs(t.x) < 0.6) return tone(vein, 0);
      if (Math.abs(((a * 7 - x * 0.9) % 1)) < 0.1 && x < w - 0.08) return tone(vein, -0.4);
      if (x > w - 0.09) return tone(g, -1.2);
      return tone(g, (t.face === 2 ? 0.2 : -0.8) + (fbm(t.x / 4, t.z / 4, 0, 3) - 0.5) * 0.9 + ((t.u + t.v) & 1 ? 0.12 : -0.12));
    };
    return [box(0, 0, -1.6, 22, 0.8, 34, p, { cut: true, skip: 'd' })];
  },
});

export const GREEN: ItemDef[] = items;
