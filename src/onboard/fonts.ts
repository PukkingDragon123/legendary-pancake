// The office's typeface: Alagard, the game's one font (src/ui/font.ts), loaded once before any paper is
// printed. It is drawn at whole multiples of its 16 px grid and alpha-snapped (tex.ts crispText), so print on
// the forms, the name plate, the certificate and Pip's speech is crisp pixel type. The four old roles keep
// their names so callers read the same; the sizes snap to the grid (12 -> 16, 18 -> 16, 24 -> 32).
import { alagard, alagardReady } from '../ui/font.ts';

export const F = {
  /** Pip's handwriting, signatures, big titles */
  hand: (px = 16) => alagard(px / 16),
  /** the forms' printed text */
  body: (px = 16) => alagard(px / 16),
  /** fine print */
  small: (px = 16) => alagard(px / 16),
  /** letterhead caps and numbers (Alagard has one weight) */
  caps: (px = 16, _bold = true) => alagard(px / 16),
};

/** Load every face the forms use (resolves even if the face fails; canvas text then falls back). */
export function fontsReady(): Promise<void> {
  return alagardReady();
}
