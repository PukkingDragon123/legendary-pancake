// [profile] The profile's shared state: which tab it opens on, and a friend code that came in on a link.
import { signal } from '@preact/signals';

export type ProfileTab = 'studio' | 'frames' | 'friends' | 'ranks';
/** the tab the profile opens on (and stays on between visits) */
export const profileTab = signal<ProfileTab>('studio');
/** a friend code that came in on a link (#friend=...), waiting in the Friends tab's box */
export const pendingCode = signal('');
