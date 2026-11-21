// Pixel vignettes for the interview's answer cards, drawn with The Bear Must Eat's sprite kit
// (20x20 Grid drawings keyed to shaded material ramps, auto-outlined) so they sit with the rest of
// the icons. Names start with `ob_`.
import { Grid, icon } from '../ui/px/sprites.js';

// --- a little owl portrait per starter species
const OWLS = {
  tawny: { B: 'bear.R@body', b: 'bear:4', F: 'tan.r@face', E: '#2a1a14', K: 'honey.R@beak', C: 'cream.r@chest', t: 'bear:2' },
  barn: { B: 'honey.R@body', b: 'straw:4', F: 'white.r@face', E: '#2a1a14', K: 'skin.R@beak', C: 'white.r@chest', t: 'tan:3' },
  snowy: { B: 'white.R@body', b: 'stone:3', F: 'white.r@face', E: '#f2c414', K: 'iron.R@beak', C: 'white.r@chest', t: 'stone:2' },
  burrowing: { B: 'sand.R@body', b: 'cream:5', F: 'tan.r@face', E: '#f0c020', K: 'stone.R@beak', C: 'cream.r@chest', t: 'tan:2' },
  sawwhet: { B: 'cinnamon.R@body', b: 'cream:5', F: 'cream.r@face', E: '#f2c414', K: 'iron.R@beak', C: 'cream.r@chest', t: 'cinnamon:2' },
};
for (const [id, key] of Object.entries(OWLS)) {
  icon('ob_owl_' + id, { ...key, w: '#ffffff', p: '#2a1a14' }, () => {
    const g = new Grid(20, 20);
    const small = id === 'sawwhet', tall = id === 'burrowing';
    const top = small ? 4 : 2;
    g.ellipse(10, 13.5, small ? 6 : 6.6, tall ? 5.6 : 6.4, 'B');
    g.ellipse(10, 14.4, 3.6, 4.4, 'C');
    for (const y of [12, 14, 16]) for (const x of [8, 11]) g.set(x + (y % 4 ? 1 : 0), y, 't');
    g.ellipse(10, top + 5.6, small ? 7.6 : 7.2, small ? 5.8 : 5.4, 'B');
    if (id === 'barn') { g.poly([[3.5, top + 2], [10, top + 4.5], [16.5, top + 2], [15, top + 10], [10, top + 12], [5, top + 10]], 'F'); }
    else { g.ellipse(7.3, top + 6, 3.2, 3, 'F'); g.ellipse(12.7, top + 6, 3.2, 3, 'F'); }
    if (id === 'burrowing') { g.line(5, top + 3, 9, top + 4, 'b'); g.line(11, top + 4, 15, top + 3, 'b'); g.rect(7, 18, 1, 2, 't'); g.rect(12, 18, 1, 2, 't'); }
    if (id === 'snowy') for (const [x, y] of [[6, 11], [14, 12], [8, 9], [12, 16], [5, 14]]) g.set(x, y, 'b');
    if (id === 'sawwhet') for (const [x, y] of [[5, top + 2], [8, top + 1], [12, top + 1], [15, top + 2]]) g.set(x, y, 'b');
    if (id === 'tawny') { g.set(5, top + 1, 'B').set(15, top + 1, 'B'); }
    const ey = top + 6;
    g.rect(6, ey - 1, 2, 2, 'E'); g.rect(12, ey - 1, 2, 2, 'E');
    g.set(6, ey - 1, 'w'); g.set(12, ey - 1, 'w');
    g.rect(9, ey + 1, 2, 2, 'K'); g.set(9, ey + 3, 'K');
    g.rect(7, 19, 2, 1, 'K'); g.rect(11, 19, 2, 1, 'K');
    return g.rows();
  });
}

// --- goals and sleep habits

