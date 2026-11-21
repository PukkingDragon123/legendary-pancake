// Pixel art for the bedtime table and the morning: the cuckoo songbird, Pip's nest, carved moon
// ornaments, the candle, the mug, the phone, the bedroom window, the moon, presents and the gift
// sack, calendar stickers. (No 2D owl: Pip appears only as renders of the 3D model.)
// Everything is painted procedurally into an Art buffer at pixel resolution.
import { Art, ballShade, dtone, hash, INK, lit, tone, type Col } from './sleepart.ts';

// ------------------------------------------------------------------ little birds, the nest, carvings
// (Pip is never drawn in 2D: where Pip must appear the UI shows a render of the 3D model. These
// are the other small characters and ornaments of the sleep screens.)

export interface BirdPose {
  /** wing lift 0..1 */
  wing?: number;
  beak?: 'open' | 'closed';
  /** body squash: 1 = rest */
  squash?: number;
}
/**
 * The cuckoo-clock songbird: a round wren-like bird with a cocked tail, a dot eye, a pointed beak
 * and a barred wing, centred at (cx, cy). `k` scales it (1 = about 16 px long).
 */
export function songbird(a: Art, cx: number, cy: number, k = 1, p: BirdPose = {}) {
  const o = new Art(Math.ceil(24 * k) + 6, Math.ceil(22 * k) + 6);
  const ox = o.w / 2, oy = o.h / 2 + k, sq = p.squash ?? 1;
  // cocked tail
  o.poly([[ox - 5 * k, oy - 1 * k], [ox - 11 * k, oy - 7 * k], [ox - 9 * k, oy - 8.5 * k], [ox - 3.5 * k, oy - 3 * k]], (x, y) => dtone('cinnamon', 2.4 + ((Math.floor(x + y) % 3) ? 0.6 : 0), x, y));
  // body and head
  o.ell(ox, oy, 6.4 * k, 5 * k * sq, ballShade('cinnamon', ox, oy, 6 * k, 3, 1.8));
  o.ell(ox, oy + 1.8 * k, 4.2 * k, 2.8 * k * sq, (x, y) => dtone('parch', 3.6 + lit(x - ox, y - oy, 5 * k), x, y));
  o.disc(ox + 4.2 * k, oy - 3.4 * k, 3.4 * k, ballShade('cinnamon', ox + 4.2 * k, oy - 3.4 * k, 3.4 * k, 3.2, 1.6));
  // wing with bars, lifted when it sings
  const lift = (p.wing ?? 0) * 3 * k;
  o.ell(ox - 1 * k, oy - 0.6 * k - lift, 3.6 * k, 2.4 * k, (x, y) => (Math.floor(x - y) % 3 === 0 ? tone('cinnamon', 1) : tone('cinnamon', 2)));
  // eye (a simple dot) and brow stripe
  o.px(ox + 5 * k, oy - 4 * k, INK);
  o.line(ox + 2.6 * k, oy - 5.4 * k, ox + 6.6 * k, oy - 5 * k, tone('parch', 4));
  // beak
  if (p.beak === 'open') {
    o.poly([[ox + 7 * k, oy - 4.2 * k], [ox + 10.6 * k, oy - 5.4 * k], [ox + 7.2 * k, oy - 3.2 * k]], tone('honey', 4));
    o.poly([[ox + 7 * k, oy - 2.8 * k], [ox + 10 * k, oy - 1.8 * k], [ox + 7.2 * k, oy - 2.2 * k]], tone('honey', 2));
  } else o.poly([[ox + 7 * k, oy - 4 * k], [ox + 10.4 * k, oy - 3.2 * k], [ox + 7 * k, oy - 2.4 * k]], tone('honey', 3));
  // legs
  for (const dx of [-1.2, 1.2]) o.rect(ox + dx * k, oy + 4.6 * k * sq, Math.max(1, k * 0.8), Math.max(1, 1.6 * k), tone('wood', 1));
  o.outline(INK);
  a.stamp(o, cx - ox, cy - oy);
}

/**
 * A cosy woven nest with a patchwork blanket tucked in, a striped nightcap's pom poking out and a
 * little pillow: Pip's bed, seen from outside (no owl drawn). `breath` (about -1..1) lifts the
 * blanket. Centred on (cx, cy), about 40 x 20 px at k = 1.
 */
