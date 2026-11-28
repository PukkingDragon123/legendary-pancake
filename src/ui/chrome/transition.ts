// Full-screen transitions. Every kind is a small lit 3D set drawn on one WebGL overlay (src/ui/chrome/trans3d.ts:
// what each one looks like is listed there); with calm motion (or no WebGL) a plain soft fade stands in. `mid` runs
// while the screen is fully covered; the reveal waits (covered) until the new place has drawn its first heavy frames;
// the promise resolves when the screen is clear again. Where each is used:
//   dream (sleep), clock (the clock), page (the book), blueprint (build, decorate), acorns (the shop), curtain (the
//   wardrobe), clouds (the map, bedtime's globe), mosaic (quests), blinds (settings), plumes and feathers (breathing),
//   stars (the night), sunrise (the morning), leaves (the lodge store), dither/fade (everything else); iris, snow,
//   fireflies and branch are there for callers that ask for them.
// Non-blocking flourishes: flourish('letterbox' | 'levelup' | 'sparkle').
//
// Wiring: installPanelTransitions() makes every change of `panel` (opening, closing, switching)
// play a transition picked by panelTransition(from, to). questionTransition() wipes one card (the
// interview), directorBlend() eases the 3D camera to a shot with letterbox bars.
import { sound } from '../../audio/sound.ts';
import { phase } from '../../game/night.ts';
import { level, save } from '../../game/store.ts';
import type { CamShot, Scene } from '../../world/scene.ts';
import { panel, sceneRef, type Panel } from '../state.ts';
import { hash } from '../real/paint.ts';
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
import { reducedMotion } from './swing.ts';
import { animate3D, hold3D, hide3D, preview3D, type Kind3D, type Opts3D } from './trans3d.ts'; // every kind is a lit 3D set

export type TransitionKind = Kind3D;
export const TRANSITION_KINDS: TransitionKind[] = ['iris', 'dither', 'leaves', 'feathers', 'snow', 'fireflies', 'page', 'blinds', 'mosaic', 'branch', 'clock', 'curtain', 'blueprint', 'stars', 'sunrise', 'acorns', 'plumes', 'clouds', 'dream'];
export interface TransitionOpts {
  /** centre of the iris / clock / fireflies (CSS px); defaults to the middle of the screen */
  x?: number; y?: number;
  /** 1 = normal; 1.5 = faster */
  speed?: number;
  /** play it the other way round (pages turn back, the clock hand runs anticlockwise, curtains open the other way) */
  reverse?: boolean;
  /** limit to a rectangle of the screen (CSS px); used by questionTransition */
  rect?: { x: number; y: number; w: number; h: number };
}

// ------------------------------------------------------------------ the plain fade (calm motion, or no WebGL)

interface Run { W: number; H: number; k: number; rect?: { x0: number; y0: number; x1: number; y1: number } }

let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
let busy = false;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.className = 'hh-trans';
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: '60', pointerEvents: 'none', display: 'none' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
}
function setup(o: TransitionOpts): Run {
  ensure();
  const k = 1, W = Math.ceil(innerWidth), H = Math.ceil(innerHeight); // a flat colour: no need for device pixels
  cv!.width = W; cv!.height = H;
  cv!.style.width = `${W}px`; cv!.style.height = `${H}px`;
  cv!.style.display = 'block';
  const r: Run = { W, H, k };
  if (o.rect) r.rect = { x0: o.rect.x, y0: o.rect.y, x1: o.rect.x + o.rect.w, y1: o.rect.y + o.rect.h };
  return r;
}
/** a soft dusk fading in (in) or out (out), p 0..1 */
function paint(r: Run, phase: 'in' | 'out', p: number) {
  const g = ctx!;
  g.clearRect(0, 0, r.W, r.H);
  const e = smooth(p), a = phase === 'in' ? e : 1 - e;
  const X0 = r.rect?.x0 ?? 0, Y0 = r.rect?.y0 ?? 0, RW = r.rect ? r.rect.x1 - X0 : r.W, RH = r.rect ? r.rect.y1 - Y0 : r.H;
  const gr = g.createLinearGradient(0, Y0, 0, Y0 + RH);
  gr.addColorStop(0, `rgba(22,26,46,${a})`); gr.addColorStop(1, `rgba(40,40,70,${a})`);
  g.fillStyle = gr; g.fillRect(X0, Y0, RW, RH);
}

// ------------------------------------------------------------------ running

