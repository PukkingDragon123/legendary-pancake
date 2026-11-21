// Hoot Hollow's interface chrome, drawn with The Bear Must Eat's sprite kit (sprites.js): the
// animated icons on the three big main buttons (Sleep, Clock, Book) and on the side tools
// (Build, Shop, Dress up, Quests, Map, Settings), the HUD medallions, and the little sprites the
// 2D UI particles and screen transitions are made of. An animation is a set of frames named
// `<base>_<i>`, cycled by PxAnim (src/ui/chrome/pxanim.tsx) along a timeline.
// OWNED BY THE UI-CHROME BUILDER.
import { Grid, icon } from './sprites.js';

const D2R = Math.PI / 180;
const rot = (x, y, cx, cy, a) => { const c = Math.cos(a), s = Math.sin(a); return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; };
/** Register frames `${base}_${f}` for f in 0..n-1, each drawn by draw(grid, f). */
function frames(base, n, key, draw, w = 32, h = 32) {
  for (let f = 0; f < n; f++) icon(`${base}_${f}`, key, () => { const g = new Grid(w, h); draw(g, f); return g.rows(); });
}
/** A thick line as a polygon (pixel centres inside). */
function bar(g, x0, y0, x1, y1, r, ch) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * r, ny = (dx / L) * r;
  g.poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], ch);
}
/** Small pixel glyphs (z for snoring, digits not needed). */
const ZG = {
  3: ['###', '.#.', '###'],
  4: ['####', '..#.', '.#..', '####'],
  5: ['#####', '...#.', '..#..', '.#...', '#####'],
};
function glyph(g, x, y, rows, ch) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') g.set(x + i, y + j, ch); }); }
/** A twinkling star: phase 0..7 -> cross, dot, dim, off. */
function twinkle(g, x, y, ph, big = 'S', dim = 's') {
  const p = ((ph % 8) + 8) % 8;
  if (p < 2) { g.set(x, y, big).set(x - 1, y, dim).set(x + 1, y, dim).set(x, y - 1, dim).set(x, y + 1, dim); }
  else if (p < 4) g.set(x, y, big);
  else if (p < 6) g.set(x, y, dim);
}

// =====================================================================================
// MAIN BUTTON: SLEEP. A turned-down bed under the night sky: a carved headboard with a moon
// cut-out, a plump pillow with a striped nightcap resting on it, a patchwork quilt (stitched
// squares in honey, berry and sage) that rises and falls over a sleepy lump, a crescent moon
// rocking on its thread, stars twinkling and Zzz drifting up. (No owl is drawn: Pip only ever
// appears as the 3D model.)
// =====================================================================================
const SLEEP_KEY = {
  M: 'yellow.R@moon', m: 'yellow:5', t: 'cream:2', S: '#fff8d0!', s: '#9c94dc!',
  W: 'wood.x@bed', w: 'wood:5', d: 'dwood.s@leg', H: 'wood.y@post', h: 'wood:1', o: 'dwood:1',
  P: 'cream.r@pillow', p: 'cream:2',
  B: 'blue.r@quilt', b: 'blue:2', q: 'sky:4', Q: 'yellow:3', r: 'red:3', g: 'green:3', x: 'cream:5',
  C: 'red.r@cap', c: 'cream:4', O: 'white:5',
  Z: '#efe8ff', z: '#a69ee0!',
};
function drawSleep(g, f) {
  // stars
  [[4, 3], [11, 6], [16, 2], [3, 10], [29, 14], [21, 9], [8, 1], [26, 2]].forEach(([x, y], i) => twinkle(g, x, y, f + i * 3));
  // crescent moon on a thread, rocking
  const rock = [0, 1, 1, 0, 0, -1, -1, 0][f % 8];
  g.line(24, 0, 24 + rock, 2, 't');
  g.ellipse(24.5 + rock, 7, 4.8, 4.8, 'M');
  g.ellipse(27 + rock, 5.4, 4, 4, '.');
  g.set(21 + rock, 6, 'm').set(21 + rock, 7, 'm').set(22 + rock, 10, 'm');
  // headboard: two posts with round finials and a panel with a moon cut-out
  g.rect(2, 13, 3, 15, 'H'); g.rect(8, 15, 2, 6, 'H');
  g.ellipse(3.5, 13, 1.9, 1.7, 'H'); g.ellipse(9, 15, 1.4, 1.2, 'H');
  g.rect(5, 15, 3, 6, 'W');
  g.set(6, 17, 'o').set(6, 18, 'o').set(5, 17, 'o'); // the little moon cut-out
  g.line(3, 15, 3, 26, 'w');
  // footboard
  g.rect(27, 19, 3, 9, 'H'); g.ellipse(28.5, 19, 1.7, 1.5, 'H'); g.line(28, 20, 28, 26, 'w');
  // rail and legs
  g.rect(5, 24, 23, 3, 'W'); g.line(6, 25, 26, 25, 'w'); g.line(6, 26, 26, 26, 'h');
  g.rect(2, 28, 2, 2, 'd'); g.rect(28, 28, 2, 2, 'd');
  // plump pillow and a striped nightcap resting on it
  g.ellipse(10.5, 19.5, 4.6, 2.7, 'P');
  g.line(8, 21, 13, 21, 'p'); g.set(7, 19, 'p');
  g.poly([[8, 18.6], [14, 18.4], [15.6, 16], [12.5, 15], [10, 16]], 'C');
  for (const [x, y] of [[10, 17], [12, 16], [13, 17], [14, 16]]) g.set(x, y, 'c');
  g.rect(8, 18, 6, 1, 'c');
  g.ellipse(16, 15.4, 1.3, 1.3, 'O');
  // patchwork quilt over a sleepy lump that breathes
  const lift = f >= 2 && f <= 5 ? 1 : 0;
  g.poly([[9, 25], [9, 21.6], [13, 20.6 - lift], [17.5, 18.6 - lift], [22, 19.4 - lift], [27.5, 20.2], [27.5, 25]], 'B');
  for (let y = 18; y < 25; y++) for (let x = 9; x < 28; x++) {
    if (g.get(x, y) !== 'B') continue;
    const px = Math.floor((x - 9) / 4), py = Math.floor((y - 17) / 3), k = (px * 3 + py * 5) % 5;
    if ((x - 9) % 4 === 3 || (y - 17) % 3 === 2) g.set(x, y, 'b'); // stitched seams
    else if (k === 1) g.set(x, y, 'Q');
    else if (k === 3) g.set(x, y, 'r');
    else if (k === 4) g.set(x, y, 'g');
  }
  for (let x = 10; x < 27; x += 2) g.set(x, 24, 'x'); // a cream binding
  // Zzz rising
  for (let k = 0; k < 2; k++) {
    const t = ((f + k * 4) % 8) / 8;
    const size = t < 0.34 ? 3 : t < 0.7 ? 4 : 5;
    const x = Math.round(15 + t * 3 + Math.sin(t * 6.3) * 1.2), y = Math.round(12 - t * 10.5);
    glyph(g, x, y, ZG[size], t > 0.82 ? 'z' : 'Z');
  }
}
frames('nav_sleep', 8, SLEEP_KEY, drawSleep);
// tapped: the quilt stirs, a big Z puffs out
frames('nav_sleep_tap', 3, SLEEP_KEY, (g, f) => {
  drawSleep(g, f * 2 + 2);
  if (f > 0) glyph(g, 17 + f, 9 - f * 3, ZG[5], 'Z');
});

