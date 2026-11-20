// Breathe: pick a rhythm, then breathe with Pip in the moonlit clearing. One clock drives the owl's
// chest, the glowing pixel ring, the particle streams, the fireflies gathering and scattering, the
// cues, the chimes and the haptics, so everything moves as one.
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { BreathOverlay } from '../breathe/overlay.ts';
import { BreathSession, PATTERN, PATTERNS, type Phase } from '../breathe/session.ts';
import { dayKey, edit, save } from '../game/store.ts';
import { IcoAcorn, IcoBreath, IcoClose, IcoPause, IcoPlay } from './icons.tsx';
import { haptic, Setting, Sheet, Tags, tap, toast, Toggle } from './kit.tsx';
import { breathing, lines, say, sceneRef } from './state.ts';

function Rhythm(p: { id: string }) {
  const pt = PATTERN[p.id];
  const total = pt.phases.reduce((a, x) => a + x.sec, 0);
  const col = { in: '#e8a83a', hold: '#c9b8e8', out: '#7f9be0', rest: '#c9b8e8' };
  return <div class="rhythm" style="width:100%">{pt.phases.map((x) => <i style={{ width: `${(x.sec / total) * 100}%`, background: col[x.kind], opacity: x.kind === 'hold' || x.kind === 'rest' ? 0.7 : 1 }} />)}</div>;
}

export function BreathePicker() {
  const b = save.value.breath;
  const [follow, setFollow] = useState(false);
  return (
    <Sheet title="Breathe with Pip" sub="A few slow breaths in the moonlit clearing">
      <div class="col" style="gap:8px">
        {PATTERNS.map((p) => (
          <button class={'pattern' + (b.pattern === p.id ? ' on' : '')} onClick={() => { tap('ui_tab', 0.45); edit((x) => { x.breath.pattern = p.id; }); }}>
            <IcoBreath size={40} />
            <div class="grow col" style="gap:4px">
              <div class="spread"><b class="display" style="font-size:17px">{p.name}</b><span class="label">{p.best}</span></div>
              <span class="small muted">{p.blurb}</span>
              <Rhythm id={p.id} />
            </div>
          </button>
        ))}
      </div>
      <div class="card col">
        <div class="label">Length</div>
        <Tags value={b.durationMin} onChange={(v) => edit((x) => { x.breath.durationMin = v; })} options={[{ v: 1, label: '1 min' }, { v: 3, label: '3 min' }, { v: 5, label: '5 min' }, { v: 10, label: '10 min' }]} />
        <Setting title="Follow me" sub="Hold the screen to breathe in, let go to breathe out. Pip follows your pace."><Toggle on={follow} onChange={setFollow} label="Follow me" /></Setting>
        <Setting title="Chimes & haptics" sub="A soft chime and a gentle buzz at each turn"><Toggle on={b.voice} onChange={(v) => edit((x) => { x.breath.voice = v; x.breath.haptics = v; })} label="Chimes" /></Setting>
      </div>
      <button class="btn pillow honey big block" onClick={() => { tap('ui_confirm'); breathing.value = { pattern: b.pattern, minutes: b.durationMin, follow }; }}><IcoPlay size={40} />Begin</button>
    </Sheet>
  );
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
    sc?.moveOwl('log', () => sc.owl.setMood('calm'));
    sc?.setView('breathe');
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
      sc?.breathFx(lung, kind);
      const p = sc ? sc.chestScreen() : { x: innerWidth / 2, y: innerHeight / 2 };
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
    const reward = first ? 20 : 5;
    edit((x) => { x.breath.sessions++; x.breath.minutes += minutes; x.breath.lastDay = today; x.acorns += reward; x.xp += 10; });
    sound.play('bowl', { volume: 0.6 });
    sc?.breathFx(null);
    sc?.owl.setMood('joy', 2.5);
    sc?.owl.play('nod');
    if (sc) { const o = sc.owl.node.position; sc.fx.burst('hearts', o.x, o.y + 1.4, o.z, 4); }
    setDone({ breaths: session.breaths, minutes, reward });
  };

  const close = () => {
    tap('ui_close');
    const sc = sceneRef.current;
    breathing.value = null;
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
            <div class="row" style="gap:6px;font-weight:800"><IcoAcorn size={40} />+{done.reward} acorns{done.reward > 5 ? ' (first today)' : ''}</div>
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
