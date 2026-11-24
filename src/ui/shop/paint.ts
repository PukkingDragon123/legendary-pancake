// Painted art for the lodge store's UI: the series banner backdrops (printed on the cloth banners in the lodge)
// (Frostlight: an evening of first snow over a pine wood, a gingerbread cottage with lamplit windows,
// garlands and baubles; Starfall: a dusky plum sky of falling stars over cloud banks and a little
// observatory), the night sky of the wish cinematic, big 3D portraits of the featured owls, finish
// swatches, and prize thumbnails with a fallback. Pixel art only: stepped bands, pixel discs and
// stepped halo rings, never a smooth gradient or a soft glow.
import * as THREE from 'three';
import { FINISH } from '../../assets/registry.ts';
import { rng, strSeed } from '../../gfx/noise.ts';
import { buildOwl, owlReady, type OwlLook } from '../../owl/model.ts';
import { PIECE, piecesReady } from '../../owl/outfits.ts';
import { SPECIAL_SKIN } from '../../owl/skins.ts';
import { SPECIES_BY_ID } from '../../owl/species.ts';
import type { RewardKind, Series } from '../../game/series.ts';
import { ITEMS } from '../../assets/registry.ts';
import { iconVersion, itemIcon, owlFull, pieceIcon } from '../portraits.ts';

// ------------------------------------------------------------------ a pixel canvas

type RGB = [number, number, number];
const hx = (s: string): RGB => { const n = parseInt(s.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x: number, y: number) => BAYER[((y & 3) * 4) + (x & 3)];

// the palette (src/gfx/palette.ts) as CSS hex
const K = {
  ink: '#2e2b24', ink2: '#4b463a', paper: '#f4eedd', oat: '#eae0c8', linen: '#dccfb0',
  woodPale: '#d8bf98', woodLight: '#bf9d74', wood: '#9c7a56', woodDark: '#6f553d', woodDeep: '#4a392b', bark: '#5b4a3c', barkDark: '#3d3229',
  sageLight: '#c4cfa3', sage: '#a7b788', moss: '#86a06a', fern: '#66844f', leaf: '#557343', pine: '#3f5a3b', forest: '#2c4030',
  mist: '#d3e0dc', sky: '#aec8cc', lake: '#86a9b0', dusk: '#617f8c', slate: '#46596a', night: '#27313f', deepNight: '#1b222d',
  lamp: '#f1d39a', honey: '#dcb072', ochre: '#c59a52', terracotta: '#c0866a', clay: '#a66c55',
  rose: '#d9aca4', blush: '#e8b4ae', berry: '#9e5f66', plum: '#6e5266', plumDeep: '#3f3144', plumNight: '#2a2130',
  lilac: '#b4a9c9', lavender: '#d3cce0', frost: '#dfe9ea', snow: '#f5f7f2', ice: '#bcd6dc', brass: '#c8a764', brassDark: '#8e7440',
};

class Pix {
  d: Uint8ClampedArray<ArrayBuffer>;
  constructor(public w: number, public h: number) { this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4)); }
  set(x: number, y: number, c: RGB | string, a = 1) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const k = typeof c === 'string' ? hx(c) : c, i = (y * this.w + x) * 4;
    if (a >= 1) { this.d[i] = k[0]; this.d[i + 1] = k[1]; this.d[i + 2] = k[2]; this.d[i + 3] = 255; return; }
    for (let j = 0; j < 3; j++) this.d[i + j] = this.d[i + j] * (1 - a) + k[j] * a;
    this.d[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB | string, a = 1) { for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) this.set(i, j, c, a); }
  /** vertical bands between colour stops, ordered-dithered at each step */
  grad(y0: number, y1: number, stops: string[]) {
    const cs = stops.map(hx), n = cs.length - 1;
    for (let y = Math.floor(y0); y < y1; y++) for (let x = 0; x < this.w; x++) {
      const t = Math.max(0, Math.min(0.9999, (y - y0) / (y1 - y0))) * n, i = Math.floor(t), f = t - i;
      this.set(x, y, f > bay(x, y) ? cs[Math.min(n, i + 1)] : cs[i]);
    }
  }
  /** a stepped pixel disc */
  circle(cx: number, cy: number, r: number, c: RGB | string, a = 1) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c, a); }
  /** a pixel halo: two hard rings at fixed alpha and a checkerboard fringe, never a smooth falloff */
  halo(cx: number, cy: number, r: number, c: string, a = 0.3) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
      if (d > 1) continue;
      if (d < 0.45) this.set(x, y, c, a);
      else if (d < 0.75) this.set(x, y, c, a * 0.55);
      else if ((x + y) % 2 === 0) this.set(x, y, c, a * 0.4);
    }
  }
  /** a pine tree: stacked tiers with snow on each ledge; baubles and a star optional */
  pine(cx: number, base: number, h: number, col: string, dark: string, snow: string, o: { baubles?: string[]; seed?: number; star?: boolean } = {}) {
    const tiers = Math.max(2, Math.round(h / 7)), r = rng(o.seed ?? 1);
    this.rect(cx - Math.max(1, h / 18), base - h * 0.12, Math.max(2, h / 9), h * 0.12 + 1, K.barkDark);
    for (let k = 0; k < tiers; k++) {
      const top = base - h + (k * h * 0.8) / tiers, bot = top + (h * 1.05) / tiers + h * 0.12, half = ((k + 1.4) / (tiers + 0.4)) * h * 0.34;
      for (let y = Math.floor(top); y < bot; y++) {
        const w = ((y - top) / (bot - top)) * half;
        for (let x = Math.floor(cx - w); x <= cx + w; x++) {
          const edge = y >= bot - 1.5 && r() < 0.8;
          this.set(x, y, edge ? snow : x < cx - w * 0.15 ? col : (x + y) % 5 === 0 ? col : dark);
        }
        if (y < top + 2) this.set(cx, y, snow);
      }
      if (o.baubles) for (let i = 0; i < 2 + k; i++) { const bx = cx + (r() - 0.5) * half * 1.6, by = bot - 2 - r() * 3; const c = o.baubles[Math.floor(r() * o.baubles.length)]; this.set(bx, by, c); this.set(bx + 1, by, c); this.set(bx, by + 1, c); this.set(bx + 1, by + 1, c); this.set(bx, by, K.snow, 0.5); }
    }
    if (o.star) { const y = base - h - 2; this.halo(cx, y, 6, K.lamp, 0.35); this.set(cx, y - 1, K.paper); this.set(cx - 1, y, K.honey); this.set(cx, y, '#fffaee'); this.set(cx + 1, y, K.honey); this.set(cx, y + 1, K.honey); }
  }
  url(): string {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c.toDataURL('image/png');
  }
}

