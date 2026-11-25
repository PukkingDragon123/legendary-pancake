// [icons8, icons9] The three main buttons, painted: a brass oil lamp with a ruby glass font and a warm flame in its
// glass chimney (Sleep), a carved Black Forest cuckoo clock (Clock) and a tooled leather journal with a gilt acorn
// (Book) on a carved walnut shelf with brass name plates. The sprites are detailed 3D models rendered with their real
// textures and finished like hand-painted game art with a crisp dark outline (src/dev/iconbake.ts), drawn at 3 px per
// CSS px into their own atlas (public/img/ui3d-shelf.webp); here one canvas draws them smoothly at the screen's own
// resolution. No WebGL.
// Everything moves like an object: a press sinks it into the shelf and squashes it, a release
// hops it up to land with a squash, hovering lifts it (the cuckoo's door peeks open, the journal's cover lifts); a tap
// snuffs the lamp's flame and turns it up again bright, opens the cuckoo clock's door for the owl to call twice, and
// unbuckles the journal and swings its cover open and shut. Idle: the flame breathes, the pendulum swings, and the
// clock's hands show the real time, drawn over the dial. When the shelf comes back the objects drop onto
// it one by one. At night the lamp's warm light spills over the shelf. It draws at 12 fps idle and 30 fps while
// something moves, and stops when the shelf is away or the page is hidden.
import { useEffect, useRef, useState } from 'preact/hooks';
import { sceneRef } from '../state.ts';
import { ICONS3D } from '../px/icons3d.ts';
import { reducedMotion } from './swing.ts';
import { shelfAtlas, shelfAtlasNow } from './iconset.ts';

export type NavId = 'sleep' | 'clock' | 'book';
const SH = ICONS3D.shelf;
/** the art canvas: the nav's 352 x 132 CSS px box and 46 px above it (for hops and the lamp's glow); positions in art px
 * (one per CSS px), drawn at `SR` canvas px per art px (the sprites' own resolution) */
const [BW, BH, BTOP] = SH.box;
const SR = SH.res;
/** art px per world unit of the baked models (for the physics, kept in model units) */
const PXU = 38;
/** where the objects stand: the shelf's top, in art px */
const TOP = 147;

interface Phys { y: number; vy: number; ground: number; sq: number; vsq: number; press: boolean; hover: boolean; act: number; drop: number }
const mkPhys = (): Phys => ({ y: 0, vy: 0, ground: 0, sq: 0, vsq: 0, press: false, hover: false, act: -1, drop: -1 });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

class ShelfStage {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private art = document.createElement('canvas');
  private g = this.art.getContext('2d')!;
  /** the lamp's light at night, laid only on what is drawn */
  private light = document.createElement('canvas');
  private lg = this.light.getContext('2d')!;
  private objs: Record<NavId, Phys> = { sleep: mkPhys(), clock: mkPhys(), book: mkPhys() };
  private p = 0;
  private raf = 0;
  private last = 0;
  private t = 0;
  private shown = false;
  private hostEl: HTMLElement | null = null;
  private rec = false;
  private moving = 0;
  onLive: (() => void) | null = null;
  live = false;

  constructor() {
    this.canvas.className = 'hh-navart-c';
    this.art.width = this.light.width = BW * SR; this.art.height = this.light.height = BH * SR;
    this.g.setTransform(SR, 0, 0, SR, 0, 0);
    this.lg.setTransform(SR, 0, 0, SR, 0, 0);
    document.addEventListener('visibilitychange', () => this.wake());
  }

  // ---------------------------------------------------------------- size
  /** `s` device px per CSS px of the nav (the screen's pixel ratio, times 1.5 where the nav is drawn bigger) */
  setScale(s: number) {
    // drawn at the screen's own resolution (smoothly resampled from the sprites' 3 px per art px)
    const p = Math.max(1, Math.round(s * 100) / 100);
    if (p === this.p) return;
    this.p = p;
    this.canvas.width = Math.round(BW * p); this.canvas.height = Math.round(BH * p);
    this.wake();
  }

