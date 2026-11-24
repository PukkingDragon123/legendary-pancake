// Tables, desks and storage: things with drawers, shelves and flat tops for small items to stand on.
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../../gfx/box.ts';
import { tone } from '../../gfx/color.ts';
import { bark, leaves, lvl, metal, R, smooth, solid } from '../../gfx/mats.ts';
import { hash } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';
import { ball, disc, drawerFace, fab, flameP, glassP, glaze, joinery, knit, MET, paper, ring8, shelfBooks, spine, turn, waxP, WD, wickerP, wx, wy, wz } from './kit.ts';

const items: ItemDef[] = [];
const add = (d: ItemDef) => items.push(d);

/** Turned leg: stacked discs that bulge and pinch like a bobbin. */
const turned = (x: number, z: number, h: number, c: string, r = 1.2): BoxSpec[] => {
  const p = wy(c), out: BoxSpec[] = [];
  const prof = [1, 0.7, 1.15, 0.65, 0.9, 0.65, 1.1, 0.75, 1];
  const seg = h / prof.length;
  prof.forEach((k, i) => out.push(box(x, i * seg, z, r * 2 * k, seg + 0.01, r * 2 * k, p)));
  return out;
};
/** A little potted plant for shelves. */
const sprig = (x: number, y: number, z: number, c = '#c9683f', leaf = '#4f9e45', seed = 1): BoxSpec[] => {
  const lf = leaves(leaf, { seed });
  return [box(x, y, z, 3, 2.6, 3, solid(c, { noise: 0.4 })), box(x, y + 2.2, z, 3.4, 0.8, 3.4, solid(c, { noise: 0.4 })), box(x, y + 3, z, 4, 2.4, 3.6, lf), box(x - 1.4, y + 1.6, z + 1.2, 1.4, 2.6, 1.4, lf), box(x + 0.4, y + 5.4, z - 0.4, 2, 1.4, 2, lf)];
};
const jar = (x: number, y: number, z: number, h: number, fill: string, lid = MET.copper): BoxSpec[] => [
  box(x, y, z, 2.6, h, 2.6, glassP('#d8f0f4'), { glass: true }), box(x, y + 0.2, z, 2, h * 0.7, 2, smooth(fill)), box(x, y + h, z, 2.8, 0.8, 2.8, metal(lid)),
];

// ------------------------------------------------------------------ tables

add({
  id: 'writing_desk', model: 'items/writing_desk.glb', name: 'Schoolroom Desk', cat: 'tables', price: 640, rarity: 'rare', size: [2, 1], surface: 13,
  blurb: 'A desk, a chair and a satchel, ready for letters home and very late homework.',
  sit: [{ x: 0, y: 0, z: 10, rot: 180 }],
  build: () => {
    const out: BoxSpec[] = [];
    const c = WD.cherry, car = joinery(c, { axis: 'y', plank: 0 });
    // two pedestals of drawers either side of the kneehole
    for (const s of [-1, 1]) {
      out.push(box(s * 9.5, 0, 0, 8, 1, 12, wy(WD.walnut)), box(s * 9.5, 1, 0, 8, 11.6, 11, car));
      for (let k = 0; k < 3; k++) out.push(box(s * 9.5, 1.6 + k * 3.6, 5.6, 7, 3.2, 0.6, drawerFace(c, { pull: MET.brass })));
    }
    out.push(box(0, 8.6, 0, 11, 3, 11, car), box(0, 9, 5.6, 10, 2.4, 0.6, drawerFace(c, { keyhole: true })));
    out.push(box(0, 12.4, 0.5, 28, 1, 13, joinery(c, { axis: 'x', plank: 4 })));
    out.push(box(0, 13.4, 1.8, 18, 0.2, 7, fab('#3f6a4a', { weave: 0.1 })));
    // the hutch: cubbies and the half-rolled tambour
    out.push(box(0, 13.4, -4.4, 27, 10, 3.4, car));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) {
      const x = -10.4 + i * 5.2, y = 14 + j * 4.6;
      out.push(box(x, y, -2.6, 4.4, 4, 0.4, solid('#3a2420', { noise: 0.2 })));
      if (hash(i, j, 4) > 0.35) out.push(box(x - 0.6 + hash(i, j, 5) * 1.2, y, -3.2, 3, 2 + hash(i, j, 6) * 2, 1.2, paper('#f2e6c8')));
      else out.push(box(x, y, -3, 3.6, 1, 1.4, metal(MET.brass)), box(x, y + 1, -3, 2.4, 1.4, 1.4, smooth('#7a4fa8')));
    }
    for (let i = 0; i <= 5; i++) out.push(box(-13 + i * 5.2, 13.4, -2.6, 0.8, 9.6, 1.6, wy(c)));
    out.push(box(0, 18.2, -2.6, 27, 0.6, 1.6, wx(c, 0)));
    const tambour: Painter = (t) => tone(R(c), lvl(t, { noise: 0.2 }) + (t.face === 4 || t.face === 2 ? (t.v % 2 ? 0.5 : -0.9) : 0));
    for (let k = 0; k < 5; k++) {
      const a = (k / 4) * 80;
      out.push({ ...box(0, 23.4, -4.4, 28, 1.2, 2.4, tambour), rot: [-a, 0, 0] as Vec3, pivot: [0, 23.4, -6] as Vec3 });
    }
    out.push(box(0, 24, -6, 28, 2, 2, joinery(c, { axis: 'x' })));
    for (const s of [-1, 1]) out.push(box(s * 13.6, 13.4, -3.4, 1.2, 11, 5.6, joinery(c, { axis: 'z' })));
    // inkwell, quill, a candle stub and a sealed letter
    out.push(box(-8.6, 13.4, 3.4, 2.4, 1.8, 2.4, glassP('#3a3a5a'), { glass: true }), box(-8.6, 13.4, 3.4, 2, 1.4, 2, solid('#1f1a3a', { noise: 0 })), box(-8.6, 15.2, 3.4, 1.4, 0.6, 1.4, metal(MET.brass)));
    out.push({ ...box(-7.6, 15, 3.2, 0.6, 7, 0.4, solid('#f6f0e4', { noise: 0.3 })), rot: [0, 0, -24] as Vec3, pivot: [-8.6, 14.6, 3.4] as Vec3 });
    out.push({ ...box(-6.2, 19.6, 3.2, 1.4, 3.6, 0.3, solid('#f6f0e4', { noise: 0.4 })), rot: [0, 0, -24] as Vec3, pivot: [-8.6, 14.6, 3.4] as Vec3 });
    out.push(box(9, 13.4, 3.6, 3, 0.8, 3, metal(MET.brass)), box(9, 14.2, 3.6, 1.6, 2.6, 1.6, waxP()), box(9, 16.8, 3.6, 0.6, 1.2, 0.6, flameP(), { glow: true }));
    out.push({ ...box(2, 13.4, 3.2, 5, 0.6, 3.4, paper('#f4e6c8')), rot: [0, -12, 0] as Vec3 }, box(2.6, 14, 3.4, 1.2, 0.4, 1.2, smooth('#c0392b')));
    return out;
  },
});

