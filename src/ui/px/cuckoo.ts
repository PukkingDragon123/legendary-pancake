// The big cuckoo clock, painted at pixel resolution: a carved Black-Forest chalet with a shingled
// roof, leaf bargeboards and a carved owl on the ridge, a little cuckoo door (an owl pops out),
// a brass-bezelled bone dial with live hands, carved oak leaves and acorns, a carved owl under the
// dial, a scalloped apron, a swinging leaf pendulum and two pine-cone weights on brass chains.
import { Art, ballShade, dtone, hash, INK, lit, text3, text3w, tone } from './sleepart.ts';
import { owl } from './sleepprops.ts';

export const CW = 100, CH = 196;
export const PIVOT = { x: 50, y: 125 };
export const PEND_LEN = 38;
/** x of the two weight chains and their counter rings */
export const WEIGHTS = [{ x: 34, ring: 25 }, { x: 66, ring: 75 }];
const CHAIN_TOP = 137;
export const DOOR = { x: 43, y: 29, w: 14, h: 13 };
export const FACE = { x: 50, y: 83, r: 24 };

export interface Finish { id: string; name: string; ramp: string; roof: string; carve: string }
export const FINISHES: Finish[] = [
  { id: 'oak', name: 'Honey oak', ramp: 'wood', roof: 'dwood', carve: 'lwood' },
  { id: 'walnut', name: 'Dark walnut', ramp: 'dwood', roof: 'black', carve: 'wood' },
  { id: 'cherry', name: 'Cherry', ramp: 'cinnamon', roof: 'leather', carve: 'tan' },
  { id: 'linden', name: 'Linden', ramp: 'lwood', roof: 'wood', carve: 'sand' },
];

/** Recolour everything in `src` with a ramp by brightness: how a wood carving of it looks. */
function carve(src: Art, ramp: string, lift = 0): Art {
  const o = new Art(src.w, src.h);
  for (let i = 0; i < src.d.length; i++) {
    const v = src.d[i];
    if (!(v >>> 24)) continue;
    const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
    const l = (0.3 * r + 0.55 * g + 0.15 * b) / 255;
    const x = i % src.w, y = (i / src.w) | 0;
    o.px(x, y, l < 0.13 ? tone(ramp, 0) : dtone(ramp, 1 + l * 4.2 + lift, x, y));
  }
  return o;
}

/** A carved oak leaf along an angle (radians, 0 = pointing right), lobed, with a vein. */
function oakLeaf(a: Art, x: number, y: number, ang: number, len: number, wid: number, ramp: string, base = 3) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const pts: [number, number][] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) { const t = i / N, w = Math.sin(t * Math.PI) * wid * (0.75 + 0.25 * Math.abs(Math.sin(t * Math.PI * 3.2))); pts.push([x + c * t * len - s * w, y + s * t * len + c * w]); }
  for (let i = N; i >= 0; i--) { const t = i / N, w = Math.sin(t * Math.PI) * wid * (0.75 + 0.25 * Math.abs(Math.sin(t * Math.PI * 3.2 + 0.6))); pts.push([x + c * t * len + s * w, y + s * t * len - c * w]); }
  const mx = x + c * len * 0.5, my = y + s * len * 0.5;
  a.poly(pts, (X, Y) => dtone(ramp, base + lit(X - mx, Y - my, len * 0.6) * 1.5, X, Y));
  a.line(x, y, x + c * len * 0.85, y + s * len * 0.85, tone(ramp, 1));
}
function acorn(a: Art, x: number, y: number, ramp: string) {
  a.ell(x, y + 2, 2.2, 2.8, ballShade(ramp, x, y + 2, 3, 3.4, 1.4));
  a.ell(x, y, 2.8, 1.6, (X, Y) => ((X + Y) % 2 ? tone(ramp, 1) : tone(ramp, 2)));
  a.px(x, y - 2, tone(ramp, 1));
}

