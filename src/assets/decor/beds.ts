// Beds and seating for the bigger house: bunk beds, a canopy bed, a hammock bed, nests, sofas and chairs.
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../../gfx/box.ts';
import { tone } from '../../gfx/color.ts';
import { leaves, lvl, metal, R, smooth, solid } from '../../gfx/mats.ts';
import { hash } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';
import { ball, chain, disc, drawerFace, fab, fluff, joinery, knit, MET, patchwork, plaid, ring8, sag, turn, WD, wickerP, wx, wy, wz } from './kit.ts';

const items: ItemDef[] = [];
const add = (d: ItemDef) => items.push(d);

const ticking = fab('#f2ead8', { stripe: '#8fb0d0', stripeAxis: 'z', stripeW: 1, stripeGap: 3, weave: 0.12 });
/** A plump pillow: a body and a softer puff on top, with piping. */
const pillow = (x: number, y: number, z: number, w: number, h: number, d: number, p: Painter, ry = 0): BoxSpec[] => {
  const b = [box(x, y, z, w, h, d, p), box(x, y + h, z, w - 2, 1, d - 2, p, { skip: 'd' }), box(x, y + 1, z, w + 0.6, h - 2, d - 2, p)];
  return ry ? turn(b, [0, ry, 0], [x, y, z]) : b;
};

// ------------------------------------------------------------------ beds

add({
  id: 'bunk_bed', name: 'Pinewood Bunk Bed', cat: 'beds', price: 680, rarity: 'rare', size: [3, 2],
  blurb: 'Top bunk for stargazing, bottom bunk for hiding from Monday.',
  sleep: { x: 2, y: 10, z: 0, rot: 90 },
  build: () => {
    const post = joinery(WD.light, { axis: 'y' }), rail = joinery(WD.light, { axis: 'x' }), end = joinery(WD.light, { axis: 'z' });
    const out: BoxSpec[] = [];
    for (const x of [-16.5, 16.5]) for (const z of [-8, 8]) {
      out.push(box(x, 0, z, 2.6, 46, 2.6, post), box(x, 46, z, 3.2, 1, 3.2, post), box(x, 47, z, 2.2, 1.6, 2.2, solid(WD.light, { noise: 0.3 })));
      out.push(box(x, 0, z, 3.2, 1, 3.2, wy(WD.dark)));
    }
    const quilts = [patchwork(['#e9a9a1', '#f6e6c6', '#9ec3d9', '#b9d49a'], { size: 4, seam: '#fbf4e4' }), knit('#5a78b8', { stripe: '#f2e4c8', every: 4 })];
    [4, 26].forEach((y0, i) => {
      for (const z of [-8, 8]) out.push(box(0, y0, z, 30.4, 3, 1.6, rail));
      out.push(box(0, y0 + 0.6, 0, 30.4, 1, 14.4, wx(WD.pale, 3)));
      out.push(box(0, y0 + 1.6, 0, 30, 3.4, 14.6, ticking));
      // headboard slats at the left, low footboard at the right
      out.push(box(-16.5, y0 + 3, 0, 1.6, 2, 14, end), box(-16.5, y0 + 11, 0, 1.6, 2, 14, end));
      for (const z of [-4.5, 0, 4.5]) out.push(box(-16.5, y0 + 5, z, 1.2, 6, 2.4, wy(WD.light)));
      out.push(box(16.5, y0 + 3, 0, 1.6, 4, 14, end));
      // quilt: lies on top and folds down over the front and back edges
      const q = quilts[i];
      out.push(box(4, y0 + 5, 0, 22, 1.2, 15.6, q), box(4, y0 + 1.4, 7.7, 22, 4, 1, q), box(4, y0 + 1.4, -7.7, 22, 4, 1, q));
      out.push(box(-6.4, y0 + 5.2, 0, 3, 1.4, 15.6, i ? fab('#f2e4c8') : fab('#fbf4e4', { stitch: '#e9a9a1' })));
      out.push(...pillow(-11.6, y0 + 5, 0, 6, 2.4, 10, fab('#fbf4e4', { pipe: '#e8c8a0', weave: 0.1 })));
    });
    // a guard rail with spindles along the top bunk, leaving room for the ladder
    out.push(box(-4, 35.5, 8, 23, 1.6, 1.6, rail));
    for (let x = -14; x <= 6; x += 4) out.push(box(x, 31, 8, 1.2, 4.6, 1.2, wy(WD.light)));
    // ladder
    for (const x of [9.5, 14.4]) out.push(box(x, 0, 9.8, 1.4, 36, 1.4, wy(WD.light)));
    for (let y = 5; y < 34; y += 5.5) out.push(box(12, y, 9.8, 5.6, 1.2, 1.2, wx(WD.dark, 0)));
    // a sleepy plush on the top bunk and a little pennant on the footboard
    out.push(box(8, 32.4, -2, 4, 4, 3, smooth('#c79a6a')), box(8, 36.4, -2, 4.4, 3, 3.4, smooth('#c79a6a')), box(6.7, 37.6, -0.2, 1, 1, 0.4, solid('#2a1d16', { noise: 0 })), box(9.3, 37.6, -0.2, 1, 1, 0.4, solid('#2a1d16', { noise: 0 })), box(8, 36.6, -0.2, 1, 1, 0.6, smooth('#f2b632')));
    out.push({ ...box(17.9, 24, 0, 0.6, 6, 8, fab('#d8433f', { pipe: '#f2b632' }), { cut: true }) });
    return out;
  },
});

