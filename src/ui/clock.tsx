// The bedside alarm clock. [ui4] v4: the same brass twin-bell clock as the Clock button (a relief-painted
// model lit from the top left, src/ui/chrome/objects.ts), shown at one art pixel per CSS pixel: an enamel
// dial with all twelve numerals, tonight's sleep laid round the dial as a starry sapphire band, live blued
// hands and a red seconds hand, a little AM/PM window, and the gold alarm hand with a knurled knob that you
// drag round the dial (snaps to 5 minutes; passing 12 flips AM/PM naturally). Ringing rocks the bells.
import { useEffect, useRef } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { haptic, useTick } from './kit.tsx';
import { ALARM, alarmClock, alarmHands } from './chrome/objects.ts';

const { W, H, cx: CX, cy: CY, dial: DIAL } = ALARM;
const GLYPH: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], P: ['##.', '#.#', '##.', '#..', '#..'], M: ['#.#', '###', '###', '#.#', '#.#'],
};
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m: number) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const angOf = (min: number) => ((((min % 720) + 720) % 720) / 720) * Math.PI * 2;

const imgs = new Map<string, HTMLImageElement>();
/** the clock body for a detail level and ring frame, as a loaded image (calls `ready` when it arrives) */
function body(k: number, f: number, ready: () => void): HTMLImageElement {
  const key = `${k}:${f}`;
  let im = imgs.get(key);
  if (!im) { im = new Image(); im.src = alarmClock(k, 1, f); imgs.set(key, im); }
  if (!im.complete) im.addEventListener('load', ready, { once: true });
  return im;
}

function paint(g: CanvasRenderingContext2D, k: number, o: { now: Date; wake: number; bed: number; ring: boolean; t: number }, ready: () => void) {
  const f = o.ring ? 1 + (Math.floor(o.t * 14) % 2) : 0;
  const im = body(k, f, ready);
  g.clearRect(0, 0, W * k, H * k);
  if (!im.complete || !im.naturalWidth) return;
  g.imageSmoothingEnabled = false;
  g.drawImage(im, 0, 0);
  const px = (x: number, y: number, c: string) => { g.fillStyle = c; g.fillRect(Math.floor(x * k), Math.floor(y * k), 1, 1); };
  // tonight's sleep: a sapphire band from bedtime round to the wake time, sprinkled with stars
  const span = Math.min(720, ((o.wake - o.bed + 1440) % 1440) || 1440);
  const a0 = angOf(o.bed), sweep = (span / 720) * Math.PI * 2;
  const r0 = (DIAL - 3.1) * k, r1 = (DIAL - 0.9) * k;
  for (let y = Math.floor(CY * k - r1); y <= CY * k + r1; y++) for (let x = Math.floor(CX * k - r1); x <= CX * k + r1; x++) {
    const dx = x + 0.5 - CX * k, dy = y + 0.5 - CY * k, d = Math.hypot(dx, dy);
    if (d < r0 || d > r1) continue;
    let a = Math.atan2(dx, -dy); if (a < 0) a += Math.PI * 2;
    let rel = a - a0; if (rel < 0) rel += Math.PI * 2;
    if (rel > sweep) continue;
    const star = (Math.floor(d) * 7 + Math.floor(a * 30 * k)) % 29 === 0;
    g.fillStyle = star ? '#fff4c8' : d > r1 - k * 0.6 ? 'rgba(20, 34, 80, 0.85)' : 'rgba(38, 67, 131, 0.62)';
    g.fillRect(x, y, 1, 1);
  }
  // the AM/PM window under the centre
  const wx = Math.floor((CX - 3.2) * k), wy = Math.floor((CY + 4.6) * k), ww = Math.ceil(6.4 * k), wh = Math.ceil(3.6 * k);
  g.fillStyle = '#6e4a12'; g.fillRect(wx - 1, wy - 1, ww + 2, wh + 2);
  g.fillStyle = '#1d1208'; g.fillRect(wx, wy, ww, wh);
  const gs = Math.max(1, Math.floor(k / 2)), word = o.wake >= 720 ? 'PM' : 'AM';
  let gx = wx + Math.floor((ww - (word.length * 4 - 1) * gs) / 2);
  for (const ch of word) { GLYPH[ch].forEach((row, ry) => [...row].forEach((v, rx) => { if (v === '#') { g.fillStyle = '#f6dc7f'; g.fillRect(gx + rx * gs, wy + Math.floor((wh - 5 * gs) / 2) + ry * gs, gs, gs); } })); gx += 4 * gs; }
  // the hands (hour, minute, seconds and the gold alarm hand), then a knurled knob on the alarm hand
  alarmHands(g, k, 1, o.now, o.wake);
  const wa = angOf(o.wake), kx = CX + Math.sin(wa) * (DIAL - 3.4), ky = CY - Math.cos(wa) * (DIAL - 3.4), kr = 1.7;
  for (let y = Math.floor((ky - kr) * k); y <= (ky + kr) * k; y++) for (let x = Math.floor((kx - kr) * k); x <= (kx + kr) * k; x++) {
    const dx = (x + 0.5) / k - kx, dy = (y + 0.5) / k - ky, d = Math.hypot(dx, dy);
    if (d > kr) continue;
    g.fillStyle = d > kr - 0.5 ? '#4a300b' : dx + dy < -0.6 ? '#fff1bd' : (x + y) % 2 ? '#d4a432' : '#b88524';
    g.fillRect(x, y, 1, 1);
  }
  void px;
}

export function WoodClock(p: { wake: string; bedtime: string; onChange?: (hhmm: string) => void; ringing?: boolean; size?: number; hour12: boolean }) {
  useTick(1000);
  const cv = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ on: boolean; last: number }>({ on: false, last: toMin(p.wake) });
  const wake = toMin(p.wake), bed = toMin(p.bedtime);
  // one art pixel per CSS pixel: k art px per design unit
  const k = Math.max(2, Math.floor((p.size ?? 256) / W));

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
      <canvas ref={cv} width={W * k} height={H * k} class="px" role="img" aria-label={`Alarm set for ${label}. Drag the golden hand to change it.`}
        style={{ width: `${W * k}px`, height: `${H * k}px`, maxWidth: '100%', filter: 'drop-shadow(2px 4px 0 rgba(26, 14, 8, .45))', cursor: p.onChange ? 'grab' : 'default' }}
        onPointerDown={(e) => { if (!p.onChange) return; drag.current.on = true; drag.current.last = wake; (e.currentTarget as Element).setPointerCapture(e.pointerId); setFromPointer(e); }}
        onPointerMove={(e) => { if (drag.current.on) setFromPointer(e); }}
        onPointerUp={() => { drag.current.on = false; }}
        onPointerCancel={() => { drag.current.on = false; }} />
    </div>
  );
}
