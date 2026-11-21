// Full-screen pixel transitions between places: an iris wipe, a falling-leaves curtain, a snow
// flurry (the shop), a page turn (the book), a blueprint unrolling (build mode), a starry fade
// (sleep) and a plain dissolve. Drawn on one canvas at 3 CSS px per texel. `mid` runs while the
// screen is fully covered; the promise resolves when the screen is clear again.
// OWNED BY THE UI-CHROME BUILDER.
import { sound } from '../../audio/sound.ts';
import { spriteCanvas } from '../px/sprites.js';
import '../px/chromeart.js';
import { bayer, hash, vnoise } from './paint.ts';
import { reducedMotion } from './swing.ts';

export type TransitionKind = 'iris' | 'leaves' | 'snow' | 'page' | 'blueprint' | 'stars' | 'fade';
export interface TransitionOpts {
  /** centre of the iris (CSS px); defaults to the middle of the screen */
  x?: number; y?: number;
  /** 1 = normal; 1.5 = faster */
  speed?: number;
}

const B = 3;
const pk = (hex: string, a = 255) => { const n = parseInt(hex.slice(1, 7), 16); return ((a << 24) | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
const CLEAR = 0;
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

interface Item { x: number; y: number; off: number; ph: number; spr: string; sp: number; th: number }
interface Run { kind: TransitionKind; W: number; H: number; cx: number; cy: number; img: ImageData; buf: Uint32Array; items: Item[]; t0: number; mask?: Uint8Array }

let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null;
let busy = false;

function ensure() {
  if (cv) return;
  cv = document.createElement('canvas');
  cv.className = 'hh-trans';
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: '60', pointerEvents: 'none', imageRendering: 'pixelated', display: 'none' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
}
function setup(kind: TransitionKind, o: TransitionOpts): Run {
  ensure();
  const W = Math.ceil(innerWidth / B), H = Math.ceil(innerHeight / B);
  cv!.width = W; cv!.height = H;
  cv!.style.width = `${W * B}px`; cv!.style.height = `${H * B}px`;
  cv!.style.display = 'block';
  ctx!.imageSmoothingEnabled = false;
  const img = ctx!.createImageData(W, H);
  const r: Run = { kind, W, H, cx: (o.x ?? innerWidth / 2) / B, cy: (o.y ?? innerHeight / 2) / B, img, buf: new Uint32Array(img.data.buffer), items: [], t0: 0 };
  const rnd = (i: number, k: number) => hash(i, k, 77);
  if (kind === 'leaves') {
    const sprs = ['tr_leaf', 'tr_leafo', 'tr_leafy', 'tr_leafr', 'tr_leaf'];
    for (let i = 0; i < Math.ceil(W / 7) * 2 + 20; i++) r.items.push({ x: rnd(i, 1) * (W + 10) - 5, y: 0, off: rnd(i, 2) * 46 - 10, ph: rnd(i, 3) * 4, spr: sprs[i % sprs.length], sp: 0.6 + rnd(i, 4) * 0.8, th: 0 });
  }
  if (kind === 'snow') for (let i = 0; i < 90; i++) r.items.push({ x: rnd(i, 1) * W, y: rnd(i, 2) * H, off: 0, ph: rnd(i, 3) * 6.28, spr: i % 3 ? 'fx_snow' : 'tr_flake', sp: 0.5 + rnd(i, 4), th: rnd(i, 5) });
  if (kind === 'stars') for (let i = 0; i < 70; i++) r.items.push({ x: Math.floor(rnd(i, 1) * W), y: Math.floor(rnd(i, 2) * H * 0.85), off: 0, ph: rnd(i, 3) * 6.28, spr: '', sp: 2 + rnd(i, 4) * 4, th: rnd(i, 5) * 0.8 });
  if (kind === 'blueprint') r.mask = blueprintMask(W, H);
  return r;
}

// ------------------------------------------------------------------ painters

/** Paint one frame. `phase` in: covering (p 0 to 1); out: uncovering (p 0 to 1). */
function paint(r: Run, phase: 'in' | 'out', p: number, t: number) {
  const { W, H, buf } = r;
  buf.fill(CLEAR);
  const e = smooth(p);
  const cov = phase === 'in' ? e : 1 - e;
  const sprites: [string, number, number, number?][] = [];
  switch (r.kind) {
    case 'fade': {
      const c = pk('#16122a');
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < cov * 1.02) buf[y * W + x] = c;
      break;
    }
    case 'iris': {
      const R = (1 - cov) * (Math.hypot(Math.max(r.cx, W - r.cx), Math.max(r.cy, H - r.cy)) + 3);
      const ink = pk('#14102a'), dot = pk('#2a2250'), gold = pk('#ffd86a'), gold2 = pk('#b0661a');
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - r.cx, (y - r.cy));
        if (d > R + 2) buf[y * W + x] = hash(x, y, 3) > 0.97 ? dot : ink;
        else if (d > R && cov > 0.02 && cov < 0.98) buf[y * W + x] = d > R + 1 ? gold2 : gold;
        else if (d > R - 2 && d <= R - 1 && cov > 0.02 && cov < 0.98 && (x + y) % 2 === 0) buf[y * W + x] = gold;
      }
      break;
    }
    case 'leaves': {
      const span = H + 40;
      const edge = phase === 'in' ? e * span - 20 : e * span - 20;
      const pal = ['#0f2a1c', '#173628', '#1f5236', '#2a723e', '#3b8a3e'].map((h) => pk(h)), rim = pk('#0b1a10');
      for (let x = 0; x < W; x++) {
        const jag = vnoise(x * 0.18, 0, 5) * 7 + Math.sin(x * 0.55) * 2;
        const lim = edge + jag;
        for (let y = 0; y < H; y++) {
          const covered = phase === 'in' ? y < lim : y > lim;
          if (!covered) continue;
          const dEdge = Math.abs(y - lim);
          if (dEdge < 1.5) { buf[y * W + x] = rim; continue; }
          const n = vnoise(x * 0.35, y * 0.35, 9) * 0.7 + hash(x >> 1, y >> 1, 2) * 0.3;
          let i = n > 0.72 ? 4 : n > 0.55 ? 3 : n > 0.38 ? 2 : n > 0.22 ? 1 : 0;
          if (dEdge < 6) i = Math.max(0, i - 1);
          buf[y * W + x] = pal[i];
        }
      }
      for (const it of r.items) {
        const y = phase === 'in' ? edge + it.off - 6 : edge + it.off - 30;
        if (y < -14 || y > H + 14) continue;
        const sway = Math.sin(t * 3 * it.sp + it.ph) * 4;
        sprites.push([`${it.spr}_${Math.floor(t * 8 * it.sp + it.ph) % 4}`, it.x + sway, y]);
      }
      break;
    }
    case 'snow': {
      const top = [0xe9, 0xf6, 0xff], bot = [0xbf, 0xdc, 0xf4];
      for (let y = 0; y < H; y++) {
        const k = y / H, cr = Math.round(top[0] + (bot[0] - top[0]) * k), cg = Math.round(top[1] + (bot[1] - top[1]) * k), cb = Math.round(top[2] + (bot[2] - top[2]) * k);
        const base = ((255 << 24) | (cb << 16) | (cg << 8) | cr) >>> 0, frost = pk('#ffffff'), deep = pk('#9cc8ec');
        for (let x = 0; x < W; x++) {
          const streak = vnoise(x * 0.05 - t * 1.2, y * 0.22, 4) * 0.35;
          if (bayer(x, y) < cov * 1.25 - streak) buf[y * W + x] = hash(x, y, 8) > 0.96 ? frost : hash(x, y, 9) > 0.985 ? deep : base;
        }
      }
      const vis = Math.min(1, cov * 2 + 0.25);
      for (const it of r.items) {
        if (it.th > vis) continue;
        const x = ((it.x + t * W * 0.55 * it.sp) % (W + 20)) - 10, y = ((it.y + t * H * 0.18 * it.sp + Math.sin(t * 2 + it.ph) * 5) % (H + 20)) - 10;
        sprites.push([`${it.spr}_${Math.floor(t * 4 + it.ph) % 2}`, x, y]);
      }
      break;
    }
    case 'page': {
      const span = W + 18;
      const xe = W - e * span;
      const paper = pk('#f3e2b8'), line = pk('#dcc394'), margin = pk('#d99080'), curl = pk('#fff7e0'), curl2 = pk('#e2c992'), ink = pk('#3b2414'), shade = pk('#000000', 70), fleck = pk('#e8d3a0');
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const covered = phase === 'in' ? x > xe : x < xe;
        const d = phase === 'in' ? x - xe : xe - x; // distance into the page from its moving edge
        if (covered) {
          let c = y % 8 === 6 ? line : paper;
          if (x === Math.round(W * 0.14) || x === Math.round(W * 0.14) + 1) c = margin;
          if (hash(x, y, 4) > 0.97) c = fleck;
          if (d < 1) c = ink; else if (d < 3) c = curl; else if (d < 6) c = (x + y) % 2 ? curl2 : paper;
          buf[y * W + x] = c;
        } else if (-d < 10 && (x + y) % 2 === 0 && cov > 0.02) buf[y * W + x] = shade;
      }
      break;
    }
    case 'blueprint': {
      const span = H + 16;
      const yr = phase === 'in' ? e * span - 8 : (1 - e) * span - 8;
      const base = pk('#2a56a0'), minor = pk('#3866b2'), major = pk('#5a88d0'), draw = pk('#dcebff'), shadow = pk('#000000', 80);
      const roll = ['#14306a', '#244e96', '#3c6cba', '#6c9ce0', '#a8ccf6', '#6c9ce0', '#3c6cba', '#244e96', '#14306a'].map((h) => pk(h));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (y < yr) {
          let c = base;
          if (x % 6 === 0 || y % 6 === 0) c = minor;
          if (x % 24 === 0 || y % 24 === 0) c = major;
          if (r.mask![y * W + x]) c = draw;
          buf[y * W + x] = c;
        } else if (y < yr + roll.length) {
          const i = Math.floor(y - yr);
          buf[y * W + x] = x === 0 || x === W - 1 ? roll[0] : roll[i];
        } else if (y < yr + roll.length + 3 && (x + y) % 2 === 0 && yr > -6 && yr < H) buf[y * W + x] = shadow;
      }
      break;
    }
    case 'stars': {
      const top = [0x0c, 0x10, 0x2e], bot = [0x2c, 0x28, 0x64];
      for (let y = 0; y < H; y++) {
        const k = y / H, cr = Math.round(top[0] + (bot[0] - top[0]) * k), cg = Math.round(top[1] + (bot[1] - top[1]) * k), cb = Math.round(top[2] + (bot[2] - top[2]) * k);
        const col = ((255 << 24) | (cb << 16) | (cg << 8) | cr) >>> 0;
        for (let x = 0; x < W; x++) if (bayer(x, y) < cov * 1.15 - (1 - k) * 0.12) buf[y * W + x] = col;
      }
      const s1 = pk('#fff6d0'), s2 = pk('#a9a0e8');
      for (const it of r.items) {
        if (cov < it.th + 0.1) continue;
        const tw = Math.sin(t * it.sp + it.ph);
        const i = it.y * W + it.x;
        buf[i] = tw > -0.3 ? s1 : s2;
        if (tw > 0.75 && it.x > 0 && it.x < W - 1 && it.y > 0) { buf[i - 1] = s2; buf[i + 1] = s2; buf[i - W] = s2; buf[i + W] = s2; }
      }
      if (cov > 0.35) sprites.push(['tr_moon', W / 2, H * 0.38 + (1 - cov) * 18, Math.min(1, (cov - 0.35) * 2.5)]);
      break;
    }
  }
  ctx!.putImageData(r.img, 0, 0);
  for (const [name, x, y, a] of sprites) {
    const im = spriteCanvas(name, 1);
    ctx!.globalAlpha = a ?? 1;
    ctx!.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height / 2));
  }
  ctx!.globalAlpha = 1;
}

