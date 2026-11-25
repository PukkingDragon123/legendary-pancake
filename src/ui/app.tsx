// The app shell: HUD, dock, tonight's ticket, Pip's speech bubble, and whichever sheet, panel or
// overlay is open. The 3D scene lives underneath on its own canvas.
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { Ceremony, Dialogs, Flyers, QuestBoard } from './fx.tsx';
import { bedtimeOf, phase } from '../game/night.ts';
import { save } from '../game/store.ts';
import { AREA } from '../game/catalog.ts';
import { BreathePicker, BreatheSession } from './breathe.tsx';
import { IconDefs, IcoMoon } from './icons.tsx';
import { fmtDur, fmtHM, tap, Toasts, useTick } from './kit.tsx';
import { Morning, NightReport } from './morning.tsx';
import { MapPanel, Wardrobe } from './panels.tsx';
import { Settings } from './settings.tsx';
import { AlarmOverlay, NightOverlay } from './sleep.tsx';
import { breathing, bubble, nightOpen, panel, sceneRef } from './state.ts';
import { Hud, MainNav, openPanel, SideTools } from './chrome/hud.tsx'; // [chrome] openPanel for the ticket
import { LookOut } from './chrome/lookout.tsx'; // [look5] step outside to see the whole oak, and back in
import { uiBurst, uiBurstAt } from './chrome/uifx.ts'; // [chrome] bubble puff, ticket stars
import { clip, DESK_HUD, kFor } from './chrome/objects.ts'; // [ui4] the brass clip on tonight's card
import { SleepScreen } from './sleepflow.tsx';
import { ClockScreen } from './clockscreen.tsx';
import { Book } from './book/book.tsx';
import { BuildMode } from './build.tsx';
import { Shop } from './shop/shop.tsx';
import { Intro } from './intro.tsx';

// [chrome] Tonight's ticket: a punched paper ticket with a stub, stamped with the place Pip explores.
function Ticket() {
  useTick(30000);
  const s = save.value, p = s.sleep;
  const away = !!panel.value || phase.value !== 'day' || !!breathing.value || !save.value.onboarded;
  const bed = bedtimeOf(p.wake, p.goalMin);
  const [h, m] = bed.split(':').map(Number);
  const now = new Date(), t = new Date(now);
  t.setHours(h, m, 0, 0);
  let diff = t.getTime() - now.getTime();
  if (diff < -6 * 3600_000) diff += 24 * 3600_000;
  const late = diff <= 0;
  const soon = !late && diff < 90 * 60_000;
  return (
    <div class={'hh-ticket' + (away ? ' away' : '')}>
      <img class="hh-tkt-clip" src={clip(kFor(DESK_HUD), 1)} alt="" draggable={false} />
      <div class={'hh-tkt-stub' + (late ? ' late' : '')}><IcoMoon size={40} /><small>{late ? 'LATE' : 'BED'}</small></div>
      <i class="hh-tkt-perf" />
      <div class="hh-tkt-body">
        <div class="t">
          <b class="display">{late ? 'Past bedtime, sleepyhead' : soon ? `Bedtime in ${fmtDur(diff)}` : `Bedtime at ${fmtHM(bed, s.settings.hour12)}`}</b>
          <div class="small muted">Wake {fmtHM(p.wake, s.settings.hour12)} · tonight: {AREA[s.area]?.name}</div>
        </div>
        <button class={'btn pillow sm' + (late || soon ? ' night' : '')} onClick={(e) => { tap('ui_open'); uiBurstAt(e.currentTarget as Element, 'stars', 6); openPanel('sleep'); }}>{late || soon ? 'Get cozy' : 'Plan'}</button>
      </div>
    </div>
  );
}

