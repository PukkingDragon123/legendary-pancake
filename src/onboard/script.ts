// The interview itself: Pip's lines, the clipboard pages and their options, his reactions, and
// how the answers become a sleep plan and land in the save.
import type { OwlAction, OwlMood } from '../owl/actor.ts';
import { SPECIES, speciesOf } from '../owl/species.ts';
import type { Profile, Save } from '../game/store.ts';
import type { ShotName } from './office.ts';

export interface Answers {
  you: string;
  species: string;
  name: string;
  goals: string[];
  wake: string;
  hours: number;
  latency: Profile['latency'];
  phone: Profile['phone'];
  chrono: Profile['chronotype'];
  caffeine: Profile['caffeine'];
  relax: string[];
  mic: boolean;
  /** what gets in the way of sleep (the combined page): fills latency, phone, caffeine and goals */
  blocks: string[];
}

export type PageKind = 'text' | 'species' | 'choice' | 'multi' | 'dial' | 'hours' | 'plan';
export interface Opt { v: string; label: string; sub?: string; icon: string }
export interface Beat { text: string; mood?: OwlMood; act?: OwlAction; shot?: ShotName; cut?: boolean }
export interface Step {
  id: string;
  /** clipboard title */
  title: string;
  kind: PageKind;
  /** what Pip says before the page comes up (the last beat stays on screen as the question) */
  say: (a: Answers, o: { artifact: boolean }) => (Beat | string)[];
  /** Pip's reaction once answered; shown at the start of the next step */
  react?: (a: Answers) => Beat | string | null;
  opts?: Opt[];
  /** answer field on the save-ready answers */
  field?: keyof Answers;
  /** camera while asking */
  shot: ShotName;
  /** where Pip waits while the page is up */
  vignettes?: boolean;
  /** what gets written on the answer line */
  written?: (a: Answers) => string;
}

