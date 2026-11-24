// [ui4] Physical surfaces for the panels, painted with the relief painter at one art pixel per CSS pixel:
//   9-slice frames (shown with border-image, so they fit any size without repainting): a walnut cabinet
//   frame with mitred corners and brass corner plates, an oak notice-board frame, a walnut sign board, a
//   brass plate, a torn paper note, a tooled green-leather passport frame, a deckled blueprint edge;
//   seamless material tiles (lit, periodic): draped plum velvet, cork, cyanotype blueprint paper with its
//   chalk grid, pebbled green leather; and small parts: a red pushpin, a brass thumbtack, masking tape,
//   a brass hanging rail.
// installSurfaces() writes one <style> that dresses the app's classes in them.
import { pfbm, pnoise } from '../px/materials.js';
import {
  and, clamp, disc, dome, flat, hash, hex, leatherGrain, MAT, metal, mix, not, PAL, paperGrain, poly, rampAt, rect, Relief, ring, rrect, seg,
  slab, solid, torus, tubeX, woodGrain, type RGB,
} from '../px/relief.ts';
import { cachedRelief } from './objects.ts';

const brass = (o: Parameters<typeof metal>[1] = {}) => metal(PAL.brass, { base: 0.62, ...o });

function screw(r: Relief, x: number, y: number, rad = 1.6) {
  r.fill(disc(x, y, rad), dome(x, y, rad, rad, 1.6, 0), brass({ base: 0.64 }), MAT.brass, { id: 90, add: true });
  r.carve(seg(x - rad * 0.7, y + rad * 0.3, x + rad * 0.7, y - rad * 0.3, 0.4), () => -1.2);
}

/** a dark translucent band inside a frame's opening (the frame's cast shadow on what it holds) */
function innerShadow(c: HTMLCanvasElement, t: number, depth = 4) {
  const g = c.getContext('2d')!;
  for (let i = 0; i < depth; i++) {
    g.fillStyle = `rgba(26, 12, 6, ${0.34 - i * 0.075})`;
    g.fillRect(t, t + i, c.width - 2 * t, 1);            // under the top rail
    g.fillRect(t + i, t + i + 1, 1, c.height - 2 * t - i - 1); // beside the left stile
  }
}

// ------------------------------------------------------------------ 9-slice frames

export interface Nine { url: string; s: number; w: number; h: number }
const nine = (key: string, w: number, h: number, s: number, paint: () => string): Nine => ({ url: cachedRelief('9:' + key, paint), s, w, h });

/**
 * A cabinet frame: walnut rails and stiles (grain along each piece), mitred corners, a rounded outer bevel and
 * a moulded inner edge, brass corner plates; the opening is clear. `t` = rail width (px).
 */
