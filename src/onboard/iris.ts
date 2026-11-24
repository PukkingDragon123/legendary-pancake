// Pixel transitions for the interview. `iris` closes the screen down to a stepped pixel circle around a point
// (Pip's face), holds while `mid` swaps the scene, then opens again; every texel is decided by a hard test, so
// the edge is a staircase with a lamp-gold rim (no anti-aliasing). `cutWipe` is a quick ordered-dither
// dissolve over the 3D view for the camera's hard cuts. Both live on canvases at a few CSS px per texel.
import { P, hex, mixc } from '../gfx/palette.ts';

const K = 5; // css px per iris texel
const DARK = hex(mixc(P.deepNight, P.woodDeep, 0.25));
const RIM = hex(P.lamp), RIM2 = hex(P.ochre);
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export function iris(at: () => { x: number; y: number }, mid: () => void | Promise<void>, o: { close?: number; open?: number; hold?: number } = {}): Promise<void> {
  const cv = document.createElement('canvas');
  cv.className = 'ob-iris';
  Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', zIndex: '120', pointerEvents: 'auto', imageRendering: 'pixelated' });
  document.body.appendChild(cv);
  const W = Math.ceil(innerWidth / K), H = Math.ceil(innerHeight / K);
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(W, H), d = img.data;
  const dk = rgb(DARK), rm = rgb(RIM), rm2 = rgb(RIM2);
  const maxR = Math.hypot(W, H);
  const draw = (cx: number, cy: number, r: number) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), i = (y * W + x) * 4;
      if (dist < r) { d[i + 3] = 0; continue; }
      const c = dist < r + 1 ? rm : dist < r + 2 ? rm2 : dk;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  };
  const anim = (ms: number, f: (k: number) => void) => new Promise<void>((res) => {
    const t0 = performance.now();
    const stepf = () => { const k = Math.min(1, (performance.now() - t0) / ms); f(k); if (k < 1) requestAnimationFrame(stepf); else res(); };
    stepf();
  });
  // stepped easing: the radius moves in whole texels, a few at a time, like a hand-animated iris
  const ease = (k: number) => k * k * (3 - 2 * k);
  return (async () => {
    await anim(o.close ?? 900, (k) => { const p = at(); draw(p.x / K, p.y / K, Math.round(maxR * (1 - ease(k)) / 2) * 2); });
    await new Promise((r) => setTimeout(r, o.hold ?? 220));
    await mid();
    await new Promise((r) => setTimeout(r, 120));
    await anim(o.open ?? 1000, (k) => draw(W / 2, H * 0.46, Math.round(maxR * ease(k) / 2) * 2));
    cv.remove();
  })();
}

/** A quick ordered-dither dissolve from dark to clear over `host` (the camera's hard cuts). */
export function cutWipe(host: HTMLCanvasElement | null, ms = 300) {
  if (!host) return;
  const k = 6, W = Math.ceil(host.clientWidth / k) || 1, H = Math.ceil(host.clientHeight / k) || 1;
  host.width = W; host.height = H;
  const g = host.getContext('2d')!;
  const img = g.createImageData(W, H), d = img.data, c = rgb(DARK);
  const t0 = performance.now();
  const frame = () => {
    const t = Math.min(1, (performance.now() - t0) / ms);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // a diagonal sweep plus a Bayer threshold: the dark breaks up into a checker as it clears
      const sweep = (x / W) * 0.35 + (1 - y / H) * 0.15;
      const on = BAYER[((y & 3) << 2) | (x & 3)] > t * 1.5 - sweep;
      const i = (y * W + x) * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = on ? 255 : 0;
    }
    g.putImageData(img, 0, 0);
    if (t < 1) requestAnimationFrame(frame); else g.clearRect(0, 0, W, H);
  };
  frame();
}
