// Anime emote marks: bold, hand-drawn pixel-art marks that pop beside a character's head and follow it in 3D (the head
// is projected through the camera that draws it every frame): a sweat drop, an anger vein, "!" and "?" with motion
// lines, music notes, sparkles, hearts, a "Zzz" bubble, a light bulb, a gloom cloud with vertical lines and steam
// puffs. They live on one transparent canvas between the 3D view and the interface, so the HUD and panels always sit
// on top of them, and they step aside from a speech bubble. Snappy pops and bounces; with Calm motion they simply
// appear and fade.
//   popEmote('bang', anchor)          anchor: anything with screen() -> { x, y, r } (CSS px) or null when hidden
//   actorAnchor(obj, faceCentre, r)   an anchor for an object in a 3D scene (finds the camera that draws it)
import * as THREE from 'three';
import { blit, calmMotion, col, fxNow, Raster, rng, sprite, texLine } from './pixart.ts';

export type EmoteKind = 'sweat' | 'anger' | 'bang' | 'ask' | 'notes' | 'sparkle' | 'hearts' | 'zzz' | 'bulb' | 'gloom' | 'steam';
export const EMOTES: EmoteKind[] = ['bang', 'ask', 'sweat', 'anger', 'notes', 'sparkle', 'hearts', 'zzz', 'bulb', 'gloom', 'steam'];

export interface EmoteAnchor {
  /** where the face is on screen (CSS px) and its radius in CSS px; null while it isn't drawn */
  screen(): { x: number; y: number; r: number } | null;
}

const INK = '#2a1820';
const SHADOW = '#1a0a1260';
const DUR: Record<EmoteKind, number> = { bang: 1.05, ask: 1.4, sweat: 1.5, anger: 1.25, notes: 1.7, sparkle: 1.25, hearts: 1.6, zzz: 2.4, bulb: 1.4, gloom: 1.9, steam: 1.0 };

// ------------------------------------------------------------------ the art (built once, on first use)

interface Art {
  bang: HTMLCanvasElement; ask: HTMLCanvasElement; sweat: HTMLCanvasElement; heart: HTMLCanvasElement; heartS: HTMLCanvasElement;
  notes: HTMLCanvasElement[]; anger: HTMLCanvasElement; bulb: HTMLCanvasElement; bulbOff: HTMLCanvasElement;
  bubble: HTMLCanvasElement; zBig: HTMLCanvasElement; zSmall: HTMLCanvasElement; cloud: HTMLCanvasElement;
  puff: HTMLCanvasElement[]; spark: HTMLCanvasElement[][];
}
let ART: Art | null = null;

