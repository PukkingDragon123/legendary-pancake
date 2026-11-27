// The Book: Pip's sleep briefing. The Hollow & Co. office becomes a briefing room (room.ts): this week in marker on a
// rolling whiteboard, the trends on a pull-down screen lit by a projector, the nights filed on the desk and Pip's
// leather diary beside them. A carved walnut panel (on the right on wide screens, a bottom sheet on phones) holds the
// same story in clear 2D, behind four tabs that steer the camera and send Pip flying to his spot:
//   Overview   the week's numbers and Pip's take       (the whiteboard)
//   Trends     four slides: hours, score, stages, bed & wake   (the projector screen; a laser dot points)
//   Nights     every night as a ledger row; tap one for its full report on a paper card
//   Diary      an open leather book: what you did great today (from your real data), aims for tonight, and a page
//              of free notes saved per day; leaf back through earlier days
// Without 3D the panel stands alone on a walnut wall, with the board and the slides as pictures.
//
// Public: <Book /> (rendered by app.tsx while panel.value === 'book'; closes by setting panel to null).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../../audio/sound.ts';
import { progress } from '../../game/quests.ts';
import { dayKey, edit, save } from '../../game/store.ts';
import type { Stage } from '../../sleep/types.ts';
import { Px } from '../icons.tsx';
import { tap } from '../kit.tsx';
import { paperCSS } from '../sleepkit.tsx';
import { bubble, panel, sceneRef } from '../state.ts';
import { moodArt, MOOD_NAMES } from './art.ts';
import { briefOf, clockOf, goalTxt, hm, paintBoardBase, paintBoardInk, paintSlide, scoreCol, SLIDES, STAGE_COL, type Brief, type SlideId } from './boards.ts';
import { Briefing, type Spot, type Tap } from './room.ts';
import { averages, fromDay, fromEvening, reported, scoreWord, type Night } from './stats.ts';
import { diaryDays, winsFor, type Win, type WinKind } from './wins.ts';
import './book.css';

type Sec = 'overview' | 'trends' | 'nights' | 'diary';
const SECS: { id: Sec; name: string; icon: string; spot: Spot }[] = [
  { id: 'overview', name: 'Overview', icon: 'clipboard', spot: 'board' },
  { id: 'trends', name: 'Trends', icon: 'stats', spot: 'screen' },
  { id: 'nights', name: 'Nights', icon: 'nights', spot: 'desk' },
  { id: 'diary', name: 'Diary', icon: 'pen', spot: 'diary' },
];
const SPOT_SEC: Record<Tap, Sec | null> = { board: 'overview', screen: 'trends', folder: 'nights', diary: 'diary', pip: null };

