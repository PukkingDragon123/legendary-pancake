// The game's typefaces, two pixel fonts by SpicyGame Studios (CC0; supplied by the project owner):
//   Quest Square  the body face: every word of copy, buttons, counters, dialogue. Square, compact and very readable,
//                 drawn on a 15 px em (capitals 7 font pixels tall, lowercase 5), tabular digits.
//   Retro Sans    the display face: titles, signs, names, big clock numbers. Chunky and friendly with a quirky slant
//                 to its "!" and "W", drawn on a 17 px em, its capitals also 7 font pixels tall.
// Both are bundled (src/assets/fonts/*.woff2; rescaled so each font pixel is exactly 128 units, see art/fonts/), so
// nothing comes from another host. Retro Sans is loaded with size-adjust 17/15, so at any font size both faces share
// one grid: one em is 15 font pixels and the capitals of both stand 7 font pixels tall.
//
// Pixel text is only crisp when every font pixel covers whole device pixels, so sizes are whole multiples of the 15 px
// grid in device pixels: CSS uses the --t1..--t8 tokens, which installFontScale() snaps to this screen's pixel ratio,
// and canvas code asks for `uiFont(n)` or `fontPx(px)`. Those take the old book-face sizes (a 16 px step) and give the
// grid size whose capitals stand about as tall (VIS), so every caller's layout keeps its proportions. There is one
// weight and no italic: emphasis comes from the display face, colour, size and the chunky outline (text3d.tsx).
// `textSafe` swaps the handful of characters neither face draws for their nearest twins.
import { h, options, type VNode } from 'preact';
import bodyUrl from '../assets/fonts/quest-square.woff2?url';
import titleUrl from '../assets/fonts/retro-sans.woff2?url';

export const FAMILY = 'Hoot Pixel';
/** the display face (titles, signs, names) */
export const CAPS_FAMILY = 'Hoot Title';
/** the body face (and, for a missing glyph, a plain monospace) */
export const STACK = '"Hoot Pixel", ui-monospace, monospace';
/** titles, signs, names */
export const TITLE_STACK = '"Hoot Title", "Hoot Pixel", ui-monospace, monospace';
/** the faces' shared pixel grid: one em is 15 font pixels */
export const GRID = 15;
/** one size step in px (one em at one device pixel per font pixel) */
export const EM = GRID;
/** a pixel-face size per old book-face px for the same cap height (capitals: 7/15 em here, about 0.62 em there) */
export const VIS = 4 / 3;
/** kept for callers that scale wished sizes (talk.ts): the old size times this is the pixel-face size */
export const SCALE = VIS;
/** the faces in font pixels: capitals, lowercase, and each face's ascent and descent (its content box) */
export const METRICS = { cap: 7, x: 5, body: { ascent: 11, descent: 3 }, title: { ascent: 12, descent: 4 } } as const;
/** Retro Sans is drawn on a 17 px em: scaled so its font pixels match Quest Square's */
const TITLE_ADJUST = '113.3333%';

/** CSS px per size step of UI text (the --t1 token is one step). */
export const uiFontPx = (): number => 1;
export interface FontOpts { weight?: number; caps?: boolean; italic?: boolean }

/** A size (px) snapped to the pixel grid: a whole number of px per font pixel, at least one. */
export function snapFont(px: number): number {
  if (!(px > 0)) return GRID;
  return Math.max(1, Math.round(px / GRID)) * GRID;
}
/** the grid size whose capitals stand about as tall as the old book face's at `px` */
export const visPx = (px: number) => snapFont(px * VIS);
/** A canvas/CSS font string for an old book-face size `px` (caps: the display face), snapped to the grid. */
export const fontPx = (px: number, o: FontOpts = {}) => `400 ${visPx(px)}px ${o.caps ? TITLE_STACK : STACK}`;
/** a canvas/CSS font string at exactly `px` (already on the grid) */
export const fontAt = (px: number, o: FontOpts = {}) => `400 ${snapFont(px)}px ${o.caps ? TITLE_STACK : STACK}`;
/** the size in px of `n` steps (one step: the old 16 px UI text, so about 18 px of book face) */
export const stepPx = (n = 1) => visPx(16 * 1.12 * Math.max(0.5, n));
/** a canvas/CSS font string `n` steps tall */
export const uiFont = (n = 1, o: FontOpts = {}) => fontAt(stepPx(n), o);
/** one font pixel at `size` px */
export const fpx = (size: number) => size / GRID;

const MAP: Record<string, string> = {
  '‐': '-', '‑': '-', '‒': '–', '―': '—', '∙': '·', '⋅': '·', '‧': '·',
  ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
  '№': 'No.', '½': '.5', '¼': '.25', '¾': '.75', '⅓': '1/3', '★': '*', '✦': '*', '✧': '*', '☆': '*', '✶': '*', '❤': '♥', '▸': '>', '▹': '>', '◂': '<',
  '​': '', '‌': '', '‍': '', '⁠': '', '️': '', '︎': '',
};
const ODD = /[‐-‒―∙⋅‧  - №½¼¾⅓★✦✧☆✶❤▸▹◂​-‍⁠️︎]/;
const ODD_G = new RegExp(ODD.source, 'g');

