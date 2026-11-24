// The v4 interface objects, modelled and lit with the relief painter (src/ui/px/relief.ts): the three big
// main buttons (a moon lamp, a brass twin-bell alarm clock, a leather journal), the walnut shelf they stand
// on with its brass name plates, the hanging name sign with Pip's brass-bezelled portrait, the currency
// boards, the side tool tiles, the bedtime card clip, and small brass parts. Everything is painted once per
// size and cached as a data URL; one design unit = 2 CSS px (k = 1), or twice the detail with k = 2.
// OWNED BY THE UI BUILDER (ui4).
import {
  all, and, clamp, disc, dome, ell, fbm, flat, hash, hex, leatherGrain, MAT, metal, mix, mul, not, or, PAL, paperGrain, poly, puff, rampAt, rect, Relief,
  ring, roundRect, rrect, seg, slab, smooth, solid, torus, tubeX, tubeY, vnoise, weave, woodGrain, type AFn, type Mat, type RGB, type Shape, bayer,
} from '../px/relief.ts';

const urls = new Map<string, string>();
/** paint once per key */
export function cachedRelief(key: string, make: () => string): string {
  let u = urls.get(key);
  if (u === undefined) {
    try { u = typeof document === 'undefined' ? '' : make(); } catch (e) { console.warn('relief failed', key, e); u = ''; }
    urls.set(key, u);
  }
  return u;
}

// ------------------------------------------------------------------ a tiny pixel font for engraved numerals
const GLYPH: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'], '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'], I: ['1', '1', '1', '1', '1'], V: ['101', '101', '101', '101', '010'], X: ['101', '101', '010', '101', '101'],
};
/** a text shape: glyphs `g` art-units per glyph pixel, top-left at (x, y) */
export function textShape(t: string, x: number, y: number, g = 1): Shape {
  const cells: [number, number][] = [];
  let cx = x;
  for (const ch of t) {
    const gl = GLYPH[ch];
    if (!gl) { cx += 2 * g; continue; }
    gl.forEach((row, j) => [...row].forEach((c, i) => { if (c === '1') cells.push([cx + i * g, y + j * g]); }));
    cx += (gl[0].length + 1) * g;
  }
  return (px, py) => cells.some(([a, b]) => px >= a && px < a + g && py >= b && py < b + g);
}
export const textWidth = (t: string, g = 1) => [...t].reduce((w, ch) => w + ((GLYPH[ch]?.[0].length ?? 1) + 1) * g, 0) - g;

/** the names of the palette's ramps */
export type PalRamp = Exclude<keyof typeof PAL, 'ink'>;
const B = PAL.brass;
const brass = (o: Parameters<typeof metal>[1] = {}) => metal(B, { base: 0.6, ...o });
const gold = (base = 0.62) => metal(PAL.gold, { base });

// ------------------------------------------------------------------ the moon lamp (Sleep)

/**
 * A night-light: a glass globe on a brass foot, a glowing crescent moon and stars inside, a brass cap with
 * a ring. `glow` 0..1 breathes the light; `lit` 0 shows it switched off (the press).
 */
export function moonLamp(k = 1, res = 2, glow = 0.6, lit = 1): string {
  return cachedRelief(`lamp:${k}:${res}:${glow.toFixed(2)}:${lit}`, () => {
    const W = 52, H = 54, r = new Relief(W, H, res, k);
    const cx = 26, gy = 25, GR = 15.5;
    // ---- foot: a stepped brass plinth, a collar, a ring
    r.fill(ell(cx, 48.5, 15, 4), dome(cx, 48.5, 15, 4, 2.2), brass({ brush: 'x', base: 0.55, patina: 0.3 }), MAT.brass, { id: 1, seam: true });
    r.fill(and(ell(cx, 46.5, 11.5, 3), (x, y) => y < 47.5), dome(cx, 46.5, 11.5, 3, 2.4, 2), brass({ brush: 'x', base: 0.62 }), MAT.brass, { id: 2, seam: true });
    r.fill(rect(cx - 6.5, 38.5, 13, 8), tubeY(cx, 6.5, 3), brass({ brush: 'y', base: 0.6 }), MAT.brass, { id: 3, seam: true });
    r.carve(or(rect(cx - 6.5, 41, 13, 1), rect(cx - 6.5, 44, 13, 1)), () => -1.6); // turned rings
    r.fill(ell(cx, 38.6, 8.5, 2.4), dome(cx, 38.6, 8.5, 2.4, 2, 5), brass({ base: 0.66 }), MAT.brass, { id: 4, seam: true });
    // ---- the globe: night sky glass, a crescent moon, stars
    const moonC = [cx - 2.5, gy + 1], moonR = 7.4, bite = [cx + 1.8, gy - 1.6], biteR = 6.2;
    const night: AFn = (x, y, mx, my) => {
      const dx = x - cx, dy = y - gy, d = Math.hypot(dx, dy) / GR;
      const inMoon = Math.hypot(mx - moonC[0], my - moonC[1]) < moonR && Math.hypot(mx - bite[0], my - bite[1]) > biteR;
      const g = glow * lit;
      if (inMoon) {
        // a lit crescent: warm cream with a few soft craters, brighter on the outer limb
        const lim = Math.hypot(mx - moonC[0], my - moonC[1]) / moonR;
        const crater = vnoise(mx * 0.9, my * 0.9, 41) > 0.7 ? -0.12 : 0;
        const v = clamp(0.55 + lim * 0.35 + crater + g * 0.12 - (1 - lit) * 0.45);
        return rampAt([hex('#6a5a3c'), hex('#c9a95e'), hex('#f2d98c'), hex('#fff2c4'), hex('#fffbea')], v);
      }
      // stars: a few bright crosses
      for (const [sx, sy, sz] of [[cx + 7.5, gy - 7, 1], [cx + 9.5, gy + 4, 0], [cx - 9, gy - 6, 0], [cx + 3, gy + 9.5, 0], [cx - 6.5, gy + 8, 0], [cx + 1, gy - 11, 0]] as [number, number, number][]) {
        const ax = Math.abs(mx - sx), ay = Math.abs(my - sy);
        if ((ax < 0.5 && ay < 0.5) || (sz && ((ax < 0.5 && ay < 1.5) || (ay < 0.5 && ax < 1.5)))) return lit ? hex('#fff6d2') : hex('#7d86a8');
      }
      // the glow around the moon, then the deep night toward the glass edge
      const md = Math.hypot(mx - moonC[0] - 1, my - moonC[1]) / GR;
      const halo = Math.max(0, 1 - md * 1.25) * (0.45 + g * 0.55) * lit;
      const sky = rampAt(PAL.sapphire, clamp(0.62 - d * 0.42 + (dy / GR) * 0.1 + halo * 0.45 + (fbm(mx * 0.12, my * 0.12, 9) - 0.5) * 0.14 - (1 - lit) * 0.25));
      const warm = mix(sky, hex('#f6d995'), halo * halo * 0.55);
      // the glass edge: a thin darker refracting band, then a pale rim
      if (d > 0.9) return mix(warm, hex('#0a1230'), (d - 0.9) * 5);
      return warm;
    };
    r.fill(disc(cx, gy, GR), (x, y) => 5 + 9 * Math.sqrt(Math.max(0, 1 - ((x - cx) ** 2 + (y - gy) ** 2) / (GR * GR))), night, { spec: 0, shin: 1, emit: 1 }, { id: 5 });
    // ---- cap: a brass dome, a knob and a ring handle
    r.fill(and(ell(cx, 10.5, 7.5, 3.6), (_x, y) => y < 11.6), dome(cx, 10.5, 7.5, 3.6, 3, 10), brass({ base: 0.64 }), MAT.brass, { id: 6, seam: true });
    r.fill(rect(cx - 7.5, 10.4, 15, 1.4), flat(11), brass({ base: 0.5 }), MAT.brass, { id: 6 });
    r.fill(disc(cx, 6.2, 1.8), dome(cx, 6.2, 1.8, 1.8, 1.6, 12), brass({ base: 0.7 }), MAT.brass, { id: 7, seam: true });
    r.fill(ring(cx, 2.6, 1.6, 2.7), torus(cx, 2.6, 2.15, 0.6, 1, 11), brass({ base: 0.6 }), MAT.brass, { id: 8 });
    const c = r.canvas();
    const g = c.getContext('2d')!;
    // glass: the window reflection (a curved streak top-left), a small hot glint, a rim light bottom-right
    const put = (x: number, y: number, col: string, a = 1) => { g.globalAlpha = a; g.fillStyle = col; g.fillRect(Math.floor(x * k) * res, Math.floor(y * k) * res, res, res); };
    for (let a = 0; a < 1; a += 0.02 / k) {
      const an = Math.PI * (1.08 + a * 0.38), rr = GR - 2.6;
      put(cx + Math.cos(an) * rr, gy + Math.sin(an) * rr, '#f4fbff', a < 0.15 || a > 0.85 ? 0.45 : 0.85);
    }
    for (let a = 0; a < 1; a += 0.03 / k) { const an = Math.PI * (0.12 + a * 0.3), rr = GR - 1.4; put(cx + Math.cos(an) * rr, gy + Math.sin(an) * rr, '#9fc4ff', 0.5); }
    put(cx - 8, gy - 9, '#ffffff'); put(cx - 7, gy - 10, '#ffffff', 0.8);
    g.globalAlpha = 1;
    return c.toDataURL('image/png');
  });
}

