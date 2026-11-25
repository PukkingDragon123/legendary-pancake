// The game's one typeface: Alagard by Hewett Tsoi (Pix3M), a pixel font drawn on a 16 px em
// (1 font pixel = 1/16 em; caps 11 px, x-height 8 px, descenders 3 px). It is crisp only at whole
// multiples of 16 px (16, 32, 48) drawn at whole-pixel positions, so every CSS size and every
// canvas size in the game is one of those.
//
// Alagard covers printable ASCII plus a few currency signs, nothing else. `alagardSafe` turns
// typographic punctuation into its ASCII twin and strips accents; every Preact text node goes
// through it (installed below), and canvas text calls it directly. Anything left over (a name the
// player typed in another script) falls back to the old pixel face in the CSS stack, never tofu.
import { options, type VNode } from 'preact';
import alagardUrl from '../assets/fonts/alagard.ttf?url';

export const FAMILY = 'Alagard';
/** the full stack: Alagard, then a pixel face that has the glyphs Alagard lacks */
export const STACK = '"Alagard", "TBME Body", ui-monospace, monospace';
/** the font pixel: one sixteenth of an em */
export const EM = 16;
/** CSS px per font pixel of UI text (the --t1 token in style.css is 16 px: one CSS px per font pixel). */
export const uiFontPx = (): number => 1;
/** a canvas/CSS font string at `n` font pixels per screen/texture pixel (16 px, 32 px, 48 px ...) */
export const alagard = (n = 1) => `${EM * Math.max(1, Math.round(n))}px ${STACK}`;

const MAP: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201a': "'", '\u201b': "'", '\u02bc': "'", '\u2032': "'", '\u00b4': "'",
  '\u201c': '"', '\u201d': '"', '\u201e': '"', '\u2033': '"', '\u00ab': '"', '\u00bb': '"',
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2013': '-', '\u2014': '-', '\u2015': '-', '\u2212': '-',
  '\u00b7': '-', '\u2022': '-', '\u2219': '-', '\u22c5': '-', '\u2027': '-',
  '\u2026': '...', '\u00d7': 'x', '\u00f7': '/', '\u2605': '*', '\u2606': '*', '\u2736': '*', '\u2726': '*',
  '\u203a': '>', '\u2039': '<', '\u25b8': '>', '\u25b6': '>', '\u25ba': '>', '\u25c2': '<', '\u25c0': '<', '\u25c4': '<',
  '\u2192': '->', '\u2190': '<-', '\u2191': '^', '\u2193': 'v', '\u2713': 'v', '\u2714': 'v', '\u2715': 'x', '\u2716': 'x',
  '\u00a0': ' ', '\u202f': ' ', '\u2009': ' ', '\u200a': ' ', '\u2007': ' ', '\u2002': ' ', '\u2003': ' ', '\u2008': ' ',
  '\u200b': '', '\u200c': '', '\u200d': '', '\u2060': '', '\ufe0f': '', '\u00ad': '',
  '\u00bd': ' 1/2', '\u00bc': ' 1/4', '\u00be': ' 3/4', '\u00b0': '', '\u2116': 'No.', '\u00a9': '(c)', '\u00ae': '(R)', '\u2122': 'TM',
  '\u00df': 'ss', '\u00e6': 'ae', '\u00c6': 'AE', '\u0153': 'oe', '\u0152': 'OE', '\u00f8': 'o', '\u00d8': 'O', '\u0142': 'l',
  '\u0141': 'L', '\u0111': 'd', '\u0110': 'D', '\u00f0': 'd', '\u00fe': 'th', '\u0131': 'i', '\u00a1': '!', '\u00bf': '?',
};
// eslint-disable-next-line no-control-regex
const ODD = /[^\x09\x0a\x0d\x20-\x7e\u00a2\u00a3\u00a5\u20ac]/;
const ODD_G = /[^\x09\x0a\x0d\x20-\x7e\u00a2\u00a3\u00a5\u20ac]/g;

/** Text Alagard can draw: typographic punctuation to ASCII, accents stripped (an e with an acute becomes e), the rest kept for the fallback face. */
export function alagardSafe(text: string): string {
  if (!ODD.test(text)) return text;
  return text.replace(ODD_G, (ch) => {
    const m = MAP[ch];
    if (m !== undefined) return m;
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return base && !ODD.test(base) ? base : ch;
  });
}

