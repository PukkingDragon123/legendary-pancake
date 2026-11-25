// Anime screen effects for the big moments: radial speed/focus lines, an impact frame (two frames of high-contrast
// silhouette), screen shake, sparkle bursts, a sunburst behind a reveal, a chibi Pip popping in from the edge, and
// manga sound-effect words ("POP!", "DING!", "KER-CHING!"...) in the game's font, Alagard, drawn large and smooth with
// a glossy gradient fill, a thick outline and a 3D extrusion. Everything is smooth, anti-aliased, high-resolution art drawn at the screen's full
// device-pixel resolution, polished like an anime: soft glows, gradient light, clean shapes.
// Two transparent canvases: the back one sits between the 3D view and the interface (a sunburst behind a 3D reveal),
// the front one above everything (lines, sparkles, words, the chibi). Short (each moment is over in about a second)
// and cheap (only running while something plays). With Calm motion (the setting or the system's reduced motion)
// there is no flash, no shake and no lines: words and sparkles just appear and fade.
//   animeMoment('levelup' | 'gacha5' | 'gacha4' | 'unlock' | 'morning' | 'bigbuy' | 'stamp' | 'bedtime', at?)
import { save } from '../../game/store.ts';
import { owlIconAsync } from '../portraits.ts';
import { alagardReady } from '../font.ts';
import { dprNow, markArt, type EmoteKind } from './emotes.ts';
import { calmMotion, fxNow, rng } from './kit.ts';

type XY = { x: number; y: number };
/** an effect: draws itself (CSS px coordinates) on the front layer, or the back one */
interface Fx { t0: number; dur: number; back?: boolean; draw(c: CanvasRenderingContext2D, t: number): void }

// ------------------------------------------------------------------ the two layers

class Layer {
  cv: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  used = false;
  constructor(private z: string, private cls: string) {}
  begin() {
    if (!this.cv) {
      const c = document.createElement('canvas');
      c.className = this.cls;
      c.setAttribute('aria-hidden', 'true');
      Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: this.z, pointerEvents: 'none' });
      document.body.appendChild(c);
      this.cv = c;
      this.ctx = c.getContext('2d');
    }
    const d = dprNow(), w = Math.round(innerWidth * d), h = Math.round(innerHeight * d), g = this.ctx!;
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.setTransform(d, 0, 0, d, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    return g;
  }
}
const back = new Layer('1', 'hh-anime-back'), front = new Layer('65', 'hh-anime');
const fxs: Fx[] = [];
let raf = 0;

function add(f: Fx) {
  if (typeof document === 'undefined') return;
  fxs.push(f);
  if (!raf) raf = requestAnimationFrame(frame);
}
function frame() {
  raf = 0;
  const now = fxNow();
  for (let i = fxs.length - 1; i >= 0; i--) if (now - fxs[i].t0 > fxs[i].dur) fxs.splice(i, 1);
  const gb = back.begin(), gf = front.begin();
  for (const f of fxs) {
    const t = now - f.t0;
    if (t < 0) continue;
    const g = f.back ? gb : gf;
    g.save(); f.draw(g, t); g.restore();
  }
  if (fxs.length) raf = requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ focus lines

/** a long tapered spike: wide at the screen's edge, a needle point toward the middle */
function spike(c: CanvasRenderingContext2D, cx: number, cy: number, a: number, r0: number, r1: number, w: number) {
  const ca = Math.cos(a), sa = Math.sin(a), px = -sa * w / 2, py = ca * w / 2;
  c.moveTo(cx + ca * r1 + px, cy + sa * r1 + py);
  c.lineTo(cx + ca * r0, cy + sa * r0);
  c.lineTo(cx + ca * r1 - px, cy + sa * r1 - py);
  c.closePath();
}
/**
 * Radial speed / focus lines rushing in from the screen edges toward a point, leaving the middle clear. They are
 * redrawn "on twos" (a new set every other frame, as in hand-drawn anime).
 */
export function speedLines(o: { x?: number; y?: number; dur?: number; color?: string; clear?: number; n?: number; back?: boolean } = {}) {
  if (calmMotion()) return;
  const dur = o.dur ?? 0.8, n = o.n ?? 90;
  add({
    t0: fxNow(), dur, back: o.back,
    draw(c, t) {
      const W = innerWidth, H = innerHeight, cx = o.x ?? W / 2, cy = o.y ?? H * 0.42;
      const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 8;
      const clear = (o.clear ?? 0.36) * Math.min(W, H);
      // rush in, hold, pull back out
      const k = t < 0.1 ? t / 0.1 : t > dur - 0.18 ? Math.max(0, (dur - t) / 0.18) : 1;
      const rr = rng(Math.floor(t * 12) * 7919 + 13);
      c.fillStyle = o.color ?? '#3a2448';
      c.globalAlpha = 0.9;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (rr() - 0.5) * 0.07;
        const inner = clear * (0.95 + rr() * 0.75), len = R - inner;
        spike(c, cx, cy, a, R - len * k * (0.5 + rr() * 0.5), R, (3 + rr() * 9) * Math.max(0.8, R / 520));
      }
      c.fill();
    },
  });
}

