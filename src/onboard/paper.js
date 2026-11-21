// Vendored from The Bear Must Eat (src/ui/paper.js): procedural low-res dithered paper textures
// and desk props (tape, clips, pencils, seals...). Trimmed to the texture and deco painters; the
// modal-paper system and HTML helpers are left out (the interview clipboard has its own).
import { hasSprite, spriteCanvas } from '../ui/px/sprites.js';


export const PX = 3; // CSS px per texel

// ===========================================================================
// small utils
// ===========================================================================
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function hexc(h) {
  let s = String(h).replace('#', '');
  if (s.length <= 4) s = s.split('').map((c) => c + c).join('');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rng(seed = 1) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const dq = (v, x, y, n) => clamp(Math.floor(v + bayer(x, y)), 0, n - 1);
const md = (a, p) => ((a % p) + p) % p;
function vnoise(x, y, px, py, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const x0 = md(xi, px), x1 = md(xi + 1, px), y0 = md(yi, py), y1 = md(yi + 1, py);
  const a = hash(x0, y0, s), b = hash(x1, y0, s), c = hash(x0, y1, s), d = hash(x1, y1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// periodic fbm over a w x h texel area, in [0, 1]
function fbm(x, y, w, h, cell, oct, s) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    const p = Math.max(1, cell / (1 << o));
    sum += amp * vnoise(x / p, y / p, Math.max(1, Math.round(w / p)), Math.max(1, Math.round(h / p)), s + o * 17);
    norm += amp; amp *= 0.5;
  }
  return sum / norm;
}

// RGBA texel buffer
class Buf {
  constructor(w, h, wrap = false) { this.w = w; this.h = h; this.wrap = wrap; this.d = new Uint8ClampedArray(w * h * 4); }
  i(x, y) {
    x = Math.round(x); y = Math.round(y);
    if (this.wrap) { x = md(x, this.w); y = md(y, this.h); } else if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return (y * this.w + x) * 4;
  }
  set(x, y, c, a = 255) { const i = this.i(x, y); if (i < 0) return; const d = this.d; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; }
  // tint an opaque-ish pixel toward c
  mix(x, y, c, t) {
    const i = this.i(x, y); if (i < 0) return; const d = this.d;
    if (!d[i + 3]) return;
    d[i] += (c[0] - d[i]) * t; d[i + 1] += (c[1] - d[i + 1]) * t; d[i + 2] += (c[2] - d[i + 2]) * t;
  }
  // source-over
  over(x, y, c, a) {
    const i = this.i(x, y); if (i < 0) return; const d = this.d;
    const da = d[i + 3] / 255, oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }
  alpha(x, y, a) { const i = this.i(x, y); if (i >= 0) this.d[i + 3] = a; }
  getA(x, y) { const i = this.i(x, y); return i < 0 ? 0 : this.d[i + 3]; }
  canvas() {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const x = c.getContext('2d');
    x.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
  url() { return this.canvas().toDataURL(); }
}

// ===========================================================================
// paper kinds
// ===========================================================================
const KINDS = {
  parchment: { ramp: ['#9c7646', '#bb945e', '#d4b078', '#e6c994', '#f1dcae', '#f8eaca'], base: 3.3, amp: 1.5, cell: 24, grain: 0.7, fibres: 0.02, fibLen: 6, specks: 0.004, tile: [96, 96] },
  cream: { ramp: ['#cbb88e', '#e0d0aa', '#ede1c2', '#f6eed8', '#fcf7ea'], base: 3.0, amp: 0.7, cell: 24, grain: 0.6, fibres: 0.012, fibLen: 4, specks: 0.002, tile: [96, 96] },
  notebook: { ramp: ['#cbb88e', '#e0d0aa', '#ede1c2', '#f6eed8', '#fcf7ea'], base: 3.0, amp: 0.6, cell: 24, grain: 0.55, fibres: 0.01, fibLen: 4, specks: 0.0015, tile: [96, 96], rules: 8 },
  graph: { ramp: ['#c9c9bc', '#dedfd2', '#eceee2', '#f5f7ee', '#fcfdf8'], base: 3.1, amp: 0.5, cell: 24, grain: 0.5, fibres: 0.008, fibLen: 3, specks: 0.001, tile: [96, 96], grid: 4 },
  kraft: { ramp: ['#6a4428', '#81573a', '#966948', '#a97b56', '#bb8e66', '#cba078'], base: 3.0, amp: 1.0, cell: 24, grain: 0.9, fibres: 0.05, fibLen: 7, specks: 0.01, tile: [96, 96] },
  postcard: { ramp: ['#cfc6b0', '#e2dbc8', '#eee8d8', '#f6f2e6', '#fcfaf2'], base: 3.0, amp: 0.55, cell: 24, grain: 0.6, fibres: 0.012, fibLen: 3, specks: 0.002, tile: [96, 96] },
  book: { ramp: ['#a58152', '#bf9b68', '#d4b47e', '#e3c896', '#eed8aa', '#f6e6c0'], base: 3.5, amp: 1.0, cell: 24, grain: 0.65, fibres: 0.015, fibLen: 4, specks: 0.004, tile: [96, 96] },
  sticky: { ramp: ['#d49e1c', '#e6b62a', '#f2c83c', '#f9d856', '#fde374', '#fff0a0'], base: 3.4, amp: 0.55, cell: 24, grain: 0.55, fibres: 0.006, fibLen: 3, specks: 0.001, tile: [96, 96] },
  receipt: { ramp: ['#c4c2bb', '#d9d7cf', '#e7e5de', '#f1f0ea', '#f9f8f4'], base: 3.1, amp: 0.4, cell: 24, grain: 0.5, fibres: 0.004, fibLen: 3, specks: 0.001, tile: [96, 96], streaks: 1 },
  cardboard: { ramp: ['#6a4526', '#7f5534', '#946642', '#a6764e', '#b8885c', '#c89a6c'], base: 3.0, amp: 0.9, cell: 24, grain: 0.7, fibres: 0.03, fibLen: 8, specks: 0.008, tile: [96, 96], flutes: 6 },
  cork: { ramp: ['#6c4620', '#87602f', '#a1773f', '#b68b4f', '#c89e62', '#d6b278'], base: 3.0, amp: 1.0, cell: 12, grain: 1.6, fibres: 0, specks: 0, tile: [96, 96], granules: 1 },
  wood: { ramp: ['#2c190d', '#3f2414', '#52301b', '#663d22', '#7a4b2b', '#8f5a35', '#a56b40'], tile: [128, 88], wood: 1 },
  leather: { ramp: ['#2e0f0c', '#481812', '#621f17', '#7c2a1e', '#953626', '#ad4632'], base: 3.0, amp: 1.0, cell: 12, grain: 1.2, fibres: 0, specks: 0.004, tile: [64, 64] },
  board: { ramp: ['#4e321b', '#634024', '#764e2d', '#895d36', '#9a6c41'], base: 2.6, amp: 0.7, cell: 24, grain: 0.8, fibres: 0.01, fibLen: 3, specks: 0.006, tile: [96, 96] },
};
KINDS.spread = { ...KINDS.book };
export const PAPER_KINDS = Object.keys(KINDS);

const INK_BLUE = hexc('#9dbde3'), INK_BLUE2 = hexc('#7ea6d8'), MARGIN_RED = hexc('#e48888');

function paintBase(b, K, seed) {
  const C = K.ramp.map(hexc), n = C.length, R = rng(seed);
  const { w, h } = b;
  if (K.wood) { paintWood(b, C, seed); return C; }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = K.base + (fbm(x, y, w, h, K.cell, 3, seed) - 0.5) * K.amp * 2 + (R() - 0.5) * K.grain;
      if (K.flutes) v += Math.sin((x / K.flutes) * Math.PI * 2) * 0.45;
      if (K.streaks) v += (fbm(x * 0.05, y, w * 0.05, h, 6, 1, seed + 5) - 0.5) * 0.8;
      if (K.granules) v += (hash(x >> 1, y >> 1, seed + 3) - 0.5) * 1.2;
      b.set(x, y, C[dq(v, x, y, n)]);
    }
  }
  // fibres: short light/dark strands
  const nf = Math.round(w * h * (K.fibres || 0));
  for (let k = 0; k < nf; k++) {
    const x0 = R() * w, y0 = R() * h, a = R() * Math.PI * 2, len = 2 + R() * (K.fibLen || 4);
    const col = R() < 0.55 ? C[n - 1] : C[Math.max(0, Math.round(K.base) - 2)];
    const t = 0.35 + R() * 0.35;
    let cx = Math.cos(a), cy = Math.sin(a) * 0.6;
    for (let s = 0; s < len; s++) { b.mix(x0 + cx * s, y0 + cy * s, col, t); if (R() < 0.3) { cy += (R() - 0.5) * 0.6; } }
  }
  const ns = Math.round(w * h * (K.specks || 0));
  for (let k = 0; k < ns; k++) b.mix(R() * w, R() * h, C[0], 0.35 + R() * 0.4);
  if (K.granules) {
    for (let k = 0; k < w * h * 0.05; k++) {
      const x = R() * w, y = R() * h, dark = R() < 0.6;
      const col = dark ? C[0] : C[n - 1];
      b.mix(x, y, col, 0.5); if (R() < 0.5) b.mix(x + 1, y, col, 0.35); if (R() < 0.3) b.mix(x, y + 1, col, 0.35);
    }
  }
  return C;
}

