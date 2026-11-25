// The big moments, told with light instead of cartoon marks: a warm breath of light swelling behind the subject, a
// gentle ring of light spreading out like a shockwave, a few soft rays turning slowly, and detailed pixel-art particles
// (golden motes, glints, gold-leaf flakes, petals, ink droplets, wood shavings) on the interface particle layer, with a
// matching touch in the 3D scene round Pip (src/world/fx.ts, sceneFx). Nothing shakes, flashes or shouts.
//   fxMoment('levelup' | 'gacha5' | 'gacha4' | 'unlock' | 'morning' | 'bigbuy' | 'stamp' | 'bedtime', at?)
//   light.breath / light.ring / light.rays     the building blocks (screen CSS px)
// The light is one soft canvas (half resolution, light needs no detail) blended with `screen` over the game. It never
// lights up text: headings, titles, toasts, bubbles and dialogs are cut out of it every frame. With Calm motion (the
// setting or the system's reduced motion) the light only fades in and out in place and fewer particles fly.
import * as THREE from 'three';
import { calmMotion, fxNow } from './kit.ts';
import { lastPointer, shieldRects, uiBurst, type UiFxKind } from '../chrome/uifx.ts';
import { sceneRef } from '../state.ts';
import { sceneFx } from '../../world/fx.ts';

type XY = { x: number; y: number };
interface Glow { t0: number; dur: number; draw(c: CanvasRenderingContext2D, t: number, k: number): void }

// ------------------------------------------------------------------ the light layer

let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null, raf = 0;
const glows: Glow[] = [];
/** light needs no detail: half the CSS resolution, scaled up softly */
const RES = 0.5;

function ensure() {
  if (cv || typeof document === 'undefined') return;
  cv = document.createElement('canvas');
  cv.className = 'hh-light';
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '66', pointerEvents: 'none', mixBlendMode: 'screen' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
}
function add(g: Glow) {
  if (typeof document === 'undefined') return;
  ensure();
  glows.push(g);
  if (!raf) raf = requestAnimationFrame(frame);
}
function frame() {
  raf = 0;
  if (!cv || !ctx) return;
  const W = Math.ceil(innerWidth * RES), H = Math.ceil(innerHeight * RES);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = ctx, now = fxNow();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, W, H);
  for (let i = glows.length - 1; i >= 0; i--) if (now - glows[i].t0 > glows[i].dur) glows.splice(i, 1);
  if (glows.length) {
    c.save();
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.globalCompositeOperation = 'lighter';
    for (const g of glows) {
      const t = now - g.t0;
      if (t < 0) continue;
      c.save(); g.draw(c, t, t / g.dur); c.restore();
    }
    // then cut the text out of the light, with a soft edge
    c.globalCompositeOperation = 'destination-out';
    shieldRects().forEach((r) => {
      for (const [pad, a] of [[10, 0.3], [6, 0.5], [2, 1]] as const) { c.fillStyle = `rgba(0,0,0,${a})`; c.fillRect(r.left - pad, r.top - pad, r.width + pad * 2, r.height + pad * 2); }
    });
    c.restore();
    raf = requestAnimationFrame(frame);
  }
}

type RGB = [number, number, number];
const rgb = (h: string): RGB => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** in over `a` of the life, out over the last `b` (fractions), eased: nothing pops */
const env = (k: number, a: number, b: number) => Math.min(smooth(k / a), smooth((1 - k) / b));

/** A breath of light: a soft warm glow that swells and fades round a point. */
function breath(p: XY, o: { r?: number; color?: string; core?: string; dur?: number; peak?: number; delay?: number } = {}) {
  const dur = o.dur ?? 1.6, col = rgb(o.color ?? '#ffc866'), core = rgb(o.core ?? '#fff2cc'), peak = o.peak ?? 0.55;
  const R = o.r ?? Math.min(innerWidth, innerHeight) * 0.42;
  add({
    t0: fxNow() + (o.delay ?? 0), dur,
    draw(c, _t, k) {
      const e = env(k, 0.18, 0.6) * peak, r = R * (0.86 + 0.14 * smooth(k * 2));
      const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, rgba(core, e)); g.addColorStop(0.16, rgba(col, e * 0.72)); g.addColorStop(0.45, rgba(col, e * 0.26)); g.addColorStop(0.75, rgba(col, e * 0.07)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g; c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    },
  });
}

