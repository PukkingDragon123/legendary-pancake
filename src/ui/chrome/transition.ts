// Full-screen pixel-art transitions, all drawn on one canvas at 3 CSS px per texel in the calm
// palette (src/gfx/palette.ts). `mid` runs while the screen is fully covered; the promise resolves
// when the screen is clear again.
//
//   iris       a stepped pixel iris closing on a point, a brass rim
//   dither     an ordered-dither dissolve with a diagonal drift (also 'fade')
//   leaves     a curtain of leaves falling down the screen (map, quests)
//   feathers   soft down feathers drifting over an oat-paper cover (breathing)
//   snow       a flurry of snow banks blowing in (the shop)
//   fireflies  dusk closes in from the edges while fireflies swirl (sleep things)
//   page       a page turning over, with a curled edge (the book)
//   blinds     wooden slats tilting shut row by row (settings)
//   mosaic     little moss and paper tiles popping in on a diagonal wave (quests)
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
import { bayer, hash, vnoise } from './paint.ts';
import { reducedMotion } from './swing.ts';

export type TransitionKind = 'iris' | 'dither' | 'fade' | 'leaves' | 'feathers' | 'snow' | 'fireflies' | 'page' | 'blinds' | 'mosaic' | 'branch' | 'clock' | 'curtain' | 'blueprint' | 'stars' | 'sunrise';
export const TRANSITION_KINDS: TransitionKind[] = ['iris', 'dither', 'leaves', 'feathers', 'snow', 'fireflies', 'page', 'blinds', 'mosaic', 'branch', 'clock', 'curtain', 'blueprint', 'stars', 'sunrise'];
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

const B = 3;
type RGB = number;
const pk = (c: RGB, a = 255) => ((a << 24) | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
const mixc = (a: RGB, b: RGB, t: number): RGB => { const ch = (h: number, s: number) => (h >> s) & 255; const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t); return (m(16) << 16) | (m(8) << 8) | m(0); };
const CLEAR = 0;
/** muted towards linen (k) and a charcoal ink for the big dark covers: colour stays an accent */
const mute = (c: RGB, k = 0.35): RGB => mixc(c, P.linen, k);
const CHAR = mixc(P.ink, P.deepNight, 0.45), CHAR2 = mixc(P.ink, P.stoneDark, 0.35);
const smooth = (t: number) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const BAYER8 = (() => { const m = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21]; return m.map((v) => (v + 0.5) / 64); })();
const bayer8 = (x: number, y: number) => BAYER8[((y & 7) << 3) | (x & 7)];

// ------------------------------------------------------------------ tiny sprites (palette)

type Grid = { w: number; h: number; px: (number | null)[] };
const sprCache = new Map<string, HTMLCanvasElement>();
function grid(rows: string[], map: Record<string, RGB>): Grid {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), px: (number | null)[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ch = rows[y][x] ?? '.'; px.push(ch in map ? map[ch] : null); }
  return { w, h, px };
}
function sprite(key: string, make: () => Grid): HTMLCanvasElement {
  let c = sprCache.get(key);
  if (c) return c;
  const g = make();
  c = document.createElement('canvas');
  c.width = g.w; c.height = g.h;
  const cx = c.getContext('2d')!, im = cx.createImageData(g.w, g.h), d = new Uint32Array(im.data.buffer);
  g.px.forEach((v, i) => { if (v !== null) d[i] = pk(v); });
  cx.putImageData(im, 0, 0);
  sprCache.set(key, c);
  return c;
}
const LEAF_ROWS = [
  ['..dd...', '.dmmd..', 'dmlmmd.', 'dmmlmd.', '.dmmld.', '..dmmd.', '...ds..'],
  ['.......', '..ddd..', '.dmmmd.', 'smmlllo', '.dmmmd.', '..ddd..', '.......'],
  ['..sd...', '.dmmd..', '.dlmmd.', '.dmlmmd', '..dmmmd', '...dd..', '.......'],
  ['.......', '..ddd..', '.dmmmd.', 'olllmms', '.dmmmd.', '..ddd..', '.......'],
];
const LEAF_TINTS: [RGB, RGB, RGB][] = [[P.pine, P.fern, P.sage], [P.leaf, P.moss, P.sageLight], [P.woodDark, P.ochre, P.honey], [P.clay, P.terracotta, P.rose], [P.forest, P.leaf, P.moss]].map((t) => t.map((c) => mixc(c, P.stone, 0.3)) as [RGB, RGB, RGB]);
const leafSpr = (tint: number, f: number) => sprite(`lf${tint}_${f}`, () => { const [d, m, l] = LEAF_TINTS[tint % LEAF_TINTS.length]; return grid(LEAF_ROWS[f & 3], { d, m, l, s: P.bark, o: P.bark }); });
const FEATHER_ROWS = [
  ['....w....', '...wcw...', '..wcwcw..', '..wcwcw..', '.wcwqwcw.', '.wcwqwcw.', '.wcwqwcw.', '..wcqcw..', '..wcqcw..', '...wqw...', '....q....', '....q....'],
  ['.....w...', '....wcw..', '...wcwcw.', '..wcwcw..', '..wcwqcw.', '.wcwqwcw.', '.wcwqwc..', '.wcqcw...', '..wqcw...', '..wq.....', '..q......', '.q.......'],
];
const featherSpr = (f: number, warm: boolean) => sprite(`fe${f}${warm}`, () => grid(FEATHER_ROWS[f & 1], { w: warm ? P.cream : P.snow, c: warm ? P.buff : P.frost, q: warm ? P.tawny : P.lilac }));
const FLAKE = ['..w..', '.wfw.', 'wfwfw', '.wfw.', '..w..'];
const flakeSpr = () => sprite('flake', () => grid(FLAKE, { w: P.snow, f: P.ice }));
const MOON = ['....lllll....', '..lllpppll...', '.llpppp......', '.lppppl......', 'llpppl.......', 'lpppp........', 'lpppp........', 'lpppp........', 'llpppl.......', '.lppppl......', '.llpppp......', '..lllpppll...', '....lllll....'];
const moonSpr = () => sprite('moon', () => grid(MOON, { l: P.linen, p: P.paper }));
function sunSpr() {
  return sprite('sun', () => {
    const N = 19, c = N / 2, rows: string[] = [];
    for (let y = 0; y < N; y++) { let r = ''; for (let x = 0; x < N; x++) { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c); r += d < 5.6 ? (d < 3.6 ? 'w' : 'y') : d < 6.6 ? 'o' : ((x === Math.floor(c) || y === Math.floor(c)) && d < 9.5) || (Math.abs(x - y) < 0.6 && d < 8.5 && d > 7) || (Math.abs(x + y - N + 1) < 0.6 && d < 8.5 && d > 7) ? 'r' : '.'; } rows.push(r); }
    return grid(rows, { w: P.snow, y: P.lamp, o: P.honey, r: P.honey });
  });
}
const SPARK = ['...l...', '...w...', 'l.www.l', '.wwwww.', 'l.www.l', '...w...', '...l...'];
const sparkSpr = () => sprite('spark', () => grid(SPARK.map((r, i) => (i === 2 || i === 4 ? r.replace(/l/g, '.') : r)), { w: P.snow, l: P.lamp }));

