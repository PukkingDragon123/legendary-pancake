// The save: one reactive object persisted to localStorage, plus the actions that change it. Every
// change goes through `edit()` so the UI updates and the save is written (debounced).
import { computed, signal } from '@preact/signals';
import type { OwlLook, OutfitSlot } from '../owl/model.ts';
import { PIECES } from '../owl/outfits.ts';
import { PALETTE, type Skin } from '../owl/palette.ts';
import type { SleepSession } from '../sleep/types.ts';
import { defaultBlockConfig, type BlockConfig } from './blocker.ts';
import { AREAS, ITEM_BY_ID, levelOf, TRINKET, ZONE_LEVEL, type LootEntry } from './catalog.ts';
import type { AdventureResult } from './adventure.ts';

export interface SleepPrefs {
  goalMin: number;
  wake: string;
  /** repeat days 0=Sun..6=Sat */
  days: number[];
  smartMin: number;
  alarmSound: string;
  alarmOn: boolean;
  reminders: boolean;
  windDownMin: number;
  mic: boolean;
  clips: boolean;
  sensitivity: number;
  soundscape: string;
  soundscapeMin: number;
  soundscapeVol: number;
}

export interface Save {
  v: 1;
  name: string;
  look: OwlLook;
  acorns: number;
  stones: number;
  xp: number;
  streak: number;
  bestStreak: number;
  lastNightKey?: string;
  owned: { items: string[]; pieces: string[]; palettes: string[]; skins: Skin[] };
  /** extra copies of furniture the player owns beyond those placed (inventory counts) */
  furniture: Record<string, string>;
  collection: Record<string, number>;
  area: string;
  sleep: SleepPrefs;
  nights: SleepSession[];
  /** the night in progress */
  active?: { session: SleepSession; area: string; peeks: number[] };
  /** finished night waiting for the morning reveal */
  pending?: { sessionId: string; adventure: AdventureResult };
  breath: { sessions: number; minutes: number; pattern: string; durationMin: number; haptics: boolean; voice: boolean; lastDay?: string };
  plus: { active: boolean; plan?: 'monthly' | 'yearly'; since?: number; lastStipend?: number };
  settings: { music: number; sfx: number; ambience: number; hour12: boolean; quality: 'auto' | 'low' | 'high'; reduceMotion: boolean };
  blocker: BlockConfig;
  onboarded: boolean;
  daily: { day: string; gift: boolean; pets: number };
  seen: { zones: string[]; areas: string[] };
}

const KEY = 'hoot-hollow:save:v1';

export function freshSave(): Save {
  const hour12 = (() => { try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12 ?? false; } catch { return false; } })();
  return {
    v: 1, name: 'Pip', look: { skin: 'owl', palette: 'tawny', outfit: { head: 'nightcap' } },
    acorns: 250, stones: 20, xp: 0, streak: 0, bestStreak: 0,
    owned: { items: ['nestbed', 'moonlamp', 'roundrug', 'fernpot', 'candles', 'stool'], pieces: ['nightcap', 'sprout', 'satchel'], palettes: ['tawny'], skins: ['owl'] },
    furniture: { g_back: 'nestbed', g_left: 'moonlamp', g_mid: 'roundrug', g_frontL: 'fernpot' },
    collection: {}, area: 'woods',
    sleep: { goalMin: 480, wake: '07:00', days: [1, 2, 3, 4, 5], smartMin: 20, alarmSound: 'alarm_musicbox', alarmOn: true, reminders: true, windDownMin: 30, mic: true, clips: false, sensitivity: 0.5, soundscape: 'amb_rain', soundscapeMin: 30, soundscapeVol: 0.6 },
    nights: [],
    breath: { sessions: 0, minutes: 0, pattern: 'settle', durationMin: 3, haptics: true, voice: true },
    plus: { active: false },
    settings: { music: 0.5, sfx: 0.8, ambience: 0.7, hour12, quality: 'auto', reduceMotion: false },
    blocker: defaultBlockConfig(),
    onboarded: false,
    daily: { day: '', gift: false, pets: 0 },
    seen: { zones: [], areas: ['woods'] },
  };
}

