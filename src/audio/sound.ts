// Sound: plays the licensed recordings listed in /sfx/manifest.json (see docs/AUDIO-CREDITS.md).
// Nothing is synthesised. Four buses (effects, ambience, music, alarm) each with their own volume;
// loops crossfade copies of themselves so they never click. Unlike a game, the audio context is
// kept running in the background while a soundscape or the alarm is playing.
//
// [audio3] Short sounds are packed into a few audio sprites (one file per category, offsets in the
// manifest) and long loops, music and alarms into a few file packs (whole MP3s back to back, byte
// ranges in the manifest; see sprites.ts). `sound.play('box_tape')` or `sound.loop('amb_rain')` find
// their clip transparently; a pack member is range-requested and decoded on its own. Context routes (`sound.route`) let src/audio/wiring.ts swap a generic id for
// a better one where it knows more (a page turn inside the book, a till in the shop...).
import { filesFor, resolveRef, type Manifest } from './sprites.ts';

class Looper {
  private timer = 0;
  readonly gain: GainNode;
  on = false;
  constructor(private ctx: AudioContext, private buf: AudioBuffer, out: AudioNode, public level: number) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(out);
  }
  private spawn(when: number) {
    const fade = Math.min(1.5, this.buf.duration / 4), src = this.ctx.createBufferSource(), g = this.ctx.createGain();
    src.buffer = this.buf;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(1, when + fade);
    g.gain.setValueAtTime(1, when + this.buf.duration - fade);
    g.gain.linearRampToValueAtTime(0, when + this.buf.duration);
    src.connect(g).connect(this.gain);
    src.start(when);
    const next = when + this.buf.duration - fade;
    this.timer = window.setTimeout(() => { if (this.on) this.spawn(next); }, Math.max(0, (next - this.ctx.currentTime - 0.3) * 1000));
  }
  set(on: boolean, level = this.level, fadeSec = 0.8) {
    this.level = level;
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.setTargetAtTime(on ? level : 0, t, fadeSec);
    if (on && !this.on) { this.on = true; this.spawn(t + 0.05); }
    else if (!on && this.on) { this.on = false; clearTimeout(this.timer); }
  }
}

export type Bus = 'sfx' | 'amb' | 'music' | 'alarm';
export interface PlayOpts { volume?: number; rate?: number; gap?: number; bus?: Bus }
/** A context route: return another sound id to play instead (or nothing to keep the asked one). */
export type Route = (o: PlayOpts) => string | null | undefined | void;

export class Sound {
  private ctx: AudioContext | null = null;
  private man: Manifest | null = null;
  private bufs = new Map<string, Promise<AudioBuffer | null>>();
  private clips = new Map<string, Promise<AudioBuffer | null>>();
  private whole = new Map<string, Promise<ArrayBuffer | null>>();
  private loops = new Map<string, Looper>();
  private bus = {} as Record<Bus, GainNode>;
  private want = new Map<string, { level: number; bus: Bus }>();
  private lastPlay = new Map<string, number>();
  private vols: Record<Bus, number> = { sfx: 0.8, amb: 0.7, music: 0.5, alarm: 1 };
  private musicId: string | null = null;
  private fadeTimer = 0;
  private routes = new Map<string, Route>();
  private claimed = new Set<string>();
  private bedIds = new Set<string>();
  ready = false;
  /** [audio3] true while the ambience director (wiring.ts) owns the day beds; see claim() */
  bedsOn = false;
  /** [audio3] the last sounds played (id, the clip it resolved to, ms), for dev tools and tests */
  readonly recent: { id: string; ref: string; at: number }[] = [];

