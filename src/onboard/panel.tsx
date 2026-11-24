// The interview's form: a 2D pixel-art sheet of Hollow & Co. paper on a stitched leather folio, clipped with brass,
// in front of the 3D office (Pip stays in view above it). Big, readable pixel type; one obvious thing to do on each
// page (tick, write, turn, slide), then one obvious way on (the stamp box). The answer cards carry live 3D models
// drawn by overlay3d.ts; the pen and the rubber stamp are 3D moments that play over the paper. All the art is
// painted by panelart.ts: deckle edges, foxing, wobbly hand-inked boxes and ticks, no clean geometry.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type * as THREE from 'three';
import { speciesOf } from '../owl/species.ts';
import { acornURL, boxURL, cardURL, clipURL, folioURL, knobURL, loopStripURL, railURL, ruleURL, sheetURL, stampURL, stickyURL, tapeURL, tickStripURL } from './panelart.ts';
import { ALARM_NAME, fmt, GOALS, RELAX, SOUND_NAME, toMin, type Answers, type Plan, type Step } from './script.ts';
import type { Overlay3D, SlotOpts } from './overlay3d.ts';

export interface PanelState { a: Answers; picked: Record<string, boolean>; remind: boolean; signed: boolean; stamped: string | null; ready: boolean; hour12: boolean; artifact: boolean; plan: Plan; skipAsk: boolean }
export interface PanelActions {
  pick(v: string): void; text(v: string): void; enter(): void; nudge(d: number): void; ampm(pm: boolean): void; clock(min12: number): void; hours(v: number): void;
  sign(): void; remind(): void; stamp(): void; skip(ask: boolean): void; skipYes(): void;
}
export type ModelFor = (key: string) => { obj: THREE.Object3D; opts?: SlotOpts } | null;

/** the size of one art pixel in CSS px for this screen */
export function panelScale() { return Math.max(2, Math.min(3, Math.floor(Math.min(innerWidth / 196, innerHeight / 330)))); }
const W = 186;

