// Pixel art for the interview clipboard, painted texel by texel in the calm palette (see pixart.ts): the
// speckled hardboard, the spring clip with its slotted screws, ruled paper with fibres, pencil tick boxes,
// the rubber stamp, a pencil, the ink speckle, stickers, tape, and the 9-slice frames for cards and buttons.
import { P, hex, mixc } from '../gfx/palette.ts';
import { art, boardFill, frame9, GRAPHITE, hardboardReal, hash, INK, inkLine, paperFill, paperReal, Pix, R, screw, step, vnoise, woodFill, type Frame9 } from './pixart.ts';
void boardFill;

export { pixelCorners } from './pixart.ts';

/** Hardboard for the clipboard back (w x h CSS px, one texel per px: detailed and realistic). */
export function boardURL(w: number, h: number) {
  const W = Math.round(w), H = Math.round(h);
  return art(`board${W}x${H}`, () => {
    const p = new Pix(W, H);
    hardboardReal(p, 0, 0, W, H);
    // the hanging slot under the clip, a pressed maker's stamp, a pencil tally scratched in a corner
    const cx = Math.round(W / 2);
    for (let x = cx - 18; x <= cx + 18; x++) for (let y = 8; y <= 15; y++) {
      const corner = (x === cx - 18 || x === cx + 18) && (y === 8 || y === 15);
      if (!corner) p.rgb(x, y, 40, 30, 24);
    }
    for (let x = cx - 17; x <= cx + 17; x++) p.tint(x, 16, 40, 34, 26);
    const mx = W - 70, my = H - 22;
    for (let x = 0; x < 50; x++) { p.tint(mx + x, my, -26, -24, -20); p.tint(mx + x, my + 11, 18, 16, 12); }
    for (let k = 0; k < 9; k++) for (let y = 3; y < 8; y++) if (hash(k, y, 3) > 0.3) p.tint(mx + 4 + k * 5, my + y, -22, -20, -16);
    for (let k = 0; k < 4; k++) for (let y = 0; y < 9; y++) p.tint(14 + k * 4, H - 24 + y, 26, 24, 20);
    for (let k = 0; k < 15; k++) p.tint(12 + k, H - 20 + Math.round(k * 0.3), 26, 24, 20);
    p.corners(4);
    return p;
  });
}

/** One sheet of ruled paper at one texel per px: pulp, fibres, foxing, faded blue rules, a red margin, holes. */
export function sheetURL(w: number, h: number, seed = 3) {
  const W = Math.round(w), H = Math.round(h);
  return art(`sheet${W}x${H}:${seed}`, () => {
    const p = new Pix(W, H);
    paperReal(p, 0, 0, W, H, { seed, tone: seed % 2 ? 0xefe8d6 : 0xf1ead8, age: 0.8 });
    for (let y = 46; y < H - 8; y += 18) inkLine(p, 4, W - 5, y, 0x8fa6b6, seed + y, 0.9);
    for (let y = 0; y < H; y++) { const x = 28 + (vnoise(1, y * 0.05, seed) > 0.85 ? 1 : 0); const i = (y * W + x) * 4; p.rgb(x, y, p.d[i] * 0.55 + 0xb8 * 0.45, p.d[i + 1] * 0.55 + 0x78 * 0.45, p.d[i + 2] * 0.55 + 0x78 * 0.45); }
    // a faint fold across the middle and a dog-eared corner
    const fy = Math.round(H * 0.52);
    for (let x = 0; x < W; x++) { p.tint(x, fy, -8, -8, -7); p.tint(x, fy + 1, 6, 6, 5); }
    for (let k = 0; k < 12; k++) for (let j = 0; j <= k; j++) p.tint(W - 13 + k, H - 1 - j, k === j ? -30 : -12, k === j ? -30 : -14, k === j ? -28 : -18);
    // two punched holes near the top, their edges a little torn
    for (const hx of [Math.round(W * 0.25), Math.round(W * 0.75)]) {
      p.disc(hx, 11, 5.2, 5.2, (nx, ny) => (ny < -0.2 ? '#2a2019' : '#3e3024'));
      p.ring(hx, 11, 7, 1.6, (nx, ny) => (hash(Math.round(nx * 9), Math.round(ny * 9), seed) > 0.5 ? '#d8cfb8' : null));
    }
    return p;
  });
}