icon('ob_bed', { W: 'lwood.y@frame', P: 'white.r@pillow', Q: 'blue.y@quilt', q: 'sky:4', O: 'bear.R@owl', o: 'tan:4', E: '#2a1a14', Z: 'sky.r@z' }, () => {
  const g = new Grid(20, 20);
  g.rect(1, 9, 2, 9, 'W'); g.rect(17, 12, 2, 6, 'W'); g.rect(1, 15, 18, 2, 'W');
  g.ellipse(6.5, 11.5, 3.4, 2, 'P');
  g.ellipse(7, 9.6, 3, 2.8, 'O'); g.ellipse(6, 10, 1.1, 1, 'o'); g.ellipse(8.2, 10, 1.1, 1, 'o');
  g.set(6, 10, 'E'); g.set(8, 10, 'E');
  g.rect(4, 12, 14, 3, 'Q'); for (let x = 5; x < 18; x += 3) g.set(x, 13, 'q');
  g.rect(12, 3, 3, 1, 'Z'); g.set(13, 4, 'Z'); g.rect(12, 5, 3, 1, 'Z');
  g.rect(16, 1, 2, 1, 'Z'); g.set(16, 2, 'Z'); g.rect(16, 3, 2, 1, 'Z');
  return g.rows();
});

icon('ob_sheep', { S: 'white.R@wool', s: 'white:2', H: 'black.r@head', F: 'lwood.x@fence', f: 'lwood:2', G: 'leaf.y@grass', w: '#ffffff' }, () => {
  const g = new Grid(20, 20);
  g.rect(0, 18, 20, 2, 'G');
  g.rect(13, 9, 2, 9, 'F'); g.rect(10, 11, 9, 2, 'F'); g.rect(10, 15, 9, 1, 'f');
  g.ellipse(8, 7, 5, 3.4, 'S'); g.ellipse(5, 6, 2, 2, 'S'); g.ellipse(11, 6, 2.4, 2, 'S');
  g.ellipse(13.5, 5.5, 2, 2.2, 'H'); g.set(14, 5, 'w');
  g.line(5, 10, 3, 12, 'H'); g.line(10, 10, 12, 12, 'H');
  for (const [x, y] of [[2, 3], [1, 4]]) g.set(x, y, 's');
  return g.rows();
});

icon('ob_window_sun', { F: 'wood.R@frame', S: 'sky.y@sky', Y: 'yellow.R@sun', R: 'orange:4', H: 'leaf.y@hill' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 10, 9, 9, 'F');
  g.ellipse(10, 10, 7, 7, 'S');
  g.ellipse(10, 13, 3.4, 3.4, 'Y');
  g.ellipse(10, 18, 8, 3.6, 'H', 'SY');
  for (const [x, y] of [[5, 9], [15, 9], [10, 6], [7, 7], [13, 7]]) g.set(x, y, 'R');
  g.rect(9, 3, 2, 14, 'F', 'SYHR'); g.rect(3, 9, 14, 1, 'F');
  return g.rows();
});

icon('ob_clock_spin', { W: 'wood.R@frame', F: 'cream.r@face', K: '#2a1a14', A: 'sky.r@arc', g: 'gold.R@pin' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 10, 7.4, 7.4, 'W'); g.ellipse(10, 10, 5.6, 5.6, 'F');
  g.line(10, 10, 10, 6, 'K'); g.line(10, 10, 13, 12, 'K'); g.set(10, 10, 'g');
  for (const [x, y] of [[2, 4], [1, 6], [1, 8], [18, 12], [18, 14], [17, 16], [4, 1], [6, 0]]) g.set(x, y, 'A');
  return g.rows();
});

icon('ob_phone_drawer', { D: 'wood.y@drawer', d: 'wood:2', K: 'brass.R@knob', P: 'navy.f@phone', S: 'sky.r@screen', z: '#2a1a14' }, () => {
  const g = new Grid(20, 20);
  g.rect(6, 2, 7, 11, 'P'); g.rect(7, 3, 5, 8, 'S');
  g.rect(1, 9, 18, 9, 'D'); g.rect(2, 9, 16, 2, 'z');
  g.rect(1, 12, 18, 1, 'd'); g.rect(8, 14, 4, 2, 'K');
  return g.rows();
});

