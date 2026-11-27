// The Sleep button's screen: bedtime as one journey in 3D.
//   1. Pip's bedroom (world/stages/bedroom.ts): a cosy lamplit room with the real forest in its window. The things in
//      the room are the controls: a microphone on the sill (sleep tracking), a record player (falling-asleep sounds),
//      the alarm clock on the nightstand, a moon lamp (dim the lights). Little brass tags float over them; tapping one
//      (or its row in the side panel, a bottom sheet on phones) opens its 2D controls.
//   2. "I'm going to bed": Pip puts the phone to bed in its little box and padlocks it, turning the key with his beak.
//   3. He packs: a spin, a puff, and his trail backpack is on.
//   4. He spins the floor globe and the room gives way to the real Earth: choose tonight's place.
//   5. The flight (world/stages/flight.ts): Pip flies over the moonlit forest towards it while you breathe for five
//      minutes. He rises on each in-breath and glides on each out-breath; a quiet question to think about drifts in now
//      and then; the time to arrival counts down. When he lands, the night begins (microphone, alarm, sounds).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { BreathSession, PATTERN, type Phase } from '../breathe/session.ts';
import { AREA, AREAS, type Area } from '../game/catalog.ts';
import { blockStatus, demoTonight, setPhoneLock, setRoutine, startNight, syncReminders, tonight } from '../game/night.ts';
import { DAY_NAME, setNight, toMin } from '../game/routine.ts';
import { areaOpen, dayKey, edit, save } from '../game/store.ts';
import { homeGuess } from '../world/globe/earth.ts';
import { GlobeStage, type GlobePlace, type PinView } from '../world/globe/stage.ts';
import { BedroomStage, type Hot } from '../world/stages/bedroom.ts';
import { FlightStage } from '../world/stages/flight.ts';
import type { OwlLook } from '../owl/model.ts';
import { transition } from './chrome/transition.ts';
import { PLACE_SAT, SHEET, sheetUrl } from './globe/photos.ts';
import { loadThumbs, thumbStyle, thumbsReady } from './globe/placephoto.ts';
import { PLACE_INFO } from '../game/places.ts';
import { Px } from './icons.tsx';
import { fmtDur, fmtHM, haptic, tap, toast, Toggle } from './kit.tsx';
import { ALARMS, SOUNDSCAPES, SoundTiles } from './sleep.tsx';
import { bubble, panel, sceneRef } from './state.ts';
import { fxMoment } from './fx/moment.ts';
import './sleepflow.css';

type Step = 'room' | 'lock' | 'pack' | 'globe' | 'flight' | 'arrive';
type Pane = 'tonight' | 'mic' | 'sound' | 'alarm';

const FLIGHT_MIN = 5;
const home = homeGuess();
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const toHHMM = (m: number) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const isWide = () => innerWidth >= 900 && innerWidth / innerHeight > 1.1;
const tripLook = (l: OwlLook): OwlLook => ({ ...l, outfit: { ...(l.outfit ?? {}), back: 'backpack' } });

/** quiet questions for the flight: one at a time, to think about, not to answer */
const REFLECT: { q: string; sub: string }[] = [
  { q: 'What went well today?', sub: 'Even a small thing counts. Let it come to you.' },
  { q: 'Who made you smile today?', sub: 'Picture their face for a moment.' },
  { q: 'What are you grateful for tonight?', sub: 'A warm drink, a kind word, a quiet minute.' },
  { q: 'Is anything still on your mind?', sub: 'Put it in Pip’s backpack. He’ll carry it until morning.' },
  { q: 'What did you do today that took courage?', sub: 'Give yourself a little credit for it.' },
  { q: 'What would make tomorrow gentle?', sub: 'One small, kind thing is enough.' },
  { q: 'Notice your shoulders, your jaw, your hands.', sub: 'Let each one soften as you breathe out.' },
  { q: 'What did you learn today?', sub: 'About the world, or about yourself.' },
];

