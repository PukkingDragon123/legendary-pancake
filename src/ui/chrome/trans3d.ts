// Every screen transition as a small lit 3D set on one WebGL overlay (one renderer, one camera, ACES tone mapping):
//
//   leaves     autumn leaves (oak, maple, beech, birch; curled, veined, light shining through them) tumbling down in a
//              wave over a russet wood at dusk, shadowing the page as they fall
//   branch     a leafy branch in bark swept across the screen, dragging a dusky green canopy in behind it
//   acorns     glossy acorns in scaly cups tumbling down in a wave over a walnut dusk (a faint trail for motion blur)
//   plumes     barred wing feathers fluttering down over oat paper
//   feathers   white down and soft contour feathers blown up from below over cream linen
//   page       a real page turning over from the right edge, curling round, with its shadow; then peeled away
//   blueprint  a blueprint (the tree house's plan) unrolling from its roll down the screen, and rolling back up
//   curtain    heavy velvet (folds that gather and fall open, a sheen at grazing angles) drawn on a brass rail
//   blinds     wooden slats dropping from the head rail and tilting shut row by row, shadowing the screen
//   mosaic     carved wooden tiles flipping over on a diagonal wave onto a walnut board
//   iris       a camera iris of walnut blades edged in brass, closing on a point (the run's x, y) and opening again
//   clock      a brass hand sweeping round, painting an enamel clock face (numerals, minute track) behind it
//   clouds     banks of lit cumulus rolling in from both sides until the sky is white, then parting; their shadows
//   dream      a lavender haze closing in from the edges, bokeh lights spiralling in
//   stars      the night falling from the top: a painted milky way, twinkling stars, a cratered 3D moon with a halo
//   sunrise    dawn over four painted hills (trees on the crests); the sun rises from behind them and the light floods out
//   snow       real flakes (dendrites, plates) tumbling in a gust while frost creeps over the glass from the edges
//   fireflies  fireflies swarming in round a point as the dusk closes, lighting warm pools on it
//   dither     a painted dusk swept on in broad brush strokes from a corner (also 'fade')
//
// Every pose is a pure function of the run's clock T (0..1 covering, 1..2 uncovering), so the motion is continuous
// through the swap in the middle (T = 1 is fully covered). The sets are built and compiled in idle time after loading
// (prewarm3D), one per idle slice; anything not ready is built on first use.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Kit, Run, Set3D } from './t3d/kit.ts';
import { KEY_DIR } from './t3d/kit.ts';
import { acorns, branch, leaves, plumes } from './t3d/fall.ts';
import { blinds, blueprint, clock, curtain, iris, mosaic, page } from './t3d/sheets.ts';
import { clouds, dream, dusk, fireflies, snow, stars, sunrise } from './t3d/sky.ts';

export type Kind3D = 'iris' | 'dither' | 'fade' | 'leaves' | 'feathers' | 'snow' | 'fireflies' | 'page' | 'blinds' | 'mosaic' | 'branch' | 'clock' | 'curtain' | 'blueprint' | 'stars' | 'sunrise' | 'acorns' | 'plumes' | 'clouds' | 'dream';
const BUILD: Record<Exclude<Kind3D, 'fade'>, (k: Kit) => Set3D> = {
  iris, dither: dusk, leaves, feathers: (k) => plumes(k, true), snow, fireflies, page, blinds, mosaic, branch, clock, curtain, blueprint, stars, sunrise, acorns, plumes: (k) => plumes(k), clouds, dream,
};
export const KINDS_3D: Kind3D[] = ['iris', 'dither', 'fade', 'leaves', 'feathers', 'snow', 'fireflies', 'page', 'blinds', 'mosaic', 'branch', 'clock', 'curtain', 'blueprint', 'stars', 'sunrise', 'acorns', 'plumes', 'clouds', 'dream'];
export const is3D = (k: string): k is Kind3D => (KINDS_3D as string[]).includes(k);
const canon = (k: Kind3D): Exclude<Kind3D, 'fade'> => (k === 'fade' ? 'dither' : k);

export interface Opts3D {
  /** play it the other way round (pages turn back, the hand runs anticlockwise, the wave starts at the other end) */
  rev?: boolean;
  /** the centre (CSS px): the iris closes on it, the clock turns round it, the fireflies swarm round it, the sun rises at its x */
  x?: number; y?: number;
  /** only cover this rectangle of the screen (CSS px) */
  rect?: { x: number; y: number; w: number; h: number };
}

