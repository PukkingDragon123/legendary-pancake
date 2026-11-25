// A window onto the night (the bedtime nightstand) and onto the dawn (the morning), painted smooth at device
// resolution: an oak casement with mullions and a sill, velvet curtains tied back, deep blue sky with twinkling
// stars and the real moon phase, a soft glow round the moon, layered forest hills, drifting fireflies; at dawn
// rose and gold bands, a rising sun and mist.
import { texCanvas } from './tex.ts';

const pats = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasPattern | null>>();
function pat(g: CanvasRenderingContext2D, n: 'oak' | 'walnut' | 'velvet', size: number, tint?: string): CanvasPattern | string {
  let m = pats.get(g);
  if (!m) { m = new Map(); pats.set(g, m); }
  const key = n + (tint ?? '');
  let p = m.get(key);
  const c = texCanvas(n, tint);
  if (p === undefined) { p = c ? g.createPattern(c, 'repeat') : null; m.set(key, p); }
  if (!p || !c) return n === 'velvet' ? '#4a2450' : '#8a5a30';
  p.setTransform(new DOMMatrix().scale(size / c.width));
  return p;
}
const hash = (i: number, k: number) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

/**
 * Paint the window, `W` x `H` CSS px (the context is already scaled to CSS px). `t` seconds (twinkle),
 * `phase` moon phase 0..1 (0 new, 0.5 full), `dim` darkens the room light, `dawn` 0..1 turns the sky to morning.
 */
