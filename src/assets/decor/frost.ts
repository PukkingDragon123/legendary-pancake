// The Frostlight Festival series: gingerbread, candlelight and the first snow of the year.
// Gacha prizes, so every piece gets extra detail and a little life of its own.
import type * as THREE from 'three';
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../../gfx/box.ts';
import { tone } from '../../gfx/color.ts';
import { lamp, leaves, lvl, metal, R, smooth, solid } from '../../gfx/mats.ts';
import { fbm, hash } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';
import type { Finish } from '../finishes.ts';
import { ball, chain, chainXY, disc, fab, fluff, glassP, joinery, knit, MET, ownMats, part, phase, pixBoxes, PX, ring8, sag, setBright, turn, waxP, WD, wx, wy, wz } from './kit.ts';
import { cells, fb, fl, grainT, h2, mod, paperT, strokesT, tn } from './finishes.ts';
import { P, mixc } from '../../gfx/palette.ts';

const SERIES = 'frostlight';
const items: ItemDef[] = [];
const add = (d: Omit<ItemDef, 'series' | 'noStore' | 'price'> & { price?: number }) => items.push({ price: 0, ...d, series: SERIES, noStore: true });

const snow = (t: Parameters<Painter>[0]) => tone(R('#f4f8ff'), lvl(t, { noise: 0.35, speck: 0.3, rim: 0.4 }) * 0.6 + (t.face === 2 ? 0.5 : -0.2) + (hash(Math.floor(t.x * 2), Math.floor(t.y * 2), Math.floor(t.z * 2), 5) > 0.94 ? 1.2 : 0));
const pine = (seed: number, c = '#2f6a45') => leaves(c, { seed, lift: 0.2 });
/** Pine with snow settled on the upper faces. */
const snowyPine = (seed: number): Painter => {
  const p = pine(seed);
  return (t) => (t.face === 2 && fbm(t.x / 2, t.y / 2, t.z / 2, seed) > 0.42 ? snow(t) : p(t));
};
const candy = (a = '#e8343f', b = '#fbf6ee', w = 1.6): Painter => {
  const ra = R(a), rb = R(b);
  return (t) => {
    const k = Math.floor((t.y + Math.atan2(t.z, t.x) * 1.2 + t.x * 0.4 + 64) / w) % 2;
    return tone(k ? ra : rb, lvl(t, { noise: 0.1, speck: 0.1, rim: 0.8 }) + (t.face === 0 || t.face === 4 ? 0.2 : 0));
  };
};
const gingerbread: Painter = (t) => tone(R('#b8743a'), lvl(t, { noise: 0.6, scale: 1.4, speck: 0.6 }) * 0.8 + (hash(Math.floor(t.x * 2), Math.floor(t.y * 2), Math.floor(t.z * 2), 3) > 0.9 ? -0.8 : 0));
/** White icing piped along the top edge of a face, in little scallops. */
const iced = (base: Painter, rows = 1): Painter => (t) => {
  if (t.face !== 2 && t.face !== 3 && t.v >= t.h - rows - ((t.u % 3 === 1) ? 1 : 0)) return tone(R('#fbfbff'), 0.6);
  if (t.face === 2 && (t.u === 0 || t.v === 0 || t.u === t.w - 1 || t.v === t.h - 1)) return tone(R('#fbfbff'), 0.8);
  return base(t);
};

// ------------------------------------------------------------------ the tree

const TREE_TIERS: [number, number, number][] = [[6, 9, 15], [14, 8, 12.6], [21, 7, 10.2], [27.5, 6.5, 8], [33.5, 6, 5.8], [39, 5, 3.6]];
const coneR = (y: number) => { for (const [y0, h, r] of TREE_TIERS) if (y >= y0 && y < y0 + h) return r * (1 - ((y - y0) / h) * 0.45); return 1; };

add({
  id: 'xmas_tree', model: 'items/xmas_tree.glb', name: 'Frostlight Fir', cat: 'seasonal', rarity: 'epic', size: [2, 2],
  blurb: 'A snow-dusted fir with glass baubles, a ribbon of gold tinsel and lights that twinkle all night.',
  light: { x: 0, y: 26, z: 6, color: 0xffd9a0, power: 2 },
  build: () => {
    const out: BoxSpec[] = [];
    // tree skirt and trunk in a wooden tub
    const skirt: Painter = (t) => {
      const d = Math.hypot(t.x, t.z);
      if (d > 11.4) return tone(R('#fbfbff'), 0.4 + (Math.floor(Math.atan2(t.z, t.x) * 8 + 32) % 2 ? 0.3 : -0.2));
      return tone(R('#b8283a'), (Math.floor(Math.atan2(t.z, t.x) * 6 + 32) % 2 ? 0.2 : -0.3) + ((t.u + t.v) & 1 ? 0.15 : -0.15));
    };
    out.push(...disc(0, 0, 0, 12.6, 0.8, skirt, { skip: 'd' }));
    out.push(...disc(0, 0.8, 0, 4, 4, joinery('#c84a3a', { axis: 'y', plank: 2 })), ...disc(0, 2, 0, 4.3, 0.6, metal(MET.gold)), box(0, 4.8, 0, 2.4, 4, 2.4, wy(WD.dark)));
    // six tiers of snowy foliage, each a little skirt of branches with a drooping rim
    TREE_TIERS.forEach(([y0, h, r], i) => {
      const p = snowyPine(i + 3);
      out.push(...disc(0, y0, 0, r, h * 0.45, p), ...disc(0, y0 + h * 0.45, 0, r * 0.78, h * 0.35, p), ...disc(0, y0 + h * 0.8, 0, r * 0.5, h * 0.5, p));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + i * 0.4;
        out.push(lean(box(Math.cos(a) * (r - 1), y0 - 1.4, Math.sin(a) * (r - 1), 2.6, 2, 2.6, pine(i * 9 + k, '#2a5e3e')), Math.sin(a) * 16, 0, -Math.cos(a) * 16));
      }
    });
    out.push(box(0, 44, 0, 1.6, 2, 1.6, pine(9)));
    // a spiral of gold tinsel
    const tinsel: Vec3[] = Array.from({ length: 40 }, (_, i) => { const y = 7 + i * 0.85, a = i * 0.62; const r = coneR(y) + 0.4; return [Math.cos(a) * r, y, Math.sin(a) * r] as Vec3; });
    out.push(...chain(tinsel, 0.8, (t) => tone(R(MET.gold), ((Math.floor(t.x * 2) + Math.floor(t.y * 2) + Math.floor(t.z * 2)) % 3 === 0 ? 1.6 : 0.2))));
    // baubles: glossy glass balls with a gold cap and a highlight
    const cols = ['#d8283a', '#f2b632', '#3a6ad8', '#e8e8f8', '#8a3ad8'];
    for (let i = 0; i < 22; i++) {
      const y = 8 + hash(i, 1, 9) * 32, a = hash(i, 2, 9) * Math.PI * 2, r = coneR(y) + 0.2;
      const c = R(cols[i % cols.length]);
      const bp: Painter = (t) => (t.face === 4 && t.u === 0 && t.v === t.h - 1 ? 0xffffff : tone(c, (t.face === 2 ? 1 : 0) + (t.face === 0 || t.face === 4 ? 0.4 : -0.4)));
      out.push(box(Math.cos(a) * r, y - 1.6, Math.sin(a) * r, 1.8, 1.8, 1.8, bp), box(Math.cos(a) * r, y + 0.2, Math.sin(a) * r, 0.8, 0.5, 0.8, metal(MET.gold)));
    }
    // two wrapped presents under the tree
    const wrap = (c: string, rib: string): Painter => (t) => (Math.abs(t.bx - t.sx / 2) < 0.6 || Math.abs(t.bz - t.sz / 2) < 0.6 ? tone(R(rib), lvl(t, { noise: 0 }) + 0.4) : tone(R(c), lvl(t, { noise: 0.15 }) + ((Math.floor(t.x + t.y + t.z + 64) % 3 === 0) ? 0.5 : 0)));
    out.push({ ...box(7, 0.8, 8, 5, 4, 5, wrap('#3a8a5a', '#f2c84a')), rot: [0, 20, 0] as Vec3 }, box(-8, 0.8, 7, 4, 3, 4, wrap('#e8e0f8', '#d8283a')), box(-8, 3.8, 7, 2.4, 1, 1, smooth('#d8283a')));
    return out;
  },
  parts: () => {
    const groups = [0, 1, 2].map((g) => ownMats(part('lights' + g, 'xmas_lights' + g, [0, 0, 0], () => {
      const out: BoxSpec[] = [];
      const cols = ['#ffd36a', '#ff6a6a', '#8ad8ff', '#a8f08a'];
      for (let i = g; i < 54; i += 3) {
        const y = 7.4 + i * 0.66, a = -i * 0.75 + 1.3, r = coneR(y) + 0.6;
        out.push(box(Math.cos(a) * r, y, Math.sin(a) * r, 1, 1.2, 1, lamp(cols[i % 4]), { glow: true }));
      }
      return out;
    })));
    const star = part('star', 'xmas_star', [0, 49, 0], () => {
      const S = ['....x....', '...xxx...', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '.xxx.xxx.', 'xx.....xx'];
      return [...pixBoxes(S, 0, 45.6, 0, 1.6, () => lamp('#ffe46a'), { glow: true }), ...pixBoxes(['x', 'x'], 0, 47.6, 0.9, 0.2, () => () => 0xffffff, { glow: true })];
    });
    return [...groups, star];
  },
  animate: (obj, t) => {
    const ph = phase(obj);
    for (let g = 0; g < 3; g++) setBright(obj.getObjectByName('lights' + g), 0.45 + 0.55 * Math.max(0, Math.sin(t * (1.3 + g * 0.5) + g * 2.1 + ph)));
    const s = obj.getObjectByName('star');
    if (s) { s.rotation.y = Math.sin(t * 0.8 + ph) * 0.5; s.scale.setScalar(1 + Math.sin(t * 3) * 0.04); }
  },
});