// =====================================================================================
// MAIN BUTTON: CLOCK. A carved cuckoo clock: shingled roof, ivy, a brass-rimmed face, pine-cone
// weights on chains, a swinging pendulum, and now and then the bird pops out of its door.
// =====================================================================================
const CLOCK_KEY = {
  R: 'dwood.y@roof', r: 'wood:4', W: 'lwood.x@body', w: 'lwood:2', t: 'lwood:5',
  D: 'dwood.s@door', h: '#1a1014', C: 'cream.r@face', B: 'brass.R@rim', K: '#2a1a14',
  P: 'brass.R@bob', p: 'brass:2', L: 'leaf.r@ivy', c: 'iron:4', G: 'cinnamon.r@cone', g: 'cinnamon:1',
  Y: 'yellow.r@bird', y: 'orange:3', e: '#2a1a14', b: 'sky:3', S: '#fff8d0!',
};
function drawClock(g, pend, bird) {
  // gable wall and body
  g.poly([[6, 12], [16, 3.4], [26, 12]], 'W');
  g.rect(7, 11, 18, 13, 'W');
  g.line(8, 13, 8, 22, 'w'); g.line(23, 13, 23, 22, 'w');
  // roof boards (a chevron) + shingle marks + ridge finial
  g.poly([[16, 0.6], [1.2, 11.2], [3.4, 13], [16, 3.6], [28.6, 13], [30.8, 11.2]], 'R');
  for (let i = 0; i < 6; i++) { g.set(4 + i * 2, 10 - Math.round(i * 1.42), 'r'); g.set(28 - i * 2, 10 - Math.round(i * 1.42), 'r'); }
  g.set(16, 0, 'L').set(15, 0, 'L').set(17, 1, 'L');
  // little door in the gable, the bird inside
  if (bird === 0) { g.rect(14, 6, 4, 4, 'D'); g.set(17, 8, 'B'); }
  else {
    g.rect(14, 6, 4, 4, 'h');
    g.rect(12, 6, 2, 4, 'D');
    if (bird >= 2) {
      const out = bird >= 3 ? 1 : 0;
      g.ellipse(16 + out, 8, 2, 1.9, 'Y');
      g.set(15 + out, 7, 'e');
      g.set(18 + out, 8, 'y').set(19 + out, 8, 'y');
      if (bird === 4) { g.set(19 + out, 7, 'y').set(19 + out, 9, 'y'); g.set(20 + out, 6, 'S').set(21 + out, 9, 'S'); }
      g.set(16 + out, 9, 'b').set(17 + out, 9, 'b');
    }
  }
  // clock face
  g.ellipse(16, 17, 4.7, 4.7, 'B');
  g.ellipse(16, 17, 3.6, 3.6, 'C');
  g.set(16, 14, 'w').set(19, 17, 'w').set(16, 20, 'w').set(13, 17, 'w');
  g.line(16, 17, 16, 14, 'K'); g.line(16, 17, 18, 16, 'K');
  g.set(16, 17, 'B');
  // ledge, ivy at the corners
  g.rect(5, 23, 22, 2, 'R');
  g.line(6, 23, 25, 23, 'r');
  g.ellipse(7, 22, 2, 1.6, 'L'); g.ellipse(25, 22, 2, 1.6, 'L'); g.set(9, 21, 'L').set(23, 21, 'L');
  // chains and pine-cone weights
  for (let y = 25; y < 28; y++) { g.set(10, y, y % 2 ? 'c' : '.'); g.set(22, y, y % 2 ? '.' : 'c'); }
  g.ellipse(10, 29, 1.5, 2.4, 'G'); g.set(10, 28, 'g').set(9, 30, 'g');
  g.ellipse(22, 28, 1.5, 2.4, 'G'); g.set(22, 27, 'g').set(23, 29, 'g');
  // pendulum
  const dx = Math.round(Math.sin((pend / 8) * Math.PI * 2) * 4);
  g.line(16, 25, Math.round(16 + dx * 0.75), 28, 'p');
  g.ellipse(16 + dx, 29.4, 2, 2, 'P');
}
frames('nav_clock', 8, CLOCK_KEY, (g, f) => drawClock(g, f, 0));
// the cuckoo: door opens, the bird pops out and calls twice, slips back in
const CUCKOO = [1, 2, 3, 4, 3, 4, 2, 1];
frames('nav_clock_cu', CUCKOO.length, CLOCK_KEY, (g, f) => drawClock(g, f, CUCKOO[f]));