class Trans3D {
  readonly canvas: HTMLCanvasElement;
  private r: THREE.WebGLRenderer;
  private sets = new Map<string, Set3D>();
  readonly kit: Kit;
  private W = 0; private H = 0; private px = 0;
  /** resolution scale under the device's own (lowered on a device that cannot keep up) */
  scale = 1;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hh-trans3d';
    Object.assign(this.canvas.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '61', pointerEvents: 'none', display: 'none' });
    document.body.appendChild(this.canvas);
    const dpr = devicePixelRatio || 1;
    // a phone's dense screen is smooth enough without multisampling; a plain 1x screen gets it
    this.r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: dpr < 1.75, premultipliedAlpha: true, stencil: false, powerPreference: 'high-performance' });
    this.r.setClearColor(0x000000, 0);
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 1.1;
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    // The game's ink (gfx/ink.ts) patches three's opaque_fragment chunk so opaque materials write an ink class into
    // alpha instead of 1. Here alpha is coverage over the page, so this renderer compiles its own programs from the
    // unpatched chunk (as onboard/overlay3d.ts does), or every solid thing would come out a third opaque.
    const SC = THREE.ShaderChunk as unknown as Record<string, string> & { __hhInkOrig?: string };
    const plain = <A extends unknown[], R>(f: (...a: A) => R) => (...a: A): R => {
      const cur = SC.opaque_fragment;
      if (SC.__hhInkOrig) SC.opaque_fragment = SC.__hhInkOrig;
      try { return f(...a); } finally { SC.opaque_fragment = cur; }
    };
    this.r.render = plain(this.r.render.bind(this.r));
    this.r.compile = plain(this.r.compile.bind(this.r));
    let env: THREE.Texture | null = null;
    try { const pm = new THREE.PMREMGenerator(this.r); env = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch { /* no reflections */ }
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.kit = { cam, env, run: { rev: false, cx: 0.5, cy: 0.5 }, key: KEY_DIR };
    const nav = navigator as Navigator & { deviceMemory?: number };
    if ((nav.deviceMemory ?? 8) <= 2) this.scale = 0.8;
  }

  private size() {
    const k = Math.min(1.5, devicePixelRatio || 1) * this.scale; // a transition is in motion: 1.5x is plenty
    const W = innerWidth, H = innerHeight;
    if (W === this.W && H === this.H && k === this.px) return;
    this.W = W; this.H = H; this.px = k;
    this.r.setPixelRatio(k);
    this.r.setSize(W, H, false);
    this.kit.cam.aspect = W / H;
    this.kit.cam.updateProjectionMatrix();
  }
  set(kind: Kind3D): Set3D {
    const c = canon(kind);
    let s = this.sets.get(c);
    if (!s) { s = BUILD[c](this.kit); this.sets.set(c, s); }
    return s;
  }
  opts(o: Opts3D = {}) {
    const run: Run = this.kit.run;
    run.rev = !!o.rev;
    run.cx = o.x !== undefined ? o.x / Math.max(1, innerWidth) : 0.5;
    run.cy = o.y !== undefined ? o.y / Math.max(1, innerHeight) : 0.5;
    const rc = o.rect;
    this.canvas.style.clipPath = rc ? `inset(${rc.y}px ${Math.max(0, innerWidth - rc.x - rc.w)}px ${Math.max(0, innerHeight - rc.y - rc.h)}px ${rc.x}px)` : '';
  }
  /** draw the frame for clock T (0..2) at wall time `time` (s) */
  draw(kind: Kind3D, T: number, time: number) {
    this.size();
    const s = this.set(kind);
    s.pose(T, time);
    this.r.render(s.scene, this.kit.cam);
  }
  /** build a set, upload everything and compile its shaders now (so its first run has no hitch) */
  warm(kind: Kind3D) {
    this.size();
    const s = this.set(kind);
    s.scene.traverse((o) => { o.visible = true; });
    this.r.compile(s.scene, this.kit.cam);
    // one real frame (hidden) uploads the geometry and instance buffers too
    s.pose(0.6, 0);
    this.r.render(s.scene, this.kit.cam);
    this.r.clear();
  }
  show(on: boolean) { this.canvas.style.display = on ? 'block' : 'none'; this.canvas.style.pointerEvents = on ? 'auto' : 'none'; }
  /** wait for the GPU (for measuring) */
  sync() { const gl = this.r.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PX); }
}
const PX = new Uint8Array(4);

let runner: Trans3D | null = null;
let runId = 0;
let failed = false;
/** the overlay (made on first use); null if WebGL is not available */
function get(): Trans3D | null {
  if (runner || failed) return runner;
  try { runner = new Trans3D(); } catch (e) { console.warn('3D transitions unavailable', e); failed = true; }
  return runner;
}

type Dev = { hhTrans?: { log?: boolean } };
/** a device that cannot keep up: draw the next frames at a lower resolution (down to 70%) */
function adapt(tr: Trans3D, dts: number[]) {
  if (dts.length < 8) return;
  const s = dts.slice(-8).sort((a, b) => a - b)[4];
  if (s > 24 && tr.scale > 0.7) tr.scale = Math.max(0.7, tr.scale - 0.15);
}

