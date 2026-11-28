// [tutor] The guided tour of the hollow, right after the interview (and again from Settings). Pip himself shows you
// round: when you tap him in the room he pops out of it in a puff of feathers and flies over the interface (the
// real 3D owl, your species and outfit, on his own little canvas: guide.ts). He flies from one thing to the next,
// lands on top of it (or hovers beside it) and points with a wing; the room dusks a little, the thing sits in a pool
// of lamplight inside a breathing pixel-art ring, sparkles stream from his wing to it and fireflies drift about
// (fx.ts). He talks on a parchment card in a carved walnut frame, typed in ink with his voice (ink.tsx), with
// wooden Skip and Next buttons. Each stop waits for the real action (tapping Pip, opening a place); inside a place he
// perches on his card and explains, then flies to its way home. Progress is kept in the save (a reload resumes at
// the same stop) and Skip ends the tour at any time. At the end acorns burst out of him, and he flies back into the
// room.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Box3, Vector3 } from 'three';
import { sound } from '../../audio/sound.ts';
import { phase } from '../../game/night.ts';
import { edit, save } from '../../game/store.ts';
import { artPx } from '../../gfx/artpx.ts';
import { uiBurst } from '../chrome/uifx.ts';
import { flyReward } from '../fx.tsx';
import { nineCSS } from '../real/kit.ts';
import { Paper } from '../sleepkit.tsx';
import { breathing, bubble, nightOpen, panel, sceneRef, type Panel } from '../state.ts';
import { paintFx } from './fx.ts';
import { GuideOwl } from './guide.ts';
import { InkText } from './ink.tsx';
import { cardFor, spotFor, spotOnCard, union, type Rect, type Spot } from './layout.ts';
import { BACK, resumeAt, TOUR, type Target } from './steps.ts';
import './tutorial.css';

type Beat = 'point' | 'look' | 'back';

const play = (id: string, volume = 0.4, rate = 1) => { try { sound.play(id, { volume, rate, gap: 60 }); } catch { /* no audio */ } };
const owl3d = () => sceneRef.current?.owl ?? null;

/** what Pip says to point at a place's own way home */
const BACK_LINE: Partial<Record<NonNullable<Panel>, string>> = {
  shop: 'When you’re done looking, tap *Leave* to come home.',
  build: 'Tap *Done* when you’ve had a look.',
  wardrobe: 'Tap the *cross* to close the wardrobe.',
  quests: 'Tap the *cross* to close the board.',
  profile: 'Tap the *cross* to close it again.',
};

let styled = false;
function installCSS() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'hh-tutor';
  try { st.textContent = `.tt-name{${nineCSS('plaque')}}`; } catch { /* not painted */ }
  document.head.appendChild(st);
}

/** the screen box of a target: Pip (the owl's bounds in the 3D room) or an element on the page */
const box3 = new Box3(), v3 = new Vector3();
function rectOf(t: Target | undefined): Rect | null {
  if (!t) return null;
  if (t === 'pip') {
    const sc = sceneRef.current;
    if (!sc) return null;
    const root = sc.owl.model.rig.root, was = root.visible;
    root.visible = true;
    box3.setFromObject(sc.owl.node);
    root.visible = was;
    if (box3.isEmpty()) return null;
    const cx = (box3.min.x + box3.max.x) / 2, cz = (box3.min.z + box3.max.z) / 2;
    const top = sc.screenOf(v3.set(cx, box3.max.y, cz)), bot = sc.screenOf(v3.set(cx, box3.min.y, cz));
    if (top.behind || bot.behind) return null;
    const h = Math.max(40, bot.y - top.y), w = h * 0.78;
    return { x: (top.x + bot.x) / 2 - w / 2, y: top.y, w, h };
  }
  for (const el of document.querySelectorAll(t)) {
    const r = (el as HTMLElement).getBoundingClientRect();
    // on screen and not slid away with its hiding HUD
    if (r.width < 4 || r.height < 4 || r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) continue;
    if ((el as HTMLElement).closest('.away')) continue;
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  return null;
}
const same = (a: Rect | null, b: Rect | null) => (!a || !b ? a === b : Math.abs(a.x - b.x) < 1.5 && Math.abs(a.y - b.y) < 1.5 && Math.abs(a.w - b.w) < 1.5 && Math.abs(a.h - b.h) < 1.5);
const pad = (r: Rect, p: number): Rect => ({ x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p });

/** the tour is on screen when the hollow is in its plain day state */
function useEligible(): boolean {
  const s = save.value;
  const ok = s.onboarded && !s.tutorial?.done && phase.value === 'day' && !breathing.value && !nightOpen.value;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ok) { setReady(false); return undefined; }
    // the loading screen and the interview's iris have to be gone first, then a breath
    let t = 0;
    const check = () => {
      const b = document.getElementById('boot');
      if (b && b.style.display !== 'none' && !b.classList.contains('gone')) { t = window.setTimeout(check, 400); return; }
      t = window.setTimeout(() => setReady(true), 1600);
    };
    check();
    return () => clearTimeout(t);
  }, [ok]);
  return ok && ready;
}

