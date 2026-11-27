// [type16] The game's two typefaces, defined here once for CSS (style.css reads the same names) and for every piece of
// canvas text (signs, tags, the globe, the office's papers, the floating dialogue):
//   - the display face, Alegreya (Juan Pablo del Peral, Huerta Tipográfica), a calligraphic storybook serif: titles,
//     signs, buttons, names and big numbers. Pip's handwriting is its italic.
//   - the body face, Alegreya Sans, its humanist sans sister: copy, dialogue and small interface text.
// Both are SIL OFL 1.1, bundled as WOFF2 (latin subsets from @fontsource, see src/assets/fonts/*-OFL.txt); nothing comes
// from another host. Callers ask for the display face with `caps: true` (it also picks the title weight)
// or `display: true` (any weight); everything else is set in the body face.
//
// Sizes are ordinary px. CSS uses the --t1..--t8 tokens (style.css); canvas code asks for `uiFont(n)` (n size steps),
// `fontPx(px)` (a size given in the old 16 px book-face scale) or `fontAt(px)` (exactly px). The old pixel-grid names
// stay so every caller reads the same: GRID is now just "a fifteenth of an em" (outline and shadow offsets scale
// with it) and snapFont() only rounds to whole px.
// `textSafe` swaps the handful of invisible or odd characters for plain ones.
import { options, type VNode } from 'preact';
import bodyUrl from '../assets/fonts/alegreya-sans-500.woff2?url';
import body400Url from '../assets/fonts/alegreya-sans-400.woff2?url';
import body700Url from '../assets/fonts/alegreya-sans-700.woff2?url';
import body800Url from '../assets/fonts/alegreya-sans-800.woff2?url';
import bodyItalicUrl from '../assets/fonts/alegreya-sans-400i.woff2?url';
import body700iUrl from '../assets/fonts/alegreya-sans-700i.woff2?url';
import titleUrl from '../assets/fonts/alegreya.woff2?url';
import titleItalicUrl from '../assets/fonts/alegreya-italic.woff2?url';

/** the body face's family name (Alegreya Sans) */
export const FAMILY = 'Hoot Text';
/** the display face's family name (Alegreya) */
export const CAPS_FAMILY = 'Hoot Display';
/** the body face, then the system's own sans for any glyph it lacks */
export const STACK = '"Hoot Text", system-ui, -apple-system, "Segoe UI", sans-serif';
/** titles, signs, buttons, names and big numbers: the display face, then a system serif */
export const TITLE_STACK = '"Hoot Display", "Hoot Text", Georgia, "Times New Roman", serif';
/** the body and title weights (the display face is variable 100-900, the body face 300-900) */
export const W_BODY = 500, W_TITLE = 700;
/** a fifteenth of an em: offsets of outlines and shadows are counted in these */
export const GRID = 15;
/** one size step in px */
export const EM = 16;
/** kept for callers that scale an old book-face size: the face is set at that size */
export const VIS = 1;
/** kept for callers that scale wished sizes (talk.ts) */
export const SCALE = VIS;
/** the faces' proportions in fifteenths of an em: capitals, lowercase, ascent and descent (both faces have 0.70 em
 * capitals; Alegreya Sans' lowercase is 0.45 em, Alegreya's 0.45 em) */
export const METRICS = { cap: 10.2, x: 6.8, body: { ascent: 14.25, descent: 3.75 }, title: { ascent: 14.67, descent: 3.83 } } as const;
/** capital height as a fraction of the size */
export const CAP = METRICS.cap / GRID;

/** CSS px per size step of UI text (the --t1 token is one step). */
export const uiFontPx = (): number => 1;
export interface FontOpts { weight?: number; caps?: boolean; italic?: boolean; /** the display face at the given (or body) weight */ display?: boolean }
/** the family stack for these options */
export const stackOf = (o: FontOpts = {}) => (o.caps || o.display ? TITLE_STACK : STACK);

