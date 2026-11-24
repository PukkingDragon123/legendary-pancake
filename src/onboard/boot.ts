// The loading clock (#boot in index.html, drawn by src/onboard/tools/bootart.mjs) and its handoff.
// Before any script runs, the clock already animates in pure CSS: the minute and hour hands sweep
// with the (estimated) loading progress, the moon rises in the arch, the second hand ticks and the
// pendulum swings. Once main.tsx marks the splash `gone`, this module takes over:
//   1. strike  the hands race round to midnight, the clock chimes with a little shudder
//   2. open    the glass door over the dial swings open on its hinge
//   3. dive    the clock zooms in on the dial while a stepped pixel iris opens through the dial
//              (its steps are the zoomed clock's own pixels), revealing the world behind
// A new player keeps the splash (`hold`): the clock strikes and waits, a tiny pixel hand pointer
// bobs over the dial, and one tap on the clock (which also unlocks audio) starts the dive into
// Pip's office for the interview.
//
// Public (kept for intro.tsx and src/ui/intro.tsx): holdBoot, bootShowing, bootReady, wakeBoot,
// releaseBoot. The `gone` class contract with main.tsx is unchanged.
import { sound } from '../audio/sound.ts';

const el = () => document.getElementById('boot');
type Art = { fr: number; fn: number; mw: number; mn: number; cx: number; dy: number; rd: number };
const ART: Art = (() => { try { return JSON.parse(el()?.dataset.art ?? ''); } catch { return { fr: 72, fn: 60, mw: 30, mn: 18, cx: 56, dy: 88, rd: 31 }; } })();
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const play = (id: string, volume: number, rate = 1) => { try { sound.play(id, { volume, rate, gap: 60 }); } catch { /* audio not ready */ } };
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// dev: freeze the handoff for screenshots (?bootdive=open:0.5 | dive:0.4)
const FREEZE = (() => { try { if (!import.meta.env.DEV) return null; const v = new URLSearchParams(location.search).get('bootdive'); if (!v) return null; const [k, t] = v.split(':'); return { k, t: +(t ?? 0.5) }; } catch { return null; } })();

let state: 'loading' | 'striking' | 'struck' | 'leaving' | 'gone' = 'loading';
let struck: Promise<void> | null = null;
let leaving: Promise<void> | null = null;

// ------------------------------------------------------------------ 1. strike midnight

/** Current frame of a stepped sprite strip (from its computed background position). */
function frameOf(node: HTMLElement, fw: number, k: number): number {
  const px = parseFloat(getComputedStyle(node).backgroundPositionX) || 0;
  return Math.round(-px / (fw * k));
}
function strike(): Promise<void> {
  if (struck) return struck;
  state = 'striking';
  struck = (async () => {
    const b = el();
    if (!b) return;
    const k = parseFloat(getComputedStyle(b).fontSize) || 3;
    const mh = b.querySelector<HTMLElement>('.bt-mh'), hh = b.querySelector<HTMLElement>('.bt-hh'), mo = b.querySelector<HTMLElement>('.bt-moon');
    if (mh && hh && mo && !reduced()) {
      const m0 = frameOf(mh, ART.fr, k), h0 = frameOf(hh, ART.fr, k), o0 = frameOf(mo, ART.mw, k);
      for (const n of [mh, hh, mo]) n.style.animation = 'none';
      const steps = Math.max(1, ART.fn - m0), dt = Math.min(34, 520 / steps);
      play('clock_wind', 0.28, 1.3);
      for (let i = 1; i <= steps; i++) {
        const f = m0 + i, t = i / steps;
        mh.style.backgroundPosition = `-${(f % ART.fn) * ART.fr}em 0`;
        hh.style.backgroundPosition = `-${(Math.round(h0 + (ART.fn - h0) * t) % ART.fn) * ART.fr}em 0`;
        mo.style.backgroundPosition = `-${Math.round(o0 + (ART.mn - 1 - o0) * t) * ART.mw}em 0`;
        await wait(dt);
      }
    } else if (mh && hh && mo) {
      for (const n of [mh, hh, mo]) n.style.animation = 'none';
      mh.style.backgroundPosition = hh.style.backgroundPosition = '0 0';
      mo.style.backgroundPosition = `-${(ART.mn - 1) * ART.mw}em 0`;
    }
    b.classList.add('done');
    play('clock_tick', 0.45, 0.8);
    play('sparkle', 0.22, 0.9);
    state = 'struck';
    await wait(380);
  })();
  return struck;
}

