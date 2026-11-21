// Real owl species Pip can be. The owl-model agent fleshes out each entry (plumage painter,
// proportions, eye colour) but keeps these ids, names and the exported API.
export interface SpeciesDef {
  id: string;
  name: string;
  latin: string;
  blurb: string;
  /** iris colour */
  eye: string;
  /** free at the start (offered in the interview) or unlocked later */
  starter: boolean;
  /** coins price when not a starter */
  price: number;
  gems?: number;
  level?: number;
}

export const SPECIES: SpeciesDef[] = [
  { id: 'tawny', name: 'Tawny Owl', latin: 'Strix aluco', blurb: 'Round, russet and dark-eyed: the classic hoo-hoo of European woods.', eye: '#2a1810', starter: true, price: 0 },
  { id: 'barn', name: 'Barn Owl', latin: 'Tyto alba', blurb: 'A pale heart-shaped face and golden wings. Hears a mouse breathe.', eye: '#1a1210', starter: true, price: 0 },
  { id: 'snowy', name: 'Snowy Owl', latin: 'Bubo scandiacus', blurb: 'Arctic white with dark flecks and lemon-yellow eyes.', eye: '#f2c414', starter: true, price: 0 },
  { id: 'burrowing', name: 'Burrowing Owl', latin: 'Athene cunicularia', blurb: 'Long legs, white brows, lives in a hole and loves it.', eye: '#f0c020', starter: true, price: 0 },
  { id: 'sawwhet', name: 'Saw-whet Owl', latin: 'Aegolius acadicus', blurb: 'Tiny, round-headed and endlessly surprised.', eye: '#f2c414', starter: true, price: 0 },
  { id: 'little', name: 'Little Owl', latin: 'Athene noctua', blurb: 'A frowning little sage with a speckled crown.', eye: '#f5c518', starter: false, price: 1200, level: 2 },
  { id: 'horned', name: 'Great Horned Owl', latin: 'Bubo virginianus', blurb: 'Tall ear tufts, a white collar and a very serious stare.', eye: '#f3a712', starter: false, price: 2400, level: 4 },
  { id: 'longeared', name: 'Long-eared Owl', latin: 'Asio otus', blurb: 'Orange-faced and slender, with tufts like raised eyebrows.', eye: '#f08a12', starter: false, price: 2400, level: 5 },
  { id: 'greatgrey', name: 'Great Grey Owl', latin: 'Strix nebulosa', blurb: 'A huge grey face of rings, a white bow tie and small yellow eyes.', eye: '#e8c11a', starter: false, price: 0, gems: 480, level: 6 },
  { id: 'eagle', name: 'Eurasian Eagle-Owl', latin: 'Bubo bubo', blurb: 'The biggest of them all, with blazing orange eyes.', eye: '#f26b0f', starter: false, price: 0, gems: 640, level: 8 },
];
export const SPECIES_BY_ID: Record<string, SpeciesDef> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const speciesOf = (id?: string) => SPECIES_BY_ID[id ?? ''] ?? SPECIES[0];
