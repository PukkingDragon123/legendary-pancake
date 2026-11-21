// Neve, the Snow Queen who runs the cosmetics boutique: a snowy owl in the cleaner, nearly pure
// white plumage, with long lashes and a soft blush (look.feminine), a crown of ice crystals, a frost
// cape embroidered with snowflakes and trimmed in white fur, and a little ice scepter under her wing.
// The shop builds her with `new OwlActor(QUEEN_LOOK, ...)` and can pose her with QUEEN_POSE.
import type { OwlLook } from './model.ts';

export const QUEEN_NAME = 'Queen Neve';
export const QUEEN_LOOK: OwlLook = {
  skin: 'owl', species: 'snowy', palette: 'snowy',
  outfit: { head: 'ice_crown', back: 'frost_cape' },
  feminine: true, held: 'scepter',
};
/** How she carries herself: a composed, gracious mood and a slight regal lift of the chin. */
export const QUEEN_POSE = { mood: 'proud' as const, idle: 'calm' as const };
