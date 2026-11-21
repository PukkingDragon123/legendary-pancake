// The boutique's own pixel art: 9-slice ICE frames (frosted glass panels with silver and pale
// gold trim and snowflake corner ornaments, icy ribbons, icy and gold buttons, price tags) and a
// few sprites (snowflakes, icicles, hangers, the gift box, rarity stars). Painted procedurally on
// first use, like the BME frames in ../px/frames.js, and shown crisp at whole-pixel scales.
import { Grid, icon, draw, render } from '../px/sprites.js';

// ------------------------------------------------------------------ a tiny RGBA buffer

function rgb(h) {
  const s = h.replace('#', '');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255];
}
const C = (h) => (h == null ? null : Array.isArray(h) ? h : rgb(h));
class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  a(x, y) { return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0; }
  set(x, y, c) {
    if (!this.in(x, y) || c == null) return this;
    c = C(c);
    const i = (y * this.w + x) * 4, sa = (c[3] ?? 255) / 255;
    if (sa >= 1) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255; return this; }
    const da = this.d[i + 3] / 255, oa = sa + da * (1 - sa);
    if (oa <= 0) return this;
    for (let k = 0; k < 3; k++) this.d[i + k] = Math.round((c[k] * sa + this.d[i + k] * da * (1 - sa)) / oa);
    this.d[i + 3] = Math.round(oa * 255);
    return this;
  }
  rows(x, y, rows, map) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== '.' && map[r[i]] !== undefined) this.set(x + i, y + j, map[r[i]]); }); return this; }
  corners(rows, map, inset = 0) {
    const w = rows[0].length, h = rows.length, fx = rows.map((r) => r.split('').reverse().join(''));
    this.rows(inset, inset, rows, map); this.rows(this.w - w - inset, inset, fx, map);
    this.rows(inset, this.h - h - inset, rows.slice().reverse(), map); this.rows(this.w - w - inset, this.h - h - inset, fx.slice().reverse(), map);
    return this;
  }
}
function rrMask(x0, y0, w, h, r) {
  return (x, y) => {
    if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
    if (r <= 0) return true;
    const cx = Math.min(Math.max(x + 0.5, x0 + r), x0 + w - r), cy = Math.min(Math.max(y + 0.5, y0 + r), y0 + h - r);
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    return dx * dx + dy * dy <= r * r + 0.15 * r;
  };
}
/** chamfered (cut-corner) rectangle: an ice-cut look */
function chamfer(x0, y0, w, h, c) {
  return (x, y) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h && x - x0 + (y - y0) >= c && x0 + w - 1 - x + (y - y0) >= c && x - x0 + (y0 + h - 1 - y) >= c && x0 + w - 1 - x + (y0 + h - 1 - y) >= c;
}
/** Erosion depth of every pixel of a mask; lit > 0 faces up/left. */
function bevel(b, mask, pal, max = 14) {
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

// ------------------------------------------------------------------ palettes

const ICE = { ol: '#14254c', dk: '#2f5a94', sh: '#5c8fc8', base: '#8fc4ec', lt: '#c6e8fb', hi: '#ffffff', fill: '#eaf6fdee', fill2: '#ddeff9ee' };
const ICED = { ol: '#0b1430', dk: '#1c2f5e', sh: '#2c4a86', base: '#41679f', lt: '#6f97c9', hi: '#cfe6ff', fill: '#16244ae6', fill2: '#1b2b56e6' };
const SILVER = { dk: '#6f7c9c', base: '#b9c4dc', hi: '#f4f7ff' };
const PGOLD = { dk: '#9a7430', base: '#e6c46c', lt: '#f7e3a4', hi: '#fffbe6' };
const BTN = {
  ice: { ol: '#14254c', dk: '#2f5a94', sh: '#4f86c4', base: '#7cbcea', lt: '#b8e2fa', hi: '#ffffff' },
  gold: { ol: '#5e3a0c', dk: '#a8701c', sh: '#dc9e2a', base: '#f6c64a', lt: '#ffe796', hi: '#fffbe0' },
  berry: { ol: '#4a0f24', dk: '#8e1c3c', sh: '#c22e4e', base: '#e44b62', lt: '#ff9aa2', hi: '#ffe2e2' },
  violet: { ol: '#221246', dk: '#43307e', sh: '#6650b2', base: '#8c76de', lt: '#c4b6fa', hi: '#f6f0ff' },
  frost: { ol: '#3a4664', dk: '#7a86a4', sh: '#a2acc4', base: '#c8d0e0', lt: '#e6ecf6', hi: '#ffffff' },
};

// snowflake ornament for frame corners (top-left orientation)
const FLAKE = [
  '...s.....',
  '..sGs....',
  '.s.G.s...',
  'sGGWGGs..',
  '.s.G.s...',
  '..sGs.G..',
  '...s..Gs.',
  '......sG.',
  '.......s.',
];

export const ICE_FRAMES = {};
const BUILD = {};
function def(name, spec, build) {
  ICE_FRAMES[name] = { w: spec.w, h: spec.h, slice: spec.slice, fill: spec.fill !== false, repeat: spec.repeat || 'stretch' };
  BUILD[name] = () => build(new Buf(spec.w, spec.h), spec);
}

// frosted panel: icy rim with crystal facets, a silver inner trim, gold snowflake corners
function panel(P, o = {}) {
  return (b) => {
    const W = b.w, H = b.h;
    bevel(b, chamfer(0, 0, W, H, 3), (d, l, x, y) => {
      if (d === 0) return P.ol;
      if (d === 1) return l > 0 ? P.hi : l < 0 ? P.sh : P.lt;
      if (d === 2) return l > 0 ? P.lt : l < 0 ? P.dk : P.base;
      if (d === 3) { const f = (x + y) % 5 === 0 || (x - y + 99) % 7 === 0; return f ? P.lt : l < 0 ? P.sh : P.base; }
      if (d === 4) return l > 0 ? P.base : P.sh;
      if (d === 5) return o.gold ? (l > 0 ? PGOLD.hi : PGOLD.dk) : (l > 0 ? SILVER.hi : SILVER.dk);
      if (d === 6) return o.gold ? PGOLD.base : SILVER.base;
      if (d === 7) return P.ol;
      if (d === 8) return l > 0 ? '#ffffff55' : P.fill;
      return hn(x, y, 3) > 0.93 ? P.fill2 : P.fill;
    });
    b.corners(FLAKE, { s: o.gold ? PGOLD.dk : P.dk, G: o.gold ? PGOLD.base : PGOLD.lt, W: '#ffffff' }, 0);
    return b;
  };
}
def('ice_panel', { w: 40, h: 40, slice: [12, 12, 12, 12] }, panel(ICE));
def('ice_panel_gold', { w: 40, h: 40, slice: [12, 12, 12, 12] }, panel(ICE, { gold: true }));
def('ice_panel_dark', { w: 40, h: 40, slice: [12, 12, 12, 12] }, panel(ICED));

// a smaller card for shop offers
function card(P, o = {}) {
  return (b) => {
    const W = b.w, H = b.h;
    bevel(b, chamfer(0, 0, W, H - 1, 2), (d, l, x, y) => {
      if (d === 0) return P.ol;
      if (d === 1) return l > 0 ? P.hi : l < 0 ? P.sh : P.lt;
      if (d === 2) return o.gold ? (l > 0 ? PGOLD.lt : PGOLD.dk) : l > 0 ? P.lt : P.base;
      if (d === 3) return o.gold ? PGOLD.base : P.dk;
      if (d === 4) return l > 0 ? '#ffffffaa' : P.fill;
      return P.fill;
    });
    for (let x = 2; x < W - 2; x++) b.set(x, H - 1, [10, 20, 50, 80]);
    b.set(3, 3, '#ffffff').set(4, 3, P.hi).set(3, 4, P.hi);
    return b;
  };
}
def('ice_card', { w: 20, h: 20, slice: [6, 6, 7, 6] }, card(ICE));
def('ice_card_gold', { w: 20, h: 20, slice: [6, 6, 7, 6] }, card(ICE, { gold: true }));
def('ice_card_dark', { w: 20, h: 20, slice: [6, 6, 7, 6] }, card(ICED));

// a recessed frosted slot for item art
def('ice_slot', { w: 18, h: 18, slice: [6, 6, 6, 6] }, (b) => {
  const W = b.w, H = b.h, P = ICE;
  bevel(b, chamfer(0, 0, W, H, 3), (d, l, x, y) => {
    if (d === 0) return P.dk;
    if (d === 1) return l > 0 ? P.sh : P.hi;
    if (d === 2) return l > 0 ? P.base : P.lt;
    return hn(x, y) > 0.9 ? '#d4ecfa' : '#c4e2f6';
  });
  return b;
});

// icy ribbon banner for section titles: silver edges, notched tails, a snowflake knot
function ribbon(P, o = {}) {
  return (b) => {
    const W = b.w, H = b.h, TW = 10;
    for (const side of [0, 1]) {
      const m = (x, y) => { const yy = y - 4, th = H - 6; if (yy < 0 || yy >= th || x < 0 || x >= TW + 2) return false; const mid = (th - 1) / 2, notch = 4 - Math.round(Math.abs(yy - mid) * 1.1); return x >= Math.max(0, notch); };
      const tb = new Buf(W, H);
      bevel(tb, (x, y) => m(side ? W - 1 - x : x, y), (d, l) => (d === 0 ? P.ol : d === 1 && l > 0 ? P.base : P.dk));
      for (let i = 0; i < tb.d.length; i += 4) if (tb.d[i + 3]) { b.d[i] = tb.d[i]; b.d[i + 1] = tb.d[i + 1]; b.d[i + 2] = tb.d[i + 2]; b.d[i + 3] = 255; }
    }
    bevel(b, rrMask(6, 0, W - 12, H - 4, 1), (d, l, x, y) => {
      if (d === 0) return P.ol;
      if (y === 1) return o.trim ?? SILVER.hi;
      if (y === 2) return P.lt;
      if (y === H - 6) return o.trim2 ?? SILVER.base;
      if (y >= H - 7) return P.sh;
      return P.base;
    });
    b.rows(6, H - 5, ['oo', 'do', '.o'], { o: P.ol, d: P.dk });
    b.rows(W - 8, H - 5, ['oo', 'od', 'o.'], { o: P.ol, d: P.dk });
    return b;
  };
}
def('ice_ribbon', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(BTN.ice));
def('ice_ribbon_gold', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(BTN.gold, { trim: '#fffbe6', trim2: '#fff0b0' }));
def('ice_ribbon_berry', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(BTN.berry, { trim: '#ffe2e2', trim2: '#f7e3a4' }));
def('ice_ribbon_violet', { w: 44, h: 20, slice: [5, 13, 7, 13] }, ribbon(BTN.violet, { trim: '#f6f0ff', trim2: '#f7e3a4' }));

// chunky buttons with a 3D lip and a frost sparkle
function button(P, down = false) {
  return (b) => {
    const W = b.w, H = b.h, top = down ? 2 : 0, lip = down ? 0 : 2, bodyH = H - top - lip;
    if (lip) bevel(b, chamfer(0, top + 2, W, bodyH, 2), (d) => (d === 0 ? P.ol : P.dk));
    bevel(b, chamfer(0, top, W, bodyH, 2), (d, l, x, y) => {
      if (d === 0) return P.ol;
      const yy = y - top;
      if (d === 1 && l < 0 && yy > 2) return P.sh;
      if (yy <= 2) return P.lt;
      if (yy >= bodyH - 3) return P.sh;
      return P.base;
    });
    if (down) b.set(3, top + 2, P.sh);
    else b.set(2, 2, P.hi).set(3, 1, P.hi).set(2, 3, P.hi).set(W - 4, 1, P.hi);
    return b;
  };
}
const BT = { w: 18, h: 18, slice: [6, 6, 7, 6] };
for (const k of Object.keys(BTN)) { def(`ice_btn_${k}`, BT, button(BTN[k])); def(`ice_btn_${k}_down`, BT, button(BTN[k], true)); }

// a price / discount tag: a hanging card with a punched hole on the left
function tag(P) {
  return (b) => {
    const W = b.w, H = b.h;
    const m = (x, y) => x >= 0 && y >= 0 && x < W && y < H - 1 && x + Math.abs(y - (H - 2) / 2) >= 4;
    bevel(b, m, (d, l) => (d === 0 ? P.ol : d === 1 ? (l > 0 ? P.lt : P.sh) : P.base));
    b.set(4, Math.floor((H - 1) / 2), P.ol).set(4, Math.floor((H - 1) / 2) - 1, P.dk);
    for (let x = 4; x < W - 1; x++) b.set(x, H - 1, [10, 20, 50, 90]);
    return b;
  };
}
def('ice_tag_berry', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(BTN.berry));
def('ice_tag_gold', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(BTN.gold));
def('ice_tag_ice', { w: 20, h: 13, slice: [4, 4, 5, 8] }, tag(BTN.ice));

// the queen's speech bubble: frosted with a silver rim
def('ice_bubble', { w: 16, h: 16, slice: [5, 5, 5, 5] }, (b) => {
  bevel(b, rrMask(0, 0, b.w, b.h, 4), (d, l) => (d === 0 ? ICE.ol : d === 1 ? (l > 0 ? '#ffffff' : SILVER.dk) : d === 2 ? (l > 0 ? '#ffffff' : '#e4f1fb') : '#f7fbff'));
  return b;
});

// a small plaque for counters and chips
def('ice_chip', { w: 16, h: 14, slice: [5, 6, 6, 6] }, (b) => {
  bevel(b, chamfer(0, 0, b.w, b.h - 1, 2), (d, l) => (d === 0 ? ICED.ol : d === 1 ? (l > 0 ? ICED.lt : ICED.dk) : d === 2 ? (l > 0 ? SILVER.base : SILVER.dk) : ICED.fill));
  for (let x = 2; x < b.w - 2; x++) b.set(x, b.h - 1, [0, 0, 0, 90]);
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
/** CSS declarations that make an element wear an ice frame (border-image 9-slice). */
export function iceStyle(name, scale = 2) {
  scale = normScale(scale);
  const f = ICE_FRAMES[name], k = devK(), url = iceURL(name, scale * k);
  const [t, r, b, l] = f.slice.map((v) => v * scale), [st, sr, sb, sl] = f.slice.map((v) => v * scale * k);
  return `border-style:solid;border-width:${t}px ${r}px ${b}px ${l}px;border-image-source:url("${url}");border-image-slice:${st} ${sr} ${sb} ${sl}${f.fill ? ' fill' : ''};border-image-width:${t}px ${r}px ${b}px ${l}px;border-image-repeat:${f.repeat};image-rendering:pixelated`;
}
let injected = false;
/** Injects `.if-<name>` (2x) and `.if3-<name>` (3x) classes for every ice frame, once. */
export function injectIceCSS() {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  let css = '';
  for (const n of Object.keys(ICE_FRAMES)) css += `.if-${n}{${iceStyle(n, 2)};background:none}\n.if3-${n}{${iceStyle(n, 3)};background:none}\n`;
  // the boutique's buttons: .nv-btn.<tone> with a pressed state
  for (const k of Object.keys(BTN)) css += `.nv-btn.${k}{${iceStyle(`ice_btn_${k}`, 2)}}\n.nv-btn.${k}:active:not(.off),.nv-btn.${k}.down{${iceStyle(`ice_btn_${k}_down`, 2)}}\n`;
  const st = document.createElement('style');
  st.id = 'hh-ice-frames';
  st.textContent = css;
  document.head.appendChild(st);
}

// ------------------------------------------------------------------ sprites

icon('ice_flake', { W: 'ice:5', B: 'ice.r@f', b: 'sky:2', G: 'gold:4' }, [
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
icon('ice_flake_s', { W: 'ice:5!', B: 'ice:4' }, ['..W..', '.WBW.', 'WBBBW', '.WBW.', '..W..']);
// icicles that tile along a ledge (16 px period)
draw('ice_icicles', () => {
  const g = new Grid(16, 10);
  const drips = [[1, 4], [4, 8], [7, 3], [10, 6], [13, 9], [15, 3]];
  g.rect(0, 0, 16, 2, 'I');
  for (const [x, h] of drips) { for (let y = 1; y < h; y++) { const w = y < h * 0.45 ? 2 : 1; g.rect(x - (w > 1 ? 1 : 0), y, w, 1, 'I'); } g.set(x, h - 1, 'w'); }
  return render(g, { I: 'ice.x@ice', w: 'ice:5' }, { ol: '#1d3a6c' });
});
// a coat hanger with a silver hook
icon('shop_hanger', { S: 'steel.r@hook', s: 'steel:5', W: 'lwood.y@bar', w: 'lwood:5' }, () => {
  const g = new Grid(22, 14);
  g.set(11, 0, 'S').set(12, 0, 'S').set(13, 1, 'S').set(13, 2, 'S').set(12, 3, 'S').set(11, 4, 'S');
  g.set(11, 5, 'S');
  g.line(11, 6, 1, 11, 'W').line(11, 6, 21, 11, 'W').line(12, 6, 2, 11, 'W').line(10, 6, 20, 11, 'W');
  g.rect(1, 11, 21, 2, 'W'); g.line(2, 11, 20, 11, 'w');
  g.set(12, 0, 's');
  return g.rows();
});
// the free daily gift: a frosted box with a red satin bow
icon('shop_gift', { B: 'ice.r@box', b: 'ice:5', R: 'red.y@rib', r: 'red:5', D: 'red:1', G: 'gold:4' }, () => {
  const g = new Grid(24, 24);
  g.rect(3, 11, 18, 11, 'B');
  g.rect(2, 8, 20, 4, 'B');
  g.rect(10, 8, 4, 14, 'R'); g.rect(2, 9, 20, 2, 'R');
  g.line(11, 9, 11, 21, 'r');
  // bow loops
  g.ellipse(7.5, 5.6, 4.2, 3.2, 'R'); g.ellipse(16.5, 5.6, 4.2, 3.2, 'R');
  g.ellipse(7.5, 5.6, 1.8, 1.3, 'D'); g.ellipse(16.5, 5.6, 1.8, 1.3, 'D');
  g.rect(10, 5, 4, 4, 'R'); g.set(11, 5, 'r').set(10, 6, 'r');
  g.line(10, 8, 7, 12, 'R').line(13, 8, 16, 12, 'R');
  // frost speckles and a sparkle
  for (const [x, y] of [[5, 14], [17, 17], [6, 19], [16, 13], [4, 9], [19, 9]]) g.set(x, y, 'b');
  g.set(20, 2, 'G').set(21, 1, '*').set(19, 1, 'G').set(21, 3, 'G');
  return g.rows();
});
// rarity star (gold, violet, blue)
for (const [n, m] of [['shop_star5', 'gold'], ['shop_star4', 'lilac'], ['shop_star3', 'sky']]) {
  icon(n, { S: `${m}.R@star`, w: '#ffffff' }, ['....S....', '....S....', '...SSS...', 'SSSSSSSSS', '.SSSwSSS.', '..SSSSS..', '..SS.SS..', '.SS...SS.', '.S.....S.']);
}
// a little frosted hourglass for the reset timer
icon('shop_timer', { F: 'steel.y@frame', f: 'steel:5', G: 'glass.r@g', S: 'ice:5', s: 'ice:3' }, [
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
// a gem-to-acorn swap arrow
icon('shop_swap', { A: 'gold.x@arr', a: 'gold:5' }, ['....A....', '....AA...', 'AAAAAAA..', 'AaaaaaAA.', 'AAAAAAA..', '....AA...', '....A....']);

// a mystery present: a frosted box with a violet bow and a big gold question mark
icon('shop_mystery', { B: 'lilac.r@box', b: 'lilac:5', D: 'lilac:1', R: 'purple.y@rib', r: 'purple:5', Q: 'gold.R@q', q: 'gold:1', w: '#ffffff' }, () => {
  const g = new Grid(24, 24);
  g.rect(3, 12, 18, 10, 'B');
  g.rect(2, 9, 20, 4, 'B');
  g.rect(10, 9, 4, 13, 'R'); g.rect(2, 10, 20, 2, 'R');
  g.ellipse(7.5, 6.4, 4, 3, 'R'); g.ellipse(16.5, 6.4, 4, 3, 'R');
  g.ellipse(7.5, 6.4, 1.6, 1.2, 'D'); g.ellipse(16.5, 6.4, 1.6, 1.2, 'D');
  g.rect(10, 6, 4, 4, 'R'); g.set(11, 6, 'r');
  // the question mark on the front
  g.stamp(4, 13, ['.QQQ.', 'Q...Q', '...Q.', '..Q..', '.....', '..Q..'], { Q: 'Q' });
  g.stamp(15, 13, ['.QQQ.', 'Q...Q', '...Q.', '..Q..', '.....', '..Q..'], { Q: 'Q' });
  for (const [x, y] of [[4, 20], [19, 20], [3, 12], [20, 12]]) g.set(x, y, 'b');
  g.set(21, 2, '*').set(20, 3, 'w').set(22, 3, 'w').set(21, 4, 'w').set(2, 4, 'w');
  return g.rows();
});
