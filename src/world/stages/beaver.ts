// Barnaby Birchbark, the beaver who keeps the lodge store (public/models/shop/beaver.glb, built by art/shop/beaver.py):
// a hand-painted, skinned beaver in a moss-green canvas apron, half-moon spectacles on his muzzle and a pencil behind
// his ear. His clips: idle (breathing, the tail swaying), talk, wave, present, hop, think (a scratch of the head) and
// gnaw (he nibbles the pencil). On top of the clips he blinks, turns his head toward whatever he is looking at, and
// talks while his lines type out. OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';
import { instanceGLB } from '../../gfx/glb.ts';

export const BEAVER_NAME = 'Barnaby';
export const BEAVER_FULL = 'Barnaby Birchbark';
export type BeaverClip = 'idle' | 'talk' | 'wave' | 'present' | 'hop' | 'think' | 'gnaw';
const ONE_SHOT: BeaverClip[] = ['wave', 'present', 'hop', 'think', 'gnaw'];

export class Beaver {
  /** place, turn and scale this */
  readonly node = new THREE.Group();
  readonly ready: Promise<void>;
  /** where he looks (world), null to look ahead */
  lookAt: THREE.Vector3 | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private acts = new Map<string, THREE.AnimationAction>();
  private base: 'idle' | 'talk' = 'idle';
  private shot: THREE.AnimationAction | null = null;
  private head: THREE.Bone | null = null;
  private eyes: { bone: THREE.Bone; axis: THREE.Vector3 }[] = [];
  private blinkT = 2.5;
  private blink = 0;
  private look = new THREE.Vector2();
  private talkT = 0;
  private dead = false;
  private meshes: THREE.Mesh[] = [];
  onEvent: ((e: 'gnaw' | 'land' | 'clap') => void) | null = null;
  private clipT = 0;
  private fired = new Set<string>();

  constructor() {
    this.ready = this.load();
  }

  private async load() {
    const { root, clips } = await instanceGLB('shop/beaver.glb');
    if (this.dead) return;
    root.traverse((n) => {
      const m = n as THREE.Mesh;
      if (m.isMesh) {
        m.frustumCulled = false; // (skinned: the bind-pose bounds don't follow the clips)
        m.castShadow = true;
        m.receiveShadow = true;
        this.meshes.push(m);
        for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
          if (mat.name === 'eye') { mat.roughness = 0.12; mat.metalness = 0; mat.envMapIntensity = 1.4; }
          else if (mat.name === 'glass') { mat.transparent = true; mat.opacity = 0.22; mat.depthWrite = false; mat.roughness = 0.05; mat.envMapIntensity = 1.8; }
          else if (mat.name === 'fur') { mat.roughness = 0.92; mat.envMapIntensity = 0.35; }
          else { mat.roughness = 0.8; mat.envMapIntensity = 0.5; }
        }
      }
      const b = n as THREE.Bone;
      if (b.isBone) {
        if (b.name === 'head') this.head = b;
        if (b.name === 'eye_l' || b.name === 'eye_r') this.eyes.push({ bone: b, axis: new THREE.Vector3(0, 1, 0) });
      }
    });
    this.node.add(root);
    this.mixer = new THREE.AnimationMixer(root);
    for (const c of clips) {
      const a = this.mixer.clipAction(c);
      if (ONE_SHOT.includes(c.name as BeaverClip)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.acts.set(c.name, a);
    }
    this.mixer.addEventListener('finished', (e) => { if ((e as unknown as { action: THREE.AnimationAction }).action === this.shot) this.endShot(); });
    this.acts.get('idle')?.play();
    // which local axis of each eye bone points up in the rest pose: blinking squashes along it
    root.updateMatrixWorld(true);
    const q = new THREE.Quaternion();
    for (const e of this.eyes) {
      e.bone.getWorldQuaternion(q);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q.invert());
      const a = [Math.abs(up.x), Math.abs(up.y), Math.abs(up.z)];
      const k = a.indexOf(Math.max(...a));
      e.axis.set(k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
    }
  }

