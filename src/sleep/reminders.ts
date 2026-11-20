// Bedtime reminders: a wind-down nudge and a bedtime nudge on chosen weekdays.
//
// Delivery, honestly:
// - In-app timers call onFire(kind) (the app shows the owl and plays a sound). They are drift-proof (re-checked at
//   least every minute against Date.now()) but only run while the page is alive: open, or in a background tab that the
//   browser has not frozen or discarded. A reminder discovered more than 10 min late (device slept) is skipped.
// - When the page is hidden at that moment we also show a system notification through the service worker
//   registration (falls back to `new Notification` on desktop when no worker is registered).
// - With the experimental Notification Triggers API (`TimestampTrigger`, Chromium behind a flag/origin trial) the next
//   week of reminders is scheduled with the OS, so they appear even when the app is closed. No other browser can wake a
//   closed web app at a set time without a push server, so elsewhere reminders need the app open or backgrounded.
// - Config persists in localStorage.

import { nextOccurrence, parseHHMM } from './alarm.ts';

export type ReminderKind = 'winddown' | 'bedtime';

export interface ReminderConfig {
  /** "HH:MM" local time */
  bedtime: string;
  /** minutes before bedtime for the wind-down nudge (0 = none) */
  windDownMin: number;
  /** weekdays of the bedtime itself, 0 = Sun .. 6 = Sat (empty = every day) */
  days: number[];
  enabled: boolean;
}

export interface UpcomingReminder {
  kind: ReminderKind;
  at: number;
}

export interface RemindersOptions {
  onFire: (kind: ReminderKind) => void;
  /** localStorage key (default "hoot-hollow.reminders.v1") */
  storageKey?: string;
  /** notification texts */
  messages?: Partial<Record<ReminderKind, { title: string; body: string }>>;
  /** notification icon URL */
  icon?: string;
  /** clock source (tests) */
  now?: () => number;
}

export const DEFAULT_REMINDERS: ReminderConfig = { bedtime: '22:30', windDownMin: 30, days: [0, 1, 2, 3, 4, 5, 6], enabled: false };

const DEFAULT_MESSAGES: Record<ReminderKind, { title: string; body: string }> = {
  winddown: { title: 'Time to wind down', body: 'Hoot is dimming the lanterns. Put the screens away and get cozy.' },
  bedtime: { title: 'Bedtime in Hoot Hollow', body: 'The owl is ready for tonight\'s adventure. Tap to start tracking your sleep.' },
};

const TAG_PREFIX = 'hoot-reminder-';
const LATE_GRACE_MS = 10 * 60_000;
const MAX_WAIT_MS = 60_000;
const TRIGGER_COUNT = 14; // about a week of wind-down + bedtime pairs

interface TriggerNotificationOptions extends NotificationOptions {
  showTrigger?: unknown;
  renotify?: boolean;
  timestamp?: number;
}
type TimestampTriggerCtor = new (timestamp: number) => unknown;

export class Reminders {
  private cfg: ReminderConfig;
  private readonly opts: RemindersOptions;
  private readonly key: string;
  private readonly now: () => number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingEv: UpcomingReminder | null = null;
  private visHook: (() => void) | null = null;

  constructor(opts: RemindersOptions) {
    this.opts = opts;
    this.key = opts.storageKey ?? 'hoot-hollow.reminders.v1';
    this.now = opts.now ?? (() => Date.now());
    this.cfg = sanitize(load(this.key), DEFAULT_REMINDERS);
    this.arm();
    if (this.cfg.enabled) void this.syncTriggers();
    if (typeof document !== 'undefined') {
      this.visHook = () => {
        if (document.visibilityState === 'visible') this.tick();
      };
      document.addEventListener('visibilitychange', this.visHook);
    }
  }

  /** Current config (a copy). */
  get config(): ReminderConfig {
    return { ...this.cfg, days: [...this.cfg.days] };
  }

  /** The next reminder that will fire, or null when disabled. */
  get next(): UpcomingReminder | null {
    return this.pendingEv ? { ...this.pendingEv } : null;
  }

  get permission(): NotificationPermission | 'unsupported' {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  /** True when the OS can show scheduled reminders with the app closed (Notification Triggers). */
  static get supportsTriggers(): boolean {
    return (
      typeof Notification !== 'undefined' &&
      'showTrigger' in Notification.prototype &&
      typeof (globalThis as { TimestampTrigger?: unknown }).TimestampTrigger === 'function'
    );
  }

  /** Ask for notification permission (call from a tap). */
  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    const result = await new Promise<NotificationPermission>((resolve) => {
      // older Safari only supports the callback form
      const maybe = Notification.requestPermission((p) => resolve(p));
      if (maybe && typeof maybe.then === 'function') maybe.then(resolve, () => resolve(Notification.permission));
    });
    if (result === 'granted') void this.syncTriggers();
    return result;
  }

  /** Update (merge) and persist the config, then reschedule. */
  configure(patch: Partial<ReminderConfig>): ReminderConfig {
    this.cfg = sanitize({ ...this.cfg, ...patch }, this.cfg);
    try {
      localStorage.setItem(this.key, JSON.stringify(this.cfg));
    } catch {
      /* private mode / storage full: keep the in-memory config */
    }
    this.arm();
    void this.syncTriggers();
    return this.config;
  }

