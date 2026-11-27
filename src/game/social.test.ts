// [profile] Friend codes (encode, decode, checksum, versions, links) and the leaderboard's ranking.
import { describe, expect, it } from 'vitest';
import {
  CODE_VERSION, NEIGHBOURS, b64url, checksum, cleanFriend, cleanName, codeLink, decodeCode, encodeCode, findCode, myStats, neighbourStats, rankBoard, unb64url, upsertFriend,
  type Entry, type FriendCard, type SocialStats,
} from './social.ts';
import { freshSave, migrateProfile } from './store.ts';

// edit() schedules a save write on `window`
(globalThis as unknown as { window: unknown }).window ??= globalThis;

const DAY = 86_400_000;
const T = Date.UTC(2026, 10, 27, 12);
const card = (o: Partial<FriendCard> = {}): FriendCard => ({
  v: CODE_VERSION, id: 'abc123', name: 'Wren', look: { skin: 'owl', species: 'snowy', palette: 'snowy', outfit: { head: 'nightcap', neck: 'scarf' } }, frame: 'laurel',
  stats: { level: 7, streak: 12, best: 30, score: 84, hours: 7.6, nights: 14 }, at: T, ...o,
});

describe('friend codes', () => {
  it('round-trips a card through a code', () => {
    const code = encodeCode(card());
    expect(code).toMatch(/^hoot1\.[A-Za-z0-9_-]+\.[0-9a-z]{5}$/);
    expect(code.length).toBeLessThan(220);
    const d = decodeCode(code);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.card.id).toBe('abc123');
    expect(d.card.name).toBe('Wren');
    expect(d.card.look).toEqual({ skin: 'owl', species: 'snowy', palette: 'snowy', outfit: { head: 'nightcap', neck: 'scarf' } });
    expect(d.card.frame).toBe('laurel');
    expect(d.card.stats).toEqual({ level: 7, streak: 12, best: 30, score: 84, hours: 7.6, nights: 14 });
    // the date survives to the day
    expect(Math.floor(d.card.at / DAY)).toBe(Math.floor(T / DAY));
  });

  it('keeps names with accents and emoji, and cleans control characters and overlong names', () => {
    const d = decodeCode(encodeCode(card({ name: 'Zoë 🦉 Ñandú' })));
    expect(d.ok && d.card.name).toBe('Zoë 🦉 Ñandú');
    expect(cleanName('  a\u0000b‮  c  ')).toBe('ab c');
    expect([...cleanName('x'.repeat(80))].length).toBe(24);
    expect(cleanName('   ')).toBe('Owl');
  });

  it('carries "no nights yet" as no averages', () => {
    const d = decodeCode(encodeCode(card({ stats: { level: 1, streak: 0, best: 0, score: null, hours: null, nights: 0 } })));
    expect(d.ok && d.card.stats).toEqual({ level: 1, streak: 0, best: 0, score: null, hours: null, nights: 0 });
  });

  it('finds the code inside a link or a message', () => {
    const code = encodeCode(card());
    expect(findCode(codeLink(code, 'https://example.test/'))).toBe(code);
    expect(decodeCode(`Hi! Add me on Hoot Hollow: ${codeLink(code, 'https://example.test/app/')} see you`).ok).toBe(true);
    // a code broken over lines by a chat app
    expect(decodeCode(code.slice(0, 20) + '\n' + code.slice(20)).ok).toBe(true);
  });

  it('refuses a mistyped or cut-short code', () => {
    const code = encodeCode(card());
    const body = code.split('.')[1];
    const flipped = body.slice(0, 10) + (body[10] === 'A' ? 'B' : 'A') + body.slice(11);
    const bad = decodeCode(`hoot1.${flipped}.${code.split('.')[2]}`);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/missing or mistyped/);
    expect(decodeCode(code.slice(0, code.length - 12)).ok).toBe(false);
    expect(decodeCode('').ok).toBe(false);
    expect(decodeCode('hello there').ok).toBe(false);
  });

  it('refuses codes from other versions with a clear reason', () => {
    const body = b64url(JSON.stringify([2, 'x']));
    const d = decodeCode(`hoot2.${body}.${checksum(body)}`);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.error).toMatch(/newer/);
  });

  it('refuses a well-formed code with a damaged payload, and cleans odd values', () => {
    const body = b64url(JSON.stringify({ not: 'an array' }));
    expect(decodeCode(`hoot1.${body}.${checksum(body)}`).ok).toBe(false);
    const arr = [1, 'evil id!', 'n', 'owl', 'tawny', 'tawny', [0, 0, 0, 0, 0], 'walnut', 1, 0, 0, -1, -1, 0, 1];
    const b2 = b64url(JSON.stringify(arr));
    expect(decodeCode(`hoot1.${b2}.${checksum(b2)}`).ok).toBe(false);
    const arr3 = [1, 'ok1', 'n', '<script>', 'tawny', 'tawny', ['x y', 0, 0, 0, 0], 'walnut', 5000, -4, 2, 300, 990, 3, 1];
    const b3 = b64url(JSON.stringify(arr3));
    const d = decodeCode(`hoot1.${b3}.${checksum(b3)}`);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.card.look.skin).toBe('owl');
      expect(d.card.look.outfit).toEqual({});
      expect(d.card.stats).toEqual({ level: 999, streak: 0, best: 2, score: 100, hours: 24, nights: 3 });
    }
  });

  it('base64url is UTF-8 safe and has no padding', () => {
    for (const t of ['', 'a', 'ab', 'abc', 'Ωmega 🦉', '{"x":[1,2]}']) {
      const e = b64url(t);
      expect(e).not.toMatch(/[+/=]/);
      expect(unb64url(e)).toBe(t);
    }
  });
});

