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
import { Hud, MainNav, SideTools } from './chrome/hud.tsx';
import { SleepScreen } from './sleepflow.tsx';
import { ClockScreen } from './clockscreen.tsx';
import { Book } from './book/book.tsx';
import { BuildMode } from './build.tsx';
import { Shop } from './shop/shop.tsx';
import { Intro } from './intro.tsx';

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
    <div class={'ticket' + (away ? ' away' : '')}>
      <div class="when"><IcoMoon size={40} style="margin:0 auto" /><small>{late ? 'LATE' : 'BED'}</small></div>
      <div class="grow">
        <b class="display" style="font-size:17px">{late ? 'Past bedtime, sleepyhead' : soon ? `Bedtime in ${fmtDur(diff)}` : `Bedtime at ${fmtHM(bed, s.settings.hour12)}`}</b>
        <div class="small muted">Wake {fmtHM(p.wake, s.settings.hour12)} · tonight: {AREA[s.area]?.name}</div>
      </div>
      <button class={'btn pillow sm' + (late || soon ? ' night' : '')} onClick={() => { tap('ui_open'); panel.value = 'sleep'; }}>{late || soon ? 'Get cozy' : 'Plan'}</button>
    </div>
  );
}

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
      el.style.left = `${Math.max(130, Math.min(innerWidth - 130, p.x))}px`;
      el.style.top = `${Math.max(90, p.y - 12)}px`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [b?.id]);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!b) return;
    setShown(0);
    let i = 0;
    const voices = ['voice_a', 'voice_b', 'voice_c', 'voice_e'];
    const id = setInterval(() => {
      i++;
      setShown(i);
      const ch = b.text[i - 1] ?? '';
      // Pip's little voice: a soft blip every other letter, pitched by the letter
      if (i % 2 === 0 && /[a-z]/i.test(ch)) sound.play(voices[ch.charCodeAt(0) % voices.length], { volume: 0.18, rate: 1.5 + ((ch.charCodeAt(0) * 7) % 11) / 40, gap: 40 });
      if (i >= b.text.length) clearInterval(id);
    }, 28);
    return () => clearInterval(id);
  }, [b?.id]);
  if (!b || phase.value !== 'day' || breathing.value) return null;
  return <div class="bubble" ref={ref} key={b.id}><span class="who">{save.value.name}</span>{b.text.slice(0, shown)}<span style="opacity:0">{b.text.slice(shown)}</span></div>;
}

export function App() {
  const s = save.value;
  const ph = phase.value;
  const night = nightOpen.value ? s.nights.find((n) => n.id === nightOpen.value) : null;
  return (
    <div class="layer">
      <IconDefs />
      <Hud />
      <SideTools />
      <Ticket />
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
