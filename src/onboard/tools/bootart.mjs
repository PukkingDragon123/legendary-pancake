// Generates the loading screen (the `#boot` block in index.html): one carved walnut mantel clock,
// alone on a calm, softly painted moonlit wall. Nothing else: no title, no captions. The minute and
// hour hands sweep as the app loads, the moon rises over two mossy hills in the arch, the second
// hand ticks and the pendulum swings behind its little window. Every moving part is pre-drawn as
// pixel-art frames (60 hand angles, cosine-spaced pendulum frames) and played with CSS steps(), so
// the clock is pixel perfect at every angle and animates before any script has loaded.
// src/onboard/boot.ts takes over once the app is ready (the hands strike midnight, the glass door
// swings open and the camera dives through the dial into the world).
//
//   node src/onboard/tools/bootart.mjs        rewrites the block between the boot markers
//
// Colours come from src/gfx/palette.ts. Not part of the app bundle.
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ palette (parsed from palette.ts)

const palSrc = readFileSync(fileURLToPath(new URL('../../gfx/palette.ts', import.meta.url)), 'utf8');
const PAL = {};
for (const m of palSrc.matchAll(/(\w+):\s*0x([0-9a-fA-F]{6})/g)) PAL[m[1]] = [parseInt(m[2].slice(0, 2), 16), parseInt(m[2].slice(2, 4), 16), parseInt(m[2].slice(4, 6), 16)];
const C = (k) => { if (!PAL[k]) throw new Error('palette: ' + k); return PAL[k]; };
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
const mul = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
const shadow = (c, k = 0.3) => mix(mul(c, 1 - k * 0.6), C('slate'), k * 0.35);
const light = (c, k = 0.3) => mix(mul(c, 1 + k * 0.35), C('lamp'), k * 0.3);
const css = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');

// ------------------------------------------------------------------ tiny RGBA canvas + PNG

class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.in(x, y) || !c) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255 || this.d[i + 3] === 0) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a; return; }
    const t = a / 255;
    for (let k = 0; k < 3; k++) this.d[i + k] = Math.round(this.d[i + k] * (1 - t) + c[k] * t);
    this.d[i + 3] = Math.max(this.d[i + 3], a);
  }
  get(x, y) { if (!this.in(x, y)) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]] : null; }
  a(x, y) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  clear(x, y) { if (this.in(x, y)) { const i = (y * this.w + x) * 4; this.d[i] = this.d[i + 1] = this.d[i + 2] = this.d[i + 3] = 0; } }
  blit(src, ox, oy) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.set(ox + x, oy + y, c, c[3]); } }
  png() {
    const raw = Buffer.alloc((this.w * 4 + 1) * this.h);
    for (let y = 0; y < this.h; y++) { raw[y * (this.w * 4 + 1)] = 0; Buffer.from(this.d.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1); }
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4); ihdr[8] = 8; ihdr[9] = 6;
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  }
  url() { return 'data:image/png;base64,' + this.png().toString('base64'); }
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(b) { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return c ^ -1; }

