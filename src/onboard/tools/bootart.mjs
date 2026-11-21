// Generates the pixel art of the loading screen (the `#boot` block in index.html): Pip asleep on a
// mossy branch in front of a huge moon, a hanging lantern, the "dream meter" of moon phases, the
// title and captions in a 5x7 pixel font, stars, clouds and a far tree line. Everything is painted
// into small PNGs (data URIs) so the splash shows before any script or web font has loaded.
//
//   node src/onboard/tools/bootart.mjs        rewrites the block between the boot markers
//
// Not part of the app bundle.
import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ tiny RGBA canvas + PNG

const hexc = (h) => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixc = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); this.tag = new Int16Array(w * h).fill(-1); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  set(x, y, c, a = 255, tag = -1) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.in(x, y) || !c) return;
    const i = (y * this.w + x) * 4, col = typeof c === 'string' ? hexc(c) : c;
    if (a >= 255 || this.d[i + 3] === 0) { this.d[i] = col[0]; this.d[i + 1] = col[1]; this.d[i + 2] = col[2]; this.d[i + 3] = a; }
    else { const t = a / 255; for (let k = 0; k < 3; k++) this.d[i + k] = Math.round(this.d[i + k] * (1 - t) + col[k] * t); this.d[i + 3] = Math.max(this.d[i + 3], a); }
    if (tag >= 0) this.tag[y * this.w + x] = tag;
  }
  get(x, y) { if (!this.in(x, y)) return null; const i = (y * this.w + x) * 4; return this.d[i + 3] ? [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]] : null; }
  a(x, y) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  clear(x, y) { if (this.in(x, y)) this.d[(y * this.w + x) * 4 + 3] = 0; }
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
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];

/** Fill an ellipse, colouring each pixel with f(nx, ny, x, y) where n* run -1..1 across it. */
function ell(b, cx, cy, rx, ry, f, tag = -1) {
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
    if (nx * nx + ny * ny <= 1) { const c = f(nx, ny, x, y); if (c) b.set(x, y, c, 255, tag); }
  }
}
function rect(b, x0, y0, w, h, f, tag = -1) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const c = typeof f === 'function' ? f(x, y) : f; if (c) b.set(x, y, c, 255, tag); } }
function poly(b, pts, f, tag = -1) {
  const ys = pts.map((p) => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5, xs = [];
    for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) { const c = typeof f === 'function' ? f(x, y) : f; if (c) b.set(x, y, c, 255, tag); }
  }
}
/** A shaded material: ramp dark..light, lit from the top left. */
const RAMP = (list) => list.map(hexc);
function shade(r, nx, ny, x, y, bias = 0) {
  const l = -(nx * 0.55 + ny * 0.85) * 1.25 + bias;
  const k = Math.max(0, Math.min(r.length - 1, Math.floor((r.length - 1) / 2 + l * 1.3 + bayer(x, y) * 0.9 - 0.2)));
  return r[k];
}
/** 1px outline around everything opaque, darkened from the neighbouring colour. */
function outline(b, ink = '#22140c', amount = 0.78) {
  const o = new Buf(b.w, b.h); o.d.set(b.d);
  const inkc = hexc(ink);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    if (b.a(x, y) > 0) continue;
    let n = null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = b.get(x + dx, y + dy); if (c && c[3] > 200) { n = c; break; } }
    if (n) o.set(x, y, mixc(n, inkc, amount));
  }
  return o;
}

// ------------------------------------------------------------------ palettes (Pip, tawny)

