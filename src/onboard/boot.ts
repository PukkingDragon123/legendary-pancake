// The loading cuckoo clock (#boot in index.html, painted by src/onboard/tools/bootart.mjs) and its handoff.
// Before any module runs the clock already keeps the real time: the hands are CSS animations at clock speed,
// started at the current time by a tiny inline script (negative delays), the pine-cone weights sink on their chains
// with the (estimated) loading progress while the rings on the other ends rise, and the leaf pendulum swings.
// Once main.tsx marks the splash `gone`, this module takes over:
//   1. strike  the weights settle at the bottom while the minute hand winds once round (landing back on the real
//              time), then the little doors open and Pip pops out onto the balcony and calls "cu-ckoo"
//   2. dive    a returning player: the clock zooms into its dial while a stepped pixel iris opens through it onto
//              the world; a new player (`hold`): Pip waits on the balcony, nodding, for one tap on the clock (which
//              also unlocks audio), calls twice, goes back in and shuts the doors; then the clock zooms nose to the
//              dial, where the 3D office's own clock (the same painting) takes over and the camera pulls back into
//              Pip's office (see Office.pullBack).
//
// Public (for intro.tsx and src/ui/intro.tsx): holdBoot, bootShowing, bootReady, bootDial, wakeBoot,
// releaseBoot. The `gone` class contract with main.tsx is unchanged.
import { sound } from '../audio/sound.ts';

const el = () => document.getElementById('boot');
type Art = { fr: number; mn: number; hn: number; cx: number; dy: number; rd: number; w: number; sh: number; bw: number; dw: number; wt: number };
const ART: Art = (() => { try { return JSON.parse(el()?.dataset.art ?? ''); } catch { return { fr: 62, mn: 120, hn: 120, cx: 88, dy: 155, rd: 33, w: 176, sh: 330, bw: 176, dw: 38, wt: 58 }; } })();
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const play = (id: string, volume: number, rate = 1) => { try { sound.play(id, { volume, rate, gap: 60 }); } catch { /* audio not ready */ } };
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
/** how far the dive zooms into the dial before the office takes over */
export const DIVE_ZOOM = 6;

// dev: freeze the handoff for screenshots (?bootdive=zoom:0.5 | iris:0.4)
const FREEZE = (() => { try { if (!import.meta.env.DEV) return null; const v = new URLSearchParams(location.search).get('bootdive'); if (!v) return null; const [k, t] = v.split(':'); return { k, t: +(t ?? 0.5) }; } catch { return null; } })();

let state: 'loading' | 'striking' | 'struck' | 'leaving' | 'gone' = 'loading';
let struck: Promise<void> | null = null;
let leaving: Promise<void> | null = null;

/** Start the hands' clock-speed animations at the current time (seconds into the hour and into 12 hours). */
function syncTime(b: HTMLElement) {
  const d = new Date(), m = d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
  b.style.setProperty('--tm', m.toFixed(1));
  b.style.setProperty('--th', ((d.getHours() % 12) * 3600 + m).toFixed(1));
}
const fontPx = (b: HTMLElement) => parseFloat(getComputedStyle(b).fontSize) || 2;

// ------------------------------------------------------------------ the door and the owl

/** the door strip's frames (bootart.mjs STATES, after the closed door) */
const F = { closed: 0, ajar: 1, peek: 2, out: 3, call: 4, bow: 5 } as const;
function door(f: number) {
  const d = el()?.querySelector<HTMLElement>('.bt-door');
  if (d) d.style.backgroundPosition = `-${f * ART.dw}em 0`;
}
/** the doors swing open and Pip hops out onto the balcony */
async function popOut() {
  const b = el();
  if (!b) return;
  play('door_open', 0.22, 1.7);
  door(F.ajar); await wait(70);
  door(F.peek); await wait(130);
  door(F.out);
  b.classList.add('out');
  await wait(140);
}
/** "cu-ckoo": a high note with the beak open, a low one with a bow; little notes float up from the door */
async function call(n: number) {
  const b = el();
  if (!b) return;
  for (let i = 0; i < n; i++) {
    b.classList.remove('call'); void b.offsetWidth; b.classList.add('call');
    door(F.call); play('owl_hoot', 0.42, 1.34 + (i % 2) * 0.02);
    await wait(300);
    door(F.bow); play('owl_hoot', 0.38, 1.08);
    await wait(340);
    door(F.out);
    await wait(i < n - 1 ? 200 : 110);
  }
}
/** back inside, the doors clack shut */
async function popIn() {
  const b = el();
  if (!b) return;
  b.classList.remove('out');
  door(F.peek); await wait(90);
  door(F.ajar); await wait(70);
  door(F.closed);
  play('wood_knock', 0.18, 1.6);
  await wait(120);
}

// ------------------------------------------------------------------ 1. strike the real time

