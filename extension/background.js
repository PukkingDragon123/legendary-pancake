// Hoot Hollow Bedtime: background service worker (Chrome/Edge) / event page (Firefox).
//
// Single source of truth for blocking. Everything funnels into sync(), which reads state from
// chrome.storage.local, works out whether to block, installs or clears the declarativeNetRequest
// redirect rules, tucks in already-open tabs when blocking starts, schedules alarms for the next
// change, and publishes a BlockStatus snapshot under the `status` key (the bridge content script and
// the extension pages watch that key).

import {
  blockedDomains,
  defaultBlockConfig,
  hasSchedule,
  isBlockedNow,
  matchDomain,
  nextChange,
  nextWake,
  sanitizeConfig,
} from './lib/schedule.js';

/** @typedef {import('./lib/schedule.js').BlockConfig} BlockConfig */
/** @typedef {import('./lib/schedule.js').BlockStatus} BlockStatus */

const api = globalThis.browser ?? globalThis.chrome;
const VERSION = api.runtime.getManifest().version;
const PAUSE_MS = 5 * 60_000;
const TICK = 'hoot-tick';
const EDGE = 'hoot-edge';
/** storage keys whose changes require a re-sync (status/stats/app are written by us) */
const INPUT_KEYS = ['config', 'pendingConfig', 'sleep', 'pausedUntil'];

// ---- state ---------------------------------------------------------------------------------------

/**
 * @typedef {Object} State
 * @property {BlockConfig} config
 * @property {BlockConfig|null} pendingConfig
 * @property {{active: boolean, since?: number, until?: number}} sleep
 * @property {number} pausedUntil
 * @property {{day: string, count: number}} stats
 * @property {{origin?: string, url?: string, lastSeen?: number, lastSync?: number}} app
 * @property {BlockStatus|null} status
 * @property {string} rulesSig
 */

/** @returns {Promise<State>} */
async function load() {
  const s = await api.storage.local.get(null);
  return {
    config: sanitizeConfig(s.config ?? defaultBlockConfig()),
    pendingConfig: s.pendingConfig ? sanitizeConfig(s.pendingConfig) : null,
    sleep: s.sleep && typeof s.sleep === 'object' ? s.sleep : { active: false },
    pausedUntil: typeof s.pausedUntil === 'number' ? s.pausedUntil : 0,
    stats: s.stats ?? { day: dayKey(Date.now()), count: 0 },
    app: s.app ?? {},
    status: s.status ?? null,
    rulesSig: typeof s.rulesSig === 'string' ? s.rulesSig : '',
  };
}

function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const sleepOn = (st, t) => !!(st.sleep.active && (st.sleep.until == null || t < st.sleep.until));

/** Blocking state at instant `t` given the stored inputs. */
function evaluate(st, t) {
  const cfg = st.config;
  if (!cfg.enabled) return { blocking: false, reason: /** @type {const} */ ('off') };
  const asleep = sleepOn(st, t);
  if (!isBlockedNow(cfg, new Date(t), asleep)) return { blocking: false, reason: /** @type {const} */ ('off') };
  if (st.pausedUntil && t < st.pausedUntil) return { blocking: false, reason: /** @type {const} */ ('paused') };
  return { blocking: true, reason: asleep ? /** @type {const} */ ('sleep') : /** @type {const} */ ('window') };
}

/** Next instant after `now` at which `blocking` flips, considering window edges, sleep end and pause end. */
function nextFlip(st, now) {
  const cur = evaluate(st, now).blocking;
  const cands = new Set();
  const cfg = st.config;
  if (cfg.enabled && !cfg.duringSleepOnly && hasSchedule(cfg)) {
    let t = new Date(now);
    for (let i = 0; i < 4; i++) {
      t = nextChange(cfg, t);
      cands.add(t.getTime());
    }
  }
  if (st.sleep.active && st.sleep.until) cands.add(st.sleep.until);
  if (st.pausedUntil > now) cands.add(st.pausedUntil);
  for (const c of [...cands].sort((a, b) => a - b)) {
    if (c > now && evaluate(st, c).blocking !== cur) return c;
  }
  return undefined;
}

