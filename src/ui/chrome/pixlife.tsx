// [artpass] Small pixel-art life for the interface, hand-placed pixel by pixel in the game's palette and always shown at a
// whole number of device pixels per art pixel (the game's art pixel, src/gfx/artpx.ts, through any CSS zoom):
//   SignSnail     a garden snail inching along the top of the name sign, eye stalks waving, now and then turning round
//   SignLadybird  a ladybird on the acorn sign: it ambles, stops, lifts its wing cases and hops somewhere new
//   NightMoths    two pale moths fluttering round the signs at night (the fireflies are src/ui/chrome/uifx.ts)
//   SkyBadge      a round brass window hanging under the moon-gem sign: tonight's real moon phase, or the sun, with the
//                 Hollow's weather drifting across it; a tap and Pip says what the sky is doing
//   NightStars    the night screen's sky: crisp pixel stars that twinkle slowly, a few four-point sparkles, now and then a
//                 shooting star
//   PxDivider     a pixel vine with oak leaves and an acorn, for between sections of a panel
//   PxCorners     little pixel ivy sprigs in a panel's corners
// "Calm motion" (the hh-still setting, or the system's reduced motion) holds every one of them still.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { artPx, artPxSignal } from '../../gfx/artpx.ts';
import { Art, hash } from '../px/sleepart.ts';
import { moonPhase } from '../px/sleepprops.ts';
import { moonArt } from '../px/nightart.ts';
import { weather, type WeatherKind } from '../../world/weather.ts';
import { reducedMotion } from './swing.ts';

// ------------------------------------------------------------------ the painter

/** the screen's device pixels per CSS px */
const DPR = () => (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? devicePixelRatio : 1);
/** device px per art px for something shown through a CSS `zoom` (the HUD's 1.5 on big screens): whole, never 0 */
export const devPer = (zoom = 1) => Math.max(1, Math.round(artPx() * DPR() * zoom));
/** CSS px (before the zoom) per art px, so that after the zoom an art pixel covers whole device pixels */
export const cssPer = (zoom = 1) => devPer(zoom) / (DPR() * zoom);

/** sprite rows: each character a key into `pal` ('.' is empty); drawn at (x, y), mirrored when `flip` */
export function rows(a: Art, r: string[], pal: Record<string, string>, x: number, y: number, flip = false) {
  const w = r[0].length;
  for (let j = 0; j < r.length; j++) for (let i = 0; i < w; i++) {
    const ch = r[j][i];
    if (ch === '.' || ch === ' ') continue;
    const c = pal[ch];
    if (c) a.px(x + (flip ? w - 1 - i : i), y + j, c);
  }
}

const still = () => reducedMotion();

/**
 * A crisp pixel canvas `w` x `h` art px. `draw(a, t, f)` paints into an Art (t seconds, f = frame at `fps`); it is
 * redrawn at `fps` while motion is on, and painted once (at `stillT`) when it is off.
 */
export function PixArt(p: { w: number; h: number; fps: number; zoom?: number; draw: (a: Art, t: number, f: number) => void; class?: string; style?: JSX.CSSProperties; label?: string; stillT?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(p.draw);
  drawRef.current = p.draw;
  void artPxSignal.value; // re-size when the art pixel changes
  const S = devPer(p.zoom ?? 1), css = cssPer(p.zoom ?? 1);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const g = cv.getContext('2d')!;
    const a = new Art(p.w, p.h), src = document.createElement('canvas');
    src.width = p.w; src.height = p.h;
    const sg = src.getContext('2d')!;
    const t0 = performance.now();
    const paint = (t: number) => {
      a.clear();
      drawRef.current(a, t, Math.floor(t * p.fps));
      a.put(sg);
      g.imageSmoothingEnabled = false;
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(src, 0, 0, cv.width, cv.height);
    };
    let raf = 0, last = -1, wasStill = still();
    paint(wasStill ? p.stillT ?? 0 : 0);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const s = still();
      if (s) { if (!wasStill) paint(p.stillT ?? 0); wasStill = true; return; }
      wasStill = false;
      const t = (now - t0) / 1000, f = Math.floor(t * p.fps);
      if (f === last) return;
      last = f;
      paint(t);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [p.w, p.h, p.fps, S]);
  return <canvas ref={ref} class={'pixlife ' + (p.class ?? '')} width={p.w * S} height={p.h * S} aria-hidden={p.label ? undefined : true} role={p.label ? 'img' : undefined} aria-label={p.label}
    style={{ width: `${p.w * css}px`, height: `${p.h * css}px`, imageRendering: 'pixelated', ...(p.style ?? {}) }} />;
}

// ------------------------------------------------------------------ the snail

