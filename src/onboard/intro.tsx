// The first-run experience: the loading clock dives into its dial, the camera pulls back out of the very same clock
// on the wall of Hollow & Co.'s executive office (the lamp clicks on, dust drifts in the light through the blinds)
// and Pip, Head of Sleep, looks up from his paperwork. His words float in the room. Each question is a sheet of
// paper clipped to a leather folio in front of the office: a one-line question and the answers as live 3D objects
// (panel.tsx, cards.ts). A real fountain pen floats over the paper, follows your finger or cursor, writes your
// name, ticks and rings what you choose and signs the contract; tapes slide into a cassette recorder and play; a
// pretend phone beside Pip shows what the bedtime lock does. The rubber stamp thumps RECEIVED and the stamped form
// flies into the client folder on his desk. The answers land in the save exactly as before (script.ts).
import { useEffect, useRef, useState } from 'preact/hooks';
import * as THREE from 'three';
import { sound } from '../audio/sound.ts';
import { syncReminders, requestNotifications } from '../game/night.ts';
import { edit, save } from '../game/store.ts';
import type { OwlLook } from '../owl/model.ts';
import { FakePhone } from '../ui/phone/phone.tsx';
import { sceneRef, say } from '../ui/state.ts';
import { bootDial, bootReady, bootShowing, releaseBoot, wakeBoot } from './boot.ts';
import { CardModels } from './cards.ts';
import { rubberStamp } from './desk.ts';
import { dioramas } from './dioramas.ts';
import { iris } from './iris.ts';
import { Office, type ShotName, type WorldView } from './office.ts';
import { Overlay3D, smoothen } from './overlay3d.ts';
import { isWide, Panel, panelScale, type PanelActions } from './panel.tsx';
import { FloatingPen } from './pen.ts';
import { DRINKS, TAPES } from './props.ts';
import { answersFrom, applyAnswers, fromBlocks, hm, OUTRO, planOf, RELAX, STEPS, toMin, type Answers, type Beat } from './script.ts';
import { Speech } from './speech.ts';
import { plainOf } from '../ui/talk.ts';
import { light } from '../ui/fx/moment.ts'; // [fx10] a soft press of light
import { uiBurst } from '../ui/chrome/uifx.ts';

const ARTIFACT = import.meta.env.MODE === 'artifact';
const DEV = import.meta.env.DEV;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const play = (id: string, volume = 0.5, rate = 1) => { try { sound.play(id, { volume, rate, gap: 40 }); } catch { /* */ } };
const haptic = (ms = 12) => { try { navigator.vibrate?.(ms); } catch { /* */ } };
type Phase = 'boot' | 'open' | 'talk' | 'ask' | 'file' | 'outro' | 'done';

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

/** the pretend phone's size (CSS px per art px) and place beside Pip, for the phone page */
function phoneSpot(panel: DOMRect | null, wide: boolean): { k: number; x: number; y: number } {
  const PW = 80, PH = 160;
  if (wide) {
    const free = panel ? panel.left : innerWidth * 0.5;
    const k = Math.max(2, Math.min(3, Math.floor(Math.min((innerHeight * 0.72) / PH, (free * 0.44) / PW))));
    return { k, x: Math.round(free * 0.06), y: Math.round((innerHeight - PH * k) / 2) };
  }
  const top = panel ? panel.top : innerHeight * 0.45;
  const k = top - 16 >= PH * 2 ? 2 : 1; // whole pixels only
  return { k, x: Math.round(innerWidth - PW * k - 8), y: Math.max(6, Math.round((top - PH * k) / 2) - 6) };
}

/** [tutor] the pretend phone (the bedtime lock) stands beside Pip while "my phone" is ticked on the obstacles page */
const phoneUp = (U: UI) => STEPS[U.si]?.id === 'blocks' && U.a.blocks.includes('phone');

interface UI { show: boolean; leaving: boolean; si: number; a: Answers; picked: Record<string, boolean>; remind: boolean; signed: boolean; stamped: string | null; skipAsk: boolean; k: number; wide: boolean; drink: string | null; deckTape: string | null }

