// [profile] The neighbours' portraits: they are characters, not people, so they get a different kind of picture from
// the owls: an old-fashioned cut-paper silhouette (a profile in black paper, a little proud of a cream laid-paper
// ground) in a turned ebony ring with a gilt bead, like the silhouettes in a parlour. Painted by the material painter
// (src/ui/real/paint.ts) at device resolution, lit from the upper left like everything else.
import { GOLD, Real, cached, circle, clamp, deviceK, hex, metal, mix, paperMat, polygon, ring, toURL, wood, type Material, type RGB, type SDF } from '../real/paint.ts';
import type { Critter } from '../../game/social.ts';

/** SVG-like path commands in a 100 x 100 box, facing left: M x y, C x1 y1 x2 y2 x y, L x y */
type Cmd = ['M' | 'L', number, number] | ['C', number, number, number, number, number, number];
function sample(cmds: Cmd[], step = 2.2): [number, number][] {
  const out: [number, number][] = [];
  let x = 0, y = 0;
  for (const c of cmds) {
    if (c[0] === 'M') { x = c[1]; y = c[2]; out.push([x, y]); continue; }
    if (c[0] === 'L') { x = c[1]; y = c[2]; out.push([x, y]); continue; }
    const [, x1, y1, x2, y2, x3, y3] = c as ['C', number, number, number, number, number, number];
    const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    const n = Math.max(3, Math.ceil(len / step));
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
    x = x3; y = y3;
  }
  return out;
}
/** spines along a curve: a zigzag of `n` points stepping out by `h` from the line between a and b, bulging up */
function spines(ax: number, ay: number, bx: number, by: number, n: number, h: number, bulge: number): Cmd[] {
  const out: Cmd[] = [];
  for (let i = 1; i <= n * 2; i++) {
    const t = i / (n * 2), x = ax + (bx - ax) * t, y = ay + (by - ay) * t - Math.sin(t * Math.PI) * bulge;
    const nx = -(by - ay), ny = bx - ax, l = Math.hypot(nx, ny), k = i % 2 ? h : 0;
    out.push(['L', x + (nx / l) * -k * 0.6 + (bx - ax) / (n * 4), y + (ny / l) * -k]);
  }
  return out;
}

const PROFILES: Record<Critter, Cmd[]> = {
  // a round, chubby beaver: a blunt muzzle with a big nose, two front teeth, a little round ear, a thick neck
  beaver: [
    ['M', 6, 100], ['C', 8, 86, 14, 78, 16, 72], ['C', 12, 70, 12, 66, 15, 64], ['L', 14, 61], ['L', 11, 61], ['L', 11, 57],
    ['C', 6, 56, 3, 51, 5, 46], ['C', 7, 41, 12, 40, 15, 40], ['C', 18, 31, 28, 24, 40, 21], ['C', 46, 18, 52, 18, 56, 19],
    ['C', 57, 13, 65, 11, 68, 16], ['C', 70, 19, 69, 22, 67, 24], ['C', 76, 30, 80, 40, 80, 50], ['C', 84, 62, 92, 74, 97, 100],
  ],
  // a hedgehog: a long pointed snout with a button nose, a small round ear, a crest of spines over the back
  hedgehog: [
    ['M', 10, 100], ['C', 14, 88, 20, 80, 22, 72], ['C', 16, 69, 10, 66, 6, 62], ['C', 2, 61, 1, 56, 5, 55],
    ['C', 12, 52, 20, 46, 26, 40], ['C', 28, 34, 32, 32, 36, 33], ['C', 37, 29, 42, 28, 43, 32],
    ...spines(43, 30, 96, 72, 11, 9, 22),
    ['L', 98, 100],
  ],
  // a fox: two tall pointed ears, a long narrow snout, a ruff of fur at the chest
  fox: [
    ['M', 12, 100], ['L', 18, 92], ['L', 12, 88], ['L', 19, 82], ['L', 14, 77], ['C', 20, 72, 22, 68, 22, 64],
    ['C', 14, 62, 8, 60, 4, 57], ['C', 0, 56, 1, 51, 5, 51], ['C', 14, 49, 24, 44, 30, 36], ['L', 34, 6], ['L', 48, 30],
    ['L', 52, 29], ['L', 62, 4], ['L', 64, 34], ['C', 72, 42, 76, 52, 80, 62], ['C', 86, 74, 92, 86, 96, 100],
  ],
  // a badger: a long wedge of a head running down to the nose, a small rounded ear, heavy shoulders
  badger: [
    ['M', 8, 100], ['C', 12, 88, 18, 80, 20, 74], ['C', 14, 70, 8, 66, 4, 64], ['C', 0, 63, 1, 58, 5, 58],
    ['C', 18, 52, 32, 40, 50, 32], ['C', 54, 26, 62, 24, 64, 30], ['C', 74, 34, 84, 44, 88, 56], ['C', 94, 70, 98, 84, 99, 100],
  ],
  // a hare: two long ears straight up, a round head and a short soft muzzle
  hare: [
    ['M', 12, 100], ['C', 16, 88, 22, 80, 24, 74], ['C', 18, 72, 14, 68, 12, 62], ['C', 8, 60, 7, 55, 11, 53],
    ['C', 16, 46, 22, 42, 30, 39], ['C', 28, 26, 26, 12, 30, 3], ['C', 34, -1, 38, 2, 40, 10], ['C', 42, 20, 42, 30, 42, 36],
    ['L', 47, 35], ['C', 48, 22, 50, 10, 56, 3], ['C', 60, -1, 63, 3, 62, 10], ['C', 60, 22, 56, 32, 54, 38],
    ['C', 66, 44, 72, 54, 76, 64], ['C', 84, 76, 92, 88, 96, 100],
  ],
};