// [audio3] soft hand-made whooshes and real foley (sfx sprites): cloth, leaves, pages, paper, chimes
const SOUND: Partial<Record<TransitionKind, [string, number, number?]>> = {
  iris: ['whoosh_soft', 0.4], dither: ['whoosh_soft', 0.25, 0.9], fade: ['whoosh_soft', 0.2, 0.85], leaves: ['leaf_rustle', 0.5], feathers: ['feather_ruffle', 0.4, 0.85], snow: ['star_shimmer', 0.3, 0.9],
  fireflies: ['sparkle_fizz', 0.3], page: ['page_turn', 0.55], blinds: ['whoosh_cloth', 0.35, 1.2], mosaic: ['tick_paper', 0.45], branch: ['leaf_rustle', 0.5, 0.85], clock: ['clock_wind', 0.35, 1.2],
  curtain: ['whoosh_cloth', 0.5], blueprint: ['paper_rustle', 0.45], stars: ['chime_sweep', 0.25, 0.9], sunrise: ['bird_song', 0.3],
  acorns: ['place_wood', 0.45, 1.25], plumes: ['feather_ruffle', 0.5], clouds: ['wind_gust', 0.28, 1.15], dream: ['chime_sweep', 0.35, 0.8],
};
const DUR: Record<TransitionKind, [number, number]> = {
  iris: [0.5, 0.55], dither: [0.4, 0.45], fade: [0.35, 0.4], leaves: [0.6, 0.7], feathers: [0.6, 0.7], snow: [0.6, 0.65], fireflies: [0.6, 0.7], page: [0.55, 0.55],
  blinds: [0.5, 0.5], mosaic: [0.5, 0.55], branch: [0.55, 0.6], clock: [0.55, 0.55], curtain: [0.5, 0.55], blueprint: [0.65, 0.6], stars: [0.6, 0.8], sunrise: [0.5, 1.2],
  acorns: [0.75, 0.85], plumes: [0.85, 0.95], clouds: [0.8, 0.9], dream: [0.9, 1.05],
};

function animate(r: Run, phase: 'in' | 'out', dur: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const t0 = performance.now();
    const finish = () => { if (done) return; done = true; resolve(); };
    const frame = (now: number) => {
      if (done) return;
      const p = Math.min(1, (now - t0) / 1000 / dur);
      paint(r, phase, p);
      if (p >= 1) finish(); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // animation frames stall in background tabs: never let the change of place depend on them
    setTimeout(() => { if (!done) { paint(r, phase, 1); finish(); } }, dur * 1000 + 350);
  });
}

/**
 * Wait, while the screen is covered, until the new place has drawn its first frames: a new 3D place compiles its
 * shaders and uploads its textures on its first frames, and those long frames must not land on the reveal.
 */
