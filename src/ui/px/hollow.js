// Hoot Hollow's own pixel icons, drawn with the sprite kit (sprites.js): 20x20 rows or Grid
// drawings keyed to hue-shifted material ramps, shaded from the top-left with an automatic dark
// outline, and graded into the calm "Moss & Moonlight" palette when built. No 2D owls.
import { Grid, icon } from './sprites.js';
import { installBaked } from './baked.js';

icon('acorn', { C: 'wood.R@cap', c: 'wood:1', N: 'lwood.R@nut', n: 'lwood:5', S: 'dwood.x@stem' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 12.6, 5.6, 6.2, 'N');
  g.ellipse(10, 8, 7.4, 3.6, 'C');
  g.rect(3, 8, 14, 2, 'C');
  for (let x = 4; x < 17; x += 2) g.set(x, 7 + (x % 4 === 0 ? 1 : 0), 'c');
  for (let x = 5; x < 16; x += 3) g.set(x, 9, 'c');
  g.rect(9, 2, 2, 3, 'S');
  g.set(8, 13, 'n').set(8, 14, 'n').set(7, 12, 'n');
  return g.rows();
});

icon('moonstone', { G: 'lilac.R@gem', g: 'lilac:1', M: 'yellow.r@moon', w: 'white:5' }, () => {
  const g = new Grid(20, 20);
  g.poly([[10, 1.5], [17.5, 6.5], [17.5, 13.5], [10, 18.5], [2.5, 13.5], [2.5, 6.5]], 'G');
  g.line(2.6, 6.6, 10, 10, 'g').line(17.4, 6.6, 10, 10, 'g').line(10, 10, 10, 18, 'g');
  g.ellipse(10.4, 9.6, 3.8, 3.8, 'M');
  g.ellipse(12.2, 8.2, 3.2, 3.2, 'G');
  g.set(6, 4, 'w').set(5, 5, 'w').set(14, 15, 'w');
  return g.rows();
});

icon('candle', { W: 'cream.x@wax', w: 'cream:5', F: 'fire.R@flame', f: 'yellow:5', B: 'brass.y@dish', b: 'brass:4', K: '#2a1a14' }, [
  '....................',
  '.........F..........',
  '........FF..........',
  '........FfF.........',
  '.......FffF.........',
  '.......FffF.........',
  '........FF..........',
  '.........K..........',
  '.......WWWWW........',
  '.......WWwWW........',
  '.......WWWwW........',
  '.......WWWWW........',
  '.......WWWWW........',
  '.......WWWWW........',
  '.......WWWWW........',
  '.......WWWWW........',
  '...BBBBBBBBBBBBB....',
  '....BbbbbbbbbbB.....',
  '.....BBBBBBBBB......',
  '....................',
]);

icon('jar', { L: 'wood.y@lid', l: 'wood:4', G: 'glass.r@glass', y: 'yellow:5', Y: 'yellow:3', h: 'white:5', S: 'straw:3' }, [
  '....................',
  '.....SSS..SSS.......',
  '......SSSSSS........',
  '.....LLLLLLLLLL.....',
  '.....LllllllllL.....',
  '.....LLLLLLLLLL.....',
  '......GGGGGGGG......',
  '.....GGGGGGGGGG.....',
  '....GhGGGGGGyGGG....',
  '....GhGGyGGGGGGG....',
  '....GhGGGGGGGGGG....',
  '....GGGGGGGGYyGG....',
  '....GGGyGGGGGGGG....',
  '....GGGGGGGGGGGG....',
  '....GGGGGGyGGGGG....',
  '....GGGGGGGGGGGG....',
  '.....GGGGGGGGGG.....',
  '......GGGGGGGG......',
  '....................',
  '....................',
]);

icon('treehouse', { L: 'leaf.R@crown', l: 'leaf:5', T: 'wood.x@trunk', D: 'dwood.f@door', d: 'gold:4', W: 'yellow:4', R: 'wood:2' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 6, 8.6, 5.4, 'L');
  g.ellipse(4.4, 8.4, 3.6, 3, 'L');
  g.ellipse(15.6, 8.4, 3.6, 3, 'L');
  g.rect(6, 10, 8, 9, 'T');
  g.rect(4, 18, 12, 1, 'T');
  g.ellipse(10, 15.8, 2.2, 2.6, 'D');
  g.rect(8, 16, 4, 3, 'D');
  g.set(11, 16, 'd');
  g.set(7, 11, 'W').set(8, 11, 'W').set(7, 12, 'W').set(8, 12, 'W');
  g.set(6, 4, 'l').set(7, 3, 'l').set(12, 3, 'l').set(3, 7, 'l');
  return g.rows();
});

