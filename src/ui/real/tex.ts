// The UI's material textures: seamless 512 px tiles baked from Poly Haven CC0 photo sets (walnut, oak,
// leather, bookcloth, linen, velvet, felt; lit by their own normal maps from the UI's top-left light) and
// procedural ones (parchment, kraft, cork, brushed metal); see art/ui/textures.py and docs/credits/ui7.md.
// Colour tiles are used as they are; grey "detail" tiles (mean 128) are tinted (overlay) to any colour.
//
//   TEX_URL[name]     the tile's URL (CSS backgrounds: `url(...)`)
//   loadTextures()    decode every tile once (the painter samples them); resolves when done or after a timeout
//   texReady          signal: true once the tiles are decoded
//   sampleTex(...)    bilinear, wrapping sample in texel units
import { signal } from '@preact/signals';
import walnut from './tex/walnut.webp?url';
import oak from './tex/oak.webp?url';
import leather from './tex/leather.webp?url';
import pebble from './tex/pebble.webp?url';
import bookcloth from './tex/bookcloth.webp?url';
import linen from './tex/linen.webp?url';
import velvet from './tex/velvet.webp?url';
import felt from './tex/felt.webp?url';
import paper from './tex/paper.webp?url';
import kraft from './tex/kraft.webp?url';
import cork from './tex/cork.webp?url';
import brushed from './tex/brushed.webp?url';

export const TEX_URL = { walnut, oak, leather, pebble, bookcloth, linen, velvet, felt, paper, kraft, cork, brushed };
export type TexName = keyof typeof TEX_URL;
/** grey detail tiles (tinted at use) */
export const DETAIL: Record<TexName, boolean> = { walnut: false, oak: false, leather: false, pebble: true, bookcloth: true, linen: true, velvet: true, felt: true, paper: false, kraft: false, cork: false, brushed: true };

interface TexData { w: number; h: number; d: Float32Array }
const DATA: Partial<Record<TexName, TexData>> = {};
export const texReady = signal(false);

/** an absolute URL for a tile (safe inside CSS custom properties) */
export const texAbs = (n: TexName) => { try { return new URL(TEX_URL[n], document.baseURI).href; } catch { return TEX_URL[n]; } };

let loading: Promise<void> | null = null;
/** Decode every tile (once). Resolves when all are in, or after `timeout` ms with whatever arrived. */
export function loadTextures(timeout = 7000): Promise<void> {
  if (loading) return loading;
  if (typeof document === 'undefined') return (loading = Promise.resolve());
  const one = (n: TexName) => new Promise<void>((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(im, 0, 0);
        const px = g.getImageData(0, 0, c.width, c.height).data;
        const d = new Float32Array(c.width * c.height * 3);
        for (let i = 0, j = 0; i < px.length; i += 4, j += 3) { d[j] = px[i]; d[j + 1] = px[i + 1]; d[j + 2] = px[i + 2]; }
        DATA[n] = { w: c.width, h: c.height, d };
      } catch { /* tainted or no canvas: procedural fallback */ }
      res();
    };
    im.onerror = () => res();
    im.src = TEX_URL[n];
  });
  const all = Promise.all((Object.keys(TEX_URL) as TexName[]).map(one)).then(() => undefined);
  loading = Promise.race([all, new Promise<void>((r) => setTimeout(r, timeout))]).then(() => { texReady.value = true; });
  return loading;
}

export const hasTex = (n: TexName) => !!DATA[n];

