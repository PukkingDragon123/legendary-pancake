// 9-slice pixel-art UI frames, first made for "The Bear Must Eat" and repainted in Hoot Hollow's
// calm "Moss & Moonlight" palette: oat paper with fibres, muted planked wood with long grain and
// brass rivets, mossy, honey, berry and dusk buttons, brass slots with leaf scrolls, stitched
// ribbons. Paper and wood frames tile (border-image-repeat: repeat) so their texture never smears.
//
//   FRAMES[name] = { w, h, slice: [top, right, bottom, left], fill, repeat?, fixed? }
//   frameCanvas(name, scale = 2)  -> cached <canvas> (nearest-neighbour upscale)
//   frameURL(name, scale = 2)     -> cached data: URL
//   frameStyle(name, scale = 2)   -> CSS declarations (border-image ... / border-style)
//   injectFrameCSS()              -> once: <style id="tbme-frames"> with .f-<name> (2x)
//                                    and .f3-<name> (3x) for every frame
//
// Frames are painted procedurally into a small RGBA buffer the first time
// they are asked for. Importing this module never touches the DOM.
// Fixed-size pieces (medallion, bubble_tail, think_tail) have fixed: true and
// slice [0, 0, 0, 0]; frameStyle() returns a background for those.

import { calm } from './calm.js';

// ---------------------------------------------------------------- colour
function rgb(h) {
  const s = h.replace('#', '');
  const n = parseInt(s.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255];
}
const C = (h) => (h == null ? null : Array.isArray(h) ? h : rgb(h));

// ---------------------------------------------------------------- buffer
class Buf {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  in(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  a(x, y) {
    return this.in(x, y) ? this.d[(y * this.w + x) * 4 + 3] : 0;
  }
  set(x, y, c) {
    if (!this.in(x, y) || c == null) return this;
    c = C(c);
    const i = (y * this.w + x) * 4;
    if (c[3] === 255 || c[3] === undefined) {
      this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = 255;
      return this;
    }
    const sa = c[3] / 255, da = this.d[i + 3] / 255, oa = sa + da * (1 - sa);
    if (oa <= 0) return this;
    for (let k = 0; k < 3; k++) this.d[i + k] = Math.round((c[k] * sa + this.d[i + k] * da * (1 - sa)) / oa);
    this.d[i + 3] = Math.round(oa * 255);
    return this;
  }
  clear(x, y) {
    if (this.in(x, y)) this.d[(y * this.w + x) * 4 + 3] = 0;
    return this;
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
    return this;
  }
  hline(x0, x1, y, c) {
    return this.rect(x0, y, x1 - x0 + 1, 1, c);
  }
  vline(x, y0, y1, c) {
    return this.rect(x, y0, 1, y1 - y0 + 1, c);
  }
  // paint rows; map: char -> colour ('.' skipped)
  rows(x, y, rows, map) {
    rows.forEach((r, j) => {
      for (let i = 0; i < r.length; i++) if (r[i] !== '.' && map[r[i]] !== undefined) this.set(x + i, y + j, map[r[i]]);
    });
    return this;
  }
  // mirrored copies of a corner motif drawn at the top-left
  corners(rows, map, inset = 0) {
    const w = rows[0].length, h = rows.length;
    const fx = rows.map((r) => r.split('').reverse().join(''));
    this.rows(inset, inset, rows, map);
    this.rows(this.w - w - inset, inset, fx, map);
    this.rows(inset, this.h - h - inset, rows.slice().reverse(), map);
    this.rows(this.w - w - inset, this.h - h - inset, fx.slice().reverse(), map);
    return this;
  }
}

// ---------------------------------------------------------------- shapes
// rounded-rect mask with corner radius r (pixel-centre test)
function rrMask(x0, y0, w, h, r) {
  return (x, y) => {
    if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
    if (r <= 0) return true;
    const cx = Math.min(Math.max(x + 0.5, x0 + r), x0 + w - r);
    const cy = Math.min(Math.max(y + 0.5, y0 + r), y0 + h - r);
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
    return dx * dx + dy * dy <= r * r + 0.15 * r;
  };
}
// Erosion depth of every pixel in a mask + which way its ring faces.
// depth 0 = outermost ring. lit > 0 faces up/left (lit side), < 0 down/right.
function rings(w, h, mask, max = 12) {
  const N = w * h;
  const depth = new Int16Array(N).fill(-1);
  const lit = new Int8Array(N);
  let cur = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask(x, y)) cur[y * w + x] = 1;
  const at = (m, x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x];
  for (let k = 0; k < max; k++) {
    const nxt = new Uint8Array(N);
    let any = false;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!cur[i]) continue;
        const up = !at(cur, x, y - 1), dn = !at(cur, x, y + 1), lf = !at(cur, x - 1, y), rt = !at(cur, x + 1, y);
        if (up || dn || lf || rt) {
          depth[i] = k;
          lit[i] = up + lf - dn - rt;
          if (!lit[i] && (up || lf) && (dn || rt)) lit[i] = up && rt ? 0 : 0;
        } else {
          nxt[i] = 1;
          any = true;
        }
      }
    cur = nxt;
    if (!any) break;
  }
  for (let i = 0; i < N; i++) if (cur[i]) depth[i] = max;
  return { depth, lit, get: (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? depth[y * w + x] : -1), L: (x, y) => lit[y * w + x] };
}
// Paint a bevelled shape: pal(depth, lit, x, y) -> colour | null
function bevel(b, mask, pal, max) {
  const R = rings(b.w, b.h, mask, max);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const d = R.get(x, y);
      if (d < 0) continue;
      const c = pal(d, R.L(x, y), x, y);
      if (c) b.set(x, y, c);
    }
  return R;
}
// a soft drop shadow under everything already drawn
function dropShadow(b, dx = 0, dy = 1, a = 70) {
  const src = new Uint8Array(b.w * b.h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) src[y * b.w + x] = b.a(x, y) > 0 ? 1 : 0;
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++) {
      const sx = x - dx, sy = y - dy;
      if (!src[y * b.w + x] && sx >= 0 && sy >= 0 && sx < b.w && sy < b.h && src[sy * b.w + sx]) b.set(x, y, [34, 38, 40, a]);
    }
  return b;
}
const nail = (b, x, y, hi = '#bcc2d4', base = '#62687e', dk = '#262838') =>
  b.rows(x, y, ['ab', 'bc'], { a: hi, b: base, c: dk }).set(x + 2, y + 1, [20, 12, 8, 90]).set(x + 1, y + 2, [20, 12, 8, 90]);
