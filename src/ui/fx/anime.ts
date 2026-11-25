// Anime screen effects for the big moments: radial speed/focus lines, an impact frame (two frames of high-contrast
// silhouette), screen shake, sparkle bursts, a sunburst behind a reveal, a chibi Pip popping in from the edge, and
// manga sound-effect words ("POP!", "DING!", "KA-CHING!"...) lettered in the pixel font with an outline and a 3D
// extrusion. All pixel art: whole texels, hard edges, flat colours, ordered-dither fades (no smooth gradients).
// Two transparent canvases: the back one sits between the 3D view and the interface (a sunburst behind a 3D reveal),
// the front one above everything (lines, sparkles, words, the chibi). Short (each moment is over in about a second)
// and cheap (low-res canvases, only running while something plays). With Calm motion (the setting or the system's
// reduced motion) there is no flash, no shake and no lines: words and sparkles just appear and fade.
//   animeMoment('levelup' | 'gacha5' | 'gacha4' | 'unlock' | 'morning' | 'bigbuy' | 'stamp' | 'bedtime', at?)
import { emoteArt, type EmoteKind } from './emotes.ts';
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
/** CSS px per texel: chunky enough to read as pixel art, finer on a phone */
const texel = () => (Math.min(innerWidth, innerHeight) >= 600 ? 3 : 2);

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
export function speedLines(o: { x?: number; y?: number; dur?: number; color?: string; clear?: number; n?: number } = {}) {
  if (calmMotion()) return;
  const dur = o.dur ?? 0.8, c = col(o.color ?? '#1d1420'), n = o.n ?? 70;
  add({
    t0: fxNow(), dur,
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
        const w = (0.6 + rr() * 2.2) * (R / 260);
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

const SPARK_TINTS: Record<string, [string, string]> = { gold: ['#fff3b0', '#f0a828'], pink: ['#ffe0f0', '#ff6fb4'], sky: ['#e2f7ff', '#4cb8f0'], violet: ['#f0e4ff', '#9a64f0'] };
const sparkCache = new Map<string, HTMLCanvasElement>();
/** A four-point anime sparkle: long thin arms, a white heart, a coloured rim (arm 1..8 texels). */
function sparkArt(arm: number, tint: string): HTMLCanvasElement {
  const key = arm + tint;
  let c = sparkCache.get(key);
  if (c) return c;
  const [lt, rim] = SPARK_TINTS[tint] ?? SPARK_TINTS.gold;
  const n = arm * 2 + 5, r = new Raster(n, n), m = (n - 1) / 2, W = col('#ffffff'), L = col(lt);
  for (let i = -arm; i <= arm; i++) {
    const inner = Math.abs(i) <= Math.max(1, arm * 0.35);
    r.set(m + i, m, inner ? W : L); r.set(m, m + i, inner ? W : L);
    // fat in the middle: the arms taper to a point
    if (Math.abs(i) < arm * 0.45 && arm >= 3) { r.set(m + i, m - 1, L); r.set(m + i, m + 1, L); r.set(m - 1, m + i, L); r.set(m + 1, m + i, L); }
  }
  if (arm >= 3) { r.set(m, m, W); r.set(m - 1, m, W); r.set(m + 1, m, W); r.set(m, m - 1, W); r.set(m, m + 1, W); }
  r.outline(col(rim));
  c = r.canvas();
  sparkCache.set(key, c);
  return c;
}

/** Sparkles burst out from a point, spin down and twinkle out. */
export function sparkleBurst(x: number, y: number, n = 14, o: { tint?: string | string[]; spread?: number } = {}) {
  const calm = calmMotion(), rr = rng(Math.floor(Math.random() * 1e6));
  const tints = Array.isArray(o.tint) ? o.tint : [o.tint ?? 'gold'];
  const ps = Array.from({ length: calm ? Math.ceil(n / 2) : n }, (_, i) => {
    const a = rr() * Math.PI * 2, v = (calm ? 0 : 120 + rr() * 260) * (o.spread ?? 1);
    return { a, v, life: 0.55 + rr() * 0.5, arm: 2 + Math.floor(rr() * 5), tint: tints[i % tints.length], d: rr() * 0.12, dist: calm ? 30 + rr() * 90 : 0 };
  });
  add({
    t0: fxNow(), dur: 1.15, step() { /* sprites only */ },
    draw(c, t, B) {
      for (const p of ps) {
        const tt = t - p.d;
        if (tt < 0 || tt > p.life) continue;
        const k = tt / p.life, travel = p.v * (1 - Math.pow(1 - Math.min(1, tt / 0.6), 3)) * 0.55 + p.dist;
        const px = x + Math.cos(p.a) * travel, py = y + Math.sin(p.a) * travel + (calm ? 0 : tt * tt * 60);
        // twinkle: grow, flicker, shrink
        const arm = Math.max(1, Math.round(p.arm * (k < 0.2 ? k / 0.2 : k > 0.7 ? (1 - k) / 0.3 : 1 - (Math.floor(tt * 14) % 3 === 0 ? 0.35 : 0))));
        blit(c, sparkArt(arm, p.tint), Math.round(px / B), Math.round(py / B), 1);
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

export interface SfxStyle { fill: string; deep: string; ink?: string; hi?: string; size?: number }
const STYLES: Record<string, SfxStyle> = {
  gold: { fill: '#ffd84a', deep: '#f08a1c' },
  rose: { fill: '#ff8fb4', deep: '#d23c74' },
  sky: { fill: '#8fe0ff', deep: '#2f8ad8' },
  mint: { fill: '#8ff0b8', deep: '#2ea26a' },
  violet: { fill: '#c9a6ff', deep: '#7448d8' },
  red: { fill: '#ff6a4a', deep: '#b8202c' },
  night: { fill: '#d8d2ff', deep: '#6a62c8', ink: '#1a1430' },
};
const FONT = '"Alagard", "TBME Body", monospace';

/**
 * The lettering of one sound-effect word: each letter a small canvas (1 texel = 1 canvas px) drawn in the pixel font
 * with a two-tone fill, a white top glint, a 2-texel ink outline and a 3-texel extrusion down and to the right, plus
 * where it sits in the word (texels, the word centred on 0,0) and its tilt. The one place the SFX look is decided.
 */
export function sfxArt(text: string, style: SfxStyle): { img: HTMLCanvasElement; x: number; y: number }[] {
  const size = style.size ?? 2; // font pixels per texel x 16 px: 2 = cap height 22 texels
  const px = 16 * size, ink = col(style.ink ?? '#1d1022'), fill = col(style.fill), deep = col(style.deep), hi = col(style.hi ?? '#fffbe8');
  const ext = col(style.deep, 255), extDark = col(style.ink ?? '#1d1022');
  const m = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  const out: { img: HTMLCanvasElement; x: number; y: number }[] = [];
  const rr = rng(text.length * 31 + text.charCodeAt(0));
  let pen = 0;
  const letters = [...text];
  const metrics: { ch: string; w: number }[] = letters.map((ch) => { m.font = `${px}px ${FONT}`; return { ch, w: Math.ceil(m.measureText(ch).width) }; });
  const total = metrics.reduce((a, b) => a + b.w, 0) - (letters.length - 1) * size;
  for (const { ch, w } of metrics) {
    if (ch === ' ') { pen += w; continue; }
    const pad = 9, cw = w + pad * 2 + 6, chh = px + pad * 2 + 6;
    m.canvas.width = cw; m.canvas.height = chh;
    m.clearRect(0, 0, cw, chh);
    m.font = `${px}px ${FONT}`;
    m.textBaseline = 'alphabetic';
    const tilt = (rr() - 0.5) * 0.24;
    m.save();
    m.translate(cw / 2, chh / 2);
    m.rotate(tilt);
    m.fillStyle = '#fff';
    m.fillText(ch, -w / 2, px * 0.34);
    m.restore();
    const d = m.getImageData(0, 0, cw, chh).data;
    const r = new Raster(cw, chh);
    // the letter: a hard threshold of the glyph (no soft edges), lighter on top, deeper below a ragged line
    let top = chh, bot = 0;
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 110) { top = Math.min(top, y); bot = Math.max(bot, y); }
    const split = top + (bot - top) * 0.56;
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      if (d[(y * cw + x) * 4 + 3] <= 110) continue;
      r.set(x, y, y + ((x * 7) % 3 === 0 ? 1 : 0) > split ? deep : fill);
    }
    // a white glint along every top edge
    const src = r.buf.slice();
    for (let y = 1; y < chh; y++) for (let x = 0; x < cw; x++) if (src[y * cw + x] && !src[(y - 1) * cw + x] && y < split) r.set(x, y, hi);
    // 3D: an extrusion down-right in the deep tone, then the ink outline round letter and extrusion together
    const body = r.buf.slice();
    for (let s = 3; s >= 1; s--) for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
      const sx = x - s, sy = y - s;
      if (sx >= 0 && sy >= 0 && body[sy * cw + sx] && !r.buf[y * cw + x]) r.set(x, y, s === 3 ? extDark : ext);
    }
    r.outline(ink, true);
    r.outline(ink);
    const lx = pen + w / 2 - total / 2;
    out.push({ img: r.canvas(), x: lx, y: (rr() - 0.5) * 3 * size });
    pen += w - size;
  }
  return out;
}

/** Throw a manga sound-effect word onto the screen: letters slam in one by one, hold, then dissolve upward. */
export function sfx(word: string, x: number, y: number, o: { style?: keyof typeof STYLES | SfxStyle; size?: number; tilt?: number; dur?: number; delay?: number } = {}) {
  if (typeof document === 'undefined') return;
  const st = typeof o.style === 'object' ? o.style : STYLES[o.style ?? 'gold'];
  const calm = calmMotion(), dur = Math.min(1.2, o.dur ?? 1.05);
  let art: ReturnType<typeof sfxArt> | null = null;
  // fade levels on the dither grid, made on first draw
  const levels: HTMLCanvasElement[][] = [];
  const tilt = o.tilt ?? -0.12;
  add({
    t0: fxNow() + (o.delay ?? 0), dur, step() { /* sprites only */ },
    draw(c, t, B) {
      if (!art) {
        art = sfxArt(word, { ...st, size: o.size ?? st.size ?? 2 });
        for (const a of art) levels.push([0.75, 0.5, 0.25].map((k) => { const r = new Raster(a.img.width, a.img.height); const g = a.img.getContext('2d')!.getImageData(0, 0, a.img.width, a.img.height); r.buf.set(new Uint32Array(g.data.buffer)); r.dissolve(k); return r.canvas(); }));
      }
      // keep the whole word on screen
      const half = art.reduce((m, a) => Math.max(m, Math.abs(a.x) + a.img.width / 2), 0);
      const cx = Math.max(half + 4, Math.min(c.canvas.width - half - 4, x / B)), cy = Math.max(16, Math.min(c.canvas.height - 16, y / B));
      const fadeT = dur - 0.24, rise = calm ? 0 : t > fadeT ? Math.round((t - fadeT) * 24) : 0;
      art.forEach((a, i) => {
        const tt = calm ? 1 : t - i * 0.045;
        if (tt < 0) return;
        const s = calm ? 1 : tt < 0.035 ? 1.7 : tt < 0.07 ? 1.25 : tt < 0.11 ? 0.9 : 1;
        // letters ride a slight tilt along the word
        const lx = cx + a.x * Math.cos(tilt), ly = cy + a.y + a.x * Math.sin(tilt) - rise + (calm ? 0 : tt < 0.11 ? -2 : 0);
        let img = a.img;
        if (t > fadeT) img = levels[i][Math.min(2, Math.floor(((t - fadeT) / 0.24) * 4))] ?? img;
        if (calm && t < 0.15) img = levels[i][2 - Math.min(2, Math.floor((t / 0.15) * 3))];
        blit(c, img, Math.round(lx), Math.round(ly), 1, s, s);
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
    const [{ save }, { owlIconAsync }, { pixelate }] = await Promise.all([import('../../game/store.ts'), import('../portraits.ts'), import('../pxfx.tsx')]);
    const look = save.value.look, key = JSON.stringify(look);
    if (key === chibiKey && chibiSrc) return;
    const url = await owlIconAsync(look, 'face');
    if (url) { await setChibi(await pixelate(url, 44)); chibiKey = key; }
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
  const art = emoteArt();
  const mark = o.mark === 'hearts' ? art.heart : o.mark === 'bang' ? art.bang : o.mark === 'notes' ? art.notes[1] : art.spark[0][2];
  add({
    t0: fxNow(), dur, step() { /* sprites only */ },
    draw(c, t, B) {
      const k = Math.max(1, Math.round(110 / B / im.width)); // about 110 CSS px across
      const w = im.width * k, h = im.height * k, W = c.canvas.width;
      const y0 = (o.y ?? innerHeight * 0.4) / B;
      // slide in with a hop and a squash, hold with a bob, drop away
      let off = 0, sx = 1, sy = 1;
      if (calm) off = 0;
      else if (t < 0.12) off = 1 - t / 0.12;
      else if (t < 0.18) { sx = 1.18; sy = 0.84; }
      else if (t < 0.26) { sx = 0.9; sy = 1.12; }
      else if (t > dur - 0.18) off = (t - (dur - 0.18)) / 0.18;
      const bob = calm ? 0 : Math.floor(t * 6) % 2;
      const x = left ? w * 0.42 - off * w : W - w * 0.42 + off * w;
      const a = calm ? Math.min(1, t / 0.15, (dur - t) / 0.2) : 1;
      blit(c, im, Math.round(x), Math.round(y0 - bob), k, (left ? 1 : -1) * sx, sy, a);
      if (t > 0.2 && t < dur - 0.15) blit(c, mark, Math.round(x + (left ? 1 : -1) * w * 0.5), Math.round(y0 - h * 0.45), Math.max(1, Math.round(k / 2)), 1, 1, a);
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
      sfx('DING!', ...wordAt(Math.min(110, W * 0.26), -Math.min(130, H * 0.16)), { style: 'gold', tilt: -0.16 });
      break;
    case 'gacha5':
      impactFrame(); shake(7, 0.4);
      speedLines({ x: p.x, y: p.y, dur: 0.95, color: '#2a1a08', clear: 0.34 });
      sunburst(p.x, p.y, { colors: ['#ffd23f', '#fff2b8'], dur: 1.2, r0: 70, alpha: 0.4 });
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
      speedLines({ x: p.x, y: p.y, dur: 0.8, clear: 0.4 });
      sunburst(p.x, p.y, { colors: ['#ffe58a', '#fff6d0'], dur: 1.1, r0: 50, alpha: 0.36 });
      sparkleBurst(p.x, p.y, 16, { tint: ['gold', 'sky'] });
      sfx('TA-DA!', ...wordAt(0, -Math.min(120, H * 0.15)), { style: 'mint', tilt: -0.1 });
      chibi({ side: 'left', mark: 'bang' });
      break;
    case 'morning':
      sparkleBurst(p.x, p.y, 16, { tint: ['gold', 'pink', 'sky'] });
      sfx('TA-DA!', ...wordAt(Math.min(70, W * 0.18), -Math.min(110, H * 0.13)), { style: 'gold', tilt: -0.12 });
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
  (window as unknown as { hhAnime: unknown }).hhAnime = { animeMoment, speedLines, impactFrame, shake, sparkleBurst, sunburst, sfx, chibi, setChibi };
  // the lettering font: ask for it early so the first word is already in it
  try { void document.fonts?.load('32px "Alagard"').catch(() => undefined); } catch { /* no font loading API */ }
}
