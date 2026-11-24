// Pixel-art replacements for every smooth round thing in the interface: stepped, Bayer-dithered
// glows (instead of radial gradients), pixel sunbursts that turn in whole-pixel steps (instead of
// conic gradients), dithered vignettes, star tiles, pixel ellipse shadows and stepped circle clips
// (instead of border-radius: 50%). Everything is painted at art-pixel resolution on a canvas and
// shown with image-rendering: pixelated, so edges are hard pixel steps, never anti-aliased.
// OWNED BY THE UI BUILDER (ui3).
import { useEffect, useRef } from 'preact/hooks';
import { calm } from './px/calm.js';

type RGB = [number, number, number];
const rgbOf = (c: string): RGB => { let s = calm(c).replace('#', ''); if (s.length <= 4) s = s.split('').map((k) => k + k).join(''); const n = parseInt(s.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[((y & 3) << 2) | (x & 3)];
const hash = (x: number, y: number, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

const urls = new Map<string, string>();
function paint(key: string, w: number, h: number, fn: (d: Uint8ClampedArray, w: number, h: number) => void): string {
  let u = urls.get(key);
  if (u !== undefined) return u;
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!, img = g.createImageData(w, h);
  fn(img.data, w, h);
  g.putImageData(img, 0, 0);
  u = c.toDataURL('image/png');
  urls.set(key, u);
  return u;
}
const put = (d: Uint8ClampedArray, w: number, x: number, y: number, c: RGB, a: number) => { const i = (y * w + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };

/**
 * A stepped glow: `bands` concentric pixel rings fading out in hard steps, the steps broken up by
 * an ordered dither. `n` texels across; `a` the alpha (0..1) of the centre. Returns a data URL.
 */
export function pxGlowURL(color: string, n = 48, a = 0.6, bands = 5, ry = 1): string {
  return paint(`glow:${color}:${n}:${a}:${bands}:${ry}`, n, Math.round(n * ry), (d, w, h) => {
    const c = rgbOf(color), cx = (w - 1) / 2, cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (r >= 1) continue;
      const k = Math.floor((1 - r) * bands + bayer(x, y) * 0.9);
      if (k <= 0) continue;
      put(d, w, x, y, c, Math.round((Math.min(bands, k) / bands) * a * 255));
    }
  });
}

/** A dithered vignette: clear in the middle, `color` towards the edges, in hard bands. */
export function pxVignetteURL(color: string, w = 96, h = 160, a = 0.8, cx = 0.5, cy = 0.4, bands = 6): string {
  return paint(`vig:${color}:${w}x${h}:${a}:${cx}:${cy}:${bands}`, w, h, (d) => {
    const c = rgbOf(color);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = Math.hypot((x / w - cx) / 0.75, (y / h - cy) / 0.9);
      const k = Math.floor(Math.max(0, r - 0.25) * 1.6 * bands + bayer(x, y) * 0.95);
      if (k <= 0) continue;
      put(d, w, x, y, c, Math.round((Math.min(bands, k) / bands) * a * 255));
    }
  });
}

/** A tile of tiny stars (crosses, dots and dim specks) for night skies. `n` texels square. */
export function pxStarsURL(n = 40, seed = 1, cols: string[] = ['#f4eedd', '#aec8cc', '#f1d39a']): string {
  return paint(`stars:${n}:${seed}:${cols.join()}`, n, n, (d, w) => {
    const C = cols.map(rgbOf);
    const count = Math.round((n * n) / 90);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(hash(i, 1, seed) * n), y = Math.floor(hash(i, 2, seed) * n), k = hash(i, 3, seed), c = C[i % C.length];
      const P = (xx: number, yy: number, al: number) => put(d, w, ((xx % n) + n) % n, ((yy % n) + n) % n, c, al);
      if (k > 0.9) { P(x, y, 255); P(x - 1, y, 150); P(x + 1, y, 150); P(x, y - 1, 150); P(x, y + 1, 150); }
      else if (k > 0.55) P(x, y, 230);
      else P(x, y, 120);
    }
  });
}

/** A flat pixel ellipse (e.g. a soft shadow under a prop): hard stepped edge, one dither ring. */
export function pxEllipseURL(color: string, w = 24, h = 6, a = 0.35): string {
  return paint(`ell:${color}:${w}x${h}:${a}`, w, h, (d) => {
    const c = rgbOf(color), cx = (w - 1) / 2, cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = Math.hypot((x - cx) / (w / 2), (y - cy) / (h / 2));
      if (r > 1) continue;
      if (r > 0.78 && bayer(x, y) > 0.5) continue;
      put(d, w, x, y, c, Math.round(a * 255));
    }
  });
}

