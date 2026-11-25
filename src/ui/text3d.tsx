// Premium 3D title text in Alagard, the game's font, rendered at full device resolution: a smooth extrusion with
// depth shading (layers that darken as they go back), a crisp outline, a realistic metallic or painted fill (a
// soft highlight across the top, a darker horizon line through the middle, a warm reflection near the bottom)
// and a soft drop shadow. Plus game-style motion: titles pop in with squash and stretch, numbers count up and
// punch, rewards burst with sparkles, exclamations shake, happy lines wave letter by letter, dialogue types on
// letter by letter, emphasis flashes. Everything respects reduced motion and the in-app Calm motion setting
// (the global rules in style.css stop CSS animation; the JS bits below check reducedMotion()).
//
// CSS (installed by installText3D(), called at boot):
//   .t3d                 3D text: outline + shaded extrusion + metallic fill + soft shadow (h1 and h2 get it too)
//   .t3d-deep            a deeper extrusion (big titles)        .t3d-lite  small text: outline and a soft shadow
//   .t3d-gold | -cream | -sky | -rose | -leaf | -moon | -ink     materials (gold is the default; ink is for paper)
//   .t3d-pop             entrance: squash-and-stretch pop       .t3d-punch  a punch (re-add to replay)
//   .t3d-shake           an exclamation shake                    .t3d-flash  an emphasis colour flash
//   .t3d-burst           a reward burst with sparkles            .t3d-wave / .t3d-type  per-letter (see <Letters>)
// The metallic fill needs the text in a data-t attribute: the app's vnode hook (font.ts) adds it to every h1, h2
// and .t3d element whose children are plain text, and the fill is drawn by its ::after.
//
// Preact:   <Letters text="Good morning!" mode="wave" />   <CountUp value={n} />   punch(el)
// Canvas:   drawText3D(ctx, text, x, baselineY, { size | n, palette, depth, align, outline, drop, lift }) -> width
//           fitText3D(text, wishPx, maxW) -> n (16 px steps that fit)
import { cloneElement, isValidElement, toChildArray, type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { alagard, alagardSafe, STACK } from './font.ts';
import { reducedMotion } from './chrome/swing.ts';

/** a palette: top highlight row, three fill bands (light to dark), outline, extrusion */
export interface Palette { hi: string; c1: string; c2: string; c3: string; ol: string; ex: string; drop?: string }
export const PALETTES = {
  gold: { hi: '#fff4d2', c1: '#f4dc98', c2: '#ddb158', c3: '#b07c2e', ol: '#2b1405', ex: '#6a3e14' },
  cream: { hi: '#ffffff', c1: '#fff7e4', c2: '#f4e3be', c3: '#dcc08a', ol: '#2a1608', ex: '#5e361a' },
  sky: { hi: '#eef5f8', c1: '#cddfe6', c2: '#9dbccb', c3: '#6a8ea2', ol: '#0e1c2a', ex: '#24384a' },
  rose: { hi: '#f8ebe6', c1: '#e6bdb2', c2: '#c98a7c', c3: '#9c5a4a', ol: '#2e0c0c', ex: '#5e2620' },
  leaf: { hi: '#eff3e4', c1: '#cbd8ae', c2: '#98b074', c3: '#647f46', ol: '#0f2410', ex: '#2c4528' },
  moon: { hi: '#ffffff', c1: '#eef0ff', c2: '#c9cdf2', c3: '#9ba2da', ol: '#14183a', ex: '#2d3372' },
  ink: { hi: '#7d8cc0', c1: '#46578c', c2: '#2d3964', c3: '#1e274a', ol: '#fbf3df', ex: '#c2a777', drop: 'rgba(0,0,0,0)' },
} satisfies Record<string, Palette>;
export type PaletteName = keyof typeof PALETTES;

// ------------------------------------------------------------------ CSS

const vars = (p: Palette) => `--t-hi:${p.hi};--t-1:${p.c1};--t-2:${p.c2};--t-3:${p.c3};--t-ol:${p.ol};--t-ex:${p.ex};--t-dr:${p.drop ?? 'rgba(18,10,4,.42)'}`;
/** a length in ems (scales with the text) */
const E = (k: number) => `${k}em`;
const ring = (c: string, w = 'var(--ow)') => [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].map(([x, y]) => `calc(${w} * ${x}) calc(${w} * ${y}) 0 ${c}`).join(',');
/**
 * [ui10] Realistic lettering, not cartoon type: a hairline edge (half-strength), a thin cut bevel below the face
 * (gilt or painted letters standing a hair proud of the board), a tight contact shadow and a soft cast shadow.
 * `n` only deepens the bevel a little on the biggest titles.
 */
const stack = (n: number) => [
  ring('color-mix(in srgb, var(--t-ol) 45%, transparent)', 'max(0.5px, 0.028em)'),
  `0 ${E(0.03 + n * 0.003)} 0 color-mix(in srgb, var(--t-ex), #000 25%)`,
  `0 ${E(0.05 + n * 0.004)} ${E(0.05)} rgba(10,6,2,.42)`,
  `0 ${E(0.1 + n * 0.008)} ${E(0.22)} var(--t-dr)`,
].join(',');
/** Where the game wears it without a class in its markup: titles, sign names, big numbers (full 3D) ... */
const FULL = ['.hh-name', '.lvup-title', '.lvup-medal b', '.title-ribbon', '.cs-sign span', '.sf-sign', '.sf-sleep', '.seal b', '.tk-times b', '.bk-last-t b', '.n-time', '.lock-time', '.bigclock', '.cb-title'];
/** ... and buttons, counters, labels, toasts and dialogue (light 3D: outline and a one-pixel extrusion) */
const LITE = ['.hh-num', '.hh-rune b', '.btn.pillow', '.btn.oak', '.lg-btn', '.hh-btn-gold', '.hh-btn-green', '.hh-btn-night', '.hh-btn-cream', '.hh-toast-body > span', '.hh-bubble .txt', '.stat b', '.bk-tile b', '.hh-toollabel', '.hh-looklabel', '.tk-hint'];
const T = `:is(.t3d:not(.t3d-lite), h1:not(.qp-q), h2:not(.qp-q), ${FULL.join(', ')})`;
const L = `:is(.t3d.t3d-lite, ${LITE.join(', ')})`;
const CSS = `
:where(.t3d, h1, h2, ${FULL.join(', ')}, ${LITE.join(', ')}) { ${vars(PALETTES.gold)}; --tp: calc(1em / 16); --ow: max(1px, 0.055em); }
/* the palette each place wears: gold for titles on wood, cream on dark and coloured surfaces, ink on paper */
:where(.hh-num, .hh-rune b, .cs-sign span, .sf-sign, .sf-sleep, .lvup-medal b, .n-time, .lock-time, .bigclock, .btn.pillow, .btn.oak, .lg-btn, .hh-btn-green, .hh-btn-night) { ${vars(PALETTES.cream)} }
:where(.bk-title, .tk-times b, .seal b, .bk-last-t b, .stat b, .bk-tile b, .cb-title, .hh-toast-body > span, .hh-bubble .txt, .hh-toollabel, .hh-looklabel, .tk-hint, .hh-btn-cream, .qp-sheet h2, .sheet-head h2) { ${vars(PALETTES.ink)} }
:where(.lock-time, .n-time) { ${vars(PALETTES.moon)} }
.t3d-gold { ${vars(PALETTES.gold)} } .t3d-cream { ${vars(PALETTES.cream)} } .t3d-sky { ${vars(PALETTES.sky)} }
.t3d-rose { ${vars(PALETTES.rose)} } .t3d-leaf { ${vars(PALETTES.leaf)} } .t3d-moon { ${vars(PALETTES.moon)} } .t3d-ink { ${vars(PALETTES.ink)} }
body ${T} { color: var(--t-2); text-shadow: ${stack(5)} !important; }
body ${T}:is(.t3d-deep, h1, .lvup-title, .title-ribbon, .bigclock, .n-time, .lock-time) { text-shadow: ${stack(8)} !important; }
body ${L} { color: var(--t-1); text-shadow: ${ring('color-mix(in srgb, var(--t-ol) 40%, transparent)', 'max(0.5px, 0.03em)')}, 0 0.04em 0 color-mix(in srgb, var(--t-ex), #000 30%), 0 0.1em 0.16em var(--t-dr) !important; }
body :is(.hh-toast-body > span, .hh-bubble .txt, .hh-toollabel, .hh-looklabel, .tk-hint, .t3d-ink.t3d-lite) { color: var(--t-2); text-shadow: 0 1px 0 color-mix(in srgb, var(--t-ex), transparent 40%) !important; }
.hh-dig { width: 0.625em !important; text-align: right !important; overflow: visible !important; clip-path: inset(-0.1em -0.5em 0 -0.2em); } /* the wheels clip only top and bottom: the outline and extrusion show */
.hh-strip i { line-height: 1em !important; }
:where([data-t]) { position: relative; }
body :is(${T}[data-t], ${T} [data-t])::after {
  content: attr(data-t); position: absolute; inset: 0; box-sizing: border-box; padding: inherit; margin: 0; border: 0;
  display: inherit; flex-direction: inherit; flex-wrap: inherit; align-items: inherit; justify-content: inherit; gap: inherit;
  font: inherit; line-height: inherit; letter-spacing: inherit; text-align: inherit; text-indent: inherit; text-transform: inherit; white-space: inherit; overflow-wrap: inherit;
  color: transparent; text-shadow: none; pointer-events: none; overflow: hidden; transform: none; animation: none;
  --c0: calc((1lh - 1em) / 2 + 0.06em);
  background: linear-gradient(180deg, var(--t-hi) 0, var(--t-hi) var(--c0), var(--t-1) calc(var(--c0) + 0.16em), var(--t-2) calc(var(--c0) + 0.36em), var(--t-3) calc(var(--c0) + 0.4em), var(--t-2) calc(var(--c0) + 0.56em), var(--t-1) calc(var(--c0) + 0.72em), var(--t-3) calc(var(--c0) + 0.9em), var(--t-3) 1lh) 0 0 / 100% 1lh repeat-y content-box;
  -webkit-background-clip: text; background-clip: text;
}
/* game-style motion; the global reduced-motion rules freeze all of it */
.t3d-pop { animation: t3dPop .45s cubic-bezier(.2, .7, .3, 1) both; transform-origin: 50% 85%; }
@keyframes t3dPop { 0% { transform: translateY(0.22em); opacity: 0; } 100% { transform: none; opacity: 1; } }
.t3d-punch { animation: t3dPunch .42s cubic-bezier(.3, 1.4, .5, 1); }
@keyframes t3dPunch { 0% { transform: none; } 35% { transform: scale(1.08); } 100% { transform: none; } }
.t3d-shake { animation: t3dShake .36s linear 2; }
@keyframes t3dShake { 0%, 100% { transform: none; } 20% { transform: translate(-2px, 1px) rotate(-3deg); } 40% { transform: translate(2px, -1px) rotate(2.5deg); } 60% { transform: translate(-2px, 0) rotate(-1.5deg); } 80% { transform: translate(1px, 1px); } }
.t3d-flash { animation: t3dFlash .3s ease-in-out 4; }
@keyframes t3dFlash { 0% { filter: brightness(1.35); } 50% { filter: brightness(1.1); } 100% { filter: none; } }
.t3d-burst { position: relative; animation: t3dPunch .5s cubic-bezier(.3, 1.4, .5, 1); }
.t3d-burst::before { content: ''; position: absolute; left: 50%; top: 45%; width: 4px; height: 4px; margin: -2px; pointer-events: none; animation: t3dSpark .7s ease-out forwards; border-radius: 50%;
  box-shadow: 0 -22px 2px #fff8d6, 18px -14px 2px #ffe68f, 26px 2px 2px #ffffff, 16px 16px 2px #ffe68f, -2px 22px 2px #fff8d6, -18px 14px 2px #ffffff, -26px -2px 2px #ffe68f, -16px -16px 2px #ffffff, 0 0 10px 4px rgba(255,230,140,.6); }
@keyframes t3dSpark { 0% { transform: scale(.2); opacity: 1; } 60% { opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }
.t3d-ch { display: inline-block; white-space: pre; }
.t3d-seg { display: inline-block; }
.t3d-wave > .t3d-ch { animation: t3dWave 1.5s ease-in-out infinite; animation-delay: calc(var(--i) * 80ms); }
@keyframes t3dWave { 0%, 55%, 100% { transform: none; } 22% { transform: translateY(-0.06em); } }
.t3d-type > .t3d-ch { animation: t3dType .26s cubic-bezier(.3, 1.5, .5, 1) both; animation-delay: calc(var(--i) * 30ms); }
@keyframes t3dType { 0% { transform: translateY(0.12em); opacity: 0; } 100% { transform: none; opacity: 1; } }
/* where the game uses the motion: titles pop in, Pip's happy lines wave, rewards burst in gold */
:is(.sheet-head h2, .mr-sign h2, .dawn-sign h1, .bk-title, .cb-title, .title-ribbon, .gb-title b) { animation: t3dPop .45s cubic-bezier(.2, .7, .3, 1) both; transform-origin: 50% 85%; }
.hh-bubble .txt.t3d-shake { display: inline-block; }
.hh-bubble .txt.t3d-wave .ch { display: inline-block; white-space: pre; animation: t3dWave 1.5s ease-in-out infinite; animation-delay: calc(var(--i) * 60ms); }
body .hh-toast-body > span.reward { ${vars(PALETTES.gold)}; color: var(--t-2); text-shadow: ${stack(3)} !important; }
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

let mctx: CanvasRenderingContext2D | null = null;
const measureCtx = () => (mctx ??= document.createElement('canvas').getContext('2d')!);

/** The biggest whole multiple of 16 px (at most the wished size) whose 3D text fits `maxW`. */
export function fitText3D(text: string, wishPx: number, maxW: number): number {
  const g = measureCtx(), s = alagardSafe(text);
  let n = Math.max(1, Math.round(wishPx / 16));
  for (; n > 1; n--) { g.font = alagard(n); if (g.measureText(s).width + 0.35 * 16 * n <= maxW) break; }
  return n;
}

const shade = (hex: string, k: number) => {
  const v = parseInt(hex.slice(1, 7), 16), f = (c: number) => Math.round(Math.max(0, Math.min(255, c * k)));
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
};

/**
 * Draw premium 3D title text on a canvas at full resolution: a soft drop shadow, a smooth extrusion toward the
 * bottom right that darkens with depth, a crisp rounded outline, and a metallic fill (bright top, a darker horizon
 * line, a warm reflection low down). `size` in canvas px (or `n` x 16). `y` is the baseline. `lift(i)` raises
 * letter i by that many sixteenths of the size (per-letter pops and waves). Returns the width of the letters
 * (outline and extrusion add about a third of the size to the right and below).
 */
export function drawText3D(g: CanvasRenderingContext2D, text: string, x: number, y: number, o: { n?: number; size?: number; palette?: PaletteName | Palette; depth?: number; align?: CanvasTextAlign; outline?: boolean; drop?: boolean; lift?: (i: number) => number } = {}): number {
  const s = alagardSafe(text), size = o.size ?? 16 * Math.max(1, o.n ?? 1), d = o.depth ?? 2;
  const pal: Palette = typeof o.palette === 'object' ? o.palette : PALETTES[o.palette ?? 'gold'];
  g.save();
  g.font = `${size}px ${STACK}`; g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.lineJoin = 'round'; g.miterLimit = 2;
  const w = g.measureText(s).width;
  const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' || o.align === 'end' ? x - w : x), y0 = Math.round(y);
  const chars = [...s];
  const xs: number[] = []; { let cx = x0; for (const ch of chars) { xs.push(cx); cx += g.measureText(ch).width; } }
  const each = (dx: number, dy: number, f: (ch: string, px: number, py: number) => void) => {
    if (!o.lift) { f(s, x0 + dx, y0 + dy); return; }
    chars.forEach((ch, i) => f(ch, xs[i] + dx, y0 + dy - ((o.lift!(i) || 0) * size) / 16));
  };
  // [ui10] realistic lettering: a hairline half-strength edge, a thin bevel, a soft shadow (no cartoon outline)
  const step = size * 0.014 * (d >= 3 ? 1.2 : 1), layers = Math.min(2, Math.max(1, Math.round(d))), ow = Math.max(0.8, size * 0.035);
  // soft drop shadow
  if (o.drop !== false) {
    g.save(); g.shadowColor = pal.drop ?? 'rgba(14,8,2,.55)'; g.shadowBlur = size * 0.28; g.shadowOffsetX = size * 0.06; g.shadowOffsetY = size * 0.16;
    g.fillStyle = pal.ol; each(step * layers, step * layers * 1.8, (t, px, py) => g.fillText(t, px, py)); g.restore();
  }
  // the back outline and the shaded extrusion
  if (o.outline !== false) { g.save(); g.globalAlpha = 0.45; g.strokeStyle = pal.ol; g.lineWidth = ow; each(step * layers, step * layers * 1.8, (t, px, py) => g.strokeText(t, px, py)); g.restore(); }
  for (let k = layers; k >= 1; k--) {
    g.fillStyle = shade(pal.ex, 1 - (k / layers) * 0.45);
    each(step * k, step * k * 1.8, (t, px, py) => g.fillText(t, px, py));
  }
  // the crisp outline round the face
  if (o.outline !== false) { g.save(); g.globalAlpha = 0.5; g.strokeStyle = pal.ol; g.lineWidth = ow; each(0, 0, (t, px, py) => g.strokeText(t, px, py)); g.restore(); }
  // the face: metallic, lit from the top
  const top = y0 - size * 0.69, base = y0;
  const gr = g.createLinearGradient(0, top, 0, base + size * 0.19);
  gr.addColorStop(0, pal.hi); gr.addColorStop(0.18, pal.c1); gr.addColorStop(0.45, pal.c2); gr.addColorStop(0.5, pal.c3);
  gr.addColorStop(0.66, pal.c2); gr.addColorStop(0.84, pal.c1); gr.addColorStop(1, pal.c3);
  g.fillStyle = gr;
  each(0, 0, (t, px, py) => g.fillText(t, px, py));
  // a soft specular glint along the top edge
  g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.35; g.fillStyle = '#ffffff';
  each(0, -Math.max(1, size * 0.04), (t, px, py) => g.fillText(t, px, py)); g.restore();
  g.restore();
  return Math.round(w);
}
