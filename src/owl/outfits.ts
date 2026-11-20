// The owl's wardrobe. Every piece is real geometry layered onto the owl's bones (caps, brims,
// scarves, capes, satchels), painted in the same pixel style as the feathers so outfits look
// modelled, not pasted on.
import { box, type BoxSpec, type Painter, type Texel } from '../gfx/box.ts';
import { col, ramp, tone } from '../gfx/color.ts';
import { cloth, lamp, leaves, lvl, metal, R, smooth, solid, type Tint } from '../gfx/mats.ts';
import { hash } from '../gfx/noise.ts';
import type { BoneName, OutfitSlot, OwlParts } from './model.ts';

// geometry constants are duplicated here (not imported) to avoid a circular import at load time
const G = { bodyY: 3, bodyH: 11, bodyW: 13, bodyD: 11, headY: 12.4, headH: 12.8, headW: 16.4, headD: 12.6, headZ: 0.2, headTop: 25.2, faceFront: 6.6, eyeX: 3.95, eyeY: 19.5, neckY: 13.4 };

export interface PieceDef {
  id: string;
  slot: OutfitSlot;
  name: string;
  blurb: string;
  /** acorns, or moonstones when premium */
  price: number;
  premium?: boolean;
  /** found only on adventures in this area */
  area?: string;
  make(P: OwlParts): void;
}

export const PIECES: PieceDef[] = [];
const def = (id: string, slot: OutfitSlot, name: string, price: number, blurb: string, make: PieceDef['make'], o: { premium?: boolean; area?: string } = {}) => {
  PIECES.push({ id, slot, name, price, blurb, make, ...o });
};
export const PIECE: Record<string, PieceDef> = {};

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

/** A white fluffy trim (pompoms, cuffs, cloud puffs). */
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
    const ox = across - gx * every - (gy & 1 ? every / 2 : 0) * 0, oy = t.y - gy * every;
    const L = lvl(t, { noise: 0.25, speck: 0.2, rim: 0.5 }) * 0.8 + fineJ(t);
    const hit = starry ? (Math.abs(ox) < 0.2 && Math.abs(oy) < 0.55) || (Math.abs(oy) < 0.2 && Math.abs(ox) < 0.55) : Math.hypot(ox, oy) < 0.42;
    if (hit && hash(gx, gy, t.face, 5) > (starry ? 0.35 : 0.1)) return tone(d, 1);
    return tone(r, L);
  };
};

const GOLD = '#f2b632';
const headTop = G.headY + G.headH;

// ------------------------------------------------------------------ head

