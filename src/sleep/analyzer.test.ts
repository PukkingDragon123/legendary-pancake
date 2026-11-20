import { describe, expect, it } from 'vitest';
import { FFT, FrameAnalyzer, LIGHT_SLEEP_ACTIVITY, classifyBurst, epochActivity } from './analyzer.ts';
import type { Epoch, LiveLevel, SleepEvent, SleepEventKind } from './types.ts';

// ---------------------------------------------------------------------------------------------- synthesis helpers

function prng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** approx. unit-variance gaussian */
const gauss = (r: () => number) => (r() + r() + r() + r() - 2) * 1.732;

class BQ {
  private z1 = 0;
  private z2 = 0;
  constructor(private b0: number, private b1: number, private b2: number, private a1: number, private a2: number) {}
  static bandpass(fc: number, q: number, sr: number) {
    const w = (2 * Math.PI * fc) / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    return new BQ(al / a0, 0, -al / a0, (-2 * Math.cos(w)) / a0, (1 - al) / a0);
  }
  static lowpass(fc: number, q: number, sr: number) {
    const w = (2 * Math.PI * fc) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    return new BQ((1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0);
  }
  static highpass(fc: number, q: number, sr: number) {
    const w = (2 * Math.PI * fc) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    return new BQ((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - al) / a0);
  }
  run(x: number) {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
}

interface Truth { t: number; dur: number; kind: SleepEventKind }

class Scene {
  readonly buf: Float32Array;
  readonly truth: Truth[] = [];
  readonly r: () => number;
  constructor(readonly sr: number, readonly seconds: number, seed = 1, floorRms = 3e-4) {
    this.buf = new Float32Array(Math.round(sr * seconds));
    this.r = prng(seed);
    // quiet bedroom: slightly pink-ish background hiss at ~ -70 dBFS
    const lp = BQ.lowpass(3000, 0.7, sr);
    for (let i = 0; i < this.buf.length; i++) this.buf[i] = (lp.run(gauss(this.r)) * 1.3 + gauss(this.r) * 0.35) * floorRms;
  }
  /** periodic low-frequency snore swells (harmonics of ~100 Hz + low-passed breath noise) */
  snore(at: number, dur = 1.2, amp = 0.02) {
    const sr = this.sr, n = Math.round(dur * sr), i0 = Math.round(at * sr), f0 = 90 + this.r() * 25;
    const lp = BQ.lowpass(350, 0.7, sr);
    let ph = 0;
    for (let i = 0; i < n && i0 + i < this.buf.length; i++) {
      const env = Math.pow(Math.sin((Math.PI * i) / n), 1.5);
      ph += (2 * Math.PI * f0 * (1 + 0.01 * Math.sin(i / sr * 7))) / sr;
      let s = 0;
      for (let k = 1; k <= 8; k++) s += Math.sin(k * ph) / (k * k);
      s += lp.run(gauss(this.r)) * 0.6;
      this.buf[i0 + i] += amp * env * s;
    }
    this.truth.push({ t: at, dur, kind: 'snore' });
  }
  /** speech-like phrase: 300-2000 Hz noise with a voiced buzz, chopped into 4-6 Hz syllables */
  talk(at: number, dur = 2.5, amp = 0.012) {
    const sr = this.sr, i0 = Math.round(at * sr);
    const bp1 = BQ.bandpass(800, 0.6, sr), bp2 = BQ.bandpass(800, 0.6, sr), hp = BQ.highpass(300, 0.7, sr);
    let t = 0, ph = 0;
    const f0 = 130 + this.r() * 60;
    while (t < dur) {
      const syl = 0.11 + this.r() * 0.1, gapS = 0.04 + this.r() * 0.08;
      const n = Math.round(syl * sr), s0 = i0 + Math.round(t * sr), a = amp * (0.6 + this.r() * 0.6);
      for (let i = 0; i < n && s0 + i < this.buf.length; i++) {
        const env = Math.sin((Math.PI * i) / n);
        ph += (2 * Math.PI * f0) / sr;
        let v = 0;
        for (let k = 3; k <= 14; k++) v += Math.sin(k * ph) / k;
        const noise = bp2.run(bp1.run(gauss(this.r)));
        this.buf[s0 + i] += a * env * hp.run(noise * 2 + v * 0.5);
      }
      t += syl + gapS;
    }
    this.truth.push({ t: at, dur, kind: 'talk' });
  }
  /** broadband rustle of bedding: white-ish noise with a crackly irregular envelope */
  rustle(at: number, dur = 0.8, amp = 0.01) {
    const sr = this.sr, n = Math.round(dur * sr), i0 = Math.round(at * sr);
    const hp = BQ.highpass(400, 0.7, sr);
    let crackle = 0.5;
    for (let i = 0; i < n && i0 + i < this.buf.length; i++) {
      if (i % Math.round(sr * 0.015) === 0) crackle = 0.35 + this.r() * 0.65;
      const env = Math.min(1, i / (0.03 * sr)) * Math.min(1, (n - i) / (0.08 * sr));
      this.buf[i0 + i] += amp * env * crackle * hp.run(gauss(this.r));
    }
    this.truth.push({ t: at, dur, kind: 'movement' });
  }
}

interface Run { events: SleepEvent[]; epochs: Epoch[]; levels: LiveLevel[]; an: FrameAnalyzer }

function run(scene: Scene, opts: { frame?: number | 'random'; t0?: number; sensitivity?: number; flush?: boolean } = {}): Run {
  const events: SleepEvent[] = [], epochs: Epoch[] = [], levels: LiveLevel[] = [];
  const t0 = opts.t0 ?? 1_700_000_000_000;
  const an = new FrameAnalyzer({
    sensitivity: opts.sensitivity,
    origin: t0,
    onEvent: (e) => events.push(e),
    onEpoch: (e) => epochs.push(e),
    onLevel: (l) => levels.push(l),
  });
  const r = prng(99);
  let i = 0;
  while (i < scene.buf.length) {
    const len = opts.frame === 'random' ? 128 + Math.floor(r() * 4000) : (opts.frame ?? Math.round(scene.sr * 0.1));
    const frame = scene.buf.subarray(i, Math.min(scene.buf.length, i + len));
    an.push(frame, scene.sr, t0 + (i / scene.sr) * 1000);
    i += len;
  }
  if (opts.flush !== false) an.flush();
  return { events, epochs, levels, an };
}

/** match detected events to ground truth by time overlap; returns per-truth detected kind (or null) */
function match(scene: Scene, events: SleepEvent[], t0 = 1_700_000_000_000) {
  return scene.truth.map((tr) => {
    const a = t0 + tr.t * 1000, b = a + tr.dur * 1000;
    const hit = events.find((e) => e.t < b + 300 && e.t + e.dur * 1000 > a - 300);
    return hit ? hit.kind : null;
  });
}

const share = (kinds: (SleepEventKind | null)[], k: SleepEventKind) => kinds.filter((x) => x === k).length / kinds.length;

// --------------------------------------------------------------------------------------------------------- tests

describe('FFT', () => {
  it('puts a pure tone in the right bin and conserves energy', () => {
    const n = 256, fft = new FFT(n), re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * 10 * i) / n);
    fft.transform(re, im);
    const mag = Array.from(re, (v, k) => Math.hypot(v, im[k]));
    expect(mag.indexOf(Math.max(...mag.slice(0, n / 2)))).toBe(10);
    expect(mag[10]).toBeCloseTo(n / 2, 6);
    expect(mag[11]).toBeLessThan(1e-9);
  });
});

