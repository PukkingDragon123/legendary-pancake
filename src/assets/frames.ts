// [ui5] Portrait frames: the frame round the live owl portrait on the name sign (top left of the home screen) is a
// cosmetic. Two are yours from the start, Barnaby stocks most of the rest in the lodge store (acorns or moon gems,
// one marked down each day), and two only come from the series banners. The art is in src/ui/chrome/frameart.ts.
// Kept free of heavy imports: the save (src/game/store.ts) reads these while it loads.
export type FrameRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/**
 * A frame for the live owl portrait on the name sign (top left of the home screen). Some are yours from the start,
 * some are sold in Barnaby's lodge store (acorns or moon gems), some only come from a series banner.
 */
export interface FrameDef {
  id: string;
  name: string;
  blurb: string;
  /** 0 for the starters */
  price: number;
  cur: 'coins' | 'gems';
  rarity: FrameRarity;
  /** yours from the start (and on every old save) */
  starter?: boolean;
  /** only from this series banner (src/game/series.ts) */
  series?: 'frostlight' | 'starfall';
  /** the store only stocks it from this level */
  level?: number;
}
export const FRAMES: FrameDef[] = [
  { id: 'walnut', name: 'Carved Walnut', blurb: 'Hand-carved from a fallen walnut branch: oak leaves and acorns round the rim, oiled until it glows like honey.', price: 0, cur: 'coins', rarity: 'common', starter: true },
  { id: 'porthole', name: 'Brass Porthole', blurb: 'A ship’s porthole, polished every morning. Four brass rivets hold the sky in.', price: 0, cur: 'coins', rarity: 'common', starter: true },
  { id: 'moss', name: 'Mossy Branch Ring', blurb: 'A willow twig bent into a ring, moss and two tiny mushrooms moved in.', price: 450, cur: 'coins', rarity: 'uncommon' },
  { id: 'knit', name: 'Cozy Knit', blurb: 'A knitted ring in cranberry wool with a cable stitch. Warm to the touch.', price: 600, cur: 'coins', rarity: 'uncommon' },
  { id: 'filigree', name: 'Silver Filigree', blurb: 'Curls of fine silver wire around a pearl at each quarter. Very proper.', price: 900, cur: 'coins', rarity: 'rare', level: 2 },
  { id: 'mushroom', name: 'Toadstool Ring', blurb: 'A fairy ring that grew in a perfect circle overnight. Red caps, white spots.', price: 750, cur: 'coins', rarity: 'uncommon' },
  { id: 'laurel', name: 'Golden Laurel', blurb: 'A wreath of gilded laurel leaves for a champion sleeper.', price: 120, cur: 'gems', rarity: 'rare' },
  { id: 'frost', name: 'Frost Crystal', blurb: 'Ice that grew in feathers on a winter window and never melted.', price: 160, cur: 'gems', rarity: 'rare', level: 3 },
  { id: 'celestial', name: 'Celestial Orrery', blurb: 'A brass sun and a silver moon chase each other round a ring of midnight enamel.', price: 260, cur: 'gems', rarity: 'legendary', level: 4 },
  { id: 'gingerbread', name: 'Gingerbread', blurb: 'Baked golden, piped with icing and studded with gumdrops. Do not nibble.', price: 0, cur: 'gems', rarity: 'rare', series: 'frostlight' },
  { id: 'starry', name: 'Star-Studded Night', blurb: 'A ring of deep night sky where little gold stars have come to rest.', price: 0, cur: 'gems', rarity: 'rare', series: 'starfall' },
];
export const FRAME_BY_ID: Record<string, FrameDef> = Object.fromEntries(FRAMES.map((f) => [f.id, f]));
/** The frame on every new save until the player picks another: the carved wooden frame. */
export const DEFAULT_FRAME = 'walnut';
/** [ui12] bumped when the default changed from the brass porthole to the carved walnut (src/game/store.ts migrates) */
export const FRAME_V = 2;
export const STARTER_FRAMES = FRAMES.filter((f) => f.starter).map((f) => f.id);
/** Frames Barnaby keeps in stock (not starters, not series-only). */
export const STORE_FRAMES = FRAMES.filter((f) => !f.starter && !f.series);
