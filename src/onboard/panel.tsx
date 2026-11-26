// The interview's form: a sheet of Hollow & Co. paper on a stitched leather folio, clipped with brass, in front of
// the 3D office (Pip stays in view beside or above it). Each page is mostly pictures: a one-line question in big
// type, then the answers as live 3D objects standing on the paper (drawn by overlay3d.ts) with a word or two
// inked under each. Tap one: it slides forward, the floating fountain pen ticks or rings it, Pip reacts. The
// drinks, the cassette tapes and their recorder, the pillows, the phones are real little models (cards.ts). One
// obvious way on: the rubber stamp box. All the paper art is painted by panelart.ts: deckle edges, foxing,
// wobbly hand-inked ticks and loops, no clean geometry.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type * as THREE from 'three';
import { speciesOf } from '../owl/species.ts';
import { Px } from '../ui/icons.tsx';
import { crispCss, VIS } from '../ui/font.ts'; // [text15] form text sizes
import { acornURL, clipURL, folioURL, knobURL, loopStripURL, railURL, ruleURL, sheetURL, stickyURL, tapeURL, tickStripURL } from './panelart.ts';
import { inkStamp, prepareInk } from './ink.ts';
import { DRINKS, TAPES } from './props.ts';
import { ALARM_NAME, fmt, RELAX, SOUND_NAME, toMin, type Answers, type Plan, type Step } from './script.ts';
import type { Overlay3D, SlotOpts, SlotState } from './overlay3d.ts';

export interface PanelState {
  a: Answers; picked: Record<string, boolean>; remind: boolean; signed: boolean; stamped: string | null; ready: boolean; hour12: boolean; artifact: boolean; plan: Plan; skipAsk: boolean;
  /** the drink chosen on the caffeine page (a picture only; the answer is when) */
  drink: string | null;
  /** the tape in the recorder on the sounds page */
  deckTape: string | null;
}
export interface PanelActions {
  pick(v: string): void; text(v: string): void; enter(): void; nudge(d: number): void; ampm(pm: boolean): void; clock(min12: number): void; hours(v: number): void;
  sign(): void; remind(): void; stamp(): void; skip(ask: boolean): void; skipYes(): void; drink(v: string): void;
}
export type ModelFor = (key: string) => { obj: THREE.Object3D; opts?: SlotOpts } | null;

/** the wide (side by side) layout */
export const isWide = () => innerWidth >= 860 && innerWidth > innerHeight;
/** the size of one art pixel in CSS px for this screen */
export function panelScale() {
  if (isWide()) return Math.max(2, Math.min(4, Math.floor(Math.min((innerWidth * 0.5) / 196, (innerHeight - 16) / 252))));
  const fit = Math.min(innerWidth / 196, innerHeight / 420);
  if (fit >= 2) return Math.min(3, Math.floor(fit));
  // [font6] narrow phones (360 px): the largest whole number of device pixels per art pixel that fits the width
  const dpr = devicePixelRatio || 1;
  return Math.max(1.5, Math.floor(fit * dpr) / dpr);
}
const W = 186;

/** the question, one short line */
const TITLE: Record<string, string> = {
  you: 'What’s your name?', species: 'Pick your owl', name: 'Name your owl', goals: 'Your sleep goals', wake: 'Wake-up time', hours: 'Hours of sleep',
  latency: 'Time to drift off', phone: 'Phone in bed?', chrono: 'Lark or owl?', caffeine: 'Your last drink', relax: 'Sleep sounds', mic: 'Listen for snores?', plan: 'Your sleep plan',
};
/** a word or two under each object */
const SHORT: Record<string, string> = {
  sleep_better: 'Sleep better', fall_asleep: 'Fall asleep', wake_refreshed: 'Wake fresh', steady_routine: 'Routine', less_phone: 'Less phone', track_sounds: 'Snoring',
  quick: 'Minutes', normal: '10-20 min', slow: '20-40 min', long: 'Ages',
  never: 'Never', sometimes: 'Sometimes', nightly: 'Every night',
  lark: 'Early bird', between: 'In between', owl: 'Night owl',
  yes: 'Yes, listen', no: 'Not now', breathing: 'Breathing', reading: 'Reading',
};