// ------------------------------------------------------------------ banner backdrops

/** The calm-palette colours a series is shown in (light, mid, dark, accent). */
export function seriesColors(s: Series): [string, string, string, string] {
  if (s.motif === 'stars') return [K.paper, K.lavender, K.plumDeep, K.lamp];
  return [K.snow, K.sky, '#27404c', K.berry];
}

function frostlight(w: number, h: number): Pix {
  const p = new Pix(w, h), r = rng(strSeed('frostlight' + w + 'x' + h));
  const hor = h * 0.62;
  p.grad(0, hor + 4, [K.deepNight, K.night, K.slate, K.dusk, K.lake, K.sky]);
  for (let i = 0; i < w * h * 0.012; i++) { const x = r() * w, y = r() * hor * 0.8; p.set(x, y, r() < 0.2 ? K.lamp : K.frost, 0.5 + r() * 0.5); }
  for (let i = 0; i < 6; i++) { const x = r() * w, y = r() * hor * 0.5; p.set(x, y, K.snow); p.set(x - 1, y, K.ice); p.set(x + 1, y, K.ice); p.set(x, y - 1, K.ice); p.set(x, y + 1, K.ice); }
  // a big pale moon with stepped halo rings
  const mx = w * 0.82, my = h * 0.16, mr = Math.max(5, h * 0.07);
  p.circle(mx, my, mr, K.snow); p.circle(mx + mr * 0.3, my - mr * 0.2, mr * 0.28, K.mist); p.circle(mx - mr * 0.35, my + mr * 0.35, mr * 0.18, K.frost);
  // mountains with snowcaps
  for (let x = 0; x < w; x++) {
    const m = hor - h * 0.2 - Math.abs(((x * 0.9) % (w * 0.42)) - w * 0.21) * 0.55 - Math.sin(x * 0.05) * h * 0.03;
    const high = (hor - h * 0.2 - m) / (w * 0.21 * 0.55);
    for (let y = Math.floor(m); y < hor + 2; y++) p.set(x, y, high > 0.45 && y < m + h * 0.05 * (high - 0.3) + 1 ? (bay(x, y) > 0.3 ? K.frost : K.snow) : (x + y) % 3 ? K.dusk : K.slate);
  }
  // far forest
  for (let x = -4; x < w + 4; x += 4 + r() * 3) p.pine(x, hor + 3, h * (0.1 + r() * 0.06), K.slate, '#3a4a5b', K.sky, { seed: x + 1 });
  // snowy ground with blue shadows
  for (let y = Math.floor(hor); y < h; y++) for (let x = 0; x < w; x++) {
    const hill = hor + Math.sin(x * 0.045) * h * 0.025 + Math.sin(x * 0.13) * h * 0.01;
    if (y >= hill) p.set(x, y, (x * 3 + y * 7) % 23 === 0 ? K.ice : y - hill < 2 ? K.snow : (x + y * 2) % 9 === 0 ? K.ice : Math.sin(x * 0.045 + 1.3) < -0.3 && bay(x, y) > 0.5 ? K.frost : K.snow);
  }
  // the gingerbread cottage: honey walls with icing trim, berry sweets, lamplit windows
  const cx = w * 0.64, cb = hor + h * 0.05, cw = Math.max(18, w * 0.13), ch = cw * 0.55;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) p.set(cx - cw / 2 + x, cb - ch + y, y % 4 === 0 ? K.clay : x % 5 === 0 ? K.terracotta : K.ochre);
  for (let x = 0; x < cw; x += 3) p.set(cx - cw / 2 + x, cb - ch + ch * 0.45, K.snow);
  for (let y = 0; y < ch * 0.8; y++) { const half = cw * 0.62 * (y / (ch * 0.8)); for (let x = -half; x <= half; x++) p.set(cx + x, cb - ch - ch * 0.8 + y, y > ch * 0.8 - 3 || r() < 0.06 ? K.snow : y < 2 ? K.snow : K.frost); }
  for (let x = -cw * 0.6; x <= cw * 0.6; x += 3) p.set(cx + x, cb - ch + 1 + ((x | 0) % 2 ? 1 : 0), K.snow);
  p.rect(cx + cw * 0.22, cb - ch - ch * 0.7, cw * 0.1, ch * 0.5, K.clay); p.rect(cx + cw * 0.2, cb - ch - ch * 0.75, cw * 0.14, 2, K.snow);
  for (const wx of [-0.3, 0.18]) { const x0 = cx + wx * cw, y0 = cb - ch * 0.75; p.rect(x0, y0, cw * 0.16, ch * 0.38, K.lamp); p.rect(x0 + cw * 0.075, y0, 1, ch * 0.38, K.woodDark); p.rect(x0, y0 + ch * 0.18, cw * 0.16, 1, K.woodDark); p.rect(x0 - 1, y0 - 1, cw * 0.16 + 2, 1, K.snow); }
  p.rect(cx - cw * 0.06, cb - ch * 0.62, cw * 0.12, ch * 0.62, K.woodDeep); p.set(cx + cw * 0.03, cb - ch * 0.3, K.brass);
  for (const sx of [-0.4, -0.12, 0.36]) { const x = cx + sx * cw, y = cb - ch * 0.2; p.set(x, y, K.berry); p.set(x + 1, y, K.snow); p.set(x, y + 1, K.snow); p.set(x + 1, y + 1, K.berry); }
  // fairy lights along the eaves
  for (let i = 0; i <= 12; i++) { const t = i / 12, x = cx - cw * 0.62 + t * cw * 1.24, y = cb - ch + 2 + Math.sin(t * Math.PI * 3) * 1.2; const c = [K.berry, K.lamp, K.sage, K.ice][i % 4]; p.set(x, y, c); p.set(x, y + 1, c); }
  // smoke from the chimney
  for (let i = 0; i < 6; i++) p.circle(cx + cw * 0.27 + i * 1.6 + Math.sin(i) * 2, cb - ch - ch * 0.8 - i * 3.4, 1.4 + i * 0.4, K.mist, 0.4);
  // near firs with baubles and a star on the tallest
  p.pine(w * 0.08, h + 2, h * 0.55, K.pine, K.forest, K.snow, { baubles: [K.berry, K.honey, K.ice], seed: 3, star: true });
  p.pine(w * 0.2, h + 4, h * 0.38, K.leaf, K.pine, K.snow, { baubles: [K.berry, K.honey], seed: 4 });
  p.pine(w * 0.93, h + 2, h * 0.48, K.pine, K.forest, K.snow, { baubles: [K.berry, K.honey, K.lilac], seed: 5, star: true });
  p.pine(w * 0.46, hor + h * 0.07, h * 0.16, K.leaf, K.pine, K.snow, { baubles: [K.berry], seed: 6 });
  // a pine garland swagged across the top with bows and baubles
  for (let x = 0; x < w; x++) {
    const sag = Math.abs(Math.sin((x / w) * Math.PI * 3)) * h * 0.06;
    for (let k = 0; k < 4; k++) p.set(x, sag + k, (x + k) % 3 === 0 ? K.forest : k === 0 ? K.moss : K.pine);
    if (x % 11 === 0) { const c = [K.berry, K.honey, K.ice, K.snow][(x / 11) % 4]; p.circle(x, sag + 6, 2.2, c); p.set(x - 1, sag + 5, K.snow, 0.7); }
  }
  for (const sx of [0, w]) { const dir = sx ? -1 : 1; for (let i = 0; i < Math.min(w, h) * 0.16; i++) { p.set(sx + dir * (i * 0.55), i * 1.1 + 2, K.berry); p.set(sx + dir * (i * 0.55 + 1), i * 1.1 + 2, K.rose); p.set(sx + dir * (i * 0.55 + 2), i * 1.1 + 2, '#6e3e46'); } }
  // a candy cane in the snow
  const ccx = w * 0.96, ccy = h * 0.9;
  for (let i = 0; i < h * 0.22; i++) { p.set(ccx, ccy - i, Math.floor(i / 2) % 2 ? K.snow : K.berry); p.set(ccx + 1, ccy - i, Math.floor(i / 2) % 2 ? K.frost : '#6e3e46'); }
  for (let i = 0; i < 4; i++) { p.set(ccx + 1 + i, ccy - h * 0.22 - Math.sin((i / 3) * Math.PI) * 2, i % 2 ? K.snow : K.berry); }
  // drifting snow baked in
  for (let i = 0; i < w * h * 0.006; i++) p.set(r() * w, r() * h, K.snow, 0.5 + r() * 0.5);
  return p;
}