add({
  id: 'canopy_bed', name: 'Rosewood Canopy Bed', cat: 'beds', price: 0, gems: 120, rarity: 'epic', size: [3, 2],
  blurb: 'Draped in dusk-pink voile. Dreams in here come with a soundtrack.',
  sleep: { x: 3, y: 10, z: 0, rot: 90 },
  build: () => {
    const post = joinery(WD.walnut, { axis: 'y' }), rail = joinery(WD.walnut, { axis: 'x' }), railZ = joinery(WD.walnut, { axis: 'z' });
    const gold = metal(MET.gold), voile = R('#f2b8c0');
    const drape: Painter = (t) => {
      const fold = (Math.floor(t.u / 2) + (t.face === 4 || t.face === 5 ? 0 : 1)) % 2;
      if (t.v < 1 && t.u % 2 === 1) return -1;
      return tone(voile, lvl(t, { noise: 0.1, speck: 0, rim: 0.3 }) + (fold ? 0.5 : -0.6) + (t.v === 0 ? -0.4 : 0));
    };
    const valance: Painter = (t) => {
      if (t.face !== 2 && t.face !== 3) {
        const k = ((t.u + 0.5) % 6) - 3, depth = 3 - Math.sqrt(Math.max(0, 9 - k * k));
        if (t.v < depth) return -1;
        if (t.v === t.h - 1 || t.v === t.h - 3) return tone(R(MET.gold), t.v === t.h - 1 ? 1 : 0);
      }
      return tone(voile, lvl(t, { noise: 0.15 }) + ((t.u >> 1) % 2 ? 0.3 : -0.3));
    };
    const out: BoxSpec[] = [];
    for (const x of [-16.5, 16.5]) for (const z of [-10, 10]) {
      out.push(box(x, 0, z, 3, 3, 3, wy(WD.walnut)), box(x, 3, z, 2.2, 49, 2.2, post));
      for (const y of [12, 22, 40]) out.push(box(x, y, z, 3, 1.2, 3, gold));
      out.push(box(x, 52, z, 2.6, 2, 2.6, gold), box(x, 54, z, 1.4, 1.4, 1.4, gold));
    }
    for (const z of [-10, 10]) out.push(box(0, 49, z, 31, 2, 1.6, rail), box(0, 4, z, 31, 4, 1.6, rail));
    for (const x of [-16.5, 16.5]) out.push(box(x, 49, 0, 1.6, 2, 18.4, railZ), box(x, 4, 0, 1.6, 4, 18.4, railZ));
    // canopy roof and scalloped valance
    out.push(box(0, 51, 0, 34, 0.8, 22, fab('#f2b8c0', { weave: 0.15 }), { skip: 'd' }));
    out.push(box(0, 46.4, 11, 34, 4.4, 0.6, valance, { cut: true }), box(0, 46.4, -11, 34, 4.4, 0.6, valance, { cut: true }));
    out.push({ ...box(17, 46.4, 0, 22, 4.4, 0.6, valance, { cut: true }), rot: [0, 90, 0] as Vec3 }, { ...box(-17, 46.4, 0, 22, 4.4, 0.6, valance, { cut: true }), rot: [0, 90, 0] as Vec3 });
    // drapes gathered at the four posts, tied back with gold cord
    for (const sx of [-1, 1]) {
      const x = sx * 13.4, z = 11.6;
      out.push(box(x, 34, z, 7, 12.4, 0.8, drape, { cut: true }), box(x + sx * 1.6, 22, z, 3, 12, 0.8, drape, { cut: true }), box(x + sx * 1, 3, z, 5.4, 19, 0.8, drape, { cut: true }));
      out.push(box(x + sx * 1.6, 25, z + 0.4, 3.8, 1.2, 1, gold), box(x + sx * 0.4, 22.6, z + 0.6, 1, 2.6, 0.8, gold), box(x + sx * 0.4, 21.4, z + 0.6, 1.6, 1.2, 1, metal('#e89a3a')));
    }
    // a sheer panel along the back, gathered into folds
    out.push(box(0, 8, -11.4, 30, 38, 0.8, drape, { cut: true }));
    // carved headboard with a crescent window
    const head: Painter = (t) => {
      if (t.face === 0 || t.face === 1) {
        const u = t.u - t.w / 2 + 0.5, v = t.v - 8;
        if (Math.hypot(u, v) < 4 && Math.hypot(u - 1.8, v - 1) > 3.2) return -1;
        if (t.v > t.h - 3 && Math.abs(u) > t.w / 2 - 1 - (t.h - 1 - t.v) * 2) return -1;
      }
      return joinery(WD.walnut, { axis: 'z' })(t);
    };
    out.push(box(-16.6, 8, 0, 1.4, 16, 18.4, head, { cut: true }), box(-16.6, 24, 0, 1.6, 1.2, 12, gold));
    out.push(box(16.6, 8, 0, 1.4, 5, 18.4, railZ));
    // bedding: mattress, tufted duvet with a turned-down sheet, pillows, a bolster and a throw
    out.push(box(0, 7, 0, 31, 4, 19, ticking));
    const duvet = fab('#fbf1e4', { tuft: 4, stitch: '#e9c8b0', weave: 0.1 });
    out.push(box(4, 11, 0, 23, 1.6, 20, duvet), box(4, 6.6, 10.1, 23, 5, 1, duvet), box(4, 6.6, -10.1, 23, 5, 1, duvet));
    out.push(box(-7.2, 11.2, 0, 3, 1.6, 20, fab('#f2b8c0', { stitch: '#fbf1e4' })));
    out.push(...pillow(-12.4, 11, -4.4, 5, 3, 8, fab('#fbf1e4', { pipe: '#f2b8c0' }), -8), ...pillow(-12.4, 11, 4.4, 5, 3, 8, fab('#fbf1e4', { pipe: '#f2b8c0' }), 8));
    out.push(box(-9.6, 11, 0, 3, 3, 9, fab('#c9656f', { stripe: '#f2b632', stripeAxis: 'z', stripeW: 1, stripeGap: 2 })));
    out.push(box(12, 12.4, 0, 6, 1.4, 20.6, knit('#e8d6b0', { stripe: '#c9656f', every: 2 })), box(12, 7.6, 10.4, 6, 5, 1, knit('#e8d6b0', { stripe: '#c9656f', every: 2 })));
    return out;
  },
});

