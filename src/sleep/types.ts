// Shared contract between the sleep engine (src/sleep/*) and the rest of the app.
// Times are epoch milliseconds unless noted. One epoch = 30 s, the standard sleep-scoring window.

export const EPOCH_MS = 30_000;

/** One 30-second slice of the night, summarised from the microphone. */
export interface Epoch {
  /** start of the epoch */
  t: number;
  /** mean level in dBFS-relative "dB" (0..~100 scale, see recorder) */
  db: number;
  /** loudest 100 ms frame in the epoch */
  peak: number;
  /** adaptive noise floor at the end of the epoch */
  floor: number;
  /** count of detected events by kind within this epoch */
  snore: number;
  move: number;
  talk: number;
  noise: number;
  /** 0..1 how "active" the epoch sounded (movement/arousal proxy used by staging) */
  activity: number;
}

export type SleepEventKind = 'snore' | 'talk' | 'movement' | 'noise';

export interface SleepEvent {
  t: number;
  kind: SleepEventKind;
  /** duration in seconds */
  dur: number;
  /** peak level of the event */
  db: number;
  /** id of a short recorded audio clip in IndexedDB (see clips.ts), when clip recording is on */
  clipId?: string;
}

export type Stage = 'awake' | 'light' | 'deep' | 'rem';

export interface SleepReport {
  /** 0..100 */
  score: number;
  /** time in bed, ms */
  inBed: number;
  /** estimated time asleep, ms */
  asleep: number;
  /** estimated sleep onset and final wake (epoch ms) */
  asleepAt: number;
  wokeAt: number;
  latencyMin: number;
  /** asleep / inBed, 0..1 */
  efficiency: number;
  /** fractions of time in bed, 0..1, sum ~1 */
  deep: number;
  light: number;
  rem: number;
  awake: number;
  awakenings: number;
  snoreMin: number;
  talkCount: number;
  loudestDb: number;
  avgDb: number;
  quality: 'restless' | 'okay' | 'good' | 'great';
  /** 1-3 short, friendly, specific observations for the morning journal */
  notes: string[];
}

export interface SleepSession {
  id: string;
  /** lights-out (user tapped "sleep") */
  start: number;
  /** when the session was ended (alarm dismissed or user woke) */
  end?: number;
  /** target alarm time, if any */
  wakeTarget?: number;
  /** smart-alarm window in minutes before wakeTarget (0 = exact time) */
  smartWindowMin: number;
  /** true when the microphone was used; false = manual/timer-only night */
  micUsed: boolean;
  epochs: Epoch[];
  events: SleepEvent[];
  /** one per epoch, filled by analyze() */
  stages?: Stage[];
  report?: SleepReport;
  /** user's morning mood 1..5 (optional, from the journal) */
  mood?: number;
  /** user's journal note */
  note?: string;
  /** a demo/simulated night (never mixed into real statistics unless the user keeps it) */
  simulated?: boolean;
}

/** Live readings while recording, for the bedside visualiser. */
export interface LiveLevel {
  t: number;
  db: number;
  floor: number;
  /** 16 coarse spectrum bands 0..1, low to high */
  bands: number[];
}