const FUR = RAMP(['#4a2a16', '#6a3c20', '#8a5230', '#b0703f', '#cf9258', '#e8b47a']);
const WING = RAMP(['#40220f', '#5e351b', '#7e4a28', '#a2653a', '#c48552', '#dca46c']);
const BELLY = RAMP(['#b08a64', '#d2b48e', '#ead2ae', '#fbecd2', '#fff7e8']);
const DISC = RAMP(['#a8744a', '#c8946a', '#e2b88e', '#f2d4ae', '#fde8c8']);
const BEAK = RAMP(['#9a5a12', '#c87e1e', '#f2a84c', '#ffd07e']);
const CAP = RAMP(['#1c2560', '#2a3784', '#3a4a9e', '#4a5fb0', '#6a80cc', '#93a6e6']);
const FLUFF = RAMP(['#b8a88a', '#d8ccb2', '#ece4d0', '#f8f3e6', '#ffffff']);
const BARK = RAMP(['#24140c', '#3a2414', '#4e3220', '#664330', '#80573c', '#9c6e4c']);
const MOSS = RAMP(['#1f3f22', '#2e5a2c', '#447a36', '#5f9a3e', '#86bc52', '#b2dc72']);
const LEAF = RAMP(['#173628', '#1f5236', '#2a723e', '#46963c', '#7cbe46', '#c2e274']);
const MOON = RAMP(['#c9b98e', '#ddd0a6', '#ece2bc', '#f7efd0', '#fffae6']);
const BRASS = RAMP(['#3a2610', '#5c4219', '#8d6c32', '#b8924c', '#dcbd72', '#f6e6ac']);
const NIGHT = '#0d1230';

// ------------------------------------------------------------------ Pip

