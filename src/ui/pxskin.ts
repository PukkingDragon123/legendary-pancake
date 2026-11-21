// Dresses the interface in Hoot Hollow's own pixel-art frames (ui/px/frames.js, repainted in the
// calm "Moss & Moonlight" palette): planked wooden boards with oat-paper insides, fibrous parchment
// cards, mossy, honey, berry and dusk pixel buttons with pressed states, tabs, brass item slots,
// the turned wooden medallion, paper speech bubbles, honey sticky notes and ledger paper. Frames are
// painted at device resolution so every art pixel is crisp; this writes one <style> mapping app
// classes to frames, plus the palette's CSS tokens and the shared pixel textures.
import { CSS_TOKENS } from '../gfx/palette.ts';
import { frameStyle, frameURL } from './px/frames.js';
import { installPxFx } from './pxfx.tsx';

const noFill = (name: string, scale: number) => frameStyle(name, scale).replace(/ fill(?=;|$)/, '');
const devK = () => Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1)));
const fixedBg = (name: string, scale: number) => `url("${frameURL(name, scale * devK())}")`;

const hash = (x: number, y: number, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

/**
 * A tileable paper texture at pixel resolution: oat ground, faint cloudy mottling, hair-thin
 * fibres in two tones, a few flecks of bark and one tiny sage thread. `n` texels square.
 */
function paperTile(base = '#eae0c8', tones = ['#e4d9be', '#f2ebd8', '#d8cba9', '#c7b58e', '#b9c39a'], n = 32, seed = 3): string {
  const k = devK() * 3;
  const c = document.createElement('canvas');
  c.width = c.height = n * k;
  const g = c.getContext('2d')!;
  g.fillStyle = base; g.fillRect(0, 0, c.width, c.height);
  const px = (x: number, y: number, col: string) => { g.fillStyle = col; g.fillRect((((x % n) + n) % n) * k, (((y % n) + n) % n) * k, k, k); };
  // mottling: soft clouds made of single darker pixels (periodic)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = Math.sin((x / n) * Math.PI * 2 * 2 + seed) + Math.cos((y / n) * Math.PI * 2 * 3 + seed * 2) + Math.sin(((x + y) / n) * Math.PI * 2);
    if (v > 1.6 && hash(x, y, seed) > 0.45) px(x, y, tones[0]);
  }
  // fibres
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(hash(i, 1, seed) * n), y = Math.floor(hash(i, 2, seed) * n), a = (hash(i, 3, seed) - 0.5) * 1.5, len = 2 + Math.floor(hash(i, 4, seed) * 4);
    const col = hash(i, 5, seed) < 0.55 ? tones[1] : tones[2];
    for (let j = 0; j < len; j++) px(Math.round(x + Math.cos(a) * j), Math.round(y + Math.sin(a) * j * 0.6), col);
  }
  // flecks and one sage thread
  for (let i = 0; i < 7; i++) px(Math.floor(hash(i, 8, seed) * n), Math.floor(hash(i, 9, seed) * n), tones[3]);
  for (let j = 0; j < 3; j++) px(5 + j, 21 + (j >> 1), tones[4]);
  return `url("${c.toDataURL()}")`;
}

