// Dev preview of every piece of the diary's pixel art (dev-book.html?art=1).
import * as A from '../ui/book/art.ts';
/** the old diary's cloth tabs (the art sheet still shows their tints and icons) */
const SECTIONS = [{ id: 'stats', name: 'Stats', tint: 'moss', icon: 'stats' }, { id: 'nights', name: 'Nights', tint: 'lake', icon: 'nights' }, { id: 'things', name: 'Finds', tint: 'honey', icon: 'things' }, { id: 'seals', name: 'Badges', tint: 'berry', icon: 'seals' }];

export function showArt(root: HTMLElement) {
  root.style.cssText = 'background:#46596a;color:#fff;font:11px sans-serif;padding:8px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;overflow:auto;height:100vh;box-sizing:border-box';
  const add = (label: string, a: { url: string; w: number; h: number }, k = 2) => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;flex-direction:column;gap:2px;align-items:center';
    d.innerHTML = `<img src="${a.url}" style="width:${a.w * k}px;height:${a.h * k}px;image-rendering:pixelated"><span>${label}</span>`;
    root.appendChild(d);
  };
  add('cover', A.coverArt(150, 220));
  add('board spread', A.boardArt(260, 180, true), 1.5);
  add('board single', A.boardArt(120, 180, false), 1.5);
  add('paper S', A.paperArt(110, 150, 'S', 3), 1.5);
  add('paper L', A.paperArt(110, 150, 'L', 4), 1.5);
  add('paper R', A.paperArt(110, 150, 'R', 5), 1.5);
  for (const s of SECTIONS) { add('tab ' + s.name, A.tabArt(s.tint, 40, 22, s.id === 'stats'), 3); add('icon ' + s.icon, A.iconArt(s.icon, s.tint), 4); }
  for (const sc of [92, 78, 61, 40]) add('badge ' + sc, A.badgeArt(sc, 26), 3);
  for (let i = 0; i < 5; i++) add('mood ' + A.MOOD_NAMES[i], A.moodArt(i), 4);
  for (const [c, e] of [['pink', 'heart'], ['blue', 'moon'], ['purple', 'seven'], ['gold', 'phases'], ['red', 'three'], ['gold', 'flame'], ['blue', 'eight'], ['green', 'star'], ['green', 'sun'], ['purple', 'hush'], ['pink', 'feather'], ['blue', 'wind'], ['gold', 'box'], ['purple', 'wish'], ['red', 'face'], ['green', 'quill'], ['green', 'compass'], ['red', 'chair'], ['pink', 'hat'], ['gold', 'crown']]) add(e, A.stampArt(c, e, true), 3);
  add('not yet', A.stampArt('gold', 'crown', false), 3);
  add('ribbon', A.ribbonArt(16, 'berry'), 4);
  add('arrow l', A.arrowArt('l'), 4); add('arrow r', A.arrowArt('r'), 4);
}