describe('FrameAnalyzer: levels, floor and epochs', () => {
  it('stays quiet in a silent room and tracks the floor', () => {
    const s = new Scene(16000, 95, 3);
    const { events, epochs, levels, an } = run(s);
    expect(events.length).toBeLessThanOrEqual(1);
    expect(epochs.length).toBe(4); // 3 full epochs + 1 partial on flush
    expect(epochs[1].t - epochs[0].t).toBe(30_000);
    for (const e of epochs) {
      expect(e.activity).toBe(0);
      expect(e.db).toBeGreaterThan(20);
      expect(e.db).toBeLessThan(40);
      expect(Math.abs(e.floor - e.db)).toBeLessThan(3);
    }
    expect(levels.length).toBeGreaterThan(900);
    for (const l of levels.slice(0, 50)) {
      expect(l.bands).toHaveLength(16);
      for (const b of l.bands) expect(b >= 0 && b <= 1).toBe(true);
      expect(Number.isFinite(l.db)).toBe(true);
    }
    expect(an.recentActivity(5)).toBe(0);
  });

  it('adapts the floor to a persistent new sound (fan switching on)', () => {
    const s = new Scene(16000, 120, 4);
    const r = prng(5);
    for (let i = 30 * 16000; i < s.buf.length; i++) s.buf[i] += gauss(r) * 3e-3; // +20 dB broadband from t=30 s
    const { an, events } = run(s);
    expect(an.noiseFloor).toBeGreaterThan(45);
    expect(events.filter((e) => e.t > 1_700_000_000_000 + 100_000).length).toBe(0);
  });
});