// ------------------------------------------------------------------ gingerbread house

add({
  id: 'gingerbread_house', model: 'items/gingerbread_house.glb', name: 'Gingerbread Cottage', cat: 'seasonal', rarity: 'epic', size: [2, 2], small: true,
  blurb: 'Iced walls, a peppermint roof and a warm glow inside. Smells like cinnamon. Do not eat the door.',
  light: { x: 0, y: 6, z: 6, color: 0xffb86a, power: 1.1 },
  build: () => {
    const out: BoxSpec[] = [];
    const board: Painter = (t) => (t.face === 2 && hash(Math.floor(t.x * 2 + 64), 1, Math.floor(t.z * 2 + 64), 4) > 0.93 ? 0xffffff : tone(R('#eef4ff'), lvl(t, { noise: 0.3 }) * 0.5 + 0.3));
    out.push(box(0, 0, 0, 22, 1.2, 18, board));
    const wall = iced(gingerbread, 1);
    // windows of boiled sugar glowing from inside, edged in icing
    const winWall: Painter = (t) => {
      if (t.face === 4) {
        for (const cx of [3, t.w - 4]) {
          const du = t.u - cx, dv = t.v - 6;
          if (Math.abs(du) <= 1 && dv >= -1 && dv <= 1) return du === 0 || dv === 0 ? 0xe8a040 : 0xffd88a;
          if (Math.abs(du) <= 2 && dv >= -2 && dv <= 2 && (Math.abs(du) === 2 || Math.abs(dv) === 2)) return 0xfbfbff;
        }
        const du = t.u - (t.w - 1) / 2;
        if (Math.abs(du) < 1.6 && t.v < 6) return t.v === 5 || Math.abs(du) > 1 ? 0xfbfbff : (t.v === 2 && du > 0 ? 0xf2c84a : 0x7a3a1a);
      }
      return wall(t);
    };
    out.push(box(0, 1.2, 0, 16, 10, 12, winWall));
    out.push(box(0, 2.4, 6.1, 3, 1, 0.4, lamp('#ffd88a'), { glow: true }));
    // gable ends and a candy roof of pink and white shingles
    const gable: Painter = (t) => (t.face === 4 || t.face === 5 ? (Math.abs(t.u - (t.w - 1) / 2) > (t.h - t.v) * 1.6 ? -1 : wall(t)) : wall(t));
    out.push(box(0, 11.2, 0, 16, 5.6, 12, gable, { cut: true, skip: 'uew' }));
    const shingle: Painter = (t) => {
      const row = Math.floor(t.u / 2), off = row % 2;
      const pinkish = (Math.floor((t.v + off) / 2) + row) % 2;
      if (t.face === 2 || t.face === 3) return tone(R(pinkish ? '#f2a0b8' : '#fbf6f4'), lvl(t, { noise: 0.1 }) + (t.u % 2 === 0 ? -0.5 : 0.3));
      return tone(R('#fbf6f4'), 0.4);
    };
    out.push({ ...box(-4.4, 13.4, 0, 11, 1.4, 15, shingle), rot: [0, 0, 36] as Vec3 }, { ...box(4.4, 13.4, 0, 11, 1.4, 15, shingle), rot: [0, 0, -36] as Vec3 });
    // snow on the ridge, gumdrops, a chimney and candy-cane posts by the door
    out.push(box(0, 16.4, 0, 2.6, 1.2, 15.4, snow));
    const gum = ['#e8343f', '#3ab85a', '#f2c84a', '#8a5ae8', '#3a9ae8'];
    for (let i = 0; i < 6; i++) out.push(box(0, 17.4, -6 + i * 2.4, 1.4, 1.2, 1.4, smooth(gum[i % 5])));
    out.push(box(4, 14, -3, 3, 6, 3, gingerbread), box(4, 20, -3, 3.4, 1, 3.4, snow), box(4, 21, -3, 1.4, 1, 1.4, solid('#5a5050')));
    out.push(box(-3.4, 1.2, 7.6, 1.2, 7, 1.2, candy()), box(3.4, 1.2, 7.6, 1.2, 7, 1.2, candy()), box(-2.8, 8.2, 7.6, 2.4, 1.2, 1.2, candy()), box(2.8, 8.2, 7.6, 2.4, 1.2, 1.2, candy()));
    // peppermint stepping stones and a gingerbread owl by the door
    for (const [x, z] of [[0, 8.6], [0.6, 10.6], [-0.4, 12.8]]) out.push(...disc(x, 1.2, z, 1.4, 0.4, (t) => (Math.floor(Math.atan2(t.z - z, t.x - x) * 2.5 + 16) % 2 ? 0xe8343f : 0xfbf6f4)));
    out.push(box(6.4, 1.2, 8.4, 3, 4, 1, gingerbread), box(6.4, 5.2, 8.4, 3.4, 2.6, 1, gingerbread), box(5.6, 6, 8.95, 0.8, 0.8, 0.2, () => 0xfbfbff), box(7.2, 6, 8.95, 0.8, 0.8, 0.2, () => 0xfbfbff), box(6.4, 3, 8.95, 1.4, 0.4, 0.2, () => 0xe8343f));
    return out;
  },
});