export function nest(a: Art, cx: number, cy: number, k = 1, breath = 0) {
  const o = new Art(Math.ceil(48 * k) + 4, Math.ceil(30 * k) + 4);
  const ox = o.w / 2, oy = o.h / 2 + 3 * k;
  // the blanket mound
  const lift = Math.round(breath * k);
  o.ell(ox + 2 * k, oy - 5 * k - lift, 14 * k, 7 * k, (x, y) => {
    const cx2 = Math.floor((x - ox) / (4 * k)), cy2 = Math.floor((y - oy) / (3 * k)), kk = ((cx2 * 3 + cy2 * 5) % 5 + 5) % 5;
    if (Math.floor(x - ox) % Math.round(4 * k) === 0 || Math.floor(y - oy) % Math.round(3 * k) === 0) return tone('blue', 2);
    const ramp = kk === 1 ? 'yellow' : kk === 3 ? 'red' : kk === 4 ? 'green' : 'blue';
    return dtone(ramp, 3 + lit(x - ox, y - oy + 5 * k, 12 * k) * 1.1, x, y);
  });
  // a little pillow and the nightcap pom peeking out
  o.ell(ox - 10 * k, oy - 6 * k, 5 * k, 3 * k, ballShade('cream', ox - 10 * k, oy - 6 * k, 5 * k, 3.6, 1.2));
  o.poly([[ox - 13 * k, oy - 8 * k], [ox - 6 * k, oy - 9.5 * k], [ox - 4 * k, oy - 13 * k]], (x, y) => ((Math.floor((x + y) / (2 * k)) % 2) ? tone('red', 3) : tone('cream', 4)));
  o.disc(ox - 3.6 * k, oy - 13.6 * k, 1.8 * k, ballShade('white', ox - 3.6 * k, oy - 13.6 * k, 1.8 * k, 4, 1));
  // the woven nest bowl: twigs crossing in bands, ends sticking out
  o.ell(ox, oy + 1 * k, 20 * k, 7.5 * k, (x, y) => {
    if (y < oy - 2 * k) return null;
    const band = Math.floor((y - oy) / (2 * k)), cross = Math.floor((x + band * 3 + (band % 2 ? y : -y) * 0.8) / (3 * k));
    return dtone((band + cross) % 3 === 0 ? 'wood' : 'lwood', 2.2 + ((cross % 2) ? 0.7 : 0) - Math.max(0, (y - oy) / (6 * k)), x, y);
  });
  for (let i = 0; i < 7; i++) {
    const x0 = ox - 19 * k + i * 6.2 * k, y0 = oy - 1 * k + (i % 2) * 2 * k;
    o.line(x0, y0, x0 + (i % 2 ? 4 : -4) * k, y0 - 2.5 * k, tone('wood', 3));
  }
  o.line(ox - 21 * k, oy + 1 * k, ox - 24 * k, oy - 1.5 * k, tone('lwood', 3));
  o.line(ox + 20 * k, oy + 0.5 * k, ox + 24 * k, oy - 2 * k, tone('lwood', 3));
  // a tuft of moss on the rim
  for (let x = Math.round(ox + 6 * k); x < ox + 13 * k; x++) o.px(x, Math.round(oy - 2 * k + (x % 2)), tone('moss', 4));
  o.outline(INK);
  a.stamp(o, cx - ox, cy - oy);
}

/** A carved crescent moon with a star: an ornament for clocks and frames. */
export function crescentOrnament(a: Art, cx: number, cy: number, r: number, ramp = 'wood') {
  const o = new Art(Math.ceil(r * 2) + 8, Math.ceil(r * 2) + 8);
  const ox = o.w / 2, oy = o.h / 2;
  o.disc(ox, oy, r, ballShade(ramp, ox, oy, r, 3.2, 1.6));
  for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) if (Math.hypot(x + 0.5 - (ox + r * 0.45), y + 0.5 - (oy - r * 0.3)) < r * 0.82) o.d[y * o.w + x] = 0;
  const sx = ox + r * 0.55, sy = oy + r * 0.1;
  o.px(sx, sy, tone(ramp, 5)); o.px(sx - 1, sy, tone(ramp, 4)); o.px(sx + 1, sy, tone(ramp, 4)); o.px(sx, sy - 1, tone(ramp, 4)); o.px(sx, sy + 1, tone(ramp, 4));
  o.outline(INK);
  a.stamp(o, cx - ox, cy - oy);
}

// ------------------------------------------------------------------ the moon

