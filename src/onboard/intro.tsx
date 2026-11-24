// The first-run experience, all in 3D: the loading clock dives into its dial, the camera pulls back out of the very
// same clock on the wall of Hollow & Co.'s executive office (lamps coming up, dust in the light through the blinds),
// and Pip, Head of Sleep, looks up from his paperwork. His words float in the room. Each question is a printed form
// that slides out of the in-tray onto the desk: you tick boxes with the fountain pen, write your name by hand, turn
// the brass desk clock, slide the brass marker; Pip acts your answers out in little dioramas; every page gets the
// rubber stamp and goes into the client folder; the last page is a sleep-plan agreement you sign and Pip approves.
// The answers land in the save exactly as before (script.ts). The DOM holds only a hidden input for typing.
import { useEffect, useRef } from 'preact/hooks';
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import { syncReminders, requestNotifications } from '../game/night.ts';
import { edit, save } from '../game/store.ts';
import type { OwlLook } from '../owl/model.ts';
import { owlIconAsync } from '../ui/portraits.ts';
import { sceneRef, say } from '../ui/state.ts';
import { bootDial, bootReady, bootShowing, releaseBoot, wakeBoot } from './boot.ts';
import { dioramas } from './dioramas.ts';
import { printForm, syncForm, type FormCtx } from './forms.ts';
import { iris } from './iris.ts';
import { Office, type ShotName, type WorldView } from './office.ts';
import { preload, preloadIcons, type Region } from './paper.ts';
import { Desk } from './quiz.ts';
import { answersFrom, applyAnswers, GOALS, hm, OUTRO, planOf, RELAX, STEPS, toMin, type Answers, type Beat, type Step } from './script.ts';
import { Speech } from './speech.ts';

const ARTIFACT = import.meta.env.MODE === 'artifact';
const DEV = import.meta.env.DEV;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const play = (id: string, volume = 0.5, rate = 1) => { try { sound.play(id, { volume, rate, gap: 40 }); } catch { /* */ } };
type Phase = 'boot' | 'open' | 'talk' | 'ask' | 'file' | 'outro' | 'done';

/** Pip as a given species (species and palette both carry the id, as the owl model expects) */
const lookFor = (species: string): OwlLook => ({ ...save.value.look, skin: 'owl', species, palette: species });
const beatOf = (b: Beat | string | null | undefined): Beat | null => (b == null ? null : typeof b === 'string' ? { text: b } : b);
const ICONS = ['bed', 'sheep', 'sunrise', 'clock', 'phonedrawer', 'mic', 'rain', 'waves', 'forest', 'fire', 'stream', 'wind', 'radio', 'lullaby', 'cricket', 'breath', 'book', 'milkglass', 'mugsun', 'mugmoon', 'drawer', 'nightstand', 'pillowbed', 'sun', 'moon', 'star', 'pillow'];
/** script shot names -> the office's shots */
const SHOT: Partial<Record<ShotName, ShotName>> = { board: 'pipR', floor: 'tray', bed: 'tray', tower: 'tray', clockwin: 'window' };

async function askMic(): Promise<boolean> {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    st.getTracks().forEach((t) => t.stop());
    return true;
  } catch { return false; }
}

