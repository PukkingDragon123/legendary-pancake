// The chrome's frame-painted CSS (BME 9-slice frames and sprite backgrounds need runtime-made
// data URLs, so they are injected once here; everything else lives in chrome.css).
import { frameStyle, frameURL } from '../px/frames.js';
import { spriteURL } from '../px/sprites.js';
import '../px/chromeart.js';

let done = false;
export function installChromeSkin() {
  if (done || typeof document === 'undefined') return;
  done = true;
  const k = Math.min(4, Math.max(1, Math.round(devicePixelRatio || 1)));
  const sp = (n: string, s = 2) => `url("${spriteURL(n, s * k)}")`;
  const css = `
:root{--hh-tail:url("${frameURL('bubble_tail', 2 * k)}");--hh-plus:${sp('hud_plus')};--hh-plus-dn:${sp('hud_plus_dn')};--hh-spark0:${sp('fx_spark_0')};--hh-spark1:${sp('fx_spark_1')};--hh-spark2:${sp('fx_spark_2')}}
.hh-toast-body{${frameStyle('parchment', 2)}}
.hh-tkt-body{${frameStyle('paper_ledger', 2)}}
.hh-tkt-stub{${frameStyle('parchment_dark', 2)}}
.lvup-card{${frameStyle('parchment', 3)}}
.lvup-unlock{${frameStyle('sticky_note', 2)}}
.hh-bubble{${frameStyle('bubble_bw', 2)}}
`;
  const st = document.createElement('style');
  st.id = 'hh-chrome-skin';
  st.textContent = css;
  document.head.appendChild(st);
}
