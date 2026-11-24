// The first-run experience: the loading clock dives into its dial, the camera pulls back out of the very same clock
// on the wall of Hollow & Co.'s executive office (the lamp clicks on, dust drifts in the light through the blinds)
// and Pip, Head of Sleep, looks up from his paperwork. His words float in the room. Each question is a clear 2D
// form (panel.tsx) clipped to a leather folio in front of the office, with live 3D models in its answer cards and
// 3D moments over the paper (the fountain pen ticks, the rubber stamp thumps RECEIVED); Pip stays in view above it
// and reacts to every answer. A stamped form flies into the client folder on his desk. The last page is a sleep
// plan you sign and Pip approves. The answers land in the save exactly as before (script.ts).
import { useEffect, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import { syncReminders, requestNotifications } from '../game/night.ts';
import { edit, save } from '../game/store.ts';
import type { OwlLook } from '../owl/model.ts';
import { sceneRef, say } from '../ui/state.ts';
import { bootDial, bootReady, bootShowing, releaseBoot, wakeBoot } from './boot.ts';
import { CardModels } from './cards.ts';
import { fountainPen, rubberStamp } from './desk.ts';
import { dioramas } from './dioramas.ts';
import { iris } from './iris.ts';
import { Office, type ShotName, type WorldView } from './office.ts';
import { Overlay3D } from './overlay3d.ts';
import { Panel, panelScale, type PanelActions } from './panel.tsx';
import { answersFrom, applyAnswers, hm, OUTRO, planOf, STEPS, toMin, type Answers, type Beat } from './script.ts';
import { Speech } from './speech.ts';

const ARTIFACT = import.meta.env.MODE === 'artifact';
const DEV = import.meta.env.DEV;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const play = (id: string, volume = 0.5, rate = 1) => { try { sound.play(id, { volume, rate, gap: 40 }); } catch { /* */ } };
const haptic = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* */ } };
type Phase = 'boot' | 'open' | 'talk' | 'ask' | 'file' | 'outro' | 'done';
const isWide = () => innerWidth >= 860 && innerWidth > innerHeight;

/** Pip as a given species (species and palette both carry the id, as the owl model expects) */
const lookFor = (species: string): OwlLook => ({ ...save.value.look, skin: 'owl', species, palette: species });
const beatOf = (b: Beat | string | null | undefined): Beat | null => (b == null ? null : typeof b === 'string' ? { text: b } : b);
/** script shot names -> the office's shots */
const SHOT: Partial<Record<ShotName, ShotName>> = { board: 'pipR', floor: 'pip', bed: 'pip', tower: 'pip', clockwin: 'window', desk: 'pip' };

async function askMic(): Promise<boolean> {
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    st.getTracks().forEach((t) => t.stop());
    return true;
  } catch { return false; }
}

interface UI { show: boolean; leaving: boolean; si: number; a: Answers; picked: Record<string, boolean>; remind: boolean; signed: boolean; stamped: string | null; skipAsk: boolean; k: number; wide: boolean }

