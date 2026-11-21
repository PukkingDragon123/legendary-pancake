// Pip's body language. Every moving part is a damped spring chasing a target, so motion overshoots
// and settles like something soft and alive. Layers stack on top of each other: a mood sets the
// face and posture, an action plays a short clip (hop, dance, yawn...), idle life adds breathing,
// blinks, glances and head tilts, and the breathing exercise can drive the chest directly.
import * as THREE from 'three';
import { PX } from '../gfx/box.ts';
import { defaultEye, type EyeMode, type EyeState } from './eyes.ts';
import { buildOwl, type OwlLook, type OwlModel } from './model.ts';

export type OwlMood = 'neutral' | 'happy' | 'joy' | 'sleepy' | 'asleep' | 'surprised' | 'love' | 'proud' | 'curious' | 'sad' | 'worried' | 'dizzy' | 'calm' | 'excited';
export type OwlAction = 'none' | 'hop' | 'dance' | 'ruffle' | 'yawn' | 'spin' | 'wave' | 'nod' | 'peck' | 'present' | 'stretch' | 'flap' | 'shiver';
export type OwlPose = 'stand' | 'sleep' | 'fly' | 'breathe' | 'sit';
export type OwlFx = 'feather' | 'zzz' | 'heart' | 'note' | 'sparkle' | 'dust' | 'tear';
export type OwlSound = 'hoot' | 'flap' | 'hop' | 'land' | 'happy' | 'snore' | 'yawn' | 'rustle';

/** A critically-damped-ish spring for one channel. */
class Spring {
  v = 0;
  constructor(public x = 0, public target = 0, public k = 120, public d = 14) {}
  step(dt: number) {
    const a = (this.target - this.x) * this.k - this.v * this.d;
    this.v += a * dt;
    this.x += this.v * dt;
    return this.x;
  }
  kick(v: number) { this.v += v; }
  snap(x: number) { this.x = this.target = x; this.v = 0; }
}

interface Face { lid: number; low: number; tilt: number; pupil: number; mode: EyeMode; brow: number; browTilt: number; tuft: number; jaw: number; pitch: number; roll: number; tear?: boolean }
const FACES: Record<OwlMood, Face> = {
  neutral: { lid: 0, low: 0, tilt: 0, pupil: 5, mode: 'normal', brow: 0, browTilt: 0, tuft: 0, jaw: 0, pitch: 0, roll: 0 },
  happy: { lid: 0.06, low: 0.32, tilt: -0.1, pupil: 5.5, mode: 'normal', brow: 0.4, browTilt: -0.2, tuft: 0.25, jaw: 0, pitch: -0.04, roll: 0.06 },
  joy: { lid: 0, low: 0, tilt: 0, pupil: 5, mode: 'happy', brow: 0.6, browTilt: -0.2, tuft: 0.4, jaw: 0.5, pitch: -0.1, roll: 0 },
  sleepy: { lid: 0.56, low: 0.08, tilt: -0.15, pupil: 6.5, mode: 'normal', brow: -0.2, browTilt: -0.15, tuft: -0.55, jaw: 0, pitch: 0.12, roll: 0.1 },
  asleep: { lid: 1, low: 0, tilt: 0, pupil: 5, mode: 'closed', brow: -0.3, browTilt: 0, tuft: -0.85, jaw: 0, pitch: 0.24, roll: 0.06 },
  surprised: { lid: 0, low: 0, tilt: 0, pupil: 3, mode: 'wide', brow: 1, browTilt: 0, tuft: 0.7, jaw: 0.7, pitch: -0.08, roll: 0 },
  love: { lid: 0.08, low: 0.2, tilt: 0, pupil: 5, mode: 'heart', brow: 0.5, browTilt: -0.3, tuft: 0.3, jaw: 0.15, pitch: -0.05, roll: 0.14 },
  proud: { lid: 0.34, low: 0.3, tilt: 0.05, pupil: 5, mode: 'normal', brow: 0.2, browTilt: 0.2, tuft: 0.45, jaw: 0, pitch: -0.18, roll: 0 },
  curious: { lid: 0.04, low: 0, tilt: 0, pupil: 6.6, mode: 'normal', brow: 0.6, browTilt: 0.5, tuft: 0.35, jaw: 0, pitch: 0, roll: 0.36 },
  sad: { lid: 0.3, low: 0, tilt: -0.75, pupil: 6.8, mode: 'normal', brow: -0.1, browTilt: -0.8, tuft: -0.9, jaw: 0, pitch: 0.16, roll: 0.05, tear: true },
  worried: { lid: 0.1, low: 0, tilt: -0.6, pupil: 4, mode: 'normal', brow: 0.4, browTilt: -0.8, tuft: -0.4, jaw: 0, pitch: 0.04, roll: -0.05 },
  dizzy: { lid: 0, low: 0, tilt: 0, pupil: 5, mode: 'spiral', brow: 0.3, browTilt: 0, tuft: -0.2, jaw: 0.4, pitch: 0, roll: 0.25 },
  calm: { lid: 1, low: 0, tilt: 0, pupil: 5, mode: 'closed', brow: 0.05, browTilt: 0, tuft: -0.15, jaw: 0, pitch: -0.02, roll: 0 },
  excited: { lid: 0, low: 0.15, tilt: 0, pupil: 7, mode: 'sparkle', brow: 0.8, browTilt: -0.1, tuft: 0.7, jaw: 0.4, pitch: -0.08, roll: 0 },
};

