// Indoor furniture for the owl's tree house: nests, lamps, shelves and clocks, built from boxes with
// painted pixel textures at the same 16 px-per-block scale and palette as the garden pieces.
import { box, lean, type BoxSpec, type Painter } from '../gfx/box.ts';
import { ramp, tone } from '../gfx/color.ts';
import { cloth, flat, lamp, leaves, lvl, metal, R, rock, smooth, solid, wood, type Tint } from '../gfx/mats.ts';
import { hash } from '../gfx/noise.ts';
import type { ItemDef } from './furniture.ts';

const W = { oak: '#b87a41', dark: '#7b4b2c', light: '#dcab68', walnut: '#5e3b24', pale: '#ead3a4' };
const GOLD = '#f2b632';
const wx = (c: Tint, plank = 3, seed = 0) => wood(c, { axis: 'x', plank, seed });
const wy = (c: Tint, plank = 0, seed = 0) => wood(c, { axis: 'y', plank, seed });
const wz = (c: Tint, plank = 3, seed = 0) => wood(c, { axis: 'z', plank, seed });

/** Woven twigs: crossing diagonal strands with dark gaps. */
const twigs = (c: Tint = '#9a6a3c'): Painter => {
  const r = R(c);
  return (t) => {
    const a = t.face < 2 ? t.z : t.x;
    const k = (Math.floor(a * 1.4 + t.y * 1.4) + Math.floor(a * 1.4 - t.y * 1.4)) % 3;
    return tone(r, lvl(t, { noise: 0.4, scale: 1.6 }) * 0.8 + (k === 0 ? -1.1 : k === 1 ? 0.5 : 0) + (hash(Math.floor(a * 2), Math.floor(t.y * 2), 1) > 0.9 ? 1 : 0));
  };
};
/** A quilt: patchwork squares with stitched seams. */
const quilt = (a: Tint, b: Tint, c: Tint): Painter => {
  const ra = R(a), rb = R(b), rc = R(c);
  return (t) => {
    const u = t.face === 2 ? t.x : t.face < 2 ? t.z : t.x, v = t.face === 2 ? t.z : t.y;
    const cx = Math.floor((u + 40) / 3.2), cy = Math.floor((v + 40) / 3.2);
    const pick = (cx + cy * 2) % 3, r = pick === 0 ? ra : pick === 1 ? rb : rc;
    const inU = ((u + 40) / 3.2) % 1, inV = ((v + 40) / 3.2) % 1;
    let L = lvl(t, { noise: 0.25, speck: 0.2 }) * 0.8;
    if (inU < 0.12 || inV < 0.12) L -= 0.9;
    if ((inU > 0.45 && inU < 0.55) && (inV > 0.4 && inV < 0.6) && pick === 1) L += 1.2;
    return tone(r, L);
  };
};
const books = (seed: number): Painter => {
  const cols = ['#c0533f', '#3f7fc4', '#e7b440', '#5f9a52', '#8a5fc4', '#e07a9a', '#40a3a0'];
  return (t) => {
    const slot = Math.floor((t.x + 30) / 1.6);
    const r = R(cols[Math.floor(hash(slot, 0, 0, seed) * cols.length)]);
    const h = 0.6 + hash(slot, 1, 0, seed) * 0.4;
    if (t.by > t.sy * h) return -1;
    let L = lvl(t, { noise: 0.1, speck: 0 }) * 0.7 + (((t.x + 30) / 1.6) % 1 < 0.2 ? -1.2 : 0);
    if (t.face === 4 && Math.abs(t.by - t.sy * h * 0.7) < 0.3) L += 1.6;
    return tone(r, L);
  };
};

const items: ItemDef[] = [];
const add = (d: ItemDef) => items.push(d);

