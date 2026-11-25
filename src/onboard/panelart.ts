// Hand-painted pixel art for the interview's form layer, painted texel by texel (tex.ts) and cached as data URLs:
// nothing here is a clean geometric shape. Paper has deckle edges, chipped corners, a dog-ear, foxing and fibres;
// the leather folio is creased, scuffed at the corners and stitched with uneven thread; brass is hue-shifted (warm
// lights, cool olive shadows) with rubbed highlights; ink boxes and ticks wobble like a hand drew them; outlines are
// selective (a darker hue of what they surround, never flat black).
import { crispText, fbm, hash, rgb, Tex, vnoise, mix3, mul3, type RGB } from './tex.ts';
import { F } from './fonts.ts';

const cache = new Map<string, string>();
const art = (key: string, paint: () => Tex) => { let u = cache.get(key); if (!u) { u = paint().canvas(64).toDataURL(); cache.set(key, u); } return u; };
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

/** hue-shifted ramps */
const PAPER: RGB[] = [rgb(0xb89a72), rgb(0xd2bb94), rgb(0xe6d6b4), rgb(0xf2e7cf), rgb(0xfaf4e4)];
const LEATHER: RGB[] = [rgb(0x1e0d0c), rgb(0x34160f), rgb(0x4e2214), rgb(0x6a311c), rgb(0x854528), rgb(0xa05e36)];
const BRASS: RGB[] = [rgb(0x3a2c10), rgb(0x6a5218), rgb(0x9c7a26), rgb(0xc89e38), rgb(0xe8c45a), rgb(0xfde9a0)];
const INK = rgb(0x1d2552), INK2 = rgb(0x39457a);
const pickR = (r: RGB[], t: number, x: number, y: number) => r[Math.round(clamp(t + (hash(x, y, 91) - 0.5) * 0.18) * (r.length - 1))];

/** an irregular rectangle: how far a texel is inside the wobbly edge (<0 outside) */
function inset(x: number, y: number, w: number, h: number, seed: number, rough = 1.6, corner = 3) {
  const e = Math.min(x + 0.5, y + 0.5, w - x - 0.5, h - y - 0.5);
  // edge noise along the perimeter
  const along = x < 3 || x > w - 4 ? y : x;
  const n = (vnoise(along * 0.35, (x < 3 ? 1 : x > w - 4 ? 2 : y < 3 ? 3 : 4) * 9.1, seed) - 0.5) * rough * 2 + (hash(along, 7, seed) > 0.93 ? 1 : 0);
  // rounded, uneven corners
  const cx = Math.min(x + 0.5, w - x - 0.5), cy = Math.min(y + 0.5, h - y - 0.5);
  const cr = corner + hash(x < w / 2 ? 1 : 2, y < h / 2 ? 3 : 4, seed) * 2;
  const cornerCut = cx < cr && cy < cr ? cr - Math.hypot(cr - cx, cr - cy) : 0;
  return e - Math.max(0, n) + Math.min(0, cornerCut);
}

// ------------------------------------------------------------------ paper

/** A sheet of cream laid paper, w x h texels: deckle edges, a dog-eared corner, foxing, fibres, a soft cast shadow. */
export function sheetURL(w: number, h: number, seed = 1, o: { dog?: boolean; stain?: boolean } = {}) {
  return art(`sheet${w}x${h}:${seed}:${o.dog ? 1 : 0}${o.stain ? 1 : 0}`, () => {
    const t = new Tex(w + 3, h + 3);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    const dog = o.dog ? 9 + Math.floor(hash(seed, 1, 2) * 4) : 0;
    // the cast shadow (offset down-right, dithered)
    for (let y = 0; y < h + 3; y++) for (let x = 0; x < w + 3; x++) {
      const d = inset(x - 2, y - 2, w, h, seed);
      if (d >= 0 && ((x + y) & 1 || d > 1)) { t.set(x, y, rgb(0x1a0c06)); t.alpha(x, y, d > 1 ? 0.35 : 0.2); }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = inset(x, y, w, h, seed);
      if (d < 0) continue;
      // the dog-ear: the corner folded back (bottom right)
      const fx = w - 1 - x, fy = h - 1 - y;
      if (dog && fx + fy < dog) continue;
      let k = 0.72 + (fbm(x * 0.05, y * 0.05, seed) - 0.5) * 0.12;
      if (vnoise(x * 0.9, y * 0.06, seed + 3) > 0.86) k -= 0.04; // fibres
      if (y % 5 === 0) k -= 0.012;                                // laid lines
      k -= Math.max(0, 3 - d) * 0.05;                              // darker, worn edge
      if (fbm(x * 0.12, y * 0.12, seed + 9) > 0.73) k -= 0.09;     // foxing
      if (o.stain) { const r = Math.hypot(x - w * 0.78, y - h * 0.16); if (Math.abs(r - 11) < 1.2 && vnoise(x * 0.4, y * 0.4, 5) > 0.3) k -= 0.1; }
      let c = pickR(PAPER, k, x, y);
      if (hash(x, y, seed + 4) > 0.995) c = mul3(c, 0.85);
      t.set(x, y, c); t.alpha(x, y, 1);
      // the folded flap of the dog-ear: the paper's back, shaded, the crease darker
      if (dog && fx <= dog && fy <= dog && fx + fy >= dog) t.set(x, y, pickR(PAPER, fx + fy < dog + 1.5 ? 0.3 : 0.5 + (fx - fy) * 0.01, x, y));
    }
    return t;
  });
}

