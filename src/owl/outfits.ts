// The owl's wardrobe. Every piece is real geometry layered onto the owl's bones (caps, brims,
// scarves, capes, satchels), painted in the same pixel style as the feathers so outfits look
// modelled, not pasted on. Pieces read the wearer's anchor points (`G`, set per owl by dressOwl), so
// the same hat sits right on a flat-headed Little Owl, a tufted Eagle-Owl or a huge Great Grey.
import { box, lean, type BoxSpec, type Painter, type Texel } from '../gfx/box.ts';
import { col, mix, ramp, tone } from '../gfx/color.ts';
import { cloth, lamp, leaves, lvl, metal, R, smooth, solid, type Tint } from '../gfx/mats.ts';
import { fbm, hash } from '../gfx/noise.ts';
import { bodyDepth, bodyHalfW, geoOf, type Geo } from './geo.ts';
import type { OwlParts } from './legacy.ts';
import type { AnchorName, BoneName, OutfitSlot, OwlLook, OwlModel } from './model.ts';
import * as THREE from 'three';
import { instanceGLB, loadGLB } from '../gfx/glb.ts';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { speciesOf } from './species.ts';
import { PIECE_MODEL_LIST } from './outfits.gen.ts';

/** The anchors of the owl being dressed right now (dressOwl sets them before each piece). */
let G: Geo = geoOf(speciesOf('tawny').shape);
let headTop = G.headTop;

export interface PieceDef {
  id: string;
  slot: OutfitSlot;
  name: string;
  blurb: string;
  /** acorns, or moon gems when premium */
  price: number;
  premium?: boolean;
  /** found only on adventures in this area */
  area?: string;
  /** limited series piece from the Snow Queen's banners (never in the regular store) */
  series?: string;
  /** not sold anywhere (Queen Neve's own regalia) */
  noStore?: boolean;
  make(P: OwlParts): void;
}

export const PIECES: PieceDef[] = [];
const def = (id: string, slot: OutfitSlot, name: string, price: number, blurb: string, make: PieceDef['make'], o: { premium?: boolean; area?: string; series?: string; noStore?: boolean } = {}) => {
  PIECES.push({ id, slot, name, price, blurb, make, ...o });
};
export const PIECE: Record<string, PieceDef> = {};

/** depth of the face plane the eyes sit on */
const fz = (P: OwlParts) => P.g.discFront;
/** the body's cross-section at height y: half width, front and back (the body is an egg of tiers) */
const at = (y: number) => ({ hw: bodyHalfW(G, y), ...bodyDepth(G, y) });
/** a band hugging the body at height y (scarves, collars, straps) */
const band = (y: number, h: number, grow: number, m: Painter, o: Partial<BoxSpec> = {}): BoxSpec => {
  const a = at(y + h / 2);
  return box(0, y, (a.front + a.back) / 2, a.hw * 2 + grow * 2, h, a.front - a.back + grow * 2, m, o);
};
const neckY = () => G.bodyTop - 1.2;
const fineJ = (t: Texel) => (hash(Math.floor(t.x * 3), Math.floor(t.y * 3), Math.floor(t.z * 3), 77) - 0.5) * 0.35;

/** Chunky hand-knit stitches: little V columns stacked in rows. */
function knit(c: Tint, o: { stripe?: Tint; every?: number; rib?: boolean } = {}): Painter {
  const r = R(c), s = o.stripe ? R(o.stripe) : null, every = o.every ?? 4;
  return (t) => {
    const across = t.face === 0 || t.face === 1 ? t.z : t.x;
    const row = Math.floor(t.y * 1.5), colm = Math.floor(across * 1.5);
    let L = lvl(t, { noise: 0.15, speck: 0, rim: 0.5, grad: 0.5 }) * 0.8;
    if (t.face === 2 || t.face === 3) L += (Math.floor(t.x * 1.5) + Math.floor(t.z * 1.5)) % 2 ? -0.4 : 0.2;
    else {
      const v = ((t.y * 1.5) - row), u = ((across * 1.5) - colm);
      L += Math.abs(u - 0.5) * 2 > 0.75 - v * 0.5 ? -0.75 : 0.35;
    }
    const rr = s && Math.floor((t.y + 40) / 1.35) % every < every / 2 ? s : r;
    return tone(rr, L + fineJ(t));
  };
}

/** A white fluffy trim (pompoms, cuffs, cloud puffs, fur). */
const fluff = (c: Tint = '#fbf8f2'): Painter => {
  const r = R(c);
  return (t) => tone(r, lvl(t, { noise: 0.9, scale: 1.1, speck: 0.8, rim: 0.6 }) * 0.7 + 0.4 + fineJ(t) * 2);
};

/** Fabric with tiny motif dots (stars, moons, polka). */
const motif = (c: Tint, dot: Tint, every = 2.6, starry = false): Painter => {
  const r = R(c), d = R(dot);
  return (t) => {
    const across = t.face === 0 || t.face === 1 ? t.z : t.x;
    const gx = Math.round(across / every), gy = Math.round(t.y / every);
    const ox = across - gx * every, oy = t.y - gy * every;
    const L = lvl(t, { noise: 0.25, speck: 0.2, rim: 0.5 }) * 0.8 + fineJ(t);
    const hit = starry ? (Math.abs(ox) < 0.2 && Math.abs(oy) < 0.55) || (Math.abs(oy) < 0.2 && Math.abs(ox) < 0.55) : Math.hypot(ox, oy) < 0.42;
    if (hit && hash(gx, gy, t.face, 5) > (starry ? 0.35 : 0.1)) return tone(d, 1);
    return tone(r, L);
  };
};

/** Velvet: deep folds and a soft sheen along the lit edges. */
const velvet = (c: Tint): Painter => {
  const r = R(c);
  return (t) => {
    let L = lvl(t, { noise: 0.5, scale: 2.2, speck: 0, rim: 0.9, grad: 0.8 }) * 0.9;
    if (t.face !== 2 && t.face !== 3 && hash(Math.floor((t.face < 2 ? t.z : t.x) * 1.2), t.face, 4, 9) > 0.75) L -= 0.6;
    return tone(r, L + fineJ(t));
  };
};

/** Ice crystal: bright facets with a cold core, white glints and frosty edges. */
const ice = (c = '#8fd3ff'): Painter => {
  const r = ramp(col(c), { step: 0.08, cool: 250, warm: 200, shift: 0.02 });
  return (t) => {
    // bright frosted edges, a deep cold core, a diagonal glint and the odd white sparkle
    const e = Math.min(t.u + 0.5, t.w - t.u - 0.5, t.v + 0.5, t.h - t.v - 0.5);
    let L = [0.5, -0.4, 1.4, -1.2, 0.8, -0.5][t.face] + (e < 1.2 ? 1.5 : 0) - (Math.abs(t.u + 0.5 - t.w / 2) < t.w * 0.18 ? 1.0 : 0);
    if (Math.abs(t.u - t.v * 0.6 - 1) < 0.6) L += 1.3;
    if (hash(t.u, t.v, t.face, 3) > 0.95) return 0xffffff;
    return tone(r, L);
  };
};

