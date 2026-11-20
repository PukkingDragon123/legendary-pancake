// Pip the owl, drawn pixel by pixel. Builds small sprite frames (arrays of colours) that pages blit
// onto a low-resolution canvas and scale up with `image-rendering: pixelated`.
//
// Lighting: moonlight from the upper right (cool rim light), warm bounce from below. Shapes are
// analytic (ellipses + hand-placed details), shaded with a 4-step ramp and light 2x2 dithering,
// then outlined against empty space only, which is how hand-made sprites tend to be built.

export const OWL_W = 96;
export const OWL_H = 64;

const C = {
  outline: '#1b1326',
  body: ['#3a2232', '#563130', '#77473a', '#986246', '#b47d55'],
  rim: '#a3b1ea',
  rimSoft: '#7c7fb8',
  disc: ['#b99a77', '#d9be93', '#efdcb3', '#fbf0d2'],
  belly: ['#b48d66', '#ceaa7e', '#e2c597'],
  chevron: '#9a7253',
  wing: ['#3f2630', '#55332f', '#6f4636', '#8c5d42'],
  wingSpot: '#d9bd92',
  lid: '#2a1a2e',
  lash: '#4a3040',
  blush: '#e19a8e',
  beak: ['#b8742a', '#e6a23f', '#f7c766'],
  feet: ['#a76d29', '#e0a446'],
  iris: ['#d98e22', '#f5bd3e'],
  pupil: '#1b1326',
  glint: '#fffbe8',
  bark: ['#2c1b1c', '#3f2a25', '#56392d', '#6e4c38'],
  barkRim: '#7f8bc2',
  leaf: ['#1f3a39', '#2f5449', '#467559', '#6c9a6b'],
  leafRim: '#a6c7a0',
};

const BAYER2 = [
  [0.25, 0.75],
  [1.0, 0.5],
];

/** 0..1 value -> ramp index with a little ordered dithering at band edges. */
function rampIdx(v, n, x, y, strength = 0.55) {
  const d = (BAYER2[y & 1][x & 1] - 0.625) * strength;
  return Math.max(0, Math.min(n - 1, Math.floor(v * n + d)));
}

class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.c = new Array(w * h).fill(null);
    this.k = new Array(w * h).fill(null);
  }
  in(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  set(x, y, color, kind = 'owl') {
    if (!this.in(x, y)) return;
    this.c[y * this.w + x] = color;
    this.k[y * this.w + x] = kind;
  }
  get(x, y) {
    return this.in(x, y) ? this.c[y * this.w + x] : null;
  }
  kind(x, y) {
    return this.in(x, y) ? this.k[y * this.w + x] : null;
  }
}

/**
 * @param {{ breath?: 0|1, eyes?: 'closed'|'open'|'blink', branch?: boolean, oy?: number }} [opts]
 * @returns {{ w: number, h: number, px: (string|null)[] }}
 */
