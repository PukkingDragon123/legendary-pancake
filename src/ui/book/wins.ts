// "What you did great today": the diary's bright side, worked out from the save. For a calendar day it finds the
// night that ended that morning and lists what went well (enough sleep, asleep on time, a quick drift-off, an
// unbroken night, a strong score, a streak, breathing, the wind-down, a diary line), plus up to three gentle aims
// for tonight when the day is today. Pure functions (no DOM), so they are easy to test.
import type { DayPlan, Save } from '../../game/store.ts';
import { reported, type Night } from './stats.ts';

export type WinKind = 'sleep' | 'clock' | 'calm' | 'streak' | 'habit' | 'note';
export interface Win { id: string; text: string; sub?: string; kind: WinKind }
export interface DayWins { day: string; night?: Night; great: Win[]; aims: Win[] }

/** what the save must hold for the wins (a narrow slice, so tests can build one by hand) */
export type WinSave = Pick<Save, 'nights' | 'routine' | 'streak' | 'breath' | 'diary'> & { sleep: Pick<Save['sleep'], 'goalMin'>; settings: Pick<Save['settings'], 'hour12'> };

export const ymd = (t: number | Date) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** the calendar day a night belongs to: the morning it ended */
export const nightDayKey = (n: Pick<Night, 'start' | 'end' | 'report'>) => ymd(n.report?.wokeAt ?? n.end ?? n.start);
/** the evening a calendar day's night began on ("2026-11-27" -> the Wednesday before) */
const eveningOf = (day: string) => { const [y, m, d] = day.split('-').map(Number); return new Date(y, m - 1, d - 1, 20, 0, 0, 0); };

