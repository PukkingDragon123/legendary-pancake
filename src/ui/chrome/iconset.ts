// [icons8] The icon family in pixel art: every everyday icon in the interface (actions, arrows, status, sleep,
// sounds, wardrobe and build categories, quests, stats, the side tools) and the currency (the acorn, the moon gem, the
// acorn packs) is a detailed 3D model rendered and finished as hand-made pixel art (src/dev/iconbake.ts,
// src/dev/pixelize.ts): hue-shifted colour ramps per material, selective coloured outlines, single-pixel glints. Each
// comes as a 32 art px drawing and a 20 art px one for small sizes (redrawn, not shrunk), packed in the interface atlas
// (public/img/ui3d.webp, lossless; index in src/ui/px/icons3d.ts).
// Registered under the old sprite names, so every <Px name>, PxAnim and spriteURL in the app picks them up; the
// currency has glinting idle frames (`owlcoin_f0..7`...). An icon is always drawn crisp: one of the two drawings at a
// whole number of device pixels per art pixel (nearest neighbour), sized as close as can be to what was asked for. The
// atlas loads once at start-up (`installIconSet` resolves when it is in).
import { SPRITES } from '../px/sprites.js';
import { ICONS3D } from '../px/icons3d.ts';

type Size = 'big' | 'small';
interface Sprite3D { w: number; h: number; rows: string[]; pal: Record<string, string>; hi: { w: number; h: number; rows: string[]; pal: Record<string, string>; px: { d: Uint8ClampedArray } }; res: number; i3d: { i: number } }

/** names drawn at 32 art px when a caller sizes them by their sprite (spriteURL, AnimPx); the rest use the 20 px drawing */
const BIG = new Set(['acorn_big', 'gem_big', 'coin_pouch', 'coin_sack', 'coin_chest', 'coin_vault']);
/** extra names drawn by a baked model */
const ALIAS: Record<string, string> = { moonstone: 'moongem' };

// ------------------------------------------------------------------ the atlas
let atlasP: Promise<HTMLImageElement | null> | null = null;
let atlas: HTMLImageElement | null = null;
/** the interface atlas (the icons' drawings and the shelf's sprites), loaded once; null if it can't load */
export function uiAtlas(): Promise<HTMLImageElement | null> {
  atlasP ??= new Promise((res) => {
    if (typeof Image === 'undefined') { res(null); return; }
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => { atlas = im; res(im); };
    im.onerror = () => res(null);
    im.src = `${import.meta.env.BASE_URL}${ICONS3D.atlas}`;
  });
  return atlasP;
}
/** the atlas, once it is in (for the shelf) */
export const atlasNow = () => atlas;

const grid = (s: Size) => (s === 'big' ? ICONS3D.big : ICONS3D.small);
/** where a cell's drawing sits in the atlas */
function cellRect(i: number, s: Size): [number, number, number] {
  const [art, cols, y0] = grid(s);
  return [(i % cols) * art, y0 + Math.floor(i / cols) * art, art];
}
const canvases = new Map<string, HTMLCanvasElement>();
/** a cell's drawing at `k` device px per art px (nearest neighbour; a fractional k below 1 shrinks it smoothly) */
function drawn(i: number, s: Size, k: number): HTMLCanvasElement | null {
  if (!atlas) return null;
  const key = `${i}:${s}:${k}`;
  let c = canvases.get(key);
  if (c) return c;
  const [x, y, art] = cellRect(i, s);
  c = document.createElement('canvas');
  c.width = c.height = Math.max(1, Math.round(art * k));
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = k < 1;
  g.imageSmoothingQuality = 'high';
  g.drawImage(atlas, x, y, art, art, 0, 0, c.width, c.width);
  canvases.set(key, c);
  return c;
}

/**
 * The crisp choice for about `dev` device px: which drawing at which whole scale. `fit` keeps it within `dev` (a fixed
 * box); otherwise the nearest size, leaning towards the more detailed 32 px drawing. Below 20 px the small
 * drawing is shrunk smoothly (nothing smaller is crisp).
 */
