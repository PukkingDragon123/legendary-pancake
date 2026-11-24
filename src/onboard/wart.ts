// Pixel art for the interview's interactive widgets (pixart.ts painter, calm palette): the wooden shelf, a
// sky strip for the early-bird lever, the sticker sheet, the ink pad, the microphone switch plate, cassette
// tapes, moon phases, a brass slider knob, the wake-up dial and a 3x5 digit font, and pencil loops that
// circle what you chose.
import { P, hex, mixc } from '../gfx/palette.ts';
import { art, fbm, GRAPHITE, hash, INK, paperFill, Pix, R, screw, step, vnoise, woodFill } from './pixart.ts';

/** A wooden shelf plank seen from the front, w x 12 texels. */
export const shelfURL = (w: number) => art('shelf' + w, () => {
  const p = new Pix(w, 14);
  woodFill(p, 0, 0, w, 4, R.woodLight, { seed: 2, base: 3.6 });
  woodFill(p, 0, 4, w, 7, R.wood, { seed: 5, bevel: true });
  for (let x = 0; x < w; x++) { p.set(x, 11, hex(mixc(P.ink, P.slate, 0.4)), 120); p.set(x, 12, hex(mixc(P.ink, P.slate, 0.4)), 60); }
  for (const bx of [8, w - 12]) { p.rect(bx, 11, 4, 3, R.woodDark[2]); p.set(bx, 11, R.woodDark[4]); }
  p.hline(0, w - 1, 0, R.woodLight[5]);
  return p;
});

/** The sky from dawn to deep night (the early bird / night owl lever runs along it). */
export const skyStripURL = (w = 120, h = 22) => art(`sky${w}x${h}`, () => {
  const p = new Pix(w, h);
  const stops: [number, string[]][] = [[0, R.blush], [0.14, R.lamp], [0.3, R.mist], [0.55, R.sky], [0.7, R.lake], [0.8, R.dusk], [0.9, R.night], [1.01, R.deep]];
  for (let x = 0; x < w; x++) {
    const u = x / (w - 1);
    let k = 0;
    while (k < stops.length - 2 && stops[k + 1][0] <= u) k++;
    const t0 = stops[k][0], t1 = stops[k + 1][0], f = (u - t0) / (t1 - t0);
    for (let y = 0; y < h; y++) {
      const r = f + (bayer2(x, y) - 0.5) * 0.5 > 0.5 ? stops[k + 1][1] : stops[k][1];
      p.set(x, y, r[y < 3 ? 4 : y > h - 4 ? 2 : 3]);
    }
  }
  // hills along the bottom and stars at the night end
  for (let x = 0; x < w; x++) { const hh = 3 + Math.round(Math.sin(x * 0.13) * 1.5 + Math.sin(x * 0.05 + 1) * 1.2); for (let y = h - hh; y < h; y++) p.set(x, y, step(R.pine, 2.6 + (y === h - hh ? 1 : 0) - x / w, x, y)); }
  for (let i = 0; i < 16; i++) { const x = Math.floor(w * 0.72 + hash(i, 1) * w * 0.27), y = Math.floor(hash(i, 2) * (h - 8)) + 1; p.set(x, y, R.cream[5]); }
  for (let x = 0; x < w; x++) { p.set(x, 0, INK); p.set(x, h - 1, INK); }
  for (let y = 0; y < h; y++) { p.set(0, y, INK); p.set(w - 1, y, INK); }
  return p;
});
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer2 = (x: number, y: number) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

/** The backing paper of a sticker sheet: waxy sage with a printed border. */
export const stickerSheetURL = (w: number, h: number) => art(`ss${w}x${h}`, () => {
  const p = new Pix(w, h);
  paperFill(p, 0, 0, w, h, R.mist, 6, 3.6);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 6 === 0 && hash(x, y, 2) > 0.5) p.set(x, y, R.mist[3]);
  for (let x = 2; x < w - 2; x++) { p.set(x, 2, R.sage[2]); p.set(x, h - 3, R.sage[2]); }
  for (let y = 2; y < h - 2; y++) { p.set(2, y, R.sage[2]); p.set(w - 3, y, R.sage[2]); }
  for (let x = 0; x < w; x++) { p.set(x, 0, R.mist[1]); p.set(x, h - 1, R.mist[0]); }
  for (let y = 0; y < h; y++) { p.set(0, y, R.mist[1]); p.set(w - 1, y, R.mist[0]); }
  p.corners(2);
  return p;
});

