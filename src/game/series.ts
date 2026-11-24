// Limited series for the banners over the Lucky Barrel in Barnaby's lodge store. This file is the contract
// between content and shop: every id here must exist in its registry (furniture / finishes in
// src/assets/seasonal.ts, outfit pieces in src/owl/outfits.ts, skins in src/owl/skins.ts).
export type Stars = 3 | 4 | 5;
export type RewardKind = 'item' | 'piece' | 'skin' | 'finish' | 'species';
export interface SeriesEntry { kind: RewardKind; id: string; stars: Stars; featured?: boolean }
export interface Series {
  id: string;
  name: string;
  tagline: string;
  /** banner art direction for the shop: palette (light, mid, dark, accent) and motif */
  colors: [string, string, string, string];
  motif: 'snow' | 'stars';
  /** ISO week parity this series is on the shelf (0 or 1), so they alternate weekly; 'always' for the standard banner */
  week: 0 | 1 | 'always';
  pool: SeriesEntry[];
}

export const FROSTLIGHT: Series = {
  id: 'frostlight', name: 'Frostlight Festival', tagline: 'Gingerbread, candlelight and the first snow of the year.',
  colors: ['#f4fbff', '#9fd3f0', '#1d3f78', '#d9343f'], motif: 'snow', week: 0,
  pool: [
    { kind: 'skin', id: 'gingerbread', stars: 5, featured: true },
    { kind: 'skin', id: 'snowman', stars: 5 },
    { kind: 'piece', id: 'santa_hat', stars: 4, featured: true },
    { kind: 'piece', id: 'reindeer_antlers', stars: 4, featured: true },
    { kind: 'item', id: 'xmas_tree', stars: 4, featured: true },
    { kind: 'piece', id: 'holiday_sweater', stars: 4 },
    { kind: 'piece', id: 'candy_scarf', stars: 4 },
    { kind: 'item', id: 'gingerbread_house', stars: 4 },
    { kind: 'item', id: 'snow_globe', stars: 4 },
    { kind: 'item', id: 'sleigh_bed', stars: 4 },
    { kind: 'item', id: 'nutcracker', stars: 4 },
    { kind: 'finish', id: 'wall_candy_stripe', stars: 4 },
    { kind: 'item', id: 'candy_cane', stars: 3 },
    { kind: 'item', id: 'cocoa_mug', stars: 3 },
    { kind: 'item', id: 'wreath', stars: 3 },
    { kind: 'item', id: 'poinsettia', stars: 3 },
    { kind: 'item', id: 'present_pile', stars: 3 },
    { kind: 'item', id: 'stockings', stars: 3 },
    { kind: 'item', id: 'snowflake_rug', stars: 3 },
    { kind: 'item', id: 'icicle_lights', stars: 3 },
    { kind: 'finish', id: 'floor_frosty_planks', stars: 3 },
  ],
};

export const STARFALL: Series = {
  id: 'starfall', name: 'Starfall Dreams', tagline: 'Wishes that fell from the sky and landed in your hollow.',
  colors: ['#fdf3ff', '#b6a2f2', '#241a52', '#ffd36a'], motif: 'stars', week: 1,
  pool: [
    { kind: 'skin', id: 'celestial', stars: 5, featured: true },
    { kind: 'piece', id: 'star_crown', stars: 4, featured: true },
    { kind: 'piece', id: 'moon_cape', stars: 4, featured: true },
    { kind: 'item', id: 'star_projector', stars: 4, featured: true },
    { kind: 'item', id: 'moon_bed', stars: 4 },
    { kind: 'item', id: 'telescope_brass', stars: 4 },
    { kind: 'finish', id: 'wall_night_sky', stars: 4 },
    { kind: 'item', id: 'star_jar', stars: 3 },
    { kind: 'item', id: 'planet_mobile', stars: 3 },
    { kind: 'item', id: 'cloud_pouf', stars: 3 },
    { kind: 'item', id: 'comet_rug', stars: 3 },
    { kind: 'finish', id: 'floor_starry_tiles', stars: 3 },
  ],
};

export const SERIES: Series[] = [FROSTLIGHT, STARFALL];
export const SERIES_BY_ID: Record<string, Series> = Object.fromEntries(SERIES.map((s) => [s.id, s]));

/** Gacha odds (Genshin-like): base rates, soft pity from pull 74, hard pity at 90; 4-star every 10. */
export const ODDS = { five: 0.006, four: 0.051, softFrom: 74, hard: 90, fourHard: 10, featuredChance: 0.5 };
/** Moon gems per pull. */
export const PULL_COST = 160;