/** A pixel moon with craters and a soft glow ring; `phase` 0..1 (0.5 = full) carves the shadow. */
export function moon(a: Art, cx: number, cy: number, r: number, o: { phase?: number; glow?: number; face?: 'sleep' | 'none' } = {}) {
  const ph = o.phase ?? 0.5, glow = o.glow ?? 0.6;
  if (glow > 0) {
    const g1 = r + Math.max(2, r * 0.22), g2 = r + Math.max(3, r * 0.45);
    a.disc(cx, cy, g2, (x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); const k = d < g1 ? 0.5 : 0.25; return ((x + y) & 1) === 0 && ((x >> 1) + (y >> 1)) % 2 === 0 && bayer2(x, y) < k * glow * 2 ? '#c8b88a' : d < g1 && ((x + y) & 1) === 0 ? '#5a5a8a' : null; });
  }
  // the terminator: waxing lights the right side, waning the left
  const c = Math.cos(ph * Math.PI * 2);
  a.disc(cx, cy, r, (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, nx = dx / r, ny = dy / r, e = Math.sqrt(Math.max(0, 1 - ny * ny));
    const on = ph <= 0.5 ? nx > c * e : nx < -c * e;
    const l = lit(dx, dy, r);
    if (!on) return dtone('navy', 3.4 + l * 0.6, x, y);
    const crater = hash(Math.floor((x - cx + 50) / 3), Math.floor((y - cy + 50) / 3), 7) > 0.8 && hash(x, y, 3) > 0.35;
    return crater ? tone('cream', 2) : dtone('cream', 4 + l * 1.2, x, y);
  });
  if (o.face === 'sleep') {
    for (const sd of [-1, 1]) for (let i = -1; i <= 1; i++) a.px(cx + sd * r * 0.35 + i, cy - r * 0.05 + (i === 0 ? 1 : 0), tone('cream', 0));
    a.px(cx - r * 0.55, cy + r * 0.3, '#f6b8a8'); a.px(cx + r * 0.55, cy + r * 0.3, '#f6b8a8');
    a.line(cx - 1, cy + r * 0.38, cx + 1, cy + r * 0.38, tone('cream', 1));
  }
}
const bayer2 = (x: number, y: number) => (hash(x, y, 11) * 0.5 + (((x & 1) ^ (y & 1)) ? 0.25 : 0.75) * 0.5);

/** Moon phase 0..1 (0 = new, 0.5 = full) for a date. */
export function moonPhase(t = Date.now()) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  return ((((t - ref) / 86400000) % syn) + syn) % syn / syn;
}

// ------------------------------------------------------------------ the candle

/** A beeswax candle in a brass dish; frame f animates the flame. 18 x 36. */
export function candle(a: Art, x: number, y: number, f: number, lit_ = true) {
  const o = new Art(18, 36);
  // dish
  o.ell(9, 31, 8.5, 3, (X, Y) => dtone('brass', 3 + lit(X - 9, Y - 30, 6) * 1.6, X, Y));
  o.ell(9, 30.4, 6, 1.6, tone('brass', 1));
  // handle ring
  o.disc(16.5, 30, 2, (X, Y) => (Math.hypot(X + 0.5 - 16.5, Y + 0.5 - 30) > 1.1 ? tone('brass', 4) : null));
  // wax body with drips
  o.rect(5, 13, 8, 18, (X, Y) => dtone('cream', 3.6 + (X < 7 ? 1 : X > 10 ? -1.1 : 0.2) + (hash(X, Y) - 0.5) * 0.3, X, Y));
  o.ell(9, 13, 4, 1.4, tone('cream', 5));
  for (const [dx, len] of [[5, 5], [8, 3], [12, 7]]) o.rect(dx, 13, 1, len, tone('cream', dx < 7 ? 5 : dx > 10 ? 2 : 4));
  // wick
  o.rect(9, 10, 1, 3, INK);
  o.outline(INK);
  if (lit_) {
    const sway = [0, 1, 0, -1][f % 4], tall = [0, 1, 1, 0][(f + 1) % 4];
    o.poly([[7, 10], [11, 10], [10 + sway, 3 - tall], [8 + sway * 0.5, 5]], tone('fire', 3));
    o.poly([[8, 10], [10, 10], [9.5 + sway, 5 - tall]], tone('fire', 4));
    o.px(9, 9, tone('fire', 5)); o.px(9, 8, tone('fire', 5));
  } else {
    // a curl of smoke
    for (let i = 0; i < 6; i++) o.px(9 + Math.round(Math.sin(i * 1.3 + f * 0.6)), 8 - i, i % 2 ? '#9aa0b4' : '#c8ccd8');
  }
  a.stamp(o, x, y);
}

