// The boutique's own pixel art, in the calm "Moss & Moonlight" palette: 9-slice frames that feel like
// the shop's real materials (an oak shop board capped with snow and fixed with brass brackets, linen
// and kraft price cards with stitched edges, a dusk-velvet card, cloth ribbons, honey / berry / plum /
// lake / sage / linen buttons with a hard lip, cloth price tags, a paper speech bubble, a dark oak
// plaque), tiling surface patterns (linen weave, kraft, velvet, planks, a screen-door dim), and the
// shop's sprites (snowflakes, a wooden hanger, a wrapped gift, rarity stars, an hourglass, holly,
// a fairy-light bulb, a mystery parcel, shooting stars, pixel sunbursts). Painted procedurally on
// first use and shown crisp at whole-pixel scales. No smooth circles, no soft glows.
import { Grid, icon, draw, render, RAMPS, spriteURL } from '../px/sprites.js';

// ------------------------------------------------------------------ palette (src/gfx/palette.ts)

const C = {
  ink: '#2e2b24', ink2: '#4b463a', ink3: '#6f6856',
  paper: '#f4eedd', oat: '#eae0c8', linen: '#dccfb0', straw: '#c9b78d',
  woodPale: '#d8bf98', woodLight: '#bf9d74', wood: '#9c7a56', woodDark: '#6f553d', woodDeep: '#4a392b', bark: '#5b4a3c', barkDark: '#3d3229',
  sageLight: '#c4cfa3', sage: '#a7b788', moss: '#86a06a', fern: '#66844f', leaf: '#557343', pine: '#3f5a3b', forest: '#2c4030',
  mist: '#d3e0dc', sky: '#aec8cc', lake: '#86a9b0', dusk: '#617f8c', slate: '#46596a', night: '#27313f', deepNight: '#1b222d',
  lamp: '#f1d39a', honey: '#dcb072', ochre: '#c59a52', terracotta: '#c0866a', clay: '#a66c55',
  rose: '#d9aca4', blush: '#e8b4ae', berry: '#9e5f66', plum: '#6e5266',
  lilac: '#b4a9c9', lavender: '#d3cce0', frost: '#dfe9ea', snow: '#f5f7f2', ice: '#bcd6dc',
  brass: '#c8a764', brassDark: '#8e7440', brassLight: '#e6d09c', iron: '#5c5a56',
};
export const SHOP_COLORS = C;

// ramps for the BME sprite kit (dark -> light, tone 3 = base)
Object.assign(RAMPS, {
  nwood: ['#2f2620', '#4a392b', '#6f553d', '#9c7a56', '#bf9d74', '#d8bf98'],
  nhoney: ['#5a4126', '#8e7440', '#b98c4c', '#dcb072', '#ecca8f', '#f6e6c4'],
  nbrass: ['#3d3229', '#6b5532', '#8e7440', '#c8a764', '#e0c987', '#f4ead0'],
  nberry: ['#3a2228', '#5e3a44', '#7d4b54', '#9e5f66', '#c08a88', '#e6c2b8'],
  nrose: ['#7d4b54', '#a8706e', '#c48e88', '#d9aca4', '#e8c4bc', '#f6e4dc'],
  nplum: ['#211a24', '#3f3144', '#55405a', '#6e5266', '#93798f', '#c4b2c2'],
  nlilac: ['#4a4458', '#6a6280', '#8d84a6', '#b4a9c9', '#d3cce0', '#eeeaf4'],
  nlake: ['#1e2a33', '#3a5160', '#5d7b88', '#86a9b0', '#aec8cc', '#dfe9ea'],
  nsage: ['#24352a', '#3f5a3b', '#557343', '#86a06a', '#a7b788', '#d4dfb8'],
  npine: ['#141d18', '#26392c', '#3f5a3b', '#557343', '#7c9a60', '#a7bf82'],
  nlinen: ['#7b7058', '#a3967a', '#c9b78d', '#dccfb0', '#eae0c8', '#f9f5ea'],
  nfrost: ['#617f8c', '#86a9b0', '#aec8cc', '#d3e0dc', '#eef3ef', '#ffffff'],
  nkraft: ['#4a3826', '#7d5f40', '#96744f', '#b99a6e', '#d1b48e', '#e6d3b4'],
  nink: ['#14120f', '#1f1c18', '#2e2b24', '#4b463a', '#6f6856', '#958d78'],
  nlamp: ['#8a6532', '#c59a52', '#dcb072', '#f1d39a', '#f9e9c4', '#fffaee'],
});

// ------------------------------------------------------------------ a tiny RGBA buffer

