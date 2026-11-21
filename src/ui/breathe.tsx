// Breathe: pick a rhythm, then breathe with Pip in the moonlit clearing. One clock drives the owl's
// chest, the glowing pixel ring, the particle streams, the fireflies gathering and scattering, the
// cues, the chimes and the haptics, so everything moves as one.
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { BreathOverlay } from '../breathe/overlay.ts';
import { BreathSession, PATTERN, PATTERNS, type Phase } from '../breathe/session.ts';
import { dayKey, edit, save } from '../game/store.ts';
import { IcoAcorn, IcoBreath, IcoClose, IcoPause, IcoPlay } from './icons.tsx';
import { haptic, tap, toast, Toggle } from './kit.tsx';
import { breathing, lines, panel, say, sceneRef } from './state.ts';
import { phase } from '../game/night.ts';
import { injectSleepFrames } from './sleepkit.tsx';
import './breathe.css';
import { progress } from '../game/quests.ts';
import { flyReward } from './fx.tsx';

function Rhythm(p: { id: string; live?: boolean }) {
  const pt = PATTERN[p.id];
  const total = pt.phases.reduce((a, x) => a + x.sec, 0);
  const col = { in: '#e8a83a', hold: '#c9b8e8', out: '#7f9be0', rest: '#c9b8e8' };
  const head = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!p.live || !head.current) return;
    const a = head.current.animate([{ left: '0%' }, { left: '100%' }], { duration: total * 1000, iterations: Infinity, easing: 'linear' });
    return () => a.cancel();
  }, [p.live, p.id]);
  return <div class="rhythm" style="width:100%;position:relative">{pt.phases.map((x) => <i style={{ width: `${(x.sec / total) * 100}%`, background: col[x.kind], opacity: x.kind === 'hold' || x.kind === 'rest' ? 0.7 : 1 }} />)}{p.live && <b class="playhead" ref={head as any} />}</div>;
}

/** The pattern's lantern breathes the rhythm itself: swells on the inhale, rests, settles on the exhale. */
function Lantern(p: { id: string; live: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!p.live || !el.current) return;
    const pt = PATTERN[p.id], total = pt.phases.reduce((a, x) => a + x.sec, 0);
    let t = 0, sc = 0.86;
    const frames: Keyframe[] = [{ offset: 0, transform: `scale(${sc})`, filter: 'drop-shadow(0 0 0 rgba(255,214,120,0))' }];
    for (const ph of pt.phases) {
      t += ph.sec;
      if (ph.kind === 'in') sc = Math.min(1.28, sc + 0.42 * (ph.sec / 4));
      if (ph.kind === 'out') sc = 0.86;
      const glow = (sc - 0.86) / 0.42;
      frames.push({ offset: t / total, transform: `scale(${sc.toFixed(3)})`, filter: `drop-shadow(0 0 ${Math.round(glow * 10)}px rgba(255,214,120,${(glow * 0.9).toFixed(2)}))` });
    }
    const a = el.current.animate(frames, { duration: total * 1000, iterations: Infinity, easing: 'ease-in-out' });
    return () => a.cancel();
  }, [p.live, p.id]);
  return <span class="lantern" ref={el}><IcoBreath size={40} /></span>;
}

/**
 * Choose a rhythm: lantern cards on a dark wooden board, each lantern swelling with its own
 * breath. `embedded` shows it inside another screen (the bedtime ritual) instead of on its own.
 */
