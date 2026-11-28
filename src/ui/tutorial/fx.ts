// [tutor] The tour's light, painted smooth on one overlay canvas each frame at the screen's resolution:
//   a soft warm spotlight (the room only dusks a little; the thing Pip shows sits in a pool of lamplight),
//   a glowing ring of honey-gold light round it that breathes, with a bright glint travelling round it, a stream of
//   soft golden motes flowing from Pip's wing to it, fireflies drifting about and gathering round the light, Pip's soft
//   shadow where he stands, and the reward's burst of golden light.
import type { Rect } from './layout.ts';

export interface FxFrame {
  t: number; dt: number; dpr: number; px: number; W: number; H: number;
  /** the lit thing (null: none) and how lit the room is (0 day..1 dusk) */
  spot: Rect | null; round: boolean; dusk: number;
  ring: boolean;
  /** a tap somewhere else: the ring pulses (seconds since) */
  pulse: number;
  trail: { from: { x: number; y: number }; to: { x: number; y: number } } | null;
  shadow: { x: number; y: number; w: number } | null;
  /** the reward's rays (seconds since, and where) */
  burst: { x: number; y: number; age: number } | null;
}

interface Fly { x: number; y: number; vx: number; vy: number; ph: number; sp: number }
const flies: Fly[] = [];
let lastW = 0;

