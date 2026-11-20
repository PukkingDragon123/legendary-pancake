// Browser glue: microphone -> FrameAnalyzer, plus screen wake lock, iOS/Safari resume handling and optional clips.
//
// Honest platform notes:
// - Browsers only capture audio while the page is alive. iOS Safari stops the microphone when the screen locks or the
//   app is backgrounded, so on iPhone the screen must stay on (we hold a Screen Wake Lock; iOS 16.4+ supports it). On
//   Android Chrome capture keeps running with the tab in the foreground; a wake lock stops the screen from sleeping.
//   Desktop browsers keep recording in background tabs.
// - If the system interrupts audio (phone call, Siri, another app), the AudioContext is suspended. We try to resume on
//   every visibility change and on the next tap; time without audio becomes a gap in the epochs, never invented data.
// - Processing is ~10 small FFTs/s; memory is bounded: ~1,200 epochs per 10 h, events capped at 20,000, and the clip
//   ring buffer is 24 s of 16 kHz 16-bit audio (~770 KB).

import { FrameAnalyzer, LIGHT_SLEEP_ACTIVITY } from './analyzer.ts';
import { encodeWav, newClipId, saveClip } from './clips.ts';
import type { Epoch, LiveLevel, SleepEvent } from './types.ts';

export type StartResult = 'ok' | 'denied' | 'unsupported' | 'error';
export type RecorderStatus = 'idle' | 'running' | 'paused' | 'interrupted' | 'stopped';

export interface RecorderOptions {
  onLevel?: (l: LiveLevel) => void;
  onEvent?: (e: SleepEvent) => void;
  onEpoch?: (e: Epoch) => void;
  /** 0..1, default 0.5 */
  sensitivity?: number;
  /** save short WAV clips of snoring / sleep talk to IndexedDB (max 20 per night, <= 8 s each) */
  recordClips?: boolean;
  /** stored with clips so they can be listed per night (default: a generated id) */
  sessionId?: string;
  /** epoch grid anchor; pass session.start so stages and epochs line up (default: when start() is called) */
  origin?: number;
  /** recording state changes (interruptions, resumes) */
  onStatus?: (s: RecorderStatus) => void;
}

const MAX_EVENTS = 20_000;
const MAX_CLIPS = 20;
const CLIP_TARGET_RATE = 16_000;
const RING_SEC = 24; // snores are confirmed a few seconds after they end, so keep more than the 6-8 s we save
const CLIP_MAX_MS = 8_000;
const CLIP_PRE_MS = 1_500;
const CLIP_POST_MS = 500;
const SNORE_CLIP_EVERY_MS = 15 * 60_000; // spread snore clips over the night
const TALK_CLIP_EVERY_MS = 60_000;
const REANCHOR_MS = 1_500;

// AudioWorklet that batches 128-sample render quanta into 4096-sample chunks and posts them (transferring the buffer).
const WORKLET_SRC = `
class HootTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 4096; this.buf = new Float32Array(this.size); this.n = 0; this.alive = true;
    this.port.onmessage = (e) => { if (e.data === 'stop') this.alive = false; };
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      let i = 0;
      while (i < ch.length) {
        const k = Math.min(ch.length - i, this.size - this.n);
        this.buf.set(ch.subarray(i, i + k), this.n);
        this.n += k; i += k;
        if (this.n === this.size) {
          this.port.postMessage(this.buf, [this.buf.buffer]);
          this.buf = new Float32Array(this.size); this.n = 0;
        }
      }
    }
    return this.alive;
  }
}
registerProcessor('hoot-tap', HootTap);
`;

type AudioContextCtor = typeof AudioContext;

export class SleepRecorder {
  readonly sessionId: string;
  private readonly opts: RecorderOptions;
  private readonly analyzer: FrameAnalyzer;
  private readonly epochs: Epoch[] = [];
  private readonly events: SleepEvent[] = [];

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private tap: AudioWorkletNode | ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private workletUrl: string | null = null;
  private _running = false;
  private _paused = false;
  private _status: RecorderStatus = 'idle';
  private wakeLock: WakeLockSentinel | null = null;
  private clockT = 0;
  private cleanups: (() => void)[] = [];

  // clip ring buffer (decimated to ~16 kHz, int16)
  private ring: Int16Array | null = null;
  private ringPos = 0;
  private ringCount = 0;
  private ringDec = 1;
  private ringRate = 0;
  private decAcc = 0;
  private decN = 0;
  private ringEndT = 0;
  private clipCount = 0;
  private lastSnoreClip = -Infinity;
  private lastTalkClip = -Infinity;