// ------------------------------------------------------------------ snow globe

const GLOBE: [number, number, number][] = [[0, 2, 5], [2, 2, 6.4], [4, 2, 7], [6, 2, 6.8], [8, 2, 6], [10, 1.6, 4.6], [11.6, 1.2, 2.8]];
add({
  id: 'snow_globe', model: 'items/snow_globe.glb', name: 'Hollow Snow Globe', cat: 'seasonal', rarity: 'epic', size: [1, 1], small: true,
  blurb: 'A tiny hollow tree under glass, lit from within. Snow swirls round it forever.',
  light: { x: 0, y: 8, z: 0, color: 0xcfe8ff, power: 0.9 },
  build: () => {
    const out: BoxSpec[] = [];
    out.push(...disc(0, 0, 0, 7.6, 1.2, joinery(WD.walnut, { axis: 'x' })), ...disc(0, 1.2, 0, 7, 2.4, joinery(WD.walnut, { axis: 'y' })), ...disc(0, 3.6, 0, 6.4, 0.6, metal(MET.gold)));
    out.push(box(0, 1.6, 7, 4, 1.6, 0.4, metal(MET.gold)), box(0, 2.1, 7.25, 2.6, 0.6, 0.1, () => 0x6a4a1a));
    // the scene: a snowy mound, a hollow oak with a lit doorway, two little firs
    out.push(...disc(0, 4.2, 0, 5.6, 1.4, snow), ...disc(-0.6, 5.6, -0.6, 3.6, 0.8, snow, { skip: 'd' }));
    const oak: Painter = (t) => (t.face === 4 && Math.abs(t.u - (t.w - 1) / 2) < 0.8 && t.v < 2 ? 0xffd88a : tone(R('#7a5236'), lvl(t, { noise: 0.4, scale: 1 })));
    out.push(box(0, 5.6, -0.6, 2.6, 5, 2.6, oak), box(0, 10.6, -0.6, 6, 2.6, 5, snowyPine(4)), box(0, 13.2, -0.6, 3.6, 1.6, 3, snowyPine(5)), box(-2, 9.6, -0.6, 2, 1, 1, oak));
    out.push(box(0, 5.6, 0.75, 1.2, 1.6, 0.1, lamp('#ffd88a'), { glow: true }));
    for (const [x, z, s] of [[3.4, 1.4, 1], [-3.4, 1.8, 0.8]] as const) out.push(box(x, 5.6, z, 3 * s, 2 * s, 3 * s, snowyPine(x * 3)), box(x, 5.6 + 2 * s, z, 2 * s, 1.8 * s, 2 * s, snowyPine(x * 4)), box(x, 5.6 + 3.8 * s, z, 1, 1.2 * s, 1, snowyPine(x * 5)));
    // the glass globe
    const gl = glassP('#eef8ff');
    for (const [y, h, r] of GLOBE) out.push(...ring8(0, 4.2 + y, 0, r, h, 0.3, gl, { glass: true }, 12));
    out.push(...disc(0, 17, 0, 2.8, 0.3, gl, { glass: true }));
    out.push(box(-3.6, 11, 5.4, 0.6, 3, 0.4, solid('#ffffff', { noise: 0, speck: 0 })), box(-4.4, 9.4, 4.6, 0.6, 1.2, 0.4, solid('#ffffff', { noise: 0, speck: 0 })));
    return out;
  },
  parts: () => Array.from({ length: 12 }, (_, i) => part('flake' + i, 'globe_flake', [0, 0, 0], () => [box(0, 0, 0, 0.7, 0.7, 0.7, lamp('#ffffff'), { glow: true })])),
  animate: (obj, t) => {
    const ph = phase(obj);
    obj.children.forEach((c) => {
      if (!c.name.startsWith('flake')) return;
      const i = +c.name.slice(5);
      const k = ((t * 0.18 + hash(i, 1, 4) + ph) % 1 + 1) % 1;
      const y = 16 - k * 10.6, a = t * 0.7 + i * 0.53, r = 1.6 + hash(i, 2, 4) * 3.4 * Math.min(1, (16 - y) / 4 + 0.3);
      c.position.set(Math.cos(a) * r * PX, y * PX, Math.sin(a) * r * PX);
    });
  },
});

// ------------------------------------------------------------------ sleigh bed

