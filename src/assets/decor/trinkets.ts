// Decor and wall pieces: vases, clocks, a record player, framed pictures, maps, mirrors and garlands.
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../../gfx/box.ts';
import { tone } from '../../gfx/color.ts';
import { lamp, leaves, lvl, metal, R, smooth, solid } from '../../gfx/mats.ts';
import { fbm, hash } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';
import { ball, chain, disc, fab, glassP, glaze, joinery, MET, paper, part, phase, pix, pixBoxes, ring8, ring8x, sag, spine, turn, WD, wx, wy, wz } from './kit.ts';

const items: ItemDef[] = [];
const add = (d: ItemDef) => items.push(d);
const gold = metal(MET.gold);

/** A picture frame (front at +z) around a painted canvas; the frame has a lit top edge and corner studs. */
const framed = (x: number, y: number, w: number, h: number, art: Painter, frame: string = MET.gold, depth = 1.2): BoxSpec[] => [
  box(x, y, -0.6, w, h, depth, metal(frame)),
  box(x, y + 1, -0.6 + depth - 0.2, w - 2, h - 2, 0.4, art),
  box(x, y + h - 0.6, depth - 0.4, w, 0.6, 0.4, metal(frame)),
];

// ------------------------------------------------------------------ decor

add({
  id: 'vase_trio', name: 'Glazed Vase Trio', cat: 'decor', price: 160, rarity: 'common', size: [1, 1], small: true,
  blurb: 'Celadon, cornflower and terracotta, with lavender that never needs water.',
  build: () => {
    const out: BoxSpec[] = [];
    const cel = glaze('#8fbfa4', { dip: '#e8e0c8', dipH: 3, seed: 1 });
    out.push(...disc(-2.6, 0, 0, 2.2, 1, cel), ...disc(-2.6, 1, 0, 2.6, 5, cel), ...disc(-2.6, 6, 0, 1.8, 1.4, cel), ...disc(-2.6, 7.4, 0, 1, 3, cel), ...disc(-2.6, 10.4, 0, 1.4, 0.8, cel));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, x = -2.6 + Math.cos(a) * 0.6, z = Math.sin(a) * 0.6;
      out.push(lean(box(x, 10.6, z, 0.4, 5 + (i % 2) * 1.4, 0.4, solid('#6a8a4a', { noise: 0 })), Math.sin(a) * 14, 0, -Math.cos(a) * 14));
      out.push(lean(box(x, 14.2 + (i % 2) * 1.4, z, 0.8, 2, 0.8, solid('#a67ce2', { noise: 0.6, scale: 0.8 })), Math.sin(a) * 14, 0, -Math.cos(a) * 14));
    }
    const blue = glaze('#5a7ac8', { dots: '#f6f0e4', dotRate: 0.1, seed: 2 });
    out.push(...ball(2.6, 0, 1.4, 2.8, blue), ...disc(2.6, 5.2, 1.4, 1.4, 1, blue), box(0.2, 2.6, 1.4, 0.8, 2, 0.8, blue), box(5, 2.6, 1.4, 0.8, 2, 0.8, blue));
    const tc = glaze('#c9683f', { band: '#f6e6c6', bands: [1.5, 3.5], seed: 3 });
    out.push(...disc(0.6, 0, -3, 1.6, 4, tc), ...disc(0.6, 4, -3, 1.1, 0.8, tc), ...disc(0.6, 4.8, -3, 1.6, 0.6, tc));
    return out;
  },
});

add({
  id: 'reading_pile', name: 'Bedtime Reading Pile', cat: 'decor', price: 90, rarity: 'common', size: [1, 1], small: true,
  blurb: 'Five books, one pair of round spectacles and a ribbon marking “just one more chapter”.',
  build: () => {
    const out: BoxSpec[] = [];
    const cols = ['#3f6fb4', '#b8433a', '#4f8a4a', '#d9a33a', '#7a4fa8'];
    let y = 0;
    cols.forEach((c, i) => {
      const w = 9 - (i % 3), h = 1.6 + (i % 2) * 0.4, d = 6 - (i % 2);
      // lying flat: spine faces +z, so turn the spine painter on its side
      const cr = R(c), pg = R('#f4ead0');
      const lying: Painter = (t) => {
        const L = lvl(t, { noise: 0.15, speck: 0.1, rim: 0.4 });
        if (t.face === 4) return t.u === 1 || t.u === t.w - 2 ? tone(R('#f2c84a'), 0.6) : tone(cr, L + (t.v === t.h - 1 ? 0.5 : 0));
        if (t.face === 2 || t.face === 3) return tone(cr, L + (t.v === 1 ? -0.5 : 0));
        return tone(pg, t.v % 2 ? 0.3 : -0.4);
      };
      out.push({ ...box(((i * 37) % 5 - 2) * 0.3, y, 0, w, h, d, lying), rot: [0, ((i * 29) % 30) - 15, 0] as Vec3 });
      y += h;
    });
    out.push(box(1, 0, 3.2, 0.6, 3.6, 0.2, fab('#d8433f')), box(-2, 4, 3, 0.6, 2.6, 0.2, fab('#f2b632')));
    // spectacles on top
    const rim = metal(MET.gold);
    for (const x of [-1.6, 1.6]) out.push(...ring8(x, y, 0.6, 1.3, 0.4, 0.3, rim, {}, 8), box(x, y, 0.6, 2, 0.1, 2, glassP('#e8f4ff'), { glass: true }));
    out.push(box(0, y + 0.1, 0.6, 1, 0.3, 0.3, rim), box(-3, y, -1.4, 0.3, 0.3, 4, rim), box(3, y, -1.4, 0.3, 0.3, 4, rim));
    return out;
  },
});