export function installPixelSkin() {
  installPxFx();
  const tile = paperTile();
  const tileD = paperTile('#dccfb0', ['#d5c7a6', '#e6dbc0', '#c8b892', '#b9a780', '#a7b788'], 32, 7);
  const css = `${CSS_TOKENS}
:root{--parch-tile:${tile};--parch-tile-dark:${tileD};--paper-bg:var(--parch-tile) 0 0/96px 96px,#eae0c8}
.sheet{${noFill('wood', 3)};background:var(--parch-tile) 0 0/96px 96px,#eae0c8;background-clip:padding-box}
.card{${frameStyle('parchment', 2)}}
.card.sunk{${frameStyle('parchment_dark', 2)}}
.card.night{${frameStyle('wood_dark', 2)}}
.btn.pillow{${frameStyle('button_green', 3)}}
.btn.pillow:hover{${frameStyle('button_green_hover', 3)}}
.btn.pillow:active{${frameStyle('button_green_down', 3)}}
.btn.pillow.honey{${frameStyle('button_gold', 3)}}
.btn.pillow.honey:active{${frameStyle('button_gold_down', 3)}}
.btn.pillow.berry{${frameStyle('button_red', 3)}}
.btn.pillow.berry:active{${frameStyle('button_red_down', 3)}}
.btn.pillow.night{${frameStyle('button_night', 3)}}
.btn.pillow.night:active{${frameStyle('button_night_down', 3)}}
.btn.soft{${frameStyle('button_cream', 2)}}
.btn.soft:active{${frameStyle('button_cream_down', 2)}}
.btn.oak{${frameStyle('wood', 2)}}
.btn.pillow:disabled,.btn.soft:disabled{${frameStyle('button_disabled', 3)}}
.tag{${frameStyle('tab', 2)}}
.tag.on{${frameStyle('button_gold', 2)}}
.seg{${frameStyle('parchment_dark', 2)}}
.seg button{${frameStyle('tab', 2)}}
.seg button.on{${frameStyle('button_gold', 2)}}
.tile{${frameStyle('slot_brass', 2)}}
.tile.on{${frameStyle('slot_gold_active', 2)}}
.chip,.profile{${frameStyle('chip', 2)}}
.icon-btn{${frameStyle('slot_gold', 2)}}
.icon-btn.dark{${frameStyle('wood_dark', 2)}}
.dock{${frameStyle('wood', 3)}}
.dock-item.on{${frameStyle('slot_gold_active', 2)}}
.bubble{${frameStyle('bubble_bw', 2)}}
.bubble::after{background:${fixedBg('bubble_tail', 2)} no-repeat 0 0/100% 100%}
.toast{${frameStyle('sticky_note', 2)}}
.ticket{${frameStyle('paper_ledger', 2)}}
.field{${frameStyle('input', 2)}}
.lvbar{${frameStyle('bar_track', 2)}}
.lvbar>i{${frameStyle('bar_fill_gold', 2)}}
.journal-cover{${frameStyle('wood_dark', 3)}}
.page{${frameStyle('paper_ledger', 2)}}
.polaroid{${frameStyle('parchment', 2)}}
.plus-card{${frameStyle('wood_dark', 3)}}
.shelf{${frameStyle('wood', 2)}}
.map{${frameStyle('parchment', 3)}}
.pattern{${frameStyle('tab', 2)}}
.pattern.on{${frameStyle('slot_gold_active', 2)}}
.slide{${frameStyle('bar_track', 3)}}
.stat{${frameStyle('tab', 2)}}
.mood{${frameStyle('tab', 2)}}
.mood.on{${frameStyle('button_gold', 2)}}
.rarity{${frameStyle('chip', 2)}}
.portrait{background:${fixedBg('medallion', 2)} no-repeat 0 0/100% 100%}
.seal{background:${fixedBg('medallion', 3)} no-repeat 0 0/100% 100%}
.title-ribbon{${frameStyle('ribbon_green', 2)}}
.plaque{${frameStyle('plaque', 2)}}
.modal{${noFill('parchment', 3)};background:var(--parch-tile) 0 0/96px 96px,#eae0c8;background-clip:padding-box}
.quest.ready{${frameStyle('sticky_note', 2)}}
.quest.claimed{${frameStyle('parchment_dark', 2)}}
.qbar{${frameStyle('bar_track', 2)}}
.qbar>i{${frameStyle('bar_fill_green', 2)}}
.quest.ready .qbar>i{${frameStyle('bar_fill_gold', 2)}}
.title-ribbon.red{${frameStyle('ribbon_red', 2)}}
.ribbon-head{${frameStyle('ribbon_green', 2)}}
.pick{${frameStyle('slot_brass', 2)}}
.pick.on{${frameStyle('slot_gold_active', 2)}}
.pick.locked{${frameStyle('slot_locked', 2)}}
.pick.sound-tile{${frameStyle('slot_brass', 1)}}
.pick.sound-tile.on{${frameStyle('slot_gold_active', 1)}}
.think{${frameStyle('bubble_think', 2)}}
.tooltip{${frameStyle('tooltip', 2)}}
`;
  const st = document.createElement('style');
  st.id = 'hh-pixel-skin';
  st.textContent = css;
  document.head.appendChild(st);
}
