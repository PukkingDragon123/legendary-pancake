// Where the book sits on screen: a two-page spread on wide screens, one page on phones. Sizes are
// in texels (T CSS px each) so the pixel art lines up; page contents are laid out in CSS px.
export interface BookLayout {
  vw: number; vh: number;
  /** CSS px per texel */
  T: number;
  single: boolean;
  /** board margin around the pages, tab overhang, ribbon tail length (texels) */
  B: number; TAB: number; TAIL: number;
  /** one page, texels and CSS px */
  pw: number; ph: number; PW: number; PH: number;
  /** the open book's board, texels and CSS px */
  W: number; H: number; BW: number; BH: number;
  /** top-left of the open book on screen (CSS px) */
  x: number; y: number;
  /** page origin inside the book (CSS px): the spine top of the right page, or the single page's corner */
  ox: number; oy: number;
  /** the shut cover: left edge inside the book and width (CSS px) */
  cx: number; cw: number;
  /** horizontal shift that centres the shut book on screen (CSS px) */
  shut: number;
  /** spine thickness of the shut book (texels) */
  D: number;
  /** where little Pip rests while the book is open: left edge and floor line (CSS px) */
  pip: { x: number; y: number; size: number };
  /** base font size for page contents */
  fs: number;
  /** ledger rules on ruled pages: spacing and first rule (CSS px from the page top, whole texels) */
  rule: number; r0: number;
}

export function layout(vw: number, vh: number): BookLayout {
  const single = vw < 760 || vh < 560;
  const T = vw >= 1700 && vh >= 1150 ? 3 : 2;
  const B = 7, TAB = 9, TAIL = 13;
  const gut = single ? 14 : 22;
  let pw: number, ph: number;
  if (single) {
    pw = Math.floor((vw - 2 * gut) / T) - 2 * B;
    const room = Math.floor((vh - 2 * gut - 70) / T) - 2 * B - TAB - TAIL;
    ph = Math.max(200, Math.min(Math.round(pw * 1.62), room));
  } else {
    const room = Math.floor((vh - 2 * gut) / T) - 2 * B - TAIL;
    ph = Math.min(330, room);
    pw = Math.min(Math.round(ph * 0.8), Math.floor(((vw - 2 * gut) / T - 2 * B - 2 * TAB - 40) / 2));
  }
  pw = Math.max(140, pw);
  const W = single ? pw + 2 * B : 2 * (pw + B), H = ph + 2 * B;
  const BW = W * T, BH = H * T;
  const snap = (v: number) => Math.round(v / T) * T;
  const x = snap((vw - BW) / 2);
  const free = vh - BH - TAIL * T - (single ? TAB * T : 0);
  const y = snap(single ? Math.max(gut + TAB * T, free * 0.38 + TAB * T) : free / 2);
  const ox = (single ? B : pw + B) * T, oy = B * T;
  const cx = single ? 0 : (pw + B) * T, cw = (single ? pw + 2 * B : pw + B) * T;
  const shut = single ? 0 : -cw / 2;
  // Pip waits beside the book when there is room (drawn bigger on roomy screens), otherwise on the
  // floor under its bottom-left corner
  let size = 34 * (single ? T : T + 1);
  let besideX = x - size - TAB * T - 2;
  if (besideX < 4 && !single) { size = 34 * T; besideX = x - size - TAB * T - 2; }
  const pip = besideX >= 4 ? { x: besideX, y: y + BH, size } : { x: Math.max(4, x + 6), y: Math.min(vh - 8, y + BH + TAIL * T + size * 0.9), size };
  const PW = pw * T, PH = ph * T;
  const fs = Math.round(Math.max(14, Math.min(19, PW / 25)));
  const rule = Math.max(6, Math.round((fs * 1.5) / T)) * T;
  const r0 = Math.ceil((15 * T + 2.72 * fs + 10) / T) * T;
  return { vw, vh, T, single, B, TAB, TAIL, pw, ph, PW, PH, W, H, BW, BH, x, y, ox, oy, cx, cw, shut, D: 24, pip, fs, rule, r0 };
}
