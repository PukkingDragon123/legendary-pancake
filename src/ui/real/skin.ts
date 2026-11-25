// Dresses the whole interface in the realistic material kit: carved walnut panels with parchment insides,
// paper cards with soft shadows, enamel buttons with brass rims (and their pressed states), leather tabs,
// brass-rimmed linen trays, satin ribbons, glass bar tubes, paper bubbles and notes. Writes one <style> that
// maps the app's shared classes to frames (kit.ts) and material tiles (tex.ts), plus the texture tokens other
// stylesheets use:
//   --tx-paper --tx-kraft --tx-walnut --tx-oak --tx-leather --tx-cork      colour tiles (url)
//   --tx-linen --tx-linen-dark --tx-velvet-plum --tx-velvet-blue --tx-felt-green --tx-bookcloth-red/green/blue
//   --paper-bg     the parchment background shorthand (layers), --sh-1/2/3 soft shadows, --drop/--drop-lg filters
import { CSS_TOKENS } from '../../gfx/palette.ts';
import { installPxFx } from '../pxfx.tsx';
import { bubbleTail, crestArt, medallionArt, nineCSS, paperCardCSS, paperRimCSS, roundButton, sliderKnob, switchLever, switchPlate } from './kit.ts';
import { hex } from './paint.ts';
import { texAbs, tileURL } from './tex.ts';

