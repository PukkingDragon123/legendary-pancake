// The Clock button's screen: a wall with a big carved cuckoo clock in the middle (an owl pops out
// on the hour, or when you tap the little door), paper tags with this week's numbers hanging
// beside the pendulum, a clipboard with the weekly routine you can drag into shape, and a
// tear-off month calendar with a sticker for every night Pip went out. No buttons: you poke,
// drag, stamp and tear things.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { sound } from '../audio/sound.ts';
import { setRoutine } from '../game/night.ts';
import { copyNight, DAY_NAME, DAY_SHORT, nightDay, nightKey, planFor, setNight, sleepStats, stickerFor, toHHMM, toMin, WEEKNIGHTS } from '../game/routine.ts';
import { dayKey, save } from '../game/store.ts';
import type { SleepSession } from '../sleep/types.ts';
import { Px } from './icons.tsx';
import { fmtDur, fmtHM, tap, toast } from './kit.tsx';
import { NightReport } from './morning.tsx';
import { Art, dtone, hash, tone } from './px/sleepart.ts';
import { CH, CW, DOOR, DROP_MAX, FACE, FINISHES, paintCuckoo, PIVOT, WEIGHTS } from './px/cuckoo.ts';
import { stickerURL } from './px/sleepprops.ts';
import { ArtCanvas, injectSleepFrames, nowT, Paper, sparkleAt } from './sleepkit.tsx';
import { panel } from './state.ts';
import { uiBurstAt } from './chrome/uifx.ts';
import './clockscreen.css';

// ------------------------------------------------------------------ the cuckoo clock

const PREF_KEY = 'hoot-hollow:cuckoo';
interface CuckooPrefs { finish: string; mute: boolean; wound: [number, number] }
function loadPrefs(): CuckooPrefs {
  const d: CuckooPrefs = { finish: 'oak', mute: false, wound: [Date.now() - 9 * 3600_000, Date.now() - 15 * 3600_000] };
  try { return { ...d, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') }; } catch { return d; }
}
const savePrefs = (p: CuckooPrefs) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* */ } };
const dropOf = (wound: number) => Math.max(0, Math.min(DROP_MAX, ((Date.now() - wound) / 86400_000) * DROP_MAX));

