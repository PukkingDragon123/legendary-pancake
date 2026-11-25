// The Sleep button's screen: a bedtime ritual laid out on the nightstand at night. A flickering
// candle, the alarm clock, a mug and the phone stand on the table; tonight's plan is a ticket, the
// wind-down steps are pencilled on an index card (personalised from the interview), three cards
// say how to fall asleep earlier, and a little tray holds the sounds and the alarm. Hold the
// quilted button to say goodnight: the lights go out and Pip flies off on tonight's adventure.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREA } from '../game/catalog.ts';
import { blockStatus, demoTonight, setRoutine, syncReminders, tonight } from '../game/night.ts';
import { dayKey, edit, save, type Profile } from '../game/store.ts';
import { DAY_NAME, setNight, toMin } from '../game/routine.ts';
import { BreathePicker } from './breathe.tsx';
import { WoodClock } from './clock.tsx';
import { mugSteam, propCandle, propMug, propPhone, wallpaperTile } from './chrome/objects.ts';
import { reducedMotion } from './chrome/swing.ts';
import { Px } from './icons.tsx';
import { PhoneLockSheet } from './phone/phone.tsx';
import { fmtDur, fmtHM, Tags, tap, toast, Toggle } from './kit.tsx';
import { moonPhase } from './px/sleepprops.ts';
import { paintWindow } from './real/window.ts';
import { GOLD, Real, box, cached, deviceK, enamel, matte, metal, polygon, tubeX, wood } from './real/paint.ts';
import { ALARMS, goToSleep, SOUNDSCAPES, SoundTiles } from './sleep.tsx';
import { HoldButton, injectSleepFrames, PaintCanvas, Paper, PencilTick, sparkleAt } from './sleepkit.tsx';
import { breathing, panel, sceneRef } from './state.ts';
import { fxMoment } from './fx/moment.ts'; // [fx10]
import './sleepflow.css';

// ------------------------------------------------------------------ the wind-down, personalised

type StepId = 'breathe' | 'phone' | 'coffee' | 'lights' | 'jot' | 'read' | 'cool';
interface Step { id: StepId; title: string; sub: string; sprite: string }
const has = (list: string[], ...words: string[]) => list.some((g) => words.some((w) => g.toLowerCase().includes(w)));

/** [font6] a time in big 3D digits with a small AM/PM, so two fit side by side at any art pixel */
const hm2 = (t: string) => { const [a, b] = t.split(/\s+/); return <><span>{a}</span>{b ? <small class="ampm">{b}</small> : null}</>; };

export function windDownSteps(p: Profile): Step[] {
  const slow = p.latency === 'slow' || p.latency === 'long';
  const out: Step[] = [
    { id: 'breathe', title: slow ? 'Breathe with Pip (4-7-8)' : 'A few slow breaths with Pip', sub: slow ? 'Long, slow exhales tell your body it is safe to rest' : 'Three minutes, in the moonlit clearing', sprite: 'lantern' },
  ];
  if (p.phone !== 'never') out.push({ id: 'phone', title: 'Put the phone to bed', sub: p.phone === 'nightly' ? 'Face-down, out of reach. Pip keeps watch.' : 'Face-down on the nightstand', sprite: 'phone_off' });
  if (p.caffeine === 'late') out.push({ id: 'coffee', title: 'No more coffee today', sub: 'Caffeine lingers for hours. Chamomile instead?', sprite: 'hourglass' });
  out.push({ id: 'lights', title: 'Dim the lights', sub: 'Low, warm light for the last hour', sprite: 'candle' });
  if (has(p.goals, 'stress', 'calm', 'worry', 'mind', 'anx') || has(p.relax, 'journal', 'writ')) out.push({ id: 'jot', title: "Jot down tomorrow's to-do", sub: 'Out of your head, onto paper', sprite: 'pen' });
  if (has(p.relax, 'read', 'book')) out.push({ id: 'read', title: 'Read a few pages', sub: 'Paper, not a screen', sprite: 'book' });
  if (out.length < 4) out.push({ id: 'cool', title: 'Cool, dark, quiet room', sub: 'About 18°C (65°F) is just right', sprite: 'wind' });
  return out.slice(0, 5);
}

