// Special skins that replace the species plumage entirely (gacha 5-stars and the Meowl).
// The owl-model agent implements the painters; ids are fixed by src/game/series.ts.
export interface SkinDef2 { id: string; name: string; blurb: string; series?: string }
export const SPECIAL_SKINS: SkinDef2[] = [
  { id: 'meowl', name: 'Meowl', blurb: 'A kitten face on an owl body. Purrs and hoots.' },
  { id: 'gingerbread', name: 'Gingerbread Owl', blurb: 'Baked golden, iced with care, smells like cinnamon.', series: 'frostlight' },
  { id: 'snowman', name: 'Snowman Owl', blurb: 'Packed from the first snow, with a carrot beak and coal buttons.', series: 'frostlight' },
  { id: 'celestial', name: 'Celestial Owl', blurb: 'Feathers of deep night sky, scattered with real constellations.', series: 'starfall' },
];
export const SPECIAL_SKIN: Record<string, SkinDef2> = Object.fromEntries(SPECIAL_SKINS.map((s) => [s.id, s]));
