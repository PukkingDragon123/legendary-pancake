// Lamps, lanterns and candles. Every one has a `light` for the night glow; flames flicker as moving parts.
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../../gfx/box.ts';
import { tone } from '../../gfx/color.ts';
import { lamp, leaves, lvl, metal, R, smooth, solid } from '../../gfx/mats.ts';
import { hash } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';
import { ball, chain, disc, fab, flamePart, flicker, glassP, glowP, MET, ownMats, part, phase, ring8, sag, setBright, waxP, WD, wy } from './kit.ts';

const items: ItemDef[] = [];
const add = (d: ItemDef) => items.push(d);
const iron = metal(MET.iron);

add({
  id: 'fringe_floor_lamp', model: 'items/fringe_floor_lamp.glb', name: 'Fringed Floor Lamp', cat: 'lights', price: 320, rarity: 'uncommon', size: [1, 1],
  blurb: 'A tasselled shade the colour of apricot jam. Reading light, napping light.',
  light: { x: 0, y: 34, z: 0, color: 0xffc98a, power: 1.5 },
  build: () => {
    const out: BoxSpec[] = [];
    const br = metal(MET.brass);
    for (let i = 0; i < 3; i++) out.push({ ...box(0, 0, 0, 1.2, 1, 8, br), rot: [0, i * 120, 0] as Vec3, pivot: [0, 0, 0] as Vec3 }, { ...box(Math.sin((i * 120 * Math.PI) / 180) * 3.6, 0, Math.cos((i * 120 * Math.PI) / 180) * 3.6, 1.6, 0.8, 1.6, metal(MET.gold)) });
    out.push(...disc(0, 0.6, 0, 2.2, 1.6, br), box(0, 2.2, 0, 1, 29, 1, br));
    for (const y of [9, 19, 27]) out.push(...disc(0, y, 0, 1.2, 1.2, metal(MET.gold)));
    // the shade: eight glowing silk panels, a gold rim and a fringe of tassels
    const silk = glowP('#ffb46a', { pattern: (t) => ((t.u % 3 === 0) ? -0.5 : 0.1) });
    out.push(...ring8(0, 30, 0, 6.6, 7, 0.6, silk, { glow: true }));
    out.push(...ring8(0, 36.6, 0, 5.2, 1, 1.6, silk, { glow: true }));
    out.push(...ring8(0, 36.8, 0, 5.4, 0.8, 0.6, metal(MET.gold)), ...ring8(0, 29.6, 0, 7, 0.8, 0.6, metal(MET.gold)));
    const fringe: Painter = (t) => (t.u % 2 === 1 || (t.v === 0 && hash(t.u, 3, 1) > 0.5) ? -1 : tone(R('#e8823a'), lvl(t, { noise: 0.1 }) + (t.v === t.h - 1 ? 0.6 : 0)));
    out.push(...ring8(0, 27, 0, 7.1, 2.6, 0.3, fringe, { cut: true }));
    out.push(box(0, 31, 0, 2.6, 2.6, 2.6, lamp('#fff2c8'), { glow: true }), box(2.4, 26, 1.6, 0.4, 5, 0.4, metal(MET.gold)), box(2.4, 25, 1.6, 0.9, 1.2, 0.9, metal(MET.gold)));
    return out;
  },
});