  constructor(opts: RecorderOptions = {}) {
    this.opts = opts;
    this.sessionId = opts.sessionId ?? newClipId();
    this.analyzer = new FrameAnalyzer({
      sensitivity: opts.sensitivity,
      origin: opts.origin,
      onLevel: (l) => {
        if (typeof document === 'undefined' || document.visibilityState !== 'hidden') this.opts.onLevel?.(l);
      },
      onEvent: (e) => this.handleEvent(e),
      onEpoch: (e) => {
        this.epochs.push(e);
        this.opts.onEpoch?.(e);
      },
    });
  }

  get running(): boolean {
    return this._running;
  }
  get paused(): boolean {
    return this._paused;
  }
  get status(): RecorderStatus {
    return this._status;
  }
  get wakeLockActive(): boolean {
    return !!this.wakeLock && !this.wakeLock.released;
  }
  get sensitivity(): number {
    return this.analyzer.sensitivity;
  }
  set sensitivity(v: number) {
    this.analyzer.sensitivity = v;
  }
  /** epochs / events recorded so far (live views; do not mutate) */
  get epochList(): readonly Epoch[] {
    return this.epochs;
  }
  get eventList(): readonly SleepEvent[] {
    return this.events;
  }
  /** 0..1 non-snore sound activity over the last `minutes` (see FrameAnalyzer.recentActivity) */
  recentActivity(minutes = 5): number {
    return this.analyzer.recentActivity(minutes);
  }
  /** Ready-made predicate for AlarmClock.schedule({ isLight }) */
  isLightSleep = (minutes = 5, threshold = LIGHT_SLEEP_ACTIVITY): boolean => this.analyzer.recentActivity(minutes) > threshold;

  /** Must be called from a user gesture (tap) so Safari lets audio start. */
  async start(): Promise<StartResult> {
    if (this._running) return 'ok';
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unsupported';
    const AC: AudioContextCtor | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!AC) return 'unsupported';