def('nightcap', 'head', 'Starry Nightcap', 0, 'The classic. Comes with a pompom that bobs when Pip nods off.', (P) => {
  const m = cloth('#4a5fb0', { stripe: '#f3e9cf', stripeEvery: 3 }), f = fluff();
  P.tufts = false;
  P.add('head', box(0, headTop - 1.4, G.headZ, G.headW + 1, 2.2, G.headD + 1, f, { tag: 'brim' }));
  const steps: [number, number, number, number, number][] = [[0, headTop + 0.6, 13.6, 2.8, 11.6], [1, headTop + 3.2, 10.6, 2.6, 9], [2.6, headTop + 5.4, 7.8, 2.2, 6.8], [4.8, headTop + 6.9, 5.4, 1.8, 5], [7, headTop + 6.8, 3.6, 1.8, 3.6], [8.6, headTop + 5.4, 2.8, 1.9, 2.8]];
  for (const [x, y, w, h, d] of steps) P.add('head', box(x, y, G.headZ - 0.4 - x * 0.06, w, h, d, m));
  P.add('head', box(9.2, headTop + 2.4, -0.4, 3.4, 3.2, 3.4, f, { tag: 'pom' }));
});
def('beanie', 'head', 'Mossy Beanie', 220, 'Hand-knit by a very patient hedgehog.', (P) => {
  P.tufts = false;
  const m = knit('#5f9a52'), rib = knit('#e9d9b2');
  P.add('head', box(0, headTop - 1.6, G.headZ, G.headW + 1, 2.4, G.headD + 1, rib));
  P.add('head', box(0, headTop + 0.6, G.headZ - 0.2, G.headW - 0.6, 2.2, G.headD - 0.6, m), box(0, headTop + 2.6, G.headZ - 0.3, G.headW - 4, 1.6, G.headD - 3.6, m));
  P.add('head', box(0, headTop + 4, G.headZ - 0.3, 3.6, 3.2, 3.6, fluff('#f3e2bd'), { tag: 'pom' }));
});
def('explorer', 'head', 'Explorer Helmet', 380, 'For mapping mushroom caves and moonlit marshes.', (P) => {
  P.tufts = false;
  const m = smooth('#e4cf9a'), band = cloth('#7a4a2b');
  P.add('head', box(0, headTop - 0.8, G.headZ + 0.4, G.headW + 5, 0.9, G.headD + 5, m));
  P.add('head', box(0, headTop - 0.2, G.headZ, G.headW - 1, 3, G.headD - 1, m), box(0, headTop + 2.6, G.headZ, G.headW - 4, 1.6, G.headD - 4, m), box(0, headTop + 4, G.headZ, 2, 0.8, 2, metal(GOLD)));
  P.add('head', box(0, headTop - 0.1, G.headZ, G.headW - 0.6, 1.1, G.headD - 0.6, band, { skip: 'ud' }));
}, { area: 'woods' });
def('wizard', 'head', 'Stargazer Hat', 90, 'Every sparkle is a wish someone made while falling asleep.', (P) => {
  P.tufts = false;
  const m = motif('#2b2f7a', '#ffd84a', 2.4, true);
  P.add('head', box(0, headTop - 0.8, G.headZ, G.headW + 6, 0.9, G.headD + 6, m));
  const steps: [number, number, number, number][] = [[headTop, 13, 3, 0], [headTop + 3, 10, 3, -0.8], [headTop + 6, 7, 2.6, -1.8], [headTop + 8.6, 4.4, 2.2, -3], [headTop + 10.6, 2.4, 1.8, -4.4]];
  for (const [y, w, h, z] of steps) P.add('head', box(0, y, G.headZ + z, w, h, w, m));
  P.add('head', box(0, headTop + 12.2, G.headZ - 5.4, 1.6, 1.6, 1.6, lamp('#ffe27a'), { glow: true }));
}, { premium: true });
def('flowercrown', 'head', 'Daisy Crown', 160, 'Picked at dawn from the edge of Whispering Woods.', (P) => {
  const leaf = leaves('#5aa047', { seed: 4 });
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = Math.sin(a) * 7.4, z = G.headZ + Math.cos(a) * 6.2;
    P.add('head', box(x, headTop - 0.7, z, 1.6, 1.1, 1.6, leaf));
    if (i % 2 === 0) {
      const petal = i % 4 === 0 ? smooth('#fffaf0') : smooth('#ffd1e0');
      P.add('head', box(x, headTop + 0.3, z, 2.2, 0.8, 2.2, petal), box(x, headTop + 0.9, z, 1, 0.6, 1, smooth('#ffc93a')));
    }
  }
});
def('crown', 'head', 'Moon Crown', 160, 'Forged from the first light of a crescent moon.', (P) => {
  const g = metal(GOLD);
  P.add('head', box(0, headTop - 0.3, G.headZ, 9, 1.8, 7.6, g, { skip: 'ud' }));
  for (const [x, z] of [[-3.8, 0], [3.8, 0], [0, 3.4], [0, -3.4], [-2.8, 2.6], [2.8, 2.6], [-2.8, -2.6], [2.8, -2.6]]) P.add('head', box(x, headTop + 1.4, G.headZ + z, 1.1, 1.6, 1.1, g));
  P.add('head', box(0, headTop + 1.2, G.headZ + 3.9, 1.6, 1.6, 0.8, lamp('#8fe3ff'), { glow: true }));
}, { premium: true });
def('beret', 'head', 'Painter Beret', 260, 'Tilted just so. Artistic sighs not included.', (P) => {
  const m = cloth('#c2423f');
  P.add('head', { ...box(1.4, headTop - 0.4, G.headZ, G.headW - 1, 1.8, G.headD - 0.4, m), rot: [0, 0, -8] }, { ...box(1.8, headTop + 1.2, G.headZ, G.headW - 4, 1, G.headD - 3, m), rot: [0, 0, -8] }, box(0.5, headTop + 2.2, G.headZ, 0.8, 1, 0.8, m));
});
def('acorn', 'head', 'Acorn Cap', 140, 'Borrowed from a very large acorn. It said yes.', (P) => {
  const cup = (() => { const r = R('#8a5a32'); return (t: Texel) => tone(r, lvl(t, { noise: 0.2 }) * 0.7 + ((Math.floor(t.x * 1.5) + Math.floor(t.y * 1.5) + Math.floor(t.z * 1.5)) % 2 ? -0.7 : 0.5)); })();
  P.add('head', box(0, headTop - 1.2, G.headZ, G.headW + 1.2, 2.6, G.headD + 1.2, cup), box(0, headTop + 1.4, G.headZ, G.headW - 3, 1.6, G.headD - 3, cup), box(0, headTop + 3, G.headZ, 1.4, 2.2, 1.4, solid('#5e3a20')));
  P.tufts = false;
});
def('toadstool', 'head', 'Toadstool Cap', 300, 'Spotted in the Mushroom Grotto. Very fashionable there.', (P) => {
  P.tufts = false;
  const m = motif('#d8402f', '#fff6e8', 3.2);
  P.add('head', box(0, headTop - 0.6, G.headZ, G.headW + 3, 2.2, G.headD + 3, m), box(0, headTop + 1.6, G.headZ, G.headW - 1, 2, G.headD - 1, m), box(0, headTop + 3.6, G.headZ, G.headW - 6, 1.4, G.headD - 6, m));
  P.add('head', box(0, headTop - 1.2, G.headZ, G.headW + 2, 0.7, G.headD + 2, smooth('#f6ead2'), { skip: 'u' }));
}, { area: 'grotto' });
def('froghat', 'head', 'Froggy Hat', 340, 'Ribbit. That is all.', (P) => {
  P.tufts = false;
  const g = smooth('#78c25a'), w = smooth('#fffdf2'), k = smooth('#1d2321');
  P.add('head', box(0, headTop - 1, G.headZ, G.headW + 1, 3, G.headD + 1, g), box(0, headTop + 2, G.headZ, G.headW - 3, 1.4, G.headD - 3, g));
  for (const sd of [-1, 1]) P.add('head', box(sd * 4.2, headTop + 2.4, G.headZ + 3.2, 3.4, 2.8, 3, g), box(sd * 4.2, headTop + 3, G.headZ + 4.75, 2.2, 1.8, 0.2, w), box(sd * 4.2, headTop + 3.3, G.headZ + 4.9, 1, 1, 0.2, k));
  P.add('head', box(0, headTop + 0.6, G.headZ + G.headD / 2 + 0.5, 4, 0.6, 0.3, smooth('#e66a7a')));
}, { area: 'lake' });
def('bow', 'head', 'Ribbon Bow', 90, 'A big soft bow, tied between the ears.', (P) => {
  const m = cloth('#ff8fb1', { shade: { noise: 0.2 } });
  P.add('head', box(-2.6, headTop - 0.4, 2.4, 2, 2, 2, m), { ...box(-4.6, headTop - 1, 2.4, 3, 3.2, 1.2, m), rot: [0, 0, 18] }, { ...box(-0.6, headTop - 1, 2.4, 3, 3.2, 1.2, m), rot: [0, 0, -18] });
});
def('sprout', 'head', 'Little Sprout', 0, 'It grows a tiny bit every good night of sleep.', (P) => {
  const stem = solid('#4f9a3c'), leaf = leaves('#6fc054', { seed: 2 });
  P.add('head', box(0, headTop - 0.2, 1, 0.8, 3, 0.8, stem), { ...box(-1.5, headTop + 2.4, 1, 3, 0.8, 1.8, leaf), rot: [0, 0, 22] }, { ...box(1.6, headTop + 2.0, 1, 2.6, 0.8, 1.6, leaf), rot: [0, 0, -26] });
});

