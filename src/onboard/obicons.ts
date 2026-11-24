// Hand-drawn pixel icons for the interview pages (stickers, cassette labels, mugs, the plan rows, the
// sheep mini-game), painted with pixart.ts in the calm palette. Every icon is outlined in ink and shaded
// with hard bands; round shapes are stepped pixel discs. No owls are drawn here: wherever the owl appears
// in the UI it is a render of the 3D model (src/ui/portraits.ts).
import { art, GRAPHITE, hash, INK, Pix, R, step, woodFill } from './pixart.ts';

type Draw = (p: Pix) => void;
const ICONS: Record<string, { w: number; h: number; draw: Draw; noOutline?: boolean }> = {};
const def = (name: string, w: number, h: number, draw: Draw, noOutline = false) => { ICONS[name] = { w, h, draw, noOutline }; };

/** Data URL of an icon (painted once). */
export function iconURL(name: string): string {
  const d = ICONS[name] ?? ICONS.star;
  return art('ic:' + name, () => {
    const p = new Pix(d.w + 2, d.h + 3);
    const inner = new Pix(d.w, d.h);
    d.draw(inner);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) { const c = inner.get(x, y); if (c) p.set(x + 1, y + 1, c, inner.a(x, y)); }
    if (!d.noOutline) p.outline(INK);
    return p.drop(1, 1);
  });
}
export const iconSize = (name: string) => { const d = ICONS[name] ?? ICONS.star; return { w: d.w + 2, h: d.h + 3 }; };

// shading helpers: a lit disc and a lit box (light from the upper left)
const litDisc = (p: Pix, cx: number, cy: number, rx: number, ry: number, r: string[], base = 3) =>
  p.disc(cx, cy, rx, ry, (nx, ny, x, y) => step(r, base + (-nx - ny) * 1.1 - (nx * nx + ny * ny > 0.75 ? 0.6 : 0), x, y, 0.5));
const litBox = (p: Pix, x0: number, y0: number, w: number, h: number, r: string[], base = 3) =>
  p.rect(x0, y0, w, h, (x, y) => r[Math.max(0, Math.min(5, Math.round(base + (y === y0 ? 1.6 : y === y0 + h - 1 ? -1.4 : 0) + (x === x0 ? 0.8 : x === x0 + w - 1 ? -0.8 : 0))))]);
const zz = (p: Pix, x: number, y: number, c: string) => { p.hline(x, x + 3, y, c); p.set(x + 2, y + 1, c); p.set(x + 1, y + 2, c); p.hline(x, x + 3, y + 3, c); };

// ------------------------------------------------------------------ goals