const INKC = '#2a1a14';
const SNAIL_PAL: Record<string, string> = {
  S: '#b8743a', s: '#6e3c20', h: '#f0c890', H: '#e3c9a2', B: '#d8c2a0', b: '#9c8268', a: '#cdb592', e: '#3a2a22', o: INKC,
};
// facing right; the shell's spiral turns in from its rim, the foot runs out in front, eye stalks up
const SNAIL = [
  '..oooo.......e.e',
  '.oShhSo......a.a',
  'oShSsSSo.....aa.',
  'oSsSSsSo....HHH.',
  'oSsShsSo...HHHHo',
  'oSSsssSo..HHHHHo',
  '.oSSSSo.BBBBBBo.',
  'BBossoBBBBBBBBBo',
  'obbbbbbbbbbbbbo.',
];
const SNAIL_STRETCH = [
  '..oooo........e.e',
  '.oShhSo.......a.a',
  'oShSsSSo......aa.',
  'oSsSSsSo.....HHH.',
  'oSsShsSo....HHHHo',
  'oSSsssSo...HHHHHo',
  '.oSSSSo.BBBBBBBo.',
  'BBossoBBBBBBBBBBo',
  'obbbbbbbbbbbbbbo.',
];
const SNAIL_HIDE = [
  '................',
  '..oooo..........',
  '.oShhSo.........',
  'oShSsSSo........',
  'oSsSSsSo........',
  'oSsShsSo........',
  'oSSsssSo........',
  '.oSSSSoo........',
  '.obbbbbo........',
];

/** The garden snail on the name sign's top edge, between its ropes. `zoom`: the sign's CSS zoom. */
export function SignSnail(p: { zoom?: number; from: number; to: number }) {
  const css = cssPer(p.zoom ?? 1);
  const W = Math.max(24, Math.floor((p.to - p.from) / css)), H = 10;
  // one stride every 1.4 s: stretch the foot forward, then the shell catches up; a rest now and then; at an end, turn
  const draw = (a: Art, t: number) => {
    const span = W - 17, step = 1.4, legT = span * step, rest = 7;
    const cyc = (legT + rest) * 2, u = ((t + 23) % cyc + cyc) % cyc;
    const back = u >= legT + rest, k = back ? u - legT - rest : u;
    const moving = k < legT, n = Math.min(span, Math.floor(k / step));
    const x = back ? span - n : n, flip = back;
    const ph = (k / step) % 1;
    // a long pause: in it tucks into its shell for a while
    const hide = !moving && k - legT > 1.2 && k - legT < rest - 1.6;
    const spr = hide ? SNAIL_HIDE : moving && ph > 0.5 ? SNAIL_STRETCH : SNAIL;
    const ox = flip && spr === SNAIL_STRETCH ? x - 1 : x;
    rows(a, spr, SNAIL_PAL, ox, 1, flip);
    // the eye stalks sway a pixel now and then
    if (!hide && Math.sin(t * 1.7) > 0.7) {
      const ex = flip ? ox + (spr[0].length - 1 - 13) : ox + 13;
      a.d[1 * W + ex] = 0;
    }
  };
  return <PixArt w={W} h={H} fps={6} zoom={p.zoom} draw={draw} class="pl-snail" stillT={30} style={{ left: `${p.from}px` }} />;
}

// ------------------------------------------------------------------ the ladybird

const LB_PAL: Record<string, string> = { R: '#c8322a', r: '#f08a6a', k: '#2a1a14', K: '#2a1a14', w: '#f6eee0', l: '#3a2a22', v: '#d8d4ec', o: INKC };
const LB_WALK = [
  ['...oooo...', '..oRrRRo..', '.oRRRRkRo.', 'oRkRRRRRKo', 'oRRRkRRRKK', '.oooooooKo', '..l..l..l.'],
  ['...oooo...', '..oRrRRo..', '.oRRRRkRo.', 'oRkRRRRRKo', 'oRRRkRRRKK', '.oooooooKo', '.l..l..l..'],
];
const LB_OPEN = [
  ['v..oooo...', 'vvoRrRRo..', '.voRRRRkRo', '..oRkRRRKo', 'oooRRRRRKK', '.v.oooooKo', '..l..l..l.'],
  ['.v.oooo...', 'vv.oRrRRo.', 'vvoRRRRkRo', '.voRkRRRKo', 'oooRRRRRKK', 'v..oooooKo', '..l..l..l.'],
];