const hash = (x, y, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/** pick from a ramp with ordered dithering between steps (t: 0 dark .. 1 light) */
const pick = (ramp, t, x, y, d = 1) => ramp[clamp(Math.floor(t * (ramp.length - 1) + (bayer(x, y) - 0.5) * d + 0.5), 0, ramp.length - 1)];
/** distance from a pixel centre to a point */
const dist = (x, y, cx, cy) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
/** A relief carved or cast from a mask: lit edges face the lamp (top-left), shadowed edges and a
 *  1px cast shadow fall bottom-right. paint(x, y, t) gives the material at a lit value t. */
function emboss(b, mask, x0, y0, w, h, paint, base = 0.55) {
  const M = (x, y) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h && mask(x, y);
  for (let y = y0; y < y0 + h + 1; y++) for (let x = x0; x < x0 + w + 1; x++) {
    if (!M(x, y)) { if (M(x - 1, y - 1) && b.a(x, y)) { const c = b.get(x, y); b.set(x, y, mix(c, C('deepNight'), 0.38)); } continue; }
    const tl = !M(x - 1, y) || !M(x, y - 1), br = !M(x + 1, y) || !M(x, y + 1);
    const t = tl && !br ? base + 0.3 : br && !tl ? base - 0.26 : base + (hash(x, y, 77) - 0.5) * 0.08;
    b.set(x, y, paint(x, y, t));
  }
}
/** lens-shaped leaf mask from (ax, ay) along angle a */
const leafMask = (ax, ay, a, len, wid) => (x, y) => {
  const px = x + 0.5 - ax, py = y + 0.5 - ay, u = px * Math.cos(a) + py * Math.sin(a), v = -px * Math.sin(a) + py * Math.cos(a);
  return u >= 0 && u <= len && Math.abs(v) <= Math.sin((u / len) * Math.PI) * wid;
};

// ------------------------------------------------------------------ ramps

const WOOD = [shadow(C('barkDark'), 0.6), C('barkDark'), C('woodDeep'), mix(C('woodDeep'), C('woodDark'), 0.5), C('woodDark'), mix(C('woodDark'), C('wood'), 0.55), C('wood'), light(C('wood'), 0.35), C('woodLight'), light(C('woodLight'), 0.5)];
const BRASS = [shadow(C('brassDark'), 0.7), mix(C('brassDark'), C('woodDeep'), 0.3), C('brassDark'), mix(C('brassDark'), C('brass'), 0.5), C('brass'), mix(C('brass'), C('honey'), 0.5), light(C('brass'), 0.6), C('lamp'), light(C('lamp'), 0.8)];
const ENAMEL = [C('straw'), mix(C('straw'), C('linen'), 0.5), C('linen'), mix(C('linen'), C('oat'), 0.5), C('oat'), mix(C('oat'), C('paper'), 0.5), C('paper'), mix(C('paper'), C('snow'), 0.5)];
const STEEL = [C('deepNight'), C('night'), mix(C('night'), C('slate'), 0.5), C('slate'), C('dusk'), C('lake'), C('sky')];
const MOSS = [C('forest'), C('pine'), C('leaf'), C('fern'), C('moss'), C('sage'), C('sageLight')];
const INK = C('ink'), INK2 = C('ink2');
const OUT = mix(shadow(C('barkDark'), 0.8), C('deepNight'), 0.4); // outline ink: deep slate-brown

// ------------------------------------------------------------------ the clock: geometry

const W = 112, H = 180, CX = 56;
const DY = 88;               // dial centre (a pixel corner, so the hands rotate symmetrically)
const R_DIAL = 31, R_BEZ = 35;
const ARCH = { cx: 56, cy: 52, r: 38 };       // the wooden arch
const PLATE = { x0: 20, x1: 92, y0: 52, y1: 124, r: 33 }; // the brass break-arch dial plate
const MOONW = { cx: 56, cy: 52, r: 15 };      // the moon window in the plate arch
const BODY = { x0: 12, x1: 100, y0: 50, y1: 152 };
const PIL = 8;                                  // pilaster width
const WIN = { x0: 44, x1: 68, y0: 128, y1: 148, cx: 56, cy: 140, r: 12 }; // pendulum window
const PIVOT = { x: 56, y: 116 }, PEND_LEN = 26, PEND_R = 5;
const PLINTH = { x0: 6, x1: 106, y0: 152, y1: 164 };
const FEET = [[10, 26], [86, 102]], FOOT_Y0 = 164, FOOT_Y1 = 172;

const inArch = (x, y) => y < ARCH.cy && dist(x, y, ARCH.cx, ARCH.cy) < ARCH.r;
const inPlate = (x, y) => (x >= PLATE.x0 && x < PLATE.x1 && y >= PLATE.y0 && y < PLATE.y1) || (y < PLATE.y0 && dist(x, y, CX, PLATE.y0) < PLATE.r);
const inMoonWin = (x, y) => y < MOONW.cy && dist(x, y, MOONW.cx, MOONW.cy) < MOONW.r && !(dist(x, y, 48.5, 52.5) < 7.6 || dist(x, y, 63.5, 52.5) < 7.6);
const inWin = (x, y) => x >= WIN.x0 && x < WIN.x1 && y < WIN.y1 && (y >= WIN.cy || dist(x, y, WIN.cx, WIN.cy) < WIN.r);

// ------------------------------------------------------------------ painters

/** Walnut with flowing grain. dir: 'v' vertical boards, 'h' horizontal rails, 'a' follows the arch. */
function wood(x, y, t, dir = 'v', seed = 0) {
  let u, v;
  if (dir === 'h') { u = y; v = x; }
  else if (dir === 'a') { u = dist(x, y, ARCH.cx, ARCH.cy) * 1.0; v = Math.atan2(y - ARCH.cy, x - ARCH.cx) * 30; }
  else { u = x; v = y; }
  // grain: wavy lines across u, distorted by low-frequency noise along v
  const warp = (vnoise(u * 0.06, v * 0.025, 3 + seed) - 0.5) * 9 + Math.sin(v * 0.05 + u * 0.08 + seed) * 1.6;
  const g = u + warp;
  const band = ((g / 3.4) % 1 + 1) % 1;
  const figure = fbm(u * 0.09, v * 0.02, 11 + seed) - 0.5; // broad light/dark figure
  let k = t + figure * 0.28;
  if (band < 0.2 && hash(Math.floor(g * 2), Math.floor(v / 3), 5 + seed) > 0.2) k -= 0.13; // a dark grain line
  else if (band > 0.55 && band < 0.7) k += 0.04;
  // rare pores
  if (hash(x, y, 9 + seed) > 0.985) k -= 0.12;
  return pick(WOOD, clamp(k, 0, 1), x, y, 0.9);
}
/** Brass: lit top-left, rubbed bright on the high spots. */
const brass = (x, y, t) => pick(BRASS, clamp(t + (hash(x, y, 21) - 0.5) * 0.08, 0, 1), x, y, 0.8);
/** global light: warm lamplight from the front-left-top */
const lit = (x, y) => 0.08 * (1 - y / H) + 0.06 * (1 - x / W) - 0.03;

// ------------------------------------------------------------------ the case (body, arch, plinth, feet, crest)

function paintCase() {
  const b = new Buf(W, H);
  // ground shadow (behind everything): a dithered pixel ellipse
  for (let y = 166; y < 180; y++) for (let x = 0; x < W; x++) {
    const nx = (x + 0.5 - CX) / 54, ny = (y + 0.5 - 172) / 6.2, d = nx * nx + ny * ny;
    if (d < 1) { const a = d < 0.45 ? 0.62 : d < 0.75 ? 0.4 : 0.22; if (bayer(x, y) < a + 0.2) b.set(x, y, mix(C('deepNight'), C('night'), 0.3), 255); }
  }
  // bun feet: turned wood with a brass collar
  for (const [x0, x1] of FEET) {
    const fc = (x0 + x1) / 2, fr = (x1 - x0) / 2;
    for (let y = FOOT_Y0; y < FOOT_Y1; y++) for (let x = x0; x < x1; x++) {
      const nx = (x + 0.5 - fc) / fr, ny = (y + 0.5 - FOOT_Y0) / (FOOT_Y1 - FOOT_Y0);
      const prof = Math.sqrt(Math.max(0, 1 - (ny * 1.15 - 0.15) ** 2)); // a squashed bun
      if (Math.abs(nx) > prof * 1.02) continue;
      const t = 0.52 - nx * 0.32 - ny * 0.3 + lit(x, y);
      b.set(x, y, y < FOOT_Y0 + 2 ? brass(x, y, 0.62 - nx * 0.35 - (y - FOOT_Y0) * 0.2) : wood(x, y, t, 'h', 4));
    }
  }
  // plinth: an ogee moulding with a carved acorn garland and a little brass keyhole
  for (let y = PLINTH.y0; y < PLINTH.y1; y++) {
    const r = y - PLINTH.y0;
    const inset = r < 2 ? 2 : r < 3 ? 1 : 0;
    for (let x = PLINTH.x0 + inset; x < PLINTH.x1 - inset; x++) {
      // profile: lip (light), cove (shadow to light), torus (round), base fillet
      const prof = [0.82, 0.6, 0.28, 0.36, 0.5, 0.62, 0.72, 0.66, 0.52, 0.36, 0.56, 0.3][r];
      let t = prof + lit(x, y) + (x < PLINTH.x0 + 4 ? 0.06 : x > PLINTH.x1 - 5 ? -0.12 : 0);
      if (x === PLINTH.x0 + inset) t += 0.1; if (x === PLINTH.x1 - inset - 1) t -= 0.18;
      // rubbed corners
      if ((x < PLINTH.x0 + 3 || x > PLINTH.x1 - 4) && r >= 5 && r <= 8 && hash(x, y, 3) > 0.55) t += 0.16;
      b.set(x, y, wood(x, y, t, 'h', 2));
    }
  }
  // a carved band of little leaves along the torus, running out from the keyhole
  {
    const parts = [];
    for (let i = 0; i < 9; i++) for (const sd of [-1, 1]) {
      const lx = CX + sd * (8 + i * 5), ly = PLINTH.y0 + 7;
      parts.push(leafMask(lx, ly, sd < 0 ? Math.PI + (i % 2 ? 0.45 : -0.45) : (i % 2 ? -0.45 : 0.45), 6, 1.6));
    }
    emboss(b, (x, y) => parts.some((m) => m(x, y)) && x > PLINTH.x0 + 3 && x < PLINTH.x1 - 4, PLINTH.x0, PLINTH.y0 + 3, PLINTH.x1 - PLINTH.x0, 8, (x, y, t) => wood(x, y, t + 0.05, 'h', 2), 0.52);
  }
  // brass keyhole escutcheon
  for (let y = PLINTH.y0 + 3; y < PLINTH.y0 + 10; y++) for (let x = CX - 4; x < CX + 4; x++) {
    const nx = Math.abs(x + 0.5 - CX) / 4, ny = (y - PLINTH.y0 - 3) / 7;
    if (nx > 1 - Math.abs(ny - 0.5) * 0.6) continue;
    b.set(x, y, brass(x, y, 0.75 - ny * 0.5 - (x - CX) * 0.04));
  }
  b.set(CX - 1, PLINTH.y0 + 5, INK); b.set(CX, PLINTH.y0 + 5, INK); b.set(CX - 1, PLINTH.y0 + 6, INK); b.set(CX, PLINTH.y0 + 6, INK); b.set(CX - 1, PLINTH.y0 + 7, INK2); b.set(CX, PLINTH.y0 + 7, INK);

  // the body: vertical boards between the pilasters, a cornice on the shoulders
  for (let y = BODY.y0; y < BODY.y1; y++) for (let x = BODY.x0; x < BODY.x1; x++) {
    let t = 0.5 + lit(x, y);
    const pilL = x < BODY.x0 + PIL, pilR = x >= BODY.x1 - PIL;
    if (pilL || pilR) {
      // fluted pilaster: three grooves, rounded edges, brass capital and base
      const px = pilL ? x - BODY.x0 : x - (BODY.x1 - PIL);
      const cap = y >= BODY.y0 + 2 && y < BODY.y0 + 7, base = y >= BODY.y1 - 9 && y < BODY.y1 - 5;
      if (cap || base) {
        const ry = cap ? y - BODY.y0 - 2 : y - (BODY.y1 - 9);
        const tt = [0.85, 0.62, 0.4, 0.7, 0.5][ry] ?? 0.5;
        b.set(x, y, brass(x, y, tt - (px - 3.5) * 0.05 + (pilR ? -0.08 : 0)));
        continue;
      }
      const flute = px === 2 || px === 4 || px === 6;
      t = 0.58 - Math.abs(px - 3.5) * 0.05 + (px === 0 ? 0.2 : 0) + (px === PIL - 1 ? -0.22 : 0) + (pilR ? -0.1 : 0.02) + lit(x, y);
      if (flute) t -= 0.24;
      if (flute && hash(x, y >> 1, 4) > 0.8) t += 0.08;
      b.set(x, y, wood(x, y, t, 'v', pilL ? 1 : 5));
      continue;
    }
    // the lower panel below the dial: a recessed field with a bevelled frame
    if (y >= PLATE.y1) {
      const fy0 = PLATE.y1 + 2, fy1 = BODY.y1 - 2;
      const inField = y >= fy0 && y < fy1 && x >= BODY.x0 + PIL + 2 && x < BODY.x1 - PIL - 2;
      if (!inField) t = y < fy0 ? 0.66 : y >= fy1 ? 0.3 : x < CX ? 0.6 : 0.36;
      else {
        t = 0.44;
        if (y === fy0) t = 0.2; if (x === BODY.x0 + PIL + 2) t = 0.26;
        if (y === fy1 - 1) t = 0.62; if (x === BODY.x1 - PIL - 3) t = 0.6;
      }
      b.set(x, y, wood(x, y, t + lit(x, y), inField ? 'v' : 'h', 7));
      continue;
    }
    // shoulders (outside the arch, above the plate) and the stiles beside the plate
    if (y < BODY.y0 + 3) t = [0.86, 0.66, 0.3][y - BODY.y0];
    b.set(x, y, wood(x, y, t + lit(x, y), y < BODY.y0 + 3 ? 'h' : 'v', 3));
  }
  // cornice overhang on the shoulders
  for (let y = BODY.y0 - 2; y < BODY.y0 + 1; y++) for (const [x0, x1] of [[BODY.x0 - 2, 22], [90, BODY.x1 + 2]]) for (let x = x0; x < x1; x++) {
    if (inArch(x, y)) continue;
    const t = [0.78, 0.6, 0.34][y - BODY.y0 + 2] + lit(x, y) + (x === x0 ? 0.1 : 0) - (x === x1 - 1 ? 0.15 : 0);
    b.set(x, y, wood(x, y, t, 'h', 8));
  }
  // the arch: a moulded semicircle above the shoulders (outer bead, cove, inner fillet)
  for (let y = 0; y < ARCH.cy + 1; y++) for (let x = 0; x < W; x++) {
    if (!inArch(x, y)) continue;
    const d = dist(x, y, ARCH.cx, ARCH.cy), ring = ARCH.r - d; // 0 at the outer edge
    const ang = Math.atan2(y + 0.5 - ARCH.cy, x + 0.5 - ARCH.cx); // -pi..0 across the top
    const facing = -Math.cos(ang + Math.PI * 0.75); // light from the top-left
    let t;
    if (ring < 1.2) t = 0.5 + facing * 0.32;            // outer bead edge
    else if (ring < 2.4) t = 0.72 + facing * 0.2;        // bead highlight
    else if (ring < 3.6) t = 0.36 + facing * 0.12;       // cove in shadow
    else t = 0.55 + facing * 0.1;                        // the broad arch face
    b.set(x, y, wood(x, y, t + lit(x, y), 'a', 6));
  }
  // carved crest on top of the arch: two leafy scrolls and the plinth of the brass acorn finial
  const leaf = (lx, ly, dx, dy, len, s) => {
    for (let i = 0; i < len; i++) {
      const w = Math.sin((i / len) * Math.PI) * 2.2;
      for (let j = -Math.ceil(w); j <= Math.ceil(w); j++) {
        if (Math.abs(j) > w + 0.2) continue;
        const x = Math.round(lx + dx * i - dy * j * 0.6), y = Math.round(ly + dy * i + dx * j * 0.6);
        const t = 0.62 - j * 0.12 * s - i / len * 0.15;
        b.set(x, y, wood(x, y, Math.abs(j) < 0.5 && i > 1 && i < len - 1 ? t - 0.22 : t, 'v', 9));
      }
    }
  };
  leaf(52, 15, -0.92, -0.38, 9, 1); leaf(48, 13, -0.6, 0.8, 6, 1); leaf(60, 15, 0.92, -0.38, 9, -1); leaf(64, 13, 0.6, 0.8, 6, -1);
  leaf(43, 12, -0.95, 0.3, 6, 1); leaf(69, 12, 0.95, 0.3, 6, -1);
  for (let y = 9; y < 14; y++) for (let x = CX - 5; x < CX + 5; x++) {
    const r = y - 9;
    if (r < 2 && (x < CX - 4 + (1 - r) || x >= CX + 4 - (1 - r))) continue;
    b.set(x, y, wood(x, y, [0.8, 0.62, 0.42, 0.56, 0.36][r] + (x < CX ? 0.06 : -0.08), 'h', 10));
  }
  // brass acorn finial: a cup with a cross-hatched rim, a nut and a stalk
  for (let y = 0; y < 10; y++) for (let x = CX - 5; x < CX + 5; x++) {
    const nx = (x + 0.5 - CX);
    if (y < 2) { if (Math.abs(nx) < 1) b.set(x, y, brass(x, y, 0.6 - nx * 0.2)); continue; }
    if (y < 5) { // the cup
      if (Math.abs(nx) > 4.2 - (y === 2 ? 1 : 0)) continue;
      const hatch = (x + y) % 2 === 0;
      b.set(x, y, brass(x, y, 0.5 - nx * 0.08 + (hatch ? 0.12 : -0.08) - (y - 2) * 0.06));
      continue;
    }
    const w = [3.6, 3.4, 3.0, 2.2, 1.2][y - 5];
    if (Math.abs(nx) > w) continue;
    b.set(x, y, brass(x, y, 0.78 - nx * 0.14 - (y - 5) * 0.08));
  }
  // shoulder finials: brass balls on little plinths
  for (const fx of [16, 96]) {
    for (let y = BODY.y0 - 5; y < BODY.y0 - 2; y++) for (let x = fx - 2; x < fx + 2; x++) b.set(x, y, wood(x, y, 0.6 - (x - fx) * 0.08 - (y - BODY.y0 + 5) * 0.1, 'h', 12));
    for (let y = BODY.y0 - 11; y < BODY.y0 - 5; y++) for (let x = fx - 3; x < fx + 3; x++) {
      const d = dist(x, y, fx, BODY.y0 - 8);
      if (d > 3) continue;
      const nx = (x + 0.5 - fx) / 3, ny = (y + 0.5 - (BODY.y0 - 8)) / 3;
      b.set(x, y, brass(x, y, 0.55 - nx * 0.3 - ny * 0.35 + (nx < -0.2 && ny < -0.2 ? 0.25 : 0)));
    }
    b.set(fx, BODY.y0 - 12, BRASS[5]);
  }
  return b;
}

// ------------------------------------------------------------------ the dial plate: brass arch with the moon window, spandrels, enamel dial

const LACQ = [shadow(C('forest'), 0.6), C('forest'), mix(C('forest'), C('pine'), 0.5), C('pine'), mix(C('pine'), C('leaf'), 0.45), C('leaf')];
function paintPlate(b) {
  for (let y = 0; y < PLATE.y1; y++) for (let x = PLATE.x0; x < PLATE.x1; x++) {
    if (!inPlate(x, y)) continue;
    const dArch = y < PLATE.y0 ? PLATE.r - dist(x, y, CX, PLATE.y0) : 99;
    const edge = Math.min(x - PLATE.x0, PLATE.x1 - 1 - x, PLATE.y1 - 1 - y, dArch);
    // a deep moss-green lacquered plate, hand painted: soft brush strokes, warmer where the lamp falls
    const stroke = fbm(x * 0.11 + y * 0.03, y * 0.22, 51) - 0.5;
    let t = 0.5 + lit(x, y) * 2.2 + stroke * 0.45 - Math.max(0, dist(x, y, CX, DY) - 44) * 0.012;
    if (edge < 1) { b.set(x, y, x < CX && y < DY ? BRASS[6] : BRASS[2]); continue; }  // gilt border bead
    if (edge < 2) { b.set(x, y, BRASS[4]); continue; }
    if (edge < 3) t = 0.08;                                                          // a shadow line inside it
    // rubbed wear at the edges shows a little brass ground
    if (edge < 5 && hash(x, y, 33) > 0.93) { b.set(x, y, BRASS[3]); continue; }
    b.set(x, y, pick(LACQ, clamp(t, 0, 1), x, y, 1));
  }
  // gold-leaf vine scroll painted in the arch around the moon window, with leaves and tiny stars
  for (let y = 18; y < PLATE.y0; y++) for (let x = PLATE.x0; x < PLATE.x1; x++) {
    if (!inPlate(x, y)) continue;
    const d = dist(x, y, CX, PLATE.y0);
    if (d < MOONW.r + 2 || d > PLATE.r - 3.5) continue;
    const a = Math.atan2(y + 0.5 - PLATE.y0, x + 0.5 - CX);
    const rr = 24.5 + Math.sin(a * 8) * 3.0, off = d - rr;
    if (Math.abs(off) < 0.6) b.set(x, y, x < CX ? BRASS[6] : BRASS[4]);
    else if (Math.sin(a * 8) > 0.55 && off > 0.6 && off < 2.6 && Math.cos(a * 8) * (x < CX ? 1 : -1) > -0.2) b.set(x, y, off < 1.6 ? BRASS[5] : BRASS[3]);
    else if (Math.sin(a * 8) < -0.55 && off < -0.6 && off > -2.6) b.set(x, y, off > -1.6 ? BRASS[5] : BRASS[3]);
  }
  for (const [sx, sy] of [[29, 45], [83, 45], [33, 34], [79, 34], [42, 25], [70, 25], [56, 21]]) { b.set(sx, sy, C('lamp')); b.set(sx - 1, sy, BRASS[4]); b.set(sx + 1, sy, BRASS[4]); b.set(sx, sy - 1, BRASS[4]); b.set(sx, sy + 1, BRASS[4]); }
  // moon window rim and the two painted hills (the humps)
  for (let y = 30; y < PLATE.y0 + 1; y++) for (let x = 36; x < 76; x++) {
    const d = dist(x, y, MOONW.cx, MOONW.cy);
    if (y < MOONW.cy && d >= MOONW.r && d < MOONW.r + 1.3) b.set(x, y, x < CX ? BRASS[7] : BRASS[2]);
    for (const hx of [48.5, 63.5]) {
      const dh = dist(x, y, hx, 52.5);
      if (y < 52 && dh < 7.6 && dist(x, y, MOONW.cx, MOONW.cy) < MOONW.r) {
        // a mossy hill with tiny pines, lit from the left
        const nx = (x + 0.5 - hx) / 7.6, ny = (y + 0.5 - 52.5) / 7.6;
        let c = pick(MOSS, clamp(0.55 - nx * 0.35 - ny * 0.15 + (hash(x, y, 8) - 0.5) * 0.25, 0, 1), x, y, 0.9);
        if (dh > 6.8) c = MOSS[0];
        b.set(x, y, c);
      }
    }
  }
  for (const [tx, ty, hgt] of [[45, 47, 4], [50, 46, 5], [61, 47, 4], [66, 46, 5], [53, 49, 3]]) {
    for (let k = 0; k < hgt; k++) for (let j = -Math.floor(k / 2); j <= Math.floor(k / 2); j++) b.set(tx + j, ty + k, k === hgt - 1 && j === 0 ? C('bark') : j < 0 ? MOSS[2] : MOSS[1]);
  }
  // cast spandrels in the four corners: three acanthus leaves fanning from a curl, in relief
  for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ox = qx < 0 ? PLATE.x0 + 3 : PLATE.x1 - 3, oy = qy < 0 ? PLATE.y0 + 2 : PLATE.y1 - 3;
    const dir = (deg) => Math.atan2(-qy * Math.sin((deg * Math.PI) / 180), -qx * Math.cos((deg * Math.PI) / 180));
    const leaves = [leafMask(ox, oy, dir(14), 17, 2.6), leafMask(ox, oy, dir(45), 15, 3.4), leafMask(ox, oy, dir(76), 17, 2.6)];
    const curl = (x, y) => { const d = dist(x, y, ox - qx * 2.5, oy - qy * 2.5); return d < 3.2 && !(d < 1.3); };
    const mask = (x, y) => dist(x, y, CX, DY) > R_BEZ + 0.8 && inPlate(x, y) && (curl(x, y) || leaves.some((m) => m(x, y)));
    emboss(b, mask, Math.min(ox, ox - qx * 18) - 1, Math.min(oy, oy - qy * 18) - 1, 21, 21, (x, y, t) => brass(x, y, t + 0.06), 0.56);
    // midribs
    for (const deg of [14, 45, 76]) { const a = dir(deg); for (let u = 3; u < 13; u++) { const x = Math.floor(ox + 0.5 + Math.cos(a) * u), y = Math.floor(oy + 0.5 + Math.sin(a) * u); if (mask(x, y)) b.set(x, y, BRASS[2]); } }
  }
  // the enamel dial
  for (let y = DY - R_DIAL - 1; y < DY + R_DIAL + 1; y++) for (let x = CX - R_DIAL - 1; x < CX + R_DIAL + 1; x++) {
    const d = dist(x, y, CX, DY);
    if (d >= R_DIAL) continue;
    const nx = (x + 0.5 - CX) / R_DIAL, ny = (y + 0.5 - DY) / R_DIAL;
    // a slightly domed enamel: brighter in the middle and top-left, cooler at the bottom-right rim
    let t = 0.74 - (nx * 0.18 + ny * 0.22) - Math.max(0, d / R_DIAL - 0.82) * 1.1;
    // crazing: a fine network of hairline cracks in the old enamel
    const cr = Math.abs(vnoise(x * 0.32, y * 0.32, 41) - 0.5);
    if (cr < 0.018 && hash(x, y, 2) > 0.3) t -= 0.22;
    // foxing: a few warm age spots
    if (fbm(x * 0.2, y * 0.2, 44) > 0.72) t -= 0.12;
    b.set(x, y, pick(ENAMEL, clamp(t, 0, 1), x, y, 0.8));
  }
  // chapter ring: two hairlines with minute ticks between and bold five-minute marks
  const ink = INK, ink2 = mix(INK2, C('linen'), 0.25);
  for (let y = DY - R_DIAL; y < DY + R_DIAL; y++) for (let x = CX - R_DIAL; x < CX + R_DIAL; x++) {
    const d = dist(x, y, CX, DY);
    if (d >= 29.0 && d < 29.9) b.set(x, y, ink2);
    if (d >= 24.4 && d < 25.3) b.set(x, y, ink2);
  }
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2 - Math.PI / 2, five = m % 5 === 0;
    for (let r = five ? 25.4 : 26.6; r < 29; r += 0.35) b.set(Math.floor(CX + Math.cos(a) * r), Math.floor(DY + Math.sin(a) * r), five ? ink : ink2);
    if (five) for (let r = 26; r < 28.6; r += 0.4) { const p = a + 0.035 * (r > 27 ? 1 : 0); b.set(Math.floor(CX + Math.cos(p) * r), Math.floor(DY + Math.sin(p) * r), ink); }
  }
  // roman numerals (IIII, as old clocks write it), upright, centred on a circle
  const G = { I: ['#', '#', '#', '#', '#'], V: ['#.#', '#.#', '#.#', '#.#', '.#.'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'] };
  const NUM = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  NUM.forEach((s, h) => {
    const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
    const glyphs = [...s].map((c) => G[c]);
    const w = glyphs.reduce((acc, g) => acc + g[0].length, 0) + glyphs.length - 1;
    const r = 19.6 + Math.abs(Math.cos(a)) * 0.9;
    const x0 = Math.round(CX + Math.cos(a) * r - w / 2), y0 = Math.round(DY + Math.sin(a) * r - 2.5);
    let xx = x0;
    for (const g of glyphs) {
      g.forEach((row, yy) => [...row].forEach((ch, k) => { if (ch === '#') { b.set(xx + k, y0 + yy, ink); if (yy === 0 || yy === 4) { if (g === G.I) { b.set(xx + k - 1, y0 + yy, mix(ink, C('linen'), 0.45)); b.set(xx + k + 1, y0 + yy, mix(ink, C('linen'), 0.45)); } } } }));
      xx += g[0].length + 1;
    }
  });
  // winding holes at 4 and 8 o'clock, with brass collars and a glint of the arbor
  for (const sx of [-1, 1]) {
    const hx = Math.round(CX + sx * 11) - (sx < 0 ? 1 : 0), hy = DY + 7;
    for (let y = hy - 2; y < hy + 2; y++) for (let x = hx - 2; x < hx + 2; x++) {
      const e = x === hx - 2 || x === hx + 1 || y === hy - 2 || y === hy + 1;
      const corner = (x === hx - 2 || x === hx + 1) && (y === hy - 2 || y === hy + 1);
      if (corner) continue;
      b.set(x, y, e ? (y === hy - 2 || x === hx - 2 ? BRASS[6] : BRASS[2]) : C('deepNight'));
    }
    b.set(hx - 1, hy - 1, C('iron')); b.set(hx, hy, C('night'));
  }
  // maker's punch marks on the plate below the dial: three tiny stars
  for (const sx of [-6, 0, 6]) { const x = CX + sx, y = PLATE.y1 - 6; b.set(x, y, BRASS[1]); b.set(x - 1, y, BRASS[3]); b.set(x + 1, y, BRASS[3]); b.set(x, y - 1, BRASS[3]); }
}

// ------------------------------------------------------------------ lower panel: carved vines around the pendulum window

function paintWindowAndCarving(b) {
  // carved vines with leaves and acorns on both sides of the window, in relief
  for (const side of [-1, 1]) {
    const xs = side < 0 ? 23 : 70, xe = side < 0 ? 42 : 89;
    const stemY = (x) => 139 + Math.sin((side < 0 ? x - xs : xe - x) * 0.42) * 3.2;
    const parts = [(x, y) => x >= xs && x < xe && Math.abs(y + 0.5 - stemY(x)) < 1.0];
    for (let i = 0; i < 4; i++) {
      const lx = side < 0 ? xs + 2 + i * 5 : xe - 3 - i * 5, ly = stemY(lx), up = i % 2 === 0;
      parts.push(leafMask(lx, ly, (up ? -1 : 1) * (Math.PI / 2 - 0.5) + (side < 0 ? 0 : (up ? -1 : 1) * 1.0) + (side < 0 ? 0 : 0), 7, 2.2));
    }
    const ax = side < 0 ? xe - 3 : xs + 2, ay = stemY(ax) + 3;
    parts.push((x, y) => dist(x, y, ax, ay + 1.5) < 2.1 || (Math.abs(x + 0.5 - ax) < 2.6 && y >= ay - 1 && y < ay + 1));
    emboss(b, (x, y) => parts.some((m) => m(x, y)), xs - 2, 128, xe - xs + 4, 20, (x, y, t) => wood(x, y, t, 'v', 13), 0.5);
  }
  // the window: brass frame, the dark inside of the case and the pendulum's suspension
  for (let y = WIN.y0 - 2; y < WIN.y1 + 2; y++) for (let x = WIN.x0 - 2; x < WIN.x1 + 2; x++) {
    const inside = inWin(x, y);
    const near = !inside && (inWin(x + 1, y) || inWin(x - 1, y) || inWin(x, y + 1) || inWin(x, y - 1) || inWin(x + 2, y) || inWin(x - 2, y) || inWin(x, y + 2) || inWin(x, y - 2));
    if (inside) {
      // the inside of the case: deep shadow, the back board's grain catching a little light
      const t = 0.12 + (y - WIN.y0) / 20 * 0.1 + (hash(x >> 1, y, 3) - 0.5) * 0.1;
      b.set(x, y, pick(WOOD, clamp(t, 0, 0.4), x, y));
    } else if (near) {
      const lt = (x < CX ? 0.2 : -0.15) + (y < WIN.cy ? 0.15 : -0.1);
      const ring = inWin(x + 1, y) || inWin(x - 1, y) || inWin(x, y + 1) || inWin(x, y - 1);
      b.set(x, y, brass(x, y, (ring ? 0.42 : 0.66) + lt));
    }
  }
  // beat plate and a brass crutch slot visible at the top of the window
  for (let x = CX - 4; x < CX + 4; x++) b.set(x, WIN.y0 + 2, x === CX - 4 || x === CX + 3 ? BRASS[2] : BRASS[4]);
  for (let k = -3; k <= 3; k += 3) b.set(CX + k, WIN.y0 + 3, BRASS[1]);
}

// ------------------------------------------------------------------ moving parts

/** rasterise a hand polygon (hand space: +y from centre to tip) at an angle, coverage by centre sample */
function handFrame(shape, ang, size) {
  const b = new Buf(size, size), c = size / 2;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const minY = shape.reduce((m, p) => Math.min(m, p.poly ? Math.min(...p.poly.map((q) => q[1])) : -99), 99);
  void minY;
  for (const part of shape) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // pixel centre into hand space: hand points to 12 at ang 0 (up is -y on screen)
    const px = x + 0.5 - c, py = y + 0.5 - c;
    const hx = px * ca + py * sa, hy = -(-px * sa + py * ca); // hy along the hand towards the tip
    if (part.poly ? inPoly(hx, hy, part.poly) : Math.hypot(hx - part.cx, hy - part.cy) < part.r) {
      const lit = part.lit ? part.lit(hx, hy, ang) : 0.5;
      b.set(x, y, typeof part.col === 'function' ? part.col(lit, x, y) : part.col);
    }
  }
  return b;
}
function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** 1px outline around opaque pixels */
function outline(b, col, onlyBelow = false) {
  const o = new Buf(b.w, b.h); o.d.set(b.d);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (b.a(x, y)) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.a(x + dx, y + dy) > 200);
    if (n && (!onlyBelow || b.a(x, y - 1) > 200 || b.a(x - 1, y) > 200)) o.set(x, y, col);
  }
  return o;
}
/** steel colour from a lit value: highlight on the edge facing the lamp */
const steel = (t, x, y) => pick(STEEL, clamp(t, 0, 1), x, y, 0.6);
const sideLit = (hx, hy, ang) => {
  // the edge of the hand facing up-left catches the light
  const nx = Math.cos(ang), ny = Math.sin(ang); // hand-space +x direction on screen
  const face = -(nx * 0.7 + ny * 0.7);
  return 0.42 + (hx > 0.1 ? face : hx < -0.1 ? -face : 0) * 0.32;
};
const HOUR = [
  { poly: [[-1.1, -4], [1.1, -4], [1.1, 9], [-1.1, 9]], col: steel, lit: sideLit },                                    // shaft and tail
  { poly: [[0, 7.5], [3.4, 10.5], [3.2, 13.5], [0.9, 15.2], [1.0, 17.8], [0, 20.5], [-1.0, 17.8], [-0.9, 15.2], [-3.2, 13.5], [-3.4, 10.5]], col: steel, lit: sideLit }, // the spade
  { poly: [[-2.3, -6.4], [2.3, -6.4], [1.4, -3.4], [-1.4, -3.4]], col: steel, lit: sideLit },                            // tail boss
];
const MINUTE = [
  { poly: [[-0.95, -6], [0.95, -6], [0.75, 22], [-0.75, 22]], col: steel, lit: sideLit },
  { poly: [[0, 18.5], [2.2, 22], [0, 30.2], [-2.2, 22]], col: steel, lit: sideLit },                                    // the leaf tip
  { poly: [[-2, -8.2], [2, -8.2], [1.2, -5], [-1.2, -5]], col: steel, lit: sideLit },
];
const SECOND = [
  { poly: [[-0.5, -9], [0.5, -9], [0.5, 30.5], [-0.5, 30.5]], col: C('clay') },
  { poly: [[-1.6, -11.5], [1.6, -11.5], [1.6, -7.5], [-1.6, -7.5]], col: C('clay') },                                    // counterweight
];
const FR = 72, FN = 60;
function handStrip(shape, outlineCol) {
  const strip = new Buf(FR * FN, FR);
  for (let i = 0; i < FN; i++) {
    let f = handFrame(shape, (i / FN) * Math.PI * 2, FR);
    if (outlineCol) f = outline(f, outlineCol);
    strip.blit(f, i * FR, 0);
  }
  return strip;
}