add({
  id: 'hammock_bed', name: 'Woven Hammock Bed', cat: 'beds', price: 540, rarity: 'rare', size: [3, 2],
  blurb: 'Rocks you to sleep in a cradle of macrame and one very soft blanket.',
  sleep: { x: 0, y: 9, z: 0, rot: 90 },
  build: () => {
    const out: BoxSpec[] = [];
    const leg = joinery(WD.ash, { axis: 'y' });
    for (const s of [-1, 1]) {
      // an A-frame at each end, splayed out, with a crossbar
      out.push(lean(box(s * 19, 0, 5, 2.2, 27, 2.2, leg), -11, 0, 0), lean(box(s * 19, 0, -5, 2.2, 27, 2.2, leg), 11, 0, 0));
      out.push(box(s * 19, 25.4, 0, 3, 2, 3, wy(WD.dark)), box(s * 19, 6, 0, 1.6, 1.6, 11, wz(WD.ash, 0)));
      out.push(box(s * 19, 0, 0, 3, 1.4, 14, wz(WD.dark, 0)));
    }
    out.push(box(0, 0.6, 0, 36, 1.6, 2, wx(WD.ash, 0)));
    // ropes from the frame to the bed, then the netted bed as a sagging curve
    const rope = solid('#e8d8b4', { noise: 0.3, speck: 0.2 });
    for (const s of [-1, 1]) for (const z of [-3, 0, 3]) out.push(...chain([[s * 18.6, 26, 0], [s * 12.6, 14, z]], 0.8, rope));
    const net: Painter = (t) => {
      const a = (Math.floor(t.x + 64) + Math.floor(t.z + 64)) % 4, b = (Math.floor(t.x + 64) - Math.floor(t.z + 64) + 256) % 4;
      if (t.face === 2 && (a === 0 || b === 0)) return tone(R('#f2e6c8'), 0.6);
      return tone(R('#d8c49a'), lvl(t, { noise: 0.2 }) - (t.face === 3 ? 1 : 0) + ((t.u + t.v) & 1 ? 0.3 : -0.3));
    };
    const blanket = plaid('#4f8a6a', '#2f5a48', '#f2d27a', 6);
    for (let i = 0; i < 7; i++) {
      const x = -12 + i * 4, y = 9 + 4.6 * (x / 12) ** 2, slope = (Math.atan((2 * 4.6 * x) / 144) * 180) / Math.PI;
      out.push({ ...box(x, y, 0, 4.4, 1, 12, net), rot: [0, 0, slope] as Vec3, pivot: [x, y, 0] as Vec3 });
      if (i < 6) for (const z of [-6.4, 6.4]) out.push({ ...box(x, y - 2.4, z, 1, 3, 0.6, rope), rot: [0, 0, slope] as Vec3, pivot: [x, y, z] as Vec3 });
      if (i >= 2) out.push({ ...box(x, y + 1, 0, 4.4, 1.2, 12.6, blanket), rot: [0, 0, slope] as Vec3, pivot: [x, y, 0] as Vec3 });
    }
    // the blanket spills over the front edge
    out.push(box(4, 4.6, 6.8, 14, 6, 0.8, blanket));
    out.push(...pillow(-8.8, 10.4, 0, 5, 2.6, 8, fab('#f6ecd6', { pipe: '#4f8a6a' }), 0));
    out.push(box(-1, 10.6, 3, 3, 3, 3, smooth('#efe4cf')), box(-1, 13.4, 3, 3.4, 2.6, 3, smooth('#efe4cf')), box(-2.2, 14.6, 4.6, 0.8, 0.8, 0.4, solid('#2a1d16', { noise: 0 })), box(0.2, 14.6, 4.6, 0.8, 0.8, 0.4, solid('#2a1d16', { noise: 0 })));
    return out;
  },
});

