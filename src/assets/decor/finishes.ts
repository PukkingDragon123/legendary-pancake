// Wallpapers and floorings for the build store, painted per texel in the calm "Moss & Moonlight" palette. Each
// finish paints one colour per point of a wall or floor: u runs along the surface, v runs up the wall (or into the
// floor), both in px (rooms sample them at two texels per px). They are painted like real hand-made materials, not
// flat fills: printed paper with fibres, roller banding and slightly mis-registered inks; boards with grain, knots,
// nails and worn centres; stones and cobbles with mortar, moss and pitting; tiles with glaze pooling and chips.
import { P, light, mixc, shadow } from '../../gfx/palette.ts';
import { hash, vnoise } from '../../gfx/noise.ts';
import type { Finish } from '../finishes.ts';

// ------------------------------------------------------------------ painting toolkit (shared with the series finishes)

export const fl = Math.floor;
export const mod = (a: number, n: number) => ((a % n) + n) % n;
export const h2 = (x: number, y: number, s = 0) => hash(fl(x), fl(y), 0, s);
/** A palette colour pushed lighter (t > 0, toward lamp) or darker (t < 0, toward slate): hand-painted shading. */
export const tn = (c: number, t: number) => (t >= 0 ? light(c, Math.min(1.4, t)) : shadow(c, Math.min(1.4, -t)));
/** Value noise with octaves, 0..1, at a feature size `sc` px. */
export function fb(u: number, v: number, sc: number, s = 0, oct = 3): number {
  let a = 0, w = 0, f = 1, amp = 1;
  for (let i = 0; i < oct; i++) { a += vnoise((u / sc) * f, (v / sc) * f, 0.37 + i, s + i * 13) * amp; w += amp; f *= 2.03; amp *= 0.5; }
  return a / w;
}
/** Paper: soft mottling, the odd fibre and a faint print-roller banding (tone offset). */
export function paperT(u: number, v: number, s = 0): number {
  const mott = (fb(u, v, 7, s, 3) - 0.5) * 0.45;
  const fibre = vnoise(u * 1.6, v / 5, 0.2, s + 5) > 0.83 ? -0.18 : 0;
  const band = Math.sin(v * 0.21 + fb(u, v, 30, s + 9, 1) * 3) * 0.04;
  const fleck = h2(u * 2, v * 2, s + 3) > 0.995 ? -0.5 : 0;
  return mott + fibre + band + fleck;
}
/** Brush strokes that run along u (or v): long smears of slightly different value, like gouache. */
export function strokesT(u: number, v: number, s = 0, along: 'u' | 'v' = 'u', len = 9, w = 1.5): number {
  const a = along === 'u' ? vnoise(u / len, v / w, 0.5, s) : vnoise(u / w, v / len, 0.5, s);
  const b = along === 'u' ? vnoise(u / (len * 0.4), v / (w * 0.6), 1.5, s + 1) : vnoise(u / (w * 0.6), v / (len * 0.4), 1.5, s + 1);
  return (a - 0.5) * 0.5 + (b - 0.5) * 0.22;
}
/** Wood grain inside a board (local coords, board id): growth rings warped by noise, plus pores and a knot or two. */
export function grainT(x: number, y: number, id: number, s = 0): number {
  const warp = fb(x, y * 0.3, 10, s + id, 2) * 4;
  const ring = Math.sin((y + warp * 1.6 + h2(id, 0, s) * 20) * 1.3);
  let t = ring * 0.22 + (fb(x, y, 4, s + id * 3, 2) - 0.5) * 0.3;
  if (vnoise(x * 0.9, y * 2.2, 2.5, s + id) > 0.78) t -= 0.18;
  const kx = h2(id, 1, s) * 40, ky = 1 + h2(id, 2, s) * 2.5;
  const kd = Math.hypot((x - kx) / 1.6, y - ky);
  if (h2(id, 3, s) > 0.55 && kd < 1.4) t += kd < 0.6 ? -1.0 : -0.45 + Math.sin(kd * 5) * 0.2;
  return t;
}
/** Jittered-cell Voronoi: nearest and second distance, and the nearest cell's id. For stones, cobbles, crackle. */
export function cells(u: number, v: number, size: number, s = 0, jitter = 0.8) {
  const cu = u / size, cv = v / size, iu = fl(cu), iv = fl(cv);
  let d1 = 9, d2 = 9, id = 0, px = 0, py = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const x = iu + i + 0.5 + (hash(iu + i, iv + j, 0, s) - 0.5) * jitter, y = iv + j + 0.5 + (hash(iu + i, iv + j, 1, s) - 0.5) * jitter;
    const d = Math.hypot((cu - x) * 1.0, (cv - y) * 1.0);
    if (d < d1) { d2 = d1; d1 = d; id = (iu + i) * 7919 + (iv + j) * 104729; px = x; py = y; } else if (d < d2) d2 = d;
  }
  return { d1: d1 * size, d2: d2 * size, edge: (d2 - d1) * size, id, cx: px * size, cy: py * size };
}
/** A motif pixel on a (half-drop) repeat: the character at (u, v), or '.' outside the motif. */
export function motif(rows: string[], u: number, v: number, tw: number, th: number, drop = true): { ch: string; ti: number; tj: number } {
  const ti = fl(u / tw), dv = drop && ti % 2 ? th / 2 : 0;
  const tj = fl((v + dv) / th);
  const lu = fl(mod(u, tw)), lv = fl(mod(v + dv, th));
  const H = rows.length, W = rows[0].length;
  const ox = fl((tw - W) / 2), oy = fl((th - H) / 2);
  const x = lu - ox, y = th - 1 - lv - oy;
  const ch = x >= 0 && x < W && y >= 0 && y < H ? rows[y][x] : '.';
  return { ch, ti, tj };
}
/** Screen-printed ink: a motif colour with a slight misregistration halo and worn patches where the paper shows. */
export function ink(c: number, u: number, v: number, s = 0): number {
  const worn = fb(u, v, 3, s + 31, 2) > 0.74;
  return worn ? tn(c, 0.55) : tn(c, (fb(u, v, 2, s + 17, 2) - 0.5) * 0.5);
}

