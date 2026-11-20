// Real-time night-sound analyzer. Pure TypeScript, no DOM: feed it mono PCM, get levels, events and epochs.
//
// Pipeline per input sample:  DC blocker -> 4th-order low-pass -> decimate to ~16 kHz.
// Per 100 ms hop:             RMS -> "dB" (20*log10(rms)+100, 0..100), 1024-pt Hann FFT (two windows averaged)
//                             -> 16 log-spaced bands (50 Hz..8 kHz), 10 ms sub-block envelope (100 Hz) for modulation.
// Noise floor:                asymmetric tracker (rises <= 0.4 dB/s, falls with a ~0.65 s time constant), i.e. it
//                             follows the lower envelope of the level like a low percentile, so a fan switching on is
//                             absorbed within ~30-40 s while snores/voices (seconds long) stay above it.
// Events:                     hysteresis on level vs floor (on = floor + 6..16 dB by sensitivity, off = half of that),
//                             0.5 s hang-over so syllable/word gaps don't split a phrase. Each burst is classified from
//                             floor-subtracted band energies, spectral flatness, duration and envelope modulation.
// Epochs:                     30 s summaries; an epoch is emitted once no unfinished event started inside it.

import { EPOCH_MS } from './types.ts';
import type { Epoch, LiveLevel, SleepEvent, SleepEventKind } from './types.ts';

export const HOP_MS = 100;
const HOP_SEC = HOP_MS / 1000;
export const N_BANDS = 16;
/** Band edges in Hz, log-spaced 50 Hz..8 kHz. Fixed in Hz so features mean the same thing at any sample rate. */
export const BAND_EDGES: readonly number[] = Array.from({ length: N_BANDS + 1 }, (_, i) => 50 * Math.pow(8000 / 50, i / N_BANDS));
// Band groups (see BAND_EDGES): 0..6 = 50-461 Hz ("low", snore), 6..12 = 335-3090 Hz ("speech"), 13..15 = 3.09-8 kHz ("high").
const LOW_LAST = 6;
const SPEECH_FIRST = 6;
const SPEECH_LAST = 12;
const HIGH_FIRST = 13;

/** Suggested threshold for `recentActivity(5) > x` meaning "probably light sleep or awake" (used by the smart alarm). */
export const LIGHT_SLEEP_ACTIVITY = 0.2;

const TARGET_RATE = 16_000;
const SUBS_PER_HOP = 10; // 10 ms envelope sub-blocks -> 100 Hz envelope
const ENV_RATE = 100;
const MAX_EVENT_SEC = 45; // longer bursts are cut (and the floor will have adapted to a persistent sound by then)
const ENV_CAP = 8 * ENV_RATE; // modulation analysis looks at the first 8 s of a burst
const HANGOVER_HOPS = 5; // 0.5 s below the off-threshold ends a burst
const MIN_EVENT_DB = 22; // ignore "events" in near-digital-silence (below about -78 dBFS)
const FLOOR_RISE_DB_PER_HOP = 0.04; // 0.4 dB/s
const FLOOR_FALL = 0.15; // per hop, toward the current level
const BAND_RISE_MUL = Math.pow(10, FLOOR_RISE_DB_PER_HOP / 10);
// Snoring is quasi-periodic: consecutive snore-like bursts start 1.5..8 s apart (breathing every ~2-6 s, with slack).
const SNORE_GAP_MIN_MS = 1500;
const SNORE_GAP_MAX_MS = 8000;
// An isolated snore-like burst still counts as a snore if a confirmed snore series was heard within this time.
const SNORE_SERIES_MS = 90_000;
const BUCKET_MS = 10_000; // recentActivity resolution
const BUCKETS = 360; // one hour