function starfall(w: number, h: number): Pix {
  const p = new Pix(w, h), r = rng(strSeed('starfall' + w + 'x' + h));
  p.grad(0, h, [K.deepNight, K.plumNight, K.plumDeep, K.plum, '#93798f', K.lilac, K.lavender]);
  // stepped haze patches
  for (let i = 0; i < w * h * 0.02; i++) { const x = r() * w, y = r() * h * 0.8; p.set(x, y, r() < 0.3 ? K.lamp : K.lavender, 0.4 + r() * 0.6); }
  for (let i = 0; i < 10; i++) { const x = r() * w, y = r() * h * 0.6; p.set(x, y, '#fffaee'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, K.lamp, 0.8); }
  // a big crescent moon
  const mx = w * 0.18, my = h * 0.22, mr = Math.max(6, h * 0.1);
  for (let y = Math.floor(my - mr); y <= my + mr; y++) for (let x = Math.floor(mx - mr); x <= mx + mr; x++) {
    const inMoon = (x + 0.5 - mx) ** 2 + (y + 0.5 - my) ** 2 <= mr * mr, inBite = (x + 0.5 - mx - mr * 0.45) ** 2 + (y + 0.5 - my + mr * 0.3) ** 2 <= (mr * 0.88) ** 2;
    if (inMoon && !inBite) p.set(x, y, (x + y) % 7 === 0 ? K.honey : K.lamp);
  }
  // falling stars: stepped tails, a bright cross head
  for (let i = 0; i < 6; i++) {
    const x0 = w * (0.3 + r() * 0.75), y0 = h * (0.02 + r() * 0.4), len = h * (0.12 + r() * 0.15);
    for (let k = 0; k < len; k++) { const t = 1 - k / len; if (t < 0.4 && k % 2) continue; p.set(x0 + k, y0 - k * 0.55, t > 0.6 ? K.paper : K.lamp, t > 0.3 ? 1 : 0.6); }
    p.set(x0, y0, '#fffaee'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) p.set(x0 + dx, y0 + dy, Math.abs(dx) + Math.abs(dy) > 1 ? K.honey : K.lamp);
  }
  // cloud banks of stepped pixel discs
  for (let layer = 0; layer < 3; layer++) {
    const base = h * (0.72 + layer * 0.1), col = ['#93798f', K.lilac, K.lavender][layer], sh = [K.plum, '#93798f', K.lilac][layer];
    for (let x = -10; x < w + 10; x += 7 + r() * 6) { const rr = h * (0.06 + r() * 0.05) * (1 + layer * 0.3); p.circle(x, base, rr, sh); p.circle(x - 1, base - 1, rr * 0.92, col); }
    p.rect(0, base, w, h - base, col);
  }
  // a little observatory on a cloud
  const ox = w * 0.78, oy = h * 0.74, ow = Math.max(10, w * 0.07);
  p.rect(ox - ow / 2, oy - ow * 0.9, ow, ow * 0.9, K.plumDeep); p.circle(ox, oy - ow * 0.9, ow / 2, K.plum);
  p.rect(ox + ow * 0.05, oy - ow * 1.3, ow * 0.5, 2, K.lavender); p.rect(ox - ow * 0.15, oy - ow * 0.55, ow * 0.3, ow * 0.3, K.lamp);
  // strings of hanging stars along the top
  for (let i = 0; i < 9; i++) {
    const x = (i + 0.5) * (w / 9) + (r() - 0.5) * 6, len = h * (0.06 + r() * 0.16);
    for (let y = 0; y < len; y++) p.set(x, y, K.lavender, 0.5);
    const c = i % 2 ? K.honey : K.lamp, sy = len + 2;
    p.set(x, sy - 2, c); p.rect(x - 2, sy - 1, 5, 1, c); p.rect(x - 1, sy, 3, 1, c); p.set(x - 1, sy + 1, c); p.set(x + 1, sy + 1, c); p.set(x, sy - 1, '#fffaee');
  }
  return p;
}