function settled(): Promise<void> {
  return new Promise((res) => {
    const t0 = performance.now();
    let n = 0, last = t0;
    const step = (now: number) => {
      const long = now - last > 40;
      last = now;
      n = long ? 0 : n + 1;
      // two smooth frames in a row (at least 110 ms in all), or give up waiting after 1.5 s
      if ((n >= 2 && now - t0 > 110) || now - t0 > 1500) res(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(res, 1600); // animation frames stall in background tabs
  });
}

const o3 = (o: TransitionOpts): Opts3D => ({ rev: o.reverse, x: o.x, y: o.y, rect: o.rect });
const play = (kind: TransitionKind) => { const s = SOUND[kind]; if (s) try { sound.play(s[0], { volume: s[1], rate: s[2] ?? 1, gap: 80 }); } catch { /* not ready */ } };

/** Cover the screen with a transition, run `mid`, then reveal the new place. */
export async function transition(kind: TransitionKind, mid?: () => void | Promise<void>, o: TransitionOpts = {}): Promise<void> {
  if (typeof document === 'undefined' || busy) { await mid?.(); return; }
  busy = true;
  try {
    if (!reducedMotion()) {
      play(kind);
      const [din, dout] = DUR[kind].map((d) => (d * 1000) / (o.speed ?? 1));
      if (await animate3D(kind, 'in', din, o3(o))) {
        try { await mid?.(); } catch (e) { console.warn('transition mid failed', e); }
        hold3D(kind);
        await settled();
        if (kind === 'page') try { sound.play('ui_page', { volume: 0.35, gap: 80 }); } catch { /* */ }
        await animate3D(kind, 'out', dout);
        return;
      }
      hide3D(); // no WebGL for the overlay: the plain fade instead
    }
    const r = setup(o);
    cv!.style.pointerEvents = 'auto'; // no double taps while covered
    const [din, dout] = DUR.fade.map((d) => d / (o.speed ?? 1));
    await animate(r, 'in', din);
    try { await mid?.(); } catch (e) { console.warn('transition mid failed', e); }
    await settled();
    cv!.style.pointerEvents = 'none';
    await animate(r, 'out', dout);
  } finally {
    busy = false;
    if (cv) { ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; cv.style.pointerEvents = 'none'; }
  }
}

/**
 * Start fully covered and reveal: for changes that already happened (the night falling, the
 * morning arriving). Paints the covered frame synchronously, so it is up before the next paint.
 */
export async function reveal(kind: TransitionKind, o: TransitionOpts = {}): Promise<void> {
  if (typeof document === 'undefined' || busy) return;
  busy = true;
  try {
    if (!reducedMotion()) {
      hold3D(kind, o3(o));
      play(kind);
      await new Promise((res) => setTimeout(res, 160));
      if (await animate3D(kind, 'out', (DUR[kind][1] * 1000) / (o.speed ?? 1))) return;
      hide3D();
    }
    const r = setup(o);
    paint(r, 'in', 1);
    await new Promise((res) => setTimeout(res, 160));
    await animate(r, 'out', DUR.fade[1] / (o.speed ?? 1));
  } finally {
    busy = false;
    if (cv) { ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; }
  }
}

/** True while a transition covers (or is uncovering) the screen. */
export const transitioning = () => busy;

/** Dev/screenshot helper: draw one still frame of a transition and leave it on screen (`t`: the wall clock, s). */
export function previewTransition(kind: TransitionKind, phase: 'in' | 'out', p: number, t = 0.6, o: TransitionOpts = {}) {
  if (preview3D(kind, (phase === 'in' ? 0 : 1) + p, o3(o), t)) return;
  const r = setup(o);
  paint(r, phase, p);
}
export function clearTransition() { hide3D(); if (cv) { ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; } }

// ------------------------------------------------------------------ which transition for which change of place

const OPEN: Partial<Record<NonNullable<Panel>, [TransitionKind, TransitionOpts?]>> = {
  sleep: ['dream'], clock: ['clock'], book: ['page'], build: ['blueprint'], decorate: ['blueprint'], shop: ['acorns'], wardrobe: ['curtain'],
  map: ['clouds', { speed: 1.1 }], quests: ['mosaic', { speed: 1.3 }], settings: ['blinds', { speed: 1.2 }], breathe: ['plumes'], night: ['stars'],
};
const CLOSE: Partial<Record<NonNullable<Panel>, [TransitionKind, TransitionOpts?]>> = {
  sleep: ['dream', { speed: 1.25 }], clock: ['clock', { reverse: true, speed: 1.35 }], book: ['page', { reverse: true, speed: 1.25 }], build: ['blueprint', { speed: 1.3 }], decorate: ['blueprint', { speed: 1.3 }],
  shop: ['acorns', { speed: 1.2 }], wardrobe: ['plumes', { speed: 1.3 }], map: ['clouds', { speed: 1.25 }], quests: ['dither', { speed: 1.4 }], settings: ['blinds', { reverse: true, speed: 1.4 }],
  breathe: ['feathers', { speed: 1.2 }], night: ['sunrise'],
};
/** The transition (and options) for a change of place, or null for none. */
export function panelTransition(from: Panel, to: Panel): [TransitionKind, TransitionOpts] | null {
  if (from === to) return null;
  const pick = to ? OPEN[to] : from ? CLOSE[from] : undefined;
  if (!pick) return to || from ? ['dither', { speed: 1.3 }] : null;
  return [pick[0], { ...(pick[1] ?? {}) }];
}

let installed = false;
/**
 * Make every change of `panel` (open, close, switch) play its transition: assignments made while
 * no transition runs are held until the screen is covered. Also: the night falls with stars when
 * Pip leaves, the morning rises with the sun, level-ups burst, and camera view changes get
 * letterbox bars. Safe to call more than once.
 */
export function installPanelTransitions() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(panel), 'value');
  if (d?.get && d.set) {
    const get = d.get, put = d.set;
    let pending: { v: Panel } | null = null;
    const eligible = () => {
      try { return save.peek().onboarded && phase.peek() === 'day' && document.visibilityState === 'visible' && !(window as unknown as { __chromeHold?: boolean }).__chromeHold; } catch { return false; }
    };
    Object.defineProperty(panel, 'value', {
      configurable: true,
      get() { return get.call(this); },
      set(v: Panel) {
        if (pending) { pending.v = v; return; }           // a later change wins while one is pending
        const from = panel.peek();
        const k = busy || !eligible() ? null : panelTransition(from, v);
        if (!k) { put.call(this, v); return; }
        pending = { v };
        void transition(k[0], () => { const t = pending!.v; pending = null; put.call(panel, t); }, k[1]);
      },
    });
  }
  // the night and the morning
  let ph = phase.peek();
  phase.subscribe((v) => {
    const was = ph; ph = v;
    if (was === v) return;
    if (v === 'morning' && (was === 'ringing' || was === 'sleeping')) void reveal('sunrise', { x: innerWidth * 0.5 });
  });
  // level-ups burst with light
  let lv = level.peek().level;
  level.subscribe((l) => { if (l.level > lv) flourish('levelup'); lv = l.level; });
  // camera view changes get cinematic letterbox bars
  const hookScene = () => {
    const sc = sceneRef.current;
    if (!sc) { setTimeout(hookScene, 500); return; }
    const setView = sc.setView.bind(sc);
    sc.setView = (v) => { const was = sc.view; setView(v); if (was !== v && !busy && phase.peek() !== 'sleeping') flourish('letterbox'); };
  };
  hookScene();
}

