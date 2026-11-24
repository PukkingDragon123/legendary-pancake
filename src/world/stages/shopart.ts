// Pixel-art canvases for Queen Neve's boutique: the snowy evening seen through the bay window, frost
// creeping over its panes, glass glints for the display case, and the little fairy-light bulbs with
// their stepped pixel halos. Every texture is drawn texel by texel in the calm palette (no smooth
// gradients, no soft blobs) and shown nearest-filtered.
import * as THREE from 'three';
import { P, mixc, shade } from '../../gfx/palette.ts';
import { rng } from '../../gfx/noise.ts';

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

/** a snow-laden pine: stacked tiers with snow on each ledge */
function pine(p: Pix, cx: number, base: number, h: number, body: number, dark: number, snow: number, r: () => number) {
  const tiers = Math.max(2, Math.round(h / 6));
  p.rect(cx - 1, base - h * 0.14, 2, h * 0.14 + 1, P.barkDark);
  for (let k = 0; k < tiers; k++) {
    const top = base - h + (k * h * 0.78) / tiers, bot = top + h / tiers + h * 0.16, half = ((k + 1.3) / (tiers + 0.3)) * h * 0.3;
    for (let y = Math.floor(top); y < bot; y++) {
      const w = ((y - top) / (bot - top)) * half;
      for (let x = Math.floor(cx - w); x <= cx + w; x++) {
        const edge = y >= bot - 1.6 && r() < 0.85, lit = x < cx - w * 0.2;
        p.set(x, y, edge ? snow : lit ? body : dark);
      }
      if (y < top + 1.5) p.set(cx, y, snow);
    }
    // snow clumps sitting on the tier
    for (let i = 0; i < 2; i++) { const sx = cx + (r() - 0.6) * half * 1.2; p.set(sx, bot - 2.5, snow); p.set(sx + 1, bot - 2.5, snow); }
  }
}

