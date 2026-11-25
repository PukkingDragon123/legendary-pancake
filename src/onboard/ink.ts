// A real rubber-stamp impression, inked at full device resolution and different every time: the die (a double-ruled
// border, the word in Alagard, the firm's name) pressed into the paper by a hand that rocks it a little, so the ink
// takes unevenly: solid where the pressure was heavy, speckled with tiny voids where the rubber's grain and the paper's
// tooth kept it off, missing in patches where it barely touched. The ink wicks a hair's breadth out along the paper's
// fibres, pools darker at the edges of every stroke, leaves a faint ghost where the die bounced (a double strike)
// and a few spatter droplets. It arrives wet (deep, glossy, catching the light on its relief) and dries matte into
// the paper; the paper keeps a soft dent where the die came down.
//
//   inkStamp(word, sub, { w, h, seed }) -> an element w x h CSS px (absolutely placed by the caller)
//   prepareInk(...) paints it ahead of time (the painting is a few tens of ms; do it before the stamp falls)
import { fbm, hash, vnoise } from './tex.ts';
import { alagardSafe, STACK } from '../ui/font.ts';
import { reducedMotion } from '../ui/chrome/swing.ts';

export interface InkOpts { w: number; h: number; seed?: number; rgb?: [number, number, number]; dryMs?: number }
interface Painted { dry: HTMLCanvasElement; wet: HTMLCanvasElement; shine: HTMLCanvasElement; W: number; H: number }
const cache = new Map<string, Painted>();
const sm = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** separable box blur (radius r texels, two passes: close to a gaussian) */
function blur(src: Float32Array, W: number, H: number, r: number): Float32Array {
  r = Math.max(1, Math.round(r));
  let a = src, b = new Float32Array(src.length);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++) {
      let acc = 0; const row = y * W;
      for (let x = -r; x <= r; x++) acc += a[row + Math.min(W - 1, Math.max(0, x))];
      for (let x = 0; x < W; x++) { b[row + x] = acc / (2 * r + 1); acc += a[row + Math.min(W - 1, x + r + 1)] - a[row + Math.max(0, x - r)]; }
    }
    const c = new Float32Array(src.length);
    for (let x = 0; x < W; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += b[Math.min(H - 1, Math.max(0, y)) * W + x];
      for (let y = 0; y < H; y++) { c[y * W + x] = acc / (2 * r + 1); acc += b[Math.min(H - 1, y + r + 1) * W + x] - b[Math.max(0, y - r) * W + x]; }
    }
    a = c; b = new Float32Array(src.length);
  }
  return a;
}

/** the die: border, word and firm, as coverage (0..1) */
function die(word: string, sub: string, W: number, H: number, k: number, dx = 0, dy = 0, rot = 0): Float32Array {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.translate(W / 2 + dx, H / 2 + dy); g.rotate(rot); g.translate(-W / 2, -H / 2);
  g.strokeStyle = g.fillStyle = '#fff'; g.lineJoin = 'round';
  const rr = (i: number, lw: number, r: number) => { g.lineWidth = lw; g.beginPath(); g.roundRect(i, i, W - 2 * i, H - 2 * i, r); g.stroke(); };
  rr(1.9 * k, 2.3 * k, 3.4 * k);
  rr(4.9 * k, 0.9 * k, 1.8 * k);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const s = alagardSafe(word);
  let size = Math.floor(H * 0.5);
  g.font = `${size}px ${STACK}`;
  const maxW = W - 15 * k;
  const ww = g.measureText(s).width;
  if (ww > maxW) { size = Math.floor((size * maxW) / ww); g.font = `${size}px ${STACK}`; }
  // a little letter spacing, as cut rubber has
  const chars = [...s], sp = size * 0.06, tot = chars.reduce((a, ch) => a + g.measureText(ch).width, 0) + sp * (chars.length - 1);
  let x = W / 2 - tot / 2;
  const base = sub ? H * 0.585 : H * 0.66;
  g.textAlign = 'left';
  for (const ch of chars) { g.fillText(ch, x, base); g.lineWidth = size * 0.035; g.strokeText(ch, x, base); x += g.measureText(ch).width + sp; }
  if (sub) {
    const ss = Math.max(8 * k, Math.floor(H * 0.17));
    g.font = `${ss}px ${STACK}`; g.textAlign = 'center';
    g.fillText(alagardSafe(sub), W / 2, H * 0.83);
    // two little stars either side of the firm's name
    const sw = g.measureText(alagardSafe(sub)).width / 2 + ss * 0.9;
    for (const sx of [-1, 1]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = (i % 2 ? 0.42 : 1) * ss * 0.36; g.lineTo(W / 2 + sx * sw + Math.cos(a) * r, H * 0.83 - ss * 0.33 + Math.sin(a) * r); } g.fill(); }
  }
  const d = g.getImageData(0, 0, W, H).data, out = new Float32Array(W * H);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255;
  return out;
}