def('bed', 26, 22, (p) => {
  woodFill(p, 1, 6, 3, 15, R.woodDark, { along: 'y', seed: 2, base: 3 });
  woodFill(p, 22, 11, 3, 10, R.woodDark, { along: 'y', seed: 3, base: 3 });
  litDisc(p, 2.5, 6, 2, 2, R.brass); litDisc(p, 23.5, 11, 2, 2, R.brass);
  litBox(p, 4, 13, 18, 3, R.linen, 3.5);
  p.disc(8.5, 12, 4.4, 2.4, (nx, ny, x, y) => step(R.snow, 3.4 - ny * 1.2 - nx * 0.5, x, y));
  p.rect(10, 12, 12, 5, (x, y) => (((x >> 2) + (y >> 1)) % 2 ? R.sage[3] : R.rose[3]));
  p.hline(10, 21, 12, R.sage[5]); p.hline(10, 21, 16, R.sage[1]);
  p.rect(4, 17, 18, 2, R.woodDark[2]);
  zz(p, 15, 2, R.lake[4]); zz(p, 20, 0, R.lake[3]);
});
def('sheep', 26, 22, (p) => {
  p.rect(0, 19, 26, 3, (x, y) => step(R.moss, y === 19 ? 4 : 2.6 + hash(x, y) * 0.8, x, y));
  woodFill(p, 18, 8, 2, 11, R.woodLight, { along: 'y', seed: 5 }); p.rect(15, 10, 10, 2, R.woodLight[3]); p.rect(15, 15, 10, 2, R.woodLight[2]);
  for (const [cx, cy, r] of [[9, 9, 5], [5, 8, 3], [12, 7, 3], [7, 6, 3]] as [number, number, number][]) litDisc(p, cx, cy, r, r * 0.85, R.snow, 3.6);
  litDisc(p, 14.5, 9, 2.4, 2.6, R.soot, 2.6);
  p.set(15, 8, R.snow[5]);
  p.rect(6, 13, 1, 4, R.soot[1]); p.rect(11, 13, 1, 4, R.soot[1]);
  p.rect(5, 16, 2, 1, R.soot[0]); p.rect(11, 16, 2, 1, R.soot[0]);
});
def('sunrise', 24, 22, (p) => {
  p.rect(1, 1, 22, 20, (x, y) => (y < 7 ? R.blush[4] : y < 11 ? R.lamp[4] : R.honey[4]));
  litDisc(p, 12, 15, 5, 5, R.lamp, 4);
  p.rect(1, 14, 22, 7, (x, y) => step(R.sage, 3 - (y - 14) * 0.25 + Math.sin(x * 0.6) * 0.5, x, y));
  for (const [x, y] of [[5, 9], [19, 9], [12, 6], [8, 7], [16, 7]] as [number, number][]) p.set(x, y, R.ochre[4]);
  woodFill(p, 0, 0, 24, 2, R.wood, { seed: 1 }); woodFill(p, 0, 20, 24, 2, R.wood, { seed: 2 });
  woodFill(p, 0, 0, 2, 22, R.wood, { along: 'y', seed: 3 }); woodFill(p, 22, 0, 2, 22, R.wood, { along: 'y', seed: 4 });
  p.rect(11, 2, 2, 18, R.wood[3]); p.rect(2, 10, 20, 1, R.wood[2]);
});
def('clock', 22, 22, (p) => {
  litDisc(p, 11, 11, 10.5, 10.5, R.woodDark, 3.2);
  litDisc(p, 11, 11, 8.5, 8.5, R.brass, 3.6);
  litDisc(p, 11, 11, 7, 7, R.cream, 4.2);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.set(Math.round(10.5 + Math.sin(a) * 5.6), Math.round(10.5 - Math.cos(a) * 5.6), k % 3 ? GRAPHITE : INK); }
  p.line(11, 11, 11, 6, INK); p.line(11, 11, 14, 13, INK); p.set(11, 11, R.brass[1]);
  for (const [x, y] of [[1, 3], [0, 6], [20, 16], [21, 13]] as [number, number][]) p.set(x, y, R.lake[4]);
}, false);
def('phonedrawer', 26, 22, (p) => {
  woodFill(p, 0, 9, 26, 13, R.wood, { seed: 7, bevel: true });
  p.rect(3, 6, 20, 4, (x, y) => (y === 6 ? R.woodDeep[2] : R.woodDeep[1]));
  litBox(p, 6, 2, 14, 6, R.slate, 2.6); p.rect(7, 3, 12, 3, R.lake[3]); p.set(8, 3, R.mist[5]);
  litBox(p, 9, 13, 8, 3, R.brass, 3.4);
});
def('mic', 20, 24, (p) => {
  litBox(p, 4, 20, 12, 3, R.iron, 3); p.rect(9, 13, 2, 7, R.iron[3]); p.rect(5, 12, 10, 2, R.iron[3]);
  p.rect(5, 2, 10, 11, (x, y) => (y % 2 ? R.frost[2] : (x + y) % 3 ? R.frost[4] : R.frost[3]));
  p.rect(5, 2, 1, 11, R.frost[5]); p.rect(14, 2, 1, 11, R.frost[1]);
  p.rect(4, 7, 12, 2, R.brass[4]);
  for (const k of [0, 1]) { p.vline(1 - k, 4 + k, 10 - k, R.lake[4 - k]); p.vline(18 + k, 4 + k, 10 - k, R.lake[4 - k]); }
});

// ------------------------------------------------------------------ sounds to relax to

