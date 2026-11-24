// Hoot Hollow's money, drawn with the BME sprite kit in the calm "Moss & Moonlight" palette: golden
// ACORNS with a dark oak cap (the everyday currency; the save field is still `coins` and the sprite
// keeps its old name `owlcoin`), glowing lilac MOON GEMS with a lamp-gold crescent inside (premium),
// and the piles of acorns sold in Barnaby's lodge store. Halos are stepped pixel rings.
// OWNED BY THE SHOP BUILDER. Others use the names: owlcoin, moongem (+ `_f0`..`_f7` idle frames),
// coin_pouch, coin_sack, coin_chest, coin_vault (+ `coin_vault_f0`..`_f3`), acorn_big (the large
// "artifact" acorn for reward moments) and gem_big.
import { draw, Grid, render, RAMPS } from './sprites.js';

// calm-palette ramps (dark -> light) for the money; registered here so the HUD can draw them at boot
Object.assign(RAMPS, {
  nacorn: ['#5a4126', '#8e6a3a', '#b98c4c', '#dcb072', '#ecca8f', '#faf0d2'],
  ngold: ['#6b5532', '#a3844a', '#c8a764', '#e6c987', '#f4e2b0', '#fffaee'],
  ncap: ['#2f2620', '#4a392b', '#5b4a3c', '#6f553d', '#8a6a4a', '#a8865e'],
  nwood: ['#2f2620', '#4a392b', '#6f553d', '#9c7a56', '#bf9d74', '#d8bf98'],
  nfrost: ['#617f8c', '#86a9b0', '#aec8cc', '#d3e0dc', '#eef3ef', '#ffffff'],
  nlake: ['#1e2a33', '#3a5160', '#5d7b88', '#86a9b0', '#aec8cc', '#dfe9ea'],
  nlilac: ['#4a4458', '#6a6280', '#8d84a6', '#b4a9c9', '#d3cce0', '#eeeaf4'],
  nplum: ['#211a24', '#3f3144', '#55405a', '#6e5266', '#93798f', '#c4b2c2'],
  nlamp: ['#8a6532', '#c59a52', '#dcb072', '#f1d39a', '#f9e9c4', '#fffaee'],
  nkraft: ['#4a3826', '#7d5f40', '#96744f', '#b99a6e', '#d1b48e', '#e6d3b4'],
  nberry: ['#3a2228', '#5e3a44', '#7d4b54', '#9e5f66', '#c08a88', '#e6c2b8'],
  nrose: ['#7d4b54', '#a8706e', '#c48e88', '#d9aca4', '#e8c4bc', '#f6e4dc'],
  nsage: ['#24352a', '#3f5a3b', '#557343', '#86a06a', '#a7b788', '#d4dfb8'],
  nbrass: ['#3d3229', '#6b5532', '#8e7440', '#c8a764', '#e0c987', '#f4ead0'],
});
const LAMP = [241, 211, 154], LILAC = [198, 189, 214];

// ------------------------------------------------------------------ post-processing helpers

const WHITE = [255, 255, 255];
const near = (p, x, y, r) => {
  let best = 9;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (!i && !j) continue;
    if (p.a(x + i, y + j) > 200) best = Math.min(best, Math.max(Math.abs(i), Math.abs(j)) + (Math.abs(i) + Math.abs(j) > r + 1 ? 1 : 0));
  }
  return best;
};
/** A soft pixel halo around the silhouette: ring 1 at `a1`, ring 2 at `a2`, ring 3 at `a3`. */
function halo(p, col, a1, a2, a3 = 0) {
  const src = p.clone(), R = a3 ? 3 : 2;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (src.a(x, y)) continue;
    const d = near(src, x, y, R);
    const a = d === 1 ? a1 : d === 2 ? a2 : d === 3 ? a3 : 0;
    if (a > 0) p.over(x, y, col, a);
  }
  return p;
}
/** Lighten a pixel towards white (keeps transparent pixels transparent). */
function lift(p, x, y, k, col = WHITE) {
  if (!p.in(x, y) || !p.a(x, y)) return;
  const c = p.get(x, y);
  p.put(x, y, [c[0] + (col[0] - c[0]) * k, c[1] + (col[1] - c[1]) * k, c[2] + (col[2] - c[2]) * k].map(Math.round), c[3]);
}
/** A four-point twinkle: bright core, softer arms. size 0 = a single pixel, 1..3 = arm length. */
function twinkle(p, cx, cy, size, core = [255, 250, 238], arm = [249, 233, 196]) {
  p.over(cx, cy, core, 255);
  for (let k = 1; k <= size; k++) {
    const a = k === size ? 150 : 230;
    p.over(cx - k, cy, arm, a); p.over(cx + k, cy, arm, a); p.over(cx, cy - k, arm, a); p.over(cx, cy + k, arm, a);
  }
  if (size >= 2) { p.over(cx - 1, cy - 1, arm, 90); p.over(cx + 1, cy - 1, arm, 90); p.over(cx - 1, cy + 1, arm, 90); p.over(cx + 1, cy + 1, arm, 90); }
}