function makeArt(): Art {
  const o = { ink: INK, shadow: SHADOW };
  const bang = sprite([
    '..YYYY..',
    '.WWYYYYo',
    '.WYYYYYo',
    '.WYYYYYo',
    '.WYYYYo.',
    '..WYYYo.',
    '..WYYYo.',
    '..YYYo..',
    '..YYYo..',
    '...YYo..',
    '...Yo...',
    '........',
    '...WY...',
    '..WYYo..',
    '..YYoo..',
    '...oo...',
  ], { Y: '#ffd23f', W: '#fff7c8', o: '#ef8a1a' }, o);
  const ask = sprite([
    '...WBBBB...',
    '..WBBBBBBo.',
    '.WBBBooBBBo',
    '.WBBo..oBBo',
    '..oo...WBBo',
    '......WBBo.',
    '.....WBBo..',
    '....WBBo...',
    '....BBo....',
    '....BBo....',
    '.....o.....',
    '...........',
    '....WB.....',
    '...WBBo....',
    '...BBoo....',
    '....oo.....',
  ], { B: '#7fd4ff', W: '#e9f9ff', o: '#3a8cd6' }, o);
  const sweat = sprite([
    '....L....',
    '....LM...',
    '...LLM...',
    '...LLMM..',
    '..LLLMM..',
    '..LWLLMM.',
    '.LWWLLLM.',
    '.LWLLLLMD',
    '.LWLLLLMD',
    '.LLLLLMMD',
    '..LLLMMD.',
    '...MMDD..',
  ], { L: '#c4ecff', M: '#73c2f3', D: '#3a84cc', W: '#ffffff' }, o);
  const heartRows = [
    '.PPR...RRR.',
    'PWPRR.RRRRR',
    'PPRRRRRRRSR',
    'RRRRRRRRRSR',
    'RRRRRRRRSSR',
    '.RRRRRRSSR.',
    '..RRRRSSR..',
    '...RRSSR...',
    '....RSR....',
    '.....R.....',
  ];
  const heart = sprite(heartRows, { R: '#ff5b8a', S: '#c42a5e', P: '#ffb3ca', W: '#ffffff' }, o);
  const heartS = sprite([
    '.PR.RR.',
    'PWRRRSR',
    'RRRRRSR',
    '.RRRSR.',
    '..RSR..',
    '...R...',
  ], { R: '#ff7aa0', S: '#c43c6c', P: '#ffc4d6', W: '#ffffff' }, o);
  const noteRows = [
    '....CC....',
    '....CCC...',
    '....CSCC..',
    '....CS.CC.',
    '....CS..C.',
    '....CS.C..',
    '....CS....',
    '....CS....',
    '.HCCCS....',
    'HHCCCS....',
    'CCCCSS....',
    '.CSSS.....',
  ];
  const beamRows = [
    '...CCCCCCC',
    '...CCCCCCS',
    '...CS...CS',
    '...CS...CS',
    '...CS...CS',
    '...CS...CS',
    '.HCCS.HCCS',
    'HHCCSHHCCS',
    'CCCSSCCCSS',
    '.CSS..CSS.',
  ];
  const notes = [
    sprite(noteRows, { C: '#3cc8b4', S: '#1f8a86', H: '#c6fff2' }, o),
    sprite(beamRows, { C: '#ffb43a', S: '#d0702a', H: '#fff0bf' }, o),
    sprite(noteRows, { C: '#ff7aa8', S: '#c0467a', H: '#ffe0ec' }, o),
    sprite(beamRows, { C: '#9f8cff', S: '#6450c8', H: '#ece6ff' }, o),
  ];
  // the anger vein: four fat curved pieces bowed in toward a cross-shaped gap, the classic popping mark
  const anger = (() => {
    const N = 15, r = new Raster(N + 4, N + 4), c = 2 + N / 2;
    const R = col('#ff4a3d'), D = col('#b8202c'), H = col('#ffc6bc');
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      // each piece bows in toward the middle and stops short of its neighbours, its tips flicking outward
      const ccx = c + sx * 7.4, ccy = c + sy * 7.4, a0 = Math.atan2(-sy, -sx);
      const arc = Raster.arc(ccx, ccy, 5.6, 5.6, a0 - 0.5, a0 + 0.5, 10);
      r.stroke(arc, 3.2, R, 0.3);
    }
    // a darker underside and a pale highlight on each piece (light from the top left)
    const src = r.buf.slice();
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (!src[y * r.w + x]) continue;
      const below = y + 1 < r.h && !src[(y + 1) * r.w + x], right = x + 1 < r.w && !src[y * r.w + x + 1];
      const above = y > 0 && !src[(y - 1) * r.w + x], left = x > 0 && !src[y * r.w + x - 1];
      if (below || right) r.set(x, y, D);
      else if (above && left) r.set(x, y, H);
    }
    r.outline(col(INK));
    r.shadow(col(SHADOW), 1, 1);
    return r.canvas();
  })();
  const bulbRows = [
    '...WWYYY...',
    '..WYYYYYYO.',
    '.WWYYYYYYOO',
    '.WYYYYYYYOO',
    '.WYYYYYYYOO',
    '.YYYYYYYYOO',
    '..YYYYYYOO.',
    '..YYYYYYOO.',
    '...YYYYOO..',
    '...GGGGgg..',
    '...ggggdd..',
    '...GGGGgg..',
    '....dddd...',
  ];
  const bulb = sprite(bulbRows, { Y: '#ffe75a', W: '#fffbe2', O: '#f2a531', G: '#dfe1ea', g: '#9296aa', d: '#5d6074' }, o);
  const bulbOff = sprite(bulbRows, { Y: '#f1e7b0', W: '#fffdf0', O: '#d8c27a', G: '#dfe1ea', g: '#9296aa', d: '#5d6074' }, o);
  // the thought bubble: a lumpy cloud and two little puffs trailing back to the head
  const bubble = (() => {
    const r = new Raster(30, 24);
    const W = col('#fdfaff'), L = col('#d9d3f4');
    r.blob(15, 10, 11, 7.4, W, 0.12, 4);
    r.blob(8.5, 9, 6, 5.2, W, 0.08, 9);
    r.blob(21.5, 8.5, 6.2, 5.4, W, 0.08, 12);
    r.blob(14.5, 5.5, 6.5, 4.2, W, 0.08, 15);
    // a lilac shade along the bottom of the cloud
    const src = r.buf.slice();
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (src[y * r.w + x] && !src[Math.min(r.h - 1, y + 2) * r.w + x]) r.set(x, y, L);
    r.blob(5, 19, 2.6, 2.2, W, 0.05, 3);
    r.blob(2.2, 22, 1.5, 1.3, W, 0, 5);
    r.outline(col(INK));
    r.shadow(col(SHADOW), 1, 1);
    return r.canvas();
  })();
  const zBig = sprite(['ZZZZZZ', '....ZZ', '...ZZ.', '..ZZ..', '.ZZ...', 'ZZZZZZ'], { Z: '#4b47a8' });
  const zSmall = sprite(['zzzz', '..z.', '.z..', 'zzzz'], { z: '#6a64c4' });
  const cloud = (() => {
    const r = new Raster(32, 16);
    const B = col('#696e8f'), T = col('#9095b6'), S = col('#474b68');
    r.blob(16, 9, 12, 4.6, B, 0.1, 21);
    r.blob(10, 6.5, 6, 4.6, B, 0.1, 22);
    r.blob(19, 5.2, 7, 4.6, B, 0.1, 23);
    r.blob(25, 8, 4.6, 3.8, B, 0.08, 24);
    const src = r.buf.slice();
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      if (!src[y * r.w + x]) continue;
      if (!src[(y - 1) * r.w + x] || !src[(y - 2) * r.w + x]) { if (!src[(y - 1) * r.w + x - 1] || (x + y) % 3 === 0) r.set(x, y, T); }
      else if (y + 2 >= r.h || !src[(y + 2) * r.w + x]) r.set(x, y, S);
    }
    r.outline(col('#24202f'));
    r.shadow(col(SHADOW), 1, 1);
    return r.canvas();
  })();
  // steam: a puff that swells (three frames), then breaks into wisps (the fourth)
  const puff = [2.4, 3.4, 4.4, 4.4].map((rad, i) => {
    const n = Math.ceil(rad * 2 + 8), r = new Raster(n, n), c = n / 2, Wt = col('#ffffff');
    if (i < 3) {
      r.blob(c + 0.5, c, rad, rad * 0.82, Wt, 0.14, 30 + i);
      r.blob(c - rad * 0.5, c + rad * 0.25, rad * 0.62, rad * 0.52, Wt, 0.1, 40 + i);
      if (i > 0) r.blob(c + rad * 0.45, c - rad * 0.35, rad * 0.55, rad * 0.45, Wt, 0.1, 50 + i);
    } else {
      r.blob(c - 2.6, c + 1, 1.8, 1.5, Wt, 0.1, 61);
      r.blob(c + 2.2, c - 1.8, 2.2, 1.7, Wt, 0.1, 62);
      r.blob(c + 0.5, c + 2.6, 1.2, 1.1, Wt, 0.1, 63);
    }
    const src = r.buf.slice();
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (src[y * n + x] && (y + 1 >= n || !src[(y + 1) * n + x] || (x + 1 < n && !src[y * n + x + 1]))) r.set(x, y, col('#d5d9e8'));
    r.outline(col('#6c7088'));
    return r.canvas();
  });
  // sparkles: a twinkle in four frames (a dot, a plus, a long four-point star, a smaller star) in three tints
  const spark = ['#ffc94a', '#ff8fc8', '#7fd8ff'].map((edge) => [1, 2, 4, 3].map((arm) => {
    const n = arm * 2 + 5, r = new Raster(n, n), c = (n - 1) / 2;
    const W = col('#ffffff'), Y = col(edge === '#ffc94a' ? '#fff3b0' : edge === '#ff8fc8' ? '#ffe0f0' : '#e0f6ff');
    for (let i = -arm; i <= arm; i++) { r.set(c + i, c, Math.abs(i) <= arm / 2 ? W : Y); r.set(c, c + i, Math.abs(i) <= arm / 2 ? W : Y); }
    if (arm >= 3) { r.set(c - 1, c - 1, Y); r.set(c + 1, c - 1, Y); r.set(c - 1, c + 1, Y); r.set(c + 1, c + 1, Y); r.set(c, c, W); }
    if (arm >= 4) { r.set(c - 1, c, W); r.set(c + 1, c, W); r.set(c, c - 1, W); r.set(c, c + 1, W); }
    r.outline(col(edge));
    return r.canvas();
  }));
  return { bang, ask, sweat, heart, heartS, notes, anger, bulb, bulbOff, bubble, zBig, zSmall, cloud, puff, spark };
}