// ------------------------------------------------------------------ the mug

/** A mug: coffee (dark) or chamomile tea (with a tag); steam animates with f. 26 x 26. */
export function mug(a: Art, x: number, y: number, f: number, kind: 'coffee' | 'tea') {
  const o = new Art(26, 26);
  const ramp = kind === 'coffee' ? 'red' : 'mint';
  // handle
  o.disc(19.5, 16, 4.6, (X, Y) => (Math.hypot(X + 0.5 - 19.5, Y + 0.5 - 16) > 2.4 ? dtone(ramp, 3 + lit(X - 19, Y - 16, 4), X, Y) : null));
  // body
  o.rect(4, 9, 14, 15, (X, Y) => dtone(ramp, 3.3 + (X < 7 ? 1.2 : X > 14 ? -1 : 0) + (Y > 21 ? -0.6 : 0), X, Y));
  o.ell(11, 23.5, 7, 1.6, tone(ramp, 1));
  // rim and drink
  o.ell(11, 9, 7, 2.4, tone(ramp, 5));
  o.ell(11, 9.3, 5.6, 1.5, kind === 'coffee' ? tone('syrup', 1) : tone('yellow', 4));
  // a little pattern: hearts for coffee, a leaf for tea
  if (kind === 'coffee') { for (const [hx, hy] of [[7, 14], [12, 18]]) { o.px(hx, hy, '#fff0e8'); o.px(hx + 2, hy, '#fff0e8'); o.rect(hx, hy + 1, 3, 1, '#fff0e8'); o.px(hx + 1, hy + 2, '#fff0e8'); } }
  else { o.line(8, 18, 12, 14, tone('leaf', 2)); o.ell(10.5, 15.5, 2.2, 1.3, tone('leaf', 4)); }
  o.outline(INK);
  if (kind === 'tea') { o.line(15, 8, 18, 14, tone('white', 4)); o.rect(17, 14, 3, 4, tone('yellow', 4)); o.px(18, 15, tone('honey', 2)); }
  // steam
  for (let s = 0; s < 2; s++) for (let i = 0; i < 6; i++) {
    const yy = 6 - i - ((f + s * 2) % 3), xx = 8 + s * 5 + Math.round(Math.sin((i + f + s * 3) * 0.9) * 1.2);
    if (yy >= 0 && (i + f) % 5 !== 0) o.px(xx, yy, i < 2 ? '#eef0ff' : '#c4c8e0');
  }
  a.stamp(o, x, y);
}

// ------------------------------------------------------------------ the phone

/** The phone lying face-down (back, camera, case). `bed` tucks it under a little quilt. 22 x 34. */
export function phone(a: Art, x: number, y: number, bed: boolean) {
  const o = new Art(22, 34);
  if (bed) {
    // a matchbox-sized bed: headboard, pillow, quilt
    o.rect(1, 2, 20, 4, (X, Y) => dtone('wood', 3.4 + (Y < 3 ? 1 : 0), X, Y));
    o.rect(2, 6, 18, 27, (X, Y) => dtone('wood', 2.6, X, Y));
  }
  o.rect(bed ? 4 : 3, bed ? 5 : 2, 15, 28, (X, Y) => dtone('slate', 2.6 + (X < 6 ? 0.8 : 0) + (Y < 5 ? 0.6 : 0), X, Y));
  if (!bed) {
    o.rect(5, 4, 6, 7, tone('slate', 1));
    o.disc(7, 6, 1.4, tone('ink', 1)); o.disc(9.6, 8.6, 1.4, tone('ink', 1)); o.px(7, 6, '#9ab8e8');
    // a moon sticker on the case
    o.disc(12, 21, 3, tone('yellow', 4)); o.disc(13.4, 20, 2.6, tone('slate', 3));
  } else {
    // pillow
    o.rect(5, 6, 13, 5, (X, Y) => dtone('white', 4.4 - (Y > 9 ? 1 : 0), X, Y));
    // quilt with patches
    o.rect(3, 12, 17, 21, (X, Y) => ((Math.floor((X - 3) / 4) + Math.floor((Y - 12) / 4)) % 2 ? dtone('rose', 3.2, X, Y) : dtone('lilac', 3.6, X, Y)));
    o.rect(3, 12, 17, 2, tone('white', 4));
    for (let i = 0; i < 17; i += 2) o.px(3 + i, 32, tone('rose', 1));
  }
  o.outline(INK);
  a.stamp(o, x, y);
}

