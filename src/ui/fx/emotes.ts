// Anime emote marks: bold, hand-painted pixel-art marks that pop beside a character's head and follow it in 3D (the
// head is projected through the camera that draws it every frame): a sweat drop, an anger vein, "!" and "?" with
// motion lines, music notes, sparkles, hearts, a "Zzz" bubble, a light bulb, a gloom cloud with vertical lines and
// steam puffs. Each mark is a little object modelled and lit by the interface's own painter (src/ui/px/relief.ts:
// light from the top left, cool violet-blue shadows, a coloured outline) at exactly one art pixel per texel
// (src/gfx/artpx.ts), re-rasterised at every size it pops through (never scaled), on the game's art-pixel grid. They
// live on one transparent canvas between the 3D view and the interface, so the HUD and panels always sit on top of
// them, and they step aside from the interface and speech bubbles. With Calm motion they simply appear and fade.
//   popEmote('bang', anchor)          anchor: anything with screen() -> { x, y, r } (CSS px) or null when hidden
//   actorAnchor(obj, faceCentre, r)   an anchor for an object in a 3D scene (finds the camera that draws it)
import * as THREE from 'three';
import { artPx } from '../../gfx/artpx.ts';
import { clamp, disc, ell, hex, or, poly, Relief, seg, solid, type HFn, type Mat, type Shape } from '../px/relief.ts';
import { blit, calmMotion, col, fxNow, Raster, rng, texLine } from './pixart.ts';

export type EmoteKind = 'sweat' | 'anger' | 'bang' | 'ask' | 'notes' | 'sparkle' | 'hearts' | 'zzz' | 'bulb' | 'gloom' | 'steam';
export const EMOTES: EmoteKind[] = ['bang', 'ask', 'sweat', 'anger', 'notes', 'sparkle', 'hearts', 'zzz', 'bulb', 'gloom', 'steam'];

export interface EmoteAnchor {
  /** where the face is on screen (CSS px) and its radius in CSS px; null while it isn't drawn */
  screen(): { x: number; y: number; r: number } | null;
}

const DUR: Record<EmoteKind, number> = { bang: 1.05, ask: 1.4, sweat: 1.5, anger: 1.25, notes: 1.7, sparkle: 1.25, hearts: 1.6, zzz: 2.4, bulb: 1.4, gloom: 1.9, steam: 1.0 };
/** the cast shadow under every mark: cool violet-blue, like the interface's */
export const SHADOW = col('#221a4a', 92);
/** motion lines and gloom lines: a deep violet-brown, never black */
const LINE = '#3a2448';

// ------------------------------------------------------------------ the art: little painted objects

/** glossy enamel, like the HUD's badges */
export const ENAMEL: Mat = { spec: 0.8, shin: 34, env: 0.12, bands: 5 };
/** soft and matte: clouds, steam, the thought bubble */
export const SOFT: Mat = { spec: 0.12, shin: 8, sheen: 0.12, bands: 5 };
/** water and glass */
const WET: Mat = { spec: 1.0, shin: 60, env: 0.35, bands: 6 };
/** a lit bulb: bright, a hard glint */
const LIT: Mat = { spec: 1.0, shin: 50, env: 0.2, bands: 4 };
const METAL: Mat = { spec: 0.8, shin: 26, env: 0.7, bands: 5 };

/**
 * A rounded, pillowy height for any shape: the distance from each art pixel to the shape's edge, through a circular
 * profile `R` px deep (the shape is sampled once on the art grid, unwarped).
 */