/** The emote art (for dev sheets). */
export function emoteArt(): Art { return (ART ??= makeArt()); }

// ------------------------------------------------------------------ the layer

interface Live { kind: EmoteKind; anchor: EmoteAnchor; t0: number; dur: number; side: number; seed: number; calm: boolean }
const live: Live[] = [];
let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null, raf = 0;

function ensure() {
  if (cv || typeof document === 'undefined') return;
  cv = document.createElement('canvas');
  cv.className = 'hh-emotes';
  cv.setAttribute('aria-hidden', 'true');
  // between the 3D view (#world) and the interface (#ui, z-index 2): the HUD and panels always cover a mark
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '1', pointerEvents: 'none', imageRendering: 'pixelated' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
}

/** Pop an emote mark beside an anchor's head. A new mark on the same anchor replaces one of the same kind. */
export function popEmote(kind: EmoteKind, anchor: EmoteAnchor, o: { side?: number; delay?: number } = {}) {
  if (typeof document === 'undefined') return;
  ensure();
  ART ??= makeArt();
  for (const l of live) if (l.anchor === anchor && (l.kind === kind || overlaps(l.kind, kind))) l.dur = Math.min(l.dur, fxNow() - l.t0 + 0.12);
  live.push({ kind, anchor, t0: fxNow() + (o.delay ?? 0), dur: DUR[kind] * (calmMotion() ? 1.2 : 1), side: o.side ?? 0, seed: Math.floor(Math.random() * 1e6), calm: calmMotion() });
  if (!raf) raf = requestAnimationFrame(frame);
}
/** marks that sit in the same spot replace each other */
const SLOT: Partial<Record<EmoteKind, number>> = { bang: 1, ask: 1, bulb: 2, gloom: 2, zzz: 3, sweat: 4, anger: 4 };
const overlaps = (a: EmoteKind, b: EmoteKind) => !!SLOT[a] && SLOT[a] === SLOT[b];