/** A little square of sky for a round portrait (clip it with --px-circle): day mist or night with stars. */
export function pxSkyURL(night: boolean, n = 25): string {
  return paint(`sky:${night}:${n}`, n, n, (d, w) => {
    const top = rgbOf(night ? '#1b222d' : '#d3e0dc'), mid = rgbOf(night ? '#27313f' : '#aec8cc'), bot = rgbOf(night ? '#46596a' : '#c4cfa3');
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const k = y / (n - 1) + (bayer(x, y) - 0.5) * 0.22;
      put(d, w, x, y, k < 0.45 ? top : k < 0.8 ? mid : bot, 255);
    }
    if (night) for (const [x, y] of [[4, 4], [18, 3], [12, 7], [21, 9], [6, 11]]) put(d, w, x, y, rgbOf('#f4eedd'), 255);
    else for (const [x, y, l] of [[3, 6, 5], [15, 4, 6]]) for (let i = 0; i < l; i++) put(d, w, x + i, y, rgbOf('#f4eedd'), 255);
  });
}

/** A round brass-and-paper knob (a pixel disc with a lit rim), `n` texels across. */
export function pxKnobURL(n = 20, face = '#f4eedd', rim = '#dcb072', edge = '#8e7440'): string {
  return paint(`knob:${n}:${face}:${rim}:${edge}`, n, n, (d, w) => {
    const F = rgbOf(face), R = rgbOf(rim), E = rgbOf(edge), H = rgbOf('#f8ecd2'), K = rgbOf('#2e2b24'), c = (n - 1) / 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = x - c, dy = y - c, r = Math.hypot(dx, dy) / (n / 2);
      if (r > 1) continue;
      const lit = (-dx - dy) / (n / 2);
      put(d, w, x, y, r > 0.9 ? K : r > 0.72 ? (lit > 0.3 ? H : lit < -0.4 ? E : R) : r > 0.6 ? E : F, 255);
    }
  });
}

/** A hand-drawn pixel loop (a pencil circle round today's date): a wobbly 1-texel ring that overshoots its start. */
export function pxRingURL(n = 20, color = '#46596a'): string {
  return paint(`ring:${n}:${color}`, n, n, (d, w) => {
    const c = rgbOf(color), m = (n - 1) / 2;
    for (let i = 0; i < 220; i++) {
      const a = -1.9 + (i / 220) * Math.PI * 2.25, wob = 1 + Math.sin(a * 3 + 0.6) * 0.04 + (a > 3.6 ? 0.06 : 0);
      const x = Math.round(m + Math.cos(a) * (m - 0.6) * wob), y = Math.round(m + Math.sin(a) * (m - 1.2) * wob);
      if (x >= 0 && y >= 0 && x < n && y < n) put(d, w, x, y, c, 255);
    }
  });
}

/** A pegboard tile: one little drilled hole per `w` x `h` texels. */
export function pxPegURL(w = 7, h = 9, color = '#3a291d', a = 0.28): string {
  return paint(`peg:${w}x${h}:${color}:${a}`, w, h, (d) => {
    const c = rgbOf(color), al = Math.round(a * 255);
    put(d, w, 2, 3, c, al); put(d, w, 3, 3, c, Math.round(al * 0.6)); put(d, w, 2, 4, c, Math.round(al * 0.6));
  });
}

