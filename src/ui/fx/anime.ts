// Anime screen effects for the big moments: radial speed/focus lines, an impact frame (two frames of high-contrast
// silhouette), screen shake, sparkle bursts, a sunburst behind a reveal, a chibi Pip popping in from the edge, and
// manga sound-effect words ("POP!", "DING!", "KA-CHING!"...) lettered in the pixel font with an outline and a 3D
// extrusion. All pixel art at exactly one art pixel per texel (src/gfx/artpx.ts, the size the HUD and the 3D world
// use), painted like the interface (src/ui/px/relief.ts: top-left light, cool violet-blue shadows, coloured outlines):
// hard edges, stepped tones, ordered-dither fades, never a smooth gradient or a stretched sprite.
// Two transparent canvases: the back one sits between the 3D view and the interface (a sunburst behind a 3D reveal),
// the front one above everything (lines, sparkles, words, the chibi). Short (each moment is over in about a second)
// and cheap (low-res canvases, only running while something plays). With Calm motion (the setting or the system's
// reduced motion) there is no flash, no shake and no lines: words and sparkles just appear and fade.
//   animeMoment('levelup' | 'gacha5' | 'gacha4' | 'unlock' | 'morning' | 'bigbuy' | 'stamp' | 'bedtime', at?)
import { artPx } from '../../gfx/artpx.ts';
import { save } from '../../game/store.ts';
import { owlIconAsync } from '../portraits.ts';
import { pixelate } from '../pxfx.tsx';
import { flat, hash, hex, mix, Relief, type AFn, type Shape } from '../px/relief.ts';
import { ENAMEL, markArt, pillow, SHADOW, type EmoteKind } from './emotes.ts';
import { bayer, blit, calmMotion, col, fxNow, Raster, rng } from './pixart.ts';

type XY = { x: number; y: number };
interface Fx { t0: number; dur: number; back?: boolean; step(r: Raster, t: number, B: number): void; draw?(c: CanvasRenderingContext2D, t: number, B: number): void }

// ------------------------------------------------------------------ the two layers

class Layer {
  cv: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  ras: Raster | null = null;
  constructor(private z: string, private cls: string) {}
  ensure(B: number) {
    if (!this.cv) {
      const c = document.createElement('canvas');
      c.className = this.cls;
      c.setAttribute('aria-hidden', 'true');
      Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: this.z, pointerEvents: 'none', imageRendering: 'pixelated' });
      document.body.appendChild(c);
      this.cv = c;
      this.ctx = c.getContext('2d');
    }
    const w = Math.ceil(innerWidth / B), h = Math.ceil(innerHeight / B);
    if (!this.ras || this.ras.w !== w || this.ras.h !== h) {
      this.cv.width = w; this.cv.height = h;
      this.cv.style.width = `${w * B}px`; this.cv.style.height = `${h * B}px`;
      this.ras = new Raster(w, h);
    }
    this.ctx!.imageSmoothingEnabled = false;
  }
  hide() { if (this.cv && this.ctx) this.ctx.clearRect(0, 0, this.cv.width, this.cv.height); }
}
const back = new Layer('1', 'hh-anime-back'), front = new Layer('65', 'hh-anime');
const fxs: Fx[] = [];
let raf = 0;
/** CSS px per texel: the game's one art pixel */
const texel = () => artPx();

function add(f: Fx) {
  if (typeof document === 'undefined') return;
  fxs.push(f);
  if (!raf) raf = requestAnimationFrame(frame);
}
function frame() {
  raf = 0;
  const B = texel(), now = fxNow();
  back.ensure(B); front.ensure(B);
  const rb = back.ras!, rf = front.ras!;
  rb.clear(); rf.clear();
  let anyBack = false;
  for (let i = fxs.length - 1; i >= 0; i--) if (now - fxs[i].t0 > fxs[i].dur) fxs.splice(i, 1);
  for (const f of fxs) { const t = now - f.t0; if (t < 0) continue; f.step(f.back ? rb : rf, t, B); if (f.back) anyBack = true; }
  rf.to(front.ctx!);
  if (anyBack) rb.to(back.ctx!); else back.hide();
  for (const f of fxs) { const t = now - f.t0; if (t >= 0 && f.draw) f.draw(front.ctx!, t, B); }
  if (fxs.length) raf = requestAnimationFrame(frame);
  else { front.hide(); back.hide(); }
}