add({
  id: 'sleigh_bed', model: 'items/sleigh_bed.glb', name: 'Sleigh Bed', cat: 'seasonal', rarity: 'epic', size: [3, 2],
  blurb: 'Red lacquer, gold scrollwork and sleigh bells. Dreams depart nightly for the North.',
  sleep: { x: 2, y: 10, z: 0, rot: 90 },
  build: () => {
    const out: BoxSpec[] = [];
    const red = (t: Parameters<Painter>[0]) => tone(R('#b8202e'), lvl(t, { noise: 0.15, speck: 0.1, rim: 1 }) + (t.face === 4 && t.u === 1 ? 1.4 : 0));
    const gold = metal(MET.gold);
    // golden runners curling up at the front
    for (const z of [-9, 9]) {
      const pts: Vec3[] = [[-18, 1, z], [-10, 0.6, z], [10, 0.6, z], [16, 1.6, z], [19.6, 4.4, z], [20, 7.6, z], [18.4, 9, z], [17, 8, z]];
      out.push(...chain(pts, 1.2, gold));
      for (const x of [-12, 0, 12]) out.push(box(x, 1, z, 1.4, 4, 1.4, gold));
    }
    // body: curved head and foot boards with scroll tops
    out.push(box(0, 4.6, 0, 32, 4, 18, red), box(0, 4.6, 9.1, 30, 4, 0.4, (t) => (t.v === 1 && t.u % 3 !== 2 ? tone(R(MET.gold), 1) : red(t))));
    const board = (x: number, h: number, flip: number) => {
      const pts: Vec3[] = Array.from({ length: 6 }, (_, i) => [x + flip * Math.sin((i / 5) * 1.6) * 2.6, 8 + (i / 5) * h, 0] as Vec3);
      const o: BoxSpec[] = [];
      o.push(...chainXY(pts, 1.2, 19, red));
      const top = pts[pts.length - 1];
      o.push(box(top[0] + flip * 1.4, top[1] - 0.6, 0, 3.4, 2.4, 19.6, red), box(top[0] + flip * 1.4, top[1] - 0.6, 9.9, 2.6, 2.4, 0.4, gold), box(top[0] + flip * 1.4, top[1] - 0.6, -9.9, 2.6, 2.4, 0.4, gold));
      return o;
    };
    out.push(...board(-15.4, 16, -1), ...board(15.4, 6, 1));
    // gold scroll painted on the headboard face
    const scroll: Painter = (t) => {
      if (t.face !== 0) return red(t);
      const u = t.u - t.w / 2, v = t.v - t.h / 2, d = Math.hypot(u, v), a = Math.atan2(v, u);
      if (Math.abs(d - (2 + a * 0.6)) < 0.5 && d < 6) return tone(R(MET.gold), 1);
      if (Math.abs(Math.abs(u) - 7) < 0.5 && Math.abs(v) < 4) return tone(R(MET.gold), 0.6);
      return red(t);
    };
    out.push(box(-15.2, 8.6, 0, 0.4, 12, 16, scroll));
    // bedding: a tufted quilt, pillows, a striped throw and sleigh bells on the corners
    out.push(box(0.4, 8.6, 0, 29, 2.8, 17, fab('#f6f0e4', { stitch: '#e8c8b0' })));
    const quilt = fab('#2f6a4a', { tuft: 4, stitch: '#f2c84a' });
    out.push(box(4, 11.4, 0, 22, 1.6, 18, quilt), box(4, 7.6, 9.1, 22, 5, 1, quilt), box(4, 7.6, -9.1, 22, 5, 1, quilt));
    out.push(box(-7.4, 11.6, 0, 3, 1.6, 18, fab('#f6f0e4', { stitch: '#b8202e' })));
    for (const z of [-4.4, 4.4]) out.push(box(-11, 11.4, z, 5, 3, 8, fab('#fbf6ee', { pipe: '#b8202e' })), box(-11, 14.4, z, 3, 1, 6, fab('#fbf6ee')));
    out.push(box(10, 13, 0, 6, 1.2, 18.6, candy('#b8202e', '#fbf6ee', 1)), box(10, 8, 9.4, 6, 6, 1, candy('#b8202e', '#fbf6ee', 1)));
    for (const [x, z] of [[-15.4, 10], [-15.4, -10], [17.4, 10], [17.4, -10]]) out.push(...ball(x, 18 - (x > 0 ? 9 : 0), z, 1.2, gold), box(x, 20.4 - (x > 0 ? 9 : 0), z, 0.4, 0.8, 0.4, solid('#b8202e')));
    return out;
  },
});

// ------------------------------------------------------------------ nutcracker

add({
  id: 'nutcracker', model: 'items/nutcracker.glb', name: 'Captain Nutcracker', cat: 'seasonal', rarity: 'epic', size: [1, 1],
  blurb: 'Stands guard over the hollow all December. Clacks his jaw at anyone who looks at him.',
  build: () => {
    const out: BoxSpec[] = [];
    const red = smooth('#c8202e'), navy = smooth('#2a3a7a'), blk = smooth('#24242c'), skin = smooth('#f2d0b0'), gold = metal(MET.gold), wht = solid('#fbfbff', { noise: 0.6, scale: 0.8 });
    out.push(...disc(0, 0, 0, 5.4, 1.6, joinery('#2f6a4a', { axis: 'x' })), ...disc(0, 1.6, 0, 5.6, 0.4, gold));
    // boots, trousers, a red coat with gold buttons and a white belt
    for (const x of [-1.6, 1.6]) out.push(box(x, 2, 0.4, 2.6, 4, 3.4, blk), box(x, 6, 0, 2.4, 6, 2.6, navy), box(x, 9, 1.35, 0.4, 3, 0.2, gold));
    out.push(box(0, 12, 0, 7, 8, 4.6, red), box(0, 12, 0, 7.2, 1.4, 4.8, (t) => (t.face === 4 && Math.abs(t.u - (t.w - 1) / 2) < 1 ? tone(R(MET.gold), 1) : tone(R('#fbfbff'), lvl(t, { noise: 0.1 })))));
    for (const y of [14.4, 16.4, 18.4]) for (const x of [-1.4, 1.4]) out.push(box(x, y, 2.4, 0.8, 0.8, 0.4, gold));
    out.push(...chain([[-1.4, 19.4, 2.5], [0, 17, 2.6], [1.4, 19.4, 2.5]], 0.4, gold));
    // arms with gold epaulettes, holding a sabre
    for (const s of [-1, 1]) out.push(box(s * 4.6, 13, 0, 2.2, 7, 2.6, red), box(s * 4.6, 19, 0, 3, 1.2, 3.4, gold), box(s * 4.6, 18.6, 0, 3.4, 0.6, 3.6, gold), box(s * 4.6, 11.6, 0.4, 2.2, 1.6, 2.2, smooth('#fbfbff')));
    out.push(box(4.6, 11, 2, 0.6, 1, 2.6, gold), box(4.6, 11.4, 2.2, 0.4, 11, 0.6, metal(MET.silver)));
    // head: big face, painted cheeks, a white beard and moustache, and a tall shako
    const face: Painter = (t) => {
      if (t.face !== 4) return skin(t);
      const u = t.u - (t.w - 1) / 2;
      if (t.v === 4 && Math.abs(Math.abs(u) - 1.5) < 0.6) return 0x1a1418;
      if (t.v === 3 && Math.abs(Math.abs(u) - 2.4) < 0.6) return 0xf28a9a;
      return skin(t);
    };
    out.push(box(0, 20, 0, 6, 6, 5, face), box(0, 21.4, 2.6, 1.2, 1.4, 1, skin), box(0, 20.2, 2.6, 4, 1, 0.6, wht), box(0, 20, 2.2, 5, 1, 1, wht));
    out.push(box(-3.2, 21, -0.4, 0.8, 4.4, 4, wht), box(3.2, 21, -0.4, 0.8, 4.4, 4, wht), box(0, 21.4, -2.6, 6, 4.4, 0.6, wht));
    out.push(box(0, 26, 0, 6.4, 7, 5.4, blk), box(0, 26.6, 0, 6.6, 1, 5.6, gold), box(0, 29.6, 2.75, 2.4, 2.4, 0.4, gold), box(0, 33, 0, 6.8, 0.8, 5.8, gold));
    out.push(box(0, 33.8, 0.6, 1.6, 3, 1.6, solid('#fbfbff', { noise: 0.8, scale: 0.7 })), box(0, 36.4, 0.6, 1.2, 1.4, 1.2, solid('#e8343f', { noise: 0.5 })));
    return out;
  },
  parts: () => [part('jaw', 'nut_jaw', [0, 19.4, 0], () => [box(0, 18, 0.6, 4.6, 1.8, 3.6, smooth('#f2d0b0')), box(0, 18, 2.4, 4.4, 1.4, 0.4, solid('#fbfbff', { noise: 0.6, scale: 0.8 })), box(0, 17.6, 1.2, 4, 0.8, 3.4, solid('#fbfbff', { noise: 0.6, scale: 0.8 }))])],
  animate: (obj, t) => {
    const j = obj.getObjectByName('jaw'), ph = phase(obj);
    if (!j) return;
    const k = (t * 0.7 + ph) % 3;
    const home = j.userData.home as THREE.Vector3;
    j.position.y = home.y - (k < 0.6 ? Math.abs(Math.sin(k * Math.PI * 3.3)) * 1.2 : 0) * PX;
  },
});