export function pillow(sh: Shape, w: number, h: number, R: number, base = 0): HFn {
  const W = Math.ceil(w) + 2, H = Math.ceil(h) + 2, d = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d[y * W + x] = sh(x + 0.5, y + 0.5) ? 1e4 : 0;
  // two-pass chamfer distance (1, 1.41)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1); else v = Math.min(v, 1);
    if (y > 0) v = Math.min(v, d[i - W] + 1); else v = Math.min(v, 1);
    if (x > 0 && y > 0) v = Math.min(v, d[i - W - 1] + 1.41);
    if (x < W - 1 && y > 0) v = Math.min(v, d[i - W + 1] + 1.41);
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + 1); else v = Math.min(v, 1);
    if (y < H - 1) v = Math.min(v, d[i + W] + 1); else v = Math.min(v, 1);
    if (x < W - 1 && y < H - 1) v = Math.min(v, d[i + W + 1] + 1.41);
    if (x > 0 && y < H - 1) v = Math.min(v, d[i + W - 1] + 1.41);
    d[i] = v;
  }
  return (x, y) => {
    const i = clamp(Math.floor(y), 0, H - 1) * W + clamp(Math.floor(x), 0, W - 1);
    const t = Math.min(1, Math.max(0.35, d[i]) / R);
    return base + R * Math.sqrt(t * (2 - t));
  };
}
/** a thick brush stroke along a polyline */
const stroke = (pts: [number, number][], r: number): Shape => or(...pts.slice(1).map((p, i) => seg(pts[i][0], pts[i][1], p[0], p[1], r)));
const arcPts = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): [number, number][] =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as [number, number]; });

interface Part { shape: Shape; color: string; mat?: Mat; depth?: number; base?: number; seam?: boolean }
/** Model and light a mark from parts (w x h art px), then give it its cool cast shadow. */
function paint(w: number, h: number, parts: Part[], o: { wobble?: number } = {}): HTMLCanvasElement {
  const M = 3, W = Math.ceil(w) + M * 2, H = Math.ceil(h) + M * 2;
  const r = new Relief(W, H, 1, 1);
  r.wobble = o.wobble ?? 0.3;
  r.chip = 0;
  parts.forEach((p, i) => {
    const sh = p.shape;
    const moved: Shape = Object.assign((x: number, y: number) => sh(x - M, y - M), sh.bb ? { bb: [sh.bb[0] + M, sh.bb[1] + M, sh.bb[2] + M, sh.bb[3] + M] as [number, number, number, number] } : {});
    const ph = pillow(moved, W, H, p.depth ?? Math.max(2, Math.min(w, h) * 0.22), p.base ?? 0);
    r.fill(moved, ph, solid(hex(p.color)), p.mat ?? ENAMEL, { id: i + 1, seam: p.seam });
  });
  const px = r.render();
  const ras = new Raster(W, H);
  ras.buf.set(new Uint32Array(px.buffer, px.byteOffset, W * H));
  ras.shadow(SHADOW, 1, 1);
  return ras.canvas();
}

const cache = new Map<string, HTMLCanvasElement>();
const memo = (key: string, f: () => HTMLCanvasElement) => { let c = cache.get(key); if (!c) { c = f(); cache.set(key, c); if (cache.size > 400) cache.delete(cache.keys().next().value!); } return c; };

const NOTE_COLS = ['#3cc8b4', '#ffb43a', '#ff7aa8', '#9f8cff'];
const SPARK_COLS = ['#fff1a8', '#ffd2ec', '#cdeeff', '#e6d8ff'];

/**
 * One mark, `u` art px for the head's radius (the marks scale with the face: re-painted at each size, never
 * stretched). `v` picks a variant (note colour and shape, sparkle tint and twinkle frame, steam frame, bulb on/off).
 */