function paintWood(b, C, seed) {
  const { w, h } = b, n = C.length, R = rng(seed), PH = 22;
  const planks = Math.ceil(h / PH);
  const info = [];
  for (let p = 0; p < planks + 1; p++) info.push({ base: 3.1 + (hash(p, 1, seed) - 0.5) * 1.6, jx: Math.floor(hash(p, 2, seed) * w), ph: hash(p, 3, seed) * 10 });
  const knots = [];
  for (let k = 0; k < Math.max(1, Math.round(w * h / 4000)); k++) knots.push({ x: R() * w, y: R() * h, rx: 4 + R() * 4, ry: 1.6 + R() * 1.2 });
  for (let y = 0; y < h; y++) {
    const p = Math.floor(y / PH), yy = y - p * PH, I = info[p % info.length];
    for (let x = 0; x < w; x++) {
      const warp = fbm(x, y, w, h, 32, 3, seed + p) * 7;
      let v = I.base + Math.sin((y * 0.8 + warp + I.ph) * 1.25) * 0.55 + (fbm(x, y * 3, w, h * 3, 16, 2, seed + 9) - 0.5) * 1.2 + (R() - 0.5) * 0.35;
      for (const k of knots) {
        let dx = x - k.x; dx -= Math.round(dx / w) * w;
        let dy = y - k.y; dy -= Math.round(dy / h) * h;
        const d = Math.hypot(dx / k.rx, dy / k.ry);
        if (d < 2.2) v += (d < 1 ? -1.6 * (1 - d) : 0) + Math.sin(d * 4.5) * 0.5 * (2.2 - d) / 2.2;
      }
      let jd = x - I.jx; jd -= Math.round(jd / w) * w;
      if (yy === 0) v = 0.4;
      else if (yy === 1) v += 1.1;
      else if (yy === PH - 1) v -= 0.9;
      if (jd === 0 && yy > 0) v = 0.6;
      else if (jd === 1 && yy > 0) v += 0.8;
      if ((jd === 3 || jd === -3) && (yy === 4 || yy === PH - 5)) v = jd > 0 ? 0.3 : 0.5;
      b.set(x, y, C[dq(v, x, y, n)]);
    }
  }
}

