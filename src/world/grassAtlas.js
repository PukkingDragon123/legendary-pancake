// The forest-floor atlas from Moleforge (Burrowsmith), reused as-is: 26 hand-pixelled 32x32 cells
// of woodland grass, wildflowers, ferns, moss, reeds and leaf litter, drawn procedurally.
// Original: curly-enigma/src/bookends/forest/grass.js. Only the canvas/rng helpers are inlined here.

class PixelCanvas {
  constructor(w, h = w) {
    this.w = w; this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(w, h);
    this.d = this.img.data;
  }
  set(x, y, c, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a < 255 && this.d[i + 3] > 0) {
      const t = a / 255;
      this.d[i] = this.d[i] * (1 - t) + ((c >> 16) & 255) * t;
      this.d[i + 1] = this.d[i + 1] * (1 - t) + ((c >> 8) & 255) * t;
      this.d[i + 2] = this.d[i + 2] * (1 - t) + (c & 255) * t;
      this.d[i + 3] = Math.max(this.d[i + 3], a);
      return;
    }
    this.d[i] = (c >> 16) & 255; this.d[i + 1] = (c >> 8) & 255; this.d[i + 2] = c & 255; this.d[i + 3] = a;
  }
  rect(x, y, w, h, c, a = 255) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c, a); }
  line(x0, y0, x1, y1, c, a = 255) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  commit() { this.ctx.putImageData(this.img, 0, 0); return this.canvas; }
}

function makeRng(seed) {
  let s = seed >>> 0;
  const rng = () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.range = (a, b) => a + rng() * (b - a);
  rng.int = (a, b) => Math.floor(a + rng() * (b - a + 1));
  rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
  rng.chance = (p) => rng() < p;
  return rng;
}

/** A filled ellipse (Moleforge's lumpy blob, without the lumps: only used for dandelion clocks). */
function blob(pc, cx, cy, rx, ry, c) {
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) pc.set(x, y, c);
}

export const CELL = 32;
export const FG = {
  short: 0, mid: 1, tall: 2, daisy: 3, buttercup: 4, bluebell: 5, anemone: 6, campion: 7, forgetme: 8,
  strawberry: 9, foxglove: 10, clover: 11, moss: 12, dry: 13, fern: 14, bracken: 15, reed: 16, cattail: 17, sorrel: 18, seed: 19,
  garlic: 20, violet: 21, primrose: 22, shade: 23, litter: 24, woodrush: 25,
};
export const NCELL = 26;