add({
  id: 'nestbed', name: 'Twig Nest Bed', cat: 'beds', price: 0, size: [1.5, 1.5], blurb: 'Woven from the softest twigs, lined with a patchwork quilt.',
  sleep: { x: 0, y: 6, z: 0 },
  build: () => {
    const tw = twigs(), q = quilt('#e9a9a1', '#f6e6c6', '#9ec3d9'), pil = cloth('#fbf4e4', { shade: { noise: 0.2 } });
    const out: BoxSpec[] = [box(0, 0, 0, 20, 3, 18, tw)];
    for (const [w, d] of [[22, 16], [16, 22], [20, 20]] as const) out.push(box(0, 2.5, 0, w, 3.5, d, tw));
    out.push(box(0, 5, 0.6, 16, 1.4, 14, q), box(0, 5.6, -5.2, 10, 2.6, 4.4, pil), box(-4.6, 6.0, 3.8, 3, 0.8, 3, q));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; out.push(lean(box(Math.cos(a) * 10.4, 4.6, Math.sin(a) * 10.4, 0.8, 3.2, 0.8, solid('#7a5230')), Math.sin(a) * 24, 0, -Math.cos(a) * 24)); }
    return out;
  },
});
add({
  id: 'moonlamp', name: 'Crescent Moon Lamp', cat: 'lights', price: 160, small: true, blurb: 'A soft, warm nightlight shaped like a smiling moon.',
  light: { x: 0, y: 14, z: 0, color: 0xffd98a, power: 1.6 },
  build: () => {
    const base = wy(W.walnut), glow = lamp('#ffe7a0');
    const out: BoxSpec[] = [box(0, 0, 0, 6, 1.5, 6, base), box(0, 1.5, 0, 1, 6, 1, metal('#b9a27a'))];
    // the crescent: stacked slices of a ring with a bite taken out
    for (let y = 0; y < 10; y++) {
      const yy = y - 4.5;
      for (let x = -5; x <= 5; x++) {
        const d1 = Math.hypot(x, yy), d2 = Math.hypot(x - 2.6, yy - 1.2);
        if (d1 < 5 && d2 > 3.8) out.push(box(x, 8 + y, 0, 1, 1, 2.2, glow, { glow: true }));
      }
    }
    return out;
  },
});
add({
  id: 'bookshelf', name: 'Storybook Shelf', cat: 'storage', price: 220, size: [1, 0.5], surface: 26, blurb: 'Bedtime stories, field guides and one cookbook about worms.',
  build: () => {
    const fr = wy(W.oak), out: BoxSpec[] = [box(-8, 0, 0, 1.6, 26, 7, fr), box(8, 0, 0, 1.6, 26, 7, fr), box(0, 0, -3.2, 17.6, 26, 0.8, wy(W.dark, 4))];
    for (const y of [0, 8.4, 16.8, 25]) out.push(box(0, y, 0, 15, 1.2, 7, wx(W.light, 0)));
    for (const [i, y] of [[0, 1.2], [1, 9.6], [2, 18]] as const) out.push(box(0, y, -0.2, 14.4, 7, 6, books(i * 7 + 2), { cut: true }));
    out.push(box(0, 26.2, 0, 3, 3, 3, smooth('#7cc070')), box(5, 26.2, 0, 2, 2, 2, smooth('#e7a84f')));
    return out;
  },
});
add({
  id: 'armchair', name: 'Velvet Armchair', cat: 'seating', price: 300, size: [1, 1], blurb: 'Deep, squashy, and just the right size for an owl.',
  sit: [{ x: 0, y: 6, z: 1 }],
  build: () => {
    const v = cloth('#7a4fa0', { shade: { noise: 0.25 } }), legs = wy(W.walnut);
    return [
      ...[[-6, 5], [6, 5], [-6, -5], [6, -5]].map(([x, z]) => box(x, 0, z, 2, 2.4, 2, legs)),
      box(0, 2.4, 0.6, 14, 4, 12, v), box(0, 6.4, 1.2, 10, 1.6, 10, cloth('#8e60b6')),
      box(0, 6.4, -4.6, 14, 10, 3, v), box(0, 15.4, -4.6, 12, 1.8, 3, v),
      box(-6.4, 6.4, 0.6, 2.4, 4.6, 12, v), box(6.4, 6.4, 0.6, 2.4, 4.6, 12, v),
      box(0, 7.8, -1.6, 4.4, 3.4, 1.6, cloth('#f4c45a', { check: '#e9a83a' })),
    ];
  },
});
add({
  id: 'cuckoo', name: 'Cuckoo Clock', cat: 'wall', price: 260, wall: true, blurb: 'Hoots on the hour. Very politely.',
  build: () => {
    const fr = wy('#8a5532'), face = smooth('#fbf2dc'), hand = flat('#2a1d14'), roof = wx('#5a3a22', 2);
    const out: BoxSpec[] = [box(0, 0, 0, 12, 12, 3, fr), box(0, 12, 0, 13, 1.4, 4, roof), { ...box(-3.4, 12.6, 0, 8, 1.4, 4.4, roof), rot: [0, 0, 32] }, { ...box(3.4, 12.6, 0, 8, 1.4, 4.4, roof), rot: [0, 0, -32] }];
    out.push(box(0, 3.4, 1.5, 7, 7, 0.4, face), box(0, 6.6, 1.75, 0.6, 3.2, 0.2, hand), box(1.2, 6.6, 1.75, 2.6, 0.6, 0.2, hand), box(0, 10.6, 1.6, 2.4, 1.4, 0.3, flat('#2a1d14')));
    out.push(box(-2.4, -6, 0.5, 0.4, 6, 0.4, metal('#9a8a6a')), box(2.4, -8, 0.5, 0.4, 8, 0.4, metal('#9a8a6a')), box(-2.4, -8, 0.5, 1.6, 2.4, 1.6, metal(GOLD)), box(2.4, -10.4, 0.5, 1.6, 2.4, 1.6, metal(GOLD)));
    return out;
  },
});
add({
  id: 'painting', name: 'Moonlit Painting', cat: 'wall', price: 180, wall: true, blurb: 'A tiny landscape of the lake under a full moon.',
  build: () => {
    const fr = metal('#c9963a');
    const art: Painter = (t) => {
      if (t.face !== 4) return tone(ramp(0x2b2f4a), 0);
      const u = t.bx / t.sx, v = t.by / t.sy;
      if (Math.hypot(u - 0.7, v - 0.72) < 0.1) return 0xfff2c4;
      if (v < 0.3) return tone(ramp(0x2f4f7a), (Math.floor(t.bx * 2) % 3 === 0 ? 1 : 0) - (v < 0.15 ? 1 : 0));
      if (v < 0.42 + Math.sin(u * 9) * 0.05) return tone(ramp(0x24442e), 0);
      return tone(ramp(0x3a4f9a), v * 2 - 1 + (hash(Math.floor(t.bx * 3), Math.floor(t.by * 3), 4) > 0.97 ? 3 : 0));
    };
    return [box(0, 0, 0, 14, 10, 1, fr), box(0, 1, 0.3, 12, 8, 0.8, art)];
  },
});
add({
  id: 'fireplace', name: 'Stone Hearth', cat: 'lights', price: 520, level: 4, size: [1.5, 1], surface: 0, blurb: 'Crackles softly all night. Toasts marshmallows by day.',
  light: { x: 0, y: 6, z: 3, color: 0xff9a4a, power: 2.4 },
  build: () => {
    const st = rock('#9a9488', { seed: 3 }), out: BoxSpec[] = [];
    out.push(box(-7, 0, 0, 4, 14, 8, st), box(7, 0, 0, 4, 14, 8, st), box(0, 0, -3, 10, 14, 2, st), box(0, 14, 0, 19, 3, 9, st), box(0, 17, -1, 13, 9, 5, st), box(0, 14.6, 4.2, 20, 1.2, 1.6, wx(W.dark, 0)));
    out.push(box(0, 0, 0.5, 10, 1, 6, solid('#3a2f2a')), box(-1.6, 1, 1, 6, 1.4, 1.6, wx('#6b4426', 0)), box(1.6, 1.4, 0.4, 6, 1.4, 1.6, wx('#5a3a22', 0)));
    out.push(box(-1, 2.2, 1, 2.6, 4, 2, lamp('#ff8a3a'), { glow: true }), box(1.4, 2.4, 0.4, 2.2, 3, 2, lamp('#ffc24a'), { glow: true }), box(0, 2.6, 1.2, 1.2, 5, 1.2, lamp('#fff0a0'), { glow: true }));
    return out;
  },
});
add({
  id: 'fernpot', name: 'Potted Fern', cat: 'plants', price: 90, small: true, blurb: 'Loves the shade. Hates being watered by owls.',
  build: () => {
    const p = solid('#b8603a', { noise: 0.4 }), lf = leaves('#4f9e45', { seed: 9 });
    const out: BoxSpec[] = [box(0, 0, 0, 6, 5, 6, p), box(0, 4.4, 0, 7, 1.4, 7, p), box(0, 5.4, 0, 5, 0.6, 5, solid('#4a3424'))];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; out.push({ ...box(Math.cos(a) * 3, 6, Math.sin(a) * 3, 2.2, 0.8, 7, lf), rot: [Math.sin(a) * 30, -a * 57.3 + 90, Math.cos(a) * 30], pivot: [0, 6, 0], sway: 0.6 }); }
    return out;
  },
});
add({
  id: 'wardrobe', name: 'Painted Wardrobe', cat: 'storage', price: 360, size: [1, 0.5], surface: 26, blurb: 'Where Pip keeps every hat. There are many hats.',
  build: () => {
    const body = wy('#5f8fa8', 4), trim = wy('#3f6a80'), knob = metal(GOLD);
    const flower: Painter = (t) => {
      if (t.face === 4) { const u = (t.bx % 7) - 3.5, v = t.by - 17; if (Math.hypot(u, v) < 1.2) return 0xfbe7a0; if (Math.hypot(u, v) < 2.2 && Math.abs(Math.atan2(v, u) * 5 % 2) < 1) return 0xf2a7b8; }
      return body(t);
    };
    return [box(0, 0, 0, 16, 2, 9, trim), box(0, 2, 0, 15, 22, 8, flower), box(0, 24, 0, 17, 2, 10, trim), box(-0.1, 2, 4.05, 0.4, 22, 0.2, trim), box(-1.5, 12, 4.2, 1, 2, 0.6, knob), box(1.3, 12, 4.2, 1, 2, 0.6, knob)];
  },
});
add({
  id: 'candles', name: 'Candle Cluster', cat: 'lights', price: 70, small: true, blurb: 'Three little flames that never drip on the rug.',
  light: { x: 0, y: 8, z: 0, color: 0xffb35a, power: 1.0 },
  build: () => {
    const wax = smooth('#fbf1dc'), out: BoxSpec[] = [box(0, 0, 0, 8, 1, 6, metal('#b08a4a'))];
    for (const [x, z, h] of [[-2, 0, 6], [1.4, -1, 8], [2, 1.6, 4]] as const) out.push(box(x, 1, z, 2, h, 2, wax), box(x, 1 + h, z, 0.6, 1.6, 0.6, lamp('#ffd060'), { glow: true }));
    return out;
  },
});
add({
  id: 'record', name: 'Gramophone', cat: 'fun', price: 420, level: 3, small: true, blurb: 'Plays lullabies on rainy nights.',
  build: () => {
    const out: BoxSpec[] = [box(0, 0, 0, 10, 5, 9, wy(W.walnut, 3)), box(0, 5, 0, 8, 0.6, 8, solid('#1f1a1e')), box(-2, 5.6, 1, 1, 3, 1, metal(GOLD))];
    for (let i = 0; i < 5; i++) out.push(box(-2 - i * 0.2, 8 + i * 1.6, 1 - i * 0.9, 2 + i * 1.6, 1.6, 2 + i * 1.6, metal(GOLD)));
    return out;
  },
});
add({
  id: 'nightstand', name: 'Bedside Table', cat: 'tables', price: 140, size: [0.5, 0.5], surface: 10, blurb: 'Holds a glass of water and tomorrow’s good intentions.',
  build: () => [box(0, 0, 0, 9, 9, 8, wy(W.oak, 3)), box(0, 9, 0, 10, 1, 9, wx(W.light, 0)), box(0, 4.5, 4.05, 6, 0.4, 0.2, flat('#3a2516')), box(0, 5.6, 4.1, 1.2, 0.8, 0.6, metal(GOLD))],
});
add({
  id: 'roundrug', name: 'Moon Rug', cat: 'rugs', price: 120, flatItem: true, rug: true, size: [1.5, 1.5], blurb: 'A round woven rug with a crescent in the middle.',
  build: () => {
    const r1 = R('#3f5c9a'), r2 = R('#f3d27a'), r3 = R('#e8dcc0');
    const p: Painter = (t) => {
      const d = Math.hypot(t.x, t.z), ring = Math.floor(d / 1.3);
      if (d < 5 && Math.hypot(t.x - 1.6, t.z + 1) > 4) return tone(r2, 0.5);
      return tone(ring % 3 === 0 ? r3 : r1, lvl(t, { noise: 0.2 }) * 0.6 + (Math.floor(Math.atan2(t.z, t.x) * 8 + d) % 2 ? -0.4 : 0.2));
    };
    const out: BoxSpec[] = [];
    for (const [w, d] of [[22, 12], [18, 18], [12, 22], [20, 16], [16, 20]] as const) out.push(box(0, 0, 0, w, 0.5, d, p, { skip: 'd' }));
    return out;
  },
});
add({
  id: 'mushlamp', name: 'Glowcap Lamp', cat: 'lights', price: 240, small: true, blurb: 'Grown, not built. Glows a gentle blue.',
  light: { x: 0, y: 10, z: 0, color: 0x8fe0ff, power: 1.4 },
  build: () => [box(0, 0, 0, 3, 9, 3, smooth('#efe6d2')), box(0, 9, 0, 11, 2.4, 11, lamp('#7fd6f0'), { glow: true }), box(0, 11.4, 0, 7, 1.6, 7, lamp('#a6e8ff'), { glow: true }), box(-4, 0, 3, 2, 4, 2, smooth('#efe6d2')), box(-4, 4, 3, 5, 1.4, 5, lamp('#7fd6f0'), { glow: true })],
});
add({
  id: 'teaset', name: 'Chamomile Tea Set', cat: 'tables', price: 200, size: [1, 1], surface: 0, blurb: 'Two cups of sleepy tea, always warm.',
  build: () => [box(0, 0, 0, 2, 8, 2, wy(W.dark)), box(0, 0, 0, 7, 1, 7, wx(W.dark, 0)), box(0, 8, 0, 14, 1.2, 14, wx(W.light, 0)), box(-3, 9.2, 0, 4, 3.4, 4, smooth('#f4f0e6')), box(-0.6, 10.6, 0, 1.4, 0.8, 0.8, smooth('#f4f0e6')), box(3, 9.2, 2.4, 2.4, 1.8, 2.4, smooth('#9fd3c7')), box(3.4, 9.2, -2.4, 2.4, 1.8, 2.4, smooth('#f2a7b8'))],
});
add({
  id: 'starmap', name: 'Star Chart', cat: 'wall', price: 300, level: 5, wall: true, blurb: 'Every constellation Pip has flown under.',
  build: () => {
    const p: Painter = (t) => {
      if (t.face !== 4) return tone(ramp(0x6b4a2c), 0);
      const k = hash(Math.floor(t.bx * 2), Math.floor(t.by * 2), 9);
      if (k > 0.965) return 0xfff2b0;
      return tone(ramp(0x1f2a52), ((t.bx + t.by) % 6 < 0.4 ? 1.2 : 0) - 0.3);
    };
    return [box(0, 0, 0, 16, 11, 1, wy('#6b4a2c')), box(0, 0.8, 0.3, 14.4, 9.4, 0.8, p)];
  },
});
add({
  id: 'toybox', name: 'Plush Pile', cat: 'fun', price: 150, size: [1, 0.5], surface: 0, blurb: 'A plush mouse, a plush moon and a plush, slightly worried worm.',
  build: () => [box(0, 0, 0, 12, 6, 8, wy('#e3a85f', 3)), box(0, 6, 0, 13, 1, 9, wy('#c98a46')), box(-3, 7, 0, 4, 4, 4, smooth('#c9c3d6')), box(-3, 11, 1.4, 1.2, 1.2, 1.2, smooth('#f2a7b8')), box(2.4, 7, -1, 4, 3.4, 3, smooth('#ffe08a')), box(3, 7, 2.4, 5, 1.6, 1.6, smooth('#f29ab0'))],
});
add({
  id: 'mushpot', name: 'Mushroom Planter', cat: 'plants', price: 110, small: true, blurb: 'A happy family of little toadstools.',
  build: () => [box(0, 0, 0, 8, 4, 6, wx(W.oak, 2)), box(0, 4, 0, 7, 0.6, 5, solid('#4a3424')), box(-2, 4.6, 0, 1.4, 3, 1.4, smooth('#f4ead6')), box(-2, 7.4, 0, 4, 1.4, 4, smooth('#d8402f')), box(2, 4.6, 0.6, 1, 2, 1, smooth('#f4ead6')), box(2, 6.4, 0.6, 3, 1, 3, smooth('#e8963a'))],
});

export const HOME_ITEMS: ItemDef[] = items;
export { flat };