/** the pendulum, clipped to the window: cosine-spaced angles so uniform CSS steps give a natural swing */
const PEND_N = 9, PEND_A = 0.16;
function pendulumStrip() {
  const fw = WIN.x1 - WIN.x0, fh = WIN.y1 - WIN.y0;
  const strip = new Buf(fw * PEND_N, fh);
  for (let j = 0; j < PEND_N; j++) {
    const a = PEND_A * Math.cos((Math.PI * j) / (PEND_N - 1));
    const f = new Buf(fw, fh);
    const bx = PIVOT.x + Math.sin(a) * PEND_LEN, by = PIVOT.y + Math.cos(a) * PEND_LEN;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const X = x + WIN.x0, Y = y + WIN.y0;
      if (!inWin(X, Y)) continue;
      // rod: distance to the segment pivot -> bob
      const t = clamp(((X + 0.5 - PIVOT.x) * (bx - PIVOT.x) + (Y + 0.5 - PIVOT.y) * (by - PIVOT.y)) / (PEND_LEN * PEND_LEN), 0, 1);
      const qx = PIVOT.x + (bx - PIVOT.x) * t, qy = PIVOT.y + (by - PIVOT.y) * t;
      const dr = Math.hypot(X + 0.5 - qx, Y + 0.5 - qy);
      const db = dist(X, Y, bx, by);
      if (db < PEND_R) {
        const nx = (X + 0.5 - bx) / PEND_R, ny = (Y + 0.5 - by) / PEND_R;
        let tt = 0.55 - nx * 0.3 - ny * 0.35;
        if (db > PEND_R - 1) tt -= 0.2;
        if (Math.abs(db - 2.6) < 0.5) tt -= 0.18;          // engraved ring
        if (nx < -0.1 && nx > -0.6 && ny < -0.1 && ny > -0.6) tt += 0.3; // glint
        f.set(x, y, brass(X, Y, tt));
      } else if (dr < 0.75 && t < 0.98) f.set(x, y, (X + Y) % 3 ? BRASS[4] : BRASS[6]);
    }
    strip.blit(f, j * fw, 0);
  }
  return { url: strip.url(), w: fw, h: fh };
}