add({
  id: 'fairy_lights', model: 'items/fairy_lights.glb', name: 'Fairy-Light String', cat: 'lights', price: 150, rarity: 'common', size: [3, 1], wall: true,
  blurb: 'Fourteen little bulbs that twinkle like they know a secret.',
  light: { x: 0, y: -6, z: 3, color: 0xffd9a0, power: 1.1 },
  build: () => {
    const wire = solid('#3a4a34', { noise: 0, speck: 0 });
    const out: BoxSpec[] = [...chain(sag([-22, 0, 1], [0, -2, 1], 6, 10), 0.5, wire), ...chain(sag([0, -2, 1], [22, 0, 1], 6, 10), 0.5, wire)];
    for (const x of [-22, 0, 22]) out.push(box(x, -0.8, 0.4, 1.2, 1.6, 1.4, metal(MET.brass)), box(x, -0.4, -0.4, 2.2, 2.2, 0.6, metal(MET.brass)));
    return out;
  },
  parts: () => {
    const pts = [...sag([-22, 0, 1], [0, -2, 1], 6, 7).slice(1, -1), ...sag([0, -2, 1], [22, 0, 1], 6, 7).slice(1, -1)];
    const cols = ['#ffd36a', '#ff8a7a', '#8ad8ff', '#a8f08a', '#ffb0e0'];
    return [0, 1, 2].map((g) => ownMats(part('twinkle' + g, 'fairy:' + g, [0, 0, 0], () => pts.flatMap((p, i) => (i % 3 !== g ? [] : [
      box(p[0], p[1] - 1.2, p[2], 0.8, 0.8, 0.8, metal('#5a6a50')),
      box(p[0], p[1] - 3.2, p[2], 1.6, 2, 1.6, lamp(cols[(i * 2) % cols.length]), { glow: true }),
      box(p[0], p[1] - 3.8, p[2], 1, 0.6, 1, lamp(cols[(i * 2) % cols.length]), { glow: true }),
    ])))));
  },
  animate: (obj, t) => {
    const ph = phase(obj);
    for (let g = 0; g < 3; g++) setBright(obj.getObjectByName('twinkle' + g), 0.55 + 0.45 * Math.max(0, Math.sin(t * (1.7 + g * 0.6) + g * 2.1 + ph)));
  },
});

add({
  id: 'iron_lantern', model: 'items/iron_lantern.glb', name: 'Wrought-Iron Lantern', cat: 'lights', price: 190, rarity: 'common', size: [1, 1], small: true,
  blurb: 'Four little windows round a beeswax candle. Carry it, hang it, set it down.',
  light: { x: 0, y: 6, z: 0, color: 0xffb35a, power: 1.2 },
  build: () => {
    const out: BoxSpec[] = [box(0, 0, 0, 7, 1, 7, iron), box(0, 1, 0, 6, 0.6, 6, iron)];
    for (const [x, z] of [[-2.8, -2.8], [2.8, -2.8], [-2.8, 2.8], [2.8, 2.8]]) out.push(box(x, 1, z, 1, 9, 1, iron));
    for (const [x, z, w, d] of [[0, 2.8, 4.8, 0.3], [0, -2.8, 4.8, 0.3], [2.8, 0, 0.3, 4.8], [-2.8, 0, 0.3, 4.8]]) out.push(box(x, 1.6, z, w, 8, d, glassP('#ffe8b8'), { glass: true }));
    for (const [x, z, w, d] of [[0, 3, 5, 0.4], [0, -3, 5, 0.4], [3, 0, 0.4, 5], [-3, 0, 0.4, 5]]) out.push(box(x, 5.6, z, w, 0.5, d, iron));
    out.push(box(0, 10, 0, 7.4, 1, 7.4, iron), box(0, 11, 0, 5.4, 1, 5.4, iron), box(0, 12, 0, 3.4, 1, 3.4, iron), box(0, 13, 0, 1.4, 1, 1.4, iron));
    out.push(box(0, 14, 0, 4, 0.6, 0.6, iron), box(-2, 13.2, 0, 0.6, 1.4, 0.6, iron), box(2, 13.2, 0, 0.6, 1.4, 0.6, iron));
    out.push(box(0, 1.6, 0, 2.2, 3.4, 2.2, waxP('#f6e6b8', 2)), box(0, 1.6, 0, 3, 0.6, 3, metal(MET.brass)));
    return out;
  },
  parts: () => [flamePart('flame', [0, 5.2, 0])],
  animate: (obj, t) => flicker(obj, t),
});

