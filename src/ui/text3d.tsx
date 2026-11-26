// [font14] Chunky pixel lettering in the game's pixel faces (font.ts; titles in the display face): a hard one-font-pixel ink outline (the same ink
// as the UI's and the world's outlines), an ink extrusion below it so the letters stand proud like a sticker, a face
// shaded in hard bands a font pixel row each (bright top, colour, deeper foot) and a hard translucent drop shadow. Plus game-style motion: titles pop in with squash and stretch, numbers count up and
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
import { fontAt, GRID, snapFont, stepPx, textSafe, uiFont } from './font.ts';
import { reducedMotion } from './chrome/swing.ts';

/** a palette: top highlight row, three fill bands (light to dark), outline, extrusion */
export interface Palette { hi: string; c1: string; c2: string; c3: string; ol: string; ex: string; drop?: string; /** CSS outline width ('0px' = printed ink, no outline) */ ow?: string }
/** the UI's ink: every outline in the game (2D and 3D) is this near-black */
export const INK = '#120a0e';
export const PALETTES = {
  gold: { hi: '#fff8d8', c1: '#ffe07a', c2: '#f4b43a', c3: '#c97a16', ol: INK, ex: '#5c2e08' },
  cream: { hi: '#ffffff', c1: '#fffaf0', c2: '#f7e8c6', c3: '#e2c48c', ol: INK, ex: '#4a2810' },
  sky: { hi: '#f2fbff', c1: '#c8ecff', c2: '#7cc6f2', c3: '#3a8fd0', ol: INK, ex: '#123a66' },
  rose: { hi: '#fff0ec', c1: '#ffc4b4', c2: '#f27a62', c3: '#cc3e34', ol: INK, ex: '#5e1414' },
  leaf: { hi: '#f4ffe2', c1: '#d2f29a', c2: '#8fcf4e', c3: '#4e9a2a', ol: INK, ex: '#1c4012' },
  moon: { hi: '#ffffff', c1: '#f0f1ff', c2: '#cfd3ff', c3: '#9ea6f0', ol: INK, ex: '#262c78' },
  ink: { hi: '#4a5fae', c1: '#2e3f86', c2: '#22306c', c3: '#18224e', ol: 'rgba(255,250,236,.7)', ex: '#c2a777', drop: 'rgba(0,0,0,0)', ow: '0px' },
} satisfies Record<string, Palette>;
export type PaletteName = keyof typeof PALETTES;

// ------------------------------------------------------------------ CSS

const vars = (p: Palette) => `--t-ow:${p.ow ?? 'var(--fp)'};--t-hi:${p.hi};--t-1:${p.c1};--t-2:${p.c2};--t-3:${p.c3};--t-ol:${p.ol};--t-ex:${p.ex};--t-dr:${p.drop ?? 'rgba(18,10,4,.38)'}`;
/** [font14] one font pixel of the pixel face (its em is 18 font pixels): every outline and extrusion is whole font pixels */
const FP = 'var(--fp)';
const at = (x: number, y: number, c: string, w = FP) => `calc(${w} * ${x}) calc(${w} * ${y}) 0 ${c}`;
/** a hard pixel outline: the eight neighbours one font pixel away (square, like a sprite's outline) */
const ring = (c: string, w = FP) => [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].map(([x, y]) => at(x, y, c, w)).join(',');
/**
 * [font14] Chunky pixel lettering: a one-font-pixel ink outline all round, `n` font pixels of ink extrusion below it
 * (the letters stand proud like a sticker or a carved sign), then a hard translucent drop shadow one more font pixel
 * down and to the right. No blur anywhere: every edge lands on the pixel grid.
 */
