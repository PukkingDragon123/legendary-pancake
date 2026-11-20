// Sleep: the bedside alarm clock and tonight's plan; the dim night screen while you sleep (and Pip
// explores); and the morning alarm.
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREA } from '../game/catalog.ts';
import { bedtimeOf, blockStatus, demoTonight, endNight, eventsTonight, micState, nextWakeAt, phase, requestNotifications, snooze, startNight, syncReminders, trace } from '../game/night.ts';
import { edit, save } from '../game/store.ts';
import { WoodClock } from './clock.tsx';
import { IcoBed, IcoBell, IcoMap, IcoMic, IcoMoon, IcoPause, IcoPlay, IcoShield, IcoSparkle, IcoSun, Px, SOUNDSCAPE_ICON } from './icons.tsx';
import { fmtDur, fmtHM, fmtTime, Setting, Sheet, SlideToConfirm, Tags, tap, toast, Toggle, useTick } from './kit.tsx';
import { panel, sceneRef, tab } from './state.ts';

const SOUNDSCAPES = [
  { v: 'none', label: 'Silence' }, { v: 'amb_rain', label: 'Rain' }, { v: 'amb_waves', label: 'Waves' }, { v: 'amb_brown', label: 'Hush' },
  { v: 'amb_forest_night', label: 'Night forest' }, { v: 'amb_fire', label: 'Fireplace' }, { v: 'amb_stream', label: 'Stream' }, { v: 'music_lullaby', label: 'Lullaby' },
];
const ALARMS = [{ v: 'alarm_musicbox', label: 'Music box' }, { v: 'alarm_kalimba', label: 'Kalimba' }, { v: 'alarm_birds', label: 'Dawn birds' }, { v: 'alarm_bells', label: 'Lullaby bells' }];
/** tile art for each sound: a sprite and a little sky behind it */
const SOUND_ART: Record<string, { sprite: string; sky: [string, string] }> = {
  none: { sprite: 'speaker_off', sky: ['#7d7f9c', '#4b4d68'] }, amb_rain: { sprite: 'rain', sky: ['#5f78b8', '#2f3f78'] },
  amb_waves: { sprite: 'waves', sky: ['#4fa6b8', '#24607a'] }, amb_brown: { sprite: 'wind', sky: ['#9a86c8', '#56448a'] },
  amb_forest_night: { sprite: 'leaf', sky: ['#4f8a5a', '#23452f'] }, amb_fire: { sprite: 'campfire', sky: ['#d98a4a', '#7a3424'] },
  amb_stream: { sprite: 'drop', sky: ['#5fb8c8', '#2d6f8a'] }, music_lullaby: { sprite: 'music', sky: ['#c27ab8', '#5e3478'] },
  alarm_musicbox: { sprite: 'music', sky: ['#f0c26a', '#c07a3a'] }, alarm_kalimba: { sprite: 'note', sky: ['#e8a07a', '#a65242'] },
  alarm_birds: { sprite: 'birdhouse', sky: ['#9fd0e8', '#5b93c0'] }, alarm_bells: { sprite: 'bell', sky: ['#f4d77a', '#c8913a'] },
};
/** Illustrated sound tiles: tap to choose and hear a few seconds; the chosen one wears a gold frame. */
function SoundTiles(p: { options: { v: string; label: string }[]; value: string; onPick: (v: string) => void; preview: (v: string) => number }) {
  const [hearing, setHearing] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div class="sound-tiles">
      {p.options.map((o) => {
        const a = SOUND_ART[o.v] ?? SOUND_ART.none, on = p.value === o.v, live = hearing === o.v;
        return (
          <button class={'pick sound-tile' + (on ? ' on' : '') + (live ? ' live' : '')} aria-pressed={on} onClick={() => {
            tap('ui_tab', 0.4); p.onPick(o.v);
            const ms = p.preview(o.v);
            clearTimeout(timer.current);
            setHearing(ms ? o.v : null);
            if (ms) timer.current = window.setTimeout(() => setHearing(null), ms);
          }}>
            <span class="sky" style={{ '--a': a.sky[0], '--b': a.sky[1] } as any}>
              <i class="star s1" /><i class="star s2" /><i class="star s3" />
              <Px name={a.sprite} size={40} />
              {live && <span class="eq"><i /><i /><i /><i /></span>}
            </span>
            <span class="name">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function SleepSheet() {
  const s = save.value, p = s.sleep, h12 = s.settings.hour12;
  const bed = bedtimeOf(p.wake, p.goalMin);
  const set = (f: (x: typeof p) => void) => { edit((x) => f(x.sleep)); syncReminders(); };
  const area = AREA[s.area];

  const goodnight = async () => {
    tap('ui_confirm', 0.6);
    sound.play('bowl', { volume: 0.5 });
    const sc = sceneRef.current;
    sc?.owl.play('wave');
    sc?.owl.setMood('happy', 1.5);
    setTimeout(() => sc?.leave(), 900);
    tab.value = 'home';
    await startNight({ alarm: true });
  };

  return (
    <Sheet title="Tonight" sub={<>Pip will explore <b>{area?.name}</b> while you sleep</>} right={<button class="icon-btn" aria-label="Choose where Pip explores" onClick={() => { tap(); panel.value = 'map'; }}><IcoMap size={40} /></button>}>
      <div class="card" style="padding:18px 12px 14px">
        <WoodClock wake={p.wake} bedtime={bed} hour12={h12} onChange={(v) => set((x) => { x.wake = v; })} />
        <div class="spread" style="margin-top:12px;padding:0 6px">
          <div><div class="label">Bedtime</div><div class="num" style="font-size:22px">{fmtHM(bed, h12)}</div></div>
          <div class="center"><div class="label">Sleep</div><div class="num" style="font-size:22px">{fmtDur(p.goalMin * 60000)}</div></div>
          <div style="text-align:right"><div class="label">Wake</div><div class="num" style="font-size:22px;color:#a8742a">{fmtHM(p.wake, h12)}</div></div>
        </div>
        <p class="small muted center" style="margin-top:8px">Drag the golden hand to set your wake-up time.</p>
      </div>

      <div class="card col">
        <div class="spread"><div><h3>Sleep goal</h3><p class="small muted">Your bedtime moves with it</p></div>
          <div class="row"><button class="btn soft sm" aria-label="Less sleep" onClick={() => { tap(); set((x) => { x.goalMin = Math.max(360, x.goalMin - 15); }); }}>-</button><span class="num" style="font-size:19px;min-width:80px;text-align:center">{fmtDur(p.goalMin * 60000)}</span><button class="btn soft sm" aria-label="More sleep" onClick={() => { tap(); set((x) => { x.goalMin = Math.min(660, x.goalMin + 15); }); }}>+</button></div>
        </div>
        <div><div class="label" style="margin-bottom:6px">Repeat</div>
          <div class="tags">{DAYS.map((d, i) => <button class={'tag round' + (p.days.includes(i) ? ' on' : '')} onClick={() => { tap('ui_tab', 0.4); set((x) => { x.days = x.days.includes(i) ? x.days.filter((y) => y !== i) : [...x.days, i].sort(); }); }}>{d}</button>)}</div>
        </div>
        <div><div class="label" style="margin-bottom:6px">Smart wake-up</div>
          <Tags value={p.smartMin} onChange={(v) => set((x) => { x.smartMin = v; })} options={[{ v: 0, label: 'Exact time' }, { v: 10, label: '10 min' }, { v: 20, label: '20 min' }, { v: 30, label: '30 min' }]} />
          <p class="small muted" style="margin-top:6px">{p.smartMin ? `Pip rings when you're sleeping lightly, up to ${p.smartMin} minutes early.` : 'The alarm rings exactly on time.'}</p>
        </div>
      </div>

      <div class="card col">
        <Setting icon={<IcoBell />} title="Alarm" sub={p.alarmOn ? `${ALARMS.find((a) => a.v === p.alarmSound)?.label} · swells gently` : 'No alarm tonight'}><Toggle on={p.alarmOn} onChange={(v) => set((x) => { x.alarmOn = v; })} label="Alarm" /></Setting>
        {p.alarmOn && <SoundTiles value={p.alarmSound} options={ALARMS} onPick={(v) => set((x) => { x.alarmSound = v; })} preview={(v) => { sound.preview(v, 4, 'alarm'); return 4000; }} />}
      </div>

      <div class="card col">
        <Setting icon={<IcoMoon />} title="Bedtime reminder" sub={p.reminders ? `Wind down at ${fmtHM(bedtimeOf(p.wake, p.goalMin + p.windDownMin), h12)}, bed at ${fmtHM(bed, h12)}` : 'Off'}>
          <Toggle on={p.reminders} onChange={async (v) => { set((x) => { x.reminders = v; }); if (v) { const r = await requestNotifications(); if (r !== 'granted') toast('Reminders will show while the app is open. Allow notifications for more.', IcoBell, 4200); } }} label="Bedtime reminder" />
        </Setting>
        {p.reminders && <Tags value={p.windDownMin} onChange={(v) => set((x) => { x.windDownMin = v; })} options={[{ v: 15, label: '15 min' }, { v: 30, label: '30 min' }, { v: 45, label: '45 min' }, { v: 60, label: '1 hour' }]} />}
      </div>

      <div class="card col">
        <div><h3>Falling-asleep sounds</h3><p class="small muted">Real recordings, fading out softly</p></div>
        <SoundTiles value={p.soundscape} options={SOUNDSCAPES} onPick={(v) => set((x) => { x.soundscape = v; })} preview={(v) => { if (v === 'none') return 0; sound.preview(v, 5); return 5000; }} />
        {p.soundscape !== 'none' && <>
          <Tags value={p.soundscapeMin} onChange={(v) => set((x) => { x.soundscapeMin = v; })} options={[{ v: 15, label: '15 min' }, { v: 30, label: '30 min' }, { v: 60, label: '1 hour' }, { v: 0, label: 'All night' }]} />
          <div class="row"><span class="small muted" style="width:56px">Volume</span><input class="slider grow" type="range" min="0.1" max="1" step="0.05" value={p.soundscapeVol} onInput={(e) => set((x) => { x.soundscapeVol = +(e.target as HTMLInputElement).value; })} /></div>
        </>}
      </div>

      <div class="card col">
        <Setting icon={<IcoMic />} title="Sleep tracking" sub="Listens for movement, snoring and sleep talk. Everything stays on this device.">
          <Toggle on={p.mic} onChange={(v) => set((x) => { x.mic = v; })} label="Sleep tracking" />
        </Setting>
        {p.mic && <Setting icon={<IcoSparkle />} title="Snore & sleep-talk recordings" sub={s.plus.active ? 'Short clips you can play back in the morning' : 'Part of Hoot Hollow Plus'}>
          <Toggle on={p.clips && s.plus.active} onChange={(v) => { if (!s.plus.active) { tab.value = 'market'; return; } set((x) => { x.clips = v; }); }} label="Recordings" />
        </Setting>}
        {p.mic && <p class="small muted">Leave your phone charging on the nightstand, screen up. Hoot Hollow keeps the screen awake but very dim.</p>}
      </div>

      <div class="card">
        <Setting icon={<IcoShield />} title="Social media blocking" sub={blockStatus.value ? (blockStatus.value.blocking ? 'Blocking now' : `Ready · ${s.blocker.start}–${s.blocker.end}`) : 'Set up the Bedtime Blocker'} onClick={() => { tap(); panel.value = 'settings'; }}>
          <span class="muted small">{blockStatus.value ? 'On' : 'Set up'}</span>
        </Setting>
      </div>

      <button class="btn pillow night big block" onClick={goodnight}><IcoBed size={40} />Goodnight, Pip</button>
      <button class="btn ghost" onClick={() => { tap(); demoTonight(); tab.value = 'home'; toast('A pretend night, so you can see the morning.', IcoSparkle); }}>Preview a night (demo)</button>
    </Sheet>
  );
}

/** A tiny ink squiggle of the room's sound, drawn left to right. */
function Squiggle() {
  const t = trace.value.slice(-90);
  if (t.length < 2) return <div style="height:44px" />;
  const pts = t.map((v, i) => `${(i / 89) * 300},${40 - Math.min(36, v * 1.4)}`).join(' ');
  return <svg viewBox="0 0 300 44" width="100%" height="44" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke="#ffcf8a" stroke-opacity=".55" stroke-width="2" stroke-linejoin="round" /></svg>;
}

export function NightOverlay() {
  useTick(1000);
  const s = save.value, a = s.active, h12 = s.settings.hour12;
  const [dim, setDim] = useState(false);
  const [playing, setPlaying] = useState(s.sleep.soundscape !== 'none');
  useEffect(() => { const id = setTimeout(() => setDim(true), 20000); return () => clearTimeout(id); }, []);
  if (!a) return null;
  const now = new Date();
  const hh = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: h12 });
  const [clock, ampm] = h12 ? [hh.replace(/\s?[AP]M/i, ''), /PM/i.test(hh) ? 'PM' : 'AM'] : [hh, ''];
  const wake = a.session.wakeTarget, area = AREA[a.area];
  const st = blockStatus.value;
  const I = SOUNDSCAPE_ICON[s.sleep.soundscape];
  return (
    <div class="overlay dim night-ui" onClick={() => setDim((d) => !d)}>
      <div class="col center" style="margin-top:calc(54px + var(--safe-t));align-items:center;gap:6px;padding:0 20px">
        <div class="row small" style="opacity:.8;gap:6px"><IcoMap size={20} />Pip is exploring {area?.name} · {fmtDur(Date.now() - a.session.start)}</div>
        <div class="bigclock">{clock}{ampm && <small>{ampm}</small>}</div>
        <div class="row" style="gap:6px;opacity:.85"><IcoSun size={20} />{wake ? <>Alarm {fmtTime(wake, h12)}{s.sleep.smartMin ? ` · smart from ${fmtTime(wake - s.sleep.smartMin * 60000, h12)}` : ''}</> : 'No alarm'}</div>
      </div>
      <div class="grow" />
      <div class="col" style="padding:0 20px calc(22px + var(--safe-b));gap:12px;max-width:520px;width:100%;margin:0 auto" onClick={(e) => e.stopPropagation()}>
        <div class="card night" style="padding:12px 14px">
          <div class="spread"><span class="label">{micState.value === 'listening' ? 'Listening on this device' : micState.value === 'denied' ? 'Microphone blocked: tracking by time only' : micState.value === 'paused' ? 'Paused: keep the screen on' : micState.value === 'unsupported' ? 'Tracking by time (the mic works in the full app)' : 'Tracking by time only'}</span><span class="label">{eventsTonight.value} sounds</span></div>
          {micState.value === 'listening' && <Squiggle />}
        </div>
        <div class="row" style="gap:10px">
          {s.sleep.soundscape !== 'none' && <button class="card night row grow" style="padding:10px 12px" onClick={() => { tap(); const on = !playing; setPlaying(on); sound.soundscape(on ? s.sleep.soundscape : null, s.sleep.soundscapeVol, 0); }}>
            {I && <I size={40} />}<span class="grow" style="text-align:left;font-weight:800">{playing ? 'Playing' : 'Paused'}</span>{playing ? <IcoPause size={40} /> : <IcoPlay size={40} />}
          </button>}
          {st && <div class="card night row" style="padding:10px 12px"><IcoShield size={40} /><span style="font-weight:800">{st.blocking ? 'Blocking' : 'Blocker ready'}</span></div>}
        </div>
        <SlideToConfirm label="Slide to wake up" icon={<IcoSun size={40} />} onDone={() => { void endNight(); }} />
      </div>
      <div class="dimmer" style={{ opacity: dim ? 0.55 : 0 }} />
    </div>
  );
}

export function AlarmOverlay() {
  const s = save.value;
  return (
    <div class="overlay" style="justify-content:flex-end;background:linear-gradient(180deg,rgba(255,200,150,.0),rgba(60,30,40,.35))">
      <div class="sheet full" style="position:relative;left:auto;transform:none;margin:0 auto;animation:fadeUp .6s var(--ease)">
        <div class="grab" />
        <div class="sheet-body" style="align-items:center;text-align:center;gap:10px">
          <h1>Good morning!</h1>
          <p class="muted">Pip is flying home with something in the satchel…</p>
          <WoodClock wake={s.sleep.wake} bedtime={bedtimeOf(s.sleep.wake, s.sleep.goalMin)} hour12={s.settings.hour12} ringing size={210} />
          <div class="row" style="width:100%;gap:10px">
            <button class="btn oak grow" onClick={() => { tap(); snooze(9); }}>Snooze 9 min</button>
          </div>
          <div style="width:100%"><SlideToConfirm label="Slide: I'm awake" icon={<IcoSun size={40} />} onDone={() => { void endNight(); }} /></div>
        </div>
      </div>
    </div>
  );
}

export const _unused = { nextWakeAt, phase };
