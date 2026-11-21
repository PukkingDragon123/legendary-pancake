// Hoot Hollow's palette: "Moss & Moonlight". Calm, natural, a little faded, like a picture book
// printed on warm paper. Everything (3D models, pixel UI, particles, sky) should draw from these so
// the whole game reads as one hand-painted world. Values are sRGB hex. See docs/ART-STYLE.md.

export const P = {
  // ink and paper
  ink: 0x2e2b24, ink2: 0x4b463a, ink3: 0x6f6856,
  paper: 0xf4eedd, oat: 0xeae0c8, linen: 0xdccfb0, straw: 0xc9b78d,

  // wood (warm but muted, never orange)
  woodPale: 0xd8bf98, woodLight: 0xbf9d74, wood: 0x9c7a56, woodDark: 0x6f553d, woodDeep: 0x4a392b, bark: 0x5b4a3c, barkDark: 0x3d3229,

  // greens: sage to pine
  sageLight: 0xc4cfa3, sage: 0xa7b788, moss: 0x86a06a, fern: 0x66844f, leaf: 0x557343, pine: 0x3f5a3b, forest: 0x2c4030,

  // sky, water, dusk
  mist: 0xd3e0dc, sky: 0xaec8cc, lake: 0x86a9b0, dusk: 0x617f8c, slate: 0x46596a, night: 0x27313f, deepNight: 0x1b222d,

  // warm accents (use sparingly)
  lamp: 0xf1d39a, honey: 0xdcb072, ochre: 0xc59a52, terracotta: 0xc0866a, clay: 0xa66c55,
  rose: 0xd9aca4, blush: 0xe8b4ae, berry: 0x9e5f66, plum: 0x6e5266,

  // cool accents
  lilac: 0xb4a9c9, lavender: 0xd3cce0, frost: 0xdfe9ea, snow: 0xf5f7f2, ice: 0xbcd6dc,

  // stone and metal
  pebble: 0xb9b2a4, stone: 0x908a7e, stoneDark: 0x6a655c, brass: 0xc8a764, brassDark: 0x8e7440, iron: 0x5c5a56,

  // owl plumage helpers
  cream: 0xf1e6cc, buff: 0xd9bf93, tawny: 0xa87652, russet: 0x8a5a3c, umber: 0x5e4130, soot: 0x3a3029,
  eye: 0x231f1b,
} as const;
export type PaletteKey = keyof typeof P;

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** Lighten (f > 1) or darken (f < 1) a colour. */
export function shade(c: number, f: number): number {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}
/** Mix two colours (t = 0 -> a, 1 -> b). */
export function mixc(a: number, b: number, t: number): number {
  const ch = (h: number, s: number) => (h >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}
/** Shadows lean cool (towards slate), highlights lean warm (towards lamp): hand-painted shading. */
export const shadow = (c: number, k = 0.3) => mixc(shade(c, 1 - k * 0.6), P.slate, k * 0.35);
export const light = (c: number, k = 0.3) => mixc(shade(c, 1 + k * 0.35), P.lamp, k * 0.3);

/** CSS custom properties for the UI (injected once by the UI). */
export const CSS_TOKENS = `
:root{
  --ink:${hex(P.ink)};--ink-2:${hex(P.ink2)};--ink-3:${hex(P.ink3)};
  --paper:${hex(P.paper)};--oat:${hex(P.oat)};--linen:${hex(P.linen)};--straw:${hex(P.straw)};
  --wood-pale:${hex(P.woodPale)};--wood-light:${hex(P.woodLight)};--wood:${hex(P.wood)};--wood-dark:${hex(P.woodDark)};--wood-deep:${hex(P.woodDeep)};
  --sage-light:${hex(P.sageLight)};--sage:${hex(P.sage)};--moss:${hex(P.moss)};--fern:${hex(P.fern)};--pine:${hex(P.pine)};--forest:${hex(P.forest)};
  --mist:${hex(P.mist)};--sky:${hex(P.sky)};--lake:${hex(P.lake)};--dusk:${hex(P.dusk)};--slate:${hex(P.slate)};--night:${hex(P.night)};--deep-night:${hex(P.deepNight)};
  --lamp:${hex(P.lamp)};--honey:${hex(P.honey)};--ochre:${hex(P.ochre)};--terracotta:${hex(P.terracotta)};--rose:${hex(P.rose)};--berry:${hex(P.berry)};--plum:${hex(P.plum)};
  --lilac:${hex(P.lilac)};--frost:${hex(P.frost)};--snow:${hex(P.snow)};--ice:${hex(P.ice)};--brass:${hex(P.brass)};
}`;
