// Dev page for the UI chrome. ?view=
//   sheet   every animated icon's frame sheet (and the HUD/particle/transition sprites); &only=regex &s=scale
//   anim    the main-button and tool animations playing at their real size and timing
//   parts   the relief-painted boards, tool tile, name plate, shelf, rope and chain (see also ?view=obj)
//   fx      one burst of every UI particle kind, frozen mid-flight
//   trans   one transition frame: &kind=iris|leaves|snow|page|blueprint|stars|fade &p=0.5 &phase=in|out
import { render } from 'preact';
import { SPRITES, spriteURL } from '../ui/px/sprites.js';
import '../ui/px/chromeart.js';
import { CHROME_TIMELINES } from '../ui/chrome/hud.tsx';
import { PxAnim } from '../ui/chrome/pxanim.tsx';
import { board, brassChain, hempRope, plate, shelfBoard, toolTile } from '../ui/chrome/objects.ts';
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
      {img(board(96, 36, 2, 1, { seed: 4, hooks: [26, 71], brackets: true }), 288, 108, 'name board')}
      {img(board(62, 20, 2, 1, { seed: 7, wood: 'oak', hooks: [11, 51], screws: [[27, 11.5]], bevel: 2 }), 186, 60, 'acorn board')}
      {img(board(62, 20, 2, 1, { seed: 9, hooks: [11, 51], screws: [[27, 11.5]], bevel: 2 }), 186, 60, 'gem board')}
      {img(toolTile(26, 'sapphire', 2, 1, 1), 78, 90, 'tool tile')}
      {img(plate(44, 9), 132, 27, 'name plate')}
      {img(shelfBoard(176), 528, 48, 'shelf')}
      <div style={`width:18px;height:120px;background:url(${hempRope()}) 0 0/18px 18px repeat-y;image-rendering:pixelated`} />
      <div style={`width:24px;height:120px;background:url(${brassChain()}) 0 0/24px 36px repeat-y;image-rendering:pixelated`} />
    </div>,
    root,
  );
}

if (view === 'obj') {
  // [ui4] the v4 relief objects at both detail levels
  void import('../ui/chrome/objects.ts').then((O) => {
    document.body.style.background = q.get('bg') ?? '#5b6b4a';
    const ks = [1, 2];
    const cell = (src: string, w: number, h: number, t: string) => `<div style="display:flex;flex-direction:column;gap:2px;align-items:center"><img src="${src}" style="width:${w}px;height:${h}px;image-rendering:pixelated"><span style="${label}">${t}</span></div>`;
    let html = '<div style="padding:10px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">';
    for (const k of ks) {
      const res = k === 1 ? 2 : 1, s = +(q.get('s') ?? 2);
      html += cell(O.moonLamp(k, res, 0.6, 1), 52 * s, 54 * s, 'lamp k' + k);
      html += cell(O.alarmClock(k, res, 0), 52 * s, 54 * s, 'alarm k' + k);
      html += cell(O.journal(k, res, 0), 52 * s, 54 * s, 'book k' + k);
      html += cell(O.journal(k, res, 0.35), 52 * s, 54 * s, 'book open .35');
      html += cell(O.journal(k, res, 0.75), 52 * s, 54 * s, 'book open .75');
    }
    const s = +(q.get('s') ?? 2) / 2;
    html += '</div><div style="padding:10px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">';
    html += cell(O.board(96, 36, 2, 1, { seed: 4, hooks: [26, 71], brackets: true, moss: [[34, 50], [78, 90]] }), 192 * s, 72 * s, 'name board');
    html += cell(O.medallion(24), 48 * s, 48 * s, 'medal');
    html += cell(O.board(62, 20, 2, 1, { seed: 7, hooks: [11, 51], screws: [[4, 11], [58, 11]] }), 124 * s, 40 * s, 'coin board');
    html += cell(O.plusButton(14), 28 * s, 28 * s, 'plus');
    html += cell(O.plusButton(14, 2, 1, true), 28 * s, 28 * s, 'plus dn');
    html += cell(O.plate(40, 9), 80 * s, 18 * s, 'plate');
    for (const [i, hue] of (['sapphire', 'rose', 'plum', 'emerald', 'sky', 'iron'] as const).entries()) html += cell(O.toolTile(26, hue, 2, 1, i + 1), 52 * s, 60 * s, hue);
    html += cell(O.clip(), 44 * s, 26 * s, 'clip');
    html += '</div><div style="padding:10px">' + cell(O.shelfBoard(176), 352 * s, 32 * s, 'shelf') + '<canvas id="alarm"></canvas>';
    root.innerHTML = html + '</div>';
    const cv = document.getElementById('alarm') as HTMLCanvasElement, im = new Image();
    im.onload = () => { cv.width = im.width; cv.height = im.height; cv.style.width = `${104 * s * 2}px`; cv.style.imageRendering = 'pixelated'; const g = cv.getContext('2d')!; g.drawImage(im, 0, 0); O.alarmHands(g, 2, 1, new Date(2026, 1, 1, 10, 9, 37), 7 * 60); };
    im.src = O.alarmClock(2, 1, 0);
    (window as unknown as { __ready: number }).__ready = 1;
  });
}

