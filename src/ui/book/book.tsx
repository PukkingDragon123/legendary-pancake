// Pip's sleep diary: a leather-bound book with clear stats, every night in a list, the collection
// and the badges. It slides up into view with a little bounce and a puff of dust (Pip, in the 3D
// world behind, presents it with a flourish), the cover swings open and the pages flutter. Turn
// pages with the brass arrows, a swipe, the arrow keys or the cloth tabs; tap a night to read it
// on a loose leaf tucked in the book. Closing shuts the cover and the page transition takes over.
//
// Public: <Book /> (rendered by app.tsx while panel.value === 'book'; closes by setting panel to null).
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { progress } from '../../game/quests.ts';
import { edit, save } from '../../game/store.ts';
import { uiBurst } from '../chrome/uifx.ts';
import { fmtDur, fmtTime } from '../kit.tsx';
import { panel, sceneRef } from '../state.ts';
import { CSS_TOKENS } from '../../gfx/palette.ts';
import { arrowArt, boardArt, coverArt, hexOf, iconArt, inkFrameArt, moodArt, MOOD_NAMES, paperArt, ribbonArt, scoreHex, tabArt } from './art.ts';
import { Chart, hypnoSteps, STAGE_INK, STAGE_NAME, stageBar } from './charts.tsx';
import { layout, type BookLayout } from './layout.ts';
import { Badge, buildPages, Img, SECTIONS, type PageCtx, type PageDef, type SectionId } from './pages.tsx';
import { reported, scoreWord, type Night } from './stats.ts';
import './book.css';

// the calm palette as CSS variables, scoped to the diary
if (typeof document !== 'undefined' && !document.getElementById('bk-tokens')) {
  const st = document.createElement('style');
  st.id = 'bk-tokens';
  st.textContent = CSS_TOKENS.replace(':root', '.bk-stage');
  document.head.appendChild(st);
}

type Phase = 'enter' | 'open' | 'exit';
interface Flip { from: number; to: number; dir: 1 | -1; n: number }

const sfx = (id: string, volume = 0.5, rate?: number) => { try { sound.play(id, { volume, rate, gap: 30 }); } catch { /* sound not ready */ } };
const owlDo = (f: (o: NonNullable<NonNullable<typeof sceneRef.current>['owl']>) => void) => { try { const o = sceneRef.current?.owl; if (o) f(o); } catch { /* scene busy */ } };
const reduced = () => { try { return save.value.settings.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

// dev-only knobs for screenshots: ?bk=open | night | page:N | enter:0.5 | flip:0.5 (freeze a moment)
const DEV = (() => { try { return import.meta.env.DEV ? new URLSearchParams(location.search).get('bk') ?? '' : ''; } catch { return ''; } })();
const ENTER_MS = 1450, FLIP_MS = 460;
/** dev: pause every running animation at `ms` (screenshots of a moment) */
const freezeAt = (ms: number) => requestAnimationFrame(() => requestAnimationFrame(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ms; } }));

