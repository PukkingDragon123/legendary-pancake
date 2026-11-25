// Generates the loading screen (the `#boot` block in index.html) and the office clock's painting
// (public/models/interview/clock.png + src/onboard/clockart.gen.ts): the game's carved Black Forest cuckoo clock
// hanging alone on a dark emerald wall in a pool of lamplight. No text.
//
// The clock (the same design as the HUD shelf's and the big Clock screen's): a shingled chalet roof with scalloped
// bargeboards, a carved owl crest on a fan of oak leaves, a little arched double door over a balcony of turned
// balusters (Pip lives behind it), a walnut case with a wreath of carved oak leaves and acorns round an enamel dial
// (Roman numerals, a painted rosette, pierced Gothic hands), a pierced fretwork apron, a carved-leaf pendulum and two
// cast pine-cone weights on brass chains.
//
// It is painted as a 2.5D relief: every texel gets a material, a height and an albedo offset; a warm key light from
// the top left, a soft fill, cavity occlusion and polished highlights shade it; the shade is mapped onto hand-picked,
// hue-shifted ramps (violet shadows, golden lights) with a light ordered dither, then every part gets a dark inner
// line where it overlaps the part behind and the whole sprite a near-black outer outline. Images are written as
// indexed PNGs (small enough to inline before any script loads).
//
// Moving parts are pre-drawn frames played with CSS steps(): 120 minute and 120 hour hand angles (started at the
// real time by a tiny inline script), a cosine-spaced pendulum swing, the door and the owl (closed, ajar, open,
// out, calling, bowing) and the weights, which sink on their chains with the (estimated) loading progress while
// the other ends of the chains rise. src/onboard/boot.ts takes over once the app is ready (the clock is wound,
// the doors open and the owl calls; a dive into the dial, where the 3D office's own clock takes over).
//
//   node src/onboard/tools/bootart.mjs [--preview out.png]
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ colour helpers

const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
/** a ramp through key colours, n steps */
function rampOf(keys, n) { const out = []; for (let i = 0; i < n; i++) { const f = (i / (n - 1)) * (keys.length - 1), k = Math.min(keys.length - 2, Math.floor(f)); out.push(mix(hex(keys[k]), hex(keys[k + 1]), f - k)); } return out; }

// hue-shifted ramps: shadows lean cool/violet, lights lean warm/gold
const R = {
  walnut: rampOf([0x0c050a, 0x1c0a10, 0x2e1212, 0x441c14, 0x5a2818, 0x72361e, 0x8c4826, 0xa85e30, 0xc47a40, 0xe09e5a, 0xf6c886], 14),
  carve: rampOf([0x1e0a10, 0x3c1814, 0x602c16, 0x86461c, 0xa86424, 0xc6822e, 0xdea03c, 0xf0bc58, 0xfcd684, 0xfff0c0], 14),
  shingle: rampOf([0x0c0612, 0x1c0a16, 0x2e1218, 0x461c1a, 0x60281c, 0x7c3822, 0x9a4c2a, 0xb66434, 0xd2844a], 12),
  brass: rampOf([0x1a0e0a, 0x3a2210, 0x6a4414, 0x9a6c1c, 0xc4942a, 0xe2b840, 0xf6d666, 0xfff0aa, 0xffffff], 14),
  enamel: rampOf([0x7a6656, 0xa68e72, 0xcab696, 0xe2d2b2, 0xf2e6cc, 0xfcf4e2, 0xfffcf4], 10),
  steel: rampOf([0x05040c, 0x0a0c1c, 0x121a34, 0x1c2a54, 0x2e447c, 0x5070aa, 0x90b0e0, 0xe0ecff], 10),
  ink: rampOf([0x180c12, 0x2c1a1c, 0x4a3430], 3),
  dark: rampOf([0x060308, 0x10080c, 0x1c0e0e, 0x2c1812, 0x402418], 6),
  red: rampOf([0x3c0814, 0x6a101a, 0x9a1c22, 0xc8342c, 0xf0644a, 0xffa27a], 8),
  green: rampOf([0x0c2418, 0x1a4024, 0x2c6030, 0x48843a, 0x72aa48, 0xa8cc6a], 8),
  bronze: rampOf([0x0a0610, 0x1e1012, 0x341c14, 0x4e2c18, 0x6a4020, 0x8a582c, 0xaa743c, 0xc89656, 0xe6bc7c, 0xfadca8], 12),
  feather: rampOf([0x1e0a14, 0x3a1410, 0x62240e, 0x8c3812, 0xb4521a, 0xd27026, 0xe8923a, 0xf6b45a, 0xffd48a], 12),
  chest: rampOf([0x52282a, 0x8a5038, 0xb87c4c, 0xdca86a, 0xf2cc92, 0xfce6bc, 0xfff6e2], 10),
  eye: rampOf([0x5a2004, 0x9a4808, 0xd07a10, 0xf0a820, 0xffd050, 0xfff0a0], 8),
  beak: rampOf([0x4a2410, 0x8a5420, 0xc88a36, 0xecbc5e, 0xfce49a], 7),
  patina: rampOf([0x0c140c, 0x1c2a16, 0x34401e, 0x4e5a2a, 0x6a7436, 0x8a8a44], 8),
};
/** the outer outline: near-black, a touch of violet */
const OUTLINE = [16, 8, 16];

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
const pick = (ramp, t, x, y, d = 0.55) => ramp[clamp(Math.floor(t * (ramp.length - 1) + (bayer(x, y) - 0.5) * d + 0.5), 0, ramp.length - 1)];
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
  blit(src, ox, oy) { for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c) this.set(ox + x, oy + y, c, c[3]); } }
  crop(x0, y0, w, h) { const b = new Buf(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = this.get(x0 + x, y0 + y); if (c) b.set(x, y, c, c[3]); } return b; }
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

const M = { none: 0, walnut: 1, carve: 2, shingle: 3, brass: 4, enamel: 5, steel: 6, ink: 7, dark: 8, red: 9, green: 10, bronze: 11, feather: 12, chest: 13, eye: 14, beak: 15, patina: 16 };
const RAMP = [null, R.walnut, R.carve, R.shingle, R.brass, R.enamel, R.steel, R.ink, R.dark, R.red, R.green, R.bronze, R.feather, R.chest, R.eye, R.beak, R.patina];
const isWood = (m) => m === M.walnut || m === M.carve || m === M.shingle;
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