/** The ladybird on the acorn sign's top edge. */
export function SignLadybird(p: { zoom?: number; width: number }) {
  const css = cssPer(p.zoom ?? 1);
  const W = Math.max(20, Math.floor(p.width / css)), H = 12;
  const draw = (a: Art, t: number, f: number) => {
    // a 26 s routine: amble right, pause, open the wing cases, hop to a new spot, amble back
    const T = 26, u = ((t % T) + T) % T, span = W - 11;
    let x: number, y = H - 7, spr = LB_WALK[0], flip = false;
    const home = Math.round(span * 0.2), far = Math.round(span * 0.75);
    if (u < 8) { x = Math.min(far, home + Math.floor(u / 0.5)); spr = x < far ? LB_WALK[f % 2] : LB_WALK[0]; }
    else if (u < 12) { x = far; }
    else if (u < 13.4) { x = far; spr = LB_OPEN[f % 2]; }
    else if (u < 14.6) { const k = (u - 13.4) / 1.2; x = Math.round(far + (Math.round(span * 0.45) - far) * k); y -= Math.round(Math.sin(k * Math.PI) * 4); spr = LB_OPEN[f % 2]; flip = true; }
    else { const k = Math.floor((u - 14.6) / 0.6); x = Math.max(home, Math.round(span * 0.45) - k); spr = x > home ? LB_WALK[f % 2] : LB_WALK[0]; flip = x > home; }
    rows(a, spr, LB_PAL, x, y, flip);
  };
  return <PixArt w={W} h={H} fps={8} zoom={p.zoom} draw={draw} class="pl-ladybird" stillT={10} />;
}

// ------------------------------------------------------------------ moths at night

const MOTH = [
  ['WW...WW', 'WwWbWwW', '.WWbWW.', '..WbW..', '...b...'],
  ['..W.W..', '.WWbWW.', '.WwbwW.', '..WbW..', '...b...'],
  ['...b...', '..WbW..', '..WbW..', '..WbW..', '...b...'],
];
const MOTH_PAL: Record<string, string> = { W: '#ece4d4', w: '#a89cc0', b: '#6e5440' };

/**
 * Two pale moths in loose, wandering loops over the top of the screen while it is night at home. `on` turns them on
 * and off (they finish their loop off-screen).
 */
export function NightMoths(p: { on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const onRef = useRef(p.on);
  onRef.current = p.on;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const g = cv.getContext('2d')!;
    const sprites = MOTH.map((r) => { const a = new Art(7, 5); rows(a, r, MOTH_PAL, 0, 0); return a.canvas(); });
    let raf = 0, alpha = 0, last = performance.now();
    const fit = () => { cv.width = Math.round(innerWidth * DPR()); cv.height = Math.round(Math.min(innerHeight, 320) * DPR()); };
    fit();
    addEventListener('resize', fit);
    const moths = [0, 1].map((i) => ({ ph: i * 2.7, ax: 0.3 + i * 0.36, ay: 70 + i * 60, rx: 60 + i * 30, ry: 26 + i * 10, sp: 0.42 + i * 0.13 }));
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      const want = onRef.current && !still() ? 1 : 0;
      alpha += Math.sign(want - alpha) * Math.min(Math.abs(want - alpha), dt * 0.6);
      g.clearRect(0, 0, cv.width, cv.height);
      if (alpha <= 0.01) return;
      const S = devPer(), t = now / 1000;
      g.imageSmoothingEnabled = false;
      g.globalAlpha = alpha * 0.9;
      for (const m of moths) {
        // a wandering loop with a flutter: a figure of eight drifting across, jitter on top
        const a = t * m.sp + m.ph;
        const x = (m.ax + Math.sin(a * 0.23) * 0.12) * innerWidth + Math.sin(a) * m.rx + Math.sin(a * 3.7) * 6;
        const y = m.ay + Math.sin(a * 2) * m.ry + Math.sin(a * 5.3) * 4;
        // wings beat fast, with short glides
        const glide = Math.sin(a * 0.9) > 0.8;
        const fr = glide ? 0 : Math.floor(t * 14 + m.ph * 3) % 4;
        const im = sprites[fr === 3 ? 1 : fr];
        const X = Math.round((x * DPR()) / S) * S, Y = Math.round((y * DPR()) / S) * S;
        g.drawImage(im, X, Y, 7 * S, 5 * S);
      }
      g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
  }, []);
  return <canvas ref={ref} class="pl-moths" aria-hidden="true" />;
}

// ------------------------------------------------------------------ the sky badge

const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
/** the name of tonight's moon */
export const phaseName = (ph = moonPhase()) => PHASES[Math.round(ph * 8) % 8];
const WEATHER_LINE: Record<WeatherKind, string> = {
  clear: 'Clear skies over the Hollow.', clouds: 'Clouds drifting over the Hollow.', rain: 'Rain pattering on the leaves.',
  storm: 'A storm rumbling over the hills.', snow: 'Snow falling softly in the woods.', fog: 'Fog curling between the trees.',
};

