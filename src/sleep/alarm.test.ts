import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlarmClock, nextOccurrence, parseHHMM } from './alarm.ts';
import type { AlarmState, RingReason } from './alarm.ts';

const local = (y: number, mo: number, d: number, h: number, mi = 0, s = 0) => new Date(y, mo, d, h, mi, s).getTime();
const MIN = 60_000;

describe('nextOccurrence', () => {
  // Friday 20 Nov 2026, 22:00 local
  const fri22 = local(2026, 10, 20, 22, 0);

  it('finds later today or rolls over midnight', () => {
    expect(nextOccurrence('23:30', fri22)).toBe(local(2026, 10, 20, 23, 30));
    expect(nextOccurrence('07:00', fri22)).toBe(local(2026, 10, 21, 7, 0));
    expect(nextOccurrence('0:15', fri22)).toBe(local(2026, 10, 21, 0, 15));
    expect(nextOccurrence('22:00', fri22)).toBe(local(2026, 10, 21, 22, 0)); // strictly after now
    expect(nextOccurrence('22:00', fri22 - 1)).toBe(fri22);
  });

  it('respects weekdays (0 = Sun .. 6 = Sat)', () => {
    expect(new Date(fri22).getDay()).toBe(5);
    const weekdays = [1, 2, 3, 4, 5];
    expect(nextOccurrence('07:00', fri22, weekdays)).toBe(local(2026, 10, 23, 7, 0)); // Monday
    expect(nextOccurrence('23:00', fri22, weekdays)).toBe(local(2026, 10, 20, 23, 0)); // still Friday
    expect(nextOccurrence('09:30', fri22, [0, 6])).toBe(local(2026, 10, 21, 9, 30)); // Saturday
    expect(nextOccurrence('09:30', fri22, [0])).toBe(local(2026, 10, 22, 9, 30)); // Sunday
    expect(nextOccurrence('21:00', fri22, [5])).toBe(local(2026, 10, 27, 21, 0)); // next Friday
    expect(nextOccurrence('07:00', fri22, [])).toBe(local(2026, 10, 21, 7, 0)); // empty = every day
    expect(nextOccurrence('07:00', fri22, [8])).toBe(local(2026, 10, 23, 7, 0)); // 8 wraps to Monday
  });

  it('crosses month and year boundaries', () => {
    expect(nextOccurrence('06:45', local(2026, 11, 31, 23, 59))).toBe(local(2027, 0, 1, 6, 45));
    expect(nextOccurrence('06:45', local(2026, 10, 30, 8, 0))).toBe(local(2026, 11, 1, 6, 45));
  });

  it('keeps wall-clock time across DST changes (US and EU transition nights)', () => {
    for (const [mo, d] of [[2, 7], [2, 28], [9, 24], [9, 31]] as const) {
      const eve = local(2026, mo, d, 22, 0);
      const next = nextOccurrence('07:00', eve);
      expect(new Date(next).getHours()).toBe(7);
      expect(new Date(next).getMinutes()).toBe(0);
      expect(next).toBe(local(2026, mo, d + 1, 7, 0));
    }
  });

  it('rejects malformed times', () => {
    expect(() => parseHHMM('7am')).toThrow(RangeError);
    expect(() => parseHHMM('24:00')).toThrow(RangeError);
    expect(() => nextOccurrence('12:60', 0)).toThrow(RangeError);
    expect(parseHHMM(' 7:05 ')).toEqual([7, 5]);
  });
});