add({
  id: 'floor_globe', name: 'Explorer’s Floor Globe', cat: 'decor', price: 480, rarity: 'rare', size: [1, 1],
  blurb: 'Turns slowly on its brass meridian. Pip has circled the hollow in ink.',
  build: () => {
    const out: BoxSpec[] = [];
    const st = joinery(WD.walnut, { axis: 'y' });
    for (let i = 0; i < 3; i++) {
      const a = (i * 120 * Math.PI) / 180;
      out.push(lean(box(Math.sin(a) * 4.6, 0, Math.cos(a) * 4.6, 1.6, 13, 1.6, st), -Math.cos(a) * 18, 0, Math.sin(a) * 18));
      out.push(box(Math.sin(a) * 5.4, 0, Math.cos(a) * 5.4, 2.4, 1, 2.4, metal(MET.brass)));
    }
    out.push(...disc(0, 4, 0, 4, 0.8, wy(WD.walnut)));
    // the horizon ring and the brass meridian
    out.push(...ring8(0, 12, 0, 8.4, 1.4, 1.2, joinery(WD.walnut, { axis: 'x' }), {}, 16), ...ring8(0, 13.2, 0, 8.4, 0.3, 1.4, paper('#f2e6c8'), {}, 16));
    const merPts: Vec3[] = Array.from({ length: 11 }, (_, i) => { const a = -0.9 * Math.PI + (i / 10) * 1.8 * Math.PI * 0.62; return [0.6 + Math.cos(a) * 7.8, 13 + Math.sin(a) * 7.8, -0.2] as Vec3; });
    out.push(...chain(merPts, 0.9, metal(MET.brass)), box(0, 21.4, 0, 1.2, 1.6, 1.2, metal(MET.gold)));
    return out;
  },
  parts: () => [part('globe', 'floor_globe', [0, 13, 0], () => {
    const sea = R('#4f8fcf'), land = R('#a8c47a'), dry = R('#d8c08a');
    const g: Painter = (t) => {
      const r = Math.hypot(t.x, t.y - 13, t.z) || 1;
      const lat = Math.asin((t.y - 13) / r), lon = Math.atan2(t.z, t.x);
      const n = fbm(Math.cos(lon) * 1.6 + 5, lat * 1.8, Math.sin(lon) * 1.6 + 5, 3);
      if (Math.abs(lat) > 1.25) return tone(R('#f4f8ff'), 0.4);
      if (Math.abs(((lon * 6 / Math.PI) % 1)) < 0.08 || Math.abs((lat * 6 / Math.PI) % 1) < 0.06) return tone(n > 0.55 ? land : sea, -0.8);
      if (n > 0.55) return tone(n > 0.66 ? dry : land, lvl(t, { noise: 0.2 }) * 0.6 + (n > 0.6 ? 0.4 : -0.2));
      return tone(sea, lvl(t, { noise: 0.15 }) * 0.6 + (n > 0.5 ? 0.6 : 0));
    };
    return [...ball(0, 6.6, 0, 6.4, g), box(0, 19.4, 0, 0.8, 1.2, 0.8, metal(MET.brass)), box(0, 5.6, 0, 0.8, 1.2, 0.8, metal(MET.brass))];
  })],
  animate: (obj, t) => { const g = obj.getObjectByName('globe'); if (g) { g.rotation.y = t * 0.25 + phase(obj); g.rotation.z = 0.36; } },
});

add({
  id: 'mantel_clock', name: 'Pendulum Mantel Clock', cat: 'decor', price: 240, rarity: 'uncommon', size: [1, 1], small: true,
  blurb: 'Tocks softly. Strikes nine for bedtime and absolutely nothing before ten in the morning.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = WD.cherry;
    out.push(box(0, 0, 0, 11, 1.4, 6, joinery(WD.walnut, { axis: 'x' })), box(0, 1.4, 0, 9.4, 12, 5, joinery(c, { axis: 'y' })));
    for (let k = 0; k < 4; k++) out.push(box(0, 13.4 + k, 0, 9.4 - k * 2.4, 1, 5 - k * 0.4, joinery(c, { axis: 'x' })));
    out.push(box(0, 17.4, 0, 1.4, 1.4, 1.4, gold), box(-4.4, 13.4, 2.6, 1, 1, 1, gold), box(4.4, 13.4, 2.6, 1, 1, 1, gold));
    const face: Painter = (t) => {
      if (t.face !== 4) return gold(t);
      const u = t.u - (t.w - 1) / 2, v = t.v - (t.h - 1) / 2, d = Math.hypot(u, v);
      if (d > t.w / 2 - 0.2) return tone(R(MET.gold), 0.6);
      if (d > t.w / 2 - 1.4 && (Math.abs(u) < 0.6 || Math.abs(v) < 0.6)) return 0x2a1d16;
      // hands at ten past nine
      if (v >= -0.3 && v <= 0.3 && u <= 0 && u >= -2.8) return 0x2a1d16;
      if (Math.abs(u - v * 0.55) < 0.45 && v >= 0 && v <= 3) return 0x2a1d16;
      return tone(R('#f6ecd6'), 0.3 - d * 0.08);
    };
    out.push(box(0, 6.4, 2.5, 7.4, 7.4, 0.6, face), box(0, 7.4, 2.8, 5.8, 5.8, 0.4, glassP('#f4fbff'), { glass: true }));
    // the pendulum window
    out.push(box(0, 2, 2.5, 5, 4, 0.4, solid('#3a2420', { noise: 0.2 })), box(0, 2, 2.9, 5.6, 4.4, 0.2, glassP('#f4fbff'), { glass: true }), box(0, 1.8, 2.7, 6, 0.4, 0.4, gold));
    return out;
  },
  parts: () => [part('pendulum', 'mantel_pend', [0, 6.2, 2.7], () => [box(0, 2.4, 2.7, 0.3, 3.8, 0.2, gold), box(0, 2.2, 2.7, 1.6, 1.6, 0.4, gold)])],
  animate: (obj, t) => { const p = obj.getObjectByName('pendulum'); if (p) p.rotation.z = Math.sin(t * Math.PI + phase(obj)) * 0.32; },
});

