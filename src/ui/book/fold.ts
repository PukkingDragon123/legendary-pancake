// Geometry of a page being turned by its corner (the classic page-curl fold).
//
// Coordinates are page-local CSS px of the RIGHT page of a spread: x runs from the spine (0) to the
// fore edge (W), y from the head (0) to the tail (H). The leaf is grabbed at a corner of the fore
// edge (bottom (W, H) or top (W, 0)) and that corner is dragged to P. The fold line is the
// perpendicular bisector of corner -> P; the part of the page on the corner's side flips over and
// shows the leaf's back face (the next spread's left page), mirrored across the fold.
//
// A fully turned leaf has P at (-W, y): the flap then lies exactly over the left page.
export interface Pt { x: number; y: number }
export type Corner = 'bottom' | 'top';

export interface Fold {
  /** the part of the leaf's front that still lies flat (page-local polygon) */
  front: Pt[];
  /** the flap, as a polygon in the back face's own local coordinates (for its clip-path) */
  back: Pt[];
  /** the flap, as a polygon in page-local coordinates (for its shadow) */
  flap: Pt[];
  /** CSS matrix(a, b, c, d, e, f) placing the back face (its local coords -> page-local) */
  matrix: [number, number, number, number, number, number];
  /** a point on the fold line and the unit normal pointing to the corner's (lifted) side */
  m: Pt;
  n: Pt;
  /** the dragged corner after constraints */
  p: Pt;
  /** 0 flat .. 1 fully turned */
  t: number;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Keep the corner where a real sheet hinged at the spine could put it. */
export function constrain(p: Pt, corner: Corner, W: number, H: number): Pt {
  let q = { x: p.x, y: p.y };
  // the corner's own spine end holds the sheet: |q - near| <= W
  const near = corner === 'bottom' ? { x: 0, y: H } : { x: 0, y: 0 };
  const far = corner === 'bottom' ? { x: 0, y: 0 } : { x: 0, y: H };
  // a flat sheet cannot slide past its own head or tail line
  if (corner === 'bottom') q.y = Math.min(q.y, H); else q.y = Math.max(q.y, 0);
  const d1 = dist(q, near);
  if (d1 > W) q = { x: near.x + ((q.x - near.x) / d1) * W, y: near.y + ((q.y - near.y) / d1) * W };
  const diag = Math.hypot(W, H), d2 = dist(q, far);
  if (d2 > diag) q = { x: far.x + ((q.x - far.x) / d2) * diag, y: far.y + ((q.y - far.y) / d2) * diag };
  return q;
}

/** Clip a convex polygon to the half-plane (q - m) . n >= 0 (keep = 1) or <= 0 (keep = -1). */
export function clipHalf(poly: Pt[], m: Pt, n: Pt, keep: 1 | -1): Pt[] {
  const out: Pt[] = [];
  const side = (q: Pt) => ((q.x - m.x) * n.x + (q.y - m.y) * n.y) * keep;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

export function fold(drag: Pt, corner: Corner, W: number, H: number): Fold {
  const c0 = corner === 'bottom' ? { x: W, y: H } : { x: W, y: 0 };
  const p = constrain(drag, corner, W, H);
  const rect: Pt[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  const dx = c0.x - p.x, dy = c0.y - p.y, len = Math.hypot(dx, dy);
  const t = Math.max(0, Math.min(1, (W - p.x) / (2 * W)));
  if (len < 0.5) {
    return { front: rect, back: [], flap: [], matrix: [1, 0, 0, 1, 0, 0], m: c0, n: { x: 1, y: 0 }, p, t: 0 };
  }
  const n = { x: dx / len, y: dy / len };
  const m = { x: (c0.x + p.x) / 2, y: (c0.y + p.y) / 2 };
  const front = clipHalf(rect, m, n, -1);
  const lifted = clipHalf(rect, m, n, 1);
  // reflection across the fold line: R(q) = q - 2((q - m) . n) n
  const refl = (q: Pt): Pt => { const k = 2 * ((q.x - m.x) * n.x + (q.y - m.y) * n.y); return { x: q.x - k * n.x, y: q.y - k * n.y }; };
  const flap = lifted.map(refl);
  // back face local (u, v) is the left page: u = W - x. Its point (u, v) lands at R(W - u, v).
  const back = lifted.map((q) => ({ x: W - q.x, y: q.y }));
  const a = 2 * n.x * n.x - 1, b = 2 * n.x * n.y, c = -2 * n.x * n.y, d = 1 - 2 * n.y * n.y;
  const o = refl({ x: W, y: 0 });
  return { front, back, flap, matrix: [a, b, c, d, o.x, o.y], m, n, p, t };
}

/** Where the grabbed corner travels when a turn plays by itself (tap, swipe, keyboard). */
export function turnPath(k: number, corner: Corner, W: number, H: number, from: number, to: number): Pt {
  // from/to are x positions of the corner (W = flat on the right, -W = fully turned)
  const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const x = from + (to - from) * e;
  const lift = Math.sin(Math.PI * Math.min(1, Math.abs((x - W) / (2 * W)) * 1.0)) * H * 0.16;
  const y = corner === 'bottom' ? H - lift : lift;
  return constrain({ x, y }, corner, W, H);
}

const fx = (v: number) => (Math.round(v * 10) / 10).toString();
export const polyCSS = (poly: Pt[]) => (poly.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${poly.map((q) => `${fx(q.x)}px ${fx(q.y)}px`).join(', ')})`);

/**
 * A CSS linear-gradient for a W x H box that starts at the fold line and runs along `dir`
 * (unit, screen coords). `stops` are [offset px from the fold, css colour] pairs.
 */
export function foldGradient(W: number, H: number, m: Pt, dir: Pt, stops: [number, string][]): string {
  const ang = Math.atan2(dir.x, -dir.y); // css: 0deg points up, 90deg right
  const L = Math.abs(W * Math.sin(ang)) + Math.abs(H * Math.cos(ang));
  const s0 = (m.x - W / 2) * dir.x + (m.y - H / 2) * dir.y + L / 2;
  const list = stops.map(([o, c]) => `${c} ${fx(s0 + o)}px`).join(', ');
  return `linear-gradient(${fx((ang * 180) / Math.PI)}deg, ${list})`;
}
