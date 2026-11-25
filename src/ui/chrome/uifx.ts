// Particles for the interface (puffs, sparkles, hearts, swirling magic motes, spinning acorns, stars, snow,
// leaves, confetti, dust, wood chips, paper scraps, ink, embers, feathers, light motes, fireflies), drawn smooth
// and anti-aliased at device resolution on one overlay canvas above the UI, lit from the top left. [ui7]
// Anyone may call uiBurst(kind, x, y, n) with screen coordinates in CSS px.
// OWNED BY THE UI-CHROME BUILDER.
import { reducedMotion } from './swing.ts';
import { calm } from '../px/calm.js';

export type UiFxKind = 'puff' | 'sparkle' | 'hearts' | 'magic' | 'coins' | 'stars' | 'snow' | 'leaves' | 'confetti'
  | 'dust' | 'chips' | 'paper' | 'ink' | 'embers' | 'feathers' | 'acorns' | 'motes';

let B = 1; // device px per CSS px (set in fit)
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
// [ui4] v4: magic glows violet, sky and gold; confetti is properly festive
const MAGIC = ['#9c62b0', '#bc8acb', '#5ea8d9', '#b4dcf2', '#fff6d2', '#ecc03c'];
const CONFETTI = ['#ba4f57', '#ecc03c', '#46a066', '#3f8cc2', '#d06e70', '#804596', '#fff6d2', '#e8a830'];
const fr = (base: string, n: number) => Array.from({ length: n }, (_, i) => `${base}_${i}`);
const g8 = (a: string[]) => a.map((c) => calm(c));
const DUST = g8(['#d8cba9', '#c9b78d', '#e6dcc2', '#b5a27c']);
const CHIPS = g8(['#9c7a56', '#bf9d74', '#6f553d', '#d8bf98']);
const PAPERS = g8(['#f4eedd', '#eae0c8', '#dccfb0', '#e9e2d0']);
const INKS = g8(['#2e2b24', '#3b3a40', '#46596a']);
const EMBERS = g8(['#f1d39a', '#e7b98b', '#dcb072', '#fff2c9']);
const FEATHERS = g8(['#a87652', '#d9bf93', '#8a5a3c', '#f1e6cc']);
const MOTES = g8(['#f4eedd', '#f1d39a', '#d3e0dc']);

function ensure() {
  if (cv || typeof document === 'undefined') return;
  cv = document.createElement('canvas');
  cv.className = 'hh-uifx';
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: '70', pointerEvents: 'none' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
  fit();
  addEventListener('resize', fit);
}
function fit() {
  if (!cv) return;
  B = Math.min(2, Math.max(1, devicePixelRatio || 1));
  W = Math.ceil(innerWidth); H = Math.ceil(innerHeight);
  cv.width = Math.round(W * B); cv.height = Math.round(H * B);
  cv.style.width = `${W}px`; cv.style.height = `${H}px`;
}
function start() {
  ensure();
  if (!raf) { last = 0; raf = requestAnimationFrame(step); }
}