add({
  id: 'record_player', name: 'Suitcase Record Player', cat: 'decor', price: 380, rarity: 'rare', size: [1, 1], small: true,
  blurb: 'Plays crackly lullabies at 33 and a third. The record really spins.',
  build: () => {
    const out: BoxSpec[] = [];
    const leather: Painter = (t) => tone(R('#6fa8a0'), lvl(t, { noise: 0.5, scale: 1, speck: 0.4 }) * 0.7 + (t.face !== 2 && t.face !== 3 && (t.v === 1 || t.v === t.h - 2) && t.u % 2 === 0 ? 0.9 : 0));
    out.push(box(0, 0, 0, 14, 3.4, 11, leather), box(0, 3.4, 0, 13.4, 0.4, 10.4, solid('#e8dcc8', { noise: 0.2 })));
    for (const [x, z] of [[-6.6, 5.2], [6.6, 5.2], [-6.6, -5.2], [6.6, -5.2]]) out.push(box(x, 0, z, 1.4, 3.8, 1.4, gold));
    out.push(box(0, 1.6, 5.6, 2, 1.4, 0.6, gold), box(-4, 1.6, 5.6, 1, 1, 0.4, solid('#e8dcc8')), box(4.6, 1.6, 5.6, 1.4, 1.4, 0.6, metal(MET.silver)));
    // lid propped open behind, with a little gig poster inside
    const poster = pix(['ssssss', 'smmmms', 'smyyms', 'smmmms', 'sllllls'.slice(0, 6), 'ssssss'], { s: 0x2f3f6a, m: 0x8a6ac8, y: 0xf6d04a, l: 0xf6ecd6 }, leather);
    out.push(...turn([box(0, 3.8, -5.2, 14, 9.4, 1.2, leather), box(0, 4.6, -4.4, 8, 7, 0.4, poster)], [-14, 0, 0], [0, 3.8, -5.8]));
    // platter and record
    const vinyl: Painter = (t) => {
      const d = Math.hypot(t.x + 1.4, t.z - 0.6);
      if (t.face !== 2) return 0x1a1418;
      if (Math.floor(d * 2) % 3 === 0) return 0x2c2630;
      if (Math.abs(t.x + 1.4 - (t.z - 0.6)) < 0.5 && d > 2.4) return 0x5a5060;
      return 0x1e1a22;
    };
    out.push(...disc(-1.4, 3.8, 0.6, 4.8, 0.6, metal(MET.pewter)), ...disc(-1.4, 4.4, 0.6, 4.6, 0.3, vinyl));
    // tonearm
    out.push(box(4.8, 3.8, -2.6, 2, 1.4, 2, metal(MET.silver)), ...chain([[4.8, 5.4, -2.6], [4.4, 5.2, 1.6], [2.4, 5, 3.2]], 0.5, metal(MET.silver)), box(2.2, 4.6, 3.4, 1, 0.6, 1.4, solid('#2a2a30')));
    out.push(box(5.4, 3.8, 3.4, 1.4, 0.8, 1.4, metal(MET.gold)));
    return out;
  },
  parts: () => [part('label', 'record_label', [-1.4, 4.7, 0.6], () => [
    box(-1.4, 4.7, 0.6, 2.6, 0.2, 2.6, (t) => (t.bx < 1.3 ? 0xe8584a : 0xf6d04a)), box(-1.4, 4.9, 0.6, 0.4, 0.4, 0.4, metal(MET.silver)),
    box(0.6, 4.72, 0.6, 2.8, 0.06, 0.4, () => 0x6a6070),
  ])],
  animate: (obj, t) => { const l = obj.getObjectByName('label'); if (l) l.rotation.y = -t * 3.5; },
});

add({
  id: 'rose_tea_set', name: 'Rose Tea Service', cat: 'decor', price: 210, rarity: 'uncommon', size: [1, 1], small: true,
  blurb: 'A rosebud teapot, two cups and shortbread. Chamomile is already steeping.',
  build: () => {
    const out: BoxSpec[] = [];
    const china: Painter = (t) => {
      const h = hash(Math.floor((t.x + 64) / 2), Math.floor((t.y + 64) / 2), Math.floor((t.z + 64) / 2), 5);
      const L = lvl(t, { noise: 0.1, speck: 0, rim: 1 });
      if (t.face !== 3 && h > 0.84) return tone(R('#e8708a'), (Math.floor(t.x + t.y + t.z + 64) & 1) ? 0.5 : -0.3);
      if (t.face !== 3 && h > 0.8) return tone(R('#6aa85a'), 0);
      if (t.face !== 2 && t.face !== 3 && Math.abs(t.by - t.sy + 1) < 0.5) return tone(R(MET.gold), 0.6);
      if ((t.face === 4 || t.face === 0) && t.u === 1 && t.v >= t.h - 3 && t.h > 3) return 0xffffff;
      return tone(R('#f8f4ec'), L);
    };
    const tray: Painter = (t) => (t.face === 2 && (t.u === 1 || t.v === 1 || t.u === t.w - 2 || t.v === t.h - 2) ? tone(R(MET.gold), 1) : metal(MET.silver)(t));
    out.push(box(0, 0, 0, 15, 0.8, 11, tray), box(-7.4, 0.8, 0, 0.6, 0.8, 11, metal(MET.silver)), box(7.4, 0.8, 0, 0.6, 0.8, 11, metal(MET.silver)), box(0, 0.8, 5.4, 15, 0.8, 0.6, metal(MET.silver)), box(0, 0.8, -5.4, 15, 0.8, 0.6, metal(MET.silver)));
    // teapot
    out.push(...ball(-3, 0.8, -1.4, 3.4, china), ...disc(-3, 6.8, -1.4, 1.8, 0.8, china), box(-3, 7.6, -1.4, 1, 1, 1, smooth('#e8708a')));
    out.push(...chain([[0.2, 3, -1.4], [1.6, 4.6, -1.4], [2.4, 6.2, -1.4]], 1, china), ...chain([[-6.2, 5.6, -1.4], [-7.4, 4.6, -1.4], [-6.4, 2.6, -1.4]], 0.8, china));
    // cups on saucers with tea
    const tea: Painter = (t) => (t.face === 2 && t.u > 0 && t.v > 0 && t.u < t.w - 1 && t.v < t.h - 1 ? tone(R('#c9a04a'), 0.6) : china(t));
    for (const [x, z] of [[3.6, 2.6], [4.4, -3]] as const) out.push(...disc(x, 0.8, z, 2.2, 0.4, china), box(x, 1.2, z, 2.6, 2, 2.6, tea), box(x + 1.7, 1.6, z, 0.8, 1.2, 0.6, china));
    // shortbread on a little plate
    out.push(...disc(-2.6, 0.8, 3.6, 2.2, 0.4, china), box(-3.2, 1.2, 3.4, 1.8, 0.6, 1.2, solid('#e8c07a', { noise: 0.5 })), box(-1.8, 1.6, 3.8, 1.8, 0.6, 1.2, solid('#e0b46a', { noise: 0.5 })));
    return out;
  },
});