add({
  id: 'round_table', model: 'items/round_table.glb', name: 'Lace-Cloth Round Table', cat: 'tables', price: 420, rarity: 'uncommon', size: [2, 2], surface: 15,
  blurb: 'Seats four owls, or two owls and a very large pie.',
  eat: { x: 0, y: 0, z: 14, rot: 180 },
  build: () => {
    const out: BoxSpec[] = [];
    const c = WD.oak;
    out.push(...disc(0, 13, 0, 12, 1.6, joinery(c, { axis: 'x', plank: 4 })));
    const lace = R('#fbf6ea');
    const cloth: Painter = (t) => {
      const d = Math.hypot(t.x, t.z), a = Math.atan2(t.z, t.x);
      if (t.face === 2) {
        if (Math.abs(d - 9) < 0.6 || (Math.abs(d - 6.5) < 0.5 && Math.floor(a * 8 + 32) % 2 === 0)) return tone(lace, -0.6);
        if (d < 3 && (Math.floor(t.x + 64) + Math.floor(t.z + 64)) % 2 === 0) return tone(lace, -0.4);
      }
      return tone(lace, lvl(t, { noise: 0.15 }) + ((t.u + t.v) & 1 ? 0.15 : -0.15));
    };
    out.push(...disc(0, 14.6, 0, 12.6, 0.4, cloth, { skip: 'd' }));
    // the scalloped drop of the cloth all the way round
    const drop: Painter = (t) => {
      if (t.v === 0 && t.u % 2 === 1) return -1;
      if (t.v === 1 && (t.u % 4 === 1)) return -1;
      return tone(lace, lvl(t, { noise: 0.1 }) * 0.5 + (t.v % 2 ? 0.2 : -0.3));
    };
    out.push(...ring8(0, 11.4, 0, 12.8, 3.6, 0.4, drop, { cut: true }, 16));
    // pedestal and claw feet
    out.push(...disc(0, 3, 0, 2.2, 10, wy(c)), ...disc(0, 8, 0, 2.8, 1.4, wy(c)), ...disc(0, 3, 0, 3.4, 1.6, wy(WD.dark)));
    for (let i = 0; i < 4; i++) {
      const a = i * 90 + 45, rad = (a * Math.PI) / 180;
      out.push({ ...box(Math.sin(rad) * 5, 0.6, Math.cos(rad) * 5, 2, 2.4, 7, wz(WD.dark, 0)), rot: [0, a, 0] as Vec3 });
      out.push(box(Math.sin(rad) * 8, 0, Math.cos(rad) * 8, 2.6, 1.6, 2.6, metal(MET.brass)));
    }
    return out;
  },
});

add({
  id: 'log_table', model: 'items/log_table.glb', name: 'Old-Oak Coffee Table', cat: 'tables', price: 300, rarity: 'uncommon', size: [2, 2], surface: 9,
  blurb: 'A slice of the hollow’s grandfather tree: 212 rings, one for every story.',
  build: () => {
    const out: BoxSpec[] = [];
    const ringR = R('#d9a865'), bk = bark('#6a4630', { seed: 3, moss: '#5f9a45', mossTo: 6 });
    const top: Painter = (t) => {
      if (t.face !== 2) return bk(t);
      const ex = t.x / 11, ez = t.z / 8, d = Math.hypot(ex, ez) * 11;
      if (d > 10.2) return tone(R('#6a4630'), -0.4 + hash(Math.floor(t.x * 2), Math.floor(t.z * 2), 1) * 0.6);
      if (d > 9.4) return tone(ringR, -1.3);
      const wob = Math.sin(Math.atan2(ez, ex) * 5) * 0.25;
      let L = (Math.floor(d + wob) % 2 ? -0.4 : 0.5) + (Math.floor((d + wob) * 3) % 5 === 0 ? -0.6 : 0);
      if (Math.abs(Math.atan2(ez, ex) - 0.6) < 0.06 && d > 3) L -= 1.6;
      if (d < 0.8) L -= 1;
      return tone(ringR, L + (hash(Math.floor(t.x * 2), Math.floor(t.z * 2), 9) - 0.5) * 0.5);
    };
    out.push(...disc(0, 6.4, 0, 11, 2.6, top, {}, 8));
    // three stubby branch legs
    for (const [x, z, r] of [[-6, 3, 20], [6, 3.6, -16], [0, -5, 0]] as const) out.push(lean(box(x, 0, z, 2.6, 7, 2.6, bark('#6a4630', { seed: x + 9 })), r * 0.4, 0, r));
    // a mushroom has moved in under the edge and a mug ring stains the top
    out.push(box(9.4, 0, 4, 1, 2.6, 1, smooth('#f4ead6')), box(9.4, 2.6, 4, 3, 1, 3, smooth('#e8963a')));
    out.push(box(-4, 9.0, -2, 3, 0.1, 3, (t) => (Math.abs(Math.hypot(t.bx - 1.5, t.bz - 1.5) - 1.2) < 0.4 ? tone(ringR, -1.4) : -1), { cut: true }));
    return out;
  },
});