function rgb(h) {
  const s = h.replace('#', '');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255];
}
const CC = (h) => (h == null ? null : Array.isArray(h) ? h : rgb(h));
class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  a(x, y) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (!this.in(x, y) || c == null) return this;
    c = CC(c);
    const i = (y * this.w + x) * 4, sa = (c[3] ?? 255) / 255;
    if (sa >= 1) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; return this; }
    const da = this.d[i + 3] / 255, oa = sa + da * (1 - sa);
    if (oa <= 0) return this;
    for (let k = 0; k < 3; k++) this.d[i + k] = Math.round((c[k] * sa + this.d[i + k] * da * (1 - sa)) / oa);
    this.d[i + 3] = Math.round(oa * 255);
    return this;
  }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  rows(x, y, rows, map) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.' && map[r[i]] !== undefined) this.set(x + i, y + j, map[r[i]]); }); return this; }
  corners(rows, map, inset = 0) {
    const w = rows[0].length, h = rows.length, fx = rows.map((r) => r.split('').reverse().join(''));
    this.rows(inset, inset, rows, map); this.rows(this.w - w - inset, inset, fx, map);
    this.rows(inset, this.h - h - inset, rows.slice().reverse(), map); this.rows(this.w - w - inset, this.h - h - inset, fx.slice().reverse(), map);
    return this;
  }
}
/** chamfered (cut-corner) rectangle */
function chamfer(x0, y0, w, h, c) {
  return (x, y) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h && x - x0 + (y - y0) >= c && x0 + w - 1 - x + (y - y0) >= c && x - x0 + (y0 + h - 1 - y) >= c && x0 + w - 1 - x + (y0 + h - 1 - y) >= c;
}
/** Erosion depth of every pixel of a mask; lit > 0 faces up/left. */
function bevel(b, mask, pal, max = 16) {
  const W = b.w, H = b.h, N = W * H, depth = new Int16Array(N).fill(-1), lit = new Int8Array(N);
  let cur = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask(x, y)) cur[y * W + x] = 1;
  const at = (m, x, y) => x >= 0 && y >= 0 && x < W && y < H && m[y * W + x];
  for (let k = 0; k < max; k++) {
    const nxt = new Uint8Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!cur[i]) continue;
      const up = !at(cur, x, y - 1), dn = !at(cur, x, y + 1), lf = !at(cur, x - 1, y), rt = !at(cur, x + 1, y);
      if (up || dn || lf || rt) { depth[i] = k; lit[i] = up + lf - dn - rt; } else nxt[i] = 1;
    }
    cur = nxt;
  }
  for (let i = 0; i < N; i++) if (cur[i]) depth[i] = max;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = depth[y * W + x];
    if (d < 0) continue;
    const c = pal(d, lit[y * W + x], x, y);
    if (c) b.set(x, y, c);
  }
}
const hn = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ------------------------------------------------------------------ frames

export const ICE_FRAMES = {};
const BUILD = {};
function def(name, spec, build) {
  ICE_FRAMES[name] = { w: spec.w, h: spec.h, slice: spec.slice, fill: spec.fill !== false, repeat: spec.repeat || 'stretch' };
  BUILD[name] = () => build(new Buf(spec.w, spec.h), spec);
}

/** oak grain for a pixel inside a board border: planks run along the border, knots now and then */
function grain(x, y, along, P) {
  const u = along ? x : y, v = along ? y : x;
  const line = (Math.floor(u * 0.35 + Math.sin(v * 1.7 + u * 0.12) * 1.2) + v * 3) % 7 === 0;
  const knot = hn(Math.floor(u / 6), v, 4) > 0.94;
  return knot ? P.dk : line ? P.sh : hn(u, v, 9) > 0.86 ? P.lt : P.base;
}
const OAK = { ol: C.ink, dk: C.woodDeep, sh: C.woodDark, base: C.wood, lt: C.woodLight, hi: C.woodPale };
const OAK_DARK = { ol: C.deepNight, dk: '#241d19', sh: C.barkDark, base: C.woodDeep, lt: C.bark, hi: C.woodDark };
const BRASS = { dk: C.brassDark, base: C.brass, lt: C.brassLight, hi: '#f8f0d8' };

// a brass corner bracket with a rivet (top-left orientation)
const BRACKET = [
  'kkkkkkk..',
  'khhhhhbk.',
  'khlllbbk.',
  'khlrlbk..',
  'khllbk...',
  'khbbk....',
  'kbbk.....',
  'kkk......',
];
// a few lumps of snow sitting on the top edge (tiles every 16 px)
function snowCap(b, y0, x0, x1, seed = 0) {
  for (let x = x0; x < x1; x++) {
    const ph = ((x - x0) % 16);
    const hgt = [3, 4, 4, 5, 5, 5, 4, 3, 3, 2, 3, 4, 4, 3, 2, 2][ph];
    for (let k = 0; k < hgt; k++) b.set(x, y0 - k, k === hgt - 1 ? C.ink3 : k === hgt - 2 ? C.snow : k === 0 ? C.ice : C.frost);
    if (ph === 6 || ph === 13) { b.set(x, y0 + 1, C.frost); b.set(x, y0 + 2, C.ice); if (ph === 6) b.set(x, y0 + 3, C.sky); }
  }
  void seed;
}

