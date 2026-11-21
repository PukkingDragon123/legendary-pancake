// Everything the book shows, worked out from the save: sleep averages and trends, the diary,
// achievements (wax seals) and collection completion. Pure functions, so they are easy to test.
import type { Save } from '../../game/store.ts';
import type { SleepSession } from '../../sleep/types.ts';

export type Night = SleepSession & { report: NonNullable<SleepSession['report']> };

/** Nights with a report, oldest first. */
export const reported = (s: Pick<Save, 'nights'>): Night[] => s.nights.filter((n): n is Night => !!n.report).slice().sort((a, b) => a.start - b.start);

/** Nights that count for statistics: real ones, or the demo nights while there are no real ones yet. */
export function statNights(s: Pick<Save, 'nights'>): { nights: Night[]; demo: boolean } {
  const all = reported(s), real = all.filter((n) => !n.simulated);
  return real.length ? { nights: real, demo: false } : { nights: all, demo: all.length > 0 };
}

/** minutes after 18:00 (so a bedtime of 23:30 and one of 00:30 sit next to each other) */
export const eveningMin = (t: number) => { const d = new Date(t); let m = d.getHours() * 60 + d.getMinutes() - 18 * 60; if (m < 0) m += 1440; return m; };
export const dayMin = (t: number) => { const d = new Date(t); return d.getHours() * 60 + d.getMinutes(); };
/** "HH:MM" -> minutes after 18:00 / after midnight */
export const hhmmEvening = (s: string) => { const [h, m] = s.split(':').map(Number); let v = h * 60 + m - 18 * 60; if (v < 0) v += 1440; return v; };
export const fromEvening = (m: number) => { const d = new Date(2020, 0, 1, 18, 0, 0, 0); d.setMinutes(d.getMinutes() + Math.round(m)); return d; };
export const fromDay = (m: number) => new Date(2020, 0, 1, 0, Math.round(m), 0, 0);

const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

export interface Averages {
  count: number;
  asleep: number; inBed: number; score: number; latency: number; efficiency: number;
  /** minutes after 18:00 */
  bedtime: number;
  /** minutes after midnight */
  wake: number;
  deep: number; light: number; rem: number; awake: number;
  snoreMin: number; talk: number; awakenings: number;
  totalAsleep: number; bestScore: number; longest: number;
}

export function averages(nights: Night[]): Averages {
  const r = nights.map((n) => n.report);
  return {
    count: nights.length,
    asleep: mean(r.map((x) => x.asleep)), inBed: mean(r.map((x) => x.inBed)), score: mean(r.map((x) => x.score)),
    latency: mean(r.map((x) => x.latencyMin)), efficiency: mean(r.map((x) => x.efficiency)),
    bedtime: mean(r.map((x) => eveningMin(x.asleepAt))), wake: mean(r.map((x) => dayMin(x.wokeAt))),
    deep: mean(r.map((x) => x.deep)), light: mean(r.map((x) => x.light)), rem: mean(r.map((x) => x.rem)), awake: mean(r.map((x) => x.awake)),
    snoreMin: r.reduce((a, x) => a + x.snoreMin, 0), talk: r.reduce((a, x) => a + x.talkCount, 0), awakenings: mean(r.map((x) => x.awakenings)),
    totalAsleep: r.reduce((a, x) => a + x.asleep, 0), bestScore: r.reduce((a, x) => Math.max(a, x.score), 0), longest: r.reduce((a, x) => Math.max(a, x.asleep), 0),
  };
}

/** The last 7 calendar days ending today: the night that ended on each day (if any). */
export function lastWeek(nights: Night[], now = Date.now()): { day: Date; night?: Night }[] {
  const out: { day: Date; night?: Night }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = d.toDateString();
    const night = [...nights].reverse().find((x) => new Date(x.end ?? x.start).toDateString() === key);
    out.push({ day: d, night });
  }
  return out;
}