/** frame: 'sleep' | 'breath' | 'peek' */
function owl(frame) {
  const b = new Buf(36, 44);
  const cx = 18, breath = frame === 'breath' ? 1 : 0;
  const bodyCy = 30.5 - breath * 0.5, headCy = 18 - breath;
  // tail and feet first
  poly(b, [[13, 40], [23, 40], [21, 43], [15, 43]], (x, y) => WING[1 + ((x + y) % 2)]);
  // wings behind the body edges
  for (const sd of [-1, 1]) ell(b, cx + sd * 9.2, bodyCy + 0.5, 4.3, 9.2 + breath * 0.4, (nx, ny, x, y) => { const c = shade(WING, nx * sd * 0.4 - 0.2 * sd, ny, x, y, sd > 0 ? -0.35 : 0.1); return (y + (x % 2)) % 4 === 0 ? mixc(c, WING[0], 0.45) : c; });
  // body
  ell(b, cx, bodyCy, 10.6 + breath * 0.5, 10.6, (nx, ny, x, y) => shade(FUR, nx, ny, x, y));
  // chest bib with chevron flecks
  ell(b, cx, bodyCy + 1.6, 6.6 + breath * 0.5, 8.2, (nx, ny, x, y) => {
    const c = shade(BELLY, nx, ny, x, y, 0.2);
    const ch = (y - Math.abs(x - cx) * 0.6) % 3.2;
    return ch > 0 && ch < 0.9 && hash(x, y, 2) > 0.35 ? mixc(c, hexc('#c08550'), 0.55) : c;
  });
  // feet gripping the branch
  for (const fx of [cx - 4, cx + 3]) { rect(b, fx - 1, 40, 4, 2, BEAK[2]); b.set(fx - 1, 41, BEAK[0]); b.set(fx + 1, 41, BEAK[0]); b.set(fx + 3, 41, BEAK[0]); }
  // head
  ell(b, cx, headCy, 12.4, 9.8, (nx, ny, x, y) => { const c = shade(FUR, nx, ny, x, y, 0.1); return hash(x, y, 7) > 0.88 && ny < 0.3 ? mixc(c, hexc('#fbe6c2'), 0.5) : c; });
  // facial disc: two soft moons, a darker rim
  for (const sd of [-1, 1]) {
    ell(b, cx + sd * 4.7, headCy + 1.4, 5.6, 5.0, (nx, ny, x, y) => (nx * nx + ny * ny > 0.72 ? DISC[0] : shade(DISC, nx * 0.6, ny * 0.6, x, y, 0.3)));
  }
  ell(b, cx, headCy + 4.8, 3.6, 2.4, (nx, ny, x, y) => shade(DISC, nx, ny, x, y, 0.4));
  // eyes
  for (const sd of [-1, 1]) {
    const ex = cx + sd * 4.6 - 0.5, ey = Math.round(headCy + 1.3);
    const open = frame === 'peek' && sd < 0;
    if (open) {
      ell(b, ex + 0.5, ey + 0.5, 2.6, 2.6, () => hexc('#fff3dc'));
      ell(b, ex + 0.7, ey + 0.8, 1.8, 1.9, () => hexc('#2a1a14'));
      b.set(Math.floor(ex), Math.floor(ey) - 1 + 1, '#ffffff');
    } else {
      // content closed eyes: a little upside-down smile with lashes
      const pts = [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]];
      for (const [dx, dy] of pts) b.set(ex + dx + 0.5, ey + dy, '#3b2414');
      b.set(ex - 2.5 + 0.5 - 0.5, ey - 1, '#6a3c20');
    }
  }
  // brows: soft feather tufts above the disc
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) b.set(cx + sd * (2 + k) - (sd < 0 ? 1 : 0), headCy - 4 + (k > 2 ? 1 : 0), FUR[1]);
  // beak
  rect(b, cx - 1, Math.round(headCy + 3), 2, 3, (x, y) => BEAK[y === Math.round(headCy + 3) ? 3 : 2]);
  b.set(cx - 1, Math.round(headCy + 6), BEAK[1]);
  // rosy cheeks
  for (const sd of [-1, 1]) { b.set(cx + sd * 8 - (sd < 0 ? 1 : 0), Math.round(headCy + 4), '#f7a3ae'); b.set(cx + sd * 9 - (sd < 0 ? 1 : 0), Math.round(headCy + 4), '#f2909e'); }
  // nightcap: fluffy brim, a striped cone that flops to the right, a pompom hanging off the side
  const brimY = Math.round(headCy - 9.4);
  const cone = [[cx - 10.5, brimY + 1], [cx + 10.5, brimY + 1], [cx + 9, brimY - 4], [cx + 14, brimY - 2], [cx + 15.5, brimY + 3], [cx + 13, brimY - 7], [cx + 4, brimY - 8], [cx - 6, brimY - 5]];
  poly(b, cone, (x, y) => { const k = Math.max(0, Math.min(5, Math.round(3 - (y - brimY + 4) * 0.25 - (x - cx) * 0.06 + bayer(x, y) * 0.7))); const c = CAP[k]; return ((x * 2 + y * 3) % 7 === 0) ? hexc('#f3e9cf') : c; });
  rect(b, Math.round(cx - 11), brimY, 22, 3, (x, y) => FLUFF[Math.min(4, Math.max(0, (y === brimY ? 4 : y === brimY + 2 ? 1 : 3) - (hash(x, y, 5) > 0.7 ? 1 : 0)))]);
  for (let x = Math.round(cx - 11); x < cx + 11; x += 3) b.set(x, brimY - 1, FLUFF[3]);
  ell(b, cx + 15.5, brimY + 5 - breath * 0.5, 2.6, 2.6, (nx, ny, x, y) => shade(FLUFF, nx, ny, x, y, 0.3));
  return outline(b);
}

// ------------------------------------------------------------------ the scene: moon, branch, lantern

function moon() {
  const N = 84, b = new Buf(N, N), c = N / 2;
  // halo: stepped rings of light
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    if (d > 27 && d < 42) { const k = Math.floor((42 - d) / 3.2); b.set(x, y, '#fff2c4', 6 + k * 7); }
  }
  ell(b, c, c, 27, 27, (nx, ny, x, y) => {
    let col = shade(MOON, nx * 0.7, ny * 0.7, x, y, 0.4);
    // maria: soft grey seas
    const sea = [[-0.3, -0.25, 0.32], [0.25, 0.1, 0.22], [-0.05, 0.45, 0.2], [0.45, -0.4, 0.14]];
    for (const [sx, sy, r] of sea) if (Math.hypot(nx - sx, ny - sy) < r + (hash(x, y, 3) - 0.5) * 0.06) col = mixc(col, hexc('#c9bb98'), 0.45);
    // craters with a lit lower-right rim
    for (const [sx, sy, r] of [[0.5, 0.45, 0.09], [-0.55, 0.3, 0.07], [0.1, -0.6, 0.08], [-0.2, 0.75, 0.06]]) {
      const d = Math.hypot(nx - sx, ny - sy);
      if (d < r) col = mixc(col, hexc('#bfae86'), 0.5); else if (d < r + 0.04 && nx - sx + ny - sy > 0) col = hexc('#fffae6');
    }
    return col;
  });
  return { url: b.url(), w: N, h: N };
}