let cssDone = false;
function css() {
  if (cssDone) return;
  cssDone = true;
  const st = document.createElement('style');
  st.textContent = `
.qp{position:fixed;z-index:44;--u:calc(var(--k) * 1px);width:calc(${W + 8} * var(--u));left:50%;bottom:calc(4 * var(--u));transform:translateX(-50%);image-rendering:pixelated;color:#1d2552;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;pointer-events:auto}
.qp.wide{left:auto;right:calc(18 * var(--u));bottom:50%;transform:translateY(50%)}
.qp *{box-sizing:border-box}
.qp.in{animation:qp-in .5s steps(10) both}.qp.wide.in{animation:qp-in-w .5s steps(10) both}
@keyframes qp-in{0%{transform:translate(-50%,110%)}70%{transform:translate(-50%,-3%)}100%{transform:translate(-50%,0)}}
@keyframes qp-in-w{0%{transform:translate(130%,50%)}70%{transform:translate(-3%,50%)}100%{transform:translate(0,50%)}}
.qp-folio{position:absolute;inset:0;background-size:100% 100%;image-rendering:pixelated}
.qp-sheet{position:relative;margin:calc(5 * var(--u)) calc(4 * var(--u)) calc(6 * var(--u));padding:calc(11 * var(--u)) calc(8 * var(--u)) calc(6 * var(--u));background-size:100% 100%;image-rendering:pixelated}
.qp-clip{position:absolute;left:50%;top:calc(-2 * var(--u));width:calc(46 * var(--u));height:calc(22 * var(--u));transform:translateX(-50%);background-size:100% 100%;z-index:3}
.qp-head{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:var(--u) solid #2b376a;padding-bottom:calc(2 * var(--u));margin-bottom:calc(3 * var(--u));white-space:nowrap}
.qp-firm{font:bold calc(12 * var(--u)) Galmuri,monospace;color:#22305a;line-height:1}
.qp-firm small{display:block;font:normal calc(16 * var(--u) / 2) "HH m5x7",monospace;letter-spacing:0;color:#5a5f80;margin-top:var(--u)}
.qp-no{font:calc(16 * var(--u) / 2) "HH m5x7",monospace;color:#5a5f80;text-align:right}
.qp-acorns{display:flex;gap:var(--u);margin-top:var(--u)}.qp-acorns i{width:calc(6 * var(--u));height:calc(6 * var(--u));background-size:100% 100%}
.qp-q{font:calc(18 * var(--u)) "HH m6x11",monospace;line-height:calc(12 * var(--u));color:#17130f;margin:0 0 calc(2 * var(--u))}
.qp-do{font:calc(16 * var(--u)) "HH m5x7",monospace;line-height:calc(9 * var(--u));color:#8a5a14;margin-bottom:calc(3 * var(--u));display:flex;gap:calc(3 * var(--u));align-items:center}
.qp-do b{font-weight:normal;color:#b33a1a}
.qp-grid{display:grid;gap:calc(3 * var(--u));margin-bottom:calc(3 * var(--u))}
.qp-card{position:relative;background-size:100% 100%;cursor:pointer;padding:calc(3 * var(--u)) calc(3 * var(--u)) calc(2 * var(--u));border:0;background-color:transparent;text-align:center;font:calc(16 * var(--u)) "HH m5x7",monospace;line-height:calc(8 * var(--u));color:#17130f;transition:transform .12s steps(2)}
.qp-card:active{transform:translateY(var(--u))}
.qp-card.on{transform:translateY(calc(-1 * var(--u)))}
.qp-win{display:block;width:100%;margin-bottom:calc(2 * var(--u))}
.qp-card .qp-tickbox{position:absolute;left:calc(5 * var(--u));top:calc(5 * var(--u));width:calc(13 * var(--u));height:calc(13 * var(--u));background-size:100% 100%;background-color:#f6eedb}
.qp-card .qp-label{display:flex;align-items:center;justify-content:center;min-height:calc(var(--lines, 2) * 8 * var(--u))}
.qp-card .qp-tick{left:calc(4 * var(--u));top:calc(4 * var(--u));bottom:auto}
.qp-tick{position:absolute;left:calc(3 * var(--u));bottom:calc(4 * var(--u));width:calc(16 * var(--u));height:calc(14 * var(--u));background-size:600% 100%;animation:qp-tick .3s steps(5) forwards}
@keyframes qp-tick{from{background-position:0 0}to{background-position:100% 0}}
.qp-loop{position:absolute;inset:calc(-2 * var(--u));background-size:100% 600%;animation:qp-loop .45s steps(5) forwards;pointer-events:none}
@keyframes qp-loop{from{background-position:0 0}to{background-position:0 100%}}
.qp-tape{position:absolute;left:50%;top:calc(-4 * var(--u));width:calc(30 * var(--u));height:calc(10 * var(--u));transform:translateX(-50%) rotate(-3deg);background-size:100% 100%;z-index:2}
.qp-foot{display:flex;align-items:stretch;justify-content:space-between;gap:calc(4 * var(--u));margin-top:calc(2 * var(--u))}
.qp-fine{font:calc(16 * var(--u) / 2) "HH m5x7",monospace;line-height:calc(5 * var(--u));color:#6a6f8a;align-self:flex-end;max-width:calc(80 * var(--u))}
.qp-box{position:relative;width:calc(92 * var(--u));height:calc(34 * var(--u));border:0;background:transparent;cursor:pointer;font:calc(16 * var(--u) / 2) "HH m5x7",monospace;color:#5a5f80;padding:0;flex:none}
.qp-box::before{content:'';position:absolute;inset:0;border:var(--u) dashed #6a6f8a}
.qp-box span{position:relative;display:block;margin-top:calc(2 * var(--u))}
.qp-box b{position:relative;display:block;font:calc(18 * var(--u)) "HH m6x11",monospace;color:#9a9ab0;margin-top:calc(2 * var(--u))}
.qp-box.ready::before{border:calc(2 * var(--u)) solid #b33a1a;animation:qp-pulse 1s steps(2) infinite}
.qp-box.ready b{color:#b33a1a}
@keyframes qp-pulse{50%{border-color:#e07a2a}}
.qp-impr{position:absolute;left:50%;top:50%;width:calc(86 * var(--u));height:calc(36 * var(--u));transform:translate(-50%,-50%) rotate(-5deg);background-size:100% 100%;animation:qp-impr .12s steps(2) both}
@keyframes qp-impr{from{opacity:0}to{opacity:1}}
.qp-sticky{position:absolute;right:calc(-4 * var(--u));top:calc(-30 * var(--u));width:calc(62 * var(--u));min-height:calc(34 * var(--u));background-size:100% 100%;transform:rotate(5deg);z-index:4;border:0;cursor:pointer;font:calc(16 * var(--u)) "HH m5x7",monospace;line-height:calc(7 * var(--u));color:#3a2a0a;padding:calc(4 * var(--u)) calc(3 * var(--u));text-align:center}
.qp-sticky b{display:block;color:#8a2a1a;margin-top:calc(2 * var(--u))}
.qp-sticky .qp-yes{display:flex;gap:calc(4 * var(--u));justify-content:center;margin-top:calc(3 * var(--u))}
.qp-sticky .qp-yes span{color:#8a2a1a;text-decoration:underline}
.qp-line{position:relative;margin:calc(2 * var(--u)) 0 calc(6 * var(--u))}
.qp-line input{width:100%;border:0;outline:0;background:transparent;font:calc(24 * var(--u)) "TBME Body",monospace;color:#1d2552;caret-color:#1d2552;padding:0 calc(2 * var(--u));height:calc(18 * var(--u));line-height:calc(18 * var(--u))}
.qp-line input::placeholder{color:#b9ad92}
.qp-line i{display:block;height:calc(3 * var(--u));background-size:100% 100%}
.qp-chips{display:flex;flex-wrap:wrap;gap:calc(3 * var(--u));margin-bottom:calc(5 * var(--u))}
.qp-chip{position:relative;border:0;cursor:pointer;background-size:100% 100%;font:calc(16 * var(--u)) "HH m5x7",monospace;padding:calc(2 * var(--u)) calc(4 * var(--u)) calc(2 * var(--u)) calc(16 * var(--u));color:#17130f;background-color:transparent}
.qp-chip .qp-tickbox{position:absolute;left:calc(2 * var(--u));top:calc(1 * var(--u));width:calc(11 * var(--u));height:calc(11 * var(--u));background-size:100% 100%}
.qp-chip .qp-tick{left:var(--u);bottom:auto;top:calc(-1 * var(--u))}
.qp-row{display:flex;align-items:center;justify-content:center;gap:calc(4 * var(--u));margin:calc(3 * var(--u)) 0}
.qp-tag{border:0;cursor:pointer;background-size:100% 100%;font:calc(16 * var(--u)) "HH m5x7",monospace;color:#17130f;padding:calc(3 * var(--u)) calc(6 * var(--u));background-color:transparent;position:relative}
.qp-big{font:calc(24 * var(--u)) "TBME Body",monospace;color:#1d2552;min-width:calc(60 * var(--u));text-align:center;line-height:1}
.qp-rail{position:relative;height:calc(28 * var(--u));margin:calc(4 * var(--u)) calc(6 * var(--u)) 0;touch-action:none;cursor:pointer}
.qp-rail>i{position:absolute;left:0;right:0;top:calc(8 * var(--u));height:calc(9 * var(--u));background-size:100% 100%}
.qp-rail>b{position:absolute;top:calc(2 * var(--u));width:calc(14 * var(--u));height:calc(18 * var(--u));margin-left:calc(-7 * var(--u));background-size:100% 100%}
.qp-rail>span{position:absolute;top:calc(20 * var(--u));transform:translateX(-50%);font:calc(16 * var(--u) / 2) "HH m5x7",monospace;color:#5a5f80}
.qp-sweet{position:absolute;top:0;height:calc(4 * var(--u));border:var(--u) solid #b07a1a;border-bottom:0}
.qp-plan{font:calc(16 * var(--u) / 2) "HH m5x7",monospace;line-height:calc(6 * var(--u));color:#17130f;margin-bottom:calc(4 * var(--u))}
.qp-plan h4{font:bold calc(12 * var(--u)) Galmuri,monospace;margin:calc(3 * var(--u)) 0 calc(1 * var(--u));color:#22305a;font-size:calc(6 * var(--u))}
.qp-plan .r{display:flex;justify-content:space-between;font:calc(16 * var(--u)) "HH m5x7",monospace;line-height:calc(8 * var(--u))}
.qp-plan .r em{font-style:normal;color:#1d2552}
.qp-sign{display:flex;gap:calc(6 * var(--u));margin-top:calc(3 * var(--u))}
.qp-sign button{flex:1;border:0;background:transparent;cursor:pointer;text-align:left;padding:0;font:calc(16 * var(--u) / 2) "HH m5x7",monospace;color:#6a6f8a}
.qp-sign .s{display:block;height:calc(16 * var(--u));font:calc(24 * var(--u)) "TBME Body",monospace;color:#1d2552;transform:skewX(-10deg);overflow:hidden;white-space:nowrap}
.qp-sign .s.go{animation:qp-write .9s steps(9) both}
@keyframes qp-write{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.qp-sign .hint{color:#b33a1a}
.qp-check{display:flex;align-items:center;gap:calc(4 * var(--u));border:0;background:transparent;cursor:pointer;font:calc(16 * var(--u)) "HH m5x7",monospace;color:#17130f;padding:0;position:relative}
.qp-check .qp-tickbox{position:relative;width:calc(13 * var(--u));height:calc(13 * var(--u));background-size:100% 100%;display:inline-block}
.qp-check .qp-tick{left:calc(-1 * var(--u));bottom:auto;top:calc(-1 * var(--u))}
.qp-fly{transition:transform .5s cubic-bezier(.5,0,.8,.4),opacity .5s steps(5)}
@media (prefers-reduced-motion:reduce){.qp *,.qp{animation-duration:0s!important}}
`;
  document.head.appendChild(st);
}

