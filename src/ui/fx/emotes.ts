// Anime emote marks: bold, polished anime-style marks that pop beside a character's head and follow it in 3D (the
// head is projected through the camera that draws it every frame): a sweat drop, an anger vein, "!" and "?" with
// motion lines, music notes, sparkles, hearts, a "Zzz" bubble, a light bulb, a gloom cloud with vertical lines and
// steam puffs. Each is drawn as smooth, anti-aliased vector art at the screen's full resolution (device pixels): a
// glossy fill shaded from a warm light at the top left into a cool violet shadow, a coloured outline, a white gloss
// highlight and a soft drop shadow, like the marks in an anime. They live on one transparent canvas between the 3D view
// and the interface, so the HUD and panels always sit on top of them, and they step aside from the interface and
// speech bubbles. Snappy pops and bounces; with Calm motion they simply appear and fade.
//   popEmote('bang', anchor)          anchor: anything with screen() -> { x, y, r } (CSS px) or null when hidden
//   actorAnchor(obj, faceCentre, r)   an anchor for an object in a 3D scene (finds the camera that draws it)
import * as THREE from 'three';
import { calmMotion, fxNow, rng } from './kit.ts';

export type EmoteKind = 'sweat' | 'anger' | 'bang' | 'ask' | 'notes' | 'sparkle' | 'hearts' | 'zzz' | 'bulb' | 'gloom' | 'steam';
export const EMOTES: EmoteKind[] = ['bang', 'ask', 'sweat', 'anger', 'notes', 'sparkle', 'hearts', 'zzz', 'bulb', 'gloom', 'steam'];

export interface EmoteAnchor {
  /** where the face is on screen (CSS px) and its radius in CSS px; null while it isn't drawn */
  screen(): { x: number; y: number; r: number } | null;
}

const DUR: Record<EmoteKind, number> = { bang: 1.05, ask: 1.4, sweat: 1.5, anger: 1.25, notes: 1.7, sparkle: 1.25, hearts: 1.6, zzz: 2.4, bulb: 1.4, gloom: 1.9, steam: 1.0 };
/** the soft cast shadow under every mark: cool violet */
export const SHADOW_RGBA = 'rgba(38, 24, 74, 0.32)';
/** motion lines and gloom lines: a deep violet-brown, never black */
const LINE = '#3a2448';

// ------------------------------------------------------------------ smooth anime painting kit

/** The device-pixel ratio the marks are drawn at (capped: a 4x screen gains nothing visible). */
export const dprNow = () => Math.min(3, Math.max(1, window.devicePixelRatio || 1));

export interface Look {
  /** light, base and shadow tones of the fill (top left to bottom right) */
  hi: string; base: string; low: string;
  /** the coloured outline */
  line: string;
  /** gloss highlight strength (0 = matte) */
  gloss?: number;
  /** an outer glow colour (sparkles, a lit bulb) */
  glow?: string;
}
export const LOOKS = {
  sun: { hi: '#fff6b8', base: '#ffcf33', low: '#f08a1c', line: '#7a3a1c', gloss: 0.9 },
  sky: { hi: '#e6f8ff', base: '#78ccff', low: '#3b7ee0', line: '#1f3f86', gloss: 0.9 },
  water: { hi: '#f2fbff', base: '#92dcff', low: '#4a96e8', line: '#2a5aa8', gloss: 1 },
  red: { hi: '#ffb4a2', base: '#ff4b3e', low: '#c4204a', line: '#6a1430', gloss: 0.8 },
  pink: { hi: '#ffd6e4', base: '#ff5b8f', low: '#d22e74', line: '#7a1442', gloss: 1 },
  teal: { hi: '#c8fff2', base: '#38c9b2', low: '#1a8a90', line: '#0f4a58', gloss: 0.8 },
  gold: { hi: '#fff0c0', base: '#ffb43a', low: '#e0702a', line: '#6e3214', gloss: 0.8 },
  rose: { hi: '#ffe0ec', base: '#ff7aa8', low: '#c8467e', line: '#6e1a44', gloss: 0.8 },
  violet: { hi: '#efe8ff', base: '#a08cff', low: '#6248d8', line: '#2e1a78', gloss: 0.8 },
  cloud: { hi: '#ffffff', base: '#f6f3ff', low: '#cfc8f0', line: '#7d76b0', gloss: 0 },
  storm: { hi: '#9ea3c4', base: '#6c7196', low: '#41456a', line: '#211d36', gloss: 0 },
  steam: { hi: '#ffffff', base: '#f4f6fb', low: '#cdd3e6', line: '#8890aa', gloss: 0 },
  zee: { hi: '#a89cff', base: '#5b4fc8', low: '#3a2c98', line: '#f6f3ff', gloss: 0.4 },
  bulb: { hi: '#fffbe0', base: '#ffe35a', low: '#f2a531', line: '#8a5214', gloss: 1, glow: 'rgba(255, 220, 90, 0.85)' },
  bulbOff: { hi: '#ffffff', base: '#f3eedc', low: '#cbbf9a', line: '#7a6a4a', gloss: 0.8 },
  metal: { hi: '#ffffff', base: '#c8ccda', low: '#7d8298', line: '#3a3c52', gloss: 0.6 },
} satisfies Record<string, Look>;

