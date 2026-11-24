// Relief: Hoot Hollow's v4 "realistic pixel art" painter for interface objects. Every object is modelled
// as a height field (domes, bevels, cylinders, carvings) with a real material per pixel (varnished walnut,
// polished brass, tooled leather, velvet, enamel, glass, paper), then lit by one consistent light from the
// top left: stepped (pixel-art) diffuse bands with ordered dithering, cool ambient in the shadows, warm
// light, ambient occlusion in the crevices, specular glints, a fake studio environment reflected in metal
// and glass, a sheen on velvet, and a coloured outline. Shapes and lighting step on the art-pixel grid
// (one art pixel = 2 CSS px in the HUD); material detail (wood grain, brushing, pores, fibres) is painted
// at `res` texels per art pixel so it reads as fine, real surface. Hard pixels only: nothing smooth.
// OWNED BY THE UI BUILDER (ui4).

export type RGB = [number, number, number];

// ------------------------------------------------------------------ noise
export function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function vnoise(x: number, y: number, s = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x: number, y: number, s = 0, oct = 3): number {
  let sum = 0, amp = 1, n = 0, f = 1;
  for (let o = 0; o < oct; o++) { sum += vnoise(x * f, y * f, s + o * 31) * amp; n += amp; amp *= 0.5; f *= 2.03; }
  return sum / n;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);
/** ordered dither offset in (-0.5, 0.5) */
export const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];
export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------ colour
export const hex = (h: string): RGB => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];
/** a ramp from hex stops (dark to light) */
export const ramp = (...hs: string[]): RGB[] => hs.map(hex);
/** sample a ramp at v (0..1), interpolated */
export function rampAt(r: RGB[], v: number): RGB {
  const f = clamp(v) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f));
  return mix(r[i], r[i + 1], f - i);
}

// The v4 interface palette: rich, natural, warm. Woods are honey to walnut with a red heart, metal is real
// brass gold, leather is oxblood, cloth is emerald, sapphire and linen, glass is sky blue.
export const PAL = {
  walnut: ramp('#1f0f08', '#331a0d', '#4a2613', '#62341a', '#7b4522', '#96592b', '#b06f37', '#c98948', '#dea862'),
  oak: ramp('#3b220f', '#563318', '#734622', '#90592b', '#ab6f36', '#c48844', '#d9a258', '#e9bd77', '#f4d59a'),
  cherry: ramp('#2a0d08', '#43160d', '#5e2213', '#7a2e18', '#94401f', '#ad5428', '#c46b35', '#d88a4b'),
  brass: ramp('#2b1a06', '#4a300b', '#6e4a12', '#94661a', '#b88524', '#d4a432', '#e8c24e', '#f6dc7f', '#fff1bd'),
  copper: ramp('#2a0f07', '#4d1d0d', '#723016', '#98461f', '#ba5f2b', '#d47e3e', '#e8a15c', '#f5c588'),
  iron: ramp('#16171b', '#24262c', '#353840', '#494d56', '#5f646e', '#7a808a', '#9aa0a8', '#c0c4c8'),
  leather: ramp('#1d0608', '#330b10', '#4b1118', '#661822', '#80222c', '#9a3036', '#b44543', '#cc6458'),
  tan: ramp('#2d1608', '#48250f', '#663719', '#874c24', '#a66432', '#c17e45', '#d89b5e', '#ebbb80'),
  emerald: ramp('#06180f', '#0b2918', '#123d24', '#1a5432', '#226b40', '#2f8550', '#46a066', '#6cbc84', '#9ad6a8'),
  moss: ramp('#16200a', '#243312', '#34481a', '#466023', '#5a792d', '#719339', '#8cad4a', '#aac466'),
  sapphire: ramp('#070c24', '#0d1638', '#14224f', '#1c3168', '#264383', '#33579e', '#4a72ba', '#6d94d2', '#a0bde8'),
  sky: ramp('#123a5a', '#1d5580', '#2a70a3', '#3f8cc2', '#5ea8d9', '#86c3e8', '#b4dcf2', '#e0f1fa'),
  rose: ramp('#3a0e14', '#5a1820', '#7c2530', '#9c3742', '#ba4f57', '#d06e70', '#e2938f', '#efbab2'),
  plum: ramp('#1a0c22', '#2a1236', '#3c1a4c', '#512464', '#68327c', '#804596', '#9c62b0', '#bc8acb'),
  linen: ramp('#5e4a34', '#7c6448', '#9a8060', '#b59c7a', '#cdb795', '#dfcdad', '#ecdfc5', '#f6eedd', '#fffaf0'),
  paper: ramp('#7a6142', '#9c8059', '#bba06f', '#d3bb8b', '#e4d1a6', '#efe2bf', '#f7eed6', '#fdf8ea'),
  enamel: ramp('#6d6150', '#968a76', '#bdb29c', '#dcd3bf', '#eee8d8', '#f8f4ea', '#fffdf6'),
  gold: ramp('#5a3a06', '#86580b', '#b07a12', '#d29e22', '#ecc03c', '#fadb6a', '#fff0a8'),
  ink: hex('#1a0f0a'),
};