// ------------------------------------------------------------------ impact frame and shake

/** Two frames of high-contrast silhouette (then one inverted), the anime "impact frame". */
export function impactFrame() {
  if (calmMotion() || typeof document === 'undefined') return;
  const els = ['world', 'ui', 'hh-moments'].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  const set = (f: string) => els.forEach((e) => { e.style.filter = f; });
  set('grayscale(1) contrast(9) brightness(1.25)');
  setTimeout(() => set('grayscale(1) contrast(9) invert(1)'), 45);
  setTimeout(() => set(''), 95);
  // a burst of impact spikes over the silhouette
  add({
    t0: fxNow(), dur: 0.1,
    draw(c, t) {
      const W = innerWidth, H = innerHeight, cx = W / 2, cy = H * 0.42, R = Math.hypot(W, H), rr = rng(5);
      c.fillStyle = t < 0.045 ? '#14101a' : '#fffaf0';
      c.beginPath();
      for (let i = 0; i < 46; i++) spike(c, cx, cy, rr() * Math.PI * 2, R * (0.22 + rr() * 0.12), R, 3 + rr() * 9);
      c.fill();
    },
  });
}

let shakeUntil = 0, shakeAmp = 0, shakeRaf = 0;
const saved = new Map<HTMLElement, string>();
/** Shake the picture and the interface (jolts on twos, decaying). */
export function shake(amp = 6, dur = 0.35) {
  if (calmMotion() || typeof document === 'undefined') return;
  shakeAmp = Math.max(shakeAmp * (shakeUntil > performance.now() ? 1 : 0), amp);
  shakeUntil = Math.max(shakeUntil, performance.now() + dur * 1000);
  const els = ['world', 'ui'].map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
  for (const e of els) if (!saved.has(e)) saved.set(e, e.style.transform);
  const t0 = performance.now(), d0 = shakeUntil - t0;
  const step = () => {
    const now = performance.now();
    if (now >= shakeUntil) { for (const [e, tr] of saved) e.style.transform = tr; saved.clear(); shakeRaf = 0; shakeAmp = 0; return; }
    const k = (shakeUntil - now) / d0, f = Math.floor(now / 33), rr = rng(f);
    const dx = (rr() * 2 - 1) * shakeAmp * k, dy = (rr() * 2 - 1) * shakeAmp * k * 0.7;
    for (const [e] of saved) e.style.transform = e.id === 'world' ? `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(1.03)` : `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    shakeRaf = requestAnimationFrame(step);
  };
  if (!shakeRaf) shakeRaf = requestAnimationFrame(step);
}

// ------------------------------------------------------------------ sparkles

const SPARK_TINT: Record<string, number> = { gold: 0, pink: 1, sky: 2, violet: 3 };
/** Sparkles burst out from a point, spin and twinkle out. */
export function sparkleBurst(x: number, y: number, n = 14, o: { tint?: string | string[]; spread?: number } = {}) {
  const calm = calmMotion(), rr = rng(Math.floor(Math.random() * 1e6));
  const tints = Array.isArray(o.tint) ? o.tint : [o.tint ?? 'gold'];
  const scale = Math.min(1.4, Math.max(0.8, Math.min(innerWidth, innerHeight) / 500));
  const ps = Array.from({ length: calm ? Math.ceil(n / 2) : n }, (_, i) => {
    const a = rr() * Math.PI * 2, v = (calm ? 0 : 120 + rr() * 260) * (o.spread ?? 1) * scale;
    return { a, v, life: 0.55 + rr() * 0.5, size: (34 + rr() * 60) * scale, tint: SPARK_TINT[tints[i % tints.length]] ?? 0, d: rr() * 0.12, dist: calm ? 30 + rr() * 90 : 0, spin: (rr() - 0.5) * 6 };
  });
  add({
    t0: fxNow(), dur: 1.15,
    draw(c, t) {
      for (const p of ps) {
        const tt = t - p.d;
        if (tt < 0 || tt > p.life) continue;
        const k = tt / p.life, travel = p.v * (1 - Math.pow(1 - Math.min(1, tt / 0.6), 3)) * 0.55 + p.dist;
        const px = x + Math.cos(p.a) * travel, py = y + Math.sin(p.a) * travel + (calm ? 0 : tt * tt * 60);
        // twinkle: grow in, flicker, shrink away
        const s = k < 0.18 ? k / 0.18 : k > 0.72 ? (1 - k) / 0.28 : 1 - (Math.floor(tt * 16) % 3 === 0 ? 0.25 : 0);
        c.save(); c.translate(px, py); c.rotate(calm ? 0 : tt * p.spin);
        const img = markArt('sparkle', p.size, p.tint * 4 + 2), d = dprNow(), w = (img.width / d) * s, h = (img.height / d) * s;
        c.drawImage(img, -w / 2, -h / 2, w, h);
        c.restore();
      }
    },
  });
}

// ------------------------------------------------------------------ sunburst

/** A slowly turning sunburst behind a reveal: soft rays in two tones, fading toward the middle and the rim. */
export function sunburst(x: number, y: number, o: { colors?: [string, string]; dur?: number; r0?: number; r1?: number; rays?: number; alpha?: number } = {}) {
  const calm = calmMotion(), dur = o.dur ?? 1.2, rays = o.rays ?? 16;
  const [ca, cb] = o.colors ?? ['#ffe58a', '#fff6d0'];
  const jit = Array.from({ length: rays }, (_, i) => 0.75 + rng(i + 3)() * 0.5);
  add({
    t0: fxNow(), dur, back: true,
    draw(c, t) {
      const r0 = o.r0 ?? 60, r1 = o.r1 ?? Math.min(innerWidth, innerHeight) * 0.62;
      const env = t < 0.16 ? t / 0.16 : t > dur - 0.3 ? Math.max(0, (dur - t) / 0.3) : 1;
      const spin = calm ? 0 : t * 0.35;
      c.globalAlpha = env * (o.alpha ?? 0.42) * 1.6;
      for (const [k, col] of [[0, ca], [1, cb]] as const) {
        const g = c.createRadialGradient(x, y, r0 * 0.6, x, y, r1);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.18, col); g.addColorStop(0.6, col); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.beginPath();
        for (let i = k; i < rays; i += 2) {
          const a0 = (i / rays) * Math.PI * 2 + spin, a1 = a0 + (Math.PI / rays) * jit[i];
          c.moveTo(x, y); c.arc(x, y, r1, a0, a1); c.closePath();
        }
        c.fill();
      }
      // a soft glow at the heart of it
      const glow = c.createRadialGradient(x, y, 0, x, y, r0 * 1.6);
      glow.addColorStop(0, 'rgba(255, 250, 225, 0.55)'); glow.addColorStop(1, 'rgba(255, 250, 225, 0)');
      c.globalAlpha = env; c.fillStyle = glow; c.fillRect(x - r0 * 1.6, y - r0 * 1.6, r0 * 3.2, r0 * 3.2);
    },
  });
}

// ------------------------------------------------------------------ manga sound-effect words

export interface SfxStyle { fill: string; deep: string; hi?: string; ink?: string; size?: number }
const STYLES: Record<string, SfxStyle> = {
  gold: { hi: '#fffbe0', fill: '#ffd84a', deep: '#f07a1c', ink: '#5a2410' },
  rose: { hi: '#fff0f6', fill: '#ff9ac0', deep: '#d23c74', ink: '#5a1434' },
  sky: { hi: '#f0fbff', fill: '#8fe0ff', deep: '#2f7ad0', ink: '#14306a' },
  mint: { hi: '#f2fff8', fill: '#8ff0b8', deep: '#1e9a68', ink: '#0d4030' },
  violet: { hi: '#f6f0ff', fill: '#c9a6ff', deep: '#6a44d0', ink: '#24135e' },
  red: { hi: '#fff0e8', fill: '#ff7a52', deep: '#c8202c', ink: '#4a0c14' },
  night: { hi: '#ffffff', fill: '#d8d2ff', deep: '#5a52c0', ink: '#1a1438' },
};
/** the lettering: the game's font, Alagard (loaded at boot; the words wait for it), drawn large and smooth */
const SFX_FONT = '"Alagard"';
let fontOk = false;
if (typeof document !== 'undefined') void alagardReady().then(() => { fontOk = document.fonts?.check?.(`32px ${SFX_FONT}`) ?? true; });
type Letter = { img: HTMLCanvasElement; x: number; y: number; rot: number };
const sfxCache = new Map<string, Letter[]>();

/**
 * The lettering of one sound-effect word, each letter its own smooth, high-resolution canvas (device pixels): a heavy
 * face at `size` CSS px, filled with a glossy gradient (bright top, rich middle, deep bottom) and a white shine, a thick
 * rounded outline, a solid 3D extrusion down and to the right, and a soft violet drop shadow; plus where each letter
 * sits (CSS px, the word centred on 0,0) and its tilt. The one place the SFX look is decided (a shared lettering helper
 * can replace it).
 */
export function sfxArt(text: string, style: SfxStyle): Letter[] {
  const F = Math.max(18, Math.round(style.size ?? 56)), d = dprNow(), key = `${text}|${style.fill}|${style.deep}|${F}|${d}`;
  const hit = sfxCache.get(key);
  if (hit) return hit;
  const m = document.createElement('canvas').getContext('2d')!;
  const font = `${F}px ${SFX_FONT}`;
  m.font = font;
  const rr = rng(text.length * 31 + text.charCodeAt(0));
  const metrics = [...text].map((ch) => ({ ch, w: m.measureText(ch).width }));
  const track = -F * 0.04, total = metrics.reduce((a, b) => a + b.w, 0) + (metrics.length - 1) * track;
  const out: Letter[] = [];
  const ow = F * 0.13, D = Math.max(2, F * 0.09), pad = ow + D + F * 0.2;
  let pen = 0;
  for (const { ch, w } of metrics) {
    if (ch === ' ') { pen += w + track; continue; }
    const cw = w + pad * 2, chh = F * 1.25 + pad * 2;
    const c = document.createElement('canvas');
    c.width = Math.ceil(cw * d); c.height = Math.ceil(chh * d);
    const g = c.getContext('2d')!;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.font = font; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineCap = 'round';
    const ox = pad, oy = pad + F * 0.95;
    // the extrusion: the letter stacked down and to the right, outlined, casting a soft violet shadow
    g.save();
    g.shadowColor = 'rgba(38, 24, 74, 0.45)'; g.shadowBlur = F * 0.18; g.shadowOffsetX = F * 0.04; g.shadowOffsetY = F * 0.08;
    g.strokeStyle = style.ink ?? '#2a1640'; g.lineWidth = ow * 2;
    g.strokeText(ch, ox + D, oy + D);
    g.restore();
    for (let k = D; k >= 1; k -= 0.75) { g.fillStyle = k > D * 0.6 ? style.deep : style.deep; g.globalAlpha = 1; g.fillText(ch, ox + k, oy + k); }
    g.fillStyle = 'rgba(30, 16, 60, 0.28)';
    g.fillText(ch, ox + D * 0.5, oy + D * 0.5);
    // the face: outline, glossy gradient fill, a white shine across the top
    g.strokeStyle = style.ink ?? '#2a1640'; g.lineWidth = ow * 2;
    g.strokeText(ch, ox, oy);
    const top = oy - F * 0.78, bot = oy + F * 0.02;
    const gr = g.createLinearGradient(0, top, 0, bot);
    gr.addColorStop(0, style.hi ?? '#ffffff'); gr.addColorStop(0.42, style.fill); gr.addColorStop(1, style.deep);
    g.fillStyle = gr;
    g.fillText(ch, ox, oy);
    const face = document.createElement('canvas');
    face.width = c.width; face.height = c.height;
    const fg = face.getContext('2d')!;
    fg.setTransform(d, 0, 0, d, 0, 0);
    fg.font = font; fg.textBaseline = 'alphabetic';
    fg.fillStyle = '#000'; fg.fillText(ch, ox, oy);
    fg.globalCompositeOperation = 'source-in';
    const sh = fg.createLinearGradient(0, top, 0, top + F * 0.42);
    sh.addColorStop(0, 'rgba(255,255,255,0.75)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    fg.fillStyle = sh; fg.fillRect(0, 0, cw, top + F * 0.42);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(face, 0, 0);
    out.push({ img: c, x: pen + w / 2 - total / 2, y: (rr() - 0.5) * F * 0.12, rot: (rr() - 0.5) * 0.2 });
    pen += w + track;
  }
  if (fontOk) sfxCache.set(key, out); // (letters made before the font was in are not kept)
  return out;
}

/** The word's letter size: big and bold, as large as fits across the screen. */
function wordSize(word: string): number {
  return Math.round(Math.max(30, Math.min(Math.min(innerWidth, innerHeight) * 0.15, 96, (innerWidth * 0.84) / Math.max(1, word.length * 0.7))));
}

/** Throw a manga sound-effect word onto the screen: letters slam in one by one, hold, then float up and fade. */
export function sfx(word: string, x: number, y: number, o: { style?: keyof typeof STYLES | SfxStyle; size?: number; tilt?: number; dur?: number; delay?: number; align?: -1 | 0 | 1 } = {}) {
  if (typeof document === 'undefined') return;
  const st = typeof o.style === 'object' ? o.style : STYLES[o.style ?? 'gold'];
  const calm = calmMotion(), dur = Math.min(1.2, o.dur ?? 1.05);
  let art: Letter[] | null = null;
  const tilt = o.tilt ?? -0.12;
  add({
    t0: fxNow() + (o.delay ?? 0), dur,
    draw(c, t) {
      // the words are lettered in Alagard: wait (silently) until it's in
      if (!fontOk) { void alagardReady(); return; }
      art ??= sfxArt(word, { ...st, size: o.size ?? st.size ?? wordSize(word) });
      const d = dprNow();
      // keep the whole word on screen (`align` 1: x is its left edge, -1 its right edge)
      const half = art.reduce((mm, a) => Math.max(mm, Math.abs(a.x) + a.img.width / d / 2), 0);
      const cx = Math.max(half + 4, Math.min(innerWidth - half - 4, x + (o.align ?? 0) * half)), cy = Math.max(40, Math.min(innerHeight - 40, y));
      const fadeT = dur - 0.25, k = t > fadeT ? (t - fadeT) / 0.25 : 0;
      const alpha = calm ? Math.min(1, t / 0.15, 1 - k) : 1 - k, rise = calm ? 0 : k * 18;
      c.globalAlpha = Math.max(0, alpha);
      art.forEach((a, i) => {
        const tt = calm ? 1 : t - i * 0.045;
        if (tt < 0) return;
        // a slam: big, squashed down, a bounce, then rest on the word's tilt
        const s = calm ? 1 : tt < 0.05 ? 1.8 - (tt / 0.05) * 0.9 : tt < 0.1 ? 0.9 + ((tt - 0.05) / 0.05) * 0.18 : tt < 0.15 ? 1.08 - ((tt - 0.1) / 0.05) * 0.08 : 1;
        const lx = cx + a.x * Math.cos(tilt), ly = cy + a.y + a.x * Math.sin(tilt) - rise;
        const w = (a.img.width / d) * s, h = (a.img.height / d) * s;
        c.save(); c.translate(lx, ly); c.rotate(tilt + a.rot);
        c.drawImage(a.img, -w / 2, -h / 2, w, h);
        c.restore();
      });
    },
  });
}

// ------------------------------------------------------------------ chibi pop-in

let chibiSrc: HTMLImageElement | null = null, chibiKey = '', chibiWait: Promise<void> | null = null;
/** Give the chibi pop-in Pip's portrait (any image URL; a square face shot reads best). */
export function setChibi(url: string): Promise<void> {
  if (!url || typeof Image === 'undefined') return Promise.resolve();
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => { chibiSrc = im; res(); };
    im.onerror = () => res();
    im.src = url;
  });
}
/** Pip's current portrait (rendered once per look). */
function ensureChibi(): Promise<void> {
  return (chibiWait ??= (async () => {
    const look = save.value.look, key = JSON.stringify(look);
    if (key === chibiKey && chibiSrc) return;
    const url = await owlIconAsync(look, 'face');
    if (url) { await setChibi(url); chibiKey = key; }
  })().catch(() => undefined).finally(() => { chibiWait = null; }));
}
/** Pip pops in from the side of the screen like a chibi cut-in: a squashy hop, a mark beside him, then away. */
export function chibi(o: { side?: 'left' | 'right'; y?: number; mark?: EmoteKind; dur?: number } = {}) {
  const im = chibiSrc;
  if (!im) {
    // the first time, render the portrait and join in if it's quick enough
    const t0 = performance.now();
    void ensureChibi().then(() => { if (chibiSrc && performance.now() - t0 < 700) chibi(o); });
    return;
  }
  void ensureChibi(); // (a new look is shot for next time)
  const calm = calmMotion(), dur = Math.min(1.2, o.dur ?? 1.15), left = (o.side ?? 'left') === 'left';
  const size = Math.max(84, Math.min(150, Math.min(innerWidth, innerHeight) * 0.24));
  const mark = o.mark === 'hearts' || o.mark === 'bang' || o.mark === 'notes' ? markArt(o.mark, size * 0.42, 1) : markArt('sparkle', size * 0.42, 2);
  add({
    t0: fxNow(), dur,
    draw(c, t) {
      const W = innerWidth, y0 = o.y ?? innerHeight * 0.4;
      // slide in with a squashy hop, hold with a bob, drop away
      let off = 0, sx = 1, sy = 1;
      if (calm) off = 0;
      else if (t < 0.12) off = 1 - t / 0.12;
      else if (t < 0.2) { const k = (t - 0.12) / 0.08; sx = 1 + 0.16 * Math.sin(k * Math.PI); sy = 1 - 0.14 * Math.sin(k * Math.PI); }
      else if (t < 0.3) { const k = (t - 0.2) / 0.1; sx = 1 - 0.06 * Math.sin(k * Math.PI); sy = 1 + 0.08 * Math.sin(k * Math.PI); }
      else if (t > dur - 0.18) off = (t - (dur - 0.18)) / 0.18;
      const bob = calm ? 0 : Math.sin(t * 12) * 2;
      const x = left ? size * 0.42 - off * size : W - size * 0.42 + off * size;
      c.globalAlpha = calm ? Math.max(0, Math.min(1, t / 0.15, (dur - t) / 0.2)) : 1;
      // a soft white halo behind the portrait, like a cut-in panel
      const halo = c.createRadialGradient(x, y0, size * 0.2, x, y0, size * 0.62);
      halo.addColorStop(0, 'rgba(255, 252, 240, 0.9)'); halo.addColorStop(1, 'rgba(255, 252, 240, 0)');
      c.fillStyle = halo; c.fillRect(x - size, y0 - size, size * 2, size * 2);
      c.save(); c.translate(x, y0 - bob + size * 0.5); c.scale(left ? sx : -sx, sy);
      c.shadowColor = 'rgba(38, 24, 74, 0.35)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
      c.drawImage(im, -size / 2, -size, size, size);
      c.restore();
      if (t > 0.2 && t < dur - 0.15) {
        const d = dprNow(), mw = mark.width / d, mh = mark.height / d;
        c.drawImage(mark, x + (left ? 1 : -1) * size * 0.55 - mw / 2, y0 - size * 0.45 - mh / 2, mw, mh);
      }
    },
  });
}

// ------------------------------------------------------------------ the moments

export type AnimeMoment = 'levelup' | 'gacha5' | 'gacha4' | 'unlock' | 'morning' | 'bigbuy' | 'stamp' | 'bedtime';
let lastMoment = 0;
/** A big moment, composed: each is over in about a second. `at` is the subject on screen (CSS px). */
export function animeMoment(kind: AnimeMoment, at?: XY) {
  if (typeof document === 'undefined') return;
  // never stack two big moments on top of each other
  const now = performance.now();
  if (now - lastMoment < 350) return;
  lastMoment = now;
  const W = innerWidth, H = innerHeight, p = at ?? { x: W / 2, y: H * 0.42 };
  const wordAt = (dx: number, dy: number): [number, number] => [Math.max(80, Math.min(W - 80, p.x + dx)), Math.max(70, p.y + dy)];
  switch (kind) {
    case 'levelup':
      impactFrame(); shake(5, 0.3);
      speedLines({ x: p.x, y: p.y, dur: 0.85, color: '#fff6d8', clear: 0.38 });
      sparkleBurst(p.x, p.y, 18, { tint: ['gold', 'violet', 'sky'] });
      // beside the medal on a wide screen, above it on a phone
      if (W >= 700) sfx('DING!', p.x + 84, p.y - 120, { style: 'gold', tilt: -0.16, align: 1 });
      else sfx('DING!', p.x, p.y - 150, { style: 'gold', tilt: -0.12 });
      break;
    case 'gacha5':
      impactFrame(); shake(7, 0.4);
      sunburst(p.x, p.y, { colors: ['#ffd23f', '#fff2b8'], dur: 1.2, r0: 70, alpha: 0.4 });
      speedLines({ x: p.x, y: p.y, dur: 0.95, color: '#3a2448', clear: 0.34, back: true });
      sparkleBurst(p.x, p.y, 22, { tint: ['gold', 'gold', 'pink'] });
      sfx('SHING!!', ...wordAt(-Math.min(90, W * 0.22), -Math.min(150, H * 0.2)), { style: 'gold', tilt: 0.14 });
      break;
    case 'gacha4':
      sunburst(p.x, p.y, { colors: ['#c9a6ff', '#f0e4ff'], dur: 1.1, r0: 70, alpha: 0.34 });
      sparkleBurst(p.x, p.y, 14, { tint: ['violet', 'pink'] });
      sfx('POP!', ...wordAt(Math.min(90, W * 0.22), -Math.min(140, H * 0.18)), { style: 'violet', tilt: -0.14 });
      break;
    case 'unlock':
      shake(4, 0.25);
      sunburst(p.x, p.y, { colors: ['#ffe58a', '#fff6d0'], dur: 1.1, r0: 50, alpha: 0.36 });
      speedLines({ x: p.x, y: p.y, dur: 0.8, clear: 0.4, back: true, color: '#3a2448' });
      sparkleBurst(p.x, p.y, 16, { tint: ['gold', 'sky'] });
      sfx('WOW!', ...wordAt(0, -Math.min(120, H * 0.15)), { style: 'mint', tilt: -0.1 });
      chibi({ side: 'left', mark: 'bang' });
      break;
    case 'morning':
      sparkleBurst(p.x, p.y, 16, { tint: ['gold', 'pink', 'sky'] });
      sfx('YAY!', ...wordAt(Math.min(70, W * 0.18), -Math.min(110, H * 0.13)), { style: 'rose', tilt: -0.12 });
      chibi({ side: 'right', mark: 'hearts', y: H * 0.56 });
      break;
    case 'bigbuy':
      shake(4, 0.25);
      sparkleBurst(p.x, p.y, 14, { tint: 'gold' });
      sfx('KER-CHING!', ...wordAt(0, -Math.min(90, H * 0.11)), { style: 'gold', tilt: -0.1 });
      break;
    case 'stamp':
      impactFrame(); shake(8, 0.28);
      speedLines({ x: p.x, y: p.y, dur: 0.5, clear: 0.3 });
      sfx('KER-CHUNK!', ...wordAt(0, -Math.min(100, H * 0.13)), { style: 'red', tilt: -0.08 });
      break;
    case 'bedtime':
      sfx('ZZZ...', ...wordAt(Math.min(60, W * 0.15), -Math.min(90, H * 0.11)), { style: 'night', tilt: -0.08, dur: 1.2 });
      break;
  }
}

/** Where a DOM element sits on screen (its centre), for anchoring a moment. */
export function centreOf(el: Element | null | undefined): XY | undefined {
  const r = el?.getBoundingClientRect();
  return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : undefined;
}

// dev and screenshot hooks
if (typeof window !== 'undefined') {
  (window as unknown as { hhAnime: unknown }).hhAnime = { animeMoment, speedLines, impactFrame, shake, sparkleBurst, sunburst, sfx, chibi, setChibi, live: () => fxs.map((f) => [f.t0, f.dur, !!f.back]) };
  // shoot Pip's chibi portrait once things have settled, so the first cut-in is ready
  // and letter the moments' words a little at a time while nothing is happening, so no moment starts with a hitch
  if (!import.meta.env?.VITEST) setTimeout(() => {
    if (!document.getElementById('world')) return;
    void ensureChibi();
    if (!fontOk) return;
    const words: [string, string][] = [['DING!', 'gold'], ['KER-CHING!', 'gold'], ['WOW!', 'mint'], ['YAY!', 'rose'], ['SHING!!', 'gold'], ['POP!', 'violet'], ['ZZZ...', 'night'], ['KER-CHUNK!', 'red']];
    words.forEach(([w, st], i) => setTimeout(() => { sfxArt(w, { ...STYLES[st], size: wordSize(w) }); }, 400 * (i + 1)));
  }, 9000);
}
