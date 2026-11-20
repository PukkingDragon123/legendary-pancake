// Sleep staging and the morning report. Pure functions, no DOM.
//
// stages[i] covers [session.start + i*EPOCH_MS, +EPOCH_MS) up to session.end (see stageTime()). The recorder anchors its
// epoch grid at session.start, so for a mic night recorded without pauses this is exactly one stage per epoch.
//
// How it works (sound-based, so it is an estimate, not polysomnography):
// 1. Sleep/wake: actigraphy-style. Each epoch's 0..1 sound activity is combined with its neighbours using
//    Cole-Kripke-like weights (4 min back, 2 min ahead, current epoch weighted most). Score >= 0.75 -> wake, and any
//    single epoch with activity >= 0.6 is a brief arousal (awake). A prior makes the first minutes after lights-out
//    lean "awake" (people are rarely asleep within 2 minutes). Webster's rescoring rules then clean up: sleep right
//    after long wake bouts is rescored wake, and short sleep islands inside long wake stretches become wake.
// 2. Onset = first epoch that starts ~10 min of sustained sleep; final wake = end of the last sleep epoch.
// 3. Cycles: ~90 min, re-anchored to the data. Each boundary is placed at the strongest arousal 70-110 min after the
//    previous one (movement clusters typically mark cycle ends), or at +90 min if the night was too quiet to tell.
//    A long awakening (>= 10 min) restarts the cycle.
// 4. Within a cycle a template gives where deep (early, large in the first cycles) and REM (at the end, growing toward
//    morning) are likely. Data then decides: deep needs quiet, steady epochs (and is favoured in the first third),
//    REM needs no snoring and little movement, everything else is light. Short deep (< 1.5 min) / REM (< 2 min) bouts
//    are merged into light.
// Without microphone data the template alone produces a typical night from the duration.

import { EPOCH_MS } from './types.ts';
import type { SleepReport, SleepSession, Stage } from './types.ts';

export interface AnalyzeOptions {
  /** clock format for notes; defaults to the locale's preference */
  hour12?: boolean;
}

// Typical share of each cycle in deep / REM sleep, by cycle number.
const DEEP_SHARE = [0.4, 0.3, 0.15, 0.07, 0.03];
const REM_SHARE = [0.12, 0.2, 0.26, 0.3, 0.34];
const LEAD_IN = 0.1; // light N1/N2 at the start of each cycle
const CYCLE = 180; // 90 min in epochs
const SUSTAIN = 20; // 10 min of sleep defines onset
const PRE_W = [0.5, 0.35, 0.25, 0.2, 0.15, 0.12, 0.1, 0.08]; // weights for epochs i-1..i-8
const POST_W = [0.35, 0.25, 0.15, 0.1]; // weights for epochs i+1..i+4
const WAKE_SCORE = 0.75;
const AROUSAL_ACT = 0.6;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
const num = (x: unknown, d = 0) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const cyc = (arr: number[], c: number) => arr[Math.min(c, arr.length - 1)];

/** Start time of stage i. */
export function stageTime(session: Pick<SleepSession, 'start'>, i: number): number {
  return session.start + i * EPOCH_MS;
}

interface Grid {
  act: Float64Array;
  db: Float64Array;
  peak: Float64Array;
  floor: Float64Array;
  snore: Float64Array;
  move: Float64Array;
  talk: Float64Array;
  noise: Float64Array;
  /** 1 where a real epoch landed (others are filled from neighbours) */
  has: Uint8Array;
}

interface Night {
  stages: Stage[];
  onset: number; // index or -1
  last: number; // index of last sleep epoch or -1
  grid: Grid | null;
}

export function analyze(session: SleepSession, opts: AnalyzeOptions = {}): { stages: Stage[]; report: SleepReport } {
  const start = num(session.start);
  const epochs = Array.isArray(session.epochs) ? session.epochs : [];
  const lastEp = epochs.length ? epochs[epochs.length - 1] : undefined;
  let end = num(session.end, lastEp ? num(lastEp.t) + EPOCH_MS : start);
  if (end < start) end = start;
  const inBed = end - start;
  const n = Math.ceil(inBed / EPOCH_MS);
  const hour12 = opts.hour12 ?? prefers12h();

  const grid = session.micUsed && epochs.length ? buildGrid(session, start, n) : null;
  const night: Night = n === 0 ? { stages: [], onset: -1, last: -1, grid: null } : grid ? measuredNight(grid, n) : templateNight(n, inBed);
  const report = buildReport(session, night, start, end, n, hour12);
  return { stages: night.stages, report };
}

