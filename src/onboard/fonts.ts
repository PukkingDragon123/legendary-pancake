// [type16] The office's typefaces: the game's two faces (src/ui/font.ts), loaded once before any paper is printed. The
// four roles keep their names so callers read the same: Pip's hand and signatures in the display face's italic, the
// letterhead and big titles in the display face, the forms' print and fine print in the body face.
import { fontPx, fontReady } from '../ui/font.ts';

/** the callers' sizes were set for the old faces; the same lettering reads at about this much more */
const k = (px: number) => px * 1.2;
export const F = {
  /** Pip's handwriting, signatures, big titles */
  hand: (px = 16) => fontPx(k(px), { display: true, weight: 600, italic: true }),
  /** the forms' printed text */
  body: (px = 16) => fontPx(k(px)),
  /** fine print */
  small: (px = 16) => fontPx(k(px) * 0.95),
  /** letterhead caps and numbers */
  caps: (px = 16, _bold = true) => fontPx(k(px), { caps: true }),
};

/** Load every face the forms use (resolves even if the face fails; canvas text then falls back). */
export function fontsReady(): Promise<void> {
  return fontReady();
}