// ------------------------------------------------------------------ focus lines

/**
 * Radial speed / focus lines rushing in from the screen edges toward a point, leaving the middle clear. They are
 * redrawn "on twos" (a new set every other frame, as in hand-drawn anime).
 */
export function speedLines(o: { x?: number; y?: number; dur?: number; color?: string; clear?: number; n?: number; back?: boolean } = {}) {
  if (calmMotion()) return;
  const dur = o.dur ?? 0.8, c = col(o.color ?? '#3a2448'), n = o.n ?? 70;
  add({
    t0: fxNow(), dur, back: o.back,
    step(r, t, B) {
      const cx = (o.x ?? innerWidth / 2) / B, cy = (o.y ?? innerHeight * 0.42) / B;
      const R = Math.hypot(Math.max(cx, r.w - cx), Math.max(cy, r.h - cy)) + 4;
      const clear = (o.clear ?? 0.36) * Math.min(r.w, r.h);
      // rush in, hold, pull back out
      const k = t < 0.1 ? t / 0.1 : t > dur - 0.18 ? Math.max(0, (dur - t) / 0.18) : 1;
      const rr = rng(Math.floor(t * 12) * 7919 + 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (rr() - 0.5) * 0.09;
        const inner = clear * (0.95 + rr() * 0.75), len = R - inner;
        const r0 = R - len * k * (0.55 + rr() * 0.45);
        const w = (1.1 + rr() * 2.6) * Math.max(0.8, R / 260);
        const ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        r.poly([[cx + ca * R + px * w, cy + sa * R + py * w], [cx + ca * R - px * w, cy + sa * R - py * w], [cx + ca * r0, cy + sa * r0]], c);
      }
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
  // a burst of white impact lines over the silhouette
  add({
    t0: fxNow(), dur: 0.1,
    step(r, t) {
      const cx = r.w / 2, cy = r.h * 0.42, R = Math.hypot(r.w, r.h), c = col(t < 0.045 ? '#14101a' : '#fffaf0'), rr = rng(5);
      for (let i = 0; i < 40; i++) {
        const a = rr() * Math.PI * 2, w = 1 + rr() * 3, ca = Math.cos(a), sa = Math.sin(a);
        r.poly([[cx + ca * R - sa * w, cy + sa * R + ca * w], [cx + ca * R + sa * w, cy + sa * R - ca * w], [cx + ca * R * 0.25, cy + sa * R * 0.25]], c);
      }
    },
  });
}

let shakeUntil = 0, shakeAmp = 0, shakeRaf = 0;
const saved = new Map<HTMLElement, string>();
/** Shake the picture and the interface (whole-pixel jolts on twos, decaying). */
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
    const dx = Math.round((rr() * 2 - 1) * shakeAmp * k), dy = Math.round((rr() * 2 - 1) * shakeAmp * k * 0.7);
    for (const [e] of saved) e.style.transform = e.id === 'world' ? `translate(${dx}px, ${dy}px) scale(1.03)` : `translate(${dx}px, ${dy}px)`;
    shakeRaf = requestAnimationFrame(step);
  };
  if (!shakeRaf) shakeRaf = requestAnimationFrame(step);
}

// ------------------------------------------------------------------ sparkles

const SPARK_TINT: Record<string, number> = { gold: 0, pink: 1, sky: 2, violet: 3 };
/** Sparkles burst out from a point, spin down and twinkle out. */
export function sparkleBurst(x: number, y: number, n = 14, o: { tint?: string | string[]; spread?: number } = {}) {
  const calm = calmMotion(), rr = rng(Math.floor(Math.random() * 1e6));
  const tints = Array.isArray(o.tint) ? o.tint : [o.tint ?? 'gold'];
  const ps = Array.from({ length: calm ? Math.ceil(n / 2) : n }, (_, i) => {
    const a = rr() * Math.PI * 2, v = (calm ? 0 : 120 + rr() * 260) * (o.spread ?? 1);
    return { a, v, life: 0.55 + rr() * 0.5, arm: 4 + Math.floor(rr() * 8), tint: SPARK_TINT[tints[i % tints.length]] ?? 0, d: rr() * 0.12, dist: calm ? 30 + rr() * 90 : 0 };
  });
  add({
    t0: fxNow(), dur: 1.15, step() { /* sprites only */ },
    draw(c, t, B) {
      for (const p of ps) {
        const tt = t - p.d;
        if (tt < 0 || tt > p.life) continue;
        const k = tt / p.life, travel = p.v * (1 - Math.pow(1 - Math.min(1, tt / 0.6), 3)) * 0.55 + p.dist;
        const px = x + Math.cos(p.a) * travel, py = y + Math.sin(p.a) * travel + (calm ? 0 : tt * tt * 60);
        // twinkle: a dot, a plus, the full star (flickering to a smaller one), back down
        const f = k < 0.1 ? 0 : k < 0.22 ? 1 : k > 0.9 ? 0 : k > 0.78 ? 1 : Math.floor(tt * 14) % 3 === 0 ? 3 : 2;
        blit(c, markArt('sparkle', p.arm / 0.38, p.tint * 4 + f), Math.round(px / B), Math.round(py / B), 1);
      }
    },
  });
}

// ------------------------------------------------------------------ sunburst

/** A slowly turning sunburst behind a reveal: hard-edged rays in two tones, dithered out at both ends. */
export function sunburst(x: number, y: number, o: { colors?: [string, string]; dur?: number; r0?: number; r1?: number; rays?: number; alpha?: number } = {}) {
  const calm = calmMotion(), dur = o.dur ?? 1.2, rays = o.rays ?? 16;
  const [ca, cb] = o.colors ?? ['#ffe58a', '#fff6d0'];
  const A = col(ca, Math.round((o.alpha ?? 0.42) * 255)), Bc = col(cb, Math.round((o.alpha ?? 0.42) * 200));
  const jit = Array.from({ length: rays }, (_, i) => 0.75 + rng(i + 3)() * 0.5);
  add({
    t0: fxNow(), dur, back: true,
    step(r, t, B) {
      const cx = x / B, cy = y / B;
      const r0 = (o.r0 ?? 60) / B, r1 = (o.r1 ?? Math.min(innerWidth, innerHeight) * 0.62) / B;
      const env = t < 0.16 ? t / 0.16 : t > dur - 0.3 ? Math.max(0, (dur - t) / 0.3) : 1;
      const spin = calm ? 0 : Math.floor(t * 12) / 12 * 0.35;
      // the rays as wedges, then a dithered fade toward the hole and the rim
      for (let i = 0; i < rays; i++) {
        const a0 = (i / rays) * Math.PI * 2 + spin, a1 = a0 + (Math.PI / rays) * jit[i];
        r.poly([[cx + Math.cos(a0) * r0 * 0.6, cy + Math.sin(a0) * r0 * 0.6], [cx + Math.cos(a0) * r1 * 1.1, cy + Math.sin(a0) * r1 * 1.1], [cx + Math.cos(a1) * r1 * 1.1, cy + Math.sin(a1) * r1 * 1.1], [cx + Math.cos(a1) * r0 * 0.6, cy + Math.sin(a1) * r0 * 0.6]], i % 2 ? Bc : A);
      }
      const x0 = Math.max(0, Math.floor(cx - r1 * 1.15)), x1 = Math.min(r.w - 1, Math.ceil(cx + r1 * 1.15));
      const y0 = Math.max(0, Math.floor(cy - r1 * 1.15)), y1 = Math.min(r.h - 1, Math.ceil(cy + r1 * 1.15));
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const i = yy * r.w + xx;
        if (!r.buf[i]) continue;
        const d = Math.hypot(xx - cx, yy - cy);
        const keep = Math.min((d - r0 * 0.6) / (r0 * 0.6), (r1 - d) / (r1 * 0.45), 1) * env;
        if (bayer(xx, yy) >= keep) r.buf[i] = 0;
      }
    },
  });
}