/** Bilinear, wrapping sample of tile `n` at texel coords (u, v); writes 0..255 floats into `out`. */
export function sampleTex(n: TexName, u: number, v: number, out: number[]): number[] {
  const t = DATA[n];
  if (!t) { out[0] = out[1] = out[2] = DETAIL[n] ? 128 : 150; return out; }
  const { w, h, d } = t;
  u -= 0.5; v -= 0.5;
  const fu = Math.floor(u), fv = Math.floor(v), au = u - fu, av = v - fv;
  const x0 = ((fu % w) + w) % w, y0 = ((fv % h) + h) % h, x1 = (x0 + 1) % w, y1 = (y0 + 1) % h;
  const i00 = (y0 * w + x0) * 3, i10 = (y0 * w + x1) * 3, i01 = (y1 * w + x0) * 3, i11 = (y1 * w + x1) * 3;
  for (let c = 0; c < 3; c++) {
    const a = d[i00 + c] + (d[i10 + c] - d[i00 + c]) * au, b = d[i01 + c] + (d[i11 + c] - d[i01 + c]) * au;
    out[c] = a + (b - a) * av;
  }
  return out;
}

const CANVASES = new Map<string, HTMLCanvasElement | null>();
/** A tile as a canvas (for canvas patterns), optionally tinted like tileURL. null if the tile isn't loaded. */
export function texCanvas(n: TexName, tint?: string): HTMLCanvasElement | null {
  const key = n + ':' + (tint ?? '');
  if (CANVASES.has(key)) return CANVASES.get(key)!;
  const t = DATA[n];
  if (typeof document === 'undefined' || !t) return null;
  const src = document.createElement('canvas');
  src.width = t.w; src.height = t.h;
  const sg = src.getContext('2d')!, img = sg.createImageData(t.w, t.h);
  for (let i = 0, j = 0; j < t.d.length; i += 4, j += 3) { img.data[i] = t.d[j]; img.data[i + 1] = t.d[j + 1]; img.data[i + 2] = t.d[j + 2]; img.data[i + 3] = 255; }
  sg.putImageData(img, 0, 0);
  let out = src;
  if (tint) {
    out = document.createElement('canvas');
    out.width = t.w; out.height = t.h;
    const g = out.getContext('2d')!;
    g.fillStyle = tint; g.fillRect(0, 0, t.w, t.h);
    g.globalCompositeOperation = DETAIL[n] ? 'overlay' : 'multiply';
    g.drawImage(src, 0, 0);
  }
  CANVASES.set(key, out);
  return out;
}

const TILES = new Map<string, string>();
/**
 * A tile as a CSS-ready URL: colour tiles as they are (or multiplied by `tint`); grey detail tiles tinted to
 * `tint` (overlay); `gain` < 1 darkens, > 1 lightens. Painted once at `size` px (data URL).
 */
export function tileURL(n: TexName, tint?: string, size = 512, gain = 1): string {
  if (!tint && gain === 1) return TEX_URL[n];
  const key = `${n}:${tint}:${size}:${gain}`;
  let u = TILES.get(key);
  if (u) return u;
  const t = DATA[n];
  if (typeof document === 'undefined' || !t) return TEX_URL[n];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const src = document.createElement('canvas');
  src.width = t.w; src.height = t.h;
  const sg = src.getContext('2d')!, img = sg.createImageData(t.w, t.h);
  for (let i = 0, j = 0; j < t.d.length; i += 4, j += 3) { img.data[i] = t.d[j]; img.data[i + 1] = t.d[j + 1]; img.data[i + 2] = t.d[j + 2]; img.data[i + 3] = 255; }
  sg.putImageData(img, 0, 0);
  if (tint) { g.fillStyle = tint; g.fillRect(0, 0, size, size); g.globalCompositeOperation = DETAIL[n] ? 'overlay' : 'multiply'; }
  g.drawImage(src, 0, 0, size, size);
  g.globalCompositeOperation = 'source-over';
  if (gain !== 1) { g.globalCompositeOperation = gain < 1 ? 'multiply' : 'screen'; const v = Math.round(255 * (gain < 1 ? gain : gain - 1)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, 0, size, size); }
  try { u = c.toDataURL('image/webp', 0.86); if (!u.startsWith('data:image/webp')) u = c.toDataURL('image/jpeg', 0.88); } catch { u = TEX_URL[n]; }
  TILES.set(key, u);
  return u;
}