export function BreathePicker(p: { embedded?: boolean; preset?: string; onClose?: () => void; onBegin?: () => void } = {}) {
  injectSleepFrames();
  const b = save.value.breath;
  const [follow, setFollow] = useState(false);
  useEffect(() => { if (p.preset && PATTERN[p.preset] && b.pattern !== p.preset) edit((x) => { x.breath.pattern = p.preset!; }); }, []);
  const close = () => { tap('ui_close', 0.45); if (p.onClose) p.onClose(); else if (panel.value === 'breathe') panel.value = null; };
  const board = (
    <div class={'bp hh-wood-dark' + (p.embedded ? ' embedded' : '')} role="dialog" aria-label="Breathe with Pip">
      <header class="bp-head">
        <span class="bp-lamp"><IcoBreath size={40} /></span>
        <div class="grow"><h2>Breathe with Pip</h2><p>Pick a rhythm. Pip breathes it with you.</p></div>
        <button class="bp-x" aria-label="Close" onClick={close}><IcoClose size={30} /></button>
      </header>
      <div class="bp-list">
        {PATTERNS.map((pt) => (
          <button class={'bp-card' + (b.pattern === pt.id ? ' on' : '')} style={{ '--pc': pt.color } as any} onClick={() => { tap('ui_tab', 0.45); edit((x) => { x.breath.pattern = pt.id; }); }}>
            <Lantern id={pt.id} live={b.pattern === pt.id} />
            <div class="grow col" style="gap:3px">
              <div class="spread"><b>{pt.name}</b><span class="bp-best">{pt.best}</span></div>
              <small>{pt.blurb}</small>
              <Rhythm id={pt.id} live={b.pattern === pt.id} />
            </div>
          </button>
        ))}
      </div>
      <div class="bp-opts">
        <div class="bp-len"><span>Length</span>{[1, 3, 5, 10].map((m) => <button class={'hh-tab' + (b.durationMin === m ? ' on' : '')} onClick={() => { tap('ui_tab', 0.4); edit((x) => { x.breath.durationMin = m; }); }}>{m} min</button>)}</div>
        <div class="bp-toggle"><span class="grow"><b>Follow me</b><small>Hold the screen to breathe in, let go to breathe out</small></span><Toggle on={follow} onChange={setFollow} label="Follow me" /></div>
        <div class="bp-toggle"><span class="grow"><b>Chimes and haptics</b><small>A soft chime and buzz at each turn</small></span><Toggle on={b.voice} onChange={(v) => edit((x) => { x.breath.voice = v; x.breath.haptics = v; })} label="Chimes" /></div>
      </div>
      <button class="hh-btn-gold bp-go" onClick={() => { tap('ui_confirm'); p.onBegin?.(); breathing.value = { pattern: b.pattern, minutes: b.durationMin, follow }; }}><IcoPlay size={40} />Begin</button>
    </div>
  );
  if (p.embedded) return board;
  return <div class="bp-back" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>{board}</div>;
}