// ------------------------------------------------------------------ materials
export interface Mat {
  /** specular strength and tightness */
  spec: number; shin: number;
  /** 0..1 how much of a studio environment the surface mirrors (metals, glass, varnish) */
  env?: number;
  /** velvet/cloth rim sheen */
  sheen?: number;
  /** self-lit: 1 ignores shading (lamp light, glowing glass) */
  emit?: number;
  /** diffuse bands (pixel-art steps) */
  bands?: number;
  /** dark outline colour factor for this material */
  line?: number;
}
export const MAT: Record<string, Mat> = {
  wood: { spec: 0.18, shin: 10, bands: 6 },
  varnish: { spec: 0.55, shin: 26, env: 0.18, bands: 6 },
  brass: { spec: 1.0, shin: 30, env: 1, bands: 7 },
  iron: { spec: 0.7, shin: 24, env: 0.7, bands: 6 },
  leather: { spec: 0.28, shin: 12, env: 0.05, bands: 6 },
  velvet: { spec: 0.05, shin: 4, sheen: 0.55, bands: 6 },
  cloth: { spec: 0.04, shin: 4, sheen: 0.22, bands: 6 },
  paper: { spec: 0.02, shin: 4, bands: 5 },
  enamel: { spec: 0.9, shin: 60, env: 0.25, bands: 5 },
  glass: { spec: 1.0, shin: 70, env: 0.6, bands: 6 },
  glow: { spec: 0, shin: 1, emit: 1 },
  moss: { spec: 0.04, shin: 4, sheen: 0.18, bands: 5 },
  stone: { spec: 0.1, shin: 8, bands: 5 },
};

// light: from the top left, a little in front of the surface
const L = (() => { const v = [-0.52, -0.62, 0.58]; const n = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / n) as [number, number, number]; })();
const HV = (() => { const v = [L[0], L[1], L[2] + 1]; const n = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / n) as [number, number, number]; })();
// a flat surface facing you comes out at its own colour: 0.35 x COOL + 0.65 x WARM ~ (1.01, 0.99, 0.97)
const WARM: RGB = [1.18, 1.1, 0.95];
const COOL: RGB = [0.7, 0.78, 1.0];
const LZ = 0.58;

/** The studio a metal surface mirrors: a bright window up-left, a warm floor, a dark horizon band. r = reflected dir. */
function envAt(rx: number, ry: number, _rz: number): number {
  // ry < 0 is up on screen. A face looking straight at you mirrors the bright studio wall; faces tipped up
  // see the window and the sky, faces tipped down see a dark horizon band and then the warm floor.
  const up = -ry;
  let e = 0.8 + 0.42 * up + 0.14 * -rx;
  e -= 0.42 * Math.exp(-(((up + 0.42) / 0.16) ** 2)); // horizon, below
  if (up > 0.42 && rx < -0.05 && rx > -0.8) e += 0.3; // the window, up-left
  return clamp(e, 0.12, 1.35);
}

// ------------------------------------------------------------------ the canvas

/** a point test in design units, optionally carrying its bounding box [x0, y0, x1, y1] so painting skips the rest */
export type Shape = ((x: number, y: number) => boolean) & { bb?: [number, number, number, number] };
/** attach a bounding box to a shape */
export const withBB = (f: (x: number, y: number) => boolean, bb?: [number, number, number, number]): Shape => { const g = f as Shape; if (bb) g.bb = bb; return g; };
/** height above the base at art coords (x, y); NaN = leave the pixel alone */
export type HFn = (x: number, y: number) => number;
/** albedo at art coords (x, y) and texel-precise micro coords (mx, my) in art px */
export type AFn = (x: number, y: number, mx: number, my: number) => RGB;

