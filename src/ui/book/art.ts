// The diary in pixel art, in the calm palette: a pebbled brown leather board with stitched,
// tooled edges and brass corners, the front cover (blind-tooled frame, a gilt crescent moon in a
// wreath of leaves), oat-paper pages with fibres, foxing and a stepped gutter shadow, cloth index
// tabs, a ribbon bookmark, square score stamps, mood icons and achievement postage stamps.
// Everything is painted at texel resolution, cached as a data URL and shown with
// `image-rendering: pixelated` at T CSS px per texel. Importing this module never touches the DOM.
import { P } from '../../gfx/palette.ts';

type RGB = [number, number, number];
const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;
const mulc = (c: RGB, f: number): RGB => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f)))) as RGB;
export const hexOf = (c: number) => '#' + c.toString(16).padStart(6, '0');
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x: number, y: number) => BAY[((y & 3) << 2) | (x & 3)];
export function h2(x: number, y: number, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vn(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** cellular noise: distance to the nearest jittered point (pebbled leather) */
function cell(x: number, y: number, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const px = xi + i + h2(xi + i, yi + j, s), py = yi + j + h2(xi + i, yi + j, s + 1);
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}
const pick = (ramp: RGB[], t: number, x: number, y: number, d = 1) => ramp[clamp(Math.floor(t * (ramp.length - 1) + (bay(x, y) - 0.5) * d + 0.5), 0, ramp.length - 1)];

// ------------------------------------------------------------------ texel buffer

export class Px {
  d: Uint8ClampedArray<ArrayBuffer>;
  constructor(public w: number, public h: number) { this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4)); }
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x: number, y: number, c: RGB | number, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.in(x, y)) return this;
    const k = typeof c === 'number' ? rgb(c) : c, i = (y * this.w + x) * 4;
    if (a >= 255 || !this.d[i + 3]) { this.d[i] = k[0]; this.d[i + 1] = k[1]; this.d[i + 2] = k[2]; this.d[i + 3] = a; return this; }
    const t = a / 255;
    for (let j = 0; j < 3; j++) this.d[i + j] = Math.round(this.d[i + j] + (k[j] - this.d[i + j]) * t);
    this.d[i + 3] = Math.max(this.d[i + 3], a);
    return this;
  }
  get(x: number, y: number): RGB | null { if (!this.in(x, y)) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2]] : null; }
  a(x: number, y: number) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  darken(x: number, y: number, f: number, toward = P.slate) { const c = this.get(x, y); if (c) this.set(x, y, mix(mulc(c, 1 - f), rgb(toward), f * 0.35)); }
  rect(x: number, y: number, w: number, h: number, c: RGB | number) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  outline(c: RGB | number) {
    const o: number[] = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.a(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.a(x + dx, y + dy) > 128)) o.push(x, y);
    for (let i = 0; i < o.length; i += 2) this.set(o[i], o[i + 1], c);
    return this;
  }
  url() {
    const cv = document.createElement('canvas');
    cv.width = this.w; cv.height = this.h;
    cv.getContext('2d')!.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return cv.toDataURL();
  }
}
export interface Art { url: string; w: number; h: number }
const CACHE = new Map<string, Art>();
export function art(key: string, paint: () => Px): Art {
  let a = CACHE.get(key);
  if (!a) {
    const p = paint();
    a = { url: p.url(), w: p.w, h: p.h };
    CACHE.set(key, a);
    if (CACHE.size > 300) CACHE.delete(CACHE.keys().next().value!);
  }
  return a;
}

// ------------------------------------------------------------------ ramps