/** The night sky of the wish cinematic: dithered dusk, stars, a soft-banded aurora or haze, snowy hills and pines. */
function nightSky(w: number, h: number, motif: 'snow' | 'stars'): Pix {
  const p = new Pix(w, h), r = rng(strSeed('night' + motif + w + 'x' + h));
  p.grad(0, h * 0.86, motif === 'stars' ? [K.deepNight, K.plumNight, K.plumDeep, K.plum, '#93798f'] : [K.deepNight, K.night, '#2b3746', K.slate, K.dusk]);
  if (motif === 'snow') for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) {
    const y0 = h * (0.18 + k * 0.07) + Math.sin(x * 0.05 + k * 2) * h * 0.05 + Math.sin(x * 0.13 + k) * h * 0.015;
    for (let y = Math.floor(y0); y < y0 + h * 0.12; y++) { const f = 1 - (y - y0) / (h * 0.12); if (bay(x, y) < f * 0.55) p.set(x, y, k === 1 ? K.sage : K.lake, 0.22 * f + 0.06); }
  }
  for (let i = 0; i < w * h * 0.01; i++) p.set(r() * w, r() * h * 0.8, r() < 0.2 ? K.lamp : K.frost, 0.3 + r() * 0.7);
  for (let i = 0; i < 14; i++) { const x = r() * w, y = r() * h * 0.6; p.set(x, y, '#fffaee'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, K.ice, 0.7); }
  const hor = h * 0.8;
  for (let x = -4; x < w + 4; x += 3 + r() * 4) p.pine(x, hor + h * 0.04 + Math.sin(x * 0.07) * h * 0.02, h * (0.08 + r() * 0.09), K.forest, K.deepNight, K.dusk, { seed: x + 7 });
  for (let y = Math.floor(hor); y < h; y++) for (let x = 0; x < w; x++) {
    const hill = hor + Math.sin(x * 0.04) * h * 0.03 + Math.sin(x * 0.11 + 2) * h * 0.012;
    if (y >= hill) p.set(x, y, y - hill < 1.5 ? K.frost : (x * 5 + y * 3) % 17 === 0 ? K.sky : K.lake);
  }
  return p;
}
const skyCache = new Map<string, string>();
export function skyArt(motif: 'snow' | 'stars', w: number, h: number): string {
  const key = motif + w + 'x' + h;
  let u = skyCache.get(key);
  if (!u) { u = nightSky(w, h, motif).url(); skyCache.set(key, u); }
  return u;
}

