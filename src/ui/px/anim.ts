// Idle animation frames for the currency sprites (src/ui/px/currency.js). A sprite `name` with N
// frames also exists as `name_f0` .. `name_f{N-1}`; cycle them at about `CURRENCY_FPS`.
import './currency.js';

export const CURRENCY_FRAMES = { owlcoin: 8, moongem: 8, acorn_big: 8, gem_big: 8, coin_vault: 4 } as const;
export type AnimatedSprite = keyof typeof CURRENCY_FRAMES;
export const CURRENCY_FPS = 8;

/** The frame of an animated sprite to show at time `ms` (falls back to the plain name). */
export function frameAt(name: string, ms = performance.now(), fps = CURRENCY_FPS): string {
  const n = (CURRENCY_FRAMES as Record<string, number>)[name];
  if (!n) return name;
  return `${name}_f${Math.floor((ms / 1000) * fps) % n}`;
}
