// Particles for the interface: detailed pixel-art sprites (src/ui/fx/pixel.ts) on one overlay canvas above the UI,
// at the game's art-pixel size (src/gfx/artpx.ts) and snapped to its grid, so they read like the icons: leaves and
// petals that tumble through a dozen frames, acorns that spin and bounce, curled wood shavings, torn paper, ink drops
// that splat, downy feathers, gold-leaf flakes that flash as they turn, snow crystals; and lights (glints, golden
// motes, embers, fireflies) added on top unoutlined. Nothing is drawn over the text the player reads (headings,
// titles, toasts, speech bubbles, dialogs): those are cut out of the layer every frame. [fx10]
//   uiBurst(kind, x, y, n)  /  uiBurstAt(el, kind, n)  /  uiFx.burst(kind, el | {x, y}, n)
// OWNED BY THE FX BUILDER.
import { reducedMotion } from './swing.ts';
import { artPx } from '../../gfx/artpx.ts';
import { frameCount, sprite, type PixKind } from '../fx/pixel.ts';

export type UiFxKind = 'puff' | 'sparkle' | 'hearts' | 'magic' | 'coins' | 'stars' | 'snow' | 'leaves' | 'confetti'
  | 'dust' | 'chips' | 'paper' | 'ink' | 'embers' | 'feathers' | 'acorns' | 'motes'
  | 'glints' | 'glintsCool' | 'flakes' | 'petals' | 'motesCool' | 'shavings';

interface P {
  spr: PixKind; glow: boolean; x: number; y: number; vx: number; vy: number; g: number; drag: number;
  life: number; age: number; fps: number; f0: number; ph: number; sway: number;
  /** a floor (CSS px) to bounce or land on, and what happens there */
  floor?: number; onFloor?: 'bounce' | 'splat' | 'rest';
  trail?: [number, number][]; swirl?: { ox: number; oy: number; r: number; w: number; vy: number };
  fire?: boolean; fadeIn: number;
}
const parts: P[] = [];
let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
let raf = 0, last = 0, W = 0, H = 0, B = 1;
let ambientOn = false, ambientBox = { x: 0, y: 0, w: 0, h: 0 };
type Win = Window & { __chromeT?: number };

const R = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const CAP = 360;

/** what particles and light keep off: the text the player reads */
const SHIELD = '.lvup-title, .lvup-medal b, .lvup-card h3, .lvup-unlock span, .hh-toast, .hh-bubble, .lg-bubble, .bubble, .modal h2, .modal .muted, .sheet h2, .sheet h3, .hh-ticket, .hh-name, .hh-num, .hh-rank, .hh-toollabel, .hh-nav, h1, [data-fx-shield]';
/** Screen rects of the text that light and particles keep off (also used by the light of src/ui/fx/moment.ts). */
export function shieldRects(): DOMRect[] {
  const out: DOMRect[] = [];
  if (typeof document === 'undefined') return out;
  document.querySelectorAll(SHIELD).forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.width * r.height < innerWidth * innerHeight * 0.5) out.push(r);
  });
  return out;
}

function ensure() {
  if (cv || typeof document === 'undefined') return;
  cv = document.createElement('canvas');
  cv.className = 'hh-uifx';
  cv.setAttribute('aria-hidden', 'true');
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: '70', pointerEvents: 'none', imageRendering: 'pixelated' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
  fit();
  addEventListener('resize', fit);
}
function fit() {
  if (!cv) return;
  B = Math.min(3, Math.max(1, devicePixelRatio || 1));
  W = Math.ceil(innerWidth); H = Math.ceil(innerHeight);
  cv.width = Math.round(W * B); cv.height = Math.round(H * B);
  cv.style.width = `${W}px`; cv.style.height = `${H}px`;
}
function start() {
  ensure();
  if (!raf) { last = 0; raf = requestAnimationFrame(step); }
}