// ------------------------------------------------------------------ the canvas

interface Item { x: number; y: number; off: number; ph: number; f: number; sp: number; th: number }
interface Run { kind: TransitionKind; W: number; H: number; cx: number; cy: number; img: ImageData; buf: Uint32Array; items: Item[]; t0: number; rev: boolean; mask?: Uint8Array; rect?: { x0: number; y0: number; x1: number; y1: number } }

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
  const r: Run = { kind, W, H, cx: (o.x ?? innerWidth / 2) / B, cy: (o.y ?? innerHeight / 2) / B, img, buf: new Uint32Array(img.data.buffer), items: [], t0: 0, rev: !!o.reverse };
  if (o.rect) r.rect = { x0: Math.floor(o.rect.x / B), y0: Math.floor(o.rect.y / B), x1: Math.ceil((o.rect.x + o.rect.w) / B), y1: Math.ceil((o.rect.y + o.rect.h) / B) };
  const rnd = (i: number, k: number) => hash(i, k, 77);
  if (kind === 'leaves') for (let i = 0; i < Math.ceil(W / 6) * 2 + 24; i++) r.items.push({ x: rnd(i, 1) * (W + 10) - 5, y: 0, off: rnd(i, 2) * 50 - 12, ph: rnd(i, 3) * 6.28, f: i, sp: 0.6 + rnd(i, 4) * 0.8, th: 0 });
  if (kind === 'feathers') for (let i = 0; i < 46; i++) r.items.push({ x: rnd(i, 1) * W, y: rnd(i, 2) * H, off: rnd(i, 6) * 40, ph: rnd(i, 3) * 6.28, f: i, sp: 0.5 + rnd(i, 4) * 0.7, th: rnd(i, 5) });
  if (kind === 'snow') for (let i = 0; i < 90; i++) r.items.push({ x: rnd(i, 1) * W, y: rnd(i, 2) * H, off: 0, ph: rnd(i, 3) * 6.28, f: i, sp: 0.5 + rnd(i, 4), th: rnd(i, 5) });
  if (kind === 'fireflies') for (let i = 0; i < 60; i++) r.items.push({ x: 0, y: 0, off: 12 + rnd(i, 1) * Math.max(W, H) * 0.6, ph: rnd(i, 3) * 6.28, f: i, sp: 0.6 + rnd(i, 4) * 1.2, th: rnd(i, 5) });
  if (kind === 'stars') for (let i = 0; i < 80; i++) r.items.push({ x: Math.floor(rnd(i, 1) * W), y: Math.floor(rnd(i, 2) * H * 0.9), off: 0, ph: rnd(i, 3) * 6.28, f: i, sp: 2 + rnd(i, 4) * 4, th: rnd(i, 5) * 0.8 });
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
  const sprites: [HTMLCanvasElement, number, number, number?][] = [];
  const set = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = c; };
  switch (r.kind) {
    case 'fade':
    case 'dither': {
      // an 8x8 ordered dither with a diagonal drift: the dusk pours in from the top-left
      const c1 = pk(CHAR), c2 = pk(CHAR2), c3 = pk(mixc(CHAR, P.deepNight, 0.5));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const drift = ((x + y) / (W + H)) * 0.5;
        const th = bayer8(x, y) * 0.62 + drift * (r.rev ? -1 : 1) + (r.rev ? 0.5 : 0);
        if (th < cov * 1.12) buf[y * W + x] = hash(x >> 2, y >> 2, 3) > 0.9 ? c2 : (x + y) % 9 === 0 ? c3 : c1;
      }
      break;
    }
    case 'iris': {
      const R = (1 - cov) * (Math.hypot(Math.max(r.cx, W - r.cx), Math.max(r.cy, H - r.cy)) + 4);
      const ink = pk(CHAR), dot = pk(CHAR2), rim = pk(P.brass), rim2 = pk(P.brassDark), hi = pk(P.lamp);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        // a chunky stepped circle: distance measured on a 2-texel grid
        const d = Math.hypot((x >> 1) * 2 + 1 - r.cx, (y >> 1) * 2 + 1 - r.cy);
        if (d > R + 4) buf[y * W + x] = hash(x, y, 3) > 0.985 ? dot : ink;
        else if (d > R && cov > 0.02 && cov < 0.98) buf[y * W + x] = d > R + 2 ? rim2 : (x + y) % 5 === 0 ? hi : rim;
      }
      break;
    }
    case 'leaves': {
      const span = H + 46, edge = (phase === 'in' ? e : e) * span - 22, up = phase === 'out';
      const pal = [P.forest, P.pine, P.leaf, P.fern, P.moss].map((c) => pk(mixc(c, P.stoneDark, 0.38))), rim = pk(mixc(P.forest, P.ink, 0.6));
      for (let x = 0; x < W; x++) {
        const jag = vnoise(x * 0.18, 0, 5) * 8 + Math.sin(x * 0.55) * 2;
        const lim = edge + jag;
        for (let y = 0; y < H; y++) {
          const covered = up ? y > lim : y < lim;
          if (!covered) continue;
          const dEdge = Math.abs(y - lim);
          if (dEdge < 1.5) { buf[y * W + x] = rim; continue; }
          const n = vnoise(x * 0.33, y * 0.33, 9) * 0.65 + hash(x >> 1, y >> 1, 2) * 0.35;
          let i = n > 0.7 ? 4 : n > 0.54 ? 3 : n > 0.38 ? 2 : n > 0.22 ? 1 : 0;
          if (dEdge < 7) i = Math.max(0, i - 1);
          buf[y * W + x] = pal[i];
        }
      }
      for (const it of r.items) {
        const y = up ? edge + it.off - 34 : edge + it.off - 6;
        if (y < -14 || y > H + 14) continue;
        sprites.push([leafSpr(it.f, Math.floor(t * 8 * it.sp + it.ph)), it.x + Math.sin(t * 3 * it.sp + it.ph) * 4, y]);
      }
      break;
    }
    case 'feathers': {
      // an oat-paper cover with a soft scalloped edge of down, rising from the bottom
      const span = H + 40, edge = H + 20 - e * span, up = phase === 'out';
      const paper = pk(P.oat), paper2 = pk(P.linen), fleck = pk(P.cream), shade = pk(mixc(P.linen, P.straw, 0.5));
      for (let x = 0; x < W; x++) {
        const sc = Math.abs(Math.sin(x * 0.22)) * 4 + vnoise(x * 0.2, t, 4) * 3;
        const lim = (up ? H - (edge - 20) : edge) - sc;
        for (let y = 0; y < H; y++) {
          const covered = up ? y < H - lim + sc * 2 - 20 : y > lim;
          if (!covered) continue;
          const d = up ? H - lim + sc * 2 - 20 - y : y - lim;
          buf[y * W + x] = d < 2 ? shade : d < 4 ? fleck : hash(x, y, 4) > 0.97 ? fleck : ((x + (y >> 1)) % 7 === 0 ? paper2 : paper);
        }
      }
      const vis = Math.min(1, cov * 1.6 + 0.2);
      for (const it of r.items) {
        if (it.th > vis) continue;
        const x = ((it.x + Math.sin(t * 1.3 * it.sp + it.ph) * 10) % (W + 16)) - 8;
        const y = ((it.y + t * H * 0.12 * it.sp * (up ? -1 : 1) + it.off) % (H + 30) + H + 30) % (H + 30) - 15;
        sprites.push([featherSpr(Math.floor(t * 2 * it.sp + it.ph), it.f % 3 !== 0), x, y]);
      }
      break;
    }
    case 'snow': {
      const base = [P.snow, P.frost, mixc(P.frost, P.ice, 0.5)];
      const frost = pk(P.snow), deep = pk(P.ice);
      for (let y = 0; y < H; y++) {
        const col = pk(y < H * 0.4 ? base[0] : y < H * 0.75 ? base[1] : base[2]);
        for (let x = 0; x < W; x++) {
          const n = vnoise(x * 0.045 - t * 0.9, y * 0.07 + t * 0.2, 4);
          const v = cov * 1.75 - 0.38 - n * 0.75;
          const streak = cov > 0.08 && vnoise(x * 0.025 - t * 3, y * 0.6, 6) > 0.8;
          if (v > bayer(x, y) * 0.5 || streak) buf[y * W + x] = streak && v <= 0.5 ? frost : hash(x, y, 9) > 0.985 ? deep : col;
        }
      }
      const vis = Math.min(1, cov * 2 + 0.25);
      for (const it of r.items) {
        if (it.th > vis) continue;
        const x = ((it.x + t * W * 0.55 * it.sp) % (W + 20)) - 10, y = ((it.y + t * H * 0.18 * it.sp + Math.sin(t * 2 + it.ph) * 5) % (H + 20)) - 10;
        sprites.push([flakeSpr(), x, y]);
      }
      break;
    }
    case 'fireflies': {
      // dusk closes in from the edges towards the centre in dithered rings
      const far = Math.hypot(Math.max(r.cx, W - r.cx), Math.max(r.cy, H - r.cy));
      const c1 = pk(CHAR), c2 = pk(mixc(CHAR, P.night, 0.4));
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = Math.hypot(x - r.cx, (y - r.cy) * 1.1) / far;
        if (1 - d + bayer(x, y) * 0.35 < (1.35 * (1 - cov)) ) continue;
        buf[y * W + x] = d > 0.55 ? c1 : c2;
      }
      const glow = pk(P.lamp), core = pk(P.snow), halo = pk(mixc(P.lamp, P.moss, 0.5));
      for (const it of r.items) {
        // in: they spiral in towards the centre; out: they scatter outwards and blink off
        const rad = phase === 'in' ? it.off * (1.2 - e * 0.85) : it.off * (0.35 + e * 1.3);
        const a = it.ph + t * it.sp * (it.f % 2 ? 1 : -1) * 1.6;
        const x = Math.round(r.cx + Math.cos(a) * rad), y = Math.round(r.cy + Math.sin(a) * rad * 0.8);
        if (phase === 'out' && it.th < e * 1.1) continue;
        if (Math.sin(t * 7 * it.sp + it.ph) < -0.6) continue; // blink
        set(x, y, core); set(x - 1, y, glow); set(x + 1, y, glow); set(x, y - 1, glow); set(x, y + 1, glow);
        if (it.f % 3 === 0) { set(x - 1, y - 1, halo); set(x + 1, y + 1, halo); set(x + 1, y - 1, halo); set(x - 1, y + 1, halo); }
      }
      break;
    }
    case 'page': {
      // the page sweeps across (right to left, or left to right when reversed) with a curled lip
      const span = W + 22, rev = r.rev;
      const pos = phase === 'in' ? e : e; // edge travels the same way in both phases
      const xe0 = W + 11 - pos * span;
      const paper = pk(P.paper), paper2 = pk(P.oat), line = pk(mixc(P.lake, P.paper, 0.55)), margin = pk(P.rose), curl = pk(P.snow), curl2 = pk(P.linen), ink = pk(P.woodDeep), shade = pk(P.ink, 70), fleck = pk(P.linen);
      for (let y = 0; y < H; y++) {
        const lean = (1 - y / H) * 16 * Math.sin(pos * Math.PI);
        for (let x = 0; x < W; x++) {
          const X = rev ? W - 1 - x : x;
          const xs = xe0 + lean;
          const covered = phase === 'in' ? X > xs : X < xs;
          const d = phase === 'in' ? X - xs : xs - X;
          if (covered) {
            let c = y % 9 === 7 ? line : (y >> 4) % 2 ? paper : paper2;
            if (X === Math.round(W * 0.14) || X === Math.round(W * 0.14) + 1) c = margin;
            if (hash(X, y, 4) > 0.975) c = fleck;
            if (d < 1) c = ink; else if (d < 3) c = curl; else if (d < 7) c = (X + y) % 2 ? curl2 : curl;
            buf[y * W + x] = c;
          } else if (-d < 12 && (X + y) % 2 === 0 && cov > 0.02) buf[y * W + x] = shade;
        }
      }
      break;
    }
    case 'blinds': {
      const SL = 9, rows = Math.ceil(H / SL);
      const wood = [P.woodDeep, P.woodDark, P.wood, P.woodLight, P.woodPale].map((c) => pk(c)), gap = pk(P.barkDark), cord = pk(P.linen);
      for (let k = 0; k < rows; k++) {
        const lag = (r.rev ? rows - 1 - k : k) / rows * 0.45;
        const q = clamp((cov - lag) / 0.55, 0, 1);
        const hgt = Math.round(q * SL);
        if (!hgt) continue;
        const y0 = k * SL + Math.floor((SL - hgt) / 2);
        for (let y = y0; y < y0 + hgt && y < H; y++) {
          const v = (y - y0) / Math.max(1, hgt - 1);
          for (let x = 0; x < W; x++) {
            let i = v < 0.2 ? 4 : v < 0.5 ? 3 : v < 0.85 ? 2 : 1;
            if (hgt < 3) i = 1;
            if (vnoise(x * 0.12, y * 0.9 + k * 7, 8) > 0.68) i = Math.max(0, i - 1); // grain
            buf[y * W + x] = y === y0 + hgt - 1 && hgt === SL ? gap : wood[i];
          }
        }
        // the ladder cords
        for (const cx of [Math.round(W * 0.2), Math.round(W * 0.8)]) for (let y = y0; y < y0 + hgt && y < H; y++) set(cx, y, cord);
      }
      break;
    }
    case 'mosaic': {
      const T = 8, cols = Math.ceil(W / T), rows = Math.ceil(H / T);
      const faces: [number, number, number][] = [[P.linen, P.oat, P.straw], [P.oat, P.paper, P.linen], [mute(P.sage, 0.45), mute(P.sageLight, 0.45), mute(P.moss, 0.45)], [P.linen, P.oat, P.straw], [P.straw, P.linen, mixc(P.straw, P.woodLight, 0.5)]].map((f) => f.map((c) => pk(c)) as [number, number, number]);
      const ink = pk(P.ink3);
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const order = ((r.rev ? cols - i + rows - j : i + j) / (cols + rows)) * 0.6 + hash(i, j, 12) * 0.25;
        const q = clamp((cov - order) / 0.15, 0, 1);
        const s = Math.round(q * T / 2) * 2;
        if (!s) continue;
        const [f, hi, lo] = faces[(i + j * 3 + ((i * 7 + j * 3) % 2)) % faces.length];
        const x0 = i * T + (T - s) / 2, y0 = j * T + (T - s) / 2;
        for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
          let c = f;
          if (x === 0 || y === 0) c = hi; if (x === s - 1 || y === s - 1) c = lo;
          if (s === T && ((x === 3 && y >= 2 && y <= 5) || (y === 3 && x >= 2 && x <= 5)) && (i + j) % 3 === 0) c = lo; // a little leaf cross stitched in
          set(x0 + x, y0 + y, c);
        }
        if (s === T) set(x0 + T - 1, y0 + T - 1, ink);
      }
      break;
    }
    case 'branch': {
      // a leafy branch sweeps left to right (right to left reversed), dusk behind it
      const span = W + 60, front = e * span - 30, rev = r.rev;
      const dusk = pk(CHAR), dusk2 = pk(mixc(CHAR, P.pine, 0.25)), bark = [P.barkDark, P.bark, P.woodDark].map((c) => pk(c));
      const edgeAt = (y: number) => front + Math.sin(y * 0.09 + 1) * 6 + Math.sin(y * 0.23) * 2;
      for (let y = 0; y < H; y++) {
        const ex = edgeAt(y);
        for (let x = 0; x < W; x++) {
          const X = rev ? W - 1 - x : x;
          const covered = phase === 'in' ? X < ex : X > ex;
          if (!covered) continue;
          buf[y * W + x] = vnoise(X * 0.08, y * 0.08, 2) > 0.6 ? dusk2 : dusk;
        }
        // the bough itself, along the edge
        for (let k = -2; k <= 1; k++) { const X = Math.round(ex) + k; set(rev ? W - 1 - X : X, y, bark[k < -1 ? 0 : k < 1 ? 1 : 2]); }
      }
      if (cov > 0.01 && cov < 0.99) for (let i = 0; i < Math.ceil(H / 7); i++) {
        const y = i * 7 + 3, ex = edgeAt(y), side = i % 2 ? 4 : -2;
        const X = ex + side;
        sprites.push([leafSpr(i % 3 === 0 ? 2 : i % 2, (i + Math.floor(t * 6)) & 3), rev ? W - 1 - X : X, y + Math.sin(t * 5 + i) * 1.5]);
      }
      break;
    }
    case 'clock': {
      // a hand sweeps round from 12 o'clock and paints a cream dial behind it
      const R = Math.hypot(Math.max(r.cx, W - r.cx), Math.max(r.cy, H - r.cy)) + 2;
      const sweep = cov * Math.PI * 2 * (phase === 'out' ? 1 : 1);
      const face = pk(P.oat), face2 = pk(mixc(P.oat, P.paper, 0.5)), tick = pk(P.ink2), hand = pk(P.slate), handHi = pk(P.lake), tip = pk(P.ink);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        let a = Math.atan2(x - r.cx, -(y - r.cy)); // 0 at 12, clockwise
        if (r.rev) a = -a;
        if (a < 0) a += Math.PI * 2;
        const covered = phase === 'in' ? a <= sweep : a > Math.PI * 2 - sweep;
        if (!covered) continue;
        // a plain paper dial, faintly mottled, with one row of minute ticks
        const d = Math.hypot(x - r.cx, y - r.cy), RT = Math.min(W, H) * 0.42;
        let c = vnoise(x * 0.09, y * 0.09, 6) > 0.7 ? face2 : face;
        const m = (a / (Math.PI * 2)) * 60;
        if (d > RT - (Math.round(m) % 5 === 0 ? 6 : 3) && d < RT && Math.abs(m - Math.round(m)) * (d * 0.105) < 0.55) c = tick;
        buf[y * W + x] = c;
      }
      if (cov > 0.01 && cov < 0.99) {
        const ha = phase === 'in' ? sweep : Math.PI * 2 - sweep;
        const s = r.rev ? -1 : 1;
        for (let d = -6; d < R; d += 0.5) {
          const hx = r.cx + Math.sin(ha * s) * d, hy = r.cy - Math.cos(ha * s) * d;
          set(Math.round(hx), Math.round(hy), d > R - 10 ? tip : hand);
          set(Math.round(hx + Math.cos(ha * s)), Math.round(hy + Math.sin(ha * s)), handHi);
        }
        for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) set(Math.round(r.cx) + x, Math.round(r.cy) + y, pk(P.brass));
      }
      break;
    }
    case 'curtain': {
      // two velvet curtains slide in from the sides on a brass rail (they open the same way)
      const half = Math.ceil(W / 2) + 4, reach = e * half;
      const vel = [mixc(P.straw, P.woodDark, 0.35), P.straw, P.linen, P.oat].map((c) => pk(c)), rail = [P.woodDeep, P.wood, P.woodLight].map((c) => pk(c)), fringe = pk(mixc(P.straw, P.rose, 0.35));
      const amt = phase === 'in' ? reach : half - reach;
      for (const side of [0, 1]) {
        for (let k = 0; k < amt; k++) {
          const x = side ? W - 1 - k : k, lead = amt - k; // 0 at the leading edge
          const fold = Math.sin((k / Math.max(6, amt)) * Math.PI * 7 + side);
          let i = fold > 0.55 ? 3 : fold > 0 ? 2 : fold > -0.6 ? 1 : 0;
          if (lead < 3) i = Math.max(0, i - 1);
          for (let y = 3; y < H; y++) {
            const scal = lead < 5 && y > H - 8 + lead ? -1 : i; // the hem gathers at the leading corner
            if (scal < 0) continue;
            buf[y * W + x] = y > H - 4 ? fringe : vel[(y + x) % 23 === 0 ? Math.max(0, scal - 1) : scal];
          }
        }
      }
      for (let y = 0; y < 3; y++) for (let x = 0; x < W; x++) if (cov > 0.01) buf[y * W + x] = rail[y === 1 ? 2 : y === 0 ? 1 : 0];
      break;
    }
    case 'blueprint': {
      const span = H + 16;
      const yr = phase === 'in' ? e * span - 8 : (1 - e) * span - 8;
      const bp = mixc(P.slate, P.stone, 0.45), base = pk(bp), minor = pk(mixc(bp, P.mist, 0.15)), major = pk(mixc(bp, P.mist, 0.32)), draw = pk(P.paper), shadow = pk(P.ink, 80);
      const roll = [P.slate, P.dusk, P.lake, P.sky, P.mist, P.sky, P.lake, P.dusk, P.slate].map((c) => pk(mixc(c, P.stone, 0.45)));
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
      // the night falls in dithered bands from the top
      const bands = [P.deepNight, mixc(P.deepNight, P.night, 0.5), P.night, mixc(P.night, P.slate, 0.4), mixc(P.night, P.stoneDark, 0.45)];
      for (let y = 0; y < H; y++) {
        const k = y / H, col = pk(bands[Math.min(bands.length - 1, Math.floor(k * bands.length + bayer(0, y) * 0.6))]);
        for (let x = 0; x < W; x++) if (bayer8(x, y) < cov * 1.18 - (1 - k) * 0.14) buf[y * W + x] = col;
      }
      const s1 = pk(P.lamp), s2 = pk(P.lavender), s3 = pk(P.snow);
      for (const it of r.items) {
        if (cov < it.th + 0.1) continue;
        const tw = Math.sin(t * it.sp + it.ph);
        const i = it.y * W + it.x;
        buf[i] = tw > 0.3 ? s3 : tw > -0.3 ? s1 : s2;
        if (tw > 0.8 && it.x > 0 && it.x < W - 1 && it.y > 0 && it.y < H - 1) { buf[i - 1] = s2; buf[i + 1] = s2; buf[i - W] = s2; buf[i + W] = s2; }
      }
      if (cov > 0.35) sprites.push([moonSpr(), W * 0.62, H * 0.32 + (1 - cov) * 18, Math.min(1, (cov - 0.35) * 2.5)]);
      break;
    }
    case 'sunrise': {
      // dawn bands; the sun climbs and the bands peel away upwards as it reveals
      const bands = [P.dusk, P.lilac, P.rose, P.blush, P.honey, P.lamp].map((c) => pk(mute(c, 0.4)));
      const sunY = H * (0.95 - (phase === 'in' ? e * 0.3 : 0.3 + e * 0.45));
      for (let y = 0; y < H; y++) {
        const k = y / H, bi = Math.min(bands.length - 1, Math.floor(k * bands.length * 1.05));
        for (let x = 0; x < W; x++) {
          const th = phase === 'in' ? bayer8(x, y) * 0.5 + (1 - k) * 0.5 : bayer8(x, y) * 0.5 + k * 0.5;
          if (th > cov * 1.02) continue;
          const shim = vnoise(x * 0.05 + t * 0.4, y * 0.3, 7) > 0.72 ? 1 : 0;
          buf[y * W + x] = bands[Math.min(bands.length - 1, bi + shim)];
        }
      }
      if (cov > 0.05) sprites.push([sunSpr(), r.cx, sunY, Math.min(1, cov * 2)]);
      break;
    }
  }
  if (r.rect) { // a local wipe: clear outside the rectangle
    const { x0, y0, x1, y1 } = r.rect;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < x0 || y < y0 || x >= x1 || y >= y1) buf[y * W + x] = CLEAR;
  }
  ctx!.putImageData(r.img, 0, 0);
  if (r.rect) { ctx!.save(); ctx!.beginPath(); ctx!.rect(r.rect.x0, r.rect.y0, r.rect.x1 - r.rect.x0, r.rect.y1 - r.rect.y0); ctx!.clip(); }
  for (const [im, x, y, a] of sprites) {
    ctx!.globalAlpha = a ?? 1;
    ctx!.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height / 2));
  }
  if (r.rect) ctx!.restore();
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
  for (let a = 0; a < Math.PI / 2; a += 0.06) set(mx - 6 + Math.cos(a) * 6, my - Math.sin(a) * 6);
  const tw = Math.max(3, Math.round(W * 0.05));
  rect(Math.round((L + mx) / 2) - tw, Math.round((T + my) / 2) - tw, Math.round((L + mx) / 2) + tw, Math.round((T + my) / 2) + tw);
  rect(mx + 4, T + 4, R - 6, T + 4 + Math.round((my - T) * 0.4), 1);
  const dy = Bm + 6;
  for (let x = L; x <= R; x++) set(x, dy);
  for (let k = -2; k <= 2; k++) { set(L, dy + k); set(R, dy + k); }
  const tx0 = Math.round(W * 0.52), ty0 = Math.round(H * 0.78);
  rect(tx0, ty0, R, Math.round(H * 0.9));
  for (let i = 1; i < 3; i++) for (let x = tx0 + 3; x < R - 3 - i * 6; x++) set(x, ty0 + i * 4);
  return m;
}