// ------------------------------------------------------------------ the bedroom window

/** A night window (size w x h): sky, stars, moon, treetops, wooden frame and plum curtains. */
export function nightWindow(a: Art, w: number, h: number, f: number, o: { phase?: number; dim?: number } = {}) {
  const fx = Math.round(w * 0.16), fw = w - fx * 2, fy = 4, fh = h - 10;
  // sky
  a.rect(fx, fy, fw, fh, (x, y) => dtone('navy', 1.2 + ((y - fy) / fh) * 2.6, x, y));
  for (let y = fy + fh - 10; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) if (bayer2(x, y) < (y - (fy + fh - 10)) / 12) a.px(x, y, tone('plum', 2));
  // stars
  for (let i = 0; i < 40; i++) {
    const sx = fx + Math.floor(hash(i, 1, 5) * fw), sy = fy + Math.floor(hash(i, 2, 5) * fh * 0.7);
    const tw = (Math.floor(f / 3) + i) % 7;
    if (tw === 0) continue;
    a.px(sx, sy, tw < 3 ? '#fff6d0' : '#a8b4e8');
    if (i % 9 === 0 && tw > 3) { a.px(sx - 1, sy, '#6c78b8'); a.px(sx + 1, sy, '#6c78b8'); a.px(sx, sy - 1, '#6c78b8'); a.px(sx, sy + 1, '#6c78b8'); }
  }
  const mr = Math.max(5, Math.round(fh * 0.16));
  moon(a, fx + fw * 0.7, fy + fh * 0.3, mr, { phase: o.phase ?? 0.5, glow: 0.5 });
  // treetops silhouette
  for (let x = fx; x < fx + fw; x++) {
    const n = Math.sin(x * 0.35) * 2 + Math.sin(x * 0.11 + 2) * 3 + hash(x, 0, 2) * 1.5;
    const top = fy + fh - 7 - Math.max(0, n);
    for (let y = Math.floor(top); y < fy + fh; y++) a.px(x, y, y - top < 1 ? '#1e2a3a' : '#121a28');
  }
  // window frame and mullions
  const wood = (x: number, y: number) => dtone('wood', 3 + (hash(x >> 1, y, 3) - 0.5) * 0.8, x, y);
  a.rect(fx - 3, fy - 3, fw + 6, 3, wood); a.rect(fx - 3, fy + fh, fw + 6, 3, wood);
  a.rect(fx - 3, fy, 3, fh, wood); a.rect(fx + fw, fy, 3, fh, wood);
  a.rect(fx + Math.floor(fw / 2) - 1, fy, 2, fh, wood); a.rect(fx, fy + Math.floor(fh * 0.45), fw, 2, wood);
  // sill
  a.rect(fx - 6, fy + fh + 3, fw + 12, 3, (x, y) => dtone('wood', 4 - (y - fy - fh - 3) * 0.8, x, y));
  // glass glints
  for (let i = 0; i < 5; i++) a.px(fx + 3 + i, fy + 3 + i, '#6a78b0');
  // curtains: soft folds
  for (const side of [0, 1]) {
    const cw = Math.round(fx + fw * 0.12);
    for (let y = 0; y < h - 2; y++) {
      const sway = Math.round(Math.sin(y * 0.08 + f * 0.05) * 0.6);
      const tie = y > h * 0.55 && y < h * 0.62;
      const cwy = Math.round(cw - (y > h * 0.4 ? Math.min(cw * 0.45, (y - h * 0.4) * 0.6) : 0) * (y < h * 0.62 ? 1 : 0.4));
      for (let i = 0; i < cwy; i++) {
        const xx = side ? w - 1 - i + sway : i + sway;
        const fold = Math.sin((i / Math.max(1, cwy)) * Math.PI * 3) * 1.1;
        a.px(xx, y, tie ? tone('gold', 3) : dtone('plum', 3 + fold + (o.dim ?? 0), xx, y));
      }
    }
  }
  // curtain rod
  a.rect(0, 0, w, 2, tone('brass', 3)); a.rect(0, 0, w, 1, tone('brass', 4));
  a.disc(1, 1, 2, tone('brass', 4)); a.disc(w - 2, 1, 2, tone('brass', 4));
}