class Relief {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.m = new Uint8Array(w * h); this.hgt = new Float32Array(w * h); this.alb = new Float32Array(w * h);
    this.flat = new Uint8Array(w * h); this.gloss = new Float32Array(w * h).fill(1); this.pt = new Uint16Array(w * h);
    this.cur = 1;
  }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  /** start a new part (parts get a dark inner line where they overlap a lower part) */
  np() { this.cur++; return this; }
  put(x, y, mat, h, alb = 0, o = {}) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.in(x, y)) return;
    const i = y * this.w + x;
    this.m[i] = mat; this.hgt[i] = h; this.alb[i] = alb; this.flat[i] = o.flat ? 1 : 0; this.gloss[i] = o.gloss ?? 1; this.pt[i] = mat ? this.cur : 0;
  }
  /** fill where mask(x, y) is true; h(x, y) and alb(x, y) give height and albedo offset */
  fill(x0, y0, x1, y1, mask, mat, h, alb = () => 0, o = {}) {
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x1)); x++) {
      if (!mask(x, y)) continue;
      this.put(x, y, typeof mat === 'function' ? mat(x, y) : mat, typeof h === 'function' ? h(x, y) : h, alb(x, y), o);
    }
    return this;
  }
  mat(x, y) { return this.in(x, y) ? this.m[y * this.w + x] : 0; }
  /** Age the wood: arrises rubbed pale in places, a few nicks and fine scratches; brass dulled in its hollows. */
  wear(seed, keep = () => false) {
    const { w, h } = this;
    const hg = Float32Array.from(this.hgt), mt = Uint8Array.from(this.m);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -9 : mt[y * w + x] ? hg[y * w + x] : -9);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, m = mt[i];
      if (!m || keep(x, y)) continue;
      let drop = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) drop = Math.max(drop, hg[i] - at(x + dx, y + dy));
      const n = vnoise(x * 0.1, y * 0.1, seed), n2 = vnoise(x * 0.5, y * 0.5, seed + 3);
      if (isWood(m)) {
        if (drop > 1.2 && drop < 6 && n > 0.6) this.alb[i] += 0.04 + (n - 0.6) * 0.3;
        if (drop > 1.2 && drop < 6 && hash(x, y, seed + 5) > 0.985 && n2 > 0.55) { this.hgt[i] -= 1.4; this.alb[i] -= 0.08; }
      } else if (m === M.brass) {
        if (n > 0.66 && hash(x, y, seed + 11) > 0.6) this.alb[i] -= 0.08;
      }
    }
    for (let k = 0; k < Math.round((w * h) / 1400); k++) {
      const x0 = hash(k, 1, seed + 21) * w, y0 = hash(k, 2, seed + 21) * h, a = hash(k, 3, seed + 21) * Math.PI, len = 3 + hash(k, 4, seed + 21) * 5;
      for (let t = 0; t < len; t++) {
        const x = Math.floor(x0 + Math.cos(a) * t), y = Math.floor(y0 + Math.sin(a) * t * 0.6);
        if (!this.in(x, y) || keep(x, y) || this.m[y * w + x] !== M.walnut) continue;
        this.alb[y * w + x] += 0.07;
      }
    }
    return this;
  }
  H(x, y) { x = clamp(x, 0, this.w - 1); y = clamp(y, 0, this.h - 1); const i = y * this.w + x; return this.m[i] ? this.hgt[i] : this.hgt[i] - 4; }
  /** shade into a Buf: inner lines between parts; `outline` adds the near-black outer outline */
  render(o = {}) {
    const out = new Buf(this.w, this.h), { w } = this;
    const L = norm([-0.55, -0.72, 0.72]), Fl = norm([0.6, 0.2, 0.75]);
    const Hh = norm([L[0], L[1], L[2] + 1]);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, mat = this.m[i];
      if (!mat) continue;
      const alb = this.alb[i];
      if (this.flat[i]) { out.set(x, y, pick(RAMP[mat], clamp(0.5 + alb), x, y)); continue; }
      const gx = clamp((this.H(x + 1, y) - this.H(x - 1, y)) * 0.5, -3, 3), gy = clamp((this.H(x, y + 1) - this.H(x, y - 1)) * 0.5, -3, 3);
      const N = norm([-gx * 0.55, -gy * 0.55, 1]);
      const dif = Math.max(0, dot(N, L)), fil = Math.max(0, dot(N, Fl)) * 0.25;
      let avg = 0;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, 2], [2, -2], [-2, 2]]) avg += this.H(x + dx, y + dy);
      const occ = clamp((avg / 8 - this.hgt[i]) * 0.08, 0, 0.32);
      const spec = Math.pow(Math.max(0, dot(N, Hh)), 26) * this.gloss[i];
      const Rf = [2 * N[2] * N[0], 2 * N[2] * N[1], 2 * N[2] * N[2] - 1];
      const env = clamp(0.45 - Rf[1] * 0.55 + (Rf[0] < -0.15 && Rf[1] < -0.1 ? 0.35 : 0) - (Rf[1] > 0.35 ? 0.25 : 0), 0, 1);
      let t;
      switch (mat) {
        case M.brass: t = env * 0.5 + dif * 0.46 + spec * 0.75 + alb - occ * 1.2; break;
        case M.bronze: t = env * 0.26 + dif * 0.5 + spec * 0.7 + alb - occ; break;
        case M.patina: t = 0.2 + dif * 0.4 + alb - occ; break;
        case M.enamel: t = 0.42 + dif * 0.45 + alb - occ * 0.8 + spec * 0.2; break;
        case M.steel: t = env * 0.4 + spec * 0.9 + dif * 0.12 + alb - occ; break;
        case M.eye: t = 0.42 + dif * 0.3 + alb + spec * 0.8; break;
        case M.dark: t = 0.12 + dif * 0.25 + alb - occ + spec * 0.6; break;
        case M.red: case M.green: t = 0.36 + dif * 0.38 + alb - occ; break;
        default: t = 0.05 + dif * 0.5 + fil * 0.8 + alb - occ + spec * 0.45; break;
      }
      // the inner line: this part dips under a neighbouring, higher part (darker on the shadow side)
      let line = 0;
      for (const [dx, dy, s] of [[-1, 0, 2], [0, -1, 2], [1, 0, 1], [0, 1, 1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= this.h) continue;
        const j = Y * w + X;
        if (this.m[j] && this.pt[j] !== this.pt[i] && this.hgt[j] > this.hgt[i] + 1.2) line = Math.max(line, s);
      }
      if (line === 2) t = t * 0.28 - 0.04;
      else if (line === 1) t = t * 0.62 - 0.04;
      out.set(x, y, pick(RAMP[mat], clamp(t), x, y));
    }
    if (o.outline) outline(out);
    return out;
  }
}
/** the near-black outer outline round every opaque region (holes included) */
function outline(out) {
  const s = new Buf(out.w, out.h); s.d.set(out.d);
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    if (s.a(x, y) > 200) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => s.a(x + dx, y + dy) > 200)) out.set(x, y, OUTLINE);
  }
  return out;
}
/** a soft wall shadow: the sprite's silhouette offset down and right, two translucent steps */
function wallShadow(src, dx, dy, a1 = 105, a2 = 50) {
  const out = new Buf(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (src.a(x, y)) continue;
    if (src.a(x - dx, y - dy) > 200) out.set(x, y, [10, 4, 12], a1);
    else if (src.a(x - dx - 1, y - dy - 2) > 200 || src.a(x - dx + 1, y - dy - 1) > 200) out.set(x, y, [10, 4, 12], a2);
  }
  out.blit(src, 0, 0);
  return out;
}

/** wood grain as an albedo offset (dir 'v' vertical boards, 'h' rails) */
function grain(x, y, dir = 'v', seed = 0) {
  const u = dir === 'h' ? y : x, v = dir === 'h' ? x : y;
  const warp = (vnoise(v * 0.05, u * 0.2, seed) - 0.5) * 5;
  const band = ((((u + warp) / 2.6) % 1) + 1) % 1;
  return (fbm(u * 0.08, v * 0.025, seed + 4) - 0.5) * 0.2 + (band < 0.22 ? -0.06 : band > 0.6 && band < 0.7 ? 0.03 : 0);
}

// ------------------------------------------------------------------ carved bits

/** An oak leaf from its stalk at (ax, ay) pointing along angle a: lobed edge, a domed blade, a carved midrib and veins. */
function oakLeaf(r, ax, ay, a, len, wid, o = {}) {
  const ca = Math.cos(a), sa = Math.sin(a), ext = len + wid + 2;
  const base = o.h ?? 8, alb0 = (o.alb ?? 0) + (hash(Math.round(ax * 3), Math.round(ay * 3), Math.round(a * 10)) - 0.5) * 0.1, lobes = o.lobes ?? Math.max(2, Math.round(len / 4.5)), mat = o.mat ?? M.carve;
  const geo = (x, y) => {
    const px = x + 0.5 - ax, py = y + 0.5 - ay, u = px * ca + py * sa, v = -px * sa + py * ca;
    return { u, v, t: u / len };
  };
  const half = (t) => {
    if (t < 0.1) return 0.75;
    const env = Math.sin(Math.PI * Math.pow((t - 0.1) / 0.9, 0.72));
    return Math.max(0.6, wid * env * (0.56 + 0.44 * Math.abs(Math.sin(((t - 0.1) / 0.9) * Math.PI * lobes))));
  };
  r.np();
  r.fill(ax - ext, ay - ext, ax + ext, ay + ext, (x, y) => { const { u, v, t } = geo(x, y); return u >= -0.4 && t <= 1 && Math.abs(v) <= half(t); }, mat, (x, y) => {
    const { u, v, t } = geo(x, y), hw = half(t), q = Math.abs(v) / Math.max(0.6, hw);
    let h = base + (1 - q * q) * 1.6 + (o.curl ?? 0) * Math.sin(t * Math.PI);
    if (Math.abs(v) < 0.6 && t > 0.12 && t < 0.9) h -= 0.9; // the midrib
    const s = u - Math.abs(v) * 0.9, P = len / lobes;
    if (Math.abs(v) > 0.9 && q < 0.8 && Math.abs((((s / P) % 1) + 1) % 1 - 0.5) * P < 0.5) h -= 0.6; // veins
    return h;
  }, () => alb0);
}
/** an acorn hanging from (x, y): a stalk, a cross-hatched cup, a glossy nut */
function acorn(r, x, y, s = 1, o = {}) {
  const base = o.h ?? 8.5;
  r.np();
  r.put(x, y, M.carve, base + 0.5, -0.1);
  const cy = y + 1 + 2.2 * s, ny = cy + 2.6 * s;
  r.fill(x - 4 * s, ny - 4 * s, x + 4 * s + 1, ny + 4 * s, (X, Y) => ((X + 0.5 - x - 0.5) / (2.1 * s)) ** 2 + ((Y + 0.5 - ny) / (2.9 * s)) ** 2 < 1, M.carve, (X, Y) => base + 2.2 * Math.sqrt(Math.max(0, 1 - ((X + 0.5 - x - 0.5) / (2.1 * s)) ** 2 - ((Y + 0.5 - ny) / (2.9 * s)) ** 2)), () => 0.1, { gloss: 1.6 });
  r.np();
  r.fill(x - 4 * s, cy - 3 * s, x + 4 * s + 1, cy + 2 * s, (X, Y) => { const dx = (X + 0.5 - x - 0.5) / (2.7 * s), dy = (Y + 0.5 - cy) / (2.2 * s); return dx * dx + dy * dy < 1 && Y + 0.5 < cy + 1.4 * s; }, M.carve, (X, Y) => base + 2.6 + ((X + Y) & 1 ? -0.35 : 0.2), (X, Y) => -0.2 + ((X + Y) & 1 ? -0.06 : 0.04), { gloss: 0.3 });
}

// ------------------------------------------------------------------ the clock: geometry (art px, y down)

const W = 176, CX = 88;
const RIDGE = 31, SL = 0.62, ROOF_T = 12.6, BARGE = 7, EAVE = 86;   // the roof: outer top at the ridge, pitch, bands, half span
const rt = (x) => RIDGE + Math.abs(x + 0.5 - CX) * SL;           // the roof's outer top over column x
const CASE = { hw: 62, y0: 103, y1: 206 };
const CORN = { hw: 66, y0: 97, y1: 103 };
const BOT = { hw: 66, y0: 206, y1: 211 };
const APR = { hw: 54, y0: 211, y1: 227 };
const DY = 155, RD = 33;                                          // the dial: centre (a pixel corner), enamel radius
const DOOR = { r: 11, ay: 69, y1: 89 };                           // the arched door: arch centre height, sill
const BAL = { y: 89, hw: 25 };                                    // the balcony deck
const H = 228;                                                    // the case painting: crest to apron
const GHW = 64;                                                   // the gable's half width
/** signed distance (px) to the door opening: < 0 inside */
const sdDoor = (x, y) => (y + 0.5 < DOOR.ay ? dist(x, y, CX, DOOR.ay) - DOOR.r : Math.max(Math.abs(x + 0.5 - CX) - DOOR.r, y + 0.5 - DOOR.y1));
const gableTop = (x) => rt(x) + ROOF_T + BARGE - 1;
// the pendulum and the weights
const PIVOT = { x: CX, y: 196 }, LEAF = { len: 26, wid: 8.6, at: 54 }; // the leaf's stalk sits `at` px below the pivot
const PEND_N = 11, PEND_A = 0.15;
const WT_TRAVEL = 58;                                             // how far the weights sink while loading (art px)
const CONE = { w: 17, h: 34 };                                    // the cone sprite (shadow included)
const RING = { w: 9, h: 10 };
const WEIGHTS = [{ x: CX - 31, y: 229 }, { x: CX + 31, y: 236 }]; // chain centre x, cone sprite top at the start
const RINGS = [{ x: CX - 45, y: 296 }, { x: CX + 45, y: 288 }];   // ring sprite top at the start (they rise)
const SH = Math.max(...WEIGHTS.map((w) => w.y + WT_TRAVEL + CONE.h)) + 2; // the stage: clock, pendulum, weights