// ------------------------------------------------------------------ the leather folio behind the sheet

export function folioURL(w: number, h: number) {
  return art(`folio${w}x${h}`, () => {
    const t = new Tex(w + 4, h + 4);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    for (let y = 0; y < h + 4; y++) for (let x = 0; x < w + 4; x++) {
      const d = inset(x - 3, y - 4, w, h, 11, 1, 6);
      if (d >= 0 && ((x + y) & 1 || d > 1.5)) { t.set(x, y, rgb(0x0e0504)); t.alpha(x, y, 0.45); }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = inset(x, y, w, h, 11, 1, 6);
      if (d < 0) continue;
      const n = fbm(x * 0.04, y * 0.04, 12) - 0.5;
      const crease = Math.abs(vnoise(x * 0.05 + n * 3, y * 0.02, 13) - 0.5) < 0.02 ? -0.15 : 0;
      let k = 0.45 + n * 0.4 + crease + (vnoise(x * 0.8, y * 0.8, 14) - 0.5) * 0.1;
      // a lighter rolled edge, scuffed corners
      if (d < 2) k += d < 1 ? -0.2 : 0.14;
      const cx = Math.min(x, w - 1 - x), cy = Math.min(y, h - 1 - y);
      if (cx < 14 && cy < 14 && fbm(x * 0.3, y * 0.3, 15) > 0.55) k += 0.18;
      t.set(x, y, pickR(LEATHER, k, x, y)); t.alpha(x, y, 1);
    }
    // stitching: uneven pale thread a few texels in
    for (let i = 0; i < 2 * (w + h); i += 4) {
      let x: number, y: number;
      if (i < w) { x = i; y = 4; } else if (i < w + h) { x = w - 5; y = i - w; } else if (i < 2 * w + h) { x = w - (i - w - h); y = h - 5; } else { x = 4; y = h - (i - 2 * w - h); }
      if (x < 6 || y < 6 || x > w - 7 || y > h - 7) continue;
      const horiz = y === 4 || y === h - 5, j = Math.round((hash(i, 3, 16) - 0.5) * 1.2);
      for (let k = 0; k < 2; k++) {
        const px = horiz ? x + k : x + j, py = horiz ? y + j : y + k;
        t.set(px, py, k ? rgb(0xc9a878) : rgb(0xe8d0a0));
      }
    }
    return t;
  });
}

/** A brass bulldog clip, w x h. */
export function clipURL() {
  return art('clip', () => {
    const w = 46, h = 22, t = new Tex(w, h);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // the body: a trapezoid with a rolled top edge, slightly uneven
      const hw = 21 - y * 0.35 + (vnoise(y * 0.5, 1, 3) - 0.5) * 0.8;
      if (Math.abs(x + 0.5 - w / 2) > hw || y > 16) continue;
      let k = 0.55 - (x - w / 2) * 0.012 - y * 0.02;
      if (y < 4) k = 0.85 - y * 0.12;            // the rolled lip catches the light
      if (Math.abs(x + 0.5 - w / 2) > hw - 1.2) k -= 0.3; // edge in shadow
      if (y === 10 && Math.abs(x - w / 2) < 14) k -= 0.25; // a stamped groove
      if (hash(x, y, 9) > 0.93) k -= 0.15;         // patina specks
      t.set(x, y, pickR(BRASS, k, x, y)); t.alpha(x, y, 1);
    }
    // the wire handles folded over
    for (const sx of [-1, 1]) for (let y = 14; y < 22; y++) {
      const x = Math.round(w / 2 + sx * (13 - (y - 14) * 0.4));
      t.set(x, y, pickR(BRASS, 0.75, x, y)); t.alpha(x, y, 1);
      t.set(x + sx, y, pickR(BRASS, 0.3, x, y)); t.alpha(x + sx, y, 1);
    }
    return t;
  });
}

// ------------------------------------------------------------------ ink: boxes, ticks, loops, rules