export interface BurstFeatures {
  /** seconds */
  dur: number;
  /** share of event energy below ~460 Hz */
  lowFrac: number;
  /** share of event energy in ~335-3090 Hz */
  speechFrac: number;
  /** share of event energy above ~3.1 kHz */
  highFrac: number;
  /** 0..1, geometric/arithmetic mean of per-Hz band energy (1 = white noise) */
  flatness: number;
  /** share of envelope-modulation energy (0.5-20 Hz) that falls in the syllabic 3-8 Hz range */
  modRatio: number;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
/** 0 below a, 1 above b, linear in between. */
const ramp = (x: number, a: number, b: number) => clamp01((x - a) / (b - a));
/** Trapezoid membership: rises over [a,b], flat to c, falls over [c,d]. */
const trap = (x: number, a: number, b: number, c: number, d: number) => Math.min(ramp(x, a, b), 1 - ramp(x, c, d));

/**
 * Heuristic burst classifier (fuzzy scores, highest wins; 'noise' is the fallback at 0.25).
 * - snore:    0.4-3 s, energy concentrated below ~460 Hz, little above 3 kHz, smooth (not syllabic) envelope.
 *             Returned as a *candidate*; FrameAnalyzer only keeps it as 'snore' when bursts repeat every 1.5-8 s.
 * - talk:     0.5-6 s, energy mostly in the speech band, envelope strongly modulated at the 3-8 Hz syllable rate.
 * - movement: 0.1-2.5 s broadband rustle: notable energy above 3 kHz or a flat spectrum, not low-frequency dominated.
 * - noise:    everything else that is loud (doors, cars, long rumbles, isolated thumps).
 */
export function classifyBurst(f: BurstFeatures): { kind: SleepEventKind; scores: Record<SleepEventKind, number> } {
  const snore =
    trap(f.dur, 0.3, 0.4, 3.0, 4.0) *
    ramp(f.lowFrac, 0.4, 0.65) *
    (1 - ramp(f.highFrac, 0.12, 0.3)) *
    (1 - ramp(f.modRatio, 0.35, 0.6));
  const talk =
    trap(f.dur, 0.35, 0.5, 6, 10) *
    ramp(f.speechFrac, 0.35, 0.6) *
    (1 - 0.8 * ramp(f.lowFrac, 0.5, 0.75)) *
    (1 - ramp(f.highFrac, 0.3, 0.5)) *
    ramp(f.modRatio, 0.25, 0.45);
  const movement =
    trap(f.dur, 0.05, 0.1, 2.5, 5) *
    Math.max(ramp(f.highFrac, 0.12, 0.3), ramp(f.flatness, 0.3, 0.55)) *
    (1 - ramp(f.lowFrac, 0.45, 0.7));
  const scores: Record<SleepEventKind, number> = { snore, talk, movement, noise: 0.25 };
  let kind: SleepEventKind = 'noise';
  for (const k of ['snore', 'talk', 'movement'] as const) if (scores[k] > scores[kind]) kind = k;
  return { kind, scores };
}

export interface ActivityInput {
  move: number;
  talk: number;
  noise: number;
  /** summed event durations in seconds */
  moveSec: number;
  talkSec: number;
  noiseSec: number;
}

/**
 * 0..1 epoch activity (arousal proxy for staging). Movement counts fully, talking nearly so, other noise only partly
 * (it may or may not have disturbed the sleeper); snoring counts as zero because it means you were asleep.
 * About 1 s of rustling -> 0.39, two rustles -> 0.63, a 2 s mumble -> 0.5, a passing car -> ~0.2.
 */
export function epochActivity(c: ActivityInput): number {
  const a = c.moveSec + 0.5 * c.move + 0.8 * c.talkSec + 0.5 * c.talk + 0.3 * c.noiseSec + 0.15 * c.noise;
  return 1 - Math.exp(-a / 3);
}

/** Minimal iterative radix-2 complex FFT (in place, forward, unnormalised). */
export class FFT {
  readonly n: number;
  private rev: Uint32Array;
  private cos: Float64Array;
  private sin: Float64Array;
  constructor(n: number) {
    if (n < 2 || (n & (n - 1)) !== 0) throw new Error('FFT size must be a power of two');
    this.n = n;
    const bits = Math.round(Math.log2(n));
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      this.cos[k] = Math.cos((2 * Math.PI * k) / n);
      this.sin[k] = Math.sin((2 * Math.PI * k) / n);
    }
  }
  transform(re: Float64Array, im: Float64Array): void {
    const n = this.n, rev = this.rev, cs = this.cos, sn = this.sin;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let j = i, k = 0; j < i + half; j++, k += step) {
          const l = j + half;
          const tre = re[l] * cs[k] + im[l] * sn[k];
          const tim = im[l] * cs[k] - re[l] * sn[k];
          re[l] = re[j] - tre; im[l] = im[j] - tim;
          re[j] += tre; im[j] += tim;
        }
      }
    }
  }
}