/** A tin ink pad with dusk felt, the lid open behind it. */
export const inkPadURL = () => art('inkpad', () => {
  const W = 40, H = 22, p = new Pix(W, H);
  p.rect(2, 0, 36, 7, (x, y) => R.iron[y === 0 ? 5 : y < 3 ? 4 : 3]);
  p.rect(0, 8, 40, 13, (x, y) => R.iron[y === 8 ? 5 : y > 18 ? 1 : 3]);
  p.rect(3, 9, 34, 8, (x, y) => step(R.berry, 2.2 + (vnoise(x * 0.3, y * 0.5, 4) - 0.5) * 1.4 + (y === 9 ? 0.8 : 0), x, y));
  for (let x = 6; x < 34; x += 7) p.set(x, 12, R.berry[3]);
  return p.outline(INK).drop(1, 2);
});

/** The microphone's switch plate: brass with four screws, LISTEN / NOT NOW engraved bands. */
export const plateURL = () => art('plate', () => {
  const W = 46, H = 64, p = new Pix(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    p.set(x, y, e === 0 ? R.brass[1] : e === 1 ? R.brass[y < H / 2 ? 5 : 4] : step(R.brass, 3.2 + (fbm(x * 0.2, y * 0.05, 2) - 0.5) * 1.2, x, y, 0.4));
  }
  for (const [x, y] of [[6, 6], [W - 7, 6], [6, H - 7], [W - 7, H - 7]]) screw(p, x, y, 2.5, R.iron, x * 0.1 + y * 0.03);
  p.rect(14, 12, 18, 40, R.brass[1]); p.rect(15, 13, 16, 38, R.woodDeep[1]);
  return p.corners(1).outline(INK).drop(1, 2);
});
/** The toggle lever (up = on), drawn to sit in the plate's slot. */
export const leverURL = (on: boolean) => art('lever' + on, () => {
  const W = 20, H = 40, p = new Pix(W, H);
  p.disc(10, 20, 6, 6, (nx, ny, x, y) => step(R.iron, 3.6 - nx - ny, x, y));
  const y0 = on ? 3 : 20, y1 = on ? 20 : 36;
  for (let y = y0; y < y1; y++) for (let x = 8; x < 12; x++) p.set(x, y, R.frost[x === 8 ? 5 : x === 11 ? 1 : 3]);
  p.disc(10, on ? 4 : 35, 4, 4, (nx, ny, x, y) => step(R.berry, 3.4 - nx - ny * 1.2, x, y));
  return p.outline(INK);
});

/** A cassette tape: oat shell, a coloured label strip, a window with two reels. */
export const cassetteURL = (col: keyof typeof R) => art('cas' + col, () => {
  const W = 44, H = 28, p = new Pix(W, H), sh = R.oat, lab = R[col];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    p.set(x, y, e === 0 ? sh[1] : e === 1 ? sh[y < 3 ? 5 : 4] : step(sh, 3.4 + (hash(x, y, 3) > 0.92 ? -0.6 : 0), x, y));
  }
  // the label, with a ruled title line
  for (let y = 3; y < 16; y++) for (let x = 3; x < W - 3; x++) p.set(x, y, y < 5 ? lab[4] : y > 13 ? lab[2] : step(lab, 3.2 + (vnoise(x * 0.2, y * 0.3, 7) - 0.5) * 0.6, x, y));
  for (let x = 5; x < W - 5; x++) p.set(x, 5, lab[5]);
  // the window with two reels of tape
  p.rect(12, 17, 20, 6, R.woodDeep[1]);
  for (const cx of [16, 28]) { p.disc(cx, 20, 3, 3, R.woodDeep[3]); p.disc(cx, 20, 1.3, 1.3, R.paper[4]); }
  p.rect(16, 22, 12, 1, R.woodDeep[2]);
  for (const [x, y] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]) p.set(x, y, sh[1]);
  p.poly([[9, H - 1], [W - 9, H - 1], [W - 11, 24], [11, 24]], sh[2]);
  p.corners(2);
  return p.outline(INK).drop(1, 2);
});