const LEATHER: RGB[] = [mix(rgb(P.barkDark), rgb(P.deepNight), 0.35), rgb(P.barkDark), rgb(P.woodDeep), mix(rgb(P.woodDeep), rgb(P.woodDark), 0.5), rgb(P.woodDark), mix(rgb(P.woodDark), rgb(P.wood), 0.45), mix(rgb(P.wood), rgb(P.woodLight), 0.3)];
const BRASS: RGB[] = [mix(rgb(P.brassDark), rgb(P.woodDeep), 0.45), rgb(P.brassDark), mix(rgb(P.brassDark), rgb(P.brass), 0.5), rgb(P.brass), mix(rgb(P.brass), rgb(P.honey), 0.5), rgb(P.lamp), mix(rgb(P.lamp), rgb(P.snow), 0.5)];
const PAPER: RGB[] = [rgb(P.straw), mix(rgb(P.straw), rgb(P.linen), 0.5), rgb(P.linen), mix(rgb(P.linen), rgb(P.oat), 0.5), rgb(P.oat), mix(rgb(P.oat), rgb(P.paper), 0.5), rgb(P.paper)];
const GILT: RGB = rgb(P.honey), GILT_HI: RGB = rgb(P.lamp), STITCH: RGB = mix(rgb(P.linen), rgb(P.straw), 0.4);

/** pebbled leather at a lit value t (0..1) */
function leather(x: number, y: number, t: number, s = 0) {
  const c = cell(x * 0.42, y * 0.42, s);
  const peb = c < 0.32 ? 0.08 : c > 0.62 ? -0.1 : 0;          // pebble tops catch light, the creases between are dark
  const mott = (vn(x * 0.05, y * 0.05, s + 3) - 0.5) * 0.3;   // broad mottling
  const scuff = vn(x * 0.3, y * 0.08, s + 5) > 0.83 ? 0.12 : 0; // rubbed streaks
  return pick(LEATHER, clamp(t + peb + mott + scuff, 0, 1), x, y, 0.9);
}
const brass = (x: number, y: number, t: number) => pick(BRASS, clamp(t + (h2(x, y, 9) - 0.5) * 0.1, 0, 1), x, y, 0.7);

/** a brass corner protector, `q` = which corner (0 tl, 1 tr, 2 bl, 3 br), n texels long */
function corner(p: Px, x0: number, y0: number, q: number, n: number) {
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (i + j > n - 1) continue;
    const X = q % 2 ? x0 - i : x0 + i, Y = q > 1 ? y0 - j : y0 + j;
    const edge = i + j >= n - 2;
    const lit = (q % 2 ? -1 : 1) * 0.08 + (q > 1 ? -0.12 : 0.08);
    let t = 0.55 + lit - (i + j) / n * 0.25;
    if (edge) t = 0.18;
    if (i === 0 || j === 0) t = q === 0 ? 0.85 : 0.65;
    p.set(X, Y, brass(X, Y, t));
  }
  // rivets
  for (const [ri, rj] of [[2, Math.floor(n * 0.45)], [Math.floor(n * 0.45), 2]]) {
    const X = q % 2 ? x0 - ri : x0 + ri, Y = q > 1 ? y0 - rj : y0 + rj;
    p.set(X, Y, BRASS[6]); p.set(X + 1, Y + 1, BRASS[1]);
  }
}

// ------------------------------------------------------------------ the open book's board

/** The board around the open pages: w x h texels; for a spread, a sunken spine down the middle. */
export function boardArt(w: number, h: number, spread: boolean): Art {
  return art(`board:${w}x${h}:${spread}`, () => {
    const p = new Px(w, h), mid = w / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ex = Math.min(x, w - 1 - x), ey = Math.min(y, h - 1 - y), e = Math.min(ex, ey);
      let t = 0.5 - y / h * 0.12 + (x < w / 2 ? 0.03 : -0.03);
      if (e === 0) t = 0.1; else if (e === 1) t = y < h / 2 && x < w / 2 ? 0.78 : 0.62; else if (e === 2) t = 0.62;
      if (spread) { const ds = Math.abs(x + 0.5 - mid); if (ds < 5) t -= (5 - ds) * 0.07; if (ds < 1) t = 0.05; }
      p.set(x, y, leather(x, y, t, 1));
    }
    // a stitched line all round, 3 texels in
    for (let x = 4; x < w - 4; x++) if ((x >> 1) % 2 === 0) { p.set(x, 3, STITCH); p.set(x, h - 4, mulc(STITCH, 0.85)); }
    for (let y = 4; y < h - 4; y++) if ((y >> 1) % 2 === 0) { p.set(3, y, STITCH); p.set(w - 4, y, mulc(STITCH, 0.85)); }
    const n = Math.min(11, Math.floor(Math.min(w, h) / 6));
    corner(p, 0, 0, 0, n); corner(p, w - 1, 0, 1, n); corner(p, 0, h - 1, 2, n); corner(p, w - 1, h - 1, 3, n);
    return p;
  });
}