  /** The next `count` reminders after `from` (default now). */
  upcoming(count = 2, from = this.now()): UpcomingReminder[] {
    if (!this.cfg.enabled) return [];
    const out: UpcomingReminder[] = [];
    const wd = this.cfg.windDownMin * 60_000;
    // Walk bedtimes forward from just before `from` so a wind-down that starts before `from`'s next bedtime is caught.
    let cursor = from - 1;
    for (let guard = 0; out.length < count + 2 && guard < 64; guard++) {
      const bed = nextOccurrence(this.cfg.bedtime, cursor, this.cfg.days);
      if (wd > 0 && bed - wd > from) out.push({ kind: 'winddown', at: bed - wd });
      if (bed > from) out.push({ kind: 'bedtime', at: bed });
      cursor = bed;
    }
    return out.sort((a, b) => a.at - b.at || (a.kind === 'winddown' ? -1 : 1)).slice(0, count);
  }

  /** Stop timers and listeners (config and OS-scheduled notifications stay). */
  dispose(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    if (this.visHook && typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visHook);
    this.visHook = null;
  }

  // ------------------------------------------------------------------ internals

  /** Schedule the next reminder after `from`. Waits at most a minute at a time so sleeping devices and throttled
   *  timers can't make it drift: every wake-up re-checks Date.now(). */
  private arm(from = this.now()): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pendingEv = this.upcoming(1, from)[0] ?? null;
    if (!this.pendingEv) return;
    const wait = Math.max(0, Math.min(this.pendingEv.at - this.now(), MAX_WAIT_MS));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.tick();
    }, wait);
  }

  private tick(): void {
    const ev = this.pendingEv;
    const now = this.now();
    if (ev && now >= ev.at) {
      if (now - ev.at <= LATE_GRACE_MS) this.fire(ev); // otherwise the device slept through it: skip silently
      this.arm(Math.max(now, ev.at));
    } else this.arm(now);
  }

  private fire(ev: UpcomingReminder): void {
    try {
      this.opts.onFire(ev.kind);
    } catch (err) {
      console.error('[reminders] onFire failed', err);
    }
    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    if (hidden) void this.notify(ev);
    else void this.closeScheduled(tagFor(ev));
  }

  private message(kind: ReminderKind): { title: string; body: string } {
    return this.opts.messages?.[kind] ?? DEFAULT_MESSAGES[kind];
  }

  private notificationOptions(ev: UpcomingReminder): TriggerNotificationOptions {
    return {
      body: this.message(ev.kind).body,
      tag: tagFor(ev), // same tag as an OS-scheduled one, so it replaces rather than duplicates
      icon: this.opts.icon,
      badge: this.opts.icon,
      data: { kind: ev.kind, at: ev.at, type: 'reminder' },
      timestamp: ev.at,
    };
  }

  private async notify(ev: UpcomingReminder): Promise<void> {
    if (this.permission !== 'granted') return;
    const title = this.message(ev.kind).title;
    const options = this.notificationOptions(ev);
    const reg = await registration();
    try {
      if (reg) await reg.showNotification(title, options);
      else new Notification(title, options);
    } catch (err) {
      // Android Chrome forbids `new Notification` without a service worker
      console.warn('[reminders] notification failed', err);
    }
  }

  private async closeScheduled(tag: string): Promise<void> {
    const reg = await registration();
    if (!reg) return;
    try {
      const list = await reg.getNotifications({ tag, includeTriggered: true } as GetNotificationOptions);
      list.forEach((n) => n.close());
    } catch {
      /* ignore */
    }
  }

  /** (Re)schedule OS-level notifications when Notification Triggers exist. */
  private async syncTriggers(): Promise<void> {
    if (!Reminders.supportsTriggers || this.permission !== 'granted') return;
    const reg = await registration();
    if (!reg) return;
    try {
      const existing = await reg.getNotifications({ includeTriggered: true } as GetNotificationOptions);
      existing.filter((n) => n.tag.startsWith(TAG_PREFIX)).forEach((n) => n.close());
      if (!this.cfg.enabled) return;
      const Trigger = (globalThis as unknown as { TimestampTrigger: TimestampTriggerCtor }).TimestampTrigger;
      for (const ev of this.upcoming(TRIGGER_COUNT)) {
        const options: TriggerNotificationOptions = { ...this.notificationOptions(ev), showTrigger: new Trigger(ev.at) };
        await reg.showNotification(this.message(ev.kind).title, options);
      }
    } catch (err) {
      console.warn('[reminders] could not schedule notifications', err);
    }
  }
}

function tagFor(ev: UpcomingReminder): string {
  return `${TAG_PREFIX}${ev.kind}-${ev.at}`;
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
    return await navigator.serviceWorker.getRegistration();
  } catch {
    return undefined;
  }
}

function load(key: string): Partial<ReminderConfig> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    return raw ? (JSON.parse(raw) as Partial<ReminderConfig>) : {};
  } catch {
    return {};
  }
}

function sanitize(c: Partial<ReminderConfig>, fallback: ReminderConfig): ReminderConfig {
  let bedtime = fallback.bedtime;
  if (typeof c.bedtime === 'string') {
    try {
      const [h, m] = parseHHMM(c.bedtime);
      bedtime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } catch {
      /* keep fallback */
    }
  }
  const wd = Number(c.windDownMin);
  const days = Array.isArray(c.days)
    ? [...new Set(c.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
    : [...fallback.days];
  return {
    bedtime,
    windDownMin: Number.isFinite(wd) ? Math.min(180, Math.max(0, Math.round(wd))) : fallback.windDownMin,
    days,
    enabled: typeof c.enabled === 'boolean' ? c.enabled : fallback.enabled,
  };
}