/** A moon at phase f (0 = new, 1 = full), lit or asleep in the night. */
export const moonURL = (f: number, lit: boolean, half = false) => art(`moon${f.toFixed(2)}${lit}${half}`, () => {
  const p = new Pix(16, 16), r = lit ? R.lamp : R.slate;
  p.disc(8, 8, 6.6, 6.6, (nx, ny, x, y) => {
    // the shadow edge moves across as the phase fills
    const edge = 1 - 2 * f;
    const sh = nx < edge * Math.sqrt(Math.max(0, 1 - ny * ny));
    if (sh) return lit ? R.night[3] : R.night[2];
    if (half && nx > 0.1) return R.night[3];
    return step(r, (lit ? 4 : 3) - ny * 0.8 + (hash(x, y, 4) > 0.86 ? -0.8 : 0), x, y);
  });
  return p.outline(INK);
});

/** The brass slider knob with a grip. */
export const knobURL = () => art('knob', () => {
  const p = new Pix(14, 22);
  for (let y = 0; y < 22; y++) for (let x = 0; x < 14; x++) p.set(x, y, R.brass[x === 0 || y === 0 ? 5 : x === 13 || y === 21 ? 1 : y < 4 ? 4 : 3]);
  for (let y = 6; y < 17; y += 3) { p.hline(3, 10, y, R.brass[1]); p.hline(3, 10, y + 1, R.brass[5]); }
  return p.corners(1).outline(INK).drop(1, 2);
});

// ------------------------------------------------------------------ digits

const DIG: Record<string, string[]> = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'], 6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '###'],
};
export function digits(p: Pix, s: string, cx: number, cy: number, c: string) {
  const w = s.length * 4 - 1;
  let x = Math.round(cx - w / 2);
  const y0 = Math.round(cy - 2.5);
  for (const ch of s) {
    const g = DIG[ch];
    if (g) g.forEach((row, yy) => { for (let xx = 0; xx < 3; xx++) if (row[xx] === '#') p.set(x + xx, y0 + yy, c); });
    x += 4;
  }
}

// ------------------------------------------------------------------ the wake-up dial

