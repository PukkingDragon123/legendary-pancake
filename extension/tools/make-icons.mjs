#!/usr/bin/env node
// Writes the extension's toolbar/store icons (icons/icon-{16,32,48,128}.png): Pip the owl's face
// in pixel art. No dependencies: the PNG is encoded here with node:zlib plus a CRC32 table.
//
//   node extension/tools/make-icons.mjs            # writes extension/icons/*.png
//   node extension/tools/make-icons.mjs --preview  # also writes icons/preview.png (all sizes, enlarged)
//
// Two hand-drawn sprites: a 16x16 face (used for 16 and 48 = 3x) and a 32x32 face (32 and 128 = 4x),
// so every size is an exact integer upscale and stays crisp. Only the left half of each face is
// drawn; the right half is mirrored, then a few deliberately asymmetric pixels (eye glints) go on top.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
  d: '#563130', // shadow brown
  b: '#77473a', // brown
  B: '#986246', // light brown
  h: '#b47d55', // highlight
  r: '#a9b8f0', // moonlight rim
  c: '#d9be93', // facial disc shade
  C: '#efdcb3', // facial disc
  W: '#fbf0d2', // facial disc light
  y: '#f5bd3e', // iris
  Y: '#d98e22', // iris shade
  p: '#1b1326', // pupil
  w: '#fffbe8', // glint
  k: '#f7c766', // beak light
  K: '#e6a23f', // beak
  q: '#b8742a', // beak shade
  s: '#e19a8e', // blush
  e: '#ceaa7e', // belly
  E: '#9a7253', // belly marks
};

// 16x16, left half (cols 0-7); col 7 sits next to the centre line.
const FACE16 = [
  '........',
  '.o......',
  '.oo.....',
  '.oho....',
  '.obhoooo',
  'obbbBBhh',
  'obcCCCcB',
  'ocCoooCb',
  'oCoyyyoB',
  'oCoypyok',
  'oCoYyYoK',
  'ocCoooCb',
  'obccCcbb',
  'odbbbbee',
  '.odbbeEe',
  '..oooooo',
];
// glints: [x, y] in the full sprite (not mirrored)
const GLINT16 = [[5, 8], [12, 8]];

// 32x32, left half (cols 0-15)
const FACE32 = [
  '................',
  '................',
  '..oo............',
  '..oho...........',
  '..ohho..........',
  '..obhho.........',
  '..obbhhooooooooo',
  '.obbbbBBBBhhhhhh',
  '.obbbBBBBBBBBBhh',
  'obbbcccccccbBBBB',
  'obbcCCCCCCCcbBBB',
  'obcCCCooooCCcbBB',
  'obcCCoyyyyoCCcbB',
  'obcCoyyyyyyoCCcb',
  'ocCCoyyppyyoCCcb',
  'ocCoyyppppyyoCcK',
  'ocCoyyppppyyoCck',
  'ocCoYyyppyyYoCck',
  'ocCCoYyyyyyoCCcK',
  'ocCCoYYyyYYoCCcq',
  'obcCCooooooCCcbq',
  'obbcCCCCCCCCcbbb',
  'obbbcccccccccbbb',
  'odbbbbbbbbbbbeee',
  'odbbbbbbbbbbeeee',
  'odbbbbbbbbbeeEee',
  '.odbbbbbbbbeEeee',
  '.odbbbbbbbeeeeEe',
  '..odbbbbbbeeEeee',
  '...oddbbbbeeeeee',
  '....oooooooooooo',
  '................',
];
const GLINT32 = [[9, 13], [10, 13], [9, 14], [24, 13], [25, 13], [24, 14]];

function sprite(half, glints) {
  const n = half.length;
  const rows = half.map((row) => {
    if (row.length !== n / 2) throw new Error(`row "${row}" should be ${n / 2} wide`);
    return (row + [...row].reverse().join('')).split('');
  });
  for (const [x, y] of glints) rows[y][x] = 'w';
  return rows;
}

function hexRGBA(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255, 255];
}

/** Upscale a sprite by an integer factor into RGBA bytes. */
function render(rows, scale) {
  const n = rows.length * scale;
  const out = new Uint8Array(n * n * 4);
  rows.forEach((row, y) =>
    row.forEach((ch, x) => {
      const col = PAL[ch];
      if (col === undefined) throw new Error(`unknown palette key "${ch}"`);
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
  const s32 = sprite(FACE32, GLINT32);
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
  const big = [render(sprite(FACE16, GLINT16), 12), render(sprite(FACE32, GLINT32), 8)];
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