/** A size in whole px (at least 6). */
export function snapFont(px: number): number {
  if (!(px > 0)) return EM;
  return Math.max(6, Math.round(px));
}
/** the size for an old book-face size `px` */
export const visPx = (px: number) => snapFont(px * VIS);
const style = (o: FontOpts) => `${o.italic ? 'italic ' : ''}${o.weight ?? (o.caps ? W_TITLE : W_BODY)}`;
/** A canvas/CSS font string for an old book-face size `px` (caps: the display face at the title weight). */
export const fontPx = (px: number, o: FontOpts = {}) => `${style(o)} ${visPx(px)}px ${stackOf(o)}`;
/** a canvas/CSS font string at exactly `px` */
export const fontAt = (px: number, o: FontOpts = {}) => `${style(o)} ${snapFont(px)}px ${stackOf(o)}`;
/** the size in px of `n` steps (one step: the UI's body text in canvas art) */
export const stepPx = (n = 1) => snapFont(18 * Math.max(0.5, n));
/** a canvas/CSS font string `n` steps tall */
export const uiFont = (n = 1, o: FontOpts = {}) => fontAt(stepPx(n), o);
/** a fifteenth of the size (outline and shadow offsets) */
export const fpx = (size: number) => size / GRID;
/** how far below the middle of the capitals the baseline sits, at `size` px (centre text: y + capMid(size)) */
export const capMid = (size: number) => (size * CAP) / 2;

const MAP: Record<string, string> = {
  '‐': '-', '‑': '-', '‒': '–', '―': '—', '∙': '·', '⋅': '·', '‧': '·',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
  '​': '', '‌': '', '‍': '', '⁠': '', '️': '', '︎': '',
};
const ODD = /[‐-‒―∙⋅‧    ​-‍⁠️︎]/;
const ODD_G = new RegExp(ODD.source, 'g');

/** Text without invisible joiners and odd dashes or spaces (kept for every caller; the face draws the rest). */
export function textSafe(text: string): string {
  return ODD.test(text) ? text.replace(ODD_G, (ch) => MAP[ch] ?? ch) : text;
}

// ---- every Preact text node goes through textSafe
let installed = false;
export function installTextHook() {
  if (installed) return;
  installed = true;
  const prev = options.vnode;
  options.vnode = (v: VNode) => {
    if (v.type == null) {
      if (typeof v.props === 'string') (v as { props: unknown }).props = textSafe(v.props as unknown as string);
    } else if (typeof v.type === 'string') {
      const p = v.props as { placeholder?: unknown };
      if (typeof p.placeholder === 'string') p.placeholder = textSafe(p.placeholder);
    }
    prev?.(v);
  };
}
installTextHook();

// ---- CSS size tokens (style.css holds the same values)
const TOKENS: Record<string, number> = { t1: 16, t2: 26, t3: 30, t4: 44, t6: 64, t8: 84 };
/** A CSS size for a wished size (whole px). */
export function crispCss(want: number, _dpr?: number): number {
  return Math.round(want);
}
/** the token sizes (CSS px) */
export function tokenSizes(_dpr?: number): Record<string, number> {
  return { ...TOKENS };
}

