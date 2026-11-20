// Alarm clock with a smart wake window. DOM-light: only an optional visibilitychange hook, everything else is timers.
//
// Timing: a 1 s tick chain (setTimeout, re-aligned every tick). Ticks are never trusted to be punctual: background tabs
// throttle timers to once a minute or freeze them entirely, so every tick compares Date.now() against the targets and
// rings late rather than never. When the tab becomes visible again we check immediately.
//
// Smart window: from (wakeAt - smartWindowMin) until wakeAt, ring early once isLight() has stayed true for
// `lightHoldMs` (default 1 min) of wall-clock time. Always ring at wakeAt.

export type AlarmState = 'idle' | 'armed' | 'ringing' | 'snoozed';
export type RingReason = 'smart' | 'target' | 'snooze';

export interface AlarmPlan {
  /** latest time to ring (epoch ms) */
  wakeAt: number;
  /** minutes before wakeAt in which an early ring is allowed (0 = exact time) */
  smartWindowMin: number;
  /** e.g. () => recorder.recentActivity(5) > LIGHT_SLEEP_ACTIVITY */
  isLight: () => boolean;
  onRing: (reason: RingReason) => void;
  /** how long isLight() must hold before an early ring (default 60 000 ms) */
  lightHoldMs?: number;
}

export interface AlarmClockOptions {
  /** clock source (default Date.now) */
  now?: () => number;
  /** tick period, default 1000 ms */
  tickMs?: number;
  onStateChange?: (s: AlarmState) => void;
}

export class AlarmClock {
  private _state: AlarmState = 'idle';
  private plan: AlarmPlan | null = null;
  private target = 0;
  private lightSince: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private _reason: RingReason | null = null;
  private _rangAt: number | null = null;
  private readonly now: () => number;
  private readonly tickMs: number;
  private readonly onStateChange?: (s: AlarmState) => void;
  private visHook: (() => void) | null = null;

  constructor(opts: AlarmClockOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.tickMs = Math.max(50, opts.tickMs ?? 1000);
    this.onStateChange = opts.onStateChange;
  }

  get state(): AlarmState {
    return this._state;
  }
  /** when the alarm will ring at the latest (wakeAt, or the snooze end); null when idle or ringing */
  get nextRingAt(): number | null {
    return this._state === 'armed' || this._state === 'snoozed' ? this.target : null;
  }
  /** start of the smart window while armed, else null */
  get windowStart(): number | null {
    return this._state === 'armed' && this.plan ? this.target - Math.max(0, this.plan.smartWindowMin) * 60_000 : null;
  }
  /** why the alarm last rang */
  get ringReason(): RingReason | null {
    return this._reason;
  }
  get rangAt(): number | null {
    return this._rangAt;
  }

  schedule(plan: AlarmPlan): void {
    if (!Number.isFinite(plan.wakeAt)) throw new RangeError('wakeAt must be a finite timestamp');
    this.stopTimer();
    this.plan = { ...plan, smartWindowMin: Math.max(0, Number.isFinite(plan.smartWindowMin) ? plan.smartWindowMin : 0) };
    this.target = plan.wakeAt;
    this.lightSince = null;
    this._reason = null;
    this._rangAt = null;
    this.setState('armed');
    this.hookVisibility();
    this.loop(0);
  }

  /** Disarm (also stops a ringing alarm). */
  cancel(): void {
    this.stopTimer();
    this.plan = null;
    this.lightSince = null;
    this.unhookVisibility();
    this.setState('idle');
  }

  /** Ring again in `min` minutes (default 9). Ignored when idle. */
  snooze(min = 9): void {
    if (this._state === 'idle' || !this.plan) return;
    this.stopTimer();
    this.target = this.now() + Math.max(0.1, min) * 60_000;
    this.lightSince = null;
    this.setState('snoozed');
    this.loop(Math.min(this.tickMs, this.target - this.now()));
  }

  /** Stop ringing and finish. */
  dismiss(): void {
    this.cancel();
  }

  /** Evaluate now (call on visibilitychange/focus or from your own timers; safe to call any time). */
  check(): void {
    this.tick(false);
  }

  private tick(reschedule = true): void {
    const plan = this.plan;
    if (!plan || this._state === 'idle' || this._state === 'ringing') return;
    const now = this.now();
    if (this._state === 'snoozed') {
      if (now >= this.target) return this.ring('snooze', now);
    } else {
      if (now >= this.target) return this.ring('target', now);
      const winStart = this.target - plan.smartWindowMin * 60_000;
      if (plan.smartWindowMin > 0 && now >= winStart) {
        let light = false;
        try {
          light = !!plan.isLight();
        } catch {
          light = false;
        }
        if (light) {
          if (this.lightSince === null) this.lightSince = now;
          if (now - this.lightSince >= (plan.lightHoldMs ?? 60_000)) return this.ring('smart', now);
        } else this.lightSince = null;
      } else this.lightSince = null;
    }
    if (reschedule) {
      // align to the tick grid but never overshoot the target
      const toTarget = this.target - now;
      this.loop(Math.max(0, Math.min(this.tickMs - (now % this.tickMs), toTarget)));
    }
  }

  private ring(reason: RingReason, now: number): void {
    this.stopTimer();
    this._reason = reason;
    this._rangAt = now;
    this.setState('ringing');
    try {
      this.plan?.onRing(reason);
    } catch (err) {
      console.error('[alarm] onRing failed', err);
    }
  }

  private loop(delay: number): void {
    this.stopTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.tick(true);
    }, Math.max(0, delay));
  }

  private stopTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private setState(s: AlarmState): void {
    if (s === this._state) return;
    this._state = s;
    try {
      this.onStateChange?.(s);
    } catch (err) {
      console.error('[alarm] onStateChange failed', err);
    }
  }

  private hookVisibility(): void {
    if (this.visHook || typeof document === 'undefined') return;
    this.visHook = () => {
      if (document.visibilityState === 'visible') this.check();
    };
    document.addEventListener('visibilitychange', this.visHook);
  }

  private unhookVisibility(): void {
    if (this.visHook && typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visHook);
    this.visHook = null;
  }
}

/** Parse "HH:MM" (24 h, "7:05" ok) into [hours, minutes]. Throws RangeError on bad input. */
export function parseHHMM(hhmm: string): [number, number] {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(hhmm);
  if (!m) throw new RangeError(`Invalid time "${hhmm}" (expected HH:MM)`);
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) throw new RangeError(`Invalid time "${hhmm}"`);
  return [h, mi];
}

/**
 * Next local-time occurrence of "HH:MM" strictly after `now`, optionally limited to weekdays (0 = Sun .. 6 = Sat;
 * an empty or missing list means every day). DST-safe: each candidate is built from calendar fields.
 */
export function nextOccurrence(hhmm: string, now: number, days?: number[]): number {
  const [h, mi] = parseHHMM(hhmm);
  const allowed = days && days.length ? new Set(days.map((d) => ((Math.trunc(d) % 7) + 7) % 7)) : null;
  const base = new Date(now);
  for (let k = 0; k <= 8; k++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + k, h, mi, 0, 0);
    if (d.getTime() <= now) continue;
    if (allowed && !allowed.has(d.getDay())) continue;
    return d.getTime();
  }
  throw new RangeError('No matching day');
}