function base(spr: PixKind, x: number, y: number, glow = false): P {
  return { spr, glow, x, y, vx: 0, vy: 0, g: 0, drag: 0, life: 1, age: 0, fps: 10, f0: Math.floor(Math.random() * 12), ph: Math.random() * 6.28, sway: 0, fadeIn: 0.06 };
}
function spawn(kind: UiFxKind, x: number, y: number, i: number): P[] {
  const a = Math.random() * Math.PI * 2, s = (lo: number, hi: number) => R(lo, hi);
  switch (kind) {
    case 'puff': { const p = base('puff', x, y); const v = s(40, 90); return [{ ...p, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 18, drag: 3.2, g: -10, life: s(0.6, 0.85), fps: 0, f0: 0 }]; }
    case 'sparkle': case 'glints': case 'glintsCool': case 'stars': {
      const p = base(kind === 'glintsCool' ? 'glintCool' : 'glint', x, y, true), v = kind === 'stars' ? s(90, 200) : s(40, 140);
      return [{ ...p, x: x + R(-8, 8), y: y + R(-8, 8), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, drag: 3, g: 30, life: s(0.55, 0.9), fps: s(8, 11), f0: 0 }];
    }
    case 'hearts': return i % 3 === 2
      ? [{ ...base('moteRose', x, y, true), x: x + R(-20, 20), vx: R(-12, 12), vy: R(-60, -30), drag: 0.6, g: -6, life: s(1.2, 1.7), fps: 5, sway: 10 }]
      : [{ ...base(i % 2 ? 'petal' : 'petalWhite', x, y), vx: R(-80, 80), vy: R(-150, -70), drag: 1.6, g: 120, life: s(1.4, 2), fps: s(9, 14), sway: 36 }];
    case 'petals': return [{ ...base(Math.random() < 0.65 ? 'petal' : 'petalWhite', x, y), x: x + R(-40, 40), vx: R(-40, 40), vy: R(-90, -20), drag: 1.8, g: 70, life: s(1.8, 2.6), fps: s(8, 13), sway: 40 }];
    case 'magic': return [{ ...base(pick(['moteViolet', 'moteCool', 'mote'] as PixKind[]), x, y, true), life: s(0.9, 1.5), fps: 6, trail: [], swirl: { ox: x, oy: y, r: s(6, 16), w: s(4, 8) * (Math.random() < 0.5 ? -1 : 1), vy: s(-60, -25) } }];
    case 'coins': case 'acorns': return [{ ...base('acorn', x, y), vx: R(-120, 120), vy: R(-300, -170), drag: 0.4, g: 900, life: s(1.2, 1.6), fps: s(12, 18), floor: y + R(24, 44), onFloor: 'bounce' }];
    case 'snow': return [{ ...base('snow', x, y, true), x: x + R(-60, 60), vx: R(-16, 16), vy: R(12, 40), drag: 0.3, g: 5, life: s(1.8, 2.8), fps: s(3, 6), sway: 18 }];
    case 'leaves': return [{ ...base(pick(['leaf', 'leafGold', 'leafRed', 'leafOak'] as PixKind[]), x, y), vx: R(-90, 90), vy: R(-150, -50), drag: 1.5, g: 110, life: s(1.6, 2.4), fps: s(10, 16), sway: 40 }];
    case 'confetti': case 'flakes': return kind === 'confetti' && i % 4 === 3
      ? [{ ...base('petal', x, y), vx: R(-150, 150), vy: R(-320, -160), drag: 1.8, g: 260, life: s(1.6, 2.2), fps: s(10, 14), sway: 30 }]
      : [{ ...base('flake', x, y), x: x + R(-90, 90), y: y + R(-40, 30), vx: R(-170, 170), vy: R(-300, -90), drag: 2.1, g: 200, life: s(1.7, 2.5), fps: s(8, 16), sway: 34 }];
    case 'dust': { const v = s(25, 80); return [{ ...base('dust', x, y), vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5 - 12, drag: 3, g: -6, life: s(0.45, 0.85), fps: 0 }]; }
    case 'chips': case 'shavings': return [{ ...base('shaving', x, y), vx: R(-110, 110), vy: R(-230, -110), drag: 0.8, g: 700, life: s(0.9, 1.3), fps: s(12, 20), floor: y + R(18, 34), onFloor: 'rest' }];
    case 'paper': return [{ ...base('paper', x, y), vx: R(-90, 90), vy: R(-170, -70), drag: 1.8, g: 150, life: s(1.2, 1.9), fps: s(7, 11), sway: 34 }];
    case 'ink': return [{ ...base('ink', x, y), vx: R(-130, 130), vy: R(-190, -60), drag: 2, g: 520, life: s(0.9, 1.3), fps: 0, f0: 0, floor: y + R(8, 26), onFloor: 'splat' }];
    case 'embers': return [{ ...base('ember', x, y, true), x: x + R(-14, 14), vx: R(-20, 20), vy: R(-90, -40), drag: 0.6, g: -30, life: s(0.8, 1.5), fps: s(10, 14), sway: 14, fire: true }];
    case 'feathers': return [{ ...base('feather', x, y), vx: R(-60, 60), vy: R(-110, -40), drag: 2.2, g: 60, life: s(1.8, 2.6), fps: s(5, 8), sway: 60 }];
    case 'motes': case 'motesCool': return [{ ...base(kind === 'motesCool' ? 'moteCool' : 'mote', x, y, true), x: x + R(-60, 60), y: y + R(-40, 40), vx: R(-8, 8), vy: R(-26, -6), life: s(1.4, 2.4), fps: s(3, 5), sway: 8, fadeIn: 0.35 }];
  }
}