icon('mic', { M: 'steel.R@head', m: 'steel:1', B: 'brass.x@stand', K: '#2a1a14' }, [
  '....................',
  '.......MMMMMM.......',
  '......MMMMMMMM......',
  '......MmMmMmMM......',
  '......MMMMMMMM......',
  '......MmMmMmMM......',
  '......MMMMMMMM......',
  '......MmMmMmMM......',
  '......MMMMMMMM......',
  '....B..MMMMMM..B....',
  '....B..........B....',
  '.....B........B.....',
  '......BB....BB......',
  '........BBBB........',
  '.........BB.........',
  '.........BB.........',
  '.........BB.........',
  '......BBBBBBBB......',
  '....................',
  '....................',
]);

icon('rain', { C: 'white.r@cloud', c: 'white:2', D: 'water.y@d', d: 'water:5' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(7, 8.6, 4.4, 3.6, 'C');
  g.ellipse(12, 6.6, 5, 4.4, 'C');
  g.ellipse(15.4, 9.6, 3.4, 2.8, 'C');
  g.rect(4, 9, 14, 3, 'C');
  for (const [x, y] of [[5, 14], [9, 15], [13, 14], [7, 17], [11, 18], [15, 17]]) { g.set(x, y, 'D').set(x, y + 1, 'D'); }
  return g.rows();
});

icon('waves', { W: 'water.y@w', w: 'white:5', B: 'blue.y@deep' }, () => {
  const g = new Grid(20, 20);
  for (let x = 0; x < 20; x++) {
    const y1 = Math.round(8 + Math.sin(x * 0.7) * 1.6), y2 = Math.round(13 + Math.sin(x * 0.7 + 1.6) * 1.4);
    for (let y = y1; y < 19; y++) g.set(x, y, y >= y2 ? 'B' : 'W');
    g.set(x, y1, 'w');
    if (x % 3 === 0) g.set(x, y2, 'w');
  }
  return g.rows();
});

icon('wind', { W: 'white.x@w', w: 'sky:4' }, () => {
  const g = new Grid(20, 20);
  const swirl = (y, x0, x1, r, up) => {
    for (let x = x0; x < x1; x++) g.set(x, y, 'W').set(x, y + 1, 'W');
    for (let a = 0; a < Math.PI * 1.4; a += 0.15) g.set(Math.round(x1 + Math.sin(a) * r), Math.round(y + (up ? -1 : 1) * (r - Math.cos(a) * r) + (up ? 1 : 0)), 'W');
  };
  swirl(5, 2, 13, 2.6, true);
  swirl(10, 2, 15, 2.4, false);
  for (let x = 4; x < 12; x++) g.set(x, 15, 'w').set(x, 16, 'w');
  return g.rows();
});

icon('leaf', { L: 'leaf.R@leaf', V: 'olive:2' }, () => {
  const g = new Grid(20, 20);
  g.poly([[3, 17], [4, 8], [9, 3], [17, 2], [16, 10], [11, 15]], 'L');
  g.line(4, 16, 15, 4, 'V');
  return g.rows();
});

icon('hanger', { H: 'brass.x@hook', W: 'lwood.y@bar', w: 'lwood:5' }, [
  '....................',
  '.........HH.........',
  '........H..H........',
  '...........H........',
  '..........H.........',
  '.........HH.........',
  '.........WW.........',
  '........WWWW........',
  '.......WWwwWW.......',
  '......WWW..WWW......',
  '.....WWW....WWW.....',
  '....WWW......WWW....',
  '...WWW........WWW...',
  '..WWW..........WWW..',
  '..WWWWWWWWWWWWWWWW..',
  '..WwwwwwwwwwwwwwwW..',
  '..WWWWWWWWWWWWWWWW..',
  '....................',
  '....................',
  '....................',
]);

icon('brush', { H: 'lwood.x@handle', F: 'steel.x@ferrule', B: 'pink.R@bristle', b: 'pink:5' }, () => {
  const g = new Grid(20, 20);
  for (let i = 0; i < 9; i++) { g.set(17 - i, 2 + i, 'H').set(16 - i, 2 + i, 'H').set(17 - i, 3 + i, 'H'); }
  g.poly([[7.5, 10], [10.5, 13], [9, 14.5], [6, 11.5]], 'F');
  g.poly([[6, 11.5], [9, 14.5], [6, 18], [2, 18], [2, 15]], 'B');
  g.set(3, 16, 'b').set(4, 15, 'b');
  return g.rows();
});

