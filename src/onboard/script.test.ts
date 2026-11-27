import { describe, expect, it } from 'vitest';
import { freshSave } from '../game/store.ts';
import { answersFrom, applyAnswers, blocksOf, fromBlocks, hm, planOf, STEPS, toMin, type Answers } from './script.ts';

const base = (): Answers => ({ ...answersFrom(freshSave()), you: 'Sam', name: 'Hoot', goals: ['sleep_better'], wake: '07:00', hours: 8, latency: 'normal', phone: 'sometimes', chrono: 'between', caffeine: 'morning', relax: ['waves'], mic: true });

describe('interview plan', () => {
  it('works back from the wake time', () => {
    const p = planOf(base());
    expect(p.bed).toBe('23:00');
    expect(p.goalMin).toBe(480);
    expect(p.windDown).toBe('22:30');
    expect(p.soundscape).toBe('amb_waves');
  });
  it('wraps round midnight and lengthens the wind-down for slow sleepers on their phones', () => {
    const p = planOf({ ...base(), wake: '05:30', hours: 9, latency: 'long', phone: 'nightly' });
    expect(p.bed).toBe('20:30');
    expect(p.windDownMin).toBe(60);
    expect(p.windDown).toBe('19:30');
    expect(p.blocker).toBe(true);
  });
  it('falls back to rain when nothing with a sound was picked', () => {
    expect(planOf({ ...base(), relax: ['reading'] }).soundscape).toBe('amb_rain');
  });
  it('formats times', () => {
    expect(hm(-30)).toBe('23:30');
    expect(toMin('07:45')).toBe(465);
  });
});

describe('applyAnswers', () => {
  it('writes the profile, routine, owl and blocker into the save', () => {
    const s = freshSave();
    applyAnswers(s, { ...base(), species: 'snowy', phone: 'nightly', wake: '06:30', hours: 7.5 });
    expect(s.onboarded).toBe(true);
    expect(s.profile.interviewed).toBe(true);
    expect(s.profile.you).toBe('Sam');
    expect(s.name).toBe('Hoot');
    expect(s.look.species).toBe('snowy');
    expect(s.look.palette).toBe('snowy');
    expect(s.owned.species).toContain('snowy');
    expect(s.sleep.wake).toBe('06:30');
    expect(s.sleep.goalMin).toBe(450);
    expect(s.routine.every((d) => d.wake === '06:30' && d.bed === '23:00')).toBe(true);
    expect(s.blocker.enabled).toBe(true);
    expect(s.blocker.end).toBe('06:30');
  });
  it('keeps Pip as the default name', () => {
    const s = freshSave();
    applyAnswers(s, { ...base(), name: '  ' });
    expect(s.name).toBe('Pip');
  });
  it('asks five short questions, then the plan', () => {
    expect(STEPS.map((x) => x.field ?? x.kind)).toEqual(['you', 'species', 'wake', 'hours', 'blocks', 'plan']);
  });
});

describe('what gets in the way of sleep', () => {
  it('fills the profile fields the old questions set', () => {
    const a = fromBlocks(base(), ['phone', 'caffeine', 'slow']);
    expect(a.phone).toBe('nightly');
    expect(a.caffeine).toBe('late');
    expect(a.latency).toBe('slow');
    expect(a.goals).toEqual(['sleep_better', 'less_phone', 'fall_asleep']);
    const s = freshSave();
    applyAnswers(s, a);
    expect(s.profile.latency).toBe('slow');
    expect(s.profile.phone).toBe('nightly');
    expect(s.blocker.enabled).toBe(true);
    expect(planOf(a).tips).toContain('Last coffee by 2 pm');
  });
  it('a busy mind and a slow drift together make a long wind-down', () => {
    const a = fromBlocks(base(), ['mind', 'slow']);
    expect(a.latency).toBe('long');
    expect(planOf(a).windDownMin).toBe(60);
    expect(planOf(a).tips).toContain('Jot your thoughts in the Book');
  });
  it('nothing ticked keeps the gentle defaults', () => {
    const a = fromBlocks(base(), []);
    expect(a).toMatchObject({ latency: 'normal', phone: 'sometimes', caffeine: 'morning', goals: ['sleep_better'] });
    const s = freshSave();
    applyAnswers(s, a);
    expect(s.blocker.enabled).toBe(freshSave().blocker.enabled);
    expect(s.sleep.mic).toBe(true);
    expect(s.name).toBe('Hoot');
  });
  it('reads the answer back from a saved profile', () => {
    expect(blocksOf(freshSave().profile)).toEqual([]);
    expect(blocksOf({ latency: 'long', phone: 'nightly', caffeine: 'late' })).toEqual(['phone', 'caffeine', 'mind', 'slow']);
    expect(answersFrom(freshSave()).blocks).toEqual([]);
  });
});
