// Real owl species Pip can be. Each entry carries the bird's proportions (in model px, 16 px = one
// block) and its plumage: colour anchors plus the pattern rules the painters in plumage.ts follow.
// Ids, names and the exported API are fixed (the shop, the interview and saves depend on them).

/** Body proportions. Heights stack: toes, visible leg, body, head (minus the neck overlap). */
export interface Shape {
  /** visible tarsus between the toes and the belly feathers */
  legH: number;
  /** leg thickness (feathered legs are fat, bare ones thin) */
  legW: number;
  /** half distance between the feet */
  legX: number;
  bodyW: number; bodyD: number; bodyH: number;
  /** how far the breast bulges forward (px) */
  breast: number;
  headW: number; headH: number; headD: number;
  /** 0 = domed crown, 1 = flat-topped */
  flat: number;
  /** how deep the head sinks into the shoulders */
  neck: number;
  /** facial disc outline */
  disc: 'lobes' | 'heart' | 'round';
  /** disc lobe radius around each eye, as a share of headW */
  discR: number;
  eyeS: number;
  /** half distance between the eye centres */
  eyeX: number;
  /** eye height as a share of the head height */
  eyeV: number;
  /** ear tufts: length, base width, spread from centre, outward lean (deg), number of feathers */
  tuft?: { len: number; w: number; x: number; lean: number; n: number; back?: number };
  /** wing tips below the body bottom and past the back */
  wingDrop: number;
  wingBack: number;
  tailLen: number;
  /** feathered toes (snowy) / bare toes (burrowing, barn) */
  toes: 'feathered' | 'bristled' | 'bare';
}

export type UpperPat = 'tawny' | 'barn' | 'snowy' | 'spotted' | 'mottled' | 'grey';
export type UnderPat = 'tawny' | 'dots' | 'snowy' | 'barred' | 'chestnut' | 'streaked' | 'finebar' | 'longeared' | 'greystreak' | 'eagle';
export type DiscPat = 'tawny' | 'barn' | 'snowy' | 'burrowing' | 'sawwhet' | 'little' | 'horned' | 'longeared' | 'rings' | 'eagle';

export interface Plumage {
  /** upperparts: ground, markings, pale spots/fringes */
  up: string; upDark: string; upLight: string;
  /** underparts ground, markings, and the paler lower belly */
  under: string; underMark: string; underLow: string;
  disc: string; discDark: string; rim: string; rimLight: string;
  /** brows, chin, throat bib (white on many species) */
  brow: string; chin: string; bib?: string;
  wing: string; wingBar: string; wingLight: string;
  tail: string; tailBar: string;
  leg: string; toe: string; talon: string; beak: string; cere: string;
  /** eyelid margin and the iris */
  lidRim: string; iris: string;
  tuft?: string;
  upper: UpperPat; underPat: UnderPat; discPat: DiscPat;
}

export interface SpeciesDef {
  id: string;
  name: string;
  latin: string;
  blurb: string;
  /** iris colour */
  eye: string;
  /** free at the start (offered in the interview) or unlocked later */
  starter: boolean;
  /** acorns price when not a starter */
  price: number;
  gems?: number;
  level?: number;
  shape: Shape;
  plumage: Plumage;
  /** a real-world fact for the wardrobe card */
  fact: string;
}

const base: Shape = {
  legH: 0.9, legW: 2.8, legX: 2.7, bodyW: 14, bodyD: 12, bodyH: 13, breast: 0.8,
  headW: 15.2, headH: 11.8, headD: 12.4, flat: 0.15, neck: 2.2,
  disc: 'lobes', discR: 0.31, eyeS: 4.3, eyeX: 3.3, eyeV: 0.5,
  wingDrop: 0.4, wingBack: 2.6, tailLen: 3, toes: 'feathered',
};
const sh = (o: Partial<Shape>): Shape => ({ ...base, ...o });