export interface FillOpts {
  /** add to what's there (a carving on a board) instead of replacing the height */
  add?: boolean;
  /** clip to already-painted pixels */
  onTop?: boolean;
  /** part id (outlines are drawn between parts of different id when `seam` is on) */
  id?: number;
  /** draw an inked seam where this part meets a lower part */
  seam?: boolean;
}

export class Relief {
  readonly W: number; readonly H: number;
  readonly hgt: Float32Array;
  readonly alb: Float32Array;
  readonly mat: Uint8Array;
  readonly id: Uint16Array;
  readonly seam: Uint8Array;
  readonly solid: Uint8Array;
  readonly mats: Mat[] = [];
  readonly fns: (AFn | null)[] = [];
  readonly fnIdx: Int16Array;
  outlineK = 0.42;
  /** soft cast shadow drawn under the object (art px offset, alpha) */
  shadow: { dx: number; dy: number; a: number } | null = null;
  /** art pixels per design unit (shapes, heights and albedos are given in units) */
  readonly k: number;
  readonly w: number; readonly h: number;
  /**
   * `uw` x `uh` design units; `k` art pixels per unit (1: chunky, 2: twice the detail); `res` texels per art
   * pixel for the material detail.
   */
  constructor(uw: number, uh: number, public res = 2, k = 1) {
    this.k = k;
    this.w = Math.round(uw * k); this.h = Math.round(uh * k);
    const w = this.w, h = this.h;
    this.W = w * res; this.H = h * res;
    const n = w * h;
    this.hgt = new Float32Array(n); this.alb = new Float32Array(n * 3); this.mat = new Uint8Array(n);
    this.id = new Uint16Array(n); this.seam = new Uint8Array(n); this.solid = new Uint8Array(n); this.fnIdx = new Int16Array(n).fill(-1);
  }
  /** art-pixel loop range for a shape (its bounding box, or the whole canvas) */
  private range(sh: Shape): [number, number, number, number] {
    const k = this.k, b = sh.bb;
    if (!b) return [0, 0, this.w, this.h];
    return [Math.max(0, Math.floor(b[0] * k) - 1), Math.max(0, Math.floor(b[1] * k) - 1), Math.min(this.w, Math.ceil(b[2] * k) + 1), Math.min(this.h, Math.ceil(b[3] * k) + 1)];
  }
  private matIndex(m: Mat) { let i = this.mats.indexOf(m); if (i < 0) { this.mats.push(m); i = this.mats.length - 1; } return i; }
  /**
   * Paint a part: for every art pixel inside `shape`, set its height (h(x, y)) and material, and remember the
   * albedo function (evaluated per texel at render time, so grain and fibres are finer than the art pixel).
   */
  fill(shape: Shape, h: HFn, albedo: AFn, m: Mat, o: FillOpts = {}) {
    const mi = this.matIndex(m);
    this.fns.push(albedo);
    const fi = this.fns.length - 1, k = this.k, [rx0, ry0, rx1, ry1] = this.range(shape);
    for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
      const cx = (x + 0.5) / k, cy = (y + 0.5) / k;
      if (!shape(cx, cy)) continue;
      const i = y * this.w + x;
      if (o.onTop && !this.solid[i]) continue;
      const hv = h(cx, cy) * k;
      if (Number.isNaN(hv)) continue;
      this.hgt[i] = o.add && this.solid[i] ? this.hgt[i] + hv : hv;
      this.mat[i] = mi; this.fnIdx[i] = fi; this.solid[i] = 1;
      this.id[i] = o.id ?? 0; this.seam[i] = o.seam ? 1 : 0;
      const c = albedo(cx, cy, cx, cy);
      this.alb[i * 3] = c[0]; this.alb[i * 3 + 1] = c[1]; this.alb[i * 3 + 2] = c[2];
    }
    return this;
  }
  /** change the height of painted pixels (carve grooves, emboss) without touching the material */
  carve(shape: Shape, dh: HFn) {
    const k = this.k, [rx0, ry0, rx1, ry1] = this.range(shape);
    for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
      const i = y * this.w + x, cx = (x + 0.5) / k, cy = (y + 0.5) / k;
      if (!this.solid[i] || !shape(cx, cy)) continue;
      const v = dh(cx, cy);
      if (!Number.isNaN(v)) this.hgt[i] += v * k;
    }
    return this;
  }
  /** erase pixels */
  cut(shape: Shape) {
    const k = this.k, [rx0, ry0, rx1, ry1] = this.range(shape);
    for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) if (shape((x + 0.5) / k, (y + 0.5) / k)) this.solid[y * this.w + x] = 0;
    return this;
  }
  /** recolour painted pixels inside `shape` (paint over: gilding, stains, painted numerals) keeping height */
  paint(shape: Shape, albedo: AFn, m?: Mat) {
    this.fns.push(albedo);
    const fi = this.fns.length - 1, k = this.k, mi = m ? this.matIndex(m) : -1, [rx0, ry0, rx1, ry1] = this.range(shape);
    for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
      const i = y * this.w + x, cx = (x + 0.5) / k, cy = (y + 0.5) / k;
      if (!this.solid[i] || !shape(cx, cy)) continue;
      this.fnIdx[i] = fi; if (mi >= 0) this.mat[i] = mi;
      const c = albedo(cx, cy, cx, cy);
      this.alb[i * 3] = c[0]; this.alb[i * 3 + 1] = c[1]; this.alb[i * 3 + 2] = c[2];
    }
    return this;
  }
  private H_(x: number, y: number, fb: number) { return x < 0 || y < 0 || x >= this.w || y >= this.h || !this.solid[y * this.w + x] ? fb : this.hgt[y * this.w + x]; }

  /** Light it and return RGBA texels (W x H). */
  render(o: { outline?: boolean; light?: number; ambient?: number } = {}): Uint8ClampedArray {
    const { w, h, res, W, H } = this;
    const out = new Uint8ClampedArray(W * H * 4);
    const amb0 = o.ambient ?? 0.35, kd = o.light ?? 1;
    // per art pixel: normal, ao, lighting terms
    const shade = new Float32Array(w * h * 6);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!this.solid[i]) continue;
      const hc = this.hgt[i];
      // the rim falls away to the ground: outside neighbours count as a drop
      const drop = Math.max(1.5, hc * 0.6);
      const hl = this.H_(x - 1, y, hc - drop), hr = this.H_(x + 1, y, hc - drop), hu = this.H_(x, y - 1, hc - drop), hd = this.H_(x, y + 1, hc - drop);
      let nx = -(hr - hl) / 2, ny = -(hd - hu) / 2, nz = 1;
      const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
      // ambient occlusion: how far the 8-ring around sits above this pixel
      let occ = 0;
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        const hn = this.H_(x + dx, y + dy, hc);
        if (hn > hc) occ += Math.min(1, (hn - hc) / 3);
      }
      const ao = 1 - Math.min(0.55, occ * 0.09);
      const ndl = nx * L[0] + ny * L[1] + nz * L[2];
      const ndh = Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]);
      shade[i * 6] = ndl; shade[i * 6 + 1] = ndh; shade[i * 6 + 2] = ao;
      shade[i * 6 + 3] = nx; shade[i * 6 + 4] = ny; shade[i * 6 + 5] = nz;
    }
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const x = (tx / res) | 0, y = (ty / res) | 0, i = y * w + x, j = (ty * W + tx) * 4;
      if (!this.solid[i]) continue;
      const m = this.mats[this.mat[i]];
      const f = this.fns[this.fnIdx[i]], kk = this.k;
      const a = f ? f((x + 0.5) / kk, (y + 0.5) / kk, (tx + 0.5) / res / kk, (ty + 0.5) / res / kk) : [this.alb[i * 3], this.alb[i * 3 + 1], this.alb[i * 3 + 2]] as RGB;
      let r: number, g: number, b: number;
      if (m.emit) { r = a[0]; g = a[1]; b = a[2]; }
      else {
        const ndl = shade[i * 6], ndh = shade[i * 6 + 1], ao = shade[i * 6 + 2];
        const nx = shade[i * 6 + 3], ny = shade[i * 6 + 4], nz = shade[i * 6 + 5];
        const bands = (m.bands ?? 6) / 1.5;
        // stepped diffuse relative to a flat face (1 = facing you), with a dithered edge between bands
        // (art-pixel dither, so it stays chunky); a flat face sits exactly on a band so it never dithers
        const f = Math.max(0, ndl) / LZ;
        const dq = Math.max(0, Math.min(1.8, Math.floor(f * bands + 0.5 + bayer(x, y) * 0.8) / bands));
        const amb = amb0 * ao * (0.9 + 0.1 * -ny);
        const dk = (1 - amb0) * kd * ao;
        r = a[0] * (COOL[0] * amb + WARM[0] * dq * dk);
        g = a[1] * (COOL[1] * amb + WARM[1] * dq * dk);
        b = a[2] * (COOL[2] * amb + WARM[2] * dq * dk);
        if (m.env) {
          const rx = 2 * nz * nx, ry = 2 * nz * ny, rz = 2 * nz * nz - 1;
          const e = envAt(rx, ry, rz);
          const eq = Math.floor(e * 6 + 0.5 + bayer(x, y) * 0.6) / 6;
          const k = m.env;
          r = r * (1 - k) + a[0] * eq * 1.05 * k * ao;
          g = g * (1 - k) + a[1] * eq * 1.0 * k * ao;
          b = b * (1 - k) + a[2] * eq * 0.9 * k * ao;
        }
        if (m.sheen) {
          const s = (1 - nz) ** 1.5 * m.sheen * (0.6 + 0.4 * Math.max(0, -ny - nx * 0.5 + 0.3));
          const sq = Math.floor(s * 4 + 0.5 + bayer(x, y) * 0.5) / 4;
          r += (a[0] * 0.6 + 90) * sq; g += (a[1] * 0.6 + 86) * sq; b += (a[2] * 0.6 + 96) * sq;
        }
        if (m.spec > 0) {
          const s = Math.pow(ndh, m.shin) * m.spec * ao;
          const sq = s > 0.55 ? 1 : s > 0.22 ? 0.45 : s > 0.1 && bayer(x, y) > 0.1 ? 0.2 : 0;
          if (sq) { const tint = m.env && m.env > 0.5 ? 0.55 : 0.1; r += (255 * (1 - tint) + a[0] * tint * 1.4) * sq * 0.85; g += (250 * (1 - tint) + a[1] * tint * 1.4) * sq * 0.85; b += (232 * (1 - tint) + a[2] * tint * 1.2) * sq * 0.85; }
        }
      }
      out[j] = r; out[j + 1] = g; out[j + 2] = b; out[j + 3] = 255;
    }
    // seams between parts: the lower side of a part boundary gets an inked line
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!this.solid[i]) continue;
      let line = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const k = Y * w + X;
        if (!this.solid[k] || this.id[k] === this.id[i]) continue;
        if ((this.seam[k] && this.hgt[k] > this.hgt[i]) || (this.seam[i] && this.hgt[i] < this.hgt[k] && this.seam[k])) line = true;
      }
      if (line) this.paintArt(out, x, y, (c) => [c[0] * 0.38 + 8, c[1] * 0.34 + 5, c[2] * 0.34 + 4]);
    }
    if (o.outline !== false) {
      // a coloured outline: the darkest neighbour, darkened
      const add: [number, number, RGB][] = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (this.solid[y * w + x]) continue;
        let best: RGB | null = null;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const X = x + dx, Y = y + dy;
          if (X < 0 || Y < 0 || X >= w || Y >= h || !this.solid[Y * w + X]) continue;
          const k = Y * w + X, c: RGB = [this.alb[k * 3], this.alb[k * 3 + 1], this.alb[k * 3 + 2]];
          const lk = this.mats[this.mat[k]].line ?? this.outlineK;
          const d: RGB = [c[0] * lk * 0.62 + 6, c[1] * lk * 0.55 + 4, c[2] * lk * 0.55 + 4];
          if (!best || d[0] + d[1] + d[2] < best[0] + best[1] + best[2]) best = d;
        }
        if (best) add.push([x, y, best]);
      }
      for (const [x, y, c] of add) this.paintArt(out, x, y, () => c, 255);
    }
    if (this.shadow) {
      const { dx, dy, a } = this.shadow;
      const sh = new Uint8ClampedArray(out);
      for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
        const j = (ty * W + tx) * 4;
        if (out[j + 3]) continue;
        const sx = tx - Math.round(dx * res * this.k), sy = ty - Math.round(dy * res * this.k);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H || !sh[(sy * W + sx) * 4 + 3]) continue;
        out[j] = 26; out[j + 1] = 14; out[j + 2] = 10; out[j + 3] = a;
      }
    }
    return out;
  }
  private paintArt(out: Uint8ClampedArray, x: number, y: number, f: (c: RGB) => RGB, alpha?: number) {
    const { res, W } = this;
    for (let ty = y * res; ty < (y + 1) * res; ty++) for (let tx = x * res; tx < (x + 1) * res; tx++) {
      const j = (ty * W + tx) * 4;
      const c = f([out[j], out[j + 1], out[j + 2]]);
      out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2];
      if (alpha !== undefined) out[j + 3] = alpha;
    }
  }
  canvas(o?: { outline?: boolean; light?: number; ambient?: number }): HTMLCanvasElement {
    const d = this.render(o);
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    c.getContext('2d')!.putImageData(new ImageData(d as Uint8ClampedArray<ArrayBuffer>, this.W, this.H), 0, 0);
    return c;
  }
  url(o?: { outline?: boolean; light?: number; ambient?: number }) { return this.canvas(o).toDataURL('image/png'); }
}