/** Biquad in transposed direct form II. */
class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0; z1 = 0; z2 = 0;
  lowpass(fc: number, sr: number, q: number): this {
    const w = (2 * Math.PI * fc) / sr, c = Math.cos(w), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
    this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0;
    this.a1 = (-2 * c) / a0; this.a2 = (1 - alpha) / a0;
    this.z1 = this.z2 = 0;
    return this;
  }
  run(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

interface EpochAcc {
  idx: number;
  sumDb: number;
  n: number;
  peak: number;
  floor: number;
  snore: number; move: number; talk: number; noise: number;
  moveSec: number; talkSec: number; noiseSec: number;
}

export interface AnalyzerOptions {
  /** 0..1 (default 0.5). Higher = quieter sounds become events (on-threshold 16 dB .. 6 dB above the floor). */
  sensitivity?: number;
  /** epoch grid anchor in epoch ms (use the session start); defaults to the time of the first frame */
  origin?: number;
  /** call onLevel every N hops (default 1 = 10 per second) */
  levelEveryHops?: number;
  /** a fresh object per call */
  onLevel?: (l: LiveLevel) => void;
  /** fires when an event has ended and been classified (snores may be confirmed a few seconds later) */
  onEvent?: (e: SleepEvent) => void;
  /** one per 30 s of audio, in order; emitted with a short delay while an event that started in it is unfinished */
  onEpoch?: (e: Epoch) => void;
}

export class FrameAnalyzer {
  onLevel?: (l: LiveLevel) => void;
  onEvent?: (e: SleepEvent) => void;
  onEpoch?: (e: Epoch) => void;
  levelEveryHops: number;

  private sens = 0.5;
  private onDelta = 11;
  private offDelta = 5.5;
  private origin: number | null;

  // --- sample-rate dependent setup
  private sr = 0;
  private dec = 1;
  private fs = 0;
  private hopLen = 0;
  private subLen = 0;
  private nfft = 0;
  private fft!: FFT;
  private win!: Float64Array;
  private winNorm = 1;
  private binBand!: Int8Array;
  private bandValid = new Uint8Array(N_BANDS);
  private bandWidth = new Float64Array(N_BANDS);
  private lp1 = new Biquad();
  private lp2 = new Biquad();
  private dcR = 0.995;
  private dcX = 0;
  private dcY = 0;

  // --- hop assembly
  private hopBuf!: Float64Array;
  private hopPos = 0;
  private decCount = 0;
  private hopIn = 0;
  private sumSq = 0;
  private hopT = 0;
  private subAcc = 0;
  private subPos = 0;
  private hopSub = new Float64Array(SUBS_PER_HOP);
  private hopSubN = 0;
  private lastEndT = -Infinity;

  // --- spectrum scratch
  private re!: Float64Array;
  private im!: Float64Array;
  private bandPow = new Float64Array(N_BANDS);

  // --- level & floors
  private hopIndex = 0;
  private db = 0;
  private floorDb = -1;
  private bandFloor = new Float64Array(N_BANDS);
  private lastHopT = 0;

  // --- current burst
  private burstActive = false;
  private bStartHop = 0;
  private bLastActive = 0;
  private bStartT = 0;
  private bQuiet = 0;
  private bPeak = 0;
  private bActiveHops = 0;
  private bBand = new Float64Array(N_BANDS);
  private bFloorBand = new Float64Array(N_BANDS);
  private env = new Float64Array(ENV_CAP);
  private envLen = 0;
  private envWork = new Float64Array(ENV_CAP);
  private evBand = new Float64Array(N_BANDS);

  // --- snore series
  private pending: SleepEvent | null = null;
  private lastSnoreT = -Infinity;

  // --- epochs
  private open: EpochAcc[] = [];
  private free: EpochAcc[] = [];
  private lastEmittedIdx = -Infinity;

  // --- recent activity (10 s buckets, last hour)
  private bIdx = new Float64Array(BUCKETS).fill(-1);
  private bBurst = new Float64Array(BUCKETS);
  private bDiscount = new Float64Array(BUCKETS);

  constructor(opts: AnalyzerOptions = {}) {
    this.onLevel = opts.onLevel;
    this.onEvent = opts.onEvent;
    this.onEpoch = opts.onEpoch;
    this.levelEveryHops = Math.max(1, Math.round(opts.levelEveryHops ?? 1));
    this.origin = opts.origin ?? null;
    this.sensitivity = opts.sensitivity ?? 0.5;
  }

  get sensitivity(): number {
    return this.sens;
  }
  set sensitivity(v: number) {
    this.sens = clamp01(Number.isFinite(v) ? v : 0.5);
    this.onDelta = 16 - 10 * this.sens;
    this.offDelta = Math.max(3, this.onDelta / 2);
  }
  /** current adaptive noise floor (dB scale) */
  get noiseFloor(): number {
    return Math.max(0, this.floorDb);
  }
  /** level of the most recent hop (dB scale) */
  get level(): number {
    return this.db;
  }

  /**
   * Feed mono PCM. `t` = epoch-ms time of frame[0]. Any frame length works; samples are buffered into 100 ms hops.
   * A jump of more than 1 s between consecutive frames (pause, suspension) is treated as a gap: the current burst is
   * closed and the partial hop dropped.
   */
  push(frame: Float32Array, sampleRate: number, t: number): void {
    if (!(sampleRate > 0) || frame.length === 0) return;
    if (sampleRate !== this.sr) this.configure(sampleRate);
    if (this.origin === null) this.origin = t;
    if (Math.abs(t - this.lastEndT) > 1000 && this.lastEndT !== -Infinity) this.gap();
    const sr = this.sr, dec = this.dec, hopLen = this.hopLen, subLen = this.subLen, buf = this.hopBuf;
    const lp1 = this.lp1, lp2 = this.lp2, dcR = this.dcR;
    let dcX = this.dcX, dcY = this.dcY;
    for (let i = 0; i < frame.length; i++) {
      let x = frame[i];
      if (!(x === x) || x > 4 || x < -4) x = 0; // NaN / garbage guard
      if (this.hopIn === 0) this.hopT = t + (i * 1000) / sr;
      const y = x - dcX + dcR * dcY;
      dcX = x; dcY = y;
      this.sumSq += y * y;
      this.hopIn++;
      let v = y;
      if (dec > 1) {
        v = lp2.run(lp1.run(y));
        if (++this.decCount < dec) continue;
        this.decCount = 0;
      }
      buf[this.hopPos++] = v;
      this.subAcc += v * v;
      if (++this.subPos === subLen) {
        if (this.hopSubN < SUBS_PER_HOP) this.hopSub[this.hopSubN++] = Math.sqrt(this.subAcc / subLen);
        this.subAcc = 0;
        this.subPos = 0;
      }
      if (this.hopPos === hopLen) {
        this.dcX = dcX; this.dcY = dcY;
        this.processHop();
      }
    }
    this.dcX = dcX; this.dcY = dcY;
    this.lastEndT = t + (frame.length * 1000) / sr;
  }

  /**
   * 0..1 amount of non-snore sound activity (movement, talking, some noise) over the last `minutes` of audio time.
   * One ~1 s rustle in 5 minutes gives ~0.23; silence or steady snoring gives 0.
   */
  recentActivity(minutes = 5): number {
    const m = Math.min(60, Math.max(1 / 6, minutes));
    const nb = Math.max(1, Math.round((m * 60_000) / BUCKET_MS));
    const last = Math.floor(this.lastHopT / BUCKET_MS);
    let a = 0;
    for (let idx = last - nb + 1; idx <= last; idx++) {
      const pos = ((idx % BUCKETS) + BUCKETS) % BUCKETS;
      if (this.bIdx[pos] === idx) a += this.bBurst[pos] - this.bDiscount[pos];
    }
    return a > 0 ? 1 - Math.exp(-a / (0.75 * m)) : 0;
  }

  /** End of recording: close the current burst, resolve pending snores and emit all remaining (partial) epochs. */
  flush(): void {
    if (this.burstActive) this.endBurst();
    if (this.pending) this.resolvePending();
    while (this.open.length) {
      const acc = this.open.shift()!;
      if (acc.n > 0) this.emitEpoch(acc);
      this.free.push(acc);
    }
    this.hopPos = this.hopIn = this.decCount = this.subPos = this.hopSubN = 0;
    this.sumSq = this.subAcc = 0;
    this.lastEndT = -Infinity;
  }

  // ------------------------------------------------------------------ internals

  private configure(sr: number): void {
    this.flushIfRunning();
    this.sr = sr;
    this.dec = Math.max(1, Math.round(sr / TARGET_RATE));
    this.fs = sr / this.dec;
    this.hopLen = Math.max(64, Math.round(this.fs * HOP_SEC));
    this.subLen = Math.floor(this.hopLen / SUBS_PER_HOP);
    let n = 64;
    while (n * 2 <= this.hopLen && n < 1024) n *= 2;
    this.nfft = n;
    this.fft = new FFT(n);
    this.win = new Float64Array(n);
    let s2 = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
      this.win[i] = w;
      s2 += w * w;
    }
    // one-sided power normalisation: sum of bin powers ~= mean square of the signal (Parseval with window correction)
    this.winNorm = 2 / (n * s2);
    this.re = new Float64Array(n);
    this.im = new Float64Array(n);
    this.hopBuf = new Float64Array(this.hopLen);
    const nyq = this.fs / 2;
    this.binBand = new Int8Array(n / 2 + 1).fill(-1);
    for (let k = 1; k <= n / 2; k++) {
      const f = (k * this.fs) / n;
      for (let b = 0; b < N_BANDS; b++) if (f >= BAND_EDGES[b] && f < BAND_EDGES[b + 1]) { this.binBand[k] = b; break; }
    }
    for (let b = 0; b < N_BANDS; b++) {
      this.bandValid[b] = BAND_EDGES[b] < nyq * 0.95 ? 1 : 0;
      this.bandWidth[b] = Math.max(1, Math.min(BAND_EDGES[b + 1], nyq) - BAND_EDGES[b]);
    }
    if (this.dec > 1) {
      // 4th-order Butterworth anti-alias low-pass at 0.4 x the decimated rate
      const fc = 0.4 * this.fs;
      this.lp1.lowpass(fc, sr, 0.5412);
      this.lp2.lowpass(fc, sr, 1.3066);
    }
    this.dcR = Math.exp((-2 * Math.PI * 25) / sr); // ~25 Hz DC blocker
    this.dcX = this.dcY = 0;
    this.hopPos = this.hopIn = this.decCount = this.subPos = this.hopSubN = 0;
    this.sumSq = this.subAcc = 0;
  }

  private flushIfRunning(): void {
    if (this.sr > 0 && this.burstActive) this.endBurst();
  }

  private gap(): void {
    if (this.burstActive) this.endBurst();
    this.hopPos = this.hopIn = this.decCount = this.subPos = this.hopSubN = 0;
    this.sumSq = this.subAcc = 0;
  }

  private processHop(): void {
    const hopT = this.hopT;
    const rms = Math.sqrt(this.sumSq / Math.max(1, this.hopIn));
    const db = rms > 1e-5 ? Math.min(100, Math.max(0, 20 * Math.log10(rms) + 100)) : 0;
    this.db = db;
    this.lastHopT = hopT;
    this.spectrum();

    // ---- floor initialisation on the very first hop
    if (this.floorDb < 0) {
      this.floorDb = db;
      this.bandFloor.set(this.bandPow);
    }

    // ---- event state machine (uses floors from before this hop)
    const onT = Math.max(this.floorDb + this.onDelta, MIN_EVENT_DB);
    const offT = Math.max(this.floorDb + this.offDelta, MIN_EVENT_DB - 3);
    if (!this.burstActive && db >= onT) {
      this.burstActive = true;
      this.bStartHop = this.bLastActive = this.hopIndex;
      this.bStartT = hopT;
      this.bQuiet = 0;
      this.bPeak = db;
      this.bActiveHops = 0;
      this.bBand.fill(0);
      this.bFloorBand.set(this.bandFloor);
      this.envLen = 0;
    }
    const bucket = this.bucket(hopT);
    if (this.burstActive) {
      if (db >= offT) {
        this.bLastActive = this.hopIndex;
        this.bQuiet = 0;
        this.bActiveHops++;
        if (db > this.bPeak) this.bPeak = db;
        for (let b = 0; b < N_BANDS; b++) this.bBand[b] += this.bandPow[b];
        this.bBurst[bucket] += HOP_SEC;
      } else this.bQuiet++;
      for (let s = 0; s < this.hopSubN && this.envLen < ENV_CAP; s++) this.env[this.envLen++] = this.hopSub[s];
      if (this.bQuiet >= HANGOVER_HOPS || (this.hopIndex - this.bStartHop + 1) * HOP_SEC >= MAX_EVENT_SEC) this.endBurst();
    }

    // ---- floors: slow rise, fast fall (a low-percentile style lower-envelope follower)
    if (db > this.floorDb) this.floorDb += Math.min(db - this.floorDb, FLOOR_RISE_DB_PER_HOP);
    else this.floorDb += (db - this.floorDb) * FLOOR_FALL;
    for (let b = 0; b < N_BANDS; b++) {
      const p = this.bandPow[b], f = this.bandFloor[b];
      this.bandFloor[b] = p > f ? Math.min(p, f * BAND_RISE_MUL + 1e-20) : f + (p - f) * FLOOR_FALL;
    }

    // ---- snore candidate timeout
    if (this.pending && hopT - this.pending.t > SNORE_GAP_MAX_MS + this.pending.dur * 1000) this.resolvePending();

    // ---- epoch accounting
    const acc = this.accFor(this.epochIndex(hopT));
    acc.sumDb += db;
    acc.n++;
    if (db > acc.peak) acc.peak = db;
    acc.floor = this.floorDb;
    this.emitReadyEpochs(acc.idx);

    // ---- live level
    if (this.onLevel && this.hopIndex % this.levelEveryHops === 0) {
      const bands = new Array<number>(N_BANDS);
      for (let b = 0; b < N_BANDS; b++) {
        const bd = 10 * Math.log10(this.bandPow[b] + 1e-14) + 100;
        bands[b] = this.bandValid[b] ? Math.round(clamp01((bd - 10) / 60) * 1000) / 1000 : 0;
      }
      this.onLevel({ t: hopT, db: round1(db), floor: round1(this.floorDb), bands });
    }

    this.hopIndex++;
    this.hopPos = this.hopIn = this.subPos = this.hopSubN = 0;
    this.sumSq = this.subAcc = 0;
  }

  /** Average of two Hann-windowed FFTs (start and end of the hop) -> band powers in this.bandPow. */
  private spectrum(): void {
    const n = this.nfft, re = this.re, im = this.im, win = this.win, buf = this.hopBuf, bp = this.bandPow, map = this.binBand;
    bp.fill(0);
    const offsets = this.hopLen >= n + 16 ? [0, this.hopLen - n] : [0];
    const scale = this.winNorm / offsets.length;
    for (const off of offsets) {
      for (let i = 0; i < n; i++) {
        re[i] = buf[off + i] * win[i];
        im[i] = 0;
      }
      this.fft.transform(re, im);
      for (let k = 1; k <= n / 2; k++) {
        const b = map[k];
        if (b >= 0) bp[b] += (re[k] * re[k] + im[k] * im[k]) * scale;
      }
    }
  }

  private endBurst(): void {
    this.burstActive = false;
    const dur = (this.bLastActive - this.bStartHop + 1) * HOP_SEC;
    const f = this.features(dur);
    const { kind } = classifyBurst(f);
    const ev: SleepEvent = { t: Math.round(this.bStartT), kind, dur: round1(dur), db: round1(this.bPeak) };
    if (kind === 'snore') this.snoreCandidate(ev);
    else this.emitEvent(ev);
  }

  /** Feature extraction for the burst that just ended (floor-subtracted band energies + envelope modulation). */
  private features(dur: number): BurstFeatures {
    const nA = Math.max(1, this.bActiveHops), ev = this.evBand;
    let tot = 0, low = 0, sp = 0, hi = 0;
    for (let b = 0; b < N_BANDS; b++) {
      const p = this.bandValid[b] ? Math.max(0, this.bBand[b] / nA - this.bFloorBand[b]) : 0;
      ev[b] = p;
      tot += p;
      if (b <= LOW_LAST) low += p;
      if (b >= SPEECH_FIRST && b <= SPEECH_LAST) sp += p;
      if (b >= HIGH_FIRST) hi += p;
    }
    let flatness = 0;
    if (tot > 0) {
      let mean = 0, nb = 0;
      for (let b = 0; b < N_BANDS; b++) if (this.bandValid[b]) { mean += ev[b] / this.bandWidth[b]; nb++; }
      mean /= nb;
      const eps = mean * 1e-6 + 1e-30;
      let lg = 0;
      for (let b = 0; b < N_BANDS; b++) if (this.bandValid[b]) lg += Math.log(ev[b] / this.bandWidth[b] + eps);
      flatness = clamp01(Math.exp(lg / nb) / mean);
    }
    const envN = Math.min(this.envLen, (this.bLastActive - this.bStartHop + 1) * SUBS_PER_HOP);
    return {
      dur,
      lowFrac: tot > 0 ? low / tot : 0,
      speechFrac: tot > 0 ? sp / tot : 0,
      highFrac: tot > 0 ? hi / tot : 0,
      flatness,
      modRatio: this.modulation(envN),
    };
  }

  /**
   * Syllabic modulation: Goertzel power of the (mean-removed, Hann-windowed) 100 Hz envelope at 0.5..20 Hz in 0.5 Hz
   * steps; returns the share falling in 3..8 Hz. Speech ~0.5-0.8, a smooth snore swell ~0.05-0.2, white-ish
   * fluctuation ~0.27.
   */
  private modulation(n: number): number {
    if (n < 40) return 0;
    const env = this.env, x = this.envWork;
    let mean = 0;
    for (let i = 0; i < n; i++) mean += env[i];
    mean /= n;
    if (mean <= 0) return 0;
    for (let i = 0; i < n; i++) x[i] = (env[i] - mean) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
    let syl = 0, ref = 0;
    for (let f = 0.5; f <= 20; f += 0.5) {
      const coeff = 2 * Math.cos((2 * Math.PI * f) / ENV_RATE);
      let s1 = 0, s2 = 0;
      for (let i = 0; i < n; i++) {
        const s = x[i] + coeff * s1 - s2;
        s2 = s1;
        s1 = s;
      }
      const p = s1 * s1 + s2 * s2 - coeff * s1 * s2;
      ref += p;
      if (f >= 3 && f <= 8) syl += p;
    }
    return ref > 0 ? syl / ref : 0;
  }

  /** Snore candidates only become snores when they repeat (start-to-start 1.5..8 s) or continue a recent series. */
  private snoreCandidate(ev: SleepEvent): void {
    if (this.pending) {
      const gap = ev.t - this.pending.t;
      if (gap >= SNORE_GAP_MIN_MS && gap <= SNORE_GAP_MAX_MS) {
        const p = this.pending;
        this.pending = null;
        this.confirmSnore(p);
        this.confirmSnore(ev);
        return;
      }
      this.resolvePending();
    }
    const sinceLast = ev.t - this.lastSnoreT;
    if (sinceLast >= SNORE_GAP_MIN_MS && sinceLast <= SNORE_GAP_MAX_MS) this.confirmSnore(ev);
    else this.pending = ev;
  }

  private confirmSnore(ev: SleepEvent): void {
    ev.kind = 'snore';
    this.lastSnoreT = Math.max(this.lastSnoreT, ev.t);
    this.emitEvent(ev);
  }

  /** A lone snore-like burst: a snore if a series was heard recently, otherwise generic noise (thump, rumble...). */
  private resolvePending(): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    if (p.t - this.lastSnoreT <= SNORE_SERIES_MS) this.confirmSnore(p);
    else {
      p.kind = 'noise';
      this.emitEvent(p);
    }
  }

  private emitEvent(ev: SleepEvent): void {
    const acc = this.accFor(this.epochIndex(ev.t));
    if (ev.kind === 'snore') acc.snore++;
    else if (ev.kind === 'movement') { acc.move++; acc.moveSec += ev.dur; }
    else if (ev.kind === 'talk') { acc.talk++; acc.talkSec += ev.dur; }
    else { acc.noise++; acc.noiseSec += ev.dur; }
    // recentActivity: snoring means asleep, external noise is mostly not you -> discount them
    if (ev.kind === 'snore' || ev.kind === 'noise') {
      const idx = Math.floor(ev.t / BUCKET_MS), pos = ((idx % BUCKETS) + BUCKETS) % BUCKETS;
      if (this.bIdx[pos] === idx) this.bDiscount[pos] += ev.kind === 'snore' ? ev.dur : 0.7 * ev.dur;
    }
    this.onEvent?.(ev);
  }

  private bucket(t: number): number {
    const idx = Math.floor(t / BUCKET_MS), pos = ((idx % BUCKETS) + BUCKETS) % BUCKETS;
    if (this.bIdx[pos] !== idx) {
      this.bIdx[pos] = idx;
      this.bBurst[pos] = 0;
      this.bDiscount[pos] = 0;
    }
    return pos;
  }

  private epochIndex(t: number): number {
    return Math.floor((t - (this.origin ?? t)) / EPOCH_MS);
  }

  private accFor(idx: number): EpochAcc {
    if (idx <= this.lastEmittedIdx) idx = this.lastEmittedIdx + 1;
    const open = this.open;
    for (let i = open.length - 1; i >= 0; i--) {
      if (open[i].idx === idx) return open[i];
      if (open[i].idx < idx) {
        const acc = this.newAcc(idx);
        open.splice(i + 1, 0, acc);
        return acc;
      }
    }
    const acc = this.newAcc(idx);
    open.unshift(acc);
    return acc;
  }

  private newAcc(idx: number): EpochAcc {
    const a = this.free.pop() ?? ({} as EpochAcc);
    a.idx = idx;
    a.sumDb = a.n = a.peak = a.snore = a.move = a.talk = a.noise = a.moveSec = a.talkSec = a.noiseSec = 0;
    a.floor = this.floorDb;
    return a;
  }

  private emitReadyEpochs(currentIdx: number): void {
    const origin = this.origin ?? 0;
    while (this.open.length && this.open[0].idx < currentIdx) {
      const acc = this.open[0];
      const end = origin + (acc.idx + 1) * EPOCH_MS;
      if (this.burstActive && this.bStartT < end) break;
      if (this.pending && this.pending.t < end) break;
      this.open.shift();
      if (acc.n > 0) this.emitEpoch(acc);
      this.free.push(acc);
    }
  }

  private emitEpoch(acc: EpochAcc): void {
    this.lastEmittedIdx = Math.max(this.lastEmittedIdx, acc.idx);
    const ep: Epoch = {
      t: (this.origin ?? 0) + acc.idx * EPOCH_MS,
      db: round1(acc.sumDb / Math.max(1, acc.n)),
      peak: round1(acc.peak),
      floor: round1(Math.max(0, acc.floor)),
      snore: acc.snore,
      move: acc.move,
      talk: acc.talk,
      noise: acc.noise,
      activity: Math.round(epochActivity(acc) * 1000) / 1000,
    };
    this.onEpoch?.(ep);
  }
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