add({
  id: 'basket_nest', name: 'Mossy Basket Nest', cat: 'beds', price: 260, rarity: 'uncommon', size: [2, 2],
  blurb: 'A round wicker basket with a plump cushion. Circle three times, then flop.',
  sleep: { x: 0, y: 6, z: 0 },
  build: () => {
    const out: BoxSpec[] = [];
    const wk = wickerP('#c4904f'), rim = wickerP('#a8733c', { scale: 1 });
    out.push(...disc(0, 0, 0, 11, 1.2, wk, { skip: 'd' }));
    out.push(...ring8(0, 1, 0, 11.4, 5, 2.2, wk, {}, 12));
    out.push(...ring8(0, 5.6, 0, 12, 2.4, 3.4, rim, {}, 12));
    out.push(...disc(0, 1.2, 0, 9.6, 3.4, fab('#9a6aa8', { tuft: 4, stitch: '#d8b8e0' }), { skip: 'd' }));
    out.push(...disc(0, 4.6, 0, 7.6, 1, fab('#9a6aa8', { tuft: 4 }), { skip: 'd' }));
    // moss tufts, a few sprigs of clover and a knitted blanket over the rim
    const moss = leaves('#5f9a45', { seed: 4, bloom: '#f4f0d8', rate: 0.06 });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.4;
      out.push(box(Math.sin(a) * 11.6, 7.4, Math.cos(a) * 11.6, 2.6 + (i % 3), 1.6, 2.6, moss, { skip: 'd' }));
    }
    const k = knit('#e8a24a', { stripe: '#f6e6c6', every: 2 });
    out.push(box(6, 6.4, 7, 7, 1.2, 6, k), { ...box(8.4, 2, 11.4, 6, 5, 1, k), rot: [0, 40, 0] as Vec3 });
    // a tiny plush mouse with a pink nose
    out.push(box(-4, 5.6, -2, 3, 2.4, 4, smooth('#c9c3d6')), box(-4, 6.6, 0.4, 1, 1, 1, smooth('#f2a7b8')), box(-5, 8, -2.6, 1.4, 1.4, 0.6, smooth('#e8b8c8')), box(-3, 8, -2.6, 1.4, 1.4, 0.6, smooth('#e8b8c8')));
    return out;
  },
});