/** tiny Roman numerals, 7 px tall, with joined serifs */
const ROM = {
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  V: ['##.##', '.#.#.', '.#.#.', '.#.#.', '.#.#.', '..#..', '..#..'],
  X: ['##.##', '.#.#.', '.#.#.', '..#..', '.#.#.', '.#.#.', '##.##'],
};
const NUMS = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

/** Pip, the owl behind the door: tawny barred feathers, pale facial discs, amber eyes. `pose`: peek|out|call|bow */
function paintOwl(r, cx, foot, pose) {
  const dim = pose === 'peek' ? -0.3 : 0, s = pose === 'peek' ? 0.86 : 1;
  const clip = pose === 'peek' ? (x, y) => sdDoor(x, y) < -0.5 : () => true;
  const headUp = pose === 'call' ? 2 : pose === 'bow' ? -3 : 0;
  const by = foot - 10.5 * s, bry = 10.5 * s, brx = 9.6 * s;
  const hx = cx, hy = foot - 20.5 * s - headUp, hr = 8.2 * s;
  // the wings flare on the call
  if (pose === 'call') for (const sx of [-1, 1]) {
    r.np();
    r.fill(cx - 14, by - 6, cx + 15, by + 6, (x, y) => { const u = (x + 0.5 - cx) * sx, v = y + 0.5 - (by - 2); return u > 6 && u < 12.6 && v > -4 + (u - 6) * 0.35 && v < 5 - (u - 6) * 0.5; }, M.feather, 9, (x, y) => dim - 0.05 + ((y + (x >> 1)) % 3 === 0 ? -0.14 : 0));
  }
  // the body: a soft egg, barred wings on the sides, a pale streaked chest
  r.np();
  r.fill(cx - brx - 1, by - bry - 1, cx + brx + 1, by + bry + 1, (x, y) => clip(x, y) && ((x + 0.5 - cx) / brx) ** 2 + ((y + 0.5 - by) / bry) ** 2 < 1, (x, y) => (Math.abs(x + 0.5 - cx) < brx * 0.45 && y + 0.5 > by - bry * 0.4 ? M.chest : M.feather), (x, y) => {
    const q = ((x + 0.5 - cx) / brx) ** 2 + ((y + 0.5 - by) / bry) ** 2;
    return 8 + Math.sqrt(Math.max(0, 1 - q)) * 3.4 + (Math.abs(x + 0.5 - cx) > brx * 0.6 ? 0.9 : 0);
  }, (x, y) => {
    const ax = Math.abs(x + 0.5 - cx);
    if (ax < brx * 0.45 && y + 0.5 > by - bry * 0.4) return dim - 0.06 + ((x * 5 + Math.floor((y + 1) / 3) * 3) % 4 === 0 && (y % 3) === 1 ? -0.22 : 0);
    return dim + ((y + (x >> 1)) % 3 === 0 ? -0.14 : 0) + (vnoise(x * 0.5, y * 0.5, 71) - 0.5) * 0.1;
  });
  // feet
  if (pose !== 'peek') for (const sx of [-1, 1]) { r.np(); for (let k = -1; k <= 1; k++) r.put(cx + sx * 3 + k, foot - 1, M.beak, 10.5, 0); }
  // the head: ear tufts, round head, two pale facial discs, amber eyes, a hooked beak
  r.np();
  for (const sx of [-1, 1]) r.fill(hx - 10, hy - 12, hx + 11, hy - 3, (x, y) => { const u = (x + 0.5 - hx) * sx, v = y + 0.5 - (hy - hr + 1); return clip(x, y) && u > 2.5 * s && u < 7.5 * s && v < 2 && v > -3.4 * s + (7.5 * s - u) * 0.15 - (u - 2.5 * s) * 0.55; }, M.feather, 9.5, () => dim - 0.12);
  r.np();
  r.fill(hx - hr - 1, hy - hr - 1, hx + hr + 1, hy + hr + 1, (x, y) => clip(x, y) && dist(x, y, hx, hy) < hr, M.feather, (x, y) => 9.5 + Math.sqrt(Math.max(0, 1 - (dist(x, y, hx, hy) / hr) ** 2)) * 3, (x, y) => dim + ((x + 2 * y) % 5 === 0 ? -0.1 : 0) + (y + 0.5 < hy - hr * 0.5 ? 0.04 : 0));
  for (const sx of [-1, 1]) {
    const ex = hx + sx * 3.5 * s, ey = hy + 0.6 * s, dr = 3.9 * s;
    r.np();
    r.fill(ex - 5, ey - 5, ex + 5, ey + 5, (x, y) => clip(x, y) && dist(x, y, ex, ey) < dr, (x, y) => (dist(x, y, ex, ey) > dr - 0.9 ? M.feather : M.chest), (x, y) => 11.6 - dist(x, y, ex, ey) * 0.15, (x, y) => dim + (dist(x, y, ex, ey) > dr - 0.9 ? -0.24 : -0.12));
    if (pose === 'bow') {
      // closed, happy eyes: a dark little arch
      for (let k = -1; k <= 1; k++) r.put(ex + k - 0.5, ey - (k === 0 ? 1 : 0), M.dark, 12, 0.1);
    } else {
      const er = (pose === 'call' ? 2.5 : 2.2) * s;
      r.np();
      r.fill(ex - 3, ey - 3, ex + 3, ey + 3, (x, y) => clip(x, y) && dist(x, y, ex, ey) < er, M.eye, 12.2, (x, y) => dim + (y + 0.5 < ey ? 0.15 : -0.05));
      r.fill(ex - 2, ey - 2, ex + 2, ey + 2, (x, y) => clip(x, y) && dist(x, y, ex, ey) < er * 0.55, M.dark, 12.3, () => -0.1);
      r.put(ex - 1, ey - 2, M.enamel, 12.5, 0.6, { flat: true });
    }
  }
  // Pip's blue bow tie, as he wears it in the office
  if (pose !== 'peek') {
    const ty = foot - 13 + (pose === 'bow' ? 2 : 0);
    r.np();
    r.fill(cx - 5, ty - 2, cx + 5, ty + 3, (x, y) => { const u = Math.abs(x + 0.5 - cx), v = Math.abs(y + 0.5 - ty - 0.5); return u < 1 ? v < 1.2 : u < 4.2 && v < 0.6 + u * 0.42; }, M.steel, (x) => 12.4 - Math.abs(x + 0.5 - cx) * 0.1 + (Math.abs(x + 0.5 - cx) < 1 ? 0.6 : 0), (x, y) => 0.35 + (y + 0.5 < ty + 0.5 ? 0.12 : -0.06));
  }
  // the brow between the eyes, the beak (open on the call)
  r.np();
  r.put(hx - 1, hy - 2 * s, M.feather, 12, dim - 0.2); r.put(hx, hy - 2 * s, M.feather, 12, dim - 0.2);
  const bk = hy + 2 * s;
  if (pose === 'call') {
    r.np();
    r.fill(hx - 2, bk - 1, hx + 2, bk + 1, (x, y) => Math.abs(x + 0.5 - hx) < (y === Math.floor(bk - 1) ? 1.6 : 1.1), M.beak, 12.6, () => 0.05);
    r.fill(hx - 2, bk + 1, hx + 2, bk + 3, (x) => Math.abs(x + 0.5 - hx) < 1.6, M.red, 12.1, () => -0.25);
    r.fill(hx - 2, bk + 3, hx + 2, bk + 4, (x) => Math.abs(x + 0.5 - hx) < 1.1, M.beak, 12.4, () => -0.1);
  } else {
    r.np();
    r.fill(hx - 2, bk, hx + 2, bk + 3, (x, y) => clip(x, y) && Math.abs(x + 0.5 - hx) < (y - Math.floor(bk) === 0 ? 1.6 : y - Math.floor(bk) === 1 ? 1.1 : 0.6), M.beak, 12.6, () => dim);
  }
}

/**
 * The whole case as one relief. `v` is the door's state: { door: 0 closed | 1 ajar | 2 open, owl: null|peek|out|call|bow }.
 */
