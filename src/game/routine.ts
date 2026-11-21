// The weekly sleep routine and the numbers on the cuckoo-clock wall. Pure functions (no DOM, no
// save access) so they are easy to test.
//
// `routine[d]` (0 = Sunday) describes calendar day d: `bed` is the bedtime on the evening of day d,
// `wake` the wake-up time on the morning of day d, and `on` says whether the night that begins on
// day d is planned (bedtime reminder that evening, alarm the next morning). So the night that
// starts on day d runs from routine[d].bed to routine[d + 1].wake.
import type { DayPlan } from './store.ts';
import type { SleepSession } from '../sleep/types.ts';

export const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const toMin = (hhmm: string) => { const [h, m] = (hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const toHHMM = (m: number) => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
/** Minutes from an evening bedtime to the next morning's wake (wraps past midnight; never 0). */
export function nightLength(bed: string, wake: string): number { let d = toMin(wake) - toMin(bed); if (d <= 0) d += 1440; return d; }

/** Early-morning hours still belong to the previous evening's night. */
export const NIGHT_ROLLOVER_H = 5;

/** The weekday whose evening the moment `t` belongs to (before 5 AM counts as the previous day). */
export function nightDay(t: number): number {
  const d = new Date(t);
  if (d.getHours() < NIGHT_ROLLOVER_H) d.setDate(d.getDate() - 1);
  return d.getDay();
}

export interface NightPlan { day: number; on: boolean; bed: string; wake: string; min: number }
/** The plan for the night that begins on weekday `day`. */
export function planFor(routine: DayPlan[], day: number): NightPlan {
  const a = routine[((day % 7) + 7) % 7], b = routine[(day + 1) % 7];
  const bed = a?.bed ?? '23:00', wake = b?.wake ?? '07:00';
  return { day, on: a?.on ?? true, bed, wake, min: nightLength(bed, wake) };
}
/** Tonight's plan (the night `now` belongs to, or the coming evening during the day). */
export const tonightPlan = (routine: DayPlan[], now = Date.now()) => planFor(routine, nightDay(now));

/** Change the night that begins on `day`: its bedtime and the next morning's wake. */
export function setNight(routine: DayPlan[], day: number, o: { bed?: string; wake?: string; on?: boolean }): DayPlan[] {
  const r = routine.map((p) => ({ ...p }));
  const a = r[day], b = r[(day + 1) % 7];
  if (o.bed !== undefined) a.bed = o.bed;
  if (o.on !== undefined) a.on = o.on;
  if (o.wake !== undefined) b.wake = o.wake;
  return r;
}
/** Copy one night (bed, next wake, on) to other nights. */
export function copyNight(routine: DayPlan[], from: number, to: number[]): DayPlan[] {
  const p = planFor(routine, from);
  let r = routine;
  for (const d of to) if (d !== from) r = setNight(r, d, { bed: p.bed, wake: p.wake, on: p.on });
  return r;
}
/** Nights followed by a weekday morning (Sunday to Thursday). */
export const WEEKNIGHTS = [0, 1, 2, 3, 4];

/** The next wake-up after `now`: the morning after each planned night, searched a week ahead. */
export function nextWakeFromRoutine(routine: DayPlan[], now = Date.now()): number | null {
  if (!routine || routine.length !== 7) return null;
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 8; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const w = d.getDay(), prev = (w + 6) % 7;
    if (!routine[prev]?.on) continue;
    const m = toMin(routine[w].wake);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    if (d.getTime() > now) return d.getTime();
  }
  return null;
}
/** Weekdays (0 = Sunday) whose morning has an alarm: the morning after each planned night. */
export const alarmDays = (routine: DayPlan[]) => routine.map((p, d) => (p.on ? (d + 1) % 7 : -1)).filter((d) => d >= 0).sort((a, b) => a - b);

// ------------------------------------------------------------------ the numbers on the wall

/** The calendar day a night belongs to: the morning you woke up. */
export const nightKey = (s: SleepSession) => { const d = new Date(s.report?.wokeAt ?? s.end ?? s.start); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export type StickerKind = 'gold' | 'moon' | 'cloud' | 'rain';
/** The sticker a night earns on the paper calendar. */
export const stickerFor = (score: number): StickerKind => (score >= 85 ? 'gold' : score >= 70 ? 'moon' : score >= 50 ? 'cloud' : 'rain');

export interface SleepStats {
  /** asleep in the last 7 days, ms */
  weekTotal: number;
  weekNights: number;
  /** average asleep per tracked night over the last 14 days, ms */
  avgNight: number;
  /** average time of falling asleep, minutes after midnight (0..1439), or null */
  avgBed: number | null;
  /** longest run of consecutive calendar days with a tracked night */
  bestRun: number;
  /** current run ending today or yesterday */
  run: number;
  /** share of the last 30 days' nights that met the goal (0..1), or null with no nights */
  goalRate: number | null;
  nights30: number;
}

const DAY = 86400_000;
const dayIndex = (key: string) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / DAY); };

export function sleepStats(nights: SleepSession[], goalMin: number, now = Date.now()): SleepStats {
  const real = nights.filter((n) => n.report && !n.simulated);
  const end = (n: SleepSession) => n.report!.wokeAt ?? n.end ?? n.start;
  const week = real.filter((n) => now - end(n) < 7 * DAY && end(n) <= now + DAY);
  const two = real.filter((n) => now - end(n) < 14 * DAY);
  const month = real.filter((n) => now - end(n) < 30 * DAY);
  const weekTotal = week.reduce((a, n) => a + n.report!.asleep, 0);
  const avgNight = two.length ? two.reduce((a, n) => a + n.report!.asleep, 0) / two.length : 0;
  // average bedtime on a circle so 23:50 and 00:10 average to midnight
  let sx = 0, sy = 0;
  for (const n of two) { const d = new Date(n.report!.asleepAt || n.start); const a = ((d.getHours() * 60 + d.getMinutes()) / 1440) * Math.PI * 2; sx += Math.cos(a); sy += Math.sin(a); }
  const avgBed = two.length ? Math.round(((((Math.atan2(sy, sx) / (Math.PI * 2)) * 1440) % 1440) + 1440) % 1440) : null;
  const met = (n: SleepSession) => n.report!.asleep >= goalMin * 60_000 * 0.92;
  const goalRate = month.length ? month.filter(met).length / month.length : null;
  // runs of consecutive days
  const days = [...new Set(real.map((n) => dayIndex(nightKey(n))))].sort((a, b) => a - b);
  let bestRun = 0, cur = 0, prev = -99;
  for (const d of days) { cur = d === prev + 1 ? cur + 1 : 1; prev = d; bestRun = Math.max(bestRun, cur); }
  const today = dayIndex(nightKey({ start: now } as SleepSession));
  let run = 0;
  if (days.length && today - days[days.length - 1] <= 1) { run = 1; for (let i = days.length - 1; i > 0 && days[i] - days[i - 1] === 1; i--) run++; }
  return { weekTotal, weekNights: week.length, avgNight, avgBed, bestRun, run, goalRate, nights30: month.length };
}
