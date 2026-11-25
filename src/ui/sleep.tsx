// The night: Pip's departure, the very dim night screen (a pixel moon clock, Pip's journey across
// tonight's area, the microphone), "Can't sleep?" help (a breathing round, sounds, a whispered
// story, and a phone lock that gently resists), and the ringing alarm at dawn.
import { Letters } from './text3d.tsx'; // [font6] per-letter 3D text motion
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { sound } from '../audio/sound.ts';
import { AREA } from '../game/catalog.ts';
import { blockStatus, endNight, eventsTonight, live, micState, phase, phoneLocked, setPhoneLock, snooze, startNight, tonight, trace } from '../game/night.ts';
import { edit, save } from '../game/store.ts';
import { playDeparture } from '../world/cinematics.ts';
import { WoodClock } from './clock.tsx';
import { Px } from './icons.tsx';
import { fmtDur, fmtTime, SlideToConfirm, tap, useTick } from './kit.tsx';
import { Art, dtone, hash, tone } from './px/sleepart.ts';
import { moon, moonPhase, nest } from './px/sleepprops.ts';
import { PipPix } from './pippix.tsx';
import { ArtCanvas, HoldButton, injectSleepFrames, nowT, Paper } from './sleepkit.tsx';
import { breathing, panel, sceneRef } from './state.ts';
import { TalkText } from './talkview.tsx'; // [dialog10] the captions type on like a voice
import { voice, type Tts } from './voice.ts';
import './sleep.css';

