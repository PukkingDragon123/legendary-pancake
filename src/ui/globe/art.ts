// Art for the globe screen [ui7]: waving cloth pin flags on brass-capped poles (two-frame sheets), the home oak,
// the selection ring, the passport (pebbled green leather cover with a gilt globe, guilloche pages), a brass
// padlock and a moon icon, drawn smooth at device resolution; the passport stamps, postage stamps, postmarks
// and deckled paper frames below.
// [globe] OWNED BY THE GLOBE BUILDER.
import type { Area } from '../../game/catalog.ts';
import { EMBLEM } from './emblems.ts';
import { bayer, hash, mix, mul, Pix, vnoise, type C } from './pix.ts';
import { texCanvas } from '../real/tex.ts';
import { fontAt, snapFont } from '../font.ts';

const INK = 0x2e2b24, PAPER = 0xf4eedd, OAT = 0xeae0c8, LINEN = 0xdccfb0, STRAW = 0xc9b78d, LAMP = 0xf1d39a, LAMPHI = 0xfbeac2;
const WOOD = 0x9c7a56, WOODDK = 0x6f553d, BRASS = 0xc8a764, BRASSDK = 0x8e7440, STONE = 0x908a7e, SLATE = 0x46596a;
export const hexC = (s: string): C => parseInt(s.replace('#', ''), 16);

const cache = new Map<string, string>();
const memo = (key: string, f: () => string) => { let v = cache.get(key); if (!v) { v = f(); cache.set(key, v); } return v; };

// ------------------------------------------------------------------ pins

export const PIN_W = 13, PIN_H = 17;
export type PinState = 'open' | 'locked' | 'tonight' | 'visited';

