// The real photographs of the twenty places (one pixel-art treated atlas, see tools/photo_atlas.py): postcard
// fronts, and the passport's postage stamps (a duotone crop in the place's ink, perforated, with a cancellation
// ring and the date). Loads lazily; `photosReady` flips when the atlas is in.
// [globe] OWNED BY THE GLOBE BUILDER.
import { signal } from '@preact/signals';
import type { Area } from '../../game/catalog.ts';
import { hash, mix, mul, Pix, type C } from './pix.ts';
import { PHOTO_ATLAS, PHOTO_CREDIT, PHOTO_ORDER } from './photos.ts';

export const photosReady = signal(false);
let img: HTMLImageElement | null = null;
let loading = false;
const cache = new Map<string, string>();

export function loadPhotos() {
  if (loading) return;
  loading = true;
  const im = new Image();
  im.onload = () => { img = im; photosReady.value = true; };
  im.onerror = () => { loading = false; };
  im.src = `${import.meta.env.BASE_URL}${PHOTO_ATLAS.src}`;
}
export const hasPhoto = (id: string) => PHOTO_ORDER.includes(id) && !!PHOTO_CREDIT[id];
export const photoCredit = (id: string) => PHOTO_CREDIT[id];

function tile(id: string): ImageData | null {
  if (!img || !hasPhoto(id)) return null;
  const i = PHOTO_ORDER.indexOf(id), { tw, th, cols } = PHOTO_ATLAS;
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const g = c.getContext('2d')!;
  g.drawImage(img, (i % cols) * tw, Math.floor(i / cols) * th, tw, th, 0, 0, tw, th);
  return g.getImageData(0, 0, tw, th);
}

/** The postcard photograph as a data URL (device-crisp at `scale`), or null until the atlas is loaded. */
export function photoURL(id: string, scale: number): string | null {
  const key = `p:${id}:${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = tile(id);
  if (!d) return null;
  const p = new Pix(d.width, d.height);
  for (let i = 0; i < d.width * d.height; i++) p.data[i] = (d.data[i * 4] << 16) | (d.data[i * 4 + 1] << 8) | d.data[i * 4 + 2];
  // the printed edge of an old photo card: an uneven ink line
  for (let x = 0; x < p.w; x++) for (const y of [0, p.h - 1]) if (hash(x, y, 78) > 0.2) p.set(x, y, 0x3d3229);
  for (let y = 0; y < p.h; y++) for (const x of [0, p.w - 1]) if (hash(x, y, 79) > 0.2) p.set(x, y, 0x3d3229);
  const url = p.url(scale);
  cache.set(key, url);
  return url;
}

/** A postage stamp for the passport: a crop of the photograph printed in one ink (the place colour) on cream,
 * perforated edges, the stamp name and value, and for visited places a cancellation ring with the date. */
export function photoStamp(a: Area, o: { state: 'visited' | 'open' | 'locked'; date?: number; seed: number }, scale: number): string | null {
  const key = `s:${a.id}:${o.state}:${o.date ?? 0}:${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const d = tile(a.id);
  if (!d) return null;
  const W = 46, H = 38, p = new Pix(W, H);
  const ink = o.state === 'visited' ? mix(parseInt(a.color.slice(1), 16), 0x3d3229, 0.25) : 0x8a8478;
  const paper: C = o.state === 'locked' ? 0xe2dccb : 0xf1e9d6;
  p.rect(0, 0, W, H, paper);
  for (let x = 0; x < W; x += 2) { p.clear(x, 0); p.clear(x, H - 1); }
  for (let y = 0; y < H; y += 2) { p.clear(0, y); p.clear(W - 1, y); }
  // the photo crop, centre of the card, as a two-tone print (ink on cream) with a tiny ordered dither
  const Z = 3.2, cw = W - 8, ch = H - 13, sx = (d.width - cw * Z) / 2, sy = (d.height - ch * Z) / 2;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const ix = Math.floor(sx + x * Z), iy = Math.floor(sy + y * Z), k = (iy * d.width + ix) * 4;
    const l = (d.data[k] * 0.3 + d.data[k + 1] * 0.59 + d.data[k + 2] * 0.11) / 255;
    const b = ((x & 1) * 2 + (y & 1)) / 4 - 0.375;
    const t = Math.max(0, Math.min(1, l + b * 0.22));
    let c = t > 0.72 ? paper : t > 0.5 ? mix(paper, ink, 0.35) : t > 0.3 ? mix(paper, ink, 0.68) : ink;
    if (o.state === 'locked') c = mix(c, paper, 0.7); else if (o.state === 'open') c = mix(c, paper, 0.35);
    p.set(4 + x, 4 + y, c);
  }
  p.hline(4, W - 5, 3, mul(ink, 0.9)); p.hline(4, W - 5, 4 + ch, mul(ink, 0.9));
  p.vline(3, 3, 4 + ch, mul(ink, 0.9)); p.vline(W - 4, 3, 4 + ch, mul(ink, 0.9));
  const t = a.stamp.length > 10 ? a.stamp.replace(/ /g, '') : a.stamp;
  const gap = t.length > 9 ? 0 : 1;
  p.text(Math.round(W / 2 - Pix.textWidth(t, gap) / 2), H - 7, t, o.state === 'locked' ? 0xb9b2a4 : ink, gap);
  if (o.state === 'visited') {
    // the cancellation: a stepped ring off to one side with the date, a few wavy lines
    const cx = W - 9 - Math.round(hash(o.seed, 1) * 3), cy = 9 + Math.round(hash(o.seed, 2) * 3), mk = 0x4a4458;
    for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) {
      const r = Math.sqrt(x * x + y * y);
      if ((Math.abs(r - 7.5) < 0.5 || Math.abs(r - 6.2) < 0.4) && hash(x, y, o.seed) > 0.25) p.set(cx + x, cy + y, mk);
    }
    if (o.date) { const dt = new Date(o.date); const ds = `${dt.getDate()}`; p.text(Math.round(cx - Pix.textWidth(ds) / 2), cy - 2, ds, mk); }
    for (let k = 0; k < 2; k++) for (let x = cx - 22; x < cx - 8; x++) if (hash(x, k, o.seed) > 0.25) p.set(x, Math.round(cy - 4 + k * 4 + Math.sin(x * 0.6) * 1.2), mk);
  }
  const url = p.url(scale);
  cache.set(key, url);
  return url;
}