/** the sky behind the moon window, with the moon at N heights (it rises as the app loads) */
const MOON_N = 18;
function moonStrip() {
  const x0 = MOONW.cx - MOONW.r, y0 = MOONW.cy - MOONW.r, fw = MOONW.r * 2, fh = MOONW.r;
  const strip = new Buf(fw * MOON_N, fh);
  const SKY = [C('deepNight'), C('night'), mix(C('night'), C('slate'), 0.5), C('slate'), C('dusk')];
  const MOONR = [C('straw'), C('linen'), C('oat'), C('paper'), C('snow')];
  for (let j = 0; j < MOON_N; j++) {
    const k = j / (MOON_N - 1);
    const mx = MOONW.cx - 2 + k * 4, my = MOONW.cy + 6 - k * 14; // from behind the hills up to the top
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const X = x + x0, Y = y + y0;
      if (!inMoonWin(X, Y)) continue;
      let c = pick(SKY, clamp(0.15 + (y / fh) * 0.65 + k * 0.15, 0, 1), X, Y, 1);
      if (hash(X, Y, 71) > 0.94 && y < fh - 4) c = hash(X, Y, 72) > 0.5 ? C('lamp') : C('frost');
      const d = dist(X, Y, mx, my);
      if (d < 4.6) {
        const nx = (X + 0.5 - mx) / 4.6, ny = (Y + 0.5 - my) / 4.6;
        c = pick(MOONR, clamp(0.7 - nx * 0.35 - ny * 0.3, 0, 1), X, Y, 0.8);
        if (Math.hypot(nx - 0.25, ny + 0.1) < 0.28 || Math.hypot(nx + 0.3, ny - 0.35) < 0.2) c = MOONR[1];
      } else if (d < 5.8 && bayer(X, Y) < 0.35) c = mix(c, C('lamp'), 0.35);
      strip.set(j * fw + x, y, c);
    }
  }
  return { url: strip.url(), w: fw, h: fh, x0, y0 };
}

