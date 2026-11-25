import { describe, expect, it } from 'vitest';
import { holdMs, pace, parse, plainOf } from './talk.ts';
import { OUTRO, STEPS, type Answers } from '../onboard/script.ts';
import { answersFrom } from '../onboard/script.ts';
import { freshSave } from '../game/store.ts';

const CODE = { say: '.', hi: 'H', yell: 'Y', hush: 'w', wave: '~' } as const;
const tones = (s: string) => parse(s).map((x) => CODE[x.tone]).join('');

describe('dialogue markup', () => {
  it('highlights, screams, whispers and sings, dropping the marks', () => {
    expect(plainOf('A *visitor!* Oh, !WOW!! _psst_ ~la la~')).toBe('A visitor! Oh, WOW! psst la la');
    expect(tones('a *bc* !DE! _fg_ ~hi~')).toBe('..HH.YY.ww.~~');
  });
  it('leaves ordinary exclamations, asterisks and underscores alone', () => {
    expect(plainOf('Hoo! Oh! Hello!')).toBe('Hoo! Oh! Hello!');
    expect(tones('Hoo! Oh!')).toBe('........');
    expect(plainOf('snake_case and 2*3 and a lone * star')).toBe('snake_case and 2*3 and a lone * star');
    expect(plainOf('!!!')).toBe('!!!');
  });
  it('gives punctuation right after a span the span\'s style, and spans several words', () => {
    expect(tones('*Hoot Hollow*! ok')).toBe('HHHHHHHHHHHH...');
    expect(tones('_(No *really*.)_')).toBe('wwwwHHHHHHww');
  });
  it('turns typographic punctuation into what the font has', () => {
    expect(plainOf('I’m here…')).toBe("I'm here...");
  });
});

describe('dialogue pacing', () => {
  const at = (s: string) => pace(parse(s)).beats.map((b) => b.at);
  it('pauses longer at full stops than at commas, and longest at an ellipsis', () => {
    const t = at('Ab, cd. ef... gh');
    const gap = (i: number) => t[i + 1] - t[i];
    expect(gap(2)).toBeGreaterThan(0.15); // after the comma
    expect(gap(6)).toBeGreaterThan(gap(2)); // after the full stop
    expect(t[14] - t[10]).toBeGreaterThan(0.8); // through the ellipsis
  });
  it('takes a beat before an emphasised word and types it slower', () => {
    const plain = pace(parse('so very big')), loud = pace(parse('so very !BIG!'));
    expect(loud.end).toBeGreaterThan(plain.end + 0.3);
  });
  it('is quicker through little filler words, unevenly but repeatably', () => {
    const a = at('the the the'), b = at('the the the');
    expect(a).toEqual(b);
    const d = a.slice(1).map((x, i) => x - a[i]);
    expect(new Set(d.map((x) => x.toFixed(3))).size).toBeGreaterThan(2);
  });
  it('blips once per syllable', () => {
    const blips = (s: string) => pace(parse(s)).beats.filter((b) => b.blip).map((b) => b.c).join('');
    expect(blips('Hollow')).toBe('oo');
    expect(blips('time')).toBe('i');
    expect(blips('Hmm')).toBe('H');
  });
  it('holds a line up long enough to read it', () => {
    expect(holdMs('Hello there, friend.')).toBeGreaterThan(2500);
    expect(holdMs('Hi.', 1, 3600)).toBe(3600);
  });
});

describe('the interview script', () => {
  it('only uses marks that parse, and every line reads cleanly', () => {
    const a: Answers = { ...answersFrom(freshSave()), you: 'Sam', name: 'Hoot' };
    const lines = [...STEPS.flatMap((s) => s.say(a, { artifact: true }).map((b) => (typeof b === 'string' ? b : b.text))), ...OUTRO.map((b) => b.text)];
    for (const s of STEPS) { const r = s.react?.(a); if (r) lines.push(typeof r === 'string' ? r : r.text); }
    for (const l of lines) expect(plainOf(l)).not.toMatch(/[*_~]|(^|\s)![A-Za-z]/);
  });
  it('Pip\'s lines at home parse cleanly too', async () => {
    const { lines } = await import('./state.ts');
    for (let i = 0; i < 40; i++) for (const l of [lines.poke(), lines.morning('Pip'), lines.evening(), lines.day(), lines.breathe()]) expect(plainOf(l)).not.toMatch(/[*_~]|(^|\s)![A-Za-z]/);
  });
});