// ------------------------------------------------------------------------------------------------ measured nights

function buildGrid(session: SleepSession, start: number, n: number): Grid | null {
  const g: Grid = {
    act: new Float64Array(n), db: new Float64Array(n), peak: new Float64Array(n), floor: new Float64Array(n),
    snore: new Float64Array(n), move: new Float64Array(n), talk: new Float64Array(n), noise: new Float64Array(n),
    has: new Uint8Array(n),
  };
  let any = false;
  for (const e of session.epochs) {
    const k = Math.round((num(e.t) - start) / EPOCH_MS);
    if (k < 0 || k >= n) continue;
    const act = clamp01(num(e.activity));
    if (g.has[k]) {
      g.act[k] = Math.max(g.act[k], act);
      g.db[k] = (g.db[k] + num(e.db)) / 2;
      g.peak[k] = Math.max(g.peak[k], num(e.peak));
      g.snore[k] += num(e.snore); g.move[k] += num(e.move); g.talk[k] += num(e.talk); g.noise[k] += num(e.noise);
    } else {
      g.has[k] = 1;
      any = true;
      g.act[k] = act;
      g.db[k] = num(e.db);
      g.peak[k] = num(e.peak, num(e.db));
      g.floor[k] = num(e.floor, num(e.db));
      g.snore[k] = num(e.snore); g.move[k] = num(e.move); g.talk[k] = num(e.talk); g.noise[k] = num(e.noise);
    }
  }
  if (!any) return null;
  // Fill gaps (paused recording, late start) from the nearest real epoch; counts are not copied.
  let prev = -1;
  for (let i = 0; i < n; i++) {
    if (g.has[i]) { prev = i; continue; }
    if (prev >= 0) copyLevels(g, prev, i);
  }
  let first = 0;
  while (first < n && !g.has[first]) first++;
  for (let i = 0; i < first; i++) copyLevels(g, first, i);
  return g;
}

function copyLevels(g: Grid, from: number, to: number): void {
  g.act[to] = g.act[from];
  g.db[to] = g.db[from];
  g.peak[to] = g.db[from];
  g.floor[to] = g.floor[from];
}

function measuredNight(g: Grid, n: number): Night {
  const act = g.act;

  // ---- 1. sleep/wake (weighted moving window + lights-out prior + brief arousals)
  const wake = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    let d = act[i];
    for (let k = 1; k <= PRE_W.length && i - k >= 0; k++) d += PRE_W[k - 1] * act[i - k];
    for (let k = 1; k <= POST_W.length && i + k < n; k++) d += POST_W[k - 1] * act[i + k];
    d += 0.9 * Math.max(0, 1 - i / 24);
    wake[i] = d >= WAKE_SCORE || act[i] >= AROUSAL_ACT ? 1 : 0;
  }
  webster(wake);

  // ---- 2. onset / final wake
  const onset = findOnset(wake);
  let last = -1;
  if (onset >= 0) for (let i = n - 1; i >= onset; i--) if (!wake[i]) { last = i; break; }

  const stages: Stage[] = new Array<Stage>(n).fill('awake');
  if (onset < 0 || last < 0) return { stages, onset: -1, last: -1, grid: g };

  // ---- 3. cycle boundaries anchored on arousals
  const bounds = cycleBounds(g, wake, onset, last);

  // ---- 4. stage scores
  const span = Math.max(1, last - onset);
  for (let k = 0; k < bounds.length; k++) {
    const b = bounds[k];
    const bEnd = k + 1 < bounds.length ? bounds[k + 1] : last + 1;
    const lNom = Math.max(bEnd - b, 120);
    for (let i = b; i < bEnd; i++) {
      if (wake[i]) continue;
      const phi = (i - b) / lNom;
      const f = (i - onset) / span;
      const a = (2 * act[i] + (i > 0 ? act[i - 1] : act[i]) + (i + 1 < n ? act[i + 1] : act[i])) / 4;
      const quiet = 1 - ramp(a, 0, 0.25);
      const snoring = g.snore[i] > 0;
      const others = g.move[i] + g.talk[i] + g.noise[i];
      const steady = snoring && others === 0 ? 0.85 : 1 - ramp(g.peak[i] - g.floor[i], 8, 22);
      const deepTpl = windowed(phi, LEAD_IN, LEAD_IN + cyc(DEEP_SHARE, k), 0.04);
      const remTpl = windowed(phi, 1 - cyc(REM_SHARE, k), 1.2, 0.03);
      const early = f < 1 / 3 ? 1 : f < 0.5 ? 0.5 : 0;
      const sDeep = (0.9 * deepTpl + 0.2 * early) * quiet * steady;
      const sRem = snoring ? 0 : (0.9 * remTpl + 0.15 * f) * (1 - 0.6 * Math.min(1, g.move[i])) * (0.4 + 0.6 * quiet);
      const sLight = 0.45 + 0.25 * (1 - quiet);
      stages[i] = sDeep > sLight && sDeep >= sRem ? 'deep' : sRem > sLight ? 'rem' : 'light';
    }
  }
  smoothStages(stages, onset, last);
  // snoring epochs are never REM, even after smoothing
  for (let i = onset; i <= last; i++) if (stages[i] === 'rem' && g.snore[i] > 0) stages[i] = 'light';
  return { stages, onset, last, grid: g };
}