export function owlFrame(opts = {}) {
  const breath = opts.breath ?? 0;
  const eyes = opts.eyes ?? 'closed';
  const withBranch = opts.branch ?? true;
  const OY = opts.oy ?? 8; // vertical offset so there's sky above the tufts for drifting Zzz
  const g = new Grid(OWL_W, OWL_H);

  const cx = 48.5; // odd-width body: column 48 is the centre line, x mirrors to 96 - x
  const feetY = 44 + OY; // first row of the branch top surface
  const ry = 14 + breath * 0.6;
  const cy = feetY - 0.4 - ry;
  const top = cy - ry;
  const lift = breath; // features ride up 1px on the in-breath

  // light from upper right and a little in front
  const L = norm3(0.42, -0.6, 0.68);

  // ---- branch (behind the feet) ------------------------------------------------------------
  if (withBranch) drawBranch(g, feetY);

  // ---- body ----------------------------------------------------------------------------------
  const rxAt = (dy) => 13.2 + 1.4 * Math.max(-0.45, dy / ry); // a touch pear-shaped
  const inBody = (x, y) => {
    const dy = y + 0.5 - cy;
    const dx = x + 0.5 - cx;
    return (dx / rxAt(dy)) ** 2 + (dy / ry) ** 2 <= 1;
  };
  for (let y = 0; y < OWL_H; y++) {
    for (let x = 0; x < OWL_W; x++) {
      if (!inBody(x, y)) continue;
      const dy = y + 0.5 - cy;
      const dx = x + 0.5 - cx;
      const rx = rxAt(dy);
      const nx = dx / rx;
      const ny = dy / ry;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let v = 0.16 + 0.84 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      if (ny > 0.55) v -= 0.5 * (ny - 0.55); // tucked under
      g.set(x, y, C.body[rampIdx(clamp01(v), C.body.length, x, y, 0.35)]);
    }
  }
  const bodyTop = (x) => {
    for (let y = 0; y < OWL_H; y++) if (inBody(x, y)) return y;
    return OWL_H;
  };

  // ---- ear tufts: little wedges leaning outwards, rooted in the head -----------------------
  for (const side of [-1, 1]) {
    const tipX = side < 0 ? 38 : 58;
    for (let i = 0; i < 6; i++) {
      const x = tipX - side * i;
      const y0 = Math.round(top - 3.5 + i * 0.9) - lift;
      const y1 = bodyTop(x) + 1;
      for (let y = y0; y <= y1; y++) {
        const edge = y === y0;
        const shade = side > 0 ? (edge ? 4 : 3) : edge ? 2 : 1 + (i > 2 ? 1 : 0);
        if (g.kind(x, y) === 'owl' && y > y0 + 1) continue; // keep the body's own shading
        g.set(x, y, C.body[shade]);
      }
    }
  }
  // crown feather marks
  for (const [x, dy] of [[45, 3], [48, 2], [51, 3]]) {
    const y = Math.round(top) + dy - lift;
    if (g.get(x, y)) g.set(x, y, C.body[4]);
    if (g.get(x - 1, y + 1)) g.set(x - 1, y + 1, C.body[3]);
    if (g.get(x + 1, y + 1)) g.set(x + 1, y + 1, C.body[3]);
  }

  // ---- folded wings: darker crescents down each side with feather-tip notches ------------
  for (const side of [-1, 1]) {
    const wcx = cx + side * 9.6;
    const wcy = cy + 4.5;
    const wrx = 5.2;
    const wry = 10;
    for (let y = Math.floor(wcy - wry); y <= Math.ceil(wcy + wry); y++) {
      for (let x = Math.floor(wcx - wrx); x <= Math.ceil(wcx + wrx); x++) {
        if (g.kind(x, y) !== 'owl') continue;
        const dx = (x + 0.5 - wcx) / wrx;
        const dy = (y + 0.5 - wcy) / wry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const inner = side < 0 ? dx > 0.35 : dx < -0.35; // edge facing the belly
        let v = (side > 0 ? 0.62 : 0.34) - 0.28 * dy;
        if (inner && d > 0.45) v += 0.3; // lit leading edge
        let idx = rampIdx(clamp01(v), C.wing.length, x, y, 0.3);
        g.set(x, y, C.wing[idx], 'wing');
      }
    }
    // a few soft spots, staggered like real wing coverts
    for (const [dx, dy] of [[-1, -4], [1, -2], [-1, 0], [1, 2], [0, 4]]) {
      const x = Math.round(wcx + side * dx);
      const y = Math.round(wcy + dy);
      if (g.kind(x, y) === 'wing') g.set(x, y, C.wingSpot, 'wing');
    }
    // feather tips at the bottom of the wing
    for (let i = 0; i < 3; i++) {
      const x = Math.round(wcx + side * (i * 2 - 1));
      const y = Math.round(wcy + wry - 2 - i * 0.6);
      if (g.kind(x, y) === 'wing') g.set(x, y, C.wing[0], 'wing');
    }
  }

  // ---- belly with neat chevrons --------------------------------------------------------------
  const bcy = cy + 7.5;
  for (let y = Math.floor(bcy - 8); y <= Math.ceil(bcy + 8); y++) {
    for (let x = 39; x <= 58; x++) {
      const dx = (x + 0.5 - cx) / 7.0;
      const dy = (y + 0.5 - bcy) / 7.6;
      if (dx * dx + dy * dy > 1 || g.kind(x, y) !== 'owl') continue;
      const v = 0.7 - 0.45 * dy + 0.15 * dx;
      g.set(x, y, C.belly[rampIdx(clamp01(v), C.belly.length, x, y, 0.25)], 'belly');
    }
  }
  for (let r = 0; r < 4; r++) {
    const y = Math.round(bcy - 3 + r * 3);
    const off = r % 2 ? 2 : 0;
    for (let x = 43 + off; x <= 55; x += 4) {
      if (g.kind(x, y) !== 'belly' || g.kind(x - 1, y - 1) !== 'belly' || g.kind(x + 1, y - 1) !== 'belly') continue;
      g.set(x, y, C.chevron, 'belly');
      g.set(x - 1, y - 1, C.chevron, 'belly');
      g.set(x + 1, y - 1, C.chevron, 'belly');
    }
  }

  // ---- facial disc (two soft goggles) ------------------------------------------------------
  const eyeY = Math.round(top) + 11 - lift;
  for (const ex of [44.0, 53.0]) {
    for (let y = eyeY - 6; y <= eyeY + 6; y++) {
      for (let x = Math.floor(ex - 6); x <= Math.ceil(ex + 6); x++) {
        const dx = x + 0.5 - ex;
        const dy = y + 0.5 - (eyeY + 0.5);
        const d = Math.hypot(dx, dy * 1.06);
        if (d > 5.2 || !g.get(x, y)) continue;
        const v = 0.95 - 0.12 * d + 0.06 * (dx * (ex < 48 ? -1 : 1)) - 0.05 * dy;
        const idx = d > 4.4 ? 0 : rampIdx(clamp01(v), C.disc.length, x, y, 0.35);
        g.set(x, y, C.disc[Math.max(idx, d > 4.4 ? 0 : 1)], 'disc');
      }
    }
  }

  // ---- eyes ---------------------------------------------------------------------------------
  if (eyes === 'open') {
    for (const ex of [44.0, 53.0]) {
      for (let y = eyeY - 3; y <= eyeY + 3; y++) {
        for (let x = Math.floor(ex - 3); x <= Math.ceil(ex + 3); x++) {
          const d = Math.hypot(x + 0.5 - ex, y + 0.5 - (eyeY + 0.5));
          if (d > 3.1) continue;
          g.set(x, y, d > 2.4 ? C.lid : C.iris[y < eyeY ? 0 : 1], 'eye');
        }
      }
      const px = Math.round(ex) - 1;
      g.set(px, eyeY, C.pupil, 'eye');
      g.set(px + 1, eyeY, C.pupil, 'eye');
      g.set(px, eyeY + 1, C.pupil, 'eye');
      g.set(px + 1, eyeY + 1, C.pupil, 'eye');
      g.set(px + 1, eyeY - 1, C.glint, 'eye');
    }
  } else {
    // sleepy closed eyes: a soft downward curve, lids slightly heavier for 'blink'
    const arc = [
      [-3, -1],
      [-2, 0], [-1, 0], [0, 0], [1, 0],
      [2, -1],
    ];
    for (const [ex, sgn] of [[44, -1], [52, 1]]) {
      for (const [dx, dy] of arc) {
        const x = sgn < 0 ? ex + dx : ex - dx; // mirror
        g.set(x, eyeY + dy, C.lid, 'eye');
      }
      // a tiny lash at the outer corner
      const outer = sgn < 0 ? ex - 4 : ex + 4;
      g.set(outer, eyeY, C.lash, 'eye');
      if (eyes === 'blink') for (const dx of [-1, 0]) g.set(sgn < 0 ? ex + dx : ex - dx, eyeY - 1, C.lash, 'eye');
    }
  }

  // ---- beak + blush -------------------------------------------------------------------------
  const by = eyeY + 2;
  g.set(47, by, C.beak[1], 'beak');
  g.set(48, by, C.beak[2], 'beak');
  g.set(49, by, C.beak[1], 'beak');
  g.set(48, by + 1, C.beak[1], 'beak');
  g.set(48, by + 2, C.beak[0], 'beak');
  for (const x of [40, 41, 55, 56]) g.set(x, by + 1, C.blush, 'disc');

  // ---- feet gripping the branch -------------------------------------------------------------
  for (const fx of [44, 52]) {
    const toes = fx < 48 ? [fx - 1, fx + 1, fx + 3] : [fx - 3, fx - 1, fx + 1];
    for (let x = toes[0]; x <= toes[2]; x++) g.set(x, feetY - 1, C.feet[1], 'feet');
    for (const x of toes) g.set(x, feetY, C.feet[0], 'feet');
  }

  // ---- outline against empty space, then a cool moonlight rim on the upper right ----------
  const out = g.c.slice();
  for (let y = 0; y < OWL_H; y++) {
    for (let x = 0; x < OWL_W; x++) {
      if (g.get(x, y)) continue;
      const n = [g.kind(x - 1, y), g.kind(x + 1, y), g.kind(x, y - 1), g.kind(x, y + 1)];
      if (n.some((k) => k && k !== 'leafless')) out[y * OWL_W + x] = C.outline;
    }
  }
  for (let y = 0; y < OWL_H; y++) {
    for (let x = 0; x < OWL_W; x++) {
      const k = g.kind(x, y);
      if (!k || k === 'eye' || k === 'beak' || k === 'feet') continue;
      const emptyUR = !g.get(x + 1, y) || !g.get(x, y - 1);
      if (!emptyUR) continue;
      if (k === 'bark') {
        const thin = g.kind(x, y + 2) !== 'bark';
        if (!g.get(x, y - 1)) out[y * OWL_W + x] = thin || x % 7 === 3 ? C.bark[3] : x % 7 === 0 ? C.rimSoft : C.barkRim;
      } else if (k === 'leaf') {
        if (!g.get(x + 1, y) && !g.get(x, y - 1)) out[y * OWL_W + x] = C.leafRim;
      } else if (x + 0.5 > cx + 2 && y < cy + 6) {
        const strong = !g.get(x + 1, y - 1) && y < cy - 2;
        out[y * OWL_W + x] = strong ? C.rim : C.rimSoft;
      }
    }
  }
  return { w: OWL_W, h: OWL_H, px: out };
}