  async init() {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}sfx/manifest.json`);
      if (r.ok) this.man = (await r.json()) as Manifest;
    } catch { /* no sounds bundled */ }
    const unlock = () => this.unlock();
    // capture phase: a panel that stops propagation must not keep the audio locked
    addEventListener('pointerdown', unlock, { passive: true, capture: true });
    addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      // keep playing in the background when something the sleeper needs is running
      const keep = [...this.loops.entries()].some(([id, l]) => l.on && this.want.get(id)?.bus !== 'music' && this.want.get(id)?.bus !== 'sfx' && !this.bedIds.has(id));
      if (document.hidden && !keep) void this.ctx.suspend();
      else if (!document.hidden) void this.ctx.resume();
    });
  }

  /** Create/resume the context. Call from a user gesture (e.g. the "sleep" tap) so the alarm can play later. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      for (const b of ['sfx', 'amb', 'music', 'alarm'] as Bus[]) { this.bus[b] = this.ctx.createGain(); this.bus[b].gain.value = this.vols[b]; this.bus[b].connect(this.ctx.destination); }
      this.ready = true;
      for (const [id, w] of this.want) void this._loop(id, true, w.level, w.bus);
      // the sprites most taps need, fetched while the player looks around
      const idle = (f: () => void) => ((window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((g: () => void) => setTimeout(g, 400)))(f);
      idle(() => this.warm(['sfx_ui.mp3', 'sfx_home.mp3', 'sfx_nature.mp3']));
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  has(id: string) { return !!this.man?.sounds[id]; }
  entry(id: string) { return this.man?.sounds[id]; }
  /** The loaded manifest (null before init or without sounds). */
  get manifest() { return this.man; }
  /** [audio3] The loops playing now and their levels (dev tools, tests). */
  get looping() { return [...this.loops.entries()].filter(([, l]) => l.on).map(([id, l]) => ({ id, level: Math.round(l.level * 1000) / 1000 })); }

  volumes(v: Partial<Record<Bus, number>>) {
    Object.assign(this.vols, v);
    if (this.ctx) for (const b of Object.keys(v) as Bus[]) this.bus[b].gain.setTargetAtTime(this.vols[b], this.ctx.currentTime, 0.1);
  }

  /** Decode; sprites at 32 kHz (their MP3s stop at 16 kHz anyway), which keeps a third less in memory. */
  private async decode(a: ArrayBuffer, sprite: boolean): Promise<AudioBuffer> {
    const OAC = (window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
    if (sprite && OAC) { try { return await new OAC(1, 1, 32000).decodeAudioData(a.slice(0)); } catch { /* decode at the context's rate */ } }
    return this.ctx!.decodeAudioData(a);
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    let p = this.bufs.get(file);
    if (!p) {
      p = fetch(`${import.meta.env.BASE_URL}sfx/${file}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => this.decode(a, !!this.man?.sprites?.[file])).catch(() => null);
      this.bufs.set(file, p);
    }
    return p;
  }

  /** The bytes of one member of a file pack: an HTTP range request, else sliced from the whole file. */
  private async member(file: string, [a, b]: [number, number]): Promise<ArrayBuffer | null> {
    const url = `${import.meta.env.BASE_URL}sfx/${file}`;
    let whole = this.whole.get(file);
    if (!whole) {
      try {
        const r = await fetch(url, { headers: { Range: `bytes=${a}-${b - 1}` } });
        if (r.status === 206) { const part = await r.arrayBuffer(); if (part.byteLength === b - a) return part; }
        else if (r.ok) { whole = r.arrayBuffer().catch(() => null); this.whole.set(file, whole); }
      } catch { /* try the whole file */ }
      if (!whole) { whole = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null); this.whole.set(file, whole); }
    }
    const all = await whole;
    return all ? all.slice(a, b) : null;
  }

  /** A whole buffer for a manifest file entry: the file itself, a pack member, or a copy of a sprite clip (loops). */
  private clipBuffer(ref: string): Promise<AudioBuffer | null> {
    const r = this.man ? resolveRef(this.man, ref) : null;
    if (!r) return Promise.resolve(null);
    if (!r.clip) return this.buffer(r.file);
    let p = this.clips.get(ref);
    if (!p && r.bytes) {
      p = this.member(r.file, r.bytes).then((a) => (a && this.ctx ? this.decode(a, false) : null)).catch(() => null);
      this.clips.set(ref, p);
    }
    if (!p) {
      p = this.buffer(r.file).then((src) => {
        if (!src || !this.ctx) return null;
        const a = Math.floor(r.start * src.sampleRate), n = Math.max(1, Math.min(src.length - a, Math.round((r.dur ?? 0) * src.sampleRate)));
        const out = this.ctx.createBuffer(src.numberOfChannels, n, src.sampleRate);
        for (let c = 0; c < src.numberOfChannels; c++) out.copyToChannel(src.getChannelData(c).subarray(a, a + n), c);
        return out;
      });
      this.clips.set(ref, p);
    }
    return p;
  }

  /** Warm the cache for sounds that must start instantly (breathing cues, the alarm). */
  preload(ids: string[]) {
    if (!this.ctx || !this.man) return;
    for (const id of ids) for (const ref of this.man.sounds[id]?.files ?? []) { const r = resolveRef(this.man, ref); if (r?.bytes) void this.clipBuffer(ref); }
    for (const f of filesFor(this.man, ids)) if (!this.man.packs?.[f]) void this.buffer(f);
  }
  /** Fetch and decode whole audio files (sprites) ahead of time. */
  warm(files: string[]) { if (!this.ctx) return; for (const f of files) if (this.man?.sprites?.[f]) void this.buffer(f); }

  /** [audio3] Swap `id` for another sound while `fn` says so (null removes the route). */
  route(id: string, fn: Route | null) { if (fn) this.routes.set(id, fn); else this.routes.delete(id); }
  /** [audio3] Loops the ambience director plays itself while `bedsOn`; stray loop() calls for them are ignored then. */
  claim(ids: string[]) { for (const id of ids) this.claimed.add(id); }
  /** [audio3] The director's day beds: they never keep the audio running in a background tab (the sleep soundscape does). */
  setBeds(ids: readonly string[]) { for (const id of ids) this.bedIds.add(id); }

  /** Play a one-shot. `gap` (ms) throttles sounds that can fire in bursts. */
  play(id: string, o: PlayOpts = {}) {
    const to = this.routes.get(id)?.(o);
    if (to && to !== id && this.man?.sounds[to]) id = to;
    const e = this.man?.sounds[id];
    if (!e || !this.ctx) return;
    const now = performance.now();
    if (o.gap && now - (this.lastPlay.get(id) ?? 0) < o.gap) return;
    this.lastPlay.set(id, now);
    const ref = e.files[Math.floor(Math.random() * e.files.length)];
    const r = resolveRef(this.man!, ref);
    if (!r) return;
    this.recent.push({ id, ref, at: Math.round(now) });
    if (this.recent.length > 60) this.recent.shift();
    void (r.bytes ? this.clipBuffer(ref) : this.buffer(r.file)).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = buf; src.playbackRate.value = o.rate ?? 1;
      g.gain.value = (e.gain ?? 1) * (o.volume ?? 1);
      src.connect(g).connect(this.bus[o.bus ?? 'sfx']);
      if (r.dur !== null && !r.bytes) src.start(0, r.start, r.dur);
      else src.start();
    });
  }

  async loop(id: string, on: boolean, level = 1, bus: Bus = 'amb', fadeSec = 0.8) {
    // [audio3] while the ambience director runs the day beds, it alone switches the ones it claimed
    if (this.bedsOn && this.claimed.has(id)) return;
    return this._loop(id, on, level, bus, fadeSec);
  }

  /** The loop switch itself (the director, soundscapes, previews and the alarm come straight here). */
  async _loop(id: string, on: boolean, level = 1, bus: Bus = 'amb', fadeSec = 0.8) {
    if (on) this.want.set(id, { level, bus }); else this.want.delete(id);
    const e = this.man?.sounds[id];
    if (!e || !this.ctx) return;
    let l = this.loops.get(id);
    if (!l) {
      if (!on) return;
      const buf = await this.clipBuffer(e.files[0]);
      if (!buf || !this.ctx) return;
      l = this.loops.get(id) ?? new Looper(this.ctx, buf, this.bus[bus], (e.gain ?? 1) * level);
      this.loops.set(id, l);
    }
    const w = this.want.get(id);
    l.set(!!w, (e.gain ?? 1) * (w?.level ?? level), fadeSec);
  }

  /** Switch the background music (null for silence) with a gentle crossfade. */
  music(id: string | null) {
    if (id === this.musicId) return;
    if (this.musicId) void this._loop(this.musicId, false, 1, 'music', 1.6);
    this.musicId = id;
    if (id) void this._loop(id, true, 1, 'music', 1.6);
  }

  /** A sleep soundscape that fades out after `minutes` (0 = all night). */
  soundscape(id: string | null, level = 0.7, minutes = 0) {
    for (const k of ['amb_rain', 'amb_waves', 'amb_brown', 'amb_forest_night', 'amb_fire', 'amb_stream', 'amb_night', 'amb_wind', 'music_lullaby']) if (k !== id) void this._loop(k, false, 1, 'amb', 2);
    clearTimeout(this.fadeTimer);
    if (!id) return;
    void this._loop(id, true, level, 'amb', 2);
    if (minutes > 0) this.fadeTimer = window.setTimeout(() => void this._loop(id, false, level, 'amb', 25), minutes * 60_000);
  }

  /** Ring: the chosen melody swells from quiet to full over half a minute. */
  alarm(id: string) {
    this.unlock();
    void this._loop(id, true, 0.12, 'alarm', 0.5).then(() => {
      let k = 0;
      const step = () => { if (!this.want.has(id)) return; k++; void this._loop(id, true, Math.min(1, 0.12 + k * 0.08), 'alarm', 1.5); if (k < 12) window.setTimeout(step, 2500); };
      window.setTimeout(step, 2500);
    });
  }
  stopAlarm() { for (const id of ['alarm_musicbox', 'alarm_kalimba', 'alarm_birds', 'alarm_bells']) void this._loop(id, false, 0, 'alarm', 0.3); }

  /** Hear a few seconds of a looping sound (alarm/soundscape pickers). */
  preview(id: string, seconds = 4, bus: Bus = 'amb') {
    this.unlock();
    void this._loop(id, true, 1, bus, 0.2);
    window.setTimeout(() => void this._loop(id, false, 1, bus, 0.6), seconds * 1000);
  }
}