function spawn(kind: UiFxKind, x: number, y: number): P {
  const base: P = { kind, x, y, vx: 0, vy: 0, g: 0, drag: 0, life: 1, age: 0, fps: 10, f0: Math.floor(Math.random() * 4), ph: Math.random() * 6.28, ox: x, oy: y, r: 0, w: 0 };
  const a = Math.random() * Math.PI * 2;
  switch (kind) {
    case 'puff': { const s = R(70, 150); return { ...base, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 25, drag: 3.6, g: -14, life: R(0.55, 0.8), frames: fr('fx_puff', 6), fps: 0, f0: 0 }; }
    case 'sparkle': { const s = R(70, 190); return { ...base, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, drag: 3.5, g: 40, life: R(0.55, 0.95), frames: fr('fx_spark', 4), fps: 12 }; }
    case 'hearts': return { ...base, vx: R(-70, 70), vy: R(-130, -60), drag: 1.2, g: -20, life: R(1, 1.5), frames: fr('fx_heart', 2), fps: 4 };
    case 'magic': return { ...base, vx: 0, vy: R(-60, -20), drag: 0, g: -15, life: R(0.9, 1.5), r: R(6, 18), w: R(5, 9) * (Math.random() < 0.5 ? -1 : 1), col: pick(MAGIC), trail: [] };
    case 'coins': return { ...base, vx: R(-120, 120), vy: R(-300, -160), drag: 0.6, g: 620, life: R(0.9, 1.3), frames: fr('fx_acorn', 4), fps: R(10, 16) };
    case 'stars': { const s = R(90, 220); return { ...base, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, drag: 2.2, g: 90, life: R(0.8, 1.2), frames: fr('fx_star', 3), fps: 10 }; }
    case 'snow': return { ...base, x: x + R(-60, 60), vx: R(-20, 20), vy: R(15, 50), drag: 0.3, g: 6, life: R(1.6, 2.6), frames: fr('fx_snow', 2), fps: 3 };
    case 'leaves': return { ...base, vx: R(-90, 90), vy: R(-140, -40), drag: 1.4, g: 120, life: R(1.4, 2.2), frames: fr(pick(['fx_leaf', 'fx_leafo', 'fx_leafr']), 4), fps: R(6, 10) };
    case 'confetti': return { ...base, vx: R(-160, 160), vy: R(-360, -180), drag: 1.6, g: 520, life: R(1.2, 1.9), col: pick(CONFETTI), fps: R(8, 16) };
    // [ui3] hand-made bits: dust, wood chips, paper scraps, ink, embers, feathers, bouncing acorns, light motes
    case 'dust': { const s = R(30, 90); return { ...base, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.5 - 10, drag: 3, g: -8, life: R(0.45, 0.9), col: pick(DUST), w: Math.random() < 0.3 ? 2 : 1 }; }
    case 'chips': return { ...base, vx: R(-110, 110), vy: R(-230, -110), drag: 0.8, g: 700, life: R(0.7, 1.1), col: pick(CHIPS), fps: R(10, 18), oy: y + R(18, 34) };
    case 'paper': return { ...base, vx: R(-90, 90), vy: R(-170, -70), drag: 1.8, g: 160, life: R(1.1, 1.8), col: pick(PAPERS), fps: R(5, 9) };
    case 'ink': return { ...base, vx: R(-140, 140), vy: R(-180, -40), drag: 2.4, g: 420, life: R(0.6, 1), col: pick(INKS), oy: y + R(6, 22), w: 0 };
    case 'embers': return { ...base, x: x + R(-14, 14), vx: R(-20, 20), vy: R(-90, -40), drag: 0.6, g: -30, life: R(0.8, 1.5), col: pick(EMBERS) };
    case 'feathers': return { ...base, vx: R(-60, 60), vy: R(-110, -40), drag: 2.2, g: 60, life: R(1.6, 2.4), col: pick(FEATHERS), fps: 3 };
    case 'acorns': return { ...base, vx: R(-120, 120), vy: R(-300, -170), drag: 0.4, g: 900, life: R(1.1, 1.5), frames: fr('fx_acorn', 4), fps: R(10, 16), oy: y + R(24, 44) };
    case 'motes': return { ...base, x: x + R(-60, 60), y: y + R(-40, 40), vx: R(-6, 6), vy: R(-14, -4), drag: 0, g: 0, life: R(1.4, 2.4), col: pick(MOTES) };
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
  if (innerWidth > W + 1 || innerHeight > H + 1) fit();
  // ambient fireflies
  const flies = parts.reduce((n, p) => n + (p.kind === 'firefly' ? 1 : 0), 0);
  if (ambientOn && flies < 7 && Math.random() < dt * 2) {
    const b = ambientBox;
    parts.push({ kind: 'firefly', x: R(b.x, b.x + b.w), y: R(b.y, b.y + b.h), vx: R(-8, 8), vy: R(-6, 6), g: 0, drag: 0, life: R(5, 9), age: 0, fps: 0, f0: 0, ph: Math.random() * 6.28, ox: 0, oy: 0, r: 0, w: R(1.5, 3) });
  }
  ctx.setTransform(B, 0, 0, B, 0, 0);
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
    p.ph += p.w * dt; p.r += dt * 26;
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
  if (p.kind === 'snow' || p.kind === 'leaves' || p.kind === 'paper' || p.kind === 'feathers') p.vx += Math.sin(p.age * (p.kind === 'feathers' ? 2 : 3) + p.ph) * (p.kind === 'feathers' ? 70 : 40) * dt;
  if (p.kind === 'motes') { p.vx += Math.sin(p.age * 1.3 + p.ph) * 6 * dt; }
  // chips, ink and acorns land on an invisible floor below where they started and bounce (ink just splats)
  if ((p.kind === 'chips' || p.kind === 'acorns' || p.kind === 'ink') && p.y + p.vy * dt > p.oy && p.vy > 0) {
    if (p.kind === 'ink') { p.vx = 0; p.vy = 0; p.g = 0; p.w = 1; p.y = p.oy; return; }
    p.vy *= -0.38; p.vx *= 0.6; if (Math.abs(p.vy) < 40) { p.vy = 0; p.g = 0; p.vx *= 0.5; }
  }
  if (p.kind === 'hearts') p.x += Math.sin(p.age * 5 + p.ph) * 18 * dt;
  p.x += p.vx * dt; p.y += p.vy * dt;
}

const TAU = Math.PI * 2;
/** a soft round glow */
function glowDot(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a = 1) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.globalAlpha *= a; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
/** a four-point glint */
function glint(c: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number, col: string) {
  c.save(); c.translate(x, y); c.rotate(rot);
  glowDot(c, 0, 0, r * 0.8, 'rgba(255,236,170,.7)');
  c.globalAlpha = Math.min(1, c.globalAlpha * 1.6);
  c.fillStyle = col;
  for (const a of [0, Math.PI / 2]) { c.rotate(a); c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * 0.14, r, 0); c.quadraticCurveTo(0, r * 0.14, -r, 0); c.fill(); }
  c.restore();
}
function heart(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const g = c.createLinearGradient(-6, -6, 6, 6); g.addColorStop(0, '#ff8a96'); g.addColorStop(0.5, '#e0405a'); g.addColorStop(1, '#a01c34');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, 5); c.bezierCurveTo(-8, -1, -5, -8, 0, -3.5); c.bezierCurveTo(5, -8, 8, -1, 0, 5); c.fill();
  c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(-2.6, -2.6, 1.3, 0.8, -0.6, 0, TAU); c.fill();
  c.restore();
}
function acorn(c: CanvasRenderingContext2D, x: number, y: number, rot: number, s = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  let g = c.createLinearGradient(-4, -2, 4, 6); g.addColorStop(0, '#e0a050'); g.addColorStop(1, '#8a4a1c');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 1.6, 3.6, 4.6, 0, 0, TAU); c.fill();
  g = c.createLinearGradient(0, -5, 0, 0); g.addColorStop(0, '#9a7448'); g.addColorStop(1, '#5a3a1c');
  c.fillStyle = g; c.beginPath(); c.ellipse(0, -1.4, 4.4, 2.6, 0, Math.PI, TAU); c.lineTo(4.4, -0.6); c.lineTo(-4.4, -0.6); c.fill();
  c.strokeStyle = '#4a2e14'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -3.6); c.lineTo(0.6, -5.4); c.stroke();
  c.fillStyle = 'rgba(255,240,210,.55)'; c.beginPath(); c.ellipse(-1.4, 1, 0.9, 1.6, 0.3, 0, TAU); c.fill();
  c.restore();
}
function leafShape(c: CanvasRenderingContext2D, x: number, y: number, rot: number, col: string, s = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.fillStyle = col; c.beginPath(); c.moveTo(-6, 0); c.quadraticCurveTo(0, -4.2, 6, 0); c.quadraticCurveTo(0, 4.2, -6, 0); c.fill();
  c.strokeStyle = 'rgba(40,30,10,.35)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(-6, 0); c.lineTo(5, 0); c.stroke();
  c.restore();
}
const LEAF = ['#6aa63a', '#c98a2a', '#b8452c', '#8ab848'];