interface Tip { id: string; title: string; body: string; sprite: string }
const TIPS: Record<string, Tip> = {
  wake: { id: 'wake', title: 'Same wake time, every day', body: 'Your body clock sets itself by when you get up. Keep it within an hour, weekends too.', sprite: 'alarm' },
  light: { id: 'light', title: 'Morning light', body: 'Ten minutes of daylight soon after waking makes you sleepy earlier in the evening.', sprite: 'sun' },
  winddown: { id: 'winddown', title: 'A wind-down hour', body: 'Dim lamps, slow tasks, no work. Give your brain a runway to land on.', sprite: 'candle' },
  cool: { id: 'cool', title: 'Cool, dark and quiet', body: 'A cool room, blackout curtains and soft sounds help you drop off sooner.', sprite: 'wind' },
  caffeine: { id: 'caffeine', title: 'Caffeine curfew', body: 'Stop coffee, tea and cola about 8 hours before bed. It stays with you longer than you think.', sprite: 'hourglass' },
  screens: { id: 'screens', title: 'Screens out of bed', body: 'Scrolling keeps your mind busy. Charge the phone across the room.', sprite: 'phone_off' },
  shift: { id: 'shift', title: 'Move bedtime in small steps', body: 'Go to bed 15 minutes earlier every few nights instead of all at once.', sprite: 'clock' },
  getup: { id: 'getup', title: "Can't drop off? Get up", body: 'After about 20 minutes awake, do something calm in dim light, then try again.', sprite: 'lantern' },
  move: { id: 'move', title: 'Move in the daytime', body: 'Exercise deepens sleep. Finish hard workouts a few hours before bed.', sprite: 'bolt' },
};
export function tipsFor(p: Profile): Tip[] {
  const order: string[] = [];
  if (p.chronotype === 'owl') order.push('light', 'shift');
  if (p.caffeine === 'late') order.push('caffeine');
  if (p.phone === 'nightly') order.push('screens');
  if (p.latency === 'long' || p.latency === 'slow') order.push('getup');
  order.push('wake', 'light', 'winddown', 'cool', 'move');
  return [...new Set(order)].slice(0, 3).map((k) => TIPS[k]);
}

const ritualKey = () => 'hoot-hollow:ritual:' + dayKey(Date.now() - 5 * 3600_000);
const loadDone = (): StepId[] => { try { return JSON.parse(localStorage.getItem(ritualKey()) ?? '[]'); } catch { return []; } };
const saveDone = (d: StepId[]) => { try { localStorage.setItem(ritualKey(), JSON.stringify(d)); } catch { /* storage blocked */ } };

// ------------------------------------------------------------------ backgrounds

/** [ui7] a deep-blue damask wallpaper tile (realistic, printed paper) */
const wallpaper = () => wallpaperTile('sapphire', 72);

// ------------------------------------------------------------------ props on the table