export function paintWindow(g: CanvasRenderingContext2D, W: number, H: number, t: number, o: { phase?: number; dim?: number; dawn?: number } = {}) {
  const dawn = o.dawn ?? 0, fr = Math.max(8, Math.min(14, H * 0.08)), cur = Math.min(W * 0.17, 70);
  const gx0 = cur * 0.7, gx1 = W - cur * 0.7, gy0 = 6, gy1 = H - fr * 1.2;
  g.clearRect(0, 0, W, H);
  // the sky
  const sky = g.createLinearGradient(0, gy0, 0, gy1);
  if (dawn > 0) {
    sky.addColorStop(0, mixc('#0e1638', '#6c86c8', dawn)); sky.addColorStop(0.55, mixc('#1c2a5a', '#f2a28a', dawn)); sky.addColorStop(1, mixc('#2e4272', '#ffd89a', dawn));
  } else { sky.addColorStop(0, '#0a1230'); sky.addColorStop(0.6, '#18285a'); sky.addColorStop(1, '#2a4274'); }
  g.fillStyle = sky; g.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
  g.save(); g.beginPath(); g.rect(gx0, gy0, gx1 - gx0, gy1 - gy0); g.clip();
  // stars
  const ns = Math.round((gx1 - gx0) * (gy1 - gy0) / 260);
  for (let i = 0; i < ns; i++) {
    const x = gx0 + hash(i, 1) * (gx1 - gx0), y = gy0 + hash(i, 2) * (gy1 - gy0) * 0.75, b = hash(i, 3);
    const tw = 0.55 + 0.45 * Math.sin(t * (1.5 + b * 3) + i);
    g.globalAlpha = (1 - dawn) * tw * (0.4 + b * 0.6);
    g.fillStyle = b > 0.8 ? '#fff4d0' : '#e8eeff';
    g.beginPath(); g.arc(x, y, 0.5 + b * 1.1, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  // the moon (or the sun at dawn)
  const mx = gx0 + (gx1 - gx0) * 0.72, my = gy0 + (gy1 - gy0) * (dawn > 0 ? 0.9 - dawn * 0.45 : 0.3), mr = Math.min(18, H * 0.11);
  const halo = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4);
  halo.addColorStop(0, dawn > 0 ? 'rgba(255,220,150,.6)' : 'rgba(200,215,255,.35)'); halo.addColorStop(1, 'rgba(200,215,255,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(mx, my, mr * 4, 0, Math.PI * 2); g.fill();
  if (dawn > 0) { g.fillStyle = '#fff2c4'; g.beginPath(); g.arc(mx, my, mr * 1.2, 0, Math.PI * 2); g.fill(); }
  else {
    const ph = o.phase ?? 0.5, lit = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
    lit.addColorStop(0, '#fffbea'); lit.addColorStop(1, '#e8dcb8');
    g.fillStyle = lit; g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(180,170,140,.35)';
    for (const [dx, dy, r] of [[-0.3, -0.2, 0.22], [0.25, 0.25, 0.16], [0.1, -0.4, 0.1]]) { g.beginPath(); g.arc(mx + dx * mr, my + dy * mr, r * mr, 0, Math.PI * 2); g.fill(); }
    moonShade(g, mx, my, mr, o.phase ?? 0.5);
  }
  // layered hills with tree tops
  for (let L = 0; L < 3; L++) {
    const base = gy1 - (gy1 - gy0) * (0.3 - L * 0.09), col = dawn > 0 ? ['#4a4a6a', '#3a3a58', '#2a2a44'][L] : ['#16224a', '#101a3a', '#0a1028'][L];
    g.fillStyle = col; g.beginPath(); g.moveTo(gx0, gy1);
    for (let x = gx0; x <= gx1 + 6; x += 5) {
      const n = Math.sin(x * 0.02 + L * 2) * 6 + Math.sin(x * 0.07 + L) * 3;
      const tree = Math.max(0, Math.sin(x * (0.22 + L * 0.05) + L * 1.7)) ** 3 * (8 + L * 4);
      g.lineTo(x, base + n - tree);
    }
    g.lineTo(gx1, gy1); g.closePath(); g.fill();
  }
  if (dawn > 0) { const mist = g.createLinearGradient(0, gy1 - 30, 0, gy1); mist.addColorStop(0, 'rgba(255,240,230,0)'); mist.addColorStop(1, `rgba(255,236,220,${0.5 * dawn})`); g.fillStyle = mist; g.fillRect(gx0, gy1 - 30, gx1 - gx0, 30); }
  // fireflies
  if (dawn < 0.5) for (let i = 0; i < 6; i++) {
    const x = gx0 + (gx1 - gx0) * (0.1 + hash(i, 7) * 0.8) + Math.sin(t * 0.7 + i) * 10, y = gy1 - 14 - hash(i, 8) * 30 + Math.cos(t * 0.9 + i * 2) * 5;
    const a = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
    const gr = g.createRadialGradient(x, y, 0, x, y, 6); gr.addColorStop(0, `rgba(250,240,150,${a})`); gr.addColorStop(1, 'rgba(250,240,150,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
  }
  // glass reflections
  const refl = g.createLinearGradient(gx0, gy0, gx0 + (gx1 - gx0) * 0.5, gy1);
  refl.addColorStop(0, 'rgba(255,255,255,.09)'); refl.addColorStop(0.35, 'rgba(255,255,255,.02)'); refl.addColorStop(0.36, 'rgba(255,255,255,0)');
  g.fillStyle = refl; g.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
  g.restore();
  // the casement: an oak frame with a cross of mullions, bevel light from the top left
  const oak = pat(g, 'oak', 260);
  const bar = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = oak; g.fillRect(x, y, w, h);
    const vertical = h > w, gr = vertical ? g.createLinearGradient(x, 0, x + w, 0) : g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(255,230,180,.45)'); gr.addColorStop(0.25, 'rgba(255,230,180,0)'); gr.addColorStop(0.75, 'rgba(30,14,4,0)'); gr.addColorStop(1, 'rgba(30,14,4,.5)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  };
  const mw = Math.max(5, fr * 0.55);
  bar((gx0 + gx1) / 2 - mw / 2, gy0, mw, gy1 - gy0);
  bar(gx0, gy0 + (gy1 - gy0) * 0.45 - mw / 2, gx1 - gx0, mw);
  bar(gx0 - fr, gy0 - 6, fr, gy1 - gy0 + 6); bar(gx1, gy0 - 6, fr, gy1 - gy0 + 6);
  bar(gx0 - fr, gy0 - 6, gx1 - gx0 + 2 * fr, 6);
  // the sill
  g.fillStyle = pat(g, 'walnut', 300); g.fillRect(gx0 - fr * 1.6, gy1, gx1 - gx0 + fr * 3.2, H - gy1);
  const sl = g.createLinearGradient(0, gy1, 0, H);
  sl.addColorStop(0, 'rgba(255,220,170,.4)'); sl.addColorStop(0.2, 'rgba(255,220,170,0)'); sl.addColorStop(1, 'rgba(20,8,2,.55)');
  g.fillStyle = sl; g.fillRect(gx0 - fr * 1.6, gy1, gx1 - gx0 + fr * 3.2, H - gy1);
  // velvet curtains, tied back
  const vel = pat(g, 'velvet', 220, '#6a2a52');
  for (const side of [0, 1]) {
    g.save();
    if (side) { g.translate(W, 0); g.scale(-1, 1); }
    g.beginPath(); g.moveTo(0, 0); g.lineTo(cur * 1.25, 0); g.bezierCurveTo(cur * 0.9, H * 0.35, cur * 0.55, H * 0.5, cur * 0.62, H * 0.58); g.bezierCurveTo(cur * 0.8, H * 0.75, cur * 0.9, H * 0.9, cur * 0.95, H); g.lineTo(0, H); g.closePath();
    g.fillStyle = vel; g.fill();
    const folds = g.createLinearGradient(0, 0, cur * 1.25, 0);
    for (let i = 0; i <= 6; i++) folds.addColorStop(i / 6, i % 2 ? 'rgba(255,190,230,.14)' : 'rgba(12,0,10,.42)');
    g.fillStyle = folds; g.fill();
    const sh = g.createLinearGradient(cur * 0.4, 0, cur * 1.3, 0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
    g.fillStyle = sh; g.fill();
    // the tie-back cord
    g.strokeStyle = '#d8a040'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, H * 0.6); g.quadraticCurveTo(cur * 0.4, H * 0.64, cur * 0.66, H * 0.57); g.stroke();
    g.fillStyle = '#c88a2a'; g.beginPath(); g.arc(cur * 0.66, H * 0.6, 3.4, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // the room's light on everything
  const dim = o.dim ?? 0;
  if (dim < 0) { g.fillStyle = `rgba(6,8,20,${Math.min(0.5, -dim * 0.6)})`; g.fillRect(0, 0, W, H); }
}

/** Shade the dark part of a moon disc for phase `p` (0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter). */
export function moonShade(g: CanvasRenderingContext2D, mx: number, my: number, r: number, p: number, col = 'rgba(14,20,50,.9)') {
  p = ((p % 1) + 1) % 1;
  if (Math.abs(p - 0.5) < 0.02) return;
  const k = Math.cos(p * Math.PI * 2);
  g.save();
  g.beginPath(); g.arc(mx, my, r + 0.6, 0, Math.PI * 2); g.clip();
  if (p > 0.5) { g.translate(mx * 2, 0); g.scale(-1, 1); }
  g.fillStyle = col;
  g.beginPath();
  g.arc(mx, my, r + 1, -Math.PI / 2, Math.PI / 2, true);
  if (k > 0) g.ellipse(mx, my, Math.max(0.01, k * (r + 1)), r + 1, 0, Math.PI / 2, -Math.PI / 2, true);
  else g.ellipse(mx, my, Math.max(0.01, -k * (r + 1)), r + 1, 0, Math.PI / 2, Math.PI * 1.5, false);
  g.fill();
  g.restore();
}

function mixc(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}