/** Text the faces can draw: the few characters neither has become their nearest twins; everything else is kept. */
export function textSafe(text: string): string {
  return ODD.test(text) ? text.replace(ODD_G, (ch) => MAP[ch] ?? ch) : text;
}

// ---- [font14] hand-lettered titles: each letter its own box, nudged a font pixel up or down in a fixed playful
// pattern (like letters stamped by hand) and hopping in a little wave now and then (text3d.tsx .hop). The words stay
// whole for wrapping; screen readers get the plain title from a visually hidden copy.
/** each letter's resting offset in font pixels (up is negative) */
const HOP_Y = [0, -1, 0, 1, 0, 0, -1, 1, 0, -1, 0, 0, 1, -1];
/** titles longer than this stay plain text (sentences, not titles) */
const HOP_MAX = 44;
function hopLetters(text: string): VNode<any>[] { // eslint-disable-line @typescript-eslint/no-explicit-any
  const out: VNode<any>[] = [h('span', { class: 'hh-sr' }, text)];
  let i = 0;
  text.split(' ').forEach((w, wi) => {
    if (wi) out.push(h('span', { class: 'hop-s', 'aria-hidden': 'true' }, ' '));
    if (!w) return;
    out.push(h('span', { class: 'hop-w', 'aria-hidden': 'true' }, [...w].map((ch) => {
      const k = i++;
      return h('span', { class: 'hop', 'data-t': ch, style: `--y:${HOP_Y[k % HOP_Y.length]};--i:${k}` }, ch);
    })));
  });
  return out;
}

// ---- every Preact text node goes through textSafe; titles get their fill copy in data-t (text3d.tsx)
let installed = false;
export function installTextHook() {
  if (installed) return;
  installed = true;
  const prev = options.vnode;
  options.vnode = (v: VNode) => {
    if (v.type == null) {
      if (typeof v.props === 'string') (v as { props: unknown }).props = textSafe(v.props as unknown as string);
    } else if (typeof v.type === 'string') {
      const p = v.props as { placeholder?: unknown; class?: unknown; className?: unknown; children?: unknown; 'data-t'?: string };
      if (typeof p.placeholder === 'string') p.placeholder = textSafe(p.placeholder);
      // 3D text (text3d.tsx): its pixel-shaded fill is drawn from a copy of the text in data-t
      const cls = typeof p.class === 'string' ? p.class : typeof p.className === 'string' ? p.className : '';
      if (v.type === 'h1' || v.type === 'h2' || /(^|\s)(t3d|t3d-seg|hh-name|lvup-title|title-ribbon|cb-title)(\s|$)/.test(cls)) {
        const c = p.children, parts = Array.isArray(c) ? c : [c];
        if (parts.length && parts.every((x) => typeof x === 'string' || typeof x === 'number')) {
          const text = textSafe(parts.join(''));
          // titles (h1, h2 and the title segments of sheet heads) are hand-lettered: hopping letters
          const hop = (v.type === 'h1' || v.type === 'h2' || /(^|\s)t3d-seg(\s|$)/.test(cls)) && !/(^|\s)(qp-q|no-hop)(\s|$)/.test(cls) && text.trim().length > 0 && text.length <= HOP_MAX;
          if (hop) p.children = hopLetters(text);
          else p['data-t'] = text;
        }
      }
    }
    prev?.(v);
  };
}
installTextHook();

// ---- titles whose text sits inside a child element still need their data-t copy (text3d.tsx's band fill)
const T3D_HOST = 'h1:not(.qp-q), h2:not(.qp-q), .t3d:not(.t3d-lite), .hh-name, .lvup-title, .title-ribbon, .cb-title, .cs-sign span, .seal b, .tk-times b, .bk-last-t b';
let tagOn = false, tagQueued = 0;
function tagPass() {
  tagQueued = 0;
  for (const host of document.querySelectorAll(T3D_HOST)) {
    const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const t = n as Text, el = t.parentElement;
      if (el && el.childNodes.length === 1 && t.data.trim() && el.getAttribute('data-t') !== t.data && !el.classList.contains('hh-sr')) el.setAttribute('data-t', t.data);
    }
  }
}
/** Keep the 3D titles' fill copies current (call once at boot). */
export function installTextSnap() {
  if (tagOn || typeof MutationObserver === 'undefined') return;
  tagOn = true;
  new MutationObserver(() => { if (!tagQueued) tagQueued = requestAnimationFrame(tagPass); }).observe(document.body, { childList: true, subtree: true, characterData: true });
  tagPass();
}