// =====================================================================================
// MAIN BUTTON: BOOK. A thick leather book with a moon emblem, gold corners and a brass clasp;
// a shine sweeps the emblem; now and then the clasp springs, the cover opens, the pages flutter
// and a warm glow rises out of it.
// =====================================================================================
const BOOK_KEY = {
  L: 'red.r@cover', l: 'red:1', S: 'leather.x@spine', G: 'gold.R@gold', g: 'gold:4',
  P: 'cream.y@pages', p: 'cream:2', q: 'tan:2', T: 'leather.y@strap', B: 'brass.R@clasp',
  w: '#ffffff!', H: '#ffd86a!', h: '#fff6d0!', E: 'red.y@edge', I: 'parch.r@inside',
};
function bookSpine(g) {
  g.rect(3, 4, 4, 24, 'S');
  for (const y of [7, 13, 19, 25]) g.line(3, y, 6, y, 'G');
}
function bookPages(g) {
  g.rect(8, 6, 19, 21, 'P');
  for (let y = 7; y < 26; y += 2) g.set(26, y, 'p').set(25, y, 'p');
  for (let x = 9; x < 26; x += 2) g.set(x, 26, 'p');
  g.rect(8, 27, 20, 1, 'l');
}
function bookClosed(g, shine, clasped = true) {
  bookPages(g);
  bookSpine(g);
  g.rect(6, 4, 19, 22, 'L');
  // gold corners
  g.poly([[21.5, 4], [25, 4], [25, 7.5]], 'G'); g.poly([[25, 22.5], [25, 26], [21.5, 26]], 'G');
  g.set(7, 4, 'G').set(7, 25, 'G');
  // emblem: a ring with a crescent and a star; a title plate below
  g.ellipse(15.5, 13.5, 5, 5, 'G');
  g.ellipse(15.5, 13.5, 3.9, 3.9, 'L');
  g.ellipse(14.8, 13.5, 2.8, 2.8, 'G');
  g.ellipse(16.2, 12.6, 2.3, 2.3, 'L');
  g.set(18, 11, 'g');
  g.rect(10, 21, 11, 2, 'G'); g.line(11, 21, 19, 21, 'g');
  if (shine >= 0) { const x = 9 + shine * 3; for (let i = 0; i < 4; i++) { const px = x + i, py = 18 - i * 2; if (g.get(px, py) !== '.') g.set(px, py, 'w'); if (g.get(px + 1, py) !== '.') g.set(px + 1, py, 'w'); } }
  // clasp strap from the back onto the cover
  if (clasped) { g.rect(21, 12, 7, 4, 'T'); g.ellipse(22.5, 14, 1.6, 1.6, 'B'); }
  else { g.rect(26, 12, 3, 3, 'T'); g.rect(27, 15, 2, 6, 'T'); g.ellipse(28, 20, 1.4, 1.4, 'B'); }
}
frames('nav_book', 6, BOOK_KEY, (g, f) => bookClosed(g, f === 5 ? -1 : f));
icon('nav_book_c', BOOK_KEY, () => { const g = new Grid(32, 32); bookClosed(g, -1); return g.rows(); });
icon('nav_book_u', BOOK_KEY, () => { const g = new Grid(32, 32); bookClosed(g, -1, false); return g.rows(); });
// cover swinging open towards us (narrowing), pages with lines behind it
function bookOpening(g, coverW) {
  bookPages(g);
  for (let y = 9; y < 25; y += 2) g.line(Math.max(9, 6 + coverW + 1), y, 23, y, 'q');
  bookSpine(g);
  g.rect(6, 4, coverW, 22, 'L');
  g.line(6 + coverW - 1, 4, 6 + coverW - 1, 25, 'E');
  g.rect(27, 15, 2, 6, 'T'); g.ellipse(28, 20, 1.4, 1.4, 'B');
}
icon('nav_book_o1', BOOK_KEY, () => { const g = new Grid(32, 32); bookOpening(g, 11); return g.rows(); });
icon('nav_book_o2', BOOK_KEY, () => { const g = new Grid(32, 32); bookOpening(g, 4); return g.rows(); });
// open spread seen from a little above, with an optional page mid-turn and a glow
function bookOpen(g, page, glow) {
  if (glow >= 0) {
    for (let y = 0; y < 12; y++) for (let x = 2; x < 30; x++) {
      const dx = (x - 16) / 13, dy = (y - 11) / 10, d = dx * dx + dy * dy;
      if (d < 1 && (x + y + glow) % 2 === 0 && ((x * 5 + y * 3) % 7) < (d < 0.4 ? 5 : 2)) g.set(x, y, 'H');
    }
    const rays = glow === 0 ? [[16, 1], [9, 4], [23, 4], [12, 7], [20, 6]] : [[16, 3], [7, 6], [25, 6], [11, 2], [21, 2]];
    rays.forEach(([x, y]) => twinkle(g, x, y, glow === 0 ? 0 : 1, 'h', 'h'));
  }
  g.poly([[1, 9.5], [15.5, 12], [15.5, 28], [1, 25.5]], 'L');
  g.poly([[16.5, 12], [31, 9.5], [31, 25.5], [16.5, 28]], 'L');
  g.poly([[2, 9.5], [15.5, 11.5], [15.5, 26.5], [2, 24]], 'I');
  g.poly([[16.5, 11.5], [30, 9.5], [30, 24], [16.5, 26.5]], 'I');
  for (let i = 0; i < 6; i++) {
    const y = 13 + i * 2;
    g.line(4, y - 1, 13, y, 'q');
    if (i !== 2) g.line(19, y, 28, y - 1, 'q');
  }
  g.line(16, 12, 16, 27, 'k');
  if (page === 0) g.poly([[16.5, 11.8], [23, 3.5], [27, 5], [21, 13], [16.5, 26]], 'P');
  if (page === 1) g.poly([[15, 11.8], [15.2, 1.5], [18, 1.5], [17.8, 12], [17, 26]], 'P');
  if (page === 2) g.poly([[15.5, 11.8], [9, 3.5], [5, 5], [11, 13], [15.5, 26]], 'P');
  if (glow >= 0) [[8, 18], [24, 16]].forEach(([x, y]) => g.set(x, y, 'h'));
}
icon('nav_book_op', BOOK_KEY, () => { const g = new Grid(32, 32); bookOpen(g, -1, -1); return g.rows(); });
frames('nav_book_fl', 3, BOOK_KEY, (g, f) => bookOpen(g, f, -1));
frames('nav_book_gl', 2, BOOK_KEY, (g, f) => bookOpen(g, -1, f));