/** The halo of moonlight behind the lamp: stepped pixel rings, fading outward (drawn behind it, breathing). */
export function lampHalo(k = 1, res = 2, strength = 1): string {
  return cachedRelief(`halo:${k}:${res}:${strength}`, () => {
    const W = 52 * k * res, H = 54 * k * res, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!, img = g.createImageData(W, H), d = img.data;
    const cx = 26 * k, cy = 25 * k;
    const RINGS: [number, number, number[]][] = [[17.2, 0.42, [255, 236, 170]], [19.4, 0.26, [250, 220, 150]], [21.8, 0.14, [240, 206, 140]], [24.4, 0.07, [220, 196, 150]]];
    for (let ay = 0; ay < 54 * k; ay++) for (let ax = 0; ax < 52 * k; ax++) {
      const dd = Math.hypot(ax + 0.5 - cx, ay + 0.5 - cy) / k;
      if (dd < 15) continue;
      const ring = RINGS.find(([r]) => dd < r);
      if (!ring) continue;
      const a = Math.round(ring[1] * 255 * strength);
      for (let ty = 0; ty < res; ty++) for (let tx = 0; tx < res; tx++) {
        const j = ((ay * res + ty) * W + ax * res + tx) * 4;
        d[j] = ring[2][0]; d[j + 1] = ring[2][1]; d[j + 2] = ring[2][2]; d[j + 3] = a;
      }
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
}

// ------------------------------------------------------------------ the alarm clock (Clock)

export const ALARM = { W: 52, H: 54, cx: 26, cy: 30, dial: 12.6 };
/**
 * A brass twin-bell alarm clock with an enamel dial (its hands are drawn live on top, see alarmHands).
 * `ring` 0..2 tips the bells and hammer for the ringing frames.
 */
export function alarmClock(k = 1, res = 2, ringF = 0): string {
  return cachedRelief(`alarm:${k}:${res}:${ringF}`, () => {
    const { W, H, cx, cy, dial } = ALARM, r = new Relief(W, H, res, k);
    const sh = ringF === 1 ? -1 : ringF === 2 ? 1 : 0;
    // ---- legs and ball feet
    for (const sd of [-1, 1]) {
      r.fill(seg(cx + sd * 9, cy + 12, cx + sd * 13.5, cy + 19.5, 1.5), (x) => 2 + 1.5 * Math.cos(clamp((x - (cx + sd * 11)) / 3) * 1.5), brass({ base: 0.55 }), MAT.brass, { id: 10, seam: true });
      r.fill(disc(cx + sd * 14, cy + 20.6, 2.4), dome(cx + sd * 14, cy + 20.6, 2.4, 2.4, 2.4), brass({ base: 0.6 }), MAT.brass, { id: 11, seam: true });
    }
    // ---- bells: two domes tipped outward, with a rolled lip and a little stud on top
    for (const sd of [-1, 1]) {
      const bx = cx + sd * 12.5 + sh * 0.6, by = cy - 17.5, tilt = sd * 0.42 + sh * 0.12;
      const ca = Math.cos(tilt), sa = Math.sin(tilt);
      const loc = (x: number, y: number) => [(x - bx) * ca + (y - by) * sa, -(x - bx) * sa + (y - by) * ca];
      const bell: Shape = (x, y) => { const [u, v] = loc(x, y); return v <= 2.2 && (u / 8) ** 2 + ((v - 2.2) / 8.4) ** 2 <= 1; };
      r.fill(bell, (x, y) => { const [u, v] = loc(x, y); return 3 + 6 * Math.sqrt(Math.max(0, 1 - (u / 8) ** 2 - ((v - 2.2) / 8.4) ** 2)) + (v > 0.8 ? 0.8 : 0); }, brass({ base: 0.66, brush: 'r', cx: bx, cy: by + 2 }), MAT.brass, { id: 12 + (sd > 0 ? 1 : 0), seam: true });
      const [sx, sy] = [bx + sa * 7.6, by - ca * 7.6];
      r.fill(disc(sx, sy, 1.5), dome(sx, sy, 1.5, 1.5, 1.5, 8), brass({ base: 0.7 }), MAT.brass, { id: 14, seam: true });
    }
    // ---- the hammer between the bells
    const hx = cx + sh * 2.2;
    r.fill(seg(cx, cy - 15, hx, cy - 22.5, 0.9), flat(6), metal(PAL.iron, { base: 0.6 }), MAT.iron, { id: 15, seam: true });
    r.fill(ell(hx, cy - 23.3, 2.6, 1.7), dome(hx, cy - 23.3, 2.6, 1.7, 2, 6), brass({ base: 0.72 }), MAT.brass, { id: 16, seam: true });
    // ---- the case: a deep brass drum (its side shows below-right), a rolled bezel, the enamel dial
    r.fill(disc(cx + 0.9, cy + 1.1, 17), dome(cx + 0.9, cy + 1.1, 17, 17, 3), brass({ base: 0.42, brush: 'x' }), MAT.brass, { id: 20, seam: true });
    r.fill(disc(cx, cy, 16.6), (x, y) => 4 + 1.5 * Math.sqrt(Math.max(0, 1 - ((x - cx) ** 2 + (y - cy) ** 2) / 280)), brass({ base: 0.6, brush: 'r', cx, cy }), MAT.brass, { id: 21, seam: true });
    r.fill(ring(cx, cy, dial + 0.2, 16.4), torus(cx, cy, 14.6, 2.1, 2.6, 5), brass({ base: 0.68, brush: 'r', cx, cy }), MAT.brass, { id: 22 });
    r.fill(disc(cx, cy, dial + 0.3), (x, y) => 5.2 - 0.6 * (((x - cx) ** 2 + (y - cy) ** 2) / (dial * dial)), (x, y, mx, my) => {
      const d = Math.hypot(mx - cx, my - cy) / dial;
      const c = rampAt(PAL.enamel, 0.78 - d * 0.18 + (vnoise(mx * 0.7, my * 0.7, 3) - 0.5) * 0.05);
      return d > 0.93 ? mul(c, 0.86) : c;
    }, MAT.enamel, { id: 23, seam: true });
    // ---- dial printing: a minute track, bold hour bars, numerals at the quarters, a sky-blue moon
    const ink = hex('#22180f');
    for (let i = 0; i < 60; i++) {
      const an = (i / 60) * Math.PI * 2, major = i % 5 === 0;
      const r0 = dial - (major ? 2.4 : 1.4), r1 = dial - 0.6;
      if (k === 1 && !major) continue;
      r.paint(seg(cx + Math.sin(an) * r0, cy - Math.cos(an) * r0, cx + Math.sin(an) * r1, cy - Math.cos(an) * r1, major ? 0.5 : 0.28), solid(ink));
    }
    // numerals: the quarters when chunky, all twelve (one art pixel per glyph pixel) when detailed
    const g = k === 1 ? 1 : 1 / k;
    const nums: [string, number][] = k === 1 ? [['12', 0], ['3', 3], ['6', 6], ['9', 9]] : Array.from({ length: 12 }, (_, i) => [String(i || 12), i] as [string, number]);
    for (const [n, hh] of nums) {
      const a = (hh / 12) * Math.PI * 2, rr = dial - (k === 1 ? 5.4 : 4.6), tw = textWidth(n, g);
      r.paint(textShape(n, Math.round((cx + Math.sin(a) * rr - tw / 2) * k) / k, Math.round((cy - Math.cos(a) * rr - 2.5 * g) * k) / k, g), solid(ink));
    }
    // a sky-blue enamel crescent and a maker's line under the 12
    r.paint(and(disc(cx - 0.4, cy - 4.4, 1.9), not(disc(cx + 0.6, cy - 5, 1.6))), solid(hex('#2a70a3')));
    if (k > 1) r.paint(rect(cx - 2, cy + 3.4, 4, 0.5), solid(hex('#8a7a62')));
    const c = r.canvas();
    return c.toDataURL('image/png');
  });
}

/** Draw the alarm clock's hands (hour, minute, a red seconds hand) and the glass glint onto a canvas. */
export function alarmHands(g: CanvasRenderingContext2D, k: number, res: number, d: Date, wake?: number) {
  const { cx, cy } = ALARM;
  const px = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(Math.floor(x * k) * res, Math.floor(y * k) * res, res, res); };
  const line = (a: number, r0: number, r1: number, c: string, wide = 0) => {
    const n = Math.ceil((r1 - r0) * k * 1.5) + 1;
    for (let i = 0; i <= n; i++) {
      const t = r0 + ((r1 - r0) * i) / n, x = cx + Math.sin(a) * t, y = cy - Math.cos(a) * t;
      px(x, y, c);
      if (wide && t < r1 - 1) px(x + Math.cos(a) / k, y + Math.sin(a) / k, c);
    }
  };
  const m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
  const ha = (h / 12) * Math.PI * 2, ma = (m / 60) * Math.PI * 2, sa = (d.getSeconds() / 60) * Math.PI * 2;
  // the gold alarm hand points at the wake time, under the others
  if (wake !== undefined) { const wa = ((wake / 60) % 12) / 12 * Math.PI * 2; line(wa, 0, 8.6, '#d4a432'); px(cx + Math.sin(wa) * 8.9, cy - Math.cos(wa) * 8.9, '#b88524'); }
  // a soft shadow under the hands, then blued-steel hands
  line(ha, 0, 7, 'rgba(60,40,20,0.35)'); line(ma, 0, 10.5, 'rgba(60,40,20,0.3)');
  g.save(); g.translate(-res, -res);
  line(ha, -1, 7.5, '#1d2738', 1);
  line(ma, -1.5, 10.8, '#1d2738', k > 1 ? 1 : 0);
  line(sa, -2.5, 11, '#c0362c');
  px(cx, cy, '#f6dc7f'); if (k > 1) { px(cx - 0.5, cy, '#b88524'); px(cx, cy - 0.5, '#fff1bd'); }
  g.restore();
  // the domed glass: a curved window reflection top-left and a hot glint
  g.globalAlpha = 0.55;
  for (let a = 0; a < 1; a += 0.025 / k) { const an = Math.PI * (1.1 + a * 0.32), rr = ALARM.dial - 2.2; px(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr, '#ffffff'); }
  g.globalAlpha = 1;
  px(cx - 6.5, cy - 8.2, '#ffffff');
}

// ------------------------------------------------------------------ the leather journal (Book)

/**
 * An oxblood leather journal with gilt tooling, brass corners, a strap and clasp and a ribbon marker.
 * `open` 0..1 swings the front cover toward you on its spine (0 shut, 1 lying open to the left).
 */
export function journal(k = 1, res = 2, open = 0): string {
  return cachedRelief(`journal:${k}:${res}:${open.toFixed(2)}`, () => {
    const W = 52, H = 54, r = new Relief(W, H, res, k);
    // the cover faces you; the book's depth runs up and to the right (you look down on it a little), so the
    // gilt page block shows along the head and the fore-edge, and the back board peeks out behind
    const x0 = 9, y0 = 14, bw = 31, bh = 38, depth = 5;
    r.fill(poly([[x0 + 1, y0], [x0 + depth + 1, y0 - depth], [x0 + bw + depth, y0 - depth], [x0 + bw + depth, y0 + bh - depth], [x0 + bw, y0 + bh], [x0 + 1, y0 + bh]]), flat(2), leatherGrain(PAL.leather, { base: 0.3 }), MAT.leather, { id: 1 });
    const head = poly([[x0 + 1.4, y0], [x0 + depth + 0.8, y0 - depth + 0.8], [x0 + bw + depth - 0.8, y0 - depth + 0.8], [x0 + bw, y0]]);
    const fore = poly([[x0 + bw, y0], [x0 + bw + depth - 0.8, y0 - depth + 0.8], [x0 + bw + depth - 0.8, y0 + bh - depth - 0.6], [x0 + bw, y0 + bh - 0.6]]);
    r.fill(or(head, fore), flat(3), (_x, _y, mx, my) => {
      // gilt-edged pages: fine lines running along the head and down the fore-edge
      const onFore = mx > x0 + bw;
      const along = onFore ? mx - (my - y0) * 0 : my;
      const line = Math.floor((onFore ? along : my) * 2 * k) % 2 === 0;
      return mix(rampAt(PAL.paper, line ? 0.74 : 0.56), hex('#e0b240'), onFore ? 0.34 : 0.18);
    }, MAT.paper, { id: 2, seam: true });
    // the ribbon marker hangs out of the head and down the fore-edge
    r.fill(poly([[x0 + bw - 4, y0 - 2.4], [x0 + bw - 1.6, y0 - 3], [x0 + bw + 2.2, y0 + 6], [x0 + bw + 2.6, y0 + 15], [x0 + bw + 1.4, y0 + 13.6], [x0 + bw + 0.2, y0 + 15.4], [x0 + bw + 0.4, y0 + 6.5]]), (x, y) => 4.2 + Math.sin(y * 0.7) * 0.3, weave(PAL.emerald, { base: 0.6 }), MAT.velvet, { id: 3, seam: true });
    // ---- the front cover, swinging open on its spine
    const ca = Math.cos(open * Math.PI);
    const span = bw * Math.abs(ca);
    const coverX0 = ca >= 0 ? x0 : x0 - span, inside = ca < 0;
    if (open > 0.02) {
      // the first page shows behind the opening cover
      r.fill(rect(x0 + 1, y0 + 1, bw - 1, bh - 1), flat(4), (x, y, mx, my) => {
        const c = rampAt(PAL.paper, 0.78 + (vnoise(mx * 0.5, my * 0.5, 2) - 0.5) * 0.06);
        if (Math.floor((my - y0 - 6) * k) % (4 * k) === 0 && my > y0 + 6 && my < y0 + bh - 4 && mx > x0 + 5 && mx < x0 + bw - 3) return mix(c, hex('#6a8fb8'), 0.45);
        if (mx > x0 + 4 && mx < x0 + 4 + 1 / k) return mix(c, hex('#c0503c'), 0.5);
        return c;
      }, MAT.paper, { id: 4, seam: true });
    }
    if (span > 0.6) {
      const cover = roundRect(coverX0, y0, span, bh, ca >= 0 ? 1.2 : 0.6);
      const ccol: AFn = inside
        ? (x, y, mx, my) => (mx > coverX0 + 2 && mx < coverX0 + span - 2 && my > y0 + 2 && my < y0 + bh - 2
          ? rampAt([hex('#1c3168'), hex('#33579e'), hex('#c8a24a'), hex('#e9d6a4')], clamp(fbm(mx * 0.3, my * 0.12, 5) * 1.25 - 0.1)) // marbled endpaper
          : leatherGrain(PAL.leather, { base: 0.45 })(x, y, mx, my))
        : leatherGrain(PAL.leather, { base: 0.58, seed: 7 });
      r.fill(cover, (x, y) => {
        const u = (x - coverX0) / Math.max(1, span);
        return 6 + (inside ? 0 : 1.6 * Math.sqrt(clamp(Math.min(u * span, (1 - u) * span, y - y0, y0 + bh - y) / 2.2))) + (ca >= 0 ? (1 - ca) * (1 - u) * 6 : 0);
      }, ccol, MAT.leather, { id: 5, seam: true });
      if (!inside) {
        const sx = (v: number) => coverX0 + (v - x0) * (span / bw);
        // gilt tooling: a double fillet border and a moon-and-stars centrepiece
        const fil = (o: number) => and(rect(sx(x0 + o), y0 + o, (bw - 2 * o) * span / bw, bh - 2 * o), not(rect(sx(x0 + o + 0.6), y0 + o + 0.6, (bw - 2 * o - 1.2) * span / bw, bh - 2 * o - 1.2)));
        if (span > 10) {
          r.paint(or(fil(3.2), fil(4.8)), gold(0.6), MAT.brass);
          r.carve(or(fil(3.2), fil(4.8)), () => -0.5);
          const mcx = sx(x0 + bw / 2), mcy = y0 + bh / 2 - 1, sq = span / bw;
          const moon: Shape = (x, y) => (((x - mcx) / sq) ** 2 + (y - mcy) ** 2 < 36) && (((x - mcx - 2.6 * sq) / sq) ** 2 + (y - mcy + 1.8) ** 2 > 26);
          r.paint(moon, gold(0.66), MAT.brass); r.carve(moon, () => 0.8);
          for (const [dx, dy] of [[5, -6], [7, 2], [-1, 8]]) { const s = and(rect(mcx + dx * sq - 0.6, mcy + dy - 0.6, 1.4, 1.4)); r.paint(s, gold(0.75), MAT.brass); r.carve(s, () => 0.6); }
        }
        // the spine's raised bands
        const spine = rect(coverX0, y0, Math.min(span, 4.2), bh);
        r.carve(and(spine, (_x, y) => [5, 11, 27, 33].some((b) => Math.abs(y - (y0 + b)) < 0.9)), () => 1.4);
        r.carve(and(spine, (x) => x > coverX0 + 3.4), () => -1.2);
        // brass corner protectors
        for (const [ax, ay, dx, dy] of [[coverX0 + span, y0, -1, 1], [coverX0 + span, y0 + bh, -1, -1]] as [number, number, number, number][]) {
          const tri = poly([[ax, ay], [ax + dx * 6 * span / bw, ay], [ax, ay + dy * 6]]);
          r.fill(and(tri, cover), (x, y) => 9 + 0.6 * clamp(Math.abs(x - ax) + Math.abs(y - ay)), brass({ base: 0.62, patina: 0.2 }), MAT.brass, { id: 6, seam: true });
        }
        // the strap across the fore-edge and its clasp
        if (open < 0.08) {
          r.fill(rect(x0 + bw - 7, y0 + bh / 2 - 2.6, 11.4, 5.2), (_x, y) => 9 + 0.8 * Math.sin(clamp((y - y0 - bh / 2 + 2.6) / 5.2) * Math.PI), leatherGrain(PAL.tan, { base: 0.52 }), MAT.leather, { id: 7, seam: true });
          r.fill(roundRect(x0 + bw - 6.4, y0 + bh / 2 - 3.4, 5.6, 6.8, 1.4), slab(x0 + bw - 6.4, y0 + bh / 2 - 3.4, 5.6, 6.8, 2, 1.4, 10), brass({ base: 0.66 }), MAT.brass, { id: 8, seam: true });
          r.carve(disc(x0 + bw - 3.6, y0 + bh / 2, 0.9), () => -1.6);
        }
      }
    }
    return r.url();
  });
}

// ------------------------------------------------------------------ boards, brass and the shelf

const WOOD = { walnut: PAL.walnut, oak: PAL.oak, cherry: PAL.cherry } as const;
type WoodName = keyof typeof WOOD;

/** brass screw head with a slot */
function screw(r: Relief, x: number, y: number, rad = 1.3, ang = 0.6) {
  r.fill(disc(x, y, rad), dome(x, y, rad, rad, 1.2, 0), brass({ base: 0.62 }), MAT.brass, { id: 90, add: true });
  const c = Math.cos(ang), s = Math.sin(ang);
  r.carve(seg(x - c * rad * 0.8, y - s * rad * 0.8, x + c * rad * 0.8, y + s * rad * 0.8, 0.28), () => -1);
}

export interface BoardOpts { wood?: WoodName; seed?: number; bevel?: number; hooks?: number[]; brackets?: boolean; screws?: [number, number][]; inset?: boolean; moss?: [number, number][]; chamfer?: number }
/**
 * A varnished hardwood sign board, w x h units: grain along its length, a rounded bevel catching the light,
 * optional brass corner brackets, screws, eye-hooks for its chains, an inset panel and a cushion of moss.
 */
export function board(w: number, h: number, k = 2, res = 1, o: BoardOpts = {}): string {
  return cachedRelief(`board:${w}x${h}:${k}:${res}:${JSON.stringify(o)}`, () => {
    const r = new Relief(w, h, res, k), R = WOOD[o.wood ?? 'walnut'], bev = o.bevel ?? 2.4, ch = o.chamfer ?? 2;
    const knots: [number, number, number][] = [[w * (0.2 + hash(1, 2, o.seed ?? 1) * 0.6), h * 0.55, 1.1]];
    const body = rrect(0, 1, w, h - 1, ch);
    r.fill(body, slab(0, 1, w, h - 1, 5, bev), woodGrain(R, { seed: o.seed ?? 1, base: 0.5, knots }), MAT.varnish, { id: 1 });
    if (o.inset) {
      const ins = rrect(bev + 1.2, bev + 2.2, w - 2 * bev - 2.4, h - 2 * bev - 3.4, 1);
      r.carve(ins, () => -1.6);
      r.paint(ins, woodGrain(R, { seed: (o.seed ?? 1) + 5, base: 0.38 }));
    }
    if (o.brackets) for (const right of [false, true]) for (const top of [true, false]) {
      const X = (v: number) => (right ? w - v : v), Y = (v: number) => (top ? 1 + v : h - v);
      const sh = poly([[X(0), Y(0)], [X(6.5), Y(0)], [X(6.5), Y(1.8)], [X(1.8), Y(1.8)], [X(1.8), Y(6.5)], [X(0), Y(6.5)]]);
      r.fill(and(sh, body), flat(6.2), brass({ base: 0.62, patina: 0.25 }), MAT.brass, { id: 4, seam: true });
      screw(r, X(3.6), Y(0.9), 0.7, 0.5);
    }
    for (const [x0, x1] of o.moss ?? []) {
      const top = (x: number) => 1.6 - Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 1.8 + (vnoise(x * 1.7, 9, 5) - 0.5) * 0.8;
      const bot = (x: number) => 3 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 1.4 + vnoise(x * 1.3, 0, 5) * 1.2;
      r.fill((x, y) => x >= x0 && x <= x1 && y > top(x) && y < bot(x), (x, y) => 6 + Math.max(0, Math.min(y - top(x), bot(x) - y)) * 0.8,
        (_x, _y, mx, my) => rampAt(PAL.moss, clamp(0.5 + (hash(Math.floor(mx * 3), Math.floor(my * 3), 3) - 0.5) * 0.55 - my * 0.05)), MAT.moss, { id: 3, seam: true });
    }
    for (const [x, y] of o.screws ?? []) screw(r, x, y);
    for (const x of o.hooks ?? []) {
      r.fill(ring(x, 1.4, 0.7, 1.8), torus(x, 1.4, 1.25, 0.55, 1.2, 6), brass({ base: 0.66 }), MAT.brass, { id: 5 });
      r.fill(disc(x, 3.4, 1.3), dome(x, 3.4, 1.3, 1.3, 1, 6), brass({ base: 0.6 }), MAT.brass, { id: 5, seam: true });
    }
    return r.url();
  });
}

/** A round brass bezel (a portrait or porthole frame), d units across, with four tiny screws. */
export function bezel(d: number, k = 2, res = 1, inner = 0.76): string {
  return cachedRelief(`bezel:${d}:${k}:${res}:${inner}`, () => {
    const r = new Relief(d, d, res, k), c = d / 2, ri = (d / 2) * inner;
    r.fill(ring(c, c, ri, d / 2 - 0.2), torus(c, c, (ri + d / 2) / 2, (d / 2 - ri) / 2 + 0.2, 3.4, 2), brass({ base: 0.62, brush: 'r', cx: c, cy: c }), MAT.brass, { id: 1 });
    r.carve(ring(c, c, ri + 0.2, ri + 0.9), () => -0.8);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i * Math.PI) / 2, rr = (ri + d / 2) / 2; screw(r, c + Math.cos(a) * rr, c + Math.sin(a) * rr, 0.9, a); }
    return r.url();
  });
}