export function Intro() {
  const [, setV] = useState(0);
  const bump = () => setV((v) => v + 1);
  const ui = useRef<UI>({ show: false, leaving: false, si: 0, a: answersFrom(save.value), picked: {}, remind: true, signed: false, stamped: null, skipAsk: false, k: panelScale(), wide: isWide() });
  const overlay = useRef<Overlay3D | null>(null);
  const models = useRef<CardModels | null>(null);
  const actions = useRef<PanelActions | null>(null);
  const panelEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) { releaseBoot(); return undefined; }
    const U = ui.current;
    const q = DEV ? new URLSearchParams(location.search) : new URLSearchParams();
    const fast = DEV && q.has('obfast');
    let alive = true, phase: Phase = 'boot';

    // ---- the office, Pip's words, the 3D layer over the form, the card models
    let office: Office;
    try {
      const world = typeof (sc as unknown as WorldView).renderView === 'function' ? (sc as unknown as WorldView) : null;
      office = new Office(lookFor(U.a.species), sc.renderer, sc.quality, world);
    } catch (e) { console.error('interview office failed', e); releaseBoot(); return undefined; }
    const postWas = sc.post.enabled;
    sc.post.enabled = false; // the office draws its own HD-2D picture (look.ts)
    sc.setStage(office);
    const speech = new Speech();
    speech.px = Math.max(2, office.look.px);
    office.look.overlay.add(speech.group);
    office.tickers.add((dt) => { speech.px = Math.max(2, office.look.px); speech.update(dt, office.camera); });
    speech.onTalk = () => office.talk();
    const reactTo = dioramas(office);
    office.pip.pose = 'stand';
    office.setNameplate(U.a.name || 'Pip');
    const ov = new Overlay3D();
    ov.setScale(U.k);
    overlay.current = ov;
    const cards = new CardModels(office.mats, lookFor);
    models.current = cards;
    office.tickers.add((dt) => ov.update(dt));
    const pen = fountainPen(office.mats), stamp = rubberStamp(office.mats);
    const st = () => STEPS[U.si];

    // ---------------------------------------------------------------- talking
    let beats: Beat[] = [], bi = 0, after: (() => void) | null = null, autoT = 0;
    const show = (k: number) => {
      const b = beats[k];
      if (!b) return;
      clearTimeout(autoT);
      speech.say(b.text, `${(U.a.name.trim() || 'Pip').toUpperCase()} · HEAD OF SLEEP`, fast);
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
    const talk = (list: Beat[], then: () => void) => { beats = list; bi = 0; after = then; phase = phase === 'outro' ? 'outro' : 'talk'; show(0); };
    speech.onDone = () => {
      if (phase !== 'talk' && phase !== 'outro') return;
      const last = bi >= beats.length - 1, txt = beats[bi]?.text ?? '';
      autoT = window.setTimeout(advance, fast ? 30 : last ? 650 : 1500 + txt.length * 26);
    };

    // ---------------------------------------------------------------- the form
    const canFile = () => { const s = st(); return s.kind === 'plan' ? U.signed : s.kind !== 'choice' || !!U.picked[s.id]; };
    const set = (a: Answers) => { U.a = a; bump(); };
    /** frame Pip in whatever part of the screen the form leaves free */
    const frameAsk = () => {
      const el = panelEl.current;
      if (!el) return;
      // where the form rests once it has slid in (its box, not its animated transform)
      const u = U.k;
      if (U.wide) { const left = innerWidth - 18 * u - el.offsetWidth; const w = Math.max(0.3, (left - 10) / innerWidth); office.askArea = { w, h: 1, cx: w - 1, cy: 0 }; }
      else { const top = innerHeight - 4 * u - el.offsetHeight; const h = Math.max(0.18, (top + 8) / innerHeight); office.askArea = { w: 1, h, cx: 0, cy: 1 - h }; }
      office.reframe();
    };
    const enterAsk = async (i: number) => {
      U.si = i; U.show = true; U.leaving = false; U.stamped = null; U.skipAsk = false;
      phase = 'ask';
      speech.say(null);
      const s = STEPS[i];
      if (s.kind === 'dial') { cards.clockAt = toMin(U.a.wake); office.window(toMin(U.a.wake) / 60); }
      cards.nightOwl = U.a.species;
      bump();
      play('paper_rustle', 0.45, 1.05);
      office.go('ask', false, 2.2);
      await wait(30);
      frameAsk();
      office.pip.lookAt = office.camera.position;
      office.pip.setMood('curious');
    };
    const startStep = (i: number, react: Beat | null) => {
      U.si = i;
      // the reaction is said to camera once the form has gone (the camera leaves the form's framing)
      const list = [...(react ? [{ ...react, shot: react.shot ?? 'pip' }] : []), ...STEPS[i].say(U.a, { artifact: ARTIFACT }).map((b) => beatOf(b)!)];
      talk(list, () => void enterAsk(i));
    };

    // ---- 3D moments over the paper: the pen ticking a box, the stamp thumping the office box
    let penBusy = 0;
    const penTo = (el: Element | null) => {
      if (!el) return;
      const s = Math.min(innerWidth, innerHeight) * 0.9;
      const id = ++penBusy;
      ov.play(pen, 0.62, (k, o) => {
        if (id !== penBusy) { o.visible = false; return; }
        // follow the box (the form may still be settling)
        const b = el.getBoundingClientRect(), x = b.left + b.width * 0.4, y = b.top + b.height * 0.5;
        const inK = Math.min(1, k / 0.35), outK = Math.max(0, (k - 0.72) / 0.28);
        const e = 1 - (1 - inK) ** 3;
        const sx = x + 160 * (1 - e) + outK * 200, sy = y - 120 * (1 - e) + outK * 20;
        const scribble = k > 0.35 && k < 0.72 ? Math.sin(k * 60) * 4 : 0;
        o.position.set(sx + scribble, -(sy - Math.abs(scribble) * 0.5), 200);
        o.scale.setScalar(s);
        o.rotation.set(0.5, -0.4, 0.95);
      });
      play('scribble', 0.4, 1 + Math.random() * 0.2);
    };
    const splat = new THREE.Group();
    const inkSplat = (x: number, y: number) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0xa01a1e });
      const bits: { m: THREE.Mesh; vx: number; vy: number }[] = [];
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(U.k * 1.6, U.k * 1.6), mat);
        const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 120;
        bits.push({ m, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 60 });
        splat.add(m);
      }
      ov.play(splat, 0.45, (k) => {
        for (const b of bits) { b.m.position.set(x + b.vx * k, -(y + b.vy * k + 260 * k * k), 400); b.m.scale.setScalar(1 - k * 0.6); }
      }, () => { for (const b of bits) { splat.remove(b.m); b.m.geometry.dispose(); } mat.dispose(); });
    };
    const stampOn = (text: string) => new Promise<void>((done) => {
      const box = panelEl.current?.querySelector('.qp-box');
      if (!box) { U.stamped = text; bump(); done(); return; }
      let hit = false;
      const onHit = (x: number, y: number) => {
        U.stamped = text; bump();
        play('stamp', 0.85); haptic(30);
        office.bump(1);
        inkSplat(x, y);
      };
      play('pickup_item', 0.4, 0.9);
      ov.play(stamp, 1.05, (k, o) => {
        // swing in from the top right, hover, slam down, lift away (following the box while the form settles)
        const b = box.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, s = b.width * 10;
        const p1 = Math.min(1, k / 0.38), e1 = 1 - (1 - p1) ** 3;
        let px = x + (1 - e1) * 220, py = y - 140 - (1 - e1) * 160;
        if (k > 0.38 && k < 0.52) { const d = (k - 0.38) / 0.14; py = y - 140 + d * d * 136; px = x; }
        else if (k >= 0.52 && k < 0.66) { py = y - 4; px = x; if (!hit) { hit = true; onHit(x, y); } }
        else if (k >= 0.66) { const d = (k - 0.66) / 0.34; py = y - 4 - d * 220; px = x + d * 160; }
        o.position.set(px, -py, 300);
        o.scale.setScalar(s);
        o.rotation.set(0.55, -0.3 + k * 0.2, 0);
      }, done);
    });
    /** the stamped form flies into the folder on Pip's desk */
    const fileAway = () => new Promise<void>((done) => {
      const el = panelEl.current;
      if (!el) { done(); return; }
      const r = el.getBoundingClientRect(), f = office.folderScreen();
      const dx = f.x - (r.left + r.width / 2), dy = f.y - (r.top + r.height / 2);
      play('whoosh_soft', 0.35, 1.2);
      el.classList.remove('in');
      el.classList.add('qp-fly');
      el.style.transform = `translate(${U.wide ? '0' : '-50%'}, ${U.wide ? '50%' : '0'}) translate(${dx}px, ${dy}px) scale(0.06) rotate(-10deg)`;
      el.style.opacity = '0';
      window.setTimeout(() => { U.show = false; bump(); office.fileFlap(); done(); }, 520);
    });

    const file = async () => {
      if (phase !== 'ask') return;
      const s = st();
      if (!canFile()) { play('ui_error', 0.3); (panelEl.current?.querySelector('.qp-box') as HTMLElement | null)?.animate?.([{ transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 240, easing: 'steps(4)' }); return; }
      if (s.kind === 'plan') { void approve(); return; }
      let a = U.a;
      if (s.id === 'mic' && a.mic && !ARTIFACT) { const ok = await askMic(); if (!ok) { a = { ...a, mic: false }; set(a); } }
      phase = 'file';
      (document.activeElement as HTMLElement | null)?.blur?.();
      await stampOn('RECEIVED');
      if (!alive) return;
      await wait(220);
      reactTo.show(null);
      office.pip.play('peck');
      await fileAway();
      if (!alive) return;
      office.window(null);
      startStep(U.si + 1, beatOf(s.react?.(U.a)));
    };
    const approve = async () => {
      phase = 'file';
      if (U.remind && !ARTIFACT) void requestNotifications();
      office.pip.play('peck');
      await stampOn('APPROVED');
      if (!alive) return;
      const h = office.head;
      office.pip.setMood('joy', 2);
      office.sparkle(h, 10);
      office.burst('stars', h, 8);
      play('reward_quest', 0.5);
      await wait(1100);
      await fileAway();
      if (!alive) return;
      phase = 'outro';
      play('wings_flutter', 0.45);
      talk(OUTRO, () => void finishAll());
    };

    const finishAll = async (skipped = false) => {
      if (phase === 'done') return;
      phase = 'done';
      clearTimeout(autoT);
      reactTo.show(null);
      U.show = false; bump();
      const x = U.a;
      await iris(() => (alive ? office.headScreen() : { x: innerWidth / 2, y: innerHeight / 2 }), async () => {
        edit((s) => applyAnswers(s, x));
        syncReminders();
        if (sc.stage === office) { sc.setStage(null); sc.setView('home'); sc.snapCamera(); }
        sc.post.enabled = postWas;
        ov.dispose(); overlay.current = null;
        releaseBoot();
      });
      sceneRef.current?.owl.play(skipped ? 'wave' : 'present');
      say(skipped ? `Welcome home! Let's unpack!` : `Let's unpack! Tap the boxes, ${x.you.trim() || 'friend'}!`, 4200);
      window.dispatchEvent(new CustomEvent('hh:intro-done', { detail: { skipped } }));
    };

    // ---------------------------------------------------------------- what the form can do
    const panelQ = (sel: string) => panelEl.current?.querySelector(sel) ?? null;
    actions.current = {
      pick: (v) => {
        if (phase !== 'ask') return;
        const s = st(), a = U.a;
        if (s.kind === 'text') { set({ ...a, name: v }); office.setNameplate(v); office.sparkle(office.head, 4); play('pencil', 0.4); window.requestAnimationFrame(() => penTo(panelQ(`[data-v="${v}"] .qp-tickbox`))); return; }
        if (s.kind === 'species') {
          if (a.species !== v) { set({ ...a, species: v }); office.setLook(lookFor(v)); play('paper_flip', 0.35); }
          U.picked[s.id] = true; bump();
        } else if (s.kind === 'multi') {
          const f = s.field as 'goals' | 'relax', cur = a[f], on = !cur.includes(v);
          set({ ...a, [f]: on ? [...cur, v] : cur.filter((x) => x !== v) });
          if (on) { reactTo.show(`${s.id}:${v}`); office.pip.play('nod'); } else { reactTo.show(null); play('ui_back', 0.3); return; }
        } else if (s.kind === 'choice') {
          set({ ...a, [s.field!]: s.id === 'mic' ? v === 'yes' : v } as Answers);
          U.picked[s.id] = true;
          reactTo.show(`${s.id}:${v}`);
        }
        haptic();
        window.requestAnimationFrame(() => penTo(panelQ(`[data-v="${v}"] .qp-tickbox`)));
      },
      text: (v) => { if (phase !== 'ask') return; const f = st().field as 'you' | 'name'; set({ ...U.a, [f]: v.slice(0, 16) }); if (f === 'name') office.setNameplate(v.trim() || 'Pip'); play('scribble', 0.2, 0.9 + Math.random() * 0.4); },
      enter: () => void file(),
      nudge: (d) => { const w = hm(toMin(U.a.wake) + d); set({ ...U.a, wake: w }); cards.clockAt = toMin(w); office.window(toMin(w) / 60); play('tick_brass', 0.4); },
      ampm: (pm) => { const m = (toMin(U.a.wake) % 720) + (pm ? 720 : 0); set({ ...U.a, wake: hm(m) }); cards.clockAt = m; office.window(m / 60); play('pencil', 0.35); penTo(panelQ(pm ? '.qp-ampm .qp-check:last-child .qp-tickbox' : '.qp-ampm .qp-check .qp-tickbox')); },
      clock: (m12) => { const pm = toMin(U.a.wake) >= 720, m = m12 + (pm ? 720 : 0); if (hm(m) === U.a.wake) return; set({ ...U.a, wake: hm(m) }); cards.clockAt = m; office.window(m / 60); play('tick_brass', 0.3, 1.1 + Math.random() * 0.2); },
      hours: (v) => { if (v === U.a.hours) return; set({ ...U.a, hours: v }); play('tick_brass', 0.3, 0.8 + (v - 5) * 0.08); office.pip.setMood(v < 7 ? 'worried' : v >= 9 ? 'love' : 'happy', 1.5); },
      sign: () => { if (U.signed) return; U.signed = true; bump(); play('scribble', 0.5); office.pip.play('nod'); penTo(panelQ('.qp-sign button')); },
      remind: () => { U.remind = !U.remind; bump(); play('pencil', 0.35); },
      stamp: () => void file(),
      skip: (ask) => { U.skipAsk = ask; bump(); play('paper_flip', 0.35, 1.3); },
      skipYes: () => { play('ui_confirm', 0.4); void finishAll(true); },
    };

    const onTap = () => {
      if (phase === 'talk' || phase === 'outro') {
        if (speech.typing) { speech.finish(); return; }
        play('ui_tap', 0.25); advance();
        return;
      }
      if (phase === 'ask') office.pip.play('nod');
    };
    office.onPointer = (type) => { if (type === 'down') onTap(); return true; };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (phase === 'ask') void file(); else onTap(); }
    };
    addEventListener('keydown', onKey);
    const onResize = () => { speech.px = Math.max(2, office.look.px); U.k = panelScale(); U.wide = isWide(); ov.setScale(U.k); bump(); window.setTimeout(frameAsk, 50); };
    addEventListener('resize', onResize);
    (window as unknown as { hhIntro: unknown }).hhIntro = { office, speech, overlay: ov, a: () => U.a, file: () => void file(), act: () => actions.current, phase: () => phase, step: () => U.si, skip: () => void finishAll(true) };

    // ---------------------------------------------------------------- the opening
    (async () => {
      await office.ready;
      if (!alive) return;
      const devStep = DEV ? q.get('ob') : null;
      if (devStep) {
        releaseBoot();
        { const bt = document.getElementById('boot'); if (bt) bt.style.display = 'none'; }
        const i = Math.max(0, STEPS.findIndex((s) => s.id === devStep));
        U.si = i;
        const sel = q.get('obsel');
        if (sel) {
          const s = STEPS[i], f = s.field;
          if (f) U.a = { ...U.a, [f]: s.kind === 'multi' ? sel.split(',') : s.kind === 'hours' ? Number(sel) : f === 'mic' ? sel === 'yes' : sel } as Answers;
          U.picked[s.id] = true;
          if (s.kind === 'species') office.setLook(lookFor(sel), false);
        }
        if (q.has('obsigned')) U.signed = true;
        if (q.has('obtalk')) { const s = STEPS[i]; talk(q.get('obline') ? [{ text: q.get('obline')!, shot: s.shot }] : s.say(U.a, { artifact: ARTIFACT }).map((b) => beatOf(b)!), () => void enterAsk(i)); office.cut(SHOT[s.shot] ?? s.shot); return; }
        await enterAsk(i);
        office.cut('ask');
        if (q.has('obstamp')) window.setTimeout(() => void file(), 1500);
        return;
      }
      let pulled: Promise<void> = Promise.resolve();
      if (bootShowing()) {
        await bootReady();
        if (!alive) return;
        // the office waits nose to its clock's dial, exactly where the loading clock will leave the eye
        const m = bootDial();
        office.holdOnDial(m);
        office.pip.pose = 'stand';
        office.pip.lookAt = new THREE.Vector3(0.3, 0.8, -1.2);
        office.lampOn(false);
        await wakeBoot();
        if (!alive) return;
        if (DEV && q.get('obhold')) await wait(Number(q.get('obhold')));
        play('amb_room', 0.2);
        pulled = office.pullBack(m, 'open', 4.8);
      } else office.cut('open');
      phase = 'open';
      // the lamp clicks on as the camera pulls back; Pip looks up from his paperwork (timed in the office's own
      // time, so a slow device keeps the beats in step with the camera)
      await office.after(1.5);
      if (!alive) return;
      office.lampOn(true);
      play('tick_brass', 0.45, 0.8);
      await office.after(1.7);
      if (!alive) return;
      office.pip.lookAt = office.camera.position;
      office.pip.setMood('surprised', 1.0);
      office.pip.play('stretch');
      await Promise.all([office.after(1.4), pulled]);
      if (!alive) return;
      startStep(0, null);
    })();

    return () => {
      alive = false;
      removeEventListener('keydown', onKey);
      removeEventListener('resize', onResize);
      clearTimeout(autoT);
      reactTo.show(null);
      speech.dispose();
      cards.dispose();
      overlay.current?.dispose(); overlay.current = null;
      if (sc.stage === office) sc.setStage(null);
      sc.post.enabled = postWas;
      releaseBoot();
    };
  }, []);

  const U = ui.current;
  const st = STEPS[U.si];
  const ready = st ? (st.kind === 'plan' ? U.signed : st.kind !== 'choice' || !!U.picked[st.id]) : false;
  return (
    <div class="ob">
      {U.show && st && overlay.current && models.current && actions.current && (
        <Panel key={st.id} step={st} index={U.si} total={STEPS.length} overlay={overlay.current} model={models.current.model} k={U.k} wide={U.wide} leaving={U.leaving} sheetRef={panelEl}
          act={actions.current}
          s={{ a: U.a, picked: U.picked, remind: U.remind, signed: U.signed, stamped: U.stamped, ready, hour12: save.value.settings.hour12, artifact: ARTIFACT, plan: planOf(U.a), skipAsk: U.skipAsk }} />
      )}
    </div>
  );
}
