// [tutor] Where Pip lands and where his card goes, from the box of the thing he shows. Pure geometry (CSS px), so it
// can be tested: Pip never stands on or over the thing to tap, the card never covers it or him, and both stay on
// screen with a margin.
import type { Goal } from './guide.ts';

export interface Rect { x: number; y: number; w: number; h: number }
export interface Spot extends Goal { on: 'top' | 'left' | 'right' | 'below' | 'card'; box: Rect }

export const M = 10;
export const hits = (a: Rect, b: Rect, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
export const union = (a: Rect, b: Rect): Rect => { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; };
/** Pip's box with his feet at (x, y) and standing height s */
export const pipBox = (x: number, y: number, s: number): Rect => ({ x: x - s * 0.42, y: y - s * 1.05, w: s * 0.84, h: s * 1.05 });
const inside = (b: Rect, W: number, H: number) => b.x >= M - 0.5 && b.y >= M * 0.4 && b.x + b.w <= W - M + 0.5 && b.y + b.h <= H - M * 0.4;

/**
 * Where Pip goes to show `t`: standing on top of it when there is room above and it is not one of a column of
 * tools (he would stand on the next one), else hovering beside it on the side with room (pointing at it), else below.
 */
export function spotFor(t: Rect, s: number, W: number, H: number): Spot {
  const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  const column = t.x + t.w > W - 8 - Math.max(70, t.w * 0.2) && t.w < W * 0.3;
  const at = { x: cx, y: cy };
  const cand: Spot[] = [];
  const top = (): void => { const y = t.y + 2; cand.push({ x: cx, y, mode: 'perch', face: 0, at, on: 'top', box: pipBox(cx, y, s) }); };
  const side = (d: -1 | 1): void => {
    const x = d < 0 ? t.x - s * 0.5 - 6 : t.x + t.w + s * 0.5 + 6;
    const y = Math.min(H - M, Math.max(s * 1.1, cy + s * 0.45));
    cand.push({ x, y, mode: 'hover', face: (d < 0 ? 1 : -1) as -1 | 1, at, on: d < 0 ? 'left' : 'right', box: pipBox(x, y, s) });
  };
  const below = (): void => { const y = t.y + t.h + s * 1.1 + 8; cand.push({ x: cx, y, mode: 'hover', face: 0, at, on: 'below', box: pipBox(cx, y, s) }); };
  const roomL = t.x, roomR = W - t.x - t.w;
  const sides = roomL >= roomR ? [-1, 1] as const : [1, -1] as const;
  if (!column) top();
  for (const d of sides) side(d);
  below();
  if (column) top();
  return cand.find((c) => inside(c.box, W, H) && !hits(c.box, t, -2)) ?? cand[cand.length - 1];
}

/**
 * Where the card goes (its top-left and width), clear of everything in `avoid`, near `near`: above, below, then
 * beside (narrowed down to `minW` if it must), then wherever there is most room.
 */
export function cardFor(near: Rect, avoid: Rect[], cw: number, ch: number, W: number, H: number, minW = 250): { x: number; y: number; w: number; side: 'above' | 'below' | 'left' | 'right' | 'free' } {
  const clampX = (x: number, w: number) => Math.max(M, Math.min(W - M - w, x));
  const cx = near.x + near.w / 2;
  const ok = (b: Rect) => inside(b, W, H) && !avoid.some((a) => hits(a, b, 6));
  const tries: { x: number; y: number; w: number; side: 'above' | 'below' | 'left' | 'right' }[] = [];
  const preferBelow = near.y + near.h / 2 < H * 0.42;
  const above = () => tries.push({ x: clampX(cx - cw / 2, cw), y: near.y - 14 - ch, w: cw, side: 'above' });
  const below = () => tries.push({ x: clampX(cx - cw / 2, cw), y: near.y + near.h + 14, w: cw, side: 'below' });
  const big = near.h > H * 0.35;
  if (!big) { if (preferBelow) { below(); above(); } else { above(); below(); } }
  const yMid = (h: number) => Math.max(M, Math.min(H - M - h, near.y + near.h / 2 - h / 2));
  const roomL = near.x - 14 - M, roomR = W - M - (near.x + near.w + 14);
  // beside: as wide as it can be up to its own width (a narrower card grows taller: guess the height from the area)
  const sideTry = (room: number, d: -1 | 1) => {
    if (room < minW) return;
    const w = Math.min(cw, room), h = ch * Math.max(1, cw / w) * 1.08;
    tries.push({ x: d < 0 ? near.x - 14 - w : near.x + near.w + 14, y: yMid(h), w, side: d < 0 ? 'left' : 'right' });
  };
  if (roomL >= roomR) { sideTry(roomL, -1); sideTry(roomR, 1); } else { sideTry(roomR, 1); sideTry(roomL, -1); }
  if (big) { above(); below(); }
  for (const t of tries) {
    const h = t.side === 'left' || t.side === 'right' ? ch * Math.max(1, cw / t.w) * 1.08 : ch;
    if (ok({ x: t.x, y: t.y, w: t.w, h })) return t;
  }
  // nothing clean: the bigger gap above or below, clamped to the screen
  const up = near.y, down = H - near.y - near.h;
  const y = down >= up ? Math.min(H - M - ch, near.y + near.h + 14) : Math.max(M, near.y - 14 - ch);
  return { x: clampX(cx - cw / 2, cw), y, w: cw, side: 'free' };
}

/** Pip standing on the card's top rail (its right end, or the left when he shows something on the left). */
export function spotOnCard(card: Rect, s: number, face: -1 | 0 | 1 = 0, at: { x: number; y: number } | null = null): Spot {
  const x = face < 0 ? card.x + s * 0.62 : card.x + card.w - s * 0.62, y = card.y + 5;
  return { x, y, mode: 'perch', face, at, on: 'card', box: pipBox(x, y, s) };
}