/**
 * Paint a filled shape: a soft violet drop shadow, a coloured outline (`lw` wide outside the shape), a fill shaded from
 * the light at the top left to a cool shadow at the bottom right, and a gloss highlight up top. `box` is the shape's
 * bounds [x0, y0, x1, y1] (for the shading).
 */
export function paintShape(g: CanvasRenderingContext2D, path: Path2D, box: [number, number, number, number], L: Look, lw: number, rim = true) {
  const [x0, y0, x1, y1] = box, w = x1 - x0, h = y1 - y0;
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  // drop shadow and outline in one: the outline colour, stroked wide and filled, casting the shadow
  g.shadowColor = SHADOW_RGBA; g.shadowBlur = lw * 2.2; g.shadowOffsetX = lw * 0.5; g.shadowOffsetY = lw * 0.9;
  if (L.glow) { g.shadowColor = L.glow; g.shadowBlur = lw * 5; g.shadowOffsetX = 0; g.shadowOffsetY = 0; }
  g.fillStyle = L.line; g.strokeStyle = L.line; g.lineWidth = lw * 2;
  g.fill(path); g.stroke(path);
  g.restore();
  g.save();
  g.clip(path);
  // the fill: light at the top left falling to the base, then a cool shadow pooling at the bottom right
  const lin = g.createLinearGradient(x0 + w * 0.2, y0, x0 + w * 0.8, y1);
  lin.addColorStop(0, L.hi); lin.addColorStop(0.45, L.base); lin.addColorStop(1, L.low);
  g.fillStyle = lin; g.fillRect(x0 - lw, y0 - lw, w + lw * 2, h + lw * 2);
  const cool = g.createRadialGradient(x1, y1, 0, x1, y1, Math.max(w, h) * 0.9);
  cool.addColorStop(0, 'rgba(70, 50, 150, 0.32)'); cool.addColorStop(1, 'rgba(70, 50, 150, 0)');
  g.fillStyle = cool; g.fillRect(x0 - lw, y0 - lw, w + lw * 2, h + lw * 2);
  // a thin bright rim along the lit edge (not on unions of shapes, where it would trace the seams)
  if (rim) {
    g.globalAlpha = 0.55; g.strokeStyle = L.hi; g.lineWidth = lw * 1.2;
    g.translate(lw * 0.5, lw * 0.6); g.stroke(path); g.translate(-lw * 0.5, -lw * 0.6);
    g.globalAlpha = 1;
  }
  if (L.gloss) {
    // the gloss: a soft white oval up at the top left
    const gx = x0 + w * 0.32, gy = y0 + h * 0.24, gr = Math.max(w, h) * 0.32;
    const gl = g.createRadialGradient(gx, gy, 0, gx, gy, gr);
    gl.addColorStop(0, `rgba(255,255,255,${0.85 * L.gloss})`); gl.addColorStop(0.45, `rgba(255,255,255,${0.35 * L.gloss})`); gl.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(x0, y0, w, h);
  }
  g.restore();
}
/** Paint a thick brush stroke (a hook, a vein, a flag, a Z) the same way: outline, shaded body, a bright streak. */
export function paintStroke(g: CanvasRenderingContext2D, path: Path2D, width: number, box: [number, number, number, number], L: Look, lw: number) {
  const [x0, y0, x1, y1] = box;
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.shadowColor = SHADOW_RGBA; g.shadowBlur = lw * 2.2; g.shadowOffsetX = lw * 0.5; g.shadowOffsetY = lw * 0.9;
  g.strokeStyle = L.line; g.lineWidth = width + lw * 2; g.stroke(path);
  g.restore();
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  const lin = g.createLinearGradient(x0, y0, x1, y1);
  lin.addColorStop(0, L.hi); lin.addColorStop(0.45, L.base); lin.addColorStop(1, L.low);
  g.strokeStyle = lin; g.lineWidth = width; g.stroke(path);
  if (L.gloss) { g.globalAlpha = 0.7 * L.gloss; g.strokeStyle = '#ffffff'; g.lineWidth = width * 0.24; g.translate(-width * 0.16, -width * 0.18); g.stroke(path); }
  g.restore();
}