// deterministic hash noise
const hn = (x, y, s = 0) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ---------------------------------------------------------------- palettes
// Hoot Hollow's "Moss & Moonlight" palette (src/gfx/palette.ts): oat paper, muted warm woods,
// mossy greens, honey and lamp-gold, berry, dusk blues, brass. Outlines are warm ink, never black.
const PAL = {
  parch: { ol2: '#6b5a45', ol: '#5a4733', hi: '#f6f1e2', base: '#eae0c8', base2: '#e4d9be', sh: '#dccfb0', sh2: '#c9b78d', fib: '#f2ebd8', fib2: '#d8cba9', fleck: '#c7b58e', stain: '#e0d2b2' },
  parchD: { ol2: '#625140', ol: '#4f3e2d', hi: '#eee5cf', base: '#dccfb0', base2: '#d5c7a6', sh: '#cdbd98', sh2: '#b5a27c', fib: '#e6dbc0', fib2: '#c8b892', fleck: '#b9a780', stain: '#d0c09d' },
  wood: { ol2: '#40352a', ol: '#2f261e', hi: '#d8bf98', lt: '#bf9d74', base: '#9c7a56', b2: '#a48160', sh: '#86684a', dk: '#6f553d', grain: '#8b6b4b', grain2: '#7a5d42', knot: '#4a392b', fill: '#6f553d', fillHi: '#7d6047' },
  woodD: { ol2: '#2f271f', ol: '#1f1a15', hi: '#9c7a56', lt: '#86684a', base: '#6f553d', b2: '#765b42', sh: '#5d4734', dk: '#4a392b', grain: '#624b37', grain2: '#56412f', knot: '#2f261e', fill: '#4a392b', fillHi: '#55422f' },
  green: { ol: '#33402f', hi: '#cfd3bb', lt: '#aab394', base: '#8a9776', sh: '#717e60', dk: '#556049', st: '#c9ceb3' },
  greenH: { ol: '#33402f', hi: '#dadecb', lt: '#b8c0a3', base: '#98a484', sh: '#7d8a6b', dk: '#5e6a51', st: '#d6dac4' },
  red: { ol: '#3e2d2b', hi: '#e3cdc4', lt: '#c4a29a', base: '#a9837b', sh: '#8d6b65', dk: '#6c514d', st: '#dcc4bb' },
  gold: { ol: '#4a3d2e', hi: '#f6eedb', lt: '#eadbb8', base: '#d9c49a', sh: '#bfa77b', dk: '#8e7a56', st: '#f4ead2' },
  grey: { ol: '#3f3c37', hi: '#d8d2c5', lt: '#bdb6a8', base: '#a39c8e', sh: '#857f73', dk: '#6a655c', st: '#c6c0b3' },
  brass: { ol: '#33291a', hi: '#f1d39a', lt: '#d6b876', base: '#c8a764', sh: '#a88a4e', dk: '#7b6538' },
  iron: { ol: '#23221f', hi: '#959189', lt: '#75726b', base: '#5c5a56', sh: '#4a4844', dk: '#383633' },
  night: { ol: '#1f252d', hi: '#bcc6c6', lt: '#97a4a8', base: '#6f7e84', sh: '#5a676e', dk: '#424d56', st: '#a9b5b7' },
  cream: { ol: '#5a4733', hi: '#fbf7ec', lt: '#f4eedd', base: '#eae0c8', sh: '#dccfb0', dk: '#c9b78d', st: '#bba98a' },
};
const SHADOW = [34, 38, 40]; // slate-ink drop shadow
// every frame colour goes through the same calm grade as the sprites (quiet, mostly neutral)
for (const P of Object.values(PAL)) for (const k of Object.keys(P)) P[k] = calm(P[k]);
for (const P of Object.values(PAL)) if (P.lt && P.base && !P.b2) { const a = rgb(P.base), c = rgb(P.lt); P.b2 = '#' + [0, 1, 2].map((i) => Math.round((a[i] + c[i]) / 2).toString(16).padStart(2, '0')).join(''); }
// hand-made ink: the outline wanders between two inks and now and then thickens by a pixel
const inkAt = (P, u, v, s = 0) => (hn(u, v, 40 + s) > 0.86 ? P.ol2 || P.ol : P.ol);
const thick = (u, v, s = 0) => hn(u >> 1, v >> 1, 50 + s) > 0.83;

