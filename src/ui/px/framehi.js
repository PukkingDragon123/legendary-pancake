// High-resolution material frames for the interface, in the manner of BUSHED's UI: each frame keeps its
// chunky art-pixel structure (a hand-inked outline, bevels, stitches and rivets measured in art pixels) but its
// surfaces are painted with real materials at a finer texel grid: worn table boards and herringbone wool
// sampled from BUSHED's photo-derived pixel textures, BUSHED-style oat paper with fibres, mottling and foxing,
// duck canvas, brown leather and brushed brass. Hard pixels only: nothing smooth, no gradients.
//
//   HI[name] = (res) => { w, h, d }   paints the frame at `res` texels per art pixel. The middle of each frame
//   is a whole texture period, so frames.js can show them with border-image-repeat: repeat and never smear.
// OWNED BY THE UI BUILDER (ui3).
import { brassAt, bayer, hash, mixRGB, mulRGB, onRamp, paperAt, PAPER, PAPER_DARK, pnoise, ramp, rampAt, woodPx } from './materials.js';
import { calmRGB } from './calm.js';

const C = (h) => calmRGB([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
const SHADOW = [34, 38, 40];

class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8ClampedArray(w * h * 4); }
  set(x, y, c, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || !c) return this;
    const i = (y * this.w + x) * 4, al = c.length > 3 ? c[3] : a;
    if (al >= 255 || !this.d[i + 3]) { this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = al; return this; }
    const t = al / 255;
    this.d[i] += (c[0] - this.d[i]) * t; this.d[i + 1] += (c[1] - this.d[i + 1]) * t; this.d[i + 2] += (c[2] - this.d[i + 2]) * t;
    this.d[i + 3] = Math.max(this.d[i + 3], al);
    return this;
  }
  get(x, y) { const i = (y * this.w + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
}

/** depth of an art-space point inside a rounded rectangle (art px), -1 outside; and which side it faces */
function rr(ax, ay, w, h, r) {
  if (ax < 0 || ay < 0 || ax > w || ay > h) return [-1, 0, 0];
  const inX = ax < r ? r - ax : ax > w - r ? ax - (w - r) : 0, inY = ay < r ? r - ay : ay > h - r ? ay - (h - r) : 0;
  if (inX > 0 && inY > 0) {
    const d = r - Math.hypot(inX, inY);
    const lit = (ax < w / 2 ? 1 : -1) + (ay < h / 2 ? 1 : -1);
    return [d, lit > 0 ? 1 : lit < 0 ? -1 : 0, inX > inY ? 0 : 1];
  }
  const dt = ay, db = h - ay, dl = ax, dr = w - ax, m = Math.min(dt, db, dl, dr);
  return [m, m === dt || m === dl ? 1 : -1, m === dt || m === db ? 1 : 0];
}

/**
 * The frame driver: walks every texel, works out its art-space depth from the rim, which way it faces, and its
 * coordinates in the repeating lattice (u, v; period M texels), and asks `shade` for a colour.
 */
function frame(spec, shade, deco) {
  return (res) => {
    const [t, r, bt, l] = spec.slice;
    const M = (spec.mid ?? 48) * res;
    const W = (l + r) * res + M, H = (t + bt) * res + M;
    const b = new Buf(W, H), Wa = W / res, Ha = H / res, lip = spec.lip ?? 0;
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const ax = (tx + 0.5) / res, ay = (ty + 0.5) / res;
      const [d, lit, horiz] = rr(ax, ay, Wa, Ha - lip, spec.r ?? 2);
      const u = (((tx - l * res) % M) + M) % M, v = (((ty - t * res) % M) + M) % M;
      const c = shade({ tx, ty, ax, ay, d, lit, horiz, u, v, M, res, Wa, Ha, along: horiz ? u : v });
      if (c) b.set(tx, ty, c);
    }
    deco?.(b, { res, Wa, Ha, M, W, H });
    return b;
  };
}
/** a hand-inked rim: the line's width wanders a little along the edge (periodic, so it tiles) */
const inkW = (along, M, s = 0) => 1 + (pnoise((along / M) * 8, s, 8, 64, 71) - 0.5) * 0.7;
/** stamp a disc in art space (stepped at texel resolution) */
function disc(b, res, cx, cy, rad, fn) {
  for (let y = Math.floor((cy - rad) * res); y <= Math.ceil((cy + rad) * res); y++) for (let x = Math.floor((cx - rad) * res); x <= Math.ceil((cx + rad) * res); x++) {
    const dx = (x + 0.5) / res - cx, dy = (y + 0.5) / res - cy, q = Math.hypot(dx, dy) / rad;
    if (q <= 1) b.set(x, y, fn(dx, dy, q, x, y));
  }
}
/** a domed brass rivet with a lit cap, a dark rim and a little cast shadow */
function rivet(b, res, cx, cy, rad = 1.25) {
  disc(b, res, cx + 0.35, cy + 0.45, rad, () => [...SHADOW, 110]);
  disc(b, res, cx, cy, rad, (dx, dy, q, x, y) => (q > 0.82 ? C('#3a2e1c') : brassAt(x, y, 0.55 + (-dx - dy) / rad * 0.38 + (q < 0.35 && dx < 0 && dy < 0 ? 0.3 : 0))));
}