// ---- finishing for sized (non tiling) sheets
function edgeDist(x, y, w, h) { return Math.min(x, y, w - 1 - x, h - 1 - y); }

function paintRules(b, C, o) {
  const { w, h } = b, R = rng(o.seed + 77);
  const step = o.rules || 8, top = o.ruleTop ?? step;
  for (let y = top - 1; y < h - 1; y += step) {
    for (let x = 0; x < w; x++) if (R() > 0.025) b.mix(x, y, INK_BLUE, 0.8);
  }
  if (o.margin != null) {
    for (let y = 0; y < h; y++) {
      if (R() > 0.03) b.mix(o.margin, y, MARGIN_RED, 0.85);
      if (R() > 0.06) b.mix(o.margin + 2, y, MARGIN_RED, 0.7);
    }
  }
}
function paintGrid(b, step) {
  const { w, h } = b;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const big = x % (step * 4) === 0 || y % (step * 4) === 0;
    if (big) b.mix(x, y, INK_BLUE2, 0.55);
    else if (x % step === 0 || y % step === 0) b.mix(x, y, INK_BLUE, 0.35);
  }
}
function coffeeRing(b, cx, cy, r, seed, strength = 1) {
  const R = rng(seed), col = hexc('#8a5428'), dark = hexc('#6a3c1a');
  const gap0 = R() * Math.PI * 2, gapW = 0.5 + R() * 0.9;
  for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y++) for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const rr = r + Math.sin(a * 3 + seed) * 0.7;
    let ga = Math.abs(((a - gap0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    const fade = ga < gapW ? ga / gapW : 1;
    if (d > rr - 1.4 && d < rr + 0.6) {
      if (bayer(x, y) < 0.85 * fade * strength) b.mix(x, y, d > rr - 0.4 ? dark : col, 0.32);
    } else if (d < rr - 1.4) {
      if (bayer(x, y) < 0.18 * strength && R() < 0.5) b.mix(x, y, col, 0.12);
    }
  }
  // a couple of drips
  for (let k = 0; k < 3; k++) {
    const a = R() * Math.PI * 2, d = r + 3 + R() * 4;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    b.mix(x, y, col, 0.35); if (R() < 0.5) b.mix(x + 1, y, col, 0.25);
  }
}
function crease(b, C, y0, seed, vertical = false) {
  const { w, h } = b, n = C.length;
  const len = vertical ? h : w;
  for (let s = 0; s < len; s++) {
    const off = Math.round((fbm(s, 0, len, 1, 24, 2, seed) - 0.5) * 2);
    if (hash(s, 9, seed) < 0.12) continue;
    if (vertical) { b.mix(y0 + off, s, C[n - 1], 0.55); b.mix(y0 + off + 1, s, C[0], 0.22); } else { b.mix(s, y0 + off, C[n - 1], 0.55); b.mix(s, y0 + off + 1, C[0], 0.22); }
  }
}
function dogEar(b, C, s) {
  const { w } = b, n = C.length;
  const back = C[Math.max(0, n - 3)], line = C[0];
  for (let v = 0; v <= s + 2; v++) for (let u = 0; u <= s + 2; u++) {
    const x = w - 1 - u, y = v;
    if (u + v < s) b.alpha(x, y, 0);
    else if (u <= s && v <= s) {
      // the folded flap: lit toward the fold line
      const t = (u + v - s) / s;
      b.set(x, y, t < 0.08 ? line : back);
      if (t > 0.08 && bayer(x, y) < (1 - t) * 0.5) b.mix(x, y, C[n - 1], 0.6);
      if (u === s || v === s) b.set(x, y, C[1]);
    } else if (u + v < s + 3 && (u > s || v > s)) {
      if (bayer(x, y) < 0.5) b.mix(x, y, C[0], 0.35); // soft cast shadow under the flap
    }
  }
}
function tornEdge(b, side, seed, amp = 3, period = 4) {
  const { w, h } = b;
  for (let x = 0; x < w; x++) {
    const p = x % period, tri = Math.abs(p - period / 2) / (period / 2);
    const j = Math.round(tri * amp + (hash(x, 1, seed) < 0.25 ? 1 : 0));
    for (let k = 0; k < j; k++) {
      if (side.includes('b')) b.alpha(x, h - 1 - k, 0);
      if (side.includes('t')) b.alpha(x, k, 0);
    }
  }
}
function deckle(b, seed) {
  const { w, h } = b;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = edgeDist(x, y, w, h);
    if (d > 2) continue;
    const s = x === 0 || x === w - 1 ? y : x;
    if (d < Math.round(fbm(s, d * 7, w + h, 7, 4, 2, seed) * 3.2 - 0.6)) b.alpha(x, y, 0);
  }
}
function ageEdges(b, C, amount, E, seed) {
  const { w, h } = b, n = C.length;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = edgeDist(x, y, w, h) + (fbm(x, y, w, h, 12, 2, seed) - 0.5) * E * 0.9;
    if (d >= E) continue;
    const t = (1 - d / E) * amount;
    if (bayer(x, y) < t) b.mix(x, y, C[0], 0.32);
    if (d < 1.2 && bayer(x, y) < amount) b.mix(x, y, C[0], 0.25);
  }
}
function spine(b, C, single) {
  const { w, h } = b, cx = single ? 0 : w / 2, W = single ? 10 : 14;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.abs(x - cx);
    if (d > W) continue;
    const t = 1 - d / W;
    if (bayer(x, y) < t * t * 1.1) b.mix(x, y, C[0], 0.38);
    if (!single && d < 0.6) b.mix(x, y, C[0], 0.6);
  }
  // page-block edges (stack of pages) at left/right borders
  for (let y = 0; y < h; y++) for (let k = 0; k < 2; k++) {
    if (!single) b.mix(k, y, C[(y + k) % 2 ? 1 : 0], 0.35);
    b.mix(w - 1 - k, y, C[(y + k) % 2 ? 1 : 0], 0.35);
  }
}
function stickyShade(b, C) {
  const { w, h } = b;
  for (let y = 0; y < Math.min(h, 7); y++) for (let x = 0; x < w; x++) if (bayer(x, y) < 0.5) b.mix(x, y, C[1], 0.3);
  // curl at the bottom-right corner
  for (let y = h - 12; y < h; y++) for (let x = w - 16; x < w; x++) {
    const u = (x - (w - 16)) / 16, v = (y - (h - 12)) / 12, t = u * v;
    if (bayer(x, y) < t * 1.3) b.mix(x, y, C[0], 0.35);
  }
}
function punchHoles(b, xs, step, top) {
  const { h } = b;
  for (let y = top; y < h - 4; y += step) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 4.5) b.alpha(xs + dx, y + dy, 0);
  }
}
function leatherFinish(b, C) {
  const { w, h } = b;
  const g1 = hexc('#e5a320'), g2 = hexc('#ffd86a');
  const ins = 6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = edgeDist(x, y, w, h);
    if (d < 4 && bayer(x, y) < (4 - d) / 5) b.mix(x, y, C[0], 0.5);
    if (d === ins) b.set(x, y, (x + y) % 5 === 0 ? g2 : g1);
    if (d === ins + 2 && (x + y) % 2 === 0) b.mix(x, y, g1, 0.7);
  }
}