add({
  id: 'bobbin_side_table', model: 'items/bobbin_side_table.glb', name: 'Bobbin Side Table', cat: 'tables', price: 180, rarity: 'common', size: [1, 1], surface: 15,
  blurb: 'Just tall enough for a lamp, a book and a cup of warm milk.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = WD.walnut;
    for (const [x, z] of [[-3.6, 3.6], [3.6, 3.6], [-3.6, -3.6], [3.6, -3.6]]) out.push(...turned(x, z, 13.4, c, 0.9));
    out.push(box(0, 4, 0, 8.6, 1, 8.6, joinery(c, { axis: 'x' })));
    out.push(box(0, 10, 0, 8.4, 3.4, 8.4, joinery(c, { axis: 'x' })), box(0, 10.4, 4.3, 6, 2.6, 0.5, drawerFace(c, { pull: MET.brass })));
    out.push(...disc(0, 13.4, 0, 5.6, 1.2, joinery(c, { axis: 'x', plank: 3 })));
    // crochet doily
    const doily: Painter = (t) => {
      const d = Math.hypot(t.x, t.z), a = Math.atan2(t.z, t.x);
      if (d > 3.6 + Math.cos(a * 8) * 0.6) return -1;
      if (Math.floor(d) % 2 === 1 && Math.floor(a * 6 + 32) % 2 === 0) return -1;
      return tone(R('#fbf6ea'), 0.2);
    };
    out.push(box(0, 14.6, 0, 9.6, 0.2, 9.6, doily, { cut: true }));
    out.push(box(-2.6, 4.9, 0, 3.6, 1.2, 4.4, spine('#3f6fb4')), box(-2.4, 6.1, 0, 3.4, 1, 4, spine('#d9a33a')));
    return out;
  },
});

add({
  id: 'vanity', model: 'items/vanity.glb', name: 'Gilded Vanity', cat: 'tables', price: 560, rarity: 'rare', size: [2, 2], surface: 13,
  blurb: 'Feather-preening station with an oval mirror that flatters every angle.',
  sit: [{ x: 0, y: 0, z: 11, rot: 180 }],
  build: () => {
    const out: BoxSpec[] = [];
    const c = '#f2e6d4', trim = metal(MET.gold);
    for (const x of [-9.6, 9.6]) for (const z of [-3.6, 3.6]) out.push(...turned(x, z, 9, c, 0.8));
    out.push(box(0, 9, 0, 21, 3.4, 9, joinery(c, { axis: 'x' })));
    for (const x of [-6, 6]) out.push(box(x, 9.4, 4.5, 7.4, 2.6, 0.6, drawerFace(c, { pull: MET.gold })));
    out.push(box(0, 12.4, 0, 22, 0.8, 10, joinery('#e8d6c0', { axis: 'x' })), box(0, 12.2, 5, 22.4, 0.4, 0.4, trim));
    // oval mirror on two posts
    const mirrorP: Painter = (t) => {
      const u = (t.u + 0.5) / t.w - 0.5, v = (t.v + 0.5) / t.h - 0.5;
      if (Math.hypot(u * 1.2, v) > 0.5) return -1;
      if (Math.hypot(u * 1.2, v) > 0.43) return tone(R(MET.gold), 1 - v * 2);
      const d = (u - v) * 10;
      if (Math.abs(d - 1.5) < 0.45 || Math.abs(d - 3) < 0.25) return 0xffffff;
      return tone(R('#b8d4e0'), 0.6 + v * 1.6 - Math.abs(u) * 1.2);
    };
    out.push(box(0, 15, -3.2, 13, 16, 0.8, mirrorP, { cut: true }), box(0, 31, -3.2, 3, 1.4, 1, trim), box(0, 32.4, -3.2, 1.4, 1, 1, trim));
    for (const s of [-1, 1]) out.push(box(s * 7.4, 13.2, -3.2, 1.2, 12, 1.2, wy('#e8d6c0')), box(s * 7.4, 25.2, -3.2, 1.6, 1, 1.6, trim), box(s * 6.6, 21.5, -3.2, 1.2, 1.2, 1, trim));
    // perfume bottles and a jewellery box at the ends, leaving the middle free
    out.push(box(-8.6, 13.2, 1, 2, 3, 2, glassP('#f2b8d8'), { glass: true }), box(-8.6, 13.4, 1, 1.6, 2.2, 1.6, smooth('#e888b8')), box(-8.6, 16.2, 1, 1, 1, 1, trim), box(-8.6, 17.2, 1, 1.6, 1.4, 1.6, smooth('#e888b8')));
    out.push(box(-6, 13.2, 2.2, 1.6, 2.4, 1.6, glassP('#c8e8f8'), { glass: true }), box(-6, 13.4, 2.2, 1.2, 1.6, 1.2, smooth('#88c8e8')), box(-6, 15.6, 2.2, 0.8, 1.2, 0.8, trim));
    out.push(box(7.6, 13.2, 1, 5, 2.6, 3.6, fab('#4a3a7a', { pipe: MET.gold })), { ...box(7.6, 15.8, -0.8, 5, 2.6, 0.6, fab('#4a3a7a', { pipe: MET.gold })), rot: [-70, 0, 0] as Vec3, pivot: [7.6, 15.8, -0.8] as Vec3 });
    out.push(box(7, 15.4, 1.4, 1, 1, 1, smooth('#e83a5a')), box(8.4, 15.2, 0.6, 1, 1, 1, smooth('#3ae0c0')), box(7.8, 15.2, 2.2, 2.2, 0.4, 0.4, trim));
    // the matching stool
    for (const x of [-3.4, 3.4]) for (const z of [9, 14]) out.push(...turned(x, z, 6, c, 0.6));
    out.push(...disc(0, 6, 11.5, 4.6, 2, fab('#e8a0b8', { tuft: 3 }), {}, 3.6), ...disc(0, 6, 11.5, 4.9, 0.6, solid('#f2e6d4')), ...disc(0, 8, 11.5, 3.6, 0.6, fab('#e8a0b8'), { skip: 'd' }, 2.6));
    return out;
  },
});