// ---------------------------------------------------------------- palettes (graded once)
// [ui4] v4: honey walnut, deep walnut, oxblood leather wells; warm ink outlines
const WOOD = ramp('#3a1d0e', '#55290f', '#6e3818', '#874a22', '#a05e2d', '#b8763c', '#cc8f50', '#dea866');
const WOODD = ramp('#1c0d06', '#2b140a', '#3c1d0f', '#4e2715', '#61321c', '#753f24', '#8a4e2e', '#9e5f3a');
const INK = C('#2a160c'), INK2 = C('#4a2c18'), INKW = C('#1a0c06'), INKP = C('#5a3a20');
const LEATHER = ramp('#1d0608', '#2e0a0f', '#421016', '#58161e', '#6e1e27', '#842a31', '#9a383c');

export const HI = {};


// ---------------------------------------------------------------- wood: mitred frame of worn table boards
function wood(R, dark) {
  const T = 6;
  return frame({ slice: [7, 7, 7, 7], mid: 96, r: 1.6 }, (p) => {
    const { d, lit, horiz, u, v, M, res, ax, ay, Wa, Ha, along } = p;
    if (d < 1) return hash(p.tx, p.ty, 9) > 0.92 ? INK2 : dark ? INKW : INK;
    if (d < T - 1) {
      // the plank: sampled across its width from the board texture, a lit outer arris, a cavity at the inner edge
      const across = Math.floor((d - 1) * res) + (horiz ? (ay < Ha / 2 ? 0 : 40) : ax < Wa / 2 ? 70 : 100);
      const k = (d - 1) / (T - 2);
      let lift = k < 0.2 ? (lit > 0 ? 0.3 : 0.08) : k > 0.82 ? -0.22 : 0;
      // mitre joints in the corners and butt joints where the texture wraps
      const cx = Math.min(ax, Wa - ax), cy = Math.min(ay, Ha - ay);
      if (cx < T && cy < T && Math.abs(cx - cy) < 0.55 / res + 0.05) return mixRGB(R[1], INK, 0.3);
      if (along % M === 0 || along % 256 === 0) return R[1];
      if (hash(along >> 2, Math.floor(d * res), 5) > 0.985) lift += 0.18; // a pale scratch
      return woodPx(horiz ? along + 17 : along + 131, across, lift, dark);
    }
    if (d < T) return dark ? INKW : INK;
    if (d < T + 1) return lit > 0 ? mulRGB(R[1], 0.8) : R[3];
    return woodPx(u + 60, v + 9, -0.25, dark);
  }, (b, { res, Wa, Ha }) => {
    for (const [x, y] of [[3.2, 3.2], [Wa - 3.2, 3.2], [3.2, Ha - 3.2], [Wa - 3.2, Ha - 3.2]]) rivet(b, res, x, y, 1.3);
  });
}
HI.wood = wood(WOOD, false);
HI.wood_dark = wood(WOODD, true);

// ---------------------------------------------------------------- parchment: oat paper with aged edges
function parchment(R, seed) {
  return frame({ slice: [6, 6, 7, 6], mid: 64, r: 2.2, lip: 1 }, (p) => {
    const { d, lit, u, v, M, ax, ay, Wa, along } = p;
    // a dog-eared top-right corner
    const q = (Wa - ax) + ay;
    if (q < 3.4) return null;
    if (q < 3.4 + 1 / p.res + 0.4) return INKP;
    if (d < 0) return null;
    if (d < inkW(along, M, seed)) return hash(p.tx, p.ty, seed) > 0.88 ? mixRGB(INKP, R[2], 0.4) : INKP;
    if (Wa - ax < 4.6 && ay < 4.6 && q < 6.2) return rampAt(R, 0.42 + (q - 3.4) * 0.05, p.tx, p.ty); // the folded flap
    const age = d < 4 ? (1 - d / 4) * 0.55 : 0;
    const c = paperAt(u, v, M, M, { ramp: R, seed, age, base: d < 2 && lit > 0 ? 0.7 : 0.62 });
    return d < 2 && lit < 0 ? mulRGB(c, 0.93) : c;
  }, (b, { W, H }) => {
    // a soft one-texel shadow under the sheet (it lifts off the board)
    for (let x = 2; x < W - 4; x++) { const y = H - 1; if (!b.get(x, y)[3]) b.set(x, y, [...SHADOW, 70]); }
  });
}
HI.parchment = parchment(PAPER, 3);
HI.parchment_dark = parchment(PAPER_DARK, 5);