let cssDone = false;
function css() {
  if (cssDone) return;
  cssDone = true;
  const st = document.createElement('style');
  st.textContent = `
.qp{position:fixed;z-index:44;--u:calc(var(--k) * 1px);width:calc(${W + 8} * var(--u));left:50%;bottom:calc(3 * var(--u));transform:translateX(-50%);color:#1d2552;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;pointer-events:auto}
.qp.wide{left:auto;right:calc(14 * var(--u));bottom:50%;transform:translateY(50%)}
.qp *{box-sizing:border-box}
.qp.in{animation:qp-in .5s ease-in-out both}.qp.wide.in{animation:qp-in-w .5s ease-in-out both}
@keyframes qp-in{0%{transform:translate(-50%,110%)}70%{transform:translate(-50%,-3%)}100%{transform:translate(-50%,0)}}
@keyframes qp-in-w{0%{transform:translate(130%,50%)}70%{transform:translate(-3%,50%)}100%{transform:translate(0,50%)}}
.qp-folio{position:absolute;inset:0;background-size:100% 100%}
.qp-sheet{position:relative;margin:calc(5 * var(--u)) calc(4 * var(--u)) calc(5 * var(--u));padding:calc(10 * var(--u)) calc(7 * var(--u)) calc(5 * var(--u));background-size:100% 100%}
.qp-clip{position:absolute;left:50%;top:calc(-2 * var(--u));width:calc(46 * var(--u));height:calc(22 * var(--u));transform:translateX(-50%);background-size:100% 100%;z-index:3}
.qp-head{display:flex;align-items:center;justify-content:space-between;border-bottom:var(--u) solid #2b376a;padding-bottom:calc(2 * var(--u));margin-bottom:calc(3 * var(--u));white-space:nowrap;font:600 var(--a1) var(--font-body);line-height:var(--a1);color:#5a5f80;letter-spacing:0}
.qp-acorns{display:flex;gap:var(--u)}.qp-acorns i{width:calc(6 * var(--u));height:calc(6 * var(--u));background-size:100% 100%}
.qp-q{font:600 var(--a2) var(--font-body);line-height:calc(16 * var(--u));color:#17130f;margin:0 0 calc(1 * var(--u));white-space:nowrap;display:flex;align-items:baseline;gap:calc(4 * var(--u))}
.qp-q small{font:600 var(--a1) var(--font-body);color:#8a5a14}
.qp-objs{display:grid;gap:calc(2 * var(--u)) calc(3 * var(--u));margin:calc(2 * var(--u)) 0 calc(3 * var(--u))}
.qp-obj{position:relative;width:100%;border:0;background:transparent;cursor:pointer;padding:0;text-align:center;color:#1d2552;transition:transform .12s ease}
.qp-obj:active{transform:translateY(var(--u))}
.qp-obj:focus-visible{outline:var(--u) dashed #b33a1a;outline-offset:var(--u)}
.qp-win{display:block;width:100%;pointer-events:none}
.qp-lab{position:relative;display:inline-block;max-width:100%;font:600 var(--a1) var(--font-body);line-height:var(--a1);padding:0 calc(1 * var(--u));color:#17204a;white-space:normal;text-align:center}
.qp-obj.on .qp-lab{color:#a8321a}
.qp-obj.dim .qp-lab{color:#4c4a66}
.qp-tick{position:absolute;left:calc(-14 * var(--u));top:calc(-4 * var(--u));width:calc(16 * var(--u));height:calc(14 * var(--u));background-size:600% 100%;animation:qp-tick .3s steps(5) forwards;pointer-events:none}
@keyframes qp-tick{from{background-position:0 0}to{background-position:100% 0}}
.qp-loop{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background-size:100% 600%;animation:qp-loop .45s steps(5) forwards;pointer-events:none}
@keyframes qp-loop{from{background-position:0 0}to{background-position:0 100%}}
.qp-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:calc(4 * var(--u));margin-top:calc(1 * var(--u))}
.qp-fine{font:600 var(--a1) var(--font-body);line-height:var(--a1);color:#6a6f8a;max-width:calc(96 * var(--u))}
.qp-box{position:relative;width:calc(78 * var(--u));height:calc(26 * var(--u));border:0;background:transparent;cursor:pointer;padding:0;flex:none;margin-left:auto}
.qp-box::before{content:'';position:absolute;inset:0;border:var(--u) dashed #6a6f8a}
.qp-box b{position:relative;display:block;font:600 var(--a2) var(--font-body);color:#9a9ab0;white-space:nowrap;line-height:calc(26 * var(--u))}
.qp-box.ready::before{border:calc(2 * var(--u)) solid #b33a1a;animation:qp-pulse 1s ease-in-out infinite}
.qp-box.ready b{color:#b33a1a}
@keyframes qp-pulse{50%{border-color:#e07a2a}}
.qp-impr{position:absolute;left:50%;top:50%;width:calc(80 * var(--u));height:calc(30 * var(--u));transform:translate(-50%,-50%) rotate(-5deg);isolation:auto}
.qp-box.inked::before{opacity:.35;transition:opacity .4s}
.qp.thud .qp-sheet{animation:qp-thud .34s cubic-bezier(.3,1.6,.5,1)}
@keyframes qp-thud{0%{transform:none}22%{transform:translateY(calc(1.6 * var(--u))) scale(.996,.992)}60%{transform:translateY(calc(-.4 * var(--u)))}100%{transform:none}}
.qp-sticky{position:absolute;right:calc(-4 * var(--u));top:calc(-28 * var(--u));width:calc(56 * var(--u));min-height:calc(30 * var(--u));background-size:100% 100%;transform:rotate(5deg);z-index:4;border:0;cursor:pointer;font:600 var(--a1) var(--font-body);line-height:var(--a1);color:#3a2a0a;padding:calc(4 * var(--u)) calc(3 * var(--u));text-align:center}
.qp.wide .qp-sticky{right:auto;left:calc(-62 * var(--u));top:calc(18 * var(--u));transform:rotate(-4deg)}
.qp-sticky b{display:block;font:600 var(--a2) var(--font-body);line-height:calc(16 * var(--u));color:#8a2a1a;margin-top:calc(1 * var(--u))}
.qp-sticky .qp-yes{display:flex;gap:calc(5 * var(--u));justify-content:center;margin-top:calc(2 * var(--u));font:600 var(--a1) var(--font-body)}
.qp-sticky .qp-yes span{color:#8a2a1a;text-decoration:underline}
.qp-line{position:relative;display:block;margin:calc(6 * var(--u)) 0 calc(4 * var(--u))}
.qp-line input{width:100%;border:0;outline:0;background:transparent;font:600 var(--a2) var(--font-body);color:#1d2552;caret-color:#1d2552;padding:0 calc(2 * var(--u));height:calc(20 * var(--u));line-height:calc(20 * var(--u))}
.qp-line input::placeholder{color:#c4b898}
.qp-line i{display:block;height:calc(3 * var(--u));background-size:100% 100%}
.qp-chips{display:flex;flex-wrap:wrap;gap:calc(3 * var(--u));justify-content:center;margin:calc(2 * var(--u)) 0 calc(5 * var(--u))}
.qp-chip{position:relative;border:0;cursor:pointer;background-size:100% 100%;font:600 var(--a1) var(--font-body);padding:calc(2 * var(--u)) calc(5 * var(--u));color:#17130f;background-color:transparent}
.qp-chip.on{color:#a8321a}
.qp-row{display:flex;align-items:center;justify-content:center;gap:calc(3 * var(--u))}
.qp-tag{border:0;cursor:pointer;background-size:100% 100%;font:600 var(--a1) var(--font-body);color:#17130f;padding:calc(2 * var(--u)) calc(5 * var(--u));background-color:transparent;position:relative}
.qp-big{font:600 var(--a3) var(--font-body);color:#1d2552;text-align:center;line-height:1;white-space:nowrap}
.qp-big small{font:600 var(--a1) var(--font-body);color:#5a5f80;margin-left:calc(2 * var(--u))}
.qp-rail{position:relative;height:calc(26 * var(--u));margin:calc(2 * var(--u)) calc(8 * var(--u)) 0;touch-action:none;cursor:pointer}
.qp-rail>i{position:absolute;left:0;right:0;top:calc(8 * var(--u));height:calc(9 * var(--u));background-size:100% 100%}
.qp-rail>b{position:absolute;top:calc(2 * var(--u));width:calc(14 * var(--u));height:calc(18 * var(--u));margin-left:calc(-7 * var(--u));background-size:100% 100%}
.qp-rail>span{position:absolute;top:calc(14 * var(--u));transform:translateX(-50%);font:600 var(--a1)/1 var(--font-body);color:#5a5f80}
.qp-sweet{position:absolute;top:0;height:calc(4 * var(--u));border:var(--u) solid #b07a1a;border-bottom:0}
.qp-plan{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(3 * var(--u));margin:calc(3 * var(--u)) 0}
.qp-plan div{text-align:center;font:600 var(--a1) var(--font-body);color:#5a5f80}
.qp-plan b{display:block;font:600 var(--a2) var(--font-body);color:#1d2552;line-height:calc(16 * var(--u))}
.qp-plan .px{display:block;margin:0 auto calc(1 * var(--u))}
.qp-terms{display:flex;flex-wrap:wrap;gap:calc(2 * var(--u)) calc(6 * var(--u));justify-content:center;font:600 var(--a1) var(--font-body);color:#17130f;margin-bottom:calc(3 * var(--u))}
.qp-terms span{display:flex;align-items:center;gap:calc(1 * var(--u))}
.qp-sign{display:flex;gap:calc(12 * var(--u));margin-top:calc(2 * var(--u))}
.qp-sign button{flex:1;border:0;background:transparent;cursor:pointer;text-align:left;padding:0;font:600 var(--a1) var(--font-body);color:#6a6f8a}
.qp-sign .s{display:block;height:calc(20 * var(--u));font:600 var(--a2) var(--font-body);color:#1d2552;overflow:hidden;white-space:nowrap}
.qp-sign .s.go{animation:qp-write .9s ease-in-out both}
@keyframes qp-write{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.qp-sign .hint{color:#b33a1a}
.qp-remind{display:flex;align-items:center;gap:calc(2 * var(--u));border:0;background:transparent;cursor:pointer;padding:0;font:600 var(--a1) var(--font-body);color:#17130f}
.qp-remind .qp-win{width:calc(30 * var(--u))}
.qp-remind.off{color:#9a9ab0}
.qp-fly{transition:transform .5s cubic-bezier(.5,0,.8,.4),opacity .5s ease}
@media (prefers-reduced-motion:reduce){.qp *,.qp{animation-duration:0s!important}}
`;
  document.head.appendChild(st);
}