function placeOf(a: Area): GlobePlace {
  return { id: a.id, lat: a.lat, lon: a.lon, color: a.color, open: areaOpen(a.id), span: PLACE_INFO[a.id]?.span, sheet: PLACE_SAT[a.id] ? sheetUrl(a.id) : undefined, sat: PLACE_SAT[a.id], satRect: [SHEET.cw, SHEET.ch, SHEET.cw, SHEET.ch] };
}

// ------------------------------------------------------------------ the screen

export function SleepScreen() {
  const sc = sceneRef.current;
  const s = save.value, sp = s.sleep, h12 = s.settings.hour12;
  const plan = tonight();
  const area = AREA[s.area];
  const [step, setStep] = useState<Step>('room');
  const [pane, setPane] = useState<Pane>('tonight');
  const [hover, setHover] = useState<Hot | null>(null);
  const [cap, setCap] = useState<{ text: string; sub?: string; id: number } | null>(null);
  const [wide, setWide] = useState(isWide());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  /** the bedroom is rebuilt when we come back to it (a stage is disposed when another one takes the screen) */
  const [roomKey, setRoomKey] = useState(0);
  const room = useRef<BedroomStage | null>(null);
  const chips = useRef(new Map<Hot, HTMLElement>());
  const stepRef = useRef<Step>('room');
  stepRef.current = step;

  const set = (f: (x: typeof sp) => void) => { edit((x) => f(x.sleep)); syncReminders(); };
  const caption = (text: string, sub?: string) => setCap({ text, sub, id: Date.now() });

  // Pip's speech bubbles belong to the world: none over the bedroom
  useEffect(() => { bubble.value = null; return bubble.subscribe((b) => { if (b) bubble.value = null; }); }, []);
  useEffect(() => { const f = () => setWide(isWide()); addEventListener('resize', f); return () => removeEventListener('resize', f); }, []);

  // ---- the bedroom stage
  useEffect(() => {
    if (!sc) { setReady(true); return undefined; }
    let st: BedroomStage | null = null;
    try { st = new BedroomStage(sc.renderer, save.value.look, sc, sc.quality); } catch (e) { console.warn('bedroom failed', e); setReady(true); return undefined; }
    room.current = st;
    st.resize(innerWidth, innerHeight);
    st.setMic(save.value.sleep.mic);
    st.setSound(save.value.sleep.soundscape !== 'none');
    st.prepareTrip(save.value.look);
    st.onPick = (id) => pickHot(id);
    st.onHover = (id) => setHover(id);
    sc.setStage(st);
    void st.ready.then(() => setReady(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && stepRef.current === 'room') close(); };
    addEventListener('keydown', onKey);
    if (import.meta.env.DEV) (window as unknown as { hhBed: unknown }).hhBed = { stage: st, bed: () => goToBed(), step: (x: Step) => setStep(x) };
    return () => {
      removeEventListener('keydown', onKey);
      if (st && sc.stage === st) sc.setStage(null);
      room.current = null;
    };
  }, [roomKey]);

  // ---- keep the room in step with the controls
  useEffect(() => { room.current?.setMic(sp.mic); }, [sp.mic]);
  useEffect(() => { room.current?.setSound(sp.soundscape !== 'none'); }, [sp.soundscape]);

  // ---- frame the room in the part of the screen the controls leave free
  useEffect(() => {
    const st = room.current;
    if (!st) return;
    if (step !== 'room') st.free = { x0: 0, x1: 1, y0: 0.04, y1: wide ? 0.84 : 0.78 };
    else if (wide) st.free = { x0: 0, x1: 1 - Math.min(420, innerWidth * 0.34) / innerWidth, y0: 0.08, y1: 0.86 };
    else st.free = { x0: 0, x1: 1, y0: 0.06, y1: 0.5 };
    st.refit();
  }, [wide, step, ready]);

  // ---- the floating tags follow their things
  useEffect(() => {
    if (step !== 'room') return undefined;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const st = room.current;
      if (!st) return;
      const a = st.anchors();
      // lay the tags out: each sits over its thing; one that would overlap another climbs above it on a longer stem
      const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
      const order = [...chips.current].filter(([id]) => a[id]).sort((p1, p2) => a[p2[0]].y - a[p1[0]].y);
      for (const [id, el] of order) {
        const p = a[id];
        const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 110, h = 32;
        let lift = 0;
        for (let k = 0; k < 6; k++) {
          const box = { x0: p.x - w / 2 - 4, x1: p.x + w / 2 + 4, y0: p.y - 18 - lift - h, y1: p.y - 18 - lift };
          const hit = placed.find((q) => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0);
          if (!hit) { placed.push(box); break; }
          lift += box.y1 - hit.y0 + 4;
        }
        el.style.opacity = p.on ? '' : '0';
        el.style.setProperty('--lift', `${Math.round(lift)}px`);
        el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  function pickHot(id: Hot) {
    if (stepRef.current !== 'room') return;
    const st = room.current;
    tap('ui_tap', 0.45);
    if (id === 'mic') { setPane('mic'); st?.go('mic'); }
    else if (id === 'sound') { setPane('sound'); st?.go('sound'); }
    else if (id === 'alarm' || id === 'phone') { setPane('alarm'); st?.go('alarm'); }
    else if (id === 'lamp') { const d = !lampDim.current; lampDim.current = d; st?.setDim(d ? 0.55 : 0); sound.play('ui_toggle', { volume: 0.4 }); }
    else if (id === 'window' || id === 'globe' || id === 'bed') { setPane('tonight'); st?.go('room'); if (id === 'bed') st?.owl.play('yawn'); else st?.owl.play('nod'); }
  }
  const lampDim = useRef(false);

  function close() {
    if (busy) return;
    tap('ui_close', 0.5);
    panel.value = null;
  }

  // ---- 2..4: lock, pack, globe
  async function goToBed() {
    const st = room.current;
    if (busy) return;
    setBusy(true);
    sound.unlock();
    haptic(14);
    sound.play('bowl', { volume: 0.4 });
    if (!sc || !st) { await startTheNight(); return; }
    fxMoment('bedtime');
    st.setDim(0.4);
    setStep('lock');
    await wait(80);
    caption('Pip tucks your phone into bed…', 'No more scrolling tonight.');
    await st.playLock();
    lockedRef.current = true;
    const wakeTxt = plan.on ? fmtHM(plan.wake, h12) : 'morning';
    caption(`Locked until ${wakeTxt}.`, blockStatus.value ? 'The bedtime blocker is on guard too.' : 'Pip keeps the key.');
    await wait(1500);
    setStep('pack');
    caption('Packing for the trip…', 'Snacks, a map, and one emergency acorn.');
    await st.playPack(save.value.look);
    caption('Where shall we fly tonight?');
    await st.playGlobe();
    await transition('clouds', () => { setStep('globe'); setCap(null); });
  }

  const started = useRef(false);
  /** the phone was put to bed and padlocked on the way */
  const lockedRef = useRef(false);
  async function startTheNight() {
    if (started.current) return;
    started.current = true;
    setStep('arrive');
    const sc2 = sceneRef.current;
    try { sc2?.placeOwl('away'); } catch { /* */ }
    await startNight({ alarm: true });
    // the padlock was real: the night screen stays locked (and the blocker blocks) until the alarm
    if (lockedRef.current) setPhoneLock(true);
    panel.value = null;
  }

  const onIntoFlight = () => { void transition('dream', () => { setStep('flight'); }); };

  // ---------------------------------------------------------------- render

  if (step === 'globe') return <GlobePick onBack={() => { void transition('clouds', () => { setReady(false); setStep('room'); setBusy(false); setCap(null); setRoomKey((k) => k + 1); }); }} onGo={onIntoFlight} />;
  if (step === 'flight' || step === 'arrive') return <Flight onArrive={() => { void startTheNight(); }} arriving={step === 'arrive'} />;

  const wakeHM = plan.on ? fmtHM(plan.wake, h12) : 'Sleep in';
  const smart = sp.smartMin && sp.alarmOn && plan.on ? fmtHM(toHHMM(toMin(plan.wake) - sp.smartMin), h12) : '';
  const soundName = SOUNDSCAPES.find((o) => o.v === sp.soundscape)?.label ?? 'Silence';
  const panes: { id: Pane; icon: string; title: string; value: string }[] = [
    { id: 'tonight', icon: 'moon', title: 'Tonight', value: `${fmtHM(plan.bed, h12)} – ${wakeHM}` },
    { id: 'mic', icon: 'mic', title: 'Sleep tracking', value: sp.mic ? 'Listening' : 'Off' },
    { id: 'sound', icon: 'music', title: 'Sounds', value: soundName },
    { id: 'alarm', icon: 'bell', title: 'Alarm', value: sp.alarmOn && plan.on ? wakeHM : 'Off' },
  ];
  const tags: { id: Hot; icon: string; label: string; value: string; on: boolean }[] = [
    { id: 'mic', icon: 'mic', label: 'Mic', value: sp.mic ? 'On' : 'Off', on: sp.mic },
    { id: 'sound', icon: 'music', label: 'Sound', value: soundName, on: sp.soundscape !== 'none' },
    { id: 'alarm', icon: 'bell', label: 'Alarm', value: sp.alarmOn && plan.on ? wakeHM : 'Off', on: sp.alarmOn && plan.on },
    { id: 'lamp', icon: 'candle', label: 'Lamp', value: lampDim.current ? 'Dim' : 'On', on: !lampDim.current },
  ];
  const inRoom = step === 'room';

  return (
    <div class={'bd' + (inRoom ? '' : ' cine') + (ready ? ' ready' : '')} role="dialog" aria-label="Bedtime">
      {inRoom && <div class="bd-veil" aria-hidden="true"><i /></div>}
      {/* the brass tags over the things in the room */}
      <div class="bd-tags" aria-hidden={!inRoom}>
        {inRoom && tags.map((t) => (
          <button key={t.id} ref={(el) => { if (el) chips.current.set(t.id, el); else chips.current.delete(t.id); }} class={'bd-tag' + (t.on ? ' on' : '') + (hover === t.id ? ' hover' : '') + ((t.id === 'alarm' && pane === 'alarm') || pane === t.id ? ' sel' : '')} onClick={() => pickHot(t.id)} aria-label={`${t.label}: ${t.value}`}>
            <span class="bd-tag-in"><i class="led" /><b>{t.label}</b><span>{t.value}</span></span>
            <span class="bd-tag-stem" />
          </button>
        ))}
      </div>

      {inRoom && <>
        <header class="bd-top">
          <button class="bd-back" aria-label="Back to the hollow" onClick={close}><Px name="arrow_left" size={30} /></button>
          <div class="bd-title">
            <span class="bd-kicker">{DAY_NAME[plan.day]} night</span>
            <h1>Bedtime</h1>
          </div>
        </header>

        <aside class={'bd-panel' + (wide ? ' bd-side' : ' bd-sheet')}>
          {!wide && <nav class="bd-tabs" role="tablist">
            {panes.map((p) => <button role="tab" aria-selected={pane === p.id} class={'bd-tabbtn' + (pane === p.id ? ' sel' : '')} onClick={() => { tap('ui_tab', 0.4); setPane(p.id); room.current?.go(p.id === 'tonight' ? 'room' : p.id); }}><Px name={p.icon} size={30} /><span>{p.title}</span></button>)}
          </nav>}
          <div class="bd-body">
            {(wide || pane === 'tonight') && <section class={'bd-sec' + (pane === 'tonight' ? ' sel' : '')} onClick={() => wide && setPane('tonight')}>
              {wide && <h2><Px name="moon" size={30} />Tonight</h2>}
              <button class="bd-times" onClick={() => { tap('ui_open', 0.5); panel.value = 'clock'; }} aria-label="Tonight's times: tap to adjust on the Clock">
                <div><small>Bed</small><b class="num">{fmtHM(plan.bed, h12)}</b></div>
                <span class="bd-arc"><i /><em>{fmtDur(plan.min * 60_000)}</em></span>
                <div><small>Wake</small><b class="num">{wakeHM}</b></div>
              </button>
              <p class="bd-line"><Px name="map" size={30} /><span>Pip flies to <b>{area?.name ?? 'the woods'}</b>{smart ? <><br />Smart wake from {smart}</> : null}</span></p>
              {!plan.on && <button class="bd-link" onClick={() => { tap('stamp', 0.5); setRoutine(setNight(s.routine, plan.day, { on: true })); }}>Set an alarm for tonight</button>}
            </section>}

            {(wide || pane === 'mic') && <section class={'bd-sec' + (pane === 'mic' ? ' sel' : '')} onClick={() => wide && pane !== 'mic' && (setPane('mic'), room.current?.go('mic'))}>
              <div class="bd-row">
                {wide && <h2 class="grow"><Px name="mic" size={30} />Sleep tracking</h2>}
                {!wide && <b class="grow">Pip listens while you sleep</b>}
                <Toggle on={sp.mic} onChange={(v) => { set((x) => { x.mic = v; }); sound.play(v ? 'ui_toggle' : 'ui_back', { volume: 0.4 }); }} label="Sleep tracking" />
              </div>
              <p class="bd-note">{import.meta.env.MODE === 'artifact' ? 'Here the night is tracked by time; the microphone works in the full app.' : sp.mic ? 'Snores, sleep talk and tossing, analysed on this device. Nothing is uploaded.' : 'Off: the night is tracked by time only.'}</p>
            </section>}

            {(wide || pane === 'sound') && <section class={'bd-sec' + (pane === 'sound' ? ' sel' : '')} onClick={() => wide && pane !== 'sound' && (setPane('sound'), room.current?.go('sound'))}>
              {wide && <h2><Px name="music" size={30} />Falling-asleep sounds</h2>}
              <SoundTiles cols={4} value={sp.soundscape} options={SOUNDSCAPES} onPick={(v) => set((x) => { x.soundscape = v; })} preview={(v) => { if (v === 'none') return 0; sound.preview(v, 5); return 5000; }} />
              {sp.soundscape !== 'none' && <div class="bd-row bd-seg"><span class="grow">Fade out</span>
                {[[15, '15m'], [30, '30m'], [60, '1h'], [0, 'All night']].map(([v, l]) => <button class={'seg' + (sp.soundscapeMin === v ? ' sel' : '')} onClick={(e) => { e.stopPropagation(); tap('ui_tab', 0.35); set((x) => { x.soundscapeMin = v as number; }); }}>{l}</button>)}
              </div>}
            </section>}

            {(wide || pane === 'alarm') && <section class={'bd-sec' + (pane === 'alarm' ? ' sel' : '')} onClick={() => wide && pane !== 'alarm' && (setPane('alarm'), room.current?.go('alarm'))}>
              <div class="bd-row">
                {wide ? <h2 class="grow"><Px name="bell" size={30} />Alarm</h2> : <b class="grow">Wake me at {wakeHM}</b>}
                <Toggle on={sp.alarmOn} onChange={(v) => set((x) => { x.alarmOn = v; })} label="Alarm" />
              </div>
              {sp.alarmOn && <>
                <SoundTiles cols={4} value={sp.alarmSound} options={ALARMS} onPick={(v) => set((x) => { x.alarmSound = v; })} preview={(v) => { sound.preview(v, 4, 'alarm'); return 4000; }} />
                <div class="bd-row bd-seg"><span class="grow">Smart wake</span>
                  {[[0, 'Exact'], [10, '10m'], [20, '20m'], [30, '30m']].map(([v, l]) => <button class={'seg' + (sp.smartMin === v ? ' sel' : '')} onClick={(e) => { e.stopPropagation(); tap('ui_tab', 0.35); set((x) => { x.smartMin = v as number; }); }}>{l}</button>)}
                </div>
              </>}
            </section>}
          </div>
          {s.nights.length < 2 && <button class="bd-demo" onClick={() => { tap(); demoTonight(); panel.value = null; toast('A pretend night, so you can see the morning.'); }}>Try a pretend night first</button>}
        </aside>

        <footer class="bd-foot">
          <button class="bd-go" onClick={() => void goToBed()} disabled={busy}>
            <span class="bd-go-moon" aria-hidden="true" />
            <span class="bd-go-txt"><b>I’m going to bed</b><small>Lock the phone · pack · fly to {area?.title ?? 'the woods'}</small></span>
          </button>
        </footer>
      </>}

      {cap && !inRoom && <div class="bd-cap" key={cap.id}><b>{cap.text}</b>{cap.sub && <small>{cap.sub}</small>}</div>}
      {!inRoom && <><i class="bd-bar t" /><i class="bd-bar b" /></>}
    </div>
  );
}

// ------------------------------------------------------------------ choosing tonight's place on the real Earth

function GlobePick(p: { onBack: () => void; onGo: () => void }) {
  const sc = sceneRef.current;
  const s = save.value;
  const [sel, setSel] = useState<string>(s.area);
  const [ready, setReady] = useState(false);
  const stageRef = useRef<GlobeStage | null>(null);
  const pinEls = useRef(new Map<string, HTMLElement>());
  const rail = useRef<HTMLDivElement>(null);
  const places = useMemo(() => [...AREAS].sort((a, b) => Number(areaOpen(b.id)) - Number(areaOpen(a.id)) || a.level - b.level), []);
  thumbsReady.value;

  useEffect(() => {
    if (!sc) return undefined;
    let st: GlobeStage | null = null;
    try { st = new GlobeStage(sc.renderer, sc.quality); } catch (e) { console.warn('globe failed', e); return undefined; }
    stageRef.current = st;
    st.setPlaces(AREAS.map(placeOf));
    st.setOwl(tripLook(save.value.look));
    const t = AREA[save.value.area];
    st.lookAt(t ? t.lat * 0.7 + 8 : home.lat * 0.6, t ? t.lon : home.lon);
    if (t) st.setRoute(home, t);
    loadThumbs();
    const postWas = sc.post.enabled;
    sc.post.enabled = false;
    sc.setStage(st);
    st.resize(innerWidth, innerHeight);
    const layout = () => { const w = innerWidth, h = innerHeight, bottom = h - Math.min(250, h * 0.36); st!.setView(w / 2, (78 + bottom) / 2, Math.min(w * 0.42, (bottom - 78) * 0.44)); };
    layout();
    addEventListener('resize', layout);
    st.onFrame = (pins) => placePins(pins);
    st.onReady = () => setReady(true);
    st.onSpin = (v) => { if (v > 25) sound.play('globe_spin', { volume: 0.15, gap: 600 }); };
    sound.play('tp_shimmer', { volume: 0.25 });
    return () => { removeEventListener('resize', layout); if (sc.stage === st) sc.setStage(null); sc.post.enabled = postWas; };
  }, []);

  function placePins(pins: PinView[]) {
    for (const pv of pins) {
      const el = pinEls.current.get(pv.id);
      if (!el) continue;
      if (pv.facing < 0.05) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.opacity = String(Math.min(1, (pv.facing - 0.05) * 6));
      el.style.transform = `translate(${Math.round(pv.x)}px, ${Math.round(pv.y)}px)`;
      el.style.zIndex = String(Math.round((1 - pv.depth) * 500));
    }
  }

  function choose(id: string, from: 'pin' | 'card') {
    const a = AREA[id];
    if (!a) return;
    if (!areaOpen(id)) { tap('ui_error', 0.4); toast(`${a.title} opens at level ${a.level}${a.streak ? ` and a ${a.streak}-night streak` : ''}.`); return; }
    tap('pin_tap', 0.5);
    setSel(id);
    const st = stageRef.current;
    if (st) { st.setRoute(home, a); st.lookAt(a.lat * 0.7 + 6, a.lon); }
    if (from === 'pin') rail.current?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  function go() {
    tap('ui_confirm', 0.6);
    sound.play('owl_wing', { volume: 0.5 });
    edit((x) => { x.area = sel; });
    p.onGo();
  }
  const a = AREA[sel];
  return (
    <div class={'bd bd-globe' + (ready ? ' ready' : '')} role="dialog" aria-label="Choose tonight's place">
      <header class="bd-top">
        <button class="bd-back" aria-label="Back to the bedroom" onClick={() => { tap('ui_back', 0.5); p.onBack(); }}><Px name="arrow_left" size={30} /></button>
        <div class="bd-title"><span class="bd-kicker">Tonight’s flight</span><h1>Where to?</h1></div>
      </header>
      <div class="bd-pins">
        {AREAS.map((x) => {
          const open = areaOpen(x.id);
          return <button key={x.id} ref={(el) => { if (el) pinEls.current.set(x.id, el); }} class={'bd-pin' + (open ? '' : ' locked') + (sel === x.id ? ' sel' : '')} style={{ '--c': x.color } as Record<string, string>} onClick={() => choose(x.id, 'pin')} aria-label={x.title}>
            <i /><span>{x.title.replace(/^The /, '')}</span>
          </button>;
        })}
      </div>
      <div class="bd-rail" ref={rail}>
        {places.map((x) => {
          const open = areaOpen(x.id);
          return (
            <button key={x.id} data-id={x.id} class={'bd-place' + (open ? '' : ' locked') + (sel === x.id ? ' sel' : '')} onClick={() => choose(x.id, 'card')}>
              <span class="ph" style={thumbStyle(x.id, 148)} />
              <span class="tx"><b>{x.title}</b><small>{open ? x.country : `Level ${x.level}${x.streak ? ` · ${x.streak}-night streak` : ''}`}</small></span>
              {!open && <span class="lk"><Px name="lock" size={30} /></span>}
            </button>
          );
        })}
      </div>
      <footer class="bd-foot">
        <button class="bd-go" onClick={go} disabled={!a || !areaOpen(sel)}>
          <span class="bd-go-moon" aria-hidden="true" />
          <span class="bd-go-txt"><b>Fly to {a?.title ?? '…'}</b><small>{a ? `${a.country} · a five-minute breathing flight` : ''}</small></span>
        </button>
      </footer>
    </div>
  );
}

// ------------------------------------------------------------------ the breathing flight

function Flight(p: { onArrive: () => void; arriving: boolean }) {
  const sc = sceneRef.current;
  const s = save.value;
  const a = AREA[s.area];
  const slow = s.profile.latency === 'slow' || s.profile.latency === 'long';
  const pattern = PATTERN[slow ? 'sleep' : 'settle'] ?? PATTERN.settle;
  const [phase, setPhase] = useState<Phase>(pattern.phases[0]);
  const [count, setCount] = useState(0);
  const [left, setLeft] = useState(FLIGHT_MIN * 60);
  const [q, setQ] = useState(0);
  const [done, setDone] = useState(false);
  const ring = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const stage = useRef<FlightStage | null>(null);
  const session = useMemo(() => new BreathSession(pattern, FLIGHT_MIN), []);

  useEffect(() => {
    let st: FlightStage | null = null;
    if (sc) {
      try { st = new FlightStage(sc.renderer, tripLook(save.value.look), sc.quality, Math.floor(Math.random() * 1000)); } catch (e) { console.warn('flight failed', e); }
      if (st) { stage.current = st; st.resize(innerWidth, innerHeight); sc.setStage(st); }
    }
    sound.music('music_breath');
    sound.preload(['breath_in', 'breath_out', 'breath_hold']);
    session.onPhase = (ph) => {
      setPhase(ph);
      sound.play(ph.kind === 'in' ? 'breath_in' : ph.kind === 'out' ? 'breath_out' : 'breath_hold', { volume: 0.32 });
      if (ph.kind === 'in') haptic(6);
    };
    let raf = 0, last = performance.now(), lastLeft = -1, lastCount = -1, finished = false, hx = innerWidth / 2, hy = innerHeight / 2;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const b = session.step(dt);
      stage.current?.setBreath(b.lung);
      if (ring.current) {
        ring.current.style.setProperty('--lung', b.lung.toFixed(3));
        // the halo breathes round Pip, following him gently
        const o = stage.current?.pipScreen();
        if (o && Number.isFinite(o.x)) { hx += (o.x - hx) * Math.min(1, dt * 3); hy += (o.y + 30 - hy) * Math.min(1, dt * 3); ring.current.style.left = `${Math.round(hx)}px`; ring.current.style.top = `${Math.round(hy)}px`; }
      }
      const rem = Math.max(0, Math.ceil(b.total - b.elapsed));
      if (rem !== lastLeft) { lastLeft = rem; setLeft(rem); }
      if (bar.current) bar.current.style.setProperty('--p', String(Math.min(1, b.elapsed / b.total)));
      if (b.left !== lastCount) { lastCount = b.left; setCount(b.left); }
      if (b.done && !finished) { finished = true; setDone(true); sound.play('chime_sweep', { volume: 0.5 }); edit((x) => { x.breath.sessions += 1; x.breath.minutes += FLIGHT_MIN; x.breath.lastDay = dayKey(); }); }
    };
    raf = requestAnimationFrame(loop);
    const qt = setInterval(() => setQ((n) => n + 1), 36000);
    return () => { cancelAnimationFrame(raf); clearInterval(qt); sound.music(null); if (sc && st && sc.stage === st) sc.setStage(null); };
  }, []);

  // if you have dozed off by the time he lands, the night starts by itself
  useEffect(() => { if (!done) return undefined; const id = setTimeout(() => p.onArrive(), 9000); return () => clearTimeout(id); }, [done]);
  const r = REFLECT[q % REFLECT.length];
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
  return (
    <div class={'bd bd-fly' + (done ? ' done' : '')} role="dialog" aria-label="The flight">
      <header class="bd-route">
        <div class="bd-route-in">
          <span class="from"><Px name="treehouse" size={30} />Home</span>
          <span class="track" ref={bar}><i class="fill" /><i class="owl" /></span>
          <span class="to"><Px name="map" size={30} />{a?.title ?? 'The woods'}</span>
        </div>
        <span class="eta">{done ? 'Arriving' : <><b class="num">{mm}:{ss}</b> to {a?.name ?? 'the woods'}</>}</span>
      </header>

      {!done && <div class="bd-breath" ref={ring} aria-live="polite">
        <span class="ring" /><span class="ring r2" />
        <span class="cue"><b>{phase.label}</b><span class="num">{count}</span></span>
      </div>}

      {!done && <div class="bd-think" key={q}>
        <b>{r.q}</b>
        <small>{r.sub}</small>
      </div>}

      {done && <div class="bd-arrive">
        <span class="bd-kicker">You’ve arrived</span>
        <h1>{a?.title ?? 'The woods'}</h1>
        <p>Pip will explore while you sleep, and be home with treasures by morning. The night starts in a moment.</p>
        <button class="bd-go" onClick={() => { tap('ui_confirm', 0.5); p.onArrive(); }} disabled={p.arriving}>
          <span class="bd-go-moon" aria-hidden="true" />
          <span class="bd-go-txt"><b>Goodnight</b><small>Start the night</small></span>
        </button>
      </div>}

      {!done && <button class="bd-skip" onClick={() => { tap('ui_tap', 0.4); p.onArrive(); }}>Skip to sleep</button>}
      <i class="bd-bar t" /><i class="bd-bar b" />
    </div>
  );
}