icon('ob_mic_waves', { M: 'steel.R@head', m: 'steel:1', B: 'brass.x@stand', A: 'sky.r@a', a: 'sky.r@b' }, () => {
  const g = new Grid(20, 20);
  g.rect(8, 2, 4, 8, 'M'); g.rect(7, 3, 6, 6, 'M'); for (const y of [4, 6, 8]) g.rect(8, y, 4, 1, 'm');
  g.rect(9, 10, 2, 6, 'B'); g.rect(6, 16, 8, 2, 'B');
  for (const y of [3, 4, 5, 6, 7]) { g.set(4, y + 1, 'A'); g.set(15, y + 1, 'A'); }
  for (const y of [3, 4, 5, 6, 7, 8, 9]) { g.set(1, y, 'a'); g.set(18, y, 'a'); }
  return g.rows();
});

icon('ob_mic_off', { M: 'steel.R@head', m: 'steel:1', B: 'brass.x@stand', R: 'red.x@x' }, () => {
  const g = new Grid(20, 20);
  g.rect(8, 2, 4, 8, 'M'); g.rect(7, 3, 6, 6, 'M'); for (const y of [4, 6, 8]) g.rect(8, y, 4, 1, 'm');
  g.rect(9, 10, 2, 6, 'B'); g.rect(6, 16, 8, 2, 'B');
  g.line(3, 3, 16, 16, 'R'); g.line(4, 3, 17, 16, 'R');
  return g.rows();
});

icon('ob_pillow_z', { P: 'white.R@pillow', p: 'white:2', Z: 'yellow.R@z' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 14, 8.6, 4.2, 'P'); g.line(4, 14, 16, 14, 'p');
  g.rect(6, 2, 8, 2, 'Z'); g.line(13, 4, 7, 8, 'Z'); g.line(12, 4, 6, 8, 'Z'); g.rect(6, 8, 8, 2, 'Z');
  return g.rows();
});

icon('ob_moon_zz', { M: 'yellow.r@moon', Z: 'sky.r@z', s: 'white:5' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(9, 11, 7, 7, 'M'); g.ellipse(12.4, 8.6, 6, 6, '.');
  g.rect(13, 12, 4, 1, 'Z'); g.set(15, 13, 'Z'); g.set(14, 14, 'Z'); g.rect(13, 15, 4, 1, 'Z');
  g.rect(15, 5, 3, 1, 'Z'); g.set(16, 6, 'Z'); g.rect(15, 7, 3, 1, 'Z');
  g.set(3, 3, 's'); g.set(18, 1, 's');
  return g.rows();
});

icon('ob_owl_awake', { N: 'navy.y@night', O: 'bear.R@owl', E: 'yellow.R@eye', K: '#2a1a14', s: 'white:5' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 11, 9, 8, 'N');
  g.ellipse(10, 12, 6, 6, 'O');
  g.ellipse(7.4, 10.5, 2.6, 2.6, 'E'); g.ellipse(12.6, 10.5, 2.6, 2.6, 'E');
  g.set(7, 10, 'K'); g.set(12, 10, 'K'); g.set(7, 11, 'K'); g.set(12, 11, 'K');
  g.set(3, 4, 's'); g.set(16, 3, 's'); g.set(17, 8, 's');
  return g.rows();
});

icon('ob_phone_ping', { P: 'navy.f@phone', S: 'sky.r@screen', Q: 'yellow.R@q', w: 'white:5' }, () => {
  const g = new Grid(20, 20);
  g.rect(6, 4, 8, 14, 'P'); g.rect(7, 5, 6, 11, 'S'); g.set(10, 17, 'w');
  g.rect(14, 1, 5, 5, 'Q'); g.set(16, 2, 'w'); g.set(16, 4, 'w');
  return g.rows();
});

icon('ob_phone_glow', { P: 'navy.f@phone', S: 'sky.R@screen', G: 'sky.r@glow', w: 'white:5' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 10, 9.4, 9.4, 'G');
  g.rect(6, 3, 8, 14, 'P'); g.rect(7, 4, 6, 11, 'S'); g.set(10, 16, 'w');
  return g.rows();
});