// =====================================================================================
// SIDE TOOLS (22x22)
// =====================================================================================
// Build: a hammer tapping a nail into a plank, sparks on each hit
const BUILD_KEY = { W: 'lwood.y@plank', w: 'lwood:2', N: 'steel.R@nail', n: 'steel:2', H: 'iron.R@head', h: 'steel:4', T: 'wood.x@handle', t: 'wood:5', y: '#ffe478!', '*': '#ffffff!' };
const HAMMER = [[-50, 12, 0], [-30, 12, 0], [-6, 13, 1], [-34, 13, 0], [-6, 14, 1], [-44, 14, 0]];
frames('tool_build', HAMMER.length, BUILD_KEY, (g, f) => {
  const [deg, nail, spark] = HAMMER[f];
  g.rect(1, 17, 20, 4, 'W');
  g.line(2, 19, 9, 19, 'w'); g.line(12, 18, 19, 18, 'w');
  g.rect(13, nail, 4, 1, 'N');
  g.line(14, nail + 1, 14, 16, 'n'); g.line(15, nail + 1, 15, 16, 'n');
  const a = deg * D2R, P = [2, 10.5], L = 11;
  const H = [P[0] + Math.cos(a) * L, P[1] + Math.sin(a) * L];
  const t = [Math.cos(a), Math.sin(a)], nrm = [-Math.sin(a), Math.cos(a)];
  bar(g, P[0], P[1], H[0], H[1], 1, 'T');
  const c = (u, v) => [H[0] + nrm[0] * u + t[0] * v, H[1] + nrm[1] * u + t[1] * v];
  g.poly([c(-3, -1.8), c(4, -1.8), c(4, 1.8), c(-3, 1.8)], 'H');
  const f0 = c(3.2, 0); g.set(f0[0], f0[1], 'h');
  if (spark) { [[11, 10], [18, 10], [10, 12], [19, 12]].forEach(([x, y], i) => g.set(x, y, i % 2 ? 'y' : '*')); g.set(12, 9, 'y').set(17, 9, '*'); }
}, 22, 22);

