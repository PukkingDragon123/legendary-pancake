// The Starfall Dreams series: wishes that fell from the sky and landed in the hollow.
import type * as THREE from 'three';
import { box, lean, type BoxSpec, type Painter, type Vec3 } from '../../gfx/box.ts';
import { tone } from '../../gfx/color.ts';
import { lamp, lvl, metal, R, smooth, solid } from '../../gfx/mats.ts';
import { fbm, hash } from '../../gfx/noise.ts';
import type { ItemDef } from '../furniture.ts';
import type { Finish } from '../finishes.ts';
import { ball, chain, disc, fab, fluff, glassP, joinery, MET, ownMats, paper, part, phase, pixBoxes, PX, ring8, setBright, WD, wx, wy, wz } from './kit.ts';
import { cells, fb, fl, grainT, h2, mod, paperT, strokesT, tn } from './finishes.ts';
import { P, mixc } from '../../gfx/palette.ts';

const SERIES = 'starfall';
const items: ItemDef[] = [];
const add = (d: Omit<ItemDef, 'series' | 'noStore' | 'price'> & { price?: number }) => items.push({ price: 0, ...d, series: SERIES, noStore: true });
const brass = metal(MET.brass), gold = metal(MET.gold);
const STAR5 = ['..x..', '.xxx.', 'xxxxx', '.xxx.', 'x...x'];
const STAR7 = ['...x...', '..xxx..', 'xxxxxxx', '.xxxxx.', '..xxx..', '.xx.xx.', 'xx...xx'];

/** Starry fabric: deep navy with gold and white stars and the odd tiny moon. */
const starry = (base = '#2a2a6a', o: { tuft?: number; seed?: number } = {}): Painter => {
  const f = fab(base, { tuft: o.tuft, weave: 0.18 });
  return (t) => {
    const cx = Math.floor((t.x + 64) / 3), cy = Math.floor((t.y + 64) / 3), cz = Math.floor((t.z + 64) / 3), h = hash(cx, cy, cz, o.seed ?? 3);
    const fx = (t.x + 64) % 3, fy = (t.y + 64) % 3, fz = (t.z + 64) % 3;
    const centre = (t.face === 2 || t.face === 3 ? Math.abs(fx - 1.5) < 0.5 && Math.abs(fz - 1.5) < 0.5 : (t.face < 2 ? Math.abs(fz - 1.5) < 0.5 : Math.abs(fx - 1.5) < 0.5) && Math.abs(fy - 1.5) < 0.5);
    if (h > 0.82 && centre) return h > 0.93 ? 0xfff6d0 : 0xf2c84a;
    return f(t);
  };
};

// ------------------------------------------------------------------ star projector

