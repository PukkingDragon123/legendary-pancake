// Toolbar popup: status, the bedtime window, sites, pairing info and the gentle pause.
// All changes go through the background worker, which enforces strict mode.

import { frameCanvas, owlFrame } from './lib/owl.js';
import {
  DEFAULT_SITES,
  SITE_NAMES,
  clockLabel,
  durationLabel,
  normalizeDomain,
  timeLabel,
} from './lib/schedule.js';

const api = globalThis.browser ?? globalThis.chrome;
const PHRASE = 'i choose sleep';
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const $ = (id) => /** @type {any} */ (document.getElementById(id));
const el = {
  owl: /** @type {HTMLCanvasElement} */ ($('owl')),
  enabled: $('enabled'),
  status: $('status'),
  statusTitle: $('status-title'),
  statusSub: $('status-sub'),
  pauseBtn: $('pause-btn'),
  resumeBtn: $('resume-btn'),
  pauseForm: $('pause-form'),
  pauseInput: $('pause-input'),
  pauseGo: $('pause-go'),
  pauseCancel: $('pause-cancel'),
  lock: $('lock'),
  start: $('start'),
  end: $('end'),
  days: $('days'),
  strict: $('strict'),
  sleepOnly: $('sleep-only'),
  sites: $('sites'),
  siteCount: $('site-count'),
  addForm: $('add-form'),
  addInput: $('add-input'),
  addError: $('add-error'),
  appLine: $('app-line'),
  openApp: $('open-app'),
};

/** @type {{ status: any, app: any, locked: boolean, sleep: any } | null} */
let state = null;
let formKey = '';

// ---- messaging ----------------------------------------------------------------------------------

async function send(msg) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await api.runtime.sendMessage(msg);
      if (res && !res.error) return res;
      if (res?.error) return res;
    } catch {
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  return null;
}

async function refresh() {
  const res = await send({ kind: 'ui', op: 'getState' });
  if (res?.status) {
    state = res;
    render();
  }
}

async function saveConfig(mutate) {
  if (!state) return;
  const next = structuredClone(state.status.config);
  mutate(next);
  const res = await send({ kind: 'ui', op: 'setConfig', config: next });
  if (res?.status) {
    state = res;
    render();
  }
}

// ---- owl ----------------------------------------------------------------------------------------

const CROP = { x: 33, y: 18, w: 32, h: 36 }; // Pip without the branch, feet included
const owlFrames = {
  closed: [0, 1].map((b) => frameCanvas(owlFrame({ breath: b, eyes: 'closed', branch: false }))),
  open: [0, 1].map((b) => frameCanvas(owlFrame({ breath: b, eyes: 'open', branch: false }))),
};
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
let breath = 0;

function drawOwl() {
  const ctx = el.owl.getContext('2d');
  ctx.clearRect(0, 0, CROP.w, CROP.h);
  const asleep = state?.status?.blocking;
  const set = asleep ? owlFrames.closed : owlFrames.open;
  ctx.drawImage(set[reduce.matches ? 0 : breath], CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, CROP.w, CROP.h);
}

setInterval(() => {
  if (reduce.matches) return;
  breath ^= 1;
  drawOwl();
}, 2200);