function draw(c: CanvasRenderingContext2D, p: P) {
  const k = p.age / p.life;
  const fade = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
  c.globalAlpha = fade;
  const x = p.x, y = p.y, spin = p.ph + p.age * (p.fps || 6);
  switch (p.kind) {
    case 'puff': {
      const r = 6 + k * 14;
      c.globalAlpha = fade * 0.7;
      for (let i = 0; i < 3; i++) glowDot(c, x + Math.cos(p.ph + i * 2.1) * r * 0.4, y + Math.sin(p.ph + i * 2.1) * r * 0.3, r, 'rgba(255,250,240,.9)');
      break;
    }
    case 'sparkle': glint(c, x, y, 5 + 3 * Math.sin(p.age * 14 + p.ph), spin * 0.3, '#fffbe8'); break;
    case 'stars': glint(c, x, y, 7, spin * 0.2, '#fff0b8'); break;
    case 'hearts': heart(c, x, y, 1.3); break;
    case 'magic': {
      p.trail!.forEach(([tx, ty], i) => { c.globalAlpha = fade * (0.5 - i * 0.1); glowDot(c, tx, ty, 3, p.col!); });
      c.globalAlpha = fade;
      glowDot(c, x, y, 6, p.col!);
      c.globalAlpha = fade; c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(x, y, 1.2, 0, TAU); c.fill();
      break;
    }
    case 'coins': case 'acorns': acorn(c, x, y, spin * 0.6, 1.3); break;
    case 'snow': glowDot(c, x, y, 3.2, 'rgba(255,255,255,.95)'); break;
    case 'leaves': leafShape(c, x, y, spin * 0.5, LEAF[Math.floor(p.ph * 10) % LEAF.length], 1.1); break;
    case 'confetti': {
      c.save(); c.translate(x, y); c.rotate(p.ph + p.age * 3); c.scale(1, Math.cos(p.age * p.fps + p.ph));
      c.fillStyle = p.col!; c.fillRect(-3.5, -2, 7, 4);
      c.restore(); break;
    }
    case 'dust': case 'motes': {
      const tw = p.kind === 'motes' ? 0.6 + 0.4 * Math.sin(p.age * 6 + p.ph) : 0.8;
      glowDot(c, x, y, p.kind === 'motes' ? 4 : 2.2 + (p.w || 1), p.col!, tw);
      break;
    }
    case 'chips': {
      c.save(); c.translate(x, y); c.rotate(spin);
      const g = c.createLinearGradient(-3, -1, 3, 1); g.addColorStop(0, '#d8b07c'); g.addColorStop(1, p.col!);
      c.fillStyle = g; c.beginPath(); c.moveTo(-3.5, -1); c.lineTo(3, -1.6); c.lineTo(3.5, 0.8); c.lineTo(-3, 1.2); c.fill();
      c.restore(); break;
    }
    case 'paper': {
      c.save(); c.translate(x, y); c.rotate(spin * 0.5); c.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(p.age * 4 + p.ph)));
      c.fillStyle = p.col!; c.fillRect(-4, -3, 8, 6);
      c.strokeStyle = 'rgba(120,90,50,.35)'; c.lineWidth = 0.5; c.strokeRect(-4, -3, 8, 6);
      c.restore(); break;
    }
    case 'ink': {
      c.fillStyle = p.col!;
      if (p.w) { c.beginPath(); c.ellipse(x, y, 3.2, 1.3, 0, 0, TAU); c.fill(); }
      else { c.beginPath(); c.ellipse(x, y, 1.4, 2.2, 0, 0, TAU); c.fill(); }
      break;
    }
    case 'embers': glowDot(c, x, y, 4, Math.floor(p.age * 14 + p.ph) % 2 ? p.col! : EMBERS[3]); break;
    case 'feathers': {
      c.save(); c.translate(x, y); c.rotate(Math.sin(p.age * 2 + p.ph) * 0.8);
      const g = c.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, p.col!); g.addColorStop(1, FEATHERS[2]);
      c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 2.6, 7, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(0, -7); c.lineTo(0, 8); c.stroke();
      c.restore(); break;
    }
    case 'firefly': {
      const pulse = 0.5 + 0.5 * Math.sin(p.age * p.w * 2 + p.ph);
      const f2 = Math.min(1, p.age / 0.6, (p.life - p.age) / 0.6);
      c.globalAlpha = f2 * (0.3 + pulse * 0.5);
      glowDot(c, x, y, 7, 'rgba(240,230,140,.8)');
      c.globalAlpha = f2 * (0.7 + pulse * 0.3);
      c.fillStyle = '#fffbe0'; c.beginPath(); c.arc(x, y, 1.3, 0, TAU); c.fill();
      break;
    }
  }
  c.globalAlpha = 1;
}