add({
  id: 'workbench', model: 'items/workbench.glb', name: 'Tinkerer’s Workbench', cat: 'tables', price: 520, rarity: 'rare', size: [2, 1], surface: 14,
  blurb: 'For fixing clocks, carving whistles and building things nobody asked for.',
  build: () => {
    const out: BoxSpec[] = [];
    const block: Painter = (t) => tone(R('#d9a865'), lvl(t, { noise: 0.3 }) + (t.face === 2 || t.face === 4 ? (Math.floor((t.x + 64) / 2) % 2 ? 0.4 : -0.3) : 0) + ((t.face === 4 || t.face === 5) && t.v % 3 === 0 ? -0.6 : 0));
    for (const x of [-11, 11]) for (const z of [-3.6, 3.6]) out.push(box(x, 0, z, 2.4, 12, 2.4, wy(WD.dark)));
    out.push(box(0, 3, 0, 22, 1, 9, wx(WD.oak, 3)), box(0, 12, 0, 26, 2.4, 10, block));
    // crates and a can of nails on the low shelf
    out.push(box(-6, 4, 0, 7, 5, 6.6, wx(WD.light, 2)), box(-6, 8.6, 0, 6, 0.6, 5.6, solid('#3a2a20')), box(4, 4, 0.6, 5, 4, 5, wx(WD.pale, 2)), box(9, 4, 1, 2.6, 3.4, 2.6, metal(MET.pewter)));
    // pegboard with tools
    const peg: Painter = (t) => (t.face === 4 && t.u % 3 === 1 && t.v % 3 === 1 ? tone(R('#6a4a2c'), -1.5) : tone(R('#c9a878'), lvl(t, { noise: 0.2, rim: 0.6 })));
    out.push(box(0, 14.4, -4.6, 24, 14, 0.8, peg));
    for (const x of [-12.4, 12.4]) out.push(box(x, 14.4, -4.6, 1.2, 14.6, 1.6, wy(WD.dark)));
    out.push(box(0, 28.4, -4.6, 26, 1.2, 1.8, wx(WD.dark, 0)));
    // hammer, saw, wrench, screwdriver and a coil of string
    out.push(box(-8, 18, -3.8, 1, 7, 0.8, wy(WD.oak)), box(-8, 24.4, -3.8, 3.6, 1.6, 1, metal(MET.iron)));
    const saw: Painter = (t) => (t.face === 4 && t.v === 0 && t.u % 2 === 0 ? -1 : metal(MET.silver)(t));
    out.push(box(-2.4, 17, -3.9, 6, 3.6, 0.3, saw, { cut: true }), box(1.4, 18, -3.8, 2.4, 3.6, 0.8, wx(WD.cherry, 0)));
    out.push(box(5.6, 17.4, -3.8, 0.9, 6, 0.6, metal(MET.pewter)), box(5.6, 23, -3.8, 2.4, 1.6, 0.6, metal(MET.pewter)), box(5.6, 16.6, -3.8, 2, 1.4, 0.6, metal(MET.pewter)));
    out.push(box(9.4, 19, -3.8, 0.6, 3, 0.6, metal(MET.silver)), box(9.4, 22, -3.8, 1.2, 3, 1.2, smooth('#d8433f')));
    out.push(...ring8(-8.4, 15, -3.4, 1.8, 2.4, 0.8, solid('#e8d8b4', { noise: 0.4 }), {}, 6));
    // a vice on the corner, a little clock being repaired, gears and shavings
    out.push(box(10.6, 14.4, 3, 4, 2.4, 3, metal('#4a6a8a')), box(10.6, 16.8, 3, 3.6, 1.4, 1, metal('#4a6a8a')), box(10.6, 14.6, 5.2, 0.6, 0.6, 3.4, metal(MET.silver)));
    out.push(...disc(-4, 14.4, 2, 2.6, 1.6, metal(MET.brass)), box(-4, 15.6, 2, 3.6, 0.6, 3.6, (t) => (t.face === 2 ? (Math.hypot(t.bx - 1.8, t.bz - 1.8) < 1.6 ? 0xf6f0e0 : 0xb8902a) : 0xb8902a)), box(-4, 16.2, 2, 0.4, 0.2, 1.4, solid('#2a1d16', { noise: 0 })));
    const gear: Painter = (t) => (t.face === 2 && (Math.floor(Math.atan2(t.bz - t.sz / 2, t.bx - t.sx / 2) * 3 + 32) % 2 === 0 && Math.hypot(t.bx - t.sx / 2, t.bz - t.sz / 2) > 1.1) ? -1 : Math.hypot(t.bx - t.sx / 2, t.bz - t.sz / 2) < 0.6 ? -1 : metal(MET.brass)(t));
    out.push(box(2, 14.4, 2.6, 3, 0.6, 3, gear, { cut: true }), box(4.4, 14.4, 1, 2, 0.6, 2, gear, { cut: true }));
    for (let i = 0; i < 6; i++) out.push({ ...box(-10 + hash(i, 1, 2) * 8, 14.4, 1 + hash(i, 2, 2) * 3, 1.4, 0.3, 0.6, solid('#f2d8a8', { noise: 0 })), rot: [0, hash(i, 3, 2) * 180, 0] as Vec3 });
    return out;
  },
});