/** a small pixel cloud, `w` wide, lit from the top */
function pcloud(a: Art, x: number, y: number, w: number, dark: boolean) {
  const top = dark ? '#a4acbc' : '#f4f2ec', mid = dark ? '#7c8496' : '#d4d8e0', low = dark ? '#5a6274' : '#aab2c2';
  const h = Math.max(3, Math.round(w * 0.42));
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = (i + 0.5) / w - 0.5, v = (j + 0.5) / h;
    const bump = 0.55 + 0.22 * Math.cos(u * 9) - Math.abs(u) * 0.6;
    if (1 - v > bump + 0.05 && j < h - 1) continue;
    if (Math.abs(u) > 0.5 - (j === h - 1 ? 0.04 : 0)) continue;
    a.px(x + i, y + j, j === 0 || (1 - v) > bump - 0.12 ? top : j < h - 1 ? mid : low);
  }
}

/** The round window on the sky (night: tonight's moon; day: the sun), with the weather passing across. */
export function SkyBadge(p: { zoom?: number; night: boolean; onTap?: (line: string) => void }) {
  const [, force] = useState(0);
  useEffect(() => { const id = setInterval(() => force((n) => n + 1), 60_000); return () => clearInterval(id); }, []);
  const wk = weather.value.kind, ph = moonPhase();
  const N = 26, c = N / 2;
  const draw = (a: Art, t: number) => {
    const R = c - 0.5;
    // the sky inside the ring, dithered in bands
    const night = p.night;
    const skyN = ['#17213a', '#1e2c4a', '#2a3c5e', '#3a4e70'], skyD = ['#5d9ccc', '#7ab2da', '#9cc8e4', '#c4def0'];
    const sky = wk === 'storm' || wk === 'rain' ? (night ? ['#141a2a', '#1a2234', '#222c40', '#2c364c'] : ['#5a6a80', '#6a7a90', '#7e8ca0', '#94a0b2']) : night ? skyN : skyD;
    const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d > R - 2) continue;
      const v = (y / N) * 3 + (BAY[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5;
      a.px(x, y, sky[Math.max(0, Math.min(3, Math.floor(v)))]);
    }
    if (night) {
      // stars that twinkle in turn
      for (let i = 0; i < 9; i++) {
        const sx = 3 + Math.floor(hash(i, 5, 9) * (N - 6)), sy = 3 + Math.floor(hash(i, 6, 9) * (N - 8));
        if (Math.hypot(sx + 0.5 - c, sy + 0.5 - c) > R - 3) continue;
        const tw = Math.sin(t * (0.7 + hash(i, 7) * 0.8) + i * 2.1);
        if (tw > -0.4) a.px(sx, sy, tw > 0.6 ? '#fdf6dc' : '#8fa0c0');
      }
      moonArt(a, c, c - 0.5, 7.4, ph, 0);
    } else {
      // the sun: a warm disc, its rays turning slowly
      const sx = c - 1.5, sy = c - 2;
      a.disc(sx, sy, 3.6, (x, y) => (x + y < sx + sy - 1 ? '#fff4c0' : '#f6c64a'));
      a.disc(sx, sy, 2, '#fff8dc');
      const rot = Math.floor(t * 0.5) % 2;
      for (let k = 0; k < 8; k++) { const ang = (k / 8) * Math.PI * 2 + rot * 0.39; a.px(Math.round(sx + Math.cos(ang) * 5.4 - 0.5), Math.round(sy + Math.sin(ang) * 5.4 - 0.5), '#f0b040'); }
    }
    // the weather crossing the window
    const dark = wk === 'storm' || wk === 'rain';
    if (wk !== 'clear') {
      const drift = (t * 1.2) % (N + 12);
      pcloud(a, Math.round(drift) - 10, wk === 'fog' ? 12 : 9, 11, dark);
      if (wk !== 'fog') pcloud(a, Math.round((drift + 13) % (N + 12)) - 10, 4, 8, dark);
    }
    if (wk === 'fog') for (const [yy, off] of [[13, 0], [16, 5]] as const) for (let x = 2; x < N - 2; x++) if (((x + Math.floor(t * 2) + off) % 7) < 5) a.px(x, yy, '#c8ccd4');
    if (wk === 'rain' || wk === 'storm') for (let i = 0; i < 6; i++) { const rx = Math.floor(hash(i, 2) * N), ry = Math.floor((hash(i, 3) * N + t * 9) % N); a.px(rx, ry, '#9cc4e4'); a.px(rx, ry + 1, '#6a94bc'); }
    if (wk === 'snow') for (let i = 0; i < 6; i++) { const sx = Math.floor((hash(i, 2) * N + Math.sin(t + i) * 1.5 + N) % N), sy = Math.floor((hash(i, 3) * N + t * 2.5) % N); a.px(sx, sy, '#ffffff'); }
    if (wk === 'storm' && Math.floor(t * 4) % 23 === 0) for (let y = 7; y < 15; y++) a.px(c + ((y * 3) % 4) - 2, y, '#fff2a8');
    // clip to the window, then the brass ring with its rivets, lit from the top left
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, d = Math.hypot(dx, dy);
      if (d > R) { a.d[y * N + x] = 0; continue; }
      if (d > R - 2.2) {
        const lit = (-dx - dy) / (d || 1);
        const col = d > R - 1 ? (lit > 0.3 ? '#a8742c' : '#6e4416') : lit > 0.5 ? '#fff0b8' : lit > -0.2 ? '#e8b44c' : '#a86e24';
        a.px(x, y, col);
      }
    }
    for (const k of [0, 2, 4, 6]) { const ang = (k / 8) * Math.PI * 2 + Math.PI / 4; a.px(Math.round(c + Math.cos(ang) * (R - 1.1) - 0.5), Math.round(c + Math.sin(ang) * (R - 1.1) - 0.5), '#fff8dc'); }
  };
  const line = p.night ? `*${phaseName(ph)}* tonight. ${WEATHER_LINE[wk]}` : `${WEATHER_LINE[wk]} Tonight: a *${phaseName(ph).toLowerCase()}.*`;
  return (
    <button class="pl-sky" aria-label={(p.night ? `${phaseName(ph)} tonight. ` : '') + WEATHER_LINE[wk]} onClick={(e) => { e.stopPropagation(); p.onTap?.(line); }}>
      <i class="pl-sky-chain" />
      <PixArt w={N + 2} h={N + 2} fps={4} zoom={p.zoom} draw={(a, t, f) => { const o = new Art(N, N); draw(o, t); void f; a.stamp(o, 1, 1); a.outline(INKC); }} stillT={4} />
    </button>
  );
}