/** Animate one half of a transition: 'in' covers (T 0..1), 'out' uncovers (T 1..2). Resolves at the end. */
export function animate3D(kind: Kind3D, half: 'in' | 'out', ms: number, o?: Opts3D): Promise<boolean> {
  const tr = get();
  if (!tr) return Promise.resolve(false);
  if (o) tr.opts(o);
  tr.show(true);
  const id = ++runId;
  const dts: number[] = [];
  return new Promise((res) => {
    let over = false;
    const end = (ok: boolean) => {
      if (over) return; over = true;
      if (half === 'out' && id === runId) tr.show(false);
      if (import.meta.env.DEV && (window as unknown as Dev).hhTrans?.log && dts.length) {
        const s = [...dts].sort((a, b) => a - b);
        console.log(`[trans] ${kind} ${half}: ${dts.length} frames, median ${s[s.length >> 1].toFixed(1)} ms, worst ${s[s.length - 1].toFixed(1)} ms`);
      }
      res(ok);
    };
    const t0 = performance.now();
    let last = 0;
    const step = (now: number) => {
      if (over) return;
      if (last) { dts.push(now - last); adapt(tr, dts); }
      last = now;
      const k = Math.min(1, (now - t0) / ms);
      try { tr.draw(kind, (half === 'in' ? 0 : 1) + k, now / 1000); } catch (e) { console.warn('3D transition frame failed', e); end(false); return; }
      if (k < 1) requestAnimationFrame(step); else end(true);
    };
    requestAnimationFrame(step);
    // animation frames stall in background tabs: never let the change of place wait on them
    setTimeout(() => end(true), ms + 600);
  });
}
/** Get the transitions ready in idle moments after the game has loaded: one set per idle slice. */
export function prewarm3D() {
  if (typeof window === 'undefined') return;
  const idle = (f: () => void) => ((window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback ?? ((g: () => void) => setTimeout(g, 200)))(f, { timeout: 4000 });
  // the ones the game plays most first
  const kinds: Kind3D[] = ['dither', 'dream', 'clouds', 'blinds', 'mosaic', 'page', 'acorns', 'curtain', 'blueprint', 'plumes', 'feathers', 'stars', 'sunrise', 'clock', 'leaves', 'branch', 'iris', 'snow', 'fireflies'];
  const next = () => {
    const k = kinds.shift(); if (!k) return;
    const tr = get(); if (!tr) return;
    if (tr.canvas.style.display === 'block') { kinds.unshift(k); setTimeout(() => idle(next), 500); return; } // a transition is playing
    try { tr.warm(k); } catch { /* fine: it builds on first use */ }
    idle(next);
  };
  idle(next);
}
/** hold the covered frame (while the swap in the middle runs) */
export function hold3D(kind: Kind3D, o?: Opts3D) { const tr = get(); if (tr) { if (o) tr.opts(o); tr.show(true); try { tr.draw(kind, 1, performance.now() / 1000); } catch { /* */ } } }
export function hide3D() { runner?.show(false); }
/** dev: one still frame at clock T (0..2) */
export function preview3D(kind: Kind3D, T: number, o?: Opts3D, time = performance.now() / 1000): boolean {
  const tr = get();
  if (!tr) return false;
  tr.opts(o ?? {});
  tr.show(true);
  tr.draw(kind, T, time);
  return true;
}
/** dev: the cost of one kind's frames, the GPU waited for each frame (ms) */
export function bench3D(kind: Kind3D, frames = 40) {
  const tr = get();
  if (!tr) return null;
  tr.opts({});
  tr.show(true);
  tr.warm(kind);
  for (let i = 0; i < 4; i++) { tr.draw(kind, i / 2, i / 60); tr.sync(); }
  const ts: number[] = [];
  for (let i = 0; i < frames; i++) { const t0 = performance.now(); tr.draw(kind, (2 * i) / (frames - 1), i / 60); tr.sync(); ts.push(performance.now() - t0); }
  tr.show(false);
  ts.sort((a, b) => a - b);
  const r = (v: number) => Math.round(v * 10) / 10;
  return { kind, avg: r(ts.reduce((a, b) => a + b, 0) / ts.length), p50: r(ts[ts.length >> 1]), p95: r(ts[Math.floor(ts.length * 0.95)]), max: r(ts[ts.length - 1]) };
}
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { hhTrans: unknown }).hhTrans = {
    log: false,
    kinds: KINDS_3D.filter((k) => k !== 'fade'),
    preview: (kind: Kind3D, T: number, o?: Opts3D, time?: number) => preview3D(kind, T, o, time),
    hide: hide3D,
    bench: bench3D,
    benchAll: (frames = 40) => KINDS_3D.filter((k) => k !== 'fade').map((k) => bench3D(k, frames)),
  };
}