// ------------------------------------------------------------------ storage

add({
  id: 'painted_dresser', model: 'items/painted_dresser.glb', name: 'Painted Dresser', cat: 'storage', price: 480, rarity: 'uncommon', size: [2, 1], surface: 20,
  blurb: 'Sage-green, flower-painted, and full of perfectly folded nightcaps.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = '#8fb39a';
    const flowered = (base: Painter): Painter => (t) => {
      if (t.face === 4 && t.w > 8 && t.h >= 5) {
        const fx = [Math.floor(t.w * 0.22), Math.floor(t.w * 0.78)];
        for (const x of fx) {
          const du = t.u - x, dv = t.v - Math.floor(t.h / 2);
          if (du === 0 && dv === 0) return 0xf6d04a;
          if (Math.abs(du) + Math.abs(dv) === 1) return 0xf2a7b8;
          if (Math.abs(du) === 2 && dv === -1) return 0x5f9a52;
        }
      }
      return base(t);
    };
    for (const x of [-9.6, 9.6]) for (const z of [-3.6, 3.6]) out.push(...disc(x, 0, z, 1.4, 1.6, wy(WD.walnut)));
    out.push(box(0, 1.6, 0, 22, 2, 10, (t) => (t.face === 4 && t.v === 0 && Math.abs(((t.u + 0.5) % 5) - 2.5) < 1.6 ? -1 : joinery(c, { axis: 'x' })(t)), { cut: true }));
    out.push(box(0, 3.4, 0, 21, 15.6, 10, joinery(c, { axis: 'y' })));
    out.push(box(-5.3, 14.4, 5.2, 10, 3.6, 0.6, flowered(drawerFace(c, { pull: MET.brass }))), box(5.3, 14.4, 5.2, 10, 3.6, 0.6, flowered(drawerFace(c, { pull: MET.brass }))));
    out.push(box(0, 9.4, 5.2, 20.6, 4.4, 0.6, flowered(drawerFace(c, { pull: MET.brass, pulls: 2 }))), box(0, 4.4, 5.2, 20.6, 4.4, 0.6, flowered(drawerFace(c, { pull: MET.brass, pulls: 2 }))));
    out.push(box(0, 19, 0, 23, 1, 11, joinery(WD.light, { axis: 'x', plank: 4 })));
    // one drawer is a little open: a sock is escaping
    out.push(box(-6, 18.6, 5.8, 3, 0.6, 1.4, knit('#e86a5a', { stripe: '#f6ecd6', every: 1 })), box(-6.8, 16, 6.2, 1.4, 3, 0.8, knit('#e86a5a', { stripe: '#f6ecd6', every: 1 })));
    return out;
  },
});