export function Tutorial() {
  const on = useEligible();
  return on ? <Tour /> : null;
}

function Tour() {
  installCSS();
  const s = save.value;
  const i = resumeAt(s.tutorial) ?? 0;
  const st = TOUR[i];
  const pv = panel.value;
  // the beat, the line and the hush (Pip's own reaction playing after a tap on him) belong to one stop: a new stop
  // starts pointing at its first line in the very render it arrives (no stale beat for one frame)
  const [bs, setBs] = useState({ i, beat: 'point' as Beat, line: 0, hush: false });
  const mine = bs.i === i;
  const beat: Beat = mine ? bs.beat : 'point', line = mine ? bs.line : 0, hush = mine && bs.hush;
  const setBeat = (b: Beat) => setBs({ i, beat: b, line: 0, hush: false });
  const setLine = (n: number) => setBs({ i, beat, line: n, hush: false });
  const setHush = () => setBs({ i, beat, line, hush: true });
  const [rect, setRect] = useState<Rect | null>(null);
  const [leaving, setLeaving] = useState(false);
  /** the line that has been shown (it types once the card is up) and the line that has finished typing */
  const [shown, setShown] = useState('');
  const [typed, setTyped] = useState('');
  const fxRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const guide = useRef<GuideOwl | null>(null);
  /** Pip is out of the room (flying over the interface); the 3D owl hides meanwhile */
  const out = useRef(i > 0);
  const pulse = useRef(9);
  const burst = useRef<{ x: number; y: number; t0: number } | null>(null);
  const who = s.profile.you.trim() || 'friend';
  const phone = Math.min(innerWidth, innerHeight) < 600;

  // the stop and its beat: pointing at the button, looking round the place, or finding the way home
  const stray = beat === 'point' && pv !== null && pv !== st.wait;
  const lines = stray ? ['Oops, that’s for later! Let’s go *back* first.']
    : beat === 'look' ? (st.inside ?? [])
    : beat === 'back' ? [BACK_LINE[pv ?? 'sleep'] ?? 'Tap *Back* to come home.']
    : st.say(who);
  const li = Math.min(line, Math.max(0, lines.length - 1));
  const last = li >= lines.length - 1;
  const target: Target | undefined = stray ? BACK[pv!] : beat === 'back' ? (st.back ?? (pv ? BACK[pv] : undefined)) : beat === 'look' ? undefined : st.target;
  const isPip = target === 'pip';
  // the room dusks while Pip shows something to tap
  const dim = !hush && !leaving && beat !== 'look' && (beat === 'point' && !stray ? !!st.target : !!rect);
  const sayKey = `${i}:${beat}:${stray ? 's' : ''}:${li}`;
  const text = lines[li] ?? '';
  const waits = !!target && (beat === 'back' || stray || (beat === 'point' && !!st.wait));

  /** save the stop (and give its acorns once), then move on */
  const go = (n: number) => {
    // (read from the save itself: a stop that is already passed never moves the tour or pays twice)
    const cur = save.value.tutorial;
    if ((resumeAt(cur) ?? -1) !== i) return;
    const gift = st.gift && !cur?.gift ? st.gift : 0;
    edit((x) => {
      const t = { done: false, step: 0, ...x.tutorial };
      if (gift) { x.coins += gift; t.gift = true; }
      x.tutorial = n >= TOUR.length ? { ...t, done: true, step: TOUR.length - 1 } : { ...t, done: false, step: n };
    });
    if (gift) reward(gift);
  };
  /** the reward: acorns burst out of Pip and fly to the purse, with a flash of golden rays */
  const reward = (n: number) => {
    const g = guide.current, b = cardRef.current?.getBoundingClientRect();
    const at = g?.visible ? { x: g.x, y: g.y - g.size * 0.55 } : b ? { x: b.left + b.width / 2, y: b.top } : { x: innerWidth / 2, y: innerHeight / 2 };
    burst.current = { ...at, t0: performance.now() };
    uiBurst('acorns', at.x, at.y, 16);
    uiBurst('stars', at.x, at.y, 10);
    flyReward('acorn', n, at);
    g?.play('present', 'joy');
    play('reward_quest', 0.55);
    play('sparkle', 0.4);
  };
  /** Pip back into the room: a puff where he is, the 3D owl again */
  const home = () => {
    const g = guide.current;
    if (g?.visible) { uiBurst('puff', g.x, g.y - g.size * 0.5, 7); uiBurst('feathers', g.x, g.y - g.size * 0.5, 5); g.hide(); }
    out.current = false;
    const o = owl3d();
    if (o) o.model.rig.root.visible = true;
  };
  const skip = () => {
    play('ui_close', 0.4);
    play('pop_puff', 0.4);
    home();
    edit((x) => { x.tutorial = { done: true, step: x.tutorial?.step ?? 0, ...(x.tutorial?.gift ? { gift: true } : {}) }; });
  };
  const next = () => {
    play('ui_tap', 0.35);
    if (!last) { setLine(li + 1); return; }
    if (beat === 'look') { setBeat('back'); return; }
    if (beat === 'point' && st.id === 'done') { setLeaving(true); return; }
    if (beat === 'point' && (st.next || st.optional)) go(i + 1);
  };
  const canNext = !stray && !hush && !leaving && (!last || beat === 'look' || (beat === 'point' && (!!st.next || !!st.optional)));
  const nextLabel = last && beat === 'point' && st.next ? st.next : last && beat === 'look' ? 'Got it' : 'Next';

  // the guide: made once, given back when the tour goes
  useEffect(() => {
    let g: GuideOwl | null = null;
    try { g = new GuideOwl(save.value.look, phone ? 60 : 80); } catch (e) { console.warn('tour guide unavailable', e); g = null; }
    guide.current = g;
    if (g) {
      rootRef.current?.insertBefore(g.canvas, cardRef.current ?? null);
      g.hide();
      // resuming mid-tour: he flies in from the side
      if (out.current) g.spawn(-60, innerHeight * 0.32);
    }
    return () => {
      const o = owl3d();
      if (o) o.model.rig.root.visible = true;
      g?.dispose();
      guide.current = null;
    };
  }, []);
  useEffect(() => { guide.current?.setLook(s.look); }, [JSON.stringify(s.look)]);

  // Pip reacts as each stop begins
  useEffect(() => {
    bubble.value = null;
    const g = guide.current;
    if (g && out.current) g.play(st.id === 'gift' ? 'present' : st.id === 'done' ? 'dance' : i % 2 ? 'nod' : 'hop', st.id === 'done' || st.id === 'gift' ? 'joy' : 'happy');
    const o = owl3d();
    if (o && !out.current) { o.setMood('happy', 2); o.play(st.id === 'hello' ? 'wave' : 'nod'); }
  }, [i]);

  // the real actions: a place opens or closes
  useEffect(() => {
    if (beat === 'point' && st.wait && st.wait !== 'pip' && pv === st.wait) { setBeat('look'); play('sparkle', 0.35); return; }
    if (beat !== 'point' && pv === null) { go(i + 1); }
  }, [pv, beat, i]);
  // ... or Pip is tapped in the room: his own reaction, then he pops out of the room in a puff of feathers
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc || st.wait !== 'pip' || beat !== 'point') return undefined;
    let t = 0;
    const off = sc.on((e) => {
      if (e.type !== 'tapOwl' || t) return;
      setHush(); play('sparkle', 0.4);
      t = window.setTimeout(() => {
        const r = rectOf('pip'), g = guide.current;
        if (g && r) {
          const x = r.x + r.w / 2, y = r.y + r.h * 0.62;
          uiBurst('puff', x, y - 10, 8); uiBurst('feathers', x, y - 10, 6); play('pop_puff', 0.45);
          g.spawn(x, y);
          out.current = true;
        }
        go(i + 1);
      }, 1300);
    });
    return () => { off(); clearTimeout(t); };
  }, [i, beat]);

  // goodbye: he flies back to his place in the room and pops into it
  useEffect(() => {
    if (!leaving) return undefined;
    const g = guide.current, r = rectOf('pip');
    const finish = () => { home(); owl3d()?.play('dance'); play('pop_puff', 0.45); play('ui_confirm', 0.45); go(TOUR.length); };
    if (!g?.visible || !r) { finish(); return undefined; }
    g.go({ x: r.x + r.w / 2, y: r.y + r.h * 0.66, mode: 'hover', face: 0 });
    const id = window.setInterval(() => { if (g.arrived) { clearInterval(id); finish(); } }, 80);
    const stop = window.setTimeout(() => { clearInterval(id); finish(); }, 3200);
    return () => { clearInterval(id); clearTimeout(stop); };
  }, [leaving]);

  // everything that moves, every frame: the target, Pip's flight, the card, the light
  const now = { target, isPip, dim, waits, sayKey, hush, leaving, center: !st.target && beat === 'point' && !stray };
  const live = useRef(now);
  live.current = now;
  useEffect(() => {
    let raf = 0, cur: Rect | null = null, last = performance.now(), dusk = 0, nightT = 0, shownK = '';
    const t0 = last;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const L = live.current, W = innerWidth, H = innerHeight, g = guide.current;
      const ph = Math.min(W, H) < 600, size = ph ? 60 : 80;
      const r = rectOf(L.target);
      if (!same(r, cur)) { cur = r; setRect(r); }
      // the 3D owl stays hidden while Pip is out here with you
      const o = owl3d();
      if (o) o.model.rig.root.visible = !out.current;
      if (g) {
        if (g.size !== size) g.resize(size);
        if ((nightT -= dt) <= 0) { nightT = 1; g.setNight((sceneRef.current?.sky.night ?? 0) > 0.5); }
      }
      // the card: its size, then where it and Pip go
      const card = cardRef.current;
      const cw = Math.round(Math.min(ph ? W - 20 : 400, W - 20));
      let spot: Spot | null = null;
      let cardBox: Rect | null = null;
      if (card) {
        const ch = card.offsetHeight || 140;
        const gOut = !!g && out.current;
        if (L.leaving) { /* he is on his way home */ }
        else if (r && !L.hush) {
          spot = gOut && !L.isPip ? spotFor(pad(r, 6), size, W, H) : null;
          const near = spot ? union(r, spot.box) : r;
          const avoid = spot ? [pad(r, 4), spot.box] : [r];
          const c = cardFor(near, avoid, cw, ch, W, H, ph ? 230 : 280);
          cardBox = { x: c.x, y: c.y, w: c.w, h: ch };
          card.dataset.side = c.side;
          // the tail points at whoever is talking: Pip out here, or the owl in the room
          const p = spot ? spot.box : r;
          const pcx = p.x + p.w / 2, pcy = p.y + p.h * 0.4;
          const side = c.side === 'above' ? 'b' : c.side === 'below' ? 't' : c.side === 'left' ? 'r' : c.side === 'right' ? 'l' : (pcy > c.y + ch ? 'b' : 't');
          card.dataset.tail = side;
          const off = side === 't' || side === 'b' ? Math.max(26, Math.min(c.w - 26, pcx - c.x)) : Math.max(24, Math.min(ch - 24, pcy - c.y));
          card.style.setProperty('--tail', `${Math.round(off)}px`);
        } else {
          // nothing to point at: the card hangs at the top while a place is open, mid-screen for the gift and goodbye
          const y = L.center ? Math.round(H * (ph ? 0.46 : 0.42) - ch / 2) : Math.round(Math.max(size * 1.2 + 14, ph ? 92 : 96));
          cardBox = { x: Math.round((W - cw) / 2), y, w: cw, h: ch };
          card.dataset.tail = '';
          if (gOut) spot = spotOnCard(cardBox, size);
        }
        if (cardBox) {
          card.style.left = `${cardBox.x}px`; card.style.top = `${cardBox.y}px`; card.style.width = `${cardBox.w}px`;
        }
      }
      if (hitRef.current) hitRef.current.style.display = g && out.current && g.visible ? '' : 'none';
      if (g && out.current) {
        if (spot) g.go(spot);
        g.step(dt);
        const hit = hitRef.current;
        if (hit) { const b = g.box(); hit.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(b.y)}px)`; hit.style.width = `${Math.round(b.w)}px`; hit.style.height = `${Math.round(b.h)}px`; }
      }
      // the card comes up once Pip has landed
      const ready = !L.hush && !L.leaving && (!g || !out.current || (g.arrived && !g.flying) || L.isPip);
      if (card) card.classList.toggle('show', ready);
      if (ready && shownK !== L.sayKey) { shownK = L.sayKey; setShown(L.sayKey); }
      // the light
      const c = fxRef.current;
      if (!c) return;
      const dpr = Math.min(2, devicePixelRatio || 1);
      const CW = Math.round(W * dpr), CH = Math.round(H * dpr);
      if (c.width !== CW || c.height !== CH) { c.width = CW; c.height = CH; }
      const gx = c.getContext('2d');
      if (!gx) return;
      dusk += ((L.dim && r ? 1 : 0) - dusk) * (1 - Math.exp(-dt * 4));
      const perched = !!g && out.current && g.visible && g.arrived && !g.flying;
      const gs = perched && g ? g.goal : null;
      const wantTrail = perched && r && L.waits && gs && (gs as Spot).on !== 'top' && (gs as Spot).on !== 'card';
      const tip = g?.wingTip();
      const to = r && tip ? { x: Math.max(r.x - 6, Math.min(r.x + r.w + 6, tip.x)), y: Math.max(r.y - 6, Math.min(r.y + r.h + 6, tip.y)) } : null;
      const b = burst.current;
      paintFx(gx, {
        t: (now - t0) / 1000, dt, dpr, px: artPx(), W, H,
        spot: r && L.dim ? r : null, round: L.isPip, dusk,
        ring: !!r && L.dim && L.waits, pulse: pulse.current,
        trail: wantTrail && tip && to ? { from: tip, to } : null,
        shadow: perched && g && g.goal?.mode === 'perch' ? { x: g.x, y: g.y + 1, w: g.size * 0.8 } : null,
        burst: b ? { x: b.x, y: b.y, age: (now - b.t0) / 1000 } : null,
      });
      pulse.current += dt;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // a tap anywhere else while Pip waits for one thing: "over here!"
  const nudge = (e: Event) => {
    e.stopPropagation();
    pulse.current = 0;
    guide.current?.nudge();
    play('ui_tap', 0.25, 0.8);
  };
  const blocks = (() => {
    if (!dim) return null;
    if (!rect) return beat === 'back' || stray ? null : [{ x: 0, y: 0, w: innerWidth, h: innerHeight }];
    const h = pad(rect, 10), W = innerWidth, H = innerHeight;
    return [
      { x: 0, y: 0, w: W, h: Math.max(0, h.y) },
      { x: 0, y: h.y + h.h, w: W, h: Math.max(0, H - h.y - h.h) },
      { x: 0, y: h.y, w: Math.max(0, h.x), h: h.h },
      { x: h.x + h.w, y: h.y, w: Math.max(0, W - h.x - h.w), h: h.h },
    ];
  })();

  // the words type once the card is up; a tap on them finishes the line, a second tap moves on
  const up = shown === sayKey;
  const done = typed === sayKey;
  const tapWords = () => { if (!up) return; if (!done) setTyped(sayKey); else if (canNext) next(); };
  useLayoutEffect(() => { setTyped(''); }, [sayKey]);
  const n = TOUR.length;
  const hint = isPip ? 'Tap Pip!' : beat === 'back' || stray ? 'Tap it to come back' : 'Tap it!';
  return (
    <div class="tt" ref={rootRef} role="dialog" aria-label={`Tour of the hollow, step ${i + 1} of ${n}`}>
      <canvas ref={fxRef} class="tt-fx" aria-hidden="true" />
      {blocks?.map((b, k) => <div key={k} class="tt-block" onPointerDown={nudge} style={{ left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` }} />)}
      <div ref={hitRef} class="tt-hit" aria-hidden="true" onPointerDown={(e) => { e.stopPropagation(); guide.current?.poke(); play('owl_hoot', 0.3); }} />
      <div ref={cardRef} class="tt-card" key={`card${i}:${beat}`} aria-live="polite">
        <div class="tt-board hh-wood-dark">
          <b class="tt-name">Pip</b>
          <div onPointerDown={tapWords} data-fx-shield>
            <Paper kind="parchment" class="tt-paper">
              <InkText text={text} id={sayKey} run={up} done={done} onDone={() => setTyped(sayKey)} />
            </Paper>
          </div>
          <div class="tt-row">
            <button class="btn soft sm tt-skip" onClick={skip} aria-label="Skip the tour">Skip</button>
            <span class="tt-dots" aria-hidden="true">{TOUR.map((_, k) => <i key={k} class={k < i ? 'on' : k === i ? 'cur' : ''} />)}</span>
            <span class="tt-count" aria-hidden="true">{i + 1}<small>of</small>{n}</span>
            {canNext ? <button class="btn pillow honey sm tt-next" onClick={next}>{nextLabel}</button> : <span class="tt-hint">{hint}</span>}
          </div>
        </div>
        <i class="tt-tail" aria-hidden="true" />
      </div>
    </div>
  );
}

/** Start the tour again from the first stop (Settings). The acorns are not given twice. */
export function replayTutorial() {
  edit((x) => { x.tutorial = { done: false, step: 0, ...(x.tutorial?.gift ? { gift: true } : {}) }; });
}