/** measure an element (texture sizes follow the layout) */
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

/** A card whose window carries a live 3D model (registered with the overlay while mounted). */
function Card(p: { id: string; label: string; on: boolean; seed: number; win: number; lines?: number; overlay: Overlay3D | null; model: ModelFor; mkey: string; k: number; onPick: () => void; multi?: boolean; children?: ComponentChildren }) {
  const win = useRef<HTMLElement>(null), el = useRef<HTMLButtonElement>(null);
  const sz = useSize(el, p.k, p.on);
  useEffect(() => {
    const o = p.overlay, w = win.current;
    if (!o || !w) return undefined;
    const m = p.model(p.mkey);
    if (!m) return undefined;
    o.setSlot(p.id, w, m.obj, m.opts);
    return () => o.removeSlot(p.id);
  }, [p.overlay, p.mkey]);
  useEffect(() => { if (p.on) p.overlay?.pick(p.id); }, [p.on]);
  return (
    <button type="button" ref={el} data-v={p.id} class={'qp-card' + (p.on ? ' on' : '')} aria-pressed={p.on} onClick={p.onPick}
      style={`--lines:${p.lines ?? 2};` + (sz.w ? `background-image:url(${cardURL(sz.w, sz.h, p.win, p.seed, p.on)})` : '')}>
      <i ref={win} class="qp-win" style={`height:calc(${p.win} * var(--u))`} />
      <i class="qp-tickbox" style={`background-image:url(${boxURL(p.seed)})`} />
      {p.on && <i class="qp-tick" style={`background-image:url(${tickStripURL(6, p.seed)})`} />}
      <span class="qp-label">{p.label}</span>
      {p.children}
    </button>
  );
}

