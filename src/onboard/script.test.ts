import { describe, expect, it } from 'vitest';
import { freshSave } from '../game/store.ts';
import { answersFrom, applyAnswers, hm, planOf, STEPS, toMin, type Answers } from './script.ts';

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
  it('has a page for every profile question', () => {
    const fields = STEPS.map((x) => x.field).filter(Boolean);
    for (const f of ['you', 'species', 'name', 'goals', 'wake', 'hours', 'latency', 'phone', 'chrono', 'caffeine', 'relax', 'mic']) expect(fields).toContain(f);
  });
});