/** @returns {BlockStatus} */
function buildStatus(st, now) {
  const ev = evaluate(st, now);
  /** @type {BlockStatus} */
  const status = {
    installed: true,
    version: VERSION,
    blocking: ev.blocking,
    reason: ev.reason,
    blockedToday: st.stats.day === dayKey(now) ? st.stats.count : 0,
    config: st.config,
  };
  const flip = nextFlip(st, now);
  if (flip !== undefined) status.nextChange = flip;
  if (ev.reason === 'paused') status.pausedUntil = st.pausedUntil;
  if (st.pendingConfig) status.pendingConfig = st.pendingConfig;
  return status;
}

/** True while strict mode forbids loosening: blocking (or would be, if a pause predates strict). */
function locked(st, now) {
  return st.config.strict && evaluate(st, now).reason !== 'off';
}

// ---- rules ---------------------------------------------------------------------------------------

function blockedUrl(site, from) {
  const q = new URLSearchParams({ site });
  if (from) {
    q.set('from', from);
    q.set('tucked', '1');
  }
  return api.runtime.getURL('blocked.html') + '?' + q.toString();
}

async function applyRules(domains) {
  const existing = await api.declarativeNetRequest.getDynamicRules();
  const addRules = domains.map((d, i) => ({
    id: i + 1,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html?site=' + encodeURIComponent(d) } },
    condition: { requestDomains: [d], resourceTypes: ['main_frame'] },
  }));
  await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existing.map((r) => r.id), addRules });
}

/** Politely move open tabs on blocked sites to the bedtime page (they keep a link back). */
async function tuckInTabs(domains) {
  if (!domains.length) return;
  let tabs = [];
  try {
    tabs = await api.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  } catch {
    return;
  }
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null || !tab.url) return;
      let host;
      try {
        host = new URL(tab.url).hostname;
      } catch {
        return;
      }
      const site = matchDomain(host, domains);
      if (!site) return;
      try {
        await api.tabs.update(tab.id, { url: blockedUrl(site, tab.url) });
      } catch {
        /* tab closed meanwhile */
      }
    }),
  );
}

async function setBadge(status, now) {
  const a = api.action;
  if (!a) return;
  const left = status.pausedUntil ? Math.max(1, Math.ceil((status.pausedUntil - now) / 60_000)) : 0;
  const text = status.blocking ? 'zz' : status.reason === 'paused' ? `${left}m` : '';
  const color = status.reason === 'paused' ? '#c98a2b' : '#2b3577';
  const title = status.blocking
    ? 'Hoot Hollow: the forest is asleep'
    : status.reason === 'paused'
      ? 'Hoot Hollow: paused for a moment'
      : status.config.enabled
        ? 'Hoot Hollow: awake'
        : 'Hoot Hollow: blocker off';
  try {
    await a.setBadgeText({ text });
    await a.setBadgeBackgroundColor({ color });
    if (a.setBadgeTextColor) await a.setBadgeTextColor({ color: '#fff3d6' });
    await a.setTitle({ title });
  } catch {
    /* not fatal */
  }
}

// ---- sync ----------------------------------------------------------------------------------------

let queue = Promise.resolve();

/** Run `fn` after everything queued before it: alarms, storage changes and messages can overlap. */
function serial(fn) {
  const run = queue.then(fn);
  queue = run.catch((err) => console.error('[hoot]', err));
  return run;
}

const sync = (at) => serial(() => doSync(at));

