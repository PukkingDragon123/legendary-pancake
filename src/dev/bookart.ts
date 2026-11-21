// Dev preview of every piece of the book's pixel art (dev-book.html?art=1).
import * as A from '../ui/px/bookart.js';
import { AREAS } from '../game/catalog.ts';
import { h, render } from 'preact';
import { BookIcon } from '../ui/book/bookicon.tsx';
import { spriteURL } from '../ui/px/sprites.js';

export function showArt(root: HTMLElement) {
  root.style.cssText = 'background:#3a3046;color:#fff;font:11px sans-serif;padding:8px;display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;overflow:auto;height:100vh;box-sizing:border-box';
  const add = (label: string, a: { url: string; w: number; h: number }, k = 2) => {
    const d = document.createElement('div');
    d.style.cssText = 'display:flex;flex-direction:column;gap:2px;align-items:center';
    d.innerHTML = `<img src="${a.url}" style="width:${a.w * k}px;height:${a.h * k}px;image-rendering:pixelated"><span>${label}</span>`;
    root.appendChild(d);
  };
  add('cover', A.coverArt(160, 220));
  add('half R', A.halfArt('R', 120, 160, 7, 3), 1.5);
  add('half L', A.halfArt('L', 120, 160, 7, 1), 1.5);
  add('page R rules', A.pageArt(120, 160, 'R', 'rules', 5, { r0: 20, step: 12 }), 1.5);
  add('page L frame', A.pageArt(120, 160, 'L', 'frame', 6), 1.5);
  add('endpaper', A.endpaperArt(120, 160), 1.5);
  add('cover back', A.coverBackArt(127, 174, 7), 1.5);
  add('spine', A.spineArt(16, 174));
  add('fore', A.blockEdgeArt(16, 174, 'fore'));
  add('clasp', A.claspArt(), 3);
  add('plate', A.plateArt(80, 50), 2);
  for (const c of ['red', 'gold', 'green']) add('rib ' + c, A.ribbonArt(16, c), 3);
  add('tab', A.tabArt('blue', 14, 26, 'right'), 3); add('tab L', A.tabArt('purple', 14, 26, 'left'), 3); add('tab top', A.tabArt('green', 14, 26, 'top'), 3);
  add('corner', A.cornerArt('R'), 3); add('cornerL', A.cornerArt('L'), 3);
  add('tape', A.tapeArt('pink', 26, 9, 2), 3); add('tape mint', A.tapeArt('mint', 26, 9, 3), 3);
  add('swash', A.swashArt(64), 2);
  add('oval', A.ovalFrameArt(60, 72), 2);
  add('sticker', A.stickerArt('#3f8a4a'), 3);
  add('ring', A.stampRingArt('#2b3d8f'), 2);
  for (const [c, e] of [['red', 'moon'], ['gold', 'seven'], ['green', 'star'], ['blue', 'eight'], ['purple', 'wish'], ['pink', 'heart'], ['gold', 'crown'], ['red', 'flame']]) add('seal ' + e, A.sealArt(c, e), 3);
  add('pseal', A.pencilSealArt('box'), 3);
  for (let i = 0; i < 5; i++) add('mood' + i, A.moodArt(i), 3);
  for (const f of ['stand', 'blink', 'pull', 'pull2', 'phew', 'hop'] as const) add('pip ' + f, A.pipArt(f), 3);
  for (const s of ['barn', 'snowy', 'horned', 'greatgrey']) add('pip ' + s, A.pipArt('stand', s, '#f2c414', false), 3);
  add('sleep doodle', A.sleepDoodle(), 3);
  add('moon doodle', A.moonDoodle(), 3);
  add('map', A.mapArt(200, 150, AREAS.map((a, i) => ({ id: a.id, x: a.x, y: a.y, seen: i < 3 }))), 2);
  add('hud base', A.hudBase(), 4); add('hud cover', A.hudCover(), 4); add('hud rib', A.hudRibbon(), 4);
  const icon = document.createElement('div');
  icon.style.cssText = 'display:flex;gap:16px;align-items:flex-end;padding:8px;background:#5a3a22';
  root.appendChild(icon);
  render(h('div', { style: 'display:flex;gap:16px;align-items:flex-end' }, [h(BookIcon, { size: 44 }), h(BookIcon, { size: 90 }), h('img', { src: spriteURL('bigbook', 3), style: 'image-rendering:pixelated' })]), icon);
}