add({
  id: 'star_projector', model: 'items/star_projector.glb', name: 'Orrery Star Projector', cat: 'seasonal', rarity: 'epic', size: [1, 1], small: true,
  blurb: 'A pierced brass dome turns slowly over a candle-bright core, sprinkling the walls with constellations.',
  light: { x: 0, y: 12, z: 0, color: 0xc8b0ff, power: 2 },
  build: () => {
    const out: BoxSpec[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * 120 * Math.PI) / 180;
      out.push({ ...box(Math.sin(a) * 4.4, 0, Math.cos(a) * 4.4, 1.6, 2.4, 1.6, gold) }, { ...box(Math.sin(a) * 2.6, 1, Math.cos(a) * 2.6, 1, 1, 4.6, brass), rot: [0, i * 120, 0] as Vec3 });
    }
    out.push(...disc(0, 1.6, 0, 4.4, 2.6, joinery(WD.walnut, { axis: 'y' })), ...disc(0, 4.2, 0, 4.8, 0.6, gold));
    // a little gear train on the base
    const gear: Painter = (t) => (t.face === 4 && (Math.floor(Math.atan2(t.by - t.sy / 2, t.bx - t.sx / 2) * 3 + 32) % 2 === 0) && Math.hypot(t.bx - t.sx / 2, t.by - t.sy / 2) > t.sx / 2 - 0.8 ? -1 : brass(t));
    out.push(box(-1.6, 1.8, 4.3, 2.6, 2.6, 0.4, gear, { cut: true }), box(1, 2.2, 4.3, 1.8, 1.8, 0.4, gear, { cut: true }));
    out.push(box(0, 4.8, 0, 1.4, 3, 1.4, brass), ...disc(0, 7.4, 0, 2.6, 0.8, gold));
    // the glowing core, an equator ring and a crescent riding on top
    out.push(...ball(0, 8.6, 0, 3.4, lamp('#fff2d8'), { glow: true }));
    const eq: Vec3[] = Array.from({ length: 21 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [Math.cos(a) * 8.4, 12.4, Math.sin(a) * 8.4] as Vec3; });
    out.push(...chain(eq, 0.7, gold));
    for (const s of [-1, 1]) out.push(...chain([[s * 4.2, 4.6, 0], [s * 7.4, 6, 0], [s * 8.4, 9, 0], [s * 8.4, 12.4, 0]], 0.8, gold));
    out.push(...pixBoxes(['..xx', '.x..', 'x...', 'x...', '.x..', '..xx'], 0, 20.4, 0, 1, () => gold));
    return out;
  },
  parts: () => [part('dome', 'projector_dome', [0, 12.4, 0], () => {
    const navy = R('#1e1a4a');
    const dome: Painter = (t) => {
      const r = Math.hypot(t.x, t.y - 12.4, t.z) || 1, lat = Math.asin((t.y - 12.4) / r), lon = Math.atan2(t.z, t.x);
      const gx = Math.floor(lon * 7 + 64), gy = Math.floor(lat * 8 + 64), h = hash(gx, gy, 3);
      const fx = (lon * 7 + 64) % 1, fy = (lat * 8 + 64) % 1;
      if (h > 0.4 && Math.abs(fx - 0.5) < 0.16 && Math.abs(fy - 0.5) < 0.16) return h > 0.8 ? 0xfff6d0 : h > 0.6 ? 0xffe08a : 0xd8c8ff;
      if (Math.abs(lat) < 0.05) return tone(R(MET.gold), 0.8);
      return tone(navy, 0.4 + lat * 0.8 + ((Math.floor(t.x * 2) + Math.floor(t.y * 2) + Math.floor(t.z * 2)) % 7 === 0 ? 0.6 : 0));
    };
    return [...ball(0, 5, 0, 7.4, dome, { glow: true }), box(0, 19.4, 0, 1.2, 1, 1.2, gold)];
  })],
  animate: (obj, t) => { const d = obj.getObjectByName('dome'); if (d) d.rotation.y = t * 0.3 + phase(obj); },
});

// ------------------------------------------------------------------ moon bed

/** The crescent's side profile on a 2 px grid: inside the big circle, outside the bite. */
function crescentRows(): string[] {
  const rows: string[] = [];
  for (let y = 13; y >= 0; y--) {
    let r = '';
    for (let x = 0; x < 21; x++) {
      const cx = x + 0.5, cy = y + 0.5;
      const inA = Math.hypot(cx - 10.5, cy - 11) < 11;
      const inB = Math.hypot(cx - 14, cy - 15) < 11;
      r += inA && !inB ? 'x' : '.';
    }
    rows.push(r);
  }
  return rows;
}