export function Intro() {
  const [, setV] = useState(0);
  const bump = () => setV((v) => v + 1);
  const ui = useRef<UI>({ show: false, leaving: false, si: 0, a: answersFrom(save.value), picked: {}, remind: true, signed: false, stamped: null, skipAsk: false, k: panelScale(), wide: isWide(), drink: null, deckTape: null });
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

    // ---- the office, Pip's words, the 3D layer over the form, the answer models, the pen
    let office: Office;
    try {
      const world = typeof (sc as unknown as WorldView).renderView === 'function' ? (sc as unknown as WorldView) : null;
      office = new Office(lookFor(U.a.species), sc.renderer, sc.quality, world);
    } catch (e) { console.error('interview office failed', e); releaseBoot(); return undefined; }
    const postWas = sc.post.enabled;
    sc.post.enabled = false; // the office draws its own HD-2D picture (look.ts)
    sc.setStage(office);
    const speech = new Speech(); // [dialog10] floating 3D words at device resolution (ui/talk.ts)
    office.tickers.add((dt) => speech.update(dt, office.camera));
    speech.onTalk = () => office.talk();
    const reactTo = dioramas(office);
    office.pip.pose = 'stand';
    office.setNameplate(U.a.name || 'Pip');
    const ov = new Overlay3D();
    ov.setScale(U.k);
    overlay.current = ov;
    const cards = new CardModels(office.mats, lookFor);
    cards.wake = U.a.wake; cards.hour12 = save.value.settings.hour12;
    cards.plate = { you: U.a.you, name: U.a.name };
    models.current = cards;
    office.tickers.add((dt) => ov.update(dt));
    const stamp = smoothen(rubberStamp(office.mats)); // [dialog10] its own smooth copies of the office's woods
    const pen = new FloatingPen(ov);
    let penShown = false;
    pen.visible = false;
    pen.onScratch = () => play('pencil', 0.18, 0.9 + Math.random() * 0.3);
    const st = () => STEPS[U.si];

    // the pen rests just above the top of the paper and follows the pointer about
    const penHome = () => { pen.len = Math.round(64 * U.k); };
    pen.restAt = () => {
      // the form's settled box (not its slide-in transform)
      const el = panelEl.current;
      if (!el) return null;
      const u = U.k, w = el.offsetWidth, h = el.offsetHeight;
      pen.restLean = U.wide ? Math.PI - 0.72 : null; // beside the form on wide screens, leaning away from it
      return U.wide ? { x: innerWidth - 14 * u - w - 10 * u, y: (innerHeight - h) / 2 + 110 * u } : { x: (innerWidth - w) / 2 + w * 0.1, y: innerHeight - 3 * u - h + 8 * u };
    };
    const onMove = (e: PointerEvent) => {
      if (phase !== 'ask' && phase !== 'file') return;
      if (e.pointerType === 'mouse') pen.follow(e.clientX, e.clientY);
      else if (e.buttons) pen.follow(e.clientX - 10, e.clientY - 34); // a finger hides the nib: hover it just above
    };
    const onLeave = () => pen.release();
    addEventListener('pointermove', onMove);
    addEventListener('pointerdown', onMove);
    document.addEventListener('mouseleave', onLeave);

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
      // [dialog10] the typing is slower and human now, so the reader is nearly done when it ends: a short hold
      const last = bi >= beats.length - 1, txt = plainOf(beats[bi]?.text ?? '');
      autoT = window.setTimeout(advance, fast ? 30 : last ? 650 : 1200 + txt.length * 16);
    };

    // ---------------------------------------------------------------- the form
    const canFile = () => { const s = st(); return s.kind === 'plan' ? U.signed : s.kind !== 'choice' || !!U.picked[s.id]; };
    const set = (a: Answers) => { U.a = a; bump(); };
    /** frame Pip in whatever part of the screen the form (and on the phone page, the phone) leaves free */
    const frameAsk = () => {
      const el = panelEl.current;
      if (!el) return;
      // where the form rests once it has slid in (its box, not its animated transform)
      const u = U.k, phonePage = phoneUp(U);
      if (U.wide) {
        const left = innerWidth - 14 * u - el.offsetWidth;
        let x0 = 0;
        if (phonePage) { const ps = phoneSpot(new DOMRect(left, 0, el.offsetWidth, innerHeight), true); x0 = ps.x + 80 * ps.k + 8; }
        const w = Math.max(0.2, (left - 10 - x0) / innerWidth);
        office.askArea = { w, h: 1, cx: (x0 / innerWidth) * 2 + w - 1, cy: 0 };
      } else {
        const top = innerHeight - 3 * u - el.offsetHeight;
        const h = Math.max(0.18, (top + 8) / innerHeight);
        if (phonePage) { const ps = phoneSpot(new DOMRect(0, top, innerWidth, el.offsetHeight), false); const w = Math.min(1, Math.max(0.5, (ps.x + 30) / innerWidth)); office.askArea = { w, h, cx: w - 1, cy: 1 - h }; }
        else office.askArea = { w: 1, h, cx: 0, cy: 1 - h };
      }
      office.reframe();
      penHome();
    };
    const enterAsk = async (i: number) => {
      U.si = i; U.show = true; U.leaving = false; U.stamped = null; U.skipAsk = false;
      phase = 'ask';
      speech.say(null);
      const s = STEPS[i];
      if (s.kind === 'dial') { cards.clockAt = toMin(U.a.wake); office.window(toMin(U.a.wake) / 60); }
      cards.nightOwl = U.a.species;
      cards.wake = U.a.wake;
      bump();
      play('paper_rustle', 0.45, 1.05);
      office.go('ask', false, 2.2);
      await wait(30);
      frameAsk();
      if (!pen.visible && !penShown) { pen.snap(); penShown = true; }
      pen.visible = true;
      office.pip.lookAt = office.camera.position;
      office.pip.setMood('curious');
    };
    const startStep = (i: number, react: Beat | null) => {
      U.si = i;
      // the reaction is said to camera once the form has gone (the camera leaves the form's framing)
      const list = [...(react ? [{ ...react, shot: react.shot ?? 'pip' }] : []), ...STEPS[i].say(U.a, { artifact: ARTIFACT }).map((b) => beatOf(b)!)];
      talk(list, () => void enterAsk(i));
    };

    // ---- the pen's ink: ticks and rings round the words of the chosen answers, the name being written
    const panelQ = (sel: string) => panelEl.current?.querySelector(sel) ?? null;
    const labelOf = (v: string) => panelQ(`[data-v="${v}"] .qp-lab`) as HTMLElement | null;
    const inkTick = (v: string) => window.requestAnimationFrame(() => { const el = labelOf(v); if (!el) return; const b = el.getBoundingClientRect(); void pen.tick(b.left - 7 * U.k, b.top + b.height * 0.4, 7 * U.k); });
    const inkLoop = (v: string) => window.requestAnimationFrame(() => { const el = labelOf(v); if (!el) return; const b = el.getBoundingClientRect(); void pen.loop(b.left + b.width / 2, b.top + b.height / 2, b.width / 2 + 6 * U.k, b.height / 2 + 3 * U.k); });
    let measureC: CanvasRenderingContext2D | null = null;
    const inkLetter = () => {
      const inp = panelQ('.qp-line input') as HTMLInputElement | null;
      if (!inp) return;
      const cs = getComputedStyle(inp);
      measureC ??= document.createElement('canvas').getContext('2d');
      if (!measureC) return;
      measureC.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const b = inp.getBoundingClientRect(), w = measureC.measureText(inp.value).width;
      void pen.letter(Math.min(b.right - 4, b.left + parseFloat(cs.paddingLeft) + w), b.bottom - 3 * U.k, 14 * U.k);
    };

    // ---- [dialog10] the rubber stamp: it swings in, takes aim, slams down with its weight (the paper dents and
    // jolts, a slap and a thud), rocks once on the paper the way a hand does, and lifts away from a wet impression
    const stampOn = (text: string) => new Promise<void>((done) => {
      const box = panelEl.current?.querySelector('.qp-box');
      if (!box) { U.stamped = text; bump(); done(); return; }
      let hit = false;
      const onHit = (x: number, y: number) => {
        U.stamped = text; bump();
        play('stamp', 0.9, 0.92); play('place_soft', 0.5, 0.6); haptic(34);
        office.bump(1);
        const sheet = panelEl.current;
        if (sheet) { sheet.classList.remove('thud'); void sheet.offsetWidth; sheet.classList.add('thud'); window.setTimeout(() => sheet.classList.remove('thud'), 420); }
        // [fx10] the press puffs a little paper dust from under the die (the ink's spatter is printed in the
        // impression, in the stamp's own red); the approval adds fx10's soft press of light
        uiBurst('dust', x, y + 6, text === 'APPROVED' ? 8 : 4);
        if (text === 'APPROVED') { light.ring({ x, y }, { r0: 18, r1: Math.max(innerWidth, innerHeight) * 0.3, color: '#f4e6c8', alpha: 0.22, dur: 0.6, width: 22 }); light.breath({ x, y }, { r: 120, dur: 0.9 }); uiBurst('paper', x, y, 3); office.pip.react('starry', 'sparkle', 2.2); }
      };
      play('pickup_item', 0.4, 0.9);
      ov.play(stamp, 1.3, (k, o) => {
        // follows the box while the form settles
        const b = box.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2, s = b.width * 11;
        let px = x, py = y - 150, rx = 0.55, rz = 0, sy = 1, sxz = 1;
        if (k < 0.3) { const e = 1 - (1 - k / 0.3) ** 3; px = x + (1 - e) * 220; py = y - 150 - (1 - e) * 160; }
        else if (k < 0.42) { const d = (k - 0.3) / 0.12; py = y - 150 - Math.sin(d * Math.PI * 0.5) * 16; rx = 0.55 - d * 0.22; }
        else if (k < 0.5) { const d = (k - 0.42) / 0.08; py = y - 166 + d * d * d * 162; rx = 0.33; }
        else if (k < 0.68) {
          const d = (k - 0.5) / 0.18;
          if (!hit) { hit = true; onHit(x, y); }
          py = y - 4; rx = 0.33;
          sy = 1 - 0.07 * Math.exp(-d * 6) * Math.cos(d * 9); sxz = 1 + 0.035 * Math.exp(-d * 6);
          rz = Math.sin(d * Math.PI * 2) * 0.045 * (1 - d);
        } else { const d = (k - 0.68) / 0.32, e = d * d; py = y - 4 - e * 240; px = x + e * 170; rx = 0.33 + d * 0.22; }
        o.position.set(px, -py, 300);
        o.scale.set(s * sxz, s * sy, s * sxz);
        o.rotation.set(rx, -0.3 + k * 0.2, rz);
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

    // ---- the cassette recorder: a tapped tape flies out of the rack, the door drops, it clicks in and plays
    let tapeFlight = 0;
    const deckTo = (id: string | null) => {
      const deck = cards.deck;
      if (!deck) return;
      for (const c of [...deck.bay.children]) deck.bay.remove(c);
      deck.bayTick = null;
      deck.playing = false;
      if (!id) { deck.doorOpen = 1; window.setTimeout(() => { if (cards.deck === deck && !U.deckTape) deck.doorOpen = 0; }, 450); return; }
      const t = cards.tape(id);
      if (!t) return;
      deck.bay.add(t.obj);
      t.spin = 3.2;
      deck.bayTick = (tt, dt) => t.tick?.(tt, dt);
      deck.doorOpen = 0;
      window.setTimeout(() => { if (U.deckTape === id) { deck.playing = true; play('ui_toggle', 0.4, 0.8); reactTo.show('relax:' + id); } }, 220);
    };
    const insertTape = (id: string) => {
      const deck = cards.deck, src = cards.tape(id);
      const from = ov.project(id, new THREE.Vector3(0, 0.33, 0));
      const prev = U.deckTape;
      U.deckTape = id; bump();
      reactTo.show(null);
      if (!deck || !src || !from) { deckTo(id); return; }
      for (const c of [...deck.bay.children]) deck.bay.remove(c);
      deck.playing = false; deck.bayTick = null;
      deck.doorOpen = 1;
      if (prev) play('drawer_open', 0.3, 1.3);
      deck.root.updateWorldMatrix(true, true);
      const wa = deck.root.localToWorld(deck.bayAnchor.clone());
      const wl = deck.root.localToWorld(deck.bayAnchor.clone().add(new THREE.Vector3(-0.05, 0, 0)));
      const wr = deck.root.localToWorld(deck.bayAnchor.clone().add(new THREE.Vector3(0.05, 0, 0)));
      const to = ov.projectWorld('deck', wa), pl = ov.projectWorld('deck', wl), pr = ov.projectWorld('deck', wr);
      if (!to || !pl || !pr) { deckTo(id); return; }
      const w0 = from.ppm, w1 = Math.hypot(pr.x - pl.x, pr.y - pl.y);
      const g = new THREE.Group(), inner = src.obj;
      inner.position.set(0, -0.032, 0);
      g.add(inner);
      const flight = ++tapeFlight;
      play('whoosh_cloth', 0.35, 1.3);
      ov.play(g, 0.6, (k, o) => {
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const x = from.x + (to.x - from.x) * e, y = from.y + (to.y - from.y) * e - Math.sin(k * Math.PI) * 70;
        o.position.set(x, -y, Math.sin(k * Math.PI) * 60);
        o.scale.setScalar(((w0 + (w1 - w0) * e) / 0.1) * (1 + Math.sin(k * Math.PI) * 0.15));
        o.rotation.set(Math.sin(k * Math.PI) * 0.6, Math.sin(k * Math.PI * 2) * 0.3, (1 - e) * 0.25);
      }, () => { if (flight === tapeFlight && U.deckTape === id) { play('place_item', 0.45, 1.2); haptic(15); deckTo(id); } }, true);
    };

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
      await wait(650); // [dialog10] a beat to see the wet ink before the form is filed
      reactTo.show(null);
      office.pip.play('peck');
      pen.visible = false;
      await fileAway();
      if (!alive) return;
      office.window(null);
      if (s.id === 'relax') { U.deckTape = null; cards.deck = null; }
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
      await wait(1700);
      pen.visible = false;
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
      pen.visible = false;
      const x = U.a;
      await iris(() => (alive ? office.headScreen() : { x: innerWidth / 2, y: innerHeight / 2 }), async () => {
        edit((s) => applyAnswers(s, x));
        syncReminders();
        if (sc.stage === office) { sc.setStage(null); sc.setView('home'); sc.snapCamera(); }
        sc.post.enabled = postWas;
        pen.dispose();
        ov.dispose(); overlay.current = null;
        releaseBoot();
      });
      sceneRef.current?.owl.play(skipped ? 'wave' : 'present');
      say(skipped ? `Welcome *home!* Let's unpack!` : `Let's *unpack!* Tap the boxes, ${x.you.trim() || 'friend'}!`, 4200);
      window.dispatchEvent(new CustomEvent('hh:intro-done', { detail: { skipped } }));
    };

    // ---------------------------------------------------------------- what the form can do
    actions.current = {
      pick: (v) => {
        if (phase !== 'ask') return;
        const s = st(), a = U.a;
        if (s.kind === 'text') { set({ ...a, name: v }); cards.plate.name = v; office.setNameplate(v); office.sparkle(office.head, 4); play('pencil', 0.4); inkLoop(v); return; }
        if (s.kind === 'species') {
          if (a.species !== v) { set({ ...a, species: v }); office.setLook(lookFor(v)); play('paper_flip', 0.35); }
          U.picked[s.id] = true; bump();
          inkLoop(v);
        } else if (s.kind === 'multi') {
          const f = s.field as 'goals' | 'relax' | 'blocks', cur = a[f], on = !cur.includes(v), next = on ? [...cur, v] : cur.filter((x) => x !== v);
          // [tutor] the obstacles page fills the profile fields the old latency / phone / caffeine / goals pages did
          set(f === 'blocks' ? fromBlocks(a, next) : { ...a, [f]: next });
          if (f === 'blocks' && v === 'phone') window.setTimeout(frameAsk, 60); // the pretend phone comes up beside Pip
          const tape = f === 'relax' && RELAX.find((r) => r.v === v)?.sound && TAPES.some((t) => t.id === v);
          if (on) {
            if (tape) insertTape(v); else reactTo.show(`${s.id}:${v}`);
            office.pip.play('nod');
            inkTick(v);
          } else {
            if (tape && U.deckTape === v) { U.deckTape = null; bump(); reactTo.show(null); deckTo(null); play('drawer_open', 0.35, 1.2); } else { reactTo.show(null); }
            play('ui_back', 0.3);
            return;
          }
        } else if (s.kind === 'choice') {
          set({ ...a, [s.field!]: s.id === 'mic' ? v === 'yes' : v } as Answers);
          U.picked[s.id] = true;
          reactTo.show(`${s.id}:${v}`);
          inkLoop(v);
        }
        haptic();
      },
      drink: (v) => {
        if (phase !== 'ask') return;
        const d = DRINKS.find((x) => x.v === v);
        if (!d) return;
        U.drink = v;
        if (!d.caffeine) { set({ ...U.a, caffeine: 'none' }); U.picked.caffeine = true; }
        else if (U.a.caffeine === 'none') U.picked.caffeine = false;
        bump();
        reactTo.show(`drink:${v}`);
        inkLoop(v);
        haptic();
        if (d.caffeine) window.setTimeout(frameAsk, 60);
      },
      text: (v) => { if (phase !== 'ask') return; const f = st().field as 'you' | 'name'; set({ ...U.a, [f]: v.slice(0, 16) }); cards.plate[f] = v.slice(0, 16); if (f === 'name') office.setNameplate(v.trim() || 'Pip'); play('scribble', 0.2, 0.9 + Math.random() * 0.4); window.requestAnimationFrame(inkLetter); },
      enter: () => void file(),
      nudge: (d) => { const w = hm(toMin(U.a.wake) + d); set({ ...U.a, wake: w }); cards.clockAt = toMin(w); cards.wake = w; office.window(toMin(w) / 60); play('tick_brass', 0.4); },
      ampm: (pm) => { const m = (toMin(U.a.wake) % 720) + (pm ? 720 : 0); set({ ...U.a, wake: hm(m) }); cards.clockAt = m; cards.wake = hm(m); office.window(m / 60); play('pencil', 0.35); inkLoop(pm ? 'pm' : 'am'); },
      clock: (m12) => { const pm = toMin(U.a.wake) >= 720, m = m12 + (pm ? 720 : 0); if (hm(m) === U.a.wake) return; set({ ...U.a, wake: hm(m) }); cards.clockAt = m; cards.wake = hm(m); office.window(m / 60); play('tick_brass', 0.3, 1.1 + Math.random() * 0.2); },
      hours: (v) => { if (v === U.a.hours) return; set({ ...U.a, hours: v }); play('tick_brass', 0.3, 0.8 + (v - 5) * 0.08); if (Math.round(v) !== Math.round(U.a.hours)) play('place_soft', 0.3); office.pip.setMood(v < 7 ? 'worried' : v >= 9 ? 'love' : 'happy', 1.5); },
      sign: () => {
        if (U.signed) return;
        U.signed = true; bump(); play('scribble', 0.5); office.pip.play('nod');
        window.requestAnimationFrame(() => { const el = panelQ('.qp-sign button .s') as HTMLElement | null; if (!el) return; const b = el.getBoundingClientRect(); void pen.sign(b.left + 2 * U.k, b.left + b.width * 0.85, b.bottom - 2 * U.k); });
      },
      remind: () => { U.remind = !U.remind; bump(); play(U.remind ? 'ui_toggle' : 'ui_back', 0.35); },
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
      if (e.key === ' ' || e.key === 'Enter') { if ((e.target as HTMLElement | null)?.closest?.('button')) return; e.preventDefault(); if (phase === 'ask') void file(); else onTap(); }
    };
    addEventListener('keydown', onKey);
    const onResize = () => { U.k = panelScale(); U.wide = isWide(); ov.setScale(U.k); ov.resize(); bump(); window.setTimeout(frameAsk, 50); };
    addEventListener('resize', onResize);
    (window as unknown as { hhIntro: unknown }).hhIntro = { office, speech, overlay: ov, pen, cards, a: () => U.a, file: () => void file(), act: () => actions.current, phase: () => phase, step: () => U.si, skip: () => void finishAll(true) };

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
          if (f === 'blocks') U.a = fromBlocks(U.a, sel.split(','));
          U.picked[s.id] = true;
          if (s.kind === 'species') office.setLook(lookFor(sel), false);
        }
        if (q.get('obdrink')) { U.drink = q.get('obdrink'); if (!DRINKS.find((d) => d.v === U.drink)?.caffeine) { U.a = { ...U.a, caffeine: 'none' }; U.picked.caffeine = true; } }
        if (q.has('obsigned')) U.signed = true;
        if (q.has('obtalk')) { const s = STEPS[i]; talk(q.get('obline') ? [{ text: q.get('obline')!, shot: s.shot }] : s.say(U.a, { artifact: ARTIFACT }).map((b) => beatOf(b)!), () => void enterAsk(i)); office.cut(SHOT[s.shot] ?? s.shot); return; }
        await enterAsk(i);
        office.cut('ask');
        if (q.get('obtape')) window.setTimeout(() => insertTape(q.get('obtape')!), 2500);
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
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerdown', onMove);
      document.removeEventListener('mouseleave', onLeave);
      clearTimeout(autoT);
      reactTo.show(null);
      speech.dispose();
      cards.dispose();
      pen.dispose();
      overlay.current?.dispose(); overlay.current = null;
      if (sc.stage === office) sc.setStage(null);
      sc.post.enabled = postWas;
      releaseBoot();
    };
  }, []);

  const U = ui.current;
  const st = STEPS[U.si];
  const ready = st ? (st.kind === 'plan' ? U.signed : st.kind !== 'choice' || !!U.picked[st.id]) : false;
  const showPhone = U.show && phoneUp(U);
  const spot = showPhone ? phoneSpot(panelEl.current?.getBoundingClientRect() ?? null, U.wide) : null;
  return (
    <div class="ob">
      {U.show && st && overlay.current && models.current && actions.current && (
        <Panel key={st.id} step={st} index={U.si} total={STEPS.length} overlay={overlay.current} model={models.current.model} k={U.k} wide={U.wide} leaving={U.leaving} sheetRef={panelEl}
          act={actions.current}
          s={{ a: U.a, picked: U.picked, remind: U.remind, signed: U.signed, stamped: U.stamped, ready, hour12: save.value.settings.hour12, artifact: ARTIFACT, plan: planOf(U.a), skipAsk: U.skipAsk, drink: U.drink, deckTape: U.deckTape }} />
      )}
      {spot && <FakePhone k={spot.k} wake={planOf(U.a).wake} hour12={save.value.settings.hour12} loop sound={false} style={`position:fixed;left:${spot.x}px;top:${spot.y}px;z-index:43;animation:qp-phone-in .5s steps(8) both`} />}
      {showPhone && <style>{'@keyframes qp-phone-in{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}'}</style>}
    </div>
  );
}