// ------------------------------------------------------------------ presents

export interface GiftLook { paper: string; ribbon: string; dots?: boolean; stripes?: boolean; sparkle?: boolean }
export const GIFT_LOOK: Record<string, GiftLook> = {
  common: { paper: 'moss', ribbon: 'cream', dots: true },
  uncommon: { paper: 'green', ribbon: 'gold', stripes: true },
  rare: { paper: 'blue', ribbon: 'white', dots: true },
  legendary: { paper: 'gold', ribbon: 'red', stripes: true, sparkle: true },
};
/**
 * A wrapped present, 40 x 44. stage: 0 wrapped with a bow, 1 ribbon pulled away (bow gone),
 * 2 paper torn (cardboard showing through ragged paper), 3 lid off (open box).
 * `t` (0..1) animates the current stage's motion.
 */
export function present(a: Art, x: number, y: number, look: GiftLook, stage: number, t = 0, f = 0) {
  const o = new Art(44, 48);
  const bx = 5, bw = 34, by = 19, bh = 25;
  const paperAt = (X: number, Y: number, base: number) => {
    const pat = look.dots ? ((X + (Y >> 2) * 2) % 6 === 0 && Y % 4 === 1) : look.stripes ? (((X + Y) >> 2) % 3 === 0) : false;
    return pat ? tone(look.paper, base + 1.6) : dtone(look.paper, base, X, Y);
  };
  // torn: the paper survives only in ragged strips at the edges, shrinking as t grows
  const edgeD = (X: number, Y: number) => Math.min(X - bx, bx + bw - 1 - X, Y - by, by + bh - 1 - Y);
  const tornEdge = (X: number, Y: number) => stage >= 2 && edgeD(X, Y) > (1 - t) * 4 + 1 + hash(X >> 1, Y >> 1, 9) * 3;
  // box body
  o.rect(bx, by, bw, bh, (X, Y) => {
    if (tornEdge(X, Y)) return (X - bx + Y) % 7 === 0 ? tone('sand', 1) : dtone('sand', 2.8 + (X < bx + 6 ? 0.7 : X > bx + bw - 7 ? -0.5 : 0), X, Y);
    return paperAt(X, Y, 3 + (X < bx + 5 ? 0.6 : X > bx + bw - 6 ? -0.8 : 0) - (Y > by + bh - 4 ? 0.5 : 0));
  });
  // lid
  const lidUp = stage === 3 ? -6 - t * 18 : 0, lidTilt = stage === 3 ? t * 0.5 : 0;
  if (stage < 3 || t < 1) {
    const ly = by - 6 + lidUp;
    for (let X = bx - 2; X < bx + bw + 2; X++) for (let Y = 0; Y < 7; Y++) {
      const yy = ly + Y + Math.round((X - (bx + bw / 2)) * lidTilt * 0.3);
      if (stage >= 2 && Y > 1 && Y < 6 && hash(X >> 1, Y, 3) < 0.4 + t * 0.6) o.px(X, yy, dtone('sand', 3.4, X, yy));
      else o.px(X, yy, paperAt(X, yy, 3.6 - (Y > 4 ? 1 : 0)));
    }
  }
  if (stage === 3) {
    // the open box: dark inside, glow rising
    o.rect(bx + 2, by, bw - 4, 4, tone('wood', 1));
    for (let i = 0; i < 9; i++) { const gx = bx + 4 + i * 3.4, gy = by - 2 - ((f + i * 3) % 9); o.px(gx, gy, '#fff6c0'); }
  }
  // ribbon and bow
  if (stage === 0 || (stage === 1 && t < 1)) {
    const slide = stage === 1 ? t * 40 : 0;
    o.rect(bx + bw / 2 - 2, by - 6 - (stage === 1 ? slide : 0), 4, bh + 6, (X, Y) => dtone(look.ribbon, 3.4 + (X < bx + bw / 2 - 1 ? 1 : 0), X, Y));
    o.rect(bx + (stage === 1 ? slide : 0), by + 9, bw, 4, (X, Y) => dtone(look.ribbon, 3.4 + (Y < by + 10 ? 1 : 0), X, Y));
    if (stage === 0) {
      const cxb = bx + bw / 2, cyb = by - 7, wob = Math.round(Math.sin(f * 0.5) * 0.6);
      for (const sd of [-1, 1]) o.ell(cxb + sd * 6, cyb - 1 + wob * sd, 6, 4, (X, Y) => (Math.hypot((X + 0.5 - (cxb + sd * 6)) / 6, (Y + 0.5 - (cyb - 1)) / 4) < 0.45 ? tone(look.ribbon, 1) : dtone(look.ribbon, 3.6 + lit(X - cxb, Y - cyb, 6), X, Y)));
      o.poly([[cxb - 2, cyb + 1], [cxb - 7, cyb + 8], [cxb - 4, cyb + 8], [cxb - 1, cyb + 3]], tone(look.ribbon, 2));
      o.poly([[cxb + 2, cyb + 1], [cxb + 7, cyb + 8], [cxb + 4, cyb + 8], [cxb + 1, cyb + 3]], tone(look.ribbon, 2));
      o.disc(cxb, cyb, 2.4, tone(look.ribbon, 4));
    }
  }
  // a gift tag on a string
  if (stage < 2) { o.line(bx + bw - 3, by + 1, bx + bw + 2, by + 6, tone('white', 2)); o.rect(bx + bw, by + 6, 4, 6, tone('parch', 4)); o.px(bx + bw + 1, by + 7, tone('red', 3)); }
  o.outline(INK);
  if (look.sparkle && stage < 3) for (let i = 0; i < 4; i++) { const k = (f + i * 5) % 20; if (k < 6) { const sx = Math.floor(hash(i, Math.floor((f + i * 5) / 20), 2) * 40) + 2, sy = Math.floor(hash(i, 9, Math.floor((f + i * 5) / 20)) * 30) + 8; o.px(sx, sy, '#ffffff'); if (k > 1 && k < 4) { o.px(sx - 1, sy, '#fff6b0'); o.px(sx + 1, sy, '#fff6b0'); o.px(sx, sy - 1, '#fff6b0'); o.px(sx, sy + 1, '#fff6b0'); } } }
  a.stamp(o, x, y);
}