function CuckooClock(p: { k: number }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const st = useRef({ cu: null as null | { t0: number; n: number }, lastSign: 0, lastHour: -1, wind: [0, 0] as [number, number], drag: -1, dragY: 0 });
  const finish = FINISHES.find((f) => f.id === prefs.finish) ?? FINISHES[0];
  const dev = (window as unknown as { __cuckooOut?: boolean }).__cuckooOut;

  const cuckoo = (n: number) => {
    const s = st.current;
    if (s.cu && nowT() - s.cu.t0 < 0.6 + s.cu.n * 0.9) return;
    s.cu = { t0: nowT(), n };
    sound.play('drawer', { volume: 0.25, rate: 1.6 });
    for (let i = 0; i < n; i++) setTimeout(() => sound.play('owl_hoot', { volume: 0.45, rate: 1.05 + (i % 2) * 0.06 }), 520 + i * 900);
  };
  const cuckooAt = (t: number) => {
    if (dev) return { v: 1, hoot: true };
    const c = st.current.cu;
    if (!c) return { v: 0, hoot: false };
    const e = t - c.t0, hootsEnd = 0.5 + c.n * 0.9;
    if (e < 0.5) return { v: e / 0.5, hoot: false };
    if (e < hootsEnd) return { v: 1, hoot: ((e - 0.5) % 0.9) < 0.38 };
    if (e < hootsEnd + 0.5) return { v: 1 - (e - hootsEnd) / 0.5, hoot: false };
    st.current.cu = null;
    return { v: 0, hoot: false };
  };

  const draw = (a: Art, t: number) => {
    const s = st.current;
    const swing = 0.2 * Math.sin((t / 1.6) * Math.PI * 2);
    const sign = Math.sign(swing);
    if (sign !== s.lastSign && s.lastSign !== 0 && !prefs.mute && !document.hidden) sound.play('clock_tick', { volume: 0.12, rate: sign > 0 ? 1 : 0.92, gap: 200 });
    s.lastSign = sign;
    const d = new Date();
    if (d.getMinutes() === 0 && d.getSeconds() < 3 && s.lastHour !== d.getHours()) { s.lastHour = d.getHours(); cuckoo(Math.min(12, d.getHours() % 12 || 12)); }
    const c = cuckooAt(t);
    const drop: [number, number] = [0, 1].map((i) => Math.max(0, dropOf(prefs.wound[i]) - s.wind[i])) as [number, number];
    paintCuckoo(a, { now: d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60, swing, cuckoo: c.v, hoot: c.hoot, drop, finish });
  };

  const art = (e: PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH }; };
  const weightAt = (x: number, y: number) => WEIGHTS.findIndex((w) => y > 130 && (Math.abs(x - w.x) < 7 || Math.abs(x - w.ring) < 5));
  const down = (e: PointerEvent) => {
    const { x, y } = art(e);
    const w = weightAt(x, y);
    if (w >= 0) { st.current.drag = w; st.current.dragY = e.clientY; (e.currentTarget as Element).setPointerCapture(e.pointerId); sound.play('clock_wind', { volume: 0.4 }); return; }
    if (y < 20 && Math.abs(x - 50) < 12) {
      // the carved owl on the roof: try another wood
      const i = (FINISHES.findIndex((f) => f.id === prefs.finish) + 1) % FINISHES.length;
      const np = { ...prefs, finish: FINISHES[i].id };
      setPrefs(np); savePrefs(np);
      sound.play('wood_knock', { volume: 0.5 });
      uiBurstAt(e.currentTarget as Element, 'puff', 8);
      toast(`${FINISHES[i].name} finish`, undefined, 1600);
      return;
    }
    if ((x > DOOR.x - 4 && x < DOOR.x + DOOR.w + 4 && y > DOOR.y - 4 && y < DOOR.y + DOOR.h + 6) || Math.hypot(x - FACE.x, y - FACE.y) < FACE.r) { tap('ui_tap', 0.3); cuckoo(1 + Math.floor(Math.random() * 3)); return; }
    if (y > PIVOT.y && Math.abs(x - PIVOT.x) < 12) {
      const np = { ...prefs, mute: !prefs.mute };
      setPrefs(np); savePrefs(np);
      sound.play('clock_tick', { volume: 0.4 });
      toast(np.mute ? 'Shh: the clock ticks silently now' : 'Tick, tock', undefined, 1600);
    }
  };
  const move = (e: PointerEvent) => {
    const s = st.current;
    if (s.drag < 0) return;
    const dy = (e.clientY - s.dragY) / p.k;
    s.wind[s.drag] = Math.max(0, dy);
    sound.play('clock_wind', { volume: 0.18, gap: 140 });
  };
  const up = () => {
    const s = st.current;
    if (s.drag < 0) return;
    const i = s.drag;
    s.drag = -1;
    const cur = Math.max(0, dropOf(prefs.wound[i]) - s.wind[i]);
    // pulling far enough (or a tap) winds it all the way
    const full = s.wind[i] < 2 || cur < 6;
    const left = full ? 0 : cur;
    const wound = [...prefs.wound] as [number, number];
    wound[i] = Date.now() - (left / DROP_MAX) * 86400_000;
    s.wind[i] = 0;
    const np = { ...prefs, wound };
    setPrefs(np); savePrefs(np);
    if (full) sound.play('clock_wind', { volume: 0.5, rate: 1.2 });
  };
  return (
    <ArtCanvas w={CW} h={CH} k={p.k} fps={12} deps={[prefs.finish, prefs.mute, prefs.wound.join()]} class="cuckoo" label="A carved cuckoo clock. Tap the door for the owl, pull a weight's chain to wind it, tap the roof owl to change the wood."
      draw={draw} onPointerDown={down} onPointerMove={move} onPointerUp={up} />
  );
}