function Tick(p: { on: boolean; seed: number }) {
  return (<><i class="qp-tickbox" style={`background-image:url(${boxURL(p.seed)})`} />{p.on && <i class="qp-tick" style={`background-image:url(${tickStripURL(6, p.seed)})`} />}</>);
}

/** The hand that turns the clock: drag round the window to set the time (12 hours a turn). */
function ClockWindow(p: { overlay: Overlay3D | null; model: ModelFor; onTurn: (min12: number) => void; h: number }) {
  const win = useRef<HTMLDivElement>(null);
  const drag = useRef(false), last = useRef(-1);
  useEffect(() => {
    const o = p.overlay, w = win.current;
    if (!o || !w) return undefined;
    const m = p.model('clock');
    if (!m) return undefined;
    o.setSlot('clock', w, m.obj, m.opts);
    return () => o.removeSlot('clock');
  }, [p.overlay]);
  const turn = (e: PointerEvent) => {
    const b = win.current!.getBoundingClientRect();
    let a = Math.atan2(e.clientX - (b.left + b.width / 2), -(e.clientY - (b.top + b.height * 0.5)));
    if (a < 0) a += Math.PI * 2;
    const m = (Math.round(((a / (Math.PI * 2)) * 720) / 15) * 15) % 720;
    if (m !== last.current) { last.current = m; p.onTurn(m); }
  };
  return <div ref={win} class="qp-win" style={`height:calc(${p.h} * var(--u));touch-action:none;cursor:grab`}
    onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); drag.current = true; turn(e); }}
    onPointerMove={(e) => { if (drag.current) turn(e); }} onPointerUp={() => { drag.current = false; }} />;
}

