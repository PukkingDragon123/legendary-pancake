import { describe, expect, it } from 'vitest';
import { cleanTutorial } from '../../game/store.ts';
import { plainOf } from '../talk.ts';
import { BACK, resumeAt, TOUR } from './steps.ts';

describe('the tour of the hollow', () => {
  it('visits every place the player needs, in order, and ends with a gift and a goodbye', () => {
    expect(TOUR.map((s) => s.id)).toEqual(['hello', 'sleep', 'clock', 'book', 'tools', 'build', 'shop', 'wardrobe', 'quests', 'map', 'profile', 'gift', 'done']);
    expect(TOUR.find((s) => s.id === 'gift')?.gift).toBeGreaterThan(0);
  });
  it('waits for real actions, and every place it opens has a way home and something to say inside', () => {
    expect(TOUR[0].wait).toBe('pip');
    for (const s of TOUR) {
      if (s.wait && s.wait !== 'pip') {
        expect(s.back, s.id).toBe(BACK[s.wait]);
        expect(s.inside?.length, s.id).toBeGreaterThan(0);
      }
      // a stop without an action can always be passed with Next
      if (!s.wait) expect(s.next, s.id).toBeTruthy();
    }
    // the side tools may be skipped; the lamp, clock, book and portrait have to be opened
    for (const id of ['build', 'shop', 'wardrobe', 'quests', 'map']) expect(TOUR.find((s) => s.id === id)?.optional, id).toBe(true);
    for (const id of ['sleep', 'clock', 'book', 'profile']) expect(TOUR.find((s) => s.id === id)?.optional, id).toBeFalsy();
  });
  it('only uses talk marks that parse', () => {
    for (const s of TOUR) for (const l of [...s.say('Sam'), ...(s.inside ?? [])]) expect(plainOf(l), s.id).not.toMatch(/[*_~]|(^|\s)![A-Za-z]/);
  });
  it('resumes where the save left off', () => {
    expect(resumeAt(undefined)).toBe(0);
    expect(resumeAt({ done: false, step: 4 })).toBe(4);
    expect(resumeAt({ done: false, step: 999 })).toBe(TOUR.length - 1);
    expect(resumeAt({ done: true, step: 3 })).toBeNull();
  });
  it('reads a stored tour safely', () => {
    expect(cleanTutorial(undefined)).toBeUndefined();
    expect(cleanTutorial('yes')).toBeUndefined();
    expect(cleanTutorial({ done: true, step: 2 })).toEqual({ done: true, step: 2 });
    expect(cleanTutorial({ done: 'no', step: -3, gift: 1 })).toEqual({ done: false, step: 0 });
    expect(cleanTutorial({ step: 5.7, gift: true })).toEqual({ done: false, step: 5, gift: true });
  });
});
