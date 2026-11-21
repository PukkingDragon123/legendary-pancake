// Simple ink-dot eyes, the way the toy line paints its faces (art/blender/lib/face.py): two small solid ink
// dots, a little uneven in size and shape (never a matched pair), no whites, no iris, no catchlight. Each eye is
// a tiny pixel canvas drawn onto a decal patch cut from the owl's own head facets (eye_l / eye_r in the GLB), so
// the dots sit right on the painted face and still blink and emote:
//   normal  a dot (it squashes as the lid comes down, rides up into a crescent when the cheeks lift)
//   closed  a soft downward arc (asleep, calm)       happy   a ^ arc
//   heart   a little pixel heart                      star / sparkle  a pixel star
//   spiral  a dizzy spiral                            wide    a bigger, rounder dot
// plus a tear drop, and lash ticks for Queen Neve. Everything is drawn texel by texel with hard pixel edges.
import * as THREE from 'three';

export type EyeMode = 'normal' | 'happy' | 'closed' | 'heart' | 'star' | 'spiral' | 'sparkle' | 'wide';

export interface EyeState {
  /** 0 = fully open, 1 = closed */
  lid: number;
  /** 0..1 the cheeks lifting under the eye (smiling, sleepy) */
  low: number;
  /** -1..1 lid slant: + grumpy (inner corner down), - worried (inner corner up) */
  tilt: number;
  /** glance direction -1..1: the dot drifts a little toward it */
  lx: number;
  ly: number;
  /** 2.5..8 (5 = normal): the dot grows a touch in the dark and when delighted */
  pupil: number;
  mode: EyeMode;
  tear: boolean;
  /** 0..1 a quick squint (the old nictitating blink) */
  nict?: number;
}

export const defaultEye = (): EyeState => ({ lid: 0, low: 0, tilt: 0, lx: 0, ly: 0, pupil: 5, mode: 'normal', tear: false, nict: 0 });

/** Canvas texels per eye (the decal patch spans the whole canvas). */
export const EYE_N = 96;
const N = EYE_N;
const C = (N - 1) / 2;
/** The dot's radius as a share of the half patch (the GLB's patch is 2.1 dot radii across each way). */
export const DOT_SHARE = 1 / 2.1;
/** Legacy: the old eye plane's size factor (kept for callers that size planes from it). */
export const EYE_PLANE = 2.1;

export interface EyeColours {
  /** the ink */
  ink: string;
  /** a heart's colour */
  heart?: string;
  /** a star's colour */
  star?: string;
  /** lash ticks (Queen Neve) */
  lashes?: boolean;
  /** emissive (celestial: little gold lights) */
  glow?: boolean;
  /** legacy fields (old callers pass them; ignored) */
  iris?: string; lid?: string; rim?: string; slit?: boolean; style?: string;
}

const hex = (s: string) => parseInt(s.replace('#', ''), 16);

/** A small seeded random (each eye its own wobble). */
function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; };
}

export class Eye {
  readonly canvas: HTMLCanvasElement;
  readonly tex: THREE.CanvasTexture;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private key = '';
  private cols!: EyeColours;
  private ink = 0x231f1b;
  /** this eye's own wobble: a lumpy outline and a slightly different size from its twin */
  private wob: number[];
  private size: number;