/** A round enamel medallion with a brass rim (the level badge): `hue` a PAL ramp name. */
export function medallion(d: number, k = 2, res = 1, hue: PalRamp = 'sapphire'): string {
  return cachedRelief(`medal:${d}:${k}:${res}:${hue}`, () => {
    const r = new Relief(d, d, res, k), c = d / 2, R = PAL[hue];
    r.fill(disc(c, c, d / 2 - 0.1), torus(c, c, d / 2 - 1.6, 1.7, 2.6, 2), brass({ base: 0.64, brush: 'r', cx: c, cy: c }), MAT.brass, { id: 1 });
    r.fill(disc(c, c, d / 2 - 3), dome(c, c, d / 2 - 3, d / 2 - 3, 2.6, 2.2), (_x, _y, mx, my) => rampAt(R, clamp(0.5 + (fbm(mx * 0.3, my * 0.3, 4) - 0.5) * 0.18 - Math.hypot(mx - c, my - c) / d * 0.3)), MAT.enamel, { id: 2, seam: true });
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2, rr = d / 2 - 4.4; r.paint(disc(c + Math.cos(a) * rr, c + Math.sin(a) * rr, 0.45), gold(0.7), MAT.brass); }
    return r.url();
  });
}

/** A round enamel push button with a brass rim and a raised plus (the currency "+"). */
export function plusButton(d: number, k = 2, res = 1, down = false): string {
  return cachedRelief(`plus:${d}:${k}:${res}:${down}`, () => {
    const r = new Relief(d, d, res, k), c = d / 2;
    r.fill(disc(c, c, d / 2 - 0.1), torus(c, c, d / 2 - 1.3, 1.4, 2, 1), brass({ base: 0.62 }), MAT.brass, { id: 1 });
    r.fill(disc(c, c, d / 2 - 2.4), dome(c, c, d / 2 - 2.4, d / 2 - 2.4, down ? 0.8 : 2.4, down ? 1 : 2), weave(PAL.emerald, { base: down ? 0.45 : 0.55 }), MAT.enamel, { id: 2, seam: true });
    const pl = or(rect(c - 3, c - 0.9, 6, 1.8), rect(c - 0.9, c - 3, 1.8, 6));
    r.paint(pl, solid(hex('#fff4d6')), MAT.enamel); r.carve(pl, () => 1);
    return r.url();
  });
}