// ------------------------------------------------------------------ running

// [audio3] soft hand-made whooshes and real foley (sfx sprites): cloth, leaves, pages, paper, chimes
const SOUND: Partial<Record<TransitionKind, [string, number, number?]>> = {
  iris: ['whoosh_soft', 0.4], dither: ['whoosh_soft', 0.25, 0.9], fade: ['whoosh_soft', 0.2, 0.85], leaves: ['leaf_rustle', 0.5], feathers: ['feather_ruffle', 0.4, 0.85], snow: ['star_shimmer', 0.3, 0.9],
  fireflies: ['sparkle_fizz', 0.3], page: ['page_turn', 0.55], blinds: ['whoosh_cloth', 0.35, 1.2], mosaic: ['tick_paper', 0.45], branch: ['leaf_rustle', 0.5, 0.85], clock: ['clock_wind', 0.35, 1.2],
  curtain: ['whoosh_cloth', 0.5], blueprint: ['paper_rustle', 0.45], stars: ['chime_sweep', 0.25, 0.9], sunrise: ['bird_song', 0.3],
};
const DUR: Record<TransitionKind, [number, number]> = {
  iris: [0.5, 0.55], dither: [0.4, 0.45], fade: [0.35, 0.4], leaves: [0.6, 0.7], feathers: [0.6, 0.7], snow: [0.6, 0.65], fireflies: [0.6, 0.7], page: [0.55, 0.55],
  blinds: [0.5, 0.5], mosaic: [0.5, 0.55], branch: [0.55, 0.6], clock: [0.55, 0.55], curtain: [0.5, 0.55], blueprint: [0.65, 0.6], stars: [0.6, 0.8], sunrise: [0.5, 1.2],
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

/** Cover the screen with a pixel transition, run `mid`, then reveal the new place. */
export async function transition(kind: TransitionKind, mid?: () => void | Promise<void>, o: TransitionOpts = {}): Promise<void> {
  if (typeof document === 'undefined' || busy) { await mid?.(); return; }
  busy = true;
  try {
    if (reducedMotion()) kind = 'dither';
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
    if (cv) { ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; cv.style.pointerEvents = 'none'; }
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
  const r = setup(kind, o);
  r.t0 = 0;
  paint(r, phase, p, t);
}
export function clearTransition() { if (cv) { ctx?.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; } }

// ------------------------------------------------------------------ which transition for which change of place

const OPEN: Partial<Record<NonNullable<Panel>, [TransitionKind, TransitionOpts?]>> = {
  sleep: ['stars'], clock: ['clock'], book: ['page'], build: ['blueprint'], decorate: ['blueprint'], shop: ['leaves'], wardrobe: ['curtain'],
  map: ['branch', { speed: 1.15 }], quests: ['mosaic', { speed: 1.3 }], settings: ['blinds', { speed: 1.2 }], breathe: ['fireflies'], night: ['stars'],
};
const CLOSE: Partial<Record<NonNullable<Panel>, [TransitionKind, TransitionOpts?]>> = {
  sleep: ['stars', { speed: 1.25 }], clock: ['clock', { reverse: true, speed: 1.35 }], book: ['page', { reverse: true, speed: 1.25 }], build: ['blueprint', { speed: 1.3 }], decorate: ['blueprint', { speed: 1.3 }],
  shop: ['leaves', { speed: 1.2 }], wardrobe: ['curtain', { speed: 1.3 }], map: ['leaves', { speed: 1.35 }], quests: ['dither', { speed: 1.4 }], settings: ['blinds', { reverse: true, speed: 1.4 }],
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

/** Wipe one rectangle (e.g. the interview clipboard page) with a quick pixel transition, swapping its content in `mid`. */
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
  Object.assign(fcv.style, { position: 'fixed', left: '0', top: '0', zIndex: '55', pointerEvents: 'none', imageRendering: 'pixelated', display: 'none' });
  document.body.appendChild(fcv);
  fctx = fcv.getContext('2d');
}
/** A short pixel flourish over everything that does not block input: letterbox bars, a level-up burst, a sparkle pop. */
export function flourish(kind: Fl['kind'], o: { x?: number; y?: number } = {}) {
  if (typeof document === 'undefined' || reducedMotion()) return;
  fensure();
  const dur = kind === 'letterbox' ? 1.5 : kind === 'levelup' ? 1.1 : 0.6;
  const ex = flList.find((f) => f.kind === kind);
  if (ex && kind === 'letterbox') { ex.t0 = Math.min(ex.t0, performance.now() - 0.3 * 1000); return; }
  flList.push({ kind, t0: performance.now(), dur, x: (o.x ?? innerWidth / 2) / B, y: (o.y ?? innerHeight * 0.42) / B });
  if (!fraf) fraf = requestAnimationFrame(floop);
}
function floop(now: number) {
  fraf = 0;
  const W = Math.ceil(innerWidth / B), H = Math.ceil(innerHeight / B);
  if (fcv!.width !== W || fcv!.height !== H) { fcv!.width = W; fcv!.height = H; fcv!.style.width = `${W * B}px`; fcv!.style.height = `${H * B}px`; }
  fcv!.style.display = 'block';
  const g = fctx!;
  g.clearRect(0, 0, W, H);
  for (let i = flList.length - 1; i >= 0; i--) {
    const f = flList[i], t = (now - f.t0) / 1000 / f.dur;
    if (t >= 1) { flList.splice(i, 1); continue; }
    if (f.kind === 'letterbox') {
      // bars slide in, hold while the camera moves, slide out (in whole texels)
      const k = t < 0.2 ? smooth(t / 0.2) : t > 0.78 ? 1 - smooth((t - 0.78) / 0.22) : 1;
      const bh = Math.round(k * Math.min(26, H * 0.075));
      if (bh > 0) {
        g.fillStyle = '#' + P.deepNight.toString(16).padStart(6, '0');
        g.fillRect(0, 0, W, bh); g.fillRect(0, H - bh, W, bh);
        g.fillStyle = '#' + P.brassDark.toString(16).padStart(6, '0');
        g.fillRect(0, bh - 1, W, 1); g.fillRect(0, H - bh, W, 1);
      }
    } else if (f.kind === 'levelup') {
      // stepped rings of light and eight rays bursting from the point, then sparkles
      const R = smooth(t) * Math.hypot(W, H) * 0.6;
      const cols = [P.lamp, P.honey, P.snow];
      for (let k = 0; k < 3; k++) {
        const rr = R - k * 7;
        if (rr <= 0) continue;
        g.fillStyle = '#' + cols[k].toString(16).padStart(6, '0');
        g.globalAlpha = (1 - t) * (k === 2 ? 0.6 : 0.9);
        const n = Math.ceil(rr * 6);
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.fillRect(Math.round(f.x + Math.cos(a) * rr), Math.round(f.y + Math.sin(a) * rr), 1, 1); }
      }
      g.globalAlpha = Math.max(0, 1 - t * 1.2);
      g.fillStyle = '#' + P.lamp.toString(16).padStart(6, '0');
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        for (let d = R * 0.3; d < R * 0.75; d += 1) if ((d | 0) % 3 !== 0) g.fillRect(Math.round(f.x + Math.cos(a) * d), Math.round(f.y + Math.sin(a) * d), 1, 1);
      }
      const sp = sparkSpr();
      for (let i = 0; i < 10; i++) {
        const a = i * 2.39996, d = R * (0.4 + hash(i, 1, 5) * 0.5);
        if (Math.sin(t * 20 + i) < -0.3) continue;
        g.drawImage(sp, Math.round(f.x + Math.cos(a) * d - 3), Math.round(f.y + Math.sin(a) * d - 3));
      }
      g.globalAlpha = 1;
    } else {
      const sp = sparkSpr(), R = smooth(t) * 14;
      g.globalAlpha = 1 - t;
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.drawImage(sp, Math.round(f.x + Math.cos(a) * R - 3), Math.round(f.y + Math.sin(a) * R - 3)); }
      g.globalAlpha = 1;
    }
  }
  if (flList.length) fraf = requestAnimationFrame(floop);
  else fcv!.style.display = 'none';
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
