// Full-screen transitions, drawn smooth and anti-aliased at device resolution on one canvas, with real
// materials where they help (paper pages, oak blinds, velvet curtains, blueprint paper) [ui7]. `mid` runs while the screen is fully covered; the promise resolves
// when the screen is clear again.
//
//   iris       an iris closing on a point, a polished brass rim
//   dither     dusk pouring in diagonally (also 'fade')
//   leaves     a curtain of leaves falling down the screen (map, quests)
//   feathers   soft down feathers drifting over an oat-paper cover (breathing)
//   snow       a flurry of snow banks blowing in (the shop)
//   fireflies  dusk closes in from the edges while fireflies swirl (sleep things)
//   page       a page turning over, with a curled edge (the book)
//   blinds     wooden slats tilting shut row by row (settings)
//   mosaic     rounded moss and paper tiles popping in on a diagonal wave (quests)
//   branch     a leafy branch sweeping across, pulling dusk behind it (the map)
//   clock      a clock hand sweeping round, painting the dial as it goes (the clock)
//   curtain    two velvet curtains drawn on a brass rail (the dressing room)
//   blueprint  a blueprint unrolling (build mode)
//   stars      the night falling, stars and the moon (sleep)
//   sunrise    bands of dawn with a rising sun (the morning)
// Non-blocking flourishes: flourish('letterbox' | 'levelup' | 'sparkle').
//
// Wiring: installPanelTransitions() makes every change of `panel` (opening, closing, switching)
// play a transition picked by panelTransition(from, to). questionTransition() wipes one card (the
// interview), directorBlend() eases the 3D camera to a shot with letterbox bars.
import { sound } from '../../audio/sound.ts';
import { P } from '../../gfx/palette.ts';
import { phase } from '../../game/night.ts';
import { level, save } from '../../game/store.ts';
import type { CamShot, Scene } from '../../world/scene.ts';
import { panel, sceneRef, type Panel } from '../state.ts';
import { hash } from '../real/paint.ts';
import { texCanvas, type TexName } from '../real/tex.ts';
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
import { reducedMotion } from './swing.ts';
import { animate3D, hold3D, hide3D, is3D, preview3D, type Kind3D } from './trans3d.ts'; // realistic 3D kinds with motion blur

export type TransitionKind = 'iris' | 'dither' | 'fade' | 'leaves' | 'feathers' | 'snow' | 'fireflies' | 'page' | 'blinds' | 'mosaic' | 'branch' | 'clock' | 'curtain' | 'blueprint' | 'stars' | 'sunrise' | Kind3D;
export const TRANSITION_KINDS: TransitionKind[] = ['iris', 'dither', 'leaves', 'feathers', 'snow', 'fireflies', 'page', 'blinds', 'mosaic', 'branch', 'clock', 'curtain', 'blueprint', 'stars', 'sunrise', 'acorns', 'plumes', 'clouds', 'dream'];
export interface TransitionOpts {
  /** centre of the iris / clock / fireflies (CSS px); defaults to the middle of the screen */
  x?: number; y?: number;
  /** 1 = normal; 1.5 = faster */
  speed?: number;
  /** play it the other way round (pages turn back, the clock hand runs anticlockwise, curtains open the other way) */
  reverse?: boolean;
  /** limit to a rectangle of the screen (CSS px); used by questionTransition */
  rect?: { x: number; y: number; w: number; h: number };
}

// ------------------------------------------------------------------ the canvas

interface Item { x: number; y: number; off: number; ph: number; f: number; sp: number; th: number }
interface Run { kind: TransitionKind; W: number; H: number; k: number; cx: number; cy: number; items: Item[]; t0: number; rev: boolean; rect?: { x0: number; y0: number; x1: number; y1: number } }

let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
let busy = false;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.className = 'hh-trans';
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: '60', pointerEvents: 'none', display: 'none' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
}
const rnd = (i: number, k: number) => hash(i, k, 77);
function setup(kind: TransitionKind, o: TransitionOpts): Run {
  ensure();
  const k = Math.min(2, Math.max(1, devicePixelRatio || 1));
  const W = Math.ceil(innerWidth), H = Math.ceil(innerHeight);
  cv!.width = Math.round(W * k); cv!.height = Math.round(H * k);
  cv!.style.width = `${W}px`; cv!.style.height = `${H}px`;
  cv!.style.display = 'block';
  const r: Run = { kind, W, H, k, cx: o.x ?? W / 2, cy: o.y ?? H / 2, items: [], t0: 0, rev: !!o.reverse };
  if (o.rect) r.rect = { x0: o.rect.x, y0: o.rect.y, x1: o.rect.x + o.rect.w, y1: o.rect.y + o.rect.h };
  const n = kind === 'leaves' || kind === 'branch' ? Math.ceil(W / 18) * 2 + 24 : kind === 'feathers' ? 40 : kind === 'snow' ? 110 : kind === 'fireflies' ? 60 : kind === 'stars' ? 90 : 0;
  for (let i = 0; i < n; i++) r.items.push({ x: rnd(i, 1) * W, y: rnd(i, 2) * H, off: rnd(i, 6), ph: rnd(i, 3) * 6.28, f: i, sp: 0.5 + rnd(i, 4), th: rnd(i, 5) });
  return r;
}

// ------------------------------------------------------------------ smooth painters