/**
 * Register a window's live model with the 3D layer while mounted. The model packs may still be loading on the
 * first render: keep asking until the model is there.
 */
function useSlot(overlay: Overlay3D | null, model: ModelFor, id: string, key: string | null, el: { current: HTMLElement | null }) {
  useEffect(() => {
    const o = overlay;
    if (!o || !key) return undefined;
    let timer = 0, set = false;
    const tryIt = () => {
      const w = el.current, m = w ? model(key) : null;
      if (!w || !m) { timer = window.setTimeout(tryIt, 250); return; }
      o.setSlot(id, w, m.obj, m.opts);
      set = true;
    };
    tryIt();
    return () => { clearTimeout(timer); if (set) o.removeSlot(id); };
  }, [overlay, id, key]);
}

function useSize(ref: { current: HTMLElement | null }, k: number, dep: unknown) {
  const [s, set] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const up = () => set({ w: Math.round(el.offsetWidth / k), h: Math.round(el.offsetHeight / k) });
    up();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(up) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [dep, k]);
  return s;
}

/**
 * An answer: a live 3D object standing on the paper with a word or two under it. When chosen it slides forward
 * (the others step back on single-choice pages) and its word is ticked or ringed in ink.
 */
function Obj(p: { id: string; label: string; aria?: string; on: boolean; state: SlotState; h: number; overlay: Overlay3D | null; model: ModelFor; mkey: string; onPick: () => void; mark: 'tick' | 'loop'; seed: number; hide?: boolean; extra?: ComponentChildren }) {
  const win = useRef<HTMLElement>(null), lab = useRef<HTMLSpanElement>(null);
  const [lsz, setLsz] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => { const el = lab.current; if (!el) return; const u = parseFloat(getComputedStyle(el).getPropertyValue('--k')) || 2; setLsz({ w: Math.round(el.offsetWidth / u), h: Math.round(el.offsetHeight / u) }); }, [p.label]);
  useSlot(p.overlay, p.model, p.id, p.mkey, win);
  useEffect(() => { p.overlay?.setState(p.id, p.state); }, [p.state, p.overlay, p.mkey]);
  useEffect(() => { p.overlay?.hide(p.id, !!p.hide); }, [p.hide, p.overlay, p.mkey]);
  useEffect(() => { if (p.on) p.overlay?.pick(p.id); }, [p.on]);
  const lw = Math.max(22, (lsz.w || p.label.length * 5) + 10), lh = Math.max(14, (lsz.h || 9) + 6);
  return (
    <button type="button" data-v={p.id} class={'qp-obj' + (p.on ? ' on' : '') + (p.state === 'back' ? ' dim' : '')} aria-pressed={p.on} aria-label={p.aria ?? p.label} onClick={p.onPick} onPointerEnter={() => p.overlay?.pick(p.id)}>
      <i ref={win} class="qp-win" style={`height:calc(${p.h} * var(--u))`} />
      <span ref={lab} class="qp-lab">
        {p.on && p.mark === 'tick' && <i class="qp-tick" style={`background-image:url(${tickStripURL(6, p.seed)})`} />}
        {p.label}
        {p.on && p.mark === 'loop' && <i class="qp-loop" style={`width:calc(${lw} * var(--u));height:calc(${lh} * var(--u));background-image:url(${loopStripURL(lw, lh, 6, p.seed)})`} />}
      </span>
      {p.extra}
    </button>
  );
}