/** The frames of an ink tick being drawn (n frames side by side, 16 x 14 each). */
export function tickStripURL(n = 6, seed = 1) {
  return art(`tick${n}:${seed}`, () => {
    const W = 16, H = 14, t = new Tex(W * n, H);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    const pts: [number, number][] = [[2, 7], [5, 11], [14, 1]];
    const lens = [Math.hypot(3, 4), Math.hypot(9, 10)], total = lens[0] + lens[1];
    for (let f = 0; f < n; f++) {
      const upto = ((f + 1) / n) * total;
      for (let d = 0; d <= upto; d += 0.35) {
        const seg = d < lens[0] ? 0 : 1, k = seg ? (d - lens[0]) / lens[1] : d / lens[0];
        const x = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * k, y = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * k + Math.sin(d * 1.3 + seed) * 0.3;
        const wgt = seg ? 1.6 - k * 0.9 : 1.2; // the stroke thins as it flicks up
        for (let a = 0; a < wgt; a += 1) { t.set(f * W + Math.round(x + a * 0.6), Math.round(y), INK); t.alpha(f * W + Math.round(x + a * 0.6), Math.round(y), 1); }
      }
    }
    return t;
  });
}
/** A pencil-ish ink loop drawn round something, w x h, the last frame complete (n frames stacked vertically). */
export function loopStripURL(w: number, h: number, n = 6, seed = 1) {
  return art(`loop${w}x${h}:${n}:${seed}`, () => {
    const t = new Tex(w, h * n);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    for (let f = 0; f < n; f++) {
      const steps = 220, upto = ((f + 1) / n) * steps;
      for (let i = 0; i <= upto; i++) {
        const a = -Math.PI * 0.62 + (i / steps) * Math.PI * 2.18;
        const r = 1 + Math.sin(a * 3 + seed) * 0.025 + (i / steps) * 0.04;
        const x = w / 2 + Math.cos(a) * (w / 2 - 2) * r, y = h / 2 + Math.sin(a) * (h / 2 - 2) * r;
        const px = Math.round(x), py = f * h + Math.round(y);
        if (px < 0 || px >= w || py < f * h || py >= (f + 1) * h) continue;
        t.set(px, py, INK); t.alpha(px, py, 1);
      }
    }
    return t;
  });
}
/** A wavering hand-ruled line, w texels long. */
export function ruleURL(w: number, seed = 1) {
  return art(`rule${w}:${seed}`, () => {
    const t = new Tex(w, 3);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    for (let x = 0; x < w; x++) {
      const y = 1 + Math.round((vnoise(x * 0.06, 1, seed) - 0.5) * 1.6);
      if (hash(x, 2, seed) > 0.97) continue; // the nib skipped
      t.set(x, y, INK2); t.alpha(x, y, 0.85);
    }
    return t;
  });
}

// ------------------------------------------------------------------ the rubber stamp impression

/** RECEIVED / APPROVED in a double-ruled box, red ink that took unevenly, w x h. */
export function stampURL(word: string, sub: string, color = 0xb3232b, seed = 3) {
  return art(`stamp:${word}:${sub}:${color}:${seed}`, () => {
    const w = 96, h = 40, t = new Tex(w, h);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    const c = rgb(color), dk = mul3(c, 0.75);
    const ink = (x: number, y: number, miss = 0.74) => {
      if (vnoise(x * 0.3, y * 0.3, seed) > miss || hash(x, y, seed) > 0.9 + (miss - 0.74) * 0.6) return; // where the rubber missed
      t.set(x, y, hash(x, y, seed + 1) > 0.6 ? dk : c); t.alpha(x, y, 0.9);
    };
    for (let i = 0; i < w; i++) for (const [y, ww] of [[1, 2], [h - 3, 2], [5, 1], [h - 6, 1]] as [number, number][]) for (let k = 0; k < ww; k++) ink(i, y + k + Math.round((vnoise(i * 0.1, y, seed) - 0.5)));
    for (let j = 1; j < h - 1; j++) for (const x of [1, 2, w - 3, w - 2, 5, w - 6]) if (x !== 5 && x !== w - 6 ? true : j > 4 && j < h - 5) ink(x, j);
    // the word, set in rubber type: printed through the same uneven ink
    const print = (text: string, y: number, font: string, bold: boolean) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const g = cv.getContext('2d');
      if (!g) return;
      crispText(g, text, w / 2, y, font, '#000', { align: 'center', spacing: bold ? 1 : 0 });
      const d = g.getImageData(0, 0, w, h).data;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[(j * w + i) * 4 + 3] > 128) { ink(i, j, 0.86); if (bold) ink(i, j + 1, 0.86); }
    };
    print(word, sub ? 22 : 25, F.body(18), true);
    if (sub) print(sub, 32, F.small(16), false);
    return t;
  });
}