def('rain', 22, 22, (p) => {
  for (const [cx, cy, r] of [[7, 7, 4.5], [12, 5, 5], [16, 8, 4], [11, 9, 4]] as [number, number, number][]) litDisc(p, cx, cy, r, r * 0.8, R.mist, 3.4);
  for (let k = 0; k < 7; k++) { const x = 4 + k * 2.4, y = 14 + (k % 3) * 2; p.vline(Math.round(x), y, y + 2, R.lake[k % 2 ? 4 : 3]); }
});
def('waves', 24, 20, (p) => {
  p.rect(0, 0, 24, 8, R.mist[4]); litDisc(p, 18, 4, 2.6, 2.6, R.lamp, 4);
  for (let y = 8; y < 20; y++) for (let x = 0; x < 24; x++) {
    const crest = Math.sin(x * 0.55 + y * 0.9) > 0.75;
    p.set(x, y, crest ? R.snow[4] : step(R.lake, 3.6 - (y - 8) * 0.18, x, y));
  }
});
def('forest', 24, 22, (p) => {
  p.rect(0, 0, 24, 22, (x, y) => step(R.night, 2.4 + y * 0.06, x, y));
  litDisc(p, 18, 5, 3, 3, R.lamp, 4); litDisc(p, 19.5, 4, 2.4, 2.4, R.night, 2.4);
  for (const [cx, h] of [[5, 14], [11, 18], [17, 12]] as [number, number][]) {
    for (let y = 0; y < h; y++) { const w = Math.floor((y / h) * 5) + 1; p.hline(cx - w, cx + w, 22 - h + y - 1, step(R.pine, 3 + (y % 3 === 0 ? 1 : 0), cx, y)); }
  }
  for (const [x, y] of [[3, 3], [9, 2], [13, 6]] as [number, number][]) p.set(x, y, R.cream[5]);
});
def('fire', 22, 22, (p) => {
  p.poly([[11, 1], [16, 9], [17, 15], [5, 15], [6, 9]], R.ochre[4]);
  p.poly([[11, 5], [14, 11], [14, 15], [8, 15], [8, 11]], R.lamp[4]);
  p.poly([[11, 9], [12.5, 13], [9.5, 13]], R.cream[5]);
  for (let k = 0; k < 3; k++) { p.line(3 + k, 20 - k, 19 - k, 16 + k, R.woodDark[2 + k]); }
  p.line(3, 16, 19, 20, R.woodDark[3]);
});
def('stream', 24, 20, (p) => {
  p.rect(0, 0, 24, 20, (x, y) => step(R.moss, 3 + (hash(x >> 1, y, 3) - 0.5), x, y));
  for (let y = 0; y < 20; y++) { const c = 12 + Math.sin(y * 0.4) * 4; for (let x = Math.round(c - 4); x < c + 4; x++) p.set(x, y, (x + y * 3) % 7 === 0 ? R.snow[4] : R.lake[3 + ((x + y) % 3 === 0 ? 1 : 0)]); }
  litDisc(p, 5, 6, 2.6, 2, R.stone, 3.4); litDisc(p, 19, 14, 3, 2.2, R.stone, 3.4); litDisc(p, 12, 17, 2, 1.6, R.stone, 3.8);
});
def('wind', 24, 20, (p) => {
  const sw = (y: number, x0: number, x1: number, c: string) => { p.hline(x0, x1, y, c); p.set(x1 + 1, y - 1, c); p.set(x1 + 2, y - 2, c); p.set(x1 + 1, y - 3, c); p.set(x1, y - 3, c); };
  sw(6, 1, 13, R.mist[4]); sw(12, 4, 17, R.lake[4]); sw(17, 0, 10, R.mist[3]);
  p.poly([[17, 15], [22, 12], [23, 17], [19, 19]], R.ochre[4]); p.line(18, 18, 22, 13, R.ochre[2]);
});
def('radio', 24, 22, (p) => {
  woodFill(p, 1, 4, 22, 17, R.woodDark, { seed: 4, bevel: true });
  p.disc(12, 5, 11, 3.5, (nx, ny, x, y) => (ny < 0 ? step(R.woodDark, 3.6, x, y) : null));
  p.rect(4, 6, 10, 10, (x, y) => ((x + y) % 2 ? R.oat[3] : R.oat[2]));
  p.rect(16, 7, 5, 3, R.lamp[4]); p.set(18, 8, R.berry[3]);
  litDisc(p, 18.5, 14, 2, 2, R.brass); litDisc(p, 18.5, 18, 1.6, 1.6, R.brass);
});
def('lullaby', 24, 22, (p) => {
  woodFill(p, 1, 11, 22, 10, R.clay, { seed: 2, bevel: true });
  p.poly([[1, 11], [23, 11], [21, 3], [3, 3]], (x, y) => step(R.clay, 4 - (11 - y) * 0.1, x, y));
  p.rect(3, 4, 18, 6, R.mist[4]);
  p.rect(9, 13, 6, 3, R.ochre[4]);
  for (const [x, y] of [[16, 0], [20, 1]] as [number, number][]) { p.rect(x, y, 2, 2, R.dusk[4]); p.vline(x + 2, y - 2 < 0 ? 0 : y - 2, y + 1, R.dusk[4]); }
});
def('cricket', 24, 20, (p) => {
  p.rect(0, 15, 24, 5, (x, y) => step(R.moss, 3 + (y === 15 ? 1 : 0), x, y));
  for (let k = 0; k < 8; k++) p.vline(1 + k * 3, 11 + (k % 3), 15, R.fern[3 + (k % 2)]);
  litDisc(p, 11, 10, 5, 2.6, R.leaf, 3.4); litDisc(p, 16, 9, 2, 2, R.leaf, 3.6);
  p.line(17, 8, 22, 2, R.leaf[2]); p.line(16, 8, 19, 1, R.leaf[2]);
  p.line(8, 12, 5, 15, R.leaf[2]); p.line(12, 12, 14, 15, R.leaf[2]);
  p.set(17, 8, INK);
  litDisc(p, 4, 4, 2.4, 2.4, R.lamp, 4);
});
def('breath', 22, 20, (p) => {
  const curl = (cx: number, cy: number, r: number, c: string) => { for (let a = 0; a < 5.4; a += 0.18) { const rr = r * (1 - a / 8); p.set(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), c); } };
  p.hline(1, 14, 6, R.sage[4]); curl(15, 9, 3, R.sage[4]);
  p.hline(4, 17, 12, R.mist[4]); curl(18, 15, 3, R.mist[4]);
  p.poly([[2, 14], [8, 17], [3, 19]], R.sage[3]);
});
def('book', 24, 18, (p) => {
  p.poly([[1, 4], [12, 6], [12, 17], [1, 15]], (x, y) => (y % 2 && x > 2 && x < 11 ? R.paper[3] : R.paper[4]));
  p.poly([[12, 6], [23, 4], [23, 15], [12, 17]], (x, y) => (y % 2 && x > 13 && x < 22 ? R.paper[2] : R.paper[3]));
  p.vline(12, 6, 17, R.oat[1]);
  p.line(1, 16, 12, 18, R.berry[2]); p.line(12, 18, 23, 16, R.berry[2]);
  p.rect(16, 3, 2, 6, R.ochre[3]);
});