async function doSync(at) {
  const now = Math.max(Date.now(), at ?? 0);
  const st = await load();
  const patch = {};

  // expire sleep mode and pauses
  if (st.sleep.active && st.sleep.until != null && now >= st.sleep.until) {
    st.sleep = { active: false };
    patch.sleep = st.sleep;
  }
  if (st.pausedUntil && now >= st.pausedUntil) {
    st.pausedUntil = 0;
    patch.pausedUntil = 0;
  }
  // a config that arrived during a strict window takes over once blocking is done
  if (st.pendingConfig && !locked(st, now)) {
    st.config = st.pendingConfig;
    st.pendingConfig = null;
    patch.config = st.config;
    patch.pendingConfig = null;
  }
  if (st.stats.day !== dayKey(now)) {
    st.stats = { day: dayKey(now), count: 0 };
    patch.stats = st.stats;
  }

  const status = buildStatus(st, now);
  const domains = status.blocking ? blockedDomains(st.config) : [];
  const sig = domains.join(',');
  if (sig !== st.rulesSig) {
    await applyRules(domains);
    patch.rulesSig = sig;
    if (domains.length) {
      // newly blocking, or the list grew: tuck in tabs that are already open
      const before = new Set(st.rulesSig ? st.rulesSig.split(',') : []);
      const fresh = domains.filter((d) => !before.has(d));
      await tuckInTabs(fresh);
    }
  }

  if (JSON.stringify(status) !== JSON.stringify(st.status)) patch.status = status;
  if (Object.keys(patch).length) await api.storage.local.set(patch);

  await setBadge(status, now);
  await ensureTick();
  if (status.nextChange) await api.alarms.create(EDGE, { when: status.nextChange });
  else await api.alarms.clear(EDGE);
  return status;
}

/** Make sure the minute tick exists without resetting its phase on every sync. */
async function ensureTick() {
  const a = await api.alarms.get(TICK);
  if (!a) await api.alarms.create(TICK, { periodInMinutes: 1, delayInMinutes: 1 });
}

// ---- messages ------------------------------------------------------------------------------------

const union = (a, b) => [...new Set([...a, ...b])];

/**
 * Save a config. While strict mode is blocking, only additions apply now; the full config waits
 * in `pendingConfig` until blocking ends.
 * @param {'app'|'popup'} from
 */
function saveConfig(input, from) {
  return serial(() => saveConfigNow(input, from));
}

async function saveConfigNow(input, from) {
  const now = Date.now();
  const st = await load();
  const next = sanitizeConfig(input, st.config);
  if (locked(st, now)) {
    const grown = { ...st.config, sites: union(st.config.sites, next.sites), custom: union(st.config.custom, next.custom) };
    let pending;
    if (from === 'app') pending = next;
    else {
      const p = st.pendingConfig ?? st.config;
      pending = { ...p, sites: union(p.sites, next.sites), custom: union(p.custom, next.custom) };
    }
    const same = JSON.stringify(pending) === JSON.stringify(grown);
    await api.storage.local.set({ config: grown, pendingConfig: same ? null : pending });
  } else {
    await api.storage.local.set({ config: next, pendingConfig: null });
  }
  return doSync();
}

function setSleep(payload) {
  return serial(() => setSleepNow(payload));
}

async function setSleepNow(payload) {
  const now = Date.now();
  const st = await load();
  const p = payload && typeof payload === 'object' ? payload : {};
  if (p.active === true) {
    const cap = nextWake(st.config, new Date(now)).getTime();
    const want = typeof p.until === 'number' && Number.isFinite(p.until) ? p.until : Infinity;
    const until = Math.min(want, cap);
    const sleep = until > now ? { active: true, since: now, until } : { active: false };
    // starting a sleep session is a fresh intention: drop any pause
    await api.storage.local.set({ sleep, pausedUntil: 0 });
  } else {
    await api.storage.local.set({ sleep: { active: false } });
  }
  return doSync();
}

function touchApp(sender, synced) {
  const url = sender.url ? new URL(sender.url) : null;
  if (!url || !/^https?:$/.test(url.protocol)) return Promise.resolve();
  return serial(async () => {
    const { app: prev } = await api.storage.local.get('app');
    const app = {
      ...(prev ?? {}),
      origin: url.origin,
      url: url.origin + url.pathname,
      lastSeen: Date.now(),
    };
    if (synced) app.lastSync = app.lastSeen;
    await api.storage.local.set({ app });
  });
}

async function handleApp(msg, sender) {
  if (!sender.tab || !sender.url || !/^https?:/.test(sender.url)) throw new Error('not a page');
  switch (msg.type) {
    case 'hello':
      await touchApp(sender, false);
      return { status: await sync() };
    case 'config':
      await touchApp(sender, true);
      return { status: await saveConfig(msg.payload, 'app') };
    case 'sleep':
      await touchApp(sender, true);
      return { status: await setSleep(msg.payload) };
    default:
      throw new Error('unknown message');
  }
}