// ------------------------------------------------------------------ small bits: tape, sticky note, slider, acorns

export function tapeURL(seed = 1) {
  return art('tape' + seed, () => {
    const w = 30, h = 10, t = new Tex(w, h);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const torn = (x < 2 && hash(1, y, seed) > 0.4) || (x > w - 3 && hash(2, y, seed) > 0.4);
      if (torn) continue;
      t.set(x, y, mix3(rgb(0xf3ead2), rgb(0xe4d6b0), vnoise(x * 0.3, y * 0.3, seed)));
      t.alpha(x, y, 0.72);
    }
    return t;
  });
}
export function stickyURL(w = 62, h = 56) {
  return art(`sticky${w}x${h}`, () => {
    const t = new Tex(w + 2, h + 2);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) if (inset(x - 2, y - 2, w, h, 21, 0.8, 1) >= 0 && (x + y) & 1) { t.set(x, y, rgb(0x1a0c06)); t.alpha(x, y, 0.3); }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const d = inset(x, y, w, h, 21, 0.8, 1);
      if (d < 0) continue;
      const curl = Math.max(0, (x + (h - y)) - (w + h - 14)) / 14; // the bottom-right corner lifts
      let k = 0.62 + (vnoise(x * 0.08, y * 0.08, 22) - 0.5) * 0.12 - (y < 8 ? 0.08 : 0) - curl * 0.25 + (d < 1 ? -0.1 : 0);
      if (hash(x, y, 23) > 0.99) k -= 0.1;
      const Y: RGB[] = [rgb(0xb89a2a), rgb(0xd8bd3c), rgb(0xf0d65a), rgb(0xf8e888), rgb(0xfdf4b8)];
      t.set(x, y, pickR(Y, k, x, y)); t.alpha(x, y, 1);
    }
    return t;
  });
}
/** A brass slider rail (w texels) with its engraved ticks. */
export function railURL(w: number) {
  return art('rail' + w, () => {
    const h = 9, t = new Tex(w, h);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    for (let y = 2; y < 7; y++) for (let x = 0; x < w; x++) {
      const end = x < 2 || x > w - 3;
      if (end && (y === 2 || y === 6)) continue;
      const k = [0.85, 0.6, 0.35, 0.45, 0.25][y - 2] + (hash(x, y, 5) - 0.5) * 0.1;
      t.set(x, y, pickR(BRASS, k, x, y)); t.alpha(x, y, 1);
    }
    for (let x = 1; x < w - 1; x++) { t.set(x, 7, rgb(0x2a1608)); t.alpha(x, 7, 0.4); }
    return t;
  });
}
export function knobURL() {
  return art('knob', () => {
    const w = 14, h = 18, t = new Tex(w, h);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      // a turned brass knob with a pointer below, lit from the top left
      const top = y < 12, d = Math.hypot((x + 0.5 - 7) / 6.2, (y + 0.5 - 6) / 6) + (vnoise(x, y, 4) - 0.5) * 0.08;
      if (top ? d > 1 : Math.abs(x + 0.5 - 7) > (17 - y) * 0.9) continue;
      let k = top ? 0.7 - ((x - 7) * 0.05 + (y - 6) * 0.06) - (d > 0.82 ? 0.3 : 0) : 0.4 - (x - 7) * 0.05;
      if (top && Math.hypot(x - 4.5, y - 3.5) < 1.6) k = 1;
      t.set(x, y, pickR(BRASS, k, x, y)); t.alpha(x, y, 1);
    }
    return t;
  });
}
/** a little acorn for the progress row: done (inked), now (gold), to come (outline) */
export function acornURL(state: 'done' | 'now' | 'todo') {
  return art('acorn' + state, () => {
    const rows = ['..cc..', '.cCCc.', 'cCCCCc', '.nNNn.', '.nNNn.', '..nn..'];
    const t = new Tex(6, 6);
    for (let i = 0; i < t.a.length; i++) t.a[i] = 0;
    const col: Record<string, RGB> = state === 'done' ? { c: rgb(0x5a3a1a), C: rgb(0x7a5228), n: rgb(0x8a5a2a), N: rgb(0xb07a3a) }
      : state === 'now' ? { c: rgb(0x8a6a1a), C: rgb(0xd8a838), n: rgb(0xc08030), N: rgb(0xf0c060) }
        : { c: rgb(0xb8a47a), C: rgb(0xe6d6b4), n: rgb(0xb8a47a), N: rgb(0xe6d6b4) };
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (col[ch]) { t.set(x, y, col[ch]); t.alpha(x, y, 1); } }));
    return t;
  });
}