  // ---------------------------------------------------------------- input
  press(id: NavId, on: boolean) {
    const p = this.objs[id];
    if (p.press === on) return;
    p.press = on;
    if (!on && !reducedMotion()) p.vy = Math.max(p.vy, 2.8);
    this.kick();
  }
  hover(id: NavId, on: boolean) { const p = this.objs[id]; if (p.hover !== on) { p.hover = on; this.kick(); } }
  act(id: NavId) { this.objs[id].act = 0; this.kick(); }
  setRec(on: boolean) { if (on !== this.rec) { this.rec = on; this.kick(); } }
  /** the shelf (re)appears: the objects drop onto it one by one */
  show(on: boolean) {
    if (on && !this.shown && !reducedMotion()) (['sleep', 'clock', 'book'] as NavId[]).forEach((id, i) => { const p = this.objs[id]; p.y = 0.32; p.vy = 0; p.drop = i * 0.09; });
    this.shown = on;
    this.kick();
  }
  attach(el: HTMLElement | null) { this.hostEl = el; if (el && this.canvas.parentElement !== el) el.appendChild(this.canvas); this.wake(); }
  private kick() { this.moving = Math.max(this.moving, 1.2); this.wake(); }

  // ---------------------------------------------------------------- loop
  private wake() {
    if (this.raf || !this.hostEl || !this.shown || document.hidden || !this.p) return;
    this.raf = requestAnimationFrame(this.loop);
  }
  private loop = (now: number) => {
    this.raf = 0;
    if (!this.hostEl || !this.shown || document.hidden) return;
    this.raf = requestAnimationFrame(this.loop);
    const calm = reducedMotion();
    const fps = this.moving > 0 ? 30 : calm ? 1 : 12;
    if (now - this.last < 1000 / fps - 3) return;
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 1 / 30);
    this.last = now;
    this.frame(dt, calm);
  };

  /** advance one object's spring-and-gravity body (model units); returns how much it is still moving */
  private stepPhys(p: Phys, dt: number) {
    if (p.drop > 0) { p.drop -= dt; return 1; }
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    p.ground = p.hover ? 0.07 : 0;
    for (let i = 0; i < n; i++) {
      if (p.y > p.ground + 1e-4 || p.vy > 0) {
        p.vy -= 26 * h; p.y += p.vy * h;
        if (p.y <= p.ground && p.vy < 0) { p.vsq += p.vy * 0.55; p.y = p.ground; p.vy = 0; }
      } else p.y += (p.ground - p.y) * Math.min(1, h * 16);
      const sqT = p.press ? -0.1 : 0;
      p.vsq += ((sqT - p.sq) * 560 - p.vsq * 19) * h; p.sq += p.vsq * h;
    }
    return Math.abs(p.vy) + Math.abs(p.vsq) + Math.abs(p.sq - (p.press ? -0.1 : 0)) * 10 + Math.abs(p.y - p.ground) * 10;
  }

  // ---------------------------------------------------------------- drawing (in art pixels, at SR canvas px each)
  /** a sprite where it was baked, lifted `dy` art px and squashed by `sq` about its foot */
  private sprite(name: string, dy = 0, sq = 0) {
    const s = SH.sprites[name], im = shelfAtlasNow();
    if (!s || !im) return;
    const [ax, ay, aw, ah, x, y] = s, w = aw / SR, h = ah / SR;
    const w2 = w * (1 - sq * 0.5), h2 = h * (1 + sq);
    this.g.drawImage(im, ax, ay, aw, ah, x + (w - w2) / 2, y + h - h2 + dy, w2, h2);
  }
  /** a soft shadow on the shelf top under an object (`w` art px wide), fading and shrinking as it lifts */
  private shadow(cx: number, w: number, lift: number) {
    const g = this.g, k = Math.max(0.35, 1 - lift * 0.9), hw = (w / 2) * k, a = 0.42 * Math.max(0.2, 1 - lift * 0.8);
    g.save();
    g.translate(cx, TOP + 0.5); g.scale(1, 0.16);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, hw);
    gr.addColorStop(0, `rgba(30,14,8,${a.toFixed(3)})`); gr.addColorStop(0.6, `rgba(30,14,8,${(a * 0.6).toFixed(3)})`); gr.addColorStop(1, 'rgba(30,14,8,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, hw, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  /** a glow in soft rings of warm light (`r` art px), added */
  private glow(cx: number, cy: number, r: number, a: number, rgb = '255,196,104', steps = 4) {
    if (a <= 0.004) return;
    const g = this.g;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < steps; i++) {
      // fainter towards the rim, so the glow has no visible edge
      const rr = r * (1 - i / steps);
      g.fillStyle = `rgba(${rgb},${((a * 2 * (i + 1)) / (steps * (steps + 1))).toFixed(3)})`;
      g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  /** a clock hand from the dial's centre: a tapered blued-steel hand `len` art px long at angle `a` (0 up, clockwise) */
  private hand(cx: number, cy: number, a: number, len: number, col: string, thick: boolean) {
    const g = this.g, w = thick ? 1.5 : 1;
    g.save();
    g.translate(cx, cy); g.rotate(a);
    g.fillStyle = col;
    g.beginPath(); g.moveTo(-w / 2, len * 0.12); g.lineTo(-w * 0.42, -len * 0.7); g.lineTo(0, -len); g.lineTo(w * 0.42, -len * 0.7); g.lineTo(w / 2, len * 0.12); g.closePath(); g.fill();
    g.restore();
  }

  private frame(dt: number, calm: boolean) {
    this.t += dt;
    const t = this.t, g = this.g;
    let motion = 0;
    for (const id of ['sleep', 'clock', 'book'] as NavId[]) {
      const p = this.objs[id];
      motion += this.stepPhys(p, dt);
      if (p.act >= 0) { p.act += dt; if (p.act > 1.8) p.act = -1; else motion += 1; }
    }
    const dy = (p: Phys) => -Math.max(0, p.y) * PXU + (p.press ? 1 : 0);
    const night = this.nightness();
    g.clearRect(0, 0, BW, BH);
    // the lamp: its flame breathes; a tap snuffs it, then turns it up bright
    const lp = this.objs.sleep, la = lp.act;
    const breath = calm ? 0.6 : 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 4.2);
    let glow = (0.72 + 0.28 * breath) * (this.rec ? 1.3 : 1) * (lp.hover ? 1.15 : 1);
    if (la >= 0) glow = la < 0.13 ? 0.05 : la < 0.3 ? 1.7 : lerp(1.7, glow, clamp((la - 0.3) / 1.2));
    glow *= 1 + night * 0.5;
    const [lx, ly0] = SH.lamp, ly = ly0 + dy(lp);
    this.glow(lx, ly, 50, (0.16 + 0.1 * night) * glow, '255,200,110', 6);
    this.sprite('shelf');
    // the objects' shadows on the shelf top
    this.shadow(SH.objects.sleep, 52, lp.y);
    this.shadow(SH.objects.clock + 2, 76, this.objs.clock.y);
    this.shadow(SH.objects.book + 4, 74, this.objs.book.y);
    const lampFrame = la >= 0 && la < 0.13 ? 'lamp_off' : la >= 0.13 && la < 0.35 ? 'lamp_pull' : 'lamp' + Math.min(3, Math.max(0, Math.round((glow - 0.6) * 4)));
    this.sprite(lampFrame, dy(lp), lp.sq);
    // the chimney's glass catches the flame's glow
    if (lampFrame !== 'lamp_off') {
      g.save();
      g.beginPath(); g.arc(lx, ly, 13, 0, Math.PI * 2); g.clip();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = clamp((glow - 0.7) * 0.14, 0, 0.16);
      this.sprite(lampFrame, dy(lp), lp.sq);
      g.restore();
    }
    // the cuckoo clock: the door and the owl, the pendulum, the real time
    const cp = this.objs.clock, ca = cp.act;
    let cf = cp.hover ? 'clock1' : 'clock0';
    if (ca >= 0) {
      const bob = [0.32, 0.68].some((c0) => ca > c0 && ca < c0 + 0.24);
      cf = ca < 0.1 ? 'clock1' : ca < 1.15 ? (bob ? 'clock3' : 'clock2') : ca < 1.32 ? 'clock1' : 'clock0';
    }
    const cdy = dy(cp);
    this.sprite(cf, cdy, cp.sq);
    const kickP = ca >= 0 ? Math.sin(Math.min(1, ca / 1.2) * Math.PI) * 0.18 : 0;
    const swing = calm ? 0 : Math.sin((t * Math.PI * 2) / 1.15) * (0.26 + kickP);
    this.sprite('pend' + Math.max(0, Math.min(4, Math.round(swing / 0.13) + 2)), cdy, cp.sq);
    const [dx0, dy0, dr] = SH.dial, now = new Date();
    const dcx = dx0, dcy = dy0 + cdy + (cp.sq ? Math.round(-cp.sq * (TOP - dy0)) : 0);
    const mA = ((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2, hA = (((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2;
    this.hand(dcx, dcy, hA, dr * 0.5, '#2b1e2c', true);
    this.hand(dcx, dcy, mA, dr * 0.74, '#3a2a40', false);
    g.fillStyle = '#e8b448';
    g.beginPath(); g.arc(dcx, dcy, 1.1, 0, Math.PI * 2); g.fill();
    // the journal: hover lifts the cover; a tap unbuckles it and swings the cover open, then shut
    const bp = this.objs.book, ba = bp.act;
    let bf = bp.hover ? 'book1' : 'book0';
    if (ba >= 0) bf = ba < 0.12 ? 'book2' : ba < 0.25 ? 'book3' : ba < 0.4 ? 'book4' : ba < 1.05 ? 'book5' : ba < 1.18 ? 'book4' : ba < 1.3 ? 'book3' : ba < 1.6 ? 'book2' : 'book0';
    this.sprite(bf, dy(bp), bp.sq);
    // night: moonlight cools everything on the shelf, and the lamp's warm light falls across it in soft bands
    if (night > 0.02) {
      const L = this.lg;
      // moonlight: a cool shade multiplied over what is drawn (never lifting the darks)
      L.globalCompositeOperation = 'source-over';
      L.clearRect(0, 0, BW, BH);
      L.fillStyle = `rgba(186,194,250,${night.toFixed(3)})`;
      L.fillRect(0, 0, BW, BH);
      L.globalCompositeOperation = 'destination-in';
      L.drawImage(this.art, 0, 0, BW, BH);
      g.save();
      g.globalCompositeOperation = 'multiply';
      g.drawImage(this.light, 0, 0, BW, BH);
      g.restore();
      const r = 170, steps = 7, a = 0.3 * night * Math.min(1.3, glow);
      L.globalCompositeOperation = 'source-over';
      L.clearRect(0, 0, BW, BH);
      for (let i = 0; i < steps; i++) {
        L.fillStyle = `rgba(255,184,100,${(a / steps).toFixed(3)})`;
        L.beginPath(); L.arc(lx + 4, ly + 8, r * (1 - i / steps), 0, Math.PI * 2); L.fill();
      }
      // not on the lamp's own chimney (it glows by itself)
      L.globalCompositeOperation = 'destination-out';
      L.beginPath(); L.arc(lx, ly, 16, 0, Math.PI * 2); L.fill();
      L.globalCompositeOperation = 'destination-in';
      L.drawImage(this.art, 0, 0, BW, BH);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.drawImage(this.light, 0, 0, BW, BH);
      g.restore();
    }
    // up to the screen, smoothly resampled
    const c = this.ctx;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.art, 0, 0, this.canvas.width, this.canvas.height);
    if (motion > 0.02) this.moving = 0.4;
    else this.moving = Math.max(0, this.moving - dt);
    if (!this.live) { this.live = true; this.onLive?.(); }
  }
  private nightness() {
    const sc = sceneRef.current as unknown as { sky?: { night?: number } } | null;
    const n = sc?.sky?.night ?? (window as unknown as { __shelfNight?: number }).__shelfNight;
    if (typeof n === 'number') return Math.max(0, Math.min(1, (n - 0.15) / 0.6));
    const h = new Date().getHours();
    return h >= 20 || h < 6 ? 1 : 0;
  }
}

let stage: ShelfStage | undefined;
function getStage(): ShelfStage {
  if (!stage) {
    stage = new ShelfStage();
    try { localStorage.removeItem('hh-shelf3d-still:v3'); } catch { /* the old 3D shelf's picture: no longer needed */ }
  }
  return stage;
}

/** the buttons tell the shelf what's happening to their objects */
export const shelf2d = {
  press: (id: NavId, on: boolean) => stage?.press(id, on),
  hover: (id: NavId, on: boolean) => stage?.hover(id, on),
  act: (id: NavId) => stage?.act(id),
};

let styled = false;
function installStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'hh-shelf2d';
  st.textContent = `
.hh-navart{position:absolute;left:0;top:${-BTOP}px;width:${BW}px;height:${BH}px;pointer-events:none;z-index:0}
.hh-navart>canvas{position:absolute;left:0;top:0;display:block;width:100%;height:100%}
.hh-nav.live .hh-pic,.hh-nav.live .hh-cshadow,.hh-nav.live .hh-shelf,.hh-nav.wait .hh-pic,.hh-nav.wait .hh-cshadow,.hh-nav.wait .hh-shelf{visibility:hidden}
.hh-nav.live .hh-plate,.hh-nav.wait .hh-plate{background-image:none!important;filter:none}
.hh-nav.live .hh-mobj,.hh-nav.live .hh-mobj.press,.hh-nav.live .hh-mobj.pop,.hh-nav.live .hh-mobj.rec,.hh-nav.live .hh-mobj.rec.pop{animation:none;scale:none;filter:none}
.hh-nav.live .hh-mobj.press .hh-plate{translate:0 1px}
@media (min-width: 900px) and (min-height: 760px){.hh-nav.live .hh-plate{line-height:18px}}
`;
  document.head.appendChild(st);
}

/** device px per nav CSS px: the screen's pixel ratio, times 1.5 where the nav is drawn bigger */
const navScale = (big: boolean) => (window as unknown as { __shelfArt?: number }).__shelfArt ?? (big ? 1.5 : 1) * (devicePixelRatio || 1);

/**
 * The painted shelf behind the main buttons. Returns [host ref, live, wait]: put the host span in the nav; `live`
 * turns true once the first frame is drawn (then the painted stand-ins hide); `wait` hides them for a moment while the
 * interface atlas is still coming (they show if it can't load).
 */
export function useShelf2D(away: boolean, rec: boolean, bigQuery: string): [(el: HTMLElement | null) => void, boolean, boolean] {
  installStyles();
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(() => !!shelfAtlasNow());
  const [wait, setWait] = useState(() => !shelfAtlasNow());
  const host = useRef<HTMLElement | null>(null);
  useEffect(() => {
    let gone = false;
    void shelfAtlas().then((im) => { if (gone) return; if (im) setReady(true); else setWait(false); });
    const t = window.setTimeout(() => setWait(false), 1500);
    return () => { gone = true; clearTimeout(t); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const s = getStage();
    s.onLive = () => { setLive(true); setWait(false); };
    if (s.live) setLive(true);
    let mq: MediaQueryList | null = null;
    const size = () => s.setScale(navScale(!!mq?.matches));
    try { mq = matchMedia(bigQuery); mq.addEventListener?.('change', size); } catch { mq = null; }
    size();
    s.attach(host.current);
    s.show(!away);
    addEventListener('resize', size);
    return () => { mq?.removeEventListener?.('change', size); removeEventListener('resize', size); };
  }, [ready]);
  useEffect(() => { if (ready) stage?.show(!away); }, [ready, away]);
  useEffect(() => { if (ready) stage?.setRec(rec); }, [ready, rec]);
  return [(el) => { host.current = el; if (ready) stage?.attach(el); }, live, wait && !live];
}

/** for the dev page and screenshots */
if (typeof window !== 'undefined') (window as unknown as { __shelf2d: unknown }).__shelf2d = { stage: () => stage, api: shelf2d };
