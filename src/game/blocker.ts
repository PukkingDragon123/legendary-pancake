// Bedtime site blocker: the app side of the Hoot Hollow companion extension (see /extension).
//
// A web page cannot block other sites by itself, so the extension does the blocking and this module
// configures it. The two talk through window.postMessage on the app's own page:
//
//   page  -> ext   { source: 'hoot-hollow',     type: 'hello' | 'config' | 'sleep', payload?, id? }
//   ext   -> page  { source: 'hoot-hollow-ext', type: 'status', payload: BlockStatus, re? }
//
// The extension's content script only listens on pages carrying <meta name="hoot-hollow-app" content="1">
// (BlockerBridge.connect() adds it), answers every request with a status (echoing `id` as `re`), and
// pushes a fresh status whenever the blocking state or config changes.
//
// The schedule helpers below (isBlockedNow, nextChange, nextWake, ...) are mirrored line-for-line in
// extension/lib/schedule.js. Keep the two in step.

export interface BlockConfig {
  enabled: boolean;
  /** built-in social sites that are switched on (domains; each also blocks its subdomains) */
  sites: string[];
  /** extra domains the user added */
  custom: string[];
  /** bedtime window start, 'HH:MM' local time */
  start: string;
  /** bedtime window end, 'HH:MM' local time; earlier than start = crosses midnight */
  end: string;
  /** nights the window starts on, 0 = Sunday (22:30 Fri -> 07:00 Sat counts as Friday) */
  days: number[];
  /** strict: no pausing from the extension and no loosening of the config while blocking */
  strict: boolean;
  /** ignore the window and only block while the app says a sleep session / wind-down is active */
  duringSleepOnly: boolean;
  /**
   * How Pip looks on the bedtime page and in the popup: the default owl, or the unlockable Meowl skin
   * (a kitten's head on a little owl's body). Optional; missing means 'owl'. Purely cosmetic, so it
   * applies at once even while strict mode is blocking.
   */
  mascot?: Mascot;
}

/** Pip's looks: 'owl' is the default, 'meowl' an unlockable skin. */
export type Mascot = 'owl' | 'meowl';

export interface BlockStatus {
  installed: true;
  /** extension version */
  version: string;
  blocking: boolean;
  /** 'off' = not blocking right now (blocker disabled or outside the window) */
  reason: 'window' | 'sleep' | 'off' | 'paused';
  /** epoch ms of the next time `blocking` flips (window edge, end of sleep mode, end of a pause) */
  nextChange?: number;
  /** epoch ms a "just this once" pause ends */
  pausedUntil?: number;
  /** blocked visits today (local calendar day) */
  blockedToday: number;
  /** the config in force right now */
  config: BlockConfig;
  /** a config sent while strict mode was blocking; it takes effect when blocking ends (additions apply at once) */
  pendingConfig?: BlockConfig;
}

export interface SleepSignal {
  active: boolean;
  /** epoch ms; sleep mode also always ends at the next window end (cfg.end) */
  until?: number;
}

export type InstallBrowser = 'chrome' | 'edge' | 'firefox' | 'other';

export const DEFAULT_SITES: readonly string[] = [
  'tiktok.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'reddit.com',
  'youtube.com',
  'snapchat.com',
  'threads.net',
  'pinterest.com',
  'twitch.tv',
  'discord.com',
];

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function defaultBlockConfig(): BlockConfig {
  return {
    enabled: true,
    sites: [...DEFAULT_SITES],
    custom: [],
    start: '22:30',
    end: '07:00',
    days: [...ALL_DAYS],
    strict: false,
    duringSleepOnly: false,
    mascot: 'owl',
  };
}

/** 'HH:MM' -> minutes after midnight, or null when malformed. */
export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const minutesOf = (d: Date): number => d.getHours() * 60 + d.getMinutes();