export interface ActorHooks {
  fx?(kind: OwlFx, at: THREE.Vector3, n?: number): void;
  sound?(id: OwlSound): void;
}

export class OwlActor {
  readonly node = new THREE.Group();
  model: OwlModel;
  mood: OwlMood = 'neutral';
  pose: OwlPose = 'stand';
  action: OwlAction = 'none';
  /** world point to look at (null = idle glances) */
  lookAt: THREE.Vector3 | null = null;
  /** 0..1 lung fullness, driven by the breathing exercise while pose === 'breathe' */
  breath = 0;
  /** 0..1 how dark it is (pupils dilate) */
  dark = 0;
  /** hold still: no idle glances or fidgets (used in menus and screenshots) */
  still = false;
  hooks: ActorHooks = {};

  private moodUntil = 0;
  private baseMood: OwlMood = 'neutral';
  private actT = 0;
  private actLen = 0;
  private time = 0;
  private nextBlink = 2;
  private blinkT = -1;
  private nextGlance = 1.5;
  private glance = new THREE.Vector2();
  private nextFidget = 5;
  private zzzT = 0;
  private eye: EyeState = defaultEye();
  private earTwitch = 3;
  private nictT = -1;
  // springs
  private s = {
    sy: new Spring(1, 1, 160, 11), sxz: new Spring(1, 1, 160, 11), lean: new Spring(0, 0, 90, 13), hopY: new Spring(0, 0, 0, 0),
    yaw: new Spring(0, 0, 140, 17), pitch: new Spring(0, 0, 110, 15), roll: new Spring(0, 0, 90, 12),
    wingL: new Spring(0, 0, 200, 16), wingR: new Spring(0, 0, 200, 16), wingFold: new Spring(0, 0, 120, 14),
    tuftL: new Spring(0, 0, 180, 9), tuftR: new Spring(0, 0, 180, 9), brow: new Spring(0, 0, 160, 15), browTilt: new Spring(0, 0, 160, 15),
    jaw: new Spring(0, 0, 220, 18), tail: new Spring(0, 0, 120, 8), lid: new Spring(0, 0, 260, 26), low: new Spring(0, 0, 160, 18),
    tilt: new Spring(0, 0, 160, 18), pupil: new Spring(5, 5, 60, 14), lx: new Spring(0, 0, 260, 24), ly: new Spring(0, 0, 260, 24),
  };
  private air = 0;
  private airV = 0;

  constructor(look: OwlLook, hooks: ActorHooks = {}) {
    this.hooks = hooks;
    this.model = buildOwl(look);
    this.node.add(this.model.rig.root);
    this.applyEyes(true);
  }

