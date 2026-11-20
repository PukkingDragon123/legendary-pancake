// The night: everything that happens between "Goodnight, Pip" and the morning report. Starts the
// microphone tracker, arms the smart alarm, tells the blocker extension to hold the line, plays
// the soundscape, notices phone peeks, then turns the recording into a report, an adventure and
// rewards. Survives a page reload mid-night by resuming from the save.
import { signal } from '@preact/signals';
import { sound } from '../audio/sound.ts';
import { AlarmClock, analyze, closeAlarmNotification, demoNight, nextOccurrence, Reminders, showAlarmNotification, SleepRecorder, type LiveLevel, type ReminderKind, type SleepSession } from '../sleep/index.ts';
import { rollAdventure } from './adventure.ts';
import { BlockerBridge, type BlockStatus } from './blocker.ts';
import { dayKey, edit, flush, ownsEntry, save } from './store.ts';

export type Phase = 'day' | 'sleeping' | 'ringing' | 'morning';

export const phase = signal<Phase>(save.value.active ? 'sleeping' : save.value.pending ? 'morning' : 'day');
export const live = signal<LiveLevel | null>(null);
/** a short rolling history of levels for the bedside squiggle */
export const trace = signal<number[]>([]);
export const micState = signal<'off' | 'listening' | 'denied' | 'unsupported' | 'error' | 'paused'>('off');
export const ringReason = signal<string>('');
export const blockStatus = signal<BlockStatus | null>(null);
export const eventsTonight = signal(0);

const bridge = new BlockerBridge();
let recorder: SleepRecorder | null = null;
const alarm = new AlarmClock({ onStateChange: (s) => { if (s === 'ringing') ring(); } });
let reminders: Reminders | null = null;
let onReminder: (k: ReminderKind) => void = () => {};