/** The clipboard's spring clip: a steel plate held by two slotted screws, a rolled hinge, the lever and a badge. */
export function clipURL() {
  return art('clip3', () => {
    const W = 64, H = 34, p = new Pix(W, H), S = R.frost, D = R.iron;
    const st = [D[1], D[2], S[1], S[2], S[3], S[4], S[5]];
    // plate: bevelled steel with brushed streaks
    for (let y = 13; y < 30; y++) for (let x = 6; x < W - 6; x++) {
      const e = Math.min(x - 6, W - 7 - x, y - 13, 29 - y);
      let t = 3 + (y < 16 ? 1.5 : y > 26 ? -1.5 : 0) + (hash(x, y >> 1, 4) > 0.86 ? 0.8 : 0) - (hash(x >> 2, y, 6) > 0.9 ? 0.8 : 0);
      if (e === 0) t = y === 13 ? 6 : 0;
      p.set(x, y, st[Math.max(0, Math.min(6, Math.round(t)))]);
    }
    // the screws
    screw(p, 12, 22, 3, R.brass, 0.4);
    screw(p, W - 12, 22, 3, R.brass, 2.2);
    // rolled spring hinge: a tube with coil grooves
    for (let x = 10; x < W - 10; x++) for (let y = 7; y < 14; y++) {
      const t = [1, 3, 5, 6, 4, 2, 1][y - 7];
      p.set(x, y, st[(x - 10) % 4 === 0 ? Math.max(0, t - 2) : t]);
    }
    // the bent wire lever over the top
    for (let x = 17; x < W - 17; x++) { p.set(x, 1, S[5]); p.set(x, 2, S[3]); p.set(x, 3, D[1]); }
    for (let y = 1; y < 9; y++) { p.set(16, y, S[4]); p.set(17, y, S[2]); p.set(W - 18, y, S[3]); p.set(W - 17, y, D[2]); }
    // a little brass maker's badge with a moon
    for (let y = 17; y < 25; y++) for (let x = W / 2 - 7; x < W / 2 + 7; x++) {
      const e = Math.min(x - (W / 2 - 7), W / 2 + 6 - x, y - 17, 24 - y);
      p.set(x, y, e === 0 ? R.brass[1] : step(R.brass, y < 19 ? 4.6 : 3 + (vnoise(x * 0.4, y * 0.4, 2) - 0.5), x, y));
    }
    p.disc(W / 2, 21, 2.4, 2.4, R.brass[1]);
    p.disc(W / 2 + 1, 20.5, 2, 2, R.brass[3]);
    return p.outline(INK).drop(1, 2);
  });
}

/** A hand-drawn graphite tick box (empty or ticked). */
export function boxURL(ticked: boolean) {
  return art('box' + ticked, () => {
    const p = new Pix(14, 14), g = GRAPHITE, g2 = hex(mixc(P.ink3, P.paper, 0.3));
    for (let i = 1; i < 11; i++) { p.set(i, 2 + (i === 6 ? 1 : 0) - 1, i % 4 ? g : g2); p.set(i, 11, g); p.set(1, i, g); p.set(11 - (i === 4 ? 1 : 0), i, i % 3 ? g : g2); }
    if (ticked) {
      const ink = INK, hi = GRAPHITE;
      for (const [x, y] of [[3, 6], [4, 7], [5, 8], [6, 9], [7, 8], [8, 6], [9, 5], [10, 3], [11, 2], [12, 1], [13, 0]] as [number, number][]) { p.set(x, y, ink); p.set(x, y + 1, hi); }
    }
    return p;
  });
}

/** The rubber stamp: a turned wooden knob and neck, a block, and berry-red rubber. */
export function stampToolURL() {
  return art('stamp3', () => {
    const W = 36, H = 46, p = new Pix(W, H), wd = R.woodLight, rb = R.berry;
    p.disc(18, 7, 7.5, 6.5, (nx, ny) => wd[nx + ny < -0.8 ? 5 : nx + ny < -0.1 ? 4 : nx + ny < 0.6 ? 3 : nx + ny < 1.1 ? 2 : 1]);
    p.disc(16, 5, 2, 1.4, wd[5]);
    for (let y = 13; y < 24; y++) {
      const half = y < 15 ? 3 : y < 20 ? 2 : 3;
      for (let x = 18 - half; x < 18 + half; x++) p.set(x, y, wd[x < 18 - half + 1 ? 4 : x >= 18 + half - 1 ? 1 : y % 5 === 0 ? 2 : 3]);
    }
    woodFill(p, 4, 24, 28, 9, R.woodDark, { seed: 6, bevel: true, base: 3.2 });
    p.rect(3, 33, 30, 2, R.woodDeep[1]);
    for (let y = 35; y < 41; y++) for (let x = 4; x < 32; x++) p.set(x, y, rb[y === 35 ? 4 : y === 40 ? 1 : hash(x, y, 2) > 0.9 ? 2 : 3]);
    return p.outline(INK);
  });
}

