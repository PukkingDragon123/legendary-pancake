// Pixel art for the globe screen: waving pin flags (two-frame sprite sheets), the home oak, the selection
// ring, passport stamps, the postage stamp and postmark on each postcard, deckled paper frames.
// [globe] OWNED BY THE GLOBE BUILDER.
import type { Area } from '../../game/catalog.ts';
import { EMBLEM } from './emblems.ts';
import { bayer, hash, mix, mul, Pix, type C } from './pix.ts';

const INK = 0x2e2b24, PAPER = 0xf4eedd, OAT = 0xeae0c8, LINEN = 0xdccfb0, STRAW = 0xc9b78d, LAMP = 0xf1d39a, LAMPHI = 0xfbeac2;
const WOOD = 0x9c7a56, WOODDK = 0x6f553d, BRASS = 0xc8a764, BRASSDK = 0x8e7440, STONE = 0x908a7e, SLATE = 0x46596a;
export const hexC = (s: string): C => parseInt(s.replace('#', ''), 16);

const cache = new Map<string, string>();
const memo = (key: string, f: () => string) => { let v = cache.get(key); if (!v) { v = f(); cache.set(key, v); } return v; };

// ------------------------------------------------------------------ pins

export const PIN_W = 13, PIN_H = 17;
export type PinState = 'open' | 'locked' | 'tonight' | 'visited';

/** A flag on a pole, two frames side by side (the flag ripples). Anchor: bottom centre (x = 3). */
export function pinSheet(color: string, state: PinState, scale: number): string {
  return memo(`pin:${color}:${state}:${scale}`, () => {
    const p = new Pix(PIN_W * 2, PIN_H);
    for (let f = 0; f < 2; f++) {
      const ox = f * PIN_W;
      const base = state === 'locked' ? 0x9a948a : state === 'tonight' ? 0xe8c070 : hexC(color);
      const lit = mix(base, 0xfff4dc, 0.35), dk = mul(base, 0.68);
      // pole with a brass knob and a lit edge
      p.vline(ox + 3, 2, PIN_H - 3, WOODDK); p.vline(ox + 4, 3, PIN_H - 3, WOOD);
      p.rect(ox + 3, 0, 2, 2, BRASS); p.set(ox + 3, 0, LAMPHI); p.set(ox + 4, 1, BRASSDK);
      // the flag: 8 x 6, swallowtail, rippling
      for (let x = 0; x < 8; x++) {
        const wob = f === 0 ? (x >= 3 && x <= 5 ? 1 : 0) : (x >= 5 ? 1 : x <= 1 ? 0 : 0);
        const top = 2 + wob, bot = 7 + wob - (x === 7 ? 1 : 0);
        for (let y = top; y <= bot; y++) {
          if (x === 7 && y === Math.round((top + bot) / 2)) continue; // the notch
          let c = y === top ? lit : y === bot ? dk : base;
          if (x === 6 && f === 1) c = dk;
          p.set(ox + 5 + x, y, c);
        }
        p.set(ox + 5 + x, top - 1, INK); p.set(ox + 5 + x, bot + 1, INK);
      }
      p.vline(ox + 13 - 0, 2, 8, -1 as unknown as C);
      // emblem on the flag
      const cx = ox + 8, cy = 4 + (f === 0 ? 1 : 0);
      if (state === 'locked') { p.rect(cx, cy + 1, 3, 2, 0x4b463a); p.set(cx, cy, 0x4b463a); p.set(cx + 2, cy, 0x4b463a); p.set(cx + 1, cy - 1, 0x4b463a); p.set(cx + 1, cy + 1, 0xc9b78d); }
      else if (state === 'tonight') { p.set(cx, cy, 0x46596a); p.set(cx + 1, cy - 1, 0x46596a); p.set(cx + 1, cy + 1, 0x46596a); p.set(cx + 2, cy - 1, 0x46596a); p.set(cx + 2, cy + 1, 0x46596a); }
      else if (state === 'visited') { p.set(cx + 1, cy - 1, PAPER); p.hline(cx, cx + 2, cy, PAPER); p.set(cx + 1, cy + 1, PAPER); }
      else { p.set(cx + 1, cy, mix(base, PAPER, 0.6)); }
      // foot: a little stepped mound
      p.hline(ox + 1, ox + 6, PIN_H - 2, mul(STONE, 0.8)); p.hline(ox + 2, ox + 5, PIN_H - 3, STONE); p.hline(ox + 2, ox + 5, PIN_H - 1, 0x2a3040);
    }
    return p.url(scale);
  });
}