add({
  id: 'library_case', model: 'items/library_case.glb', name: 'Library Bookcase', cat: 'storage', price: 560, rarity: 'rare', size: [2, 1], surface: 42,
  blurb: 'Four shelves of adventures, recipes, star charts and one diary with a tiny lock.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = WD.walnut, fr = joinery(c, { axis: 'y' });
    out.push(box(0, 0, 0, 22, 2, 9, joinery(c, { axis: 'x' })), box(-10.2, 0, 0, 1.6, 40, 9, fr), box(10.2, 0, 0, 1.6, 40, 9, fr), box(0, 1, -4, 19, 38, 1, wy(WD.dark, 4)));
    out.push(box(0, 39.6, 0, 23, 1.6, 10, joinery(c, { axis: 'x' })), box(0, 41.2, 0.4, 24, 1, 10.6, wx(c, 0)), box(0, 38.4, 4.6, 20, 1.2, 0.6, (t) => tone(R(c), t.u % 3 === 0 ? -1.2 : 0.6)));
    const shelfY = [2, 11.4, 20.8, 30.2];
    for (const y of shelfY.slice(1)) out.push(box(0, y - 1, 0, 18.8, 1, 8.4, wx(WD.light, 0)), box(0, y - 1, 4.2, 18.8, 1, 0.4, wx(c, 0)));
    out.push(...shelfBooks(-9.2, 5, 2, 3.8, 6.4, 8, 11), ...shelfBooks(-9.2, 9, 11.4, 3.8, 6.4, 7.6, 12, { gapAt: 1 }), ...shelfBooks(-2, 9.2, 20.8, 3.8, 6.4, 8, 13), ...shelfBooks(-9.2, 3, 30.2, 3.8, 6.4, 7.8, 14));
    // trinkets in the gaps: a lantern jar, an owl figurine, a plant that trails over the edge, a globe
    out.push(...jar(7, 2, 1, 4, '#f6d06a'));
    out.push(box(1, 11.4, 1, 3, 3.4, 3, smooth('#c9a878')), box(1, 14.8, 1, 3.2, 2.6, 3, smooth('#c9a878')), box(0.2, 15.8, 2.6, 0.8, 0.8, 0.2, solid('#2a1d16', { noise: 0 })), box(1.8, 15.8, 2.6, 0.8, 0.8, 0.2, solid('#2a1d16', { noise: 0 })), box(1, 15.4, 2.6, 0.6, 0.6, 0.4, smooth('#f2b632')));
    out.push(...sprig(-6, 20.8, 1, '#5a78b8', '#4f9e45', 3), box(-7.4, 15.4, 4, 1, 5.6, 1, leaves('#4f9e45', { seed: 2 })), box(-7, 13.6, 4.4, 1, 2, 1, leaves('#5aaa4a', { seed: 5 })));
    out.push(...ball(6.6, 31.4, 0.6, 2.6, (t) => (hash(Math.floor((t.x + 64) / 1.5), Math.floor((t.y + 64) / 1.5), Math.floor((t.z + 64) / 1.5), 3) > 0.55 ? tone(R('#63b556'), lvl(t, { noise: 0.2 })) : tone(R('#4a9be0'), lvl(t, { noise: 0.2 })))), box(6.6, 30.2, 0.6, 3, 1.2, 3, metal(MET.brass)));
    out.push(box(-1, 42.2, 0.6, 5, 1.6, 4, spine('#7a4fa8')), box(-0.6, 43.8, 0.6, 4.4, 1.4, 3.6, spine('#d9a33a')));
    return out;
  },
});

add({
  id: 'toy_chest', model: 'items/toy_chest.glb', name: 'Pine Toy Chest', cat: 'storage', price: 340, rarity: 'uncommon', size: [2, 1],
  blurb: 'A sturdy pine box for toys, blankets and anything that needs hiding before guests arrive.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = '#3f5a9a';
    const stars: Painter = (t) => {
      if (t.face === 4 || t.face === 0 || t.face === 1 || t.face === 5) {
        const gx = Math.floor((t.u + 2) / 5), gy = Math.floor((t.v + 1) / 4);
        const cu = gx * 5 + 0 - 2 + (gy % 2) * 2, cv = gy * 4 + 1;
        const du = Math.abs(t.u - cu), dv = Math.abs(t.v - cv);
        if ((du === 0 && dv <= 1) || (dv === 0 && du <= 1)) return du + dv === 0 ? 0xfff6c8 : 0xf2c84a;
      }
      return joinery(c, { axis: 'x' })(t);
    };
    out.push(box(0, 0, 0, 19, 1.4, 10, wx(WD.dark, 0)), box(0, 1.4, 0, 18, 9, 9, stars));
    for (const x of [-7, 7]) out.push(box(x, 1.4, 4.6, 1.2, 9, 0.6, metal(MET.brass)));
    out.push(box(0, 10.4, 0, 19, 0.8, 10, wx('#e8d6b0', 0)));
    // the lid, open on its hinges
    out.push(...turn([box(0, 10.4, -4.8, 19, 1.6, 10, stars), box(0, 12, -4.8, 18, 0.8, 9, joinery(c, { axis: 'x' }))], [-105, 0, 0], [0, 11.2, -4.8]));
    // teddy, ball, wooden sword, a little rocket
    const ted = smooth('#c08850');
    out.push(box(-4, 8, 0, 5, 6, 4, ted), box(-4, 14, 0, 5, 4.4, 4, ted), box(-6, 18, 0, 1.6, 1.6, 1.4, ted), box(-2, 18, 0, 1.6, 1.6, 1.4, ted), box(-4, 15, 2.2, 2.4, 1.6, 1, smooth('#e8c8a0')), box(-4, 16, 2.8, 0.8, 0.6, 0.4, solid('#2a1d16', { noise: 0 })));
    out.push(box(-5.2, 16.8, 2.1, 0.8, 0.8, 0.2, solid('#2a1d16', { noise: 0 })), box(-2.8, 16.8, 2.1, 0.8, 0.8, 0.2, solid('#2a1d16', { noise: 0 })), box(-4, 13.6, 2.1, 4, 0.8, 0.6, fab('#d8433f')));
    out.push(...ball(3, 8.4, 0.6, 2.6, (t) => tone(R(['#e5484d', '#fbf6ea', '#4aa8f0', '#f6c531'][(Math.floor((t.x + 64) / 1.6) + Math.floor((t.z + 64) / 1.6)) % 4]), lvl(t, { noise: 0.1 }) + 0.2)));
    out.push(lean(box(6.6, 8, -1, 1, 9, 0.6, wy(WD.light)), 0, 0, -18), lean(box(6.2, 10.6, -1, 3, 0.8, 1, wy(WD.dark)), 0, 0, -18));
    out.push(lean(box(0.6, 9, -2.4, 2.4, 6, 2.4, smooth('#f6f0e4')), 10, 0, 8), lean(box(0.6, 15, -2.4, 1.4, 1.6, 1.4, smooth('#e5484d')), 10, 0, 8));
    return out;
  },
});

