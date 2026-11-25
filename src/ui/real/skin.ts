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
import { bubbleTail, medallionArt, nineCSS, roundButton } from './kit.ts';
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
--paper-bg:var(--tx-paper) 0 0/320px 320px,#efe2c4;
--parch-tile:var(--tx-paper);--parch-tile-dark:var(--tx-paper-dark);
--sh-1:0 1px 1.5px rgba(40,22,10,.32),0 2px 5px rgba(40,22,10,.16);
--sh-2:0 2px 3px rgba(40,22,10,.3),0 6px 14px rgba(40,22,10,.2);
--sh-3:0 4px 6px rgba(30,16,8,.32),0 14px 30px rgba(30,16,8,.3);
--drop:drop-shadow(0 2px 3px rgba(40,24,12,.42));
--drop-lg:drop-shadow(0 4px 8px rgba(30,18,8,.45));
--ink-emboss:0 1px 0 rgba(255,250,235,.55);
--gilt-text:0 1px 0 #2a1408,0 0 1px #2a1408,0 2px 3px rgba(0,0,0,.45);
}`;
  const card = `background:var(--tx-paper) 0 0/320px 320px,#f3e7cc;background-clip:border-box;border:10px solid transparent;border-radius:12px;box-shadow:var(--sh-1),inset 0 1px 0 rgba(255,255,255,.55),inset 0 0 0 1px rgba(120,84,40,.18),inset 0 -3px 8px rgba(120,80,30,.12)`;
  const sunk = `background:var(--tx-paper-dark) 0 0/320px 320px,#dcc89c;background-clip:border-box;border:10px solid transparent;border-radius:12px;box-shadow:inset 0 2px 5px rgba(60,36,14,.38),inset 0 0 0 1px rgba(90,60,30,.25),0 1px 0 rgba(255,248,230,.6)`;
  const ledger = `background:repeating-linear-gradient(180deg,transparent 0 21px,rgba(70,110,170,.22) 21px 22px) 0 6px,linear-gradient(90deg,transparent 0 22px,rgba(196,72,72,.38) 22px 23.5px,transparent 23.5px),var(--tx-paper) 0 0/320px 320px,#f6ecd4;border:8px solid transparent;border-radius:6px;background-clip:border-box;box-shadow:var(--sh-1),inset 0 1px 0 rgba(255,255,255,.6)`;
  const css = `${CSS_TOKENS}
${tok}
.sheet{${nineCSS('walnut')};background:var(--paper-bg);background-clip:padding-box}
.modal{${nineCSS('walnut')};background:var(--paper-bg);background-clip:padding-box}
.card{${card}}
.card.sunk{${sunk}}
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
.seg{background:var(--tx-paper-dark) 0 0/320px,#d8c398;border-radius:12px;padding:4px;box-shadow:inset 0 2px 5px rgba(60,36,14,.4),inset 0 0 0 1px rgba(90,60,30,.25),0 1px 0 rgba(255,248,230,.6)}
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
.polaroid{${card};background-color:#fbf6ea}
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
`;
  const st = document.createElement('style');
  st.id = 'hh-real-skin';
  st.textContent = css;
  document.head.appendChild(st);
}
