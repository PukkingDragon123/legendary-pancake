// The office's typefaces: the game's pixel faces (src/ui/font.ts), loaded once before any paper is printed. The four
// roles keep their names so callers read the same: Pip's hand, signatures and the letterhead in the chunky display
// face (Retro Sans); the forms' print and fine print in the body face (Quest Square). One weight, no italic.
import { fontPx, fontReady } from '../ui/font.ts';

/** the old sizes were drawn on a 16 px grid in a book face about 1.1x larger; fontPx turns that into the pixel grid */
const k = (px: number) => px * 1.1;
export const F = {
  /** Pip's handwriting, signatures, big titles */
  hand: (px = 16) => fontPx(k(px), { caps: true }),
  /** the forms' printed text */
  body: (px = 16) => fontPx(k(px)),
  /** fine print */
  small: (px = 16) => fontPx(k(px)),
  /** letterhead caps and numbers */
  caps: (px = 16, _bold = true) => fontPx(k(px), { caps: true }),
};

/** Load every face the forms use (resolves even if the face fails; canvas text then falls back). */
export function fontsReady(): Promise<void> {
  return fontReady();
}