// the shop board: an oak frame with a groove, brass brackets and snow on its top rail; linen shows inside
function board(P, o = {}) {
  return (b) => {
    const W = b.w, H = b.h, T = o.top ?? 6;
    bevel(b, chamfer(0, T - 5, W, H - T + 5, 2), (d, l, x, y) => {
      if (d === 0) return P.ol;
      const along = y < 10 || y > H - 10;
      if (d === 1) return l > 0 ? P.hi : l < 0 ? P.dk : P.lt;
      if (d <= 5) return grain(x, y, along, P);
      if (d === 6) return l > 0 ? P.dk : P.sh;
      if (d === 7) return o.trim ? (l > 0 ? o.trim.hi : o.trim.dk) : P.ol;
      if (d === 8) return o.trim ? o.trim.base : null;
      return null;
    });
    if (o.snow !== false) snowCap(b, T - 4, 2, W - 2);
    b.corners(BRACKET, { k: C.ink, h: BRASS.hi, l: BRASS.lt, b: BRASS.base, r: C.ink }, 1);
    return b;
  };
}
def('ice_panel', { w: 48, h: 48, slice: [16, 12, 12, 12], fill: false, repeat: 'round' }, board(OAK));
def('ice_panel_gold', { w: 48, h: 48, slice: [16, 12, 12, 12], fill: false, repeat: 'round' }, board(OAK, { trim: BRASS }));
def('ice_panel_dark', { w: 48, h: 48, slice: [16, 12, 12, 12], fill: false, repeat: 'round' }, board(OAK_DARK));

// paper cards with a stitched border (fill painted flat so it stretches cleanly)
const inked = (c, x, y) => (hn(x, y, 21) > 0.82 ? mixHex(c, '#8a7f68', 0.45) : c);
function mixHex(a, b, t) { const A = rgb(a), B = rgb(b); return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); }
function card(P, o = {}) {
  return (b) => {
    const W = b.w, H = b.h;
    bevel(b, chamfer(0, 0, W, H - 2, 2), (d, l, x, y) => {
      if (d === 0) return inked(P.ol, x, y);
      if (d === 1) return l > 0 ? P.hi : l < 0 ? P.sh : P.base;
      if (d === 3 && (x + y) % 4 < 2) return P.st;
      if (d >= 4 && hn(x, y, 5) > 0.93) return P.gr ?? P.fill;
      if (d === 2 && o.corner && ((x < 6 && y < 6) || (x > W - 7 && y < 6) || (x < 6 && y > H - 9) || (x > W - 7 && y > H - 9))) return o.corner;
      return P.fill;
    });
    for (let x = 2; x < W - 2; x++) { b.set(x, H - 2, [27, 34, 45, 110]); b.set(x, H - 1, [27, 34, 45, 50]); }
    if (o.corner) b.corners(['bb', 'b.'], { b: o.corner }, 2);
    return b;
  };
}
const PAPER = { ol: C.ink2, sh: C.straw, base: C.oat, hi: '#fbf8ef', fill: C.paper, st: C.linen, gr: '#ebe3cf' };
const KRAFT = { ol: C.woodDark, sh: '#bfa67e', base: '#ddcaa6', hi: '#f2e8d2', fill: '#e8dcc0', st: '#b8a27a', gr: '#dccdab' };
const VELVET = { ol: '#1f2329', sh: '#2a2f36', base: '#4a5157', hi: '#646b70', fill: '#363c42', st: '#8a7652', gr: '#3c4248' };
def('ice_card', { w: 24, h: 24, slice: [7, 7, 9, 7], repeat: 'round' }, card(PAPER));
def('ice_card_gold', { w: 24, h: 24, slice: [7, 7, 9, 7], repeat: 'round' }, card(KRAFT, { corner: '#a89068' }));
def('ice_card_dark', { w: 24, h: 24, slice: [7, 7, 9, 7], repeat: 'round' }, card(VELVET, { corner: '#8a7652' }));

// a recessed slot (art wells, tables)
def('ice_slot', { w: 18, h: 18, slice: [6, 6, 6, 6] }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h, 2), (d, l, x, y) => {
    if (d === 0) return C.woodDark;
    if (d === 1) return l > 0 ? C.straw : C.paper;
    return hn(x, y) > 0.92 ? C.linen : C.oat;
  });
  return b;
});

