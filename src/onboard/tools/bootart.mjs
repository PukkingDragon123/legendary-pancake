// Generates the loading screen (the `#boot` block in index.html) and the office clock's painting
// (public/models/interview/clock.png + src/onboard/clockart.gen.ts): one Regency bracket clock in polished
// flame mahogany on a carved wall bracket, alone on a dark emerald wall in a pool of lamplight. No text.
//
// The clock is painted as a 2.5D relief: every texel gets a material, a height and an albedo offset; a key
// light from the top left, a soft fill, cavity occlusion, polished highlights and (for brass and steel) a
// reflected environment shade it; the shade is then mapped onto hand-picked, hue-shifted ramps with ordered
// dither, so the result is crisp pixel art that reads as real walnut, cast brass, enamel and blued steel.
// Images are written as indexed PNGs (small enough to inline before any script loads).
//
// Moving parts are pre-drawn frames played with CSS steps(): 120 minute and hour hand angles, 60 for the
// seconds, a cosine-spaced pendulum swing and a moon disc that rises in the arch as the app loads.
// src/onboard/boot.ts takes over once the app is ready (the hands swing round to the real time, the clock
// chimes; a tap dives into the dial, where the 3D office's own clock takes over and the camera pulls back).
//
//   node src/onboard/tools/bootart.mjs [--preview out.png]
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ colour helpers

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
const css = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
/** a ramp through key colours, n steps */
function rampOf(keys, n) { const out = []; for (let i = 0; i < n; i++) { const f = (i / (n - 1)) * (keys.length - 1), k = Math.min(keys.length - 2, Math.floor(f)); out.push(mix(hex(keys[k]), hex(keys[k + 1]), f - k)); } return out; }

// hue-shifted ramps: shadows lean cool/purple, lights lean warm/gold
const R = {
  wood: rampOf([0x0e0408, 0x22090a, 0x3c120e, 0x561c12, 0x702816, 0x8c381c, 0xa84c26, 0xc66a36, 0xe8985a, 0xffd2a0], 14),
  woodDark: rampOf([0x0c0508, 0x1e0a0a, 0x34120e, 0x4c1c12, 0x642616, 0x80361e], 8),
  brass: rampOf([0x1a0e06, 0x3a2210, 0x6a4414, 0x9a6c1c, 0xc4942a, 0xe2b840, 0xf6d666, 0xfff0aa, 0xffffff], 14),
  enamel: rampOf([0x6e6252, 0x9a8a70, 0xc4b494, 0xdfd2b4, 0xefe6d0, 0xfaf5e8, 0xffffff], 10),
  steel: rampOf([0x06081a, 0x0e1634, 0x18265a, 0x263e84, 0x3a5cae, 0x6a8ed6, 0xb0ccf4, 0xf0f8ff], 10),
  ink: rampOf([0x0e0a08, 0x241c16, 0x4a3e32], 3),
  sky: rampOf([0x050a1e, 0x0c1638, 0x142456, 0x1e3676, 0x2c4c94, 0x4468b0], 8),
  moon: rampOf([0x6a5a38, 0xa8946a, 0xd8c896, 0xf4e8c0, 0xfffaf0], 7),
  moss: rampOf([0x0e2010, 0x1a3a1a, 0x28562a, 0x3c7438, 0x5a9446, 0x86b45a, 0xb8d47a], 9),
  dark: rampOf([0x050305, 0x0e0808, 0x1a100c, 0x2a1a12], 5),
  red: rampOf([0x3a0808, 0x6a1010, 0x9a1c18, 0xc83828, 0xf06a48], 6),
  patina: rampOf([0x0c140c, 0x1c2a16, 0x34401e, 0x4e5a2a, 0x6a7436, 0x8a8a44], 8),
};

// ------------------------------------------------------------------ noise

const hash = (x, y, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s = 0) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const pick = (ramp, t, x, y, d = 0.85) => ramp[clamp(Math.floor(t * (ramp.length - 1) + (bayer(x, y) - 0.5) * d + 0.5), 0, ramp.length - 1)];
const dist = (x, y, cx, cy) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy);

// ------------------------------------------------------------------ RGBA buffer + (indexed) PNG

class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.in(x, y) || !c) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a;
  }
  get(x, y) { if (!this.in(x, y)) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]] : null; }
  a(x, y) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  clear(x, y) { if (this.in(x, y)) this.d.fill(0, (y * this.w + x) * 4, (y * this.w + x) * 4 + 4); }
  blit(src, ox, oy) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.set(ox + x, oy + y, c, c[3]); } }
  png() {
    const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
    // indexed when the picture has 256 colours or fewer
    const pal = new Map();
    for (let i = 0; i < this.w * this.h && pal.size <= 256; i++) {
      const a = this.d[i * 4 + 3], key = a ? (this.d[i * 4] << 24 | this.d[i * 4 + 1] << 16 | this.d[i * 4 + 2] << 8 | a) >>> 0 : 0;
      if (!pal.has(key)) pal.set(key, pal.size);
    }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4); ihdr[8] = 8;
    let raw, extra = [];
    if (pal.size <= 256) {
      ihdr[9] = 3;
      raw = Buffer.alloc((this.w + 1) * this.h);
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4, a = this.d[i + 3], key = a ? (this.d[i] << 24 | this.d[i + 1] << 16 | this.d[i + 2] << 8 | a) >>> 0 : 0;
        raw[y * (this.w + 1) + 1 + x] = pal.get(key);
      }
      const plte = Buffer.alloc(pal.size * 3), trns = Buffer.alloc(pal.size);
      for (const [k, i] of pal) { plte[i * 3] = k >>> 24; plte[i * 3 + 1] = (k >>> 16) & 255; plte[i * 3 + 2] = (k >>> 8) & 255; trns[i] = k & 255; }
      extra = [chunk('PLTE', plte), chunk('tRNS', trns)];
    } else {
      ihdr[9] = 6;
      raw = Buffer.alloc((this.w * 4 + 1) * this.h);
      for (let y = 0; y < this.h; y++) Buffer.from(this.d.buffer, y * this.w * 4, this.w * 4).copy(raw, y * (this.w * 4 + 1) + 1);
    }
    return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), ...extra, chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  }
  url() { return 'data:image/png;base64,' + this.png().toString('base64'); }
}
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(b) { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return c ^ -1; }

// ------------------------------------------------------------------ the relief painter