/** The hand that turns the clock: drag round the window to set the time (12 hours a turn). */
function ClockWindow(p: { overlay: Overlay3D | null; model: ModelFor; onTurn: (min12: number) => void; h: number }) {
  const win = useRef<HTMLDivElement>(null);
  const drag = useRef(false), last = useRef(-1);
  useSlot(p.overlay, p.model, 'clock', 'clock', win);
  const turn = (e: PointerEvent) => {
    const b = win.current!.getBoundingClientRect();
    let a = Math.atan2(e.clientX - (b.left + b.width / 2), -(e.clientY - (b.top + b.height * 0.5)));
    if (a < 0) a += Math.PI * 2;
    const m = (Math.round(((a / (Math.PI * 2)) * 720) / 15) * 15) % 720;
    if (m !== last.current) { last.current = m; p.onTurn(m); }
  };
  return <div ref={win} class="qp-win" aria-label="Turn the clock to your wake-up time" style={`height:calc(${p.h} * var(--u));touch-action:none;cursor:grab`}
    onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); drag.current = true; turn(e); }}
    onPointerMove={(e) => { if (drag.current) turn(e); }} onPointerUp={() => { drag.current = false; }} />;
}

/** a small live model in a fixed window (no button) */
function Win(p: { id: string; mkey: string | null; h: number; w?: number; overlay: Overlay3D | null; model: ModelFor; state?: SlotState }) {
  const el = useRef<HTMLElement>(null);
  useSlot(p.overlay, p.model, p.id, p.mkey, el);
  useEffect(() => { p.overlay?.setState(p.id, p.state ?? 'off'); }, [p.state, p.overlay, p.mkey]);
  return <i ref={el} class="qp-win" style={`height:calc(${p.h} * var(--u));${p.w ? `width:calc(${p.w} * var(--u))` : ''}`} />;
}