add({
  id: 'floor_futon', name: 'Tatami Futon', cat: 'beds', price: 360, rarity: 'uncommon', size: [3, 2],
  blurb: 'Low, quiet and smells faintly of rice straw. Comes with a bedside tea tray.',
  sleep: { x: 2, y: 5, z: 0, rot: 90 },
  build: () => {
    const out: BoxSpec[] = [];
    const tatami: Painter = (t) => {
      const edgeZ = Math.abs(t.z) > 10.6;
      if (edgeZ) return tone(R('#2f4a3a'), lvl(t, { noise: 0.1 }) + ((t.x + 64) % 3 < 1 ? 0.6 : 0));
      return tone(R('#c9c07a'), lvl(t, { noise: 0.25, rim: 0.3 }) + ((Math.floor(t.z + 64) & 1) ? 0.35 : -0.35));
    };
    out.push(box(0, 0, 0, 38, 1, 24, tatami, { skip: 'd' }));
    out.push(box(0, 1, 0, 32, 3, 18, fab('#f4f0e4', { stitch: '#c8c0b0' })));
    const quilt = fab('#3b5a8a', { tuft: 5, stitch: '#f2e4c8' });
    const wave: Painter = (t) => (t.face === 2 && (Math.floor(t.x + 64) + Math.floor(2 * Math.sin((t.z + 64) * 0.6))) % 6 === 0 ? tone(R('#9ec3e9'), 0.4) : quilt(t));
    out.push(box(5, 4, 0, 22, 1.6, 18.6, wave), box(5, 1, 9.3, 22, 3.4, 1, wave));
    out.push(box(-6.6, 4.2, 0, 4, 2.8, 18.6, wave), box(-4.6, 4, 0, 1.4, 1.6, 18.6, fab('#f4f0e4')));
    out.push(...pillow(-12.6, 4, 0, 5, 2.4, 9, fab('#e8dcc0', { stripe: '#c9a878', stripeAxis: 'x', stripeW: 1, stripeGap: 1 }), 0));
    // bedside tray: a tiny teapot, a cup and a little alarm clock
    out.push(box(-14, 1, 14, 9, 1, 7, wx(WD.dark, 0)), box(-16, 2, 14, 3, 2.6, 3, smooth('#6a8a5a')), box(-16, 4.6, 14, 1.6, 0.8, 1.6, smooth('#6a8a5a')), { ...box(-14.2, 3, 14, 1.6, 0.8, 0.8, smooth('#6a8a5a')), rot: [0, 0, 25] as Vec3 });
    out.push(box(-12.4, 2, 15.4, 2, 1.6, 2, smooth('#f4f0e4')), box(-11.6, 2, 12.6, 3, 3, 1.6, smooth('#e5604d')), box(-11.6, 3.5, 13.45, 2, 2, 0.2, smooth('#fbf6ea')), box(-12.6, 5, 12.6, 1, 1, 1, metal(MET.gold)), box(-10.6, 5, 12.6, 1, 1, 1, metal(MET.gold)));
    return out;
  },
});

// ------------------------------------------------------------------ seating

add({
  id: 'patch_sofa', name: 'Patchwork Sofa', cat: 'seating', price: 620, rarity: 'rare', size: [3, 1],
  blurb: 'Three seats, eleven fabrics and one crumb-filled crack nobody talks about.',
  sit: [{ x: -9, y: 9, z: 1 }, { x: 0, y: 9, z: 1 }, { x: 9, y: 9, z: 1 }],
  build: () => {
    const out: BoxSpec[] = [];
    const base = fab('#8a5a7a', { pipe: '#5a3a52' }), arm = fab('#8a5a7a', { stitch: '#c9a0b8' });
    for (const x of [-16, 16]) for (const z of [5, -5]) out.push(box(x, 0, z, 2, 2, 2, wy(WD.walnut)), box(x, 0, z, 1.4, 0.6, 1.4, metal(MET.brass)));
    out.push(box(0, 2, 0, 34, 4, 14, base));
    const seats = [patchwork(['#e9a9a1', '#f2d27a', '#9ec3d9'], { size: 3, seed: 1 }), patchwork(['#b9d49a', '#f6e6c6', '#e9a9a1'], { size: 3, seed: 2 }), patchwork(['#9ec3d9', '#f2d27a', '#c9a0d8'], { size: 3, seed: 3 })];
    seats.forEach((p, i) => out.push(box(-10 + i * 10, 6, 1.4, 9.6, 3, 11, fab('#f6e6c6', { pipe: '#8a5a7a' })), box(-10 + i * 10, 8.6, 1.6, 9.2, 1, 10.6, p)));
    out.push(box(0, 6, -5.4, 31, 12, 3.4, fab('#8a5a7a', { tuft: 4, weave: 0.18 })), box(0, 18, -5.4, 32, 1.4, 3.8, base));
    for (let i = 0; i < 3; i++) out.push(box(-10 + i * 10, 9, -3.4, 9.4, 8, 1.6, fab('#a06a90', { tuft: 3, stitch: '#d8b0c8' })));
    // rolled arms
    for (const s of [-1, 1]) out.push(box(s * 16, 6, 0, 3, 6, 14, arm), box(s * 16, 12, 0, 4, 2, 14.4, arm), box(s * 16, 12.4, 7.3, 4, 2, 0.6, fab('#5a3a52')));
    // throw pillows and a knitted throw over one arm
    out.push({ ...box(-11, 9.6, -1.6, 6, 6, 2.4, fab('#f2d27a', { pipe: '#d8433f', check: '#e9b850', checkSize: 1 })), rot: [-12, 12, 8] as Vec3 });
    out.push({ ...box(11, 9.6, -1.6, 6, 6, 2.4, fab('#9ec3d9', { pipe: '#fbf4e4', tuft: 3 })), rot: [-12, -10, -8] as Vec3 });
    const k = knit('#f6e6c6', { stripe: '#e07a5a', every: 3 });
    out.push(box(16, 14, 0, 4.6, 1, 8, k), box(18.4, 6, 0, 0.8, 9, 8, k));
    return out;
  },
});