const M = { none: 0, wood: 1, woodDark: 2, brass: 3, enamel: 4, steel: 5, ink: 6, sky: 7, moon: 8, moss: 9, dark: 10, red: 11, patina: 12 };
class Relief {
  constructor(w, h) { this.w = w; this.h = h; this.m = new Uint8Array(w * h); this.hgt = new Float32Array(w * h); this.alb = new Float32Array(w * h); this.flat = new Uint8Array(w * h); this.gloss = new Float32Array(w * h).fill(1); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  put(x, y, mat, h, alb = 0, o = {}) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.in(x, y)) return;
    const i = y * this.w + x;
    this.m[i] = mat; this.hgt[i] = h; this.alb[i] = alb; this.flat[i] = o.flat ? 1 : 0; this.gloss[i] = o.gloss ?? 1;
  }
  /** fill where mask(x, y) is true; h(x, y) and alb(x, y) give height and albedo offset */
  fill(x0, y0, x1, y1, mask, mat, h, alb = () => 0, o = {}) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x1)); x++) {
      if (!mask(x, y)) continue;
      this.put(x, y, typeof mat === 'function' ? mat(x, y) : mat, h(x, y), alb(x, y), o);
    }
  }
  mat(x, y) { return this.in(x, y) ? this.m[y * this.w + x] : 0; }
  /**
   * Age the piece: wood arrises rubbed pale where hands touch them, little nicks out of the edges, fine scratches
   * and dents in the veneer; verdigris settling in the brass's hollows and its high points rubbed bright.
   * `keep(x, y)` protects regions that must stay exact (windows other sprites are fitted into).
   */
  wear(seed, keep = () => false) {
    const { w, h } = this, isWood = (m) => m === M.wood || m === M.woodDark;
    const hg = Float32Array.from(this.hgt), mt = Uint8Array.from(this.m);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -9 : mt[y * w + x] ? hg[y * w + x] : -9);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, m = mt[i];
      if (!m || keep(x, y)) continue;
      const here = hg[i];
      let drop = 0, avg = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) drop = Math.max(drop, here - at(x + dx, y + dy));
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [2, -2], [-2, 2]]) avg += Math.max(-2, at(x + dx, y + dy));
      avg /= 8;
      const n = vnoise(x * 0.1, y * 0.1, seed), n2 = vnoise(x * 0.5, y * 0.5, seed + 3);
      if (isWood(m)) {
        // the edge of a step: rubbed pale in long patches, nicked here and there
        if (drop > 1.2 && n > 0.56) this.alb[i] += 0.05 + (n - 0.56) * 0.35;
        if (drop > 1.2 && hash(x, y, seed + 5) > 0.97 && n2 > 0.5) { this.hgt[i] -= 1.6; this.alb[i] -= 0.1; }
        if (hash(x, y, seed + 9) > 0.996) { this.hgt[i] -= 0.9; for (const [dx, dy] of [[1, 0], [0, 1]]) { const j = (y + dy) * w + x + dx; if (x + dx < w && y + dy < h && isWood(this.m[j])) this.hgt[j] -= 0.5; } }
      } else if (m === M.brass) {
        if (here < avg - 0.7 && n > 0.42 && hash(x, y, seed + 11) > 0.25) this.m[i] = M.patina;
        else if (here > avg + 0.5 && n2 > 0.5) this.alb[i] += 0.08;
        else this.alb[i] += (n - 0.5) * 0.12;
      }
    }
    // fine scratches across the veneer, light where they catch the lamp
    for (let k = 0; k < Math.round((w * h) / 900); k++) {
      const x0 = hash(k, 1, seed + 21) * w, y0 = hash(k, 2, seed + 21) * h, a = hash(k, 3, seed + 21) * Math.PI, len = 3 + hash(k, 4, seed + 21) * 7;
      for (let t = 0; t < len; t++) {
        const x = Math.floor(x0 + Math.cos(a) * t), y = Math.floor(y0 + Math.sin(a) * t * 0.6);
        if (!this.in(x, y) || keep(x, y) || !isWood(this.m[y * w + x])) continue;
        this.alb[y * w + x] += t === 0 || t > len - 2 ? 0.05 : 0.1;
      }
    }
    return this;
  }
  H(x, y) { x = clamp(x, 0, this.w - 1); y = clamp(y, 0, this.h - 1); const i = y * this.w + x; return this.m[i] ? this.hgt[i] : this.hgt[i] - 4; }
  /** shade into a Buf */
  render(o = {}) {
    const out = new Buf(this.w, this.h);
    const L = norm([-0.55, -0.72, 0.72]), Fl = norm([0.6, 0.2, 0.75]);
    const Hh = norm([L[0], L[1], L[2] + 1]);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * this.w + x, mat = this.m[i];
      if (!mat) continue;
      const alb = this.alb[i];
      if (this.flat[i]) { out.set(x, y, pick(rampFor(mat), clamp(0.5 + alb), x, y)); continue; }
      // the normal from the height field (clamped so steps read as bevels, not black)
      const gx = clamp((this.H(x + 1, y) - this.H(x - 1, y)) * 0.5, -3, 3), gy = clamp((this.H(x, y + 1) - this.H(x, y - 1)) * 0.5, -3, 3);
      const N = norm([-gx * 0.55, -gy * 0.55, 1]);
      const dif = Math.max(0, dot(N, L)), fil = Math.max(0, dot(N, Fl)) * 0.25;
      // cavity: lower than the neighbourhood -> darker
      let avg = 0;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [2, -2], [-2, 2]]) avg += this.H(x + dx, y + dy);
      const occ = clamp((avg / 8 - this.hgt[i]) * 0.09, 0, 0.35);
      const spec = Math.pow(Math.max(0, dot(N, Hh)), 26) * this.gloss[i];
      // reflection of a simple room: a bright window up-left, warm ceiling, dark floor
      const Rf = [2 * N[2] * N[0], 2 * N[2] * N[1], 2 * N[2] * N[2] - 1];
      const env = clamp(0.45 - Rf[1] * 0.55 + (Rf[0] < -0.15 && Rf[1] < -0.1 ? 0.35 : 0) - (Rf[1] > 0.35 ? 0.25 : 0), 0, 1);
      let t;
      switch (mat) {
        case M.wood: case M.woodDark: t = 0.04 + dif * 0.48 + fil * 0.8 + alb - occ + spec * 0.7 + env * 0.05; break;
        case M.brass: t = env * 0.5 + dif * 0.46 + spec * 0.75 + alb - occ * 1.2; break;
        case M.patina: t = 0.2 + dif * 0.4 + alb - occ; break;
        case M.enamel: t = 0.42 + dif * 0.45 + alb - occ * 0.8 + spec * 0.2; break;
        case M.steel: t = env * 0.45 + spec * 0.9 + dif * 0.15 + alb - occ; break;
        case M.dark: t = 0.15 + dif * 0.25 + alb - occ; break;
        default: t = 0.3 + dif * 0.5 + alb - occ; break;
      }
      out.set(x, y, pick(rampFor(mat), clamp(t), x, y));
    }
    if (o.outline) organicEdge(out, o.seed ?? 1, o.keep ?? (() => false));
    return out;
  }
}
/**
 * Hand-drawn edges for a painted sprite: the silhouette wobbles in and out by a pixel along its length (never a
 * ruler-straight line or a compass-perfect curve), then gets a selective outline: on the shadow side (below,
 * right) a dark, cool, purple-leaning version of the colour it borders; on the lit side (above, left) a warmer,
 * softer one, broken where the light catches the edge. Regions `keep` marks stay exactly as painted.
 */
function organicEdge(out, seed, keep) {
  const { w, h } = out;
  const src = new Buf(w, h); src.d.set(out.d);
  const solid = (x, y) => src.a(x, y) > 200;
  const col = (x, y) => { const i = (y * w + x) * 4; return [src.d[i], src.d[i + 1], src.d[i + 2]]; };
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // 1. the silhouette breathes: low-frequency noise nibbles or grows the edge by one pixel
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (keep(x, y)) continue;
    // long, slow undulations (a hand's wobble), never single-pixel noise
    const n = vnoise(x * 0.07, y * 0.07, seed) * 0.85 + vnoise(x * 0.2, y * 0.2, seed + 1) * 0.15;
    if (solid(x, y)) {
      const open = N4.filter(([dx, dy]) => !solid(x + dx, y + dy)).length;
      if (open === 1 && n > 0.7) out.set(x, y, [0, 0, 0], 0);
    } else {
      const nb = N4.find(([dx, dy]) => solid(x + dx, y + dy));
      if (nb && n < 0.27) { const c = col(x + nb[0], y + nb[1]); out.set(x, y, c.map((v) => Math.round(v * 0.82))); }
    }
  }
  // 2. selective outline round the new silhouette
  const s2 = new Buf(w, h); s2.d.set(out.d);
  const solid2 = (x, y) => s2.a(x, y) > 200;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid2(x, y)) continue;
    const nb = N4.find(([dx, dy]) => solid2(x + dx, y + dy));
    if (!nb) continue;
    const i = ((y + nb[1]) * w + x + nb[0]) * 4, c = [s2.d[i], s2.d[i + 1], s2.d[i + 2]];
    const lit = nb[0] > 0 || nb[1] > 0; // the outline sits on the object's upper or left side
    if (lit && vnoise(x * 0.3, y * 0.3, seed + 7) > 0.62) continue; // lost in the light
    const o = lit
      ? [c[0] * 0.55 + 10, c[1] * 0.42 + 4, c[2] * 0.4 + 4]
      : [c[0] * 0.26 + 8, c[1] * 0.16 + 3, c[2] * 0.26 + 12];
    out.set(x, y, o.map((v) => Math.round(Math.min(255, v))));
  }
}
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function rampFor(m) { return m === M.patina ? R.patina : m === M.wood ? R.wood : m === M.woodDark ? R.woodDark : m === M.brass ? R.brass : m === M.enamel ? R.enamel : m === M.steel ? R.steel : m === M.ink ? R.ink : m === M.sky ? R.sky : m === M.moon ? R.moon : m === M.moss ? R.moss : m === M.red ? R.red : R.dark; }

/** flame-mahogany veneer figure as an albedo offset (dir: 'v' vertical boards, 'h' rails, 'f' flame from a centre) */
function veneer(x, y, dir = 'v', seed = 0, cx = 0) {
  let u, v;
  if (dir === 'h') { u = y; v = x; } else if (dir === 'f') { u = Math.abs(x - cx); v = y; } else { u = x; v = y; }
  const warp = (vnoise(v * 0.04, u * 0.15, seed) - 0.5) * 6 + (dir === 'f' ? -Math.pow(u * 0.35, 1.3) : 0);
  const g = (dir === 'f' ? v + warp * 1.5 + u * 0.6 : u + warp);
  const band = (((g / 3.2) % 1) + 1) % 1;
  const fig = (fbm(u * 0.06, v * 0.03, seed + 4) - 0.5) * 0.22;
  const flame = dir === 'f' ? Math.sin(g * 0.9 + vnoise(u * 0.2, v * 0.05, seed) * 3) * 0.06 : 0;
  return fig + flame + (band < 0.2 ? -0.07 : band > 0.55 && band < 0.65 ? 0.03 : 0);
}

// ------------------------------------------------------------------ the clock: geometry (art px, y down)