export function cabinetFrame(wood: 'walnut' | 'oak' | 'cherry' = 'walnut', t = 14, plates = true): Nine {
  const W = 112, H = 112, s = t + 4;
  return nine(`cab:${wood}:${t}:${plates}`, W, H, s, () => {
    const r = new Relief(W, H, 1, 1), R = PAL[wood];
    const inOpen = (x: number, y: number) => x >= t && y >= t && x < W - t && y < H - t;
    const along = (x: number, y: number) => { const dx = Math.min(x, W - x), dy = Math.min(y, H - y); return dy < dx ? 'x' : 'y'; };
    const rail = woodGrain(R, { seed: 3, base: 0.52, scale: 2 }), stile = woodGrain(R, { seed: 4, base: 0.5, scale: 2, along: 'y' });
    r.fill((x, y) => !inOpen(x, y), (x, y) => {
      // a rounded outer bevel, a moulded inner edge stepping down to the opening, a groove along the middle
      const d = Math.min(x, y, W - x, H - y);
      const out = clamp(d / 3.4), inn = clamp((t - d) / 3);
      return 2 + 5 * Math.sqrt(out) * Math.sqrt(inn) + (Math.abs(d - t * 0.45) < 0.8 ? -0.9 : 0);
    }, (x, y, mx, my) => (along(x, y) === 'x' ? rail : stile)(x, y, mx, my), MAT.varnish, { id: 1 });
    // mitre seams in the corners
    r.carve((x, y) => !inOpen(x, y) && (Math.abs(x - y) < 0.6 || Math.abs((W - x) - y) < 0.6 || Math.abs(x - (H - y)) < 0.6 || Math.abs((W - x) - (H - y)) < 0.6) && Math.min(x, W - x) < t && Math.min(y, H - y) < t, () => -1.4);
    if (plates) for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]] as [number, number, number, number][]) {
      const L = t + 6, B = 6;
      const sh = poly([[cx, cy], [cx + sx * L, cy], [cx + sx * L, cy + sy * B], [cx + sx * B, cy + sy * B], [cx + sx * B, cy + sy * L], [cx, cy + sy * L]]);
      r.fill(sh, (x, y) => 8 + 1.2 * clamp(Math.min(Math.abs(x - cx), Math.abs(y - cy)) / 2.4) - (Math.max(Math.abs(x - cx), Math.abs(y - cy)) > L - 1.2 ? 0.6 : 0), brass({ base: 0.64, patina: 0.25 }), MAT.brass, { id: 2, seam: true });
      screw(r, cx + sx * (L - 3.4), cy + sy * 3, 1.6); screw(r, cx + sx * 3, cy + sy * (L - 3.4), 1.6); screw(r, cx + sx * 3, cy + sy * 3, 1.4);
    }
    const c = r.canvas();
    innerShadow(c, t, 5);
    return c.toDataURL('image/png');
  });
}

/** A thin picture-frame moulding (opening clear): oak, polished brass or dark iron, `t` px wide. */
export function thinFrame(kind: 'oak' | 'walnut' | 'brass' | 'iron', t = 7): Nine {
  const W = 64, H = 64, s = t + 2;
  return nine(`thin:${kind}:${t}`, W, H, s, () => {
    const r = new Relief(W, H, 1, 1);
    const inOpen = (x: number, y: number) => x >= t && y >= t && x < W - t && y < H - t;
    const prof = (x: number, y: number) => { const d = Math.min(x, y, W - x, H - y); return 1 + 3.4 * Math.sin(clamp(d / t) * Math.PI) ** 0.7; };
    const A = kind === 'brass' ? metal(PAL.brass, { base: 0.66, brush: 'x' }) : kind === 'iron' ? metal(PAL.iron, { base: 0.5 }) : (x: number, y: number, mx: number, my: number) => woodGrain(PAL[kind], { seed: 9, base: 0.56, scale: 2, along: Math.min(y, H - y) < Math.min(x, W - x) ? 'x' : 'y' })(x, y, mx, my);
    r.fill((x, y) => !inOpen(x, y), prof, A, kind === 'brass' ? MAT.brass : kind === 'iron' ? MAT.iron : MAT.varnish, { id: 1 });
    r.carve((x, y) => !inOpen(x, y) && (Math.abs(x - y) < 0.5 || Math.abs((W - x) - y) < 0.5 || Math.abs(x - (H - y)) < 0.5 || Math.abs((W - x) - (H - y)) < 0.5) && Math.min(x, W - x) < t && Math.min(y, H - y) < t, () => -1);
    const c = r.canvas();
    innerShadow(c, t, 3);
    return c.toDataURL('image/png');
  });
}

/** A walnut sign board (filled), for little signs and labels: grain along its length, bevelled, two brass screws. */
export function signBoard(wood: 'walnut' | 'oak' = 'walnut'): Nine {
  const W = 72, H = 36, s = 10;
  return nine('sign:' + wood, W, H, s, () => {
    const r = new Relief(W, H, 1, 1);
    r.fill(rrect(0, 0, W, H, 2), slab(0, 0, W, H, 6, 3.2), woodGrain(PAL[wood], { seed: 7, base: 0.52, scale: 2 }), MAT.varnish, { id: 1 });
    screw(r, 5, 5); screw(r, W - 5, 5); screw(r, 5, H - 5); screw(r, W - 5, H - 5);
    return r.url();
  });
}

