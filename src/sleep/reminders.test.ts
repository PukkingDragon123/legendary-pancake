import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Reminders } from './reminders.ts';
import type { ReminderKind } from './reminders.ts';
import * as api from './index.ts';

const local = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo, d, h, mi).getTime();
const MIN = 60_000;

describe('Reminders (no DOM: in-app timers only)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(local(2026, 10, 20, 21, 0)); // Friday 21:00
  });
  afterEach(() => vi.useRealTimers());

  it('lists upcoming wind-down/bedtime pairs, including wind-downs before midnight for after-midnight bedtimes', () => {
    const r = new Reminders({ onFire: () => undefined });
    expect(r.upcoming()).toEqual([]); // disabled by default
    r.configure({ bedtime: '0:15', windDownMin: 45, enabled: true });
    expect(r.config.bedtime).toBe('00:15');
    expect(r.upcoming(3)).toEqual([
      { kind: 'winddown', at: local(2026, 10, 20, 23, 30) },
      { kind: 'bedtime', at: local(2026, 10, 21, 0, 15) },
      { kind: 'winddown', at: local(2026, 10, 21, 23, 30) },
    ]);
    r.configure({ bedtime: '22:30', windDownMin: 30, days: [0, 1, 2, 3, 4] }); // school nights only (Sun-Thu)
    expect(r.upcoming(2)).toEqual([
      { kind: 'winddown', at: local(2026, 10, 22, 22, 0) },
      { kind: 'bedtime', at: local(2026, 10, 22, 22, 30) },
    ]);
    expect(r.next).toEqual({ kind: 'winddown', at: local(2026, 10, 22, 22, 0) });
    r.dispose();
  });

  it('fires wind-down then bedtime on time, and keeps going the next day', () => {
    const fired: { kind: ReminderKind; at: number }[] = [];
    const r = new Reminders({ onFire: (kind) => fired.push({ kind, at: Date.now() }) });
    r.configure({ bedtime: '22:30', windDownMin: 30, days: [], enabled: true });
    vi.advanceTimersByTime(60 * MIN - 1);
    expect(fired).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual([{ kind: 'winddown', at: local(2026, 10, 20, 22, 0) }]);
    vi.advanceTimersByTime(30 * MIN);
    expect(fired[1]).toEqual({ kind: 'bedtime', at: local(2026, 10, 20, 22, 30) });
    vi.advanceTimersByTime(24 * 60 * MIN);
    expect(fired.map((f) => f.kind)).toEqual(['winddown', 'bedtime', 'winddown', 'bedtime']);
    r.configure({ enabled: false });
    vi.advanceTimersByTime(48 * 60 * MIN);
    expect(fired).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(0);
    r.dispose();
  });

  it('skips a reminder discovered long after the fact (device asleep) instead of nagging at 3 AM', () => {
    const fired: ReminderKind[] = [];
    const r = new Reminders({ onFire: (k) => fired.push(k) });
    r.configure({ bedtime: '22:30', windDownMin: 0, enabled: true });
    vi.setSystemTime(local(2026, 10, 21, 3, 0)); // jump past bedtime without timers running
    vi.advanceTimersByTime(MIN);
    expect(fired).toEqual([]);
    expect(r.next).toEqual({ kind: 'bedtime', at: local(2026, 10, 21, 22, 30) });
    r.dispose();
  });

  it('sanitizes bad config values', () => {
    const r = new Reminders({ onFire: () => undefined });
    const c = r.configure({ bedtime: 'late', windDownMin: 999, days: [9, 2, 2, -1, 5] });
    expect(c).toEqual({ bedtime: '22:30', windDownMin: 180, days: [2, 5], enabled: false });
    r.dispose();
  });
});

describe('public API', () => {
  it('imports without a DOM and exposes the engine', () => {
    for (const name of ['FrameAnalyzer', 'analyze', 'simulateNight', 'demoNight', 'SleepRecorder', 'saveClip', 'getClip', 'listClips', 'deleteClipsBefore', 'AlarmClock', 'nextOccurrence', 'Reminders', 'registerSW', 'EPOCH_MS']) {
      expect(api).toHaveProperty(name);
    }
    const demo = api.demoNight({ seed: 2, now: local(2026, 10, 20, 9, 0) });
    expect(demo.report?.score).toBeGreaterThan(0);
    expect(demo.stages?.length).toBe(Math.ceil((demo.end! - demo.start) / api.EPOCH_MS));
    expect(new Date(demo.end!).getHours()).toBe(6);
  });
});