/** White drafting lines of a little tree-house floor plan, scaled to the screen. */
function blueprintMask(W: number, H: number): Uint8Array {
  const m = new Uint8Array(W * H);
  const set = (x: number, y: number) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1; };
  const rect = (x0: number, y0: number, x1: number, y1: number, dash = 0) => {
    for (let x = x0; x <= x1; x++) if (!dash || (x >> 1) % 2) { set(x, y0); set(x, y1); }
    for (let y = y0; y <= y1; y++) if (!dash || (y >> 1) % 2) { set(x0, y); set(x1, y); }
  };
  const L = Math.round(W * 0.14), R = Math.round(W * 0.86), T = Math.round(H * 0.16), Bm = Math.round(H * 0.58);
  rect(L, T, R, Bm); rect(L + 1, T + 1, R - 1, Bm - 1);
  const mx = Math.round((L + R) / 2), my = Math.round((T + Bm) / 2);
  for (let y = T; y < my; y++) set(mx, y);
  for (let x = L; x < mx - 6; x++) set(x, my);
  for (let x = mx + 6; x < R; x++) set(x, my);
  // door swing arc and a round table
  for (let a = 0; a < Math.PI / 2; a += 0.06) set(mx - 6 + Math.cos(a) * 6, my - Math.sin(a) * 6);
  const tr = Math.max(3, Math.round(W * 0.05));
  for (let a = 0; a < Math.PI * 2; a += 0.05) set((L + mx) / 2 + Math.cos(a) * tr, (T + my) / 2 + Math.sin(a) * tr);
  rect(mx + 4, T + 4, R - 6, T + 4 + Math.round((my - T) * 0.4), 1);
  // dimension line with ticks
  const dy = Bm + 6;
  for (let x = L; x <= R; x++) set(x, dy);
  for (let k = -2; k <= 2; k++) { set(L, dy + k); set(R, dy + k); }
  // title block
  const tx0 = Math.round(W * 0.52), ty0 = Math.round(H * 0.78);
  rect(tx0, ty0, R, Math.round(H * 0.9));
  for (let i = 1; i < 3; i++) for (let x = tx0 + 3; x < R - 3 - i * 6; x++) set(x, ty0 + i * 4);
  return m;
}