export const SPECIES: SpeciesDef[] = [
  {
    id: 'tawny', name: 'Tawny Owl', latin: 'Strix aluco', eye: '#2a1810', starter: true, price: 0,
    blurb: 'Round, russet and dark-eyed: the classic hoo-hoo of European woods.',
    fact: 'Pairs stay together for life and defend the same patch of wood for years.',
    shape: sh({}),
    plumage: {
      up: '#9b5b2f', upDark: '#3e2112', upLight: '#efd9b4',
      under: '#d7a46c', underMark: '#4f2a16', underLow: '#ead2a8',
      disc: '#b9814f', discDark: '#7e4a28', rim: '#4e2a14', rimLight: '#c79a6c',
      brow: '#ecdcbc', chin: '#d9b78c',
      wing: '#93552c', wingBar: '#4a2814', wingLight: '#e8cf9e',
      tail: '#8e5530', tailBar: '#43230f',
      leg: '#e3c597', toe: '#d8bb8c', talon: '#2e2522', beak: '#e4d3a0', cere: '#a89470',
      lidRim: '#5a3a3c', iris: '#24140c',
      upper: 'tawny', underPat: 'tawny', discPat: 'tawny',
    },
  },
  {
    id: 'barn', name: 'Barn Owl', latin: 'Tyto alba', eye: '#1a1210', starter: true, price: 0,
    blurb: 'A pale heart-shaped face and golden wings. Hears a mouse breathe.',
    fact: 'Its heart-shaped face works like a satellite dish, funnelling sound to its ears.',
    shape: sh({ legH: 3.6, legW: 2.2, legX: 2.4, bodyW: 12.4, bodyD: 11, bodyH: 12.4, breast: 0.6, headW: 14, headH: 12.2, headD: 11.4, flat: 0.25, neck: 2.4, disc: 'heart', discR: 0.33, eyeS: 3.7, eyeX: 2.7, eyeV: 0.54, wingDrop: 1.2, wingBack: 3.2, tailLen: 2.4, toes: 'bristled' }),
    plumage: {
      up: '#d6a45a', upDark: '#7e7a80', upLight: '#fbf6ea',
      under: '#fbf6ec', underMark: '#3a2c28', underLow: '#fffcf6',
      disc: '#fdf9f2', discDark: '#c9a487', rim: '#c58637', rimLight: '#e8b867',
      brow: '#fffaf2', chin: '#fdf8ef',
      wing: '#d7a359', wingBar: '#8c8584', wingLight: '#f7efe0',
      tail: '#dcb070', tailBar: '#8e8682',
      leg: '#f7f1e6', toe: '#a99d97', talon: '#2d2726', beak: '#ead8c6', cere: '#d6bfae',
      lidRim: '#3a2620', iris: '#140d0c',
      upper: 'barn', underPat: 'dots', discPat: 'barn',
    },
  },
  {
    id: 'snowy', name: 'Snowy Owl', latin: 'Bubo scandiacus', eye: '#f2c414', starter: true, price: 0,
    blurb: 'Arctic white with dark flecks and lemon-yellow eyes.',
    fact: 'Hunts in daylight all through the Arctic summer, when the sun never sets.',
    shape: sh({ legH: 0.6, legW: 3.4, legX: 3, bodyW: 16, bodyD: 13.6, bodyH: 15, breast: 1.1, headW: 15.8, headH: 12, headD: 13, flat: 0.3, neck: 2.6, discR: 0.3, eyeS: 4.1, eyeX: 3.4, eyeV: 0.52, tuft: { len: 1.6, w: 1.8, x: 4.4, lean: 30, n: 2 }, wingDrop: 0.2, wingBack: 3, tailLen: 3.2 }),
    plumage: {
      up: '#f4f5f6', upDark: '#3b2f29', upLight: '#ffffff',
      under: '#f7f8f8', underMark: '#4a3b33', underLow: '#ffffff',
      disc: '#fbfbfb', discDark: '#d9dcdf', rim: '#e9eaec', rimLight: '#ffffff',
      brow: '#ffffff', chin: '#ffffff',
      wing: '#f2f2f2', wingBar: '#3b2f29', wingLight: '#ffffff',
      tail: '#f4f4f4', tailBar: '#3b2f29',
      leg: '#fbfbfb', toe: '#f8f8f8', talon: '#1c1a1a', beak: '#262424', cere: '#3a3636',
      lidRim: '#121212', iris: '#f2c414',
      upper: 'snowy', underPat: 'snowy', discPat: 'snowy',
    },
  },
  {
    id: 'burrowing', name: 'Burrowing Owl', latin: 'Athene cunicularia', eye: '#f0c020', starter: true, price: 0,
    blurb: 'Long legs, white brows, lives in a hole and loves it.',
    fact: 'Lines its burrow with dung to attract dung beetles: breakfast delivered.',
    shape: sh({ legH: 4.6, legW: 1.3, legX: 2.1, bodyW: 11, bodyD: 10, bodyH: 10, breast: 0.5, headW: 12.4, headH: 9.4, headD: 10.4, flat: 0.55, neck: 1.8, discR: 0.29, eyeS: 3.9, eyeX: 2.65, eyeV: 0.54, wingDrop: 0.6, wingBack: 1.8, tailLen: 1.6, toes: 'bare' }),
    plumage: {
      up: '#8b6644', upDark: '#4c3423', upLight: '#f1e6cf',
      under: '#efe4cb', underMark: '#86613f', underLow: '#f8f1e2',
      disc: '#b5916a', discDark: '#8a6a48', rim: '#5a3f28', rimLight: '#d9c29e',
      brow: '#fbf7ec', chin: '#fbf7ec', bib: '#fbf7ec',
      wing: '#86613f', wingBar: '#4a3221', wingLight: '#eadcc0',
      tail: '#80603f', tailBar: '#4a3221',
      leg: '#cfc6b6', toe: '#958c80', talon: '#2a2523', beak: '#cfc8a0', cere: '#a8a083',
      lidRim: '#2a2220', iris: '#f0c020',
      upper: 'spotted', underPat: 'barred', discPat: 'burrowing',
    },
  },
  {
    id: 'sawwhet', name: 'Saw-whet Owl', latin: 'Aegolius acadicus', eye: '#f2c414', starter: true, price: 0,
    blurb: 'Tiny, round-headed and endlessly surprised.',
    fact: 'Named for its call, which sounds like a saw being sharpened on a whetstone.',
    shape: sh({ legH: 0.6, legW: 2.4, legX: 2.2, bodyW: 11, bodyD: 10, bodyH: 9.6, breast: 0.6, headW: 14, headH: 11.6, headD: 11.4, flat: 0, neck: 2, discR: 0.32, eyeS: 4.5, eyeX: 3.2, eyeV: 0.48, wingDrop: 0.4, wingBack: 1.8, tailLen: 2 }),
    plumage: {
      up: '#7b4a2b', upDark: '#4a2a18', upLight: '#f6ede0',
      under: '#f7f0e6', underMark: '#9b5934', underLow: '#fbf6ee',
      disc: '#efe2d2', discDark: '#9a6a48', rim: '#6a4027', rimLight: '#f4e9dc',
      brow: '#fbf8f2', chin: '#f6eee2',
      wing: '#764628', wingBar: '#43260f', wingLight: '#f4eadb',
      tail: '#6f4227', tailBar: '#f1e6d4',
      leg: '#f1e4cf', toe: '#ecdcc4', talon: '#2a2220', beak: '#1f1b1a', cere: '#3a3230',
      lidRim: '#151111', iris: '#f2c414',
      upper: 'spotted', underPat: 'chestnut', discPat: 'sawwhet',
    },
  },
  {
    id: 'horned', name: 'Great Horned Owl', latin: 'Bubo virginianus', eye: '#f3a712', starter: false, price: 2400, level: 4,
    blurb: 'Tall ear tufts, a white collar and a very serious stare.',
    fact: 'One of the few animals that will happily hunt skunks. It has almost no sense of smell.',
    shape: sh({ legH: 0.9, legW: 3.2, legX: 2.9, bodyW: 15, bodyD: 12.8, bodyH: 14.4, breast: 1, headW: 15, headH: 11, headD: 12.4, flat: 0.45, neck: 2.4, discR: 0.3, eyeS: 4.4, eyeX: 3.3, eyeV: 0.5, tuft: { len: 6, w: 2.6, x: 5, lean: 16, n: 4 }, wingDrop: 0.4, wingBack: 3, tailLen: 3.2 }),
    plumage: {
      up: '#7a6651', upDark: '#2f251d', upLight: '#cfbfa4',
      under: '#cbb595', underMark: '#3e3126', underLow: '#ddcdb2',
      disc: '#c78248', discDark: '#9a5e30', rim: '#1d1612', rimLight: '#6a5442',
      brow: '#e9dcc4', chin: '#f5efe4', bib: '#fbf8f2',
      wing: '#776350', wingBar: '#33281f', wingLight: '#c8b79c',
      tail: '#7a6652', tailBar: '#33281f',
      leg: '#d8c4a2', toe: '#d2be9c', talon: '#1f1b1a', beak: '#2e2c2c', cere: '#454040',
      lidRim: '#141010', iris: '#f3a712', tuft: '#3a2e24',
      upper: 'mottled', underPat: 'finebar', discPat: 'horned',
    },
  },
  {
    id: 'greatgrey', name: 'Great Grey Owl', latin: 'Strix nebulosa', eye: '#e8c11a', starter: false, price: 0, gems: 480, level: 6,
    blurb: 'A huge grey face of rings, a white bow tie and small yellow eyes.',
    fact: 'Hears voles moving under 60 cm of snow and plunges through to catch them.',
    shape: sh({ legH: 0.7, legW: 3.2, legX: 3, bodyW: 15.8, bodyD: 13.2, bodyH: 15.2, breast: 1, headW: 18, headH: 13.8, headD: 13.2, flat: 0.1, neck: 3, disc: 'round', discR: 0.36, eyeS: 3.3, eyeX: 2.7, eyeV: 0.53, wingDrop: 0.6, wingBack: 3.4, tailLen: 4.2 }),
    plumage: {
      up: '#8b8a87', upDark: '#3f3e3e', upLight: '#dcdad4',
      under: '#bdbcb7', underMark: '#3f3e3e', underLow: '#cfcdc8',
      disc: '#b9b8b3', discDark: '#4b4a4b', rim: '#2f2e2e', rimLight: '#9a9894',
      brow: '#f4f3ee', chin: '#262424', bib: '#f6f5f0',
      wing: '#86857f', wingBar: '#3d3c3b', wingLight: '#d2d0c9',
      tail: '#86857f', tailBar: '#3d3c3b',
      leg: '#cfcdc6', toe: '#c8c6bf', talon: '#1f1d1d', beak: '#e2c25a', cere: '#c4ab52',
      lidRim: '#151414', iris: '#e8c11a',
      upper: 'grey', underPat: 'greystreak', discPat: 'rings',
    },
  },
  {
    id: 'eagle', name: 'Eurasian Eagle-Owl', latin: 'Bubo bubo', eye: '#f26b0f', starter: false, price: 0, gems: 640, level: 8,
    blurb: 'The biggest of them all, with blazing orange eyes.',
    fact: 'Wingspan up to 1.9 m: wide enough to hug a sofa.',
    shape: sh({ legH: 1, legW: 3.6, legX: 3.2, bodyW: 16.6, bodyD: 13.8, bodyH: 15.4, breast: 1.2, headW: 16, headH: 11.8, headD: 13, flat: 0.4, neck: 2.8, discR: 0.3, eyeS: 4.8, eyeX: 3.6, eyeV: 0.5, tuft: { len: 5.6, w: 3, x: 5.6, lean: 34, n: 4 }, wingDrop: 0.4, wingBack: 3.4, tailLen: 3.6 }),
    plumage: {
      up: '#a56a33', upDark: '#24170e', upLight: '#e6c08a',
      under: '#cd8f4b', underMark: '#2a1a10', underLow: '#d9a466',
      disc: '#c99a62', discDark: '#8a5e34', rim: '#221710', rimLight: '#6a4a30',
      brow: '#e9d2a8', chin: '#f4ead8', bib: '#f3e7d2',
      wing: '#9c6433', wingBar: '#2c1c11', wingLight: '#dcb47e',
      tail: '#a06a3a', tailBar: '#2c1c11',
      leg: '#d6a564', toe: '#d2a060', talon: '#1c1716', beak: '#221e1d', cere: '#3a3330',
      lidRim: '#1a1412', iris: '#f26b0f', tuft: '#2a1b10',
      upper: 'mottled', underPat: 'eagle', discPat: 'eagle',
    },
  },
];
export const SPECIES_BY_ID: Record<string, SpeciesDef> = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
export const speciesOf = (id?: string) => SPECIES_BY_ID[id ?? ''] ?? SPECIES[0];