// ------------------------------------------------------------------ the acorn

const ACORN_KEY = {
  N: 'nacorn.R@nut', n: 'nacorn:2', t: 'nacorn:1', s: 'nacorn:5',
  C: 'ncap.r@cap', c: 'ncap:1', h: 'ncap:5', m: 'ncap:4', r: 'nwood.y@rim', q: 'nwood:4',
  S: 'ncap.x@stem', u: 'ncap:4',
};
/**
 * A detailed acorn on a W x H grid: glossy golden nut with a pointed tip, a textured cap of
 * crosshatched scales with a raised rim, and a little stem. (cx, cy) is the nut's centre.
 */
function acornGrid(g, cx, cy, R, o = {}) {
  const sway = o.sway ?? 0;
  const capY = cy - R * 0.62, rimY = Math.round(cy - R * 0.38);
  // nut: round body tapering to a point
  g.ellipse(cx, cy, R, R * 0.98, 'N');
  g.poly([[cx - R * 0.55, cy + R * 0.55], [cx + R * 0.55, cy + R * 0.55], [cx + 0.3, cy + R * 1.5], [cx - 0.3, cy + R * 1.5]], 'N');
  const tipY = Math.floor(cy + R * 1.45);
  g.set(Math.floor(cx), tipY, 't').set(Math.floor(cx), tipY - 1, 't');
  // faint stripes running down the nut
  for (const dx of [-R * 0.45, R * 0.4]) for (let y = Math.round(cy - R * 0.2); y < cy + R * 0.7; y += 2) if (g.get(Math.round(cx + dx), y) === 'N') g.set(Math.round(cx + dx), y, 'n');
  // cap: a dome of scales
  const cw = R * 1.3, ch = R * 0.86;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const dx = (x + 0.5 - cx) / cw, dy = (y + 0.5 - capY) / ch;
    if (dx * dx + dy * dy > 1.02 || y > rimY) continue;
    const a = (x + y) % 3, b = (x - y + 300) % 3;
    let ch2 = 'C';
    if (a === 0 || b === 0) ch2 = 'c';
    else if (a === 1 && b === 1) ch2 = dx + dy < -0.15 ? 'h' : 'm';
    g.set(x, y, ch2);
  }
  // the rim: a raised lip all the way round, slightly wider than the dome
  for (let x = Math.round(cx - cw - 0.4); x <= Math.round(cx + cw - 0.6); x++) { g.set(x, rimY, 'r'); g.set(x, rimY + 1, x % 2 ? 'r' : 'q'); }
  // stem
  const top = Math.round(capY - ch);
  g.set(Math.round(cx), top, 'S').set(Math.round(cx), top - 1, 'S').set(Math.round(cx) + 1, top - 1, 'S');
  g.set(Math.round(cx) + sway, top - 2, 'S').set(Math.round(cx) + 1 + sway, top - 2, 'u');
  g.set(Math.round(cx) + sway + (sway >= 0 ? 1 : 0), top - 3, 'S');
  // gloss on the nut
  if (o.gloss !== false) {
    const hx = Math.round(cx - R * 0.5), hy = Math.round(cy - R * 0.08);
    g.set(hx, hy, '+').set(hx, hy + 1, '+').set(hx, hy + 2, 's').set(hx + 1, hy - 1, 's').set(hx - 0, hy + 3, 's');
  }
  return g;
}

