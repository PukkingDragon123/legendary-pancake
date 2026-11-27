import { describe, expect, it } from 'vitest';
import { cleanDiary } from '../../game/store.ts';
import { diaryDays, nightDayKey, winsFor, ymd, type WinSave } from './wins.ts';

const routine = [0, 1, 2, 3, 4, 5, 6].map(() => ({ on: true, bed: '23:00', wake: '07:00' }));
function night(asleepAt: Date, hours: number, o: Partial<{ score: number; latency: number; awakenings: number; eff: number; deep: number; mic: boolean; demo: boolean }> = {}) {
  const wokeAt = asleepAt.getTime() + hours * 3.6e6;
  return {
    id: 'n' + asleepAt.getTime(), start: asleepAt.getTime() - 10 * 60_000, end: wokeAt + 5 * 60_000, smartWindowMin: 20, micUsed: o.mic ?? true, epochs: [], events: [], simulated: o.demo,
    report: { score: o.score ?? 80, inBed: hours * 3.6e6, asleep: hours * 3.6e6, asleepAt: asleepAt.getTime(), wokeAt, latencyMin: o.latency ?? 10, efficiency: o.eff ?? 0.92, deep: o.deep ?? 0.22, light: 0.5, rem: 0.2, awake: 0.08, awakenings: o.awakenings ?? 1, snoreMin: 0, talkCount: 0, loudestDb: 0, avgDb: 0, quality: 'good' as const, notes: [] },
  };
}
const base = (nights: ReturnType<typeof night>[], extra: Partial<WinSave> = {}): WinSave => ({
  nights, routine, streak: 0, breath: { sessions: 0, minutes: 0, pattern: 'settle', durationMin: 3, haptics: true, voice: true }, diary: {},
  sleep: { goalMin: 480 }, settings: { hour12: false }, ...extra,
});

describe('diary wins', () => {
  const today = '2026-11-27';
  it('lists what went well last night', () => {
    const n = night(new Date(2026, 10, 26, 22, 50), 8.1, { score: 88 });
    expect(nightDayKey(n)).toBe(today);
    const w = winsFor(base([n], { streak: 3 }), today, { today, now: new Date(2026, 10, 27, 9).getTime() });
    const ids = w.great.map((x) => x.id);
    expect(ids).toEqual(['goal', 'score', 'ontime', 'streak', 'quick', 'through', 'deep']);
    expect(w.great.find((x) => x.id === 'score')!.text).toContain('wonderful');
    expect(w.aims[0].text).toBe('In bed by 23:00');
  });
  it('is kind when the night was short and late', () => {
    const n = night(new Date(2026, 10, 27, 1, 30), 5, { score: 45, latency: 40, awakenings: 4, eff: 0.7, deep: 0.1, mic: false });
    const w = winsFor(base([n]), today, { today });
    expect(w.great).toEqual([]);
    expect(w.aims.length).toBeGreaterThan(0);
  });
  it('counts breathing, the wind-down and a diary line', () => {
    const s = base([], { breath: { sessions: 1, minutes: 3, pattern: 'settle', durationMin: 3, haptics: true, voice: true, lastDay: today }, diary: { [today]: { note: 'Long walk', at: 1 } } });
    const w = winsFor(s, today, { today, ritual: ['lights', 'phone', 'breathe'] });
    expect(w.great.map((x) => x.id)).toEqual(['breath', 'ritual', 'note']);
    expect(w.aims.map((x) => x.id)).toEqual(['aim-bed']);
  });
  it('past days have no aims', () => {
    const w = winsFor(base([]), '2026-11-20', { today });
    expect(w.aims).toEqual([]);
  });
  it('lists diary days newest first', () => {
    const n = night(new Date(2026, 10, 24, 23, 0), 7);
    const days = diaryDays({ nights: [n], diary: { '2026-11-22': { note: 'hi', at: 1 }, '2026-11-23': { note: '  ', at: 1 }, '2026-12-01': { note: 'future', at: 1 } } }, today);
    expect(days).toEqual([today, ymd(n.report.wokeAt), '2026-11-22']);
  });
  it('keeps only well-formed diary pages from a stored save', () => {
    expect(cleanDiary({ '2026-11-27': { note: 'ok', at: 5 }, bad: { note: 'x' }, '2026-11-26': { note: 3 }, '2026-11-25': null })).toEqual({ '2026-11-27': { note: 'ok', at: 5 } });
    expect(cleanDiary(undefined)).toEqual({});
  });
});
