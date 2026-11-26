// Living dialogue for every spoken line in the game (Pip in the interview and at home, Barnaby in his store).
// [text15] The words are plain, warm cream letters in the game's face (font.ts) with one soft shadow under them for
// contrast over the scene. Letters fade in from slightly behind and settle into place; the line lags a little when
// the camera or the speaker moves, and the old line drifts back and away when the next one arrives. The pacing is a person's: an uneven typing rhythm, short filler words quicker, pauses at
// commas, full stops and ellipses, a beat before an important word. A soft voice blip per syllable, pitched by the
// vowel and the sentence's intonation.
//
// Markup in a line:   *word*  highlight: bold, in the one warm accent colour (a beat before it)
//                     !word!  scream: extra-bold and bigger, slams in, the line jolts (a longer beat)
//                     _word_  whisper: italic, a little smaller and paler, slower and quieter
//                     ~word~  sing-song: typed a little slower (plain letters)
// A span may hold several words ("*Hoot Hollow!*"); punctuation right after a span takes its style. A mark that
// is not an opener or has no closer is printed as it is (so "Hoo! Oh!" is just exclamations).
import { sound } from '../audio/sound.ts';
import { fontAt, fontReady, GRID, SCALE, snapFont, textSafe } from './font.ts';
import { drawText3D, PALETTES, type Palette } from './text3d.tsx';
import { reducedMotion } from './chrome/swing.ts';

// ------------------------------------------------------------------ markup

export type Tone = 'say' | 'hi' | 'yell' | 'hush' | 'wave';
export interface Ch { c: string; tone: Tone }
const MARK: Record<string, Tone> = { '*': 'hi', '!': 'yell', _: 'hush', '~': 'wave' };
const isMark = (c: string | undefined) => !!c && Object.prototype.hasOwnProperty.call(MARK, c);
/** what may stand right before an opening mark */
const OPEN_BEFORE = /[\s(["'‘“]/;
/** what may stand right after a closing mark */
const CLOSE_AFTER = /[\s.,!?;:)\]"'’”…-]/;
const PUNCT = /[.,!?;:…]/;

/** Split a line into characters with their tone (the marks themselves are dropped). */
export function parse(text: string): Ch[] {
  const s = textSafe(text);
  const closesAt = (j: number, m: string) => s[j] === m && j > 0 && !/\s/.test(s[j - 1]) && (j + 1 >= s.length || CLOSE_AFTER.test(s[j + 1]) || isMark(s[j + 1]));
  const opens = (i: number) => {
    const m = s[i], n = s[i + 1];
    if (!isMark(m) || !n || /\s/.test(n) || n === m) return false;
    if (i > 0 && !OPEN_BEFORE.test(s[i - 1]) && !isMark(s[i - 1])) return false;
    if (m === '!' && !/[A-Za-z0-9]/.test(n)) return false;
    for (let j = i + 2; j < s.length; j++) if (closesAt(j, m)) return true;
    return false;
  };
  const out: Ch[] = [];
  const stack: { m: string; tone: Tone }[] = [];
  let after: Tone | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i], top = stack[stack.length - 1];
    if (top && closesAt(i, top.m)) { stack.pop(); after = top.tone; continue; }
    if (isMark(c) && opens(i)) { stack.push({ m: c, tone: MARK[c] }); after = null; continue; }
    let tone: Tone = top ? top.tone : 'say';
    if (!top && after && PUNCT.test(c)) tone = after; else after = null;
    out.push({ c, tone });
  }
  return out;
}
/** The words of a line without its marks (for screen readers, logs and timers). */
export const plainOf = (text: string) => parse(text).map((x) => x.c).join('');

// ------------------------------------------------------------------ pacing

