import { describe, expect, it } from 'vitest';
import { guessPlace, moonLit, moonPhase, seasonOf, skyHour, sunDay } from './astro.ts';

describe('astro', () => {
  it('puts sunrise and sunset in a sensible place', () => {
    // London, midsummer and midwinter (local time offsets come from the test machine, so compare day length)
    const summer = sunDay(new Date(2026, 5, 21, 12), 51.5, -0.1);
    const winter = sunDay(new Date(2026, 11, 21, 12), 51.5, -0.1);
    expect(summer.set - summer.rise).toBeGreaterThan(16);
    expect(summer.set - summer.rise).toBeLessThan(17.2);
    expect(winter.set - winter.rise).toBeGreaterThan(7.5);
    expect(winter.set - winter.rise).toBeLessThan(8.3);
    expect(summer.maxEl).toBeGreaterThan(60);
    expect(winter.maxEl).toBeLessThan(16);
  });
  it('handles the polar night', () => {
    expect(sunDay(new Date(2026, 11, 21, 12), 78, 15).polar).toBe('night');
    expect(sunDay(new Date(2026, 5, 21, 12), 78, 15).polar).toBe('day');
  });
  it('maps the real sun onto the sky keyframes', () => {
    const sun = { rise: 7.5, set: 16.5, noon: 12, twilight: 0.8, maxEl: 20, polar: null };
    expect(skyHour(7.5, sun)).toBeCloseTo(6.2, 5);
    expect(skyHour(16.5, sun)).toBeCloseTo(18.8, 5);
    expect(skyHour(12, sun)).toBeCloseTo(12.6, 5);
    const night = skyHour(23, sun);
    expect(night > 20.4 || night < 4.6).toBe(true);
    const pre = skyHour(7.0, sun);
    expect(pre).toBeGreaterThan(4.6);
    expect(pre).toBeLessThan(6.2);
    // monotonic through the day
    let last = -1;
    for (let h = 6.8; h < 17.2; h += 0.25) { const s = skyHour(h, sun); expect(s).toBeGreaterThan(last); last = s; }
  });
  it('knows the moon', () => {
    // 2024-04-08 was a new moon (total eclipse), 2024-04-23 a full moon
    const n = moonPhase(new Date(Date.UTC(2024, 3, 8, 18)));
    expect(Math.min(n, 1 - n)).toBeLessThan(0.03);
    const f = moonPhase(new Date(Date.UTC(2024, 3, 23, 23)));
    expect(Math.abs(f - 0.5)).toBeLessThan(0.03);
    expect(moonLit(0.5)).toBeCloseTo(1, 5);
    expect(moonLit(0)).toBeCloseTo(0, 5);
  });
  it('flips the seasons south of the equator', () => {
    expect(seasonOf(new Date(2026, 10, 21), 50).season).toBe('autumn');
    expect(seasonOf(new Date(2026, 10, 21), -33).season).toBe('spring');
    expect(seasonOf(new Date(2026, 0, 10), 50).season).toBe('winter');
    expect(seasonOf(new Date(2026, 6, 10), 50).season).toBe('summer');
    expect(seasonOf(new Date(2026, 0, 10), 50).cold).toBeGreaterThan(0.6);
    expect(seasonOf(new Date(2026, 6, 10), 50).cold).toBe(0);
  });
  it('guesses a place from the timezone', () => {
    expect(guessPlace('Australia/Sydney').lat).toBeLessThan(0);
    expect(guessPlace('Europe/Berlin').lat).toBeGreaterThan(45);
    expect(guessPlace('Australia/Lord_Howe').lat).toBeLessThan(0);
    expect(guessPlace(undefined, 'en-NZ').lat).toBeLessThan(0);
  });
});