// [chrome] Pip's speech bubble: pops in from Pip's beak with a little puff, letters hop in as Pip
// "says" them, and a sleepy dot-dot-dot bobs once Pip has finished.
function Bubble() {
  const ref = useRef<HTMLDivElement>(null);
  const b = bubble.value;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const sc = sceneRef.current, el = ref.current;
      if (!sc || !el) return;
      const p = sc.screenOf(sc.owl.headWorld);
      el.style.left = `${Math.max(130, Math.min(innerWidth - 140, p.x))}px`;
      el.style.top = `${Math.max(176, p.y - 12)}px`;
    };
    raf = requestAnimationFrame(loop);
    const puff = setTimeout(() => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); uiBurst('puff', r.left + r.width / 2, r.bottom + 10, 4); }, 60);
    return () => { cancelAnimationFrame(raf); clearTimeout(puff); };
  }, [b?.id]);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!b) return;
    setShown(0);
    let i = 0;
    const t0 = performance.now();
    const voices = ['voice_a', 'voice_b', 'voice_c', 'voice_e'];
    const id = setInterval(() => {
      // letters follow the clock, so a slow device catches up instead of crawling
      const n = Math.min(b.text.length, Math.floor((performance.now() - t0) / 28) + 1);
      if (n === i) return;
      i = n;
      setShown(i);
      const ch = b.text[i - 1] ?? '';
      // Pip's little voice: a soft blip every other letter, pitched by the letter
      if (i % 2 === 0 && /[a-z]/i.test(ch)) sound.play(voices[ch.charCodeAt(0) % voices.length], { volume: 0.18, rate: 1.5 + ((ch.charCodeAt(0) * 7) % 11) / 40, gap: 40 });
      if (i >= b.text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [b?.id]);
  if (!b || phase.value !== 'day' || breathing.value) return null;
  return (
    <div class="hh-bubble" ref={ref} key={b.id}>
      <span class="who">{save.value.name}</span>
      <span class="txt">{[...b.text].map((ch, i) => <span class={'ch' + (i < shown ? ' on' : '') + (i === shown - 1 && ch !== ' ' ? ' new' : '')}>{ch}</span>)}</span>
      {shown >= b.text.length && <i class="bob" />}
    </div>
  );
}

export function App() {
  const s = save.value;
  // [ui4] the in-app "Calm motion" setting quiets every CSS animation, like the system setting does
  useEffect(() => { try { document.documentElement.classList.toggle('hh-still', !!s.settings.reduceMotion); } catch { /* no DOM */ } }, [s.settings.reduceMotion]);
  const ph = phase.value;
  const night = nightOpen.value ? s.nights.find((n) => n.id === nightOpen.value) : null;
  return (
    <div class="layer">
      <IconDefs />
      <Hud />
      <SideTools />
      <Ticket />
      <LookOut />
      <Bubble />
      {ph === 'day' && !breathing.value && (
        panel.value === 'sleep' ? <SleepScreen />
          : panel.value === 'breathe' ? <BreathePicker />
          : panel.value === 'clock' ? <ClockScreen />
          : panel.value === 'book' ? <Book />
          : panel.value === 'build' || panel.value === 'decorate' ? <BuildMode />
          : panel.value === 'shop' ? <Shop />
          : panel.value === 'wardrobe' ? <Wardrobe />
          : panel.value === 'map' ? <MapPanel />
          : panel.value === 'quests' ? <QuestBoard />
          : null
      )}
      {panel.value === 'settings' && <Settings />}
      <MainNav />
      {night && night.report && ph === 'day' && <NightReport s={night} onClose={() => { nightOpen.value = null; }} />}
      {breathing.value && <BreatheSession key={JSON.stringify(breathing.value)} />}
      {ph === 'sleeping' && <NightOverlay />}
      {ph === 'ringing' && <AlarmOverlay />}
      {ph === 'morning' && <Morning />}
      {!s.onboarded && ph === 'day' && <Intro />}
      <Flyers />
      <Ceremony />
      <Dialogs />
      <Toasts />
    </div>
  );
}