export function markArt(kind: EmoteKind | 'heartS' | 'z' | 'zs' | 'cloud' | 'bubble', u: number, v = 0): HTMLCanvasElement {
  u = Math.max(6, Math.round(u));
  return memo(`${kind}:${u}:${v}`, () => {
    switch (kind) {
      case 'bang': {
        const h = u * 1.3, w = u * 0.52, cx = w / 2, sk = (y: number) => (y - h * 0.4) * -0.12;
        const bar = poly([[cx - w * 0.47 + sk(0), h * 0.05], [cx + w * 0.47 + sk(0), h * 0.05], [cx + w * 0.17 + sk(h * 0.68), h * 0.68], [cx - w * 0.17 + sk(h * 0.68), h * 0.68]]);
        const cap = ell(cx + sk(h * 0.1), h * 0.11, w * 0.47, h * 0.1);
        return paint(w, h, [{ shape: or(bar, cap), color: '#ffcf3a' }, { shape: disc(cx + sk(h * 0.88), h * 0.88, Math.max(1.5, w * 0.22)), color: '#ffcf3a' }]);
      }
      case 'ask': {
        const h = u * 1.3, w = u * 0.8, cx = w / 2, rr = Math.max(1.5, u * 0.09);
        const hook = [...arcPts(cx, h * 0.3, w * 0.33, h * 0.21, Math.PI * 1.08, Math.PI * 2.18, 12), [cx + w * 0.04, h * 0.52] as [number, number], [cx, h * 0.64] as [number, number]];
        return paint(w, h, [{ shape: stroke(hook, rr), color: '#6fc6ff' }, { shape: disc(cx, h * 0.87, Math.max(1.5, rr * 1.25)), color: '#6fc6ff' }]);
      }
      case 'sweat': {
        const h = u * 0.85, w = u * 0.6, cx = w / 2;
        const drop = or(ell(cx, h * 0.66, w * 0.46, h * 0.33), poly([[cx + w * 0.08, 0], [cx - w * 0.44, h * 0.6], [cx + w * 0.45, h * 0.6]]));
        return paint(w, h, [{ shape: drop, color: '#8ed6ff', mat: WET, depth: w * 0.35 }]);
      }
      case 'anger': {
        const s = u * 0.85, c = s / 2, rr = Math.max(1.4, s * 0.1);
        const pieces = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
          const a0 = Math.atan2(-sy, -sx);
          return stroke(arcPts(c + sx * s * 0.47, c + sy * s * 0.47, s * 0.36, s * 0.36, a0 - 0.52, a0 + 0.52, 8), rr);
        });
        return paint(s, s, [{ shape: or(...pieces), color: '#ff4b3e', depth: rr * 1.4 }]);
      }
      case 'hearts': case 'heartS': {
        const s = u * (kind === 'heartS' ? 0.5 : 0.72), c = s / 2;
        const heart: Shape = Object.assign((x: number, y: number) => {
          const a = (x - c) / (s * 0.5), b = -(y - c) / (s * 0.5) + 0.12;
          return (a * a + b * b - 1) ** 3 - a * a * b * b * b <= 0;
        }, { bb: [0, 0, s, s] as [number, number, number, number] });
        return paint(s, s, [{ shape: heart, color: kind === 'heartS' ? '#ff86ac' : '#ff5b8a', depth: s * 0.3 }]);
      }
      case 'notes': {
        const h = u * 0.8, rr = Math.max(1.1, u * 0.045), color = NOTE_COLS[v % 4];
        if (v % 2 === 0) {
          const w = h * 0.62, hx = w * 0.32, hy = h * 0.8, sx = hx + h * 0.15;
          const head = ell(hx, hy, h * 0.19, h * 0.13);
          const stem = seg(sx, hy - h * 0.02, sx, h * 0.07, rr);
          const flag = stroke([[sx, h * 0.07], [sx + w * 0.3, h * 0.22], [sx + w * 0.36, h * 0.4], [sx + w * 0.22, h * 0.52]], rr);
          return paint(w, h, [{ shape: or(head, stem, flag), color, depth: h * 0.12 }]);
        }
        const w = h * 0.95, x1 = w * 0.3, x2 = w * 0.84;
        const heads = or(ell(x1 - h * 0.14, h * 0.82, h * 0.17, h * 0.12), ell(x2 - h * 0.14, h * 0.74, h * 0.17, h * 0.12));
        const stems = or(seg(x1, h * 0.8, x1, h * 0.1, rr), seg(x2, h * 0.72, x2, h * 0.02, rr));
        const beam = poly([[x1 - rr, h * 0.06], [x2 + rr, -h * 0.02], [x2 + rr, h * 0.12], [x1 - rr, h * 0.2]]);
        return paint(w, h, [{ shape: or(heads, stems, beam), color, depth: h * 0.12 }]);
      }
      case 'sparkle': {
        // a four-point twinkle: the arm length picks the frame (v = tint * 4 + frame)
        const a = Math.max(1.5, u * [0.12, 0.24, 0.38, 0.3][v % 4]), s = a * 2 + 1, c = s / 2, q = Math.max(0.7, a * 0.22);
        const star = poly([[c, c - a], [c + q, c - q], [c + a, c], [c + q, c + q], [c, c + a], [c - q, c + q], [c - a, c], [c - q, c - q]]);
        return paint(s, s, [{ shape: star, color: SPARK_COLS[Math.floor(v / 4) % 4], mat: LIT, depth: Math.max(1, a * 0.35) }], { wobble: 0 });
      }
      case 'bubble': case 'zzz': {
        const w = u * 1.75, h = u * 1.3;
        const cloud = or(ell(w * 0.52, h * 0.4, w * 0.4, h * 0.27), ell(w * 0.3, h * 0.4, w * 0.24, h * 0.22), ell(w * 0.74, h * 0.37, w * 0.22, h * 0.22), ell(w * 0.5, h * 0.22, w * 0.25, h * 0.18));
        const tail = or(disc(w * 0.17, h * 0.78, Math.max(1.5, h * 0.09)), disc(w * 0.06, h * 0.93, Math.max(1, h * 0.05)));
        return paint(w, h, [{ shape: cloud, color: '#fbf8ff', mat: SOFT, depth: h * 0.2 }, { shape: tail, color: '#fbf8ff', mat: SOFT, depth: h * 0.06 }]);
      }
      case 'z': case 'zs': {
        const s = u * (kind === 'z' ? 0.34 : 0.22), rr = Math.max(0.9, s * 0.12);
        const z = stroke([[s * 0.1, s * 0.12], [s * 0.9, s * 0.12], [s * 0.12, s * 0.88], [s * 0.92, s * 0.88]], rr);
        return paint(s, s, [{ shape: z, color: '#5b4fc8', depth: rr }], { wobble: 0.15 });
      }
      case 'bulb': {
        const h = u * 1.25, w = u * 0.8, cx = w / 2;
        const glass = or(ell(cx, h * 0.36, w * 0.47, h * 0.34), poly([[cx - w * 0.33, h * 0.52], [cx + w * 0.33, h * 0.52], [cx + w * 0.21, h * 0.73], [cx - w * 0.21, h * 0.73]]));
        const base = or(...[0, 1, 2].map((i) => ell(cx, h * (0.77 + i * 0.065), w * 0.24, h * 0.035)));
        const tip = ell(cx, h * 0.95, w * 0.12, h * 0.04);
        return paint(w, h, [
          { shape: glass, color: v ? '#f3ecd2' : '#ffe35a', mat: v ? SOFT : LIT, depth: w * 0.3 },
          { shape: base, color: '#c8ccda', mat: METAL, depth: h * 0.035, base: 1, seam: true },
          { shape: tip, color: '#5d6074', mat: METAL, depth: 1, base: 1, seam: true },
        ]);
      }
      case 'cloud': case 'gloom': {
        const w = u * 2.3, h = u * 0.95;
        const cloud = or(ell(w * 0.5, h * 0.6, w * 0.42, h * 0.3), ell(w * 0.3, h * 0.45, w * 0.2, h * 0.3), ell(w * 0.58, h * 0.36, w * 0.22, h * 0.32), ell(w * 0.8, h * 0.55, w * 0.15, h * 0.26));
        return paint(w, h, [{ shape: cloud, color: '#6e7398', mat: SOFT, depth: h * 0.3 }]);
      }
      case 'steam': {
        // swelling in three frames, breaking into wisps in the fourth
        const d = u * [0.32, 0.44, 0.56, 0.56][v % 4], s = d * 1.3, c = s / 2;
        const sh = v % 4 < 3
          ? or(ell(c + d * 0.08, c, d * 0.42, d * 0.35), ell(c - d * 0.24, c + d * 0.1, d * 0.27, d * 0.22), ...(v % 4 ? [ell(c + d * 0.2, c - d * 0.16, d * 0.24, d * 0.2)] : []))
          : or(ell(c - d * 0.3, c + d * 0.1, d * 0.16, d * 0.13), ell(c + d * 0.22, c - d * 0.18, d * 0.2, d * 0.15), ell(c + d * 0.06, c + d * 0.3, d * 0.11, d * 0.1));
        return paint(s, s, [{ shape: sh, color: '#ffffff', mat: SOFT, depth: d * 0.2 }]);
      }
    }
  });
}

