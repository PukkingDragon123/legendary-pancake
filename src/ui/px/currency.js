// Hoot Hollow's money, drawn with the BME sprite kit: the owl coin (everyday currency), the moon
// gem (premium), and the bags and chests of coins sold in the Snow Queen's boutique.
// OWNED BY THE SHOP BUILDER (others only use the names: owlcoin, moongem, coin_pouch, coin_sack,
// coin_chest, coin_vault).
import { Grid, icon } from './sprites.js';

icon('owlcoin', { G: 'gold.R@coin', r: 'gold:2', e: 'gold:1', E: 'gold:4', b: 'gold:5', w: '#fffbe0' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 10, 8.7, 8.7, 'G');
  g.ellipse(10, 10, 7.2, 7.2, 'r');
  g.ellipse(10, 10, 6.3, 6.3, 'G');
  // an owl embossed on the face: tufts, two big eyes, beak, chest chevrons
  g.set(6, 5, 'e').set(7, 6, 'e').set(13, 5, 'e').set(12, 6, 'e');
  g.ellipse(7.6, 9, 1.9, 1.9, 'E'); g.ellipse(12.4, 9, 1.9, 1.9, 'E');
  g.rect(7, 8, 2, 2, 'e'); g.rect(12, 8, 2, 2, 'e');
  g.set(9, 11, 'b').set(10, 11, 'b').set(10, 12, 'b');
  g.set(8, 14, 'e').set(10, 14, 'e').set(12, 14, 'e').set(9, 15, 'e').set(11, 15, 'e');
  g.set(5, 5, 'w').set(4, 6, 'w').set(4, 7, 'w');
  return g.rows();
});

icon('moongem', { G: 'sky.R@gem', g: 'sky:1', L: 'lilac.R@gem', M: 'yellow.r@moon', w: '#ffffff' }, () => {
  const g = new Grid(20, 20);
  g.poly([[6, 2.5], [14, 2.5], [18, 7.5], [10, 18.5], [2, 7.5]], 'G');
  g.poly([[2.2, 7.6], [17.8, 7.6], [10, 18.4]], 'L');
  g.line(6, 2.6, 4.6, 7.4, 'g').line(14, 2.6, 15.4, 7.4, 'g').line(10, 2.6, 10, 7.4, 'g').line(2.4, 7.5, 17.6, 7.5, 'g');
  g.ellipse(10.2, 11, 3.2, 3.2, 'M');
  g.ellipse(11.8, 9.8, 2.8, 2.8, 'L');
  g.set(7, 4, 'w').set(6, 5, 'w').set(13, 4, 'w');
  return g.rows();
});

icon('coin_pouch', { L: 'leather.R@bag', l: 'leather:1', S: 'straw.x@tie', C: 'gold.R@c', c: 'gold:2', w: '#fffbe0' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 13.5, 6.6, 5.4, 'L');
  g.poly([[6.5, 9], [13.5, 9], [12, 6], [8, 6]], 'L');
  g.ellipse(7.6, 5, 2.2, 1.7, 'C'); g.ellipse(12, 4.6, 2.2, 1.7, 'C'); g.ellipse(10, 3.6, 2.2, 1.7, 'C');
  g.set(10, 3, 'c').set(7, 4, 'c');
  g.rect(6, 8, 8, 2, 'S');
  g.line(7, 14, 9, 16, 'l').line(13, 12, 12, 15, 'l');
  g.set(9, 3, 'w');
  return g.rows();
});

icon('coin_sack', { B: 'straw.R@sack', b: 'straw:1', R: 'red.x@rope', C: 'gold.R@c', c: 'gold:2', E: 'gold:4', w: '#fffbe0' }, () => {
  const g = new Grid(20, 20);
  g.ellipse(10, 12.8, 8.4, 6.6, 'B');
  g.poly([[5, 7], [15, 7], [13.5, 4], [6.5, 4]], 'B');
  g.ellipse(6.2, 3.2, 2.2, 1.6, 'C'); g.ellipse(13.6, 3.4, 2.2, 1.6, 'C'); g.ellipse(10, 2.4, 2.4, 1.7, 'C'); g.ellipse(8.2, 4, 2, 1.4, 'C');
  g.rect(5, 6, 10, 2, 'R');
  g.ellipse(10, 13, 3.4, 3.4, 'E'); g.ellipse(10, 13, 2.2, 2.2, 'c');
  g.line(4, 10, 6, 17, 'b').line(16, 10, 14, 17, 'b');
  g.ellipse(16.4, 17.6, 1.8, 1.2, 'C'); g.ellipse(3.6, 18, 1.6, 1.1, 'C');
  g.set(9, 2, 'w').set(5, 3, 'w');
  return g.rows();
});

icon('coin_chest', { W: 'wood.R@box', w: 'wood:1', B: 'brass.y@band', b: 'brass:4', C: 'gold.R@c', c: 'gold:2', K: 'iron:1', s: '#fffbe0' }, () => {
  const g = new Grid(20, 20);
  g.rect(2, 9, 16, 9, 'W');
  g.poly([[2, 9], [18, 9], [17, 3], [3, 3]], 'W');
  g.ellipse(6, 8.6, 2.4, 1.6, 'C'); g.ellipse(10, 8, 2.6, 1.7, 'C'); g.ellipse(14, 8.6, 2.4, 1.6, 'C'); g.ellipse(8, 7, 2, 1.3, 'C'); g.ellipse(12.4, 6.8, 2, 1.3, 'C');
  g.rect(2, 9, 16, 1, 'B'); g.rect(4, 3, 2, 15, 'B'); g.rect(14, 3, 2, 15, 'B');
  g.rect(9, 11, 2, 3, 'b'); g.set(9, 12, 'K').set(10, 12, 'K');
  g.line(3, 13, 17, 13, 'w').line(3, 16, 17, 16, 'w');
  g.set(9, 7, 'c').set(13, 6, 'c');
  g.set(7, 6, 's').set(10, 7, 's');
  return g.rows();
});

icon('coin_vault', { W: 'dwood.R@box', w: 'dwood:1', B: 'gold.y@band', b: 'gold:5', C: 'gold.R@c', c: 'gold:2', P: 'lilac.R@gem', R: 'red.R@gem', S: 'sky.R@gem', K: 'iron:1', s: '#ffffff' }, () => {
  const g = new Grid(20, 20);
  g.rect(1, 10, 18, 9, 'W');
  g.ellipse(10, 9.4, 8.8, 4.2, 'C');
  g.ellipse(5, 6.6, 2.4, 1.6, 'C'); g.ellipse(14.6, 6.4, 2.6, 1.7, 'C'); g.ellipse(9.8, 4.6, 2.8, 1.8, 'C');
  g.ellipse(7.4, 7.8, 1.6, 1.6, 'R'); g.ellipse(12.6, 8.4, 1.6, 1.6, 'S'); g.ellipse(10.2, 6.4, 1.5, 1.5, 'P');
  g.rect(1, 10, 18, 1, 'B'); g.rect(1, 18, 18, 1, 'B'); g.rect(3, 10, 2, 9, 'B'); g.rect(15, 10, 2, 9, 'B');
  g.rect(8, 12, 4, 4, 'B'); g.rect(9, 13, 2, 2, 'K');
  g.set(9, 4, 'c').set(4, 6, 'c').set(14, 6, 'c');
  g.set(7, 7, 's').set(12, 8, 's').set(10, 4, 's').set(2, 11, 'b').set(17, 11, 'b');
  return g.rows();
});
