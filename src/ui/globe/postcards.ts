// Hand-pixelled postcard scenes, one per place, painted in code at 120 x 72 art pixels: most of them by night
// (that is when Pip visits), in the calm Moss & Moonlight palette with warm lamplight. Each is layered: a
// stepped, dithered sky; stars, moon or aurora; far ridges; the landmark; water with reflections; foreground.
// [globe] OWNED BY THE GLOBE BUILDER.
import { bayer, fbm1, hash, mix, mul, Pix, type C } from './pix.ts';

export const PW = 120, PH = 72;

// palette (src/gfx/palette.ts plus a few deeper night tones)
const K = {
  ink: 0x2e2b24, deep: 0x161c26, deepNight: 0x1b222d, night: 0x27313f, night2: 0x303c50, slate: 0x46596a, dusk: 0x617f8c, lake: 0x86a9b0,
  sky: 0xaec8cc, mist: 0xd3e0dc, lamp: 0xf1d39a, lampHi: 0xfbeac2, honey: 0xdcb072, ochre: 0xc59a52, terra: 0xc0866a, clay: 0xa66c55,
  rose: 0xd9aca4, blush: 0xe8b4ae, berry: 0x9e5f66, plum: 0x6e5266, lilac: 0xb4a9c9, lavender: 0xd3cce0, frost: 0xdfe9ea, snow: 0xf5f7f2,
  ice: 0xbcd6dc, stone: 0x908a7e, stoneDark: 0x6a655c, pebble: 0xb9b2a4, sage: 0xa7b788, moss: 0x86a06a, fern: 0x66844f, leaf: 0x557343,
  pine: 0x3f5a3b, forest: 0x2c4030, wood: 0x9c7a56, woodDark: 0x6f553d, woodDeep: 0x4a392b, bark: 0x5b4a3c, straw: 0xc9b78d, oat: 0xeae0c8,
  sand: 0xd8c08f, sandDk: 0xa88a62, vermilion: 0xb5584a, aurora: 0x8fd0a8, aurora2: 0x6fae9a, violet: 0x8a7aa8,
};

type Rnd = () => number;
const rng = (seed: number): Rnd => { let s = seed * 9301 + 49297; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

// ------------------------------------------------------------------ building blocks

/** A stepped sky: solid bands that dither into the next one near their edge. */
function sky(p: Pix, cols: C[], y0 = 0, y1 = PH) {
  for (let y = y0; y < y1; y++) {
    const t = ((y - y0) / Math.max(1, y1 - y0 - 1)) * (cols.length - 1);
    const i = Math.min(cols.length - 2, Math.floor(t)), f = t - i;
    const k = Math.max(0, (f - 0.55) / 0.45);
    for (let x = 0; x < PW; x++) p.set(x, y, bayer(x, y) < k ? cols[i + 1] : cols[i]);
  }
}
function stars(p: Pix, n: number, r: Rnd, y1: number, bright = 0.12) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * PW), y = Math.floor(r() * y1);
    const k = r();
    if (k < bright) { p.set(x, y, K.lampHi); p.set(x - 1, y, K.slate); p.set(x + 1, y, K.slate); p.set(x, y - 1, K.slate); p.set(x, y + 1, K.slate); }
    else p.set(x, y, k < 0.5 ? K.lavender : K.dusk);
  }
}
function moon(p: Pix, x: number, y: number, r: number, full = false) {
  p.disc(x, y, r + 1.4, mix(p.get(x, y - r - 3) === -1 ? K.night : p.get(x, y - r - 3), K.lamp, 0.18));
  p.disc(x, y, r, K.oat);
  p.disc(x - r * 0.3, y - r * 0.3, r * 0.55, K.snow);
  p.set(x + r * 0.3, y + r * 0.2, K.straw); p.set(x - r * 0.2, y + r * 0.45, K.straw); p.set(x + r * 0.45, y - r * 0.35, K.pebble);
  if (!full) p.disc(x + r * 0.55, y - r * 0.25, r * 0.85, p.get(x + r + 3, y));
}
/** fill below a ridge line y(x), with a 1px lit edge */
function ridge(p: Pix, y: (x: number) => number, fill: C, edge?: C, to = PH) {
  for (let x = 0; x < PW; x++) {
    const t = Math.round(y(x));
    for (let j = t; j < to; j++) p.set(x, j, fill);
    if (edge !== undefined) p.set(x, t, edge);
  }
}
const noisy = (base: number, amp: number, freq: number, seed: number) => (x: number) => base - fbm1(x * freq, seed, 3) * amp;
/** mirror what is above `y0` into rows y0..y1 as wobbly water, tinted */
function reflect(p: Pix, y0: number, y1: number, tint: C, k = 0.45) {
  for (let y = y0; y < y1; y++) {
    const sy = y0 - (y - y0) - 1, wob = Math.round(Math.sin(y * 1.7) * 1.2);
    for (let x = 0; x < PW; x++) {
      const c = p.get(x + wob, sy);
      let o = c === -1 ? tint : mix(c, tint, k + (y - y0) / (y1 - y0) * 0.25);
      if ((y - y0) % 3 === 2 && bayer(x, y) < 0.5) o = mul(o, 0.9);
      p.set(x, y, o);
    }
  }
}
/** little moonlit wave dashes */
function ripples(p: Pix, y0: number, y1: number, c: C, r: Rnd, n = 30) {
  for (let i = 0; i < n; i++) { const x = Math.floor(r() * PW), y = y0 + Math.floor(r() * (y1 - y0)); const w = 1 + Math.floor(r() * 3); p.hline(x, x + w, y, c); }
}
function pine(p: Pix, x: number, base: number, h: number, c: C, lit?: C) {
  for (let j = 0; j < h; j++) {
    const w = Math.floor((j / h) * (h * 0.42)) + (j % 3 === 0 ? 0 : 1);
    p.hline(x - w, x + w, base - h + j, c);
    if (lit !== undefined && j % 3 === 1) p.set(x - w, base - h + j, lit);
  }
  p.vline(x, base, base + 1, K.bark);
}
function palm(p: Pix, x: number, base: number, h: number, c: C, trunk: C) {
  for (let j = 0; j < h; j++) p.set(x + Math.round(Math.sin(j / h * 1.4) * 2), base - j, trunk);
  const tx = x + Math.round(Math.sin(1.4) * 2), ty = base - h;
  for (const [dx, dy] of [[-6, 2], [6, 2], [-4, -2], [4, -2], [-7, 4], [7, 4]]) p.line(tx, ty, tx + dx, ty + dy, c);
  p.set(tx, ty - 1, c);
}
function window(p: Pix, x: number, y: number, w = 1, h = 1, c: C = K.lamp) { p.rect(x, y, w, h, c); }
function fireflies(p: Pix, r: Rnd, n: number, y0: number, y1: number) { for (let i = 0; i < n; i++) p.set(Math.floor(r() * PW), y0 + Math.floor(r() * (y1 - y0)), r() < 0.5 ? K.lamp : K.lampHi); }
function aurora(p: Pix, r: Rnd, y0: number, cols: C[]) {
  for (let x = 0; x < PW; x++) {
    const base = y0 + Math.sin(x * 0.06 + 1) * 6 + Math.sin(x * 0.17) * 2;
    const len = 10 + fbm1(x * 0.08, 7) * 18;
    for (let j = 0; j < len; j++) {
      const y = Math.round(base - j * 0.9 + 8);
      const t = j / len;
      if (bayer(x, y) < (1 - t) * 0.9) p.set(x, y, t < 0.3 ? cols[0] : t < 0.65 ? cols[1] : cols[2]);
    }
  }
  void r;
}

