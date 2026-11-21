// Coats for Pip. Pip is an owl; the Meowl (a kitten's head on a little barn owl) is an unlockable
// skin with its own coats. Each coat is a handful of carefully chosen anchors that get hue-shifted
// ramps at paint time. Field names are shared between skins:
//   owl:   fur = crown & back, stripe = dark bars, wing = wings, speck = light spots, belly, muzzle = facial disc,
//          liner = the ruff framing the disc, nose = beak, paw = feet, ear = tuft tips, mark = belly chevrons
//   meowl: fur = head fur, stripe = tabby stripes, muzzle = white muzzle, ear = inner ear, nose = pink nose...

export type Skin = 'owl' | 'meowl';
export type CoatPattern = 'tabby' | 'solid' | 'tuxedo' | 'calico' | 'points' | 'owl';

export interface OwlPalette {
  id: string;
  name: string;
  skin: Skin;
  pattern: CoatPattern;
  /** belly chevrons (owl coats) */
  mark?: string;
  /** head and back fur */
  fur: string;
  /** tabby stripes / dark patches / siamese points */
  stripe: string;
  /** wing feathers */
  wing: string;
  /** the fine pepper speckles on the wings */
  speck: string;
  /** chest and belly feathers */
  belly: string;
  /** muzzle, chin and the blaze between the eyes */
  muzzle: string;
  /** inside of the ears */
  ear: string;
  nose: string;
  /** fluffy feathered feet */
  paw: string;
  /** the shiny dot eyes */
  eye: string;
  /** eyeliner and cheek lines */
  liner: string;
  blush: string;
  /** a third patch colour (calico) */
  patch?: string;
  /** cost in coins; moonstones for premium coats */
  price: number;
  premium?: boolean;
  blurb: string;
  /** found on adventures in this area instead of the shop */
  unlock?: string;
}