/** 1 inside [a, b], linear soft edges of width e outside. */
function windowed(x: number, a: number, b: number, e: number): number {
  if (b <= a) return 0;
  return Math.min(ramp(x, a - e, a), 1 - ramp(x, b, b + e));
}

/** Webster et al. rescoring rules, adapted to 30 s epochs. */
function webster(wake: Uint8Array): void {
  const n = wake.length;
  // (a-c) after >= 4 / 10 / 15 min of wake, the next 1 / 3 / 4 min of sleep are rescored wake
  let i = 0;
  while (i < n) {
    if (!wake[i]) { i++; continue; }
    let j = i;
    while (j < n && wake[j]) j++;
    const len = j - i;
    const k = len >= 30 ? 8 : len >= 20 ? 6 : len >= 8 ? 2 : 0;
    let m = j;
    for (; m < Math.min(n, j + k) && !wake[m]; m++) wake[m] = 1;
    i = Math.max(m, j + 1);
  }
  // (d-e) sleep islands <= 6 min between >= 10 min wake, or <= 10 min between >= 20 min wake, are wake
  const runs: [number, number, number][] = []; // [value, start, length]
  for (let s = 0; s < n; ) {
    let e = s;
    while (e < n && wake[e] === wake[s]) e++;
    runs.push([wake[s], s, e - s]);
    s = e;
  }
  for (let r = 1; r + 1 < runs.length; r++) {
    const [v, s, len] = runs[r];
    if (v) continue;
    const before = runs[r - 1][2], after = runs[r + 1][2];
    if ((len <= 12 && before >= 20 && after >= 20) || (len <= 20 && before >= 40 && after >= 40)) {
      for (let k = s; k < s + len; k++) wake[k] = 1;
    }
  }
}

function findOnset(wake: Uint8Array): number {
  const n = wake.length;
  for (let i = 0; i < n; i++) {
    if (wake[i]) continue;
    // long nights need a full 10 min; sessions under 20 min need whatever is left (at least 3 min)
    const win = n >= 2 * SUSTAIN ? SUSTAIN : Math.min(SUSTAIN, n - i);
    if (win < 6 || i + win > n) return -1;
    let s = 0;
    for (let k = 0; k < win; k++) if (!wake[i + k]) s++;
    if (s >= win - (win >= SUSTAIN ? 1 : 0)) return i;
  }
  return -1;
}