export const SOUNDSCAPES = [
  { v: 'none', label: 'Silence' }, { v: 'amb_rain', label: 'Rain' }, { v: 'amb_waves', label: 'Waves' }, { v: 'amb_brown', label: 'Hush' },
  { v: 'amb_forest_night', label: 'Night forest' }, { v: 'amb_fire', label: 'Fireplace' }, { v: 'amb_stream', label: 'Stream' }, { v: 'music_lullaby', label: 'Lullaby' },
];
export const ALARMS = [{ v: 'alarm_musicbox', label: 'Music box' }, { v: 'alarm_kalimba', label: 'Kalimba' }, { v: 'alarm_birds', label: 'Dawn birds' }, { v: 'alarm_bells', label: 'Bells' }];
/** tile art for each sound: a sprite and a little sky behind it */
const SOUND_ART: Record<string, { sprite: string; sky: [string, string] }> = {
  none: { sprite: 'speaker_off', sky: ['#7a8196', '#484f63'] }, amb_rain: { sprite: 'rain', sky: ['#6b7d8d', '#364655'] },
  amb_waves: { sprite: 'waves', sky: ['#839da3', '#465d65'] }, amb_brown: { sprite: 'wind', sky: ['#978ea6', '#544f64'] },
  amb_forest_night: { sprite: 'leaf', sky: ['#6e8164', '#31422c'] }, amb_fire: { sprite: 'campfire', sky: ['#b79884', '#64433a'] },
  amb_stream: { sprite: 'drop', sky: ['#94aeb3', '#536b73'] }, music_lullaby: { sprite: 'music', sky: ['#a98ea0', '#514459'] },
  alarm_musicbox: { sprite: 'music', sky: ['#ddc6a4', '#a28672'] }, alarm_kalimba: { sprite: 'note', sky: ['#cfaa9a', '#8a645a'] },
  alarm_birds: { sprite: 'birdhouse', sky: ['#b3cdd6', '#7a919d'] }, alarm_bells: { sprite: 'bell', sky: ['#e9d7b2', '#b0987d'] },
};
/** Illustrated sound tiles: tap to choose and hear a few seconds; the chosen one wears a gold frame. */
export function SoundTiles(p: { options: { v: string; label: string }[]; value: string; onPick: (v: string) => void; preview: (v: string) => number; cols?: number }) {
  const [hearing, setHearing] = useState<string | null>(null);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div class="sound-tiles" style={p.cols ? { gridTemplateColumns: `repeat(${p.cols}, 1fr)` } : undefined}>
      {p.options.map((o) => {
        const a = SOUND_ART[o.v] ?? SOUND_ART.none, on = p.value === o.v, live_ = hearing === o.v;
        return (
          <button class={'pick sound-tile' + (on ? ' on' : '') + (live_ ? ' live' : '')} aria-pressed={on} onClick={() => {
            tap('ui_tab', 0.4); p.onPick(o.v);
            const ms = p.preview(o.v);
            clearTimeout(timer.current);
            setHearing(ms ? o.v : null);
            if (ms) timer.current = window.setTimeout(() => setHearing(null), ms);
          }}>
            <span class="sky" style={{ '--a': a.sky[0], '--b': a.sky[1] } as any}>
              <i class="star s1" /><i class="star s2" /><i class="star s3" />
              <Px name={a.sprite} size={40} />
              {live_ && <span class="eq"><i /><i /><i /><i /></span>}
            </span>
            <span class="name">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ going to sleep

/** The departure cinematic is playing (Pip packs up and flies off); the night screen waits. */
export const departing = signal(false);
let cancelCine: (() => void) | null = null;
let cineTimer = 0;
function endDeparture() {
  clearTimeout(cineTimer);
  if (!departing.value) return;
  departing.value = false;
  cancelCine = null;
  sound.play('notify_soft', { volume: 0.25 });
}
/** Skip the cinematic: Pip is simply gone. */
export function skipDeparture() {
  const c = cancelCine;
  cancelCine = null;
  try { c?.(); } catch { /* the world builder's cancel */ }
  const sc = sceneRef.current;
  if (sc && sc.owlPlace !== 'away') sc.placeOwl('away');
  endDeparture();
}
/**
 * Lights out: starts the night (microphone, alarm, blocker, soundscape) and plays Pip's departure.
 * Call from a user gesture (it unlocks audio for the alarm).
 */
export async function goToSleep() {
  departing.value = true;
  panel.value = null;
  const sc = sceneRef.current;
  const started = startNight({ alarm: true });
  if (sc) {
    try { cancelCine = playDeparture(sc, { onDone: endDeparture }); } catch { endDeparture(); }
    cineTimer = window.setTimeout(endDeparture, 16000);
  } else cineTimer = window.setTimeout(endDeparture, 2600);
  await started;
}

function Departure() {
  const [cap, setCap] = useState(0);
  useEffect(() => { const id = setInterval(() => setCap((c) => Math.min(c + 1, 2)), 2600); return () => clearInterval(id); }, []);
  const name = save.value.name, area = AREA[save.value.area]?.name ?? 'the woods';
  const lines = [`${name} is packing the satchel...`, `Off to *${area}!*`, 'Goodnight. _Sleep well._'];
  return (
    <div class="cine" onClick={() => { tap('ui_tap', 0.3); skipDeparture(); }}>
      <div class="bar top" /><div class="bar bot" />
      <div class="cine-cap hh-cap"><TalkText text={lines[cap]} id={cap} opts={{ size: innerWidth < 600 ? 22 : 26, maxWidth: Math.min(innerWidth - 24, 620), anchor: 'bottom', voice: 'narrator', scrim: 0.3, tag: false }} /></div>
      <span class="cine-skip">Tap to skip</span>
    </div>
  );
}

// ------------------------------------------------------------------ the night screen

/** A sky strip with a dotted trail from the hollow to tonight's area; Pip flies along it. */
function Journey(p: { frac: number; color: string }) {
  const W = 120, H = 30;
  return <ArtCanvas w={W} h={H} k={3} fps={6} class="journey" label="Pip's trip tonight" deps={[Math.round(p.frac * 100), p.color]} draw={(a, t, f) => {
    // hills
    for (let x = 0; x < W; x++) {
      const h1 = 22 + Math.sin(x * 0.09) * 2 + Math.sin(x * 0.23 + 1) * 1.2;
      for (let y = Math.floor(h1); y < H; y++) a.px(x, y, dtone('navy', 1.6 - (y - h1) * 0.08, x, y));
    }
    // the oak at home (left) and the area's landmark (right)
    a.rect(6, 12, 3, 11, tone('wood', 1));
    a.ell(7.5, 11, 6, 5, (x, y) => dtone('moss', 1.4 + (hash(x, y) - 0.5) * 0.6, x, y));
    a.px(8, 17, '#e9d5ae'); a.px(9, 17, '#dbc3a5');
    a.ell(W - 10, 21, 7, 4, (x, y) => dtone('navy', 2.4, x, y));
    for (let i = 0; i < 5; i++) a.px(W - 14 + i * 2, 19 - (i % 2), p.color);
    // dotted trail (an arc)
    const pt = (u: number): [number, number] => [12 + u * (W - 26), 20 - Math.sin(u * Math.PI) * 13];
    for (let u = 0; u <= 1.0001; u += 1 / 40) { const [x, y] = pt(u); a.px(x, y, u <= p.frac ? '#eae2d1' : '#405060'); }
    // twinkles
    for (let i = 0; i < 14; i++) { const sx = Math.floor(hash(i, 3) * W), sy = Math.floor(hash(i, 4) * 12); if ((f + i) % 5) a.px(sx, sy, (f + i) % 3 ? '#526272' : '#c7d4e9'); }
    // Pip's lantern travelling the trail, a few sparks drifting behind it
    const [ox, oy] = pt(Math.max(0.02, Math.min(0.98, p.frac)));
    const bob = Math.round(Math.sin(t * 3) * 0.6), lx = Math.round(ox), ly = Math.round(oy) - 4 + bob;
    for (let i = 1; i <= 3; i++) { const [sx, sy] = pt(Math.max(0, p.frac - i * 0.035)); if ((f + i) % 3) a.px(sx, sy - 3 + ((f + i) % 2), i === 1 ? '#f1d39a' : '#c8a764'); }
    a.rect(lx - 1, ly - 4, 3, 1, tone('iron', 2)); a.px(lx, ly - 5, tone('iron', 3));
    a.rect(lx - 2, ly - 3, 5, 5, (x, y) => (x === lx - 2 || x === lx + 2 ? tone('brass', 2) : (f % 2 && y === ly - 1) ? '#fff2c9' : '#f1d39a'));
    a.rect(lx - 2, ly + 2, 5, 1, tone('brass', 1));
    a.px(lx - 3, ly - 1, '#c8a764'); a.px(lx + 3, ly - 1, '#c8a764');
  }} />;
}

/** The moon clock: tonight's real moon phase, softly glowing, with a few stars. */
function MoonClock(p: { size: number }) {
  const N = 44;
  return <ArtCanvas w={N} h={N} k={p.size} fps={4} class="moonclock" draw={(a, t, f) => {
    for (let i = 0; i < 10; i++) { const x = Math.floor(hash(i, 1, 2) * N), y = Math.floor(hash(i, 2, 2) * N); if (Math.hypot(x - N / 2, y - N / 2) > 17 && (f + i) % 6) a.px(x, y, (f + i) % 4 ? '#607081' : '#f6f1e5'); }
    moon(a, N / 2, N / 2, 12, { phase: moonPhase(), glow: 0.7, face: 'sleep' });
    void t;
  }} />;
}

function Squiggle() {
  const t = trace.value.slice(-90);
  if (t.length < 2) return <span class="squig" />;
  const pts = t.map((v, i) => `${(i / 89) * 120},${18 - Math.min(16, v * 0.7)}`).join(' ');
  return <svg class="squig" viewBox="0 0 120 20" preserveAspectRatio="none" aria-hidden="true"><polyline points={pts} fill="none" stroke="#ecd4b6" stroke-opacity=".5" stroke-width="2" /></svg>;
}

const micLine = () => ({
  listening: 'Listening on this phone', denied: 'Mic blocked: tracking by time', paused: 'Paused: keep this screen open',
  unsupported: 'Tracking by time here', error: 'Tracking by time', off: 'Tracking by time',
} as Record<string, string>)[micState.value] ?? 'Tracking by time';

export function NightOverlay() {
  injectSleepFrames();
  useTick(1000);
  const s = save.value, a = s.active, h12 = s.settings.hour12;
  const [dim, setDim] = useState(false);
  const [calm, setCalm] = useState(false);
  const [playing, setPlaying] = useState(s.sleep.soundscape !== 'none');
  useEffect(() => { const id = setTimeout(() => setDim(true), 20000); return () => clearTimeout(id); }, [calm]);
  if (!a) return null;
  if (departing.value) return <Departure />;
  const now = new Date();
  const hh = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: h12 });
  const [clock, ampm] = h12 ? [hh.replace(/\s?[AP]M/i, ''), /PM/i.test(hh) ? 'PM' : 'AM'] : [hh, ''];
  const wake = a.session.wakeTarget, area = AREA[a.area];
  const span = (wake ?? a.session.start + 8 * 3600_000) - a.session.start;
  const frac = Math.max(0, Math.min(1, (Date.now() - a.session.start) / Math.max(1, span)));
  const st = blockStatus.value;
  const wide = innerWidth >= 900;
  return (
    <div class={'overlay night2' + (dim ? ' dimmed' : '')} onClick={() => setDim((d) => !d)}>
      <div class="n-top">
        <span class="n-chip"><Px name="map" size={30} />Pip is exploring <b>{area?.name ?? 'the woods'}</b></span>
      </div>
      <div class="n-mid">
        <MoonClock size={wide ? 4 : 3} />
        <div class="n-time">{clock}{ampm && <small>{ampm}</small>}</div>
        <div class="n-alarm"><Px name="alarm" size={30} />{wake ? <>Alarm {fmtTime(wake, h12)}{s.sleep.smartMin ? <span class="soft"> · smart from {fmtTime(wake - s.sleep.smartMin * 60000, h12)}</span> : null}</> : 'No alarm tonight'}</div>
      </div>
      <div class="n-trip">
        <Journey frac={frac} color={area?.color ?? '#e9d5ae'} />
        <div class="n-trip-l"><span>Home</span><span>{fmtDur(Date.now() - a.session.start)} away</span><span>{area?.name}</span></div>
      </div>
      <div class="n-bottom" onClick={(e) => e.stopPropagation()}>
        <div class="n-row">
          <span class={'n-chip mic ' + micState.value}><Px name="mic" size={30} /><span class="grow">{micLine()}{micState.value === 'listening' && <> · {eventsTonight.value} sounds</>}</span>{micState.value === 'listening' && <Squiggle />}{micState.value === 'listening' && <i class="n-dot" style={{ opacity: live.value ? 0.4 + Math.min(0.6, (live.value.db - live.value.floor) / 20) : 0.4 }} />}</span>
        </div>
        <div class="n-row">
          {s.sleep.soundscape !== 'none' && <button class="n-chip btn-like" onClick={() => { tap('ui_toggle', 0.3); const on = !playing; setPlaying(on); sound.soundscape(on ? s.sleep.soundscape : null, s.sleep.soundscapeVol, 0); }}>
            <Px name={playing ? 'pause' : 'play'} size={30} />{SOUNDSCAPES.find((x) => x.v === s.sleep.soundscape)?.label ?? 'Sounds'}
          </button>}
          {st && <span class="n-chip"><Px name="shield" size={30} />{st.blocking ? 'Blocking apps' : 'Blocker ready'}</span>}
          <button class="n-tag" onClick={() => { tap('paper_flip', 0.4); setCalm(true); setDim(false); }}><span>Can't sleep?</span></button>
        </div>
        <SlideToConfirm label="Slide to wake up" icon={<Px name="sun" size={40} />} onDone={() => { void endNight(); }} />
      </div>
      {calm && <CantSleep onClose={() => setCalm(false)} />}
      {phoneLocked.value && <PhoneLock />}
      <div class="dimmer" style={{ opacity: dim && !calm ? 0.6 : 0 }} />
    </div>
  );
}

// ------------------------------------------------------------------ can't sleep

const STORIES: { title: string; lines: string[] }[] = [
  { title: 'The Lantern Boat', lines: ['Once, on a lake as still as a mirror, there was a tiny boat with a lantern at its bow.', 'It did not go anywhere in a hurry. It drifted, slowly, wherever the water was calm.', 'A frog on a lily pad said hello, very quietly, so as not to wake the fish.', 'The lantern hummed a little tune, and the reeds swayed along, left… and right… and left.', 'The stars came down to look at themselves in the water, and decided they liked it there.', 'The boat drifted to the softest corner of the lake, where the moss grows like a blanket.', 'And there it rested, rocking gently, gently, until morning.'] },
  { title: 'Counting Clouds', lines: ['Pip lay on the highest branch and watched the night clouds pass, one at a time.', 'The first cloud was shaped like a teapot. It poured out a little moonlight and floated on.', 'The second cloud was shaped like a sleepy cat, curled into a perfect circle.', 'The third cloud was just a cloud, and that was fine too.', 'Each one moved slower than the last, as if the whole sky was getting drowsy.', 'Pip counted four… then five… and somewhere around six, forgot what came next.', 'The clouds didn’t mind. They kept drifting by, soft and grey and quiet, all night long.'] },
  { title: 'The Snow Library', lines: ['Deep in the woods there is a library made of snow, where the books are very quiet.', 'The librarian is an old hare with round spectacles and slippers that make no sound at all.', 'Every night she takes down one book, warms her paws by the candle, and reads a single page.', 'Tonight the page is about a mountain that learned to sit very, very still.', 'Outside, the snow falls in big slow flakes, each one taking its time.', 'The candle flickers, the hare yawns, and the book closes itself with a soft little puff.', 'Shh. The library is sleeping now. You can sleep too.'] },
];

function StoryReader() {
  const [idx] = useState(() => Math.floor(Math.random() * STORIES.length));
  const story = STORIES[idx];
  const [shown, setShown] = useState(1);
  const [tts, setTts] = useState<Tts | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => { let on = true; void voice().then((t) => { if (on && t) { setTts(t); t.onState((st) => setReading(st.state === 'speaking' || st.state === 'paused')); } }); return () => { on = false; }; }, []);
  useEffect(() => () => tts?.stop(), [tts]);
  useEffect(() => { if (shown >= story.lines.length) return; const id = setTimeout(() => setShown((n) => n + 1), reading ? 6500 : 4600); return () => clearTimeout(id); }, [shown, reading]);
  const whisper = () => {
    if (!tts) return;
    tap('ui_tap', 0.3);
    if (reading) { tts.stop(); return; }
    setShown(story.lines.length);
    tts.speak(story.lines.map((text) => ({ text, voice: 'rounded', rate: 0.82 })), { voice: 'rounded', rate: 0.82 }).catch(() => setReading(false));
  };
  return (
    <div class="story">
      <Paper kind="book" opts={{ edge: 0.4, edgeW: 8 }} class="story-page">
        <h3>{story.title}</h3>
        {story.lines.slice(0, shown).map((l, i) => <p key={i} class="story-line">{l}</p>)}
        {shown < story.lines.length && <p class="story-dots"><i /><i /><i /></p>}
      </Paper>
      {tts && <button class="hh-btn-cream story-voice" onClick={whisper}><Px name={reading ? 'pause' : 'speaker_on'} size={30} />{reading ? 'Shh, stop' : 'Whisper it to me'}</button>}
    </div>
  );
}

function CantSleep(p: { onClose: () => void }) {
  const [view, setView] = useState<'menu' | 'sounds' | 'story'>('menu');
  const s = save.value;
  const lockNow = () => {
    tap('ui_confirm', 0.4);
    setPhoneLock(true);
    try { void document.documentElement.requestFullscreen?.().catch(() => {}); } catch { /* not allowed here */ }
    p.onClose();
  };
  const breathe = () => {
    tap('ui_confirm', 0.4);
    p.onClose();
    breathing.value = { pattern: 'sleep', minutes: 3, follow: false };
  };
  const OPTS = [
    { id: 'breathe', sprite: 'lantern', title: 'Breathe', sub: 'Three minutes of 4-7-8', run: breathe },
    { id: 'sounds', sprite: 'music', title: 'Sounds', sub: 'Rain, waves, a lullaby', run: () => { tap('ui_open', 0.3); setView('sounds'); } },
    { id: 'story', sprite: 'book', title: 'A story', sub: 'Pip whispers a slow one', run: () => { tap('paper_flip', 0.4); setView('story'); } },
    { id: 'lock', sprite: 'lock', title: 'Lock my phone', sub: 'Put it to sleep till morning', run: lockNow },
  ];
  return (
    <div class="calm" onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) p.onClose(); }}>
      <div class="calm-board hh-wood-dark">
        <header class="calm-head">
          {view !== 'menu' ? <button class="calm-x" aria-label="Back" onClick={() => { tap('ui_back', 0.3); setView('menu'); }}><Px name="arrow_left" size={30} /></button> : <span class="calm-moon"><Px name="moon" size={40} /></span>}
          <div class="grow"><h2>{view === 'sounds' ? 'Something to listen to' : view === 'story' ? 'Shh… a story' : "Can't sleep? That's okay."}</h2>{view === 'menu' && <p>Lying awake happens to everyone. Let's make it softer.</p>}</div>
          <button class="calm-x" aria-label="Close" onClick={() => { tap('ui_close', 0.3); p.onClose(); }}><Px name="cross" size={30} /></button>
        </header>
        {view === 'menu' && <>
          <div class="calm-grid">
            {OPTS.map((o) => (
              <button class={'calm-opt' + (o.id === 'lock' ? ' lock' : '')} onClick={o.run}>
                <span class="glow"><Px name={o.sprite} size={52} /></span>
                <b>{o.title}</b><small>{o.sub}</small>
              </button>
            ))}
          </div>
          <Paper kind="sticky" opts={{ sticky: 1 }} class="calm-tip">
            <b>Pip's tip</b> If you've been awake for about 20 minutes, it's fine to get up. Sit somewhere dim and do something dull, then come back when your eyes feel heavy.
          </Paper>
        </>}
        {view === 'sounds' && <div class="calm-sounds">
          <SoundTiles cols={4} value={s.sleep.soundscape} options={SOUNDSCAPES} onPick={(v) => { edit((x) => { x.sleep.soundscape = v; }); sound.soundscape(v === 'none' ? null : v, s.sleep.soundscapeVol, 30); }} preview={() => 0} />
          <p class="calm-note">It plays for half an hour, then fades away.</p>
        </div>}
        {view === 'story' && <StoryReader />}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the phone lock

function SleepingPip() {
  return <ArtCanvas w={64} h={46} k={4} fps={5} class="lock-pip" label="Pip asleep in the nest" draw={(a, t, f) => {
    // a soft cloud, and Pip's nest on it with the blanket rising and falling
    for (const [cx, cy, r] of [[18, 38, 9], [32, 35, 12], [46, 38, 9], [30, 42, 10]] as const) a.disc(cx, cy, r, (x, y) => dtone('lilac', 3.6 + (y < cy - r * 0.4 ? 1 : 0) - (y > 42 ? 0.8 : 0), x, y));
    a.outline('#232a39');
    nest(a, 31, 28, 0.95, Math.sin(t * 1.4) > 0.2 ? 1 : 0);
    // drifting z's
    for (let i = 0; i < 3; i++) {
      const k = ((t * 0.35 + i / 3) % 1), zx = 44 + k * 12 + Math.sin(k * 6 + i) * 2, zy = 14 - k * 14;
      if (k > 0.85) continue;
      const c = k < 0.5 ? '#ebedef' : '#9aa9bd', sz = i === 1 ? 5 : 4;
      a.rect(zx, zy, sz, 1, c); for (let j = 1; j < sz - 1; j++) a.px(zx + sz - 1 - j, zy + j, c); a.rect(zx, zy + sz - 1, sz, 1, c);
    }
    void f;
  }} />;
}

function PhoneLock() {
  useTick(1000);
  const s = save.value, h12 = s.settings.hour12;
  const [ask, setAsk] = useState(false);
  const now = new Date();
  const hh = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: h12 });
  const wake = s.active?.session.wakeTarget;
  const st = blockStatus.value;
  return (
    <div class="plock" role="dialog" aria-label="Phone locked for the night" onClick={(e) => e.stopPropagation()}>
      <div class="lock-sky" />
      <div class="lock-moon"><ArtCanvas w={40} h={40} k={4} fps={0} draw={(a) => moon(a, 20, 20, 13, { phase: moonPhase(), glow: 0.8 })} /></div>
      <div class="lock-time">{hh}</div>
      <p class="lock-sub">{wake ? `Your phone is resting until ${fmtTime(wake, h12)}.` : 'Your phone is resting until morning.'}</p>
      <SleepingPip />
      <p class="lock-pipline">{s.name} is fast asleep. Close your eyes too.</p>
      {st && <p class="lock-block"><Px name="shield" size={30} />{st.blocking ? 'Distracting sites are blocked tonight' : 'The bedtime blocker is standing by'}</p>}
      <div class="lock-foot">
        {!ask ? (
          <HoldButton ms={5000} label="Hold for five seconds to unlock" class="lock-hold" sound="breath_in" onDone={() => { sound.play('owl_hoot', { volume: 0.25, rate: 0.8 }); setAsk(true); }}>
            <Px name="lock" size={30} /><span>Hold 5 seconds to unlock</span>
          </HoldButton>
        ) : (
          <Paper kind="cream" opts={{ edge: 0.3 }} class="lock-ask">
            <b>Are you sure?</b>
            <p>{s.name} is almost asleep. The screen's light can wake your brain right back up.</p>
            <div class="lock-ask-row">
              <button class="hh-btn-night" onClick={() => { tap('ui_close', 0.3); setAsk(false); }}>Stay in bed</button>
              <button class="lock-anyway" onClick={() => { tap('ui_tap', 0.3); setAsk(false); setPhoneLock(false); try { if (document.fullscreenElement) void document.exitFullscreen(); } catch { /* */ } }}>Unlock anyway</button>
            </div>
          </Paper>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ the alarm

function WakingPip() {
  // a render of the 3D Pip, in art pixels, stretching awake (CSS steps)
  return <span class="wake-pip"><PipPix n={46} size={184} shot="full" label="Pip waking up" /></span>;
}

export function AlarmOverlay() {
  injectSleepFrames();
  const s = save.value, sess = s.active?.session;
  // the clock shows the night that is ending: lights-out to the alarm that is ringing
  const hm = (t: number) => { const d = new Date(t); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  const t = sess ? { bed: hm(sess.start), wake: hm(sess.wakeTarget ?? Date.now()) } : tonight();
  return (
    <div class="overlay dawn">
      <div class="dawn-sky" />
      <div class="dawn-sign hh-wood"><h1><Letters text="Good morning!" mode="wave" /></h1></div>
      <div class="dawn-scene">
        <WoodClock wake={t.wake} bedtime={t.bed} hour12={s.settings.hour12} ringing size={230} />
        <WakingPip />
      </div>
      <p class="dawn-sub">{s.name} is flying home with something in the satchel…</p>
      <div class="dawn-foot">
        <button class="hh-btn-cream dawn-snooze" onClick={() => { tap('ui_tap', 0.5); snooze(9); }}><Px name="zzz" size={30} />Snooze 9 min</button>
        <SlideToConfirm label="Slide: I'm awake" icon={<Px name="sun" size={40} />} onDone={() => { void endNight(); }} />
      </div>
    </div>
  );
}

export const _keep = { phase, nowT };
