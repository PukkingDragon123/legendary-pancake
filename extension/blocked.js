// The bedtime page every blocked site lands on. Draws a pixel night sky (drifting stars, a crescent
// moon, hills, fireflies) and Pip asleep on a branch, and keeps the words in step with the status
// the background worker publishes in chrome.storage.local.

import { PIP_H, PIP_W, ZGLYPHS, frameCanvas, pipFrame } from './lib/owl.js';
import { durationLabel, timeLabel, clockLabel } from './lib/schedule.js';

const api = globalThis.browser ?? globalThis.chrome;

// ---- query --------------------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const site = cleanSite(params.get('site'));
const from = safeHttpUrl(params.get('from'));
const tucked = params.get('tucked') === '1';

function cleanSite(s) {
  const v = String(s ?? '').toLowerCase().trim();
  return /^[a-z0-9.-]{1,253}$/.test(v) ? v : '';
}

function safeHttpUrl(s) {
  try {
    const u = new URL(String(s ?? ''));
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
}

// ---- motion preferences -------------------------------------------------------------------------

const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
let reduce = reduceMQ.matches;

// ---- seeded randomness so the sky doesn't reshuffle on every resize ------------------------------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

const hexToRgb = (h) => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

const SKY = ['#04061a', '#070b24', '#0b1030', '#10173d', '#161e4b', '#1d2558', '#262d64'].map(hexToRgb);
const GLOW = hexToRgb('#3c4590');
const MOON = { light: '#fbf3d5', mid: '#ecdcaa', shade: '#cdb680' };
const STAR = ['#4b5596', '#8c98dc', '#dfe5ff', '#ffffff'];
const HILL_FAR = '#10173f';
const HILL_FAR_RIM = '#1f2864';
const HILL_NEAR = '#080c27';

// ---- sky canvas ---------------------------------------------------------------------------------

const sky = /** @type {HTMLCanvasElement} */ (document.getElementById('sky'));
const sctx = sky.getContext('2d');
const pipCanvas = /** @type {HTMLCanvasElement} */ (document.getElementById('pip'));
const octx = pipCanvas.getContext('2d');

let S = 4; // CSS px per art pixel
let cw = 0;
let ch = 0;
let horizon = 0;
let moon = { x: 0, y: 0, r: 0 };
/** @type {HTMLCanvasElement} */ let skyLayer;
/** @type {HTMLCanvasElement} */ let groundLayer;
/** @type {{x:number,y:number,v:number,kind:number,p:number,w:number}[]} */ let stars = [];
/** @type {{bx:number,by:number,ax:number,ay:number,fx:number,fy:number,p1:number,p2:number,pw:number,w:number}[]} */
let flies = [];
let shooting = null;
let nextShoot = 6;

function layout() {
  const w = innerWidth;
  const h = innerHeight;
  S = w >= 1100 && h >= 720 ? 4 : w >= 640 ? 3 : 2;
  document.documentElement.style.setProperty('--px', S + 'px');
  cw = Math.ceil(w / S);
  ch = Math.ceil(h / S);
  sky.width = cw;
  sky.height = ch;
  sky.style.width = cw * S + 'px';
  sky.style.height = ch * S + 'px';
  pipCanvas.style.width = PIP_W * S + 'px';
  horizon = Math.round(ch * 0.8);
  const r = Math.max(5, Math.min(11, Math.round(Math.min(cw, ch) * 0.05)));
  moon = { x: Math.round(cw * 0.83), y: Math.round(ch * 0.15) + r, r };
  skyLayer = buildSky();
  groundLayer = buildGround();
  seedStars();
  seedFlies();
}

function buildSky() {
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(cw, ch);
  const d = img.data;
  const n = SKY.length - 1;
  const halo = moon.r * 4.2;
  for (let y = 0; y < ch; y++) {
    const t = Math.min(1, y / horizon) ** 1.15;
    const f = t * n;
    const i = Math.min(n - 1, Math.floor(f));
    const frac = f - i;
    for (let x = 0; x < cw; x++) {
      const th = BAYER4[y & 3][x & 3];
      let col = frac > th ? SKY[i + 1] : SKY[i];
      // dithered moon glow, two soft steps
      const dist = Math.hypot(x - moon.x, y - moon.y);
      if (dist < halo) {
        const g = (1 - dist / halo) ** 2;
        const level = g * 2 > th + (g * 2 > 1 ? 1 : 0) ? (g > 0.5 ? 0.42 : 0.22) : g > 0.5 ? 0.22 : 0;
        if (level) col = col.map((v, k) => Math.round(v + (GLOW[k] - v) * level));
      }
      const o = (y * cw + x) * 4;
      d[o] = col[0];
      d[o + 1] = col[1];
      d[o + 2] = col[2];
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  drawMoon(ctx);
  return c;
}

function drawMoon(ctx) {
  const { x: mx, y: my, r } = moon;
  const ox = r * 0.5;
  const oy = -r * 0.32;
  for (let y = -r - 1; y <= r + 1; y++) {
    for (let x = -r - 1; x <= r + 1; x++) {
      const d = Math.hypot(x + 0.5, y + 0.5);
      if (d > r) continue;
      const cut = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
      if (cut < r * 0.86) continue;
      const edge = cut < r * 0.86 + 1.6;
      ctx.fillStyle = edge ? MOON.shade : d > r - 1.2 ? MOON.mid : MOON.light;
      ctx.fillRect(mx + x, my + y, 1, 1);
    }
  }
}

function buildGround() {
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d');
  const R = rng(7);
  // far hills: layered sines, with a thin moonlit rim
  const ph = [R() * 6, R() * 6, R() * 6];
  const far = (x) =>
    Math.round(horizon - 6 - 7 * Math.sin(x / 41 + ph[0]) - 4 * Math.sin(x / 17 + ph[1]) - 2 * Math.sin(x / 7 + ph[2]));
  for (let x = 0; x < cw; x++) {
    const top = far(x);
    ctx.fillStyle = HILL_FAR;
    ctx.fillRect(x, top, 1, ch - top);
    ctx.fillStyle = HILL_FAR_RIM;
    if (x > cw * 0.35 || x % 3) ctx.fillRect(x, top, 1, 1);
  }
  // near ground and a row of pixel pines
  const near = (x) => Math.round(horizon + 10 + 3 * Math.sin(x / 23 + ph[2]) + 2 * Math.sin(x / 9));
  ctx.fillStyle = HILL_NEAR;
  for (let x = 0; x < cw; x++) ctx.fillRect(x, near(x), 1, ch);
  let x = Math.floor(R() * 6);
  while (x < cw + 8) {
    const h = 10 + Math.floor(R() * 16);
    pine(ctx, x, near(x) + 1, h);
    x += 5 + Math.floor(R() * 13) + (R() < 0.18 ? 18 : 0);
  }
  return c;
}

function pine(ctx, x0, base, h) {
  ctx.fillStyle = HILL_NEAR;
  ctx.fillRect(x0, base - 2, 1, 3); // trunk
  for (let dy = 0; dy < h; dy++) {
    const y = base - 2 - dy;
    const tier = dy % 5;
    const w = Math.max(0, Math.floor((h - dy) * 0.36) - (tier === 4 ? 1 : 0));
    ctx.fillRect(x0 - w, y, w * 2 + 1, 1);
  }
}

function seedStars() {
  const R = rng(1234);
  const count = Math.round((cw * horizon) / 95);
  stars = [];
  for (let i = 0; i < count; i++) {
    const roll = R();
    stars.push({
      x: R() * cw,
      y: Math.floor((R() ** 1.35) * (horizon - 8)),
      v: 0.25 + R() * 0.75, // art px per second... slowed below
      kind: roll < 0.06 ? 2 : roll < 0.3 ? 1 : 0, // 2 = sparkle cross, 1 = bright, 0 = dim
      p: R() * Math.PI * 2,
      w: 0.6 + R() * 1.8,
    });
  }
}

function seedFlies() {
  const R = rng(99);
  const n = Math.max(8, Math.min(18, Math.round(cw / 24)));
  flies = [];
  for (let i = 0; i < n; i++) {
    const high = i % 3 === 2; // a few wander up into the middle of the sky, away from the words
    const side = R() < 0.5 ? R() * 0.28 : 0.72 + R() * 0.28;
    flies.push({
      bx: high ? side * cw : R() * cw,
      by: high ? ch * (0.42 + R() * 0.3) : horizon - 16 + R() * (ch - horizon + 10),
      ax: 6 + R() * 16,
      ay: 3 + R() * 7,
      fx: 0.05 + R() * 0.12,
      fy: 0.07 + R() * 0.15,
      p1: R() * 6.28,
      p2: R() * 6.28,
      pw: R() * 6.28,
      w: 0.5 + R() * 0.9,
    });
  }
}

const DRIFT = 0.18; // overall star drift speed multiplier (art px / s)

function drawStars(t) {
  for (const s of stars) {
    const x = Math.round((((s.x - t * s.v * DRIFT) % cw) + cw) % cw);
    const y = s.y;
    if (Math.abs(x - moon.x) <= moon.r + 2 && Math.abs(y - moon.y) <= moon.r + 2) continue;
    const tw = reduce ? 0.7 : 0.5 + 0.5 * Math.sin(t * s.w + s.p);
    if (s.kind === 0) {
      sctx.fillStyle = STAR[tw > 0.82 ? 1 : 0];
      sctx.fillRect(x, y, 1, 1);
    } else if (s.kind === 1) {
      sctx.fillStyle = STAR[tw > 0.35 ? 2 : 1];
      sctx.fillRect(x, y, 1, 1);
    } else {
      sctx.fillStyle = STAR[tw > 0.5 ? 3 : 2];
      sctx.fillRect(x, y, 1, 1);
      if (tw > 0.3) {
        sctx.fillStyle = STAR[tw > 0.75 ? 1 : 0];
        sctx.fillRect(x - 1, y, 1, 1);
        sctx.fillRect(x + 1, y, 1, 1);
        sctx.fillRect(x, y - 1, 1, 1);
        sctx.fillRect(x, y + 1, 1, 1);
      }
      if (tw > 0.85) {
        sctx.fillStyle = STAR[0];
        sctx.fillRect(x - 2, y, 1, 1);
        sctx.fillRect(x + 2, y, 1, 1);
        sctx.fillRect(x, y - 2, 1, 1);
        sctx.fillRect(x, y + 2, 1, 1);
      }
    }
  }
}

function drawShootingStar(t) {
  if (reduce) return;
  if (!shooting && t > nextShoot) {
    const R = Math.random;
    shooting = { x: cw * (0.25 + R() * 0.6), y: horizon * (0.05 + R() * 0.3), t0: t, len: 7 + Math.floor(R() * 5) };
    nextShoot = t + 14 + R() * 18;
  }
  if (!shooting) return;
  const age = t - shooting.t0;
  if (age > 0.9) {
    shooting = null;
    return;
  }
  const speed = 70;
  const hx = Math.round(shooting.x - age * speed);
  const hy = Math.round(shooting.y + age * speed * 0.42);
  for (let i = 0; i < shooting.len; i++) {
    const x = hx + i;
    const y = Math.round(hy - i * 0.42);
    sctx.fillStyle = STAR[i === 0 ? 3 : i < 3 ? 2 : i < 6 ? 1 : 0];
    sctx.globalAlpha = age > 0.6 ? 1 - (age - 0.6) / 0.3 : 1;
    sctx.fillRect(x, y, 1, 1);
  }
  sctx.globalAlpha = 1;
}

function drawFlies(t) {
  for (const f of flies) {
    const x = Math.round(f.bx + f.ax * Math.sin(t * f.fx * 2 + f.p1) + f.ax * 0.4 * Math.sin(t * f.fx * 5.3 + f.p2));
    const y = Math.round(f.by + f.ay * Math.sin(t * f.fy * 2 + f.p2) + 2 * Math.sin(t * 1.3 + f.p1));
    const b = reduce ? 0.8 : Math.max(0, Math.sin(t * f.w + f.pw)) ** 1.6;
    if (b < 0.04) continue;
    // halo: a soft dithered disc, then a brighter plus
    sctx.fillStyle = '#b7e07a';
    sctx.globalAlpha = 0.07 * b;
    sctx.fillRect(x - 3, y - 1, 7, 3);
    sctx.fillRect(x - 1, y - 3, 3, 7);
    sctx.fillRect(x - 2, y - 2, 5, 5);
    sctx.globalAlpha = 0.16 * b;
    sctx.fillRect(x - 1, y - 1, 3, 3);
    sctx.globalAlpha = 0.45 * b;
    sctx.fillRect(x - 1, y, 3, 1);
    sctx.fillRect(x, y - 1, 1, 3);
    sctx.globalAlpha = 1;
    sctx.fillStyle = b > 0.45 ? '#fffbd2' : b > 0.2 ? '#e6f28a' : '#7f9b52';
    sctx.fillRect(x, y, 1, 1);
  }
}

// ---- Pip ----------------------------------------------------------------------------------------

/** Pre-rendered frames for one of Pip's looks ('owl' by default, or the Meowl skin). */
function buildFrames(look) {
  const f = (breath, eyes) => frameCanvas(pipFrame({ breath, eyes, mascot: look }));
  return {
    closed: [f(0, 'closed'), f(1, 'closed')],
    open: [f(0, 'open'), f(1, 'open')],
    blink: [f(0, 'blink'), f(1, 'blink')],
  };
}
let look = 'owl';
let frames = buildFrames(look);
let awake = false;
/** guided breathing (fallback when the app isn't paired): null or start time */
let guide = null;
const GUIDE_IN = 4;
const GUIDE_OUT = 6;

function breathAt(t) {
  if (guide !== null) {
    const p = (t - guide) % (GUIDE_IN + GUIDE_OUT);
    return p < GUIDE_IN ? 1 : 0;
  }
  return t % 4.4 < 1.9 ? 1 : 0;
}

/** Zzz: a new glyph every ~2.8 s rises beside the right ear and drifts away. */
function drawZ(t) {
  const period = 2.8;
  for (let k = 0; k < 3; k++) {
    const born = Math.floor(t / period) * period - k * period;
    const age = t - born;
    if (age < 0 || age > period * 3) continue;
    const life = age / (period * 3);
    const big = life > 0.33 ? 0 : 1;
    const g = ZGLYPHS[big];
    const x = Math.round(64 + life * 13 + Math.sin(age * 1.6) * 1.5);
    const y = Math.round(15 - life * 14);
    octx.fillStyle = life < 0.55 ? '#cfd7ff' : life < 0.8 ? '#8d97d6' : '#4d5799';
    g.forEach((row, gy) => [...row].forEach((c, gx) => c === '#' && octx.fillRect(x + gx, y + gy, 1, 1)));
  }
}

function drawPip(t) {
  octx.clearRect(0, 0, PIP_W, PIP_H);
  const b = reduce ? 0 : breathAt(t);
  let set = frames.closed;
  if (awake) set = !reduce && t % 5 < 0.18 ? frames.blink : frames.open;
  octx.drawImage(set[b], 0, 0);
  if (!awake && !reduce && guide === null) drawZ(t);
}

// ---- loop ---------------------------------------------------------------------------------------

let raf = 0;
let last = -1;
const t0 = performance.now();

function paint(t) {
  sctx.drawImage(skyLayer, 0, 0);
  drawStars(t);
  drawShootingStar(t);
  sctx.drawImage(groundLayer, 0, 0);
  drawFlies(t);
  drawPip(t);
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  if (now - last < 1000 / 24) return;
  last = now;
  const t = (now - t0) / 1000;
  paint(t);
  if (guide !== null) updateCue(t);
}

function start() {
  cancelAnimationFrame(raf);
  if (reduce) paint(8);
  else raf = requestAnimationFrame(loop);
}

reduceMQ.addEventListener('change', (e) => {
  reduce = e.matches;
  start();
});

let resizeTimer = 0;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    layout();
    start();
  }, 80);
});