const D = 40; // design units across the cameo
const C = D / 2, R0 = 13.6, R1 = 19.2;

/** A neighbour's silhouette portrait at `px` CSS px across (a data URL). */
export function cameoArt(critter: Critter, px = 48): string {
  return cached(`cameo1:${critter}:${px}`, () => {
    const k = (px / D) * deviceK(3);
    const r = new Real(D, D, k, 0);
    // the ground: cream laid paper, a touch darker towards the rim
    const paper: Material = { ...paperMat('paper', { scale: 1.2 }), alb: (x, y) => { const d = Math.hypot(x - C, y - C) / R0; const b = mix(hex('#f4ead2'), hex('#d9c59c'), clamp(d * d * 0.7)); const lines = (Math.sin(y * 5.2) + 1) * 2.2; return [b[0] - lines, b[1] - lines, b[2] - lines] as RGB; } };
    r.part(circle(C, C, R0 + 0.6), 0.2, paper);
    // the cut black paper, proud of the ground by its thickness, sized and placed so the shoulders run off the bottom
    const pts = sample(PROFILES[critter]).map(([x, y]): [number, number] => [C - R0 * 0.95 + x * 0.27, C - R0 * 0.88 + y * 0.268]);
    const sil: SDF = polygon(pts);
    const inside: SDF = (x, y) => Math.max(sil(x, y), Math.hypot(x - C, y - C) - (R0 + 0.3));
    inside.bb = [C - R0, C - R0, C + R0, C + R0];
    r.part(inside, 0.55, { alb: () => hex('#18141a'), spec: 0.12, shin: 10, diffuse: 0.6 });
    // the turned ebony ring and its gilt bead
    const rm = (R0 + R1) / 2, hw = (R1 - R0) / 2;
    r.part(ring(C, C, R0, R1), (x, y) => 0.8 + 2.4 * Math.sqrt(Math.max(0, 1 - ((Math.hypot(x - C, y - C) - rm) / hw) ** 2)), wood('ebony', { along: 'x', scale: 4 }));
    r.part(ring(C, C, R0 - 0.2, R0 + 1), (x, y) => 1.4 + 0.9 * Math.sqrt(Math.max(0, 1 - ((Math.hypot(x - C, y - C) - (R0 + 0.4)) / 0.6) ** 2)), metal(GOLD, { polish: 0.85 }), { line: true });
    r.carve(ring(C, C, R1 - 1.6, R1 - 1.3), 0.4, 0.3);
    return toURL(r.canvas({ shadow: { dy: 0.8, blur: 1.4, a: 0.42 }, ambient: 0.5, aoR: 1.4 }));
  });
}