/** the glass door: the bevelled brass bezel with beads, a hinge and a latch, and the glass highlights */
function door() {
  const S = R_BEZ * 2 + 6, c = S / 2, b = new Buf(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const d = dist(x, y, c, c);
    const ang = Math.atan2(y + 0.5 - c, x + 0.5 - c);
    const facing = -Math.cos(ang + Math.PI * 0.75); // +1 facing the top-left light
    if (d >= R_DIAL - 0.3 && d < R_BEZ) {
      const ring = d - (R_DIAL - 0.3); // 0 inner .. 4.3 outer
      let t;
      if (ring < 1) t = 0.3 - facing * 0.15;             // inner bevel, in shadow on the lit side
      else if (ring < 2.2) t = 0.6 + facing * 0.28;      // the rounded bead
      else if (ring < 3) t = 0.32 + facing * 0.12;       // groove
      else t = 0.5 + facing * 0.3;                       // outer chamfer
      // beads every few degrees on the bead ring
      const beads = ring >= 1 && ring < 2.2 && Math.sin(ang * 36) > 0.65;
      if (beads) t += 0.18;
      b.set(x, y, brass(x, y, t));
    } else if (d < R_DIAL - 0.3) {
      // glass: two highlight streaks across the top-left, a faint sheen at the bottom-right rim
      const u = (x - c) + (y - c); // diagonal coordinate
      if (u > -27 && u < -24 && d < R_DIAL - 2) b.set(x, y, C('snow'), 110);
      else if (u > -21 && u < -20 && d < R_DIAL - 3) b.set(x, y, C('snow'), 70);
      else if (d > R_DIAL - 2.2 && facing < -0.6) b.set(x, y, C('frost'), 55);
    }
  }
  // hinge knuckles at 9 o'clock and a latch knob at 3 o'clock
  for (const ky of [c - 9, c + 6]) for (let y = ky; y < ky + 4; y++) for (let x = 0; x < 3; x++) b.set(x, y, brass(x, y, 0.75 - x * 0.18 - (y - ky) * 0.08));
  for (let y = c - 2; y < c + 2; y++) for (let x = S - 4; x < S; x++) b.set(x, y, brass(x, y, 0.7 - (x - S + 4) * 0.15 - (y - c + 2) * 0.1));
  return { url: b.url(), S };
}