/** A brass plate (filled), bevelled, engraved border and four screws. */
export function brassPlate(): Nine {
  const W = 48, H = 28, s = 7;
  return nine('plate', W, H, s, () => {
    const r = new Relief(W, H, 1, 1);
    r.fill(rrect(0, 0, W, H, 2), slab(0, 0, W, H, 4, 2.4), brass({ base: 0.66, brush: 'x', patina: 0.12 }), MAT.brass, { id: 1 });
    r.carve(and(rrect(3, 3, W - 6, H - 6, 1), not(rrect(4, 4, W - 8, H - 8, 1))), () => -0.8);
    return r.url();
  });
}

/** A sheet of note paper with torn, deckled edges and a soft curl shadow (filled). */
export function paperNote(tint: 'cream' | 'blue' | 'yellow' = 'cream', seed = 1): Nine {
  const W = 64, H = 64, s = 9;
  const R = tint === 'yellow' ? [hex('#a88a3a'), hex('#d4b860'), hex('#ecd486'), hex('#f6e6a8'), hex('#fdf3cc')] : tint === 'blue' ? [hex('#8296a8'), hex('#b4c4d0'), hex('#d4e0e8'), hex('#e8f0f4'), hex('#f6fafc')] : PAL.paper;
  return nine(`note:${tint}:${seed}`, W, H, s, () => {
    const r = new Relief(W, H, 1, 1);
    const edge = (x: number, y: number) => {
      const d = Math.min(x, y, W - x, H - y), j = hash(Math.floor(x), Math.floor(y), seed) * 1.2 + (pnoise(x / 3, y / 3, 64, 64, seed) - 0.5) * 1.4;
      return d > 1.2 + j;
    };
    r.fill(edge, (x, y) => 1 + Math.min(1.6, Math.min(x, y, W - x, H - y) * 0.3), paperGrain(R, { seed, base: 0.7 }), MAT.paper, { id: 1 });
    const c = r.canvas({ outline: false });
    const g = c.getContext('2d')!;
    // a thin warm edge line, and the curl's shadow under the bottom-right corner
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(120, 84, 40, 0.18)'; g.fillRect(0, H - 5, W, 5); g.fillRect(W - 5, 0, 5, H);
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = 'rgba(30, 14, 6, 0.32)'; g.fillRect(3, 3, W - 1, H - 1);
    return c.toDataURL('image/png');
  });
}

/** A tooled leather frame (filled with leather; the opening shows what's inside): stitched, with a gilt fillet. */
export function leatherFrame(hue: 'emerald' | 'leather' | 'sapphire' = 'emerald', t = 14): Nine {
  const W = 96, H = 96, s = t + 2;
  return nine(`lth:${hue}:${t}`, W, H, s, () => {
    const r = new Relief(W, H, 1, 1), R = PAL[hue];
    const inOpen = (x: number, y: number) => x >= t && y >= t && x < W - t && y < H - t;
    r.fill((x, y) => !inOpen(x, y), (x, y) => { const d = Math.min(x, y, W - x, H - y); return 2 + 3 * Math.sqrt(clamp(d / 3)) + (d > t - 2 ? -1 : 0); }, leatherGrain(R, { seed: 5, base: 0.5 }), MAT.leather, { id: 1 });
    // a running stitch 4 px in, and a gilt fillet inside it
    const st = (x: number, y: number) => { const d = Math.min(x, y, W - 1 - x, H - 1 - y); return d >= 3.6 && d < 4.6 && ((Math.floor(x) + Math.floor(y)) % 5 < 3); };
    r.paint(st, solid(hex('#f0dca8')), MAT.cloth); r.carve(st, () => -0.4);
    const gilt = (x: number, y: number) => { const d = Math.min(x, y, W - 1 - x, H - 1 - y); return d >= t - 5 && d < t - 4; };
    r.paint(gilt, metal(PAL.gold, { base: 0.62 }), MAT.brass); r.carve(gilt, () => -0.5);
    const c = r.canvas();
    innerShadow(c, t, 4);
    return c.toDataURL('image/png');
  });
}