const bannerCache = new Map<string, string>();
/** Painted backdrop for a series banner at w x h art pixels (shown upscaled, pixelated). */
export function bannerArt(s: Series, w: number, h: number): string {
  const key = `${s.id}:${w}x${h}`;
  let u = bannerCache.get(key);
  if (!u) { u = (s.motif === 'stars' ? starfall(w, h) : frostlight(w, h)).url(); bannerCache.set(key, u); }
  return u;
}

// ------------------------------------------------------------------ big 3D portraits

let R: THREE.WebGLRenderer | null = null, scene: THREE.Scene, cam: THREE.OrthographicCamera;
const bigCache = new Map<string, string>();
/** A large render of an owl look (the featured 5-star), lit like a shop window. */
export function bigOwl(look: OwlLook, size = 384): string {
  void iconVersion.value; // re-render the caller when the picture lands
  const key = JSON.stringify(look) + size;
  const hit = bigCache.get(key);
  if (hit !== undefined) return hit;
  if (!bigPending.has(key)) {
    bigPending.add(key);
    // the hand-painted owl and its outfit load as GLBs: shoot only once they are in
    void Promise.all([owlReady(look), piecesReady(look)]).catch(() => undefined).then(() => shootBig(look, size)).then((url) => { bigCache.set(key, url); bigPending.delete(key); iconVersion.value++; });
  }
  return '';
}
const bigPending = new Set<string>();
async function shootBig(look: OwlLook, size: number): Promise<string> {
  let url = '';
  try {
    if (!R) {
      const c = document.createElement('canvas');
      R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
      R.setClearColor(0, 0); R.outputColorSpace = THREE.SRGBColorSpace;
      scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xf4ecd8, 0x5b4a3c, 1.5));
      const k = new THREE.DirectionalLight(0xf6e2b4, 2.0); k.position.set(-3, 6, 7); scene.add(k);
      const rim = new THREE.DirectionalLight(0xaec8cc, 1.2); rim.position.set(5, 3, -4); scene.add(rim);
      cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    }
    const o = buildOwl(look);
    await o.ready;
    R.setSize(size, size, false);
    const root = o.rig.root;
    scene.add(root);
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root), c = b.getCenter(new THREE.Vector3());
    const yaw = 0.42, pitch = 0.12, dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    cam.position.copy(c).addScaledVector(dir, 50); cam.lookAt(c); cam.updateMatrixWorld();
    const half = Math.max(b.max.x - b.min.x, b.max.y - b.min.y) * 0.56;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
    R.render(scene, cam);
    url = R.domElement.toDataURL('image/png');
    scene.remove(root); o.dispose();
  } catch (e) { console.warn('big owl render failed', e); }
  return url;
}