// Shop: the Snow Queen's icy boutique, a twinkling crown above, snow drifting down
const SHOP_KEY = { I: 'ice.x@wall', R: 'sky.y@roof', A: 'white.s@aw', a: 'sky:3', G: 'glass.r@win', D: 'blue.f@door', y: 'gold:4', C: 'gold.R@crown', c: 'blue:4', w: 'white:5', '*': '#ffffff!', s: '#dff4ff!' };
frames('tool_shop', 6, SHOP_KEY, (g, f) => {
  g.rect(3, 10, 16, 11, 'I');
  g.poly([[0.6, 11], [11, 4.6], [21.4, 11]], 'R');
  for (let x = 2; x < 21; x += 2) g.set(x, 10 - Math.round(Math.abs(x - 11) < 9 ? 0 : 0), 'w');
  g.line(4, 9, 11, 5, 'w'); g.line(18, 9, 12, 5, 'w');
  for (let x = 3; x < 19; x++) { g.set(x, 11, (x >> 1) % 2 ? 'A' : 'a'); g.set(x, 12, (x >> 1) % 2 ? 'A' : 'a'); if (x % 2 === 0) g.set(x, 13, (x >> 1) % 2 ? 'A' : 'a'); }
  g.rect(5, 14, 6, 5, 'G');
  if (f % 2 === 0) { g.set(8, 15, '*').set(7, 16, '*').set(8, 16, '*').set(9, 16, '*').set(8, 17, '*'); }
  else { g.set(7, 15, '*').set(9, 15, '*').set(8, 16, '*').set(7, 17, '*').set(9, 17, '*'); }
  g.rect(13, 14, 4, 7, 'D'); g.set(15, 17, 'y');
  // crown
  g.rect(7, 2, 9, 2, 'C');
  g.set(7, 1, 'C').set(11, 0, 'C').set(11, 1, 'C').set(15, 1, 'C').set(9, 1, 'C').set(13, 1, 'C');
  g.set(11, 2, 'c');
  const sp = [[17, 1], [5, 0], [14, 0], [19, 3], [3, 2], [12, 3]][f];
  g.set(sp[0], sp[1], '*');
  // drifting snow
  [[1, 3], [20, 6], [2, 16], [20, 15], [5, 7]].forEach(([x, y], i) => g.set(x, (y + f + i) % 22, 's'));
}, 22, 22);

// Dress up: a wooden hanger with a little red cape, swinging from its hook
const DRESS_KEY = { H: 'brass.x@hook', W: 'lwood.y@bar', C: 'red.r@cape', c: 'red:1', g: 'gold:4', G: 'gold.R@clasp', s: 'cream:5' };
const SWING = [-14, -8, 0, 8, 14, 8, 0, -8];
frames('tool_dress', SWING.length, DRESS_KEY, (g, f) => {
  const a = SWING[f] * D2R, P = [11, 4];
  const R = (x, y) => rot(x, y, P[0], P[1], a);
  const cape = [[4.5, 11], [17.5, 11], [19.5, 20.5], [16, 21.4], [11, 20.6], [6, 21.4], [2.5, 20.5]].map(([x, y]) => R(x, y));
  g.poly(cape, 'C');
  for (const [x, y] of [[4, 20], [6, 20.4], [8, 20], [10, 19.6], [12, 19.6], [14, 20], [16, 20.4], [18, 20]]) { const q = R(x, y); g.set(q[0], q[1], 'g'); }
  for (const [x, y] of [[7, 14], [7, 16], [15, 14], [15, 16]]) { const q = R(x, y); g.set(q[0], q[1], 'c'); }
  g.poly([R(8, 11), R(11, 11), R(11, 13.6)], 's'); g.poly([R(11, 11), R(14, 11), R(11, 13.6)], 's');
  for (const y of [15, 18]) { const b = R(11, y); g.set(b[0], b[1], 'G'); }
  const s1 = R(11, 5.4), l = R(2.5, 11), r = R(19.5, 11);
  bar(g, s1[0], s1[1], l[0], l[1], 0.9, 'W'); bar(g, s1[0], s1[1], r[0], r[1], 0.9, 'W');
  bar(g, l[0], l[1], r[0], r[1], 0.8, 'W');
  // hook (fixed)
  g.set(11, 4, 'H').set(11, 3, 'H').set(12, 2, 'H').set(12, 1, 'H').set(11, 0, 'H').set(10, 0, 'H').set(9, 1, 'H');
}, 22, 22);

// Quests: a clipboard; the last box gets ticked with a flourish
const QUEST_KEY = { B: 'wood.f@board', P: 'parch.s@paper', p: 'parch:1', C: 'brass.R@clip', c: 'brass:1', q: 'wood:1', V: 'green.r@tick', l: 'tan:2', '*': '#ffffff!', y: '#ffe478!' };
frames('tool_quest', 5, QUEST_KEY, (g, f) => {
  g.rect(3, 3, 16, 19, 'B');
  g.rect(5, 5, 12, 15, 'P');
  g.line(5, 19, 16, 19, 'p');
  g.rect(8, 1, 6, 4, 'C'); g.rect(10, 1, 2, 1, 'c');
  for (const y of [7, 11, 15]) { g.rect(6, y, 3, 3, 'q'); g.set(7, y + 1, 'P'); g.line(10, y + 1, 15, y + 1, 'l'); }
  const tick = (y, n) => { const pts = [[6, y + 1], [7, y + 2], [8, y + 1], [9, y], [10, y - 1], [11, y - 2]]; pts.slice(0, n).forEach(([x, yy]) => g.set(x, yy, 'V')); };
  tick(7, 6); tick(11, 6);
  const n = [0, 3, 6, 6, 6][f];
  tick(15, n);
  if (f === 3) { g.set(12, 12, '*').set(13, 11, 'y').set(12, 10, 'y').set(14, 12, '*'); }
}, 22, 22);