add({
  id: 'moon_bed', model: 'items/moon_bed.glb', name: 'Crescent Moon Bed', cat: 'seasonal', rarity: 'epic', size: [3, 2],
  blurb: 'Curl up in the curve of the moon under a quilt of stars, with three wishes dangling from the tip.',
  sleep: { x: 2, y: 14, z: 0, rot: 90 },
  light: { x: -14, y: 18, z: 4, color: 0xfff0b8, power: 1 },
  build: () => {
    const out: BoxSpec[] = [];
    const moon: Painter = (t) => {
      const craters: [number, number, number][] = [[-12, 10, 2.4], [8, 3, 2], [-4, 3, 1.6], [14, 9, 1.4], [-16, 18, 1.8]];
      let L = lvl(t, { noise: 0.3, scale: 3, rim: 0.8 }) * 0.7 + 0.4;
      for (const [x, y, r] of craters) { const d = Math.hypot(t.x - x, t.y - y); if (d < r) L += d > r - 0.7 ? 0.6 : -0.7; }
      return tone(R('#f6e6a8'), L);
    };
    for (const z of [-9.6, 9.6]) out.push(...pixBoxes(crescentRows(), 0, 0, z, 1.6, () => moon, {}, 2));
    // the cradle floor between the two crescent sides
    out.push(box(1, 2, 0, 32, 7, 17.6, moon));
    // mattress, a starry quilt, cloud pillows and a moon-yellow throw
    out.push(box(1, 9, 0, 28, 3.4, 17.6, fab('#e8e0f8', { stitch: '#b8a8e8' })));
    const q = starry('#2a2a6a', { tuft: 5 });
    out.push(box(5, 12.4, 0, 20, 1.6, 17.8, q), box(14.6, 8.6, 0, 1, 5.4, 17.8, q));
    out.push(box(-5.6, 12.6, 0, 3, 1.6, 17.8, fab('#e8e0f8', { stitch: '#f2c84a' })));
    const cloud = fluff('#fbfaff', { seed: 4, curl: 1.2 });
    for (const z of [-4.2, 4.2]) out.push(...ball(-10, 12, z, 2.8, cloud), ...ball(-9, 12.4, z + 2, 2, cloud), ...ball(-11, 12.6, z - 1.8, 2.2, cloud));
    out.push(box(10, 14, 0, 5, 1.2, 17.8, fab('#f6d06a', { stitch: '#fbf6e0' })));
    // a little ladder of stars up the side
    for (let i = 0; i < 3; i++) out.push(...pixBoxes(STAR5, 15 - i * 3, 1 + i * 0.4, 10.8, 0.6, () => gold));
    return out;
  },
  parts: () => [[-17, 26, 10, 0], [-14, 23, 7, 1], [-19, 22, 13, 2]].map(([x, y, len, i]) => part('wish' + i, 'moon_wish' + i, [x, y, 0], () => [
    box(x, y - len, 0, 0.3, len, 0.3, solid('#f6f0e0', { noise: 0 })),
    ...pixBoxes(STAR5, x, y - len - 5, 0, 1.2, () => lamp(['#ffe46a', '#fff6c8', '#f6c8ff'][i]), { glow: true }),
  ])),
  animate: (obj, t) => {
    const ph = phase(obj);
    for (let i = 0; i < 3; i++) { const w = obj.getObjectByName('wish' + i); if (w) { w.rotation.z = Math.sin(t * 1.1 + i * 2 + ph) * 0.08; w.rotation.y = Math.sin(t * 0.7 + i) * 0.5; } }
  },
});

// ------------------------------------------------------------------ brass telescope