// ------------------------------------------------------------------ the layer

interface Live { kind: EmoteKind; anchor: EmoteAnchor; t0: number; dur: number; side: number; seed: number; calm: boolean }
const live: Live[] = [];
let cv: HTMLCanvasElement | null = null, ctx: CanvasRenderingContext2D | null = null, raf = 0, A = 1;

function ensure() {
  if (cv || typeof document === 'undefined') return;
  cv = document.createElement('canvas');
  cv.className = 'hh-emotes';
  cv.setAttribute('aria-hidden', 'true');
  // between the 3D view (#world) and the interface (#ui, z-index 2): the HUD and panels always cover a mark
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', zIndex: '1', pointerEvents: 'none', imageRendering: 'pixelated' });
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');
}

/** Pop an emote mark beside an anchor's head. A new mark in the same spot replaces the old one. */
export function popEmote(kind: EmoteKind, anchor: EmoteAnchor, o: { side?: number; delay?: number } = {}) {
  if (typeof document === 'undefined') return;
  ensure();
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
  // one canvas pixel = one art pixel (a whole number of device pixels, so the browser's upscale stays crisp)
  A = artPx();
  const W = Math.ceil(innerWidth / A), H = Math.ceil(innerHeight / A);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; cv.style.width = `${W * A}px`; cv.style.height = `${H * A}px`; }
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

