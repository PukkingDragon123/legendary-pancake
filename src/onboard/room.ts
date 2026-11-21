// The interview room: Pip's little office inside the oak, shown as a Stage (see world/scene.ts).
// A cinematic camera with named shots, slow push-ins, gentle handheld drift and hard cuts on topic
// changes; Pip in his reading glasses behind the desk with a clipboard; a round window with the real
// sky; a ticking wall clock; a desk lamp, dust motes in the window light; and a little prop system
// that pops voxel props in and out with squash and stretch for the answer vignettes.
import * as THREE from 'three';
import { PX, type BoxSpec } from '../gfx/box.ts';
import { sceneSound, sound } from '../audio/sound.ts';
import { OwlActor, type OwlFx } from '../owl/actor.ts';
import { featherColour, G, type OwlLook } from '../owl/model.ts';
import { Fx, SPR } from '../world/fx.ts';
import type { Stage } from '../world/scene.ts';
import * as P from './props.ts';
import { SkyView, type Weather } from './skyview.ts';

export type ShotName = 'establish' | 'pip' | 'pipL' | 'pipR' | 'close' | 'desk' | 'window' | 'clock' | 'clockwin' | 'board' | 'floor' | 'bed' | 'low' | 'wide' | 'tower';
interface Shot { target: THREE.Vector3; yaw: number; pitch: number; dist: number; fov?: number }

const U = (px: number) => px * PX;
const R0 = 80;
/** where things are, in blocks */
export const SPOT = {
  desk: new THREE.Vector3(0, U(15.4), U(-58)),
  floor: new THREE.Vector3(U(26), 0, U(10)),
  bed: new THREE.Vector3(U(24), U(9), U(-3)),
  window: new THREE.Vector3(Math.sin(-0.72) * U(R0 - 2), U(50), -Math.cos(-0.72) * U(R0 - 2)),
  board: new THREE.Vector3(Math.sin(0.72) * U(R0 - 2), U(52), -Math.cos(0.72) * U(R0 - 2)),
  clock: new THREE.Vector3(0, U(64), U(-R0 + 3)),
  lamp: new THREE.Vector3(U(-24), U(17), U(-44)),
};
const DESK_Z = U(P.DESK.z), DESK_TOP = U(P.DESK.h);

const SHOTS: Record<ShotName, () => Shot> = {
  establish: () => ({ target: new THREE.Vector3(0, 2.0, -1.4), yaw: 0, pitch: 0.12, dist: 11.5 }),
  wide: () => ({ target: new THREE.Vector3(0.2, 1.8, -1.0), yaw: 0.32, pitch: 0.2, dist: 10 }),
  pip: () => ({ target: new THREE.Vector3(0, 1.85, -3.3), yaw: 0, pitch: 0.22, dist: 5.2 }),
  pipL: () => ({ target: new THREE.Vector3(-0.1, 1.8, -3.2), yaw: -0.42, pitch: 0.16, dist: 5.4 }),
  pipR: () => ({ target: new THREE.Vector3(0.15, 1.85, -3.1), yaw: 0.45, pitch: 0.12, dist: 5.6 }),
  close: () => ({ target: new THREE.Vector3(0, 2.05, -3.5), yaw: 0.08, pitch: 0.24, dist: 3.6 }),
  low: () => ({ target: new THREE.Vector3(0, 1.8, -3.0), yaw: -0.18, pitch: 0.0, dist: 6 }),
  desk: () => ({ target: new THREE.Vector3(0.3, 1.2, -2.6), yaw: 0.18, pitch: 0.5, dist: 5.4 }),
  window: () => ({ target: SPOT.window.clone().add(new THREE.Vector3(0.8, -0.6, 0.6)), yaw: -0.62, pitch: 0.06, dist: 5.6 }),
  clock: () => ({ target: SPOT.clock.clone().add(new THREE.Vector3(0, -0.5, 0.6)), yaw: 0.05, pitch: -0.04, dist: 4.4 }),
  clockwin: () => ({ target: SPOT.clock.clone().lerp(SPOT.window, 0.45).add(new THREE.Vector3(0.1, -0.7, 1.2)), yaw: -0.2, pitch: 0.02, dist: 6.2 }),
  tower: () => ({ target: SPOT.floor.clone().add(new THREE.Vector3(-0.2, 1.5, 0)), yaw: 0.3, pitch: 0.18, dist: 7.2 }),
  board: () => ({ target: SPOT.board.clone().add(new THREE.Vector3(-0.6, -0.4, 0.6)), yaw: 0.6, pitch: 0.05, dist: 5 }),
  floor: () => ({ target: SPOT.floor.clone().add(new THREE.Vector3(-0.4, 0.95, 0.2)), yaw: 0.3, pitch: 0.36, dist: 6.6 }),
  bed: () => ({ target: SPOT.bed.clone().add(new THREE.Vector3(-0.2, 0.3, 0.5)), yaw: 0.36, pitch: 0.34, dist: 7 }),
};