add({
  id: 'telescope_brass', model: 'items/telescope_brass.glb', name: 'Stargazer’s Brass Telescope', cat: 'seasonal', rarity: 'epic', size: [2, 2],
  blurb: 'Polished brass, leather grips and a finder scope. It drifts slowly across the sky, looking for wishes.',
  build: () => {
    const out: BoxSpec[] = [];
    for (let i = 0; i < 3; i++) {
      const a = i * 120 + 30, r = (a * Math.PI) / 180;
      out.push({ ...box(0, 0, 0, 1.8, 20, 1.8, wy(WD.cherry)), rot: [22, a, 0] as Vec3, pivot: [0, 19, 0] as Vec3 });
      out.push(box(Math.sin(r) * 7.2, 0, Math.cos(r) * 7.2, 2.4, 1.4, 2.4, brass));
    }
    // a chain between the legs and a little tray
    const tray: Vec3[] = Array.from({ length: 4 }, (_, i) => { const a = ((i * 120 + 30) * Math.PI) / 180; return [Math.sin(a) * 3.6, 9, Math.cos(a) * 3.6] as Vec3; });
    out.push(...chain(tray, 0.5, brass), box(0, 8.6, 0, 4, 0.6, 4, wx(WD.cherry, 0)), box(0.6, 9.2, 0.4, 2, 1.4, 2, smooth('#5a78b8')));
    out.push(...disc(0, 18.6, 0, 2.6, 1.4, gold), box(0, 20, 0, 2, 2.4, 2, brass));
    // a rolled star chart leaning on a leg
    out.push(lean(box(5, 0, 4, 1.6, 9, 1.6, paper('#e8dcc0')), 0, 0, 16), box(5.6, 8.6, 4, 1.8, 0.6, 1.8, solid('#2a2a6a')));
    return out;
  },
  parts: () => [part('tube', 'telescope_tube', [0, 22, 0], () => {
    const leather = fab('#5a3424', { stitch: '#c9a060', weave: 0.15 });
    const tube: BoxSpec[] = [
      box(0, 22, 0, 3.8, 3.8, 18, brass), box(0, 22, 0, 4.2, 4.2, 3, leather), box(0, 22, 7, 4.4, 4.4, 1, gold),
      box(0, 21.6, 10.2, 5, 5, 4, brass), box(0, 21.4, 12.2, 5.4, 5.4, 0.6, gold), box(0, 22.2, 12.6, 3.6, 3.6, 0.4, glassP('#6a8ad8')),
      box(0, 23.8, 12.7, 1, 1, 0.2, () => 0xffffff), box(0, 22.6, -9.6, 2.2, 2.2, 3, brass), box(0, 22.8, -11.4, 1.4, 1.4, 1, solid('#2a2420')),
      box(0, 26, 3, 1.6, 1.6, 7, brass), box(0, 25.8, 6.6, 2, 2, 1, gold), box(0, 25.4, 2, 0.8, 1.2, 0.8, brass), box(0, 25.4, 4.6, 0.8, 1.2, 0.8, brass),
      box(2.2, 21, 0, 1, 1, 1, gold), box(2.8, 20.6, 0, 0.6, 2, 0.6, brass),
    ];
    return tube.map((b) => ({ ...b, rot: [-26, 0, 0] as Vec3, pivot: [0, 22, 0] as Vec3 }));
  })],
  animate: (obj, t) => {
    const tb = obj.getObjectByName('tube'), ph = phase(obj);
    if (tb) { tb.rotation.y = -1.1 + Math.sin(t * 0.25 + ph) * 0.5; tb.rotation.x = Math.sin(t * 0.17 + ph) * 0.12; }
  },
});

// ------------------------------------------------------------------ star jar

add({
  id: 'star_jar', model: 'items/star_jar.glb', name: 'Jar of Fallen Stars', cat: 'seasonal', rarity: 'rare', size: [1, 1], small: true,
  blurb: 'Collected one by one from the meadow after the meteor shower. They hum very quietly.',
  light: { x: 0, y: 6, z: 0, color: 0xffe9a0, power: 1.4 },
  build: () => {
    const out: BoxSpec[] = [];
    const gl = glassP('#f0f4ff');
    out.push(...ring8(0, 0, 0, 4.4, 10, 0.3, gl, { glass: true }, 10), ...disc(0, 0, 0, 4.3, 0.4, gl, { glass: true }), ...ring8(0, 10, 0, 3.4, 1.4, 0.3, gl, { glass: true }, 10));
    out.push(...disc(0, 10.6, 0, 3, 2.4, (t) => tone(R('#c8925a'), lvl(t, { noise: 0.8, scale: 0.7 }))), ...disc(0, 10.4, 0, 3.6, 0.8, solid('#c9a878', { noise: 0.3 })));
    out.push(box(3.4, 7, 2.6, 0.3, 3.6, 0.3, solid('#c9a878', { noise: 0 })), { ...box(4.2, 4.4, 3, 2.6, 3, 0.3, (t) => (t.face === 4 && Math.abs(t.u - 1) + Math.abs(t.v - 1) < 1 ? 0xf2c84a : 0xf6ecd6)), rot: [0, -20, -8] as Vec3 });
    out.push(box(-3.2, 4, 3.4, 0.5, 3, 0.4, solid('#ffffff', { noise: 0, speck: 0 })));
    return out;
  },
  parts: () => [0, 1, 2].map((g) => ownMats(part('glim' + g, 'star_jar' + g, [0, 0, 0], () => {
    const out: BoxSpec[] = [];
    for (let i = g; i < 24; i += 3) {
      const a = hash(i, 1, 5) * Math.PI * 2, r = hash(i, 2, 5) * 2.8, y = 0.6 + Math.pow(hash(i, 3, 5), 1.6) * 8;
      out.push(...pixBoxes(['.x.', 'xxx', '.x.'], Math.cos(a) * r, y, Math.sin(a) * r, 0.9, () => lamp(['#ffc83a', '#ffe46a', '#ff8ad0', '#9ad8ff'][i % 4]), { glow: true }, 0.9));
    }
    return out;
  }))),
  animate: (obj, t) => {
    const ph = phase(obj);
    for (let g = 0; g < 3; g++) setBright(obj.getObjectByName('glim' + g), 0.5 + 0.5 * Math.max(0, Math.sin(t * (1.1 + g * 0.4) + g * 2 + ph)));
  },
});