add({
  id: 'candelabra', model: 'items/candelabra.glb', name: 'Brass Candelabra', cat: 'lights', price: 260, rarity: 'uncommon', size: [1, 1], small: true,
  blurb: 'Five candles for when one is simply not dramatic enough.',
  light: { x: 0, y: 16, z: 0, color: 0xffb860, power: 1.4 },
  build: () => {
    const br = metal(MET.brass), out: BoxSpec[] = [];
    out.push(...disc(0, 0, 0, 3.6, 0.8, br), ...disc(0, 0.8, 0, 2.6, 0.8, br), box(0, 1.6, 0, 1.2, 8, 1.2, br), ...disc(0, 3.4, 0, 1.4, 1, br), ...disc(0, 6.8, 0, 1.2, 0.8, br));
    // the arms curve up from the knop to four cups, the tallest candle stands in the middle
    for (const s of [-1, 1]) {
      out.push(...chain([[0, 9, 0], [s * 3, 8.6, 0], [s * 5.4, 9.6, 0], [s * 6, 11.6, 0]], 0.8, br));
      out.push(...chain([[0, 9.4, 0], [0, 9, s * 2.4], [0, 10.6, s * 3.8], [0, 12.6, s * 4]], 0.8, br));
    }
    const cups: Vec3[] = [[-6, 11.6, 0], [6, 11.6, 0], [0, 12.6, -4], [0, 12.6, 4], [0, 10, 0]];
    const tall = [5, 5, 4.4, 4.4, 7.4];
    cups.forEach(([x, y, z], i) => out.push(...disc(x, y, z, 1.4, 0.8, br), box(x, y + 0.8, z, 1.6, tall[i], 1.6, waxP('#fbf1dc', i))));
    return out;
  },
  parts: () => {
    const tops: Vec3[] = [[-6, 17.6, 0], [6, 17.6, 0], [0, 18, -4], [0, 18, 4], [0, 18.4, 0]];
    return tops.map((p, i) => flamePart('flame' + i, p, 0.9));
  },
  animate: (obj, t) => flicker(obj, t),
});

add({
  id: 'toadstool_lamp', model: 'items/toadstool_lamp.glb', name: 'Toadstool Cottage Lamp', cat: 'lights', price: 280, rarity: 'uncommon', size: [1, 1], small: true,
  blurb: 'Three glowing mushrooms; the big one has a tiny lit window. Someone lives there.',
  light: { x: 0, y: 10, z: 2, color: 0xffb070, power: 1.3 },
  build: () => {
    const out: BoxSpec[] = [];
    const capC = R('#e0553a');
    const cap = (seed: number): Painter => (t) => {
      if (t.face === 3) return tone(R('#ffe0a0'), 1 - ((Math.floor(Math.atan2(t.z, t.x) * 5 + 32) & 1) ? 0.8 : 0));
      if (hash(Math.floor((t.x + 64) / 1.6), Math.floor((t.y + 64) / 1.6), Math.floor((t.z + 64) / 1.6), seed) > 0.8) return 0xfff2c8;
      return tone(capC, 0.6 + (t.face === 2 ? 0.6 : 0) - Math.abs((t.v + 0.5) / t.h - 0.5));
    };
    const stem = solid('#f6e8cc', { noise: 0.3 });
    const door: Painter = (t) => {
      if (t.face !== 4) return stem(t);
      const u = t.u - (t.w - 1) / 2;
      if (t.v < 4 && Math.abs(u) < 1.1) return t.v === 2 && u > 0.4 ? 0xf2b632 : tone(R('#7b4b2c'), (t.v === 3 ? 0.6 : 0) - 0.2);
      if (t.v === 6 && Math.abs(u - 0.5) < 1.2) return 0xffd98a;
      return stem(t);
    };
    out.push(...disc(0, 0, 0, 7, 1.4, leaves('#5f9a45', { seed: 2, bloom: '#f6f0d8', rate: 0.05 }), { skip: 'd' }));
    out.push(...disc(0, 1.4, 0, 2.6, 7.6, door));
    out.push(...disc(0, 9, 0, 6.4, 1.4, cap(1), { glow: true }), ...disc(0, 10.4, 0, 5.4, 1.4, cap(1), { glow: true, skip: 'd' }), ...disc(0, 11.8, 0, 3.6, 1, cap(1), { glow: true, skip: 'd' }));
    out.push(...disc(4.4, 1.4, 2.6, 1.2, 4, stem), ...disc(4.4, 5.4, 2.6, 3, 1.2, cap(2), { glow: true }), ...disc(4.4, 6.6, 2.6, 2, 0.8, cap(2), { glow: true, skip: 'd' }));
    out.push(...disc(-4.6, 1.4, 1.6, 1, 2.6, stem), ...disc(-4.6, 4, 1.6, 2.2, 1, cap(3), { glow: true }), ...disc(-4.6, 5, 1.6, 1.2, 0.6, cap(3), { glow: true, skip: 'd' }));
    // a path of pebbles to the door and a tiny lantern beside it
    out.push(box(0, 1.4, 4, 1.4, 0.4, 1.2, solid('#c9c0b0')), box(0.6, 1.4, 5.6, 1.2, 0.4, 1, solid('#b8b0a0')));
    out.push(box(-1.8, 1.4, 3.2, 0.4, 3, 0.4, metal(MET.iron)), box(-1.8, 4.4, 3.2, 1, 1, 1, lamp('#ffd06a'), { glow: true }));
    return out;
  },
});

