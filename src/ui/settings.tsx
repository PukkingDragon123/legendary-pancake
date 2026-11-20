// Settings (sounds, reminders, the bedtime blocker, data) and the first-run welcome.
import { useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { DEFAULT_SITES, detectBrowser, extensionInstallSteps, normalizeDomain } from '../game/blocker.ts';
import { bedtimeOf, blockStatus, connectBlocker, demoTonight, pushBlockerConfig, requestNotifications, syncReminders } from '../game/night.ts';
import { edit, flush, resetSave, save } from '../game/store.ts';
import { WoodClock } from './clock.tsx';
import { IcoBell, IcoClose, IcoGear, IcoMic, IcoNote, IcoPhoneOff, IcoPlus, IcoShield, IcoSparkle } from './icons.tsx';
import { fmtDur, fmtHM, Setting, Sheet, Tags, tap, toast, Toggle } from './kit.tsx';
import { panel, sceneRef, tab } from './state.ts';
import { ask } from './fx.tsx';
import { spriteURL } from './px/sprites.js';

/** Save the journal as JSON: through the host's download sheet when embedded, else a plain link. */
async function exportJournal() {
  const data = JSON.stringify(save.value, null, 2), filename = 'hoot-hollow-journal.json';
  const host = (window as any).claude;
  if (host?.use) {
    try {
      const dl = await host.use('downloads');
      if (dl) { await dl.save({ filename, data }); toast('Journal saved', IcoNote); return; }
    } catch { toast('Export was cancelled', IcoNote); return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  a.download = filename; a.click();
}

const pretty = (d: string) => d.replace(/\.(com|net|tv)$/, '').replace(/^x$/, 'X (Twitter)').replace(/^\w/, (c) => c.toUpperCase());

function Blocker() {
  const s = save.value, b = s.blocker, st = blockStatus.value;
  const [custom, setCustom] = useState('');
  const set = (f: (x: typeof b) => void) => { edit((x) => f(x.blocker)); void pushBlockerConfig(); };
  const browser = detectBrowser();
  return (
    <div class="card col">
      <Setting icon={<IcoShield />} title="Bedtime Blocker" sub={st ? (st.blocking ? `Blocking now · ${st.blockedToday} attempts stopped today` : 'Connected and ready') : 'Blocks social media at bedtime, in your browser'}>
        <Toggle on={b.enabled} onChange={(v) => set((x) => { x.enabled = v; })} label="Bedtime Blocker" />
      </Setting>
      <div class="row small"><span class="muted" style="width:70px">From</span><input class="field" type="time" value={b.start} onChange={(e) => set((x) => { x.start = (e.target as HTMLInputElement).value; })} /><span class="muted">to</span><input class="field" type="time" value={b.end} onChange={(e) => set((x) => { x.end = (e.target as HTMLInputElement).value; })} /></div>
      <button class="btn soft sm" onClick={() => { tap(); set((x) => { x.start = bedtimeOf(s.sleep.wake, s.sleep.goalMin + s.sleep.windDownMin); x.end = s.sleep.wake; }); }}>Match my bedtime ({fmtHM(bedtimeOf(s.sleep.wake, s.sleep.goalMin + s.sleep.windDownMin), s.settings.hour12)} – {fmtHM(s.sleep.wake, s.settings.hour12)})</button>
      <Setting title="Strict mode" sub="No pausing during bedtime. Changes wait until morning."><Toggle on={b.strict} onChange={(v) => set((x) => { x.strict = v; })} label="Strict mode" /></Setting>
      <div class="label">Sites</div>
      <div class="tags">
        {DEFAULT_SITES.map((d) => <button class={'tag' + (b.sites.includes(d) ? ' on' : '')} style="--tag:#4a58a8" onClick={() => { tap('ui_tab', 0.4); set((x) => { x.sites = x.sites.includes(d) ? x.sites.filter((y) => y !== d) : [...x.sites, d]; }); }}>{pretty(d)}</button>)}
        {b.custom.map((d) => <button class="tag on" style="--tag:#7a5fd0" onClick={() => { tap('ui_tab', 0.4); set((x) => { x.custom = x.custom.filter((y) => y !== d); }); }}>{d}<IcoClose size={20} /></button>)}
      </div>
      <form class="row" onSubmit={(e) => { e.preventDefault(); const d = normalizeDomain(custom); if (!d) { toast('That doesn’t look like a website'); return; } set((x) => { if (!x.custom.includes(d)) x.custom.push(d); }); setCustom(''); tap('ui_confirm'); }}>
        <input class="field" placeholder="Add a site, e.g. news.example.com" value={custom} onInput={(e) => setCustom((e.target as HTMLInputElement).value)} />
        <button class="btn soft sm" aria-label="Add site"><IcoPlus size={20} /></button>
      </form>
      {!st && <div class="card sunk col small">
        <b>Install the companion extension</b>
        <p class="muted">A web page can't block other sites by itself, so a tiny browser extension does it (everything stays on your computer). It's in the <code>extension/</code> folder of this app.</p>
        <ol style="margin:0;padding-left:18px">{extensionInstallSteps(browser).map((t) => <li>{t}</li>)}</ol>
        <button class="btn soft sm" onClick={async () => { tap(); const r = await connectBlocker(); toast(r ? 'Extension connected!' : 'Extension not found yet', IcoShield); }}>Check again</button>
      </div>}
      <div class="card sunk col small">
        <div class="row" style="gap:8px"><IcoPhoneOff size={40} /><b>On your phone</b></div>
        <p class="muted">Phones don't allow apps to block each other from the web. Set a bedtime focus instead: <b>iPhone</b>: Settings › Screen Time › Downtime (match {fmtHM(b.start, s.settings.hour12)}–{fmtHM(b.end, s.settings.hour12)}). <b>Android</b>: Settings › Digital Wellbeing › Bedtime mode. Hoot Hollow also notes when you pick up your phone at night.</p>
      </div>
    </div>
  );
}

export function Settings() {
  const s = save.value, st = s.settings;
  const vol = (k: 'sfx' | 'music' | 'ambience', v: number) => { edit((x) => { x.settings[k] = v; }); sound.volumes({ sfx: k === 'sfx' ? v : st.sfx, music: k === 'music' ? v : st.music, amb: k === 'ambience' ? v : st.ambience }); };
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  return (
    <Sheet title={<span class="row" style="gap:8px"><IcoGear size={40} />Settings</span>} onClose={() => { if (panel.value === 'settings') panel.value = null; }}>
      <div class="card col">
        <div class="label">Your owl</div>
        <input class="field" value={s.name} maxLength={16} onInput={(e) => edit((x) => { x.name = (e.target as HTMLInputElement).value || 'Pip'; })} aria-label="Owl name" />
      </div>
      <div class="card col">
        <div class="label">Sound</div>
        {([['sfx', 'Effects', IcoSparkle], ['music', 'Music', IcoNote], ['ambience', 'Sleep sounds', IcoMic]] as const).map(([k, l, I]) => (
          <div class="row"><I size={40} /><span style="width:96px;font-weight:700">{l}</span><input class="slider grow" type="range" min="0" max="1" step="0.05" value={st[k]} onInput={(e) => vol(k, +(e.target as HTMLInputElement).value)} /></div>
        ))}
      </div>
      <div class="card col">
        <Setting icon={<IcoBell />} title="Notifications" sub={perm === 'granted' ? 'On: reminders and the alarm can reach you' : perm === 'denied' ? 'Blocked in your browser settings' : perm === 'unsupported' ? 'Not supported here' : 'Allow reminders and alarm notifications'}>
          {perm === 'default' && <button class="btn soft sm" onClick={async () => { tap(); const r = await requestNotifications(); setPerm(r); syncReminders(); }}>Allow</button>}
        </Setting>
        <Setting title="12-hour clock"><Toggle on={st.hour12} onChange={(v) => edit((x) => { x.settings.hour12 = v; })} label="12-hour clock" /></Setting>
        <Setting title="Graphics" sub="Lower detail saves battery on older phones">
          <Tags value={st.quality} onChange={(v) => { edit((x) => { x.settings.quality = v; }); toast('Applies next time the app opens'); }} options={[{ v: 'auto', label: 'Auto' }, { v: 'low', label: 'Low' }, { v: 'high', label: 'High' }]} />
        </Setting>
      </div>
      <Blocker />
      <div class="card col">
        <div class="label">Your data</div>
        <p class="small muted">Everything (nights, recordings, Pip's treasures) is stored only on this device. Nothing is uploaded.</p>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <button class="btn soft sm" onClick={() => { tap(); flush(); void exportJournal(); }}>Export journal</button>
          <button class="btn soft sm" onClick={() => { tap(); demoTonight(); panel.value = null; }}>Preview a demo night</button>
          <button class="btn soft sm" style="color:#b3304a" onClick={async () => { if (await ask({ title: 'Start over?', body: 'This erases Pip, the journal and every treasure. It cannot be undone.', ok: 'Erase everything', cancel: 'Keep my hollow', tone: 'berry', art: spriteURL('owl', 4) })) { resetSave(); location.reload(); } }}>Start over</button>
        </div>
      </div>
      <div class="card col small">
        <div class="label">About</div>
        <p class="muted">Hoot Hollow. Sound effects and music are CC0 and public-domain recordings from OpenGameArt.org contributors and the U.S. National Park Service; see AUDIO-CREDITS in the docs. Sleep stages are estimated from sound and are not medical advice.</p>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ onboarding

export function Onboarding() {
  const s = save.value, p = s.sleep;
  const [step, setStep] = useState(0);
  const next = () => { tap('paper_flip', 0.5); setStep(step + 1); };
  const finish = (demo: boolean) => {
    tap('ui_confirm');
    edit((x) => { x.onboarded = true; });
    syncReminders();
    sceneRef.current?.owl.play('dance');
    if (demo) demoTonight(); else tab.value = 'home';
  };
  return (
    <div class="onboard">
      <Sheet full>
        <div class="steps">{[0, 1, 2].map((i) => <i class={i === step ? 'on' : ''} />)}</div>
        {step === 0 && <>
          <h1 class="center">Hello! I'm {s.name}.</h1>
          <p class="center muted">I live in a hollow oak at the edge of the forest. While you sleep, I go exploring, and the better you rest, the more treasure I bring home.</p>
          <div class="card col"><div class="label">What should we call me?</div><input class="field" value={s.name} maxLength={16} onInput={(e) => edit((x) => { x.name = (e.target as HTMLInputElement).value || 'Pip'; })} /></div>
          <button class="btn pillow big block" onClick={next}>Nice to meet you</button>
        </>}
        {step === 1 && <>
          <h2 class="center">When do you want to wake up?</h2>
          <WoodClock wake={p.wake} bedtime={bedtimeOf(p.wake, p.goalMin)} hour12={s.settings.hour12} size={230} onChange={(v) => edit((x) => { x.sleep.wake = v; })} />
          <div class="spread card"><div><div class="label">Wake</div><b class="num" style="font-size:19px">{fmtHM(p.wake, s.settings.hour12)}</b></div>
            <div class="row"><button class="btn soft sm" onClick={() => { tap(); edit((x) => { x.sleep.goalMin = Math.max(360, x.sleep.goalMin - 30); }); }}>-</button><div class="center"><div class="label">Sleep</div><b class="num" style="font-size:18px">{fmtDur(p.goalMin * 60000)}</b></div><button class="btn soft sm" onClick={() => { tap(); edit((x) => { x.sleep.goalMin = Math.min(660, x.sleep.goalMin + 30); }); }}>+</button></div>
            <div style="text-align:right"><div class="label">Bedtime</div><b class="num" style="font-size:19px">{fmtHM(bedtimeOf(p.wake, p.goalMin), s.settings.hour12)}</b></div></div>
          <button class="btn pillow big block" onClick={next}>That's my rhythm</button>
        </>}
        {step === 2 && <>
          <h2 class="center">A couple of things that help</h2>
          <div class="card col">
            <Setting icon={<IcoBell />} title="Bedtime reminders" sub="A gentle nudge to wind down, and the alarm in the morning"><button class="btn soft sm" onClick={async () => { tap(); const r = await requestNotifications(); toast(r === 'granted' ? 'Reminders on' : 'You can turn them on later in Settings', IcoBell); }}>Allow</button></Setting>
            <Setting icon={<IcoMic />} title="Sleep sounds tracking" sub="At night your phone listens for movement and snoring, on this device only. You'll be asked when you first go to sleep." />
            <Setting icon={<IcoShield />} title="Bedtime Blocker" sub="Keep social media closed after bedtime. Set it up any time in Settings." />
          </div>
          <button class="btn pillow big block" onClick={() => finish(false)}>Let's begin</button>
          <button class="btn ghost" onClick={() => finish(true)}>Show me a pretend morning first</button>
        </>}
      </Sheet>
    </div>
  );
}
