// Neve, the Snow Queen who runs the cosmetics boutique: an elegant snowy-owl lady toy (public/models/owls/queen.glb,
// art/blender/owls/owl.py) with her regalia built in: a crown of ice crystals, a frost-blue cape with a fur collar and
// a snowflake clasp, and a little ice scepter under her right wing; her ink-dot eyes carry lash ticks. Any look with
// `feminine: true` shows her model (the ice crown and frost cape in the outfit are part of it, not extra pieces).
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
