// Coats for Pip the Meowl: a cat's head and face on a little barn owl's body. Each coat is a handful
// of carefully chosen anchors (fur, stripes, wings, speckles...) that get hue-shifted ramps at paint
// time, plus a fur pattern.

export type CoatPattern = 'tabby' | 'solid' | 'tuxedo' | 'calico' | 'points';

export interface OwlPalette {
  id: string;
  name: string;
  pattern: CoatPattern;
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
  /** cost in acorns; moonstones for premium coats */
  price: number;
  premium?: boolean;
  blurb: string;
  /** found on adventures in this area instead of the shop */
  unlock?: string;
}

export const PALETTES: OwlPalette[] = [
  {
    id: 'tabby', name: 'Toasty Tabby', pattern: 'tabby', price: 0, blurb: 'The original Meowl: tabby stripes, golden wings, a very soft white chest.',
    fur: '#c4935f', stripe: '#6a4a33', wing: '#cf8f52', speck: '#a39d96', belly: '#fdfaf3', muzzle: '#fffdf8', ear: '#f2a9ae', nose: '#f39aa5',
    paw: '#fbf7ef', eye: '#16131b', liner: '#4a3427', blush: '#ffb3c0',
  },
  {
    id: 'ginger', name: 'Marmalade', pattern: 'tabby', price: 600, blurb: 'Orange as a sunset and twice as warm.',
    fur: '#e79a52', stripe: '#b45f2c', wing: '#eca765', speck: '#fff0dc', belly: '#fffaf2', muzzle: '#ffffff', ear: '#f7b1a8', nose: '#f6a0a0',
    paw: '#fff9f0', eye: '#1b1410', liner: '#8a4a24', blush: '#ffab9c',
  },
  {
    id: 'snow', name: 'Snowdrift', pattern: 'solid', price: 900, blurb: 'White as fresh snow, wings flecked with ink.',
    fur: '#f7f5f1', stripe: '#d9d4cd', wing: '#f4f3f1', speck: '#3c3f4a', belly: '#ffffff', muzzle: '#ffffff', ear: '#f6b4bf', nose: '#f7a6b4',
    paw: '#ffffff', eye: '#141724', liner: '#a6a09a', blush: '#ffb9c8',
  },
  {
    id: 'tuxedo', name: 'Tuxedo', pattern: 'tuxedo', price: 1100, blurb: 'Always dressed for a fancy midnight dinner.',
    fur: '#2f2c33', stripe: '#1c1a20', wing: '#3d3942', speck: '#d9d7dd', belly: '#ffffff', muzzle: '#ffffff', ear: '#e79aa6', nose: '#f19aab',
    paw: '#ffffff', eye: '#0f0e14', liner: '#141217', blush: '#ff9fb4',
  },
  {
    id: 'calico', name: 'Calico Patchwork', pattern: 'calico', price: 1400, blurb: 'Three colours, zero matching socks.', unlock: 'grotto',
    fur: '#f6f1ea', stripe: '#2f2a2a', patch: '#e48d45', wing: '#e2a066', speck: '#5a4a42', belly: '#ffffff', muzzle: '#ffffff', ear: '#f2a9ae', nose: '#f39aa5',
    paw: '#ffffff', eye: '#17131a', liner: '#3e3330', blush: '#ffb3c0',
  },
  {
    id: 'siamese', name: 'Moonlit Siamese', pattern: 'points', price: 1600, blurb: 'Cream fur with chocolate points and starry blue eyes.',
    fur: '#f1e2cc', stripe: '#5c4434', wing: '#e8d2b4', speck: '#7a6a5e', belly: '#fffaf2', muzzle: '#fbf1e2', ear: '#c99a8e', nose: '#7a5048',
    paw: '#fbf3e6', eye: '#1c2f6a', liner: '#4a3428', blush: '#f7b3b0',
  },
  {
    id: 'midnight', name: 'Midnight', pattern: 'tabby', price: 120, premium: true, blurb: 'Sewn from the deep blue between the stars.',
    fur: '#4a5a92', stripe: '#262f5e', wing: '#55689f', speck: '#d6e0ff', belly: '#e6ebff', muzzle: '#f1f4ff', ear: '#c9a6ff', nose: '#c9a6ff',
    paw: '#eef1ff', eye: '#0c1030', liner: '#1c2350', blush: '#c79bff',
  },
  {
    id: 'ember', name: 'Ember', pattern: 'tabby', price: 150, premium: true, blurb: 'Glows like the last log in the fireplace.',
    fur: '#d4603a', stripe: '#7d2a17', wing: '#e07a44', speck: '#ffd59a', belly: '#fff0dc', muzzle: '#fff6e8', ear: '#ffb08a', nose: '#ff8f8f',
    paw: '#fff3e2', eye: '#1e0c08', liner: '#6a2213', blush: '#ff8f8f',
  },
  {
    id: 'aurora', name: 'Aurora', pattern: 'tabby', price: 200, premium: true, blurb: 'Fur that shimmers like the northern lights.',
    fur: '#6fc6b8', stripe: '#2f7f8c', wing: '#8fd6c8', speck: '#ffffff', belly: '#f0fffb', muzzle: '#f8fffd', ear: '#ffaedc', nose: '#ff9fd2',
    paw: '#f4fffc', eye: '#10233a', liner: '#235a6b', blush: '#ff9fd2',
  },
];

export const PALETTE: Record<string, OwlPalette> = Object.fromEntries(PALETTES.map((p) => [p.id, p]));
export const palette = (id: string): OwlPalette => PALETTE[id] ?? PALETTES[0];