/** A pencil lying on its side: sharpened graphite tip, honey hexagonal body, brass ferrule, rose eraser. */
export function pencilURL() {
  return art('pencil3', () => {
    const W = 50, H = 9, p = new Pix(W, H), hy = R.honey, br = R.brass, er = R.rose, cd = R.woodPale;
    for (let x = 0; x < W; x++) for (let y = 1; y < 8; y++) {
      if (x < 9) {
        const half = Math.round((x / 9) * 3.5);
        if (Math.abs(y - 4) > half) continue;
        p.set(x, y, x < 3 ? GRAPHITE : y < 4 ? cd[4] : cd[2]);
      } else if (x < 40) p.set(x, y, hy[y === 1 ? 5 : y < 3 ? 4 : y === 4 ? 4 : y < 6 ? 2 : 1]);
      else if (x < 44) p.set(x, y, br[y < 3 ? 5 : y < 5 ? 3 : 1 + (x % 2)]);
      else p.set(x, y, er[y < 3 ? 4 : y < 6 ? 3 : 1]);
    }
    for (let x = 12; x < 38; x += 9) p.set(x, 3, hy[5]);
    return p.outline(INK);
  });
}

/** Speckle mask for inked stamps (rubber that didn't quite touch the paper). */
export function speckURL() {
  return art('speck', () => {
    const N = 32, p = new Pix(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = hash(x, y, 9), r2 = hash(x >> 2, y >> 2, 3);
      p.set(x, y, '#000000', r < 0.1 || (r2 < 0.18 && r < 0.45) ? 40 : 255);
    }
    return p;
  });
}

/** A pixel vignette for the edges of the screen (hard alpha steps, no soft gradient). */
export function vignetteURL() {
  return art('vig', () => {
    const W = 48, H = 96, p = new Pix(W, H), c = hex(mixc(P.deepNight, P.woodDeep, 0.3));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x + 0.5) / W * 2 - 1, ny = (y + 0.5) / H * 2 - 1;
      const d = Math.max(0, Math.hypot(nx * 0.95, ny * 0.78) - 0.62);
      const a = Math.floor(Math.min(1, d * 1.9) * 4 + (hash(x, y, 1) - 0.5) * 0.6);
      if (a > 0) p.set(x, y, c, Math.min(4, a) * 34);
    }
    return p;
  });
}

/** A strip of washi tape with torn ends. */
export function tapeURL(col = P.sage, seed = 1) {
  return art('tape' + col + ':' + seed, () => {
    const W = 30, H = 10, p = new Pix(W, H), r = [hex(mixc(col, P.ink, 0.15)), hex(col), hex(mixc(col, P.paper, 0.35))];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const torn = (x < 2 && hash(0, y, seed) > 0.5) || (x > W - 3 && hash(1, y, seed) > 0.5);
      if (torn) continue;
      p.set(x, y, (x + y * 2) % 7 === 0 ? r[2] : y === 0 ? r[2] : y === H - 1 ? r[0] : r[1], 210);
    }
    return p;
  });
}

// ------------------------------------------------------------------ frames

/** A card of thick cream stock (one texel per px): pulp and fibres, a hand-inked edge, a shaded underside. */
export const cardFrame = (on = false): Frame9 => frame9('card' + on, 36, 12, (p, n) => {
  paperReal(p, 0, 0, n, n, { seed: on ? 5 : 3, tone: on ? 0xe6dcc0 : 0xf2ebda, age: 0.4, fibres: 1.4 });
  const ink = on ? [74, 70, 58] : [58, 55, 48];
  for (let i = 0; i < n; i++) {
    const g = hash(i, 7, on ? 2 : 1);
    if (g < 0.93) { p.rgb(i, 0, ink[0], ink[1], ink[2]); p.rgb(0, i, ink[0], ink[1], ink[2]); }
    p.rgb(i, n - 1, ink[0], ink[1], ink[2]); p.rgb(n - 1, i, ink[0], ink[1], ink[2]);
    p.tint(i, 1, 10, 10, 8); p.tint(1, i, 10, 10, 8);
    p.tint(i, n - 2, -22, -24, -24); p.tint(i, n - 3, -12, -13, -13); p.tint(n - 2, i, -18, -19, -19);
  }
  if (on) for (let i = 4; i < n - 4; i++) { if (hash(i, 1, 4) > 0.2) p.rgb(i, 4, 92, 94, 100); if (hash(i, 2, 4) > 0.25) p.rgb(4, i, 92, 94, 100); }
  p.corners(2);
});