    // Create (and resume) the context synchronously inside the gesture; the permission prompt may outlast it.
    let ctx: AudioContext;
    try {
      ctx = new AC({ latencyHint: 'playback' });
    } catch {
      try {
        ctx = new AC();
      } catch {
        return 'error';
      }
    }
    const resumed = ctx.resume().catch(() => undefined);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
        video: false,
      });
    } catch (err) {
      void ctx.close().catch(() => undefined);
      const name = (err as { name?: string } | null)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'NotSupportedError' || name === 'OverconstrainedError') return 'unsupported';
      return 'error';
    }

    try {
      await resumed;
      this.ctx = ctx;
      this.stream = stream;
      this.source = ctx.createMediaStreamSource(stream);
      this.sink = ctx.createGain();
      this.sink.gain.value = 0; // keep the graph pulled without making a sound
      this.sink.connect(ctx.destination);
      this.tap = await this.createTap(ctx);
      this.source.connect(this.tap);
      this.tap.connect(this.sink);
      if (this.opts.recordClips) this.initRing(ctx.sampleRate);
      this.clockT = 0;
      this._running = true;
      this._paused = false;
      this.watch(ctx, stream);
      void this.requestWakeLock();
      this.setStatus(ctx.state === 'running' ? 'running' : 'interrupted');
      return 'ok';
    } catch (err) {
      console.error('[recorder] audio graph setup failed', err);
      this.teardown();
      return 'error';
    }
  }

  /** Stop recording and return everything captured (the open epoch is flushed as a partial one). */
  stop(): { epochs: Epoch[]; events: SleepEvent[] } {
    if (this._running) this.analyzer.flush();
    this.teardown();
    this._running = false;
    this._paused = false;
    this.setStatus('stopped');
    return { epochs: this.epochs.slice(), events: this.events.slice() };
  }

  /** Pause analysis (e.g. a bathroom trip). The paused time becomes a gap, not quiet sleep. */
  pause(): void {
    if (!this._running || this._paused) return;
    this._paused = true;
    void this.ctx?.suspend().catch(() => undefined);
    this.setStatus('paused');
  }

  resume(): void {
    if (!this._running || !this._paused) return;
    this._paused = false;
    void this.ensureRunning();
  }

  // ------------------------------------------------------------------ audio

  private async createTap(ctx: AudioContext): Promise<AudioWorkletNode | ScriptProcessorNode> {
    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        const url = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' }));
        this.workletUrl = url;
        await ctx.audioWorklet.addModule(url);
        const node = new AudioWorkletNode(ctx, 'hoot-tap', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
          channelCountMode: 'explicit',
          channelInterpretation: 'speakers',
        });
        node.port.onmessage = (e: MessageEvent) => {
          if (e.data instanceof Float32Array) this.onAudio(e.data);
        };
        return node;
      } catch (err) {
        // e.g. a Content-Security-Policy without blob: in script-src; fall back below
        console.warn('[recorder] AudioWorklet unavailable, using ScriptProcessorNode', err);
      }
    }
    const sp = ctx.createScriptProcessor(4096, 1, 1);
    sp.onaudioprocess = (e: AudioProcessingEvent) => this.onAudio(e.inputBuffer.getChannelData(0));
    return sp;
  }

  private onAudio(frame: Float32Array): void {
    if (!this._running || this._paused || !this.ctx) return;
    const sr = this.ctx.sampleRate;
    const durMs = (frame.length * 1000) / sr;
    // Sample-count clock, re-anchored to the wall clock after suspensions or drift (> 1.5 s).
    const wallStart = Date.now() - durMs;
    const t = this.clockT === 0 || Math.abs(wallStart - this.clockT) > REANCHOR_MS ? wallStart : this.clockT;
    this.clockT = t + durMs;
    if (this.ring) this.writeRing(frame, t + durMs);
    this.analyzer.push(frame, sr, t);
  }

  private initRing(sr: number): void {
    this.ringDec = Math.max(1, Math.round(sr / CLIP_TARGET_RATE));
    this.ringRate = sr / this.ringDec;
    this.ring = new Int16Array(Math.ceil(this.ringRate * RING_SEC));
    this.ringPos = this.ringCount = this.decN = 0;
    this.decAcc = 0;
  }

  /** Boxcar-decimate to ~16 kHz and append to the ring. */
  private writeRing(frame: Float32Array, endT: number): void {
    const ring = this.ring!, cap = ring.length, dec = this.ringDec;
    for (let i = 0; i < frame.length; i++) {
      this.decAcc += frame[i];
      if (++this.decN < dec) continue;
      const v = this.decAcc / dec;
      this.decAcc = 0;
      this.decN = 0;
      ring[this.ringPos] = v >= 1 ? 32767 : v <= -1 ? -32768 : Math.round(v * 32767);
      this.ringPos = (this.ringPos + 1) % cap;
      this.ringCount++;
    }
    this.ringEndT = endT;
  }

  private handleEvent(ev: SleepEvent): void {
    if (this.ring && this.clipCount < MAX_CLIPS && (ev.kind === 'snore' || ev.kind === 'talk')) {
      const due = ev.kind === 'snore' ? ev.t - this.lastSnoreClip >= SNORE_CLIP_EVERY_MS : ev.t - this.lastTalkClip >= TALK_CLIP_EVERY_MS;
      if (due) {
        const id = this.saveClipFor(ev);
        if (id) {
          ev.clipId = id;
          this.clipCount++;
          if (ev.kind === 'snore') this.lastSnoreClip = ev.t;
          else this.lastTalkClip = ev.t;
        }
      }
    }
    if (this.events.length < MAX_EVENTS) this.events.push(ev);
    this.opts.onEvent?.(ev);
  }

  /** Cut [event start - 1.5 s, event end + 0.5 s] (max 8 s) from the ring and save it as WAV; returns the clip id. */
  private saveClipFor(ev: SleepEvent): string | null {
    const ring = this.ring;
    if (!ring || this.ringRate <= 0) return null;
    const cap = ring.length, rate = this.ringRate;
    const available = Math.min(this.ringCount, cap);
    const oldestT = this.ringEndT - (available * 1000) / rate;
    const from = Math.max(ev.t - CLIP_PRE_MS, oldestT);
    const to = Math.min(ev.t + ev.dur * 1000 + CLIP_POST_MS, from + CLIP_MAX_MS, this.ringEndT);
    if (to - from < 300 || ev.t + ev.dur * 1000 < oldestT) return null;
    const backFrom = Math.min(available, Math.round(((this.ringEndT - from) * rate) / 1000));
    const backTo = Math.max(0, Math.round(((this.ringEndT - to) * rate) / 1000));
    const len = backFrom - backTo;
    if (len <= 0) return null;
    const pcm = new Int16Array(len);
    const startPos = (((this.ringPos - backFrom) % cap) + cap) % cap;
    for (let i = 0; i < len; i++) pcm[i] = ring[(startPos + i) % cap];
    const id = newClipId();
    saveClip(encodeWav(pcm, rate), { id, sessionId: this.sessionId, t: ev.t, kind: ev.kind, dur: ev.dur }).catch((err) =>
      console.warn('[recorder] could not save clip', err),
    );
    return id;
  }

  // ------------------------------------------------------------------ lifecycle & platform quirks

  private watch(ctx: AudioContext, stream: MediaStream): void {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !this._running) return;
      void this.ensureRunning();
      void this.requestWakeLock();
    };
    const onGesture = () => {
      if (this._running && !this._paused && this.ctx && this.ctx.state !== 'running') void this.ensureRunning();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('pointerdown', onGesture, true);
    window.addEventListener('keydown', onGesture, true);
    ctx.onstatechange = () => {
      if (!this._running || this._paused) return;
      if (ctx.state === 'running') this.setStatus('running');
      else {
        // 'suspended' or Safari's 'interrupted' (calls, Siri, other audio apps)
        this.setStatus('interrupted');
        void ctx.resume().catch(() => undefined);
      }
    };
    this.watchTracks(stream);
    this.cleanups.push(() => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('pointerdown', onGesture, true);
      window.removeEventListener('keydown', onGesture, true);
      ctx.onstatechange = null;
    });
  }

  private watchTracks(stream: MediaStream): void {
    for (const track of stream.getAudioTracks()) {
      track.onended = () => {
        if (!this._running) return;
        this.setStatus('interrupted');
        if (document.visibilityState === 'visible') void this.ensureRunning();
      };
      track.onmute = () => {
        if (this._running && !this._paused) this.setStatus('interrupted');
      };
      track.onunmute = () => {
        if (this._running && !this._paused && this.ctx?.state === 'running') this.setStatus('running');
      };
    }
  }

  /** Resume a suspended context and re-open the microphone if the OS ended the track. */
  private async ensureRunning(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this._running || this._paused) return;
    if (ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    const live = this.stream?.getAudioTracks().some((t) => t.readyState === 'live');
    if (!live) await this.reopenMic();
    if (ctx.state === 'running' && this.stream?.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted)) this.setStatus('running');
  }

  private async reopenMic(): Promise<void> {
    if (!this.ctx || !this.tap) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
        video: false,
      });
      if (!this._running || !this.ctx) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.source?.disconnect();
      this.stream?.getTracks().forEach((t) => t.stop());
      this.stream = stream;
      this.source = this.ctx.createMediaStreamSource(stream);
      this.source.connect(this.tap);
      this.watchTracks(stream);
    } catch (err) {
      console.warn('[recorder] could not reopen the microphone', err);
      this.setStatus('interrupted');
    }
  }

  private async requestWakeLock(): Promise<void> {
    if (!this._running || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible' || this.wakeLockActive) return;
    try {
      const sentinel = await navigator.wakeLock.request('screen');
      if (!this._running) {
        void sentinel.release().catch(() => undefined);
        return;
      }
      this.wakeLock = sentinel;
      // The browser drops the lock when the page is hidden; onVisible re-acquires it.
      sentinel.addEventListener('release', () => {
        if (this.wakeLock === sentinel) this.wakeLock = null;
      });
    } catch {
      this.wakeLock = null; // denied (battery saver, not visible, policy)
    }
  }

  private teardown(): void {
    for (const c of this.cleanups.splice(0)) c();
    if (this.tap && 'port' in this.tap) {
      this.tap.port.postMessage('stop');
      this.tap.port.onmessage = null;
    } else if (this.tap) this.tap.onaudioprocess = null;
    try {
      this.source?.disconnect();
      this.tap?.disconnect();
      this.sink?.disconnect();
    } catch {
      /* already disconnected */
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== 'closed') void this.ctx.close().catch(() => undefined);
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl);
    if (this.wakeLock) void this.wakeLock.release().catch(() => undefined);
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.tap = null;
    this.sink = null;
    this.workletUrl = null;
    this.wakeLock = null;
    this.ring = null;
  }

  private setStatus(s: RecorderStatus): void {
    if (s === this._status) return;
    this._status = s;
    try {
      this.opts.onStatus?.(s);
    } catch (err) {
      console.error('[recorder] onStatus failed', err);
    }
  }
}