// ------------------------------------------------------------------ the front cover

/** The closed front cover (w x h texels): blind-tooled double frame, gilt crescent moon in a leaf wreath, a title plate. */
export function coverArt(w: number, h: number): Art {
  return art(`cover:${w}x${h}`, () => {
    const p = new Px(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      let t = 0.55 - y / h * 0.15 + (vn(x * 0.02, y * 0.02, 4) - 0.5) * 0.15;
      if (e === 0) t = 0.12; else if (e === 1) t = 0.76;
      p.set(x, y, leather(x, y, t, 2));
    }
    // spine hinge groove on the left
    for (let y = 2; y < h - 2; y++) { p.darken(6, y, 0.4); p.darken(7, y, 0.2); p.set(8, y, leather(8, y, 0.72, 2)); }
    // tooled frames: an outer blind line and an inner gilt line with corner leaves
    const frame = (m: number, gilt: boolean) => {
      for (let x = m; x < w - m; x++) for (const y of [m, h - 1 - m]) gilt ? p.set(x, y, (x + y) % 7 === 0 ? GILT_HI : GILT) : p.darken(x, y, 0.35);
      for (let y = m; y < h - m; y++) for (const x of [m + 4, w - 1 - m]) gilt ? p.set(x, y, (x + y) % 7 === 0 ? GILT_HI : GILT) : p.darken(x, y, 0.35);
    };
    frame(6, false); frame(10, true);
    for (const [cx, cy] of [[15, 11], [w - 11, 11], [15, h - 12], [w - 11, h - 12]]) {
      for (const [dx, dy] of [[0, 0], [1, 1], [2, 2], [-1, 1], [1, -1], [2, 1], [1, 2]]) p.set(cx + dx * Math.sign(w / 2 - cx), cy + dy * Math.sign(h / 2 - cy), GILT);
    }
    // the emblem: a gilt crescent moon in a wreath of little leaves (drawn as stepped pixels)
    const ex = Math.round(w / 2 + 2), ey = Math.round(h * 0.4), R = Math.max(9, Math.round(Math.min(w, h) * 0.13));
    for (let y = ey - R; y <= ey + R; y++) for (let x = ex - R; x <= ex + R; x++) {
      const d = Math.hypot(x + 0.5 - ex, y + 0.5 - ey), d2 = Math.hypot(x + 0.5 - ex - R * 0.42, y + 0.5 - ey + R * 0.18);
      if (d < R * 0.62 && d2 > R * 0.5) p.set(x, y, d < R * 0.4 && x < ex ? GILT_HI : GILT);
    }
    // a gilt vine under the moon: a wavy stem with little leaves either side
    const vy = ey + Math.round(R * 0.95);
    for (let x = ex - R; x <= ex + R; x++) {
      const y = vy + Math.round(Math.sin((x - ex) * 0.5) * 1.2);
      p.set(x, y, GILT);
      const k = x - ex + R;
      if (k % 5 === 2 && Math.abs(x - ex) > 1) { const up = k % 10 === 2 ? -1 : 1; p.set(x, y + up, GILT_HI); p.set(x + 1, y + up, GILT); p.set(x + 1, y + up * 2, GILT); }
    }
    p.set(ex, vy - 1, GILT_HI); p.set(ex, vy + 1, GILT); p.set(ex - 1, vy, GILT_HI); p.set(ex + 1, vy, GILT_HI);
    // tiny stars
    for (const [sx, sy] of [[-0.55, -0.7], [0.75, -0.55], [0.6, 0.65]]) { const x = Math.round(ex + sx * R), y = Math.round(ey + sy * R); p.set(x, y, GILT_HI); p.set(x - 1, y, GILT); p.set(x + 1, y, GILT); p.set(x, y - 1, GILT); p.set(x, y + 1, GILT); }
    // a brass title plate (the title is set in the DOM) with a bevel
    const pw = Math.round(w * 0.58), ph = 13, px0 = Math.round(w / 2 + 2 - pw / 2), py0 = Math.round(h * 0.64);
    for (let y = py0; y < py0 + ph; y++) for (let x = px0; x < px0 + pw; x++) {
      const e = Math.min(x - px0, y - py0, px0 + pw - 1 - x, py0 + ph - 1 - y);
      const t = e === 0 ? (y === py0 || x === px0 ? 0.82 : 0.2) : e === 1 ? 0.42 : 0.6 - (y - py0) / ph * 0.15;
      p.set(x, y, brass(x, y, t));
    }
    p.set(px0 + 2, py0 + 2, BRASS[6]); p.set(px0 + pw - 3, py0 + 2, BRASS[6]); p.set(px0 + 2, py0 + ph - 3, BRASS[1]); p.set(px0 + pw - 3, py0 + ph - 3, BRASS[1]);
    const n = Math.min(12, Math.floor(Math.min(w, h) / 6));
    corner(p, w - 1, 0, 1, n); corner(p, w - 1, h - 1, 3, n);
    // a leather strap and brass catch on the right edge
    const sy = Math.round(h * 0.5) - 5;
    for (let y = sy; y < sy + 10; y++) for (let x = w - 14; x < w; x++) p.set(x, y, leather(x, y, y === sy ? 0.8 : y === sy + 9 ? 0.15 : 0.42, 7));
    for (let y = sy + 2; y < sy + 8; y++) for (let x = w - 10; x < w - 4; x++) p.set(x, y, brass(x, y, 0.75 - (x - w + 10) * 0.06 - (y - sy) * 0.05));
    return p;
  });
}

