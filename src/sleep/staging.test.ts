import { describe, expect, it } from 'vitest';
import { analyze, fmtClock, fmtDur, stageTime } from './staging.ts';
import { simulateNight, simulateNightWithTruth } from './simulate.ts';
import { FrameAnalyzer } from './analyzer.ts';
import { EPOCH_MS } from './types.ts';
import type { Epoch, SleepEvent, SleepReport, SleepSession, Stage } from './types.ts';

const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo, d, h, mi).getTime();
const START = at(2026, 10, 19, 22, 45); // Thu 22:45 local
const END = at(2026, 10, 20, 6, 50); // Fri 06:50 local

function expectSaneReport(r: SleepReport, stages: Stage[], s: SleepSession) {
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'number') expect(Number.isFinite(v), `${k} is finite`).toBe(true);
  }
  expect(r.score).toBeGreaterThanOrEqual(0);
  expect(r.score).toBeLessThanOrEqual(100);
  expect(Number.isInteger(r.score)).toBe(true);
  expect(['restless', 'okay', 'good', 'great']).toContain(r.quality);
  expect(r.notes.length).toBeGreaterThanOrEqual(1);
  expect(r.notes.length).toBeLessThanOrEqual(3);
  for (const n of r.notes) expect(n).not.toMatch(/NaN|undefined|Infinity/);
  expect(r.deep + r.light + r.rem + r.awake).toBeCloseTo(stages.length ? 1 : 0, 2);
  expect(r.efficiency).toBeGreaterThanOrEqual(0);
  expect(r.efficiency).toBeLessThanOrEqual(1);
  expect(r.asleep).toBeLessThanOrEqual(r.inBed);
  expect(r.asleepAt).toBeGreaterThanOrEqual(s.start);
  expect(r.wokeAt).toBeGreaterThanOrEqual(r.asleepAt);
  expect(r.wokeAt).toBeLessThanOrEqual(s.end ?? Infinity);
  expect(stages.length).toBe(Math.ceil(r.inBed / EPOCH_MS));
}

const frac = (stages: Stage[], s: Stage) => stages.filter((x) => x === s).length / stages.length;

describe('analyze() on simulated nights', () => {
  it('gives plausible architecture for calm nights across seeds', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = simulateNight({ start: START, end: END, seed, restless: 0.1 });
      expect(s.simulated).toBe(true);
      const { stages, report: r } = analyze(s, { hour12: true });
      expectSaneReport(r, stages, s);
      expect(r.deep).toBeGreaterThanOrEqual(0.1);
      expect(r.deep).toBeLessThanOrEqual(0.3);
      expect(r.rem).toBeGreaterThanOrEqual(0.15);
      expect(r.rem).toBeLessThanOrEqual(0.3);
      expect(r.awake).toBeLessThan(0.2);
      expect(r.score).toBeGreaterThanOrEqual(80);
      expect(r.latencyMin).toBeGreaterThan(2);
      expect(r.latencyMin).toBeLessThan(45);
      // deep sleep sits in the first half, REM leans toward the morning
      const half = Math.floor(stages.length / 2);
      expect(frac(stages.slice(0, half), 'deep')).toBeGreaterThan(frac(stages.slice(half), 'deep'));
      expect(frac(stages.slice(half), 'rem')).toBeGreaterThan(frac(stages.slice(0, half), 'rem'));
    }
  });

  it('tracks the hidden hypnogram reasonably (sleep/wake and stages)', () => {
    let sw = 0, agree = 0, total = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { session, truth } = simulateNightWithTruth({ start: START, end: END, seed });
      const { stages } = analyze(session);
      for (let i = 0; i < truth.length; i++) {
        if ((truth[i] === 'awake') === (stages[i] === 'awake')) sw++;
        if (truth[i] === stages[i]) agree++;
        total++;
      }
    }
    expect(sw / total).toBeGreaterThan(0.95);
    expect(agree / total).toBeGreaterThan(0.65);
  });

  it('a restless night scores lower with more awakenings than a calm one', () => {
    const calm = analyze(simulateNight({ start: START, end: END, seed: 5, restless: 0.05 })).report;
    const rough = analyze(simulateNight({ start: START, end: END, seed: 5, restless: 0.9 })).report;
    expect(rough.score).toBeLessThan(calm.score);
    expect(rough.awakenings).toBeGreaterThan(calm.awakenings);
    expect(rough.efficiency).toBeLessThan(calm.efficiency);
    expect(rough.latencyMin).toBeGreaterThan(calm.latencyMin);
  });

  it('reports snoring and never stages a snoring epoch as REM', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const s = simulateNight({ start: START, end: END, seed, snorer: true });
      const { stages, report: r } = analyze(s, { hour12: true });
      expectSaneReport(r, stages, s);
      expect(r.snoreMin).toBeGreaterThan(10);
      expect(r.rem).toBeGreaterThan(0.08);
      for (const e of s.epochs) {
        const i = Math.round((e.t - s.start) / EPOCH_MS);
        if (e.snore > 0) expect(stages[i]).not.toBe('rem');
      }
      if (seed === 1) expect(r.notes.join(' ')).toMatch(/Snoring showed up for .* around \d{1,2}(:\d\d)? (AM|PM)/);
    }
  });

  it('handles sessions spanning midnight with clock-time notes', () => {
    const s = simulateNight({ start: at(2026, 11, 31, 23, 30), end: at(2027, 0, 1, 7, 10), seed: 3 });
    const { stages, report } = analyze(s, { hour12: true });
    expectSaneReport(report, stages, s);
    expect(new Date(report.asleepAt).getDate()).toBe(31);
    expect(new Date(report.wokeAt).getDate()).toBe(1);
    expect(stageTime(s, stages.length - 1)).toBeLessThan(s.end!);
  });
});

