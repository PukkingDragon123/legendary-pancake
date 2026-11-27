// The Clock button's screen. [clock6] A 3D scene (src/world/stages/cuckoo.ts): a super big carved Black Forest
// cuckoo clock on a wall in Pip's house, with your owl living behind its door (it pops out on the hour, when you tap
// the door, to say hello and to present your numbers). The numbers are things in the room: carved tags hanging from
// the clock (this week, per night, streak, asleep by), a row of little houses on the shelf (one per night, as tall
// as you slept), the routine on a clipboard and a wall calendar. Tapping a thing flies the camera to it and pins a
// paper card with its detail; the clipboard and the calendar slide in their 2D editors (below: the routine board
// you drag into shape and the tear-off month calendar). The DOM adds only a Back control, a one-line title and the
// cards. Without WebGL the painted wall (ClockWall2D) stands in.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { sound } from '../audio/sound.ts';
import { setRoutine, syncReminders } from '../game/night.ts';
import { copyNight, DAY_NAME, DAY_SHORT, nightDay, nightKey, planFor, setNight, sleepStats, stickerFor, toHHMM, toMin, WEEKNIGHTS } from '../game/routine.ts';
import { dayKey, edit, save } from '../game/store.ts';
import type { SleepSession } from '../sleep/types.ts';
import { Px } from './icons.tsx';
import { fmtDur, fmtHM, Tags, tap, toast, Toggle, useTick } from './kit.tsx';
import { CuckooStage, fitSet, type CuckooPrefs as Prefs3, type SetHand } from '../world/stages/cuckoo.ts';
import { ALARMS, SoundTiles } from './sleep.tsx';
import { FINISHES as FINISHES3 } from '../world/stages/cuckookit.ts';
import { NightReport } from './morning.tsx';
import { Art, dtone, hash, tone } from './px/sleepart.ts';
import { CH, CK, CW, DOOR, DROP_MAX, FACE, FINISHES, paintCuckoo, PIVOT, WEIGHTS } from './px/cuckoo.ts';
import { stickerURL } from './px/sleepprops.ts';
import { ArtCanvas, injectSleepFrames, nowT, Paper, sparkleAt } from './sleepkit.tsx';
import { bubble, panel, sceneRef } from './state.ts';
import { uiBurstAt } from './chrome/uifx.ts';
import { boardCSS, clipboardClip, wallpaperTile, type BoardOpts } from './chrome/objects.ts';
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
    <ArtCanvas w={CW * CK} h={CH * CK} k={p.k / CK} fps={12} deps={[prefs.finish, prefs.mute, prefs.wound.join()]} class="cuckoo" label="A carved cuckoo clock. Tap the door for the songbird, pull a weight's chain to wind it, tap the roof moon to change the wood."
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
  const board = useBoardBg({ wood: 'oak', seed: 13, bevel: 3, screws: [] });

  return (
    <div class="clipboard">
      <div class="cb-board" ref={board} />
      <img class="cb-clip" src={clipboardClip(120)} alt="" draggable={false} />
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
            <span class={'box' + (plan.on ? ' on' : '')}>{plan.on && <svg viewBox="0 0 14 14" width="26" height="26" shape-rendering="crispEdges"><path d="M1 7 L5 11 L13 2" fill="none" stroke="#2b3142" stroke-width="2.4" /></svg>}</span>
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
                {isToday && <i class="circle" aria-hidden="true" />}
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

// [ui4] the wall: printed emerald damask wallpaper (a relief-painted tile, 1 art px per CSS px)
const wallpaper = () => wallpaperTile('emerald', 72);

/** [ui4] paint a varnished board to an element's size (the clipboard's hardboard) */
function useBoardBg(o: BoardOpts) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let w0 = 0, h0 = 0;
    const apply = () => {
      const w = el.offsetWidth, h = el.offsetHeight;
      if (!w || !h || (Math.abs(w - w0) < 8 && Math.abs(h - h0) < 8)) return;
      w0 = w; h0 = h;
      el.style.backgroundImage = `url("${boardCSS(w - 10, h - 10, o)}")`; // [ui7] the art carries a 5 px shadow margin
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return ref;
}

function ClockWall2D() {
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
      <div class="cs-scroll" style={{ backgroundImage: `url(${wallpaper()})`, backgroundSize: '72px 72px' }}>
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

// ================================================================== the 3D clock (the Clock panel)
//
// [clock15] The big cuckoo clock hangs in Barnaby's workshop (world/stages/cuckoo.ts + clockshop.ts) and the dial
// sets the night: drag the moon-tipped hand for bedtime and the sun-tipped hand for waking (a floating brass plate
// reads the time as it ticks round in 5-minute steps; Barnaby looks up and nods when you let go). Beside the scene (a
// carved walnut cabinet on a wide screen, a sheet on a phone) the ledger: the night being set and the week's nights
// to choose from, then the alarm, the bedtime reminder, the clock itself (its cuckoo, ticking and wood) and the week's
// numbers with the month calendar.

const PREF3 = 'hoot-hollow:cuckoo3d';
const HINT_KEY = 'hoot-hollow:clockhint';
function loadPrefs3(): Prefs3 {
  const d: Prefs3 = { finish: 'walnut', mute: false, chime: true, wound: [Date.now() - 7 * 3600_000, Date.now() - 13 * 3600_000] };
  try { const p = { ...d, ...JSON.parse(localStorage.getItem(PREF3) ?? '{}') }; return p.wound?.length === 2 ? p : d; } catch { return d; }
}
const savePrefs3 = (p: Prefs3) => { try { localStorage.setItem(PREF3, JSON.stringify(p)); } catch { /* storage blocked */ } };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isWide = () => innerWidth >= innerHeight * 1.05 && innerWidth >= 640;
const wrapMin = (m: number) => ((m % 1440) + 1440) % 1440;
const hhmm = (m: number) => toHHMM(wrapMin(m));
const ORDER3 = [1, 2, 3, 4, 5, 6, 0];
const FINISH_HUE: Record<string, string> = { walnut: '#6a3b1f', oak: '#b67233', cherry: '#9c4425', linden: '#caa36e' };

type CkTab = 'alarm' | 'bedtime' | 'clock' | 'week';
const TABS: { id: CkTab; label: string; icon: string }[] = [
  { id: 'alarm', label: 'Alarm', icon: 'alarm' }, { id: 'bedtime', label: 'Bedtime', icon: 'candle' },
  { id: 'clock', label: 'Clock', icon: 'clock' }, { id: 'week', label: 'Week', icon: 'stats' },
];
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const CHAT = [
  'Oiled her works this morning. Keeps time like the river.',
  'Pine cones for weights: an old Black Forest trick.',
  'Tap the little door and your owl pops out to say hello.',
  'A steady bedtime is the best tune-up there is.',
  'Pull a pine cone down to wind her up.',
];

/** a time as big digits with a small AM/PM */
function BigTime(p: { min: number; h12: boolean }) {
  const t = fmtHM(hhmm(p.min), p.h12);
  const [a, b] = t.split(/\s+/);
  return <span class="ck-big">{a}{b ? <i class="ap">{b}</i> : null}</span>;
}

function Clock3D(p: { onFail: () => void }) {
  const sc = sceneRef.current!;
  const s = save.value, sp = s.sleep, h12 = s.settings.hour12;
  const stage = useRef<CuckooStage | null>(null);
  const tonight = nightDay(Date.now());
  const [sel, setSel] = useState(tonight);
  const [tab, setTab] = useState<CkTab>('alarm');
  const [draft, setDraft] = useState<{ hand: SetHand; bed: number; wake: number } | null>(null);
  const [report, setReport] = useState<SleepSession | null>(null);
  const [cal, setCal] = useState(false);
  const [wide, setWide] = useState(isWide());
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<string>('home');
  const [hint, setHint] = useState(() => { try { return !localStorage.getItem(HINT_KEY); } catch { return true; } });
  const [chat, setChat] = useState<{ text: string; id: number } | null>(null);
  const [prefs, setPrefs] = useState<Prefs3>(loadPrefs3);
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  useTick(30_000);

  // ---- the night being set
  const plan = planFor(s.routine, sel);
  const bedM = draft ? draft.bed : toMin(plan.bed), wakeM = draft ? draft.wake : toMin(plan.wake);
  const durM = wrapMin(wakeM - bedM);
  const isTonight = sel === tonight;

  // ---- the numbers (the Week tab)
  const goal = useMemo(() => Math.round([0, 1, 2, 3, 4, 5, 6].reduce((a, d) => a + planFor(s.routine, d).min, 0) / 7 / 15) * 15, [s.routine]);
  const st = useMemo(() => sleepStats(s.nights, goal), [s.nights, goal]);
  const byDay = useMemo(() => {
    const m = new Map<string, SleepSession>();
    for (const n of s.nights) { if (!n.report || n.simulated) continue; const k = nightKey(n), o = m.get(k); if (!o || o.report!.score < n.report.score) m.set(k, n); }
    return m;
  }, [s.nights]);
  const streak = Math.max(s.streak, st.run);
  const week = useMemo(() => {
    const out: { key: string; day: string; hours: number | null; goal: boolean; today: boolean; n?: SleepSession }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
      const k = ymd(d), n = byDay.get(k), ms = n?.report?.asleep ?? null;
      out.push({ key: k, day: DAY_SHORT[d.getDay()], hours: ms === null ? null : ms / 3600_000, goal: ms !== null && ms >= goal * 60_000 * 0.92, today: i === 0, n });
    }
    return out;
  }, [byDay, goal]);

  // Pip's speech belongs to the world view: none over the clock
  useEffect(() => { bubble.value = null; return bubble.subscribe((b) => { if (b) bubble.value = null; }); }, []);

  // ---- live handlers through refs (the stage calls them from its own loop)
  const selRef = useRef(sel); selRef.current = sel;
  const draftRef = useRef(draft); draftRef.current = draft;
  const say = (text: string) => setChat({ text, id: Date.now() });
  const commit = (day: number, hand: SetHand, min: number) => {
    setRoutine(setNight(save.value.routine, day, hand === 'bed' ? { bed: hhmm(min) } : { wake: hhmm(min) }));
  };
  const onSet = (hand: SetHand, min: number, phase: 'start' | 'move' | 'end') => {
    const pl = planFor(save.value.routine, selRef.current);
    const cur = draftRef.current ?? { hand, bed: toMin(pl.bed), wake: toMin(pl.wake) };
    const next = { ...cur, hand, [hand]: min };
    if (phase === 'start') {
      setHint(false);
      try { localStorage.setItem(HINT_KEY, '1'); } catch { /* storage blocked */ }
      setDraft(next);
      return;
    }
    if (phase === 'move') { setDraft(next); return; }
    commit(selRef.current, hand, min);
    setDraft(null);
    const d = wrapMin(next.wake - next.bed);
    say(d < 6 * 60 ? 'A short night, that. Your owl will be yawning by noon!' : d > 9.5 * 60 ? 'A long, cosy night. Splendid!' : `${fmtDur(d * 60_000)} of sleep. Lovely, I've set her.`);
  };
  const onPick = (id: string) => {
    const S = stage.current;
    if (!S) return;
    if (id === 'door' || id === 'owl') { if (id === 'owl') S.owl.poke(); S.cuckoo(1 + Math.floor(Math.random() * 3)); return; }
    if (id === 'dial') { tap('clock_tick', 0.4); S.focus('dial'); setZoom('dial'); return; }
    if (id === 'barnaby') { tap('wood_knock', 0.3); S.shop?.look(S.camera.position, 3); S.shop?.beaver.play('wave'); say(pick(CHAT)); return; }
    if (id === 'pendulum') { setTick(S.prefs.mute); return; }
    if (id.startsWith('weight:')) { S.windUp(+id.slice(7)); savePrefs3(S.prefs); setPrefs({ ...S.prefs }); toast('Wound up for the day', undefined, 1500); }
  };
  const setRef = useRef(onSet); setRef.current = onSet;
  const pickRef = useRef(onPick); pickRef.current = onPick;

  // ---- the stage: built on open, shown at once (the panel's transition covers the cut)
  useEffect(() => {
    let st3: CuckooStage | null = null;
    try {
      st3 = new CuckooStage(save.value.look, loadPrefs3());
      st3.attach(sc.renderer, { night: () => sc.sky.night });
      sc.setStage(st3);
    } catch (e) { console.warn('clock stage failed', e); p.onFail(); return; }
    stage.current = st3;
    st3.onPick = (id) => pickRef.current(id);
    st3.onSet = (h, m, ph) => setRef.current(h, m, ph);
    const pl = planFor(save.value.routine, selRef.current);
    st3.setPlan(toMin(pl.bed), toMin(pl.wake), pl.on, true);
    st3.intro();
    const hello = setTimeout(() => { if (isWide()) say('Evening! Turn the moon and the sun on the dial to set your night.'); }, 3400);
    const onResize = () => setWide(isWide());
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') backRef.current(); };
    addEventListener('resize', onResize);
    addEventListener('keydown', onKey);
    // the floating plates follow their things in the scene
    let raf = 0;
    const place = (el: HTMLElement | null, id: string, dx: number, dy: number) => {
      if (!el || !st3) return;
      const a = st3.anchor(id), w = el.offsetWidth, h = el.offsetHeight;
      const x = Math.max(8, Math.min(innerWidth - w - 8, a.x + dx - w / 2)), y = Math.max(8, Math.min(innerHeight - h - 8, a.y + dy - h));
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      el.style.visibility = a.on ? 'visible' : 'hidden';
    };
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const S = st3!;
      const d = draftRef.current, c = S.anchor('dial');
      // the reading sits just outside the dial, beyond the tip of the hand being turned
      const el = readRef.current;
      if (d && el) {
        const t = S.anchor('set:' + d.hand), dx = t.x - c.x, dy = t.y - c.y, len = Math.hypot(dx, dy) || 1;
        const w = el.offsetWidth, h = el.offsetHeight, k = Math.abs(dx / len) * w / 2 + Math.abs(dy / len) * h / 2 + 18;
        const x = Math.max(8, Math.min(innerWidth - w - 8, t.x + (dx / len) * k - w / 2)), y = Math.max(8, Math.min(innerHeight - h - 8, t.y + (dy / len) * k - h / 2));
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        el.style.visibility = 'visible';
      }
      if (hintRef.current) {
        // beside the dial on a wide screen, under it on a phone
        const b = S.anchor('set:bed'), r = Math.hypot(b.x - c.x, b.y - c.y), hw = hintRef.current.offsetWidth;
        if (isWide()) place(hintRef.current, 'dial', -(r + hw / 2 + 34), 18);
        else place(hintRef.current, 'dial', 0, r + 64);
      }
      if (chatRef.current) place(chatRef.current, 'barnaby', 30, -46);
    };
    raf = requestAnimationFrame(loop);
    if (import.meta.env.DEV) (window as unknown as { hhClock: unknown }).hhClock = { stage: st3, pick: (id: string) => pickRef.current(id), back: () => backRef.current(), set: (h: SetHand, m: number) => { setRef.current(h, m, 'start'); setRef.current(h, m, 'move'); }, open: (v: boolean) => setOpen(v), tab: (t: CkTab) => setTab(t), home: () => st3?.focus('home', true) };
    return () => {
      clearTimeout(hello);
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize); removeEventListener('keydown', onKey);
      if (st3) savePrefs3(st3.prefs);
      if (sc.stage === st3) sc.setStage(null);
      stage.current = null;
    };
  }, []);

  // the hands show the night being set
  useEffect(() => { stage.current?.setPlan(toMin(plan.bed), toMin(plan.wake), plan.on); }, [plan.bed, plan.wake, plan.on, sel]);
  // Barnaby's line fades after a while
  useEffect(() => { if (!chat) return undefined; const t = setTimeout(() => setChat(null), 4200); return () => clearTimeout(t); }, [chat?.id]);
  // the scene frames what the panel leaves free: a column on the right, or the sheet's height at the bottom
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return undefined;
    const apply = () => {
      const S = stage.current, r = el.getBoundingClientRect();
      if (!S) return;
      if (wide) S.setInset(Math.max(0, innerWidth - r.left + 8), 0);
      else S.setInset(0, Math.max(0, innerHeight - r.top - 6), 62);
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    const t = setTimeout(apply, 520); // (after the sheet's slide)
    return () => { ro?.disconnect(); clearTimeout(t); };
  }, [wide, open]);
  // a phone with the sheet up looks at the dial; down, at the whole clock
  useEffect(() => {
    const S = stage.current;
    if (!S || wide) return;
    const want = open ? 'dial' : zoom;
    if (S.current !== want && S.current !== 'intro') S.focus(want);
  }, [open, wide]);

  // ---- settings
  const setSleep = (f: (x: typeof sp) => void) => { edit((x) => f(x.sleep)); syncReminders(); };
  const setPref = (f: (x: Prefs3) => void) => {
    const S = stage.current;
    const np = { ...(S?.prefs ?? prefs) };
    f(np);
    if (S) Object.assign(S.prefs, np);
    savePrefs3(np); setPrefs(np);
  };
  const setFinish = (id: string) => {
    stage.current?.setFinish(id);
    setPref((x) => { x.finish = id; });
    sound.play('wood_knock', { volume: 0.45 });
    stage.current?.focus(wide ? 'home' : stage.current.current);
  };
  const setTick = (on: boolean) => { setPref((x) => { x.mute = !on; }); sound.play('clock_tick', { volume: 0.4 }); };
  const nudge = (hand: SetHand, by: number) => {
    const pl = planFor(save.value.routine, sel);
    const b = toMin(pl.bed), w = toMin(pl.wake);
    const t = fitSet(hand, (hand === 'bed' ? b : w) + by, hand === 'bed' ? w : b);
    if (t === (hand === 'bed' ? b : w)) { sound.play('ui_error', { volume: 0.25, gap: 100 }); return; }
    sound.play('clock_tick', { volume: 0.3, rate: hand === 'bed' ? 1.18 : 1.32, gap: 30 });
    commit(sel, hand, t);
    stage.current?.shop?.look(v3d(), 1.6);
  };
  const pickDay = (d: number) => { if (d === sel) return; tap('pencil', 0.35); setSel(d); };
  const stamp = (days: number[], label: string, el: Element) => {
    setRoutine(copyNight(save.value.routine, sel, days));
    sound.play('stamp', { volume: 0.55 });
    sparkleAt(el, 6);
    toast(`${DAY_NAME[sel]} night copied to ${label}`, undefined, 1800);
  };

  function back() {
    const S = stage.current;
    if (cal) { tap('ui_back', 0.4); setCal(false); return; }
    if (!wide && open) { tap('ui_back', 0.4); setOpen(false); return; }
    if (S && S.current !== 'home') { tap('ui_back', 0.4); S.focus('home'); setZoom('home'); return; }
    tap('ui_close', 0.5);
    setLeaving(true);
    setTimeout(() => { if (panel.value === 'clock') panel.value = null; }, 220);
  }
  const backRef = useRef(back);
  backRef.current = back;

  const smart = sp.smartMin && sp.alarmOn && plan.on ? fmtHM(hhmm(wakeM - sp.smartMin), h12) : '';
  const windAt = fmtHM(hhmm(bedM - sp.windDownMin), h12);
  const nextDay = DAY_SHORT[(sel + 1) % 7];

  const ledger = (
    <>
      <Paper kind="cream" opts={{ edge: 0.25, edgeW: 6, seed: 21 }} class="ck-night">
        <div class="ckn-head">
          <span class="ckn-kicker">{isTonight ? `Tonight · ${DAY_NAME[sel]}` : `${DAY_NAME[sel]} night`}</span>
          <span class={'ckn-stamp' + (plan.on ? '' : ' off')}>{plan.on ? 'Alarm set' : 'Free night'}</span>
        </div>
        <div class="ckn-times">
          <div class={'ckn-t bed' + (draft?.hand === 'bed' ? ' live' : '')}>
            <small><Px name="moon" size={30} />Bedtime</small>
            <BigTime min={bedM} h12={h12} />
            <span class="ckn-nudge"><button aria-label="Bedtime 5 minutes earlier" onClick={() => nudge('bed', -5)}>−</button><button aria-label="Bedtime 5 minutes later" onClick={() => nudge('bed', 5)}>+</button></span>
          </div>
          <div class="ckn-mid"><i /><b>{fmtDur(durM * 60_000)}</b><i /></div>
          <div class={'ckn-t wake' + (draft?.hand === 'wake' ? ' live' : '')}>
            <small><Px name="sun" size={30} />Wake · {nextDay}</small>
            <BigTime min={wakeM} h12={h12} />
            <span class="ckn-nudge"><button aria-label="Wake 5 minutes earlier" onClick={() => nudge('wake', -5)}>−</button><button aria-label="Wake 5 minutes later" onClick={() => nudge('wake', 5)}>+</button></span>
          </div>
        </div>
        <p class="ckn-line">{plan.on ? (sp.alarmOn ? (smart ? <>Alarm from <b>{smart}</b> if you're sleeping lightly</> : <>Alarm at <b>{fmtHM(hhmm(wakeM), h12)}</b></>) : 'The alarm is off: Pip wakes you gently with the light') : 'No alarm or reminder this night: sleep in'}</p>
      </Paper>
      <div class="ck-week" role="tablist" aria-label="Which night to set">
        {ORDER3.map((d) => {
          const pl = planFor(s.routine, d), on = d === sel;
          return (
            <button role="tab" aria-selected={on} class={'ck-day' + (on ? ' on' : '') + (pl.on ? '' : ' free') + (d === tonight ? ' today' : '')} onClick={() => pickDay(d)} aria-label={`${DAY_NAME[d]} night: bed ${fmtHM(pl.bed, h12)}, wake ${fmtHM(pl.wake, h12)}`}>
              <span class="dn">{DAY_SHORT[d].slice(0, 2)}</span>
              <span class="bar"><i style={{ height: `${Math.max(14, Math.min(100, ((pl.min - 240) / 480) * 100))}%` }} /></span>
              <span class="dh">{pl.on ? `${Math.floor(pl.min / 60)}h${pl.min % 60 ? String(pl.min % 60).padStart(2, '0') : ''}` : 'free'}</span>
            </button>
          );
        })}
      </div>
      <div class="ck-row ck-copy">
        <button class="ck-check" onClick={() => { tap('pencil', 0.5); setRoutine(setNight(save.value.routine, sel, { on: !plan.on })); }} aria-pressed={plan.on}>
          <span class={'box' + (plan.on ? ' on' : '')}>{plan.on && <svg viewBox="0 0 14 14" width="22" height="22"><path d="M1.5 7.5 L5.2 11 L12.5 2.5" fill="none" stroke="#2b3142" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>}</span>
          <span>Alarm &amp; reminder this night</span>
        </button>
        <span class="ck-stamps">
          <button class="rstamp" onClick={(e) => stamp(WEEKNIGHTS, 'weeknights', e.currentTarget)}><Px name="calendar" size={30} /><span>Weeknights</span></button>
          <button class="rstamp alt" onClick={(e) => stamp([0, 1, 2, 3, 4, 5, 6], 'every night', e.currentTarget)}><Px name="star" size={30} /><span>Every night</span></button>
        </span>
      </div>

      <div class="tags ck-tabs" role="tablist">
        {TABS.map((t) => <button role="tab" aria-selected={tab === t.id} class={'tag' + (tab === t.id ? ' on' : '')} onClick={() => { if (tab !== t.id) { tap('ui_tab', 0.45); setTab(t.id); } }}><Px name={t.icon} size={30} /><span>{t.label}</span></button>)}
      </div>

      <div class="ck-tab" key={tab}>
        {tab === 'alarm' && <>
          <div class="ck-set"><Px name="bell" size={30} /><span class="grow"><b>Morning alarm</b><small>{sp.alarmOn ? 'Swells in gently. Snooze or slide to wake.' : 'Off: no alarm on any night'}</small></span><Toggle on={sp.alarmOn} onChange={(v) => setSleep((x) => { x.alarmOn = v; })} label="Morning alarm" /></div>
          {sp.alarmOn && <>
            <SoundTiles value={sp.alarmSound} options={ALARMS} cols={4} onPick={(v) => setSleep((x) => { x.alarmSound = v; })} preview={(v) => { sound.preview(v, 4, 'alarm'); return 4000; }} />
            <div class="ck-set col"><span><b>Smart wake</b><small>{sp.smartMin ? `Rings up to ${sp.smartMin} minutes early when you're in light sleep` : 'Rings at the exact time'}</small></span>
              <Tags value={sp.smartMin} onChange={(v) => setSleep((x) => { x.smartMin = v; })} options={[{ v: 0, label: 'Exact' }, { v: 10, label: '10m' }, { v: 20, label: '20m' }, { v: 30, label: '30m' }]} /></div>
          </>}
        </>}
        {tab === 'bedtime' && <>
          <div class="ck-set"><Px name="candle" size={30} /><span class="grow"><b>Bedtime reminder</b><small>{sp.reminders ? `A nudge at ${windAt} to wind down, and at bedtime` : 'Off'}</small></span><Toggle on={sp.reminders} onChange={(v) => setSleep((x) => { x.reminders = v; })} label="Bedtime reminder" /></div>
          {sp.reminders && <div class="ck-set col"><span><b>Wind-down</b><small>How long before bed the first nudge comes</small></span>
            <Tags value={sp.windDownMin} onChange={(v) => setSleep((x) => { x.windDownMin = v; })} options={[{ v: 15, label: '15m' }, { v: 30, label: '30m' }, { v: 45, label: '45m' }, { v: 60, label: '1h' }]} /></div>}
          <div class="ck-set"><Px name="mic" size={30} /><span class="grow"><b>Track my sleep</b><small>Pip listens with the microphone. It all stays on this device.</small></span><Toggle on={sp.mic} onChange={(v) => setSleep((x) => { x.mic = v; })} label="Sleep tracking" /></div>
        </>}
        {tab === 'clock' && <>
          <div class="ck-set"><Px name="nest" size={30} /><span class="grow"><b>Cuckoo on the hour</b><small>Your owl pops out to call the hours</small></span><Toggle on={prefs.chime !== false} onChange={(v) => { setPref((x) => { x.chime = v; }); if (v) stage.current?.cuckoo(1); }} label="Cuckoo on the hour" /></div>
          <div class="ck-set"><Px name="clock" size={30} /><span class="grow"><b>Ticking</b><small>The pendulum's soft tick</small></span><Toggle on={!prefs.mute} onChange={(v) => setTick(v)} label="Ticking" /></div>
          <div class="ck-set col"><span><b>Wood</b><small>{FINISHES3.find((f) => f.id === prefs.finish)?.name ?? ''}</small></span>
            <div class="ck-woods">{FINISHES3.map((f) => <button class={'ck-wood' + (prefs.finish === f.id ? ' on' : '')} style={{ '--wood': FINISH_HUE[f.id] ?? '#8a5a2a' } as JSX.CSSProperties} aria-label={f.name} aria-pressed={prefs.finish === f.id} onClick={() => { if (prefs.finish !== f.id) setFinish(f.id); }}><i /><span>{f.name.split(' ').pop()}</span></button>)}</div>
          </div>
          <div class="ck-btns">
            <button class="btn oak sm" onClick={() => { const S = stage.current; if (!S) return; S.windUp(0); setTimeout(() => S.windUp(1), 420); savePrefs3(S.prefs); setPrefs({ ...S.prefs }); toast('Both weights wound up', undefined, 1500); }}>Wind the weights</button>
            <button class="btn oak sm" onClick={() => { tap('ui_tap', 0.3); stage.current?.cuckoo(1 + Math.floor(Math.random() * 3)); }}>Call the cuckoo</button>
          </div>
        </>}
        {tab === 'week' && <>
          <div class="ck-stats">
            {[
              { k: 'This week', v: st.weekNights ? fmtDur(st.weekTotal) : '–', s: `${st.weekNights} night${st.weekNights === 1 ? '' : 's'}` },
              { k: 'Per night', v: st.avgNight ? fmtDur(st.avgNight) : '–', s: `goal ${fmtDur(goal * 60_000)}` },
              { k: 'Streak', v: `${streak}`, s: `best ${Math.max(s.bestStreak, st.bestRun)}` },
              { k: 'Asleep by', v: st.avgBed === null ? '–' : fmtHM(toHHMM(st.avgBed), h12), s: 'on average' },
            ].map((x, i) => <Paper kind="cream" opts={{ edge: 0.2, edgeW: 5, seed: 30 + i }} class="ck-stat"><small>{x.k}</small><b>{x.v}</b><em>{x.s}</em></Paper>)}
          </div>
          <div class="ck-bars" aria-label="The last seven nights">
            <i class="goal" style={{ bottom: `${Math.min(100, (goal / 60 / 10) * 100)}%` }}><span>goal</span></i>
            {week.map((w) => (
              <button class={'ck-bar' + (w.n ? ' has' : '') + (w.goal ? ' met' : '') + (w.today ? ' today' : '')} disabled={!w.n} onClick={() => { if (w.n) { tap('paper_flip', 0.5); setReport(w.n); } }} aria-label={w.n ? `${w.day}: ${fmtDur(w.n.report!.asleep)}` : `${w.day}: no night tracked`}>
                <span class="col"><i style={{ height: `${w.hours === null ? 0 : Math.max(6, Math.min(100, (w.hours / 10) * 100))}%` }} /></span>
                <small>{w.day.slice(0, 2)}</small>
              </button>
            ))}
          </div>
          {!s.nights.some((n) => n.report && !n.simulated) && <p class="ck-note">Sleep with Pip tonight and your nights show up here.</p>}
          <div class="ck-btns"><button class="btn oak sm" onClick={() => { tap('paper_flip', 0.5); setCal(true); }}><Px name="calendar" size={30} />Month calendar</button></div>
        </>}
      </div>
    </>
  );

  return (
    <div class={'ck' + (wide ? ' wide' : ' phone') + (open ? ' open' : '') + (leaving ? ' leaving' : '')} role="dialog" aria-label="Sleep clock">
      <button class="ck-back" aria-label={zoom !== 'home' || open ? 'Back to the clock' : 'Back to the hollow'} onClick={back}><Px name="arrow_left" size={30} /><span>Back</span></button>
      {!wide && !open && <div class="ck-title"><span>Sleep Clock</span></div>}
      {hint && !draft && !open && <div class="ck-hint" ref={hintRef}><Px name="cursor_hand" size={30} /><span>Drag the <b>moon</b> and the <b>sun</b> round the dial</span></div>}
      {draft && (
        <div class={'ck-read ' + draft.hand} ref={readRef}>
          <small>{draft.hand === 'bed' ? 'Bedtime' : `Wake · ${nextDay}`}</small>
          <BigTime min={draft[draft.hand]} h12={h12} />
          <em>{fmtDur(durM * 60_000)} of sleep</em>
        </div>
      )}
      {chat && <div class="ck-chat" ref={chatRef} key={chat.id}><b>Barnaby</b><span>{chat.text}</span></div>}
      <aside class="ck-panel hh-wood-dark" ref={panelRef}>
        {wide ? <div class="ck-sign"><span>Sleep Clock</span></div> : (
          <button class="ck-grab" onClick={() => { tap(open ? 'ui_close' : 'ui_open', 0.4); setOpen(!open); }} aria-expanded={open} aria-label={open ? 'Fewer settings' : 'More settings'}><i /><span>{open ? 'Done' : 'Alarm, reminders & more'}</span></button>
        )}
        <div class="ck-pscroll">{ledger}</div>
      </aside>
      {cal && <div class="ck-modal" onClick={(e) => { if (e.target === e.currentTarget) { tap('ui_close', 0.4); setCal(false); } }}><div class="ck-calwrap"><MonthCalendar onOpen={(n) => setReport(n)} /><button class="btn oak sm ck-calx" onClick={() => { tap('ui_close', 0.4); setCal(false); }}>Close</button></div></div>}
      {report && report.report && <div class="cs-modal"><NightReport s={report} onClose={() => setReport(null)} /></div>}
    </div>
  );
}
/** the dial, for Barnaby's glance */
const v3d = () => ({ x: 0, y: 0.43, z: 0.27 } as unknown as import('three').Vector3);

/** The Clock panel: the 3D cuckoo clock in Barnaby's workshop, or the painted wall if 3D isn't available. */
export function ClockScreen() {
  const [flat, setFlat] = useState(() => !sceneRef.current);
  return flat ? <ClockWall2D /> : <Clock3D onFail={() => setFlat(true)} />;
}