const W = 160, H = 258, CX = 80;
const DY = 150, RD = 34;              // dial centre (a pixel corner) and enamel radius
const AY = 114, AR = 42;              // the break arch of the door opening: centre height and radius
const OPEN = { x0: CX - AR, x1: CX + AR, y1: 188 };
const MOON = { cx: CX, cy: AY, r: 24, dcy: AY + 6, dr: 30 };
const AP = { cx: CX, cy: 212, r: 13, y1: 231 }; // the pendulum aperture
const PIVOT = { x: CX, y: 203 }, PEND_LEN = 18, PEND_R = 6;
const bellY0 = 20, bellY1 = 58;
const bellHW = (y) => { const t = clamp((y - bellY0) / (bellY1 - bellY0)); return 28 + 32 * (t < 0.3 ? 0.18 * Math.sin((t / 0.3) * Math.PI / 2) : 0.18 + 0.82 * Math.pow((t - 0.3) / 0.7, 1.7)); };
/** signed distance (px) to the door opening: < 0 inside */
const sdOpen = (x, y) => (y + 0.5 < AY ? dist(x, y, CX, AY) - AR : Math.max(Math.abs(x + 0.5 - CX) - AR, y + 0.5 - OPEN.y1));
const inMoonWin = (x, y) => y + 0.5 < AY && dist(x, y, CX, AY) < MOON.r && dist(x, y, CX - 12, AY) >= 12 && dist(x, y, CX + 12, AY) >= 12;
const sdAp = (x, y) => (y + 0.5 < AP.cy ? dist(x, y, AP.cx, AP.cy) - AP.r : Math.max(Math.abs(x + 0.5 - AP.cx) - AP.r, y + 0.5 - AP.y1));