// ------------------------------------------------------------------ local wipes (the interview's cards)

/** Wipe one rectangle (e.g. the interview clipboard page) with a quick transition, swapping its content in `mid`. */
export function questionTransition(mid?: () => void | Promise<void>, o: { rect?: DOMRect | { x: number; y: number; width: number; height: number }; kind?: TransitionKind; reverse?: boolean; speed?: number } = {}): Promise<void> {
  const rc = o.rect;
  const rect = rc ? { x: rc.x, y: rc.y, w: rc.width, h: rc.height } : undefined;
  return transition(o.kind ?? 'mosaic', mid, { rect, reverse: o.reverse, speed: o.speed ?? 2.2 });
}

// ------------------------------------------------------------------ flourishes (non-blocking overlays)

let fcv: HTMLCanvasElement | null = null, fctx: CanvasRenderingContext2D | null = null, fraf = 0;
interface Fl { kind: 'letterbox' | 'levelup' | 'sparkle'; t0: number; dur: number; x: number; y: number }
const flList: Fl[] = [];
function fensure() {
  if (fcv) return;
  fcv = document.createElement('canvas');
  fcv.className = 'hh-flourish';
  Object.assign(fcv.style, { position: 'fixed', left: '0', top: '0', zIndex: '55', pointerEvents: 'none', display: 'none' });
  document.body.appendChild(fcv);
  fctx = fcv.getContext('2d');
}
/** A short flourish over everything that does not block input: letterbox bars, a level-up burst, a sparkle pop. */
export function flourish(kind: Fl['kind'], o: { x?: number; y?: number } = {}) {
  if (typeof document === 'undefined' || reducedMotion()) return;
  fensure();
  const dur = kind === 'letterbox' ? 1.5 : kind === 'levelup' ? 1.1 : 0.6;
  const ex = flList.find((f) => f.kind === kind);
  if (ex && kind === 'letterbox') { ex.t0 = Math.min(ex.t0, performance.now() - 0.3 * 1000); return; }
  flList.push({ kind, t0: performance.now(), dur, x: o.x ?? innerWidth / 2, y: o.y ?? innerHeight * 0.42 });
  if (!fraf) fraf = requestAnimationFrame(floop);
}
function floop(now: number) {
  fraf = 0;
  const k = Math.min(2, Math.max(1, devicePixelRatio || 1)), W = Math.ceil(innerWidth), H = Math.ceil(innerHeight);
  if (fcv!.width !== Math.round(W * k) || fcv!.height !== Math.round(H * k)) { fcv!.width = Math.round(W * k); fcv!.height = Math.round(H * k); fcv!.style.width = `${W}px`; fcv!.style.height = `${H}px`; }
  fcv!.style.display = 'block';
  const g = fctx!;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, W, H);
  for (let i = flList.length - 1; i >= 0; i--) {
    const f = flList[i], t = (now - f.t0) / 1000 / f.dur;
    if (t >= 1) { flList.splice(i, 1); continue; }
    if (f.kind === 'letterbox') {
      // bars slide in, hold while the camera moves, slide out
      const kk = t < 0.2 ? smooth(t / 0.2) : t > 0.78 ? 1 - smooth((t - 0.78) / 0.22) : 1;
      const bh = kk * Math.min(52, H * 0.075);
      if (bh > 0.5) {
        g.fillStyle = '#0e1220'; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh);
        g.fillStyle = 'rgba(216,160,64,.8)'; g.fillRect(0, bh - 1.5, W, 1.5); g.fillRect(0, H - bh, W, 1.5);
      }
    } else if (f.kind === 'levelup') {
      // soft rings of light and rays bursting from the point, then glints
      const R = smooth(t) * Math.hypot(W, H) * 0.6;
      g.globalAlpha = 1 - t;
      for (let kk = 0; kk < 3; kk++) {
        const rr = R - kk * 16;
        if (rr <= 0) continue;
        g.strokeStyle = ['rgba(255,226,150,.9)', 'rgba(255,190,90,.7)', 'rgba(255,250,236,.6)'][kk]; g.lineWidth = 5 - kk;
        g.beginPath(); g.arc(f.x, f.y, rr, 0, Math.PI * 2); g.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2, gr = g.createLinearGradient(f.x, f.y, f.x + Math.cos(a) * R * 0.8, f.y + Math.sin(a) * R * 0.8);
        gr.addColorStop(0, 'rgba(255,236,170,0)'); gr.addColorStop(0.5, 'rgba(255,236,170,.6)'); gr.addColorStop(1, 'rgba(255,236,170,0)');
        g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(f.x + Math.cos(a) * R * 0.25, f.y + Math.sin(a) * R * 0.25); g.lineTo(f.x + Math.cos(a) * R * 0.8, f.y + Math.sin(a) * R * 0.8); g.stroke();
      }
      for (let i = 0; i < 10; i++) {
        const a = i * 2.39996, d = R * (0.4 + hash(i, 1, 5) * 0.5);
        if (Math.sin(t * 20 + i) < -0.3) continue;
        glint(g, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 7);
      }
      g.globalAlpha = 1;
    } else {
      const R = smooth(t) * 22;
      g.globalAlpha = 1 - t;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; glint(g, f.x + Math.cos(a) * R, f.y + Math.sin(a) * R, 6); }
      g.globalAlpha = 1;
    }
  }
  if (flList.length) fraf = requestAnimationFrame(floop);
  else fcv!.style.display = 'none';
}
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(255,250,230,.95)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,252,236,.95)';
  for (const a of [0, Math.PI / 2]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-r * 1.3, 0); g.quadraticCurveTo(0, -r * 0.16, r * 1.3, 0); g.quadraticCurveTo(0, r * 0.16, -r * 1.3, 0); g.fill(); g.restore(); }
}