/** Which side of the head a mark goes: the one with room on screen and no interface over it (tested once). */
function pickSide(s: { x: number; y: number; r: number }): number {
  const score = (sd: number) => {
    let bad = 0;
    for (const [dx, dy] of [[1.15, -0.9], [1.15, -0.3], [1.0, -1.5], [1.6, -0.9]] as const) {
      const x = s.x + sd * s.r * dx, y = s.y + s.r * dy;
      if (x < 8 || x > innerWidth - 8 || y < 8) { bad += 2; continue; }
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.id !== 'world' && hit.tagName !== 'BODY' && hit.tagName !== 'HTML' && !(hit instanceof HTMLCanvasElement && !hit.closest('#ui'))) bad++;
    }
    return bad;
  };
  try {
    const a = score(1), b = score(-1);
    return b < a ? -1 : 1;
  } catch { return 1; }
}

/** Speech bubbles the marks step aside from. */
function bubbleRects(): DOMRect[] {
  const out: DOMRect[] = [];
  document.querySelectorAll('.hh-bubble, .lg-bubble, .bubble').forEach((e) => { const r = e.getBoundingClientRect(); if (r.width > 0) out.push(r); });
  return out;
}

/** A pop: a quick overshoot in four stepped beats (anime pops on twos), then rest; the mark is re-painted at each size. */
function pop(t: number, calm: boolean): number {
  if (calm) return 1;
  if (t < 0.04) return 0.55;
  if (t < 0.08) return 1.3;
  if (t < 0.13) return 0.9;
  if (t < 0.18) return 1.06;
  return 1;
}
/** fade out over the last `f` seconds, in four steps */
const out = (t: number, dur: number, f = 0.2) => Math.max(0, Math.min(1, (dur - t) / f));

