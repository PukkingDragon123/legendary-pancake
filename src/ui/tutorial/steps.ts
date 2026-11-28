// [tutor] The guided tour of the hollow that follows the interview: what Pip points at, what he says, and what the
// player has to do before he moves on. Each stop is one step (its index is what the save keeps, so a reload resumes
// at the same stop). A stop either waits for a real action (tapping Pip, opening a place) or, where the action is
// optional, offers Next. A stop that opens a place goes on in three beats: point (the spotlight on the button), look
// (the place is open; Pip explains, Next through his lines) and back (the spotlight on the place's own Back button).
import type { Panel } from '../state.ts';

export type Target = 'pip' | string;
export interface TourStep {
  id: string;
  /** what Pip says while pointing (one line after another; the last waits for the action) */
  say: (who: string) => string[];
  /** what to spotlight: 'pip' (the owl in the 3D room), a CSS selector, or none (Pip talks to the room) */
  target?: Target;
  /** the action: tap Pip, or open this place */
  wait?: 'pip' | NonNullable<Panel>;
  /** the action is optional: Next moves on without it */
  optional?: boolean;
  /** lines while the place is open */
  inside?: string[];
  /** the place's own way home (first match that is on screen) */
  back?: string;
  /** the label on the Next button for a stop without an action */
  next?: string;
  /** acorns given when this stop is passed (once per save) */
  gift?: number;
}

/** a tool on the rope down the right (Build, Shop, Dress up, Quests, Map, Settings, in that order) */
const tool = (i: number) => `.hh-tools .hh-tool:nth-of-type(${i + 1})`;
/** the Back / Close / Leave / Done of each place */
export const BACK: Partial<Record<NonNullable<Panel>, string>> = {
  sleep: '.bd-back',
  clock: '.ck-back, .sf-back',
  book: '.bk2-back',
  shop: '.lg-leave',
  build: '.bm-done',
  decorate: '.bm-done',
  wardrobe: '.sheet .sheet-head .icon-btn[aria-label="Close"]',
  quests: '.sheet .sheet-head .icon-btn[aria-label="Close"]',
  map: '.gb-back[aria-label="Back home"]',
  profile: '.pf-close',
  settings: '.sheet .sheet-head .icon-btn[aria-label="Close"]',
};

export const TOUR: TourStep[] = [
  {
    id: 'hello', target: 'pip', wait: 'pip',
    say: (who) => [`Welcome *home,* ${who}! This old oak is ours now.`, 'Let me show you around. First, *tap me* to say hello!'],
  },
  {
    id: 'sleep', target: '.hh-mobj.sleep', wait: 'sleep', back: BACK.sleep,
    say: () => ['That’s my *Sleep lamp.* Tap it when it’s bedtime.'],
    inside: [
      'My *bedroom!* The things in the room are the controls: the clock, the record player, the lamp.',
      'At bedtime I tuck your *phone* into its little bed, then we *fly* over the moonlit forest while you breathe. _In... and out..._',
    ],
  },
  {
    id: 'clock', target: '.hh-mobj.clock', wait: 'clock', back: BACK.clock,
    say: () => ['Next, the *Clock.* Tap it!'],
    inside: [
      'Barnaby’s workshop! Drag the *moon* hand to set bedtime and the *sun* hand to set your wake-up.',
      'The smart alarm can ring a little early when you’re sleeping lightly. ~Gentle mornings.~',
    ],
  },
  {
    id: 'book', target: '.hh-mobj.book', wait: 'book', back: BACK.book,
    say: () => ['And the *Book.* Open it up!'],
    inside: [
      'Every night goes in here: your *sleep score,* charts, streaks and seals.',
      'There’s a *diary* too. A line about your day helps busy minds let go.',
    ],
  },
  {
    id: 'tools', target: '.hh-tools',
    say: () => ['Up here hang my *tools.* Let’s look at each one.'],
    next: 'Show me',
  },
  {
    id: 'build', target: tool(0), wait: 'build', optional: true, back: BACK.build,
    say: () => ['*Build:* move furniture, repair rooms and open new floors. Tap to peek, or Next.'],
    inside: ['Drag things around, spin them, stack them. It’s _your_ hollow.'],
  },
  {
    id: 'shop', target: tool(1), wait: 'shop', optional: true, back: BACK.shop,
    say: () => ['*Shop:* Barnaby’s Lodge Store. Fresh deals every day.'],
    inside: ['Spend your *acorns* on furniture and outfits. The Lucky Barrel has surprises.'],
  },
  {
    id: 'wardrobe', target: tool(2), wait: 'wardrobe', optional: true, back: BACK.wardrobe,
    say: () => ['*Dress up:* hats, scarves, coats... I’m ~very fashionable.~'],
    inside: ['Tap anything to try it on me. Close the wardrobe when you’re done.'],
  },
  {
    id: 'quests', target: tool(3), wait: 'quests', optional: true, back: BACK.quests,
    say: () => ['*Quests:* three small jobs a day, each with a reward.'],
    inside: ['Pinned to the cork board. Finish one, then claim it here!'],
  },
  {
    id: 'map', target: tool(4), wait: 'map', optional: true, back: BACK.map,
    say: () => ['*Map:* the places I fly to while you sleep. Better nights open new ones.'],
    inside: ['The whole Earth! Spin it, then fly down to a place and collect its souvenirs.'],
  },
  {
    id: 'profile', target: '.hh-portrait', wait: 'profile', back: BACK.profile,
    say: () => ['That’s *me,* on the sign! Tap my portrait.'],
    inside: ['My *photo studio!* Take a portrait, choose a frame, and add *friends* with their codes.'],
  },
  {
    id: 'gift', next: 'Thank you!', gift: 100,
    say: (who) => [`You’re a natural, ${who}! Here’s *100 acorns* to get the house started.`],
  },
  {
    id: 'done', next: 'Let’s go!',
    say: () => ['Sleep well tonight and I’ll come home with *treasures.* Now, shall we unpack those boxes?'],
  },
];

/** where a saved tour resumes (clamped; a finished tour has no step) */
export function resumeAt(t: { done: boolean; step: number } | undefined): number | null {
  if (t?.done) return null;
  const i = Math.max(0, Math.min(TOUR.length - 1, Math.floor(t?.step ?? 0)));
  return Number.isFinite(i) ? i : 0;
}