// ------------------------------------------------------------------ shapes (art px)
export const all: Shape = () => true;
export const rect = (x0: number, y0: number, w: number, h: number): Shape => withBB((x, y) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h, [x0, y0, x0 + w, y0 + h]);
/** a rectangle with cut (chamfered) corners of size c */
export const rrect = (x0: number, y0: number, w: number, h: number, c: number): Shape => withBB((x, y) => {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const dx = Math.min(x - x0, x0 + w - x), dy = Math.min(y - y0, y0 + h - y);
  return dx + dy >= c;
}, [x0, y0, x0 + w, y0 + h]);
/** a rectangle with round corners of radius r (stepped) */
export const roundRect = (x0: number, y0: number, w: number, h: number, r: number): Shape => withBB((x, y) => {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const dx = Math.max(0, r - Math.min(x - x0, x0 + w - x)), dy = Math.max(0, r - Math.min(y - y0, y0 + h - y));
  return dx * dx + dy * dy <= r * r;
}, [x0, y0, x0 + w, y0 + h]);
export const ell = (cx: number, cy: number, rx: number, ry: number): Shape => withBB((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, [cx - rx, cy - ry, cx + rx, cy + ry]);
export const disc = (cx: number, cy: number, r: number): Shape => ell(cx, cy, r, r);
export const ring = (cx: number, cy: number, r0: number, r1: number): Shape => withBB((x, y) => { const d = Math.hypot(x - cx, y - cy); return d >= r0 && d <= r1; }, [cx - r1, cy - r1, cx + r1, cy + r1]);
export function poly(pts: [number, number][]): Shape {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return withBB((px, py) => {
    if (px < x0 || px > x1 || py < y0 || py > y1) return false;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }, [x0, y0, x1, y1]);
}
const bbAnd = (s: Shape[]) => { let b: [number, number, number, number] | undefined; for (const f of s) if (f.bb) b = b ? [Math.max(b[0], f.bb[0]), Math.max(b[1], f.bb[1]), Math.min(b[2], f.bb[2]), Math.min(b[3], f.bb[3])] : [...f.bb]; return b; };
const bbOr = (s: Shape[]) => { if (s.some((f) => !f.bb)) return undefined; return s.reduce((b, f) => [Math.min(b[0], f.bb![0]), Math.min(b[1], f.bb![1]), Math.max(b[2], f.bb![2]), Math.max(b[3], f.bb![3])] as [number, number, number, number], [Infinity, Infinity, -Infinity, -Infinity] as [number, number, number, number]); };
export const and = (...s: Shape[]): Shape => withBB((x, y) => s.every((f) => f(x, y)), bbAnd(s));
export const or = (...s: Shape[]): Shape => withBB((x, y) => s.some((f) => f(x, y)), bbOr(s));
export const not = (s: Shape): Shape => (x, y) => !s(x, y);
/** a thick line segment */
export const seg = (x0: number, y0: number, x1: number, y1: number, r: number): Shape => withBB((x, y) => {
  const dx = x1 - x0, dy = y1 - y0, t = clamp(((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(x - x0 - dx * t, y - y0 - dy * t) <= r;
}, [Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r]);

// ------------------------------------------------------------------ height profiles
export const flat = (v = 0): HFn => () => v;
/** an ellipsoid dome */
export const dome = (cx: number, cy: number, rx: number, ry: number, hgt: number, base = 0): HFn => (x, y) => base + hgt * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2));
/** a bevelled slab: rises over `bev` px from each edge of the box to `hgt` (rounded profile) */
export const slab = (x0: number, y0: number, w: number, h: number, hgt: number, bev: number, base = 0): HFn => (x, y) => {
  const d = Math.min(x - x0, x0 + w - x, y - y0, y0 + h - y);
  const t = clamp(d / bev);
  return base + hgt * Math.sqrt(1 - (1 - t) ** 2);
};
/** a puffy cushion: a superellipse bump (pillows, buttons) */
export const puff = (cx: number, cy: number, rx: number, ry: number, hgt: number, p = 2.6, base = 0): HFn => (x, y) => {
  const q = Math.abs((x - cx) / rx) ** p + Math.abs((y - cy) / ry) ** p;
  return base + hgt * Math.pow(Math.max(0, 1 - q), 0.42);
};
/** a horizontal cylinder (a tube along x) */
export const tubeX = (cy: number, r: number, base = 0): HFn => (_x, y) => base + r * Math.sqrt(Math.max(0, 1 - ((y - cy) / r) ** 2));
/** a vertical cylinder */
export const tubeY = (cx: number, r: number, base = 0): HFn => (x) => base + r * Math.sqrt(Math.max(0, 1 - ((x - cx) / r) ** 2));
/** a torus-like rim (rings, bezels) */
export const torus = (cx: number, cy: number, rMid: number, half: number, hgt: number, base = 0): HFn => (x, y) => {
  const d = Math.abs(Math.hypot(x - cx, y - cy) - rMid) / half;
  return base + hgt * Math.sqrt(Math.max(0, 1 - d * d));
};

// ------------------------------------------------------------------ material albedos
/**
 * Real wood: growth rings swept along x by a slow warp, open pores as short dark streaks, the odd knot,
 * rays of figure. `R` a wood ramp; `along` 'x' or 'y' for the grain direction.
 */
export function woodGrain(R: RGB[], o: { seed?: number; along?: 'x' | 'y'; scale?: number; base?: number; contrast?: number; knots?: [number, number, number][] } = {}): AFn {
  const s = o.seed ?? 1, sc = o.scale ?? 1, base = o.base ?? 0.55, con = o.contrast ?? 1;
  return (_x, _y, mx, my) => {
    let u = o.along === 'y' ? my : mx, v = o.along === 'y' ? mx : my;
    u /= sc; v /= sc;
    // knots bend the rings around them
    let kb = 0;
    for (const [kx, ky, kr] of o.knots ?? []) {
      const dx = (o.along === 'y' ? my : mx) - kx, dy = (o.along === 'y' ? mx : my) - ky, d = Math.hypot(dx * 0.5, dy);
      if (d < kr) return rampAt(R, clamp(base - 0.35 + ((Math.sin(d * 3.4) + 1) * 0.12) * con));
      kb += (kr * 2.2) / (d + 0.5) * Math.sign(dy) * Math.exp(-d / (kr * 3));
    }
    // long, gently wandering growth lines (about 2.6 units apart), thin dark latewood, broad streaks of
    // colour along the length, open pores as short dark dashes, and a few pale flecks
    const warp = (fbm(u * 0.022, v * 0.07, s, 3) - 0.5) * 7 + Math.sin(u * 0.035 + s) * 0.9 + kb;
    const ring = (v + warp) * 2.4;
    const band = Math.sin(ring) + (vnoise(u * 0.3, v * 2.4, s + 4) - 0.5) * 0.5;
    const late = band > 0.8 ? -0.2 : band > 0.45 ? -0.08 : band < -0.6 ? 0.05 : 0;
    const streak = (fbm(u * 0.012, v * 0.22, s + 9, 3) - 0.5) * 0.42;
    const pore = hash(Math.floor(u * 0.4), Math.floor(v * 2.2), s + 3) > 0.94 ? -0.12 : 0;
    const fleck = hash(Math.floor(mx * 2), Math.floor(my * 2), s + 5) > 0.988 ? 0.07 : 0;
    return rampAt(R, clamp(base + (late + streak + pore + fleck) * con));
  };
}
/** brushed metal with tiny pits and, optionally, patina in hollows */
export function metal(R: RGB[], o: { seed?: number; base?: number; brush?: 'x' | 'y' | 'r'; cx?: number; cy?: number; patina?: number } = {}): AFn {
  const s = o.seed ?? 2, base = o.base ?? 0.62;
  const verd = hex('#4f8a72');
  return (_x, _y, mx, my) => {
    let b: number;
    if (o.brush === 'r') { const a = Math.atan2(my - (o.cy ?? 0), mx - (o.cx ?? 0)); b = vnoise(a * 18, Math.hypot(mx - (o.cx ?? 0), my - (o.cy ?? 0)) * 0.4, s); }
    else b = o.brush === 'y' ? vnoise(mx * 1.6, my * 0.15, s) : vnoise(mx * 0.15, my * 1.6, s);
    let c = rampAt(R, clamp(base + (b - 0.5) * 0.14 + (hash(Math.floor(mx * 2), Math.floor(my * 2), s) > 0.97 ? -0.12 : 0)));
    if (o.patina && fbm(mx * 0.25, my * 0.25, s + 4) > 1 - o.patina * 0.45) c = mix(c, verd, 0.38);
    return c;
  };
}
/** pebbled leather with creases */
export function leatherGrain(R: RGB[], o: { seed?: number; base?: number } = {}): AFn {
  const s = o.seed ?? 3, base = o.base ?? 0.55;
  return (_x, _y, mx, my) => {
    const peb = vnoise(mx * 1.3, my * 1.3, s) - 0.5;
    const crease = Math.abs(fbm(mx * 0.11, my * 0.11, s + 2) - 0.5) < 0.012 ? -0.08 : 0;
    const mott = (fbm(mx * 0.05, my * 0.05, s + 6) - 0.5) * 0.24;
    return rampAt(R, clamp(base + peb * 0.12 + crease + mott));
  };
}
/** woven cloth (linen, velvet): a fine over-under weave and a soft mottle */
export function weave(R: RGB[], o: { seed?: number; base?: number; scale?: number } = {}): AFn {
  const s = o.seed ?? 4, base = o.base ?? 0.55, sc = o.scale ?? 1;
  return (_x, _y, mx, my) => {
    const X = Math.floor(mx * 2 / sc), Y = Math.floor(my * 2 / sc);
    const w = ((X + Y) & 1) ? 0.05 : -0.05;
    const slub = hash(Y, 0, s) > 0.85 ? 0.06 : hash(X, 1, s) > 0.88 ? -0.05 : 0;
    const mott = (fbm(mx * 0.06, my * 0.06, s) - 0.5) * 0.16;
    return rampAt(R, clamp(base + w + slub + mott));
  };
}
/** paper with fibres and mottling */
export function paperGrain(R: RGB[], o: { seed?: number; base?: number } = {}): AFn {
  const s = o.seed ?? 5, base = o.base ?? 0.7;
  return (_x, _y, mx, my) => {
    const mott = (fbm(mx * 0.05, my * 0.05, s) - 0.5) * 0.18;
    const fib = vnoise(mx * 0.35, my * 1.8, s + 2) > 0.86 ? 0.07 : vnoise(mx * 1.6, my * 0.3, s + 3) > 0.9 ? -0.05 : 0;
    const speck = hash(Math.floor(mx * 2), Math.floor(my * 2), s) > 0.995 ? -0.25 : 0;
    return rampAt(R, clamp(base + mott + fib + speck));
  };
}
/** a plain colour (optionally with a fine mottle) */
export const solid = (c: RGB, n = 0, s = 7): AFn => (_x, _y, mx, my) => (n ? mul(c, 1 + (vnoise(mx * 0.5, my * 0.5, s) - 0.5) * n) : c);