function draw(c: CanvasRenderingContext2D, l: Live, t: number, s: { x: number; y: number; r: number }, avoid: DOMRect[]) {
  if (!l.side) l.side = pickSide(s);
  const side = l.side, calm = l.calm;
  // everything below is in art pixels: the face's centre, its radius, and the marks' unit size
  const X = s.x / A, Y = s.y / A, r = s.r / A;
  const u = Math.max(14, Math.min(46, Math.round(r / 2) * 2));
  const fade = out(t, l.dur, calm ? 0.35 : 0.2);
  const a = fade >= 1 ? 1 : Math.round(fade * 4) / 4;
  // a spot beside the head (art px), nudged off any speech bubble, snapped to the art grid
  const at = (dx: number, dy: number): [number, number] => {
    let x = X + dx, y = Y + dy;
    for (const b of avoid) if (x * A > b.left - u * A * 0.5 && x * A < b.right + u * A * 0.5 && y * A > b.top - u * A * 0.4 && y * A < b.bottom + u * A * 0.3) y = b.bottom / A + u * 0.45;
    return [Math.round(x), Math.round(y)];
  };
  const bob = calm ? 0 : Math.round(Math.sin(t * 9) * 0.6);
  const P = (tt: number) => pop(tt, calm);
  switch (l.kind) {
    case 'bang': case 'ask': {
      const img = markArt(l.kind, u * P(t));
      const [x, y] = at(side * r * 1.0, -r * 1.05);
      const hop = calm ? 0 : t < 0.18 ? -Math.round((1 - t / 0.18) * u * 0.18) : 0;
      const wob = l.kind === 'ask' && !calm ? Math.round(Math.sin(t * 7) * 1.2) : 0;
      blit(c, img, x + wob, y + hop + bob, 1, 1, 1, a);
      // motion lines flicking on twos round the top
      if (!calm && t > 0.04 && t < 0.62 && Math.floor(t * 12) % 2 === 0) {
        c.fillStyle = LINE;
        const hh = img.height / 2, n = Math.max(2, Math.round(u * 0.14)), th = u >= 30 ? 2 : 1;
        for (const ang of [-2.5, -1.57, -0.64]) {
          const ca = Math.cos(ang), sa = Math.sin(ang);
          texLine(c, ca * (hh + 2), sa * (hh + 2), ca * (hh + 2 + n), sa * (hh + 2 + n), 1, x + wob, y + hop, th);
        }
      }
      break;
    }
    case 'sweat': {
      const slide = calm ? 0 : Math.round(Math.min(1, t / 1.1) * u * 0.2);
      const [x, y] = at(side * r * 0.98, -r * 0.55);
      blit(c, markArt('sweat', u * P(t)), x, y + slide, 1, side, 1, a);
      break;
    }
    case 'anger': {
      const [x, y] = at(side * r * 0.86, -r * 0.74);
      const beat = calm ? 1 : t < 0.18 ? P(t) : Math.floor((t - 0.18) / 0.13) % 2 === 0 ? 1.16 : 1;
      blit(c, markArt('anger', u * beat), x, y, 1, 1, 1, a);
      break;
    }
    case 'notes': {
      for (let i = 0; i < 3; i++) {
        const tt = t - i * 0.28;
        if (tt < 0) continue;
        const life = l.dur - 0.56, rise = Math.min(1, tt / life);
        const sway = calm ? 0 : Math.round(Math.sin(tt * 6 + i) * u * 0.08);
        const [x, y] = at(side * (r * 0.95 + i * u * 0.2) + sway, -r * 0.25 - Math.round(rise * u * 0.7) - i * u * 0.08);
        blit(c, markArt('notes', u * P(tt), (i + l.seed) % 4), x, y, 1, 1, 1, Math.min(a, out(tt, life, 0.25)));
      }
      break;
    }
    case 'sparkle': {
      const rr = rng(l.seed);
      for (let i = 0; i < 6; i++) {
        // spread over the upper half round the head, alternating sides
        const ang = -Math.PI * (i % 2 ? 0.06 + rr() * 0.34 : 0.6 + rr() * 0.34), dist = r * (1.45 + rr() * 0.5);
        const t0 = i * 0.09 + rr() * 0.05, tt = t - t0;
        if (tt < 0) continue;
        if (tt > 0.64 && !calm) continue;
        const ph = calm ? 2 : [0, 1, 2, 2, 3, 2, 1, 0][Math.min(7, Math.floor(tt / 0.08))] ?? 0;
        const [x, y] = at(Math.cos(ang) * dist, Math.sin(ang) * dist * 0.85);
        blit(c, markArt('sparkle', u, ((i + l.seed) % 3) * 4 + ph), x, y, 1, 1, 1, calm ? a : 1);
      }
      break;
    }
    case 'hearts': {
      for (let i = 0; i < 3; i++) {
        const tt = t - i * 0.2;
        if (tt < 0) continue;
        const life = l.dur - 0.4, rise = Math.min(1, tt / life);
        const sway = calm ? 0 : Math.round(Math.sin(tt * 5 + i * 2) * u * 0.07);
        const beat = calm ? 1 : tt < 0.18 ? P(tt) : Math.floor(tt / 0.22) % 2 ? 1.1 : 1;
        const [x, y] = at(side * (r * (0.6 + i * 0.36)) + sway, -r * (0.95 + i * 0.12) - Math.round(rise * u * 0.55));
        blit(c, markArt(i === 1 ? 'heartS' : 'hearts', u * beat), x, y, 1, 1, 1, Math.min(a, out(tt, life, 0.25)));
      }
      break;
    }
    case 'zzz': {
      const breathe = calm ? 1 : t < 0.18 ? P(t) : 1 + (Math.floor(t * 2) % 2) * 0.05;
      const img = markArt('bubble', u * breathe);
      const [x, y] = at(side * r * 1.3, -r * 1.2);
      blit(c, img, x, y, 1, side, 1, a);
      if (t > 0.15 && a > 0) {
        const bx = x - img.width / 2, by = y - img.height / 2, w = img.width;
        const zs: ['z' | 'zs', number, number, number][] = [['z', 0.46, 0.4, 0.25], ['zs', 0.66, 0.3, 0.55], ['zs', 0.8, 0.2, 0.85]];
        for (const [kind, zx, zy, tz] of zs) {
          if (t < tz) continue;
          const b = calm ? 0 : Math.round(Math.sin((t - tz) * 6) * 0.8);
          const xx = side > 0 ? bx + zx * w : bx + (1 - zx) * w;
          blit(c, markArt(kind, u), Math.round(xx), Math.round(by + zy * img.height + b), 1, 1, 1, a);
        }
      }
      break;
    }
    case 'bulb': {
      const [x, y] = at(side * r * 0.3, -r * 1.6);
      const on = calm || t > 0.55 || Math.floor(t * 10) % 2 === 0;
      const img = markArt('bulb', u * P(t), on ? 0 : 1);
      blit(c, img, x, y, 1, 1, 1, a);
      if (on && t > 0.1 && a > 0.5) {
        c.fillStyle = '#ffcf3a';
        const hh = img.height / 2, n = Math.max(2, Math.round(u * 0.12)), th = u >= 30 ? 2 : 1;
        for (const ang of [-2.6, -2.05, -1.57, -1.09, -0.54]) {
          const ca = Math.cos(ang), sa = Math.sin(ang), r0 = hh * 0.85 + 2 + (calm ? 0 : Math.floor(t * 8) % 2);
          texLine(c, ca * r0, sa * r0 - hh * 0.25, ca * (r0 + n), sa * (r0 + n) - hh * 0.25, 1, x, y, th);
        }
      }
      break;
    }
    case 'gloom': {
      const grow = calm ? 1 : Math.min(1, t / 0.45);
      const img = markArt('cloud', u);
      const [x, y] = at(0, -r * 1.5);
      const drift = calm ? 0 : Math.round(Math.sin(t * 2.4));
      blit(c, img, x + drift, y, 1, 1, 1, Math.min(a, calm ? 1 : Math.min(1, t / 0.12)));
      // the vertical gloom lines hang down from the cloud over the head
      if (a > 0.25) {
        c.fillStyle = '#4d4a7e';
        const top = img.height / 2 - 3, rr = rng(l.seed), n = Math.max(4, Math.round(u / 4)), span = img.width * 0.62;
        for (let i = 0; i < n; i++) {
          const lx = Math.round(-span / 2 + (i / (n - 1)) * span + rr() * 2), len = Math.round((u * 0.25 + rr() * u * 0.3) * grow);
          const flick = calm ? 0 : (Math.floor(t * 8) + i) % 3 === 0 ? 1 : 0;
          texLine(c, lx, top + 2 + flick, lx, top + 2 + flick + len, 1, x + drift, y, u >= 30 ? 2 : 1);
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
          const [x, y] = at(sd * (r * 1.05 + Math.round((tt / 0.62) * u * 0.4)), -r * 0.35 - Math.round((tt / 0.62) * u * 0.25));
          blit(c, markArt('steam', u, f), x, y, 1, sd, 1, calm ? a : 1);
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