// ------------------------------------------------------------------ candy cane

add({
  id: 'candy_cane', model: 'items/candy_cane.glb', name: 'Giant Candy Cane', cat: 'seasonal', rarity: 'rare', size: [1, 1],
  blurb: 'Peppermint-striped, taller than Pip and tied with a velvet bow.',
  build: () => {
    const out: BoxSpec[] = [];
    out.push(...disc(0, 0, 0, 5, 1.6, snow, { skip: 'd' }), ...disc(1, 1.6, 0.6, 3.4, 1, snow, { skip: 'd' }));
    const c = candy('#e8343f', '#fbf6ee', 1.8);
    out.push(box(0, 1, 0, 3, 24, 3, c));
    const hook: Vec3[] = Array.from({ length: 8 }, (_, i) => { const a = Math.PI - (i / 7) * Math.PI; return [3.2 + Math.cos(a) * 3.2, 25 + Math.sin(a) * 3.2, 0] as Vec3; });
    out.push(...chain(hook, 3, c), box(6.4, 22, 0, 3, 3, 3, c));
    // a velvet bow with long tails, and a sprig of holly
    const vel = fab('#2f6a4a', { weave: 0.3 });
    out.push(box(0, 16, 0, 3.6, 1.6, 3.6, vel), { ...box(-2.4, 16, 1.8, 3.4, 2.6, 1, vel), rot: [0, 0, 20] as Vec3 }, { ...box(2.4, 16, 1.8, 3.4, 2.6, 1, vel), rot: [0, 0, -20] as Vec3 }, box(0, 16.2, 2, 1.4, 1.6, 0.8, vel));
    out.push(lean(box(-0.8, 11, 1.8, 1, 5, 0.6, vel), 0, 0, -8), lean(box(0.8, 11, 1.8, 1, 5.6, 0.6, vel), 0, 0, 8));
    out.push(box(-1.2, 17.8, 2.2, 2.4, 1, 0.6, leaves('#2f7a3a', { seed: 2 })), box(-0.6, 18.4, 2.6, 0.8, 0.8, 0.8, smooth('#e8243a')), box(0.2, 18.2, 2.6, 0.8, 0.8, 0.8, smooth('#e8243a')));
    return out;
  },
});

// ------------------------------------------------------------------ cocoa mug

add({
  id: 'cocoa_mug', model: 'items/cocoa_mug.glb', name: 'Marshmallow Cocoa', cat: 'seasonal', rarity: 'rare', size: [1, 1], small: true,
  blurb: 'A snowflake mug of cocoa, piled with cream and marshmallows. Still steaming, somehow, forever.',
  build: () => {
    const out: BoxSpec[] = [];
    const mug: Painter = (t) => {
      const L = lvl(t, { noise: 0.1, speck: 0.05, rim: 1 });
      if (t.face !== 2 && t.face !== 3) {
        if (t.v === 1 || t.v === t.h - 2) return tone(R('#fbfbff'), 0.4);
        const u = ((t.u + 2) % 6) - 2, v = t.v - Math.floor(t.h / 2);
        if ((u === 0 && Math.abs(v) <= 1) || (v === 0 && Math.abs(u) <= 1)) return tone(R('#fbfbff'), 0.6);
        if (t.face === 4 && t.u === 1 && t.v > 2 && t.v < t.h - 3) return 0xffffff;
      }
      return tone(R('#2f5aa8'), L);
    };
    out.push(...disc(0, 0, 0, 3.6, 7, mug), box(4, 1.6, 0, 1.4, 4, 1.4, mug), box(3.4, 5, 0, 2, 1.2, 1.4, mug), box(3.4, 1.2, 0, 2, 1.2, 1.4, mug));
    out.push(...disc(0, 6.6, 0, 3.1, 0.4, solid('#6a3a1e', { noise: 0.3 }), { skip: 'd' }));
    // whipped cream swirl, marshmallows, cinnamon and a candy-cane stirrer
    const cream = solid('#fff8f0', { noise: 0.4, scale: 1 });
    out.push(...disc(0, 7, 0, 2.8, 1.2, cream), ...disc(0.2, 8.2, 0, 2, 1, cream), ...disc(0.4, 9.2, 0, 1.2, 0.8, cream), box(0.4, 10, 0, 0.6, 0.6, 0.6, cream));
    for (const [x, z, r] of [[-2.2, 1.4, 20], [2.2, 1.8, -15], [-1.6, -2, 40], [1.8, -1.6, 10]] as const) out.push({ ...box(x, 7, z, 1.4, 1.2, 1.4, smooth('#fbf4f0')), rot: [0, r, 0] as Vec3 });
    for (let i = 0; i < 5; i++) out.push(box(-1 + hash(i, 1, 3) * 2, 8.6 + hash(i, 2, 3), -1 + hash(i, 3, 3) * 2, 0.3, 0.3, 0.3, () => 0x8a4a22));
    out.push(lean(box(-1.6, 6.4, -1, 0.8, 7, 0.8, candy('#e8343f', '#fbf6ee', 1)), 18, 0, 20), box(-3.6, 12.6, -2.6, 0.8, 0.8, 2.2, candy('#e8343f', '#fbf6ee', 1)));
    return out;
  },
  parts: () => Array.from({ length: 3 }, (_, i) => part('steam' + i, 'cocoa_steam', [0, 0, 0], () => [box(0, 0, 0, 1.4, 1.4, 1.4, solid('#ffffff', { noise: 0.3, speck: 0 })), box(0.6, 0.8, 0.2, 0.8, 0.8, 0.8, solid('#f4f4ff', { noise: 0 }))])),
  animate: (obj, t) => {
    const ph = phase(obj);
    obj.children.forEach((c) => {
      if (!c.name.startsWith('steam')) return;
      const i = +c.name.slice(5), k = ((t * 0.35 + i / 3 + ph) % 1 + 1) % 1;
      c.position.set((Math.sin(t * 1.6 + i * 2) * 1.2 + 0.4) * PX, (11 + k * 9) * PX, Math.cos(t * 1.3 + i) * 0.8 * PX);
      c.scale.setScalar(k < 0.15 ? k / 0.15 : 1.2 - k);
      c.rotation.y = t + i;
    });
  },
});

// ------------------------------------------------------------------ wreath

