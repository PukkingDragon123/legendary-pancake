// The night screen's painted pieces, drawn smooth at the screen's own resolution (no pixel art): tonight's moon in its
// real phase (a lit sphere with soft maria, craters and a halo), the journey strip from the hollow to tonight's place
// (layered painted hills, a glowing dashed path, Pip's lantern travelling along it), soft twinkling stars, and Pip asleep
// on a cloud (the real 3D render, smooth).
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { PipPix } from './pippix.tsx';

const DPR = () => Math.min(3, Math.max(1, devicePixelRatio || 1));
const hh = (i: number, k: number) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

function useCanvas(w: number, h: number, draw: (g: CanvasRenderingContext2D, t: number) => void, animate: boolean, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const k = DPR();
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    const g = c.getContext('2d')!;
    let raf = 0, last = 0;
    const frame = (now: number) => {
      if (animate && !document.documentElement.classList.contains('hh-still')) raf = requestAnimationFrame(frame);
      if (now - last < 66) return; // about 15 fps is plenty for a calm night picture
      last = now;
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, w, h);
      draw(g, now / 1000);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, deps);
  return ref;
}

/** Tonight's moon: phase 0 new .. 0.5 full .. 1 new. */
export function PaintedMoon(p: { size: number; phase: number; label?: string }) {
  const S = p.size;
  const ref = useCanvas(S, S, (g) => {
    const cx = S / 2, cy = S / 2, r = S * 0.3;
    // the halo
    const halo = g.createRadialGradient(cx, cy, r * 0.8, cx, cy, S / 2);
    halo.addColorStop(0, 'rgba(255,240,205,0.32)'); halo.addColorStop(0.45, 'rgba(190,200,255,0.1)'); halo.addColorStop(1, 'rgba(160,170,240,0)');
    g.fillStyle = halo; g.fillRect(0, 0, S, S);
    // the dark disc (earthshine) and the lit part, a sphere lit from the sun's side
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#2c3352'; g.fillRect(0, 0, S, S);
    const lit = document.createElement('canvas'); lit.width = lit.height = Math.ceil(S * DPR());
    const L = lit.getContext('2d')!; L.scale(DPR(), DPR());
    const body = L.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.05);
    body.addColorStop(0, '#fffaf0'); body.addColorStop(0.6, '#f1e4c6'); body.addColorStop(1, '#c9b892');
    L.fillStyle = body; L.beginPath(); L.arc(cx, cy, r, 0, Math.PI * 2); L.fill();
    // maria: soft grey-blue seas
    for (let i = 0; i < 7; i++) {
      const x = cx + (hh(i, 1) - 0.5) * r * 1.2, y = cy + (hh(i, 2) - 0.5) * r * 1.1, rr = r * (0.16 + hh(i, 3) * 0.22);
      const m = L.createRadialGradient(x, y, 0, x, y, rr); m.addColorStop(0, 'rgba(120,118,140,0.42)'); m.addColorStop(1, 'rgba(120,118,140,0)');
      L.fillStyle = m; L.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // craters: a shadowed rim and a lit inner edge
    for (let i = 0; i < 14; i++) {
      const a = hh(i, 5) * Math.PI * 2, d = Math.sqrt(hh(i, 6)) * r * 0.85, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, rr = r * (0.03 + hh(i, 7) * 0.07);
      L.strokeStyle = 'rgba(110,96,80,0.35)'; L.lineWidth = Math.max(0.6, rr * 0.35); L.beginPath(); L.arc(x, y, rr, 0, Math.PI * 2); L.stroke();
      L.strokeStyle = 'rgba(255,250,235,0.35)'; L.lineWidth = Math.max(0.4, rr * 0.25); L.beginPath(); L.arc(x + rr * 0.15, y + rr * 0.15, rr, Math.PI * 0.9, Math.PI * 1.9); L.stroke();
    }
    // the phase: cut the lit sphere with the terminator (an ellipse), softened
    const ph = ((p.phase % 1) + 1) % 1, waxing = ph < 0.5, k = Math.cos(ph * Math.PI * 2); // 1 new .. -1 full
    L.globalCompositeOperation = 'destination-in';
    L.filter = `blur(${Math.max(0.6, r * 0.04)}px)`;
    L.beginPath();
    if (waxing) { L.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false); L.ellipse(cx, cy, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0); }
    else { L.arc(cx, cy, r, Math.PI / 2, -Math.PI / 2, false); L.ellipse(cx, cy, Math.abs(k) * r, r, 0, -Math.PI / 2, Math.PI / 2, k > 0); }
    L.fill();
    L.filter = 'none'; L.globalCompositeOperation = 'source-over';
    g.drawImage(lit, 0, 0, S, S);
    g.restore();
    // a fine rim light
    g.strokeStyle = 'rgba(255,245,220,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  }, false, [S, p.phase]);
  return <canvas ref={ref} class="moonclock painted" style={{ width: `${S}px`, height: `${S}px` }} aria-label={p.label} role="img" />;
}

/** A strip of painted hills with the path from the hollow to tonight's place; Pip's lantern glows along it. */
export function PaintedJourney(p: { frac: number; color: string; width?: number }) {
  const W = p.width ?? 340, H = 82;
  const ref = useCanvas(W, H, (g, t) => {
    // three ridges of hills, far to near, in night blues
    const ridge = (base: number, amp: number, f: number, seed: number, col: string) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4) g.lineTo(x, base - Math.sin(x * f + seed) * amp - Math.sin(x * f * 2.7 + seed * 2) * amp * 0.35);
      g.lineTo(W, H); g.closePath(); g.fill();
    };
    ridge(H * 0.62, 6, 0.022, 1, '#2a3560'); ridge(H * 0.72, 5, 0.03, 4, '#212a4c'); ridge(H * 0.82, 4, 0.04, 7, '#19203a');
    // little pines along the near ridge
    g.fillStyle = '#141a30';
    for (let i = 0; i < 18; i++) { const x = hh(i, 9) * W, y = H * 0.8 - Math.sin(x * 0.04 + 7) * 4, s = 5 + hh(i, 8) * 6; g.beginPath(); g.moveTo(x, y - s * 1.8); g.lineTo(x - s * 0.6, y); g.lineTo(x + s * 0.6, y); g.closePath(); g.fill(); }
    // home (the oak with a lit window) and tonight's place (a flag in its colour)
    const hx = 22, hy = H * 0.7, tx = W - 24, ty = H * 0.72;
    g.fillStyle = '#3a2a1e'; g.fillRect(hx - 3, hy - 14, 6, 16);
    g.fillStyle = '#2c4a3a'; g.beginPath(); g.ellipse(hx, hy - 20, 14, 11, 0, 0, Math.PI * 2); g.fill();
    const win = g.createRadialGradient(hx, hy - 8, 0, hx, hy - 8, 8); win.addColorStop(0, 'rgba(255,210,130,0.95)'); win.addColorStop(1, 'rgba(255,210,130,0)');
    g.fillStyle = win; g.fillRect(hx - 8, hy - 16, 16, 16); g.fillStyle = '#ffd58a'; g.fillRect(hx - 1.5, hy - 10, 3, 3);
    g.strokeStyle = '#d8c8a8'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx, ty - 22); g.stroke();
    g.fillStyle = p.color; g.beginPath(); g.moveTo(tx, ty - 22); g.lineTo(tx + 14, ty - 18); g.lineTo(tx, ty - 13); g.closePath(); g.fill();
    // the path: an arc over the hills, travelled part bright
    const pt = (u: number) => [hx + u * (tx - hx), hy - 18 - Math.sin(u * Math.PI) * (H * 0.42)] as const;
    const fr = Math.max(0.02, Math.min(0.98, p.frac));
    g.setLineDash([3, 5]); g.lineCap = 'round';
    g.strokeStyle = 'rgba(120,130,170,0.7)'; g.lineWidth = 1.6; g.beginPath(); for (let u = 0; u <= 1.001; u += 0.02) { const [x, y] = pt(u); if (u === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    g.strokeStyle = 'rgba(255,232,180,0.95)'; g.lineWidth = 2; g.beginPath(); for (let u = 0; u <= fr + 0.001; u += 0.02) { const [x, y] = pt(Math.min(u, fr)); if (u === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    g.setLineDash([]);
    // the lantern
    const [lx, ly] = pt(fr), bob = Math.sin(t * 2.4) * 1.2;
    const glow = g.createRadialGradient(lx, ly + bob, 0, lx, ly + bob, 16); glow.addColorStop(0, 'rgba(255,214,140,0.9)'); glow.addColorStop(0.3, 'rgba(255,190,110,0.35)'); glow.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = glow; g.fillRect(lx - 16, ly + bob - 16, 32, 32);
    g.fillStyle = '#fff1cf'; g.beginPath(); g.arc(lx, ly + bob, 2.6, 0, Math.PI * 2); g.fill();
  }, true, [W, p.frac, p.color]);
  return <canvas ref={ref} class="journey painted" style={{ width: `${W}px`, height: `${H}px`, maxWidth: '100%' }} aria-label="Pip's trip tonight" role="img" />;
}

/** soft stars over the night screen (smooth glows, twinkling slowly) */
export function SoftStars(p: { n?: number }) {
  const stars = useMemo(() => Array.from({ length: p.n ?? 46 }, (_, i) => ({ x: hh(i, 11) * 100, y: hh(i, 12) * 62, s: 1.2 + hh(i, 13) * 2.4, d: hh(i, 14) * 6, big: hh(i, 15) > 0.9 })), [p.n]);
  return <div class="soft-stars" aria-hidden="true">{stars.map((s) => <i class={s.big ? 'big' : ''} style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.s}px`, height: `${s.s}px`, animationDelay: `${-s.d}s` }} />)}</div>;
}

/** Pip asleep: the real render, smooth, on a soft painted cloud, with z's drifting up */
export function SleepingPipPainted() {
  return (
    <div class="lock-pip painted" aria-label="Pip asleep" role="img">
      <span class="cloud" />
      <PipPix size={132} shot="full" smooth label="" />
      <span class="zz"><b>z</b><b>z</b><b>z</b></span>
    </div>
  );
}