const GOLD = '#f2b632';

// ------------------------------------------------------------------ head

def('nightcap', 'head', 'Starry Nightcap', 0, 'The classic. Comes with a pompom that bobs when Pip nods off.', (P) => {
  const m = cloth('#4a5fb0', { stripe: '#f3e9cf', stripeEvery: 3 }), f = fluff();
  P.tufts = false;
  const s = G.headW / 16.4;
  P.add('head', box(0, headTop - 1.6, G.headZ, G.headW + 0.8, 2.2, G.headD + 0.8, f, { tag: 'brim' }));
  const steps: [number, number, number, number, number][] = [[0, 0.6, 13.6, 2.8, 11.6], [1, 3.2, 10.6, 2.6, 9], [2.6, 5.4, 7.8, 2.2, 6.8], [4.8, 6.9, 5.4, 1.8, 5], [7, 6.8, 3.6, 1.8, 3.6], [8.6, 5.4, 2.8, 1.9, 2.8]];
  for (const [x, y, w, h, d] of steps) P.add('head', box(x * s, headTop + y - 0.2, G.headZ - 0.4 - x * 0.06, w * s, h, d * s, m));
  P.add('head', box(9.2 * s, headTop + 2.2, -0.4, 3.4, 3.2, 3.4, f, { tag: 'pom' }));
});
def('beanie', 'head', 'Mossy Beanie', 220, 'Hand-knit by a very patient hedgehog.', (P) => {
  P.tufts = false;
  const m = knit('#5f9a52'), rib = knit('#e9d9b2');
  P.add('head', box(0, headTop - 1.8, G.headZ, G.headW + 0.8, 2.4, G.headD + 0.8, rib));
  P.add('head', box(0, headTop + 0.4, G.headZ - 0.2, G.headW - 0.8, 2.2, G.headD - 0.8, m), box(0, headTop + 2.4, G.headZ - 0.3, G.headW - 4, 1.6, G.headD - 3.6, m));
  P.add('head', box(0, headTop + 3.8, G.headZ - 0.3, 3.6, 3.2, 3.6, fluff('#f3e2bd'), { tag: 'pom' }));
});
def('explorer', 'head', 'Explorer Helmet', 380, 'For mapping mushroom caves and moonlit marshes.', (P) => {
  P.tufts = false;
  const m = smooth('#e4cf9a'), band2 = cloth('#7a4a2b');
  P.add('head', box(0, headTop - 1.0, G.headZ + 0.4, G.headW + 5, 0.9, G.headD + 5, m));
  P.add('head', box(0, headTop - 0.4, G.headZ, G.headW - 1, 3, G.headD - 1, m), box(0, headTop + 2.4, G.headZ, G.headW - 4, 1.6, G.headD - 4, m), box(0, headTop + 3.8, G.headZ, 2, 0.8, 2, metal(GOLD)));
  P.add('head', box(0, headTop - 0.3, G.headZ, G.headW - 0.6, 1.1, G.headD - 0.6, band2, { skip: 'ud' }));
}, { area: 'woods' });
def('wizard', 'head', 'Stargazer Hat', 90, 'Every sparkle is a wish someone made while falling asleep.', (P) => {
  P.tufts = false;
  const m = motif('#2b2f7a', '#ffd84a', 2.4, true);
  P.add('head', box(0, headTop - 1.0, G.headZ, G.headW + 6, 0.9, G.headD + 6, m));
  const steps: [number, number, number, number][] = [[headTop - 0.2, 13, 3, 0], [headTop + 2.8, 10, 3, -0.8], [headTop + 5.8, 7, 2.6, -1.8], [headTop + 8.4, 4.4, 2.2, -3], [headTop + 10.4, 2.4, 1.8, -4.4]];
  for (const [y, w, h, z] of steps) P.add('head', box(0, y, G.headZ + z, w * G.headW / 16.4, h, w * G.headW / 16.4, m));
  P.add('head', box(0, headTop + 12, G.headZ - 5.4, 1.6, 1.6, 1.6, lamp('#ffe27a'), { glow: true }));
}, { premium: true });
def('flowercrown', 'head', 'Daisy Crown', 160, 'Picked at dawn from the edge of Whispering Woods.', (P) => {
  const leaf = leaves('#5aa047', { seed: 4 });
  const n = 14, rx = G.headW * 0.45, rz = G.headD * 0.49;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = Math.sin(a) * rx, z = G.headZ + Math.cos(a) * rz;
    P.add('head', box(x, headTop - 1.4, z, 1.6, 1.1, 1.6, leaf));
    if (i % 2 === 0) {
      const petal = i % 4 === 0 ? smooth('#fffaf0') : smooth('#ffd1e0');
      P.add('head', box(x, headTop - 0.4, z, 2.2, 0.8, 2.2, petal), box(x, headTop + 0.2, z, 1, 0.6, 1, smooth('#ffc93a')));
    }
  }
});
def('crown', 'head', 'Moon Crown', 160, 'Forged from the first light of a crescent moon.', (P) => {
  const g = metal(GOLD);
  P.add('head', box(0, headTop - 0.6, G.headZ, 9, 1.8, 7.6, g, { skip: 'ud' }));
  for (const [x, z] of [[-3.8, 0], [3.8, 0], [0, 3.4], [0, -3.4], [-2.8, 2.6], [2.8, 2.6], [-2.8, -2.6], [2.8, -2.6]]) P.add('head', box(x, headTop + 1.1, G.headZ + z, 1.1, 1.6, 1.1, g));
  P.add('head', box(0, headTop + 0.9, G.headZ + 3.9, 1.6, 1.6, 0.8, lamp('#8fe3ff'), { glow: true }));
}, { premium: true });
def('beret', 'head', 'Painter Beret', 260, 'Tilted just so. Artistic sighs not included.', (P) => {
  const m = cloth('#c2423f');
  P.add('head', { ...box(1.4, headTop - 0.7, G.headZ, G.headW - 1, 1.8, G.headD - 0.4, m), rot: [0, 0, -8] }, { ...box(1.8, headTop + 0.9, G.headZ, G.headW - 4, 1, G.headD - 3, m), rot: [0, 0, -8] }, box(0.5, headTop + 1.9, G.headZ, 0.8, 1, 0.8, m));
});
def('acorn', 'head', 'Acorn Cap', 140, 'Borrowed from a very large acorn. It said yes.', (P) => {
  const cup = (() => { const r = R('#8a5a32'); return (t: Texel) => tone(r, lvl(t, { noise: 0.2 }) * 0.7 + ((Math.floor(t.x * 1.5) + Math.floor(t.y * 1.5) + Math.floor(t.z * 1.5)) % 2 ? -0.7 : 0.5)); })();
  P.add('head', box(0, headTop - 1.5, G.headZ, G.headW + 1.2, 2.6, G.headD + 1.2, cup), box(0, headTop + 1.1, G.headZ, G.headW - 3, 1.6, G.headD - 3, cup), box(0, headTop + 2.7, G.headZ, 1.4, 2.2, 1.4, solid('#5e3a20')));
  P.tufts = false;
});
def('toadstool', 'head', 'Toadstool Cap', 300, 'Spotted in the Mushroom Grotto. Very fashionable there.', (P) => {
  P.tufts = false;
  const m = motif('#d8402f', '#fff6e8', 3.2);
  P.add('head', box(0, headTop - 0.9, G.headZ, G.headW + 3, 2.2, G.headD + 3, m), box(0, headTop + 1.3, G.headZ, G.headW - 1, 2, G.headD - 1, m), box(0, headTop + 3.3, G.headZ, G.headW - 6, 1.4, G.headD - 6, m));
  P.add('head', box(0, headTop - 1.5, G.headZ, G.headW + 2, 0.7, G.headD + 2, smooth('#f6ead2'), { skip: 'u' }));
}, { area: 'grotto' });
def('froghat', 'head', 'Froggy Hat', 340, 'Ribbit. That is all.', (P) => {
  P.tufts = false;
  const g = smooth('#78c25a'), w = smooth('#fffdf2'), k = smooth('#1d2321');
  P.add('head', box(0, headTop - 1.3, G.headZ, G.headW + 1, 3, G.headD + 1, g), box(0, headTop + 1.7, G.headZ, G.headW - 3, 1.4, G.headD - 3, g));
  for (const sd of [-1, 1]) P.add('head', box(sd * 4.2, headTop + 2.1, G.headZ + 3.2, 3.4, 2.8, 3, g), box(sd * 4.2, headTop + 2.7, G.headZ + 4.75, 2.2, 1.8, 0.2, w), box(sd * 4.2, headTop + 3, G.headZ + 4.9, 1, 1, 0.2, k));
  P.add('head', box(0, headTop + 0.3, G.headZ + G.headD / 2 + 0.5, 4, 0.6, 0.3, smooth('#e66a7a')));
}, { area: 'lake' });
def('bow', 'head', 'Ribbon Bow', 90, 'A big soft bow, tied between the ears.', (P) => {
  const m = cloth('#ff8fb1', { shade: { noise: 0.2 } });
  P.add('head', box(-2.6, headTop - 0.7, 2.4, 2, 2, 2, m), { ...box(-4.6, headTop - 1.3, 2.4, 3, 3.2, 1.2, m), rot: [0, 0, 18] }, { ...box(-0.6, headTop - 1.3, 2.4, 3, 3.2, 1.2, m), rot: [0, 0, -18] });
});
def('sprout', 'head', 'Little Sprout', 0, 'It grows a tiny bit every good night of sleep.', (P) => {
  const stem = solid('#4f9a3c'), leaf = leaves('#6fc054', { seed: 2 });
  P.add('head', box(0, headTop - 0.6, 1, 0.8, 3, 0.8, stem), { ...box(-1.5, headTop + 2, 1, 3, 0.8, 1.8, leaf), rot: [0, 0, 22] }, { ...box(1.6, headTop + 1.6, 1, 2.6, 0.8, 1.6, leaf), rot: [0, 0, -26] });
});