/** Throw `n` particles of `kind` from a screen point (CSS px). */
export function uiBurst(kind: UiFxKind, x: number, y: number, n = 10): void {
  if (typeof document === 'undefined') return;
  if (reducedMotion()) n = Math.ceil(n / 3);
  if (parts.length + n > CAP) parts.splice(0, Math.min(parts.length, parts.length + n - CAP));
  for (let i = 0; i < n; i++) for (const p of spawn(kind, x, y, i)) parts.push(p);
  start();
}
/** Burst from the centre of an element. */
export function uiBurstAt(el: Element | null, kind: UiFxKind, n = 10) { if (!el) return; const r = el.getBoundingClientRect(); uiBurst(kind, r.left + r.width / 2, r.top + r.height / 2, n); }
/** The same, as one object: `uiFx.burst('leaves', el)` or `uiFx.burst('glints', { x, y }, 8)`. */
export const uiFx = {
  burst(kind: UiFxKind, at: Element | { x: number; y: number } | null, n = 10) { if (!at) return; if ('getBoundingClientRect' in at) uiBurstAt(at, kind, n); else uiBurst(kind, at.x, at.y, n); },
  ambient: (box: { x: number; y: number; w: number; h: number } | null) => uiAmbient(box),
};

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
  if (innerWidth > W + 1 || innerHeight > H + 1 || Math.min(3, Math.max(1, devicePixelRatio || 1)) !== B) fit();
  // ambient fireflies
  let flies = 0;
  for (const p of parts) if (p.spr === 'firefly') flies++;
  if (ambientOn && flies < 7 && Math.random() < dt * 2) {
    const b = ambientBox;
    parts.push({ ...base('firefly', R(b.x, b.x + b.w), R(b.y, b.y + b.h), true), vx: R(-8, 8), vy: R(-6, 6), life: R(5, 9), fps: R(2, 4), sway: 0, fadeIn: 0.8 });
  }
  const c = ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, cv.width, cv.height);
  c.imageSmoothingEnabled = false;
  const S = Math.max(1, Math.round(artPx() * B)); // device px per art pixel
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.age += dt;
    if (p.spr === 'firefly' && !ambientOn && p.life - p.age > 0.8) p.age = p.life - 0.8;
    if (p.age >= p.life) { parts.splice(i, 1); continue; }
    move(p, dt);
  }
  // objects, then lights: painted solid (so they read on a bright scene too), then added once more for their glow
  for (const p of parts) if (!p.glow) draw(c, p, S);
  for (const p of parts) if (p.glow) draw(c, p, S);
  c.globalCompositeOperation = 'lighter';
  for (const p of parts) if (p.glow) draw(c, p, S, 0.45);
  c.globalCompositeOperation = 'source-over';
  if (parts.length) {
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = 1; c.fillStyle = '#000';
    for (const r of shieldRects()) c.fillRect(Math.floor((r.left - 2) * B), Math.floor((r.top - 2) * B), Math.ceil((r.width + 4) * B), Math.ceil((r.height + 4) * B));
    c.globalCompositeOperation = 'source-over';
  }
  if (parts.length || ambientOn) raf = requestAnimationFrame(step);
}