// ------------------------------------------------------------------ the scenes

const NIGHT = [K.deep, K.deepNight, K.night, K.night2, K.slate];
const DUSK = [K.night, K.plum, K.berry, K.rose, K.lamp];

const SCENES: Record<string, (p: Pix, r: Rnd) => void> = {
  highlands(p, r) {
    sky(p, [K.deepNight, K.night, K.night2, K.plum, K.berry], 0, 44);
    stars(p, 40, r, 34);
    moon(p, 92, 13, 6);
    ridge(p, noisy(30, 12, 0.03, 1), 0x3c3f58, 0x4a4d68, 46);
    ridge(p, noisy(36, 9, 0.05, 2), 0x34394a, 0x434860, 46);
    // the castle on its knoll, one window lit
    ridge(p, (x) => 40 - Math.max(0, 6 - Math.abs(x - 30) * 0.3), K.forest, K.pine, 46);
    p.rect(22, 27, 14, 9, 0x2b2c38); p.rect(20, 23, 5, 13, 0x2b2c38); p.rect(33, 25, 4, 11, 0x2b2c38);
    for (let i = 0; i < 3; i++) { p.set(20 + i * 2, 22, 0x2b2c38); p.set(33 + i * 2, 24, 0x2b2c38); }
    p.set(23, 22, -1 as unknown as C);
    window(p, 22, 26, 1, 2); p.set(28, 30, K.stoneDark);
    // the loch
    reflect(p, 46, 58, 0x2f3a4e, 0.5);
    ripples(p, 47, 57, K.dusk, r, 20);
    p.vline(92, 47, 56, K.lamp); p.vline(93, 48, 54, K.oat);
    // heather and grass on the near shore
    ridge(p, noisy(60, 5, 0.08, 4), K.forest, K.pine);
    for (let i = 0; i < 90; i++) { const x = Math.floor(r() * PW), y = 59 + Math.floor(r() * 13); p.set(x, y, r() < 0.6 ? K.plum : K.berry); if (r() < 0.3) p.set(x, y - 1, K.lilac); }
    pine(p, 8, 66, 18, K.forest, K.pine); pine(p, 112, 68, 22, K.forest, K.pine); pine(p, 103, 66, 14, K.forest, K.pine);
  },
  kyoto(p, r) {
    sky(p, NIGHT, 0, 50);
    stars(p, 36, r, 30);
    moon(p, 22, 12, 5);
    ridge(p, noisy(34, 10, 0.04, 3), 0x2c3446, 0x3a4458);
    // a five-tier pagoda
    const px = 84;
    for (let i = 0; i < 5; i++) {
      const y = 46 - i * 6, w = 11 - i * 1.6;
      p.poly([[px - w - 2, y], [px + w + 2, y], [px + w - 1, y - 2], [px - w + 1, y - 2]], 0x242632);
      p.hline(Math.round(px - w - 2), Math.round(px + w + 2), y, 0x3b3442);
      p.rect(Math.round(px - w + 2), y + 1, Math.round(w * 2 - 3), 4, 0x2e2a36);
      window(p, px - 1, y + 2, 1, 2); window(p, px + 2, y + 2, 1, 1, K.honey);
    }
    p.vline(px, 10, 16, K.stoneDark); p.set(px, 9, K.honey);
    // maples
    for (let i = 0; i < 70; i++) { const x = 52 + r() * 20 + (r() < 0.5 ? 40 : 0), y = 30 + r() * 18; p.set(x, y, r() < 0.5 ? K.berry : 0x7a4650); }
    // stone path with lanterns and torii gates in a row
    ridge(p, () => 52, 0x2d3328, 0x3c4434);
    for (let i = 0; i < 4; i++) {
      const x = 10 + i * 14, s = 1 - i * 0.18, h = Math.round(18 * s), w = Math.round(12 * s), y = 66 - i * 4;
      p.rect(x, y - h, 2, h, K.vermilion); p.rect(x + w, y - h, 2, h, K.vermilion);
      p.rect(x - 2, y - h - 2, w + 6, 2, K.vermilion); p.hline(x - 2, x + w + 3, y - h - 3, 0x6e3a34); p.rect(x - 1, y - h + 2, w + 4, 1, 0x8a4038);
      p.set(x - 2, y - h - 2, 0x6e3a34); p.set(x + w + 3, y - h - 2, 0x6e3a34);
    }
    for (let i = 0; i < 6; i++) { const x = 60 + i * 10, y = 62 - (i % 2); p.rect(x, y, 3, 4, K.lamp); p.set(x + 1, y + 1, K.lampHi); p.hline(x - 1, x + 3, y - 1, K.ink); p.vline(x + 1, y + 4, y + 9, K.ink); }
    ridge(p, () => 70, 0x262b22, 0x2f3529);
  },
  paris(p, r) {
    sky(p, [K.deepNight, K.night, K.night2, K.slate, K.dusk], 0, 56);
    stars(p, 26, r, 26);
    moon(p, 18, 14, 4);
    // the tower, lit gold, sparkling
    const tx = 78, top = 6, base = 58;
    for (let y = top; y < base; y++) {
      const t = (y - top) / (base - top), half = Math.round(1 + t * t * 15);
      p.set(tx - half, y, K.ochre); p.set(tx + half, y, K.ochre);
      if (y % 3 === 0) p.hline(tx - half, tx + half, y, mix(K.ochre, K.woodDeep, 0.5));
      if ((y + tx) % 5 === 0) { p.set(tx - half + 1, y, K.honey); p.set(tx + half - 1, y, K.honey); }
    }
    p.hline(tx - 6, tx + 6, 30, K.honey); p.hline(tx - 10, tx + 10, 44, K.honey);
    p.poly([[tx - 15, base], [tx - 8, 46], [tx, 52], [tx + 8, 46], [tx + 15, base]], -1 as unknown as C);
    for (let y = 46; y < base; y++) { const t = (y - top) / (base - top); const half = Math.round(1 + t * t * 15); p.set(tx - half, y, K.ochre); p.set(tx + half, y, K.ochre); }
    p.vline(tx, 2, top, K.stone); p.set(tx, 1, K.lampHi);
    for (let i = 0; i < 16; i++) p.set(tx + Math.round((r() - 0.5) * 24), top + 8 + Math.floor(r() * 46), K.lampHi);
    // zinc rooftops with chimneys and windows
    const roofs = [0, 14, 26, 40, 58, 96, 110];
    roofs.forEach((x, i) => {
      const h = 10 + ((i * 7) % 6), y = 62 - h;
      p.rect(x, y, 16, h + 10, 0x3a4256); p.poly([[x, y], [x + 16, y], [x + 13, y - 4], [x + 3, y - 4]], 0x4f5a70);
      p.rect(x + 5, y - 7, 2, 3, 0x5a5048); p.set(x + 5, y - 8, K.terra);
      for (let k = 0; k < 4; k++) if (hash(i, k) > 0.35) window(p, x + 2 + k * 4, y + 3 + (k % 2) * 4, 1, 2, hash(k, i) > 0.5 ? K.lamp : K.honey);
    });
    // the Seine
    reflect(p, 64, PH, 0x2a3448, 0.5);
    ripples(p, 65, 71, K.honey, r, 14);
  },
  venice(p, r) {
    sky(p, [K.deepNight, K.night, K.night2, K.plum], 0, 40);
    stars(p, 24, r, 24);
    moon(p, 60, 9, 4);
    // palazzi on both banks, in perspective
    const house = (x: number, w: number, h: number, c: C, seed: number) => {
      p.rect(x, 52 - h, w, h, c);
      p.hline(x - 1, x + w, 52 - h, mul(c, 0.7));
      for (let j = 0; j < Math.floor(h / 6); j++) for (let i = 0; i < Math.floor(w / 4); i++) {
        const wx = x + 1 + i * 4, wy = 52 - h + 3 + j * 6;
        if (hash(i + seed, j) > 0.45) { window(p, wx, wy, 2, 3, hash(j, i + seed) > 0.4 ? K.lamp : K.honey); p.set(wx, wy, mul(c, 0.7)); }
        else p.rect(wx, wy, 2, 3, mul(c, 0.6));
      }
    };
    house(0, 18, 34, 0x8a5a4a, 1); house(18, 12, 28, 0xa8786a, 2); house(30, 10, 22, 0x7a6a5a, 3); house(40, 8, 18, 0x9a6a5a, 4);
    house(102, 18, 36, 0x9a7458, 5); house(90, 12, 28, 0x7f5650, 6); house(80, 10, 22, 0xa08068, 7); house(72, 8, 17, 0x8a6a5a, 8);
    // an arched bridge across the far end
    p.rect(44, 38, 32, 4, 0x8a8070); for (let x = 46; x < 74; x++) { const a = Math.abs(x - 60) / 14; const y = 42 + Math.round((1 - a * a) * -3); p.vline(x, 42, y + 6, 0x8a8070); }
    p.poly([[50, 48], [70, 48], [66, 43], [54, 43]], K.night); p.hline(44, 75, 37, K.pebble);
    // canal with reflections
    reflect(p, 52, PH, 0x24384a, 0.5);
    ripples(p, 54, 71, K.lamp, r, 24);
    // the gondola
    const gy = 62;
    p.poly([[30, gy], [84, gy], [90, gy - 5], [86, gy - 3], [80, gy + 2], [36, gy + 2]], 0x1c1c22);
    p.hline(36, 80, gy, 0x3a3a44); p.rect(86, gy - 9, 2, 5, K.pebble); p.hline(85, 89, gy - 9, K.pebble);
    p.rect(44, gy - 12, 3, 8, K.ink); p.rect(44, gy - 15, 3, 3, K.blush); p.rect(43, gy - 16, 5, 1, K.straw); p.hline(44, 46, gy - 10, K.snow);
    p.line(40, gy - 10, 34, gy + 6, K.woodDark);
    p.rect(20, 58, 2, 14, K.woodDeep); p.rect(26, 60, 2, 12, 0x2f3a6a); p.set(20, 57, K.lamp);
  },
  santorini(p, r) {
    sky(p, [K.night2, K.plum, K.berry, K.rose, K.blush], 0, 40);
    p.disc(28, 34, 6, K.lamp); p.disc(28, 34, 4, K.lampHi);
    stars(p, 10, r, 14);
    // sea with the sunset path
    reflect(p, 40, PH, 0x5a6a88, 0.55);
    for (let y = 41; y < PH; y++) if (y % 2) p.hline(28 - (y - 40) / 3, 28 + (y - 40) / 3, y, K.lamp);
    // the cliff with white houses and blue domes
    ridge(p, (x) => 24 + Math.max(0, (x - 60) * -0.4) + fbm1(x * 0.1, 9) * 5 + (x < 56 ? 40 : 0), 0x7a5a50, 0x9a7262);
    const cube = (x: number, y: number, w: number, h: number) => { p.rect(x, y, w, h, K.snow); p.vline(x + w - 1, y, y + h - 1, K.lavender); p.hline(x, x + w - 1, y + h - 1, K.lilac); if (hash(x, y) > 0.4) window(p, x + 1, y + 2, 1, 2, K.lamp); else p.rect(x + 1, y + 2, 1, 2, 0x4f78a8); };
    for (let i = 0; i < 26; i++) { const x = 60 + Math.floor(r() * 58), y = 22 + Math.floor(((x - 60) / 58) * -2 + r() * 22); cube(x, y, 4 + Math.floor(r() * 4), 3 + Math.floor(r() * 3)); }
    // a chapel with a blue dome
    p.rect(80, 22, 12, 9, K.snow); p.vline(91, 22, 30, K.lavender);
    p.disc(86, 21, 5, 0x4f78a8); p.rect(80, 22, 12, 4, K.snow); p.disc(86, 20, 4, 0x4f78a8); p.set(84, 17, 0x7aa0c8); p.set(85, 16, 0x7aa0c8);
    p.vline(86, 13, 15, K.ochre); p.hline(85, 87, 14, K.ochre);
    window(p, 85, 26, 2, 3);
    // a windmill on the ridge
    p.rect(108, 12, 5, 10, K.snow); p.poly([[107, 12], [114, 12], [110.5, 8]], K.terra);
    p.line(110, 10, 104, 4, K.woodDark); p.line(110, 10, 117, 5, K.woodDark); p.line(110, 10, 116, 16, K.woodDark); p.line(110, 10, 104, 16, K.woodDark);
    ripples(p, 44, 71, K.rose, r, 20);
  },
  sahara(p, r) {
    sky(p, [K.deep, K.deepNight, K.night, K.night2, 0x5a5068], 0, 50);
    // the milky way
    for (let i = 0; i < 260; i++) { const t = r(), x = Math.floor(t * PW), y = Math.floor(40 - t * 36 + (r() - 0.5) * 12 * (0.6 + r())); p.set(x, y, r() < 0.3 ? K.lavender : r() < 0.6 ? K.lilac : K.violet); }
    stars(p, 60, r, 44, 0.08);
    // dunes by moonlight
    ridge(p, (x) => 44 + Math.sin(x * 0.05) * 5 + fbm1(x * 0.04, 3) * 4, 0x8a6c58, 0xb08a6a);
    ridge(p, (x) => 52 + Math.sin(x * 0.07 + 2) * 5, 0x9c7a60, 0xc49a74);
    ridge(p, (x) => 62 + Math.sin(x * 0.04 + 4) * 4, 0xb08a68, 0xd8b088);
    for (let i = 0; i < 40; i++) { const x = Math.floor(r() * PW), y = 56 + Math.floor(r() * 16); p.hline(x, x + 2, y, 0xc49a74); }
    // a caravan along the ridge, lanterns swinging
    const camel = (x: number, y: number) => {
      p.rect(x, y - 5, 7, 3, K.ink); p.rect(x + 2, y - 7, 3, 2, K.ink); p.rect(x + 7, y - 7, 1, 4, K.ink); p.rect(x + 7, y - 8, 3, 2, K.ink);
      for (const lx of [x, x + 2, x + 5, x + 6]) p.vline(lx, y - 2, y, K.ink);
    };
    for (let i = 0; i < 4; i++) { const x = 18 + i * 13, y = Math.round(44 + Math.sin(x * 0.05) * 5 + fbm1(x * 0.04, 3) * 4); camel(x, y); p.set(x + 10, y - 6, K.lamp); }
    p.rect(14, 38, 1, 5, K.ink); p.set(14, 37, K.ink); p.set(13, 39, K.lamp);
    // the oasis
    palm(p, 100, 60, 14, K.forest, K.woodDeep); palm(p, 108, 62, 11, K.pine, K.woodDeep);
    p.ellipse(104, 64, 9, 2, 0x34405a); p.hline(98, 108, 64, K.lake);
  },
  grandcanyon(p, r) {
    sky(p, [K.night2, K.plum, K.berry, K.terra, K.honey], 0, 30);
    stars(p, 12, r, 12);
    // stratified walls stepping into the distance
    const layer = [0xb0663e, 0xc0866a, 0x9a5a40, 0xd09a74, 0x8a4e3a, 0xb87a5a];
    const wall = (base: number, depth: number, seed: number) => {
      for (let x = 0; x < PW; x++) {
        const top = Math.round(base + fbm1(x * 0.05, seed) * 8 - (Math.abs(x - 60) < 18 ? -4 : 0));
        for (let y = top; y < PH; y++) {
          const li = Math.floor((y - top + fbm1(x * 0.2, seed + 2) * 2) / 3) % layer.length;
          p.set(x, y, mix(layer[li], 0x3a3048, depth));
          if ((y - top) % 3 === 0 && bayer(x, y) < 0.3) p.set(x, y, mix(layer[li], K.lampHi, 0.25 - depth * 0.2));
        }
        p.set(x, top, mix(K.honey, 0x3a3048, depth));
      }
    };
    wall(26, 0.55, 1); wall(36, 0.35, 2);
    // the near rims frame a chasm with the river at the bottom
    for (let x = 0; x < PW; x++) {
      const lt = Math.round(44 + fbm1(x * 0.06, 5) * 6), dist = Math.abs(x - 64);
      if (dist < 14) continue;
      for (let y = lt + (dist < 22 ? (22 - dist) * 2 : 0); y < PH; y++) { const li = Math.floor((y - lt) / 3) % layer.length; p.set(x, y, mix(layer[li], 0x3a3048, 0.1)); }
    }
    for (let y = 60; y < PH; y++) p.hline(60 - (y - 60) / 3, 68 + (y - 60) / 3, y, y % 2 ? K.lake : K.sky);
    // a condor riding the warm air
    p.line(30, 14, 36, 16, K.ink); p.line(36, 16, 42, 13, K.ink); p.set(36, 17, K.ink);
  },
  cappadocia(p, r) {
    sky(p, [K.dusk, K.lilac, K.rose, K.blush, K.lamp], 0, 50);
    p.disc(96, 46, 6, K.lampHi);
    // fairy chimneys
    const chimney = (x: number, base: number, h: number, w: number) => {
      p.poly([[x - w, base], [x + w, base], [x + 2, base - h], [x - 2, base - h]], 0xd6b8a0);
      for (let y = base - h; y < base; y++) p.set(x + Math.round(((y - base + h) / h) * w * 0.8), y, 0xb89a86);
      p.ellipse(x, base - h - 1, 4, 2, 0x8a6a5a); p.hline(x - 3, x + 2, base - h - 2, 0xa88676);
      if (h > 14) { window(p, x - 1, base - h + 6, 1, 2, K.lamp); p.rect(x + 1, base - h + 10, 1, 2, 0x6a4a40); }
    };
    ridge(p, noisy(52, 8, 0.05, 2), 0xc8a890, 0xdcc0a8);
    for (const [x, h, w] of [[12, 22, 7], [26, 30, 8], [42, 18, 6], [58, 26, 8], [74, 16, 6], [88, 24, 7], [106, 30, 9]] as [number, number, number][]) chimney(x, 66, h, w);
    ridge(p, noisy(68, 3, 0.1, 5), 0xb89a86, 0xd6b8a0);
    // balloons drifting up at dawn
    const balloon = (x: number, y: number, s: number, a: C, b: C) => {
      for (let j = -s; j <= s; j++) { const hw = Math.round(Math.sqrt(Math.max(0, s * s - j * j)) * (j > s * 0.3 ? 0.7 : 1)); for (let i = -hw; i <= hw; i++) p.set(x + i, y + j, Math.floor((i + 20) / Math.max(1, Math.round(s / 2))) % 2 ? a : b); }
      p.set(x - Math.round(s * 0.4), y - Math.round(s * 0.5), K.oat);
      p.vline(x - 1, y + s + 1, y + s + 2, K.ink); p.vline(x + 1, y + s + 1, y + s + 2, K.ink); p.rect(x - 1, y + s + 3, 3, 2, K.woodDark);
    };
    balloon(40, 14, 6, K.vermilion, K.honey); balloon(70, 24, 4, 0x4f78a8, K.oat); balloon(18, 30, 3, K.fern, K.lamp); balloon(98, 16, 5, K.berry, K.lavender); balloon(84, 34, 2, K.terra, K.oat); balloon(56, 8, 2, K.plum, K.rose);
  },
  tajmahal(p, r) {
    sky(p, [K.deep, K.deepNight, K.night, K.night2, K.slate], 0, 46);
    stars(p, 30, r, 30);
    moon(p, 96, 12, 6, true);
    // the mausoleum: plinth, iwan, the onion dome and four minarets
    const W2 = 60, mar = 0xe6e2da, shade = 0xb8b4c4;
    p.rect(W2 - 30, 40, 60, 4, shade); p.hline(W2 - 30, W2 + 29, 40, mar);
    p.rect(W2 - 14, 26, 28, 14, mar); p.vline(W2 + 13, 26, 39, shade); p.vline(W2 + 6, 26, 39, shade);
    p.poly([[W2 - 4, 39], [W2 + 4, 39], [W2 + 4, 31], [W2, 28], [W2 - 4, 31]], 0x8a8698);
    window(p, W2 - 1, 34, 2, 4, K.honey);
    for (const dx of [-10, 9]) { p.rect(W2 + dx - 1, 30, 3, 6, 0x9a96a8); p.rect(W2 + dx - 1, 24, 3, 2, mar); }
    for (let j = 0; j < 12; j++) { const hw = Math.round(Math.sin((j / 12) * Math.PI * 0.95 + 0.25) * 8); p.hline(W2 - hw, W2 + hw, 25 - j, j > 8 ? shade : mar); p.set(W2 + hw, 25 - j, shade); }
    p.vline(W2, 9, 13, K.ochre); p.set(W2, 8, K.honey);
    for (const dx of [-26, 25]) { p.rect(W2 + dx, 18, 2, 22, mar); p.set(W2 + dx + 1, 18, shade); p.rect(W2 + dx - 1, 17, 4, 1, mar); p.rect(W2 + dx, 15, 2, 2, mar); p.hline(W2 + dx - 1, W2 + dx + 2, 26, shade); p.hline(W2 + dx - 1, W2 + dx + 2, 33, shade); }
    // gardens with cypress trees and the long pool
    ridge(p, () => 44, K.forest, K.pine);
    for (const x of [8, 18, 28, 92, 102, 112]) { for (let j = 0; j < 10; j++) p.hline(x - Math.round(Math.sin(j / 10 * Math.PI) * 2), x + Math.round(Math.sin(j / 10 * Math.PI) * 2), 50 - j, K.forest); }
    p.rect(40, 46, 40, 26, 0x2a3446);
    reflect(p, 46, PH, 0x2a3446, 0.55);
    ridge(p, () => 46, K.forest, K.pine); p.rect(0, 46, 40, 26, K.forest); p.rect(80, 46, 40, 26, K.forest);
    for (let y = 46; y < PH; y++) { const w = 6 + (y - 46); p.hline(60 - w, 60 + w, y, p.get(60, y) === K.forest ? 0x2a3446 : p.get(60, y)); }
    for (let y = 46; y < PH; y++) { const w = 6 + (y - 46); const sy = 46 - (y - 46) - 1; for (let x = 60 - w; x <= 60 + w; x++) { const c = p.get(x, sy); p.set(x, y, c === -1 || c === K.forest ? 0x2a3446 : mix(c, 0x2a3446, 0.45)); } p.set(60 - w - 1, y, K.pebble); p.set(60 + w + 1, y, K.pebble); }
    ripples(p, 50, 71, K.lavender, r, 8);
  },
  iceland(p, r) {
    sky(p, [K.deep, K.deepNight, K.night, 0x2c4048, 0x34505a], 0, 46);
    stars(p, 40, r, 40);
    aurora(p, r, 10, [0xa8e0c0, K.aurora2, K.violet]);
    // snowy mountains
    ridge(p, (x) => 30 + Math.abs(((x * 0.9) % 40) - 20) * 0.6 + fbm1(x * 0.1, 3) * 4, 0x4a5868, K.frost);
    for (let x = 0; x < PW; x++) for (let y = 0; y < PH; y++) if (p.get(x, y) === 0x4a5868 && bayer(x, y) < 0.35 && y < 40) p.set(x, y, K.ice);
    // black-sand shore, a lagoon with icebergs
    ridge(p, () => 46, 0x2a3440, 0x3a4658);
    reflect(p, 46, 58, 0x243444, 0.5);
    for (const [x, y, w, h] of [[24, 48, 8, 4], [52, 51, 5, 3], [84, 49, 10, 5]]) { p.poly([[x, y + h], [x + w, y + h], [x + w - 2, y], [x + 2, y - 1]], K.ice); p.hline(x + 2, x + w - 2, y, K.snow); p.vline(x + w - 1, y + 1, y + h, 0x8fb0c0); }
    ridge(p, noisy(60, 3, 0.1, 6), 0x24262c, 0x3a3c44);
    for (let i = 0; i < 30; i++) p.set(Math.floor(r() * PW), 61 + Math.floor(r() * 11), 0x3a3c44);
    // a turf cottage with a lit window
    p.rect(92, 56, 14, 6, K.oat); p.poly([[90, 56], [108, 56], [104, 50], [94, 50]], K.fern); p.hline(94, 104, 50, K.moss);
    window(p, 96, 58, 2, 2); p.rect(101, 58, 2, 4, K.woodDark);
    // a puffin on a rock
    p.rect(20, 64, 6, 4, K.stoneDark); p.rect(22, 60, 3, 4, K.ink); p.set(22, 61, K.snow); p.set(25, 61, K.terra); p.set(26, 61, K.honey); p.set(23, 63, K.snow);
  },
  machupicchu(p, r) {
    sky(p, [K.night, K.night2, K.slate, K.dusk, K.lake], 0, 40);
    stars(p, 20, r, 20);
    // Huayna Picchu, the sugarloaf peak behind
    ridge(p, (x) => 8 + Math.pow(Math.abs(x - 78) / 14, 1.6) * 6, 0x3f5a3b, K.leaf);
    ridge(p, noisy(30, 10, 0.04, 2), 0x46604a, K.fern);
    // drifting mist
    for (let y = 26; y < 34; y++) for (let x = 0; x < PW; x++) if (bayer(x, y) < 0.35 - Math.abs(y - 30) * 0.08 && fbm1(x * 0.05, 4) > 0.4) p.set(x, y, K.mist);
    // terraces stepping down, and the stone city
    for (let i = 0; i < 7; i++) { const y = 38 + i * 4, x0 = 4 + i * 6; p.rect(x0, y, 70 - i * 3, 4, i % 2 ? K.moss : K.sage); p.hline(x0, x0 + 69 - i * 3, y + 3, K.stoneDark); }
    for (let i = 0; i < 9; i++) { const x = 70 + i * 5, y = 40 + (i % 3) * 3; p.rect(x, y, 4, 4, K.pebble); p.hline(x, x + 3, y, K.stone); p.poly([[x - 1, y], [x + 5, y], [x + 2, y - 3]], K.terra); }
    ridge(p, noisy(62, 4, 0.06, 7), K.leaf, K.fern);
    // a llama, very proud
    const lx = 26, ly = 66;
    p.rect(lx, ly - 6, 9, 4, K.oat); p.rect(lx + 7, ly - 12, 2, 6, K.oat); p.rect(lx + 7, ly - 13, 4, 2, K.oat); p.set(lx + 7, ly - 14, K.oat); p.set(lx + 8, ly - 14, K.oat);
    for (const x of [lx, lx + 2, lx + 6, lx + 8]) p.vline(x, ly - 2, ly + 1, K.straw);
    p.set(lx + 10, ly - 13, K.ink); p.hline(lx + 1, lx + 8, ly - 6, K.vermilion); p.set(lx + 4, ly - 6, K.honey);
  },
  amazon(p, r) {
    sky(p, [K.deep, K.deepNight, K.night, 0x2c3c44, 0x34484c], 0, 36);
    stars(p, 30, r, 26);
    moon(p, 30, 10, 4);
    // the canopy in billows
    for (const [base, c, e] of [[30, 0x263a2e, 0x31483a], [36, 0x2c4434, 0x3a5640]] as [number, C, C][]) {
      for (let x = 0; x < PW; x++) { const t = Math.round(base - Math.abs(Math.sin(x * 0.18 + base)) * 6 - fbm1(x * 0.1, base) * 4); for (let y = t; y < 46; y++) p.set(x, y, c); p.set(x, t, e); }
    }
    // the wide river
    reflect(p, 46, PH, 0x2e4046, 0.55);
    ripples(p, 48, 71, K.dusk, r, 20);
    // giant lily pads
    for (const [x, y, w] of [[18, 60, 9], [44, 66, 11], [80, 58, 7], [100, 66, 10]]) { p.ellipse(x, y, w, w * 0.3, K.fern); p.hline(x - w + 1, x + w - 1, Math.round(y - w * 0.3), K.moss); p.set(x + w, y, 0x2e4046); p.set(x + w - 1, y, 0x2e4046); }
    p.rect(44, 62, 2, 3, K.blush); p.set(45, 61, K.snow);
    fireflies(p, r, 26, 30, 56);
    // a toucan on a branch
    p.line(92, 34, 118, 30, K.woodDark);
    p.rect(104, 25, 4, 6, K.ink); p.rect(104, 24, 3, 2, K.ink); p.set(105, 26, K.lampHi); p.rect(104, 27, 2, 2, K.lamp);
    p.rect(98, 24, 6, 2, K.terra); p.hline(98, 103, 24, K.honey); p.set(98, 25, K.ink);
  },
  serengeti(p, r) {
    sky(p, [K.night, K.plum, K.berry, K.terra, K.honey], 0, 50);
    p.disc(70, 34, 13, K.lamp); p.disc(70, 34, 12, 0xf0c890); for (let i = 0; i < 10; i++) p.set(64 + Math.floor(r() * 12), 28 + Math.floor(r() * 12), K.honey);
    stars(p, 10, r, 16);
    // golden grass plain
    ridge(p, noisy(50, 3, 0.05, 2), 0x5a4a3a, 0x6a5848);
    ridge(p, () => 56, 0x7a6448, 0x8a7254);
    for (let i = 0; i < 120; i++) { const x = Math.floor(r() * PW), y = 56 + Math.floor(r() * 16); p.vline(x, y - 1, y, r() < 0.5 ? K.ochre : 0x9a7a50); }
    // acacia silhouettes
    const acacia = (x: number, base: number, s: number) => { p.vline(x, base - s * 8, base, K.ink); p.line(x, base - s * 6, x - s * 4, base - s * 9, K.ink); p.line(x, base - s * 6, x + s * 4, base - s * 9, K.ink); p.ellipse(x, base - s * 10, s * 9, s * 1.6, K.ink); };
    acacia(22, 54, 1.3); acacia(104, 52, 1); acacia(50, 50, 0.6);
    // giraffes against the moon
    const giraffe = (x: number, base: number) => {
      p.rect(x, base - 10, 8, 4, K.ink); p.line(x + 7, base - 10, x + 11, base - 22, K.ink); p.line(x + 8, base - 10, x + 12, base - 22, K.ink);
      p.rect(x + 11, base - 24, 4, 2, K.ink); p.set(x + 12, base - 25, K.ink);
      for (const lx of [x, x + 2, x + 6, x + 7]) p.vline(lx, base - 6, base, K.ink);
    };
    giraffe(58, 56); giraffe(78, 55);
  },
  banff(p, r) {
    sky(p, NIGHT, 0, 40);
    stars(p, 44, r, 30);
    // snowy peaks
    const peaks = (x: number) => 14 + Math.abs(((x + 10) % 34) - 17) * 1.2 + fbm1(x * 0.12, 2) * 3;
    ridge(p, peaks, 0x3e4a5c, K.snow, 44);
    for (let x = 0; x < PW; x++) for (let y = 0; y < 44; y++) if (p.get(x, y) === 0x3e4a5c && y < peaks(x) + 6 && bayer(x, y) < 0.6) p.set(x, y, K.frost);
    // pine forest
    for (let i = 0; i < 26; i++) { const x = i * 5 + Math.floor(r() * 3); pine(p, x, 46, 8 + Math.floor(r() * 6), 0x223a30, 0x2f4a3c); }
    // the turquoise lake under the moon
    p.rect(0, 46, PW, 26, 0x3f7a7a);
    reflect(p, 46, PH, 0x356a6e, 0.45);
    ripples(p, 48, 71, 0x8fc0b8, r, 18);
    // a red canoe at the dock
    p.rect(70, 60, 50, 2, K.woodDark); for (let x = 72; x < 120; x += 6) p.vline(x, 62, 66, K.woodDeep);
    p.poly([[48, 62], [70, 62], [74, 59], [66, 64], [52, 64], [44, 59]], 0xa84a3e); p.hline(48, 70, 62, 0xc86a5a); p.line(56, 61, 62, 57, K.wood);
  },
  petra(p, r) {
    sky(p, [K.deep, K.deepNight, K.night, K.night2], 0, 20);
    stars(p, 14, r, 12);
    // the Siq walls, rose-red, closing in
    for (let x = 0; x < PW; x++) {
      const l = 22 + Math.sin(x * 0.08) * 4 + fbm1(x * 0.1, 3) * 5;
      for (let y = 0; y < PH; y++) {
        const inGap = x > 30 + Math.sin(y * 0.15) * 3 && x < 92 + Math.sin(y * 0.12 + 1) * 3;
        if (!inGap || y > 64) { const band = Math.floor((y + fbm1(x * 0.3, 9) * 3) / 4) % 3; p.set(x, y, [0x9a5a4a, 0xb06a56, 0x8a4e44][band]); }
      }
      void l;
    }
    // the Treasury facade glowing in candlelight
    const fx = 61;
    p.rect(fx - 24, 14, 48, 50, 0xd0907a);
    for (const dx of [-20, -12, 10, 18]) { p.rect(fx + dx, 40, 3, 24, 0xe0a48c); p.vline(fx + dx + 2, 40, 63, 0xb07060); }
    p.rect(fx - 22, 36, 44, 4, 0xe0a48c); p.poly([[fx - 22, 36], [fx + 22, 36], [fx, 28]], 0xd8987e); p.line(fx - 22, 36, fx, 28, 0xf0b89c); p.line(fx, 28, fx + 22, 36, 0xb07060);
    p.rect(fx - 4, 16, 8, 12, 0xe0a48c); p.poly([[fx - 6, 16], [fx + 6, 16], [fx, 12]], 0xd8987e);
    for (const dx of [-16, 12]) { p.rect(fx + dx, 16, 6, 12, 0xd8987e); p.poly([[fx + dx - 1, 16], [fx + dx + 7, 16], [fx + dx + 3, 13]], 0xc88870); }
    p.rect(fx - 4, 46, 8, 18, 0x4a2a2a); p.rect(fx - 3, 47, 6, 17, 0x5a3030);
    // candles in rows on the ground
    ridge(p, () => 64, 0x7a4a3e, 0x9a5a4a);
    for (let i = 0; i < 40; i++) { const x = 30 + Math.floor(r() * 62), y = 64 + Math.floor(r() * 8); p.set(x, y, K.lampHi); p.set(x, y - 1, K.lamp); p.set(x, y + 1, 0xe0b880); }
    for (let x = 30; x < 92; x++) for (let y = 40; y < 64; y++) if (bayer(x, y) < 0.08 && p.get(x, y) !== -1) p.set(x, y, 0xf0c098);
  },
  angkor(p, r) {
    sky(p, [K.night2, K.dusk, K.lilac, K.rose, K.lamp], 0, 44);
    p.disc(60, 40, 7, K.lampHi);
    stars(p, 8, r, 10);
    // the five lotus towers
    const tower = (x: number, base: number, h: number, w: number) => {
      for (let j = 0; j < h; j++) { const t = j / h, hw = Math.round(w * (1 - t * t * 0.85)); p.hline(x - hw, x + hw, base - j, 0x4a4050); if (j % 3 === 0) p.hline(x - hw, x + hw, base - j, 0x5a5060); }
      p.set(x, base - h, 0x5a5060);
    };
    p.rect(20, 38, 80, 6, 0x4a4050); p.hline(20, 99, 37, 0x5a5060);
    tower(60, 38, 26, 7); tower(42, 38, 18, 5); tower(78, 38, 18, 5); tower(28, 38, 12, 4); tower(92, 38, 12, 4);
    palm(p, 8, 44, 16, 0x34303a, 0x34303a); palm(p, 112, 44, 14, 0x34303a, 0x34303a); palm(p, 104, 44, 10, 0x34303a, 0x34303a);
    ridge(p, () => 44, 0x3a3640, 0x4a4450);
    // the moat mirrors it all
    reflect(p, 45, 64, 0x4a5870, 0.4);
    ripples(p, 46, 63, K.rose, r, 14);
    ridge(p, noisy(66, 2, 0.1, 3), 0x2c3a2c, K.leaf);
    for (const x of [16, 36, 90]) { p.ellipse(x, 58, 4, 1, K.fern); p.set(x, 56, K.blush); p.set(x, 55, K.rose); }
  },
  reef(p, r) {
    // above: a moonlit sea and a sandy cay; below: the coral garden
    sky(p, [K.deepNight, K.night, K.night2, K.slate], 0, 28);
    stars(p, 22, r, 20);
    moon(p, 98, 9, 4);
    p.ellipse(32, 28, 16, 3, K.sand); p.hline(20, 44, 26, K.oat); palm(p, 30, 26, 12, K.pine, K.woodDark);
    p.rect(0, 28, PW, 1, K.lake);
    for (let y = 29; y < PH; y++) { const t = (y - 29) / (PH - 29); for (let x = 0; x < PW; x++) p.set(x, y, bayer(x, y) < t * 1.2 - 0.2 ? 0x26404e : t < 0.3 ? 0x3f7a86 : 0x2f5a68); }
    // light shafts from the moon
    for (let i = 0; i < 4; i++) { const x0 = 70 + i * 10; for (let y = 29; y < 60; y++) if (bayer(x0 + (y - 29) / 3, y) < 0.18) p.set(x0 + (y - 29) / 3, y, 0x6aa0a8); }
    // corals: branching, brain and fan
    const branch = (x: number, base: number, c: C, h: number) => { for (let k = 0; k < 5; k++) { let cx = x, cy = base; for (let j = 0; j < h; j++) { cx += Math.round((hash(k, j, x) - 0.5) * 2); cy--; p.set(cx + k - 2, cy, c); } } };
    ridge(p, noisy(64, 4, 0.06, 4), 0xc8b890, K.oat);
    branch(16, 64, K.rose, 10); branch(52, 66, K.honey, 8); branch(96, 64, K.lilac, 12); branch(110, 66, K.terra, 7);
    p.ellipse(34, 63, 6, 4, K.berry); for (let x = 28; x < 41; x += 2) p.vline(x, 60, 66, mix(K.berry, K.plum, 0.5));
    p.ellipse(78, 64, 5, 3, K.sage); p.hline(74, 82, 62, K.sage);
    for (let i = 0; i < 6; i++) { const x = 64 + i * 2; p.vline(x, 54 + (i % 3), 66, K.plum); }
    // a turtle gliding past, and a clownfish
    p.ellipse(60, 42, 7, 4, 0x5a7a4a); p.ellipse(60, 41, 5, 2, 0x7a9a5a); p.rect(67, 40, 3, 3, 0x7a9a5a); p.set(69, 41, K.ink);
    p.line(55, 45, 51, 48, 0x5a7a4a); p.line(64, 45, 68, 48, 0x5a7a4a); p.line(55, 38, 51, 36, 0x5a7a4a);
    p.rect(88, 50, 4, 2, K.terra); p.vline(89, 50, 51, K.snow); p.set(87, 50, K.terra); p.set(86, 51, K.terra);
    for (let i = 0; i < 12; i++) p.set(10 + Math.floor(r() * 100), 32 + Math.floor(r() * 26), K.mist);
  },
  rio(p, r) {
    sky(p, [K.deepNight, K.night, K.night2, K.plum, K.berry], 0, 50);
    stars(p, 26, r, 30);
    // Sugarloaf and the bay
    ridge(p, (x) => 50 - Math.max(0, 30 - Math.pow(Math.abs(x - 84) / 9, 2) * 4) - Math.max(0, 10 - Math.pow(Math.abs(x - 104) / 6, 2) * 2), 0x2c3a3a, 0x3c4e48, 54);
    ridge(p, (x) => 30 + Math.abs(x - 22) * 0.5, 0x253232, 0x344642, 54);
    // the statue with open arms on the far peak, softly lit
    p.vline(22, 22, 29, K.mist); p.hline(19, 25, 24, K.mist); p.set(22, 21, K.mist); for (let x = 17; x < 28; x++) for (let y = 18; y < 31; y++) if (bayer(x, y) < 0.08 && p.get(x, y) !== K.mist) p.set(x, y, K.lilac);
    // cable car
    p.line(60, 40, 84, 21, K.stone); p.line(84, 21, 104, 40, K.stone); p.rect(71, 31, 3, 2, K.lamp);
    // city lights along the shore and the beach
    for (let i = 0; i < 80; i++) { const x = Math.floor(r() * PW), y = 50 + Math.floor(r() * 4); p.set(x, y, r() < 0.5 ? K.lamp : K.honey); }
    ridge(p, () => 54, 0x2a2e3a, 0x3a3e4a, 56);
    reflect(p, 56, 66, 0x2a3848, 0.5);
    ripples(p, 57, 65, K.honey, r, 16);
    ridge(p, (x) => 66 - Math.sin(x * 0.03) * 2, K.sand, K.oat);
    for (let i = 0; i < 20; i++) p.set(Math.floor(r() * PW), 68 + Math.floor(r() * 4), K.sandDk);
    palm(p, 10, 70, 14, K.pine, K.woodDark); palm(p, 112, 70, 12, K.pine, K.woodDark);
  },
  milford(p, r) {
    sky(p, NIGHT, 0, 40);
    stars(p, 36, r, 24);
    // Mitre Peak and the fiord walls
    ridge(p, (x) => 6 + Math.pow(Math.abs(x - 64) / 10, 1.5) * 5, 0x34404e, 0x46566a, 46);
    for (let x = 0; x < PW; x++) for (let y = 0; y < 46; y++) if (p.get(x, y) === 0x34404e && y < 14 + Math.abs(x - 64) * 0.6 && bayer(x, y) < 0.45) p.set(x, y, K.ice);
    ridge(p, (x) => (x < 36 ? 16 + x * 0.6 : 999), 0x2a3440, 0x3a4656, 46);
    ridge(p, (x) => (x > 92 ? 20 + (120 - x) * 0.5 : 999), 0x2a3440, 0x3a4656, 46);
    // a waterfall from the clouds
    for (let y = 12; y < 46; y++) { const x = 100 + Math.round(Math.sin(y * 0.4)); p.vline(x, y, y, K.mist); if (y % 2) p.set(x + 1, y, K.frost); }
    for (let i = 0; i < 12; i++) p.set(96 + Math.floor(r() * 9), 42 + Math.floor(r() * 4), K.snow);
    for (let y = 16; y < 22; y++) for (let x = 70; x < 120; x++) if (bayer(x, y) < 0.25 && fbm1(x * 0.06, 5) > 0.45) p.set(x, y, K.lavender);
    reflect(p, 46, PH, 0x22303c, 0.5);
    ripples(p, 48, 71, K.dusk, r, 14);
    // glow-worms in the cliff, and a kiwi on the shore
    for (let i = 0; i < 26; i++) { const x = r() < 0.5 ? Math.floor(r() * 30) : 96 + Math.floor(r() * 24); p.set(x, 30 + Math.floor(r() * 14), 0x9fe0d0); }
    p.rect(0, 64, 26, 8, 0x2a2e26); p.ellipse(12, 61, 4, 3, K.woodDark); p.line(15, 61, 20, 64, K.straw); p.vline(11, 63, 64, K.straw);
  },
  antarctica(p, r) {
    sky(p, [K.deep, K.deepNight, K.night, 0x34405a, 0x46506a], 0, 44);
    stars(p, 40, r, 36);
    aurora(p, r, 8, [0xe8b4c0, 0xc08aa8, 0x6fae9a]);
    // tabular icebergs and the frozen sea
    ridge(p, (x) => (x > 14 && x < 50 ? 30 : x > 70 && x < 112 ? 26 + (x > 96 ? (x - 96) * 0.6 : 0) : 999), K.ice, K.snow, 44);
    for (let x = 0; x < PW; x++) for (let y = 20; y < 44; y++) if (p.get(x, y) === K.ice && (x === 49 || x === 111 || y % 5 === 0) && bayer(x, y) < 0.5) p.set(x, y, 0x8fb0c0);
    reflect(p, 44, 54, 0x26364a, 0.45);
    ridge(p, noisy(56, 2, 0.06, 4), K.frost, K.snow);
    for (let i = 0; i < 40; i++) p.set(Math.floor(r() * PW), 58 + Math.floor(r() * 14), K.ice);
    // emperor penguins and a fluffy chick
    const peng = (x: number, base: number, s = 1) => {
      p.rect(x, base - 9 * s, 4 * s, 9 * s, K.ink); p.rect(x + 1, base - 7 * s, 2 * s, 6 * s, K.snow); p.set(x + 1, base - 8 * s, K.honey); p.set(x + 4 * s, base - 8 * s, K.terra);
      p.hline(x, x + 3 * s, base, K.ochre);
    };
    peng(30, 64); peng(38, 66); peng(86, 63); peng(94, 65);
    p.rect(43, 61, 4, 5, K.pebble); p.rect(44, 60, 2, 2, K.ink); p.set(44, 62, K.snow);
  },
};

const cache = new Map<string, string>();
/** The postcard illustration for a place as a data URL, `scale` device px per art pixel. */
export function postcardArt(id: string, scale: number): string {
  const key = id + ':' + scale;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = new Pix(PW, PH);
  (SCENES[id] ?? SCENES.highlands)(p, rng(id.length * 31 + id.charCodeAt(0)));
  for (let i = 0; i < p.data.length; i++) if (p.data[i] === -1) p.data[i] = K.night;
  const url = p.url(scale);
  cache.set(key, url);
  return url;
}
export const SCENE_IDS = Object.keys(SCENES);