describe('the friends list', () => {
  it('adds a friend, refreshes them from a newer code, and ignores repeats and older codes', () => {
    const a = upsertFriend([], card(), 'me', T);
    expect(a.status).toBe('added');
    expect(a.list).toHaveLength(1);
    const same = upsertFriend(a.list, card(), 'me', T + 5);
    expect(same.status).toBe('same');
    expect(same.list).toBe(a.list);
    const newer = card({ at: T + 2 * DAY, stats: { level: 8, streak: 14, best: 30, score: 86, hours: 7.8, nights: 14 }, name: 'Wren B.' });
    const u = upsertFriend(a.list, newer, 'me', T + 2 * DAY);
    expect(u.status).toBe('updated');
    expect(u.list).toHaveLength(1);
    expect(u.list[0].stats.streak).toBe(14);
    expect(u.list[0].name).toBe('Wren B.');
    expect(u.list[0].added).toBe(T);
    expect(u.list[0].updated).toBe(T + 2 * DAY);
    const old = upsertFriend(u.list, card({ at: T - DAY }), 'me', T + 3 * DAY);
    expect(old.status).toBe('older');
    expect(old.list[0].stats.streak).toBe(14);
    const second = upsertFriend(u.list, card({ id: 'zzz999', name: 'Ash' }), 'me', T);
    expect(second.list.map((f) => f.name)).toEqual(['Ash', 'Wren B.']);
  });

  it('refuses your own code', () => {
    expect(upsertFriend([], card({ id: 'me123' }), 'me123').status).toBe('self');
  });

  it('cleans the friends, the photo and the id when a save loads', () => {
    const s = freshSave();
    expect(s.pid).toMatch(/^[a-z0-9]{6,16}$/);
    (s as unknown as { friends: unknown[] }).friends = [{ ...card(), added: 1, updated: 2 }, { ...card(), added: 3, updated: 4 }, { id: 'bad id!' }, 'nope', null];
    (s as unknown as { photo: unknown }).photo = { url: 'javascript:alert(1)', at: 1 };
    s.pid = '';
    const m = migrateProfile(s);
    expect(m.friends).toHaveLength(1);
    expect(m.friends![0].name).toBe('Wren');
    expect(m.photo).toBeNull();
    expect(m.pid).toMatch(/^[a-z0-9]{6,16}$/);
    const ok = freshSave();
    ok.photo = { url: 'data:image/webp;base64,AAAA', at: 5, pose: 'wave', mood: 'happy', backdrop: 'moon', on: true };
    expect(migrateProfile(ok).photo?.url).toBe('data:image/webp;base64,AAAA');
    expect(cleanFriend({ id: 'x1', stats: { streak: 5, best: 2, nights: 0, score: 90 } })!.stats).toEqual({ level: 1, streak: 5, best: 5, score: null, hours: null, nights: 0 });
  });

  it('your stats average your last fourteen real nights', () => {
    const s = freshSave();
    s.xp = 0; s.streak = 3; s.bestStreak = 2;
    const night = (i: number, score: number, hrs: number, simulated = false) => ({ id: 'n' + i, start: T - i * DAY, end: T - i * DAY + 8 * 3.6e6, smartWindowMin: 0, micUsed: true, epochs: [], events: [], simulated, report: { score, asleep: hrs * 3.6e6 } });
    s.nights = [night(1, 80, 8), night(2, 60, 6), night(3, 10, 2, true)] as unknown as typeof s.nights;
    const st = myStats(s);
    expect(st).toEqual({ level: 1, streak: 3, best: 3, score: 70, hours: 7, nights: 2 });
    s.nights = [];
    expect(myStats(s)).toMatchObject({ score: null, hours: null, nights: 0 });
  });
});