// cloth ribbons with stitching and notched tails
function ribbon(P) {
  return (b) => {
    const W = b.w, H = b.h, TW = 11;
    for (const side of [0, 1]) {
      const m = (x, y) => { const yy = y - 4, th = H - 6; if (yy < 0 || yy >= th || x < 0 || x >= TW + 2) return false; const mid = (th - 1) / 2, notch = 4 - Math.round(Math.abs(yy - mid) * 1.1); return x >= Math.max(0, notch); };
      const tb = new Buf(W, H);
      bevel(tb, (x, y) => m(side ? W - 1 - x : x, y), (d, l) => (d === 0 ? P.ol : d === 1 && l > 0 ? P.sh : P.dk));
      for (let i = 0; i < tb.d.length; i += 4) if (tb.d[i + 3]) { b.d[i] = tb.d[i]; b.d[i + 1] = tb.d[i + 1]; b.d[i + 2] = tb.d[i + 2]; b.d[i + 3] = 255; }
    }
    bevel(b, chamfer(6, 0, W - 12, H - 4, 1), (d, l, x, y) => {
      if (d === 0) return inked(P.ol, x, y);
      if (y === 1) return P.hi;
      if (y === 2 && (x % 4) < 2) return P.lt;
      if (y === H - 7 && (x % 4) < 2) return P.lt;
      if (y >= H - 6) return P.sh;
      return (x + y * 2) % 9 === 0 && y > 3 && y < H - 8 ? P.sh : P.base;
    });
    b.rows(6, H - 5, ['oo', 'do', '.o'], { o: P.ol, d: P.dk });
    b.rows(W - 8, H - 5, ['oo', 'od', 'o.'], { o: P.ol, d: P.dk });
    return b;
  };
}
// quiet, slightly greyed cloth colours: colour is an accent, the UI is mostly paper, wood and ink
const CLOTH = {
  sage: { ol: '#2b3329', dk: '#4a5646', sh: '#5f6b58', base: '#7a8670', lt: '#9da690', hi: '#cfd3c0' },
  honey: { ol: C.woodDeep, dk: '#8a7652', sh: '#ac9468', base: '#c9b183', lt: '#dfcda4', hi: '#f2e8d2' },
  berry: { ol: '#352628', dk: '#5e4446', sh: '#765a5a', base: '#8f7270', lt: '#b19a94', hi: '#e2d4cc' },
  plum: { ol: '#25212a', dk: '#433c48', sh: '#57505c', base: '#6d6572', lt: '#918a95', hi: '#d6d0d8' },
};
def('ice_ribbon', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(CLOTH.sage));
def('ice_ribbon_gold', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(CLOTH.honey));
def('ice_ribbon_berry', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(CLOTH.berry));
def('ice_ribbon_violet', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(CLOTH.plum));

// chunky buttons with a hard lip; tones keep their old class names (gold, berry, violet, ice, frost, sage)
const BTN = {
  gold: { ol: C.woodDeep, dk: '#9a8662', sh: '#b8a27a', base: '#d4c19a', lt: '#e6d8b8', hi: '#f6efdf' },
  berry: CLOTH.berry,
  violet: CLOTH.plum,
  ice: { ol: '#262e33', dk: '#4b5a60', sh: '#5f7075', base: '#788a8e', lt: '#9fadb0', hi: '#dce3e2' },
  frost: { ol: C.woodDeep, dk: '#9b8f78', sh: '#bdb299', base: '#dcd3bd', lt: '#ebe5d4', hi: '#faf6ea' },
  sage: CLOTH.sage,
};
function button(P, down = false) {
  return (b) => {
    const W = b.w, H = b.h, top = down ? 2 : 0, lip = down ? 0 : 2, bodyH = H - top - lip;
    if (lip) bevel(b, chamfer(0, top + 2, W, bodyH, 2), (d) => (d === 0 ? P.ol : P.dk));
    bevel(b, chamfer(0, top, W, bodyH, 2), (d, l, x, y) => {
      if (d === 0) return inked(P.ol, x, y);
      const yy = y - top;
      if (d === 1 && l < 0 && yy > 2) return P.sh;
      if (yy <= 2) return yy === 1 && d >= 2 && x % 3 === 0 ? P.hi : P.lt;
      if (yy >= bodyH - 3) return P.sh;
      return P.base;
    });
    if (down) b.set(3, top + 2, P.sh);
    else b.set(2, 2, P.hi).set(3, 1, P.hi).set(2, 3, P.hi);
    return b;
  };
}
const BT = { w: 18, h: 18, slice: [6, 6, 7, 6] };
for (const k of Object.keys(BTN)) { def(`ice_btn_${k}`, BT, button(BTN[k])); def(`ice_btn_${k}_down`, BT, button(BTN[k], true)); }

// a cloth price tag with a punched eyelet on the left and stitching
function tag(P) {
  return (b) => {
    const W = b.w, H = b.h;
    const m = (x, y) => x >= 0 && y >= 0 && x < W && y < H - 1 && x + Math.abs(y - (H - 2) / 2) >= 4;
    bevel(b, m, (d, l, x) => (d === 0 ? P.ol : d === 1 ? (l > 0 ? P.lt : P.sh) : d === 2 && x > 6 && x % 3 === 0 ? P.lt : P.base));
    const my = Math.floor((H - 1) / 2);
    b.set(4, my, P.ol).set(4, my - 1, P.ol).set(5, my, P.dk).set(3, my, C.brass).set(4, my + 1, C.brass);
    for (let x = 4; x < W - 1; x++) b.set(x, H - 1, [27, 34, 45, 90]);
    return b;
  };
}
def('ice_tag_berry', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(CLOTH.berry));
def('ice_tag_gold', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(CLOTH.honey));
def('ice_tag_ice', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(BTN.ice));
def('ice_tag_sage', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(CLOTH.sage));

// the queen's speech bubble: paper with an ink outline and cut corners
def('ice_bubble', { w: 16, h: 16, slice: [5, 5, 5, 5] }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h, 3), (d, l) => (d === 0 ? C.ink : d === 1 ? (l > 0 ? '#fffdf6' : C.linen) : C.paper));
  return b;
});