// ---------------------------------------------------------------- texture helpers
// For frames shown with border-image-repeat: repeat, texture must tile: (u, v) are coordinates in
// the repeating lattice of the frame's middle (period mw x mh), so edges and middle tile seamlessly.
function lattice(spec) {
  const [t, r, bt, l] = spec.slice, mw = Math.max(1, spec.w - l - r), mh = Math.max(1, spec.h - t - bt);
  return (x, y) => [(((x - l) % mw) + mw) % mw, (((y - t) % mh) + mh) % mh, mw, mh];
}
// periodic 1D value noise (smooth), period p, lattice spacing ~s
function pnoise(u, p, s, seed) {
  const n = Math.max(1, Math.round(p / s)), step = p / n, f = u / step, i = Math.floor(f), t = f - i, e = t * t * (3 - 2 * t);
  const a = hn(((i % n) + n) % n, 7, seed), b = hn((((i + 1) % n) + n) % n, 7, seed);
  return a + (b - a) * e;
}
// a tile mask of paper fibres and flecks (wrapping), values: 0 none, 1 light fibre, 2 dark fibre, 3 fleck
function fibreMask(mw, mh, seed, density = 1) {
  const m = new Uint8Array(mw * mh);
  const put = (u, v, k) => { u = ((Math.round(u) % mw) + mw) % mw; v = ((Math.round(v) % mh) + mh) % mh; if (!m[v * mw + u]) m[v * mw + u] = k; };
  const nf = Math.max(2, Math.round((mw * mh) / 70 * density));
  for (let i = 0; i < nf; i++) {
    const u = hn(i, 1, seed) * mw, v = hn(i, 2, seed) * mh, a = (hn(i, 3, seed) - 0.5) * 1.4, len = 2 + Math.floor(hn(i, 4, seed) * 3), k = hn(i, 5, seed) < 0.55 ? 1 : 2;
    for (let j = 0; j < len; j++) put(u + Math.cos(a) * j, v + Math.sin(a) * j * 0.6, k);
  }
  const nk = Math.max(1, Math.round((mw * mh) / 160 * density));
  for (let i = 0; i < nk; i++) put(hn(i, 8, seed) * mw, hn(i, 9, seed) * mh, 3);
  return (u, v) => m[v * mw + u];
}
// a brass rivet: lit cap, dark rim, a tiny shadow
const rivet = (b, x, y, P = PAL.brass) =>
  b.rows(x, y, ['.ab.', 'abcd', 'bcdd', '.dd.'], { a: P.hi, b: P.lt, c: P.base, d: P.dk }).set(x + 1, y + 4, [...SHADOW, 90]).set(x + 2, y + 4, [...SHADOW, 90]).set(x + 4, y + 2, [...SHADOW, 70]);
const smallRivet = (b, x, y, P = PAL.brass) => b.rows(x, y, ['ab', 'bd'], { a: P.hi, b: P.base, d: P.dk }).set(x + 1, y + 2, [...SHADOW, 80]).set(x + 2, y + 1, [...SHADOW, 60]);

// ---------------------------------------------------------------- builders
const BUILD = {};
export const FRAMES = {};
function def(name, spec, build) {
  FRAMES[name] = { w: spec.w, h: spec.h, slice: spec.slice, fill: spec.fill !== false, repeat: spec.repeat || 'stretch', ...(spec.fixed ? { fixed: true } : {}) };
  BUILD[name] = () => build(new Buf(spec.w, spec.h), spec);
}

// parchment: oat paper with fibres, faint mottling and flecks that tile, a lit top/left lip, a
// shaded bottom/right, softly curled corners, a deckled outline and a tiny dog-ear.
function parchment(P, seed) {
  return (b, spec) => {
    const W = b.w, H = b.h, L = lattice(spec);
    const [, , mw, mh] = L(0, 0), fib = fibreMask(mw, mh, seed);
    bevel(b, rrMask(0, 0, W, H - 1, 2.2), (d, l, x, y) => {
      const [u, v] = L(x, y);
      if (d === 0) return inkAt(P, u, v, seed);
      if (d === 1 && thick(u, v, seed)) return P.ol2 || P.ol; // the pen pressed a little harder here
      if (d === 1) return l > 0 ? P.hi : l < 0 ? P.sh : P.base;
      if (d === 2 && l < 0) return P.sh;
      const f = fib(u, v);
      if (f === 1) return P.fib;
      if (f === 2) return P.fib2;
      if (f === 3) return P.fleck;
      return pnoise(u, mw, 8, seed) + pnoise(v, mh, 7, seed + 3) > 1.42 ? P.base2 : P.base;
    });
    // curled top-left and bottom-right corners, a dog-ear on the top-right
    b.rows(0, 0, ['..ooo.', '.ossho', 'oshhb.', 'oshb..', 'ohb...', '.o....'], { o: P.ol, s: P.sh2, h: P.hi, b: P.base });
    b.rows(W - 6, H - 7, ['....o.', '...bso', '..bsso', '.bss2o', 'osss2o', '.oooo.'], { o: P.ol, s: P.sh, 2: P.sh2, b: P.base });
    b.rows(W - 5, 1, ['oooo', '2sso', '.2so', '..2o'], { o: P.ol, s: P.sh, 2: P.sh2 });
    b.clear(W - 1, 0).clear(W - 2, 0);
    // deckled edge: a couple of nicks in the outline, only inside the (non-repeating) corners
    for (const [x, y] of [[4, 0], [0, 4], [W - 5, H - 2]]) b.set(x, y, P.sh2);
    b.clear(W - 1, H - 2).clear(W - 1, H - 7);
    b.hline(1, W - 3, H - 1, [...SHADOW, 70]);
    return b;
  };
}
def('parchment', { w: 36, h: 36, slice: [6, 6, 7, 6], repeat: 'repeat' }, parchment(PAL.parch, 3));
def('parchment_dark', { w: 36, h: 36, slice: [6, 6, 7, 6], repeat: 'repeat' }, parchment(PAL.parchD, 5));