// Map: unfolds, shows the dotted trail and the X, folds up again
const MAP_KEY = { T: 'straw:2', M: 'parch.s@a', m: 'parch:2', n: 'parch:4', L: 'leaf:4', w: 'water:4', r: 'red:3', X: 'red.s@x', R: 'red:2', '*': '#ffffff!' };
frames('tool_map', 4, MAP_KEY, (g, f) => {
  if (f === 0) {
    g.rect(6, 6, 10, 11, 'M'); g.rect(6, 6, 3, 11, 'n'); g.line(9, 6, 9, 16, 'm');
    g.ellipse(12.5, 10, 2, 2, 'L'); g.set(11, 13, 'r').set(13, 14, 'r');
    g.line(6, 11, 15, 11, 'T');
    return;
  }
  if (f === 1) {
    g.poly([[3, 6], [10, 5], [10, 17], [3, 18]], 'n'); g.poly([[10, 5], [18, 6], [18, 18], [10, 17]], 'm');
    g.ellipse(6, 10, 2, 2, 'L'); g.line(12, 9, 16, 13, 'w');
    g.set(14, 14, 'r').set(16, 15, 'r');
    return;
  }
  g.poly([[1, 5], [7.5, 3.5], [7.5, 17.5], [1, 19]], 'n');
  g.poly([[7.5, 3.5], [14.5, 5], [14.5, 19], [7.5, 17.5]], 'm');
  g.poly([[14.5, 5], [21, 3.5], [21, 17.5], [14.5, 19]], 'n');
  g.ellipse(4.5, 9, 2.2, 2.6, 'L'); g.ellipse(11, 14, 2.4, 1.8, 'L'); g.ellipse(18, 15, 2, 1.6, 'L');
  g.line(8, 6, 12, 10, 'w'); g.line(12, 10, 13, 13, 'w');
  [[3, 15], [5, 14], [7, 13], [9, 11], [11, 10], [13, 9]].forEach(([x, y]) => g.set(x, y, 'r'));
  g.set(16, 8, 'X').set(18, 8, 'X').set(17, 9, 'X').set(16, 10, 'X').set(18, 10, 'X');
  if (f === 3) g.set(19, 6, '*').set(15, 6, '*').set(20, 11, '*');
}, 22, 22);

// Settings: a steel gear with a brass hub, turning
const GEAR_KEY = { S: 'steel.R@gear', B: 'brass.R@hub', k: 'line' };
frames('tool_gear', 4, GEAR_KEY, (g, f) => {
  const c = 10.5, th = (f * 11.25) * D2R;
  for (let k = 0; k < 8; k++) {
    const a = th + (k * Math.PI) / 4;
    const P = (r, d) => [c + Math.cos(a + d) * r, c + Math.sin(a + d) * r];
    g.poly([P(6.6, -0.32), P(10.3, -0.2), P(10.3, 0.2), P(6.6, 0.32)], 'S');
  }
  g.ellipse(c, c, 7.6, 7.6, 'S');
  for (let k = 0; k < 4; k++) { const a = th + Math.PI / 4 + (k * Math.PI) / 2; g.set(c + Math.cos(a) * 5 - 0.5, c + Math.sin(a) * 5 - 0.5, 'k'); }
  g.ellipse(c, c, 3.4, 3.4, 'B');
  g.ellipse(c, c, 1.5, 1.5, '.');
}, 21, 21);

// =====================================================================================
// HUD pieces
// =====================================================================================
// rune medallion behind the level number: brass rim, etched runes that light in turn
const RUNE_KEY = { B: 'brass.R@rim', b: 'brass:1', D: 'purple:0', P: 'purple.r@core', r: 'lilac:1', R: '#9ff4ff', w: '#e8fcff' };
const RUNES = [['#.#', '.#.', '#.#'], ['##', '#.', '##'], ['.#', '##', '.#'], ['#.', '##', '#.'], ['###', '.#.'], ['#.#', '###'], ['.#.', '###'], ['##', '.#', '##']];
frames('hud_rune', 8, RUNE_KEY, (g, f) => {
  g.ellipse(12, 12, 11.6, 11.6, 'B');
  g.ellipse(12, 12, 9.6, 9.6, 'D');
  g.ellipse(12, 12, 6.6, 6.6, 'P');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2, x = Math.round(12 + Math.cos(a) * 8.1 - 1), y = Math.round(12 + Math.sin(a) * 8.1 - 1);
    const lit = i === f || i === (f + 4) % 8;
    glyph(g, x, y, RUNES[i].map((r) => r.slice(0, 2)), lit ? 'R' : 'r');
  }
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.set(12 + Math.cos(a) * 10.8 - 0.5, 12 + Math.sin(a) * 10.8 - 0.5, i % 2 ? 'b' : 'B'); }
  g.set(7, 6, 'w').set(6, 7, 'w');
}, 24, 24);

