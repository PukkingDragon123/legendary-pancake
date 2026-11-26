// The office's typefaces: the game's Alegreya (src/ui/font.ts), loaded once before any paper is printed. The four
// roles keep their names so callers read the same: Pip's hand is the italic, the forms are the book face, fine
// print a lighter weight, and the letterhead is set in Alegreya SC's small capitals.
import { fontPx, fontReady } from '../ui/font.ts';

/** the old pixel sizes were drawn on a 16 px grid; Alegreya reads the same about 1.1x larger */
const k = (px: number) => px * 1.1;
export const F = {
  /** Pip's handwriting, signatures, big titles */
  hand: (px = 16) => fontPx(k(px), { italic: true, weight: 600 }),
  /** the forms' printed text */
  body: (px = 16) => fontPx(k(px), { weight: 500 }),
  /** fine print */
  small: (px = 16) => fontPx(k(px), { weight: 500 }),
  /** letterhead caps and numbers */
  caps: (px = 16, bold = true) => bold ? fontPx(k(px), { caps: true }) : fontPx(k(px), { weight: 700 }),
};

/** Load every face the forms use (resolves even if the face fails; canvas text then falls back). */
export function fontsReady(): Promise<void> {
  return fontReady();
}