export type Sticker = Opt & { art: string; col: string };
export const GOALS: Sticker[] = [
  { v: 'sleep_better', label: 'Sleep better', sub: 'deeper, cosier nights', icon: 'bed', art: 'bed', col: 'paper' },
  { v: 'fall_asleep', label: 'Fall asleep faster', sub: 'less counting sheep', icon: 'sheep', art: 'sheep', col: 'oat' },
  { v: 'wake_refreshed', label: 'Wake up refreshed', sub: 'bright-eyed mornings', icon: 'sunrise', art: 'sunrise', col: 'linen' },
  { v: 'steady_routine', label: 'Steady routine', sub: 'same time, every day', icon: 'clock', art: 'clock', col: 'paper' },
  { v: 'less_phone', label: 'Less phone at night', sub: 'tuck it away', icon: 'phonedrawer', art: 'phonedrawer', col: 'oat' },
  { v: 'track_sounds', label: 'Track snoring', sub: 'and sleep-talking', icon: 'mic', art: 'mic', col: 'linen' },
];
/** [tutor] the one page that replaced the latency, phone, caffeine and goals questions */
export const BLOCKS: Sticker[] = [
  { v: 'phone', label: 'My phone', sub: 'just one more scroll', icon: 'phonedrawer', art: 'phonedrawer', col: 'oat' },
  { v: 'caffeine', label: 'Caffeine', sub: 'a late coffee or tea', icon: 'mugmoon', art: 'mugmoon', col: 'linen' },
  { v: 'mind', label: 'A busy mind', sub: 'thoughts that won’t stop', icon: 'clock', art: 'clock', col: 'paper' },
  { v: 'slow', label: 'Slow to drift off', sub: 'a lot of sheep', icon: 'sheep', art: 'sheep', col: 'oat' },
];
/** The profile fields the obstacles page stands for (removed questions keep sensible defaults). */
export function fromBlocks(a: Answers, blocks: string[]): Answers {
  const has = (v: string) => blocks.includes(v);
  const latency: Answers['latency'] = has('slow') && has('mind') ? 'long' : has('slow') || has('mind') ? 'slow' : 'normal';
  const goals = ['sleep_better', ...(has('phone') ? ['less_phone'] : []), ...(has('slow') || has('mind') ? ['fall_asleep'] : [])];
  return { ...a, blocks: [...blocks], latency, phone: has('phone') ? 'nightly' : 'sometimes', caffeine: has('caffeine') ? 'late' : a.caffeine === 'none' ? 'none' : 'morning', goals };
}
/** what the save's profile says about the obstacles (a returning player sees their answer again) */
export function blocksOf(p: Pick<Profile, 'latency' | 'phone' | 'caffeine'>): string[] {
  const b: string[] = [];
  if (p.phone === 'nightly') b.push('phone');
  if (p.caffeine === 'late') b.push('caffeine');
  if (p.latency === 'long') b.push('mind');
  if (p.latency === 'slow' || p.latency === 'long') b.push('slow');
  return b;
}
export const RELAX: (Sticker & { sound?: string })[] = [
  { v: 'rain', label: 'Rain', icon: 'rain', art: 'rain', col: 'mist', sound: 'amb_rain' },
  { v: 'waves', label: 'Waves', icon: 'waves', art: 'waves', col: 'mist', sound: 'amb_waves' },
  { v: 'forest', label: 'Night forest', icon: 'forest', art: 'forest', col: 'sage', sound: 'amb_forest_night' },
  { v: 'fire', label: 'Crackling fire', icon: 'fire', art: 'fire', col: 'straw', sound: 'amb_fire' },
  { v: 'stream', label: 'A stream', icon: 'stream', art: 'stream', col: 'sage', sound: 'amb_stream' },
  { v: 'wind', label: 'Soft wind', icon: 'wind', art: 'wind', col: 'mist', sound: 'amb_wind' },
  { v: 'brown', label: 'Brown noise', icon: 'radio', art: 'radio', col: 'linen', sound: 'amb_brown' },
  { v: 'lullaby', label: 'Lullaby', icon: 'lullaby', art: 'lullaby', col: 'blush', sound: 'music_lullaby' },
  { v: 'night', label: 'Crickets', icon: 'cricket', art: 'cricket', col: 'sage', sound: 'amb_night' },
  { v: 'breathing', label: 'Breathing', icon: 'breath', art: 'breath', col: 'linen' },
  { v: 'reading', label: 'Reading', icon: 'book', art: 'book', col: 'straw' },
];
export const SOUND_NAME: Record<string, string> = {
  amb_rain: 'gentle rain', amb_waves: 'ocean waves', amb_forest_night: 'the night forest', amb_fire: 'a crackling fire', amb_stream: 'a little stream',
  amb_wind: 'soft wind', amb_brown: 'brown noise', music_lullaby: 'a lullaby', amb_night: 'crickets',
};
export const ALARM_NAME: Record<string, string> = { alarm_birds: 'Morning birds', alarm_musicbox: 'Music box', alarm_kalimba: 'Kalimba', alarm_bells: 'Bells' };

