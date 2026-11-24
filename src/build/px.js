// Pixel icons for build mode's blueprint drawer, drawn with the BME sprite kit (20x20 grids keyed to
// hue-shifted material ramps; the kit shades and outlines them). Names start with bp_.
import { Grid, icon, RAMPS } from '../ui/px/sprites.js';

// calm "Moss & Moonlight" ramps (src/gfx/palette.ts) for the build icons, dark to light
Object.assign(RAMPS, {
  hhhoney: ['#5e4428', '#8e6a3c', '#b88c52', '#dcb072', '#ecd09a', '#f8ecc8'],
  hhrose: ['#5a3438', '#80505a', '#a87478', '#d9aca4', '#e8c8c0', '#f6e6e0'],
  hhplum: ['#2e2430', '#4a3a4a', '#6e5266', '#8e7488', '#b4a0b0', '#dcd0d8'],
  hhmist: ['#34464e', '#4e6670', '#6e8a92', '#aec8cc', '#d3e0dc', '#eef4f0'],
  hhdusk: ['#1f2a34', '#2e3e4c', '#46596a', '#617f8c', '#86a9b0', '#bcd0d0'],
  hhterra: ['#4a2a20', '#704030', '#9a5c46', '#c0866a', '#dcaa8e', '#f0d4bc'],
  hhberry: ['#3a2028', '#5a3038', '#7e4650', '#9e5f66', '#c08088', '#e0b0b4'],
  hhleaf: ['#1e2c20', '#2c4030', '#3f5a3b', '#557343', '#86a06a', '#c4cfa3'],
  hhslate: ['#151b22', '#1f2830', '#2e3a46', '#46596a', '#617f8c', '#8ea6b0'],
  hhlake: ['#24343c', '#365058', '#4e7078', '#86a9b0', '#aec8cc', '#dfe9ea'],
});

