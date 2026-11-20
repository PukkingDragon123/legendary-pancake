// UI navigation state and Pip's voice.
import { signal } from '@preact/signals';
import type { Scene } from '../world/scene.ts';

export type Tab = 'home' | 'sleep' | 'breathe' | 'journal' | 'market';
export type Panel = null | 'wardrobe' | 'decorate' | 'map' | 'settings' | 'night';

export const tab = signal<Tab>('home');
export const panel = signal<Panel>(null);
/** a night from the journal opened for detail */
export const nightOpen = signal<string | null>(null);
export const breathing = signal<{ pattern: string; minutes: number; follow: boolean } | null>(null);
export const marketTab = signal<'furniture' | 'outfits' | 'coats' | 'stones'>('furniture');

export const sceneRef: { current: Scene | null } = { current: null };

export interface Bubble { text: string; id: number }
export const bubble = signal<Bubble | null>(null);
let bid = 0;
let btimer = 0;
export function say(text: string, ms = 3600) {
  const id = ++bid;
  bubble.value = { text, id };
  clearTimeout(btimer);
  btimer = window.setTimeout(() => { if (bubble.value?.id === id) bubble.value = null; }, ms);
}

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
export const lines = {
  poke: () => pick(['Hoo! That tickles.', 'Hello, hello!', 'Did you know owls can’t move their eyes? I just wiggle my whole head.', 'I found a very round pebble today.', 'Hoo-hoo! Hi!', 'Ruffle ruffle.', 'Shall we tidy the nest later?', 'My feathers are extra fluffy today.']),
  morning: (name: string) => pick([`Good morning! ${name} is back with treasures.`, 'Morning! Did you dream of anything nice?', 'I flew SO far last night. Let me tell you everything!']),
  evening: () => pick(['It’s getting late. Want to wind down with me?', 'I’m packing my satchel for tonight’s adventure.', 'Dim the lights, and let’s breathe together?', 'Hoo... yawn. Is it bedtime yet?']),
  day: () => pick(['What a lovely day in the Hollow.', 'Tonight I’m exploring somewhere new!', 'Sleep well tonight and I’ll find something shiny.', 'Have you had water today? Owls approve of water.']),
  breathe: () => pick(['That was lovely. I feel all floaty.', 'Mmm. My feathers are so calm now.', 'Let’s do that again tomorrow.']),
};