// ---------------------------------------------------------------- buttons: stitched cloth on a felt lip
function cloth(R, down = false, stitchHex = null) {
  const ST = stitchHex ? C(stitchHex) : null;
  return frame({ slice: [5, 5, 6, 5], mid: 24, r: 3, lip: 0 }, (p) => {
    const { res, ax, ay, Wa, Ha, u, v, M } = p;
    const top = down ? 2 : 0, lipH = down ? 0 : 2;
    // body and lip are two rounded rects: the lip (felt underside) peeks out 2 art px below
    const [db, litb, horiz] = rr(ax, ay - top, Wa, Ha - top - lipH, 3);
    if (db < 0) {
      const [dl] = rr(ax, ay - top - 2, Wa, Ha - top - lipH, 3);
      if (lipH && dl >= 0) return dl < 1 ? INK : onRamp('wool', R, u, v, 0.14, 0.7);
      return null;
    }
    const along = horiz ? u : v;
    if (db < 1) return INK;
    const yy = ay - top, bodyH = Ha - top - lipH;
    if (yy < 2.2) return onRamp('canvas', R, u, v, 0.8, 0.8); // the lit top fold
    if (yy > bodyH - 2) return onRamp('canvas', R, u, v, 0.32, 0.8); // the shaded underside
    // running stitch 2.5 art px in from the rim
    if (ST && !down && db > 2.2 && db < 2.2 + 0.75) {
      const t = horiz ? u : v;
      if (t % (2 * res) < Math.max(1, Math.round(res * 1.2))) return ST;
      if (litb > 0 && t % (2 * res) === Math.round(res * 1.2)) return mulRGB(R[2], 0.85);
    }
    return onRamp('canvas', R, u + 31, v + 7, 0.56, 0.9);
  });
}
const BTN = {
  green: ramp('#0e3220', '#15452b', '#1d5a37', '#287045', '#358755', '#4a9e68', '#68b882'),
  greenH: ramp('#123a26', '#1a4f32', '#236640', '#2f7d4e', '#3d9660', '#55ae74', '#76c690'),
  red: ramp('#4a0f16', '#62161f', '#7c202a', '#962c35', '#ae3c42', '#c45452', '#d87468'),
  gold: ramp('#6b4410', '#8a5a16', '#a8721f', '#c48c2c', '#dca640', '#ecc260', '#f8dc8c'),
  grey: ramp('#4c4842', '#625d55', '#78736a', '#8f8a80', '#a6a196', '#bcb7ad', '#d2cec5'),
  night: ramp('#0e1840', '#16245a', '#203474', '#2c468e', '#3c5ca8', '#5276c0', '#7096d4'),
  cream: ramp('#8a6c46', '#a8885c', '#c4a678', '#dbc298', '#ead8b4', '#f4e8cc', '#fcf6e6'),
};
const STITCH = { green: '#d8f0dc', greenH: '#e4f6e8', red: '#f8dcd4', gold: '#fff6dc', grey: '#d6d1c6', night: '#d4e0f8', cream: '#9a7a52' };
for (const [k, R] of Object.entries(BTN)) {
  const n = k === 'green' ? 'button_green' : k === 'greenH' ? 'button_green_hover' : k === 'red' ? 'button_red' : k === 'gold' ? 'button_gold' : k === 'grey' ? 'button_disabled' : k === 'night' ? 'button_night' : 'button_cream';
  HI[n] = cloth(R, false, STITCH[k]);
  if (k !== 'greenH' && k !== 'grey') HI[n + '_down'] = cloth(R, true, STITCH[k]);
}