add({
  id: 'wreath', model: 'items/wreath.glb', name: 'Holly Wreath', cat: 'seasonal', rarity: 'rare', size: [1, 1], wall: true,
  blurb: 'Fir, holly berries, pine cones and two little brass bells that ring when the door opens.',
  build: () => {
    const out: BoxSpec[] = [];
    const N = 16;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, x = Math.cos(a) * 8, y = 11 + Math.sin(a) * 8;
      out.push({ ...box(x, y - 2, 0.6, 5, 4, 3, pine(i, i % 2 ? '#2f6a45' : '#3a7a4a')), rot: [0, 0, (a * 180) / Math.PI] as Vec3, pivot: [x, y, 0.6] as Vec3 });
      out.push({ ...box(Math.cos(a) * 9.6, 11 + Math.sin(a) * 9.6 - 1, 0.4, 2.4, 2, 1.6, pine(i + 40, '#2a5e3e')), rot: [0, 0, (a * 180) / Math.PI + 40] as Vec3 });
    }
    // berries, pine cones and snow
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, r = 7 + hash(i, 1, 5) * 2;
      out.push(box(Math.cos(a) * r, 11 + Math.sin(a) * r, 2.4, 1, 1, 1, smooth('#e8243a')), box(Math.cos(a) * r + 0.9, 11 + Math.sin(a) * r + 0.4, 2.2, 0.9, 0.9, 0.9, smooth('#c81a2e')));
    }
    const cone: Painter = (t) => tone(R('#8a5a32'), lvl(t, { noise: 0.2 }) + ((t.u + (t.v % 2)) % 2 ? 0.7 : -0.7));
    for (const a of [0.9, 2.3, 4.1]) out.push(box(Math.cos(a) * 8, 11 + Math.sin(a) * 8 - 1.4, 2.2, 2, 2.8, 2, cone));
    for (const a of [1.3, 1.8, 2.6]) out.push(box(Math.cos(a) * 8.4, 11 + Math.sin(a) * 8.4 + 1.4, 1.6, 3, 1, 3, snow));
    // the big red bow at the bottom, its tails, and two bells
    const vel = fab('#d8202e', { weave: 0.3, stitch: '#f2c84a' });
    out.push({ ...box(-3, 1.6, 2.6, 5, 4, 1.4, vel), rot: [0, 0, 18] as Vec3 }, { ...box(3, 1.6, 2.6, 5, 4, 1.4, vel), rot: [0, 0, -18] as Vec3 }, box(0, 2.2, 3, 2, 2.6, 1.6, vel));
    out.push(lean(box(-1.4, -6, 2.6, 1.6, 8, 0.6, vel), 0, 0, -10), lean(box(1.4, -5, 2.6, 1.6, 7, 0.6, vel), 0, 0, 12));
    out.push(...ball(-2, -1.6, 2.8, 1.3, metal(MET.gold)), ...ball(2, -2.2, 2.8, 1.3, metal(MET.gold)), box(0, 20, 0.2, 1, 1, 1, metal(MET.brass)));
    return out;
  },
});

// ------------------------------------------------------------------ poinsettia

add({
  id: 'poinsettia', model: 'items/poinsettia.glb', name: 'Frostlight Poinsettia', cat: 'seasonal', rarity: 'rare', size: [1, 1], small: true,
  blurb: 'Crimson star-leaves in a gold-foil pot. Turns a whole windowsill into a celebration.',
  build: () => {
    const out: BoxSpec[] = [];
    const foil: Painter = (t) => tone(R(MET.gold), lvl(t, { noise: 0.8, scale: 0.8 }) + ((t.u + t.v * 2) % 5 === 0 ? 1.2 : 0));
    out.push(...disc(0, 0, 0, 3.6, 6, foil), ...ring8(0, 5, 0, 4.6, 2.2, 0.6, foil, {}, 8), ...disc(0, 5.6, 0, 3.2, 0.4, solid('#4a3424'), { skip: 'd' }));
    out.push(box(0, 2.6, 3.7, 7.6, 1.2, 0.4, fab('#d8202e')), box(0, 2.2, 4, 2.4, 2.2, 0.8, fab('#d8202e')));
    const bract = (c: string, len: number, w: number, a: number, pitch: number, y: number): BoxSpec => {
      const r = R(c);
      const p: Painter = (t) => {
        if (t.face !== 2 && t.face !== 3) return -1;
        const al = (t.bz + 0.5) / t.sz, x = ((t.bx + 0.5) / t.sx) * 2 - 1;
        const half = Math.sin(Math.PI * Math.min(1, al * 1.1)) * (1 - al * 0.6);
        if (Math.abs(x) > half) return -1;
        return tone(r, (t.face === 2 ? 0.4 : -0.6) + (Math.abs(x) < 0.15 ? 0.8 : 0) + ((al * 5 - Math.abs(x)) % 1 < 0.12 ? 0.5 : 0));
      };
      return { ...box(0, y, len / 2, w, 0.3, len, p, { cut: true }), rot: [-pitch, a, 0] as Vec3, pivot: [0, y, 0] };
    };
    for (let i = 0; i < 7; i++) out.push(bract('#3a7a3a', 7, 3.6, i * 51 + 20, -6, 6.4));
    for (let i = 0; i < 6; i++) out.push(bract('#d81a2a', 6.6, 3.4, i * 60, 14, 7.4));
    for (let i = 0; i < 5; i++) out.push(bract('#e8343f', 4.6, 2.8, i * 72 + 30, 30, 8.4));
    for (let i = 0; i < 5; i++) out.push(box(-0.8 + hash(i, 1, 2) * 1.6, 8.6, -0.8 + hash(i, 2, 2) * 1.6, 0.6, 0.8, 0.6, smooth(i % 2 ? '#f2c84a' : '#6ab84a')));
    return out;
  },
});

// ------------------------------------------------------------------ present pile