/** Big acorn frames: bob, stem sway, a glint sweeping across the nut, sparkles popping. */
function acornFrame(f, size = 24) {
  const dy = [0, -1, -1, -1, 0, 0, 0, 0][f], sway = [0, 0, 1, 1, 0, -1, -1, 0][f];
  const k = size / 24;
  const g = acornGrid(new Grid(size, size), 12 * k, 14.2 * k + dy, 6.6 * k, { sway });
  const p = render(g, ACORN_KEY);
  // glint: a bright diagonal band crossing the nut on frames 2..5
  if (f >= 2 && f <= 5) {
    const c = (17 + (f - 2) * 5.5) * k;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const ch = g.get(x, y);
      if (ch !== 'N' && ch !== 'n' && ch !== 's' && ch !== '+') continue;
      const d = Math.abs(x + y - c - dy);
      if (d < 0.6 * k + 0.4) lift(p, x, y, 0.62); else if (d < 1.6 * k) lift(p, x, y, 0.28);
    }
  }
  halo(p, LAMP, [96, 104, 116, 128, 116, 104, 96, 90][f], [40, 46, 52, 60, 52, 46, 40, 36][f], size > 30 ? 20 : 0);
  // sparkles
  const sp = [[0, 0], [0, 0], [0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [0, 1]][f];
  if (sp[0]) twinkle(p, Math.round(19 * k), Math.round(5 * k + dy), sp[0] - (sp[0] === 3 ? 1 : 0) + (k > 1.4 ? 1 : 0));
  if (f === 6 || f === 7 || f === 0) twinkle(p, Math.round(4.5 * k), Math.round(18 * k), f === 7 ? 1 : 0, [255, 250, 238], [241, 211, 154]);
  return p;
}
for (let f = 0; f < 8; f++) draw('owlcoin_f' + f, () => acornFrame(f));
draw('owlcoin', () => acornFrame(0));
// the large "artifact" acorn for reward moments (40 px art)
for (let f = 0; f < 8; f++) draw('acorn_big_f' + f, () => acornFrame(f, 40));
draw('acorn_big', () => acornFrame(0, 40));
// a plain small acorn for showers and price tags
draw('acorn_tiny', () => halo(render(acornGrid(new Grid(12, 13), 6, 7.2, 3.4, { gloss: true }), ACORN_KEY), LAMP, 70, 0));

// ------------------------------------------------------------------ the moon gem

