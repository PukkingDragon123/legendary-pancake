import { describe, expect, it } from 'vitest';
import { clipHalf, constrain, fold, foldGradient, turnPath } from './fold.ts';

const W = 300, H = 400;
const area = (poly: { x: number; y: number }[]) => Math.abs(poly.reduce((a, p, i) => { const q = poly[(i + 1) % poly.length]; return a + p.x * q.y - q.x * p.y; }, 0) / 2);
const apply = (m: number[], u: number, v: number) => ({ x: m[0] * u + m[2] * v + m[4], y: m[1] * u + m[3] * v + m[5] });

describe('page fold', () => {
  it('is flat when the corner has not moved', () => {
    const f = fold({ x: W, y: H }, 'bottom', W, H);
    expect(f.t).toBe(0);
    expect(f.back.length).toBe(0);
    expect(area(f.front)).toBeCloseTo(W * H, 3);
  });

  it('a fully turned leaf lies exactly over the left page', () => {
    const f = fold({ x: -W, y: H }, 'bottom', W, H);
    expect(f.t).toBeCloseTo(1, 6);
    expect(area(f.front)).toBeCloseTo(0, 3);
    // the back face is placed by a pure translation of -W
    const [a, b, c, d, e, g] = f.matrix;
    expect([a, b, c, d]).toEqual([1, 0, -0, 1]);
    expect(e).toBeCloseTo(-W, 6);
    expect(g).toBeCloseTo(0, 6);
  });

  it('front and flap always split the page area', () => {
    for (const p of [{ x: 200, y: 330 }, { x: 40, y: 250 }, { x: -120, y: 380 }, { x: 260, y: 400 }]) {
      const f = fold(p, 'bottom', W, H);
      expect(area(f.front) + area(f.back)).toBeCloseTo(W * H, 1);
    }
  });

  it('the back face matrix is a rotation and maps the grabbed corner onto the drag point', () => {
    const f = fold({ x: 120, y: 300 }, 'bottom', W, H);
    const [a, b, c, d] = f.matrix;
    expect(a * d - b * c).toBeCloseTo(1, 6);
    // back-local (0, H) is the leaf's corner (x = W on the front): it lands where the corner was dragged
    const q = apply(f.matrix, 0, H);
    expect(q.x).toBeCloseTo(f.p.x, 4);
    expect(q.y).toBeCloseTo(f.p.y, 4);
  });

  it('keeps the corner within reach of the spine', () => {
    const q = constrain({ x: -900, y: -500 }, 'bottom', W, H);
    expect(Math.hypot(q.x, q.y - H)).toBeLessThanOrEqual(W + 1e-6);
    const r = constrain({ x: 100, y: 999 }, 'bottom', W, H);
    expect(r.y).toBeLessThanOrEqual(H);
    const s = constrain({ x: 100, y: -99 }, 'top', W, H);
    expect(s.y).toBeGreaterThanOrEqual(0);
  });

  it('clips a square by a half plane', () => {
    const sq = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    expect(area(clipHalf(sq, { x: 1, y: 0 }, { x: 1, y: 0 }, 1))).toBeCloseTo(2, 6);
    expect(area(clipHalf(sq, { x: 1, y: 0 }, { x: 1, y: 0 }, -1))).toBeCloseTo(2, 6);
  });

  it('a played turn starts flat and ends fully turned', () => {
    const a = turnPath(0, 'bottom', W, H, W, -W), b = turnPath(1, 'bottom', W, H, W, -W);
    expect(a.x).toBeCloseTo(W, 4);
    expect(b.x).toBeCloseTo(-W, 4);
    expect(turnPath(0.5, 'bottom', W, H, W, -W).y).toBeLessThan(H);
  });

  it('builds a gradient string', () => {
    expect(foldGradient(W, H, { x: 100, y: 0 }, { x: 1, y: 0 }, [[0, 'red'], [20, 'blue']])).toMatch(/^linear-gradient\(90deg, red 100px, blue 120px\)$/);
  });
});