function cycleBounds(g: Grid, wake: Uint8Array, onset: number, last: number): number[] {
  const n = wake.length;
  const arousal = (i: number) => (wake[i] ? 1 : Math.max(g.act[i], 0.6 * Math.max(i > 0 ? g.act[i - 1] : 0, i + 1 < n ? g.act[i + 1] : 0)));
  const bounds = [onset];
  let b = onset;
  for (let guard = 0; guard < 64; guard++) {
    const lo = b + 140, hi = b + 220;
    if (lo > last) break;
    // a long awakening (>= 10 min) before the window restarts the cycle after it (REM latency resets)
    let restart = -1;
    for (let i = b + 40; i < lo; i++) {
      if (!wake[i]) continue;
      let j = i;
      while (j < n && wake[j]) j++;
      if (j - i >= 20) { restart = j; break; }
      i = j;
    }
    if (restart >= 0) {
      if (restart > last) break;
      b = restart;
      bounds.push(b);
      continue;
    }
    // strongest clear arousal in the window, gently preferring ones near the nominal 90 min
    let best = -1, bestV = -Infinity;
    for (let i = lo; i <= Math.min(hi, last); i++) {
      const a = arousal(i);
      const v = a - 0.004 * Math.abs(i - (b + CYCLE));
      if (a >= 0.55 && v > bestV) { bestV = v; best = i; }
    }
    if (best >= 0) {
      while (best + 1 <= last && wake[best + 1]) best++;
      b = best + 1;
    } else b += CYCLE;
    if (b > last) break;
    bounds.push(b);
  }
  return bounds;
}

/** Fill 1-2 epoch light gaps inside deep/REM bouts, then fold too-short deep/REM bouts into light. */
function smoothStages(st: Stage[], from: number, to: number): void {
  for (let i = from + 1; i < to; i++) {
    if (st[i] !== 'light') continue;
    let j = i;
    while (j <= to && st[j] === 'light') j++;
    const prev = st[i - 1], next = st[j];
    if (j - i <= 2 && j <= to && prev === next && (prev === 'deep' || prev === 'rem')) for (let k = i; k < j; k++) st[k] = prev;
    i = j - 1;
  }
  for (let i = from; i <= to; i++) {
    const s = st[i];
    if (s !== 'deep' && s !== 'rem') continue;
    let j = i;
    while (j <= to && st[j] === s) j++;
    if (j - i < (s === 'deep' ? 3 : 4)) for (let k = i; k < j; k++) st[k] = 'light';
    i = j - 1;
  }
}

// ------------------------------------------------------------------------------------------------ template nights

/** No microphone: a typical night shaped by the duration alone. */
function templateNight(n: number, inBed: number): Night {
  const inBedMin = inBed / 60_000;
  const onset = Math.min(Math.round(Math.min(15, Math.max(3, 0.06 * inBedMin)) * 2), Math.floor(0.3 * n));
  const last = Math.max(onset, n - 1 - Math.round(Math.min(5, 0.03 * inBedMin) * 2));
  const stages: Stage[] = new Array<Stage>(n).fill('awake');
  for (let i = onset; i <= last; i++) {
    const c = Math.floor((i - onset) / CYCLE);
    const phi = ((i - onset) % CYCLE) / CYCLE;
    stages[i] = phi < LEAD_IN ? 'light' : phi < LEAD_IN + cyc(DEEP_SHARE, c) ? 'deep' : phi >= 1 - cyc(REM_SHARE, c) ? 'rem' : 'light';
    // a brief, typical arousal at the end of later cycles
    if (c >= 1 && (i - onset) % CYCLE === CYCLE - 1 && i < last) stages[i] = 'awake';
  }
  return { stages, onset, last, grid: null };
}

// ------------------------------------------------------------------------------------------------ report