/** Longest run of consecutive calendar days with a night that met the goal (or scored 70+). */
export function bestRun(nights: Night[], goalMin: number): number {
  const ok = new Set(nights.filter((n) => n.report.asleep >= goalMin * 60_000 * 0.85 || n.report.score >= 70).map((n) => new Date(n.end ?? n.start).toDateString()));
  const days = [...ok].map((k) => new Date(k).getTime()).sort((a, b) => a - b);
  let best = 0, run = 0, prev = -Infinity;
  for (const t of days) { run = Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
  return best;
}

export const scoreInk = (s: number) => (s >= 85 ? '#3f8a4a' : s >= 70 ? '#2f6fb8' : s >= 50 ? '#c07a18' : '#b0303a');
export const scoreWord = (s: number) => (s >= 85 ? 'Wonderful' : s >= 70 ? 'Good' : s >= 50 ? 'Okay' : 'Restless');

// ------------------------------------------------------------------ achievements (wax seals)

export type SealColor = 'red' | 'gold' | 'green' | 'blue' | 'purple' | 'pink';
export interface Seal { id: string; name: string; how: string; color: SealColor; emblem: string; have: number; need: number; done: boolean }

export function seals(s: Save): Seal[] {
  const { nights } = { nights: reported(s).filter((n) => !n.simulated) };
  const any = (f: (n: Night) => boolean) => (nights.some(f) ? 1 : 0);
  const pulls = Object.values(s.shop?.pity ?? {}).reduce((a, p) => a + (p?.total ?? 0), 0);
  const moods = nights.filter((n) => n.mood !== undefined && n.mood !== null).length;
  const notes = nights.filter((n) => (n.note ?? '').trim().length > 3).length;
  const lvl = levelGuess(s.xp);
  const breaths = Math.round((s.breath?.minutes ?? 0) * 6);
  const list: Omit<Seal, 'done'>[] = [
    { id: 'met', name: 'Nice to Meet You', how: 'Answer Pip’s questions', color: 'pink', emblem: 'heart', have: s.profile?.interviewed ? 1 : 0, need: 1 },
    { id: 'first', name: 'First Night', how: 'Sleep with Pip for the first time', color: 'blue', emblem: 'moon', have: Math.min(1, nights.length), need: 1 },
    { id: 'week', name: 'A Week of Dreams', how: 'Track 7 nights', color: 'purple', emblem: 'seven', have: Math.min(7, nights.length), need: 7 },
    { id: 'month', name: 'Moon Cycle', how: 'Track 30 nights', color: 'gold', emblem: 'phases', have: Math.min(30, nights.length), need: 30 },
    { id: 'streak3', name: 'Three in a Row', how: 'A 3-night streak', color: 'red', emblem: 'three', have: Math.min(3, s.bestStreak), need: 3 },
    { id: 'streak7', name: 'Seven-Night Streak', how: 'A 7-night streak', color: 'gold', emblem: 'flame', have: Math.min(7, s.bestStreak), need: 7 },
    { id: 'eight', name: 'Eight Full Hours', how: 'Sleep 8 hours in one night', color: 'blue', emblem: 'eight', have: any((n) => n.report.asleep >= 8 * 3.6e6), need: 1 },
    { id: 'wonder', name: 'Wonderful Night', how: 'Score 85 or more', color: 'green', emblem: 'star', have: any((n) => n.report.score >= 85), need: 1 },
    { id: 'early', name: 'Early to Bed', how: 'Fall asleep before 10:30 pm', color: 'green', emblem: 'sun', have: any((n) => eveningMin(n.report.asleepAt) <= 4 * 60 + 30), need: 1 },
    { id: 'quiet', name: 'Silent Night', how: 'A night without snoring or waking', color: 'purple', emblem: 'hush', have: any((n) => n.report.snoreMin < 1 && n.report.awakenings === 0), need: 1 },
    { id: 'breath1', name: 'First Breath', how: 'Finish a breathing exercise', color: 'pink', emblem: 'feather', have: Math.min(1, s.breath?.sessions ?? 0), need: 1 },
    { id: 'breath50', name: '50 Breaths', how: 'Breathe slowly with Pip 50 times', color: 'blue', emblem: 'wind', have: Math.min(50, breaths), need: 50 },
    { id: 'unpacked', name: 'All Unpacked', how: 'Open every moving box', color: 'gold', emblem: 'box', have: s.home?.seeded && !(s.home.boxes?.length) ? 1 : 0, need: 1 },
    { id: 'wish', name: 'First Wish', how: 'Make a wish in the shop', color: 'purple', emblem: 'wish', have: Math.min(1, pulls), need: 1 },
    { id: 'mood', name: 'Feelings Diary', how: 'Stamp your mood on 5 mornings', color: 'red', emblem: 'face', have: Math.min(5, moods), need: 5 },
    { id: 'note', name: 'Dear Diary', how: 'Write a note about a night', color: 'green', emblem: 'quill', have: Math.min(1, notes), need: 1 },
    { id: 'explorer', name: 'Explorer', how: 'Visit 3 places on adventures', color: 'green', emblem: 'compass', have: Math.min(3, s.seen?.areas?.length ?? 0), need: 3 },
    { id: 'nest', name: 'Cozy Nest', how: 'Own 15 pieces of furniture', color: 'red', emblem: 'chair', have: Math.min(15, s.owned?.items?.length ?? 0), need: 15 },
    { id: 'dapper', name: 'Dressed to Dream', how: 'Own 6 outfit pieces', color: 'pink', emblem: 'hat', have: Math.min(6, s.owned?.pieces?.length ?? 0), need: 6 },
    { id: 'level5', name: 'Wise Old Owl', how: 'Reach level 5', color: 'gold', emblem: 'crown', have: Math.min(5, lvl), need: 5 },
  ];
  return list.map((x) => ({ ...x, done: x.have >= x.need }));
}

// mirrors catalog.levelOf without importing the catalog (keeps this module light for tests)
function levelGuess(xp: number) {
  const xpFor = (level: number) => Math.round(120 * ((level - 1) ** 1.45) + 60 * (level - 1));
  let l = 1;
  while (xp >= xpFor(l + 1)) l++;
  return l;
}

// ------------------------------------------------------------------ profile

const GOAL_NAMES: Record<string, string> = {
  better: 'Sleep better', deeper: 'Sleep more deeply', quality: 'Sleep better', earlier: 'Go to bed earlier', early: 'Go to bed earlier',
  longer: 'Sleep longer', more: 'Sleep more', faster: 'Fall asleep faster', asleep: 'Fall asleep faster', latency: 'Fall asleep faster',
  wake: 'Wake up refreshed', refreshed: 'Wake up refreshed', morning: 'Enjoy mornings', routine: 'Keep a steady routine', consistent: 'Keep a steady routine',
  phone: 'Put the phone down', screen: 'Less screen time at night', stress: 'Worry less at night', calm: 'Feel calmer at night', relax: 'Relax before bed',
  snore: 'Snore less', dreams: 'Remember my dreams', dream: 'Remember my dreams', energy: 'Have more energy', nap: 'Nap less', caffeine: 'Less late caffeine',
};
export const goalName = (id: string) => GOAL_NAMES[id] ?? (id.replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase()));

/** Days since the first night together (at least 1). */
export function daysTogether(s: Pick<Save, 'nights'>, now = Date.now()): number {
  const first = s.nights.reduce((a, n) => Math.min(a, n.start), Infinity);
  if (!Number.isFinite(first)) return 1;
  return Math.max(1, Math.floor((now - first) / 86_400_000) + 1);
}

/** Split a list into pages of `per`. */
export function chunk<T>(a: T[], per: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += Math.max(1, per)) out.push(a.slice(i, i + Math.max(1, per)));
  return out.length ? out : [[]];
}