export const dur = (ms: number) => { const m = Math.max(0, Math.round(ms / 60_000)); const h = Math.floor(m / 60); return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`; };
export const clock = (t: number | Date, h12: boolean) => {
  const d = new Date(t), h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  return h12 ? `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}` : `${String(h).padStart(2, '0')}:${m}`;
};
const hhmm = (s: string) => { const [h, m] = s.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
/** minutes after 18:00 */
const eve = (min: number) => (min - 18 * 60 + 1440) % 1440;
const eveT = (t: number) => { const d = new Date(t); return eve(d.getHours() * 60 + d.getMinutes()); };
const planBed = (routine: DayPlan[], weekday: number) => routine[((weekday % 7) + 7) % 7]?.bed ?? '23:00';
const atClock = (min: number, h12: boolean) => clock(new Date(2020, 0, 1, Math.floor(min / 60), min % 60), h12);

/** the order wins are listed in (the seven most telling are kept) */
const PRIORITY = ['goal', 'near', 'score', 'ontime', 'streak', 'quick', 'through', 'breath', 'ritual', 'phone', 'note', 'deep', 'mic'];

/** The night that ended on `day` (the latest one, real nights before demo ones). */
export function nightOn(s: Pick<Save, 'nights'>, day: string): Night | undefined {
  const all = reported(s).filter((n) => nightDayKey(n) === day);
  return all.filter((n) => !n.simulated).at(-1) ?? all.at(-1);
}

/**
 * Wins (and, for today, aims) for one calendar day. `ritual` lists the wind-down steps ticked that evening
 * (sleepflow's ritual ids), `today` is the current day key.
 */
export function winsFor(s: WinSave, day: string, o: { today: string; ritual?: string[]; now?: number } = { today: day }): DayWins {
  const h12 = s.settings.hour12, goal = s.sleep.goalMin * 60_000;
  const isToday = day === o.today;
  const n = nightOn(s, day);
  const great: Win[] = [];
  const aims: Win[] = [];
  if (n) {
    const r = n.report, demo = n.simulated ? ' (pretend night)' : '';
    if (r.asleep >= goal * 0.97) great.push({ id: 'goal', kind: 'sleep', text: `Slept ${dur(r.asleep)}${demo}`, sub: `Your goal is ${dur(goal)}. Met it.` });
    else if (r.asleep >= goal * 0.85) great.push({ id: 'near', kind: 'sleep', text: `Slept ${dur(r.asleep)}${demo}`, sub: `Only ${dur(goal - r.asleep)} short of your goal.` });
    const bed = planBed(s.routine, eveningOf(day).getDay()), want = eve(hhmm(bed)), got = eveT(r.asleepAt);
    if (got <= want + 15) great.push({ id: 'ontime', kind: 'clock', text: `Asleep by ${clock(r.asleepAt, h12)}`, sub: got <= want - 10 ? `Earlier than your ${atClock(hhmm(bed), h12)} bedtime.` : `Right on your ${atClock(hhmm(bed), h12)} bedtime.` });
    if (r.latencyMin <= 15) great.push({ id: 'quick', kind: 'calm', text: `Drifted off in ${Math.max(1, Math.round(r.latencyMin))} min`, sub: 'A calm mind at lights-out.' });
    if (r.awakenings <= 1 && r.efficiency >= 0.85) great.push({ id: 'through', kind: 'calm', text: 'Slept straight through', sub: `${Math.round(r.efficiency * 100)}% of the night asleep.` });
    if (r.score >= 85) great.push({ id: 'score', kind: 'sleep', text: `A wonderful night: ${r.score}`, sub: 'One of your best scores.' });
    else if (r.score >= 70) great.push({ id: 'score', kind: 'sleep', text: `A good night: ${r.score}`, sub: 'Solid, restful sleep.' });
    if (r.deep >= 0.2) great.push({ id: 'deep', kind: 'sleep', text: `${Math.round(r.deep * 100)}% deep sleep`, sub: 'The body’s repair shift.' });
    if (n.micUsed && !n.simulated) great.push({ id: 'mic', kind: 'habit', text: 'Pip listened all night', sub: 'Tracked with the microphone, on this device.' });
  }
  if (isToday && s.streak >= 2) great.push({ id: 'streak', kind: 'streak', text: `${s.streak} nights in a row`, sub: 'Your streak with Pip is alive.' });
  if (s.breath?.lastDay === day) great.push({ id: 'breath', kind: 'calm', text: 'Breathed slowly with Pip', sub: 'Long exhales tell the body it’s safe to rest.' });
  const steps = (o.ritual ?? []).length;
  if (steps >= 2) great.push({ id: 'ritual', kind: 'habit', text: `${steps} wind-down steps done`, sub: o.ritual!.includes('phone') ? 'Phone tucked in for the night, too.' : 'A runway for sleep to land on.' });
  else if (o.ritual?.includes('phone')) great.push({ id: 'phone', kind: 'habit', text: 'Put the phone to bed', sub: 'Out of reach, out of mind.' });
  const note = s.diary?.[day]?.note?.trim();
  if (note) great.push({ id: 'note', kind: 'note', text: 'Wrote in your diary', sub: 'Thoughts on paper, not in your head.' });

  if (isToday) {
    const now = new Date(o.now ?? Date.now());
    const tonight = planBed(s.routine, now.getHours() < 5 ? (now.getDay() + 6) % 7 : now.getDay());
    aims.push({ id: 'aim-bed', kind: 'clock', text: `In bed by ${atClock(hhmm(tonight), h12)}`, sub: 'Tonight’s plan on the Clock.' });
    if (s.breath?.lastDay !== day) aims.push({ id: 'aim-breath', kind: 'calm', text: 'Three slow minutes with Pip', sub: 'A breathing exercise before bed.' });
    if (!note) aims.push({ id: 'aim-note', kind: 'note', text: 'One line about today', sub: 'What went well? What can wait for tomorrow?' });
    else if (steps < 2) aims.push({ id: 'aim-ritual', kind: 'habit', text: 'Tick off the wind-down', sub: 'Dim lights, phone down, a few pages.' });
  }
  const rank = (w: Win) => PRIORITY.indexOf(w.id);
  great.sort((a, b) => rank(a) - rank(b));
  return { day, night: n, great: great.slice(0, 7), aims: aims.slice(0, 3) };
}

/** Days worth a diary page, newest first: today, every day with a note and every day a night ended. */
export function diaryDays(s: Pick<Save, 'nights' | 'diary'>, today: string): string[] {
  const set = new Set<string>([today]);
  for (const k of Object.keys(s.diary ?? {})) if ((s.diary![k].note ?? '').trim()) set.add(k);
  for (const n of reported(s)) set.add(nightDayKey(n));
  return [...set].filter((k) => k <= today).sort().reverse();
}