function buildReport(session: SleepSession, night: Night, start: number, end: number, n: number, hour12: boolean): SleepReport {
  const { stages, onset, last, grid } = night;
  const inBed = end - start;
  const w = (i: number) => Math.max(0, Math.min(1, (end - (start + i * EPOCH_MS)) / EPOCH_MS));
  const tot = { awake: 0, light: 0, deep: 0, rem: 0 };
  for (let i = 0; i < n; i++) tot[stages[i]] += w(i);
  const totalW = tot.awake + tot.light + tot.deep + tot.rem;
  const frac = (x: number) => (totalW > 0 ? x / totalW : 0);
  const asleep = Math.min(inBed, (tot.light + tot.deep + tot.rem) * EPOCH_MS);
  const asleepAt = onset >= 0 ? start + onset * EPOCH_MS : end;
  const wokeAt = last >= 0 ? Math.min(end, start + (last + 1) * EPOCH_MS) : end;
  const latencyMin = (asleepAt - start) / 60_000;
  const efficiency = inBed > 0 ? clamp01(asleep / inBed) : 0;

  // wake bouts after onset and before the final wake
  const bouts: { i: number; len: number }[] = [];
  if (onset >= 0) {
    for (let i = onset; i <= last; i++) {
      if (stages[i] !== 'awake') continue;
      let j = i;
      while (j <= last && stages[j] === 'awake') j++;
      if (j - i >= 2) bouts.push({ i, len: j - i });
      i = j - 1;
    }
  }
  const awakenings = bouts.length;

  // sound statistics (real epochs only)
  let snoreEpochs = 0, loudest = 0, dbSum = 0, dbN = 0;
  const snoreIdx: number[] = [];
  if (grid) {
    for (let i = 0; i < n; i++) {
      if (!grid.has[i]) continue;
      const s = grid.snore[i];
      const near = (i > 0 && grid.has[i - 1] && grid.snore[i - 1] > 0) || (i + 1 < n && grid.has[i + 1] && grid.snore[i + 1] > 0);
      if (s >= 2 || (s >= 1 && near)) { snoreEpochs++; snoreIdx.push(i); }
      loudest = Math.max(loudest, grid.peak[i]);
      dbSum += grid.db[i];
      dbN++;
    }
  }
  const inRange = (session.events ?? []).filter((e) => e && num(e.t, NaN) >= start && num(e.t, NaN) <= end);
  for (const e of inRange) if (grid) loudest = Math.max(loudest, num(e.db));
  const talkEvents = inRange.filter((e) => e.kind === 'talk');
  const talkCount = grid ? (talkEvents.length || Math.round(sum(grid.talk, grid.has))) : 0;
  const snoreMin = snoreEpochs / 2;

  // ---- score: duration vs 7-9 h, efficiency, deep+REM share, awakenings, latency
  const hours = asleep / 3_600_000;
  const durScore = hours >= 7 && hours <= 9 ? 1 : hours < 7 ? clamp01((hours - 3) / 4) : Math.max(0.55, 1 - (hours - 9) * 0.15);
  const sleepW = tot.light + tot.deep + tot.rem;
  let base: number;
  if (grid) {
    const effScore = ramp(efficiency, 0.7, 0.95);
    const restor = sleepW > 0 ? ramp((tot.deep + tot.rem) / sleepW, 0.15, 0.45) : 0;
    const awakeScore = clamp01(1 - 0.07 * awakenings);
    const latScore = onset < 0 ? 0 : latencyMin <= 15 ? 1 : clamp01(1 - (latencyMin - 15) / 60);
    base = 0.35 * durScore + 0.25 * effScore + 0.15 * restor + 0.15 * awakeScore + 0.1 * latScore;
  } else {
    base = 0.35 * durScore + 0.65 * 0.75; // nothing measured beyond duration: neutral for the rest
  }
  // short sleep caps the score however tidy it was (no sleep -> 0, 1-3 h -> <= 30, 5 h -> <= 65)
  const score = Math.round(100 * clamp01(Math.min(base, 0.3 * clamp01(hours) + 0.7 * durScore)));
  const quality: SleepReport['quality'] = score >= 85 ? 'great' : score >= 70 ? 'good' : score >= 50 ? 'okay' : 'restless';

  const notes = buildNotes({
    session, stages, start, end, n, onset, last, grid, hour12, inBed, asleep, latencyMin, bouts,
    snoreMin, snoreIdx, talkEvents, talkCount,
  });

  return {
    score,
    inBed,
    asleep,
    asleepAt,
    wokeAt,
    latencyMin: Math.round(latencyMin * 10) / 10,
    efficiency: Math.round(efficiency * 1000) / 1000,
    deep: round3(frac(tot.deep)),
    light: round3(frac(tot.light)),
    rem: round3(frac(tot.rem)),
    awake: round3(frac(tot.awake)),
    awakenings,
    snoreMin,
    talkCount,
    loudestDb: Math.round(loudest * 10) / 10,
    avgDb: dbN ? Math.round((dbSum / dbN) * 10) / 10 : 0,
    quality,
    notes,
  };
}

