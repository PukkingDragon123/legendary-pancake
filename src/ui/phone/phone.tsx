// A pretend smartphone (a realistic graphite body [ui7]; generic: no real brand, made-up apps), used to show
// what the bedtime phone lock does. Its screen plays a little film, painted pixel by pixel on a 68 x 146 canvas:
// the lock screen with the real time over a moonlit wallpaper, notifications buzzing in from made-up apps, the
// bedtime banner, the home screen where the distracting apps are padlocked one by one, the "Hoot Hollow is keeping
// you asleep" shield, then a calm, dimmed screen until the wake-up time.
//   <FakePhone k={2} wake="07:00" hour12={false} loop />   the phone, k CSS px per art pixel
//   new PhoneScreen(wake, hour12)                             just the screen (a canvas), e.g. as a 3D texture
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { crispText } from '../../onboard/tex.ts';
import { fontAt, fontReady } from '../font.ts';
import { Real, bevel, box, deviceK, metal } from '../real/paint.ts';

export const SW = 68, SH = 146;
/** the film's length (seconds) and its beats */
export const FILM = 13.5;
const T = { notif: [0.8, 1.7, 2.6, 3.5], banner: 4.6, sweep: 5.1, home: 5.8, lock0: 6.3, lockStep: 0.32, shield: 9.2, calm: 11.2 };

type RGB = [number, number, number];
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: RGB, k: number): RGB => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
function hash(x: number, y: number, s = 0) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => B4[((y & 3) << 2) | (x & 3)];

/** A little pixel canvas: per-pixel painting with stepped rounded rectangles. */
class Px {
  readonly c = document.createElement('canvas');
  readonly g: CanvasRenderingContext2D;
  readonly img: ImageData;
  constructor(readonly w: number, readonly h: number) { this.c.width = w; this.c.height = h; this.g = this.c.getContext('2d')!; this.img = this.g.createImageData(w, h); }
  set(x: number, y: number, c: RGB, a = 1) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.img.data, oa = d[i + 3] / 255, na = a + oa * (1 - a);
    if (na <= 0) return;
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * oa * (1 - a)) / na;
    d[i + 3] = na * 255;
  }
  get(x: number, y: number): RGB { const i = ((y | 0) * this.w + (x | 0)) * 4, d = this.img.data; return [d[i], d[i + 1], d[i + 2]]; }
  /** inset of a stepped round corner on row i of a radius-r corner */
  static ins(i: number, r: number) { return i >= r ? 0 : Math.round(r - Math.sqrt(Math.max(0, r * r - (r - i - 0.5) ** 2))); }
  rr(x: number, y: number, w: number, h: number, r: number, f: (x: number, y: number, e: number) => RGB | null, a = 1) {
    for (let j = 0; j < h; j++) {
      const ins = Math.max(Px.ins(j, r), Px.ins(h - 1 - j, r));
      for (let i = ins; i < w - ins; i++) {
        const e = Math.min(i - ins, w - ins - 1 - i, j, h - 1 - j);
        const c = f(i, j, e);
        if (c) this.set(x + i, y + j, c, a);
      }
    }
  }
  done() { this.g.putImageData(this.img, 0, 0); return this.c; }
}

// ------------------------------------------------------------------ the made-up apps and their icons

