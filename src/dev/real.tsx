// Dev page for the realistic UI kit (dev-real.html): every frame, button and material on one sheet.
// ?only=name shows one frame; the timings of each paint are printed in the console.
import { render } from 'preact';
import { loadTextures, TEX_URL } from '../ui/real/tex.ts';
import { NINE, nineCSS } from '../ui/real/kit.ts';
import '../ui/style.css';

async function main() {
  await loadTextures();
  const t0 = performance.now();
  const times: string[] = [];
  let css = '';
  for (const n of Object.keys(NINE)) {
    const a = performance.now();
    css += `.f-${n}{${nineCSS(n)}}\n`;
    times.push(`${n} ${(performance.now() - a).toFixed(0)}ms`);
  }
  console.log('kit painted in', (performance.now() - t0).toFixed(0), 'ms\n' + times.join('\n'));
  const st = document.createElement('style');
  st.textContent = css + `
  body{background:url(${TEX_URL.walnut}) 0 0/300px, #3a2416; font-family: var(--font-body)}
  .wrap{display:flex;flex-wrap:wrap;gap:22px;padding:24px;align-items:flex-start}
  .cell{display:flex;flex-direction:column;gap:6px;align-items:center;color:#f5e6c8;font-size:16px}
  .demo{min-width:120px;min-height:48px;display:grid;place-items:center;color:#fff;font-size:16px}
  .panel{width:330px;height:260px;background:url(${TEX_URL.paper}) 0 0/320px, #ead9b5;background-clip:padding-box;padding:14px;color:#3a2a1c}
  .card{background:url(${TEX_URL.paper}) 0 0/320px, #f3e7cc;border-radius:10px;padding:12px;box-shadow:0 2px 3px rgba(40,20,8,.25),0 6px 14px rgba(40,20,8,.18),inset 0 0 0 1px rgba(255,255,255,.35),inset 0 -2px 6px rgba(120,80,30,.15)}
  `;
  document.head.appendChild(st);
  const names = Object.keys(NINE);
  render(
    <div class="wrap">
      <div class="cell"><div class="f-walnut panel"><div class="card">A paper card inside a walnut panel</div><p style="margin-top:12px">Panel text on parchment.</p><button class="f-button_green demo" style="margin-top:10px">Get cozy</button></div>walnut panel</div>
      {names.map((n) => (
        <div class="cell"><div class={'f-' + n + ' demo'} style={n.startsWith('bar_fill') ? 'min-width:120px;min-height:12px' : n.startsWith('bar_track') ? 'min-height:12px' : ''}>{n.startsWith('button') ? 'Button' : ''}</div><span>{n}</span></div>
      ))}
    </div>,
    document.getElementById('ui')!,
  );
  (window as unknown as { __ready: boolean }).__ready = true;
}
void main();