/** tiny 3x5 capitals for the dial signature */
const TINY = { H: ['#.#', '#.#', '###', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'], L: ['#..', '#..', '#..', '#..', '###'], W: ['#.#', '#.#', '#.#', '###', '#.#'], C: ['###', '#..', '#..', '#..', '###'], '&': ['.#.', '#.#', '.#.', '#.#', '.##'], '.': ['.', '.', '.', '.', '#'], ' ': ['.', '.', '.', '.', '.'] };
/** roman numeral glyphs, 7 px tall, with serifs */
const ROM = {
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  V: ['##.##', '.#.#.', '.#.#.', '.#.#.', '.#.#.', '..#..', '..#..'],
  X: ['##.##', '.#.#.', '.#.#.', '..#..', '.#.#.', '.#.#.', '##.##'],
};
const NUMS = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

function leafMask(ax, ay, a, len, wid) {
  return (x, y) => {
    const px = x + 0.5 - ax, py = y + 0.5 - ay, u = px * Math.cos(a) + py * Math.sin(a), v = -px * Math.sin(a) + py * Math.cos(a);
    return u >= 0 && u <= len && Math.abs(v) <= Math.sin((u / len) * Math.PI) * wid;
  };
}

function paintClock() {
  const r = new Relief(W, H);
  const ink = (x, y) => r.put(x, y, M.ink, 8.5, 0, { flat: true });

  // ---- the bun feet (brass) and the base moulding
  for (const fx of [32, 128]) r.fill(fx - 11, 246, fx + 11, 258, (x, y) => { const nx = (x + 0.5 - fx) / 10.5, ny = (y + 0.5 - 251) / 7; return nx * nx + ny * ny < 1; }, M.brass, (x, y) => 6 + 5 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - fx) / 10.5) ** 2 - ((y + 0.5 - 251) / 7) ** 2)));
  const baseProf = [11, 13, 14, 13, 11, 9, 10, 12, 13, 13, 12, 10];
  r.fill(0, 236, W, 248, (x, y) => Math.abs(x + 0.5 - CX) < 60 + Math.min(6, (y - 236) * 0.7), M.wood, (x, y) => baseProf[y - 236] + (Math.abs(x + 0.5 - CX) > 60 + (y - 236) * 0.7 - 1.5 ? -2 : 0), (x, y) => veneer(x, y, 'h', 3));
  r.fill(0, 236, W, 238, (x, y) => Math.abs(x + 0.5 - CX) < 61, M.brass, (x, y) => 14 - (y - 236) * 1.5);

  // ---- the case body (lower part and door section), pilasters
  const bodyW = 60;
  r.fill(CX - bodyW, 194, CX + bodyW, 236, () => true, M.wood, (x, y) => {
    const fx = Math.abs(x + 0.5 - CX), inField = fx < bodyW - 16 && y >= 203 && y < 232;
    if (!inField) return 11;
    const e = Math.min(bodyW - 16 - fx, y - 203, 232 - y);
    return 9 + Math.min(1.5, e * 0.5);
  }, (x, y) => {
    const fx = Math.abs(x + 0.5 - CX);
    const string = (Math.abs(fx - (bodyW - 19)) < 0.6 && y > 205 && y < 230) || ((Math.abs(y - 205.5) < 0.6 || Math.abs(y - 229.5) < 0.6) && fx < bodyW - 19);
    return string ? 0.3 : veneer(x, y, 'f', 11, CX) * 1.4;
  });
  const midProf = [12, 13.5, 13, 11, 12];
  r.fill(CX - bodyW - 1, 194, CX + bodyW + 1, 199, () => true, M.wood, (x, y) => midProf[y - 194], (x, y) => veneer(x, y, 'h', 5));
  r.fill(CX - bodyW, 68, CX + bodyW, 194, () => true, M.wood, (x, y) => {
    const fx = x + 0.5 - CX, ax = Math.abs(fx);
    if (ax > bodyW - 12) {
      const c = (bodyW - 6) * Math.sign(fx), u = (fx - c) / 6;
      let h = 11 + 2.6 * Math.sqrt(Math.max(0, 1 - u * u));
      if ([-3, 0, 3].some((k) => Math.abs(fx - c - k) < 0.7) && y > 78 && y < 184) h -= 1.4;
      return h;
    }
    const d = sdOpen(x, y);
    return 11 + Math.min(1.2, Math.max(0, d - 4) * 0.4);
  }, (x, y) => (Math.abs(x + 0.5 - CX) > bodyW - 12 ? veneer(x, y, 'v', 7) : y < 76 || y > 188 ? veneer(x, y, 'h', 9) : veneer(x, y, 'v', 13)));
  for (const sx of [-1, 1]) {
    const c = CX + sx * (bodyW - 6);
    const capProf = [13, 14.5, 13.5, 12.5, 13.5, 14.5, 13.5];
    r.fill(c - 7, 68, c + 7, 75, () => true, M.brass, (x, y) => capProf[y - 68] + 1.5 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - c) / 7) ** 2)));
    r.fill(c - 7, 186, c + 7, 194, () => true, M.brass, (x, y) => [12.5, 13.5, 14.5, 13.5, 12.5, 13.5, 14.5, 13][y - 186] + 1.5 * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - c) / 7) ** 2)));
  }

  // ---- the opening: dial plate, moon arch, spandrels, the enamel dial
  r.fill(OPEN.x0 - 4, AY - AR - 4, OPEN.x1 + 4, OPEN.y1 + 4, (x, y) => sdOpen(x, y) < 0, M.brass, () => 6, (x, y) => (hash(x, y, 31) - 0.5) * 0.12 + (vnoise(x * 0.3, y * 0.3, 2) - 0.5) * 0.08, { gloss: 0.3 });
  r.fill(CX - AR, AY - AR, CX + AR, AY, (x, y) => sdOpen(x, y) < -2 && dist(x, y, CX, AY) > MOON.r + 2.5 && y + 0.5 < AY, M.brass, () => 6, (x, y) => {
    const a = Math.atan2(y + 0.5 - AY, x + 0.5 - CX), d = dist(x, y, CX, AY);
    const rr = 33 + Math.sin(a * 7) * 3.2;
    const line = Math.abs(d - rr) < 0.6 || (Math.sin(a * 7) > 0.6 && Math.abs(d - rr - 3) < 0.5) || (Math.sin(a * 7) < -0.6 && Math.abs(d - rr + 3) < 0.5);
    return line ? -0.32 : (hash(x, y, 33) - 0.5) * 0.12;
  }, { gloss: 0.3 });
  for (const [sx, sy] of [[CX - 32, AY - 8], [CX + 31, AY - 8], [CX - 20, AY - 30], [CX + 19, AY - 30], [CX, AY - 37]]) for (let k = -1; k <= 1; k++) { r.put(sx + k, sy, M.brass, 8); r.put(sx, sy + k, M.brass, 8); }
  r.fill(CX - MOON.r - 3, AY - MOON.r - 3, CX + MOON.r + 3, AY, (x, y) => { const d = dist(x, y, CX, AY); return d >= MOON.r && d < MOON.r + 2 && y + 0.5 < AY; }, M.brass, (x, y) => 7 + (1 - Math.abs(dist(x, y, CX, AY) - MOON.r - 1)) * 1.6);
  for (const hx of [CX - 12, CX + 12]) {
    r.fill(hx - 12, AY - 12, hx + 12, AY, (x, y) => dist(x, y, hx, AY) < 12 && dist(x, y, CX, AY) < MOON.r && y + 0.5 < AY, M.moss, (x, y) => 7 + Math.sqrt(Math.max(0, 144 - (x + 0.5 - hx) ** 2 - (y + 0.5 - AY) ** 2)) * 0.35, (x, y) => (hash(x, y, 41) - 0.5) * 0.25 + (vnoise(x * 0.4, y * 0.4, 4) - 0.5) * 0.2);
  }
  for (const [tx, ty, hh] of [[CX - 17, AY - 9, 5], [CX - 12, AY - 12, 6], [CX - 7, AY - 9, 4], [CX + 8, AY - 10, 5], [CX + 13, AY - 12, 6], [CX + 18, AY - 8, 4]]) {
    for (let k = 0; k < hh; k++) for (let j = -Math.floor(k / 2); j <= Math.floor(k / 2); j++) r.put(tx + j, ty + k, M.moss, 9 + (hh - k) * 0.3, j < 0 ? 0.1 : -0.25);
    r.put(tx, ty + hh, M.woodDark, 8.5, 0);
  }
  // an engraved ring round the dial, and in each corner a cast rosette with four leaves and a scroll
  r.fill(OPEN.x0, AY, OPEN.x1, OPEN.y1, (x, y) => Math.abs(dist(x, y, CX, DY) - (RD + 2.6)) < 0.55 && sdOpen(x, y) < -1, M.brass, () => 5.4, () => -0.3);
  for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const rx = CX + qx * (AR - 9), ry = (qy < 0 ? AY + 8 : OPEN.y1 - 8);
    r.fill(rx - 9, ry - 9, rx + 9, ry + 9, (x, y) => sdOpen(x, y) < -1 && dist(x, y, CX, DY) > RD + 3.5, M.brass, (x, y) => {
      const d = dist(x, y, rx, ry), a = Math.atan2(y + 0.5 - ry, x + 0.5 - rx);
      const petal = d < 3.6 + Math.cos(a * 6) * 0.9;
      const leaf = d < 8 && Math.abs(Math.sin(a * 2 + Math.PI / 4)) < 0.28 * (1 - d / 9) + 0.06 && d > 3;
      return petal ? 7.6 + (3.6 - d) * 0.5 : leaf ? 7 - d * 0.08 : 6;
    }, (x, y) => (dist(x, y, rx, ry) < 1.2 ? 0.15 : 0));
  }
  r.fill(CX - RD, DY - RD, CX + RD, DY + RD, (x, y) => dist(x, y, CX, DY) < RD, M.enamel, (x, y) => { const d = dist(x, y, CX, DY) / RD; return 7.5 + 1.8 * (1 - d * d); }, (x, y) => {
    const d = dist(x, y, CX, DY);
    let a = (vnoise(x * 0.15, y * 0.15, 61) - 0.5) * 0.06;
    if (Math.abs(vnoise(x * 0.3, y * 0.3, 62) - 0.5) < 0.014 && hash(x, y, 63) > 0.4) a -= 0.16;
    if (d < 20.5) a += (Math.sin(d * 2.6) > 0.3 ? 0.025 : -0.025);
    if (d > RD - 1.2) a -= 0.15;
    a -= Math.pow(d / RD, 5) * 0.08; // yellowed toward the rim
    return a;
  });
  // an old chip out of the enamel by the IIII, the dark ground showing through
  for (let y = DY + 10; y < DY + 22; y++) for (let x = CX + 22; x < CX + 34; x++) {
    const d = dist(x, y, CX + 27.5, DY + 15.5) + (vnoise(x * 0.7, y * 0.7, 66) - 0.5) * 2.2;
    if (d < 2.1 && dist(x, y, CX, DY) < RD - 0.5) r.put(x, y, M.dark, 6.6, 0.1);
    else if (d < 3 && dist(x, y, CX, DY) < RD) r.alb[y * W + x] -= 0.12;
  }
  for (let y = DY - RD; y < DY + RD; y++) for (let x = CX - RD; x < CX + RD; x++) {
    const d = dist(x, y, CX, DY);
    if (Math.abs(d - 32.6) < 0.5 || Math.abs(d - 29.4) < 0.5) ink(x, y);
  }
  for (let m = 0; m < 60; m++) {
    // a dot for every minute on the track, a bold bar across it every five
    const a = (m / 60) * Math.PI * 2 - Math.PI / 2;
    if (m % 5 === 0) for (let rr = 29.6; rr < 32.6; rr += 0.25) ink(Math.floor(CX + Math.cos(a) * rr), Math.floor(DY + Math.sin(a) * rr));
    else ink(Math.floor(CX + Math.cos(a) * 31), Math.floor(DY + Math.sin(a) * 31));
  }
  NUMS.forEach((s, h) => {
    const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
    const glyphs = [...s].map((c) => ROM[c]);
    const w = glyphs.reduce((acc, g) => acc + g[0].length, 0);
    const rr = 24.4 + Math.abs(Math.cos(a)) * (w > 9 ? 1.4 : 0.5);
    const x0 = Math.round(CX + Math.cos(a) * rr - w / 2), y0 = Math.round(DY + Math.sin(a) * rr - 3.5);
    let xx = x0;
    for (const g of glyphs) { g.forEach((row, yy) => [...row].forEach((ch, k) => { if (ch === '#') ink(xx + k, y0 + yy); })); xx += g[0].length; }
  });
  const tiny = (str, cx, y) => { let w = -1; for (const c of str) w += (TINY[c]?.[0].length ?? 3) + 1; let x = Math.round(cx - w / 2); for (const c of str) { const g = TINY[c] ?? TINY[' ']; g.forEach((row, yy) => [...row].forEach((ch, k) => { if (ch === '#') ink(x + k, y + yy); })); x += g[0].length + 1; } };
  tiny('HOLLOW', CX, DY - 14);
  tiny('& CO.', CX, DY + 9);
  for (const sx of [-1, 1]) {
    const hx = CX + sx * 12, hy = DY + 5;
    r.fill(hx - 3, hy - 3, hx + 3, hy + 3, (x, y) => dist(x, y, hx, hy) < 2.6, M.brass, (x, y) => 8.6 - dist(x, y, hx, hy) * 0.3);
    r.fill(hx - 2, hy - 2, hx + 2, hy + 2, (x, y) => dist(x, y, hx, hy) < 1.4, M.dark, () => 6);
  }
  for (let y = AY - MOON.r; y < AY; y++) for (let x = CX - MOON.r; x < CX + MOON.r; x++) if (inMoonWin(x, y)) r.put(x, y, M.none, 0);

  // ---- the brass bezel round the opening (a bead between two fillets)
  r.fill(OPEN.x0 - 5, AY - AR - 5, OPEN.x1 + 5, OPEN.y1 + 5, (x, y) => { const d = sdOpen(x, y); return d >= 0 && d < 4; }, M.brass, (x, y) => [12.6, 14.2, 15, 14.2, 12.8][Math.min(4, Math.floor(sdOpen(x, y) * 1.25))]);

  // ---- the pendulum aperture: brass bezel, dark interior with the back board, the beat plate
  r.fill(AP.cx - AP.r - 4, AP.cy - AP.r - 4, AP.cx + AP.r + 4, AP.y1 + 4, (x, y) => sdAp(x, y) < 3 && sdAp(x, y) >= 0, M.brass, (x, y) => [12.5, 14, 14.6, 13][Math.min(3, Math.floor(sdAp(x, y) * 1.4))]);
  r.fill(AP.cx - AP.r, AP.cy - AP.r, AP.cx + AP.r, AP.y1, (x, y) => sdAp(x, y) < 0, M.woodDark, (x, y) => 2 + (y - AP.cy + AP.r) * 0.04, (x, y) => veneer(x, y, 'v', 17) * 0.6 - 0.2);
  r.fill(CX - 4, PIVOT.y - 1, CX + 4, PIVOT.y + 2, (x, y) => sdAp(x, y) < 0, M.brass, () => 4);

  // ---- cornice, bell top, fret, finials, handle
  const corProf = [11, 13, 14.5, 15, 14.5, 13, 11, 10, 11, 12];
  const corHW = [60, 62, 64, 65, 65, 64, 63, 62, 61, 61];
  r.fill(0, 58, W, 68, (x, y) => Math.abs(x + 0.5 - CX) < corHW[y - 58], M.wood, (x, y) => corProf[y - 58] - (Math.abs(x + 0.5 - CX) > corHW[y - 58] - 1.5 ? 1.5 : 0), (x, y) => veneer(x, y, 'h', 21));
  r.fill(0, 64, W, 65, (x, y) => Math.abs(x + 0.5 - CX) < 63, M.brass, () => 12.5);
  r.fill(0, bellY0, W, bellY1, (x, y) => Math.abs(x + 0.5 - CX) < bellHW(y), M.wood, (x, y) => {
    const hw = bellHW(y), bc = (hw - 28) / 32, dx = (x + 0.5 - CX) / hw;
    return 3 + bc * 9 + 4 * Math.sqrt(Math.max(0, 1 - dx * dx));
  }, (x, y) => veneer(x, y, 'f', 23, CX) * 1.3);
  const fcx = CX, fcy = 41;
  const inF = (x, y) => ((x + 0.5 - fcx) / 18) ** 2 + ((y + 0.5 - fcy) / 8) ** 2 < 1;
  const fretMat = (x, y) => {
    const e = 1 - ((x + 0.5 - fcx) / 18) ** 2 - ((y + 0.5 - fcy) / 8) ** 2;
    if (e < 0.14) return M.brass;
    const gx = (((x + 0.5 - fcx) % 6) + 6) % 6 - 3, gy = (((y + 0.5 - fcy + 3) % 6) + 6) % 6 - 3, d = Math.hypot(gx, gy);
    return Math.abs(d - 2.4) < 0.75 ? M.brass : M.dark;
  };
  r.fill(fcx - 19, fcy - 9, fcx + 19, fcy + 9, inF, fretMat, (x, y) => (fretMat(x, y) === M.dark ? 2 : 11.5));
  r.fill(0, 15, W, 21, (x, y) => Math.abs(x + 0.5 - CX) < [20, 22, 23, 23, 22, 21][y - 15], M.wood, (x, y) => [10, 12, 13, 12.5, 11.5, 10][y - 15], (x, y) => veneer(x, y, 'h', 25));
  for (const sx of [-1, 1]) r.fill(CX + sx * 22 - 4, 14, CX + sx * 22 + 4, 22, (x, y) => dist(x, y, CX + sx * 22, 18) < 3.4, M.brass, (x, y) => 13 + Math.sqrt(Math.max(0, 11.6 - dist(x, y, CX + sx * 22, 18) ** 2)));
  const pts = [];
  for (let i = 0; i <= 200; i++) { const th = -Math.PI / 2 + (i / 200) * Math.PI; pts.push([CX + 22 * Math.sin(th), 17 - 13.5 * Math.cos(th)]); }
  const near = (x, y) => { let best = 9; for (const [px, py] of pts) best = Math.min(best, Math.hypot(x + 0.5 - px, y + 0.5 - py)); return best; };
  r.fill(CX - 26, 1, CX + 26, 18, (x, y) => near(x, y) < (y < 6 ? 2.1 : 1.6) && y < 16, M.brass, (x, y) => 14 + Math.sqrt(Math.max(0, 4 - near(x, y) ** 2)) * 1.5);
  for (const sx of [-1, 1]) {
    const fx = CX + sx * 56;
    r.fill(fx - 6, 52, fx + 6, 58, (x, y) => Math.abs(x + 0.5 - fx) < [4, 5, 5, 6, 6, 6][y - 52], M.wood, (x, y) => [11, 12, 12.5, 12, 11.5, 11][y - 52], (x, y) => veneer(x, y, 'h', 27));
    r.fill(fx - 6, 40, fx + 6, 53, (x, y) => dist(x, y, fx, 47) < 5.4, M.brass, (x, y) => 12 + Math.sqrt(Math.max(0, 29 - dist(x, y, fx, 47) ** 2)) * 1.1);
    r.fill(fx - 2, 37, fx + 2, 42, (x, y) => Math.abs(x + 0.5 - fx) < (y < 39 ? 0.8 : 1.6), M.brass, () => 15);
  }
  return r;
}

