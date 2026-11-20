// Public API of the Hoot Hollow sleep engine.
export * from './types.ts';
export { FrameAnalyzer, classifyBurst, epochActivity, FFT, LIGHT_SLEEP_ACTIVITY, BAND_EDGES, N_BANDS, HOP_MS } from './analyzer.ts';
export type { AnalyzerOptions, BurstFeatures, ActivityInput } from './analyzer.ts';
export { analyze, stageTime, fmtClock, fmtDur } from './staging.ts';
export type { AnalyzeOptions } from './staging.ts';
export { simulateNight, simulateNightWithTruth, demoNight, mulberry32 } from './simulate.ts';
export type { SimulateOptions } from './simulate.ts';
export { SleepRecorder } from './recorder.ts';
export type { RecorderOptions, RecorderStatus, StartResult } from './recorder.ts';
export { saveClip, getClip, listClips, deleteClip, deleteClipsBefore, encodeWav, newClipId } from './clips.ts';
export type { ClipMeta, SaveClipMeta } from './clips.ts';
export { AlarmClock, nextOccurrence, parseHHMM } from './alarm.ts';
export type { AlarmPlan, AlarmState, AlarmClockOptions, RingReason } from './alarm.ts';
export { Reminders, DEFAULT_REMINDERS } from './reminders.ts';
export type { ReminderConfig, ReminderKind, RemindersOptions, UpcomingReminder } from './reminders.ts';
export { registerSW, applySWUpdate, onSWMessage, consumeLaunchAction, showAlarmNotification, closeAlarmNotification, ALARM_TAG } from './sw-register.ts';
export type { SWNotificationMessage } from './sw-register.ts';