// wood: a mitred frame of four planks with long tiling grain streaks, growth-ring flecks, a knot
// in each corner plank, lit and shaded bevels, brass rivets at the mitres, a recessed board.
function wood(P, seed) {
  return (b, spec) => {
    const W = b.w, H = b.h, T = 6, L = lattice(spec);
    const [, , mw, mh] = L(0, 0);
    bevel(b, rrMask(0, 0, W, H, 1.6), (d, l, x, y) => {
      if (d === 0) { const [u, v] = L(x, y); return inkAt(P, u, v, seed); }
      if (d === 1) { const [u, v] = L(x, y); return hn(u, v, seed + 9) > 0.9 ? P.hi : l > 0 ? P.lt : P.sh; } // worn, rubbed-pale edges
      if (d < T - 1) {
        // grain runs along each plank: rows across, streaks along (periodic so the edges tile)
        const horiz = Math.min(y, H - 1 - y) <= Math.min(x, W - 1 - x);
        const [u, v] = L(x, y);
        const along = horiz ? u : v, per = horiz ? mw : mh, row = d;
        const n = pnoise(along + row * 3.1, per, 6, seed + row * 13);
        const n2 = pnoise(along + 11, per, 3, seed + row * 7);
        if (d === T - 2 && l < 0) return n > 0.6 ? P.grain2 : P.sh; // shaded far edge of the plank
        if (n2 > 0.86) return P.grain2; // dark grain flecks
        if (n > 0.6) return P.grain;
        if (n < 0.3) return d === 2 ? P.lt : P.b2; // pale streaks, brightest on the lit rows
        return P.base;
      }
      if (d === T - 1) return P.ol;
      if (d === T) return l > 0 ? P.dk : P.fillHi;
      return P.fill;
    });
    // mitre joints
    for (let k = 1; k < T - 1; k++) b.set(k, k, P.dk).set(W - 1 - k, k, P.dk).set(k, H - 1 - k, P.dk).set(W - 1 - k, H - 1 - k, P.dk);
    // brass rivets on the corners
    for (const [x, y] of [[1, 1], [W - 5, 1], [1, H - 5], [W - 5, H - 5]]) rivet(b, x, y);
    return b;
  };
}
def('wood', { w: 48, h: 48, slice: [7, 7, 7, 7], repeat: 'repeat' }, wood(PAL.wood, 11));
def('wood_dark', { w: 48, h: 48, slice: [7, 7, 7, 7], repeat: 'repeat' }, wood(PAL.woodD, 17));

// a cloth ribbon banner with stitched edges and folded, notched tails
function ribbon(P) {
  return (b) => {
    const W = b.w, H = b.h, TW = 9;
    for (const side of [0, 1]) {
      const tb = new Buf(TW + 2, H - 3);
      const m = (x, y) => {
        if (y < 0 || y >= tb.h || x < 0 || x >= tb.w) return false;
        const mid = (tb.h - 1) / 2, notch = 3 - Math.round(Math.abs(y - mid) * 0.9);
        return x >= Math.max(0, notch);
      };
      bevel(tb, m, (d, l, x, y) => (d === 0 ? P.ol : d === 1 && l > 0 ? P.base : (x + y) % 5 === 0 ? P.dk : P.sh));
      for (let y = 0; y < tb.h; y++)
        for (let x = 0; x < tb.w; x++) {
          const i = (y * tb.w + x) * 4;
          if (!tb.d[i + 3]) continue;
          b.set(side ? W - 1 - x : x, y + 3, [tb.d[i], tb.d[i + 1], tb.d[i + 2]]);
        }
    }
    bevel(b, rrMask(5, 0, W - 10, H - 3, 1), (d, l, x, y) => {
      if (d === 0) return P.ol;
      if (y === 1) return P.lt;
      if (y === 2) return x % 2 ? P.hi : P.lt; // stitching along the top
      if (y === H - 5) return x % 2 ? P.dk : P.sh; // stitching along the bottom
      if (y >= H - 6) return P.sh;
      return (x * 5 + y * 3) % 23 === 0 && y > 3 && y < H - 7 ? P.lt : P.base; // a faint weave
    });
    b.rows(5, H - 4, ['oo', 'do', '.o'], { o: P.ol, d: P.dk });
    b.rows(W - 7, H - 4, ['oo', 'od', 'o.'], { o: P.ol, d: P.dk });
    return b;
  };
}
def('ribbon_green', { w: 40, h: 17, slice: [4, 11, 6, 11], repeat: 'repeat stretch' }, ribbon(PAL.green));
def('ribbon_red', { w: 40, h: 17, slice: [4, 11, 6, 11], repeat: 'repeat stretch' }, ribbon(PAL.red));

