// [profile] The friends list's save actions (the rules are in social.ts, kept free of the save so the save can use them).
import { edit, save } from './store.ts';
import { decodeCode, upsertFriend, type AddStatus, type FriendSnap } from './social.ts';

/** Add (or refresh) a friend from pasted text. Returns what happened, or an error message. */
export function addFriendCode(text: string, now = Date.now()): { ok: true; status: AddStatus; friend?: FriendSnap } | { ok: false; error: string } {
  const d = decodeCode(text);
  if (!d.ok) return d;
  const s = save.value;
  const r = upsertFriend(s.friends ?? [], d.card, s.pid, now);
  if (r.status === 'self') return { ok: false, error: 'That’s your own code! Send it to a friend, and paste theirs here.' };
  if (r.status === 'added' || r.status === 'updated') edit((x) => { x.friends = r.list; });
  return { ok: true, status: r.status, friend: r.friend };
}
export function removeFriend(id: string) {
  edit((x) => { x.friends = (x.friends ?? []).filter((f) => f.id !== id); });
}
