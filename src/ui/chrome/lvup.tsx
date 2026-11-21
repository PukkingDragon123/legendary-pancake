// Level-up pieces: a rotating arcane rune circle that draws itself in, painted per texel.
import { useEffect, useRef } from 'preact/hooks';
import { clockNow } from './pxanim.tsx';

const GLYPHS = [['#.#', '.#.', '#.#'], ['##.', '#..', '##.'], ['.#.', '##.', '.#.'], ['#..', '##.', '#..'], ['###', '.#.', '.#.'], ['#.#', '###', '...'], ['.#.', '###', '.#.'], ['##.', '.#.', '##.'], ['#.#', '#.#', '.#.'], ['###', '#.#', '...'], ['.##', '.#.', '##.'], ['#..', '.#.', '..#']];

/** A magic circle `n` texels across (3 CSS px each) that draws itself in over `drawMs`. */
export function RuneCircle(p: { n?: number; drawMs?: number; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const N = p.n ?? 120, S = p.scale ?? 3;
  useEffect(() => {
    const cv = ref.current!;
    cv.width = N; cv.height = N;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(N, N), d = img.data;
    const t0 = clockNow(), c = (N - 1) / 2;
    let raf = 0, last = 0;
    const put = (x: number, y: number, col: number[], a = 255) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= N || y >= N) return; const i = (y * N + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = Math.max(d[i + 3], a); };
    const VIO = [143, 107, 255], CY = [127, 227, 255], WH = [240, 252, 255], DIM = [74, 52, 150], GOLD = [255, 216, 106];
    const ring = (r: number, upto: number, rot: number, col: number[], dash = 0) => {
      const steps = Math.ceil(r * 7);
      for (let i = 0; i < steps * upto; i++) {
        const a = (i / steps) * Math.PI * 2 + rot;
        if (dash && Math.floor(i / dash) % 2) continue;
        put(c + Math.cos(a) * r, c + Math.sin(a) * r, col);
      }
    };
    const line = (x0: number, y0: number, x1: number, y1: number, col: number[], upto = 1) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * upto);
      const L = Math.hypot(x1 - x0, y1 - y0) || 1;
      for (let i = 0; i <= n; i++) put(x0 + ((x1 - x0) * i) / L, y0 + ((y1 - y0) * i) / L, col);
    };
    const frame = (now0: number) => {
      raf = requestAnimationFrame(frame);
      if (now0 - last < 45) return;
      last = now0;
      const t = (clockNow() - t0) / 1000, k = Math.min(1, (t * 1000) / (p.drawMs ?? 900));
      d.fill(0);
      const R = c - 2;
      ring(R, k, -Math.PI / 2, VIO);
      ring(R - 2, k, -Math.PI / 2 + t * 0.5, DIM, 3);
      ring(R - 14, Math.max(0, k * 1.4 - 0.3), Math.PI / 2 - t * 0.3, CY, 2);
      ring(R - 16, Math.max(0, k * 1.4 - 0.3), Math.PI / 2, VIO);
      // lit arcs chasing round the outer ring
      for (let j = 0; j < 3; j++) { const a0 = t * 1.6 + (j * Math.PI * 2) / 3; for (let i = 0; i < 10; i++) { const a = a0 + i * 0.03; put(c + Math.cos(a) * R, c + Math.sin(a) * R, i > 6 ? WH : CY); } }
      // runes between the rings, appearing in turn
      const G = GLYPHS.length;
      for (let i = 0; i < G; i++) {
        if (i / G > k) continue;
        const a = (i / G) * Math.PI * 2 - Math.PI / 2 + t * 0.25, r = R - 8;
        const gx = c + Math.cos(a) * r - 1, gy = c + Math.sin(a) * r - 1;
        const lit = Math.floor(t * 6) % G === i;
        GLYPHS[i].forEach((row, y) => { for (let x = 0; x < 3; x++) if (row[x] === '#') put(gx + x, gy + y, lit ? WH : CY); });
      }
      // two counter-rotating triangles (a six-point star)
      if (k > 0.5) {
        const up = Math.min(1, (k - 0.5) * 2.2), r = R - 18;
        for (const [rot, col] of [[t * 0.4, GOLD], [-t * 0.4 + Math.PI, VIO]] as [number, number[]][]) {
          const pts = [0, 1, 2].map((i) => [c + Math.cos(rot + (i * Math.PI * 2) / 3 - Math.PI / 2) * r, c + Math.sin(rot + (i * Math.PI * 2) / 3 - Math.PI / 2) * r]);
          for (let i = 0; i < 3; i++) line(pts[i][0], pts[i][1], pts[(i + 1) % 3][0], pts[(i + 1) % 3][1], col, up);
        }
      }
      // sparkles
      for (let i = 0; i < 8; i++) {
        const a = i * 2.39996 + t * 0.7, r = (R - 4) * (0.3 + ((i * 0.37 + t * 0.2) % 0.7));
        if ((Math.floor(t * 8) + i) % 4 === 0) { const x = c + Math.cos(a) * r, y = c + Math.sin(a) * r; put(x, y, WH); put(x - 1, y, CY, 160); put(x + 1, y, CY, 160); put(x, y - 1, CY, 160); put(x, y + 1, CY, 160); }
      }
      g.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [N]);
  return <canvas ref={ref} class="lvup-circle" style={{ width: `${N * S}px`, height: `${N * S}px`, filter: 'drop-shadow(0 0 6px rgba(127,227,255,.65))' }} aria-hidden="true" />;
}