// round gold frame for Pip's portrait on the name sign (transparent middle)
icon('hud_ring', { G: 'gold.R@ring', g: 'gold:1', y: 'gold:5', B: 'brass.R@bolt' }, () => {
  const g = new Grid(32, 32);
  g.ellipse(16, 16, 15.6, 15.6, 'G');
  g.ellipse(16, 16, 12.8, 12.8, '.');
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.set(16 + Math.cos(a) * 14.2 - 0.5, 16 + Math.sin(a) * 14.2 - 0.5, i % 3 === 0 ? 'g' : 'G'); }
  for (const a of [0.25, 0.75, 1.25, 1.75]) g.ellipse(16 + Math.cos(a * Math.PI) * 14.2, 16 + Math.sin(a * Math.PI) * 14.2, 1.4, 1.4, 'B');
  g.set(6, 8, 'y').set(7, 7, 'y').set(8, 6, 'y');
  return g.rows();
}, { ol: 'sel' });

// brass "+" knob on the currency signs (and its pressed state)
for (const [name, dn] of [['hud_plus', 0], ['hud_plus_dn', 1]]) {
  icon(name, { B: dn ? 'brass.r@k' : 'brass.R@k', V: dn ? 'green:2' : 'green.r@p', v: 'green:5' }, () => {
    const g = new Grid(14, 14);
    g.ellipse(7, 7 + dn, 6.4, 6.4 - dn, 'B');
    g.rect(6, 3 + dn, 2, 8, 'V'); g.rect(3, 6 + dn, 8, 2, 'V');
    if (!dn) g.set(6, 3, 'v').set(3, 6, 'v');
    return g.rows();
  });
}
// red wax seal for the quest badge
icon('hud_seal', { R: 'red.R@wax', r: 'red:1' }, () => {
  const g = new Grid(14, 14);
  g.ellipse(7, 7, 6, 6, 'R');
  for (const [x, y] of [[1, 4], [12, 5], [3, 12], [11, 11], [7, 0], [0, 8], [13, 9]]) g.ellipse(x + 0.5, y + 0.5, 1.2, 1.2, 'R');
  g.ellipse(7, 7, 3.6, 3.6, 'r');
  g.ellipse(7, 7, 2.8, 2.8, 'R');
  return g.rows();
});
// "NEW" ribbon for the shop tag
icon('hud_new', { R: 'red.y@rib', r: 'red:1', W: '#fff6dc', y: 'gold:4' }, () => {
  const g = new Grid(22, 9);
  g.rect(1, 1, 20, 7, 'R');
  g.set(0, 1, 'R').set(0, 7, 'R').set(1, 4, '.').set(0, 4, '.').set(21, 1, 'R').set(21, 7, 'R').set(20, 4, '.').set(21, 4, '.');
  g.line(2, 1, 19, 1, 'y');
  const L = { N: ['#..#', '##.#', '#.##', '#..#', '#..#'], E: ['###', '#..', '##.', '#..', '###'], W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'] };
  let x = 4;
  for (const ch of 'NEW') { glyph(g, x, 2, L[ch], 'W'); x += L[ch][0].length + 1; }
  return g.rows();
});

// =====================================================================================
// UI PARTICLES (small frame sets drawn by uifx.ts)
// =====================================================================================
const PUFF_KEY = { W: '#fffaf0!', w: '#efe2c8!', s: '#d6c4a6!' };
frames('fx_puff', 6, PUFF_KEY, (g, f) => {
  const r = 2.2 + f * 0.75, holes = f >= 3;
  const blobs = [[6, 6.5, 1], [4.2 + (f > 1 ? -0.5 : 0), 7.4, 0.8], [7.8 + (f > 1 ? 0.5 : 0), 7.2, 0.85], [6, 4.6 - f * 0.2, 0.7]];
  for (const [x, y, k] of blobs) g.ellipse(x, y, r * k, r * k * 0.9, 'W');
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
    if (g.get(x, y) !== 'W') continue;
    if (g.get(x, y + 1) === '.' || g.get(x + 1, y) === '.') g.set(x, y, 's');
    else if (y > 6.5 && (x + y) % 2) g.set(x, y, 'w');
    if (holes && ((x * 7 + y * 3 + f) % (9 - f)) === 0) g.set(x, y, '.');
  }
}, 13, 13);
const SPARK_KEY = { W: '#ffffff!', Y: '#ffe98a!', y: '#ffbf3f!' };
frames('fx_spark', 4, SPARK_KEY, (g, f) => {
  const c = 3;
  if (f === 0) { g.set(c, c, 'W').set(c - 1, c, 'Y').set(c + 1, c, 'Y').set(c, c - 1, 'Y').set(c, c + 1, 'Y'); return; }
  const L = f === 1 ? 3 : f === 2 ? 2 : 1;
  for (let i = 1; i <= L; i++) { const ch = i === L ? 'y' : 'Y'; g.set(c + i, c, ch).set(c - i, c, ch).set(c, c + i, ch).set(c, c - i, ch); }
  if (f === 1) g.set(c + 1, c + 1, 'Y').set(c - 1, c - 1, 'Y').set(c + 1, c - 1, 'Y').set(c - 1, c + 1, 'Y');
  g.set(c, c, 'W');
}, 7, 7);
frames('fx_heart', 2, { H: 'rose.R@h', w: '#ffe0ea' }, (g, f) => {
  if (f === 0) { g.rect(1, 1, 2, 1, 'H').rect(4, 1, 2, 1, 'H').rect(0, 2, 7, 2, 'H').rect(1, 4, 5, 1, 'H').rect(2, 5, 3, 1, 'H').set(3, 6, 'H').set(1, 2, 'w'); }
  else { g.rect(1, 2, 2, 1, 'H').rect(4, 2, 2, 1, 'H').rect(0, 3, 7, 1, 'H').rect(1, 4, 5, 1, 'H').rect(2, 5, 3, 1, 'H').set(3, 6, 'H').set(1, 3, 'w'); }
}, 7, 7);
// spinning acorn (the everyday currency)
const ACORN_KEY = { C: 'wood.R@cap', c: 'wood:1', N: 'honey.R@nut', n: 'honey:5', S: 'dwood.s@stem' };
frames('fx_acorn', 4, ACORN_KEY, (g, f) => {
  const w = [3.6, 2.6, 1.2, 2.6][f];
  g.ellipse(4.5, 6.2, w * 0.86, 3, 'N');
  g.ellipse(4.5, 3.6, w, 1.7, 'C');
  g.rect(4, 0, 1, 2, 'S');
  if (f !== 2) g.set(f === 3 ? 5 : 3, 6, 'n');
  if (w > 2) g.set(3, 3, 'c').set(5, 3, 'c');
}, 9, 10);
const STAR_KEY = { Y: 'yellow.R@st', y: 'yellow:5' };
frames('fx_star', 3, STAR_KEY, (g, f) => {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5 + f * 0.2, r = i % 2 ? 1.6 : 3.8; pts.push([4 + Math.cos(a) * r, 4.2 + Math.sin(a) * r]); }
  g.poly(pts, 'Y');
  g.set(3, 3, 'y');
}, 8, 8);
frames('fx_snow', 2, { W: '#ffffff!', b: '#bfe6ff!' }, (g, f) => {
  if (f === 0) { g.set(2, 0, 'b').set(2, 1, 'W').set(0, 2, 'b').set(1, 2, 'W').set(2, 2, 'W').set(3, 2, 'W').set(4, 2, 'b').set(2, 3, 'W').set(2, 4, 'b'); }
  else { g.set(0, 0, 'b').set(4, 0, 'b').set(1, 1, 'W').set(3, 1, 'W').set(2, 2, 'W').set(1, 3, 'W').set(3, 3, 'W').set(0, 4, 'b').set(4, 4, 'b'); }
}, 5, 5);
for (const [base, ramp] of [['fx_leaf', 'leaf'], ['fx_leafo', 'orange'], ['fx_leafr', 'red']]) {
  frames(base, 4, { L: `${ramp}.r@lf`, V: `${ramp}:1` }, (g, f) => {
    const a = f * (Math.PI / 4) + 0.4, P = (x, y) => rot(x, y, 4, 4, a);
    g.poly([P(0.5, 4), P(3, 1.6), P(7.5, 4), P(3, 6.4)], 'L');
    const s = P(1, 4), e = P(6.5, 4); g.line(s[0], s[1], e[0], e[1], 'V');
  }, 8, 8);
}