/** The selection marker under a pin: a stepped ring, two frames (small, big). */
export function ringSheet(scale: number, color = LAMP): string {
  return memo(`ring:${scale}:${color}`, () => {
    const W = 17, H = 7, p = new Pix(W * 2, H);
    for (let f = 0; f < 2; f++) {
      const rx = f ? 8 : 6, ry = f ? 3 : 2;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const d = ((x - 8) / rx) ** 2 + ((y - 3) / ry) ** 2;
        if (d <= 1.15 && d >= 0.45) p.set(f * W + x, y, d > 0.8 ? color : mix(color, 0xffffff, 0.4));
      }
    }
    return p.url(scale);
  });
}

/** Home: a tiny hollow oak with a lit window. Anchor bottom centre. */
export function homeSprite(scale: number): string {
  return memo(`home:${scale}`, () => {
    const p = new Pix(13, 15);
    const L = [0x3f5a3b, 0x557343, 0x66844f, 0x86a06a];
    for (let y = 0; y < 9; y++) for (let x = 0; x < 13; x++) {
      const d = ((x - 6) / 6.2) ** 2 + ((y - 4.5) / 4.6) ** 2;
      if (d < 1) p.set(x, y, L[Math.min(3, Math.max(0, Math.round(2.6 - d * 2 - (y - 4) * 0.25 + (bayer(x, y) - 0.5))))]);
    }
    p.rect(5, 8, 3, 5, 0x5b4a3c); p.vline(7, 8, 12, 0x3d3229); p.set(6, 10, LAMP); p.set(6, 9, LAMPHI);
    p.hline(3, 9, 13, 0x3d3229); p.hline(2, 10, 14, 0x2a3040);
    p.outline(0x1f2733);
    return p.url(scale);
  });
}

// ------------------------------------------------------------------ stamps

/** A passport stamp: ink in the place colour, one of four border shapes, the emblem and the stamp text. */
export function stampArt(a: Area, opts: { date?: number; state: 'visited' | 'open' | 'locked'; seed: number }, scale: number): string {
  return memo(`stamp:${a.id}:${opts.state}:${opts.date ?? 0}:${scale}`, () => {
    const W = 46, H = 38, p = new Pix(W, H);
    const ink = opts.state === 'visited' ? hexC(a.color) : opts.state === 'open' ? 0xb2aa98 : 0xc8c0ae;
    const faint = opts.state !== 'visited';
    const dot = (x: number, y: number) => { if (!faint || (x + y) % 2 === 0) { if (!faint && hash(x, y, opts.seed) < 0.07) return; p.set(x, y, ink); } };
    const shape = hash(opts.seed, 3) * 4 | 0;
    // border
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let on = false, on2 = false;
      if (shape === 0) { on = x === 1 || x === W - 2 || y === 1 || y === H - 2; on2 = !faint && (x === 3 || x === W - 4 || y === 3 || y === H - 4) && x >= 3 && x <= W - 4 && y >= 3 && y <= H - 4; }
      else if (shape === 1) { const d = Math.sqrt(((x - W / 2 + 0.5) / (W / 2 - 1.5)) ** 2 + ((y - H / 2 + 0.5) / (H / 2 - 1.5)) ** 2); on = Math.abs(d - 1) < 0.045; on2 = !faint && Math.abs(d - 0.88) < 0.04; }
      else if (shape === 2) { const ax = Math.abs(x - W / 2 + 0.5), ay = Math.abs(y - H / 2 + 0.5); const d = Math.max(ax / (W / 2 - 1.5), ay / (H / 2 - 1.5), (ax + ay) / (W / 2 + H / 2 - 9)); on = Math.abs(d - 1) < 0.03; }
      else { const wav = Math.round(Math.sin(x * 0.9) * 0.6); on = ((y === 1 + wav || y === H - 2 + wav) && x > 0 && x < W - 1) || ((x === 1 || x === W - 2) && y > 1 && y < H - 2); on2 = !faint && (y === 4 || y === H - 5) && x > 4 && x < W - 5; }
      if (on || on2) dot(x, y);
    }
    // emblem
    const em = EMBLEM[a.id] ?? EMBLEM.highlands;
    const ex = Math.round(W / 2 - 6.5), ey = 6;
    em.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') dot(ex + i, ey + j); }));
    // text (shrink long names to fit)
    const text = a.stamp.length > 10 ? a.stamp.replace(/ /g, '') : a.stamp;
    const tw = Pix.textWidth(text, text.length > 9 ? 0 : 1);
    const tmp = new Pix(tw, 5);
    tmp.text(0, 0, text, ink, text.length > 9 ? 0 : 1);
    for (let y = 0; y < 5; y++) for (let x = 0; x < tw; x++) if (tmp.get(x, y) !== -1) dot(Math.round(W / 2 - tw / 2) + x, 20 + y);
    if (opts.state === 'visited' && opts.date) {
      const d = new Date(opts.date);
      const ds = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
      const w = Pix.textWidth(ds, 1);
      const t2 = new Pix(w, 5); t2.text(0, 0, ds, ink, 1);
      for (let y = 0; y < 5; y++) for (let x = 0; x < w; x++) if (t2.get(x, y) !== -1) dot(Math.round(W / 2 - w / 2) + x, 28 + y);
    }
    return p.url(scale);
  });
}