// buttons are stitched cloth patches on a thick felt lip: a faint linen weave, a running stitch
// just inside the edge, a lit top fold, stepped corners. They tile, so the stitches stay crisp.
function button(P, down = false) {
  return (b) => {
    const W = b.w, H = b.h, top = down ? 2 : 0, lip = down ? 0 : 2;
    const bodyH = H - top - lip;
    if (lip) bevel(b, rrMask(0, top + 2, W, bodyH, 3), (d, l, x, y) => (d === 0 ? P.ol : y === H - 2 && x % 3 === 1 ? P.sh : P.dk));
    bevel(b, rrMask(0, top, W, bodyH, 3), (d, l, x, y) => {
      if (d === 0) return P.ol;
      const yy = y - top;
      if (d === 1 && l < 0 && yy > 2) return P.sh;
      if (yy === 1) return P.hi;
      if (yy === 2) return P.lt;
      if (yy === bodyH - 3) return P.sh;
      // running stitch, 3 px in from the edge (period 3 along the top and bottom, 5 down the sides)
      if (d === 3 && P.st && !down) {
        const horiz = yy === 3 || yy === bodyH - 4;
        if (horiz ? x % 3 !== 0 : (y % 5) < 3) return P.st;
      }
      const wx = x % 6, wy = y % 5;
      return (wx === 1 && wy === 1) || (wx === 4 && wy === 3) ? P.b2 || P.lt : P.base; // two linen slubs per tile (tile-periodic)
    });
    if (down) b.hline(2, W - 3, top + 1, P.sh).hline(3, W - 4, top + 2, P.base);
    else b.set(2, 2, P.hi).set(3, 1, P.hi).set(2, 3, P.hi);
    return b;
  };
}
const BTN = { w: 16, h: 16, slice: [5, 5, 6, 5], repeat: 'repeat' };
def('button_green', BTN, button(PAL.green));
def('button_green_hover', BTN, button(PAL.greenH));
def('button_green_down', BTN, button(PAL.green, true));
def('button_red', BTN, button(PAL.red));
def('button_gold', BTN, button(PAL.gold));
def('button_disabled', BTN, button(PAL.grey));
def('button_night', BTN, button(PAL.night));
def('button_night_down', BTN, button(PAL.night, true));
def('button_gold_down', BTN, button(PAL.gold, true));
def('button_red_down', BTN, button(PAL.red, true));
def('button_cream', BTN, button(PAL.cream));
def('button_cream_down', BTN, button(PAL.cream, true));

// brass icon slot: engraved leaf scrolls at the corners, rivets, a recessed walnut field with grain
const FILIGREE = [
  '..kkk...',
  '.kGGGk..',
  'kGkkGGk.',
  'kGkLkGk.',
  'kGGkGk..',
  '.kGGk...',
  '..kk....',
  '........',
];
function goldSlot(active) {
  return (b) => {
    const W = b.w, H = b.h, G = PAL.brass, Wd = PAL.woodD;
    bevel(b, rrMask(0, 0, W, H, 3.2), (d, l, x, y) => {
      if (d === 0) return active ? '#f8ecd2' : G.ol;
      if (d === 1) return l > 0 ? G.hi : l < 0 ? G.sh : G.lt;
      if (d === 2) return l > 0 ? G.lt : l < 0 ? G.dk : G.base;
      if (d === 3) return l < 0 ? G.sh : (x + y) % 4 === 0 ? G.lt : G.base;
      if (d === 4) return G.ol;
      if (d === 5) return active ? (l > 0 ? '#9c7a56' : '#bf9d74') : l > 0 ? Wd.ol : Wd.fillHi;
      return active ? '#9c7a56' : Wd.fill;
    });
    b.corners(FILIGREE, { k: G.ol, G: active ? G.hi : G.lt, L: '#8aa56d' }, 1);
    if (active) {
      for (let x = 6; x < W - 6; x++) { b.set(x, 5, [241, 211, 154, 170]); b.set(x, H - 6, [241, 211, 154, 90]); }
      for (let y = 6; y < H - 6; y++) { b.set(5, y, [241, 211, 154, 170]); b.set(W - 6, y, [241, 211, 154, 90]); }
    }
    return b;
  };
}
def('slot_gold', { w: 26, h: 26, slice: [9, 9, 9, 9] }, goldSlot(false));
def('slot_gold_active', { w: 26, h: 26, slice: [9, 9, 9, 9] }, goldSlot(true));

// brass skill-node frame: clipped corners, rivets, a dark recessed field
function octMask(W, H, c) {
  return (x, y) => x >= 0 && y >= 0 && x < W && y < H && x + y >= c && W - 1 - x + y >= c && x + H - 1 - y >= c && W - 1 - x + H - 1 - y >= c;
}
def('slot_brass', { w: 24, h: 24, slice: [8, 8, 8, 8] }, (b) => {
  const P = PAL.brass;
  bevel(b, octMask(24, 24, 4), (d, l, x, y) => {
    if (d === 0) return P.ol;
    if (d === 1) return l > 0 ? P.hi : l < 0 ? P.sh : P.lt;
    if (d === 2) return l > 0 ? P.lt : l < 0 ? P.dk : P.base;
    if (d === 3) return l < 0 ? P.sh : (x + y) % 5 === 0 ? P.lt : P.base;
    if (d === 4) return P.ol;
    if (d === 5) return l > 0 ? '#1f1a15' : '#4a392b';
    return '#3a2f25';
  });
  for (const [x, y] of [[4, 2], [18, 2], [2, 4], [20, 4], [2, 18], [20, 18], [4, 20], [18, 20]]) smallRivet(b, x, y);
  return b;
});