// ---- render -------------------------------------------------------------------------------------

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function render() {
  if (!state) return;
  const { status, app, locked } = state;
  const cfg = status.config;
  const now = Date.now();
  drawOwl();

  // header switch
  el.enabled.checked = cfg.enabled;
  el.enabled.disabled = locked;

  // status card
  let mode = 'awake';
  let title = '';
  let sub = '';
  if (!cfg.enabled) {
    mode = 'off';
    title = 'Blocker is off';
    sub = 'Switch it on to keep bedtime quiet.';
  } else if (status.blocking) {
    mode = 'blocking';
    title = status.reason === 'sleep' ? 'Blocking: sleep mode' : 'Blocking now';
    sub = status.nextChange
      ? `Until ${timeLabel(status.nextChange)} · ${durationLabel(status.nextChange - now)}`
      : 'Until Hoot Hollow says good morning';
  } else if (status.reason === 'paused') {
    mode = 'paused';
    title = 'Paused for a moment';
    sub = status.pausedUntil ? `Back to bed in ${mmss(status.pausedUntil - now)}` : '';
  } else if (status.nextChange) {
    title = `Next block at ${timeLabel(status.nextChange)}`;
    sub = `In ${durationLabel(status.nextChange - now)}. ${status.blockedToday ? `${status.blockedToday} turned away today.` : 'Sweet dreams later.'}`;
  } else {
    title = cfg.duringSleepOnly ? 'Waiting for sleep mode' : 'No bedtime scheduled';
    sub = cfg.duringSleepOnly ? 'Blocks while Hoot Hollow says you’re winding down or asleep.' : 'Pick at least one night below.';
  }
  el.status.dataset.mode = mode;
  setText(el.statusTitle, title);
  setText(el.statusSub, sub);

  const canPause = status.blocking && !cfg.strict;
  el.pauseBtn.hidden = !canPause || !el.pauseForm.hidden;
  el.resumeBtn.hidden = mode !== 'paused';
  if (!canPause && !el.pauseForm.hidden) closePause();

  // strict lock note
  if (locked) {
    const at = status.nextChange ? timeLabel(status.nextChange) : 'morning';
    let msg = `Strict mode: no loosening until ${at}. Adding sites still works.`;
    if (status.pendingConfig) msg += ' App changes wait until then too.';
    setText(el.lock, msg);
    el.lock.hidden = false;
  } else {
    el.lock.hidden = true;
  }

  // window + sites: only rebuilt when the config or lock actually changed
  const key = JSON.stringify([cfg, locked]);
  if (key !== formKey) {
    formKey = key;
    if (document.activeElement !== el.start) el.start.value = cfg.start;
    if (document.activeElement !== el.end) el.end.value = cfg.end;
    el.start.disabled = el.end.disabled = locked;
    renderDays(cfg, locked);
    el.strict.checked = cfg.strict;
    el.strict.disabled = locked;
    el.sleepOnly.checked = cfg.duringSleepOnly;
    el.sleepOnly.disabled = locked;
    renderSites(cfg, locked);
  }

  // app pairing
  el.appLine.replaceChildren();
  const dot = document.createElement('span');
  dot.className = 'dot';
  if (app?.origin) {
    const fresh = app.lastSeen && now - app.lastSeen < 10 * 60_000;
    if (fresh) dot.classList.add('live');
    const host = document.createElement('b');
    host.textContent = app.origin.replace(/^https?:\/\//, '');
    const when = app.lastSync ? `synced ${ago(app.lastSync)}` : `seen ${ago(app.lastSeen)}`;
    el.appLine.append(dot, 'Paired with ', host, ` · ${when}`);
    if (state.sleep?.active) el.appLine.append(document.createElement('br'), 'Sleep mode is on.');
    el.openApp.hidden = false;
  } else {
    el.appLine.append(dot, 'Not paired yet. Open Hoot Hollow in this browser and it will find the owl.');
    el.openApp.hidden = true;
  }
}

function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function renderDays(cfg, locked) {
  if (!el.days.children.length) {
    DAY_LETTERS.forEach((letter, d) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      b.textContent = letter;
      b.dataset.day = String(d);
      b.title = `${DAY_NAMES[d]} night`;
      b.setAttribute('aria-label', `${DAY_NAMES[d]} night`);
      b.addEventListener('click', () => {
        saveConfig((c) => {
          c.days = c.days.includes(d) ? c.days.filter((x) => x !== d) : [...c.days, d].sort((a, b2) => a - b2);
        });
      });
      el.days.append(b);
    });
  }
  for (const b of el.days.children) {
    const d = Number(b.dataset.day);
    const on = cfg.days.includes(d);
    b.setAttribute('aria-pressed', String(on));
    b.disabled = locked;
  }
}

function siteChip({ domain, label, checked, disabled, custom }) {
  const wrap = document.createElement('label');
  wrap.className = 'site' + (custom ? ' custom' : '');
  wrap.title = domain + (custom ? '' : ' and its subdomains');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.disabled = disabled;
  input.setAttribute('aria-label', `Block ${domain}`);
  input.addEventListener('change', () => {
    saveConfig((c) => {
      if (custom) {
        if (!input.checked) c.custom = c.custom.filter((x) => x !== domain);
      } else if (input.checked) {
        if (!c.sites.includes(domain)) c.sites.push(domain);
      } else {
        c.sites = c.sites.filter((x) => x !== domain);
      }
    });
  });
  const pip = document.createElement('span');
  pip.className = 'pip';
  pip.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = label;
  wrap.append(input, pip, name);
  if (custom && !disabled) {
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'remove';
    x.textContent = '×';
    x.title = `Stop blocking ${domain}`;
    x.setAttribute('aria-label', `Remove ${domain}`);
    x.addEventListener('click', (e) => {
      e.preventDefault();
      saveConfig((c) => {
        c.custom = c.custom.filter((d) => d !== domain);
      });
    });
    wrap.append(x);
  }
  return wrap;
}