// ---- every Preact text node (and input placeholder) goes through alagardSafe
let installed = false;
export function installAlagardText() {
  if (installed) return;
  installed = true;
  const prev = options.vnode;
  options.vnode = (v: VNode) => {
    if (v.type == null) {
      if (typeof v.props === 'string') (v as { props: unknown }).props = alagardSafe(v.props as unknown as string);
    } else if (typeof v.type === 'string') {
      const p = v.props as { placeholder?: unknown; class?: unknown; className?: unknown; children?: unknown; 'data-t'?: string };
      if (typeof p.placeholder === 'string') p.placeholder = alagardSafe(p.placeholder);
      // 3D text (text3d.tsx): its stepped band fill is drawn from a copy of the text in data-t
      const cls = typeof p.class === 'string' ? p.class : typeof p.className === 'string' ? p.className : '';
      if (v.type === 'h1' || v.type === 'h2' || /(^|\s)(t3d|t3d-seg|hh-name|lvup-title|title-ribbon|cb-title)(\s|$)/.test(cls)) {
        const c = p.children, parts = Array.isArray(c) ? c : [c];
        if (parts.length && parts.every((x) => typeof x === 'string' || typeof x === 'number')) p['data-t'] = alagardSafe(parts.join(''));
      }
    }
    prev?.(v);
  };
}
installAlagardText();