function paintCase(v = { door: 0, owl: null }) {
  const r = new Relief(W, H);
  const ink = (x, y) => r.put(x, y, M.ink, 8.5, 0, { flat: true });

  // ---- the gable: vertical walnut boards under the roof
  r.np();
  r.fill(CX - GHW, 40, CX + GHW, CORN.y0, (x, y) => y >= gableTop(x), M.walnut, (x) => (((x - CX + 64) % 8) === 0 ? 3.4 : 4), (x, y) => grain(x, y, 'v', 3) + (((x - CX + 64) % 8) === 0 ? -0.16 : 0));
  // little carved sprigs either side of the door: two leaves and an acorn
  for (const sx of [-1, 1]) {
    oakLeaf(r, CX + sx * 24, 86, -Math.PI / 2 - sx * 0.35, 13, 4.2, { h: 6.5 });
    oakLeaf(r, CX + sx * 24, 86, -Math.PI / 2 + sx * 0.75, 10, 3.6, { h: 6 });
    acorn(r, CX + sx * 30 - 0.5, 77, 0.8, { h: 6.5 });
  }

  // ---- the door: its carved arch frame, the doors (closed, ajar or open) and the dark inside
  r.np();
  r.fill(CX - 16, 50, CX + 16, DOOR.y1 + 1, (x, y) => { const d = sdDoor(x, y); return d >= 0 && d < 3 && y < DOOR.y1; }, M.carve, (x, y) => [7.6, 8.6, 7.8][Math.min(2, Math.floor(sdDoor(x, y)))], () => 0);
  r.np();
  if (v.door === 0) {
    for (const sx of [-1, 1]) r.fill(CX - 12, 55, CX + 12, DOOR.y1, (x, y) => sdDoor(x, y) < 0 && (x + 0.5 - CX) * sx > 0, M.walnut, (x, y) => {
      const e = -sdDoor(x, y), mid = Math.abs(x + 0.5 - CX);
      return 5 + Math.min(1, e * 0.5) + (mid < 1 ? -0.6 : 0) + (Math.abs(Math.abs(x + 0.5 - CX - sx * 5.5) + Math.abs(y + 0.5 - 76) * 0.6 - 2.6) < 0.6 ? 0.7 : 0);
    }, (x, y) => 0.1 + grain(x, y, 'v', 5) * 0.8);
    r.np(); r.put(CX - 2, 79, M.brass, 7.5); r.put(CX + 1, 79, M.brass, 7.5);
  } else {
    // the dark inside: a back wall, a perch
    r.fill(CX - 12, 55, CX + 12, DOOR.y1, (x, y) => sdDoor(x, y) < 0, M.dark, (x, y) => 1 + (y + 0.5 - DOOR.ay) * 0.03, (x, y) => (y > DOOR.y1 - 4 ? 0.12 : 0) + (dist(x, y, CX, DOOR.ay) < 7 ? -0.08 : 0));
    // the doors: ajar (turned out to the viewer, narrowed) or open (standing out either side of the arch)
    const open = v.door === 2, wd = open ? 6.3 : 5.5;
    for (const sx of [-1, 1]) {
      r.np();
      const x0 = open ? CX + sx * DOOR.r : CX + sx * DOOR.r, x1 = x0 + (open ? sx * wd : -sx * wd);
      const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
      // inner face when open (left leaf in shade, right leaf lit), outer face when ajar
      const lit = open ? sx > 0 : sx < 0;
      r.fill(lo - 1, 54, hi + 1, DOOR.y1 + 1, (x, y) => {
        const X = x + 0.5;
        if (X < lo || X > hi) return false;
        // the arch top foreshortened with the leaf
        const f = Math.abs(X - x0) / wd, topY = DOOR.ay - Math.sqrt(Math.max(0, 1 - (1 - f) ** 2)) * DOOR.r * 0.98;
        return y + 0.5 > (open ? DOOR.ay - DOOR.r * 0.9 + f * 2 : topY) && y < DOOR.y1 + (open ? 1 : 0);
      }, M.walnut, () => (open ? 10.5 : 7), (x, y) => (lit ? 0.16 : -0.12) + grain(x, y, 'v', 9) * 0.6 + (Math.abs(x + 0.5 - x1) < 1 ? 0.08 : 0));
    }
  }
  if (v.owl) paintOwl(r, CX, v.owl === 'peek' ? DOOR.y1 + 3 : BAL.y, v.owl);

  // ---- the roof: a band of fish-scale shingles, a ridge cap, a scalloped carved bargeboard
  const shingle = (x, y) => {
    const v0 = y + 0.5 - rt(x);
    // fish scales laid in screen space (the roof face, as a painter would show it), mirrored about the ridge
    const X = Math.abs(x + 0.5 - CX), row = Math.floor((y + 0.5) / 4.4), fy = (y + 0.5) / 4.4 - row, col = (X + (row & 1) * 3.5) / 7, fx = col - Math.floor(col);
    const e = fy < 0.42 ? 0 : (2 * fx - 1) ** 2 + ((fy - 0.42) / 0.58) ** 2, inTab = e < 1;
    return { v0, row, fy, fx, inTab, edge: inTab && (e > 0.6 || fx < 0.08 || fx > 0.92), id: Math.floor(col) * 7 + row * 131 + (x < CX ? 977 : 0) };
  };
  r.np();
  r.fill(CX - EAVE, RIDGE - 1, CX + EAVE, RIDGE + EAVE * SL + ROOF_T + 1, (x, y) => { const v0 = y + 0.5 - rt(x); return Math.abs(x + 0.5 - CX) <= EAVE && v0 >= 0 && v0 < ROOF_T; }, M.shingle, (x, y) => {
    const s = shingle(x, y);
    if (s.v0 < 1.6) return 11.4; // the ridge cap
    let h = s.inTab ? 8.6 + s.fy * 1.6 - (s.edge ? 0.5 : 0) : 6.4;
    if (Math.abs(x + 0.5 - CX) > EAVE - 1.5) h -= 1.2;
    return h;
  }, (x, y) => {
    const s = shingle(x, y);
    if (s.v0 < 1.6) return 0.06 + grain(x, y, 'h', 15) * 0.5;
    if (!s.inTab) return -0.2;
    return (hash(s.id, 3, 17) - 0.5) * 0.2 + (s.edge ? -0.14 : s.fx < 0.45 && s.fy < 0.6 ? 0.07 : 0) + (vnoise(x * 0.3, y * 0.3, 18) - 0.5) * 0.06;
  });
  const barge = (x, y) => { const u = Math.abs(x + 0.5 - CX), v2 = y + 0.5 - rt(x) - ROOF_T, ph = ((((u * 1.18) - 2) / 7.4) % 1 + 1) % 1; return { u, v2, ph }; };
  r.np();
  r.fill(CX - EAVE, RIDGE + ROOF_T - 1, CX + EAVE, RIDGE + EAVE * SL + ROOF_T + BARGE + 1, (x, y) => {
    const { u, v2, ph } = barge(x, y);
    if (u > EAVE - 1 || v2 < 0) return false;
    return v2 < 3.6 || v2 < 3.6 + 3.6 * Math.sqrt(Math.max(0, 1 - ((ph - 0.5) / 0.5) ** 2));
  }, M.carve, (x, y) => {
    const { v2, ph } = barge(x, y);
    if (v2 < 1.3) return 9.8;
    if (v2 > 4.2 && v2 < 6.2 && Math.abs(ph - 0.5) < 0.14) return 4.6; // a drilled hole in each scallop
    if (v2 < 3.6 && v2 > 1.3 && (ph < 0.07 || ph > 0.93)) return 7.4; // a notch over each join
    return 8.6;
  }, () => 0);
  // the drop finial under the apex
  r.np();
  r.fill(CX - 3, RIDGE + ROOF_T + BARGE - 3, CX + 3, RIDGE + ROOF_T + BARGE + 7, (x, y) => { const t = y + 0.5 - (RIDGE + ROOF_T + BARGE - 2.5); return Math.abs(x + 0.5 - CX) < [1.2, 2.2, 2.4, 1.3, 2.1, 1.4, 0.7, 0, 0][Math.max(0, Math.min(8, Math.floor(t)))]; }, M.carve, (x) => 9.6 - Math.abs(x + 0.5 - CX) * 0.5);
  // carved oak leaves and an acorn hang from both eaves
  for (const sx of [-1, 1]) {
    const ex = CX + sx * (EAVE - 4), ey = Math.round(rt(ex) + ROOF_T + BARGE - 1);
    oakLeaf(r, ex, ey - 1, Math.PI / 2 + sx * 0.12, 15, 4.6, { h: 9 });
    acorn(r, ex - sx * 6, ey - 1, 0.85, { h: 9.5 });
  }

  // ---- the crest: a carved owl on the ridge, on a fan of oak leaves with two acorns
  const OC = { x: CX, y: 21 }, ORX = 9.6, ORY = 11.6;
  for (const [a, len, wd] of [[-Math.PI + 0.1, 24, 7], [-0.1, 24, 7], [-Math.PI / 2 - 0.95, 26, 7.8], [-Math.PI / 2 + 0.95, 26, 7.8]]) oakLeaf(r, OC.x, 31, a, len, wd, { h: 8.2, curl: 0.5 });
  for (const sx of [-1, 1]) acorn(r, CX + sx * 15 - 0.5, 26, 1.05, { h: 10 });
  // the ridge block the owl grips
  r.np();
  r.fill(CX - 8, 29, CX + 8, 37, (x, y) => Math.abs(x + 0.5 - CX) < 7.5 - (y - 29) * 0.45, M.carve, (x, y) => 10.4 - (y - 29) * 0.2, (x, y) => grain(x, y, 'h', 21) * 0.6 - 0.05);
  // the carved owl: a domed body with a scalloped chest, carved wings, ear tufts, ringed facial discs with glass
  // eyes, a hooked beak, toes over the ridge block
  const owlH = (x, y) => 11 + Math.sqrt(Math.max(0, 1 - ((x + 0.5 - OC.x) / ORX) ** 2 - ((y + 0.5 - OC.y) / ORY) ** 2)) * 3.6;
  r.np();
  r.fill(OC.x - 11, 8, OC.x + 11, 34, (x, y) => ((x + 0.5 - OC.x) / ORX) ** 2 + ((y + 0.5 - OC.y) / ORY) ** 2 < 1, M.carve, (x, y) => owlH(x, y) - (Math.abs(x + 0.5 - OC.x) < 4.6 && y > 22 && (y % 3) === 0 && ((x + (y / 3 | 0)) % 2 === 0) ? 0.7 : 0), () => 0.06);
  for (const sx of [-1, 1]) {
    // the wing: a raised blade down the side with three feather grooves
    r.np();
    r.fill(OC.x - 11, 17, OC.x + 11, 34, (x, y) => { const u = (x + 0.5 - OC.x) * sx, v = y + 0.5 - OC.y; return ((x + 0.5 - OC.x) / ORX) ** 2 + ((y + 0.5 - OC.y) / ORY) ** 2 < 1.02 && u > 4.4 + Math.max(0, 6 - v) * 0.25 && v > -1.5; }, M.carve, (x, y) => owlH(x, y) + 1.2 - ((y + 0.5 - OC.y + (x + 0.5 - OC.x) * sx * 0.5) % 3.2 < 0.9 ? 0.8 : 0), () => -0.04);
    r.np();
    r.fill(OC.x + sx * 7 - 4, 4, OC.x + sx * 7 + 4, 13, (x, y) => { const u = (x + 0.5 - OC.x) * sx, v = y + 0.5 - 12; return u > 3 && u < 8.6 && v < 0.5 && v > -1 - (u - 3) * 0.95; }, M.carve, 14.2, () => -0.04);
    const ex = OC.x + sx * 4, ey = 16;
    r.np();
    r.fill(ex - 5, ey - 5, ex + 5, ey + 5, (x, y) => dist(x, y, ex, ey) < 4.4 && dist(x, y, ex, ey) >= 3.3, M.carve, (x, y) => owlH(x, y) + 0.7, () => 0.1);
    r.np();
    r.fill(ex - 4, ey - 4, ex + 4, ey + 4, (x, y) => dist(x, y, ex, ey) < 3.3, M.carve, (x, y) => owlH(x, y) - 0.5, () => -0.02);
    r.np();
    r.fill(ex - 2, ey - 2, ex + 2, ey + 2, (x, y) => dist(x, y, ex, ey) < 2.1, M.dark, (x, y) => owlH(x, y) + 0.2, () => 0, { gloss: 2 });
    r.put(ex - 1, ey - 1, M.enamel, 16, 0.35, { flat: true });
    r.np(); for (let k = -1; k <= 1; k++) r.put(OC.x + sx * 3 + k, 32, M.carve, 12.6, 0.06);
  }
  r.np();
  r.fill(OC.x - 2, 18, OC.x + 2, 23, (x, y) => Math.abs(x + 0.5 - OC.x) < (y === 18 ? 1.6 : y === 19 ? 1.3 : y === 20 ? 0.9 : 0.5), M.carve, 17, () => 0.02);

  // ---- the case: walnut boards in a carved bead frame; the cornice with dentils; the base moulding
  r.np();
  r.fill(CX - CASE.hw, CASE.y0, CX + CASE.hw, CASE.y1, () => true, M.walnut, 5, (x, y) => grain(x, y, 'v', 7) - 0.04);
  r.np();
  r.fill(CX - CASE.hw, CASE.y0, CX + CASE.hw, CASE.y1, (x, y) => { const e = Math.min(x + 0.5 - (CX - CASE.hw), CX + CASE.hw - x - 0.5, y + 0.5 - CASE.y0, CASE.y1 - y - 0.5); return e > 1.4 && e < 3.6; }, M.carve, (x, y) => { const e = Math.min(x + 0.5 - (CX - CASE.hw), CX + CASE.hw - x - 0.5, y + 0.5 - CASE.y0, CASE.y1 - y - 0.5); return 6.4 + (1 - Math.abs(e - 2.5)) * 0.9 - (((x + y) % 4) === 0 ? 0.5 : 0); }, () => 0);
  const cornProf = [8.6, 10, 10.6, 9.4, 9.8, 8.4];
  r.np();
  r.fill(CX - CORN.hw, CORN.y0, CX + CORN.hw, CORN.y1, (x, y) => Math.abs(x + 0.5 - CX) < CORN.hw - (y === CORN.y0 ? 1 : 0), M.walnut, (x, y) => cornProf[y - CORN.y0] - (Math.abs(x + 0.5 - CX) > CORN.hw - 1.5 ? 1 : 0), (x, y) => grain(x, y, 'h', 11) - 0.08);
  r.np();
  r.fill(CX - CORN.hw + 2, CORN.y0 + 3, CX + CORN.hw - 2, CORN.y0 + 5, (x) => ((x - CX + 66) % 4) < 2, M.carve, 10.8, () => 0);
  const botProf = [8.4, 9.8, 10.4, 9.6, 8.2];
  r.np();
  r.fill(CX - BOT.hw, BOT.y0, CX + BOT.hw, BOT.y1, (x, y) => Math.abs(x + 0.5 - CX) < BOT.hw - (y === BOT.y1 - 1 ? 1 : 0), M.walnut, (x, y) => botProf[y - BOT.y0], (x, y) => grain(x, y, 'h', 13) - 0.06);
  r.np();
  r.fill(CX - BOT.hw + 1, BOT.y0 + 2, CX + BOT.hw - 1, BOT.y0 + 3, () => true, M.carve, 10.9, (x) => ((x & 3) === 0 ? -0.15 : 0.02));

  // ---- the balcony: a deck on two little corbels, turned balusters, end posts with knobs, a rail
  r.np();
  for (const sx of [-1, 1]) r.fill(CX + sx * 19 - 3, BAL.y + 2, CX + sx * 19 + 3, CORN.y0 + 2, (x, y) => { const t = y + 0.5 - (BAL.y + 2); return Math.abs(x + 0.5 - CX - sx * 19) < 2.4 - t * 0.28; }, M.carve, 10.6, () => -0.04);
  r.np();
  r.fill(CX - BAL.hw, BAL.y, CX + BAL.hw, BAL.y + 3, () => true, M.carve, (x, y) => [12.4, 12, 11.2][y - BAL.y], (x, y) => grain(x, y, 'h', 23) * 0.5);
  const balProf = [0.7, 1.45, 1.5, 0.7, 1.15, 1.5, 0.9];
  for (const bx of [-17, -11, -5, 5, 11, 17]) {
    r.np();
    r.fill(CX + bx - 2, 82, CX + bx + 2, BAL.y, (x, y) => Math.abs(x + 0.5 - CX - bx) < balProf[y - 82], M.carve, (x) => 11.6 + (1.5 - Math.abs(x + 0.5 - CX - bx)) * 0.7);
  }
  for (const sx of [-1, 1]) {
    r.np();
    r.fill(CX + sx * 23 - 2, 78, CX + sx * 23 + 2, BAL.y, (x) => Math.abs(x + 0.5 - CX - sx * 23) < 1.6, M.carve, (x) => 12.6 + (1.6 - Math.abs(x + 0.5 - CX - sx * 23)) * 0.6);
    r.np();
    r.fill(CX + sx * 23 - 3, 74, CX + sx * 23 + 3, 79, (x, y) => dist(x, y, CX + sx * 23, 76.5) < 2.2, M.carve, (x, y) => 13 + (2.2 - dist(x, y, CX + sx * 23, 76.5)));
  }
  r.np();
  r.fill(CX - 22, 79, CX + 22, 82, (x, y) => y < 81 || Math.abs(x + 0.5 - CX) < 21, M.carve, (x, y) => [13, 12.4, 11.6][y - 79], () => 0.02);

  // ---- the dial: a beaded brass bezel, cream enamel, a painted minute track, numerals, a rosette and a crescent
  r.np();
  r.fill(CX - RD - 4, DY - RD - 4, CX + RD + 4, DY + RD + 4, (x, y) => { const d = dist(x, y, CX, DY); return d >= RD && d < RD + 3.6; }, M.brass, (x, y) => { const d = dist(x, y, CX, DY) - RD; return 8 + Math.sin(d / 3.6 * Math.PI) * 1.7 + (Math.abs(d - 1.8) < 0.7 && (Math.floor(Math.atan2(y + 0.5 - DY, x + 0.5 - CX) * 18) & 1) ? 0.6 : 0); });
  r.np();
  r.fill(CX - RD, DY - RD, CX + RD, DY + RD, (x, y) => dist(x, y, CX, DY) < RD, M.enamel, (x, y) => { const d = dist(x, y, CX, DY) / RD; return 7.2 + 1.6 * (1 - d * d); }, (x, y) => {
    const d = dist(x, y, CX, DY);
    let a = (vnoise(x * 0.15, y * 0.15, 61) - 0.5) * 0.06;
    if (Math.abs(vnoise(x * 0.3, y * 0.3, 62) - 0.5) < 0.012 && hash(x, y, 63) > 0.45) a -= 0.13;
    if (d > RD - 1.2) a -= 0.14;
    return a - Math.pow(d / RD, 5) * 0.07;
  });
  for (let y = DY - RD; y < DY + RD; y++) for (let x = CX - RD; x < CX + RD; x++) {
    const d = dist(x, y, CX, DY);
    if (Math.abs(d - 31.4) < 0.5 || Math.abs(d - 28.4) < 0.5) ink(x, y);
  }
  for (let m = 0; m < 60; m++) {
    const a = (m / 60) * Math.PI * 2 - Math.PI / 2;
    if (m % 5 === 0) for (let rr = 28.6; rr < 31.4; rr += 0.25) ink(Math.floor(CX + Math.cos(a) * rr), Math.floor(DY + Math.sin(a) * rr));
    else ink(Math.floor(CX + Math.cos(a) * 29.9), Math.floor(DY + Math.sin(a) * 29.9));
  }
  NUMS.forEach((s, h) => {
    const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
    const glyphs = [...s].map((c) => ROM[c]);
    const w = glyphs.reduce((acc, g) => acc + g[0].length, 0);
    // as far out as the numeral's box fits inside the track
    let rr = 26;
    for (; rr > 14; rr -= 0.25) {
      const x0 = CX + Math.cos(a) * rr - w / 2, y0 = DY + Math.sin(a) * rr - 3.5;
      if ([[x0, y0], [x0 + w, y0], [x0, y0 + 7], [x0 + w, y0 + 7]].every(([px, py]) => Math.hypot(px - CX, py - DY) < 27.6)) break;
    }
    let xx = Math.round(CX + Math.cos(a) * rr - w / 2);
    const y0 = Math.round(DY + Math.sin(a) * rr - 3.5);
    for (const g of glyphs) { g.forEach((row, yy) => [...row].forEach((ch, k) => { if (ch === '#') ink(xx + k, y0 + yy); })); xx += g[0].length; }
  });
  // a red-and-gold rosette at the arbor, the maker's little red heart
  r.np();
  r.fill(CX - 6, DY - 6, CX + 6, DY + 6, (x, y) => { const d = dist(x, y, CX, DY), a = Math.atan2(y + 0.5 - DY, x + 0.5 - CX); return d < 3.2 + Math.cos(a * 6) * 1.4 + 0.6; }, (x, y) => (dist(x, y, CX, DY) < 2 ? M.brass : M.red), 9, (x, y) => (dist(x, y, CX, DY) < 2 ? 0.1 : 0.05));
  ['.#.#.', '#####', '#####', '.###.', '..#..'].forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') r.put(CX - 2 + x, DY + 10 + y, M.red, 9, x === 1 && y === 1 ? 0.3 : 0.08, { flat: true }); }));

  // ---- the wreath: carved oak leaves and acorns round the dial, filling the corners
  // a garland of leaves all round the bezel, clusters with acorns in the corners, acorn pairs at the sides
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2 + 0.12, sx = CX + Math.cos(a) * 39.5, sy = DY + Math.sin(a) * 39.5;
    oakLeaf(r, sx, sy, a + Math.PI / 2 - 0.32, 14, 4.8, { h: 9 + (k % 2) * 0.7 });
  }
  for (const [qx, qy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const ox = CX + qx * 41, oy = DY + qy * 33, a = Math.atan2(qy * 0.9, qx);
    oakLeaf(r, ox, oy, a - 0.95, 14, 5, { h: 10.4 });
    oakLeaf(r, ox, oy, a + 0.95, 14, 5, { h: 10.4 });
    oakLeaf(r, ox, oy, a, 19, 6, { h: 11.2, curl: 0.6 });
    acorn(r, ox - qx * 5 + (qx > 0 ? -1 : 0), oy + (qy < 0 ? 4 : -9), 0.95, { h: 12.4 });
    acorn(r, ox + qx * 1 + (qx > 0 ? -1 : 0), oy + (qy < 0 ? 6 : -7), 0.85, { h: 12.8 });
  }
  for (const sx of [-1, 1]) { acorn(r, CX + sx * 52 - 0.5, 143, 1, { h: 10 }); acorn(r, CX + sx * 52 - 0.5, 156, 1, { h: 10 }); }

  // ---- the apron: pierced fretwork with a big scallop under the middle
  r.np();
  r.fill(CX - APR.hw, APR.y0, CX + APR.hw, APR.y1, (x, y) => {
    const u = Math.abs(x + 0.5 - CX), v0 = y + 0.5 - APR.y0;
    if (u > APR.hw - v0 * 0.6) return false;
    const bottom = u < 18 ? 16 - (u / 18) ** 2 * 7 : 9 - Math.abs(Math.sin(((u - 18) / 36) * Math.PI * 2.5)) * 4;
    if (v0 > bottom) return false;
    // the piercings: a row of round holes and teardrops
    if (dist(x, y, CX, APR.y0 + 7.5) < 2.2) return false;
    for (const hx of [11, 22, 33, 44]) if (u > hx - 2.5 && u < hx + 2.5 && dist(Math.abs(x + 0.5 - CX) - 0.5 + CX, y, CX + hx, APR.y0 + 4.5) < 1.6) return false;
    return true;
  }, M.carve, (x, y) => 7 + (y + 0.5 - APR.y0 < 1.5 ? 1 : 0), (x, y) => grain(x, y, 'h', 31) * 0.5);
  return r;
}