export const sound = new Sound();

// ------------------------------------------------------------------ scene sounds

export type Surface = 'grass' | 'wood' | 'snow' | 'wet';
/** [audio3] What the scene sounds need to know about the world; installed by wiring.ts. */
export interface SceneContext { surface(): Surface; species(): string; night(): number }
let ctxw: SceneContext = { surface: () => 'grass', species: () => 'tawny', night: () => 0 };
export function setSceneContext(c: SceneContext) { ctxw = c; }

/** Each owl species' call: the real recording of that owl where one exists, else the closest relative's. */
export const OWL_CALL: Record<string, [id: string, rate: number]> = {
  tawny: ['owl_tawny', 1], barn: ['owl_barn', 1], horned: ['owl_horned', 1], longeared: ['owl_longeared', 1],
  // no public-domain recording found: a near relative, a little slower or faster
  snowy: ['owl_longeared', 0.9], eagle: ['owl_horned', 0.86], greatgrey: ['owl_barred', 0.9],
  burrowing: ['owl_kewick', 1.12], sawwhet: ['owl_kewick', 1.22], little: ['owl_kewick', 1.06],
};
export function owlCall(species: string): [string, number] { return OWL_CALL[species] ?? ['owl_hoot', 1]; }

const jit = (a: number, b: number) => a + Math.random() * (b - a);

