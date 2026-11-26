// The game's typefaces: Alegreya (Juan Pablo del Peral, Huerta Tipográfica; SIL Open Font License), a warm calligraphic
// book face for every word, and Alegreya SC, its true small capitals, for titles, signs and names. Both are bundled
// (src/assets/fonts/*.woff2, Latin subset; the digits remapped to the font's own lining figures so counters and prices
// stand level in CSS and on canvas alike), so nothing is fetched from another host.
//
// Sizes: CSS uses the --t1..--t8 tokens in style.css. Canvas code asks for `uiFont(n)` (n "steps" of the old 16 px
// grid, scaled so a step of Alegreya reads as large as the old pixel face did) or `fontPx(px)` for an exact size.
// Alegreya has nearly every glyph the game writes; `textSafe` swaps the few it lacks (odd dashes and dots, a narrow
// no-break space) for their nearest twins, and anything else falls back to the system serif.
import { options, type VNode } from 'preact';
import bookUrl from '../assets/fonts/alegreya.woff2?url';
import italicUrl from '../assets/fonts/alegreya-italic.woff2?url';
import capsUrl from '../assets/fonts/alegreya-sc.woff2?url';

export const FAMILY = 'Alegreya';
export const CAPS_FAMILY = 'Alegreya SC';
/** the book face, then serif fallbacks with similar proportions */
export const STACK = '"Alegreya", "Iowan Old Style", Palatino, "Palatino Linotype", Georgia, serif';
/** titles, signs, names: true small caps */
export const TITLE_STACK = '"Alegreya SC", "Alegreya", "Iowan Old Style", Palatino, Georgia, serif';
/** one size step (the old 16 px grid); canvas sizes are whole steps times SCALE */
export const EM = 16;
/** Alegreya's small x-height (0.45 em) reads like the old face at about 1.12x the size */
export const SCALE = 1.12;
/** CSS px per size step of UI text (the --t1 token). */
export const uiFontPx = (): number => 1;
export interface FontOpts { weight?: number; caps?: boolean; italic?: boolean }
/** a canvas/CSS font string at exactly `px` pixels (weight 600 by default: it holds up on wood, paper and glass) */
export const fontPx = (px: number, o: FontOpts = {}) => `${o.italic ? 'italic ' : ''}${o.caps ? 800 : o.weight ?? 600} ${Math.max(6, Math.round(px * 10) / 10)}px ${o.caps ? TITLE_STACK : STACK}`;
/** the size in px of `n` steps */
export const stepPx = (n = 1) => Math.round(EM * SCALE * Math.max(0.5, n));
/** a canvas/CSS font string `n` steps tall (1 step reads like the old 16 px text) */
export const uiFont = (n = 1, o: FontOpts = {}) => fontPx(stepPx(n), o);

const MAP: Record<string, string> = {
  '‐': '-', '‑': '-', '‒': '–', '―': '—', '∙': '·', '⋅': '·', '‧': '·',
  ' ': ' ', ' ': ' ', ' ': ' ', '№': 'No.', 'ł': 'l', 'Ł': 'L',
  '​': '', '‌': '', '‍': '', '⁠': '', '️': '',
};
const ODD = /[‐-‒―∙⋅‧   №Łł​-‍⁠️]/;
const ODD_G = new RegExp(ODD.source, 'g');

/** Text the face can draw: the few glyphs Alegreya lacks become their nearest twins; everything else is kept. */
export function textSafe(text: string): string {
  return ODD.test(text) ? text.replace(ODD_G, (ch) => MAP[ch] ?? ch) : text;
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
      // 3D text (text3d.tsx): its gentle lit fill is drawn from a copy of the text in data-t
      const cls = typeof p.class === 'string' ? p.class : typeof p.className === 'string' ? p.className : '';
      if (v.type === 'h1' || v.type === 'h2' || /(^|\s)(t3d|t3d-seg|hh-name|lvup-title|title-ribbon|cb-title)(\s|$)/.test(cls)) {
        const c = p.children, parts = Array.isArray(c) ? c : [c];
        if (parts.length && parts.every((x) => typeof x === 'string' || typeof x === 'number')) p['data-t'] = textSafe(parts.join(''));
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
      if (el && el.childNodes.length === 1 && t.data.trim() && el.getAttribute('data-t') !== t.data) el.setAttribute('data-t', t.data);
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

let ready: Promise<void> | null = null;
/** Resolves once the faces can paint (canvas text waits for it). Adds them itself on pages without the app CSS. */
export function fontReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      const have = (fam: string, style = 'normal') => [...document.fonts].some((f) => f.family.replace(/["']/g, '') === fam && f.style === style);
      const add = async (fam: string, url: string, d: FontFaceDescriptors) => { if (!have(fam, d.style ?? 'normal')) document.fonts.add(await new FontFace(fam, `url(${url}) format('woff2')`, d).load()); };
      await Promise.all([
        add(FAMILY, bookUrl, { weight: '400 900', style: 'normal' }),
        add(FAMILY, italicUrl, { weight: '400 900', style: 'italic' }),
        add(CAPS_FAMILY, capsUrl, { weight: '100 900', style: 'normal' }),
      ]);
      await Promise.all([document.fonts.load(`600 16px "${FAMILY}"`, 'Aa1'), document.fonts.load(`800 16px "${CAPS_FAMILY}"`, 'Aa1'), document.fonts.load(`italic 600 16px "${FAMILY}"`, 'Aa1')]);
    } catch { /* no FontFace API: canvas text falls back */ }
  })();
  return ready;
}

/**
 * Draw text on a canvas at full resolution (`n` steps, or `size` px), with an optional outline and a soft offset
 * shadow. `y` is the baseline. Returns the width in canvas pixels.
 */
export function canvasText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, o: { n?: number; size?: number; align?: CanvasTextAlign; shadow?: string; outline?: string; caps?: boolean; weight?: number } = {}): number {
  const s = textSafe(text), size = o.size ?? stepPx(o.n ?? 1);
  g.save();
  g.font = fontPx(size, { caps: o.caps, weight: o.weight ?? 700 });
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const w = g.measureText(s).width;
  const x0 = o.align === 'center' ? x - w / 2 : o.align === 'right' || o.align === 'end' ? x - w : x;
  if (o.outline) { g.lineJoin = 'round'; g.lineWidth = Math.max(2, size / 7); g.strokeStyle = o.outline; g.strokeText(s, x0, y); }
  if (o.shadow) { g.fillStyle = o.shadow; g.fillText(s, x0 + size / 24, y + size / 16); }
  g.fillStyle = color;
  g.fillText(s, x0, y);
  g.restore();
  return Math.round(w);
}

/** width of `text` at `n` steps (needs a context only for measuring) */
let mctx: CanvasRenderingContext2D | null = null;
export function textWidth(text: string, n = 1, o: FontOpts = { weight: 700 }): number {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * 9 * n;
  mctx.font = uiFont(n, o);
  return Math.round(mctx.measureText(textSafe(text)).width);
}

export { bookUrl, capsUrl, italicUrl };