// ---------------- Frostlight & Starfall series (banner pulls only)

def('santa_hat', 'head', 'Frostlight Santa Hat', 0, 'Red velvet, a snowy brim and a pompom that flops when Pip nods.', (P) => {
  P.tufts = false;
  const red = velvet('#c8202e'), fur = fluff('#fdfbf6');
  P.add('head', box(0, headTop - 1.8, G.headZ, G.headW + 1.2, 2.4, G.headD + 1.2, fur));
  const s = G.headW / 18.5;
  const steps: [number, number, number, number][] = [[0, 0.4, 14.4, 2.4], [0.6, 2.6, 11.6, 2.2], [1.8, 4.4, 8.8, 2], [3.4, 5.8, 6.2, 1.7], [5.2, 6.5, 4.2, 1.5], [7, 6.2, 3, 1.5], [8.4, 5.2, 2.4, 1.5]];
  steps.forEach(([x, y, w, h], i) => P.add('head', box(x * s, headTop + y - 0.4, G.headZ - 0.3 - i * 0.25, w * s, h, Math.max(2.2, w * s * 0.86), red)));
  P.add('head', box(9.2 * s, headTop + 2.6, G.headZ - 2, 2.8, 2.8, 2.8, fur, { tag: 'pom' }));
}, { series: 'frostlight', noStore: true });
def('reindeer_antlers', 'head', 'Reindeer Antlers', 0, 'Soft velvet antlers on a jingly headband. Rudolph approved.', (P) => {
  P.tufts = false;
  const antler = (() => { const r = R('#8a5a34'); return (t: Texel) => tone(r, lvl(t, { noise: 0.6, scale: 1.2, speck: 0.4, rim: 0.7 }) * 0.8 + 0.2); })();
  const bandM = velvet('#b8202c');
  const hb = at(0);
  void hb;
  P.add('head', box(0, headTop - 1.2, G.headZ + 0.6, G.headW * 0.55, 0.9, 1.4, bandM));
  for (const sd of [-1, 1]) {
    const x = sd * Math.min(4.4, G.headW * 0.28), y = headTop - 0.8, z = G.headZ + 0.4;
    P.add('head', box(x, y - 1.2, z, 1.4, 1.6, 1.4, bandM));
    P.add('head', lean(box(x, y, z, 1.1, 5.2, 1.1, antler), -6, 0, -sd * 20));
    P.add('head', lean(box(x + sd * 1.6, y + 4.4, z - 0.2, 0.9, 3.4, 0.9, antler), -10, 0, -sd * 48));
    P.add('head', lean(box(x + sd * 0.5, y + 2.4, z + 0.3, 0.85, 3.0, 0.85, antler), 14, 0, sd * 18));
    P.add('head', lean(box(x + sd * 1.0, y + 4.8, z, 0.8, 2.6, 0.8, antler), -4, 0, sd * 6));
    P.add('head', box(x, y - 1.9, z + 0.9, 1, 1, 1, metal('#f2c84a')));
  }
}, { series: 'frostlight', noStore: true });
def('star_crown', 'head', 'Starfall Crown', 0, 'Five fallen stars, set in gold. They hum softly at night.', (P) => {
  P.tufts = false;
  const g = metal('#f6c544'), gem = lamp('#fff2a8');
  const rx = Math.min(4.8, G.headW * 0.3), rz = Math.min(4.2, G.headD * 0.33);
  P.add('head', box(0, headTop - 0.9, G.headZ, rx * 2 + 1.4, 1.5, rz * 2 + 1.4, g, { skip: 'ud' }));
  for (let i = 0; i < 5; i++) {
    // a gold prong topped with a little four-pointed star, the front one the biggest
    const a = (i / 5) * Math.PI * 2, x = Math.sin(a) * rx, z = G.headZ + Math.cos(a) * rz, s = i === 0 ? 1.35 : 1;
    const sy = headTop + 2.6 * s;
    P.add('head', box(x, headTop - 0.3, z, 0.9, 2.2 * s, 0.9, g));
    P.add('head', box(x, sy - 1.0 * s, z, 0.45 * s, 2.4 * s, 0.4, gem, { glow: true }), box(x, sy - 0.2 * s, z, 2.4 * s, 0.45 * s, 0.4, gem, { glow: true }), box(x, sy - 0.45 * s, z, 0.95 * s, 0.95 * s, 0.5, lamp('#fff8d0'), { glow: true }));
  }
  P.add('head', box(0, headTop + 0.2, G.headZ + rz + 0.6, 1.4, 1.4, 0.6, lamp('#ffd36a'), { glow: true }));
}, { series: 'starfall', noStore: true });