// a small dark oak plaque with a brass rim for counters and chips
def('ice_chip', { w: 16, h: 14, slice: [5, 6, 6, 6] }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h - 1, 2), (d, l, x, y) => (d === 0 ? C.ink : d === 1 ? (l > 0 ? BRASS.lt : BRASS.dk) : d === 2 ? (l > 0 ? C.bark : '#241d19') : grain(x, y, true, OAK_DARK)));
  for (let x = 2; x < b.w - 2; x++) b.set(x, b.h - 1, [20, 24, 30, 110]);
  return b;
});

// ------------------------------------------------------------------ CSS

const cv = new Map(), urls = new Map();
const normScale = (s) => Math.max(1, Math.min(12, Math.round(s)));
function frameCanvas(name, scale) {
  const key = name + '@' + scale;
  if (cv.has(key)) return cv.get(key);
  const f = ICE_FRAMES[name];
  let c;
  if (scale === 1) {
    const b = BUILD[name]();
    c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    c.getContext('2d').putImageData(new ImageData(b.d, f.w, f.h), 0, 0);
  } else {
    const base = frameCanvas(name, 1);
    c = document.createElement('canvas'); c.width = f.w * scale; c.height = f.h * scale;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(base, 0, 0, c.width, c.height);
  }
  cv.set(key, c);
  return c;
}
export function iceURL(name, scale = 2) {
  scale = normScale(scale);
  const key = name + '@' + scale;
  if (!urls.has(key)) urls.set(key, frameCanvas(name, scale).toDataURL('image/png'));
  return urls.get(key);
}
const devK = () => { const r = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, k = Math.round(r); return k >= 2 && k <= 4 && Math.abs(r - k) < 0.01 ? k : 1; };
/** CSS declarations that make an element wear a frame (border-image 9-slice). */
export function iceStyle(name, scale = 2) {
  scale = normScale(scale);
  const f = ICE_FRAMES[name], k = devK(), url = iceURL(name, scale * k);
  const [t, r, b, l] = f.slice.map((v) => v * scale), [st, sr, sb, sl] = f.slice.map((v) => v * scale * k);
  return `border-style:solid;border-width:${t}px ${r}px ${b}px ${l}px;border-image-source:url("${url}");border-image-slice:${st} ${sr} ${sb} ${sl}${f.fill ? ' fill' : ''};border-image-width:${t}px ${r}px ${b}px ${l}px;border-image-repeat:${f.repeat};image-rendering:pixelated`;
}

// ------------------------------------------------------------------ tiling surface patterns

const PAT = {
  /** woven linen: the panel's inside */
  linen: [16, 16, (x, y) => { const w = (x + (y >> 1)) % 2 === 0, f = hn(x, y, 2); return f > 0.96 ? C.linen : w ? (y % 2 ? '#efe7d4' : C.paper) : (x % 4 === 0 ? '#e9e0ca' : '#f1eada'); }],
  /** kraft paper */
  kraft: [16, 16, (x, y) => { const f = hn(x, y, 5); return f > 0.9 ? '#c9ad84' : f > 0.82 ? '#e2cba3' : (x + y * 3) % 11 === 0 ? '#cdb28a' : '#d8bf96'; }],
  /** dusk velvet */
  velvet: [8, 8, (x, y) => ((x + y) % 4 === 0 ? '#2f3b4a' : (x - y + 8) % 4 === 0 ? '#222b37' : C.night)],
  /** oak planks running sideways */
  planks: [32, 12, (x, y) => (y % 6 === 0 ? C.woodDeep : y % 6 === 1 ? C.woodLight : grain(x + (y >= 6 ? 13 : 0), y % 6, true, OAK))],
  /** a screen-door dim for modal backdrops */
  dim: [2, 2, (x, y) => ((x + y) % 2 ? '#1b222dcc' : '#1b222d99')],
  /** sage wallpaper stripes for the gacha frame */
  stripe: [8, 8, (x, y) => (x < 4 ? (hn(x, y, 1) > 0.9 ? '#d6ddb6' : C.sageLight) : x === 6 ? C.sage : (hn(x, y, 7) > 0.92 ? '#e2d6b8' : C.oat))],
  /** a pine garland with berries and fairy bulbs (two frames: the bulbs take turns) */
  garland: [32, 8, (x, y) => garlandPx(x, y, 0)],
  garland2: [32, 8, (x, y) => garlandPx(x, y, 1)],
};
function garlandPx(x, y, f) {
  const bulbs = [[4, C.lamp, '#a37c45'], [12, C.rose, '#86585a'], [20, C.sageLight, '#5f7d4c'], [28, C.ice, '#4d6a78']];
  for (const [bx, on, off] of bulbs) {
    const lit = ((bx >> 3) + f) % 2 === 0;
    if (y === 6 && x === bx) return C.ink2;
    if (y === 7 && (x === bx || x === bx + 1)) return lit ? on : off;
    if (y === 6 && x === bx + 1) return lit ? '#fffaee' : off;
  }
  const top = 1 + Math.round(hn(x, 0, 3) * 1.2), bot = 5 - Math.round(hn(x, 1, 5) * 1.2);
  if (y < top || y > bot) return null;
  if (hn(x, y, 11) > 0.9 && y > top) return C.berry;
  if (y === top) return (x % 3) ? C.moss : C.sage;
  return (x + y) % 3 === 0 ? C.forest : (x * 7 + y) % 5 === 0 ? C.leaf : C.pine;
}
function patCanvas(name, scale) {
  const [w, h, fn] = PAT[name];
  const b = new Buf(w * scale, h * scale);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = fn(x, y); if (c) b.rect(x * scale, y * scale, scale, scale, c); }
  const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
  c.getContext('2d').putImageData(new ImageData(b.d, b.w, b.h), 0, 0);
  return c.toDataURL('image/png');
}
export function patternURL(name, scale = 2) { const key = 'pat:' + name + scale; if (!urls.has(key)) urls.set(key, patCanvas(name, scale)); return urls.get(key); }