const E = (key: string, kind: Entry['kind'], stats: Partial<SocialStats>): Entry => ({ key, name: key, kind, stats: { level: 1, streak: 0, best: 0, score: null, hours: null, nights: 0, ...stats } });

describe('the leaderboard', () => {
  it('ranks by streak with shared ranks for ties (1, 2, 2, 4)', () => {
    const r = rankBoard([E('a', 'friend', { streak: 3 }), E('you', 'you', { streak: 9 }), E('b', 'neighbour', { streak: 5 }), E('c', 'friend', { streak: 5 })], 'streak');
    expect(r.map((x) => [x.entry.key, x.rank, x.tie])).toEqual([['you', 1, false], ['b', 2, true], ['c', 2, true], ['a', 4, false]]);
  });

  it('orders a tie by the board’s second numbers, then you first, then the name, without splitting the rank', () => {
    const r = rankBoard([E('zed', 'friend', { streak: 4, best: 10 }), E('amy', 'friend', { streak: 4, best: 10 }), E('you', 'you', { streak: 4, best: 10 }), E('bo', 'friend', { streak: 4, best: 20 })], 'streak');
    expect(r.map((x) => x.entry.key)).toEqual(['bo', 'you', 'amy', 'zed']);
    expect(new Set(r.map((x) => x.rank))).toEqual(new Set([1]));
  });

  it('ranks the sleep board by average score and puts owls with no nights last, unranked', () => {
    const r = rankBoard([E('none', 'friend', { nights: 0 }), E('lo', 'friend', { score: 60, hours: 6, nights: 3 }), E('hi', 'you', { score: 90, hours: 8, nights: 5 }), E('none2', 'neighbour', {})], 'sleep');
    expect(r.map((x) => [x.entry.key, x.rank])).toEqual([['hi', 1], ['lo', 2], ['none', null], ['none2', null]]);
  });

  it('ranks the level board', () => {
    const r = rankBoard([E('a', 'friend', { level: 2 }), E('b', 'friend', { level: 12 }), E('you', 'you', { level: 12, streak: 1 })], 'level');
    expect(r.map((x) => [x.entry.key, x.rank])).toEqual([['you', 1], ['b', 1], ['a', 3]]);
  });

  it('neighbours have plausible numbers that hold all day and move from day to day', () => {
    for (const n of NEIGHBOURS) {
      const a = neighbourStats(n, T), b = neighbourStats(n, T + 3600_000);
      expect(a).toEqual(b);
      expect(a.streak).toBeGreaterThanOrEqual(0);
      expect(a.streak).toBeLessThanOrEqual(a.best);
      expect(a.score).toBeGreaterThanOrEqual(30);
      expect(a.score).toBeLessThanOrEqual(99);
      expect(a.hours).toBeGreaterThan(5);
      expect(a.hours).toBeLessThan(10);
    }
    const n = NEIGHBOURS[0];
    const streaks = Array.from({ length: 60 }, (_, d) => neighbourStats(n, T + d * DAY).streak);
    expect(new Set(streaks).size).toBeGreaterThan(20);
    expect(streaks.some((v, i) => i > 0 && v === streaks[i - 1] + 1)).toBe(true);
  });
});