// ------------------------------------------------------------------ motifs (half-px resolution: rows are 2 per px)

const ROSE = [
  '....rrrr....', '...rRRRRr...', '..rRRrrRRr..', '..rRrDDrRr..', '..rRrDrRRr..', '...rRRRRr...',
  '....rrrr....', 'l....s.....l', 'll...s...ll.', '.lll.s.lll..', '..llls.ll...', '.....s......', '.....s......'];
const TOAD = [
  '...rrrrrr...', '..rrwrrrrr..', '.rrrrrrwrrr.', 'rrwrrrrrrrrr', 'rrrrrrrwrrrr', '..dddddddd..',
  '....ssss....', '....ssss....', '....ssSs....', '....ssss....', '.g..ssss..g.', 'gg.gssssg.gg', '.gggggggggg.'];
const CONE = ['...bb...', '..bBBb..', '.bBbbBb.', '.bbBBbb.', '.bBbbBb.', '..bBBb..', '...bb...', '....s...', '....s...'];
const MOON = ['..mmm..', '.mm....', 'mm.....', 'mm.....', 'mm.....', '.mm....', '..mmm..'];

// ------------------------------------------------------------------ finishes

export const DECOR_FINISHES: Finish[] = [
  // ---------------------------------------------------------------- wallpapers
  {
    id: 'wall_cottage_floral', name: 'Cottage Rosebuds', kind: 'wallpaper', price: 220, rarity: 'common',
    blurb: 'Little dusty-rose buds with sage leaves on buttermilk paper, like a grandmother’s spare room.',
    swatch: ['#eae0c8', '#d9aca4', '#86a06a'],
    paint: (u, v) => {
      const { ch } = motif(ROSE, u * 2, v * 2, 30, 34);
      const g = paperT(u, v, 1);
      if (ch === 'r') return ink(P.berry, u, v, 1);
      if (ch === 'R') return tn(P.rose, g * 0.6);
      if (ch === 'D') return tn(P.berry, -0.4);
      if (ch === 'l') return ink(P.moss, u, v, 2);
      if (ch === 's') return tn(P.fern, -0.2);
      return tn(P.oat, g + 0.15);
    },
  },
  {
    id: 'wall_sage_stripes', name: 'Sage Regency Stripe', kind: 'wallpaper', price: 200, rarity: 'common',
    blurb: 'Wide sage and oat stripes, hand-printed, with a hairline of old brass between.',
    swatch: ['#eae0c8', '#a7b788', '#c8a764'],
    paint: (u, v) => {
      const wob = (fb(u, v, 20, 2, 1) - 0.5) * 0.8;
      const s = mod(u + wob, 18), g = paperT(u, v, 2);
      if (Math.abs(s - 9) < 0.45 || s < 0.45) return tn(P.brass, 0.1 + g);
      if (s < 9) return tn(P.sage, g + strokesT(u, v, 3, 'v', 12, 1.2) + (s < 1.4 ? -0.35 : s > 8 ? 0.1 : 0));
      return tn(P.oat, g + 0.1 + (mod(v, 3) < 0.5 ? 0.05 : 0));
    },
  },
  {
    id: 'wall_little_stars', name: 'Little Stars', kind: 'wallpaper', price: 240, rarity: 'uncommon',
    blurb: 'Dusk-blue paper scattered with lamp-gold stars and tiny moons. A sky to fall asleep under.',
    swatch: ['#f1d39a', '#617f8c', '#46596a'],
    paint: (u, v) => {
      const g = paperT(u, v, 4) + strokesT(u, v, 5, 'u', 14, 2) * 0.6;
      const { ch, ti, tj } = motif(MOON, u * 2, v * 2, 40, 44);
      if (ch === 'm' && h2(ti, tj, 7) > 0.5) return tn(P.lamp, -0.2);
      const c = cells(u, v, 7, 6, 0.9);
      if (h2(c.id, 0, 8) > 0.55) {
        const dx = Math.abs(u - c.cx), dy = Math.abs(v - c.cy), big = h2(c.id, 1, 8) > 0.7;
        if ((dx < 0.5 && dy < (big ? 1.6 : 1)) || (dy < 0.5 && dx < (big ? 1.6 : 1))) return tn(P.lamp, dx + dy < 0.6 ? 0.5 : 0);
        if (big && dx < 1 && dy < 1 && Math.abs(dx - dy) < 0.4) return tn(P.honey, 0);
      }
      return tn(P.dusk, g - (v > 40 ? 0.2 : 0) - 0.1);
    },
  },
  {
    id: 'wall_toadstools', name: 'Toadstool Meadow', kind: 'wallpaper', price: 260, rarity: 'uncommon',
    blurb: 'Terracotta-capped toadstools and grass tufts in a half-drop repeat, printed on warm paper.',
    swatch: ['#f4eedd', '#c0866a', '#66844f'],
    paint: (u, v) => {
      const { ch } = motif(TOAD, u * 2, v * 2, 30, 32);
      const g = paperT(u, v, 5);
      if (ch === 'r') return ink(P.terracotta, u, v, 5);
      if (ch === 'w') return tn(P.cream, 0.4);
      if (ch === 'd') return tn(P.clay, -0.5);
      if (ch === 's') return tn(P.linen, g - 0.1);
      if (ch === 'S') return tn(P.straw, -0.3);
      if (ch === 'g') return ink(P.fern, u, v, 6);
      return tn(P.paper, g);
    },
  },
  {
    id: 'wall_plum_damask', name: 'Plum Damask', kind: 'wallpaper', price: 0, gems: 25, rarity: 'rare',
    blurb: 'Velvety plum flock with a tone-on-tone medallion. Fancy enough for a very important nap.',
    swatch: ['#9e5f66', '#6e5266', '#4b463a'],
    paint: (u, v) => {
      const ti = fl(u / 16), dv = ti % 2 ? 12 : 0;
      const x = mod(u, 16) - 8, y = mod(v + dv, 24) - 12, ax = Math.abs(x) + 0.25;
      const nap = (fb(u, v, 1.2, 6, 2) - 0.5) * 0.35 + strokesT(u, v, 7, 'v', 6, 0.8) * 0.5;
      const body = Math.abs(y) < 9 && ax < 6 * Math.cos((y / 9) * 1.4) && !(ax < 3.2 * Math.cos((y / 9) * 1.4) && Math.abs(y) < 6);
      const core = ax < 1.4 && Math.abs(y) < 4;
      const curl = Math.abs(Math.hypot(ax - 5, y - 6) - 2) < 0.55 || Math.abs(Math.hypot(ax - 5, y + 6) - 2) < 0.55;
      const leaf = Math.abs(ax - 7) < 0.8 && Math.abs(y) < 2.5 - Math.abs(ax - 7) * 2;
      if (body || core || curl || leaf) return tn(mixc(P.plum, P.berry, 0.35), nap + (y > 0 ? 0.25 : 0.05) + (body && ax > 5 ? -0.2 : 0));
      return tn(P.plum, nap - 0.3);
    },
  },
  {
    id: 'wall_wainscot', name: 'Wainscot & Duck-Egg Paint', kind: 'wallpaper', price: 320, rarity: 'uncommon',
    blurb: 'Painted linen panelling to the chair rail and a soft, brushy duck-egg wall above.',
    swatch: ['#dccfb0', '#aec8cc', '#617f8c'],
    paint: (u, v) => {
      const paintT = strokesT(u, v, 8, 'v', 8, 1.4) * 0.8;
      if (v < 2) return tn(P.linen, -1.1 + paintT);
      if (v < 22) {
        const pu = mod(u, 16), panel = fl(u / 16);
        const chip = fb(u, v, 1.5, 9 + panel, 2) > 0.8 ? tn(P.wood, -0.2) : 0;
        if (chip && (pu < 2 || v < 4)) return chip;
        if (pu < 1 || v < 3) return tn(P.linen, -0.75 + paintT);
        if (pu < 2 || v > 20.5) return tn(P.linen, 0.45 + paintT);
        if (pu > 3 && pu < 13 && v > 5 && v < 18) {
          if (pu < 4 || v > 17) return tn(P.linen, 0.55);
          if (pu > 12 || v < 6) return tn(P.linen, -0.6);
          return tn(P.linen, 0.05 + paintT + grainT(pu, v, panel, 2) * 0.25);
        }
        return tn(P.linen, -0.1 + paintT);
      }
      if (v < 25) return tn(P.linen, v < 23 ? -0.5 : v < 24 ? 0.6 : 0.15);
      return tn(P.sky, paintT * 1.2 + (v < 26.5 ? -0.35 : 0) + (fb(u, v, 25, 10, 2) - 0.5) * 0.3);
    },
  },
  {
    id: 'wall_moss_stone', name: 'Moss & Stone', kind: 'wallpaper', price: 360, rarity: 'rare',
    blurb: 'Dry-laid stone with moss creeping out of the cracks, like the cellar of an old mill.',
    swatch: ['#b9b2a4', '#908a7e', '#86a06a'],
    paint: (u, v) => {
      const row = fl(v / 7), off = h2(row, 0, 9) * 12, w = 8 + fl(h2(row, 1, 9) * 6);
      const col = fl((u + off) / w), cu = mod(u + off, w), cv = mod(v, 7);
      const stone = [P.pebble, P.stone, P.linen, P.stoneDark][fl(h2(col, row, 10) * 4)];
      const g = (fb(u, v, 2.5, 11 + col, 3) - 0.5) * 0.9 + (h2(col, row, 12) - 0.5) * 0.4;
      const pit = vnoise(u * 1.3, v * 1.3, 0.1, 13) > 0.8 ? -0.5 : 0;
      const mossy = fb(u, v, 6, 12, 3) + (v < 20 ? 0.12 : 0) - (v > 50 ? 0.15 : 0);
      const edge = Math.min(cu, w - cu, cv, 7 - cv);
      if (edge < 0.55) return mossy > 0.52 ? tn(P.moss, (h2(u * 2, v * 2, 13) - 0.5) * 1.2) : tn(P.stoneDark, -0.9);
      if (mossy > 0.62 && edge < 1.8) return tn(mossy > 0.7 ? P.fern : P.moss, (h2(u * 2, v * 2, 14) - 0.5) * 1.1);
      const bevel = cv > 6 ? 0.45 : cv < 1.1 ? -0.35 : cu < 1.2 ? 0.2 : cu > w - 1.2 ? -0.25 : 0;
      return tn(stone, g + pit + bevel - 0.1);
    },
  },
  {
    id: 'wall_living_bark', name: 'Living Bark', kind: 'wallpaper', price: 280, rarity: 'uncommon',
    blurb: 'Deep furrowed bark with lichen freckles and the odd curl of moss. The hollow, but more so.',
    swatch: ['#9c7a56', '#5b4a3c', '#c4cfa3'],
    paint: (u, v) => {
      const warp = fb(u, v, 12, 15, 2) * 5;
      const ridge = Math.abs(Math.sin((u + warp) * 0.62)) ;
      const plate = vnoise((u + warp) * 0.3, v * 0.12, 0.3, 16);
      let L = (ridge - 0.5) * 1.6 + (plate - 0.5) * 1.2 + (fb(u, v, 2, 17, 2) - 0.5) * 0.5;
      if (ridge < 0.18) L -= 0.9;
      const lichen = fb(u, v, 5, 18, 3);
      if (lichen > 0.68 && ridge > 0.4) return tn(lichen > 0.74 ? P.sageLight : P.sage, (h2(u * 2, v * 2, 19) - 0.5) * 0.8);
      if (fb(u, v, 9, 20, 2) > 0.72 && ridge < 0.35) return tn(P.moss, -0.3);
      return tn(L > 0 ? P.bark : P.barkDark, L * 0.6);
    },
  },
  {
    id: 'wall_owl_toile', name: 'Hollow Toile', kind: 'wallpaper', price: 0, gems: 30, rarity: 'rare',
    blurb: 'Ink-blue toile of oak sprigs, pine cones and crescent moons, printed on old linen. Very distinguished.',
    swatch: ['#eae0c8', '#617f8c', '#46596a'],
    paint: (u, v) => {
      const g = paperT(u, v, 19);
      const sx = mod(u, 28), sy = mod(v + (fl(u / 28) % 2) * 16, 32);
      // a curving oak sprig across each tile
      const by = 16 + Math.sin(sx * 0.22) * 5;
      const twig = Math.abs(sy - by) < 0.55 && sx > 2 && sx < 26;
      let leaf = false;
      for (const lx of [6, 12, 19]) {
        const ly = 16 + Math.sin(lx * 0.22) * 5 + (lx === 12 ? -3 : 3);
        const dx = (sx - lx) / 2.6, dy = (sy - ly) / 1.5;
        if (dx * dx + dy * dy < 1 && Math.abs(Math.sin(sx * 2.4)) > 0.15) leaf = true;
      }
      const { ch: cone } = motif(CONE, sx * 2 - 34, sy * 2 - 10, 999, 999, false);
      const { ch: moon } = motif(MOON, (sx - 4) * 2, (sy - 25) * 2, 999, 999, false);
      const hatch = mod(sx + sy, 2) < 0.6;
      if (twig) return ink(P.slate, u, v, 20);
      if (leaf) return hatch ? tn(P.dusk, -0.2) : tn(P.dusk, 0.3);
      if (cone === 'b' || cone === 'B') return tn(P.slate, cone === 'B' ? 0.4 : -0.2);
      if (cone === 's') return tn(P.slate, 0);
      if (moon === 'm') return ink(P.dusk, u, v, 21);
      return tn(P.oat, g + 0.1);
    },
  },
  {
    id: 'wall_mint_checker', name: 'Mint Checker', kind: 'wallpaper', price: 180, rarity: 'common',
    blurb: 'Soft sage-mint and oat checks, hand-blocked so no two squares are quite the same.',
    swatch: ['#eae0c8', '#c4cfa3', '#a7b788'],
    paint: (u, v) => {
      const wob = (fb(u, v, 9, 22, 2) - 0.5) * 0.9;
      const cu = fl((u + wob) / 6), cv = fl((v - wob) / 6);
      const g = paperT(u, v, 22);
      if ((cu + cv) % 2 === 0) return tn(mixc(P.sageLight, P.mist, 0.3), g + (h2(cu, cv, 23) - 0.5) * 0.3 + (fb(u, v, 1.4, 24, 2) > 0.72 ? 0.3 : 0));
      return tn(P.oat, g + 0.1);
    },
  },
  {
    id: 'wall_gingham', name: 'Picnic Gingham', kind: 'wallpaper', price: 200, rarity: 'common',
    blurb: 'Rose and cream gingham with a visible weave, like a picnic cloth pinned up for summer.',
    swatch: ['#f4eedd', '#e8b4ae', '#9e5f66'],
    paint: (u, v) => {
      const a = mod(u, 6) < 3, b = mod(v, 6) < 3;
      const weave = (mod(fl(u * 2) + fl(v * 2), 2) ? 0.08 : -0.08) + (fb(u, v, 1, 25, 2) - 0.5) * 0.2;
      if (a && b) return tn(P.berry, weave + 0.1);
      if (a || b) return tn(P.blush, weave);
      return tn(P.paper, weave + paperT(u, v, 26) * 0.5);
    },
  },
  {
    id: 'wall_pine_panelling', name: 'Pine Panelling', kind: 'wallpaper', price: 300, rarity: 'uncommon',
    blurb: 'Honey pine tongue-and-groove boards with knots, nail heads and years of lamplight in the grain.',
    swatch: ['#d8bf98', '#bf9d74', '#6f553d'],
    paint: (u, v) => {
      const bw = 5, b = fl(u / bw), bu = mod(u, bw);
      if (bu < 0.45) return tn(P.woodDeep, -0.3);
      if (bu < 0.9) return tn(P.woodLight, -0.5);
      if (bu > bw - 0.5) return tn(P.woodLight, 0.35);
      const nail = (Math.abs(bu - 2.5) < 0.45 && (mod(v, 22) < 0.9 || mod(v, 22) > 21.6));
      if (nail) return tn(P.iron, 0.1);
      return tn(h2(b, 0, 27) > 0.6 ? P.woodPale : P.woodLight, grainT(v, bu, b, 27) * 0.9 + (h2(b, 1, 27) - 0.5) * 0.4);
    },
  },
  {
    id: 'wall_climbing_vines', name: 'Climbing Vines', kind: 'wallpaper', price: 340, rarity: 'rare',
    blurb: 'Fern-green vines with lilac bellflowers climbing misty paper, as if the garden got in.',
    swatch: ['#d3e0dc', '#66844f', '#b4a9c9'],
    paint: (u, v) => {
      const g = paperT(u, v, 28);
      const t = mod(u, 20), k = fl(u / 20);
      const vx = 10 + Math.sin(v * 0.18 + k) * 4;
      if (Math.abs(t - vx) < 0.55) return tn(P.fern, -0.2);
      const leafY = mod(v + k * 7, 9), side = fl((v + k * 7) / 9) % 2 ? 1 : -1;
      const lx = (t - vx) * side, ly = leafY - 4.5;
      if (lx > 0 && lx < 4.5 && Math.abs(ly - lx * 0.3) < 1.5 - Math.abs(lx - 2.2) * 0.5) return tn(lx > 2 ? P.moss : P.fern, (h2(u * 2, v * 2, 29) - 0.5) * 0.5 + (ly > lx * 0.3 ? 0.25 : -0.1));
      const fy = mod(v + k * 13, 23), fx = t - vx + 3.5 * (fl((v + k * 13) / 23) % 2 ? 1 : -1);
      if (Math.abs(fx) < 1.4 && fy > 2 && fy < 5) return tn(P.lilac, fy > 3.5 ? 0.3 : -0.25);
      if (Math.abs(fx) < 0.4 && fy > 5 && fy < 6.5) return tn(P.fern, 0);
      return tn(P.mist, g + 0.05);
    },
  },
  {
    id: 'wall_cloud_nursery', name: 'Cloud Nursery', kind: 'wallpaper', price: 260, rarity: 'uncommon',
    blurb: 'Brush-painted clouds drifting across a pale sky, with the odd stitched star.',
    swatch: ['#f5f7f2', '#aec8cc', '#86a9b0'],
    paint: (u, v) => {
      const sky = strokesT(u, v, 30, 'u', 16, 3) + (v / 64) * 0.4 - 0.1;
      const cu = mod(u + fl(v / 24) * 17, 34) - 17, cv = mod(v, 24) - 12;
      const puff = Math.hypot(cu / 9, cv / 3.2) < 1 || Math.hypot((cu - 5) / 5, (cv - 2) / 3.5) < 1 || Math.hypot((cu + 5) / 5.5, (cv - 1.5) / 3) < 1;
      if (puff) return tn(cv < -1.8 ? P.mist : P.snow, cv < -1.8 ? -0.1 : strokesT(u, v, 31, 'u', 4, 1) * 0.5 + 0.1);
      const c = cells(u, v, 9, 32, 0.9);
      if (h2(c.id, 0, 33) > 0.82 && Math.abs(u - c.cx) + Math.abs(v - c.cy) < 0.9) return tn(P.lamp, 0);
      return tn(P.sky, sky);
    },
  },
  // ---------------------------------------------------------------- floorings
  {
    id: 'floor_herringbone', name: 'Herringbone Oak', kind: 'flooring', price: 380, rarity: 'uncommon',
    blurb: 'Oak blocks laid in herringbone, waxed to a soft glow and worn pale where the paths go.',
    swatch: ['#d8bf98', '#9c7a56', '#4a392b'],
    paint: (u, v) => {
      const L = 12, W = 3;
      const a = (u + v) / 2, b = (v - u) / 2;
      const row = fl(b / W), along = a + row * W;
      const blk = fl(along / L), loc = mod(along, L), across = mod(b, W);
      const flip = mod(row, 2) === 0;
      const id = blk * 31 + row * 7;
      const x = flip ? loc : across * 4, y = flip ? across : loc / 4;
      if (loc < 0.45 || across < 0.4) return tn(P.woodDeep, -0.2);
      const wear = fb(u, v, 18, 34, 2) > 0.6 ? 0.25 : 0;
      return tn(h2(id, 0, 35) > 0.5 ? P.wood : P.woodLight, grainT(x, y, id, 36) * 0.8 + (h2(id, 1, 35) - 0.5) * 0.45 + wear + (across > W - 0.5 ? 0.25 : 0));
    },
  },
  {
    id: 'floor_checker_tiles', name: 'Kitchen Checker Tiles', kind: 'flooring', price: 260, rarity: 'common',
    blurb: 'Oat and slate tiles with grey grout, a little glaze pooling and the odd chipped corner.',
    swatch: ['#eae0c8', '#46596a', '#2e2b24'],
    paint: (u, v) => {
      const T = 8, tu = mod(u, T), tv = mod(v, T), i = fl(u / T), j = fl(v / T);
      if (tu < 0.5 || tv < 0.5) return tn(P.stone, -0.3 + (h2(u * 2, v * 2, 37) - 0.5) * 0.3);
      const dark = (i + j) % 2 === 1;
      const chip = Math.min(tu, tv) < 1.4 && h2(i, j, 38) > 0.8 && tu + tv < 2.6;
      if (chip) return tn(P.linen, -0.4);
      const pool = Math.hypot(tu - 4, tv - 4) / 4;
      const gloss = Math.abs(tu - tv - 1.5) < 0.5 && tu > 2 && tu < 6 ? 0.45 : 0;
      return tn(dark ? P.slate : P.oat, (h2(i, j, 39) - 0.5) * 0.3 + pool * -0.25 + gloss + (fb(u, v, 2, 40, 2) - 0.5) * 0.2);
    },
  },
  {
    id: 'floor_flagstones', name: 'Old Flagstones', kind: 'flooring', price: 340, rarity: 'uncommon',
    blurb: 'Big irregular flagstones worn smooth, with moss and tiny ferns in the joints.',
    swatch: ['#b9b2a4', '#908a7e', '#86a06a'],
    paint: (u, v) => {
      const c = cells(u, v, 13, 41, 0.75);
      const stone = [P.pebble, P.stone, P.linen, mixc(P.stone, P.sage, 0.2)][fl(h2(c.id, 0, 42) * 4)];
      if (c.edge < 0.8) {
        const m = fb(u, v, 4, 43, 2);
        return m > 0.5 ? tn(m > 0.62 ? P.fern : P.moss, (h2(u * 2, v * 2, 44) - 0.5) * 1.0) : tn(P.soot, 0.2);
      }
      const rim = c.edge < 1.6 ? 0.3 : 0;
      const pits = vnoise(u * 1.1, v * 1.1, 0.2, 45) > 0.8 ? -0.4 : 0;
      const lichen = fb(u, v, 3, 46, 2) > 0.76 ? 0.4 : 0;
      return tn(stone, (fb(u, v, 3, 47 + (c.id % 5), 3) - 0.5) * 0.8 + rim + pits + lichen - 0.1);
    },
  },
  {
    id: 'floor_moss_carpet', name: 'Moss Carpet', kind: 'flooring', price: 300, rarity: 'rare',
    blurb: 'Springy cushion moss, soft as a pillow, with clover and the odd tiny white flower.',
    swatch: ['#c4cfa3', '#86a06a', '#3f5a3b'],
    paint: (u, v) => {
      const c = cells(u, v, 2.2, 48, 0.9);
      const tuft = 1 - Math.min(1, c.d1 / 1.3);
      const patch = fb(u, v, 10, 49, 3);
      const base = patch > 0.6 ? P.sage : patch < 0.38 ? P.fern : P.moss;
      if (h2(c.id, 0, 50) > 0.985) return tn(P.snow, 0);
      if (h2(c.id, 1, 50) > 0.95 && c.d1 < 0.7) return tn(P.leaf, 0.3);
      return tn(base, tuft * 0.9 - 0.45 + (h2(u * 2, v * 2, 51) - 0.5) * 0.3);
    },
  },
  {
    id: 'floor_basket_parquet', name: 'Basketweave Parquet', kind: 'flooring', price: 360, rarity: 'uncommon',
    blurb: 'Squares of three oak strips, each square turned against its neighbours, waxed amber.',
    swatch: ['#d8bf98', '#bf9d74', '#6f553d'],
    paint: (u, v) => {
      const S = 9, i = fl(u / S), j = fl(v / S), su = mod(u, S), sv = mod(v, S);
      const turn = (i + j) % 2 === 0;
      const a = turn ? su : sv, b = turn ? sv : su;
      const strip = fl(a / 3), sa = mod(a, 3);
      if (su < 0.4 || sv < 0.4) return tn(P.woodDeep, -0.3);
      if (sa < 0.35) return tn(P.woodDark, -0.2);
      const id = i * 13 + j * 7 + strip;
      return tn(h2(id, 0, 52) > 0.5 ? P.woodLight : P.wood, grainT(b * 1.5, sa, id, 53) * 0.8 + (h2(id, 1, 52) - 0.5) * 0.4 + (sa > 2.6 ? 0.25 : 0));
    },
  },
  {
    id: 'floor_terracotta', name: 'Terracotta & Blue Dot', kind: 'flooring', price: 320, rarity: 'uncommon',
    blurb: 'Hand-made terracotta tiles, each a slightly different bake, with little dusk-blue dot insets.',
    swatch: ['#c0866a', '#a66c55', '#617f8c'],
    paint: (u, v) => {
      const T = 10, tu = mod(u + 0.5, T), tv = mod(v + 0.5, T), i = fl((u + 0.5) / T), j = fl((v + 0.5) / T);
      if (Math.hypot(tu, tv) < 2.6 || Math.hypot(T - tu, tv) < 2.6 || Math.hypot(tu, T - tv) < 2.6 || Math.hypot(T - tu, T - tv) < 2.6) {
        const d = Math.min(Math.hypot(tu, tv), Math.hypot(T - tu, tv), Math.hypot(tu, T - tv), Math.hypot(T - tu, T - tv));
        return d < 0.6 ? tn(P.linen, 0) : tn(P.dusk, d > 2 ? -0.3 : 0.1);
      }
      if (tu < 0.5 || tv < 0.5) return tn(P.linen, -0.5);
      const bake = [P.terracotta, P.clay, mixc(P.terracotta, P.ochre, 0.3)][fl(h2(i, j, 54) * 3)];
      return tn(bake, (fb(u, v, 2.5, 55, 3) - 0.5) * 0.7 + (h2(i, j, 56) - 0.5) * 0.3 + (vnoise(u * 2, v * 2, 0, 57) > 0.85 ? -0.35 : 0));
    },
  },
  {
    id: 'floor_woven_straw', name: 'Woven Straw Matting', kind: 'flooring', price: 220, rarity: 'common',
    blurb: 'Rush matting in a chunky over-under weave, with a darker border band every so often.',
    swatch: ['#dccfb0', '#c9b78d', '#8e7440'],
    paint: (u, v) => {
      const S = 3, i = fl(u / S), j = fl(v / S), su = mod(u, S), sv = mod(v, S);
      const overU = (i + j) % 2 === 0;
      const across = overU ? sv : su, along = overU ? su : sv;
      const fibre = Math.sin(along * 7 + h2(i, j, 58) * 6) * 0.12 + (h2(fl(u * 4), fl(v * 4), 59) - 0.5) * 0.2;
      const round = -Math.pow(Math.abs(across - S / 2) / (S / 2), 2) * 0.7 + 0.25;
      const border = mod(v, 48) < 4;
      return tn(border ? P.ochre : (i + j) % 3 === 0 ? P.straw : P.linen, round + fibre - (border ? 0.2 : 0));
    },
  },
  {
    id: 'floor_marble', name: 'Moonstone Marble', kind: 'flooring', price: 0, gems: 35, rarity: 'rare',
    blurb: 'Pale moonstone slabs with soft lilac veins and a cool sheen, like moonlight set in stone.',
    swatch: ['#f5f7f2', '#dfe9ea', '#b4a9c9'],
    paint: (u, v) => {
      const T = 16, i = fl(u / T), j = fl(v / T), tu = mod(u, T), tv = mod(v, T);
      if (tu < 0.35 || tv < 0.35) return tn(P.lilac, -0.3);
      const warp = fb(u, v, 9, 60 + i * 3 + j, 3) * 7;
      const vein = Math.abs(Math.sin((u * 0.35 + v * 0.18 + warp) * 0.9));
      const sheen = Math.abs(tu - tv) < 1.2 ? 0.25 : 0;
      if (vein < 0.06) return tn(P.lilac, -0.15);
      if (vein < 0.14) return tn(P.lavender, 0);
      return tn(fb(u, v, 6, 61, 2) > 0.55 ? P.frost : P.snow, (fb(u, v, 3, 62, 3) - 0.5) * 0.3 + sheen - 0.05);
    },
  },
  {
    id: 'floor_painted_boards', name: 'Painted Boards', kind: 'flooring', price: 260, rarity: 'common',
    blurb: 'Wide boards painted misty blue, worn back to the honey wood along the paths and at every edge.',
    swatch: ['#d3e0dc', '#86a9b0', '#9c7a56'],
    paint: (u, v) => {
      const bw = 7, b = fl(v / bw), bv = mod(v, bw), off = h2(b, 0, 63) * 40, len = 34 + h2(b, 1, 63) * 18;
      const seg = fl((u + off) / len), bu = mod(u + off, len), id = b * 17 + seg;
      if (bv < 0.45 || bu < 0.4) return tn(P.woodDeep, -0.2);
      const wear = fb(u, v, 8, 64, 3) + (bv < 1.2 || bv > bw - 1.2 ? 0.2 : 0);
      if (wear > 0.68) return tn(P.wood, grainT(bu, bv, id, 65) * 0.8 + 0.1);
      const nail = (bu < 1.6 || bu > len - 1.6) && Math.abs(bv - 1.6) < 0.4;
      if (nail) return tn(P.iron, 0);
      return tn(h2(id, 2, 63) > 0.5 ? P.lake : mixc(P.lake, P.mist, 0.4), strokesT(u, v, 66, 'u', 10, 1.2) + grainT(bu, bv, id, 67) * 0.15 + (bv > bw - 0.6 ? 0.25 : 0));
    },
  },
  {
    id: 'floor_cobble', name: 'River Cobbles', kind: 'flooring', price: 280, rarity: 'uncommon',
    blurb: 'Round river cobbles of every colour, bedded in packed earth with moss between.',
    swatch: ['#b9b2a4', '#908a7e', '#5b4a3c'],
    paint: (u, v) => {
      const c = cells(u, v, 4.2, 68, 0.9);
      const r = 1.6 + h2(c.id, 0, 69) * 0.6;
      if (c.d1 > r) {
        const m = fb(u, v, 3, 70, 2);
        return m > 0.6 ? tn(P.moss, (h2(u * 2, v * 2, 71) - 0.5) * 0.8) : tn(P.bark, (h2(u * 2, v * 2, 72) - 0.5) * 0.6 - 0.3);
      }
      const stone = [P.pebble, P.stone, P.stoneDark, P.linen, mixc(P.stone, P.dusk, 0.3)][fl(h2(c.id, 1, 69) * 5)];
      const dome = 0.55 - (c.d1 / r) * 0.9 + ((v - c.cy) / r) * 0.35 - ((u - c.cx) / r) * 0.15;
      return tn(stone, dome + (fb(u, v, 1.2, 73, 2) - 0.5) * 0.35);
    },
  },
  {
    id: 'floor_delft_tiles', name: 'Blue & White Tiles', kind: 'flooring', price: 360, rarity: 'rare',
    blurb: 'Hand-painted tiles: dusk-blue sprigs, corner flourishes and a little moon on each, no two alike.',
    swatch: ['#f4eedd', '#86a9b0', '#46596a'],
    paint: (u, v) => {
      const T = 12, tu = mod(u, T), tv = mod(v, T), i = fl(u / T), j = fl(v / T);
      if (tu < 0.45 || tv < 0.45) return tn(P.linen, -0.4);
      const cx = tu - T / 2, cy = tv - T / 2, r = Math.hypot(cx, cy);
      const wob = (fb(u, v, 2, 74, 2) - 0.5) * 0.5;
      const brush = (c: number) => tn(c, wob - 0.1 + (h2(u * 2, v * 2, 75) > 0.85 ? 0.35 : 0));
      // corner flourishes
      const k = Math.min(Math.hypot(tu, tv), Math.hypot(T - tu, tv), Math.hypot(tu, T - tv), Math.hypot(T - tu, T - tv));
      if (k < 2.4 && (k > 1.6 || k < 0.7)) return brush(P.dusk);
      // a sprig, a moon or a star in the middle (chosen per tile)
      const kind = fl(h2(i, j, 76) * 3);
      if (kind === 0 && ((Math.abs(cx * 0.6 + cy) < 0.5 && r < 3.6) || (Math.hypot(cx - 1.5, cy + 1) < 1 && r < 3) || Math.hypot(cx + 1.4, cy - 1.6) < 0.9)) return brush(P.slate);
      if (kind === 1 && r < 2.6 && Math.hypot(cx - 1, cy + 0.7) > 2.1) return brush(P.dusk);
      if (kind === 2 && ((Math.abs(cx) < 0.5 && Math.abs(cy) < 2.8) || (Math.abs(cy) < 0.5 && Math.abs(cx) < 2.8) || (Math.abs(Math.abs(cx) - Math.abs(cy)) < 0.45 && r < 1.8))) return brush(P.slate);
      return tn(P.paper, (fb(u, v, 3, 77, 2) - 0.5) * 0.2 - r * 0.02 + (Math.abs(tu - tv) < 0.5 ? 0.15 : 0));
    },
  },
];
