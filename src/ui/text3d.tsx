// [text15] Plain, calm lettering in the game's face (font.ts, Nunito): titles, signs and names extra-bold, every
// colour flat. Light text on wood and dark surfaces wears one soft shadow for contrast; dark ink on paper wears none.
// Motion stays small and physical: titles fade up into place, numbers count up and give a little punch,
// exclamations shake once. Everything respects reduced motion and the in-app Calm motion setting (the global rules
// in style.css stop CSS animation; the JS bits below check reducedMotion()).
//
// CSS (installed by installText3D(), called at boot):
//   .t3d                 a title: extra-bold, flat colour, a soft shadow (h1 and h2 get it too)
//   .t3d-lite            small text: flat colour, a softer shadow
//   .t3d-gold | -cream | -sky | -rose | -leaf | -moon | -ink     colours (warm cream is the default; ink is for paper)
//   .t3d-pop             entrance: fades up into place          .t3d-punch  a little punch (re-add to replay)
//   .t3d-shake           an exclamation shake                    .t3d-flash / .t3d-burst  the punch again
//   .t3d-wave / .t3d-type  per letter (see <Letters>): wave is still; type fades the letters in
//
// Preact:   <Letters text="Good morning!" mode="type" />   <CountUp value={n} />   punch(el)
// Canvas:   drawText3D(ctx, text, x, baselineY, { size | n, palette, align, outline, drop, lift }) -> width
//           fitText3D(text, wishPx, maxW) -> n (size steps that fit)
import { cloneElement, isValidElement, toChildArray, type ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { fontAt, snapFont, stepPx, textSafe, uiFont } from './font.ts';
import { reducedMotion } from './chrome/swing.ts';

/** a text colour: the letters' colour, the soft shadow under them (transparent: none) and an outline colour for the
 * rare text that sits on a busy picture */
export interface Palette { c: string; sh: string; ol: string }
/** the UI's ink: dark text on paper and the outlines of the drawn interface */
export const INK = '#120a0e';
const SH = 'rgba(22, 12, 4, 0.55)';
export const PALETTES = {
  gold: { c: '#fbe3b0', sh: SH, ol: '#2a1608' },
  cream: { c: '#fff4e0', sh: SH, ol: '#2a1608' },
  sky: { c: '#dcf1ff', sh: 'rgba(8, 20, 40, 0.55)', ol: '#0e2238' },
  rose: { c: '#ffd9cc', sh: 'rgba(40, 8, 6, 0.55)', ol: '#3a0c08' },
  leaf: { c: '#e6f6cc', sh: 'rgba(10, 26, 6, 0.55)', ol: '#14280c' },
  moon: { c: '#eef0ff', sh: 'rgba(10, 12, 40, 0.6)', ol: '#141a44' },
  ink: { c: '#2e2418', sh: 'transparent', ol: 'rgba(255, 250, 236, 0.8)' },
} satisfies Record<string, Palette>;
export type PaletteName = keyof typeof PALETTES;

// ------------------------------------------------------------------ CSS

const vars = (p: Palette) => `--t-c:${p.c};--t-sh:${p.sh}`;
/** Where the game wears it without a class in its markup: titles, sign names, big numbers ... */
const FULL = ['.hh-name', '.lvup-title', '.lvup-medal b', '.title-ribbon', '.cs-sign span', '.sf-sign', '.sf-sleep', '.seal b', '.tk-times b', '.bk-last-t b', '.n-time', '.lock-time', '.bigclock', '.cb-title'];
/** ... and buttons, counters, labels, toasts and dialogue */
const LITE = ['.hh-num', '.hh-rune b', '.btn.pillow', '.btn.oak', '.lg-btn', '.hh-btn-gold', '.hh-btn-green', '.hh-btn-night', '.hh-btn-cream', '.hh-toast-body > span', '.hh-bubble .txt', '.stat b', '.bk-tile b', '.hh-toollabel', '.tk-hint'];
const T = `:is(.t3d:not(.t3d-lite), h1:not(.qp-q), h2:not(.qp-q), ${FULL.join(', ')})`;
const L = `:is(.t3d.t3d-lite, ${LITE.join(', ')})`;
const CSS = `
:where(.t3d, h1, h2, ${FULL.join(', ')}, ${LITE.join(', ')}) { ${vars(PALETTES.gold)} }
/* the colour each place wears: warm cream on wood and dark or coloured surfaces, dark ink on paper */
:where(.hh-num, .hh-rune b, .cs-sign span, .sf-sign, .sf-sleep, .lvup-medal b, .n-time, .lock-time, .bigclock, .btn.pillow, .btn.oak, .lg-btn, .hh-btn-green, .hh-btn-night) { ${vars(PALETTES.cream)} }
:where(.bk-title, .tk-times b, .seal b, .bk-last-t b, .stat b, .bk-tile b, .cb-title, .hh-toast-body > span, .hh-bubble .txt, .hh-toollabel, .tk-hint, .hh-btn-cream, .qp-sheet h2, .sheet-head h2) { ${vars(PALETTES.ink)} }
:where(.lock-time, .n-time) { ${vars(PALETTES.moon)} }
.t3d-gold { ${vars(PALETTES.gold)} } .t3d-cream { ${vars(PALETTES.cream)} } .t3d-sky { ${vars(PALETTES.sky)} }
.t3d-rose { ${vars(PALETTES.rose)} } .t3d-leaf { ${vars(PALETTES.leaf)} } .t3d-moon { ${vars(PALETTES.moon)} } .t3d-ink { ${vars(PALETTES.ink)} }
body ${T} { font-family: var(--font-title); font-weight: var(--w-title, 800); color: var(--t-c); text-shadow: 0 1px 0 var(--t-sh), 0 2px 5px var(--t-sh) !important; }
body ${L} { color: var(--t-c); text-shadow: 0 1px 2px var(--t-sh) !important; }
body :is(.hh-toast-body > span, .hh-bubble .txt, .hh-toollabel, .tk-hint, .t3d-ink.t3d-lite) { color: var(--t-c); text-shadow: none !important; }
.hh-dig { width: 0.62em !important; text-align: right !important; overflow: visible !important; clip-path: inset(-0.1em -0.5em 0 -0.2em); }
.hh-strip i { line-height: 1em !important; }
/* motion: small and physical; the global reduced-motion rules freeze all of it */
.t3d-pop { animation: t3dPop .4s cubic-bezier(.22, 1, .36, 1) both; }
@keyframes t3dPop { 0% { transform: translateY(6px); opacity: 0; } 100% { transform: none; opacity: 1; } }
.t3d-punch, .t3d-flash, .t3d-burst { animation: t3dPunch .42s cubic-bezier(.3, 1.4, .5, 1); }
@keyframes t3dPunch { 0% { transform: none; } 35% { transform: scale(1.06); } 100% { transform: none; } }
.t3d-shake { animation: t3dShake .36s linear 1; }
@keyframes t3dShake { 0%, 100% { transform: none; } 25% { transform: translateX(-2px) rotate(-1.5deg); } 50% { transform: translateX(2px) rotate(1deg); } 75% { transform: translateX(-1px); } }
.t3d-ch { display: inline-block; white-space: pre; }
.hh-sr { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.t3d-seg { display: inline-block; }
.t3d-type > .t3d-ch { animation: t3dType .3s ease-out both; animation-delay: calc(var(--i) * 28ms); }
@keyframes t3dType { 0% { opacity: 0; } 100% { opacity: 1; } }
/* where the game uses the motion: titles fade up into place */
:is(.sheet-head h2, .mr-sign h2, .dawn-sign h1, .bk-title, .cb-title, .title-ribbon, .gb-title b) { animation: t3dPop .4s cubic-bezier(.22, 1, .36, 1) both; }
.hh-bubble .txt.t3d-shake { display: inline-block; }
body .hh-toast-body > span.reward { font-weight: 800; }
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

/** Text for a title: mode 'type' fades its letters in one after another; 'wave' (the old letter wave) is plain. */
export function Letters(p: { text: string; mode?: 'wave' | 'type'; class?: string; palette?: PaletteName }) {
  installText3D();
  const s = textSafe(p.text);
  // [text15] no letter hops: a 'wave' line is plain text
  if ((p.mode ?? 'wave') === 'wave') return <span class={`t3d ${p.palette ? 't3d-' + p.palette : ''} ${p.class ?? ''}`}>{s}</span>;
  const cls = `t3d ${p.palette ? 't3d-' + p.palette : ''} t3d-${p.mode ?? 'wave'} ${p.class ?? ''}`;
  return <span class={cls} aria-label={s}>{[...s].map((ch, i) => <span aria-hidden="true" class={'t3d-ch' + (ch === ' ' ? '' : ' t3d')} style={{ '--i': i } as Record<string, number>}>{ch}</span>)}</span>;
}

/** Put each bare text of a title (next to icons) in its own span (kept for layouts that style the segments). */
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

/** The biggest size step (at most the wished size, in 16 px steps; quarter steps below) whose text fits `maxW`. */
export function fitText3D(text: string, wishPx: number, maxW: number): number {
  const g = measureCtx(), s = textSafe(text);
  let n = Math.max(0.5, Math.round((wishPx / 16) * 4) / 4);
  for (; n > 0.5; n -= 0.25) { g.font = uiFont(n, { caps: true }); if (g.measureText(s).width + 0.1 * stepPx(n) <= maxW) break; }
  return n;
}

/**
 * [text15] Draw lettering on a canvas: flat colour (the palette's), one soft shadow under it (unless `drop` is false or
 * the palette has none) and, only when asked (`outline: true`), a thin rounded outline for text on a busy picture.
 * `size` in canvas px (or `n` steps); `caps`: the title weight (the default: pass caps: false for body text);
 * `italic` for a whisper. `y` is the baseline. `lift(i)` raises letter i by that many sixteenths of the size.
 * Returns the width of the letters. (`depth` is accepted and ignored: the letters are flat.)
 */
export function drawText3D(g: CanvasRenderingContext2D, text: string, x: number, y: number, o: { n?: number; size?: number; palette?: PaletteName | Palette; depth?: number; align?: CanvasTextAlign; outline?: boolean; drop?: boolean; lift?: (i: number) => number; caps?: boolean; italic?: boolean; weight?: number } = {}): number {
  const s = textSafe(text), size = snapFont(o.size ?? stepPx(o.n ?? 1));
  const pal: Palette = typeof o.palette === 'object' ? o.palette : PALETTES[o.palette ?? 'gold'];
  g.save();
  g.font = fontAt(size, { caps: o.caps ?? true, italic: o.italic, weight: o.weight }); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const w = g.measureText(s).width;
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' || o.align === 'end' ? x - w : x;
  const chars = [...s];
  const xs: number[] = []; if (o.lift) { let cx = x0; for (const ch of chars) { xs.push(cx); cx += g.measureText(ch).width; } }
  const each = (f: (t: string, px: number, py: number) => void) => {
    if (!o.lift) { f(s, x0, y); return; }
    chars.forEach((ch, i) => f(ch, xs[i], y - ((o.lift!(i) || 0) * size) / 16));
  };
  if (o.drop !== false && pal.sh !== 'transparent') { g.shadowColor = pal.sh; g.shadowOffsetY = Math.max(1, size / 18); g.shadowBlur = Math.max(1.5, size / 9); }
  if (o.outline === true) {
    g.lineJoin = 'round'; g.lineWidth = Math.max(1.5, size / 8); g.strokeStyle = pal.ol;
    each((t, px, py) => g.strokeText(t, px, py));
    g.shadowColor = 'transparent';
  }
  g.fillStyle = pal.c;
  each((t, px, py) => g.fillText(t, px, py));
  g.restore();
  return Math.round(w);
}
