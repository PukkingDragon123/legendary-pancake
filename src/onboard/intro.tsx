// The first-run experience: the sleeping-owl splash hands over to Pip's office, where he wakes up, pops on
// his reading glasses and interviews you with a clipboard. His lines float in crisp extruded pixel letters,
// every question is its own little toy on the page (a name tag, trading cards of the owls, a sticker sheet,
// a brass dial, a slider of moons, a sheep-counting game, a phone to put to bed, a sky lever, mugs, cassette
// tapes, a microphone switch), Pip acts your answers out with props, the pencil writes each answer down, pages
// flip over the clip, and the plan gets the rubber stamp before a pixel iris takes you home to unpack.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { syncReminders, requestNotifications } from '../game/night.ts';
import { edit, save } from '../game/store.ts';
import { CSS_TOKENS } from '../gfx/palette.ts';
import type { OwlLook } from '../owl/model.ts';
import { questionTransition, type TransitionKind } from '../ui/chrome/transition.ts';
import { sceneRef, say } from '../ui/state.ts';
import { bootReady, releaseBoot, wakeBoot } from './boot.ts';
import { boardURL, boxURL, buttonFrame, cardFrame, clipURL, plaqueFrame, sheetURL, slotFrame, speckURL, stampToolURL, tagFrame, vignetteURL } from './cbart.ts';
import { Hand, Row, StampInk, tapSound } from './clipboard.tsx';
import { FloatText, type Line } from './floattext.tsx';
import { cutWipe, iris } from './iris.ts';
import { frameCSS, pixelCorners } from './pixart.ts';
import { InterviewRoom } from './room.ts';
import { ALARM_NAME, answersFrom, applyAnswers, fmt, GOALS, OUTRO, planOf, RELAX, SOUND_NAME, STEPS, toMin, type Answers, type Beat, type Step } from './script.ts';
import { VIGNETTES } from './vignettes.ts';
import { Ico, MicSwitch, MoonSlider, MugShelf, NameTag, PhoneSort, SheepGame, SkyLever, SpeciesDeck, StampPress, StickerSheet, TapeRack, WakeDial } from './widgets.tsx';
import './intro.css';

const ARTIFACT = import.meta.env.MODE === 'artifact';
const DEV = import.meta.env.DEV;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Phase = 'boot' | 'wake' | 'talk' | 'ask' | 'write' | 'stamp' | 'outro' | 'done';
/** Some pages arrive with a pixel transition over the clipboard that suits them; the rest flip over the clip. */
const PAGE_FX: Record<string, TransitionKind> = { species: 'feathers', goals: 'mosaic', wake: 'clock', hours: 'stars', latency: 'fireflies', chrono: 'sunrise', relax: 'leaves', plan: 'page' };

let cssDone = false;
function injectCSS() {
  if (cssDone) return;
  cssDone = true;
  const css = CSS_TOKENS.replace(':root', '.ob,.ob-iris') + `
.ob .ob-tap{background:url(${vignetteURL()}) 0 0/100% 100% no-repeat;image-rendering:pixelated}
.obc-clip{background:url(${clipURL()}) 0 0/100% 100% no-repeat}
.ft-who b{${frameCSS(plaqueFrame(), 2)}}
.obc-next{${frameCSS(buttonFrame('moss'), 2)}}
.obc-next:active:not(:disabled){${frameCSS(buttonFrame('moss', true), 2)}}
.obc-next:disabled{${frameCSS(buttonFrame('off'), 2)}}
.wbtn.moss{${frameCSS(buttonFrame('moss'), 2)}}.wbtn.moss:active{${frameCSS(buttonFrame('moss', true), 2)}}
.wbtn.honey{${frameCSS(buttonFrame('honey'), 2)}}.wbtn.honey:active{${frameCSS(buttonFrame('honey', true), 2)}}
.wbtn.linen,.wd-btn{${frameCSS(buttonFrame('linen'), 2)}}.wbtn.linen:active,.wd-btn:active{${frameCSS(buttonFrame('linen', true), 2)}}
.obc-skip{${frameCSS(tagFrame(), 2)}}
.ws-card .ws-front,.wsg-tab,.wp-spot,.wk-lab,.wx-c,.wu-tag{${frameCSS(cardFrame(), 1)}}
.ws-card.on .ws-front,.wsg-tab.on,.wp-spot.on,.wk-lab.on,.wx-c.on,.wu-tag.on{${frameCSS(cardFrame(true), 1)}}
.ws-slot,.wg-board,.wsg-screen,.wp-home{${frameCSS(slotFrame(), 2)}}
.wn-tag{${frameCSS(cardFrame(), 1)}}
.obc-tick{background:url(${boxURL(true)}) 0 0/100% 100% no-repeat}
.ob{--ob-tick:url(${boxURL(true)})}
.obc-ink{-webkit-mask:url(${speckURL()}) 0 0/64px 64px;mask:url(${speckURL()}) 0 0/64px 64px}
.wst-tool{background:url(${stampToolURL()}) 0 0/100% 100% no-repeat}
.obc-board{clip-path:${pixelCorners(4)}}
`;
  const st = document.createElement('style');
  st.id = 'ob-css';
  st.textContent = css;
  document.head.appendChild(st);
}

