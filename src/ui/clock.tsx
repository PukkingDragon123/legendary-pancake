// The bedside alarm clock. [ui7] The brass twin-bell clock painted by the material painter (src/ui/chrome/objects.ts)
// and drawn smooth at device resolution: an enamel
// dial with all twelve numerals, tonight's sleep laid round the dial as a starry sapphire band, live blued
// hands and a red seconds hand, a little AM/PM window, and the gold alarm hand with a knurled knob that you
// drag round the dial (snaps to 5 minutes; passing 12 flips AM/PM naturally). Ringing rocks the bells.
import { useEffect, useRef } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { haptic, useTick } from './kit.tsx';
import { ALARM, alarmClock, alarmHands } from './chrome/objects.ts';

const { W, H, cx: CX, cy: CY, dial: DIAL } = ALARM;
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m: number) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const angOf = (min: number) => ((((min % 720) + 720) % 720) / 720) * Math.PI * 2;

const imgs = new Map<string, HTMLImageElement>();
/** the clock body for a device scale and ring frame, as a loaded image (calls `ready` when it arrives) */
function body(k: number, f: number, ready: () => void): HTMLImageElement {
  const key = `${k}:${f}`;
  let im = imgs.get(key);
  if (!im) { im = new Image(); im.src = alarmClock(k, 1, f); imgs.set(key, im); }
  if (!im.complete) im.addEventListener('load', ready, { once: true });
  return im;
}

/** [ui7] paint the clock smooth at `k` device px per unit */
function paint(g: CanvasRenderingContext2D, k: number, o: { now: Date; wake: number; bed: number; ring: boolean; t: number }, ready: () => void) {
  const f = o.ring ? 1 + (Math.floor(o.t * 14) % 2) : 0;
  const im = body(k, f, ready);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W * k, H * k);
  if (!im.complete || !im.naturalWidth) return;
  g.drawImage(im, 0, 0);
  g.save();
  g.scale(k, k);
  // tonight's sleep: a sapphire band from bedtime round to the wake time, with a few stars
  const span = Math.min(720, ((o.wake - o.bed + 1440) % 1440) || 1440);
  const a0 = angOf(o.bed) - Math.PI / 2, a1 = a0 + (span / 720) * Math.PI * 2;
  const rr = DIAL - 2.1;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(38, 67, 150, 0.55)'; g.lineWidth = 2.2;
  g.beginPath(); g.arc(CX, CY, rr, a0, a1); g.stroke();
  g.fillStyle = '#fff4c8';
  for (let i = 1; i < 6; i++) { const a = a0 + (a1 - a0) * (i / 6); g.beginPath(); g.arc(CX + Math.cos(a) * rr, CY + Math.sin(a) * rr, 0.35, 0, Math.PI * 2); g.fill(); }
  // the AM/PM window under the centre
  const wx = CX - 3.4, wy = CY + 4.4, ww = 6.8, wh = 3.6;
  g.fillStyle = '#7a5418'; g.beginPath(); g.roundRect(wx - 0.4, wy - 0.4, ww + 0.8, wh + 0.8, 0.9); g.fill();
  g.fillStyle = '#1d1208'; g.beginPath(); g.roundRect(wx, wy, ww, wh, 0.6); g.fill();
  g.fillStyle = '#f6dc7f'; g.font = `600 ${2.7}px Alegreya, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(o.wake >= 720 ? 'PM' : 'AM', CX, wy + wh / 2 + 0.15);
  g.restore();
  // the hands (hour, minute, seconds and the gold alarm hand), then a knurled knob on the alarm hand
  alarmHands(g, k, 1, o.now, o.wake);
  g.save(); g.scale(k, k);
  const wa = angOf(o.wake), kx = CX + Math.sin(wa) * (DIAL - 3.4), ky = CY - Math.cos(wa) * (DIAL - 3.4), kr = 1.7;
  const kg = g.createRadialGradient(kx - 0.5, ky - 0.5, 0, kx, ky, kr);
  kg.addColorStop(0, '#fff1bd'); kg.addColorStop(0.5, '#d4a432'); kg.addColorStop(1, '#6e4a12');
  g.shadowColor = 'rgba(20,10,4,.45)'; g.shadowBlur = 1 * k; g.shadowOffsetY = 0.4 * k;
  g.fillStyle = kg; g.beginPath(); g.arc(kx, ky, kr, 0, Math.PI * 2); g.fill();
  g.restore();
}

export function WoodClock(p: { wake: string; bedtime: string; onChange?: (hhmm: string) => void; ringing?: boolean; size?: number; hour12: boolean }) {
  useTick(1000);
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ on: boolean; last: number }>({ on: false, last: toMin(p.wake) });
  const wake = toMin(p.wake), bed = toMin(p.bedtime);
  // [ui7] css px per unit (cs) and device px per unit (k)
  const cs = (p.size ?? 256) / W, k = cs * Math.min(3, Math.max(1, devicePixelRatio || 1));

  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    let raf = 0;
    const draw = (ms: number) => {
      paint(g, k, { now: new Date(), wake, bed, ring: !!p.ringing, t: ms / 1000 }, () => { raf = requestAnimationFrame(draw); });
      if (p.ringing) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  });

  const setFromPointer = (e: PointerEvent) => {
    const r = cv.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W - CX, y = ((e.clientY - r.top) / r.height) * H - CY;
    let a = Math.atan2(x, -y); if (a < 0) a += Math.PI * 2;
    const m12 = (Math.round(((a / (Math.PI * 2)) * 720) / 5) * 5) % 720;
    const prev = drag.current.last;
    const dist = (c: number) => { const d = Math.abs(c - prev) % 1440; return Math.min(d, 1440 - d); };
    const best = dist(m12) <= dist(m12 + 720) ? m12 : m12 + 720;
    if (best !== prev) {
      drag.current.last = best;
      if (best % 15 === 0) haptic(5);
      sound.play('clock_tick', { volume: 0.35, gap: 30 });
      p.onChange?.(toHHMM(best));
    }
  };
  const label = new Date(2020, 0, 1, Math.floor(wake / 60), wake % 60).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: p.hour12 });
  return (
    <div class={p.ringing ? 'shake' : ''} style={{ display: 'flex', justifyContent: 'center', touchAction: 'none' }}>
      <canvas ref={cv} width={Math.round(W * k)} height={Math.round(H * k)} role="img" aria-label={`Alarm set for ${label}. Drag the golden hand to change it.`}
        style={{ width: `${W * cs}px`, height: `${H * cs}px`, maxWidth: '100%', cursor: p.onChange ? 'grab' : 'default' }}
        onPointerDown={(e) => { if (!p.onChange) return; drag.current.on = true; drag.current.last = wake; (e.currentTarget as Element).setPointerCapture(e.pointerId); setFromPointer(e); }}
        onPointerMove={(e) => { if (drag.current.on) setFromPointer(e); }}
        onPointerUp={() => { drag.current.on = false; }}
        onPointerCancel={() => { drag.current.on = false; }} />
    </div>
  );
}