export function pickArt(dev: number, fit = false): { size: Size; k: number; px: number } {
  if (dev < 19) return { size: 'small', k: Math.max(0.4, dev / 20), px: Math.max(8, Math.round(dev)) };
  let best: { size: Size; k: number; px: number } | null = null, bs = 1e9;
  for (const [size, art] of [['big', 32], ['small', 20]] as [Size, number][]) {
    for (const k of fit ? [Math.floor(dev / art)] : [Math.floor(dev / art), Math.ceil(dev / art)]) {
      if (k < 1) continue;
      // the small drawing only where it fits much better: the bigger it is blown up, the less it is wanted
      const px = art * k, score = Math.abs(Math.log(px / dev)) + (size === 'small' ? 0.05 + 0.05 * (k - 1) : 0);
      if (score < bs) { bs = score; best = { size, k, px }; }
    }
  }
  return best ?? { size: 'small', k: 1, px: 20 };
}
/** the device size an icon asked for at `dev` device px is actually drawn at (so a caller can size its box to it) */
export const iconDev = (dev: number) => pickArt(dev).px;

// ------------------------------------------------------------------ the sprite names
const blank = new Uint8ClampedArray(20 * 20 * 4);
function sprite(i: number, size: Size): Sprite3D {
  const art = grid(size)[0], c = drawn(i, size, 1);
  const d = c ? c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, art, art).data : blank;
  const n = c ? art : 20;
  return { w: n, h: n, rows: [], pal: {}, hi: { w: n, h: n, rows: [], pal: {}, px: { d } }, res: 1, i3d: { i } };
}
const cache = new Map<string, Sprite3D>();
let done: Promise<void> | null = null;
/** Register the whole family over the sprite names; resolves once the atlas is in (each sprite is read on first use). */
export function installIconSet(): Promise<void> {
  if (done) return done;
  const define = (name: string, make: () => Sprite3D) => Object.defineProperty(SPRITES, name, {
    enumerable: true, configurable: true,
    // before the atlas is in, a sprite is blank and not kept, so it is read again once the atlas has arrived
    get() { let s = cache.get(name); if (!s) { s = make(); if (atlas) cache.set(name, s); } return s; },
  });
  const icons = ICONS3D.icons, anim = ICONS3D.anim;
  const sz = (name: string): Size => (BIG.has(name) ? 'big' : 'small');
  for (const [name, i] of Object.entries(icons)) define(name, () => sprite(i, sz(name)));
  for (const [a, b] of Object.entries(ALIAS)) if (icons[b] !== undefined) define(a, () => sprite(icons[b], 'small'));
  for (const [name, frames] of Object.entries(anim)) {
    frames.forEach((i, k) => define(`${name}_f${k}`, () => sprite(i, sz(name))));
    if (icons[name] === undefined) define(name, () => sprite(frames[0], sz(name))); // acorn_big, gem_big
  }
  done = uiAtlas().then(() => undefined);
  return done;
}
/** the names in the family (for the dev sheet) */
export const ICON_NAMES = () => Object.keys(ICONS3D.icons);

const urls = new Map<string, string>();
function url(i: number, size: Size, k: number, box: number): string | null {
  const key = `${i}|${size}|${k}|${box}`;
  let u = urls.get(key);
  if (u) return u;
  const c = drawn(i, size, k);
  if (!c) return null;
  if (box > c.width) {
    // centred in a bigger box (a caller that fixed its size): the drawing stays whole-pixel crisp
    const b = document.createElement('canvas');
    b.width = b.height = box;
    const o = Math.floor((box - c.width) / 2);
    b.getContext('2d')!.drawImage(c, o, o);
    u = b.toDataURL('image/png');
  } else u = c.toDataURL('image/png');
  urls.set(key, u);
  return u;
}
const cellOf = (name: string) => (SPRITES as Record<string, Partial<Sprite3D>>)[name]?.i3d?.i;
/**
 * An icon in a box of exactly `dev` device pixels: the drawing at the largest whole scale that fits, centred. null when
 * `name` isn't one of the family or the atlas isn't in yet.
 */
export function iconSrc(name: string, dev: number, _dpr = 1): string | null {
  const i = cellOf(name);
  if (i === undefined) return null;
  const box = Math.max(4, Math.round(dev)), p = pickArt(box, true);
  return url(i, p.size, p.k, box);
}
/**
 * An icon drawn crisp at about `css` CSS px on a screen of `dpr` device px per CSS px: its picture and the CSS size to
 * show it at (within a few percent of the ask). null when `name` isn't one of the family or the atlas isn't in yet.
 */
export function iconFit(name: string, css: number, dpr: number): { src: string; css: number } | null {
  const i = cellOf(name);
  if (i === undefined) return null;
  const p = pickArt(css * dpr), src = url(i, p.size, p.k, 0);
  return src ? { src, css: p.px / dpr } : null;
}
/** Is this sprite one of the baked icons? */
export const isIcon3D = (name: string) => cellOf(name) !== undefined;