let ready: Promise<void> | null = null;
/** Resolves once both faces can paint (canvas text waits for it). Adds them itself on pages without the app CSS. */
export function fontReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      const have = (fam: string, st: string) => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === fam && f.style === st);
      const add = async (fam: string, url: string, d: FontFaceDescriptors) => { if (!have(fam, d.style ?? 'normal')) document.fonts.add(await new FontFace(fam, `url(${url}) format('woff2')`, d).load()); };
      await Promise.all([
        add(FAMILY, body400Url, { weight: '400', style: 'normal' }), add(FAMILY, bodyUrl, { weight: '500 600', style: 'normal' }), add(FAMILY, body700Url, { weight: '700', style: 'normal' }), add(FAMILY, body800Url, { weight: '800 900', style: 'normal' }),
        add(FAMILY, bodyItalicUrl, { weight: '300 600', style: 'italic' }), add(FAMILY, body700iUrl, { weight: '700 900', style: 'italic' }),
        add(CAPS_FAMILY, titleUrl, { weight: '400 900', style: 'normal' }), add(CAPS_FAMILY, titleItalicUrl, { weight: '400 900', style: 'italic' }),
      ]);
      await Promise.all([
        document.fonts.load(`${W_BODY} 16px "${FAMILY}"`, 'Aa1’…'), document.fonts.load(`italic ${W_BODY} 16px "${FAMILY}"`, 'Aa1'),
        document.fonts.load(`${W_TITLE} 16px "${CAPS_FAMILY}"`, 'Aa1'), document.fonts.load(`italic ${W_TITLE} 16px "${CAPS_FAMILY}"`, 'Aa1'),
      ]);
    } catch { /* no FontFace API: canvas text falls back */ }
  })();
  return ready;
}

/**
 * Draw text on a canvas (`n` steps, or `size` px; caps: the title weight), with an optional thin outline (a rounded
 * stroke behind the letters) and an optional soft drop shadow. `y` is the baseline. Returns the width in canvas px.
 */
export function canvasText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, o: { n?: number; size?: number; align?: CanvasTextAlign; shadow?: string; outline?: string; caps?: boolean; display?: boolean; weight?: number; italic?: boolean } = {}): number {
  const s = textSafe(text), size = snapFont(o.size ?? stepPx(o.n ?? 1));
  g.save();
  g.font = fontAt(size, { caps: o.caps, display: o.display, weight: o.weight, italic: o.italic });
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const w = g.measureText(s).width;
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' || o.align === 'end' ? x - w : x;
  if (o.shadow) { g.shadowColor = o.shadow; g.shadowOffsetY = Math.max(1, size / 16); g.shadowBlur = Math.max(1, size / 10); }
  if (o.outline) {
    g.lineJoin = 'round'; g.miterLimit = 2;
    g.lineWidth = Math.max(1.5, size / 7);
    g.strokeStyle = o.outline;
    g.strokeText(s, x0, y);
    g.shadowColor = 'transparent';
  }
  g.fillStyle = color;
  g.fillText(s, x0, y);
  g.restore();
  return Math.round(w);
}

/**
 * Text centred on (ux, uy) in the context's current units (the middle of the capitals on `uy`), its capitals about
 * `capUnits` units tall (dials, emblems). Uses the current fillStyle. Returns the width in device pixels.
 */
export function fillTextMid(g: CanvasRenderingContext2D, text: string, ux: number, uy: number, capUnits: number, o: FontOpts = {}): number {
  const m = g.getTransform(), k = Math.hypot(m.a, m.b) || 1;
  const size = Math.max(4, (capUnits * k) / CAP), s = textSafe(text);
  const p = m.transformPoint(new DOMPoint(ux, uy));
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = `${style(o)} ${size.toFixed(1)}px ${stackOf(o)}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const w = g.measureText(s).width;
  g.fillText(s, p.x - w / 2, p.y + capMid(size));
  g.restore();
  return w;
}

let mctx: CanvasRenderingContext2D | null = null;
/** width of `text` at exactly `px` (a CSS token size, say; caps: the display face at the title weight) */
export function textWidthPx(text: string, px: number, o: FontOpts = {}): number {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * px * 0.5;
  mctx.font = `${style(o)} ${px}px ${stackOf(o)}`;
  return Math.round(mctx.measureText(textSafe(text)).width);
}
/** width of `text` at `n` steps (needs a context only for measuring) */
export function textWidth(text: string, n = 1, o: FontOpts = {}): number {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * 9 * n;
  mctx.font = uiFont(n, o);
  return Math.round(mctx.measureText(textSafe(text)).width);
}

export { bodyUrl, bodyItalicUrl, titleUrl, titleItalicUrl };
