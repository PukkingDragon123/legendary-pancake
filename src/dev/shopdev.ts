// Dev preview of the lodge store's pixel art: currency sprites, shop sprites, frames, patterns, the series banners and
// the pixel bursts. ?only=<regex> filters sprites, ?s=<scale>.
import { SPRITES, spriteURL } from '../ui/px/sprites.js';
import '../ui/px/currency.js';
import { burstURL, LG_FRAMES, lgStyle, injectLodgeCSS, patternURL, raysURL, shootURL } from '../ui/shop/art.js';
import { bannerArt } from '../ui/shop/paint.ts';
import { SERIES } from '../game/series.ts';

injectLodgeCSS();
const q = new URLSearchParams(location.search), only = q.get('only'), sc = +(q.get('s') ?? 4);
const names = Object.keys(SPRITES).filter((n) => (only ? new RegExp(only).test(n) : /^owlcoin$|^moongem$|coin_|acorn_big$|gem_big$|acorn_tiny|gem_tiny|gem_pack|^shop_/.test(n)));
for (const id of ['s', 's2']) {
  const el = document.getElementById(id)!;
  for (const n of names) { const d = document.createElement('div'); d.className = 'c'; d.innerHTML = `<img src="${spriteURL(n, sc)}"><span>${n}</span>`; el.appendChild(d); }
}
const f = document.getElementById('f')!;
if (!q.get('nof')) {
  for (const n of Object.keys(LG_FRAMES).filter((n) => !/_down$/.test(n))) {
    const d = document.createElement('div'); d.className = 'f';
    d.style.cssText += lgStyle(n, 3) + `;min-width:${/board/.test(n) ? 220 : 120}px;min-height:${/board/.test(n) ? 110 : 54}px;background:${/board/.test(n) ? `url(${patternURL('linen', 3)}) 0 0 / 48px 48px` : 'none'};background-clip:padding-box`;
    d.textContent = n; f.appendChild(d);
  }
  for (const p of ['linen', 'kraft', 'ledger', 'velvet', 'planks', 'stripe']) { const d = document.createElement('div'); d.className = 'f'; d.style.cssText = `width:120px;height:60px;background:url(${patternURL(p, 3)}) 0 0 repeat;image-rendering:pixelated`; d.title = p; f.appendChild(d); }
}
const b = document.getElementById('b')!;
for (const s of SERIES) { const i = new Image(); i.src = bannerArt(s, 120, 184); i.style.cssText = 'height:368px;image-rendering:pixelated;margin:4px'; b.appendChild(i); }
for (const u of [raysURL(0), raysURL(1), burstURL(), shootURL('#f1d39a', 72), shootURL('#c6bdd6', 72), shootURL('#aec8cc', 72)]) { const i = new Image(); i.src = u; i.style.cssText = 'height:144px;image-rendering:pixelated;margin:4px;background:#27313f'; b.appendChild(i); }
(window as unknown as { __ready: number }).__ready = 1;