/** A sprite canvas at device resolution: `w` x `h` CSS px of art plus a margin for the outline, shadow and glow. */
function sprite(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, pad = 0.22): HTMLCanvasElement {
  const d = dprNow(), m = Math.ceil(Math.max(w, h) * pad + 4);
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + m * 2) * d); c.height = Math.ceil((h + m * 2) * d);
  const g = c.getContext('2d')!;
  g.setTransform(d, 0, 0, d, m * d, m * d);
  draw(g);
  return c;
}
const ell = (p: Path2D, cx: number, cy: number, rx: number, ry: number, rot = 0) => { p.moveTo(cx + Math.cos(rot) * rx, cy + Math.sin(rot) * rx); p.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); return p; };
const circ = (p: Path2D, cx: number, cy: number, r: number) => ell(p, cx, cy, r, r);
/** a cloud: the union of circles, outlined and shaded as one */
function cloud(g: CanvasRenderingContext2D, blobs: [number, number, number][], L: Look, lw: number) {
  const p = new Path2D();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y, r] of blobs) { circ(p, x, y, r); x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); }
  paintShape(g, p, [x0, y0, x1, y1], L, lw, false);
}

const cache = new Map<string, HTMLCanvasElement>();
const memo = (key: string, f: () => HTMLCanvasElement) => { let c = cache.get(key); if (!c) { c = f(); cache.set(key, c); if (cache.size > 300) cache.delete(cache.keys().next().value!); } return c; };

const NOTE_LOOKS: Look[] = [LOOKS.teal, LOOKS.gold, LOOKS.rose, LOOKS.violet];
const SPARK_TINTS = ['#ffd24a', '#ff7ac0', '#5ec8ff', '#a98cff'];

/**
 * One mark at unit size `u` CSS px (about the head's radius), drawn at device resolution and cached per size step (a
 * pop scales the cached mark smoothly). `v` picks a variant (note colour and shape, sparkle tint, steam frame, bulb
 * on/off). Marks are centred on their canvas.
 */