// ---- whole-pixel text: centring (text-align, flex, grid) can leave a line of text half a pixel off the grid,
// and a pixel font drawn at x.5 smears. After the UI changes, nudge such lines back onto whole pixels with a
// sub-pixel text-indent on their block (it moves only the text, never the box or its pixel-art background).
const SNAP = 'data-hh-snap';
/** idle animations that only step whole art pixels up and down: text in them can still be snapped */
const BOBS = new Set(['tagSway', 'signSwing', 'hhLookSway', 'wdSway', 'lgSwing', 'none']);
/** elements whose text wears the full 3D style with a band fill (keep in step with FULL in text3d.tsx) */
const T3D_HOST = 'h1:not(.qp-q), h2:not(.qp-q), .t3d:not(.t3d-lite), .hh-name, .lvup-title, .title-ribbon, .cb-title, .cs-sign span, .seal b, .tk-times b, .bk-last-t b';
let snapOn = false, snapQueued = 0, snapLast = 0;
function snapPass() {
  snapQueued = 0; snapLast = performance.now();
  const moving = new Map<Element, boolean>();
  const isMoving = (el: Element | null): boolean => {
    if (!el || el === document.body) return false;
    const c = moving.get(el);
    if (c !== undefined) return c;
    const cs = getComputedStyle(el);
    // turning or scaling (not just sliding) or running an animation other than the whole-art-pixel bobs
    const m = (cs.transform !== 'none' && !/^matrix\(1, 0, 0, 1, [-\d.e]+, [-\d.e]+\)$/.test(cs.transform)) || cs.rotate !== 'none' || cs.scale !== 'none' || (cs.animationName !== 'none' && !cs.animationName.split(', ').every((a) => BOBS.has(a))) || isMoving(el.parentElement);
    moving.set(el, m);
    return m;
  };
  const done = new Set<Element>();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  const vw = innerWidth, vh = innerHeight, dpr = devicePixelRatio || 1;
  let n: Node | null, budget = 600;
  while ((n = w.nextNode()) && budget-- > 0) {
    const t = n as Text;
    if (!t.data.trim()) continue;
    let el = t.parentElement;
    if (!el || el.closest('script,style,svg,textarea,input,[data-nosnap]')) continue;
    // 3D titles (text3d.tsx): a text that sits alone in its element inside a title gets its band-fill copy
    if (el.childNodes.length === 1 && el.closest(T3D_HOST) && el.getAttribute('data-t') !== t.data) el.setAttribute('data-t', t.data);
    // the block whose first line this text sits on
    while (el && getComputedStyle(el).display === 'inline') el = el.parentElement;
    if (!el || done.has(el) || el === document.body) continue;
    done.add(el);
    const cs = getComputedStyle(el);
    if (!/^(block|inline-block|list-item|table-cell|flow-root)$/.test(cs.display) || isMoving(el)) continue;
    range.selectNodeContents(t);
    const r = range.getClientRects()[0];
    if (!r || r.width === 0 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    // whole device pixels (an art pixel is a whole number of them)
    const X = r.left * dpr, fx = X - Math.floor(X);
    if (fx < 0.03 || fx > 0.97) continue;
    const want = (fx < 0.5 ? -fx : 1 - fx) / dpr;
    const old = parseFloat(el.getAttribute(SNAP) ?? '0') || 0;
    // try the indent that moves the line by `want` (centred lines move by half the indent)
    for (const k of cs.textAlign === 'center' ? [2, 1] : [1, 2]) {
      let ind = old + want * k;
      if (ind > 1.5) ind -= 2; else if (ind < -1.5) ind += 2;
      el.style.textIndent = `${ind}px`;
      el.setAttribute(SNAP, String(ind));
      const q = range.getClientRects()[0];
      if (q && Math.abs(q.left * dpr - Math.round(q.left * dpr)) < 0.03) break;
      el.style.textIndent = old ? `${old}px` : '';
      el.setAttribute(SNAP, String(old));
    }
  }
}
function snapSoon() {
  if (snapQueued) return;
  const wait = Math.max(0, 200 - (performance.now() - snapLast));
  snapQueued = window.setTimeout(() => requestAnimationFrame(snapPass), wait);
}
/** Keep every line of UI text on whole pixels (call once at boot). */
export function installTextSnap() {
  if (snapOn || typeof MutationObserver === 'undefined') return;
  snapOn = true;
  new MutationObserver(snapSoon).observe(document.body, { childList: true, subtree: true, characterData: true });
  addEventListener('resize', snapSoon);
  document.addEventListener('animationend', snapSoon, true);
  document.addEventListener('transitionend', snapSoon, true);
  snapSoon();
}

let ready: Promise<void> | null = null;
/** Resolves once Alagard can paint (canvas text waits for it). Adds the face itself on pages without the app CSS. */
export function alagardReady(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    try {
      if (![...document.fonts].some((f) => f.family.replace(/["']/g, '') === FAMILY)) {
        const face = new FontFace(FAMILY, `url(${alagardUrl})`, { ascentOverride: '75%', descentOverride: '25%', lineGapOverride: '0%' } as FontFaceDescriptors);
        document.fonts.add(await face.load());
      }
      await document.fonts.load(`16px "${FAMILY}"`, 'Aa1');
    } catch { /* no FontFace API: canvas text falls back */ }
  })();
  return ready;
}

/**
 * Draw Alagard text on a canvas at full resolution (16 x `n` px, or `size` px), starting on a whole pixel, with an
 * optional rounded outline and a soft offset shadow. `y` is the baseline. Returns the width in canvas pixels.
 */
export function alagardText(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, o: { n?: number; size?: number; align?: CanvasTextAlign; shadow?: string; outline?: string } = {}): number {
  const s = alagardSafe(text), size = o.size ?? EM * Math.max(1, Math.round(o.n ?? 1));
  g.save();
  g.font = `${size}px ${STACK}`;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  const w = g.measureText(s).width;
  const x0 = Math.round(o.align === 'center' ? x - w / 2 : o.align === 'right' || o.align === 'end' ? x - w : x), y0 = Math.round(y);
  if (o.outline) { g.lineJoin = 'round'; g.lineWidth = Math.max(2, size / 8); g.strokeStyle = o.outline; g.strokeText(s, x0, y0); }
  if (o.shadow) { g.fillStyle = o.shadow; g.fillText(s, x0 + size / 20, y0 + size / 14); }
  g.fillStyle = color;
  g.fillText(s, x0, y0);
  g.restore();
  return Math.round(w);
}

/** width of `text` in Alagard at `n` font pixels per pixel (needs a context only for measuring) */
let mctx: CanvasRenderingContext2D | null = null;
export function alagardWidth(text: string, n = 1): number {
  if (!mctx) mctx = document.createElement('canvas').getContext('2d');
  if (!mctx) return text.length * 9 * n;
  mctx.font = alagard(n);
  return Math.round(mctx.measureText(alagardSafe(text)).width);
}

export { alagardUrl };