function branch() {
  const W = 124, H = 40, b = new Buf(W, H);
  // the branch: a gently curving tapering log, bark grooves, moss on top
  const top = (x) => 18 + Math.sin(x * 0.045 + 0.4) * 2.2 + (x < 18 ? (18 - x) * 0.12 : 0);
  const thick = (x) => 8.5 - x * 0.032;
  for (let x = 0; x < W - 4; x++) {
    const t0 = top(x), th = thick(x);
    for (let y = Math.round(t0); y < t0 + th; y++) {
      const v = (y - t0) / th; // 0 top .. 1 bottom
      let k = Math.round(4 - v * 3.6 + bayer(x, y) * 0.8 - 0.3);
      if (((x * 3 + Math.floor(y * 1.7)) % 11 === 0 || hash(x >> 2, y, 4) > 0.86) && v > 0.25) k -= 2;
      b.set(x, y, BARK[Math.max(0, Math.min(5, k))]);
    }
    // moss cushions on top
    const m = Math.sin(x * 0.21) * 1.2 + Math.sin(x * 0.53 + 2) * 0.8 + (hash(x >> 1, 0, 9) - 0.5) * 1.2;
    const mh = Math.max(0, Math.round(1.6 + m));
    if (x > 4 && x < W - 10) for (let y = 0; y < mh; y++) b.set(x, Math.round(t0) - y, MOSS[Math.max(1, Math.min(5, 4 - y + (hash(x, y, 1) > 0.6 ? 1 : 0)))]);
  }
  // twig going up at the right with leaves, a stub on the left
  for (let k = 0; k < 10; k++) b.set(W - 14 + Math.round(k * 0.6), Math.round(top(W - 14)) - k, BARK[3 + (k % 2)]);
  const leaf = (x, y, rx, ry, rot = 0) => ell(b, x, y, rx, ry, (nx, ny, xx, yy) => shade(LEAF, nx + rot, ny, xx, yy, 0.2));
  leaf(W - 6, top(W - 14) - 11, 3, 2); leaf(W - 11, top(W - 14) - 9, 2.6, 1.8); leaf(W - 3, top(W - 14) - 4, 2.8, 1.8);
  leaf(W - 5, top(W - 5) + 2, 3.5, 2.3); leaf(W - 1, top(W - 1) - 1, 2.8, 2.2);
  // hanging leaves under the branch
  for (const [x, dy] of [[12, 0], [30, 1], [74, 0], [96, 1]]) { leaf(x, top(x) + thick(x) + 1.5 + dy, 1.8, 2.6); b.set(x, Math.round(top(x) + thick(x)), LEAF[1]); }
  // the lantern: a little brass lamp on a string, warm glass
  const lx = 96, ly = Math.round(top(lx) + thick(lx));
  for (let y = ly; y < ly + 6; y++) b.set(lx, y, '#4a3520');
  rect(b, lx - 3, ly + 6, 7, 2, (x) => BRASS[x === lx - 3 ? 2 : 4]);
  rect(b, lx - 2, ly + 8, 5, 6, (x, y) => (x === lx - 2 || x === lx + 2 ? BRASS[2] : (y === ly + 8 ? '#ffe9a0' : y < ly + 11 ? '#ffd45a' : '#ffb83a')));
  b.set(lx, ly + 10, '#fff6d0');
  rect(b, lx - 3, ly + 14, 7, 2, (x) => BRASS[x === lx - 3 ? 1 : 3]);
  // left leafy end
  leaf(3, top(3) - 2, 4, 3); leaf(8, top(8) - 5, 3, 2); leaf(1, top(1) + 5, 3.2, 2.6);
  // mushrooms on the moss
  for (const mx of [24, 82]) { const my = Math.round(top(mx)) - 1; rect(b, mx, my - 2, 1, 3, '#f3e2c4'); rect(b, mx - 2, my - 4, 5, 2, (x, y) => (y === my - 4 ? '#e85a4a' : '#c43a30')); b.set(mx - 1, my - 4, '#fff6e0'); }
  return { b: outline(b, '#140a06', 0.75), lantern: { x: lx, y: ly + 11 }, top };
}

