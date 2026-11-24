// A tiny pixel buffer for the lodge store's hand-pixelled canvases (the leaf cards of the potted plants): drawn texel
// by texel (no smooth gradients, no soft blobs) and shown nearest-filtered. OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bay = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)];

/** A tiny RGBA pixel buffer with the handful of pixel-art tools the shop needs. */
export class Pix {
  d: Uint8ClampedArray<ArrayBuffer>;
  constructor(public w: number, public h: number) { this.d = new Uint8ClampedArray(new ArrayBuffer(w * h * 4)); }
  set(x: number, y: number, c: number, a = 1) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (a >= 1 || this.d[i + 3] === 0) { this.d[i] = r; this.d[i + 1] = g; this.d[i + 2] = b; this.d[i + 3] = Math.round(a * 255); return; }
    const da = this.d[i + 3] / 255, oa = a + da * (1 - a);
    this.d[i] = (r * a + this.d[i] * da * (1 - a)) / oa; this.d[i + 1] = (g * a + this.d[i + 1] * da * (1 - a)) / oa; this.d[i + 2] = (b * a + this.d[i + 2] * da * (1 - a)) / oa;
    this.d[i + 3] = oa * 255;
  }
  get(x: number, y: number): number { const i = (y * this.w + x) * 4; return (this.d[i] << 16) | (this.d[i + 1] << 8) | this.d[i + 2]; }
  alpha(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[(y * this.w + x) * 4 + 3]; }
  rect(x: number, y: number, w: number, h: number, c: number, a = 1) { for (let j = Math.floor(y); j < y + h; j++) for (let i = Math.floor(x); i < x + w; i++) this.set(i, j, c, a); }
  /** vertical bands between colour stops, ordered-dithered at each step (a painted sky, not a smooth ramp) */
  bands(y0: number, y1: number, stops: number[]) {
    const n = stops.length - 1;
    for (let y = Math.floor(y0); y < y1; y++) for (let x = 0; x < this.w; x++) {
      const t = Math.max(0, Math.min(0.9999, (y - y0) / (y1 - y0))) * n, i = Math.floor(t), f = t - i;
      this.set(x, y, f > bay(x, y) ? stops[Math.min(n, i + 1)] : stops[i]);
    }
  }
  /** a stepped pixel disc (no anti-aliasing) */
  disc(cx: number, cy: number, r: number, c: number, a = 1) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.set(x, y, c, a);
  }
  /** a pixel ring of `w` px at a fixed alpha: halos are stepped rings, never a smooth falloff */
  ring(cx: number, cy: number, r: number, w: number, c: number, a: number, dither = false) {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r && d > r - w && (!dither || (x + y) % 2 === 0)) this.set(x, y, c, a);
    }
  }
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas'); c.width = this.w; c.height = this.h;
    c.getContext('2d')!.putImageData(new ImageData(this.d, this.w, this.h), 0, 0);
    return c;
  }
  texture(): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(this.canvas());
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
}