icon('ob_lark', { S: 'yellow.R@sun', R: 'orange:4', B: 'orange.R@bird', b: 'cream:5', K: '#2a1a14', T: 'leaf.y@twig' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(14, 6, 4.4, 4.4, 'S');
  for (const [x, y] of [[14, 0], [19, 6], [8, 6], [18, 2], [10, 2]]) g.set(x, y, 'R');
  g.line(0, 17, 12, 15, 'T');
  g.ellipse(6, 12, 3.6, 2.6, 'B'); g.ellipse(9, 10, 2, 2, 'B'); g.set(10, 10, 'K'); g.set(11, 11, 'b'); g.ellipse(5, 13, 2, 1.2, 'b');
  g.line(2, 11, 0, 10, 'B');
  return g.rows();
});

icon('ob_sun_moon', { S: 'yellow.R@sun', M: 'lilac.r@moon', R: 'orange:4' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 10, 7, 7, 'S');
  g.poly([[10, 2], [18, 2], [18, 18], [10, 18]], 'M', 'S');
  for (const [x, y] of [[1, 10], [3, 4], [3, 16]]) g.set(x, y, 'R');
  return g.rows();
});

icon('ob_owl_moon', { M: 'yellow.r@moon', O: 'navy.R@owl', E: 'yellow:5', s: 'white:5' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 9, 8, 8, 'M');
  g.ellipse(10, 14, 4.6, 5, 'O'); g.ellipse(10, 9, 4.4, 3.6, 'O');
  g.set(6, 6, 'O'); g.set(14, 6, 'O'); g.set(6, 5, 'O'); g.set(14, 5, 'O');
  g.set(8, 9, 'E'); g.set(12, 9, 'E');
  g.set(1, 2, 's'); g.set(18, 17, 's');
  return g.rows();
});

icon('ob_milk', { G: 'glass.x@glass', W: 'white.r@milk', T: 'mint.R@pot', t: 'mint:2' }, () => {
  const g = new Grid(20, 20);
  g.rect(2, 6, 7, 12, 'G'); g.rect(3, 8, 5, 9, 'W');
  g.ellipse(14, 13, 5, 4.4, 'T'); g.rect(12, 7, 4, 2, 'T'); g.line(18, 12, 19, 9, 'T'); g.rect(9, 12, 1, 3, 't');
  return g.rows();
});

icon('ob_mug_sun', { M: 'red.R@mug', m: 'red:2', C: '#4a2a14', S: 'yellow.R@sun', w: 'white:4' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(15, 4, 3.4, 3.4, 'S');
  g.rect(3, 8, 10, 10, 'M'); g.rect(4, 8, 8, 1, 'C'); g.rect(13, 10, 3, 1, 'M'); g.rect(15, 10, 1, 5, 'M'); g.rect(13, 14, 3, 1, 'M');
  g.line(6, 2, 7, 6, 'w'); g.line(9, 1, 10, 6, 'w');
  return g.rows();
});

icon('ob_mug_moon', { M: 'blue.R@mug', C: '#4a2a14', L: 'yellow.r@moon', w: 'white:4', s: 'white:5' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(15, 4, 3.4, 3.4, 'L'); g.ellipse(16.5, 3, 2.6, 2.6, '.');
  g.rect(3, 8, 10, 10, 'M'); g.rect(4, 8, 8, 1, 'C'); g.rect(13, 10, 3, 1, 'M'); g.rect(15, 10, 1, 5, 'M'); g.rect(13, 14, 3, 1, 'M');
  g.line(6, 2, 7, 6, 'w'); g.line(9, 1, 10, 6, 'w'); g.set(2, 2, 's');
  return g.rows();
});

icon('ob_radio', { W: 'lwood.y@box', S: 'parch.r@grill', s: 'wood:1', K: 'brass.R@knob', A: 'steel.x@ant' }, () => {
  const g = new Grid(20, 20);
  g.line(14, 1, 16, 7, 'A');
  g.rect(2, 7, 16, 11, 'W'); g.rect(4, 9, 8, 7, 'S');
  for (let y = 10; y < 16; y += 2) g.rect(4, y, 8, 1, 's');
  g.ellipse(15, 10.5, 1.6, 1.6, 'K'); g.ellipse(15, 14.5, 1.6, 1.6, 'K');
  return g.rows();
});