// ------------------------------------------------------------------ the night screen's stars

/** Crisp pixel stars over the whole night screen: slow twinkles, a few sparkles, a rare shooting star. */
export function NightStars() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    const g = cv.getContext('2d')!;
    let W = 0, H = 0, S = 1, stars: { x: number; y: number; k: number; sp: number; ph: number; big: boolean }[] = [];
    const fit = () => {
      S = devPer();
      cv.width = Math.round(innerWidth * DPR()); cv.height = Math.round(innerHeight * DPR());
      W = Math.ceil(cv.width / S); H = Math.ceil(cv.height / S);
      // denser near the top, thinning toward the hills
      stars = [];
      const n = Math.round((W * H) / 820);
      for (let i = 0; i < n; i++) {
        const y = Math.floor(Math.pow(hash(i, 2, 41), 1.6) * H * 0.85), x = Math.floor(hash(i, 1, 41) * W), k = hash(i, 3, 41);
        stars.push({ x, y, k, sp: 0.25 + hash(i, 4, 41) * 0.7, ph: hash(i, 5, 41) * 6.28, big: k > 0.975 });
      }
    };
    fit();
    addEventListener('resize', fit);
    const COLS = ['#3e4c66', '#5a6a88', '#8a9ab8', '#c8d2e6', '#fdf6dc'];
    let shoot: { x: number; y: number; t0: number } | null = null, nextShoot = performance.now() + 9000;
    let raf = 0, last = 0;
    const draw = (now: number) => {
      const calm = still(), t = calm ? 0 : now / 1000;
      g.clearRect(0, 0, cv.width, cv.height);
      for (const s of stars) {
        const tw = calm ? 0.5 : 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
        const lv = Math.max(0, Math.min(4, Math.floor(s.k * 3.2 + tw * 1.6)));
        if (lv === 0) continue;
        g.fillStyle = COLS[lv];
        g.fillRect(s.x * S, s.y * S, S, S);
        if (s.big) {
          // a four-point sparkle whose arms grow and shrink
          const arm = tw > 0.66 ? 2 : tw > 0.3 ? 1 : 0;
          g.fillStyle = COLS[Math.max(2, lv - 1)];
          for (let r = 1; r <= arm; r++) for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r]]) g.fillRect((s.x + dx) * S, (s.y + dy) * S, S, S);
          g.fillStyle = COLS[4]; g.fillRect(s.x * S, s.y * S, S, S);
        }
      }
      if (!calm && !shoot && now > nextShoot) shoot = { x: Math.floor(W * (0.15 + Math.random() * 0.6)), y: Math.floor(H * (0.05 + Math.random() * 0.25)), t0: now };
      if (shoot) {
        const k = (now - shoot.t0) / 900;
        if (k >= 1) { shoot = null; nextShoot = now + 22000 + Math.random() * 26000; }
        else {
          const hx = shoot.x + Math.floor(k * 34), hy = shoot.y + Math.floor(k * 14);
          for (let i = 0; i < 10; i++) {
            const a = (1 - i / 10) * (k < 0.75 ? 1 : (1 - k) * 4);
            g.globalAlpha = Math.max(0, a);
            g.fillStyle = i < 2 ? '#fffbe8' : i < 5 ? '#dfe6f6' : '#8a9ab8';
            g.fillRect((hx - Math.round(i * 2.4)) * S, (hy - Math.round(i * 1)) * S, S, S);
          }
          g.globalAlpha = 1;
        }
      }
    };
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 110) return;
      if (still() && last > 0) return;
      last = now;
      draw(now);
    };
    draw(performance.now());
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', fit); };
  }, []);
  return <canvas ref={ref} class="pl-stars" aria-hidden="true" />;
}

