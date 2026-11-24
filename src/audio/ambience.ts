// [audio3] The ambience mix as plain functions (tested in ambience.test.ts): which beds play, how
// loud, for where the camera is, the hour and the weather; and which sound a piece of furniture makes.

export type AmbMode = 'off' | 'outside' | 'inside' | 'shop' | 'globe' | 'stage';
export interface AmbState {
  mode: AmbMode;
  /** 0 = full day .. 1 = deep night (Sky.night) */
  night: number;
  /** sky hour 0..24 */
  hour: number;
  rain: number; storm: number; wind: number; snow: number;
  /** snow lying on the ground 0..1 */
  cover: number;
  /** air temperature, C */
  temp: number;
  winter: boolean;
}

/** Every bed the director may play. `bed_*` are aliases of the soundscape files, so the night soundscape keeps its own loop. */
export const BEDS = ['amb_day', 'amb_dusk', 'amb_peepers', 'amb_snow', 'amb_room', 'amb_rain_roof', 'bed_rain', 'bed_wind', 'bed_stream', 'bed_fire'] as const;
export type Bed = typeof BEDS[number];

const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

/** Twilight bump: 1 around sunrise / sunset, 0 at noon and midnight. */
export const twilight = (night: number) => cl(1 - Math.abs(night - 0.42) / 0.32);
/** How dry the air is for birdsong (birds go quiet in rain and snow). */
export const dryness = (s: AmbState) => cl(1 - s.rain * 1.3 - s.snow * 0.8);
/** Frogs and insects need a warm night. */
export const warmth = (s: AmbState) => (s.winter || s.temp < 1 ? 0 : s.temp < 7 ? 0.4 : 1);

/** Target level of each bed (0 = off). Levels multiply the manifest gain and the ambience volume. */
export function bedLevels(s: AmbState): Record<Bed, number> {
  const L = Object.fromEntries(BEDS.map((b) => [b, 0])) as Record<Bed, number>;
  if (s.mode === 'off') return L;
  const day = cl(1 - s.night), tw = twilight(s.night), evening = s.hour >= 12, dry = dryness(s), warm = warmth(s);
  const deep = cl((s.night - 0.55) / 0.3);
  // what the meadow sounds like right now
  const out = {
    amb_day: 0.7 * day * dry * (evening ? 1 - tw * 0.8 : 1),
    amb_dusk: 0.75 * (evening ? tw : 0) * dry * (0.4 + warm * 0.6),
    amb_peepers: 0.65 * deep * dry * warm,
    bed_rain: s.rain > 0.05 ? 0.3 + 0.6 * s.rain + 0.15 * s.storm : 0,
    bed_wind: cl((s.wind - 0.35) / 0.65) * 0.6 + s.storm * 0.2,
    amb_snow: s.snow > 0.05 ? 0.45 + 0.4 * s.snow : s.cover > 0.5 && s.temp < 1 ? 0.35 : deep * (1 - warm) * 0.3,
    bed_stream: s.winter && s.temp < 0 ? 0 : 0.14,
  };
  if (s.mode === 'outside') return Object.assign(L, out);
  if (s.mode === 'inside') {
    // the room tone and the stove, the rain on the roof, the meadow muffled through the walls
    return Object.assign(L, {
      amb_room: 0.8,
      bed_fire: s.temp < 10 || s.night > 0.5 ? 0.3 : 0.12,
      amb_rain_roof: s.rain > 0.05 ? 0.4 + 0.6 * s.rain : 0,
      amb_day: out.amb_day * 0.3, amb_dusk: out.amb_dusk * 0.3, amb_peepers: out.amb_peepers * 0.3,
      bed_wind: out.bed_wind * 0.5, amb_snow: out.amb_snow * 0.4,
    });
  }
  if (s.mode === 'shop') return Object.assign(L, { amb_room: 0.45, amb_snow: 0.35 });   // the Snow Queen's icy boutique
  if (s.mode === 'globe') return Object.assign(L, { amb_room: 0.35, bed_wind: 0.12 });
  return Object.assign(L, { amb_room: 0.5, amb_day: out.amb_day * 0.25, amb_peepers: out.amb_peepers * 0.25, amb_rain_roof: out.bed_rain * 0.5 });
}

export type Material = 'wood' | 'soft' | 'glass' | 'metal' | 'paper' | 'plant';
const WORDS: [RegExp, Material][] = [
  [/glass|jar|vase|bottle|bowl|fish|aquarium|terrarium|potion|crystal|snowglobe/, 'glass'],
  [/plant|fern|flower|tree|cactus|moss|mushroom|bonsai|herb|ivy|bush|sapling|succulent/, 'plant'],
  [/plush|pillow|cushion|blanket|quilt|teddy|bear|doll|bean|pouf|sofa|couch|bed|hammock|rug|mat|curtain|tent|nest|sack|scarf/, 'soft'],
  [/book|poster|map|letter|paper|card|scroll|painting|print|calendar/, 'paper'],
  [/lamp|lantern|clock|bell|kettle|pot\b|telescope|candle|chime|radio|stove|metal|brass|iron/, 'metal'],
];
const CAT: Partial<Record<string, Material>> = { beds: 'soft', rugs: 'soft', plants: 'plant', garden: 'plant', lights: 'metal', wall: 'paper', tables: 'wood', storage: 'wood' };

/** What a piece of furniture sounds like when set down: by its name, else by its category. */
export function materialOf(id: string, cat?: string): Material {
  const k = id.toLowerCase();
  for (const [re, m] of WORDS) if (re.test(k)) return m;
  if (cat === 'seating') return /stool|bench|log|chair|stump/.test(k) ? 'wood' : 'soft';
  return CAT[cat ?? ''] ?? 'wood';
}
export const PLACE_SOUND: Record<Material, string> = { wood: 'place_wood', soft: 'place_soft', glass: 'place_glass', metal: 'place_metal', paper: 'place_paper', plant: 'place_plant' };
