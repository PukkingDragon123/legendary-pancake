// Where the diary sits on screen: a two-page spread on wide screens, one page on phones. Sizes are
// in texels (T CSS px each) so the pixel art lines up; page contents are laid out in CSS px.
import { fontPx } from '../../gfx/artpx.ts';

export interface BookLayout {
  vw: number; vh: number;
  /** CSS px per texel */
  T: number;
  single: boolean;
  /** leather margin around the pages (texels) */
  B: number;
  /** one page, texels and CSS px */
  pw: number; ph: number; PW: number; PH: number;
  /** the open board, texels and CSS px */
  W: number; H: number; BW: number; BH: number;
  /** top-left of the board on screen (CSS px) */
  x: number; y: number;
  /** base font size for page contents (CSS px) */
  fs: number;
  /** height of the tabs above the board (CSS px) */
  tabH: number;
}

export function layout(vw: number, vh: number): BookLayout {
  const single = vw < 760 || vh < 560;
  const T = vw >= 1700 && vh >= 1100 ? 3 : 2;
  const B = 6, gut = single ? 10 : 24;
  const tabH = 25 * T;
  const footer = single ? 64 : 70;       // the arrows and the close button under the book
  let pw: number, ph: number;
  if (single) {
    pw = Math.floor((vw - 2 * gut) / T) - 2 * B;
    ph = Math.floor((vh - tabH - footer - gut - 8) / T) - 2 * B;
    ph = Math.max(220, Math.min(ph, Math.round(pw * 1.9)));
  } else {
    ph = Math.min(340, Math.floor((vh - tabH - footer - 2 * gut) / T) - 2 * B);
    pw = Math.min(Math.round(ph * 0.78), Math.floor(((vw - 2 * gut) / T - 3 * B) / 2));
  }
  pw = Math.max(150, pw);
  const W = single ? pw + 2 * B : 2 * pw + 2 * B, H = ph + 2 * B;
  const BW = W * T, BH = H * T;
  const snap = (v: number) => Math.round(v / T) * T;
  const x = snap((vw - BW) / 2);
  const y = snap(Math.max(tabH + 6, (vh - BH - footer + tabH) / 2));
  const PW = pw * T, PH = ph * T;
  const fs = fontPx(1); // Alagard's grid: page text is 16 art pixels (titles 32), whatever the art pixel
  return { vw, vh, T, single, B, pw, ph, PW, PH, W, H, BW, BH, x, y, fs, tabH };
}