const tileCache = new Map();
export function paperTile(kind) {
  if (tileCache.has(kind)) return tileCache.get(kind);
  const K = KINDS[kind] || KINDS.parchment;
  const [w, h] = K.tile;
  const b = new Buf(w, h, true);
  const seed = 11 + PAPER_KINDS.indexOf(kind) * 13;
  const C = paintBase(b, K, seed);
  if (K.rules) paintRules(b, C, { rules: K.rules, ruleTop: K.rules, seed });
  if (K.grid) paintGrid(b, K.grid);
  const out = { url: b.url(), w, h, base: K.ramp[Math.max(0, Math.round(K.base || 3))] };
  tileCache.set(kind, out);
  return out;
}

const texCache = new Map();
// w, h in CSS px. opts: { px, seed, edge, deckle, creases:[fractions], vcreases, stains, dogear, torn:'t'|'b'|'tb',
//   rules, ruleTop, margin, holes, spine, single, sticky, leather }
export function paperTexture(kind, w, h, opts = {}) {
  const px = opts.px || PX;
  const tw = Math.max(4, Math.round(w / px)), th = Math.max(4, Math.round(h / px));
  const key = `${kind}|${tw}x${th}|${JSON.stringify(opts)}`;
  if (texCache.has(key)) return texCache.get(key);
  const K = KINDS[kind] || KINDS.parchment;
  const seed = opts.seed ?? (7 + PAPER_KINDS.indexOf(kind) * 31);
  const b = new Buf(tw, th, false);
  const C = paintBase(b, K, seed);
  const R = rng(seed + 101);
  if (kind === 'notebook' || opts.rules) paintRules(b, C, { rules: opts.rules || K.rules || 8, ruleTop: opts.ruleTop, margin: opts.margin, seed });
  if (kind === 'graph') paintGrid(b, K.grid);
  if (kind === 'spread' || opts.spine) spine(b, C, !!opts.single);
  if (kind === 'sticky' || opts.sticky) stickyShade(b, C);
  if (kind === 'leather' || opts.leather) leatherFinish(b, C);
  for (const f of opts.creases || []) crease(b, C, Math.round(th * f), seed + Math.round(f * 100));
  for (const f of opts.vcreases || []) crease(b, C, Math.round(tw * f), seed + 7 + Math.round(f * 100), true);
  for (let k = 0; k < (opts.stains || 0); k++) {
    const r = 9 + R() * 5;
    coffeeRing(b, tw * (0.55 + R() * 0.35), th * (0.08 + R() * 0.3), r, seed + k, 0.8);
  }
  if (opts.edge) ageEdges(b, C, opts.edge, opts.edgeW || 10, seed);
  if (opts.holes) punchHoles(b, opts.holes, 16, 10);
  if (opts.torn) tornEdge(b, opts.torn, seed);
  if (opts.deckle) deckle(b, seed);
  if (opts.dogear) dogEar(b, C, opts.dogear === true ? 9 : opts.dogear);
  const url = b.url();
  if (texCache.size > 80) texCache.delete(texCache.keys().next().value);
  texCache.set(key, url);
  return url;
}

