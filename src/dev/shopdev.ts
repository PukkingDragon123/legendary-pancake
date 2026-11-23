// Dev preview of the boutique's pixel art: currency sprites, shop sprites, frames, patterns, the
// gacha banners and wish sky, and the pixel bursts. ?only=<regex> filters sprites, ?s=<scale>.
import { SPRITES, spriteURL } from '../ui/px/sprites.js';
import '../ui/px/currency.js';
import { burstURL, ICE_FRAMES, iceStyle, injectIceCSS, patternURL, raysURL, shootURL } from '../ui/shop/art.js';
import { bannerArt, skyArt } from '../ui/shop/paint.ts';
import { SERIES } from '../game/series.ts';

injectIceCSS();
const q = new URLSearchParams(location.search), only = q.get('only'), sc = +(q.get('s') ?? 4);
const names = Object.keys(SPRITES).filter((n) => (only ? new RegExp(only).test(n) : /^owlcoin$|^moongem$|^owlcoin_f[0-7]$|^moongem_f[0-7]$|coin_|acorn_big$|gem_big$|acorn_tiny|gem_tiny|gem_pack|^ice_|^shop_/.test(n)));
for (const id of ['s', 's2']) {
  const el = document.getElementById(id)!;
  for (const n of names) { const d = document.createElement('div'); d.className = 'c'; d.innerHTML = `<img src="${spriteURL(n, sc)}"><span>${n}</span>`; el.appendChild(d); }
}
const f = document.getElementById('f')!;
if (!q.get('nof')) {
  for (const n of Object.keys(ICE_FRAMES).filter((n) => !/_down$/.test(n))) {
    const d = document.createElement('div'); d.className = 'f';
    d.style.cssText += iceStyle(n, 3) + `;min-width:${/panel/.test(n) ? 220 : 120}px;min-height:${/panel/.test(n) ? 110 : 54}px;background:${/panel/.test(n) ? `url(${patternURL('linen', 3)}) 0 0 / 48px 48px` : 'none'};background-clip:padding-box`;
    d.textContent = n; f.appendChild(d);
  }
  for (const p of ['linen', 'kraft', 'velvet', 'planks', 'stripe', 'garland', 'garland2']) { const d = document.createElement('div'); d.className = 'f'; d.style.cssText = `width:120px;height:60px;background:url(${patternURL(p, 3)}) 0 0 repeat;image-rendering:pixelated`; d.title = p; f.appendChild(d); }
}
const b = document.getElementById('b')!;
for (const s of SERIES) { const i = new Image(); i.src = bannerArt(s, 320, 180); i.style.cssText = 'width:640px;image-rendering:pixelated;margin:4px'; b.appendChild(i); }
for (const m of ['snow', 'stars'] as const) { const i = new Image(); i.src = skyArt(m, 180, 320); i.style.cssText = 'height:360px;image-rendering:pixelated;margin:4px'; b.appendChild(i); }
for (const u of [raysURL(0), raysURL(1), burstURL(), shootURL('#f1d39a', 72), shootURL('#c6bdd6', 72), shootURL('#aec8cc', 72)]) { const i = new Image(); i.src = u; i.style.cssText = 'height:144px;image-rendering:pixelated;margin:4px;background:#27313f'; b.appendChild(i); }
(window as unknown as { __ready: number }).__ready = 1;