// ------------------------------------------------------------------ manga sound-effect words

export interface SfxStyle { fill: string; deep: string; ink?: string; size?: number }
const STYLES: Record<string, SfxStyle> = {
  gold: { fill: '#ffd84a', deep: '#e8821c' },
  rose: { fill: '#ff9ac0', deep: '#d23c74' },
  sky: { fill: '#8fe0ff', deep: '#2f7ad0' },
  mint: { fill: '#9af2c0', deep: '#24966a' },
  violet: { fill: '#d0b0ff', deep: '#6a44d0' },
  red: { fill: '#ff7a52', deep: '#b8202c' },
  night: { fill: '#dcd6ff', deep: '#5a52c0', ink: '#1a1438' },
};
const FONT = '"Alagard", "TBME Body", monospace';
type Letter = { img: HTMLCanvasElement; ras: Raster; x: number; y: number };
const sfxCache = new Map<string, Letter[]>();

/**
 * The lettering of one sound-effect word, each letter a little painted object at one art pixel per texel: the pixel
 * font at `size` art pixels per font pixel (Alagard is drawn on a 16-row grid), its face a rounded bevel lit from the
 * top left (lighter above, deeper below), a solid 3D extrusion down and to the right, a coloured outline and a cool
 * violet-blue shadow; plus where each letter sits (art px, the word centred on 0,0). The one place the SFX look is
 * decided (a shared lettering helper can replace it).
 */