// ------------------------------------------------------------------ paper

/** A page of oat paper: fibres, a few foxing spots, deckled edge shading and a stepped shadow into the gutter. */
export function paperArt(w: number, h: number, side: 'L' | 'R' | 'S', seed = 1): Art {
  return art(`paper:${w}x${h}:${side}:${seed}`, () => {
    const p = new Px(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let t = 0.86 + (vn(x * 0.04, y * 0.04, seed) - 0.5) * 0.12;
      if (h2(x, y, seed + 3) > 0.985) t -= 0.12;                                    // fibres
      if (vn(x * 0.5, y * 0.05, seed + 6) > 0.86) t -= 0.05;                         // laid lines
      const fox = vn(x * 0.12, y * 0.12, seed + 9);
      if (fox > 0.8) t -= (fox - 0.8) * 1.2;                                         // foxing
      // gutter: the paper curves down into the spine in stepped bands
      const g = side === 'R' ? x : side === 'L' ? w - 1 - x : x;
      if (g < 10) t -= ((10 - g) / 10) ** 1.6 * (side === 'S' ? 0.28 : 0.45);
      // page edges
      if (y === 0 || y === h - 1 || x === (side === 'L' ? 0 : w - 1)) t -= 0.25;
      p.set(x, y, pick(PAPER, clamp(t, 0, 1), x, y, 1));
    }
    return p;
  });
}

// ------------------------------------------------------------------ small pieces

export const TAB_COLORS: Record<string, [number, number, number]> = {
  moss: [P.pine, P.moss, P.sage], lake: [P.slate, P.lake, P.sky], berry: [P.plum, P.berry, P.rose], honey: [P.brassDark, P.ochre, P.honey],
};
/** A cloth index tab sticking up from the page (w x h texels), stitched, with a notched top. */
export function tabArt(col: string, w: number, h: number, on: boolean): Art {
  return art(`tab:${col}:${w}x${h}:${on}`, () => {
    const p = new Px(w, h), [d, m, l] = (TAB_COLORS[col] ?? TAB_COLORS.moss).map(rgb);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (y < 2 && (x < 2 - y || x > w - 3 + y)) continue;                         // stepped top corners
      const weave = ((x + y) % 2 === 0 && h2(x, y, 4) > 0.5) ? -0.12 : 0;
      let t = (on ? 0.62 : 0.45) - y / h * 0.3 + weave + (x === 0 ? 0.25 : x === w - 1 ? -0.25 : 0);
      if (y === 0) t = 0.95;
      p.set(x, y, t > 0.6 ? l : t > 0.3 ? m : d);
    }
    for (let x = 2; x < w - 2; x += 2) p.set(x, 2, mix(l, rgb(P.snow), 0.4));     // stitching under the top
    return p;
  });
}