const OW = 'var(--t-ow, var(--fp))';
const stack = (n: number) => {
  const out = [ring('var(--t-ol)', OW)];
  for (let k = 2; k <= n + 1; k++) out.push(at(-1, k, 'var(--t-ol)'), at(0, k, 'var(--t-ol)'), at(1, k, 'var(--t-ol)'));
  out.push(at(0, n + 2, 'var(--t-dr)'), at(1, n + 2, 'var(--t-dr)'), at(2, n + 2, 'var(--t-dr)'), at(2, n + 1, 'var(--t-dr)'));
  return out.join(',');
};
/** Where the game wears it without a class in its markup: titles, sign names, big numbers (full 3D) ... */
const FULL = ['.hh-name', '.lvup-title', '.lvup-medal b', '.title-ribbon', '.cs-sign span', '.sf-sign', '.sf-sleep', '.seal b', '.tk-times b', '.bk-last-t b', '.n-time', '.lock-time', '.bigclock', '.cb-title'];
/** ... and buttons, counters, labels, toasts and dialogue (light 3D: outline and a one-pixel extrusion) */
const LITE = ['.hh-num', '.hh-rune b', '.btn.pillow', '.btn.oak', '.lg-btn', '.hh-btn-gold', '.hh-btn-green', '.hh-btn-night', '.hh-btn-cream', '.hh-toast-body > span', '.hh-bubble .txt', '.stat b', '.bk-tile b', '.hh-toollabel', '.tk-hint'];
const T = `:is(.t3d:not(.t3d-lite), h1:not(.qp-q), h2:not(.qp-q), ${FULL.join(', ')})`;
const L = `:is(.t3d.t3d-lite, ${LITE.join(', ')})`;
const CSS = `
:where(.t3d, h1, h2, ${FULL.join(', ')}, ${LITE.join(', ')}) { ${vars(PALETTES.gold)}; --fp: calc(1em / 15); --tp: var(--fp); --ow: var(--fp); }
/* the palette each place wears: gold for titles on wood, cream on dark and coloured surfaces, ink on paper */
:where(.hh-num, .hh-rune b, .cs-sign span, .sf-sign, .sf-sleep, .lvup-medal b, .n-time, .lock-time, .bigclock, .btn.pillow, .btn.oak, .lg-btn, .hh-btn-green, .hh-btn-night) { ${vars(PALETTES.cream)} }
:where(.bk-title, .tk-times b, .seal b, .bk-last-t b, .stat b, .bk-tile b, .cb-title, .hh-toast-body > span, .hh-bubble .txt, .hh-toollabel, .tk-hint, .hh-btn-cream, .qp-sheet h2, .sheet-head h2) { ${vars(PALETTES.ink)} }
:where(.lock-time, .n-time) { ${vars(PALETTES.moon)} }
.t3d-gold { ${vars(PALETTES.gold)} } .t3d-cream { ${vars(PALETTES.cream)} } .t3d-sky { ${vars(PALETTES.sky)} }
.t3d-rose { ${vars(PALETTES.rose)} } .t3d-leaf { ${vars(PALETTES.leaf)} } .t3d-moon { ${vars(PALETTES.moon)} } .t3d-ink { ${vars(PALETTES.ink)} }
body ${T} { font-family: var(--font-title); color: var(--t-2); text-shadow: ${stack(1)} !important; }
body ${T}:is(.t3d-deep, h1, .lvup-title, .title-ribbon, .bigclock, .n-time, .lock-time) { text-shadow: ${stack(2)} !important; }
body ${L} { color: var(--t-1); text-shadow: ${ring('var(--t-ol)', OW)}, ${at(-1, 2, 'var(--t-ol)')}, ${at(0, 2, 'var(--t-ol)')}, ${at(1, 2, 'var(--t-ol)')}, ${at(1, 3, 'var(--t-dr)')} !important; }
body :is(.hh-toast-body > span, .hh-bubble .txt, .hh-toollabel, .tk-hint, .t3d-ink.t3d-lite) { color: var(--t-2); text-shadow: ${at(0, 1, 'color-mix(in srgb, var(--t-ex), transparent 40%)')} !important; }
.hh-dig { width: calc(6em / 15) !important; text-align: right !important; overflow: visible !important; clip-path: inset(-0.1em -0.5em 0 -0.2em); } /* the wheels clip only top and bottom: the outline and extrusion show */
.hh-strip i { line-height: 1em !important; }
:where([data-t]) { position: relative; }
body :is(${T}[data-t], ${T} [data-t])::after {
  content: attr(data-t); position: absolute; inset: 0; box-sizing: border-box; padding: inherit; margin: 0; border: 0;
  display: inherit; flex-direction: inherit; flex-wrap: inherit; align-items: inherit; justify-content: inherit; gap: inherit;
  font: inherit; line-height: inherit; letter-spacing: inherit; text-align: inherit; text-indent: inherit; text-transform: inherit; white-space: inherit; overflow-wrap: inherit;
  color: transparent; text-shadow: none; pointer-events: none; overflow: hidden; transform: none; animation: none;
  /* [font14] the top of the display face's content box in each line (16 font pixels: 12 up, 4 down); capitals stand
     from font pixel 5 to the baseline at 12, lowercase from 7. Hard bands, whole font pixel rows: a bright top, the
     colour, a deeper foot, like a sprite lit from above */
  --c0: calc((1lh - var(--fp) * 16) / 2);
  background: linear-gradient(180deg, var(--t-hi) 0, var(--t-hi) calc(var(--c0) + var(--fp) * 6), var(--t-1) calc(var(--c0) + var(--fp) * 6), var(--t-1) calc(var(--c0) + var(--fp) * 8), var(--t-2) calc(var(--c0) + var(--fp) * 8), var(--t-2) calc(var(--c0) + var(--fp) * 10), var(--t-3) calc(var(--c0) + var(--fp) * 10), var(--t-3) 1lh) 0 0 / 100% 1lh repeat-y content-box;
  -webkit-background-clip: text; background-clip: text;
}
/* game-style motion; the global reduced-motion rules freeze all of it */
.t3d-pop { animation: t3dPop .45s steps(6, end) both; transform-origin: 50% 85%; }
@keyframes t3dPop { 0% { transform: translateY(calc(1em / 15 * 4)); opacity: 0; } 40% { transform: translateY(calc(1em / -15 * 2)); opacity: 1; } 70% { transform: translateY(calc(1em / 15)); } 100% { transform: none; opacity: 1; } }
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
/* [font14] hand-lettered titles (font.ts splits h1, h2 and sheet-title text into letters): each letter rests a font
   pixel up or down in a fixed pattern and now and then a little hop runs along the word, in whole font pixels */
.hh-sr { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.hop-w { display: inline-block; white-space: nowrap; }
.hop-s { display: inline-block; white-space: pre; }
.hop { display: inline-block; white-space: pre; --fp: calc(1em / 15); transform: translateY(calc(var(--fp) * var(--y, 0))); animation: hhHop 6s steps(1, end) infinite; animation-delay: calc(1.4s + var(--i, 0) * 70ms); }
@keyframes hhHop {
  0%, 100% { transform: translateY(calc(var(--fp) * var(--y, 0))); }
  2% { transform: translateY(calc(var(--fp) * (var(--y, 0) - 2))); }
  4% { transform: translateY(calc(var(--fp) * (var(--y, 0) - 3))); }
  6% { transform: translateY(calc(var(--fp) * (var(--y, 0) - 1))); }
  8% { transform: translateY(calc(var(--fp) * (var(--y, 0) + 1))); }
  10% { transform: translateY(calc(var(--fp) * var(--y, 0))); }
}
.t3d-seg { display: inline-block; }
.t3d-wave > .t3d-ch { animation: t3dWave 1.5s steps(1, end) infinite; animation-delay: calc(var(--i) * 80ms); }
@keyframes t3dWave { 0%, 40%, 100% { transform: none; } 12%, 28% { transform: translateY(calc(1em / -15)); } 20% { transform: translateY(calc(2em / -15)); } }
.t3d-type > .t3d-ch { animation: t3dType .24s steps(3, end) both; animation-delay: calc(var(--i) * 30ms); }
@keyframes t3dType { 0% { transform: translateY(calc(2em / 15)); opacity: 0; } 50% { transform: translateY(calc(1em / -15)); opacity: 1; } 100% { transform: none; opacity: 1; } }
/* where the game uses the motion: titles pop in, Pip's happy lines wave, rewards burst in gold */
:is(.sheet-head h2, .mr-sign h2, .dawn-sign h1, .bk-title, .cb-title, .title-ribbon, .gb-title b) { animation: t3dPop .45s steps(6, end) both; transform-origin: 50% 85%; }
.hh-bubble .txt.t3d-shake { display: inline-block; }
.hh-bubble .txt.t3d-wave .ch { display: inline-block; white-space: pre; animation: t3dWave 1.5s steps(1, end) infinite; animation-delay: calc(var(--i) * 60ms); }
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
  const s = textSafe(p.text);
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

/** The biggest whole size step (at most the wished size, in old 16 px steps) whose 3D text fits `maxW`. */
export function fitText3D(text: string, wishPx: number, maxW: number): number {
  const g = measureCtx(), s = textSafe(text);
  let n = Math.max(1, Math.round(wishPx / 16));
  for (; n > 1; n--) { g.font = uiFont(n, { caps: true }); if (g.measureText(s).width + 0.3 * stepPx(n) <= maxW) break; }
  return n;
}

const shade = (hex: string, k: number) => {
  const v = parseInt(hex.slice(1, 7), 16), f = (c: number) => Math.round(Math.max(0, Math.min(255, c * k)));
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
};

/**
 * [font14] Draw pixel lettering on a canvas: a hard translucent drop shadow, a one-font-pixel ink outline all round,
 * an ink extrusion below it (`depth` 1-3 font pixels), a darker lip, and a face shaded in hard bands a font pixel row
 * each (bright top, colour, deeper foot). `size` in canvas px (or `n` steps) is snapped to the 18 px grid and the text
 * to whole pixels, so every edge is crisp. `y` is the baseline. `lift(i)` raises letter i by that many sixteenths of
 * the size (rounded to whole font pixels; per-letter pops and waves). Returns the width of the letters (the outline
 * and extrusion add about a quarter of the size to the right and below).
 */
export function drawText3D(g: CanvasRenderingContext2D, text: string, x: number, y: number, o: { n?: number; size?: number; palette?: PaletteName | Palette; depth?: number; align?: CanvasTextAlign; outline?: boolean; drop?: boolean; lift?: (i: number) => number; caps?: boolean; italic?: boolean } = {}): number {
  const s = textSafe(text), size = snapFont(o.size ?? stepPx(o.n ?? 1)), p = Math.max(1, Math.round(size / GRID));
  const d = Math.max(1, Math.min(3, Math.round(o.depth ?? 2)));
  const pal: Palette = typeof o.palette === 'object' ? o.palette : PALETTES[o.palette ?? 'gold'];
  g.save();
  g.font = fontAt(size, { caps: o.caps }); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const w = g.measureText(s).width;
  const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' || o.align === 'end' ? x - w : x), y0 = Math.round(y);
  const chars = [...s];
  const xs: number[] = []; { let cx = x0; for (const ch of chars) { xs.push(cx); cx += g.measureText(ch).width; } }
  const each = (dx: number, dy: number, f: (ch: string, px: number, py: number) => void) => {
    if (!o.lift) { f(s, x0 + dx, y0 + dy); return; }
    chars.forEach((ch, i) => f(ch, xs[i] + dx, y0 + dy - Math.round(((o.lift!(i) || 0) * size) / 16 / p) * p));
  };
  const fill = (dx: number, dy: number) => each(dx * p, dy * p, (t, px, py) => g.fillText(t, px, py));
  const ink = o.outline !== false;
  // the hard drop shadow, one font pixel below and right of the extrusion
  if (o.drop !== false) { g.fillStyle = pal.drop ?? 'rgba(14,8,2,.42)'; for (const dx of [0, 1, 2]) fill(dx, d + 2); fill(2, d + 1); }
  if (ink) {
    g.fillStyle = pal.ol;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) fill(dx, dy);
    for (let k = 2; k <= d + 1; k++) for (const dx of [-1, 0, 1]) fill(dx, k);
  }
  // the lip (the letters' cut edge, in shade)
  g.fillStyle = shade(pal.ex, 1.15);
  for (let k = 1; k <= d; k++) fill(0, k);
  // the face: hard bands a font pixel row each (capitals stand 7 font pixels above the baseline)
  const gr = g.createLinearGradient(0, y0 - 7 * p, 0, y0 + 4 * p), st = (a: number, b: number, c: string) => { gr.addColorStop(a / 11, c); gr.addColorStop(b / 11, c); };
  st(0, 1, pal.hi); st(1, 3, pal.c1); st(3, 5, pal.c2); st(5, 11, pal.c3);
  g.fillStyle = gr;
  fill(0, 0);
  g.restore();
  return Math.round(w);
}