// a nest bed with a patchwork quilt and pillow
icon('bp_bed', { T: 'wood.R@nest', t: 'wood:1', Q: 'hhrose.R@quilt', q: 'cream:4', B: 'hhmist.r@q2', P: 'bone.R@pil' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 13, 9, 4.6, 'T');
  g.rect(3, 9, 14, 4, 'Q');
  g.rect(3, 9, 4, 2, 'B').rect(11, 9, 4, 2, 'B').rect(7, 11, 4, 2, 'B');
  g.ellipse(6, 8.6, 3, 1.8, 'P');
  for (let x = 2; x < 18; x += 3) g.set(x, 14, 't').set(x + 1, 16, 't');
  return g.rows();
});
// a squashy armchair
icon('bp_chair', { V: 'hhplum.R@seat', v: 'hhplum:1', Y: 'hhhoney.r@cush', L: 'dwood.x@leg' }, () => {
  const g = new Grid(20, 20);
  g.rect(4, 3, 12, 9, 'V');
  g.rect(2, 8, 4, 8, 'V').rect(14, 8, 4, 8, 'V');
  g.rect(5, 11, 10, 5, 'V');
  g.ellipse(10, 8, 2.6, 2.2, 'Y');
  g.line(6, 4, 6, 10, 'v').line(14, 4, 14, 10, 'v');
  g.rect(3, 16, 2, 2, 'L').rect(15, 16, 2, 2, 'L');
  return g.rows();
});
// a round side table with a cup
icon('bp_table', { W: 'lwood.y@top', w: 'lwood:2', L: 'wood.x@leg', C: 'bone.r@cup', T: 'hhberry:3' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 9, 8.4, 2.8, 'W');
  g.line(3, 10, 17, 10, 'w');
  g.rect(9, 11, 2, 6, 'L');
  g.rect(6, 17, 8, 1, 'L');
  g.rect(11, 4, 4, 4, 'C'); g.set(15, 5, 'C').set(15, 6, 'C'); g.rect(12, 4, 2, 1, 'T');
  return g.rows();
});
// a little chest of drawers
icon('bp_shelf', { W: 'wood.R@body', w: 'wood:1', D: 'lwood.f@dr', G: 'brass:4' }, () => {
  const g = new Grid(20, 20);
  g.rect(3, 3, 14, 15, 'W');
  for (const y of [5, 9, 13]) { g.rect(5, y, 10, 3, 'D'); g.set(9, y + 1, 'G').set(10, y + 1, 'G'); }
  g.rect(3, 18, 2, 1, 'w').rect(15, 18, 2, 1, 'w');
  return g.rows();
});
// a lamp with a warm shade and glow
icon('bp_lamp', { S: 'hhhoney.R@shade', s: 'hhhoney:5', B: 'brass.x@base', L: 'fire:5!' }, () => {
  const g = new Grid(20, 20);
  g.poly([[6, 3], [14, 3], [17, 10], [3, 10]], 'S');
  g.line(5, 9, 15, 9, 's');
  g.rect(9, 10, 2, 6, 'B');
  g.rect(6, 16, 8, 2, 'B');
  g.set(2, 5, 'L').set(18, 5, 'L').set(1, 9, 'L').set(19, 9, 'L');
  return g.rows();
});
// a vase of flowers
icon('bp_decor', { V: 'hhmist.R@vase', v: 'hhmist:1', F: 'hhrose.r@f1', f: 'hhhoney.r@f2', S: 'hhleaf.x@st' }, () => {
  const g = new Grid(20, 20);
  g.line(10, 6, 10, 11, 'S').line(7, 7, 9, 11, 'S').line(13, 7, 11, 11, 'S');
  g.ellipse(7, 5.5, 2.2, 2, 'F'); g.ellipse(13, 5.5, 2.2, 2, 'f'); g.ellipse(10, 3.4, 2.2, 2, 'F');
  g.ellipse(10, 14.5, 4.6, 4.4, 'V'); g.rect(8, 10, 4, 2, 'V');
  g.line(7, 14, 13, 14, 'v');
  return g.rows();
});
// a fern in a terracotta pot
icon('bp_plant', { L: 'hhleaf.R@lf', l: 'hhleaf:5', P: 'hhterra.R@pot', p: 'hhterra:1' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 7, 7, 5, 'L');
  g.ellipse(5, 9, 3.4, 2.2, 'L'); g.ellipse(15, 9, 3.4, 2.2, 'L');
  g.set(8, 5, 'l').set(12, 6, 'l').set(10, 3, 'l');
  g.poly([[5, 11], [15, 11], [13.5, 18], [6.5, 18]], 'P');
  g.rect(4, 11, 12, 2, 'P'); g.line(5, 13, 15, 13, 'p');
  return g.rows();
});
// a round woven rug, seen at an angle
icon('bp_rug', { B: 'hhdusk.R@rug', Y: 'hhhoney:4', C: 'cream:4', b: 'hhdusk:1' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 11, 9.4, 6, 'B');
  g.ellipse(10, 11, 7, 4.4, 'C');
  g.ellipse(10, 11, 5, 3, 'B');
  g.ellipse(9, 11, 2.6, 1.8, 'Y'); g.ellipse(10.2, 10.4, 2.2, 1.4, 'B');
  for (let x = 2; x < 19; x += 2) g.set(x, 17, 'b');
  return g.rows();
});
// a framed picture on a nail
icon('bp_wall', { F: 'brass.R@fr', S: 'hhmist.f@sky', H: 'hhleaf:3', M: 'hhhoney:5', N: 'iron:3' }, () => {
  const g = new Grid(20, 20);
  g.line(10, 2, 4, 6, 'N').line(10, 2, 16, 6, 'N');
  g.rect(2, 6, 16, 12, 'F');
  g.rect(4, 8, 12, 8, 'S');
  g.poly([[4, 16], [8, 11], [12, 15], [14, 13], [16, 16]], 'H');
  g.ellipse(13, 10, 1.6, 1.6, 'M');
  return g.rows();
});
// a goldfish bowl
icon('bp_fun', { G: 'glass.r@bowl', W: 'hhlake.r@w', O: 'hhterra.R@fish', o: 'hhterra:5', w: 'bone:5', S: 'sand:3' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 11, 8, 7.4, 'G');
  g.ellipse(10, 12.6, 7, 5.2, 'W');
  g.rect(5, 3, 10, 2, 'G');
  g.ellipse(10, 12, 3, 2, 'O'); g.set(13, 11, 'O').set(14, 10, 'O').set(14, 13, 'O').set(13, 12, 'o');
  g.set(8, 11, 'K');
  g.rect(5, 16, 10, 1, 'S');
  g.set(6, 8, 'w').set(7, 9, 'w').set(14, 6, 'w');
  return g.rows();
});
// a roll of wallpaper unrolling
icon('bp_wallpaper', { P: 'hhrose.f@paper', p: 'hhrose:2', R: 'cream.x@roll', r: 'cream:2' }, () => {
  const g = new Grid(20, 20);
  g.rect(3, 6, 10, 12, 'P');
  for (let y = 7; y < 18; y += 3) for (let x = 4; x < 13; x += 3) g.set(x + (y % 2), y, 'p');
  g.rect(2, 3, 16, 4, 'R');
  g.ellipse(17, 5, 1.6, 2, 'r');
  return g.rows();
});
// floor planks
icon('bp_floor', { W: 'lwood.f@pl', w: 'wood:1', D: 'wood.f@pl2' }, () => {
  const g = new Grid(20, 20);
  g.poly([[1, 18], [19, 18], [15, 4], [5, 4]], 'W');
  for (const [x0, x1] of [[5.5, 3], [8.5, 7.5], [11.5, 12.5], [14.5, 17]]) g.line(x0, 4, x1, 18, 'w');
  g.poly([[8.5, 4], [11.5, 4], [12.4, 9], [7.6, 9]], 'D');
  return g.rows();
});
// a gift with a ribbon (seasonal)
icon('bp_season', { B: 'hhberry.R@box', b: 'hhberry:1', R: 'brass.x@rib', S: 'bone:5' }, () => {
  const g = new Grid(20, 20);
  g.rect(3, 8, 14, 10, 'B');
  g.rect(2, 6, 16, 3, 'B');
  g.rect(9, 6, 2, 12, 'R'); g.rect(2, 7, 16, 1, 'R');
  g.ellipse(7, 4.4, 2.6, 1.8, 'R'); g.ellipse(13, 4.4, 2.6, 1.8, 'R');
  g.set(5, 11, 'S').set(14, 15, 'S').set(6, 15, 'S');
  return g.rows();
});
// a taped cardboard box (storage)
icon('bp_box', { C: 'tan.R@box', c: 'tan:1', T: 'straw:4', L: 'cream:5' }, () => {
  const g = new Grid(20, 20);
  g.rect(2, 7, 16, 11, 'C');
  g.poly([[2, 7], [18, 7], [15, 3], [5, 3]], 'C');
  g.line(2, 7, 18, 7, 'c');
  g.rect(9, 3, 2, 8, 'T');
  g.rect(5, 12, 7, 4, 'L');
  return g.rows();
});
// four-way move arrows
icon('bp_move', { A: 'hhmist.R@ar', a: 'hhmist:5' }, () => {
  const g = new Grid(20, 20);
  g.rect(9, 4, 2, 12, 'A'); g.rect(4, 9, 12, 2, 'A');
  g.poly([[10, 0.5], [14, 5], [6, 5]], 'A'); g.poly([[10, 19.5], [14, 15], [6, 15]], 'A');
  g.poly([[0.5, 10], [5, 6], [5, 14]], 'A'); g.poly([[19.5, 10], [15, 6], [15, 14]], 'A');
  g.set(10, 2, 'a').set(2, 10, 'a');
  return g.rows();
});
// a price tag with a plus (buy another)
icon('bp_buy', { T: 'hhhoney.R@tag', t: 'hhhoney:1', P: 'hhleaf.f@plus', S: 'straw:3' }, () => {
  const g = new Grid(20, 20);
  g.poly([[2, 10], [7, 4], [18, 4], [18, 16], [7, 16]], 'T');
  g.ellipse(6, 10, 1.2, 1.2, 'K');
  g.rect(11, 7, 2, 6, 'P'); g.rect(9, 9, 6, 2, 'P');
  g.line(1, 6, 5, 9, 'S');
  return g.rows();
});
// tilt: a grid seen from above vs at an angle
icon('bp_tilt', { B: 'hhmist.f@bp', b: 'bone:5', A: 'hhhoney.R@ar' }, () => {
  const g = new Grid(20, 20);
  g.poly([[1, 17], [19, 17], [15, 8], [5, 8]], 'B');
  g.line(10, 8, 10, 17, 'b').line(3, 12.5, 17, 12.5, 'b').line(7.5, 8, 5.5, 17, 'b').line(12.5, 8, 14.5, 17, 'b');
  g.poly([[10, 1], [14, 5], [6, 5]], 'A');
  g.rect(9, 4, 2, 3, 'A');
  return g.rows();
});
// an eye on a pinned blueprint (top-down view)
icon('bp_top', { B: 'hhmist.f@bp', b: 'bone:5', E: 'bone.r@eye', P: 'hhslate:2' }, () => {
  const g = new Grid(20, 20);
  g.rect(2, 2, 16, 16, 'B');
  for (let i = 5; i < 18; i += 4) { g.line(i, 2, i, 17, 'b'); g.line(2, i, 17, i, 'b'); }
  g.ellipse(10, 10, 5, 3, 'E'); g.ellipse(10, 10, 2, 2, 'P');
  return g.rows();
});
