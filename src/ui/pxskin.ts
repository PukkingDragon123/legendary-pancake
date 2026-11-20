// Dresses the interface in The Bear Must Eat's pixel-art frames (ui/px/frames.js): wooden boards
// with paper insides, parchment cards, pixel buttons with pressed states, tabs, gold item slots, the
// wooden medallion, speech bubbles, sticky notes and ledger paper. Frames are painted at device
// resolution so every art pixel is crisp; this writes one <style> mapping app classes to frames.
import { frameStyle, frameURL } from './px/frames.js';

const noFill = (name: string, scale: number) => frameStyle(name, scale).replace(/ fill(?=;|$)/, '');
const fixedBg = (name: string, scale: number) => {
  const k = Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1)));
  return `url("${frameURL(name, scale * k)}")`;
};

/** A small paper texture tile at pixel resolution (flecks and fibres), for board interiors. */
function paperTile(): string {
  const n = 16, k = Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1))) * 3;
  const c = document.createElement('canvas');
  c.width = c.height = n * k;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3e2b8'; g.fillRect(0, 0, c.width, c.height);
  const dots: [number, number, string][] = [[2, 3, '#ead39f'], [9, 1, '#ead39f'], [13, 6, '#fbf0d0'], [5, 9, '#ead39f'], [11, 12, '#e2c992'], [1, 14, '#fbf0d0'], [7, 5, '#fbf0d0'], [14, 14, '#ead39f'], [3, 12, '#ead39f'], [10, 8, '#ead39f']];
  for (const [x, y, col] of dots) { g.fillStyle = col; g.fillRect(x * k, y * k, k, k); if (col === '#ead39f') g.fillRect((x + 1) * k, y * k, k, k); }
  return `url("${c.toDataURL()}")`;
}

export function installPixelSkin() {
  const tile = paperTile();
  const css = `
:root{--parch-tile:${tile}}
.sheet{${noFill('wood', 3)};background:var(--parch-tile) 0 0/48px 48px,#f3e2b8;background-clip:padding-box}
.card{${frameStyle('parchment', 2)}}
.card.sunk{${frameStyle('parchment_dark', 2)}}
.card.night{${frameStyle('wood_dark', 2)}}
.btn.pillow{${frameStyle('button_green', 3)}}
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
.modal{${frameStyle('parchment', 3)}}
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