/** the glass over the dial and the aperture: reflections only (alpha) */
function paintGlass() {
  const b = new Buf(W, H);
  const white = [255, 252, 240], warm = [255, 236, 200];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dOpen = sdOpen(x, y), dAp = sdAp(x, y);
    if (dOpen < 0) {
      // the convex glass: a crescent of window light along the upper-left of the arch, a soft broad sheen, a glint
      const d = dist(x, y, CX + 6, AY + 8), ang = Math.atan2(y + 0.5 - (AY + 8), x + 0.5 - (CX + 6));
      const upLeft = ang < -1.6 && ang > -2.9;
      if (upLeft && d > AR - 5.5 && d < AR - 3.6) b.set(x, y, white, 70);
      else if (upLeft && d > AR - 9 && d < AR - 5.5 && bayer(x, y) < 0.25) b.set(x, y, white, 40);
      if ((x === CX - 19 && y >= DY - 25 && y <= DY - 23) || (y === DY - 24 && x >= CX - 20 && x <= CX - 18)) b.set(x, y, white, 200);
      const lowR = dist(x, y, CX - 10, DY - 14);
      if (lowR > RD + 4 && lowR < RD + 6.5 && x > CX + 8 && y > DY + 8 && bayer(x, y) < 0.45) b.set(x, y, warm, 50);
    } else if (dAp < 0) {
      const u = (x - (AP.cx - AP.r)) + (y - (AP.cy - AP.r));
      if (u > 5 && u < 8) b.set(x, y, white, 80);
      if (u > 11 && u < 12) b.set(x, y, white, 55);
    }
  }
  return b;
}

// ------------------------------------------------------------------ moving parts

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// hands in hand space (+y from the centre towards the tip), blued steel spade hands and a gilt seconds hand
const HOUR = [
  { poly: [[-1.2, -5], [1.2, -5], [1.0, 11], [-1.0, 11]] },
  { poly: [[0, 9], [3.6, 11.5], [3.8, 14.5], [1.2, 16.5], [1.1, 18.5], [0, 21.5], [-1.1, 18.5], [-1.2, 16.5], [-3.8, 14.5], [-3.6, 11.5]] },
  { c: [0, -6.4], r: 2.4 },
];
const MINUTE = [
  { poly: [[-1.0, -7], [1.0, -7], [0.7, 23], [-0.7, 23]] },
  { poly: [[0, 19.5], [2.3, 23.5], [0, 31.5], [-2.3, 23.5]] },
  { c: [0, -8.2], r: 2.2 },
];
const SECOND = [{ poly: [[-0.55, -11], [0.55, -11], [0.45, 32.5], [-0.45, 32.5]] }, { c: [0, -10], r: 2.4 }];
const HUB = [{ c: [0, 0], r: 2.6 }];
const FR = 70;
/** rasterise a hand at an angle: lit edge facing the lamp, a dark outline; `gilt` for the seconds */
function handFrame(shape, ang, gilt = false) {
  const b = new Buf(FR, FR), c = FR / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  const ramp = gilt ? R.brass : R.steel;
  const inside = (px, py) => {
    const hx = px * ca + py * sa, hy = -(-px * sa + py * ca);
    return shape.some((p) => (p.poly ? inPoly(hx, hy, p.poly) : Math.hypot(hx - p.c[0], hy - p.c[1]) < p.r));
  };
  for (let y = 0; y < FR; y++) for (let x = 0; x < FR; x++) {
    const px = x + 0.5 - c, py = y + 0.5 - c;
    if (!inside(px, py)) continue;
    // a bevelled hand: the face toward the top-left light is bright, the other side darker, a glint on top
    const tl = !inside(px - 1, py) || !inside(px, py - 1), br = !inside(px + 1, py) || !inside(px, py + 1);
    let t = 0.42 + (tl && !br ? 0.38 : br && !tl ? -0.2 : 0);
    if (!tl && !br) t += 0.08;
    b.set(x, y, pick(ramp, clamp(t), x, y, 0.5));
  }
  // outline
  const o = new Buf(FR, FR); o.d.set(b.d);
  for (let y = 0; y < FR; y++) for (let x = 0; x < FR; x++) {
    if (b.a(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => b.a(x + dx, y + dy) > 200)) o.set(x, y, gilt ? [42, 22, 8] : [4, 4, 12]);
  }
  return o;
}
function handStrip(shape, n, gilt = false) {
  const strip = new Buf(FR * n, FR);
  for (let i = 0; i < n; i++) strip.blit(handFrame(shape, (i / n) * Math.PI * 2, gilt), i * FR, 0);
  return strip;
}
/** the brass centre boss over the hands */
function boss() {
  const b = new Buf(8, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const d = dist(x, y, 4, 4);
    if (d > 3.3) continue;
    b.set(x, y, d > 2.6 ? [36, 22, 8] : pick(R.brass, clamp(0.75 - (x - 3.5) * 0.14 - (y - 3.5) * 0.14 - (d < 1 ? 0.3 : 0)), x, y));
  }
  return b;
}