/** Remove every mark (a scene change). */
export function clearEmotes() { live.length = 0; ctx?.clearRect(0, 0, cv!.width, cv!.height); }

function frame() {
  raf = 0;
  if (!cv || !ctx) return;
  const W = innerWidth, H = innerHeight;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const now = fxNow();
  const avoid = bubbleRects();
  for (let i = live.length - 1; i >= 0; i--) {
    const l = live[i], t = now - l.t0;
    if (t > l.dur) { live.splice(i, 1); continue; }
    if (t < 0) continue;
    const s = l.anchor.screen();
    if (!s || !Number.isFinite(s.x)) continue;
    draw(ctx, l, t, s, avoid);
  }
  if (live.length) raf = requestAnimationFrame(frame);
}

/** Speech bubbles the marks step aside from. */
function bubbleRects(): DOMRect[] {
  const out: DOMRect[] = [];
  document.querySelectorAll('.hh-bubble, .lg-bubble, .bubble').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width > 0) out.push(r); });
  return out;
}

/** A pop: a quick overshoot in four stepped beats (anime pops on twos), then rest at 1. */
function pop(t: number, calm: boolean): number {
  if (calm) return 1;
  if (t < 0.04) return 0.55;
  if (t < 0.08) return 1.35;
  if (t < 0.13) return 0.88;
  if (t < 0.18) return 1.08;
  return 1;
}
/** fade out over the last `f` seconds on the dither grid (returned as 0..1 for globalAlpha-free stepping) */
const out = (t: number, dur: number, f = 0.2) => Math.max(0, Math.min(1, (dur - t) / f));