// ------------------------------------------------------------------ running

const SOUND: Partial<Record<TransitionKind, [string, number, number?]>> = {
  iris: ['tp_out', 0.3], leaves: ['rustle_bush', 0.45], snow: ['tp_shimmer', 0.4], page: ['paper_flip', 0.55], blueprint: ['paper_flip', 0.45, 0.8], stars: ['sparkle', 0.35, 0.8],
};
const DUR: Record<TransitionKind, [number, number]> = { iris: [0.5, 0.55], leaves: [0.6, 0.7], snow: [0.6, 0.65], page: [0.55, 0.55], blueprint: [0.65, 0.6], stars: [0.6, 0.8], fade: [0.35, 0.4] };

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

/** Cover the screen with a pixel transition, run `mid`, then reveal the new place. */
export async function transition(kind: TransitionKind, mid?: () => void | Promise<void>, o: TransitionOpts = {}): Promise<void> {
  if (typeof document === 'undefined' || busy) { await mid?.(); return; }
  busy = true;
  try {
    if (reducedMotion()) kind = 'fade';
    const r = setup(kind, o);
    r.t0 = performance.now();
    cv!.style.pointerEvents = 'auto'; // no double taps while covered
    const s = SOUND[kind];
    if (s) sound.play(s[0], { volume: s[1], rate: s[2] ?? 1, gap: 80 });
    const [din, dout] = DUR[kind].map((d) => d / (o.speed ?? 1));
    await animate(r, 'in', din);
    try { await mid?.(); } catch (e) { console.warn('transition mid failed', e); }
    await new Promise((res) => setTimeout(res, 110));
    cv!.style.pointerEvents = 'none';
    if (kind === 'page') sound.play('ui_page', { volume: 0.35, gap: 80 });
    await animate(r, 'out', dout);
  } finally {
    busy = false;
    if (cv) { ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; cv.style.pointerEvents = 'none'; }
  }
}

/** True while a transition covers (or is uncovering) the screen. */
export const transitioning = () => busy;

/** Dev/screenshot helper: draw one still frame of a transition and leave it on screen. */
export function previewTransition(kind: TransitionKind, phase: 'in' | 'out', p: number, t = 0.6, o: TransitionOpts = {}) {
  const r = setup(kind, o);
  r.t0 = 0;
  paint(r, phase, p, t);
}
export function clearTransition() { if (cv) { ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; } }
