// Sound: plays the licensed recordings listed in /sfx/manifest.json (see docs/AUDIO-CREDITS.md).
// Nothing is synthesised. Four buses (effects, ambience, music, alarm) each with their own volume;
// loops crossfade copies of themselves so they never click. Unlike a game, the audio context is
// kept running in the background while a soundscape or the alarm is playing.

interface Entry { files: string[]; gain?: number; loop?: boolean; category?: string }
interface Manifest { version: number; sounds: Record<string, Entry> }

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

type Bus = 'sfx' | 'amb' | 'music' | 'alarm';

export class Sound {
  private ctx: AudioContext | null = null;
  private man: Manifest | null = null;
  private bufs = new Map<string, Promise<AudioBuffer | null>>();
  private loops = new Map<string, Looper>();
  private bus = {} as Record<Bus, GainNode>;
  private want = new Map<string, { level: number; bus: Bus }>();
  private lastPlay = new Map<string, number>();
  private vols: Record<Bus, number> = { sfx: 0.8, amb: 0.7, music: 0.5, alarm: 1 };
  private musicId: string | null = null;
  private fadeTimer = 0;
  ready = false;

  async init() {
    try {
      const r = await fetch(`${import.meta.env.BASE_URL}sfx/manifest.json`);
      if (r.ok) this.man = (await r.json()) as Manifest;
    } catch { /* no sounds bundled */ }
    const unlock = () => this.unlock();
    addEventListener('pointerdown', unlock, { passive: true });
    addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      // keep playing in the background when something the sleeper needs is running
      const keep = [...this.loops.entries()].some(([id, l]) => l.on && this.want.get(id)?.bus !== 'music' && this.want.get(id)?.bus !== 'sfx');
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
      for (const [id, w] of this.want) void this.loop(id, true, w.level, w.bus);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  has(id: string) { return !!this.man?.sounds[id]; }
  entry(id: string) { return this.man?.sounds[id]; }

  volumes(v: Partial<Record<Bus, number>>) {
    Object.assign(this.vols, v);
    if (this.ctx) for (const b of Object.keys(v) as Bus[]) this.bus[b].gain.setTargetAtTime(this.vols[b], this.ctx.currentTime, 0.1);
  }

  private buffer(file: string): Promise<AudioBuffer | null> {
    let p = this.bufs.get(file);
    if (!p) {
      p = fetch(`${import.meta.env.BASE_URL}sfx/${file}`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => this.ctx!.decodeAudioData(a)).catch(() => null);
      this.bufs.set(file, p);
    }
    return p;
  }

  /** Warm the cache for sounds that must start instantly (breathing cues, the alarm). */
  preload(ids: string[]) { if (!this.ctx) return; for (const id of ids) for (const f of this.man?.sounds[id]?.files ?? []) void this.buffer(f); }

  /** Play a one-shot. `gap` (ms) throttles sounds that can fire in bursts. */
  play(id: string, o: { volume?: number; rate?: number; gap?: number; bus?: Bus } = {}) {
    const e = this.man?.sounds[id];
    if (!e || !this.ctx) return;
    const now = performance.now();
    if (o.gap && now - (this.lastPlay.get(id) ?? 0) < o.gap) return;
    this.lastPlay.set(id, now);
    const file = e.files[Math.floor(Math.random() * e.files.length)];
    void this.buffer(file).then((buf) => {
      if (!buf || !this.ctx) return;
      const src = this.ctx.createBufferSource(), g = this.ctx.createGain();
      src.buffer = buf; src.playbackRate.value = o.rate ?? 1;
      g.gain.value = (e.gain ?? 1) * (o.volume ?? 1);
      src.connect(g).connect(this.bus[o.bus ?? 'sfx']);
      src.start();
    });
  }

  async loop(id: string, on: boolean, level = 1, bus: Bus = 'amb', fadeSec = 0.8) {
    if (on) this.want.set(id, { level, bus }); else this.want.delete(id);
    const e = this.man?.sounds[id];
    if (!e || !this.ctx) return;
    let l = this.loops.get(id);
    if (!l) {
      if (!on) return;
      const buf = await this.buffer(e.files[0]);
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
    if (this.musicId) void this.loop(this.musicId, false, 1, 'music', 1.6);
    this.musicId = id;
    if (id) void this.loop(id, true, 1, 'music', 1.6);
  }

  /** A sleep soundscape that fades out after `minutes` (0 = all night). */
  soundscape(id: string | null, level = 0.7, minutes = 0) {
    for (const k of ['amb_rain', 'amb_waves', 'amb_brown', 'amb_forest_night', 'amb_fire', 'amb_stream', 'amb_night', 'amb_wind', 'music_lullaby']) if (k !== id) void this.loop(k, false, 1, 'amb', 2);
    clearTimeout(this.fadeTimer);
    if (!id) return;
    void this.loop(id, true, level, 'amb', 2);
    if (minutes > 0) this.fadeTimer = window.setTimeout(() => void this.loop(id, false, level, 'amb', 25), minutes * 60_000);
  }

  /** Ring: the chosen melody swells from quiet to full over half a minute. */
  alarm(id: string) {
    this.unlock();
    void this.loop(id, true, 0.12, 'alarm', 0.5).then(() => {
      let k = 0;
      const step = () => { if (!this.want.has(id)) return; k++; void this.loop(id, true, Math.min(1, 0.12 + k * 0.08), 'alarm', 1.5); if (k < 12) window.setTimeout(step, 2500); };
      window.setTimeout(step, 2500);
    });
  }
  stopAlarm() { for (const id of ['alarm_musicbox', 'alarm_kalimba', 'alarm_birds', 'alarm_bells']) void this.loop(id, false, 0, 'alarm', 0.3); }

  /** Hear a few seconds of a looping sound (alarm/soundscape pickers). */
  preview(id: string, seconds = 4, bus: Bus = 'amb') {
    this.unlock();
    void this.loop(id, true, 1, bus, 0.2);
    window.setTimeout(() => void this.loop(id, false, 1, bus, 0.6), seconds * 1000);
  }
}

export const sound = new Sound();

/** Map scene / game events to sounds. */
export function sceneSound(id: string) {
  const map: Record<string, [string, number?]> = {
    owl_hoot: ['owl_hoot', 0.5], owl_flap: ['wings_flutter', 0.7], owl_hop: ['pet_jump', 0.5], owl_land: ['pet_land', 0.5], owl_happy: ['pet_happy', 0.55],
    owl_snore: ['pet_snore', 0.4], owl_yawn: ['yawn', 0.6], owl_rustle: ['rustle_bush', 0.4], step: ['step_wood', 0.25],
  };
  const m = map[id];
  if (m) sound.play(m[0], { volume: m[1], gap: 120 });
  else if (sound.has(id)) sound.play(id, { volume: 0.4, gap: 200 });
}