add({
  id: 'beanbag', name: 'Squashy Beanbag', cat: 'seating', price: 180, rarity: 'common', size: [1, 1],
  blurb: 'Swallows you whole, in a nice way.',
  sit: [{ x: 0, y: 6, z: 1 }],
  build: () => {
    // corduroy: soft vertical ridges, panels joined by darker seams that run up to a top button
    const a = R('#d9733f'), b = R('#e89a52');
    const p: Painter = (t) => {
      const ang = (Math.atan2(t.z + 0.01, t.x) / Math.PI + 1) * 3;
      const seg = Math.floor(ang) % 2, f = ang % 1;
      let L = lvl(t, { noise: 0.25, speck: 0.1, rim: 0.4 }) + (t.u % 2 ? 0.3 : -0.25);
      if (t.face === 2) L += ((Math.floor(t.x + 64) + Math.floor(t.z + 64)) % 2 ? 0.2 : -0.1);
      if (f < 0.07 || f > 0.93) return tone(seg ? a : b, L - 1.3);
      return tone(seg ? a : b, L);
    };
    const out = [...ball(0, 0, 0, 8.4, p, {}, 1.2, 0.55), ...ball(-0.4, 4.6, -2.2, 5.6, p, {}, 1, 0.9)];
    out.push(...disc(0.6, 7.4, 2.6, 3.6, 1.2, (t) => tone(a, lvl(t, { noise: 0.2 }) - 0.7), { skip: 'd' }));
    out.push(box(-0.4, 14.6, -2.2, 1.4, 0.8, 1.4, fab('#7a3a22')), box(0, 9, -7.6, 3, 1.2, 1, fab('#7a3a22')), box(0, 9.4, -8.1, 1.6, 0.6, 0.4, solid('#f6ecd6', { noise: 0 })));
    return out;
  },
});

add({
  id: 'rocking_chair', name: 'Grandmother Rocking Chair', cat: 'seating', price: 420, rarity: 'uncommon', size: [1, 2],
  blurb: 'Creaks in exactly the right rhythm for knitting and for napping.',
  sit: [{ x: 0, y: 9, z: 1 }],
  build: () => {
    const out: BoxSpec[] = [];
    const wd = joinery(WD.cherry, { axis: 'y' }), wdz = joinery(WD.cherry, { axis: 'z' });
    // curved rockers as arcs of short segments
    for (const x of [-5, 5]) {
      const pts: Vec3[] = Array.from({ length: 8 }, (_, i) => { const a = -0.62 + (i / 7) * 1.24; return [x, 26 - Math.cos(a) * 26 + 0.8, Math.sin(a) * 26] as Vec3; });
      out.push(...chain(pts, 1.6, wz(WD.cherry, 0)));
      out.push(box(x, 1.4, 4.4, 1.6, 7, 1.6, wd), box(x, 1.4, -4, 1.6, 7, 1.6, wd));
    }
    out.push(box(0, 8, 0.4, 12, 1.4, 11, joinery(WD.cherry, { axis: 'x' })));
    // spindle back, leaning back a touch, with a curved crest rail
    const back = [box(0, 9.4, -5.2, 12, 1.4, 1.4, wx(WD.cherry, 0)), box(0, 25, -5.2, 13, 2.2, 1.6, joinery(WD.cherry, { axis: 'x' })), box(0, 27.2, -5.2, 8, 1, 1.4, wx(WD.cherry, 0))];
    for (const x of [-5.8, 5.8]) back.push(box(x, 9.4, -5.2, 1.6, 16, 1.6, wd));
    for (const x of [-3, -1, 1, 3]) back.push(box(x, 10.8, -5.2, 0.9, 14.2, 0.9, wy(WD.cherry)));
    out.push(...turn(back, [-10, 0, 0], [0, 9, -5]));
    // arms
    for (const x of [-6.2, 6.2]) out.push(box(x, 14, 0, 1.6, 1.2, 11, wdz), box(x, 9.4, 4.6, 1.2, 4.6, 1.2, wy(WD.cherry)));
    // a tied-on cushion and a granny-square blanket over the back
    out.push(box(0, 9.4, 0.6, 10.4, 1.8, 9.6, fab('#d8a24a', { tuft: 4, pipe: '#a86a2a' })));
    const granny: Painter = (t) => {
      const cs = ['#d8433f', '#f2d27a', '#5f9a52', '#5a78b8', '#f6ecd6'];
      const a = t.face < 2 ? t.z : t.x, b = t.y;
      const ca = Math.floor((a + 64) / 3), cb = Math.floor((b + 64) / 3);
      const ia = Math.floor(((a + 64) % 3)), ib = Math.floor(((b + 64) % 3));
      if (ia === 1 && ib === 1) return tone(R(cs[(ca + cb) % 4]), 0.4);
      return tone(R(ia === 0 || ib === 0 ? '#3a2a24' : cs[(ca * 3 + cb) % 5]), lvl(t, { noise: 0.2 }) * 0.6 + ((t.u + t.v) & 1 ? 0.2 : -0.2));
    };
    out.push(...turn([box(0, 17, -4.2, 12.4, 9, 0.8, granny), box(0, 25.4, -5.2, 12.4, 1, 2.6, granny)], [-10, 0, 0], [0, 9, -5]));
    // yarn basket on the floor
    out.push(...disc(9.6, 0, 6, 2.6, 3, wickerP('#b98445')), ...ball(9.2, 2.6, 6.2, 1.6, smooth('#5a78b8')), ...ball(10.4, 2.6, 5.4, 1.4, smooth('#d8433f')));
    out.push({ ...box(9.6, 3, 6, 0.4, 0.4, 6, metal(MET.silver)), rot: [30, 40, 0] as Vec3 });
    return out;
  },
});