/** A small engraved brass name plate with two screws, w x h units. */
export function plate(w: number, h: number, k = 2, res = 1): string {
  return cachedRelief(`plate:${w}x${h}:${k}:${res}`, () => {
    const r = new Relief(w, h, res, k);
    r.fill(rrect(0, 0, w, h, 1.2), slab(0, 0, w, h, 2.4, 1.4), brass({ base: 0.64, brush: 'x', patina: 0.15 }), MAT.brass, { id: 1 });
    r.carve(and(rrect(1.6, 1.6, w - 3.2, h - 3.2, 0.6), not(rrect(2.2, 2.2, w - 4.4, h - 4.4, 0.6))), () => -0.6);
    screw(r, 3.2, h / 2, 1, 0.3); screw(r, w - 3.2, h / 2, 1, 1.1);
    return r.url();
  });
}

/** The walnut shelf the three big objects stand on: a thick board with a moulded lip and brass brackets. */
export function shelfBoard(w: number, k = 2, res = 1): string {
  return cachedRelief(`shelf:${w}:${k}:${res}`, () => {
    const h = 16, r = new Relief(w, h, res, k);
    r.fill(rect(1, 0, w - 2, 4.2), flat(3), woodGrain(PAL.walnut, { seed: 11, base: 0.66 }), MAT.varnish, { id: 1 });
    r.fill(rrect(0, 4, w, 7, 1), slab(0, 4, w, 7, 4, 1.6, 2), woodGrain(PAL.walnut, { seed: 12, base: 0.5 }), MAT.varnish, { id: 2, seam: true });
    r.carve(rect(0, 6.6, w, 0.8), () => -1.2);
    for (const bx of [16, w - 22]) {
      r.fill(poly([[bx, 11], [bx + 6, 11], [bx + 6, 12], [bx + 2, 15.6], [bx, 15.6]]), flat(3), brass({ base: 0.58, patina: 0.3 }), MAT.brass, { id: 3, seam: true });
      screw(r, bx + 3, 8.4, 0.9, 0.4);
    }
    return r.url();
  });
}

