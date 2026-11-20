// Hoot Hollow's own pixel icons, drawn with The Bear Must Eat's sprite kit (sprites.js): 20x20
// rows or Grid drawings keyed to hue-shifted material ramps, shaded from the top-left with an
// automatic dark outline. They sit alongside BME's ~170 icons and look like one set.
import { Grid, icon } from './sprites.js';

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

icon('owl', { B: 'wood.R@body', D: 'cream.r@disc', E: '#2a1a14', e: 'white:5', K: 'honey.y@beak', T: 'wood:2', W: 'pink:4' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 11, 8, 8, 'B');
  g.poly([[3, 2], [6.5, 5], [3.5, 6.5]], 'T');
  g.poly([[17, 2], [13.5, 5], [16.5, 6.5]], 'T');
  g.ellipse(6.8, 10.4, 3.6, 3.6, 'D');
  g.ellipse(13.2, 10.4, 3.6, 3.6, 'D');
  g.rect(9, 12, 2, 3, 'D');
  g.set(7, 10, 'E').set(13, 10, 'E').set(7, 9, 'e').set(13, 9, 'e');
  g.set(9, 12, 'K').set(10, 12, 'K').set(9, 13, 'K').set(10, 13, 'K');
  g.set(4, 13, 'W').set(16, 13, 'W');
  return g.rows();
});

// five little owl faces for "how do you feel?"
const MOOD_MOUTH = [
  ['......', '.kkkk.', 'k....k'],
  ['......', '.kkkk.', '......'],
  ['......', 'k....k', '.kkkk.'],
  ['k....k', '.k..k.', '..kk..'],
  ['k....k', 'kRRRRk', '.kkkk.'],
];
for (let i = 0; i < 5; i++) {
  const body = ['wood', 'lwood', 'honey', 'orange', 'fox'][i];
  icon('mood' + i, { B: body + '.R@b', D: 'cream.r@d', E: '#2a1a14', e: 'white:5', K: 'honey:4', R: 'red:4', W: 'pink:4', k: 'line', Z: '#2a1a14' }, () => {
    const g = new Grid(20, 20);
    g.ellipse(10, 10.6, 8.6, 8.4, 'B');
    g.ellipse(6.6, 9.4, 3.8, 3.8, 'D');
    g.ellipse(13.4, 9.4, 3.8, 3.8, 'D');
    g.ellipse(10, 14, 4.2, 3, 'D');
    if (i === 0) { for (const x of [5, 6, 7, 8]) g.set(x, 9, 'Z'); for (const x of [12, 13, 14, 15]) g.set(x, 9, 'Z'); }
    else { g.set(7, 9, 'E').set(13, 9, 'E').set(7, 10, 'E').set(13, 10, 'E'); if (i > 1) g.set(6, 8, 'e').set(12, 8, 'e'); }
    g.set(9, 11, 'K').set(10, 11, 'K');
    g.stamp(7, 13, MOOD_MOUTH[i].map((r) => r.replace(/k/g, 'Z')));
    if (i >= 3) g.set(4, 12, 'W').set(16, 12, 'W');
    return g.rows();
  });
}

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