export interface Beat {
  c: string; tone: Tone;
  /** seconds after the line starts when the letter appears */
  at: number;
  /** a voice blip starts here (a syllable), and its pitch offset (intonation) */
  blip: boolean; pitch: number;
  /** index of the word (letters of one word share it; spaces get -1) */
  word: number;
  /** first letter of a styled span (it lands with a punch) */
  lead: boolean;
}
const FILLER = new Set(['a', 'an', 'the', 'i', 'to', 'of', 'in', 'on', 'at', 'it', 'is', 'and', 'or', 'so', 'my', 'me', 'we', 'be', 'do', 'as', 'for', 'but', "i'm", "it's", 'that', 'this', 'with', 'your', 'you', 'up', 'if', 'oh']);
const TONE_K: Record<Tone, number> = { say: 1, hi: 1.3, yell: 1.85, hush: 1.4, wave: 1.2 };
const BEAT_K: Record<Tone, number> = { say: 0, hi: 0.2, yell: 0.38, hush: 0.24, wave: 0.12 };
const VOWEL = /[aeiouy]/i;
const hash = (a: number, b: number) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x27d4eb2f); return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

/**
 * When each letter appears: a person's typing rhythm (uneven, quicker through little words, slower through the
 * emphasised ones), pauses at punctuation, a beat before an important word. `speed` > 1 is slower.
 */