// ---- CSS size tokens snapped to this screen: each token is a whole number of device pixels per font pixel
/** each token's wished size in font pixels of CSS px (t1 body copy; t2 titles; t3-t8 display) */
const TOKENS: [string, number][] = [['t1', 1.6], ['t2', 2.4], ['t3', 3.1], ['t4', 4.4], ['t6', 6.4], ['t8', 8.4]];
/** A CSS size near `want` px at which every font pixel covers whole device pixels on this screen. */
export function crispCss(want: number, dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1): number {
  const q = Math.max(1, Math.round((want / GRID) * dpr));
  return (q * GRID) / dpr;
}
/** the token sizes (CSS px) for a pixel ratio: each a whole number of device pixels per font pixel, each bigger than the last */
export function tokenSizes(dpr = typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1): Record<string, number> {
  const out: Record<string, number> = {};
  let last = 0;
  for (const [k, fp] of TOKENS) {
    const q = Math.max(last + 1, Math.round(fp * dpr));
    out[k] = (q * GRID) / dpr;
    last = q;
  }
  return out;
}
let scaleOn = false;
/** Keep --t1..--t8 crisp for this screen's pixel ratio (call once at boot). */
export function installFontScale() {
  if (scaleOn || typeof document === 'undefined') return;
  scaleOn = true;
  const apply = () => {
    const st = document.documentElement.style;
    for (const [k, v] of Object.entries(tokenSizes())) st.setProperty(`--${k}`, `${v}px`);
  };
  apply();
  addEventListener('resize', apply);
}

let ready: Promise<void> | null = null;
/** Resolves once the faces can paint (canvas text waits for it). Adds them itself on pages without the app CSS. */
export function fontReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      const have = (fam: string) => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === fam);
      const add = async (fam: string, url: string, d: FontFaceDescriptors) => { if (!have(fam)) document.fonts.add(await new FontFace(fam, `url(${url}) format('woff2')`, d).load()); };
      await Promise.all([
        add(FAMILY, bodyUrl, { weight: '100 900', style: 'normal' }),
        add(CAPS_FAMILY, titleUrl, { weight: '100 900', style: 'normal', sizeAdjust: TITLE_ADJUST } as FontFaceDescriptors),
      ]);
      await Promise.all([document.fonts.load(`15px "${FAMILY}"`, 'Aa1’…'), document.fonts.load(`15px "${CAPS_FAMILY}"`, 'Aa1')]);
    } catch { /* no FontFace API: canvas text falls back */ }
  })();
  return ready;
}

/**
 * Draw pixel text on a canvas (`n` steps, or `size` px on the grid; caps: the display face), at whole pixels, with an optional
 * pixel outline (one font pixel all round, 8 directions) and a hard pixel drop shadow. `y` is the baseline. Returns
 * the width in canvas pixels.
 */
export function canvasText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, o: { n?: number; size?: number; align?: CanvasTextAlign; shadow?: string; outline?: string; caps?: boolean; weight?: number } = {}): number {
  const s = textSafe(text), size = snapFont(o.size ?? stepPx(o.n ?? 1)), p = Math.max(1, Math.round(size / GRID));
  g.save();
  g.font = fontAt(size, { caps: o.caps });
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const w = g.measureText(s).width;
  const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' || o.align === 'end' ? x - w : x), y0 = Math.round(y);
  if (o.shadow) { g.fillStyle = o.shadow; g.fillText(s, x0 + p, y0 + p * (o.outline ? 2 : 1)); }
  if (o.outline) {
    g.fillStyle = o.outline;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) g.fillText(s, x0 + dx * p, y0 + dy * p);
  }
  g.fillStyle = color;
  g.fillText(s, x0, y0);
  g.restore();
  return Math.round(w);
}

/**
 * Pixel text centred on (ux, uy) in the context's current units (the middle of the capitals on `uy`), its capitals
 * about `capUnits` units tall: set in device pixels at the nearest grid size, so small lettering in scaled art (dials, emblems) stays crisp.
 * Uses the current fillStyle. Returns the width in device pixels.
 */
export function fillTextMid(g: CanvasRenderingContext2D, text: string, ux: number, uy: number, capUnits: number): number {
  const m = g.getTransform(), k = Math.hypot(m.a, m.b) || 1;
  const size = snapFont((capUnits * k * GRID) / METRICS.cap), s = textSafe(text);
  const p = m.transformPoint(new DOMPoint(ux, uy));
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = fontAt(size); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const w = g.measureText(s).width;
  g.fillText(s, Math.round(p.x - w / 2), Math.round(p.y + (3.5 * size) / GRID));
  g.restore();
  return w;
}

let mctx: CanvasRenderingContext2D | null = null;
/** width of `text` at exactly `px` (a CSS token size, say; caps: the display face) */
export function textWidthPx(text: string, px: number, o: FontOpts = {}): number {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * px * 0.4;
  mctx.font = `400 ${px}px ${o.caps ? TITLE_STACK : STACK}`;
  return Math.round(mctx.measureText(textSafe(text)).width);
}
/** width of `text` at `n` steps (needs a context only for measuring) */
export function textWidth(text: string, n = 1, _o: FontOpts = {}): number {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * 8 * n;
  mctx.font = uiFont(n, _o);
  return Math.round(mctx.measureText(textSafe(text)).width);
}

export { bodyUrl, titleUrl };
