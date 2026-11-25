// Barnaby Birchbark, the beaver who keeps the lodge store (public/models/shop/beaver.glb, built by art/shop/beaver.py):
// a hand-painted, skinned beaver in a moss-green canvas apron, half-moon spectacles on his muzzle and a pencil behind
// his ear. His clips: idle (breathing, the tail swaying), talk, wave, present, hop, think (a scratch of the head) and
// gnaw (he nibbles the pencil). On top of the clips he blinks, turns his head toward whatever he is looking at, and
// talks while his lines type out. OWNED BY THE SHOP BUILDER.
// [anime6] Anime faces: ink decals painted onto his own head round each eye (cut from the body mesh at load, carried by
// the head bone) draw happy ^ ^ arcs, sparkly, shocked, sleepy and teary eyes, > < squints, bold brows and blush; his
// glossy 3D eyes hide while one is on. Emote marks (src/ui/fx/emotes.ts) pop beside his head: a greeting, a think
// (? then a light bulb), a celebration for every purchase, a gasp at a five-star wish.
import * as THREE from 'three';
import { instanceGLB } from '../../gfx/glb.ts';
import { Eye, defaultEye, type EyeMode } from '../../owl/eyes.ts';
import { actorAnchor, popEmote, type EmoteAnchor, type EmoteKind } from '../../ui/fx/emotes.ts';

export const BEAVER_NAME = 'Barnaby';
export const BEAVER_FULL = 'Barnaby Birchbark';
export type BeaverClip = 'idle' | 'talk' | 'wave' | 'present' | 'hop' | 'think' | 'gnaw';
const ONE_SHOT: BeaverClip[] = ['wave', 'present', 'hop', 'think', 'gnaw'];