/** True when the window can ever be open: valid times, start != end, at least one day. */
export function hasSchedule(cfg: BlockConfig): boolean {
  const s = parseHHMM(cfg.start);
  const e = parseHHMM(cfg.end);
  return s !== null && e !== null && s !== e && cfg.days.length > 0;
}

/** Is the bedtime window open at `now`? (ignores `enabled` and `duringSleepOnly`) */
export function inWindow(cfg: BlockConfig, now: Date): boolean {
  const s = parseHHMM(cfg.start);
  const e = parseHHMM(cfg.end);
  if (s === null || e === null || s === e) return false;
  const n = minutesOf(now);
  const day = now.getDay();
  const on = (d: number) => cfg.days.includes(d);
  if (s < e) return on(day) && n >= s && n < e;
  // crosses midnight: the evening part belongs to today, the early-morning part to yesterday's night
  return (n >= s && on(day)) || (n < e && on((day + 6) % 7));
}

/** Should sites be blocked at `now`? `sleepActive` = the app reports a sleep session / wind-down. */
export function isBlockedNow(cfg: BlockConfig, now: Date, sleepActive: boolean): boolean {
  if (!cfg.enabled) return false;
  if (sleepActive) return true;
  if (cfg.duringSleepOnly) return false;
  return inWindow(cfg, now);
}

/**
 * The next instant after `now` at which the scheduled blocking (isBlockedNow with sleepActive=false)
 * flips on or off. When it never flips (blocker off, sleep-only mode, no days, start == end) the
 * result is one week after `now`; use hasSchedule() to tell the cases apart.
 */
export function nextChange(cfg: BlockConfig, now: Date): Date {
  const fallback = new Date(now.getTime() + 7 * DAY_MS);
  const s = parseHHMM(cfg.start);
  const e = parseHHMM(cfg.end);
  if (!cfg.enabled || cfg.duringSleepOnly || !hasSchedule(cfg) || s === null || e === null) return fallback;
  const cur = inWindow(cfg, now);
  let best: Date | null = null;
  for (let k = 0; k <= 8; k++) {
    for (const mins of [s, e]) {
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k, Math.floor(mins / 60), mins % 60, 0, 0);
      // DST: a fall-back night repeats local times 30-60 min later; a spring-forward gap skips them
      for (const extra of [0, 30, 60]) {
        let t = new Date(base.getTime() + extra * MIN_MS);
        if (minutesOf(t) !== mins) {
          if (extra) continue;
          t = gapEnd(cfg, t, now);
        }
        if (t.getTime() <= now.getTime()) continue;
        if (inWindow(cfg, t) !== cur && (best === null || t.getTime() < best.getTime())) best = t;
      }
    }
  }
  return best ?? fallback;
}

/** `t` landed past a spring-forward gap: walk back to the first minute after the clock jumped. */
function gapEnd(cfg: BlockConfig, t: Date, now: Date): Date {
  const state = inWindow(cfg, t);
  let u = t.getTime();
  for (let i = 0; i < 180; i++) {
    const p = u - MIN_MS;
    if (p <= now.getTime() || inWindow(cfg, new Date(p)) !== state) break;
    u = p;
  }
  return new Date(u);
}

/** Next occurrence of cfg.end after `now` (any weekday). Sleep mode never outlasts it. */
export function nextWake(cfg: BlockConfig, now: Date): Date {
  const e = parseHHMM(cfg.end) ?? 7 * 60;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(e / 60), e % 60, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t;
}

/**
 * Turn user input ('https://www.Example.com/feed', 'm.reddit.com') into a bare domain
 * ('example.com', 'm.reddit.com'), or null when it isn't one. A leading 'www.' is dropped because
 * every domain also blocks its subdomains.
 */
