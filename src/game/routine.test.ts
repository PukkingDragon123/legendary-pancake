import { describe, expect, it } from 'vitest';
import { alarmDays, copyNight, nextWakeFromRoutine, nightDay, nightLength, planFor, setNight, sleepStats, stickerFor, toHHMM, toMin, WEEKNIGHTS } from './routine.ts';
import type { DayPlan } from './store.ts';
import type { SleepSession } from '../sleep/types.ts';

const R = (): DayPlan[] => [0, 1, 2, 3, 4, 5, 6].map((d) => ({ on: true, bed: d === 5 || d === 6 ? '23:30' : '23:00', wake: d === 0 || d === 6 ? '08:00' : '07:00' }));
const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime();

describe('routine', () => {
  it('formats and measures nights', () => {
    expect(toMin('07:30')).toBe(450);
    expect(toHHMM(-30)).toBe('23:30');
    expect(nightLength('23:00', '07:00')).toBe(480);
    expect(nightLength('01:00', '09:00')).toBe(480);
  });
  it('counts the small hours as the previous night', () => {
    // 2026-11-23 is a Monday
    expect(nightDay(at(2026, 11, 23, 2))).toBe(0);
    expect(nightDay(at(2026, 11, 23, 9))).toBe(1);
  });
  it('plans a night from bedtime to the next morning', () => {
    const p = planFor(R(), 5); // Friday night -> Saturday morning
    expect(p).toMatchObject({ bed: '23:30', wake: '08:00', min: 510, on: true });
  });
  it('edits and copies nights', () => {
    let r = setNight(R(), 1, { bed: '22:15', wake: '06:30' });
    expect(r[1].bed).toBe('22:15');
    expect(r[2].wake).toBe('06:30');
    r = copyNight(r, 1, WEEKNIGHTS);
    for (const d of WEEKNIGHTS) expect(planFor(r, d)).toMatchObject({ bed: '22:15', wake: '06:30' });
    expect(planFor(r, 5).bed).toBe('23:30');
  });
  it('finds the next wake-up from planned nights only', () => {
    let r = R();
    // Monday 22:00: next wake is Tuesday 07:00
    const mon = at(2026, 11, 23, 22);
    expect(new Date(nextWakeFromRoutine(r, mon)!).getDate()).toBe(24);
    // Monday night off: Tuesday night is the next planned one, so Wednesday morning
    r = setNight(r, 1, { on: false });
    const t = new Date(nextWakeFromRoutine(r, mon)!);
    expect([t.getDate(), t.getHours()]).toEqual([25, 7]);
    expect(alarmDays(r)).not.toContain(2);
    expect(nextWakeFromRoutine(r.map((p) => ({ ...p, on: false })), mon)).toBeNull();
  });
  it('summarises nights', () => {
    const now = at(2026, 11, 21, 10);
    const night = (daysAgo: number, hours: number, score: number): SleepSession => {
      const end = now - daysAgo * 86400_000 - 3 * 3600_000, start = end - hours * 3600_000;
      return { id: 'n' + daysAgo, start, end, smartWindowMin: 0, micUsed: true, epochs: [], events: [], report: { score, inBed: hours * 3.6e6, asleep: hours * 3.6e6, asleepAt: start, wokeAt: end, latencyMin: 10, efficiency: 0.9, deep: 0.2, light: 0.5, rem: 0.2, awake: 0.1, awakenings: 1, snoreMin: 0, talkCount: 0, loudestDb: 0, avgDb: 0, quality: 'good', notes: [] } };
    };
    const s = sleepStats([night(0, 8, 90), night(1, 7, 75), night(2, 6, 60), night(5, 8, 80)], 480, now);
    expect(s.weekNights).toBe(4);
    expect(Math.round(s.weekTotal / 3.6e6)).toBe(29);
    expect(s.run).toBe(3);
    expect(s.bestRun).toBe(3);
    expect(s.goalRate).toBeCloseTo(0.5);
    expect(stickerFor(90)).toBe('gold');
    expect(stickerFor(40)).toBe('rain');
  });
});