export function markArt(kind: EmoteKind | 'heartS' | 'z' | 'zs' | 'cloud' | 'bubble', u: number, v = 0): HTMLCanvasElement {
  u = Math.max(8, Math.round(u / 4) * 4);
  return memo(`${kind}:${u}:${v}:${dprNow()}`, () => {
    const lw = Math.max(1.4, u * 0.055);
    switch (kind) {
      case 'bang': {
        const h = u * 1.3, w = u * 0.56, cx = w / 2;
        return sprite(w, h, (g) => {
          g.transform(1, 0, -0.12, 1, h * 0.05, 0); // a lean, like a shout
          const bar = new Path2D();
          bar.moveTo(cx - w * 0.44, h * 0.12);
          bar.quadraticCurveTo(cx - w * 0.44, 0, cx, 0);
          bar.quadraticCurveTo(cx + w * 0.44, 0, cx + w * 0.44, h * 0.12);
          bar.lineTo(cx + w * 0.13, h * 0.64);
          bar.quadraticCurveTo(cx, h * 0.7, cx - w * 0.13, h * 0.64);
          bar.closePath();
          paintShape(g, bar, [cx - w * 0.44, 0, cx + w * 0.44, h * 0.7], LOOKS.sun, lw);
          paintShape(g, circ(new Path2D(), cx, h * 0.87, w * 0.2), [cx - w * 0.2, h * 0.87 - w * 0.2, cx + w * 0.2, h * 0.87 + w * 0.2], LOOKS.sun, lw);
        });
      }
      case 'ask': {
        const h = u * 1.3, w = u * 0.78, cx = w / 2, sw = u * 0.17;
        return sprite(w, h, (g) => {
          const p = new Path2D();
          p.moveTo(cx - w * 0.3, h * 0.26);
          p.bezierCurveTo(cx - w * 0.3, h * 0.04, cx + w * 0.34, h * 0.0, cx + w * 0.32, h * 0.27);
          p.bezierCurveTo(cx + w * 0.3, h * 0.42, cx + w * 0.02, h * 0.44, cx, h * 0.6);
          paintStroke(g, p, sw, [0, 0, w, h * 0.62], LOOKS.sky, lw);
          paintShape(g, circ(new Path2D(), cx, h * 0.86, sw * 0.62), [cx - sw, h * 0.8, cx + sw, h * 0.92], LOOKS.sky, lw);
        });
      }
      case 'sweat': {
        const h = u * 0.86, w = u * 0.6, cx = w / 2;
        return sprite(w, h, (g) => {
          const p = new Path2D();
          p.moveTo(cx + w * 0.06, 0);
          p.bezierCurveTo(cx + w * 0.22, h * 0.28, cx + w * 0.5, h * 0.48, cx + w * 0.5, h * 0.68);
          p.bezierCurveTo(cx + w * 0.5, h * 0.9, cx + w * 0.26, h, cx, h);
          p.bezierCurveTo(cx - w * 0.26, h, cx - w * 0.5, h * 0.9, cx - w * 0.5, h * 0.68);
          p.bezierCurveTo(cx - w * 0.5, h * 0.48, cx - w * 0.1, h * 0.28, cx + w * 0.06, 0);
          paintShape(g, p, [0, 0, w, h], LOOKS.water, lw);
          // the classic curved glint down the left of a sweat drop
          g.save(); g.clip(p);
          g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineCap = 'round'; g.lineWidth = w * 0.1;
          g.beginPath(); g.arc(cx + w * 0.06, h * 0.66, w * 0.3, Math.PI * 0.85, Math.PI * 1.3); g.stroke();
          g.restore();
        });
      }
      case 'anger': {
        const s = u * 0.9, c = s / 2, sw = s * 0.15;
        return sprite(s, s, (g) => {
          for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            const p = new Path2D(), a0 = Math.atan2(-sy, -sx), ax = c + sx * s * 0.46, ay = c + sy * s * 0.46, rr = s * 0.34;
            p.arc(ax, ay, rr, a0 - 0.55, a0 + 0.55);
            paintStroke(g, p, sw, [0, 0, s, s], LOOKS.red, lw);
          }
        });
      }
      case 'hearts': case 'heartS': {
        const s = u * (kind === 'heartS' ? 0.5 : 0.72), c = s / 2;
        return sprite(s, s * 0.92, (g) => {
          const p = new Path2D();
          p.moveTo(c, s * 0.28);
          p.bezierCurveTo(c, s * 0.08, c - s * 0.5, s * 0.02, c - s * 0.5, s * 0.32);
          p.bezierCurveTo(c - s * 0.5, s * 0.56, c - s * 0.18, s * 0.72, c, s * 0.9);
          p.bezierCurveTo(c + s * 0.18, s * 0.72, c + s * 0.5, s * 0.56, c + s * 0.5, s * 0.32);
          p.bezierCurveTo(c + s * 0.5, s * 0.02, c, s * 0.08, c, s * 0.28);
          paintShape(g, p, [0, 0, s, s * 0.9], kind === 'heartS' ? LOOKS.rose : LOOKS.pink, lw);
        });
      }
      case 'notes': {
        const h = u * 0.82, L = NOTE_LOOKS[v % 4], sw = u * 0.075;
        if (v % 2 === 0) {
          const w = h * 0.62, hx = w * 0.32, hy = h * 0.8, sx = hx + h * 0.15;
          return sprite(w, h, (g) => {
            const st = new Path2D(); st.moveTo(sx, hy - h * 0.02); st.lineTo(sx, h * 0.07);
            st.bezierCurveTo(sx + w * 0.1, h * 0.2, sx + w * 0.42, h * 0.24, sx + w * 0.26, h * 0.52);
            paintStroke(g, st, sw, [0, 0, w, h], L, lw);
            paintShape(g, ell(new Path2D(), hx, hy, h * 0.19, h * 0.13, -0.4), [hx - h * 0.19, hy - h * 0.13, hx + h * 0.19, hy + h * 0.13], L, lw);
          });
        }
        const w = h * 0.95, x1 = w * 0.3, x2 = w * 0.86;
        return sprite(w, h, (g) => {
          const st = new Path2D(); st.moveTo(x1, h * 0.8); st.lineTo(x1, h * 0.12); st.lineTo(x2, h * 0.02); st.lineTo(x2, h * 0.72);
          paintStroke(g, st, sw, [0, 0, w, h], L, lw);
          const beam = new Path2D(); beam.moveTo(x1, h * 0.12); beam.lineTo(x2, h * 0.02);
          paintStroke(g, beam, sw * 2.2, [0, 0, w, h], L, lw);
          for (const [hx, hy] of [[x1 - h * 0.14, h * 0.82], [x2 - h * 0.14, h * 0.74]]) paintShape(g, ell(new Path2D(), hx, hy, h * 0.17, h * 0.12, -0.4), [hx - h * 0.17, hy - h * 0.12, hx + h * 0.17, hy + h * 0.12], L, lw);
        });
      }
      case 'sparkle': {
        // a four-point twinkle with concave sides and a glow; the arm length picks the frame (v = tint * 4 + frame)
        const a = Math.max(3, u * [0.12, 0.24, 0.38, 0.3][v % 4]), s = a * 2, c = a, tint = SPARK_TINTS[Math.floor(v / 4) % 4];
        return sprite(s, s, (g) => {
          const p = new Path2D(), k = a * 0.16;
          p.moveTo(c, c - a);
          p.quadraticCurveTo(c + k, c - k, c + a, c); p.quadraticCurveTo(c + k, c + k, c, c + a);
          p.quadraticCurveTo(c - k, c + k, c - a, c); p.quadraticCurveTo(c - k, c - k, c, c - a);
          g.save();
          g.shadowColor = tint; g.shadowBlur = a * 0.9;
          const rg = g.createRadialGradient(c, c, 0, c, c, a);
          rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, '#ffffff'); rg.addColorStop(1, tint);
          g.fillStyle = rg; g.fill(p);
          g.restore();
          g.fillStyle = '#ffffff'; g.beginPath(); g.arc(c, c, a * 0.14, 0, Math.PI * 2); g.fill();
        }, 0.45);
      }
      case 'bubble': case 'zzz': {
        const w = u * 1.75, h = u * 1.3;
        return sprite(w, h, (g) => {
          cloud(g, [[w * 0.52, h * 0.42, h * 0.27], [w * 0.3, h * 0.42, h * 0.22], [w * 0.74, h * 0.39, h * 0.22], [w * 0.47, h * 0.24, h * 0.2], [w * 0.63, h * 0.25, h * 0.17]], LOOKS.cloud, lw);
          cloud(g, [[w * 0.18, h * 0.79, h * 0.085]], LOOKS.cloud, lw * 0.8);
          cloud(g, [[w * 0.07, h * 0.94, h * 0.05]], LOOKS.cloud, lw * 0.7);
        });
      }
      case 'z': case 'zs': {
        const s = u * (kind === 'z' ? 0.34 : 0.22), sw = Math.max(2, s * 0.2);
        return sprite(s, s, (g) => {
          const p = new Path2D(); p.moveTo(s * 0.1, s * 0.12); p.lineTo(s * 0.9, s * 0.12); p.lineTo(s * 0.12, s * 0.88); p.lineTo(s * 0.92, s * 0.88);
          paintStroke(g, p, sw, [0, 0, s, s], LOOKS.zee, Math.max(1, lw * 0.5));
        });
      }
      case 'bulb': {
        const h = u * 1.25, w = u * 0.8, cx = w / 2, L = v ? LOOKS.bulbOff : LOOKS.bulb;
        return sprite(w, h, (g) => {
          for (let i = 2; i >= 0; i--) {
            const y = h * (0.76 + i * 0.065), p = new Path2D();
            p.roundRect(cx - w * 0.24, y, w * 0.48, h * 0.07, h * 0.035);
            paintShape(g, p, [cx - w * 0.24, y, cx + w * 0.24, y + h * 0.07], LOOKS.metal, lw * 0.7);
          }
          const glass = new Path2D();
          glass.moveTo(cx - w * 0.2, h * 0.76);
          glass.bezierCurveTo(cx - w * 0.2, h * 0.6, cx - w * 0.48, h * 0.56, cx - w * 0.48, h * 0.36);
          glass.bezierCurveTo(cx - w * 0.48, h * 0.1, cx - w * 0.24, 0, cx, 0);
          glass.bezierCurveTo(cx + w * 0.24, 0, cx + w * 0.48, h * 0.1, cx + w * 0.48, h * 0.36);
          glass.bezierCurveTo(cx + w * 0.48, h * 0.56, cx + w * 0.2, h * 0.6, cx + w * 0.2, h * 0.76);
          glass.closePath();
          paintShape(g, glass, [0, 0, w, h * 0.76], L, lw);
          if (!v) { g.strokeStyle = 'rgba(255, 150, 40, 0.9)'; g.lineWidth = lw * 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - w * 0.12, h * 0.62); g.lineTo(cx - w * 0.06, h * 0.44); g.lineTo(cx, h * 0.56); g.lineTo(cx + w * 0.06, h * 0.44); g.lineTo(cx + w * 0.12, h * 0.62); g.stroke(); }
        });
      }
      case 'cloud': case 'gloom': {
        const w = u * 2.3, h = u * 0.95;
        return sprite(w, h, (g) => cloud(g, [[w * 0.5, h * 0.6, h * 0.32], [w * 0.28, h * 0.52, h * 0.3], [w * 0.58, h * 0.36, h * 0.32], [w * 0.8, h * 0.56, h * 0.26], [w * 0.4, h * 0.34, h * 0.24]], LOOKS.storm, lw));
      }
      case 'steam': {
        // swelling in three frames, breaking into wisps in the fourth
        const d = u * [0.32, 0.44, 0.56, 0.56][v % 4], s = d * 1.3, c = s / 2;
        const blobs: [number, number, number][] = v % 4 < 3
          ? [[c + d * 0.08, c, d * 0.36], [c - d * 0.24, c + d * 0.1, d * 0.24], ...(v % 4 ? [[c + d * 0.24, c - d * 0.16, d * 0.22] as [number, number, number]] : [])]
          : [[c - d * 0.3, c + d * 0.1, d * 0.15], [c + d * 0.22, c - d * 0.18, d * 0.18], [c + d * 0.06, c + d * 0.3, d * 0.1]];
        return sprite(s, s, (g) => cloud(g, blobs, LOOKS.steam, Math.max(1, lw * 0.7)));
      }
    }
  });
}

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
  Object.assign(cv.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '1', pointerEvents: 'none' });
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
  // full device resolution: smooth, crisp vector art on any screen
  const d = dprNow(), W = Math.round(innerWidth * d), H = Math.round(innerHeight * d);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
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
function pickSide(s: { x: number; y: number; r: number }, ext: number): number {
  const score = (sd: number) => {
    let bad = 0;
    // sample across where a mark would sit: beside the head, out to its far edge, from cheek to above the head
    for (const fx of [0.2, 0.6, 1.0]) for (const dy of [-0.3, -0.9, -1.5]) {
      const x = s.x + sd * (s.r * 0.9 + ext * fx), y = s.y + s.r * dy;
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

/** A pop: a quick squash-and-stretch overshoot, then rest. */
function pop(t: number, calm: boolean): number {
  if (calm) return 1;
  if (t < 0.05) return 0.4 + (t / 0.05) * 0.9;
  if (t < 0.1) return 1.3 - ((t - 0.05) / 0.05) * 0.4;
  if (t < 0.16) return 0.9 + ((t - 0.1) / 0.06) * 0.16;
  if (t < 0.22) return 1.06 - ((t - 0.16) / 0.06) * 0.06;
  return 1;
}
/** fade out over the last `f` seconds */
const out = (t: number, dur: number, f = 0.2) => Math.max(0, Math.min(1, (dur - t) / f));
/** Draw a mark canvas centred at (x, y) CSS px, scaled (sx may flip it), faded. */
function put(c: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, sx = 1, sy = 1, alpha = 1) {
  if (alpha <= 0.01) return;
  const d = dprNow(), w = (img.width / d) * Math.abs(sx), h = (img.height / d) * sy;
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  if (sx < 0) c.scale(-1, 1);
  c.drawImage(img, -w / 2, -h / 2, w, h);
  c.restore();
}
/** a tapered stroke (motion lines, rays): thick at `a`, a point at `b` */
function taper(c: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2;
  c.beginPath(); c.moveTo(ax + nx, ay + ny); c.lineTo(bx, by); c.lineTo(ax - nx, ay - ny); c.arc(ax, ay, w / 2, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true); c.fill();
}

function draw(c: CanvasRenderingContext2D, l: Live, t: number, s: { x: number; y: number; r: number }, avoid: DOMRect[]) {
  const calm = l.calm;
  // everything below is in CSS px: the face's centre, its radius, and the marks' unit size (bold on a phone, in
  // proportion with a big face on a big screen)
  const X = s.x, Y = s.y, r = s.r;
  const u = Math.max(26, Math.min(84, r * 1.4));
  if (!l.side) l.side = pickSide(s, u * 1.1);
  const side = l.side;
  const fade = out(t, l.dur, calm ? 0.35 : 0.22);
  const a = fade;
  // a spot beside the head, nudged off any speech bubble
  const at = (dx: number, dy: number): [number, number] => {
    let x = X + dx, y = Y + dy;
    for (const b of avoid) if (x > b.left - u * 0.5 && x < b.right + u * 0.5 && y > b.top - u * 0.4 && y < b.bottom + u * 0.3) y = b.bottom + u * 0.45;
    return [x, y];
  };
  const bob = calm ? 0 : Math.sin(t * 9) * u * 0.02;
  const P = (tt: number) => pop(tt, calm);
  switch (l.kind) {
    case 'bang': case 'ask': {
      const img = markArt(l.kind, u), h = img.height / dprNow(), w = img.width / dprNow();
      const [x, y] = at(side * (r * 0.8 + w * 0.36), -r * 0.75 - h * 0.22);
      const hop = calm ? 0 : t < 0.2 ? -(1 - t / 0.2) * u * 0.18 : 0;
      const wob = l.kind === 'ask' && !calm ? Math.sin(t * 7) * u * 0.03 : 0;
      put(c, img, x + wob, y + hop + bob, P(t), P(t), a);
      // motion lines flicking on twos round the top
      if (!calm && t > 0.04 && t < 0.62 && Math.floor(t * 12) % 2 === 0) {
        c.fillStyle = LINE;
        const hh = h * 0.36, n = u * 0.2, th = Math.max(2, u * 0.06);
        for (const ang of [-2.5, -1.57, -0.64]) {
          const ca = Math.cos(ang), sa = Math.sin(ang);
          taper(c, x + wob + ca * (hh + 4), y + hop + sa * (hh + 4), x + wob + ca * (hh + 4 + n), y + hop + sa * (hh + 4 + n), th);
        }
      }
      break;
    }
    case 'sweat': {
      const slide = calm ? 0 : Math.min(1, t / 1.1) * u * 0.2;
      const [x, y] = at(side * (r * 0.85 + u * 0.3), -r * 0.5);
      put(c, markArt('sweat', u), x, y + slide, side * P(t), P(t), a);
      break;
    }
    case 'anger': {
      const [x, y] = at(side * (r * 0.7 + u * 0.32), -r * 0.65 - u * 0.2);
      const beat = calm ? 1 : t < 0.22 ? P(t) : 1 + 0.08 * (1 + Math.sin((t - 0.22) * 22)) ;
      put(c, markArt('anger', u), x, y, beat, beat, a);
      break;
    }
    case 'notes': {
      for (let i = 0; i < 3; i++) {
        const tt = t - i * 0.28;
        if (tt < 0) continue;
        const life = l.dur - 0.56, rise = Math.min(1, tt / life);
        const sway = calm ? 0 : Math.sin(tt * 6 + i) * u * 0.08;
        const tilt = calm ? 0 : Math.sin(tt * 5 + i) * 0.12;
        const [x, y] = at(side * (r * 0.8 + u * 0.35 + i * u * 0.22) + sway, -r * 0.25 - rise * u * 0.7 - i * u * 0.08);
        c.save(); c.translate(x, y); c.rotate(tilt);
        put(c, markArt('notes', u, (i + l.seed) % 4), 0, 0, P(tt), P(tt), Math.min(a, out(tt, life, 0.25)));
        c.restore();
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
        if (tt > 0.7 && !calm) continue;
        // a twinkle: grows in, flickers, shrinks away (and turns a little)
        const k = calm ? 1 : tt < 0.15 ? tt / 0.15 : tt > 0.5 ? Math.max(0, (0.7 - tt) / 0.2) : 1 - (Math.floor(tt * 16) % 3 === 0 ? 0.25 : 0);
        const [x, y] = at(Math.cos(ang) * dist, Math.sin(ang) * dist * 0.85);
        c.save(); c.translate(x, y); c.rotate(calm ? 0 : tt * 1.6);
        put(c, markArt('sparkle', u, ((i + l.seed) % 4) * 4 + 2), 0, 0, k, k, calm ? a : 1);
        c.restore();
      }
      break;
    }
    case 'hearts': {
      for (let i = 0; i < 3; i++) {
        const tt = t - i * 0.2;
        if (tt < 0) continue;
        const life = l.dur - 0.4, rise = Math.min(1, tt / life);
        const sway = calm ? 0 : Math.sin(tt * 5 + i * 2) * u * 0.07;
        const beat = calm ? 1 : tt < 0.22 ? P(tt) : 1 + 0.06 * Math.max(0, Math.sin(tt * 18));
        const [x, y] = at(side * (r * 0.45 + u * (0.3 + i * 0.36)) + sway, -r * 0.9 - u * (0.2 + i * 0.08) - rise * u * 0.55);
        put(c, markArt(i === 1 ? 'heartS' : 'hearts', u), x, y, beat, beat, Math.min(a, out(tt, life, 0.25)));
      }
      break;
    }
    case 'zzz': {
      const breathe = calm ? 1 : t < 0.22 ? P(t) : 1 + Math.sin(t * 3) * 0.03;
      const img = markArt('bubble', u), w = img.width / dprNow(), h = img.height / dprNow();
      const [x, y] = at(side * (r * 0.8 + w * 0.4), -r * 0.8 - h * 0.3);
      put(c, img, x, y, side * breathe, breathe, a);
      if (t > 0.15) {
        const bx = x - w / 2, by = y - h / 2;
        const zs: ['z' | 'zs', number, number, number][] = [['z', 0.44, 0.42, 0.25], ['zs', 0.63, 0.33, 0.55], ['zs', 0.77, 0.24, 0.85]];
        for (const [kind, zx, zy, tz] of zs) {
          if (t < tz) continue;
          const b = calm ? 0 : Math.sin((t - tz) * 6) * u * 0.03;
          const xx = side > 0 ? bx + zx * w : bx + (1 - zx) * w;
          put(c, markArt(kind, u), xx, by + zy * h + b, P(t - tz), P(t - tz), a);
        }
      }
      break;
    }
    case 'bulb': {
      const [x, y] = at(side * r * 0.3, -r * 1.0 - u * 0.65);
      const on = calm || t > 0.55 || Math.floor(t * 10) % 2 === 0;
      const img = markArt('bulb', u, on ? 0 : 1), h = img.height / dprNow();
      put(c, img, x, y, P(t), P(t), a);
      if (on && t > 0.1 && a > 0.3) {
        c.save(); c.globalAlpha = a; c.fillStyle = '#ffc93a';
        const r0 = h * 0.34 + (calm ? 0 : (Math.floor(t * 8) % 2) * u * 0.03), n = u * 0.18, th = Math.max(2, u * 0.07);
        for (const ang of [-2.6, -2.05, -1.57, -1.09, -0.54]) {
          const ca = Math.cos(ang), sa = Math.sin(ang), cy = y - h * 0.12;
          taper(c, x + ca * (r0 + n), cy + sa * (r0 + n), x + ca * r0, cy + sa * r0, th);
        }
        c.restore();
      }
      break;
    }
    case 'gloom': {
      const grow = calm ? 1 : Math.min(1, t / 0.45);
      const img = markArt('cloud', u), w = img.width / dprNow(), h = img.height / dprNow();
      const [x, y] = at(0, -r * 0.95 - u * 0.5);
      const drift = calm ? 0 : Math.sin(t * 2.4) * u * 0.03;
      put(c, img, x + drift, y, 1, 1, Math.min(a, calm ? 1 : Math.min(1, t / 0.12)));
      // the vertical gloom lines hang down from the cloud over the head, fading as they fall
      const rr = rng(l.seed), n = 7, span = w * 0.5, top = y + h * 0.22;
      for (let i = 0; i < n; i++) {
        const lx = x + drift - span / 2 + (i / (n - 1)) * span + (rr() - 0.5) * u * 0.05, len = (u * 0.3 + rr() * u * 0.35) * grow;
        const gr = c.createLinearGradient(lx, top, lx, top + len);
        gr.addColorStop(0, `rgba(77, 74, 126, ${0.95 * a})`); gr.addColorStop(1, 'rgba(77, 74, 126, 0)');
        c.fillStyle = gr; c.fillRect(lx - Math.max(1, u * 0.025), top, Math.max(2, u * 0.05), len);
      }
      break;
    }
    case 'steam': {
      for (let wave = 0; wave < 2; wave++) {
        const tt = t - wave * 0.32;
        if (tt < 0 || tt > 0.62) continue;
        const f = Math.min(3, Math.floor(tt / 0.16)), k = tt / 0.62;
        for (const sd of [-1, 1]) {
          const [x, y] = at(sd * (r * 1.05 + k * u * 0.4), -r * 0.35 - k * u * 0.25);
          put(c, markArt('steam', u, f), x, y, sd * (0.85 + k * 0.3), 0.85 + k * 0.3, calm ? a : Math.min(1, (1 - k) * 2.5));
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