/** Chunky pixel buttons: moss (go), honey (approve), linen (neutral), off (disabled); `down` is pressed. */
export const buttonFrame = (kind: 'moss' | 'honey' | 'linen' | 'off', down = false): Frame9 => frame9(`btn${kind}${down}`, 20, 7, (p, n) => {
  const r = kind === 'moss' ? R.woodLight : kind === 'honey' ? R.straw : kind === 'linen' ? R.oat : R.linen;
  const lip = down ? 1 : 3;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const bot = y >= n - 1 - lip;
    let t = bot ? 1 : y <= 2 ? 5 : y < n / 2 ? 4 : 3;
    if (!bot && (x <= 1)) t = 4;
    if (!bot && x >= n - 2) t = 2;
    p.set(x, y, r[t]);
  }
  for (let i = 0; i < n; i++) { p.set(i, 0, INK); p.set(i, n - 1, INK); p.set(0, i, INK); p.set(n - 1, i, INK); }
  if (down) for (let i = 1; i < n - 1; i++) p.set(i, 1, r[1]);
  p.corners(2);
  p.set(2, 1, INK); p.set(1, 2, INK); p.set(n - 3, 1, INK); p.set(n - 2, 2, INK); p.set(1, n - 3, INK); p.set(2, n - 2, INK); p.set(n - 2, n - 3, INK); p.set(n - 3, n - 2, INK);
});

/** The speaker's brass name plate. */
export const plaqueFrame = (): Frame9 => frame9('plaque', 16, 5, (p, n) => {
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) p.set(x, y, R.brass[y === 1 ? 5 : y === 2 ? 4 : y >= n - 2 ? 1 : 3]);
  for (let i = 0; i < n; i++) { p.set(i, 0, INK); p.set(i, n - 1, INK); p.set(0, i, INK); p.set(n - 1, i, INK); }
  p.set(2, 2, R.brass[1]); p.set(n - 3, 2, R.brass[1]); p.set(2, n - 3, R.brass[1]); p.set(n - 3, n - 3, R.brass[1]);
  p.corners(1);
});

/** A recess pressed into the paper (where answers and stickers go). */
export const slotFrame = (): Frame9 => frame9('slot', 14, 5, (p, n) => {
  paperFill(p, 0, 0, n, n, R.oat, 8, 3.2);
  for (let i = 0; i < n; i++) { p.set(i, 0, R.oat[1]); p.set(0, i, R.oat[1]); p.set(i, 1, R.oat[2]); p.set(1, i, R.oat[2]); p.set(i, n - 1, R.paper[5]); p.set(n - 1, i, R.paper[5]); }
  for (let i = 3; i < n - 3; i += 2) { p.set(i, 3, R.oat[2]); }
  p.corners(1);
});

/** A die-cut sticker: a white border round a coloured field. */
export const stickerFrame = (col: keyof typeof R): Frame9 => frame9('stk' + col, 16, 5, (p, n) => {
  const r = R[col];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const e = Math.min(x, y, n - 1 - x, n - 1 - y);
    p.set(x, y, e === 0 ? r[1] : e < 3 ? R.snow[e === 1 ? 4 : 5] : step(r, 3.2 + (vnoise(x * 0.3, y * 0.3, 3) - 0.5) * 0.8, x, y));
  }
  p.corners(2);
});

/** A wooden tag (for little labels). */
export const tagFrame = (): Frame9 => frame9('tag', 16, 5, (p, n) => {
  woodFill(p, 0, 0, n, n, R.woodLight, { seed: 3, bevel: true, base: 3.3 });
  for (let i = 0; i < n; i++) { p.set(i, 0, INK); p.set(i, n - 1, INK); p.set(0, i, INK); p.set(n - 1, i, INK); }
  p.corners(1);
});