async function openApp(hash, sender) {
  const { app } = await load();
  if (!app.url) return { ok: false };
  const target = app.url + (hash || '');
  const tabs = await api.tabs.query({}).catch(() => []);
  const existing = tabs.find((t) => t.url && t.url.startsWith(app.url));
  if (existing && existing.id != null) {
    await api.tabs.update(existing.id, { active: true, url: target });
    if (existing.windowId != null) await api.windows?.update(existing.windowId, { focused: true }).catch(() => {});
    return { ok: true };
  }
  if (sender.tab && sender.tab.id != null) await api.tabs.update(sender.tab.id, { url: target });
  else await api.tabs.create({ url: target });
  return { ok: true };
}

async function handleUi(msg, sender) {
  switch (msg.op) {
    case 'getState': {
      const status = await sync();
      const st = await load();
      return { status, app: st.app, locked: locked(st, Date.now()), sleep: st.sleep };
    }
    case 'setConfig':
      await saveConfig(msg.config, 'popup');
      return handleUi({ op: 'getState' }, sender);
    case 'pause': {
      const err = await serial(async () => {
        const now = Date.now();
        const st = await load();
        if (st.config.strict) return 'strict';
        if (!evaluate(st, now).blocking) return 'not-blocking';
        await api.storage.local.set({ pausedUntil: now + PAUSE_MS });
        await doSync();
        return null;
      });
      return err ? { error: err } : handleUi({ op: 'getState' }, sender);
    }
    case 'resume':
      await serial(async () => {
        await api.storage.local.set({ pausedUntil: 0 });
        await doSync();
      });
      return handleUi({ op: 'getState' }, sender);
    case 'hit': {
      const status = await serial(async () => {
        const st = await load();
        const day = dayKey(Date.now());
        const count = st.stats.day === day ? st.stats.count + 1 : 1;
        await api.storage.local.set({ stats: { day, count } });
        return doSync();
      });
      return { status };
    }
    case 'openApp':
      return openApp(typeof msg.hash === 'string' ? msg.hash : '', sender);
    default:
      throw new Error('unknown op');
  }
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;
  const fromExtensionPage = !sender.tab || (sender.url ?? '').startsWith(api.runtime.getURL(''));
  let work;
  if (msg.kind === 'app') work = handleApp(msg, sender);
  else if (msg.kind === 'ui' && fromExtensionPage) work = handleUi(msg, sender);
  else return false;
  work.then(sendResponse, (err) => sendResponse({ error: String(err?.message ?? err) }));
  return true;
});

// ---- triggers ------------------------------------------------------------------------------------

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK) sync();
  else if (alarm.name === EDGE) sync(alarm.scheduledTime);
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (INPUT_KEYS.some((k) => k in changes)) sync();
});

/** Pair with an app tab that was already open when the extension was installed or updated. */
async function injectIntoOpenAppTabs() {
  if (!api.scripting) return;
  const tabs = await api.tabs.query({ url: ['http://*/*', 'https://*/*'] }).catch(() => []);
  for (const tab of tabs) {
    if (tab.id == null || tab.discarded) continue;
    try {
      const [res] = await api.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => !!document.querySelector('meta[name="hoot-hollow-app"][content="1"]'),
      });
      if (res?.result) await api.scripting.executeScript({ target: { tabId: tab.id }, files: ['bridge.js'] });
    } catch {
      /* restricted page or no host access */
    }
  }
}

api.runtime.onInstalled.addListener(async () => {
  await serial(async () => {
    const { config } = await api.storage.local.get('config');
    if (!config) await api.storage.local.set({ config: defaultBlockConfig() });
    // forget the remembered rule set so the next sync reinstalls rules (and tucks in open tabs)
    await api.storage.local.set({ rulesSig: '__reinstall__' });
    await doSync();
  });
  await injectIntoOpenAppTabs();
});

api.runtime.onStartup.addListener(() => {
  sync();
});

// every time the worker wakes up
ensureTick().then(() => sync());