/** Pip's gift sack: burlap, a stitched moon patch, a rope tie. `open` 0..1 widens the mouth. 56 x 58. */
export function sack(a: Art, x: number, y: number, open: number, f = 0) {
  const o = new Art(56, 58);
  const cx = 28, wob = Math.sin(f * 0.4) * (1 - open) * 0.8;
  // body
  o.poly([[10, 26], [46, 26], [52, 44], [48, 55], [8, 55], [4, 44]], (X, Y) => {
    const weave = ((X + Y) % 4 === 0 || (X - Y + 64) % 4 === 0) ? -0.35 : 0;
    return dtone('sand', 3 + weave + lit(X - cx, Y - 42, 22) * 1.3, X, Y);
  });
  // neck gathered by the rope
  const nw = 6 + open * 10;
  o.poly([[cx - nw, 16 - open * 4], [cx + nw, 16 - open * 4], [cx + 9 + open * 6, 27], [cx - 9 - open * 6, 27]], (X, Y) => dtone('sand', 3.4 + (Math.abs(X - cx) % 3 === 0 ? -0.8 : 0) + lit(X - cx, Y - 20, 10), X, Y));
  // ruffled top
  for (let i = -nw; i <= nw; i += 3) o.ell(cx + i + wob, 15 - open * 4, 2.4, 2.4, (X, Y) => dtone('sand', 4 + lit(X - cx - i, Y - 14, 3), X, Y));
  if (open > 0.05) {
    o.ell(cx, 15 - open * 4, nw - 1, 2 + open * 3, (X, Y) => (Y < 14 - open * 4 ? tone('wood', 1) : tone('wood', 0)));
  }
  // rope
  if (open < 0.6) {
    o.rect(cx - 9, 25, 18, 3, (X) => (X % 3 === 0 ? tone('straw', 2) : tone('straw', 4)));
    o.line(cx + 6, 27, cx + 11, 34, tone('straw', 3)); o.line(cx + 7, 27, cx + 13, 32, tone('straw', 3));
  }
  // moon patch with stitches
  o.rect(17, 34, 14, 13, (X, Y) => dtone('navy', 3.4, X, Y));
  o.disc(24, 40.5, 4, tone('yellow', 4)); o.disc(26, 39.4, 3.6, tone('navy', 3));
  for (let i = 17; i < 31; i += 2) { o.px(i, 33, tone('cream', 5)); o.px(i, 47, tone('cream', 5)); }
  for (let j = 35; j < 47; j += 2) { o.px(16, j, tone('cream', 5)); o.px(31, j, tone('cream', 5)); }
  o.outline(INK);
  // glow spilling out when open
  if (open > 0.3) for (let i = 0; i < 8; i++) { const gx = cx - 10 + ((i * 7 + f) % 21), gy = 10 - open * 4 - ((f * 2 + i * 5) % 10); o.px(gx, gy, i % 2 ? '#fff6c0' : '#ffe08a'); }
  a.stamp(o, x, y);
}