// ------------------------------------------------------------------ camera: ease the 3D camera to a shot

/**
 * Take the camera from where it is to `to` over `ms` (ease in-out), with letterbox bars, then hand
 * it back to the scene (or hold the shot while `hold` is true). Resolves when the move is done.
 */
export function directorBlend(scene: Scene, to: CamShot, ms = 1200, o: { hold?: boolean; bars?: boolean } = {}): Promise<void> {
  const c = (scene as unknown as { cur?: { yaw: number; pitch: number; dist: number; target: CamShot['target'] } }).cur;
  if (!c) { return Promise.resolve(); }
  const from = { yaw: c.yaw, pitch: c.pitch, dist: c.dist, target: c.target.clone() };
  let dy = to.yaw - from.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  if (o.bars !== false) flourish('letterbox');
  const t0 = performance.now();
  const prev = scene.director;
  return new Promise((done) => {
    let fin = false;
    scene.director = () => {
      const k = clamp((performance.now() - t0) / ms, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      const shot: CamShot = { yaw: from.yaw + dy * e, pitch: from.pitch + (to.pitch - from.pitch) * e, dist: from.dist + (to.dist - from.dist) * e, target: from.target.clone().lerp(to.target, e), fov: to.fov, snap: true };
      if (k >= 1 && !fin) { fin = true; if (!o.hold) setTimeout(() => { if (scene.director) scene.director = prev; }, 0); done(); }
      return shot;
    };
  });
}
