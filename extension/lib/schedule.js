// Schedule + domain helpers shared by the background worker, popup and blocked page.
// Mirrors src/game/blocker.ts in the Hoot Hollow app line-for-line: keep the two in step.

/**
 * @typedef {Object} BlockConfig
 * @property {boolean} enabled
 * @property {string[]} sites   built-in social sites that are switched on (each also blocks subdomains)
 * @property {string[]} custom  extra domains the user added
 * @property {string} start     'HH:MM' local time
 * @property {string} end       'HH:MM' local time; earlier than start = crosses midnight
 * @property {number[]} days    nights the window starts on, 0 = Sunday
 * @property {boolean} strict   no pausing / loosening while blocking
 * @property {boolean} duringSleepOnly  only block while the app reports sleep mode
 */

/**
 * @typedef {Object} BlockStatus
 * @property {true} installed
 * @property {string} version
 * @property {boolean} blocking
 * @property {'window'|'sleep'|'off'|'paused'} reason
 * @property {number} [nextChange]   epoch ms of the next time `blocking` flips
 * @property {number} [pausedUntil]  epoch ms a "just this once" pause ends
 * @property {number} blockedToday   blocked visits today
 * @property {BlockConfig} config    the config in force right now
 * @property {BlockConfig} [pendingConfig]  sent during a strict window; applies when blocking ends
 */

export const DEFAULT_SITES = Object.freeze([
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
]);

/** Friendly names for the built-in sites (popup + blocked page). */
export const SITE_NAMES = Object.freeze({
  'tiktok.com': 'TikTok',
  'instagram.com': 'Instagram',
  'facebook.com': 'Facebook',
  'x.com': 'X',
  'twitter.com': 'Twitter',
  'reddit.com': 'Reddit',
  'youtube.com': 'YouTube',
  'snapchat.com': 'Snapchat',
  'threads.net': 'Threads',
  'pinterest.com': 'Pinterest',
  'twitch.tv': 'Twitch',
  'discord.com': 'Discord',
});

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** @returns {BlockConfig} */
export function defaultBlockConfig() {
  return {
    enabled: true,
    sites: [...DEFAULT_SITES],
    custom: [],
    start: '22:30',
    end: '07:00',
    days: [...ALL_DAYS],
    strict: false,
    duringSleepOnly: false,
  };
}

/** 'HH:MM' -> minutes after midnight, or null when malformed. */
export function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const minutesOf = (d) => d.getHours() * 60 + d.getMinutes();

/** @param {BlockConfig} cfg */
export function hasSchedule(cfg) {
  const s = parseHHMM(cfg.start);
  const e = parseHHMM(cfg.end);
  return s !== null && e !== null && s !== e && cfg.days.length > 0;
}

/** Is the bedtime window open at `now`? (ignores `enabled` and `duringSleepOnly`) */
export function inWindow(cfg, now) {
  const s = parseHHMM(cfg.start);
  const e = parseHHMM(cfg.end);
  if (s === null || e === null || s === e) return false;
  const n = minutesOf(now);
  const day = now.getDay();
  const on = (d) => cfg.days.includes(d);
  if (s < e) return on(day) && n >= s && n < e;
  // crosses midnight: the evening part belongs to today, the early-morning part to yesterday's night
  return (n >= s && on(day)) || (n < e && on((day + 6) % 7));
}

/** Should sites be blocked at `now`? `sleepActive` = the app reports a sleep session / wind-down. */
export function isBlockedNow(cfg, now, sleepActive) {
  if (!cfg.enabled) return false;
  if (sleepActive) return true;
  if (cfg.duringSleepOnly) return false;
  return inWindow(cfg, now);
}

/**
 * The next instant after `now` at which the scheduled blocking (isBlockedNow with sleepActive=false)
 * flips on or off. When it never flips the result is one week after `now` (see hasSchedule()).
 * @returns {Date}
 */
export function nextChange(cfg, now) {
  const fallback = new Date(now.getTime() + 7 * DAY_MS);
  const s = parseHHMM(cfg.start);
  const e = parseHHMM(cfg.end);
  if (!cfg.enabled || cfg.duringSleepOnly || !hasSchedule(cfg) || s === null || e === null) return fallback;
  const cur = inWindow(cfg, now);
  let best = null;
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
function gapEnd(cfg, t, now) {
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
export function nextWake(cfg, now) {
  const e = parseHHMM(cfg.end) ?? 7 * 60;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(e / 60), e % 60, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t;
}

/** 'https://www.Example.com/feed' -> 'example.com'; null when the input isn't a domain. */
export function normalizeDomain(input) {
  let s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//.test(s)) s = 'http://' + s;
  let host;
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
export function blockedDomains(cfg) {
  const out = new Set();
  for (const d of [...cfg.sites, ...cfg.custom]) {
    const n = normalizeDomain(d);
    if (n) out.add(n);
  }
  return [...out];
}

/** Which blocked domain (if any) covers `host`, e.g. 'old.reddit.com' -> 'reddit.com'. */
export function matchDomain(host, domains) {
  const h = host.toLowerCase().replace(/\.$/, '');
  for (const d of domains) if (h === d || h.endsWith('.' + d)) return d;
  return null;
}

// ---- extension-only helpers -------------------------------------------------------------------

/**
 * Coerce anything the app or popup sent into a valid BlockConfig, falling back field by field.
 * @param {unknown} input
 * @param {BlockConfig} [base]
 * @returns {BlockConfig}
 */
export function sanitizeConfig(input, base = defaultBlockConfig()) {
  const src = input && typeof input === 'object' ? /** @type {Record<string, unknown>} */ (input) : {};
  const bool = (v, d) => (typeof v === 'boolean' ? v : d);
  const time = (v, d) => {
    const m = typeof v === 'string' ? parseHHMM(v) : null;
    return m === null ? d : `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  const domains = (v, d) => {
    if (!Array.isArray(v)) return [...d];
    const out = [];
    for (const x of v.slice(0, 200)) {
      const n = typeof x === 'string' ? normalizeDomain(x) : null;
      if (n && !out.includes(n)) out.push(n);
    }
    return out;
  };
  const days = Array.isArray(src.days)
    ? [...new Set(src.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : [...base.days];
  return {
    enabled: bool(src.enabled, base.enabled),
    sites: domains(src.sites, base.sites),
    custom: domains(src.custom, base.custom),
    start: time(src.start, base.start),
    end: time(src.end, base.end),
    days,
    strict: bool(src.strict, base.strict),
    duringSleepOnly: bool(src.duringSleepOnly, base.duringSleepOnly),
  };
}

/** 'HH:MM' -> a short local clock label ('22:30' or '10:30 PM', following the browser locale). */
export function clockLabel(hhmm) {
  const m = parseHHMM(hhmm);
  if (m === null) return hhmm;
  const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Epoch ms -> local clock label. */
export function timeLabel(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** 7_380_000 -> '2h 3m'; under a minute -> '<1m'. */
export function durationLabel(ms) {
  if (!(ms > 0)) return '0m';
  const mins = Math.ceil(ms / 60_000);
  if (mins < 1) return '<1m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}