function draw(c: CanvasRenderingContext2D, l: Live, t: number, s: { x: number; y: number; r: number }, avoid: DOMRect[]) {
  const A = ART!;
  // whole CSS px per texel: bigger on a bigger face, always bold enough to read on a phone
  const k = Math.max(2, Math.min(4, Math.round(s.r / 10)));
  let side = l.side || 1;
  if (!l.side && s.x + s.r * 2.2 + 24 * k > innerWidth) side = -1;
  const r = s.r, calm = l.calm;
  const fade = out(t, l.dur, calm ? 0.35 : 0.2);
  const a = (fade >= 1 ? 1 : Math.max(0.0, Math.round(fade * 4) / 4)); // stepped fade (four beats)
  // a spot beside the head, nudged off any speech bubble
  const at = (dx: number, dy: number) => {
    let x = s.x + dx, y = s.y + dy;
    for (const b of avoid) if (x > b.left - 14 * k && x < b.right + 14 * k && y > b.top - 10 * k && y < b.bottom + 8 * k) y = b.bottom + 9 * k;
    return [Math.round(x), Math.round(y)] as [number, number];
  };
  const bob = calm ? 0 : Math.round(Math.sin(t * 9) * 0.6) * k;
  switch (l.kind) {
    case 'bang': case 'ask': {
      const img = l.kind === 'bang' ? A.bang : A.ask;
      const [x, y] = at(side * r * 0.95, -r * 1.05);
      const hop = calm ? 0 : t < 0.18 ? -Math.round((1 - t / 0.18) * 4) * k : 0;
      const wob = l.kind === 'ask' && !calm ? Math.round(Math.sin(t * 7) * 1.2) * k : 0;
      blit(c, img, x + wob, y + hop + bob, k, pop(t, calm), pop(t, calm), a);
      // motion lines flicking on twos around the top
      if (!calm && t > 0.04 && t < 0.62 && Math.floor(t * 12) % 2 === 0) {
        c.fillStyle = INK;
        const hh = img.height / 2, ox = x + wob, oy = y + hop;
        for (const ang of [-2.45, -1.57, -0.7]) {
          const ca = Math.cos(ang), sa = Math.sin(ang);
          texLine(c, ca * (hh + 2), sa * (hh + 2), ca * (hh + 5), sa * (hh + 5), k, ox, oy);
        }
      }
      break;
    }
    case 'sweat': {
      const slide = calm ? 0 : Math.round(Math.min(1, t / 1.1) * 5) * k;
      const [x, y] = at(side * r * 0.92, -r * 0.55);
      blit(c, A.sweat, x, y + slide, k, side * pop(t, calm), pop(t, calm), a);
      break;
    }
    case 'anger': {
      const [x, y] = at(side * r * 0.82, -r * 0.72);
      const beat = calm ? 1 : t < 0.18 ? pop(t, false) : Math.floor((t - 0.18) / 0.13) % 2 === 0 ? 1.18 : 1;
      blit(c, A.anger, x, y, k, beat, beat, a);
      break;
    }
    case 'notes': {
      for (let i = 0; i < 3; i++) {
        const tt = t - i * 0.28;
        if (tt < 0) continue;
        const life = l.dur - 0.56, rise = Math.min(1, tt / life);
        const img = A.notes[(i + (l.seed % 4)) % 4];
        const sway = calm ? 0 : Math.round(Math.sin(tt * 6 + i) * 2.2) * k;
        const [x, y] = at(side * (r * 0.85 + i * 5 * k) + sway, -r * 0.25 - Math.round(rise * 18) * k - i * 2 * k);
        blit(c, img, x, y, k, pop(tt, calm), pop(tt, calm), Math.min(a, out(tt, life, 0.25)));
      }
      break;
    }
    case 'sparkle': {
      const rr = rng(l.seed);
      for (let i = 0; i < 6; i++) {
        // spread over the upper half round the head, alternating sides
        const ang = -Math.PI * (i % 2 ? 0.08 + rr() * 0.36 : 0.56 + rr() * 0.36), dist = r * (1.1 + rr() * 0.5);
        const t0 = i * 0.09 + rr() * 0.05, tt = t - t0;
        if (tt < 0) continue;
        const ph = calm ? 2 : [0, 1, 2, 2, 3, 2, 1, 0][Math.min(7, Math.floor(tt / 0.08))] ?? 0;
        if (tt > 0.64 && !calm) continue;
        const tint = A.spark[(i + l.seed) % 3];
        const [x, y] = at(Math.cos(ang) * dist, Math.sin(ang) * dist * 0.85);
        blit(c, tint[ph], x, y, k, 1, 1, calm ? a : 1);
      }
      break;
    }
    case 'hearts': {
      for (let i = 0; i < 3; i++) {
        const tt = t - i * 0.2;
        if (tt < 0) continue;
        const life = l.dur - 0.4, rise = Math.min(1, tt / life);
        const sway = calm ? 0 : Math.round(Math.sin(tt * 5 + i * 2) * 2) * k;
        const beat = calm ? 1 : tt < 0.18 ? pop(tt, false) : Math.floor(tt / 0.22) % 2 ? 1.1 : 1;
        const [x, y] = at(side * (r * (0.55 + i * 0.32)) + sway, -r * (0.9 + i * 0.12) - Math.round(rise * 14) * k);
        blit(c, i === 1 ? A.heartS : A.heart, x, y, k, beat, beat, Math.min(a, out(tt, life, 0.25)));
      }
      break;
    }
    case 'zzz': {
      const [x, y] = at(side * r * 1.25, -r * 1.15);
      const breathe = calm ? 1 : t < 0.18 ? pop(t, false) : 1 + (Math.floor(t * 2) % 2) * 0.06;
      blit(c, A.bubble, x, y, k, side * breathe, breathe, a);
      if (t > 0.15 && a > 0) {
        const bx = x - (A.bubble.width / 2) * k + side * 0, by = y - (A.bubble.height / 2) * k;
        const zs: [HTMLCanvasElement, number, number, number][] = [[A.zBig, 13, 9, 0.25], [A.zSmall, 20, 6, 0.55], [A.zSmall, 24, 3, 0.85]];
        for (const [img, zx, zy, tz] of zs) {
          if (t < tz) continue;
          const b = calm ? 0 : Math.round(Math.sin((t - tz) * 6) * 0.8) * k;
          const xx = side > 0 ? bx + zx * k : bx + (A.bubble.width - zx) * k;
          blit(c, img, xx, by + zy * k + b, k, 1, 1, a);
        }
      }
      break;
    }
    case 'bulb': {
      const [x, y] = at(side * r * 0.25, -r * 1.55);
      const on = calm || t > 0.55 || Math.floor(t * 10) % 2 === 0;
      blit(c, on ? A.bulb : A.bulbOff, x, y, k, pop(t, calm), pop(t, calm), a);
      if (on && t > 0.1 && a > 0.5) {
        c.fillStyle = '#ffd23f';
        const hh = A.bulb.height / 2;
        for (const ang of [-2.6, -2.05, -1.57, -1.09, -0.54]) {
          const ca = Math.cos(ang), sa = Math.sin(ang), r0 = hh + 1 + (calm ? 0 : Math.floor(t * 8) % 2);
          texLine(c, ca * r0, sa * r0 - 2, ca * (r0 + 3), sa * (r0 + 3) - 2, k, x, y);
        }
      }
      break;
    }
    case 'gloom': {
      const grow = calm ? 1 : Math.min(1, t / 0.45);
      const [x, y] = at(0, -r * 1.45);
      const drift = calm ? 0 : Math.round(Math.sin(t * 2.4) * 1) * k;
      blit(c, A.cloud, x + drift, y, k, 1, 1, Math.min(a, calm ? 1 : Math.min(1, t / 0.12)));
      // the vertical gloom lines hang down from the cloud over the head
      if (a > 0.25) {
        c.fillStyle = '#4d4a7e';
        const top = (A.cloud.height / 2) - 2, rr = rng(l.seed);
        for (let i = 0; i < 6; i++) {
          const lx = -10 + i * 4 + Math.floor(rr() * 2), len = (5 + Math.floor(rr() * 6)) * grow;
          const flick = calm ? 0 : (Math.floor(t * 8) + i) % 3 === 0 ? 1 : 0;
          texLine(c, lx, top + 2 + flick, lx, top + 2 + flick + len, k, x + drift, y);
        }
      }
      break;
    }
    case 'steam': {
      for (let wave = 0; wave < 2; wave++) {
        const tt = t - wave * 0.32;
        if (tt < 0 || tt > 0.62) continue;
        const f = Math.min(3, Math.floor(tt / 0.16));
        for (const sd of [-1, 1]) {
          const dx = sd * (r * 1.0 + Math.round((tt / 0.62) * 10) * k), dy = -r * 0.35 - Math.round((tt / 0.62) * 6) * k;
          const [x, y] = at(dx, dy);
          blit(c, A.puff[f], x, y, k, sd, 1, calm ? a : 1);
        }
      }
      break;
    }
  }
}