// locked node: a dark iron plate wrapped in chain
def('slot_locked', { w: 24, h: 24, slice: [9, 9, 9, 9], repeat: 'round' }, (b) => {
  const P = PAL.iron;
  bevel(b, octMask(24, 24, 4), (d, l, x, y) => {
    if (d === 0) return P.ol;
    if (d === 1) return l > 0 ? P.lt : P.dk;
    if (d < 5) return d === 4 && l < 0 ? P.sh : hn(x, y, 2) > 0.85 ? P.sh : P.base;
    if (d === 5) return P.ol;
    return '#2a2926';
  });
  const L = { o: '#a39c8e', d: '#6a655c', h: '#d8d2c5' };
  for (let x = 0; x < 24; x += 6) {
    b.rows(x, 1, ['.ho...', 'o..odd', '.dd...'], L);
    b.rows(x, 20, ['.ho...', 'o..odd', '.dd...'], L);
  }
  for (let y = 0; y < 24; y += 6) {
    b.rows(1, y, ['.h.', 'o.d', 'o.d', '.d.', '.d.', '.d.'], L);
    b.rows(20, y, ['.h.', 'o.d', 'o.d', '.d.', '.d.', '.d.'], L);
  }
  return b;
});

// a round (pixel-stepped) wooden level medallion: turned rim, growth rings, brass pins
def('medallion', { w: 30, h: 30, slice: [0, 0, 0, 0], fixed: true }, (b) => {
  const P = PAL.wood;
  const disc = (r) => (x, y) => Math.hypot(x + 0.5 - 15, y + 0.5 - 14.5) <= r;
  bevel(b, disc(14), (d, l, x, y) => {
    if (d === 0) return P.ol;
    if (d <= 3) {
      const lit = (x + 0.5 - 15) * -0.6 + (y + 0.5 - 14.5) * -0.8;
      return lit > 6 ? P.hi : lit > 1 ? P.lt : lit > -6 ? P.base : P.sh;
    }
    if (d === 4) return P.ol;
    const r = Math.hypot(x + 0.5 - 15, y + 0.5 - 14.5);
    const lit = ((x + 0.5 - 15) * -0.6 + (y + 0.5 - 14.5) * -0.8) / 9;
    if (d === 5) return lit > 0.2 ? P.knot : P.lt;
    return Math.round(r + hn(x, y, 3) * 0.6) % 3 === 0 ? P.grain : lit > 0.3 ? P.b2 : P.base;
  });
  for (const [x, y] of [[14, 2], [14, 25], [2, 13], [26, 13]]) smallRivet(b, x, y);
  dropShadow(b, 0, 1, 80);
  return b;
});

// dark wood tooltip with brass corner studs
def('tooltip', { w: 16, h: 16, slice: [5, 5, 5, 5] }, (b) => {
  const P = PAL.woodD;
  bevel(b, rrMask(0, 0, 16, 16, 2), (d, l) => (d === 0 ? P.ol : d === 1 ? (l > 0 ? P.hi : P.dk) : P.fill));
  b.corners(['...', '.y.', '...'], { y: PAL.brass.lt }, 1);
  return b;
});

// speech bubble: oat paper, a 2px warm-ink outline, a linen shade along the bottom and right
def('bubble_bw', { w: 20, h: 20, slice: [7, 7, 7, 7] }, (b) => {
  bevel(b, rrMask(0, 0, 20, 20, 6), (d, l) => (d <= 1 ? '#2e2b24' : d === 2 && l < 0 ? '#e9dfc6' : '#f6f1e2'));
  b.set(4, 3, '#ffffff').set(5, 3, '#fbf7ec');
  return b;
});
def('bubble_tail', { w: 12, h: 9, slice: [0, 0, 0, 0], fixed: true }, (b) =>
  b.rows(0, 0, [
    'KKwwwwwwwKK.',
    '.KKwwwwsKK..',
    '..KKwwsKK...',
    '...KwwsK....',
    '...KwsK.....',
    '..KwsKK.....',
    '..KwKK......',
    '.KKK........',
    '.K..........',
  ], { K: '#2e2b24', w: '#f6f1e2', s: '#e9dfc6' }),
);

// thought (cloud) bubble: scalloped edge, period 6 so it tiles
def('bubble_think', { w: 32, h: 32, slice: [12, 12, 12, 12], repeat: 'round' }, (b) => {
  const W = 32, H = 32, e = 5.5, r = 4.6;
  const lobes = [[e + 0.8, e + 0.8], [W - e - 0.8, e + 0.8], [e + 0.8, H - e - 0.8], [W - e - 0.8, H - e - 0.8]];
  for (const t of [8, 16, 24]) lobes.push([t, e], [t, H - e], [e, t], [W - e, t]);
  const inner = (x, y) => x >= 6 && y >= 6 && x < W - 6 && y < H - 6;
  const m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (inner(x, y) || lobes.some(([cx, cy]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r));
  bevel(b, m, (d, l) => (d <= 1 ? '#2e2b24' : d === 2 && l < 0 ? '#e9dfc6' : '#f6f1e2'));
  return b;
});
def('think_tail', { w: 10, h: 10, slice: [0, 0, 0, 0], fixed: true }, (b) => {
  b.rows(0, 0, ['..KKKK....', '.KwwwwK...', '.KwwssK...', '..KKKK....', '..........', '....KKK...', '...KwwsK..', '....KKK...', '.......KK.', '.......KK.'], { K: '#2e2b24', w: '#f6f1e2', s: '#e9dfc6' });
  return b;
});

// oat ledger paper: a berry margin, faint dusk rules every 4px, a punched hole, fibres
def('paper_ledger', { w: 26, h: 24, slice: [6, 4, 6, 12], repeat: 'repeat' }, (b, spec) => {
  const W = 26, H = 24, L = lattice(spec), [, , mw, mh] = L(0, 0), fib = fibreMask(mw, mh, 9, 0.7);
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const [u, v] = L(x, y), f = fib(u, v);
    b.set(x, y, f === 1 ? '#f8f3e6' : f === 2 ? '#e6dcc4' : f === 3 ? '#d8cba9' : '#f3ecdb');
  }
  b.hline(0, W - 2, 0, '#fbf7ec');
  for (let y = 6; y < H - 6; y++) if ((y - 6) % 4 === 3) for (let x = 0; x < W - 1; x++) b.set(x, y, x % 7 === 3 ? '#c5d0cc' : '#b6c6c6');
  b.vline(9, 0, H - 2, '#c98a82');
  b.vline(10, 0, H - 2, '#e3c2b6');
  b.rows(2, 9, ['.oo.', 'oxxo', 'oxxo', '.oo.'], { o: '#c9b78d', x: '#8a7a62' });
  for (let x = 0; x < W - 1; x++) b.set(x, H - 1, '#c9b78d');
  for (let y = 0; y < H; y++) b.set(W - 1, y, '#c9b78d');
  b.vline(0, 0, H - 2, '#e6dcc4');
  return b;
});