icon('satchel', { S: 'leather.f@bag', s: 'leather:1', F: 'leather.y@flap', B: 'gold.R@buckle', T: 'wood.x@strap' }, [
  '.....TTTTTTTTTT.....',
  '....TT........TT....',
  '...TT..........TT...',
  '...T............T...',
  '..SSSSSSSSSSSSSSSS..',
  '..FFFFFFFFFFFFFFFF..',
  '..FFFFFFFFFFFFFFFF..',
  '..FFFFFFFFFFFFFFFF..',
  '..SFFFFFFBBFFFFFFS..',
  '..SSSSSSSBBSSSSSSS..',
  '..SSSSSSSSSSSSSSSS..',
  '..SsSSSSSSSSSSSSsS..',
  '..SsSSSSSSSSSSSSsS..',
  '..SSSSSSSSSSSSSSSS..',
  '..SSSSSSSSSSSSSSSS..',
  '..SsSSSSSSSSSSSSsS..',
  '...SSSSSSSSSSSSSS...',
  '....................',
  '....................',
  '....................',
]);

icon('nest', { N: 'straw.f@nest', n: 'wood:2', Q: 'pink.y@quilt', q: 'cream:5', P: 'cream.R@pillow' }, [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '......PPPP..........',
  '.....PPPPPP.........',
  '....QQPPPPPQQQQ.....',
  '...QQQQqQQQQqQQQ....',
  '..QQqQQQQqQQQQQqQ...',
  '.NNNNNNNNNNNNNNNNNN.',
  '.NnNNNnNNNnNNNnNNnN.',
  'NNNNnNNNnNNNnNNNNNNN',
  'NnNNNNnNNNNnNNNnNNnN',
  '.NNNnNNNnNNNNNnNNNN.',
  '..NNNNNNNNNNNNNNNN..',
  '....NNNNNNNNNNNN....',
  '....................',
  '....................',
  '....................',
]);

icon('phone_off', { P: 'navy.f@phone', S: 'sky.r@screen', R: 'red.x@x', K: '#2a1a14' }, [
  '....................',
  '......PPPPPPPP......',
  '.....PPPKKKPPPP.....',
  '.....PSSSSSSSSP.....',
  '.....PSSSSSSSSP..RR.',
  '.....PSSSSSSSSP.RRR.',
  '.....PSSSSSSSSPRRR..',
  '.....PSSSSSSSSRRR...',
  '.....PSSSSSSSRRRP...',
  '.....PSSSSSSRRRSP...',
  '.....PSSSSSRRRSSP...',
  '.....PSSSSRRRSSSP...',
  '.....PSSSRRRSSSSP...',
  '.....PSSRRRSSSSSP...',
  '.....PSRRRSSSSSSP...',
  '.....PRRRSSSSSSSP...',
  '....RRRPPPKKPPPPP...',
  '....RR.PPPPPPPPP....',
  '....................',
  '....................',
]);

// 'owl' is Pip's token wherever the old 2D owl face was used: a soft barred tawny feather with a
// quill and a glint. (Pip himself only ever appears as the 3D model.)
icon('owl', { F: 'cinnamon.x@vane', f: 'cinnamon:1', c: 'cream:4', Q: 'bone.x@quill', q: 'bone:2', S: '#fff8d0!' }, () => {
  const g = new Grid(20, 20);
  // the vane, a long leaf shape leaning to the right
  g.poly([[15.5, 1.5], [17.6, 3.6], [16.8, 8.5], [13, 13.4], [8.6, 15.6], [6.6, 14.2], [7.4, 10], [10.6, 5.4]], 'F');
  // dark bars across the vane and pale downy tips
  for (const [x0, y0] of [[9, 12], [11, 9], [13, 6.4], [15, 4]]) g.line(x0 - 1.5, y0 + 1.2, x0 + 2.4, y0 - 1.4, 'f');
  g.set(7, 14, 'c').set(8, 15, 'c').set(6, 13, 'c').set(16, 2, 'c').set(17, 3, 'c');
  // the quill down the middle and out of the bottom
  g.line(16.6, 2.6, 7.4, 14.6, 'Q');
  g.line(7.4, 14.6, 3.6, 18.4, 'Q').set(3, 19, 'q').set(4, 18, 'q');
  g.set(13, 2, 'S').set(12, 3, 'S').set(14, 3, 'S').set(13, 4, 'S');
  return g.rows();
});