icon('ob_musicbox', { B: 'orange.y@box', L: 'red.y@lid', N: 'sky.r@note', P: 'pink.R@dancer' }, () => {
  const g = new Grid(20, 20);
  g.rect(3, 11, 14, 7, 'B'); g.poly([[3, 11], [17, 11], [15, 6], [5, 6]], 'L', '.');
  g.ellipse(10, 9.4, 1.6, 1.6, 'P');
  g.rect(16, 1, 1, 5, 'N'); g.rect(14, 5, 2, 2, 'N'); g.rect(17, 1, 2, 1, 'N');
  g.rect(2, 2, 1, 4, 'N'); g.rect(0, 5, 2, 2, 'N');
  return g.rows();
});

icon('ob_breath', { H: 'rose.R@heart', A: 'mint.r@swirl', a: 'mint:5' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(7.4, 9, 3.4, 3.4, 'H'); g.ellipse(12.6, 9, 3.4, 3.4, 'H'); g.poly([[4, 10], [16, 10], [10, 17]], 'H');
  for (let k = 0; k < 14; k++) { const a = k * 0.45; g.set(10 + Math.cos(a) * (9 - k * 0.2), 10 + Math.sin(a) * (9 - k * 0.2), k % 3 ? 'A' : 'a'); }
  return g.rows();
});

icon('ob_stream', { W: 'water.y@w', w: 'water:5', G: 'leaf.y@g', S: 'stone.r@s' }, () => {
  const g = new Grid(20, 20);
  g.rect(0, 4, 20, 14, 'G');
  g.poly([[0, 9], [8, 7], [20, 10], [20, 15], [10, 13], [0, 15]], 'W');
  for (const [x, y] of [[3, 11], [9, 10], [15, 12], [12, 13]]) g.rect(x, y, 2, 1, 'w');
  g.ellipse(5, 6, 2, 1.4, 'S'); g.ellipse(16, 16.4, 2.4, 1.4, 'S');
  return g.rows();
});

icon('ob_cricket', { M: 'yellow.r@moon', B: 'leaf.R@bug', b: 'leaf:2', s: 'white:5' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(14, 5, 3.6, 3.6, 'M'); g.ellipse(15.6, 3.8, 2.8, 2.8, '.');
  g.ellipse(8, 13, 5, 2.6, 'B'); g.ellipse(13, 12, 2, 2, 'B');
  g.line(4, 15, 2, 18, 'b'); g.line(8, 15, 9, 18, 'b'); g.line(14, 10, 18, 7, 'b'); g.line(13, 10, 16, 6, 'b');
  g.set(2, 3, 's'); g.set(6, 1, 's');
  return g.rows();
});

icon('ob_pillows', { A: 'white.R@a', B: 'pink.R@b', C: 'sky.R@c', D: 'yellow.R@d' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 16.5, 8, 2.4, 'A'); g.ellipse(10, 12.5, 7.4, 2.2, 'B'); g.ellipse(10, 8.6, 7, 2.2, 'C'); g.ellipse(10, 4.8, 6.4, 2, 'D');
  return g.rows();
});

icon('ob_name_tag', { T: 'brass.R@plate', t: 'brass:2', W: 'dwood.y@base', K: '#2a1a14' }, () => {
  const g = new Grid(20, 20);
  g.rect(1, 13, 18, 4, 'W');
  g.poly([[2, 13], [18, 13], [17, 6], [3, 6]], 'T');
  for (let x = 5; x < 15; x += 2) g.set(x, 9 + (x % 4 === 1 ? 1 : 0), 'K');
  g.line(5, 11, 14, 11, 't');
  return g.rows();
});

icon('ob_pencil', { Y: 'yellow.x@body', P: 'pink.r@eraser', M: 'steel.x@band', W: 'tan.r@wood', K: '#2a1a14' }, () => {
  const g = new Grid(20, 20);
  for (let k = 0; k < 13; k++) { g.rect(4 + k, 14 - k, 2, 2, 'Y'); }
  g.rect(2, 16, 2, 2, 'P'); g.rect(3, 15, 2, 2, 'M');
  g.rect(16, 2, 2, 2, 'W'); g.set(18, 1, 'K');
  return g.rows();
});
