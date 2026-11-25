// UI navigation state and Pip's voice.
import { signal } from '@preact/signals';
import type { Scene } from '../world/scene.ts';
import { holdMs } from './talk.ts';

export type Tab = 'home' | 'sleep' | 'breathe' | 'journal' | 'market';
/**
 * Every full-screen place the player can be. The three big buttons open 'sleep', 'clock' and
 * 'book'; the side tools open 'build', 'shop', 'wardrobe', 'quests', 'map' and 'settings'.
 */
export type Panel = null | 'sleep' | 'breathe' | 'clock' | 'book' | 'build' | 'shop' | 'wardrobe' | 'decorate' | 'map' | 'settings' | 'night' | 'quests';

/** Legacy tab signal: setting it opens the matching panel (older code still writes to it). */
export const tab = signal<Tab>('home');
export const panel = signal<Panel>(null);
const TAB_PANEL: Record<Tab, Panel> = { home: null, sleep: 'sleep', breathe: 'breathe', journal: 'book', market: 'shop' };
tab.subscribe((t) => { if (t !== 'home') { panel.value = TAB_PANEL[t]; tab.value = 'home'; } });
/** a night from the journal opened for detail */
export const nightOpen = signal<string | null>(null);
export const breathing = signal<{ pattern: string; minutes: number; follow: boolean } | null>(null);
export const marketTab = signal<'furniture' | 'outfits' | 'coats' | 'gems'>('furniture');

export const sceneRef: { current: Scene | null } = { current: null };

export interface Bubble { text: string; id: number }
export const bubble = signal<Bubble | null>(null);
let bid = 0;
let btimer = 0;
/** Pip says a line over his head (ui/talk.ts markup: *highlight*, !scream!, _whisper_, ~sing-song~). It stays up at
 * least `ms`, and always long enough to type out and read. */
export function say(text: string, ms = 3600) {
  ms = holdMs(text, 1, ms); // [dialog10]
  const id = ++bid;
  bubble.value = { text, id };
  clearTimeout(btimer);
  btimer = window.setTimeout(() => { if (bubble.value?.id === id) bubble.value = null; }, ms);
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const lines = {
  poke: () => pick(['!Hoo!! That _tickles._', '~Hello, hello!~', 'Did you know owls can’t move their eyes? I just wiggle my *whole head.*', 'I found a *very round* pebble today.', '~Hoo-hoo!~ Hi!', '~Ruffle ruffle.~', 'Shall we tidy the nest later?', 'My feathers are extra *fluffy* today.']),
  morning: (name: string) => pick([`*Good morning!* ${name} is back with *treasures.*`, 'Morning! Did you dream of anything _nice?_', 'I flew !SO! far last night. Let me tell you *everything!*']),
  evening: () => pick(['It’s getting _late._ Want to wind down with me?', 'I’m packing my satchel for tonight’s *adventure.*', '_Dim the lights,_ and let’s breathe together?', 'Hoo... _yawn._ Is it bedtime yet?']),
  day: () => pick(['What a ~lovely day~ in the Hollow.', 'Tonight I’m exploring somewhere *new!*', 'Sleep well tonight and I’ll find something *shiny.*', 'Have you had water today? _Owls approve of water._']),
  breathe: () => pick(['That was lovely. I feel all ~floaty.~', '_Mmm._ My feathers are so calm now.', 'Let’s do that again tomorrow.']),
};