interface App { id: string; name: string; col: string; lock: boolean; glyph: (p: Px, o: number) => void }
const W: RGB = [252, 248, 238];
const glyphs: Record<string, (p: Px, o: number) => void> = {
  chat: (p, o) => { p.rr(o + 3, o + 3, 8, 6, 2, () => W); p.set(o + 4, o + 9, W); p.set(o + 4, o + 10, W); for (const x of [5, 7, 9]) p.set(o + x, o + 6, hex('#e8762a')); },
  reel: (p, o) => { for (let j = 0; j < 6; j++) for (let i = 0; i <= j && i < 6 - j; i++) { p.set(o + 5 + i, o + 4 + j, W); } p.set(o + 5, o + 9, W); p.set(o + 5, o + 3, W); for (let i = 3; i < 11; i++) { p.set(o + i, o + 11, shade(W, 0.85)); } },
  swirl: (p, o) => { for (let a = 0; a < 15; a += 0.25) { const r = a * 0.33; p.set(o + 7 + Math.cos(a) * r, o + 7 + Math.sin(a) * r, W); } },
  photo: (p, o) => { p.rr(o + 3, o + 3, 9, 8, 1, (x, y) => (y > 4 ? hex('#3a7a3a') : hex('#f8d06a'))); p.set(o + 9, o + 5, W); p.set(o + 10, o + 5, W); p.set(o + 9, o + 4, W); },
  game: (p, o) => { p.rr(o + 2, o + 5, 11, 5, 2, () => W); p.set(o + 4, o + 7, hex('#2a6a3a')); p.set(o + 5, o + 6, hex('#2a6a3a')); p.set(o + 5, o + 8, hex('#2a6a3a')); p.set(o + 6, o + 7, hex('#2a6a3a')); p.set(o + 10, o + 6, hex('#c83a3a')); p.set(o + 9, o + 8, hex('#e8c83a')); },
  mail: (p, o) => { p.rr(o + 3, o + 4, 9, 7, 1, () => W); for (let i = 0; i < 5; i++) { p.set(o + 3 + i, o + 4 + i * 0.8, hex('#2a5ab8')); p.set(o + 11 - i, o + 4 + i * 0.8, hex('#2a5ab8')); } },
  bag: (p, o) => { p.rr(o + 3, o + 6, 9, 6, 1, () => W); for (const x of [5, 9]) { p.set(o + x, o + 4, W); p.set(o + x, o + 5, W); } for (let x = 6; x < 9; x++) p.set(o + x, o + 3, W); },
  news: (p, o) => { p.rr(o + 3, o + 3, 9, 9, 1, () => W); for (let y = 5; y < 11; y += 2) for (let x = 5; x < (y === 5 ? 10 : 8); x++) p.set(o + x, o + y, hex('#5a5a6a')); },
  clock: (p, o) => { for (let a = 0; a < 6.3; a += 0.2) p.set(o + 7.5 + Math.cos(a) * 4, o + 7.5 + Math.sin(a) * 4, W); for (let i = 0; i < 3; i++) p.set(o + 7, o + 5 + i, W); p.set(o + 8, o + 7, W); p.set(o + 9, o + 7, W); },
  call: (p, o) => { for (const [x, y] of [[4, 4], [5, 4], [4, 5], [4, 6], [5, 7], [6, 8], [7, 9], [8, 10], [9, 10], [10, 10], [10, 9], [9, 9]]) p.set(o + x, o + y, W); },
  moon: (p, o) => { for (let y = 2; y < 12; y++) for (let x = 2; x < 12; x++) { const d = Math.hypot(x - 7, y - 7), d2 = Math.hypot(x - 9, y - 5.5); if (d < 4.6 && d2 > 3.6) p.set(o + x, o + y, hex('#f8e6a0')); } p.set(o + 10, o + 9, W); p.set(o + 11, o + 3, W); },
  cam: (p, o) => { p.rr(o + 2, o + 5, 11, 7, 2, () => W); for (let a = 0; a < 6.3; a += 0.4) p.set(o + 7.5 + Math.cos(a) * 2, o + 8.5 + Math.sin(a) * 2, hex('#4a4a5a')); p.set(o + 5, o + 4, W); p.set(o + 6, o + 4, W); },
};
export const APPS: App[] = [
  { id: 'natter', name: 'Natter', col: '#e8762a', lock: true, glyph: glyphs.chat },
  { id: 'loopreel', name: 'Loopreel', col: '#c8326e', lock: true, glyph: glyphs.reel },
  { id: 'scrollie', name: 'Scrollie', col: '#8a4ac8', lock: true, glyph: glyphs.swirl },
  { id: 'glimmer', name: 'Glimmer', col: '#3a8ad8', lock: true, glyph: glyphs.photo },
  { id: 'quest', name: 'Questy', col: '#3a9a4a', lock: true, glyph: glyphs.game },
  { id: 'mail', name: 'Mailbox', col: '#2a5ab8', lock: true, glyph: glyphs.mail },
  { id: 'shoppa', name: 'Shoppa', col: '#e0a82a', lock: true, glyph: glyphs.bag },
  { id: 'newsy', name: 'Newsy', col: '#7a7a8e', lock: true, glyph: glyphs.news },
  { id: 'camera', name: 'Camera', col: '#4a4a58', lock: true, glyph: glyphs.cam },
  { id: 'clock', name: 'Clock', col: '#2a2a3c', lock: false, glyph: glyphs.clock },
  { id: 'phone', name: 'Phone', col: '#2aa86a', lock: false, glyph: glyphs.call },
  { id: 'hollow', name: 'Hoot Hollow', col: '#1d2c62', lock: false, glyph: glyphs.moon },
];
const NOTIFS: { app: string; text: string }[] = [
  { app: 'natter', text: 'Sam: you up??' },
  { app: 'loopreel', text: 'Live: 3am cats' },
  { app: 'scrollie', text: '12 new posts' },
  { app: 'quest', text: 'Energy is full!' },
];