if (view === 'icons') {
  // [ui4] the painted icon family, at 20, 30 and 40 px
  // [ui5] the 3D icon family at 20, 30 and 44 CSS px (as the app draws them); ?bag=1: the acorn bag at every size
  void import('../ui/chrome/iconset.ts').then(async ({ installIconSet, ICON_NAMES, iconFit }) => {
    await installIconSet(); // [tex7] the atlas
    document.body.style.background = q.get('bg') ?? '#efe2c0';
    const d = devicePixelRatio || 1;
    // [icons8] as <Px> draws them: the crisp size nearest the ask
    const im = (n: string, s: number) => { const f = iconFit(n, s, d); return `<img src="${f?.src ?? spriteURL(n, 1)}" style="width:${f?.css ?? s}px;height:${f?.css ?? s}px;image-rendering:pixelated">`; };
    if (q.get('bag')) {
      const row = (names: string[], sizes: number[]) => `<div style="display:flex;gap:18px;align-items:flex-end;padding:10px 14px">${names.map((n) => sizes.map((s) => `<div style="display:flex;flex-direction:column;align-items:center;font:10px monospace;color:#3a2410">${im(n, s)}${s}</div>`).join('')).join('')}</div>`;
      root.innerHTML = row(['owlcoin'], [16, 20, 24, 30, 40, 48, 72]) + row(['acorn_big'], [40, 80, 120]) + row(['coin_pouch', 'coin_sack', 'coin_chest', 'coin_vault'], [64]) + row(['moongem', 'gem_big'], [24, 48, 96]);
    } else {
      const sizes = [20, 30, 44];
      root.innerHTML = '<div style="padding:8px;display:flex;flex-wrap:wrap;gap:8px">' + ICON_NAMES().map((n) => `<div style="display:flex;flex-direction:column;align-items:center;width:106px;font:10px monospace;color:#3a2410"><div style="display:flex;gap:4px;align-items:flex-end">${sizes.map((s) => im(n, s)).join('')}</div>${n}</div>`).join('') + '</div>';
    }
    (window as unknown as { __ready: number }).__ready = 1;
  });
}

if (view === 'frames') {
  // [ui5] the portrait frames, over the day and night sky, at 48 / 64 / 96 CSS px
  void import('../ui/chrome/frameart.ts').then(({ FRAME_ART_IDS, frameArt, portraitSky, frameSkyOf }) => {
    document.body.style.background = q.get('bg') ?? '#efe2c0';
    const cell = (id: string, css: number, night: boolean) => {
      const sky = portraitSky(night || frameSkyOf(id) === 'night', 40);
      return `<div style="position:relative;width:${css}px;height:${css}px"><img src="${sky}" style="position:absolute;inset:16%;width:68%;height:68%;image-rendering:pixelated;clip-path:circle(50%)"><img src="${frameArt(id, Math.round(css / 1.33))}" style="position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated"></div>`;
    };
    root.innerHTML = '<div style="padding:8px;display:flex;flex-wrap:wrap;gap:14px">' + FRAME_ART_IDS.map((id) => `<div style="display:flex;flex-direction:column;align-items:center;font:11px monospace;color:#3a2410"><div style="display:flex;gap:6px;align-items:flex-end">${cell(id, 48, false)}${cell(id, 76, false)}${cell(id, 96, true)}</div>${id}</div>`).join('') + '</div>';
    (window as unknown as { __ready: number }).__ready = 1;
  });
}

