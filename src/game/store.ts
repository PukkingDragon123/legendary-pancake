// The save: one reactive object persisted to localStorage, plus the actions that change it. Every
// change goes through `edit()` so the UI updates and the save is written (debounced).
import { computed, signal } from '@preact/signals';
import type { OwlLook, OutfitSlot } from '../owl/model.ts';
import { PIECES } from '../owl/outfits.ts';
import { migrateSpecies } from '../owl/species.ts'; // [owl3]
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

/** Floors of the hollow oak, bottom to top. Only the ground floor is open at the start. */
export type FloorId = 'f1' | 'f2' | 'f3';
/** One piece of furniture standing in a room. Grid units are the house's build grid cells. */
export interface Placed {
  uid: string;
  id: string;
  /** grid cell of the footprint's corner (floor items) or position along the wall (wall items) */
  x: number;
  z: number;
  /** quarter turns 0..3 */
  rot: number;
  /** uid of the item this one stands on (stacked small items) */
  on?: string;
  /** mounted on a wall: height above the floor in px */
  wall?: number;
}
export interface RoomState { wall: string; floor: string; items: Placed[] }
/** What the player told Pip in the interview. */
export interface Profile {
  you: string;
  goals: string[];
  sleepHours: number;
  latency: 'quick' | 'normal' | 'slow' | 'long';
  phone: 'never' | 'sometimes' | 'nightly';
  chronotype: 'lark' | 'between' | 'owl';
  caffeine: 'none' | 'morning' | 'late';
  relax: string[];
  interviewed: boolean;
}
/** The weekly routine: one plan per weekday, 0 = Sunday. */
export interface DayPlan { on: boolean; bed: string; wake: string }
export interface ShopState {
  /** dayKey the daily deals were rolled for */
  day: string;
  bought: string[];
  free: boolean;
  /** gacha pity per series: pulls since the last 5-star / 4-star */
  pity: Record<string, { five: number; four: number; total: number; guaranteed?: boolean }>;
}

export interface Save {
  v: 2;
  /** the hollow oak: rooms per floor, which floors are open, unopened moving boxes */
  home: { floors: Partial<Record<FloorId, RoomState>>; unlocked: FloorId[]; boxes: string[]; seeded: boolean };
  /** furniture kept in storage (not placed): item id -> count */
  inventory: Record<string, number>;
  profile: Profile;
  routine: DayPlan[];
  shop: ShopState;
  name: string;
  look: OwlLook;
  coins: number;
  gems: number;
  xp: number;
  streak: number;
  bestStreak: number;
  lastNightKey?: string;
  owned: { items: string[]; pieces: string[]; palettes: string[]; skins: string[]; species: string[]; finishes: string[] };
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
    v: 2, name: 'Pip', look: { skin: 'owl', species: 'tawny', palette: 'tawny', outfit: { head: 'nightcap' } },
    home: { floors: {}, unlocked: ['f1'], boxes: [], seeded: false },
    inventory: {},
    profile: { you: '', goals: [], sleepHours: 8, latency: 'normal', phone: 'sometimes', chronotype: 'between', caffeine: 'morning', relax: [], interviewed: false },
    routine: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ on: true, bed: d === 5 || d === 6 ? '23:30' : '23:00', wake: d === 0 || d === 6 ? '08:00' : '07:00' })),
    shop: { day: '', bought: [], free: false, pity: {} },
    coins: 250, gems: 20, xp: 0, streak: 0, bestStreak: 0,
    owned: { items: ['nestbed', 'moonlamp', 'roundrug', 'fernpot', 'candles', 'stool'], pieces: ['nightcap', 'sprout', 'satchel'], palettes: ['tawny'], skins: ['owl'], species: ['tawny'], finishes: ['wall_heartwood', 'floor_planks'] },
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
      const s = JSON.parse(raw) as Save & { acorns?: number; stones?: number };
      const f = freshSave();
      // v1 -> v2: acorns became owl coins, moonstones became moon gems
      if (s.coins === undefined && s.acorns !== undefined) { s.coins = s.acorns; delete s.acorns; }
      if (s.gems === undefined && s.stones !== undefined) { s.gems = s.stones; delete s.stones; }
      s.v = 2;
      migrateSpecies(s); // [owl3] the owl line is eight species: retired ones move to their nearest relative
      // shallow-merge new fields into older saves
      return { ...f, ...s, home: { ...f.home, ...s.home }, profile: { ...f.profile, ...s.profile }, shop: { ...f.shop, ...s.shop }, look: { ...f.look, ...s.look }, sleep: { ...f.sleep, ...s.sleep }, breath: { ...f.breath, ...s.breath }, settings: { ...f.settings, ...s.settings }, plus: { ...f.plus, ...s.plus }, owned: { ...f.owned, ...s.owned }, daily: { ...f.daily, ...s.daily }, seen: { ...f.seen, ...s.seen }, blocker: { ...f.blocker, ...s.blocker } };
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
  if (e.kind === 'finish') return s.owned.finishes.includes(e.id);
  if (e.kind === 'skin') return s.owned.skins.includes(e.id);
  if (e.kind === 'species') return s.owned.species.includes(e.id);
  if (e.kind === 'piece') return s.owned.pieces.includes(e.id);
  if (e.kind === 'palette') return s.owned.palettes.includes(e.id);
  return (s.collection[e.id] ?? 0) > 0;
}

export function grant(s: Save, e: Pick<LootEntry, 'kind' | 'id'>) {
  if (e.kind === 'item') { if (!s.owned.items.includes(e.id)) s.owned.items.push(e.id); s.inventory[e.id] = (s.inventory[e.id] ?? 0) + 1; }
  if (e.kind === 'piece' && !s.owned.pieces.includes(e.id)) s.owned.pieces.push(e.id);
  if (e.kind === 'palette' && !s.owned.palettes.includes(e.id)) s.owned.palettes.push(e.id);
  if (e.kind === 'trinket') s.collection[e.id] = (s.collection[e.id] ?? 0) + 1;
  if (e.kind === 'finish' && !s.owned.finishes.includes(e.id)) s.owned.finishes.push(e.id);
  if (e.kind === 'skin' && !s.owned.skins.includes(e.id)) s.owned.skins.push(e.id);
  if (e.kind === 'species' && !s.owned.species.includes(e.id)) s.owned.species.push(e.id);
}

export type Buyable = { kind: 'item' | 'piece' | 'palette'; id: string };
export function priceOf(b: Buyable): { coins?: number; gems?: number } {
  if (b.kind === 'item') { const it = ITEM_BY_ID[b.id]; return it?.gems ? { gems: it.gems } : { coins: it?.price ?? 0 }; }
  if (b.kind === 'piece') { const p = PIECES.find((x) => x.id === b.id); return p?.premium ? { gems: p.price } : { coins: p?.price ?? 0 }; }
  const p = PALETTE[b.id];
  return p?.premium ? { gems: p.price } : { coins: p?.price ?? 0 };
}

/** Try to buy something. Returns an error message, or null on success. */
export function buy(b: Buyable): string | null {
  const s = save.value;
  if (ownsEntry(s, b)) return 'Already yours';
  const p = priceOf(b);
  if (p.gems && s.gems < p.gems) return 'Not enough moonstones';
  if (p.coins && s.coins < p.coins) return 'Not enough coins';
  edit((x) => { x.coins -= p.coins ?? 0; x.gems -= p.gems ?? 0; grant(x, b); });
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