/** Dev/screenshot helper: run the particle simulation forward by `sec` seconds right now. */
export function uiAdvance(sec: number) {
  for (let t = 0; t < sec; t += 1 / 60) for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += 1 / 60; if (p.age >= p.life) parts.splice(i, 1); else move(p, 1 / 60); }
  start();
}

// ------------------------------------------------------------------ [ui3] particles on every interaction
let auto = false;
/**
 * Once: small 2D pixel bursts on every press, toggle, slider drag, tab change, sheet, dialog and toast across
 * the whole interface (delegated listeners; screens can still throw their own bigger bursts).
 */
export function installUiFxAuto() {
  if (auto || typeof document === 'undefined') return;
  auto = true;
  let lastSlide = 0;
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Element | null;
    const el = t?.closest?.('button, [role="button"], [role="switch"], a, label, .tag, .seg button, input[type="range"]');
    if (!el) return;
    const x = e.clientX, y = e.clientY;
    if (el.matches('input[type="range"]')) { uiBurst('dust', x, y, 3); return; }
    if (el.matches('[role="switch"], .toggle')) { uiBurst('chips', x, y, 5); uiBurst('dust', x, y, 3); return; }
    if (el.matches('.tag, .seg button, .tab, [role="tab"]')) { uiBurst('paper', x, y, 3); uiBurst('dust', x, y, 2); return; }
    if (el.matches('.icon-btn')) { uiBurst('dust', x, y, 5); return; }
    if (el.matches('.btn.pillow.honey, .hh-btn-gold')) { uiBurst('dust', x, y, 4); uiBurst('motes', x, y - 10, 3); return; }
    if (el.matches('.btn.pillow, .btn.soft, .btn')) { uiBurst('dust', x, y, 5); uiBurst('chips', x, y, 2); return; }
    uiBurst('dust', x, y, 3);
  }, { capture: true, passive: true });
  document.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement | null;
    if (!t || t.type !== 'range') return;
    const now = performance.now();
    if (now - lastSlide < 90) return;
    lastSlide = now;
    const r = t.getBoundingClientRect(), k = (+t.value - +(t.min || 0)) / ((+(t.max || 100) - +(t.min || 0)) || 1);
    uiBurst('dust', r.left + r.width * k, r.top + r.height / 2, 2);
  }, { capture: true, passive: true });
  // sheets, dialogs and toasts arriving: paper scraps and dust where they land
  const mo = new MutationObserver((recs) => {
    for (const rec of recs) for (const n of rec.addedNodes) {
      if (!(n instanceof HTMLElement)) continue;
      const hit = n.matches('.sheet, .modal-back, .hh-toast, .lvup, .bp-back') ? n : null;
      if (!hit) continue;
      requestAnimationFrame(() => {
        const box = (hit.matches('.modal-back') ? hit.querySelector('.modal') : hit) as HTMLElement | null;
        if (!box) return;
        const r = box.getBoundingClientRect();
        if (hit.matches('.hh-toast')) { uiBurst('paper', r.left + 10, r.top + r.height / 2, 4); return; }
        if (hit.matches('.lvup')) return;
        uiBurst('paper', r.left + r.width / 2, r.top + 8, 5);
        uiBurst('dust', r.left + 12, r.top + 12, 4); uiBurst('dust', r.right - 12, r.top + 12, 4);
      });
    }
  });
  const root = document.getElementById('ui') ?? document.body;
  mo.observe(root, { childList: true, subtree: true });
}
