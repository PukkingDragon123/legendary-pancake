// [artpass] Hand-made pixel art for the night: the moon (tonight's real phase, a lit sphere with its seas, craters
// rimmed toward the sun, a cool terminator and a faint earthshine on the dark side, a fine dithered halo) and Pip's
// journey across the night (layered hills with pines, the great oak with a lit window, the place he is flying to, a
// dotted path, Pip himself with his lantern). Painted into an Art (src/ui/px/sleepart.ts) one art pixel at a time,
// with hue-shifted ramps: warm cream lights, lilac shadows, navy darks.
import { Art, bayer, hash } from './sleepart.ts';

// ------------------------------------------------------------------ the moon

/** lit ramp (dark to light): lilac shadow through to warm cream */
const LIT = ['#6e6884', '#8f86a0', '#b4a9b4', '#d6c9b8', '#ecdfc4', '#f8efd8', '#fffaea'];
/** the seas, a cooler grey-blue at the same light levels */
const SEA = ['#5c5a78', '#77728e', '#968ea4', '#b2a9b2', '#c8bfbc', '#d8d0c8', '#e6dfd4'];
/** the dark side under earthshine */
const DARK = ['#1c2236', '#232a42', '#2a334e'];
/** craters: [u, v, radius] on the face, in units of the moon's radius */
const CRATERS: [number, number, number][] = [
  [-0.38, -0.42, 0.14], [0.22, -0.55, 0.1], [0.5, 0.1, 0.12], [-0.12, 0.52, 0.17], [0.32, 0.46, 0.08], [-0.58, 0.12, 0.09],
  [0.05, -0.12, 0.07], [0.62, -0.32, 0.07], [-0.3, 0.2, 0.06], [0.12, 0.2, 0.05], [-0.7, -0.2, 0.06], [0.42, 0.7, 0.06],
];
/** the dark seas: [u, v, rx, ry] */
const SEAS: [number, number, number, number][] = [[-0.25, -0.18, 0.34, 0.26], [0.2, -0.3, 0.22, 0.18], [0.12, 0.12, 0.26, 0.2], [-0.42, 0.3, 0.18, 0.22], [0.38, -0.02, 0.14, 0.2]];

/**
 * The moon at `phase` (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter) centred at (cx, cy), radius `r` art px.
 * `halo` 0..1: a fine dithered glow round it.
 */
export function moonArt(a: Art, cx: number, cy: number, r: number, phase: number, halo = 0.6) {
  const th = phase * Math.PI * 2, L = [Math.sin(th), -0.08, -Math.cos(th)];
  const ll = Math.hypot(L[0], L[1], L[2]); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  const litFrac = (1 - Math.cos(th)) / 2;
  if (halo > 0) {
    const R2 = r + Math.max(3, r * 0.45);
    for (let y = Math.floor(cy - R2); y <= cy + R2; y++) for (let x = Math.floor(cx - R2); x <= cx + R2; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r || d > R2) continue;
      const k = (1 - (d - r) / (R2 - r)) * halo * (0.35 + litFrac * 0.65);
      if (k * 1.1 > bayer(x, y) + 0.12) a.px(x, y, k > 0.55 ? '#3e4a6c' : k > 0.3 ? '#323d5c' : '#2a3350');
    }
  }
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const u = (x + 0.5 - cx) / r, v = (y + 0.5 - cy) / r, q = u * u + v * v;
    if (q > 1) continue;
    const n = [u, v, Math.sqrt(1 - q)];
    // surface: seas and craters (a crater's floor is a bowl: the side toward the sun is in shadow, the far rim lit)
    let sea = 0, bump = 0;
    for (const [su, sv, rx, ry] of SEAS) { const e = ((u - su) / rx) ** 2 + ((v - sv) / ry) ** 2; if (e < 1) sea = Math.max(sea, e < 0.6 ? 1 : 0.5); }
    sea = sea > 0 && hash(x, y, 31) < 0.12 ? sea * 0.5 : sea;
    for (const [cu, cv, cr] of CRATERS) {
      const du = (u - cu) / cr, dv = (v - cv) / cr, dd = Math.hypot(du, dv);
      if (dd > 1.25) continue;
      const along = (du * L[0] + dv * L[1]) / Math.max(0.2, Math.hypot(L[0], L[1]));
      if (dd < 1) bump += along < 0 ? -0.22 : 0.06; // the floor: shadowed on the sun's side
      else bump += along > 0 ? -0.1 : 0.16; // the rim: lit on the far side
    }
    const lam = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
    if (lam <= 0.02) {
      // the dark side: earthshine, a little lighter toward the middle, the seas just showing
      const k = Math.min(2, Math.floor((n[2] * 1.6 + (sea ? -0.5 : 0) + bayer(x, y) * 0.8)));
      a.px(x, y, DARK[Math.max(0, k)]);
      continue;
    }
    const lv = Math.max(0, Math.min(1, Math.pow(lam, 0.55) + bump)) * 6.4 + bayer(x, y) * 0.9 - 0.45;
    const ramp = sea >= 1 ? SEA : sea > 0 && bayer(x, y) < 0.5 ? SEA : LIT;
    a.px(x, y, ramp[Math.max(0, Math.min(6, Math.floor(lv)))]);
  }
  // a crisp edge on the dark limb so it reads against the sky
  for (let k = 0; k < 160; k++) {
    const ang = (k / 160) * Math.PI * 2, nx = Math.cos(ang), ny = Math.sin(ang);
    if (nx * L[0] + ny * L[1] > 0.15 && litFrac > 0.1) continue;
    const x = Math.floor(cx + nx * (r - 0.4)), y = Math.floor(cy + ny * (r - 0.4));
    if (a.has(x, y)) a.px(x, y, '#323c5a');
  }
}

