// Dev page for the realistic UI kit (dev-real.html): every frame, button and material on one sheet.
// ?only=name shows one frame; the timings of each paint are printed in the console.
import { render } from 'preact';
import { loadTextures, TEX_URL } from '../ui/real/tex.ts';
import { crestArt, medallionArt, NINE, nineCSS, roundButton, sliderKnob, switchLever, switchPlate } from '../ui/real/kit.ts';
import { Real, deviceK } from '../ui/real/paint.ts';
import { waxSeal } from '../ui/real/orn.ts';
import '../ui/style.css';

async function main() {
  await loadTextures();
  const t0 = performance.now();
  const times: string[] = [];
  let css = '';
  const only = new URLSearchParams(location.search).get('only');
  const names = Object.keys(NINE).filter((n) => !only || new RegExp(only).test(n));
  for (const n of names) {
    const a = performance.now();
    css += `.f-${n}{${nineCSS(n)}}\n`;
    times.push(`${n} ${(performance.now() - a).toFixed(0)}ms`);
  }
  const seal = (() => { const r = new Real(40, 40, deviceK(3), 4); waxSeal(r, 20, 20, 15); return r.url({ shadow: { dy: 2, blur: 3, a: 0.4 } }); })();
  console.log('kit painted in', (performance.now() - t0).toFixed(0), 'ms\n' + times.join('\n'));
  const st = document.createElement('style');
  st.textContent = css + `
  body{background:url(${TEX_URL.walnut}) 0 0/300px, #3a2416; font-family: var(--font-body)}
  .wrap{display:flex;flex-wrap:wrap;gap:22px;padding:24px;align-items:flex-start}
  .cell{display:flex;flex-direction:column;gap:6px;align-items:center;color:#f5e6c8;font-size:14px}
  .demo{min-width:120px;min-height:48px;display:grid;place-items:center;color:#fff;font-size:16px}
  .demo.wide{min-width:300px}
  .panel{width:330px;height:220px;background:url(${TEX_URL.paper}) 0 0/320px, #ead9b5;background-clip:padding-box;padding:14px;color:#3a2a1c}
  .pcard{background:url(${TEX_URL.paper}) 0 0/320px 320px;background-clip:padding-box;padding:4px 6px;color:#3a2a1c;width:260px}
  `;
  document.head.appendChild(st);
  render(
    <div class="wrap">
      <div class="cell"><div class="f-walnut panel"><div class="f-paper_card pcard">A paper card inside a walnut panel, with its printed rule.</div><button class="f-button_green demo" style="margin-top:10px">Get cozy</button></div>walnut panel</div>
      <div class="cell"><div class="f-oak_panel panel" /> oak_panel</div>
      <div class="cell"><div class="f-ebony panel" style="width:260px;height:160px" /> ebony</div>
      {names.map((n) => (
        <div class="cell"><div class={'f-' + n + ' demo' + (/button|ribbon|tab$|tooltip|bar_track/.test(n) ? ' wide' : '')} style={n.startsWith('bar_fill') ? 'min-width:120px;min-height:12px' : n.startsWith('bar_track') ? 'min-height:12px' : ''}>{n.startsWith('button') ? 'Hold to sleep' : ''}</div><span>{n}</span></div>
      ))}
      <div class="cell"><img src={crestArt()} style="width:100px;height:38px" />crest</div>
      <div class="cell"><img src={medallionArt(60)} style="width:68px;height:68px" />medallion</div>
      <div class="cell"><div style="display:flex;gap:6px"><img src={roundButton(44, 'brass')} style="width:52px;height:52px" /><img src={roundButton(44, 'walnut')} style="width:52px;height:52px" /><img src={roundButton(44, 'green')} style="width:52px;height:52px" /></div>icon buttons</div>
      <div class="cell"><div style="display:flex;align-items:center;width:240px;height:30px;position:relative"><div style={`flex:1;height:14px;${nineCSS('slider_track')}`} /><img src={sliderKnob()} style="position:absolute;left:120px;top:-3px;width:26px;height:36px" /></div>slider</div>
      <div class="cell"><div style="display:flex;gap:12px"><div style={`position:relative;width:64px;height:36px;background:url(${switchPlate(false)}) 0 0/100% 100%`}><img src={switchLever()} style="position:absolute;left:3px;top:2px;width:32px;height:32px" /></div><div style={`position:relative;width:64px;height:36px;background:url(${switchPlate(true)}) 0 0/100% 100%`}><img src={switchLever()} style="position:absolute;left:29px;top:2px;width:32px;height:32px" /></div></div>switch</div>
      <div class="cell"><img src={seal} style="width:48px;height:48px" />wax seal</div>
    </div>,
    document.getElementById('ui')!,
  );
  (window as unknown as { __ready: boolean }).__ready = true;
}
void main();