/** glass over the pendulum window: two pixel streaks of reflected lamplight */
function winGlass() {
  const fw = WIN.x1 - WIN.x0, fh = WIN.y1 - WIN.y0, b = new Buf(fw, fh);
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
    if (!inWin(x + WIN.x0, y + WIN.y0)) continue;
    const u = x + y;
    if (u >= 7 && u <= 9) b.set(x, y, C('snow'), 46);
    else if (u === 12) b.set(x, y, C('snow'), 30);
    else if (u >= 33 && u <= 34) b.set(x, y, C('lamp'), 26);
  }
  return b.url();
}

/** the brass centre boss over the hands */
function boss() {
  const b = new Buf(6, 6);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const d = dist(x, y, 3, 3);
    if (d > 2.9) continue;
    b.set(x, y, d < 1.2 ? C('clay') : brass(x, y, 0.6 - (x - 2.5) * 0.12 - (y - 2.5) * 0.12));
  }
  return b.url();
}

/** a tiny pixel hand pointer (2 frames: up, pressed) for "tap the clock" */
function pointer() {
  const rows = [
    '..##........',
    '.#oo#.......',
    '.#oo#.......',
    '.#oo###.....',
    '.#oo#oo##...',
    '.#oo#oo#o#..',
    '##oooooooo#.',
    '#o#ooooooo#.',
    '#ooooooooo#.',
    '.#oooooooo#.',
    '..#ooooooo#.',
    '...#ssssss#.',
    '...########.',
  ];
  const fw = 14, fh = 16, b = new Buf(fw * 2, fh);
  for (let f = 0; f < 2; f++) {
    const oy = f ? 2 : 0, ox = f ? 1 : 0;
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const c = ch === '#' ? INK : ch === 'o' ? (x < 4 ? C('snow') : x > 8 || y > 8 ? C('linen') : C('paper')) : ch === 's' ? C('straw') : null;
      if (c) b.set(f * fw + ox + x + 1, oy + y + 1, c);
    }));
    if (f) for (const [dx, dy] of [[0, 0], [-2, 1], [4, -1]]) b.set(f * fw + 2 + dx, 1 + dy, C('lamp'));
  }
  return { url: b.url(), fw, fh };
}

