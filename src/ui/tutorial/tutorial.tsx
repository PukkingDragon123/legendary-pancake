// [tutor] The guided tour of the hollow, right after the interview (and again from Settings). Pip points at one
// thing at a time: the rest of the room sinks into a night dim, the thing he means stays lamplit in a soft amber
// ring with a few fireflies circling it, and a pixel-art glove bobs towards it. His words float beside it (the same
// living type as everywhere: ui/talk.ts). Each stop waits for the real action (tapping Pip, opening a place); when
// a place opens he explains it while you look round, then lights up its own Back button and waits for you to come
// home. Progress is kept in the save, so a reload resumes at the same stop. Skip ends the tour at any time.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Box3, Vector3 } from 'three';
import { sound } from '../../audio/sound.ts';
import { phase } from '../../game/night.ts';
import { edit, save } from '../../game/store.ts';
import { artPx } from '../../gfx/artpx.ts';
import { numberPlateURL } from '../../onboard/panelart.ts';
import { flyReward } from '../fx.tsx';
import { breathing, bubble, nightOpen, panel, sceneRef, type Panel } from '../state.ts';
import { TalkText } from '../talkview.tsx';
import { HAND_H, HAND_TIP, HAND_W, handURL } from './art.ts';
import { BACK, resumeAt, TOUR, type Target } from './steps.ts';
import './tutorial.css';

type Beat = 'point' | 'look' | 'back';
type Dir = 'up' | 'down' | 'left' | 'right';
interface Rect { x: number; y: number; w: number; h: number }

const play = (id: string, volume = 0.4, rate = 1) => { try { sound.play(id, { volume, rate, gap: 60 }); } catch { /* no audio */ } };
const owl = () => sceneRef.current?.owl ?? null;

/** what to say to point at a place's own way home */
const BACK_LINE: Partial<Record<NonNullable<Panel>, string>> = {
  shop: 'When you’re done looking, tap *Leave* to come home.',
  build: 'Tap *Done* when you’ve had a look.',
  wardrobe: 'Tap the *cross* to close the wardrobe.',
  quests: 'Tap the *cross* to close the board.',
  profile: 'Tap the *cross* to close it again.',
};

/** the screen box of a target: Pip (the owl's bounds in the 3D room) or an element on the page */
const box3 = new Box3(), v3 = new Vector3();
function rectOf(t: Target | undefined): Rect | null {
  if (!t) return null;
  if (t === 'pip') {
    const sc = sceneRef.current;
    if (!sc) return null;
    box3.setFromObject(sc.owl.node);
    if (box3.isEmpty()) return null;
    const cx = (box3.min.x + box3.max.x) / 2, cz = (box3.min.z + box3.max.z) / 2;
    const top = sc.screenOf(v3.set(cx, box3.max.y, cz)), bot = sc.screenOf(v3.set(cx, box3.min.y, cz));
    if (top.behind || bot.behind) return null;
    const h = Math.max(40, bot.y - top.y), w = h * 0.78;
    return { x: (top.x + bot.x) / 2 - w / 2, y: top.y, w, h };
  }
  for (const el of document.querySelectorAll(t)) {
    const r = (el as HTMLElement).getBoundingClientRect();
    // on screen and not slid away with its hiding HUD
    if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    if ((el as HTMLElement).closest('.away')) continue;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  return null;
}
const same = (a: Rect | null, b: Rect | null) => (!a || !b ? a === b : Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5 && Math.abs(a.w - b.w) < 1.5 && Math.abs(a.h - b.h) < 1.5);

/** which way the glove points at a target, from where the target sits on screen */
function dirFor(r: Rect, pip: boolean): Dir {
  const cx = r.x + r.w / 2;
  if (r.x + r.w > innerWidth - 100 && r.w < innerWidth * 0.4) return 'right';
  if (pip) return cx > innerWidth * 0.3 ? 'right' : 'left';
  if (r.y < innerHeight * 0.3) return 'up';
  if (r.y > innerHeight * 0.5) return 'down';
  return cx > innerWidth / 2 ? 'right' : 'left';
}
/** the glove's anchor (its fingertip) beside the target */
function anchorFor(r: Rect, d: Dir, gap: number) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  return d === 'down' ? { x: cx, y: r.y - gap } : d === 'up' ? { x: cx, y: r.y + r.h + gap } : d === 'right' ? { x: r.x - gap, y: cy } : { x: r.x + r.w + gap, y: cy };
}
const ROT: Record<Dir, number> = { up: 0, right: 90, down: 180, left: -90 };
const DXY: Record<Dir, [number, number]> = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };

/** the hole the dim leaves round a target (a little room round it) */
const holeOf = (r: Rect, pip: boolean): Rect => { const p = pip ? 10 : 10; return { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p }; };

/**
 * Where Pip's words go: beside the target and the glove, inside the screen, never over either. Returns the
 * position of the words' box (left/top of its centre line, and whether it hangs down from `top` or stands up on it).
 */
function sayAt(r: Rect | null, d: Dir | null, hand: Rect | null, sw: number, sh: number, beat: Beat): { cx: number; y: number; up: boolean } {
  const W = innerWidth, H = innerHeight, m = 12;
  const clampX = (x: number) => Math.max(sw / 2 + m, Math.min(W - sw / 2 - m, x));
  if (!r) return beat === 'look' ? { cx: W / 2, y: Math.min(110, H * 0.14), up: false } : { cx: W / 2, y: H * 0.36, up: false };
  const occ = [r, ...(hand ? [hand] : [])];
  const hits = (b: Rect) => occ.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
  const fits = (b: Rect) => b.x >= m - 1 && b.y >= m - 1 && b.x + b.w <= W - m + 1 && b.y + b.h <= H - m + 1 && !hits(b);
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const top = Math.min(r.y, hand?.y ?? r.y), bot = Math.max(r.y + r.h, hand ? hand.y + hand.h : 0), left = Math.min(r.x, hand?.x ?? r.x), right = Math.max(r.x + r.w, hand ? hand.x + hand.w : 0);
  const cand: { b: Rect; at: { cx: number; y: number; up: boolean } }[] = [];
  const above = () => { const x = clampX(cx); cand.push({ b: { x: x - sw / 2, y: top - 10 - sh, w: sw, h: sh }, at: { cx: x, y: top - 10, up: true } }); };
  const below = () => { const x = clampX(cx); cand.push({ b: { x: x - sw / 2, y: bot + 10, w: sw, h: sh }, at: { cx: x, y: bot + 10, up: false } }); };
  const leftOf = () => { const x = left - 14 - sw / 2, y = Math.max(m, Math.min(H - sh - m, cy - sh / 2)); cand.push({ b: { x: x - sw / 2, y, w: sw, h: sh }, at: { cx: x, y, up: false } }); };
  const rightOf = () => { const x = right + 14 + sw / 2, y = Math.max(m, Math.min(H - sh - m, cy - sh / 2)); cand.push({ b: { x: x - sw / 2, y, w: sw, h: sh }, at: { cx: x, y, up: false } }); };
  const order = d === 'down' ? [above, leftOf, rightOf, below] : d === 'up' ? [below, rightOf, leftOf, above] : d === 'right' ? [leftOf, above, below, rightOf] : [rightOf, above, below, leftOf];
  order.forEach((f) => f());
  const ok = cand.find((c) => fits(c.b));
  if (ok) return ok.at;
  // nothing fits cleanly (a small phone): the side with the most room
  return H - bot > top ? { cx: clampX(cx), y: Math.min(H - sh - m, bot + 10), up: false } : { cx: clampX(cx), y: Math.max(sh + m, top - 10), up: true };
}

// ------------------------------------------------------------------ the dim, the ring and the fireflies

