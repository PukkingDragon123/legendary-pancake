// 2D pixel-art particles for the interface (puffs, sparkles, hearts, swirling magic motes,
// spinning acorns, stars, snow, leaves, confetti), drawn on one overlay canvas above the UI.
// One canvas texel is 2 CSS px, so particles share the chunky pixel grid of the sprites.
// Anyone may call uiBurst(kind, x, y, n) with screen coordinates in CSS px.
// OWNED BY THE UI-CHROME BUILDER.
import { spriteCanvas } from '../px/sprites.js';
import '../px/chromeart.js';
import { reducedMotion } from './swing.ts';

export type UiFxKind = 'puff' | 'sparkle' | 'hearts' | 'magic' | 'coins' | 'stars' | 'snow' | 'leaves' | 'confetti';

const B = 2; // CSS px per texel
interface P {
  kind: UiFxKind | 'firefly'; x: number; y: number; vx: number; vy: number; g: number; drag: number;
  life: number; age: number; frames?: string[]; fps: number; f0: number;
  col?: string; ph: number; ox: number; oy: number; r: number; w: number; trail?: [number, number][];
}
const parts: P[] = [];
let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
let raf = 0, last = 0, W = 0, H = 0;
let ambientOn = false, ambientBox = { x: 0, y: 0, w: 0, h: 0 };
type Win = Window & { __chromeT?: number };

const R = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const MAGIC = ['#c9a6ff', '#8f6bff', '#7fe3ff', '#ffffff', '#ffd86a', '#ff9be8'];
const CONFETTI = ['#e8473d', '#ffcc34', '#46963c', '#3c88d8', '#f08aa8', '#9a7ed8', '#fff3c4'];
const fr = (base: string, n: number) => Array.from({ length: n }, (_, i) => `${base}_${i}`);

function ensure() {
  if (cv || typeof document === 'undefined') return;
  cv = document.createElement('canvas');
  cv.className = 'hh-uifx';
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: '70', pointerEvents: 'none', imageRendering: 'pixelated' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
  fit();
  addEventListener('resize', fit);
}
function fit() {
  if (!cv) return;
  W = Math.ceil(innerWidth / B); H = Math.ceil(innerHeight / B);
  cv.width = W; cv.height = H;
  cv.style.width = `${W * B}px`; cv.style.height = `${H * B}px`;
  if (ctx) ctx.imageSmoothingEnabled = false;
}
function start() {
  ensure();
  if (!raf) { last = 0; raf = requestAnimationFrame(step); }
}

function spawn(kind: UiFxKind, x: number, y: number): P {
  const base: P = { kind, x, y, vx: 0, vy: 0, g: 0, drag: 0, life: 1, age: 0, fps: 10, f0: Math.floor(Math.random() * 4), ph: Math.random() * 6.28, ox: x, oy: y, r: 0, w: 0 };
  const a = Math.random() * Math.PI * 2;
  switch (kind) {
    case 'puff': { const s = R(30, 90); return { ...base, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 20, drag: 3.2, g: -10, life: R(0.45, 0.7), frames: fr('fx_puff', 6), fps: 0, f0: 0 }; }
    case 'sparkle': { const s = R(70, 190); return { ...base, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, drag: 3.5, g: 40, life: R(0.55, 0.95), frames: fr('fx_spark', 4), fps: 12 }; }
    case 'hearts': return { ...base, vx: R(-40, 40), vy: R(-110, -60), drag: 1.2, g: -20, life: R(1, 1.5), frames: fr('fx_heart', 2), fps: 4 };
    case 'magic': return { ...base, vx: 0, vy: R(-50, -20), drag: 0, g: -15, life: R(0.9, 1.5), r: R(4, 14), w: R(5, 9) * (Math.random() < 0.5 ? -1 : 1), col: pick(MAGIC), trail: [] };
    case 'coins': return { ...base, vx: R(-120, 120), vy: R(-300, -160), drag: 0.6, g: 620, life: R(0.9, 1.3), frames: fr('fx_acorn', 4), fps: R(10, 16) };
    case 'stars': { const s = R(90, 220); return { ...base, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, drag: 2.2, g: 90, life: R(0.8, 1.2), frames: fr('fx_star', 3), fps: 10 }; }
    case 'snow': return { ...base, x: x + R(-60, 60), vx: R(-20, 20), vy: R(15, 50), drag: 0.3, g: 6, life: R(1.6, 2.6), frames: fr('fx_snow', 2), fps: 3 };
    case 'leaves': return { ...base, vx: R(-90, 90), vy: R(-140, -40), drag: 1.4, g: 120, life: R(1.4, 2.2), frames: fr(pick(['fx_leaf', 'fx_leafo', 'fx_leafr']), 4), fps: R(6, 10) };
    case 'confetti': return { ...base, vx: R(-160, 160), vy: R(-360, -180), drag: 1.6, g: 520, life: R(1.2, 1.9), col: pick(CONFETTI), fps: R(8, 16) };
  }
}

/** Throw `n` particles of `kind` from a screen point (CSS px). */
export function uiBurst(kind: UiFxKind, x: number, y: number, n = 10): void {
  if (typeof document === 'undefined') return;
  if (reducedMotion()) n = Math.ceil(n / 3);
  if (parts.length > 420) parts.splice(0, parts.length - 420);
  for (let i = 0; i < n; i++) parts.push(spawn(kind, x, y));
  start();
}
/** Burst from the centre of an element. */
export function uiBurstAt(el: Element | null, kind: UiFxKind, n = 10) { if (!el) return; const r = el.getBoundingClientRect(); uiBurst(kind, r.left + r.width / 2, r.top + r.height / 2, n); }

