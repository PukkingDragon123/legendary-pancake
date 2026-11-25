// [icons8, icons9] The realistic icons are drawn smoothly at exactly the device size asked for, from their 256 px drawing.
import { describe, expect, it } from 'vitest';
import { pickArt } from './iconset.ts';

describe('pickArt', () => {
  it('draws at exactly the device size asked for', () => {
    for (let dev = 8; dev <= 400; dev++) {
      const p = pickArt(dev);
      expect(p.px).toBe(dev);
      expect(p.k).toBeCloseTo(dev / 256, 6);
    }
  });
  it('rounds fractional sizes and never goes below 8 px', () => {
    expect(pickArt(30.4).px).toBe(30);
    expect(pickArt(132).px).toBe(132); // 44 CSS px at a density of 3
    expect(pickArt(3).px).toBe(8);
  });
});
