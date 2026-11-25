// [ui5] The icon family as little 3D models: every everyday icon in the interface (actions, arrows, status, sleep,
// sounds, wardrobe and build categories, quests, stats, the side tools) and the currency (the bag of acorns, the moon
// gem, the acorn packs) is a small lit 3D model, baked to chunky, brightly coloured pixel art with a coloured outline
// (src/dev/iconbake.ts -> src/ui/px/icons3d.ts). Each icon has a 24 and a 16 art-pixel bake (the small one for small
// sizes) and the currency has glinting idle frames (`owlcoin_f0..7`, `moongem_f0..7`...). Registered under the old
// sprite names, so every <Px name>, PxAnim and spriteURL in the app picks them up; decoded lazily on first use.
// [tex7] The models are textured before baking, and each icon is baked at several sizes (12..32 art px) so it is drawn
// at exactly one art pixel per artPx() CSS px (src/gfx/artpx.ts), the same pixel as the 3D world, the shelf and the
// painted HUD: `iconCss` gives the CSS size an icon is really drawn at (within an art pixel or two of the asked size).
import { SPRITES } from '../px/sprites.js';
import { ICONS3D } from '../px/icons3d.ts';
import { artPx } from '../../gfx/artpx.ts';

interface Img { w: number; h: number; p: string; d: string }
interface Baked { L: Img; S?: Img; z?: Img[] }
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
  const animZ = ((ICONS3D as { animZ?: Record<string, Img[][]> }).animZ ?? {});
  for (const [name, frames] of Object.entries(anim)) {
    frames.forEach((img, i) => define(`${name}_f${i}`, () => sprite({ L: img, z: animZ[name]?.[i] }, LOGICAL[name] ?? 20)));
    if (!icons[name]) define(name, () => sprite({ L: frames[0] }, LOGICAL[name] ?? 20)); // acorn_big, gem_big
  }
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
const sizes = new Map<Baked, Img[]>();
/** every bake of an icon, smallest first */
const bakesOf = (b: Baked): Img[] => {
  let l = sizes.get(b);
  if (!l) { l = [b.L, ...(b.S ? [b.S] : []), ...(b.z ?? [])].sort((x, y) => x.w - y.w); sizes.set(b, l); }
  return l;
};
const realDpr = () => (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1);
/**
 * How to draw an icon about `css` CSS px wide (in a box shown `zoom` times bigger on screen) at exactly one art pixel per
 * artPx() screen CSS px: the bake and the whole multiple k of art pixels per baked pixel (1 unless the icon is drawn
 * bigger than its biggest bake), and the CSS width it then takes. null when `name` isn't one of the family.
 */
export function iconFit(name: string, css: number, zoom = 1): { img: Img; k: number; css: number } | null {
  const s = (SPRITES as Record<string, Partial<Sprite3D>>)[name];
  if (!s?.i3d) return null;
  const ap = artPx() / zoom, want = css / ap;
  let img = s.i3d.L, k = 1, err = 1e9;
  for (const b of bakesOf(s.i3d)) for (let m = 1; m <= 4; m++) {
    const e = Math.abs(b.w * m - want) + (m - 1) * 1.5; // prefer one baked pixel per art pixel
    if (e < err) { err = e; img = b; k = m; }
  }
  return { img, k, css: img.w * k * ap };
}
/** the CSS width an icon asked at `css` px is really drawn at (see iconFit) */
export const iconCss = (name: string, css: number, zoom = 1) => iconFit(name, css, zoom)?.css ?? css;
/**
 * A baked icon asked at `dev` device pixels across (`dpr` the caller's device scale; `zoom` how much bigger its box is
 * shown on screen): the bake that fits, each art pixel exactly artPx() screen CSS px of whole device pixels, hard edged.
 * Show it at `iconCss(name, dev / dpr, zoom)` CSS px. null when `name` isn't one of the family.
 */
export function iconSrc(name: string, dev: number, dpr = 1, zoom = 1): string | null {
  const f = iconFit(name, dev / dpr, zoom);
  if (!f) return null;
  // device pixels per baked pixel: k art pixels of artPx() CSS px each at the real device scale (whole by design)
  const per = Math.max(1, Math.round((f.k * artPx() * realDpr()) / zoom));
  const key = name + '|' + f.img.w + '|' + per;
  let u = urls.get(key);
  if (!u) {
    const c = document.createElement('canvas');
    c.width = f.img.w * per; c.height = f.img.h * per;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(artCanvas(f.img), 0, 0, c.width, c.height);
    u = c.toDataURL('image/png');
    urls.set(key, u);
  }
  return u;
}
/** Is this sprite one of the baked 3D icons? */
export const isIcon3D = (name: string) => !!(SPRITES as Record<string, Partial<Sprite3D>>)[name]?.i3d;