const GEM_KEY = {
  a: 'nfrost:5', b: 'nfrost:4', c: 'nlake:4', d: 'nlake:3', e: 'nlake:2',
  p: 'nlilac:5', q: 'nlilac:4', r: 'nlilac:3', s: 'nplum:4', t: 'nplum:3', u: 'nplum:2',
  M: 'nlamp:5', m: 'nlamp:4', w: '#fffaee', g: 'nfrost:5!',
};
/** A faceted crystal: ice-blue crown, violet pavilion, a crescent moon glowing inside. */
function gemGrid(W, H, k = 1, ox = 0, oy = 0) {
  const g = new Grid(W, H);
  const X = (v) => ox + v * k, Y = (v) => oy + v * k;
  const tl = [X(7), Y(3.5)], tr = [X(17), Y(3.5)], gl = [X(2), Y(9)], gr = [X(22), Y(9)], cu = [X(12), Y(22)];
  // crown facets, left to right: lit to shade
  g.poly([gl, tl, [X(9), Y(9)]], 'a');
  g.poly([tl, [X(12), Y(3.5)], [X(12), Y(9)], [X(9), Y(9)]], 'b');
  g.poly([[X(12), Y(3.5)], tr, [X(15), Y(9)], [X(12), Y(9)]], 'c');
  g.poly([tr, gr, [X(15), Y(9)]], 'd');
  // table highlight
  g.poly([[X(9), Y(3.5)], [X(15), Y(3.5)], [X(14), Y(5.5)], [X(10), Y(5.5)]], 'a');
  // pavilion facets fanning down to the culet
  g.poly([gl, [X(7), Y(9)], cu], 'p');
  g.poly([[X(7), Y(9)], [X(12), Y(9)], cu], 'q');
  g.poly([[X(12), Y(9)], [X(17), Y(9)], cu], 'r');
  g.poly([[X(17), Y(9)], gr, cu], 's');
  // the girdle: a bright band where crown meets pavilion
  g.line(gl[0] + 1, Y(9), gr[0] - 1, Y(9), 'g');
  // facet edges in the pavilion
  g.line(X(7), Y(10), cu[0], cu[1] - 1, 'r').line(X(17), Y(10), cu[0], cu[1] - 1, 't');
  // inner crescent moon
  g.ellipse(X(11.6), Y(13.2), 3.1 * k, 3.1 * k, 'M');
  g.ellipse(X(12.9), Y(12.3), 2.6 * k, 2.6 * k, 'q', ['M']);
  g.set(Math.round(X(10)), Math.round(Y(14)), 'm');
  // rim highlights on the lit edges
  g.line(gl[0] + 1, gl[1] - 1, tl[0], tl[1], 'w');
  g.set(Math.round(X(9)), Math.round(Y(4)), 'w').set(Math.round(X(10)), Math.round(Y(4)), 'w');
  g.line(gl[0] + 1, Y(10), X(9), Y(16), 'b');
  return g;
}
function gemFrame(f, size = 24) {
  const k = size / 24;
  const g = gemGrid(size, size, k * 0.92, size * 0.04, size * 0.02 + 0.5);
  const p = render(g, GEM_KEY);
  // inner light pulses outward from the moon
  const pulse = [0.15, 0.25, 0.35, 0.42, 0.35, 0.25, 0.15, 0.1][f];
  const mx = 11.6 * k * 0.92 + size * 0.04, my = 13.2 * k * 0.92 + size * 0.02 + 0.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x + 0.5 - mx, y + 0.5 - my) / k;
    if (d < 7 && 'pqrstab'.includes(g.get(x, y))) lift(p, x, y, pulse * (d < 3.5 ? 1 : 0.5), [255, 246, 222]);
  }
  // a facet flash travelling across the crown
  const fx = [8, 10, 12, 14, 16, -1, -1, -1][f];
  if (fx > 0) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (Math.abs(x - fx * k) < 0.8 * k && 'abcd'.includes(g.get(x, y))) lift(p, x, y, 0.55);
  // glow halo, pulsing
  halo(p, LILAC, [80, 96, 112, 128, 112, 96, 80, 70][f], [32, 42, 52, 60, 52, 42, 32, 28][f], size > 30 ? [12, 18, 24, 30, 24, 18, 12, 10][f] : 0);
  // a twinkle circling the gem, and a smaller one opposite
  const ang = (f / 8) * Math.PI * 2 - Math.PI / 2, R = 10.4 * k;
  const cx = size / 2, cy = size / 2;
  twinkle(p, Math.round(cx + Math.cos(ang) * R), Math.round(cy + Math.sin(ang) * R), [2, 1, 2, 1, 2, 1, 2, 1][f] + (k > 1.4 ? 1 : 0), [255, 250, 238], [223, 233, 234]);
  if (f % 2 === 0) twinkle(p, Math.round(cx - Math.cos(ang) * R * 0.85), Math.round(cy - Math.sin(ang) * R * 0.85), 0, [238, 234, 244], [211, 204, 224]);
  return p;
}
for (let f = 0; f < 8; f++) draw('moongem_f' + f, () => gemFrame(f));
draw('moongem', () => gemFrame(0));
for (let f = 0; f < 8; f++) draw('gem_big_f' + f, () => gemFrame(f, 40));
draw('gem_big', () => gemFrame(0, 40));
draw('gem_tiny', () => halo(render(gemGrid(12, 12, 0.48, 0.4, 0.4), GEM_KEY), LILAC, 76, 0));

// ------------------------------------------------------------------ piles of acorns

// small acorns for heaps: alternate shading groups so neighbours read as separate nuts
const PILE_KEY = {
  ...ACORN_KEY,
  N: 'nacorn.R@n0', O: 'nacorn.R@n1', P: 'nacorn.R@n2',
  C: 'ncap.r@c0', D: 'ncap.r@c1', E: 'ncap.r@c2',
  G: 'ngold.R@g0', H: 'ngold.R@g1', I: 'ngold.R@g2',
  B: 'nkraft.r@sack', b: 'nkraft:2', v: 'nkraft:4', y: 'nberry.x@rope', Y: 'nberry:4',
  W: 'nwood.y@wick', w: 'nwood:2', x: 'nwood:5', L: 'nsage.r@leaf', l: 'nsage:4', j: 'nsage:1',
  V: 'nlilac.R@gem1', U: 'nlake.R@gem2', T: 'nrose.R@gem3', Q: 'nsage.R@gem4',
};
const NUTS = ['N', 'O', 'P'], CAPS = ['C', 'D', 'E'], GOLDS = ['G', 'H', 'I'];
let nutN = 0;
/** A small acorn (about 7 x 9 px) lying in a heap, with an ink line where it overlaps others. */
function nut(g, cx, cy, o = {}) {
  const i = nutN++ % 3, N = o.gold ? GOLDS[i] : NUTS[i], C = CAPS[i], r = o.r ?? 3.1, tilt = o.tilt ?? 0;
  const ln = new Grid(g.w, g.h);
  ln.ellipse(cx, cy + 0.6, r + 1, r + 1.4, '#');
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (ln.get(x, y) === '#' && g.get(x, y) !== '.') g.set(x, y, 'k');
  g.ellipse(cx, cy + 0.8, r, r * 1.05, N);
  g.set(Math.round(cx + tilt * 0.3), Math.round(cy + r * 1.35), N).set(Math.round(cx + tilt * 0.3), Math.round(cy + r * 1.35) + (r > 3 ? 1 : 0), 't');
  // cap
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const dx = (x + 0.5 - cx - tilt * 0.4) / (r * 1.22), dy = (y + 0.5 - (cy - r * 0.5)) / (r * 0.72);
    if (dx * dx + dy * dy <= 1.05 && y <= Math.round(cy - r * 0.2)) g.set(x, y, (x + y) % 3 === 0 ? 'c' : C);
  }
  g.set(Math.round(cx + tilt * 0.5), Math.round(cy - r * 1.25), 'S');
  if (r >= 3) g.set(Math.round(cx - r * 0.45), Math.round(cy + 0.5), '+');
  return g;
}