/** A small hanging tile for the side tools: a hardwood frame with brass corners round a coloured felt inset, a brass ring on top. */
export function toolTile(s: number, hue: PalRamp, k = 2, res = 1, seed = 1): string {
  return cachedRelief(`tool:${s}:${hue}:${k}:${res}:${seed}`, () => {
    const h = s + 4, r = new Relief(s, h, res, k), R = PAL[hue];
    r.fill(ring(s / 2, 2, 1, 2.2), torus(s / 2, 2, 1.6, 0.6, 1.2, 4), brass({ base: 0.66 }), MAT.brass, { id: 5 });
    r.fill(rrect(0, 4, s, s, 2.2), slab(0, 4, s, s, 4.4, 2), woodGrain(PAL.walnut, { seed, base: 0.52, along: seed % 2 ? 'x' : 'y' }), MAT.varnish, { id: 1 });
    const ins = rrect(3, 7, s - 6, s - 6, 1.2);
    r.carve(ins, () => -2.2);
    r.paint(ins, weave(R, { base: 0.52, seed }), MAT.velvet);
    for (const [x, y] of [[2.4, 6.4], [s - 2.4, 6.4], [2.4, s + 1.6], [s - 2.4, s + 1.6]]) r.fill(disc(x, y, 1.6), dome(x, y, 1.6, 1.6, 1.3, 4.6), brass({ base: 0.64 }), MAT.brass, { id: 6, seam: true });
    return r.url();
  });
}

/** The brass bulldog clip that holds the bedtime card. */
export function clip(k = 2, res = 1): string {
  return cachedRelief(`clip:${k}:${res}`, () => {
    const w = 22, h = 13, r = new Relief(w, h, res, k);
    r.fill(ring(w / 2, 3.2, 2, 3.3), torus(w / 2, 3.2, 2.6, 0.7, 1.4, 3), metal(PAL.iron, { base: 0.62 }), MAT.iron, { id: 3 });
    r.fill(rrect(1, 4.6, w - 2, 8, 1.4), (x, y) => 3 + (y - 4.6) * 0.25 + 0.8 * Math.sin(clamp((x - 1) / (w - 2)) * Math.PI), brass({ base: 0.62, brush: 'x', patina: 0.2 }), MAT.brass, { id: 1, seam: true });
    r.carve(rect(2.4, 9.6, w - 4.8, 0.7), () => -0.8);
    return r.url();
  });
}

/** A big nickel-and-brass clipboard clip: a pressed plate, a rolled lever and two rivets, w units wide. */
export function clipboardClip(w = 60, k = 2, res = 1): string {
  return cachedRelief(`cbclip:${w}:${k}:${res}`, () => {
    const h = 20, r = new Relief(w, h, res, k), cx = w / 2;
    r.fill(ring(cx, 5, 4.2, 6.4), torus(cx, 5, 5.3, 1.1, 2, 4), metal(PAL.iron, { base: 0.7 }), MAT.iron, { id: 1 });
    r.cut(rect(cx - 7, 5.4, 14, 3));
    r.fill(poly([[6, 8], [w - 6, 8], [w - 1, 19], [1, 19]]), (x, y) => 3 + (y - 8) * 0.2 + 1.2 * Math.sin(clamp((x - 1) / (w - 2)) * Math.PI), brass({ base: 0.64, brush: 'x', patina: 0.15 }), MAT.brass, { id: 2, seam: true });
    r.fill(rect(4, 15, w - 8, 3), tubeX(16.5, 1.5, 6), brass({ base: 0.7 }), MAT.brass, { id: 3, seam: true });
    for (const x of [10, w - 10]) { r.fill(disc(x, 11.4, 1.6), dome(x, 11.4, 1.6, 1.6, 1.4, 6), metal(PAL.iron, { base: 0.72 }), MAT.iron, { id: 4, seam: true }); }
    r.carve(rect(cx - 9, 11, 18, 0.7), () => -0.6);
    return r.url();
  });
}