interface NoteCtx {
  session: SleepSession;
  stages: Stage[];
  start: number;
  end: number;
  n: number;
  onset: number;
  last: number;
  grid: Grid | null;
  hour12: boolean;
  inBed: number;
  asleep: number;
  latencyMin: number;
  bouts: { i: number; len: number }[];
  snoreMin: number;
  snoreIdx: number[];
  talkEvents: { t: number }[];
  talkCount: number;
}

function buildNotes(c: NoteCtx): string[] {
  const out: { p: number; text: string }[] = [];
  const at = (i: number) => c.start + i * EPOCH_MS;
  const clock = (t: number) => fmtClock(t, c.hour12);
  const inBedMin = c.inBed / 60_000;
  const sleptMin = Math.round(c.asleep / 60_000);
  const measured = !!c.grid;

  if (!measured && c.n > 0) out.push({ p: 100, text: 'The microphone was off, so your stages are estimated from a typical night.' });
  if (inBedMin < 20) {
    out.push({ p: 95, text: c.n > 0 ? `That was a short rest (${fmtDur(inBedMin)}) — too short for a full sleep cycle.` : 'This session was too short to analyze.' });
  } else if (c.onset < 0) {
    out.push({ p: 96, text: "Hoot never heard you settle into sleep — it sounded like a wakeful, restless night." });
  }

  if (c.onset >= 0 && inBedMin >= 20) {
    // duration
    if (sleptMin >= 420 && sleptMin <= 540) out.push({ p: 52, text: `${cap(fmtDur(sleptMin))} of sleep — right in the 7–9 hour sweet spot.` });
    else if (sleptMin < 360 && inBedMin >= 60) out.push({ p: 80, text: `You slept ${fmtDur(sleptMin)}, about ${fmtDur(420 - sleptMin)} short of 7 hours.` });
    else if (sleptMin < 420 && inBedMin >= 60) out.push({ p: 40, text: `You slept ${fmtDur(sleptMin)} — close to the 7-hour mark.` });
    else if (sleptMin > 570) out.push({ p: 45, text: `A long ${fmtDur(sleptMin)} of sleep — your body may have been catching up.` });

    if (measured) {
      // latency
      const lat = Math.round(c.latencyMin);
      if (lat <= 15) out.push({ p: 42, text: lat <= 1 ? 'You drifted off almost right away.' : `You drifted off in about ${lat} minutes.` });
      else if (lat > 30) out.push({ p: 66, text: `It took about ${fmtDur(lat)} to drift off — a slower wind-down might help.` });

      // deep sleep timing
      const deepIdx: number[] = [];
      for (let i = c.onset; i <= c.last; i++) if (c.stages[i] === 'deep') deepIdx.push(i);
      if (deepIdx.length >= 20) {
        const tTwoThirds = at(deepIdx[Math.ceil((deepIdx.length * 2) / 3) - 1] + 1);
        const hourMark = ceilHour(tTwoThirds);
        if (hourMark - at(c.onset) <= 0.6 * (at(c.last + 1) - at(c.onset))) {
          out.push({ p: 60, text: `Most of your deep sleep came before ${clock(hourMark)}.` });
        }
      }

      // awakenings
      if (sleptMin >= 180) {
        if (c.bouts.length === 0) out.push({ p: 55, text: 'You slept straight through without a real wake-up.' });
        else {
          const longest = c.bouts.reduce((a, b) => (b.len > a.len ? b : a));
          const mins = Math.max(1, Math.round(longest.len / 2));
          out.push(
            c.bouts.length === 1
              ? { p: 48, text: `You woke up once, around ${clock(at(longest.i))}, for about ${mins} minute${mins === 1 ? '' : 's'}.` }
              : { p: 50 + 5 * c.bouts.length, text: `You woke up ${c.bouts.length} times; the longest was about ${mins} minute${mins === 1 ? '' : 's'} around ${clock(at(longest.i))}.` },
          );
        }
      }

      // snoring
      if (c.snoreMin >= 3) {
        let bestStart = 0, bestCount = 0;
        for (let a = 0, b = 0; b < c.snoreIdx.length; b++) {
          while (c.snoreIdx[b] - c.snoreIdx[a] >= 120) a++;
          if (b - a + 1 > bestCount) { bestCount = b - a + 1; bestStart = a; }
        }
        const cluster = c.snoreIdx.slice(bestStart, bestStart + bestCount);
        const mid = at(cluster.reduce((s, i) => s + i, 0) / cluster.length + 0.5);
        const mins = Math.round(c.snoreMin);
        out.push({ p: 70 + Math.min(20, mins / 3), text: `Snoring showed up for ${fmtDur(mins)}, mostly around ${clock(roundTo(mid, 10))}.` });
      }

      // sleep talk
      if (c.talkCount > 0) {
        const ts = c.talkEvents.map((e) => e.t).sort((a, b) => a - b);
        const text =
          c.talkCount === 1 && ts.length
            ? `You talked in your sleep once, around ${clock(ts[0])}.`
            : c.talkCount === 2 && ts.length >= 2
              ? `You talked in your sleep twice — around ${clock(ts[0])} and ${clock(ts[1])}.`
              : `You talked in your sleep ${c.talkCount} time${c.talkCount === 1 ? '' : 's'}${ts.length ? `, first around ${clock(ts[0])}` : ''}.`;
        out.push({ p: 75, text });
      }

      // longest REM stretch
      let bestR = 0, bestRi = -1;
      for (let i = c.onset; i <= c.last; i++) {
        if (c.stages[i] !== 'rem') continue;
        let j = i;
        while (j <= c.last && c.stages[j] === 'rem') j++;
        if (j - i > bestR) { bestR = j - i; bestRi = i; }
        i = j - 1;
      }
      if (bestR >= 16) out.push({ p: 44, text: `Your longest dream (REM) stretch was about ${Math.round(bestR / 2)} minutes, around ${clock(roundTo(at(bestRi + bestR / 2), 5))}.` });

      // a loud noise followed by waking
      const g = c.grid!;
      for (const e of c.session.events ?? []) {
        if (e.kind !== 'noise') continue;
        const k = Math.floor((e.t - c.start) / EPOCH_MS);
        if (k < c.onset || k > c.last || !g.has[k] || e.db - g.floor[k] < 22) continue;
        if (c.stages[k] === 'awake' || c.stages[k + 1] === 'awake' || c.stages[k + 2] === 'awake') {
          out.push({ p: 72, text: `A loud noise around ${clock(e.t)} seems to have woken you.` });
          break;
        }
      }
    }
  }

  if (!out.length) out.push({ p: 0, text: 'Thanks for tracking — every night helps Hoot learn your rhythm.' });
  return out
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .slice(0, 3)
    .map((x) => x.text);
}

// ------------------------------------------------------------------------------------------------ formatting

function prefers12h(): boolean {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? true;
  } catch {
    return true;
  }
}

/** "3:40 AM" / "2 AM" (12 h) or "03:40" (24 h), local time. */
export function fmtClock(t: number, hour12 = true): string {
  const d = new Date(t);
  const h = d.getHours(), m = d.getMinutes();
  if (!hour12) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const ap = h < 12 ? 'AM' : 'PM';
  return m === 0 ? `${h12} ${ap}` : `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

/** "45 min", "7 h", "7 h 5 min" */
export function fmtDur(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

function ceilHour(t: number): number {
  const d = new Date(t);
  if (d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0) return t;
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}

/** Round to the nearest `minutes` on the local clock. */
function roundTo(t: number, minutes: number): number {
  const d = new Date(t);
  const m = d.getMinutes() + d.getSeconds() / 60;
  d.setMinutes(Math.round(m / minutes) * minutes, 0, 0);
  return d.getTime();
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const round3 = (x: number) => Math.round(x * 1000) / 1000;

function sum(a: Float64Array, mask: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) if (mask[i]) s += a[i];
  return s;
}