describe('FrameAnalyzer: event classification', () => {
  it('recognises a snoring pattern (1.2 s bursts every 4 s)', () => {
    const s = new Scene(16000, 60, 7);
    for (let k = 0; k < 12; k++) s.snore(5 + k * 4);
    const { events, epochs, an } = run(s);
    const kinds = match(s, events);
    expect(share(kinds, 'snore')).toBeGreaterThanOrEqual(0.8);
    const snores = events.filter((e) => e.kind === 'snore');
    expect(snores.length).toBeGreaterThanOrEqual(10);
    for (const e of snores) {
      expect(e.dur).toBeGreaterThan(0.5);
      expect(e.dur).toBeLessThan(2);
    }
    // epoch counts agree with emitted events; snoring is not "activity"
    expect(epochs.reduce((a, e) => a + e.snore, 0)).toBe(snores.length);
    for (const e of epochs) expect(e.activity).toBeLessThan(0.15);
    expect(an.recentActivity(5)).toBeLessThan(0.1);
  });

  it('recognises speech-like talking', () => {
    const s = new Scene(16000, 70, 11);
    for (let k = 0; k < 7; k++) s.talk(4 + k * 9, 1.8 + (k % 3) * 0.7);
    const { events, epochs } = run(s);
    const kinds = match(s, events);
    expect(share(kinds, 'talk')).toBeGreaterThanOrEqual(0.8);
    expect(epochs.reduce((a, e) => a + e.talk, 0)).toBe(events.filter((e) => e.kind === 'talk').length);
  });

  it('recognises broadband rustles as movement and raises recent activity', () => {
    const s = new Scene(16000, 75, 13);
    const r = prng(3);
    let t = 3;
    for (let k = 0; k < 10; k++) {
      s.rustle(t, 0.3 + r() * 1.3);
      t += 4 + r() * 3;
    }
    const { events, epochs, an } = run(s);
    const kinds = match(s, events);
    expect(share(kinds, 'movement')).toBeGreaterThanOrEqual(0.8);
    expect(an.recentActivity(5)).toBeGreaterThan(LIGHT_SLEEP_ACTIVITY);
    expect(Math.max(...epochs.map((e) => e.activity))).toBeGreaterThan(0.5);
  });

  it('separates a mixed night segment at 48 kHz with irregular frame sizes', () => {
    const s = new Scene(48000, 150, 21);
    for (let k = 0; k < 10; k++) s.snore(4 + k * 4.2, 1.0 + (k % 3) * 0.3);
    s.rustle(50, 0.9);
    s.talk(58, 2.6);
    s.rustle(66, 0.5);
    s.talk(74, 3.2);
    s.rustle(83, 1.4);
    for (let k = 0; k < 8; k++) s.snore(95 + k * 3.6, 1.3);
    s.talk(130, 2.0);
    s.rustle(139, 0.7);
    const { events } = run(s, { frame: 'random' });
    const kinds = match(s, events);
    const correct = kinds.filter((k, i) => k === s.truth[i].kind).length;
    expect(correct / kinds.length).toBeGreaterThanOrEqual(0.8);
    // events arrive with sane fields
    for (const e of events) {
      expect(Number.isFinite(e.t) && Number.isFinite(e.db) && e.dur > 0).toBe(true);
    }
  });

  it('labels a lone low thump/rumble as noise, not snore', () => {
    const s = new Scene(16000, 40, 31);
    s.snore(10, 1.5, 0.03); // single isolated low-frequency swell, no repetition
    const { events } = run(s);
    expect(events.length).toBe(1);
    expect(events[0].kind).toBe('noise');
  });

  it('sensitivity changes what counts as an event', () => {
    const s = new Scene(16000, 40, 41);
    for (let k = 0; k < 5; k++) s.rustle(3 + k * 7, 0.8, 0.0012); // faint rustles (~ +9 dB over the floor)
    expect(run(s, { sensitivity: 0.1 }).events.length).toBe(0);
    expect(run(s, { sensitivity: 0.95 }).events.length).toBeGreaterThanOrEqual(4);
  });
});

describe('classifier & activity helpers', () => {
  it('scores prototypical features as expected', () => {
    const base = { flatness: 0.1, modRatio: 0.1, highFrac: 0.02, speechFrac: 0.2, lowFrac: 0.85, dur: 1.2 };
    expect(classifyBurst(base).kind).toBe('snore');
    expect(classifyBurst({ ...base, lowFrac: 0.15, speechFrac: 0.85, modRatio: 0.65, dur: 2.5 }).kind).toBe('talk');
    expect(classifyBurst({ ...base, lowFrac: 0.05, speechFrac: 0.35, highFrac: 0.6, flatness: 0.7, dur: 0.6 }).kind).toBe('movement');
    expect(classifyBurst({ ...base, dur: 12 }).kind).toBe('noise');
  });
  it('maps event seconds to 0..1 activity', () => {
    const zero = { move: 0, talk: 0, noise: 0, moveSec: 0, talkSec: 0, noiseSec: 0 };
    expect(epochActivity(zero)).toBe(0);
    const one = epochActivity({ ...zero, move: 1, moveSec: 1 });
    const two = epochActivity({ ...zero, move: 2, moveSec: 2 });
    expect(one).toBeGreaterThan(0.3);
    expect(two).toBeGreaterThan(one);
    expect(epochActivity({ ...zero, move: 10, moveSec: 30 })).toBeLessThanOrEqual(1);
  });
});
