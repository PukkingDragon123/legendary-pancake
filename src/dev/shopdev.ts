// Dev preview of the boutique's pixel art: currency sprites (with frames), shop sprites, ice frames.
import { SPRITES, spriteURL } from '../ui/px/sprites.js';
import '../ui/px/currency.js';
import { ICE_FRAMES, iceStyle } from '../ui/shop/art.js';

const q = new URLSearchParams(location.search), only = q.get('only'), sc = +(q.get('s') ?? 4);
const names = Object.keys(SPRITES).filter((n) => (only ? new RegExp(only).test(n) : /owlcoin|moongem|coin_|acorn_|gem_|^ice_|^shop_/.test(n)));
for (const id of ['s', 's2']) {
  const el = document.getElementById(id)!;
  for (const n of names) { const d = document.createElement('div'); d.className = 'c'; d.innerHTML = `<img src="${spriteURL(n, sc)}"><span>${n}</span>`; el.appendChild(d); }
}
const f = document.getElementById('f')!;
if (!q.get('nof')) for (const n of Object.keys(ICE_FRAMES)) { const d = document.createElement('div'); d.className = 'f'; d.style.cssText += iceStyle(n, 3) + ';min-width:120px;min-height:60px'; d.textContent = n; f.appendChild(d); }
(window as unknown as { __ready: number }).__ready = 1;