/** A perforated postage stamp with the place's emblem on a tinted ground. */
export function postageStamp(a: Area, scale: number): string {
  return memo(`post:${a.id}:${scale}`, () => {
    const W = 24, H = 28, p = new Pix(W, H);
    const c = hexC(a.color), bg = mix(c, PAPER, 0.72);
    p.rect(0, 0, W, H, PAPER);
    for (let x = 0; x < W; x += 2) { p.clear(x, 0); p.clear(x, H - 1); }
    for (let y = 0; y < H; y += 2) { p.clear(0, y); p.clear(W - 1, y); }
    p.rect(3, 3, W - 6, H - 9, bg);
    for (let y = 3; y < H - 6; y++) for (let x = 3; x < W - 3; x++) if (bayer(x, y) < 0.18) p.set(x, y, mix(bg, c, 0.35));
    const em = EMBLEM[a.id] ?? EMBLEM.highlands;
    em.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') p.set(5 + i, 6 + j, c); }));
    p.text(4, H - 6, String(a.level * 5 + 10), mul(c, 0.8));
    p.hline(3, W - 4, H - 7, mul(c, 0.8));
    return p.url(scale);
  });
}

/** A round postmark with the stamp name and today's date, and wavy cancel lines. */
export function postmark(a: Area, scale: number): string {
  const d = new Date(), key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  return memo(`mark:${a.id}:${key}:${scale}`, () => {
    const W = 56, H = 30, p = new Pix(W, H), ink = 0x5a5a6e;
    p.ring(15, 15, 13, ink); p.ring(15, 15, 11, ink);
    const t = a.stamp.split(' ')[0].slice(0, 6);
    p.text(Math.round(15 - Pix.textWidth(t) / 2), 8, t, ink);
    const ds = `${d.getDate()}.${d.getMonth() + 1}`;
    p.text(Math.round(15 - Pix.textWidth(ds) / 2), 16, ds, ink);
    for (let k = 0; k < 4; k++) for (let x = 31; x < W; x++) p.set(x, Math.round(7 + k * 5 + Math.sin(x * 0.45) * 1.5), ink);
    for (let i = 0; i < p.data.length; i++) if (p.data[i] !== -1 && hash(i, 5) < 0.12) p.data[i] = -1;
    return p.url(scale);
  });
}

// ------------------------------------------------------------------ frames and paper

/** A border-image tile for deckled postcard paper (16 x 16, 5px slice). */
export function paperFrame(scale: number, edge = LINEN): string {
  return memo(`paper:${scale}:${edge}`, () => {
    const N = 16, p = new Pix(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const e = Math.min(x, y, N - 1 - x, N - 1 - y);
      if (e === 0) { if (hash(x, y, 1) < 0.5) continue; p.set(x, y, edge); continue; }
      if (e === 1) { p.set(x, y, hash(x, y, 2) < 0.3 ? edge : OAT); continue; }
      p.set(x, y, hash(x, y, 3) < 0.08 ? LINEN : hash(x, y, 4) < 0.05 ? 0xf8f4e8 : PAPER);
    }
    return p.url(scale);
  });
}

/** A border-image tile for a hand-inked paper label (24 x 24, 7px slice): linen paper, an uneven ink line that
 * wobbles and doubles back like a pen stroke, a darker hard shadow along the bottom. */
export function inkFrame(scale: number): string {
  return memo(`inkf:${scale}`, () => {
    const N = 24, p = new Pix(N, N), ink = 0x3d3229, ink2 = 0x5b4a3c;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const e = Math.min(x, y, N - 1 - x, N - 1 - y);
      if (e < 1 && hash(x, y, 31) < 0.35) continue;
      const h = hash(x, y, 32);
      p.set(x, y, e <= 1 ? (h < 0.25 ? ink2 : ink) : e === 2 && h < 0.18 ? ink2 : h < 0.06 ? LINEN : h > 0.97 ? 0xe2d6bc : OAT);
      if (y === N - 2 && e === 1) p.set(x, y, 0x2a221c);
      if (e === 3 && ((x + y * 3) % 7 === 0) && x > 2 && y > 2 && x < N - 3 && y < N - 3) p.set(x, y, mix(OAT, ink, 0.25));
    }
    return p.url(scale);
  });
}