/** A tile of printed damask wallpaper (u x u units): a deep ground, a lighter leafy motif, fine paper grain. */
export function wallpaperTile(hue: PalRamp = 'emerald', u = 32, k = 2): string {
  return cachedRelief(`wall:${hue}:${u}:${k}`, () => {
    const r = new Relief(u, u, 1, k), R = PAL[hue], G = PAL.gold;
    const motif = (x: number, y: number) => {
      // a lozenge lattice; in each cell a sprig of three leaves and a dot
      // a fleur sprig: a tall teardrop bud, two leaves curling up and out, a stem and a gilt berry;
      // a fine diamond trellis with gilt studs where its lines cross
      const cx = u / 2, cy = u / 2;
      const dx = Math.abs(x - cx), dy = y - cy;
      const bud = (dx / (1.5 - (dy + 6) * 0.12)) ** 2 + ((dy + 5) / 3.6) ** 2 < 1 && dy < -1.4;
      const lx = dx - 3.4, ly = dy + 1.2 + lx * 0.9;
      const side = (lx / 3.1) ** 2 + (ly / 1.25) ** 2 < 1 && dx > 0.8;
      const curl = Math.abs(Math.hypot(dx - 6.2, dy + 3.6) - 1.3) < 0.45 && dy < -2.6;
      const stem = dx < 0.45 && dy > -2 && dy < 4.6;
      const berry = Math.hypot(dx, dy - 5.6) < 1.25;
      const d1 = ((x + y) % u + u) % u, d2 = ((x - y) % u + u) % u;
      const lat = d1 < 0.45 || d2 < 0.45;
      const stud = (d1 < 1.1 || d1 > u - 1.1) && (d2 < 1.1 || d2 > u - 1.1);
      return bud || side || curl || stem ? 2 : berry || stud ? 3 : lat ? 1 : 0;
    };
    r.fill(rect(0, 0, u, u), flat(0), (x, y, mx, my) => {
      const m = motif(x, y);
      const grain = (vnoise(mx * 0.7, my * 0.7, 5) - 0.5) * 0.06 + (hash(Math.floor(mx * k), Math.floor(my * k), 2) - 0.5) * 0.04;
      if (m === 2) return rampAt(R, 0.5 + grain);
      if (m === 3) return rampAt(G, 0.55 + grain);
      if (m === 1) return rampAt(R, 0.36 + grain);
      return rampAt(R, 0.3 + grain);
    }, { spec: 0, shin: 1, emit: 1 }, { id: 1 });
    return r.url({ outline: false });
  });
}

/** A varnished board of any size in CSS px (1 art px per CSS px): for clipboards and panels. */
export function boardCSS(wPx: number, hPx: number, o: BoardOpts = {}): string {
  const W = Math.max(8, Math.round(wPx / 2)), H = Math.max(8, Math.round(hPx / 2));
  return board(W, H, 2, 1, o);
}

