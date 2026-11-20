// The breathing overlay: 2D pixel art drawn on a low-resolution canvas scaled up crisp. A glowing
// ring breathes around the owl (dithered halo, not airbrush), motes orbit it, sparks drift in from
// the dark on the inhale and puff out like warm breath on the exhale, and taps leave starbursts.
import type { PhaseKind } from './session.ts';

const SCALE = 3;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

interface Mote { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; size: number; kind: 'in' | 'out' | 'spark' | 'star' }

const COL: Record<PhaseKind, [number, number, number]> = { in: [255, 214, 120], hold: [255, 244, 214], out: [168, 190, 255], rest: [255, 236, 200] };

export class BreathOverlay {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private motes: Mote[] = [];
  private col: [number, number, number] = [255, 214, 120];
  private spawnT = 0;
  private time = 0;
  private img: ImageData | null = null;

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'breath-canvas';
    parent.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(60, Math.round((r.width || innerWidth) / SCALE));
    this.h = Math.max(60, Math.round((r.height || innerHeight) / SCALE));
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.img = this.g.createImageData(this.w, this.h);
  }

  /** Starburst where the screen was tapped (CSS px). */
  burst(cssX: number, cssY: number) {
    const x = cssX / SCALE, y = cssY / SCALE;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, s = 8 + Math.random() * 22;
      this.motes.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, life: 0, max: 0.6 + Math.random() * 0.6, c: Math.random() < 0.5 ? '#fff4c8' : '#ffd36a', size: Math.random() < 0.25 ? 2 : 1, kind: 'spark' });
    }
    this.motes.push({ x, y, vx: 0, vy: -4, life: 0, max: 0.9, c: '#ffffff', size: 3, kind: 'star' });
  }

  /** cx, cy: the owl's chest on screen (CSS px). lung 0..1. */
  draw(dt: number, cx: number, cy: number, lung: number, phase: PhaseKind, intensity = 1) {
    this.time += dt;
    const g = this.g, W = this.w, H = this.h, img = this.img!;
    const d = img.data;
    d.fill(0);
    const ox = cx / SCALE, oy = cy / SCALE;
    // colour eases between phases
    const tc = COL[phase];
    for (let i = 0; i < 3; i++) this.col[i] += (tc[i] - this.col[i]) * Math.min(1, dt * 2.2);
    const [cr, cg, cb] = this.col;
    const add = (x: number, y: number, r: number, gg: number, b: number, a: number) => {
      if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return;
      const i = (y * W + x) * 4;
      d[i] = Math.min(255, d[i] + r * a); d[i + 1] = Math.min(255, d[i + 1] + gg * a); d[i + 2] = Math.min(255, d[i + 2] + b * a); d[i + 3] = Math.min(255, d[i + 3] + 255 * a);
    };

    // ---- the breathing ring: a crisp 2px band with a dithered halo inside and out
    const R0 = Math.min(W, H) * 0.16, R1 = Math.min(W, H) * 0.36;
    const R = R0 + (R1 - R0) * lung;
    const reach = 14;
    const x0 = Math.max(0, Math.floor(ox - R - reach)), x1 = Math.min(W - 1, Math.ceil(ox + R + reach));
    const y0 = Math.max(0, Math.floor(oy - R - reach)), y1 = Math.min(H - 1, Math.ceil(oy + R + reach));
    const shimmer = 0.85 + 0.15 * Math.sin(this.time * 2.3);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dd = Math.hypot(x + 0.5 - ox, (y + 0.5 - oy) * 1.04) - R;
      const ad = Math.abs(dd);
      let a = 0;
      if (ad < 1.6) a = 0.95;
      else {
        // halo: falls off with distance, quantised through an ordered dither so it stays pixel-crisp
        const fall = Math.max(0, 1 - ad / (dd < 0 ? reach * 1.2 : reach)) ** 2 * 0.7;
        a = fall > BAYER[(y & 3) * 4 + (x & 3)] * 0.9 ? Math.min(0.55, fall + 0.18) : 0;
      }
      if (a) add(x, y, cr, cg, cb, a * shimmer * intensity);
    }
    // soft inner glow pool (very sparse dither) that brightens on a full breath
    const pool = R * 0.85;
    for (let y = Math.max(0, Math.floor(oy - pool)); y < Math.min(H, oy + pool); y++) for (let x = Math.max(0, Math.floor(ox - pool)); x < Math.min(W, ox + pool); x++) {
      const k = 1 - Math.hypot(x - ox, y - oy) / pool;
      if (k > 0 && k * k * (0.12 + lung * 0.22) > BAYER[(y & 3) * 4 + (x & 3)]) add(x, y, cr, cg, cb, 0.22 * intensity);
    }

    // ---- motes orbiting on the ring
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + this.time * (0.18 + (i % 3) * 0.05) * (i % 2 ? 1 : -1);
      const rr = R + Math.sin(this.time * 1.7 + i * 2.1) * 2.5;
      const tw = 0.5 + 0.5 * Math.sin(this.time * 3 + i * 1.3);
      const x = Math.round(ox + Math.cos(a) * rr), y = Math.round(oy + Math.sin(a) * rr * 0.96);
      add(x, y, 255, 250, 225, 0.5 + tw * 0.5);
      if (i % 4 === 0 && tw > 0.7) { add(x + 1, y, 255, 240, 200, 0.5); add(x - 1, y, 255, 240, 200, 0.5); add(x, y + 1, 255, 240, 200, 0.5); add(x, y - 1, 255, 240, 200, 0.5); }
    }

    // ---- particle streams: drawn in from the dark on the inhale, puffed out on the exhale
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.035;
      if (phase === 'in') {
        const a = Math.random() * Math.PI * 2, dist = Math.max(W, H) * (0.45 + Math.random() * 0.25);
        const x = ox + Math.cos(a) * dist, y = oy + Math.sin(a) * dist;
        this.motes.push({ x, y, vx: 0, vy: 0, life: 0, max: 2.6, c: Math.random() < 0.3 ? '#ffffff' : '#ffe08a', size: Math.random() < 0.15 ? 2 : 1, kind: 'in' });
      } else if (phase === 'out' && lung > 0.08) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        this.motes.push({ x: ox + (Math.random() - 0.5) * 6, y: oy - 4, vx: Math.cos(a) * (10 + Math.random() * 18), vy: Math.sin(a) * (8 + Math.random() * 14) - 4, life: 0, max: 2 + Math.random(), c: Math.random() < 0.5 ? '#c8d4ff' : '#eef2ff', size: Math.random() < 0.2 ? 2 : 1, kind: 'out' });
      }
    }
    const keep: Mote[] = [];
    for (const m of this.motes) {
      m.life += dt;
      if (m.kind === 'in') {
        // spiral towards the owl, speeding up as they near
        const dx = ox - m.x, dy = oy - m.y, dist = Math.hypot(dx, dy);
        if (dist < R * 0.5) continue;
        const sp = 22 + (1 - Math.min(1, dist / (W * 0.6))) * 40;
        m.vx += ((dx / dist) * sp - dy / dist * 10 - m.vx) * Math.min(1, dt * 3);
        m.vy += ((dy / dist) * sp + dx / dist * 10 - m.vy) * Math.min(1, dt * 3);
      } else if (m.kind === 'out') { m.vx *= Math.exp(-dt * 0.8); m.vy = m.vy * Math.exp(-dt * 0.8) - dt * 3; }
      else { m.vx *= Math.exp(-dt * 3); m.vy = m.vy * Math.exp(-dt * 3) + dt * 6; }
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.life > m.max) continue;
      keep.push(m);
      const fade = Math.min(1, m.life / 0.25) * Math.min(1, (m.max - m.life) / 0.5);
      const rgb = parseInt(m.c.slice(1), 16), r = (rgb >> 16) & 255, gg = (rgb >> 8) & 255, b = rgb & 255;
      const x = Math.round(m.x), y = Math.round(m.y);
      if (m.kind === 'star') {
        const s = Math.round(3 + (1 - m.life / m.max) * 3);
        for (let k = -s; k <= s; k++) { add(x + k, y, r, gg, b, fade * (1 - Math.abs(k) / (s + 1))); add(x, y + k, r, gg, b, fade * (1 - Math.abs(k) / (s + 1))); }
        continue;
      }
      add(x, y, r, gg, b, fade);
      if (m.size > 1) { add(x + 1, y, r, gg, b, fade * 0.7); add(x, y + 1, r, gg, b, fade * 0.7); add(x + 1, y + 1, r, gg, b, fade * 0.5); }
      // tiny trail for the inbound stream
      if (m.kind === 'in') add(Math.round(m.x - m.vx * 0.03), Math.round(m.y - m.vy * 0.03), r, gg, b, fade * 0.35);
    }
    this.motes = keep.slice(-700);
    g.putImageData(img, 0, 0);
  }

  dispose() { this.canvas.remove(); }
}
