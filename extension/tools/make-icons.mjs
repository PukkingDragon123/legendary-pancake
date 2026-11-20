#!/usr/bin/env node
// Writes the extension's toolbar/store icons (icons/icon-{16,32,48,128}.png): Pip the Meowl (a
// kitten's head on a little barn owl's body) in pixel art. No dependencies: the PNG is encoded here
// with node:zlib plus a CRC32 table. Output is deterministic.
//
//   node extension/tools/make-icons.mjs            # writes extension/icons/*.png
//   node extension/tools/make-icons.mjs --preview  # also writes icons/preview.png (all sizes, enlarged)
//
// Two sprites, so every size is an exact integer upscale and stays crisp:
// - 16x16 (used for 16 and 48 = 3x): a hand-drawn face. Only the left half is drawn; the right half is
//   mirrored, then the eye catch-lights go on top (same corner on both eyes, so not mirrored).
// - 32x32 (used for 32 and 128 = 4x): cropped from lib/owl.js, the same Pip the bedtime page draws.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pipFrame } from '../lib/owl.js';

// ---- PNG encoder -------------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** RGBA bytes (w*h*4) -> PNG file bytes (8-bit truecolour + alpha, filter 0 on every row). */
export function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- art ---------------------------------------------------------------------------------------

const PAL = {
  '.': null,
  o: '#1b1326', // outline
  f: '#c4935f', // tabby fur
  F: '#d6a874', // fur, lit
  L: '#e6c08e', // fur highlight
  g: '#a57548', // fur shade
  G: '#835a3a', // fur deep shade
  s: '#6a4a33', // tabby stripe
  p: '#f2a7b0', // inner ear
  P: '#d98892', // inner ear shade
  W: '#fffdf8', // white blaze / muzzle
  V: '#e6ded0', // white, shaded
  n: '#f39aa5', // nose
  m: '#7a5646', // mouth
  e: '#16131b', // eye
  w: '#ffffff', // catch-light
  b: '#f4a3a8', // blush
};

// 16x16 Meowl face, left half (cols 0-7); col 7 sits next to the centre line.
const FACE16 = [
  '........',
  '.o......',
  '.oo.....',
  '.opo....',
  '.oppoooo',
  '.ofpsFsL',
  'offfsFFW',
  'offeeffW',
  'ofseeffW',
  'ofbffWWn',
  'oWWfWmWm',
  'offfWWmW',
  'ogffVWWW',
  '.ogfVWWW',
  '..oggVVV',
  '...ooooo',
];
// catch-lights: the same (top-left) corner of each eye, so not mirrored
const GLINT16 = [[3, 7], [11, 7]];

function sprite(half, glints) {
  const n = half.length;
  const rows = half.map((row) => {
    if (row.length !== n / 2) throw new Error(`row "${row}" should be ${n / 2} wide`);
    return (row + [...row].reverse().join('')).split('');
  });
  for (const [x, y] of glints) rows[y][x] = 'w';
  return rows.map((r) => r.map((ch) => {
    const c = PAL[ch];
    if (c === undefined) throw new Error(`unknown palette key "${ch}"`);
    return c;
  }));
}

/** 32x32: the head and shoulders of the same Pip the bedtime page draws (eyes open, no moon rim). */
function sprite32() {
  const f = pipFrame({ eyes: 'open', breath: 0, branch: false, rim: false });
  let top = f.h;
  for (let i = 0; i < f.px.length; i++) if (f.px[i]) top = Math.min(top, Math.floor(i / f.w));
  const X0 = 33; // the figure is centred on column 48: crop 33..64
  const rows = [];
  for (let y = top; y < top + 32; y++) {
    const row = [];
    for (let x = X0; x < X0 + 32; x++) row.push(f.px[y * f.w + x] ?? null);
    rows.push(row);
  }
  return rows;
}

function hexRGBA(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
}

/** Upscale a sprite (rows of '#rrggbb' or null) by an integer factor into RGBA bytes. */
function render(rows, scale) {
  const n = rows.length * scale;
  const out = new Uint8Array(n * n * 4);
  rows.forEach((row, y) =>
    row.forEach((col, x) => {
      if (!col) return;
      const rgba = hexRGBA(col);
      for (let yy = 0; yy < scale; yy++)
        for (let xx = 0; xx < scale; xx++) out.set(rgba, ((y * scale + yy) * n + x * scale + xx) * 4);
    }),
  );
  return { size: n, rgba: out };
}

export function icons() {
  const s16 = sprite(FACE16, GLINT16);
  const s32 = sprite32();
  return {
    16: render(s16, 1),
    32: render(s32, 1),
    48: render(s16, 3),
    128: render(s32, 4),
  };
}

function preview(set) {
  // night-blue strip with every size at 1x and enlarged, plus a light strip for toolbar contrast
  const pad = 16;
  const items = [16, 32, 48, 128].map((k) => set[k]);
  const big = [render(sprite(FACE16, GLINT16), 12), render(sprite32(), 8)];
  const all = [...items, ...big];
  const W = all.reduce((a, it) => a + it.size + pad, pad);
  const H = (Math.max(...all.map((it) => it.size)) + pad * 2) * 2;
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) out.set(y < H / 2 ? [16, 21, 52, 255] : [238, 230, 214, 255], (y * W + x) * 4);
  for (const band of [0, 1]) {
    let x0 = pad;
    for (const it of all) {
      const y0 = band * (H / 2) + pad;
      for (let y = 0; y < it.size; y++)
        for (let x = 0; x < it.size; x++) {
          const i = (y * it.size + x) * 4;
          if (it.rgba[i + 3]) out.set(it.rgba.subarray(i, i + 4), ((y0 + y) * W + x0 + x) * 4);
        }
      x0 += it.size + pad;
    }
  }
  return encodePNG(W, H, out);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = join(here, '..', 'icons');
  mkdirSync(outDir, { recursive: true });
  const set = icons();
  for (const [size, img] of Object.entries(set)) {
    const file = join(outDir, `icon-${size}.png`);
    writeFileSync(file, encodePNG(img.size, img.size, img.rgba));
    console.log('wrote', file);
  }
  const pv = process.argv.indexOf('--preview');
  if (pv !== -1) {
    const file = process.argv[pv + 1] && !process.argv[pv + 1].startsWith('--') ? process.argv[pv + 1] : join(outDir, 'preview.png');
    writeFileSync(file, preview(set));
    console.log('wrote', file);
  }
}
