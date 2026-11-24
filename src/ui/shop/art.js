// The lodge store's own pixel art (Barnaby's general store): 9-slice frames that feel like the store's real things (an
// oak board with brass corner brackets, cream and kraft paper with stitched edges, a ruled ledger page, a chalk slate in
// a wooden frame, a screwed brass plate, cloth ribbons, honey / moss / berry / plum / linen buttons with a hard lip,
// cloth price tags with an eyelet, a paper speech bubble, a dark oak plaque), tiling surface patterns (paper, kraft,
// planks, a ruled ledger, a screen-door dim), and the store's sprites (rarity stars, an hourglass, a parcel, a bell,
// a twinkle, a price tag). Painted procedurally on first use and shown crisp at whole-pixel scales. No smooth circles,
// no soft glows. OWNED BY THE SHOP BUILDER.
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

export const LG_FRAMES = {};
const BUILD = {};
function def(name, spec, build) {
  LG_FRAMES[name] = { w: spec.w, h: spec.h, slice: spec.slice, fill: spec.fill !== false, repeat: spec.repeat || 'stretch' };
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
// the store's board: an oak frame with a groove and brass corner brackets; paper or cloth shows inside
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
    b.corners(BRACKET, { k: C.ink, h: BRASS.hi, l: BRASS.lt, b: BRASS.base, r: C.ink }, 1);
    return b;
  };
}
def('lg_board', { w: 48, h: 48, slice: [12, 12, 12, 12], fill: false, repeat: 'round' }, board(OAK));
def('lg_board_gold', { w: 48, h: 48, slice: [12, 12, 12, 12], fill: false, repeat: 'round' }, board(OAK, { trim: BRASS }));
def('lg_board_dark', { w: 48, h: 48, slice: [12, 12, 12, 12], fill: false, repeat: 'round' }, board(OAK_DARK));

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
def('lg_paper', { w: 24, h: 24, slice: [7, 7, 9, 7], repeat: 'round' }, card(PAPER));
def('lg_kraft', { w: 24, h: 24, slice: [7, 7, 9, 7], repeat: 'round' }, card(KRAFT, { corner: '#a89068' }));
def('lg_velvet', { w: 24, h: 24, slice: [7, 7, 9, 7], repeat: 'round' }, card(VELVET, { corner: '#8a7652' }));

// a recessed slot (art wells, tables)
def('lg_slot', { w: 18, h: 18, slice: [6, 6, 6, 6] }, (b) => {
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
  sage: { ol: '#1f2a1c', dk: '#3a5233', sh: '#4d6b40', base: '#64844f', lt: '#86a46a', hi: '#c9d9a8' },
  honey: { ol: C.woodDeep, dk: '#8a6a34', sh: '#b08638', base: '#d4a34a', lt: '#e8c374', hi: '#f8e6b4' },
  berry: { ol: '#2e1416', dk: '#6e2a2c', sh: '#8e3634', base: '#b0443e', lt: '#cc6a5c', hi: '#f0c0aa' },
  plum: { ol: '#1e1628', dk: '#3e2c56', sh: '#55407a', base: '#6e5498', lt: '#9580bc', hi: '#d8ccec' },
};
def('lg_ribbon', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(CLOTH.sage));
def('lg_ribbon_gold', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(CLOTH.honey));
def('lg_ribbon_berry', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(CLOTH.berry));
def('lg_ribbon_violet', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(CLOTH.plum));

// chunky buttons with a hard lip; tones keep their old class names (gold, berry, violet, ice, frost, sage)
const BTN = {
  gold: CLOTH.honey,
  berry: CLOTH.berry,
  violet: CLOTH.plum,
  sage: CLOTH.sage,
  linen: { ol: C.woodDeep, dk: '#9b8f78', sh: '#bdb299', base: '#dcd3bd', lt: '#ebe5d4', hi: '#faf6ea' },
  slate: { ol: '#14181a', dk: '#2a3236', sh: '#38434a', base: '#4a5860', lt: '#66767e', hi: '#a8b6bc' },
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
for (const k of Object.keys(BTN)) { def(`lg_btn_${k}`, BT, button(BTN[k])); def(`lg_btn_${k}_down`, BT, button(BTN[k], true)); }

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
def('lg_tag_red', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(CLOTH.berry));
def('lg_tag_gold', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(CLOTH.honey));
def('lg_tag_slate', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(BTN.slate));
def('lg_tag_moss', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(CLOTH.sage));

// Barnaby's speech bubble: paper with an ink outline and cut corners
def('lg_bubble', { w: 16, h: 16, slice: [5, 5, 5, 5] }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h, 3), (d, l) => (d === 0 ? C.ink : d === 1 ? (l > 0 ? '#fffdf6' : C.linen) : C.paper));
  return b;
});