/** A ring of light spreading out from a point and thinning as it goes, like the air moving after something big. */
function ring(p: XY, o: { r0?: number; r1?: number; color?: string; dur?: number; width?: number; alpha?: number; delay?: number } = {}) {
  const calm = calmMotion(), dur = o.dur ?? 0.9, col = rgb(o.color ?? '#ffe2a0'), a0 = o.alpha ?? 0.5;
  const r0 = o.r0 ?? 30, r1 = o.r1 ?? Math.max(innerWidth, innerHeight) * 0.55;
  add({
    t0: fxNow() + (o.delay ?? 0), dur,
    draw(c, _t, k) {
      if (calm) return;
      // a wide soft band of light, brightest just inside its leading edge, thinning and fading as it goes
      const q = 1 - Math.pow(1 - k, 3), r = r0 + (r1 - r0) * q, w = (o.width ?? 70) * (1 - q * 0.45) + 10;
      const a = a0 * smooth(k / 0.1) * Math.pow(1 - k, 1.8);
      const inner = Math.max(0, r - w), outer = r + w * 0.35;
      const g = c.createRadialGradient(p.x, p.y, inner, p.x, p.y, outer);
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.35, rgba(col, a * 0.22)); g.addColorStop(0.68, rgba(col, a * 0.6)); g.addColorStop(0.8, rgba(col, a * 0.7)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(p.x, p.y, outer, 0, Math.PI * 2); c.arc(p.x, p.y, inner, 0, Math.PI * 2, true); c.fill();
    },
  });
}

/** Soft rays of light from a point: long, faint, of uneven width, turning very slowly. */
function rays(p: XY, o: { n?: number; len?: number; color?: string; dur?: number; alpha?: number; delay?: number; seed?: number } = {}) {
  const calm = calmMotion(), n = o.n ?? 9, dur = o.dur ?? 1.8, col = rgb(o.color ?? '#ffd88a'), a0 = o.alpha ?? 0.22;
  const L = o.len ?? Math.max(innerWidth, innerHeight) * 0.7;
  let s = (o.seed ?? 7) * 2654435761 >>> 0;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s % 10000) / 10000; };
  const list = Array.from({ length: n }, (_, i) => ({ a: (i / n) * Math.PI * 2 + rnd() * 0.5, w: 0.035 + rnd() * 0.07, l: 0.55 + rnd() * 0.45, ph: rnd() * 6 }));
  add({
    t0: fxNow() + (o.delay ?? 0), dur,
    draw(c, t, k) {
      const e = env(k, 0.22, 0.55) * a0, turn = calm ? 0 : t * 0.07;
      for (const r of list) {
        const len = L * r.l * (0.8 + 0.2 * smooth(k * 3)), a = r.a + turn, flick = 0.8 + 0.2 * Math.sin(t * 1.7 + r.ph);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, len);
        g.addColorStop(0, rgba(col, e * flick)); g.addColorStop(0.35, rgba(col, e * flick * 0.45)); g.addColorStop(1, rgba(col, 0));
        c.fillStyle = g;
        c.beginPath(); c.moveTo(p.x, p.y);
        c.arc(p.x, p.y, len, a - r.w, a + r.w);
        c.closePath(); c.fill();
      }
    },
  });
}

/** A dusk veil for bedtime: the edges of the screen settle into a deep blue for a moment (normal blend, a DOM layer). */
function dusk(dur = 2.4) {
  if (typeof document === 'undefined') return;
  const d = document.createElement('div');
  d.setAttribute('aria-hidden', 'true');
  Object.assign(d.style, {
    position: 'fixed', inset: '0', zIndex: '1', pointerEvents: 'none', opacity: '0',
    background: 'radial-gradient(ellipse 80% 70% at 50% 45%, rgba(18,26,58,0) 30%, rgba(18,26,58,0.42) 74%, rgba(10,14,36,0.66) 100%)',
  });
  document.body.appendChild(d);
  add({
    t0: fxNow(), dur,
    draw(_c, _t, k) {
      d.style.opacity = env(k, 0.3, 0.5).toFixed(3);
      if (k > 0.97) d.remove();
    },
  });
  setTimeout(() => d.remove(), dur * 1000 + 3000); // (in case the clock stops)
}

export const light = { breath, ring, rays, dusk };

// ------------------------------------------------------------------ the 3D touch round Pip

function pip(): { at: THREE.Vector3; head: THREE.Vector3 } | null {
  const sc = sceneRef.current as { owl?: { node: THREE.Object3D; headWorld: THREE.Vector3 } } | null;
  if (!sc?.owl?.node?.visible) return null;
  const at = sc.owl.node.position.clone();
  return { at, head: sc.owl.headWorld };
}

// ------------------------------------------------------------------ the moments

export type MomentKind = 'levelup' | 'gacha5' | 'gacha4' | 'unlock' | 'morning' | 'bigbuy' | 'stamp' | 'bedtime';
/** @deprecated the old name */
export type AnimeMoment = MomentKind;
let last = 0;

