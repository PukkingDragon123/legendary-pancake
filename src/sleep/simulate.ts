// Synthetic but realistic nights for demos and tests.
// A hidden hypnogram is generated first (sleep latency, ~82-102 min cycles: light lead-in, deep that shrinks across the
// night, REM that grows toward morning, brief arousals at cycle ends, a few extra awakenings scaled by `restless`), then
// each 30 s epoch gets the sounds that stage would produce: tossing while awake, occasional rustles in light sleep,
// near-silence in deep sleep, rare twitches/mumbles in REM, snoring bouts (light/deep only) for snorers, and the odd
// external noise. Epoch summaries use the same activity formula as the live analyzer.

import { EPOCH_MS } from './types.ts';
import type { Epoch, SleepEvent, SleepSession, Stage } from './types.ts';
import { epochActivity } from './analyzer.ts';
import { analyze } from './staging.ts';

export interface SimulateOptions {
  start: number;
  end: number;
  seed?: number;
  snorer?: boolean;
  /** 0 (calm) .. 1 (very restless), default 0.2 */
  restless?: number;
  /** defaults to `end` */
  wakeTarget?: number;
  /** default 30 */
  smartWindowMin?: number;
}

// Typical share of each cycle spent in deep / REM sleep, by cycle number (textbook adult sleep architecture).
const DEEP = [0.4, 0.3, 0.16, 0.07, 0.03, 0.02];
const REM = [0.12, 0.2, 0.26, 0.3, 0.33, 0.35];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simulated night plus the hidden "true" hypnogram it was generated from (one stage per epoch). */
export function simulateNightWithTruth(opts: SimulateOptions): { session: SleepSession; truth: Stage[] } {
  const seed = opts.seed ?? 1;
  const rnd = mulberry32(seed);
  const restless = Math.min(1, Math.max(0, opts.restless ?? 0.2));
  const start = opts.start;
  const end = Math.max(start, opts.end);
  const n = Math.ceil((end - start) / EPOCH_MS);
  const range = (a: number, b: number) => a + rnd() * (b - a);
  const poisson = (lambda: number) => {
    let k = 0, p = Math.exp(-lambda), s = p;
    const u = rnd();
    while (u > s && k < 20) { k++; p *= lambda / k; s += p; }
    return k;
  };

  // ---------------------------------------------------------------- hidden hypnogram
  const truth: Stage[] = new Array<Stage>(n).fill('awake');
  const arousal = new Uint8Array(n); // cycle-end arousals (louder, 1-3 movements)
  const latency = Math.min(n, Math.round(range(6, 18) * 2 + restless * 50));
  const sleepEnd = Math.max(latency, n - Math.round(range(2, 10) * 2));
  let i = latency;
  for (let c = 0; i < sleepEnd; c++) {
    const L = Math.round(range(82, 102) * 2);
    const lead = Math.max(4, Math.round(L * range(0.07, 0.12)));
    const dLen = Math.round(L * DEEP[Math.min(c, DEEP.length - 1)] * range(0.85, 1.15) * (1 - 0.35 * restless));
    const rLen = Math.round(L * REM[Math.min(c, REM.length - 1)] * range(0.85, 1.15));
    for (let j = 0; j < L && i + j < sleepEnd; j++) {
      truth[i + j] = j < lead ? 'light' : j < lead + dLen ? 'deep' : j >= L - rLen ? 'rem' : 'light';
    }
    const last = i + L - 1;
    if (last < sleepEnd - 1 && rnd() < 0.45 + 0.4 * restless) {
      const len = rnd() < restless ? 2 : 1;
      for (let k = 0; k < len && last + k < sleepEnd; k++) { truth[last + k] = 'awake'; arousal[last + k] = 1; }
    }
    i += L;
  }
  const extra = Math.floor(restless * 5 + rnd() * 1.2);
  for (let k = 0; k < extra; k++) {
    const span = sleepEnd - latency - 160;
    if (span <= 0) break;
    const pos = latency + 120 + Math.floor(rnd() * span);
    const len = Math.round(range(2, 6 + 14 * restless));
    for (let j = 0; j < len && pos + j < sleepEnd; j++) truth[pos + j] = 'awake';
  }

  // ---------------------------------------------------------------- sounds per epoch
  const epochs: Epoch[] = [];
  const events: SleepEvent[] = [];
  const base = range(26, 33);
  const phase = rnd() * Math.PI * 2;
  let walk = 0;
  let snoring = false;
  for (let e = 0; e < n; e++) {
    const t0 = start + e * EPOCH_MS;
    const span = Math.min(EPOCH_MS, end - t0);
    const st = truth[e];
    walk = Math.max(-2, Math.min(2, walk + (rnd() - 0.5) * 0.15));
    const floor = base + 1.5 * Math.sin((2 * Math.PI * e) / Math.max(200, n * 0.8) + phase) + walk;
    const evs: SleepEvent[] = [];
    const add = (kind: SleepEvent['kind'], dur: number, over: number, at?: number) => {
      const d = Math.min(dur, span / 1000 - 0.2);
      if (d <= 0) return;
      const t = at ?? t0 + rnd() * (span - d * 1000);
      evs.push({ t: Math.round(t), kind, dur: Math.round(d * 10) / 10, db: Math.round((floor + over) * 10) / 10 });
    };

    if (st === 'awake') {
      const moves = arousal[e] ? 1 + poisson(1) : poisson(0.9 + 1.2 * restless);
      for (let k = 0; k < moves; k++) add('movement', range(0.4, 2.5), range(12, 26));
      if (rnd() < 0.02) add('noise', range(0.3, 1.5), range(14, 24)); // cough, phone, sniff
    } else if (st === 'light') {
      if (rnd() < 0.05 + 0.2 * restless) add('movement', range(0.3, 1.8), range(10, 22));
      if (rnd() < 0.001) add('talk', range(0.8, 3), range(14, 22));
    } else if (st === 'deep') {
      if (rnd() < 0.008) add('movement', range(0.3, 1), range(8, 16));
    } else {
      if (rnd() < 0.03) add('movement', range(0.1, 0.5), range(8, 14)); // REM twitch
      if (rnd() < 0.003 + 0.004 * restless) add('talk', range(0.8, 4), range(14, 24));
    }

    // snoring comes in bouts during light/deep sleep (REM's muscle atonia and waking stop it)
    if (opts.snorer && (st === 'light' || st === 'deep')) {
      if (!snoring && rnd() < (st === 'deep' ? 0.1 : 0.035)) snoring = true;
      else if (snoring && rnd() < 0.05) snoring = false;
    } else snoring = false;
    if (snoring) {
      const period = range(3.6, 5) * 1000;
      for (let t = t0 + rnd() * period; t < t0 + span - 2000; t += period * range(0.9, 1.1)) {
        add('snore', range(0.8, 1.8), range(12, 20) + (st === 'deep' ? 4 : 0), t);
      }
    }

    if (rnd() < 0.004) add('noise', range(0.5, 5), range(15, 30)); // car, door, pet

    evs.sort((a, b) => a.t - b.t);
    events.push(...evs);
    const c = { snore: 0, move: 0, talk: 0, noise: 0, moveSec: 0, talkSec: 0, noiseSec: 0 };
    let peak = floor + range(1, 3), above = 0;
    for (const ev of evs) {
      if (ev.kind === 'snore') c.snore++;
      else if (ev.kind === 'movement') { c.move++; c.moveSec += ev.dur; }
      else if (ev.kind === 'talk') { c.talk++; c.talkSec += ev.dur; }
      else { c.noise++; c.noiseSec += ev.dur; }
      peak = Math.max(peak, ev.db);
      above += ev.dur * (ev.db - floor) * 0.6; // mean of a swell is ~60% of its peak excess (in dB)
    }
    epochs.push({
      t: t0,
      db: Math.round((floor + 0.6 + (above * 1000) / span) * 10) / 10,
      peak: Math.round(peak * 10) / 10,
      floor: Math.round(floor * 10) / 10,
      snore: c.snore,
      move: c.move,
      talk: c.talk,
      noise: c.noise,
      activity: Math.round(epochActivity(c) * 1000) / 1000,
    });
  }

  const session: SleepSession = {
    id: `sim-${seed}-${start}`,
    start,
    end,
    wakeTarget: opts.wakeTarget ?? end,
    smartWindowMin: opts.smartWindowMin ?? 30,
    micUsed: true,
    epochs,
    events,
    simulated: true,
  };
  return { session, truth };
}

/** A realistic synthetic night (epochs + events, `simulated: true`). Run `analyze()` on it for stages and a report. */
export function simulateNight(opts: SimulateOptions): SleepSession {
  return simulateNightWithTruth(opts).session;
}

/**
 * A ready-to-show demo night with stages and report filled in. Defaults to "last night": 22:55 -> 06:50 local, ending
 * at the most recent 06:50 before `now`.
 */
export function demoNight(opts: Partial<SimulateOptions> & { now?: number } = {}): SleepSession {
  const now = opts.now ?? Date.now();
  let end = opts.end;
  if (end === undefined) {
    const d = new Date(now);
    d.setHours(6, 50, 0, 0);
    if (d.getTime() > now) d.setDate(d.getDate() - 1);
    end = d.getTime();
  }
  const start = opts.start ?? end - (7 * 60 + 55) * 60_000;
  const session = simulateNight({ ...opts, start, end });
  const { stages, report } = analyze(session);
  return { ...session, stages, report };
}