export function bedtimeOf(wake: string, goalMin: number): string {
  const [h, m] = wake.split(':').map(Number);
  const t = (((h * 60 + m - goalMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** The next wake-up time for the current prefs (repeat days, or the next occurrence if none). */
export function nextWakeAt(now = Date.now()): number {
  const p = save.value.sleep;
  return nextOccurrence(p.wake, now, p.days.length ? p.days : undefined);
}

export async function connectBlocker() {
  bridge.onStatus((s) => (blockStatus.value = s));
  const st = await bridge.connect();
  blockStatus.value = st;
  if (st) await bridge.sendConfig(save.value.blocker);
  return st;
}
export async function pushBlockerConfig() { blockStatus.value = (await bridge.sendConfig(save.value.blocker)) ?? blockStatus.value; }

export function setupReminders(fire: (k: ReminderKind) => void) {
  onReminder = fire;
  if (!reminders) reminders = new Reminders({
    onFire: (k) => onReminder(k),
    icon: `${import.meta.env.BASE_URL}icon-192.png`,
    messages: {
      winddown: { title: 'Time to wind down', body: `${save.value.name} is putting on pajamas. Dim the lights and try a breathing exercise?` },
      bedtime: { title: 'Bedtime in Hoot Hollow', body: `${save.value.name} is ready for tonight's adventure. Goodnight!` },
    },
  });
  syncReminders();
}
export function syncReminders() {
  const p = save.value.sleep;
  reminders?.configure({ bedtime: bedtimeOf(p.wake, p.goalMin), windDownMin: p.windDownMin, days: [], enabled: p.reminders });
}
export const requestNotifications = () => reminders?.requestPermission() ?? Promise.resolve('default' as NotificationPermission);

// ------------------------------------------------------------------ the night itself

function onLevel(l: LiveLevel) {
  live.value = l;
  const t = trace.value.length > 160 ? trace.value.slice(-160) : trace.value.slice();
  t.push(Math.max(0, l.db - l.floor));
  trace.value = t;
}

async function startRecorder(s: SleepSession) {
  const p = save.value.sleep;
  if (!p.mic) { micState.value = 'off'; return; }
  recorder = new SleepRecorder({
    onLevel, sensitivity: p.sensitivity, recordClips: p.clips && save.value.plus.active, sessionId: s.id, origin: s.start,
    onEvent: () => { eventsTonight.value++; },
    onStatus: (st) => { micState.value = st === 'running' ? 'listening' : st === 'interrupted' ? 'paused' : micState.value; },
  });
  const r = await recorder.start();
  micState.value = r === 'ok' ? 'listening' : r;
  if (r !== 'ok') { recorder = null; edit((x) => { if (x.active) x.active.session.micUsed = false; }); }
}

function armAlarm(s: SleepSession) {
  const p = save.value.sleep;
  if (!p.alarmOn || !s.wakeTarget) return;
  alarm.schedule({
    wakeAt: s.wakeTarget, smartWindowMin: p.smartMin,
    isLight: () => !!recorder && recorder.isLightSleep(),
    onRing: (reason) => { ringReason.value = reason; },
  });
}

/** Lights out. Call from the tap (it unlocks audio for the alarm). */
export async function startNight(o: { alarm: boolean }) {
  sound.unlock();
  const p = save.value.sleep;
  const start = Date.now();
  const wakeTarget = o.alarm && p.alarmOn ? nextWakeAt(start + 20 * 60_000) : undefined;
  const session: SleepSession = { id: 'n' + start.toString(36), start, wakeTarget, smartWindowMin: p.smartMin, micUsed: p.mic, epochs: [], events: [] };
  edit((x) => { x.active = { session, area: x.area, peeks: [] }; });
  flush();
  phase.value = 'sleeping';
  trace.value = []; eventsTonight.value = 0;
  sound.preload([p.alarmSound]);
  sound.music(null);
  sound.soundscape(p.soundscape === 'none' ? null : p.soundscape, p.soundscapeVol, p.soundscapeMin);
  void bridge.setSleep(true, wakeTarget).then((st) => { if (st) blockStatus.value = st; });
  await startRecorder(session);
  armAlarm(session);
}

/** After a reload mid-night: pick the night back up. */
export async function resumeNight() {
  const a = save.value.active;
  if (!a) return;
  phase.value = 'sleeping';
  if (a.session.wakeTarget && Date.now() > a.session.wakeTarget + 2 * 3600_000) { await endNight(); return; }
  await startRecorder(a.session);
  armAlarm(a.session);
}

function ring() {
  phase.value = 'ringing';
  sound.alarm(save.value.sleep.alarmSound);
  void showAlarmNotification({ title: 'Good morning!', body: `${save.value.name} is flying home with treasures from last night.`, snoozeMin: 9 });
  if (navigator.vibrate) navigator.vibrate([400, 300, 400, 300, 800]);
}

export function snooze(min = 9) {
  sound.stopAlarm();
  void closeAlarmNotification();
  alarm.snooze(min);
  phase.value = 'sleeping';
}

/** Note when the phone was picked up during the night (shown in the morning report). */
export function notePeek() {
  const a = save.value.active;
  if (!a || phase.value !== 'sleeping') return;
  const now = Date.now();
  if (now - a.session.start < 15 * 60_000) return;
  if (a.peeks.length && now - a.peeks[a.peeks.length - 1] < 5 * 60_000) return;
  edit((x) => { x.active?.peeks.push(now); });
}

/** Wake up: finish the recording, score the night, roll the adventure, pay out rewards. */
export async function endNight(): Promise<void> {
  sound.stopAlarm();
  sound.soundscape(null);
  void closeAlarmNotification();
  alarm.cancel();
  const a = save.value.active;
  if (!a) { phase.value = 'day'; return; }
  const rec = recorder?.stop();
  recorder = null;
  micState.value = 'off';
  const s: SleepSession = { ...a.session, end: Date.now(), epochs: rec?.epochs ?? a.session.epochs, events: rec?.events ?? a.session.events };
  finishSession(s, a.area, a.peeks);
  void bridge.setSleep(false).then((st) => { if (st) blockStatus.value = st; });
}

function finishSession(s: SleepSession, area: string, peeks: number[]) {
  const { stages, report } = analyze(s, { hour12: save.value.settings.hour12 });
  if (peeks.length) report.notes = [...report.notes.slice(0, 2), peeks.length === 1 ? 'You checked your phone once during the night.' : `You checked your phone ${peeks.length} times during the night.`];
  s.stages = stages; s.report = report;
  const sv = save.value;
  const adv = rollAdventure({ area, report, seed: s.start % 100000, owned: (e) => ownsEntry(sv, e), plus: sv.plus.active, name: sv.name, streak: sv.streak });
  const goalMet = report.asleep >= sv.sleep.goalMin * 60_000 * 0.85 || report.score >= 70;
  edit((x) => {
    // keep the night but trim very long event lists so the save stays small
    const stored: SleepSession = { ...s, events: s.events.slice(0, 400) };
    x.nights = [...x.nights.filter((n) => n.id !== s.id), stored].slice(-90);
    delete x.active;
    x.pending = { sessionId: s.id, adventure: adv };
    const key = dayKey(s.end);
    if (!s.simulated && key !== x.lastNightKey) {
      x.streak = goalMet ? x.streak + 1 : 0;
      x.bestStreak = Math.max(x.bestStreak, x.streak);
      x.lastNightKey = key;
    }
  });
  flush();
  phase.value = 'morning';
}

/** Morning reveal finished: grant the treasures and rewards. */
export function collectAdventure() {
  const p = save.value.pending;
  if (!p) return;
  edit((x) => {
    x.acorns += p.adventure.acorns;
    x.xp += p.adventure.xp;
    x.stones += p.adventure.stones;
    for (const f of p.adventure.finds) {
      if (f.kind === 'trinket') x.collection[f.id] = (x.collection[f.id] ?? 0) + 1;
      else if (f.kind === 'item' && !x.owned.items.includes(f.id)) x.owned.items.push(f.id);
      else if (f.kind === 'piece' && !x.owned.pieces.includes(f.id)) x.owned.pieces.push(f.id);
      else if (f.kind === 'palette' && !x.owned.palettes.includes(f.id)) x.owned.palettes.push(f.id);
    }
    delete x.pending;
  });
  phase.value = 'day';
}

/** A complete simulated night so new players can see the whole loop right away. */
export function demoTonight() {
  const s = demoNight({ snorer: Math.random() < 0.4 });
  s.simulated = true;
  finishSession(s, save.value.area, []);
}

export function setMicSensitivity(v: number) { edit((x) => { x.sleep.sensitivity = v; }); }