/** A column of punched holes (ticket perforation), 4 texels wide, tiling vertically. */
export function pxPerfURL(color = '#2a2a33', a = 0.5): string {
  return paint(`perf:${color}:${a}`, 4, 5, (d) => {
    const c = rgbOf(color), al = Math.round(a * 255);
    for (const [x, y] of [[1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3]]) put(d, 4, x, y, c, al);
  });
}

/** A stepped pixel circle as a CSS clip-path polygon (n texels across), for round portraits. */
export function pxCircleClip(n = 25): string {
  const r = n / 2, pts: string[] = [];
  const pc = (v: number) => `${((v / n) * 100).toFixed(3)}%`;
  // per row: the run of pixels whose centres lie inside the circle
  const run = (y: number) => { const dy = y + 0.5 - r; const half = Math.sqrt(Math.max(0, r * r - dy * dy)); const x0 = Math.round(r - half), x1 = Math.round(r + half); return [x0, x1]; };
  // right side, top to bottom
  for (let y = 0; y < n; y++) { const [, x1] = run(y); pts.push(`${pc(x1)} ${pc(y)}`, `${pc(x1)} ${pc(y + 1)}`); }
  for (let y = n - 1; y >= 0; y--) { const [x0] = run(y); pts.push(`${pc(x0)} ${pc(y + 1)}`, `${pc(x0)} ${pc(y)}`); }
  return `polygon(${pts.join(',')})`;
}

const pixCache = new Map<string, Promise<string>>();
/** Re-sample an image (e.g. a smooth 3D render) down to `n` x `n` art pixels with a hard alpha, so it can be shown pixelated. */
export function pixelate(url: string, n = 28, outline = '#2e2b24'): Promise<string> {
  const key = url.length + ':' + url.slice(-64) + ':' + n + outline;
  let p = pixCache.get(key);
  if (p) return p;
  p = new Promise<string>((res) => {
    if (!url || typeof document === 'undefined') { res(url); return; }
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = n; c.height = n;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(im, 0, 0, n, n);
      const img = g.getImageData(0, 0, n, n), d = img.data;
      const solid = new Uint8Array(n * n);
      for (let i = 0; i < n * n; i++) { solid[i] = d[i * 4 + 3] > 110 ? 1 : 0; d[i * 4 + 3] = solid[i] ? 255 : 0; }
      if (outline) {
        const o = rgbOf(outline);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const i = y * n + x;
          if (solid[i]) continue;
          if ((x > 0 && solid[i - 1]) || (x < n - 1 && solid[i + 1]) || (y > 0 && solid[i - n]) || (y < n - 1 && solid[i + n])) { d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2]; d[i * 4 + 3] = 255; }
        }
      }
      g.putImageData(img, 0, 0);
      res(c.toDataURL('image/png'));
    };
    im.onerror = () => res(url);
    im.src = url;
  });
  pixCache.set(key, p);
  return p;
}