export function BreatheSession() {
  const cfg = breathing.value!;
  const host = useRef<HTMLDivElement>(null);
  const [cue, setCue] = useState<{ label: string; left: number; cycle: number; cycles: number; follow: boolean }>({ label: 'Settle in…', left: 0, cycle: 0, cycles: 0, follow: cfg.follow });
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState<null | { breaths: number; minutes: number; reward: number }>(null);
  const st = useRef({ paused: false, session: null as BreathSession | null, overlay: null as BreathOverlay | null });

  useEffect(() => {
    const sc = sceneRef.current;
    const b = save.value.breath;
    const pattern = PATTERN[cfg.pattern] ?? PATTERNS[0];
    const session = new BreathSession(pattern, cfg.minutes);
    session.follow = cfg.follow;
    st.current.session = session;
    const overlay = new BreathOverlay(host.current!);
    st.current.overlay = overlay;
    sound.unlock();
    sound.preload(['breath_in', 'breath_out', 'breath_hold', 'bowl']);
    sound.music('music_breath');
    sound.play('bowl', { volume: 0.55 });
    // at night Pip is away exploring: breathe under the night sky instead of at the log
    const night = phase.value === 'sleeping';
    if (!night) { sc?.moveOwl('log', () => sc.owl.setMood('calm')); sc?.setView('breathe'); }
    let warm = 3.2; // a few seconds to settle before the first breath
    session.onPhase = (ph: Phase) => {
      if (!b.voice) return;
      sound.play(ph.kind === 'in' ? 'breath_in' : ph.kind === 'out' ? 'breath_out' : 'breath_hold', { volume: ph.kind === 'hold' || ph.kind === 'rest' ? 0.5 : 0.6 });
      if (b.haptics) haptic(ph.kind === 'in' ? 14 : ph.kind === 'out' ? 9 : 5);
    };
    let last = performance.now(), raf = 0, lastCue = '';
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // (dev) window.__breathSpeed fast-forwards the session for screenshots on slow renderers
      const dt = Math.min(0.05, (now - last) / 1000) * ((window as unknown as { __breathSpeed?: number }).__breathSpeed ?? 1);
      last = now;
      if (st.current.paused) return;
      let lung = 0, kind: Phase['kind'] = 'rest';
      if (warm > 0) { warm -= dt; }
      else {
        const s = session.step(dt);
        lung = s.lung; kind = s.phase.kind;
        const key = s.phase.label + s.left + s.cycle;
        if (key !== lastCue) { lastCue = key; setCue({ label: s.phase.label, left: s.left, cycle: s.cycle, cycles: s.cycles, follow: s.follow }); }
        if (s.done) { finish(session); return; }
      }
      if (!night) sc?.breathFx(lung, kind);
      const p = sc && !night ? sc.chestScreen() : { x: innerWidth / 2, y: innerHeight * 0.46 };
      overlay.draw(dt, p.x, p.y, lung, kind, warm > 0 ? 1 - warm / 3.2 : 1);
    };
    raf = requestAnimationFrame(loop);
    const onResize = () => overlay.resize();
    addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      overlay.dispose();
      sc?.breathFx(null);
      sound.music(null);
    };
  }, []);

  const finish = (session: BreathSession) => {
    const sc = sceneRef.current;
    const minutes = Math.round(session.total / 60) || 1;
    const today = dayKey();
    const first = save.value.breath.lastDay !== today;
    const night = phase.value === 'sleeping';
    const reward = night ? 0 : first ? 20 : 5;
    edit((x) => { x.breath.sessions++; x.breath.minutes += minutes; x.breath.lastDay = today; x.coins += reward; x.xp += night ? 0 : 10; });
    progress('breathe');
    if (reward) setTimeout(() => flyReward('acorn', reward * 3), 600);
    sound.play('bowl', { volume: night ? 0.35 : 0.6 });
    sc?.breathFx(null);
    if (!night) {
      sc?.owl.setMood('joy', 2.5);
      sc?.owl.play('nod');
      if (sc) { const o = sc.owl.node.position; sc.fx.burst('hearts', o.x, o.y + 1.4, o.z, 4); }
    }
    setDone({ breaths: session.breaths, minutes, reward });
  };

  const close = () => {
    tap('ui_close');
    const sc = sceneRef.current;
    breathing.value = null;
    if (phase.value === 'sleeping') { sc?.setView('sleep'); return; }
    sc?.setView('home');
    sc?.moveOwl('porch');
    if (done) setTimeout(() => say(lines.breathe()), 800);
  };

  const press = (on: boolean) => { const s = st.current.session; if (s && s.follow) s.holding = on; };
  const tapBurst = (e: PointerEvent) => { st.current.overlay?.burst(e.clientX, e.clientY); sound.play('sparkle', { volume: 0.25, gap: 120 }); };

  return (
    <div class="overlay" ref={host} style="background:radial-gradient(120% 70% at 50% 40%, rgba(0,0,0,0) 30%, rgba(5,6,18,.55))"
      onPointerDown={(e) => { press(true); if (!cfg.follow) tapBurst(e); }} onPointerUp={() => press(false)} onPointerCancel={() => press(false)}>
      {!done && <div class="breath-cue">
        <h1 key={cue.label}>{cue.label}</h1>
        {!cue.follow && cue.left > 0 && <div class="count">{cue.left}</div>}
      </div>}
      {!done && <div class="breath-foot" onPointerDown={(e) => e.stopPropagation()}>
        {!cue.follow && cue.cycles > 0 && cue.cycles <= 40 && <div class="pips">{Array.from({ length: cue.cycles }, (_, i) => <i class={i < cue.cycle ? 'on' : ''} />)}</div>}
        {cue.follow && <p class="small" style="opacity:.75">{cue.cycle} slow breaths</p>}
        <div class="row" style="gap:12px">
          <button class="icon-btn dark" aria-label={paused ? 'Resume' : 'Pause'} onClick={() => { tap(); st.current.paused = !paused; setPaused(!paused); }}>{paused ? <IcoPlay size={40} /> : <IcoPause size={40} />}</button>
          <button class="icon-btn dark" aria-label="End" onClick={() => { const s = st.current.session; if (s && s.breaths > 0) finish(s); else close(); }}><IcoClose size={20} /></button>
        </div>
      </div>}
      {done && (
        <div class="sheet full" style="position:absolute;animation:sheetIn .6s var(--ease)" onPointerDown={(e) => e.stopPropagation()}>
          <div class="grab" />
          <div class="sheet-body center" style="align-items:center;gap:12px">
            <h1>Lovely.</h1>
            <p class="muted">{done.breaths} calm breath{done.breaths === 1 ? '' : 's'} over {done.minutes} minute{done.minutes === 1 ? '' : 's'}. Pip feels all floaty.</p>
            {done.reward > 0 ? <div class="row" style="gap:6px;font-weight:800"><IcoAcorn size={40} />+{done.reward} acorns{done.reward > 5 ? ' (first today)' : ''}</div> : <p class="muted">Now let your eyes close. Goodnight.</p>}
            <div class="row" style="width:100%;gap:10px">
              <button class="btn soft grow" onClick={() => { tap(); breathing.value = null; setTimeout(() => { breathing.value = { ...cfg }; }, 50); }}>Again</button>
              <button class="btn pillow grow" onClick={close}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const _t = toast;