add({
  id: 'armoire', model: 'items/armoire.glb', name: 'Grand Armoire', cat: 'storage', price: 0, gems: 90, rarity: 'epic', size: [2, 1],
  blurb: 'Carved with oak leaves. One door is always a little open, just in case.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = '#8a5636', fr = joinery(c, { axis: 'y' });
    const arched = (mirror: boolean): Painter => {
      const base = joinery(c, { axis: 'y' });
      return (t) => {
        if (t.face !== 4) return base(t);
        const u = t.u - (t.w - 1) / 2, top = t.h - 4 - Math.sqrt(Math.max(0, 9 - u * u)) * 0;
        const inArch = t.u >= 2 && t.u <= t.w - 3 && t.v >= 2 && t.v <= t.h - 3 - Math.max(0, Math.abs(u) - 1.5) && t.v <= top + 1;
        if (mirror && inArch && !(t.u === 2 || t.u === t.w - 3 || t.v === 2)) {
          const d = (t.u - t.v * 0.6) % 9;
          if (Math.abs(d - 3) < 0.6) return 0xffffff;
          return tone(R('#a8c8d4'), 0.4 + (t.v / t.h) * 1.2);
        }
        if (inArch) return tone(R(c), (t.u === 2 || t.v === t.h - 3 - Math.max(0, Math.abs(u) - 1.5)) ? -1.4 : 0.5 + lvl(t, { noise: 0.2 }) * 0.4);
        return base(t);
      };
    };
    for (const x of [-9.6, 9.6]) for (const z of [-3.8, 3.8]) out.push(box(x, 0, z, 2.4, 2.4, 2.4, wy(WD.dark)));
    out.push(box(0, 2.4, 0, 22, 4.6, 10.6, joinery(c, { axis: 'x' })), box(0, 3, 5.4, 19, 3.4, 0.6, drawerFace(c, { pull: MET.gold, pulls: 2 })));
    out.push(box(-10.2, 7, 0, 1.6, 31, 10.6, fr), box(10.2, 7, 0, 1.6, 31, 10.6, fr), box(0, 7, -4.8, 19, 31, 1, wy(WD.dark, 4)));
    out.push(box(4.8, 7, 4.9, 9.6, 30.4, 0.8, arched(true)), box(1.4, 21, 5.6, 1, 2.4, 0.8, metal(MET.gold)));
    // inside: a hat on the shelf, a scarf and a hanging coat
    out.push(box(-5, 28, 0, 9, 0.8, 9, wx(WD.light, 0)), box(-5, 28.8, 0, 6, 1, 5, smooth('#3a3a6a')), box(-5, 29.8, 0, 4, 3, 3.4, smooth('#3a3a6a')), box(-5, 30.4, 0, 4.2, 0.8, 3.6, fab('#d8433f')));
    out.push(box(-5, 25.4, 0, 9, 0.6, 0.6, metal(MET.brass)), box(-6, 13, 0, 5, 12.4, 3, fab('#e8a24a', { stitch: '#fbf4e4' })), box(-6, 25, 0, 1, 1, 1, metal(MET.brass)));
    out.push(box(-2.6, 12, 1, 2.4, 14, 1, knit('#5f9a52', { stripe: '#f6ecd6', every: 2 })), box(-5, 7.4, 1, 3, 2, 5, smooth('#6a3a2a')), box(-1.6, 7.4, 1, 3, 2, 5, smooth('#6a3a2a')));
    // the other door, swung open on its hinge
    out.push({ ...box(-4.8, 7, 4.9, 9.6, 30.4, 0.8, arched(false)), rot: [0, -62, 0] as Vec3, pivot: [-9.6, 7, 5.3] as Vec3 });
    out.push({ ...box(-1.4, 21, 5.6, 1, 2.4, 0.8, metal(MET.gold)), rot: [0, -62, 0] as Vec3, pivot: [-9.6, 7, 5.3] as Vec3 });
    // cornice with a carved oak-leaf crest
    out.push(box(0, 38, 0, 23, 1.6, 11.4, joinery(c, { axis: 'x' })), box(0, 39.6, 0, 24.6, 1.4, 12.4, wx(c, 0)), box(0, 41, 0.6, 22, 0.8, 11, wx(c, 0)));
    const crest: Painter = (t) => {
      if (t.face !== 4 && t.face !== 5) return wy(c)(t);
      const u = (t.u + 0.5) / t.w - 0.5, v = (t.v + 0.5) / t.h;
      if (v > 1 - Math.abs(u) * 2.4 + Math.sin(u * 30) * 0.08) return -1;
      if (Math.hypot(u * 4, v - 0.45) < 0.24) return tone(R(MET.gold), 1);
      return tone(R(c), lvl(t, { noise: 0.2 }) + (Math.floor(Math.abs(u) * 14) % 2 ? 0.5 : -0.4));
    };
    out.push(box(0, 41.8, 4.4, 16, 7, 1, crest, { cut: true }));
    return out;
  },
});