/** [ui4] a frame counter for a little looping animation (stays on frame 0 with calm motion) */
function useFrames(n: number, ms: number) {
  const [f, setF] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const id = setInterval(() => { if (!document.hidden) setF((v) => (v + 1) % n); }, ms);
    return () => clearInterval(id);
  }, [n, ms]);
  return f;
}
// [ui4] the props are detailed relief-painted objects (src/ui/chrome/objects.ts), one art px per CSS px
function CandleProp(p: { dim: boolean; onTap: () => void }) {
  const f = useFrames(4, 130);
  return (
    <button class={'prop prop-candle' + (p.dim ? ' dim' : '')} aria-label="Candle: dim the lights" onClick={p.onTap}>
      <span class="halo" />
      <img src={propCandle(f, 3)} width={54} height={108} alt="" draggable={false} />
    </button>
  );
}
function MugProp(p: { tea: boolean; onTap: () => void }) {
  const f = useFrames(4, 260);
  return (
    <button class="prop prop-mug" aria-label={p.tea ? 'A mug of chamomile tea' : 'Coffee: swap it for tea'} onClick={p.onTap}>
      <img class="steam" src={mugSteam(f, 3)} width={78} height={42} alt="" draggable={false} />
      <img src={propMug(p.tea ? 'tea' : 'coffee', 3)} width={78} height={78} alt="" draggable={false} />
    </button>
  );
}
function PhoneProp(p: { bed: boolean; onTap: () => void }) {
  return (
    <button class={'prop prop-phone' + (p.bed ? ' tucked' : '')} aria-label={p.bed ? 'The phone is tucked in for the night' : 'Put the phone to bed'} onClick={p.onTap}>
      <img src={propPhone(p.bed, 3)} width={66} height={102} alt="" draggable={false} />
      {p.bed && <span class="zz">z<small>z</small></span>}
    </button>
  );
}

// ------------------------------------------------------------------ the screen