/** 4-point pixel sparkle */
function sparkle() {
  const b = new Buf(7, 7);
  for (let k = -3; k <= 3; k++) { b.set(3 + k, 3, Math.abs(k) < 2 ? C('snow') : C('lamp')); b.set(3, 3 + k, Math.abs(k) < 2 ? C('snow') : C('lamp')); }
  return b.url();
}

// ------------------------------------------------------------------ the wall behind: a calm painted night, and a pool of lamplight

function wallTile() {
  const N = 96, b = new Buf(N, N);
  const RAMPW = [mix(C('deepNight'), C('forest'), 0.12), mix(C('deepNight'), C('night'), 0.5), C('night'), mix(C('night'), C('slate'), 0.3), mix(C('night'), C('slate'), 0.55)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // tileable noise: wrap coordinates on a torus
    const tx = (x / N) * Math.PI * 2, ty = (y / N) * Math.PI * 2;
    const n1 = vnoise(3 + Math.cos(tx) * 2.2, 3 + Math.sin(tx) * 2.2 + Math.cos(ty) * 1.4, 5);
    const n2 = vnoise(9 + Math.cos(ty) * 3.5, 9 + Math.sin(ty) * 3.5 + Math.sin(tx) * 1.2, 6);
    // brush strokes: soft horizontal-ish streaks
    const stroke = Math.sin(y * 0.38 + n1 * 6) * 0.5 + 0.5;
    let t = 0.42 + (n1 - 0.5) * 0.5 + (n2 - 0.5) * 0.3 + (stroke - 0.5) * 0.12;
    b.set(x, y, pick(RAMPW, clamp(t, 0, 1), x, y, 1.1));
  }
  // a faint leafy damask: tiny sprigs on a diamond lattice
  const sprig = [[0, 0], [0, -1], [0, -2], [-1, -2], [1, -3], [-1, 0], [1, -1]];
  for (const [ox, oy] of [[24, 24], [72, 72], [72, 24], [24, 72]]) for (const [dx, dy] of sprig) b.set(ox + dx, oy + dy, mix(C('night'), C('slate'), 0.7));
  for (const [ox, oy] of [[48, 48], [0, 48], [48, 0], [0, 0]]) { b.set(ox, oy, mix(C('night'), C('dusk'), 0.35)); b.set((ox + 1) % N, oy, mix(C('night'), C('slate'), 0.5)); }
  return { url: b.url(), N };
}

/** A pool of warm lamplight behind the clock, in hard stepped bands with ordered dither between them. */
function lampPool() {
  const w = 200, h = 240, b = new Buf(w, h), cx = w / 2, cy = h * 0.47;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - cx) / (w / 2), ny = (y + 0.5 - cy) / (h / 2), d = Math.sqrt(nx * nx + ny * ny);
    if (d >= 1) continue;
    const lv = (1 - d) * 5.4, band = Math.floor(lv), frac = lv - band;
    const k = band + (frac > bayer(x, y) * 1.0 + 0.0 && frac > 0.72 ? 1 : 0);
    if (k <= 0) continue;
    b.set(x, y, mix(C('honey'), C('lamp'), 0.45), Math.min(5, k) * 12);
  }
  return { url: b.url(), w, h };
}

// ------------------------------------------------------------------ assemble

const caseB = paintCase();
paintPlate(caseB);
paintWindowAndCarving(caseB);
// punch the moon window (the sky strip shows through from behind)
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inMoonWin(x, y)) caseB.clear(x, y);
// the case outline (not around the ground shadow)
const caseOut = (() => {
  const o = new Buf(W, H); o.d.set(caseB.d);
  for (let y = 0; y < 168; y++) for (let x = 0; x < W; x++) {
    if (caseB.a(x, y) || inMoonWin(x, y)) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => caseB.a(x + dx, y + dy) > 200 && !inMoonWin(x + dx, y + dy) && y + dy < 168);
    if (n) o.set(x, y, OUT);
  }
  return o;
})();

const hourS = handStrip(HOUR, mix(INK, C('deepNight'), 0.3)), minS = handStrip(MINUTE, mix(INK, C('deepNight'), 0.3)), secS = handStrip(SECOND, null);
const pend = pendulumStrip(), moon = moonStrip(), dr = door(), ptr = pointer(), wall = wallTile(), pool = lampPool();
const HO = { x: CX - FR / 2, y: DY - FR / 2 }; // hand frame offset in the clock

// ---- progress timing: the minute hand sweeps 0..~55 of 60 while loading (fast at first, then a crawl)
const LOAD_S = 26;                            // the whole fake-progress animation
const prog = (t) => { const a = Math.min(1, t / 7); return 0.9 * (1 - (1 - a) ** 2.4) + 0.07 * Math.max(0, (t - 7) / (LOAD_S - 7)); };
const invProg = (p) => { let lo = 0, hi = LOAD_S; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (prog(m) < p) lo = m; else hi = m; } return hi; };
/** keyframes stepping through frames `from..to` (inclusive) as the progress goes 0..max */
function progFrames(name, frames, fw, axis = 'x') {
  const out = [];
  const n = frames.length;
  for (let i = 0; i < n; i++) {
    const p = (i / (n - 1)) * prog(LOAD_S);
    const pct = i === 0 ? 0 : (invProg(p) / LOAD_S) * 100;
    out.push(`${pct.toFixed(2)}%{background-position:${axis === 'x' ? `-${frames[i] * fw}em 0` : `0 -${frames[i] * fw}em`}}`);
  }
  return `@keyframes ${name}{${out.join('')}}`;
}
const minFrames = Array.from({ length: Math.round(60 * prog(LOAD_S)) + 1 }, (_, i) => i);   // 0..58
const hourFrames = Array.from({ length: 5 }, (_, i) => 55 + i);                              // 11 o'clock creeping up
const moonFrames = Array.from({ length: MOON_N - 2 }, (_, i) => i);                          // rises most of the way