export function pace(chs: Ch[], speed = 1): { beats: Beat[]; end: number } {
  const n = chs.length, beats: Beat[] = [];
  // words: runs of non-space characters
  const wordOf: number[] = new Array(n).fill(-1);
  const words: { a: number; b: number; text: string }[] = [];
  for (let i = 0; i < n;) {
    if (/\s/.test(chs[i].c)) { i++; continue; }
    let j = i;
    while (j < n && !/\s/.test(chs[j].c)) j++;
    const text = chs.slice(i, j).map((x) => x.c).join('');
    for (let k = i; k < j; k++) wordOf[k] = words.length;
    words.push({ a: i, b: j, text });
    i = j;
  }
  // syllables: the first vowel of each vowel group (not a silent final e; a word with none gets one on its first letter)
  const blip = new Array(n).fill(false);
  for (const w of words) {
    const letters: number[] = [];
    for (let k = w.a; k < w.b; k++) if (/[a-z0-9]/i.test(chs[k].c)) letters.push(k);
    const groups: number[] = [];
    letters.forEach((k, li) => { if (VOWEL.test(chs[k].c) && !(li > 0 && letters[li - 1] === k - 1 && VOWEL.test(chs[k - 1].c))) groups.push(k); });
    const last = groups[groups.length - 1];
    if (groups.length > 1 && chs[last].c.toLowerCase() === 'e' && last === letters[letters.length - 1]) groups.pop();
    if (!groups.length && letters.length) groups.push(letters[0]);
    for (const k of groups) blip[k] = true;
  }
  // intonation: questions rise, exclamations lift, statements settle at the end
  const pitch = new Array(n).fill(0);
  for (let i = 0; i < n;) {
    let j = i;
    while (j < n && !/[.!?]/.test(chs[j].c)) j++;
    const end = chs[Math.min(j, n - 1)]?.c;
    for (let k = i; k <= Math.min(j, n - 1); k++) {
      const p = (k - i) / Math.max(1, j - i);
      pitch[k] = end === '?' ? 0.2 * p * p : end === '!' ? 0.05 + 0.07 * p : -0.09 * p * p;
    }
    j++;
    while (j < n && /[.!?\s]/.test(chs[j].c)) j++;
    i = j;
  }
  let t = 0.1, prev: Tone = 'say';
  for (let i = 0; i < n; i++) {
    const { c, tone } = chs[i], w = wordOf[i] >= 0 ? words[wordOf[i]] : null;
    const lead = tone !== 'say' && tone !== prev && !(PUNCT.test(c) && i > 0 && chs[i - 1].tone === tone);
    if (lead) t += BEAT_K[tone] * speed;
    beats.push({ c, tone, at: t, blip: blip[i], pitch: pitch[i], word: wordOf[i], lead });
    prev = c === ' ' ? prev : tone;
    if (i === n - 1) break;
    const jit = 1 + (hash(i, c.charCodeAt(0) + n * 31) - 0.5) * 0.5;
    let d: number;
    if (/\s/.test(c)) d = 0.028 + hash(i, 7) * 0.03;
    else {
      const lw = w ? w.text.replace(/’/g, "'").replace(/[^a-z']/gi, '').toLowerCase() : '';
      const wk = FILLER.has(lw) ? 0.74 : lw.length >= 9 ? 0.92 : 1;
      const caps = w && w.text.length > 1 && w.text === w.text.toUpperCase() && /[A-Z]/.test(w.text) ? 1.25 : 1;
      d = 0.046 * TONE_K[tone] * wk * caps * jit;
    }
    // pauses after punctuation (only where a phrase really breaks: before a space or the end)
    const nx = chs[i + 1]?.c ?? '', brk = nx === '' || /[\s"')\]’”]/.test(nx);
    if (c === '…') d += brk ? 0.67 : 0.37;
    else if (c === '.' && nx === '.') d += 0.17;
    else if (c === '.' && i > 0 && chs[i - 1].c === '.') d += brk ? 0.5 : 0.2;
    else if (brk) {
      if (c === ',') d += 0.22;
      else if (c === ';' || c === ':') d += 0.3;
      else if (c === '.') d += 0.44;
      else if (c === '!') d += 0.36;
      else if (c === '?') d += 0.42;
      else if (c === ')') d += 0.14;
      else if (c === '-' && i > 0 && chs[i - 1].c === ' ') d += 0.24;
    }
    t += d * speed;
  }
  return { beats, end: (beats[beats.length - 1]?.at ?? 0) + 0.05 };
}

/** How long a line takes to type, in seconds (for timers that hide it again). */
export const typeTime = (text: string, speed = 1) => pace(parse(text), speed).end;
/** How long to leave a line up so it can be read (ms): it types, then stays a beat plus a little per word (most of
 * the reading happens while it types). */
export function holdMs(text: string, speed = 1, min = 0): number {
  const p = plainOf(text), w = p.split(/\s+/).filter(Boolean).length;
  return Math.max(min, Math.round((typeTime(text, speed) + 1.3 + w * 0.15) * 1000));
}

// ------------------------------------------------------------------ voices

export interface Voice { clips: string[]; rate: number; vol: number; speed: number }
export const VOICES = {
  pip: { clips: ['voice_a', 'voice_b', 'voice_c', 'voice_e'], rate: 1.36, vol: 0.12, speed: 1 },
  barnaby: { clips: ['voice_b', 'voice_c', 'voice_d'], rate: 0.8, vol: 0.13, speed: 1.1 },
  /** the story's captions: no voice, a calm hand */
  narrator: { clips: [] as string[], rate: 1, vol: 0, speed: 1.05 },
} satisfies Record<string, Voice>;
export type VoiceName = keyof typeof VOICES;
const VOWEL_PITCH: Record<string, number> = { a: 0, e: 0.06, i: 0.11, o: -0.05, u: -0.08, y: 0.04 };
function blipOf(v: Voice, b: Beat, i: number) {
  if (!v.clips.length) return;
  const tone = b.tone, k = b.c.toLowerCase();
  const jit = (hash(i, 99) - 0.5) * 0.08;
  const rate = v.rate * (1 + (VOWEL_PITCH[k] ?? 0) + b.pitch + jit) * (tone === 'yell' ? 1.12 : tone === 'hush' ? 0.94 : tone === 'hi' ? 1.04 : 1);
  const vol = v.vol * (tone === 'yell' ? 1.9 : tone === 'hi' ? 1.3 : tone === 'hush' ? 0.42 : 1) * (0.85 + hash(i, 5) * 0.3);
  try { sound.play(v.clips[(k.charCodeAt(0) + i) % v.clips.length], { volume: vol, rate, gap: 52 }); } catch { /* no audio */ }
}

// ------------------------------------------------------------------ letters

/** the look of each tone: one cream, one warm accent for emphasis, weight and slant for the rest */
const ACCENT: Palette = { ...PALETTES.cream, c: '#ffd27a' };
const HUSH: Palette = { ...PALETTES.cream, c: '#efe6d6' };
const LOOK: Record<Tone, { pal: Palette; scale: number; weight: number; italic: boolean; alpha: number }> = {
  say: { pal: PALETTES.cream, scale: 1, weight: 700, italic: false, alpha: 1 },
  hi: { pal: ACCENT, scale: 1, weight: 800, italic: false, alpha: 1 },
  yell: { pal: PALETTES.cream, scale: 1.2, weight: 900, italic: false, alpha: 1 },
  hush: { pal: HUSH, scale: 0.92, weight: 600, italic: true, alpha: 0.92 },
  wave: { pal: PALETTES.cream, scale: 1, weight: 700, italic: false, alpha: 1 },
};
/** a size in whole device px (never under one step) */
const grid = (px: number) => Math.max(GRID, snapFont(px));
/** the letters' face for a tone */
const face = (size: number, t: Tone = 'say') => fontAt(size, { weight: LOOK[t].weight, italic: LOOK[t].italic });

interface Sprite { cv: HTMLCanvasElement; ox: number; oy: number; adv: number }
let fontOK = false;
void fontReady().then(() => { fontOK = true; sprites.clear(); });
const sprites = new Map<string, Sprite>();
let mctx: CanvasRenderingContext2D | null = null;
function advance(c: string, size: number, t: Tone = 'say') {
  mctx ??= document.createElement('canvas').getContext('2d');
  if (!mctx) return size * 0.55;
  mctx.font = face(size, t);
  return mctx.measureText(c).width;
}
/** one letter (or its soft shadow), cached */
function sprite(c: string, size: number, t: Tone, kind: 'face' | 'shadow'): Sprite {
  const lk = LOOK[t], key = `${kind}|${c}|${size}|${t}|${fontOK ? 1 : 0}`;
  let s = sprites.get(key);
  if (s) return s;
  const adv = advance(c, size, t);
  const blur = kind === 'shadow' ? size * 0.12 : 0;
  const padL = Math.ceil(size * 0.25 + blur * 1.6), padT = Math.ceil(size * 1.05 + blur * 1.6);
  const W = Math.ceil(padL * 2 + adv), H = Math.ceil(padT + size * 0.4 + blur * 1.6);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, W); cv.height = Math.max(1, H);
  const g = cv.getContext('2d')!;
  g.font = face(size, t); g.textBaseline = 'alphabetic';
  if (kind === 'face') { g.fillStyle = lk.pal.c; g.fillText(textSafe(c), padL, padT); }
  else {
    // the shape blurred, drawn off-canvas and brought in by its shadow (works where canvas filters don't)
    g.shadowColor = 'rgba(14,7,2,1)'; g.shadowBlur = blur; g.shadowOffsetX = W * 2; g.fillStyle = '#000';
    g.fillText(textSafe(c), padL - W * 2, padT);
  }
  s = { cv, ox: padL, oy: padT, adv };
  if (sprites.size > 900) sprites.clear();
  sprites.set(key, s);
  return s;
}


// ------------------------------------------------------------------ the view

/** dev builds: a global time scale for the words (screenshots in slow headless browsers): window.hhTalk.k */
const dev = { k: 1 };
try { if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { hhTalk: unknown }).hhTalk = dev; } catch { /* */ }

export interface TalkOpts {
  /** CSS px the body text aims for (snapped to whole font pixels on this device) */
  size: number;
  /** the widest a line may be, CSS px */
  maxWidth: number;
  align?: 'center' | 'left';
  /** which edge of the canvas the words hang from (the host positions the canvas by that edge) */
  anchor?: 'top' | 'bottom';
  voice?: VoiceName;
  /** a soft dark halo behind the words, for legibility over busy scenes (0..1) */
  scrim?: number;
  /** a name tag over the first line */
  tag?: boolean;
}
interface Placed extends Beat { x: number; base: number; size: number; sp: Sprite; sh: Sprite; line: number; i: number }
interface Row { w: number; base: number; top: number; bot: number; g0: number }
interface Line { glyphs: Placed[]; start: number; end: number; leave: number; w: number; h: number; rows: Row[]; who: string; tagBorn: number; plain: string; heard: number; done: boolean; jolt: number }

export class TalkView {
  readonly canvas = document.createElement('canvas');
  /** CSS size of the canvas (whole px) */
  cssW = 1; cssH = 1;
  onDone: (() => void) | null = null;
  /** each syllable as it is spoken (a beak flap) */
  onBlip: (() => void) | null = null;
  /** time scale (dev harness) */
  pace = 1;
  private o: Required<TalkOpts>;
  private cur: Line | null = null;
  private old: Line | null = null;
  private clock = 0;
  private dpr = 1;
  private s = 32;
  private tags = new Map<string, { cv: HTMLCanvasElement; w: number; h: number }>();
  /** inertia: the words lag when the world behind them moves (their shadows lag more: depth) */
  private lag = { x: 0, y: 0, vx: 0, vy: 0 };
  private live: HTMLElement | null = null;

  constructor(o: TalkOpts) {
    this.o = { align: 'center', anchor: 'top', voice: 'pip', scrim: 0, tag: true, ...o };
    this.canvas.setAttribute('aria-hidden', 'true');
    Object.assign(this.canvas.style, { display: 'block', pointerEvents: 'none' });
    try {
      const d = document.createElement('div');
      d.setAttribute('aria-live', 'polite');
      Object.assign(d.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' });
      document.body.appendChild(d);
      this.live = d;
    } catch { /* no DOM */ }
    this.measure();
  }

  /** Change the size, width or look (a resize); the line on screen is laid out again. */
  set(o: Partial<TalkOpts>) {
    const before = `${this.o.size}|${this.o.maxWidth}|${this.dpr}`;
    Object.assign(this.o, o);
    this.measure();
    if (`${this.o.size}|${this.o.maxWidth}|${this.dpr}` !== before) { this.tags.clear(); for (const l of [this.cur, this.old]) if (l) this.layout(l, l.glyphs); this.sizeCanvas(); }
  }
  private measure() { this.dpr = Math.min(3, Math.max(1, devicePixelRatio || 1)); this.s = grid(this.o.size * SCALE * this.dpr); }

  /** the line on screen (marks removed) */
  get text() { return this.cur?.plain ?? ''; }
  get typing() { return !!this.cur && !this.cur.done; }
  /** nothing on screen and nothing leaving */
  get idle() { return !this.cur && !this.old; }
  /** the body text size in CSS px */
  get size() { return this.s / this.dpr; }

  /** Say a line (null: the words drift away). `instant` shows it at once. */
  say(text: string | null, o: { who?: string; instant?: boolean } = {}) {
    const prev = this.cur;
    if (prev) { this.old = prev; prev.leave = this.clock; }
    this.cur = null;
    if (!text) { if (this.live) this.live.textContent = ''; this.sizeCanvas(); return; }
    const chs = parse(text);
    const { beats, end } = pace(chs, VOICES[this.o.voice].speed);
    const start = this.clock + (prev ? 0.3 : 0.05), who = o.who ?? '';
    const line: Line = { glyphs: [], start, end: start + end, leave: Infinity, w: 0, h: 0, rows: [], who, tagBorn: prev && prev.who === who ? prev.tagBorn : start, plain: chs.map((x) => x.c).join(''), heard: 0, done: false, jolt: -9 };
    this.cur = line;
    this.layout(line, beats);
    this.sizeCanvas();
    if (o.instant) this.finish(true);
    if (this.live) this.live.textContent = (who ? who + ': ' : '') + line.plain;
  }
  /** Show the rest of the line now (a tap while it types): the remaining letters ripple in quickly. */
  finish(instant = false) {
    const l = this.cur;
    if (!l || l.done) return;
    const now = Math.max(this.clock, l.start) - l.start;
    let k = 0;
    for (const g of l.glyphs) if (g.at > now) g.at = now + (instant ? -1 : Math.min(0.16, k++ * 0.005));
    l.end = l.start + Math.max(0, ...l.glyphs.map((g) => g.at)) + 0.01;
    l.heard = l.glyphs.length;
    if (instant) { l.done = true; l.tagBorn = Math.min(l.tagBorn, this.clock - 1); this.onDone?.(); }
  }
  /**
   * Push the words by (dx, dy) CSS px; they spring back (their shadows swing further: depth). Hosts pass a share of
   * the world's move behind a fixed canvas, or the opposite of the anchor's move when the canvas follows a speaker.
   */
  drift(dx: number, dy: number) {
    if (reducedMotion() || !isFinite(dx + dy)) return;
    this.lag.x = Math.max(-24, Math.min(24, this.lag.x + dx));
    this.lag.y = Math.max(-24, Math.min(24, this.lag.y + dy));
  }

  private layout(l: Line, beats: Beat[]) {
    const s = this.s, maxW = Math.max(s * 4, this.o.maxWidth * this.dpr - this.padX() * 2);
    const size = (t: Tone) => (t === 'say' || t === 'wave' ? s : grid(s * LOOK[t].scale));
    // words, with their letters' advances
    const items: { beats: Beat[]; w: number; space: number }[] = [];
    let word: Beat[] = [];
    const flush = () => { if (word.length) items.push({ beats: word, w: word.reduce((a, b) => a + advance(b.c, size(b.tone), b.tone), 0), space: 0 }); word = []; };
    for (const b of beats) { if (b.c === ' ') { flush(); if (items.length) items[items.length - 1].space += advance(' ', s); } else word.push(b); }
    flush();
    // wrap into rows
    const rows: (typeof items)[] = [[]];
    let x = 0;
    for (const it of items) {
      const row = rows[rows.length - 1];
      if (row.length && x + it.w > maxW) { rows.push([it]); x = it.w + it.space; } else { row.push(it); x += it.w + it.space; }
    }
    // each row as tall as its biggest letter
    const glyphs: Placed[] = [];
    l.rows = [];
    let y = 0, gi = 0;
    rows.forEach((row, ri) => {
      const big = Math.max(s, ...row.flatMap((it) => it.beats.map((b) => size(b.tone))));
      const top = y, base = y + big * 0.8;
      let rx = 0;
      for (const it of row) {
        for (const b of it.beats) {
          const sz = size(b.tone);
          const sp = sprite(b.c, sz, b.tone, 'face'), sh = sprite(b.c, sz, b.tone, 'shadow');
          glyphs.push({ c: b.c, tone: b.tone, at: b.at, blip: b.blip, pitch: b.pitch, word: b.word, lead: b.lead, x: rx, base, size: sz, sp, sh, line: ri, i: gi++ });
          rx += sp.adv;
        }
        rx += it.space;
      }
      const bot = base + big * 0.32;
      l.rows.push({ w: rx - (row.length ? row[row.length - 1].space : 0), base, top, bot, g0: glyphs.findIndex((x) => x.line === ri) });
      y = bot + s * 0.12;
    });
    l.glyphs = glyphs;
    l.w = Math.max(s, ...l.rows.map((r) => r.w));
    l.h = y - s * 0.12;
  }
  private padX() { return Math.ceil(this.s * 0.75); }
  private padTop() { return Math.ceil(this.s * (this.o.tag ? 1.2 : 0.7)); }
  private padBot() { return Math.ceil(this.s * 0.9); }
  private sizeCanvas() {
    const ls = [this.cur, this.old].filter(Boolean) as Line[];
    const w = Math.max(this.s * 5, ...ls.map((l) => l.w)) + this.padX() * 2;
    const h = Math.max(this.s, ...ls.map((l) => l.h)) + this.padTop() + this.padBot();
    // whole CSS px, so the canvas sits on the pixel grid (an even width, so a centred canvas does too)
    const cw = Math.ceil(w / this.dpr / 2) * 2, ch = Math.ceil(h / this.dpr);
    if (cw !== this.cssW || ch !== this.cssH || this.canvas.width !== Math.round(cw * this.dpr)) {
      this.cssW = cw; this.cssH = ch;
      this.canvas.width = Math.round(cw * this.dpr); this.canvas.height = Math.round(ch * this.dpr);
      this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px';
    }
  }

  /** Advance time (seconds), speak the letters that are due, and draw. */
  step(dt: number) {
    dt = Math.min(0.1, Math.max(0, dt)) * this.pace * dev.k;
    this.clock += dt;
    const still = reducedMotion(), L = this.lag;
    if (still) L.x = L.y = L.vx = L.vy = 0;
    else {
      // the spring in small steps (stable whatever the frame time)
      for (let left = dt; left > 1e-6; left -= 1 / 120) {
        const h = Math.min(1 / 120, left);
        L.vx += (-L.x * 55 - L.vx * 10) * h; L.vy += (-L.y * 55 - L.vy * 10) * h;
        L.x += L.vx * h; L.y += L.vy * h;
      }
      if (!Number.isFinite(L.x + L.y + L.vx + L.vy)) L.x = L.y = L.vx = L.vy = 0;
    }
    const l = this.cur;
    if (l && !l.done) {
      const v = VOICES[this.o.voice];
      while (l.heard < l.glyphs.length && l.start + l.glyphs[l.heard].at <= this.clock) {
        const g = l.glyphs[l.heard];
        if (g.blip) { blipOf(v, g, l.heard); this.onBlip?.(); }
        if (g.lead && g.tone === 'yell') l.jolt = this.clock;
        l.heard++;
      }
      if (this.clock >= l.end) { l.done = true; this.onDone?.(); }
    }
    if (this.old && this.clock - this.old.leave > 0.62) { this.old = null; this.sizeCanvas(); }
    const g = this.canvas.getContext('2d');
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.old) this.drawLine(g, this.old, still);
    if (this.cur) this.drawLine(g, this.cur, still);
  }

  private drawLine(g: CanvasRenderingContext2D, l: Line, still: boolean) {
    const s = this.s, T = this.clock, W = this.canvas.width, H = this.canvas.height;
    const top = this.o.anchor === 'top' ? this.padTop() : H - this.padBot() - l.h;
    const tl = l.leave < Infinity ? T - l.leave : -1;
    const rowX = (r: number) => (this.o.align === 'center' ? Math.round((W - l.rows[r].w) / 2) : this.padX());
    // the whole line jolts when a scream lands
    const jk = T - l.jolt, jolt = !still && jk >= 0 && jk < 0.42 ? Math.sin(jk * 58) * (1 - jk / 0.42) ** 2 * s * 0.07 : 0;
    const lx = this.lag.x * this.dpr + jolt, ly = this.lag.y * this.dpr + jolt * 0.4;
    const fadeAll = tl < 0 ? 1 : Math.max(0, 1 - tl / 0.5);
    // legibility: a soft dark halo behind each row
    if (this.o.scrim > 0) {
      for (let r = 0; r < l.rows.length; r++) {
        const row = l.rows[r], g0 = l.glyphs[row.g0];
        // each row's halo comes up as its first letters arrive
        const a = g0 ? this.o.scrim * fadeAll * Math.max(0, Math.min(1, (T - l.start - g0.at) / 0.5)) : 0;
        if (a < 0.002) continue;
        const cx = rowX(r) + row.w / 2 + lx * 0.5, cy = top + (row.top + row.bot) / 2 + ly * 0.5 + s * 0.06;
        const rx = row.w / 2 + s * 0.8, ry = (row.bot - row.top) / 2 + s * 0.42;
        g.save(); g.translate(cx, cy); g.scale(rx / ry, 1);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry);
        gr.addColorStop(0, `rgba(16,9,5,${a})`); gr.addColorStop(0.6, `rgba(16,9,5,${a * 0.65})`); gr.addColorStop(1, 'rgba(16,9,5,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry, 0, Math.PI * 2); g.fill(); g.restore();
      }
    }
    // the speaker's name over the first line (it stays put between lines from the same speaker)
    if (this.o.tag && l.who && !(l === this.old && this.cur && this.cur.who === l.who)) this.drawTag(g, l, rowX(0), top, fadeAll, still);
    // each letter: where it is, how big, how far forward it has come
    const ps: { gl: Placed; x: number; y: number; kx: number; ky: number; a: number; z: number }[] = [];
    for (const gl of l.glyphs) {
      const age = T - (l.start + gl.at);
      if (age < 0) continue;
      const inDur = gl.tone === 'yell' ? 0.24 : gl.tone === 'hush' ? 0.5 : 0.36;
      const e = Math.min(1, age / inDur), ease = 1 - (1 - e) ** 3;
      let kx = 1, ky = 1, dy = 0, dx = 0, z = still ? 0 : 1 - ease;
      if (!still) {
        if (gl.tone === 'yell') {
          // slams in from a little bigger and settles
          kx = ky = 1 + (1 - ease) * 0.45;
          z = 0;
        } else {
          // from slightly behind: a touch smaller and higher, then into place
          kx = ky = 0.86 + 0.14 * ease;
          dy -= (1 - ease) * s * 0.16;
        }
      }
      let a = Math.min(1, age / (inDur * 0.55)) * LOOK[gl.tone].alpha;
      if (tl >= 0) {
        // the old line drifts back and away, letter by letter
        const lv = Math.max(0, Math.min(1, (tl - Math.min(0.14, gl.i * 0.0028)) / 0.32)), ev = lv * lv;
        a *= 1 - lv; kx *= 1 - ev * 0.24; ky *= 1 - ev * 0.24; dy -= ev * s * 0.45; z = Math.max(z, lv);
      }
      if (a <= 0.004) continue;
      ps.push({ gl, x: rowX(gl.line) + gl.x + dx + lx, y: top + gl.base + dy + ly, kx, ky, a, z });
    }
    // a sprite scaled about the middle of its letter
    const put = (sp: Sprite, gl: Placed, x: number, y: number, kx: number, ky: number) => {
      if (Math.abs(kx - 1) < 0.003 && Math.abs(ky - 1) < 0.003) { g.drawImage(sp.cv, Math.round(x - sp.ox), Math.round(y - sp.oy)); return; }
      const cx = gl.sp.adv / 2, cy = -gl.size * 0.35;
      g.drawImage(sp.cv, x + cx - (sp.ox + cx) * kx, y + cy - (sp.oy + cy) * ky, sp.cv.width * kx, sp.cv.height * ky);
    };
    g.imageSmoothingEnabled = true; // the soft shadows and glows stay soft when scaled
    // 1. one soft shadow under the letters (contrast over the scene)
    const shx = s * 0.03, shy = s * 0.07;
    for (const p of ps) {
      g.globalAlpha = p.a * 0.55 * (1 - p.z);
      put(p.gl.sh, p.gl, p.x + shx, p.y + shy, p.kx, p.ky);
    }
    // 2. the letters
    for (const p of ps) {
      g.globalAlpha = p.a * (1 - p.z * 0.35);
      put(p.gl.sp, p.gl, p.x, p.y, p.kx, p.ky);
    }
    g.globalAlpha = 1;
  }

  private drawTag(g: CanvasRenderingContext2D, l: Line, x0: number, top: number, fade: number, still: boolean) {
    const s = this.s, ts = grid(s * 0.67);
    let t = this.tags.get(l.who);
    if (!t) {
      const w = Math.ceil(advanceText(l.who, ts) + ts * 0.7), h = Math.ceil(ts * 1.5);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      drawText3D(cv.getContext('2d')!, l.who, Math.round(ts * 0.14), Math.round(ts * 1.0), { size: ts, palette: ACCENT, caps: true });
      t = { cv, w, h };
      if (fontOK) this.tags.set(l.who, t);
    }
    const k = still ? 1 : Math.max(0, Math.min(1, (this.clock - l.tagBorn) / 0.4)), e = 1 - (1 - k) ** 3;
    // over the start of the first row, a speaker's label (a centred one would float off while a long row types)
    const x = x0 - Math.round(this.s * 0.06);
    g.globalAlpha = e * fade;
    g.drawImage(t.cv, Math.round(x - (1 - e) * s * 0.35), Math.round(top - t.h - s * 0.02));
    g.globalAlpha = 1;
  }

  dispose() { this.live?.remove(); this.canvas.remove(); }
}
/** a name, as the tag sets it */
function advanceText(t: string, size: number) {
  mctx ??= document.createElement('canvas').getContext('2d');
  if (!mctx) return t.length * size * 0.6;
  mctx.font = fontAt(size, { caps: true });
  return mctx.measureText(textSafe(t)).width;
}