const staticCache = new Map<string, Art>();
/** The unmoving parts (case, roof, carvings, dial). */
function body(fin: Finish): Art {
  const hit = staticCache.get(fin.id);
  if (hit) return hit;
  const a = new Art(CW, CH);
  const W = fin.ramp, R = fin.roof, K = fin.carve;
  const grain = (x: number, y: number, base: number) => dtone(W, base + Math.sin(y * 0.9 + Math.sin(x * 0.25) * 2) * 0.35 + (hash(x >> 2, y, 2) - 0.5) * 0.35, x, y);

  // ---- the case: frame and recessed panel
  a.rect(13, 47, 74, 77, (x, y) => grain(x, y, 2.8));
  a.rect(15, 49, 70, 73, (x, y) => grain(x, y, 2.2));
  a.rect(13, 47, 74, 1, tone(W, 4)); a.rect(13, 47, 1, 77, tone(W, 4)); a.rect(86, 47, 1, 77, tone(W, 1)); a.rect(13, 123, 74, 1, tone(W, 1));
  a.rect(15, 49, 70, 1, tone(W, 1)); a.rect(15, 49, 1, 73, tone(W, 1)); a.rect(84, 49, 1, 73, tone(W, 4));
  // carved pillars on the sides with little turned beads
  for (const px of [9, 87]) {
    a.rect(px, 50, 4, 70, (x, y) => dtone(K, 3 + (x === px ? 1 : x === px + 3 ? -1 : 0), x, y));
    for (let y = 54; y < 118; y += 8) a.ell(px + 2, y, 2.6, 1.6, ballShade(K, px + 2, y, 2, 3.6, 1.4));
  }
  // ---- base moulding and scalloped apron with hanging leaves
  a.rect(8, 124, 84, 4, (x, y) => dtone(W, 4 - (y - 124) * 0.7, x, y));
  a.rect(11, 128, 78, 4, (x, y) => grain(x, y, 2.6));
  for (let i = 0; i < 7; i++) a.ell(16 + i * 11.3, 132, 5.4, 3.4, (x, y) => (y >= 131 ? dtone(W, 2.6 + lit(x - 16 - i * 11.3, y - 132, 4), x, y) : null));
  for (const [lx, ang] of [[18, 1.9], [30, 1.6], [70, 1.55], [82, 1.25]] as const) oakLeaf(a, lx, 131, ang, 9, 3.4, K, 3.2);
  acorn(a, 42, 135, K); acorn(a, 58, 135, K);

  // ---- the gable front (triangle) with the cuckoo door
  a.poly([[50, 20], [13, 47], [87, 47]], (x, y) => grain(x, y, 3.1));
  // door frame: an arched opening
  const D = DOOR;
  a.rect(D.x - 2, D.y + 3, D.w + 4, D.h - 1, tone(R, 1));
  a.ell(D.x + D.w / 2, D.y + 3, D.w / 2 + 2, 5, (x, y) => (y <= D.y + 3 ? tone(R, 1) : null));
  a.rect(D.x - 3, D.y + D.h + 1, D.w + 6, 2, (x, y) => dtone(K, 4 - (y - D.y - D.h - 1), x, y));
  // a tiny perch ledge with railing posts
  for (let x = D.x - 2; x <= D.x + D.w + 2; x += 3) a.rect(x, D.y + D.h + 3, 1, 3, tone(K, 2));
  a.rect(D.x - 3, D.y + D.h + 6, D.w + 6, 1, tone(K, 3));
  // gable carving: a sun-burst of leaves either side of the door
  oakLeaf(a, 38, 40, Math.PI + 0.5, 12, 3.6, K, 3); oakLeaf(a, 62, 40, -0.5, 12, 3.6, K, 3);
  oakLeaf(a, 35, 44, Math.PI + 0.15, 10, 3, K, 2.8); oakLeaf(a, 65, 44, -0.15, 10, 3, K, 2.8);

  // ---- the roof: two shingled boards with carved leaf bargeboards
  for (const sd of [-1, 1]) {
    const pts: [number, number][] = [[50, 13], [50 + sd * 49, 45], [50 + sd * 49, 50], [50, 19]];
    a.poly(pts, (x, y) => {
      const along = Math.abs(x - 50), row = Math.floor((y - along * 0.65) / 2.2);
      const scal = (Math.floor((along + row * 2) / 4) + row) % 2;
      return dtone(R, 2.8 + (scal ? 0.5 : -0.2) + ((y - 13 - along * 0.65) < 1.5 ? 1.2 : 0), x, y);
    });
    // a hanging row of carved leaves under each eave
    for (let i = 0; i < 6; i++) { const t = 0.18 + i * 0.15, lx = 50 + sd * 49 * t, ly = 19 + 31 * t; oakLeaf(a, lx, ly, sd > 0 ? 1.35 : Math.PI - 1.35, 7, 2.6, K, 3.4); }
  }
  // ridge cap
  a.rect(47, 11, 6, 4, (x, y) => dtone(K, 4 - (y - 11) * 0.6, x, y));

  // ---- the carved owl on the ridge and its branch
  const fo = new Art(CW, 30);
  owl(fo, 50, 10, 0.62, { eyes: 'open', look: 0 });
  const carvedOwl = carve(fo, K, 0.2);
  a.stamp(carvedOwl, 0, -1);
  oakLeaf(a, 50, 15, Math.PI - 0.2, 10, 3.4, K, 3.4); oakLeaf(a, 50, 15, 0.2, 10, 3.4, K, 3.4);

  // ---- carved leaf garland around the dial, acorns, and an owl under it
  for (const sd of [-1, 1]) {
    oakLeaf(a, 50 + sd * 18, 57, sd > 0 ? -0.9 : Math.PI + 0.9, 14, 4.2, K, 3.3);
    oakLeaf(a, 50 + sd * 22, 62, sd > 0 ? -0.2 : Math.PI + 0.2, 13, 4, K, 3);
    oakLeaf(a, 50 + sd * 23, 104, sd > 0 ? 0.5 : Math.PI - 0.5, 13, 4, K, 3.1);
    oakLeaf(a, 50 + sd * 18, 110, sd > 0 ? 1.1 : Math.PI - 1.1, 11, 3.6, K, 2.8);
    acorn(a, 50 + sd * 30, 58, K); acorn(a, 50 + sd * 33, 102, K);
  }
  const bo = new Art(CW, 26);
  owl(bo, 50, 12, 0.5, { eyes: 'closed' });
  a.stamp(carve(bo, K, -0.2), 0, 103);

  // ---- the dial: brass bezel, bone face, numerals, minute track
  const F = FACE;
  a.disc(F.x, F.y, F.r, (x, y) => {
    const d = Math.hypot(x + 0.5 - F.x, y + 0.5 - F.y);
    if (d > F.r - 1) return INK;
    if (d > F.r - 4) return dtone('brass', 3 + lit(x - F.x, y - F.y, F.r) * 2.2 + (d > F.r - 2.5 ? 0.4 : -0.4), x, y);
    if (d > F.r - 5) return tone('brass', 1);
    return dtone('bone', 4.1 - (d / F.r) * 0.9 + (hash(x, y, 4) - 0.5) * 0.2, x, y);
  });
  // a little moon-and-stars motif in the middle
  a.disc(F.x, F.y + 7, 3.2, tone('navy', 4)); a.disc(F.x + 1.4, F.y + 6, 2.8, tone('bone', 4));
  a.px(F.x - 5, F.y + 4, tone('gold', 3)); a.px(F.x + 6, F.y + 9, tone('gold', 3));
  // minute track
  for (let i = 0; i < 60; i++) {
    const an = (i / 60) * Math.PI * 2, r = F.r - 6;
    const x = F.x + Math.sin(an) * r, y = F.y - Math.cos(an) * r;
    a.px(x, y, i % 5 === 0 ? INK : tone('bone', 1));
    if (i % 15 === 0) a.px(F.x + Math.sin(an) * (r - 1), F.y - Math.cos(an) * (r - 1), INK);
  }
  // numerals at the quarters, diamonds between
  for (let h = 0; h < 12; h++) {
    const an = (h / 12) * Math.PI * 2, r = F.r - 10.5;
    const x = F.x + Math.sin(an) * r, y = F.y - Math.cos(an) * r;
    if (h % 3 === 0) { const n = h === 0 ? '12' : String(h), w = text3w(n); text3(a, n, Math.round(x - w / 2), Math.round(y - 2.5), INK); }
    else { a.px(x, y, tone('wood', 1)); a.px(x, y - 1, tone('wood', 2)); a.px(x, y + 1, tone('wood', 2)); }
  }
  a.outline(INK);
  staticCache.set(fin.id, a);
  return a;
}