// a small dark oak plaque with a brass rim for counters and chips
def('lg_chip', { w: 16, h: 14, slice: [5, 6, 6, 6] }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h - 1, 2), (d, l, x, y) => (d === 0 ? C.ink : d === 1 ? (l > 0 ? BRASS.lt : BRASS.dk) : d === 2 ? (l > 0 ? C.bark : '#241d19') : grain(x, y, true, OAK_DARK)));
  for (let x = 2; x < b.w - 2; x++) b.set(x, b.h - 1, [20, 24, 30, 110]);
  return b;
});

// a chalk slate in a pine frame: dark slate with chalk smudges, a lit frame edge, corner nails
def('lg_slate', { w: 32, h: 32, slice: [9, 9, 9, 9], repeat: 'round' }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h - 1, 2), (d, l, x, y) => {
    if (d === 0) return C.ink;
    if (d <= 5) { const g = grain(x, y, y < 6 || y > b.h - 8, OAK); return d === 1 ? (l > 0 ? OAK.hi : OAK.dk) : d === 5 ? (l > 0 ? OAK.dk : OAK.lt) : g; }
    if (d === 6) return '#1a2023';
    const v = hn(x, y, 31);
    return v > 0.94 ? '#4a565c' : v < 0.06 ? '#283034' : '#323c41';
  });
  for (const [x, y] of [[2, 2], [b.w - 4, 2], [2, b.h - 5], [b.w - 4, b.h - 5]]) b.set(x, y, C.iron).set(x + 1, y, '#8a8680');
  for (let x = 2; x < b.w - 2; x++) b.set(x, b.h - 1, [27, 34, 45, 110]);
  return b;
});
// a brass plate with four screws and a rubbed shine
def('lg_brass', { w: 24, h: 18, slice: [6, 6, 7, 6], repeat: 'round' }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h - 1, 2), (d, l, x, y) => {
    if (d === 0) return '#3d2e16';
    if (d === 1) return l > 0 ? BRASS.hi : BRASS.dk;
    if (d === 2) return l > 0 ? BRASS.lt : '#a3864c';
    return hn(x, y, 41) > 0.9 ? BRASS.lt : (x + y) % 9 === 0 ? '#bf9c58' : BRASS.base;
  });
  for (const [x, y] of [[3, 3], [b.w - 5, 3], [3, b.h - 6], [b.w - 5, b.h - 6]]) { b.set(x, y, BRASS.dk).set(x + 1, y + 1, BRASS.dk).set(x + 1, y, BRASS.hi); }
  for (let x = 2; x < b.w - 2; x++) b.set(x, b.h - 1, [27, 34, 45, 110]);
  return b;
});

// a small carved plank for signs: grain along it, a lit top edge, two nail heads
def('lg_plank', { w: 28, h: 18, slice: [6, 7, 7, 7], repeat: 'stretch' }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h - 2, 2), (d, l, x, y) => {
    if (d === 0) return inked(C.ink, x, y);
    if (d === 1) return l > 0 ? '#e8c890' : '#5a3d24';
    const g = grain(x, y, true, { ol: C.ink, dk: '#5a3d24', sh: '#7d5634', base: '#a2723f', lt: '#bf8f55', hi: '#e0b57a' });
    return y >= b.h - 5 ? (g === '#a2723f' ? '#8d6236' : '#6f4c2c') : g;
  });
  for (const x of [4, b.w - 5]) b.set(x, 4, '#3a3029').set(x, 5, '#6a5e50').set(x + 1, 4, '#b0a08a');
  for (let x = 2; x < b.w - 2; x++) { b.set(x, b.h - 2, [27, 20, 12, 120]); b.set(x, b.h - 1, [27, 20, 12, 60]); }
  return b;
});
def('lg_plank_down', { w: 28, h: 18, slice: [6, 7, 7, 7], repeat: 'stretch' }, (b) => {
  bevel(b, chamfer(0, 2, b.w, b.h - 2, 2), (d, l, x, y) => {
    if (d === 0) return inked(C.ink, x, y);
    if (d === 1) return l > 0 ? '#c9a46c' : '#4a3220';
    return grain(x, y, true, { ol: C.ink, dk: '#4a3220', sh: '#6a4a2c', base: '#8a6236', lt: '#a7784a', hi: '#c49a64' });
  });
  for (const x of [4, b.w - 5]) b.set(x, 6, '#3a3029').set(x + 1, 6, '#9a8a74');
  return b;
});