function move(p: P, dt: number) {
  if (p.swirl) {
    // swirl around a rising centre, the orbit widening, a short trail behind
    const w = p.swirl;
    w.oy += w.vy * dt; w.vy -= 12 * dt; p.ph += w.w * dt; w.r += dt * 24;
    p.trail!.unshift([p.x, p.y]); if (p.trail!.length > 5) p.trail!.pop();
    p.x = w.ox + Math.cos(p.ph) * w.r; p.y = w.oy + Math.sin(p.ph) * w.r * 0.55;
    return;
  }
  if (p.spr === 'firefly') {
    p.ph += dt;
    p.vx += Math.sin(p.ph * 0.9 + p.f0) * 6 * dt; p.vy += Math.cos(p.ph * 1.3) * 5 * dt;
    p.vx *= 1 - dt * 0.3; p.vy *= 1 - dt * 0.3;
    p.x += p.vx * dt; p.y += p.vy * dt;
    return;
  }
  const k = Math.max(0, 1 - p.drag * dt);
  p.vx *= k; p.vy = p.vy * k + p.g * dt;
  if (p.sway) p.vx += Math.sin(p.age * 2.6 + p.ph) * p.sway * 2 * dt;
  if (p.floor !== undefined && p.vy > 0 && p.y + p.vy * dt > p.floor) {
    if (p.onFloor === 'splat') { p.spr = 'inkSplat'; p.vx = 0; p.vy = 0; p.g = 0; p.y = p.floor; p.fps = 14; p.f0 = 0; p.floor = undefined; p.life = Math.min(p.life, p.age + 0.9); p.sway = 0; return; }
    if (p.onFloor === 'rest') { p.vy = 0; p.g = 0; p.vx = 0; p.fps = 0; p.y = p.floor; p.floor = undefined; return; }
    p.vy *= -0.38; p.vx *= 0.6;
    if (Math.abs(p.vy) < 50) { p.vy = 0; p.g = 0; p.vx *= 0.5; p.fps = 0; p.floor = undefined; }
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
}

function draw(c: CanvasRenderingContext2D, p: P, S: number, gain = 1) {
  const k = p.age / p.life;
  let a = gain * Math.min(1, p.age / Math.max(0.01, p.fadeIn)) * (k > 0.62 ? 1 - (k - 0.62) / 0.38 : 1);
  const n = frameCount(p.spr);
  // splats play once and hold; everything else cycles
  let f = p.spr === 'inkSplat' ? Math.min(n - 1, Math.floor(p.age * p.fps * 0.3)) : Math.floor(p.f0 + p.age * p.fps) % n;
  if (p.spr === 'glint' || p.spr === 'glintCool' || p.spr === 'glintRose') f = Math.min(n - 1, Math.floor(k * n)); // one twinkle over its life
  if (p.spr === 'firefly') a *= 0.55 + 0.45 * Math.sin(p.age * 2.4 + p.f0);
  if (p.fire) a *= 0.8 + 0.2 * Math.sin(p.age * 30 + p.ph);
  if (a <= 0.02) return;
  const img = sprite(p.spr, f), w = img.width * S, h = img.height * S;
  // snap to the art-pixel grid
  const X = Math.round((p.x * B - w / 2) / S) * S, Y = Math.round((p.y * B - h / 2) / S) * S;
  c.globalAlpha = a;
  if (p.trail) p.trail.forEach(([tx, ty], i) => {
    c.globalAlpha = a * (0.45 - i * 0.08);
    c.fillStyle = '#ffe8b0';
    c.fillRect(Math.round(tx * B / S) * S, Math.round(ty * B / S) * S, S, S);
  });
  c.globalAlpha = a;
  if (p.spr === 'ink' && p.vy < 0) { c.save(); c.translate(X, Y + h); c.scale(1, -1); c.drawImage(img, 0, 0, w, h); c.restore(); }
  else c.drawImage(img, X, Y, w, h);
  c.globalAlpha = 1;
}

if (typeof window !== 'undefined') (window as unknown as { hhUiFx: unknown }).hhUiFx = { uiBurst, uiAdvance: (s: number) => uiAdvance(s), shieldRects, count: () => parts.length };

/** Dev/screenshot helper: run the particle simulation forward by `sec` seconds right now. */
export function uiAdvance(sec: number) {
  for (let t = 0; t < sec; t += 1 / 60) for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.age += 1 / 60; if (p.age >= p.life) parts.splice(i, 1); else move(p, 1 / 60); }
  start();
}

// ------------------------------------------------------------------ small bursts on every interaction
let auto = false;
/**
 * Once: small pixel bursts on every press, toggle, slider drag, tab change, sheet, dialog and toast across the whole
 * interface (delegated listeners; screens can still throw their own bigger bursts): wood dust, a curl of shaving, a
 * scrap of paper, a glint on the gold buttons.
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
    if (el.matches('[role="switch"], .toggle')) { uiBurst('chips', x, y, 2); uiBurst('dust', x, y, 3); return; }
    if (el.matches('.tag, .seg button, .tab, [role="tab"]')) { uiBurst('paper', x, y, 2); uiBurst('dust', x, y, 2); return; }
    if (el.matches('.icon-btn')) { uiBurst('dust', x, y, 5); return; }
    if (el.matches('.btn.pillow.honey, .hh-btn-gold')) { uiBurst('dust', x, y, 4); uiBurst('glints', x, y - 8, 2); return; }
    if (el.matches('.btn.pillow, .btn.soft, .btn')) { uiBurst('dust', x, y, 5); uiBurst('chips', x, y, 1); return; }
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
        if (hit.matches('.hh-toast') || hit.matches('.lvup')) return;
        uiBurst('dust', r.left + 12, r.top + 12, 4); uiBurst('dust', r.right - 12, r.top + 12, 4);
      });
    }
  });
  const root = document.getElementById('ui') ?? document.body;
  mo.observe(root, { childList: true, subtree: true });
}