// ------------------------------------------------------------------ the journey

const SKY = ['#121a2e', '#16203a', '#1b2744', '#20304e'];
const FAR = ['#1e2a44', '#25334f'], NEAR = ['#151d30', '#1a2438'], PINE = '#111827';

/**
 * Pip's trip tonight, `w` x `h` art px: home on the left, the place on the right (`color` its banner), the path between
 * them as a dotted arc, `frac` of it flown; t seconds for the lantern's flicker and Pip's wings.
 */
export function journeyArt(a: Art, w: number, h: number, frac: number, color: string, t: number) {
  // the sky, dithered in bands, with stars that come and go
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a.px(x, y, SKY[Math.max(0, Math.min(3, Math.floor((y / h) * 4 + bayer(x, y) - 0.5)))]);
  for (let i = 0; i < Math.round(w / 6); i++) {
    const sx = Math.floor(hash(i, 3, 5) * w), sy = Math.floor(hash(i, 4, 5) * h * 0.55), tw = Math.sin(t * (0.6 + hash(i, 6) * 0.8) + i);
    if (tw > -0.3) a.px(sx, sy, tw > 0.75 ? '#fdf6dc' : hash(i, 7) > 0.5 ? '#7c8cae' : '#5a6888');
  }
  // far hills, then near hills with a fringe of pines
  for (let x = 0; x < w; x++) {
    const f = Math.round(h * 0.6 + Math.sin(x * 0.07 + 1.3) * 2.6 + Math.sin(x * 0.19) * 1.2);
    for (let y = f; y < h; y++) a.px(x, y, FAR[(y - f) < 2 && bayer(x, y) > 0.5 ? 1 : 0]);
  }
  for (let x = 0; x < w; x++) {
    const n = Math.round(h * 0.78 + Math.sin(x * 0.11 + 4) * 2 + Math.sin(x * 0.31) * 0.8);
    for (let y = n; y < h; y++) a.px(x, y, NEAR[y === n ? 1 : 0]);
    if (x > 18 && x < w - 22 && hash(x, 9, 2) > 0.78) {
      const ph = 3 + Math.floor(hash(x, 8, 2) * 4);
      for (let j = 0; j < ph; j++) { const half = Math.floor(j / 2); for (let i = -half; i <= half; i++) a.px(x + i, n - ph + j + 1, PINE); }
    }
  }
  // home: the great oak, its trunk, a round canopy lit from the moon's side, a warm window and the door
  const ox = 9, gy = Math.round(h * 0.8);
  for (let y = gy - 9; y < gy + 1; y++) for (let x = ox - 1; x <= ox + 1; x++) a.px(x, y, x === ox - 1 ? '#4a3020' : '#6a4428');
  a.px(ox - 2, gy, '#4a3020'); a.px(ox + 2, gy, '#4a3020');
  for (const [cx, cy, r] of [[ox - 3, gy - 12, 4.4], [ox + 3, gy - 12, 4.2], [ox, gy - 15, 4.6]] as const) {
    a.disc(cx, cy, r, (x, y) => { const l = (cx - x) * 0.4 + (cy - y) * 0.7; return l > 1.8 && bayer(x, y) < 0.6 ? '#4c7a4a' : l > -0.5 ? '#355e3a' : '#25452c'; });
  }
  a.px(ox, gy - 6, '#f6d48a'); a.px(ox + 1, gy - 6, '#e8b45a'); a.px(ox, gy - 5, '#e8b45a');
  a.px(ox, gy - 1, '#2a1a14'); a.px(ox, gy - 2, '#2a1a14');
  // the place: a little mountain with a snowy top and the place's banner on it
  const mx = w - 13, my = Math.round(h * 0.74);
  for (let j = 0; j < 12; j++) for (let i = -j; i <= j; i++) {
    const x = mx + i, y = my - 12 + j;
    a.px(x, y, j < 3 ? (i < 0 ? '#e8eef6' : '#b8c4d8') : i < -j / 3 ? '#4a5878' : '#36425e');
  }
  for (let y = my - 18; y < my - 11; y++) a.px(mx, y, '#c8a764');
  const wave = Math.floor(t * 3) % 2;
  for (let j = 0; j < 3; j++) for (let i = 1; i <= 4 - j + (j === 1 ? wave : 0); i++) a.px(mx + i, my - 18 + j, color);
  // the path: a dotted arc, bright where Pip has flown, faint ahead
  const pt = (u: number): [number, number] => [ox + 3 + u * (mx - ox - 6), Math.round(h * 0.62) - Math.sin(u * Math.PI) * h * 0.42];
  for (let k = 0; k <= 48; k++) {
    const u = k / 48, [x, y] = pt(u);
    if (k % 2) continue;
    a.px(Math.round(x), Math.round(y), u <= frac ? '#eae2d1' : '#5a6c8e');
  }
  // Pip flying the path: a little owl with beating wings, his lantern swinging below and its glow
  const [px0, py0] = pt(Math.max(0.03, Math.min(0.97, frac)));
  const bob = Math.round(Math.sin(t * 2.4)), X = Math.round(px0), Y = Math.round(py0) - 3 + bob;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.hypot(dx, dy + 3);
    if (d < 4.2 && d > 1.4 && bayer(X + dx, Y + dy) < (1 - d / 4.2) * 0.9) a.px(X + dx, Y + dy + 3, '#5a5038');
  }
  const up = Math.floor(t * 5) % 2 === 0;
  const OWL = up
    ? ['w.....w', 'ww.b.ww', '.wBBBw.', '..BeB..', '..BBB..', '...o...']
    : ['.......', '...b...', 'wwBBBww', 'w.BeB.w', '..BBB..', '...o...'];
  const PAL: Record<string, string> = { w: '#8a6a4c', b: '#a07a52', B: '#b88a5c', e: '#f6e6b8', o: '#c8a764' };
  OWL.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') a.px(X - 3 + i, Y - 4 + j, PAL[ch]); }));
  // the lantern
  const ly = Y + 3, fl = Math.sin(t * 9) > 0.2;
  a.px(X, ly - 1, '#6e5a3a');
  a.px(X - 1, ly, '#a8843c'); a.px(X, ly, fl ? '#fff2c9' : '#f6d48a'); a.px(X + 1, ly, '#a8843c');
  a.px(X - 1, ly + 1, '#a8843c'); a.px(X, ly + 1, '#f1c26a'); a.px(X + 1, ly + 1, '#a8843c');
  // a trail of sparks behind him
  for (let i = 1; i <= 3; i++) { const [sx, sy] = pt(Math.max(0, frac - i * 0.03)); if ((Math.floor(t * 6) + i) % 3) a.px(Math.round(sx), Math.round(sy) + ((i + Math.floor(t * 4)) % 2), i === 1 ? '#f1d39a' : '#a8905c'); }
  // a frame: a dark keyline with rounded corners
  for (let x = 0; x < w; x++) { a.px(x, 0, '#0c1220'); a.px(x, h - 1, '#0c1220'); }
  for (let y = 0; y < h; y++) { a.px(0, y, '#0c1220'); a.px(w - 1, y, '#0c1220'); }
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) a.d[y * w + x] = 0;
}