function paint(word: string, sub: string, o: InkOpts): Painted {
  const k = Math.min(3, Math.max(1, devicePixelRatio || 1)), W = Math.max(8, Math.round(o.w * k)), H = Math.max(8, Math.round(o.h * k));
  const seed = o.seed ?? 1, R = (i: number) => hash(i, 17, seed * 7 + 3);
  const M = die(word, sub, W, H, k);
  // a faint second strike: the die bounced a hair to one side as it lifted
  const gx = (R(1) - 0.5) * 2.4 * k, gy = (R(2) - 0.5) * 1.6 * k;
  const M2 = die(word, sub, W, H, k, gx, gy, (R(3) - 0.5) * 0.012);
  // pressure: the hand rocked the stamp (heavier toward one side), the rubber is not quite flat
  const tx = (R(4) - 0.5) * 0.7, ty = (R(5) - 0.5) * 0.5;
  // the paper's fibres: short strands every which way (ink wicks along them)
  const F = new Float32Array(W * H);
  const nf = Math.round((o.w * o.h) / 5);
  for (let i = 0; i < nf; i++) {
    let x = R(100 + i) * W, y = hash(i, 31, seed) * H;
    const a = hash(i, 53, seed) * Math.PI * 2, L = (1.2 + hash(i, 71, seed) * 4) * k, st = Math.ceil(L), v = 0.45 + hash(i, 97, seed) * 0.55;
    for (let s = 0; s < st; s++) { const j = (y | 0) * W + (x | 0); if (x >= 0 && y >= 0 && x < W && y < H) F[j] = Math.max(F[j], v); x += Math.cos(a); y += Math.sin(a); }
  }
  const C = new Float32Array(W * H), P = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, cx = x / k, cy = y / k;
    let p = 0.66 + (fbm(cx / 16, cy / 16, seed) - 0.5) * 0.55 + ((x / W - 0.5) * tx + (y / H - 0.5) * ty);
    // a light patch or two where the rubber barely kissed the paper
    p -= sm(0.64, 0.84, vnoise(cx / 9 + 40, cy / 9, seed + 9)) * 0.24;
    P[i] = p;
    // rubber grain and paper tooth: fine speckle at a fraction of a CSS pixel, a little coarser mottle
    const grain = vnoise(cx * 1.7, cy * 1.7, seed + 2) * 0.55 + hash(x, y, seed + 5) * 0.45;
    const m = M[i];
    if (m <= 0) continue;
    C[i] = m * sm(0.26, 0.46, p + (grain - 0.5) * 0.5);
  }
  // ink bleeds a little into the fibres just outside the strokes; the strokes pool darker at their edges
  const Cb = blur(C, W, H, 0.9 * k), Cr = blur(C, W, H, 1.4 * k);
  const D = new Float32Array(W * H);
  for (let i = 0; i < D.length; i++) {
    const bleed = Cb[i] > 0.12 ? Math.min(1, Cb[i] * 1.5) * F[i] * 0.7 : 0;
    const rim = clamp01((C[i] - Cr[i]) * 2.4);
    const ghost = M2[i] * (1 - M[i]) * sm(0.45, 0.8, P[i]) * 0.2 * (0.6 + hash(i, 3, seed) * 0.4);
    const core = C[i] * (0.7 + 0.3 * vnoise((i % W) / k / 3, ((i / W) | 0) / k / 3, seed + 21));
    D[i] = Math.min(1.25, Math.max(core + rim * 0.42, bleed) + ghost);
  }
  // spatter: a few droplets flicked off the die's edge (and their tiny satellites)
  const nd = 4 + Math.floor(R(6) * 4);
  for (let j = 0; j < nd; j++) {
    const side = R(10 + j), along = R(20 + j);
    let x: number, y: number;
    if (side < 0.5) { x = along * W; y = side < 0.25 ? R(30 + j) * 5 * k : H - R(30 + j) * 5 * k; } else { y = along * H; x = side < 0.75 ? R(30 + j) * 6 * k : W - R(30 + j) * 6 * k; }
    const r = (0.35 + R(40 + j) * 0.75) * k;
    for (let n = 0; n < 3; n++) {
      const rx = x + (n ? (R(50 + j * 3 + n) - 0.5) * 6 * k : 0), ry = y + (n ? (R(60 + j * 3 + n) - 0.5) * 6 * k : 0), rr = n ? r * 0.4 : r;
      for (let yy = Math.floor(ry - rr - 1); yy <= ry + rr + 1; yy++) for (let xx = Math.floor(rx - rr - 1); xx <= rx + rr + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const d = Math.hypot(xx - rx, yy - ry);
        D[yy * W + xx] = Math.max(D[yy * W + xx], clamp01(rr + 0.5 - d) * 1.05);
      }
    }
  }
  // the layers
  const [ir, ig, ib] = o.rgb ?? [178, 34, 42];
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const dry = mk(), wet = mk(), shine = mk();
  const di = new ImageData(W, H), wi = new ImageData(W, H), si = new ImageData(W, H);
  const Hh = blur(D, W, H, 0.7 * k);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, d = D[i];
    if (d <= 0.004) continue;
    const thin = 1 - clamp01(d);
    // dry: soaked in, a touch lighter and warmer where thin
    di.data.set([ir + thin * 30, ig + thin * 22, ib + thin * 14, clamp01(d) * 236], i * 4);
    // wet: deep and saturated, darker still where it pooled
    // shine: the wet ink stands a hair proud of the paper; its relief catches a light from the upper left
    const hx = (Hh[y * W + Math.min(W - 1, x + 1)] - Hh[y * W + Math.max(0, x - 1)]) / 2, hy = (Hh[Math.min(H - 1, y + 1) * W + x] - Hh[Math.max(0, y - 1) * W + x]) / 2;
    const nx = -hx * 4 * k, ny = -hy * 4 * k, nl = Math.hypot(nx, ny, 1);
    const lit = (nx * -0.45 + ny * -0.6 + 0.66) / nl;
    const hv = [-0.3, -0.42, 0.86], dot = (nx * hv[0] + ny * hv[1] + hv[2]) / nl;
    // wet: deep and saturated, darker still where it pooled and on the shaded side of its relief
    const pool = clamp01(d - 0.8) * 2.5, shade = 1 - 0.3 * clamp01(0.62 - lit);
    wi.data.set([(122 - pool * 40) * shade, 10 * shade, (26 - pool * 6) * shade, clamp01(d * 1.15) * 248], i * 4);
    const sp = Math.pow(Math.max(0, dot), 22) * clamp01(d * 1.4);
    const sheen = 0.12 * clamp01(d) * (0.5 + 0.5 * Math.sin((x / W) * 3 - (y / H) * 2 + seed));
    const a = clamp01(sp * 2.2 + sheen);
    if (a > 0.01) si.data.set([255, 246, 240, a * 255], i * 4);
  }
  dry.getContext('2d')!.putImageData(di, 0, 0);
  wet.getContext('2d')!.putImageData(wi, 0, 0);
  shine.getContext('2d')!.putImageData(si, 0, 0);
  return { dry, wet, shine, W, H };
}