const keepDial = (x, y) => dist(x, y, CX, DY) < RD + 4;

// ------------------------------------------------------------------ moving parts

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
// pierced Gothic hands in blued steel (hand space: +y from the centre towards the tip); `holes` are pierced through
const MINUTE = {
  parts: [{ poly: [[-0.9, -6], [0.9, -6], [0.6, 20], [-0.6, 20]] }, { poly: [[0, 18], [2.8, 22.4], [0, 29.4], [-2.8, 22.4]] }, { c: [0, -6.6], r: 2.1 }],
  holes: [{ poly: [[0, 20.4], [1.1, 22.4], [0, 25], [-1.1, 22.4]] }, { c: [0, -6.6], r: 0.9 }],
};
const HOUR = {
  parts: [{ poly: [[-1.2, -5], [1.2, -5], [0.9, 9], [-0.9, 9]] }, { poly: [[0, 7.5], [3.9, 10.5], [3.6, 14], [1.2, 15.6], [0, 20.4], [-1.2, 15.6], [-3.6, 14], [-3.9, 10.5]] }, { c: [0, -5.6], r: 2.4 }],
  holes: [{ poly: [[0, 10], [1.6, 11.6], [0, 14], [-1.6, 11.6]] }, { c: [0, -5.6], r: 1 }],
};
const FR = 62;
const inShape = (s, hx, hy) => s.some((p) => (p.poly ? inPoly(hx, hy, p.poly) : Math.hypot(hx - p.c[0], hy - p.c[1]) < p.r));
/** rasterise a hand at an angle: bevelled (the edge toward the lamp bright), a glint along the top */
function handFrame(hand, ang) {
  const b = new Buf(FR, FR), c = FR / 2, ca = Math.cos(ang), sa = Math.sin(ang);
  const inside = (px, py) => { const hx = px * ca + py * sa, hy = -(-px * sa + py * ca); return inShape(hand.parts, hx, hy) && !inShape(hand.holes, hx, hy); };
  for (let y = 0; y < FR; y++) for (let x = 0; x < FR; x++) {
    const px = x + 0.5 - c, py = y + 0.5 - c;
    if (!inside(px, py)) continue;
    const tl = !inside(px - 1, py) || !inside(px, py - 1), br = !inside(px + 1, py) || !inside(px, py + 1);
    let t = 0.2 + (tl && !br ? 0.36 : br && !tl ? -0.14 : 0);
    if (!tl && !br) t += 0.05;
    b.set(x, y, pick(R.steel, clamp(t), x, y, 0.4));
  }
  return b;
}
function handStrip(hand, n) {
  const strip = new Buf(FR * n, FR);
  for (let i = 0; i < n; i++) strip.blit(handFrame(hand, (i / n) * Math.PI * 2), i * FR, 0);
  return strip;
}
/** the brass arbor nut over the hands */
function boss() {
  const b = new Buf(6, 6);
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const d = dist(x, y, 3, 3);
    if (d > 2.7) continue;
    b.set(x, y, d > 2 ? [40, 20, 10] : pick(R.brass, clamp(0.78 - (x - 2.5) * 0.18 - (y - 2.5) * 0.18), x, y));
  }
  return b;
}