// ------------------------------------------------------------------ stickers for the calendar

/** Die-cut: a 2px white border with a soft ink shadow, like a real sticker. */
export function dieCut(src: Art, bw = 1): Art {
  const W = src.w + bw * 2 + 1, H = src.h + bw * 2 + 1;
  const o = new Art(W, H), m = new Uint8Array(W * H);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.d[y * src.w + x] >>> 24) {
    for (let dy = -bw; dy <= bw; dy++) for (let dx = -bw; dx <= bw; dx++) if (dx * dx + dy * dy <= (bw + 0.5) ** 2) m[(y + bw + dy) * W + x + bw + dx] = 1;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (m[y * W + x]) o.px(x, y, '#ffffff');
    else if (x > 0 && y > 0 && m[(y - 1) * W + x - 1]) o.px(x, y, '#2a1a1440');
  }
  return o.stamp(src, bw, bw);
}

function stickerArt(kind: string): Art {
  const a = new Art(16, 16);
  if (kind === 'gold') {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) { const an = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 3.4 : 7.6; pts.push([8 + Math.cos(an) * r, 8.4 + Math.sin(an) * r]); }
    a.poly(pts, (x, y) => dtone('gold', 3.4 + lit(x - 8, y - 8, 7) * 1.6, x, y));
    a.px(6, 8, INK); a.px(10, 8, INK); a.px(7, 10, INK); a.px(8, 11, INK); a.px(9, 10, INK); a.px(5, 10, '#f08aa8'); a.px(11, 10, '#f08aa8');
  } else if (kind === 'moon') {
    a.disc(8, 8, 6.6, (x, y) => dtone('lilac', 4 + lit(x - 8, y - 8, 6), x, y));
    a.disc(11.2, 5.6, 5.4, null);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - 11.2, y + 0.5 - 5.6) < 5.4) a.d[y * 16 + x] = 0;
    a.px(4, 9, INK); a.px(5, 10, INK); a.px(6, 9, INK); a.px(4, 11, '#f08aa8');
    a.px(13, 11, '#fff6b0'); a.px(12, 13, '#fff6b0');
  } else if (kind === 'cloud') {
    for (const [cx, cy, r] of [[5, 9.5, 3.6], [9, 7, 4.4], [12, 10, 3.2], [8, 11, 3.6]] as const) a.disc(cx, cy, r, (x, y) => dtone('white', 4.2 + lit(x - 8, y - 8, 7) * 1.2, x, y));
    a.px(7, 9, INK); a.px(10, 9, INK); a.px(8, 10, INK); a.px(9, 10, INK);
  } else {
    for (const [cx, cy, r] of [[5, 7.5, 3.4], [9, 5, 4.2], [12, 8, 3.2], [8, 9, 3.4]] as const) a.disc(cx, cy, r, (x, y) => dtone('steel', 3.2 + lit(x - 8, y - 6, 7), x, y));
    for (const [dx, dy] of [[5, 13], [9, 14], [12, 12]]) { a.px(dx, dy, tone('blue', 4)); a.px(dx, dy + 1, tone('blue', 3)); }
    a.px(7, 7, INK); a.px(10, 7, INK); a.line(8, 9, 9, 9, INK);
  }
  return a.outline(INK);
}
const stickerCache = new Map<string, string>();
/** data URL of a calendar sticker ('gold' | 'moon' | 'cloud' | 'rain') at a whole-number scale */
export function stickerURL(kind: string, scale = 3): string {
  const key = kind + scale;
  let u = stickerCache.get(key);
  if (!u) { u = dieCut(stickerArt(kind)).url(scale); stickerCache.set(key, u); }
  return u;
}

/** Cache an Art drawing as a data URL. */
const artCache = new Map<string, string>();
export function artURL(key: string, w: number, h: number, draw: (a: Art) => void, scale = 1): string {
  let u = artCache.get(key + scale);
  if (!u) { const a = new Art(w, h); draw(a); u = a.url(scale); artCache.set(key + scale, u); }
  return u;
}
export type { Col };
