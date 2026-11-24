// The loading clock (#boot in index.html, painted by src/onboard/tools/bootart.mjs) and its handoff.
// Before any module runs the clock already keeps the real time: the hands are CSS animations at clock speed,
// started at the current time by a tiny inline script (negative delays), the moon rises in the arch with the
// (estimated) loading progress and the pendulum swings. Once main.tsx marks the splash `gone`, this module
// takes over:
//   1. strike  the minute hand winds once round (landing back on the real time), the moon rises full and the
//              clock chimes with a little shudder; then the hands go on keeping time
//   2. dive    a returning player: the clock zooms into its dial while a stepped pixel iris opens through it
//              onto the world; a new player (`hold`): the clock waits for one tap (which also unlocks audio),
//              then zooms nose to the dial, where the 3D office's own clock (the same painting) takes over and
//              the camera pulls back into Pip's office (see Office.pullBack).
//
// Public (for intro.tsx and src/ui/intro.tsx): holdBoot, bootShowing, bootReady, bootDial, wakeBoot,
// releaseBoot. The `gone` class contract with main.tsx is unchanged.
import { sound } from '../audio/sound.ts';

const el = () => document.getElementById('boot');
type Art = { fr: number; mn: number; hn: number; sn: number; mw: number; mf: number; cx: number; dy: number; rd: number; w: number; sh: number; bw: number };
const ART: Art = (() => { try { return JSON.parse(el()?.dataset.art ?? ''); } catch { return { fr: 70, mn: 120, hn: 120, sn: 60, mw: 48, mf: 40, cx: 80, dy: 150, rd: 34, w: 160, sh: 296, bw: 172 }; } })();
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

/** Start the hands' clock-speed animations at the current time (seconds into the minute, hour and 12 hours). */
function syncTime(b: HTMLElement) {
  const d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() * 60 + s;
  b.style.setProperty('--ts', s.toFixed(2));
  b.style.setProperty('--tm', m.toFixed(1));
  b.style.setProperty('--th', ((d.getHours() % 12) * 3600 + m).toFixed(1));
}

// ------------------------------------------------------------------ 1. strike the real time

/** Current frame of a stepped sprite strip (from its computed background position). */
function frameOf(node: HTMLElement, fw: number, k: number): number {
  const px = parseFloat(getComputedStyle(node).backgroundPositionX) || 0;
  return Math.round(-px / (fw * k));
}
const setFrame = (n: HTMLElement, f: number, fw: number) => { n.style.backgroundPosition = `-${f * fw}em 0`; };
function strike(): Promise<void> {
  if (struck) return struck;
  state = 'striking';
  struck = (async () => {
    const b = el();
    if (!b) return;
    const k = parseFloat(getComputedStyle(b).fontSize) || 2;
    const mh = b.querySelector<HTMLElement>('.bt-mh'), hh = b.querySelector<HTMLElement>('.bt-hh'), mo = b.querySelector<HTMLElement>('.bt-moon'), sh = b.querySelector<HTMLElement>('.bt-sh');
    void sh;
    syncTime(b);
    if (mh && hh && mo) {
      const m0 = frameOf(mh, ART.fr, k), o0 = frameOf(mo, ART.mw, k);
      mo.style.animation = 'none';
      if (!reduced()) {
        // the minute hand winds once round, landing back on the real time, while the moon rises full
        mh.style.animation = 'none';
        const dur = 900, t0 = performance.now();
        play('clock_wind', 0.26, 1.25);
        await new Promise<void>((done) => {
          const step = () => {
            const t = Math.min(1, (performance.now() - t0) / dur), e = 1 - (1 - t) ** 3;
            setFrame(mh, (m0 + Math.round(ART.mn * e)) % ART.mn, ART.fr);
            setFrame(mo, Math.round(o0 + (ART.mf - 1 - o0) * e), ART.mw);
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
      setFrame(mo, ART.mf - 1, ART.mw);
    }
    b.classList.add('done');
    play('clock_chime', 0.42);
    play('sparkle', 0.16, 0.9);
    state = 'struck';
    await wait(420);
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
  const k = parseFloat(getComputedStyle(b).fontSize) || 2;
  const prev = stage.style.transform;
  stage.style.transform = 'none';
  const r = stage.getBoundingClientRect();
  stage.style.transform = prev;
  return { x: r.left + (ART.bw / 2) * k, y: r.top + ART.dy * k, px: k * zoom };
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
    const k = parseFloat(getComputedStyle(b).fontSize) || 2;
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

/** The clock strikes, then waits for one tap on it (the tap unlocks audio). Resolves at once without a splash. */
export function bootReady(): Promise<void> {
  const b = el();
  if (!b || !bootShowing()) return Promise.resolve();
  void strike().then(() => b.classList.add('ready'));
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
 * A new player's dive: the clock zooms nose to its dial (the office's own clock is waiting underneath at the same
 * framing, see bootDial), then the painting dissolves into the 3D room. Resolves when the splash is gone.
 */
export function wakeBoot(): Promise<void> {
  const b = el();
  if (!b || state === 'gone') return Promise.resolve();
  b.classList.remove('ready');
  if (leaving) return leaving;
  leaving = (async () => {
    await strike();
    state = 'leaving';
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