export function sfxArt(text: string, style: SfxStyle): Letter[] {
  const n = Math.max(1, Math.round(style.size ?? 2)), key = `${text}|${style.fill}|${style.deep}|${n}`;
  const hit = sfxCache.get(key);
  if (hit) return hit;
  const px = 16 * n, fill = hex(style.fill), deep = hex(style.deep), lower = mix(fill, deep, 0.38), side = mix(deep, hex(style.ink ?? '#2a1640'), 0.25);
  const m = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const out: Letter[] = [];
  const rr = rng(text.length * 31 + text.charCodeAt(0));
  let pen = 0;
  m.font = `${px}px ${FONT}`;
  const metrics = [...text].map((ch) => ({ ch, w: Math.ceil(m.measureText(ch).width) }));
  const total = metrics.reduce((a, b) => a + b.w, 0) + (metrics.length - 1) * Math.max(0, n - 2);
  const D = n + 1; // extrusion depth
  for (const { ch, w } of metrics) {
    if (ch === ' ') { pen += w; continue; }
    const pad = 3 + D, cw = w + pad * 2, chh = Math.ceil(px * 1.15) + pad * 2;
    m.canvas.width = cw; m.canvas.height = chh;
    m.clearRect(0, 0, cw, chh);
    m.font = `${px}px ${FONT}`;
    m.textBaseline = 'alphabetic';
    m.fillStyle = '#fff';
    m.fillText(ch, pad, pad + px * 0.8);
    const d = m.getImageData(0, 0, cw, chh).data;
    const mask = new Uint8Array(cw * chh);
    let top = chh, bot = 0;
    for (let i = 0; i < cw * chh; i++) if (d[i * 4 + 3] > 110) { mask[i] = 1; top = Math.min(top, (i / cw) | 0); bot = Math.max(bot, (i / cw) | 0); }
    const at = (x: number, y: number) => { const X = Math.floor(x), Y = Math.floor(y); return X >= 0 && Y >= 0 && X < cw && Y < chh && mask[Y * cw + X] === 1; };
    const face: Shape = (x, y) => at(x, y);
    const ext: Shape = (x, y) => { for (let k = 1; k <= D; k++) if (at(x - k, y - k)) return true; return false; };
    const split = top + (bot - top) * 0.55;
    const albedo: AFn = (x, y) => (y + (hash(x | 0, y | 0, 5) > 0.7 ? 1 : 0) > split ? lower : fill);
    const r = new Relief(cw, chh, 1, 1);
    r.wobble = 0; r.chip = 0;
    r.fill(ext, flat(1), () => side, { spec: 0.1, shin: 6, bands: 4 }, { id: 1 });
    r.fill(face, pillow(face, cw, chh, Math.max(1.5, n * 0.9), 3), albedo, ENAMEL, { id: 2, seam: true });
    const px4 = r.render();
    const ras = new Raster(cw, chh);
    ras.buf.set(new Uint32Array(px4.buffer, px4.byteOffset, cw * chh));
    // a second, darker coloured line outside the painter's own, so the word reads over anything; the cool shadow
    ras.outline(col(style.ink ?? '#2a1640'));
    ras.shadow(SHADOW, 1, 1);
    // a little tilt per letter is in its baseline (never a rotated sprite: the pixels stay square)
    out.push({ img: ras.canvas(), ras, x: pen + w / 2 - total / 2, y: Math.round((rr() - 0.5) * 2.5 * n) });
    pen += w + Math.max(0, n - 2);
  }
  sfxCache.set(key, out);
  return out;
}