export function paintGrassAtlas() {
  const pc = new PixelCanvas(CELL * NCELL, CELL);
  const rng = makeRng(177);
  const RAMP = [0x2a4a22, 0x386228, 0x4a7c30, 0x62943a, 0x84ac48, 0xb0c060];
  const DRY = [0x6a5a30, 0x8a7438, 0xa88e44, 0xc4a858, 0xdcc478];
  const blade = (ox, x0, hgt, lean, ramp = RAMP, w = 1) => {
    for (let y = 0; y < hgt; y++) {
      const t = y / Math.max(1, hgt - 1);
      const x = Math.round(x0 + lean * t * t * hgt);
      const ci = Math.min(ramp.length - 1, Math.floor(t * (ramp.length - 0.01)));
      pc.set(ox + x, CELL - 1 - y, ramp[ci]);
      if (w > 1 && t < 0.4) pc.set(ox + x + 1, CELL - 1 - y, ramp[Math.max(0, ci - 1)]);
    }
    return Math.round(x0 + lean * hgt);
  };
  const field = (c, n, hMin, hMax, ramp = RAMP) => {
    for (let i = 0; i < n; i++) blade(c * CELL, rng.range(2, CELL - 3), Math.round(rng.range(hMin, hMax)), rng.range(-0.35, 0.35), ramp, rng.chance(0.3) ? 2 : 1);
  };
  const stem = (c, x, h, lean = 0) => blade(c * CELL, x, h, lean, [0x2e5a26, 0x3e7a30, 0x4e8a34]);
  field(FG.short, 22, 5, 11);
  field(FG.mid, 20, 9, 18);
  field(FG.tall, 14, 14, 25);
  for (let i = 0; i < 6; i++) { // golden seed heads catching the light
    const ox = FG.tall * CELL, x = Math.round(rng.range(4, CELL - 5)), h = Math.round(rng.range(22, 29));
    blade(ox, x, h, rng.range(-0.2, 0.2), [0x3a6a2c, 0x6a9a3e, 0xa8b858]);
    for (let k = 0; k < 4; k++) pc.set(ox + x + (k % 2), CELL - 1 - h + k, k < 2 ? 0xf0dc90 : 0xd8c070);
  }
  const flower = (c, x, h, petal, heart, lean = 0) => {
    const tx = stem(c, x, h, lean), ty = CELL - 1 - h, ox = c * CELL;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pc.set(ox + tx + dx, ty + dy, petal);
    pc.set(ox + tx, ty, heart);
  };
  for (const [c, petal, heart, n] of [[FG.daisy, 0xfff8f0, 0xffd040, 4], [FG.buttercup, 0xffe040, 0xfff6a0, 5], [FG.anemone, 0xf8f4ff, 0xf0e070, 5], [FG.campion, 0xf070a0, 0xc04070, 4], [FG.clover, 0xf0b0d8, 0xc070b0, 4]]) {
    field(c, 10, 4, 10);
    for (let i = 0; i < n; i++) flower(c, Math.round(rng.range(4, CELL - 5)), Math.round(rng.range(8, 16)), petal, heart, rng.range(-0.15, 0.15));
  }
  { // bluebells: arching stems with nodding bells down one side
    const c = FG.bluebell, ox = c * CELL;
    field(c, 8, 6, 12, [0x2e5a2a, 0x3e7230, 0x4e8a3a]);
    for (let i = 0; i < 4; i++) {
      const x = Math.round(rng.range(5, CELL - 8)), h = Math.round(rng.range(13, 19));
      const tx = stem(c, x, h, 0.15);
      for (let b = 0; b < 4; b++) { const by = CELL - h + b * 2 + 1; pc.set(ox + tx + 1, by, 0x6a6ae8); pc.set(ox + tx + 1, by + 1, 0x4a4ac0); pc.set(ox + tx + 2, by + 1, 0x8a8af0); }
    }
  }
  { // forget-me-nots: tiny sky-blue sprays
    const c = FG.forgetme, ox = c * CELL;
    field(c, 12, 3, 8);
    for (let i = 0; i < 9; i++) { const x = Math.round(rng.range(3, CELL - 4)), y = CELL - Math.round(rng.range(6, 12)); pc.set(ox + x, y, 0x78b8f8); pc.set(ox + x + 1, y, 0x98c8ff); pc.set(ox + x, y + 1, 0x5898e0); pc.set(ox + x + 1, y + 1, 0xf8e070); }
  }
  { // wild strawberries: trefoil leaves, white flowers and red berries
    const c = FG.strawberry, ox = c * CELL;
    for (let i = 0; i < 6; i++) { const x = Math.round(rng.range(3, CELL - 5)), h = Math.round(rng.range(4, 8)); const tx = stem(c, x, h); pc.rect(ox + tx - 1, CELL - 1 - h - 1, 3, 2, 0x4a8a34); pc.set(ox + tx, CELL - h - 3, 0x5a9a3a); }
    for (let i = 0; i < 4; i++) { const x = Math.round(rng.range(4, CELL - 5)), y = CELL - Math.round(rng.range(3, 7)); pc.set(ox + x, y, 0xe02a2a); pc.set(ox + x, y + 1, 0xb81e1e); pc.set(ox + x + 1, y, 0xff6a5a); }
    for (let i = 0; i < 3; i++) { const x = Math.round(rng.range(4, CELL - 5)), y = CELL - Math.round(rng.range(8, 10)); pc.set(ox + x, y, 0xfffaf0); pc.set(ox + x + 1, y, 0xfffaf0); pc.set(ox + x, y - 1, 0xfffaf0); }
  }
  { // foxglove spikes (sprite version for the distance)
    const c = FG.foxglove, ox = c * CELL;
    for (let i = 0; i < 2; i++) {
      const x = 10 + i * 11, h = 26 - i * 5;
      stem(c, x, h);
      for (let y = 6; y < h - 2; y += 2) { const yy = CELL - 1 - y; pc.set(ox + x + (y % 4 ? 1 : -1), yy, 0xd060b0); pc.set(ox + x + (y % 4 ? 1 : -1), yy + 1, 0xa04090); pc.set(ox + x + (y % 4 ? 2 : -2), yy + 1, 0xf0a0d8); }
      for (let l = 0; l < 4; l++) blade(ox, x - 3 + l * 2, 5, (l - 1.5) * 0.4, [0x3e6a30, 0x5a8a40]);
    }
  }
  { // moss tufts with sporophytes
    const c = FG.moss, ox = c * CELL;
    for (let x = 2; x < CELL - 2; x++) { const h = 2 + Math.round(Math.sin(x * 0.7) * 1.5 + rng.range(0, 2)); for (let y = 0; y < h; y++) pc.set(ox + x, CELL - 1 - y, y === h - 1 ? 0x8aac48 : 0x5a8030); }
    for (let i = 0; i < 6; i++) { const x = Math.round(rng.range(3, CELL - 4)), h = Math.round(rng.range(6, 10)); for (let y = 3; y < h; y++) pc.set(ox + x, CELL - 1 - y, 0xa0903a); pc.set(ox + x, CELL - 1 - h, 0xd0a050); }
  }
  field(FG.dry, 18, 8, 20, DRY);
  { // fern and bracken fronds
    for (const [c, ramp] of [[FG.fern, [0x2e6a2a, 0x4a9a3a, 0x7ac04e, 0x5aa840]], [FG.bracken, [0x6a6a2a, 0x8a8a34, 0xb0a040, 0x9a9038]]]) {
      const ox = c * CELL;
      for (let f = 0; f < 7; f++) {
        const a = -1.2 + (f / 6) * 2.4, len = rng.range(10, 15);
        for (let s = 0; s < len; s++) {
          const t = s / len;
          const x = 16 + Math.sin(a) * s * 1.05, y = CELL - 1 - (Math.cos(a) * s * 1.1 - t * t * 5);
          pc.set(ox + Math.round(x), Math.round(y), t < 0.3 ? ramp[0] : t < 0.7 ? ramp[1] : ramp[2]);
          if (s % 2 === 0 && s > 1) { pc.set(ox + Math.round(x - Math.cos(a)), Math.round(y - Math.sin(a) * 0.5) + 1, ramp[3]); pc.set(ox + Math.round(x + Math.cos(a)), Math.round(y + Math.sin(a) * 0.5) + 1, ramp[3]); }
        }
      }
    }
  }
  { // reeds
    const ox = FG.reed * CELL;
    const R = [0x3a6a3a, 0x4e8a44, 0x6aa850, 0x9ac868, 0xc8e090];
    for (let i = 0; i < 14; i++) blade(ox, rng.range(3, CELL - 4), Math.round(rng.range(16, 31)), rng.range(-0.45, 0.45), R);
  }
  { // cattails
    const c = FG.cattail, ox = c * CELL;
    field(c, 8, 10, 22);
    for (let i = 0; i < 4; i++) {
      const x = Math.round(rng.range(5, CELL - 6)), h = Math.round(rng.range(24, 30));
      const tx = blade(ox, x, h, rng.range(-0.1, 0.1), [0x3a6a2a, 0x5a8a3a, 0x7a9a4a]);
      for (let k = 0; k < 5; k++) { pc.set(ox + tx, CELL - h + k, 0x7a5030); pc.set(ox + tx + 1, CELL - h + k, 0x5e3e24); }
    }
  }
  { // wood sorrel: clover-like leaves, tiny white-pink flowers
    const c = FG.sorrel, ox = c * CELL;
    for (let i = 0; i < 9; i++) { const x = Math.round(rng.range(3, CELL - 5)), h = Math.round(rng.range(3, 7)); const tx = stem(c, x, h); pc.rect(ox + tx - 1, CELL - 2 - h, 3, 1, 0x6ab048); pc.set(ox + tx, CELL - 3 - h, 0x7ac058); }
    for (let i = 0; i < 4; i++) { const x = Math.round(rng.range(4, CELL - 5)); pc.set(ox + x, CELL - 9, 0xfff0f4); pc.set(ox + x + 1, CELL - 9, 0xf0c8d8); }
  }
  { // dandelion clocks (seed heads)
    const c = FG.seed, ox = c * CELL;
    field(c, 8, 3, 8);
    for (let i = 0; i < 4; i++) { const x = Math.round(rng.range(5, CELL - 6)), h = Math.round(rng.range(12, 18)); const tx = stem(c, x, h); blob(pc, ox + tx, CELL - 1 - h - 1, 2.2, 2.2, 0xf8f8f0); pc.set(ox + tx, CELL - 2 - h, 0xd8d8c8); }
  }
  { // wild garlic: broad glossy leaves, white starry umbels on bare stems
    const c = FG.garlic, ox = c * CELL;
    const LV = [0x2e6a2e, 0x3e8236, 0x58a044, 0x7cbc58];
    for (let i = 0; i < 7; i++) {
      const x0 = rng.range(6, CELL - 7), h = Math.round(rng.range(7, 13)), lean = rng.range(-0.25, 0.25);
      for (let y = 0; y < h; y++) {
        const t = y / h, w = Math.round(Math.sin(t * Math.PI) * 2.2);
        const x = Math.round(x0 + lean * t * t * h);
        for (let k = -w; k <= w; k++) pc.set(ox + x + k, CELL - 1 - y, LV[Math.min(3, (k === -w ? 3 : k === w ? 1 : 2) - (t < 0.3 ? 1 : 0))]);
      }
    }
    for (let i = 0; i < 3; i++) {
      const x = Math.round(rng.range(6, CELL - 7)), h = Math.round(rng.range(15, 20));
      const tx = stem(c, x, h, rng.range(-0.1, 0.1)), ty = CELL - 1 - h;
      for (const [dx, dy] of [[0, 0], [-2, 1], [2, 1], [-1, -1], [1, -1], [0, 2], [-3, -1], [3, 0]]) pc.set(ox + tx + dx, ty + dy, (dx + dy) % 2 ? 0xfffff4 : 0xe8f0e0);
    }
  }
  { // violets: heart-shaped leaves, little purple flowers held just above them
    const c = FG.violet, ox = c * CELL;
    for (let i = 0; i < 8; i++) { const x = Math.round(rng.range(3, CELL - 5)), h = Math.round(rng.range(3, 6)); const tx = stem(c, x, h); pc.rect(ox + tx - 1, CELL - 2 - h, 3, 2, 0x3e7a34); pc.set(ox + tx, CELL - 3 - h, 0x4e8a3a); }
    for (let i = 0; i < 6; i++) {
      const x = Math.round(rng.range(4, CELL - 6)), h = Math.round(rng.range(7, 10)), tx = stem(c, x, h, 0.2), ty = CELL - 1 - h;
      pc.set(ox + tx, ty, 0x7a4ac8); pc.set(ox + tx + 1, ty, 0x9a6ae0); pc.set(ox + tx, ty - 1, 0x6a3ab0); pc.set(ox + tx + 1, ty + 1, 0x5a2aa0); pc.set(ox + tx - 1, ty, 0xb08af0);
    }
  }
  { // primroses: a rosette of crinkled leaves and pale yellow flowers
    const c = FG.primrose, ox = c * CELL;
    for (let i = 0; i < 9; i++) { const a = -1.3 + i * 0.32, len = rng.range(5, 8); for (let s = 0; s < len; s++) { const x = 16 + Math.sin(a) * s * 1.4, y = CELL - 1 - Math.cos(a) * s * 0.7; pc.set(ox + Math.round(x), Math.round(y), s < 2 ? 0x3e7232 : s % 2 ? 0x6aa448 : 0x5a9440); } }
    for (let i = 0; i < 6; i++) {
      const x = Math.round(rng.range(8, CELL - 9)), y = CELL - Math.round(rng.range(6, 9));
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) pc.set(ox + x + dx, y + dy, 0xfff0a0);
      pc.set(ox + x, y, 0xf0b030);
    }
  }
  field(FG.shade, 18, 6, 14, [0x1e3a24, 0x284a2a, 0x345c30, 0x426c36, 0x58804a]); // lush blue-green grass of the deep shade
  { // leaf litter: a low drift of fallen leaves, twigs and a sprig or two coming through
    const c = FG.litter, ox = c * CELL;
    const L = [0x8a5a2a, 0xa86a30, 0xc88a3a, 0x6e4a26, 0xb89a48, 0x7a6a34];
    for (let i = 0; i < 16; i++) { const x = Math.round(rng.range(2, CELL - 4)), y = CELL - 1 - Math.round(rng.range(0, 3)), col = L[rng.int(0, 5)]; pc.rect(ox + x, y, 2 + (i % 2), 1, col); pc.set(ox + x + 1, y - 1, fshadeHex(col, 1.15)); }
    for (let i = 0; i < 3; i++) { const x = Math.round(rng.range(3, CELL - 9)); pc.line(ox + x, CELL - 2, ox + x + 6, CELL - 3 - (i % 2), 0x5a4228); }
    for (let i = 0; i < 3; i++) blade(ox, rng.range(4, CELL - 5), Math.round(rng.range(4, 8)), rng.range(-0.3, 0.3));
  }
  { // woodrush: soft arching tufts with brown seed sprays
    const c = FG.woodrush, ox = c * CELL;
    for (let i = 0; i < 12; i++) blade(ox, 16 + rng.range(-3, 3), Math.round(rng.range(9, 16)), (i % 2 ? 1 : -1) * rng.range(0.5, 1.1), [0x2e5226, 0x3e6a2e, 0x5a8a3a, 0x7aa446], 2);
    for (let i = 0; i < 3; i++) { const x = Math.round(rng.range(10, 22)), h = Math.round(rng.range(16, 22)); const tx = stem(c, x, h, rng.range(-0.3, 0.3)); for (let k = 0; k < 4; k++) pc.set(ox + tx + rng.int(-2, 2), CELL - 1 - h + rng.int(0, 2), k % 2 ? 0x8a6a3a : 0x6a4a2a); }
  }
  return pc.commit();
}
/** A hex colour scaled by f (clamped). */
function fshadeHex(c, f) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f)), g = Math.min(255, Math.round(((c >> 8) & 255) * f)), b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}