// ------------------------------------------------------------------ planet mobile

const PLANETS: { r: number; c: string; arm: number; ang: number; drop: number; ring?: string; glow?: boolean }[] = [
  { r: 2.6, c: '#ffb43a', arm: 0, ang: 0, drop: 4, glow: true },
  { r: 2, c: '#d8b87a', arm: 7, ang: 0, drop: 7, ring: '#f2e0b0' },
  { r: 1.8, c: '#4a8ae8', arm: 7, ang: 90, drop: 10 },
  { r: 1.3, c: '#e8644a', arm: 7, ang: 180, drop: 6 },
  { r: 1.5, c: '#b88ae8', arm: 7, ang: 270, drop: 9 },
];

add({
  id: 'planet_mobile', model: 'items/planet_mobile.glb', name: 'Planetarium Mobile', cat: 'seasonal', rarity: 'rare', size: [1, 1], wall: true,
  blurb: 'A little sun and four planets on brass arms, turning slowly from a curly wall bracket.',
  light: { x: 0, y: -4, z: 12, color: 0xffc86a, power: 0.8 },
  build: () => {
    const out: BoxSpec[] = [box(0, 0, 0.4, 3, 6, 0.8, metal(MET.iron))];
    out.push(...chain([[0, 3, 0.8], [0, 4, 6], [0, 3, 10], [0, 1.4, 12.6], [0, -0.6, 12]], 0.8, metal(MET.iron)), ...chain([[0, 1, 0.8], [0, 1.6, 4], [0, 2.8, 6]], 0.6, metal(MET.iron)));
    out.push(box(0, -1.6, 12, 1.2, 1.2, 1.2, gold));
    return out;
  },
  parts: () => [part('mobile', 'planet_mobile', [0, -2, 12], () => {
    const out: BoxSpec[] = [box(0, -4, 12, 0.3, 2.4, 0.3, solid('#f6f0e0', { noise: 0 })), box(0, -4.4, 12, 15, 0.4, 0.4, brass), box(0, -4.4, 12, 0.4, 0.4, 15, brass), ...ball(0, -5, 12, 0.6, gold)];
    for (const p of PLANETS) {
      const a = (p.ang * Math.PI) / 180, x = Math.cos(a) * p.arm, z = 12 + Math.sin(a) * p.arm;
      const col = R(p.c);
      const paint: Painter = p.glow ? lamp(p.c) : (t) => tone(col, lvl(t, { noise: 0.3 }) + ((Math.floor(t.y * 1.5 + 64) % 3 === 0) ? -0.5 : 0.2) + (fbm(t.x, t.y, t.z, 3) > 0.6 ? 0.6 : 0));
      out.push(box(x, -4.4 - p.drop + p.r * 2, z, 0.3, p.drop - p.r * 2 + 0.2, 0.3, solid('#f6f0e0', { noise: 0 })));
      out.push(...ball(x, -4.4 - p.drop, z, p.r, paint, p.glow ? { glow: true } : {}));
      if (p.ring) out.push({ ...box(x, -4.4 - p.drop + p.r - 0.2, z, p.r * 4, 0.4, p.r * 4, (t) => (Math.hypot(t.bx - t.sx / 2, t.bz - t.sz / 2) < p.r * 1.2 || Math.hypot(t.bx - t.sx / 2, t.bz - t.sz / 2) > p.r * 2 ? -1 : tone(R(p.ring!), (Math.floor(Math.hypot(t.bx - t.sx / 2, t.bz - t.sz / 2) * 2) % 2) ? 0.4 : -0.3)), { cut: true }), rot: [0, 0, 18] as Vec3 });
    }
    // a tiny moon orbiting the blue planet
    out.push(...ball(Math.cos(Math.PI / 2) * 7 + 2.4, -4.4 - 10 + 1, 12 + 7 + 0.4, 0.6, smooth('#e8e8f0')));
    return out;
  })],
  animate: (obj, t) => { const m = obj.getObjectByName('mobile'); if (m) { m.rotation.y = t * 0.35 + phase(obj); m.rotation.z = Math.sin(t * 0.9) * 0.03; } },
});