const iconCache = new Map<string, HTMLCanvasElement>();
/** a 15 x 15 app icon: a hand-shaded rounded tile (lit top left, deeper bottom right) and its glyph */
function icon(a: App, grey = false): HTMLCanvasElement {
  const key = a.id + (grey ? ':g' : '');
  let c = iconCache.get(key);
  if (c) return c;
  const p = new Px(15, 15), base = hex(a.col);
  p.rr(0, 0, 15, 15, 4, (x, y, e) => {
    const k = 1.18 - (x + y) / 28 * 0.42 + (hash(x, y, 3) - 0.5) * 0.08;
    const c2 = shade(base, e === 0 ? k * 0.72 : k);
    return grey ? mixc(c2, [80, 82, 92], 0.72) : c2;
  });
  a.glyph(p, 0);
  if (grey) for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) { const q = p.get(x, y), i = (y * 15 + x) * 4; if (p.img.data[i + 3]) { const l = (q[0] + q[1] + q[2]) / 3; p.img.data[i] = p.img.data[i + 1] = l * 0.55; p.img.data[i + 2] = l * 0.62; } }
  c = p.done();
  iconCache.set(key, c);
  return c;
}
let lockC: HTMLCanvasElement | null = null;
/** a little brass padlock, 7 x 9 */
function padlock() {
  if (lockC) return lockC;
  const p = new Px(7, 9), br: RGB = [232, 186, 74], brD: RGB = [150, 102, 30];
  for (const [x, y] of [[1, 3], [1, 2], [2, 1], [3, 0], [4, 1], [5, 2], [5, 3]]) p.set(x, y, shade([200, 204, 212], 1));
  p.rr(0, 4, 7, 5, 1, (x, y, e) => (e === 0 ? brD : y < 2 ? br : shade(br, 0.85)));
  p.set(3, 6, [60, 40, 20]); p.set(3, 7, [60, 40, 20]);
  return (lockC = p.done());
}

// ------------------------------------------------------------------ the wallpaper