export function Panel(p: { step: Step; index: number; total: number; s: PanelState; act: PanelActions; overlay: Overlay3D | null; model: ModelFor; k: number; wide: boolean; leaving: boolean; sheetRef?: { current: HTMLDivElement | null } }) {
  css();
  const { step: st, s, act, k } = p;
  const root = useRef<HTMLDivElement>(null), sheet = useRef<HTMLDivElement>(null);
  const rsz = useSize(root, k, st.id), ssz = useSize(sheet, k, st.id + s.skipAsk);
  const a = s.a;
  const seed = p.index * 7 + 3;
  const winRef = useRef<HTMLElement | null>(null);
  const card = (id: string, label: string, on: boolean, mkey: string, i: number, win = 40, multi = false, lines = 2) => (
    <Card key={id} id={id} label={label} on={on} seed={seed + i} win={win} lines={lines} overlay={p.overlay} model={p.model} mkey={mkey} k={k} multi={multi} onPick={() => act.pick(id)} />
  );
  const doLine = (t: string) => <div class="qp-do">{t}</div>;
  let body: ComponentChildren = null;
  switch (st.kind) {
    case 'text': {
      const f = st.field as 'you' | 'name';
      body = (<>
        {doLine(f === 'you' ? 'Write your name on the line.' : 'Write a name, or tick one below.')}
        <label class="qp-line">
          <input value={a[f]} maxLength={16} placeholder={f === 'you' ? 'your name...' : 'Pip'} spellcheck={false} autocomplete="off" autocapitalize="words"
            onInput={(e) => act.text((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); act.enter(); } }} aria-label={st.title} />
          <i style={`background-image:url(${ruleURL(W - 18, seed)})`} />
        </label>
        {f === 'name' && (
          <div class="qp-chips">
            {['Pip', 'Hoot', 'Mochi', 'Biscuit', 'Luna', 'Juniper'].map((n, i) => (
              <button type="button" key={n} data-v={n} class="qp-chip" style={`background-image:url(${tapeURL(i + 1)})`} onClick={() => act.pick(n)}><Tick on={a.name.trim() === n} seed={i + 1} />{n}</button>
            ))}
          </div>
        )}
        {f === 'you' && <div class="qp-fine" style="margin-bottom:calc(5 * var(--u));max-width:none">Leave it blank to stay a mysterious stranger.</div>}
      </>);
      break;
    }
    case 'species': {
      const opts = st.opts ?? [];
      body = (<>
        {doLine('Tap the owl you would like Pip to be.')}
        <div class="qp-grid" style="grid-template-columns:repeat(3,1fr)">
          {opts.map((o, i) => card(o.v, speciesOf(o.v).name.replace(' Owl', '').replace('Northern ', ''), a.species === o.v, 'owl:' + o.v, i, 46, false, 1))}
        </div>
      </>);
      break;
    }
    case 'multi': case 'choice': {
      const opts = st.id === 'goals' ? GOALS : st.id === 'relax' ? RELAX : st.opts ?? [];
      const cur = st.kind === 'multi' ? (a[st.field as 'goals' | 'relax'] as string[]) : [];
      const val = st.id === 'mic' ? (a.mic ? 'yes' : 'no') : String(a[st.field!]);
      const n = opts.length, cols = n > 6 ? 3 : n === 4 || n === 2 ? 2 : 3;
      const winH = n > 6 ? 24 : n === 6 ? 34 : n === 4 ? 30 : 40;
      const lines = n === 4 || n === 2 ? 1 : 2;
      body = (<>
        {doLine(st.kind === 'multi' ? 'Tick all that fit you.' : 'Tick the one that fits you.')}
        <div class="qp-grid" style={`grid-template-columns:repeat(${cols},1fr)`}>
          {opts.map((o, i) => card(o.v, o.label, st.kind === 'multi' ? cur.includes(o.v) : !!s.picked[st.id] && o.v === val, `${st.id}:${o.v}`, i, winH, st.kind === 'multi', lines))}
        </div>
        {st.id === 'mic' && <div class="qp-fine" style="max-width:none;margin-bottom:calc(4 * var(--u))">Pip listens on this device only and keeps nothing else. {s.artifact ? 'This preview cannot use the microphone; the full app can.' : 'You can change it any time in Settings.'}</div>}
      </>);
      break;
    }
    case 'dial': {
      const m = toMin(a.wake), pm = m >= 720;
      body = (<>
        {doLine('Turn the clock, or tap the buttons.')}
        <ClockWindow overlay={p.overlay} model={p.model} onTurn={act.clock} h={84} />
        <div class="qp-row">
          <button type="button" class="qp-tag" style={`background-image:url(${tapeURL(2)})`} onClick={() => act.nudge(-15)}>- 15 min</button>
          <span class="qp-big">{fmt(a.wake, s.hour12).replace(/ [AP]M$/, '')}</span>
          <button type="button" class="qp-tag" style={`background-image:url(${tapeURL(3)})`} onClick={() => act.nudge(15)}>+ 15 min</button>
        </div>
        <div class="qp-row qp-ampm" style="margin-bottom:calc(5 * var(--u))">
          <button type="button" class="qp-check" onClick={() => act.ampm(false)}><Tick on={!pm} seed={4} />morning (AM)</button>
          <button type="button" class="qp-check" onClick={() => act.ampm(true)}><Tick on={pm} seed={5} />afternoon (PM)</button>
        </div>
      </>);
      break;
    }
    case 'hours': {
      const lo = 5, hi = 11, pct = (v: number) => ((v - lo) / (hi - lo)) * 100;
      const set = (e: PointerEvent) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); const v = Math.round((lo + Math.max(0, Math.min(1, (e.clientX - b.left) / b.width)) * (hi - lo)) * 2) / 2; act.hours(v); };
      body = (<>
        {doLine('Slide the brass marker.')}
        <i class="qp-win" style="height:calc(58 * var(--u))" ref={(el) => { winRef.current = el; }} />
        <div class="qp-row"><span class="qp-big">{String(a.hours).replace('.5', '½')} hours</span></div>
        <div class="qp-rail" onPointerDown={(e) => { (e.currentTarget as Element).setPointerCapture(e.pointerId); set(e); }} onPointerMove={(e) => { if (e.buttons) set(e); }}>
          <span class="qp-sweet" style={`left:${pct(7)}%;width:${pct(9) - pct(7)}%`} />
          <i style={`background-image:url(${railURL(160)})`} />
          {[5, 6, 7, 8, 9, 10, 11].map((h) => <span key={h} style={`left:${pct(h)}%`}>{h}</span>)}
          <b style={`left:${pct(a.hours)}%;background-image:url(${knobURL()})`} />
        </div>
        <div class="qp-fine" style="max-width:none;margin:calc(4 * var(--u)) 0 calc(4 * var(--u))">Most grown-ups need seven to nine hours.</div>
      </>);
      break;
    }
    case 'plan': {
      const pl = s.plan;
      body = (<>
        <div class="qp-plan">
          <div>between Hollow &amp; Co. and {a.you.trim() || 'our client'}, for the sleep of {a.name.trim() || 'Pip'} and household.</div>
          <h4>SCHEDULE</h4>
          {[['Wind down', fmt(pl.windDown, s.hour12)], ['Bedtime', fmt(pl.bed, s.hour12)], ['Wake up', fmt(pl.wake, s.hour12)], ['Alarm', ALARM_NAME[pl.alarm] ?? 'Music box'], ['Sleep sound', SOUND_NAME[pl.soundscape] ?? 'gentle rain'], ...(pl.blocker ? [['Bedtime Blocker', a.phone === 'nightly' ? 'On' : 'Ready']] : [])].map(([l, v]) => <div class="r" key={l}><span>{l}</span><em>{v}</em></div>)}
          {pl.tips.length > 0 && <><h4>TERMS</h4>{pl.tips.map((t, i) => <div key={t}>{i + 1}. {t}.</div>)}</>}
        </div>
        <button type="button" class="qp-check" onClick={act.remind}><Tick on={s.remind} seed={6} />Remind me to wind down</button>
        <div class="qp-sign">
          <button type="button" onClick={act.sign} aria-label="Sign the plan">
            <span class={'s' + (s.signed ? ' go' : '')}>{s.signed ? (a.you.trim() || 'A. Client') : ''}</span>
            <i style={`display:block;height:calc(3 * var(--u));background-image:url(${ruleURL(80, 9)});background-size:100% 100%`} />
            <span class={s.signed ? '' : 'hint'}>{s.signed ? 'signed, the client' : 'tap here to sign'}</span>
          </button>
          <div style="flex:1">
            <span class="s" style="display:block;height:calc(16 * var(--u));font:calc(24 * var(--u)) 'TBME Body',monospace;color:#1d2552;transform:skewX(-10deg)">{a.name.trim() || 'Pip'}</span>
            <i style={`display:block;height:calc(3 * var(--u));background-image:url(${ruleURL(80, 11)});background-size:100% 100%`} />
            <span style="font:calc(16 * var(--u) / 2) 'HH m5x7',monospace;color:#6a6f8a">for Hollow &amp; Co.</span>
          </div>
        </div>
      </>);
      break;
    }
  }
  // the hours page's pillow tower lives in its own window
  useEffect(() => {
    if (st.kind !== 'hours') return undefined;
    const o = p.overlay, w = winRef.current;
    if (!o || !w) return undefined;
    const m = p.model('pillows:' + Math.round(a.hours));
    if (!m) return undefined;
    o.setSlot('pillows', w, m.obj, m.opts);
    return () => o.removeSlot('pillows');
  }, [p.overlay, st.kind, Math.round(a.hours)]);

  const isPlan = st.kind === 'plan';
  const label = isPlan ? (s.signed ? 'STAMP TO APPROVE' : 'SIGN FIRST') : s.ready ? 'STAMP IT' : st.kind === 'choice' ? 'TICK ONE FIRST' : 'STAMP IT';
  const acorns = Array.from({ length: p.total }, (_, i) => (i < p.index ? 'done' : i === p.index ? 'now' : 'todo') as 'done' | 'now' | 'todo');
  return (
    <div ref={(el) => { root.current = el; if (p.sheetRef) p.sheetRef.current = el; }} class={'qp' + (p.wide ? ' wide' : '') + (p.leaving ? '' : ' in')} style={`--k:${k}`} data-step={st.id}>
      <i class="qp-folio" style={rsz.w ? `background-image:url(${folioURL(rsz.w, rsz.h)})` : ''} />
      <i class="qp-clip" style={`background-image:url(${clipURL()})`} />
      <div ref={sheet} class="qp-sheet" style={ssz.w ? `background-image:url(${sheetURL(ssz.w, ssz.h, p.index + 1, { dog: !isPlan, stain: p.index % 4 === 2 })})` : ''}>
        <div class="qp-head">
          <div class="qp-firm">HOLLOW &amp; CO.<small>SLEEP CONSULTANTS</small></div>
          <div class="qp-no">{isPlan ? 'AGREEMENT' : `QUESTION ${p.index + 1} / ${p.total - 1}`}<div class="qp-acorns">{acorns.slice(0, p.total - 1).map((st2, i) => <i key={i} style={`background-image:url(${acornURL(st2)})`} />)}</div></div>
        </div>
        <h2 class="qp-q">{isPlan ? 'Your sleep plan' : st.title}</h2>
        {body}
        <div class="qp-foot">
          <div class="qp-fine">{isPlan ? 'Sign, then Pip stamps it.' : 'Hollow & Co. keeps your answers on this device only.'}</div>
          <button type="button" class={'qp-box' + (s.ready && !s.stamped ? ' ready' : '')} onClick={act.stamp} aria-label={label}>
            <span>FOR OFFICE USE</span>
            {!s.stamped && <b>{label}</b>}
            {s.stamped && <i class="qp-impr" style={`background-image:url(${stampURL(s.stamped, '')})`} />}
          </button>
        </div>
        {!isPlan && (
          <div class="qp-sticky" role="button" tabIndex={0} style={`background-image:url(${stickyURL(62, s.skipAsk ? 48 : 34)})`} onClick={() => act.skip(!s.skipAsk)}>
            {!s.skipAsk ? <>Been here before?<b>SKIP &gt;</b></> : <>Skip the forms? Pip picks cozy defaults.<span class="qp-yes"><span onClick={(e) => { e.stopPropagation(); act.skipYes(); }}>YES</span><span>NO</span></span></>}
          </div>
        )}
      </div>
    </div>
  );
}
export { loopStripURL };