// a pale honey sticky note with a translucent tape strip and a lifted corner
def('sticky_note', { w: 20, h: 20, slice: [6, 6, 6, 6] }, (b) => {
  const W = 20, H = 20;
  b.rect(0, 0, W - 1, H - 1, '#f2e2b4');
  for (let y = 5; y < H - 1; y++) for (let x = 0; x < W - 1; x++) if (hn(x, y, 6) > 0.93) b.set(x, y, '#ead7a4');
  b.rect(0, 0, W - 1, 4, '#e8d29a');
  b.hline(0, W - 2, 4, '#dcc387');
  b.hline(0, W - 2, 0, '#f8ecc8');
  for (let y = 5; y < H - 1; y++) b.set(W - 2, y, '#e6d29e');
  b.rows(W - 6, H - 6, ['....s.', '...ss.', '..sfs.', '.sffs.', 'sssss.', '......'], { s: '#c9ad6c', f: '#f8efd6' });
  for (let k = 0; k < 6; k++) b.clear(W - 1 - k, H - 1 - (5 - k));
  for (let y = H - 6; y < H; y++) for (let x = W - 6; x < W; x++) if (x + y > W + H - 8) b.clear(x, y);
  b.hline(1, W - 7, H - 1, [...SHADOW, 70]);
  b.vline(W - 1, 1, H - 7, [...SHADOW, 70]);
  return b;
});

// iron CRT bezel, a deep night screen, a power lamp and vent grille
def('crt', { w: 34, h: 30, slice: [8, 8, 11, 8] }, (b) => {
  const W = 34, H = 30, I = PAL.iron;
  bevel(b, rrMask(0, 0, W, H, 4), (d, l, x, y) => {
    if (d === 0) return I.ol;
    if (d === 1) return l > 0 ? I.hi : I.dk;
    return hn(x, y, 5) > 0.9 ? I.sh : I.base;
  });
  const scr = rrMask(5, 5, W - 10, H - 13, 4.5);
  bevel(b, scr, (d, l) => {
    if (d === 0) return l > 0 ? I.dk : I.lt;
    if (d === 1) return '#141a20';
    return '#1d2b2a';
  });
  b.set(8, 7, [211, 224, 220, 70]).set(7, 8, [211, 224, 220, 70]).set(9, 7, [211, 224, 220, 40]);
  for (let x = 6; x < 14; x += 2) b.vline(x, H - 6, H - 4, I.dk);
  b.rows(W - 9, H - 6, ['gG', 'gg'], { g: '#557343', G: '#c4cfa3' });
  b.rows(W - 6, H - 6, ['.k', 'kk'], { k: I.dk });
  return b;
});

// inset text field: oat paper pressed into the board
def('input', { w: 16, h: 16, slice: [5, 5, 5, 5] }, (b) => {
  bevel(b, rrMask(0, 0, 16, 16, 2), (d, l) => {
    if (d === 0) return '#5a4733';
    if (d === 1) return l > 0 ? '#c9b78d' : '#fbf7ec';
    if (d === 2 && l > 0) return '#dccfb0';
    return '#f6f1e2';
  });
  return b;
});

// folder tabs (open at the bottom)
function tab(active) {
  return (b) => {
    const W = 20, H = 16, top = active ? 0 : 2, P = active ? PAL.parch : PAL.parchD;
    bevel(b, rrMask(0, top, W, H - top + 3, 3), (d, l, x, y) => {
      if (y >= H) return null;
      if (d === 0) return P.ol;
      if (d === 1) return l > 0 ? P.hi : P.sh;
      return hn(x, y, active ? 3 : 4) > 0.92 ? P.fib2 : P.base;
    });
    if (!active) b.hline(0, W - 1, H - 1, PAL.parch.ol);
    else b.set(0, H - 1, P.ol).set(W - 1, H - 1, P.ol);
    return b;
  };
}
def('tab', { w: 20, h: 16, slice: [6, 6, 3, 6] }, tab(false));
def('tab_active', { w: 20, h: 16, slice: [6, 6, 3, 6] }, tab(true));