let wallC: HTMLCanvasElement | null = null;
/** a moonlit wallpaper: deep blue sky, stars, the moon, layered hills of pines, a lit window in a hollow oak */
function wallpaper() {
  if (wallC) return wallC;
  const p = new Px(SW, SH);
  const top = hex('#0e1640'), mid = hex('#2a2a6e'), low = hex('#5a3a7a');
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const t = y / SH, c = t < 0.55 ? mixc(top, mid, t / 0.55) : mixc(mid, low, (t - 0.55) / 0.45);
    p.set(x, y, shade(c, 1 + (bayer(x, y) - 0.5) * 0.08));
  }
  for (let i = 0; i < 40; i++) { const x = hash(i, 1, 7) * SW, y = hash(i, 2, 7) * SH * 0.6; p.set(x, y, hash(i, 3, 7) > 0.7 ? [255, 244, 200] : [200, 210, 255], 0.5 + hash(i, 4, 7) * 0.5); }
  // the moon with a soft dithered halo
  for (let y = 72; y < 108; y++) for (let x = 30; x < 68; x++) {
    const d = Math.hypot(x - 50, y - 90);
    if (d < 9) p.set(x, y, mixc(hex('#fff4d0'), hex('#e8d8a8'), (hash(x >> 1, y >> 1, 2) > 0.7 ? 0.6 : 0) + d / 30));
    else if (d < 16 && bayer(x, y) < (16 - d) / 14) p.set(x, y, hex('#6a6aa8'), 0.5);
  }
  // hills of pines, back to front
  const hill = (base: number, amp: number, c: RGB, seed: number) => {
    for (let x = 0; x < SW; x++) {
      const h = base - Math.sin(x * 0.07 + seed) * amp - Math.sin(x * 0.19 + seed * 2) * amp * 0.4;
      for (let y = Math.floor(h); y < SH; y++) p.set(x, y, shade(c, 1 + (hash(x, y, seed) - 0.5) * 0.1));
    }
    for (let i = 0; i < 9; i++) {
      const tx = (hash(i, seed, 5) * SW) | 0, th = 8 + hash(i, seed, 6) * 9, ty = base - Math.sin(tx * 0.07 + seed) * amp + 2;
      for (let j = 0; j < th; j++) { const hw = Math.floor((j / th) * 3.5); for (let k = -hw; k <= hw; k++) p.set(tx + k, ty - th + j, shade(c, 0.85 + ((j + k) & 1) * 0.08)); }
    }
  };
  hill(104, 4, hex('#2a2a5a'), 1);
  hill(118, 5, hex('#1f2448'), 2);
  hill(132, 3, hex('#141a34'), 3);
  // a warm window far off
  p.set(16, 126, [255, 200, 110]); p.set(17, 126, [255, 200, 110]); p.set(16, 127, [230, 150, 70]); p.set(17, 127, [230, 150, 70]);
  return (wallC = p.done());
}

// ------------------------------------------------------------------ the screen

/** the screen is drawn at twice the art resolution (a phone's screen is finer than the world): native-size fonts */
const S2 = 2;
// [font14] the game's pixel faces at whole grid sizes (on the screen's 2x canvas, a font pixel is half an art pixel or
// a whole one): the clock and "Sleeping" in the display face, app labels and notifications in the body face
const SMALL = fontAt(15), BIG = fontAt(45, { caps: true }), MED = fontAt(30, { caps: true }), APP = fontAt(15);
const phoneFonts: Promise<void> = typeof document === 'undefined' ? Promise.resolve() : fontReady();
const step = (t: number, a: number, d: number) => Math.max(0, Math.min(1, Math.floor(((t - a) / d) * 5) / 5));
const ease = (k: number) => 1 - (1 - k) ** 3;

let scr2: HTMLCanvasElement | null = null;
const scratch = () => { if (!scr2) { scr2 = document.createElement('canvas'); scr2.width = SW * S2; scr2.height = SH * S2; } return scr2; };