/** Three font pixels per art pixel when the word fits across the screen, two when it doesn't. */
function wordSize(word: string): number {
  const fit = Math.floor((Math.ceil(innerWidth / artPx()) * 0.86) / Math.max(1, word.length * 10));
  return Math.max(2, Math.min(3, fit));
}

/** Throw a manga sound-effect word onto the screen: letters slam in one by one, hold, then dissolve upward. */
export function sfx(word: string, x: number, y: number, o: { style?: keyof typeof STYLES | SfxStyle; size?: number; tilt?: number; dur?: number; delay?: number; align?: -1 | 0 | 1 } = {}) {
  if (typeof document === 'undefined') return;
  const st = typeof o.style === 'object' ? o.style : STYLES[o.style ?? 'gold'];
  const calm = calmMotion(), dur = Math.min(1.2, o.dur ?? 1.05);
  let art: Letter[] | null = null, big: Letter[] | null = null;
  // fade levels on the dither grid, made on first draw
  const levels: HTMLCanvasElement[][] = [];
  const tilt = o.tilt ?? -0.12;
  add({
    t0: fxNow() + (o.delay ?? 0), dur, step() { /* sprites only */ },
    draw(c, t, B) {
      if (!art) {
        const n = o.size ?? st.size ?? wordSize(word);
        art = sfxArt(word, { ...st, size: n });
        big = calm ? art : sfxArt(word, { ...st, size: n + 1 });
        for (const a of art) levels.push([0.75, 0.5, 0.25].map((k) => { const r = new Raster(a.ras.w, a.ras.h); r.buf.set(a.ras.buf); r.dissolve(k); return r.canvas(); }));
      }
      // keep the whole word on screen
      const half = art.reduce((m, a) => Math.max(m, Math.abs(a.x) + a.img.width / 2), 0);
      // `align` 1: x is the word's left edge (-1 its right edge); the whole word always stays on screen
      const cx = Math.max(half + 4, Math.min(c.canvas.width - half - 4, x / B + (o.align ?? 0) * half)), cy = Math.max(16, Math.min(c.canvas.height - 16, y / B));
      const fadeT = dur - 0.24, rise = calm ? 0 : t > fadeT ? Math.round((t - fadeT) * 24) : 0;
      art.forEach((a, i) => {
        const tt = calm ? 1 : t - i * 0.045;
        if (tt < 0) return;
        // letters slam in: a frame a size bigger (re-lettered, not stretched), a drop, then rest on the tilt
        const lx = cx + a.x * Math.cos(tilt), ly = cy + a.y + a.x * Math.sin(tilt) - rise + (calm ? 0 : tt < 0.11 ? -3 : 0);
        let img = !calm && tt < 0.07 ? big![i]?.img ?? a.img : a.img;
        if (t > fadeT) img = levels[i][Math.min(2, Math.floor(((t - fadeT) / 0.24) * 4))] ?? img;
        if (calm && t < 0.15) img = levels[i][2 - Math.min(2, Math.floor((t / 0.15) * 3))];
        blit(c, img, Math.round(lx), Math.round(ly), 1);
      });
    },
  });
}