// ------------------------------------------------------------------ dividers and corners

const urlCache = new Map<string, string>();
function artURL(key: string, w: number, h: number, paint: (a: Art) => void): string {
  const S = devPer(), k = `${key}:${S}`;
  let u = urlCache.get(k);
  if (u) return u;
  if (typeof document === 'undefined') return '';
  const a = new Art(w, h);
  paint(a);
  const c = document.createElement('canvas');
  c.width = w * S; c.height = h * S;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(a.canvas(), 0, 0, c.width, c.height);
  u = c.toDataURL('image/png');
  urlCache.set(k, u);
  return u;
}

const VINE = { v: '#5a7a3a', V: '#3e5a2a', l: '#7aa04a', L: '#a8c868', a: '#b8743a', A: '#e3a860', c: '#6e4426', o: INKC };
/** an oak leaf, 5 x 4, pointing right (or left) */
function leaf(a: Art, x: number, y: number, right: boolean, up: boolean) {
  const r = up ? ['.LLl.', 'LllVl', '.lVlo', '..oo.'] : ['..oo.', '.lVlo', 'LllVl', '.LLl.'];
  rows(a, r, VINE, x, y, !right);
}
/** The divider: a slim twining vine with oak leaves, an acorn at its heart. */
export function dividerURL(w: number): string {
  return artURL(`div:${w}`, w, 9, (a) => {
    const c = Math.floor(w / 2);
    for (let x = 2; x < w - 2; x++) {
      const y = 4 + Math.round(Math.sin(x * 0.42) * 1.2);
      if (Math.abs(x - c) < 5) continue;
      a.px(x, y, (x & 3) === 0 ? VINE.V : VINE.v);
      if (x % 9 === 0 && Math.abs(x - c) > 8 && x > 4 && x < w - 6) leaf(a, x, y < 4 ? y + 1 : y - 4, x < c, y >= 4);
    }
    // the acorn in the middle
    rows(a, ['..o..', '.cco.', 'cAccc', 'oaAao', 'oaaao', '.oao.', '..o..'], { ...VINE, c: '#6e4426', A: '#e3a860', a: '#b8743a' }, c - 2, 1);
    a.px(c - 3, 4, VINE.V); a.px(c + 3, 4, VINE.V);
  });
}
/** a sprig of ivy for a panel's corner (top left; the others are mirrored by CSS) */
export function cornerURL(): string {
  return artURL('corner', 14, 14, (a) => {
    // the stem curls in from the corner
    for (const [x, y] of [[0, 1], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3], [6, 3], [7, 4], [1, 0], [1, 2], [1, 3], [2, 4], [2, 5], [3, 6], [3, 7], [4, 8]] as const) a.px(x, y, VINE.V);
    rows(a, ['.LL.', 'LllV', 'lVlo', '.oo.'], VINE, 7, 0);
    rows(a, ['.LL.', 'LlVl', 'llVo', '.oo.'], VINE, 2, 8);
    rows(a, ['LL', 'lo'], VINE, 5, 5);
    a.px(9, 5, '#d84a3a'); a.px(10, 5, '#a8322a'); a.px(9, 6, '#a8322a'); // a holly-red berry
    a.outline(INKC, (x, y) => x > 0 && y > 0);
  });
}

