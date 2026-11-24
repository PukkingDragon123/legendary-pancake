// Dresses the interface in Hoot Hollow's own pixel-art frames (ui/px/frames.js, repainted in the
// calm "Moss & Moonlight" palette): planked wooden boards with oat-paper insides, fibrous parchment
// cards, mossy, honey, berry and dusk pixel buttons with pressed states, tabs, brass item slots,
// the turned wooden medallion, paper speech bubbles, honey sticky notes and ledger paper. Frames are
// painted at device resolution so every art pixel is crisp; this writes one <style> mapping app
// classes to frames, plus the palette's CSS tokens and the shared pixel textures.
import { CSS_TOKENS } from '../gfx/palette.ts';
import { frameStyle, frameURL } from './px/frames.js';
import { installPxFx } from './pxfx.tsx';
import { paperAt, PAPER, PAPER_DARK } from './px/materials.js';

const noFill = (name: string, scale: number) => frameStyle(name, scale).replace(/ fill(?=;|$)/, '');
const devK = () => Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1)));
const fixedBg = (name: string, scale: number) => `url("${frameURL(name, scale * devK())}")`;


/**
 * A tileable sheet of oat paper in the manner of BUSHED's paper.ts: fibres, cloudy mottling, foxing and a grain
 * of single texels, painted at one texel per CSS px (so it reads as fine, real paper). `n` texels square.
 */
function paperTile(dark = false, n = 128, seed = 3): string {
  const k = devK();
  const t = document.createElement('canvas');
  t.width = t.height = n;
  const tg = t.getContext('2d')!;
  const img = tg.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const col = paperAt(x, y, n, n, { ramp: dark ? PAPER_DARK : PAPER, seed, base: dark ? 0.58 : 0.66 });
    const i = (y * n + x) * 4;
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2]; img.data[i + 3] = 255;
  }
  tg.putImageData(img, 0, 0);
  const c = document.createElement('canvas');
  c.width = c.height = n * k;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(t, 0, 0, n * k, n * k);
  return `url("${c.toDataURL()}")`;
}

export function installPixelSkin() {
  installPxFx();
  const tile = paperTile(false, 128, 3);
  const tileD = paperTile(true, 128, 7);
  const css = `${CSS_TOKENS}
:root{--parch-tile:${tile};--parch-tile-dark:${tileD};--paper-bg:var(--parch-tile) 0 0/128px 128px,#e6dcc2}
.sheet{${noFill('wood', 3)};background:var(--parch-tile) 0 0/128px 128px,#e6dcc2;background-clip:padding-box}
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
.modal{${noFill('parchment', 3)};background:var(--parch-tile) 0 0/128px 128px,#e6dcc2;background-clip:padding-box}
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
