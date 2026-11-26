// The places' real photographs (see photos.ts): each place's sheet loads on demand (the place view's prints and
// the globe's satellite close-up share it); a small atlas of every place's first photo (places.webp) gives the
// passport its postage stamps: a crop of the photo printed in one ink on cream, perforated, with a cancellation
// ring and the date once Pip has slept there.
// [globe] OWNED BY THE GLOBE BUILDER.
import { signal } from '@preact/signals';
import type { Area } from '../../game/catalog.ts';
import { hash, mix, mul, Pix, type C } from './pix.ts';
import { sheetUrl, THUMBS } from './photos.ts';
import { textWidth } from '../font.ts';

/** place ids whose photo sheet has loaded */
export const sheetsReady = signal<Record<string, true>>({});
const loading = new Set<string>();
/** Start loading a place's sheet (the prints show once it is in). */
export function loadSheet(id: string) {
  if (loading.has(id)) return;
  loading.add(id);
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => { sheetsReady.value = { ...sheetsReady.value, [id]: true }; };
  im.onerror = () => loading.delete(id);
  im.src = sheetUrl(id);
}

export const thumbsReady = signal(false);
let thumbImg: HTMLImageElement | null = null;
let thumbLoading = false;
export function loadThumbs() {
  if (thumbLoading) return;
  thumbLoading = true;
  const im = new Image();
  im.onload = () => { thumbImg = im; thumbsReady.value = true; };
  im.onerror = () => { thumbLoading = false; };
  im.src = `${import.meta.env.BASE_URL}${THUMBS.src}`;
}
/** CSS for a place's thumbnail (its first photo) shown w x h CSS px (3:2) */
export function thumbStyle(id: string, w: number): Record<string, string> {
  const i = Math.max(0, THUMBS.order.indexOf(id)), k = w / THUMBS.tw;
  return {
    backgroundImage: `url(${import.meta.env.BASE_URL}${THUMBS.src})`,
    backgroundSize: `${THUMBS.cols * THUMBS.tw * k}px ${4 * THUMBS.th * k}px`,
    backgroundPosition: `${-(i % THUMBS.cols) * THUMBS.tw * k}px ${-Math.floor(i / THUMBS.cols) * THUMBS.th * k}px`,
    width: `${w}px`, height: `${Math.round(THUMBS.th * k)}px`,
  };
}

const cache = new Map<string, string>();
let thumbData: ImageData | null = null;
function thumb(id: string): { d: ImageData; x: number; y: number } | null {
  if (!thumbImg) return null;
  if (!thumbData) {
    const c = document.createElement('canvas');
    c.width = thumbImg.naturalWidth; c.height = thumbImg.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(thumbImg, 0, 0);
    thumbData = g.getImageData(0, 0, c.width, c.height);
  }
  const i = THUMBS.order.indexOf(id);
  if (i < 0) return null;
  return { d: thumbData, x: (i % THUMBS.cols) * THUMBS.tw, y: Math.floor(i / THUMBS.cols) * THUMBS.th };
}

/** A postage stamp for the passport (null until the thumbnails are in). */
export function photoStamp(a: Area, o: { state: 'visited' | 'open' | 'locked'; date?: number; seed: number }, scale: number): string | null {
  const key = `s:${a.id}:${o.state}:${o.date ?? 0}:${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const t = thumb(a.id);
  if (!t) return null;
  // [font6] 54 art pixels wide so the place's name fits in Alegreya; two lines when it can't
  const W = 54, H = 38, p = new Pix(W, H);
  const ink = o.state === 'visited' ? mix(parseInt(a.color.slice(1), 16), 0x3d3229, 0.25) : 0x8a8478;
  const name = a.stamp, lines = textWidth(name) / 2 <= W - 8 ? [name] : textWidth(name.replace(/ /g, '')) / 2 <= W - 8 ? [name.replace(/ /g, '')] : name.split(' ');
  const paper: C = o.state === 'locked' ? 0xe2dccb : 0xf1e9d6;
  p.rect(0, 0, W, H, paper);
  for (let x = 0; x < W; x += 2) { p.clear(x, 0); p.clear(x, H - 1); }
  for (let y = 0; y < H; y += 2) { p.clear(0, y); p.clear(W - 1, y); }
  // the photo, centre crop, as a two-tone print (ink on cream) with a tiny ordered dither
  const cw = W - 8, ch = H - 13 - (lines.length - 1) * 7, Z = Math.min(THUMBS.tw / cw, THUMBS.th / ch) * 0.86;
  const sx = t.x + (THUMBS.tw - cw * Z) / 2, sy = t.y + (THUMBS.th - ch * Z) / 2, dw = t.d.width;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const ix = Math.floor(sx + x * Z), iy = Math.floor(sy + y * Z), k = (iy * dw + ix) * 4, d = t.d.data;
    const l = (d[k] * 0.3 + d[k + 1] * 0.59 + d[k + 2] * 0.11) / 255;
    const b = ((x & 1) * 2 + (y & 1)) / 4 - 0.375;
    const v = Math.max(0, Math.min(1, l + b * 0.22));
    let c = v > 0.72 ? paper : v > 0.5 ? mix(paper, ink, 0.35) : v > 0.3 ? mix(paper, ink, 0.68) : ink;
    if (o.state === 'locked') c = mix(c, paper, 0.7); else if (o.state === 'open') c = mix(c, paper, 0.35);
    p.set(4 + x, 4 + y, c);
  }
  p.hline(4, W - 5, 3, mul(ink, 0.9)); p.hline(4, W - 5, 4 + ch, mul(ink, 0.9));
  p.vline(3, 3, 4 + ch, mul(ink, 0.9)); p.vline(W - 4, 3, 4 + ch, mul(ink, 0.9));
  const cap: C = o.state === 'locked' ? 0xb9b2a4 : ink;
  const labels: { text: string; cx: number; base: number; c: C; maxW: number }[] = lines.map((t, i) => ({ text: t, cx: W / 2, base: H - 2.5 - (lines.length - 1 - i) * 7, c: cap, maxW: W - 6 }));
  if (o.state === 'visited') {
    // the cancellation: a wobbly ring off to one side with the date, a few wavy lines
    const cx = W - 9 - Math.round(hash(o.seed, 1) * 3), cy = 9 + Math.round(hash(o.seed, 2) * 3), mk = 0x4a4458;
    for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) {
      const r = Math.sqrt(x * x + y * y) + (hash(x, y, o.seed + 9) - 0.5) * 0.6;
      if ((Math.abs(r - 7.5) < 0.5 || Math.abs(r - 6.2) < 0.4) && hash(x, y, o.seed) > 0.25) p.set(cx + x, cy + y, mk);
    }
    if (o.date) labels.push({ text: `${new Date(o.date).getDate()}`, cx, base: cy + 3, c: mk, maxW: 12 });
    for (let k = 0; k < 2; k++) for (let x = cx - 22; x < cx - 8; x++) if (hash(x, k, o.seed) > 0.25) p.set(x, Math.round(cy - 4 + k * 4 + Math.sin(x * 0.6) * 1.2), mk);
  }
  const url = p.urlText(scale, labels);
  cache.set(key, url);
  return url;
}