// ------------------------------------------------------------------ mugs (caffeine)

def('milkglass', 18, 26, (p) => {
  p.rect(3, 4, 12, 20, (x, y) => (x === 3 || x === 14 ? R.mist[2] : y < 7 ? R.mist[4] : x < 6 ? R.snow[5] : R.snow[4]));
  p.rect(4, 3, 10, 1, R.mist[5]); p.rect(4, 7, 10, 1, R.snow[5]);
  p.rect(5, 12, 8, 5, R.lake[3]); p.rect(6, 13, 6, 1, R.lake[5]);
  p.rect(3, 24, 12, 1, R.mist[1]);
});
def('mugsun', 26, 24, (p) => {
  litBox(p, 3, 4, 16, 19, R.terracotta, 3.2);
  p.rect(4, 4, 14, 2, R.soot[2]); p.rect(5, 5, 4, 1, R.ochre[3]);
  p.rect(19, 8, 4, 2, R.terracotta[3]); p.rect(21, 8, 2, 10, R.terracotta[2]); p.rect(19, 16, 4, 2, R.terracotta[2]);
  litDisc(p, 11, 14, 3.6, 3.6, R.lamp, 4.2);
  for (const [x, y] of [[11, 8], [11, 20], [5, 14], [17, 14], [7, 10], [15, 10], [7, 18], [15, 18]] as [number, number][]) p.set(x, y, R.lamp[4]);
});
def('mugmoon', 26, 24, (p) => {
  litBox(p, 3, 4, 16, 19, R.dusk, 3.0);
  p.rect(4, 4, 14, 2, R.soot[2]); p.rect(5, 5, 4, 1, R.ochre[3]);
  p.rect(19, 8, 4, 2, R.dusk[3]); p.rect(21, 8, 2, 10, R.dusk[2]); p.rect(19, 16, 4, 2, R.dusk[2]);
  litDisc(p, 10, 14, 4, 4, R.lamp, 4); litDisc(p, 12, 12.6, 3.4, 3.4, R.dusk, 3);
  for (const [x, y] of [[15, 9], [6, 19], [16, 18], [7, 8]] as [number, number][]) p.set(x, y, R.cream[5]);
});
def('steam', 12, 14, (p) => {
  for (let y = 0; y < 14; y++) { const x = Math.round(6 + Math.sin(y * 0.7) * 3); p.set(x, y, R.snow[5 - (y % 3 === 0 ? 1 : 0)], 200 - y * 8); p.set(x + 1, y, R.snow[3], 150 - y * 6); }
}, true);

