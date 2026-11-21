// Dev page for the UI chrome. ?view=
//   sheet   every animated icon's frame sheet (and the HUD/particle/transition sprites); &only=regex &s=scale
//   anim    the main-button and tool animations playing at their real size and timing
//   parts   the procedurally painted boards, plaques, tags, branch, rope and chain
//   fx      one burst of every UI particle kind, frozen mid-flight
//   trans   one transition frame: &kind=iris|leaves|snow|page|blueprint|stars|fade &p=0.5 &phase=in|out
import { render } from 'preact';
import { SPRITES, spriteURL } from '../ui/px/sprites.js';
import '../ui/px/chromeart.js';
import { CHROME_TIMELINES } from '../ui/chrome/hud.tsx';
import { PxAnim } from '../ui/chrome/pxanim.tsx';
import { branch, chainTile, plank, plaque, ropeTile, shelf, tag } from '../ui/chrome/paint.ts';
import { uiAdvance, uiBurst, type UiFxKind } from '../ui/chrome/uifx.ts';
import { previewTransition, type TransitionKind } from '../ui/chrome/transition.ts';
import { MagicBar } from '../ui/chrome/magicbar.tsx';
import '../ui/style.css';

const q = new URLSearchParams(location.search);
const view = q.get('view') ?? 'sheet';
const root = document.getElementById('ui')!;
const label = 'color:#f3e2b8;font:12px monospace';

if (view === 'sheet') {
  const scale = +(q.get('s') ?? 4);
  const groups = new Map<string, string[]>();
  for (const n of Object.keys(SPRITES)) {
    if (!/^(nav_|tool_|hud_|fx_|tr_)/.test(n)) continue;
    if (q.get('only') && !new RegExp(q.get('only')!).test(n)) continue;
    const base = n.replace(/_?\d+$/, '');
    (groups.get(base) ?? groups.set(base, []).get(base)!).push(n);
  }
  root.style.cssText = 'padding:8px;display:flex;flex-direction:column;gap:6px';
  for (const [base, names] of groups) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap';
    const bg = base.startsWith('nav_sleep') ? '#1c2148' : base.startsWith('nav_clock') ? '#ecd3a0' : base.startsWith('nav_book') ? '#1f3e3a' : '#4a3a2c';
    row.innerHTML = `<span style="width:110px;${label}">${base}</span>` + names.map((n) => `<img style="image-rendering:pixelated;background:${bg}" src="${spriteURL(n, scale)}" title="${n}">`).join('');
    root.appendChild(row);
  }
}

if (view === 'anim') {
  const { MAIN, TOOLS } = CHROME_TIMELINES;
  render(
    <div style="padding:12px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;gap:16px">{MAIN.map((m) => <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style={`background:${m.inner === 'night' ? '#1c2148' : m.inner === 'paper' ? '#ecd3a0' : '#1f3e3a'};padding:8px`}><PxAnim tl={m.tl} size={128} /></div><span style={label}>{m.label}</span></div>)}</div>
      <div style="display:flex;gap:16px">{TOOLS.map((t) => <div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="background:#4a3a2c;padding:6px"><PxAnim tl={t.tl} size={88} /></div><span style={label}>{t.label}</span></div>)}</div>
      <div style="display:flex;gap:16px;align-items:center"><MagicBar level={3} into={40} need={100} w={56} big /><MagicBar level={3} into={85} need={100} w={56} /></div>
    </div>,
    root,
  );
}

if (view === 'parts') {
  const img = (src: string, w: number, h: number, t: string) => <div style="display:flex;flex-direction:column;gap:2px"><img src={src} style={`width:${w}px;height:${h}px;image-rendering:pixelated`} /><span style={label}>{t}</span></div>;
  render(
    <div style="padding:12px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end">
      {img(plank(96, 36, { seed: 4, nails: [[26, 4], [71, 4]], carve: true }), 288, 108, 'name board')}
      {img(plank(62, 20, { seed: 7, nails: [[11, 3], [51, 3]] }), 186, 60, 'acorn board')}
      {img(plank(62, 20, { seed: 9, nails: [[11, 3], [51, 3]], tone: 'dwood' }), 186, 60, 'gem board')}
      {img(plaque(52, 58, 'night', 5, 12), 156, 174, 'sleep plaque')}
      {img(plaque(52, 58, 'paper', 6, 12), 156, 174, 'clock plaque')}
      {img(plaque(52, 58, 'velvet', 7, 12), 156, 174, 'book plaque')}
      {img(tag(26, 26, 2), 78, 93, 'tool tag')}
      {img(branch(124, 18, 'left', 3), 372, 54, 'branch')}
      {img(shelf(176), 528, 36, 'shelf')}
      <div style={`width:18px;height:120px;background:url(${ropeTile()}) 0 0/18px 18px repeat-y;image-rendering:pixelated`} />
      <div style={`width:24px;height:120px;background:url(${chainTile()}) 0 0/24px 36px repeat-y;image-rendering:pixelated`} />
    </div>,
    root,
  );
}

if (view === 'fx') {
  document.body.style.background = '#3a5a3a';
  const kinds: UiFxKind[] = ['puff', 'sparkle', 'hearts', 'magic', 'coins', 'stars', 'snow', 'leaves', 'confetti'];
  root.innerHTML = kinds.map((k, i) => `<span style="position:absolute;left:${(i % 3) * 140 + 20}px;top:${Math.floor(i / 3) * 190 + 170}px;${label}">${k}</span>`).join('');
  kinds.forEach((k, i) => uiBurst(k, (i % 3) * 140 + 70, Math.floor(i / 3) * 190 + 110, k === 'confetti' ? 30 : 14));
  (window as unknown as { __chromeT: number }).__chromeT = performance.now();
  uiAdvance(+(q.get('t') ?? 0.3));
}

if (view === 'trans') {
  document.body.style.background = 'linear-gradient(#8fd0f0,#7d9a62)';
  root.innerHTML = '<div style="height:100vh"></div>';
  previewTransition((q.get('kind') ?? 'leaves') as TransitionKind, (q.get('phase') ?? 'in') as 'in' | 'out', +(q.get('p') ?? 0.5), 0.8);
}
(window as unknown as { __ready: number }).__ready = 1;