  get height() { return this.model.height; }
  get headWorld(): THREE.Vector3 { return this.model.rig.bones.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 6 * PX * this.node.scale.y, 0)); }

  rebuild(look: OwlLook) {
    const old = this.model;
    this.node.remove(old.rig.root);
    old.dispose();
    this.model = buildOwl(look);
    this.node.add(this.model.rig.root);
    this.applyEyes(true);
  }

  /** Set the resting mood, or a temporary one for `hold` seconds. */
  setMood(m: OwlMood, hold = 0) {
    if (hold > 0) { this.mood = m; this.moodUntil = this.time + hold; }
    else { this.baseMood = m; if (this.time >= this.moodUntil) this.mood = m; }
  }

  play(a: OwlAction) {
    this.action = a;
    this.actT = 0;
    const len: Record<OwlAction, number> = { none: 0, hop: 0.62, dance: 2.6, ruffle: 1.1, yawn: 1.9, spin: 1.7, wave: 1.5, nod: 0.8, peck: 0.9, present: 2.4, stretch: 1.8, flap: 1.2, shiver: 0.8 };
    this.actLen = len[a];
    const h = this.hooks;
    if (a === 'hop') { this.s.sy.kick(-2.2); h.sound?.('hop'); }
    if (a === 'ruffle') { h.sound?.('rustle'); h.fx?.('feather', this.chest(), 7); }
    if (a === 'dance') { this.setMood('joy', 2.6); h.sound?.('happy'); }
    if (a === 'yawn') { this.setMood('sleepy', 2.2); h.sound?.('yawn'); }
    if (a === 'spin') this.setMood('curious', 1.8);
    if (a === 'wave' || a === 'flap') h.sound?.('flap');
    if (a === 'present') this.setMood('proud', 2.4);
  }

  /** Quick, satisfying reaction to being tapped. */
  poke() {
    const r = Math.random();
    if (this.pose === 'sleep') { this.setMood('sleepy', 1.4); this.s.sy.kick(-1.5); this.hooks.fx?.('zzz', this.headWorld, 2); return; }
    if (r < 0.22) { this.play('hop'); this.setMood('happy', 1.6); this.hooks.fx?.('heart', this.headWorld, 2); }
    else if (r < 0.4) this.play('ruffle');
    else if (r < 0.55) this.play('spin');
    else if (r < 0.7) { this.setMood('love', 1.8); this.hooks.fx?.('heart', this.headWorld, 4); this.hooks.sound?.('happy'); this.s.sy.kick(-1.2); }
    else if (r < 0.85) this.play('dance');
    else { this.setMood('surprised', 0.9); this.s.sy.kick(2.4); this.s.tuftL.kick(14); this.s.tuftR.kick(14); this.hooks.sound?.('hoot'); }
  }

  private chest() { const g = this.model.g; return this.node.localToWorld(new THREE.Vector3(0, (g.bodyY + g.bodyH * 0.65) * PX, g.chestZ * PX)); }

  update(dt: number) {
    this.time += dt;
    const t = this.time, s = this.s, B = this.model.rig.bones;
    if (this.time >= this.moodUntil && this.mood !== this.baseMood) this.mood = this.baseMood;
    let mood = this.mood;
    if (this.pose === 'sleep') mood = this.time < this.moodUntil ? this.mood : 'asleep';
    if (this.pose === 'breathe' && this.time >= this.moodUntil) mood = 'calm';
    const F = FACES[mood];

    // ---------------- targets from pose + mood
    let sy = 1, sxz = 1, lean = 0, pitch = F.pitch, roll = F.roll, yaw = 0;
    let wingL = 0, wingR = 0, fold = 0, tuftL = F.tuft, tuftR = F.tuft, jaw = F.jaw, tail = 0;
    let brow = F.brow, browTilt = F.browTilt;
    let lid = F.lid, low = F.low, tilt = F.tilt, pupil = F.pupil + this.dark * 1.6, mode = F.mode;
    let lx = 0, ly = 0;

    // idle breathing: slow, visible chest rise
    const idleBreath = Math.sin(t * (this.pose === 'sleep' ? 1.15 : 1.7)) * 0.5 + 0.5;
    if (this.pose === 'breathe') {
      const b = this.breath;
      sy += b * 0.085; sxz += b * 0.06; pitch -= b * 0.1; wingL = wingR = b * 0.22; tuftL += b * 0.4; tuftR += b * 0.4; tail = b * 0.2;
    } else if (this.pose === 'sleep') {
      sy += idleBreath * 0.035 - 0.05; sxz += idleBreath * 0.03 + 0.03; pitch = Math.max(pitch, 0.24); tail = -0.1;
      if ((this.zzzT -= dt) <= 0) { this.zzzT = 2.6; this.hooks.fx?.('zzz', this.headWorld, 1); }
    } else {
      sy += idleBreath * 0.022; sxz += idleBreath * 0.012;
    }
    if (this.pose === 'fly') {
      const f = Math.sin(t * 15);
      wingL = wingR = 1.15 + f * 0.95; lean = 0.42; tuftL -= 0.4; tuftR -= 0.4; tail = 0.3;
      if (f > 0.97 && Math.random() < 0.5) this.hooks.sound?.('flap');
    }

    // idle life: glances, curious tilts, fidgets
    if (!this.still && this.pose === 'stand' && this.action === 'none') {
      if ((this.nextGlance -= dt) <= 0) {
        this.nextGlance = 1.4 + Math.random() * 3.2;
        this.glance.set(Math.random() < 0.35 ? 0 : (Math.random() - 0.5) * 1.4, (Math.random() - 0.5) * 0.4);
        if (Math.random() < 0.25) s.roll.kick((Math.random() - 0.5) * 4);
      }
      if ((this.nextFidget -= dt) <= 0) {
        this.nextFidget = 6 + Math.random() * 9;
        const r = Math.random();
        this.play(r < 0.3 ? 'ruffle' : r < 0.5 ? 'stretch' : r < 0.7 ? 'nod' : r < 0.85 ? 'flap' : 'hop');
        if (this.mood === 'neutral' && Math.random() < 0.3) this.setMood('happy', 2);
      }
      yaw += this.glance.x * 0.8; pitch += this.glance.y * 0.5;
      lx = this.glance.x * 0.7; ly = -this.glance.y;
    }
    if (this.lookAt && this.pose !== 'sleep') {
      const local = this.node.worldToLocal(this.lookAt.clone());
      const hp = new THREE.Vector3(0, this.model.g.eyeY * PX, 0);
      const d = local.sub(hp);
      const ay = Math.atan2(d.x, d.z), ap = Math.atan2(-d.y, Math.hypot(d.x, d.z));
      yaw = THREE.MathUtils.clamp(ay, -1.2, 1.2) * 0.8; pitch += THREE.MathUtils.clamp(ap, -0.5, 0.5) * 0.7;
      lx = THREE.MathUtils.clamp(ay * 1.2, -1, 1); ly = THREE.MathUtils.clamp(ap * 1.6, -1, 1);
    }

    // ---------------- action clips
    if (this.action !== 'none') {
      this.actT += dt;
      const p = this.actT / this.actLen, a = this.action;
      const env = Math.sin(Math.min(1, p) * Math.PI);
      if (a === 'hop') {
        if (this.actT < 0.08) { sy -= 0.12; sxz += 0.08; }
        else if (this.air === 0 && this.airV === 0 && this.actT < 0.2) { this.airV = 2.1; }
        wingL = wingR = env * 0.9;
      } else if (a === 'dance') {
        const beat = t * 7.5;
        roll += Math.sin(beat) * 0.22; yaw += Math.sin(beat * 0.5) * 0.4; sy += Math.abs(Math.sin(beat)) * 0.06;
        wingL = 0.5 + Math.max(0, Math.sin(beat)) * 0.9; wingR = 0.5 + Math.max(0, -Math.sin(beat)) * 0.9;
        lean = Math.sin(beat) * 0.08;
        if (Math.floor(beat / Math.PI) !== Math.floor((beat - dt * 7.5) / Math.PI)) { this.hooks.fx?.('note', this.headWorld, 1); this.s.sy.kick(-0.8); }
      } else if (a === 'ruffle') {
        sxz += env * 0.14 + Math.sin(t * 40) * 0.025 * env; sy += env * 0.06; wingL = wingR = env * 0.35 + Math.sin(t * 34) * 0.12 * env;
        tuftL += env * 0.8; tuftR += env * 0.8; lid = Math.max(lid, env * 0.8);
      } else if (a === 'yawn') {
        jaw = env * 1.3; pitch -= env * 0.3; lid = Math.max(lid, Math.min(1, env * 1.6)); wingL = wingR = env * 0.7; sy += env * 0.06; tuftL -= env * 0.4; tuftR -= env * 0.4;
      } else if (a === 'spin') {
        // the famous owl head turn: all the way round to peek behind, then back
        yaw += p < 0.42 ? THREE.MathUtils.smoothstep(p, 0, 0.42) * 4.6 : p < 0.6 ? 4.6 : 4.6 - THREE.MathUtils.smoothstep(p, 0.6, 1) * 4.6;
      } else if (a === 'wave') {
        wingR = 1.6 + Math.sin(t * 14) * 0.45 * env; roll -= 0.1 * env; lx = 0.2;
        if (mood === 'neutral') { low = 0.3; brow = 0.4; }
      } else if (a === 'nod') {
        pitch += Math.sin(p * Math.PI * 4) * 0.22 * env;
      } else if (a === 'peck') {
        pitch += Math.max(0, Math.sin(p * Math.PI * 3)) * 0.5; lean += Math.max(0, Math.sin(p * Math.PI * 3)) * 0.15;
      } else if (a === 'present') {
        wingL = wingR = 0.9 * env; lean = -0.08 * env; pitch -= 0.12 * env;
      } else if (a === 'stretch') {
        wingL = wingR = env * 1.9; sy += env * 0.08; sxz -= env * 0.03; pitch -= env * 0.25; lid = Math.max(lid, env * 0.9); jaw = env * 0.6;
      } else if (a === 'flap') {
        wingL = wingR = env * (0.9 + Math.sin(t * 24) * 0.6); sy += env * 0.03;
      } else if (a === 'shiver') {
        roll += Math.sin(t * 50) * 0.05 * env; sxz += Math.sin(t * 45) * 0.03 * env;
      }
      if (this.actT >= this.actLen) this.action = 'none';
    }

    // hop physics
    if (this.airV !== 0 || this.air > 0) {
      this.airV -= 9.8 * dt;
      this.air += this.airV * dt;
      if (this.air <= 0) { this.air = 0; this.airV = 0; s.sy.kick(-2.4); s.sxz.kick(1.4); this.hooks.sound?.('land'); this.hooks.fx?.('dust', this.node.position.clone(), 4); }
    }

    // cat-ear twitches now and then
    if ((this.earTwitch -= dt) <= 0) { this.earTwitch = 2.5 + Math.random() * 6; (Math.random() < 0.5 ? s.tuftL : s.tuftR).kick(-9 - Math.random() * 6); }

    // blinks: soft, quick, sometimes doubled
    if (mode === 'normal' || mode === 'sparkle') {
      if ((this.nextBlink -= dt) <= 0) {
        this.nextBlink = 1.8 + Math.random() * 4 + (Math.random() < 0.2 ? -1.5 : 0);
        if (Math.random() < 0.28 && this.model.look.skin !== 'meowl') this.nictT = 0; else this.blinkT = 0;
      }
      if (this.blinkT >= 0) {
        this.blinkT += dt;
        const k = this.blinkT < 0.07 ? this.blinkT / 0.07 : this.blinkT < 0.14 ? 1 : Math.max(0, 1 - (this.blinkT - 0.14) / 0.09);
        lid = Math.max(lid, k);
        if (this.blinkT > 0.23) this.blinkT = -1;
      }
    }

    let nict = 0;
    if (this.nictT >= 0) {
      this.nictT += dt;
      nict = this.nictT < 0.12 ? this.nictT / 0.12 : Math.max(0, 1 - (this.nictT - 0.16) / 0.16);
      if (this.nictT > 0.34) this.nictT = -1;
    }

    // ---------------- springs
    s.sy.target = sy; s.sxz.target = sxz; s.lean.target = lean; s.yaw.target = yaw; s.pitch.target = pitch; s.roll.target = roll;
    s.wingL.target = wingL; s.wingR.target = wingR; s.wingFold.target = fold; s.tuftL.target = tuftL; s.tuftR.target = tuftR;
    s.brow.target = brow; s.browTilt.target = browTilt; s.jaw.target = jaw; s.tail.target = tail + Math.sin(t * 2.2) * 0.04;
    s.lid.target = lid; s.low.target = low; s.tilt.target = tilt; s.pupil.target = pupil; s.lx.target = lx; s.ly.target = ly;
    for (const k of Object.keys(s) as (keyof typeof s)[]) if (k !== 'hopY') s[k].step(dt);
    // blinks should be instant, not springy
    if (this.blinkT >= 0) s.lid.x = lid;

    // ---------------- apply to bones
    const body = B.body, head = B.head, g = this.model.g, PV = this.model.pivots;
    body.scale.set(s.sxz.x, s.sy.x, s.sxz.x);
    body.rotation.x = s.lean.x;
    const neckH = (g.neckY - g.bodyY) * PX;
    head.position.set(PV.head[0] * PX, PV.head[1] * PX + neckH * (s.sy.x - 1) + Math.sin(s.lean.x) * 0.02, PV.head[2] * PX + Math.sin(s.lean.x) * neckH);
    head.rotation.set(s.pitch.x, s.yaw.x, s.roll.x, 'YXZ');
    B.wingL.rotation.set(0, 0, -s.wingL.x);
    B.wingR.rotation.set(0, 0, s.wingR.x);
    // the hand unfolds as the wing lifts, swinging the primaries out to the full span
    const spreadL = THREE.MathUtils.clamp(s.wingL.x / 1.4, 0, 1.2), spreadR = THREE.MathUtils.clamp(s.wingR.x / 1.4, 0, 1.2);
    if (B.handL) B.handL.rotation.set(-spreadL * 0.85, 0, 0);
    if (B.handR) B.handR.rotation.set(-spreadR * 0.85, 0, 0);
    // feet tuck back in flight
    const tuck = this.pose === 'fly' ? 0.9 : 0;
    B.legL.rotation.x += (tuck - B.legL.rotation.x) * Math.min(1, dt * 8);
    B.legR.rotation.x = B.legL.rotation.x;
    B.tuftL.rotation.set(-Math.max(0, -s.tuftL.x) * 0.25, 0, -s.tuftL.x * 0.32 + Math.max(0, -s.tuftL.x) * 0.55);
    B.tuftR.rotation.set(-Math.max(0, -s.tuftR.x) * 0.25, 0, s.tuftR.x * 0.32 - Math.max(0, -s.tuftR.x) * 0.55);
    B.browL.position.y = (PV.browL[1] - PV.head[1]) * PX + s.brow.x * 0.6 * PX;
    B.browR.position.y = (PV.browR[1] - PV.head[1]) * PX + s.brow.x * 0.6 * PX;
    B.browL.rotation.z = -s.browTilt.x * 0.35;
    B.browR.rotation.z = s.browTilt.x * 0.35;
    const mo = Math.max(0, s.jaw.x);
    B.jaw.visible = mo > 0.06;
    if (this.model.look.skin === 'meowl') B.jaw.scale.set(0.7 + mo * 0.4, Math.max(0.05, mo * 1.2), 1);
    else B.jaw.rotation.x = Math.min(0.75, mo * 0.55);
    B.tail.rotation.x = s.tail.x;
    this.model.rig.root.position.y = this.air;

    this.eye.lid = THREE.MathUtils.clamp(s.lid.x, 0, 1);
    this.eye.low = THREE.MathUtils.clamp(s.low.x, 0, 1);
    this.eye.tilt = THREE.MathUtils.clamp(s.tilt.x, -1, 1);
    this.eye.pupil = THREE.MathUtils.clamp(s.pupil.x, 2.5, 8);
    this.eye.lx = THREE.MathUtils.clamp(s.lx.x, -1, 1);
    this.eye.ly = THREE.MathUtils.clamp(s.ly.x, -1, 1);
    this.eye.mode = mode;
    this.eye.tear = !!F.tear;
    this.eye.nict = nict;
    this.applyEyes(false);
  }

  private applyEyes(force: boolean) {
    const [l, r] = this.model.eyes;
    if (force) { l.draw({ ...this.eye, lid: this.eye.lid + 0.0001 }); r.draw({ ...this.eye, lid: this.eye.lid + 0.0001 }); }
    l.draw(this.eye);
    // a subtle asymmetry makes the face feel less mechanical
    r.draw({ ...this.eye, lx: this.eye.lx, lid: Math.min(1, this.eye.lid + (this.eye.mode === 'normal' ? 0.02 : 0)) });
  }

  /** Snap all springs to their targets (for the first frame and screenshots). */
  settle() { for (let i = 0; i < 90; i++) this.update(1 / 60); }

  dispose() { this.model.dispose(); }
}