export function Intro() {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) { releaseBoot(); return undefined; }
    const q = DEV ? new URLSearchParams(location.search) : new URLSearchParams();
    const fast = DEV && q.has('obfast');
    const hour12 = save.value.settings.hour12;
    let alive = true;
    let a: Answers = answersFrom(save.value);
    let si = 0, phase: Phase = 'boot';
    const picked: Record<string, boolean> = {};
    let remind = true, signed = false;
    const photos: Record<string, string> = {};
    let photosIn: Promise<unknown> = Promise.resolve();

    // ---- the office, the desk work, Pip's words
    let office: Office;
    try {
      const world = typeof (sc as unknown as WorldView).renderView === 'function' ? (sc as unknown as WorldView) : null;
      office = new Office(lookFor(a.species), sc.renderer, sc.quality, world);
    } catch (e) { console.error('interview office failed', e); releaseBoot(); return undefined; }
    const postWas = sc.post.enabled;
    sc.post.enabled = false; // the office draws its own HD-2D picture (look.ts)
    sc.setStage(office);
    const speech = new Speech();
    speech.px = office.look.px;
    office.look.overlay.add(speech.group);
    office.tickers.add((dt) => { speech.px = office.look.px; speech.update(dt, office.camera); });
    speech.onTalk = () => office.talk();
    const dio = dioramas(office);
    office.pip.pose = 'stand';
    office.setNameplate(a.name || 'Pip');

    const ctx = (): FormCtx => ({ a, hour12, artifact: ARTIFACT, plan: planOf(a), photos, remind, signed, picked });
    const st = () => STEPS[si];

    // ---------------------------------------------------------------- talking
    let beats: Beat[] = [], bi = 0, after: (() => void) | null = null, autoT = 0;
    const show = (k: number) => {
      const b = beats[k];
      if (!b) return;
      clearTimeout(autoT);
      speech.say(b.text, `${(a.name.trim() || 'Pip').toUpperCase()} · HEAD OF SLEEP`, fast);
      if (b.shot) office.go(SHOT[b.shot] ?? b.shot, b.cut);
      if (b.mood) office.pip.setMood(b.mood);
      if (b.act) office.pip.play(b.act);
      office.pip.lookAt = office.camera.position;
    };
    const advance = () => {
      clearTimeout(autoT);
      if (bi < beats.length - 1) { bi++; show(bi); return; }
      const f = after; after = null; f?.();
    };
    const talk = (list: Beat[], then: () => void) => { beats = list; bi = 0; after = then; phase = phase === 'outro' ? 'outro' : 'talk'; if (desk) desk.enabled = false; show(0); };
    speech.onDone = () => {
      if (phase !== 'talk' && phase !== 'outro') return;
      const last = bi >= beats.length - 1, txt = beats[bi]?.text ?? '';
      autoT = window.setTimeout(advance, fast ? 30 : last ? 700 : 1500 + txt.length * 26);
    };

    // ---------------------------------------------------------------- the desk (made once the office is built)
    let desk!: Desk;
    const makeDesk = () => new Desk(office, {
      region: (r) => onRegion(r),
      hours: (v) => { if (st().kind !== 'hours' || phase !== 'ask') return; if (v !== a.hours) { a = { ...a, hours: v }; play('tick_brass', 0.3, 0.8 + (v - 5) * 0.08); dio.param(v); } desk.hoursValue = v; refresh(); },
      clock: (min12) => {
        if (st().kind !== 'dial' || phase !== 'ask') return;
        const pm = toMin(a.wake) >= 720, v = hm(min12 + (pm ? 720 : 0));
        if (v !== a.wake) { a = { ...a, wake: v }; play('tick_brass', 0.3, 1.1 + Math.random() * 0.2); onWake(); }
      },
      file: () => void file(),
      skip: () => void finishAll(true),
      tap: () => onTap(),
    });
    const refresh = (instant = false) => { const p = desk?.page; if (p) { syncForm(p.form, st(), ctx(), instant); } };
    const onWake = () => {
      const m = toMin(a.wake);
      office.deskClock.set(m);
      office.window(m / 60);
      refresh();
    };
    const canFile = () => { const s = st(); return s.kind !== 'choice' || !!picked[s.id]; };
    const updateReady = () => desk?.setReady(phase === 'ask' && canFile() && (st().kind !== 'plan' || signed));

    const onRegion = (r: Region) => {
      if (phase !== 'ask') return;
      const s = st();
      if (r.kind === 'field') { focusInput(); return; }
      if (r.kind === 'minus' || r.kind === 'plus') { a = { ...a, wake: hm(toMin(a.wake) + (r.kind === 'plus' ? 15 : -15)) }; play('tick_paper', 0.4); onWake(); return; }
      if (r.kind === 'ampm') { const m = toMin(a.wake) % 720; a = { ...a, wake: hm(m + (r.v === 'pm' ? 720 : 0)) }; play('pencil', 0.35); onWake(); return; }
      if (r.kind === 'remind') { remind = !remind; play('pencil', 0.35); refresh(); return; }
      if (r.kind === 'sign') {
        if (signed) return;
        signed = true; play('scribble', 0.5);
        refresh();
        office.pip.play('nod');
        window.setTimeout(updateReady, 1200);
        return;
      }
      if (r.kind === 'card' && r.v) {
        if (a.species !== r.v) { a = { ...a, species: r.v }; office.setLook(lookFor(r.v)); play('paper_flip', 0.35); }
        picked[s.id] = true; refresh(); updateReady();
        return;
      }
      if (r.kind === 'tick' && r.v !== undefined) {
        const v = r.v;
        if (s.kind === 'text' && s.field === 'name') { a = { ...a, name: v }; office.setNameplate(v); office.sparkle(office.head, 4); if (input.current) input.current.value = v; }
        else if (s.kind === 'multi') {
          const f = s.field as 'goals' | 'relax', cur = a[f], on = !cur.includes(v);
          a = { ...a, [f]: on ? [...cur, v] : cur.filter((x) => x !== v) };
          if (on) { dio.show(`${s.id}:${v}`); office.pip.play('nod'); } else dio.show(null);
        } else if (s.kind === 'choice') {
          a = { ...a, [s.field!]: s.id === 'mic' ? v === 'yes' : v } as Answers;
          picked[s.id] = true;
          dio.show(`${s.id}:${v}`);
        }
        play('pencil', 0.4, 0.9 + Math.random() * 0.2);
        refresh(); updateReady();
      }
    };

    // ---------------------------------------------------------------- typing (a hidden input; the pen writes)
    const focusInput = () => {
      const el = input.current, s = st();
      if (!el || s.kind !== 'text') return;
      el.value = a[s.field as 'you' | 'name'];
      el.focus({ preventScroll: true });
      const up = () => { el.focus({ preventScroll: true }); removeEventListener('pointerup', up); };
      addEventListener('pointerup', up);
    };
    const onInput = () => {
      const el = input.current, s = st();
      if (!el || s.kind !== 'text' || phase !== 'ask') return;
      const v = el.value.slice(0, 16);
      a = { ...a, [s.field as 'you' | 'name']: v };
      if (s.field === 'name') office.setNameplate(v.trim() || 'Pip');
      play('scribble', 0.22, 0.9 + Math.random() * 0.4);
      refresh();
    };
    const onInputKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); void file(); } };
    input.current?.addEventListener('input', onInput);
    input.current?.addEventListener('keydown', onInputKey);

    // ---------------------------------------------------------------- steps
    const enterAsk = async (i: number) => {
      const s = STEPS[i];
      phase = 'ask';
      speech.say(null);
      office.go(s.kind === 'dial' ? 'formClock' : 'form', false, 2.4);
      if (s.kind === 'species') await Promise.race([photosIn, wait(7000)]);
      const form = printForm(s, i, STEPS.length, ctx());
      desk.setRider(s.kind === 'hours');
      if (s.kind === 'hours') { desk.hoursValue = a.hours; dio.show('hours:tower'); dio.param(a.hours); }
      if (s.kind === 'dial') { office.deskClock.set(toMin(a.wake)); office.window(toMin(a.wake) / 60); }
      await desk.present(form, { sticky: s.kind !== 'plan' });
      if (!alive) return;
      desk.enabled = true;
      office.pip.lookAt = desk.page ? desk.texelWorld(180, 240) : null;
      office.pip.setMood('curious');
      updateReady();
    };
    const startStep = (i: number, react: Beat | null) => {
      si = i;
      const list = [...(react ? [react] : []), ...STEPS[i].say(a, { artifact: ARTIFACT }).map((b) => beatOf(b)!)];
      talk(list, () => void enterAsk(i));
    };
    const file = async () => {
      if (phase !== 'ask' || !canFile()) return;
      const s = st();
      if (s.kind === 'plan') { if (signed) void approve(); return; }
      let x = a;
      if (s.id === 'mic' && x.mic && !ARTIFACT) { const ok = await askMic(); if (!ok) { x = { ...x, mic: false }; a = x; refresh(); } }
      phase = 'file';
      desk.enabled = false;
      input.current?.blur();
      office.go('stamp', false, 2.6);
      await desk.stampAndFile('RECEIVED', `page ${si + 1}`);
      if (!alive) return;
      dio.show(null);
      desk.setRider(false);
      office.window(null);
      office.pip.play('peck');
      const react = beatOf(s.react?.(a));
      startStep(si + 1, react);
    };
    const approve = async () => {
      phase = 'file';
      desk.enabled = false;
      if (remind && !ARTIFACT) void requestNotifications();
      office.go('stamp', false, 2.4);
      office.pip.play('peck');
      await desk.stampOnly('APPROVED', 'Head of Sleep');
      if (!alive) return;
      const h = office.head;
      office.pip.setMood('joy', 2);
      office.sparkle(h, 10);
      office.burst('stars', h, 8);
      play('reward_quest', 0.5);
      await wait(900);
      phase = 'outro';
      play('wings_flutter', 0.45);
      talk(OUTRO, () => void finishAll());
    };

    const finishAll = async (skipped = false) => {
      if (phase === 'done') return;
      phase = 'done';
      clearTimeout(autoT);
      if (desk) desk.enabled = false;
      dio.show(null);
      const x = a;
      await iris(() => (alive ? office.headScreen() : { x: innerWidth / 2, y: innerHeight / 2 }), async () => {
        edit((s) => applyAnswers(s, x));
        syncReminders();
        if (sc.stage === office) { sc.setStage(null); sc.setView('home'); sc.snapCamera(); }
        sc.post.enabled = postWas;
        releaseBoot();
      });
      sceneRef.current?.owl.play(skipped ? 'wave' : 'present');
      say(skipped ? `Welcome home! Let's unpack!` : `Let's unpack! Tap the boxes, ${x.you.trim() || 'friend'}!`, 4200);
      window.dispatchEvent(new CustomEvent('hh:intro-done', { detail: { skipped } }));
    };

    const onTap = () => {
      if (phase === 'talk' || phase === 'outro') {
        if (speech.typing) { speech.finish(); return; }
        play('ui_tap', 0.25); advance();
        return;
      }
      if (phase === 'ask') office.pip.play('nod');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (phase === 'ask' && desk?.isReady) void file(); else onTap(); }
    };
    addEventListener('keydown', onKey);

    // the owl photographs for the species form (rendered from the 3D models), the printed pictograms
    void preloadIcons(ICONS);
    photosIn = Promise.all((STEPS.find((s) => s.kind === 'species')?.opts ?? []).map((o) =>
      owlIconAsync({ ...lookFor(o.v), outfit: {} }, 'face').then(async (u) => {
        if (!u) return;
        await preload([u]);
        photos[o.v] = u;
        // a photo that arrives late is pasted onto the page that is already on the desk
        if (alive && desk?.page && st().kind === 'species') desk.reprint(printForm(st(), si, STEPS.length, ctx()));
      }).catch(() => undefined)));
    (window as unknown as { hhIntro: unknown }).hhIntro = { office, desk: () => desk, speech, a: () => a, file: () => void file(), region: (id: string) => { const r = desk?.page?.form.region(id); if (r) onRegion(r); }, phase: () => phase, step: () => si };

    // ---------------------------------------------------------------- the opening
    (async () => {
      await office.ready;
      if (!alive) return;
      desk = makeDesk();
      const devStep = DEV ? q.get('ob') : null;
      if (devStep) {
        releaseBoot();
        { const bt = document.getElementById('boot'); if (bt) bt.style.display = 'none'; }
        const i = Math.max(0, STEPS.findIndex((s) => s.id === devStep));
        si = i;
        const sel = q.get('obsel');
        if (sel) {
          const s = STEPS[i], f = s.field;
          if (f) a = { ...a, [f]: s.kind === 'multi' ? sel.split(',') : s.kind === 'hours' ? Number(sel) : f === 'mic' ? sel === 'yes' : sel } as Answers;
          picked[s.id] = true;
          if (s.kind === 'species') office.setLook(lookFor(sel), false);
        }
        if (q.has('obtalk')) { const s = STEPS[i]; talk(q.get('obline') ? [{ text: q.get('obline')!, shot: s.shot }] : s.say(a, { artifact: ARTIFACT }).map((b) => beatOf(b)!), () => void enterAsk(i)); office.cut(SHOT[s.shot] ?? s.shot); return; }
        if (q.has('obsigned')) signed = true;
        await enterAsk(i);
        office.cut(STEPS[i].kind === 'dial' ? 'formClock' : 'form');
        if (q.has('obstamp')) window.setTimeout(() => void (STEPS[i].kind === 'plan' ? approve() : file()), 600);
        return;
      }
      if (bootShowing()) {
        await bootReady();
        if (!alive) return;
        // the office waits nose to its clock's dial, exactly where the loading clock will leave the eye
        const m = bootDial();
        office.holdOnDial(m);
        office.pip.pose = 'stand';
        office.pip.lookAt = new THREE.Vector3(0.06, 0.8, -1.2);
        office.lampOn(false);
        await wakeBoot();
        if (!alive) return;
        if (DEV && q.get('obhold')) await wait(Number(q.get('obhold')));
        play('amb_room', 0.2);
        void office.pullBack(m, 'open', 4.8);
      } else {
        office.cut('open');
      }
      phase = 'open';
      // the lights come up as the camera pulls back; Pip looks up from his paperwork
      await wait(1500);
      if (!alive) return;
      office.lampOn(true);
      play('tick_brass', 0.45, 0.8);
      await wait(1700);
      if (!alive) return;
      office.pip.lookAt = office.camera.position;
      office.pip.setMood('surprised', 1.0);
      office.pip.play('stretch');
      await wait(1400);
      if (!alive) return;
      startStep(0, null);
    })();

    const onResize = () => { speech.px = office.look.px; };
    addEventListener('resize', onResize);
    return () => {
      alive = false;
      removeEventListener('keydown', onKey);
      removeEventListener('resize', onResize);
      input.current?.removeEventListener('input', onInput);
      input.current?.removeEventListener('keydown', onInputKey);
      clearTimeout(autoT);
      dio.show(null);
      desk?.dispose();
      speech.dispose();
      if (sc.stage === office) sc.setStage(null);
      sc.post.enabled = postWas;
      releaseBoot();
    };
  }, []);

  return (
    <div class="ob" style="position:fixed;inset:0;pointer-events:none;z-index:40">
      <input ref={input} class="ob-type" type="text" maxLength={16} autocomplete="off" autocapitalize="words" spellcheck={false} aria-label="Your answer"
        style="position:fixed;left:8vw;top:55vh;width:84vw;height:44px;font-size:16px;opacity:0;border:0;background:transparent;color:transparent;caret-color:transparent;pointer-events:none" />
    </div>
  );
}
export { GOALS, RELAX };
export type { Step };