// border-image strip: paper with jagged/torn outer edge (slice = 4 texels)
const tornCache = new Map();
function tornURL(kind, sides = 'trbl') {
  const key = kind + sides;
  if (tornCache.has(key)) return tornCache.get(key);
  const K = KINDS[kind] || KINDS.parchment;
  const N = 24, b = new Buf(N, N, true);
  paintBase(b, K, 5);
  b.wrap = false;
  const jag = (s, side) => Math.round(hash(s, side, 3) * 2.2 + (hash(s >> 1, side, 4) * 1.4));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (sides.includes('t') && y < jag(x, 1)) b.alpha(x, y, 0);
    if (sides.includes('b') && N - 1 - y < jag(x, 2)) b.alpha(x, y, 0);
    if (sides.includes('l') && x < jag(y, 3)) b.alpha(x, y, 0);
    if (sides.includes('r') && N - 1 - x < jag(y, 4)) b.alpha(x, y, 0);
  }
  const url = b.url();
  tornCache.set(key, url);
  return url;
}
const zigCache = new Map();
function zigURL(kind) {
  if (zigCache.has(kind)) return zigCache.get(kind);
  const K = KINDS[kind] || KINDS.receipt;
  const W = 16, H = 16, b = new Buf(W, H, true);
  paintBase(b, K, 9);
  b.wrap = false;
  for (let x = 0; x < W; x++) {
    const p = x % 4, d = [0, 1, 2, 1][p];
    for (let k = 0; k <= d; k++) { b.alpha(x, k, 0); b.alpha(x, H - 1 - k, 0); }
  }
  const url = b.url();
  zigCache.set(kind, url);
  return url;
}