/** an ivy strand draped over a panel's top edge: leaves along it, two tendrils hanging down, a pair of berries */
export function ivyURL(): string {
  return artURL('ivy', 44, 16, (a) => {
    const stem: [number, number][] = [];
    for (let x = 0; x < 44; x++) stem.push([x, 3 + Math.round(Math.sin(x * 0.28) * 1.1 + (x > 34 ? (x - 34) * 0.35 : 0))]);
    for (const [x, y] of stem) a.px(x, y, VINE.V);
    // tendrils down the front of the frame
    for (const [x0, len] of [[9, 8], [27, 5]] as const) { const y0 = stem[x0][1]; for (let j = 1; j <= len; j++) a.px(x0 + (j > len / 2 ? 1 : 0), y0 + j, VINE.v); rows(a, ['LL.', 'lVo', '.o.'], VINE, x0, y0 + len + 1); }
    // leaves along the strand, alternating up and down
    for (const [x, up] of [[3, true], [7, false], [14, true], [19, false], [23, true], [31, false], [36, true], [40, false]] as const) {
      const y = stem[x][1];
      rows(a, up ? ['.LL.', 'LlVl', '.lo.'] : ['.lo.', 'LlVl', '.LL.'], VINE, x - 1, up ? y - 3 : y + 1);
    }
    a.px(17, stem[17][1] + 1, '#d84a3a'); a.px(18, stem[18][1] + 1, '#a8322a'); a.px(17, stem[17][1] + 2, '#a8322a');
    a.outline(INKC);
  });
}
/** An ivy strand over a panel's top edge (the panel must be position: relative). */
export function PxIvy(p: { class?: string } = {}) {
  void artPxSignal.value;
  const css = cssPer();
  return <i class={'pl-ivy ' + (p.class ?? '')} aria-hidden="true" style={{ backgroundImage: `url("${ivyURL()}")`, width: `${44 * css}px`, height: `${16 * css}px`, backgroundSize: `${44 * css}px ${16 * css}px` }} />;
}
/** A pixel-vine divider between sections. */
export function PxDivider(p: { class?: string }) {
  void artPxSignal.value;
  const css = cssPer(), w = 96;
  return <i class={'pl-divider ' + (p.class ?? '')} aria-hidden="true" style={{ backgroundImage: `url("${dividerURL(w)}")`, height: `${9 * css}px`, backgroundSize: `${w * css}px ${9 * css}px` }} />;
}
/** Ivy sprigs in a panel's four corners (the panel must be position: relative). */
export function PxCorners(p: { which?: ('tl' | 'tr' | 'bl' | 'br')[] } = {}) {
  void artPxSignal.value;
  const css = cssPer(), u = `url("${cornerURL()}")`, s = `${14 * css}px`;
  return <>{(p.which ?? ['tl', 'tr', 'bl', 'br']).map((k) => <i class={'pl-corner ' + k} aria-hidden="true" style={{ backgroundImage: u, width: s, height: s, backgroundSize: `${s} ${s}` }} />)}</>;
}


// ------------------------------------------------------------------ the sound tiles' little scenes