// ---------------- Queen Neve's regalia (not sold anywhere)

def('ice_crown', 'head', 'Ice Crown', 0, 'Grown from a single winter night. Never melts, never stops sparkling.', (P) => {
  // a tiara: a fine silver band round the front of the crown, set with a row of ice crystals
  P.tufts = false;
  const silver = metal('#e6edf7'), cr = ice('#86ccff'), core = ice('#d9f2ff'), glint = lamp('#c8ecff');
  const rx = Math.min(4.4, G.headW * 0.28), rz = Math.min(3.8, G.headD * 0.3), y0 = headTop - 1.3;
  for (let i = -5; i <= 5; i++) {
    const a = (i / 5) * 1.45, x = Math.sin(a) * rx, z = G.headZ + Math.cos(a) * rz;
    P.add('head', { ...box(x, y0, z, 1.2, 0.55, 0.5, silver), rot: [0, (a * 180) / Math.PI, 0] });
  }
  const spikes: [number, number, number][] = [[0, 4.6, 0.95], [0.2, 2.9, 0.7], [-0.2, 2.9, 0.7], [0.42, 3.4, 0.75], [-0.42, 3.4, 0.75], [0.66, 2.1, 0.6], [-0.66, 2.1, 0.6], [0.9, 2.6, 0.62], [-0.9, 2.6, 0.62], [1.15, 1.5, 0.5], [-1.15, 1.5, 0.5]];
  for (const [a, h, w] of spikes) {
    const x = Math.sin(a) * rx, z = G.headZ + Math.cos(a) * rz, tilt = -x * 3.5;
    P.add('head', lean(box(x, y0 + 0.35, z, w, h * 0.72, w * 0.7, cr), -6, 0, tilt));
    P.add('head', lean(box(x, y0 + 0.35 + h * 0.6, z, w * 0.6, h * 0.42, w * 0.45, core, { glow: true }), -6, 0, tilt));
    P.add('head', lean(box(x, y0 + 0.35 + h * 0.95, z, w * 0.3, h * 0.2, w * 0.3, glint, { glow: true }), -6, 0, tilt));
  }
  P.add('head', box(0, y0 + 0.4, G.headZ + rz + 0.45, 1.1, 1.3, 0.5, lamp('#6fd0ff'), { glow: true }));
}, { noStore: true });

// ------------------------------------------------------------------ face

function ring(P: OwlParts, cx: number, cy: number, z: number, size: number, th: number, m: Painter, bone: BoneName = 'head') {
  const h = size / 2;
  P.add(bone, box(cx, cy + h - th, z, size, th, 0.6, m), box(cx, cy - h, z, size, th, 0.6, m), box(cx - h + th / 2, cy - h, z, th, size, 0.6, m), box(cx + h - th / 2, cy - h, z, th, size, 0.6, m));
}
def('glasses', 'face', 'Reading Glasses', 180, 'For bedtime stories and very small print.', (P) => {
  const m = metal('#c99a3a'), s = G.eyeS + 1.3, z = fz(P) + 0.85;
  for (const sd of [-1, 1]) ring(P, sd * G.eyeX, G.eyeY, z, s, 0.5, m);
  P.add('head', box(0, G.eyeY + 0.6, z, Math.max(0.8, G.eyeX * 2 - s), 0.5, 0.6, m));
  for (const sd of [-1, 1]) P.add('head', box(sd * (G.eyeX + s / 2 + 0.2), G.eyeY + 0.8, z - 2.5, 0.5, 0.5, 5, m));
});
def('sleepmask', 'face', 'Sleepy Mask', 120, 'Worn on the forehead, ready for lights-out.', (P) => {
  const m = cloth('#9a7fd6', { trim: '#f5d36b', hem: 0.6 }), k = flatLash();
  const y = Math.min(G.eyeY + G.eyeS * 0.62, headTop - 3.6), z = fz(P) + 1.2;
  P.add('head', box(0, y, z - 0.3, Math.min(14.2, G.headW - 1.2), 3.0, 0.9, m));
  for (const sd of [-1, 1]) P.add('head', box(sd * 3.4, y + 1.0, z + 0.2, 3.2, 0.5, 0.2, k), box(sd * 3.4 - sd * 1.3, y + 0.6, z + 0.2, 0.5, 0.5, 0.2, k), box(sd * 3.4 + sd * 1.3, y + 0.6, z + 0.2, 0.5, 0.5, 0.2, k));
  for (const sd of [-1, 1]) P.add('head', box(sd * (G.headW / 2 + 0.1), y + 0.2, G.headZ + 0.6, 0.6, 1.2, G.headD - 1, cloth('#7d63bd')));
});
function flatLash(): Painter { const r = ramp(0x2a1d33); return (t) => tone(r, t.face === 2 ? 1 : 0); }
def('monocle', 'face', 'Gentlebird Monocle', 260, 'Distinguished. Slightly smug.', (P) => {
  const m = metal(GOLD), s = G.eyeS + 1.4;
  ring(P, G.eyeX, G.eyeY, fz(P) + 0.85, s, 0.55, m);
  P.add('head', box(G.eyeX + s / 2 - 0.2, G.eyeY - s / 2 - 3.4, fz(P) + 0.8, 0.4, 3.6, 0.4, m));
});
def('stargoggles', 'face', 'Star Goggles', 70, 'Pushed up, ready for meteor showers.', (P) => {
  const m = metal('#8a93a8'), g = lamp('#9fe7ff');
  const y = Math.min(G.eyeY + G.eyeS * 0.55, headTop - 3.4), z = fz(P) + 0.9;
  for (const sd of [-1, 1]) P.add('head', box(sd * 3.2, y, z - 0.3, 4.4, 3, 1.4, m), box(sd * 3.2, y + 0.5, z + 0.45, 3.0, 2, 0.2, g, { glow: true }));
  P.add('head', box(0, y + 0.4, G.headZ, G.headW + 0.6, 1.4, G.headD + 0.6, cloth('#3c4256'), { skip: 'ud' }));
}, { premium: true });

