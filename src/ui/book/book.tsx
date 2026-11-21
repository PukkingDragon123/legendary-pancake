// Pip's big book. Pip hauls a huge leather-bound book in front of the screen on a rope (jerky tugs,
// squash and stretch, dust), the clasp pops and the cover swings open in 3D. Inside, real pages:
// drag a corner and the leaf folds after your finger (front and back faces, shading in the fold,
// the next page underneath), swipe, tap the dog-eared corners, or pull a ribbon tab to jump.
// Closing reverses it all and Pip drags the book away.
//
// Public: <Book /> (rendered by app.tsx while panel.value === 'book'; closes by setting panel to null).
import type { JSX } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { progress } from '../../game/quests.ts';
import { edit, save } from '../../game/store.ts';
import { speciesOf } from '../../owl/species.ts';
import { uiBurst } from '../chrome/uifx.ts';
import { Px } from '../icons.tsx';
import { fmtDur, fmtTime } from '../kit.tsx';
import { Hypnogram } from '../morning.tsx';
import { injectFrameCSS } from '../px/frames.js';
import { blockEdgeArt, claspArt, coverArt, coverBackArt, coverGeo, cornerArt, endpaperArt, halfArt, moodArt, pageArt, pipArt, ribbonArt, spineArt, stickerArt, tabArt, tapeArt } from '../px/bookart.js';
import { panel, sceneRef } from '../state.ts';
import { fold, foldGradient, polyCSS, turnPath, type Corner, type Pt } from './fold.ts';
import { layout, type BookLayout } from './layout.ts';
import { buildPages, SECTIONS, type PageCtx, type PageDef, type SectionId } from './pages.tsx';
import { reported, scoreInk, scoreWord, type Night } from './stats.ts';
import './book.css';