/** Paint the 24-hour dial with the hand at `min` minutes after midnight. */
export function paintDial(min: number, hour12: boolean): Pix {
  const S = 112, c = S / 2, p = new Pix(S, S);
  const skyAt = (h: number): string[] => (h < 5 || h >= 21 ? R.night : h < 6 || h >= 20 ? R.plum : h < 7 || h >= 19 ? R.blush : h < 8 || h >= 18 ? R.lamp : R.sky);
  const a = (min / 1440) * Math.PI * 2;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
    if (d > 54) continue;
    let ang = Math.atan2(dx, -dy); if (ang < 0) ang += Math.PI * 2;
    const lit = -dx - dy; // light from the upper left
    if (d > 49) { p.set(x, y, step(R.brass, 3.2 + lit / 40 + (d > 53 ? -1.4 : d < 50 ? -0.8 : 0.4), x, y)); continue; }
    if (d > 47) { p.set(x, y, R.woodDeep[1]); continue; }
    if (d > 34) {
      const h = Math.floor((ang / (Math.PI * 2)) * 24);
      const r = skyAt(h);
      let t = h % 2 ? 3 : 3.4;
      if (d > 45) t += 0.6;
      if (d < 36) t -= 0.8;
      const star = r === R.night && hash(x, y, 5) > 0.94;
      p.set(x, y, star ? R.cream[5] : step(r, t, x, y, 0.3));
      continue;
    }
    if (d > 32) { p.set(x, y, R.brass[d > 33 ? 2 : 4]); continue; }
    p.set(x, y, step(R.paper, 4 + (fbm(x * 0.1, y * 0.1, 3) - 0.5) * 0.7 - (d > 29 ? 0.6 : 0), x, y, 0.3));
  }
  // hour ticks and numbers
  for (let h = 0; h < 24; h++) {
    const an = (h / 24) * Math.PI * 2, big = h % 6 === 0;
    for (let r = 29; r > (big ? 25 : 27); r--) p.set(Math.floor(c + Math.sin(an) * r), Math.floor(c - Math.cos(an) * r), big ? INK : GRAPHITE);
  }
  const lab = hour12 ? ['12', '6', '12', '6'] : ['0', '6', '12', '18'];
  [0, 6, 12, 18].forEach((h, i) => { const an = (h / 24) * Math.PI * 2; digits(p, lab[i], c + Math.sin(an) * 19, c - Math.cos(an) * 19, INK); });
  // a sun at noon and a moon at midnight, printed small on the face
  p.disc(c, c + 10, 2.2, 2.2, R.ochre[4]);
  p.disc(c, c - 10, 2.2, 2.2, R.dusk[3]); p.disc(c + 1, c - 10.6, 1.8, 1.8, R.paper[4]);
  // the hand: a tapered ink needle, a brass counterweight and a knob on the sky ring that carries the sun or moon
  const ex = c + Math.sin(a) * 41, ey = c - Math.cos(a) * 41;
  p.line(c, c, c - Math.sin(a) * 8, c + Math.cos(a) * 8, R.brass[2]);
  for (const o of [-0.6, 0, 0.6]) p.line(c + Math.cos(a) * o, c + Math.sin(a) * o, ex + Math.cos(a) * o * 0.3, ey + Math.sin(a) * o * 0.3, INK);
  p.disc(c, c, 3.2, 3.2, (nx, ny, x, y) => step(R.brass, 3.6 - nx - ny, x, y));
  const hr = min / 60, day = hr >= 6.5 && hr < 19;
  p.disc(ex, ey, 7, 7, INK);
  p.disc(ex, ey, 6, 6, (nx, ny, x, y) => step(day ? R.lamp : R.mist, 3.8 - nx - ny * 1.2, x, y));
  if (day) { for (let k = 0; k < 8; k++) { const q = (k / 8) * Math.PI * 2; p.set(Math.round(ex + Math.cos(q) * 3.6 - 0.5), Math.round(ey + Math.sin(q) * 3.6 - 0.5), R.ochre[3]); } p.disc(ex, ey, 2.2, 2.2, R.honey[3]); }
  else { p.disc(ex - 0.5, ey, 3.2, 3.2, R.lamp[4]); p.disc(ex + 1.1, ey - 0.8, 2.8, 2.8, R.mist[3]); }
  return p;
}

// ------------------------------------------------------------------ pencil marks

/** A rough graphite loop (a hand circling an answer), w x h texels; drawn as a stepped wobbly ellipse. */
export const loopURL = (w: number, h: number, seed = 1) => art(`loop${w}x${h}:${seed}`, () => {
  const p = new Pix(w, h), cx = w / 2, cy = h / 2;
  const g = GRAPHITE, g2 = hex(mixc(P.ink2, P.paper, 0.35));
  for (let i = 0; i < 440; i++) {
    const t = (i / 400) * Math.PI * 2 + 0.3;
    const wob = 1 + Math.sin(t * 3 + seed) * 0.025 + (i > 400 ? 0.05 : 0);
    const x = cx + Math.cos(t) * (cx - 2) * wob, y = cy + Math.sin(t) * (cy - 2) * (2 - wob);
    p.set(x, y, i % 9 === 0 ? g2 : g);
  }
  return p;
});
/** A short pencil underline. */
export const underlineURL = (w: number, seed = 1) => art(`ul${w}:${seed}`, () => {
  const p = new Pix(w, 4);
  for (let x = 0; x < w; x++) { const y = Math.round(1.5 + Math.sin(x * 0.2 + seed) * 0.8); p.set(x, y, x % 11 === 0 ? null : GRAPHITE); }
  return p;
});