  /** side: -1 for the eye at -x, +1 for the eye at +x */
  constructor(private side: number, cols: EyeColours, seed = 7) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = N; this.canvas.height = N;
    this.ctx = this.canvas.getContext('2d')!;
    this.img = this.ctx.createImageData(N, N);
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.tex.flipY = false; // (the decals' UVs come from glTF: v runs down the patch)
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const r = rnd(seed * 31 + (side > 0 ? 17 : 5));
    this.wob = [r() * 6.28, r() * 6.28, r() * 6.28, 0.05 + r() * 0.04, 0.03 + r() * 0.03, 0.02 + r() * 0.02];
    // never a matched pair: one dot a touch smaller and rounder
    this.size = side > 0 ? 0.93 + r() * 0.03 : 1.0;
    this.setColours(cols);
  }

  setColours(cols: EyeColours) {
    this.cols = cols;
    this.ink = hex(cols.ink ?? '#231f1b');
    this.key = '';
  }

  get glow() { return !!this.cols.glow; }

  draw(s: EyeState): boolean {
    const q = (v: number, k: number) => Math.round(v * k);
    const nict = s.nict ?? 0;
    const key = [q(s.lid, 24), q(s.low, 16), q(s.tilt, 8), q(s.lx, 10), q(s.ly, 10), q(s.pupil, 4), s.mode, s.tear ? 1 : 0, q(nict, 8)].join(',');
    if (key === this.key) return false;
    this.key = key;
    const d = this.img.data;
    d.fill(0);
    const put = (x: number, y: number, c: number) => {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      const i = (y * N + x) * 4;
      d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 255;
    };
    const ink = this.ink;
    const R0 = C * DOT_SHARE * this.size;
    const inner = -this.side; // +1 when the inner corner is toward +x on this canvas (canvas x runs with the owl's x)
    const [p0, p1, p2, a1, a2, a3] = this.wob;
    const lump = (th: number) => 1 + a1 * Math.sin(2 * th + p0) + a2 * Math.sin(3 * th + p1) + a3 * Math.sin(5 * th + p2);
    // canvas y runs down; the patch's v runs up: draw with y up (flip at put)
    const P = (x: number, y: number, c: number) => put(C + x, C - y, c);
    /** a thick stroke along a polyline (brush-like: square-ish pixel nib) */
    const stroke = (pts: [number, number][], w: number, c: number) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
          // taper toward the ends of the whole stroke
          const g = (i + t) / (pts.length - 1), ww = w * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, Math.max(0, g))));
          const r = ww / 2;
          for (let yy = Math.floor(y - r); yy <= Math.ceil(y + r); yy++) for (let xx = Math.floor(x - r); xx <= Math.ceil(x + r); xx++) {
            if ((xx - x) ** 2 + (yy - y) ** 2 <= r * r) P(xx, yy, c);
          }
        }
      }
    };
    const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1_: number, n = 14) => {
      const pts: [number, number][] = [];
      for (let i = 0; i <= n; i++) { const a = a0 + (a1_ - a0) * (i / n); pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
      return pts;
    };

    let mode = s.mode;
    let lid = Math.max(s.lid, nict * 0.55);
    if (mode === 'wide') lid = Math.min(lid, 0.02);
    // a blink closes even a heart or a star for a moment
    if (lid > 0.86 && (mode === 'normal' || mode === 'wide' || mode === 'sparkle')) mode = 'closed';
    const W = R0 * 0.62; // stroke weight of the arcs

    if (mode === 'normal' || mode === 'wide') {
      const grow = mode === 'wide' ? 1.22 : 0.92 + (s.pupil - 5) * 0.035;
      const rx = R0 * grow, ry0 = R0 * grow * 1.06;
      // the lid squashes the dot from the top (slanted by tilt); the cheeks push up from below
      const ox = s.lx * R0 * 0.22, oy = s.ly * R0 * 0.18 - lid * R0 * 0.35;
      const ry = ry0 * (1 - lid * 0.78);
      const low = s.low;
      for (let y = -Math.ceil(R0 * 1.6); y <= Math.ceil(R0 * 1.6); y++) for (let x = -Math.ceil(R0 * 1.6); x <= Math.ceil(R0 * 1.6); x++) {
        const dx = x - ox, dy = y - oy;
        const th = Math.atan2(dy / ry, dx / rx);
        const rr = lump(th);
        if ((dx / rx) ** 2 + (dy / ry) ** 2 > rr * rr) continue;
        // the slant of the lid: a straight cut across the top
        const cut = ry * (1 - lid * 0.25) - s.tilt * (dx * inner) * 0.35 * Math.min(1, lid * 3 + Math.abs(s.tilt) * 0.6);
        if (dy > cut) continue;
        // smiling cheeks: a round bite out of the bottom
        if (low > 0.05) {
          const by = oy - ry * (1.95 - low * 1.1), br = ry * 1.25;
          if (dx * dx + (dy - by) ** 2 < br * br) continue;
        }
        P(x, y, ink);
      }
    } else if (mode === 'closed') {
      // a gentle downward arc: asleep, or the bottom of a blink
      stroke(arc(0, R0 * 0.35, R0 * 1.05, R0 * 0.62, Math.PI * 1.08, Math.PI * 1.92), W, ink);
    } else if (mode === 'happy') {
      stroke(arc(0, -R0 * 0.45, R0 * 1.0, R0 * 0.95, Math.PI * 0.08, Math.PI * 0.92), W, ink);
    } else if (mode === 'heart') {
      const c = hex(this.cols.heart ?? '#a85a62');
      const k = R0 * 1.15;
      for (let y = -Math.ceil(k * 1.4); y <= Math.ceil(k * 1.4); y++) for (let x = -Math.ceil(k * 1.4); x <= Math.ceil(k * 1.4); x++) {
        const u = x / k, v = y / k + 0.1;
        // the classic implicit heart (pixel-tested)
        const f = (u * u + v * v - 1) ** 3 - u * u * v * v * v;
        if (f <= 0) P(x, y, c);
      }
      // an ink outline along the heart's edge for weight
      for (let y = -Math.ceil(k * 1.5); y <= Math.ceil(k * 1.5); y++) for (let x = -Math.ceil(k * 1.5); x <= Math.ceil(k * 1.5); x++) {
        const u = x / k, v = y / k + 0.1;
        const f = (u * u + v * v - 1) ** 3 - u * u * v * v * v;
        if (f > 0 && f < 0.16 && v < 0.9) P(x, y, ink);
      }
    } else if (mode === 'star' || mode === 'sparkle') {
      const c = mode === 'star' ? hex(this.cols.star ?? '#d8b45c') : ink;
      const ro = R0 * (mode === 'star' ? 1.35 : 1.2), ri = ro * 0.46;
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5; const r = i % 2 ? ri : ro; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      for (let y = -Math.ceil(ro); y <= Math.ceil(ro); y++) for (let x = -Math.ceil(ro); x <= Math.ceil(ro); x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) P(x, y, c);
      }
    } else if (mode === 'spiral') {
      const pts: [number, number][] = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, a = t * Math.PI * 4.2 * inner, r = R0 * (0.12 + 1.0 * t); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      stroke(pts, W * 0.7, ink);
    }

    // Queen Neve: three lash ticks flicking out from the outer top of each eye
    if (this.cols.lashes && mode !== 'heart' && mode !== 'star' && mode !== 'spiral') {
      const out = -inner;
      const top = mode === 'closed' ? R0 * 0.0 : mode === 'happy' ? R0 * 0.5 : R0 * (1.0 - lid * 0.8);
      for (let i = 0; i < 3; i++) {
        const a = 0.35 + i * 0.32;
        const x0 = out * R0 * (0.35 + i * 0.28), y0 = top - i * R0 * 0.12;
        stroke([[x0, y0], [x0 + out * Math.cos(a) * R0 * 0.55, y0 + Math.sin(a) * R0 * 0.55 + R0 * 0.1]], R0 * 0.26, ink);
      }
    }
    if (s.tear) {
      const c = 0x86a9b0, cx = inner * R0 * 0.5, cy = -R0 * 1.4;
      for (let y = -6; y <= 6; y++) for (let x = -4; x <= 4; x++) {
        const v = y / (R0 * 0.45), u = x / (R0 * 0.3);
        if (u * u + Math.max(0, v) ** 2 <= 1 && (v <= 0 || Math.abs(u) <= 1 - v * 0.9)) P(cx + x, cy + y, c);
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
    this.tex.needsUpdate = true;
    return true;
  }
}