export const SCORE_TINT = (s: number): [number, number] => (s >= 85 ? [P.fern, P.pine] : s >= 70 ? [P.lake, P.slate] : s >= 50 ? [P.ochre, P.brassDark] : [P.terracotta, P.clay]);
export const scoreHex = (s: number) => hexOf(SCORE_TINT(s)[1]);
/** A square ink stamp with notched corners, for a score (n x n texels). */
export function badgeArt(score: number, n: number): Art {
  const [fill, ink] = SCORE_TINT(score);
  return art(`badge:${fill}:${n}`, () => {
    const p = new Px(n, n), f = rgb(fill), k = rgb(ink), hi = mix(f, rgb(P.paper), 0.35);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const e = Math.min(x, y, n - 1 - x, n - 1 - y);
      const notch = (x < 2 || x > n - 3) && (y < 2 || y > n - 3) && !(x === 1 && y === 1) && !(x === n - 2 && y === 1) && !(x === 1 && y === n - 2) && !(x === n - 2 && y === n - 2);
      if (notch) continue;
      let c = e === 0 ? k : e === 1 ? hi : f;
      if (e > 1 && h2(x, y, 7) > 0.9) c = mix(f, rgb(P.paper), 0.2);              // ink not quite even
      p.set(x, y, c);
    }
    return p;
  });
}

const MOOD_ROWS: string[][] = [
  // groggy: a rain cloud
  ['............', '....dddd....', '..ddmmmmdd..', '.dmmllmmmmd.', 'dmmlllmmmmmd', 'dmmmmmmmmmmd', '.dddddddddd.', '..r..r..r...', '.r..r..r....', '............', '..r..r..r...', '............'],
  // meh: a grey cloud
  ['............', '............', '.....ddd....', '...ddmmmd...', '..dmlllmmd..', '.dmllmmmmmd.', 'dmmmmmmmmmmd', 'dmmmmmmmmmmd', '.dddddddddd.', '............', '............', '............'],
  // okay: a leaf
  ['............', '.......ddd..', '.....ddmmd..', '....dmmlmd..', '...dmmlmmd..', '..dmmlmmd...', '..dmlmmd....', '..dlmdd.....', '..dmd.......', '.s..........', 's...........', '............'],
  // good: a sprout with two leaves
  ['............', '..dd....dd..', '.dmmd..dmmd.', '.dmlmddmlmd.', '..dmmmmmmd..', '...ddssdd...', '.....ss.....', '.....ss.....', '....ssss....', '..eeeeeeee..', '.eeeeeeeeee.', '............'],
  // wonderful: a big star
  ['.....dd.....', '.....ll.....', '....dlld....', 'dddddllddddd', '.dllllllmmd.', '..dlllmmmd..', '...dlmmmd...', '..dlmddmmd..', '..dlmd.dmd..', '.dmd....dmd.', '.dd......dd.', '............'],
];
const MOOD_TINT: [number, number, number][] = [[P.slate, P.dusk, P.mist], [P.stoneDark, P.stone, P.pebble], [P.pine, P.fern, P.sage], [P.leaf, P.moss, P.sageLight], [P.brassDark, P.honey, P.lamp]];
export const MOOD_NAMES = ['Groggy', 'Meh', 'Okay', 'Good', 'Wonderful'];
/** Mood icons (12 x 12): rain cloud, cloud, leaf, sprout, star. */
export function moodArt(i: number): Art {
  return art(`mood:${i}`, () => {
    const p = new Px(12, 12), [d, m, l] = MOOD_TINT[i].map(rgb);
    MOOD_ROWS[i].forEach((r, y) => [...r].forEach((ch, x) => {
      const c = ch === 'd' ? d : ch === 'm' ? m : ch === 'l' ? l : ch === 'r' ? rgb(P.lake) : ch === 's' ? rgb(P.fern) : ch === 'e' ? rgb(P.woodDark) : null;
      if (c) p.set(x, y, c);
    }));
    return p;
  });
}

