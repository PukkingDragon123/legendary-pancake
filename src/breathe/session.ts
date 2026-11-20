// Breathing patterns and the session clock that drives everything else: the owl's chest, the
// glowing ring, the particles, the fireflies, the cues, sounds and haptics all read `lung` (0..1)
// and the current phase from here. A "follow me" mode lets the breather set the pace by holding.

export type PhaseKind = 'in' | 'hold' | 'out' | 'rest';
export interface Phase { kind: PhaseKind; sec: number; label: string }
export interface Pattern { id: string; name: string; blurb: string; phases: Phase[]; color: string; best: string }

const P = (kind: PhaseKind, sec: number, label?: string): Phase => ({ kind, sec, label: label ?? { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', rest: 'Rest' }[kind] });

export const PATTERNS: Pattern[] = [
  { id: 'settle', name: 'Settle', blurb: 'In for 4, out for 6. Longer exhales calm the body.', best: 'Any time', color: '#e8a83a', phases: [P('in', 4), P('out', 6)] },
  { id: 'sleep', name: '4 · 7 · 8', blurb: 'The classic wind-down. Hold gently, sigh it all out.', best: 'Before sleep', color: '#7a5fd0', phases: [P('in', 4), P('hold', 7), P('out', 8)] },
  { id: 'box', name: 'Box', blurb: 'Four even sides: in, hold, out, hold.', best: 'Busy mind', color: '#5f8f4c', phases: [P('in', 4), P('hold', 4), P('out', 4), P('rest', 4, 'Hold')] },
  { id: 'coherent', name: 'Even tide', blurb: 'Slow, even waves at about five breaths a minute.', best: 'Steadying', color: '#4f8fd0', phases: [P('in', 5.5), P('out', 5.5)] },
  { id: 'sigh', name: 'Sleepy sigh', blurb: 'Two sips in, one long sigh out. Quick relief.', best: 'Stressed', color: '#d9576a', phases: [P('in', 2.5), P('in', 1.2, 'A little more'), P('out', 6, 'Long sigh out')] },
];
export const PATTERN: Record<string, Pattern> = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));

export interface BreathState {
  lung: number;
  phase: Phase;
  /** 0..1 progress through the phase */
  k: number;
  /** seconds left in the phase (rounded up for the count) */
  left: number;
  cycle: number;
  cycles: number;
  elapsed: number;
  total: number;
  done: boolean;
  /** true in follow-me mode */
  follow: boolean;
}

const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));

export class BreathSession {
  readonly pattern: Pattern;
  readonly total: number;
  private t = 0;
  private lungFrom = 0;
  private lastPhase = -1;
  private lastCycle = 0;
  follow = false;
  holding = false;
  private followLung = 0;
  private followBreaths = 0;
  private wasHolding = false;
  onPhase: (p: Phase, i: number) => void = () => {};

  constructor(pattern: Pattern, minutes: number) {
    this.pattern = pattern;
    const cyc = pattern.phases.reduce((a, p) => a + p.sec, 0);
    this.total = Math.max(1, Math.round((minutes * 60) / cyc)) * cyc;
  }

  get cycleLen() { return this.pattern.phases.reduce((a, p) => a + p.sec, 0); }

  step(dt: number): BreathState {
    this.t += dt;
    if (this.follow) return this.stepFollow(dt);
    const L = this.cycleLen, t = Math.min(this.t, this.total);
    const cycle = Math.floor(t / L), inC = t - cycle * L;
    let acc = 0, idx = 0;
    for (let i = 0; i < this.pattern.phases.length; i++) { if (inC < acc + this.pattern.phases[i].sec) { idx = i; break; } acc += this.pattern.phases[i].sec; idx = i; }
    const ph = this.pattern.phases[idx], k = Math.min(1, (inC - acc) / ph.sec);
    const key = cycle * 10 + idx;
    if (key !== this.lastPhase) {
      // remember where the lungs were so every phase eases from the current fullness
      this.lungFrom = this.lungAt(ph, 0, this.lastPhase < 0 ? 0 : this.currentLung);
      this.lastPhase = key;
      this.lastCycle = cycle;
      if (this.t < this.total) this.onPhase(ph, idx);
    }
    const lung = this.lungAt(ph, k, this.lungFrom);
    this.currentLung = lung;
    return { lung, phase: ph, k, left: Math.max(1, Math.ceil(ph.sec * (1 - k) - 0.001)), cycle: this.lastCycle, cycles: Math.round(this.total / L), elapsed: t, total: this.total, done: this.t >= this.total, follow: false };
  }

  private currentLung = 0;
  private lungAt(ph: Phase, k: number, from: number): number {
    if (ph.kind === 'in') {
      // a "top-up" second inhale starts from where the first ended
      const target = from > 0.6 ? 1 : 0.86;
      return from + (target - from) * ease(k) + (target === 1 ? 0 : 0);
    }
    if (ph.kind === 'out') return from * (1 - ease(k));
    return from;
  }

  /** Follow-me: hold to breathe in, let go to breathe out. */
  private stepFollow(dt: number): BreathState {
    const target = this.holding ? 1 : 0;
    const rate = this.holding ? 0.28 : 0.2;
    this.followLung += (target - this.followLung) * Math.min(1, dt / rate * 0.35);
    if (this.holding && !this.wasHolding) this.onPhase(P('in', 4), 0);
    if (!this.holding && this.wasHolding) { this.onPhase(P('out', 6), 1); if (this.followLung > 0.45) this.followBreaths++; }
    this.wasHolding = this.holding;
    const ph = this.holding ? P('in', 4, 'Breathe in') : P('out', 6, this.followLung > 0.05 ? 'Breathe out' : 'Hold to breathe in');
    return { lung: this.followLung, phase: ph, k: this.followLung, left: 0, cycle: this.followBreaths, cycles: 0, elapsed: this.t, total: 0, done: false, follow: true };
  }

  get breaths() { return this.follow ? this.followBreaths : Math.floor(Math.min(this.t, this.total) / this.cycleLen); }
}