/** The snowy evening outside the bay window (w x h art pixels). */
export function outdoorTexture(w = 168, h = 120): THREE.CanvasTexture {
  const p = new Pix(w, h), r = rng(71);
  const hor = Math.round(h * 0.6);
  p.bands(0, hor + 6, [P.deepNight, P.night, mixc(P.night, P.slate, 0.5), P.slate, P.dusk, mixc(P.dusk, P.lake, 0.6), P.lake]);
  // stars, a few with crosses
  for (let i = 0; i < w * h * 0.012; i++) { const x = r() * w, y = r() * hor * 0.7; p.set(x, y, r() < 0.25 ? P.lamp : P.frost, 0.55 + r() * 0.45); }
  for (let i = 0; i < 7; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * hor * 0.5); p.set(x, y, P.snow); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) p.set(x + dx, y + dy, P.ice, 0.8); }
  // the moon with stepped halo rings and craters
  const mx = Math.round(w * 0.76), my = Math.round(h * 0.17), mr = 7;
  p.ring(mx, my, mr + 6, 2, P.lake, 0.35, true);
  p.ring(mx, my, mr + 3, 3, P.sky, 0.3);
  p.disc(mx, my, mr, P.snow);
  p.disc(mx + 2, my - 2, 2.2, P.mist); p.disc(mx - 3, my + 2, 1.6, P.frost); p.set(mx + 3, my + 3, P.mist);
  for (let y = my - mr; y <= my + mr; y++) for (let x = mx - mr; x <= mx + mr; x++) if ((x + 0.5 - mx) ** 2 + (y + 0.5 - my) ** 2 <= mr * mr && x - mx + (y - my) > mr * 0.55) p.set(x, y, P.mist);
  // far mountains, snow-capped, bluish with distance
  for (let x = 0; x < w; x++) {
    const m = hor - h * 0.17 - Math.abs(((x * 0.85 + 40) % (w * 0.45)) - w * 0.225) * 0.42 - Math.sin(x * 0.07) * 3;
    for (let y = Math.floor(m); y < hor + 2; y++) p.set(x, y, y < m + 4 + Math.sin(x * 0.5) * 1.5 ? mixc(P.frost, P.sky, 0.3) : (x + y) % 4 === 0 ? P.dusk : mixc(P.dusk, P.slate, 0.45));
  }
  // far forest in mist
  for (let x = -4; x < w + 4; x += 3 + r() * 3) pine(p, x, hor + 3, 8 + r() * 6, mixc(P.slate, P.dusk, 0.4), P.slate, mixc(P.sky, P.mist, 0.4), r);
  // rolling snow fields with blue shadows
  for (let y = hor; y < h; y++) for (let x = 0; x < w; x++) {
    const hill = hor + 2 + Math.sin(x * 0.05) * 3 + Math.sin(x * 0.13 + 1) * 1.2;
    if (y < hill) continue;
    const dy = y - hill, sh = Math.sin(x * 0.05 + 1.2) < -0.2 && dy < 10;
    p.set(x, y, dy < 1.5 ? P.snow : sh ? (bay(x, y) > 0.4 ? P.ice : P.frost) : (x * 3 + y * 7) % 29 === 0 ? P.ice : (y + x) % 2 && dy > 18 ? P.frost : P.snow);
  }
  // a cottage on the rise with warm windows and a smoke column
  const cx = Math.round(w * 0.3), cb = hor + 8, cw = 20, ch = 10;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) p.set(cx - cw / 2 + x, cb - ch + y, y % 3 === 0 ? P.woodDeep : x % 6 === 0 ? P.woodDark : P.bark);
  for (let y = 0; y < 9; y++) { const half = (cw / 2 + 2) * (y / 8); for (let x = -half; x <= half; x++) p.set(cx + x, cb - ch - 9 + y, y > 6 || r() < 0.06 ? P.snow : y < 1 ? P.snow : P.frost); }
  p.rect(cx + 4, cb - ch - 10, 3, 6, P.barkDark); p.rect(cx + 3, cb - ch - 11, 5, 1, P.snow);
  for (const wx of [-6, 2]) { p.rect(cx + wx, cb - 7, 4, 4, P.lamp); p.rect(cx + wx + 2, cb - 7, 1, 4, P.honey); p.rect(cx + wx, cb - 5, 4, 1, P.honey); p.ring(cx + wx + 2, cb - 5, 6, 2, P.lamp, 0.18, true); }
  p.rect(cx - 1, cb - 6, 3, 6, P.woodDeep);
  for (let i = 0; i < 7; i++) { const sx = cx + 5 + Math.round(Math.sin(i * 0.9) * 2 + i * 0.6), sy = cb - ch - 13 - i * 3; p.disc(sx, sy, 1.2 + i * 0.25, P.mist, 0.5 - i * 0.05); }
  // a little lamp post with a warm lantern
  const lx = Math.round(w * 0.58), lb = hor + 14;
  p.rect(lx, lb - 16, 1, 16, P.ink2); p.rect(lx - 1, lb - 19, 3, 3, P.lamp); p.set(lx, lb - 20, P.ink2); p.rect(lx - 1, lb - 16, 3, 1, P.ink2);
  p.ring(lx, lb - 17.5, 7, 3, P.lamp, 0.16, true);
  for (let x = lx - 6; x <= lx + 6; x++) p.set(x, lb, P.lamp, 0.35);
  // a fence along the near snow, capped with snow
  for (let x = 4; x < w; x += 9) { p.rect(x, h - 22, 2, 9, P.woodDark); p.rect(x, h - 23, 2, 1, P.snow); }
  p.rect(0, h - 19, w, 1, P.wood); p.rect(0, h - 16, w, 1, P.woodDark); p.rect(0, h - 20, w, 1, P.snow);
  // near pines framing the view
  pine(p, 10, h + 6, 58, P.pine, P.forest, P.snow, r);
  pine(p, w - 14, h + 8, 66, P.pine, P.forest, P.snow, r);
  pine(p, w - 34, h + 4, 38, mixc(P.pine, P.dusk, 0.25), P.forest, P.snow, r);
  pine(p, 34, h + 2, 30, mixc(P.pine, P.dusk, 0.3), P.forest, P.frost, r);
  // baked flakes
  for (let i = 0; i < w * h * 0.004; i++) p.set(r() * w, r() * h, P.snow, 0.6 + r() * 0.4);
  return p.texture();
}