add({
  id: 'ship_bottle', name: 'Ship in a Bottle', cat: 'decor', price: 300, rarity: 'rare', size: [1, 1], small: true,
  blurb: 'The good ship Hootenanny, sailing a painted sea on the windowsill.',
  build: () => {
    const out: BoxSpec[] = [];
    out.push(box(-4, 0, 0, 2, 2, 4, wz(WD.walnut, 0)), box(4, 0, 0, 2, 2, 4, wz(WD.walnut, 0)), box(0, 0, 0, 12, 0.8, 2, wx(WD.walnut, 0)));
    // the bottle lies on its side along x
    const gl = glassP('#d8f4ec');
    out.push(...ring8x(0, 5.4, 0, 3.6, 13, 0.3, gl, { glass: true }));
    out.push(box(-6.6, 1.8, 0, 0.4, 7.2, 7.2, gl, { glass: true }), box(8, 4.4, 0, 3, 2, 2, gl, { glass: true }), box(10, 4.4, 0, 1.6, 2.2, 2.2, smooth('#2f4a8a')), box(10.9, 4.2, 0, 0.6, 2.6, 2.6, smooth('#2f4a8a')));
    // the sea and the ship inside
    const sea: Painter = (t) => tone(R('#3f7fbf'), (t.face === 2 ? ((Math.floor(t.x + 64) + Math.floor(Math.sin(t.z) * 1.5)) % 3 === 0 ? 1.2 : 0.2) : -0.5));
    out.push(box(0, 2.2, 0, 12, 1.6, 5.4, sea));
    out.push(box(0, 3.6, 0, 6, 1.4, 2, wx(WD.dark, 0)), box(-3.4, 3.8, 0, 1, 1, 1.6, wx(WD.dark, 0)), box(2.6, 5, 0, 2, 0.6, 1.8, wx(WD.dark, 0)));
    out.push(box(-1, 5, 0, 0.4, 3.8, 0.4, wy(WD.light)), box(1.6, 5.6, 0, 0.4, 2.6, 0.4, wy(WD.light)));
    const sail = fab('#f6f0e0', { weave: 0.1 });
    out.push(box(-1, 5.8, 0.4, 3, 2.4, 0.2, sail), box(1.6, 6, 0.4, 2, 1.8, 0.2, sail), box(-1, 8.8, 0, 1.2, 0.6, 0.2, fab('#d8433f')));
    return out;
  },
});

add({
  id: 'mint_typewriter', name: 'Mint Typewriter', cat: 'decor', price: 330, rarity: 'uncommon', size: [1, 1], small: true,
  blurb: 'For dream journals. Clacks quietly, dings politely at the end of each line.',
  build: () => {
    const out: BoxSpec[] = [];
    const body = solid('#8fcfb8', { noise: 0.3, speck: 0.2 });
    out.push(box(0, 0, 0, 13, 2.4, 10, body), { ...box(0, 2, 1.6, 12, 2, 6, body), rot: [14, 0, 0] as Vec3 }, box(0, 2.4, -3, 13, 3, 4, body));
    // three rows of round keys
    for (let r = 0; r < 3; r++) for (let k = 0; k < 8 - (r === 2 ? 1 : 0); k++) {
      const x = -5.2 + k * 1.5 + (r === 2 ? 0.75 : 0), z = 3.6 - r * 1.6, y = 3 + r * 0.45;
      out.push(box(x, y, z, 1, 0.8, 1, solid('#2a2a30', { noise: 0 })), box(x, y + 0.8, z, 0.8, 0.2, 0.8, solid('#f6f0e0', { noise: 0 })));
    }
    out.push(box(0, 3.2, 5, 6, 0.8, 1, solid('#2a2a30', { noise: 0 })));
    // platen, paper with typed lines, return lever
    out.push(box(0, 5.4, -3, 15, 2, 2, solid('#2a2a30', { noise: 0.1 })), box(-8, 5.6, -3, 1.4, 1.6, 1.6, metal(MET.silver)), box(8, 5.6, -3, 1.4, 1.6, 1.6, metal(MET.silver)));
    const sheet: Painter = (t) => (t.face === 4 && t.v % 2 === 1 && t.u > 0 && t.u < t.w - 2 - (t.v * 3) % 4 && t.v < t.h - 1 ? 0x4a4a58 : tone(R('#fbf8ee'), lvl(t, { noise: 0.1 }) * 0.4));
    out.push({ ...box(0, 6.4, -3.4, 8, 8, 0.3, sheet), rot: [-8, 0, 0] as Vec3, pivot: [0, 6.4, -3.4] as Vec3 });
    out.push(...chain([[-7.6, 6.6, -3], [-9.4, 7.4, -1.4], [-9.8, 7.4, 0]], 0.6, metal(MET.silver)));
    return out;
  },
});

// ------------------------------------------------------------------ decor on the wall

const PIP = [
  'SSbSSSSSSbSS',
  'SSbbSSSSbbSS',
  'SbbbbbbbbbbS',
  'SbffffffffbS',
  'bfwwwffwwwfb',
  'bfwkwffwkwfb',
  'bfwwwyywwwfb',
  'bbfffyyfffbb',
  'SbbccccccbbS',
  'SbbcbccbcbbS',
  'SSbbccccbbSS',
  'GGGyGGGGyGGG',
];
const PIP_PAL = { S: 0x8fb8e0, b: 0x8a5a34, f: 0xf2dcb0, w: 0xfff6e0, k: 0x2a1d16, y: 0xf2b632, c: 0xf6e6c8, G: 0x5a3a22 };
const SUNSET = ['ppppppp', 'pppyypp', 'ooyyyoo', 'ooommoo', 'ommmmmo', 'mmMmmMm', 'gggMggg', 'ggggggg'];
const SUN_PAL = { p: 0xf4a6a0, o: 0xf6c08a, y: 0xfff0a0, m: 0x6a6aa8, M: 0x8a8ac8, g: 0x5f9a52 };
const FLOWER = ['cccccc', 'ccppcc', 'cpyypc', 'ccppcc', 'cccgcc', 'ccgggc', 'cccgcc', 'cccgcc'];
const FLOWER_PAL = { c: 0xf4ead0, p: 0xe8708a, y: 0xf6d04a, g: 0x5f9a52 };