add({
  id: 'window_seat', name: 'Window-Nook Bench', cat: 'seating', price: 460, rarity: 'uncommon', size: [3, 1], surface: 8,
  blurb: 'A cushioned nook with drawers underneath for secret snacks and storm-day books.',
  sit: [{ x: -8, y: 9, z: 1 }, { x: 6, y: 9, z: 1 }],
  build: () => {
    const out: BoxSpec[] = [];
    const paint = '#6f9a8a';
    out.push(box(0, 0, 0, 36, 1.4, 12, wx(WD.dark, 0)), box(0, 1.4, 0, 35, 5.6, 11, joinery(paint, { axis: 'x' })));
    for (const x of [-8.6, 0, 8.6]) out.push(box(x, 1.9, 5.6, 8, 4.6, 0.6, drawerFace(paint, { pull: MET.brass })));
    for (const x of [-13.5]) out.push(box(x, 1.9, 5.6, 5.4, 4.6, 0.6, drawerFace(paint, { keyhole: true })));
    out.push(box(13.5, 1.9, 5.6, 5.4, 4.6, 0.6, drawerFace(paint, { keyhole: true })));
    out.push(box(0, 7, 0, 36, 1, 12.4, wx(WD.light, 0)));
    // the panelled back and side cheeks
    out.push(box(0, 8, -5.4, 36, 12, 1.6, joinery(paint, { axis: 'x', plank: 4 })), box(0, 20, -5.4, 37, 1.4, 2.6, wx(WD.light, 0)));
    for (const s of [-1, 1]) out.push(box(s * 17.4, 8, 0, 1.6, 8, 12, joinery(paint, { axis: 'z' })), box(s * 17.4, 16, 0, 2.2, 1, 12.6, wx(WD.light, 0)));
    // cushion, bolsters and pillows
    out.push(box(0, 8, 0.6, 33, 2.4, 10, fab('#e8d6b0', { pipe: '#c9656f', stitch: '#c9a878' })));
    for (const s of [-1, 1]) out.push(box(s * 14.2, 10.4, 0.6, 4, 3.4, 9.6, fab('#c9656f', { stripe: '#f2d27a', stripeAxis: 'z', stripeW: 1, stripeGap: 2 })));
    out.push({ ...box(-6, 10.4, -3, 7, 6, 2.4, plaid('#3b5a8a', '#f2d27a', '#d8433f', 6)), rot: [-14, 8, 0] as Vec3 });
    out.push({ ...box(3, 10.4, -3, 6, 5.6, 2.4, fab('#f6ecd6', { tuft: 3, pipe: '#6f9a8a' })), rot: [-14, -8, 0] as Vec3 });
    // an open book left on the cushion
    out.push({ ...box(9, 10.4, 2, 3, 0.6, 4, solid('#fbf4e4', { noise: 0.1 })), rot: [0, 10, 10] as Vec3 }, { ...box(11.8, 10.4, 2.4, 3, 0.6, 4, solid('#fbf4e4', { noise: 0.1 })), rot: [0, 10, -10] as Vec3 }, box(10.4, 10.2, 2.2, 6.4, 0.4, 4.6, smooth('#3f78c9')));
    return out;
  },
});

