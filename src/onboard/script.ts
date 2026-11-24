// The interview itself: Pip's lines, the clipboard pages and their options, his reactions, and
// how the answers become a sleep plan and land in the save.
import type { OwlAction, OwlMood } from '../owl/actor.ts';
import { SPECIES, speciesOf } from '../owl/species.ts';
import type { Profile, Save } from '../game/store.ts';
import type { ShotName } from './room.ts';

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
      { text: 'Hoo! Oh! A *visitor!*', mood: 'surprised', shot: 'close', cut: true },
      { text: 'Sorry, I was resting my eyes. Very important owl business.', mood: 'sleepy', act: 'yawn', shot: 'pip' },
      { text: 'Welcome to *Hoot Hollow!* I’m the Hollow’s sleep keeper.', mood: 'happy', act: 'wave', shot: 'establish' },
      { text: 'Before we move in, I have a few questions. For science! And snacks.', mood: 'proud', act: 'nod', shot: 'pipL' },
      { text: 'First things first. What should I call you?', mood: 'curious', shot: 'pip' },
    ],
    react: (a) => (a.you.trim() ? { text: `*${a.you.trim()}!* Lovely. I’ll write it in my best handwriting.`, mood: 'joy', act: 'nod' } : { text: 'A mysterious stranger! Very owl of you.', mood: 'curious' }),
    written: (a) => a.you.trim() || 'Mysterious stranger',
  },
  {
    id: 'species', title: 'Choose your owl', kind: 'species', field: 'species', shot: 'pipR',
    say: () => [
      { text: 'Now, a secret: I can be *any* owl I like.', mood: 'excited', act: 'ruffle', shot: 'pipR', cut: true },
      { text: 'Which owl should I be? Pick a card and I’ll try it on!', mood: 'happy', shot: 'close' },
    ],
    opts: SPECIES_OPTS,
    react: (a) => ({ text: `A *${speciesOf(a.species).name}!* I feel extra ${ADJ[a.species] ?? 'fluffy'} already.`, mood: 'proud', act: 'present' }),
    written: (a) => speciesOf(a.species).name,
  },
  {
    id: 'name', title: 'Name your owl', kind: 'text', field: 'name', shot: 'desk',
    say: () => [{ text: 'Every owl needs a name. Mine’s Pip... but you can pick a new one!', mood: 'curious', shot: 'desk', cut: true }],
    react: (a) => (a.name.trim() === '' || a.name.trim() === 'Pip' ? { text: 'Pip it is! Classic. Timeless. Fluffy.', mood: 'joy', act: 'hop' } : { text: `*${a.name.trim()}!* It fits like a nightcap.`, mood: 'love', act: 'dance' }),
    written: (a) => a.name.trim() || 'Pip',
  },
  {
    id: 'goals', title: 'Your sleep goals', kind: 'multi', field: 'goals', shot: 'wide', vignettes: true,
    say: () => [
      { text: 'Okay. The *big* question!', mood: 'excited', shot: 'low', cut: true },
      { text: 'What would you like help with? Peel off as many stickers as you like.', mood: 'curious', shot: 'wide' },
    ],
    opts: GOALS,
    react: (a) => {
      if (!a.goals.length) return { text: 'Just here for the cosy vibes? I respect that.', mood: 'happy' };
      if (a.goals.length > 3) return { text: 'Ambitious! We’ll tackle them one feather at a time.', mood: 'proud', act: 'nod' };
      const g = a.goals[0];
      const t: Record<string, string> = {
        sleep_better: 'Better sleep, coming right up. I’ll fluff the pillows.', fall_asleep: 'Faster sleep! I’ll retire the sheep.', wake_refreshed: 'Bright mornings! I’ll have the sun on standby.',
        steady_routine: 'A steady routine! My clock is thrilled.', less_phone: 'Less phone. The drawer and I have an understanding.', track_sounds: 'I’ll listen for snores. Professionally.',
      };
      return { text: t[g] ?? 'Noted!', mood: 'happy', act: 'nod' };
    },
    written: (a) => a.goals.map((g) => GOALS.find((x) => x.v === g)?.label).filter(Boolean).join(', ') || 'Just the cosy vibes',
  },
  {
    id: 'wake', title: 'Usual wake-up time', kind: 'dial', field: 'wake', shot: 'clockwin',
    say: () => [
      { text: 'When do you usually wake up?', mood: 'curious', shot: 'clockwin', cut: true },
      { text: 'Drag the sun round the dial. I’ll move the clock and the sky. I’m very powerful.', mood: 'proud' },
    ],
    react: (a) => {
      const m = toMin(a.wake);
      if (m < 6 * 60) return { text: 'Before six! Even the birds are impressed.', mood: 'surprised' };
      if (m > 9 * 60) return { text: 'A late riser. The best dreams happen after eight.', mood: 'happy' };
      return { text: 'A sensible hour. Owls approve.', mood: 'happy', act: 'nod' };
    },
  },
  {
    id: 'hours', title: 'Hours of sleep', kind: 'hours', field: 'hours', shot: 'tower', vignettes: true,
    say: () => [{ text: 'And how much sleep would you like? Slide the moons. One pillow per hour, obviously.', mood: 'happy', shot: 'tower', cut: true }],
    react: (a) => (a.hours < 7 ? { text: 'Hmm, a little short. Most people need seven to nine hours. We can nudge it later.', mood: 'worried' } : a.hours >= 9 ? { text: 'A champion sleeper! Respect.', mood: 'love' } : { text: 'Perfect. Right in the sweet spot.', mood: 'joy', act: 'nod' }),
  },
  {
    id: 'latency', title: 'Falling asleep takes...', kind: 'choice', field: 'latency', shot: 'bed', vignettes: true,
    say: () => [
      { text: 'When the lights go out, how long until you’re asleep?', mood: 'sleepy', shot: 'wide', cut: true },
      { text: 'Let’s find out! Count my sheep and tap *Zzz* when you’d usually drift off.', mood: 'excited', shot: 'pip' },
    ],
    opts: [
      { v: 'quick', label: 'Minutes', sub: 'out like a candle', icon: 'pillow' },
      { v: 'normal', label: '10 to 20 min', sub: 'a little drift', icon: 'moon' },
      { v: 'slow', label: '20 to 40 min', sub: 'some sheep involved', icon: 'sheep' },
      { v: 'long', label: 'Ages', sub: 'staring at the ceiling', icon: 'clock' },
    ],
    react: (a) => (a.latency === 'quick' ? { text: 'Lucky! I’m a little jealous.', mood: 'happy' } : a.latency === 'long' ? { text: 'That’s tough. We’ll wind down together, I promise.', mood: 'love' } : { text: 'Got it. A longer wind-down will help.', mood: 'happy', act: 'nod' }),
  },
  {
    id: 'phone', title: 'Phone in bed?', kind: 'choice', field: 'phone', shot: 'desk', vignettes: true,
    say: () => [
      { text: 'Be honest, I won’t tell the other owls...', mood: 'curious', shot: 'close', cut: true },
      { text: 'Where does your phone sleep at night? Drag it there.', mood: 'curious', shot: 'desk' },
    ],
    opts: [
      { v: 'never', label: 'Never', sub: 'it sleeps elsewhere', icon: 'drawer' },
      { v: 'sometimes', label: 'Sometimes', sub: 'a quick peek', icon: 'nightstand' },
      { v: 'nightly', label: 'Every night', sub: 'just one more video', icon: 'pillowbed' },
    ],
    react: (a) => (a.phone === 'nightly' ? { text: 'Then I’m switching on the *Bedtime Blocker*: after bedtime, social apps stay shut so your brain can power down.', mood: 'proud', act: 'present' } : a.phone === 'sometimes' ? { text: 'A peek here and there. I’ll nudge you at bedtime.', mood: 'happy' } : { text: 'A phone-free bed! You’re my hero.', mood: 'love', act: 'dance' }),
  },
  {
    id: 'chrono', title: 'Early bird or night owl?', kind: 'choice', field: 'chrono', shot: 'window', vignettes: true,
    say: () => [
      { text: 'Are you an early bird or a night owl?', mood: 'curious', shot: 'window', cut: true },
      { text: '(No pressure. I am *literally* a night owl.) Pull the lever!', mood: 'proud', shot: 'pipL' },
    ],
    opts: [
      { v: 'lark', label: 'Early bird', sub: 'up with the sun', icon: 'sun' },
      { v: 'between', label: 'Somewhere between', sub: 'it depends', icon: 'star' },
      { v: 'owl', label: 'Night owl', sub: 'alive after dark', icon: 'moon' },
    ],
    react: (a) => (a.chrono === 'owl' ? { text: 'A fellow owl! Hoo hoo! *High wing!*', mood: 'excited', act: 'flap' } : a.chrono === 'lark' ? { text: 'A morning person! You must tell me what sunrises look like.', mood: 'happy' } : { text: 'Balanced, like a good nest.', mood: 'happy', act: 'nod' }),
  },
  {
    id: 'caffeine', title: 'Caffeine', kind: 'choice', field: 'caffeine', shot: 'desk', vignettes: true,
    say: () => [{ text: 'Coffee, tea, fizzy drinks... pick the mug that’s most like you.', mood: 'curious', shot: 'pipR', cut: true }],
    opts: [
      { v: 'none', label: 'None', sub: 'warm milk gang', icon: 'milkglass' },
      { v: 'morning', label: 'Mornings only', sub: 'before noon', icon: 'mugsun' },
      { v: 'late', label: 'Afternoon or later', sub: 'an evening latte', icon: 'mugmoon' },
    ],
    react: (a) => (a.caffeine === 'late' ? { text: 'Caffeine stays awake in you for hours. Let’s try to stop by 2 pm.', mood: 'worried' } : a.caffeine === 'none' ? { text: 'None at all? Your brain sends a thank-you card.', mood: 'love' } : { text: 'Mornings only. Very wise.', mood: 'proud', act: 'nod' }),
  },
  {
    id: 'relax', title: 'What helps you relax?', kind: 'multi', field: 'relax', shot: 'window', vignettes: true,
    say: () => [{ text: 'What helps you relax? Pop in a few tapes and I’ll play a little.', mood: 'calm', shot: 'pipL', cut: true }],
    opts: RELAX,
    react: (a) => ({ text: `Lovely. I’ll play ${SOUND_NAME[planOf(a).soundscape] ?? 'gentle rain'} when you go to sleep.`, mood: 'calm' }),
    written: (a) => a.relax.map((r) => RELAX.find((x) => x.v === r)?.label).filter(Boolean).join(', ') || 'Gentle rain',
  },
  {
    id: 'mic', title: 'Sleep sound tracking', kind: 'choice', field: 'mic', shot: 'desk', vignettes: true,
    say: (_a, o) => [
      { text: 'One more! At night I can listen for snoring and sleep-talking with your microphone.', mood: 'curious', shot: 'desk', cut: true },
      { text: 'Everything stays on your device. Nothing is sent anywhere. Flip the switch either way!', mood: 'proud', act: 'nod', shot: 'pip' },
      ...(o.artifact ? [{ text: '(In this little preview I can’t use the microphone, but it works in the full app.)', mood: 'happy' as OwlMood }] : []),
    ],
    opts: [
      { v: 'yes', label: 'Yes, listen', sub: 'snores and sleep talk', icon: 'mic' },
      { v: 'no', label: 'Not now', sub: 'maybe later', icon: 'mic' },
    ],
    react: (a) => (a.mic ? { text: 'Brilliant! I’ll keep an ear out. Owls have *excellent* ears.', mood: 'joy', act: 'flap' } : { text: 'No problem. You can turn it on later in Settings.', mood: 'happy' }),
  },
  {
    id: 'plan', title: 'Your sleep plan', kind: 'plan', shot: 'pip',
    say: () => [
      { text: 'All done! Let me put it all together...', mood: 'excited', act: 'ruffle', shot: 'close', cut: true },
      { text: 'Here’s your *sleep plan.* Press my stamp to approve it!', mood: 'proud', shot: 'pip' },
    ],
  },
];

export const OUTRO: Beat[] = [
  { text: '*APPROVED!* Ka-chunk!', mood: 'joy', act: 'dance', shot: 'close', cut: true },
  { text: 'Now come on, let’s go home. Our new house is full of boxes!', mood: 'excited', act: 'flap', shot: 'establish' },
];

/** A random little aside for long pages (keeps Pip alive while you think). */
export const ASIDES = ['Take your time. I’m sharpening my pencil.', 'Hmm hmm hmm...', 'No wrong answers! Except “never sleeping”.', 'I love a good questionnaire.'];
export const aside = () => pick(ASIDES);
export { STARTERS };