function cloud(seed) {
  const W = 40, H = 12, b = new Buf(W, H);
  const blobs = [[9, 7, 7, 4], [19, 5, 9, 5], [30, 7, 7, 4], [22, 8, 14, 3.5]];
  for (const [x, y, rx, ry] of blobs) ell(b, x, y, rx, ry, (nx, ny, xx, yy) => (ny < -0.35 ? hexc('#4a5898') : ny < 0.25 ? hexc('#33407c') : hexc('#2a3468')));
  void seed;
  return b.url();
}

function treeline() {
  const W = 96, H = 30, b = new Buf(W, H);
  for (let x = 0; x < W; x++) {
    const h1 = 14 + Math.round(Math.sin(x * 0.19) * 3 + Math.sin(x * 0.53 + 1) * 2 + (hash(x >> 2, 1, 3) - 0.5) * 3);
    for (let y = H - h1; y < H; y++) b.set(x, y, y < H - h1 + 1 ? '#1c2452' : '#141a40');
    const h2 = 7 + Math.round(Math.sin(x * 0.11 + 2) * 2.5 + Math.sin(x * 0.37) * 1.5);
    for (let y = H - h2; y < H; y++) b.set(x, y, y < H - h2 + 1 ? '#121836' : '#0b1028');
  }
  // pine tips
  for (const px of [8, 31, 55, 80]) for (let k = 0; k < 9; k++) for (let dx = -Math.floor(k / 2); dx <= Math.floor(k / 2); dx++) b.set(px + dx, H - 22 + k + (px % 3), k === 0 ? '#1c2452' : '#141a40');
  return b.url();
}

function starTile() {
  const N = 64, b = new Buf(N, N);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, 5) * N), y = Math.floor(hash(i, 2, 5) * N), big = hash(i, 3, 5) > 0.8;
    const col = hash(i, 4, 5) > 0.5 ? '#fff6d8' : '#c8d4ff';
    b.set(x, y, col, big ? 255 : 150 + Math.floor(hash(i, 5, 5) * 100));
    if (big) { b.set(x + 1, y, col, 110); b.set(x - 1, y, col, 110); b.set(x, y + 1, col, 110); b.set(x, y - 1, col, 110); }
  }
  return b.url();
}

/** Moon phases for the dream meter: from a thin crescent to full. */
function phases() {
  const S = 11, n = 8, b = new Buf(S * n, S);
  for (let i = 0; i < n; i++) {
    const f = (i + 1) / n; // lit fraction
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = (x + 0.5 - S / 2) / 4.6, ny = (y + 0.5 - S / 2) / 4.6;
      if (nx * nx + ny * ny > 1) continue;
      const half = Math.sqrt(Math.max(0, 1 - ny * ny));
      // terminator moves from the right edge to the left edge as the moon fills
      const term = half - f * 2 * half;
      const lit = nx > term;
      b.set(i * S + x, y, lit ? shade(MOON, nx, ny, x, y, 0.6) : hexc('#2a3366'));
    }
  }
  return { url: outline(b, '#0a0d22', 0.6).url(), S: S + 0, n };
}

function zed() {
  const b = new Buf(7, 7);
  const rows = ['#####', '...#.', '..#..', '.#...', '#####'];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') b.set(x + 1, y + 1, y === 0 ? '#ffffff' : '#d6e2ff'); }));
  return outline(b, '#141a3a', 0.2).url();
}

