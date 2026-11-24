import { describe, expect, it } from 'vitest';
import { BEDS, bedLevels, materialOf, PLACE_SOUND, type AmbState } from './ambience.ts';
import { OWL_CALL } from './sound.ts';
import { filesFor, parseRef, resolveRef, validate, type Manifest } from './sprites.ts';

// node built-ins without @types/node (the project has none): just what this test needs
interface FS { readFileSync(p: string): Uint8Array; readFileSync(p: string, enc: 'utf8'): string; readdirSync(p: string): string[]; statSync(p: string): { size: number; isDirectory(): boolean } }
const proc = (globalThis as unknown as { process: { getBuiltinModule(id: string): unknown } }).process;
const { readFileSync, readdirSync, statSync } = proc.getBuiltinModule('node:fs') as FS;
const { join } = proc.getBuiltinModule('node:path') as { join(...p: string[]): string };
const HERE = decodeURIComponent(new URL('.', import.meta.url).pathname);
const SFX = join(HERE, '../../public/sfx');
const man = JSON.parse(readFileSync(join(SFX, 'manifest.json'), 'utf8')) as Manifest;
const credits = JSON.parse(readFileSync(join(SFX, 'credits.json'), 'utf8')) as { file: string; clip?: string; id: string; license: string }[];

/** Duration of a CBR MP3 from its Xing/Info frame count (what the build writes). */
function mp3Duration(buf: Uint8Array): number {
  const str = (a: number, b: number) => String.fromCharCode(...buf.subarray(a, b));
  const u32 = (a: number) => new DataView(buf.buffer, buf.byteOffset).getUint32(a);
  let i = 0;
  if (str(0, 3) === 'ID3') i = 10 + ((buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9]);
  while (i < buf.length - 4 && !(buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0)) i++;
  const ver = (buf[i + 1] >> 3) & 3, srIdx = (buf[i + 2] >> 2) & 3, mono = (buf[i + 3] >> 6) === 3;
  const sr = [[11025, 12000, 8000], [0, 0, 0], [22050, 24000, 16000], [44100, 48000, 32000]][ver][srIdx];
  const side = ver === 3 ? (mono ? 17 : 32) : (mono ? 9 : 17);
  const tag = str(i + 4 + side, i + 8 + side);
  if (tag !== 'Xing' && tag !== 'Info') throw new Error('no Xing/Info header');
  const frames = u32(i + 12 + side);
  const spf = ver === 3 ? 1152 : 576;
  // LAME tag: encoder delay and padding, which decoders trim
  const lame = i + 4 + side + 120;
  const dp = (buf[lame + 21] << 16) | (buf[lame + 22] << 8) | buf[lame + 23];
  const delay = dp >> 12, pad = dp & 0xfff;
  return (frames * spf - delay - pad - 529 - 1) / sr;
}