/** A damped spring for one number. */
class Spring {
  v = 0;
  constructor(public x = 0, public target = 0, public k = 160, public d = 12) {}
  step(dt: number) { const a = (this.target - this.x) * this.k - this.v * this.d; this.v += a * dt; this.x += this.v * dt; return this.x; }
}

interface Spawned { obj: THREE.Object3D; s: Spring; dying: boolean; delay: number; base: THREE.Vector3; tick?: (o: THREE.Object3D, t: number, dt: number) => void; born: number }

export interface Vig { update?(t: number, dt: number): void; exit?(): void; /** a live value from the clipboard (hours of sleep...) */ set?(v: number): void }

export class InterviewRoom implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  readonly pip: OwlActor;
  readonly fx = new Fx(700);
  readonly sky = new SkyView();
  time = 0;
  /** the UI covers part of the screen: shift the picture (fractions of the screen) */
  frame = { x: 0, y: 0 };
  private frameCur = { x: 0, y: 0 };
  private shotName: ShotName = 'establish';
  private shot: Shot = SHOTS.establish();
  private cur: Shot = SHOTS.establish();
  private shotAt = 0;
  private baseFov = 32;
  private cache = new Map<string, THREE.Mesh>();
  private spawned: Spawned[] = [];
  private vig: Vig | null = null;
  vigId: string | null = null;
  private disposers: (() => void)[] = [];
  private lampLight: THREE.PointLight;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private beam: THREE.Mesh;
  private hourHand = new THREE.Group();
  private minHand = new THREE.Group();
  private pend = new THREE.Group();
  private clockSpin = 0;
  /** previewed clock time in minutes after midnight (null = real time) */
  clockAt: number | null = null;
  private clockShown = -1;
  ticking = false;
  private tickT = 0;
  private drawerObj = new THREE.Group();
  private drawerS = new Spring(0, 0, 120, 14);
  private plate: { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; name: string };
  private props = new THREE.Group();
  private pipAt: keyof typeof SPOT | 'custom' = 'desk';
  private trip: { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; done?: () => void } | null = null;
  private moteT = 0;
  private talkT = 0;
  private quality: 'low' | 'high';
  private glassesOn = true;
  private boardOn = true;
  /** world-space point the camera looks at, for anchoring UI */
  readonly focus = new THREE.Vector3();

  constructor(look: OwlLook, quality: 'low' | 'high' = 'high') {
    this.quality = quality;
    const s = this.scene;
    s.background = new THREE.Color(0x1a0f08);
    s.fog = new THREE.Fog(0x1a0f08, 16, 34);
    this.fx.setLight(new THREE.Color(1.0, 0.92, 0.82));
    s.add(this.fx.group, this.props);

    // ---- light: warm fill, the desk lamp, daylight (or moonlight) through the window
    this.hemi = new THREE.HemisphereLight(0xffeedd, 0x4a3424, 0.7);
    s.add(this.hemi, new THREE.AmbientLight(0x5a4a5a, 0.25));
    this.lampLight = new THREE.PointLight(0xffc46a, 3.2, 6, 1.6);
    this.lampLight.position.set(SPOT.lamp.x + U(2), DESK_TOP + U(8), SPOT.lamp.z + U(4));
    s.add(this.lampLight);
    const front = new THREE.PointLight(0xffe6cc, 1.3, 14, 1.2);
    front.position.set(0.5, 3.2, 3.5);
    s.add(front);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    const wdir = SPOT.window.clone().setY(0).normalize();
    this.sun.position.copy(SPOT.window).add(wdir.multiplyScalar(4)).add(new THREE.Vector3(0, 2.2, 0));
    this.sun.target.position.set(0.6, 0, -1.2);
    this.sun.castShadow = true;
    const sz = quality === 'high' ? 1024 : 512;
    this.sun.shadow.mapSize.set(sz, sz);
    Object.assign(this.sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    this.sun.shadow.bias = -0.0015;
    s.add(this.sun, this.sun.target);

    // ---- the room
    const add = (boxes: BoxSpec[], x = 0, y = 0, z = 0, ry = 0, density = 1) => {
      const m = P.mesh(boxes, density);
      m.position.set(x, y, z); m.rotation.y = ry;
      s.add(m);
      this.disposers.push(m.userData.dispose);
      return m;
    };
    add(P.shell());
    add(P.frontArch());
    add(P.desk(), 0, 0, DESK_Z);
    add(P.stool(), 0, 0, SPOT.desk.z);
    add(P.rug(36), U(8), 0.01, U(6));
    const lamp = P.deskLamp();
    add(lamp.boxes, SPOT.lamp.x, DESK_TOP, SPOT.lamp.z, 0.45);
    add(P.inkwell(), U(-13), DESK_TOP, U(-39));
    add(P.bookStack(1), U(22), DESK_TOP, U(-46));
    add(P.standingBooks(5, 2), U(14), DESK_TOP, U(-48), -0.1);
    add(P.paperStack(), U(8), DESK_TOP, U(-35));
    add(P.candle(), U(27), DESK_TOP, U(-33));
    add(P.teacup(), U(-27), DESK_TOP, U(-31));
    add(P.nameplate(), U(-6), DESK_TOP, U(-29.5), 0.12);
    const ca = 0.72;
    add(P.windowFrame(15), SPOT.window.x, SPOT.window.y, SPOT.window.z, ca);
    add(P.corkBoard(), SPOT.board.x, U(40), SPOT.board.z, -ca);
    add(P.shelf(), Math.sin(1.22) * U(R0 - 7), 0, -Math.cos(1.22) * U(R0 - 7), -1.22);
    add(P.fernPot(), Math.sin(-1.2) * U(R0 - 10), 0, -Math.cos(-1.2) * U(R0 - 10));
    add(P.fernPot(), U(-64), 0, U(32));
    add(P.bookStack(4), U(-46), 0, U(18), 0.4);
    add(P.hangingIvy(8, 2), U(-70), U(P.ROOM.H - 4), U(40));
    add(P.hangingIvy(6, 5), U(52), U(P.ROOM.H - 4), U(44));
    add(P.lanternHanging(), U(-30), U(P.ROOM.H - 6), U(-6));
    const hang = new THREE.PointLight(0xffc86a, 1.3, 6, 1.6);
    hang.position.set(U(-30), U(P.ROOM.H - 14), U(-6));
    s.add(hang);

    // the clock with moving hands and a pendulum
    const clock = add(P.clockBody(), 0, U(55), U(-R0 + 2.5), 0);
    void clock;
    const cz = U(-R0 + 2.5 + 2.3);
    this.hourHand.position.set(0, U(64), cz + U(0.1));
    this.minHand.position.set(0, U(64), cz + U(0.25));
    const hh = P.mesh(P.clockHand(4.4, 1.2), 2, false), mh = P.mesh(P.clockHand(6.4, 0.8), 2, false);
    this.hourHand.add(hh); this.minHand.add(mh);
    this.pend.position.set(0, U(53), U(-R0 + 4.6));
    const pm = P.mesh(P.pendulum(), 2, false);
    this.pend.add(pm);
    s.add(this.hourHand, this.minHand, this.pend);
    this.disposers.push(hh.userData.dispose, mh.userData.dispose, pm.userData.dispose);

    // the window: the painted sky behind the frame, and a soft beam of light into the room
    const skyMat = new THREE.MeshBasicMaterial({ map: this.sky.tex, toneMapped: false });
    const skyMesh = new THREE.Mesh(new THREE.CircleGeometry(U(15.2), 24), skyMat);
    // just behind the frame's mullions, in front of the wall (n = the wall's inward normal)
    const n = new THREE.Vector3(-Math.sin(-0.72), 0, Math.cos(-0.72));
    skyMesh.position.copy(SPOT.window).addScaledVector(n, -U(1.4));
    skyMesh.rotation.y = 0.72;
    s.add(skyMesh);
    this.disposers.push(() => { skyMesh.geometry.dispose(); skyMat.dispose(); });
    this.beam = this.makeBeam();
    s.add(this.beam);

    // the drawer slides out of the desk front
    const dm = P.mesh(P.drawer());
    this.drawerObj.add(dm);
    this.drawerObj.position.set(U(P.DESK.drawerX), U(P.DESK.h - 9.4), DESK_Z + U(P.DESK.d / 2));
    s.add(this.drawerObj);
    this.disposers.push(dm.userData.dispose);

    // the name plate's lettering
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 28;
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const pm2 = new THREE.Mesh(new THREE.PlaneGeometry(U(19), U(3)), new THREE.MeshLambertMaterial({ map: tex, emissive: 0x403020, emissiveMap: tex }));
    pm2.position.set(U(-6) + Math.sin(0.12) * U(1.25), DESK_TOP + U(2.4), U(-29.5) + Math.cos(0.12) * U(1.25));
    pm2.rotation.set(-20 * (Math.PI / 180), 0.12, 0, 'YXZ');
    s.add(pm2);
    this.plate = { cv, tex, name: '' };
    this.disposers.push(() => { pm2.geometry.dispose(); (pm2.material as THREE.Material).dispose(); tex.dispose(); });

    // ---- Pip
    this.pip = new OwlActor(look, {
      fx: (k, at, n) => this.owlFx(k, at, n),
      sound: (id) => sceneSound('owl_' + id),
    });
    s.add(this.pip.node);
    this.pip.node.position.copy(SPOT.desk);
    this.dress();

    s.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m !== this.beam) { m.receiveShadow = true; } });
    this.setNameplate('Pip');
    this.applyClock(0);
    this.cut('establish');
  }

  // ---------------------------------------------------------------- Pip's look

  /** Reading glasses on the nose and a tiny clipboard in the wings. */
  private dress() {
    const B = this.pip.model.rig.bones;
    const eyes = this.pip.model.eyeMeshes as THREE.Mesh[] | undefined;
    const ex = eyes?.[1] ? Math.abs(eyes[1].position.x) / PX : G.eyeX;
    const ey = eyes?.[1] ? eyes[1].position.y / PX : G.eyeY - 13.4;
    const ez = eyes?.[1] ? eyes[1].position.z / PX : G.discFront - 0.4;
    if (this.glassesOn && B.head) {
      const g = P.mesh(P.glasses(ex, 3.1), 4, false);
      g.position.set(0, U(ey - 0.6), U(ez + 0.9));
      g.name = 'ob-glasses';
      B.head.add(g);
    }
    if (this.boardOn && B.body) {
      const c = P.mesh(P.clipboardSmall(), 3, false);
      c.position.set(U(2.2), U(1.5), U(G.bodyD / 2 + 2.6));
      c.rotation.set(-0.95, -0.15, -0.1);
      c.name = 'ob-board';
      B.body.add(c);
    }
  }
  private undress() {
    for (const n of ['ob-glasses', 'ob-board']) {
      const o = this.pip.node.getObjectByName(n) as THREE.Mesh | undefined;
      if (o) { o.parent?.remove(o); (o.userData.dispose as (() => void) | undefined)?.(); }
    }
  }
  /** Hold the clipboard (and wear the glasses) or put them down. */
  props3(o: { glasses?: boolean; board?: boolean }) {
    if (o.glasses !== undefined) this.glassesOn = o.glasses;
    if (o.board !== undefined) this.boardOn = o.board;
    this.undress(); this.dress();
  }

  /** Swap Pip's look with a puff of feathers (the species preview). */
  setLook(look: OwlLook, poof = true) {
    this.undress();
    this.pip.rebuild(look);
    this.dress();
    if (poof) {
      const at = this.pip.node.position.clone().add(new THREE.Vector3(0, 1.0, 0.1));
      this.fx.burst('sparkle', at.x, at.y, at.z, 10);
      this.owlFx('feather', at, 9);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.fx.emit({ x: at.x, y: at.y - 0.3, z: at.z, vx: Math.cos(a) * 1.4, vy: 0.4 + Math.random() * 0.6, vz: Math.sin(a) * 1.4, life: 0.7, frame: SPR.puff1, frames: 3, fps: 6, color: 0xfff4e0, size: 0.55, drag: 3, grow: 0.8 });
      }
      this.pip.play('ruffle');
      sound.play('tp_shimmer', { volume: 0.35, gap: 120 });
    }
  }

  setNameplate(name: string) {
    if (name === this.plate.name) return;
    this.plate.name = name;
    const { cv, tex } = this.plate, g = cv.getContext('2d')!;
    g.fillStyle = '#4a2c18'; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#c9a14a'; g.fillRect(2, 2, cv.width - 4, 2); g.fillRect(2, cv.height - 4, cv.width - 4, 2); g.fillRect(2, 2, 2, cv.height - 4); g.fillRect(cv.width - 4, 2, 2, cv.height - 4);
    g.font = '18px "TBME Body", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#1e1008'; g.fillText(name || '...', cv.width / 2 + 1, cv.height / 2 + 2);
    g.fillStyle = '#ffd86a'; g.fillText(name || '...', cv.width / 2, cv.height / 2 + 1);
    tex.needsUpdate = true;
  }

  private owlFx(k: OwlFx, at: THREE.Vector3, n = 3) {
    const fx = this.fx;
    if (k === 'heart') fx.burst('hearts', at.x, at.y, at.z, n);
    else if (k === 'note') fx.burst('notes', at.x, at.y, at.z, n);
    else if (k === 'zzz') fx.burst('zzz', at.x + 0.2, at.y, at.z, Math.max(2, n));
    else if (k === 'sparkle') fx.burst('sparkle', at.x, at.y, at.z, n);
    else if (k === 'dust') this.puff(at, n);
    else if (k === 'feather') {
      const col = featherColour(this.pip.model.look.palette);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        fx.emit({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * 0.9, vy: 0.6 + Math.random() * 0.8, vz: Math.sin(a) * 0.9, life: 1.4 + Math.random(), frame: SPR.feather1, frames: 3, fps: 3, color: col, size: 0.2, gravity: 1.1, drag: 2.2, flutter: 0.6 });
      }
    }
  }
  /** a ring of dust puffs (props landing, Pip landing) */
  puff(at: THREE.Vector3, n = 6, col = 0xe8d8bc) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      this.fx.emit({ x: at.x + Math.cos(a) * 0.15, y: at.y + 0.05, z: at.z + Math.sin(a) * 0.15, vx: Math.cos(a) * 1.1, vy: 0.25 + Math.random() * 0.3, vz: Math.sin(a) * 1.1, life: 0.45 + Math.random() * 0.2, frame: SPR.puff1, frames: 3, fps: 7, color: col, size: 0.32, drag: 3.2, grow: 0.6 });
    }
  }
  sparkle(at: THREE.Vector3, n = 6) { this.fx.burst('sparkle', at.x, at.y, at.z, n); }

  // ---------------------------------------------------------------- camera

  /** Move the camera to a shot (smoothly), or cut straight to it. */
  go(name: ShotName, cut = false) {
    if (name === this.shotName && !cut) return;
    this.shotName = name;
    this.shot = SHOTS[name]();
    this.shotAt = this.time;
    if (cut) this.snap();
  }
  cut(name: ShotName) { this.go(name, true); }
  get shotNow() { return this.shotName; }
  private snap() { const s = this.shot; this.cur = { target: s.target.clone(), yaw: s.yaw, pitch: s.pitch, dist: s.dist }; }

  /** Screen position (CSS px) of a world point under the current camera. */
  screenOf(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
  }
  headScreen() { return this.screenOf(this.pip.headWorld); }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    const a = this.camera.aspect;
    this.baseFov = a >= 1 ? 40 : Math.min(72, (2 * Math.atan(Math.tan((20 * Math.PI) / 180) / Math.min(1, a * 1.08)) * 180) / Math.PI);
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  private applyCamera(dt: number) {
    const t = this.time, s = this.shot, c = this.cur;
    // the pillow tower shot rides up with Pip
    if (this.shotName === 'tower') s.target.y = 0.9 + this.pip.node.position.y * 0.8;
    const k = 1 - Math.exp(-dt * 2.1);
    c.yaw += (s.yaw - c.yaw) * k; c.pitch += (s.pitch - c.pitch) * k; c.dist += (s.dist - c.dist) * k; c.target.lerp(s.target, k);
    // slow push-in after each move, and a soft handheld drift
    const since = t - this.shotAt, push = 1 - 0.075 * Math.min(1, since / 9) * Math.min(1, since / 9);
    const yaw = c.yaw + Math.sin(t * 0.37) * 0.012 + Math.sin(t * 1.13 + 1) * 0.004;
    const pitch = c.pitch + Math.sin(t * 0.51 + 2) * 0.008 + Math.sin(t * 1.7) * 0.002;
    const dist = c.dist * push * (this.camera.aspect < 0.8 ? 1.12 : 1);
    const cp = Math.cos(pitch);
    const tg = c.target;
    this.camera.position.set(tg.x + Math.sin(yaw) * cp * dist, tg.y + Math.sin(pitch) * dist, tg.z + Math.cos(yaw) * cp * dist);
    this.camera.lookAt(tg.x + Math.sin(t * 0.29) * 0.015, tg.y + Math.sin(t * 0.43) * 0.01, tg.z);
    this.camera.rotation.z += Math.sin(t * 0.23) * 0.004;
    this.focus.copy(tg);
    // framing around the UI
    const kf = 1 - Math.exp(-dt * 3);
    this.frameCur.x += (this.frame.x - this.frameCur.x) * kf; this.frameCur.y += (this.frame.y - this.frameCur.y) * kf;
    const w = innerWidth, h = innerHeight;
    if (Math.abs(this.frameCur.x) > 0.002 || Math.abs(this.frameCur.y) > 0.002) this.camera.setViewOffset(w, h, this.frameCur.x * w, this.frameCur.y * h, w, h);
    else this.camera.clearViewOffset();
    const fov = s.fov ?? this.baseFov;
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov += (fov - this.camera.fov) * k; this.camera.updateProjectionMatrix(); }
  }

  // ---------------------------------------------------------------- Pip's moves

  /** Hop Pip to a spot (a little flying arc with flaps and a dusty landing). */
  pipTo(spot: keyof typeof SPOT | THREE.Vector3, done?: () => void) {
    const to = spot instanceof THREE.Vector3 ? spot.clone() : SPOT[spot].clone();
    this.pipAt = spot instanceof THREE.Vector3 ? 'custom' : spot;
    const from = this.pip.node.position.clone();
    if (from.distanceTo(to) < 0.05) { this.trip = null; this.pip.node.position.copy(to); done?.(); return; }
    this.trip = { from, to, t: 0, dur: 0.55 + Math.min(0.5, from.distanceTo(to) * 0.12), done };
    // the clipboard stays on the desk while Pip is off acting things out
    if (this.pipAt !== 'desk' && this.boardOn) this.props3({ board: false });
    this.pip.pose = 'fly';
    sound.play('wings_flutter', { volume: 0.5, gap: 150 });
  }
  get pipSpot() { return this.pipAt; }
  /** Place Pip without the hop. */
  placePip(spot: keyof typeof SPOT) { this.trip = null; this.pipAt = spot; this.pip.node.position.copy(SPOT[spot]); this.pip.pose = 'stand'; this.props3({ board: spot === 'desk' }); }

  private stepTrip(dt: number) {
    const tr = this.trip;
    if (!tr) return;
    tr.t += dt / tr.dur;
    const k = Math.min(1, tr.t), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const p = this.pip.node.position;
    p.lerpVectors(tr.from, tr.to, e);
    p.y += Math.sin(k * Math.PI) * (0.7 + tr.from.distanceTo(tr.to) * 0.12);
    const dx = tr.to.x - tr.from.x, dz = tr.to.z - tr.from.z;
    if (Math.hypot(dx, dz) > 0.1) this.pip.node.rotation.y = Math.atan2(dx, dz) * Math.sin(k * Math.PI) * 0.6;
    if (k >= 1) {
      this.trip = null;
      this.pip.node.rotation.y = 0;
      this.pip.pose = 'stand';
      this.puff(tr.to, 6);
      sound.play('pet_land', { volume: 0.4, gap: 100 });
      if (this.pipAt === 'desk' && !this.boardOn) this.props3({ board: true });
      tr.done?.();
    }
  }

  /** Pip's beak flaps while the floating text is talking. */
  talk() {
    const s = (this.pip as unknown as { s?: { jaw?: Spring; sy?: Spring } }).s;
    s?.jaw?.v !== undefined && (s.jaw.v += 7);
    s?.sy?.v !== undefined && (s.sy.v -= 0.25);
    this.talkT = 0.25;
  }

  // ---------------------------------------------------------------- the clock and the drawer

  /** Spin the clock hands round and let them settle (a steady routine!). */
  spinClock(turns = 3) { this.clockSpin += turns * Math.PI * 2; sound.play('clock_wind', { volume: 0.5, gap: 200 }); }
  drawer(open: boolean) { this.drawerS.target = open ? U(13) : 0; sound.play('drawer', { volume: 0.55, gap: 150 }); }

  private applyClock(dt: number) {
    const now = new Date();
    const mins = this.clockAt ?? now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    if (this.clockSpin > 0) this.clockSpin = Math.max(0, this.clockSpin - dt * (1.2 + this.clockSpin * 2.2));
    const m = (mins % 60) / 60, h = ((mins / 60) % 12) / 12;
    this.minHand.rotation.z = -(m * Math.PI * 2 + this.clockSpin * 12);
    this.hourHand.rotation.z = -(h * Math.PI * 2 + this.clockSpin);
    this.pend.rotation.z = Math.sin(this.time * Math.PI) * 0.22;
    if (this.ticking) {
      this.tickT -= dt;
      if (this.tickT <= 0) { this.tickT = 1; sound.play('clock_tick', { volume: 0.25, gap: 400 }); }
    }
    this.clockShown = mins;
  }

  // ---------------------------------------------------------------- props that pop in

  private built(id: string, make: () => BoxSpec[], density = 1): THREE.Mesh {
    let m = this.cache.get(id);
    if (!m) { m = P.mesh(make(), density); this.cache.set(id, m); }
    const c = m.clone();
    c.castShadow = true; c.receiveShadow = true;
    return c;
  }

  /**
   * Pop a prop into the room with squash and stretch and a puff of dust. Returns the object; its
   * `tick` runs every frame while it lives.
   */
  spawn(id: string, make: () => BoxSpec[], at: THREE.Vector3, o: { ry?: number; scale?: number; delay?: number; density?: number; tick?: Spawned['tick']; quiet?: boolean } = {}): THREE.Object3D {
    const g = new THREE.Group();
    g.add(this.built(id, make, o.density ?? 1));
    g.position.copy(at);
    g.rotation.y = o.ry ?? 0;
    g.userData.scale = o.scale ?? 1;
    g.scale.setScalar(0.001);
    this.props.add(g);
    this.spawned.push({ obj: g, s: new Spring(0, 1, 260, 13), dying: false, delay: o.delay ?? 0, base: at.clone(), tick: o.tick, born: this.time });
    if (!o.quiet) window.setTimeout(() => { sound.play('pickup_item', { volume: 0.35, rate: 1.1 + Math.random() * 0.2, gap: 60 }); }, (o.delay ?? 0) * 1000);
    return g;
  }
  /** Pop one prop out. */
  despawn(obj: THREE.Object3D) { const s = this.spawned.find((x) => x.obj === obj); if (s && !s.dying) { s.dying = true; s.s.target = 0; s.s.k = 300; } }
  /** Pass a live value to the running vignette. */
  param(v: number) { this.vig?.set?.(v); }
  /** Pop every vignette prop out. */
  clearProps() { for (const s of this.spawned) if (!s.dying) { s.dying = true; s.s.target = 0; s.s.k = 300; } }
  private stepProps(dt: number) {
    const keep: Spawned[] = [];
    for (const s of this.spawned) {
      if (s.delay > 0) { s.delay -= dt; if (s.delay <= 0) this.puff(s.obj.position, 7); keep.push(s); continue; }
      if (s.born >= 0 && !s.dying && s.s.x === 0 && s.s.v === 0 && s.delay <= 0) { this.puff(s.obj.position, 7); this.sparkle(s.obj.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 3); s.born = -1; }
      s.s.step(dt);
      const sc = Math.max(0.001, s.s.x) * (s.obj.userData.scale as number);
      const sq = THREE.MathUtils.clamp(s.s.v * 0.025, -0.25, 0.25);
      s.obj.scale.set(sc * (1 - sq * 0.5), sc * (1 + sq), sc * (1 - sq * 0.5));
      s.tick?.(s.obj, this.time, dt);
      if (s.dying && s.s.x < 0.02) {
        s.obj.parent?.remove(s.obj);
        continue;
      }
      keep.push(s);
    }
    this.spawned = keep;
  }

  // ---------------------------------------------------------------- vignettes

  /** Start a vignette (props, Pip's acting, camera); null clears it. */
  setVignette(id: string | null, make?: (r: InterviewRoom) => Vig) {
    if (id === this.vigId) return;
    this.vig?.exit?.();
    this.vig = null;
    this.clearProps();
    this.vigId = id;
    if (id && make) this.vig = make(this);
  }

  /** Weather and hour shown through the window. */
  window(hour: number | null, w: Weather = 'clear') { this.sky.set(hour, w); }

  // ---------------------------------------------------------------- frame

  private makeBeam() {
    const cv = document.createElement('canvas'); cv.width = 8; cv.height = 32;
    const g = cv.getContext('2d')!;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 8; x++) {
      const across = 1 - Math.abs(x - 3.5) / 4, along = Math.min(1, y / 6) * (1 - y / 34);
      const a = Math.floor(across * along * 5) / 5;
      g.fillStyle = `rgba(255,255,255,${(a * 0.9).toFixed(2)})`; g.fillRect(x, y, 1, 1);
    }
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const geo = new THREE.PlaneGeometry(1.6, 6.2);
    const m = new THREE.Mesh(geo, mat);
    const from = SPOT.window.clone(), to = new THREE.Vector3(0.4, 0, -1.6);
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to); m.rotateX(Math.PI / 2);
    m.position.y += 0.1;
    this.disposers.push(() => { geo.dispose(); mat.dispose(); tex.dispose(); });
    return m;
  }

  update(dt: number, t: number) {
    void t;
    this.time += dt;
    this.sky.update(dt);
    // daylight follows the window
    this.sun.color.copy(this.sky.light);
    this.sun.intensity = this.sky.lightI * 1.2;
    (this.beam.material as THREE.MeshBasicMaterial).color.copy(this.sky.light);
    (this.beam.material as THREE.MeshBasicMaterial).opacity = 0.05 + this.sky.lightI * 0.07;
    this.hemi.intensity = 0.55 + this.sky.lightI * 0.18;
    this.lampLight.intensity = 3.2 + Math.sin(this.time * 9) * 0.08 + Math.sin(this.time * 23) * 0.05;

    this.stepTrip(dt);
    if (this.talkT > 0) this.talkT -= dt;
    this.pip.dark = this.sky.night * 0.4;
    this.pip.update(dt);
    this.drawerS.step(dt);
    this.drawerObj.position.z = DESK_Z + U(P.DESK.d / 2) + this.drawerS.x;
    this.applyClock(dt);
    this.stepProps(dt);
    this.vig?.update?.(this.time, dt);

    // dust motes drifting in the window light
    if ((this.moteT -= dt) <= 0) {
      this.moteT = this.quality === 'high' ? 0.12 : 0.3;
      const k = Math.random(), p = SPOT.window.clone().lerp(new THREE.Vector3(0.4, 0.2, -1.6), k);
      this.fx.emit({ x: p.x + (Math.random() - 0.5) * 0.8, y: p.y + (Math.random() - 0.5) * 0.6, z: p.z + (Math.random() - 0.5) * 0.8, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.3) * 0.05, vz: (Math.random() - 0.5) * 0.06, life: 4 + Math.random() * 3, frame: SPR.mote, color: 0xfff0c8, size: 0.12 + Math.random() * 0.08, add: true, fadeIn: 1, fadeOut: 1.5, flutter: 0.05 });
    }
    this.fx.update(dt, this.time);
    this.applyCamera(dt);
  }

  dispose() {
    this.vig?.exit?.();
    for (const d of this.disposers) d?.();
    for (const m of this.cache.values()) (m.userData.dispose as (() => void) | undefined)?.();
    this.cache.clear();
    this.undress();
    this.pip.dispose();
    this.sky.dispose();
  }
}