// ------------------------------------------------------------------ paper tags with the numbers

function Tag(p: { label: string; value: string; sub?: string; tilt: number; delay: number; kind?: string }) {
  return (
    <div class="ctag" style={{ '--tilt': `${p.tilt}deg`, animationDelay: `${p.delay}s` } as JSX.CSSProperties}>
      <i class="string" />
      <Paper kind={p.kind ?? 'kraft'} opts={{ seed: Math.round(p.tilt * 10) + 50 }} class="ctag-paper">
        <span class="hole" />
        <small>{p.label}</small>
        <b>{p.value}</b>
        {p.sub && <em>{p.sub}</em>}
      </Paper>
    </div>
  );
}

// ------------------------------------------------------------------ the routine clipboard

const AXIS0 = 19 * 60, AXIS_SPAN = 18 * 60; // 7 PM .. 1 PM
const pos = (m: number) => (((m - AXIS0) % 1440) + 1440) % 1440 / AXIS_SPAN;
const fromPos = (f: number) => Math.round((AXIS0 + f * AXIS_SPAN) / 15) * 15;
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function RoutineBoard() {
  const s = save.value, h12 = s.settings.hour12;
  const r = s.routine;
  const today = nightDay(Date.now());
  const [sel, setSel] = useState<number>(today);
  const [stamp, setStamp] = useState<string | null>(null);
  const chart = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: 'bed' | 'wake' | 'move'; day: number; y0: number; bed0: number; wake0: number } | null>(null);
  const plan = planFor(r, sel);
  const H = 300;

  const minuteAt = (clientY: number) => { const b = chart.current!.getBoundingClientRect(); return fromPos(Math.max(0, Math.min(1, (clientY - b.top) / b.height))); };
  const startDrag = (e: PointerEvent, day: number, mode: 'bed' | 'wake' | 'move') => {
    e.stopPropagation();
    const p0 = planFor(save.value.routine, day);
    drag.current = { mode, day, y0: e.clientY, bed0: toMin(p0.bed), wake0: toMin(p0.wake) };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (sel !== day) setSel(day);
    sound.play('pencil', { volume: 0.3 });
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const cur = planFor(save.value.routine, d.day);
    let bed = toMin(cur.bed), wake = toMin(cur.wake);
    if (d.mode === 'move') {
      const b = chart.current!.getBoundingClientRect();
      const dm = Math.round((((e.clientY - d.y0) / b.height) * AXIS_SPAN) / 15) * 15;
      const lo = -pos(d.bed0) * AXIS_SPAN, hi = (1 - pos(d.wake0)) * AXIS_SPAN;
      const k = Math.max(lo, Math.min(hi, dm));
      bed = d.bed0 + k; wake = d.wake0 + k;
    } else {
      const m = minuteAt(e.clientY);
      const pm = pos(m);
      if (d.mode === 'bed') { if (pm <= pos(wake) - 180 / AXIS_SPAN) bed = m; }
      else if (pm >= pos(bed) + 180 / AXIS_SPAN) wake = m;
    }
    const nb = toHHMM(bed), nw = toHHMM(wake);
    if (nb !== cur.bed || nw !== cur.wake) { setRoutine(setNight(save.value.routine, d.day, { bed: nb, wake: nw })); sound.play('clock_tick', { volume: 0.25, gap: 40 }); }
  };
  const onUp = () => { if (drag.current) { drag.current = null; sound.play('ui_drop', { volume: 0.3 }); } };
  const doStamp = (label: string, days: number[], el: Element | null) => {
    setRoutine(copyNight(save.value.routine, sel, days));
    sound.play('stamp', { volume: 0.6 });
    setStamp(label);
    sparkleAt(el, 6);
    setTimeout(() => setStamp(null), 1800);
  };
  const hours = [20, 22, 0, 2, 4, 6, 8, 10, 12];

  return (
    <div class="clipboard">
      <div class="cb-board" />
      <div class="cb-clip"><i /><b /></div>
      <Paper kind="graph" opts={{ edge: 0.15 }} class="cb-paper">
        <h3 class="cb-title">My sleep week</h3>
        <div class="cb-chart-wrap" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div class="cb-axis" style={{ height: `${H}px` }}>{hours.map((h) => <span style={{ top: `${pos(h * 60) * 100}%` }}>{h12 ? `${h % 12 || 12}${h < 12 ? 'a' : 'p'}` : `${h}h`}</span>)}</div>
          <div class="cb-cols">
            <div class="cb-heads">{ORDER.map((d) => <button class={'cb-day' + (d === sel ? ' sel' : '') + (d === today ? ' today' : '')} onClick={() => { tap('pencil', 0.3); setSel(d); }}>{DAY_SHORT[d].slice(0, 2)}</button>)}</div>
            <div class="cb-chart" ref={chart} style={{ height: `${H}px` }}>
              {hours.map((h) => <i class="cb-line" style={{ top: `${pos(h * 60) * 100}%` }} />)}
              <i class="cb-mid" style={{ top: `${pos(0) * 100}%` }} />
              {ORDER.map((d, i) => {
                const pl = planFor(r, d), y0 = pos(toMin(pl.bed)), y1 = pos(toMin(pl.wake));
                const on = d === sel;
                return (
                  <div class={'cb-col' + (on ? ' sel' : '')} style={{ left: `${(i / 7) * 100}%` }} onPointerDown={() => { if (!on) { tap('pencil', 0.3); setSel(d); } }}>
                    <div class={'cb-bar' + (pl.on ? '' : ' off')} style={{ top: `${y0 * 100}%`, height: `${(y1 - y0) * 100}%` }} onPointerDown={(e) => startDrag(e, d, 'move')}>
                      {!pl.on && <span class="cb-off">free</span>}
                      {on && <>
                        <button class="cb-knob bed" aria-label={`${DAY_NAME[d]} bedtime ${pl.bed}`} onPointerDown={(e) => startDrag(e, d, 'bed')}><Px name="moon" size={30} /></button>
                        <button class="cb-knob wake" aria-label={`Wake ${pl.wake}`} onPointerDown={(e) => startDrag(e, d, 'wake')}><Px name="sun" size={30} /></button>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div class="cb-detail">
          <div class="cb-detail-h"><b>{DAY_NAME[sel]} night</b><span>{fmtDur(plan.min * 60_000)}</span></div>
          <div class="cb-times"><span><Px name="moon" size={30} />Bed <b>{fmtHM(plan.bed, h12)}</b></span><span><Px name="sun" size={30} />Wake <b>{fmtHM(plan.wake, h12)}</b> <small>{DAY_SHORT[(sel + 1) % 7]}</small></span></div>
          <button class="cb-check" onClick={() => { tap('pencil', 0.5); setRoutine(setNight(r, sel, { on: !plan.on })); }}>
            <span class={'box' + (plan.on ? ' on' : '')}>{plan.on && <svg viewBox="0 0 14 14" width="26" height="26" shape-rendering="crispEdges"><path d="M1 7 L5 11 L13 2" fill="none" stroke="#2c2a5a" stroke-width="2.4" /></svg>}</span>
            <span>Alarm and bedtime reminder{plan.on ? '' : ' (free night: sleep in)'}</span>
          </button>
          <div class="cb-stamps">
            <button class="rstamp" onClick={(e) => doStamp('COPIED', WEEKNIGHTS, e.currentTarget)}><Px name="calendar" size={30} /><span>Copy to weeknights<small>Sun–Thu nights</small></span></button>
            <button class="rstamp alt" onClick={(e) => doStamp('EVERY NIGHT', [0, 1, 2, 3, 4, 5, 6], e.currentTarget)}><Px name="star" size={30} /><span>Copy to every night</span></button>
          </div>
          {stamp && <span class="ink-stamp" key={stamp}>{stamp}</span>}
        </div>
        <p class="cb-hint">Drag the moon and sun to change a night. Snaps to 15 minutes.</p>
      </Paper>
    </div>
  );
}

// ------------------------------------------------------------------ the tear-off month calendar

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function MonthCalendar(p: { onOpen: (n: SleepSession) => void }) {
  const nights = save.value.nights;
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [anim, setAnim] = useState<'' | 'tear' | 'back'>('');
  const [peek, setPeek] = useState<string | null>(null);
  const byDay = useMemo(() => {
    const m = new Map<string, SleepSession>();
    for (const n of nights) { if (!n.report) continue; const k = nightKey(n), o = m.get(k); if (!o || (o.report!.score < n.report.score)) m.set(k, n); }
    return m;
  }, [nights]);
  const first = new Date(ym.y, ym.m, 1), days = new Date(ym.y, ym.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const todayK = dayKey();
  const flip = (dir: 1 | -1) => {
    tap('paper_flip', 0.6);
    setPeek(null);
    setAnim(dir > 0 ? 'tear' : 'back');
    setTimeout(() => { setYm(({ y, m }) => { const d = new Date(y, m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() }; }); }, dir > 0 ? 260 : 0);
    setTimeout(() => setAnim(''), 560);
  };
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const count = cells.filter((d) => d && byDay.has(`${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)).length;
  const peekN = peek ? byDay.get(peek) : null;
  return (
    <div class="tearcal">
      <i class="tc-nail" /><i class="tc-string l" /><i class="tc-string r" />
      <div class="tc-back" /><div class="tc-back b2" />
      <Paper kind="cream" opts={{ seed: ym.m + 3 }} class={'tc-page ' + anim}>
        <div class="tc-band"><span class="tc-rings"><i /><i /><i /><i /></span><b>{MONTHS[ym.m]}</b><small>{ym.y}</small></div>
        <div class="tc-grid">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span class={'tc-h' + (i >= 5 ? ' we' : '')}>{d}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span class="tc-d empty" />;
            const k = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const n = byDay.get(k);
            const isToday = k === todayK;
            return (
              <button class={'tc-d' + (n ? ' has' : '') + (isToday ? ' today' : '') + (i % 7 >= 5 ? ' we' : '')} disabled={!n} onClick={() => { if (!n) return; tap('ui_tap', 0.4); setPeek(peek === k ? null : k); }} aria-label={n ? `${k}: ${fmtDur(n.report!.asleep)}, score ${n.report!.score}` : k}>
                <span class="num">{d}</span>
                {n && <img class="stk" src={stickerURL(stickerFor(n.report!.score), 3)} style={{ transform: `rotate(${Math.round((hash(d, ym.m, 1) - 0.5) * 24)}deg)` }} alt="" />}
                {isToday && <svg class="circle" viewBox="0 0 40 40" preserveAspectRatio="none"><path d="M20 3 C33 2 38 11 37 21 C36 32 28 37 18 37 C8 37 3 30 3 20 C3 11 10 4 22 5" fill="none" stroke="#3a3f6a" stroke-width="2" stroke-linecap="round" /></svg>}
              </button>
            );
          })}
        </div>
        <div class="tc-foot">
          <button class="tc-corner prev" onClick={() => flip(-1)} aria-label="Previous month"><span>‹ {MONTHS[(ym.m + 11) % 12].slice(0, 3)}</span></button>
          <span class="tc-count">{count ? `${count} night${count === 1 ? '' : 's'} with Pip` : 'No nights yet'}</span>
          <button class="tc-corner next" onClick={() => flip(1)} aria-label="Next month: tear off this page"><span>{MONTHS[(ym.m + 1) % 12].slice(0, 3)} ›</span></button>
        </div>
        <div class="tc-legend">{(['gold', 'moon', 'cloud', 'rain'] as const).map((k) => <span><img src={stickerURL(k, 2)} alt="" />{{ gold: '85+', moon: '70+', cloud: '50+', rain: 'restless' }[k]}</span>)}</div>
        {peekN && (
          <Paper kind="sticky" opts={{ sticky: 1 }} class="tc-peek">
            <b>{new Date(peekN.report!.wokeAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</b>
            <span>{fmtDur(peekN.report!.asleep)} asleep · score {peekN.report!.score}</span>
            <button onClick={() => { tap('paper_flip', 0.5); p.onOpen(peekN); }}>Read the report ›</button>
          </Paper>
        )}
      </Paper>
    </div>
  );
}

// ------------------------------------------------------------------ the wall

let wallU = '';
function wallpaper() {
  if (wallU) return wallU;
  const a = new Art(20, 20);
  a.rect(0, 0, 20, 20, (x, y) => dtone('moss', 2.4 + (hash(x, y, 9) - 0.5) * 0.35, x, y));
  const fl = (cx: number, cy: number) => { a.px(cx, cy, tone('sand', 4)); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) a.px(cx + dx, cy + dy, tone('moss', 4)); };
  fl(5, 5); fl(15, 15);
  a.px(15, 5, tone('moss', 3)); a.px(5, 15, tone('moss', 3));
  wallU = a.url(3);
  return wallU;
}

export function ClockScreen() {
  injectSleepFrames();
  const s = save.value, h12 = s.settings.hour12;
  const [report, setReport] = useState<SleepSession | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [vw, setVw] = useState(innerWidth);
  useEffect(() => { const f = () => setVw(innerWidth); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  // the goal is the routine's average night
  const goal = useMemo(() => Math.round([0, 1, 2, 3, 4, 5, 6].reduce((a, d) => a + planFor(s.routine, d).min, 0) / 7 / 15) * 15, [s.routine]);
  const st = useMemo(() => sleepStats(s.nights, goal), [s.nights, goal]);
  const close = () => { tap('ui_close', 0.5); setLeaving(true); setTimeout(() => { if (panel.value === 'clock') panel.value = null; }, 260); };
  const k = 3;
  const bedTxt = st.avgBed === null ? '–' : fmtHM(toHHMM(st.avgBed), h12);
  const wide = vw >= 900;
  return (
    <div class={'cs' + (leaving ? ' leaving' : '')} role="dialog" aria-label="Clock">
      <button class="sf-back" aria-label="Back to the hollow" onClick={close}><Px name="arrow_left" size={30} /></button>
      <div class="cs-scroll" style={{ backgroundImage: `url(${wallpaper()})` }}>
        <div class="cs-sign hh-wood-sm"><span>Clock</span></div>
        <div class={'cs-layout' + (wide ? ' wide' : '')}>
          <div class="cs-center">
            <div class="cs-clock" style={{ width: `${CW * k}px` }}>
              <CuckooClock k={k} />
              <div class="cs-tags left">
                <Tag label="This week" value={fmtDur(st.weekTotal)} sub={`${st.weekNights} night${st.weekNights === 1 ? '' : 's'}`} tilt={-4} delay={0} />
                <Tag label="Per night" value={st.avgNight ? fmtDur(st.avgNight) : '–'} tilt={3} delay={0.6} />
                <Tag label="Asleep by" value={bedTxt} sub="on average" tilt={-2} delay={1.1} kind="cream" />
              </div>
              <div class="cs-tags right">
                <Tag label="Streak" value={`${Math.max(s.streak, st.run)} nights`} sub={`best ${Math.max(s.bestStreak, st.bestRun)}`} tilt={4} delay={0.3} kind="cream" />
                <Tag label="Goal hit" value={st.goalRate === null ? '–' : `${Math.round(st.goalRate * 100)}%`} sub={`goal ${fmtDur(goal * 60000)}`} tilt={-3} delay={0.9} />
              </div>
            </div>
          </div>
          <div class="cs-side left"><RoutineBoard /></div>
          <div class="cs-side right"><MonthCalendar onOpen={(n) => setReport(n)} /></div>
        </div>
        <div class="cs-floor" />
      </div>
      {report && report.report && <div class="cs-modal"><NightReport s={report} onClose={() => setReport(null)} /></div>}
    </div>
  );
}