describe('audio sprites', () => {
  it('parses and resolves sprite references', () => {
    expect(parseRef('sfx_ui.mp3#ui_tap_1')).toEqual({ file: 'sfx_ui.mp3', clip: 'ui_tap_1' });
    expect(parseRef('amb_rain.mp3')).toEqual({ file: 'amb_rain.mp3', clip: null });
    const m: Manifest = { version: 2, sounds: { a: { files: ['s.mp3#a'] }, b: { files: ['b.mp3'] } }, sprites: { 's.mp3': { dur: 2, clips: { a: [0.05, 0.5] } } } };
    expect(resolveRef(m, 's.mp3#a')).toEqual({ file: 's.mp3', clip: 'a', start: 0.05, dur: 0.5, bytes: null });
    expect(resolveRef(m, 's.mp3#zz')).toBeNull();
    expect(resolveRef(m, 'b.mp3')).toEqual({ file: 'b.mp3', clip: null, start: 0, dur: null, bytes: null });
    const pk: Manifest = { version: 2, sounds: { l: { files: ['p.mp3#l'], loop: true } }, packs: { 'p.mp3': { bytes: 30, clips: { k: [0, 10], l: [10, 30] } } } };
    expect(resolveRef(pk, 'p.mp3#l')).toEqual({ file: 'p.mp3', clip: 'l', start: 0, dur: null, bytes: [10, 30] });
    expect(validate(pk)).toEqual([]);
    expect(validate({ ...pk, packs: { 'p.mp3': { bytes: 40, clips: { k: [0, 10], l: [12, 30] } } } }).length).toBe(2);
    expect(filesFor(m, ['a', 'b', 'a'])).toEqual(['s.mp3', 'b.mp3']);
    expect(validate({ ...m, sprites: { 's.mp3': { dur: 0.3, clips: { a: [0.05, 0.5] } } } })).toContain('s.mp3#a: runs past the end of the sprite');
  });

  it('the shipped manifest is consistent', () => {
    expect(man.version).toBe(2);
    expect(validate(man)).toEqual([]);
  });

  it('every file exists, nothing stray, and the audio stays within budget', () => {
    const onDisk = readdirSync(SFX).filter((f) => f.endsWith('.mp3'));
    const used = new Set(Object.values(man.sounds).flatMap((e) => e.files.map((f) => parseRef(f).file)));
    for (const f of used) expect(onDisk, f).toContain(f);
    for (const f of onDisk) expect(used.has(f), `${f} is not used by any sound`).toBe(true);
    expect(readdirSync(SFX).length, 'files in public/sfx (artifact file budget)').toBeLessThanOrEqual(25);
    const bytes = onDisk.reduce((n, f) => n + statSync(join(SFX, f)).size, 0);
    expect(bytes).toBeLessThan(15 * 1024 * 1024);
  });

  it('every pack member is a whole MP3 of its own (a loop of a sensible length)', () => {
    for (const [file, pk] of Object.entries(man.packs ?? {})) {
      const all = readFileSync(join(SFX, file));
      expect(all.length, file).toBe(pk.bytes);
      for (const [clip, [a, b]] of Object.entries(pk.clips)) {
        const d = mp3Duration(all.subarray(a, b));
        expect(d, `${file}#${clip}`).toBeGreaterThan(5);
        expect(d, `${file}#${clip}`).toBeLessThan(90);
      }
    }
  });

  it('sprite clip offsets lie inside the encoded audio', () => {
    for (const [file, sp] of Object.entries(man.sprites ?? {})) {
      const d = mp3Duration(readFileSync(join(SFX, file)));
      expect(Math.abs(d - sp.dur), file).toBeLessThan(0.08);
      for (const [clip, [s, len]] of Object.entries(sp.clips)) expect(s + len, `${file}#${clip}`).toBeLessThanOrEqual(d + 0.01);
    }
  });

  it('every clip and file has a credit', () => {
    const credited = new Set(credits.map((c) => (c.clip ? `${c.file}#${c.clip}` : c.file)));
    for (const [id, e] of Object.entries(man.sounds)) {
      if (e.alias) continue;
      for (const f of e.files) expect(credited.has(f), `${id}: ${f} has no credit`).toBe(true);
    }
    for (const c of credits) expect(c.license, c.file).toMatch(/CC0|[Pp]ublic [Dd]omain/);
  });

  it('every sound id the code asks for exists', () => {
    const ids = new Set<string>();
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts')) {
          const src = readFileSync(p, 'utf8');
          for (const m of src.matchAll(/sound\.(?:play|loop|_loop|preview)\(\s*'([a-z0-9_]+)'/g)) ids.add(m[1]);
          for (const m of src.matchAll(/\btap\(\s*'([a-z0-9_]+)'/g)) ids.add(m[1]);
        }
      }
    };
    walk(join(HERE, '..'));
    for (const b of BEDS) ids.add(b);
    for (const [c] of Object.values(OWL_CALL)) ids.add(c);
    for (const s of Object.values(PLACE_SOUND)) ids.add(s);
    for (const s of ['hop_grass', 'hop_wood', 'hop_snow', 'hop_wet', 'thunder', 'thunder_far', 'wind_gust', 'tree_creak', 'pop_sparkle', 'pop_puff', 'leaf_rustle', 'star_shimmer', 'reveal_common', 'reveal_rare', 'reveal_epic', 'chime_sweep', 'till', 'page_turn', 'globe_spin', 'pin_tap', 'shop_bell', 'book_open', 'book_close']) ids.add(s);
    const missing = [...ids].filter((id) => !man.sounds[id]);
    expect(missing).toEqual([]);
  });
});

describe('ambience mix', () => {
  const base: AmbState = { mode: 'outside', night: 0, hour: 13, rain: 0, storm: 0, wind: 0.3, snow: 0, cover: 0, temp: 18, winter: false };
  it('is silent when off', () => {
    expect(Object.values(bedLevels({ ...base, mode: 'off' })).every((v) => v === 0)).toBe(true);
  });
  it('follows the hour', () => {
    const noon = bedLevels(base), dusk = bedLevels({ ...base, night: 0.4, hour: 19 }), night = bedLevels({ ...base, night: 1, hour: 23 });
    expect(noon.amb_day).toBeGreaterThan(0.5);
    expect(noon.amb_peepers).toBe(0);
    expect(dusk.amb_dusk).toBeGreaterThan(0.5);
    expect(night.amb_peepers).toBeGreaterThan(0.5);
    expect(night.amb_day).toBe(0);
    expect(bedLevels({ ...base, night: 1, hour: 23, temp: -4, winter: true }).amb_peepers).toBe(0);
  });
  it('follows the weather and the room', () => {
    const rain = bedLevels({ ...base, rain: 0.8 });
    expect(rain.bed_rain).toBeGreaterThan(0.5);
    expect(rain.amb_day).toBeLessThan(0.1);
    const inside = bedLevels({ ...base, mode: 'inside', rain: 0.8 });
    expect(inside.amb_room).toBeGreaterThan(0);
    expect(inside.amb_rain_roof).toBeGreaterThan(0.5);
    expect(inside.bed_rain).toBe(0);
    expect(bedLevels({ ...base, snow: 0.7, temp: -3, winter: true }).amb_snow).toBeGreaterThan(0.5);
    expect(bedLevels({ ...base, wind: 1, storm: 1 }).bed_wind).toBeGreaterThan(0.6);
  });
  it('knows what furniture sounds like', () => {
    expect(materialOf('fishbowl', 'fun')).toBe('glass');
    expect(materialOf('cushion', 'seating')).toBe('soft');
    expect(materialOf('bench', 'seating')).toBe('wood');
    expect(materialOf('fernpot', 'plants')).toBe('plant');
    expect(materialOf('painting', 'wall')).toBe('paper');
    expect(materialOf('mushlamp', 'lights')).toBe('metal');
    expect(materialOf('toybox', 'storage')).toBe('wood');
  });
});