// ------------------------------------------------------------------ face

function ring(P: OwlParts, cx: number, cy: number, z: number, size: number, th: number, m: Painter, bone: BoneName = 'head') {
  const h = size / 2;
  P.add(bone, box(cx, cy + h - th, z, size, th, 0.6, m), box(cx, cy - h, z, size, th, 0.6, m), box(cx - h + th / 2, cy - h, z, th, size, 0.6, m), box(cx + h - th / 2, cy - h, z, th, size, 0.6, m));
}
def('glasses', 'face', 'Reading Glasses', 180, 'For bedtime stories and very small print.', (P) => {
  const m = metal('#c99a3a');
  for (const sd of [-1, 1]) ring(P, sd * G.eyeX, G.eyeY, G.faceFront + 0.7, 6, 0.55, m);
  P.add('head', box(0, G.eyeY + 0.9, G.faceFront + 0.7, 1.5, 0.5, 0.6, m));
  for (const sd of [-1, 1]) P.add('head', box(sd * 7.4, G.eyeY + 2.2, 2.2, 0.5, 0.5, 9, m));
});
def('sleepmask', 'face', 'Sleepy Mask', 120, 'Worn on the forehead, ready for lights-out.', (P) => {
  const m = cloth('#9a7fd6', { trim: '#f5d36b', hem: 0.6 }), k = flatLash();
  P.add('head', box(0, 22.6, G.faceFront + 0.5, 14.2, 3.2, 0.9, m));
  for (const sd of [-1, 1]) P.add('head', box(sd * 3.6, 23.6, G.faceFront + 1.05, 3.4, 0.5, 0.2, k), box(sd * 3.6 + sd * -1.4, 23.2, G.faceFront + 1.05, 0.5, 0.5, 0.2, k), box(sd * 3.6 + sd * 1.4, 23.2, G.faceFront + 1.05, 0.5, 0.5, 0.2, k));
  for (const sd of [-1, 1]) P.add('head', box(sd * 8.3, 22.8, 1.8, 0.6, 1.2, 10, cloth('#7d63bd')));
});
function flatLash(): Painter { const r = ramp(0x2a1d33); return (t) => tone(r, t.face === 2 ? 1 : 0); }
def('monocle', 'face', 'Gentlebird Monocle', 260, 'Distinguished. Slightly smug.', (P) => {
  const m = metal(GOLD);
  ring(P, G.eyeX, G.eyeY, G.faceFront + 0.7, 6.2, 0.6, m);
  P.add('head', box(G.eyeX + 2.9, G.eyeY - 6.6, G.faceFront + 0.6, 0.4, 3.6, 0.4, m));
});
def('stargoggles', 'face', 'Star Goggles', 70, 'Pushed up, ready for meteor showers.', (P) => {
  const m = metal('#8a93a8'), g = lamp('#9fe7ff');
  for (const sd of [-1, 1]) P.add('head', box(sd * 3.4, 22.8, G.faceFront + 0.6, 4.6, 3, 1.4, m), box(sd * 3.4, 23.3, G.faceFront + 1.35, 3.2, 2, 0.2, g, { glow: true }));
  P.add('head', box(0, 23.2, 0.2, G.headW + 0.8, 1.4, G.headD + 0.8, cloth('#3c4256'), { skip: 'ud' }));
}, { premium: true });