// ------------------------------------------------------------------ CSS

const cv = new Map(), urls = new Map();
const normScale = (s) => Math.max(1, Math.min(12, Math.round(s)));
function frameCanvas(name, scale) {
  const key = name + '@' + scale;
  if (cv.has(key)) return cv.get(key);
  const f = LG_FRAMES[name];
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
export function lgURL(name, scale = 2) {
  scale = normScale(scale);
  const key = name + '@' + scale;
  if (!urls.has(key)) urls.set(key, frameCanvas(name, scale).toDataURL('image/png'));
  return urls.get(key);
}
const devK = () => { const r = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, k = Math.round(r); return k >= 2 && k <= 4 && Math.abs(r - k) < 0.01 ? k : 1; };
/** CSS declarations that make an element wear a frame (border-image 9-slice). */
export function lgStyle(name, scale = 2) {
  scale = normScale(scale);
  const f = LG_FRAMES[name], k = devK(), url = lgURL(name, scale * k);
  const [t, r, b, l] = f.slice.map((v) => v * scale), [st, sr, sb, sl] = f.slice.map((v) => v * scale * k);
  return `border-style:solid;border-width:${t}px ${r}px ${b}px ${l}px;border-image-source:url("${url}");border-image-slice:${st} ${sr} ${sb} ${sl}${f.fill ? ' fill' : ''};border-image-width:${t}px ${r}px ${b}px ${l}px;border-image-repeat:${f.repeat};image-rendering:pixelated`;
}

// ------------------------------------------------------------------ tiling surface patterns

/** Realistic paper, the way BUSHED paints its notes: a warm base with soft mottling, short fibres and a few
 * flecks of foxing, lightly quantised. Tileable (the mottling uses whole periods of the tile). */
function paperTile(N, base, seed, o = {}) {
  const [br, bg, bb] = rgb(base), px = new Array(N * N);
  const T = (a, b, ph) => Math.sin(((a * 0) + ph)) * 0, TAU = Math.PI * 2; void T;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const n = Math.sin(TAU * (x * 1 + y * 2) / N + seed) * 2.2 + Math.sin(TAU * (x * 3 - y * 1) / N + seed * 2) * 1.6 + Math.sin(TAU * (x * 5 + y * 4) / N + seed * 3) * 0.9 + (hn(x, y, seed) - 0.5) * (o.grain ?? 6);
    px[y * N + x] = n;
  }
  // fibres: short streaks, mostly along x
  for (let k = 0; k < N * N * 0.012; k++) {
    const x0 = Math.floor(hn(k, 1, seed) * N), y0 = Math.floor(hn(k, 2, seed) * N), len = 2 + Math.floor(hn(k, 3, seed) * 5), d = hn(k, 4, seed) > 0.5 ? 5 : -4;
    for (let i = 0; i < len; i++) px[((y0 + (i > 2 && hn(k, 5, seed) > 0.6 ? 1 : 0)) % N) * N + ((x0 + i) % N)] += d;
  }
  // foxing flecks
  for (let k = 0; k < (o.fox ?? 6); k++) { const x0 = Math.floor(hn(k, 7, seed) * N), y0 = Math.floor(hn(k, 8, seed) * N); px[y0 * N + x0] -= 14; px[y0 * N + ((x0 + 1) % N)] -= 8; }
  return (x, y) => { const n = px[(y % N) * N + (x % N)]; const q = (v) => Math.max(0, Math.min(255, Math.round((v + n) / 4) * 4)); return '#' + [q(br), q(bg - 0.2 * Math.abs(n)), q(bb - 0.5 * Math.abs(n))].map((v) => v.toString(16).padStart(2, '0')).join(''); };
}
const PAPER_TILE = paperTile(64, '#efe6d0', 3);
const KRAFT_TILE = paperTile(64, '#cdb48c', 9, { grain: 9, fox: 3 });
const PAT = {
  /** the board's inside: realistic warm paper */
  linen: [64, 64, PAPER_TILE],
  /** kraft paper */
  kraft: [64, 64, KRAFT_TILE],
  /** a ruled ledger page: cream paper, blue rules every 8 px, a red margin line */
  ledger: [64, 64, (x, y) => (x === 9 || x === 11 ? '#c0504a' : y % 8 === 7 ? '#a9bcc8' : PAPER_TILE(x, y))],
  /** dusk velvet */
  velvet: [8, 8, (x, y) => ((x + y) % 4 === 0 ? '#2f3b4a' : (x - y + 8) % 4 === 0 ? '#222b37' : C.night)],
  /** oak planks running sideways */
  planks: [32, 12, (x, y) => (y % 6 === 0 ? C.woodDeep : y % 6 === 1 ? C.woodLight : grain(x + (y >= 6 ? 13 : 0), y % 6, true, OAK))],
  /** a screen-door dim for modal backdrops */
  dim: [2, 2, (x, y) => ((x + y) % 2 ? '#1b222dcc' : '#1b222d99')],
  /** sage wallpaper stripes for the gacha frame */
  stripe: [8, 8, (x, y) => (x < 4 ? (hn(x, y, 1) > 0.9 ? '#d6ddb6' : C.sageLight) : x === 6 ? C.sage : (hn(x, y, 7) > 0.92 ? '#e2d6b8' : C.oat))],
};
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
export function raysURL(off = 0, n = 18, size = 256) {
  const key = 'rays:' + off + ':' + n + ':' + size;
  if (urls.has(key)) return urls.get(key);
  const b = new Buf(size, size), c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - c, dy = y + 0.5 - c, r = Math.hypot(dx, dy) / c;
    if (r > 1 || r < 0.08) continue;
    const a = ((Math.atan2(dy, dx) / Math.PI / 2 + 1) * n + off * 0.5) % 1;
    if (a > 0.42) continue;
    const core = a > 0.08 && a < 0.34;
    const alpha = (core ? 190 : 110) * (r > 0.8 ? 0.35 : r > 0.6 ? 0.6 : 1);
    b.set(x, y, [255, 255, 255, Math.round(alpha)]);
  }
  urls.set(key, toURL(b));
  return urls.get(key);
}
/** A pixel burst: concentric stepped rings and a 4-point star, white (tint with a filter or mix-blend) */
export function burstURL(size = 128, col = '#ffffff') {
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
/** Injects `.lf-<name>` (2x) and `.lf3-<name>` (3x) classes for every frame, `.lg-btn.<tone>` buttons, and pattern
 * variables (--lg-pat-*, --lg-wood, --lg-burlap ...), once. */
export function injectLodgeCSS() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  let css = '';
  for (const n of Object.keys(LG_FRAMES)) css += `.lf-${n}{${lgStyle(n, 2)};background-color:transparent}\n.lf3-${n}{${lgStyle(n, 3)};background-color:transparent}\n`;
  for (const k of Object.keys(BTN)) css += `.lg-btn.${k}{${lgStyle(`lg_btn_${k}`, 2)}}\n.lg-btn.${k}:active:not(.off),.lg-btn.${k}.down{${lgStyle(`lg_btn_${k}_down`, 2)}}\n`;
  // the store's things wear their materials: paper tags, kraft labels, brass plates, cloth, planks, the oak board
  const WEAR = {
    '.lg-ptag': 'lg_paper', '.lg-ktag': 'lg_kraft', '.lg-ktag.brass': 'lg_brass', '.lg-cloth.on': 'lg_ribbon_berry', '.lg-cloth.soon': 'lg_ribbon_violet',
    '.lg-navsign': 'lg_plank', '.lg-navsign:active,.lg-navsign.on': 'lg_plank_down', '.lg-card': 'lg_board', '.lg-ledger': 'lg_paper', '.lg-gtag': 'lg_kraft',
    '.lg-burlap': 'lg_kraft', '.lg-plate': 'lg_brass', '.lg-page': 'lg_paper', '.lg-prize-page': 'lg_paper', '.lg-timer': 'lg_chip',
  };
  for (const [sel, fr] of Object.entries(WEAR)) css += `${sel}{${lgStyle(fr, 2)}}\n`;
  css += ':root{';
  for (const p of Object.keys(PAT)) css += `--lg-pat-${p}:url("${patternURL(p, 2)}");`;
  css += `--lg-rays-a:url("${raysURL(0)}");--lg-rays-b:url("${raysURL(1)}");--lg-burst:url("${burstURL()}");--lg-burst-gold:url("${burstURL(128, '#ffd27a')}");--lg-burst-violet:url("${burstURL(128, '#c79bff')}");--lg-burst-blue:url("${burstURL(128, '#8fd0ff')}");--lg-twinkle:url("${spriteURL('shop_twinkle', 2)}");`;
  // the store's own materials (BUSHED's photo-based pixel textures, restyled): warm boards, burlap
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  css += `--lg-wood:url("${base}models/shop/tex/board.webp");--lg-burlap:url("${base}models/shop/tex/burlap.webp");--lg-log:url("${base}models/shop/tex/log.webp");`;
  css += '}\n';
  const st = document.createElement('style');
  st.id = 'hh-lodge-frames';
  st.textContent = css;
  document.head.appendChild(st);
}

// ------------------------------------------------------------------ sprites

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