// ------------------------------------------------------------------ seamless tiles (periodic, lit)

type TileFn = (x: number, y: number) => { h: number; c: RGB; spec?: number; sheen?: number };
const LIGHT = (() => { const v = [-0.52, -0.62, 0.58]; const n = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / n); })();
/** paint a seamless N x N tile, lit from the top left like the relief objects (periodic normals) */
function tile(key: string, N: number, f: TileFn): string {
  return cachedRelief('tile:' + key, () => {
    const H = new Float32Array(N * N), C: RGB[] = new Array(N * N), S = new Float32Array(N * N), V = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const o = f(x + 0.5, y + 0.5); H[y * N + x] = o.h; C[y * N + x] = o.c; S[y * N + x] = o.spec ?? 0; V[y * N + x] = o.sheen ?? 0; }
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d')!, img = g.createImageData(N, N), d = img.data;
    const at = (x: number, y: number) => H[((y + N) % N) * N + ((x + N) % N)];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let nx = -(at(x + 1, y) - at(x - 1, y)) / 2, ny = -(at(x, y + 1) - at(x, y - 1)) / 2, nz = 1;
      const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      const f2 = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / 0.58;
      const q = Math.floor(f2 * 5 + 0.5 + (((x & 1) ^ (y & 1)) ? 0.2 : -0.2)) / 5;
      const i = y * N + x, a = C[i];
      const k = 0.36 + 0.64 * q;
      const spec = S[i] && nz > 0.97 && nx < -0.05 ? S[i] : 0;
      const sheen = V[i] * (1 - nz) * 3;
      d[i * 4] = clamp(a[0] * k * 1.03 + spec * 90 + sheen * 70, 0, 255); d[i * 4 + 1] = clamp(a[1] * k + spec * 86 + sheen * 64, 0, 255); d[i * 4 + 2] = clamp(a[2] * k * 0.96 + spec * 70 + sheen * 80, 0, 255); d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
}

/** Draped velvet: soft vertical folds, a fine pile, a sheen on the fold crests. */
export function velvetTile(hue: 'plum' | 'emerald' | 'sapphire' | 'leather' = 'plum'): string {
  const N = 96, R = PAL[hue];
  return tile('velvet:' + hue, N, (x, y) => {
    const fold = Math.sin((x / N) * Math.PI * 2 * 3 + Math.sin((y / N) * Math.PI * 2) * 0.6) * 2.4 + Math.sin((x / N) * Math.PI * 2 * 5 + 1.3) * 0.8;
    const pile = (pnoise(x / 2, y / 6, N / 2, N / 6, 3) - 0.5) * 0.12;
    return { h: fold, c: rampAt(R, clamp(0.52 + pile + fold * 0.03)), sheen: 0.5 };
  });
}
/** Linen: an even weave with slubs (the backing inside display frames). */
export function linenTile(): string {
  const N = 32, R = PAL.linen;
  return tile('linen', N, (x, y) => {
    const X = Math.floor(x), Y = Math.floor(y), w = ((X + Y) & 1) ? 0.4 : -0.4;
    const slub = hash(Y, 0, 3) > 0.86 ? 0.05 : hash(X, 1, 3) > 0.9 ? -0.04 : 0;
    return { h: w * 0.5, c: rampAt(R, clamp(0.72 + slub + w * 0.04 + (pnoise(x / 8, y / 8, N / 8, N / 8, 2) - 0.5) * 0.06)) };
  });
}
/** A short length of brass rod, tiling along x (12 px tall). */
export function railTile(): string {
  return cachedRelief('railtile', () => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 12;
    const g = c.getContext('2d')!;
    const rows = ['#1e1206', '#fff1bd', '#f6dc7f', '#e8c24e', '#d4a432', '#b88524', '#94661a', '#6e4a12', '#1e1206'];
    rows.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, 2 + i, 16, 1); });
    g.fillStyle = 'rgba(30, 14, 6, 0.35)'; g.fillRect(0, 11, 16, 1);
    for (let x = 0; x < 16; x += 4) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, 3, 2, 1); }
    return c.toDataURL('image/png');
  });
}