describe('analyze() edge cases', () => {
  const blank = (o: Partial<SleepSession>): SleepSession => ({ id: 'x', start: START, smartWindowMin: 0, micUsed: false, epochs: [], events: [], ...o });

  it('no microphone: duration-only report with a template hypnogram', () => {
    const eight = blank({ end: START + 8 * 3600_000 });
    const four = blank({ end: START + 4 * 3600_000 });
    const a = analyze(eight), b = analyze(four);
    expectSaneReport(a.report, a.stages, eight);
    expectSaneReport(b.report, b.stages, four);
    expect(a.report.score).toBeGreaterThan(b.report.score);
    expect(a.report.deep).toBeGreaterThan(0.08);
    expect(a.report.rem).toBeGreaterThan(0.12);
    expect(a.report.snoreMin).toBe(0);
    expect(a.report.loudestDb).toBe(0);
    expect(a.report.notes[0]).toMatch(/microphone was off/);
    // micUsed but nothing recorded behaves the same way
    const broken = analyze(blank({ end: eight.end, micUsed: true }));
    expect(broken.report.score).toBe(a.report.score);
  });

  it('very short sessions produce a valid low-score report', () => {
    for (const min of [1, 7, 15, 19]) {
      const sim = simulateNight({ start: START, end: START + min * 60_000, seed: min });
      const r1 = analyze(sim);
      expectSaneReport(r1.report, r1.stages, sim);
      expect(r1.report.score).toBeLessThanOrEqual(35);
      expect(r1.report.quality).toBe('restless');
      const noMic = blank({ end: START + min * 60_000 });
      const r2 = analyze(noMic);
      expectSaneReport(r2.report, r2.stages, noMic);
      expect(r2.report.score).toBeLessThanOrEqual(35);
      expect(r2.report.notes.join(' ')).toMatch(/short rest/);
    }
  });

  it('zero-length, missing end and reversed sessions do not crash', () => {
    const zero = analyze(blank({ end: START }));
    expect(zero.stages).toEqual([]);
    expect(zero.report.score).toBe(0);
    expect(zero.report.notes.length).toBe(1);
    const reversed = analyze(blank({ end: START - 1000 }));
    expect(reversed.report.inBed).toBe(0);
    const sim = simulateNight({ start: START, end: END, seed: 2 });
    const noEnd = analyze({ ...sim, end: undefined });
    expect(noEnd.stages.length).toBe(sim.epochs.length);
    expect(Number.isFinite(noEnd.report.score)).toBe(true);
  });

  it('tolerates gaps (paused recording) and a late mic start', () => {
    const sim = simulateNight({ start: START, end: END, seed: 8 });
    const kept = sim.epochs.filter((_, i) => i >= 6 && (i < 300 || i > 360));
    const s = { ...sim, epochs: kept };
    const { stages, report } = analyze(s);
    expectSaneReport(report, stages, s);
    expect(report.asleep).toBeGreaterThan(5 * 3600_000);
  });

  it('a night with no detectable sleep says so', () => {
    const epochs: Epoch[] = [];
    for (let i = 0; i < 120; i++) epochs.push({ t: START + i * EPOCH_MS, db: 40, peak: 60, floor: 30, snore: 0, move: 3, talk: 0, noise: 0, activity: 0.8 });
    const s = blank({ micUsed: true, epochs, end: START + 120 * EPOCH_MS });
    const { stages, report } = analyze(s);
    expectSaneReport(report, stages, s);
    expect(report.asleep).toBe(0);
    expect(report.efficiency).toBe(0);
    expect(report.notes[0]).toMatch(/never heard you settle/);
  });
});