add({
  id: 'cubby_shelf', model: 'items/cubby_shelf.glb', name: 'Cubby Shelf', cat: 'storage', price: 380, rarity: 'uncommon', size: [2, 1], surface: 25,
  blurb: 'Nine little rooms waiting for nine little treasures.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = WD.birch, fr = joinery(c, { axis: 'y' }), sh = joinery(c, { axis: 'x' });
    out.push(box(0, 0, 0, 25, 1.4, 10, sh), box(0, 23.6, 0, 25, 1.4, 10, sh), box(0, 1.4, -4.6, 24, 22.2, 0.8, wy('#c9a878', 4)));
    for (const x of [-12, -4, 4, 12]) out.push(box(x, 1.4, 0, 1.2, 22.2, 10, fr));
    for (const y of [8.2, 15.8]) out.push(box(0, y - 0.6, 0, 24, 1.2, 10, sh));
    const cell = (i: number, j: number) => [-8 + i * 8, 1.4 + j * 7.6] as const;
    // baskets with fabric liners
    for (const [i, j, col] of [[0, 0, '#e9a9a1'], [2, 0, '#9ec3d9'], [1, 2, '#b9d49a']] as const) {
      const [x, y] = cell(i, j);
      out.push(box(x, y, 0.6, 6.4, 5, 7.6, wickerP('#c4904f')), box(x, y + 5, 0.6, 6.8, 0.8, 8, wickerP('#a8733c')), box(x, y + 4.6, 4.6, 5, 1.6, 0.4, fab(col, { stitch: '#fbf4e4' })));
      out.push(box(x, y + 2.8, 4.5, 2, 1, 0.3, wickerP('#8a5a2c')));
    }
    // folded blankets, books, a plant and a jar of buttons
    { const [x, y] = cell(1, 0); out.push(box(x, y, 0.4, 6.4, 1.6, 7, knit('#c9656f')), box(x, y + 1.6, 0.4, 6.4, 1.6, 7, knit('#f2d27a')), box(x, y + 3.2, 0.4, 6.4, 1.6, 7, knit('#5a78b8', { stripe: '#f6ecd6', every: 1 }))); }
    { const [x, y] = cell(0, 1); out.push(...shelfBooks(x - 3.2, x + 3.4, y, 4, 6, 6.6, 21)); }
    { const [x, y] = cell(2, 1); out.push(...sprig(x, y, 0.6, '#f2e6d4', '#4f9e45', 5), box(x + 2.6, y + 2, 3.6, 1, 3, 1, leaves('#4f9e45', { seed: 4 }))); }
    { const [x, y] = cell(1, 1); out.push(...jar(x - 1.4, y, 1, 4, '#e86a5a'), box(x + 2, y, 1, 2.4, 1.6, 2.4, glaze('#5a78b8'))); }
    { const [x, y] = cell(0, 2); out.push(box(x, y, 0.6, 5, 3, 4, glaze('#f2e6d4', { band: '#3f6fb4', bands: [1, 2] })), box(x, y + 3, 0.6, 2, 1.6, 2, glaze('#f2e6d4'))); }
    { const [x, y] = cell(2, 2); out.push(box(x - 1, y, 0, 3, 6, 4, paper('#f1e2bd')), box(x + 1.4, y, 0.6, 2, 2.4, 2, smooth('#f6c531')), box(x + 1.4, y + 2.4, 0.6, 1.4, 1, 1.4, smooth('#e5484d'))); }
    return out;
  },
});

add({
  id: 'apothecary', model: 'items/apothecary.glb', name: 'Apothecary Cabinet', cat: 'storage', price: 600, rarity: 'rare', size: [1, 1], surface: 27,
  blurb: 'Twenty labelled drawers: chamomile, lavender, valerian, and one marked “do not”.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = '#6a4a3a';
    out.push(box(0, 0, 0, 15, 2, 9, joinery(WD.dark, { axis: 'x' })), box(0, 2, 0, 14, 23, 8, joinery(c, { axis: 'y' })));
    const labelled = (seed: number): Painter => {
      const base = drawerFace('#8a5a3a');
      return (t) => {
        if (t.face === 4 && t.w >= 4 && t.h >= 3 && t.v === t.h - 2 && t.u >= 1 && t.u <= t.w - 2) return hash(t.u, seed, 1) > 0.5 ? 0xf4ead0 : 0xe8dcb8;
        if (t.face === 4 && t.v === 1 && Math.abs(t.u - (t.w - 1) / 2) < 0.8) return tone(R(MET.brass), 1.2);
        return base(t);
      };
    };
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) out.push(box(-4.95 + i * 3.3, 2.5 + j * 4.4, 4.2, 3.1, 4.1, 0.6, labelled(i * 7 + j)));
    out.push(box(0, 25, 0, 16, 1.4, 10, joinery(WD.dark, { axis: 'x' })));
    // mortar and pestle, jars of dried herbs, a little brass scale
    out.push(box(-4.8, 26.4, 1, 3.4, 2.4, 3.4, glaze('#d8d0c0')), box(-4.8, 28, 1, 2.4, 0.6, 2.4, solid('#5f8a45')), lean(box(-4.4, 27.4, 1, 0.8, 4, 0.8, smooth('#e8dcc8')), 0, 0, -24));
    out.push(...jar(-0.6, 26.4, -2, 5, '#a67ce2'), ...jar(2.4, 26.4, -2, 4, '#f2c84a'));
    out.push(box(4.6, 26.4, 1.6, 3, 0.6, 2, metal(MET.brass)), box(4.6, 27, 1.6, 0.6, 4, 0.6, metal(MET.brass)), box(4.6, 31, 1.6, 5, 0.4, 0.4, metal(MET.brass)), box(2.4, 29.2, 1.6, 1.8, 0.4, 1.8, metal(MET.brass)), box(6.8, 29.6, 1.6, 1.8, 0.4, 1.8, metal(MET.brass)));
    return out;
  },
});

export const TABLES_AND_STORAGE: ItemDef[] = items;