add({
  id: 'photo_frames', name: 'Family Picture Wall', cat: 'decor', price: 220, rarity: 'uncommon', size: [2, 1], wall: true,
  blurb: 'A portrait of Pip on a branch, a sunset over the far hills and one pressed rosebud.',
  build: () => {
    const out: BoxSpec[] = [];
    out.push(...framed(0, 0, 16, 16, pix(PIP, PIP_PAL, solid('#8fb8e0')), MET.gold, 1.4));
    out.push(...framed(-13, 4, 9, 11, pix(SUNSET, SUN_PAL, solid('#f4a6a0')), WD.walnut));
    out.push(...framed(12.4, 2, 8, 10, pix(FLOWER, FLOWER_PAL, solid('#f4ead0')), '#e8e0d0'));
    // the strings and nails they hang from
    out.push(box(0, 18.6, 0, 0.8, 0.8, 1.6, metal(MET.iron)), ...chain([[-6, 15.2, 0.2], [0, 18.6, 0.4], [6, 15.2, 0.2]], 0.3, solid('#c9a878', { noise: 0 })));
    return out;
  },
});

add({
  id: 'sunburst_mirror', name: 'Sunburst Mirror', cat: 'decor', price: 360, rarity: 'rare', size: [2, 1], wall: true,
  blurb: 'Gilded rays around a round looking-glass. Mornings look brighter in it, somehow.',
  build: () => {
    const out: BoxSpec[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 360, len = i % 2 ? 6 : 9;
      out.push({ ...box(0, 10, 0, 1.6, len, 0.8, metal(i % 2 ? MET.brass : MET.gold)), at: [-0.8, 10 + 6, -0.4] as Vec3, rot: [0, 0, a] as Vec3, pivot: [0, 10, 0] as Vec3 });
      if (i % 2 === 0) out.push({ ...box(0, 10, 0, 1.4, 1.4, 1, gold), at: [-0.7, 10 + 6 + len, -0.5] as Vec3, rot: [0, 0, a] as Vec3, pivot: [0, 10, 0] as Vec3 });
    }
    const glassFace: Painter = (t) => {
      const u = t.x, v = t.y - 10, d = Math.hypot(u, v);
      if (t.face !== 2) return gold(t);
      if (d > 6.2) return tone(R(MET.gold), 0.8 - (d - 6.2));
      const k = (u - v) * 0.9;
      if (Math.abs(k + 2) < 0.6 || Math.abs(k + 3.6) < 0.35) return 0xffffff;
      return tone(R('#b8d0dc'), 0.7 + v * 0.1 - d * 0.05);
    };
    out.push(...disc(0, 9.4, 0, 7.6, 1.2, gold).map((b) => ({ ...b, rot: [90, 0, 0] as Vec3, pivot: [0, 10, 0] as Vec3 })));
    out.push(...disc(0, 9.4, 0.6, 6.6, 1.2, glassFace).map((b) => ({ ...b, rot: [90, 0, 0] as Vec3, pivot: [0, 10, 0.6] as Vec3 })));
    return out;
  },
});

add({
  id: 'owl_tapestry', name: 'Owl Crest Tapestry', cat: 'decor', price: 280, rarity: 'uncommon', size: [1, 1], wall: true,
  blurb: 'Hand-stitched with the hollow’s crest: an owl, a moon and seven sleepy stars.',
  build: () => {
    const out: BoxSpec[] = [];
    const crest = [
      '.............',
      '..y...y...y..',
      '.............',
      '....bbbbb....',
      '...bwwbwwb...',
      '...bwkbkwb...',
      '...bbbybbb...',
      '....bcccb....',
      '....bcccb....',
      '.....bbb.....',
      '..gggggggg...',
      '.............',
      '..y.......y..',
      '.............',
    ];
    const navy = fab('#2f3f6a', { weave: 0.25 });
    const banner: Painter = (t) => {
      if (t.face === 4 || t.face === 5) {
        const fromTip = t.v, mid = Math.abs(t.u - (t.w - 1) / 2);
        if (fromTip < 5 - mid * 0.7) return -1;
        if (t.u === 0 || t.u === t.w - 1 || fromTip < 6 - mid * 0.7) return tone(R(MET.gold), 0.6);
      }
      return t.face === 4 ? pix(crest, { y: 0xf6d04a, b: 0x8a5a34, w: 0xfff6e0, k: 0x2a1d16, c: 0xf2dcb0, g: 0x6aa85a }, navy)({ ...t, v: t.v - 4, h: t.h - 6 }) : navy(t);
    };
    out.push(box(0, -22, 0, 13, 22, 0.6, banner, { cut: true }));
    out.push(box(0, 0, 0.2, 18, 1.2, 1.2, wx(WD.walnut, 0)), box(-9.6, -0.2, 0.2, 1.6, 1.6, 1.6, gold), box(9.6, -0.2, 0.2, 1.6, 1.6, 1.6, gold));
    out.push(...chain([[-8, 0.6, 0.2], [0, 5, 0.2], [8, 0.6, 0.2]], 0.4, solid('#e8c46a', { noise: 0 })));
    for (const x of [-7.4, 7.4]) out.push(box(x, -6, 0.4, 0.4, 5, 0.4, solid('#e8c46a', { noise: 0 })), box(x, -8, 0.4, 1.4, 2.2, 1.4, fab('#e8c46a')));
    return out;
  },
});

add({
  id: 'patch_bunting', name: 'Patchwork Bunting', cat: 'decor', price: 110, rarity: 'common', size: [3, 1], wall: true,
  blurb: 'Nine little flags cut from old pyjamas. Every day is a small celebration.',
  build: () => {
    const out: BoxSpec[] = [];
    const pts = sag([-24, 0, 1], [24, 0, 1], 5, 12);
    out.push(...chain(pts, 0.4, solid('#f6ecd6', { noise: 0 })), box(-24, -0.6, 0.4, 1.2, 1.2, 1.2, metal(MET.brass)), box(24, -0.6, 0.4, 1.2, 1.2, 1.2, metal(MET.brass)));
    const fabs = [fab('#e8708a', { check: '#f6ecd6', checkSize: 1 }), fab('#5a78b8', { stitch: '#f6ecd6' }), fab('#f2c84a', { stripe: '#e8823a', stripeAxis: 'x', stripeW: 1, stripeGap: 1 }), fab('#6aa85a', { tuft: 3 }), fab('#9a6aa8', { stitch: '#f2c84a' })];
    for (let i = 0; i < 9; i++) {
      const k = (i + 1) / 10, x = -24 + 48 * k, y = -5 * 4 * k * (1 - k);
      const p = fabs[i % fabs.length];
      const flag: Painter = (t) => (Math.abs(t.u - (t.w - 1) / 2) > (t.v + 1) * (t.w / 2) / t.h + 0.2 ? -1 : p(t));
      out.push({ ...box(x, y - 7, 1, 5, 7, 0.4, flag, { cut: true }), rot: [0, 0, (k - 0.5) * -14] as Vec3, pivot: [x, y, 1] as Vec3 });
    }
    return out;
  },
});