// the pendulum: a brass rod with a lenticular bob, clipped to the aperture; cosine-spaced swing frames
const PEND_N = 11, PEND_A = 0.2;
const APB = { x0: AP.cx - AP.r, y0: AP.cy - AP.r, w: AP.r * 2, h: AP.y1 - (AP.cy - AP.r) };
function pendulumFrame(a, clip = true) {
  const f = new Buf(APB.w, APB.h);
  const bx = PIVOT.x + Math.sin(a) * PEND_LEN, by = PIVOT.y + Math.cos(a) * PEND_LEN;
  for (let y = 0; y < APB.h; y++) for (let x = 0; x < APB.w; x++) {
    const X = x + APB.x0, Y = y + APB.y0;
    if (clip && sdAp(X, Y) >= 0) continue;
    const t = clamp(((X + 0.5 - PIVOT.x) * (bx - PIVOT.x) + (Y + 0.5 - PIVOT.y) * (by - PIVOT.y)) / (PEND_LEN * PEND_LEN));
    const qx = PIVOT.x + (bx - PIVOT.x) * t, qy = PIVOT.y + (by - PIVOT.y) * t;
    const dr = Math.hypot(X + 0.5 - qx, Y + 0.5 - qy), db = dist(X, Y, bx, by);
    if (db < PEND_R) {
      const nx = (X + 0.5 - bx) / PEND_R, ny = (Y + 0.5 - by) / PEND_R;
      let tt = 0.5 - nx * 0.28 - ny * 0.3;
      if (db > PEND_R - 1) tt -= 0.25;
      if (Math.abs(db - 3.4) < 0.5) tt -= 0.15;
      if (Math.hypot(nx + 0.35, ny + 0.35) < 0.28) tt += 0.4;
      f.set(x, y, pick(R.brass, clamp(tt), X, Y));
    } else if (dr < 0.8 && t < 0.99) f.set(x, y, pick(R.brass, (X + Y) % 3 ? 0.5 : 0.7, X, Y));
  }
  return f;
}
function pendulumStrip() {
  const strip = new Buf(APB.w * PEND_N, APB.h);
  for (let j = 0; j < PEND_N; j++) strip.blit(pendulumFrame(PEND_A * Math.cos((Math.PI * j) / (PEND_N - 1))), j * APB.w, 0);
  return strip;
}

// the moon disc behind the arch: deep blue with stars and two painted moons, turning on (CX, dcy)
const MDS = MOON.dr * 2 + 2;
function moonDisc(rot) {
  const b = new Buf(MDS, MDS), c = MDS / 2;
  for (let y = 0; y < MDS; y++) for (let x = 0; x < MDS; x++) {
    const px = x + 0.5 - c, py = y + 0.5 - c, d = Math.hypot(px, py);
    if (d > MOON.dr) continue;
    // disc space (unrotated)
    const ca = Math.cos(-rot), sa = Math.sin(-rot), ux = px * ca - py * sa, uy = px * sa + py * ca;
    let col = pick(R.sky, clamp(0.35 + (1 - d / MOON.dr) * 0.45 + (vnoise(ux * 0.2, uy * 0.2, 81) - 0.5) * 0.25), x, y, 0.9);
    const sx = Math.floor(ux + 100), sy = Math.floor(uy + 100);
    if (hash(sx, sy, 82) > 0.955) col = hash(sx, sy, 83) > 0.5 ? [255, 236, 170] : [210, 228, 255];
    for (const sgn of [-1, 1]) {
      const mx = 0, my = sgn * -19, md = Math.hypot(ux - mx, uy - my);
      if (md < 6.2) {
        const nx = (ux - mx) / 6.2, ny = (uy - my) / 6.2;
        let t = 0.68 - (nx * Math.cos(rot) - ny * Math.sin(rot)) * 0.3 - (nx * Math.sin(rot) + ny * Math.cos(rot)) * 0.25;
        if (Math.hypot(nx - 0.3, ny + 0.2) < 0.25 || Math.hypot(nx + 0.25, ny - 0.35) < 0.2 || Math.hypot(nx + 0.1, ny + 0.45) < 0.12) t -= 0.18;
        col = pick(R.moon, clamp(t), x, y, 0.7);
      } else if (md < 7.6 && bayer(x, y) < 0.4) col = mix(col, [255, 226, 150], 0.35);
    }
    b.set(x, y, col);
  }
  return b;
}
/** the moon seen through the window at N disc angles (rising from behind the left hill to the top) */
const MOON_N = 40;
const MW = { x0: CX - MOON.r, y0: AY - MOON.r, w: MOON.r * 2, h: MOON.r };
function moonStrip() {
  const strip = new Buf(MW.w * MOON_N, MW.h);
  for (let j = 0; j < MOON_N; j++) {
    const rot = -Math.PI * 0.62 + (j / (MOON_N - 1)) * Math.PI * 0.62; // the upper moon from low left to the top
    const disc = moonDisc(rot), dx = CX - MDS / 2, dy = MOON.dcy - MDS / 2;
    for (let y = 0; y < MW.h; y++) for (let x = 0; x < MW.w; x++) {
      const X = x + MW.x0, Y = y + MW.y0;
      if (!inMoonWin(X, Y)) continue;
      const c = disc.get(X - dx, Y - dy);
      if (c) strip.set(j * MW.w + x, y, c);
    }
  }
  return strip;
}

// ------------------------------------------------------------------ the boot scene: wall, bracket, light

/** a dark emerald regency-stripe wall (the office's own wallpaper, in the dark), 64 px tile */
function wallTile() {
  const N = 64, b = new Buf(N, N);
  const G = rampOf([0x020605, 0x06120e, 0x0b1e17, 0x112a20], 6);
  const gold = rampOf([0x1a1306, 0x2e220c], 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = x % 32;
    const n = (vnoise((x % N) * 0.12, y * 0.12, 5) - 0.5) * 0.2;
    if (sx === 20 || sx === 31) { b.set(x, y, pick(gold, 0.5 + n, x, y)); continue; }
    const satin = sx < 20;
    const dia = satin && Math.abs(Math.abs((sx % 20) - 10) + Math.abs((y % 16) - 8) - 7) < 0.8;
    b.set(x, y, pick(G, clamp((satin ? 0.62 : 0.32) + n + (dia ? 0.12 : 0) + ((x + y) & 1 ? 0.02 : -0.02)), x, y, 1));
  }
  return { url: b.url(), N };
}
/** the carved mahogany wall bracket the clock stands on, with the clock's soft shadow */
const BR = { w: 172, h: 40 };
function bracket() {
  const r = new Relief(BR.w, BR.h), cx = BR.w / 2;
  // two carved scroll corbels: an S-curve with a volute at the top and a smaller one at the foot
  for (const sx of [-1, 1]) {
    const bx = cx + sx * 52;
    r.fill(bx - 14, 8, bx + 14, BR.h, (x, y) => {
      const t = (y - 8) / (BR.h - 8), w = 7 - t * 3, off = Math.sin(t * Math.PI) * 4 * -sx;
      return Math.abs(x + 0.5 - bx - off) < w || dist(x, y, bx - sx * 2, 13) < 6 || dist(x, y, bx + sx * 1, BR.h - 4) < 3.6;
    }, M.wood, (x, y) => {
      const t = (y - 8) / (BR.h - 8), off = Math.sin(t * Math.PI) * 4 * -sx, u = (x + 0.5 - bx - off) / (7 - t * 3);
      const vol = dist(x, y, bx - sx * 2, 13);
      if (vol < 6) return 8 + (Math.sin(vol * 1.4 + Math.atan2(y - 13, x - bx) * sx) > 0 ? 2 : 0.5);
      return 6 + 3 * Math.sqrt(Math.max(0, 1 - u * u));
    }, (x, y) => veneer(x, y, 'v', 91));
  }
  // the shelf: a moulded top board with a brass-edged lip
  const prof = [9, 11, 12, 12, 11, 9, 8, 9, 10, 9];
  r.fill(0, 0, BR.w, 10, (x, y) => Math.abs(x + 0.5 - cx) < 84 - (y > 6 ? (y - 6) * 2 : 0), M.wood, (x, y) => prof[y], (x, y) => veneer(x, y, 'h', 93));
  r.fill(0, 3, BR.w, 4, (x, y) => Math.abs(x + 0.5 - cx) < 83, M.brass, () => 12.5);
  return r.wear(19).render({ outline: true, seed: 5 });
}
/** A pool of warm lamplight on the wall, in hard stepped bands with ordered dither. */
function lampPool() {
  const w = 220, h = 280, b = new Buf(w, h), cx = w / 2, cy = h * 0.45;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - cx) / (w / 2), ny = (y + 0.5 - cy) / (h / 2), a = Math.atan2(ny, nx);
    // the rim wanders (a shade's uneven edge, the wall's texture), the light leans up and left
    const rag = 1 + (fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + 3, 8) - 0.5) * 0.34 + (vnoise(x * 0.09, y * 0.09, 9) - 0.5) * 0.1;
    const d = Math.sqrt(nx * nx + ny * ny) / rag;
    if (d >= 1) continue;
    const lean = clamp(1 - (nx * 0.25 + ny * 0.3) * 0.4, 0.7, 1.15);
    const lv = (1 - d) * 6 * lean, band = Math.floor(lv), frac = lv - band;
    const k = band + (frac > bayer(x, y) ? 1 : 0);
    if (k <= 0) continue;
    b.set(x, y, [255, 178, 92], Math.min(6, k) * 11);
  }
  return { url: b.url(), w, h };
}
function edgeShade(n, vertical) {
  const b = vertical ? new Buf(4, n) : new Buf(n, 4);
  for (let k = 0; k < n; k++) for (let j = 0; j < 4; j++) {
    const x = vertical ? j : k, y = vertical ? k : j, f = 1 - k / n;
    if (bayer(x, y) < f * f * 0.9) b.set(x, y, [2, 4, 4], 170);
  }
  return b.url();
}
/** a tiny pixel hand pointer (2 frames: up, pressed) for "tap the clock" */
function pointer() {
  const rows = ['..##........', '.#oo#.......', '.#oo#.......', '.#oo###.....', '.#oo#oo##...', '.#oo#oo#o#..', '##oooooooo#.', '#o#ooooooo#.', '#ooooooooo#.', '.#oooooooo#.', '..#ooooooo#.', '...#ssssss#.', '...########.'];
  const fw = 14, fh = 16, b = new Buf(fw * 2, fh);
  for (let f = 0; f < 2; f++) {
    const oy = f ? 2 : 0, ox = f ? 1 : 0;
    rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const c = ch === '#' ? [26, 18, 12] : ch === 'o' ? (x < 4 ? [255, 250, 238] : x > 8 || y > 8 ? [222, 206, 176] : [244, 236, 218]) : ch === 's' ? [190, 168, 120] : null;
      if (c) b.set(f * fw + ox + x + 1, oy + y + 1, c);
    }));
    if (f) for (const [dx, dy] of [[0, 0], [-2, 1], [4, -1]]) b.set(f * fw + 2 + dx, 1 + dy, [255, 214, 120]);
  }
  return { url: b.url(), fw, fh };
}
function sparkle() {
  const b = new Buf(7, 7);
  for (let k = -3; k <= 3; k++) { b.set(3 + k, 3, Math.abs(k) < 2 ? [255, 252, 240] : [255, 210, 120]); b.set(3, 3 + k, Math.abs(k) < 2 ? [255, 252, 240] : [255, 210, 120]); }
  return b.url();
}