const sfx = (id: string, volume = 0.45, rate?: number) => { try { sound.play(id, { volume, rate, gap: 30 }); } catch { /* sound not ready */ } };
// dev-only: ?bk=overview|trends|nights|diary|night and ?bks=hours|score|stages|window open on a section / slide
const DEV = (() => { try { return import.meta.env.DEV ? new URLSearchParams(location.search) : null; } catch { return null; } })();
const devSec = (): Sec => { const v = DEV?.get('bk'); return v === 'trends' || v === 'nights' || v === 'diary' ? v : v === 'night' ? 'nights' : 'overview'; };
const devSlide = (): SlideId => { const v = DEV?.get('bks'); return SLIDES.some((s) => s.id === v) ? (v as SlideId) : 'hours'; };
const isWide = () => innerWidth >= 860 && innerWidth / innerHeight >= 1.15;
const ritualOf = (day: string): string[] => { try { const v = JSON.parse(localStorage.getItem('hoot-hollow:ritual:' + day) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const longDate = (d: Date) => d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
const dayDate = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };

// ------------------------------------------------------------------ Pip's take on the week

function takeOf(b: Brief): string {
  const goal = b.goalMin * 60_000;
  if (b.sample) return 'This is a sample week, so you can see how it works. Sleep with me tonight and the board fills with your own numbers.';
  if (!b.wk) return 'No nights this week yet. Tonight is a fine night to start again: I’ll be ready.';
  const parts: string[] = [];
  const short = goal - b.wk.asleep;
  if (short <= goal * 0.03) parts.push(`You’re meeting your ${goalTxt(b.goalMin)} goal.`);
  else if (short <= goal * 0.12) parts.push(`Close: about ${Math.round(short / 60_000)} minutes a night short of your goal. Try bed 15 minutes earlier.`);
  else parts.push(`You’re averaging ${hm(b.wk.asleep)}, ${hm(short)} under your goal. Small steps: 15 minutes earlier every few nights.`);
  if (b.bedSpread !== null && b.bedSpread > 45) parts.push(`Your bedtime wanders (± ${Math.round(b.bedSpread)} min). A steadier one helps you drop off sooner.`);
  else if (b.bedSpread !== null) parts.push('Your bedtime is nice and steady. Keep it there, weekends too.');
  else if (b.wk.latency > 25) parts.push('Drifting off takes a while. A few slow breaths with me before bed can help.');
  return parts.join(' ');
}

// ------------------------------------------------------------------ the screen

export function Book() {
  const s = save.value;
  const brief = useMemo(() => briefOf(s), [s.nights, s.sleep.goalMin, s.streak, s.settings.hour12, s.name]);
  const [sec, setSec] = useState<Sec>(devSec);
  const [slide, setSlide] = useState<SlideId>(devSlide);
  const [night, setNight] = useState<string | null>(() => (DEV?.get('bk') === 'night' ? reported(s).at(-1)?.id ?? null : null));
  const [flat, setFlat] = useState(() => !sceneRef.current);
  const [wide, setWide] = useState(isWide);
  const [shown, setShown] = useState(false);
  const room = useRef<Briefing | null>(null);
  const panelEl = useRef<HTMLElement>(null);
  const briefRef = useRef(brief); briefRef.current = brief;
  const latest = useRef({ sec, slide, night }); latest.current = { sec, slide, night };

  function goSec(id: Sec, quiet = false) {
    if (id === latest.current.sec) return;
    if (!quiet) sfx('ui_tab', 0.4);
    setSec(id);
    room.current?.go(SECS.find((x) => x.id === id)!.spot);
  }
  function pickSlide(id: SlideId) {
    if (id === latest.current.slide) return;
    setSlide(id);
    room.current?.slide(id);
    if (!room.current) sfx('tick_brass', 0.4, 0.7);
  }
  const stepSlide = (d: number) => { const i = SLIDES.findIndex((x) => x.id === latest.current.slide); pickSlide(SLIDES[(i + d + SLIDES.length) % SLIDES.length].id); };
  function close() {
    if (latest.current.night) { sfx('paper_flip', 0.35, 1.2); setNight(null); return; }
    tap('ui_close', 0.5);
    panel.value = null;
  }
  const api = useRef({ close, goSec, stepSlide });
  api.current = { close, goSec, stepSlide };

  // ---- the briefing room: built on open (the page transition covers the cut), torn down on close
  useEffect(() => {
    bubble.value = null;
    const unsub = bubble.subscribe((b) => { if (b) bubble.value = null; }); // Pip's world words stay at home
    const sc = sceneRef.current;
    let r: Briefing | null = null;
    if (sc) {
      try {
        r = new Briefing(sc, save.value.look);
        room.current = r;
        r.slide(latest.current.slide);
        r.setBrief(briefRef.current);
        r.onTap = (w) => {
          const to = SPOT_SEC[w];
          if (w === 'pip') { r?.poke(); sfx('owl_hoot', 0.2, 1.2); return; }
          if (w === 'screen' && latest.current.sec === 'trends') { api.current.stepSlide(1); return; }
          if (to) api.current.goSec(to);
        };
        r.intro(SECS.find((x) => x.id === latest.current.sec)!.spot);
      } catch (e) { console.warn('briefing room failed', e); room.current = null; setFlat(true); }
    }
    const t = setTimeout(() => setShown(true), r ? 500 : 60);
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') { if (e.key === 'Escape') (e.target as HTMLElement).blur(); return; }
      if (e.key === 'Escape') { e.preventDefault(); api.current.close(); }
      if (latest.current.sec === 'trends' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) api.current.stepSlide(e.key === 'ArrowRight' ? 1 : -1);
    };
    const onResize = () => setWide(isWide());
    addEventListener('keydown', onKey);
    addEventListener('resize', onResize);
    if (import.meta.env.DEV) (window as unknown as { hhBook: unknown }).hhBook = { room: r, sec: (id: Sec) => api.current.goSec(id), slide: (id: SlideId) => pickSlide(id) };
    return () => {
      clearTimeout(t); unsub();
      removeEventListener('keydown', onKey); removeEventListener('resize', onResize);
      r?.dispose(); room.current = null;
    };
  }, []);
  // ---- the numbers in the room follow the save
  useEffect(() => { room.current?.setBrief(brief); }, [brief]);
  // ---- frame the room in the part of the screen the panel leaves free
  useLayoutEffect(() => {
    const el = panelEl.current;
    if (!el) return undefined;
    const fit = () => {
      const r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      room.current?.setFree(wide ? { x0: 0, y0: 64, x1: Math.max(W * 0.3, r.left - 12), y1: H - 8 } : { x0: 0, y0: 64, x1: W, y1: Math.max(H * 0.28, r.top + 12) });
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    addEventListener('resize', fit);
    return () => { ro?.disconnect(); removeEventListener('resize', fit); };
  }, [wide, sec, shown]);

  const nightObj = night ? reported(s).find((n) => n.id === night) : undefined;
  const openNight = (id: string) => { sfx('paper_flip', 0.45, 1.1); setNight(id); };
  return (
    <div class={'bk2' + (wide ? ' wide' : ' narrow') + (flat ? ' flat' : '') + ' s-' + sec} role="dialog" aria-modal="true" aria-label="Sleep briefing">
      <button class="bk2-back" aria-label="Back to the hollow" onClick={close}><Px name="arrow_left" size={28} /><span>Back</span></button>
      <aside ref={panelEl} class={'bk2-panel sheet' + (shown ? ' in' : '')} aria-label="Briefing">
        <header class="bk2-head">
          <h1 class="t3d-ink">{sec === 'diary' ? 'My diary' : 'Sleep briefing'}</h1>
          {(brief.sample || brief.demo) && sec !== 'diary' && <span class="bk2-chip">{brief.sample ? 'Sample data' : 'Pretend nights'}</span>}
        </header>
        <nav class="bk2-tabs seg" role="tablist">
          {SECS.map((x) => (
            <button role="tab" aria-selected={sec === x.id} class={sec === x.id ? 'on' : ''} onClick={() => goSec(x.id)}>
              <Px name={x.icon} size={26} /><span>{x.name}</span>
            </button>
          ))}
        </nav>
        <div class="bk2-body" key={sec}>
          {sec === 'overview' && <Overview b={brief} flat={flat} onTrends={() => goSec('trends')} />}
          {sec === 'trends' && <Trends b={brief} slide={slide} flat={flat} onPick={pickSlide} />}
          {sec === 'nights' && <Nights onOpen={openNight} />}
          {sec === 'diary' && <Diary wide={wide} onNight={openNight} />}
        </div>
      </aside>
      {nightObj && <NightCard n={nightObj} onClose={() => { sfx('paper_flip', 0.35, 1.2); setNight(null); }} />}
    </div>
  );
}

// ------------------------------------------------------------------ overview

function Tile(p: { label: string; value: string; sub?: string; color?: string; fill?: number }) {
  return (
    <div class="bk2-tile">
      <small>{p.label}</small>
      <b class="num" style={p.color ? { color: p.color } : undefined}>{p.value}</b>
      {p.fill !== undefined && <i class="bk2-meter"><i style={{ width: `${Math.round(Math.max(0, Math.min(1, p.fill)) * 100)}%` }} /></i>}
      {p.sub && <span>{p.sub}</span>}
    </div>
  );
}

function Overview(p: { b: Brief; flat: boolean; onTrends: () => void }) {
  const b = p.b, wk = b.wk, goal = b.goalMin * 60_000;
  const tracked = b.week.filter((d) => d.night).length;
  const bestDay = b.best ? new Date(b.best.report.wokeAt).toLocaleDateString([], { weekday: 'long' }) : '';
  return (
    <div class="bk2-sec">
      <p class="bk2-kicker">{b.sample ? 'Sample week' : 'This week'} · {b.range}</p>
      {p.flat && <CanvasPic class="bk2-board" w={1536} h={1024} paint={(c) => { paintBoardBase(c); const ink = document.createElement('canvas'); ink.width = c.width; ink.height = c.height; paintBoardInk(ink, b); c.getContext('2d')!.drawImage(ink, 0, 0); }} dep={JSON.stringify([b.range, b.wk?.asleep, b.streak, b.sample])} label="This week on the whiteboard" />}
      <div class="bk2-tiles">
        <Tile label="Average sleep" value={wk ? hm(wk.asleep) : '–'} sub={`Goal ${goalTxt(b.goalMin)}`} fill={wk ? wk.asleep / goal : 0} color={wk && wk.asleep >= goal * 0.97 ? '#2f7a3e' : undefined} />
        <Tile label="Sleep score" value={wk ? String(Math.round(wk.score)) : '–'} sub={wk ? `${scoreWord(wk.score)} on average` : 'out of 100'} color={wk ? scoreCol(wk.score) : undefined} />
        <Tile label="Streak" value={`${b.streak}`} sub={b.streak === 1 ? 'night in a row' : 'nights in a row'} color="#b8343c" />
        <Tile label="Asleep around" value={wk ? clockOf(fromEvening(wk.bedtime), b.h12) : '–'} sub={b.bedSpread !== null ? `± ${Math.round(b.bedSpread)} min` : 'your usual time'} />
        <Tile label="Best night" value={b.best ? hm(b.best.report.asleep) : '–'} sub={b.best ? `${bestDay} · score ${b.best.report.score}` : 'still to come'} />
        <Tile label="Nights tracked" value={`${tracked} of 7`} sub="this week" />
      </div>
      <div class="bk2-take card">
        <span class="bk2-take-who"><Px name="star" size={22} />Pip’s take</span>
        <p>{takeOf(b)}</p>
      </div>
      <button class="btn soft bk2-wide-btn" onClick={p.onTrends}><Px name="stats" size={24} />See the trends</button>
    </div>
  );
}

// ------------------------------------------------------------------ trends

function slideLine(id: SlideId, b: Brief): string {
  const recent = b.days14.map((d) => d.night).filter((n): n is Night => !!n);
  if (!recent.length) return 'Your last two weeks show up here after your first night with Pip.';
  const goal = b.goalMin * 60_000;
  if (id === 'hours') {
    const met = recent.filter((n) => n.report.asleep >= goal * 0.97).length;
    return `Each bar is one night. Green bars met your ${goalTxt(b.goalMin)} goal: ${met} of the last ${recent.length}. Dots are nights Pip didn’t track.`;
  }
  if (id === 'score') {
    const first = recent[0].report.score, last = recent[recent.length - 1].report.score, d = last - first;
    return `The score weighs how long, how deeply and how calmly you slept. ${Math.abs(d) < 4 ? 'Holding steady over two weeks.' : d > 0 ? `Up ${d} points over two weeks.` : `Down ${-d} points: an early night or two will lift it.`}`;
  }
  if (id === 'stages') return 'Light sleep fills most of a night, which is normal. Deep sleep repairs the body; dreaming (REM) sorts memories and mood.';
  return b.bedSpread !== null && b.bedSpread > 45 ? 'Each bar runs from falling asleep to waking. They start at different heights: a steadier bedtime helps you fall asleep faster.' : 'Each bar runs from falling asleep to waking. Bars that line up mean a steady body clock.';
}

/** the slide's key numbers, as label / value / note rows */
function slideFacts(id: SlideId, b: Brief): [string, string, string?][] {
  const recent = b.days14.map((d) => d.night).filter((n): n is Night => !!n);
  if (!recent.length) return [];
  const goal = b.goalMin * 60_000, a = averages(recent), day = (n: Night) => new Date(n.report.wokeAt).toLocaleDateString([], { weekday: 'short', day: 'numeric' });
  const by = (f: (n: Night) => number) => recent.reduce((x, n) => (f(n) > f(x) ? n : x));
  if (id === 'hours') {
    const best = by((n) => n.report.asleep), worst = by((n) => -n.report.asleep);
    return [['Average', hm(a.asleep)], ['Longest', hm(best.report.asleep), day(best)], ['Shortest', hm(worst.report.asleep), day(worst)], ['Goal met', `${recent.filter((n) => n.report.asleep >= goal * 0.97).length} of ${recent.length}`, `goal ${goalTxt(b.goalMin)}`]];
  }
  if (id === 'score') {
    const best = by((n) => n.report.score), worst = by((n) => -n.report.score);
    return [['Average', String(Math.round(a.score)), scoreWord(a.score)], ['Best', String(best.report.score), day(best)], ['Lowest', String(worst.report.score), day(worst)], ['Asleep in bed', `${Math.round(a.efficiency * 100)}%`, 'efficiency']];
  }
  if (id === 'stages') return [['Deep', `${Math.round(a.deep * 100)}%`, 'repair'], ['Light', `${Math.round(a.light * 100)}%`], ['Dreaming', `${Math.round(a.rem * 100)}%`, 'REM'], ['Awake', `${Math.round(a.awake * 100)}%`, `${a.awakenings.toFixed(1)} wake-ups`]];
  return [['Asleep around', clockOf(fromEvening(a.bedtime), b.h12), b.bedSpread !== null ? `± ${Math.round(b.bedSpread)} min` : undefined], ['Up around', clockOf(fromDay(a.wake), b.h12)], ['Drifting off', `${Math.round(a.latency)} min`, 'on average'], ['Time in bed', hm(a.inBed)]];
}

function Trends(p: { b: Brief; slide: SlideId; flat: boolean; onPick: (id: SlideId) => void }) {
  const cur = SLIDES.find((x) => x.id === p.slide)!, i = SLIDES.indexOf(cur);
  const facts = slideFacts(p.slide, p.b);
  return (
    <div class="bk2-sec">
      <p class="bk2-kicker">On the screen · last 14 nights</p>
      <div class="bk2-slides" role="radiogroup" aria-label="Slides">
        {SLIDES.map((x, i) => <button class={'tag' + (x.id === p.slide ? ' on' : '')} role="radio" aria-checked={x.id === p.slide} onClick={() => p.onPick(x.id)}><small>{i + 1}</small>{x.name}</button>)}
      </div>
      {p.flat && <CanvasPic class="bk2-slide" w={1600} h={1000} paint={(c) => { paintSlide(c, p.slide, p.b); }} dep={p.slide + p.b.range + p.b.nights.length} label={cur.title} />}
      <h2 class="bk2-h t3d-ink">{cur.title}</h2>
      <p class="bk2-text">{slideLine(p.slide, p.b)}</p>
      {facts.length > 0 && <dl class="bk2-facts four">{facts.map(([k, v, n]) => <div><dt>{k}</dt><dd>{v}</dd>{n && <small>{n}</small>}</div>)}</dl>}
      <nav class="bk2-step">
        <button class="btn soft" onClick={() => p.onPick(SLIDES[(i + SLIDES.length - 1) % SLIDES.length].id)} aria-label="Previous slide"><Px name="arrow_left" size={22} />{SLIDES[(i + SLIDES.length - 1) % SLIDES.length].name}</button>
        <button class="btn soft" onClick={() => p.onPick(SLIDES[(i + 1) % SLIDES.length].id)} aria-label="Next slide">{SLIDES[(i + 1) % SLIDES.length].name}<Px name="arrow_right" size={22} /></button>
      </nav>
      {!p.flat && <p class="bk2-hint"><Px name="cursor_hand" size={22} />Or tap the screen in the room</p>}
    </div>
  );
}

// ------------------------------------------------------------------ nights

function StageStrip(p: { r: Night['report'] }) {
  const parts = (['deep', 'light', 'rem', 'awake'] as const).map((k) => [k, p.r[k]] as const), tot = parts.reduce((a, x) => a + x[1], 0) || 1;
  return <i class="bk2-strip" aria-hidden="true">{parts.map(([k, v]) => <i style={{ flexGrow: v / tot, background: STAGE_COL[k] }} />)}</i>;
}
function ScoreDial(p: { score: number; size?: number }) {
  const sz = p.size ?? 44, c = scoreCol(p.score), a = (p.score / 100) * 360;
  return <span class="bk2-dial" style={{ width: `${sz}px`, height: `${sz}px`, background: `conic-gradient(${c} ${a}deg, rgba(60,40,20,.14) 0)`, fontSize: `${Math.round(sz * 0.36)}px` }}><b style={{ color: c }}>{p.score}</b></span>;
}

function Nights(p: { onOpen: (id: string) => void }) {
  const s = save.value, h12 = s.settings.hour12;
  const list = reported(s).slice().reverse();
  if (!list.length) {
    return (
      <div class="bk2-sec bk2-empty">
        <Px name="nights" size={64} />
        <h2 class="bk2-h t3d-ink">No nights filed yet</h2>
        <p class="bk2-text">Each night you sleep with Pip lands here: how long, how deep, when you dropped off and woke, and how you felt in the morning.</p>
        <button class="btn pillow night bk2-wide-btn" onClick={() => { tap('ui_open', 0.5); panel.value = 'sleep'; }}><Px name="moon" size={24} />Plan tonight</button>
      </div>
    );
  }
  let month = '';
  return (
    <div class="bk2-sec">
      <p class="bk2-kicker">{list.length} night{list.length === 1 ? '' : 's'} on file</p>
      <ul class="bk2-nights">
        {list.map((n) => {
          const d = new Date(n.report.wokeAt), m = d.toLocaleDateString([], { month: 'long', year: 'numeric' });
          const head = m !== month ? (month = m) : null;
          return (
            <>
              {head && <li class="bk2-month">{head}</li>}
              <li>
                <button class="bk2-night" onClick={() => p.onOpen(n.id)} aria-label={`${d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}: ${hm(n.report.asleep)}, score ${n.report.score}`}>
                  <span class="bk2-date"><small>{d.toLocaleDateString([], { weekday: 'short' })}</small><b>{d.getDate()}</b></span>
                  <span class="bk2-nmid">
                    <b class="num">{hm(n.report.asleep)}{n.simulated && <em class="bk2-pretend">pretend</em>}</b>
                    <small>{clockOf(new Date(n.report.asleepAt), h12)} – {clockOf(new Date(n.report.wokeAt), h12)}{n.mood !== undefined && n.mood !== null && MOOD_NAMES[n.mood] ? ` · felt ${MOOD_NAMES[n.mood].toLowerCase()}` : ''}</small>
                    <StageStrip r={n.report} />
                  </span>
                  <ScoreDial score={n.report.score} />
                </button>
              </li>
            </>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ one night, on a paper card

function Hypno(p: { n: Night; h12: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const cv = ref.current, el = box.current;
    if (!cv || !el) return;
    const W = el.clientWidth, H = 128, k = Math.min(3, devicePixelRatio || 1);
    cv.width = Math.round(W * k); cv.height = Math.round(H * k); cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    const g = cv.getContext('2d')!;
    g.setTransform(k, 0, 0, k, 0, 0);
    const st = p.n.stages ?? [], r = p.n.report;
    const rows: Stage[] = ['awake', 'rem', 'light', 'deep'];
    const L0 = 66, R0 = W - 6, T0 = 8, B0 = H - 26, rowH = (B0 - T0) / 4;
    g.font = `700 12px 'Hoot Sans', system-ui, sans-serif`; g.textBaseline = 'middle'; g.textAlign = 'right';
    rows.forEach((s, i) => { g.fillStyle = 'rgba(90,60,30,0.08)'; if (i % 2 === 0) g.fillRect(L0, T0 + i * rowH, R0 - L0, rowH); g.fillStyle = '#6b5a48'; g.fillText(s === 'rem' ? 'Dreaming' : s[0].toUpperCase() + s.slice(1), L0 - 8, T0 + (i + 0.5) * rowH); });
    const t0 = p.n.start, t1 = p.n.end ?? r.wokeAt, xOf = (t: number) => L0 + ((t - t0) / Math.max(1, t1 - t0)) * (R0 - L0);
    if (st.length) {
      const ep = (t1 - t0) / st.length;
      let i = 0;
      while (i < st.length) {
        let j = i; while (j < st.length && st[j] === st[i]) j++;
        const row = rows.indexOf(st[i]), x0 = xOf(t0 + i * ep), x1 = xOf(t0 + j * ep);
        g.fillStyle = STAGE_COL[st[i]];
        g.beginPath(); g.roundRect(x0, T0 + row * rowH + 3, Math.max(1.5, x1 - x0), rowH - 6, 3); g.fill();
        i = j;
      }
    } else {
      g.fillStyle = '#8a7a66'; g.textAlign = 'center'; g.fillText('No stage detail for this night', (L0 + R0) / 2, (T0 + B0) / 2);
    }
    g.textAlign = 'center'; g.fillStyle = '#6b5a48';
    const hrs = Math.ceil((t1 - t0) / 3.6e6);
    for (let h = 0; h <= hrs; h += Math.max(1, Math.round(hrs / 5))) { const t = t0 + h * 3.6e6; if (t > t1) break; g.fillText(clockOf(new Date(t), p.h12).replace(':00', ''), xOf(t), H - 10); }
  }, [p.n.id]);
  return <div class="bk2-hypno" ref={box}><canvas ref={ref} role="img" aria-label="Sleep stages through the night" /></div>;
}

function NightCard(p: { n: Night; onClose: () => void }) {
  const n = p.n, r = n.report, h12 = save.value.settings.hour12;
  const saved = save.value.nights.find((x) => x.id === n.id), mood = saved?.mood;
  const stamp = (i: number) => { sfx('stamp', 0.5); edit((x) => { const ni = x.nights.find((y) => y.id === n.id); if (ni) ni.mood = i; }); try { progress('mood'); } catch { /* */ } };
  const d = new Date(r.wokeAt);
  return (
    <div class="bk2-modal" onClick={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
      <article class="bk2-card card" role="dialog" aria-label="Night report">
        <button class="bk2-x" aria-label="Close" onClick={p.onClose}><Px name="cross" size={22} /></button>
        <header class="bk2-card-head">
          <ScoreDial score={r.score} size={64} />
          <div>
            <small class="bk2-kicker">{d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}{n.simulated ? ' · pretend night' : ''}</small>
            <h2 class="bk2-h t3d-ink" style={{ color: scoreCol(r.score) }}>{scoreWord(r.score)} night</h2>
            <span class="bk2-muted">{hm(r.asleep)} asleep · {clockOf(new Date(r.asleepAt), h12)} to {clockOf(d, h12)}</span>
          </div>
        </header>
        <Hypno n={n} h12={h12} />
        <div class="bk2-legend">{(['deep', 'light', 'rem', 'awake'] as const).map((k) => <span><i style={{ background: STAGE_COL[k] }} />{k === 'rem' ? 'Dreaming' : k[0].toUpperCase() + k.slice(1)} <b>{Math.round(r[k] * 100)}%</b></span>)}</div>
        <dl class="bk2-facts">
          <div><dt>Time in bed</dt><dd>{hm(r.inBed)}</dd></div>
          <div><dt>Asleep in bed</dt><dd>{Math.round(r.efficiency * 100)}%</dd></div>
          <div><dt>Drifting off</dt><dd>{Math.round(r.latencyMin)} min</dd></div>
          <div><dt>Times awake</dt><dd>{r.awakenings}</dd></div>
          <div><dt>Snoring</dt><dd>{Math.round(r.snoreMin)} min</dd></div>
          <div><dt>Sleep talk</dt><dd>{r.talkCount}</dd></div>
        </dl>
        {r.notes.slice(0, 2).map((t) => <p class="bk2-note">{t}</p>)}
        <div class="bk2-moods" role="group" aria-label="How did you feel?">
          <small class="bk2-kicker">How did you feel that morning?</small>
          <div>{MOOD_NAMES.map((m, i) => <button class={'bk2-moodbtn' + (mood === i ? ' on' : '')} aria-pressed={mood === i} onClick={() => stamp(i)}><img src={moodArt(i).url} width={36} height={36} alt="" draggable={false} /><small>{m}</small></button>)}</div>
        </div>
        {(saved?.note ?? '').trim() && <p class="bk2-hand">{saved!.note}</p>}
      </article>
    </div>
  );
}

// ------------------------------------------------------------------ the diary

const KIND_ICON: Record<WinKind, string> = { sleep: 'moon', clock: 'alarm', calm: 'wind', streak: 'sparkle', habit: 'check', note: 'pen' };
const PROMPTS = ['Three good things today: ', 'Something that made me smile: ', 'I’m letting go of: ', 'Tomorrow I’ll: '];

function WinList(p: { items: Win[]; aim?: boolean }) {
  return (
    <ul class={'dy-list' + (p.aim ? ' aim' : '')}>
      {p.items.map((w, i) => (
        <li style={{ '--i': i } as Record<string, number>}>
          {p.aim ? <i class="dy-box" /> : <span class="dy-star"><Px name={KIND_ICON[w.kind]} size={24} /></span>}
          <span><b>{w.text}</b>{w.sub && <small>{w.sub}</small>}</span>
        </li>
      ))}
    </ul>
  );
}

function Diary(p: { wide: boolean; onNight: (id: string) => void }) {
  const s = save.value, today = dayKey();
  const days = useMemo(() => diaryDays(s, today), [s.nights, s.diary, today]);
  const [at, setAt] = useState(0);
  const [turn, setTurn] = useState<'' | 'fwd' | 'back'>('');
  const day = days[Math.min(at, days.length - 1)] ?? today;
  const wins = useMemo(() => winsFor(s, day, { today, ritual: ritualOf(day) }), [s, day, today]);
  const entry = s.diary?.[day];
  const [text, setText] = useState(entry?.note ?? '');
  const [state, setState] = useState<'' | 'typing' | 'saved'>('');
  const timer = useRef(0);
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setText(save.value.diary?.[day]?.note ?? ''); setState(''); }, [day]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const store = (v: string, d = day) => {
    const first = !(save.value.diary?.[d]?.note ?? '').trim() && v.trim();
    edit((x) => { x.diary ??= {}; if (v.trim()) x.diary[d] = { note: v.slice(0, 4000), at: Date.now() }; else delete x.diary[d]; });
    if (first) sfx('pencil', 0.4);
    setState('saved');
  };
  const onInput = (v: string) => {
    setText(v); setState('typing');
    clearTimeout(timer.current);
    const d = day;
    timer.current = window.setTimeout(() => store(v, d), 600);
  };
  const flip = (d: number) => {
    const to = Math.max(0, Math.min(days.length - 1, at + d));
    if (to === at) return;
    if (state === 'typing') { clearTimeout(timer.current); store(text); }
    sfx('page_turn', 0.45, 0.95 + Math.random() * 0.1);
    setTurn(d > 0 ? 'back' : 'fwd');
    setAt(to);
    window.setTimeout(() => setTurn(''), 420);
  };
  const date = dayDate(day), isToday = day === today;
  const n = wins.night;
  const pages = (
    <>
      <section class="dy-page left" style={{ background: paperCSS('book', { seed: 3 }).bg }}>
        <header class="dy-date">
          <b>{isToday ? 'Today' : date.toLocaleDateString([], { weekday: 'long' })}</b>
          <small>{isToday ? `${date.toLocaleDateString([], { weekday: 'long' })}, ${longDate(date)}` : longDate(date)}</small>
        </header>
        {n && <button class="dy-last" onClick={() => p.onNight(n.id)}><Px name="moon" size={22} /><span>Last night · <b>{hm(n.report.asleep)}</b> · score <b style={{ color: scoreCol(n.report.score) }}>{n.report.score}</b>{n.simulated ? ' (pretend)' : ''}</span><Px name="arrow_right" size={18} /></button>}
        <h3 class="dy-h">What you did great</h3>
        {wins.great.length ? <WinList items={wins.great} /> : <p class="dy-quiet">{isToday ? 'A fresh page. Every small thing you do for your sleep tonight counts, and it’ll show up here tomorrow.' : 'A quiet day in the diary.'}</p>}
        {wins.aims.length > 0 && <><h3 class="dy-h aim">For tonight</h3><WinList items={wins.aims} aim /></>}
      </section>
      <section class="dy-page right" style={{ background: paperCSS('book', { seed: 9 }).bg }}>
        <h3 class="dy-h">Notes</h3>
        {isToday && !text.trim() && <div class="dy-prompts">{PROMPTS.map((q) => <button class="tag" onClick={() => { onInput(q); requestAnimationFrame(() => { const el = ta.current; if (el) { el.focus(); el.setSelectionRange(q.length, q.length); } }); }}>{q.replace(/: $/, '…')}</button>)}</div>}
        <textarea ref={ta} class="dy-note" value={text} maxLength={4000} spellcheck placeholder={isToday ? 'How was today? What went well, what can wait for tomorrow?' : 'Nothing written this day. You can add a line now.'}
          onInput={(e) => onInput((e.currentTarget as HTMLTextAreaElement).value)} onBlur={() => { if (state === 'typing') { clearTimeout(timer.current); store(text); } }} aria-label={`Diary notes for ${longDate(date)}`} />
        <p class="dy-status">{state === 'typing' ? 'Writing…' : state === 'saved' ? <><Px name="check" size={18} />Saved in your diary</> : entry?.at ? `Written ${new Date(entry.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Saved on this device only'}</p>
      </section>
    </>
  );
  return (
    <div class="bk2-sec dy">
      <div class={'dy-book' + (turn ? ' turn-' + turn : '')} key={day}>{pages}</div>
      <nav class="dy-nav" aria-label="Diary pages">
        <button class="btn soft" disabled={at >= days.length - 1} onClick={() => flip(1)} aria-label="An earlier day"><Px name="arrow_left" size={22} />Earlier</button>
        <span>{at + 1} / {days.length}</span>
        <button class="btn soft" disabled={at <= 0} onClick={() => flip(-1)} aria-label="A later day">Later<Px name="arrow_right" size={22} /></button>
      </nav>
    </div>
  );
}

// ------------------------------------------------------------------ a canvas picture (the board and the slides without 3D)

function CanvasPic(p: { w: number; h: number; paint: (c: HTMLCanvasElement) => void; dep: string; class?: string; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; if (!c) return; c.width = p.w; c.height = p.h; p.paint(c); }, [p.dep]);
  return <canvas ref={ref} class={p.class} role="img" aria-label={p.label} style={{ aspectRatio: `${p.w} / ${p.h}` }} />;
}