/** Pip as a given species (species and palette both carry the id, as the owl model expects) */
const lookFor = (species: string): OwlLook => ({ ...save.value.look, skin: 'owl', species, palette: species });
const beatOf = (b: Beat | string | null | undefined): Beat | null => (b == null ? null : typeof b === 'string' ? { text: b } : b);

async function askMic(): Promise<boolean> {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    st.getTracks().forEach((t) => t.stop());
    return true;
  } catch { return false; }
}

/** A faint pencil doodle to fill a quiet corner of a page (never an owl: Pip is always the 3D one). */
function Doodle(p: { kind: string }) {
  const icon = p.kind === 'you' ? 'star' : p.kind === 'name' ? 'moon' : 'pillow';
  const note = p.kind === 'you' ? 'hello!' : p.kind === 'name' ? 'hoo?' : 'zzz';
  return <span class="obc-doodle"><Ico n={icon} k={2} /><small>{note}</small></span>;
}

/** The size of an element, kept up to date (the clipboard's painted textures are made to measure). */
function useBox(ref: { current: HTMLElement | null }, dep: unknown) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const up = () => setS({ w: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) });
    up();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(up) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [dep]);
  return s;
}

export function Intro() {
  const room = useRef<InterviewRoom | null>(null);
  const [a, setA] = useState<Answers>(() => answersFrom(save.value));
  const aRef = useRef(a);
  aRef.current = a;
  const [si, setSi] = useState(0);
  const siRef = useRef(0);
  siRef.current = si;
  const [phase, setPhase] = useState<Phase>('boot');
  const phaseRef = useRef<Phase>('boot');
  phaseRef.current = phase;
  const [line, setLine] = useState<Line | null>(null);
  const [lineDone, setLineDone] = useState(false);
  const [finish, setFinish] = useState(0);
  const [flipFrom, setFlipFrom] = useState<number | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [written, setWritten] = useState<Record<number, string>>({});
  const [stamped, setStamped] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [wide, setWide] = useState(() => innerWidth >= 860 && innerWidth > innerHeight);
  const [fast] = useState(() => DEV && new URLSearchParams(location.search).has('obfast'));
  const [remind, setRemind] = useState(true);
  const beats = useRef<Beat[]>([]);
  const bi = useRef(0);
  const after = useRef<(() => void) | null>(null);
  const lid = useRef(0);
  const sel = useRef<string | null>(null);
  const autoT = useRef(0);
  const wipe = useRef<HTMLCanvasElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLDivElement>(null);
  const hour12 = save.value.settings.hour12;

  // ---------------------------------------------------------------- talking

  const show = (k: number) => {
    const b = beats.current[k], r = room.current;
    if (!b) return;
    clearTimeout(autoT.current);
    setLine({ id: ++lid.current, text: b.text, who: (aRef.current.name || 'Pip').toUpperCase() });
    setLineDone(false);
    if (!r) return;
    if (b.shot) { if (b.cut && !fast) cutWipe(wipe.current); r.go(b.shot, b.cut); }
    if (b.mood) r.pip.setMood(b.mood);
    if (b.act) r.pip.play(b.act);
    if (!r.vigId) r.pip.lookAt = r.camera.position;
  };
  const advance = () => {
    clearTimeout(autoT.current);
    if (bi.current < beats.current.length - 1) { bi.current++; show(bi.current); return; }
    const f = after.current;
    after.current = null;
    f?.();
  };
  const talk = (list: Beat[], then: () => void) => {
    beats.current = list; bi.current = 0; after.current = then;
    setPhase('talk');
    show(0);
  };
  const onLineDone = (id: number) => {
    if (id !== lid.current) return;
    setLineDone(true);
    const last = bi.current >= beats.current.length - 1;
    const txt = beats.current[bi.current]?.text ?? '';
    if (phaseRef.current !== 'talk' && phaseRef.current !== 'outro') return;
    // keep the story moving: the question brings the clipboard up by itself
    autoT.current = window.setTimeout(advance, last ? 380 : 1500 + txt.length * 24);
  };

  // ---------------------------------------------------------------- steps

  const enterAsk = (i: number) => {
    const st = STEPS[i], r = room.current;
    setPhase('ask');
    sound.play('wood_knock', { volume: 0.25, rate: 1.3 });
    if (!r) return;
    r.go(st.shot);
    const x = aRef.current;
    if (st.kind === 'dial') { r.ticking = true; r.clockAt = toMin(x.wake); r.window(toMin(x.wake) / 60); }
    if (st.kind === 'hours') { r.setVignette('hours:tower', VIGNETTES['hours:tower']); r.param(x.hours); }
    if (st.kind === 'plan') { r.props3({ board: true }); r.go('pip'); }
  };
  const leaveAsk = (i: number) => {
    const st = STEPS[i], r = room.current;
    if (!r) return;
    r.ticking = false; r.clockAt = null; r.window(null);
    r.setVignette(null);
    sel.current = null;
    if (st.vignettes && r.pipSpot !== 'desk') r.pipTo('desk');
  };
  const startStep = (i: number, react: Beat | null) => {
    const st = STEPS[i];
    const list = [...(react ? [react] : []), ...st.say(aRef.current, { artifact: ARTIFACT }).map((b) => beatOf(b)!)];
    talk(list, () => enterAsk(i));
  };

  const vig = (id: string | null) => {
    const r = room.current;
    if (!r) return;
    if (!id) { r.setVignette(null); return; }
    const make = VIGNETTES[id];
    if (make) r.setVignette(id, make);
  };
  const peek = (st: Step, v: string | null) => {
    if (st.kind === 'species') { if (v) room.current?.setLook(lookFor(v)); else room.current?.setLook(lookFor(aRef.current.species), false); return; }
    if (!st.vignettes) return;
    vig(v ? `${st.id}:${v}` : sel.current);
  };
  const pick = (st: Step, v: string) => {
    const f = st.field!, r = room.current;
    setPicked((p) => ({ ...p, [st.id]: true }));
    if (st.kind === 'species') {
      setA((x) => ({ ...x, species: v }));
      r?.setLook(lookFor(v));
      r?.pip.play('hop');
      return;
    }
    if (st.kind === 'multi') {
      const cur = aRef.current[f] as string[];
      const on = !cur.includes(v);
      setA((x) => ({ ...x, [f]: on ? [...cur, v] : cur.filter((q) => q !== v) }));
      if (on) { sel.current = `${st.id}:${v}`; vig(sel.current); r?.pip.play('nod'); }
      else if (sel.current === `${st.id}:${v}`) { sel.current = null; vig(null); }
      return;
    }
    setA((x) => ({ ...x, [f]: st.id === 'mic' ? v === 'yes' : v }));
    sel.current = `${st.id}:${v}`;
    vig(sel.current);
  };

  const next = async () => {
    if (phaseRef.current !== 'ask') return;
    const i = siRef.current, st = STEPS[i];
    if (st.kind === 'plan') { approve(); return; }
    tapSound('ui_confirm', 0.5);
    let x = aRef.current;
    if (st.id === 'mic' && x.mic && !ARTIFACT) {
      const ok = await askMic();
      if (!ok) { x = { ...x, mic: false }; setA(x); }
    }
    setPhase('write');
    leaveAsk(i);
    const text = st.written?.(x) ?? (st.kind === 'dial' ? fmt(x.wake, hour12) : st.kind === 'hours' ? `${x.hours} hours` : st.opts?.find((o) => o.v === String(st.id === 'mic' ? (x.mic ? 'yes' : 'no') : x[st.field!]))?.label ?? '');
    setWritten((w) => ({ ...w, [i]: text }));
    room.current?.pip.play('peck');
  };
  const holdWrite = useRef(false);
  const afterWrite = () => {
    if (phaseRef.current !== 'write' || holdWrite.current) return;
    const i = siRef.current, st = STEPS[i];
    const react = beatOf(st.react?.(aRef.current));
    const fx = fast ? undefined : PAGE_FX[STEPS[i + 1]?.id ?? ''];
    const el = board.current;
    if (fx && el) {
      // a pixel transition sweeps over the clipboard and the new page is under it
      void questionTransition(() => { setSi(i + 1); }, { rect: el.getBoundingClientRect(), kind: fx, speed: 1.8 });
      window.setTimeout(() => { if (phaseRef.current === 'write') startStep(i + 1, react); }, 700);
      return;
    }
    sound.play('paper_flip', { volume: 0.55 });
    setFlipFrom(i);
    setSi(i + 1);
    // the page flips over the clip, the clip snaps shut, then the board dips while Pip reacts
    window.setTimeout(() => { setFlipFrom(null); sound.play('wood_knock', { volume: 0.35, rate: 1.1 }); }, 760);
    window.setTimeout(() => { if (phaseRef.current === 'write') startStep(i + 1, react); }, fast ? 0 : 620);
  };

  const approve = () => {
    if (phaseRef.current !== 'ask') return;
    const r = room.current;
    setPhase('stamp');
    r?.pip.play('peck');
    r?.go('close');
    if (remind && !ARTIFACT) void requestNotifications();
  };
  const onStamp = () => {
    setStamped(true);
    const r = room.current;
    if (r) { r.pip.setMood('joy', 2); r.sparkle(r.pip.headWorld, 10); r.fx.burst('stars', r.pip.headWorld.x, r.pip.headWorld.y, r.pip.headWorld.z, 8); }
    sound.play('reward_quest', { volume: 0.5 });
    window.setTimeout(() => {
      setPhase('outro');
      sound.play('wings_flutter', { volume: 0.45 });
      talk(OUTRO, () => void finishAll());
      setPhase('outro');
    }, 1400);
  };

  const finishAll = async (skipped = false) => {
    if (phaseRef.current === 'done') return;
    setPhase('done');
    phaseRef.current = 'done';
    clearTimeout(autoT.current);
    const r = room.current, sc = sceneRef.current;
    const x = aRef.current;
    await iris(() => (r ? r.headScreen() : { x: innerWidth / 2, y: innerHeight / 2 }), async () => {
      r?.setVignette(null);
      edit((s) => applyAnswers(s, x));
      syncReminders();
      if (sc && sc.stage === r) { sc.setStage(null); sc.setView('home'); sc.snapCamera(); }
      room.current = null;
      releaseBoot();
    });
    const sc2 = sceneRef.current;
    sc2?.owl.play(skipped ? 'wave' : 'present');
    say(skipped ? `Welcome home! Let's unpack!` : `Let's unpack! Tap the boxes, ${x.you.trim() || 'friend'}!`, 4200);
    window.dispatchEvent(new CustomEvent('hh:intro-done', { detail: { skipped } }));
  };
  const skip = () => {
    tapSound('ui_confirm');
    room.current?.setVignette(null);
    setSkipOpen(false);
    void finishAll(true);
  };

  // ---------------------------------------------------------------- mount: build the office, wait for the tap

  useEffect(() => {
    injectCSS();
    const sc = sceneRef.current;
    let r: InterviewRoom | null = null;
    try { if (sc) r = new InterviewRoom(lookFor(aRef.current.species), sc.quality); } catch (e) { console.error('interview room failed', e); }
    if (!sc || !r) { releaseBoot(); return undefined; }
    room.current = r;
    sc.setStage(r);
    r.setNameplate(aRef.current.name || 'Pip');
    r.pip.pose = 'sleep';
    r.cut('close');
    for (let i = 0; i < 30; i++) r.update(1 / 30, 0);
    const q = new URLSearchParams(location.search);
    const devStep = DEV ? q.get('ob') : null;
    (window as unknown as { hhIntro: unknown }).hhIntro = { room: r, a: () => aRef.current, next: () => void next(), flip: () => { holdWrite.current = false; afterWrite(); }, approve: () => approve() };
    let alive = true;
    (async () => {
      if (devStep) {
        releaseBoot();
        // screenshots (?obfast): skip the splash's exit animation
        if (fast) { const bt = document.getElementById('boot'); if (bt) bt.style.display = 'none'; }
        const i = Math.max(0, STEPS.findIndex((s) => s.id === devStep));
        r.pip.pose = 'stand';
        setSi(i); siRef.current = i;
        const selv = q.get('obsel');
        if (selv) {
          const st = STEPS[i], f = st.field;
          if (f) setA((x) => { const v = st.kind === 'multi' ? selv.split(',') : st.kind === 'hours' ? Number(selv) : f === 'mic' ? selv === 'yes' : selv; const y = { ...x, [f]: v }; aRef.current = y; return y; });
          setPicked((p) => ({ ...p, [st.id]: true }));
          if (st.kind === 'species') r.setLook(lookFor(selv), false);
        }
        if (q.has('obtalk')) {
          const list = q.get('obline') ? [{ text: q.get('obline')!, shot: STEPS[i].shot }] : STEPS[i].say(aRef.current, { artifact: ARTIFACT }).map((b) => beatOf(b)!);
          talk(list, () => enterAsk(i));
          r.cut(list[0].shot ?? STEPS[i].shot);
          return;
        }
        if (q.get('obline')) { beats.current = [{ text: q.get('obline')! }]; show(0); }
        enterAsk(i);
        r.cut(STEPS[i].shot);
        const v = q.get('obvig');
        if (v) { sel.current = v; vig(v); }
        if (q.has('obwrite')) { holdWrite.current = true; setPhase('write'); setWritten((w) => ({ ...w, [i]: STEPS[i].written?.(aRef.current) ?? q.get('obwrite') ?? '' })); }
        if (q.has('obstamp')) window.setTimeout(() => { approve(); }, 400);
        return;
      }
      await bootReady();
      if (!alive) return;
      setPhase('wake');
      void wakeBoot();
      await wait(1100);
      if (!alive) return;
      // Pip wakes up with a start, a stretch and an enormous yawn
      r.pip.pose = 'stand';
      r.pip.setMood('surprised', 1.0);
      r.pip.play('stretch');
      sound.play('yawn', { volume: 0.5 });
      await wait(1500);
      if (!alive) return;
      r.pip.play('yawn');
      startStep(0, null);
    })();
    const onResize = () => setWide(innerWidth >= 860 && innerWidth > innerHeight);
    addEventListener('resize', onResize);
    // space / enter moves the conversation on (unless you're typing)
    const onKey = (e: KeyboardEvent) => { if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); tapRef.current(); } };
    addEventListener('keydown', onKey);
    return () => {
      alive = false;
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKey);
      clearTimeout(autoT.current);
      const rr = room.current;
      if (rr) { rr.setVignette(null); if (sc.stage === rr) sc.setStage(null); }
      releaseBoot();
    };
  }, []);

  // frame the 3D shot around the clipboard
  useEffect(() => {
    const r = room.current;
    if (!r) return;
    const up = phase === 'ask' || phase === 'write' || phase === 'stamp';
    const brd = up || phase === 'talk';
    r.frame = wide ? { x: brd ? 0.17 : 0, y: 0 } : { x: 0, y: up ? 0.27 : phase === 'talk' ? 0.12 : 0.05 };
  }, [phase, wide, room.current]);

  // live answers into the room
  useEffect(() => { room.current?.setNameplate(a.name.trim() || 'Pip'); }, [a.name]);
  useEffect(() => { const r = room.current; if (r && STEPS[si]?.kind === 'dial' && phase === 'ask') { r.clockAt = toMin(a.wake); r.window(toMin(a.wake) / 60); } }, [a.wake]);
  useEffect(() => { if (STEPS[si]?.kind === 'hours' && phase === 'ask') room.current?.param(a.hours); }, [a.hours]);

  // the beak flaps while the text talks
  const onTalk = () => room.current?.talk();

  const onTap = () => {
    if (phase === 'boot' || phase === 'wake' || phase === 'done') return;
    if (!lineDone) { setFinish((f) => f + 1); return; }
    if (phase === 'talk' || phase === 'outro') { tapSound('ui_tap', 0.25); advance(); return; }
    if (phase === 'ask') room.current?.pip.poke();
  };

  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  const st = STEPS[si];
  const plan = useMemo(() => planOf(a), [a]);
  const canNext = !st || st.kind !== 'choice' || !!picked[st.id] || !!written[si];
  const showBoard = phase !== 'boot' && phase !== 'wake' && phase !== 'done';
  const bsz = useBox(board, showBoard);
  const psz = useBox(paper, showBoard);

  const pageOf = (i: number, live: boolean) => {
    const s = STEPS[i];
    if (!s) return null;
    return (
      <div class={'obc-page' + (live ? '' : ' out') + ' pg-' + s.id} key={'pg' + i} style={psz.w ? `background-image:url(${sheetURL(psz.w, psz.h, 3 + i)})` : ''}>
        <div class="obc-head">
          <span class="obc-no">No. {String(i + 1).padStart(2, '0')}<small>/{STEPS.length}</small></span>
          <span class="obc-prog">{STEPS.map((_, k) => <i key={k} class={k < i ? 'done' : k === i ? 'now' : ''} />)}</span>
        </div>
        <h2 class="obc-title">{s.title}</h2>
        <div class="obc-body">{body(s, i, live)}</div>
        {s.kind === 'text' && <Doodle kind={s.id} />}
        {s.kind !== 'plan' && (
          <div class="obc-foot">
            <span class={'obc-ans' + ((written[i]?.length ?? 0) > 40 ? ' longer' : (written[i]?.length ?? 0) > 22 ? ' long' : '')}><small>Answer:</small>{written[i] && <Hand key={written[i]} text={written[i]} fast={!live || fast} onDone={live ? afterWrite : undefined} />}</span>
            {live && <button type="button" class="obc-next" disabled={phase !== 'ask' || !canNext} onClick={() => void next()}>{canNext ? 'Next' : 'Pick one'}<i class="obc-arrow" /></button>}
          </div>
        )}
        {s.kind === 'plan' && live && (
          <div class="obc-foot plan">
            <label class="obc-check" onClick={() => { setRemind(!remind); tapSound('ui_toggle', 0.4); }}><img src={boxURL(remind)} alt="" />Remind me to wind down</label>
            <StampPress disabled={phase !== 'ask'} onStamp={approve} />
          </div>
        )}
        {s.kind === 'plan' && (phase === 'stamp' || stamped) && live && <StampInk onHit={onStamp} />}
      </div>
    );
  };

  const body = (s: Step, i: number, live: boolean) => {
    const set = <K extends keyof Answers>(k: K, v: Answers[K]) => { setA((x) => ({ ...x, [k]: v })); setPicked((p) => ({ ...p, [s.id]: true })); };
    const interactive = live && phase === 'ask';
    const onPick = (v: string) => interactive && pick(s, v);
    const onPeek = (v: string | null) => interactive && peek(s, v);
    const chosen = (f: keyof Answers) => (picked[s.id] || written[i] ? String(a[f]) : null);
    switch (s.id) {
      case 'you': case 'name': {
        const k = s.field as 'you' | 'name';
        return (
          <NameTag kind={k} value={a[k]} placeholder={k === 'you' ? 'write here...' : 'Pip'} disabled={!interactive} chips={k === 'name' ? ['Pip', 'Hoot', 'Mochi', 'Biscuit', 'Luna', 'Juniper'] : undefined}
            onInput={(v) => { set(k, v); room.current?.pip.play('peck'); }} onEnter={() => void next()}
            onChip={(n) => { set('name', n); room.current?.sparkle(room.current.pip.headWorld, 4); }} />
        );
      }
      case 'species': return <SpeciesDeck opts={s.opts!} value={a.species} look={(id) => ({ ...lookFor(id), outfit: {} })} onPick={(v) => { if (interactive) pick(s, v); }} onPeek={(v) => { if (interactive) peek(s, v); }} interactive={interactive} />;
      case 'goals': return <StickerSheet opts={GOALS} value={a.goals} onToggle={(v) => { if (interactive) pick(s, v); }} onPeek={(v) => { if (interactive) peek(s, v); }} interactive={interactive} />;
      case 'wake': return <WakeDial value={a.wake} hour12={hour12} interactive={interactive} onChange={(v) => interactive && set('wake', v)} />;
      case 'hours': return <MoonSlider value={a.hours} interactive={interactive} onChange={(v) => interactive && set('hours', v)} />;
      case 'latency': return <SheepGame value={chosen('latency')} onPick={(v) => { onPick(v); }} onPeek={(v) => { onPeek(v); }} interactive={interactive} />;
      case 'phone': return <PhoneSort value={chosen('phone')} onPick={(v) => { onPick(v); }} onPeek={(v) => { onPeek(v); }} interactive={interactive} />;
      case 'chrono': return <SkyLever value={chosen('chrono')} onPick={(v) => { onPick(v); }} onPeek={(v) => { onPeek(v); }} interactive={interactive} />;
      case 'caffeine': return <MugShelf value={chosen('caffeine')} onPick={(v) => { onPick(v); }} onPeek={(v) => { onPeek(v); }} interactive={interactive} />;
      case 'relax': return <TapeRack opts={RELAX} value={a.relax} onToggle={(v) => { if (interactive) pick(s, v); }} onPeek={(v) => { if (interactive) peek(s, v); }} interactive={interactive} />;
      case 'mic': return (
        <MicSwitch value={picked.mic || written[i] ? a.mic : null} onPick={(v) => { onPick(v); }} onPeek={(v) => { onPeek(v); }} interactive={interactive}
          note={`Pip listens on this device only. ${ARTIFACT ? 'This preview can’t use the microphone; the full app can.' : 'You can change it any time in Settings.'}`} />
      );
      case 'plan': {
        const d = (k: number) => (fast ? 0 : 300 + k * 650);
        return (
          <div class="obc-plan">
            <Row icon="moon" label="Bedtime"><Hand text={fmt(plan.bed, hour12)} delay={d(0)} fast={!live || fast} /></Row>
            <Row icon="candle" label="Wind down"><Hand text={`${fmt(plan.windDown, hour12)}`} delay={d(1)} fast={!live || fast} /></Row>
            <Row icon="alarm" label="Wake up"><Hand text={`${fmt(plan.wake, hour12)}`} delay={d(2)} fast={!live || fast} /></Row>
            <Row icon="note" label="Alarm"><Hand text={ALARM_NAME[plan.alarm] ?? 'Music box'} delay={d(3)} fast={!live || fast} /></Row>
            <Row icon={RELAX.find((r) => r.sound === plan.soundscape)?.art ?? 'rain'} label="Sleep sound"><Hand text={SOUND_NAME[plan.soundscape] ?? 'rain'} delay={d(4)} fast={!live || fast} /></Row>
            {plan.blocker && <Row icon="shield" label="Bedtime Blocker"><Hand text={a.phone === 'nightly' ? 'On' : 'Ready'} delay={d(5)} fast={!live || fast} /></Row>}
            {plan.tips.length > 0 && <div class="obc-tips">{plan.tips.map((t, k) => <span key={t} class="obc-tip"><Hand text={'~ ' + t} delay={d(6 + k)} fast={!live || fast} /></span>)}</div>}
          </div>
        );
      }
    }
    return null;
  };

  return (
    <div class={'ob' + (wide ? ' wide' : '') + (fast ? ' ob-fast' : '') + (st ? ' at-' + st.id : '')} data-phase={phase}>
      <canvas class="ob-wipe" ref={wipe} />
      <div class="ob-tap" onPointerDown={onTap} />
      <div class="ob-ft">
        <FloatText line={phase === 'boot' || phase === 'wake' ? null : line} onTalk={onTalk} done={onLineDone} finish={finish} fast={fast} low={sceneRef.current?.quality === 'low'} />
      </div>
      {showBoard && (
        <div class={'obc' + (flipFrom !== null ? ' lift' : '') + (phase === 'outro' ? ' fly' : '')} onAnimationEnd={(e) => { if ((e as AnimationEvent).animationName === 'obc-thud') (e.currentTarget as HTMLElement).classList.remove('thud'); }}>
          <div class="obc-board" ref={board} style={bsz.w ? `background-image:url(${boardURL(bsz.w, bsz.h)})` : ''} />
          <div class="obc-paper" ref={paper}>
            <div class="obc-under u2" style={psz.w ? `background-image:url(${sheetURL(psz.w, psz.h, 9)})` : ''} />
            <div class="obc-under" style={psz.w ? `background-image:url(${sheetURL(psz.w, psz.h, 7)})` : ''} />
            {pageOf(si, true)}
            {flipFrom !== null && pageOf(flipFrom, false)}
          </div>
          <div class="obc-clip" />
          {STEPS[si]?.kind !== 'plan' && (
            <div class={'obc-skip' + (skipOpen ? ' open' : '')}>
              {!skipOpen ? <button type="button" onClick={() => { setSkipOpen(true); tapSound('paper_flip', 0.4); }}>Skip<small>been here before?</small></button>
                : <span>Skip it? Pip picks cozy defaults.<span class="obc-skip-row"><button type="button" onClick={skip}>Yes</button><button type="button" onClick={() => { setSkipOpen(false); tapSound('ui_back', 0.4); }}>No</button></span></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