describe('formatting helpers', () => {
  it('formats clock times and durations', () => {
    expect(fmtClock(at(2026, 0, 1, 2, 0), true)).toBe('2 AM');
    expect(fmtClock(at(2026, 0, 1, 15, 40), true)).toBe('3:40 PM');
    expect(fmtClock(at(2026, 0, 1, 0, 5), true)).toBe('12:05 AM');
    expect(fmtClock(at(2026, 0, 1, 3, 7), false)).toBe('03:07');
    expect(fmtDur(14)).toBe('14 min');
    expect(fmtDur(120)).toBe('2 h');
    expect(fmtDur(462)).toBe('7 h 42 min');
  });
});

describe('analyzer -> staging end to end', () => {
  it('turns ~25 minutes of synthetic bedroom audio into a coherent short report', () => {
    const sr = 8000, t0 = START;
    const seconds = 25 * 60;
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const epochs: Epoch[] = [], events: SleepEvent[] = [];
    const an = new FrameAnalyzer({ origin: t0, onEpoch: (e) => epochs.push(e), onEvent: (e) => events.push(e) });
    const frame = new Float32Array(sr / 10);
    let nextRustle = 2, rustleLeft = 0, snoreClock = 0;
    for (let k = 0; k < seconds * 10; k++) {
      const tSec = k / 10;
      // first 6 minutes: tossing and turning every ~6-12 s; 12-18 min: snoring every 4 s
      if (tSec < 360 && tSec >= nextRustle) { rustleLeft = 0.5 + rnd(); nextRustle = tSec + 6 + rnd() * 6; }
      const snoring = tSec >= 720 && tSec < 1080 && snoreClock % 40 < 12;
      for (let i = 0; i < frame.length; i++) {
        let x = (rnd() - 0.5) * 1e-3;
        if (rustleLeft > 0) x += (rnd() - 0.5) * 0.06;
        if (snoring) x += 0.03 * Math.sin((2 * Math.PI * 95 * (k * frame.length + i)) / sr) * Math.sin((Math.PI * (snoreClock % 40)) / 12);
        frame[i] = x;
      }
      if (rustleLeft > 0) rustleLeft -= 0.1;
      snoreClock++;
      an.push(frame, sr, t0 + k * 100);
    }
    an.flush();
    expect(epochs.length).toBe(50);
    expect(events.filter((e) => e.kind === 'movement').length).toBeGreaterThan(20);
    expect(events.filter((e) => e.kind === 'snore').length).toBeGreaterThan(60);
    const s: SleepSession = { id: 'e2e', start: t0, end: t0 + seconds * 1000, smartWindowMin: 0, micUsed: true, epochs, events };
    const { stages, report } = analyze(s);
    expectSaneReport(report, stages, s);
    expect(report.latencyMin).toBeGreaterThanOrEqual(6);
    expect(report.snoreMin).toBeGreaterThanOrEqual(5);
    expect(stages.slice(0, 10).every((x) => x === 'awake')).toBe(true);
    for (let i = 24; i < 36; i++) expect(stages[i]).not.toBe('rem');
  });
});