/** [anime6] His anime faces ('normal' = his own glossy eyes). */
export type BeaverFace = 'normal' | 'happy' | 'joy' | 'sparkly' | 'shock' | 'sleepy' | 'teary' | 'determined' | 'shy' | 'flustered' | 'thinking';
export const BEAVER_FACES: BeaverFace[] = ['normal', 'happy', 'joy', 'sparkly', 'shock', 'sleepy', 'teary', 'determined', 'shy', 'flustered', 'thinking'];
const FACE: Record<BeaverFace, { mode: EyeMode | null; brow?: number; blush?: number; k?: number }> = {
  normal: { mode: null }, happy: { mode: 'happy', k: 1.4 }, joy: { mode: 'happy', blush: 0.8, k: 1.4 }, sparkly: { mode: 'sparkly', brow: -0.25 },
  shock: { mode: 'shock', k: 0.92 }, sleepy: { mode: 'half', k: 1.15 }, teary: { mode: 'teary', brow: -0.75 }, determined: { mode: 'none', brow: 0.95 },
  shy: { mode: 'happy', blush: 1, k: 1.4 }, flustered: { mode: 'squint', blush: 1, k: 1.25 }, thinking: { mode: 'none', brow: -0.45 },
};
/** the drawn eye's half size, in eye-sphere radii (the dot comes out a touch bigger than his real eye) */
const DECAL_K = 1.2;
/** his eye spheres' radius in the model (art/shop/beaver.py) */
const EYE_R = 0.0145;
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
  // [anime6] the anime face: two ink decals (one per eye) and the face they show
  private decals: { eye: Eye; mesh: THREE.Mesh }[] = [];
  private face: BeaverFace = 'normal';
  private faceT = 0;
  private time = 0;
  private body: THREE.Mesh | null = null;
  private anchor: EmoteAnchor | null = null;
  private timers: number[] = [];

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
    try { this.buildFace(root); } catch (e) { console.warn('beaver face', e); } // [anime6]
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
    this.clipFace(clip); // [anime6]
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
    this.time += dt;
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
    const hide = this.drawFace(1 - s); // [anime6] an anime face hides his own eyes
    for (const e of this.eyes) {
      if (hide) e.bone.scale.setScalar(0.001);
      else e.bone.scale.set(1, 1, 1).lerp(new THREE.Vector3(1, 1, 1).sub(e.axis.clone().multiplyScalar(1 - s)), 1);
    }
  }

  // ---------------------------------------------------------------- [anime6] anime faces and emote marks

  /** Show an anime face (for `hold` seconds, then back to his own eyes; 0 = until changed). */
  setFace(f: BeaverFace, hold = 0) { this.face = f; this.faceT = hold > 0 ? this.time + hold : Infinity; }
  /** Pop an emote mark beside his head. */
  emote(kind: EmoteKind, delay = 0) {
    this.anchor ??= actorAnchor(() => this.body, (out) => this.faceCentre(out), () => this.faceRadius());
    popEmote(kind, this.anchor, { delay });
  }
  /** A face and a mark together. */
  react(f: BeaverFace, mark?: EmoteKind, hold = 1.8) { this.setFace(f, hold); if (mark) this.emote(mark); }
  /** A big moment at the Lucky Barrel: a gasp at a five-star, starry eyes at a four-star. */
  wow(stars: 3 | 4 | 5) {
    if (stars === 5) { this.react('shock', 'bang', 0.9); this.later(0.95, () => this.react('joy', 'sparkle', 2.2)); }
    else if (stars === 4) this.react('sparkly', 'sparkle', 2);
    else this.react('happy', undefined, 1.2);
  }
  private later(sec: number, f: () => void) { this.timers.push(window.setTimeout(() => { if (!this.dead) f(); }, sec * 1000)); }
  /** Each gesture wears its face. */
  private clipFace(clip: BeaverClip) {
    if (clip === 'wave') this.react('happy', 'notes', 1.7);
    else if (clip === 'think') { this.react('thinking', 'ask', 1.6); this.later(1.25, () => this.react('sparkly', 'bulb', 1.1)); }
    else if (clip === 'hop') { this.react('joy', 'sparkle', 2.1); this.emote('notes', 0.45); }
    else if (clip === 'present') this.react('sparkly', undefined, 1.6);
    else if (clip === 'gnaw') this.setFace('sleepy', 1.6);
  }
  /** World centre of his face (between the eyes). */
  faceCentre(out = new THREE.Vector3()): THREE.Vector3 | null {
    if (this.eyes.length < 2) return this.head ? this.headWorld(out) : null;
    const a = this.eyes[0].bone.getWorldPosition(new THREE.Vector3());
    return this.eyes[1].bone.getWorldPosition(out).add(a).multiplyScalar(0.5);
  }
  private faceRadius(): number {
    if (this.eyes.length < 2) return 0.12;
    return this.eyes[0].bone.getWorldPosition(new THREE.Vector3()).distanceTo(this.eyes[1].bone.getWorldPosition(new THREE.Vector3())) * 0.55;
  }

  /**
   * Cut a decal patch from the body mesh round each eye (in the rest pose), in the head bone's frame so it moves with
   * the head: the triangles that face out along the eye's normal inside a box round it, planar UVs across the box.
   */
  private buildFace(root: THREE.Object3D) {
    const head = this.head;
    if (!head || this.eyes.length < 2) return;
    let body: THREE.Mesh | null = null, most = 0;
    root.traverse((n) => {
      const m = n as THREE.Mesh;
      if (!m.isMesh || !(m as THREE.SkinnedMesh).isSkinnedMesh) return;
      const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.Material[];
      const cnt = m.geometry.getAttribute('position')?.count ?? 0;
      if (mats.some((x) => x.name === 'fur') && cnt > most) { most = cnt; body = m; }
    });
    if (!body) return;
    this.body = body;
    const B = body as THREE.SkinnedMesh, g = B.geometry, pos = g.getAttribute('position'), nrm = g.getAttribute('normal'), idx = g.index;
    this.node.updateWorldMatrix(true, true); // (every matrix fresh and from the same moment, ancestors included)
    const inv = root.matrixWorld.clone().invert();
    const headInv = inv.clone().multiply(head.matrixWorld).invert(), nHead = new THREE.Matrix3().getNormalMatrix(headInv);
    // the rest pose, skinned (the quantized vertices only make sense through their bones), in the root's frame
    const sk = B.skeleton, si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
    const mats = sk.bones.map((b, i) => inv.clone().multiply(b.matrixWorld).multiply(sk.boneInverses[i]).multiply(B.bindMatrix));
    const SP = new Float32Array(pos.count * 3), SN = new Float32Array(pos.count * 3);
    {
      const M = new THREE.Matrix4(), m3 = new THREE.Matrix3(), v = new THREE.Vector3(), w4 = [0, 0, 0, 0], i4 = [0, 0, 0, 0];
      for (let i = 0; i < pos.count; i++) {
        const me = M.elements;
        me.fill(0);
        i4[0] = si.getX(i); i4[1] = si.getY(i); i4[2] = si.getZ(i); i4[3] = si.getW(i);
        w4[0] = sw.getX(i); w4[1] = sw.getY(i); w4[2] = sw.getZ(i); w4[3] = sw.getW(i);
        for (let j = 0; j < 4; j++) { if (!w4[j]) continue; const be = mats[i4[j]].elements; for (let k = 0; k < 16; k++) me[k] += w4[j] * be[k]; }
        v.fromBufferAttribute(pos, i).applyMatrix4(M);
        SP[i * 3] = v.x; SP[i * 3 + 1] = v.y; SP[i * 3 + 2] = v.z;
        if (nrm) { v.fromBufferAttribute(nrm, i).applyMatrix3(m3.setFromMatrix4(M)).normalize(); SN[i * 3] = v.x; SN[i * 3 + 1] = v.y; SN[i * 3 + 2] = v.z; }
      }
    }
    const q = new THREE.Quaternion();
    const nTri = idx ? idx.count / 3 : pos.count / 3;
    const V = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], N = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3(), d = new THREE.Vector3();
    for (const e of this.eyes) {
      // the eye bone runs out along the eye's normal from the sphere's centre (Y along the bone)
      const c = e.bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
      e.bone.getWorldQuaternion(q);
      const rq = new THREE.Quaternion().setFromRotationMatrix(inv).multiply(q);
      const n = new THREE.Vector3(0, 1, 0).applyQuaternion(rq).normalize();
      const X = new THREE.Vector3(0, 1, 0).cross(n).normalize(), Y = n.clone().cross(X).normalize();
      const half = (EYE_R * DECAL_K) / 0.2762, depth = 0.035;
      const P: number[] = [], NN: number[] = [], UV: number[] = [];
      for (let t = 0; t < nTri; t++) {
        let ok = true;
        for (let k = 0; k < 3; k++) {
          const i = idx ? idx.getX(t * 3 + k) : t * 3 + k;
          V[k].fromArray(SP, i * 3);
          d.copy(V[k]).sub(c);
          if (Math.abs(d.dot(X)) > half * 1.02 || Math.abs(d.dot(Y)) > half * 1.02 || Math.abs(d.dot(n)) > depth) { ok = false; break; }
          if (nrm) N[k].fromArray(SN, i * 3);
        }
        if (!ok) continue;
        fn.crossVectors(e1.subVectors(V[1], V[0]), e2.subVectors(V[2], V[0])).normalize();
        if (fn.dot(n) < 0.2) continue;
        for (let k = 0; k < 3; k++) {
          d.copy(V[k]).sub(c);
          UV.push(0.5 + d.dot(X) / (2 * half), 0.5 - d.dot(Y) / (2 * half));
          const nk = nrm ? N[k] : fn;
          const lp = V[k].clone().addScaledVector(nk, 0.0007).applyMatrix4(headInv);
          P.push(lp.x, lp.y, lp.z);
          const ln = nk.clone().applyMatrix3(nHead).normalize();
          NN.push(ln.x, ln.y, ln.z);
        }
      }
      if (!P.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(NN, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
      const side = c.x >= 0 ? 1 : -1;
      const eye = new Eye(side, { ink: '#1d1512' }, 11);
      eye.tex.wrapS = eye.tex.wrapT = THREE.ClampToEdgeWrapping;
      const mat = new THREE.MeshStandardMaterial({ map: eye.tex, alphaTest: 0.5, roughness: 0.5, metalness: 0, envMapIntensity: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      mat.name = 'face';
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = 'face_decal';
      mesh.visible = false;
      mesh.renderOrder = 2;
      mesh.frustumCulled = false;
      head.add(mesh);
      this.decals.push({ eye, mesh });
    }
  }

  /** Draw this frame's face onto the decals; returns whether his own eyes should hide. */
  private drawFace(blink: number): boolean {
    if (this.time >= this.faceT) { this.face = 'normal'; this.faceT = Infinity; }
    const F = FACE[this.face];
    if (!F.mode || !this.decals.length) { for (const d of this.decals) d.mesh.visible = false; return false; }
    for (const d of this.decals) {
      d.mesh.visible = true;
      d.eye.scale = F.k ?? 1;
      d.eye.draw({ ...defaultEye(), mode: F.mode, lid: blink, brow: F.brow ?? 0, blush: F.blush ?? 0, t: this.time });
    }
    return F.mode !== 'none';
  }

  dispose() {
    this.timers.forEach((t) => clearTimeout(t));
    for (const d of this.decals) { d.mesh.geometry.dispose(); (d.mesh.material as THREE.Material).dispose(); d.eye.tex.dispose(); }
    this.dead = true;
    this.mixer?.stopAllAction();
    this.node.removeFromParent();
  }
}