// ------------------------------------------------------------------ chibi pop-in

let chibiSrc: HTMLImageElement | null = null, chibiKey = '', chibiWait: Promise<void> | null = null;
/** Give the chibi pop-in Pip's portrait (any image URL; a small square face shot reads best). */
export function setChibi(url: string): Promise<void> {
  if (!url || typeof Image === 'undefined') return Promise.resolve();
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => { chibiSrc = im; res(); };
    im.onerror = () => res();
    im.src = url;
  });
}
/** Pip's current portrait, re-sampled to chunky art pixels (rendered once per look). */
function ensureChibi(): Promise<void> {
  return (chibiWait ??= (async () => {
    const look = save.value.look, key = JSON.stringify(look);
    if (key === chibiKey && chibiSrc) return;
    const url = await owlIconAsync(look, 'face');
    // about 84 CSS px across, one portrait pixel per art pixel
    if (url) { await setChibi(await pixelate(url, Math.round(84 / artPx()))); chibiKey = key; }
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
  const mk = (u: number) => (o.mark === 'hearts' || o.mark === 'bang' || o.mark === 'notes' ? markArt(o.mark, u, 1) : markArt('sparkle', u, 2));
  add({
    t0: fxNow(), dur, step() { /* sprites only */ },
    draw(c, t, B) {
      const w = im.width, h = im.height, W = c.canvas.width;
      const y0 = (o.y ?? innerHeight * 0.4) / B;
      // slide in with a hop (a jump past the edge and a settle), hold with a bob, drop away
      let off = 0, lift = 0;
      if (calm) off = 0;
      else if (t < 0.12) off = 1 - t / 0.12;
      else if (t < 0.18) lift = Math.round(h * 0.12);
      else if (t < 0.26) lift = -Math.round(h * 0.04);
      else if (t > dur - 0.18) off = (t - (dur - 0.18)) / 0.18;
      const bob = calm ? 0 : Math.floor(t * 6) % 2;
      const x = left ? w * 0.42 - off * w : W - w * 0.42 + off * w;
      const a = calm ? Math.min(1, t / 0.15, (dur - t) / 0.2) : 1;
      blit(c, im, Math.round(x), Math.round(y0 - bob - lift), 1, left ? 1 : -1, 1, a);
      if (t > 0.2 && t < dur - 0.15) blit(c, mk(w * 0.42), Math.round(x + (left ? 1 : -1) * w * 0.55), Math.round(y0 - h * 0.45), 1, 1, 1, a);
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
      sfx('KA-CHING!', ...wordAt(0, -Math.min(90, H * 0.11)), { style: 'gold', tilt: -0.1 });
      break;
    case 'stamp':
      impactFrame(); shake(8, 0.28);
      speedLines({ x: p.x, y: p.y, dur: 0.5, clear: 0.3 });
      sfx('KA-CHUNK!', ...wordAt(0, -Math.min(100, H * 0.13)), { style: 'red', tilt: -0.08 });
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
  // the lettering font: ask for it early so the first word is already in it
  try { void document.fonts?.load('32px "Alagard"').catch(() => undefined); } catch { /* no font loading API */ }
  // shoot Pip's chibi portrait once things have settled, so the first cut-in is ready
  // and letter the moments' words a little at a time while nothing is happening, so no moment starts with a hitch
  if (!import.meta.env?.VITEST) setTimeout(() => {
    if (!document.getElementById('world')) return;
    void ensureChibi();
    const words: [string, string][] = [['DING!', 'gold'], ['KA-CHING!', 'gold'], ['WOW!', 'mint'], ['YAY!', 'rose'], ['SHING!!', 'gold'], ['POP!', 'violet'], ['ZZZ...', 'night'], ['KA-CHUNK!', 'red']];
    words.forEach(([w, st], i) => setTimeout(() => { const n = wordSize(w); sfxArt(w, { ...STYLES[st], size: n }); sfxArt(w, { ...STYLES[st], size: n + 1 }); }, 400 * (i + 1)));
  }, 9000);
}