// ------------------------------------------------------------------ wall

add({
  id: 'bracket_shelf', name: 'Bracket Shelf', cat: 'wall', price: 120, rarity: 'common', size: [2, 1], wall: true, surface: 10,
  blurb: 'A plank on two curly iron brackets, with room in the middle for your favourite things.',
  build: () => {
    const out: BoxSpec[] = [box(0, 8.6, 2.6, 26, 1.4, 6.4, joinery(WD.oak, { axis: 'x', plank: 3 }))];
    for (const x of [-9, 9]) out.push(box(x, 0, -0.2, 1, 8.6, 0.8, metal(MET.iron)), ...chain([[x, 1.6, 0], [x, 3.4, 2.6], [x, 6, 4.6], [x, 8.4, 5.2]], 0.7, metal(MET.iron)), box(x, 5.6, 1.8, 0.6, 1.4, 0.6, metal(MET.iron)));
    // a succulent and a jar at the ends; the middle stays free
    out.push(box(-10.4, 10, 2.6, 3, 2.6, 3, glaze('#f2e6d4', { band: '#3f6fb4', bands: [1] })), box(-10.4, 12.6, 2.6, 2.2, 1.4, 2.2, leaves('#8fbf7a', { seed: 3, bloom: '#f2a7b8', rate: 0.1 })), box(-10.4, 14, 2.6, 1, 1, 1, leaves('#8fbf7a', { seed: 4 })));
    out.push(box(10.6, 10, 2.6, 2.6, 3.4, 2.6, glassP('#e0f4f0'), { glass: true }), box(10.6, 10.2, 2.6, 2, 2.2, 2, solid('#f2c84a', { noise: 0.8, scale: 0.8 })), box(10.6, 13.4, 2.6, 2.8, 0.8, 2.8, metal(MET.copper)));
    return out;
  },
});

add({
  id: 'chalet_cuckoo', name: 'Chalet Cuckoo Clock', cat: 'wall', price: 520, rarity: 'rare', size: [1, 1], wall: true,
  blurb: 'Carved leaves, a pinecone weight on each chain and a wooden owlet who hoots the hour.',
  build: () => {
    const out: BoxSpec[] = [];
    const c = '#8a5532', roof = wx('#5a3a22', 2);
    out.push(box(0, 0, 0.4, 14, 14, 3.6, joinery(c, { axis: 'y', plank: 3 })));
    // pitched roof with carved trim and a ridge bird
    const gable: Painter = (t) => (t.face >= 4 && Math.abs(t.u - (t.w - 1) / 2) > (t.h - t.v) * 1.45 ? -1 : joinery(c, { axis: 'x' })(t));
    out.push(box(0, 14, 0.4, 14, 5, 3.4, gable, { cut: true, skip: 'uew' }));
    out.push({ ...box(-4, 16.3, 0.8, 10, 1.4, 6.6, roof), rot: [0, 0, 34] as Vec3 }, { ...box(4, 16.3, 0.8, 10, 1.4, 6.6, roof), rot: [0, 0, -34] as Vec3 });
    out.push(box(0, 19.6, 1, 2, 2, 2, smooth('#5a3a22')), box(0, 21.6, 1, 2.2, 1.8, 2, smooth('#5a3a22')), box(0, 21.4, 2.2, 0.8, 0.8, 0.6, smooth('#f2b632')));
    const lf = leaves('#4a7a3a', { seed: 4 });
    for (const [x, y] of [[-6.6, 13.6], [6.6, 13.6], [-7.4, 1], [7.4, 1], [-7.6, 7], [7.6, 7]]) out.push(box(x, y, 1.6, 3, 2.4, 1.4, lf));
    // the dial with roman ticks and fretwork hands
    const dial: Painter = (t) => {
      if (t.face !== 4) return metal(MET.gold)(t);
      const u = t.u - (t.w - 1) / 2, v = t.v - (t.h - 1) / 2, d = Math.hypot(u, v), a = Math.atan2(v, u);
      if (d > t.w / 2 - 0.5) return tone(R(MET.gold), 0.6);
      if (d > t.w / 2 - 1.6 && Math.abs(((a / (Math.PI / 6)) % 1 + 1) % 1 - 0.5) > 0.36) return 0x2a1d16;
      if ((u >= -0.4 && u <= 0.4 && v >= 0 && v <= 3.4) || (v >= -0.4 && v <= 0.4 && u >= 0 && u <= 2.4)) return 0x2a1d16;
      return tone(R('#f6ecd6'), 0.3 - d * 0.06);
    };
    out.push(box(0, 2.6, 2.3, 9, 9, 0.6, dial));
    // the little door the owlet pops out of, with a balcony
    out.push(box(0, 12, 2.3, 3, 2.4, 0.4, solid('#3a2416', { noise: 0.2 })), box(-1, 12, 2.6, 1.2, 2.4, 0.4, wy('#a86a3a')), box(1, 12, 2.6, 1.2, 2.4, 0.4, wy('#a86a3a')), box(0, 11.4, 3.4, 6, 0.6, 2, wx(c, 0)));
    for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) out.push(box(x, 11.9, 4.2, 0.4, 1.2, 0.4, wy(c)));
    // chains and pinecone weights
    for (const [x, len] of [[-3, 12], [3, 9]] as const) {
      out.push(box(x, -len, 1.4, 0.4, len, 0.4, metal(MET.brass)));
      const cone: Painter = (t) => tone(R('#7a4a2a'), lvl(t, { noise: 0.2 }) + ((t.u + (t.v % 2)) % 2 ? 0.7 : -0.8));
      out.push(box(x, -len - 4, 1.4, 1.8, 4, 1.8, cone), box(x, -len - 4.6, 1.4, 1, 0.6, 1, cone), box(x, -len, 1.4, 1.2, 0.6, 1.2, cone));
    }
    return out;
  },
  parts: () => [part('pendulum', 'cuckoo_pend', [0, 1, 2.6], () => [box(0, -9, 2.6, 0.4, 10, 0.3, metal(MET.brass)), { ...box(0, -11.6, 2.6, 2.8, 2.8, 0.6, metal(MET.gold)) }, box(0, -11, 2.9, 1.6, 1.4, 0.4, (t) => (t.face === 4 ? 0x8a5532 : 0xd9a441))])],
  animate: (obj, t) => { const p = obj.getObjectByName('pendulum'); if (p) p.rotation.z = Math.sin(t * 2.4 + phase(obj)) * 0.28; },
});

