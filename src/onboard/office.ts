// Hollow & Co.: Pip's executive office, shown as a Stage (see world/scene.ts) with its own HD-2D picture
// (look.ts). The room and furniture are built in code (furnish.ts, desk.ts) with hand-painted pixel textures;
// the light is physical: a low sun or the moon through venetian blinds (real shadows, striped light shafts with
// dust drifting in them), the banker's lamp's warm pool, brass sconces, a soft environment for brass and glass.
// The window shows the real forest outside. A cinematic camera with named shots, slow push-ins, handheld drift,
// off-axis framing (the subject can sit anywhere on screen) and an opening pull-back out of the wall clock.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { sceneSound, sound } from '../audio/sound.ts';
import { OwlActor, type OwlFx } from '../owl/actor.ts';
import { featherColour, type OwlLook } from '../owl/model.ts';
import { PIECE } from '../owl/outfits.ts';
import { Fx, SPR } from '../world/fx.ts';
import type { Stage } from '../world/scene.ts';
import { HOUSE } from '../world/layout.ts';
import { modelUrl } from '../gfx/glb.ts';
import { Look } from './look.ts';
import { officeMats, type OfficeMats } from './mats.ts';
import { buildCabinets, buildChair, buildCredenza, buildDesk, buildRoom, buildShelves, buildWindow, certificate, DESK_TOP, frame, L, spineAtlas, type WindowParts } from './furnish.ts';
import { bankersLamp, carafeSet, carriageClock, DESK, deskPhone, fountainPen, folder, inkPad, inOutTrays, nameplate, paperwork, pottedFig, rubberStamp, sconce, stickyNote, writingSlope, type Lamp } from './desk.ts';
import { WallClock } from './wallclock.ts';
import { SkyView, type Weather } from './skyview.ts';
import { fontsReady } from './fonts.ts';

/** The live world, for the real view through the window (world/scene.ts Scene). */
export interface WorldView {
  renderView(camera: THREE.Camera, target: THREE.WebGLRenderTarget): void;
  viewTarget(w: number, h: number): THREE.WebGLRenderTarget;
  setHour(h: number | null): void;
}

export type ShotName = 'establish' | 'pip' | 'pipL' | 'pipR' | 'close' | 'desk' | 'window' | 'clock' | 'clockwin' | 'board' | 'floor' | 'bed' | 'low' | 'wide' | 'tower' | 'form' | 'formClock' | 'stamp' | 'tray' | 'open';
/** A camera shot: look at `target` from direction (yaw, pitch), far enough to fit `fit` (w x h metres), with the
 * target placed at `anchor` on screen (NDC, off-axis), optionally a fixed distance. */
export interface Shot { target: THREE.Vector3; yaw: number; pitch: number; fit: [number, number]; anchor?: [number, number]; dist?: number; roll?: number; drift?: number }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const PIP_H = 0.8;
/** where Pip stands: on the seat cushion of his chair */
export const PIP_AT = V(L.chair.x, L.seat + 0.01, L.chair.z + 0.1);
const HEAD = V(0, L.seat + PIP_H * 0.78, L.chair.z + 0.12);

/** Window light by hour: [hour, colour, intensity, ambient sky colour, night] */
const SUN: [number, number, number, number, number][] = [
  [0, 0x8fa6d6, 0.9, 0x223356, 1], [5, 0x9fb0d8, 0.9, 0x2a3a5e, 1], [6.2, 0xffb07a, 2.4, 0x6a7aa0, 0.45], [7.5, 0xffd49a, 4.2, 0x9ab8d8, 0],
  [12, 0xfff0d6, 4.6, 0xb8d4ea, 0], [16.5, 0xffd8a0, 4.4, 0xa8c4de, 0], [18.6, 0xff9a5a, 3.2, 0x8a7aa0, 0.25], [19.8, 0xb07ab0, 1.4, 0x3a3a6a, 0.8], [21, 0x8fa6d6, 0.9, 0x223356, 1], [24, 0x8fa6d6, 0.9, 0x223356, 1],
];
function sunAt(h: number) {
  h = ((h % 24) + 24) % 24;
  let i = 0;
  while (i < SUN.length - 2 && SUN[i + 1][0] <= h) i++;
  const a = SUN[i], b = SUN[i + 1], t = (h - a[0]) / (b[0] - a[0]);
  return { col: new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t), i: a[2] + (b[2] - a[2]) * t, sky: new THREE.Color(a[3]).lerp(new THREE.Color(b[3]), t), night: a[4] + (b[4] - a[4]) * t };
}

/** A damped spring for one number. */
export class Spring {
  v = 0;
  constructor(public x = 0, public target = 0, public k = 160, public d = 12) {}
  step(dt: number) { const a = (this.target - this.x) * this.k - this.v * this.d; this.v += a * dt; this.x += this.v * dt; return this.x; }
}

export type PointerFn = (type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray, e: PointerEvent) => boolean | void;