function chain(a: Art, x: number, y0: number, y1: number) {
  for (let y = y0; y < y1; y++) {
    if (y % 3 === 0) { a.px(x - 1, y, tone('brass', 2)); a.px(x + 1, y, tone('brass', 4)); }
    else a.px(x, y, tone('brass', y % 3 === 1 ? 4 : 2));
  }
}
/** A pine-cone weight hanging from (x, y). 11 x 22. */
function pineCone(a: Art, x: number, y: number) {
  a.rect(x - 1, y, 3, 3, tone('brass', 3));
  a.ell(x, y + 12, 5, 9.5, (X, Y) => {
    const row = Math.floor((Y - y - 3) / 2.2), off = row % 2 ? 1.5 : 0;
    const sc = ((X - x + 20 + off) % 3);
    const l = lit(X - x, Y - y - 12, 8);
    return dtone('bear', (sc < 1 ? 1.6 : 3) + l * 1.6 + (Y > y + 18 ? -0.5 : 0), X, Y);
  });
  for (let i = 0; i < 5; i++) a.px(x - 3 + i * 1.5, y + 5 + i * 3, tone('bear', 5));
  a.ell(x, y + 3, 3.4, 1.4, tone('bear', 2));
}

export interface ClockState {
  /** minutes past midnight, fractional */
  now: number;
  /** pendulum angle, radians */
  swing: number;
  /** 0..1 how far the cuckoo is out; 0 = doors shut */
  cuckoo: number;
  /** the cuckoo's beak is open (mid-hoot) */
  hoot: boolean;
  /** chain drop of each weight, px (0 = fully wound) */
  drop: [number, number];
  finish: Finish;
}