// ------------------------------------------------------------------ anchors for 3D objects

export interface View { camera: THREE.Camera; el: HTMLElement }
const _v = new THREE.Vector3(), _c = new THREE.Vector3();

/** Project a world point and a world radius to CSS px through a view. */
export function project(p: THREE.Vector3, rWorld: number, view: View): { x: number; y: number; r: number } | null {
  const cam = view.camera as THREE.PerspectiveCamera;
  _v.copy(p).project(cam);
  if (_v.z > 1 || _v.z < -1 || Math.abs(_v.x) > 1.6 || Math.abs(_v.y) > 1.6) return null;
  const rect = view.el.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  _c.copy(p).applyMatrix4(cam.matrixWorldInverse);
  const d = Math.max(0.05, -_c.z);
  const f = cam.isPerspectiveCamera ? (cam.zoom || 1) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) : 1;
  return {
    x: rect.left + (_v.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-_v.y * 0.5 + 0.5) * rect.height,
    r: (rWorld * f * (rect.height / 2)) / d,
  };
}

/**
 * An anchor for something in a 3D scene. It learns which camera draws it from the renderer (onBeforeRender of `probe`,
 * any mesh of it that is always drawn), skipping cameras that don't fill the canvas (a stage's window onto the forest),
 * and hides the mark when the thing hasn't been drawn for a moment. `view` overrides the camera when given.
 */