export class Office implements Stage {
  /** what the app's renderer draws (the finished picture); the office itself is `room` */
  readonly scene: THREE.Scene;
  readonly room = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.03, 40);
  readonly look: Look;
  readonly fx = new Fx(900);
  readonly sky = new SkyView();
  readonly mats: OfficeMats;
  time = 0;
  /** pointer handler set by the interview */
  onPointer: PointerFn | null = null;
  /** called every frame after the office updates (the interview's paper and tools) */
  readonly tickers = new Set<(dt: number, t: number) => void>();
  ready: Promise<void>;
  private actor: OwlActor;
  private actors = new Map<string, OwlActor>();
  get pip(): OwlActor { return this.actor; }

  // camera
  private shotName: ShotName = 'establish';
  private shot!: Shot;
  private cur!: { target: THREE.Vector3; yaw: number; pitch: number; dist: number; ax: number; ay: number; roll: number };
  private shotAt = 0;
  private moveK = 2.1;
  private vfov = 40;
  /** a scripted camera move overrides the shots while set (the opening pull-back) */
  rig: ((t: number) => { pos: THREE.Vector3; look: THREE.Vector3; ax?: number; ay?: number } | null) | null = null;
  private shake = 0;

  // light
  private sun: THREE.SpotLight;
  private hemi: THREE.HemisphereLight;
  private lampLight: THREE.SpotLight;
  private lampGlow: THREE.PointLight;
  private fill: THREE.PointLight;
  private sconceLights: THREE.PointLight[] = [];
  private shafts: THREE.Mesh[] = [];
  private shaftMat: THREE.ShaderMaterial;
  private hourWant: number | null = null;
  private lampK = 1;
  private lampWant = 1;
  private hourNow = new Date().getHours() + new Date().getMinutes() / 60;

  // parts
  win!: WindowParts;
  lamp!: Lamp;
  clock!: WallClock;
  deskClock!: ReturnType<typeof carriageClock>;
  plate!: ReturnType<typeof nameplate>;
  pen!: THREE.Group;
  stamp!: THREE.Group;
  pad!: THREE.Group;
  folder!: ReturnType<typeof folder>;
  sticky!: ReturnType<typeof stickyNote>;
  trays!: ReturnType<typeof inOutTrays>;
  private sway: { o: THREE.Object3D; ph: number }[] = [];
  private world: WorldView | null;
  private winRT: THREE.WebGLRenderTarget | null = null;
  private winCam = new THREE.PerspectiveCamera(48, 1.1, 0.3, 400);
  private winT = 0;
  private moteT = 0;
  private disposers: (() => void)[] = [];
  private quality: 'low' | 'high';
  private built = false;
  private pmrem: THREE.PMREMGenerator | null = null;

  constructor(look: OwlLook, private renderer: THREE.WebGLRenderer, quality: 'low' | 'high' = 'high', world: WorldView | null = null) {
    this.quality = quality;
    this.world = world;
    this.look = new Look(renderer, quality);
    this.scene = this.look.present;
    const s = this.room;
    s.background = new THREE.Color(0x120c08);
    this.fx.setLight(new THREE.Color(1, 0.95, 0.88));
    s.add(this.fx.group);
    this.mats = officeMats();
    // a soft studio environment so brass, lacquer and glass catch real highlights
    try {
      this.pmrem = new THREE.PMREMGenerator(renderer);
      const env = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      s.environment = env;
      (s as unknown as { environmentIntensity: number }).environmentIntensity = 0.32;
      this.disposers.push(() => env.dispose());
    } catch { /* no PMREM: plain lights only */ }

    // ---- light
    this.hemi = new THREE.HemisphereLight(0xb8c8e0, 0x3a2416, 0.35);
    s.add(this.hemi);
    // the sun (or moon) through the blinds: a spot outside the window so the slats cast real stripes
    this.sun = new THREE.SpotLight(0xffe0b0, 30, 0, Math.PI / 7, 0.35, 0);
    this.sun.position.set(L.x0 - 4.2, 4.3, L.window.z + 1.6);
    this.sun.target.position.set(0.1, DESK_TOP, -1.05);
    this.sun.castShadow = true;
    const sz = quality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    this.sun.shadow.camera.near = 2; this.sun.shadow.camera.far = 12;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 2;
    s.add(this.sun, this.sun.target);
    // the banker's lamp: a warm cone onto the leather
    this.lampLight = new THREE.SpotLight(0xffc77a, 6, 3.2, Math.PI / 3.2, 0.7, 1.6);
    this.lampLight.position.copy(DESK.lamp).add(V(0, 0.33, 0.05));
    this.lampLight.target.position.copy(DESK.lamp).add(V(0.35, -0.2, 0.45));
    this.lampLight.castShadow = quality === 'high';
    this.lampLight.shadow.mapSize.set(512, 512);
    this.lampLight.shadow.bias = -0.0008; this.lampLight.shadow.normalBias = 0.01;
    this.lampLight.shadow.camera.near = 0.05; this.lampLight.shadow.camera.far = 3.2;
    s.add(this.lampLight, this.lampLight.target);
    this.lampGlow = new THREE.PointLight(0xffb85a, 0.9, 1.6, 2);
    this.lampGlow.position.copy(DESK.lamp).add(V(0, 0.42, 0.1));
    s.add(this.lampGlow);
    // a warm fill from the visitor's side (the room's own light), low
    this.fill = new THREE.PointLight(0xffd8a8, 2.2, 9, 1.4);
    this.fill.position.set(0.6, 2.4, 1.6);
    s.add(this.fill);

    // ---- Pip
    this.actor = this.makeActor(look);
    s.add(this.actor.node);
    this.placePip();

    this.cut('establish');
    this.shaftMat = this.makeShaftMat();
    this.ready = this.build();
  }

  // ---------------------------------------------------------------- building

  private async build() {
    await fontsReady();
    const idle = () => new Promise<void>((r) => setTimeout(r, 0));
    const s = this.room, m = this.mats;
    s.add(buildRoom(m));
    await idle();
    // the window and the real view outside
    let viewMat: THREE.Material;
    if (this.world) {
      this.winRT = this.world.viewTarget(this.quality === 'high' ? 200 : 128, this.quality === 'high' ? 220 : 140);
      const d = new THREE.Vector3(-0.66, 0, 1).normalize();
      this.winCam.position.set(HOUSE.x + d.x * (HOUSE.r + 0.6), 6.2, HOUSE.z + d.z * (HOUSE.r + 0.6));
      this.winCam.lookAt(this.winCam.position.clone().addScaledVector(d, 10).add(V(0, -1.2, 0)));
      this.winCam.updateMatrixWorld();
      viewMat = new THREE.MeshBasicMaterial({ map: this.winRT.texture, toneMapped: false });
      this.disposers.push(() => { this.winRT?.dispose(); this.world?.setHour(null); });
    } else viewMat = new THREE.MeshBasicMaterial({ map: this.sky.tex, toneMapped: false });
    this.win = buildWindow(m, viewMat);
    s.add(this.win.group);
    this.addShafts();
    await idle();
    s.add(buildShelves(m, spineAtlas()));
    await idle();
    const desk = buildDesk(m);
    desk.position.set(L.desk.x, 0, L.desk.z);
    s.add(desk);
    const chair = buildChair(m);
    chair.position.set(L.chair.x, 0, L.chair.z);
    s.add(chair);
    const cred = buildCredenza(m);
    cred.position.set(L.cred.x, 0, L.cred.z);
    s.add(cred);
    s.add(buildCabinets(m));
    await idle();
    // the wall clock over the credenza (its face is the loading clock's own painting)
    this.clock = new WallClock(m);
    this.clock.group.position.set(L.clock.x, L.clock.y, L.z0 + 0.004);
    s.add(this.clock.group);
    await this.clock.ready;
    // sconces either side of the clock
    for (const sx of [-1, 1]) {
      const sc = sconce(m);
      sc.group.position.set(sx * 0.82, 1.92, L.z0 + 0.01);
      s.add(sc.group);
      const pl = new THREE.PointLight(0xffb866, 1.1, 3.2, 1.8);
      pl.position.set(sx * 0.82, 2.04, L.z0 + 0.16);
      s.add(pl);
      this.sconceLights.push(pl);
    }
    // the right wall: a big real landscape painting and two certificates; a portrait print over the cabinets
    const artTex = new THREE.TextureLoader().load(modelUrl('interview/art.webp'), (t) => { t.needsUpdate = true; });
    artTex.colorSpace = THREE.SRGBColorSpace; artTex.magFilter = THREE.NearestFilter; artTex.minFilter = THREE.LinearMipmapLinearFilter; artTex.anisotropy = 4;
    this.disposers.push(() => artTex.dispose());
    const artMat = (u0: number, v0: number, u1: number, v1: number) => {
      const t = artTex.clone(); t.repeat.set(u1 - u0, v1 - v0); t.offset.set(u0, 1 - v1); t.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
    };
    // art.webp (src/onboard/tools/officeart.py): Inness's Catskill Mountains, Hiroshige's owl, Bazille's Chailly
    const big = frame(m, 1.2, 0.797, artMat(0, 0, 384 / 512, 255 / 512), { mould: 0.08 });
    big.position.set(L.x1 - 0.03, 1.78, -1.25); big.rotation.y = -Math.PI / 2;
    s.add(big);
    const owlPrint = frame(m, 0.3, 0.825, artMat(384 / 512, 0, 1, 352 / 512), { mould: 0.035, mat: m.blackLacquer, mount: 0 });
    owlPrint.position.set(L.x1 - 0.03, 1.9, L.cabinets.z - 0.05); owlPrint.rotation.y = -Math.PI / 2;
    s.add(owlPrint);
    const chailly = frame(m, 0.9, 0.726, artMat(0, 256 / 512, 310 / 512, 506 / 512), { mould: 0.07 });
    chailly.position.set(L.x0 + 0.03, 1.78, 1.35); chailly.rotation.y = Math.PI / 2;
    s.add(chailly);
    const certA = frame(m, 0.36, 0.27, new THREE.MeshStandardMaterial({ map: certificate('CERTIFICATE', ['of Excellence in Sleep', 'Pip', 'Head of Sleep, Hollow & Co.']), roughness: 0.7 }), { mould: 0.03, mat: m.blackLacquer });
    certA.position.set(L.x1 - 0.03, 1.72, 0.42 + 0.75); certA.rotation.y = -Math.PI / 2;
    const certB = frame(m, 0.36, 0.27, new THREE.MeshStandardMaterial({ map: certificate('DIPLOMA', ['Hoot Hollow School of Dreams', 'Master of Naps', 'awarded with distinction']), roughness: 0.7 }), { mould: 0.03, mat: m.blackLacquer });
    certB.position.set(L.x1 - 0.03, 2.12, 0.42 + 0.75); certB.rotation.y = -Math.PI / 2;
    s.add(certA, certB);
    await idle();
    // the desk top
    const T = DESK_TOP;
    this.lamp = bankersLamp(m);
    this.lamp.group.position.copy(DESK.lamp); this.lamp.group.rotation.y = 0.35;
    s.add(this.lamp.group);
    const ph = deskPhone(m);
    ph.position.copy(DESK.phone); ph.rotation.y = -0.45;
    s.add(ph);
    this.trays = inOutTrays(m);
    this.trays.group.position.copy(DESK.trays); this.trays.group.rotation.y = -0.12;
    s.add(this.trays.group);
    this.plate = nameplate(m, 'Pip', 'HEAD OF SLEEP');
    this.plate.group.position.copy(DESK.nameplate); this.plate.group.rotation.y = 0.18;
    s.add(this.plate.group);
    const work = paperwork(m);
    work.position.copy(DESK.work); work.rotation.y = 0.1;
    s.add(work);
    const slope = writingSlope(m);
    slope.position.copy(DESK.slope);
    s.add(slope);
    this.pen = fountainPen(m);
    this.pen.position.copy(DESK.pen).add(V(-0.13, 0, 0)); this.pen.rotation.y = 0.04;
    s.add(this.pen);
    this.pad = inkPad(m);
    this.pad.position.copy(DESK.stamp).add(V(0.0, 0, -0.02)); this.pad.rotation.y = -0.2;
    s.add(this.pad);
    this.stamp = rubberStamp(m);
    this.stamp.position.copy(this.pad.position).add(V(0, 0.018, 0)); this.stamp.rotation.order = 'YXZ'; this.stamp.rotation.y = -0.2;
    s.add(this.stamp);
    this.folder = folder();
    this.folder.group.position.copy(DESK.folder); this.folder.group.rotation.y = -0.08;
    s.add(this.folder.group);
    this.deskClock = carriageClock(m);
    this.deskClock.group.position.copy(DESK.clock); this.deskClock.group.rotation.y = 0.3;
    s.add(this.deskClock.group);
    // the skip note travels stuck to the corner of each form (see quiz.ts)
    this.sticky = stickyNote();
    const car = carafeSet(m);
    car.position.set(-0.5, L.cred.h, L.cred.z + 0.02);
    s.add(car);
    // a few ledgers and a bust-like brass globe on the credenza
    // the plants: a tall fig by the window, a smaller one by the cabinets
    const fig = pottedFig(m, 1, 1.9);
    fig.group.position.set(L.x0 + 0.42, 0, L.z0 + 0.55);
    s.add(fig.group);
    this.sway.push({ o: fig.leaves, ph: 0 });
    const fig2 = pottedFig(m, 4, 1.35);
    fig2.group.position.set(L.x1 - 0.45, 0, L.cabinets.z - 0.9);
    fig2.group.scale.setScalar(0.85);
    s.add(fig2.group);
    this.sway.push({ o: fig2.leaves, ph: 2 });
    void T;
    this.dress();
    this.built = true;
    this.window(null);
  }

  /** Light shafts through the blinds: soft additive slabs along the sun's direction, striped like the slats. */
  private makeShaftMat() {
    return new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uCol: { value: new THREE.Color(1, 0.85, 0.6) }, uAmt: { value: 0.12 }, uTime: { value: 0 }, uStripes: { value: 40 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uAmt; uniform float uTime; uniform float uStripes; varying vec2 vUv;
        float h(float x){ return fract(sin(x * 91.7) * 4375.5); }
        void main(){
          float s = step(0.42, fract(vUv.y * uStripes));
          float along = smoothstep(0.0, 0.08, vUv.x) * (1.0 - smoothstep(0.35, 1.0, vUv.x));
          float edge = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
          float flick = 0.85 + 0.15 * sin(uTime * 0.6 + vUv.x * 3.0);
          float a = s * along * edge * uAmt * flick;
          gl_FragColor = vec4(uCol * a, a);
        }`,
    });
  }
  private addShafts() {
    const o = this.win.opening;
    const from = this.sun.position, toward = this.sun.target.position.clone();
    const dir = toward.clone().sub(from).normalize();
    // a few slabs across the window width, each from the glass into the room along the light
    const n = 5;
    for (let i = 0; i < n; i++) {
      const z = o.z0 + 0.1 + ((o.z1 - o.z0 - 0.2) * (i + 0.5)) / n;
      const len = 3.4, hgt = o.y1 - o.y0 - 0.1;
      const g = new THREE.PlaneGeometry(len, hgt, 1, 1);
      g.translate(len / 2, 0, 0);
      const mesh = new THREE.Mesh(g, this.shaftMat);
      mesh.position.set(o.x + 0.25, (o.y0 + o.y1) / 2, z);
      // orient the slab: x axis along the light direction, plane vertical-ish
      const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), dir);
      mesh.quaternion.copy(q);
      mesh.renderOrder = 5;
      mesh.frustumCulled = false;
      this.room.add(mesh);
      this.shafts.push(mesh);
    }
  }

  // ---------------------------------------------------------------- Pip

  private lookKey = (l: OwlLook) => `${l.skin ?? 'owl'}:${l.species ?? ''}:${l.palette}`;
  /** dressed for business: reading glasses and a tie (or a bow tie), whatever the wardrobe has */
  static business(look: OwlLook): OwlLook {
    const pick = (ids: string[]) => ids.find((id) => PIECE[id]);
    const outfit: OwlLook['outfit'] = {};
    const face = pick(['glasses', 'monocle']), neck = pick(['necktie', 'tie', 'bowtie']), body = pick(['waistcoat', 'vest', 'suit']);
    if (face) outfit.face = face;
    if (neck) outfit.neck = neck;
    if (body) outfit.body = body;
    return { ...look, outfit };
  }
  private makeActor(look: OwlLook) {
    const a = new OwlActor(Office.business(look), { fx: (k, at, n) => this.owlFx(k, at, n), sound: (id) => sceneSound('owl_' + id) });
    a.node.scale.setScalar(PIP_H / Math.max(0.3, a.height));
    this.actors.set(this.lookKey(look), a);
    return a;
  }
  private placePip() { this.actor.node.position.copy(PIP_AT); this.actor.node.rotation.y = 0; }
  private dress() { /* glasses and tie come with the outfit */ }

  /** Swap Pip's species with a puff of feathers. Each look is built once. */
  setLook(look: OwlLook, poof = true) {
    const key = this.lookKey(look), old = this.actor;
    const next = this.actors.get(key) ?? this.makeActor(look);
    if (next !== old) {
      next.node.position.copy(old.node.position);
      next.node.rotation.copy(old.node.rotation);
      next.pose = old.pose; next.lookAt = old.lookAt; next.breath = old.breath;
      next.setMood(old.mood);
      this.room.remove(old.node);
      this.room.add(next.node);
      this.actor = next;
    }
    if (poof) {
      const at = this.pip.node.position.clone().add(V(0, PIP_H * 0.55, 0.1));
      this.burst('sparkle', at, 10);
      this.burst('feathers', at, 9);
      this.burst('puffs', at.clone().add(V(0, -0.12, 0)), 8);
      this.pip.play('ruffle');
      sound.play('tp_shimmer', { volume: 0.35, gap: 120 });
    }
  }
  setNameplate(name: string) { this.plate?.set(name || 'Pip'); }

  /**
   * Particles at the office's scale (the shared presets are sized for the forest): sparkles, hearts, notes, zzz,
   * stars, puffs, feathers. `k` scales size and spread (1 = around Pip, 0.3 = a diorama on the desk).
   */
  burst(kind: 'sparkle' | 'hearts' | 'notes' | 'zzz' | 'stars' | 'puffs' | 'dust' | 'feathers', at: THREE.Vector3, n = 4, k = 1) {
    const fx = this.fx, R = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      switch (kind) {
        case 'sparkle': fx.emit({ x: at.x + R(-0.15, 0.15) * k, y: at.y + R(-0.05, 0.18) * k, z: at.z + R(-0.12, 0.12) * k, life: R(0.4, 0.8), frame: SPR.spark1, frames: 3, fps: 8, color: 0xffe2a0, size: R(0.06, 0.1) * k, add: true, delay: i * 0.05 }); break;
        case 'hearts': fx.emit({ x: at.x + R(-0.1, 0.1) * k, y: at.y, z: at.z + 0.05, vy: R(0.15, 0.3) * k, life: R(1, 1.4), frame: SPR.heart, color: i % 2 ? 0xd85a6a : 0xf0a0a8, size: R(0.07, 0.1) * k, flutter: 0.06 * k, fadeIn: 0.1, delay: i * 0.12 }); break;
        case 'notes': fx.emit({ x: at.x + R(-0.06, 0.06) * k, y: at.y, z: at.z, vy: R(0.12, 0.2) * k, vx: R(-0.05, 0.05) * k, life: 1.4, frame: SPR.note, color: [0x6aa0c8, 0xe0b050, 0xe08a8a][i % 3], size: 0.08 * k, flutter: 0.06 * k, delay: i * 0.18 }); break;
        case 'zzz': fx.emit({ x: at.x + i * 0.03 * k, y: at.y + i * 0.025 * k, z: at.z, vx: 0.03 * k, vy: 0.07 * k, life: 1.8, frame: SPR.zed, color: 0xe4dcff, size: (0.06 + i * 0.02) * k, fadeIn: 0.2, delay: i * 0.5 }); break;
        case 'stars': fx.emit({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * R(0.2, 0.45) * k, vy: R(0.3, 0.6) * k, vz: Math.sin(a) * R(0.2, 0.45) * k, life: R(0.7, 1.1), frame: SPR.star, color: i % 2 ? 0xf0c050 : 0xffe8a0, size: R(0.07, 0.11) * k, gravity: 1.2 * k, drag: 1.2 }); break;
        case 'puffs': case 'dust': fx.emit({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * R(0.2, 0.4) * k, vy: R(0.05, 0.2) * k, vz: Math.sin(a) * R(0.2, 0.4) * k, life: R(0.5, 0.8), frame: SPR.puff1, frames: 3, fps: 7, color: 0xf4eedd, size: R(0.06, 0.1) * k, grow: 0.8, drag: 3, fadeOut: 0.3 }); break;
        case 'feathers': {
          const col = featherColour(this.pip.model.look.palette);
          fx.emit({ x: at.x, y: at.y, z: at.z, vx: Math.cos(a) * 0.25 * k, vy: R(0.15, 0.35) * k, vz: Math.sin(a) * 0.25 * k, life: R(1.4, 2.2), frame: SPR.feather1, frames: 3, fps: 3, color: col, size: 0.05 * k, gravity: 0.3 * k, drag: 2.2, flutter: 0.12 * k }); break;
        }
      }
    }
  }
  private owlFx(k: OwlFx, at: THREE.Vector3, n = 3) {
    if (k === 'heart') this.burst('hearts', at, n);
    else if (k === 'note') this.burst('notes', at, n);
    else if (k === 'zzz') this.burst('zzz', at.clone().add(V(0.06, 0, 0)), Math.max(2, n));
    else if (k === 'sparkle') this.burst('sparkle', at, n);
    else if (k === 'dust') this.burst('dust', at, n);
    else if (k === 'feather') this.burst('feathers', at, n);
  }
  sparkle(at: THREE.Vector3, n = 6) { this.burst('sparkle', at, n); }
  /** the beak flaps while Pip talks */
  talk() {
    const s = (this.pip as unknown as { s?: { jaw?: Spring; sy?: Spring } }).s;
    if (s?.jaw) s.jaw.v += 7;
    if (s?.sy) s.sy.v -= 0.2;
  }
  get head() { return this.pip.headWorld; }

  // ---------------------------------------------------------------- camera

  private shots(name: ShotName): Shot {
    const P = this.camera.aspect < 0.9;
    const H = HEAD.clone(), paper = DESK.paper.clone().add(V(0, 0.01, 0));
    switch (name) {
      case 'establish': return { target: V(P ? -0.1 : -0.45, 1.3, -1.6), yaw: P ? 0.2 : 0.36, pitch: 0.1, fit: P ? [2.0, 3.4] : [5.2, 2.8], anchor: [0, P ? -0.05 : 0] };
      case 'wide': return { target: V(-0.4, 1.2, -1.3), yaw: -0.28, pitch: 0.12, fit: P ? [2.0, 3.2] : [4.8, 2.6] };
      case 'open': return { target: V(0, 1.28, -1.7), yaw: 0.0, pitch: 0.06, fit: P ? [2.4, 2.9] : [4.4, 2.5], anchor: [0, P ? -0.04 : 0] };
      case 'pip': return { target: H.clone().add(V(0, -0.12, 0.3)), yaw: 0.0, pitch: 0.14, fit: P ? [1.05, 1.5] : [2.4, 1.2], anchor: [0, P ? 0.12 : 0.05] };
      case 'pipL': return { target: H.clone().add(V(-0.05, -0.14, 0.3)), yaw: -0.42, pitch: 0.12, fit: P ? [1.1, 1.6] : [2.6, 1.3], anchor: [P ? 0 : 0.15, P ? 0.12 : 0.05] };
      case 'pipR': return { target: H.clone().add(V(0.05, -0.12, 0.3)), yaw: 0.4, pitch: 0.12, fit: P ? [1.1, 1.6] : [2.6, 1.3], anchor: [P ? 0 : -0.15, P ? 0.12 : 0.05] };
      case 'close': return { target: H.clone().add(V(0, -0.02, 0.1)), yaw: 0.06, pitch: 0.1, fit: P ? [0.62, 0.9] : [1.4, 0.7], anchor: [0, P ? 0.1 : 0.05] };
      case 'low': return { target: H.clone().add(V(0, -0.2, 0.3)), yaw: -0.15, pitch: -0.08, fit: P ? [1.3, 1.9] : [2.8, 1.4], anchor: [0, P ? 0.15 : 0.05] };
      case 'desk': return { target: V(0.05, DESK_TOP + 0.1, -0.95), yaw: 0.15, pitch: 0.55, fit: P ? [1.2, 1.8] : [2.4, 1.3], anchor: [0, P ? 0.1 : 0] };
      case 'tray': case 'bed': case 'floor': case 'tower': return { target: V(-0.62, DESK_TOP + 0.14, -0.95), yaw: -0.25, pitch: 0.32, fit: P ? [0.75, 1.1] : [1.7, 0.95], anchor: [0, P ? 0.05 : 0] };
      case 'window': return { target: V(L.x0 + 0.4, 1.6, L.window.z), yaw: -0.85, pitch: 0.05, fit: P ? [1.7, 2.6] : [3.4, 2.0] };
      case 'clock': return { target: V(L.clock.x, L.clock.y + 0.05, L.z0 + 0.1), yaw: 0, pitch: 0.0, fit: P ? [0.8, 1.2] : [1.8, 0.95] };
      case 'clockwin': return { target: V(-0.6, 1.6, -1.8), yaw: -0.5, pitch: 0.06, fit: P ? [2.2, 3.0] : [4.2, 2.4] };
      case 'board': return { target: V(L.x1 - 0.2, 1.8, -0.3), yaw: 0.85, pitch: 0.05, fit: P ? [1.6, 2.2] : [3.4, 1.9] };
      case 'form': return P
        ? { target: paper.clone().add(V(0, 0.01, 0)), yaw: 0, pitch: 0.6, fit: [0.31, 0.2], anchor: [0, -0.36] }
        : { target: paper.clone().add(V(0, 0.02, 0)), yaw: 0, pitch: 0.4, fit: [0.6, 0.54], anchor: [0, -0.24] };
      case 'formClock': return P
        ? { target: paper.clone().add(V(-0.09, 0, -0.03)), yaw: 0.06, pitch: 0.6, fit: [0.42, 0.3], anchor: [0, -0.3] }
        : { target: paper.clone().add(V(-0.08, 0.02, 0)), yaw: 0.05, pitch: 0.42, fit: [0.74, 0.56], anchor: [0, -0.22] };
      case 'stamp': return P
        ? { target: paper.clone().add(V(0.05, 0, 0)), yaw: -0.04, pitch: 0.62, fit: [0.4, 0.3], anchor: [0, -0.3] }
        : { target: paper.clone().add(V(0.1, 0.02, 0)), yaw: -0.05, pitch: 0.44, fit: [0.74, 0.56], anchor: [0, -0.22] };
    }
  }

  /** Move the camera to a shot (smoothly), or cut straight to it. */
  go(name: ShotName, cut = false, speed = 2.1) {
    this.moveK = speed;
    if (name === this.shotName && !cut) return;
    this.shotName = name;
    this.shot = this.shots(name);
    this.shotAt = this.time;
    if (cut || !this.cur) this.snap();
  }
  cut(name: ShotName) { this.go(name, true); }
  get shotNow() { return this.shotName; }
  private snap() { const s = this.shot; this.cur = { target: s.target.clone(), yaw: s.yaw, pitch: s.pitch, dist: this.distOf(s), ax: s.anchor?.[0] ?? 0, ay: s.anchor?.[1] ?? 0, roll: s.roll ?? 0 }; }
  private distOf(s: Shot) {
    if (s.dist) return s.dist;
    const v = (this.vfov * Math.PI) / 360, h = Math.atan(Math.tan(v) * this.camera.aspect);
    // fitting a tilted subject: its depth extent shrinks with the view angle; keep it simple and fit the box
    return Math.max(s.fit[1] / 2 / Math.tan(v), s.fit[0] / 2 / Math.tan(h));
  }
  /** The camera pose a shot asks for right now (no drift). */
  private poseOf(s: Shot) {
    const d = this.distOf(s), cp = Math.cos(s.pitch);
    return { pos: new THREE.Vector3(s.target.x + Math.sin(s.yaw) * cp * d, s.target.y + Math.sin(s.pitch) * d, s.target.z + Math.cos(s.yaw) * cp * d), look: s.target.clone(), ax: s.anchor?.[0] ?? 0, ay: s.anchor?.[1] ?? 0 };
  }
  /** Where the clock's dial centre is in the room. */
  get dialWorld() { return this.clock ? this.clock.group.localToWorld(this.clock.dial.clone()) : V(L.clock.x, L.clock.y + 0.32, L.z0 + 0.15); }
  /**
   * The opening: start nose to the clock's dial exactly as the loading screen left it (dial centre at screen
   * point (x, y), one art pixel = px CSS px), then pull back and crane down into the room, ending on `to`.
   */
  pullBack(from: { x: number; y: number; px: number }, to: ShotName = 'open', dur = 4.6): Promise<void> {
    const dial = this.dialWorld;
    const tan = Math.tan((this.vfov * Math.PI) / 360);
    const d = Math.max(0.06, (0.003 * innerHeight) / (2 * tan * Math.max(0.5, from.px)));
    const start = { pos: dial.clone().add(V(0, 0, d)), look: dial.clone(), ax: (from.x / innerWidth) * 2 - 1, ay: -((from.y / innerHeight) * 2 - 1) };
    this.shotName = to; this.shot = this.shots(to);
    const end = this.poseOf(this.shot);
    const t0 = this.time;
    const ease = (k: number) => k * k * k * (k * (k * 6 - 15) + 10);
    return new Promise((done) => {
      this.rig = (t) => {
        const k = Math.min(1, (t - t0) / dur), e = ease(k);
        // pull straight back first (the dial shrinks to the whole clock), then arc down and across to the shot
        const back = ease(Math.min(1, k * 1.6));
        const p = start.pos.clone().lerp(end.pos, e);
        p.z = start.pos.z + (end.pos.z - start.pos.z) * back;
        p.y += Math.sin(e * Math.PI) * 0.18;
        const look = start.look.clone().lerp(end.look, ease(Math.max(0, (k - 0.15) / 0.85)));
        if (k >= 1) { this.rig = null; this.shotAt = this.time; this.snap(); done(); }
        return { pos: p, look, ax: start.ax + (end.ax - start.ax) * e, ay: start.ay + (end.ay - start.ay) * e };
      };
    });
  }
  /** Hold the camera on the clock's dial as the loading screen will leave it (before the pull-back starts). */
  holdOnDial(from: { x: number; y: number; px: number }) {
    const dial = this.dialWorld, tan = Math.tan((this.vfov * Math.PI) / 360);
    const d = Math.max(0.06, (0.003 * innerHeight) / (2 * tan * Math.max(0.5, from.px)));
    this.rig = () => ({ pos: dial.clone().add(V(0, 0, d)), look: dial.clone(), ax: (from.x / innerWidth) * 2 - 1, ay: -((from.y / innerHeight) * 2 - 1) });
  }
  /** Switch the banker's lamp (the pull chain tugs). */
  lampOn(on: boolean) {
    this.lampWant = on ? 1 : 0;
    if (on && this.lamp) { const c = this.lamp.chain; const t0 = this.time; const tick = (dt: number) => { const k = this.time - t0; c.position.y = 0.36 - Math.sin(Math.min(1, k * 6) * Math.PI) * 0.02; if (k > 0.3) this.tickers.delete(tick); void dt; }; this.tickers.add(tick); }
  }
  /** shake the camera a little (the stamp's thump) */
  bump(k = 1) { this.shake = Math.max(this.shake, k); }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.vfov = w < h ? 58 : 38;
    this.camera.fov = this.vfov;
    this.camera.updateProjectionMatrix();
    this.look.resize(w, h);
    if (this.shot) this.shot = this.shots(this.shotName);
  }

  private applyCamera(dt: number) {
    const t = this.time, cam = this.camera;
    const r = this.rig?.(t);
    if (r) {
      cam.position.copy(r.pos);
      cam.up.set(0, 1, 0);
      cam.lookAt(r.look);
      if (Math.abs(cam.fov - this.vfov) > 0.01) cam.fov = this.vfov;
      this.offAxis(r.ax ?? 0, r.ay ?? 0);
      const fd = cam.position.distanceTo(r.look);
      this.look.grade.focus = fd; this.look.grade.range = Math.max(0.5, fd * 0.6);
      return;
    }
    if (Math.abs(cam.fov - this.vfov) > 0.01) { cam.fov += (this.vfov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }
    const s = this.shot, c = this.cur;
    const k = 1 - Math.exp(-dt * this.moveK);
    c.yaw += (s.yaw - c.yaw) * k; c.pitch += (s.pitch - c.pitch) * k; c.dist += (this.distOf(s) - c.dist) * k; c.target.lerp(s.target, k);
    c.ax += ((s.anchor?.[0] ?? 0) - c.ax) * k; c.ay += ((s.anchor?.[1] ?? 0) - c.ay) * k; c.roll += ((s.roll ?? 0) - c.roll) * k;
    // a slow push-in after each move, and a soft handheld drift (calmer on the paper)
    const calm = this.shotName.startsWith('form') || this.shotName === 'stamp' ? 0.25 : 1;
    const since = t - this.shotAt, push = 1 - 0.05 * calm * Math.min(1, since / 8) ** 2;
    const yaw = c.yaw + (Math.sin(t * 0.37) * 0.01 + Math.sin(t * 1.13 + 1) * 0.003) * calm;
    const pitch = c.pitch + (Math.sin(t * 0.51 + 2) * 0.006 + Math.sin(t * 1.7) * 0.0015) * calm;
    const dist = c.dist * push;
    const cp = Math.cos(pitch), tg = c.target;
    cam.position.set(tg.x + Math.sin(yaw) * cp * dist, tg.y + Math.sin(pitch) * dist, tg.z + Math.cos(yaw) * cp * dist);
    // never leave the room (a wide fit on a narrow screen would back the camera through the wall)
    const lim = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
    const ox = cam.position.x, oz = cam.position.z;
    cam.position.set(lim(cam.position.x, L.x0 + 0.25, L.x1 - 0.25), lim(cam.position.y, 0.3, L.H - 0.3), lim(cam.position.z, L.z0 + 0.4, L.z1 - 0.25));
    void ox; void oz;
    // depth of field: focus on the subject, the far wall goes soft
    const fd = cam.position.distanceTo(tg);
    this.look.grade.focus = fd;
    this.look.grade.range = Math.max(0.9, fd * 0.75);
    this.look.grade.dof = fd < 1.2 ? 0.6 : 1;
    if (this.shake > 0.001) {
      cam.position.y -= Math.sin(t * 60) * this.shake * 0.004;
      this.shake *= Math.exp(-dt * 9);
    }
    cam.up.set(Math.sin(c.roll + Math.sin(t * 0.23) * 0.003 * calm), Math.cos(c.roll), 0);
    cam.lookAt(tg);
    this.offAxis(c.ax, c.ay);
  }
  /** Shift the picture so the target sits at (ax, ay) on screen (NDC), without moving the camera. */
  private offAxis(ax: number, ay: number) {
    const cam = this.camera;
    cam.updateProjectionMatrix();
    cam.projectionMatrix.elements[8] = -ax;
    cam.projectionMatrix.elements[9] = -ay;
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  /** Screen position (CSS px) of a world point under the current camera. */
  screenOf(v: THREE.Vector3) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, z: p.z };
  }
  headScreen() { return this.screenOf(this.pip.headWorld); }

  // ---------------------------------------------------------------- the window, the hour, the light

  /** Hour (and weather) shown through the window; the light in the room follows. null = the real time. */
  window(hour: number | null, w: Weather = 'clear') {
    this.sky.set(hour, w);
    this.hourWant = hour;
    if (this.world) { this.world.setHour(hour); this.winT = 0; }
  }
  private stepLight(dt: number) {
    const real = new Date().getHours() + new Date().getMinutes() / 60;
    const want = this.hourWant ?? real;
    // ease the hour the shortest way round the clock
    let d = want - this.hourNow;
    if (d > 12) d -= 24; else if (d < -12) d += 24;
    this.hourNow = (this.hourNow + d * Math.min(1, dt * 1.6) + 24) % 24;
    const s = sunAt(this.hourNow), night = s.night;
    this.sun.color.copy(s.col);
    this.sun.intensity = s.i * 0.8;
    this.hemi.color.copy(s.sky); this.hemi.intensity = 0.25 + (1 - night) * 0.35;
    const flick = Math.sin(this.time * 9) * 0.02 + Math.sin(this.time * 23) * 0.012;
    this.lampK += (this.lampWant - this.lampK) * Math.min(1, dt * 9);
    this.lampLight.intensity = (1.1 + night * 0.9) * (1 + flick) * this.lampK;
    this.lampGlow.intensity = (0.25 + night * 0.3) * this.lampK;
    if (this.lamp) { const on = this.lampK > 0.5; this.lamp.bulb.visible = on; (this.lamp.shadeIn.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xffe3a6 : 0x3a3020); }
    this.fill.intensity = 0.9 + night * 0.4;
    for (const l of this.sconceLights) l.intensity = 0.35 + night * 0.6 + flick * 0.5;
    const u = this.shaftMat.uniforms;
    u.uCol.value.copy(s.col); u.uAmt.value = (0.05 + (1 - night) * 0.09) * (this.quality === 'high' ? 1 : 0.8); u.uTime.value = this.time;
    this.look.grade.exposure = 1.0 + night * 0.2;
    this.look.grade.warm = 0.35 + (1 - night) * 0.1;
  }
  private stepWindow(dt: number) {
    if (!this.world || !this.winRT) return;
    if ((this.winT -= dt) > 0) return;
    this.winT = this.quality === 'high' ? 0.25 : 0.6;
    this.world.renderView(this.winCam, this.winRT);
  }

  // ---------------------------------------------------------------- frame

  update(dt: number, t: number) {
    this.step(dt, t);
    this.look.render(this.room, this.camera, this.time);
  }
  /** advance everything one tick without drawing (dev pages fast-forward with it) */
  step(dt: number, t: number) {
    void t;
    this.time += dt;
    this.sky.update(dt);
    this.stepLight(dt);
    if (this.built) {
      this.stepWindow(dt);
      this.clock.update(dt, this.time);
      for (const { o, ph } of this.sway) { o.rotation.z = Math.sin(this.time * 0.7 + ph) * 0.012; o.rotation.x = Math.sin(this.time * 0.5 + ph * 1.3) * 0.01; }
      // dust motes drifting in the window light
      if ((this.moteT -= dt) <= 0) {
        this.moteT = this.quality === 'high' ? 0.08 : 0.2;
        const o = this.win.opening, k = Math.random() * 2.4;
        const dir = this.sun.target.position.clone().sub(this.sun.position).normalize();
        const p = V(o.x + 0.3, o.y0 + Math.random() * (o.y1 - o.y0), o.z0 + Math.random() * (o.z1 - o.z0)).addScaledVector(dir, k);
        const day = 1 - sunAt(this.hourNow).night;
        this.fx.emit({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.03, vy: (Math.random() - 0.4) * 0.025, vz: (Math.random() - 0.5) * 0.03, life: 5 + Math.random() * 4, frame: SPR.mote, color: day > 0.5 ? 0xffe8b8 : 0xc8d8ff, size: 0.018 + Math.random() * 0.016, add: true, fadeIn: 1.2, fadeOut: 2, flutter: 0.03 });
      }
    }
    this.pip.dark = sunAt(this.hourNow).night * 0.3;
    this.pip.update(dt);
    for (const f of this.tickers) f(dt, this.time);
    this.fx.update(dt, this.time);
    this.applyCamera(dt);
  }

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray, e: PointerEvent): boolean {
    // the app's scene computes rays with our camera (whose projection we shift), so they are right
    return !!this.onPointer?.(type, x, y, ray, e);
  }
  /** A ray through a screen point (CSS px), for callers that need one outside pointer events. */
  rayAt(x: number, y: number): THREE.Ray {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera);
    return rc.ray;
  }

  dispose() {
    for (const d of this.disposers) d?.();
    for (const a of this.actors.values()) a.dispose();
    this.sky.dispose();
    this.look.dispose();
    this.pmrem?.dispose();
    this.room.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry?.dispose(); }
    });
    for (const m of this.mats.all) m.dispose();
    for (const t of this.mats.textures) t.dispose();
  }
}
export { DESK, L, DESK_TOP };
export const OFFICE_HEAD = HEAD;
export function soundOf(id: string, v = 0.5) { try { sound.play(id, { volume: v, gap: 40 }); } catch { /* */ } }
export const _unused = { carriageClock, mat: null as unknown as THREE.Material, OwlActor };