const NIGHT = '#141a2c', NIGHT2 = '#222c48';
const css = (c: number, a = 1) => `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
const pats = new Map<string, CanvasPattern | null>();
/** a material tile as a canvas pattern, `size` CSS px per tile */
function pat(g: CanvasRenderingContext2D, name: TexName, size: number, tint?: string): CanvasPattern | string {
  const key = name + (tint ?? '');
  let p = pats.get(key);
  if (p === undefined) { const c = texCanvas(name, tint); p = c ? g.createPattern(c, 'repeat') : null; pats.set(key, p); }
  if (!p) return tint ?? '#d8c8a8';
  const c = texCanvas(name, tint)!;
  p.setTransform(new DOMMatrix().scale(size / c.width, size / c.width));
  return p;
}
function leaf(g: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, col: string) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const gr = g.createLinearGradient(0, -5, 0, 5); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,.35)');
  g.fillStyle = col; g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(0, -6, 8, 0); g.quadraticCurveTo(0, 6, -8, 0); g.fill();
  g.fillStyle = gr; g.globalAlpha *= 0.35; g.fill(); g.globalAlpha /= 0.35;
  g.strokeStyle = 'rgba(30,24,8,.4)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-8, 0); g.lineTo(7, 0); g.stroke();
  g.restore();
}
function glowDot(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
function star4(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  glowDot(g, x, y, r * 1.6, 'rgba(255,240,200,.5)');
  g.fillStyle = col;
  for (const a of [0, Math.PI / 2]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-r, 0); g.quadraticCurveTo(0, -r * 0.15, r, 0); g.quadraticCurveTo(0, r * 0.15, -r, 0); g.fill(); g.restore(); }
}
const LEAVES = ['#3f7a2e', '#5e9a34', '#7ab040', '#c98a2a', '#2e6a3a', '#a8b83c'];

/** Paint one frame. `phase` in: covering (p 0 to 1); out: uncovering (p 0 to 1). */
function paint(r: Run, phase: 'in' | 'out', p: number, t: number) {
  const g = ctx!, { W, H } = r;
  g.setTransform(r.k, 0, 0, r.k, 0, 0);
  g.clearRect(0, 0, W, H);
  g.save();
  if (r.rect) { g.beginPath(); g.rect(r.rect.x0, r.rect.y0, r.rect.x1 - r.rect.x0, r.rect.y1 - r.rect.y0); g.clip(); }
  const e = smooth(p), cov = phase === 'in' ? e : 1 - e;
  const X0 = r.rect?.x0 ?? 0, Y0 = r.rect?.y0 ?? 0, RW = r.rect ? r.rect.x1 - r.rect.x0 : W, RH = r.rect ? r.rect.y1 - r.rect.y0 : H;
  const night = (a: number) => { const gr = g.createLinearGradient(0, Y0, 0, Y0 + RH); gr.addColorStop(0, `rgba(20,26,44,${a})`); gr.addColorStop(1, `rgba(34,44,72,${a})`); return gr; };
  switch (r.kind) {
    case 'fade':
    case 'dither': {
      // dusk pours in from the top-left corner (bottom-right when reversed)
      const gr = r.rev ? g.createLinearGradient(X0 + RW, Y0 + RH, X0, Y0) : g.createLinearGradient(X0, Y0, X0 + RW, Y0 + RH);
      const a = cov * 1.6;
      gr.addColorStop(0, `rgba(20,26,44,${clamp(a, 0, 1)})`); gr.addColorStop(1, `rgba(20,26,44,${clamp(a - 0.6, 0, 1)})`);
      g.fillStyle = gr; g.fillRect(X0, Y0, RW, RH);
      break;
    }
    case 'iris': {
      const R = (1 - cov) * (Math.hypot(Math.max(r.cx - X0, X0 + RW - r.cx), Math.max(r.cy - Y0, Y0 + RH - r.cy)) + 8);
      g.fillStyle = night(1);
      g.beginPath(); g.rect(X0, Y0, RW, RH); g.arc(r.cx, r.cy, Math.max(0, R), 0, Math.PI * 2, true); g.fill('evenodd');
      if (cov > 0.02 && cov < 0.98) {
        const gr = g.createRadialGradient(r.cx - R * 0.2, r.cy - R * 0.3, R * 0.6, r.cx, r.cy, R + 7);
        gr.addColorStop(0, '#fff0b8'); gr.addColorStop(0.5, '#d8a040'); gr.addColorStop(1, '#6a4410');
        g.strokeStyle = gr; g.lineWidth = 6; g.beginPath(); g.arc(r.cx, r.cy, R + 3, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.arc(r.cx, r.cy, R + 6.5, 0, Math.PI * 2); g.stroke();
      }
      break;
    }
    case 'leaves':
    case 'branch': {
      // a curtain of leaves sweeping down (leaves) or across (branch), dusk behind it
      const across = r.kind === 'branch';
      const span = (across ? RW : RH) + 80, edge = e * span - 40;
      g.fillStyle = across ? (() => { const gr = g.createLinearGradient(X0, 0, X0 + RW, 0); gr.addColorStop(0, '#16241c'); gr.addColorStop(1, '#1e3426'); return gr; })() : (() => { const gr = g.createLinearGradient(0, Y0, 0, Y0 + RH); gr.addColorStop(0, '#16241c'); gr.addColorStop(1, '#22402a'); return gr; })();
      if (phase === 'in') { if (across) g.fillRect(X0, Y0, edge, RH); else g.fillRect(X0, Y0, RW, edge); }
      else { if (across) g.fillRect(X0 + edge, Y0, RW - edge, RH); else g.fillRect(X0, Y0 + edge, RW, RH - edge); }
      for (const it of r.items) {
        const along = (across ? Y0 + it.y / H * RH : X0 + it.x / W * RW);
        const d = edge + (it.off - 0.5) * 70;
        const wob = Math.sin(t * 3 + it.ph) * 6;
        const x = across ? d + wob : along, y = across ? along : d + wob;
        g.globalAlpha = 1;
        leaf(g, x, y, 1.1 + it.th * 0.9, it.ph + t * it.sp * 2, LEAVES[it.f % LEAVES.length]);
      }
      break;
    }
    case 'feathers': {
      g.globalAlpha = cov;
      g.fillStyle = pat(g, 'paper', 320); g.fillRect(X0, Y0, RW, RH);
      g.fillStyle = 'rgba(255,248,230,.35)'; g.fillRect(X0, Y0, RW, RH);
      g.globalAlpha = Math.min(1, cov * 2) * (1 - Math.max(0, cov - 0.85) * 4);
      for (const it of r.items) {
        const y = ((it.y + t * 40 * it.sp) % (H + 40)) - 20, x = it.x + Math.sin(t * 1.4 + it.ph) * 18;
        g.save(); g.translate(x, y); g.rotate(Math.sin(t + it.ph) * 0.8);
        const gr = g.createLinearGradient(0, -12, 0, 12); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#d8c4a4');
        g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 4.5, 12, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(120,90,60,.5)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 14); g.stroke();
        g.restore();
      }
      break;
    }
    case 'snow': {
      const gr = g.createLinearGradient(0, Y0, 0, Y0 + RH); gr.addColorStop(0, `rgba(226,238,248,${cov})`); gr.addColorStop(1, `rgba(190,214,236,${cov})`);
      g.fillStyle = gr; g.fillRect(X0, Y0, RW, RH);
      for (const it of r.items) {
        const y = ((it.y + t * 70 * it.sp) % (H + 20)) - 10, x = it.x + Math.sin(t * 2 + it.ph) * 14;
        g.globalAlpha = Math.min(1, cov * 3);
        glowDot(g, x, y, 2.5 + it.th * 3.5, 'rgba(255,255,255,.95)');
      }
      break;
    }
    case 'fireflies': {
      const R = (1 - cov) * Math.hypot(W, H) * 0.65;
      const gr = g.createRadialGradient(r.cx, r.cy, Math.max(0, R * 0.55), r.cx, r.cy, Math.max(1, R * 1.05 + 1));
      gr.addColorStop(0, 'rgba(18,24,40,0)'); gr.addColorStop(1, 'rgba(18,24,40,1)');
      g.fillStyle = cov > 0.99 ? NIGHT : gr; g.fillRect(X0, Y0, RW, RH);
      for (const it of r.items) {
        const a = it.ph + t * it.sp * 1.4, d = it.off * Math.max(W, H) * 0.55 * (0.4 + cov * 0.6);
        const x = r.cx + Math.cos(a) * d, y = r.cy + Math.sin(a * 1.3) * d * 0.7;
        g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6 + it.ph);
        glowDot(g, x, y, 7, 'rgba(255,236,150,.9)');
      }
      break;
    }
    case 'page': {
      // a page turning over from the right edge (from the left when reversed), curling at its moving edge
      if (r.rev) { g.translate(X0 * 2 + RW, 0); g.scale(-1, 1); }
      const x0 = phase === 'in' ? X0 + RW * (1 - e) : X0, x1 = phase === 'in' ? X0 + RW : X0 + RW * (1 - e);
      if (x1 - x0 > 0.5) {
        g.fillStyle = pat(g, 'paper', 320); g.fillRect(x0, Y0, x1 - x0, RH);
        g.strokeStyle = 'rgba(70,110,170,.18)'; g.lineWidth = 1;
        for (let y = Y0 + 40; y < Y0 + RH; y += 26) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      }
      if (cov > 0.01 && cov < 0.99) {
        const ex = phase === 'in' ? x0 : x1, dir = phase === 'in' ? 1 : -1;
        const gr = g.createLinearGradient(ex, 0, ex + dir * 46, 0);
        gr.addColorStop(0, 'rgba(255,252,240,.95)'); gr.addColorStop(0.3, 'rgba(225,208,170,.9)'); gr.addColorStop(1, 'rgba(120,90,50,0)');
        g.fillStyle = gr; g.fillRect(Math.min(ex, ex + dir * 46), Y0, 46, RH);
        const sh = g.createLinearGradient(ex, 0, ex - dir * 30, 0); sh.addColorStop(0, 'rgba(30,20,10,.35)'); sh.addColorStop(1, 'rgba(30,20,10,0)');
        g.fillStyle = sh; g.fillRect(Math.min(ex, ex - dir * 30), Y0, 30, RH);
      }
      break;
    }
    case 'blinds': {
      // wooden slats tilting shut row by row
      const n = Math.max(6, Math.round(RH / 56)), sh = RH / n;
      const wd = pat(g, 'oak', 360);
      for (let i = 0; i < n; i++) {
        const d = clamp(cov * 1.5 - (r.rev ? n - 1 - i : i) / n * 0.5, 0, 1), hh = sh * d;
        if (hh <= 0.2) continue;
        const y = Y0 + i * sh + (sh - hh) / 2;
        g.fillStyle = wd; g.fillRect(X0, y, RW, hh);
        const gr = g.createLinearGradient(0, y, 0, y + hh);
        gr.addColorStop(0, 'rgba(255,230,180,.35)'); gr.addColorStop(0.15, 'rgba(255,230,180,0)'); gr.addColorStop(0.8, 'rgba(40,20,8,0)'); gr.addColorStop(1, 'rgba(40,20,8,.55)');
        g.fillStyle = gr; g.fillRect(X0, y, RW, hh);
      }
      break;
    }
    case 'mosaic': {
      // rounded paper and moss tiles popping in on a diagonal wave
      const s = Math.max(28, Math.min(RW, RH) / 8), nx = Math.ceil(RW / s), ny = Math.ceil(RH / s);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const w = (i + j) / (nx + ny), d = clamp(cov * 1.7 - (r.rev ? 1 - w : w) * 0.7, 0, 1);
        if (d <= 0) continue;
        const sz = s * (d < 1 ? 0.2 + 0.85 * smooth(d) : 1.02), cx = X0 + i * s + s / 2, cy = Y0 + j * s + s / 2;
        g.fillStyle = (i + j) % 3 === 0 ? '#5a7a3a' : (i * 7 + j * 3) % 5 === 0 ? '#c9a46a' : '#ecdcb8';
        g.beginPath(); g.roundRect(cx - sz / 2, cy - sz / 2, sz, sz, sz * 0.18); g.fill();
        g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.roundRect(cx - sz / 2, cy - sz / 2, sz, sz * 0.4, sz * 0.18); g.fill();
      }
      break;
    }
    case 'clock': {
      // a clock hand sweeping round, painting the night dial as it goes
      const a0 = -Math.PI / 2, sweep = cov * Math.PI * 2 * (r.rev ? -1 : 1), R = Math.hypot(W, H);
      g.fillStyle = night(1);
      g.beginPath(); g.moveTo(r.cx, r.cy); g.arc(r.cx, r.cy, R, a0, a0 + sweep, r.rev); g.closePath(); g.fill();
      if (cov > 0.01 && cov < 0.99) {
        const a = a0 + sweep, L = Math.min(R, Math.max(W, H));
        g.save(); g.translate(r.cx, r.cy); g.rotate(a);
        const gr = g.createLinearGradient(0, -4, 0, 4); gr.addColorStop(0, '#fff0b8'); gr.addColorStop(0.5, '#d8a040'); gr.addColorStop(1, '#6a4410');
        g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 8;
        g.fillStyle = gr; g.beginPath(); g.moveTo(-20, -3); g.lineTo(L, -1.5); g.lineTo(L, 1.5); g.lineTo(-20, 3); g.fill();
        g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      break;
    }
    case 'curtain': {
      // two velvet curtains drawn on a brass rail
      const half = RW / 2, w = half * cov * 1.04;
      const vel = pat(g, 'velvet', 300, '#5b2a63');
      for (const side of [0, 1]) {
        const x = side ? X0 + RW - w : X0;
        g.fillStyle = vel; g.fillRect(x, Y0, w, RH);
        // folds
        const folds = g.createLinearGradient(x, 0, x + w, 0);
        const nF = Math.max(3, Math.round(w / 34));
        for (let i = 0; i <= nF; i++) { const tt = i / nF; folds.addColorStop(tt, i % 2 ? 'rgba(255,200,240,.16)' : 'rgba(10,0,14,.45)'); }
        g.fillStyle = folds; g.fillRect(x, Y0, w, RH);
        const edgeX = side ? x : x + w, sh = g.createLinearGradient(edgeX, 0, edgeX + (side ? -16 : 16), 0);
        sh.addColorStop(0, 'rgba(0,0,0,.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = sh; g.fillRect(side ? edgeX - 16 : edgeX - 0.01, Y0, 16, RH);
        // gold fringe along the hem
        g.fillStyle = '#d8a040'; g.fillRect(x, Y0 + RH - 10, w, 10);
        g.fillStyle = 'rgba(80,40,0,.4)'; for (let fx = x; fx < x + w; fx += 4) g.fillRect(fx, Y0 + RH - 10, 1.5, 10);
      }
      // the rail
      const rail = g.createLinearGradient(0, Y0, 0, Y0 + 12); rail.addColorStop(0, '#fff0b8'); rail.addColorStop(0.5, '#c88a2a'); rail.addColorStop(1, '#5a3a0a');
      g.globalAlpha = Math.min(1, cov * 4); g.fillStyle = rail; g.fillRect(X0, Y0, RW, 12);
      break;
    }
    case 'blueprint': {
      // blueprint paper unrolling from the top, its chalk grid and a little floor plan
      const edge = Y0 + RH * (phase === 'in' ? e : 1), top = phase === 'out' ? Y0 + RH * e : Y0;
      if (edge - top > 0.5) {
        g.fillStyle = pat(g, 'paper', 320, '#2e5f9e'); g.fillRect(X0, top, RW, edge - top);
        g.strokeStyle = 'rgba(232,240,244,.16)'; g.lineWidth = 1;
        for (let x = X0; x < X0 + RW; x += 16) { g.beginPath(); g.moveTo(x, top); g.lineTo(x, edge); g.stroke(); }
        for (let y = Y0; y < edge; y += 16) if (y >= top) { g.beginPath(); g.moveTo(X0, y); g.lineTo(X0 + RW, y); g.stroke(); }
        g.strokeStyle = 'rgba(240,248,255,.75)'; g.lineWidth = 2;
        const L = X0 + RW * 0.16, R = X0 + RW * 0.84, T = Y0 + RH * 0.2, Bm = Y0 + RH * 0.56, mx = (L + R) / 2, my = (T + Bm) / 2;
        g.save(); g.beginPath(); g.rect(X0, top, RW, edge - top); g.clip();
        g.strokeRect(L, T, R - L, Bm - T); g.beginPath(); g.moveTo(mx, T); g.lineTo(mx, my); g.moveTo(L, my); g.lineTo(mx - 14, my); g.moveTo(mx + 14, my); g.lineTo(R, my); g.stroke();
        g.beginPath(); g.arc(mx - 14, my, 14, -Math.PI / 2, 0); g.stroke();
        g.restore();
      }
      if (phase === 'in' && e < 0.999) {
        const gr = g.createLinearGradient(0, edge - 10, 0, edge + 10);
        gr.addColorStop(0, '#163a66'); gr.addColorStop(0.45, '#9cc0e8'); gr.addColorStop(1, '#0c2244');
        g.fillStyle = gr; g.fillRect(X0, edge - 10, RW, 20);
      }
      break;
    }
    case 'stars': {
      // the night falling from the top, stars coming out and the moon
      const edge = Y0 + (RH + 120) * (phase === 'in' ? e : 1) - 60, top = phase === 'out' ? Y0 + (RH + 120) * e - 60 : Y0 - 1;
      const gr = g.createLinearGradient(0, edge - 120, 0, edge);
      gr.addColorStop(0, '#141a32'); gr.addColorStop(1, 'rgba(36,44,90,0)');
      g.fillStyle = '#141a32'; if (edge - 120 > top) g.fillRect(X0, top, RW, edge - 120 - top);
      g.fillStyle = gr; g.fillRect(X0, Math.max(top, edge - 120), RW, Math.min(120, edge - top));
      for (const it of r.items) {
        const y = Y0 + it.y / H * RH * 0.92;
        if (y > edge - 60 || y < top) continue;
        g.globalAlpha = 0.5 + 0.5 * Math.sin(t * it.sp + it.ph);
        if (it.th > 0.85) star4(g, X0 + it.x / W * RW, y, 4, '#fff8e0'); else glowDot(g, X0 + it.x / W * RW, y, 1.6 + it.th * 1.6, 'rgba(255,250,236,.95)');
      }
      g.globalAlpha = 1;
      const my = Math.min(edge - 70, Y0 + RH * 0.22);
      if (my > top + 20) {
        glowDot(g, X0 + RW * 0.72, my, 60, 'rgba(220,230,255,.35)');
        g.fillStyle = '#f6f0dc'; g.beginPath(); g.arc(X0 + RW * 0.72, my, 22, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#141a32'; g.beginPath(); g.arc(X0 + RW * 0.72 + 9, my - 6, 19, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'sunrise': {
      const gr = g.createLinearGradient(0, Y0, 0, Y0 + RH);
      gr.addColorStop(0, `rgba(108,92,150,${cov})`); gr.addColorStop(0.45, `rgba(232,140,120,${cov})`); gr.addColorStop(0.75, `rgba(252,196,120,${cov})`); gr.addColorStop(1, `rgba(255,236,180,${cov})`);
      g.fillStyle = gr; g.fillRect(X0, Y0, RW, RH);
      const sy = Y0 + RH * (0.95 - 0.35 * (phase === 'in' ? e : 1)), sx = X0 + RW / 2;
      g.globalAlpha = cov;
      glowDot(g, sx, sy, 160, 'rgba(255,230,160,.7)');
      g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(sx, sy, 38, 0, Math.PI * 2); g.fill();
      break;
    }
  }
  g.restore();
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ running

// [audio3] soft hand-made whooshes and real foley (sfx sprites): cloth, leaves, pages, paper, chimes
const SOUND: Partial<Record<TransitionKind, [string, number, number?]>> = {
  iris: ['whoosh_soft', 0.4], dither: ['whoosh_soft', 0.25, 0.9], fade: ['whoosh_soft', 0.2, 0.85], leaves: ['leaf_rustle', 0.5], feathers: ['feather_ruffle', 0.4, 0.85], snow: ['star_shimmer', 0.3, 0.9],
  fireflies: ['sparkle_fizz', 0.3], page: ['page_turn', 0.55], blinds: ['whoosh_cloth', 0.35, 1.2], mosaic: ['tick_paper', 0.45], branch: ['leaf_rustle', 0.5, 0.85], clock: ['clock_wind', 0.35, 1.2],
  curtain: ['whoosh_cloth', 0.5], blueprint: ['paper_rustle', 0.45], stars: ['chime_sweep', 0.25, 0.9], sunrise: ['bird_song', 0.3],
  acorns: ['place_wood', 0.45, 1.25], plumes: ['feather_ruffle', 0.5], clouds: ['wind_gust', 0.28, 1.15], dream: ['chime_sweep', 0.35, 0.8],
};
const DUR: Record<TransitionKind, [number, number]> = {
  iris: [0.5, 0.55], dither: [0.4, 0.45], fade: [0.35, 0.4], leaves: [0.6, 0.7], feathers: [0.6, 0.7], snow: [0.6, 0.65], fireflies: [0.6, 0.7], page: [0.55, 0.55],
  blinds: [0.5, 0.5], mosaic: [0.5, 0.55], branch: [0.55, 0.6], clock: [0.55, 0.55], curtain: [0.5, 0.55], blueprint: [0.65, 0.6], stars: [0.6, 0.8], sunrise: [0.5, 1.2],
  acorns: [0.75, 0.85], plumes: [0.85, 0.95], clouds: [0.8, 0.9], dream: [0.9, 1.05],
};

function animate(r: Run, phase: 'in' | 'out', dur: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const t0 = performance.now();
    const finish = () => { if (done) return; done = true; resolve(); };
    const frame = (now: number) => {
      if (done) return;
      const p = Math.min(1, (now - t0) / 1000 / dur);
      paint(r, phase, p, (now - r.t0) / 1000);
      if (p >= 1) finish(); else requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    // animation frames stall in background tabs: never let the change of place depend on them
    setTimeout(() => { if (!done) { paint(r, phase, 1, dur); finish(); } }, dur * 1000 + 350);
  });
}

/** Cover the screen with a transition, run `mid`, then reveal the new place. */
export async function transition(kind: TransitionKind, mid?: () => void | Promise<void>, o: TransitionOpts = {}): Promise<void> {
  if (typeof document === 'undefined' || busy) { await mid?.(); return; }
  busy = true;
  try {
    if (reducedMotion()) kind = 'dither';
    if (is3D(kind)) {
      const s = SOUND[kind];
      if (s) try { sound.play(s[0], { volume: s[1], rate: s[2] ?? 1, gap: 80 }); } catch { /* not ready */ }
      const [din, dout] = DUR[kind].map((d) => (d * 1000) / (o.speed ?? 1));
      if (await animate3D(kind, 'in', din)) {
        try { await mid?.(); } catch (e) { console.warn('transition mid failed', e); }
        hold3D(kind);
        await new Promise((res) => setTimeout(res, 140));
        await animate3D(kind, 'out', dout);
        return;
      }
      hide3D();
      kind = 'dither'; // no WebGL for the overlay: the plain dusk instead
    }
    const r = setup(kind, o);
    r.t0 = performance.now();
    cv!.style.pointerEvents = 'auto'; // no double taps while covered
    const s = SOUND[kind];
    if (s) try { sound.play(s[0], { volume: s[1], rate: s[2] ?? 1, gap: 80 }); } catch { /* not ready */ }
    const [din, dout] = DUR[kind].map((d) => d / (o.speed ?? 1));
    await animate(r, 'in', din);
    try { await mid?.(); } catch (e) { console.warn('transition mid failed', e); }
    await new Promise((res) => setTimeout(res, 110));
    cv!.style.pointerEvents = 'none';
    if (kind === 'page') try { sound.play('ui_page', { volume: 0.35, gap: 80 }); } catch { /* */ }
    await animate(r, 'out', dout);
  } finally {
    busy = false;
    if (cv) { ctx?.setTransform(1, 0, 0, 1, 0, 0); ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; cv.style.pointerEvents = 'none'; }
  }
}

/**
 * Start fully covered and reveal: for changes that already happened (the night falling, the
 * morning arriving). Paints the covered frame synchronously, so it is up before the next paint.
 */
export async function reveal(kind: TransitionKind, o: TransitionOpts = {}): Promise<void> {
  if (typeof document === 'undefined' || busy) return;
  busy = true;
  try {
    if (reducedMotion()) kind = 'dither';
    if (is3D(kind)) {
      hold3D(kind);
      await new Promise((res) => setTimeout(res, 160));
      if (await animate3D(kind, 'out', (DUR[kind][1] * 1000) / (o.speed ?? 1))) return;
      hide3D();
      kind = 'dither';
    }
    const r = setup(kind, o);
    r.t0 = performance.now();
    paint(r, 'in', 1, 0);
    const s = SOUND[kind];
    if (s) try { sound.play(s[0], { volume: s[1], rate: s[2] ?? 1, gap: 80 }); } catch { /* */ }
    await new Promise((res) => setTimeout(res, 160));
    await animate(r, 'out', DUR[kind][1] / (o.speed ?? 1));
  } finally {
    busy = false;
    if (cv) { ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; }
  }
}

/** True while a transition covers (or is uncovering) the screen. */
export const transitioning = () => busy;

/** Dev/screenshot helper: draw one still frame of a transition and leave it on screen. */
export function previewTransition(kind: TransitionKind, phase: 'in' | 'out', p: number, t = 0.6, o: TransitionOpts = {}) {
  if (is3D(kind)) { preview3D(kind, (phase === 'in' ? 0 : 1) + p); return; }
  const r = setup(kind, o);
  r.t0 = 0;
  paint(r, phase, p, t);
}
export function clearTransition() { if (cv) { ctx?.setTransform(1, 0, 0, 1, 0, 0); ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; } }

// ------------------------------------------------------------------ which transition for which change of place

const OPEN: Partial<Record<NonNullable<Panel>, [TransitionKind, TransitionOpts?]>> = {
  sleep: ['dream'], clock: ['clock'], book: ['page'], build: ['blueprint'], decorate: ['blueprint'], shop: ['acorns'], wardrobe: ['curtain'],
  map: ['clouds', { speed: 1.1 }], quests: ['mosaic', { speed: 1.3 }], settings: ['blinds', { speed: 1.2 }], breathe: ['plumes'], night: ['stars'],
};
const CLOSE: Partial<Record<NonNullable<Panel>, [TransitionKind, TransitionOpts?]>> = {
  sleep: ['dream', { speed: 1.25 }], clock: ['clock', { reverse: true, speed: 1.35 }], book: ['page', { reverse: true, speed: 1.25 }], build: ['blueprint', { speed: 1.3 }], decorate: ['blueprint', { speed: 1.3 }],
  shop: ['acorns', { speed: 1.2 }], wardrobe: ['plumes', { speed: 1.3 }], map: ['clouds', { speed: 1.25 }], quests: ['dither', { speed: 1.4 }], settings: ['blinds', { reverse: true, speed: 1.4 }],
  breathe: ['feathers', { speed: 1.2 }], night: ['sunrise'],
};
/** The transition (and options) for a change of place, or null for none. */
export function panelTransition(from: Panel, to: Panel): [TransitionKind, TransitionOpts] | null {
  if (from === to) return null;
  const pick = to ? OPEN[to] : from ? CLOSE[from] : undefined;
  if (!pick) return to || from ? ['dither', { speed: 1.3 }] : null;
  return [pick[0], { ...(pick[1] ?? {}) }];
}

let installed = false;
/**
 * Make every change of `panel` (open, close, switch) play its transition: assignments made while
 * no transition runs are held until the screen is covered. Also: the night falls with stars when
 * Pip leaves, the morning rises with the sun, level-ups burst, and camera view changes get
 * letterbox bars. Safe to call more than once.
 */
export function installPanelTransitions() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(panel), 'value');
  if (d?.get && d.set) {
    const get = d.get, put = d.set;
    let pending: { v: Panel } | null = null;
    const eligible = () => {
      try { return save.peek().onboarded && phase.peek() === 'day' && document.visibilityState === 'visible' && !(window as unknown as { __chromeHold?: boolean }).__chromeHold; } catch { return false; }
    };
    Object.defineProperty(panel, 'value', {
      configurable: true,
      get() { return get.call(this); },
      set(v: Panel) {
        if (pending) { pending.v = v; return; }           // a later change wins while one is pending
        const from = panel.peek();
        const k = busy || !eligible() ? null : panelTransition(from, v);
        if (!k) { put.call(this, v); return; }
        pending = { v };
        void transition(k[0], () => { const t = pending!.v; pending = null; put.call(panel, t); }, k[1]);
      },
    });
  }
  // the night and the morning
  let ph = phase.peek();
  phase.subscribe((v) => {
    const was = ph; ph = v;
    if (was === v) return;
    if (v === 'morning' && (was === 'ringing' || was === 'sleeping')) void reveal('sunrise', { x: innerWidth * 0.5 });
  });
  // level-ups burst with light
  let lv = level.peek().level;
  level.subscribe((l) => { if (l.level > lv) flourish('levelup'); lv = l.level; });
  // camera view changes get cinematic letterbox bars
  const hookScene = () => {
    const sc = sceneRef.current;
    if (!sc) { setTimeout(hookScene, 500); return; }
    const setView = sc.setView.bind(sc);
    sc.setView = (v) => { const was = sc.view; setView(v); if (was !== v && !busy && phase.peek() !== 'sleeping') flourish('letterbox'); };
  };
  hookScene();
}

// ------------------------------------------------------------------ local wipes (the interview's cards)

/** Wipe one rectangle (e.g. the interview clipboard page) with a quick transition, swapping its content in `mid`. */
export function questionTransition(mid?: () => void | Promise<void>, o: { rect?: DOMRect | { x: number; y: number; width: number; height: number }; kind?: TransitionKind; reverse?: boolean; speed?: number } = {}): Promise<void> {
  const rc = o.rect;
  const rect = rc ? { x: rc.x, y: rc.y, w: rc.width, h: rc.height } : undefined;
  return transition(o.kind ?? 'mosaic', mid, { rect, reverse: o.reverse, speed: o.speed ?? 2.2 });
}

// ------------------------------------------------------------------ flourishes (non-blocking overlays)

let fcv: HTMLCanvasElement | null = null, fctx: CanvasRenderingContext2D | null = null, fraf = 0;
interface Fl { kind: 'letterbox' | 'levelup' | 'sparkle'; t0: number; dur: number; x: number; y: number }
const flList: Fl[] = [];
function fensure() {
  if (fcv) return;
  fcv = document.createElement('canvas');
  fcv.className = 'hh-flourish';
  Object.assign(fcv.style, { position: 'fixed', left: '0', top: '0', zIndex: '55', pointerEvents: 'none', display: 'none' });
  document.body.appendChild(fcv);
  fctx = fcv.getContext('2d');
}
/** A short flourish over everything that does not block input: letterbox bars, a level-up burst, a sparkle pop. */
export function flourish(kind: Fl['kind'], o: { x?: number; y?: number } = {}) {
  if (typeof document === 'undefined' || reducedMotion()) return;
  fensure();
  const dur = kind === 'letterbox' ? 1.5 : kind === 'levelup' ? 1.1 : 0.6;
  const ex = flList.find((f) => f.kind === kind);
  if (ex && kind === 'letterbox') { ex.t0 = Math.min(ex.t0, performance.now() - 0.3 * 1000); return; }
  flList.push({ kind, t0: performance.now(), dur, x: o.x ?? innerWidth / 2, y: o.y ?? innerHeight * 0.42 });
  if (!fraf) fraf = requestAnimationFrame(floop);
}
function floop(now: number) {
  fraf = 0;
  const k = Math.min(2, Math.max(1, devicePixelRatio || 1)), W = Math.ceil(innerWidth), H = Math.ceil(innerHeight);
  if (fcv!.width !== Math.round(W * k) || fcv!.height !== Math.round(H * k)) { fcv!.width = Math.round(W * k); fcv!.height = Math.round(H * k); fcv!.style.width = `${W}px`; fcv!.style.height = `${H}px`; }
  fcv!.style.display = 'block';
  const g = fctx!;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.clearRect(0, 0, W, H);
  for (let i = flList.length - 1; i >= 0; i--) {
    const f = flList[i], t = (now - f.t0) / 1000 / f.dur;
    if (t >= 1) { flList.splice(i, 1); continue; }
    if (f.kind === 'letterbox') {
      // bars slide in, hold while the camera moves, slide out
      const kk = t < 0.2 ? smooth(t / 0.2) : t > 0.78 ? 1 - smooth((t - 0.78) / 0.22) : 1;
      const bh = kk * Math.min(52, H * 0.075);
      if (bh > 0.5) {
        g.fillStyle = '#0e1220'; g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh);
        g.fillStyle = 'rgba(216,160,64,.8)'; g.fillRect(0, bh - 1.5, W, 1.5); g.fillRect(0, H - bh, W, 1.5);
      }
    } else if (f.kind === 'levelup') {
      // soft rings of light and rays bursting from the point, then glints
      const R = smooth(t) * Math.hypot(W, H) * 0.6;
      g.globalAlpha = 1 - t;
      for (let kk = 0; kk < 3; kk++) {
        const rr = R - kk * 16;
        if (rr <= 0) continue;
        g.strokeStyle = ['rgba(255,226,150,.9)', 'rgba(255,190,90,.7)', 'rgba(255,250,236,.6)'][kk]; g.lineWidth = 5 - kk;
        g.beginPath(); g.arc(f.x, f.y, rr, 0, Math.PI * 2); g.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2, gr = g.createLinearGradient(f.x, f.y, f.x + Math.cos(a) * R * 0.8, f.y + Math.sin(a) * R * 0.8);
        gr.addColorStop(0, 'rgba(255,236,170,0)'); gr.addColorStop(0.5, 'rgba(255,236,170,.6)'); gr.addColorStop(1, 'rgba(255,236,170,0)');
        g.strokeStyle = gr; g.lineWidth = 3; g.beginPath(); g.moveTo(f.x + Math.cos(a) * R * 0.25, f.y + Math.sin(a) * R * 0.25); g.lineTo(f.x + Math.cos(a) * R * 0.8, f.y + Math.sin(a) * R * 0.8); g.stroke();
      }
      for (let i = 0; i < 10; i++) {
        const a = i * 2.39996, d = R * (0.4 + hash(i, 1, 5) * 0.5);
        if (Math.sin(t * 20 + i) < -0.3) continue;
        glint(g, f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, 7);
      }
      g.globalAlpha = 1;
    } else {
      const R = smooth(t) * 22;
      g.globalAlpha = 1 - t;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; glint(g, f.x + Math.cos(a) * R, f.y + Math.sin(a) * R, 6); }
      g.globalAlpha = 1;
    }
  }
  if (flList.length) fraf = requestAnimationFrame(floop);
  else fcv!.style.display = 'none';
}
function glint(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(255,250,230,.95)'); gr.addColorStop(1, 'rgba(255,230,160,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,252,236,.95)';
  for (const a of [0, Math.PI / 2]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-r * 1.3, 0); g.quadraticCurveTo(0, -r * 0.16, r * 1.3, 0); g.quadraticCurveTo(0, r * 0.16, -r * 1.3, 0); g.fill(); g.restore(); }
}

// ------------------------------------------------------------------ camera: ease the 3D camera to a shot

/**
 * Take the camera from where it is to `to` over `ms` (ease in-out), with letterbox bars, then hand
 * it back to the scene (or hold the shot while `hold` is true). Resolves when the move is done.
 */
export function directorBlend(scene: Scene, to: CamShot, ms = 1200, o: { hold?: boolean; bars?: boolean } = {}): Promise<void> {
  const c = (scene as unknown as { cur?: { yaw: number; pitch: number; dist: number; target: CamShot['target'] } }).cur;
  if (!c) { return Promise.resolve(); }
  const from = { yaw: c.yaw, pitch: c.pitch, dist: c.dist, target: c.target.clone() };
  let dy = to.yaw - from.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  if (o.bars !== false) flourish('letterbox');
  const t0 = performance.now();
  const prev = scene.director;
  return new Promise((done) => {
    let fin = false;
    scene.director = () => {
      const k = clamp((performance.now() - t0) / ms, 0, 1), e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      const shot: CamShot = { yaw: from.yaw + dy * e, pitch: from.pitch + (to.pitch - from.pitch) * e, dist: from.dist + (to.dist - from.dist) * e, target: from.target.clone().lerp(to.target, e), fov: to.fov, snap: true };
      if (k >= 1 && !fin) { fin = true; if (!o.hold) setTimeout(() => { if (scene.director) scene.director = prev; }, 0); done(); }
      return shot;
    };
  });
}
