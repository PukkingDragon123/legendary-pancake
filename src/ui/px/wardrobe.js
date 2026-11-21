// Pixel icons for Pip's dressing room (tabs and plaques), drawn with the BME sprite kit so they sit
// in the same set as everything else: a feather, glasses, a scarf, a jumper, a cape, a mirror.
import { Grid, icon } from './sprites.js';

icon('wd_feather', { F: 'tan.x@vane', f: 'tan:5', D: 'wood:2@bar', S: 'cream.x@shaft' }, () => {
  const g = new Grid(20, 20);
  g.poly([[15.5, 1.5], [18, 4], [9, 14], [5, 15], [6, 11]], 'F');
  for (let i = 0; i < 4; i++) g.line(13 - i * 2.2, 3.5 + i * 2.2, 15.8 - i * 2.2, 6.2 + i * 2.2, 'D');
  g.line(16.6, 2.6, 4, 16, 'S');
  g.line(4, 16, 2, 18, 'S');
  g.set(15, 3, 'f').set(14, 4, 'f');
  return g.rows();
});

icon('wd_glasses', { R: 'gold.R@rim', G: 'glass.R@lens', w: '#ffffff' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(5.5, 10.5, 4.3, 4.3, 'R'); g.ellipse(14.5, 10.5, 4.3, 4.3, 'R');
  g.ellipse(5.5, 10.5, 2.9, 2.9, 'G'); g.ellipse(14.5, 10.5, 2.9, 2.9, 'G');
  g.rect(9, 9, 2, 1, 'R');
  g.set(4, 9, 'w').set(13, 9, 'w').set(5, 8, 'w').set(14, 8, 'w');
  return g.rows();
});

icon('wd_scarf', { R: 'red.y@knit', r: 'red:2', Y: 'yellow.y@band', T: 'red.x@tail', t: 'yellow:4' }, () => {
  const g = new Grid(20, 20);
  g.rect(2, 4, 16, 5, 'R');
  for (let x = 3; x < 18; x += 3) g.set(x, 6, 'r');
  g.rect(2, 6, 16, 1, 'Y');
  g.rect(11, 8, 4, 8, 'T');
  g.rect(11, 11, 4, 1, 'Y');
  for (let x = 11; x < 15; x += 1) g.set(x, 16, x % 2 ? 't' : 'T');
  g.set(11, 17, 't').set(13, 17, 't');
  return g.rows();
});

icon('wd_sweater', { B: 'blue.y@knit', b: 'blue:2', C: 'cream.y@cuff', M: 'yellow.R@moon' }, () => {
  const g = new Grid(20, 20);
  g.poly([[6, 3], [14, 3], [19, 7], [17, 10], [15, 9], [15, 17], [5, 17], [5, 9], [3, 10], [1, 7]], 'B');
  g.rect(5, 16, 10, 2, 'C');
  g.rect(7, 2, 6, 2, 'C');
  g.ellipse(10, 10, 2.6, 2.6, 'M');
  g.ellipse(11.3, 9.2, 2.2, 2.2, 'B');
  for (let y = 5; y < 16; y += 2) g.set(5, y, 'b').set(14, y, 'b');
  return g.rows();
});

icon('wd_cape', { C: 'plum.x@cape', c: 'plum:5', G: 'gold.R@clasp', L: 'lilac.x@lining' }, () => {
  const g = new Grid(20, 20);
  g.poly([[7, 2], [13, 2], [17, 17], [3, 17]], 'C');
  g.poly([[9, 4], [11, 4], [13, 16], [7, 16]], 'L');
  g.rect(3, 17, 14, 1, 'c');
  g.ellipse(10, 3.5, 1.8, 1.8, 'G');
  return g.rows();
});

icon('wd_mirror', { F: 'gold.R@frame', M: 'ice.r@glass', w: '#ffffff', W: 'wood.y@stand' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 8.5, 6.8, 7.8, 'F');
  g.ellipse(10, 8.5, 5.2, 6.2, 'M');
  g.line(7, 5, 9, 3, 'w').line(7, 7, 8, 6, 'w');
  g.rect(9, 16, 2, 2, 'W');
  g.rect(6, 18, 8, 1, 'W');
  return g.rows();
});

icon('wd_lockgem', { L: 'steel.R@body', S: 'steel.x@shackle', K: '#2a1a14' }, () => {
  const g = new Grid(20, 20);
  g.rect(7, 3, 6, 2, 'S'); g.rect(6, 4, 2, 6, 'S'); g.rect(12, 4, 2, 6, 'S');
  g.rect(4, 9, 12, 9, 'L');
  g.rect(9, 12, 2, 3, 'K');
  return g.rows();
});