export const PALETTES: OwlPalette[] = [
  // ---------------------------------------------------------------- owl coats
  {
    id: 'tawny', name: 'Tawny', skin: 'owl', pattern: 'owl', price: 0, blurb: 'Toffee feathers with cream freckles, like hot cocoa before bed.',
    fur: '#b0703f', stripe: '#7a4528', wing: '#b8774a', speck: '#fbe6c2', belly: '#fbecd2', mark: '#d39a63', muzzle: '#fff5e4', liner: '#8a5232', ear: '#fbe6c2',
    nose: '#f2a84c', paw: '#f5bf63', eye: '#2a1a14', blush: '#f7a3ae',
  },
  {
    id: 'snowy', name: 'Snowy', skin: 'owl', pattern: 'owl', price: 600, blurb: 'Pure as fresh snow, with a few ink-dot flecks.',
    fur: '#f1f4f8', stripe: '#b6c0d0', wing: '#eef2f7', speck: '#4a5266', belly: '#ffffff', mark: '#cdd5e2', muzzle: '#ffffff', liner: '#b3bdcc', ear: '#ffffff',
    nose: '#59606f', paw: '#eef1f5', eye: '#1e2230', blush: '#ffbccb',
  },
  {
    id: 'barn', name: 'Barn Owl', skin: 'owl', pattern: 'owl', price: 900, blurb: 'Golden wings and a heart-shaped moon of a face.',
    fur: '#dcaa62', stripe: '#a87344', wing: '#dda763', speck: '#fff4e0', belly: '#fffaf1', mark: '#e8c592', muzzle: '#fffcf5', liner: '#c08c52', ear: '#fff4e0',
    nose: '#e9d7c2', paw: '#e8c79e', eye: '#1c1410', blush: '#ffa8b8',
  },
  {
    id: 'mossy', name: 'Mossy', skin: 'owl', pattern: 'owl', price: 1200, blurb: 'Grown slowly on a north-facing branch.', unlock: 'grotto',
    fur: '#6f9a52', stripe: '#41632f', wing: '#76a056', speck: '#e5f2bb', belly: '#f3f7de', mark: '#a6c47b', muzzle: '#fbfdf0', liner: '#3c5829', ear: '#e5f2bb',
    nose: '#eab04a', paw: '#eab04a', eye: '#14180e', blush: '#ff9fae',
  },
  {
    id: 'rosy', name: 'Rosy', skin: 'owl', pattern: 'owl', price: 1500, blurb: 'Blushing from beak to tail feathers.',
    fur: '#e59bb1', stripe: '#ad5d78', wing: '#e8a4b8', speck: '#ffe4eb', belly: '#fff1f5', mark: '#f1b3c3', muzzle: '#fff8fa', liner: '#9f4d68', ear: '#ffe4eb',
    nose: '#ffcf6a', paw: '#ffcf6a', eye: '#24121a', blush: '#ff7f9c',
  },
  {
    id: 'midnight_owl', name: 'Midnight', skin: 'owl', pattern: 'owl', price: 120, premium: true, blurb: 'Sewn from the deep blue between the stars.',
    fur: '#3c4c80', stripe: '#222b52', wing: '#45578e', speck: '#a9bcff', belly: '#d2dbff', mark: '#6f80bd', muzzle: '#eaeeff', liner: '#1c2346', ear: '#a9bcff',
    nose: '#ffd166', paw: '#ffd166', eye: '#0c1030', blush: '#c79bff',
  },
  {
    id: 'ember_owl', name: 'Ember', skin: 'owl', pattern: 'owl', price: 150, premium: true, blurb: 'Glows like the last log in the fireplace.',
    fur: '#c9532e', stripe: '#7d2a17', wing: '#d0603a', speck: '#ffd59a', belly: '#ffe9cf', mark: '#e88b55', muzzle: '#fff3e2', liner: '#6a2213', ear: '#ffd59a',
    nose: '#ffe08a', paw: '#ffcf6a', eye: '#1e0c08', blush: '#ff8f8f',
  },
  {
    id: 'aurora_owl', name: 'Aurora', skin: 'owl', pattern: 'owl', price: 200, premium: true, blurb: 'Feathers that shimmer like the northern lights.',
    fur: '#47b0a6', stripe: '#2b6b7d', wing: '#52b8ae', speck: '#d8fff2', belly: '#ecfff9', mark: '#8fd9c8', muzzle: '#f6fffc', liner: '#235a6b', ear: '#d8fff2',
    nose: '#ffd479', paw: '#ffd479', eye: '#10233a', blush: '#ff9fd2',
  },
  // ---------------------------------------------------------------- Meowl skin coats
  {
    id: 'tabby', name: 'Toasty Tabby', skin: 'meowl', pattern: 'tabby', price: 0, blurb: 'The original Meowl: tabby stripes, golden wings, a very soft white chest.',
    fur: '#c4935f', stripe: '#6a4a33', wing: '#cf8f52', speck: '#a39d96', belly: '#fdfaf3', muzzle: '#fffdf8', ear: '#f2a9ae', nose: '#f39aa5',
    paw: '#fbf7ef', eye: '#16131b', liner: '#4a3427', blush: '#ffb3c0',
  },
  {
    id: 'ginger', name: 'Marmalade', skin: 'meowl', pattern: 'tabby', price: 600, blurb: 'Orange as a sunset and twice as warm.',
    fur: '#e79a52', stripe: '#b45f2c', wing: '#eca765', speck: '#fff0dc', belly: '#fffaf2', muzzle: '#ffffff', ear: '#f7b1a8', nose: '#f6a0a0',
    paw: '#fff9f0', eye: '#1b1410', liner: '#8a4a24', blush: '#ffab9c',
  },
  {
    id: 'snow', name: 'Snowdrift', skin: 'meowl', pattern: 'solid', price: 900, blurb: 'White as fresh snow, wings flecked with ink.',
    fur: '#f7f5f1', stripe: '#d9d4cd', wing: '#f4f3f1', speck: '#3c3f4a', belly: '#ffffff', muzzle: '#ffffff', ear: '#f6b4bf', nose: '#f7a6b4',
    paw: '#ffffff', eye: '#141724', liner: '#a6a09a', blush: '#ffb9c8',
  },
  {
    id: 'tuxedo', name: 'Tuxedo', skin: 'meowl', pattern: 'tuxedo', price: 1100, blurb: 'Always dressed for a fancy midnight dinner.',
    fur: '#2f2c33', stripe: '#1c1a20', wing: '#3d3942', speck: '#d9d7dd', belly: '#ffffff', muzzle: '#ffffff', ear: '#e79aa6', nose: '#f19aab',
    paw: '#ffffff', eye: '#0f0e14', liner: '#141217', blush: '#ff9fb4',
  },
  {
    id: 'calico', name: 'Calico Patchwork', skin: 'meowl', pattern: 'calico', price: 1400, blurb: 'Three colours, zero matching socks.', unlock: 'grotto',
    fur: '#f6f1ea', stripe: '#2f2a2a', patch: '#e48d45', wing: '#e2a066', speck: '#5a4a42', belly: '#ffffff', muzzle: '#ffffff', ear: '#f2a9ae', nose: '#f39aa5',
    paw: '#ffffff', eye: '#17131a', liner: '#3e3330', blush: '#ffb3c0',
  },
  {
    id: 'siamese', name: 'Moonlit Siamese', skin: 'meowl', pattern: 'points', price: 1600, blurb: 'Cream fur with chocolate points and starry blue eyes.',
    fur: '#f1e2cc', stripe: '#5c4434', wing: '#e8d2b4', speck: '#7a6a5e', belly: '#fffaf2', muzzle: '#fbf1e2', ear: '#c99a8e', nose: '#7a5048',
    paw: '#fbf3e6', eye: '#1c2f6a', liner: '#4a3428', blush: '#f7b3b0',
  },
  {
    id: 'midnight', name: 'Midnight', skin: 'meowl', pattern: 'tabby', price: 120, premium: true, blurb: 'Sewn from the deep blue between the stars.',
    fur: '#4a5a92', stripe: '#262f5e', wing: '#55689f', speck: '#d6e0ff', belly: '#e6ebff', muzzle: '#f1f4ff', ear: '#c9a6ff', nose: '#c9a6ff',
    paw: '#eef1ff', eye: '#0c1030', liner: '#1c2350', blush: '#c79bff',
  },
  {
    id: 'ember', name: 'Ember', skin: 'meowl', pattern: 'tabby', price: 150, premium: true, blurb: 'Glows like the last log in the fireplace.',
    fur: '#d4603a', stripe: '#7d2a17', wing: '#e07a44', speck: '#ffd59a', belly: '#fff0dc', muzzle: '#fff6e8', ear: '#ffb08a', nose: '#ff8f8f',
    paw: '#fff3e2', eye: '#1e0c08', liner: '#6a2213', blush: '#ff8f8f',
  },
  {
    id: 'aurora', name: 'Aurora', skin: 'meowl', pattern: 'tabby', price: 200, premium: true, blurb: 'Fur that shimmers like the northern lights.',
    fur: '#6fc6b8', stripe: '#2f7f8c', wing: '#8fd6c8', speck: '#ffffff', belly: '#f0fffb', muzzle: '#f8fffd', ear: '#ffaedc', nose: '#ff9fd2',
    paw: '#f4fffc', eye: '#10233a', liner: '#235a6b', blush: '#ff9fd2',
  },
];

export const PALETTE: Record<string, OwlPalette> = Object.fromEntries(PALETTES.map((p) => [p.id, p]));
export const palette = (id: string): OwlPalette => PALETTE[id] ?? PALETTES[0];
export const coatsFor = (skin: Skin) => PALETTES.filter((p) => p.skin === skin);

export interface SkinDef { id: Skin; name: string; blurb: string; gems: number }
export const SKINS: SkinDef[] = [
  { id: 'owl', name: 'Owl', blurb: 'Pip as Pip has always been: a round little owl with soft, freckled feathers.', gems: 0 },
  { id: 'meowl', name: 'Meowl', blurb: 'A kitten\u2019s face on an owl\u2019s body. Purrs and hoots. Comes with six cat coats.', gems: 150 },
];
