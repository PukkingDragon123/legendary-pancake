// Pixel icons for Pip's dressing room (tabs, hangers, the fitting mirror, the wallpaper), drawn with the BME sprite
// kit in Hoot Hollow's calm "Moss & Moonlight" colours (src/gfx/palette.ts): a feather, glasses, a scarf, a jumper,
// a cape, a mirror, a wooden hanger, a gilt mirror frame and a sprigged wallpaper tile. No owl drawings: the owl in
// the dressing room is always a render of the 3D toy.
import { Grid, icon } from './sprites.js';

icon('wd_feather', { F: '#c9b78d', f: '#eae0c8', D: '#6f553d', S: '#f4eedd', s: '#9c7a56' }, () => {
  const g = new Grid(20, 20);
  g.poly([[15.5, 1.5], [18, 4], [9, 14], [5, 15], [6, 11]], 'F');
  for (let i = 0; i < 4; i++) g.line(13 - i * 2.2, 3.5 + i * 2.2, 15.8 - i * 2.2, 6.2 + i * 2.2, 'D');
  g.line(16.6, 2.6, 4, 16, 'S');
  g.line(4, 16, 2, 18, 's');
  g.set(15, 3, 'f').set(14, 4, 'f').set(12, 7, 'f').set(9, 10, 'f');
  return g.rows();
});

icon('wd_glasses', { R: 'brass.R@rim', G: '#d3e0dc', g: '#aec8cc', w: '#f5f7f2' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(5.5, 10.5, 4.3, 4.3, 'R'); g.ellipse(14.5, 10.5, 4.3, 4.3, 'R');
  g.ellipse(5.5, 10.5, 2.9, 2.9, 'G'); g.ellipse(14.5, 10.5, 2.9, 2.9, 'G');
  g.rect(4, 11, 3, 2, 'g'); g.rect(13, 11, 3, 2, 'g');
  g.rect(9, 9, 2, 1, 'R');
  g.set(4, 9, 'w').set(13, 9, 'w').set(5, 8, 'w').set(14, 8, 'w');
  return g.rows();
});

icon('wd_scarf', { R: '#b2504a', r: '#8a3c3a', Y: '#f4eedd', T: '#b2504a', t: '#eae0c8' }, () => {
  const g = new Grid(20, 20);
  g.rect(2, 4, 16, 5, 'R');
  for (let x = 3; x < 18; x += 3) g.set(x, 5, 'r').set(x + 1, 7, 'r');
  g.rect(2, 6, 16, 1, 'Y');
  g.rect(11, 8, 4, 8, 'T');
  g.rect(11, 11, 4, 1, 'Y');
  g.rect(11, 14, 4, 1, 'Y');
  for (let x = 11; x < 15; x += 1) g.set(x, 16, x % 2 ? 't' : 'T');
  g.set(11, 17, 't').set(13, 17, 't');
  return g.rows();
});

icon('wd_sweater', { B: '#617f8c', b: '#46596a', C: '#eae0c8', M: '#f1d39a', m: '#c59a52' }, () => {
  const g = new Grid(20, 20);
  g.poly([[6, 3], [14, 3], [19, 7], [17, 10], [15, 9], [15, 17], [5, 17], [5, 9], [3, 10], [1, 7]], 'B');
  g.rect(5, 16, 10, 2, 'C');
  g.rect(7, 2, 6, 2, 'C');
  g.ellipse(10, 10, 2.6, 2.6, 'M');
  g.ellipse(11.3, 9.2, 2.2, 2.2, 'B');
  g.set(8, 11, 'm').set(9, 12, 'm');
  for (let y = 5; y < 16; y += 2) g.set(5, y, 'b').set(14, y, 'b');
  return g.rows();
});