// ------------------------------------------------------------------ cloud pouf

add({
  id: 'cloud_pouf', model: 'items/cloud_pouf.glb', name: 'Sleepy Cloud Pouf', cat: 'seasonal', rarity: 'rare', size: [2, 1],
  blurb: 'A plump little cloud that drifted in and dozed off. Very comfortable. Do not wake it.',
  sit: [{ x: 0, y: 11, z: 1 }],
  build: () => {
    const out: BoxSpec[] = [];
    const c1 = fluff('#fbfaff', { seed: 2, curl: 1.4 }), c2 = fluff('#ece6fb', { seed: 5, curl: 1.4 });
    out.push(...ball(0, 0, 0, 7, c1, {}, 1, 0.8), ...ball(-6.4, 0, 0.6, 5, c2, {}, 1, 0.8), ...ball(6.6, 0, 0.4, 5.4, c2, {}, 1, 0.8), ...ball(-2.4, 5.6, -1, 4.4, c1, {}, 1, 0.9), ...ball(3.4, 5, -0.6, 4, c1, {}, 1, 0.9));
    // a sleepy embroidered face: closed eyes, rosy cheeks and a tiny smile
    const ink = solid('#6a5aa8', { noise: 0 }), blush = solid('#f6b8d0', { noise: 0.2 });
    for (const s of [-1, 1]) out.push(box(s * 2.6, 6.6, 6.9, 2.4, 0.5, 0.4, ink), box(s * 2.6 - s * 1.4, 7, 6.8, 0.6, 0.5, 0.4, ink), box(s * 4.4, 5.2, 6.6, 1.8, 1.2, 0.4, blush));
    out.push(box(0, 4.8, 7, 1.6, 0.5, 0.4, ink), box(-1, 5.2, 6.95, 0.5, 0.5, 0.4, ink), box(1, 5.2, 6.95, 0.5, 0.5, 0.4, ink));
    // a little "z" floating above and a ribbon tag of rainbow stripes
    out.push(...pixBoxes(['xxx', '.x.', 'xxx'], 6, 12.6, 2, 0.4, () => solid('#b8a8e8', { noise: 0 }), {}, 0.7));
    ['#f28a8a', '#f2c86a', '#8ad88a', '#8ab8f2', '#c8a0f2'].forEach((c, i) => out.push(box(9.6 + i * 0.5, 1 + i * 0.2, 3.6, 0.5, 5 - i * 0.4, 0.4, solid(c, { noise: 0 }))));
    return out;
  },
});

// ------------------------------------------------------------------ comet rug

add({
  id: 'comet_rug', model: 'items/comet_rug.glb', name: 'Comet Rug', cat: 'seasonal', rarity: 'rare', size: [3, 2], rug: true, flatItem: true,
  blurb: 'A golden star streaking across the floor with a long, soft tail of dusk colours.',
  build: () => {
    const head = R('#f6c84a'), cols = ['#f6e0a0', '#f2a0c8', '#b88ae8', '#6a6ad8', '#3a3a8a'].map((c) => R(c));
    const p: Painter = (t) => {
      const L = (t.face === 2 ? 0.2 : -0.8) + ((Math.floor(t.x + 64) + Math.floor(t.z + 64)) & 1 ? 0.12 : -0.12);
      // star head at +x
      const hx = t.x - 13, hz = t.z, d = Math.hypot(hx, hz), a = Math.atan2(hz, hx) + Math.PI / 2;
      const rStar = 6.4 * (0.5 + 0.5 * Math.abs(Math.cos((a * 5) / 2)));
      if (d < rStar) return tone(head, L + (d < 2 ? 0.8 : d > rStar - 0.8 ? -0.7 : 0.2));
      // tail: a tapered fan of colour bands towards -x, wavy at the edge
      const k = (13 - t.x) / 34;
      if (k < 0 || k > 1) return -1;
      const half = 6.4 * (1 - k) + 0.6 + Math.sin(t.x * 0.8) * 0.6 * k;
      if (Math.abs(t.z) > half) return -1;
      const band = Math.min(4, Math.floor(Math.abs(t.z) / half * 2.4 + k * 2.6));
      if (hash(Math.floor(t.x), Math.floor(t.z), 4) > 0.95) return tone(R('#fff6d8'), 0.6);
      return tone(cols[band], L + (Math.abs(t.z) > half - 0.8 ? -0.6 : 0));
    };
    return [box(-1, 0, 0, 42, 0.8, 16, p, { cut: true, skip: 'd' })];
  },
});