// ------------------------------------------------------------------ phone sort

def('phone', 14, 24, (p) => {
  litBox(p, 0, 0, 14, 24, R.slate, 2.4);
  p.rect(2, 3, 10, 16, (x, y) => step(R.lake, 4 - y * 0.08, x, y));
  for (const [x, y, c] of [[3, 5, R.honey], [7, 5, R.rose], [3, 9, R.sage], [7, 9, R.lilac], [3, 13, R.lake]] as [number, number, string[]][]) p.rect(x, y, 3, 3, c[4]);
  p.rect(5, 20, 4, 2, R.slate[1]); p.set(3, 3, R.snow[5]);
});
def('drawer', 34, 24, (p) => {
  woodFill(p, 0, 0, 34, 24, R.wood, { seed: 9, bevel: true });
  p.rect(3, 3, 28, 7, R.woodDeep[1]); p.rect(4, 4, 26, 1, R.woodDeep[0]);
  woodFill(p, 2, 11, 30, 11, R.woodLight, { seed: 4, bevel: true });
  litBox(p, 12, 15, 10, 3, R.brass, 3.4);
});
def('nightstand', 30, 28, (p) => {
  woodFill(p, 1, 8, 28, 20, R.woodDark, { seed: 5, bevel: true });
  woodFill(p, 0, 6, 30, 3, R.wood, { seed: 2, bevel: true });
  p.rect(4, 12, 22, 6, R.woodDark[2]); litBox(p, 12, 14, 6, 2, R.brass, 3.4);
  litBox(p, 4, 1, 6, 5, R.lamp, 4); p.rect(6, 0, 2, 1, R.ochre[3]);
  litBox(p, 18, 3, 8, 3, R.dusk, 3); p.rect(19, 4, 6, 1, R.cream[4]);
});
def('pillowbed', 34, 22, (p) => {
  p.rect(0, 12, 34, 10, (x, y) => (((x >> 2) + (y >> 1)) % 2 ? R.sage[3] : R.rose[3]));
  p.hline(0, 33, 12, R.sage[5]);
  p.disc(17, 9, 15, 6, (nx, ny, x, y) => step(R.snow, 3.6 - ny * 1.2 - nx * 0.4, x, y));
  p.hline(5, 28, 9, R.snow[2]);
});

// ------------------------------------------------------------------ sky and time