const LATENCY_MIN: Record<Answers['latency'], number> = { quick: 5, normal: 15, slow: 30, long: 45 };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export const hm = (min: number) => { const t = ((Math.round(min) % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export function fmt(hhmm: string, hour12: boolean) {
  const [h, m] = hhmm.split(':').map(Number);
  if (!hour12) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Answers pre-filled from the save (so a returning player sees what they said before). */
export function answersFrom(s: Save): Answers {
  const p = s.profile;
  return {
    you: p.you, species: s.look.species ?? 'tawny', name: s.name || 'Pip', goals: [...p.goals], wake: s.sleep.wake, hours: p.sleepHours || s.sleep.goalMin / 60,
    latency: p.latency, phone: p.phone, chrono: p.chronotype, caffeine: p.caffeine, relax: [...p.relax], mic: s.sleep.mic,
    blocks: blocksOf(p),
  };
}

export interface Plan { wake: string; bed: string; windDown: string; windDownMin: number; goalMin: number; soundscape: string; alarm: string; blocker: boolean; tips: string[] }

/** Turn the answers into a sleep plan. */
export function planOf(a: Answers): Plan {
  const goalMin = Math.round(Math.max(5, Math.min(11, a.hours)) * 60);
  const wakeMin = toMin(a.wake);
  const bed = hm(wakeMin - goalMin);
  let windDownMin = a.latency === 'quick' ? 20 : a.latency === 'normal' ? 30 : a.latency === 'slow' ? 45 : 60;
  if (a.phone === 'nightly') windDownMin = Math.min(60, windDownMin + 15);
  const sound = RELAX.find((r) => a.relax.includes(r.v) && r.sound)?.sound ?? 'amb_rain';
  const alarm = a.chrono === 'lark' ? 'alarm_birds' : a.chrono === 'owl' ? 'alarm_kalimba' : 'alarm_musicbox';
  const tips: string[] = [];
  if (a.caffeine === 'late') tips.push('Last coffee by 2 pm');
  if (a.phone !== 'never') tips.push('Phone sleeps in the drawer');
  if (a.latency === 'slow' || a.latency === 'long') tips.push('Breathe with Pip in bed');
  if (a.blocks?.includes('mind')) tips.push('Jot your thoughts in the Book');
  if (a.goals.includes('steady_routine')) tips.push('Same wake time, weekends too');
  if (a.goals.includes('wake_refreshed')) tips.push('Open the curtains first thing');
  return { wake: a.wake, bed, windDown: hm(toMin(bed) - windDownMin), windDownMin, goalMin, soundscape: sound, alarm, blocker: a.phone !== 'never', tips: tips.slice(0, 3) };
}

/** Write the interview into the save (call inside edit). */
export function applyAnswers(s: Save, a: Answers, o: { finish?: boolean } = {}) {
  const pl = planOf(a);
  s.profile = { ...s.profile, you: a.you.trim(), goals: [...a.goals], sleepHours: pl.goalMin / 60, latency: a.latency, phone: a.phone, chronotype: a.chrono, caffeine: a.caffeine, relax: [...a.relax], interviewed: true };
  s.name = a.name.trim() || 'Pip';
  // the owl model reads species, older saves migrate through palette: both carry the id
  const sp = speciesOf(a.species);
  s.look.species = sp.id;
  s.look.palette = sp.id;
  if (!s.owned.species.includes(sp.id)) s.owned.species.push(sp.id);
  if (!s.owned.palettes.includes(sp.id)) s.owned.palettes.push(sp.id);
  s.sleep.wake = a.wake;
  s.sleep.goalMin = pl.goalMin;
  s.sleep.windDownMin = pl.windDownMin;
  s.sleep.soundscape = pl.soundscape;
  s.sleep.alarmSound = pl.alarm;
  s.sleep.mic = a.mic;
  s.routine = s.routine.map((d) => ({ ...d, on: true, wake: a.wake, bed: pl.bed }));
  if (a.phone === 'nightly') s.blocker.enabled = true;
  if (pl.blocker) { s.blocker.start = pl.windDown; s.blocker.end = a.wake; }
  if (o.finish !== false) s.onboarded = true;
}

// ------------------------------------------------------------------ the pages

const STARTERS = SPECIES.filter((x) => x.starter);
export const SPECIES_OPTS: Opt[] = STARTERS.map((x) => ({ v: x.id, label: x.name, sub: x.latin, icon: '' }));
const ADJ: Record<string, string> = { tawny: 'cosy', barn: 'elegant', snowy: 'frosty', burrowing: 'leggy', sawwhet: 'tiny' };

export const STEPS: Step[] = [
  {
    id: 'you', title: 'What should Pip call you?', kind: 'text', field: 'you', shot: 'pip',
    say: () => [
      { text: '!Hoo!! Oh! A *visitor!* Sorry, I was _resting my eyes._', mood: 'surprised', shot: 'close', cut: true },
      { text: 'Welcome to *Hoot Hollow!* I’m ~head of sleep~ here. Just *five* quick forms, then we go home.', mood: 'happy', act: 'wave', shot: 'establish' },
      { text: 'First things first. Write your *name* on the line!', mood: 'curious', shot: 'pip' },
    ],
    react: (a) => (a.you.trim() ? { text: `*${a.you.trim()}!* Lovely. I’ll write it in my ~best handwriting.~`, mood: 'joy', act: 'nod' } : { text: 'A _mysterious_ stranger! Very owl of you.', mood: 'curious' }),
    written: (a) => a.you.trim() || 'Mysterious stranger',
  },
  {
    id: 'species', title: 'Choose your owl', kind: 'species', field: 'species', shot: 'pipR',
    say: () => [
      { text: 'Now, _a secret:_ I can be *any* owl I like. Tap one and I’ll *try it on!*', mood: 'excited', act: 'ruffle', shot: 'pipR', cut: true },
    ],
    opts: SPECIES_OPTS,
    react: (a) => ({ text: `A *${speciesOf(a.species).name}!* I feel extra ~${ADJ[a.species] ?? 'fluffy'}~ already.`, mood: 'proud', act: 'present' }),
    written: (a) => speciesOf(a.species).name,
  },
  {
    id: 'wake', title: 'Usual wake-up time', kind: 'dial', field: 'wake', shot: 'clockwin',
    say: () => [
      { text: 'When do you usually *wake up?* Turn the hands on my clock. I’ll move the *sky* to match.', mood: 'curious', shot: 'clockwin', cut: true },
    ],
    react: (a) => {
      const m = toMin(a.wake);
      if (m < 6 * 60) return { text: '!Before six!! Even the birds are impressed.', mood: 'surprised' };
      if (m > 9 * 60) return { text: 'A late riser. The *best dreams* happen after eight.', mood: 'happy' };
      return { text: 'A sensible hour. ~Owls approve.~', mood: 'happy', act: 'nod' };
    },
  },
  {
    id: 'hours', title: 'Hours of sleep', kind: 'hours', field: 'hours', shot: 'tower', vignettes: true,
    say: () => [{ text: 'And how much sleep would you like? Slide the brass marker. One pillow per hour, _obviously._', mood: 'happy', shot: 'tower', cut: true }],
    react: (a) => (a.hours < 7 ? { text: 'Hmm, a little short. Most people need *seven to nine* hours. We can nudge it later.', mood: 'worried' } : a.hours >= 9 ? { text: 'A !champion! sleeper! Respect.', mood: 'love' } : { text: 'Perfect. Right in the *sweet spot.*', mood: 'joy', act: 'nod' }),
  },
  {
    id: 'blocks', title: 'What gets in the way of sleep?', kind: 'multi', field: 'blocks', shot: 'desk', vignettes: true,
    say: () => [
      { text: 'Be honest, _I won’t tell the other owls..._', mood: 'curious', shot: 'close', cut: true },
      { text: 'What gets in the way of your *sleep?* Tick any that sound like you.', mood: 'curious', shot: 'desk' },
    ],
    opts: BLOCKS,
    react: (a) => {
      const b = a.blocks;
      if (!b.length) return { text: 'Nothing at all? You’re my !hero!! We’ll keep it that way.', mood: 'love', act: 'dance' };
      if (b.includes('phone')) return { text: 'Then I’m switching on the *phone lock*: at bedtime your phone goes to bed too.', mood: 'proud', act: 'present' };
      if (b.includes('mind') || b.includes('slow')) return { text: 'We’ll wind down *together.* A few slow breaths work wonders.', mood: 'love', act: 'nod' };
      return { text: 'Caffeine stays awake in you for *hours.* Let’s try to stop by *2 pm.*', mood: 'worried' };
    },
    written: (a) => a.blocks.map((v) => BLOCKS.find((x) => x.v === v)?.label).filter(Boolean).join(', ') || 'Nothing at all',
  },
  {
    id: 'plan', title: 'Your sleep plan', kind: 'plan', shot: 'pip',
    say: () => [
      { text: '*All done!* Here’s your *sleep plan.* Sign it, then stamp it to approve!', mood: 'proud', act: 'ruffle', shot: 'pip', cut: true },
    ],
  },
];

export const OUTRO: Beat[] = [
  { text: '!APPROVED!! ~Ka-chunk!~', mood: 'joy', act: 'dance', shot: 'close', cut: true },
  { text: 'Now come on, let’s go *home.* Our new house is full of !boxes!!', mood: 'excited', act: 'flap', shot: 'establish' },
];

/** A random little aside for long pages (keeps Pip alive while you think). */
export const ASIDES = ['Take your time. I’m sharpening my pencil.', '~Hmm hmm hmm...~', 'No wrong answers! _Except “never sleeping”._', 'I love a good questionnaire.'];
export const aside = () => pick(ASIDES);
export { STARTERS };