/** Paint one frame of the clock into `a` (CW x CH). */
export function paintCuckoo(a: Art, s: ClockState) {
  a.clear();
  // ---- the pendulum hangs behind the case
  const P = PIVOT, sw = s.swing;
  const rod = (t: number): [number, number] => [P.x - Math.sin(sw) * t, P.y + Math.cos(sw) * t];
  for (let t = 0; t < PEND_LEN; t++) { const [x, y] = rod(t); a.px(x, y, tone('brass', t % 4 === 0 ? 4 : 3)); a.px(x + 1, y, tone('brass', 2)); }
  const [bx, by] = rod(PEND_LEN + 6);
  const bob = new Art(24, 26);
  oakLeaf(bob, 12, 1, Math.PI / 2, 22, 7.6, s.finish.carve, 3.4);
  oakLeaf(bob, 12, 6, Math.PI / 2 + 0.9, 8, 3, s.finish.carve, 2.6); oakLeaf(bob, 12, 6, Math.PI / 2 - 0.9, 8, 3, s.finish.carve, 2.6);
  bob.disc(12, 6, 3, ballShade('brass', 12, 6, 3, 3.6, 1.6));
  bob.outline(INK);
  // rotate the bob by sampling (nearest neighbour keeps it pixel-crisp)
  const c = Math.cos(sw), si = Math.sin(sw);
  for (let y = -16; y < 16; y++) for (let x = -16; x < 16; x++) {
    const sx = Math.round(c * x + si * y + 12), sy = Math.round(-si * x + c * y + 8);
    const v = bob.get(sx, sy);
    if (v >>> 24) a.px(bx + x, by + y - 8 + 6, v);
  }
  // ---- the case
  a.stamp(body(s.finish), 0, 0);
  // ---- the cuckoo door and the owl
  const D = DOOR;
  const doorOpen = Math.min(1, s.cuckoo / 0.3), out = Math.max(0, (s.cuckoo - 0.3) / 0.7);
  if (doorOpen > 0) {
    a.rect(D.x, D.y + 1, D.w, D.h, tone('dwood', 0));
    a.ell(D.x + D.w / 2, D.y + 3, D.w / 2, 4, (x, y) => (y <= D.y + 3 ? tone('dwood', 0) : null));
    if (out > 0) {
      const o = new Art(40, 40);
      owl(o, 20, 22 - out * 4, 0.42 + out * 0.2, { eyes: s.hoot ? 'happy' : 'open', beak: s.hoot ? 'open' : 'closed', wing: s.hoot ? 1 : 0, cap: true });
      // clip to the doorway (plus a little lean out over the perch)
      for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) {
        const v = o.d[y * 40 + x];
        if (!(v >>> 24)) continue;
        const X = D.x + D.w / 2 - 20 + x, Y = D.y + D.h - 26 + y + Math.round(out * 3);
        if (Y < D.y - 2 + (1 - out) * 6 || Y > D.y + D.h + 5) continue;
        a.px(X, Y, v);
      }
    }
    // the two door leaves swung open, seen edge-on
    const lw = Math.max(1, Math.round(D.w / 2 * (1 - doorOpen)));
    for (const sd of [0, 1]) {
      const x0 = sd ? D.x + D.w - lw + Math.round(doorOpen * 4) : D.x - Math.round(doorOpen * 4);
      a.rect(x0, D.y + 2, lw + 1, D.h - 1, (x, y) => dtone(s.finish.carve, 3.4 + (sd ? -0.6 : 0.6), x, y));
      a.rect(x0, D.y + 2, 1, D.h - 1, INK); a.rect(x0 + lw + 1, D.y + 2, 1, D.h - 1, INK);
    }
  } else {
    // shut: two leaves with a heart cut-out and knobs
    for (const sd of [0, 1]) {
      const x0 = D.x + sd * (D.w / 2);
      a.rect(x0, D.y + 1, D.w / 2, D.h, (x, y) => dtone(s.finish.carve, 3.6 + (x === x0 ? 1 : x === x0 + D.w / 2 - 1 ? -1 : 0) - (y > D.y + D.h - 3 ? 0.6 : 0), x, y));
      // planks
      a.rect(x0 + 3, D.y + 4, 1, D.h - 4, tone(s.finish.carve, 2));
    }
    a.ell(D.x + D.w / 2, D.y + 3, D.w / 2, 4, (x, y) => (y <= D.y + 3 ? dtone(s.finish.carve, 4, x, y) : null));
    a.rect(D.x + D.w / 2, D.y, 1, D.h + 1, INK);
    // hinges
    a.rect(D.x, D.y + 4, 2, 1, INK); a.rect(D.x, D.y + D.h - 2, 2, 1, INK); a.rect(D.x + D.w - 2, D.y + 4, 2, 1, INK); a.rect(D.x + D.w - 2, D.y + D.h - 2, 2, 1, INK);
    a.px(D.x + D.w / 2 - 2, D.y + 8, tone('brass', 4)); a.px(D.x + D.w / 2 + 2, D.y + 8, tone('brass', 4));
    a.px(D.x + D.w / 2, D.y + 4, tone(s.finish.carve, 0)); a.px(D.x + D.w / 2 - 1, D.y + 3, tone(s.finish.carve, 0)); a.px(D.x + D.w / 2 + 1, D.y + 3, tone(s.finish.carve, 0));
  }
  // ---- hands
  const F = FACE;
  const hA = ((s.now / 720) % 1) * Math.PI * 2, mA = ((s.now % 60) / 60) * Math.PI * 2, sA = (((s.now * 60) % 60) / 60) * Math.PI * 2;
  const at = (an: number, r: number): [number, number] => [F.x + Math.sin(an) * r, F.y - Math.cos(an) * r];
  // hour: a spade
  { const [ex, ey] = at(hA, 10); a.line(F.x, F.y, ex, ey, INK); const [ex2, ey2] = at(hA + 0.08, 9); a.line(F.x, F.y, ex2, ey2, INK); const [tx, ty] = at(hA, 11.5); a.disc(tx, ty, 2.2, INK); const [px, py] = at(hA, 13.5); a.px(px, py, INK); }
  // minute: long with a little open ring
  { const [ex, ey] = at(mA, 17); a.line(F.x, F.y, ex, ey, INK); const [rx, ry] = at(mA, 12); a.disc(rx, ry, 1.8, (x, y) => (Math.hypot(x + 0.5 - rx, y + 0.5 - ry) > 0.9 ? INK : null)); }
  // seconds: a thin brass sweep
  { const [ex, ey] = at(sA, 18); const [bx2, by2] = at(sA + Math.PI, 4); a.line(bx2, by2, ex, ey, tone('red', 3)); }
  a.disc(F.x, F.y, 1.8, ballShade('brass', F.x, F.y, 2, 3.8, 1.2));
  // glass glint
  a.px(F.x - 13, F.y - 12, '#ffffff'); a.px(F.x - 12, F.y - 13, '#ffffff'); a.px(F.x - 14, F.y - 10, '#fffbe8');
  // ---- chains, rings and pine-cone weights in front
  WEIGHTS.forEach((w, i) => {
    const drop = s.drop[i], len = 10 + drop;
    chain(a, w.x, CHAIN_TOP, CHAIN_TOP + len);
    const pc = new Art(15, 26);
    pineCone(pc, 7, 1);
    pc.outline(INK);
    a.stamp(pc, w.x - 7, CHAIN_TOP + len - 1);
    const rlen = 44 - drop;
    chain(a, w.ring, CHAIN_TOP, CHAIN_TOP + rlen);
    a.disc(w.ring, CHAIN_TOP + rlen + 2.5, 3, (x, y) => (Math.hypot(x + 0.5 - w.ring, y + 0.5 - CHAIN_TOP - rlen - 2.5) > 1.6 ? dtone('brass', 3.4 + lit(x - w.ring, y - CHAIN_TOP - rlen, 3), x, y) : null));
  });
}

/** The chain drop range for a weight (px). */
export const DROP_MIN = 0, DROP_MAX = 34;
