import { describe, expect, it } from 'vitest';
import { fromWmo, seasonalWeather } from './weather.ts';

describe('weather', () => {
  it('maps WMO codes from Open-Meteo', () => {
    expect(fromWmo(0).kind).toBe('clear');
    expect(fromWmo(3).kind).toBe('clouds');
    expect(fromWmo(45).kind).toBe('fog');
    expect(fromWmo(63).kind).toBe('rain');
    expect(fromWmo(75).kind).toBe('snow');
    expect(fromWmo(95).kind).toBe('storm');
    expect(fromWmo(61, 4, 12)).toMatchObject({ source: 'live', temp: 4, windKmh: 12 });
  });
  it('generates the same weather for the same moment, and it changes through the year', () => {
    const a = seasonalWeather(new Date(2026, 10, 21, 14), 50), b = seasonalWeather(new Date(2026, 10, 21, 14), 50);
    expect(a).toEqual(b);
    const kinds = new Set<string>();
    let snow = 0, summerSnow = 0;
    for (let d = 0; d < 365; d += 3) for (const h of [7, 13, 19]) {
      const w = seasonalWeather(new Date(2026, 0, 1 + d, h), 52);
      kinds.add(w.kind);
      expect(w.intensity).toBeGreaterThanOrEqual(0);
      expect(w.intensity).toBeLessThanOrEqual(1);
      if (w.kind === 'snow') { snow++; if (d > 150 && d < 240) summerSnow++; }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    expect(snow).toBeGreaterThan(0);
    expect(summerSnow).toBe(0);
  });
  it('never snows in the tropics', () => {
    for (let d = 0; d < 365; d += 5) expect(seasonalWeather(new Date(2026, 0, 1 + d, 6), 5).kind).not.toBe('snow');
  });
});
