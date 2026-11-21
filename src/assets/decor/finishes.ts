// Wallpapers and floorings for the build store. Each finish paints one colour per px of a wall or
// floor: u runs along the surface, v runs up the wall (or into the floor). Patterns are hand-pixelled
// motifs on half-drop repeats with paper grain, so they read as printed paper, not flat fills.
import { tone } from '../../gfx/color.ts';
import { R } from '../../gfx/mats.ts';
import { fbm, hash, vnoise } from '../../gfx/noise.ts';
import type { Finish } from '../finishes.ts';

const h2 = (x: number, y: number, s = 0) => hash(Math.floor(x), Math.floor(y), 0, s);
const fl = Math.floor;
const mod = (a: number, n: number) => ((a % n) + n) % n;
/** Paper grain: a faint mottling plus the odd fibre. */
const grain = (u: number, v: number, s = 0) => (vnoise(u / 3, v / 3, 0.5, s) - 0.5) * 0.35 + (h2(u, v, s + 1) > 0.97 ? -0.3 : 0);

/** Look up a motif pixel on a (half-drop) repeat: returns the character, or '.' outside the motif. */
function motif(rows: string[], u: number, v: number, tw: number, th: number, drop = true): { ch: string; ti: number; tj: number } {
  const ti = fl(u / tw), dv = drop && ti % 2 ? th / 2 : 0;
  const tj = fl((v + dv) / th);
  const lu = fl(mod(u, tw)), lv = fl(mod(v + dv, th));
  const H = rows.length, W = rows[0].length;
  const ox = fl((tw - W) / 2), oy = fl((th - H) / 2);
  const x = lu - ox, y = th - 1 - lv - oy;
  const ch = x >= 0 && x < W && y >= 0 && y < H ? rows[y][x] : '.';
  return { ch, ti, tj };
}

// ------------------------------------------------------------------ motifs

const ROSE = ['..rr..', '.rRRr.', 'rRrrRr', '.rRRr.', 'g.rr.g', '.gg.g.', '..g...'];
const STAR = ['..x..', '..x..', 'xxxxx', '.xxx.', '.x.x.'];
const TOAD = ['..rrrr..', '.rwrrrr.', 'rrrrrwrr', 'rwrrrrrr', '..ssss..', '...ss...', '...ss...', 'g.gssg.g'];
const OWL = [
  '..i....i..',
  '..ii..ii..',
  '..iiiiii..',
  '.iwwiiwwi.',
  '.iwkiikwi.',
  '.iiiyyiii.',
  '..iiyiii..',
  '..ii..ii..',
  '..iiiiii..',
  '.bbybbybb.',
  'b........b',
];
const SPRIG = ['.l.', 'lsl', '.s.', 'ls.', '.s.'];
const CLOUD = ['....wwww....', '..wwwwwwww..', '.wwwwwwwwwww', 'wwwwwwwwwwww', '.sssssssssss'];

// ------------------------------------------------------------------ ramps

const C = {
  cream: R('#f4e8cc'), paper: R('#efe2c4'), rose: R('#d8566a'), roseHi: R('#f29aa8'), leaf: R('#6a9a5a'),
  sage: R('#9cb8a0'), gold: R('#d8b25a'), dusk: R('#7f96c0'), star: R('#f6e8c0'), toad: R('#d8483a'), stem: R('#f2e2c0'),
  plum: R('#5a2e4e'), plumHi: R('#8a5478'), blue: R('#9cb8d8'), panel: R('#e8dcc4'), stone: R('#9a968c'), moss: R('#6a8a45'),
  bark: R('#7a5236'), lichen: R('#a8b87a'), indigo: R('#3a4a8a'), mint: R('#a8d8c0'), red: R('#d84a4a'), pine: R('#d8a86a'),
  vine: R('#b8d8a8'), sky: R('#a8cce8'), cloud: R('#fbfdff'), cloudS: R('#d8e4f4'),
  oak: R('#b8844a'), ink: R('#2a2a2e'), tile: R('#efe6d4'), flag: R('#a89c88'), carpet: R('#5f8a3f'), terra: R('#c8683a'),
  delft: R('#3a5aa8'), straw: R('#d8bc78'), marble: R('#ece8e2'), vein: R('#8a8a94'), painted: R('#9ab4c0'), cob: R('#8a8a90'), dirt: R('#6a5440'),
};

