// [tutor] The tour's pixel art: a pointing glove with a brass-buttoned cuff (drawn pointing up; the tour turns it
// in quarter turns, so its pixels stay whole), painted at one device pixel per art pixel x the art-pixel size and
// shown crisp. Colours follow the icons' rules: a warm cream ramp with violet shadows, a selective dark outline.

/** O outline, o soft outline, W glove, w glove shade, S shadow, B cuff, b cuff shade, Y brass, y brass shade, H highlight */
const HAND = [
  '.....OO........',
  '....OHWO.......',
  '....OWWO.......',
  '....OWwO.......',
  '....OWwO.......',
  '....OWwOOO.....',
  '....OWwOWWOO...',
  '..OOOWwOWwOWO..',
  '.OHWOWwOWwOwWO.',
  '.OWWOWWWWWWWwO.',
  '.OWWWWWWWWWWwO.',
  '.OWWWWWWWWWwwO.',
  '..OWWWWWWWwwSO.',
  '..OWWWWWWwwSO..',
  '...OSwwwwSSSO..',
  '...OBBBBBBBbO..',
  '...OBYBBBYBbO..',
  '...OByBBByBbO..',
  '...ObbbbbbbbO..',
  '....OOOOOOOO...',
];
const COL: Record<string, string> = {
  O: '#22141c', o: '#5a3a3a', W: '#fff4dc', w: '#e8cfa8', S: '#a58aa8', H: '#ffffff',
  B: '#9a2c2a', b: '#5e1820', Y: '#ffd66a', y: '#b07a22',
};
export const HAND_W = HAND[0].length;
export const HAND_H = HAND.length;
/** the fingertip, in art pixels from the sprite's top-left (pointing up) */
export const HAND_TIP = { x: 5.5, y: 0 };

const cache = new Map<number, string>();
/** the glove as a PNG at `s` device px per art pixel */
export function handURL(s: number): string {
  const k = Math.max(1, Math.round(s));
  let u = cache.get(k);
  if (u) return u;
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = HAND_W * k; c.height = HAND_H * k;
  const g = c.getContext('2d');
  if (!g) return '';
  HAND.forEach((row, y) => [...row].forEach((ch, x) => { const col = COL[ch]; if (col) { g.fillStyle = col; g.fillRect(x * k, y * k, k, k); } }));
  u = c.toDataURL('image/png');
  cache.set(k, u);
  return u;
}