export function Book() {
  const [L, setL] = useState<BookLayout>(() => layout(innerWidth, innerHeight));
  const s = save.value;
  const pages = useMemo(() => buildPages(s, L), [s, L]);
  const per = L.single ? 1 : 2, spreads = Math.ceil(pages.length / per);
  const [at, setAt] = useState(() => { const m = /^page:(\d+)/.exec(DEV); return m ? Math.min(spreads - 1, Math.floor(+m[1] / per)) : 0; });
  const [flip, setFlip] = useState<Flip | null>(null);
  const [phase, setPhase] = useState<Phase>(() => (DEV === 'open' || DEV.startsWith('page') || DEV.startsWith('flip') || DEV === 'night' || reduced() ? 'open' : 'enter'));
  const [night, setNight] = useState<string | null>(DEV === 'night' ? reported(s).at(-1)?.id ?? null : null);
  const stage = useRef<HTMLDivElement>(null);
  const flipN = useRef(0);
  const atRef = useRef(at); atRef.current = at;
  const busy = () => phase !== 'open' || !!flip;

  // ---------------------------------------------------------------- entrance
  useEffect(() => {
    const timers: number[] = [];
    const later = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    if (phase === 'enter') {
      owlDo((o) => { o.setMood('excited', 2.5); o.play('present'); });
      sfx('fabric', 0.35, 0.9);
      later(470, () => {
        sfx('wood_knock', 0.5, 0.6); sfx('pet_land', 0.3);
        const T = L, y = T.y + T.BH;
        uiBurst('puff', T.x + 20, y, 7); uiBurst('puff', T.x + T.BW - 20, y, 7);
      });
      later(650, () => { sfx('ui_toggle', 0.45, 0.8); sfx('paper_flip', 0.55, 0.85); });
      later(980, () => { sfx('paper_flip', 0.35, 1.3); });
      later(1100, () => { sfx('paper_flip', 0.3, 1.45); });
      if (DEV.startsWith('enter:')) freezeAt(+DEV.split(':')[1] * ENTER_MS);
      else later(ENTER_MS, () => { setPhase('open'); owlDo((o) => { o.setMood('proud', 2); }); });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); api.current.close(); }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') api.current.turn(atRef.current + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') api.current.turn(atRef.current - 1);
    };
    addEventListener('keydown', onKey);
    let rt = 0;
    const onResize = () => { clearTimeout(rt); rt = window.setTimeout(() => setL(layout(innerWidth, innerHeight)), 160); };
    addEventListener('resize', onResize);
    return () => { timers.forEach(clearTimeout); removeEventListener('keydown', onKey); removeEventListener('resize', onResize); clearTimeout(rt); };
  }, []);

  // dev: start a page turn to freeze (?bk=flip:0.5)
  useEffect(() => { if (DEV.startsWith('flip:')) window.setTimeout(() => api.current.turn(atRef.current + 1), 300); }, []);

  // keep the same page in view when the layout switches between one page and a spread
  const prevL = useRef(L);
  useEffect(() => {
    const was = prevL.current;
    prevL.current = L;
    if (was.single === L.single) return;
    const first = was.single ? atRef.current : atRef.current * 2;
    setAt(L.single ? first : Math.floor(first / 2));
  }, [L]);

  // ---------------------------------------------------------------- turning pages
  function turn(to: number) {
    to = Math.max(0, Math.min(spreads - 1, to));
    if (busy() || night || to === atRef.current) return;
    const dir = to > atRef.current ? 1 : -1;
    sfx('paper_flip', 0.5, 0.9 + Math.random() * 0.2);
    if (Math.abs(to - atRef.current) > 1) window.setTimeout(() => sfx('paper_flip', 0.35, 1.2), 120);
    if (reduced()) { setAt(to); return; }
    const n = ++flipN.current;
    setFlip({ from: atRef.current, to, dir, n });
    if (DEV.startsWith('flip:')) { freezeAt(+DEV.split(':')[1] * FLIP_MS); return; }
    window.setTimeout(() => { if (flipN.current === n) { setAt(to); setFlip(null); } }, FLIP_MS);
  }
  const go = (sec: SectionId) => { const i = pages.findIndex((p) => p.section === sec); if (i >= 0) turn(Math.floor(i / per)); };
  function close() {
    if (night) { setNight(null); return; }
    if (phase === 'exit') return;
    if (reduced()) { panel.value = null; return; }
    setFlip(null);
    setPhase('exit');
    sfx('paper_flip', 0.45, 0.8);
    owlDo((o) => { o.play('wave'); o.setMood('happy', 2); });
    window.setTimeout(() => { sfx('wood_knock', 0.35, 0.9); if (panel.value === 'book') panel.value = null; }, 330);
  }
  const api = useRef({ close, turn });
  api.current = { close, turn };

  // swipe to turn
  const sw = useRef<{ x: number; y: number; id: number } | null>(null);
  const onDown = (e: PointerEvent) => { if (!busy()) sw.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; };
  const onUp = (e: PointerEvent) => {
    const d = sw.current; sw.current = null;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.3) turn(atRef.current + (dx < 0 ? 1 : -1));
  };

  // ---------------------------------------------------------------- render
  const T = L.T, pad = Math.round(L.fs * 0.9);
  const ctx: PageCtx = { L, cw: L.PW - 2 * pad, openNight: (id) => { sfx('paper_flip', 0.4, 1.2); setNight(id); } };
  const board = boardArt(L.W, L.H, !L.single);
  const PageView = (idx: number, side: 'L' | 'R' | 'S', cls = '') => {
    const def: PageDef | undefined = pages[idx];
    return (
      <div class={'bk-page ' + cls} key={cls + ':' + (def?.key ?? 'none' + idx)} style={{ width: `${L.PW}px`, height: `${L.PH}px`, backgroundImage: `url(${paperArt(L.pw, L.ph, side, 3 + (idx % 4)).url})`, padding: `${pad}px ${pad}px ${pad}px ${pad + (side === 'R' ? 6 : 0)}px` }}>
        {def ? def.render(ctx) : null}
        {def && <span class="bk-num">{idx + 1}</span>}
      </div>
    );
  };
  // what lies under a turning leaf
  const base = (() => {
    if (!flip) return L.single ? [at] : [2 * at, 2 * at + 1];
    if (L.single) return [flip.dir > 0 ? flip.to : flip.from];
    return flip.dir > 0 ? [2 * flip.from, 2 * flip.to + 1] : [2 * flip.to, 2 * flip.from + 1];
  })();
  const leaf = (() => {
    if (!flip) return null;
    const sideF: 'L' | 'R' | 'S' = L.single ? 'S' : flip.dir > 0 ? 'R' : 'L';
    if (L.single) {
      const front = flip.dir > 0 ? flip.from : flip.to;
      return (
        <div class={'bk-leaf ' + (flip.dir > 0 ? 'out' : 'in')} key={'leaf' + flip.n} style={{ left: `${L.B * T}px`, top: `${L.B * T}px`, width: `${L.PW}px`, height: `${L.PH}px` }}>
          <div class="bk-face front">{PageView(front, 'S', 'f')}</div>
          <div class="bk-face back" style={{ backgroundImage: `url(${paperArt(L.pw, L.ph, 'S', 9).url})` }} />
        </div>
      );
    }
    const front = flip.dir > 0 ? 2 * flip.from + 1 : 2 * flip.from, back = flip.dir > 0 ? 2 * flip.to : 2 * flip.to + 1;
    const left = flip.dir > 0 ? (L.B + L.pw) * T : L.B * T;
    return (
      <div class={'bk-leaf ' + (flip.dir > 0 ? 'fwd' : 'back')} key={'leaf' + flip.n} style={{ left: `${left}px`, top: `${L.B * T}px`, width: `${L.PW}px`, height: `${L.PH}px` }}>
        <div class="bk-face front">{PageView(front, sideF, 'f')}</div>
        <div class="bk-face back">{PageView(back, flip.dir > 0 ? 'L' : 'R', 'b')}</div>
      </div>
    );
  })();
  const curPage = flip ? flip.to * per : at * per;
  const curSection = pages[Math.min(pages.length - 1, curPage + (per - 1))]?.section ?? 'stats';
  const nightObj = night ? reported(s).find((n) => n.id === night) : undefined;
  const coverW = L.single ? L.W : L.pw + L.B, coverX = L.single ? 0 : (L.pw + L.B) * T;
  const tabW = Math.min(L.single ? Math.floor((L.W - 8) / SECTIONS.length) - 2 : 56, 60);

  return (
    <div class={`bk-stage ph-${phase}` + (L.single ? ' single' : ' spread')} ref={stage} role="dialog" aria-modal="true" aria-label={`${s.name}'s sleep diary`}
      style={{ '--T': `${T}px`, '--fs': `${L.fs}px`, '--inkframe': `url(${inkFrameArt(1).url})`, '--inkframe2': `url(${inkFrameArt(2).url})` } as Record<string, string>}>
      <div class="bk-dim" onClick={close} />
      <div class="bk-book" style={{ left: `${L.x}px`, top: `${L.y}px`, width: `${L.BW}px`, height: `${L.BH}px` }}>
        {/* cloth index tabs along the top edge */}
        <div class="bk-tabs" style={{ left: `${(L.single ? 4 : L.W - 4 - SECTIONS.length * (tabW + 2)) * T}px` }}>
          {SECTIONS.map((sec) => {
            const on = sec.id === curSection, h = on ? 25 : 22;
            return (
              <button class={'bk-tab' + (on ? ' on' : '')} aria-label={sec.name} aria-current={on} onClick={(e) => { e.stopPropagation(); sfx('ui_tab', 0.4); go(sec.id); }}
                style={{ width: `${tabW * T}px`, height: `${h * T}px`, backgroundImage: `url(${tabArt(sec.tint, tabW, h, on).url})` }}>
                <Img a={iconArt(sec.icon, sec.tint)} T={T} /><span>{sec.name}</span>
              </button>
            );
          })}
        </div>
        <img class="bk-board bk-px" src={board.url} alt="" draggable={false} style={{ width: `${L.BW}px`, height: `${L.BH}px` }} />
        {[['berry', 0.38], ['moss', 0.62]].map(([c, k]) => <img class="bk-ribbon bk-px" src={ribbonArt(16, c as string).url} alt="" draggable={false} style={{ left: `${Math.round(L.W * (k as number)) * T}px`, top: `${L.BH - 2 * T}px`, width: `${5 * T}px` }} />)}
        <div class="bk-pages" style={{ left: `${L.B * T}px`, top: `${L.B * T}px` }}
          onPointerDown={onDown as unknown as JSX.PointerEventHandler<HTMLDivElement>} onPointerUp={onUp as unknown as JSX.PointerEventHandler<HTMLDivElement>}>
          {base.map((idx, i) => <div class="bk-slot" style={{ left: `${i * L.PW}px` }}>{PageView(idx, L.single ? 'S' : i ? 'R' : 'L')}</div>)}
        </div>
        {leaf}
        {/* the front cover: it swings open on the way in and shuts on the way out */}
        <div class="bk-cover" style={{ left: `${coverX}px`, width: `${coverW * T}px`, height: `${L.BH}px` }}>
          <div class="bk-face front" style={{ backgroundImage: `url(${coverArt(coverW, L.H).url})` }}>
            <b class="bk-ct" style={{ top: `${Math.round(L.H * 0.64 + 6.5) * T}px`, fontSize: coverW * T * 0.07 >= 22 * (L.fs / 16) ? 'var(--t2)' : 'var(--t1)' }}>Sleep Diary</b>
            <b class="bk-cn" style={{ top: `${Math.round(L.H * 0.64 + 18) * T}px` }}>{s.name}</b>
          </div>
          <div class="bk-face back" style={{ backgroundImage: `url(${paperArt(L.single ? L.pw : L.pw, L.ph, 'L', 11).url})` }} />
        </div>
        {/* a few blank pages flutter over as the book opens */}
        {phase === 'enter' && <div class="bk-flut" style={{ left: `${(L.single ? L.B : L.B + L.pw) * T}px`, top: `${L.B * T}px`, width: `${L.PW}px`, height: `${L.PH}px` }}>
          {[0, 1, 2].map((i) => <i style={{ '--i': i, backgroundImage: `url(${paperArt(L.pw, L.ph, 'S', 20 + i).url})` } as Record<string, string | number>} />)}
        </div>}
      </div>
      {/* footer: brass arrows, the page number and the close button */}
      <div class="bk-foot" style={{ top: `${L.y + L.BH + 10}px` }}>
        <button class="bk-arrow" aria-label="Previous page" disabled={at <= 0} onClick={() => turn(at - 1)}><Img a={arrowArt('l')} T={T * 2} /></button>
        <span class="bk-pg">{curPage + 1}{per > 1 && pages[curPage + 1] ? `–${curPage + 2}` : ''} / {pages.length}</span>
        <button class="bk-arrow" aria-label="Next page" disabled={at >= spreads - 1} onClick={() => turn(at + 1)}><Img a={arrowArt('r')} T={T * 2} /></button>
        <button class="bk-close" aria-label="Close the diary" onClick={close}><span>Close</span></button>
      </div>
      {nightObj && <NightLeaf n={nightObj} L={L} onClose={() => { sfx('paper_flip', 0.35, 1.2); setNight(null); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ a night, on a loose leaf tucked in the book

function NightLeaf(p: { n: Night; L: BookLayout; onClose: () => void }) {
  const n = p.n, r = n.report, T = p.L.T, h12 = save.value.settings.hour12;
  const saved = save.value.nights.find((x) => x.id === n.id);
  const mood = saved?.mood, note = saved?.note ?? '';
  const w = Math.min(p.L.single ? p.L.vw - 20 : 560, 600), pw = Math.floor(w / T), ph = Math.floor(Math.min(p.L.vh - 30, 760) / T);
  const stamp = (i: number) => {
    sfx('stamp', 0.55);
    edit((x) => { const ni = x.nights.find((y) => y.id === n.id); if (ni) ni.mood = i; });
    try { progress('mood'); } catch { /* */ }
  };
  const cw = w - 32;
  return (
    <div class="bk-leaf-back" onClick={(e) => { e.stopPropagation(); p.onClose(); }}>
      <article class="bk-loose" style={{ width: `${pw * T}px`, maxHeight: `${ph * T}px`, backgroundImage: `url(${paperArt(pw, ph, 'S', 13).url})` }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Night details">
        <header class="bk-lhead">
          <Badge score={r.score} size={Math.round(p.L.fs * 3.4)} T={T} />
          <div>
            <small class="bk-kicker">{new Date(n.start).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}{n.simulated ? ' · demo night' : ''}</small>
            <h2 class="bk-title" style={{ color: scoreHex(r.score) }}>{scoreWord(r.score)} night</h2>
            <span class="bk-muted">{fmtDur(r.asleep)} asleep · {fmtTime(r.asleepAt, h12)} to {fmtTime(r.wokeAt, h12)}</span>
          </div>
        </header>
        <Chart w={cw} h={Math.round(Math.min(150, cw * 0.4))} T={T} draw={hypnoSteps(n, h12)} dep={'h' + n.id} label="Sleep stages through the night" />
        <Chart w={cw} h={Math.round(p.L.fs * 1.5)} T={T} draw={stageBar(r)} dep={'b' + n.id} label="Make-up of the night" class="bk-stagebar" />
        <div class="bk-legend">{(['deep', 'light', 'rem', 'awake'] as const).map((k) => <span><i style={{ background: hexOf(STAGE_INK[k]) }} />{STAGE_NAME[k]} {Math.round(r[k] * 100)}%</span>)}</div>
        <dl class="bk-avg two">
          <dt>Asleep in bed</dt><dd>{Math.round(r.efficiency * 100)}%</dd>
          <dt>Drifting off</dt><dd>{Math.round(r.latencyMin)} min</dd>
          <dt>Times awake</dt><dd>{r.awakenings}</dd>
          <dt>Snoring</dt><dd>{Math.round(r.snoreMin)} min</dd>
        </dl>
        {r.notes.slice(0, 2).map((t) => <p class="bk-note">{t}</p>)}
        <div class="bk-moodrow" role="group" aria-label="How did you feel?">
          <small class="bk-kicker">How did you feel?</small>
          <div>{MOOD_NAMES.map((m, i) => <button class={'bk-moodbtn' + (mood === i ? ' on' : '')} aria-label={m} aria-pressed={mood === i} onClick={() => stamp(i)}><Img a={moodArt(i)} T={T * 2} /><small>{m}</small></button>)}</div>
        </div>
        {note.trim() && <p class="bk-handnote">{note}</p>}
        <button class="bk-link" onClick={p.onClose}>Tuck it back in</button>
      </article>
    </div>
  );
}
