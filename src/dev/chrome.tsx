// Dev page for the UI chrome: every animated icon's frame sheet, the HUD signs, the main buttons,
// particles and transitions. ?view=sheet|hud|fx|trans|lvup
import { SPRITES, spriteURL } from '../ui/px/sprites.js';
import '../ui/px/chromeart.js';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'sheet';
const root = document.getElementById('ui')!;
if (view === 'sheet') {
  const scale = +(q.get('s') ?? 4);
  const groups = new Map<string, string[]>();
  for (const n of Object.keys(SPRITES)) {
    if (!/^(nav_|tool_|hud_|fx_|tr_)/.test(n)) continue;
    if (q.get('only') && !new RegExp(q.get('only')!).test(n)) continue;
    const base = n.replace(/_?\d+$/, '');
    (groups.get(base) ?? groups.set(base, []).get(base)!).push(n);
  }
  root.style.cssText = 'padding:8px;color:#fff;font:11px monospace;display:flex;flex-direction:column;gap:6px';
  for (const [base, names] of groups) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap';
    row.innerHTML = `<span style="width:110px">${base}</span>` + names.map((n) => `<img style="image-rendering:pixelated;background:${base.startsWith('nav_sleep') ? '#1c2148' : base.startsWith('nav_') ? '#4a3a2c' : '#3a3046'}" src="${spriteURL(n, scale)}" title="${n}">`).join('');
    root.appendChild(row);
  }
}
(window as unknown as { __ready: number }).__ready = 1;