def('sun', 20, 20, (p) => {
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; p.line(10 + Math.cos(a) * 6, 10 + Math.sin(a) * 6, 10 + Math.cos(a) * 9, 10 + Math.sin(a) * 9, R.ochre[4]); }
  litDisc(p, 10, 10, 5.5, 5.5, R.lamp, 4.2);
});
def('moon', 20, 20, (p) => {
  p.disc(10, 10, 8, 8, (nx, ny, x, y) => {
    const bite = Math.hypot(nx - 0.55, ny + 0.35) < 0.75;
    return bite ? null : step(R.lamp, 4 - nx * 0.8 - ny * 0.6, x, y);
  });
  p.set(6, 7, R.cream[2]); p.set(8, 13, R.cream[2]);
});
def('star', 12, 12, (p) => {
  p.poly([[6, 0], [7.6, 4.4], [12, 4.6], [8.6, 7.4], [9.8, 12], [6, 9.4], [2.2, 12], [3.4, 7.4], [0, 4.6], [4.4, 4.4]], (x, y) => (x + y < 10 ? R.lamp[5] : R.lamp[4]));
});
def('candle', 14, 24, (p) => {
  litBox(p, 4, 9, 6, 12, R.cream, 4);
  litBox(p, 0, 20, 14, 3, R.brass, 3.4);
  p.poly([[7, 1], [9.5, 6], [7, 9], [4.5, 6]], R.lamp[4]); p.poly([[7, 4], [8, 6.5], [7, 8], [6, 6.5]], R.cream[5]);
});
def('alarm', 22, 22, (p) => {
  litDisc(p, 5, 4, 3, 3, R.brass); litDisc(p, 17, 4, 3, 3, R.brass);
  litDisc(p, 11, 12, 8.5, 8.5, R.berry, 3.2); litDisc(p, 11, 12, 6.5, 6.5, R.cream, 4.2);
  p.line(11, 12, 11, 8, INK); p.line(11, 12, 14, 13, INK);
  p.line(5, 19, 3, 21, R.iron[2]); p.line(17, 19, 19, 21, R.iron[2]);
});
def('note', 18, 20, (p) => {
  p.rect(5, 2, 2, 13, INK); p.rect(14, 0, 2, 12, INK); p.rect(5, 1, 11, 3, INK);
  litDisc(p, 4, 15.5, 3.2, 2.6, R.dusk, 3.2); litDisc(p, 13, 12.5, 3.2, 2.6, R.dusk, 3.2);
});
def('shield', 20, 22, (p) => {
  p.poly([[1, 2], [10, 0], [19, 2], [18, 12], [10, 21], [2, 12]], (x, y) => step(R.moss, 3.6 - y * 0.06 - (x > 10 ? 0.6 : 0), x, y));
  p.poly([[4, 4], [10, 3], [16, 4], [15, 11], [10, 17], [5, 11]], (x, y) => step(R.sage, 4 - y * 0.05, x, y));
  litBox(p, 7, 8, 6, 5, R.iron, 3); p.rect(8, 5, 4, 3, null); p.vline(8, 5, 7, R.iron[3]); p.vline(11, 5, 7, R.iron[3]); p.hline(8, 11, 5, R.iron[4]);
});
def('pillow', 26, 14, (p) => {
  p.disc(13, 7, 12.5, 6, (nx, ny, x, y) => step(R.snow, 3.6 - ny * 1.4 - nx * 0.5, x, y));
  p.hline(4, 22, 7, R.snow[2]);
  for (const sx of [0, 25]) { p.set(sx, 3, R.snow[3]); p.set(sx, 11, R.snow[2]); }
});
// a sheep for the mini-game, two hop frames (no outline: drawn on a dark meadow)
for (const f of [0, 1]) def('sheepgame' + f, 22, 18, (p) => {
  for (const [cx, cy, r] of [[10, 8, 5.5], [6, 7, 3.4], [13, 6, 3.4], [8, 5, 3.4], [15, 9, 3]] as [number, number, number][]) litDisc(p, cx, cy, r, r * 0.85, R.snow, 3.6);
  litDisc(p, 18, 8, 2.6, 2.8, R.soot, 2.6); p.set(19, 7, R.snow[5]); p.set(16, 6, R.soot[2]);
  const legs = f ? [[6, 13, 5, 16], [9, 13, 8, 16], [13, 13, 15, 16], [15, 12, 17, 15]] : [[6, 13, 6, 17], [9, 13, 9, 17], [13, 13, 13, 17], [15, 12, 15, 17]];
  for (const [a, b, c, d] of legs) p.line(a, b, c, d, R.soot[1]);
}, false);