// ------------------------------------------------------------------ assemble

const relief = paintClock();
const keepClock = (x, y) => dist(x, y, CX, DY) < RD + 1 || (y < AY + 1 && dist(x, y, CX, AY) < MOON.r + 2) || sdAp(x, y) < 2;
relief.wear(7, keepClock);
const caseB = relief.render({ outline: true, seed: 3, keep: keepClock });
const glass = paintGlass();
const HN = 120, MN = 120, SN = 60;
const hourS = handStrip(HOUR, HN), minS = handStrip(MINUTE, MN), secS = handStrip(SECOND, SN, true);
const pend = pendulumStrip(), moon = moonStrip(), ptr = pointer(), wall = wallTile(), pool = lampPool(), brk = bracket(), bossB = boss();
const EDGE = 44, edgeH = edgeShade(EDGE, false), edgeV = edgeShade(EDGE, true);
const HO = { x: CX - FR / 2, y: DY - FR / 2 };

// ---- the 3D office's copy of the clock: one atlas + its layout
{
  const AW = W * 2 + FR * 3 + 4, AH = H;
  const atlas = new Buf(AW, AH);
  atlas.blit(caseB, 0, 0);
  atlas.blit(glass, W, 0);
  const hx = W * 2;
  atlas.blit(handFrame(HOUR, 0), hx, 0);
  atlas.blit(handFrame(MINUTE, 0), hx + FR, 0);
  atlas.blit(handFrame(SECOND, 0, true), hx + FR * 2, 0);
  atlas.blit(moonDisc(0), hx, FR);
  const pf = pendulumFrame(0, false);
  atlas.blit(pf, hx + MDS + 2, FR);
  atlas.blit(bossB, hx + MDS + 2 + APB.w + 2, FR);
  writeFileSync(fileURLToPath(new URL('../../../public/models/interview/clock.png', import.meta.url)), atlas.png());
  // the case outline per row (for the 3D case walls): [y, x0, x1]
  const rows = [];
  for (let y = 14; y < H; y += 2) {
    let x0 = -1, x1 = -1;
    for (let x = 0; x < W; x++) if (caseB.a(x, y)) { if (x0 < 0) x0 = x; x1 = x + 1; }
    if (x0 >= 0) rows.push([y, x0, x1]);
  }
  const gen = `// Generated by src/onboard/tools/bootart.mjs: the layout of public/models/interview/clock.png (art px).
export const CLOCK_ART = ${JSON.stringify({
    W, H, CX, DY, RD, atlas: [AW, AH], case: [0, 0, W, H], glass: [W, 0, W, H], hour: [hx, 0, FR, FR], minute: [hx + FR, 0, FR, FR], second: [hx + FR * 2, 0, FR, FR],
    moon: [hx, FR, MDS, MDS], moonAt: [CX, MOON.dcy], pend: [hx + MDS + 2, FR, APB.w, APB.h], pendBox: [APB.x0, APB.y0], pivot: [PIVOT.x, PIVOT.y], boss: [hx + MDS + 2 + APB.w + 2, FR, 8, 8],
    rows,
  })} as const;
`;
  writeFileSync(fileURLToPath(new URL('../clockart.gen.ts', import.meta.url)), gen);
}

// ---- progress timing: the moon rises in the arch with the (estimated) loading progress, fast at first, then a crawl
const LOAD_S = 26;
const prog = (t) => { const a = Math.min(1, t / 7); return 0.9 * (1 - (1 - a) ** 2.4) + 0.07 * Math.max(0, (t - 7) / (LOAD_S - 7)); };
const invProg = (p) => { let lo = 0, hi = LOAD_S; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (prog(m) < p) lo = m; else hi = m; } return hi; };
function progFrames(name, frames, fw) {
  const out = [], n = frames.length;
  for (let i = 0; i < n; i++) {
    const p = (i / (n - 1)) * prog(LOAD_S);
    const pct = i === 0 ? 0 : (invProg(p) / LOAD_S) * 100;
    out.push(`${pct.toFixed(2)}%{background-position:-${frames[i] * fw}em 0}`);
  }
  return `@keyframes ${name}{${out.join('')}}`;
}
const moonFrames = Array.from({ length: MOON_N - 4 }, (_, i) => i);
const SH = H + BR.h - 2; // the clock and its bracket