// ------------------------------------------------------------------ neck

def('scarf', 'neck', 'Cosy Scarf', 150, 'Knitted in the colours of autumn leaves.', (P) => {
  const m = knit('#d9573b', { stripe: '#f2c35a', every: 4 }), y = neckY() - 1.4, a = at(y - 4);
  P.add('body', band(y, 2.6, 0.9, m));
  P.add('body', { ...box(G.bodyW * 0.22, y - 5.6, a.front + 0.5, 2.8, 5.6, 1.1, m), rot: [8, 0, 6] }, box(G.bodyW * 0.25, y - 6.4, a.front + 0.8, 3, 0.9, 1, fluff('#f2c35a')));
});
def('bowtie', 'neck', 'Velvet Bowtie', 110, 'For formal hoots.', (P) => {
  const m = cloth('#7a2f5a'), y = neckY() - 1.6, z = at(y).front + 0.7;
  P.add('body', box(0, y, z, 1.4, 1.4, 1, m), { ...box(-1.9, y - 0.3, z - 0.1, 2.6, 2, 0.8, m), rot: [0, 0, -10] }, { ...box(1.9, y - 0.3, z - 0.1, 2.6, 2, 0.8, m), rot: [0, 0, 10] });
});
def('bandana', 'neck', 'Trail Bandana', 130, 'Every adventurer needs one.', (P) => {
  const m = motif('#3f7fc4', '#ffffff', 2), y = neckY() - 1.2, z = at(y - 3).front + 0.5;
  P.add('body', band(y, 1.6, 0.7, m));
  P.add('body', box(0, y - 1.8, z, 6, 1.8, 0.8, m), box(0, y - 3.2, z, 3.4, 1.4, 0.8, m), box(0, y - 4.2, z, 1.2, 1, 0.8, m));
}, { area: 'woods' });
def('bell', 'neck', 'Silver Bell', 200, 'Jingles softly when Pip hops.', (P) => {
  const y = neckY() - 1.0, z = at(y - 2).front + 0.9;
  P.add('body', band(y, 1, 0.5, cloth('#3f8a7a'), { skip: 'ud' }));
  P.add('body', box(0, y - 2.2, z, 2.4, 2.2, 2, metal('#d8dde8')), box(0, y - 2.4, z + 1.05, 0.6, 0.6, 0.2, solid('#2a2f3a')));
});
def('moonpendant', 'neck', 'Moonstone Pendant', 80, 'Glows faintly, like a nightlight you can wear.', (P) => {
  const y = neckY() - 1.0, z = at(y - 3).front + 0.4;
  P.add('body', band(y, 0.6, 0.45, metal(GOLD), { skip: 'ud' }));
  P.add('body', box(0, y - 2.8, z, 2.4, 2.8, 0.8, lamp('#bfe9ff'), { glow: true }), box(0, y - 0.4, z - 0.1, 0.6, 1.2, 0.6, metal(GOLD)));
}, { premium: true });
def('candy_scarf', 'neck', 'Candy Cane Scarf', 0, 'Peppermint stripes, wound twice and still too long.', (P) => {
  const r = R('#d8222e'), w = R('#fff8f0');
  const m: Painter = (t) => {
    const across = t.face === 0 || t.face === 1 ? t.z : t.x;
    const k = Math.floor((across + t.y * 1.1 + 40) / 1.2) % 2;
    const L = lvl(t, { noise: 0.2, speck: 0, rim: 0.6 }) * 0.8 + ((Math.floor(t.y * 1.5) % 2) ? -0.2 : 0.2);
    return tone(k ? w : r, L + fineJ(t));
  };
  const y = neckY() - 1.6, a = at(y - 4);
  P.add('body', band(y, 2.8, 1.0, m), band(y + 1.6, 1.4, 1.3, m));
  P.add('body', { ...box(-G.bodyW * 0.2, y - 6.4, a.front + 0.6, 2.6, 6.4, 1.0, m), rot: [6, 0, -5] });
  for (const k of [-1, 0, 1]) P.add('body', box(-G.bodyW * 0.2 + k * 0.8 - 0.5, y - 7.6, a.front + 0.95, 0.4, 1.2, 0.4, fluff('#fff8f0')));
}, { series: 'frostlight', noStore: true });

// ------------------------------------------------------------------ body

/** A shell of fabric hugging the body's tiers, leaving the wings outside. */
function torso(P: OwlParts, m: Painter, top = 1.4) {
  const tiers: [number, number][] = [[0.08, 0.2], [0.2, 0.45], [0.45, 0.62], [0.62, 0.78], [0.78, 0.9]];
  const limit = G.bodyY + G.bodyH - top;
  for (const [h0, h1] of tiers) {
    const y0 = G.bodyY + h0 * G.bodyH, y1 = Math.min(limit, G.bodyY + h1 * G.bodyH);
    if (y1 <= y0 + 0.2) continue;
    P.add('body', { ...band(y0, y1 - y0, 0.45, m, { tag: 'torso' }) });
  }
  P.add('body', band(Math.min(limit, G.bodyY + 0.9 * G.bodyH) - 0.6, 0.8, 0.2, m, { tag: 'torso' }));
}
const front = (base: Painter, f: (x: number, y: number) => number | null): Painter => (t) => {
  if (t.tag === 'torso' && t.face === 4) { const c = f(t.x, t.y); if (c !== null) return c; }
  return base(t);
};
const chestY = () => G.bodyY + G.bodyH * 0.62;