/** Fireflies drifting over a screen box (e.g. the HUD at night); `null` stops them. */
export function uiAmbient(box: { x: number; y: number; w: number; h: number } | null) {
  ambientOn = !!box && !reducedMotion();
  if (box) ambientBox = box;
  if (ambientOn) start();
}

// the last place the player touched (so effects can come from the button that was pressed)
let lastPt = { x: 0, y: 0 };
if (typeof window !== 'undefined') addEventListener('pointerdown', (e) => { lastPt = { x: e.clientX, y: e.clientY }; }, true);
export const lastPointer = () => ({ ...lastPt });

function step(now: number) {
  raf = 0;
  const frozen = (window as Win).__chromeT;
  const dt = frozen !== undefined ? 0 : Math.min(0.05, Math.max(0, (now - (last || now)) / 1000));
  last = now;
  if (!ctx || !cv) return;
  if (innerWidth / B > W + 1 || innerHeight / B > H + 1) fit();
  // ambient fireflies
  const flies = parts.reduce((n, p) => n + (p.kind === 'firefly' ? 1 : 0), 0);
  if (ambientOn && flies < 7 && Math.random() < dt * 2) {
    const b = ambientBox;
    parts.push({ kind: 'firefly', x: R(b.x, b.x + b.w), y: R(b.y, b.y + b.h), vx: R(-8, 8), vy: R(-6, 6), g: 0, drag: 0, life: R(5, 9), age: 0, fps: 0, f0: 0, ph: Math.random() * 6.28, ox: 0, oy: 0, r: 0, w: R(1.5, 3) });
  }
  ctx.clearRect(0, 0, W, H);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.kind === 'firefly' && !ambientOn && p.life - p.age > 0.6) p.age = p.life - 0.6;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    move(p, dt);
    draw(ctx, p);
  }
  if (parts.length || ambientOn) raf = requestAnimationFrame(step);
  else ctx.clearRect(0, 0, W, H);
}

function move(p: P, dt: number) {
  if (p.kind === 'magic') {
    // swirl around a rising centre, the orbit widening
    p.oy += p.vy * dt; p.vy += p.g * dt;
    p.ph += p.w * dt; p.r += dt * 18;
    p.trail!.unshift([p.x, p.y]); if (p.trail!.length > 4) p.trail!.pop();
    p.x = p.ox + Math.cos(p.ph) * p.r; p.y = p.oy + Math.sin(p.ph) * p.r * 0.55;
    return;
  }
  if (p.kind === 'firefly') {
    p.ph += dt;
    p.vx += Math.sin(p.ph * 0.9 + p.w) * 6 * dt; p.vy += Math.cos(p.ph * 1.3) * 5 * dt;
    p.vx *= 1 - dt * 0.3; p.vy *= 1 - dt * 0.3;
    p.x += p.vx * dt; p.y += p.vy * dt;
    return;
  }
  const k = Math.max(0, 1 - p.drag * dt);
  p.vx *= k; p.vy = p.vy * k + p.g * dt;
  if (p.kind === 'snow' || p.kind === 'leaves') p.vx += Math.sin(p.age * 3 + p.ph) * 40 * dt;
  if (p.kind === 'hearts') p.x += Math.sin(p.age * 5 + p.ph) * 18 * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
}

function draw(c: CanvasRenderingContext2D, p: P) {
  const k = p.age / p.life;
  // fade in pixel steps, never smoothly
  c.globalAlpha = k > 0.85 ? 0.35 : k > 0.7 ? 0.7 : 1;
  const tx = Math.round(p.x / B), ty = Math.round(p.y / B);
  if (p.frames) {
    const n = p.frames.length;
    const f = p.fps ? (p.f0 + Math.floor(p.age * p.fps)) % n : Math.min(n - 1, Math.floor(k * n));
    const img = spriteCanvas(p.frames[f], 1);
    c.drawImage(img, tx - (img.width >> 1), ty - (img.height >> 1));
  } else if (p.kind === 'magic') {
    p.trail!.forEach(([x, y], i) => { c.globalAlpha = 0.6 - i * 0.14; c.fillStyle = i < 1 ? p.col! : '#6a4cd8'; c.fillRect(Math.round(x / B), Math.round(y / B), 1, 1); });
    c.globalAlpha = k > 0.8 ? 0.5 : 1;
    c.fillStyle = p.col!; c.fillRect(tx, ty, 1, 1);
    if (Math.floor(p.age * 12) % 3 === 0) { c.globalAlpha *= 0.55; c.fillRect(tx - 1, ty, 1, 1); c.fillRect(tx + 1, ty, 1, 1); c.fillRect(tx, ty - 1, 1, 1); c.fillRect(tx, ty + 1, 1, 1); }
  } else if (p.kind === 'confetti') {
    const flip = Math.floor(p.age * p.fps + p.ph) % 3;
    c.fillStyle = p.col!;
    c.fillRect(tx, ty, flip === 0 ? 2 : 1, flip === 1 ? 2 : 1);
  } else if (p.kind === 'firefly') {
    const pulse = 0.5 + 0.5 * Math.sin(p.age * p.w * 2 + p.ph);
    const fade = Math.min(1, p.age / 0.6, (p.life - p.age) / 0.6);
    c.globalAlpha = fade * (0.25 + pulse * 0.35);
    c.fillStyle = '#ffd84a';
    c.fillRect(tx - 1, ty, 3, 1); c.fillRect(tx, ty - 1, 1, 3);
    c.globalAlpha = fade * (0.6 + pulse * 0.4);
    c.fillStyle = pulse > 0.6 ? '#fffbd0' : '#ffe878';
    c.fillRect(tx, ty, 1, 1);
  }
  c.globalAlpha = 1;
}