// ------------------------------------------------------------------ painted canvases (sunbursts, stars, sparkles)

function toURL(b) { const c = document.createElement('canvas'); c.width = b.w; c.height = b.h; c.getContext('2d').putImageData(new ImageData(b.d, b.w, b.h), 0, 0); return c.toDataURL('image/png'); }
/** A pixel sunburst: hard-edged rays in two alpha steps, dithered out with distance. `off` shifts the rays by half a gap. */
export function raysURL(off = 0, n = 14, size = 96) {
  const key = 'rays:' + off + ':' + n + ':' + size;
  if (urls.has(key)) return urls.get(key);
  const b = new Buf(size, size), c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy) / c;
    if (r > 1 || r < 0.08) continue;
    const a = ((Math.atan2(dy, dx) / Math.PI / 2 + 1) * n + off * 0.5) % 1;
    if (a > 0.42) continue;
    const fade = r > 0.75 ? ((x + y) % 2 ? 0 : 1) : r > 0.55 ? ((x * 3 + y) % 4 ? 1 : 0) : 1;
    if (!fade) continue;
    b.set(x, y, [255, 255, 255, a < 0.08 || a > 0.34 ? 120 : 200]);
  }
  urls.set(key, toURL(b));
  return urls.get(key);
}
/** A pixel burst: concentric stepped rings and a 4-point star, white (tint with a filter or mix-blend) */
export function burstURL(size = 64, col = '#ffffff') {
  const key = 'burst:' + size + col, k = CC(col), W = (a) => [k[0], k[1], k[2], a];
  if (urls.has(key)) return urls.get(key);
  const b = new Buf(size, size), c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x + 0.5 - c, y + 0.5 - c) / c;
    if (r < 0.22) b.set(x, y, [255, 250, 238, 255]);
    else if (r < 0.34) b.set(x, y, W(255));
    else if (r < 0.52) b.set(x, y, W(170));
    else if (r < 0.7 && (x + y) % 2 === 0) b.set(x, y, W(120));
    else if (r < 0.86 && (x % 2 === 0 && y % 2 === 0)) b.set(x, y, W(90));
  }
  for (let q = 0; q < c; q++) { const a = q < c * 0.6 ? 255 : 150; for (const [x, y] of [[c + q, c], [c - q - 1, c], [c, c + q], [c, c - q - 1]]) { b.set(x, y, q < c * 0.3 ? [255, 250, 238, 255] : W(a)); b.set(x + (y === c ? 0 : 1), y + (y === c ? 1 : 0), W(a)); } }
  urls.set(key, toURL(b));
  return urls.get(key);
}
/** A shooting star: a bright cross head and a stepped tail of pixels in the star's colour. */
export function shootURL(col, len = 64) {
  const key = 'shoot:' + col + len;
  if (urls.has(key)) return urls.get(key);
  const H = 11, b = new Buf(len + 8, H), cy = 5, k = CC(col);
  for (let x = 0; x < len; x++) {
    const t = x / len, th = t > 0.7 ? 2 : t > 0.35 ? 1 : 0;
    const on = t > 0.45 || (x % Math.max(2, Math.round(6 - t * 8))) === 0;
    if (!on) continue;
    for (let j = -th; j <= th; j++) b.set(x, cy + j, [k[0], k[1], k[2], Math.round(70 + t * 185)]);
    if (t > 0.6) b.set(x, cy, [255, 255, 255, 255]);
  }
  const hx = len + 2;
  for (let j = -4; j <= 4; j++) { b.set(hx, cy + j, Math.abs(j) < 2 ? [255, 255, 255, 255] : [k[0], k[1], k[2], 220]); b.set(hx + j, cy, Math.abs(j) < 2 ? [255, 255, 255, 255] : [k[0], k[1], k[2], 220]); }
  b.rect(hx - 1, cy - 1, 3, 3, [255, 255, 255, 255]);
  urls.set(key, toURL(b));
  return urls.get(key);
}