// ===========================================================================
// decorations (texel canvases)
// ===========================================================================
const SILVER = ['#4c5064', '#7a7e94', '#a8acc0', '#d0d4e2', '#f2f4fa'].map(hexc);
const OUTL = hexc('#2a1a14');
function fromRows(rows, pal) {
  const b = new Buf(rows[0].length, rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && pal[ch]) b.set(x, y, hexc(pal[ch])); }));
  return b;
}
function outlineBuf(b, col = OUTL) {
  const { w, h } = b, o = new Buf(w + 2, h + 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (b.getA(x, y)) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (b.getA(x + dx, y + dy) > 128) near = true;
    if (near) o.set(x + 1, y + 1, col);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = b.i(x, y); if (b.d[i + 3]) o.set(x + 1, y + 1, [b.d[i], b.d[i + 1], b.d[i + 2]], b.d[i + 3]); }
  // also outline the outer ring
  for (let y = 0; y < h + 2; y++) for (let x = 0; x < w + 2; x++) {
    if (o.getA(x, y)) continue;
    const xi = x - 1, yi = y - 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (b.getA(xi + dx, yi + dy) > 128) { o.set(x, y, col); break; }
  }
  return o;
}

const DECO = {
  coffee({ seed = 3, r = 12 } = {}) {
    const N = r * 2 + 10, b = new Buf(N, N);
    // paint into a transparent buffer: use over() with a fake opaque base
    const tmp = new Buf(N, N); tmp.d.fill(255);
    coffeeRing(tmp, N / 2, N / 2, r, seed, 1);
    for (let i = 0; i < N * N; i++) {
      const k = i * 4;
      if (tmp.d[k] !== 255 || tmp.d[k + 1] !== 255) {
        const a = 1 - tmp.d[k + 2] / 255; // amount of tint
        b.d[k] = 138; b.d[k + 1] = 84; b.d[k + 2] = 40; b.d[k + 3] = clamp(a * 255 * 1.7, 0, 150);
      }
    }
    return b;
  },
  tape({ variant = 'pink', w = 30, h = 10, seed = 1 } = {}) {
    const V = {
      pink: ['#f4a6ba', '#fbd0dc', 'stripe'], mint: ['#94d8bc', '#d0f2e2', 'dots'], yellow: ['#f2d064', '#fff0a8', 'grid'],
      blue: ['#9cc0ec', '#d6e6fa', 'stripe'], plain: ['#e8dcc0', '#f6eedc', 'plain'], red: ['#e87a6a', '#fbc2b0', 'dots'],
    }[variant] || ['#f4a6ba', '#fbd0dc', 'stripe'];
    const c1 = hexc(V[0]), c2 = hexc(V[1]), pat = V[2], R = rng(seed);
    const b = new Buf(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let on = false;
      if (pat === 'stripe') on = md(x + y, 6) < 2;
      else if (pat === 'dots') on = x % 5 === 2 && y % 4 === 1 || x % 5 === 0 && y % 4 === 3;
      else if (pat === 'grid') on = x % 4 === 0 || y % 4 === 0;
      const c = on ? c1 : c2;
      b.set(x, y, c, 190 + (R() < 0.2 ? -25 : 0));
      if (y === 0) b.set(x, y, c2, 220);
      if (y === h - 1) b.set(x, y, c1, 200);
    }
    for (let y = 0; y < h; y++) {
      const j1 = (y % 3 === 1 ? 1 : 0) + (R() < 0.3 ? 1 : 0), j2 = (y % 3 === 0 ? 1 : 0) + (R() < 0.3 ? 1 : 0);
      for (let k = 0; k < j1; k++) b.alpha(k, y, 0);
      for (let k = 0; k < j2; k++) b.alpha(w - 1 - k, y, 0);
    }
    return b;
  },
  staple() {
    return fromRows([
      '.dbbbbbbbbbd.',
      'daaaaaaaaaaad',
      'c...........c',
    ], { a: '#d0d4e2', b: '#f2f4fa', c: '#4c5064', d: '#7a7e94' });
  },
  postage({ variant = 'red', seed = 2 } = {}) {
    const W = 22, H = 26, b = new Buf(W, H);
    const V = { red: ['#c8343a', '#f7e3c0', '#7a1a22'], blue: ['#2c5cb0', '#d8e8f8', '#1a3070'], green: ['#3f8f5f', '#e0f0d0', '#1f3f2c'] }[variant] || ['#c8343a', '#f7e3c0', '#7a1a22'];
    const frame = hexc(V[0]), bg = hexc(V[1]), dk = hexc(V[2]), white = hexc('#fbf7ee');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = edgeDist(x, y, W, H);
      let c = white;
      if (d >= 2) c = frame;
      if (d >= 3) c = bg;
      b.set(x, y, c);
      if (d === 0 && (((x === 0 || x === W - 1) ? y : x) % 3 === 1)) b.alpha(x, y, 0); // perforations
    }
    const R = rng(seed);
    if (variant === 'blue') {
      // mountains + sun
      for (let y = 4; y < H - 7; y++) for (let x = 4; x < W - 4; x++) {
        if (Math.hypot(x - 14, y - 8) < 2.6) b.set(x, y, hexc('#ffd23f'));
        const m1 = 16 - Math.abs(x - 8) * 1.1, m2 = 17 - Math.abs(x - 14) * 0.9;
        if (y > 22 - m1 * 0.55 || y > 23 - m2 * 0.6) b.set(x, y, (x + y) % 3 ? dk : frame);
        if (y > 22 - m1 * 0.55 && y < 24 - m1 * 0.55) b.set(x, y, white);
      }
    } else if (variant === 'green') {
      // fish
      const fish = ['...ggg....', '.gggggg.g.', 'gwkgggggg.', 'gggggggg..', '.gggggg.g.', '...ggg....'];
      fish.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch !== '.') b.set(6 + xx, 8 + yy, ch === 'g' ? frame : ch === 'w' ? white : dk); }));
      for (let x = 4; x < W - 4; x++) if ((x + 1) % 3) b.set(x, 16, hexc('#7ec0e0'));
    } else {
      // maple leaf
      const leaf = [
        '....r....', '...rrr...', '.r.rrr.r.', 'rrrrrrrrr', '.rrrrrrr.', '..rrrrr..', '.rrrrrrr.', 'rr..r..rr', '....r....', '....r....',
      ];
      leaf.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch !== '.') b.set(6 + xx, 5 + yy, frame); }));
    }
    // value "5": 3x5 digits
    const five = ['###', '#..', '###', '..#', '##.'];
    five.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch === '#') b.set(W - 8 + xx, H - 9 + yy, dk); }));
    if (R() < 0) b.set(0, 0, dk);
    return b;
  },
  postmark({ color = '#2d3550', seed = 4 } = {}) {
    const W = 44, H = 24, b = new Buf(W, H), c = hexc(color), R = rng(seed);
    const cx = 11.5, cy = 11.5;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      let on = (d > 9.6 && d < 11) || (d > 6.4 && d < 7.4);
      if (!on && x > 22) {
        for (const ly of [5, 9, 13, 17]) if (Math.round(ly + Math.sin(x * 0.55 + ly) * 1.3) === y) on = true;
      }
      if (on && R() > 0.18) b.set(x, y, c, 200);
    }
    // tiny date ticks in the middle
    for (const [x, y] of [[8, 11], [9, 11], [11, 11], [12, 11], [14, 11], [15, 11], [10, 9], [11, 9], [12, 9], [13, 9], [10, 14], [11, 14], [12, 14]]) if (R() > 0.1) b.set(x, y, c, 200);
    return b;
  },
  seal({ color = 'red', letter = 'R' } = {}) {
    const ramp = (color === 'gold' ? ['#6a3c08', '#9a5e10', '#c88a1c', '#e8b030', '#ffd860'] : color === 'green' ? ['#12301e', '#1f4a2e', '#2f6a44', '#438a5a', '#64ac78'] : ['#4e1018', '#741a22', '#9e242c', '#c4343a', '#e05a52']).map(hexc);
    const N = 22, b = new Buf(N, N), c = 10.5;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
      const r = 9.2 + Math.sin(a * 5 + 1) * 0.8 + Math.sin(a * 9) * 0.4;
      if (d > r) continue;
      let v = 2.4 + (-dx - dy) / r * 0.9;
      if (d > r - 1.2) v -= 0.8;
      if (d > 5.8 && d < 7) v -= 0.9; else if (d >= 7 && d < 7.8) v += 0.6;
      b.set(x, y, ramp[dq(v, x, y, ramp.length)]);
    }
    // embossed letter (5x7)
    const L = {
      R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
      F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
      B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    }[letter] || ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'];
    L.forEach((r, yy) => [...r].forEach((ch, xx) => {
      if (ch !== '#') return;
      b.set(8 + xx, 7 + yy, ramp[0]);
      if (!L[yy - 1] || L[yy - 1][xx] !== '#') b.set(8 + xx, 6 + yy, ramp[4]);
    }));
    return b;
  },
  pencil({ len = 64 } = {}) {
    const H = 7, b = new Buf(len, H);
    const pink = ['#a8485a', '#d06a7a', '#f0909c', '#ffb6be'].map(hexc);
    const met = SILVER, yel = ['#9a5a10', '#d08a18', '#f2b828', '#ffd85a', '#fff0a0'].map(hexc);
    const wood = ['#a0703c', '#d4a464', '#f0cc90'].map(hexc), lead = ['#22202a', '#4a4858'].map(hexc);
    const shade = [3, 4, 3, 2, 2, 1, 0];
    for (let x = 0; x < len; x++) for (let y = 0; y < H; y++) {
      let c = null;
      if (x < 6) c = pink[clamp([3, 3, 2, 2, 1, 1, 0][y], 0, 3)];
      else if (x < 11) c = met[clamp(shade[y] + ((x - 6) % 2 ? 0 : -1), 0, 4)];
      else if (x < len - 12) { c = yel[clamp(shade[y], 0, 4)]; if (y === 2 && x % 9 === 0) c = yel[1]; }
      else {
        const k = x - (len - 12), half = 3.5 * (1 - k / 12);
        if (Math.abs(y - 3) > half) continue;
        c = k > 8 ? lead[y < 3 ? 1 : 0] : wood[y < 3 ? 2 : y > 3 ? 0 : 1];
      }
      if (c) b.set(x, y, c);
    }
    return outlineBuf(b);
  },
  mug({ color = 'cream' } = {}) {
    const N = 34, b = new Buf(N + 8, N), c = N / 2 - 0.5;
    const cer = (color === 'red' ? ['#6a1a20', '#9e2a2c', '#c8423a', '#e06a5a', '#f8a088'] : ['#8a7a60', '#c4b494', '#e8dcc0', '#f6eedc', '#fffaf0']).map(hexc);
    const cof = ['#24120a', '#3a1e10', '#5a3018', '#8a5428', '#c08850'].map(hexc);
    // handle
    for (let y = 0; y < N; y++) for (let x = N - 4; x < N + 8; x++) {
      const dx = x - (N + 1), dy = y - c;
      const d = Math.hypot(dx / 1.2, dy);
      if (d > 3 && d < 6.6 && x > N - 4) b.set(x, y, cer[dq(2.2 - dy / 6, x, y, 5)]);
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
      if (d > 15.5) continue;
      if (d > 12.4) b.set(x, y, cer[dq(2.6 + (-dx - dy) / 15 * 1.4, x, y, 5)]);
      else if (d > 11.4) b.set(x, y, cer[1]);
      else {
        let v = 1.4 + (dx + dy) / 12 * 0.6;
        if (d > 9.8) v += 1.1; // crema ring
        if (Math.hypot(dx + 4, dy + 4) < 2.2) v = 4; // reflection
        else if (Math.hypot(dx + 4, dy + 4) < 3.2) v = 3.2;
        b.set(x, y, cof[dq(v, x, y, 5)]);
      }
    }
    return outlineBuf(b);
  },
  ribbon({ color = '#b0303a', len = 30 } = {}) {
    const b = new Buf(7, len), c = hexc(color), dk = hexc('#6a1a22'), lt = hexc('#e06a62');
    for (let y = 0; y < len; y++) for (let x = 0; x < 7; x++) {
      if (y > len - 4 && Math.abs(x - 3) < 4 - (len - y)) continue; // swallowtail notch
      b.set(x, y, x === 0 ? dk : x === 1 ? lt : x === 6 ? dk : c);
    }
    return b;
  },
  ring() { // notebook spiral ring
    return fromRows([
      '.bbbbbbbbb.',
      'baaaaaaaaab',
      'c.........c',
    ], { a: '#d0d4e2', b: '#7a7e94', c: '#4c5064' });
  },
  dust() {
    return fromRows(['.aa.', 'abba', 'abba', '.aa.'], { a: '#d8c8a8', b: '#f4ead4' });
  },
};
for (const s of ['paperclip', 'pushpin', 'pen']) {
  DECO[s] = () => {
    if (!hasSprite(s)) return DECO.staple();
    const src = spriteCanvas(s, 1), b = new Buf(src.width, src.height);
    const d = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
    b.d.set(d);
    return b;
  };
}
export const DECO_NAMES = Object.keys(DECO);

