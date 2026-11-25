// The app shell: HUD, dock, tonight's ticket, Pip's speech bubble, and whichever sheet, panel or
// overlay is open. The 3D scene lives underneath on its own canvas.
import { useEffect, useRef, useState } from 'preact/hooks';
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
import { TalkText } from './talkview.tsx'; // [dialog10]
import type { TalkView } from './talk.ts';

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
          <b class="display">{late ? 'Past bedtime!' : soon ? `Bedtime in ${fmtDur(diff)}` : `Bedtime ${fmtHM(bed, s.settings.hour12)}`}</b>
          <div class="small muted">Wake {fmtHM(p.wake, s.settings.hour12)}</div>
          <div class="small muted hh-tkt-area">{(AREA[s.area]?.name ?? '').replace(/^the /i, '')}</div>
        </div>
        <button class={'btn pillow sm' + (late || soon ? ' night' : '')} onClick={(e) => { tap('ui_open'); uiBurstAt(e.currentTarget as Element, 'stars', 6); openPanel('sleep'); }}>{late || soon ? 'Get cozy' : 'Plan'}</button>
      </div>
    </div>
  );
}

// [dialog10] Pip's words float over his head (ui/talk.ts): 3D letters typed with his voice and a person's rhythm,
// *highlights* in gold, !screams! red-hot. They follow his head with a little lag and drift away when he is done;
// a tap finishes a line that is still typing, a second tap sends it away.
function Bubble() {
  const ref = useRef<HTMLDivElement>(null);
  const view = useRef<TalkView | null>(null);
  const b = bubble.value;
  const [up, setUp] = useState(false);
  useEffect(() => { if (b) setUp(true); }, [b?.id]);
  useEffect(() => {
    if (!up) return undefined;
    let raf = 0, x = NaN, y = NaN, last = performance.now(), frame = 0, right = innerWidth;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sc = sceneRef.current, el = ref.current, v = view.current;
      if (!sc || !el) return;
      // keep clear of the tool buttons down the right-hand side
      if (frame++ % 30 === 0) { const t = document.querySelector('.tools')?.getBoundingClientRect(); right = t && t.width > 0 ? Math.min(innerWidth, t.left - 12) : innerWidth; }
      const p = sc.screenOf(sc.owl.headWorld);
      const w = v ? v.cssW : 240, h = v ? v.cssH : 90;
      const tx = Math.max(w / 2 + 2, Math.min(right - w / 2, p.x)), ty = Math.max(h + 54, p.y - 44); // above his hat, too
      if (Number.isNaN(x)) { x = tx; y = ty; }
      const k = 1 - Math.exp(-dt * 9), nx = x + (tx - x) * k, ny = y + (ty - y) * k;
      v?.drift(-(nx - x) * 0.2, -(ny - y) * 0.2);
      x = nx; y = ny;
      const d = devicePixelRatio || 1;
      el.style.left = `${Math.round(x * d) / d}px`;
      el.style.top = `${Math.round(y * d) / d}px`;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [up]);
  useEffect(() => {
    if (!b) return undefined;
    const puff = setTimeout(() => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect(); uiBurst('puff', r.left + r.width / 2, r.bottom + 4, 3); }, 60); // [chrome]
    return () => clearTimeout(puff);
  }, [b?.id]);
  if (!up || phase.value !== 'day' || breathing.value || panel.value) return null; // his words stay at home
  const phone = innerWidth < 600;
  return (
    <div class="hh-bubble hh-float" ref={ref}>
      <TalkText text={b ? b.text : null} id={b?.id} who={save.value.name} viewRef={view}
        opts={{ size: phone ? 18 : 22, maxWidth: Math.min(innerWidth - 100, phone ? 290 : 400), anchor: 'bottom', voice: 'pip', scrim: 0.34, tag: true }}
        onNext={() => { if (bubble.value?.id === b?.id) bubble.value = null; }} onIdle={() => { if (!bubble.value) setUp(false); }} />
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