const hexRgb = (h: string): [number, number, number] => { const n = parseInt(h.replace('#', '').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixHex = (a: string, b: string, t: number) => { const A = hexRgb(a), B = hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x: number, y: number) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
/**
 * [artpass] A little pixel scene behind each sound's icon (48 x 38 art px): its sky dithered from `top` to `low` in
 * four steps, and what you would hear: rain over hills, the sea, grass in the wind, pines with fireflies, a hearth's
 * glow, a creek over stones, a starry lullaby sky, a dawn for the alarms.
 */
export function soundSceneURL(id: string, top: string, low: string): string {
  const W = 48, H = 38;
  return artURL(`snd:${id}:${top}:${low}`, W, H, (a) => {
    const band = [0, 0.33, 0.66, 1].map((k) => mixHex(top, low, k));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a.px(x, y, band[Math.max(0, Math.min(3, Math.floor((y / H) * 4 + bay(x, y) - 0.5)))]);
    const dark = mixHex(low, '#1a1c28', 0.45), darker = mixHex(low, '#12141e', 0.65), lite = mixHex(top, '#fff8e8', 0.55);
    const ground = (base: number, amp: number, f: number, col: string, ph = 0) => { for (let x = 0; x < W; x++) { const g = Math.round(base + Math.sin(x * f + ph) * amp); for (let y = g; y < H; y++) a.px(x, y, y === g ? mixHex(col, '#ffffff', 0.12) : col); } };
    const stars = (n: number, maxY: number) => { for (let i = 0; i < n; i++) { const x = Math.floor(hash(i, 1, id.length) * W), y = Math.floor(hash(i, 2, id.length) * maxY); a.px(x, y, i % 3 ? lite : '#fffbea'); } };
    switch (id) {
      case 'amb_rain':
        ground(30, 2, 0.16, dark); ground(34, 1.4, 0.23, darker, 2);
        for (let i = 0; i < 26; i++) { const x = Math.floor(hash(i, 3) * W), y = Math.floor(hash(i, 4) * 30); a.px(x, y, lite); a.px(x - 1, y + 1, mixHex(lite, low, 0.4)); }
        break;
      case 'amb_waves':
        stars(5, 10);
        for (let y = 24; y < H; y++) for (let x = 0; x < W; x++) a.px(x, y, (y - 24) < 3 ? mixHex(low, '#2a4a5a', 0.3) : mixHex(low, '#1c3440', 0.5));
        for (const [yy, ph] of [[26, 0], [30, 3], [34, 6]] as const) for (let x = 0; x < W; x++) { const k = (x + ph) % 9; if (k < 3) a.px(x, yy - (k === 1 ? 1 : 0), k === 1 ? '#f4f2ea' : '#b8d0d4'); }
        break;
      case 'amb_brown':
        ground(32, 1, 0.1, dark);
        for (let i = 0; i < 18; i++) { const x = Math.floor(hash(i, 5) * W), h = 3 + Math.floor(hash(i, 6) * 4); for (let j = 0; j < h; j++) a.px(x + Math.floor(j / 2), 31 - j, mixHex(dark, '#c8c0a0', 0.2)); }
        for (const [y, x0, len] of [[8, 4, 18], [13, 20, 22], [18, 8, 14]] as const) for (let x = x0; x < x0 + len; x++) if ((x + y) % 5) a.px(x, y + (x - x0 > len - 4 ? -1 : 0), mixHex(top, '#ffffff', 0.4));
        break;
      case 'amb_forest_night':
        stars(7, 14);
        for (let i = 0; i < 7; i++) { const cx = 3 + i * 7 + Math.floor(hash(i, 7) * 3), h = 12 + Math.floor(hash(i, 8) * 8); for (let j = 0; j < h; j++) { const half = Math.floor(j / 2.2); for (let k = -half; k <= half; k++) a.px(cx + k, H - h + j - 2, j % 3 === 0 && k === -half ? dark : darker); } }
        ground(35, 0.6, 0.3, darker);
        for (let i = 0; i < 5; i++) { const x = 4 + Math.floor(hash(i, 9) * 40), y = 18 + Math.floor(hash(i, 10) * 12); a.px(x, y, '#f6e88a'); a.px(x + 1, y, '#a8b84a'); }
        break;
      case 'amb_fire':
        for (let y = 14; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x - 24) / 1.4, y - 34); if (d < 18 && bay(x, y) < (1 - d / 18) * 0.9) a.px(x, y, '#d88a4a'); }
        for (let y = 33; y < H; y++) for (let x = 0; x < W; x++) a.px(x, y, '#3a2418');
        for (const [x0, x1, y] of [[12, 36, 33], [14, 34, 34]] as const) for (let x = x0; x < x1; x++) a.px(x, y, x === x0 || x === x1 - 1 ? '#e8b070' : '#6a3e22');
        break;
      case 'amb_stream':
        ground(22, 1.5, 0.14, mixHex(low, '#3a5030', 0.4));
        for (let y = 26; y < H; y++) for (let x = 0; x < W; x++) a.px(x, y, mixHex(low, '#24485a', 0.35));
        for (let i = 0; i < 12; i++) { const x = Math.floor(hash(i, 11) * W), y = 27 + Math.floor(hash(i, 12) * 10); a.px(x, y, '#e8f2f0'); a.px(x + 1, y, '#a8c8cc'); }
        for (const [x, y, r] of [[8, 34, 3], [36, 31, 2.4], [24, 36, 2]] as const) a.ell(x, y, r * 1.4, r, (px, py) => (px - x + py - y < -1 ? '#a8a49a' : '#706c66'));
        break;
      case 'music_lullaby':
        stars(14, 30);
        a.disc(36, 9, 4.6, '#f6e8c0');
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (Math.hypot(x + 0.5 - 38, y + 0.5 - 7.6) < 4.2 && Math.hypot(x + 0.5 - 36, y + 0.5 - 9) < 4.6) a.px(x, y, band[0]); }
        ground(33, 1, 0.2, dark);
        break;
      case 'none':
        for (const [y, ph] of [[14, 0], [20, 4], [26, 8]] as const) for (let x = 0; x < W; x++) if (((x + ph) % 11) < 8) a.px(x, y, mixHex(top, '#ffffff', 0.25));
        break;
      default: {
        // the alarms: a dawn, the sun's rim on the hills and a few birds
        a.disc(24, 30, 9, (x, y) => (y < 26 ? '#fff0c0' : '#f8d890'));
        ground(30, 1.4, 0.18, mixHex(low, '#4a3a30', 0.35));
        for (const [x, y] of [[10, 9], [16, 6], [34, 8]] as const) { a.px(x - 1, y, dark); a.px(x, y + 1, dark); a.px(x + 1, y, dark); }
      }
    }
  });
}