add({
  id: 'hollow_map', name: 'Map of the Hollow', cat: 'wall', price: 260, rarity: 'uncommon', size: [2, 1], wall: true,
  blurb: 'Every path Pip has flown, inked on parchment. X marks the best blueberry bush.',
  build: () => {
    const out: BoxSpec[] = [];
    const map: Painter = (t) => {
      if (t.face !== 4) return paper('#e8d6a8')(t);
      const u = t.u, v = t.v, W = t.w, H = t.h;
      const n = fbm(u / 7, v / 7, 0.5, 11) + (Math.hypot(u - W * 0.62, v - H * 0.45) < 4.5 ? -0.4 : 0);
      const edge = u < 1 || v < 1 || u > W - 2 || v > H - 2;
      if (edge) return tone(R('#c9a870'), -0.6 + hash(u, v, 2) * 0.6);
      // a dotted path from the tree to the X
      const path = Math.abs(v - (H * 0.3 + Math.sin(u * 0.35) * 3 + u * 0.18)) < 0.6 && u > 4 && u < W - 6 && (u % 2 === 0);
      if (path) return 0x8a2a1a;
      const xu = u - (W - 6), xv = v - (H * 0.3 + Math.sin((W - 6) * 0.35) * 3 + (W - 6) * 0.18);
      if (Math.abs(Math.abs(xu) - Math.abs(xv)) < 0.6 && Math.abs(xu) < 2) return 0xd8302a;
      if (u >= 2 && u <= 5 && v >= 5 && v <= 10) return u === 3 || u === 4 ? (v < 7 ? 0x6a4428 : 0x3f7a3a) : v >= 8 ? 0x4f8a45 : tone(R('#e8d6a8'), 0);
      if (n < 0.36) return tone(R('#7aa8c8'), (Math.floor(u + v) % 4 === 0 ? 0.6 : 0) - 0.2);
      if (n < 0.4) return tone(R('#e8d6a8'), -0.8);
      if (n > 0.62) return (u + v) % 3 === 0 ? 0x6a6a7a : tone(R('#9a9a8a'), n > 0.66 ? 0.8 : -0.2);
      if (hash(Math.floor(u / 2), Math.floor(v / 2), 4) > 0.7) return tone(R('#5f8a45'), (u + v) % 2 ? 0.3 : -0.5);
      // compass rose in the corner
      const cu = u - (W - 5), cv = v - (H - 5);
      if ((Math.abs(cu) < 0.6 && Math.abs(cv) < 3) || (Math.abs(cv) < 0.6 && Math.abs(cu) < 3)) return cv > 1 ? 0xd8302a : 0x3a2a20;
      return tone(R('#e8d6a8'), lvl(t, { noise: 0.4, scale: 3, rim: 0, grad: 0 }) * 0.5);
    };
    out.push(box(0, 0, 0, 28, 18, 0.4, map));
    for (const y of [-0.8, 18]) out.push(box(0, y, 0.4, 29, 1.8, 1.8, paper('#d8c08a')), box(-15, y + 0.2, 0.4, 1.2, 1.4, 1.4, wy(WD.dark)), box(15, y + 0.2, 0.4, 1.2, 1.4, 1.4, wy(WD.dark)));
    out.push(box(-12, 15.4, 0.4, 1, 1, 0.6, smooth('#d8433f')), box(12, 15.4, 0.4, 1, 1, 0.6, smooth('#3f6fb4')));
    return out;
  },
});

add({
  id: 'dream_catcher', name: 'Moonthread Dream Catcher', cat: 'wall', price: 240, rarity: 'uncommon', size: [1, 1], wall: true,
  blurb: 'Bad dreams get tangled in the web; good ones slide down the feathers to you.',
  build: () => {
    const out: BoxSpec[] = [];
    const hoop: Vec3[] = Array.from({ length: 17 }, (_, i) => { const a = (i / 16) * Math.PI * 2; return [Math.cos(a) * 7, 10 + Math.sin(a) * 7, 0.4] as Vec3; });
    out.push(...chain(hoop, 1.2, fab('#c9a06a', { stripe: '#8a5a34', stripeAxis: 'x', stripeW: 1, stripeGap: 1 })));
    const web: Painter = (t) => {
      const u = t.x, v = t.y - 10, d = Math.hypot(u, v), a = Math.atan2(v, u);
      if (d > 6.4) return -1;
      if (d < 1) return 0xb8a8f0;
      const f = ((a / (Math.PI / 4)) % 1 + 1) % 1, off = Math.min(f, 1 - f) * (Math.PI / 4) * d;
      const ringd = d * Math.cos((f - 0.5) * (Math.PI / 4));
      if (off < 0.5 || [2.6, 4.6].some((r) => Math.abs(ringd - r) < 0.45)) return 0xf6f0e4;
      return -1;
    };
    out.push(box(0, 3.4, 0.4, 13, 13, 0.2, web, { cut: true }), box(0, 9.4, 0.6, 1.2, 1.2, 0.8, smooth('#8a7ae0')));
    out.push(box(0, 17, 0.4, 0.4, 3, 0.4, solid('#c9a06a', { noise: 0 })), box(0, 19.6, 0, 1, 1, 1, metal(MET.brass)));
    return out;
  },
  parts: () => [[-4.6, 4.6, 8, 0], [0, 3, 11, 1], [4.6, 4.6, 8, 2]].map(([x, y, len, i]) => part('feather' + i, 'dream_feather' + i, [x, y, 0.4], () => {
    const cols = ['#f6f0e4', '#c8b8f0', '#f2d8a8'];
    const fe: Painter = (t) => (t.u === Math.floor(t.w / 2) ? 0xe8e0d0 : tone(R(cols[i]), lvl(t, { noise: 0.2 }) + (t.v % 2 ? 0.3 : -0.3)));
    return [box(x, y - len, 0.4, 0.3, len, 0.3, solid('#c9a06a', { noise: 0 })), box(x, y - len * 0.55, 0.4, 1, 1, 1, smooth(['#6ab8e0', '#e8708a', '#f2c84a'][i])),
      box(x, y - len - 4.6, 0.4, 2, 4.6, 0.3, fe, { cut: true }), box(x, y - len - 5.6, 0.4, 1, 1, 0.3, fe)];
  })),
  animate: (obj, t) => {
    const ph = phase(obj);
    for (let i = 0; i < 3; i++) { const f = obj.getObjectByName('feather' + i); if (f) f.rotation.z = Math.sin(t * 1.3 + i * 1.7 + ph) * 0.12; }
  },
});