// emblems for the achievement stamps (9 x 9)
const EMB: Record<string, string[]> = {
  heart: ['.........', '.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'],
  moon: ['...xxxx..', '..xxx....', '.xxx.....', '.xxx.....', '.xxx.....', '.xxx.....', '..xxx....', '...xxxx..', '.........'],
  seven: ['xxxxxxxx.', '......xx.', '.....xx..', '....xx...', '...xx....', '...xx....', '..xx.....', '..xx.....', '.........'],
  phases: ['.........', 'xx.x.x.xx', 'x..x.xxxx', 'xx.x.x.xx', '.........', 'x.x.xx.xx', 'xxx.xx..x', 'x.x.xx.xx', '.........'],
  three: ['.xxxxxx..', '......xx.', '......xx.', '..xxxxx..', '......xx.', '......xx.', '.xxxxxx..', '.........', '.........'],
  flame: ['....x....', '...xx....', '...xxx...', '..xxxx.x.', '.xxxxxxx.', '.xxx.xxx.', '.xx...xx.', '..xx.xx..', '...xxx...'],
  eight: ['..xxxx...', '.xx..xx..', '.xx..xx..', '..xxxx...', '.xx..xx..', '.xx..xx..', '..xxxx...', '.........', '.........'],
  star: ['....x....', '....x....', '...xxx...', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '.xxx.xxx.', '.xx...xx.', '.........'],
  sun: ['....x....', '.x..x..x.', '..xxxxx..', '..xxxxx..', 'xxxxxxxxx', '..xxxxx..', '..xxxxx..', '.x..x..x.', '....x....'],
  hush: ['.........', 'xxxx.....', '...x.....', '..x..xxx.', '.x.....x.', 'xxxx..x..', '.....x...', '.....xxx.', '.........'],
  feather: ['......xx.', '.....xxx.', '....xxx..', '...xxx...', '..xxx....', '..xx.....', '.x.......', 'x........', '.........'],
  wind: ['.........', 'xxxxxx...', '......x..', '.xxxxx...', '.........', 'xxxxxxxx.', '........x', '..xxxxxx.', '.........'],
  box: ['.........', 'xxxxxxxxx', 'x...x...x', 'xxxxxxxxx', 'x.......x', 'x...x...x', 'x.......x', 'xxxxxxxxx', '.........'],
  wish: ['....x....', '...x.x...', '....x....', '.........', '.x.....x.', '.........', '...x.x...', '....x....', '.........'],
  face: ['.xxxxxxx.', 'x.......x', 'x.x...x.x', 'x.......x', 'x.x...x.x', 'x..xxx..x', 'x.......x', '.xxxxxxx.', '.........'],
  quill: ['.......xx', '......xxx', '.....xxx.', '....xxx..', '...xxx...', '...xx....', '..x......', '.x.......', 'xxxx.....'],
  compass: ['....x....', '....x....', '...xxx...', 'xxxx.xxxx', '...xxx...', '....x....', '....x....', '.........', '.........'],
  chair: ['.xx......', '.xx......', '.xx......', '.xx......', '.xxxxxxx.', '.xxxxxxx.', '.x.....x.', '.x.....x.', '.........'],
  hat: ['.........', '...xxx...', '..xxxxx..', '..xxxxx..', '..xxxxx..', 'xxxxxxxxx', '.........', '.........', '.........'],
  crown: ['.........', 'x...x...x', 'xx.xxx.xx', 'xxxxxxxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.........', '.........', '.........'],
};
const STAMP_COL: Record<string, [number, number]> = { red: [P.terracotta, P.clay], gold: [P.honey, P.brassDark], green: [P.moss, P.pine], blue: [P.lake, P.slate], purple: [P.lilac, P.plum], pink: [P.rose, P.berry] };
/** An achievement as a postage stamp (16 x 18): perforated edge, coloured field, emblem. Pencil outline when not earned. */
export function stampArt(color: string, emblem: string, done: boolean): Art {
  return art(`stamp:${color}:${emblem}:${done}`, () => {
    const W = 16, H = 18, p = new Px(W, H), [fc, ic] = (STAMP_COL[color] ?? STAMP_COL.green).map(rgb);
    const paper = rgb(P.paper), grey = rgb(P.pebble);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
      if (edge && (x + y) % 2 === 1) continue;                                      // perforations
      const inField = x >= 3 && y >= 3 && x < W - 3 && y < H - 3;
      if (!done) { if (edge || (inField && (x === 3 || y === 3 || x === W - 4 || y === H - 4))) p.set(x, y, grey); continue; }
      let c = edge ? mix(paper, rgb(P.linen), 0.5) : paper;
      if (inField) c = (x + y) % 5 === 0 ? mix(fc, ic, 0.25) : fc;
      p.set(x, y, c);
    }
    const g = EMB[emblem] ?? EMB.star;
    g.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'x') p.set(x + 4 - 1 + 0, y + 5 - 1, done ? (y < 3 ? mix(paper, rgb(P.lamp), 0.4) : paper) : grey); }));
    if (done) for (let x = 3; x < W - 3; x++) p.set(x, H - 4, ic);
    return p;
  });
}