function load(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Save;
      const f = freshSave();
      // shallow-merge new fields into older saves
      return { ...f, ...s, sleep: { ...f.sleep, ...s.sleep }, breath: { ...f.breath, ...s.breath }, settings: { ...f.settings, ...s.settings }, plus: { ...f.plus, ...s.plus }, owned: { ...f.owned, ...s.owned }, daily: { ...f.daily, ...s.daily }, seen: { ...f.seen, ...s.seen }, blocker: { ...f.blocker, ...s.blocker } };
    }
  } catch { /* ignore */ }
  return freshSave();
}

export const save = signal<Save>(load());
let timer = 0;
function persist() {
  clearTimeout(timer);
  timer = window.setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(save.value)); } catch { /* storage full or blocked */ } }, 250);
}
/** Change the save. `f` mutates a copy; the copy becomes the new state. */
export function edit(f: (s: Save) => void) {
  const s = structuredClone(save.value);
  f(s);
  save.value = s;
  persist();
}
export function flush() { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(save.value)); } catch { /* */ } }
export function resetSave() { try { localStorage.removeItem(KEY); } catch { /* storage blocked */ } save.value = freshSave(); }

// ------------------------------------------------------------------ derived

export const level = computed(() => levelOf(save.value.xp));
export const zones = computed(() => ({ loft: level.value.level >= ZONE_LEVEL.loft, garden: level.value.level >= ZONE_LEVEL.garden, deck: level.value.level >= ZONE_LEVEL.deck }));
export const areaOpen = (id: string) => {
  const a = AREAS.find((x) => x.id === id);
  if (!a) return false;
  return level.value.level >= a.level && save.value.bestStreak >= (a.streak ?? 0);
};

export const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// ------------------------------------------------------------------ ownership

export function ownsEntry(s: Save, e: Pick<LootEntry, 'kind' | 'id'>): boolean {
  if (e.kind === 'item') return s.owned.items.includes(e.id);
  if (e.kind === 'piece') return s.owned.pieces.includes(e.id);
  if (e.kind === 'palette') return s.owned.palettes.includes(e.id);
  return (s.collection[e.id] ?? 0) > 0;
}

export function grant(s: Save, e: Pick<LootEntry, 'kind' | 'id'>) {
  if (e.kind === 'item' && !s.owned.items.includes(e.id)) s.owned.items.push(e.id);
  if (e.kind === 'piece' && !s.owned.pieces.includes(e.id)) s.owned.pieces.push(e.id);
  if (e.kind === 'palette' && !s.owned.palettes.includes(e.id)) s.owned.palettes.push(e.id);
  if (e.kind === 'trinket') s.collection[e.id] = (s.collection[e.id] ?? 0) + 1;
}

export type Buyable = { kind: 'item' | 'piece' | 'palette'; id: string };
export function priceOf(b: Buyable): { acorns?: number; stones?: number } {
  if (b.kind === 'item') { const it = ITEM_BY_ID[b.id]; return it?.gems ? { stones: it.gems } : { acorns: it?.price ?? 0 }; }
  if (b.kind === 'piece') { const p = PIECES.find((x) => x.id === b.id); return p?.premium ? { stones: p.price } : { acorns: p?.price ?? 0 }; }
  const p = PALETTE[b.id];
  return p?.premium ? { stones: p.price } : { acorns: p?.price ?? 0 };
}

/** Try to buy something. Returns an error message, or null on success. */
export function buy(b: Buyable): string | null {
  const s = save.value;
  if (ownsEntry(s, b)) return 'Already yours';
  const p = priceOf(b);
  if (p.stones && s.stones < p.stones) return 'Not enough moonstones';
  if (p.acorns && s.acorns < p.acorns) return 'Not enough acorns';
  edit((x) => { x.acorns -= p.acorns ?? 0; x.stones -= p.stones ?? 0; grant(x, b); });
  return null;
}

export function wear(slot: OutfitSlot, id: string | null) {
  edit((s) => { if (id) s.look.outfit[slot] = id; else delete s.look.outfit[slot]; });
  void import('./quests.ts').then((q) => q.progress('dress'));
}
export function setCoat(id: string) { edit((s) => { s.look.palette = id; }); void import('./quests.ts').then((q) => q.progress('dress')); }

export function placeFurniture(slot: string, item: string | null) {
  edit((s) => { if (item) { for (const [k, v] of Object.entries(s.furniture)) if (v === item) delete s.furniture[k]; s.furniture[slot] = item; } else delete s.furniture[slot]; });
  if (item) void import('./quests.ts').then((q) => q.progress('decorate'));
}

export const trinketName = (id: string) => TRINKET[id]?.name ?? id;
