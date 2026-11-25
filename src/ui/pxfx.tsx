// Soft light and small round things for the interface, painted smooth and anti-aliased at device
// resolution: radial glows, vignettes, star tiles with soft halos, soft contact shadows, a gradient sky for
// round portraits, a brass-and-paper knob, a pencil loop, pegboard holes, ticket perforations, a round clip,
// and a slowly turning sunburst of soft rays. (The file keeps its old name: many screens import from it.)
// `pixelate()` stays for the anime emotes layer, which still wants a chunky chibi.
import { useEffect, useRef } from 'preact/hooks';
import { calm } from './px/calm.js';

type RGB = [number, number, number];
const rgbOf = (c: string): RGB => { let s = calm(c).replace('#', ''); if (s.length <= 4) s = s.split('').map((k) => k + k).join(''); const n = parseInt(s.slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c: string, a: number) => { const [r, g, b] = rgbOf(c); return `rgba(${r},${g},${b},${a})`; };
const hash = (x: number, y: number, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const DPR = () => Math.min(3, Math.max(1, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));

const urls = new Map<string, string>();
/** paint once: `w` x `h` CSS px drawn at `s` px per CSS px */
function paint(key: string, w: number, h: number, fn: (g: CanvasRenderingContext2D, w: number, h: number) => void, s = 2): string {
  let u = urls.get(key);
  if (u !== undefined) return u;
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
  const g = c.getContext('2d')!;
  g.scale(s, s);
  fn(g, w, h);
  u = c.toDataURL('image/png');
  urls.set(key, u);
  return u;
}

/** A soft radial glow of `color` (centre alpha `a`), `n` px across. */
export function pxGlowURL(color: string, n = 48, a = 0.6, _bands = 5, ry = 1): string {
  return paint(`glow:${color}:${n}:${a}:${ry}`, n, n * ry, (g, w, h) => {
    g.translate(w / 2, h / 2); g.scale(1, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    gr.addColorStop(0, rgba(color, a)); gr.addColorStop(0.35, rgba(color, a * 0.55)); gr.addColorStop(0.7, rgba(color, a * 0.16)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.fill();
  }, 1);
}

/** A soft vignette: clear in the middle, `color` towards the edges. */
export function pxVignetteURL(color: string, w = 96, h = 160, a = 0.8, cx = 0.5, cy = 0.4): string {
  return paint(`vig:${color}:${w}x${h}:${a}:${cx}:${cy}`, w, h, (g) => {
    const r = Math.hypot(w, h) * 0.62;
    const gr = g.createRadialGradient(w * cx, h * cy, r * 0.28, w * cx, h * cy, r);
    gr.addColorStop(0, rgba(color, 0)); gr.addColorStop(0.55, rgba(color, a * 0.45)); gr.addColorStop(1, rgba(color, a));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, 1);
}

/** A tile of stars: soft points with halos and a few four-point sparkles. `n` px square. */
export function pxStarsURL(n = 40, seed = 1, cols: string[] = ['#f4eedd', '#aec8cc', '#f1d39a']): string {
  return paint(`stars:${n}:${seed}:${cols.join()}`, n, n, (g) => {
    const count = Math.round((n * n) / 90);
    for (let i = 0; i < count; i++) {
      const x = hash(i, 1, seed) * n, y = hash(i, 2, seed) * n, k = hash(i, 3, seed), c = cols[i % cols.length];
      for (const [dx, dy] of [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]]) {
        const X = x + dx, Y = y + dy, r = k > 0.9 ? 2.2 : k > 0.55 ? 1.2 : 0.8;
        if (X < -4 || Y < -4 || X > n + 4 || Y > n + 4) continue;
        const gr = g.createRadialGradient(X, Y, 0, X, Y, r * 2.2);
        gr.addColorStop(0, rgba(c, k > 0.55 ? 1 : 0.6)); gr.addColorStop(0.3, rgba(c, 0.5)); gr.addColorStop(1, rgba(c, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(X, Y, r * 2.2, 0, Math.PI * 2); g.fill();
        if (k > 0.9) { g.strokeStyle = rgba(c, 0.55); g.lineWidth = 0.5; g.beginPath(); g.moveTo(X - 3.5, Y); g.lineTo(X + 3.5, Y); g.moveTo(X, Y - 3.5); g.lineTo(X, Y + 3.5); g.stroke(); }
      }
    }
  }, 3);
}

/** A soft elliptical contact shadow. */
export function pxEllipseURL(color: string, w = 24, h = 6, a = 0.35): string {
  return paint(`ell:${color}:${w}x${h}:${a}`, w, h, (g) => {
    g.translate(w / 2, h / 2); g.scale(1, h / w);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    gr.addColorStop(0, rgba(color, a)); gr.addColorStop(0.6, rgba(color, a * 0.6)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w / 2, 0, Math.PI * 2); g.fill();
  }, 3);
}

/** A little square of sky for a round portrait: a soft day or night gradient (a few stars at night). */
export function pxSkyURL(night: boolean, n = 25): string {
  return paint(`sky:${night}:${n}`, n, n, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, n);
    if (night) { gr.addColorStop(0, '#141c34'); gr.addColorStop(0.6, '#2a3c66'); gr.addColorStop(1, '#4a5f86'); }
    else { gr.addColorStop(0, '#6fb0e6'); gr.addColorStop(0.65, '#b6dcf2'); gr.addColorStop(1, '#e8efd2'); }
    g.fillStyle = gr; g.fillRect(0, 0, n, n);
    if (night) for (const [x, y] of [[4, 4], [18, 3], [12, 7], [21, 9], [6, 11]]) { g.fillStyle = 'rgba(255,248,226,.9)'; g.beginPath(); g.arc(x, y, 0.5, 0, Math.PI * 2); g.fill(); }
  }, 4);
}

/** A round knob: a brass rim around a paper face, softly lit from the top left. `n` px across. */
export function pxKnobURL(n = 20, face = '#f4eedd', rim = '#dcb072', edge = '#8e7440'): string {
  return paint(`knob:${n}:${face}:${rim}:${edge}`, n, n, (g) => {
    const c = n / 2;
    let gr = g.createLinearGradient(0, 0, n, n);
    gr.addColorStop(0, '#fff0c0'); gr.addColorStop(0.35, rim); gr.addColorStop(1, edge);
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c - 0.5, 0, Math.PI * 2); g.fill();
    gr = g.createRadialGradient(c - n * 0.12, c - n * 0.12, 0, c, c, c * 0.72);
    gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, face);
    g.fillStyle = gr; g.beginPath(); g.arc(c, c, c * 0.68, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(60,40,20,.35)'; g.lineWidth = 0.6; g.stroke();
  }, 3);
}

/** A hand-drawn pencil loop round a date: a wobbly stroke that overshoots its start. */
export function pxRingURL(n = 20, color = '#46596a'): string {
  return paint(`ring:${n}:${color}`, n, n, (g) => {
    const m = n / 2;
    g.strokeStyle = rgba(color, 0.85); g.lineWidth = Math.max(1, n / 18); g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i <= 80; i++) {
      const a = -1.9 + (i / 80) * Math.PI * 2.25, wob = 1 + Math.sin(a * 3 + 0.6) * 0.04 + (a > 3.6 ? 0.06 : 0);
      const x = m + Math.cos(a) * (m - 1.2) * wob, y = m + Math.sin(a) * (m - 1.8) * wob;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
  }, 3);
}

/** A pegboard tile: one drilled hole per `w` x `h` px. */
export function pxPegURL(w = 7, h = 9, color = '#3a291d', a = 0.28): string {
  return paint(`peg:${w}x${h}:${color}:${a}`, w, h, (g) => {
    const gr = g.createRadialGradient(2.6, 3.6, 0, 3, 4, 1.4);
    gr.addColorStop(0, rgba(color, a * 1.6)); gr.addColorStop(0.7, rgba(color, a)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.beginPath(); g.arc(3, 4, 1.4, 0, Math.PI * 2); g.fill();
  }, 4);
}

/** A column of punched round holes (ticket perforation), 4 px wide, tiling vertically. */
export function pxPerfURL(color = '#2a2a33', a = 0.5): string {
  return paint(`perf:${color}:${a}`, 4, 5, (g) => {
    g.fillStyle = rgba(color, a); g.beginPath(); g.arc(2, 2.5, 1.35, 0, Math.PI * 2); g.fill();
  }, 4);
}

/** A round clip (CSS clip-path) for round portraits. */
export function pxCircleClip(_n = 25): string { return 'circle(50% at 50% 50%)'; }

const pixCache = new Map<string, Promise<string>>();
/** Re-sample an image down to `n` x `n` with a hard alpha (used by the anime emote layer's chibi). */
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
/** Once: CSS custom properties with the shared soft textures (used by style.css and screen CSS). */
export function installPxFx() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const u = (s: string) => `url("${s}")`;
  const css = `:root{
--px-glow-lamp:${u(pxGlowURL('#f6d79a', 96, 0.6))};
--px-glow-paper:${u(pxGlowURL('#fff6e0', 96, 0.75))};
--px-glow-moon:${u(pxGlowURL('#b8d4f0', 96, 0.5))};
--px-glow-ember:${u(pxGlowURL('#f2b07a', 96, 0.55))};
--px-vignette:radial-gradient(ellipse 75% 70% at 50% 42%, rgba(14,18,30,0) 30%, rgba(14,18,30,.5) 70%, rgba(14,18,30,.85) 100%);
--px-vignette-soft:radial-gradient(ellipse 75% 70% at 50% 42%, rgba(14,18,30,0) 35%, rgba(14,18,30,.3) 75%, rgba(14,18,30,.55) 100%);
--px-vignette-warm:radial-gradient(ellipse 75% 70% at 50% 42%, rgba(40,26,14,0) 35%, rgba(40,26,14,.3) 75%, rgba(40,26,14,.6) 100%);
--px-stars:${u(pxStarsURL(40, 3))};
--px-stars2:${u(pxStarsURL(56, 9, ['#d3e0dc', '#b4a9c9']))};
--px-shadow:${u(pxEllipseURL('#1e1a16', 24, 6, 0.42))};
--px-dot:${u(pxEllipseURL('#78593a', 6, 6, 0.3))};
--px-knob:${u(pxKnobURL())};
--px-ring:${u(pxRingURL())};
--px-peg:${u(pxPegURL())};
--px-perf:${u(pxPerfURL('#2a2e33', 0.55))};
--px-circle:circle(50% at 50% 50%);
--hh-sky-day:${u(pxSkyURL(false))};
--hh-sky-night:${u(pxSkyURL(true))};
}`;
  const st = document.createElement('style');
  st.id = 'hh-pxfx';
  st.textContent = css;
  document.head.appendChild(st);
}

/**
 * A slowly turning sunburst of soft rays with a warm glow at its heart (level-up, gifts, ceremonies).
 * Painted once, smooth; it turns with a CSS rotation.
 */
export function PxBurst(p: { size?: number; scale?: number; color?: string; glow?: string; rays?: number; spin?: number; alpha?: number; class?: string; style?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const size = p.size ?? 900, k = Math.min(1.5, DPR()), N = Math.round(size * k);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    cv.width = N; cv.height = N;
    const g = cv.getContext('2d')!, c = N / 2, rays = p.rays ?? 16, A = p.alpha ?? 0.3;
    const col = p.color ?? '#f1d39a', gl = p.glow ?? col;
    g.clearRect(0, 0, N, N);
    g.save(); g.translate(c, c);
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2, w = (Math.PI * 2 / rays) * 0.38;
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, c);
      gr.addColorStop(0, rgba(col, A)); gr.addColorStop(0.55, rgba(col, A * 0.5)); gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, c, a0 - w / 2, a0 + w / 2); g.closePath(); g.fill();
    }
    const gg = g.createRadialGradient(0, 0, 0, 0, 0, c * 0.45);
    gg.addColorStop(0, rgba(gl, Math.min(1, A * 2.2))); gg.addColorStop(0.5, rgba(gl, A * 0.8)); gg.addColorStop(1, rgba(gl, 0));
    g.fillStyle = gg; g.beginPath(); g.arc(0, 0, c * 0.45, 0, Math.PI * 2); g.fill();
    g.restore();
  }, [N, p.color, p.glow, p.rays, p.alpha]);
  const secs = Math.max(20, Math.round(40 / Math.max(0.2, (p.spin ?? 0.012) / 0.012)));
  return <canvas ref={ref} class={'px-burst' + (p.class ? ' ' + p.class : '')} aria-hidden="true" style={`width:${size}px;height:${size}px;pointer-events:none;animation:pxBurstSpin ${secs}s linear infinite;${p.style ?? ''}`} />;
}