type Role = 'L' | 'R' | 'S' | 'front' | 'back' | 'under';
interface Turn { from: number; to: number; dir: 1 | -1; corner: Corner; played: boolean }
type Phase = 'enter' | 'open' | 'exit';

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const eOut3 = (t: number) => 1 - (1 - t) ** 3;
const eIO2 = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const eOutBack = (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sfx = (id: string, volume = 0.5, rate?: number) => { try { sound.play(id, { volume, rate, gap: 30 }); } catch { /* sound not ready */ } };
const owl = () => sceneRef.current?.owl;
const owlDo = (f: (o: NonNullable<ReturnType<typeof owl>>) => void) => { try { const o = owl(); if (o) f(o); } catch { /* scene busy */ } };
const reduced = () => { try { return save.value.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// dev-only knobs for screenshots: ?bk=enter:0.5 | exit:0.6 | open | flip:0.4 | night | page:N
const DEV = (() => { try { return import.meta.env.DEV ? new URLSearchParams(location.search).get('bk') ?? '' : ''; } catch { return ''; } })();
let openedBefore = false;

// ------------------------------------------------------------------ timeline

const TUG = 430;
function enterPlan(tugs: number) {
  const drag0 = 260, drag1 = drag0 + tugs * TUG, arrive = drag1 + 380, clasp = drag1 + 470, cover0 = clasp + 240, cover1 = cover0 + 760;
  return { tugs, drag0, drag1, arrive, clasp, cover0, cover1, total: cover1 + 40 };
}
function exitPlan(tugs: number) {
  const cover1 = 470, clasp = 540, hop0 = 560, hop1 = 900, tilt1 = 1080, drag0 = 1080, drag1 = drag0 + tugs * TUG;
  return { tugs, cover1, clasp, hop0, hop1, tilt1, drag0, drag1, total: drag1 + 60 };
}

// ------------------------------------------------------------------ the component

export function Book() {
  const [L, setL] = useState<BookLayout>(() => layout(innerWidth, innerHeight));
  const s = save.value;
  const pages = useMemo(() => buildPages(s, L), [s, L]);
  const spreads = L.single ? pages.length : pages.length / 2;
  const [at, setAt] = useState(() => {
    const m = /^page:(\d+)/.exec(DEV);
    if (!m) return 0;
    const i = Math.min(pages.length - 1, +m[1]);
    return L.single ? i : Math.floor(i / 2);
  });
  const [turn, setTurn] = useState<Turn | null>(null);
  const [phase, setPhase] = useState<Phase>('enter');
  const [night, setNight] = useState<string | null>(DEV === 'night' ? reported(s).at(-1)?.id ?? null : null);
  const [shut, setShut] = useState(true); // the cover is still (or again) on top

  const stage = useRef<HTMLDivElement>(null), mover = useRef<HTMLDivElement>(null), bookEl = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDivElement>(null), clasp = useRef<HTMLImageElement>(null), dim = useRef<HTMLDivElement>(null);
  const pip = useRef<HTMLImageElement>(null), rope = useRef<HTMLCanvasElement>(null), ring = useRef<HTMLSpanElement>(null);
  const pagesEl = useRef<HTMLDivElement>(null), flapShadow = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const turnRef = useRef<Turn | null>(null);
  const P = useRef<Pt>({ x: 0, y: 0 });
  const tl = useRef<{ kind: 'enter' | 'exit'; t0: number; last: number; plan: ReturnType<typeof enterPlan> | ReturnType<typeof exitPlan> } | null>(null);
  const freeze = useRef<{ kind: string; t: number } | null>(null);
  const pipState = useRef({ frame: 'stand', x: 0, y: 0, rot: 0, ropeA: 0, hopAt: 0, blinkAt: performance.now() + 2500 });
  const turnAnim = useRef<{ from: Pt; to: Pt; t0: number; ms: number; played: boolean; complete: boolean } | null>(null);
  const LRef = useRef(L); LRef.current = L;
  const atRef = useRef(at); atRef.current = at;
  const phaseRef = useRef(phase); phaseRef.current = phase;

  const look = s.look, sp = speciesOf(look.species), cap = look.outfit?.head === 'nightcap';
  const pipFrame = (f: string) => pipArt(f as 'stand', look.species ?? 'tawny', sp.eye, cap).url;

  // ---------------------------------------------------------------- roles of mounted pages
  type Slot = { idx: number | 'blank'; role: Role };
  const slots: Slot[] = useMemo(() => {
    if (!turn) return L.single ? [{ idx: at, role: 'S' }] : [{ idx: 2 * at, role: 'L' }, { idx: 2 * at + 1, role: 'R' }];
    const a = turn.from, b = turn.to;
    if (L.single) return turn.dir > 0 ? [{ idx: a, role: 'front' }, { idx: 'blank', role: 'back' }, { idx: b, role: 'under' }] : [{ idx: b, role: 'front' }, { idx: 'blank', role: 'back' }, { idx: a, role: 'under' }];
    return turn.dir > 0
      ? [{ idx: 2 * a, role: 'L' }, { idx: 2 * a + 1, role: 'front' }, { idx: 2 * b, role: 'back' }, { idx: 2 * b + 1, role: 'under' }]
      : [{ idx: 2 * b, role: 'L' }, { idx: 2 * b + 1, role: 'front' }, { idx: 2 * a, role: 'back' }, { idx: 2 * a + 1, role: 'under' }];
  }, [turn, at, L.single]);
  const keyOf = (idx: number | 'blank') => (idx === 'blank' ? 'blank-back' : pages[idx]?.key ?? 'none' + idx);

  // ---------------------------------------------------------------- applying the fold
  const shade = (n: HTMLElement | undefined) => n?.querySelector<HTMLElement>(':scope > .bk-shade');
  function applyRoles() {
    const T = LRef.current;
    for (const sl of slots) {
      const n = nodes.current.get(keyOf(sl.idx));
      if (!n) continue;
      n.style.clipPath = '';
      n.style.opacity = '';
      n.style.transform = sl.role === 'L' ? `translateX(${-T.PW}px)` : '';
      const sh = shade(n); if (sh) sh.style.background = '';
    }
    if (flapShadow.current) flapShadow.current.style.clipPath = 'polygon(0 0, 0 0, 0 0)';
    if (turnRef.current) applyFold();
  }
  function applyFold() {
    const t = turnRef.current, T = LRef.current;
    if (!t) return;
    const W = T.PW, H = T.PH;
    const f = fold(P.current, t.corner, W, H);
    const find = (r: Role) => { const sl = slots.find((x) => x.role === r); return sl ? nodes.current.get(keyOf(sl.idx)) : undefined; };
    const front = find('front'), back = find('back'), under = find('under');
    if (front) {
      front.style.clipPath = polyCSS(f.front);
      const sh = shade(front);
      if (sh) sh.style.background = f.t > 0.001 ? foldGradient(W, H, f.m, { x: -f.n.x, y: -f.n.y }, [[0, 'rgba(60,30,10,.24)'], [8, 'rgba(60,30,10,.12)'], [34, 'rgba(60,30,10,0)']]) : '';
    }
    if (back) {
      back.style.transform = `matrix(${f.matrix.map((v) => v.toFixed(5)).join(',')})`;
      back.style.clipPath = polyCSS(f.back);
      back.style.opacity = T.single && f.t > 0.7 ? String(clamp(1 - (f.t - 0.7) / 0.3, 0, 1)) : '';
      const sh = shade(back);
      const ml = { x: W - f.m.x, y: f.m.y }, nl = { x: -f.n.x, y: f.n.y };
      if (sh) sh.style.background = foldGradient(W, H, ml, nl, [[0, 'rgba(40,20,6,.34)'], [3, 'rgba(255,248,230,.32)'], [14, 'rgba(255,248,230,.06)'], [40, 'rgba(255,248,230,0)'], [Math.max(60, W * 0.9), 'rgba(40,20,6,.08)']]);
    }
    if (under) {
      const sh = shade(under);
      if (sh) sh.style.background = f.t > 0.001 ? foldGradient(W, H, f.m, f.n, [[0, 'rgba(20,10,4,.42)'], [10 + 46 * (1 - f.t), 'rgba(20,10,4,0)']]) : '';
    }
    if (flapShadow.current) {
      const k = T.T;
      flapShadow.current.style.clipPath = f.flap.length > 2 ? polyCSS(f.flap.map((q) => ({ x: q.x + W + 2 * k, y: q.y + H * 0.25 + 3 * k }))) : 'polygon(0 0, 0 0, 0 0)';
      flapShadow.current.style.opacity = T.single && f.t > 0.7 ? String(clamp(1 - (f.t - 0.7) / 0.3, 0, 1)) : '1';
    }
  }
  useLayoutEffect(applyRoles);

  // ---------------------------------------------------------------- turning
  const cornerY = (c: Corner) => (c === 'bottom' ? LRef.current.PH : 0);
  function startTurn(to: number, corner: Corner, played: boolean): boolean {
    if (turnRef.current || phaseRef.current !== 'open' || to === atRef.current || to < 0 || to >= spreads) return false;
    const dir = to > atRef.current ? 1 : -1;
    const t: Turn = { from: atRef.current, to, dir, corner, played };
    turnRef.current = t;
    P.current = { x: dir > 0 ? LRef.current.PW : -LRef.current.PW, y: cornerY(corner) };
    setTurn(t);
    return true;
  }
  function finishTurn(complete: boolean) {
    const t = turnRef.current;
    if (!t) return;
    turnRef.current = null;
    turnAnim.current = null;
    if (complete) { setAt(t.to); pipState.current.hopAt = performance.now(); }
    setTurn(null);
  }
  function animateTo(complete: boolean, ms: number) {
    const t = turnRef.current;
    if (!t) return;
    const W = LRef.current.PW;
    const endX = (complete ? t.dir > 0 : t.dir < 0) ? -W : W;
    turnAnim.current = { from: { ...P.current }, to: { x: endX, y: cornerY(t.corner) }, t0: performance.now(), ms, played: false, complete };
  }
  /** Turn to a spread (or page, on phones) with a played page turn. */
  function flipTo(to: number) {
    to = clamp(to, 0, spreads - 1);
    if (!startTurn(to, 'bottom', true)) return;
    const jump = Math.abs(to - atRef.current);
    sfx('paper_flip', 0.55, 0.9 + Math.random() * 0.2);
    if (jump > 1) { setTimeout(() => sfx('paper_flip', 0.4, 1.25), 110); setTimeout(() => sfx('paper_flip', 0.35, 1.1), 220); }
    turnAnim.current = { from: { ...P.current }, to: { x: 0, y: 0 }, t0: performance.now(), ms: reduced() ? 260 : LRef.current.single ? 560 : 680, played: true, complete: true };
  }
  const go = (sec: SectionId) => {
    const i = pages.findIndex((p) => p.section === sec);
    if (i < 0) return;
    flipTo(L.single ? i : Math.floor(i / 2));
  };
  const sectionNum = useMemo(() => {
    const o: Partial<Record<SectionId, number>> = {};
    const first = L.single ? 0 : 1;
    pages.forEach((p, i) => { if (o[p.section] === undefined) o[p.section] = i - first + 1; });
    return o;
  }, [pages, L.single]);

  // ---------------------------------------------------------------- drag to turn
  const drag = useRef<{ id: number; x0: number; y0: number; on: boolean; k: number; start: Pt; vx: number; lx: number; lt: number; moved: boolean } | null>(null);
  const local = (e: PointerEvent) => { const r = pagesEl.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  function onDown(e: PointerEvent) {
    if (phaseRef.current !== 'open' || turnRef.current || night || e.button > 0) return;
    const q = local(e);
    drag.current = { id: e.pointerId, x0: q.x, y0: q.y, on: false, k: 1, start: { x: 0, y: 0 }, vx: 0, lx: q.x, lt: performance.now(), moved: false };
  }
  function onMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const q = local(e), dx = q.x - d.x0, dy = q.y - d.y0, T = LRef.current;
    const now = performance.now();
    d.vx = (q.x - d.lx) / Math.max(1, now - d.lt); d.lx = q.x; d.lt = now;
    if (!d.on) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.1) { if (Math.hypot(dx, dy) > 14) drag.current = null; return; }
      const leftHalf = T.single ? dx > 0 : d.x0 < 0;
      const dir = leftHalf ? -1 : 1;
      if ((dir > 0 && dx > 0) || (dir < 0 && dx < 0)) { drag.current = null; return; }
      const corner: Corner = d.y0 > T.PH / 2 ? 'bottom' : 'top';
      if (!startTurn(atRef.current + dir, corner, false)) { drag.current = null; return; }
      d.on = true; d.moved = true;
      const cx = dir > 0 ? T.PW : -T.PW, cy = cornerY(corner);
      d.start = { x: cx, y: cy };
      const nearCorner = Math.hypot(d.x0 - cx, d.y0 - cy) < 80;
      d.k = T.single && dir < 0 ? 2.2 : nearCorner ? 1 : 1.3;
      try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* */ }
      sfx('paper_flip', 0.3, 1.3);
    }
    P.current = { x: d.start.x + dx * d.k, y: d.start.y + dy * (d.k === 1 ? 1 : 0.7) };
    applyFold();
  }
  function onUp(e: PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.on || d.id !== e.pointerId) return;
    const t = turnRef.current, W = LRef.current.PW;
    if (!t) return;
    lastDragEnd.current = performance.now();
    const x = P.current.x;
    const complete = t.dir > 0 ? x < W * 0.3 || d.vx < -0.45 : x > -W * 0.3 || d.vx > 0.45;
    const dist = Math.abs((complete === (t.dir > 0) ? -W : W) - x);
    animateTo(complete, clamp(dist / (W * 2) * 520, 140, 460));
    if (complete) sfx('paper_flip', 0.5, 0.95 + Math.random() * 0.15);
  }
  // swallow the click that ends a drag so buttons under the finger do not fire
  const onClickCapture = (e: MouseEvent) => { if (lastDragEnd.current && performance.now() - lastDragEnd.current < 250) { e.stopPropagation(); e.preventDefault(); } };
  const lastDragEnd = useRef(0);

  // ---------------------------------------------------------------- open / close
  const close = () => {
    if (phaseRef.current !== 'open' || turnRef.current) return;
    if (night) { setNight(null); return; }
    if (reduced()) { panel.value = null; return; }
    sfx('paper_flip', 0.5, 0.85);
    owlDo((o) => { o.play('nod'); o.setMood('happy', 2); });
    setShut(true);
    setPhase('exit');
    tl.current = { kind: 'exit', t0: performance.now(), last: 0, plan: exitPlan(openedBefore ? 2 : 3) };
  };

  // the entrance starts on mount
  useEffect(() => {
    injectFrameCSS();
    const tugs = openedBefore ? 2 : 4;
    openedBefore = true;
    if (DEV.startsWith('enter:') || DEV.startsWith('exit:')) { const [k, v] = DEV.split(':'); freeze.current = { kind: k, t: +v }; }
    if (DEV === 'open' || DEV.startsWith('flip') || DEV.startsWith('page') || DEV === 'night' || reduced() || DEV.startsWith('exit')) {
      setShut(false); setPhase('open');
      if (DEV.startsWith('exit:')) setTimeout(() => { setShut(true); setPhase('exit'); tl.current = { kind: 'exit', t0: performance.now(), last: 0, plan: exitPlan(3) }; }, 60);
    } else {
      tl.current = { kind: 'enter', t0: performance.now(), last: 0, plan: enterPlan(tugs) };
      owlDo((o) => { o.setMood('excited', 3); o.play('stretch'); });
      sfx('fabric', 0.4);
    }
    const onKey = (e: KeyboardEvent) => {
      const a = api.current;
      if (e.key === 'Escape') { e.preventDefault(); a.close(); }
      if (phaseRef.current !== 'open' || a.night) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') a.flipTo(atRef.current + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') a.flipTo(atRef.current - 1);
    };
    addEventListener('keydown', onKey);
    let rt = 0;
    const onResize = () => { clearTimeout(rt); rt = window.setTimeout(() => setL(layout(innerWidth, innerHeight)), 160); };
    addEventListener('resize', onResize);
    return () => { removeEventListener('keydown', onKey); removeEventListener('resize', onResize); clearTimeout(rt); };
  }, []);

  // keep the same page in view when the layout changes between one page and a spread
  const prevL = useRef(L);
  useEffect(() => {
    const was = prevL.current;
    prevL.current = L;
    if (was.single === L.single) return;
    const oldPages = buildPages(save.value, was), idx = was.single ? atRef.current : 2 * atRef.current + 1;
    const key = oldPages[Math.min(idx, oldPages.length - 1)]?.key;
    const ni = Math.max(0, pages.findIndex((p) => p.key === key));
    setAt(L.single ? ni : Math.floor(ni / 2));
  }, [L]);

  // dev: freeze a turn half way (?bk=flip:0.4)
  useEffect(() => {
    if (phase !== 'open' || !DEV.startsWith('flip')) return;
    const k = +(DEV.split(':')[1] ?? 0.4);
    if (startTurn(atRef.current + 1, 'bottom', true)) { const T = LRef.current; P.current = turnPath(k, 'bottom', T.PW, T.PH, T.PW, -T.PW); freeze.current = { kind: 'flip', t: k }; }
  }, [phase]);

  // ---------------------------------------------------------------- the frame loop
  // (the loop and the key handler live for the whole mount; they call the latest closures via api)
  useEffect(() => {
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const T = LRef.current;
      // page turn animation
      const ta = turnAnim.current, t = turnRef.current;
      if (ta && t && freeze.current?.kind !== 'flip') {
        const k = clamp((now - ta.t0) / ta.ms, 0, 1);
        if (ta.played) P.current = turnPath(k, t.corner, T.PW, T.PH, t.dir > 0 ? T.PW : -T.PW, t.dir > 0 ? -T.PW : T.PW);
        else { const e = eOut3(k); P.current = { x: lerp(ta.from.x, ta.to.x, e), y: lerp(ta.from.y, ta.to.y, e) - Math.sin(Math.PI * k) * T.PH * 0.05 * (t.corner === 'bottom' ? 1 : -1) }; }
        api.current.applyFold();
        if (k >= 1) { lastDragEnd.current = now; api.current.finishTurn(ta.complete); }
      }
      // entrance / exit
      const tline = tl.current;
      if (tline) {
        const el = freeze.current && (freeze.current.kind === tline.kind) ? freeze.current.t * tline.plan.total : now - tline.t0;
        if (tline.kind === 'enter') api.current.poseEnter(el, tline.last, tline.plan as ReturnType<typeof enterPlan>);
        else api.current.poseExit(el, tline.last, tline.plan as ReturnType<typeof exitPlan>);
        tline.last = el;
        if (el >= tline.plan.total && !freeze.current) {
          tl.current = null;
          if (tline.kind === 'enter') { setPhase('open'); setShut(false); owlDo((o) => { o.play('present'); o.setMood('proud', 2); }); }
          else { panel.value = null; return; }
        }
      } else if (phaseRef.current === 'open') api.current.idlePip(now);
      api.current.drawPip();
      api.current.drawRope();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---------------------------------------------------------------- choreography
  // the shut book's cover edge on screen, given the mover's x offset
  const coverLeft = (off: number) => { const T = LRef.current; return T.x + T.cx + T.shut + off; };
  const dragSpot = (off: number) => {
    const T = LRef.current, size = T.pip.size;
    return T.single ? { x: coverLeft(off) + 10, y: T.y + T.BH + T.TAIL * T.T + size * 0.9 } : { x: coverLeft(off) - T.D * T.T * 0.6 - size - 34, y: T.y + T.BH + 4 };
  };
  function setMover(x: number, y: number, rotY: number, sx: number, sy: number, rz = 0) {
    const m = mover.current;
    if (m) m.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotateY(${rotY.toFixed(2)}deg) rotateX(${(-rotY * 0.3).toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
  }
  function setCover(a: number) {
    const c = cover.current, T = LRef.current;
    if (!c) return;
    c.style.transform = `translateZ(1px) rotateY(${a.toFixed(2)}deg)`;
    c.style.opacity = T.single && a < -100 ? String(clamp(1 - (-a - 100) / 50, 0, 1)) : '';
  }
  // x offset of the book during tugs: k-th tug moves 1/n of the way, with a little overshoot and squash
  function tugPose(el: number, t0: number, n: number, from: number, to: number) {
    const i = clamp(Math.floor((el - t0) / TUG), 0, n - 1), u = clamp((el - t0 - i * TUG) / TUG, 0, 1);
    const a = lerp(from, to, i / n), b = lerp(from, to, (i + 1) / n);
    const mv = 0.36;
    let x: number, sx = 1, sy = 1, rz = 0, strain = false;
    if (u < mv) { const e = eOut3(u / mv); x = lerp(a, b + (b - a) * 0.05, e); const k = Math.sin(Math.PI * (u / mv)); sx = 1 - 0.075 * k; sy = 1 + 0.05 * k; rz = -1.6 * k * Math.sign(b - a || 1); strain = true; }
    else { const v = (u - mv) / (1 - mv); x = lerp(b + (b - a) * 0.05, b, eOut3(v)); const w = Math.sin(v * Math.PI * 2) * (1 - v); sx = 1 + 0.03 * w; sy = 1 - 0.02 * w; strain = v < 0.2; }
    return { x, sx, sy, rz, strain, i, u };
  }
  const fired = (el: number, last: number, at: number) => last < at && el >= at;
  function poseEnter(el: number, last: number, p: ReturnType<typeof enterPlan>) {
    const T = LRef.current, ps = pipState.current;
    const startOff = T.vw + 40 - (T.x + T.cx + T.shut) + T.D * T.T;
    if (dim.current) dim.current.style.opacity = String(clamp(el / 320, 0, 1));
    let off = startOff, sx = 1, sy = 1, rz = 0, y = 0, tilt = 16;
    if (el < p.drag0) off = startOff;
    else if (el < p.drag1) {
      const q = tugPose(el, p.drag0, p.tugs, startOff, 0);
      off = q.x; sx = q.sx; sy = q.sy; rz = q.rz;
      ps.frame = q.strain ? 'pull2' : 'pull';
      for (let k = 0; k < p.tugs; k++) {
        const at = p.drag0 + k * TUG;
        if (fired(el, last, at)) {
          sfx('wood_knock', 0.32, 0.7 + Math.random() * 0.15); sfx('fabric', 0.28, 0.8 + k * 0.08);
          const cl = coverLeft(lerp(startOff, 0, (k + 1) / p.tugs));
          uiBurst('puff', cl + 20, T.y + T.BH - 4, 5); uiBurst('puff', cl + T.cw - 10, T.y + T.BH - 2, 4);
          owlDo((o) => o.play('peck'));
        }
      }
    } else { off = 0; ps.frame = 'phew'; }
    if (el >= p.drag1) {
      const u = clamp((el - p.drag1) / (p.arrive - p.drag1), 0, 1);
      tilt = 16 * (1 - eOutBack(u));
      y = -Math.sin(Math.PI * u) * 14;
      if (fired(el, last, p.drag1 + (p.arrive - p.drag1) * 0.9)) { sfx('wood_knock', 0.55, 0.6); sfx('pet_land', 0.4); uiBurst('puff', coverLeft(0) + 12, T.y + T.BH, 8); uiBurst('puff', coverLeft(0) + T.cw - 12, T.y + T.BH, 8); }
    }
    // the shut book centres itself; then the spread slides over as the cover opens
    let shift = T.shut, coverA = 0;
    if (el >= p.cover0) {
      const u = clamp((el - p.cover0) / (p.cover1 - p.cover0), 0, 1), e = eIO2(u);
      coverA = -180 * e; shift = lerp(T.shut, 0, eIO2(clamp(u * 1.15, 0, 1)));
      if (fired(el, last, p.cover0 + (p.cover1 - p.cover0) * 0.42)) sfx('paper_flip', 0.6, 0.85);
      if (fired(el, last, p.cover0 + 10)) { sfx('fabric', 0.35, 1.2); stage.current?.classList.add('bk-opening'); }
    }
    setMover(off + shift, y, tilt, sx, sy, rz);
    setCover(coverA);
    // the clasp pops open with a sparkle
    const c = clasp.current;
    if (c) {
      const u = clamp((el - p.clasp) / 260, 0, 1);
      c.style.transform = u > 0 ? `translate(${(u * 26).toFixed(1)}px, ${(-Math.sin(u * Math.PI) * 16).toFixed(1)}px) rotate(${(u * 70).toFixed(1)}deg)` : '';
      c.style.opacity = String(1 - clamp((u - 0.5) * 2, 0, 1));
      if (fired(el, last, p.clasp)) { sfx('ui_toggle', 0.6, 0.8); sfx('sparkle', 0.4); const r = c.getBoundingClientRect(); uiBurst('sparkle', r.left + r.width / 2, r.top + r.height / 2, 10); }
    }
    // Pip: hauling on the rope, then a sigh of relief and a hop to his spot beside the book
    const spot = dragSpot(el < p.drag1 ? off : 0);
    if (el < p.drag1) { ps.x = spot.x; ps.y = spot.y; ps.rot = ps.frame === 'pull2' ? -7 : -3; ps.ropeA = 1; }
    else {
      const hop0 = p.drag1 + 420, hop1 = hop0 + 420, rest = T.pip;
      const u = clamp((el - hop0) / (hop1 - hop0), 0, 1);
      ps.x = lerp(spot.x, rest.x, eIO2(u)); ps.y = lerp(spot.y, rest.y, u) - Math.sin(Math.PI * u) * 40; ps.rot = 0;
      ps.frame = el < hop0 ? 'phew' : u < 1 ? 'hop' : 'stand';
      ps.ropeA = clamp(1 - (el - p.drag1) / 380, 0, 1);
      if (fired(el, last, hop0)) sfx('pet_jump', 0.4);
      if (fired(el, last, hop1)) sfx('pet_land', 0.3);
    }
  }
  function poseExit(el: number, last: number, p: ReturnType<typeof exitPlan>) {
    const T = LRef.current, ps = pipState.current;
    const u = clamp(el / p.cover1, 0, 1), e = eIO2(u);
    setCover(-180 * (1 - e));
    const shift = lerp(0, T.shut, e);
    const endOff = -(T.x + T.cx + T.shut + T.cw + T.D * T.T + T.pip.size * 2 + 120);
    let off = 0, sx = 1, sy = 1, rz = 0, tilt = 0;
    if (el >= p.hop1) tilt = 16 * eOut3(clamp((el - p.hop1) / (p.tilt1 - p.hop1 + 1), 0, 1));
    if (el >= p.drag0) {
      const q = tugPose(el, p.drag0, p.tugs, 0, endOff);
      off = q.x; sx = q.sx; sy = q.sy; rz = q.rz;
      ps.frame = q.strain ? 'pull2' : 'pull';
      for (let k = 0; k < p.tugs; k++) if (fired(el, last, p.drag0 + k * TUG)) { sfx('wood_knock', 0.3, 0.75); sfx('fabric', 0.25, 0.9); const cl = coverLeft(lerp(0, endOff, (k + 1) / p.tugs)); uiBurst('puff', cl + T.cw - 10, T.y + T.BH - 2, 5); }
    }
    setMover(off + shift, 0, tilt, sx, sy, rz);
    if (fired(el, last, p.clasp)) { sfx('ui_toggle', 0.5, 1.1); sfx('wood_knock', 0.35, 0.9); }
    const c = clasp.current;
    if (c) { const v = clamp((el - p.clasp + 160) / 160, 0, 1); c.style.transform = v < 1 ? `translate(${((1 - v) * 26).toFixed(1)}px, 0) rotate(${((1 - v) * 70).toFixed(1)}deg)` : ''; c.style.opacity = String(v); }
    if (dim.current) dim.current.style.opacity = String(1 - clamp((el - (p.total - 420)) / 420, 0, 1));
    const spot = dragSpot(off + shift - T.shut);
    if (el < p.hop0) { ps.x = T.pip.x; ps.y = T.pip.y; ps.frame = 'stand'; ps.ropeA = 0; }
    else if (el < p.hop1) {
      const v = clamp((el - p.hop0) / (p.hop1 - p.hop0), 0, 1);
      ps.x = lerp(T.pip.x, spot.x, eIO2(v)); ps.y = lerp(T.pip.y, spot.y, v) - Math.sin(Math.PI * v) * 36; ps.frame = 'hop'; ps.ropeA = v;
      if (fired(el, last, p.hop0)) sfx('pet_jump', 0.4);
    } else { ps.x = spot.x; ps.y = spot.y; ps.ropeA = 1; if (el < p.drag0) ps.frame = 'pull'; ps.rot = ps.frame === 'pull2' ? -7 : -3; }
    if (fired(el, last, p.hop1)) owlDo((o) => o.play('wave'));
  }
  function idlePip(now: number) {
    const ps = pipState.current, T = LRef.current;
    ps.x = T.pip.x; ps.rot = 0; ps.ropeA = 0;
    const h = now - ps.hopAt;
    if (h < 420) { ps.frame = 'hop'; ps.y = T.pip.y - Math.sin(Math.PI * (h / 420)) * 22; return; }
    ps.y = T.pip.y;
    if (now > ps.blinkAt) { ps.frame = 'blink'; if (now > ps.blinkAt + 140) { ps.blinkAt = now + 2200 + Math.random() * 3000; ps.frame = 'stand'; } }
    else ps.frame = 'stand';
  }
  const lastFrame = useRef('');
  function drawPip() {
    const el = pip.current, ps = pipState.current, T = LRef.current;
    if (!el) return;
    if (lastFrame.current !== ps.frame) { el.src = pipFrame(ps.frame); lastFrame.current = ps.frame; }
    el.style.transform = `translate(${Math.round(ps.x)}px, ${Math.round(ps.y - T.pip.size)}px) rotate(${ps.rot}deg)`;
  }
  function drawRope() {
    const cv = rope.current, ps = pipState.current, T = LRef.current;
    if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (cv.width !== Math.round(T.vw * dpr)) { cv.width = Math.round(T.vw * dpr); cv.height = Math.round(T.vh * dpr); }
    const g = cv.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, T.vw, T.vh);
    if (ps.ropeA <= 0.01 || !ring.current) return;
    const r = ring.current.getBoundingClientRect();
    const hx = ps.x + T.pip.size * 0.93, hy = ps.y - T.pip.size * 0.47, ex = r.left + r.width / 2, ey = r.top + r.height / 2;
    const taut = ps.frame === 'pull2' ? 2 : ps.frame === 'pull' ? 6 : 34;
    const mx = (hx + ex) / 2, my = (hy + ey) / 2 + taut;
    const len = Math.hypot(ex - hx, ey - hy), n = Math.max(4, Math.round(len / T.T));
    g.globalAlpha = ps.ropeA;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = (1 - t) * (1 - t) * hx + 2 * (1 - t) * t * mx + t * t * ex, y = (1 - t) * (1 - t) * hy + 2 * (1 - t) * t * my + t * t * ey;
      const X = Math.round(x / T.T) * T.T, Y = Math.round(y / T.T) * T.T;
      g.fillStyle = '#3a2412'; g.fillRect(X - T.T, Y - T.T, T.T * 2, T.T * 3);
      g.fillStyle = i % 3 === 0 ? '#8a5a2a' : i % 3 === 1 ? '#c89656' : '#e0b878'; g.fillRect(X - T.T / 2, Y - T.T / 2, T.T, T.T * 2);
    }
    g.globalAlpha = 1;
  }

  const api = useRef(null as unknown as { applyFold: () => void; finishTurn: (c: boolean) => void; poseEnter: typeof poseEnter; poseExit: typeof poseExit; idlePip: typeof idlePip; drawPip: () => void; drawRope: () => void; close: () => void; flipTo: (n: number) => void; night: string | null });
  api.current = { applyFold, finishTurn, poseEnter, poseExit, idlePip, drawPip, drawRope, close, flipTo, night };

  // ---------------------------------------------------------------- render
  const T = L.T, sideOf = (idx: number | 'blank'): 'L' | 'R' | 'S' => (L.single || idx === 'blank' ? 'S' : idx % 2 ? 'R' : 'L');
  const depthL = L.single ? 0 : at === 0 ? 0 : 1 + Math.round((2 * at) / Math.max(1, spreads - 1));
  const depthR = L.single ? 2 + Math.round(2 * (1 - at / Math.max(1, spreads - 1))) : at >= spreads - 1 ? 1 : 1 + Math.round(2 * (1 - at / Math.max(1, spreads - 1)));
  const hL = L.single ? null : halfArt('L', L.pw, L.ph, L.B, depthL), hR = halfArt(L.single ? 'S' : 'R', L.pw, L.ph, L.B, depthR);
  const rules = { r0: L.r0 / T, step: L.rule / T };
  const paperOf = (def: PageDef | null, side: 'L' | 'R' | 'S', idx: number | 'blank') => def?.paper === 'endpaper' ? endpaperArt(L.pw, L.ph).url : pageArt(L.pw, L.ph, side, def ? (def.paper as 'plain') : 'plain', 5 + (typeof idx === 'number' ? idx % 5 : 9), def?.paper === 'rules' ? rules : null).url;
  const cw = L.PW - 21 * T;
  const curSection = pages[L.single ? at : Math.min(pages.length - 1, 2 * at + 1)]?.section;
  const firstOf = (sec: SectionId) => pages.findIndex((p) => p.section === sec);
  const leftIdx = L.single ? at : 2 * at;
  const nightObj = night ? reported(s).find((n) => n.id === night) : undefined;
  const G = coverGeo(L.cw / T, L.H);

  const PageView = (sl: Slot) => {
    const idx = sl.idx, def = idx === 'blank' ? null : pages[idx] ?? null, side = sideOf(idx), key = keyOf(idx);
    const num = idx === 'blank' || !def || def.paper === 'endpaper' ? 0 : (idx as number) - (L.single ? 0 : 1) + 1;
    const ctx: PageCtx = { L, side, num, cw, go, openNight: setNight, sectionNum };
    const isBase = sl.role === 'L' || sl.role === 'R' || sl.role === 'S';
    const canNext = L.single ? at < spreads - 1 : at < spreads - 1, canPrev = at > 0;
    return (
      <div key={key} class={`bk-page side-${side} role-${sl.role}${def?.paper === 'endpaper' ? ' is-endpaper' : ''}`} ref={(n) => { if (n) nodes.current.set(key, n); else nodes.current.delete(key); }}
        style={{ width: `${L.PW}px`, height: `${L.PH}px`, backgroundImage: `url(${paperOf(def, side, idx)})` }}>
        <div class="bk-pc">{def ? def.render(ctx) : <div class="bk-ghost" />}</div>
        {num > 0 && <span class="bk-num">{num}</span>}
        {isBase && (sl.role === 'R' || sl.role === 'S') && canNext && <button class="bk-dog r" aria-label="Next page" onClick={(e) => { e.stopPropagation(); flipTo(at + 1); }}><img src={cornerArt('R').url} alt="" draggable={false} style={{ width: `${15 * T}px` }} /></button>}
        {isBase && (sl.role === 'L' || sl.role === 'S') && canPrev && <button class="bk-dog l" aria-label="Previous page" onClick={(e) => { e.stopPropagation(); flipTo(at - 1); }}><img src={cornerArt('L').url} alt="" draggable={false} style={{ width: `${15 * T}px` }} /></button>}
        <i class="bk-shade" />
      </div>
    );
  };

  // ribbon tabs: sections still ahead stick out of the right edge, those already passed out of the left
  const tabs = SECTIONS.map((sec, i) => {
    const f = firstOf(sec.id), active = sec.id === curSection;
    if (L.single) {
      const n = SECTIONS.length, span = Math.floor((L.pw - 6) / n), w = Math.min(26, span - 2), h = 19;
      return <button class={'bk-tab top' + (active ? ' on' : '')} aria-label={sec.name} title={sec.name} style={{ left: `${L.ox + (3 + i * span) * T}px`, top: `${L.oy - (h - 3) * T}px`, width: `${w * T}px`, height: `${h * T}px`, backgroundImage: `url(${tabArt(sec.color, h, w, 'top').url})` }} onClick={(e) => { e.stopPropagation(); go(sec.id); }}><Px name={sec.icon} size={11 * T} /></button>;
    }
    const right = f >= 2 * at + 1, w = 19, h = 26, y = L.oy + (10 + i * (h + 4)) * T;
    const x = right ? L.ox + L.PW - 3 * T : L.ox - L.PW - (w - 3) * T;
    return <button class={'bk-tab ' + (right ? 'right' : 'left') + (active ? ' on' : '')} aria-label={sec.name} title={sec.name} style={{ left: `${x}px`, top: `${y}px`, width: `${w * T}px`, height: `${h * T}px`, backgroundImage: `url(${tabArt(sec.color, w, h, right ? 'right' : 'left').url})` }} onClick={(e) => { e.stopPropagation(); go(sec.id); }}><Px name={sec.icon} size={Math.round(13 * T)} /></button>;
  });

  const skip = () => {
    const tline = tl.current;
    if (!tline || tline.kind !== 'enter' || freeze.current) return;
    const p = tline.plan as ReturnType<typeof enterPlan>, el = performance.now() - tline.t0;
    if (el < p.drag1) { tline.t0 -= p.drag1 + 380 - el; tline.last = p.drag1 + 380; }
  };

  return (
    <div class={'bk-stage' + (L.single ? ' single' : ' spread') + (shut ? ' bk-shut' : '') + ` ph-${phase}`} ref={stage} style={{ '--T': `${T}px`, '--fs': `${L.fs}px`, '--rule': `${L.rule}px`, '--r0': `${L.r0}px` } as Record<string, string>} onPointerDown={phase === 'enter' ? skip : undefined}>
      <div class="bk-dim" ref={dim} onClick={close} />
      <div class="bk-mover" ref={mover} style={{ left: `${L.x}px`, top: `${L.y}px`, width: `${L.BW}px`, height: `${L.BH}px`, transformOrigin: `${L.cx + L.cw / 2}px ${L.BH}px` }}>
        <div class="bk-book" ref={bookEl} style={{ width: `${L.BW}px`, height: `${L.BH}px` }}>
          {hL && <img class="bk-half l bk-px" src={hL.url} alt="" draggable={false} style={{ left: 0, width: `${hL.w * T}px`, height: `${hL.h * T}px` }} />}
          <img class="bk-half r bk-px" src={hR.url} alt="" draggable={false} style={{ left: `${L.cx}px`, width: `${hR.w * T}px`, height: `${hR.h * T}px` }} />
          {[['red', 3], ['gold', 9]].map(([c, dx]) => <img class={'bk-tail bk-px ' + c} src={ribbonArt(L.TAIL + (c === 'red' ? 0 : -3), c as string).url} alt="" draggable={false} style={{ left: `${(L.single ? L.BW * 0.42 : L.ox) + (dx as number) * T}px`, top: `${L.BH - T}px`, width: `${5 * T}px` }} />)}
          <div class="bk-tabs">{tabs}</div>
          <div class="bk-pages" ref={pagesEl} style={{ left: `${L.ox}px`, top: `${L.oy}px`, width: `${L.PW}px`, height: `${L.PH}px` }}
            onPointerDown={onDown as unknown as JSX.PointerEventHandler<HTMLDivElement>} onPointerMove={onMove as unknown as JSX.PointerEventHandler<HTMLDivElement>} onPointerUp={onUp as unknown as JSX.PointerEventHandler<HTMLDivElement>} onPointerCancel={onUp as unknown as JSX.PointerEventHandler<HTMLDivElement>} onClickCapture={onClickCapture as unknown as JSX.MouseEventHandler<HTMLDivElement>}>
            {slots.map((sl) => PageView(sl))}
            <div class="bk-flapshadow" ref={flapShadow} style={{ left: `${-L.PW}px`, top: `${-L.PH * 0.25}px`, width: `${L.PW * 3}px`, height: `${L.PH * 1.5}px` }} />
          </div>
          {/* the shut book's sides: spine (with the rope ring), fore edge and head of the page block */}
          <div class="bk-side spine" style={{ left: `${L.cx - L.D * T}px`, width: `${L.D * T}px`, height: `${L.BH}px`, backgroundImage: `url(${spineArt(L.D, L.H).url})` }}><span class="bk-ring" ref={ring} style={{ top: `${L.BH * 0.66}px` }} /></div>
          <div class="bk-side fore" style={{ left: `${L.cx + L.cw}px`, width: `${L.D * T}px`, height: `${L.BH}px`, backgroundImage: `url(${blockEdgeArt(L.D, L.H, 'fore').url})` }} />
          <div class="bk-side head" style={{ left: `${L.cx}px`, top: `${-L.D * T}px`, width: `${L.cw}px`, height: `${L.D * T}px`, backgroundImage: `url(${blockEdgeArt(L.cw / T, L.D, 'head').url})` }} />
          <div class="bk-cover" ref={cover} style={{ left: `${L.cx}px`, width: `${L.cw}px`, height: `${L.BH}px` }}>
            <div class="bk-face front" style={{ backgroundImage: `url(${coverArt(L.cw / T, L.H).url})` }}>
              <b class="bk-ct1" style={{ top: `${(G.title - 9) * T}px`, left: `${6 * T}px`, fontSize: `${Math.round(clamp(G.r * T * 0.3, 15, 30))}px` }}>{s.name.toUpperCase()}'S</b>
              <b class="bk-ct2" style={{ left: `${G.pl.x * T}px`, top: `${G.pl.y * T}px`, width: `${G.pl.w * T}px`, height: `${G.pl.h * T}px`, fontSize: `${Math.round(G.pl.h * T * 0.56)}px` }}>Book of Nights</b>
            </div>
            <div class="bk-face back" style={{ backgroundImage: `url(${L.single ? coverBackArt(L.cw / T, L.H, L.B).url : (hL ?? hR).url})` }}>
              {!L.single && shut && pages[2 * at] && <div class={'bk-page side-L' + (pages[2 * at].paper === 'endpaper' ? ' is-endpaper' : '')} style={{ left: `${L.B * T}px`, top: `${L.oy}px`, width: `${L.PW}px`, height: `${L.PH}px`, backgroundImage: `url(${paperOf(pages[2 * at], 'L', 2 * at)})` }}><div class="bk-pc">{pages[2 * at].render({ L, side: 'L', num: 2 * at, cw, go, openNight: setNight, sectionNum })}</div>{2 * at > 0 && <span class="bk-num">{2 * at}</span>}</div>}
            </div>
            <i class="bk-cedge" style={{ width: `${3 * T}px` }} />
          </div>
          <img class="bk-clasp bk-px" ref={clasp} src={claspArt().url} alt="" draggable={false} style={{ left: `${L.cx + L.cw - 22 * T}px`, top: `${L.BH * 0.5 - 9 * T}px`, width: `${30 * T}px` }} />
        </div>
      </div>
      <canvas class="bk-rope" ref={rope} />
      <img class="bk-pip bk-px" ref={pip} alt="" draggable={false} style={{ width: `${L.pip.size}px`, height: `${L.pip.size}px` }} src={pipFrame('stand')} />
      {phase === 'open' && <button class="bk-close" aria-label="Close the book" onClick={(e) => { e.stopPropagation(); close(); }}><Px name="cross" size={26} /></button>}
      {nightObj && <NightInsert n={nightObj} L={L} onClose={() => { sfx('paper_flip', 0.35, 1.2); setNight(null); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ a night, on a loose leaf tucked in the book

const MOODS = ['Groggy', 'Meh', 'Okay', 'Good', 'Wonderful'];
function NightInsert(p: { n: Night; L: BookLayout; onClose: () => void }) {
  const n = p.n, r = n.report, T = p.L.T, h12 = save.value.settings.hour12;
  const mood = save.value.nights.find((x) => x.id === n.id)?.mood;
  const note = save.value.nights.find((x) => x.id === n.id)?.note ?? '';
  const w = Math.min(p.L.single ? p.L.vw - 24 : p.L.PW * 1.15, 620);
  const paper = pageArt(Math.round(w / T), Math.round(Math.min(p.L.vh - 40, p.L.PH * 1.05) / T), 'S', 'plain', 3).url;
  const stamp = (i: number) => {
    sfx('stamp', 0.55);
    edit((x) => { const ni = x.nights.find((y) => y.id === n.id); if (ni) ni.mood = i; });
    try { progress('mood'); } catch { /* */ }
  };
  return (
    <div class="bk-insert-back" onClick={(e) => { e.stopPropagation(); p.onClose(); }}>
      <article class="bk-insert" style={{ width: `${w}px`, maxHeight: `${Math.min(p.L.vh - 40, p.L.PH * 1.05)}px`, backgroundImage: `url(${paper})` }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Night details">
        <img class="bk-px bk-itape" src={tapeArt('yellow', 34, 10, 4).url} alt="" style={{ width: `${34 * T}px` }} draggable={false} />
        <header class="bk-ihead">
          <span class="bk-sticker big" style={{ width: `${30 * T}px`, height: `${30 * T}px`, backgroundImage: `url(${stickerArt(scoreInk(r.score), 30).url})` }}><b>{r.score}</b></span>
          <div>
            <small class="bk-kicker">{new Date(n.start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}{n.simulated ? ' · demo night' : ''}</small>
            <h2 class="bk-title">{scoreWord(r.score)} night</h2>
            <span class="bk-muted">{fmtDur(r.asleep)} asleep · {fmtTime(r.asleepAt, h12)} to {fmtTime(r.wokeAt, h12)}</span>
          </div>
        </header>
        <div class="bk-hyp"><Hypnogram s={n} h12={h12} /></div>
        <div class="bk-mini six">
          <div><b>{Math.round(r.efficiency * 100)}%</b><small>in bed asleep</small></div>
          <div><b>{Math.round(r.latencyMin)}m</b><small>to drift off</small></div>
          <div><b>{Math.round(r.deep * 100)}%</b><small>deep</small></div>
          <div><b>{Math.round(r.rem * 100)}%</b><small>dreaming</small></div>
          <div><b>{r.awakenings}</b><small>times awake</small></div>
          <div><b>{Math.round(r.snoreMin)}m</b><small>snoring</small></div>
        </div>
        {r.notes.map((t) => <p class="bk-note">“{t}”</p>)}
        <div class="bk-moodrow" role="group" aria-label="How did you feel?">
          <small class="bk-kicker">How did you feel?</small>
          <div>{MOODS.map((m, i) => <button class={'bk-moodbtn' + (mood === i ? ' on' : '')} aria-label={m} aria-pressed={mood === i} onClick={() => stamp(i)}><img class="bk-px" src={moodArt(i).url} alt="" draggable={false} style={{ width: `${20 * T}px` }} /><small>{m}</small></button>)}</div>
        </div>
        {note.trim() && <p class="bk-handnote">{note}</p>}
        <button class="bk-link" onClick={p.onClose}>Tuck it back in</button>
      </article>
    </div>
  );
}
