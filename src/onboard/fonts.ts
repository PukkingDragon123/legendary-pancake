// The office's typefaces, loaded once before any paper is printed. Pixel fonts drawn at their native sizes
// (or whole multiples), alpha-snapped, so print on the 3D paper is crisp pixel type:
//   DISPLAY  TBME Body (the game's hand-lettered face): Pip's handwriting, signatures, big titles
//   BODY     m6x11plus (Daniel Linssen): the forms' printed text
//   SMALL    m5x7 (Daniel Linssen): fine print
//   KOREAN-STYLE PIXEL GOTHIC Galmuri11 (bold): letterhead caps and numbers
import m6 from '../assets/fonts/m6x11plus.woff2?url';
import m5 from '../assets/fonts/m5x7.woff2?url';

export const F = {
  hand: (px: number) => `${px}px "TBME Body", monospace`,
  body: (px = 18) => `${px}px "HH m6x11", monospace`,
  small: (px = 16) => `${px}px "HH m5x7", monospace`,
  caps: (px = 12, bold = true) => `${bold ? 'bold ' : ''}${px}px "Galmuri", monospace`,
};

let ready: Promise<void> | null = null;
/** Load every face the forms use (resolves even if a face fails; canvas text then falls back). */
export function fontsReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      const faces = [new FontFace('HH m6x11', `url(${m6})`), new FontFace('HH m5x7', `url(${m5})`)];
      for (const f of faces) { try { document.fonts.add(await f.load()); } catch { /* fall back */ } }
      await Promise.all([F.hand(16), F.body(), F.small(), F.caps(12), F.caps(12, false)].map((f) => document.fonts.load(f, 'Aa1').catch(() => undefined)));
    } catch { /* no FontFace API */ }
  })();
  return ready;
}