// the pendulum: a brass rod with a carved oak-leaf bob and an acorn, swinging from the pivot behind the case
const PB = { x0: CX - 23, y0: BOT.y0, w: 48, h: PIVOT.y + LEAF.at + LEAF.len + 4 - BOT.y0 };
function pendulumFrame(a, shadow = true) {
  const r = new Relief(PB.w, PB.h), px = PIVOT.x - PB.x0, py = PIVOT.y - PB.y0;
  const dx = Math.sin(a), dy = Math.cos(a);
  r.np();
  for (let t = 0; t <= LEAF.at + 1; t += 0.25) r.put(px + dx * t - 0.5, py + dy * t, M.brass, 6 + (t > LEAF.at - 2 ? 1 : 0), 0.05);
  const sx = px + dx * LEAF.at, sy = py + dy * LEAF.at;
  oakLeaf(r, sx, sy, Math.PI / 2 - a, LEAF.len, LEAF.wid, { h: 8, curl: 0.6 });
  acorn(r, Math.round(sx + dx * 2 - 4), Math.round(sy + dy * 2 - 2), 0.8, { h: 9.4 });
  const out = r.render({ outline: true });
  return shadow ? wallShadow(out, 2, 3, 80, 36) : out;
}
function pendulumStrip() {
  const strip = new Buf(PB.w * PEND_N, PB.h);
  for (let j = 0; j < PEND_N; j++) strip.blit(pendulumFrame(PEND_A * Math.cos((Math.PI * j) / (PEND_N - 1))), j * PB.w, 0);
  return strip;
}

/** a cast pine-cone weight on its hook: overlapping scales in dark bronze */
function cone(shadow = true) {
  const r = new Relief(CONE.w, CONE.h), cx = 7, top = 4, len = 27;
  r.np();
  for (const [x, y] of [[6, 0], [7, 0], [5, 1], [8, 1], [5, 2], [8, 2], [6, 3], [7, 3]]) r.put(x, y, M.brass, 10, 0.05);
  const half = (t) => 6.4 * Math.pow(Math.sin(Math.PI * Math.pow(clamp(t), 0.62)), 0.75);
  r.np();
  r.fill(0, top, CONE.w, top + len, (x, y) => { const t = (y + 0.5 - top) / len; return Math.abs(x + 0.5 - cx - 0.5) < half(t) + (t < 0.05 ? 1 : 0); }, M.bronze, (x, y) => {
    const t = (y + 0.5 - top) / len, hw = Math.max(0.8, half(t)), q = clamp(Math.abs(x + 0.5 - cx - 0.5) / hw);
    const phi = Math.asin(clamp((x + 0.5 - cx - 0.5) / hw, -1, 1)), row = Math.floor((y - top) / 2.6), fy = (y - top) / 2.6 - row;
    const col = phi / 0.75 + (row & 1) * 0.5, fx = col - Math.floor(col);
    const scale = (1 - Math.abs(fx - 0.5) * 2) * 0.7 + fy * 0.9;
    return 6 + Math.sqrt(1 - q * q) * 4 + scale * 1.1 - (fy > 0.82 ? 0.9 : 0);
  }, (x, y) => { const row = Math.floor((y - top) / 2.6), fy = (y - top) / 2.6 - row; return fy > 0.55 && fy < 0.82 ? 0.08 : 0; }, { gloss: 1.2 });
  const out = r.render({ outline: true });
  return shadow ? wallShadow(out, 2, 3, 80, 36) : out;
}
/** the brass pull ring on the other end of each chain */
function ring() {
  const r = new Relief(RING.w, RING.h);
  r.np();
  r.fill(0, 0, RING.w, RING.h, (x, y) => { const d = dist(x, y, 4.5, 5); return d > 1.6 && d < 3.8; }, M.brass, (x, y) => 8 + (1.1 - Math.abs(dist(x, y, 4.5, 5) - 2.7)) * 2);
  r.put(4, 0, M.brass, 9); r.put(4, 1, M.brass, 9);
  return r.render({ outline: true });
}
/** a 3 x 8 tile of brass chain: an oval link face on, then one edge on */
function chainTile() {
  const b = new Buf(3, 8), Lt = R.brass[10], Md = R.brass[6], Dk = R.brass[3], O = OUTLINE;
  const rows = ['.L.', 'LoD', 'LoD', '.D.', '.M.', '.M.', '.L.', '.M.'];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { const c = ch === 'L' ? Lt : ch === 'M' ? Md : ch === 'D' ? Dk : ch === 'o' ? O : null; if (c) b.set(x, y, c); }));
  return b;
}