icon('wd_cape', { C: '#6e5266', c: '#4f3a4a', G: 'brass.R@clasp', L: '#b4a9c9', s: '#f5f7f2' }, () => {
  const g = new Grid(20, 20);
  g.poly([[7, 2], [13, 2], [17, 17], [3, 17]], 'C');
  g.poly([[9, 4], [11, 4], [13, 16], [7, 16]], 'L');
  g.rect(3, 17, 14, 1, 'c');
  g.set(5, 12, 's').set(15, 10, 's').set(6, 7, 's');
  g.ellipse(10, 3.5, 1.8, 1.8, 'G');
  return g.rows();
});

icon('wd_mirror', { F: 'brass.R@frame', M: '#d3e0dc', m: '#aec8cc', w: '#f5f7f2', W: '#6f553d' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 8.5, 6.8, 7.8, 'F');
  g.ellipse(10, 8.5, 5.2, 6.2, 'M');
  g.rect(8, 10, 5, 3, 'm');
  g.line(7, 5, 9, 3, 'w').line(7, 7, 8, 6, 'w');
  g.rect(9, 16, 2, 2, 'W');
  g.rect(6, 18, 8, 1, 'W');
  return g.rows();
});

icon('wd_lockgem', { L: 'steel.R@body', S: 'steel.x@shackle', K: '#2e2b24' }, () => {
  const g = new Grid(20, 20);
  g.rect(7, 3, 6, 2, 'S'); g.rect(6, 4, 2, 6, 'S'); g.rect(12, 4, 2, 6, 'S');
  g.rect(4, 9, 12, 9, 'L');
  g.rect(9, 12, 2, 3, 'K');
  return g.rows();
});

// a little wooden coat hanger with a brass hook (hangs every garment card from the rail)
icon('wd_hanger', { H: 'brass.R@hook', h: '#8e7440', W: '#9c7a56', w: '#bf9d74', d: '#6f553d' }, () => {
  const g = new Grid(24, 12);
  g.line(12, 0, 12, 2, 'H');
  g.set(13, 0, 'H').set(14, 1, 'H').set(11, 0, 'h');
  g.set(12, 3, 'h');
  g.poly([[12, 3], [22, 9], [22, 10], [2, 10], [2, 9]], 'W');
  g.line(4, 9, 20, 9, 'w');
  g.line(2, 10, 22, 10, 'd');
  return g.rows();
});

// the fitting mirror's gilt frame: a stepped pixel oval ring with leaf scrolls (the portrait shows through)
icon('wd_frame', { F: 'brass.R@frame', f: '#8e7440', L: '#86a06a', l: '#557343', s: '#f6e6ac' }, () => {
  const n = 38, g = new Grid(n, n), c = (n - 1) / 2;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const d = Math.hypot((x - c) / 17.6, (y - c) / 18.4);
    if (d <= 1 && d > 0.86) g.set(x, y, d > 0.95 || d < 0.89 ? 'f' : 'F');
  }
  for (const a of [0.6, 2.2, 3.9, 5.4]) g.set(Math.round(c + Math.cos(a) * 16.2), Math.round(c + Math.sin(a) * 17), 's');
  // a sprig of moss leaves at the top and a curl at the bottom
  g.poly([[15, 1], [19, 3], [23, 1], [19, 5]], 'L');
  g.set(17, 2, 'l').set(21, 2, 'l');
  g.poly([[16, 35], [19, 37], [22, 35], [19, 34]], 'L');
  return g.rows();
});

// the dressing room's wallpaper: oat paper with sage stripes and tiny sprigs (tiles seamlessly)
icon('wd_paper', { p: '#eae0c8', P: '#e2d6ba', s: '#c4cfa3', S: '#a7b788', d: '#86a06a', b: '#d9aca4' }, () => {
  const g = new Grid(16, 16);
  g.rect(0, 0, 16, 16, 'p');
  g.rect(0, 0, 1, 16, 's'); g.rect(8, 0, 1, 16, 'P');
  g.set(4, 3, 'd').set(3, 4, 'S').set(5, 4, 'S').set(4, 5, 'd').set(4, 6, 'S');
  g.set(12, 11, 'd').set(11, 12, 'S').set(13, 12, 'S').set(12, 13, 'b').set(12, 14, 'S');
  return g.rows();
});