export const DECOR_FINISHES: Finish[] = [
  // ---------------------------------------------------------------- wallpapers
  {
    id: 'wall_cottage_floral', name: 'Cottage Rosebuds', kind: 'wallpaper', price: 220, rarity: 'common',
    blurb: 'Little pink rosebuds on buttermilk paper, like a grandmother’s spare room.',
    swatch: ['#f4e8cc', '#d8566a', '#6a9a5a'],
    paint: (u, v) => {
      const { ch } = motif(ROSE, u, v, 12, 14);
      const g = grain(u, v, 1);
      if (ch === 'r') return tone(C.rose, g);
      if (ch === 'R') return tone(C.roseHi, 0.4);
      if (ch === 'g') return tone(C.leaf, g);
      return tone(C.cream, g + (mod(u, 12) < 0.6 ? -0.15 : 0));
    },
  },
  {
    id: 'wall_sage_stripes', name: 'Sage Regency Stripe', kind: 'wallpaper', price: 200, rarity: 'common',
    blurb: 'Wide sage and cream stripes with a hairline of gold between.',
    swatch: ['#f4e8cc', '#9cb8a0', '#d8b25a'],
    paint: (u, v) => {
      const s = mod(u, 18), g = grain(u, v, 2);
      if (Math.abs(s - 9) < 0.5 || s < 0.5) return tone(C.gold, 0.3 + g);
      return s < 9 ? tone(C.sage, g + (s < 1.5 ? -0.3 : 0)) : tone(C.cream, g + (mod(v, 3) < 1 ? 0.1 : 0));
    },
  },
  {
    id: 'wall_little_stars', name: 'Little Stars', kind: 'wallpaper', price: 240, rarity: 'uncommon',
    blurb: 'Dusk-blue paper scattered with cream stars. A sky to fall asleep under.',
    swatch: ['#f6e8c0', '#7f96c0', '#4a5e8a'],
    paint: (u, v) => {
      const { ch, ti, tj } = motif(STAR, u, v, 11, 13);
      if (ch === 'x' && h2(ti, tj, 4) > 0.15) return tone(C.star, 0.3);
      const dot = mod(u, 11) === 2 && mod(v + 6, 13) === 3;
      return dot ? tone(C.star, -0.4) : tone(C.dusk, grain(u, v, 3) - (v > 40 ? 0.3 : 0));
    },
  },
  {
    id: 'wall_toadstools', name: 'Toadstool Meadow', kind: 'wallpaper', price: 260, rarity: 'uncommon',
    blurb: 'Red-capped toadstools and grass tufts in a cheerful half-drop repeat.',
    swatch: ['#f2e2c0', '#d8483a', '#6a9a5a'],
    paint: (u, v) => {
      const { ch } = motif(TOAD, u, v, 14, 15);
      const g = grain(u, v, 5);
      if (ch === 'r') return tone(C.toad, g);
      if (ch === 'w') return tone(C.cream, 0.6);
      if (ch === 's') return tone(C.stem, g - 0.2);
      if (ch === 'g') return tone(C.leaf, g);
      return tone(C.paper, g + 0.2);
    },
  },
  {
    id: 'wall_plum_damask', name: 'Plum Damask', kind: 'wallpaper', price: 0, gems: 25, rarity: 'rare',
    blurb: 'Velvety plum with a tone-on-tone medallion. Fancy enough for a very important nap.',
    swatch: ['#8a5478', '#5a2e4e', '#3a1a32'],
    paint: (u, v) => {
      const ti = fl(u / 16), dv = ti % 2 ? 12 : 0;
      const x = mod(u, 16) - 8, y = mod(v + dv, 24) - 12, ax = Math.abs(x) + 0.5;
      const g = grain(u, v, 6) * 0.6;
      // a symmetric medallion: an onion dome, a diamond body and curling leaves
      const body = Math.abs(y) < 9 && ax < 6 * Math.cos((y / 9) * 1.4) && !(ax < 3.2 * Math.cos((y / 9) * 1.4) && Math.abs(y) < 6);
      const core = ax < 1.4 && Math.abs(y) < 4;
      const curl = Math.abs(Math.hypot(ax - 5, y - 6) - 2) < 0.6 || Math.abs(Math.hypot(ax - 5, y + 6) - 2) < 0.6;
      if (body || core || curl) return tone(C.plumHi, g + (y > 0 ? 0.2 : 0));
      return tone(C.plum, g + (mod(u + v, 2) < 1 ? 0.1 : -0.1));
    },
  },
  {
    id: 'wall_wainscot', name: 'Wainscot & Duck-Egg Paint', kind: 'wallpaper', price: 320, rarity: 'uncommon',
    blurb: 'Raised cream panels to the chair rail and soft duck-egg blue above.',
    swatch: ['#e8dcc4', '#9cb8d8', '#6a7e94'],
    paint: (u, v) => {
      if (v < 2) return tone(C.panel, -1.4);
      if (v < 22) {
        const pu = mod(u, 16);
        if (pu < 1 || v < 3) return tone(C.panel, -0.9);
        if (pu < 2 || v > 20) return tone(C.panel, 0.6);
        if (pu > 3 && pu < 13 && v > 5 && v < 18) {
          if (fl(pu) === 4 || fl(v) === 17) return tone(C.panel, 0.7);
          if (fl(pu) === 12 || fl(v) === 6) return tone(C.panel, -0.8);
          return tone(C.panel, 0.1 + grain(u, v, 7) * 0.4);
        }
        return tone(C.panel, -0.1 + grain(u, v, 7) * 0.4);
      }
      if (v < 25) return tone(C.panel, v < 23 ? -0.6 : v < 24 ? 0.8 : 0.2);
      return tone(C.blue, (vnoise(u / 2, v / 7, 1, 8) - 0.5) * 0.4 + (v < 26 ? -0.4 : 0));
    },
  },
  {
    id: 'wall_moss_stone', name: 'Moss & Stone', kind: 'wallpaper', price: 360, rarity: 'rare',
    blurb: 'Dry-laid stone with moss creeping out of the cracks, like the cellar of an old mill.',
    swatch: ['#b8b2a6', '#9a968c', '#6a8a45'],
    paint: (u, v) => {
      const row = fl(v / 7), off = h2(row, 0, 9) * 12, w = 9 + fl(h2(row, 1, 9) * 5);
      const col = fl((u + off) / w), cu = mod(u + off, w), cv = mod(v, 7);
      const g = (h2(col, row, 10) - 0.5) * 0.9 + (fbm(u / 3, v / 3, 0, 11) - 0.5) * 0.8;
      const mortar = cu < 1 || cv < 1;
      const mossy = fbm(u / 6, v / 5, 2, 12) + (v < 20 ? 0.18 : 0) - (v > 50 ? 0.2 : 0);
      if (mortar) return mossy > 0.5 ? tone(C.moss, h2(u, v, 13) > 0.5 ? 0.3 : -0.4) : tone(C.stone, -1.6);
      if (mossy > 0.66 && (cv < 2.2 || cu < 2.2)) return tone(C.moss, (h2(u, v, 14) - 0.5) * 1.2);
      return tone(C.stone, g + (cv > 5.5 ? 0.5 : cu < 2 ? 0.25 : 0));
    },
  },
  {
    id: 'wall_living_bark', name: 'Living Bark', kind: 'wallpaper', price: 280, rarity: 'uncommon',
    blurb: 'Deep furrowed bark with lichen freckles. The hollow, but more so.',
    swatch: ['#a87a52', '#7a5236', '#a8b87a'],
    paint: (u, v) => {
      const n = vnoise(u * 0.55, v * 0.09, 0.3, 15);
      let L = (n - 0.5) * 3.2 + (fbm(u / 4, v / 4, 0, 16) - 0.5) * 0.8;
      if (h2(u, fl(v / 3), 17) > 0.92) L -= 1;
      const lichen = fbm(u / 4, v / 4, 1, 18);
      if (lichen > 0.7) return tone(C.lichen, (lichen - 0.7) * 6 - 0.4);
      return tone(C.bark, L);
    },
  },
  {
    id: 'wall_owl_toile', name: 'Owl Toile', kind: 'wallpaper', price: 0, gems: 30, rarity: 'rare',
    blurb: 'Indigo owls on branches and sprigs of leaves, printed on old linen. Very distinguished.',
    swatch: ['#f2ead8', '#3a4a8a', '#24305e'],
    paint: (u, v) => {
      const g = grain(u, v, 19);
      const a = motif(OWL, u, v, 20, 22);
      if (a.ch !== '.') {
        if (a.ch === 'w' || a.ch === 'y') return tone(C.cream, a.ch === 'y' ? -0.6 : 0.4);
        if (a.ch === 'k') return tone(C.indigo, -1.2);
        return tone(C.indigo, a.ch === 'b' ? -0.4 : (h2(u, v, 20) > 0.7 ? 0.5 : 0));
      }
      const b = motif(SPRIG, u + 10, v + 11, 20, 22);
      if (b.ch !== '.') return tone(C.indigo, b.ch === 'l' ? 0.6 : 0.1);
      return tone(R('#f2ead8'), g + (mod(u + v * 2, 4) < 1 ? -0.08 : 0));
    },
  },
  {
    id: 'wall_mint_checker', name: 'Mint Checker', kind: 'wallpaper', price: 180, rarity: 'common',
    blurb: 'Soft mint and cream checks with a pencil-thin outline. Tidy, calm, minty.',
    swatch: ['#f4e8cc', '#a8d8c0', '#6a9a88'],
    paint: (u, v) => {
      const cu = mod(u, 8), cv = mod(v, 8), k = (fl(u / 8) + fl(v / 8)) % 2;
      if (cu < 0.6 || cv < 0.6) return tone(C.mint, -1);
      return k ? tone(C.mint, grain(u, v, 21) + (cv > 7 ? 0.3 : 0)) : tone(C.cream, grain(u, v, 21));
    },
  },
  {
    id: 'wall_gingham', name: 'Picnic Gingham', kind: 'wallpaper', price: 200, rarity: 'common',
    blurb: 'Red-and-white gingham, the pattern of every good picnic blanket.',
    swatch: ['#fbf2ea', '#e89a9a', '#d84a4a'],
    paint: (u, v) => {
      const a = mod(u, 8) < 4, b = mod(v, 8) < 4, w = (u + v) % 2 < 1 ? 0.12 : -0.12;
      if (a && b) return tone(C.red, w - 0.2);
      if (a || b) return tone(R('#eca0a0'), w);
      return tone(R('#fbf2ea'), w + grain(u, v, 22));
    },
  },
  {
    id: 'wall_pine_panelling', name: 'Pine Panelling', kind: 'wallpaper', price: 300, rarity: 'uncommon',
    blurb: 'Honey-coloured tongue-and-groove boards with the odd knot. Smells faintly of sap.',
    swatch: ['#e8c08a', '#d8a86a', '#8a5a32'],
    paint: (u, v) => {
      if (v < 5) return tone(C.oak, v < 1 ? -1.6 : v > 4 ? 0.8 : -0.4);
      const b = fl(u / 7), bu = mod(u, 7);
      if (bu < 0.8) return tone(C.pine, -1.8);
      if (bu < 1.6) return tone(C.pine, 0.6);
      const kx = 3.5 + h2(b, 1, 23) * 2, ky = 12 + h2(b, 2, 23) * 40, kd = Math.hypot(bu - kx, (v - ky) * 0.6);
      if (h2(b, 3, 23) > 0.4 && kd < 1.4) return tone(C.pine, kd < 0.7 ? -2 : -1);
      const gr = Math.sin(bu * 2.2 + Math.sin(v * 0.12 + b) * 1.6 + (kd < 4 ? 2 / (kd + 0.5) : 0));
      return tone(C.pine, (h2(b, 4, 23) - 0.5) * 0.6 + gr * 0.35);
    },
  },
  {
    id: 'wall_climbing_vines', name: 'Climbing Vines', kind: 'wallpaper', price: 340, rarity: 'rare',
    blurb: 'Pale green paper with vines winding up it, sprouting leaves and tiny forget-me-nots.',
    swatch: ['#e4f0dc', '#8ab87a', '#6a8ad8'],
    paint: (u, v) => {
      const col = fl(u / 14), cx = col * 14 + 7 + Math.sin(v * 0.18 + col * 2) * 3.4;
      const d = u - cx, g = grain(u, v, 24);
      if (Math.abs(d) < 0.6) return tone(C.leaf, -0.4);
      const node = fl(v / 6), side = node % 2 ? 1 : -1, ny = node * 6 + 3;
      const lx = cx + side * 2.2, ly = ny;
      if (Math.hypot((u - lx) * 0.8, v - ly) < 1.5) return tone(C.leaf, (v > ly ? 0.4 : -0.2));
      if (h2(col, node, 25) > 0.7 && Math.hypot(u - (cx - side * 2), v - ny - 1) < 0.9) return Math.hypot(u - (cx - side * 2), v - ny - 1) < 0.4 ? 0xf6e06a : tone(R('#6a8ad8'), 0.3);
      return tone(R('#e4f0dc'), g);
    },
  },
  {
    id: 'wall_cloud_nursery', name: 'Cloud Nursery', kind: 'wallpaper', price: 260, rarity: 'uncommon',
    blurb: 'Fat white clouds drifting across a pale sky. Instantly sleepy.',
    swatch: ['#fbfdff', '#a8cce8', '#7aa0c8'],
    paint: (u, v) => {
      const { ch } = motif(CLOUD, u, v, 24, 16);
      if (ch === 'w') return tone(C.cloud, 0.2);
      if (ch === 's') return tone(C.cloudS, 0);
      return tone(C.sky, grain(u, v, 26) + (v / 64) * 0.6 - 0.3);
    },
  },

  // ---------------------------------------------------------------- floorings
  {
    id: 'floor_herringbone', name: 'Herringbone Oak', kind: 'flooring', price: 380, rarity: 'uncommon',
    blurb: 'Short oak blocks laid in a zig-zag. Clicks nicely under talons.',
    swatch: ['#d8a86a', '#b8844a', '#7a4a28'],
    paint: (u, v) => {
      const w = 4, n = 3, i = fl(u / w), j = fl(v / w), d = mod(i - j, 2 * n);
      const fx = mod(u, w), fy = mod(v, w);
      let id: number, seam: boolean, along: number;
      if (d < n) { id = (i - d) * 131 + j; seam = fy < 0.8 || (d === 0 && fx < 0.8); along = (d * w + fx) * 0.5; }
      else { const j0 = j - (2 * n - 1 - d); id = i * 977 + j0 * 7 + 5; seam = fx < 0.8 || (d === 2 * n - 1 && fy < 0.8); along = ((2 * n - 1 - d) * w + fy) * 0.5; }
      if (seam) return tone(C.oak, -1.7);
      return tone(C.oak, (hash(id, 1, 2, 27) - 0.5) * 1.1 + Math.sin(along + hash(id, 2, 2, 27) * 6) * 0.2);
    },
  },
  {
    id: 'floor_checker_tiles', name: 'Kitchen Checker Tiles', kind: 'flooring', price: 260, rarity: 'common',
    blurb: 'Glossy cream and charcoal tiles. Perfect for sliding about in socks.',
    swatch: ['#efe6d4', '#5a5a62', '#2a2a2e'],
    paint: (u, v) => {
      const cu = mod(u, 10), cv = mod(v, 10), k = (fl(u / 10) + fl(v / 10)) % 2;
      if (cu < 0.8 || cv < 0.8) return tone(C.tile, -1.4);
      const gloss = Math.abs(cu - cv - 2) < 0.7 && cu > 3 && cu < 8 ? 0.8 : 0;
      return tone(k ? C.ink : C.tile, gloss + (h2(fl(u / 10), fl(v / 10), 28) - 0.5) * 0.3 + (k ? 0.4 : 0));
    },
  },
  {
    id: 'floor_flagstones', name: 'Old Flagstones', kind: 'flooring', price: 340, rarity: 'uncommon',
    blurb: 'Big, uneven stone flags worn smooth, with moss in the cracks.',
    swatch: ['#c8bca8', '#a89c88', '#6a7a45'],
    paint: (u, v) => {
      // jittered-grid voronoi: the gap between the two nearest seeds makes the joints
      const S = 11, gi = fl(u / S), gj = fl(v / S);
      let d1 = 1e9, d2 = 1e9, id = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const ci = gi + a, cj = gj + b, sx = (ci + 0.2 + h2(ci, cj, 29) * 0.6) * S, sy = (cj + 0.2 + h2(ci, cj, 30) * 0.6) * S;
        const d = Math.hypot(u - sx, v - sy);
        if (d < d1) { d2 = d1; d1 = d; id = ci * 71 + cj; } else if (d < d2) d2 = d;
      }
      const edge = d2 - d1;
      if (edge < 1) return fbm(u / 4, v / 4, 1, 31) > 0.52 ? tone(C.moss, h2(u, v, 32) - 0.6) : tone(R('#5e5248'), (h2(u, v, 59) - 0.5) * 0.6);
      return tone(C.flag, (hash(id, 3, 3, 33) - 0.5) * 1 + (fbm(u / 3, v / 3, 2, 34) - 0.5) * 0.7 + (edge < 2 ? 0.4 : 0));
    },
  },
  {
    id: 'floor_moss_carpet', name: 'Moss Carpet', kind: 'flooring', price: 300, rarity: 'rare',
    blurb: 'A living green carpet, springy and cool, dotted with clover and tiny white flowers.',
    swatch: ['#8aba5a', '#5f8a3f', '#3a5a2a'],
    paint: (u, v) => {
      const n = fbm(u / 2.2, v / 2.2, 0, 35), big = fbm(u / 9, v / 9, 1, 36);
      if (h2(u, v, 37) > 0.985) return 0xfbfaf0;
      if (h2(fl(u / 2), fl(v / 2), 38) > 0.97) return tone(R('#f6d04a'), 0.2);
      return tone(C.carpet, (n - 0.5) * 2.6 + (big - 0.5) * 1.4 + (n > 0.6 ? 0.5 : 0));
    },
  },
  {
    id: 'floor_basket_parquet', name: 'Basketweave Parquet', kind: 'flooring', price: 360, rarity: 'uncommon',
    blurb: 'Squares of three slim planks, each turned against its neighbour.',
    swatch: ['#e0b478', '#c08a4a', '#7a4a28'],
    paint: (u, v) => {
      const si = fl(u / 12), sj = fl(v / 12), su = mod(u, 12), sv = mod(v, 12), horiz = (si + sj) % 2 === 0;
      const across = horiz ? sv : su, along = horiz ? su : sv, k = fl(across / 4);
      if (su < 0.7 || sv < 0.7) return tone(C.oak, -1.8);
      if (mod(across, 4) < 0.6) return tone(C.oak, -1.2);
      return tone(R('#c8904e'), (h2(si * 3 + k, sj, 39) - 0.5) * 1 + Math.sin(along * 0.9 + k * 2) * 0.2 + (mod(across, 4) > 3.3 ? 0.4 : 0));
    },
  },
  {
    id: 'floor_terracotta', name: 'Terracotta & Blue Dot', kind: 'flooring', price: 320, rarity: 'uncommon',
    blurb: 'Warm clay octagons with little blue glazed squares between them.',
    swatch: ['#e08a5a', '#c8683a', '#3a5aa8'],
    paint: (u, v) => {
      const cu = mod(u, 12) - 6, cv = mod(v, 12) - 6, au = Math.abs(cu), av = Math.abs(cv);
      if (au + av > 9.4) return au + av > 10.2 ? tone(C.delft, (h2(fl(u / 12 + 0.5), fl(v / 12 + 0.5), 40) - 0.5) * 0.6 + 0.2) : tone(R('#d8c8a8'), -0.3);
      if (au > 5.4 || av > 5.4 || au + av > 8.6) return tone(R('#d8c8a8'), -0.5);
      return tone(C.terra, (h2(fl(u / 12), fl(v / 12), 41) - 0.5) * 1 + (fbm(u / 2, v / 2, 0, 42) - 0.5) * 0.7 + (cv < -3.5 ? 0.3 : 0));
    },
  },
  {
    id: 'floor_woven_straw', name: 'Woven Straw Matting', kind: 'flooring', price: 220, rarity: 'common',
    blurb: 'Golden rush matting in a basket weave. Smells like summer fields.',
    swatch: ['#ecd498', '#d8bc78', '#9a7a3a'],
    paint: (u, v) => {
      const bi = fl(u / 6), bj = fl(v / 6), across = (bi + bj) % 2 ? mod(u, 6) : mod(v, 6), along = (bi + bj) % 2 ? v : u;
      const strand = fl(across / 2), inS = mod(across, 2);
      let L = (inS < 0.6 ? -1.8 : inS > 1.4 ? 0.9 : 0.2) + Math.sin(along * 1.3 + strand * 2) * 0.3 + (h2(along, strand + bi * 7, 43) > 0.93 ? -0.8 : 0);
      if (mod(u, 6) < 0.5 || mod(v, 6) < 0.5) L -= 1.2;
      return tone(C.straw, L);
    },
  },
  {
    id: 'floor_marble', name: 'Moonstone Marble', kind: 'flooring', price: 0, gems: 35, rarity: 'rare',
    blurb: 'Pale veined marble in big slabs, cool and glossy. Very grand for a tree.',
    swatch: ['#f4f2ee', '#ece8e2', '#8a8a94'],
    paint: (u, v) => {
      const su = mod(u, 24), sv = mod(v, 24);
      if (su < 0.6 || sv < 0.6) return tone(R('#c8c2b8'), -0.2);
      const id = fl(u / 24) * 13 + fl(v / 24);
      const w = fbm(u / 16 + id, v / 12, 0.5 + id, 44) + fbm(u / 6, v / 6, 1, 45) * 0.12;
      const vein = Math.abs(Math.sin(w * 9 + u * 0.05 + v * 0.03));
      if (vein < 0.05) return tone(C.vein, 0.4);
      if (vein < 0.11) return tone(C.marble, -0.8);
      return tone(C.marble, (fbm(u / 6, v / 6, 2, 46) - 0.5) * 0.6 + (Math.abs(su - sv - 4) < 0.8 ? 0.6 : 0));
    },
  },
  {
    id: 'floor_painted_boards', name: 'Painted Boards', kind: 'flooring', price: 260, rarity: 'common',
    blurb: 'Wide boards in chalky blue-grey, worn back to bare wood where everyone walks.',
    swatch: ['#c8d8dc', '#9ab4c0', '#a87a4a'],
    paint: (u, v) => {
      const row = fl(v / 8), off = (row % 3) * 17, plank = fl((u + off) / 36), pu = mod(u + off, 36), pv = mod(v, 8);
      if (pv < 0.8 || pu < 0.8) return tone(R('#56646c'), 0);
      const wear = fbm(u / 5, v / 3, 3, 47) + (pv < 1.8 || pv > 7 ? 0.12 : 0);
      if (wear > 0.68) return tone(C.oak, (h2(plank, row, 48) - 0.5) * 0.6 + Math.sin(u * 0.4) * 0.2);
      if (wear > 0.64) return tone(C.painted, -0.7);
      return tone(C.painted, (h2(plank, row, 49) - 0.5) * 0.4 + (pv > 7 ? 0.4 : 0) + (vnoise(u / 1.5, v * 2, 0, 50) - 0.5) * 0.3);
    },
  },
  {
    id: 'floor_cobble', name: 'River Cobbles', kind: 'flooring', price: 280, rarity: 'uncommon',
    blurb: 'Rounded cobbles in every shade of river grey, with earth packed between.',
    swatch: ['#b8b8be', '#8a8a90', '#6a5440'],
    paint: (u, v) => {
      const S = 6, gi = fl(u / S), gj = fl(v / S);
      let d1 = 1e9, d2 = 1e9, id = 0, sx0 = 0, sy0 = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const ci = gi + a, cj = gj + b, sx = (ci + 0.25 + h2(ci, cj, 51) * 0.5) * S, sy = (cj + 0.25 + h2(ci, cj, 52) * 0.5) * S;
        const d = Math.hypot(u - sx, v - sy);
        if (d < d1) { d2 = d1; d1 = d; id = ci * 57 + cj; sx0 = sx; sy0 = sy; } else if (d < d2) d2 = d;
      }
      const edge = d2 - d1;
      if (edge < 1.3) return tone(C.dirt, (h2(u, v, 53) - 0.5) * 0.8 - (edge < 0.6 ? 0.6 : 0));
      // dome shading: lit towards the top-left of each stone
      const lit = ((sx0 - u) + (sy0 - v)) * 0.12;
      const tint = [C.cob, R('#9a948a'), R('#7a828c'), R('#a8a49c')][fl(hash(id, 2, 2, 54) * 4)];
      return tone(tint, lit + (edge < 2.2 ? -0.5 : 0.2) + (h2(u, v, 55) > 0.95 ? 0.6 : 0));
    },
  },
  {
    id: 'floor_delft_tiles', name: 'Blue & White Tiles', kind: 'flooring', price: 360, rarity: 'rare',
    blurb: 'Hand-painted blue tiles: each has a tiny windmill, a ship or a sleeping owl.',
    swatch: ['#f4f2ea', '#6a8ad8', '#3a5aa8'],
    paint: (u, v) => {
      const cu = mod(u, 12), cv = mod(v, 12), ti = fl(u / 12), tj = fl(v / 12);
      if (cu < 0.7 || cv < 0.7) return tone(C.tile, -1.2);
      const x = fl(cu), y = fl(cv);
      // corner flourishes and a different tiny scene in the middle of each tile
      if ((x === 1 || x === 11) && (y === 1 || y === 11)) return tone(C.delft, 0);
      if ((x === 2 && (y === 1 || y === 11)) || (x === 10 && (y === 1 || y === 11)) || (y === 2 && (x === 1 || x === 11)) || (y === 10 && (x === 1 || x === 11))) return tone(C.delft, 0.6);
      const k = fl(hash(ti, tj, 1, 56) * 3), mx = x - 6, my = y - 6;
      let ink = false;
      if (k === 0) ink = (Math.abs(mx) <= 1 && my >= -2 && my <= 1) || (Math.abs(mx - my) === 0 && Math.abs(mx) <= 3 && my > 0) || (Math.abs(mx + my) === 0 && Math.abs(mx) <= 3 && my > 0);
      else if (k === 1) ink = (my === -2 && Math.abs(mx) <= 3) || (my === -1 && Math.abs(mx) <= 2) || (mx === 0 && my >= 0 && my <= 3) || (my === 1 && mx > 0 && mx <= 2);
      else ink = (Math.hypot(mx, my) < 2.6 && !(Math.abs(Math.abs(mx) - 1) < 0.5 && my === 0)) || (my === 3 && Math.abs(mx) === 2);
      if (ink) return tone(C.delft, (h2(u, v, 57) - 0.5) * 0.4);
      return tone(R('#f4f2ea'), (h2(ti, tj, 58) - 0.5) * 0.3 + (Math.abs(cu - cv) < 0.6 ? 0.3 : 0));
    },
  },
];