/** A big moment, composed with light and particles; `at` is the subject on screen (CSS px) or its element. */
export function fxMoment(kind: MomentKind, at?: XY | Element | null) {
  if (typeof document === 'undefined') return;
  const now = performance.now();
  if (now - last < 350) return; // never stack two big moments
  last = now;
  const W = innerWidth, H = innerHeight;
  // a purchase or a stamp happens where the player just pressed, if nothing else is said
  const lp = lastPointer(), pressed = (kind === 'bigbuy' || kind === 'stamp') && (lp.x || lp.y) ? lp : null;
  const p: XY = at instanceof Element ? centreOf(at) ?? { x: W / 2, y: H * 0.42 } : at ?? pressed ?? { x: W / 2, y: H * 0.42 };
  const m = Math.min(W, H);
  const burst = (k: UiFxKind, n: number, dx = 0, dy = 0) => uiBurst(k, p.x + dx, p.y + dy, n);
  const o = pip();
  switch (kind) {
    case 'levelup':
      breath(p, { r: m * 0.6, color: '#ffc45a', peak: 0.8, dur: 2.2 });
      ring(p, { r0: 40, color: '#ffd98a', alpha: 0.4, dur: 1.2 });
      rays(p, { n: 9, color: '#ffd27a', alpha: 0.24, dur: 2.4, seed: 3 });
      burst('glints', 10); burst('motes', 22); burst('flakes', 30, 0, -m * 0.1);
      if (o) { sceneFx.burst('reward', o.head, 16); sceneFx.burst('motes', o.at, 10); }
      break;
    case 'gacha5':
      breath(p, { r: m * 0.66, color: '#ffbe48', core: '#fff6d8', peak: 0.9, dur: 2.3 });
      ring(p, { r0: 50, color: '#ffd77a', alpha: 0.45, dur: 1.1 });
      ring(p, { r0: 30, color: '#fff0c8', alpha: 0.24, dur: 1.4, delay: 0.18, width: 50 });
      rays(p, { n: 11, color: '#ffcf70', alpha: 0.28, dur: 2.5, seed: 11 });
      burst('glints', 14); burst('motes', 26); burst('flakes', 36, 0, -m * 0.08);
      break;
    case 'gacha4':
      breath(p, { r: m * 0.5, color: '#a88cf0', core: '#eee4ff', peak: 0.55, dur: 1.8 });
      ring(p, { r0: 40, color: '#c4b0ff', alpha: 0.34, dur: 1.0 });
      burst('glintsCool', 6); burst('magic', 16);
      break;
    case 'unlock':
      breath(p, { r: m * 0.55, color: '#ffc866', peak: 0.7, dur: 2.1 });
      ring(p, { r0: 36, color: '#ffe2a6', alpha: 0.34, dur: 1.1 });
      rays(p, { n: 7, color: '#ffe0a0', alpha: 0.2, dur: 2.2, seed: 5 });
      burst('motes', 20); burst('dust', 14); burst('glints', 7); burst('leaves', 6, 0, -m * 0.05);
      if (o) { sceneFx.burst('reward', o.head, 12); sceneFx.burst('dust', o.at, 8); }
      break;
    case 'morning':
      breath(p, { r: m * 0.5, color: '#ffb48a', core: '#fff0dc', peak: 0.45, dur: 2.2 });
      rays(p, { n: 6, color: '#ffd6a8', alpha: 0.14, dur: 2.4, seed: 9 });
      burst('petals', 12, 0, -m * 0.08); burst('motes', 10);
      if (o) sceneFx.burst('petals', o.head, 10);
      break;
    case 'bigbuy':
      breath(p, { r: m * 0.3, color: '#ffc45a', peak: 0.4, dur: 1.2 });
      burst('glints', 5); burst('acorns', 5); burst('chips', 7);
      break;
    case 'stamp':
      ring(p, { r0: 18, r1: m * 0.3, color: '#e8dcc4', alpha: 0.22, dur: 0.6, width: 22 });
      burst('ink', 9); burst('paper', 4); burst('dust', 8);
      break;
    case 'bedtime':
      dusk(2.4);
      burst('motesCool', 9, 0, m * 0.05);
      if (o) sceneFx.burst('zzz', o.head, 3);
      break;
  }
}
/** @deprecated the old name, kept so older call sites keep working */
export const animeMoment = fxMoment;

/** Where a DOM element sits on screen (its centre), for anchoring a moment. */
export function centreOf(el: Element | null | undefined): XY | undefined {
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined;
}

// dev and screenshot hooks
if (typeof window !== 'undefined') (window as unknown as { hhMoment: unknown }).hhMoment = { fxMoment, light, live: () => glows.length };