// ------------------------------------------------------------------ neck

def('scarf', 'neck', 'Cosy Scarf', 150, 'Knitted in the colours of autumn leaves.', (P) => {
  const m = knit('#d9573b', { stripe: '#f2c35a', every: 4 });
  P.add('body', box(0, G.neckY - 1.8, 0.6, G.bodyW + 1.6, 2.6, G.bodyD + 2.6, m));
  P.add('body', { ...box(3.4, G.neckY - 7, G.bodyD / 2 + 1.6, 2.8, 5.6, 1.1, m), rot: [8, 0, 6] }, box(3.8, G.neckY - 7.8, G.bodyD / 2 + 1.9, 3, 0.9, 1, fluff('#f2c35a')));
});
def('bowtie', 'neck', 'Velvet Bowtie', 110, 'For formal hoots.', (P) => {
  const m = cloth('#7a2f5a');
  const z = G.bodyD / 2 + 1.7;
  P.add('body', box(0, G.neckY - 2.3, z, 1.4, 1.4, 1, m), { ...box(-1.9, G.neckY - 2.6, z - 0.1, 2.6, 2, 0.8, m), rot: [0, 0, -10] }, { ...box(1.9, G.neckY - 2.6, z - 0.1, 2.6, 2, 0.8, m), rot: [0, 0, 10] });
});
def('bandana', 'neck', 'Trail Bandana', 130, 'Every adventurer needs one.', (P) => {
  const m = motif('#3f7fc4', '#ffffff', 2);
  P.add('body', box(0, G.neckY - 1.6, 0.4, G.bodyW + 1.2, 1.6, G.bodyD + 2.2, m));
  P.add('body', box(0, G.neckY - 3.4, G.bodyD / 2 + 1.4, 6, 1.8, 0.8, m), box(0, G.neckY - 4.8, G.bodyD / 2 + 1.4, 3.4, 1.4, 0.8, m), box(0, G.neckY - 5.8, G.bodyD / 2 + 1.4, 1.2, 1, 0.8, m));
}, { area: 'woods' });
def('bell', 'neck', 'Silver Bell', 200, 'Jingles softly when Pip hops.', (P) => {
  P.add('body', box(0, G.neckY - 1.4, 0.4, G.bodyW + 1, 1, G.bodyD + 2, cloth('#3f8a7a'), { skip: 'ud' }));
  P.add('body', box(0, G.neckY - 3.4, G.bodyD / 2 + 1.6, 2.4, 2.2, 2, metal('#d8dde8')), box(0, G.neckY - 3.6, G.bodyD / 2 + 2.65, 0.6, 0.6, 0.2, solid('#2a2f3a')));
});
def('moonpendant', 'neck', 'Moonstone Pendant', 80, 'Glows faintly, like a nightlight you can wear.', (P) => {
  P.add('body', box(0, G.neckY - 1.4, 0.4, G.bodyW + 1, 0.6, G.bodyD + 2, metal(GOLD), { skip: 'ud' }));
  P.add('body', box(0, G.neckY - 4.2, G.bodyD / 2 + 1.7, 2.4, 2.8, 0.8, lamp('#bfe9ff'), { glow: true }), box(0, G.neckY - 1.8, G.bodyD / 2 + 1.6, 0.6, 1.2, 0.6, metal(GOLD)));
}, { premium: true });