describe('AlarmClock', () => {
  const T0 = local(2026, 10, 21, 6, 0); // 06:00
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(isLight: () => boolean, wakeAt = T0 + 30 * MIN, smartWindowMin = 20) {
    const rings: { reason: RingReason; at: number }[] = [];
    const states: AlarmState[] = [];
    const clock = new AlarmClock({ onStateChange: (s) => states.push(s) });
    clock.schedule({ wakeAt, smartWindowMin, isLight, onRing: (reason) => rings.push({ reason, at: Date.now() }) });
    return { clock, rings, states };
  }

  it('rings at wakeAt when sleep never looks light', () => {
    const { clock, rings } = setup(() => false);
    expect(clock.state).toBe('armed');
    expect(clock.nextRingAt).toBe(T0 + 30 * MIN);
    expect(clock.windowStart).toBe(T0 + 10 * MIN);
    vi.advanceTimersByTime(30 * MIN - 1000);
    expect(rings).toHaveLength(0);
    vi.advanceTimersByTime(1000);
    expect(rings).toEqual([{ reason: 'target', at: T0 + 30 * MIN }]);
    expect(clock.state).toBe('ringing');
    expect(clock.nextRingAt).toBeNull();
  });

  it('rings early inside the window after a minute of light sleep', () => {
    // light from 06:18 onward; window opens 06:10
    const { clock, rings } = setup(() => Date.now() >= T0 + 18 * MIN);
    vi.advanceTimersByTime(19 * MIN + 5000);
    expect(rings).toHaveLength(1);
    expect(rings[0].reason).toBe('smart');
    expect(rings[0].at).toBeGreaterThanOrEqual(T0 + 19 * MIN);
    expect(rings[0].at).toBeLessThanOrEqual(T0 + 19 * MIN + 2000);
    expect(clock.ringReason).toBe('smart');
  });

  it('ignores light sleep before the window opens', () => {
    const { rings } = setup(() => true);
    vi.advanceTimersByTime(10 * MIN);
    expect(rings).toHaveLength(0);
    vi.advanceTimersByTime(MIN + 2000);
    expect(rings).toHaveLength(1);
    expect(rings[0].reason).toBe('smart');
    expect(rings[0].at).toBeGreaterThanOrEqual(T0 + 11 * MIN);
    expect(rings[0].at).toBeLessThanOrEqual(T0 + 11 * MIN + 2000);
  });

  it('needs light sleep to persist: flickering activity falls back to wakeAt', () => {
    // light for 40 s, deep for 20 s, repeating -> never a full minute of light
    const { rings } = setup(() => Math.floor((Date.now() - T0) / 1000) % 60 < 40);
    vi.advanceTimersByTime(30 * MIN);
    expect(rings).toEqual([{ reason: 'target', at: T0 + 30 * MIN }]);
  });

  it('window of 0 means exact time', () => {
    const { rings } = setup(() => true, T0 + 5 * MIN, 0);
    vi.advanceTimersByTime(5 * MIN);
    expect(rings).toEqual([{ reason: 'target', at: T0 + 5 * MIN }]);
  });

  it('survives throttled/frozen timers by comparing wall-clock time', () => {
    const { rings } = setup(() => false);
    // the tab is frozen: the clock jumps 45 minutes without any timer firing
    vi.setSystemTime(T0 + 45 * MIN);
    vi.advanceTimersByTime(1000);
    expect(rings).toHaveLength(1);
    expect(rings[0].reason).toBe('target');
    expect(rings[0].at).toBeGreaterThanOrEqual(T0 + 45 * MIN);
  });

  it('smart ring works with minute-long throttled ticks', () => {
    const { clock, rings } = setup(() => true);
    // emulate a background tab: only check() once a minute
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    for (let m = 1; m <= 12 && rings.length === 0; m++) {
      vi.setSystemTime(T0 + m * MIN);
      clock.check();
    }
    expect(rings).toHaveLength(1);
    expect(rings[0].reason).toBe('smart');
    expect(rings[0].at).toBe(T0 + 11 * MIN);
    clock.cancel();
  });

  it('snoozes, rings again, then dismisses', () => {
    const { clock, rings, states } = setup(() => false, T0 + MIN, 0);
    vi.advanceTimersByTime(MIN);
    expect(clock.state).toBe('ringing');
    clock.snooze(9);
    expect(clock.state).toBe('snoozed');
    expect(clock.nextRingAt).toBe(T0 + 10 * MIN);
    vi.advanceTimersByTime(9 * MIN - 1000);
    expect(rings).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(rings).toHaveLength(2);
    expect(rings[1]).toEqual({ reason: 'snooze', at: T0 + 10 * MIN });
    clock.dismiss();
    expect(clock.state).toBe('idle');
    expect(clock.nextRingAt).toBeNull();
    vi.advanceTimersByTime(60 * MIN);
    expect(rings).toHaveLength(2);
    expect(states).toEqual(['armed', 'ringing', 'snoozed', 'ringing', 'idle']);
  });

  it('cancel prevents ringing and snooze is ignored when idle', () => {
    const { clock, rings } = setup(() => true);
    clock.cancel();
    expect(clock.state).toBe('idle');
    clock.snooze(5);
    expect(clock.state).toBe('idle');
    vi.advanceTimersByTime(2 * 60 * MIN);
    expect(rings).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rings immediately for a wake time already in the past, and survives a throwing isLight', () => {
    const { rings } = setup(() => {
      throw new Error('boom');
    }, T0 - 1000);
    vi.advanceTimersByTime(0);
    expect(rings).toHaveLength(1);
    const b = setup(() => {
      throw new Error('boom');
    });
    vi.advanceTimersByTime(30 * MIN);
    expect(b.rings[0].reason).toBe('target');
  });

  it('re-scheduling replaces the previous plan', () => {
    const { clock, rings } = setup(() => false);
    clock.schedule({ wakeAt: T0 + 2 * MIN, smartWindowMin: 0, isLight: () => false, onRing: () => rings.push({ reason: 'target', at: -1 }) });
    vi.advanceTimersByTime(60 * MIN);
    expect(rings).toEqual([{ reason: 'target', at: -1 }]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
