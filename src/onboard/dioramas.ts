// Pip reacting to your answers while a form is up (the answer cards carry the 3D objects): his mood and gestures,
// the light through the window turning to another hour, a sound or a soundscape to set the scene.
import { sound } from '../audio/sound.ts';
import type { OwlAction, OwlMood } from '../owl/actor.ts';
import type { Office } from './office.ts';

interface Scene { mood?: OwlMood; act?: OwlAction; hour?: number | null; snd?: string; loop?: string; level?: number; prop?: string; mode?: string; spin?: boolean }

const S: Record<string, Scene> = {
  'goals:sleep_better': { mood: 'love', act: 'yawn', prop: 'bed' },
  'goals:fall_asleep': { mood: 'sleepy', act: 'nod', prop: 'sheep' },
  'goals:wake_refreshed': { mood: 'happy', act: 'stretch', hour: 7.2, snd: 'bird_chirp', prop: 'sunrise' },
  'goals:steady_routine': { mood: 'proud', act: 'nod', snd: 'clock_wind', spin: true, prop: 'alarm' },
  'goals:less_phone': { mood: 'proud', act: 'nod', prop: 'phone', mode: 'drawer' },
  'goals:track_sounds': { mood: 'curious', prop: 'mic' },
  'latency:quick': { mood: 'love', act: 'yawn', prop: 'bed' },
  'latency:normal': { mood: 'sleepy', act: 'yawn', prop: 'bed' },
  'latency:slow': { mood: 'sleepy', prop: 'sheep' },
  'latency:long': { mood: 'worried', snd: 'clock_tick', prop: 'alarm', spin: true },
  'phone:never': { mood: 'love', act: 'dance', prop: 'phone', mode: 'drawer' },
  'phone:sometimes': { mood: 'curious', prop: 'phone', mode: 'buzz' },
  'phone:nightly': { mood: 'dizzy', hour: 23.5, prop: 'phone', mode: 'glow' },
  'chrono:lark': { mood: 'happy', act: 'stretch', hour: 6.8, snd: 'bird_chirp', prop: 'sunrise' },
  'chrono:between': { mood: 'calm', act: 'nod', hour: 13, prop: 'sunrise', mode: 'noon' },
  'chrono:owl': { mood: 'excited', act: 'dance', hour: 23.5, snd: 'owl_hoot', prop: 'moon' },
  'caffeine:none': { mood: 'calm', prop: 'milk' },
  'caffeine:morning': { mood: 'happy', hour: 8, prop: 'mug', mode: 'day' },
  'caffeine:late': { mood: 'dizzy', act: 'shiver', hour: 22.5, prop: 'mug', mode: 'night' },
  'drink:espresso': { mood: 'dizzy', act: 'shiver', snd: 'glass_clink' },
  'drink:coffee': { mood: 'happy', act: 'nod', snd: 'place_glass' },
  'drink:tea': { mood: 'calm', act: 'nod', snd: 'glass_clink' },
  'drink:soda': { mood: 'excited', act: 'hop', snd: 'sparkle_fizz' },
  'drink:energy': { mood: 'dizzy', act: 'flap', snd: 'sparkle_fizz' },
  'drink:cocoa': { mood: 'love', act: 'dance', snd: 'place_glass' },
  'drink:water': { mood: 'proud', act: 'nod', snd: 'water_plop' },
  'blocks:phone': { mood: 'dizzy', hour: 23.5, prop: 'phone', mode: 'glow' },
  'blocks:caffeine': { mood: 'dizzy', act: 'shiver', hour: 22.5, prop: 'mug', mode: 'night', snd: 'place_glass' },
  'blocks:mind': { mood: 'worried', snd: 'clock_tick', prop: 'alarm', spin: true, hour: 2.8 },
  'blocks:slow': { mood: 'sleepy', act: 'yawn', prop: 'sheep' },
  'mic:yes': { mood: 'curious', act: 'nod', prop: 'mic' },
  'mic:no': { mood: 'happy', act: 'nod' },
  'hours:tower': { mood: 'happy', prop: 'pillows' },
  'relax:rain': { mood: 'calm', loop: 'amb_rain', prop: 'rain' },
  'relax:waves': { mood: 'calm', loop: 'amb_waves', hour: 17.6, prop: 'waves' },
  'relax:forest': { mood: 'calm', loop: 'amb_forest_night', hour: 22, prop: 'moon' },
  'relax:fire': { mood: 'calm', loop: 'amb_fire', prop: 'stove' },
  'relax:stream': { mood: 'calm', loop: 'amb_stream', hour: 10, prop: 'waves', mode: 'stream' },
  'relax:wind': { mood: 'calm', loop: 'amb_wind', hour: 15, prop: 'sunrise', mode: 'noon' },
  'relax:brown': { mood: 'calm', loop: 'amb_brown', level: 0.4, prop: 'radio' },
  'relax:lullaby': { mood: 'love', act: 'dance', loop: 'music_lullaby', prop: 'gramophone' },
  'relax:night': { mood: 'calm', loop: 'amb_night', hour: 23.5, prop: 'moon' },
  'relax:breathing': { mood: 'calm', snd: 'breath_in', prop: 'bed' },
  'relax:reading': { mood: 'calm', snd: 'page_turn', prop: 'book' },
};

export interface Dioramas { show(id: string | null): void }

export function dioramas(office: Office): Dioramas {
  let cur: string | null = null;
  let stopLoop: (() => void) | null = null;
  const loop = (id: string, level = 0.5) => { void sound.loop(id, true, level, 'amb', 0.6); return () => void sound.loop(id, false, level, 'amb', 0.8); };
  // a tape in the recorder plays a few seconds of its sound, then fades
  const preview = (id: string) => { sound.preview(id, 7); return () => void sound.loop(id, false, 1, 'amb', 0.5); };
  return {
    show(id) {
      if (id === cur) return;
      stopLoop?.(); stopLoop = null;
      cur = id;
      const sc = id ? S[id] : null;
      if (!id || !sc) { office.window(null); return; }
      if (sc.mood) office.pip.setMood(sc.mood, 2.5);
      if (sc.act) office.pip.play(sc.act);
      office.window(sc.hour ?? null, id.startsWith('relax:rain') ? 'rain' : 'clear');
      if (sc.snd) try { sound.play(sc.snd, { volume: 0.45, gap: 200 }); } catch { /* */ }
      if (sc.loop) stopLoop = id.startsWith('relax:') ? preview(sc.loop) : loop(sc.loop, sc.level ?? 0.5);
      if (sc.spin) office.clock.spin += 3;
    },
  };
}