// ------------------------------------------------------------------ body

/** A shell over the barrel body, leaving the wings outside. */
function torso(P: OwlParts, m: Painter, top = 1.4) {
  P.add('body', box(0, G.bodyY + 0.6, 0.5, G.bodyW + 0.8, G.bodyH - top, G.bodyD + 2, m, { tag: 'torso', skip: 'u' }));
  P.add('body', box(0, G.bodyY + 0.6 + G.bodyH - top - 0.01, 0.5, G.bodyW - 1, 0.8, G.bodyD + 0.2, m, { tag: 'torso' }));
}
const front = (base: Painter, f: (x: number, y: number) => number | null): Painter => (t) => {
  if (t.tag === 'torso' && t.face === 4) { const c = f(t.x, t.y); if (c !== null) return c; }
  return base(t);
};

def('sweater', 'body', 'Moon Sweater', 320, 'Chunky knit with a crescent moon on the front.', (P) => {
  const gold = ramp(col('#f6d36a'));
  torso(P, front(knit('#3d5aa0'), (x, y) => {
    const d1 = Math.hypot(x - 0.2, y - 8.6), d2 = Math.hypot(x - 1.6, y - 9.4);
    return d1 < 2.6 && d2 > 2.3 ? tone(gold, 0.5 + (y > 9 ? 0.6 : 0)) : null;
  }));
  P.add('body', box(0, G.bodyY + 0.2, 0.5, G.bodyW + 1.2, 1.2, G.bodyD + 2.4, knit('#2b4280'), { skip: 'u' }));
});
def('pajamas', 'body', 'Striped Pajamas', 260, 'Soft flannel, perfect for the long night ahead.', (P) => {
  const b = ramp(col('#fff4dc'));
  torso(P, front(cloth('#7fb6e8', { stripe: '#e9f3ff', stripeEvery: 2 }), (x, y) => (Math.abs(x) < 0.45 && Math.floor(y) % 3 === 0 ? tone(b, 1) : null)));
  P.add('body', box(0, G.neckY - 1.2, 0.5, G.bodyW + 1.4, 1, G.bodyD + 2.4, cloth('#4f86c4'), { skip: 'ud' }));
});
def('raincoat', 'body', 'Puddle Raincoat', 340, 'Glossy yellow, for drizzly adventures.', (P) => {
  const k = ramp(col('#3a2d1a'));
  torso(P, front(smooth('#f6c534', { rim: 1.4 }), (x, y) => (Math.abs(x) < 0.4 && Math.floor(y) % 3 === 0 ? tone(k, 0) : null)));
  P.add('body', box(0, G.neckY - 2.6, -G.bodyD / 2 - 0.8, G.bodyW, 4, 2.4, smooth('#e3b22a')));
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
  const m = cloth('#8a1f3c', { trim: '#fbf6ee', hem: 1.4 });
  P.add('body', box(0, G.neckY - 3.4, -0.2, G.bodyW + 5.6, 3.2, G.bodyD + 3, m, { skip: 'd' }), box(0, G.bodyY - 0.6, -G.bodyD / 2 - 1.6, G.bodyW + 5.2, G.bodyH - 2, 1.2, m));
  P.add('body', box(0, G.neckY - 1, 0, G.bodyW + 3.4, 1.8, G.bodyD + 2.6, motif('#fbf6ee', '#1b1b22', 1.6)));
}, { premium: true });
def('cloudcloak', 'body', 'Cloud Cloak', 220, 'Woven from the softest cloud over Starfall Peak.', (P) => {
  const f = fluff('#f4f6ff');
  for (const [x, y, z, s] of [[-6, 11.5, 0, 4.4], [6, 11.5, 0, 4.4], [-3.4, 12.6, -3, 4], [3.4, 12.6, -3, 4], [0, 12, -4.4, 4.6], [-6.4, 8.6, -2, 3.6], [6.4, 8.6, -2, 3.6], [0, 8, -6, 4.2], [-3.6, 5, -6, 3.6], [3.6, 5, -6, 3.6]] as const) P.add('body', box(x, y, z, s, s * 0.8, s, f));
}, { premium: true, area: 'peak' });