function drawDim(g: CanvasRenderingContext2D, dpr: number, hole: Rect | null, pip: boolean, t: number, px: number) {
  const W = innerWidth, H = innerHeight;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.shadowBlur = 0;
  g.clearRect(0, 0, W, H);
  // a warm night: deep plum-indigo, a little darker towards the edges
  g.fillStyle = 'rgba(18, 10, 26, 0.66)';
  g.fillRect(0, 0, W, H);
  const fx = hole ? hole.x + hole.w / 2 : W / 2, fy = hole ? hole.y + hole.h / 2 : H / 2;
  const vg = g.createRadialGradient(fx, fy, Math.min(W, H) * 0.2, fx, fy, Math.max(W, H) * 0.9);
  vg.addColorStop(0, 'rgba(10, 4, 16, 0)'); vg.addColorStop(1, 'rgba(10, 4, 16, 0.32)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  if (!hole) return;
  const rad = pip ? Math.min(hole.w, hole.h) / 2 : Math.min(22, Math.min(hole.w, hole.h) / 2);
  const shape = (inflate: number) => { g.beginPath(); g.roundRect(hole.x - inflate, hole.y - inflate, hole.w + 2 * inflate, hole.h + 2 * inflate, rad + inflate); };
  // the lamplit hole, feathered
  g.globalCompositeOperation = 'destination-out';
  g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = 22 * dpr;
  g.fillStyle = 'rgba(0,0,0,1)';
  shape(0); g.fill();
  g.shadowBlur = 0;
  // a soft amber ring that breathes like a lamp
  const k = 0.5 + 0.5 * Math.sin(t * 2.2);
  g.globalCompositeOperation = 'lighter';
  g.shadowColor = `rgba(255, 170, 70, ${0.7 + 0.3 * k})`; g.shadowBlur = (22 + 14 * k) * dpr;
  g.strokeStyle = `rgba(255, 190, 100, ${0.16 + 0.1 * k})`; g.lineWidth = 9;
  shape(6 + 3 * k); g.stroke();
  g.shadowColor = `rgba(255, 214, 140, ${0.8})`; g.shadowBlur = 6 * dpr;
  g.strokeStyle = `rgba(255, 232, 180, ${0.45 + 0.25 * k})`; g.lineWidth = 1.5;
  shape(6 + 3 * k); g.stroke();
  g.shadowBlur = 0;
  // fireflies circling the ring: whole art pixels, blinking
  const per = 2 * (hole.w + hole.h);
  for (let i = 0; i < 6; i++) {
    const u = ((t * (0.035 + i * 0.004) + i / 6) % 1) * per, out = 10 + 6 * Math.sin(t * 1.3 + i * 2.1);
    let x: number, y: number;
    if (u < hole.w) { x = hole.x + u; y = hole.y - out; }
    else if (u < hole.w + hole.h) { x = hole.x + hole.w + out; y = hole.y + (u - hole.w); }
    else if (u < 2 * hole.w + hole.h) { x = hole.x + hole.w - (u - hole.w - hole.h); y = hole.y + hole.h + out; }
    else { x = hole.x - out; y = hole.y + hole.h - (u - 2 * hole.w - hole.h); }
    const a = Math.max(0, Math.sin(t * (1.7 + i * 0.37) + i * 1.9));
    if (a < 0.05) continue;
    const s = Math.max(2, Math.round(px * 2)), sx = Math.round(x / px) * px, sy = Math.round(y / px) * px;
    const gl = g.createRadialGradient(sx, sy, 0, sx, sy, s * 4);
    gl.addColorStop(0, `rgba(255, 220, 120, ${0.5 * a})`); gl.addColorStop(1, 'rgba(255, 200, 90, 0)');
    g.fillStyle = gl; g.fillRect(sx - s * 4, sy - s * 4, s * 8, s * 8);
    g.fillStyle = `rgba(255, 248, 200, ${a})`;
    g.fillRect(sx - s / 2, sy - s / 2, s, s);
  }
}

// ------------------------------------------------------------------ the tour

/** the tour is on screen when the hollow is in its plain day state */
function useEligible(): boolean {
  const s = save.value;
  const ok = s.onboarded && !s.tutorial?.done && phase.value === 'day' && !breathing.value && !nightOpen.value;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ok) { setReady(false); return undefined; }
    // the loading screen and the interview's iris have to be gone first, then a breath
    let t = 0;
    const check = () => {
      const b = document.getElementById('boot');
      if (b && b.style.display !== 'none' && !b.classList.contains('gone')) { t = window.setTimeout(check, 400); return; }
      t = window.setTimeout(() => setReady(true), 1600);
    };
    check();
    return () => clearTimeout(t);
  }, [ok]);
  return ok && ready;
}

export function Tutorial() {
  const on = useEligible();
  return on ? <Tour /> : null;
}