/** Legacy owl coats (save v1 palettes) and the species each now maps to. */
const PALETTE_SPECIES: Record<string, string> = {
  tawny: 'tawny', snowy: 'snowy', barn: 'barn', mossy: 'burrowing', rosy: 'barn',
  midnight_owl: 'greatgrey', ember_owl: 'eagle', aurora_owl: 'horned',
  // retired species (the owl line is eight birds now)
  little: 'burrowing', longeared: 'horned',
};

/**
 * The species a look shows. `look.species` is the source of truth; a look whose species is still the
 * default but whose legacy palette names a different owl (an old save) shows that owl instead.
 */
export function resolveSpecies(look: { species?: string; palette?: string }): SpeciesDef {
  const sp = look.species && SPECIES_BY_ID[look.species] ? look.species : look.species && RETIRED_SPECIES[look.species] ? RETIRED_SPECIES[look.species] : undefined;
  const fromPal = look.palette ? (SPECIES_BY_ID[look.palette] ? look.palette : PALETTE_SPECIES[look.palette]) : undefined;
  if (sp && sp !== 'tawny') return SPECIES_BY_ID[sp];
  return speciesOf(fromPal ?? sp ?? 'tawny');
}

/** Species retired from the line, and the owl each old save becomes (Little Owl -> Burrowing, Long-eared -> Great Horned). */
export const RETIRED_SPECIES: Record<string, string> = { little: 'burrowing', longeared: 'horned' };
/** Move an old save's look and owned owls off retired species (store.ts calls this when a save loads). */
export function migrateSpecies(s: { look?: { species?: string; palette?: string }; owned?: { species?: string[] } }) {
  const m = (id?: string) => (id && RETIRED_SPECIES[id]) || id;
  if (s.look) { s.look.species = m(s.look.species); if (s.look.palette && RETIRED_SPECIES[s.look.palette]) s.look.palette = m(s.look.palette); }
  if (s.owned?.species) s.owned.species = [...new Set(s.owned.species.map((x) => m(x) ?? x))];
}