/** Map scene / game events to sounds. */
export function sceneSound(id: string) {
  const hop = () => `hop_${ctxw.surface()}`;
  switch (id) {
    // Pip
    case 'owl_hoot': { const [c, r] = owlCall(ctxw.species()); sound.play(c, { volume: 0.5, rate: r * jit(0.97, 1.03), gap: 600 }); return; }
    case 'owl_flap': sound.play('owl_wing', { volume: 0.5, rate: jit(0.95, 1.1), gap: 160 }); return;
    case 'owl_hop': sound.play('feather_ruffle', { volume: 0.18, rate: jit(1.2, 1.4), gap: 160 }); return;
    case 'owl_land': sound.play(hop(), { volume: 0.4, rate: jit(0.95, 1.05), gap: 120 }); return;
    case 'step': sound.play(hop(), { volume: 0.24, rate: jit(0.95, 1.12), gap: 110 }); return;
    case 'owl_happy': sound.play('pet_happy', { volume: 0.55, gap: 120 }); return;
    case 'owl_snore': sound.play('pet_snore', { volume: 0.4, gap: 120 }); return;
    case 'owl_yawn': sound.play('yawn', { volume: 0.6, gap: 120 }); return;
    case 'owl_rustle': sound.play('feather_ruffle', { volume: 0.45, gap: 160 }); return;
    // the moving boxes in the rooms: the tape, the flaps, the furniture landing (rooms.ts)
    case 'fabric': sound.play('box_tape', { volume: 0.6, gap: 200 }); return;
    case 'ui_drop': sound.play('box_open', { volume: 0.6, gap: 200 }); window.setTimeout(() => sound.play('box_tear', { volume: 0.3, rate: 1.1, gap: 200 }), 60); return;
    case 'place_item': sound.play('place_land', { volume: 0.5, rate: jit(0.92, 1.08), gap: 90 }); return;
    // birds on the meadow sing what fits the hour
    case 'bird_chirp': {
      const n = ctxw.night();
      if (n > 0.3) sound.play('bird_thrush', { volume: 0.22, rate: jit(0.95, 1.05), gap: 900 });
      else if (Math.random() < 0.5) sound.play('bird_song', { volume: 0.22, rate: jit(0.95, 1.08), gap: 600 });
      else sound.play('bird_chirp', { volume: 0.3, gap: 400 });
      return;
    }
  }
  if (sound.has(id)) sound.play(id, { volume: 0.4, gap: 200 });
}