if (view === 'pip') {
  // [ui5] the live owl portrait: big and at HUD size, in a few frames (one is live at a time; the rest show the still)
  void import('../ui/chrome/livepip.tsx').then(({ OwlPortrait }) => {
    document.body.style.background = q.get('bg') ?? '#7a5a3a';
    if (q.get('hour')) (window as unknown as { __pipHour: number }).__pipHour = +q.get('hour')!;
    if (q.get('art')) (window as unknown as { __pipArt: number }).__pipArt = +q.get('art')!;
    const frames = (q.get('frames') ?? 'porthole,walnut,moss,celestial').split(',');
    const look = { skin: q.get('skin') ?? 'owl', species: q.get('species') ?? 'tawny', palette: q.get('species') ?? 'tawny', outfit: q.get('hat') ? { head: q.get('hat')! } : {} };
    render(<div style="padding:12px;display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end">
      {frames.map((f, i) => <OwlPortrait size={i ? 78 : +(q.get('s') ?? 234)} frame={f} look={look} live={i === 0} tappable />)}
    </div>, root);
    (window as unknown as { __ready: number }).__ready = 1;
  });
}

if (view === 'fx') {
  document.body.style.background = '#3a5a3a';
  const kinds: UiFxKind[] = ['puff', 'sparkle', 'hearts', 'magic', 'coins', 'stars', 'snow', 'leaves', 'confetti'];
  root.innerHTML = kinds.map((k, i) => `<span style="position:absolute;left:${(i % 3) * 140 + 20}px;top:${Math.floor(i / 3) * 190 + 170}px;${label}">${k}</span>`).join('');
  kinds.forEach((k, i) => uiBurst(k, (i % 3) * 140 + 70, Math.floor(i / 3) * 190 + 110, k === 'confetti' ? 30 : 14));
  (window as unknown as { __chromeT: number }).__chromeT = performance.now();
  uiAdvance(+(q.get('t') ?? 0.3));
}

if (view === 'nav') {
  // [icons8] the pixel-art shelf (Sleep, Clock, Book) on its own: &bg= &night=1 (a moonlit backdrop) &art= (device px per CSS px)
  void import('../ui/chrome/hud.tsx').then(({ MainNav, hudOverride }) => {
    const night = q.get('night') === '1';
    document.body.style.background = q.get('bg') ?? (night ? 'linear-gradient(#0e1a44,#2a2a5a 60%,#3a2a3a)' : 'linear-gradient(#8a5a36,#6a3e24)');
    if (q.get('art')) (window as unknown as { __shelfArt: number }).__shelfArt = +q.get('art')!;
    (window as unknown as { __shelfNight: number }).__shelfNight = night ? 1 : 0;
    hudOverride.value = 'all';
    root.style.cssText = 'position:relative;width:100vw;height:100vh;overflow:hidden';
    render(<MainNav />, root);
  });
}

if (view === 'hud') {
  // [icons9] the HUD (name sign, currency), the side tools and the Outside door tile on their own, no 3D: &night=1
  void Promise.all([import('../ui/chrome/hud.tsx'), import('../ui/chrome/lookout.tsx'), import('../ui/chrome/iconset.ts')]).then(async ([{ Hud, SideTools, hudOverride }, { LookOut }, { installIconSet }]) => {
    await installIconSet();
    const night = q.get('night') === '1';
    document.body.style.background = night ? 'linear-gradient(#0e1a44,#2a2a5a 60%,#3a2a3a)' : 'linear-gradient(#c88a4a,#8a5a30)';
    hudOverride.value = 'all';
    root.style.cssText = 'position:relative;width:100vw;height:100vh;overflow:hidden';
    root.className = 'layer';
    render(<><Hud /><SideTools /><LookOut /></>, root);
    (window as unknown as { __ready: number }).__ready = 2;
  });
}

if (view === 'trans') {
  document.body.style.background = 'linear-gradient(#8fd0f0,#7d9a62)';
  root.innerHTML = '<div style="height:100vh"></div>';
  previewTransition((q.get('kind') ?? 'leaves') as TransitionKind, (q.get('phase') ?? 'in') as 'in' | 'out', +(q.get('p') ?? 0.5), 0.8);
}
(window as unknown as { __ready: number }).__ready = 1;