// ------------------------------------------------------------------ 2 + 3. open the door and dive through the dial

/** A stepped pixel circle as a polygon contour (clockwise), cell size s, around (cx, cy). */
function pixelCircle(cx: number, cy: number, r: number, s: number): string[] {
  const right: string[] = [], left: string[] = [];
  const n = Math.max(1, Math.ceil(r / s));
  for (let i = -n; i < n; i++) {
    const y0 = cy + i * s, y1 = y0 + s, ym = Math.min(Math.abs(i), Math.abs(i + 1)) * s; // the band's widest row
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
  // evenodd: the outer rectangle, then the hole (connected through the top-left corner)
  return `polygon(evenodd, 0px 0px, ${W}px 0px, ${W}px ${H}px, 0px ${H}px, 0px 0px, ${hole.join(', ')}, ${hole[0]}, 0px 0px)`;
}

function leave(): Promise<void> {
  if (leaving) return leaving;
  leaving = (async () => {
    const b = el();
    if (!b) return;
    await strike();
    state = 'leaving';
    if (reduced()) {
      b.style.transition = 'opacity .35s steps(5)';
      b.style.opacity = '0';
      await wait(380);
      hide();
      return;
    }
    // the glass door swings open
    b.classList.add('open');
    play('door_creak', 0.18, 1.6);
    if (FREEZE?.k === 'open') { const d = b.querySelector<HTMLElement>('.bt-door'); if (d) { d.style.animationDelay = `${-0.46 * FREEZE.t}s`; d.style.animationPlayState = 'paused'; } return; }
    await wait(360);
    // the dive
    b.classList.add('zoom');
    play('tp_shimmer', 0.3);
    play('wings_flutter', 0.15, 1.2);
    const stage = b.querySelector<HTMLElement>('.bt-stage');
    const k = parseFloat(getComputedStyle(b).fontSize) || 3;
    const r0 = stage?.getBoundingClientRect();
    const cx = r0 ? r0.left + ART.cx * k : innerWidth / 2, cy = r0 ? r0.top + ART.dy * k : innerHeight / 2;
    const reach = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy));
    const DUR = 1000;
    await new Promise<void>((done) => {
      const t0 = performance.now();
      let over = false;
      const frame = (now: number) => {
        if (over) return;
        const t = FREEZE ? FREEZE.t : Math.min(1, (now - t0) / DUR);
        const e = t * t * t;                                  // ease in: a slow lean, then the plunge
        const z = 1 + e * 13;
        if (stage) stage.style.transform = `scale(${z.toFixed(4)})`;
        // the hole grows inside the zooming dial, then outruns the screen
        const g = Math.max(0, (t - 0.12) / 0.88);
        const r = Math.min(ART.rd * k * z * 0.96, ART.rd * k * z * (0.15 + g * 1.1) * Math.min(1, g * 3)) + (t > 0.85 ? (t - 0.85) * reach * 6 : 0);
        b.style.clipPath = irisClip(cx, cy, r, Math.max(3, k * z * (z > 6 ? 1 : 2)));
        if (FREEZE) return;
        if (t >= 1 || r > reach * 1.05) { over = true; done(); return; }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      // frames stall in background tabs: never let the app wait on them
      if (!FREEZE) setTimeout(() => { if (!over) { over = true; done(); } }, DUR + 600);
    });
    hide();
  })();
  return leaving;
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

/** The door opens and the camera dives through the dial; resolves when the splash is gone. */
export function wakeBoot(): Promise<void> {
  const b = el();
  if (!b) return Promise.resolve();
  b.classList.remove('ready');
  return leave();
}

/** Let go of the splash for good (dives through the dial if it is still showing). */
export function releaseBoot() {
  const b = el();
  if (!b || state === 'gone') return;
  b.classList.remove('hold');
  b.classList.add('gone');
  check();
}
