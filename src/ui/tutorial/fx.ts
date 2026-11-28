// [tutor] The tour's light, painted on one overlay canvas each frame at the screen's resolution:
//   a soft warm spotlight (the room only dusks a little; the thing Pip shows sits in a pool of lamplight),
//   a pixel-art ring round it in honey gold (two tones and an ink edge, whole art pixels) that breathes, with a glint
//   running round it and twinkling corner stars, a trail of pixel sparkles flowing from Pip's wing to it,
//   pixel fireflies drifting about the screen and gathering round the light, Pip's soft shadow where he stands,
//   and the reward's burst of golden pixel rays.
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

const RING = { hi: '#fff3c0', mid: '#ffcc55', lo: '#e08a2c', deep: '#a8501c', ink: 'rgba(58, 22, 10, 0.75)' };

interface Fly { x: number; y: number; vx: number; vy: number; ph: number; sp: number }
const flies: Fly[] = [];
let lastW = 0;

/** a rounded box's signed distance */
function sdBox(px: number, py: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(px) - hx + r, qy = Math.abs(py) - hy + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function star(g: CanvasRenderingContext2D, x: number, y: number, c: number, a: number, big: boolean) {
  g.globalAlpha = a;
  g.fillStyle = RING.hi;
  g.fillRect(x - c / 2, y - c / 2, c, c);
  g.fillStyle = RING.mid;
  const l = big ? 2 : 1;
  for (let i = 1; i <= l; i++) {
    g.globalAlpha = a * (i === 1 ? 0.9 : 0.5);
    g.fillRect(x - c / 2 + i * c, y - c / 2, c, c); g.fillRect(x - c / 2 - i * c, y - c / 2, c, c);
    g.fillRect(x - c / 2, y - c / 2 + i * c, c, c); g.fillRect(x - c / 2, y - c / 2 - i * c, c, c);
  }
  g.globalAlpha = 1;
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

  // ---- the pixel ring
  if (s && f.ring) {
    const p0 = Math.max(0, 1 - f.pulse / 0.6);
    const breathe = 0.5 + 0.5 * Math.sin(t * 3.2);
    const pad = 5 + Math.round(breathe * 2 + p0 * 6) * c * 0.5;
    const hx = s.w / 2 + pad, hy = s.h / 2 + pad;
    const r = f.round ? Math.min(hx, hy) : Math.min(16, Math.min(hx, hy));
    const ox = cx, oy = cy;
    const x0 = Math.floor((ox - hx - 3 * c) / c) * c, x1 = ox + hx + 3 * c, y0 = Math.floor((oy - hy - 3 * c) / c) * c, y1 = oy + hy + 3 * c;
    const glint = (t * 0.45) % 1;
    for (let y = y0; y < y1; y += c) {
      for (let x = x0; x < x1; x += c) {
        const px = x + c / 2 - ox, py = y + c / 2 - oy;
        const d = sdBox(px, py, hx, hy, r);
        if (d < -c || d >= c * 2) continue;
        if (d >= c) { g.fillStyle = RING.ink; g.globalAlpha = 0.55; g.fillRect(x, y, c, c); continue; }
        // lit from the upper left; a glint travels round
        const ang = Math.atan2(py, px), lit = -Math.cos(ang + Math.PI * 0.25);
        const u = ((ang / (Math.PI * 2) + 1) % 1), gl = Math.max(0, 1 - Math.abs(((u - glint + 1.5) % 1) - 0.5) * 14);
        g.globalAlpha = 0.82 + 0.18 * breathe;
        // two rows: the outer one catches the light, the inner one is a step darker (a little bevel)
        const tone = (lit > 0.35 ? 2 : lit < -0.35 ? 0 : 1) - (d < 0 ? 1 : 0);
        g.fillStyle = gl > 0.3 && d >= 0 ? '#ffffff' : tone >= 2 ? RING.hi : tone === 1 ? RING.mid : tone === 0 ? RING.lo : RING.deep;
        g.fillRect(x, y, c, c);
      }
    }
    g.globalAlpha = 1;
    // corner stars, twinkling in turn
    const corners: [number, number][] = [[ox - hx - c, oy - hy - c], [ox + hx + c, oy - hy - c], [ox + hx + c, oy + hy + c], [ox - hx - c, oy + hy + c]];
    corners.forEach(([x, y], i) => {
      const a = Math.max(0, Math.sin(t * 2.4 + i * 1.7));
      if (a > 0.1) star(g, Math.round(x / c) * c, Math.round(y / c) * c, c, a, a > 0.8);
    });
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
      const sx = Math.round(x / c) * c, sy = Math.round(y / c) * c;
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, c * 4);
      glow.addColorStop(0, `rgba(255, 214, 120, ${0.35 * fade})`); glow.addColorStop(1, 'rgba(255, 200, 90, 0)');
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = glow; g.fillRect(sx - c * 4, sy - c * 4, c * 8, c * 8);
      g.globalCompositeOperation = 'source-over';
      star(g, sx, sy, c * 0.5 + 0.5, fade * tw, i % 3 === 0);
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
    const sx = Math.round(fl.x / c) * c, sy = Math.round(fl.y / c) * c;
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(sx, sy, 0, sx, sy, c * 5);
    gl.addColorStop(0, `rgba(220, 255, 130, ${0.42 * a})`); gl.addColorStop(1, 'rgba(200, 240, 100, 0)');
    g.fillStyle = gl; g.fillRect(sx - c * 5, sy - c * 5, c * 10, c * 10);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = a;
    g.fillStyle = '#f6ffc8'; g.fillRect(sx - c / 2, sy - c / 2, c, c);
    g.fillStyle = '#c8f070'; g.globalAlpha = a * 0.6;
    g.fillRect(sx - c / 2 - c, sy - c / 2, c, c); g.fillRect(sx + c / 2, sy - c / 2, c, c);
    g.globalAlpha = 1;
  });

  // ---- the reward: rays of golden pixels and a ring of light
  if (f.burst && f.burst.age < 1.4) {
    const { x, y, age } = f.burst;
    const k = age / 1.4;
    g.globalCompositeOperation = 'lighter';
    const halo = g.createRadialGradient(x, y, 0, x, y, 60 + 160 * k);
    halo.addColorStop(0, `rgba(255, 220, 120, ${0.5 * (1 - k)})`); halo.addColorStop(1, 'rgba(255, 190, 80, 0)');
    g.fillStyle = halo; g.fillRect(x - 240, y - 240, 480, 480);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + 0.2;
      const r0 = 20 + 150 * k ** 0.7, len = (i % 2 ? 4 : 7) * (1 - k);
      for (let j = 0; j < len; j++) {
        const rr = r0 + j * c * 1.2;
        const px = Math.round((x + Math.cos(ang) * rr) / c) * c, py = Math.round((y + Math.sin(ang) * rr) / c) * c;
        g.globalAlpha = (1 - k) * (1 - j / Math.max(1, len));
        g.fillStyle = j === 0 ? '#ffffff' : j < 3 ? RING.hi : RING.mid;
        g.fillRect(px - c / 2, py - c / 2, c, c);
      }
    }
    g.globalAlpha = 1;
  }
}
