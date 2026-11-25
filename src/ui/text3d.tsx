// Impressive 3D pixel text in Alagard, the game's font: a chunky extrusion (stacked one-font-pixel layers in a
// darker shade toward the bottom right), a crisp coloured outline, a stepped 3-band fill with a bright top row,
// and a soft pixel drop shadow. Plus anime-style motion: titles pop in with squash and stretch, numbers count up
// and punch, rewards burst with sparkles, exclamations shake, happy lines wave letter by letter, dialogue types
// on letter by letter, emphasis flashes. Everything respects reduced motion and the in-app Calm motion setting
// (the global rules in style.css stop CSS animation; the JS bits below check reducedMotion()).
//
// CSS (installed by installText3D(), called at boot):
//   .t3d                 3D text: outline + 2-pixel extrusion + drop shadow (h1 and h2 get it automatically)
//   .t3d-deep            3-pixel extrusion (big titles)          .t3d-lite  small text: a 1-pixel drop only
//   .t3d-gold | -cream | -sky | -rose | -leaf | -moon | -ink     palettes (gold is the default; ink is for paper)
//   .t3d-pop             entrance: squash-and-stretch pop       .t3d-punch  a punch (re-add to replay)
//   .t3d-shake           an exclamation shake                    .t3d-flash  an emphasis colour flash
//   .t3d-burst           a reward burst with pixel sparkles      .t3d-wave / .t3d-type  per-letter (see <Letters>)
// The stepped band fill needs the text in a data-t attribute: the app's vnode hook (font.ts) adds it to every
// h1, h2 and .t3d element whose children are plain text, and the fill is drawn by its ::after.
//
// Preact:   <Letters text="Good morning!" mode="wave" />   <CountUp value={n} />   punch(el)
// Canvas:   drawText3D(ctx, text, x, baselineY, { n, palette, depth, align, outline, drop, lift }) -> width
//           fitText3D(text, wishPx, maxW) -> n (font pixels per canvas pixel that fit)
import { cloneElement, isValidElement, toChildArray, type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { alagard, alagardSafe } from './font.ts';
import { reducedMotion } from './chrome/swing.ts';

/** a palette: top highlight row, three fill bands (light to dark), outline, extrusion */
export interface Palette { hi: string; c1: string; c2: string; c3: string; ol: string; ex: string; drop?: string }
export const PALETTES = {
  gold: { hi: '#fff8d6', c1: '#ffe68f', c2: '#f7c24a', c3: '#dc8d25', ol: '#2b1405', ex: '#7a3c0e' },
  cream: { hi: '#ffffff', c1: '#fff7e4', c2: '#f4e3be', c3: '#dcc08a', ol: '#2a1608', ex: '#5e361a' },
  sky: { hi: '#f4fcff', c1: '#c8edff', c2: '#86ccf3', c3: '#4e90d8', ol: '#0e1c36', ex: '#1e3968' },
  rose: { hi: '#fff1ee', c1: '#ffc6bb', c2: '#f38d7c', c3: '#d2544a', ol: '#2e0c0c', ex: '#701f1c' },
  leaf: { hi: '#f4ffe6', c1: '#d0f29e', c2: '#92d55c', c3: '#529f3b', ol: '#0f2410', ex: '#25512b' },
  moon: { hi: '#ffffff', c1: '#eef0ff', c2: '#c9cdf2', c3: '#9ba2da', ol: '#14183a', ex: '#2d3372' },
  ink: { hi: '#7d8cc0', c1: '#46578c', c2: '#2d3964', c3: '#1e274a', ol: '#fbf3df', ex: '#c2a777', drop: 'rgba(0,0,0,0)' },
} satisfies Record<string, Palette>;
export type PaletteName = keyof typeof PALETTES;

// ------------------------------------------------------------------ CSS

const vars = (p: Palette) => `--t-hi:${p.hi};--t-1:${p.c1};--t-2:${p.c2};--t-3:${p.c3};--t-ol:${p.ol};--t-ex:${p.ex};--t-dr:${p.drop ?? 'rgba(18,10,4,.42)'}`;
const P = (k: number) => `calc(var(--tp) * ${k})`;
const ring = (c: string) => [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => `${P(x)} ${P(y)} 0 ${c}`).join(',');
/** outline, then `d` extrusion layers toward the bottom right with their own outline, then a drop */
const stack = (d: number) => [
  ring('var(--t-ol)'),
  ...Array.from({ length: d }, (_, k) => `${P(k + 1)} ${P(k + 2)} 0 var(--t-ex),${P(k + 2)} ${P(k + 1)} 0 var(--t-ex),${P(k + 2)} ${P(k + 2)} 0 var(--t-ex)`),
  `${P(d + 2)} ${P(d + 2)} 0 var(--t-ol),${P(d + 1)} ${P(d + 3)} 0 var(--t-ol),${P(d + 3)} ${P(d + 1)} 0 var(--t-ol),${P(d + 2)} ${P(d + 3)} 0 var(--t-ol),${P(d + 3)} ${P(d + 2)} 0 var(--t-ol)`,
  `${P(d + 4)} ${P(d + 4)} 0 var(--t-dr)`,
].join(',');
/** Where the game wears it without a class in its markup: titles, sign names, big numbers (full 3D) ... */
const FULL = ['.hh-name', '.lvup-title', '.lvup-medal b', '.title-ribbon', '.cs-sign span', '.sf-sign', '.sf-sleep', '.seal b', '.tk-times b', '.bk-last-t b', '.n-time', '.lock-time', '.bigclock', '.cb-title'];
/** ... and buttons, counters, labels, toasts and dialogue (light 3D: outline and a one-pixel extrusion) */
const LITE = ['.hh-num', '.hh-rune b', '.btn.pillow', '.btn.oak', '.lg-btn', '.hh-btn-gold', '.hh-btn-green', '.hh-btn-night', '.hh-btn-cream', '.hh-toast-body > span', '.hh-bubble .txt', '.stat b', '.bk-tile b', '.hh-toollabel', '.hh-looklabel', '.tk-hint'];
const T = `:is(.t3d:not(.t3d-lite), h1:not(.qp-q), h2:not(.qp-q), ${FULL.join(', ')})`;
const L = `:is(.t3d.t3d-lite, ${LITE.join(', ')})`;
const CSS = `
:where(.t3d, h1, h2, ${FULL.join(', ')}, ${LITE.join(', ')}) { ${vars(PALETTES.gold)}; --tp: calc(1em / 16); }
/* the palette each place wears: gold for titles on wood, cream on dark and coloured surfaces, ink on paper */
:where(.hh-num, .hh-rune b, .cs-sign span, .sf-sign, .sf-sleep, .lvup-medal b, .n-time, .lock-time, .bigclock, .btn.pillow, .btn.oak, .lg-btn, .hh-btn-green, .hh-btn-night) { ${vars(PALETTES.cream)} }
:where(.bk-title, .tk-times b, .seal b, .bk-last-t b, .stat b, .bk-tile b, .cb-title, .hh-toast-body > span, .hh-bubble .txt, .hh-toollabel, .hh-looklabel, .tk-hint, .hh-btn-cream, .qp-sheet h2, .sheet-head h2) { ${vars(PALETTES.ink)} }
:where(.lock-time, .n-time) { ${vars(PALETTES.moon)} }
.t3d-gold { ${vars(PALETTES.gold)} } .t3d-cream { ${vars(PALETTES.cream)} } .t3d-sky { ${vars(PALETTES.sky)} }
.t3d-rose { ${vars(PALETTES.rose)} } .t3d-leaf { ${vars(PALETTES.leaf)} } .t3d-moon { ${vars(PALETTES.moon)} } .t3d-ink { ${vars(PALETTES.ink)} }
body ${T} { color: var(--t-2); text-shadow: ${stack(2)} !important; }
body ${T}:is(.t3d-deep, h1, .lvup-title, .title-ribbon, .bigclock, .n-time, .lock-time) { text-shadow: ${stack(3)} !important; }
body ${L} { color: var(--t-1); text-shadow: ${ring('var(--t-ol)')}, ${P(1)} ${P(2)} 0 var(--t-ex), ${P(2)} ${P(2)} 0 var(--t-ex), ${P(2)} ${P(3)} 0 var(--t-ol), ${P(3)} ${P(3)} 0 var(--t-ol), ${P(3)} ${P(4)} 0 var(--t-dr) !important; }
body :is(.hh-toast-body > span, .hh-bubble .txt, .hh-toollabel, .hh-looklabel, .tk-hint, .t3d-ink.t3d-lite) { color: var(--t-2); text-shadow: ${P(1)} ${P(1)} 0 var(--t-ex) !important; }
.hh-dig { width: 0.625em !important; text-align: right !important; overflow: visible !important; clip-path: inset(0 -0.4em 0 -0.15em); } /* the wheels clip only top and bottom: the outline and extrusion show */
.hh-strip i { line-height: 1em !important; }
:where([data-t]) { position: relative; }
body :is(${T}[data-t], ${T} [data-t])::after {
  content: attr(data-t); position: absolute; inset: 0; box-sizing: border-box; padding: inherit; margin: 0; border: 0;
  display: inherit; flex-direction: inherit; flex-wrap: inherit; align-items: inherit; justify-content: inherit; gap: inherit;
  font: inherit; line-height: inherit; letter-spacing: inherit; text-align: inherit; text-indent: inherit; text-transform: inherit; white-space: inherit; overflow-wrap: inherit;
  color: transparent; text-shadow: none; pointer-events: none; overflow: hidden; transform: none; animation: none;
  --c0: calc((1lh - 1em) / 2 + var(--tp));
  background: linear-gradient(180deg, transparent 0 var(--c0), var(--t-hi) var(--c0) calc(var(--c0) + var(--tp)), var(--t-1) calc(var(--c0) + var(--tp)) calc(var(--c0) + var(--tp) * 4), var(--t-2) calc(var(--c0) + var(--tp) * 4) calc(var(--c0) + var(--tp) * 8), var(--t-3) calc(var(--c0) + var(--tp) * 8)) 0 0 / 100% 1lh repeat-y content-box;
  -webkit-background-clip: text; background-clip: text;
}
/* anime motion (steps, so it stays pixel art); the global reduced-motion rules freeze all of it */
.t3d-pop { animation: t3dPop .62s steps(12) both; transform-origin: 50% 85%; }
@keyframes t3dPop { 0% { transform: translateY(-30%) scale(.3, 1.7); opacity: 0; } 35% { transform: scale(1.38, .68); opacity: 1; } 55% { transform: scale(.86, 1.18); } 75% { transform: scale(1.07, .95); } 100% { transform: none; opacity: 1; } }
.t3d-punch { animation: t3dPunch .42s steps(7); }
@keyframes t3dPunch { 0% { transform: none; } 30% { transform: scale(1.45, .78); } 55% { transform: scale(.88, 1.2); } 80% { transform: scale(1.06, .96); } 100% { transform: none; } }
.t3d-shake { animation: t3dShake .36s steps(6) 2; }
@keyframes t3dShake { 0%, 100% { transform: none; } 20% { transform: translate(-2px, 1px) rotate(-3deg); } 40% { transform: translate(2px, -1px) rotate(2.5deg); } 60% { transform: translate(-2px, 0) rotate(-1.5deg); } 80% { transform: translate(1px, 1px); } }
.t3d-flash { animation: t3dFlash .3s steps(1) 4; }
@keyframes t3dFlash { 0% { filter: brightness(1.7) saturate(1.3); } 50% { filter: hue-rotate(150deg) saturate(1.6); } 100% { filter: none; } }
.t3d-burst { position: relative; animation: t3dPunch .5s steps(8); }
.t3d-burst::before { content: ''; position: absolute; left: 50%; top: 45%; width: 4px; height: 4px; margin: -2px; pointer-events: none; animation: t3dSpark .7s steps(7) forwards;
  box-shadow: 0 -22px #fff8d6, 18px -14px #ffe68f, 26px 2px #ffffff, 16px 16px #ffe68f, -2px 22px #fff8d6, -18px 14px #ffffff, -26px -2px #ffe68f, -16px -16px #ffffff; }
@keyframes t3dSpark { 0% { transform: scale(.2); opacity: 1; } 60% { opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }
.t3d-ch { display: inline-block; white-space: pre; }
.t3d-seg { display: inline-block; }
.t3d-wave > .t3d-ch { animation: t3dWave 1.5s steps(6) infinite; animation-delay: calc(var(--i) * 80ms); }
@keyframes t3dWave { 0%, 55%, 100% { transform: none; } 18% { transform: translateY(calc(var(--tp) * -3)); } 36% { transform: translateY(var(--tp)); } }
.t3d-type > .t3d-ch { animation: t3dType .26s steps(4) both; animation-delay: calc(var(--i) * 30ms); }
@keyframes t3dType { 0% { transform: translateY(calc(var(--tp) * -5)) scale(1.5); opacity: 0; } 50% { transform: translateY(var(--tp)) scale(.9, 1.12); opacity: 1; } 100% { transform: none; opacity: 1; } }
/* where the game uses the motion: titles pop in, Pip's happy lines wave, rewards burst in gold */
:is(.sheet-head h2, .mr-sign h2, .dawn-sign h1, .bk-title, .cb-title, .title-ribbon, .gb-title b) { animation: t3dPop .62s steps(12) both; transform-origin: 50% 85%; }
.hh-bubble .txt.t3d-shake { display: inline-block; }
.hh-bubble .txt.t3d-wave .ch { display: inline-block; white-space: pre; animation: t3dWave 1.5s steps(6) infinite; animation-delay: calc(var(--i) * 60ms); }
body .hh-toast-body > span.reward { ${vars(PALETTES.gold)}; color: var(--t-2); text-shadow: ${stack(1)} !important; }
`;
let cssDone = false;
/** Install the text styles (once; safe to call from any component). */
export function installText3D() {
  if (cssDone || typeof document === 'undefined') return;
  cssDone = true;
  const st = document.createElement('style');
  st.id = 'hh-text3d';
  st.textContent = CSS;
  document.head.appendChild(st);
}

// ------------------------------------------------------------------ Preact helpers

/** Text split into letters for per-letter motion: mode 'wave' (happy lines), 'type' (types on with a pop), 'pop'. */
export function Letters(p: { text: string; mode?: 'wave' | 'type'; class?: string; palette?: PaletteName }) {
  installText3D();
  const s = alagardSafe(p.text);
  const cls = `t3d ${p.palette ? 't3d-' + p.palette : ''} t3d-${p.mode ?? 'wave'} ${p.class ?? ''}`;
  return <span class={cls} aria-label={s}>{[...s].map((ch, i) => <span aria-hidden="true" class={'t3d-ch' + (ch === ' ' ? '' : ' t3d')} style={{ '--i': i } as Record<string, number>}>{ch}</span>)}</span>;
}

/** Put each bare text of a title (next to icons) in its own span so it can wear the 3D band fill. */
export function textSpans(c: ComponentChildren, depth = 2): ComponentChildren {
  return toChildArray(c).map((x) => {
    if (typeof x === 'string' || typeof x === 'number') return String(x).trim() ? <span class="t3d-seg">{x}</span> : x;
    if (depth > 0 && isValidElement(x) && typeof x.type === 'string') return cloneElement(x, {}, textSpans((x.props as { children?: ComponentChildren }).children, depth - 1));
    return x;
  });
}

/** Replay a one-shot text animation class (punch, shake, flash, burst, pop) on an element. */
export function punch(el: Element | null | undefined, kind: 'punch' | 'shake' | 'flash' | 'burst' | 'pop' = 'punch') {
  if (!el || reducedMotion()) return;
  const c = 't3d-' + kind;
  el.classList.remove(c);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(c);
  window.setTimeout(() => el.classList.remove(c), 900);
}

/** A number that counts up (or down) to its new value, then punches. */
export function CountUp(p: { value: number; from?: number; ms?: number; format?: (n: number) => string; class?: string }) {
  installText3D();
  const [shown, setShown] = useState(p.from ?? p.value);
  const ref = useRef<HTMLSpanElement>(null), from = useRef(p.from ?? p.value);
  useEffect(() => {
    const a = from.current, b = p.value;
    if (a === b) return;
    from.current = b;
    if (reducedMotion()) { setShown(b); return; }
    const t0 = performance.now(), dur = p.ms ?? Math.min(900, 300 + Math.abs(b - a) * 12);
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
      setShown(Math.round(a + (b - a) * e));
      if (k < 1) raf = requestAnimationFrame(step); else punch(ref.current);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [p.value]);
  return <span ref={ref} class={'t3d-num ' + (p.class ?? '')} style="display:inline-block">{p.format ? p.format(shown) : String(shown)}</span>;
}

// ------------------------------------------------------------------ canvas

const mask = (() => {
  let c: HTMLCanvasElement | null = null;
  return (w: number, h: number) => { if (!c) c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
})();

/** The biggest whole multiple of Alagard's 16 px (at most the wished size) whose width fits `maxW`. */
export function fitText3D(text: string, wishPx: number, maxW: number): number {
  const g = mask(4, 4).getContext('2d')!;
  let n = Math.max(1, Math.round(wishPx / 16));
  const s = alagardSafe(text);
  for (; n > 1; n--) { g.font = alagard(n); if (g.measureText(s).width + (2 + 4) * n <= maxW) break; }
  return n;
}

/**
 * Draw 3D pixel text on a canvas: crisp Alagard at `n` canvas pixels per font pixel, outlined, extruded `depth`
 * font pixels toward the bottom right, a stepped band fill with a bright top row, a soft drop. `y` is the
 * baseline. `lift(i)` raises letter i by that many font pixels (per-letter pops and waves). Returns the width of
 * the letters (the outline and extrusion add `(depth + 4) * n` to the right and below).
 */
export function drawText3D(g: CanvasRenderingContext2D, text: string, x: number, y: number, o: { n?: number; palette?: PaletteName | Palette; depth?: number; align?: CanvasTextAlign; outline?: boolean; drop?: boolean; lift?: (i: number) => number } = {}): number {
  const s = alagardSafe(text), n = Math.max(1, Math.round(o.n ?? 1)), d = o.depth ?? 2;
  const pal: Palette = typeof o.palette === 'object' ? o.palette : PALETTES[o.palette ?? 'gold'];
  const font = alagard(n);
  const m0 = mask(4, 4).getContext('2d')!;
  m0.font = font;
  const w = Math.round(m0.measureText(s).width);
  const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' || o.align === 'end' ? x - w : x), y0 = Math.round(y);
  const pad = (d + 6) * n + 2, top = y0 - 15 * n - pad, H = 19 * n + pad * 2, left = x0 - pad, W = w + pad * 2;
  // the glyph mask, alpha snapped
  const mc = document.createElement('canvas'); mc.width = Math.max(1, W); mc.height = Math.max(1, H);
  const mg = mc.getContext('2d', { willReadFrequently: true })!;
  mg.font = font; mg.textBaseline = 'alphabetic'; mg.fillStyle = '#000';
  if (o.lift) {
    let cx = x0 - left;
    [...s].forEach((ch, i) => { mg.fillText(ch, cx, y0 - top - Math.round((o.lift!(i) || 0) * n)); cx += Math.round(mg.measureText(ch).width); });
  } else mg.fillText(s, x0 - left, y0 - top);
  const img = mg.getImageData(0, 0, W, H), dd = img.data;
  for (let i = 3; i < dd.length; i += 4) dd[i] = dd[i] >= 110 ? 255 : 0;
  mg.putImageData(img, 0, 0);
  // a coloured copy of the mask
  const tint = document.createElement('canvas'); tint.width = W; tint.height = H;
  const tg = tint.getContext('2d')!;
  const paint = (fill: (c: CanvasRenderingContext2D) => void) => { tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, W, H); tg.drawImage(mc, 0, 0); tg.globalCompositeOperation = 'source-in'; fill(tg); tg.globalCompositeOperation = 'source-over'; return tint; };
  const solid = (c: string) => paint((t) => { t.fillStyle = c; t.fillRect(0, 0, W, H); });
  g.save();
  g.imageSmoothingEnabled = false;
  const at = (dx: number, dy: number) => g.drawImage(tint, left + dx * n, top + dy * n);
  if (o.drop !== false) { solid(pal.drop ?? 'rgba(18,10,4,.42)'); at(d + 4, d + 4); }
  if (o.outline !== false) { solid(pal.ol); for (const [ox, oy] of [[d + 2, d + 2], [d + 1, d + 3], [d + 3, d + 1], [d + 2, d + 3], [d + 3, d + 2]]) at(ox, oy); }
  solid(pal.ex);
  for (let k = d; k >= 1; k--) { at(k, k + 1); at(k + 1, k); at(k + 1, k + 1); }
  if (o.outline !== false) { solid(pal.ol); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) at(ox, oy); }
  // the face: a bright top row, then three bands, by font-pixel row from the capitals' top
  const cap = y0 - top - 11 * n;
  paint((t) => {
    const band = (c: string, r0: number, r1: number) => { t.fillStyle = c; t.fillRect(0, cap + r0 * n, W, (r1 - r0) * n); };
    t.fillStyle = pal.c3; t.fillRect(0, 0, W, H);
    t.globalCompositeOperation = 'source-atop'; // the bands paint only over the letters already there
    band(pal.c1, -8, 4); band(pal.hi, -8, 1); band(pal.c2, 4, 8);
  });
  at(0, 0);
  g.restore();
  return w;
}
