import { describe, expect, it } from 'vitest';
import { cardFor, hits, spotFor, spotOnCard, union, type Rect } from './layout.ts';

const within = (b: Rect, W: number, H: number) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
// the things the tour shows, as they sit on a phone (390 x 844) and a desktop (1280 x 800)
const PHONE = { W: 390, H: 844, s: 60, cw: 370, ch: 150, things: [
  { x: 27, y: 706, w: 104, h: 108 }, { x: 143, y: 706, w: 104, h: 108 }, { x: 259, y: 706, w: 104, h: 108 }, // lamp, clock, book
  { x: 324, y: 132, w: 60, h: 468 }, { x: 324, y: 132, w: 60, h: 78 }, { x: 324, y: 522, w: 60, h: 78 }, // tools
  { x: 1, y: 14, w: 78, h: 78 }, { x: 10, y: 14, w: 60, h: 44 }, // portrait, a Back button
] };
const DESK = { W: 1280, H: 800, s: 80, cw: 400, ch: 160, things: [
  { x: 420, y: 590, w: 120, h: 160 }, { x: 590, y: 590, w: 100, h: 160 }, { x: 750, y: 590, w: 120, h: 160 },
  { x: 1210, y: 200, w: 60, h: 470 }, { x: 1210, y: 200, w: 60, h: 70 }, { x: 10, y: 10, w: 120, h: 120 },
] };

describe('where Pip lands and where his card goes', () => {
  for (const [name, L] of [['phone', PHONE], ['desktop', DESK]] as const) {
    it(`never covers the thing to tap, and stays on screen (${name})`, () => {
      for (const t of L.things) {
        const sp = spotFor(t, L.s, L.W, L.H);
        expect(hits(sp.box, t, -2), JSON.stringify(t)).toBe(false);
        expect(within(sp.box, L.W, L.H), JSON.stringify(t)).toBe(true);
        const c = cardFor(union(t, sp.box), [t, sp.box], L.cw, L.ch, L.W, L.H);
        const card = { x: c.x, y: c.y, w: c.w, h: L.ch };
        expect(hits(card, t), `card over ${JSON.stringify(t)}`).toBe(false);
        expect(within(card, L.W, L.H)).toBe(true);
      }
    });
  }
  it('stands on top of the shelf objects, and beside a tool in the column', () => {
    expect(spotFor(PHONE.things[0], 60, 390, 844).on).toBe('top');
    expect(spotFor(PHONE.things[4], 60, 390, 844).on).toBe('left');
    expect(spotFor(DESK.things[4], 80, 1280, 800).face).toBe(1);
  });
  it('perches on the card rail when there is nothing to show', () => {
    const sp = spotOnCard({ x: 10, y: 100, w: 370, h: 150 }, 60);
    expect(sp.y).toBeGreaterThan(100);
    expect(sp.box.y + sp.box.h).toBeLessThan(110);
  });
});
