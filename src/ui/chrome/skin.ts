// The chrome's frame-painted CSS: toasts, tonight's ticket, the level-up card, Pip's speech bubble, and
// the soft glint sparkles (painted at device resolution by the realistic kit, injected once the material
// tiles are in; everything else lives in chrome.css).
import { bubbleTail, nineCSS, sealArt } from '../real/kit.ts';
import { hex } from '../real/paint.ts';
import { loadTextures } from '../real/tex.ts';

/** a soft four-point glint, `n` px across, painted at device resolution */
function glint(n: number, a = 1): string {
  const k = Math.min(3, Math.max(1, devicePixelRatio || 1)), c = document.createElement('canvas');
  c.width = c.height = Math.round(n * k);
  const g = c.getContext('2d')!, m = (n * k) / 2;
  g.translate(m, m);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.5);
  gr.addColorStop(0, `rgba(255,252,236,${a})`); gr.addColorStop(0.4, `rgba(255,236,170,${a * 0.5})`); gr.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, m * 0.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = `rgba(255,250,226,${a})`;
  for (const r of [0, Math.PI / 2]) {
    g.save(); g.rotate(r);
    g.beginPath(); g.moveTo(-m, 0); g.quadraticCurveTo(0, -m * 0.09, m, 0); g.quadraticCurveTo(0, m * 0.09, -m, 0); g.fill();
    g.restore();
  }
  return c.toDataURL('image/png');
}

let done = false;
export function installChromeSkin() {
  if (done || typeof document === 'undefined') return;
  done = true;
  void loadTextures().then(() => {
    const u = (s: string) => `url("${s}")`;
    const css = `
:root{--hh-tail:${u(bubbleTail())};--hh-spark0:${u(glint(8, 0.8))};--hh-spark1:${u(glint(14))};--hh-spark2:${u(glint(20))}}
.hh-toast-body{${nineCSS('bubble_bw')}}
.hh-tkt-body{${nineCSS('paper_card', { bw: [6, 6, 6, 4] })};background:none;border-radius:0;box-shadow:none;filter:drop-shadow(0 2px 3px rgba(34,22,46,.4))}
.hh-tkt-stub{${nineCSS('paper_card_kraft', { bw: [6, 4, 6, 6] })};background:none;border-radius:0;box-shadow:none;filter:drop-shadow(0 2px 3px rgba(34,22,46,.4))}
.hh-tkt-seal{position:absolute;right:-14px;top:-9px;width:30px;height:30px;background:${'url("' + sealArt(22) + '")'} 0 0/30px 30px no-repeat;z-index:4;pointer-events:none;filter:none}
.lvup-card{${nineCSS('walnut')};background:var(--paper-bg);background-clip:padding-box}
.lvup-unlock{${nineCSS('sticky_note')}}
.hh-bubble{${nineCSS('bubble_bw')}}
/* [ui10] tool names on stiff card labels; the shop's NEW flag a swallowtail pennant; claimable counts on a wax seal */
.hh-toollabel{${nineCSS('label')};background:none;box-shadow:none;padding:1px 1px 0}
.hh-new{border-radius:0;clip-path:polygon(0 0,100% 0,calc(100% - 5px) 50%,100% 100%,0 100%,5px 50%);padding:2px 9px 1px;box-shadow:none;background:linear-gradient(180deg,#e0544c,#a82a2c 55%,#7a1a1e)}
.hh-badge{border-radius:0;background:${'url("' + sealArt(24, hex('#b02a2e'), 5, false) + '")'} center/32px 32px no-repeat;box-shadow:none}
`;
    const st = document.createElement('style');
    st.id = 'hh-chrome-skin';
    st.textContent = css;
    document.head.appendChild(st);
  });
}
