// Wallpapers and floorings: surface finishes a room can wear. A finish is a pure function from a
// position on the surface (in px, 16 px = one block) to a colour, so the house can paint it onto
// whatever wall or floor geometry it builds. The content module (finishes.content.ts) fills this.
import type { ItemRarity } from './furniture.ts';

export interface Finish {
  id: string;
  name: string;
  kind: 'wallpaper' | 'flooring';
  price: number;
  gems?: number;
  rarity?: ItemRarity;
  series?: string;
  noStore?: boolean;
  blurb: string;
  /** three colours for the store swatch, light to dark */
  swatch: [string, string, string];
  /**
   * Colour at a point on the surface. u runs along the wall (or across the floor), v runs up the
   * wall (or into the floor), both in px. Return 0xRRGGBB. Called once per texel at build time.
   */
  paint(u: number, v: number): number;
}

const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const shade = (c: number, k: number) => {
  const r = Math.max(0, Math.min(255, ((c >> 16) & 255) * k)), g = Math.max(0, Math.min(255, ((c >> 8) & 255) * k)), b = Math.max(0, Math.min(255, (c & 255) * k));
  return (r << 16) | (g << 8) | b;
};

/** The two finishes every room starts with. */
export const BASE_FINISHES: Finish[] = [
  {
    id: 'wall_heartwood', name: 'Carved Heartwood', kind: 'wallpaper', price: 0, blurb: 'The oak itself, smoothed by a hundred years of owls.',
    swatch: ['#e0a96a', '#c58a52', '#8a5a34'],
    paint: (u, v) => (v < 16 ? shade(0x8a5a34, 0.9 + hash(Math.floor(u / 4), 0) * 0.2) : v < 17.5 ? 0xe9b878 : shade(0xc58a52, 0.88 + hash(Math.floor(u / 2.2), Math.floor(v / 9)) * 0.24)),
  },
  {
    id: 'floor_planks', name: 'Honey Planks', kind: 'flooring', price: 0, blurb: 'Wide boards, warm underfoot.',
    swatch: ['#d9a865', '#b07a44', '#7a4a28'],
    paint: (u, v) => { const row = Math.floor(v / 6), off = (row % 3) * 13, plank = Math.floor((u + off) / 26); const edge = (v % 6) < 0.9 || ((u + off) % 26) < 0.9; return edge ? 0x6a4024 : shade(0xb07a44, 0.86 + hash(plank, row) * 0.28); },
  },
];
