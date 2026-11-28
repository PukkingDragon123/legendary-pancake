// [tutor] Pip as the tour's guide: the real 3D owl (your species, coat and outfit, with his whole OwlActor life:
// blinks, glances, moods, wingbeats) drawn into one small transparent WebGL canvas that flies over the interface.
// He flies in arcs from one thing to the next with full wingbeats on the climb and a glide on the way down, banks
// into his turns, flares and lands with a squash on top of the thing to tap (or hovers beside it when there is
// nothing to stand on), turns his head between the button and you, and points with a wing.
// Screen space: (x, y) is the point between his feet, in CSS px; `size` is his standing height in CSS px.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sceneSound } from '../../audio/sound.ts';
import { OwlActor, type OwlAction, type OwlMood } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';

export type PerchMode = 'perch' | 'hover';
export interface Goal {
  x: number; y: number; mode: PerchMode;
  /** which way the thing he shows is: -1 left, 1 right, 0 below him (he stands on it) or nothing */
  face: -1 | 0 | 1;
  /** the screen point he shows (for his eyes and his wing) */
  at?: { x: number; y: number } | null;
}

/** canvas size / standing height, and where his feet sit in the canvas (fractions of its side) */
const SPAN = 2.5, FEET_Y = 0.7;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class GuideOwl {
  /** the pointing wing's twist and forward swing (radians) */
  static twist = -0.9;
  static swing = 0.3;
  readonly canvas: HTMLCanvasElement;
  private R: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: THREE.OrthographicCamera;
  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  readonly actor: OwlActor;
  private body = new THREE.Group();
  private look0 = '';
  /** standing height, CSS px */
  size: number;
  private px = 0;
  x = -200; y = -200;
  visible = false;
  /** where he is going (null: nowhere, he stays) */
  goal: Goal | null = null;
  /** he is on his goal and settled */
  arrived = false;
  private flight: { fx: number; fy: number; cx: number; cy: number; t: number; dur: number } | null = null;
  private vx = 0; private vy = 0;
  private yaw = 0.25; private tilt = 0; private bank = 0;
  private squash = 0; private squashV = 0;
  private time = 0;
  private gaze = 0;
  private nextGaze = 1.2;
  /** looking at you (true) or at the thing (false) while perched */
  private atYou = true;
  private pointing = 0;
  /** an action asked for while flying waits for the landing */
  private queued: OwlAction | null = null;
  onLand?: () => void;

  constructor(look: OwlLook, size: number) {
    this.size = size;
    const c = (this.canvas = document.createElement('canvas'));
    c.className = 'tt-pip';
    this.R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    this.R.setClearColor(0x000000, 0);
    this.R.outputColorSpace = THREE.SRGBColorSpace;
    this.R.toneMapping = THREE.ACESFilmicToneMapping;
    this.R.toneMappingExposure = 1.12;
    const pm = new THREE.PMREMGenerator(this.R);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.3;
    pm.dispose();
    // the HUD's light: a warm key from the upper left, a soft sky fill, a cool rim to lift him off the wood
    this.hemi = new THREE.HemisphereLight(0xfff2e0, 0xa08868, 1.6);
    this.key = new THREE.DirectionalLight(0xffe8c8, 2.7);
    this.key.position.set(-3, 5, 6);
    const rim = new THREE.DirectionalLight(0xd4e4ff, 1.1);
    rim.position.set(4, 3, -4);
    this.scene.add(this.hemi, this.key, rim);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
    this.cam.position.set(0, 0, 12);
    this.cam.lookAt(0, 0, 0);
    this.actor = new OwlActor(look, { sound: (id) => { if (this.visible) sceneSound('owl_' + id); } });
    this.look0 = JSON.stringify(look);
    this.body.add(this.actor.node);
    this.scene.add(this.body);
    void this.actor.ready.then(() => this.fit());
    this.resize(size);
  }

  /** his height on screen (CSS px); the canvas follows at the screen's own resolution (up to 2x) */
  resize(size: number) {
    this.size = size;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const css = Math.round(size * SPAN), px = Math.round(css * dpr);
    if (px !== this.px) {
      this.px = px;
      this.R.setPixelRatio(1);
      this.R.setSize(px, px, false);
      this.canvas.style.width = this.canvas.style.height = `${css}px`;
    }
    const half = SPAN / 2;
    this.cam.left = -half; this.cam.right = half; this.cam.top = SPAN * FEET_Y; this.cam.bottom = -SPAN * (1 - FEET_Y);
    this.cam.updateProjectionMatrix();
  }

  /** one unit of world = his standing height */
  private fit() {
    const h = this.actor.height || 1;
    this.actor.node.scale.setScalar(1 / h);
  }

  setLook(look: OwlLook) {
    const k = JSON.stringify(look);
    if (k === this.look0) return;
    this.look0 = k;
    this.actor.rebuild(look);
    void this.actor.ready.then(() => this.fit());
  }

  /** the box he takes on screen (CSS px), standing */
  box(): { x: number; y: number; w: number; h: number } { const s = this.size; return { x: this.x - s * 0.42, y: this.y - s * 1.05, w: s * 0.84, h: s * 1.05 }; }
  /** the tip of his pointing wing, about (CSS px) */
  wingTip(): { x: number; y: number } {
    const g = this.goal, s = this.size;
    if (!g || !this.arrived) return { x: this.x, y: this.y - s * 0.55 };
    if (g.mode === 'perch' && g.face === 0) return { x: this.x, y: this.y };
    return { x: this.x + (g.face || 1) * s * 0.5, y: this.y - s * 0.62 };
  }
  get flying() { return !!this.flight; }

  /** appear here at once (flying), e.g. out of a puff where the 3D owl stood */
  spawn(x: number, y: number) {
    this.x = x; this.y = y; this.vx = this.vy = 0;
    this.visible = true;
    this.arrived = false;
    this.actor.pose = 'fly';
    this.actor.wingbeat = 1;
    this.canvas.style.visibility = 'visible';
  }
  hide() { this.visible = false; this.flight = null; this.goal = null; this.arrived = false; this.canvas.style.visibility = 'hidden'; }

  /** fly to a goal (a new one replaces the old; a small nudge of the same goal just slides him) */
  go(g: Goal) {
    const old = this.goal;
    this.goal = g;
    if (!this.visible) return;
    const d = Math.hypot(g.x - this.x, g.y - this.y);
    if (old && !this.flight && d < 14 && old.mode === g.mode) { this.x = g.x; this.y = g.y; return; }
    if (this.flight && old && Math.hypot(g.x - old.x, g.y - old.y) < 14) return;
    this.arrived = false;
    // an arc: up and over, higher for longer trips
    const mx = (this.x + g.x) / 2, my = (this.y + g.y) / 2;
    const lift = Math.min(170, 40 + d * 0.32);
    this.flight = { fx: this.x, fy: this.y, cx: mx, cy: Math.min(this.y, g.y) - lift + (my - Math.min(this.y, g.y)) * 0.3, t: 0, dur: clamp(0.5 + d / 1000, 0.65, 1.5) };
    if (this.actor.pose !== 'fly') { this.actor.pose = 'fly'; this.actor.wingbeat = 1; this.squashV -= 3; sceneSound('owl_flap'); }
    this.actor.hold = null;
  }

  /** a little reaction: hop, flap, dance, present... (after the landing if he is in the air) */
  play(a: OwlAction, mood?: OwlMood) {
    if (mood) this.actor.setMood(mood, 2.2);
    if (this.flight || this.actor.pose === 'fly') { this.queued = a; return; }
    this.actor.play(a);
  }
  /** a tap on him */
  poke() { if (!this.flight) this.actor.poke(); }
  /** "over here!": a hop and a look at the thing */
  nudge() { this.atYou = false; this.nextGaze = 1.6; if (!this.flight && this.actor.pose === 'stand') this.actor.play('hop'); else this.squashV -= 2.5; }
  /** look at you now (while he talks) */
  lookUp() { this.atYou = true; this.nextGaze = 2.2; }

  step(dt: number, draw = true) {
    if (!this.visible) return;
    this.time += dt;
    const a = this.actor, g = this.goal, s = this.size;
    let wantYaw = 0.22, wantTilt = 0, wantBank = 0, bob = 0;
    if (this.flight && g) {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = ease(f.t), u = 1 - e;
      const nx = u * u * f.fx + 2 * u * e * f.cx + e * e * g.x, ny = u * u * f.fy + 2 * u * e * f.cy + e * e * g.y;
      const vx = (nx - this.x) / Math.max(1e-3, dt), vy = (ny - this.y) / Math.max(1e-3, dt);
      const ax = (vx - this.vx) / Math.max(1e-3, dt), ay = (vy - this.vy) / Math.max(1e-3, dt);
      this.vx = vx; this.vy = vy; this.x = nx; this.y = ny;
      const sp = Math.hypot(vx, vy);
      const dir = Math.abs(vx) > 30 ? Math.sign(vx) : Math.sign(this.yaw) || 1;
      wantYaw = dir * 0.85;
      // nose along the path (climbing up, gliding down), and a flare at the end
      wantTilt = -dir * clamp(Math.atan2(vy, Math.abs(vx) + 1) * 0.55, -0.5, 0.45) + (f.t > 0.82 ? dir * 0.35 * (f.t - 0.82) / 0.18 : 0);
      // bank into the turn (the curve's sideways pull)
      wantBank = sp > 40 ? clamp(((vx * ay - vy * ax) / (sp * sp)) * 0.09, -0.55, 0.55) : 0;
      a.wingbeat = vy < -60 || f.t < 0.25 || f.t > 0.8 ? 1 : 0.4;
      a.flapRate = f.t > 0.8 ? 1.35 : 1;
      if (f.t >= 1) {
        this.flight = null;
        this.vx = this.vy = 0;
        this.arrived = true;
        this.atYou = true; this.nextGaze = 1.4;
        if (g.mode === 'perch') { a.pose = 'stand'; this.squashV -= 5; sceneSound('owl_land'); a.setMood('happy', 1.5); }
        this.onLand?.();
        if (this.queued && a.pose === 'stand') { a.play(this.queued); this.queued = null; }
      }
    } else if (g) {
      // settled: perched or hovering; looking between you and the thing
      if (g.mode === 'hover') {
        a.pose = 'fly'; a.wingbeat = 0.55; a.flapRate = 0.8;
        bob = Math.sin(this.time * 2.6) * s * 0.035;
        wantYaw = g.face ? g.face * 0.75 : 0.22; wantTilt = -0.1 * (g.face || 0);
      } else {
        wantYaw = g.face ? g.face * 0.42 : 0.22;
      }
      if ((this.nextGaze -= dt) <= 0) { this.atYou = !this.atYou; this.nextGaze = this.atYou ? 2.4 + Math.random() * 1.4 : 1.6 + Math.random(); }
    }
    // point with the wing on the thing's side while he looks at it (standing); otherwise wings at rest
    const point = !this.flight && g && g.mode === 'perch' && g.face !== 0 && g.at && !this.atYou ? 1 : 0;
    this.pointing = lerp(this.pointing, point, 1 - Math.exp(-dt * 8));
    if (a.pose === 'stand' && g && g.face !== 0 && this.pointing > 0.02) {
      const up = g.at ? clamp((this.y - s * 0.6 - g.at.y) / s, -0.6, 1) : 0.3;
      const w = this.pointing * (1.15 + up * 0.35);
      a.hold = g.face > 0 ? { wingR: w } : { wingL: w };
    } else if (a.pose === 'stand') a.hold = null;
    // eyes: on you, or on the thing
    const at = g?.at && !this.atYou && !this.flight ? g.at : null;
    a.lookAt = at ? new THREE.Vector3((at.x - this.x) / s, (this.y - at.y) / s, 0.9) : !this.flight ? new THREE.Vector3(-0.05, 0.75, 6) : null;
    a.still = !!this.flight;
    // springs of the whole body
    const k = 1 - Math.exp(-dt * 7);
    this.yaw = lerp(this.yaw, wantYaw, k);
    this.tilt = lerp(this.tilt, wantTilt, k);
    this.bank = lerp(this.bank, wantBank, 1 - Math.exp(-dt * 5));
    this.squashV += (-this.squash * 220 - this.squashV * 14) * dt;
    this.squash += this.squashV * dt;
    // the body: a screen-plane tilt, then his heading, then the bank about his own forward axis
    this.body.rotation.set(0, 0, this.tilt);
    this.actor.node.rotation.set(0.1, this.yaw, 0, 'YXZ');
    this.actor.node.rotateZ(this.bank);
    const n = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < n; i++) a.update(dt / n);
    // the pointing wing turns its face to you (a twist about its own length), so it reads as a wing, not a stick
    if (a.hold && this.pointing > 0.02 && g) {
      const B = a.model.rig.bones, wing = g.face > 0 ? B.wingR : B.wingL;
      wing.rotation.x = GuideOwl.twist * this.pointing;
      wing.rotation.y = (g.face > 0 ? -1 : 1) * GuideOwl.swing * this.pointing;
    }
    // place the canvas: his feet on (x, y), squashed on landings
    const css = Math.round(s * SPAN), d = Math.min(2, devicePixelRatio || 1);
    const sq = clamp(this.squash * 0.06, -0.16, 0.16);
    const left = Math.round((this.x - css / 2) * d) / d, top = Math.round((this.y + bob - css * FEET_Y) * d) / d;
    this.canvas.style.transform = `translate3d(${left}px, ${top}px, 0) scale(${1 - sq * 0.6}, ${1 + sq})`;
    this.canvas.style.transformOrigin = `50% ${FEET_Y * 100}%`;
    if (!a.model.loaded || !draw) return;
    this.R.clear();
    this.R.render(this.scene, this.cam);
  }

  /** night or day light, like the room */
  setNight(n: boolean) { this.hemi.color.setHex(n ? 0xdfe6ff : 0xfff2e0); this.key.color.setHex(n ? 0xe4e8ff : 0xffe8c8); this.actor.dark = n ? 0.6 : 0; }

  dispose() {
    this.actor.dispose();
    this.scene.environment?.dispose();
    this.R.dispose();
    this.R.forceContextLoss();
    this.canvas.remove();
  }
}