// ------------------------------------------------------------------ the boot scene: wall, light

/** a dark emerald regency-stripe wall (the office's own wallpaper, in the dark), 64 px tile */
function wallTile() {
  const N = 64, b = new Buf(N, N);
  const G = rampOf([0x020605, 0x06120e, 0x0b1e17, 0x112a20], 6);
  const gold = rampOf([0x1a1306, 0x2e220c], 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = x % 32;
    const n = (vnoise((x % N) * 0.12, y * 0.12, 5) - 0.5) * 0.2;
    if (sx === 20 || sx === 31) { b.set(x, y, pick(gold, 0.5 + n, x, y, 0.85)); continue; }
    const satin = sx < 20;
    const dia = satin && Math.abs(Math.abs((sx % 20) - 10) + Math.abs((y % 16) - 8) - 7) < 0.8;
    b.set(x, y, pick(G, clamp((satin ? 0.62 : 0.32) + n + (dia ? 0.12 : 0) + ((x + y) & 1 ? 0.02 : -0.02)), x, y, 1));
  }
  return { url: b.url(), N };
}
/** A pool of warm lamplight on the wall, in hard stepped bands with ordered dither. */
function lampPool() {
  const w = 240, h = 340, b = new Buf(w, h), cx = w / 2, cy = h * 0.42;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = (x + 0.5 - cx) / (w / 2), ny = (y + 0.5 - cy) / (h / 2), a = Math.atan2(ny, nx);
    const rag = 1 + (fbm(Math.cos(a) * 1.6 + 3, Math.sin(a) * 1.6 + 3, 8) - 0.5) * 0.34 + (vnoise(x * 0.09, y * 0.09, 9) - 0.5) * 0.1;
    const d = Math.sqrt(nx * nx + ny * ny) / rag;
    if (d >= 1) continue;
    const lean = clamp(1 - (nx * 0.25 + ny * 0.3) * 0.4, 0.7, 1.15);
    const lv = (1 - d) * 6 * lean, band = Math.floor(lv), frac = lv - band;
    const k = band + (frac > bayer(x, y) ? 1 : 0);
    if (k <= 0) continue;
    b.set(x, y, [255, 178, 92], Math.min(6, k) * 15);
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
/** a little gold music note (for the owl's call) */
function note() {
  const rows = ['..##', '..#.#', '..#..', '..#..', '###..', '###..'];
  const b = new Buf(7, 8);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') b.set(x + 1, y + 1, x < 2 && y > 3 ? [255, 214, 120] : [255, 240, 200]); }));
  return outline(b).url();
}

// ------------------------------------------------------------------ assemble

/** paint, age and shade one state of the case (the same noise every time, so states differ only round the door) */
function caseState(v) { return paintCase(v).wear(7, keepDial).render({ outline: true }); }
const caseB = caseState({ door: 0, owl: null });
const STATES = [{ door: 1, owl: null }, { door: 2, owl: 'peek' }, { door: 2, owl: 'out' }, { door: 2, owl: 'call' }, { door: 2, owl: 'bow' }];
const stateBufs = STATES.map(caseState);
// the door box: everything any state changes
let bx0 = W, by0 = H, bx1 = 0, by1 = 0;
for (const s of stateBufs) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  if (s.d[i] !== caseB.d[i] || s.d[i + 1] !== caseB.d[i + 1] || s.d[i + 2] !== caseB.d[i + 2] || s.d[i + 3] !== caseB.d[i + 3]) { bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x + 1); by1 = Math.max(by1, y + 1); }
}
const DB = { x: bx0, y: by0, w: bx1 - bx0, h: by1 - by0, n: STATES.length + 1 };
const doorStrip = new Buf(DB.w * DB.n, DB.h);
[caseB, ...stateBufs].forEach((s, i) => doorStrip.blit(s.crop(DB.x, DB.y, DB.w, DB.h), i * DB.w, 0));
const caseShadow = wallShadow(caseB, 5, 7);
const HN = 120, MN = 120;
const hourS = handStrip(HOUR, HN), minS = handStrip(MINUTE, MN);
const pend = pendulumStrip(), coneB = cone(), ringB = ring(), chain = chainTile();
const ptr = pointer(), wall = wallTile(), pool = lampPool(), bossB = boss();
const EDGE = 44, edgeH = edgeShade(EDGE, false), edgeV = edgeShade(EDGE, true);
const HO = { x: CX - FR / 2, y: DY - FR / 2 };

// ---- the 3D office's copy of the clock: one atlas + its layout
{
  const CH = 100; // a strip of chain long enough for the lowest weight
  const AW = W + FR * 2 + 2 + PB.w + 2 + CONE.w + 2 + 3 + 2, AH = H;
  const atlas = new Buf(AW, AH);
  atlas.blit(caseB, 0, 0);
  const hx = W;
  atlas.blit(handFrame(HOUR, 0), hx, 0);
  atlas.blit(handFrame(MINUTE, 0), hx + FR, 0);
  atlas.blit(bossB, hx, FR);
  const px = hx + FR * 2 + 2;
  atlas.blit(pendulumFrame(0, false), px, 0);
  const cx = px + PB.w + 2;
  atlas.blit(cone(false), cx, 0);
  atlas.blit(ringB, cx, CONE.h + 2);
  const chx = cx + CONE.w + 2;
  for (let y = 0; y < CH; y += 8) atlas.blit(chain, chx, y);
  writeFileSync(fileURLToPath(new URL('../../../public/models/interview/clock.png', import.meta.url)), atlas.png());
  const gen = `// Generated by src/onboard/tools/bootart.mjs: the layout of public/models/interview/clock.png and the cuckoo clock's
// geometry (art px, x right, y down; the case painting is W x H, the weights hang below it).
export const CLOCK_ART = ${JSON.stringify({
    W, H, CX, DY, RD, atlas: [AW, AH], case: [0, 0, W, H],
    hour: [hx, 0, FR, FR], minute: [hx + FR, 0, FR, FR], boss: [hx, FR, 6, 6],
    pend: [px, 0, PB.w, PB.h], pendBox: [PB.x0, PB.y0], pivot: [PIVOT.x, PIVOT.y],
    cone: [cx, 0, CONE.w, CONE.h], ring: [cx, CONE.h + 2, RING.w, RING.h], chain: [chx, 0, 3, CH],
    // where the weights and rings hang once the clock is wound (the loading screen's last frame): sprite top-left
    cones: WEIGHTS.map((w) => [w.x - 7, w.y + WT_TRAVEL]), rings: RINGS.map((g) => [g.x - 4, g.y - WT_TRAVEL]), chainX: [...WEIGHTS.map((w) => w.x - 1), ...RINGS.map((g) => g.x - 1)],
    roof: { ridge: RIDGE, slope: SL, t: ROOF_T + BARGE, eave: EAVE }, gable: GHW, corn: [CORN.hw, CORN.y0, CORN.y1], bot: [BOT.hw, BOT.y0, BOT.y1], caseBox: [CASE.hw, CASE.y0, CASE.y1],
  })} as const;
`;
  writeFileSync(fileURLToPath(new URL('../clockart.gen.ts', import.meta.url)), gen);
}

// ---- progress timing: the weights sink with the (estimated) loading progress, fast at first, then a crawl
const LOAD_S = 26;
const prog = (t) => { const a = Math.min(1, t / 7); return 0.9 * (1 - (1 - a) ** 2.4) + 0.07 * Math.max(0, (t - 7) / (LOAD_S - 7)); };
const invProg = (p) => { let lo = 0, hi = LOAD_S; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (prog(m) < p) lo = m; else hi = m; } return hi; };
/** one keyframe per art pixel of travel (steps, so the weights stay on the pixel grid); stops short of the end */
function sinkFrames() {
  const out = [], n = Math.round(WT_TRAVEL * prog(LOAD_S)) - 2;
  for (let i = 0; i <= n; i++) {
    const pct = i === 0 ? 0 : (invProg(i / WT_TRAVEL) / LOAD_S) * 100;
    out.push(`${pct.toFixed(2)}%{transform:translateY(calc(var(--d)*${i}em))}`);
  }
  return `@keyframes bt-wt{${out.join('')}}`;
}
const SW = W; // the stage's width
const dw = DB.w, dh = DB.h;

