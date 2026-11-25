// Tiny pixel-art kit for the anime layer (emote marks, sparkles, focus lines, sunbursts, sound-effect words): a raster
// of whole texels with hard edges (no anti-aliasing, no gradients), hand-drawn ASCII sprites, lumpy organic shapes,
// an auto ink outline and a hard drop shadow. Everything ends up as small canvases that are drawn at whole-number
// scales with smoothing off, so every texel stays a crisp square.

export type RGBA = number; // 0xAABBGGRR (little-endian ImageData order)

/** '#rrggbb' or '#rrggbbaa' -> packed ABGR for a Uint32 view of ImageData. */
export function col(hex: string, a = 255): RGBA {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const al = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : a;
  return ((al << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** A small seeded random (shapes stay the same every run). */
export function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 100000) / 100000; };
}

/** 4x4 ordered dither threshold (0..1) at a texel: used for dissolves and for soft-looking but hard-edged fills. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export class Raster {
  readonly buf: Uint32Array;
  constructor(readonly w: number, readonly h: number) { this.buf = new Uint32Array(w * h); }
  clear() { this.buf.fill(0); }
  get(x: number, y: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.buf[y * this.w + x]; }
  set(x: number, y: number, c: RGBA) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = c;
  }
  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y)), x1 = Math.min(this.w, Math.round(x + w)), y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) this.buf.fill(c, yy * this.w + x0, yy * this.w + x1);
  }
  /** A filled lumpy oval (an organic blob, never a clean circle). `lump` 0..0.3, `seed` picks the wobble. */
  blob(cx: number, cy: number, rx: number, ry: number, c: RGBA, lump = 0.08, seed = 1) {
    const r = rng(seed), p0 = r() * 6.28, p1 = r() * 6.28, a1 = lump * (0.6 + r() * 0.4), a2 = lump * 0.5 * r();
    const X0 = Math.floor(cx - rx * 1.4), X1 = Math.ceil(cx + rx * 1.4), Y0 = Math.floor(cy - ry * 1.4), Y1 = Math.ceil(cy + ry * 1.4);
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, th = Math.atan2(dy, dx);
      const k = 1 + a1 * Math.sin(3 * th + p0) + a2 * Math.sin(5 * th + p1);
      if (dx * dx + dy * dy <= k * k) this.set(x, y, c);
    }
  }
  /** A filled polygon (even-odd, sampled at texel centres). */
  poly(pts: [number, number][], c: RGBA) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const Y0 = Math.max(0, Math.floor(y0)), Y1 = Math.min(this.h - 1, Math.ceil(y1));
    const xs: number[] = [];
    for (let y = Y0; y <= Y1; y++) {
      const sy = y + 0.5;
      xs.length = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > sy) !== (yj > sy)) xs.push(xi + ((sy - yi) * (xj - xi)) / (yj - yi));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(this.w - 1, Math.floor(xs[k + 1] - 0.5));
        if (b >= a) this.buf.fill(c, y * this.w + a, y * this.w + b + 1);
      }
    }
  }
  /** A brush stroke along a polyline: a square-ish nib of width `w`, tapering toward both ends by `taper` (0..1). */
  stroke(pts: [number, number][], w: number, c: RGBA, taper = 0) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) {
        const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        const g = (i + t) / Math.max(1, pts.length - 1);
        const ww = w * (1 - taper + taper * Math.sin(Math.PI * Math.min(1, Math.max(0, g))));
        const r = Math.max(0.5, ww / 2);
        for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
          if ((xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r * r + 0.15) this.set(xx, yy, c);
        }
      }
    }
  }
  /** An arc as polyline points (angles in radians, y down). */
  static arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 12): [number, number][] {
    const p: [number, number][] = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return p;
  }
  /** Paint an ASCII sprite: each character maps to a colour in `pal` ('.' and ' ' are clear). */
  rows(rows: string[], pal: Record<string, RGBA>, ox = 0, oy = 0) {
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const c = pal[row[x]]; if (c) this.set(ox + x, oy + y, c); } });
  }
  /** Every clear texel touching a filled one (4-neighbour, or 8 with `corners`) becomes `c`: a 1-texel ink line. */
  outline(c: RGBA, corners = false) {
    const { w, h, buf } = this, src = buf.slice();
    const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && (src[y * w + x] >>> 24) > 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (on(x, y)) continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) || (corners && (on(x - 1, y - 1) || on(x + 1, y - 1) || on(x - 1, y + 1) || on(x + 1, y + 1)))) buf[y * w + x] = c;
    }
  }
  /** A hard drop shadow `dx, dy` texels away, under everything already drawn. */
  shadow(c: RGBA, dx = 1, dy = 1) {
    const { w, h, buf } = this, src = buf.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y * w + x] >>> 24) continue;
      const sx = x - dx, sy = y - dy;
      if (sx >= 0 && sy >= 0 && sx < w && sy < h && src[sy * w + sx] >>> 24) buf[y * w + x] = c;
    }
  }
  /** Dissolve on the ordered-dither grid: texels whose threshold is above `keep` (0..1) go clear. */
  dissolve(keep: number) {
    if (keep >= 1) return;
    const { w, h, buf } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bayer(x, y) >= keep) buf[y * w + x] = 0;
  }
  /** Copy the raster into a fresh canvas (1 texel = 1 canvas pixel). */
  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    this.to(c.getContext('2d')!);
    return c;
  }
  to(ctx: CanvasRenderingContext2D, x = 0, y = 0) {
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.buf);
    ctx.putImageData(img, x, y);
  }
}