let installed = false;
/** Once: CSS custom properties with the shared pixel textures (used by style.css and screen CSS). */
export function installPxFx() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const u = (s: string) => `url("${s}")`;
  // vignettes are painted at a quarter of the screen so their steps are ~4 px squares
  const vw = Math.min(400, Math.max(60, Math.ceil(innerWidth / 4))), vh = Math.min(300, Math.max(80, Math.ceil(innerHeight / 4)));
  const css = `:root{
--px-glow-lamp:${u(pxGlowURL('#f1d39a', 48, 0.55))};
--px-glow-paper:${u(pxGlowURL('#f4eedd', 48, 0.7))};
--px-glow-moon:${u(pxGlowURL('#aec8cc', 48, 0.45))};
--px-glow-ember:${u(pxGlowURL('#e7b98b', 48, 0.5))};
--px-vignette:${u(pxVignetteURL('#1b222d', vw, vh, 0.82))};
--px-vignette-soft:${u(pxVignetteURL('#1b222d', vw, vh, 0.5))};
--px-vignette-warm:${u(pxVignetteURL('#3a2f25', vw, vh, 0.55))};
--px-stars:${u(pxStarsURL(40, 3))};
--px-stars2:${u(pxStarsURL(56, 9, ['#d3e0dc', '#b4a9c9']))};
--px-shadow:${u(pxEllipseURL('#2a2e33', 24, 6, 0.38))};
--px-dot:${u(pxEllipseURL('#78593a', 6, 6, 0.25))};
--px-knob:${u(pxKnobURL())};
--px-ring:${u(pxRingURL())};
--px-peg:${u(pxPegURL())};
--px-perf:${u(pxPerfURL('#2a2e33', 0.55))};
--px-circle:${pxCircleClip(25)};
--hh-sky-day:${u(pxSkyURL(false))};
--hh-sky-night:${u(pxSkyURL(true))};
}
.px-glow,.px-bg{image-rendering:pixelated;image-rendering:crisp-edges}`;
  const st = document.createElement('style');
  st.id = 'hh-pxfx';
  st.textContent = css;
  document.head.appendChild(st);
}

/**
 * A turning pixel sunburst with a stepped glow at its heart (level-up, gifts, ceremonies). The
 * rays are re-drawn on the pixel grid every step, so they turn in whole pixels, never smoothly.
 */
export function PxBurst(p: { size?: number; scale?: number; color?: string; glow?: string; rays?: number; spin?: number; alpha?: number; class?: string; style?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const S = p.scale ?? 3, N = Math.round((p.size ?? 900) / S);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = N; cv.height = N;
    const g = cv.getContext('2d')!, img = g.createImageData(N, N), d = img.data;
    const rc = rgbOf(p.color ?? '#f1d39a'), gc = rgbOf(p.glow ?? p.color ?? '#f1d39a');
    const rays = p.rays ?? 16, A = p.alpha ?? 0.3, c = (N - 1) / 2;
    let raf = 0, last = -1;
    const t0 = performance.now();
    // per texel, once: ray phase, band alpha, glow alpha
    const M = N * N, F = new Float32Array(M), BA = new Float32Array(M), GA = new Float32Array(M);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, dx = x - c, dy = y - c, r = Math.hypot(dx, dy) / (N / 2);
      if (r >= 1) { BA[i] = -1; continue; }
      F[i] = ((Math.atan2(dy, dx) / (Math.PI * 2)) * rays % 1 + 1) % 1;
      BA[i] = (Math.floor((1 - r) * 5 + bayer(x, y) * 0.9) / 5) * A; // hard fade bands, dithered between
      GA[i] = (Math.floor(Math.max(0, 1 - r * 2.4) * 4 + bayer(x + 1, y) * 0.9) / 4) * Math.min(1, A * 2);
    }
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const step = Math.floor(((now - t0) / 1000) * 6); // 6 steps a second
      if (step === last) return;
      last = step;
      const sh = ((step * (p.spin ?? 0.012)) / (Math.PI * 2)) * rays;
      d.fill(0);
      for (let i = 0; i < M; i++) {
        if (BA[i] < 0) continue;
        const f = (F[i] + sh) % 1, ray = f < 0.38 ? BA[i] : 0, gl = GA[i];
        const a = Math.max(ray, gl);
        if (a <= 0.01) continue;
        const col = gl >= ray ? gc : rc, j = i * 4;
        d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = Math.round(a * 255);
      }
      g.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [N, p.color, p.glow]);
  return <canvas ref={ref} class={'px-burst' + (p.class ? ' ' + p.class : '')} aria-hidden="true" style={`width:${N * S}px;height:${N * S}px;image-rendering:pixelated;pointer-events:none;${p.style ?? ''}`} />;
}