export const STARFALL_ITEMS: ItemDef[] = items;

// ------------------------------------------------------------------ finishes

const hsh = (x: number, y: number, s = 0) => hash(Math.floor(x), Math.floor(y), 0, s);

export const STARFALL_FINISHES: Finish[] = [
  {
    id: 'wall_night_sky', name: 'Midnight Sky Paper', kind: 'wallpaper', price: 0, rarity: 'epic', series: SERIES, noStore: true,
    blurb: 'Brushy dusk-to-midnight paper scattered with lamp-gold stars, soft lilac nebulae and the odd crescent moon.',
    swatch: ['#f1d39a', '#46596a', '#1b222d'],
    paint: (u, v) => {
      const sky = strokesT(u, v, 91, 'u', 18, 3) + (v / 64) * 0.6 - 0.55;
      const neb = fb(u, v, 16, 92, 3);
      const mu = mod(u, 96) - 70, mv = v - 46;
      if (Math.hypot(mu, mv) < 4.6 && Math.hypot(mu - 1.8, mv + 1.2) > 4.1) return tn(P.lamp, Math.hypot(mu, mv) > 4 ? -0.3 : 0.1);
      const c = cells(u, v, 5, 93, 0.9);
      if (h2(c.id, 0, 94) > 0.55) {
        const dx = Math.abs(u - c.cx), dy = Math.abs(v - c.cy), big = h2(c.id, 1, 94) > 0.85;
        if (dx < 0.5 && dy < 0.5) return tn(h2(c.id, 2, 94) > 0.6 ? P.lamp : P.frost, 0.3);
        if (big && ((dx < 0.4 && dy < 1.6) || (dy < 0.4 && dx < 1.6))) return tn(P.lamp, -0.2);
      }
      if (neb > 0.6) return tn(neb > 0.68 ? P.plum : mixc(P.night, P.plum, 0.5), sky + (neb - 0.6) * 2);
      return tn(neb < 0.4 ? P.deepNight : P.night, sky + (h2(u * 2, v * 2, 95) - 0.5) * 0.15);
    },
  },
  {
    id: 'floor_starry_tiles', name: 'Starry Tiles', kind: 'flooring', price: 0, rarity: 'rare', series: SERIES, noStore: true,
    blurb: 'Glazed midnight tiles with a little brass star inlaid at every corner and a soft sheen on each.',
    swatch: ['#c8a764', '#46596a', '#27313f'],
    paint: (u, v) => {
      const T = 12, tu = mod(u, T), tv = mod(v, T), i = fl(u / T), j = fl(v / T);
      const cu = Math.min(tu, T - tu), cv = Math.min(tv, T - tv);
      if ((cu < 0.5 && cv < 2.2) || (cv < 0.5 && cu < 2.2) || (cu < 1.1 && cv < 1.1)) return tn(P.brass, cu + cv < 0.9 ? 0.5 : 0);
      if (tu < 0.45 || tv < 0.45) return tn(P.deepNight, 0);
      const pool = Math.hypot(tu - T / 2, tv - T / 2) / (T / 2);
      const gloss = Math.abs(tu - tv - 2) < 0.6 && tu > 3 && tu < 9 ? 0.45 : 0;
      return tn(h2(i, j, 96) > 0.5 ? P.slate : mixc(P.slate, P.night, 0.5), (h2(i, j, 97) - 0.5) * 0.35 - pool * 0.3 + gloss + (fb(u, v, 2, 98, 2) - 0.5) * 0.2);
    },
  },
];
