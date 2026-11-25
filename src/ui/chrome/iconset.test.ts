// [icons8] The pixel-art icons are always drawn at a whole number of device pixels per art pixel, as near the asked size
// as that allows (and never over a fixed box).
import { describe, expect, it } from 'vitest';
import { pickArt } from './iconset.ts';

describe('pickArt', () => {
  it('draws one of the two drawings at a whole scale, near the asked size', () => {
    for (let dev = 20; dev <= 200; dev++) {
      const p = pickArt(dev), art = p.size === 'big' ? 32 : 20;
      expect(Number.isInteger(p.k)).toBe(true);
      expect(p.px).toBe(art * p.k);
      expect(Math.abs(Math.log(p.px / dev))).toBeLessThan(0.3); // nothing lies between the 20 and 32 px drawings
    }
  });
  it('keeps within a fixed box', () => {
    for (let dev = 20; dev <= 200; dev++) {
      const p = pickArt(dev, true);
      expect(p.px).toBeLessThanOrEqual(dev);
      expect(p.px / dev).toBeGreaterThan(0.62); // just under 32 px only the 20 px drawing fits
    }
  });
  it('prefers the detailed drawing once the small one would be blown up', () => {
    expect(pickArt(32).size).toBe('big');
    expect(pickArt(64)).toMatchObject({ size: 'big', k: 2 });
    expect(pickArt(96)).toMatchObject({ size: 'big', k: 3 });
    expect(pickArt(20)).toMatchObject({ size: 'small', k: 1 });
  });
  it('shrinks the small drawing smoothly below its size', () => {
    const p = pickArt(16);
    expect(p.size).toBe('small');
    expect(p.k).toBeLessThan(1);
    expect(p.px).toBe(16);
  });
});