const CSSTXT = `
#boot{--k:min(calc(86vw / ${BR.w}),calc(72vh / ${SH}));font-size:var(--k);position:fixed;inset:0;z-index:99;overflow:hidden;display:flex;align-items:center;justify-content:center;
background:#020504 url(${wall.url}) 50% 50%/${wall.N}em ${wall.N}em repeat;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .7s steps(6)}
@supports (width:round(nearest,1px,1px)){#boot{--k:max(1px,min(round(nearest,min(calc(86vw / ${BR.w}),calc(72vh / ${SH})),1px),round(down,min(calc(98vw / ${BR.w}),calc(92vh / ${SH})),1px)))}}
#boot.gone:not(.hold):not(.js){opacity:0;pointer-events:none}
#boot *{position:absolute;display:block;image-rendering:pixelated;image-rendering:crisp-edges;-webkit-user-drag:none;pointer-events:none}
#boot .bt-edge{left:0;top:0;width:${EDGE}em;height:100%;background:url(${edgeH}) 0 0/${EDGE}em 4em repeat-y}
#boot .bt-edge.r{left:auto;right:0;transform:scaleX(-1)}
#boot .bt-edge.t{width:100%;height:${EDGE}em;background:url(${edgeV}) 0 0/4em ${EDGE}em repeat-x}
#boot .bt-edge.b{top:auto;bottom:0;width:100%;height:${EDGE}em;background:url(${edgeV}) 0 0/4em ${EDGE}em repeat-x;transform:scaleY(-1)}
#boot .bt-pool{width:${pool.w}em;height:${pool.h}em;left:50%;top:50%;margin:-${(pool.h * 0.47).toFixed(1)}em 0 0 -${pool.w / 2}em;background:url(${pool.url}) 0 0/100% 100%;animation:bt-flick 3.2s steps(1) infinite}
#boot .bt-mote{width:1em;height:1em;background:#ffd890;opacity:0;animation:bt-mote 9s steps(36) infinite}
#boot .bt-stage{position:relative;width:${BR.w}em;height:${SH}em;flex:none;transform-origin:50% ${((DY / SH) * 100).toFixed(3)}%}
#boot .bt-clock{left:${(BR.w - W) / 2}em;top:0;width:${W}em;height:${H}em;transform-origin:50% 96%}
#boot .bt-brk{left:0;top:${H - 2}em;width:${BR.w}em;height:${BR.h}em}
#boot .bt-shadow{left:${(BR.w - W) / 2 + 14}em;top:${H - 6}em;width:${W - 22}em;height:6em;background:repeating-linear-gradient(90deg,rgba(0,0,0,.55) 0 1em,rgba(0,0,0,.25) 1em 2em)}
#boot .bt-moon{left:${MW.x0}em;top:${MW.y0}em;width:${MW.w}em;height:${MW.h}em;background:url(${moon.url()}) 0 0/${MW.w * MOON_N}em ${MW.h}em;animation:bt-moon ${LOAD_S}s steps(1,end) forwards}
#boot .bt-case{left:0;top:0;width:${W}em;height:${H}em}
#boot .bt-glass{left:0;top:0;width:${W}em;height:${H}em}
#boot .bt-pend{left:${APB.x0}em;top:${APB.y0}em;width:${APB.w}em;height:${APB.h}em;background:url(${pend.url()}) 0 0/${APB.w * PEND_N}em ${APB.h}em;animation:bt-pend .55s steps(${PEND_N - 1},jump-none) infinite alternate}
#boot .bt-h{left:${HO.x}em;top:${HO.y}em;width:${FR}em;height:${FR}em}
#boot .bt-hh{background:url(${hourS.url()}) 0 0/${FR * HN}em ${FR}em;animation:bt-hh 43200s steps(${HN}) calc(var(--th, 0) * -1s) infinite}
#boot .bt-mh{background:url(${minS.url()}) 0 0/${FR * MN}em ${FR}em;animation:bt-mh 3600s steps(${MN}) calc(var(--tm, 0) * -1s) infinite}
#boot .bt-sh{background:url(${secS.url()}) 0 0/${FR * SN}em ${FR}em;animation:bt-sh 60s steps(${SN}) calc(var(--ts, 0) * -1s) infinite}
#boot .bt-boss{left:${CX - 4}em;top:${DY - 4}em;width:8em;height:8em}
#boot .bt-tap{left:${CX + 26}em;top:${DY + 24}em;width:${ptr.fw}em;height:${ptr.fh}em;background:url(${ptr.url}) 0 0/${ptr.fw * 2}em ${ptr.fh}em;opacity:0}
#boot .bt-spark{width:7em;height:7em;opacity:0}
#boot.ready{cursor:pointer}
#boot.ready *{pointer-events:none}
#boot.ready .bt-tap{opacity:1;animation:bt-tap 1s steps(1) infinite}
#boot.ready .bt-clock{animation:bt-invite 2.6s steps(1) infinite}
#boot.done .bt-clock{animation:bt-chime .9s steps(1)}
#boot.done.ready .bt-clock{animation:bt-chime .9s steps(1),bt-invite 2.6s steps(1) .9s infinite}
#boot.done .bt-spark{animation:bt-spark .8s steps(4) forwards}
#boot.zoom .bt-tap{opacity:0;animation:none}
@keyframes bt-flick{0%,100%{opacity:1}31%{opacity:.9}36%{opacity:1}70%{opacity:.94}}
@keyframes bt-mote{0%{opacity:0;transform:translate(0,0)}15%{opacity:.7}50%{transform:translate(6em,-14em)}85%{opacity:.5}100%{opacity:0;transform:translate(2em,-28em)}}
@keyframes bt-sh{to{background-position:-${SN * FR}em 0}}
@keyframes bt-pend{to{background-position:-${(PEND_N - 1) * APB.w}em 0}}
@keyframes bt-mh{to{background-position:-${MN * FR}em 0}}
@keyframes bt-hh{to{background-position:-${HN * FR}em 0}}
${progFrames('bt-moon', moonFrames, MW.w)}
@keyframes bt-tap{0%{background-position:0 0}50%{background-position:-${ptr.fw}em 0}}
@keyframes bt-invite{0%,100%{transform:none}84%{transform:translateY(-1em)}88%{transform:translateY(0)}92%{transform:translateY(-.5em)}96%{transform:none}}
@keyframes bt-chime{0%{transform:rotate(0)}10%{transform:rotate(-1deg)}22%{transform:rotate(.9deg)}34%{transform:rotate(-.6deg)}46%{transform:rotate(.4deg)}58%{transform:rotate(-.2deg)}70%,100%{transform:none}}
@keyframes bt-spark{0%{opacity:1;transform:translate(0,0) scale(.4)}60%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1)}}
@media (prefers-reduced-motion:reduce){#boot *:not(.bt-h){animation-duration:0s!important;animation-iteration-count:1!important}}
`.trim().replace(/\n+/g, '\n');

const motes = [[-48, 30, 0], [44, 10, -2.1], [-22, -40, -4.4], [56, -56, -6.2], [-62, -8, -1.3], [14, 62, -3.6], [32, -70, -7.7], [-36, 70, -5.1]];
const sparks = [[CX - 22, 20, -10, -12], [CX + 16, 16, 12, -14], [CX - 3, 4, -2, -16], [CX + 34, 40, 16, -6], [CX - 40, 40, -16, -6]];
const html = `<!-- boot:begin (generated by src/onboard/tools/bootart.mjs; edit the generator, not this block) -->
    <style>${CSSTXT}</style>
    <div id="boot" role="progressbar" aria-label="Loading" data-art='${JSON.stringify({ fr: FR, mn: MN, hn: HN, sn: SN, mw: MW.w, mf: MOON_N, cx: CX, dy: DY, rd: RD, w: W, sh: SH, bw: BR.w })}'>
      <i class="bt-edge"></i><i class="bt-edge r"></i><i class="bt-edge t"></i><i class="bt-edge b"></i><i class="bt-pool"></i>${motes.map(([x, y, d]) => `<i class="bt-mote" style="left:calc(50% + ${x}em);top:calc(50% + ${y}em);animation-delay:${d}s"></i>`).join('')}
      <div class="bt-stage">
        <img class="bt-brk" src="${brk.url()}" alt="" /><i class="bt-shadow"></i>
        <div class="bt-clock">
          <i class="bt-moon"></i>
          <img class="bt-case" src="${caseB.url()}" alt="" />
          <i class="bt-pend"></i>
          <i class="bt-h bt-hh"></i><i class="bt-h bt-mh"></i><i class="bt-h bt-sh"></i>
          <img class="bt-boss" src="${bossB.url()}" alt="" />
          <img class="bt-glass" src="${glass.url()}" alt="" />
          <i class="bt-tap"></i>
          ${sparks.map(([x, y, dx, dy]) => `<img class="bt-spark" style="left:${x}em;top:${y}em;--dx:${dx}em;--dy:${dy}em" src="${sparkle()}" alt="" />`).join('')}
        </div>
      </div>
    </div>
    <script>(function(){try{var d=new Date(),s=d.getSeconds()+d.getMilliseconds()/1e3,m=d.getMinutes()*60+s,b=document.getElementById('boot').style;b.setProperty('--ts',s.toFixed(2));b.setProperty('--tm',m.toFixed(1));b.setProperty('--th',((d.getHours()%12)*3600+m).toFixed(1))}catch(e){}})()</script>
    <!-- boot:end -->`;

const file = fileURLToPath(new URL('../../../index.html', import.meta.url));
const src = readFileSync(file, 'utf8');
const a = src.indexOf('<!-- boot:begin'), z = src.indexOf('<!-- boot:end -->');
if (a < 0 || z < 0) throw new Error('boot markers missing in index.html');
writeFileSync(file, src.slice(0, a) + html + src.slice(z + '<!-- boot:end -->'.length));
if (process.argv.includes('--preview')) {
  const out = process.argv[process.argv.indexOf('--preview') + 1];
  const P = new Buf(W * 2 + 8 + BR.w, SH);
  P.blit(caseB, 0, 0);
  P.blit(handFrame(HOUR, (10 / 12) * Math.PI * 2 + 0.2), HO.x, HO.y);
  P.blit(handFrame(MINUTE, (10 / 60) * Math.PI * 2), HO.x, HO.y);
  P.blit(bossB, CX - 4, DY - 4);
  P.blit(glass, 0, 0);
  P.blit(brk, (W - BR.w) / 2, H - 2);
  const md = moonDisc(-0.2);
  for (let y = 0; y < MW.h; y++) for (let x = 0; x < MW.w; x++) { const X = x + MW.x0, Y = y + MW.y0; if (inMoonWin(X, Y)) { const c = md.get(X - (CX - MDS / 2), Y - (MOON.dcy - MDS / 2)); if (c) P.set(X, Y, c); } }
  P.blit(pendulumFrame(0.12), APB.x0, APB.y0);
  P.blit(caseB, W + 8, 0);
  writeFileSync(out, P.png());
}
console.log('boot block written:', (html.length / 1024).toFixed(1), 'KB');