function renderSites(cfg, locked) {
  const focusedLabel = document.activeElement?.closest?.('.site')?.title;
  const chips = [];
  const known = new Set(DEFAULT_SITES);
  for (const d of DEFAULT_SITES) {
    const on = cfg.sites.includes(d);
    chips.push(siteChip({ domain: d, label: SITE_NAMES[d] ?? d, checked: on, disabled: locked && on, custom: false }));
  }
  for (const d of cfg.sites) {
    if (known.has(d)) continue; // sites the app sent beyond the built-ins
    chips.push(siteChip({ domain: d, label: d, checked: true, disabled: locked, custom: false }));
  }
  for (const d of cfg.custom) chips.push(siteChip({ domain: d, label: d, checked: true, disabled: locked, custom: true }));
  el.sites.replaceChildren(...chips);
  if (focusedLabel) {
    const again = [...el.sites.children].find((c) => c.title === focusedLabel);
    again?.querySelector('input')?.focus();
  }
  const total = new Set([...cfg.sites, ...cfg.custom]).size;
  setText(el.siteCount, `${total} tucked in`);
}

// ---- events -------------------------------------------------------------------------------------

el.enabled.addEventListener('change', () => saveConfig((c) => (c.enabled = el.enabled.checked)));
el.strict.addEventListener('change', () => saveConfig((c) => (c.strict = el.strict.checked)));
el.sleepOnly.addEventListener('change', () => saveConfig((c) => (c.duringSleepOnly = el.sleepOnly.checked)));
for (const key of ['start', 'end']) {
  el[key].addEventListener('change', () => {
    const v = el[key].value;
    if (/^\d{2}:\d{2}$/.test(v)) saveConfig((c) => (c[key] = v));
  });
}

el.addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!state) return;
  const raw = el.addInput.value;
  const d = normalizeDomain(raw);
  const cfg = state.status.config;
  let err = '';
  if (!raw.trim()) err = 'Type a site first, like news.example.com.';
  else if (!d) err = 'That doesn’t look like a website address.';
  else if (cfg.custom.includes(d) || cfg.sites.includes(d)) err = `${d} is already tucked in.`;
  el.addError.hidden = !err;
  setText(el.addError, err);
  if (err) return;
  el.addInput.value = '';
  saveConfig((c) => {
    if (DEFAULT_SITES.includes(d)) c.sites.push(d);
    else c.custom.push(d);
  });
});
el.addInput.addEventListener('input', () => {
  el.addError.hidden = true;
});

// the gentle friction step
const phraseOk = () => el.pauseInput.value.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim() === PHRASE;

function closePause() {
  el.pauseForm.hidden = true;
  el.pauseInput.value = '';
  el.pauseGo.disabled = true;
}

el.pauseBtn.addEventListener('click', () => {
  el.pauseForm.hidden = false;
  el.pauseBtn.hidden = true;
  el.pauseInput.focus();
});
el.pauseCancel.addEventListener('click', () => {
  closePause();
  render();
});
el.pauseInput.addEventListener('input', () => {
  el.pauseGo.disabled = !phraseOk();
});
el.pauseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!phraseOk()) return;
  const res = await send({ kind: 'ui', op: 'pause' });
  closePause();
  if (res?.status) state = res;
  render();
});
el.resumeBtn.addEventListener('click', async () => {
  const res = await send({ kind: 'ui', op: 'resume' });
  if (res?.status) state = res;
  render();
});
el.openApp.addEventListener('click', async () => {
  await send({ kind: 'ui', op: 'openApp', hash: '' });
  window.close();
});

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !state) return;
  if (changes.status?.newValue) state.status = changes.status.newValue;
  if (changes.app?.newValue) state.app = changes.app.newValue;
  if (changes.sleep?.newValue) state.sleep = changes.sleep.newValue;
  if (changes.status || changes.app || changes.sleep) {
    // strict lock depends on fresh state; ask the worker rather than re-deriving it here
    refresh();
  }
});

setInterval(render, 1000);
refresh();