// progress bars: a dark walnut groove, fills with a lit top and shaded bottom
def('bar_track', { w: 12, h: 10, slice: [4, 4, 4, 4] }, (b) => {
  const P = PAL.woodD;
  bevel(b, rrMask(0, 0, 12, 10, 2), (d, l) => (d === 0 ? P.dk : d === 1 ? (l > 0 ? P.ol : P.lt) : P.fill));
  return b;
});
function barFill(P) {
  return (b) => {
    bevel(b, rrMask(0, 0, 8, 8, 1.6), (d, l, x, y) => {
      if (d === 0) return P.ol;
      if (y === 1) return P.lt;
      if (y === 6) return P.sh;
      return P.base;
    });
    b.set(1, 1, P.hi);
    return b;
  };
}
def('bar_fill_green', { w: 8, h: 8, slice: [3, 3, 3, 3] }, barFill(PAL.green));
def('bar_fill_red', { w: 8, h: 8, slice: [3, 3, 3, 3] }, barFill(PAL.red));
def('bar_fill_gold', { w: 8, h: 8, slice: [3, 3, 3, 3] }, barFill(PAL.gold));

// small paper pill for tags and labels
def('chip', { w: 12, h: 10, slice: [4, 5, 4, 5] }, (b) => {
  bevel(b, rrMask(0, 0, 12, 9, 4.5), (d, l, x, y) => (d === 0 ? '#5a4733' : d === 1 ? (l > 0 ? '#fbf7ec' : '#dccfb0') : (y === 2 || y === 6) && x % 2 ? '#e3d8c0' : '#f3ecdb'));
  b.hline(2, 9, 9, [...SHADOW, 60]);
  return b;
});

// small wooden HUD plaque with brass pins
def('plaque', { w: 24, h: 16, slice: [5, 8, 6, 8] }, (b) => {
  const P = PAL.wood;
  bevel(b, rrMask(0, 0, 24, 15, 2.5), (d, l, x, y) => {
    if (d === 0) return P.ol;
    if (d === 1) return l > 0 ? P.hi : P.sh;
    if (d === 2) return l > 0 ? P.lt : P.base;
    return y % 4 === 1 ? P.grain : hn(x >> 2, y, 3) > 0.8 ? P.b2 : P.base;
  });
  smallRivet(b, 2, 6);
  smallRivet(b, 20, 6);
  b.hline(1, 22, 15, [...SHADOW, 80]);
  return b;
});

// ---------------------------------------------------------------- API
const canvasCache = new Map();
const urlCache = new Map();
const normScale = (s) => Math.max(1, Math.round(+s || 1));
function getFrame(name) {
  const f = FRAMES[name];
  if (!f) throw new Error(`unknown frame '${name}'`);
  return f;
}

export function frameCanvas(name, scale = 2) {
  scale = normScale(scale);
  const key = name + '@' + scale;
  const hit = canvasCache.get(key);
  if (hit) return hit;
  const f = getFrame(name);
  let cv;
  if (scale === 1) {
    const b = BUILD[name]();
    cv = document.createElement('canvas');
    cv.width = f.w;
    cv.height = f.h;
    cv.getContext('2d', { willReadFrequently: true }).putImageData(new ImageData(b.d, f.w, f.h), 0, 0);
  } else {
    const base = frameCanvas(name, 1);
    cv = document.createElement('canvas');
    cv.width = f.w * scale;
    cv.height = f.h * scale;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, cv.width, cv.height);
  }
  canvasCache.set(key, cv);
  return cv;
}

export function frameURL(name, scale = 2) {
  scale = normScale(scale);
  const key = name + '@' + scale;
  let u = urlCache.get(key);
  if (!u) {
    u = frameCanvas(name, scale).toDataURL('image/png');
    urlCache.set(key, u);
  }
  return u;
}

// [v28 crisp] device px per CSS px when the screen ratio is a whole number (iPad / iPhone 2x-3x).
// The frame image is painted at device resolution and shown 1:1, so the browser never resamples
// it: iPad Safari smooths scaled border-images (image-rendering is ignored there), which made the
// gold tool slots and every other frame look smeared / stretched.
const devK = () => {
  const r = (typeof window !== 'undefined' && window.devicePixelRatio) || 1, k = Math.round(r);
  return k >= 2 && k <= 4 && Math.abs(r - k) < 0.01 ? k : 1;
};

export function frameStyle(name, scale = 2) {
  scale = normScale(scale);
  const f = getFrame(name);
  const k = devK(); // [v28 crisp]
  const url = frameURL(name, scale * k);
  if (f.fixed) {
    return `width:${f.w * scale}px;height:${f.h * scale}px;background:url("${url}") no-repeat 0 0/100% 100%;image-rendering:pixelated`;
  }
  const [t, r, b, l] = f.slice.map((v) => v * scale);
  const [st, sr, sb, sl] = f.slice.map((v) => v * scale * k); // [v28 crisp] slice in source (device) px
  return [
    'border-style:solid',
    `border-width:${t}px ${r}px ${b}px ${l}px`,
    `border-image-source:url("${url}")`,
    `border-image-slice:${st} ${sr} ${sb} ${sl}${f.fill ? ' fill' : ''}`,
    `border-image-width:${t}px ${r}px ${b}px ${l}px`,
    `border-image-repeat:${f.repeat}`,
    'image-rendering:pixelated',
  ].join(';');
}

let injected = false;
export function injectFrameCSS() {
  if (injected || typeof document === 'undefined') return;
  if (document.getElementById('tbme-frames')) { injected = true; return; }
  let css = '';
  for (const name of Object.keys(FRAMES)) {
    const f = FRAMES[name];
    const extra = f.fill && !f.fixed ? ';background:none' : '';
    css += `.f-${name}{${frameStyle(name, 2)}${extra}}\n.f3-${name}{${frameStyle(name, 3)}${extra}}\n`;
  }
  const st = document.createElement('style');
  st.id = 'tbme-frames';
  st.textContent = css;
  document.head.appendChild(st);
  injected = true;
}