export function normalizeDomain(input: string): string | null {
  let s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = 'http://' + s;
  let host: string;
  try {
    host = new URL(s).hostname;
  } catch {
    return null;
  }
  host = host.replace(/\.$/, '').replace(/^www\./, '');
  if (host.length > 253 || !host.includes('.')) return null;
  if (/^\d+(\.\d+){3}$/.test(host) || host.startsWith('[')) return null;
  const labels = host.split('.');
  if (!labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return null;
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels[labels.length - 1])) return null;
  return host;
}

/** Every domain the config blocks, de-duplicated. */
export function blockedDomains(cfg: BlockConfig): string[] {
  const out = new Set<string>();
  for (const d of [...cfg.sites, ...cfg.custom]) {
    const n = normalizeDomain(d);
    if (n) out.add(n);
  }
  return [...out];
}

/** Which blocked domain (if any) covers `host`, e.g. 'old.reddit.com' -> 'reddit.com'. */
export function matchDomain(host: string, domains: readonly string[]): string | null {
  const h = host.toLowerCase().replace(/\.$/, '');
  for (const d of domains) if (h === d || h.endsWith('.' + d)) return d;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Bridge to the extension
// ---------------------------------------------------------------------------------------------

const APP_SOURCE = 'hoot-hollow';
const EXT_SOURCE = 'hoot-hollow-ext';
const META_NAME = 'hoot-hollow-app';

type ExtMessage = { source: typeof EXT_SOURCE; type: 'status'; payload: BlockStatus; re?: string };

function isExtMessage(d: unknown): d is ExtMessage {
  if (!d || typeof d !== 'object') return false;
  const m = d as Record<string, unknown>;
  const p = m.payload as Record<string, unknown> | undefined;
  return m.source === EXT_SOURCE && m.type === 'status' && !!p && typeof p === 'object' && p.installed === true;
}

export interface BlockerBridgeOptions {
  /** how long to wait for the extension before deciding it isn't installed (ms) */
  timeoutMs?: number;
  win?: Window;
}

/**
 * Talks to the Hoot Hollow Bedtime extension through its content script.
 *
 *   const bridge = new BlockerBridge();
 *   const status = await bridge.connect();       // null = extension not installed
 *   bridge.onStatus((s) => render(s));
 *   await bridge.sendConfig(cfg);
 *   await bridge.setSleep(true, wakeAt);
 */
export class BlockerBridge {
  #win: Window;
  #timeoutMs: number;
  #status: BlockStatus | null = null;
  #listeners = new Set<(s: BlockStatus) => void>();
  #waiting = new Map<string, (s: BlockStatus) => void>();
  #attached = false;
  #seq = 0;

  constructor(opts: BlockerBridgeOptions = {}) {
    this.#win = opts.win ?? window;
    this.#timeoutMs = opts.timeoutMs ?? 800;
  }

  /** Last status the extension reported, or null if it never answered. */
  get status(): BlockStatus | null {
    return this.#status;
  }

  get installed(): boolean {
    return this.#status !== null;
  }

  /** Mark the page as the app, say hello, and resolve with the status (null if no extension answers in time). */
  connect(): Promise<BlockStatus | null> {
    this.#ensureMeta();
    this.#attach();
    return this.#request('hello');
  }

  /** Save the blocker config in the extension. Resolves with the resulting status. */
  sendConfig(cfg: BlockConfig): Promise<BlockStatus | null> {
    return this.#request('config', cfg);
  }

  /** Start/stop sleep mode (a sleep session or wind-down is running in the app). */
  setSleep(active: boolean, until?: number): Promise<BlockStatus | null> {
    const payload: SleepSignal = until === undefined ? { active } : { active, until };
    return this.#request('sleep', payload);
  }

  /** Called for every status the extension sends (answers and pushes). Returns an unsubscribe function. */
  onStatus(cb: (s: BlockStatus) => void): () => void {
    this.#listeners.add(cb);
    return () => {
      this.#listeners.delete(cb);
    };
  }

  dispose(): void {
    if (this.#attached) this.#win.removeEventListener('message', this.#onMessage);
    this.#attached = false;
    this.#listeners.clear();
    this.#waiting.clear();
  }

  #ensureMeta(): void {
    const doc = this.#win.document;
    let meta = doc.querySelector<HTMLMetaElement>(`meta[name="${META_NAME}"]`);
    if (!meta) {
      meta = doc.createElement('meta');
      meta.name = META_NAME;
      (doc.head ?? doc.documentElement).appendChild(meta);
    }
    meta.content = '1';
  }

  #attach(): void {
    if (this.#attached) return;
    this.#attached = true;
    this.#win.addEventListener('message', this.#onMessage);
  }

  #onMessage = (ev: MessageEvent): void => {
    if (ev.source !== this.#win || ev.origin !== this.#win.location.origin) return;
    if (!isExtMessage(ev.data)) return;
    const { payload, re } = ev.data;
    this.#status = payload;
    if (re) {
      const resolve = this.#waiting.get(re);
      if (resolve) {
        this.#waiting.delete(re);
        resolve(payload);
      }
    }
    for (const cb of [...this.#listeners]) {
      try {
        cb(payload);
      } catch (err) {
        console.error('[blocker] status listener failed', err);
      }
    }
  };

  #request(type: 'hello' | 'config' | 'sleep', payload?: unknown): Promise<BlockStatus | null> {
    this.#attach();
    const id = `hh${Date.now().toString(36)}-${++this.#seq}`;
    return new Promise((resolve) => {
      const timer = this.#win.setTimeout(() => {
        this.#waiting.delete(id);
        resolve(null);
      }, this.#timeoutMs);
      this.#waiting.set(id, (s) => {
        this.#win.clearTimeout(timer);
        resolve(s);
      });
      const msg: Record<string, unknown> = { source: APP_SOURCE, type, id };
      if (payload !== undefined) msg.payload = payload;
      this.#win.postMessage(msg, this.#win.location.origin);
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Install help
// ---------------------------------------------------------------------------------------------

/** Best guess at which install instructions to show. Phones and tablets get 'other'. */
export function detectBrowser(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): InstallBrowser {
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return 'other';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\/|Chromium\//.test(ua)) return 'chrome';
  return 'other';
}

/** Short, accurate steps for installing the unpacked extension from the repo's extension/ folder. */
export function extensionInstallSteps(browser: InstallBrowser): string[] {
  switch (browser) {
    case 'chrome':
      return [
        'Get the Hoot Hollow source and find its extension/ folder.',
        'Open chrome://extensions and turn on Developer mode (top right).',
        'Click "Load unpacked" and choose the extension/ folder.',
        'Pin Pip from the puzzle-piece menu, then come back to this tab (reload it if Hoot Hollow does not notice).',
      ];
    case 'edge':
      return [
        'Get the Hoot Hollow source and find its extension/ folder.',
        'Open edge://extensions and turn on Developer mode (left sidebar).',
        'Click "Load unpacked" and choose the extension/ folder.',
        'Show Pip in the toolbar from the Extensions menu, then come back to this tab (reload it if needed).',
      ];
    case 'firefox':
      return [
        'Get the Hoot Hollow source and find its extension/ folder (Firefox 128 or newer).',
        'Open about:debugging#/runtime/this-firefox and click "Load Temporary Add-on...".',
        'Pick extension/manifest.json.',
        'In about:addons > Hoot Hollow Bedtime > Permissions, allow access to all websites if it is off.',
        'Reload this tab. Temporary add-ons are removed when Firefox restarts.',
      ];
    default:
      return [
        'Brave, Vivaldi, Opera and Arc: open the browser\'s extensions page (e.g. brave://extensions), turn on Developer mode, and "Load unpacked" the extension/ folder.',
        'Safari and phone browsers cannot run this extension. Use Screen Time (iPhone, iPad, Mac) or Digital Wellbeing (Android) to limit apps at bedtime instead.',
      ];
  }
}