const decoCache = new Map();
function decoBuf(name, opts = {}) {
  const key = name + JSON.stringify(opts);
  if (decoCache.has(key)) return decoCache.get(key);
  const f = DECO[name] || DECO.staple;
  const b = f(opts);
  const out = { url: b.url(), w: b.w, h: b.h, buf: b };
  decoCache.set(key, out);
  return out;
}
export function decoCanvas(name, opts = {}) {
  const { buf } = decoBuf(name, opts);
  return buf.canvas();
}
export function decoURL(name, opts = {}) { return decoBuf(name, opts).url; }
// <img> for a deco. opts: { x, y (css px, absolute), rot (deg), cls, px, style, ...painter opts }
export function deco(name, opts = {}) {
  const { x, y, rot = 0, cls = '', px = PX, style = '', right, bottom, ...po } = opts;
  const d = decoBuf(name, po);
  const pos = [
    x != null ? `left:${x}px` : '', y != null ? `top:${y}px` : '', right != null ? `right:${right}px` : '', bottom != null ? `bottom:${bottom}px` : '',
  ].filter(Boolean).join(';');
  const abs = pos ? 'pp-abs' : '';
  return `<img class="pp-px pp-deco pp-d-${name} ${abs} ${cls}" src="${d.url}" width="${d.w * px}" height="${d.h * px}" alt="" draggable="false" style="${pos};--r:${rot}deg;${style}">`;
}