add({
  id: 'present_pile', model: 'items/present_pile.glb', name: 'Pile of Presents', cat: 'seasonal', rarity: 'rare', size: [2, 1],
  blurb: 'Stripes, spots and stars, all tied with bows. The little one keeps wriggling.',
  build: () => {
    const out: BoxSpec[] = [];
    const wrap = (c: string, rib: string, pat: 'stripe' | 'dot' | 'star' | 'check'): Painter => (t) => {
      const onRib = Math.abs(t.bx - t.sx / 2) < 0.7 || Math.abs(t.bz - t.sz / 2) < 0.7;
      if (onRib && t.face !== 3) return tone(R(rib), lvl(t, { noise: 0 }) * 0.6 + 0.4);
      const L = lvl(t, { noise: 0.1, rim: 0.8 });
      const x = Math.floor(t.x + 64), y = Math.floor(t.y + 64), z = Math.floor(t.z + 64);
      const alt = pat === 'stripe' ? (x + y + z) % 4 < 1 : pat === 'dot' ? (x % 3 === 0 && (y + z) % 3 === 0) : pat === 'check' ? (Math.floor(x / 2) + Math.floor(y / 2) + Math.floor(z / 2)) % 2 === 0 : (x % 4 === 1 && (y + z) % 4 === 2);
      return alt ? tone(R(pat === 'star' ? '#f2c84a' : '#fbf6ee'), L + 0.3) : tone(R(c), L);
    };
    const bow = (x: number, y: number, z: number, c: string): BoxSpec[] => {
      const p = fab(c, { weave: 0.2 });
      return [{ ...box(x - 1.2, y, z, 2.4, 1.6, 1, p), rot: [0, 0, 24] as Vec3 }, { ...box(x + 1.2, y, z, 2.4, 1.6, 1, p), rot: [0, 0, -24] as Vec3 }, box(x, y, z, 1.2, 1.2, 1.2, p)];
    };
    out.push(box(-6, 0, 0, 10, 8, 9, wrap('#d8202e', '#f2c84a', 'dot')), ...bow(-6, 8, 0, '#f2c84a'));
    out.push({ ...box(4, 0, 1, 8, 6, 8, wrap('#2f6a4a', '#d8202e', 'stripe')), rot: [0, -14, 0] as Vec3 }, ...bow(4, 6, 1, '#d8202e'));
    out.push({ ...box(-5.4, 9.4, -0.6, 6, 5, 6, wrap('#3a5ad8', '#fbf6ee', 'star')), rot: [0, 16, 0] as Vec3 }, ...bow(-5.4, 14.4, -0.6, '#fbf6ee'));
    out.push({ ...box(12, 0, -1, 4.6, 4.4, 4.6, wrap('#f2c84a', '#8a3ad8', 'check')), rot: [0, 24, 0] as Vec3 }, ...bow(12, 4.4, -1, '#8a3ad8'));
    // a gift tag on a string
    out.push(box(-0.6, 3, 4.6, 2.4, 1.4, 0.2, (t) => (t.u === 1 && t.v === 0 ? 0x2a1d16 : 0xf6ecd6)), box(-0.6, 4.4, 4.6, 0.2, 1.4, 0.2, () => 0xd8202e));
    return out;
  },
  parts: () => [part('wriggler', 'present_wriggler', [5, 0, 8], () => {
    const p: Painter = (t) => (Math.abs(t.bx - t.sx / 2) < 0.5 || Math.abs(t.bz - t.sz / 2) < 0.5 ? tone(R('#f2c84a'), 0.5) : tone(R('#e86a9a'), lvl(t, { noise: 0.1 })));
    return [box(5, 0, 8, 4, 3.6, 4, p), box(5, 3.6, 8, 4.4, 0.8, 4.4, p), { ...box(4.2, 4.4, 8, 1.8, 1.2, 0.8, fab('#f2c84a')), rot: [0, 0, 24] as Vec3 }, { ...box(5.8, 4.4, 8, 1.8, 1.2, 0.8, fab('#f2c84a')), rot: [0, 0, -24] as Vec3 }];
  })],
  animate: (obj, t) => {
    const w = obj.getObjectByName('wriggler'), ph = phase(obj);
    if (!w) return;
    const k = (t * 0.9 + ph) % 4, home = w.userData.home as THREE.Vector3;
    const hop = k < 0.8 ? Math.abs(Math.sin(k * Math.PI * 2.5)) : 0;
    w.position.y = home.y + hop * 1.4 * PX;
    w.rotation.z = k < 0.8 ? Math.sin(k * 20) * 0.12 : 0;
  },
});

// ------------------------------------------------------------------ stockings

add({
  id: 'stockings', model: 'items/stockings.glb', name: 'Knitted Stockings', cat: 'seasonal', rarity: 'rare', size: [2, 1], wall: true,
  blurb: 'Three hand-knitted stockings on a garland: one for Pip, one for you, one for whoever turns up.',
  build: () => {
    const out: BoxSpec[] = [];
    const pts = sag([-15, 0, 1], [15, 0, 1], 2, 10);
    out.push(...chain(pts, 1.8, pine(3)), box(-15, -0.8, 0.4, 1.4, 1.4, 1.4, metal(MET.brass)), box(15, -0.8, 0.4, 1.4, 1.4, 1.4, metal(MET.brass)));
    for (let i = 0; i < 6; i++) out.push(box(-12.5 + i * 5, -0.8 - Math.sin((i + 0.5) / 6 * Math.PI) * 1.6, 1.8, 1, 1, 1, smooth(i % 2 ? '#f2c84a' : '#e8243a')));
    const socks: [number, string, string, string][] = [[-9, '#d8202e', '#fbf6ee', 'P'], [0, '#2f6a4a', '#f2c84a', 'Y'], [9, '#3a5ad8', '#fbf6ee', '?']];
    socks.forEach(([x, c, st, letter], i) => {
      const k = knit(c, { stripe: st, every: 3 });
      const drop = 1.6 + (i % 2) * 1.6;
      out.push(box(x, -drop - 12, 1.6, 5, 10, 2.6, k), box(x + 2.2, -drop - 15, 1.6, 6, 4, 2.6, k), box(x + 4.2, -drop - 14.6, 1.6, 2, 3.2, 2.4, knit(st)));
      out.push(box(x - 0.2, -drop - 15, 1.6, 3, 2.6, 2.4, knit(st)));
      // fluffy cuff with an initial
      const glyph: Record<string, string[]> = { P: ['xx.', 'x.x', 'xx.', 'x..'], Y: ['x.x', '.x.', '.x.', '.x.'], '?': ['xx.', '..x', '.x.', '.x.'] };
      const cuff: Painter = (t) => {
        if (t.face === 4) {
          const gx = t.u - Math.floor(t.w / 2) + 1, gy = t.h - 1 - t.v - 0;
          if (gx >= 0 && gx < 3 && gy >= 0 && gy < 4 && glyph[letter][gy][gx] === 'x') return tone(R(c), -0.4);
        }
        return fluff('#fbfbff', { seed: i, curl: 0.8 })(t);
      };
      out.push(box(x, -drop - 4.6, 1.6, 6.4, 4.4, 3.2, cuff), box(x, -drop - 0.4, 1.2, 0.4, 1.2, 0.4, solid('#c9a878', { noise: 0 })));
      if (i === 1) out.push(lean(box(x - 1.4, -drop - 2, 2, 0.8, 6, 0.8, candy('#e8343f', '#fbf6ee', 1)), 0, 0, 14), box(x - 2.2, -drop + 3.8, 2, 2, 0.8, 0.8, candy('#e8343f', '#fbf6ee', 1)));
      if (i === 0) out.push(box(x + 1.4, -drop - 1, 2.2, 2.2, 2.2, 2, smooth('#c08850')), box(x + 0.6, -drop + 1, 2.2, 0.8, 0.8, 0.8, smooth('#c08850')), box(x + 2.2, -drop + 1, 2.2, 0.8, 0.8, 0.8, smooth('#c08850')));
    });
    return out;
  },
});

// ------------------------------------------------------------------ snowflake rug

add({
  id: 'snowflake_rug', model: 'items/snowflake_rug.glb', name: 'Snowflake Rug', cat: 'seasonal', rarity: 'rare', size: [2, 2], rug: true, flatItem: true,
  blurb: 'An icy-blue round rug with a six-armed snowflake that never melts, edged with snowball pom-poms.',
  sit: [{ x: 0, y: 1, z: 0 }],
  build: () => {
    const ice = R('#8ac8ea'), deep = R('#4a8ac8'), wht = R('#fbfdff');
    const p: Painter = (t) => {
      const d = Math.hypot(t.x, t.z), a = Math.atan2(t.z, t.x);
      const f = ((a / (Math.PI / 3)) % 1 + 1) % 1, off = Math.min(f, 1 - f) * (Math.PI / 3) * d;
      const L = (t.face === 2 ? 0.2 : -0.8) + ((Math.floor(t.x + 64) + Math.floor(t.z + 64)) & 1 ? 0.12 : -0.12);
      if (d > 13.6) return tone(wht, L + 0.3);
      if (d > 12.6) return tone(deep, L);
      // arms with side branches
      if (d < 10.5 && off < 0.75) return tone(wht, L + 0.4);
      for (const r of [4, 7]) {
        const along = d * Math.cos(Math.min(f, 1 - f) * (Math.PI / 3)) - r;
        if (along > 0 && along < 2.6 && Math.abs(off - along) < 0.6) return tone(wht, L + 0.2);
      }
      if (d < 2.2) return tone(wht, L + 0.6);
      if (Math.abs(d - 11.6) < 0.4 && Math.floor(a * 12 + 64) % 2 === 0) return tone(wht, L);
      return tone(ice, L + (hash(Math.floor(t.x * 2), Math.floor(t.z * 2), 2) > 0.96 ? 1 : 0));
    };
    const out = disc(0, 0, 0, 14, 0.8, p, { skip: 'd' });
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; out.push(...ball(Math.cos(a) * 14.6, 0, Math.sin(a) * 14.6, 1.2, fluff('#fbfdff', { seed: i, curl: 0.6 }))); }
    return out;
  },
});

