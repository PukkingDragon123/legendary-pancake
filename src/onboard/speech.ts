// Pip's words, floating in the office (the shared dialogue engine, ui/talk.ts): chunky pixel letters in warm cream
// with a gold name tag, hanging near the top of the picture with no box behind them, at full device resolution.
// They type with a person's rhythm and a soft voice, *highlights* glow gold, !screams! slam in red-hot and
// tremble, _whispers_ come small and pale. The words lag a little behind the camera's moves (they hang in the
// room, not on the glass) and the old line drifts back and away as the next arrives.
import * as THREE from 'three';
import { TalkView } from '../ui/talk.ts';

/** body text size (CSS px) and widest line for this screen */
const sizeFor = () => (innerWidth < 600 ? 26 : innerWidth < 1000 ? 30 : 34);
const widthFor = () => Math.min(innerWidth - 12, innerWidth < 600 ? 560 : 900);

export class Speech {
  /** kept for the stage (the words are a DOM canvas over the picture now) */
  readonly group = new THREE.Group();
  readonly view: TalkView;
  /** CSS px per texel of the picture (unused: the words are always drawn at device resolution) */
  px = 1;
  onDone: (() => void) | null = null;
  onTalk: (() => void) | null = null;
  /** where on screen the top of the words hangs (NDC y) */
  topNdc = 0.9;
  private host = document.createElement('div');
  private look: THREE.Vector3 | null = null;
  private w = 0; private h = 0;

  constructor() {
    this.view = new TalkView({ size: sizeFor(), maxWidth: widthFor(), anchor: 'top', align: 'center', voice: 'pip', scrim: 0.2, tag: true });
    this.view.onDone = () => this.onDone?.();
    this.view.onBlip = () => this.onTalk?.();
    Object.assign(this.host.style, { position: 'fixed', left: '0', top: '0', zIndex: '3', pointerEvents: 'none', display: 'none' });
    this.host.className = 'hh-speech';
    this.host.appendChild(this.view.canvas);
    document.body.appendChild(this.host);
  }

  /** Say a line (null clears). `instant` shows it at once. */
  say(text: string | null, who = 'PIP', instant = false) {
    this.view.say(text, { who, instant });
    if (text) this.host.style.display = '';
  }
  /** Show the whole line now (a tap while it types). */
  finish() { this.view.finish(); }
  get typing() { return this.view.typing; }
  get done() { return !this.view.typing; }

  update(dt: number, cam: THREE.PerspectiveCamera) {
    if (innerWidth !== this.w || innerHeight !== this.h) { this.w = innerWidth; this.h = innerHeight; this.view.set({ size: sizeFor(), maxWidth: widthFor() }); }
    // the room moved behind the words: where last frame's centre of view lands now (a cut is not a move)
    cam.updateMatrixWorld();
    if (this.look) {
      const p = this.look.clone().project(cam), dx = (p.x * innerWidth) / 2, dy = (-p.y * innerHeight) / 2;
      if (Math.abs(dx) < 50 && Math.abs(dy) < 50 && p.z < 1) this.view.drift(dx * 0.22, dy * 0.22);
    }
    this.look = cam.getWorldDirection(new THREE.Vector3()).multiplyScalar(2.5).add(cam.position);
    if (this.view.idle) { this.host.style.display = 'none'; return; }
    this.view.step(dt);
    const top = Math.round(((1 - this.topNdc) / 2) * innerHeight);
    this.host.style.transform = `translate(${Math.round((innerWidth - this.view.cssW) / 2)}px, ${Math.max(top, 4)}px)`;
  }
  /** height of the words on screen (CSS px) */
  get height() { return this.view.idle ? 0 : this.view.cssH; }
  dispose() { this.view.dispose(); this.host.remove(); }
}