function Tour() {
  const s = save.value;
  const i = resumeAt(s.tutorial) ?? 0;
  const st = TOUR[i];
  const pv = panel.value;
  // the beat, the line and the hush (Pip's own reaction playing after a tap on him) belong to one stop: a new stop
  // starts pointing at its first line in the very render it arrives (no stale beat for one frame)
  const [bs, setBs] = useState({ i, beat: 'point' as Beat, line: 0, hush: false });
  const mine = bs.i === i;
  const beat: Beat = mine ? bs.beat : 'point', line = mine ? bs.line : 0, hush = mine && bs.hush;
  const setBeat = (b: Beat) => setBs({ i, beat: b, line: 0, hush: false });
  const setLine = (n: number) => setBs({ i, beat, line: n, hush: false });
  const setHush = () => setBs({ i, beat, line, hush: true });
  const [rect, setRect] = useState<Rect | null>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const sayRef = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 320, h: 140 });
  const who = s.profile.you.trim() || 'friend';
  const phone = innerWidth < 600;

  // the stop and its beat: pointing at the button, looking round the place, or finding the way home
  const stray = beat === 'point' && pv !== null && pv !== st.wait;
  const placeOpen = beat !== 'point' && pv !== null;
  const lines = stray ? ['Oops, that’s for later! Let’s go *back* first.']
    : beat === 'look' ? (st.inside ?? [])
    : beat === 'back' ? [BACK_LINE[pv ?? 'sleep'] ?? 'Tap *Back* to come home.']
    : st.say(who);
  const li = Math.min(line, Math.max(0, lines.length - 1));
  const last = li >= lines.length - 1;
  const target: Target | undefined = stray ? BACK[pv!] : beat === 'back' ? (st.back ?? (pv ? BACK[pv] : undefined)) : beat === 'look' ? undefined : (st.target ?? (st.next ? 'pip' : undefined));
  const isPip = target === 'pip';
  // the dim is up while Pip points at something; while you look round a place it lifts (and inside a place it only
  // comes down when the way home is found)
  const dim = beat !== 'look' && !hush && (beat === 'point' && !stray ? true : !!rect);

  /** save the stop (and give its acorns once), then move on */
  const go = (n: number) => {
    // (read from the save itself: a stop that is already passed never moves the tour or pays twice)
    const cur = save.value.tutorial;
    if ((resumeAt(cur) ?? -1) !== i) return;
    const gift = st.gift && !cur?.gift ? st.gift : 0;
    edit((x) => {
      const t = { done: false, step: 0, ...x.tutorial };
      if (gift) { x.coins += gift; t.gift = true; }
      x.tutorial = n >= TOUR.length ? { ...t, done: true, step: TOUR.length - 1 } : { ...t, done: false, step: n };
    });
    if (gift) {
      const b = sayRef.current?.getBoundingClientRect();
      flyReward('acorn', gift, b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : undefined);
      play('reward_quest', 0.5);
    }
    if (n >= TOUR.length) { owl()?.play('dance'); play('ui_confirm', 0.45); }
  };
  const skip = () => {
    play('ui_close', 0.4);
    edit((x) => { x.tutorial = { done: true, step: x.tutorial?.step ?? 0, ...(x.tutorial?.gift ? { gift: true } : {}) }; });
  };
  const next = () => {
    play('ui_tap', 0.35);
    if (!last) { setLine(li + 1); return; }
    if (beat === 'look') { setBeat('back'); return; }
    if (beat === 'point' && (st.next || st.optional)) go(i + 1);
  };
  const canNext = !stray && !hush && (!last || beat === 'look' || (beat === 'point' && (!!st.next || !!st.optional)));
  const nextLabel = last && beat === 'point' && st.next ? st.next : last && beat === 'look' ? 'Got it' : 'Next';

  // Pip turns to you as each stop begins
  useEffect(() => {
    const o = owl();
    if (!o) return;
    bubble.value = null;
    o.setMood(st.id === 'done' || st.id === 'gift' ? 'joy' : 'happy', 2);
    o.play(st.id === 'hello' ? 'wave' : st.id === 'gift' ? 'present' : st.id === 'done' ? 'flap' : 'nod');
  }, [i]);

  // the real actions: a place opens or closes
  useEffect(() => {
    if (beat === 'point' && st.wait && st.wait !== 'pip' && pv === st.wait) { setBeat('look'); play('sparkle', 0.35); return; }
    if (beat !== 'point' && pv === null) { go(i + 1); }
  }, [pv, beat, i]);
  // ... or Pip is tapped (his own reaction plays first)
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc || st.wait !== 'pip' || beat !== 'point') return undefined;
    let t = 0;
    const off = sc.on((e) => { if (e.type === 'tapOwl' && !t) { setHush(); play('sparkle', 0.4); t = window.setTimeout(() => go(i + 1), 1500); } });
    return () => { off(); clearTimeout(t); };
  }, [i, beat]);

  // follow the target every frame (the HUD swings, the camera eases, Pip hops), paint the dim
  useEffect(() => {
    let raf = 0, cur: Rect | null = null;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const r = rectOf(target);
      if (!same(r, cur)) { cur = r; setRect(r); }
      const c = cv.current;
      if (!c) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const g = c.getContext('2d');
      if (g) drawDim(g, dpr, cur ? holeOf(cur, isPip) : null, isPip, (now - t0) / 1000, artPx());
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [target, isPip]);

  // the words' measured size, for placing them
  useLayoutEffect(() => {
    const el = sayRef.current;
    if (!el) return undefined;
    const up = () => { const w = el.offsetWidth, h = el.offsetHeight; setSz((o) => (Math.abs(o.w - w) > 6 || Math.abs(o.h - h) > 6 ? { w, h } : o)); };
    up();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(up) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [i, beat]);

  // the glove
  const hs = Math.max(1, Math.round(artPx() * (phone ? 2.5 : 2.6) * (devicePixelRatio || 1))) / (devicePixelRatio || 1);
  const showRect = rect && dim && !hush ? rect : null;
  const d = showRect ? dirFor(showRect, isPip) : null;
  // (no glove when Pip only talks to you: it points at things to tap, and at the way home)
  const a = showRect && d && !(isPip && beat === 'point' && !st.wait) ? anchorFor(holeOf(showRect, isPip), d, 4) : null;
  const handBox: Rect | null = a && d ? (d === 'down' ? { x: a.x - HAND_W * hs / 2, y: a.y - HAND_H * hs, w: HAND_W * hs, h: HAND_H * hs } : d === 'up' ? { x: a.x - HAND_W * hs / 2, y: a.y, w: HAND_W * hs, h: HAND_H * hs } : d === 'right' ? { x: a.x - HAND_H * hs, y: a.y - HAND_W * hs / 2, w: HAND_H * hs, h: HAND_W * hs } : { x: a.x, y: a.y - HAND_W * hs / 2, w: HAND_H * hs, h: HAND_W * hs }) : null;
  const pos = sayAt(showRect ? holeOf(showRect, isPip) : null, d, handBox, sz.w, sz.h, placeOpen && beat === 'look' ? 'look' : 'point');
  const maxW = Math.round(Math.min(phone ? innerWidth - 28 : 400, innerWidth - 28));

  // the dim swallows taps everywhere except the lamplit hole
  const blocks = (() => {
    if (!dim) return null;
    if (!showRect) return beat === 'back' || stray ? null : [{ x: 0, y: 0, w: innerWidth, h: innerHeight }];
    const h = holeOf(showRect, isPip), W = innerWidth, H = innerHeight;
    return [
      { x: 0, y: 0, w: W, h: Math.max(0, h.y) },
      { x: 0, y: h.y + h.h, w: W, h: Math.max(0, H - h.y - h.h) },
      { x: 0, y: h.y, w: Math.max(0, h.x), h: h.h },
      { x: h.x + h.w, y: h.y, w: Math.max(0, W - h.x - h.w), h: h.h },
    ];
  })();

  const n = TOUR.length;
  const plate = numberPlateURL(40);
  const sayKey = `${i}:${beat}:${stray ? 's' : ''}:${li}`;
  return (
    <div class="tt" role="dialog" aria-label={`Tour of the hollow, step ${i + 1} of ${n}`}>
      <canvas ref={cv} class={'tt-dim' + (dim ? ' on' : '')} aria-hidden="true" />
      {blocks?.map((b, k) => <div key={k} class="tt-block" style={{ left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` }} />)}
      {a && d && (
        <div key={`${i}:${beat}:${d}`} class="tt-hand in" style={{ left: `${a.x}px`, top: `${a.y}px`, '--dx': DXY[d][0], '--dy': DXY[d][1] } as Record<string, string | number>} aria-hidden="true">
          <img src={handURL(hs * (devicePixelRatio || 1))} width={HAND_W * hs} height={HAND_H * hs} alt="" draggable={false}
            style={{ left: `${-HAND_TIP.x * hs}px`, top: `${-HAND_TIP.y * hs}px`, transformOrigin: `${HAND_TIP.x * hs}px ${HAND_TIP.y * hs}px`, transform: `rotate(${ROT[d]}deg)` }} />
        </div>
      )}
      {!hush && (
        <div ref={sayRef} class="tt-say" style={{ left: `${pos.cx}px`, transform: 'translateX(-50%)', ...(pos.up ? { bottom: `${innerHeight - pos.y}px` } : { top: `${pos.y}px` }), width: `${maxW}px` }}>
          <TalkText text={lines[li] ?? null} id={sayKey} who={save.value.name}
            opts={{ size: phone ? 17 : 21, maxWidth: maxW, anchor: pos.up ? 'bottom' : 'top', voice: 'pip', scrim: 0.56, tag: true }}
            onNext={canNext ? next : undefined} />
          <div class="tt-ctl" key={sayKey}>
            <button class="btn soft sm tt-skip" onClick={skip} aria-label="Skip the tour">Skip tour</button>
            <span class="tt-plate" style={{ '--plate': `url("${plate}")` } as Record<string, string>} aria-hidden="true">{i + 1}<small>/</small>{n}</span>
            {canNext && <button class="btn pillow sm" onClick={next}>{nextLabel}</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Start the tour again from the first stop (Settings). The acorns are not given twice. */
export function replayTutorial() {
  edit((x) => { x.tutorial = { done: false, step: 0, ...(x.tutorial?.gift ? { gift: true } : {}) }; });
}
