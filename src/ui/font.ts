// [text15] The game's typeface: Nunito (SIL OFL 1.1, The Nunito Project Authors; bundled as WOFF2 from
// @fontsource-variable/nunito, latin subset, see src/assets/fonts/FONTS_LICENSE.txt). One warm, rounded, very readable
// family with a variable weight axis: the body is set semi-bold (600), titles, signs and names extra-bold (800), and
// emphasis is bold or italic. Nothing comes from another host.
//
// Sizes are ordinary px. CSS uses the --t1..--t8 tokens (style.css); canvas code asks for `uiFont(n)` (n size steps),
// `fontPx(px)` (a size given in the old 16 px book-face scale) or `fontAt(px)` (exactly px). The old pixel-grid names
// stay so every caller reads the same: GRID is now just "a fifteenth of an em" (outline and shadow offsets scale
// with it) and snapFont() only rounds to whole px.
// `textSafe` swaps the handful of invisible or odd characters for plain ones.
import { options, type VNode } from 'preact';
import bodyUrl from '../assets/fonts/nunito.woff2?url';
import titleUrl from '../assets/fonts/nunito-italic.woff2?url';

export const FAMILY = 'Hoot Sans';
/** titles, signs and names: the same family, extra-bold */
export const CAPS_FAMILY = FAMILY;
/** the game's face, then the system's own sans for any glyph it lacks */
export const STACK = '"Hoot Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
/** titles, signs, names (same family; callers pick the weight) */
export const TITLE_STACK = STACK;
/** the body and title weights */
export const W_BODY = 600, W_TITLE = 800;
/** a fifteenth of an em: offsets of outlines and shadows are counted in these */
export const GRID = 15;
/** one size step in px */
export const EM = 16;
/** kept for callers that scale an old book-face size: the face is set at that size */
export const VIS = 1;
/** kept for callers that scale wished sizes (talk.ts) */
export const SCALE = VIS;
/** the face's proportions in fifteenths of an em: capitals, lowercase, ascent and descent */
export const METRICS = { cap: 10.6, x: 7.3, body: { ascent: 15.2, descent: 5.3 }, title: { ascent: 15.2, descent: 5.3 } } as const;
/** capital height as a fraction of the size */
export const CAP = METRICS.cap / GRID;

/** CSS px per size step of UI text (the --t1 token is one step). */
export const uiFontPx = (): number => 1;
export interface FontOpts { weight?: number; caps?: boolean; italic?: boolean }

/** A size in whole px (at least 6). */
export function snapFont(px: number): number {
  if (!(px > 0)) return EM;
  return Math.max(6, Math.round(px));
}
/** the size for an old book-face size `px` */
export const visPx = (px: number) => snapFont(px * VIS);
const style = (o: FontOpts) => `${o.italic ? 'italic ' : ''}${o.weight ?? (o.caps ? W_TITLE : W_BODY)}`;
/** A canvas/CSS font string for an old book-face size `px` (caps: the title weight). */
export const fontPx = (px: number, o: FontOpts = {}) => `${style(o)} ${visPx(px)}px ${STACK}`;
/** a canvas/CSS font string at exactly `px` */
export const fontAt = (px: number, o: FontOpts = {}) => `${style(o)} ${snapFont(px)}px ${STACK}`;
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
/** Resolves once the face can paint (canvas text waits for it). Adds it itself on pages without the app CSS. */
export function fontReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      const have = (st: string) => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === FAMILY && f.style === st);
      const add = async (url: string, d: FontFaceDescriptors) => { if (!have(d.style ?? 'normal')) document.fonts.add(await new FontFace(FAMILY, `url(${url}) format('woff2')`, d).load()); };
      await Promise.all([add(bodyUrl, { weight: '200 1000', style: 'normal' }), add(titleUrl, { weight: '200 1000', style: 'italic' })]);
      await Promise.all([document.fonts.load(`${W_BODY} 16px "${FAMILY}"`, 'Aa1’…'), document.fonts.load(`${W_TITLE} 16px "${FAMILY}"`, 'Aa1'), document.fonts.load(`italic ${W_BODY} 16px "${FAMILY}"`, 'Aa1')]);
    } catch { /* no FontFace API: canvas text falls back */ }
  })();
  return ready;
}

/**
 * Draw text on a canvas (`n` steps, or `size` px; caps: the title weight), with an optional thin outline (a rounded
 * stroke behind the letters) and an optional soft drop shadow. `y` is the baseline. Returns the width in canvas px.
 */
export function canvasText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, o: { n?: number; size?: number; align?: CanvasTextAlign; shadow?: string; outline?: string; caps?: boolean; weight?: number; italic?: boolean } = {}): number {
  const s = textSafe(text), size = snapFont(o.size ?? stepPx(o.n ?? 1));
  g.save();
  g.font = fontAt(size, { caps: o.caps, weight: o.weight, italic: o.italic });
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
  g.font = `${style(o)} ${size.toFixed(1)}px ${STACK}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const w = g.measureText(s).width;
  g.fillText(s, p.x - w / 2, p.y + capMid(size));
  g.restore();
  return w;
}

let mctx: CanvasRenderingContext2D | null = null;
/** width of `text` at exactly `px` (a CSS token size, say; caps: the title weight) */
export function textWidthPx(text: string, px: number, o: FontOpts = {}): number {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * px * 0.5;
  mctx.font = `${style(o)} ${px}px ${STACK}`;
  return Math.round(mctx.measureText(textSafe(text)).width);
}
/** width of `text` at `n` steps (needs a context only for measuring) */
export function textWidth(text: string, n = 1, o: FontOpts = {}): number {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * 9 * n;
  mctx.font = uiFont(n, o);
  return Math.round(mctx.measureText(textSafe(text)).width);
}

export { bodyUrl, titleUrl };
