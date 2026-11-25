// The chrome's frame-painted CSS: toasts, tonight's ticket, the level-up card, Pip's speech bubble, and
// the soft glint sparkles (painted at device resolution by the realistic kit, injected once the material
// tiles are in; everything else lives in chrome.css).
import { bubbleTail, nineCSS } from '../real/kit.ts';
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
.hh-tkt-body{background:repeating-linear-gradient(180deg,transparent 0 19px,rgba(70,110,170,.2) 19px 20px) 0 4px,var(--tx-paper) 0 0/320px,#f6ecd4;border-radius:4px 10px 10px 4px;box-shadow:var(--sh-2),inset 0 1px 0 rgba(255,255,255,.6),inset 0 -2px 6px rgba(120,80,30,.12)}
.hh-tkt-stub{background:var(--tx-paper-dark) 0 0/320px,#e0cc9f;border-radius:10px 4px 4px 10px;box-shadow:var(--sh-2),inset 0 1px 0 rgba(255,255,255,.45),inset 0 -2px 6px rgba(120,80,30,.16)}
.lvup-card{${nineCSS('walnut')};background:var(--paper-bg);background-clip:padding-box}
.lvup-unlock{${nineCSS('sticky_note')}}
.hh-bubble{${nineCSS('bubble_bw')}}
`;
    const st = document.createElement('style');
    st.id = 'hh-chrome-skin';
    st.textContent = css;
    document.head.appendChild(st);
  });
}