/** Current frame of a stepped sprite strip (from its computed background position). */
function frameOf(node: HTMLElement, fw: number, k: number): number {
  const px = parseFloat(getComputedStyle(node).backgroundPositionX) || 0;
  return Math.round(-px / (fw * k));
}
const setFrame = (n: HTMLElement, f: number, fw: number) => { n.style.backgroundPosition = `-${f * fw}em 0`; };
/** how far (art px) the weights have sunk so far (from the running CSS animation) */
function sinkOf(w: HTMLElement, k: number): number {
  const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(w).transform);
  return m ? Math.abs(parseFloat(m[1].split(',')[5]) || 0) / k : 0;
}
function setSink(ws: HTMLElement[], s: number) {
  for (const w of ws) w.style.transform = `translateY(${w.classList.contains('bt-rg') ? -s : s}em)`;
}
function strike(): Promise<void> {
  if (struck) return struck;
  state = 'striking';
  struck = (async () => {
    const b = el();
    if (!b) return;
    const k = fontPx(b);
    const mh = b.querySelector<HTMLElement>('.bt-mh');
    const ws = Array.from(b.querySelectorAll<HTMLElement>('.bt-wt, .bt-rg'));
    syncTime(b);
    const s0 = ws.length ? sinkOf(ws[0], k) : ART.wt;
    for (const w of ws) w.style.animation = 'none';
    setSink(ws, Math.round(s0));
    if (!reduced() && mh) {
      // the minute hand winds once round, landing back on the real time, while the weights settle at the bottom
      const m0 = frameOf(mh, ART.fr, k);
      mh.style.animation = 'none';
      const dur = 750, t0 = performance.now();
      play('clock_wind', 0.26, 1.25);
      await new Promise<void>((done) => {
        const step = () => {
          const t = Math.min(1, (performance.now() - t0) / dur), e = 1 - (1 - t) ** 3;
          setFrame(mh, (m0 + Math.round(ART.mn * e)) % ART.mn, ART.fr);
          setSink(ws, Math.round(s0 + (ART.wt - s0) * e));
          if (t >= 1) { done(); return; }
          requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        setTimeout(done, dur + 400);
      });
      // back to keeping time
      mh.style.animation = ''; mh.style.backgroundPosition = '';
      syncTime(b);
    }
    setSink(ws, ART.wt);
    b.classList.add('done');
    if (!reduced()) { await popOut(); await call(1); }
    state = 'struck';
  })();
  return struck;
}

// ------------------------------------------------------------------ 2. the dive

/** A stepped pixel circle as a polygon contour (clockwise), cell size s, around (cx, cy). */
function pixelCircle(cx: number, cy: number, r: number, s: number): string[] {
  const right: string[] = [], left: string[] = [];
  const n = Math.max(1, Math.ceil(r / s));
  for (let i = -n; i < n; i++) {
    const y0 = cy + i * s, y1 = y0 + s, ym = Math.min(Math.abs(i), Math.abs(i + 1)) * s;
    const hw = Math.floor(Math.sqrt(Math.max(0, r * r - ym * ym)) / s) * s;
    if (hw <= 0) continue;
    right.push(`${(cx + hw).toFixed(1)}px ${y0.toFixed(1)}px`, `${(cx + hw).toFixed(1)}px ${y1.toFixed(1)}px`);
    left.unshift(`${(cx - hw).toFixed(1)}px ${y1.toFixed(1)}px`, `${(cx - hw).toFixed(1)}px ${y0.toFixed(1)}px`);
  }
  return [...right, ...left];
}
function irisClip(cx: number, cy: number, r: number, s: number): string {
  const W = innerWidth, H = innerHeight;
  const hole = r > 0.5 ? pixelCircle(cx, cy, r, s) : [];
  if (!hole.length) return 'none';
  return `polygon(evenodd, 0px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px, 0px 0px, ${hole.join(', ')}, ${hole[0]}, 0px 0px)`;
}

/** Where the dial centre is on screen and how big one art pixel is (CSS px), at a given zoom of the dive. */
export function bootDial(zoom = DIVE_ZOOM): { x: number; y: number; px: number } {
  const b = el(), stage = b?.querySelector<HTMLElement>('.bt-stage');
  if (!b || !stage) return { x: innerWidth / 2, y: innerHeight / 2, px: 2 * zoom };
  const k = fontPx(b);
  const prev = stage.style.transform;
  stage.style.transform = 'none';
  const r = stage.getBoundingClientRect();
  stage.style.transform = prev;
  return { x: r.left + ART.cx * k, y: r.top + ART.dy * k, px: k * zoom };
}

/** zoom the stage towards the dial over `dur` ms (ease in: a slow lean, then the plunge); onFrame sees 0..1 */
function zoomIn(dur: number, to: number, onFrame?: (t: number, z: number) => void): Promise<void> {
  const b = el(), stage = b?.querySelector<HTMLElement>('.bt-stage');
  if (!b || !stage) return Promise.resolve();
  return new Promise<void>((done) => {
    const t0 = performance.now();
    let over = false;
    const frame = (now: number) => {
      if (over) return;
      const t = FREEZE ? FREEZE.t : Math.min(1, (now - t0) / dur);
      const e = t * t * (3 - 2 * t) * 0.35 + t * t * t * 0.65;
      const z = 1 + e * (to - 1);
      stage.style.transform = `scale(${z.toFixed(4)})`;
      onFrame?.(t, z);
      if (FREEZE) return;
      if (t >= 1) { over = true; done(); return; }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    if (!FREEZE) setTimeout(() => { if (!over) { over = true; done(); } }, dur + 600);
  });
}

/** a returning player: dive through the dial into the world (a pixel iris opens inside the zooming dial) */
function leave(): Promise<void> {
  if (leaving) return leaving;
  leaving = (async () => {
    const b = el();
    if (!b) return;
    await strike();
    state = 'leaving';
    if (reduced()) { await fadeOut(b); hide(); return; }
    b.classList.add('zoom');
    play('whoosh_soft', 0.3);
    const k = fontPx(b);
    const { x: cx, y: cy } = bootDial(1);
    const reach = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    await zoomIn(1000, 13, (t, z) => {
      const g = Math.max(0, (t - 0.12) / 0.88);
      const r = Math.min(ART.rd * k * z * 0.96, ART.rd * k * z * (0.15 + g * 1.1) * Math.min(1, g * 3)) + (t > 0.85 ? (t - 0.85) * reach * 6 : 0);
      b.style.clipPath = irisClip(cx, cy, r, Math.max(3, k * z * (z > 6 ? 1 : 2)));
    });
    hide();
  })();
  return leaving;
}

async function fadeOut(b: HTMLElement, ms = 320) {
  b.style.transition = `opacity ${ms}ms steps(6)`;
  b.style.opacity = '0';
  await wait(ms + 40);
}

function hide() {
  const b = el();
  state = 'gone';
  if (!b) return;
  b.classList.add('gone');
  b.classList.remove('hold');
  b.style.display = 'none';
  b.style.clipPath = '';
}

// ------------------------------------------------------------------ the contract with main.tsx and the interview

function check() {
  const b = el();
  if (!b || state === 'gone') return;
  if (!b.classList.contains('gone')) return;
  void strike();
  if (!b.classList.contains('hold')) void leave();
}
// take over from the CSS-only fallback as soon as this module loads
(() => {
  const b = el();
  if (!b || typeof MutationObserver === 'undefined') return;
  b.classList.add('js');
  syncTime(b);
  new MutationObserver(check).observe(b, { attributes: true, attributeFilter: ['class'] });
  check();
})();

/** Keep the splash up after main.tsx marks it gone (until the interview takes over). */
export function holdBoot() { el()?.classList.add('hold'); }
export const bootShowing = () => { const b = el(); return !!b && b.style.display !== 'none' && (!b.classList.contains('gone') || b.classList.contains('hold')) && !b.classList.contains('zoom'); };

/** The clock strikes (Pip pops out), then waits for one tap on it (the tap unlocks audio). Resolves at once without a splash. */
export function bootReady(): Promise<void> {
  const b = el();
  if (!b || !bootShowing()) return Promise.resolve();
  void strike().then(() => { if (state !== 'leaving' && state !== 'gone') b.classList.add('ready'); });
  return new Promise((res) => {
    const go = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      b.removeEventListener('pointerdown', go);
      removeEventListener('keydown', go);
      sound.unlock();
      b.classList.remove('ready');
      res();
    };
    b.addEventListener('pointerdown', go);
    addEventListener('keydown', go);
  });
}

/**
 * A new player's dive: Pip calls twice (now with sound), goes back in and the doors shut; then the clock zooms nose
 * to its dial (the office's own clock is waiting underneath at the same framing, see bootDial) and the painting
 * dissolves into the 3D room. Resolves when the splash is gone.
 */
export function wakeBoot(): Promise<void> {
  const b = el();
  if (!b || state === 'gone') return Promise.resolve();
  b.classList.remove('ready');
  if (leaving) return leaving;
  leaving = (async () => {
    await strike();
    state = 'leaving';
    if (!reduced() && !FREEZE) { await call(2); await popIn(); }
    else door(F.closed);
    b.classList.add('zoom');
    if (reduced()) { await fadeOut(b, 400); hide(); return; }
    play('whoosh_soft', 0.32, 0.9);
    await zoomIn(1100, DIVE_ZOOM);
    if (FREEZE) return;
    await fadeOut(b, 300);
    hide();
  })();
  return leaving;
}

/** Let go of the splash for good (dives through the dial if it is still showing). */
export function releaseBoot() {
  const b = el();
  if (!b || state === 'gone') return;
  b.classList.remove('hold');
  b.classList.add('gone');
  check();
}
