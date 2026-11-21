// [globe] Dev contact sheet: every postcard scene.
import { AREAS } from '../game/catalog.ts';
import { postcardArt } from '../ui/globe/postcards.ts';

const g = document.getElementById('g')!;
for (const a of AREAS) {
  const d = document.createElement('div');
  const im = document.createElement('img');
  im.src = postcardArt(a.id, 2);
  d.append(im, a.title);
  g.append(d);
}
