// Pip the Meowl (a kitten's head on a little barn owl's body), drawn pixel by pixel. Builds small
// sprite frames (arrays of colours) that pages blit onto a low-resolution canvas and scale up with
// `image-rendering: pixelated`. tools/make-icons.mjs crops the toolbar icon from the same art.
//
// Lighting: moonlight from the upper right (cool rim light). Shapes are analytic (ellipses, triangles
// and hand-placed details), shaded with short ramps and light 2x2 dithering, then outlined against
// empty space only, the way hand-made sprites tend to be built. Everything is deterministic.

export const PIP_W = 96;
export const PIP_H = 64;

const C = {
  outline: '#1b1326',
  // toasty tabby fur, dark -> light (base #c4935f)
  fur: ['#835a3a', '#a57548', '#c4935f', '#d6a874', '#e6c08e'],
  stripe: '#6a4a33',
  earIn: ['#d98892', '#f2a7b0', '#f8c4ca'],
  white: ['#e6ded0', '#f4eee4', '#fffdf8'],
  nose: '#f39aa5',
  noseShade: '#d97f8c',
  mouth: '#7a5646',
  eye: '#16131b',
  glint: '#ffffff',
  blush: '#f4a3a8',
  whisker: '#fffdf8',
  whiskerTip: '#cfcbe0',
  // barn-owl body
  body: ['#8a5a32', '#ae7543', '#cf8f52', '#dfa66b', '#ebbf88'],
  wing: ['#7a4c27', '#a26a3b', '#cf8f52', '#e0a96c'],
  wingBar: '#7d5130',
  speckle: '#a39d96',
  chest: ['#e4dbcc', '#f1ebe0', '#fdfaf3'],
  feet: ['#e2dbcf', '#fdfaf3'],
  talon: '#8a8580',
  rim: '#a3b1ea',
  rimSoft: '#7c7fb8',
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
  set(x, y, color, kind) {
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

/** Is the pixel centre (x+0.5, y+0.5) inside triangle a-b-c? */
function inTri(x, y, a, b, c) {
  const px = x + 0.5;
  const py = y + 0.5;
  const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const pt = [px, py];
  const d1 = s(pt, a, b);
  const d2 = s(pt, b, c);
  const d3 = s(pt, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/**
 * One frame of Pip.
 * @param {{ mascot?: 'owl'|'meowl', breath?: 0|1, eyes?: 'closed'|'open'|'blink', branch?: boolean, oy?: number, rim?: boolean }} [opts]
 * @returns {{ w: number, h: number, px: (string|null)[] }}
 */
export function pipFrame(opts = {}) {
  const mascot = opts.mascot === 'meowl' ? 'meowl' : 'owl';
  const breath = opts.breath ?? 0;
  const eyes = opts.eyes ?? 'closed';
  const withBranch = opts.branch ?? true;
  const withRim = opts.rim ?? true;
  const OY = opts.oy ?? 8; // vertical offset so there's sky above the ears for drifting Zzz
  const g = new Grid(PIP_W, PIP_H);

  const cx = 48.5; // odd-width figure: column 48 is the centre line, pixel x mirrors to 96 - x
  const mirror = (x) => 96 - x;
  const feetY = 44 + OY; // first row of the branch top surface
  const lift = breath; // the head rides up 1px on the in-breath
  const L = norm3(0.42, -0.6, 0.68); // light from upper right, a little in front

  if (withBranch) drawBranch(g, feetY);

  const c = { g, cx, mirror, feetY, breath, lift, eyes, L, bcy: feetY - 11, after: null };
  if (mascot === 'meowl') drawMeowl(c);
  else drawOwl(c);

  // ---- outline against empty space ---------------------------------------------------------
  const out = g.c.slice();
  for (let y = 0; y < PIP_H; y++) {
    for (let x = 0; x < PIP_W; x++) {
      if (g.get(x, y)) continue;
      if (g.kind(x - 1, y) || g.kind(x + 1, y) || g.kind(x, y - 1) || g.kind(x, y + 1)) out[y * PIP_W + x] = C.outline;
    }
  }

  // ---- cool moonlight rim on the upper right ----------------------------------------------
  if (withRim) {
    for (let y = 0; y < PIP_H; y++) {
      for (let x = 0; x < PIP_W; x++) {
        const k = g.kind(x, y);
        if (!k || k === 'eye' || k === 'feet' || k === 'face' || k === 'earIn') continue;
        if (g.get(x + 1, y) && g.get(x, y - 1)) continue;
        if (k === 'bark') {
          const thin = g.kind(x, y + 2) !== 'bark';
          if (!g.get(x, y - 1)) out[y * PIP_W + x] = thin || x % 7 === 3 ? C.bark[3] : x % 7 === 0 ? C.rimSoft : C.barkRim;
        } else if (k === 'leaf') {
          if (!g.get(x + 1, y) && !g.get(x, y - 1)) out[y * PIP_W + x] = C.leafRim;
        } else if (x + 0.5 > cx + 2 && y < feetY - 6) {
          const strong = !g.get(x + 1, y - 1) && y < c.bcy - 2;
          out[y * PIP_W + x] = strong ? C.rim : C.rimSoft;
        }
      }
    }
  }

  if (c.after) c.after(out);

  return { w: PIP_W, h: PIP_H, px: out };
}

/** The Meowl skin: a kitten's head on a little barn owl's body. */
function drawMeowl(c) {
  const { g, cx, mirror, feetY, breath, lift, eyes, L } = c;
  const C = MEOWL;

  // ---- barn-owl body ------------------------------------------------------------------------------
  const bry = 10.4 + breath * 0.5;
  const bcy = feetY - 0.4 - bry;
  const brxAt = (dy) => 12.0 + 1.4 * Math.max(-0.4, dy / bry); // a touch pear-shaped
  const inBody = (x, y) => {
    const dy = y + 0.5 - bcy;
    return ((x + 0.5 - cx) / brxAt(dy)) ** 2 + (dy / bry) ** 2 <= 1;
  };
  for (let y = 0; y < PIP_H; y++) {
    for (let x = 0; x < PIP_W; x++) {
      if (!inBody(x, y)) continue;
      const dy = y + 0.5 - bcy;
      const nx = (x + 0.5 - cx) / brxAt(dy);
      const ny = dy / bry;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      let v = 0.16 + 0.84 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
      if (ny > 0.55) v -= 0.5 * (ny - 0.55);
      g.set(x, y, C.body[rampIdx(clamp01(v), C.body.length, x, y, 0.35)], 'body');
    }
  }

  // ---- golden barn-owl wings: pepper speckles, barred flight-feather tips -------------------
  for (const side of [-1, 1]) {
    const wcx = cx + side * 9.3;
    const wcy = bcy + 2.6;
    const wrx = 5.2;
    const wry = 8.8;
    const bottom = Math.floor(wcy + wry);
    for (let y = Math.floor(wcy - wry); y <= bottom; y++) {
      for (let x = Math.floor(wcx - wrx); x <= Math.ceil(wcx + wrx); x++) {
        if (g.kind(x, y) !== 'body') continue;
        const dx = (x + 0.5 - wcx) / wrx;
        const dy = (y + 0.5 - wcy) / wry;
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        const inner = side < 0 ? dx > 0.35 : dx < -0.35; // edge facing the chest catches light
        let v = (side > 0 ? 0.66 : 0.4) - 0.25 * dy;
        if (inner && d > 0.45) v += 0.28;
        let color = C.wing[rampIdx(clamp01(v), C.wing.length, x, y, 0.3)];
        const fromBottom = bottom - y;
        if (dy > 0.25 && fromBottom % 2 === 1 && (x + y) % 4 !== 0) color = C.wingBar; // barred flight-feather tips
        else if (dy <= 0.25 && y % 2 === 0 && (x * 3 + y + (hash(x >> 2, y >> 2) & 1)) % 4 === 0) color = C.speckle; // fine grey pepper
        g.set(x, y, color, 'wing');
      }
    }
  }

  // a darker leading edge where each wing folds over the chest
  for (let y = 0; y < PIP_H; y++) {
    for (let x = 0; x < PIP_W; x++) {
      if (g.kind(x, y) !== 'wing') continue;
      const toward = x + 0.5 < cx ? x + 1 : x - 1;
      if (g.kind(toward, y) === 'body') g.set(x, y, C.wing[0], 'wing');
    }
  }

  // ---- soft white chest ---------------------------------------------------------------------
  const ccy = bcy - 0.6;
  for (let y = Math.floor(ccy - 11); y <= Math.ceil(ccy + 11); y++) {
    for (let x = 38; x <= 59; x++) {
      const dx = (x + 0.5 - cx) / 7.6;
      const dy = (y + 0.5 - ccy) / 10.4;
      if (dx * dx + dy * dy > 1 || g.kind(x, y) !== 'body') continue;
      const v = 0.82 - 0.4 * dy + 0.22 * dx;
      g.set(x, y, C.chest[rampIdx(clamp01(v), C.chest.length, x, y, 0.3)], 'chest');
    }
  }

  // ---- fluffy white feet with tiny grey talons ----------------------------------------------
  for (const s of [1, -1]) {
    const X = (x) => (s > 0 ? x : mirror(x));
    for (const x of [44, 45]) g.set(X(x), feetY - 2, C.feet[1], 'feet');
    for (const x of [43, 44, 45, 46]) g.set(X(x), feetY - 1, x === 43 ? C.feet[0] : C.feet[1], 'feet');
    for (const x of [43, 45]) g.set(X(x), feetY, C.talon, 'feet');
  }

  // ---- kitten head (wider than tall, chubby cheeks) -----------------------------------------
  const hry = 10.2;
  const hcy = feetY - 21.2 - lift;
  const hrxAt = (dy) => 13.8 + 1.2 * Math.max(0, dy / hry); // cheeks fill out at the bottom
  const headTopF = hcy - hry;

  // ears first, so the head covers their base
  for (const s of [1, -1]) {
    const P = (x, y) => [s > 0 ? x : 97 - x, y];
    const apex = P(37.0, headTopF - 5.8);
    const bl = P(34.6, headTopF + 4.2);
    const br = P(45.0, headTopF + 0.8);
    for (let y = Math.floor(headTopF - 7); y <= Math.ceil(headTopF + 5); y++) {
      for (let x = 30; x <= 66; x++) {
        if (!inTri(x, y, apex, bl, br)) continue;
        const t = (y + 0.5 - (headTopF - 5.8)) / 10; // 0 at the tip
        const v = (s > 0 ? 0.42 : 0.72) + 0.1 * t;
        g.set(x, y, C.fur[rampIdx(clamp01(v), C.fur.length, x, y, 0.3)], 'ear');
      }
    }
  }

  for (let y = 0; y < PIP_H; y++) {
    for (let x = 0; x < PIP_W; x++) {
      const dy = y + 0.5 - hcy;
      const rx = hrxAt(dy);
      const nx = (x + 0.5 - cx) / rx;
      const ny = dy / hry;
      if (nx * nx + ny * ny > 1) continue;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      // warm bounce light from the white chest keeps the chin from going muddy
      const v = 0.2 + 0.8 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]) + (ny > 0.55 ? 0.18 : 0);
      g.set(x, y, C.fur[rampIdx(clamp01(v), C.fur.length, x, y, 0.35)], 'head');
    }
  }

  // pink inner ears, only on ear pixels the head didn't cover
  for (const s of [1, -1]) {
    const P = (x, y) => [s > 0 ? x : 97 - x, y];
    const apex = P(37.7, headTopF - 3.4);
    const bl = P(36.6, headTopF + 2.6);
    const br = P(43.0, headTopF + 1.2);
    for (let y = Math.floor(headTopF - 5); y <= Math.ceil(headTopF + 4); y++) {
      for (let x = 30; x <= 66; x++) {
        if (g.kind(x, y) !== 'ear' || !inTri(x, y, apex, bl, br)) continue;
        const t = (y + 0.5 - (headTopF - 3.4)) / 6;
        g.set(x, y, C.earIn[t < 0.35 ? 0 : t < 0.8 ? 1 : 2], 'earIn');
      }
    }
  }

  // the head casts a soft shadow on the body just under the cheeks
  const shade = { body: C.body[0], wing: C.wing[0], chest: C.chest[0] };
  for (let y = PIP_H - 1; y > 0; y--) {
    for (let x = 0; x < PIP_W; x++) {
      const k = g.kind(x, y);
      if (k in shade && g.kind(x, y - 1) === 'head') g.set(x, y, shade[k], k);
    }
  }

  const hc = Math.round(hcy); // face rows hang off this
  const ht = Math.round(headTopF);
  const both = (x, y, color, kind = 'face') => {
    g.set(x, y, color, kind);
    g.set(mirror(x), y, color, kind);
  };

  // tabby markings: a little "M" on the forehead, a couple of side stripes
  for (const [x, y0, y1] of [[45, ht + 2, ht + 4], [47, ht + 3, ht + 4]]) {
    for (let y = y0; y <= y1; y++) both(x, y, C.stripe);
  }
  both(37, hc - 5, C.stripe);
  both(38, hc - 5, C.stripe);
  both(36, hc - 3, C.stripe);
  both(37, hc - 3, C.stripe);

  // white blaze between the eyes running down into the muzzle
  for (let y = hc - 4; y <= hc + 1; y++) {
    g.set(48, y, C.white[2], 'face');
    if (y >= hc - 2) both(47, y, y >= hc ? C.white[2] : C.white[1]);
  }
  const mcy = hc + 3.6;
  for (let y = hc; y <= hc + 7; y++) {
    for (let x = 41; x <= 56; x++) {
      const dx = (x + 0.5 - cx) / 5.7;
      const dy = (y + 0.5 - mcy) / 3.1;
      if (dx * dx + dy * dy > 1 || !g.get(x, y)) continue;
      const v = 0.95 - 0.35 * Math.max(0, dy) - (Math.abs(dx) > 0.85 ? 0.3 : 0);
      g.set(x, y, C.white[rampIdx(clamp01(v), C.white.length, x, y, 0.2)], 'face');
    }
  }

  // white chin flowing into the chest
  for (let y = hc + 5; y <= Math.ceil(hcy + hry); y++) {
    const half = 3.8 + (y - (hc + 5)) * 0.75;
    for (let x = 38; x <= 59; x++) {
      const k = g.kind(x, y);
      if ((k !== 'head' && k !== 'face') || Math.abs(x + 0.5 - cx) > half) continue;
      const edge = Math.abs(x + 0.5 - cx) > half - 1;
      g.set(x, y, edge ? C.white[0] : y > hc + 7 ? C.white[1] : C.white[2], 'face');
    }
  }

  // eyes: small glossy dots, or sleepy curves
  if (eyes === 'open') {
    for (const s of [1, -1]) {
      const X = (x) => (s > 0 ? x : mirror(x));
      const dot = ['.##.', '####', '####', '.##.'];
      dot.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
          if (ch === '#') g.set(X(41 + rx), hc - 2 + ry, C.eye, 'eye');
        }),
      );
    }
    g.set(42, hc - 1, C.glint, 'eye'); // the same catch-light corner on both eyes
    g.set(53, hc - 1, C.glint, 'eye');
  } else if (eyes === 'blink') {
    for (const x of [41, 42, 43, 44]) both(x, hc, C.eye, 'eye');
  } else {
    // closed: a soft downward curve
    both(41, hc, C.eye, 'eye');
    both(42, hc + 1, C.eye, 'eye');
    both(43, hc + 1, C.eye, 'eye');
    both(44, hc, C.eye, 'eye');
  }
  // the thin dark tabby flick from each outer eye corner
  both(40, hc, C.stripe);
  both(39, hc, C.stripe);
  both(38, hc + 1, C.stripe);

  // tiny pink nose and a little "w" mouth
  both(47, hc + 2, C.nose);
  g.set(48, hc + 2, C.nose, 'face');
  g.set(48, hc + 3, C.noseShade, 'face');
  g.set(48, hc + 4, C.mouth, 'face');
  both(46, hc + 4, C.mouth);
  both(47, hc + 5, C.mouth);

  // rosy cheeks
  both(40, hc + 2, C.blush);
  both(41, hc + 2, C.blush);

  c.bcy = bcy;
  // little white whiskers, drawn after the outline so they reach past it
  c.after = (out) => {
    const whisker = (pts) => {
      for (const [x, y, tip] of pts) {
        const c = tip ? C.whiskerTip : C.whisker;
        out[y * PIP_W + x] = c;
        out[y * PIP_W + mirror(x)] = c;
      }
    };
    whisker([[42, hc + 3], [41, hc + 3], [40, hc + 3], [39, hc + 3], [38, hc + 3], [37, hc + 2], [36, hc + 2, true]]);
    whisker([[42, hc + 5], [41, hc + 5], [40, hc + 5], [39, hc + 5], [38, hc + 6], [37, hc + 6, true]]);
  };
}

/** Small deterministic hash for speckle placement. */
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
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
        const rib = up ? dx + dy === 4 || (dx + dy === 3 && dy > 2) : dy === 2 && dx > 0 && dx < 5;
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