// ---------------------------------------------------------------- brass slots with a leather well
function slot(active, oct = false) {
  return frame({ slice: oct ? [8, 8, 8, 8] : [9, 9, 9, 9], mid: 24, r: oct ? 4 : 3.2 }, (p) => {
    const { d, lit, u, v, M, along, ax, ay, Wa, Ha, res } = p;
    if (oct) { const c = 4; if (ax + ay < c || Wa - ax + ay < c || ax + Ha - ay < c || Wa - ax + Ha - ay < c) return null; }
    if (d < inkW(along, M, 4) * 0.9) return active ? C('#f1e4c4') : C('#2a2218');
    if (d < 4) {
      const k = (d - 1) / 3;
      const prof = k < 0.25 ? (lit > 0 ? 0.92 : 0.38) : k < 0.5 ? 0.62 : k < 0.62 ? 0.28 : k < 0.8 ? 0.55 : lit > 0 ? 0.35 : 0.7;
      return brassAt(p.tx, p.ty, prof + (active ? 0.12 : 0), { patina: !active });
    }
    if (d < 5) return C('#2a2218');
    if (d < 6) return lit > 0 ? mulRGB(LEATHER[0], 0.8) : LEATHER[3];
    return onRamp('leather', LEATHER, u, v, active ? 0.62 : 0.38, 1.6);
  }, (b, { res, Wa, Ha }) => {
    const o = oct ? 4.2 : 2.6;
    for (const [x, y] of [[o, o], [Wa - o, o], [o, Ha - o], [Wa - o, Ha - o]]) rivet(b, res, x, y, 1.1);
  });
}
HI.slot_gold = slot(false);
HI.slot_gold_active = slot(true);
HI.slot_brass = slot(false, true);

// ---------------------------------------------------------------- tabs, chips, inputs, bubbles: paper pieces
function paperPiece(slice, r, R, seed, o = {}) {
  return frame({ slice, mid: o.mid ?? 32, r, lip: o.lip ?? 0 }, (p) => {
    const { d, lit, u, v, M, along, ay, Ha } = p;
    if (o.openBottom && ay > Ha - 1) return d >= 0 ? paperAt(u, v, M, M, { ramp: R, seed }) : null;
    if (d < 0) return null;
    if (d < (o.ink ?? inkW(along, M, seed))) return o.inkCol ?? INKP;
    if (d < 1.9) return lit > 0 ? paperAt(u, v, M, M, { ramp: R, seed, base: 0.76 }) : paperAt(u, v, M, M, { ramp: R, seed, base: 0.5 });
    return paperAt(u, v, M, M, { ramp: R, seed, base: o.base ?? 0.64 });
  });
}
HI.tab = paperPiece([6, 6, 3, 6], 3, PAPER_DARK, 11, { openBottom: true, base: 0.58 });
HI.tab_active = paperPiece([6, 6, 3, 6], 3, PAPER, 12, { openBottom: true });
HI.input = paperPiece([5, 5, 5, 5], 2, PAPER, 13, { base: 0.74 });
HI.bubble_bw = paperPiece([7, 7, 7, 7], 6, PAPER, 14, { ink: 1.9, inkCol: INK, base: 0.74 });

// ---------------------------------------------------------------- ledger paper: rules, a margin, a punched hole
HI.paper_ledger = frame({ slice: [6, 4, 6, 12], mid: 24, r: 0 }, (p) => {
  const { u, v, M, ax, ay, Wa, Ha, res, tx, ty } = p;
  if (ax > Wa - 1 || ay > Ha - 1) return C('#c9b78d');
  const c = paperAt(u, v, M, M, { ramp: PAPER, seed: 21, base: 0.7 });
  const ry = Math.floor(ay) - 6;
  if (((ry % 4) + 4) % 4 === 3 && Math.floor(ay * res) % res === 0) return mixRGB(c, C('#8fa3a6'), 0.45);
  if (Math.floor(ax) === 9) return mixRGB(c, C('#b77d72'), 0.6);
  if (Math.floor(ax) === 10) return mixRGB(c, C('#b77d72'), 0.2);
  let hy = (((ay - 11) % 12) + 12) % 12; if (hy > 6) hy -= 12; // a punched hole every 12 art px down the left
  const hx = ax - 3.5, hr = Math.hypot(hx, hy);
  if (hr < 1.6) return hr < 1.1 ? C('#5a4c3a') : C('#b5a27c');
  return bayer(tx, ty) > 0.45 && ax < 1 ? mulRGB(c, 0.95) : c;
});

export const HI_SLICE = {
  wood: [7, 7, 7, 7], wood_dark: [7, 7, 7, 7], parchment: [6, 6, 7, 6], parchment_dark: [6, 6, 7, 6],
  slot_gold: [9, 9, 9, 9], slot_gold_active: [9, 9, 9, 9], slot_brass: [8, 8, 8, 8], tab: [6, 6, 3, 6], tab_active: [6, 6, 3, 6],
  input: [5, 5, 5, 5], bubble_bw: [7, 7, 7, 7], paper_ledger: [6, 4, 6, 12],
};