/** draw on a smooth canvas `w` x `h` units at `scale` device px per unit */
function smooth(w: number, h: number, scale: number, f: (g: CanvasRenderingContext2D) => void): string {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
  const g = c.getContext('2d')!;
  g.scale(scale, scale); g.lineCap = 'round'; g.lineJoin = 'round';
  f(g);
  return c.toDataURL('image/png');
}
const hx = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** A cloth flag on a brass-capped pole, two frames side by side (the flag ripples). Anchor: bottom centre (x = 3). */
export function pinSheet(color: string, state: PinState, scale: number): string {
  return memo(`pin7:${color}:${state}:${scale}`, () => smooth(PIN_W * 2, PIN_H, scale, (g) => {
    for (let f = 0; f < 2; f++) {
      g.save(); g.translate(f * PIN_W, 0);
      const base = state === 'locked' ? '#9a948a' : state === 'tonight' ? '#e8b850' : color;
      // a soft mound and contact shadow
      const sh = g.createRadialGradient(3.6, PIN_H - 1.4, 0, 3.6, PIN_H - 1.4, 3.4);
      sh.addColorStop(0, 'rgba(10,14,24,.55)'); sh.addColorStop(1, 'rgba(10,14,24,0)');
      g.fillStyle = sh; g.beginPath(); g.ellipse(3.6, PIN_H - 1.4, 3.4, 1.3, 0, 0, Math.PI * 2); g.fill();
      // the pole: turned walnut
      const pole = g.createLinearGradient(3, 0, 4.4, 0); pole.addColorStop(0, '#c08a5a'); pole.addColorStop(0.5, '#8a5a32'); pole.addColorStop(1, '#4a2c16');
      g.fillStyle = pole; g.beginPath(); g.roundRect(3, 1.4, 1.3, PIN_H - 2.6, 0.6); g.fill();
      // the cloth: a swallowtail that ripples
      const wob = f === 0 ? 0.7 : -0.5;
      g.beginPath(); g.moveTo(4.2, 2);
      g.bezierCurveTo(6.5, 2 + wob, 9.5, 2 - wob, 12.6, 2.4 + wob * 0.6);
      g.lineTo(11, 5.1); g.lineTo(12.6, 7.8 + wob * 0.6);
      g.bezierCurveTo(9.5, 7.4 - wob, 6.5, 7.4 + wob, 4.2, 7.4); g.closePath();
      const cl = g.createLinearGradient(4, 0, 12.6, 0);
      cl.addColorStop(0, base); cl.addColorStop(0.45, base); cl.addColorStop(0.5, f ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.18)'); cl.addColorStop(1, base);
      g.fillStyle = base; g.fill(); g.fillStyle = cl; g.fill();
      const lit = g.createLinearGradient(0, 2, 0, 7.8); lit.addColorStop(0, 'rgba(255,250,235,.35)'); lit.addColorStop(0.5, 'rgba(255,250,235,0)'); lit.addColorStop(1, 'rgba(0,0,0,.28)');
      g.fillStyle = lit; g.fill();
      g.strokeStyle = 'rgba(20,14,10,.45)'; g.lineWidth = 0.35; g.stroke();
      // the emblem
      const cx = 8, cy = 4.9 + (f === 0 ? 0.35 : -0.15);
      g.fillStyle = '#fffaf0'; g.strokeStyle = '#3a3226'; g.lineWidth = 0.5;
      if (state === 'locked') { g.fillStyle = '#4b463a'; g.beginPath(); g.roundRect(cx - 1.1, cy - 0.2, 2.2, 1.6, 0.3); g.fill(); g.beginPath(); g.arc(cx, cy - 0.3, 0.8, Math.PI, 0); g.stroke(); }
      else if (state === 'tonight') { g.fillStyle = '#2a3a66'; g.beginPath(); g.arc(cx, cy, 1.3, 0, Math.PI * 2); g.arc(cx + 0.6, cy - 0.3, 1.1, 0, Math.PI * 2, true); g.fill('evenodd'); }
      else if (state === 'visited') { g.strokeStyle = '#fffaf0'; g.lineWidth = 0.55; g.beginPath(); g.moveTo(cx - 1, cy); g.lineTo(cx - 0.2, cy + 0.8); g.lineTo(cx + 1.2, cy - 0.9); g.stroke(); }
      else { g.globalAlpha = 0.7; g.beginPath(); g.arc(cx, cy, 0.7, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
      // the brass knob
      const kn = g.createRadialGradient(3.3, 0.8, 0, 3.65, 1.2, 1.1); kn.addColorStop(0, '#fff4c0'); kn.addColorStop(0.5, '#d4a432'); kn.addColorStop(1, '#6e4a12');
      g.fillStyle = kn; g.beginPath(); g.arc(3.65, 1.2, 1.05, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }));
}

/** The selection marker under a pin: a glowing ring, two frames (small, big). */
export function ringSheet(scale: number, color = LAMP): string {
  return memo(`ring7:${scale}:${color}`, () => smooth(34, 7, scale, (g) => {
    for (let f = 0; f < 2; f++) {
      const rx = f ? 7.6 : 5.8, ry = f ? 2.8 : 2.1;
      g.save(); g.translate(f * 17 + 8.5, 3.5);
      g.shadowColor = hx(color); g.shadowBlur = 1.4 * scale;
      g.strokeStyle = hx(color); g.lineWidth = 0.8; g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }));
}

/** Home: a tiny hollow oak with a lit window. Anchor bottom centre. */
export function homeSprite(scale: number): string {
  return memo(`home7:${scale}`, () => smooth(13, 15, scale, (g) => {
    const tr = g.createLinearGradient(5, 0, 8, 0); tr.addColorStop(0, '#8a6a4a'); tr.addColorStop(1, '#3d2c1c');
    g.fillStyle = tr; g.beginPath(); g.moveTo(5, 8); g.lineTo(8, 8); g.lineTo(8.6, 13.4); g.lineTo(4.4, 13.4); g.closePath(); g.fill();
    for (const [x, y, r, c] of [[6.5, 4.6, 5.6, '#3f6a34'], [4.6, 3.6, 3.2, '#557a3c'], [8.4, 3.8, 3.2, '#4a7436'], [6.5, 2.6, 3, '#6a9a48']] as [number, number, number, string][]) {
      const lg = g.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r); lg.addColorStop(0, c); lg.addColorStop(1, '#22401e');
      g.fillStyle = lg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffd884'; g.beginPath(); g.arc(6.5, 10.4, 0.7, 0, Math.PI * 2); g.fill();
    const sh = g.createRadialGradient(6.5, 14, 0, 6.5, 14, 4); sh.addColorStop(0, 'rgba(10,14,24,.5)'); sh.addColorStop(1, 'rgba(10,14,24,0)');
    g.fillStyle = sh; g.beginPath(); g.ellipse(6.5, 14, 4, 1, 0, 0, Math.PI * 2); g.fill();
  }));
}

// ------------------------------------------------------------------ stamps

/** A passport stamp: ink in the place colour, one of four border shapes, the emblem and the stamp text. */
export function stampArt(a: Area, opts: { date?: number; state: 'visited' | 'open' | 'locked'; seed: number }, scale: number): string {
  return memo(`stamp:${a.id}:${opts.state}:${opts.date ?? 0}:${scale}`, () => {
    const W = 54, H = 38, p = new Pix(W, H); // [font6] wide enough for the name in the game's face
    const ink = opts.state === 'visited' ? mix(hexC(a.color), 0x4b463a, 0.32) : opts.state === 'open' ? 0xb2aa98 : 0xc8c0ae;
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
    const labels: { text: string; cx: number; base: number; c: number; maxW: number }[] = [{ text, cx: W / 2, base: 25.5, c: ink, maxW: W - 6 }];
    if (opts.state === 'visited' && opts.date) {
      const d = new Date(opts.date);
      const ds = shape === 1 ? `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}` : `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
      labels.push({ text: ds, cx: W / 2, base: 33.5, c: ink, maxW: W - 10 });
    }
    return p.urlText(scale, labels);
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

/** A round postmark with the stamp name and the date (today unless given), and wavy cancel lines. */
export function postmark(a: Area, scale: number, when?: number): string {
  const d = when ? new Date(when) : new Date(), key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
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

/** Aged paper, painted like BUSHED's paper: a base tone with slow mottling, short pale and dark fibres, a few
 * foxing specks, every channel stepped so it stays pixel art. Tileable (the mottling uses wrapped noise). */
export function agedPaper(scale: number, base = 0xebe2cc): string {
  return memo(`aged:${scale}:${base}`, () => {
    const N = 96, p = new Pix(N, N);
    const br = (base >> 16) & 255, bg = (base >> 8) & 255, bb = base & 255;
    const wrapN = (x: number, y: number, f: number, s: number) => {
      const u = x / N * f, v = y / N * f;
      const a = vnoise(u, v, s), b = vnoise(u - f, v, s), c = vnoise(u, v - f, s), d = vnoise(u - f, v - f, s);
      const fx = x / N, fy = y / N;
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const m = (wrapN(x, y, 3, 11) - 0.5) * 14 + (wrapN(x, y, 9, 12) - 0.5) * 7 + (hash(x, y, 13) - 0.5) * 4;
      const q = (v: number) => Math.round(Math.max(0, Math.min(255, v)) / 3) * 3;
      p.set(x, y, (q(br + m) << 16) | (q(bg + m * 1.05) << 8) | q(bb + m * 1.2));
    }
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash(i, 1, 14) * N), y = Math.floor(hash(i, 2, 14) * N), len = 2 + Math.floor(hash(i, 3, 14) * 4), dark = hash(i, 4, 14) < 0.45;
      const dx = hash(i, 5, 14) < 0.5 ? 1 : 0;
      for (let k = 0; k < len; k++) { const xx = (x + k) % N, yy = (y + k * dx) % N; p.set(xx, yy, mul(p.get(xx, yy), dark ? 0.93 : 1.04)); }
    }
    for (let i = 0; i < 6; i++) { const x = Math.floor(hash(i, 7, 15) * N), y = Math.floor(hash(i, 8, 15) * N); p.set(x, y, mix(p.get(x, y), 0x9c7a56, 0.5)); p.set(x + 1, y, mix(p.get(x + 1, y), 0x9c7a56, 0.25)); }
    return p.url(scale);
  });
}

/** Bookbinder's leather for the passport (48 x 48 border-image tile, 15px slice): pebbled moss-green grain,
 * a blind-tooled double rule, a cream running stitch, edges rubbed pale, a gilt dot in each corner. */
export function leatherFrame(scale: number): string {
  return memo(`leather:${scale}`, () => {
    const N = 48, p = new Pix(N, N);
    const L = [0x1c241e, 0x243026, 0x2c3a2e, 0x344536, 0x3d4f3e, 0x475a47, 0x526551, 0x5f715b];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const e = Math.min(x, y, N - 1 - x, N - 1 - y);
      if (e >= 15) { p.set(x, y, L[3]); continue; }
      const grain = (vnoise(x / 1.7, y / 1.7, 21) - 0.5) * 2.2 + (vnoise(x / 5, y / 5, 22) - 0.5) * 1.6;
      const wear = e < 3 ? (3 - e) * 0.9 : 0;
      let v = 3 + grain + wear + (bayer(x, y) - 0.5) * 0.8;
      if (e === 4) v = 0.6; if (e === 5) v = 5.5;          // tooled rule: groove and lit lip
      if (e === 10) v = 0.8; if (e === 11) v = 5.2;
      p.set(x, y, L[Math.max(0, Math.min(L.length - 1, Math.round(v)))]);
      if (e === 7 && ((x + y) % 4) < 2) p.set(x, y, 0xd8cdb0);                  // running stitch
      if (e === 0) p.set(x, y, 0x161c18);
    }
    for (const [cx, cy] of [[8, 8], [N - 9, 8], [8, N - 9], [N - 9, N - 9]]) { p.set(cx, cy, 0xe0c26a); p.set(cx + 1, cy, 0xb08934); p.set(cx, cy + 1, 0x8c6b28); }
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

/** Guilloche security pattern for passport pages (smooth, 32 units square). */
export function passportTile(scale: number): string {
  return memo(`guil7:${scale}`, () => smooth(32, 32, scale, (g) => {
    g.fillStyle = '#ece6d2'; g.fillRect(0, 0, 32, 32);
    g.strokeStyle = 'rgba(110,140,120,.22)'; g.lineWidth = 0.3;
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      for (let x = 0; x <= 32; x += 0.5) { const y = 16 + Math.sin((x / 32) * Math.PI * 4 + k * 1.05) * (6 + k); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
    }
  }));
}

/** The passport's pebbled green leather cover with a gilt globe stamped into it (60 x 80 units). */
export function passportCover(scale: number): string {
  return memo(`cover7:${scale}`, () => {
    const W = 60, H = 80, c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    const lt = texCanvas('pebble', '#2c5a3c');
    if (lt) { const pt = g.createPattern(lt, 'repeat')!; pt.setTransform(new DOMMatrix().scale(70 / lt.width)); g.fillStyle = pt; } else g.fillStyle = '#34493a';
    g.beginPath(); g.roundRect(0, 0, W, H, [1.5, 4, 4, 1.5]); g.fill();
    const sh = g.createLinearGradient(0, 0, W, H); sh.addColorStop(0, 'rgba(255,255,230,.12)'); sh.addColorStop(1, 'rgba(0,0,0,.3)');
    g.fillStyle = sh; g.fill();
    const gold = g.createLinearGradient(15, 22, 45, 50); gold.addColorStop(0, '#fff0a8'); gold.addColorStop(0.45, '#d8aa40'); gold.addColorStop(1, '#8a5e14');
    g.strokeStyle = gold; g.lineWidth = 0.6; g.setLineDash([1.4, 0.8]); g.strokeRect(3, 3, W - 6, H - 6); g.setLineDash([]);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 0.6 * scale; g.shadowOffsetY = 0.3 * scale;
    g.lineWidth = 1.1; g.beginPath(); g.arc(30, 36, 12.5, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 0.6;
    for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(30 - Math.sqrt(156 - (k * 7) ** 2), 36 + k * 7); g.lineTo(30 + Math.sqrt(156 - (k * 7) ** 2), 36 + k * 7); g.stroke(); }
    g.beginPath(); g.ellipse(30, 36, 6, 12.5, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(30, 23.5); g.lineTo(30, 48.5); g.stroke();
    // [text15] the gilt lettering in the game's face, set in device pixels, one flat gold
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#e2bc5c'; g.textAlign = 'left';
    const gilt = (t: string, want: number, base: number) => {
      let sz = snapFont(want * 0.9 * scale);
      g.font = fontAt(sz, { caps: true });
      while (sz > 7 && g.measureText(t).width > 50 * scale) { sz = snapFont(sz * 0.93); g.font = fontAt(sz, { caps: true }); }
      const w = g.measureText(t).width;
      if (w <= 54 * scale) g.fillText(t, 30 * scale - w / 2, base * scale);
    };
    gilt('PASSPORT', 8.5, 63); gilt('HOOT HOLLOW', 6, 70.5);
    g.restore();
    return c.toDataURL('image/png');
  });
}

/** A little brass padlock (11 x 12 units). */
export function padlock(scale: number): string {
  return memo(`lock7:${scale}`, () => smooth(11, 12, scale, (g) => {
    g.strokeStyle = '#a8a298'; g.lineWidth = 1.3; g.beginPath(); g.arc(5.5, 5, 2.8, Math.PI, 0); g.stroke();
    const b = g.createLinearGradient(0, 5, 0, 11.5); b.addColorStop(0, '#f6d98a'); b.addColorStop(0.4, '#c8962e'); b.addColorStop(1, '#6e4a12');
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 0.8 * scale; g.shadowOffsetY = 0.4 * scale;
    g.fillStyle = b; g.beginPath(); g.roundRect(1.3, 5, 8.4, 6.6, 1.3); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#2a1c0c'; g.beginPath(); g.arc(5.5, 7.6, 0.9, 0, Math.PI * 2); g.fill(); g.fillRect(5.1, 7.8, 0.8, 2);
  }));
}

/** [ui10] A little beeswax candle with its flame (9 x 9 units) for nights counts (no moon emblems). */
export function moonIcon(scale: number, on = true): string {
  return memo(`candle10:${scale}:${on}`, () => smooth(9, 9, scale, (g) => {
    const w = g.createLinearGradient(3, 0, 6.2, 0); w.addColorStop(0, on ? '#fff2cc' : '#d8d2c4'); w.addColorStop(1, on ? '#d8b070' : '#8a8478');
    g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 0.5 * scale; g.shadowOffsetY = 0.3 * scale;
    g.fillStyle = on ? '#b8862e' : '#7a746a'; g.fillRect(1.4, 7.6, 6.2, 1.1);
    g.fillStyle = w; g.fillRect(3, 3.6, 3, 4.2);
    g.shadowColor = 'transparent';
    g.strokeStyle = '#2a1a10'; g.lineWidth = 0.35; g.strokeRect(3, 3.6, 3, 4.2);
    if (on) {
      const f = g.createRadialGradient(4.5, 2, 0, 4.5, 2, 2.6); f.addColorStop(0, 'rgba(255,240,180,.95)'); f.addColorStop(0.45, 'rgba(255,190,80,.8)'); f.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = f; g.beginPath(); g.arc(4.5, 2, 2.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff4c8'; g.beginPath(); g.moveTo(4.5, 0.3); g.bezierCurveTo(5.6, 1.6, 5.3, 3, 4.5, 3.1); g.bezierCurveTo(3.7, 3, 3.4, 1.6, 4.5, 0.3); g.fill();
    }
  }));
}

export { SLATE as SLATE_C };