export function Panel(p: { step: Step; index: number; total: number; s: PanelState; act: PanelActions; overlay: Overlay3D | null; model: ModelFor; k: number; wide: boolean; leaving: boolean; sheetRef?: { current: HTMLDivElement | null } }) {
  css();
  const { step: st, s, act, k } = p;
  const root = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null);
  const rsz = useSize(root, k, st.id), ssz = useSize(sheet, k, st.id + s.skipAsk + (s.drink ? 1 : 0));
  const a = s.a;
  const seed = p.index * 7 + 3;
  const ov = p.overlay;
  // [dialog10] paint this page's rubber-stamp impression while the page is up (it takes a moment)
  useEffect(() => {
    const word = st.kind === 'plan' ? 'APPROVED' : 'RECEIVED';
    const go = () => prepareInk(word, INK_SUB, { w: Math.round(80 * k), h: Math.round(30 * k), seed: p.index + 1 });
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
    if (w.requestIdleCallback) { const id = w.requestIdleCallback(go, { timeout: 900 }); return () => w.cancelIdleCallback?.(id); }
    const t = window.setTimeout(go, 400);
    return () => clearTimeout(t);
  }, [st.id, k]);
  /** a grid of answer objects */
  const objs = (list: { v: string; label: string; aria?: string }[], o: { cols: number; h: number; on: (v: string) => boolean; single: boolean; key: (v: string) => string; pick: (v: string) => void; hide?: (v: string) => boolean; extra?: (v: string) => ComponentChildren; any?: boolean }) => {
    const any = o.any ?? list.some((x) => o.on(x.v));
    // a short last row is centred: each object spans two of twice as many columns
    const short = list.length % o.cols, lastRow = list.length - short;
    return (
      <div class="qp-objs" style={`grid-template-columns:repeat(${o.cols * 2},1fr)`}>
        {list.map((x, i) => {
          const on = o.on(x.v);
          const col = short && i === lastRow ? `grid-column:${o.cols - short + 1} / span 2` : 'grid-column:span 2';
          return <div key={x.v} style={col}><Obj id={x.v} label={x.label} aria={x.aria} on={on} state={on ? 'on' : o.single && any ? 'back' : 'off'} h={o.h} overlay={ov} model={p.model} mkey={o.key(x.v)} mark={o.single ? 'loop' : 'tick'} seed={seed + i} hide={o.hide?.(x.v)} extra={o.extra?.(x.v)} onPick={() => o.pick(x.v)} /></div>;
        })}
      </div>
    );
  };
  const chosen = (v: string) => !!s.picked[st.id] && (st.id === 'mic' ? (a.mic ? 'yes' : 'no') === v : String(a[st.field!]) === v);
  let body: ComponentChildren = null;
  let hint = '';
  switch (st.kind) {
    case 'text': {
      const f = st.field as 'you' | 'name';
      body = (<>
        <Win id={'plate-' + f} mkey={'plate:' + f} h={40} overlay={ov} model={p.model} />
        <label class="qp-line" style="margin-top:0">
          <input value={a[f]} maxLength={16} placeholder={f === 'you' ? 'your name' : 'Pip'} spellcheck={false} autocomplete="off" autocapitalize="words"
            onInput={(e) => act.text((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); act.enter(); } }} aria-label={st.title} />
          <i style={`background-image:url(${ruleURL(W - 14, seed)})`} />
        </label>
        {f === 'name' ? (
          <div class="qp-chips">
            {['Pip', 'Hoot', 'Mochi', 'Biscuit', 'Luna', 'Juniper'].map((n, i) => (
              <button type="button" key={n} data-v={n} class={'qp-chip' + (a.name.trim() === n ? ' on' : '')} style={`background-image:url(${tapeURL(i + 1)})`} onClick={() => act.pick(n)}>{n}</button>
            ))}
          </div>
        ) : <div class="qp-fine" style="margin:0 auto calc(5 * var(--u));text-align:center;max-width:none">or leave it blank</div>}
      </>);
      break;
    }
    case 'species': {
      hint = 'pick one';
      body = objs((st.opts ?? []).map((o) => ({ v: o.v, label: speciesOf(o.v).name.replace(' Owl', '').replace('Northern ', '') })), { cols: 3, h: 52, single: true, on: (v) => !!s.picked[st.id] && a.species === v, key: (v) => 'owl:' + v, pick: act.pick });
      break;
    }
    case 'multi': case 'choice': {
      const single = st.kind === 'choice';
      hint = single ? 'pick one' : 'pick any';
      if (st.id === 'relax') {
        // the sounds: a cassette recorder, a candle and a book; nine hand-labelled tapes to slide in
        const cur = a.relax;
        const tapes = RELAX.filter((r) => r.sound).map((r) => ({ v: r.v, label: TAPES.find((t) => t.id === r.v)?.title.replace('Brown noise', 'Brown') ?? r.label }));
        body = (<>
          <div class="qp-row" style="align-items:flex-end;gap:calc(2 * var(--u))">
            <div style="width:calc(42 * var(--u))">{objs([{ v: 'breathing', label: 'Breathe' }], { cols: 1, h: 38, single: false, on: (v) => cur.includes(v), key: () => 'relax:breathing', pick: act.pick })}</div>
            <div style="flex:1;position:relative"><Win id="deck" mkey="deck" h={56} overlay={ov} model={p.model} state={s.deckTape ? 'on' : 'off'} /></div>
            <div style="width:calc(42 * var(--u))">{objs([{ v: 'reading', label: 'Reading' }], { cols: 1, h: 38, single: false, on: (v) => cur.includes(v), key: () => 'relax:reading', pick: act.pick })}</div>
          </div>
          {objs(tapes, { cols: 3, h: 26, single: false, on: (v) => cur.includes(v), key: (v) => 'tape:' + v, pick: act.pick, hide: (v) => s.deckTape === v })}
        </>);
        break;
      }
      if (st.id === 'caffeine') {
        // the drinks; a caffeinated one asks when it is usually had
        const d = DRINKS.find((x) => x.v === s.drink);
        hint = '';
        body = (<>
          {objs(DRINKS.slice(0, 4).map((x) => ({ v: x.v, label: x.label })), { cols: 4, h: 40, single: true, any: !!s.drink, on: (v) => s.drink === v, key: (v) => 'drink:' + v, pick: act.drink })}
          {objs(DRINKS.slice(4).map((x) => ({ v: x.v, label: x.label })), { cols: 3, h: 40, single: true, any: !!s.drink, on: (v) => s.drink === v, key: (v) => 'drink:' + v, pick: act.drink })}
          {d?.caffeine && (<>
            <div class="qp-q" style="font-size:var(--a2);justify-content:center">Your last one?</div>
            {objs([{ v: 'morning', label: 'Mornings' }, { v: 'late', label: 'Afternoon+' }], { cols: 2, h: 34, single: true, on: (v) => !!s.picked.caffeine && a.caffeine === v, key: (v) => 'when:' + v, pick: act.pick })}
          </>)}
          {!d && <div class="qp-fine" style="margin:0 auto calc(3 * var(--u));text-align:center;max-width:none">tap the one you have most</div>}
        </>);
        break;
      }
      const opts = st.id === 'goals' ? (st.opts ?? []) : st.opts ?? [];
      const n = opts.length, cols = n === 4 ? 2 : 3;
      const h = n === 6 ? 44 : n === 4 ? 44 : n === 2 ? 62 : 58;
      const list = opts.map((o) => ({ v: o.v, label: SHORT[o.v] ?? o.label, aria: o.label }));
      body = (<>
        {objs(list, { cols: n === 2 ? 2 : cols, h, single, on: single ? chosen : (v) => (a[st.field as 'goals'] as string[]).includes(v), key: (v) => `${st.id}:${v}`, pick: act.pick })}
        {st.id === 'mic' && <div class="qp-fine" style="max-width:none;text-align:center;margin-bottom:calc(3 * var(--u))">It all stays on this device. {s.artifact ? 'The full app can listen; this preview can’t.' : 'Change it any time in Settings.'}</div>}
      </>);
      break;
    }
    case 'dial': {
      const m = toMin(a.wake), pm = m >= 720;
      body = (<>
        <ClockWindow overlay={ov} model={p.model} onTurn={act.clock} h={84} />
        <div class="qp-row" style="margin:calc(1 * var(--u)) 0 calc(3 * var(--u))">
          <div style="width:calc(36 * var(--u))">{objs([{ v: 'am', label: 'AM' }], { cols: 1, h: 26, single: true, on: () => !pm, key: () => 'ampm:am', pick: () => act.ampm(false) })}</div>
          <button type="button" class="qp-tag" aria-label="15 minutes earlier" style={`background-image:url(${tapeURL(2)})`} onClick={() => act.nudge(-15)}>-15</button>
          <span class="qp-big">{fmt(a.wake, s.hour12).replace(/ [AP]M$/, '')}</span>
          <button type="button" class="qp-tag" aria-label="15 minutes later" style={`background-image:url(${tapeURL(3)})`} onClick={() => act.nudge(15)}>+15</button>
          <div style="width:calc(36 * var(--u))">{objs([{ v: 'pm', label: 'PM' }], { cols: 1, h: 26, single: true, on: () => pm, key: () => 'ampm:pm', pick: () => act.ampm(true) })}</div>
        </div>
      </>);
      break;
    }
    case 'hours': {
      const lo = 5, hi = 11, pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
      const set = (e: PointerEvent) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); const v = Math.round((lo + Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)) * (hi - lo)) * 2) / 2; act.hours(v); };
      body = (<>
        <div class="qp-row" style="align-items:center;gap:0">
          <div style="flex:1"><Win id="pillows" mkey={'pillows:' + Math.round(a.hours)} h={100} overlay={ov} model={p.model} /></div>
          <div class="qp-big" style="width:calc(60 * var(--u));font-size:var(--a4)">{String(a.hours).replace('.5', '½')}<small>hours</small></div>
        </div>
        <div class="qp-rail" aria-label="Hours of sleep" onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); set(e); }} onPointerMove={(e) => { if (e.buttons) set(e); }}>
          <span class="qp-sweet" style={`left:${pct(7)}%;width:${pct(9) - pct(7)}%`} />
          <i style={`background-image:url(${railURL(160)})`} />
          {[5, 6, 7, 8, 9, 10, 11].map((h) => <span key={h} style={`left:${pct(h)}%`}>{h}</span>)}
          <b style={`left:${pct(a.hours)}%;background-image:url(${knobURL()})`} />
        </div>
      </>);
      break;
    }
    case 'plan': {
      const pl = s.plan;
      body = (<>
        <div class="qp-plan">
          {[['candle', 'wind down', pl.windDown], ['zzz', 'bedtime', pl.bed], ['sun', 'wake up', pl.wake]].map(([ic, l, v]) => (
            <div key={l}><Px name={ic} size={k * 14} class="px" /><b>{fmt(v, s.hour12).replace(/ ([AP]M)$/, '$1')}</b>{l}</div>
          ))}
        </div>
        <div class="qp-terms">
          <span><Px name="music" size={k * 9} />{SOUND_NAME[pl.soundscape] ?? 'gentle rain'}</span>
          <span><Px name="bell" size={k * 9} />{ALARM_NAME[pl.alarm] ?? 'Music box'}</span>
          {pl.blocker && <span><Px name="shield" size={k * 9} />phone lock</span>}
          {pl.tips.map((t) => <span key={t}>· {t}</span>)}
        </div>
        <button type="button" class={'qp-remind' + (s.remind ? '' : ' off')} onClick={act.remind} aria-pressed={s.remind}>
          <Win id="remind" mkey="remind" h={30} w={30} overlay={ov} model={p.model} state={s.remind ? 'on' : 'back'} />
          {s.remind ? 'Remind me at wind-down' : 'No reminders'}
        </button>
        <div class="qp-sign">
          <button type="button" onClick={act.sign} aria-label="Sign the plan">
            <span class={'s' + (s.signed ? ' go' : '')}>{s.signed ? (a.you.trim() || 'A. Client') : ''}</span>
            <i style={`display:block;height:calc(3 * var(--u));background-image:url(${ruleURL(80, 9)});background-size:100% 100%`} />
            <span class={s.signed ? '' : 'hint'}>{s.signed ? 'the client' : 'tap to sign'}</span>
          </button>
          <div style="flex:1">
            <span class="s" style="display:block;height:calc(20 * var(--u));font:600 var(--a2) var(--font-body);color:#1d2552">{a.name.trim() || 'Pip'}</span>
            <i style={`display:block;height:calc(3 * var(--u));background-image:url(${ruleURL(80, 11)});background-size:100% 100%`} />
            <span style="font:600 var(--a1) var(--font-body);color:#6a6f8a">Hollow &amp; Co.</span>
          </div>
        </div>
      </>);
      break;
    }
  }

  const isPlan = st.kind === 'plan';
  const label = isPlan ? (s.signed ? 'APPROVE' : 'SIGN') : 'STAMP';
  const acorns = Array.from({ length: p.total - 1 }, (_, i) => (i < p.index ? 'done' : i === p.index ? 'now' : 'todo') as 'done' | 'now' | 'todo');
  return (
    <div ref={(el) => { root.current = el; if (p.sheetRef) p.sheetRef.current = el; }} class={'qp' + (p.wide ? ' wide' : '') + (p.leaving ? '' : ' in')} style={`--k:${k};--a1:${crispCss(15 * VIS * Math.max(1, Math.floor(k / 2)))}px;--a2:${crispCss(16 * VIS * k)}px;--a3:${crispCss(17 * VIS * Math.floor(1.5 * k))}px;--a4:${crispCss(40 * VIS * k)}px`} data-step={st.id}>
      <i class="qp-folio" style={rsz.w ? `background-image:url(${folioURL(rsz.w, rsz.h)})` : ''} />
      <i class="qp-clip" style={`background-image:url(${clipURL()})`} />
      <div ref={sheet} class="qp-sheet" style={ssz.w ? `background-image:url(${sheetURL(ssz.w, ssz.h, p.index + 1, { dog: !isPlan, stain: p.index % 4 === 2 })})` : ''}>
        <div class="qp-head">
          <span>HOLLOW &amp; CO.</span>
          {isPlan ? <span>AGREEMENT</span> : <span class="qp-acorns">{acorns.map((x, i) => <i key={i} style={`background-image:url(${acornURL(x)})`} />)}</span>}
        </div>
        <h2 class="qp-q">{TITLE[st.id] ?? st.title}{hint && <small>{hint}</small>}</h2>
        {body}
        <div class="qp-foot">
          {isPlan && <div class="qp-fine">Sign, then Pip stamps it.</div>}
          <button type="button" class={'qp-box' + (s.ready && !s.stamped ? ' ready' : '') + (s.stamped ? ' inked' : '')} onClick={act.stamp} aria-label={isPlan ? (s.signed ? 'Approve the plan' : 'Sign first') : s.ready ? 'Stamp it' : 'Pick an answer first'}>
            {!s.stamped && <b>{label}</b>}
            {s.stamped && <Impression word={s.stamped} seed={p.index + 1} />}
          </button>
        </div>
        {!isPlan && (
          <div class="qp-sticky" role="button" tabIndex={0} style={`background-image:url(${stickyURL(56, s.skipAsk ? 36 : 30)})`} onClick={() => act.skip(!s.skipAsk)}>
            {!s.skipAsk ? <>Been here before?<b>SKIP &gt;</b></> : <>Skip the forms?<span class="qp-yes"><span onClick={(e) => { e.stopPropagation(); act.skipYes(); }}>YES</span><span>NO</span></span></>}
          </div>
        )}
      </div>
    </div>
  );
}
export { loopStripURL };

/** what the die says under the word */
const INK_SUB = 'HOLLOW & CO.';
/** [dialog10] the rubber stamp's impression: wet, glossy ink that dries into the paper (ink.ts) */
function Impression(p: { word: string; seed: number }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const n = inkStamp(p.word, INK_SUB, { w: el.offsetWidth, h: el.offsetHeight, seed: p.seed });
    el.appendChild(n);
    return () => n.remove();
  }, [p.word]);
  return <i class="qp-impr" ref={ref} style={`transform:translate(-50%,-50%) rotate(${(-6.5 + ((p.seed * 37) % 50) / 10).toFixed(1)}deg)`} />;
}