/** A twisted hemp rope tile, 6 x 6 px (1 texel per CSS px), tiling vertically: three strands spiralling, lit from the left. */
export function hempRope(): string {
  return cachedRelief('hemp', () => {
    const W = 6, H = 6, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!, img = g.createImageData(W, H), d = img.data;
    const R = [hex('#3a2410'), hex('#6a4a24'), hex('#94703c'), hex('#bc9658'), hex('#dcbc80'), hex('#f0d8a4')];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const strand = ((x + y * 1) % 3 + 3) % 3; // diagonal strands
      const across = x / (W - 1); // cylinder: lit on the left
      let v = 4.2 - across * 2.6 - (strand === 0 ? 1.4 : strand === 1 ? 0 : 0.5);
      if (x === 0) v -= 0.6;
      if (x === W - 1) v = 0.4;
      const col = R[Math.max(0, Math.min(5, Math.round(v)))];
      const j = (y * W + x) * 4;
      d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
}
/** A brass chain tile, 8 x 12 px: one link face on, one edge on, lit from the top left. */
export function brassChain(): string {
  return cachedRelief('bchain', () => {
    const W = 8, H = 12, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!, B = PAL.brass;
    const put = (x: number, y: number, i: number) => { const col = B[i]; g.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`; g.fillRect(x, y, 1, 1); };
    const ink = (x: number, y: number) => { g.fillStyle = '#1e1206'; g.fillRect(x, y, 1, 1); };
    // the face-on link: an open oval 6 wide, 7 tall
    const ring: [number, number, number][] = [[2, 0, 7], [3, 0, 8], [4, 0, 6], [1, 1, 7], [5, 1, 4], [1, 2, 6], [5, 2, 3], [1, 3, 6], [5, 3, 3], [1, 4, 5], [5, 4, 2], [1, 5, 4], [5, 5, 2], [2, 6, 3], [3, 6, 2], [4, 6, 2]];
    for (const [x, y, i] of ring) put(x, y, i);
    for (const [x, y] of [[1, 0], [5, 0], [0, 1], [6, 1], [0, 2], [6, 2], [0, 3], [6, 3], [0, 4], [6, 4], [0, 5], [6, 5], [1, 6], [5, 6], [2, 7], [3, 7], [4, 7]]) ink(x, y);
    // the edge-on link through it: a bar 2 wide
    for (let y = 5; y < 12; y++) { put(3, y, y < 8 ? 7 : 5); put(4, y, y < 8 ? 4 : 3); ink(2, y); ink(5, y); }
    put(3, 11, 6);
    return c.toDataURL('image/png');
  });
}

/** A dithered contact shadow (an ellipse that darkens toward its middle), w x h units. */
export function contactShadow(w: number, h: number, k = 2): string {
  return cachedRelief(`cshadow:${w}x${h}:${k}`, () => {
    const W = Math.round(w * k), H = Math.round(h * k), c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d')!, img = g.createImageData(W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const q = ((x + 0.5 - W / 2) / (W / 2)) ** 2 + ((y + 0.5 - H / 2) / (H / 2)) ** 2;
      if (q > 1) continue;
      const v = 1 - q, a = v > 0.55 ? 150 : v > 0.25 ? 105 : bayer(x, y) > 0 ? 70 : 0;
      if (!a) continue;
      const j = (y * W + x) * 4;
      d[j] = 30; d[j + 1] = 16; d[j + 2] = 10; d[j + 3] = a;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
}

// ------------------------------------------------------------------ the side tools' icons (22 x 22 units)

/** Rotated-rectangle shape: centre, half length along angle `a`, half width. */
const obar = (cx: number, cy: number, a: number, hl: number, hw: number): Shape => {
  const c = Math.cos(a), s = Math.sin(a);
  return (x, y) => { const u = (x - cx) * c + (y - cy) * s, v = -(x - cx) * s + (y - cy) * c; return Math.abs(u) <= hl && Math.abs(v) <= hw; };
};
export type ToolIcon = 'build' | 'shop' | 'wardrobe' | 'quests' | 'map' | 'settings';
/** The side tools' icons, modelled and lit like everything else: a claw hammer, a coin purse, a hanger with a scarf, a sealed scroll, a brass compass, a brass cog. */
export function toolIcon(id: ToolIcon, k = 2, res = 1): string {
  return cachedRelief(`ticon:${id}:${k}:${res}`, () => {
    const r = new Relief(22, 22, res, k);
    if (id === 'build') {
      const a = -0.86; // handle angle (up-right)
      r.fill(obar(9.5, 13.5, a, 8.6, 1.4), (x, y) => 2 + 1.2 * Math.cos(clamp(Math.abs(-(x - 9.5) * Math.sin(a) + (y - 13.5) * Math.cos(a)) / 1.4) * 1.4), woodGrain(PAL.oak, { seed: 3, base: 0.6, along: 'y', scale: 0.5 }), MAT.varnish, { id: 1 });
      r.fill(obar(4.4, 19.6, a, 1.8, 1.7), dome(4.4, 19.6, 2.4, 2.2, 2.4), metal(PAL.iron, { base: 0.4 }), MAT.iron, { id: 2, seam: true });
      // the head, square to the handle: a striking face one side, a curled claw the other
      const hx = 15.4, hy = 6.4, ha = a + Math.PI / 2;
      r.fill(obar(hx, hy, ha, 5.6, 2), (x, y) => 4 + 1.4 * Math.cos(clamp(Math.abs(-(x - hx) * Math.sin(ha) + (y - hy) * Math.cos(ha)) / 2) * 1.3), metal(PAL.iron, { base: 0.62, brush: 'x' }), MAT.iron, { id: 3, seam: true });
      r.fill(disc(hx + Math.cos(ha) * 5.6, hy + Math.sin(ha) * 5.6, 2.2), dome(hx + Math.cos(ha) * 5.6, hy + Math.sin(ha) * 5.6, 2.2, 2.2, 2, 4), metal(PAL.iron, { base: 0.7 }), MAT.iron, { id: 3 });
      r.fill(and(ring(hx - Math.cos(ha) * 4.4 + 1.6, hy - Math.sin(ha) * 4.4 + 2.2, 2.2, 3.6), (x, y) => y > hy - Math.sin(ha) * 4.4 - 2), flat(4), metal(PAL.iron, { base: 0.5 }), MAT.iron, { id: 3 });
      r.fill(and(seg(17.5, 17, 20.5, 20, 0.6)), flat(1.5), brass({ base: 0.6 }), MAT.brass, { id: 4 });
      r.fill(disc(17.3, 16.8, 1.1), dome(17.3, 16.8, 1.1, 1.1, 1, 1.5), brass({ base: 0.7 }), MAT.brass, { id: 4, seam: true });
    } else if (id === 'shop') {
      // a plump leather purse with a brass kiss-lock frame and a coin peeking out
      r.fill(disc(13.6, 6.2, 3.4), dome(13.6, 6.2, 3.4, 3.4, 2, 2), metal(PAL.gold, { base: 0.66 }), MAT.brass, { id: 5 });
      r.carve(ring(13.6, 6.2, 2.1, 2.6), () => -0.5);
      r.fill(and(ell(11, 14.2, 9, 7.4), (_x, y) => y > 7.4), (x, y) => puff(11, 14.6, 9, 7, 6, 2.2)(x, y), leatherGrain(PAL.rose, { base: 0.5 }), MAT.leather, { id: 1 });
      r.fill(and(ell(11, 9, 8.2, 3.2), (_x, y) => y < 9.6), (x) => 7 + 0.6 * Math.cos((x - 11) * 0.25), brass({ base: 0.62 }), MAT.brass, { id: 2, seam: true });
      r.fill(rect(2.8, 8.6, 16.4, 1.6), flat(7), brass({ base: 0.5 }), MAT.brass, { id: 2 });
      for (const bx of [9.6, 12.4]) r.fill(disc(bx, 5.6, 1.4), dome(bx, 5.6, 1.4, 1.4, 1.4, 7.4), brass({ base: 0.72 }), MAT.brass, { id: 3, seam: true });
      // stitching along the purse's belly
      for (let i = 0; i < 9; i++) { const an = Math.PI * (0.15 + i * 0.087); r.paint(disc(11 - Math.cos(an) * 7.2, 13.6 + Math.sin(an) * 5.6, 0.35), solid(hex('#f2d9b0'))); }
    } else if (id === 'wardrobe') {
      // a wooden coat hanger with a striped knitted scarf draped over it
      r.fill(ring(11, 3.6, 1.5, 2.6), torus(11, 3.6, 2.05, 0.55, 1, 3), metal(PAL.iron, { base: 0.6 }), MAT.iron, { id: 1 });
      r.cut(and(rect(11, 3, 3, 4)));
      r.fill(seg(11, 5.8, 11, 7.4, 0.5), flat(3), metal(PAL.iron, { base: 0.6 }), MAT.iron, { id: 1 });
      r.fill(or(seg(11, 7.6, 1.6, 12.6, 1.15), seg(11, 7.6, 20.4, 12.6, 1.15)), (x, y) => 3 + 0.8 * Math.cos(0.5), woodGrain(PAL.cherry, { seed: 5, base: 0.6 }), MAT.varnish, { id: 2, seam: true });
      const scarf: Shape = or(poly([[6, 10.4], [9.6, 8.6], [10.6, 20.6], [6.6, 21.2]]), poly([[9.6, 8.6], [13.4, 9.2], [14.2, 18.4], [10.6, 18.6]]));
      r.fill(scarf, (x, y) => 5 + Math.sin(x * 1.3) * 0.5 - Math.max(0, y - 18) * 0.3, (_x, _y, mx, my) => {
        const stripe = Math.floor((my + mx * 0.15) / 2.4) % 2;
        const knit = ((Math.floor(mx * 2) + Math.floor(my * 2)) & 1) ? 0.05 : -0.05;
        return rampAt(stripe ? PAL.plum : PAL.linen, clamp((stripe ? 0.55 : 0.6) + knit));
      }, MAT.cloth, { id: 3, seam: true });
      // fringe at the ends
      for (let i = 0; i < 4; i++) r.fill(seg(6.8 + i, 21.2, 6.6 + i * 1.05, 22, 0.35), flat(4.5), solid(rampAt(PAL.plum, 0.5)), MAT.cloth, { id: 4 });
    } else if (id === 'quests') {
      // a rolled parchment scroll tied with a ribbon and sealed with red wax
      r.fill(roundRect(3, 6, 16, 11, 1.4), (x, y) => 2 + 2.8 * Math.sqrt(Math.max(0, 1 - ((y - 11.5) / 5.6) ** 2)), paperGrain(PAL.paper, { base: 0.66 }), MAT.paper, { id: 1 });
      for (const ex of [3, 19]) r.fill(ell(ex, 11.5, 1.8, 5.6), (x, y) => 3 + 2 * Math.sqrt(Math.max(0, 1 - ((y - 11.5) / 5.6) ** 2)), (_x, _y, mx, my) => rampAt(PAL.paper, clamp(0.5 + Math.sin(Math.hypot(mx - ex, (my - 11.5) * 0.35) * 4) * 0.12)), MAT.paper, { id: 2, seam: true });
      r.carve(rect(3.5, 13.8, 15, 0.6), () => -0.6);
      r.fill(rect(10, 5.4, 2.4, 12.4), flat(5.2), weave(PAL.rose, { base: 0.5 }), MAT.cloth, { id: 3, seam: true });
      r.fill(or(poly([[11, 16], [8.4, 21.2], [10.2, 20.6], [11.2, 17]]), poly([[11.4, 16], [14.2, 21.4], [12.4, 20.8], [11.2, 17]])), flat(4.8), weave(PAL.rose, { base: 0.46 }), MAT.cloth, { id: 3, seam: true });
      r.fill(disc(11.2, 15.4, 3), (x, y) => 6 + 1.6 * Math.sqrt(Math.max(0, 1 - ((x - 11.2) ** 2 + (y - 15.4) ** 2) / 9)) + (vnoise(x * 2, y * 2, 3) - 0.5) * 0.6, solid(hex('#b8232a'), 0.15), { spec: 0.6, shin: 30, bands: 6 }, { id: 4, seam: true });
      r.carve(ring(11.2, 15.4, 1.3, 1.8), () => -0.7);
    } else if (id === 'map') {
      // a brass pocket compass: a ring on top, a knurled bezel, an enamel card with a red and steel needle
      r.fill(ring(11, 2.6, 1.3, 2.5), torus(11, 2.6, 1.9, 0.6, 1.2, 3), brass({ base: 0.62 }), MAT.brass, { id: 1 });
      r.fill(rect(9.8, 3.8, 2.4, 2.4), tubeY(11, 1.2, 3), brass({ base: 0.6 }), MAT.brass, { id: 1, seam: true });
      r.fill(disc(11, 13, 8.6), torus(11, 13, 7.4, 1.4, 2.6, 2), brass({ base: 0.66, brush: 'r', cx: 11, cy: 13 }), MAT.brass, { id: 2, seam: true });
      r.fill(disc(11, 13, 6.4), flat(3.4), (_x, _y, mx, my) => rampAt(PAL.enamel, 0.72 - Math.hypot(mx - 11, my - 13) * 0.02), MAT.enamel, { id: 3, seam: true });
      for (let i = 0; i < 8; i++) { const an = (i / 8) * Math.PI * 2, r0 = i % 2 ? 5 : 4.2; r.paint(seg(11 + Math.sin(an) * r0, 13 - Math.cos(an) * r0, 11 + Math.sin(an) * 5.8, 13 - Math.cos(an) * 5.8, 0.3), solid(hex('#3a2a1c'))); }
      r.fill(poly([[11, 7.6], [12.2, 13], [9.8, 13]]), flat(4.6), solid(hex('#c4302b')), MAT.enamel, { id: 4 });
      r.fill(poly([[11, 18.4], [12.2, 13], [9.8, 13]]), flat(4.6), metal(PAL.sapphire, { base: 0.6 }), MAT.iron, { id: 4 });
      r.fill(disc(11, 13, 0.9), dome(11, 13, 0.9, 0.9, 0.8, 4.8), brass({ base: 0.75 }), MAT.brass, { id: 5 });
    } else {
      // a brass cog with a smaller steel one behind it
      const cog = (cx: number, cy: number, R: number, teeth: number, hole: number, M: RGB[], base: number, ph: number): [Shape, (x: number, y: number) => number] => {
        const sh: Shape = (x, y) => {
          const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx) + ph;
          const t = (Math.cos(a * teeth) + 1) / 2;
          return d <= R - 1.6 + (t > 0.45 ? 1.6 : 0) && d >= hole;
        };
        return [sh, (x, y) => { const d = Math.hypot(x - cx, y - cy); return base + 1.4 * smooth(hole, hole + 1.2, d) * (d < R - 2.2 ? 1 : 0.7) + (d > R - 4 && d < R - 3 ? -0.4 : 0); }];
      };
      void PAL;
      const [s2, h2] = cog(16.4, 15.6, 5.6, 7, 1.4, PAL.iron, 1, 0.3);
      r.fill(s2, h2, metal(PAL.iron, { base: 0.58, brush: 'r', cx: 16.4, cy: 15.6 }), MAT.iron, { id: 1 });
      const [s1, h1] = cog(9, 9, 8.2, 9, 2.4, PAL.brass, 3, 0);
      r.fill(s1, h1, brass({ base: 0.64, brush: 'r', cx: 9, cy: 9 }), MAT.brass, { id: 2, seam: true });
      r.carve(ring(9, 9, 4.2, 4.8), () => -0.7);
    }
    return r.url();
  });
}

// ------------------------------------------------------------------ the morning's gift sack

const BURLAP = [hex('#4a2e14'), hex('#6c4620'), hex('#8e6230'), hex('#ac7e42'), hex('#c49a58'), hex('#d8b474'), hex('#e8cc94')];
/**
 * Pip's gift sack, 56 x 58 units: a plump burlap sack stuffed with lumpy presents, its neck gathered and
 * tied with a twisted rope, a sapphire patch with a gilt moon stitched on the front. `open` 0..1 loosens
 * the neck and lets the warm light of the presents spill out.
 */
export function giftSack(open = 0, k = 2): string {
  return cachedRelief(`sack:${open.toFixed(2)}:${k}`, () => {
    const W = 56, H = 58, r = new Relief(W, H, 1, k), cx = 28;
    const burlap: AFn = (_x, _y, mx, my) => {
      const X = Math.floor(mx * 1.6), Y = Math.floor(my * 1.6), over = ((X + Y) & 1) ? 0.07 : -0.07;
      const slub = hash(Y, 1, 5) > 0.82 ? 0.06 : hash(X, 2, 5) > 0.86 ? -0.06 : 0;
      return rampAt(BURLAP, clamp(0.52 + over + slub + (fbm(mx * 0.08, my * 0.08, 3) - 0.5) * 0.18));
    };
    // ---- the body: bottom-heavy, lumpy with the presents inside
    const body = (x: number, y: number) => { const u = (x - cx) / (22.5 - Math.max(0, 40 - y) * 0.12), v = (y - 39) / 17.5; return u * u + Math.max(v, -1.2) ** 2 * (v > 0 ? 1.15 : 0.62) <= 1 && y < 56; };
    r.fill(Object.assign(body, { bb: [2, 18, 54, 57] as [number, number, number, number] }), (x, y) => {
      const u = (x - cx) / 23, v = (y - 39) / 18, base = Math.max(0, 1 - u * u - v * v);
      const lumps = (fbm(x * 0.09, y * 0.09, 11) - 0.5) * 6 + Math.sin(x * 0.35 + y * 0.12) * 0.6;
      return 3 + 11 * Math.sqrt(base) + lumps * Math.sqrt(base);
    }, burlap, MAT.cloth, { id: 1 });
    // gathers running up into the neck
    r.carve(Object.assign((x: number, y: number) => y < 34 && y > 18, { bb: [10, 18, 46, 34] as [number, number, number, number] }), (x, y) => Math.sin((x - cx) * 0.9) * 0.9 * (34 - y) / 16);
    // ---- the neck and its ruffled mouth
    const neckW = 7 + open * 6, mouthW = 13 + open * 7;
    r.fill(Object.assign((x: number, y: number) => y >= 9 && y < 22 && Math.abs(x - cx) < neckW + (22 - y) * (mouthW - neckW) / 13 * (y < 14 ? 1 : 0.4), { bb: [cx - 22, 9, cx + 22, 22] as [number, number, number, number] }), (x) => 9 + Math.sin((x - cx) * 1.1) * 1.1, burlap, MAT.cloth, { id: 2, seam: true });
    // tied shut, the cloth above the rope bunches up into a ruffle of little peaks
    if (open < 0.05) {
      // soft, uneven peaks of bunched cloth, flaring out over the rope
      const top = (x: number) => { const u = (x - cx + 40) / 3.1, i = Math.floor(u), f = u - i; return 3.4 + hash(i, 7, 3) * 2.6 + (1 - Math.sin(f * Math.PI)) * 2.4 + Math.abs(x - cx) * 0.16; };
      r.fill(Object.assign((x: number, y: number) => Math.abs(x - cx) < mouthW && y >= top(x) && y < 12, { bb: [cx - mouthW, 3, cx + mouthW, 12] as [number, number, number, number] }),
        (x, y) => 9.5 + Math.sin((x - cx) * 1.85) * 1.4 - (12 - y) * 0.1, burlap, MAT.cloth, { id: 3, seam: true });
      r.carve(Object.assign((x: number, y: number) => y < 12, { bb: [cx - mouthW, 3, cx + mouthW, 12] as [number, number, number, number] }), (x) => (((x - cx + 40) % 3.1) < 0.45 ? -1.4 : 0));
    }
    // opening: dark inside, the presents' light spilling out
    const mouth = ell(cx, 10, mouthW * 0.95, 2.2 + open * 3.6);
    if (open >= 0.05) r.fill(mouth, flat(8), (_x, _y, mx, my) => {
      const d = Math.hypot((mx - cx) / (mouthW * 0.95), (my - 10) / (2.2 + open * 3.6));
      if (open < 0.05) return hex('#2a1608');
      return rampAt([hex('#3a1e08'), hex('#b8701e'), hex('#f2c050'), hex('#fff0b0'), hex('#ffffff')], clamp(open * 1.1 - d * 0.7 + 0.15));
    }, open > 0.05 ? MAT.glow : MAT.cloth, { id: 3, seam: true });
    // ---- the rope: twisted, round the neck, with a looped bow and two tails
    const ropeA: AFn = (_x, _y, mx, my) => rampAt([hex('#5a3818'), hex('#8a6030'), hex('#b88c4c'), hex('#dcb878'), hex('#f0d8a4')], clamp(0.62 + (((Math.floor(mx * 1.4 - my * 1.4) % 3) + 3) % 3 - 1) * 0.16));
    r.fill(rect(cx - neckW - 2.5, 20.5, (neckW + 2.5) * 2, 3.6), tubeX(22.3, 1.8, 10), ropeA, MAT.cloth, { id: 4, seam: true });
    r.fill(and(ring(cx + 6, 25, 2.4, 4.2), (_x, y) => y > 21), torus(cx + 6, 25, 3.3, 0.9, 1.6, 11), ropeA, MAT.cloth, { id: 5, seam: true });
    r.fill(or(seg(cx + 3, 23, cx + 1, 32, 0.9), seg(cx + 5, 23, cx + 8, 33, 0.9)), flat(11), ropeA, MAT.cloth, { id: 5, seam: true });
    // ---- the patch: sapphire cloth, a running stitch, a gilt crescent and two stars
    const patch = rrect(cx - 8.5, 33, 17, 15, 1.4);
    r.fill(patch, (x, y) => 3 + 11 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 23) ** 2 - ((y - 39) / 18) ** 2)) + 0.8, weave(PAL.sapphire, { base: 0.46 }), MAT.cloth, { id: 6, seam: true });
    r.carve(and(patch, not(rrect(cx - 7.4, 34.1, 14.8, 12.8, 1))), () => -0.3);
    r.paint(and(patch, not(rrect(cx - 7.6, 33.9, 15.2, 13.2, 1)), (x, y) => (Math.floor(x * 2) + Math.floor(y * 2)) % 3 === 0), solid(hex('#f0dca8')));
    const moon = and(disc(cx - 0.6, 40.5, 4.6), not(disc(cx + 1.6, 39.2, 3.8)));
    r.paint(moon, metal(PAL.gold, { base: 0.66 }), MAT.brass); r.carve(moon, () => 0.6);
    for (const [sx, sy] of [[cx + 4, 37], [cx + 3, 44]]) { const st = or(rect(sx - 0.4, sy - 1.2, 0.8, 2.4), rect(sx - 1.2, sy - 0.4, 2.4, 0.8)); r.paint(st, metal(PAL.gold, { base: 0.78 }), MAT.brass); }
    r.shadow = null;
    return r.url();
  });
}

/** Detail level for a HUD part: 2 art px per unit on phones, 3 where the HUD is shown 1.5x (desktop). */
export const DESK_HUD = '(min-width: 900px) and (min-height: 640px)';
export const DESK_NAV = '(min-width: 900px) and (min-height: 760px)';
export const kFor = (q: string) => { try { return matchMedia(q).matches ? 3 : 2; } catch { return 2; } };