// ------------------------------------------------------------------ 5x7 pixel font

const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'], S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'], ' ': ['..', '..', '..', '..', '..', '..', '..'],
};
function text(str, o = {}) {
  const top = hexc(o.top ?? '#fff3c4'), bot = hexc(o.bot ?? '#f2b84a'), sh = o.shadow ?? '#2a1a3a';
  const glyphs = [...str].map((c) => FONT[c] ?? FONT[' ']);
  const W = glyphs.reduce((s, g) => s + g[0].length + 1, 0) + 2, H = 7 + 3;
  const b = new Buf(W, H);
  let x0 = 1;
  for (const g of glyphs) {
    g.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') { b.set(x0 + x + 1, y + 2, sh); } }));
    g.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '#') b.set(x0 + x, y + 1, mixc(top, bot, y / 6)); }));
    x0 += g[0].length + 1;
  }
  return { url: (o.outline === false ? b : outline(b, '#140c22', 0.85)).url(), w: W, h: H };
}

// ------------------------------------------------------------------ assemble the block

const sleep = owl('sleep').url(), breath = owl('breath').url(), peek = owl('peek').url();
const mo = moon(), br = branch(), ph = phases();
const title = text('HOOT HOLLOW'), cap1 = text('PIP IS DREAMING...', { top: '#c8d4ff', bot: '#93a6e6' }), cap2 = text('TAP TO WAKE PIP', { top: '#fff3c4', bot: '#ffd45a' });
const SW = 124, SH = 104; // scene size in art pixels
const owlX = 44, owlY = 33; // owl image top-left inside the scene
const brX = 0, brY = 58;
const moonX = 20, moonY = 6;

const ff = [[14, 30, 1], [100, 22, 2], [88, 70, 3], [26, 76, 2], [60, 12, 1], [112, 50, 3], [6, 52, 1], [70, 86, 2]];
const zs = [0, 1, 2];