  /** Play a one-shot gesture (then back to idle / talking). */
  play(clip: BeaverClip, fade = 0.25) {
    const a = this.acts.get(clip);
    if (!a || !this.mixer) return;
    if (clip === 'idle' || clip === 'talk') { this.setBase(clip); return; }
    const from = this.shot ?? this.acts.get(this.base);
    a.reset();
    a.setEffectiveWeight(1);
    a.play();
    if (from && from !== a) a.crossFadeFrom(from, fade, false);
    this.shot = a;
    this.clipT = 0;
    this.fired.clear();
  }
  get busy() { return !!this.shot; }
  get current(): string { return this.shot?.getClip().name ?? this.base; }

  private endShot() {
    const a = this.shot;
    this.shot = null;
    const b = this.acts.get(this.base);
    if (!a || !b) return;
    b.reset();
    b.play();
    b.crossFadeFrom(a, 0.35, false);
  }

  private setBase(k: 'idle' | 'talk') {
    if (this.base === k) return;
    const from = this.acts.get(this.base), to = this.acts.get(k);
    this.base = k;
    if (!to || this.shot) return;
    to.reset();
    to.play();
    if (from) to.crossFadeFrom(from, 0.3, false);
  }

  /** Talk for `sec` seconds (the jaw chatters while his line types out). */
  talk(sec: number) {
    this.talkT = Math.max(this.talkT, sec);
    this.setBase('talk');
  }

  /** World position of his head (for speech bubbles and the camera). */
  headWorld(out = new THREE.Vector3()): THREE.Vector3 {
    if (this.head) return this.head.getWorldPosition(out).add(new THREE.Vector3(0, 0.12, 0));
    return this.node.getWorldPosition(out).add(new THREE.Vector3(0, 1.0, 0));
  }

  update(dt: number) {
    if (!this.mixer) return;
    if (this.talkT > 0) { this.talkT -= dt; if (this.talkT <= 0) this.setBase('idle'); }
    this.mixer.update(dt);
    // little moments inside clips: the gnawing, the landing of a hop
    if (this.shot) {
      this.clipT += dt;
      const n = this.shot.getClip().name;
      if (n === 'gnaw' && this.clipT > 1.0 && !this.fired.has('g')) { this.fired.add('g'); this.onEvent?.('gnaw'); }
      if (n === 'hop' && this.clipT > 1.0 && !this.fired.has('l')) { this.fired.add('l'); this.onEvent?.('land'); }
    }
    // head turn toward what he looks at (after the clip, as an offset)
    const h = this.head;
    if (h) {
      let yaw = 0, pitch = 0;
      if (this.lookAt) {
        const hp = h.getWorldPosition(new THREE.Vector3());
        const d = this.lookAt.clone().sub(hp);
        const inv = this.node.getWorldQuaternion(new THREE.Quaternion()).invert();
        d.applyQuaternion(inv);
        yaw = THREE.MathUtils.clamp(Math.atan2(d.x, d.z), -0.75, 0.75);
        pitch = THREE.MathUtils.clamp(-Math.atan2(d.y, Math.hypot(d.x, d.z)), -0.35, 0.35);
      }
      const k = 1 - Math.exp(-dt * 5);
      this.look.x += (yaw - this.look.x) * k;
      this.look.y += (pitch - this.look.y) * k;
      if (Math.abs(this.look.x) + Math.abs(this.look.y) > 1e-4) {
        const pq = h.parent!.getWorldQuaternion(new THREE.Quaternion());
        const nq = this.node.getWorldQuaternion(new THREE.Quaternion());
        const off = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.look.y, this.look.x, 0, 'YXZ'));
        const w = nq.clone().multiply(off).multiply(nq.clone().invert()); // the offset, in world axes
        h.quaternion.premultiply(pq.clone().invert().multiply(w).multiply(pq));
      }
    }
    // blinks
    this.blinkT -= dt;
    if (this.blinkT <= 0) { this.blink = 1; this.blinkT = 2.2 + Math.random() * 3.5; if (Math.random() < 0.2) this.blinkT = 0.25; }
    const s = this.blink > 0 ? Math.max(0.12, Math.abs(this.blink - 0.5) * 2) : 1;
    this.blink = Math.max(0, this.blink - dt * 7);
    for (const e of this.eyes) e.bone.scale.set(1, 1, 1).lerp(new THREE.Vector3(1, 1, 1).sub(e.axis.clone().multiplyScalar(1 - s)), 1);
  }

  dispose() {
    this.dead = true;
    this.mixer?.stopAllAction();
    this.node.removeFromParent();
  }
}