/** Frost crystals growing in from the corners and sills of each pane (transparent elsewhere). */
export function frostTexture(cols: number[], rows: number[], w = 160, h = 128): THREE.CanvasTexture {
  const p = new Pix(w, h), r = rng(19);
  const fern = (x: number, y: number, ang: number, len: number, depth: number) => {
    let px = x, py = y;
    for (let i = 0; i < len; i++) {
      px += Math.cos(ang); py += Math.sin(ang);
      const a = 0.85 - (i / len) * 0.45;
      p.set(px, py, i < len * 0.4 ? P.snow : P.frost, a);
      if (depth > 0 && i > 2 && i % 3 === 0) { fern(px, py, ang + 0.9, Math.max(2, len * 0.45 - i * 0.2), depth - 1); fern(px, py, ang - 0.9, Math.max(2, len * 0.45 - i * 0.2), depth - 1); }
      ang += (r() - 0.5) * 0.25;
    }
  };
  for (let ci = 0; ci + 1 < cols.length; ci++) for (let ri = 0; ri + 1 < rows.length; ri++) {
    const x0 = Math.round(cols[ci] * w), x1 = Math.round(cols[ci + 1] * w), y0 = Math.round(rows[ri] * h), y1 = Math.round(rows[ri + 1] * h);
    // a frosted crust along the bottom of the pane, ragged at the top
    for (let x = x0; x < x1; x++) {
      const hh = 3 + Math.round(Math.abs(Math.sin(x * 0.37 + ri) * 3) + r() * 2);
      for (let y = y1 - hh; y < y1; y++) p.set(x, y, y > y1 - 2 ? P.snow : r() < 0.7 ? P.frost : P.ice, y > y1 - 3 ? 0.9 : 0.6);
    }
    // ferns from the corners
    fern(x0 + 1, y1 - 3, -0.9, 14 + r() * 6, 2);
    fern(x1 - 2, y1 - 3, -Math.PI + 0.9, 12 + r() * 6, 2);
    fern(x0 + 1, y0 + 1, 0.7, 8 + r() * 4, 1);
    fern(x1 - 2, y0 + 1, Math.PI - 0.7, 7 + r() * 4, 1);
    // a clear-ish wiped streak where someone peeked through, and a few sparkly flecks
    for (let i = 0; i < 10; i++) p.set(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), P.snow, 0.7);
  }
  // fog film over the glass, dithered, thicker towards the bottom
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!p.alpha(x, y) && bay(x, y) < (y / h) * 0.22) p.set(x, y, P.mist, 0.28);
  return p.texture();
}

/** Glass for the display case: clear, with a couple of hard diagonal pixel glints. */
export function glassTexture(w = 64, h = 24): THREE.CanvasTexture {
  const p = new Pix(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) p.set(x, y, P.ice, 0.1);
  for (const [x0, width] of [[8, 4], [16, 2], [40, 5], [48, 2]] as const) for (let y = 0; y < h; y++) for (let k = 0; k < width; k++) p.set(x0 + k + y * 0.6, y, P.snow, 0.32);
  for (let x = 0; x < w; x++) { p.set(x, 0, P.snow, 0.5); p.set(x, h - 1, P.frost, 0.4); }
  return p.texture();
}

/** A fairy-light bulb (white, tinted by the material colour). */
export function bulbTexture(): THREE.CanvasTexture {
  const p = new Pix(7, 9);
  const rows = ['..###..', '.#####.', '#######', '###+###', '#######', '.#####.', '..###..', '..=.=..', '..===..'];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') p.set(x, y, 0xffffff); else if (ch === '+') p.set(x, y, 0xffffff); else if (ch === '=') p.set(x, y, shade(P.ink2, 1.6)); }));
  p.set(2, 1, 0xffffff); p.set(1, 2, 0xffffff);
  return p.texture();
}

/** Stepped pixel halo for the bulbs: two hard rings at fixed alpha plus a dithered fringe. */
export function haloTexture(): THREE.CanvasTexture {
  const p = new Pix(17, 17);
  p.ring(8.5, 8.5, 8.5, 2, 0xffffff, 0.22, true);
  p.ring(8.5, 8.5, 6.6, 2.2, 0xffffff, 0.3);
  p.disc(8.5, 8.5, 4.5, 0xffffff, 0.45);
  return p.texture();
}

/** A plain stepped pixel disc on the floor under a lit display (a pool of spotlight, pixel-edged). */
export function poolTexture(): THREE.CanvasTexture {
  const p = new Pix(40, 40);
  p.ring(20, 20, 20, 3, 0xffffff, 0.12, true);
  p.disc(20, 20, 17, 0xffffff, 0.16);
  p.disc(20, 20, 12, 0xffffff, 0.1);
  return p.texture();
}