// ------------------------------------------------------------------ swatches and thumbnails

const swatches = new Map<string, string>();
/** A wallpaper / flooring sample tile. */
export function finishSwatch(id: string, n = 48): string {
  const f = FINISH[id];
  if (!f) return '';
  let u = swatches.get(id);
  if (u) return u;
  const p = new Pix(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let c = 0x888888; try { c = f.paint(x, n - 1 - y); } catch { /* */ } p.set(x, y, [(c >> 16) & 255, (c >> 8) & 255, c & 255]); }
  u = p.url();
  swatches.set(id, u);
  return u;
}

/** Thumbnail for anything the store sells or a wish gives; '' when its model has not arrived. */
export function prizeArt(kind: RewardKind | 'species', id: string, look: OwlLook): string {
  if (kind === 'item') return ITEMS[id] ? itemIcon(id) : '';
  if (kind === 'piece') return PIECE[id] ? pieceIcon(id, PIECE[id].slot, { ...look, outfit: {} }) : '';
  if (kind === 'skin') return SPECIAL_SKIN[id] ? owlFull({ skin: id as OwlLook['skin'], species: 'snowy', palette: 'snowy', outfit: {} }) : '';
  if (kind === 'species') return SPECIES_BY_ID[id] ? owlFull({ skin: 'owl', species: id, palette: id, outfit: {} }) : '';
  if (kind === 'finish') return finishSwatch(id);
  return '';
}
/** The look used to show a featured 5-star skin big on the banner. */
export const skinLook = (id: string): OwlLook => ({ skin: id as OwlLook['skin'], species: 'snowy', palette: 'snowy', outfit: {} });