add({
  id: 'star_garland', name: 'Paper Star Garland', cat: 'wall', price: 180, rarity: 'uncommon', size: [3, 1], wall: true,
  blurb: 'Folded paper stars on a string; the golden ones glow when the lamps go down.',
  light: { x: 0, y: -8, z: 3, color: 0xffe2a0, power: 0.9 },
  build: () => {
    const out: BoxSpec[] = [];
    const pts = sag([-22, 0, 1], [22, 0, 1], 4, 12);
    out.push(...chain(pts, 0.4, solid('#c9a878', { noise: 0 })), box(-22, -0.6, 0.6, 1, 1, 1, metal(MET.brass)), box(22, -0.6, 0.6, 1, 1, 1, metal(MET.brass)));
    const STAR = ['...x...', '..xxx..', 'xxxxxxx', '.xxxxx.', '..xxx..', '.xx.xx.', 'xx...xx'];
    for (let i = 0; i < 7; i++) {
      const k = (i + 1) / 8, x = -22 + 44 * k, y = -4 * 4 * k * (1 - k), drop = 2 + (i % 3) * 2.4, glow = i % 2 === 0;
      const r = R(glow ? '#ffd86a' : '#f6f0e4');
      out.push(box(x, y - drop, 1, 0.3, drop, 0.3, solid('#c9a878', { noise: 0 })));
      out.push(...pixBoxes(STAR, x, y - drop - 7, 1, glow ? 1.4 : 1, () => (t) => tone(r, (glow ? 1 : 0) + lvl(t, { noise: 0.2, speck: 0 }) * 0.5 + (t.face === 4 && t.v === t.h - 1 ? 0.6 : 0)), { glow }));
    }
    return out;
  },
});

add({
  id: 'hat_rack', name: 'Peg Rail with Hats', cat: 'wall', price: 190, rarity: 'common', size: [2, 1], wall: true,
  blurb: 'Pip’s nightcap, a sunhat for picnics and a scarf that is mostly holes and love.',
  build: () => {
    const out: BoxSpec[] = [box(0, 0, 0, 26, 3, 1, joinery('#6f9a8a', { axis: 'x' })), box(0, 3, 0.2, 27, 0.8, 1.6, wx(WD.light, 0))];
    for (const x of [-9, -3, 3, 9]) out.push({ ...box(x, 1, 0.5, 1.2, 1.2, 3.6, wz(WD.light, 0)), rot: [-14, 0, 0] as Vec3, pivot: [x, 1.6, 0.5] as Vec3 }, box(x, 1.6, 3.8, 1.6, 1.6, 1, wz(WD.light, 0)));
    // a striped nightcap with a pompom
    const cap = fab('#5a78b8', { stripe: '#f6ecd6', stripeAxis: 'y', stripeW: 1, stripeGap: 1 });
    out.push(box(-9, -3, 2.6, 5, 4, 4, cap), box(-9, -6, 2.6, 3.4, 3, 3, cap), box(-8, -8.4, 2.6, 2.4, 2.6, 2.4, cap), box(-6.8, -9.6, 2.6, 2, 2, 2, solid('#f6f0e4', { noise: 0.7, scale: 0.7 })));
    // a straw sun hat with a ribbon
    const straw: Painter = (t) => tone(R('#e8c87a'), lvl(t, { noise: 0.2 }) + ((Math.floor(Math.hypot(t.x - 3, t.z - 2) * 1.4)) % 2 ? 0.4 : -0.4));
    const up = (bs: BoxSpec[], piv: Vec3) => bs.map((b) => ({ ...b, rot: [90, 0, 0] as Vec3, pivot: piv }));
    out.push(...up(disc(3, -3, 0, 5.6, 0.6, straw), [3, -3, 0]).map((b) => ({ ...b, at: [b.at[0], b.at[1], b.at[2] + 3] as Vec3, pivot: [3, -3, 3] as Vec3 })));
    out.push(...up(disc(3, -3, 0, 3, 3.4, straw), [3, -3, 0]).map((b) => ({ ...b, at: [b.at[0], b.at[1], b.at[2] + 3] as Vec3, pivot: [3, -3, 3] as Vec3 })));
    out.push(...up(disc(3, -3, 0, 3.2, 1, fab('#e8708a')), [3, -3, 0]).map((b) => ({ ...b, at: [b.at[0], b.at[1] + 0.6, b.at[2] + 3] as Vec3, pivot: [3, -3, 3] as Vec3 })));
    out.push(box(5.6, -9.4, 3.6, 1.2, 4, 0.4, fab('#e8708a')), box(6.6, -8.6, 3.4, 1.2, 3.4, 0.4, fab('#e8708a')));
    // the scarf, looped over the last peg
    const sc = fab('#d8433f', { check: '#f2c84a', checkSize: 2 });
    out.push(box(9, -10, 3.4, 2.6, 11, 0.8, sc), box(10.8, -7, 3, 2.6, 8, 0.8, sc), box(9.8, 0.6, 3.6, 4.6, 2.4, 1.2, sc));
    for (const x of [8.2, 9, 9.8]) out.push(box(x, -11, 3.4, 0.4, 1, 0.4, fab('#f2c84a')));
    return out;
  },
});

export const TRINKETS: ItemDef[] = items;
