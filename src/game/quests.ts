// Daily quests: three small, kind goals a day, picked from a pool so most days feel a bit different.
// Progress is counted by `progress(kind)` calls from wherever the thing happens in the app.
import { dayKey, edit, save } from './store.ts';

export type QuestKind = 'breathe' | 'pet' | 'catch' | 'sleep7' | 'early' | 'dress' | 'decorate' | 'note' | 'hop' | 'mood';

export interface QuestDef { kind: QuestKind; title: string; goal: number; acorns: number; xp: number; sprite: string }
export const QUEST_POOL: QuestDef[] = [
  { kind: 'breathe', title: 'Breathe with Pip once', goal: 1, acorns: 30, xp: 15, sprite: 'jar' },
  { kind: 'pet', title: 'Give Pip 3 head scratches', goal: 3, acorns: 15, xp: 8, sprite: 'heart' },
  { kind: 'catch', title: 'Catch 3 fireflies at dusk', goal: 3, acorns: 25, xp: 12, sprite: 'sparkle' },
  { kind: 'sleep7', title: 'Sleep 7 hours or more', goal: 1, acorns: 60, xp: 30, sprite: 'nest' },
  { kind: 'early', title: 'Start sleep before bedtime', goal: 1, acorns: 40, xp: 20, sprite: 'moon' },
  { kind: 'dress', title: 'Try on a new look', goal: 1, acorns: 15, xp: 8, sprite: 'hanger' },
  { kind: 'decorate', title: 'Rearrange the tree house', goal: 1, acorns: 20, xp: 10, sprite: 'brush' },
  { kind: 'note', title: 'Write a line in the dream journal', goal: 1, acorns: 20, xp: 10, sprite: 'pen' },
  { kind: 'hop', title: 'Walk Pip around the clearing', goal: 5, acorns: 15, xp: 8, sprite: 'treehouse' },
  { kind: 'mood', title: 'Tell Pip how you slept', goal: 1, acorns: 15, xp: 8, sprite: 'mood3' },
];

export interface QuestState { kind: QuestKind; prog: number; claimed: boolean }

/** Today's three quests (sleep is always one of them; the other two rotate). */
export function todaysQuests(): QuestState[] {
  const s = save.value;
  const q = (s as unknown as { quests?: { day: string; list: QuestState[] } }).quests;
  const today = dayKey();
  if (q && q.day === today) return q.list;
  let h = 0;
  for (const c of today) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rest = QUEST_POOL.filter((d) => d.kind !== 'sleep7');
  const a = rest[h % rest.length], b = rest[(h >>> 8) % rest.length] === a ? rest[(h % rest.length + 3) % rest.length] : rest[(h >>> 8) % rest.length];
  const list: QuestState[] = [{ kind: 'sleep7', prog: 0, claimed: false }, { kind: a.kind, prog: 0, claimed: false }, { kind: b.kind, prog: 0, claimed: false }];
  edit((x) => { (x as unknown as { quests: unknown }).quests = { day: today, list }; });
  return list;
}

export const questDef = (k: QuestKind) => QUEST_POOL.find((d) => d.kind === k)!;

/** Count progress towards today's quests of this kind. Returns true if one just completed. */
export function progress(kind: QuestKind, n = 1): boolean {
  const list = todaysQuests();
  const i = list.findIndex((x) => x.kind === kind);
  if (i < 0) return false;
  const def = questDef(kind);
  const before = list[i].prog;
  if (before >= def.goal) return false;
  edit((x) => {
    const q = (x as unknown as { quests: { list: QuestState[] } }).quests;
    q.list[i].prog = Math.min(def.goal, before + n);
  });
  return before + n >= def.goal;
}

export function claim(kind: QuestKind): QuestDef | null {
  const list = todaysQuests();
  const i = list.findIndex((x) => x.kind === kind);
  const def = questDef(kind);
  if (i < 0 || list[i].claimed || list[i].prog < def.goal) return null;
  edit((x) => {
    const q = (x as unknown as { quests: { list: QuestState[] } }).quests;
    q.list[i].claimed = true;
    x.acorns += def.acorns;
    x.xp += def.xp;
  });
  return def;
}

export const claimable = () => todaysQuests().filter((q) => !q.claimed && q.prog >= questDef(q.kind).goal).length;
