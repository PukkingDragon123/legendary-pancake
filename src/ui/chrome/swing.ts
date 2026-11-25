// Hanging things swing: a damped pendulum per sign or tag, nudged by a soft breeze in idle and
// kicked when tapped or hit by a reward. One shared animation frame loop drives them all.
import { save } from '../../game/store.ts';

export interface Swing {
  el: HTMLElement | null;
  /** angle (deg) and angular velocity */
  a: number; v: number;
  /** stiffness, damping */
  k: number; c: number;
  /** idle breeze amplitude (deg) and speed */
  amp: number; rate: number; ph: number;
  /** extra transform after the rotation (e.g. a squash) */
  post?: string;
}
const swings = new Set<Swing>();
let raf = 0, last = 0;
type W = Window & { __chromeT?: number };

export const reducedMotion = () => {
  try { return !!save.value.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

function loop(now: number) {
  raf = requestAnimationFrame(loop);
  const frozen = (window as W).__chromeT;
  if (frozen !== undefined) { for (const s of swings) apply(s); return; }
  const dt = Math.min(0.05, Math.max(0.001, (now - (last || now)) / 1000));
  last = now;
  if (document.hidden) return;
  const t = now / 1000, still = reducedMotion();
  for (const s of swings) {
    const wind = still ? 0 : s.amp * (Math.sin(t * s.rate + s.ph) + 0.45 * Math.sin(t * s.rate * 2.3 + s.ph * 1.7));
    // integrate in small steps so a hard kick stays stable
    for (let i = 0; i < 2; i++) {
      const h = dt / 2, acc = -s.k * (s.a - wind) - s.c * s.v;
      s.v += acc * h; s.a += s.v * h;
    }
    apply(s);
  }
}
function apply(s: Swing) { if (s.el) s.el.style.transform = `rotate(${s.a.toFixed(2)}deg)${s.post ?? ''}`; }

export function makeSwing(o: Partial<Swing> = {}): Swing {
  return { el: null, a: 0, v: 0, k: 26, c: 2.4, amp: 0.8, rate: 0.9, ph: Math.random() * 6.28, ...o };
}
export function addSwing(s: Swing) {
  swings.add(s);
  if (!raf) { last = 0; raf = requestAnimationFrame(loop); }
}
export function removeSwing(s: Swing) {
  swings.delete(s);
  if (!swings.size && raf) { cancelAnimationFrame(raf); raf = 0; }
}
/** Give it a push: `deg/s` of angular velocity (random direction when `dir` is 0). */
export function kick(s: Swing, power = 60, dir = 0) {
  const d = dir || (Math.random() < 0.5 ? -1 : 1);
  s.v += d * power * (reducedMotion() ? 0.25 : 1);
}