// ---- words --------------------------------------------------------------------------------------

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const el = {
  title: $('title'),
  site: $('site'),
  rest: $('lede-rest'),
  chip: $('chip'),
  chipText: $('chip-text'),
  note: $('note'),
  cue: $('cue'),
  cont: /** @type {HTMLAnchorElement} */ ($('continue')),
  breathe: /** @type {HTMLButtonElement} */ ($('breathe')),
  open: /** @type {HTMLButtonElement} */ ($('open')),
};

/** @type {{ status: any, app: any }} */
const state = { status: null, app: {} };

function setText(node, text) {
  if (node.textContent !== text) node.textContent = text;
}

function render() {
  const s = state.status;
  const now = Date.now();
  const label = site || 'This site';
  setText(el.site, label);
  el.site.hidden = false;

  const blocking = !s || s.blocking; // before the first status arrives, assume we're blocking
  const paused = s?.reason === 'paused';
  const mode = blocking ? 'blocking' : paused ? 'paused' : 'awake';
  document.body.dataset.state = mode;
  awake = mode !== 'blocking';
  const wanted = s?.config?.mascot === 'meowl' ? 'meowl' : 'owl';
  if (wanted !== look) {
    look = wanted;
    frames = buildFrames(look);
    if (reduce) paint(8);
  }
  const who = look === 'meowl' ? 'Pip in its Meowl look' : 'Pip the owl';
  pipCanvas.setAttribute('aria-label', awake ? `${who}, awake on a branch` : `${who}, asleep on a branch, breathing slowly`);

  if (mode === 'blocking') {
    setText(el.title, 'Shh… the forest is asleep');
    const until = s?.nextChange ? timeLabel(s.nextChange) : 'morning';
    setText(el.rest, `is tucked in until ${until}.`);
    document.title = `Shh… ${label} is asleep`;
  } else if (mode === 'paused') {
    setText(el.title, 'Pip is looking the other way');
    setText(el.rest, 'is open for a few minutes. Then it’s back to the nest.');
    document.title = `${label}: a short pause`;
  } else {
    const h = new Date().getHours();
    setText(el.title, h >= 4 && h < 12 ? 'Good morning, the forest is awake' : 'The forest is awake');
    setText(el.rest, h >= 4 && h < 12 ? 'is free to visit again. Sleep well?' : 'is free to visit again.');
    document.title = `${label} is awake`;
  }

  // chip: time left
  if (s?.nextChange && mode !== 'awake') {
    const left = durationLabel(s.nextChange - now);
    setText(el.chipText, mode === 'paused' ? `Pause ends in ${left}` : `${left} until the forest wakes`);
    el.chip.hidden = false;
  } else if (mode === 'awake' && s?.nextChange) {
    setText(el.chipText, `Next bedtime ${timeLabel(s.nextChange)}`);
    el.chip.hidden = false;
  } else {
    el.chip.hidden = true;
  }

  // buttons
  const paired = !!state.app?.url;
  el.cont.hidden = mode === 'blocking';
  if (mode !== 'blocking') {
    el.cont.href = from || (site ? `https://${site}/` : '#');
    setText(el.cont, site ? `Continue to ${site}` : 'Continue');
  }
  el.breathe.className = mode === 'blocking' ? 'btn btn-primary' : 'btn btn-ghost';
  el.breathe.hidden = mode === 'awake';
  el.open.disabled = !paired;
  el.open.title = paired ? state.app.origin : 'Open Hoot Hollow in this browser once to pair it';

  // note
  const bits = [];
  const cfg = s?.config;
  if (mode === 'blocking' && s?.reason === 'sleep') bits.push('Sleep mode is on in Hoot Hollow.');
  else if (cfg && !cfg.duringSleepOnly) bits.push(`Bedtime runs ${clockLabel(cfg.start)} – ${clockLabel(cfg.end)}.`);
  if (mode === 'blocking' && cfg?.strict) bits.push('Strict mode is on, so there’s no snoozing tonight.');
  if (tucked && mode === 'blocking') bits.push('This tab was tucked in when bedtime began; it’ll be right here in the morning.');
  const n = s?.blockedToday ?? 0;
  if (n > 0) bits.push(`${n} ${n === 1 ? 'visit' : 'visits'} gently turned away today.`);
  if (!paired) bits.push('Open Hoot Hollow in this browser once and these buttons will lead back to it.');
  setText(el.note, bits.join(' '));
}