/** Wall planks (a cabinet's back): boards 32 px tall with a seam, grain along x, periodic so it tiles. */
export function plankTile(wood: 'walnut' | 'oak' = 'walnut', dark = 0.38): string {
  const N = 128, M = 64, R = PAL[wood];
  return cachedRelief(`plank:${wood}:${dark}`, () => {
    const c = document.createElement('canvas'); c.width = N; c.height = M;
    const g = c.getContext('2d')!, img = g.createImageData(N, M), d = img.data;
    for (let y = 0; y < M; y++) for (let x = 0; x < N; x++) {
      const plank = Math.floor(y / 32), py = y % 32, seed = plank * 7 + 3;
      const warp = (pnoise(x / 24, py / 10 + plank * 3, N / 24, 64, seed) - 0.5) * 6;
      const ring = Math.sin((py + warp) * 1.2), streak = (pnoise(x / 40, py / 3 + plank * 9, N / 40, 64, seed + 2) - 0.5) * 0.3;
      let v = dark + (ring > 0.7 ? -0.1 : ring < -0.5 ? 0.04 : 0) + streak + (hash(x >> 2, y, seed) > 0.95 ? -0.06 : 0);
      if (py === 0) v = dark - 0.3; else if (py === 1) v = dark + 0.12; else if (py === 31) v = dark - 0.16; // the seam: a dark gap, a lit edge
      const col = rampAt(R, clamp(v)), i = (y * N + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  });
}

/** Cork: pressed granules, light and dark, each a tiny lit bump. */
export function corkTile(): string {
  const N = 64, R = [hex('#5a3418'), hex('#7c4c24'), hex('#9c6634'), hex('#b8804a'), hex('#d09c64'), hex('#e2b884')];
  return tile('cork', N, (x, y) => {
    const g1 = pnoise(x / 1.6, y / 1.6, N / 1.6, N / 1.6, 7), g2 = pnoise(x / 4, y / 4, N / 4, N / 4, 9);
    const dark = hash(Math.floor(x), Math.floor(y), 4) > 0.93 ? -0.3 : 0;
    return { h: g1 * 2 + g2 * 1.2, c: rampAt(R, clamp(0.32 + g1 * 0.4 + g2 * 0.25 + dark)) };
  });
}
/** Cyanotype blueprint paper: prussian blue with a cloudy wash and fibres, a chalk grid (fine 8 px, bold 32 px). */
export function blueprintTile(): string {
  const N = 64, R = [hex('#0e2a4a'), hex('#14365e'), hex('#1a4372'), hex('#235386'), hex('#2e6498')], chalk = hex('#e8f0f4');
  return tile('bp', N, (x, y) => {
    const wash = pfbm(x, y, N, N, 32, 3, 5), fib = pnoise(x / 9, y / 1.4, N / 9, N / 1.4, 8) > 0.84 ? 0.08 : 0;
    let c = rampAt(R, clamp(0.35 + (wash - 0.5) * 0.5 + fib));
    const X = Math.floor(x), Y = Math.floor(y);
    if (X % 32 === 0 || Y % 32 === 0) c = mix(c, chalk, 0.42 - (hash(X, Y, 2) > 0.85 ? 0.15 : 0));
    else if (X % 8 === 0 || Y % 8 === 0) c = mix(c, chalk, 0.13);
    return { h: (wash - 0.5) * 0.6, c };
  });
}
/** Pebbled leather (passport covers). */
export function leatherTile(hue: 'emerald' | 'leather' | 'sapphire' = 'emerald'): string {
  const N = 64, R = PAL[hue];
  return tile('lt:' + hue, N, (x, y) => {
    const peb = pnoise(x / 1.8, y / 1.8, N / 1.8, N / 1.8, 11), mott = pfbm(x, y, N, N, 32, 2, 12);
    return { h: peb * 1.6, c: rampAt(R, clamp(0.42 + (peb - 0.5) * 0.14 + (mott - 0.5) * 0.24)), spec: 0.3 };
  });
}

// ------------------------------------------------------------------ small parts

/** An enamel pushpin seen from above-front (18 x 20 px): a domed head on a collar, its steel point. */
export function pushpin(hue: 'rose' | 'sapphire' | 'emerald' | 'gold' = 'rose'): string {
  return cachedRelief('pin:' + hue, () => {
    const r = new Relief(18, 20, 1, 1), R = PAL[hue];
    r.fill(seg(10, 12, 12.5, 19, 0.8), flat(1), metal(PAL.iron, { base: 0.75 }), MAT.iron, { id: 1 });
    r.fill(and(disc(9, 12, 6), (_x: number, y: number) => y > 9), dome(9, 12, 6, 4, 2.4, 2), solid(rampAt(R, 0.55)), { spec: 0.9, shin: 40, env: 0.2, bands: 6 }, { id: 2, seam: true });
    r.fill(disc(9, 8, 5), dome(9, 8, 5, 5, 4.6, 3), solid(rampAt(R, 0.7)), { spec: 1, shin: 50, env: 0.25, bands: 6 }, { id: 3, seam: true });
    return r.url();
  });
}
/** A brass drawing-pin (16 x 16 px): a domed, spun-brass head with a little boss. */
export function thumbtack(): string {
  return cachedRelief('tack', () => {
    const r = new Relief(16, 16, 1, 1);
    r.fill(disc(7.5, 7.5, 6.6), dome(7.5, 7.5, 6.6, 6.6, 2.6, 1), brass({ base: 0.68, brush: 'r', cx: 7.5, cy: 7.5 }), MAT.brass, { id: 1 });
    r.carve(ring(7.5, 7.5, 4.6, 5.2), () => -0.6);
    r.fill(disc(7.5, 7.5, 2), dome(7.5, 7.5, 2, 2, 1.4, 3.4), brass({ base: 0.78 }), MAT.brass, { id: 2, seam: true });
    return r.url();
  });
}
/** A strip of masking tape (w x 14 px): crinkled, translucent edges, torn ends. */
export function tape(w = 52): string {
  return cachedRelief('tape:' + w, () => {
    const H = 14, r = new Relief(w, H, 1, 1);
    const torn = (x: number, y: number) => x > 1 + hash(0, Math.floor(y), 3) * 2 && x < w - 1 - hash(1, Math.floor(y), 3) * 2 && y > 1 && y < H - 1;
    r.fill(torn, (x, y) => 1 + Math.sin(x * 0.9 + y * 0.3) * 0.25, (_x, _y, mx, my) => rampAt([hex('#b49a68'), hex('#d4bf90'), hex('#e8d8b0'), hex('#f2e6c8')], clamp(0.62 + (pnoise(mx / 3, my / 2, 64, 64, 4) - 0.5) * 0.25 + (Math.floor(mx) % 6 === 0 ? -0.08 : 0))), MAT.paper, { id: 1 });
    const c = r.canvas({ outline: false });
    const g = c.getContext('2d')!;
    // tape is a little see-through
    const im = g.getImageData(0, 0, w, H);
    for (let i = 3; i < im.data.length; i += 4) if (im.data[i]) im.data[i] = 226;
    g.putImageData(im, 0, 0);
    return c.toDataURL('image/png');
  });
}
/** A brass hanging rail (w x 12 px) with turned end brackets: the wardrobe's rod. */
export function brassRail(w: number): string {
  return cachedRelief('rail:' + w, () => {
    const H = 12, r = new Relief(w, H, 1, 1);
    r.fill(rect(4, 4, w - 8, 4.4), tubeX(6.2, 2.2, 3), brass({ base: 0.66, brush: 'x' }), MAT.brass, { id: 1 });
    for (const x of [0, w - 7]) {
      r.fill(rect(x, 0, 7, 12), (xx, y) => 4 + 1.6 * Math.sin(clamp((xx - x) / 7) * Math.PI) - Math.abs(y - 6) * 0.1, woodGrain(PAL.walnut, { seed: x, base: 0.5, scale: 2, along: 'y' }), MAT.varnish, { id: 2, seam: true });
      r.fill(disc(x + 3.5, 6.2, 2.6), dome(x + 3.5, 6.2, 2.6, 2.6, 1.6, 6), brass({ base: 0.7 }), MAT.brass, { id: 3, seam: true });
    }
    return r.url();
  });
}

// ------------------------------------------------------------------ CSS

/** CSS for a 9-slice frame on an element (border-image at one art pixel per CSS pixel) */
export const b9 = (n: Nine, fill = false, rep: 'stretch' | 'round' = 'stretch') => `border:${n.s}px solid transparent;border-image:url("${n.url}") ${n.s} ${fill ? 'fill ' : ''}/ ${n.s}px ${rep};image-rendering:pixelated`;
let done = false;
/** Dress the app's panels in the physical surfaces (call once at boot, after the pixel skin). */
export function installSurfaces() {
  if (done || typeof document === 'undefined') return;
  done = true;
  const cab = cabinetFrame('walnut', 14), sign = signBoard('walnut'), plate = brassPlate(), note = paperNote('cream', 2);
  const css = `
/* every sheet is a walnut cabinet with brass corners, its parchment inside */
.sheet.sheet{${b9(cab)};background:var(--parch-tile) 0 0/128px 128px,#f0e2c0;background-clip:padding-box}
.sheet.sheet .grab{display:none}
.sheet.sheet .sheet-head{padding-top:2px}
/* carved signs, and dark walnut cabinets with plank backs */
.hh-wood-sm.hh-wood-sm,.hh-wood.hh-wood{${b9(sign, true)};background:none}
.hh-wood-dark.hh-wood-dark,.hh-wood-dark-sm.hh-wood-dark-sm{${b9(cab)};background:url("${plankTile('walnut', 0.34)}") 0 0/128px 64px;background-clip:padding-box}
/* the quest board: an oak-framed cork board with pinned notes */
.sheet.qb{${b9(cabinetFrame('oak', 14))};background:url("${corkTile()}") 0 0/64px 64px;background-clip:padding-box}
.sheet.qb .sheet-head h2,.sheet.qb .sheet-head .muted{color:#fff4dc;text-shadow:2px 2px 0 #2a1408,-1px 0 0 #2a1408,0 -1px 0 #2a1408}
.sheet.qb .quest.card{${b9(note, true, 'round')};background:none;padding:4px 6px 6px 4px}
.sheet.qb .quest.card::before{content:'';position:absolute;left:50%;top:-16px;width:18px;height:20px;margin-left:-9px;background:url("${pushpin('rose')}") 0 0/18px 20px;image-rendering:pixelated;z-index:2;filter:drop-shadow(2px 2px 0 rgba(30,14,6,.4))}
.sheet.qb .quest.card:nth-child(2n){transform:rotate(-0.6deg)}
.sheet.qb .quest.card:nth-child(2n+1){transform:rotate(0.5deg)}
.sheet.qb .quest.card:nth-child(2n)::before{background-image:url("${pushpin('sapphire')}")}
.sheet.qb .quest.card:nth-child(3n)::before{background-image:url("${pushpin('emerald')}")}
.sheet.qb > .sheet-body > p{color:#fff4dc;text-shadow:1px 1px 0 #2a1408,-1px 0 0 #2a1408}
.sheet.qb .quest.claimed{${b9(paperNote('yellow', 5), true, 'round')}}
/* on wide screens the side cabinets can stand taller: the owl stays in view on the left */
@media (min-width: 900px) { .sheet.short.wd, .sheet.short.qb { max-height: calc(100% - 120px); } }
/* a brass plate (labels, small panels) */
.hh-brass-plate{${b9(plate, true)};background:none}
`;
  const st = document.createElement('style');
  st.id = 'hh-surfaces';
  st.textContent = css;
  document.head.appendChild(st);
}