/** Section icons (11 x 11): 'stats' (bars), 'nights' (moon over a list), 'things' (a little chest), 'seals' (a pennant). */
const ICONS: Record<string, string[]> = {
  stats: ['...........', '........dd.', '........dd.', '....dd..dd.', '....dd..dd.', '.dd.dd..dd.', '.dd.dd..dd.', '.dd.dd..dd.', '.dd.dd..dd.', 'eeeeeeeeeee', '...........'],
  nights: ['..ll.......', '.ll........', '.ll..eeeee.', '.ll........', '..ll.eeee..', '...........', '.....eeeee.', '.dd........', '.dd..eeee..', '...........', '.....eeeee.'],
  things: ['...........', '..ddddddd..', '.dmmmmmmmd.', 'dmmmmmmmmmd', 'eeeeelleeee', 'dmmmmllmmmd', 'dmmmmmmmmmd', 'dmmmmmmmmmd', 'ddddddddddd', '...........', '...........'],
  seals: ['.e.........', '.eddddddd..', '.edmmmmmd..', '.edmmlmmd..', '.edmllldd..', '.edmmlmd...', '.eddddd....', '.e.........', '.e.........', '.e.........', 'eee........'],
};
export function iconArt(name: string, tint: string): Art {
  return art(`icon:${name}:${tint}`, () => {
    const p = new Px(11, 11), [d, m, l] = (TAB_COLORS[tint] ?? TAB_COLORS.moss).map(rgb);
    (ICONS[name] ?? ICONS.stats).forEach((r, y) => [...r].forEach((ch, x) => {
      const c = ch === 'd' ? d : ch === 'm' ? m : ch === 'l' ? (name === 'nights' ? rgb(P.honey) : l) : ch === 'e' ? rgb(P.ink2) : null;
      if (c) p.set(x, y, c);
    }));
    return p;
  });
}

/** A ribbon bookmark hanging below the book (5 x len), with a forked end. */
export function ribbonArt(len: number, col: string): Art {
  return art(`rib:${len}:${col}`, () => {
    const p = new Px(5, len), [d, m, l] = (TAB_COLORS[col] ?? TAB_COLORS.berry).map(rgb);
    for (let y = 0; y < len; y++) for (let x = 0; x < 5; x++) {
      if (y === len - 1 && x >= 1 && x <= 3) continue;   // the forked tail
      if (y === len - 2 && x === 2) continue;
      p.set(x, y, x === 0 ? l : x === 4 ? d : (y % 3 === 0 && x === 2 ? l : m));
    }
    return p;
  });
}

/** A little brass arrow button face (w x h) pointing left or right. */
export function arrowArt(dir: 'l' | 'r'): Art {
  return art(`arrow:${dir}`, () => {
    const p = new Px(12, 12);
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
      const e = Math.min(x, y, 11 - x, 11 - y);
      if (e === 0 && (x === 0 || x === 11) && (y === 0 || y === 11)) continue;
      p.set(x, y, e === 0 ? BRASS[0] : e === 1 ? (y < 6 ? BRASS[5] : BRASS[2]) : brass(x, y, 0.5 - y / 24));
    }
    const rows = ['....x', '...xx', '..xxx', '.xxxx', '..xxx', '...xx', '....x'];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === 'x') { const X = dir === 'l' ? x + 3 : 8 - x; p.set(X, y + 2, rgb(P.woodDeep)); } }));
    return p;
  });
}