// coin_pouch: a little handful of acorns on an oak leaf
function handful(withGlint = 0) {
  const g = new Grid(32, 32);
  nutN = 0;
  // oak leaf underneath
  g.poly([[3, 25], [10, 21], [17, 22], [24, 20], [30, 24], [25, 28], [16, 29], [7, 29]], 'L');
  for (let x = 5; x < 28; x += 4) g.set(x, 24 + (x % 8 ? 1 : 0), 'j');
  g.line(4, 26, 28, 24, 'l');
  nut(g, 9, 20, { tilt: -1 }); nut(g, 23, 20, { tilt: 1 }); nut(g, 16, 21);
  nut(g, 12, 14, { tilt: -1 }); nut(g, 20, 14, { tilt: 1 });
  nut(g, 16, 8, { r: 3.4 });
  const p = render(g, PILE_KEY);
  if (withGlint) twinkle(p, 21, 5, 2);
  return halo(p, LAMP, 56, 20);
}
draw('coin_pouch', () => handful(1));

// coin_sack: a burlap sack spilling acorns
draw('coin_sack', () => {
  const g = new Grid(32, 32);
  nutN = 1;
  // sack body with a weave
  g.ellipse(15, 21, 11.2, 9.6, 'B');
  g.poly([[7, 14], [23, 14], [21, 9], [9, 9]], 'B');
  for (let y = 9; y < 31; y++) for (let x = 3; x < 28; x++) if (g.get(x, y) === 'B' && (x + y * 3) % 5 === 0) g.set(x, y, x % 2 ? 'b' : 'v');
  // a patch
  g.rect(17, 22, 5, 4, 'v'); g.set(17, 22, 'b').set(21, 25, 'b').set(19, 24, 'k');
  // rope tie
  g.rect(8, 12, 15, 2, 'y'); g.set(9, 12, 'Y').set(13, 12, 'Y').set(17, 12, 'Y');
  g.line(22, 13, 26, 17, 'y').line(23, 13, 27, 15, 'y');
  // the open mouth heaped with acorns
  nut(g, 11, 8); nut(g, 19, 8); nut(g, 15, 5, { r: 3.3 });
  // a few spilled on the ground
  nut(g, 27, 26, { tilt: 2 }); nut(g, 4, 28, { r: 2.7, tilt: -2 }); nut(g, 25, 29, { r: 2.6 });
  const p = render(g, PILE_KEY);
  twinkle(p, 18, 2, 1);
  return halo(p, LAMP, 52, 18);
});

// coin_chest: a woven basket heaped with acorns
draw('coin_chest', () => {
  const g = new Grid(32, 32);
  nutN = 2;
  // handle arc behind
  for (let a = 0; a <= Math.PI; a += 0.05) { const x = 16 + Math.cos(a) * 12, y = 15 - Math.sin(a) * 12; g.set(x, y, 'W'); g.set(x, y + 1, 'w'); }
  // heap
  const heap = [[6, 16], [11, 15], [16, 16], [21, 15], [26, 16], [8.5, 11], [14, 10.5], [19, 10.5], [24, 11.5], [11.5, 6.5], [17, 5.5], [21.5, 7.5]];
  for (const [x, y] of heap) nut(g, x, y, { tilt: x < 16 ? -1 : 1 });
  // basket: wicker weave tapering down
  g.poly([[2, 17], [30, 17], [27, 30], [5, 30]], 'W');
  for (let y = 17; y < 31; y++) for (let x = 2; x < 31; x++) if (g.get(x, y) === 'W') {
    const band = Math.floor((y - 17) / 2), weave = (x + band * 2) % 4;
    if ((y - 17) % 2 === 1 && weave < 2) g.set(x, y, 'w'); else if (weave === 3) g.set(x, y, 'x');
  }
  g.rect(2, 17, 29, 2, 'W'); g.line(2, 17, 30, 17, 'x');
  g.rect(5, 29, 23, 1, 'w');
  const p = render(g, PILE_KEY);
  twinkle(p, 15, 2, 2);
  return halo(p, LAMP, 58, 22);
});