function star(g: CanvasRenderingContext2D, x: number, y: number, c: number, a: number, big: boolean) {
  const r = (big ? 9 : 6) * Math.max(1, c * 0.5);
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.max(0, Math.min(1, a));
  const gl = g.createRadialGradient(x, y, 0, x, y, r); gl.addColorStop(0, 'rgba(255,248,220,0.95)'); gl.addColorStop(0.25, 'rgba(255,214,130,0.45)'); gl.addColorStop(1, 'rgba(255,200,110,0)');
  g.fillStyle = gl; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,250,230,0.9)';
  for (const [w, h] of [[r * 1.6, r * 0.12], [r * 0.12, r * 1.6]]) { g.beginPath(); g.ellipse(x, y, w, h, 0, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

export function paintFx(g: CanvasRenderingContext2D, f: FxFrame) {
  const { W, H, dpr, t } = f;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, W, H);
  const c = Math.max(2, Math.round(f.px * 2 * dpr) / dpr); // one ring pixel, in CSS px (whole device px)
  const s = f.spot;
  const cx = s ? s.x + s.w / 2 : W / 2, cy = s ? s.y + s.h / 2 : H / 2;

  // ---- the dusk and the pool of lamplight
  if (f.dusk > 0.01) {
    g.fillStyle = `rgba(24, 12, 30, ${0.3 * f.dusk})`;
    g.fillRect(0, 0, W, H);
    if (s) {
      const R = Math.max(s.w, s.h) * 0.5 + 46;
      g.save();
      g.translate(cx, cy);
      g.scale(Math.max(1, s.w / s.h) ** 0.35, Math.max(1, s.h / s.w) ** 0.35);
      g.globalCompositeOperation = 'destination-out';
      const hole = g.createRadialGradient(0, 0, R * 0.55, 0, 0, R * 1.25);
      hole.addColorStop(0, `rgba(0,0,0,${f.dusk})`); hole.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = hole; g.fillRect(-R * 2, -R * 2, R * 4, R * 4);
      g.globalCompositeOperation = 'lighter';
      const k = 0.5 + 0.5 * Math.sin(t * 2.1);
      const warm = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.3);
      warm.addColorStop(0, `rgba(255, 176, 84, ${(0.1 + 0.04 * k) * f.dusk})`); warm.addColorStop(0.6, `rgba(255, 150, 60, ${0.05 * f.dusk})`); warm.addColorStop(1, 'rgba(255, 140, 50, 0)');
      g.fillStyle = warm; g.fillRect(-R * 2, -R * 2, R * 4, R * 4);
      g.restore();
    }
  }

  // ---- a soft warm glow behind the thing to tap: no line round it, just light that breathes
  if (s && f.ring) {
    const breathe = 0.5 + 0.5 * Math.sin(t * 2.2), p0 = Math.max(0, 1 - f.pulse * 2.5);
    const R = Math.max(s.w, s.h) * 0.75 + 26 + breathe * 8 + p0 * 14;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.translate(cx, cy); g.scale(Math.max(1, s.w / s.h) ** 0.3, Math.max(1, s.h / s.w) ** 0.3);
    const glow = g.createRadialGradient(0, 0, 0, 0, 0, R);
    glow.addColorStop(0, `rgba(255, 214, 140, ${0.22 + breathe * 0.1 + p0 * 0.15})`); glow.addColorStop(0.55, `rgba(255, 180, 90, ${0.1 + breathe * 0.05})`); glow.addColorStop(1, 'rgba(255, 170, 80, 0)');
    g.fillStyle = glow; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    g.restore();
    // two soft glints drifting round it
    const a = (t * 0.8) % (Math.PI * 2), hx = s.w / 2 + 12, hy = s.h / 2 + 12;
    star(g, cx + Math.cos(a) * hx, cy + Math.sin(a) * hy, 1.5, 0.75, true);
    star(g, cx + Math.cos(a + 2.6) * hx, cy + Math.sin(a + 2.6) * hy, 1.2, 0.45, false);
  }

  // ---- the sparkle trail from Pip to it
  if (f.trail) {
    const { from: a, to: b } = f.trail;
    const mx = (a.x + b.x) / 2, my = Math.min(a.y, b.y) - Math.min(80, Math.hypot(b.x - a.x, b.y - a.y) * 0.25);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(3, Math.floor(len / 18));
    const flow = (t * 1.4) % 1;
    for (let i = 0; i < n; i++) {
      const u = (i + flow) / n;
      if (u < 0.08 || u > 0.94) continue;
      const v = 1 - u, x = v * v * a.x + 2 * v * u * mx + u * u * b.x, y = v * v * a.y + 2 * v * u * my + u * u * b.y;
      const fade = Math.min(1, (u - 0.08) * 6, (0.94 - u) * 6);
      const tw = 0.55 + 0.45 * Math.sin(t * 9 + i * 2.3);
      const sx = x, sy = y;
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, c * 4);
      glow.addColorStop(0, `rgba(255, 214, 120, ${0.35 * fade})`); glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = glow; g.fillRect(sx - c * 4, sy - c * 4, c * 8, c * 8);
      g.globalCompositeOperation = 'source-over';
      star(g, sx, sy, 1.5, fade * tw, i % 3 === 0);
    }
  }

  // ---- Pip's shadow where he stands
  if (f.shadow) {
    const { x, y, w } = f.shadow;
    const sh = g.createRadialGradient(x, y, 0, x, y, w / 2);
    sh.addColorStop(0, 'rgba(26, 12, 22, 0.32)'); sh.addColorStop(1, 'rgba(26, 12, 22, 0)');
    g.save(); g.translate(x, y); g.scale(1, 0.28); g.translate(-x, -y);
    g.fillStyle = sh; g.fillRect(x - w / 2, y - w / 2, w, w);
    g.restore();
  }

  // ---- fireflies: wander, drift towards the light, blink
  if (!flies.length || Math.abs(lastW - W) > 200) {
    flies.length = 0;
    for (let i = 0; i < 11; i++) flies.push({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, ph: Math.random() * 6.3, sp: 0.6 + Math.random() * 0.8 });
    lastW = W;
  }
  const dt = Math.min(0.05, f.dt);
  flies.forEach((fl, i) => {
    const near = i < 6 && s;
    const gx = near ? cx + Math.cos(t * 0.5 * fl.sp + i * 1.9) * (s!.w / 2 + 40) : W * (0.5 + 0.45 * Math.sin(t * 0.07 * fl.sp + i * 2.4));
    const gy = near ? cy + Math.sin(t * 0.7 * fl.sp + i * 1.3) * (s!.h / 2 + 34) : H * (0.5 + 0.42 * Math.cos(t * 0.05 * fl.sp + i * 1.1));
    fl.vx += ((gx - fl.x) * 0.9 + Math.sin(t * 1.7 + fl.ph) * 30 - fl.vx * 1.6) * dt;
    fl.vy += ((gy - fl.y) * 0.9 + Math.cos(t * 1.3 + fl.ph * 1.3) * 30 - fl.vy * 1.6) * dt;
    fl.x += fl.vx * dt; fl.y += fl.vy * dt;
    const a = Math.max(0, Math.sin(t * (1.3 + fl.sp) + fl.ph)) ** 1.5;
    if (a < 0.04) return;
    const sx = fl.x, sy = fl.y;
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(sx, sy, 0, sx, sy, 14);
    gl.addColorStop(0, `rgba(240, 255, 170, ${0.55 * a})`); gl.addColorStop(0.2, `rgba(220, 255, 130, ${0.3 * a})`); gl.addColorStop(1, 'rgba(200, 240, 100, 0)');
    g.fillStyle = gl; g.beginPath(); g.arc(sx, sy, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(250, 255, 220, ${a})`; g.beginPath(); g.arc(sx, sy, 1.8, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  });

  // ---- the reward: rays of golden light and a soft halo
  if (f.burst && f.burst.age < 1.4) {
    const { x, y, age } = f.burst;
    const k = age / 1.4;
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(x, y, 0, x, y, 60 + 160 * k);
    halo.addColorStop(0, `rgba(255, 220, 120, ${0.5 * (1 - k)})`); halo.addColorStop(1, 'rgba(255, 190, 80, 0)');
    g.fillStyle = halo; g.fillRect(x - 240, y - 240, 480, 480);
    // soft golden rays fanning out
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + 0.2, r0 = 24 + 150 * k ** 0.7, len = (i % 2 ? 40 : 70) * (1 - k);
      const x0 = x + Math.cos(ang) * r0, y0 = y + Math.sin(ang) * r0, x1 = x + Math.cos(ang) * (r0 + len), y1 = y + Math.sin(ang) * (r0 + len);
      const ray = g.createLinearGradient(x0, y0, x1, y1);
      ray.addColorStop(0, `rgba(255, 250, 225, ${0.9 * (1 - k)})`); ray.addColorStop(1, 'rgba(255, 200, 100, 0)');
      g.strokeStyle = ray; g.lineWidth = (i % 2 ? 2 : 3.5) * (1 - k * 0.5); g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
  }
}