const keyOf = (word: string, sub: string, o: InkOpts) => `${word}|${sub}|${Math.round(o.w)}x${Math.round(o.h)}|${o.seed ?? 1}|${devicePixelRatio}|${(o.rgb ?? []).join(',')}`;
/** Paint an impression ahead of time (cached). */
export function prepareInk(word: string, sub: string, o: InkOpts): void {
  const key = keyOf(word, sub, o);
  if (!cache.has(key)) { try { cache.set(key, paint(word, sub, o)); } catch { /* no canvas */ } }
}

/** The impression as an element (w x h CSS px): wet when it arrives, drying into the paper over `dryMs`. */
export function inkStamp(word: string, sub: string, o: InkOpts): HTMLElement {
  const key = keyOf(word, sub, o);
  prepareInk(word, sub, o);
  const p = cache.get(key);
  const el = document.createElement('span');
  Object.assign(el.style, { position: 'absolute', inset: '0', display: 'block', pointerEvents: 'none' });
  if (!p) return el;
  const dryMs = reducedMotion() ? 600 : o.dryMs ?? 2200;
  const layer = (c: HTMLCanvasElement, blend: string) => {
    const n = c.cloneNode() as HTMLCanvasElement;
    n.getContext('2d')!.drawImage(c, 0, 0);
    Object.assign(n.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', mixBlendMode: blend });
    el.appendChild(n);
    return n;
  };
  // the paper's dent where the die came down (it eases but never quite goes)
  const dent = document.createElement('i');
  Object.assign(dent.style, { position: 'absolute', inset: '0', borderRadius: '4px', boxShadow: 'inset 1px 1.5px 2.5px rgba(70,40,16,.3), inset -1px -1px 1px rgba(255,250,236,.35)', transition: `opacity ${dryMs * 1.4}ms ease-out`, opacity: '1' });
  el.appendChild(dent);
  layer(p.dry, 'multiply');
  const wet = layer(p.wet, 'normal'), shine = layer(p.shine, 'normal');
  wet.style.transition = `opacity ${dryMs}ms cubic-bezier(.5,0,.7,1) ${dryMs * 0.1}ms`;
  shine.style.transition = `opacity ${dryMs * 0.6}ms ease-in, transform ${dryMs * 0.6}ms ease-out`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wet.style.opacity = '0';
    shine.style.opacity = '0'; shine.style.transform = 'translate(0.5px, 0.5px)';
    dent.style.opacity = '0.35';
  }));
  return el;
}
