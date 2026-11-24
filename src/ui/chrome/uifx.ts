// 2D pixel-art particles for the interface, in the calm palette (puffs, sparkles, hearts, swirling magic motes,
// spinning acorns, stars, snow, leaves, confetti), drawn on one overlay canvas above the UI.
// One canvas texel is 2 CSS px, so particles share the chunky pixel grid of the sprites.
// Anyone may call uiBurst(kind, x, y, n) with screen coordinates in CSS px.
// OWNED BY THE UI-CHROME BUILDER.
import { spriteCanvas } from '../px/sprites.js';
import '../px/chromeart.js';
import { reducedMotion } from './swing.ts';
import { calm } from '../px/calm.js';

export type UiFxKind = 'puff' | 'sparkle' | 'hearts' | 'magic' | 'coins' | 'stars' | 'snow' | 'leaves' | 'confetti'
  | 'dust' | 'chips' | 'paper' | 'ink' | 'embers' | 'feathers' | 'acorns' | 'motes';

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
const MAGIC = ['#b4a9c9', '#d3cce0', '#aec8cc', '#f4eedd', '#f1d39a', '#d9aca4'].map((c) => calm(c));
const CONFETTI = ['#c0866a', '#f1d39a', '#86a06a', '#86a9b0', '#d9aca4', '#b4a9c9', '#f4eedd', '#dcb072'].map((c) => calm(c));
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
    p.trail!.forEach(([x, y], i) => { c.globalAlpha = 0.75 - i * 0.16; c.fillStyle = i < 2 ? p.col! : '#617f8c'; c.fillRect(Math.round(x / B), Math.round(y / B), 1, 1); });
    c.globalAlpha = (k > 0.8 ? 0.5 : 1) * 0.6;
    c.fillStyle = p.col!;
    c.fillRect(tx - 1, ty, 3, 1); c.fillRect(tx, ty - 1, 1, 3);
    c.globalAlpha = k > 0.8 ? 0.5 : 1;
    c.fillStyle = Math.floor(p.age * 12 + p.w) % 3 === 0 ? '#f4eedd' : p.col!;
    c.fillRect(tx, ty, 1, 1);
  } else if (p.kind === 'confetti') {
    const flip = Math.floor(p.age * p.fps + p.ph) % 4;
    c.fillStyle = p.col!;
    if (flip === 0) c.fillRect(tx - 1, ty, 3, 2);
    else if (flip === 1) c.fillRect(tx, ty - 1, 2, 3);
    else if (flip === 2) { c.fillRect(tx - 1, ty, 3, 1); c.globalAlpha *= 0.5; c.fillStyle = '#2e2b24'; c.fillRect(tx - 1, ty + 1, 3, 1); }
    else c.fillRect(tx, ty - 1, 1, 3);
  } else if (p.kind === 'dust' || p.kind === 'motes') {
    c.fillStyle = p.col!;
    c.globalAlpha *= p.kind === 'motes' ? (Math.floor(p.age * 6 + p.ph) % 3 === 0 ? 0.45 : 0.85) : 0.8;
    c.fillRect(tx, ty, p.w || 1, p.w || 1);
  } else if (p.kind === 'chips') {
    const f = Math.floor(p.age * p.fps + p.ph) % 3;
    c.fillStyle = p.col!;
    if (f === 0) c.fillRect(tx - 1, ty, 3, 1); else if (f === 1) c.fillRect(tx, ty - 1, 1, 2); else c.fillRect(tx, ty, 2, 1);
    c.fillStyle = '#3a2f25'; c.globalAlpha *= 0.5; c.fillRect(tx + 1, ty + (f === 1 ? 1 : 1), 1, 1);
  } else if (p.kind === 'paper') {
    const f = Math.floor(p.age * p.fps + p.ph) % 4;
    c.fillStyle = p.col!;
    if (f === 0) c.fillRect(tx - 1, ty, 3, 2); else if (f === 1) c.fillRect(tx - 1, ty, 2, 2); else if (f === 2) c.fillRect(tx, ty, 1, 2); else c.fillRect(tx - 1, ty, 2, 1);
    c.fillStyle = '#b5a27c'; c.fillRect(tx - 1 + (f === 0 ? 2 : 0), ty + 1, 1, 1);
  } else if (p.kind === 'ink') {
    c.fillStyle = p.col!;
    if (p.w) { c.fillRect(tx - 1, ty, 3, 1); c.fillRect(tx, ty - 1, 1, 1); if (p.ph > 3) c.fillRect(tx + 2, ty - 1, 1, 1); }
    else c.fillRect(tx, ty, 1, 2);
  } else if (p.kind === 'embers') {
    c.fillStyle = Math.floor(p.age * 14 + p.ph) % 2 ? p.col! : EMBERS[3];
    c.fillRect(tx, ty, 1, 1);
    if (p.age < 0.3) { c.globalAlpha *= 0.4; c.fillRect(tx, ty + 1, 1, 1); }
  } else if (p.kind === 'feathers') {
    const f = Math.floor(p.age * p.fps + p.ph) % 2;
    c.fillStyle = p.col!;
    // a little barred feather: quill and vane, tilting as it drifts
    if (f === 0) { c.fillRect(tx - 2, ty, 4, 1); c.fillRect(tx - 1, ty - 1, 3, 1); c.fillStyle = FEATHERS[2]; c.fillRect(tx, ty, 1, 1); c.fillRect(tx + 2, ty + 1, 1, 1); }
    else { c.fillRect(tx - 1, ty - 1, 1, 3); c.fillRect(tx, ty - 2, 1, 3); c.fillStyle = FEATHERS[2]; c.fillRect(tx, ty - 1, 1, 1); c.fillRect(tx - 1, ty + 2, 1, 1); }
  } else if (p.kind === 'firefly') {
    const pulse = 0.5 + 0.5 * Math.sin(p.age * p.w * 2 + p.ph);
    const fade = Math.min(1, p.age / 0.6, (p.life - p.age) / 0.6);
    c.globalAlpha = fade * (0.15 + pulse * 0.3);
    c.fillStyle = '#c8a764';
    c.fillRect(tx - 1, ty, 3, 1); c.fillRect(tx, ty - 1, 1, 3);
    c.globalAlpha = fade * (0.6 + pulse * 0.4);
    c.fillStyle = pulse > 0.6 ? '#f4eedd' : '#f1d39a';
    c.fillRect(tx, ty, 1, 1);
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