def('sweater', 'body', 'Moon Sweater', 320, 'Chunky knit with a crescent moon on the front.', (P) => {
  const gold = ramp(col('#f6d36a')), cy = chestY();
  torso(P, front(knit('#3d5aa0'), (x, y) => {
    const d1 = Math.hypot(x - 0.2, y - cy), d2 = Math.hypot(x - 1.6, y - cy - 0.8);
    return d1 < 2.6 && d2 > 2.3 ? tone(gold, 0.5 + (y > cy + 0.4 ? 0.6 : 0)) : null;
  }));
  P.add('body', band(G.bodyY + G.bodyH * 0.08, 1.2, 0.7, knit('#2b4280'), { skip: 'u' }));
});
def('pajamas', 'body', 'Striped Pajamas', 260, 'Soft flannel, perfect for the long night ahead.', (P) => {
  const b = ramp(col('#fff4dc'));
  torso(P, front(cloth('#7fb6e8', { stripe: '#e9f3ff', stripeEvery: 2 }), (x, y) => (Math.abs(x) < 0.45 && Math.floor(y) % 3 === 0 ? tone(b, 1) : null)));
  P.add('body', band(neckY() - 1.4, 1, 0.8, cloth('#4f86c4'), { skip: 'ud' }));
});
def('raincoat', 'body', 'Puddle Raincoat', 340, 'Glossy yellow, for drizzly adventures.', (P) => {
  const k = ramp(col('#3a2d1a'));
  torso(P, front(smooth('#f6c534', { rim: 1.4 }), (x, y) => (Math.abs(x) < 0.4 && Math.floor(y) % 3 === 0 ? tone(k, 0) : null)));
  P.add('body', box(0, neckY() - 2.4, at(neckY() - 2).back - 0.8, G.bodyW - 2, 3.6, 2.2, smooth('#e3b22a')));
}, { area: 'lake' });
def('cardigan', 'body', 'Grandma Cardigan', 280, 'Has a pocket. The pocket has a biscuit.', (P) => {
  const btn = ramp(col('#f3e2c0'));
  torso(P, front(knit('#c98b5a'), (x, y) => {
    if (Math.abs(x) < 0.35) return tone(btn, -2);
    if (Math.abs(x - 1.1) < 0.35 && Math.floor(y * 0.8) % 3 === 0) return tone(btn, 0.6);
    return null;
  }));
});
def('royalcape', 'body', 'Royal Cape', 180, 'Velvet and ermine, for the ruler of Hoot Hollow.', (P) => {
  const m = cloth('#8a1f3c', { trim: '#fbf6ee', hem: 1.4 }), y = neckY();
  P.add('body', band(y - 3.0, 3.0, 1.6, m, { skip: 'd' }), box(0, G.bodyY - 0.6, at(G.bodyY + 4).back - 1.4, G.bodyW + 4.6, y - G.bodyY - 2.4, 1.2, m));
  P.add('body', band(y - 0.4, 1.8, 1.4, motif('#fbf6ee', '#1b1b22', 1.6)));
}, { premium: true });
def('cloudcloak', 'body', 'Cloud Cloak', 220, 'Woven from the softest cloud over Starfall Peak.', (P) => {
  const f = fluff('#f4f6ff'), s = G.bodyW / 13, y0 = G.bodyY - 3;
  for (const [x, y, z, sz] of [[-6, 11.5, 0, 4.4], [6, 11.5, 0, 4.4], [-3.4, 12.6, -3, 4], [3.4, 12.6, -3, 4], [0, 12, -4.4, 4.6], [-6.4, 8.6, -2, 3.6], [6.4, 8.6, -2, 3.6], [0, 8, -6, 4.2], [-3.6, 5, -6, 3.6], [3.6, 5, -6, 3.6]] as const) P.add('body', box(x * s, y0 + y * G.bodyH / 11, z * s, sz, sz * 0.8, sz, f));
}, { premium: true, area: 'peak' });
def('holiday_sweater', 'body', 'Frostlight Jumper', 0, 'The festive jumper: snowflakes, zigzags and one very proud reindeer.', (P) => {
  const red = R('#c42430'), white = R('#fbf5ea'), green = R('#2f7a46');
  const m: Painter = (t) => {
    const across = t.face === 0 || t.face === 1 ? t.z * 1.3 : t.x;
    const sx = Math.floor(across * 1.5), sy = Math.floor(t.y * 1.5);
    const v = t.y * 1.5 - sy, u = across * 1.5 - sx;
    let L = lvl(t, { noise: 0.15, speck: 0, rim: 0.5, grad: 0.5 }) * 0.8 + (Math.abs(u - 0.5) * 2 > 0.75 - v * 0.5 ? -0.7 : 0.3);
    if (t.face === 2 || t.face === 3) L = lvl(t, { noise: 0.2 }) * 0.6;
    const yy = sy - Math.floor((G.bodyY + G.bodyH * 0.5) * 1.5);
    // a white zigzag band above a green band, snowflakes scattered over red
    if (yy === 4 || yy === 5) return tone(green, L);
    if (yy >= 6 && yy <= 7 && Math.abs(((sx % 4) + 4) % 4 - 1.5) <= (yy - 6) + 0.5) return tone(white, L);
    if (yy === -4) return tone(white, L);
    const cx = ((sx % 6) + 6) % 6, cyy = ((yy % 6) + 6) % 6;
    if (yy < -5 || yy > 8) { if ((cx === 3 && cyy >= 2 && cyy <= 4) || (cyy === 3 && cx >= 2 && cx <= 4)) return tone(white, L); }
    if (yy > -4 && yy < 4 && Math.abs(sx) <= 0 && t.face === 4) return tone(white, L);
    return tone(red, L);
  };
  torso(P, m, 1.2);
  const cy = chestY(), z = at(cy).front + 0.5;
  // a little stitched reindeer face on the front
  const brown = smooth('#8a5a34'), nose = lamp('#ff3a3a');
  P.add('body', box(0, cy - 1.4, z, 3, 2.6, 0.3, brown), box(0, cy - 1.6, z + 0.2, 1, 1, 0.3, nose, { glow: true }));
  for (const sd of [-1, 1]) P.add('body', lean(box(sd * 1.6, cy + 1.0, z, 0.5, 1.8, 0.3, smooth('#d9b98a')), 0, 0, -sd * 30));
  P.add('body', band(G.bodyY + G.bodyH * 0.08, 1.2, 0.7, knit('#2f7a46'), { skip: 'u' }), band(neckY() - 1.6, 1.0, 0.75, knit('#fbf5ea')));
}, { series: 'frostlight', noStore: true });

// ------------------------------------------------------------------ back