add({
  id: 'toad_stool', name: 'Toadstool Seat', cat: 'seating', price: 120, rarity: 'common', size: [1, 1], surface: 11,
  blurb: 'A sturdy mushroom that agreed to be sat on. Spots are hand-painted.',
  sit: [{ x: 0, y: 11, z: 0 }],
  build: () => {
    const cap = R('#d8402f'), spot = R('#fbf4e4');
    const spots: [number, number, number, number][] = [[1.5, 11, 1.2, 1.5], [-3, 11, -1.6, 1.3], [1, 11, -4, 1.1], [-2.6, 10.6, 3.6, 1], [4.4, 10.4, -1.2, 1.1],
      [7.8, 8.2, 1.6, 1.4], [-6.6, 8.2, 4.4, 1.4], [0.6, 8.2, 7.8, 1.5], [5.4, 8.2, -5.6, 1.3], [-6.8, 8.2, -3.6, 1.2], [4.8, 8.2, 6, 1.1], [-2, 8.2, -7.6, 1.2]];
    const capP: Painter = (t) => {
      if (t.face === 3) return tone(R('#efe0c4'), ((Math.floor(Math.atan2(t.z, t.x) * 6 + 32) & 1) ? -0.6 : 0.3) - 0.4 - (Math.hypot(t.x, t.z) < 4.5 ? 0.6 : 0));
      for (const [x, y, z, r] of spots) if (Math.hypot(t.x - x, (t.y - y) * 0.8, t.z - z) < r) return tone(spot, lvl(t, { noise: 0.1 }) * 0.5 + 0.5);
      return tone(cap, lvl(t, { noise: 0.25 }) + (t.face === 2 ? 0.2 : 0));
    };
    const stem = solid('#f3e2c2', { noise: 0.35, scale: 2 });
    const out: BoxSpec[] = [...disc(0, 0, 0, 4.4, 1.4, stem, { skip: 'd' }), ...disc(0, 1.4, 0, 3.4, 6, stem)];
    out.push(...disc(0, 7.2, 0, 8, 1.4, capP), ...disc(0, 8.6, 0, 7.4, 1.2, capP, { skip: 'd' }), ...disc(0, 9.8, 0, 6, 0.8, capP, { skip: 'd' }), ...disc(0, 10.6, 0, 4, 0.4, capP, { skip: 'd' }));
    // a little ring skirt and some grass at the foot
    out.push(...disc(0, 5.6, 0, 4.2, 0.8, solid('#f6ecd6', { noise: 0.2 })));
    for (const [x, z] of [[3.6, 2.6], [-3.2, 3], [2, -3.6]]) out.push(box(x, 0, z, 0.6, 2.4, 0.6, solid('#5f9a45')), box(x + 0.6, 0, z, 0.6, 1.6, 0.6, solid('#4f8a3c')));
    return out;
  },
});

add({
  id: 'wingback', name: 'Tartan Wingback', cat: 'seating', price: 520, rarity: 'rare', size: [2, 2],
  blurb: 'Tall wings keep out draughts, gossip and the sound of alarms. Footstool included.',
  sit: [{ x: 0, y: 8, z: 1 }],
  build: () => {
    const out: BoxSpec[] = [];
    const tt = plaid('#7a2a2a', '#2f4a3a', '#e8c46a', 8);
    const legs = (x: number, z: number, h: number) => [box(x, 0, z, 1.6, h, 1.6, wy(WD.walnut)), box(x, 0, z + 0.3, 1.8, 0.8, 2, wy(WD.walnut))];
    for (const x of [-6, 6]) out.push(...legs(x, 5, 3), ...legs(x, -5, 3));
    out.push(box(0, 3, 0, 15, 4.4, 13, tt), box(0, 7.4, 1.6, 11, 2, 10, fab('#7a2a2a', { pipe: '#e8c46a' })));
    out.push(box(0, 7.4, -5.2, 14, 17, 3, tt), box(0, 24.4, -5.2, 10, 2, 3, tt), box(0, 9.4, -3.2, 10, 9, 1.2, fab('#7a2a2a', { tuft: 3 })));
    for (const s of [-1, 1]) {
      out.push(box(s * 6.6, 7.4, 1, 2.4, 4.4, 11, tt), box(s * 6.6, 11.8, 1.4, 3.2, 1.8, 11.6, tt));
      // the wings: tall cheeks that flare forward
      out.push({ ...box(s * 6.9, 13.6, -2.4, 1.6, 10, 5.6, tt), rot: [0, s * -14, 0] as Vec3 });
    }
    // footstool
    for (const x of [-3.6, 3.6]) for (const z of [12, 17]) out.push(...legs(x, z, 2.4));
    out.push(box(0, 2.4, 14.5, 9.6, 3, 7.6, fab('#7a2a2a', { tuft: 3, pipe: '#e8c46a' })));
    out.push(box(2, 5.4, 14, 3, 0.8, 4, solid('#f6ecd6', { noise: 0.1 })), box(2, 6.2, 14, 3.4, 0.8, 4.4, smooth('#2f4a3a')));
    return out;
  },
});

export const BEDS_AND_SEATS: ItemDef[] = items;