// ------------------------------------------------------------------ back

def('satchel', 'back', 'Explorer Satchel', 0, 'Pip packs it before every night adventure.', (P) => {
  const strap = cloth('#6b4426'), bag = (() => { const r = R('#9a6235'); return (t: Texel) => tone(r, lvl(t, { noise: 0.4, scale: 1.5 }) * 0.8 + (t.by > t.sy - 1.3 && t.face === 0 ? 0.8 : 0)); })();
  P.add('body', { ...box(0, 7.2, 0.4, 1.2, 12, G.bodyD + 1.8, strap, { skip: 'ud' }), rot: [0, 0, 34] });
  P.add('body', box(7.4, 3.8, 2.6, 2.4, 4.2, 4.6, bag), box(8.7, 6.3, 2.6, 0.4, 1.6, 4.8, strap), box(8.95, 6.2, 2.6, 0.3, 0.8, 0.9, metal(GOLD)));
});
def('backpack', 'back', 'Trail Backpack', 300, 'Room for snacks, maps and one emergency acorn.', (P) => {
  const m = cloth('#4f8a52', { trim: '#2f5a34', hem: 1 });
  P.add('body', box(0, 5, -G.bodyD / 2 - 2.2, 9, 8, 3.6, m), box(0, 9.8, -G.bodyD / 2 - 2.6, 9.4, 2.4, 4, cloth('#3d6d40')), box(0, 6.4, -G.bodyD / 2 - 4.2, 5, 3, 0.8, cloth('#3d6d40')));
  for (const sd of [-1, 1]) P.add('body', box(sd * 3, 6, 0.4, 1, 7.6, G.bodyD + 1.6, cloth('#2f5a34'), { skip: 'ud' }));
});
def('lantern', 'back', 'Firefly Lantern', 420, 'A jar of friendly fireflies that light the way home.', (P) => {
  const frame = metal('#5b6170'), glass = lamp('#ffe28a');
  P.add('body', box(0, 8, -G.bodyD / 2 - 0.8, 1, 6, 1, solid('#6b4426')), box(0, 13.6, -G.bodyD / 2 - 1.6, 1, 1, 2.6, solid('#6b4426')));
  P.add('body', box(0, 14.2, -G.bodyD / 2 - 3, 3.4, 0.6, 3.4, frame), box(0, 10.8, -G.bodyD / 2 - 3, 3, 3.4, 3, glass, { glow: true }), box(0, 10.4, -G.bodyD / 2 - 3, 3.4, 0.5, 3.4, frame));
}, { area: 'grotto' });
def('fairywings', 'back', 'Moth Fairy Wings', 250, 'Dusted with moonlight. They flutter when Pip is happy.', (P) => {
  const w = (() => {
    const r = R('#c8b6ff'), e = R('#7a5fd6');
    return (t: Texel) => {
      const ring2 = Math.hypot(t.bx - t.sx / 2, t.by - t.sy / 2) / (Math.min(t.sx, t.sy) / 2);
      return ring2 > 0.8 ? tone(e, 0.4) : tone(r, 1 + (ring2 < 0.3 ? 1.5 : 0) - ring2);
    };
  })();
  for (const sd of [-1, 1]) {
    P.add('body', { ...box(sd * 5.6, 7, -G.bodyD / 2 - 1.4, 8, 9, 0.5, w, { glow: true }), rot: [0, sd * 24, sd * 18] });
    P.add('body', { ...box(sd * 4.4, 3.4, -G.bodyD / 2 - 1.4, 5, 5, 0.5, w, { glow: true }), rot: [0, sd * 24, -sd * 22] });
  }
}, { premium: true });

for (const p of PIECES) PIECE[p.id] = p;

/** Apply an outfit (slot → piece id) to the owl's parts. */
export function dressOwl(P: OwlParts, outfit: Partial<Record<OutfitSlot, string>>) {
  for (const id of Object.values(outfit)) {
    const p = id ? PIECE[id] : undefined;
    if (p) p.make(P);
  }
}

export const SLOT_ORDER: OutfitSlot[] = ['head', 'face', 'neck', 'body', 'back'];
export const SLOT_NAME: Record<OutfitSlot, string> = { head: 'Hats', face: 'Face', neck: 'Neck', body: 'Clothes', back: 'Back' };
