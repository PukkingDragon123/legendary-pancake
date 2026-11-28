// [icons8, icons9] The icon family: every everyday icon in the interface (actions, arrows, status, sleep, sounds,
// wardrobe and build categories, quests, stats, the side tools, the door) and the currency (the acorn, the moon gem, the
// acorn packs) is a detailed 3D model rendered realistically with its real textures (src/dev/iconbake.ts,
// src/dev/paintfinish.ts) at 256 px, packed in the interface atlas (public/img/ui3d.webp; index in src/ui/px/icons3d.ts).
// Registered under the old sprite names, so every <Px name>, PxAnim and spriteURL in the app picks them up; the
// currency has idle frames (`owlcoin_f0..7`...). An icon is drawn smoothly at exactly the device size asked for (the
// drawing halved step by step, then resampled), so it is sharp at every screen density. The atlas loads once at
// start-up (`installIconSet` resolves when it is in).
import { SPRITES } from '../px/sprites.js';
import { ICONS3D } from '../px/icons3d.ts';

type Size = 'hd';
interface Sprite3D { w: number; h: number; rows: string[]; pal: Record<string, string>; hi: { w: number; h: number; rows: string[]; pal: Record<string, string>; px: { d: Uint8ClampedArray } }; res: number; i3d: { i: number } }

/** the size a sprite reports to callers that size it by its sprite (spriteURL, AnimPx): its drawing is shrunk to that */
const NOMINAL = 40;
/** extra names drawn by a baked model */
const ALIAS: Record<string, string> = { moonstone: 'moongem', shop_tag: 'bp_buy' };

// ------------------------------------------------------------------ the atlas
let atlasP: Promise<HTMLImageElement | null> | null = null;
let atlas: HTMLImageElement | null = null;
/** the interface atlas (the icons' drawings), loaded once; null if it can't load */
export function uiAtlas(): Promise<HTMLImageElement | null> {
  atlasP ??= loadImage(ICONS3D.atlas).then((im) => (atlas = im));
  return atlasP;
}
/** the atlas, once it is in */
export const atlasNow = () => atlas;
let shelfP: Promise<HTMLImageElement | null> | null = null;
let shelfIm: HTMLImageElement | null = null;
/** the shelf's sprites (the main buttons), loaded once; null if they can't load */
export function shelfAtlas(): Promise<HTMLImageElement | null> {
  shelfP ??= loadImage(ICONS3D.shelf.atlas).then((im) => (shelfIm = im));
  return shelfP;
}
export const shelfAtlasNow = () => shelfIm;
function loadImage(path: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    if (typeof Image === 'undefined') { res(null); return; }
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = `${import.meta.env.BASE_URL}${path}`;
  });
}

const grid = (_s: Size) => ICONS3D.hd;
/** where a cell's drawing sits in the atlas */
function cellRect(i: number, s: Size): [number, number, number] {
  const [art, cols, y0] = grid(s);
  return [(i % cols) * art, y0 + Math.floor(i / cols) * art, art];
}
const canvases = new Map<string, HTMLCanvasElement>();
/** a cell's drawing at `dev` device px: halved step by step while that stays above the size, then resampled smoothly */
function drawn(i: number, s: Size, dev: number): HTMLCanvasElement | null {
  if (!atlas) return null;
  const key = `${i}:${s}:${dev}`;
  let c = canvases.get(key);
  if (c) return c;
  const [x, y, art] = cellRect(i, s);
  let src: CanvasImageSource = atlas, sx = x, sy = y, sw = art;
  while (sw / 2 >= dev * 1.05) {
    const h = document.createElement('canvas'), n = Math.round(sw / 2);
    h.width = h.height = n;
    const hg = h.getContext('2d')!;
    hg.imageSmoothingEnabled = true; hg.imageSmoothingQuality = 'high';
    hg.drawImage(src, sx, sy, sw, sw, 0, 0, n, n);
    src = h; sx = 0; sy = 0; sw = n;
  }
  c = document.createElement('canvas');
  c.width = c.height = Math.max(1, dev);
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src, sx, sy, sw, sw, 0, 0, c.width, c.width);
  canvases.set(key, c);
  return c;
}

/** The device size an icon asked for at about `dev` device px is drawn at (exactly that, rounded), from the 256 px drawing. */
export function pickArt(dev: number, _fit = false): { size: Size; k: number; px: number } {
  const px = Math.max(8, Math.round(dev));
  return { size: 'hd', k: px / ICONS3D.hd[0], px };
}
/** the device size an icon asked for at `dev` device px is drawn at (so a caller can size its box to it) */
export const iconDev = (dev: number) => pickArt(dev).px;

// ------------------------------------------------------------------ the sprite names
const blank = new Uint8ClampedArray(4 * 4 * 4);
function sprite(i: number): Sprite3D {
  const c = drawn(i, 'hd', 128);
  const n = c ? 128 : 4;
  const d = c ? c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, n, n).data : blank;
  return { w: NOMINAL, h: NOMINAL, rows: [], pal: {}, hi: { w: n, h: n, rows: [], pal: {}, px: { d } }, res: n / NOMINAL, i3d: { i } };
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
  for (const [name, i] of Object.entries(icons)) define(name, () => sprite(i));
  for (const [a, b] of Object.entries(ALIAS)) if (icons[b] !== undefined) define(a, () => sprite(icons[b]));
  for (const [name, frames] of Object.entries(anim)) {
    frames.forEach((i, k) => define(`${name}_f${k}`, () => sprite(i)));
    if (icons[name] === undefined) define(name, () => sprite(frames[0])); // acorn_big, gem_big
  }
  done = uiAtlas().then(() => undefined);
  return done;
}
/** the names in the family (for the dev sheet) */
export const ICON_NAMES = () => Object.keys(ICONS3D.icons);

const urls = new Map<string, string>();
function url(i: number, dev: number, box: number): string | null {
  const key = `${i}|${dev}|${box}`;
  let u = urls.get(key);
  if (u) return u;
  const c = drawn(i, pickArt(dev).size, dev);
  if (!c) return null;
  if (box > c.width) {
    // centred in a bigger box (a caller that fixed its size)
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
/** An icon in a box of exactly `dev` device pixels. null when `name` isn't one of the family or the atlas isn't in yet. */
export function iconSrc(name: string, dev: number, _dpr = 1): string | null {
  const i = cellOf(name);
  if (i === undefined) return null;
  const box = Math.max(4, Math.round(dev));
  return url(i, box, box);
}
/**
 * An icon drawn at `css` CSS px on a screen of `dpr` device px per CSS px: its picture and the CSS size to show it at.
 * null when `name` isn't one of the family or the atlas isn't in yet.
 */
export function iconFit(name: string, css: number, dpr: number): { src: string; css: number } | null {
  const i = cellOf(name);
  if (i === undefined) return null;
  const p = pickArt(css * dpr), src = url(i, p.px, 0);
  return src ? { src, css: p.px / dpr } : null;
}
/** Is this sprite one of the baked icons? */
export const isIcon3D = (name: string) => cellOf(name) !== undefined;