/** A small paper-fibre tile for large paper areas. */
export function paperTile(scale: number, base = PAPER): string {
  return memo(`ptile:${scale}:${base}`, () => {
    const N = 24, p = new Pix(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const h = hash(x, y, 9);
      p.set(x, y, h < 0.05 ? mix(base, LINEN, 0.8) : h < 0.08 ? mix(base, 0xffffff, 0.5) : h > 0.985 ? mix(base, STRAW, 0.6) : base);
    }
    for (let i = 0; i < 5; i++) { const x = Math.floor(hash(i, 1, 7) * N), y = Math.floor(hash(i, 2, 7) * N); p.hline(x, x + 2, y, mix(base, LINEN, 0.6)); }
    return p.url(scale);
  });
}

/** Guilloché security pattern for passport pages. */
export function passportTile(scale: number): string {
  return memo(`guil:${scale}`, () => {
    const N = 32, p = new Pix(N, N), base = 0xe9e3cf;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const a = Math.sin((x / N) * Math.PI * 4 + Math.sin((y / N) * Math.PI * 2) * 2), b = Math.sin((y / N) * Math.PI * 4 + Math.sin((x / N) * Math.PI * 2) * 2);
      p.set(x, y, Math.abs(a - b) < 0.1 ? 0xdfd8c2 : Math.abs(a + b) < 0.08 ? 0xe3dccb : base);
    }
    return p.url(scale);
  });
}

/** The passport's leather cover with a gold globe stamped into it. */
export function passportCover(scale: number): string {
  return memo(`cover:${scale}`, () => {
    const W = 60, H = 80, p = new Pix(W, H), L = 0x34493a, Ld = 0x2a3c30, G = BRASS, Gd = BRASSDK;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) p.set(x, y, hash(x, y, 4) < 0.12 ? Ld : hash(x, y, 5) < 0.05 ? 0x3e5644 : L);
    p.hline(0, W - 1, 0, Ld); p.hline(0, W - 1, H - 1, 0x1f2c24); p.vline(W - 1, 0, H - 1, 0x1f2c24); p.vline(0, 0, H - 1, 0x40584a);
    for (let x = 3; x < W - 3; x++) { if (x % 2) { p.set(x, 3, Gd); p.set(x, H - 4, Gd); } }
    p.ring(30, 36, 13, G); p.ring(30, 36, 12, Gd);
    for (let k = -1; k <= 1; k++) { p.hline(18, 42, 36 + k * 7, k === 0 ? G : Gd); }
    for (let y = 24; y <= 48; y++) { const t = (y - 36) / 12, w = Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * 6); p.set(30 - w, y, Gd); p.set(30 + w, y, Gd); p.set(30, y, G); }
    const t1 = 'PASSPORT', w1 = Pix.textWidth(t1);
    p.text(Math.round(30 - w1 / 2), 58, t1, G);
    const t2 = 'HOOT HOLLOW', w2 = Pix.textWidth(t2, 0);
    p.text(Math.round(30 - w2 / 2), 66, t2, Gd, 0);
    return p.url(scale);
  });
}

/** A little padlock (11 x 12) in stone and brass. */
export function padlock(scale: number): string {
  return memo(`lock:${scale}`, () => {
    const p = new Pix(11, 12);
    p.ring(5, 4, 3, 0x8a8478); p.rect(2, 4, 7, 1, -1 as unknown as C);
    p.rect(1, 5, 9, 7, BRASS); p.hline(1, 9, 5, 0xe0c88a); p.hline(1, 9, 11, BRASSDK); p.vline(9, 5, 11, BRASSDK);
    p.rect(5, 7, 1, 3, INK); p.set(5, 7, 0x4b463a);
    p.outline(0x2a2620);
    return p.url(scale);
  });
}

/** A crescent moon icon (9 x 9) for nights counts. */
export function moonIcon(scale: number, on = true): string {
  return memo(`moon:${scale}:${on}`, () => {
    const p = new Pix(9, 9);
    p.disc(4, 4, 3.6, on ? LAMP : 0xb9b2a4); p.disc(6, 3, 3, -1 as unknown as C);
    if (on) { p.set(2, 3, LAMPHI); p.set(2, 4, LAMPHI); }
    p.outline(on ? 0x8a6236 : 0x8a8478);
    return p.url(scale);
  });
}

export { SLATE as SLATE_C };
