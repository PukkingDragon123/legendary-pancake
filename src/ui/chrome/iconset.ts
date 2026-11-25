// [ui5] The icon family as little 3D models: every everyday icon in the interface (actions, arrows, status, sleep,
// sounds, wardrobe and build categories, quests, stats, the side tools) and the currency (the bag of acorns, the moon
// gem, the acorn packs) is a small lit 3D model, baked to chunky, brightly coloured pixel art with a coloured outline
// (src/dev/iconbake.ts -> src/ui/px/icons3d.ts). Each icon has a 24 and a 16 art-pixel bake (the small one for small
// sizes) and the currency has glinting idle frames (`owlcoin_f0..7`, `moongem_f0..7`...). Registered under the old
// sprite names, so every <Px name>, PxAnim and spriteURL in the app picks them up; decoded lazily on first use.
import { SPRITES } from '../px/sprites.js';
import { ICONS3D } from '../px/icons3d.ts';

interface Img { w: number; h: number; p: string; d: string }
interface Baked { L: Img; S?: Img }
interface Sprite3D { w: number; h: number; rows: string[]; pal: Record<string, string>; hi: { w: number; h: number; rows: string[]; pal: Record<string, string>; px: { d: Uint8ClampedArray } }; res: number; i3d: Baked }

/** the logical sprite size each name had before (CSS px at scale 1), so direct spriteURL callers keep their sizes */
const LOGICAL: Record<string, number> = { owlcoin: 24, moongem: 24, acorn_big: 40, gem_big: 40, coin_pouch: 32, coin_sack: 32, coin_chest: 32, coin_vault: 36 };
/** extra names drawn by a baked model */
const ALIAS: Record<string, string> = { moonstone: 'moongem' };

const pixels = new Map<Img, Uint8ClampedArray>();
/** RGBA pixels of a baked image (palette + run-length) */
export function decode(img: Img): Uint8ClampedArray {
  let px = pixels.get(img);
  if (px) return px;
  const pal: number[][] = [];
  for (let i = 0; i < img.p.length; i += 6) pal.push([parseInt(img.p.slice(i, i + 2), 16), parseInt(img.p.slice(i + 2, i + 4), 16), parseInt(img.p.slice(i + 4, i + 6), 16)]);
  const bin = atob(img.d);
  px = new Uint8ClampedArray(img.w * img.h * 4);
  let o = 0;
  for (let i = 0; i + 1 < bin.length; i += 2) {
    const n = bin.charCodeAt(i), k = bin.charCodeAt(i + 1);
    for (let j = 0; j < n; j++, o += 4) if (k) { const c = pal[k - 1]; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; }
  }
  pixels.set(img, px);
  return px;
}
function sprite(b: Baked, logical: number): Sprite3D {
  const L = b.L;
  return { w: logical, h: Math.round((logical * L.h) / L.w), rows: [], pal: {}, hi: { w: L.w, h: L.h, rows: [], pal: {}, px: { d: decode(L) } }, res: L.w / logical, i3d: b };
}

const cache = new Map<string, Sprite3D>();
let done = false;
/** Register the whole family over the sprite names (lazy: each is decoded the first time it's drawn). */
export function installIconSet() {
  if (done) return;
  done = true;
  const define = (name: string, make: () => Sprite3D) => Object.defineProperty(SPRITES, name, {
    enumerable: true, configurable: true,
    get() { let s = cache.get(name); if (!s) { s = make(); cache.set(name, s); } return s; },
  });
  const icons = ICONS3D.icons as Record<string, Baked>, anim = ICONS3D.anim as Record<string, Img[]>;
  for (const [name, b] of Object.entries(icons)) define(name, () => sprite(b, LOGICAL[name] ?? 20));
  for (const [a, b] of Object.entries(ALIAS)) if (icons[b]) define(a, () => sprite(icons[b], 20));
  for (const [name, frames] of Object.entries(anim)) frames.forEach((img, i) => define(`${name}_f${i}`, () => sprite({ L: img }, LOGICAL[name] ?? 20)));
}
/** the names in the family (for the dev sheet) */
export const ICON_NAMES = () => Object.keys(ICONS3D.icons);

const art = new Map<Img, HTMLCanvasElement>();
function artCanvas(img: Img): HTMLCanvasElement {
  let c = art.get(img);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.w; c.height = img.h;
    c.getContext('2d')!.putImageData(new ImageData(decode(img) as Uint8ClampedArray<ArrayBuffer>, img.w, img.h), 0, 0);
    art.set(img, c);
  }
  return c;
}
const urls = new Map<string, string>();
/**
 * A baked icon drawn at exactly `dev` device pixels across: the 16 px bake for small icons (up to 24 CSS px), the 24 px
 * bake above, scaled up with hard pixels (each art pixel 1.25..2 CSS px: chunky, never blurred). null when `name` isn't
 * one of the family.
 */
export function iconSrc(name: string, dev: number, dpr = 1): string | null {
  const s = (SPRITES as Record<string, Partial<Sprite3D>>)[name];
  if (!s?.i3d) return null;
  const css = dev / dpr;
  const img = css <= 24 && s.i3d.S ? s.i3d.S : s.i3d.L;
  const key = name + '|' + (img === s.i3d.S ? 's' : 'l') + '|' + dev;
  let u = urls.get(key);
  if (!u) {
    const h = Math.round((dev * img.h) / img.w);
    const c = document.createElement('canvas');
    c.width = dev; c.height = h;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = dev < img.w; // shrinking averages; growing keeps hard pixels
    g.imageSmoothingQuality = 'high';
    g.drawImage(artCanvas(img), 0, 0, dev, h);
    u = c.toDataURL('image/png');
    urls.set(key, u);
  }
  return u;
}
/** Is this sprite one of the baked 3D icons? */
export const isIcon3D = (name: string) => !!(SPRITES as Record<string, Partial<Sprite3D>>)[name]?.i3d;