def('satchel', 'back', 'Explorer Satchel', 0, 'Pip packs it before every night adventure.', (P) => {
  const strap = cloth('#6b4426'), bag = (() => { const r = R('#9a6235'); return (t: Texel) => tone(r, lvl(t, { noise: 0.4, scale: 1.5 }) * 0.8 + (t.by > t.sy - 1.3 && t.face === 0 ? 0.8 : 0)); })();
  const y = G.bodyY + G.bodyH * 0.35, x = at(y).hw + 2.6;
  P.add('body', { ...box(0, G.bodyY + G.bodyH * 0.35, 0.4, 1.2, G.bodyH * 0.95, at(y + 3).front - at(y + 3).back + 1.8, strap, { skip: 'ud' }), rot: [0, 0, 34] });
  P.add('body', box(x, y - 2, 2.2, 2.4, 4.2, 4.6, bag), box(x + 1.3, y + 0.5, 2.2, 0.4, 1.6, 4.8, strap), box(x + 1.55, y + 0.4, 2.2, 0.3, 0.8, 0.9, metal(GOLD)));
});
def('backpack', 'back', 'Trail Backpack', 300, 'Room for snacks, maps and one emergency acorn.', (P) => {
  const m = cloth('#4f8a52', { trim: '#2f5a34', hem: 1 }), y = G.bodyY + G.bodyH * 0.25, bz = at(y + 4).back - 2.4;
  P.add('body', box(0, y, bz, 9, 8, 3.6, m), box(0, y + 4.8, bz - 0.4, 9.4, 2.4, 4, cloth('#3d6d40')), box(0, y + 1.4, bz - 2, 5, 3, 0.8, cloth('#3d6d40')));
  for (const sd of [-1, 1]) P.add('body', box(sd * 3, y + 1, 0.4, 1, 7.6, at(y + 5).front - at(y + 5).back + 1.6, cloth('#2f5a34'), { skip: 'ud' }));
});
def('lantern', 'back', 'Firefly Lantern', 420, 'A jar of friendly fireflies that light the way home.', (P) => {
  const frame = metal('#5b6170'), glass = lamp('#ffe28a'), bz = at(G.bodyY + 6).back;
  P.add('body', box(0, G.bodyY + 5, bz - 0.8, 1, 6, 1, solid('#6b4426')), box(0, G.bodyY + 10.6, bz - 1.6, 1, 1, 2.6, solid('#6b4426')));
  P.add('body', box(0, G.bodyY + 11.2, bz - 3, 3.4, 0.6, 3.4, frame), box(0, G.bodyY + 7.8, bz - 3, 3, 3.4, 3, glass, { glow: true }), box(0, G.bodyY + 7.4, bz - 3, 3.4, 0.5, 3.4, frame));
}, { area: 'grotto' });
def('fairywings', 'back', 'Moth Fairy Wings', 250, 'Dusted with moonlight. They flutter when Pip is happy.', (P) => {
  const w = (() => {
    const r = R('#c8b6ff'), e = R('#7a5fd6');
    return (t: Texel) => {
      const ring2 = Math.hypot(t.bx - t.sx / 2, t.by - t.sy / 2) / (Math.min(t.sx, t.sy) / 2);
      return ring2 > 0.8 ? tone(e, 0.4) : tone(r, 1 + (ring2 < 0.3 ? 1.5 : 0) - ring2);
    };
  })();
  const bz = at(G.bodyY + 8).back - 1.4, y = G.bodyY + G.bodyH * 0.3;
  for (const sd of [-1, 1]) {
    P.add('body', { ...box(sd * 5.6, y + 2, bz, 8, 9, 0.5, w, { glow: true }), rot: [0, sd * 24, sd * 18] });
    P.add('body', { ...box(sd * 4.4, y - 1.6, bz, 5, 5, 0.5, w, { glow: true }), rot: [0, sd * 24, -sd * 22] });
  }
}, { premium: true });

/** A cape hanging from the shoulders down the back, with a collar, clasp and hem. */
function cape(P: OwlParts, cloth2: Painter, trim: Painter, clasp: Painter, o: { furCollar?: boolean } = {}) {
  const y = neckY(), a = at(y - 1), bottom = G.bodyY - 0.2;
  const wide = at(G.bodyY + G.bodyH * 0.4).hw + 2.3;
  // a collar round the shoulders; the cape hangs from it in one drape behind the folded wings,
  // flaring gently toward a trimmed hem; its front edges fall past the wings either side
  P.add('body', band(y - 1.6, o.furCollar ? 2.6 : 1.6, o.furCollar ? 1.4 : 0.9, o.furCollar ? trim : cloth2));
  const top = y - 1.2, rows = 3, back0 = at(top - 1).back - 1.4, drape = 1.4 + G.shape.wingBack * 0.45;
  for (let i = 0; i < rows; i++) {
    const y0 = bottom + ((top - bottom) * i) / rows, h = (top - bottom) / rows + 0.02, k = 1 - (i + 0.5) / rows;
    const back = Math.min(back0, at(y0 + h / 2).back - drape) - k * 0.8;
    P.add('body', box(0, y0, back, wide * 2 + k * 1.6, h, 0.7, cloth2, { skip: 's' }));
    // the cape's edges curl forward round the folded wings
    for (const sd of [-1, 1]) P.add('body', box(sd * (wide + k * 0.8 - 0.2), y0, back + 0.9, 0.6, h, 1.4, cloth2));
  }
  P.add('body', box(0, bottom - 0.6, Math.min(back0, at(bottom + 2).back - drape) - 0.8, wide * 2 + 2.4, 1.0, 1.0, trim));
  P.add('body', box(0, y - 2.9, a.front + 1.1, 1.8, 1.8, 0.6, clasp, { glow: true }));
}
def('moon_cape', 'back', 'Moonlit Cape', 0, 'Midnight blue, sewn with silver stars and clasped with a crescent moon.', (P) => {
  cape(P, motif('#1e2160', '#e8ecff', 2.2, true), metal('#e7c35a'), lamp('#fff0b0'));
}, { series: 'starfall', noStore: true });
def('frost_cape', 'back', 'Frost Cape', 0, 'Snowflakes embroidered in silver thread, trimmed with the softest white fur.', (P) => {
  const base = ramp(col('#8fc4ee'), { step: 0.05, cool: 250, shift: 0.03 }), thread = ramp(col('#f4fbff'), { step: 0.03 });
  const flake: Painter = (t) => {
    const across = t.face === 0 || t.face === 1 ? t.z : t.x;
    // folds running down the drape, then six-armed snowflakes on a staggered grid
    let L = (t.face === 2 ? 0.8 : t.face === 3 ? -1 : 0.1) + Math.sin(across * 1.7) * 0.45 + (t.y - G.bodyY) / G.bodyH * 0.5 + fineJ(t);
    const gx = Math.round(across / 3.4), oy0 = t.y + (gx & 1) * 1.7, gy = Math.round(oy0 / 3.4);
    const ox = across - gx * 3.4, oy = oy0 - gy * 3.4;
    const r = Math.hypot(ox, oy), a = Math.atan2(oy, ox);
    const k6 = ((a / (Math.PI / 3)) % 1 + 1) % 1, arm = Math.min(k6, 1 - k6) * r;
    if (r < 1.3 && arm < 0.13) return tone(thread, 0.5);
    if (r > 0.6 && r < 0.95 && Math.abs(Math.min(k6, 1 - k6) * 0.95 - 0.12) < 0.06) return tone(thread, 0.2);
    if (r < 0.22) return tone(thread, 0.7);
    if (hash(Math.floor(t.x * 4), Math.floor(t.y * 4), Math.floor(t.z * 4), 8) > 0.985) return tone(thread, 1);
    return tone(base, L);
  };
  cape(P, flake, fluff('#ffffff'), lamp('#bfeaff'), { furCollar: true });
  // a snowflake brooch at the throat
  const y = neckY() - 2.4, z = at(y).front + 1.4, br = lamp('#e9f8ff');
  for (const ang of [0, 60, 120]) P.add('body', { ...box(0, y - 1.0, z, 0.35, 2.0, 0.3, br, { glow: true }), rot: [0, 0, ang], pivot: [0, y, z] });
}, { noStore: true });