let done = false;
export function installRealSkin() {
  if (done || typeof document === 'undefined') return;
  done = true;
  installPxFx();
  const u = (s: string) => `url("${s}")`;
  const tok = `:root{
--tx-paper:${u(texAbs('paper'))};--tx-kraft:${u(texAbs('kraft'))};--tx-walnut:${u(texAbs('walnut'))};--tx-oak:${u(texAbs('oak'))};--tx-leather:${u(texAbs('leather'))};--tx-cork:${u(texAbs('cork'))};
--tx-paper-dark:${u(tileURL('paper', '#d9c49a', 512))};
--tx-linen:${u(tileURL('linen', '#efe3c6', 384))};--tx-linen-dark:${u(tileURL('linen', '#4a4036', 384))};
--tx-velvet-plum:${u(tileURL('velvet', '#5b2a63', 384))};--tx-velvet-blue:${u(tileURL('velvet', '#22345e', 384))};--tx-velvet-green:${u(tileURL('velvet', '#1e4d33', 384))};--tx-velvet-red:${u(tileURL('velvet', '#6e1c22', 384))};
--tx-felt-green:${u(tileURL('felt', '#2c6b43', 384))};--tx-felt-blue:${u(tileURL('felt', '#2b4b86', 384))};--tx-felt-cream:${u(tileURL('felt', '#e8dcc2', 384))};
--tx-bookcloth-red:${u(tileURL('bookcloth', '#7a1f24', 384))};--tx-bookcloth-green:${u(tileURL('bookcloth', '#1f5a39', 384))};--tx-bookcloth-blue:${u(tileURL('bookcloth', '#1e3566', 384))};
--tx-walnut-dark:${u(tileURL('walnut', '#8a7468', 512))};
--sl-knob:${u(sliderKnob())};--sw-off:${u(switchPlate(false))};--sw-on:${u(switchPlate(true))};--sw-lever:${u(switchLever())};--crest:${u(crestArt())};
--rb-cream:${u(roundButton(48, 'cream'))};--rb-cream-dn:${u(roundButton(48, 'cream', true))};--rb-brass:${u(roundButton(48, 'brass'))};--rb-brass-dn:${u(roundButton(48, 'brass', true))};--rb-walnut:${u(roundButton(48, 'walnut'))};--rb-green:${u(roundButton(48, 'green'))};--rb-red:${u(roundButton(48, 'red'))};--rb-night:${u(roundButton(48, 'night'))};
--paper-bg:var(--tx-paper) 0 0/320px 320px,#efe2c4;
--parch-tile:var(--tx-paper);--parch-tile-dark:var(--tx-paper-dark);
--sh-1:0 1px 1.5px rgba(36,22,40,.34),0 2px 5px rgba(36,24,56,.16);
--sh-2:0 2px 3px rgba(36,22,40,.32),0 6px 14px rgba(36,24,56,.2);
--sh-3:0 4px 6px rgba(30,18,40,.34),0 14px 30px rgba(30,20,56,.3);
--drop:drop-shadow(0 2px 3px rgba(34,22,46,.42));
--drop-lg:drop-shadow(0 4px 8px rgba(30,20,50,.45));
--ink-emboss:0 1px 0 rgba(255,250,235,.55);
--gilt-text:0 1px 0 #2a1408,0 0 1px #2a1408,0 2px 3px rgba(0,0,0,.45);
}`;
  // [ui10] paper cards have deckled, printed edges (kit paperCard); nothing in the interface is rounded
  const card = paperCardCSS();
  const sunk = `border-image:none;background:var(--tx-paper-dark) 0 0/320px 320px,#dcc89c;background-clip:border-box;border:10px solid transparent;border-radius:0;box-shadow:inset 0 2px 5px rgba(60,36,14,.38),inset 0 0 0 1px rgba(90,60,30,.25),0 1px 0 rgba(255,248,230,.6)`;
  const ledger = `background:repeating-linear-gradient(180deg,transparent 0 21px,rgba(70,110,170,.22) 21px 22px) 0 6px,linear-gradient(90deg,transparent 0 22px,rgba(196,72,72,.38) 22px 23.5px,transparent 23.5px),var(--tx-paper) 0 0/320px 320px,#f6ecd4;border:8px solid transparent;border-radius:0;background-clip:border-box;box-shadow:var(--sh-1),inset 0 1px 0 rgba(255,255,255,.6)`;
  const css = `${CSS_TOKENS}
${tok}
.sheet{${nineCSS('walnut')};background:var(--paper-bg);background-clip:padding-box}
.modal{${nineCSS('walnut')};background:var(--paper-bg);background-clip:padding-box}
.card{${card}}
.card.sunk{${sunk}}
.modal.card{${nineCSS('walnut')};background:var(--paper-bg);background-clip:padding-box;border-radius:0;box-shadow:none}
.card.night{${nineCSS('walnut_thin')};background:var(--tx-velvet-blue) 0 0/260px,#22345e;background-clip:padding-box;border-radius:0;box-shadow:none}
.btn.pillow{${nineCSS('button_green')}}
.btn.pillow:active{${nineCSS('button_green_down')}}
.btn.pillow.honey{${nineCSS('button_gold')}}
.btn.pillow.honey:active{${nineCSS('button_gold_down')}}
.btn.pillow.berry{${nineCSS('button_red')}}
.btn.pillow.berry:active{${nineCSS('button_red_down')}}
.btn.pillow.night{${nineCSS('button_night')}}
.btn.pillow.night:active{${nineCSS('button_night_down')}}
.btn.soft{${nineCSS('button_cream')}}
.btn.soft:active{${nineCSS('button_cream_down')}}
.btn.oak{${nineCSS('button_oak')}}
.btn.oak:active{${nineCSS('button_oak_down')}}
.btn.pillow:disabled,.btn.soft:disabled{${nineCSS('button_disabled')}}
.tag{${nineCSS('tab')}}
.tag.on{${nineCSS('tab_active')}}
.seg{background:var(--tx-paper-dark) 0 0/320px,#d8c398;border-radius:0;padding:4px;box-shadow:inset 0 2px 5px rgba(60,36,14,.4),inset 0 0 0 1px rgba(90,60,30,.25),0 1px 0 rgba(255,248,230,.6)}
.seg button{${nineCSS('tab')}}
.seg button.on{${nineCSS('tab_active')}}
.tile{${nineCSS('slot_brass')}}
.tile.on{${nineCSS('slot_gold_active')}}
.chip,.profile{${nineCSS('chip')}}
.icon-btn{border:0;background:${u(roundButton(44, 'brass'))} center/100% 100% no-repeat}
.icon-btn:active{background-image:${u(roundButton(44, 'brass', true))}}
.icon-btn.dark{background-image:${u(roundButton(44, 'walnut'))}}
.dock{${nineCSS('wood')};background:var(--tx-oak) 0 0/300px;background-clip:padding-box}
.dock-item.on{${nineCSS('slot_gold_active')}}
.bubble{${nineCSS('bubble_bw')}}
.bubble::after{background:${u(bubbleTail())} no-repeat 0 0/100% 100%}
.toast{${nineCSS('sticky_note')}}
.ticket{${ledger}}
.field{${nineCSS('input')}}
.lvbar{${nineCSS('bar_track')}}
.lvbar>i{${nineCSS('bar_fill_gold')}}
.journal-cover{${nineCSS('ebony')};background:var(--tx-bookcloth-red) 0 0/260px,#6e1c22;background-clip:padding-box}
.page{${ledger}}
.polaroid{${card}}
.plus-card{${nineCSS('ebony')};background:var(--tx-velvet-blue) 0 0/260px,#22345e;background-clip:padding-box}
.shelf{${nineCSS('wood')};background:var(--tx-oak) 0 0/300px;background-clip:padding-box}
.map{${card}}
.pattern{${nineCSS('tab')}}
.pattern.on{${nineCSS('slot_gold_active')}}
.slide{${nineCSS('bar_track')}}
.stat{${nineCSS('tab')}}
.mood{${nineCSS('tab')}}
.mood.on{${nineCSS('tab_active')}}
.rarity{${nineCSS('chip')}}
.portrait{background:${u(medallionArt(60, hex('#2f4f9a')))} no-repeat center/100% 100%}
.seal{background:${u(medallionArt(60, hex('#a8303a')))} no-repeat center/100% 100%}
.title-ribbon{${nineCSS('ribbon_green')}}
.title-ribbon.red{${nineCSS('ribbon_red')}}
.ribbon-head{${nineCSS('ribbon_green')}}
.plaque{${nineCSS('plaque')}}
.quest.ready{${nineCSS('sticky_note')};border-radius:0;box-shadow:none;background:none}
.quest.claimed{${sunk}}
.qbar{${nineCSS('bar_track')}}
.qbar>i{${nineCSS('bar_fill_green')}}
.quest.ready .qbar>i{${nineCSS('bar_fill_gold')}}
.pick{${nineCSS('slot_brass')}}
.pick.on{${nineCSS('slot_gold_active')}}
.pick.locked{${nineCSS('slot_locked')}}
.pick.sound-tile{${nineCSS('slot_brass')}}
.pick.sound-tile.on{${nineCSS('slot_gold_active')}}
.think{${nineCSS('bubble_think')}}
.tooltip{${nineCSS('tooltip')};color:#f6e9cf}
/* [ui10] a carved cartouche crest (oak leaves, acorns, the owl in a gilt boss) on every cabinet's top rail */
.sheet::before{content:'';position:absolute;left:50%;top:-22px;width:104px;height:44px;margin-left:-52px;background:var(--crest) center/104px 44px no-repeat;pointer-events:none;z-index:3}
.sheet.qb::before,.sheet.wd::before{top:-24px}
/* [ui10] toggles are real switches: a walnut plate with a brass escutcheon, a square-cut brass lever */
.toggle{background:var(--sw-off) center/64px 36px no-repeat}
.toggle.on{background-image:var(--sw-on)}
.toggle .trk,.toggle.on .trk{background:none;box-shadow:none;border-radius:0}
.toggle .knob{left:-1px;top:-1px;width:32px;height:32px;border-radius:0;background:var(--sw-lever) 0 0/32px 32px no-repeat;box-shadow:none}
/* [ui10] sliders are brass levers in carved walnut tracks */
input[type='range'].slider{height:40px}
input[type='range'].slider::-webkit-slider-runnable-track{height:14px;border-radius:0;box-shadow:none;background:none;${nineCSS('slider_track')}}
input[type='range'].slider::-moz-range-track{height:14px;border-radius:0;box-shadow:none;background:none;${nineCSS('slider_track')}}
input[type='range'].slider::-webkit-slider-thumb{width:26px;height:36px;margin-top:-11px;border-radius:0;background:var(--sl-knob) 0 0/26px 36px no-repeat;box-shadow:none}
input[type='range'].slider::-moz-range-thumb{width:26px;height:36px;border-radius:0;background:var(--sl-knob) 0 0/26px 36px no-repeat;box-shadow:none}
/* [ui10] CSS paper that isn't a card gets the deckled, outlined rim (no layout change) */
.seg,.shelf .slot small,.pinpt .flag{${paperRimCSS('#e8d6ae')}}
.card.sunk{${paperRimCSS('#d9c49a', '10px')}}
.ticket,.page{${paperRimCSS('#f0e4c8', '8px')}}
/* [ui10] build mode: the blueprint pinned in a walnut drafting frame; enamel and brass buttons; paper labels */
.bm-drawer{${nineCSS('walnut_thin', { bw: [7, 7, 7, 7] })};background-clip:padding-box;padding:4px 4px 6px;box-shadow:6px 9px 17px rgba(12,34,64,.6)}
.bm-drawer::before,.bm-drawer::after{display:none}
.bm-floors{${nineCSS('walnut_thin', { bw: [5, 5, 5, 5] })};background-clip:padding-box;padding:3px;box-shadow:4px 6px 11px rgba(12,34,64,.5)}
.bm-floor.on,.bm-tab.on{${nineCSS('label', { bw: [3, 4, 3, 4] })};background:none;box-shadow:none}
.bm-label{${nineCSS('label', { bw: [2, 6, 2, 6] })};background:none;box-shadow:none;padding:1px 4px 2px}
.bm-done{${nineCSS('button_green', { bw: [5, 8, 8, 6] })};background:none;box-shadow:none;padding:2px 4px 2px 2px}
.bm-done:active{${nineCSS('button_green_down', { bw: [5, 8, 8, 6] })};background:none;box-shadow:none}
.bm-vbtn{${nineCSS('button_cream', { bw: [4, 4, 7, 4] })};background:none;box-shadow:none}
.bm-vbtn:active{${nineCSS('button_cream_down', { bw: [4, 4, 7, 4] })};background:none;box-shadow:none}
.bm-vbtn.on{${nineCSS('button_gold', { bw: [4, 4, 7, 4] })};background:none;box-shadow:none}
.bm-act{${nineCSS('button_cream', { bw: [4, 4, 7, 4] })};background:none;box-shadow:none;padding:2px 2px 1px}
.bm-act.buy,.bm-act.move.on{${nineCSS('button_gold', { bw: [4, 4, 7, 4] })};background:none}
.bm-act.yes,.bm-act.move{${nineCSS('button_green', { bw: [4, 4, 7, 4] })};background:none;color:#fbf4e6}
.bm-act.no{${nineCSS('button_red', { bw: [4, 4, 7, 4] })};background:none;color:#fbf4e6}
.bm-act.turn{${nineCSS('button_sky', { bw: [4, 4, 7, 4] })};background:none;color:#fbf4e6}
.bm-act:active{transform:translateY(2px)}
/* [ui10] the morning: the reward on a gilt-edged card, the rarity on a swallowtail pennant, the haul in walnut frames on velvet */
.mr-card{${paperCardCSS(true)};padding:6px 6px 4px}
.mr-rarity{clip-path:polygon(0 0,100% 0,calc(100% - 7px) 50%,100% 100%,0 100%,7px 50%);padding:2px 16px 4px}
.haul-item{${nineCSS('walnut_thin', { bw: [6, 6, 6, 6] })};background:var(--tx-velvet-blue) 0 0/260px,#22345e;background-clip:padding-box;box-shadow:none;padding:2px 2px 4px}
/* [ui10] the globe: place names on card labels, the souvenir tabs as index tabs, brass-and-glass bars, pennants, a brass close plate */
.gb-lbl{${nineCSS('label', { bw: [1, 3, 1, 3] })};background:none;color:#2a2016;box-shadow:none}
.gb-lbl.tonight{${nineCSS('label_kraft', { bw: [1, 3, 1, 3] })};background:none;color:#3a2410}
.gb-lbl.locked{${nineCSS('label', { bw: [1, 3, 1, 3] })};background:none;color:#6a6258;filter:saturate(.4) brightness(.8)}
.gb-pin.on .gb-lbl{${nineCSS('label_kraft', { bw: [2, 4, 2, 4] })};background:none;box-shadow:none}
.gb-tag,.gb-rar{clip-path:polygon(0 0,100% 0,calc(100% - 5px) 50%,100% 100%,0 100%);padding-right:10px}
.gb-souvtabs button{${nineCSS('tab', { bw: [4, 6, 3, 6] })};background:none;box-shadow:none;color:#f6ecd2}
.gb-souvtabs button.on{${nineCSS('tab_active', { bw: [4, 6, 3, 6] })};background:none;color:#3a2410}
.gb-bar{${nineCSS('bar_track', { bw: [3, 6, 3, 6] })};height:14px;background:none;box-shadow:none}
.gb-bar i{${nineCSS('bar_fill_green', { bw: [0, 0, 0, 0] })};background:none;box-shadow:none}
.gb-close{background:${u(roundButton(34, 'cream'))} center/100% 100% no-repeat;box-shadow:none}
`;
  const st = document.createElement('style');
  st.id = 'hh-real-skin';
  st.textContent = css;
  document.head.appendChild(st);
}