const css = `
#boot{--k:min(calc(94vw / ${SW}),calc(54vh / ${SH}));font-size:var(--k);position:fixed;inset:0;z-index:99;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5em;
background:linear-gradient(180deg,#070b24 0%,#0c1234 22%,#121a46 44%,#1a2458 62%,#26306a 78%,#2f3a78 100%);transition:opacity .8s ease;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent}
#boot.gone:not(.hold){opacity:0;pointer-events:none}
#boot img,#boot i,#boot b,#boot u,#boot s{image-rendering:pixelated;image-rendering:crisp-edges;display:block;-webkit-user-drag:none}
#boot .bt-stars,#boot .bt-stars2{position:absolute;inset:0;background:url(${starTile()}) 0 0/calc(64 * var(--k) * 1.5) repeat;opacity:.9;animation:bt-tw 3.6s steps(2) infinite}
#boot .bt-stars2{background-position:calc(23 * var(--k)) calc(41 * var(--k));background-size:calc(64 * var(--k) * 2);opacity:.55;animation-delay:-1.7s;animation-duration:5.2s}
#boot .bt-trees{position:absolute;left:0;right:0;bottom:0;height:calc(30em * 1.5);background:url(${treeline()}) 0 100%/calc(96em * 1.5) calc(30em * 1.5) repeat-x}
#boot .bt-title{width:calc(${title.w}em * 1.5);height:calc(${title.h}em * 1.5);position:relative;animation:bt-float 4s ease-in-out infinite}
#boot .bt-scene{position:relative;width:${SW}em;height:${SH}em;flex:none}
#boot .bt-scene>*{position:absolute}
#boot .bt-moon{left:${moonX}em;top:${moonY}em;width:${mo.w}em;height:${mo.h}em;animation:bt-glow 5s ease-in-out infinite}
#boot .bt-cloud{width:40em;height:12em;opacity:.95;animation:bt-drift 38s linear infinite}
#boot .bt-cloud.c2{animation-duration:52s;animation-delay:-30s;top:56em!important;opacity:.8}
#boot .bt-branch{left:${brX}em;top:${brY}em;width:${br.b.w}em;height:${br.b.h}em}
#boot .bt-lamp{left:${brX + br.lantern.x - 14}em;top:${brY + br.lantern.y - 14}em;width:29em;height:29em;border-radius:50%;background:radial-gradient(circle,rgba(255,210,110,.5),rgba(255,190,90,.16) 42%,transparent 70%);animation:bt-flick 2.2s steps(3) infinite}
#boot .bt-owl{left:${owlX}em;top:${owlY}em;width:36em;height:44em;transform-origin:50% 100%}
#boot .bt-owl img{position:absolute;inset:0;width:100%;height:100%}
#boot .bt-owl .o2{animation:bt-breath 3.2s steps(1) infinite}
#boot .bt-owl .o3{opacity:0}
#boot .bt-z{width:7em;height:7em;left:${owlX + 28}em;top:${owlY + 4}em;opacity:0;animation:bt-z 3.6s linear infinite}
${zs.map((i) => `#boot .bt-z.z${i}{animation-delay:${(i * 1.2).toFixed(1)}s;width:${5 + i * 1.5}em;height:${5 + i * 1.5}em}`).join('')}
#boot .bt-ff{width:1em;height:1em;background:#f4ffb0;box-shadow:0 0 0 1em rgba(226,255,140,.28),0 0 0 2em rgba(226,255,140,.1);animation:bt-ff 7s ease-in-out infinite alternate,bt-blink 2.4s steps(2) infinite}
${ff.map(([x, y, p], i) => `#boot .bt-ff.f${i}{left:${x}em;top:${y}em;animation-duration:${6 + p * 1.7}s,${1.6 + (i % 3) * 0.7}s;animation-delay:${-i * 1.3}s,${-i * 0.4}s;animation-name:bt-ff${p},bt-blink}`).join('')}
#boot .bt-meter{display:flex;gap:2em;padding:2em 3em;background:rgba(8,10,30,.55);box-shadow:0 0 0 1em #0a0d22,0 0 0 2em #3a4688,0 0 0 3em #0a0d22;position:relative}
#boot .bt-ph{width:${ph.S}em;height:${ph.S}em;position:relative}
#boot .bt-ph u,#boot .bt-ph s{position:absolute;inset:0;background:url(${ph.url}) 0 0/${ph.S * ph.n}em ${ph.S}em no-repeat}
#boot .bt-ph u{filter:brightness(.38) saturate(.4)}
#boot .bt-ph s{opacity:0;animation:bt-lit .5s steps(3) forwards}
${Array.from({ length: ph.n }, (_, i) => `#boot .bt-ph.p${i} u,#boot .bt-ph.p${i} s{background-position:-${i * ph.S}em 0}#boot .bt-ph.p${i} s{animation-delay:${(0.4 + i * 0.75).toFixed(2)}s}`).join('')}
#boot.ready .bt-ph s{animation:bt-lit .3s steps(3) forwards,bt-pulse 1.6s steps(2) .4s infinite}
#boot .bt-cap{position:relative;height:${cap1.h}em}
#boot .bt-cap img{height:100%;width:auto;margin:0 auto}
#boot .bt-cap .c2{position:absolute;left:50%;top:0;transform:translateX(-50%);opacity:0}
#boot.ready{cursor:pointer}
#boot.ready .bt-cap .c1{opacity:0}
#boot.ready .bt-cap .c2{opacity:1;animation:bt-tap 1.2s steps(2) infinite}
#boot.wake .bt-owl .o1,#boot.wake .bt-owl .o2{opacity:0;animation:none}
#boot.wake .bt-owl .o3{opacity:1}
#boot.wake .bt-owl{animation:bt-hop .5s cubic-bezier(.3,1.6,.5,1)}
#boot.wake .bt-z{animation:none;opacity:0}
#boot.zoom .bt-scene{transition:transform 1.25s cubic-bezier(.6,0,.9,.4);transform:scale(7);transform-origin:${((owlX + 18) / SW) * 100}% ${((owlY + 16) / SH) * 100}%}
#boot.zoom .bt-title,#boot.zoom .bt-meter,#boot.zoom .bt-cap{transition:opacity .4s;opacity:0}
#boot.zoom{transition:opacity .7s ease .75s;opacity:0;pointer-events:none}
@keyframes bt-tw{50%{opacity:.45}}
@keyframes bt-float{50%{transform:translateY(-1.5em)}}
@keyframes bt-glow{50%{filter:brightness(1.08)}}
@keyframes bt-drift{from{transform:translateX(-50em)}to{transform:translateX(140em)}}
@keyframes bt-flick{33%{opacity:.82}66%{opacity:.95}}
@keyframes bt-breath{0%{opacity:0}50%{opacity:1}}
@keyframes bt-z{0%{opacity:0;transform:translate(0,0)}12%{opacity:1}50%{transform:translate(6em,-10em)}80%{opacity:.9}100%{opacity:0;transform:translate(3em,-20em)}}
@keyframes bt-ff1{to{transform:translate(9em,-6em)}}@keyframes bt-ff2{to{transform:translate(-8em,5em)}}@keyframes bt-ff3{to{transform:translate(6em,8em)}}
@keyframes bt-blink{50%{opacity:.25}}
@keyframes bt-lit{0%{opacity:0;transform:scale(1.4)}100%{opacity:1;transform:scale(1)}}
@keyframes bt-pulse{50%{filter:brightness(1.25)}}
@keyframes bt-tap{50%{transform:translate(-50%,-1em)}}
@keyframes bt-hop{30%{transform:translateY(-5em) scale(.94,1.08)}70%{transform:translateY(0) scale(1.06,.94)}}
@media (prefers-reduced-motion:reduce){#boot *{animation-duration:0s!important;animation-iteration-count:1!important}}
`.trim();

const html = `<!-- boot:begin (generated by src/onboard/tools/bootart.mjs; edit the generator, not this block) -->
    <style>${css}</style>
    <div id="boot" aria-label="Hoot Hollow is loading">
      <i class="bt-stars"></i><i class="bt-stars2"></i><i class="bt-trees"></i>
      <img class="bt-title" src="${title.url}" alt="Hoot Hollow" />
      <div class="bt-scene">
        <img class="bt-moon" src="${mo.url}" alt="" />
        <img class="bt-cloud" style="left:0;top:20em" src="${cloud(1)}" alt="" /><img class="bt-cloud c2" style="left:0" src="${cloud(2)}" alt="" />
        <i class="bt-lamp"></i>
        <img class="bt-branch" src="${br.b.url()}" alt="" />
        <div class="bt-owl"><img class="o1" src="${sleep}" alt="" /><img class="o2" src="${breath}" alt="" /><img class="o3" src="${peek}" alt="" /></div>
        ${zs.map((i) => `<img class="bt-z z${i}" src="${zed()}" alt="" />`).join('')}
        ${ff.map((_, i) => `<b class="bt-ff f${i}"></b>`).join('')}
      </div>
      <div class="bt-meter">${Array.from({ length: ph.n }, (_, i) => `<i class="bt-ph p${i}"><u></u><s></s></i>`).join('')}</div>
      <div class="bt-cap"><img class="c1" src="${cap1.url}" alt="Pip is dreaming" /><img class="c2" src="${cap2.url}" alt="Tap to wake Pip" /></div>
    </div>
    <!-- boot:end -->`;

const file = fileURLToPath(new URL('../../../index.html', import.meta.url));
const src = readFileSync(file, 'utf8');
const a = src.indexOf('<!-- boot:begin'), z = src.indexOf('<!-- boot:end -->');
if (a < 0 || z < 0) throw new Error('boot markers missing in index.html');
writeFileSync(file, src.slice(0, a) + html + src.slice(z + '<!-- boot:end -->'.length));
console.log('boot block written:', (html.length / 1024).toFixed(1), 'KB');