function updateCue(t) {
  const p = (t - guide) % (GUIDE_IN + GUIDE_OUT);
  const inhale = p < GUIDE_IN;
  const secs = inhale ? Math.ceil(GUIDE_IN - p) : Math.ceil(GUIDE_IN + GUIDE_OUT - p);
  setText(el.cue, `${inhale ? 'Breathe in with Pip' : 'and slowly out'} · ${secs}`);
}

el.breathe.addEventListener('click', async () => {
  if (state.app?.url) {
    await send({ kind: 'ui', op: 'openApp', hash: '#breathe' });
    return;
  }
  // not paired yet: breathe right here, 4 in / 6 out, Pip leading
  if (guide === null) {
    guide = (performance.now() - t0) / 1000;
    el.cue.hidden = false;
    setText(el.breathe, 'All done, thanks Pip');
    if (reduce) setText(el.cue, 'Breathe in for 4, out for 6. Pip will wait.');
    else start();
  } else {
    guide = null;
    el.cue.hidden = true;
    setText(el.breathe, 'Breathe with Pip');
  }
});

el.open.addEventListener('click', () => {
  if (state.app?.url) send({ kind: 'ui', op: 'openApp', hash: '' });
});

async function send(msg) {
  try {
    return await api.runtime.sendMessage(msg);
  } catch {
    return null;
  }
}

// ---- boot ---------------------------------------------------------------------------------------

layout();
render();

(async () => {
  const stored = await api.storage.local.get(['status', 'app']).catch(() => ({}));
  state.status = stored.status ?? null;
  state.app = stored.app ?? {};
  render();
  start(); // after the stored config is known, so the right look of Pip is drawn from the first frame
  // count a turned-away visit (not for tabs we tucked in ourselves, and not on reload)
  const nav = performance.getEntriesByType('navigation')[0];
  const reload = nav && /** @type {PerformanceNavigationTiming} */ (nav).type === 'reload';
  if (!tucked && !reload && site) {
    const res = await send({ kind: 'ui', op: 'hit', site });
    if (res?.status) state.status = res.status;
  } else {
    const res = await send({ kind: 'ui', op: 'getState' });
    if (res?.status) {
      state.status = res.status;
      state.app = res.app ?? state.app;
    }
  }
  render();
})();

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.status) state.status = changes.status.newValue ?? null;
  if (changes.app) state.app = changes.app.newValue ?? {};
  if (changes.status || changes.app) render();
});

setInterval(render, 15_000);