const CSS = `
#boot{--k:min(calc(88vw / ${W}),calc(66vh / ${H}));font-size:var(--k);position:fixed;inset:0;z-index:99;overflow:hidden;display:flex;align-items:center;justify-content:center;
background:${css(C('night'))} url(${wall.url}) 50% 50%/${wall.N}em ${wall.N}em repeat;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .7s steps(6)}
@supports (width:round(nearest,1px,1px)){#boot{--k:max(1px,min(round(nearest,min(calc(88vw / ${W}),calc(66vh / ${H})),1px),round(down,min(calc(98vw / ${W}),calc(90vh / ${H})),1px)))}}
#boot.gone:not(.hold):not(.js){opacity:0;pointer-events:none}
#boot *{position:absolute;display:block;image-rendering:pixelated;image-rendering:crisp-edges;-webkit-user-drag:none;pointer-events:none}
#boot .bt-pool{width:${pool.w}em;height:${pool.h}em;left:50%;top:50%;margin:-${(pool.h * 0.47 + 6).toFixed(1)}em 0 0 -${pool.w / 2}em;background:url(${pool.url}) 0 0/100% 100%;animation:bt-flick 3.2s steps(1) infinite}
#boot .bt-mote{width:1em;height:1em;background:${css(C('lamp'))};opacity:0;animation:bt-mote 9s steps(36) infinite}
#boot .bt-stage{position:relative;width:${W}em;height:${H}em;flex:none;margin-top:-4em;transform-origin:50% ${((DY / H) * 100).toFixed(3)}%}
#boot .bt-clock{inset:0;transform-origin:50% 93%}
#boot .bt-moon{left:${moon.x0}em;top:${moon.y0}em;width:${moon.w}em;height:${moon.h}em;background:url(${moon.url}) 0 0/${moon.w * MOON_N}em ${moon.h}em;animation:bt-moon ${LOAD_S}s steps(1,end) forwards}
#boot .bt-case{left:0;top:0;width:${W}em;height:${H}em}
#boot .bt-pend{left:${WIN.x0}em;top:${WIN.y0}em;width:${pend.w}em;height:${pend.h}em;background:url(${pend.url}) 0 0/${pend.w * PEND_N}em ${pend.h}em;animation:bt-pend .5s steps(${PEND_N - 1},jump-none) infinite alternate}
#boot .bt-wglass{left:${WIN.x0}em;top:${WIN.y0}em;width:${WIN.x1 - WIN.x0}em;height:${WIN.y1 - WIN.y0}em;background:url(${winGlass()}) 0 0/100% 100%}
#boot .bt-h{left:${HO.x}em;top:${HO.y}em;width:${FR}em;height:${FR}em;background-size:${FR * FN}em ${FR}em}
#boot .bt-hh{background-image:url(${hourS.url()});background-position:-${55 * FR}em 0;animation:bt-hh ${LOAD_S}s steps(1,end) forwards}
#boot .bt-mh{background-image:url(${minS.url()});animation:bt-mh ${LOAD_S}s steps(1,end) forwards}
#boot .bt-sh{background-image:url(${secS.url()});animation:bt-sh 30s steps(60) infinite}
#boot .bt-boss{left:${CX - 3}em;top:${DY - 3}em;width:6em;height:6em}
#boot .bt-door{left:${CX - dr.S / 2}em;top:${DY - dr.S / 2}em;width:${dr.S}em;height:${dr.S}em;transform-origin:1.5em 50%}
#boot .bt-tap{left:${CX + 22}em;top:${DY + 20}em;width:${ptr.fw}em;height:${ptr.fh}em;background:url(${ptr.url}) 0 0/${ptr.fw * 2}em ${ptr.fh}em;opacity:0}
#boot .bt-spark{width:7em;height:7em;opacity:0}
#boot.ready{cursor:pointer}
#boot.ready *{pointer-events:none}
#boot.ready .bt-tap{opacity:1;animation:bt-tap 1s steps(1) infinite}
#boot.ready .bt-clock{animation:bt-invite 2.4s steps(1) infinite}
#boot.done .bt-clock{animation:bt-chime .9s steps(1)}
#boot.done.ready .bt-clock{animation:bt-chime .9s steps(1),bt-invite 2.4s steps(1) .9s infinite}
#boot.done .bt-spark{animation:bt-spark .8s steps(4) forwards}
#boot.open .bt-door{animation:bt-door .46s steps(7) forwards}
#boot.open .bt-tap{opacity:0;animation:none}
@keyframes bt-flick{0%,100%{opacity:1}31%{opacity:.9}36%{opacity:1}70%{opacity:.94}}
@keyframes bt-mote{0%{opacity:0;transform:translate(0,0)}15%{opacity:.7}50%{transform:translate(6em,-14em)}85%{opacity:.5}100%{opacity:0;transform:translate(2em,-28em)}}
@keyframes bt-sh{to{background-position:-${FN * FR}em 0}}
@keyframes bt-pend{to{background-position:-${(PEND_N - 1) * pend.w}em 0}}
${progFrames('bt-mh', minFrames, FR)}
${progFrames('bt-hh', hourFrames, FR)}
${progFrames('bt-moon', moonFrames, moon.w)}
@keyframes bt-tap{0%{background-position:0 0}50%{background-position:-${ptr.fw}em 0}}
@keyframes bt-invite{0%,100%{transform:none}84%{transform:translateY(-1em)}88%{transform:translateY(0)}92%{transform:translateY(-.5em)}96%{transform:none}}
@keyframes bt-chime{0%{transform:rotate(0)}10%{transform:rotate(-1.2deg)}22%{transform:rotate(1.1deg)}34%{transform:rotate(-.8deg)}46%{transform:rotate(.6deg)}58%{transform:rotate(-.3deg)}70%,100%{transform:none}}
@keyframes bt-spark{0%{opacity:1;transform:translate(0,0) scale(.4)}60%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1)}}
@keyframes bt-door{0%{transform:perspective(420em) rotateY(0)}100%{transform:perspective(420em) rotateY(-118deg)}}
@media (prefers-reduced-motion:reduce){#boot *{animation-duration:0s!important;animation-iteration-count:1!important}}
`.trim().replace(/\n+/g, '\n');

const motes = [[-44, 30, 0], [40, 10, -2.1], [-20, -30, -4.4], [52, -46, -6.2], [-58, -8, -1.3], [12, 52, -3.6], [30, -60, -7.7]];
const sparks = [[CX - 20, 18, -10, -12], [CX + 14, 14, 12, -14], [CX - 3, 2, -2, -16], [CX + 30, 34, 16, -6], [CX - 36, 36, -16, -6]];
const html = `<!-- boot:begin (generated by src/onboard/tools/bootart.mjs; edit the generator, not this block) -->
    <style>${CSS}</style>
    <div id="boot" role="progressbar" aria-label="Loading" data-art='${JSON.stringify({ fr: FR, fn: FN, mw: moon.w, mn: MOON_N, cx: CX, dy: DY, rd: R_DIAL })}'>
      <i class="bt-pool"></i>${motes.map(([x, y, d]) => `<i class="bt-mote" style="left:calc(50% + ${x}em);top:calc(50% + ${y}em);animation-delay:${d}s"></i>`).join('')}
      <div class="bt-stage"><div class="bt-clock">
        <i class="bt-moon"></i>
        <img class="bt-case" src="${caseOut.url()}" alt="" />
        <i class="bt-pend"></i><i class="bt-wglass"></i>
        <i class="bt-h bt-hh"></i><i class="bt-h bt-mh"></i><i class="bt-h bt-sh"></i>
        <img class="bt-boss" src="${boss()}" alt="" />
        <img class="bt-door" src="${dr.url}" alt="" />
        <i class="bt-tap"></i>
        ${sparks.map(([x, y, dx, dy]) => `<img class="bt-spark" style="left:${x}em;top:${y}em;--dx:${dx}em;--dy:${dy}em" src="${sparkle()}" alt="" />`).join('')}
      </div></div>
    </div>
    <!-- boot:end -->`;

const file = fileURLToPath(new URL('../../../index.html', import.meta.url));
const src = readFileSync(file, 'utf8');
const a = src.indexOf('<!-- boot:begin'), z = src.indexOf('<!-- boot:end -->');
if (a < 0 || z < 0) throw new Error('boot markers missing in index.html');
writeFileSync(file, src.slice(0, a) + html + src.slice(z + '<!-- boot:end -->'.length));
// a preview of the art pieces for checking by eye
if (process.argv.includes('--preview')) {
  const out = process.argv[process.argv.indexOf('--preview') + 1];
  const P = new Buf(W * 2 + 20, H);
  P.blit(caseOut, 0, 0);
  writeFileSync(out, P.png());
}
export const BOOT = { W, H, CX, DY, FR, FN, HO, R_DIAL, R_BEZ };
console.log('boot block written:', (html.length / 1024).toFixed(1), 'KB');