/** The phone's screen as a canvas; draw(t) paints the film at time t (seconds). */
export class PhoneScreen {
  readonly canvas = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  private lockOrder = APPS.map((a, i) => i).filter((i) => APPS[i].lock);
  constructor(public wake = '07:00', public hour12 = false, public now: () => Date = () => new Date()) {
    this.canvas.width = SW * S2; this.canvas.height = SH * S2;
    this.g = this.canvas.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.g.setTransform(S2, 0, 0, S2, 0, 0);
  }
  private time(d: Date) { const h = d.getHours(), m = d.getMinutes(); return this.hour12 ? `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}` : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }
  private wakeTxt() { const [h, m] = this.wake.split(':').map(Number); const d = new Date(); d.setHours(h, m); return this.time(d) + (this.hour12 ? (h < 12 ? ' am' : ' pm') : ''); }
  /** text at the screen's full resolution (x, y in art px) */
  private text(s: string, x: number, y: number, font: string, c: string, align: CanvasTextAlign = 'left', max = 0) {
    const g = this.g, a = g.globalAlpha;
    if (max) { const m = scratch().getContext('2d')!; m.font = font; while (s.length > 2 && m.measureText(s).width > max * S2) s = s.slice(0, -2) + '…'; }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (a < 1) { const tmp = scratch(); const tg = tmp.getContext('2d')!; tg.clearRect(0, 0, tmp.width, tmp.height); crispText(tg, s, x * S2, y * S2, font, c, { align }); g.drawImage(tmp, 0, 0); }
    else crispText(g, s, x * S2, y * S2, font, c, { align });
    g.setTransform(S2, 0, 0, S2, 0, 0);
  }
  /** a frosted card (a notification, the banner, the shield) */
  private card(x: number, y: number, w: number, h: number, a = 0.9, tintC: RGB = [238, 236, 246]) {
    const g = this.g, r = 3;
    for (let j = 0; j < h; j++) {
      const ins = Math.max(Px.ins(j, r), Px.ins(h - 1 - j, r));
      g.fillStyle = css(j === 0 ? shade(tintC, 1.06) : j === h - 1 ? shade(tintC, 0.8) : tintC, a);
      g.fillRect(x + ins, y + j, w - ins * 2, 1);
    }
  }
  draw(t: number) {
    const g = this.g, now = this.now();
    g.globalAlpha = 1;
    g.setTransform(S2, 0, 0, S2, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, SW, SH);
    g.drawImage(wallpaper(), 0, 0);
    const calm = t >= T.calm, home = t >= T.home && !calm;
    // the screen wakes up
    const wakeK = step(t, 0, 0.5);
    if (home) { g.fillStyle = 'rgba(8,10,30,0.35)'; g.fillRect(0, 0, SW, SH); }
    // status bar
    if (!calm) {
      this.text(this.time(now), 5, 8, SMALL, '#f4f0ff');
      g.fillStyle = '#f4f0ff';
      for (let i = 0; i < 4; i++) g.fillRect(46 + i * 2, 7 - i, 1, i + 1);
      g.fillRect(55, 3, 8, 5); g.fillStyle = '#6ad86a'; g.fillRect(56, 4, 5, 3); g.fillStyle = '#f4f0ff'; g.fillRect(63, 4, 1, 3);
    }
    // the punch-hole camera
    g.fillStyle = '#05060a'; g.fillRect(32, 2, 4, 4); g.fillRect(33, 1, 2, 6); g.fillRect(31, 3, 6, 2);
    if (!home && !calm) {
      // the lock screen: the time, the date
      g.globalAlpha = wakeK;
      this.text(this.time(now), SW / 2, 34, BIG, '#fffaf0', 'center');
      this.text(now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' }), SW / 2, 44, SMALL, '#e6e0ff', 'center');
      g.globalAlpha = 1;
      // notifications stack in under the clock, newest on top; then the sweep
      const arrived = T.notif.filter((a) => t >= a).length;
      for (let i = 0; i < arrived; i++) {
        const age = t - T.notif[i], slot = arrived - 1 - i;
        if (slot > 2) continue;
        const inK = ease(step(age, 0, 0.25));
        const outK = t > T.sweep ? ease(step(t, T.sweep + (arrived - 1 - i) * 0.12, 0.25)) : 0;
        const y = 54 + slot * 21 - (1 - inK) * 18, x = 3 + outK * 70;
        const a = (slot === 2 ? 0.55 : 0.92) * inK;
        const n = NOTIFS[i], app = APPS.find((q) => q.id === n.app)!;
        this.card(x, y, SW - 6, 19, a);
        g.globalAlpha = inK;
        g.drawImage(icon(app), x + 2, y + 2, 15, 15);
        this.text(app.name, x + 20, y + 8, SMALL, '#1a1830', 'left', 28);
        this.text('now', x + SW - 8, y + 8, SMALL, '#7a7a90', 'right');
        this.text(n.text, x + 20, y + 15.5, SMALL, '#3a3850', 'left', SW - 30);
        g.globalAlpha = 1;
      }
      // the bedtime banner drops in from the top
      if (t >= T.banner) {
        const k = ease(step(t, T.banner, 0.25)), y = 10 - (1 - k) * 24;
        this.card(3, y, SW - 6, 20, 0.95, [42, 52, 110]);
        g.drawImage(icon(APPS[11]), 5, y + 3, 15, 15);
        this.text('Bedtime', 23, y + 9, SMALL, '#ffe8a0');
        this.text(`until ${this.wakeTxt()}`, 23, y + 17, SMALL, '#e0e4ff');
      }
    }
    if (home) {
      // the home screen; the distracting apps get padlocked one by one
      for (let i = 0; i < APPS.length; i++) {
        const a = APPS[i], cx = 6 + (i % 3) * 21, cy = 18 + Math.floor(i / 3) * 24;
        const li = this.lockOrder.indexOf(i), lt = li >= 0 ? T.lock0 + li * T.lockStep : Infinity;
        const locked = t >= lt;
        const pop = step(t, T.home, 0.3);
        g.globalAlpha = pop;
        g.drawImage(icon(a, locked), cx + 1, cy, 15, 15);
        this.text(a.name.split(' ')[a.id === 'hollow' ? 1 : 0], cx + 8.5, cy + 20, SMALL, locked ? '#8a8aa0' : '#f0f0ff', 'center');
        if (locked) {
          const k = step(t, lt, 0.18), drop = (1 - k) * -8 + (k >= 1 ? 0 : Math.sin(k * 3) * 1);
          g.globalAlpha = Math.min(1, k * 2);
          g.drawImage(padlock(), cx + 10, cy + 8 + drop, 7, 9);
        }
        g.globalAlpha = 1;
      }
      // the shield
      if (t >= T.shield) {
        const k = ease(step(t, T.shield, 0.3));
        g.fillStyle = `rgba(6,8,24,${0.55 * k})`; g.fillRect(0, 0, SW, SH);
        const y = 40 + (1 - k) * 20;
        g.globalAlpha = k;
        this.card(4, y, SW - 8, 64, 0.97, [30, 40, 92]);
        // a pixel shield with the moon and a padlock
        const sx = SW / 2 - 7, sy = y + 5;
        for (let j = 0; j < 16; j++) { const hw = j < 9 ? 7 : Math.max(0, 7 - (j - 8) * 1); for (let i = -hw; i < hw; i++) { g.fillStyle = Math.abs(i + 0.5) > hw - 1.5 || j === 0 ? '#c89a3a' : j < 8 ? '#3a5ab8' : '#2a4aa0'; g.fillRect(sx + 7 + i, sy + j, 1, 1); } }
        g.drawImage(padlock(), sx + 4, sy + 4, 7, 9);
        this.text('Hoot Hollow', SW / 2, y + 30, APP, '#ffe8a0', 'center');
        this.text('is keeping', SW / 2, y + 38, APP, '#f0f0ff', 'center');
        this.text('you asleep', SW / 2, y + 46, APP, '#f0f0ff', 'center');
        this.text(`until ${this.wakeTxt()}`, SW / 2, y + 57, SMALL, '#a8b4f0', 'center');
        g.globalAlpha = 1;
      }
    }
    if (calm) {
      // calm and dim: a sleeping screen until the morning
      const k = step(t, T.calm, 0.6);
      g.fillStyle = `rgba(4,5,16,${0.35 + k * 0.35})`; g.fillRect(0, 0, SW, SH);
      g.globalAlpha = 0.55 + (1 - k) * 0.3;
      this.text(this.time(now), SW / 2, 34, BIG, '#c8c0e8', 'center');
      this.text('Sleeping', SW / 2, 56, MED, '#a8a0d8', 'center');
      this.text(`until ${this.wakeTxt()}`, SW / 2, 66, SMALL, '#8a84c0', 'center');
      // [ui10] a candle on a brass dish, its flame glowing softly (no moon emblem)
      for (let yy = 80; yy < 112; yy++) for (let xx = 18; xx < 50; xx++) {
        const fd = Math.hypot((xx - 33) * 1.6, yy - 88);
        if (yy >= 108 && yy < 110 && xx >= 26 && xx < 41) { g.fillStyle = yy === 108 ? '#e0b860' : '#8a6420'; g.fillRect(xx, yy, 1, 1); }
        else if (yy >= 93 && yy < 108 && xx >= 30 && xx < 37) { g.fillStyle = xx === 30 ? '#c8a878' : xx >= 35 ? '#b89060' : '#f0e0b8'; g.fillRect(xx, yy, 1, 1); }
        else if (yy >= 91 && yy < 93 && xx === 33) { g.fillStyle = '#2a1a10'; g.fillRect(xx, yy, 1, 1); }
        else if (fd < 4.2 && yy < 92) { g.fillStyle = fd < 2.2 ? '#fff4c8' : '#f4b04a'; g.fillRect(xx, yy, 1, 1); }
        else if (fd < 14 && bayer(xx, yy) < (14 - fd) / 16) { g.fillStyle = 'rgba(240,190,110,0.3)'; g.fillRect(xx, yy, 1, 1); }
      }
      const zz = (t * 1.2) % 1;
      this.text('z', 46 + zz * 4, 92 - zz * 8, SMALL, '#c8c0f0');
      this.text('z', 52 + zz * 3, 86 - zz * 6, MED, '#c8c0f0');
      g.globalAlpha = 1;
    }
    // the glass: a faint diagonal glint
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 26; i++) g.fillRect(SW - 22 - i, i * 2, 6, 2);
    g.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ the body

const bodyCache = new Map<string, string>();
/** the phone's body (78 x 158): graphite frame with stepped round corners, rim highlights, the side buttons */
/** [ui7] the phone's body: a satin-graphite aluminium band with polished chamfers, side buttons, a black glass front
 * (80 x 160 art units, painted by the material painter at device resolution) */
function bodyURL(): string {
  let u = bodyCache.get('b7');
  if (u) return u;
  const BW = 78, BH = 158, r = new Real(BW, BH, deviceK(3) * 3, 1);
  const band = metal([90, 96, 108], { polish: 0.7 });
  for (const [y0, h] of [[34, 14], [52, 22], [80, 22]] as const) r.part(box(-0.8, y0, 2, h, 0.8), 1.5, band);
  r.part(box(BW - 1.2, 44, 2, 20, 0.8), 1.5, band);
  r.part(box(0, 0, BW, BH, 11), bevel(3, 2.2), band);
  r.part(box(2.6, 2.6, BW - 5.2, BH - 5.2, 9), 3.4, { alb: () => [8, 9, 12], spec: 1, shin: 90, coat: 1 });
  u = r.url({ shadow: { dy: 2, blur: 3, a: 0.45 } });
  bodyCache.set('b7', u);
  return u;
}

let cssDone = false;
function injectCSS() {
  if (cssDone) return;
  cssDone = true;
  const st = document.createElement('style');
  st.textContent = `
.hh-phone{position:relative;--u:calc(var(--pk) * 1px);width:calc(80 * var(--u));height:calc(160 * var(--u));flex:none;pointer-events:none}
.hh-phone img,.hh-phone canvas{position:absolute;display:block}
.hh-phone .body{left:0;top:0;width:100%;height:100%}
.hh-phone canvas{left:calc(6 * var(--u));top:calc(6 * var(--u));width:calc(${SW} * var(--u));height:calc(${SH} * var(--u))}
.hh-phone.buzz{animation:hh-phone-buzz .24s ease-in-out}
.hh-lock{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:12px;background:rgba(6,8,26,.84);animation:hh-lock-in .3s ease-in-out both}
@keyframes hh-lock-in{from{opacity:0}to{opacity:1}}
.hh-lock .hh-phone{animation:hh-lock-up .5s ease-in-out both}
@keyframes hh-lock-up{from{transform:translateY(60px)}to{transform:none}}
.hh-lock-cap{max-width:300px;text-align:center;padding:10px 14px;color:#f4e8cc;font:600 17px var(--font-body, serif);line-height: 1.0667}
.hh-lock-cap b{display:block;font-size:var(--t1);color:#ffe08a;margin-bottom:2px}
.hh-lock button{min-width:200px;padding:10px 18px;font:600 17px var(--font-body, serif);cursor:pointer}
@keyframes hh-phone-buzz{0%,100%{transform:none}20%{transform:translateX(calc(-1 * var(--u))) rotate(-1deg)}40%{transform:translateX(var(--u)) rotate(1deg)}60%{transform:translateX(calc(-1 * var(--u)))}80%{transform:translateX(var(--u))}}
@media (prefers-reduced-motion:reduce){.hh-phone.buzz{animation:none}}
`;
  document.head.appendChild(st);
}

/**
 * The phone, playing its film. `k` is CSS px per art pixel. Loops unless `loop` is false (then `onDone` fires at
 * the end and it rests on the calm screen). `sound` plays the buzzes and clunks quietly.
 */
export function FakePhone(p: { k?: number; wake: string; hour12: boolean; loop?: boolean; sound?: boolean; onDone?: () => void; class?: string; style?: string; start?: number; paused?: number | null }) {
  injectCSS();
  const box = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const opts = useRef(p);
  opts.current = p;
  useEffect(() => {
    const c = cv.current, el = box.current;
    if (!c || !el) return undefined;
    const scr = new PhoneScreen(p.wake, p.hour12);
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    let raf = 0, t0 = performance.now() - (p.start ?? 0) * 1000, last = -1, alive = true, ended = false;
    const cues = [...T.notif.map((x) => ({ t: x, id: 'notify_soft', v: 0.25, buzz: true })), { t: T.banner, id: 'notify_reminder', v: 0.3, buzz: true },
      ...APPS.filter((a) => a.lock).map((_, i) => ({ t: T.lock0 + i * T.lockStep, id: 'place_metal', v: 0.18, buzz: false })), { t: T.shield, id: 'sparkle', v: 0.3, buzz: false }, { t: T.calm, id: 'breath_out', v: 0.2, buzz: false }];
    let ready = false;
    void phoneFonts.then(() => { ready = true; });
    const frame = (now: number) => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const o = opts.current;
      let t = o.paused != null ? o.paused : (now - t0) / 1000;
      if (t >= FILM) {
        if (o.loop !== false) { t0 = now; t = 0; last = -1; }
        else { t = FILM - 0.01; if (!ended) { ended = true; o.onDone?.(); } }
      }
      // twelve frames a second: a stepped, pixel-art pace
      const f = Math.floor(t * 12);
      if (f === last && ready) return;
      if (o.paused == null) for (const q of cues) if (q.t > last / 12 && q.t <= t) {
        if (o.sound) try { sound.play(q.id, { volume: q.v, gap: 60 }); } catch { /* */ }
        if (q.buzz) { el.classList.remove('buzz'); void el.offsetWidth; el.classList.add('buzz'); }
      }
      last = f;
      scr.wake = o.wake; scr.hour12 = o.hour12;
      scr.draw(t);
      g.clearRect(0, 0, SW * S2, SH * S2);
      g.drawImage(scr.canvas, 0, 0);
    };
    raf = requestAnimationFrame(frame);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={box} class={'hh-phone ' + (p.class ?? '')} style={`--pk:${p.k ?? 2};${p.style ?? ''}`} aria-hidden="true">
      <img class="body" src={bodyURL()} alt="" draggable={false} />
      <canvas ref={cv} width={SW * S2} height={SH * S2} />
    </div>
  );
}

/**
 * The bedtime phone lock, shown full screen: the phone plays its film once (notifications, the lock, the shield,
 * the calm screen); "Goodnight, phone" finishes the wind-down step. Tapping outside closes it.
 */
export function PhoneLockSheet(p: { wake: string; hour12: boolean; onDone: () => void; onClose: () => void }) {
  injectCSS();
  const [end, setEnd] = useState(false);
  const k = innerHeight >= 700 && innerWidth >= 300 ? 3 : innerHeight >= 480 ? 2 : 1; // whole pixels only
  const [h, m] = p.wake.split(':').map(Number);
  const wake = p.hour12 ? ((h + 11) % 12) + 1 + ':' + String(m).padStart(2, '0') + (h < 12 ? ' am' : ' pm') : p.wake;
  return (
    <div class="hh-lock" role="dialog" aria-label="Bedtime phone lock" onClick={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
      <FakePhone k={k} wake={p.wake} hour12={p.hour12} loop={false} sound onDone={() => setEnd(true)} />
      <div class="hh-lock-cap hh-wood-dark"><b>Bedtime lock</b>Busy apps sleep until {wake}. Calls and your alarm still work.</div>
      <button class={end ? 'hh-btn-night' : 'hh-btn-cream'} onClick={p.onDone}>{end ? 'Goodnight, phone' : 'Lock it now'}</button>
    </div>
  );
}
