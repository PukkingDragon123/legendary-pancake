// The app shell: HUD, dock, tonight's ticket, Pip's speech bubble, and whichever sheet, panel or
// overlay is open. The 3D scene lives underneath on its own canvas.
import { useEffect, useRef } from 'preact/hooks';
import { bedtimeOf, phase } from '../game/night.ts';
import { level, save } from '../game/store.ts';
import { AREA } from '../game/catalog.ts';
import { BreathePicker, BreatheSession } from './breathe.tsx';
import { IcoAcorn, IcoBrush, IcoCandle, IcoClock, IcoGear, IcoHanger, IcoHouse, IcoJar, IcoJournal, IcoMap, IcoMoon, IcoSatchel, IconDefs, IcoStone } from './icons.tsx';
import { Journal } from './journal.tsx';
import { fmtDur, fmtHM, Rolling, tap, Toasts, useTick } from './kit.tsx';
import { Market } from './market.tsx';
import { Morning, NightReport } from './morning.tsx';
import { Decorate, MapPanel, Wardrobe } from './panels.tsx';
import { portrait } from './portraits.ts';
import { Onboarding, Settings } from './settings.tsx';
import { AlarmOverlay, NightOverlay, SleepSheet } from './sleep.tsx';
import { breathing, bubble, nightOpen, panel, sceneRef, tab, type Tab } from './state.ts';

function Hud() {
  const s = save.value, lv = level.value;
  const away = phase.value !== 'day' || !!breathing.value || panel.value === 'wardrobe';
  return (
    <div class={'hud-top' + (away ? ' away' : '')}>
      <div class="col" style="gap:4px;align-items:flex-start">
        <button class="profile" onClick={() => { tap(); panel.value = 'wardrobe'; }} aria-label="Pip's wardrobe">
          <span class="portrait"><img src={portrait(s.look)} alt="" /></span>
          <span style="text-align:left">
            <span class="name">{s.name}<span class="lvtag">Lv {lv.level}</span></span>
            <span class="lvbar" style="display:block"><i style={{ width: `${Math.max(8, Math.round((lv.into / lv.need) * 100))}%` }} /></span>
          </span>
        </button>
        <button class="chip" style="margin-left:6px" onClick={() => { tap(); tab.value = 'journal'; }} aria-label="Night streak"><IcoCandle size={40} />{s.streak} night{s.streak === 1 ? '' : 's'}</button>
      </div>
      <div class="chips">
        <button class="chip" onClick={() => { tap(); tab.value = 'market'; }} aria-label="Acorns"><IcoAcorn size={40} /><Rolling value={s.acorns} /></button>
        <button class="chip" onClick={() => { tap(); tab.value = 'market'; }} aria-label="Moonstones"><IcoStone size={40} /><Rolling value={s.stones} /></button>
      </div>
    </div>
  );
}

function Tools() {
  const away = tab.value !== 'home' || !!panel.value || phase.value !== 'day' || !!breathing.value || !save.value.onboarded;
  const t = (label: string, I: typeof IcoBrush, p: typeof panel.value) => (
    <div class="tool"><button class="icon-btn" aria-label={label} onClick={() => { tap('ui_open', 0.5); panel.value = p; }}><I size={40} /></button><span>{label}</span></div>
  );
  return <div class={'tools' + (away ? ' away' : '')}>{t('Settings', IcoGear, 'settings')}{t('Dress up', IcoHanger, 'wardrobe')}{t('Decorate', IcoBrush, 'decorate')}{t('Map', IcoMap, 'map')}</div>;
}

function Ticket() {
  useTick(30000);
  const s = save.value, p = s.sleep;
  const away = tab.value !== 'home' || !!panel.value || phase.value !== 'day' || !!breathing.value || !save.value.onboarded;
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
      <button class={'btn pillow sm' + (late || soon ? ' night' : '')} onClick={() => { tap('ui_open'); tab.value = 'sleep'; }}>{late || soon ? 'Get cozy' : 'Plan'}</button>
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
  if (!b || phase.value !== 'day' || breathing.value) return null;
  return <div class="bubble" ref={ref} key={b.id}><span class="who">{save.value.name}</span>{b.text}</div>;
}

const DOCK: { id: Tab; label: string; I: typeof IcoHouse }[] = [
  { id: 'home', label: 'Home', I: IcoHouse }, { id: 'sleep', label: 'Sleep', I: IcoClock }, { id: 'breathe', label: 'Breathe', I: IcoJar },
  { id: 'journal', label: 'Journal', I: IcoJournal }, { id: 'market', label: 'Market', I: IcoSatchel },
];

function Dock() {
  const away = phase.value !== 'day' || !!breathing.value || !!panel.value;
  return (
    <nav class={'dock' + (away ? ' away' : '')} aria-label="Main">
      <div class="dock-in">
        {DOCK.map((d) => (
          <button class={'dock-item' + (tab.value === d.id ? ' on' : '')} aria-current={tab.value === d.id} onClick={() => { tap(tab.value === d.id ? 'ui_tap' : 'ui_tab', 0.55); tab.value = d.id; panel.value = null; }}>
            <d.I size={40} />
            <span>{d.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

export function App() {
  const s = save.value;
  const ph = phase.value;
  const night = nightOpen.value ? s.nights.find((n) => n.id === nightOpen.value) : null;
  return (
    <div class="layer">
      <IconDefs />
      <Hud />
      <Tools />
      <Ticket />
      <Bubble />
      {ph === 'day' && !breathing.value && !panel.value && (
        tab.value === 'sleep' ? <SleepSheet /> : tab.value === 'breathe' ? <BreathePicker /> : tab.value === 'journal' ? <Journal /> : tab.value === 'market' ? <Market /> : null
      )}
      {ph === 'day' && panel.value === 'wardrobe' && <Wardrobe />}
      {ph === 'day' && panel.value === 'decorate' && <Decorate />}
      {ph === 'day' && panel.value === 'map' && <MapPanel />}
      {panel.value === 'settings' && <Settings />}
      <Dock />
      {night && night.report && ph === 'day' && <NightReport s={night} onClose={() => { nightOpen.value = null; }} />}
      {breathing.value && <BreatheSession key={JSON.stringify(breathing.value)} />}
      {ph === 'sleeping' && <NightOverlay />}
      {ph === 'ringing' && <AlarmOverlay />}
      {ph === 'morning' && <Morning />}
      {!s.onboarded && ph === 'day' && <Onboarding />}
      <Toasts />
    </div>
  );
}