for (const p of PIECES) PIECE[p.id] = p;

/** Apply an outfit (slot -> piece id) to the owl's parts. */
export function dressOwl(P: OwlParts, outfit: Partial<Record<OutfitSlot, string>>) {
  G = P.g;
  headTop = P.g.headTop;
  for (const id of Object.values(outfit)) {
    const p = id ? PIECE[id] : undefined;
    if (p) p.make(P);
  }
}

/** Something held under the wing (Queen Neve's scepter). */
export function holdItem(P: OwlParts, id: string) {
  G = P.g;
  if (id === 'scepter') {
    const silver = metal('#c4d8f2'), cr = ice('#9fd8ff');
    const y = G.bodyY + G.bodyH * 0.45, x = at(y).hw + 2.0, z = at(y).front - 1.2;
    const len = G.bodyH * 0.8, y0 = G.bodyY + 0.6;
    P.add('wingR', lean(box(x, y0, z, 0.55, len, 0.55, silver), 14, 0, -8));
    const tipY = y0 + len * 0.96, tx = x - Math.sin((8 * Math.PI) / 180) * len, tz = z + Math.sin((14 * Math.PI) / 180) * len;
    P.add('wingR', box(tx, tipY, tz, 1.6, 0.5, 1.6, silver), box(tx, tipY + 0.4, tz, 1.3, 2.6, 1.3, cr, { glow: true }), box(tx, tipY + 1.1, tz, 2.4, 1.0, 0.6, cr), box(tx, tipY + 3.0, tz, 0.6, 1.0, 0.6, cr, { glow: true }));
  }
}

export const SLOT_ORDER: OutfitSlot[] = ['head', 'face', 'neck', 'body', 'back'];
export const SLOT_NAME: Record<OutfitSlot, string> = { head: 'Hats', face: 'Face', neck: 'Neck', body: 'Clothes', back: 'Back' };
export { mix };

// ====================================================================== the toy outfit pieces (Blender, GLB)
// Each remade piece is a small hand-painted faceted accessory (art/blender/owls/outfits.py) in
// public/models/outfits/<id>.glb, modelled round its anchor on a tawny; every owl carries the anchors
// (anchor_head, anchor_face, anchor_neck, anchor_chest, anchor_back), scaled to its own size, so one piece fits
// a little owl and a great grey alike. Pieces not remade yet are simply not shown.

export interface PieceModel {
  /** the anchor it hangs on */
  anchor: AnchorName;
  /** a hat that sits where ear tufts would be: the tufts fold away under it */
  hidesTufts?: boolean;
}
/** The pieces that exist as toy GLBs (src/owl/outfits.gen.ts). */
export const PIECE_MODELS: Record<string, PieceModel> = { ...PIECE_MODEL_LIST };
const SLOT_ANCHOR: Record<OutfitSlot, AnchorName> = { head: 'anchor_head', face: 'anchor_face', neck: 'anchor_neck', body: 'anchor_chest', back: 'anchor_back' };
export const pieceAnchor = (id: string): AnchorName | undefined => PIECE_MODELS[id]?.anchor ?? (PIECE[id] ? SLOT_ANCHOR[PIECE[id].slot] : undefined);
export const piecePath = (id: string) => `outfits/${id}.glb`;
/** Is this piece wearable on the toy owls yet? */
export const hasPieceModel = (id: string) => !!PIECE_MODELS[id];

export interface Dressing { ready: Promise<void>; dispose(): void }

type Loaded = { scene: THREE.Object3D };
const loadedPieces = new Map<string, Loaded>();
const loadingPieces = new Map<string, Promise<Loaded | null>>();
function fetchPiece(id: string): Promise<Loaded | null> {
  let p = loadingPieces.get(id);
  if (!p) {
    p = loadGLB(piecePath(id)).then((g) => { loadedPieces.set(id, g); return g; }, () => null);
    loadingPieces.set(id, p);
  }
  return p;
}
const wornIds = (look: OwlLook) => SLOT_ORDER.map((s) => look.outfit?.[s]).filter((id): id is string => !!id && !!PIECE_MODELS[id]);
/** Resolves when every remade piece of this look's outfit has loaded. */
export const piecesReady = (look: OwlLook) => Promise.all(wornIds(look).map(fetchPiece)).then(() => undefined);
/** Are this look's remade pieces all loaded already? */
export const piecesLoaded = (look: OwlLook) => wornIds(look).every((id) => loadedPieces.has(id));

/** Put a look's outfit on a loaded owl model: each piece that exists as a GLB hangs on its anchor. */
export function dressModel(model: OwlModel, look: OwlLook): Dressing {
  const added: THREE.Object3D[] = [];
  let dead = false;
  const jobs: Promise<void>[] = [];
  let hideTufts = false;
  for (const slot of SLOT_ORDER) {
    const id = look.outfit?.[slot];
    if (!id) continue;
    if (model.id === 'queen' && (id === 'ice_crown' || id === 'frost_cape')) continue; // (part of her own model)
    const pm = PIECE_MODELS[id];
    if (!pm) continue;
    if (pm.hidesTufts) hideTufts = true;
    const anchor = model.anchors[pm.anchor];
    if (!anchor) continue;
    const put = (g: Loaded | null) => {
      if (dead || !g) return;
      const root = cloneSkinned(g.scene);
      root.name = 'piece:' + id;
      anchor.add(root);
      added.push(root);
    };
    const have = loadedPieces.get(id);
    if (have) put(have);
    else jobs.push(fetchPiece(id).then(put));
  }
  if (hideTufts && model.id !== 'snowman') { model.rig.bones.tuftL.visible = false; model.rig.bones.tuftR.visible = false; }
  return {
    ready: Promise.all(jobs).then(() => undefined),
    dispose() { dead = true; for (const o of added) o.removeFromParent(); },
  };
}

/** A piece on its own (shop stands, icons): the GLB at the tawny's size, in toy millimetres; null when not remade yet. */
export async function pieceModel(id: string): Promise<THREE.Object3D | null> {
  if (!PIECE_MODELS[id]) return null;
  try { return (await instanceGLB(piecePath(id))).root; } catch { return null; }
}
