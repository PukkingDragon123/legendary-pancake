// [ui5] The icon family as little 3D models: every everyday icon in the interface (actions, arrows, status, sleep,
// sounds, wardrobe and build categories, quests, stats, the side tools) and the currency (the bag of acorns, the moon
// gem, the acorn packs) is a small 3D model (src/dev/iconbake.ts). Registered under the old sprite names, so every
// <Px name>, PxAnim and spriteURL in the app picks them up; the currency has glinting idle frames (`owlcoin_f0..7`...).
// [tex7] High resolution and realistic: each model is textured with realistic textures and rendered with soft studio
// light into a 128 px cell of the interface atlas (public/img/ui3d.webp, which also carries the photo textures of the
// live shelf). An icon is drawn smoothly scaled down to exactly the device pixels it needs. The atlas loads once at
// start-up (`installIconSet` resolves when it is in).
import { SPRITES } from '../px/sprites.js';
import { ICONS3D } from '../px/icons3d.ts';
import { setSwatch, SWATCHES } from './paint3d.ts';

interface Cell { i: number }
interface Sprite3D { w: number; h: number; rows: string[]; pal: Record<string, string>; hi: { w: number; h: number; rows: string[]; pal: Record<string, string>; px: { d: Uint8ClampedArray } }; res: number; i3d: Cell }

/** the logical sprite size each name had before (CSS px at scale 1), so direct spriteURL callers keep their sizes */
const LOGICAL: Record<string, number> = { owlcoin: 24, moongem: 24, acorn_big: 40, gem_big: 40, coin_pouch: 32, coin_sack: 32, coin_chest: 32, coin_vault: 36 };
/** extra names drawn by a baked model */
const ALIAS: Record<string, string> = { moonstone: 'moongem' };

// ------------------------------------------------------------------ the atlas
let atlasP: Promise<HTMLImageElement | null> | null = null;
let atlas: HTMLImageElement | null = null;
/** the interface atlas (icons and photo textures), loaded once; null if it can't load */
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
/** register the atlas's photo textures (wood, leather, cloth) for the 3D props; false if the atlas didn't load */
export async function loadSwatches(): Promise<boolean> {
  const im = await uiAtlas();
  if (!im) return false;
  const sw = ICONS3D.swatches as Record<string, [number, number, number, number]>;
  for (const n of SWATCHES) if (sw[n]) setSwatch(n, im, sw[n]);
  return true;
}
const C = ICONS3D.cell;
const cellXY = (i: number): [number, number] => [(i % ICONS3D.cols) * C, Math.floor(i / ICONS3D.cols) * C];
const cells = new Map<string, HTMLCanvasElement>();
/** a cell drawn at `w` px: smooth and high quality, halving step by step so a big shrink stays crisp, never blurry */
function cellCanvas(i: number, w: number): HTMLCanvasElement | null {
  if (!atlas) return null;
  const key = i + ':' + w;
  let c = cells.get(key);
  if (c) return c;
  const [x, y] = cellXY(i);
  let src: CanvasImageSource = atlas, sx = x, sy = y, sw = C;
  while (sw / 2 >= w * 1.2) {
    const h = document.createElement('canvas');
    h.width = h.height = Math.round(sw / 2);
    const g = h.getContext('2d')!;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(src, sx, sy, sw, sw, 0, 0, h.width, h.height);
    src = h; sx = 0; sy = 0; sw = h.width;
  }
  c = document.createElement('canvas');
  c.width = c.height = w;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(src, sx, sy, sw, sw, 0, 0, w, w);
  cells.set(key, c);
  return c;
}

// ------------------------------------------------------------------ the sprite names
const blank = new Uint8ClampedArray(C * C * 4);
function sprite(i: number, logical: number): Sprite3D {
  const c = cellCanvas(i, C);
  const d = c ? c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, C, C).data : blank;
  return { w: logical, h: logical, rows: [], pal: {}, hi: { w: C, h: C, rows: [], pal: {}, px: { d } }, res: C / logical, i3d: { i } };
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
  const icons = ICONS3D.icons as Record<string, number>, anim = ICONS3D.anim as Record<string, number[]>;
  for (const [name, i] of Object.entries(icons)) define(name, () => sprite(i, LOGICAL[name] ?? 20));
  for (const [a, b] of Object.entries(ALIAS)) if (icons[b] !== undefined) define(a, () => sprite(icons[b], 20));
  for (const [name, frames] of Object.entries(anim)) {
    frames.forEach((i, k) => define(`${name}_f${k}`, () => sprite(i, LOGICAL[name] ?? 20)));
    if (icons[name] === undefined) define(name, () => sprite(frames[0], LOGICAL[name] ?? 20)); // acorn_big, gem_big
  }
  done = uiAtlas().then(() => undefined);
  return done;
}
/** the names in the family (for the dev sheet) */
export const ICON_NAMES = () => Object.keys(ICONS3D.icons);

const urls = new Map<string, string>();
/**
 * A baked icon drawn at exactly `dev` device pixels across, smoothly scaled down from its 128 px render. null when
 * `name` isn't one of the family or the atlas isn't in yet.
 */
export function iconSrc(name: string, dev: number, _dpr = 1): string | null {
  const s = (SPRITES as Record<string, Partial<Sprite3D>>)[name];
  if (!s?.i3d) return null;
  const w = Math.max(4, Math.round(dev));
  const key = s.i3d.i + '|' + w;
  let u = urls.get(key);
  if (!u) {
    const c = cellCanvas(s.i3d.i, w);
    if (!c) return null;
    u = c.toDataURL('image/png');
    urls.set(key, u);
  }
  return u;
}
/** Is this sprite one of the baked 3D icons? */
export const isIcon3D = (name: string) => !!(SPRITES as Record<string, Partial<Sprite3D>>)[name]?.i3d;