/** A sprite from ASCII rows, with an optional ink outline and hard shadow, padded so neither gets cut off. */
export function sprite(rows: string[], pal: Record<string, string>, o: { ink?: string; shadow?: string; corners?: boolean } = {}): HTMLCanvasElement {
  const w = Math.max(...rows.map((r) => r.length)) + 4, h = rows.length + 4;
  const r = new Raster(w, h);
  const P: Record<string, RGBA> = {};
  for (const k in pal) P[k] = col(pal[k]);
  r.rows(rows, P, 2, 2);
  if (o.ink) r.outline(col(o.ink), o.corners);
  if (o.shadow) r.shadow(col(o.shadow), 1, 1);
  return r.canvas();
}

/** Draw a sprite canvas centred at (x, y) at a whole-number scale, optionally squashed (sx, sy multiply the scale). */
export function blit(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, x: number, y: number, k: number, sx = 1, sy = 1, alpha = 1) {
  if (alpha <= 0) return;
  const flip = sx < 0, w = Math.round(img.width * k * Math.abs(sx)), h = Math.round(img.height * k * sy);
  if (w < 1 || h < 1) return;
  const a = ctx.globalAlpha;
  if (alpha < 1) ctx.globalAlpha = a * alpha;
  const x0 = Math.round(x - w / 2), y0 = Math.round(y - h / 2);
  if (flip) { ctx.save(); ctx.translate(x0 + w, y0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); ctx.restore(); }
  else ctx.drawImage(img, x0, y0, w, h);
  if (alpha < 1) ctx.globalAlpha = a;
}

/** Fill one texel-aligned square line from (x0, y0) to (x1, y1) (texel units, origin ox/oy in CSS px, k px per texel). */
export function texLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, k: number, ox: number, oy: number, w = 1) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t);
    ctx.fillRect(Math.round(ox + (x - (w >> 1)) * k), Math.round(oy + (y - (w >> 1)) * k), k * w, k * w);
  }
}

/** The shared clock (seconds) for the anime layer; `window.__animeT` freezes it (screenshots, tests). */
export function fxNow(): number {
  const f = (globalThis as { __animeT?: number }).__animeT;
  return f !== undefined ? f : performance.now() / 1000;
}

/** "Calm motion" (the in-app setting) or the system's reduced-motion preference. */
export function calmMotion(): boolean {
  try {
    if (document.documentElement.classList.contains('hh-still')) return true;
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { return false; }
}