// ------------------------------------------------------------------ icicle lights

add({
  id: 'icicle_lights', model: 'items/icicle_lights.glb', name: 'Icicle Lights', cat: 'seasonal', rarity: 'rare', size: [3, 1], wall: true,
  blurb: 'Glass icicles that drip with cold blue light, one after another, all along the wall.',
  light: { x: 0, y: -5, z: 3, color: 0xbfe4ff, power: 1.3 },
  build: () => {
    const out: BoxSpec[] = [...chain([[-24, 0, 1], [24, 0, 1]], 0.6, solid('#e8f0f8', { noise: 0 }))];
    for (const x of [-24, -8, 8, 24]) out.push(box(x, -0.8, 0.4, 1.2, 1.6, 1.2, metal(MET.silver)));
    // a thin crust of snow along the wire
    for (let i = 0; i < 12; i++) out.push(box(-22 + i * 4, 0.4, 1, 3 + hash(i, 1, 2) * 1.6, 0.8 + hash(i, 2, 2) * 0.6, 1.4, snow));
    return out;
  },
  parts: () => [0, 1, 2].map((g) => ownMats(part('drip' + g, 'icicle' + g, [0, 0, 0], () => {
    const out: BoxSpec[] = [];
    for (let i = g; i < 23; i += 3) {
      const x = -22 + i * 2, len = 3 + hash(i, 4, 7) * 6;
      const p = lamp(i % 2 ? '#cfeaff' : '#9fd4ff');
      out.push(box(x, -0.6 - len * 0.45, 1, 1.4, len * 0.45, 1.2, p, { glow: true }), box(x, -0.6 - len * 0.8, 1, 0.9, len * 0.35, 0.8, p, { glow: true }), box(x, -0.6 - len, 1, 0.5, len * 0.2, 0.5, lamp('#ffffff'), { glow: true }));
    }
    return out;
  }))),
  animate: (obj, t) => {
    const ph = phase(obj);
    for (let g = 0; g < 3; g++) { const k = ((t * 0.8 + g / 3 + ph) % 1 + 1) % 1; setBright(obj.getObjectByName('drip' + g), 0.5 + 0.5 * Math.max(0, 1 - k * 2.2)); }
  },
});

export const FROST_ITEMS: ItemDef[] = items;

// ------------------------------------------------------------------ finishes

const hsh = (x: number, y: number, s = 0) => hash(Math.floor(x), Math.floor(y), 0, s);

export const FROST_FINISHES: Finish[] = [
  {
    id: 'wall_candy_stripe', name: 'Candy-Stripe Paper', kind: 'wallpaper', price: 0, rarity: 'epic', series: SERIES, noStore: true,
    blurb: 'Hand-printed peppermint stripes above a gingerbread dado piped with icing and studded with sugar buttons.',
    swatch: ['#f5f7f2', '#9e5f66', '#a87652'],
    paint: (u, v) => {
      const g = paperT(u, v, 81);
      if (v < 15) {
        // the gingerbread dado: baked panels with piped icing frames and a button in each
        const panel = fl(u / 12), pu = mod(u, 12);
        const bake = (fb(u, v, 2, 82, 3) - 0.5) * 0.7 + (h2(u * 2, v * 2, 83) > 0.93 ? -0.45 : 0) + (h2(panel, 0, 84) - 0.5) * 0.3;
        if (v > 13.4 - (mod(fl(u * 2), 3) === 1 ? 0.8 : 0)) return tn(P.snow, -0.1 + (v > 14.4 ? 0.2 : 0));
        if (pu < 0.8 || v < 0.8) return tn(P.russet, -0.6);
        const frame = (Math.abs(pu - 2) < 0.4 || Math.abs(pu - 10) < 0.4) && v > 2 && v < 12 || (Math.abs(v - 2) < 0.4 || Math.abs(v - 12) < 0.4) && pu > 2 && pu < 10;
        if (frame) return tn(P.snow, mod(fl(u * 2) + fl(v * 2), 2) ? 0 : -0.25);
        const bd = Math.hypot(pu - 6, v - 7);
        if (bd < 1.3) return tn([P.berry, P.sage, P.lake][panel % 3], bd < 0.6 ? 0.45 : 0);
        return tn(P.tawny, bake);
      }
      if (v < 17) return tn(P.berry, v < 16 ? -0.5 : 0.35);
      const wob = (fb(u, v, 18, 85, 1) - 0.5) * 0.8;
      const s = mod(u + wob + 400, 16);
      if (Math.abs(s - 12) < 0.35) return tn(P.sage, -0.1);
      if (s < 4 || (s > 8 && s < 9)) return tn(P.berry, g + strokesT(u, v, 86, 'v', 10, 1) + (s < 0.7 ? -0.3 : 0));
      return tn(P.snow, g + (h2(u * 3, v * 3, 87) > 0.992 ? 0.6 : 0) - 0.05);
    },
  },
  {
    id: 'floor_frosty_planks', name: 'Frosty Planks', kind: 'flooring', price: 0, rarity: 'rare', series: SERIES, noStore: true,
    blurb: 'Pale, silvered boards with frost feathering out from every seam and nail head.',
    swatch: ['#f5f7f2', '#bcd6dc', '#617f8c'],
    paint: (u, v) => {
      const bw = 6, row = fl(v / bw), off = h2(row, 0, 88) * 30, len = 26 + h2(row, 1, 88) * 14;
      const seg = fl((u + off) / len), pu = mod(u + off, len), pv = mod(v, bw), id = row * 19 + seg;
      if (pv < 0.45 || pu < 0.4) return tn(P.dusk, -0.4);
      const near = Math.min(pv, bw - pv, pu, len - pu);
      const feather = Math.abs(Math.sin((u + v) * 1.7) * Math.sin((u - v) * 1.3));
      if (near < 2.4 && feather > 0.35 + near * 0.22 && h2(u * 2, v * 2, 89) > 0.25) return tn(P.snow, 0.2 - near * 0.1);
      if ((pu < 1.4 || pu > len - 1.4) && Math.abs(pv - 1.5) < 0.4) return tn(P.iron, 0.2);
      return tn(h2(id, 2, 88) > 0.5 ? P.ice : mixc(P.ice, P.mist, 0.5), grainT(pu, pv, id, 90) * 0.7 + (h2(id, 3, 88) - 0.5) * 0.35);
    },
  },
];