let injected = false;
/** Injects `.if-<name>` (2x) and `.if3-<name>` (3x) classes for every frame, buttons, and pattern variables, once. */
export function injectIceCSS() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  let css = '';
  for (const n of Object.keys(ICE_FRAMES)) css += `.if-${n}{${iceStyle(n, 2)};background-color:transparent}\n.if3-${n}{${iceStyle(n, 3)};background-color:transparent}\n`;
  for (const k of Object.keys(BTN)) css += `.nv-btn.${k}{${iceStyle(`ice_btn_${k}`, 2)}}\n.nv-btn.${k}:active:not(.off),.nv-btn.${k}.down{${iceStyle(`ice_btn_${k}_down`, 2)}}\n`;
  css += ':root{';
  for (const p of Object.keys(PAT)) css += `--nv-pat-${p}:url("${patternURL(p, 2)}");`;
  css += `--nv-rays-a:url("${raysURL(0)}");--nv-rays-b:url("${raysURL(1)}");--nv-burst:url("${burstURL()}");--nv-burst-lamp:url("${burstURL(64, C.lamp)}");--nv-burst-lilac:url("${burstURL(64, '#c6bdd6')}");--nv-burst-lake:url("${burstURL(64, C.sky)}");--nv-twinkle:url("${spriteURL('shop_twinkle', 2)}");`;
  css += '}\n';
  const st = document.createElement('style');
  st.id = 'hh-ice-frames';
  st.textContent = css;
  document.head.appendChild(st);
}

// ------------------------------------------------------------------ sprites