add({
  id: 'firefly_jar', model: 'items/firefly_jar.glb', name: 'Firefly Jar', cat: 'lights', price: 220, rarity: 'rare', size: [1, 1], small: true,
  blurb: 'Five fireflies on a sleepover. The lid has air holes and a very small welcome mat.',
  light: { x: 0, y: 6, z: 0, color: 0xd8ff7a, power: 1.2 },
  build: () => {
    const out: BoxSpec[] = [];
    out.push(...ring8(0, 0, 0, 4, 10, 0.4, glassP('#e0f4e8'), { glass: true }), ...disc(0, 0, 0, 4, 0.6, glassP('#e0f4e8'), { glass: true }));
    out.push(...disc(0, 0.6, 0, 3.4, 1.2, leaves('#5f9a45', { seed: 6 })), box(-1.4, 1.8, 0.6, 0.6, 3, 0.6, solid('#6aaa4a')), box(1.6, 1.8, -1, 0.6, 2.4, 0.6, solid('#5f9a45')), box(0.4, 1.8, 1.6, 0.6, 1.6, 0.6, solid('#7aba5a')));
    out.push(...disc(0, 10, 0, 3.8, 0.8, metal(MET.pewter)), ...disc(0, 10.8, 0, 4.2, 1.2, metal(MET.pewter)), ...disc(0, 12, 0, 4.2, 0.4, fab('#e8dcc0'), { skip: 'd' }));
    out.push(...chain([[-4, 11.4, 0], [-3, 15, 0], [0, 16.4, 0], [3, 15, 0], [4, 11.4, 0]], 0.5, solid('#c9a878', { noise: 0.3 })));
    return out;
  },
  parts: () => Array.from({ length: 5 }, (_, i) => part('fly' + i, 'firefly', [0, 0, 0], () => [box(0, 0, 0, 1.2, 1.2, 1.2, lamp('#e8ff8a'), { glow: true }), box(0, 1.2, 0, 0.9, 0.5, 0.7, () => 0x3a2a20)])),
  animate: (obj, t) => {
    const ph = phase(obj);
    obj.children.forEach((c, i) => {
      if (!c.name.startsWith('fly')) return;
      const k = t * (0.6 + i * 0.13) + ph + i * 1.9;
      c.position.set(Math.sin(k) * 2.2 * (1 / 16), (5.5 + Math.sin(k * 1.7 + i) * 2.6) / 16, Math.cos(k * 1.3) * 2.2 / 16);
      const blink = Math.sin(t * 3 + i * 2.3 + ph) > -0.3 ? 1 : 0.35;
      c.scale.setScalar(blink);
    });
  },
});

export const LIGHTS: ItemDef[] = items;