// coin_vault: a mountain of golden acorns with gems hiding in it
function mountain(f) {
  const g = new Grid(36, 34);
  nutN = 0;
  const rows = [[31, [3, 9, 15, 21, 27, 33]], [26, [6, 12, 18, 24, 30]], [21, [9, 15, 21, 27]], [16, [12, 18, 24]], [11, [15, 21]], [6, [18]]];
  let n = 0;
  for (const [y, xs] of rows) for (const x of xs) { nut(g, x + ((n * 7) % 3) - 1, y - 2, { gold: n % 4 !== 1, tilt: (n % 3) - 1, r: y > 26 ? 3.3 : 3.1 }); n++; }
  // gems poking out
  const gem = (x, y, ch) => { g.poly([[x - 2.5, y], [x, y - 3], [x + 2.5, y], [x, y + 3.5]], ch); g.set(x - 1, y - 1, '*'); };
  gem(9, 27, 'V'); gem(26, 22, 'U'); gem(15, 17, 'T'); gem(30, 30, 'Q');
  const p = render(g, PILE_KEY);
  // glints wander over the heap
  const spots = [[18, 3, 2], [24, 14, 1], [10, 20, 2], [28, 26, 1]];
  const [sx, sy, ss] = spots[f % 4];
  twinkle(p, sx, sy, ss);
  twinkle(p, spots[(f + 2) % 4][0], spots[(f + 2) % 4][1], 0);
  return halo(p, LAMP, [78, 92, 104, 92][f % 4], [30, 38, 44, 38][f % 4]);
}
for (let f = 0; f < 4; f++) draw('coin_vault_f' + f, () => mountain(f));
draw('coin_vault', () => mountain(0));

// the boutique's gem packs: a shard, a cluster, a geode and a crown of moon gems
function gemPack(n) {
  const S = 32, g = new Grid(S, S);
  const put = (k, ox, oy) => { const s = gemGrid(S, S, k, ox, oy); for (let i = 0; i < s.c.length; i++) if (s.c[i] !== '.') g.c[i] = s.c[i]; };
  if (n === 1) put(1.05, 3.5, 4);
  if (n === 2) { put(0.62, 1, 12); put(0.62, 17, 13); put(0.85, 6, 2); }
  if (n === 3) {
    // a split geode: rocky rim, crystals inside
    g.ellipse(16, 18, 15, 13, 'k');
    g.ellipse(16, 18, 14, 12, 'o');
    g.ellipse(16, 18, 11.5, 9.6, 'O');
    for (let y = 6; y < 31; y++) for (let x = 2; x < 31; x++) if (g.get(x, y) === 'o' && (x * 7 + y * 3) % 5 === 0) g.set(x, y, 'n');
    put(0.5, 4, 12); put(0.5, 17, 12); put(0.6, 9, 6); put(0.45, 12, 18);
  }
  if (n === 4) {
    g.poly([[3, 26], [29, 26], [31, 12], [24, 19], [16, 6], [8, 19], [1, 12]], 'm');
    g.rect(3, 26, 27, 4, 'M');
    put(0.42, 11, 8); put(0.32, 1, 12); put(0.32, 21, 12);
    for (let x = 5; x < 28; x += 5) g.set(x, 28, 'w');
  }
  const p = render(g, { ...GEM_KEY, m: 'nbrass.r@crown', M: 'nbrass.y@band', o: 'stone.r@rock', n: 'stone:2', O: 'nplum:1' });
  twinkle(p, 25, 5, 2, [255, 250, 238], [223, 233, 234]);
  return halo(p, LILAC, 70, 28);
}
for (const n of [1, 2, 3, 4]) draw('gem_pack_' + n, () => gemPack(n));