// =====================================================================================
// TRANSITION PIECES
// =====================================================================================
for (const [base, ramp] of [['tr_leaf', 'leaf'], ['tr_leafo', 'orange'], ['tr_leafy', 'yellow'], ['tr_leafr', 'red']]) {
  frames(base, 4, { L: `${ramp}.r@lf`, V: `${ramp}:1`, v: `${ramp}:5` }, (g, f) => {
    const a = f * (Math.PI / 4) - 0.3, P = (x, y) => rot(x, y, 6.5, 6.5, a);
    g.poly([P(0.5, 6.5), P(3, 3), P(6.5, 1.6), P(10, 3.4), P(12.5, 6.5), P(10, 9.6), P(6.5, 11.4), P(3, 10)], 'L');
    const s = P(0, 6.5), e = P(11.5, 6.5); g.line(s[0], s[1], e[0], e[1], 'V');
    for (const t of [3.5, 6.5, 9]) { const q = P(t + 1.3, 4.6), r = P(t, 6.5); g.line(q[0], q[1], r[0], r[1], 'V'); }
    const h = P(4.5, 4.2); g.set(h[0], h[1], 'v');
  }, 13, 13);
}
frames('tr_flake', 2, { W: '#ffffff!', b: '#cdeeff!', B: '#8fc8f0!' }, (g, f) => {
  const c = 4;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + f * (Math.PI / 6);
    for (let r = 1; r <= 4; r++) g.set(c + Math.cos(a) * r, c + Math.sin(a) * r, r === 4 ? 'b' : 'W');
    g.set(c + Math.cos(a + 0.5) * 3, c + Math.sin(a + 0.5) * 3, 'B');
  }
  g.set(c, c, 'W');
}, 9, 9);
icon('tr_moon', { M: 'yellow.R@moon', m: 'yellow:5', c: 'yellow:2' }, () => {
  const g = new Grid(26, 26);
  g.ellipse(13, 13, 11, 11, 'M');
  g.ellipse(18, 9, 9.4, 9.4, '.');
  g.ellipse(6, 15, 1.4, 1.4, 'c'); g.ellipse(9, 20, 1, 1, 'c');
  g.set(4, 10, 'm').set(4, 11, 'm').set(5, 8, 'm');
  return g.rows();
});