function drawBranch(g, topY) {
  const topAt = (x) => topY + Math.round(1.4 * Math.sin((x - 48) / 15) + (x < 24 ? (24 - x) * 0.08 : 0));
  const thick = (x) => (x < 70 ? 7 - Math.floor(x / 30) : Math.max(3, 7 - Math.floor(x / 30) - Math.floor((x - 70) / 5)));
  const END = 86;
  for (let x = 0; x <= END; x++) {
    const t = topAt(x);
    const th = thick(x);
    for (let y = t; y < t + th; y++) {
      const v = 0.95 - (y - t) / th;
      let idx = rampIdx(clamp01(v), C.bark.length, x, y, 0.4);
      // long bark grain: dark streaks that run along the branch
      if (y > t && y < t + th - 1 && (Math.floor(x / 5) + y) % 4 === 0 && x % 5 !== 0) idx = Math.max(0, idx - 1);
      g.set(x, y, C.bark[idx], 'bark');
    }
  }
  // rounded tip
  g.set(END + 1, topAt(END) + 1, C.bark[2], 'bark');
  // knots
  for (const kx of [22, 63]) {
    const ky = topAt(kx) + 2;
    g.set(kx, ky, C.bark[0], 'bark');
    g.set(kx + 1, ky, C.bark[0], 'bark');
    g.set(kx, ky - 1, C.bark[3], 'bark');
  }
  // twig rising up and to the right
  const twig = [];
  for (let i = 0; i < 12; i++) twig.push([70 + i, topAt(70) - Math.round(i * 0.85)]);
  for (const [x, y] of twig) {
    g.set(x, y, C.bark[2], 'bark');
    g.set(x, y + 1, C.bark[1], 'bark');
  }
  // a small twig dipping left
  for (let i = 0; i < 6; i++) {
    const x = 18 - i;
    const y = topAt(18) - 1 - Math.round(i * 0.7);
    g.set(x, y, C.bark[2], 'bark');
    g.set(x, y + 1, C.bark[1], 'bark');
  }
  // leaves: a pointed oval with a midrib, rotated by flipping
  const leaf = (lx, ly, dir = 1, up = false, tone = 0) => {
    const rows = up
      ? ['..##', '.###', '####', '###.', '##..', '#...']
      : ['.##...', '####..', '######', '..####', '....#.'];
    rows.forEach((row, dy) =>
      [...row].forEach((ch, dx) => {
        if (ch !== '#') return;
        const x = lx + dx * dir;
        const y = ly + dy;
        const rib = up ? dx + dy === 4 || dx + dy === 3 && dy > 2 : dy === 2 && dx > 0 && dx < 5;
        const v = rib ? 0.3 : 0.88 - dy * 0.14 + tone;
        g.set(x, y, C.leaf[rampIdx(clamp01(v), C.leaf.length, x, y, 0.3)], 'leaf');
      }),
    );
  };
  const [tx, ty] = twig[twig.length - 1];
  leaf(tx - 1, ty - 5, 1, true, 0.08);
  leaf(tx - 6, ty - 2, -1, false, -0.05);
  leaf(tx + 1, ty + 1, 1, false, -0.12);
  leaf(END - 3, topAt(END) + 2, 1, false, -0.2);
  leaf(12, topAt(12) - 6, -1, true, -0.15);
  leaf(26, topAt(26) + 5, 1, false, -0.3);
}

function norm3(x, y, z) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Blit a frame onto a 2D context at art-pixel offset (dx, dy). */
export function paintFrame(ctx, frame, dx = 0, dy = 0) {
  const { w, h, px } = frame;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = px[y * w + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(dx + x, dy + y, 1, 1);
    }
  }
}

/** Render a frame once into an offscreen canvas for cheap drawImage blits. */
export function frameCanvas(frame) {
  const c = document.createElement('canvas');
  c.width = frame.w;
  c.height = frame.h;
  paintFrame(c.getContext('2d'), frame);
  return c;
}

/** Tiny pixel 'z' glyphs for the sleepy Zzz (art pixels). */
export const ZGLYPHS = [
  ['###', '..#', '.#.', '#..', '###'].map((r) => r.replace(/\./g, ' ')),
  ['##', '.#', '#.', '##'].map((r) => r.replace(/\./g, ' ')),
];