export function SleepScreen() {
  injectSleepFrames();
  const s = save.value, sp = s.sleep, h12 = s.settings.hour12;
  const plan = tonight();
  const area = AREA[s.area];
  const steps = useMemo(() => windDownSteps(s.profile), [s.profile]);
  const tips = useMemo(() => tipsFor(s.profile), [s.profile]);
  const [done, setDone] = useState<StepId[]>(loadDone);
  const [tipAt, setTipAt] = useState(0);
  const [flip, setFlip] = useState(-1);
  const [picker, setPicker] = useState(false);
  const [lock, setLock] = useState(false); // [intro5] the phone-lock step plays the pretend phone
  const [out, setOut] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [vw, setVw] = useState(innerWidth);
  useEffect(() => { const f = () => setVw(innerWidth); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);
  // a breathing session finished today ticks the breathing step
  useEffect(() => { if (s.breath.lastDay === dayKey() && !done.includes('breathe') && steps.some((x) => x.id === 'breathe')) { const d = [...done, 'breathe' as StepId]; setDone(d); saveDone(d); } }, []);
  const isDone = (id: StepId) => done.includes(id);
  const toggle = (id: StepId, el?: Element | null) => {
    const on = !isDone(id);
    const d = on ? [...done, id] : done.filter((x) => x !== id);
    setDone(d); saveDone(d);
    if (on) {
      sound.play('pencil', { volume: 0.55 });
      setTimeout(() => sound.play('sparkle', { volume: 0.3 }), 220);
      sparkleAt(el ?? null, 7);
      if (d.length === steps.length) setTimeout(() => { sound.play('reward_quest', { volume: 0.4 }); toast('Wind-down complete. Pip is proud of you!', undefined, 2600); }, 500);
    } else sound.play('paper_flip', { volume: 0.3 });
  };
  const close = () => { tap('ui_close', 0.5); setLeaving(true); setTimeout(() => { if (panel.value === 'sleep') panel.value = null; }, 260); };
  const openClock = () => { tap('ui_open', 0.5); panel.value = 'clock'; };
  const set = (f: (x: typeof sp) => void) => { edit((x) => f(x.sleep)); syncReminders(); };
  const lightsOut = async () => {
    setOut(true);
    sound.play('bowl', { volume: 0.45 });
    setTimeout(() => sound.play('owl_hoot', { volume: 0.35, rate: 0.9 }), 500);
    sceneRef.current?.owl.play('yawn'); fxMoment('bedtime'); // [fx10] sleepy lids, a dusk veil, dream motes
    setTimeout(() => { void goToSleep(); }, 1100);
  };
  const dim = isDone('lights');
  const winW = Math.max(110, Math.min(230, Math.floor((Math.min(vw, 1100) - 24) / 3)));
  const startBreath = () => { tap('ui_open', 0.5); setPicker(true); };
  const tableBg = { background: 'linear-gradient(180deg, rgba(20,10,4,.35), rgba(20,10,4,0) 30%), var(--tx-walnut) 0 0 / 420px 420px, #4a2814' };
  const smart = sp.smartMin && sp.alarmOn && plan.on ? fmtHM(toHHMMm(toMin(plan.wake) - sp.smartMin), h12) : '';

  return (
    <div class={'sf' + (dim ? ' dim' : '') + (out ? ' out' : '') + (leaving ? ' leaving' : '')} role="dialog" aria-label="Bedtime">
      <button class="sf-back" aria-label="Back to the hollow" onClick={close}><Px name="arrow_left" size={30} /></button>
      <div class="sf-scroll">
      <div class="sf-wall" style={{ backgroundImage: `url(${wallpaper()})`, backgroundSize: '72px 72px' }}>
        <PaintCanvas w={winW * 3} h={168} fps={8} deps={[winW, dim]} class="sf-window" label="The night outside your window" draw={(g, t, w, h) => paintWindow(g, w, h, t, { phase: moonPhase(), dim: dim ? -0.5 : 0 })} />
        <div class="sf-sign hh-wood-sm"><span>Bedtime</span></div>
      </div>

      <div class="sf-table" style={tableBg}>
        <div class="sf-edge" />
        <div class="sf-props">
          <CandleProp dim={dim} onTap={() => { tap('ui_toggle', 0.4); if (steps.some((x) => x.id === 'lights')) toggle('lights', document.querySelector('.prop-candle')); }} />
          <button class="prop prop-clock" aria-label="Alarm clock: adjust tonight on the Clock" onClick={openClock}>
            <WoodClock wake={plan.wake} bedtime={plan.bed} hour12={h12} size={128} />
          </button>
          <MugProp tea={s.profile.caffeine !== 'late' || isDone('coffee')} onTap={() => { if (s.profile.caffeine === 'late') toggle('coffee', document.querySelector('.prop-mug')); else { tap('ui_tap', 0.4); sound.play('water_plop', { volume: 0.3 }); } }} />
          {s.profile.phone !== 'never' && <PhoneProp bed={isDone('phone')} onTap={() => { if (isDone('phone')) toggle('phone', document.querySelector('.prop-phone')); else { tap('ui_open', 0.5); setLock(true); } }} />}
        </div>

        <div class="sf-grid">
          <div class="sf-col">
            {/* tonight's plan, a ticket */}
            <button class="sf-ticket" onClick={openClock} aria-label="Tonight's plan: tap to adjust on the Clock">
              <Paper kind="postcard" opts={{ edge: 0.3, edgeW: 6 }} class="tk-body">
                <div class="tk-head"><span class="tk-kicker">Tonight · {DAY_NAME[plan.day]}</span><span class="tk-stamp">{plan.on ? 'PLANNED' : 'FREE NIGHT'}</span></div>
                <div class="tk-times">
                  <div><small>Bed</small><b>{hm2(fmtHM(plan.bed, h12))}</b></div>
                  <span class="tk-arrow"><Px name="zzz" size={30} /></span>
                  <div><small>Wake</small><b class="wake">{plan.on ? hm2(fmtHM(plan.wake, h12)) : 'sleep in'}</b></div>
                </div>
                <p class="tk-line">{fmtDur(plan.min * 60_000)} of sleep{smart ? <> · smart wake from {smart}</> : null}</p>
                <p class="tk-line area"><Px name="map" size={30} />Pip explores <b>{area?.name ?? 'the woods'}</b></p>
                <span class="tk-hint">Tap to adjust</span>
              </Paper>
              <span class="tk-stub"><Px name="owl" size={30} /></span>
            </button>
            {!plan.on && <button class="sf-plan-it hh-btn-cream" onClick={() => { tap('stamp', 0.5); setRoutine(setNight(s.routine, plan.day, { on: true })); }}>Set an alarm for tonight</button>}

            {/* the wind-down card */}
            <div class="sf-cards">
              <span class="sf-under u1" /><span class="sf-under u2" />
              <Paper kind="notebook" opts={{ rules: 8, ruleTop: 18, margin: 14, edge: 0.15 }} class="sf-index">
                <h3>Wind-down</h3>
                <ul>
                  {steps.map((st) => (
                    <li class={isDone(st.id) ? 'done' : ''}>
                      <button class="sf-step" onClick={(e) => { if (st.id === 'breathe' && !isDone('breathe')) { startBreath(); return; } if (st.id === 'phone' && !isDone('phone')) { tap('ui_open', 0.5); setLock(true); return; } toggle(st.id, (e.currentTarget as Element).querySelector('.box')); }}>
                        <span class="box"><PencilTick on={isDone(st.id)} /></span>
                        <span class="txt"><b>{st.title}</b><small>{st.sub}</small></span>
                        <Px name={st.sprite} size={30} />
                      </button>
                    </li>
                  ))}
                </ul>
                <p class="sf-count">{done.filter((d) => steps.some((x) => x.id === d)).length} of {steps.length} done</p>
              </Paper>
              <img class="sf-pencil" src={pencilURL()} alt="" />
            </div>
          </div>

          <div class="sf-col">
            {/* three cards: how to fall asleep earlier */}
            <div class="sf-tips" onClick={() => { tap('paper_flip', 0.45); setFlip(tipAt); setTimeout(() => setFlip(-1), 520); setTipAt((i) => (i + 1) % tips.length); }} role="button" aria-label="How to fall asleep earlier: tap for the next tip">
              <h4 class="sf-label">How to fall asleep earlier</h4>
              <div class="tip-stack">
                {tips.map((t, i) => {
                  const pos = (i - tipAt + tips.length) % tips.length;
                  return (
                    <Paper kind="cream" opts={{ edge: 0.25, edgeW: 6, seed: 40 + i }} class={'tip pos' + pos + (flip === i ? ' flip' : '')} style={{ zIndex: 10 - pos }}>
                      <span class="tip-n">{i + 1}/{tips.length}</span>
                      <span class="tip-ico"><Px name={t.sprite} size={52} /></span>
                      <b>{t.title}</b>
                      <p>{t.body}</p>
                    </Paper>
                  );
                })}
              </div>
            </div>

            {/* the sound tray */}
            <div class="sf-tray hh-wood-dark">
              <div class="tray-head"><Px name="music" size={30} /><b>Falling-asleep sounds</b></div>
              <SoundTiles value={sp.soundscape} options={SOUNDSCAPES} onPick={(v) => set((x) => { x.soundscape = v; })} preview={(v) => { if (v === 'none') return 0; sound.preview(v, 5); return 5000; }} />
              {sp.soundscape !== 'none' && <div class="tray-row"><span>Fade after</span><Tags value={sp.soundscapeMin} onChange={(v) => set((x) => { x.soundscapeMin = v; })} options={[{ v: 15, label: '15m' }, { v: 30, label: '30m' }, { v: 60, label: '1h' }, { v: 0, label: 'All night' }]} /></div>}
              <div class="tray-head"><Px name="bell" size={30} /><b class="grow">Alarm</b><Toggle on={sp.alarmOn} onChange={(v) => set((x) => { x.alarmOn = v; })} label="Alarm" /></div>
              {sp.alarmOn && <>
                <SoundTiles value={sp.alarmSound} options={ALARMS} onPick={(v) => set((x) => { x.alarmSound = v; })} preview={(v) => { sound.preview(v, 4, 'alarm'); return 4000; }} />
                <div class="tray-row"><span>Smart wake</span><Tags value={sp.smartMin} onChange={(v) => set((x) => { x.smartMin = v; })} options={[{ v: 0, label: 'Exact' }, { v: 10, label: '10m' }, { v: 20, label: '20m' }, { v: 30, label: '30m' }]} /></div>
              </>}
            </div>

            {/* the microphone note */}
            <Paper kind="sticky" opts={{ sticky: 1, seed: 3 }} class="sf-mic">
              <div class="mic-row"><Px name="mic" size={40} /><span class="grow"><b>Pip listens while you sleep</b><small>{import.meta.env.MODE === 'artifact' ? 'Here the night is tracked by time; the mic works in the full app.' : 'Snores, sleep talk and tossing. It all stays on this phone.'}</small></span><Toggle on={sp.mic} onChange={(v) => set((x) => { x.mic = v; })} label="Sleep tracking" /></div>
              {blockStatus.value && <p class="mic-block"><Px name="shield" size={30} />{blockStatus.value.blocking ? 'The bedtime blocker is on' : 'The bedtime blocker will switch on'}</p>}
            </Paper>
            {s.nights.length < 2 && <button class="sf-demo" onClick={() => { tap(); demoTonight(); panel.value = null; toast('A pretend night, so you can see the morning.'); }}>Try a pretend night first</button>}
          </div>
        </div>
        <div class="sf-spacer" />
      </div>
      </div>

      <div class="sf-foot">
        <HoldButton ms={1500} label="Hold to go to sleep" class="sf-sleep hh-btn-night" onDone={lightsOut}>
          <Px name="candle" size={40} /><span>Hold to sleep</span>
        </HoldButton>
        <p>Pip flies off to {area?.name ?? 'the woods'}</p>
      </div>
      <div class="sf-dark" />
      {lock && <PhoneLockSheet wake={plan.wake} hour12={h12} onClose={() => { tap('ui_close', 0.4); setLock(false); }} onDone={() => { setLock(false); if (!isDone('phone')) toggle('phone', document.querySelector('.prop-phone')); }} />}
      {picker && <div class="sf-modal" onClick={(e) => { if (e.target === e.currentTarget) { tap('ui_close', 0.4); setPicker(false); } }}>
        <BreathePicker embedded preset={s.profile.latency === 'slow' || s.profile.latency === 'long' ? 'sleep' : undefined} onClose={() => setPicker(false)} onBegin={() => { const d = done.includes('breathe') ? done : [...done, 'breathe' as StepId]; setDone(d); saveDone(d); }} />
      </div>}
    </div>
  );
}
const toHHMMm = (m: number) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

/** [ui7] a yellow pencil: lacquered hexagonal barrel, brass ferrule, pink eraser, sharpened cedar tip (132 x 24 CSS px) */
function pencilURL() {
  return cached('pencil7', () => {
    const r = new Real(132, 24, deviceK(3), 0);
    r.part(box(16, 4, 92, 15, 1), (x, y) => tubeX(11.5, 7.5, 1)(x, y, 0) + (Math.abs(y - 11.5) < 2.6 ? 0.6 : 0), enamel('#f0b828', { gloss: 0.8 }));
    r.part(box(106, 3.5, 12, 16, 1.5), tubeX(11.5, 8, 1), metal(GOLD, { along: 'y', polish: 0.6 }));
    for (const x of [108.5, 112, 115.5]) r.carve(box(x, 3.5, 0.8, 16), 0.5, 0.4);
    r.part(box(117, 4, 13, 15, 5), tubeX(11.5, 7.5, 1), matte('#e88a8a', { spec: 0.12 }));
    r.part(polygon([[17, 4], [17, 19], [2.5, 11.5]]), (x, y) => tubeX(11.5, 7.5 * (x - 2) / 15, 1)(x, y, 0), wood('honey', { along: 'x', scale: 4 }));
    r.part(polygon([[7, 9.2], [7, 13.8], [2, 11.5]]), 1.6, matte('#3a3a40', { spec: 0.6, shin: 40 }));
    return r.url({ shadow: { dy: 2, blur: 3, a: 0.4 } });
  });
}

export { breathing };