export function actorAnchor(probe: () => THREE.Object3D | null | undefined, face: (out: THREE.Vector3) => THREE.Vector3 | null, radius: () => number, view?: () => View | null): EmoteAnchor {
  let cam: THREE.Camera | null = null, el: HTMLElement | null = null, seen = 0, hooked: THREE.Object3D | null = null;
  const hook = () => {
    const o = probe();
    if (!o || o === hooked) return;
    hooked = o;
    const prev = o.onBeforeRender;
    o.onBeforeRender = function (this: THREE.Object3D, renderer, scene, camera, ...rest) {
      const c = renderer.domElement, pc = camera as THREE.PerspectiveCamera;
      if (c.clientWidth && (!pc.isPerspectiveCamera || Math.abs(pc.aspect - c.clientWidth / c.clientHeight) < 0.03)) { cam = camera; el = c; seen = performance.now(); }
      return (prev as (...a: unknown[]) => void).call(this, renderer, scene, camera, ...rest);
    } as THREE.Object3D['onBeforeRender'];
  };
  const p = new THREE.Vector3();
  hook();
  return {
    screen() {
      hook();
      const v = view?.() ?? (cam && el && performance.now() - seen < 400 ? { camera: cam, el } : null);
      if (!v || !face(p)) return null;
      return project(p, radius(), v);
    },
  };
}