icon('ice_flake', { W: 'nfrost:5', B: 'nlake.r@f', b: 'nlake:3', G: 'nbrass:4' }, [
  '.....W.....',
  '...W.B.W...',
  '....BBB....',
  '.W..bBb..W.',
  '..BB.B.BB..',
  'WBbBBGBBbBW',
  '..BB.B.BB..',
  '.W..bBb..W.',
  '....BBB....',
  '...W.B.W...',
  '.....W.....',
]);
icon('ice_flake_s', { W: 'nfrost:5!', B: 'nfrost:3' }, ['..W..', '.WBW.', 'WBBBW', '.WBW.', '..W..']);
// icicles that tile along a ledge (16 px period)
draw('ice_icicles', () => {
  const g = new Grid(16, 10);
  const drips = [[1, 4], [4, 8], [7, 3], [10, 6], [13, 9], [15, 3]];
  g.rect(0, 0, 16, 2, 'I');
  for (const [x, h] of drips) { for (let y = 1; y < h; y++) { const w = y < h * 0.45 ? 2 : 1; g.rect(x - (w > 1 ? 1 : 0), y, w, 1, 'I'); } g.set(x, h - 1, 'w'); }
  return render(g, { I: 'nfrost.x@ice', w: 'nfrost:5' }, { ol: C.dusk });
});
// a wooden coat hanger with a brass hook
icon('shop_hanger', { S: 'nbrass.r@hook', s: 'nbrass:5', W: 'nwood.y@bar', w: 'nwood:5' }, () => {
  const g = new Grid(22, 14);
  g.set(11, 0, 'S').set(12, 0, 'S').set(13, 1, 'S').set(13, 2, 'S').set(12, 3, 'S').set(11, 4, 'S');
  g.set(11, 5, 'S');
  g.line(11, 6, 1, 11, 'W').line(11, 6, 21, 11, 'W').line(12, 6, 2, 11, 'W').line(10, 6, 20, 11, 'W');
  g.rect(1, 11, 21, 2, 'W'); g.line(2, 11, 20, 11, 'w');
  g.set(12, 0, 's');
  return g.rows();
});
// the free daily gift: a linen-wrapped box with a berry satin bow and a holly sprig
icon('shop_gift', { B: 'nlinen.r@box', b: 'nlinen:2', R: 'nberry.y@rib', r: 'nberry:5', D: 'nberry:1', G: 'npine.r@h', g: 'npine:4', y: 'nberry:4' }, () => {
  const g = new Grid(24, 24);
  g.rect(3, 11, 18, 11, 'B');
  g.rect(2, 8, 20, 4, 'B');
  for (let y = 12; y < 22; y++) for (let x = 3; x < 21; x++) if ((x + y) % 5 === 0 && g.get(x, y) === 'B') g.set(x, y, 'b');
  g.rect(10, 8, 4, 14, 'R'); g.rect(2, 9, 20, 2, 'R');
  g.line(11, 9, 11, 21, 'r');
  g.ellipse(7.5, 5.6, 4.2, 3.2, 'R'); g.ellipse(16.5, 5.6, 4.2, 3.2, 'R');
  g.ellipse(7.5, 5.6, 1.8, 1.3, 'D'); g.ellipse(16.5, 5.6, 1.8, 1.3, 'D');
  g.rect(10, 5, 4, 4, 'R'); g.set(11, 5, 'r').set(10, 6, 'r');
  g.line(10, 8, 7, 12, 'R').line(13, 8, 16, 12, 'R');
  // holly on the lid
  g.poly([[15, 12], [19, 10], [21, 13], [18, 14]], 'G'); g.set(18, 12, 'g'); g.set(16, 14, 'y').set(17, 15, 'y');
  return g.rows();
});
// rarity stars: honey (5), plum (4), lake (3)
for (const [n, m] of [['shop_star5', 'nhoney'], ['shop_star4', 'nlilac'], ['shop_star3', 'nlake']]) {
  icon(n, { S: `${m}.R@star`, w: '#ffffff' }, ['....S....', '....S....', '...SSS...', 'SSSSSSSSS', '.SSSwSSS.', '..SSSSS..', '..SS.SS..', '.SS...SS.', '.S.....S.']);
}
// a little wooden hourglass for the reset timer
icon('shop_timer', { F: 'nwood.y@frame', f: 'nwood:5', G: 'nfrost.r@g', S: 'nhoney:4', s: 'nhoney:3' }, [
  'FFFFFFFFF',
  '.FfffffF.',
  '.GSSSSSG.',
  '..GSSSG..',
  '...GsG...',
  '....s....',
  '...GsG...',
  '..GsssG..',
  '.GsSSSsG.',
  '.FfffffF.',
  'FFFFFFFFF',
]);
icon('shop_swap', { A: 'nhoney.x@arr', a: 'nhoney:5' }, ['....A....', '....AA...', 'AAAAAAA..', 'AaaaaaAA.', 'AAAAAAA..', '....AA...', '....A....']);
// a mystery parcel: kraft paper, twine, a wax seal and a tag with a question mark
icon('shop_mystery', { B: 'nkraft.r@box', b: 'nkraft:2', D: 'nkraft:1', R: 'nlinen.y@rib', r: 'nlinen:5', Q: 'nberry.R@q', T: 'nlinen.f@t', w: '#ffffff', s: 'nberry:3' }, () => {
  const g = new Grid(24, 24);
  g.rect(3, 10, 18, 12, 'B');
  g.rect(2, 7, 20, 4, 'B');
  for (let y = 8; y < 22; y++) for (let x = 3; x < 21; x++) if ((x * 3 + y) % 7 === 0 && g.get(x, y) === 'B') g.set(x, y, 'b');
  g.rect(11, 7, 2, 15, 'R'); g.rect(2, 8, 20, 1, 'R'); g.rect(3, 15, 18, 1, 'R');
  g.ellipse(9, 5, 3, 2, 'R'); g.ellipse(15, 5, 3, 2, 'R'); g.ellipse(9, 5, 1, 0.8, 'D'); g.ellipse(15, 5, 1, 0.8, 'D');
  g.ellipse(12, 15.5, 2.2, 2.2, 'Q'); g.set(12, 15, 's').set(11, 16, 's');
  // a hanging tag with a ?
  g.line(18, 9, 20, 13, 'R'); g.rect(17, 13, 6, 7, 'T');
  g.stamp(18, 14, ['.QQ.', '...Q', '..Q.', '....', '..Q.'], { Q: 'Q' });
  g.set(21, 2, '*').set(20, 3, 'w').set(22, 3, 'w').set(21, 4, 'w');
  return g.rows();
});
// a holly sprig (two leaves and three berries) for section corners
icon('shop_holly', { L: 'npine.r@l1', M: 'npine.r@l2', v: 'npine:5', B: 'nberry.R@b', b: 'nberry:5' }, [
  '.LL.......MM.',
  'LLLL.....MMMM',
  '.LLLL...MMMM.',
  'LLvLLL.MMvMMM',
  '.LLLvLBMvMMM.',
  '..LLLBBBMMM..',
  '....BBbBB....',
  '.....BBB.....',
]);
// a brass shop bell
icon('shop_bell', { B: 'nbrass.R@bell', b: 'nbrass:5', K: 'nwood.f@base', k: 'nwood:1' }, [
  '.....b.....',
  '....BBB....',
  '...BBBBB...',
  '..BBBBBBB..',
  '..BBBBBBB..',
  '.BBBBBBBBB.',
  'KKKKKKKKKKK',
  '.kkkkkkkkk.',
]);
// a fairy-light bulb, tinted per colour
for (const [n, m] of [['shop_bulb_a', 'nlamp'], ['shop_bulb_b', 'nrose'], ['shop_bulb_c', 'nsage'], ['shop_bulb_d', 'nfrost']]) {
  icon(n, { G: `${m}.R@g`, w: '#ffffff', k: 'nink:3' }, ['..k..', '.kkk.', '.GGG.', 'GGwGG', 'GGGGG', '.GGG.', '..G..']);
}
// a twinkle (four-point star) in three sizes for sparkles
icon('shop_twinkle', { W: 'nfrost:5!', Y: 'nlamp:4!' }, ['...Y...', '...W...', '..YWY..', 'YWWWWWY', '..YWY..', '...W...', '...Y...']);
icon('shop_twinkle_s', { W: 'nfrost:5!', Y: 'nlamp:4!' }, ['.Y.', 'YWY', '.Y.']);
// a little price tag with string
icon('shop_tag', { T: 'nkraft.f@t', t: 'nkraft:2', s: 'nlinen:2', k: 'nink:3' }, [
  's.........',
  '.s........',
  '..TTTTTTT.',
  '.TTtTTTTTT',
  'TTTTTkkTTT',
  '.TTTTTTTTT',
  '..TTTTTTT.',
]);