const CSSTXT = `
#boot{--k:min(calc(86vw / ${SW}),calc(72vh / ${SH}));font-size:var(--k);position:fixed;inset:0;z-index:99;overflow:hidden;display:flex;align-items:center;justify-content:center;
background:#020504 url(${wall.url}) 50% 50%/${wall.N}em ${wall.N}em repeat;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;transition:opacity .7s steps(6)}
@supports (width:round(nearest,1px,1px)){#boot{--k:max(1px,min(round(nearest,min(calc(86vw / ${SW}),calc(72vh / ${SH})),1px),round(down,min(calc(98vw / ${SW}),calc(92vh / ${SH})),1px)))}}
#boot.gone:not(.hold):not(.js){opacity:0;pointer-events:none}
#boot *{position:absolute;display:block;image-rendering:pixelated;image-rendering:crisp-edges;-webkit-user-drag:none;pointer-events:none}
#boot .bt-edge{left:0;top:0;width:${EDGE}em;height:100%;background:url(${edgeH}) 0 0/${EDGE}em 4em repeat-y}
#boot .bt-edge.r{left:auto;right:0;transform:scaleX(-1)}
#boot .bt-edge.t{width:100%;height:${EDGE}em;background:url(${edgeV}) 0 0/4em ${EDGE}em repeat-x}
#boot .bt-edge.b{top:auto;bottom:0;width:100%;height:${EDGE}em;background:url(${edgeV}) 0 0/4em ${EDGE}em repeat-x;transform:scaleY(-1)}
#boot .bt-pool{width:${pool.w}em;height:${pool.h}em;left:50%;top:50%;margin:-${(pool.h * 0.5).toFixed(1)}em 0 0 -${pool.w / 2}em;background:url(${pool.url}) 0 0/100% 100%;animation:bt-flick 3.2s steps(1) infinite}
#boot .bt-mote{width:1em;height:1em;background:#ffd890;opacity:0;animation:bt-mote 9s steps(36) infinite}
#boot .bt-stage{position:relative;width:${SW}em;height:${SH}em;flex:none;transform-origin:50% ${((DY / SH) * 100).toFixed(3)}%}
#boot .bt-clock{left:0;top:0;width:${SW}em;height:${SH}em}
#boot .bt-case{left:0;top:0;width:${W}em;height:${H}em}
#boot .bt-pend{left:${PB.x0}em;top:${PB.y0}em;width:${PB.w}em;height:${PB.h}em;background:url(${pend.url()}) 0 0/${PB.w * PEND_N}em ${PB.h}em;animation:bt-pend .6s steps(${PEND_N - 1},jump-none) infinite alternate}
#boot .bt-wt,#boot .bt-rg{--d:1;animation:bt-wt ${LOAD_S}s steps(1,end) forwards}
#boot .bt-wt{width:${CONE.w}em;height:${CONE.h}em;background:url(${coneB.url()}) 0 0/100% 100%}
#boot .bt-rg{--d:-1;width:${RING.w}em;height:${RING.h}em;background:url(${ringB.url()}) 0 0/100% 100%}
#boot .bt-wt::before,#boot .bt-rg::before{content:'';position:absolute;left:6em;bottom:${CONE.h - 1}em;width:3em;height:120em;background:url(${chain.url()}) 0 100%/3em 8em repeat-y;image-rendering:pixelated}
#boot .bt-rg::before{left:3em;bottom:${RING.h - 1}em}
${WEIGHTS.map((w, i) => `#boot .bt-wt.w${i}{left:${w.x - 7}em;top:${w.y}em}`).join('\n')}
${RINGS.map((g, i) => `#boot .bt-rg.w${i}{left:${g.x - 4}em;top:${g.y}em}`).join('\n')}
#boot .bt-door{left:${DB.x}em;top:${DB.y}em;width:${dw}em;height:${dh}em;background:url(${doorStrip.url()}) 0 0/${dw * DB.n}em ${dh}em}
#boot .bt-h{left:${HO.x}em;top:${HO.y}em;width:${FR}em;height:${FR}em}
#boot .bt-hh{background:url(${hourS.url()}) 0 0/${FR * HN}em ${FR}em;animation:bt-hh 43200s steps(${HN}) calc(var(--th, 0) * -1s) infinite}
#boot .bt-mh{background:url(${minS.url()}) 0 0/${FR * MN}em ${FR}em;animation:bt-mh 3600s steps(${MN}) calc(var(--tm, 0) * -1s) infinite}
#boot .bt-boss{left:${CX - 3}em;top:${DY - 3}em;width:6em;height:6em}
#boot .bt-tap{left:${CX + 20}em;top:${DY + 18}em;width:${ptr.fw}em;height:${ptr.fh}em;background:url(${ptr.url}) 0 0/${ptr.fw * 2}em ${ptr.fh}em;opacity:0}
#boot .bt-note{width:7em;height:8em;opacity:0}
#boot.ready{cursor:pointer}
#boot.ready *{pointer-events:none}
#boot.ready .bt-tap{opacity:1;animation:bt-tap 1s steps(1) infinite}
#boot.ready.out .bt-door{animation:bt-nod 2.6s steps(1) infinite}
#boot.call .bt-note{animation:bt-note .9s steps(6) forwards}
#boot.zoom .bt-tap{opacity:0;animation:none}
@keyframes bt-flick{0%,100%{opacity:1}31%{opacity:.9}36%{opacity:1}70%{opacity:.94}}
@keyframes bt-mote{0%{opacity:0;transform:translate(0,0)}15%{opacity:.7}50%{transform:translate(6em,-14em)}85%{opacity:.5}100%{opacity:0;transform:translate(2em,-28em)}}
@keyframes bt-pend{to{background-position:-${(PEND_N - 1) * PB.w}em 0}}
@keyframes bt-mh{to{background-position:-${MN * FR}em 0}}
@keyframes bt-hh{to{background-position:-${HN * FR}em 0}}
${sinkFrames()}
@keyframes bt-tap{0%{background-position:0 0}50%{background-position:-${ptr.fw}em 0}}
@keyframes bt-nod{0%,100%{background-position:-${dw * 3}em 0}84%{background-position:-${dw * 5}em 0}92%{background-position:-${dw * 3}em 0}}
@keyframes bt-note{0%{opacity:1;transform:translate(0,0)}70%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}
@media (prefers-reduced-motion:reduce){#boot *:not(.bt-h){animation-duration:0s!important;animation-iteration-count:1!important}}
`.trim().replace(/\n+/g, '\n');

const motes = [[-48, 30, 0], [44, 10, -2.1], [-22, -40, -4.4], [56, -56, -6.2], [-62, -8, -1.3], [14, 62, -3.6], [32, -70, -7.7], [-36, 70, -5.1]];
const notes = [[CX - 20, 58, -9, -14], [CX + 14, 54, 10, -16], [CX - 4, 46, -2, -18]];
const noteUrl = note();
const html = `<!-- boot:begin (generated by src/onboard/tools/bootart.mjs; edit the generator, not this block) -->
    <style>${CSSTXT}</style>
    <div id="boot" role="progressbar" aria-label="Loading" data-art='${JSON.stringify({ fr: FR, mn: MN, hn: HN, cx: CX, dy: DY, rd: RD, w: W, sh: SH, bw: SW, dw, wt: WT_TRAVEL })}'>
      <i class="bt-edge"></i><i class="bt-edge r"></i><i class="bt-edge t"></i><i class="bt-edge b"></i><i class="bt-pool"></i>${motes.map(([x, y, d]) => `<i class="bt-mote" style="left:calc(50% + ${x}em);top:calc(50% + ${y}em);animation-delay:${d}s"></i>`).join('')}
      <div class="bt-stage">
        <div class="bt-clock">
          <i class="bt-pend"></i>
          <i class="bt-wt w0"></i><i class="bt-wt w1"></i><i class="bt-rg w0"></i><i class="bt-rg w1"></i>
          <img class="bt-case" src="${caseShadow.url()}" alt="" />
          <i class="bt-door"></i>
          <i class="bt-h bt-hh"></i><i class="bt-h bt-mh"></i>
          <img class="bt-boss" src="${bossB.url()}" alt="" />
          <i class="bt-tap"></i>
          ${notes.map(([x, y, dx, dy]) => `<img class="bt-note" style="left:${x}em;top:${y}em;--dx:${dx}em;--dy:${dy}em" src="${noteUrl}" alt="" />`).join('')}
        </div>
      </div>
    </div>
    <script>(function(){try{var d=new Date(),m=d.getMinutes()*60+d.getSeconds()+d.getMilliseconds()/1e3,b=document.getElementById('boot').style;b.setProperty('--tm',m.toFixed(1));b.setProperty('--th',((d.getHours()%12)*3600+m).toFixed(1))}catch(e){}})()</script>
    <!-- boot:end -->`;

const file = fileURLToPath(new URL('../../../index.html', import.meta.url));
const src = readFileSync(file, 'utf8');
const a = src.indexOf('<!-- boot:begin'), z = src.indexOf('<!-- boot:end -->');
if (a < 0 || z < 0) throw new Error('boot markers missing in index.html');
writeFileSync(file, src.slice(0, a) + html + src.slice(z + '<!-- boot:end -->'.length));
if (process.argv.includes('--preview')) {
  // the clock at 10:10 (closed, weights up), the owl out calling (weights down), and the door states
  const out = process.argv[process.argv.indexOf('--preview') + 1];
  const P = new Buf(W * 2 + 8 + DB.w + 4, SH);
  const shot = (ox, st, sink) => {
    const pf = pendulumFrame(0.1);
    P.blit(pf, ox + PB.x0, PB.y0);
    for (const w of WEIGHTS) { P.blit(coneB, ox + w.x - 7, w.y + sink); for (let y = BOT.y0; y < w.y + sink + 1; y += 8) P.blit(chain, ox + w.x - 1, y); }
    for (const g of RINGS) { P.blit(ringB, ox + g.x - 4, g.y - sink); for (let y = BOT.y0; y < g.y - sink + 1; y += 8) P.blit(chain, ox + g.x - 1, y); }
    P.blit(caseShadow, ox, 0);
    P.blit(st, ox, 0);
    P.blit(handFrame(HOUR, (10 / 12) * Math.PI * 2 + 0.17), ox + HO.x, HO.y);
    P.blit(handFrame(MINUTE, (10 / 60) * Math.PI * 2), ox + HO.x, HO.y);
    P.blit(bossB, ox + CX - 3, DY - 3);
  };
  shot(0, caseB, 0);
  const callFull = new Buf(W, H); callFull.blit(caseB, 0, 0); callFull.blit(doorStrip.crop(DB.w * 4, 0, DB.w, DB.h), DB.x, DB.y);
  shot(W + 8, callFull, WT_TRAVEL);
  for (let i = 0; i < DB.n; i++) P.blit(doorStrip.crop(DB.w * i, 0, DB.w, DB.h), W * 2 + 12, i * (DB.h + 2));
  writeFileSync(out, P.png());
}
console.log('boot block written:', (html.length / 1024).toFixed(1), 'KB; door box', JSON.stringify(DB), 'stage', SW, 'x', SH);