// five little night skies for "how did you sleep?": a stormy cloud, a grey cloud, a half moon
// peeping from a cloud, a smiling crescent with stars, and a bright morning sun. Dot eyes only.
const MOOD_KEY = { C: 'white.r@cloud', c: 'white:2', D: 'slate.r@storm', d: 'slate:1', M: 'yellow.R@moon', m: 'yellow:5', U: 'yellow.R@sun', u: 'orange:4', R: 'water:4', L: 'yellow:5', E: '#2a1a14', W: 'pink:4', S: '#fff8d0!' };
function cloud(g, cx, cy, ch, w = 1) {
  g.ellipse(cx - 3.4 * w, cy + 1, 3.2 * w, 2.8, ch);
  g.ellipse(cx + 0.2, cy - 1.2, 4.2 * w, 3.8, ch);
  g.ellipse(cx + 4 * w, cy + 1.2, 3 * w, 2.6, ch);
  g.rect(Math.round(cx - 6 * w), Math.round(cy + 1), Math.round(12 * w), 3, ch);
}
const MOODS = [
  (g) => { cloud(g, 10, 8, 'D', 1.05); for (const [x, y] of [[5, 15], [8, 17], [12, 15], [15, 17]]) g.set(x, y, 'R').set(x, y + 1, 'R'); g.line(11, 12, 9, 15, 'L').line(9, 15, 11, 15, 'L').line(11, 15, 9, 18, 'L'); g.set(8, 8, 'E').set(12, 8, 'E'); g.line(9, 10, 11, 10, 'E'); },
  (g) => { cloud(g, 10, 10, 'C', 1.1); g.line(4, 14, 16, 14, 'c'); g.set(8, 10, 'E').set(12, 10, 'E'); g.line(9, 12, 11, 12, 'E'); },
  (g) => { g.ellipse(11.5, 7, 4.8, 4.8, 'M'); g.rect(12, 1, 6, 12, '.'); g.set(9, 6, 'E'); g.set(8, 3, 'm'); cloud(g, 11, 13, 'C', 0.9); g.set(9, 13, 'E').set(13, 13, 'E'); g.set(10, 15, 'E').set(11, 15, 'E').set(12, 15, 'E'); },
  (g) => { g.ellipse(9.5, 10, 7, 7, 'M'); g.ellipse(13.5, 7.6, 6.2, 6.2, '.'); g.set(6, 9, 'E').set(5, 12, 'E').set(6, 13, 'E').set(7, 13, 'E').set(4, 11, 'W'); g.set(3, 7, 'm').set(4, 5, 'm'); for (const [x, y] of [[15, 4], [17, 12], [13, 16]]) g.set(x, y, 'S').set(x - 1, y, 'S').set(x + 1, y, 'S').set(x, y - 1, 'S').set(x, y + 1, 'S'); },
  (g) => { for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4; g.line(10 + Math.cos(a) * 6.4, 10 + Math.sin(a) * 6.4, 10 + Math.cos(a) * 8.8, 10 + Math.sin(a) * 8.8, 'u'); } g.ellipse(10, 10, 5.6, 5.6, 'U'); g.set(8, 9, 'E').set(12, 9, 'E'); g.set(8, 12, 'E').set(9, 13, 'E').set(10, 13, 'E').set(11, 13, 'E').set(12, 12, 'E'); g.set(6, 11, 'W').set(14, 11, 'W'); g.set(17, 2, 'S').set(2, 17, 'S'); },
];
for (let i = 0; i < 5; i++) icon('mood' + i, MOOD_KEY, () => { const g = new Grid(20, 20); MOODS[i](g); return g.rows(); });

// pixel toggle switch: a brass knob in a wooden groove
for (const on of [false, true]) {
  icon(on ? 'switch_on' : 'switch_off', { T: on ? 'leaf.y@t' : 'dwood.y@t', K: 'brass.R@knob', k: 'line' }, () => {
    const g = new Grid(24, 14);
    g.rect(2, 3, 20, 8, 'T');
    g.ellipse(on ? 16.5 : 7.5, 7, 5.2, 5.2, 'K');
    return g.rows();
  });
}

export const HOLLOW_ICONS = ['acorn', 'moonstone', 'candle', 'jar', 'treehouse', 'mic', 'rain', 'waves', 'wind', 'leaf', 'hanger', 'brush', 'satchel', 'nest', 'phone_off', 'owl', 'mood0', 'mood1', 'mood2', 'mood3', 'mood4', 'switch_on', 'switch_off'];

// [ui3] detailed icons baked from real 3D props replace the drawn ones of the same name (bell, lantern, alarm,
// clock, book, nest, jar, camera, bench, shop, clipboard); see src/dev/iconbake.ts
installBaked();
