// Pip's travel log: which places Pip has flown to, how many nights, and when first (for passport stamps).
// Kept in the save under `travel` (an extra field older code ignores) and filled in whenever a night's
// adventure lands in `pending`. Also moves older saves from the five fictional areas to the real places.
// [globe] OWNED BY THE GLOBE BUILDER.
import { effect } from '@preact/signals';
import { AREA_ALIAS, placeId } from '../../game/catalog.ts';
import { edit, save, type Save } from '../../game/store.ts';

export interface TravelEntry { n: number; first: number; last: number }
export interface TravelLog { nights: Record<string, TravelEntry>; last?: string }
type WithTravel = Save & { travel?: TravelLog };

export const travelOf = (s: Save): TravelLog => (s as WithTravel).travel ?? { nights: {} };
export const nightsAt = (s: Save, id: string) => travelOf(s).nights[id]?.n ?? 0;
export const visited = (s: Save, id: string) => nightsAt(s, id) > 0 || s.seen.areas.includes(id);

/** Old area ids -> places, everywhere a save keeps one. */
function migrate() {
  const s = save.value;
  const old = (id?: string) => !!id && id in AREA_ALIAS;
  if (!(old(s.area) || s.seen.areas.some(old) || old(s.active?.area) || old(s.pending?.adventure.area))) return;
  edit((x) => {
    x.area = placeId(x.area);
    x.seen.areas = [...new Set(x.seen.areas.map(placeId))];
    if (x.active) x.active.area = placeId(x.active.area);
    if (x.pending) x.pending.adventure.area = placeId(x.pending.adventure.area);
  });
}

/** Log each finished night once, the moment its adventure is waiting for the morning reveal. */
function logNights() {
  effect(() => {
    const s = save.value, p = s.pending;
    if (!p) return;
    const log = travelOf(s);
    if (log.last === p.sessionId) return;
    const id = placeId(p.adventure.area);
    const when = s.nights.find((n) => n.id === p.sessionId)?.start ?? Date.now();
    // write after this effect run so we never change the signal while it is being read
    queueMicrotask(() => edit((x) => {
      const t: TravelLog = structuredClone(travelOf(x));
      if (t.last === p.sessionId) return;
      const e = t.nights[id] ?? { n: 0, first: when, last: when };
      e.n += 1; e.last = when; e.first = Math.min(e.first, when);
      t.nights[id] = e;
      t.last = p.sessionId;
      (x as WithTravel).travel = t;
      if (!x.seen.areas.includes(id)) x.seen.areas.push(id);
    }));
  });
}

let started = false;
/** Run once at start-up (importing the globe module does it). */
export function startTravel() {
  if (started) return;
  started = true;
  try { migrate(); } catch { /* a strange save: leave it */ }
  logNights();
}
