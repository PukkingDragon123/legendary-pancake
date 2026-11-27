// [profile] The photo studio: a little portrait studio set up in a timber room, as a 3D stage (see Stage in scene.ts).
// A chroma-green muslin hangs from a crossbar on two backdrop stands and sweeps forward across the floor; Pip stands on a
// green-painted apple box in the middle (it keys out with the screen, as in a real green-screen studio). A big warm
// softbox keys him from the upper left, a strip box fills from the right, a small fresnel with barn doors lights the
// screen evenly from behind and a gold reflector bounces a little warmth back up. In front, a walnut-and-brass bellows
// camera on a wooden tripod points at him; its ground glass (the screen on its back, under a leather focusing hood)
// shows the finished portrait live.
//
// The portrait is a real chroma key, not a shortcut: every few frames the studio is rendered from the camera's lens
// (an HDR plate of Pip against the lit green, with the folds and the falloff of the light on the cloth), then a shader
// tone-maps the plate like the main picture, pulls a matte from how much greener than red and blue each pixel is
// (stable in the cloth's shadows), chokes the matte's edge by a texel, takes the green spill off the feathers, wraps a
// little of the new background's light round the edges, and lays Pip over the chosen backdrop plate (backdrops.ts).
// The result is read back for the interface's viewfinder (`view`, a 256 px canvas), and `shoot()` makes a 512 px
// exposure, scaled down to a 256 px WebP (PNG where WebP can't be encoded) for the save.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { OwlActor, type OwlAction, type OwlHold, type OwlMood, type OwlPose } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import type { Look } from '../post.ts';
import type { Stage } from '../scene.ts';
import { backdropCanvas, loadBark } from './backdrops.ts';
import walnutUrl from '../../ui/real/tex/walnut.webp?url';
import linenUrl from '../../ui/real/tex/linen.webp?url';
import leatherUrl from '../../ui/real/tex/leather.webp?url';

// ------------------------------------------------------------------ poses and faces

export type Framing = 'face' | 'bust' | 'full';
export interface StudioPose {
  id: string;
  name: string;
  /** the face the pose comes with (an expression chosen in the studio overrides it) */
  mood: OwlMood;
  pose?: OwlPose;
  /** an action replayed for as long as the pose is held */
  loop?: OwlAction;
  /** an action now and then: [action, every n seconds] */
  every?: [OwlAction, number];
  hold?: OwlHold;
  /** metres up off the box (flying) */
  lift?: number;
}
export const POSES: StudioPose[] = [
  { id: 'hello', name: 'Wave hello', mood: 'happy', loop: 'wave', hold: { wingR: -0.35, fwd: 0.5 } },
  { id: 'proud', name: 'Proud', mood: 'proud', hold: { wingL: 0.3, wingR: 0.3, lean: -0.1, pitch: -0.06, tuft: 0.3, sy: 0.03 } },
  { id: 'wingup', name: 'Wing up!', mood: 'joy', hold: { wingR: 1.25, fwd: 0.55, roll: 0.16, tuft: 0.25, sy: 0.02 } },
  { id: 'thinking', name: 'Thinking', mood: 'curious', hold: { wingL: 0.8, fwd: 0.7, roll: -0.26, pitch: 0.04, ly: -0.8, lx: -0.5 } },
  { id: 'dance', name: 'Dancing', mood: 'joy', loop: 'dance' },
  { id: 'fly', name: 'Flying', mood: 'excited', pose: 'fly', lift: 0.13 },
  { id: 'hug', name: 'Big hug', mood: 'love', hold: { wingL: 0.95, wingR: 0.95, fwd: 0.85, lean: -0.05, roll: 0.08 } },
  { id: 'tada', name: 'Ta-da!', mood: 'surprised', hold: { wingL: 1.2, wingR: 1.2, fwd: 0.45, tuft: 0.4, sy: 0.04 } },
  { id: 'sleepy', name: 'Sleepy', mood: 'sleepy', every: ['yawn', 7], hold: { pitch: 0.08, roll: 0.14, sy: -0.03 } },
  { id: 'stretch', name: 'Big stretch', mood: 'happy', loop: 'stretch' },
];
export const POSE_BY_ID: Record<string, StudioPose> = Object.fromEntries(POSES.map((p) => [p.id, p]));
export const EXPRESSIONS: { id: OwlMood; name: string }[] = [
  { id: 'happy', name: 'Smile' }, { id: 'joy', name: 'Beaming' }, { id: 'proud', name: 'Proud' }, { id: 'love', name: 'Adoring' },
  { id: 'curious', name: 'Curious' }, { id: 'surprised', name: 'Surprised' }, { id: 'excited', name: 'Excited' }, { id: 'shy', name: 'Shy' },
  { id: 'determined', name: 'Determined' }, { id: 'grumpy', name: 'Grumpy' }, { id: 'sleepy', name: 'Sleepy' }, { id: 'calm', name: 'Serene' },
];
const FOV: Record<Framing, number> = { face: 9.4, bust: 14.5, full: 22 };

// ------------------------------------------------------------------ the plan (metres, y up; the owl stands at the origin)

const BOX = { w: 0.36, h: 0.26, d: 0.3 };
const OWL_H = 0.36;
const SCREEN = { z: -1.05, top: 2.12, x: 1.18, bend: 0.46, front: 0.62 };
const TRIPOD = new THREE.Vector3(0.5, 0, 1.7);
const LENS_H = 0.6;
const PLATE = 256, SHOT = 512;

const LOOK: Look = { exposure: 1.02, contrast: 1.06, saturation: 1.12, vibrance: 0.26, warm: 0.04, split: 0.26, vignette: 0.34, grain: 0.014, bloom: 0.62, bloomThreshold: 1.1, focus: 0, focusRange: 1.4, blur: 0.28, focusAt: [0.5, 0.5], cold: 0 };

const KEY_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
/** the keyer: plate (linear HDR) -> filmic -> matte -> despill -> light wrap -> over the backdrop (display sRGB out) */
const KEY_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tPlate; uniform sampler2D tBack; uniform vec2 texel; uniform float exposure; uniform float mode;
varying vec2 vUv;
vec3 aces(vec3 x) { const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0); }
vec3 disp(vec2 uv) { vec3 c = texture2D(tPlate, uv).rgb * exposure; return pow(aces(c * 0.92), vec3(1.0 / 2.2)); }
float matte(vec3 s) {
  float g = max(s.g, 0.045);
  float ratio = (s.g - max(s.r, s.b)) / g;          // how much greener than red and blue, for its brightness
  return 1.0 - smoothstep(0.2, 0.42, ratio);         // 1 = keep (Pip), 0 = screen
}
void main() {
  vec3 s = disp(vUv);
  float a = matte(s);
  // choke: a pixel is only as solid as its weakest neighbour, half way (no green fringe)
  float n = min(min(matte(disp(vUv + vec2(texel.x, 0.0))), matte(disp(vUv - vec2(texel.x, 0.0)))), min(matte(disp(vUv + vec2(0.0, texel.y))), matte(disp(vUv - vec2(0.0, texel.y)))));
  a = mix(a, min(a, n), 0.6);
  // spill: nothing on Pip may be greener than its red or blue
  float surplus = s.g - max(s.r, s.b);
  if (surplus > 0.0) s.g -= surplus * 0.92;
  vec3 back = texture2D(tBack, vUv).rgb;
  // light wrap: near the edge, a little of the backdrop's light spills onto Pip
  float wrap = 0.0;
  for (int i = 0; i < 8; i++) { float an = float(i) * 0.785398; wrap += matte(disp(vUv + vec2(cos(an), sin(an)) * texel * 3.0)); }
  wrap = clamp(1.0 - wrap / 8.0, 0.0, 1.0) * a;
  vec3 b2 = texture2D(tBack, vUv + vec2(0.012, -0.012)).rgb;
  s = mix(s, 1.0 - (1.0 - s) * (1.0 - b2 * 0.55), wrap * 0.55);
  vec3 o = mode > 0.5 ? s * a + vec3(0.0, 0.69, 0.25) * (1.0 - a) : mix(back, s, a);
  // the portrait lens: a whisper of vignette
  float v = smoothstep(0.85, 0.25, length(vUv - 0.5));
  o *= mix(0.88, 1.0, v);
  gl_FragColor = vec4(o, 1.0);
}`;
/** the ground glass on the camera's back: shows the keyed portrait (display values back to linear, lit from within) */
const GLASS_FRAG = /* glsl */ `
uniform sampler2D map; uniform float glow; varying vec2 vUv;
void main() { vec3 c = pow(texture2D(map, vUv).rgb, vec3(2.2)); float v = smoothstep(0.75, 0.3, length(vUv - 0.5)); gl_FragColor = vec4(c * glow * mix(0.55, 1.0, v), 1.0); }`;
const GLASS_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export class Studio implements Stage {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);
  readonly look: Look = { ...LOOK };
  readonly owl: OwlActor;
  /** the keyed portrait, live (256 px); `onView` is called when it has been redrawn */
  readonly view: HTMLCanvasElement;
  onView: (() => void) | null = null;
  readonly ready: Promise<void>;
  /** a tap on Pip (he reacts) */
  onPoke: (() => void) | null = null;

  private R: THREE.WebGLRenderer | null = null;
  private pmrem: THREE.PMREMGenerator | null = null;
  private env: THREE.Texture | null = null;
  private geos: THREE.BufferGeometry[] = [];
  private mats: THREE.Material[] = [];
  private texs: THREE.Texture[] = [];
  private M!: Record<string, THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial>;
  private photoCam = new THREE.PerspectiveCamera(FOV.bust, 1, 0.05, 30);
  private plate = new THREE.WebGLRenderTarget(PLATE, PLATE, { type: THREE.HalfFloatType, samples: 4 });
  private comp = new THREE.WebGLRenderTarget(PLATE, PLATE, { type: THREE.UnsignedByteType });
  private keyMat: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private backTex: THREE.CanvasTexture;
  private glassMat!: THREE.ShaderMaterial;
  private buf = new Uint8Array(PLATE * PLATE * 4);
  private img: ImageData | null = null;
  private lights: { key: THREE.SpotLight; fill: THREE.SpotLight; rim: THREE.SpotLight; bg: THREE.SpotLight; hemi: THREE.HemisphereLight; spill: THREE.PointLight };
  private base: Record<string, number> = {};
  private diffusers: THREE.MeshBasicMaterial[] = [];
  private lensAt = new THREE.Vector3();
  private camRig = new THREE.Group();
  private aim = new THREE.Vector3(0, BOX.h + OWL_H * 0.8, 0);
  private fov = FOV.bust;
  private framing: Framing = 'bust';
  private poseDef: StudioPose = POSES[0];
  private moodOver: OwlMood | null = null;
  private everyT = 0;
  private time = 0;
  private frame = 0;
  private flashT = -1;
  private w = 1; private h = 1;
  private inset = { right: 0, bottom: 0, top: 0 };
  private yaw = 0; private yawGoal = 0;
  private drag: { x: number; y: number; yaw: number; moved: boolean } | null = null;
  private ray = new THREE.Raycaster();
  private backdrop = 'forest';
  private dead = false;
  private paused = false;

  constructor(look: OwlLook) {
    const S = this.scene;
    S.background = new THREE.Color(0x120d0b);
    S.fog = new THREE.Fog(0x120d0b, 6.5, 15);
    this.view = document.createElement('canvas');
    this.view.width = this.view.height = PLATE;
    this.buildMaterials();
    this.lights = this.buildLights();
    this.buildRoom();
    this.buildScreen();
    this.buildBox();
    this.buildSoftboxes();
    this.buildCamera();
    this.buildProps();
    // the owl, on the box, turned a touch towards the lens
    this.owl = new OwlActor(look, { emote: () => { /* no marks in the studio */ } });
    this.owl.node.scale.setScalar(OWL_H / Math.max(0.05, this.owl.height));
    this.owl.node.position.set(0, BOX.h, 0);
    this.owl.node.rotation.y = 0.62;
    this.owl.still = true;
    S.add(this.owl.node);
    this.owl.node.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = true; } });
    void this.owl.ready.then(() => this.owl.node.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.castShadow = true; }));
    // the keyer
    this.backTex = new THREE.CanvasTexture(backdropCanvas(this.backdrop));
    this.backTex.colorSpace = THREE.NoColorSpace; // display values, keyed in display space
    this.texs.push(this.backTex);
    this.keyMat = new THREE.ShaderMaterial({
      uniforms: { tPlate: { value: this.plate.texture }, tBack: { value: this.backTex }, texel: { value: new THREE.Vector2(1 / PLATE, 1 / PLATE) }, exposure: { value: 1.05 }, mode: { value: 0 } },
      vertexShader: KEY_VERT, fragmentShader: KEY_FRAG, depthTest: false, depthWrite: false,
    });
    this.mats.push(this.keyMat);
    this.quad = new THREE.Mesh(this.keepG(new THREE.PlaneGeometry(2, 2)), this.keyMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.glassMat.uniforms.map.value = this.comp.texture;
    this.setPose('hello');
    this.camera.layers.enable(1);
    this.camera.position.set(1.2, 1.1, 3.2);
    this.camera.lookAt(0, 0.7, 0);
    this.ready = Promise.all([this.owl.ready, loadBark().then(() => { if (this.backdrop === 'oak') this.setBackdrop('oak', true); })]).then(() => undefined);
  }

  // ---------------------------------------------------------------- bookkeeping

  private keepG<T extends THREE.BufferGeometry>(g: T): T { this.geos.push(g); return g; }
  private mesh(g: THREE.BufferGeometry, m: THREE.Material, cast = true, recv = true): THREE.Mesh {
    const o = new THREE.Mesh(this.keepG(g), m);
    o.castShadow = cast; o.receiveShadow = recv;
    return o;
  }
  private tex(url: string, rep: [number, number], srgb = true): THREE.Texture {
    const t = new THREE.TextureLoader().load(url);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep[0], rep[1]);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    this.texs.push(t);
    return t;
  }
  private canvasTex(c: HTMLCanvasElement, srgb = true, rep: [number, number] = [1, 1]): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep[0], rep[1]);
    t.anisotropy = 8;
    this.texs.push(t);
    return t;
  }

  /** Draw through the app's renderer (a soft studio environment for the brass, the glass and the gloss). */
  attach(renderer: THREE.WebGLRenderer) {
    this.R = renderer;
    if (!this.pmrem) {
      this.pmrem = new THREE.PMREMGenerator(renderer);
      const env = new RoomEnvironment();
      this.env = this.pmrem.fromScene(env, 0.04).texture;
      this.scene.environment = this.env;
      (this.scene as unknown as { environmentIntensity: number }).environmentIntensity = 0.22;
      env.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    }
    this.resize(innerWidth, innerHeight);
  }

  // ---------------------------------------------------------------- materials

  private buildMaterials() {
    const std = (o: THREE.MeshStandardMaterialParameters) => { const m = new THREE.MeshStandardMaterial(o); this.mats.push(m); return m; };
    const phys = (o: THREE.MeshPhysicalMaterialParameters) => { const m = new THREE.MeshPhysicalMaterial(o); this.mats.push(m); return m; };
    const base = import.meta.env.BASE_URL;
    const linen = this.tex(linenUrl, [9, 7], false);
    const linenB = this.tex(linenUrl, [2, 2], false);
    this.M = {
      // a real chroma-key green: a matte cotton muslin, its weave in the bump, a soft cloth sheen
      green: phys({ color: new THREE.Color('#14a63e'), roughness: 0.94, bumpMap: linen, bumpScale: 0.6, sheen: 0.5, sheenColor: new THREE.Color('#5ccf74'), sheenRoughness: 0.7, envMapIntensity: 0.15 }),
      greenPaint: std({ color: new THREE.Color('#17a640'), roughness: 0.62, envMapIntensity: 0.3 }),
      floor: std({ map: this.tex(`${base}models/house/tex/planks.webp`, [5, 5]), color: 0xb89a84, roughness: 0.58, envMapIntensity: 0.35 }),
      wall: std({ map: this.canvasTex(wallCanvas(), true, [3, 1]), roughness: 0.92, envMapIntensity: 0.1 }),
      timber: std({ map: this.tex(walnutUrl, [1, 3]), color: 0x8c6a58, roughness: 0.6, envMapIntensity: 0.25 }),
      alu: std({ color: 0x1b1b1f, metalness: 0.72, roughness: 0.36, envMapIntensity: 0.9 }),
      chrome: std({ color: 0xd8dade, metalness: 1, roughness: 0.16, envMapIntensity: 1.2 }),
      knob: std({ color: 0x0c0c0e, roughness: 0.55 }),
      fabric: std({ color: 0x17161a, roughness: 0.86, bumpMap: linenB, bumpScale: 0.8, envMapIntensity: 0.15 }),
      silver: std({ color: 0xeef0f4, metalness: 0.9, roughness: 0.3, envMapIntensity: 0.9 }),
      gold: std({ color: 0xf0c060, metalness: 1, roughness: 0.32, envMapIntensity: 1.1 }),
      walnut: std({ map: this.tex(walnutUrl, [1, 1]), color: 0xa88472, roughness: 0.38, envMapIntensity: 0.6 }),
      walnutLeg: std({ map: this.tex(walnutUrl, [0.3, 2.5]), color: 0xa08070, roughness: 0.42, envMapIntensity: 0.55 }),
      brass: std({ color: 0xe0ac58, metalness: 1, roughness: 0.28, envMapIntensity: 1.25 }),
      leather: std({ map: this.tex(leatherUrl, [2, 2]), color: 0x3a3030, roughness: 0.62, envMapIntensity: 0.35 }),
      bellows: std({ map: this.tex(leatherUrl, [3, 1]), color: 0x2a2224, roughness: 0.7, envMapIntensity: 0.3, side: THREE.DoubleSide }),
      lens: phys({ color: 0x0b1018, metalness: 0.2, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2 }),
      rubber: std({ color: 0x0f0e10, roughness: 0.8 }),
      tape: std({ color: 0xe6dcc4, roughness: 0.82 }),
      orange: std({ color: 0xe0661c, roughness: 0.45 }),
      crate: std({ map: this.tex(walnutUrl, [1, 1]), color: 0xd9b48c, roughness: 0.66 }),
      cloth: std({ color: 0x7a2a2c, roughness: 0.9, bumpMap: linenB, bumpScale: 0.7 }),
    };
    this.glassMat = new THREE.ShaderMaterial({ uniforms: { map: { value: null }, glow: { value: 1.1 } }, vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG });
    this.mats.push(this.glassMat);
  }

  // ---------------------------------------------------------------- lights

  private buildLights() {
    const S = this.scene;
    const hemi = new THREE.HemisphereLight(0xffe8d0, 0x3a281c, 0.6);
    S.add(hemi);
    // a bare work bulb hanging over the crates by the wall: a little warm light in the room around the set
    const bulb = new THREE.PointLight(0xffb870, 2.2, 6, 2);
    bulb.position.set(-2.0, 1.9, -1.5);
    S.add(bulb);
    const spot = (col: number, I: number, angle: number, pos: THREE.Vector3, at: THREE.Vector3, shadow = false) => {
      const l = new THREE.SpotLight(col, I, 9, angle, 0.95, 2);
      l.position.copy(pos); l.target.position.copy(at);
      if (shadow) { l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; l.shadow.camera.near = 0.3; l.shadow.camera.far = 7; }
      S.add(l, l.target);
      return l;
    };
    const face = v3(0, BOX.h + OWL_H * 0.7, 0);
    // the key: big, warm, from the upper left like every light in the game; the fill a cooler, weaker strip on the right
    const key = spot(0xffe2bc, 16, 0.62, v3(-1.25, 1.5, 0.95), face, true);
    const fill = spot(0xdbe6ff, 4.2, 0.7, v3(1.35, 1.1, 1.05), face);
    const rim = spot(0xfff1dc, 14, 0.34, v3(0.9, 2.6, -0.8), face);
    const bg = spot(0xf4fff6, 2.6, 1.15, v3(0.0, 0.09, -0.3), v3(0, 1.0, SCREEN.z));
    bg.penumbra = 1;
    // the screen bounces a faint green back onto Pip (the keyer takes it off again)
    const spill = new THREE.PointLight(0x30d060, 0.18, 2.2, 2);
    spill.position.set(0, 0.55, -0.7);
    S.add(spill);
    this.base = { key: key.intensity, fill: fill.intensity, rim: rim.intensity, bg: bg.intensity };
    return { key, fill, rim, bg, hemi, spill };
  }

  // ---------------------------------------------------------------- the room

  private buildRoom() {
    const S = this.scene, M = this.M;
    const floor = this.mesh(new THREE.PlaneGeometry(14, 14), M.floor, false, true);
    floor.rotation.x = -Math.PI / 2;
    S.add(floor);
    const wall = this.mesh(new THREE.PlaneGeometry(14, 5.2), M.wall, false, true);
    wall.position.set(0, 2.6, -2.5);
    S.add(wall);
    const side = this.mesh(new THREE.PlaneGeometry(9, 5.2), M.wall, false, true);
    side.position.set(-3.6, 2.6, 1.2); side.rotation.y = Math.PI / 2;
    S.add(side);
    // a skirting board and two timber posts holding the roof up
    const skirt = this.mesh(new THREE.BoxGeometry(14, 0.14, 0.04), M.timber, false, true);
    skirt.position.set(0, 0.07, -2.47);
    S.add(skirt);
    for (const x of [-2.4, 2.4]) {
      const post = this.mesh(new THREE.BoxGeometry(0.22, 5.2, 0.22), M.timber, true, true);
      post.position.set(x, 2.6, -2.38);
      S.add(post);
    }
  }

  /** a light stand: three splayed legs and braces, two telescoping sections with knob clamps */
  private stand(x: number, z: number, h: number, spread = 0.36, rot = 0): THREE.Group {
    const g = new THREE.Group(), M = this.M;
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    const hub = 0.3;
    const tube = (a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) => {
      const d = b.clone().sub(a), len = d.length();
      const o = this.mesh(new THREE.CylinderGeometry(r, r, len, 10), m);
      o.position.copy(a).add(b).multiplyScalar(0.5);
      o.quaternion.setFromUnitVectors(v3(0, 1, 0), d.normalize());
      g.add(o);
      return o;
    };
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5, foot = v3(Math.cos(a) * spread, 0.012, Math.sin(a) * spread);
      tube(v3(0, hub, 0), foot, 0.011, M.alu);
      tube(v3(0, hub * 0.45, 0), foot.clone().multiplyScalar(0.55).setY(hub * 0.18), 0.006, M.alu);
      const cap = this.mesh(new THREE.SphereGeometry(0.016, 10, 8), M.rubber);
      cap.position.copy(foot);
      g.add(cap);
    }
    tube(v3(0, hub - 0.04, 0), v3(0, h * 0.55, 0), 0.017, M.alu);
    tube(v3(0, h * 0.55 - 0.05, 0), v3(0, h, 0), 0.012, M.chrome);
    for (const y of [hub, h * 0.55]) {
      const collar = this.mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 14), M.alu);
      collar.position.y = y;
      g.add(collar);
      const k = this.mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), M.knob);
      k.rotation.z = Math.PI / 2; k.position.set(0.04, y, 0);
      g.add(k);
    }
    this.scene.add(g);
    return g;
  }

  // ---------------------------------------------------------------- the green screen

  private buildScreen() {
    const S = this.scene, M = this.M;
    for (const sx of [-1, 1]) this.stand(sx * (SCREEN.x + 0.14), SCREEN.z - 0.08, SCREEN.top + 0.04, 0.42, sx * 0.4);
    const bar = this.mesh(new THREE.CylinderGeometry(0.016, 0.016, SCREEN.x * 2 + 0.5, 12), M.chrome);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, SCREEN.top + 0.05, SCREEN.z - 0.08);
    S.add(bar);
    // the muslin: hanging in folds from the bar, curving onto the floor and running forward under the box
    const vert = SCREEN.top - SCREEN.bend, arc = (Math.PI / 2) * SCREEN.bend, flat = SCREEN.front - (SCREEN.z + SCREEN.bend);
    const L = vert + arc + flat;
    const geo = new THREE.PlaneGeometry(1, 1, 90, 120);
    const p = geo.attributes.position as THREE.BufferAttribute;
    const uvA = geo.attributes.uv as THREE.BufferAttribute;
    const clamps = 4;
    for (let i = 0; i < p.count; i++) {
      const u = uvA.getX(i), v = 1 - uvA.getY(i);
      const s = v * L;
      let y: number, z: number, ny: number, nz: number;
      if (s < vert) { y = SCREEN.top - s; z = SCREEN.z; ny = 0; nz = 1; }
      else if (s < vert + arc) { const a = (s - vert) / SCREEN.bend; y = SCREEN.bend - Math.sin(a) * SCREEN.bend; z = SCREEN.z + SCREEN.bend - Math.cos(a) * SCREEN.bend; ny = Math.sin(a); nz = Math.cos(a); }
      else { y = 0.004; z = SCREEN.z + SCREEN.bend + (s - vert - arc); ny = 1; nz = 0; }
      const x = (u - 0.5) * (SCREEN.x * 2 + 0.1);
      // folds: deep where it hangs from the clamps, easing out as the cloth comes down and lies on the floor
      const hang = Math.exp(-s / 0.55), lie = s < vert ? 1 : s < vert + arc ? 0.6 : 0.25;
      const fold = (Math.sin(u * 37 + 1.3) * 0.6 + Math.sin(u * 71 + s * 2.1) * 0.3 + Math.sin(u * 13 - 0.4) * 0.5) * (0.004 + hang * 0.02) * lie;
      // it sags between the clamps along the bar
      const sag = s < 0.25 ? -0.035 * Math.sin(Math.PI * ((u * clamps) % 1)) * (1 - s / 0.25) : 0;
      p.setXYZ(i, x, y + sag + ny * fold * 0, z + nz * fold + (s >= vert + arc ? 0 : 0));
      if (s >= vert + arc) p.setY(i, y + Math.max(0, fold) * 0.4);
    }
    geo.computeVertexNormals();
    const cloth = this.mesh(geo, M.green, true, true);
    S.add(cloth);
    // orange spring clamps biting the cloth onto the bar
    for (let i = 0; i <= clamps; i++) {
      const x = -SCREEN.x - 0.02 + (i / clamps) * (SCREEN.x * 2 + 0.04);
      const c = new THREE.Group();
      c.position.set(x, SCREEN.top + 0.03, SCREEN.z - 0.04);
      for (const sz of [-1, 1]) { const jaw = this.mesh(new RoundedBoxGeometry(0.03, 0.1, 0.012, 2, 0.004), M.orange); jaw.position.set(0, 0.0, sz * 0.022); jaw.rotation.x = sz * 0.22; c.add(jaw); }
      const sp = this.mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 14), M.chrome); sp.rotation.y = Math.PI / 2; sp.position.y = 0.02; c.add(sp);
      S.add(c);
    }
  }

  private buildBox() {
    // the posing box: a sturdy apple box painted the same green, so it keys out with the screen
    const box = this.mesh(new RoundedBoxGeometry(BOX.w, BOX.h, BOX.d, 3, 0.012), this.M.greenPaint);
    box.position.set(0, BOX.h / 2 + 0.004, 0);
    this.scene.add(box);
    // hand holes on its sides
    for (const sx of [-1, 1]) {
      const hole = this.mesh(new RoundedBoxGeometry(0.004, 0.035, 0.11, 2, 0.002), this.M.rubber, false, false);
      hole.position.set(sx * (BOX.w / 2 + 0.001), BOX.h * 0.7, 0);
      this.scene.add(hole);
    }
    // gaffer-tape marks on the floor in front, where Pip's toes go
    for (const a of [0.6, -0.6]) {
      const t = this.mesh(new THREE.BoxGeometry(0.2, 0.002, 0.03), this.M.tape, false, true);
      t.position.set(0, 0.012, 0.42); t.rotation.y = a;
      this.scene.add(t);
    }
  }

  // ---------------------------------------------------------------- the lights' hardware

  /** a softbox: a black fabric frustum on a speedring, a glowing diffuser recessed behind a lip, on its stand */
  private softbox(pos: THREE.Vector3, at: THREE.Vector3, w: number, h: number, depth: number, warm: number) {
    const S = this.scene, M = this.M;
    const st = this.stand(pos.x, pos.z, pos.y - 0.12, 0.36, pos.x);
    void st;
    const g = new THREE.Group();
    g.position.copy(pos);
    g.lookAt(at);
    // body: a 4-sided frustum along -z (the diffuser faces the owl along +z)
    const body = this.mesh(new THREE.CylinderGeometry(Math.SQRT1_2, 0.13, 1, 4, 1, true).rotateY(Math.PI / 4).rotateX(-Math.PI / 2), M.fabric);
    body.scale.set(w, h, depth);
    body.position.z = -depth / 2;
    g.add(body);
    // the diffuser: warm white muslin, glowing (it blooms), a hot spot in the middle
    const dc = diffuserCanvas(warm);
    const dm = new THREE.MeshBasicMaterial({ map: this.canvasTex(dc), color: new THREE.Color(1.6, 1.52, 1.4) });
    this.mats.push(dm);
    this.diffusers.push(dm);
    const diff = this.mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.96), dm, false, false);
    diff.position.z = -0.03;
    g.add(diff);
    // the black lip round the front
    const lip = 0.028;
    for (const [sx, sy, ww, hh] of [[0, 1, w, lip], [0, -1, w, lip], [1, 0, lip, h], [-1, 0, lip, h]] as [number, number, number, number][]) {
      const b = this.mesh(new THREE.BoxGeometry(ww, hh, 0.035), M.fabric);
      b.position.set(sx * (w / 2 - lip / 2), sy * (h / 2 - lip / 2), -0.012);
      g.add(b);
    }
    // speedring, strobe head and the tilt bracket down to the stand
    const ring = this.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 20).rotateX(Math.PI / 2), M.alu);
    ring.position.z = -depth;
    const head = this.mesh(new RoundedBoxGeometry(0.13, 0.15, 0.22, 3, 0.02), M.alu);
    head.position.z = -depth - 0.12;
    g.add(ring, head);
    S.add(g);
    const yoke = this.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), M.chrome);
    yoke.position.set(pos.x, pos.y - 0.1, pos.z);
    S.add(yoke);
    return g;
  }

  private buildSoftboxes() {
    const face = v3(0, BOX.h + OWL_H * 0.7, 0);
    this.softbox(this.lights.key.position.clone(), face, 0.78, 0.98, 0.42, 1);
    this.softbox(this.lights.fill.position.clone(), face, 0.34, 1.0, 0.3, 0);
    // the background light: a little fresnel with barn doors, low behind the box, washing the screen evenly
    const M = this.M, S = this.scene;
    const bg = new THREE.Group();
    bg.position.copy(this.lights.bg.position);
    bg.lookAt(v3(0, 0.85, SCREEN.z));
    const can = this.mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.2, 18).rotateX(Math.PI / 2), M.alu);
    can.position.z = -0.08;
    const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.1, 1.9) });
    this.mats.push(lensMat); this.diffusers.push(lensMat);
    const lens = this.mesh(new THREE.CircleGeometry(0.068, 24), lensMat, false, false);
    lens.position.z = 0.025;
    bg.add(can, lens);
    can.layers.set(1); lens.layers.set(1);
    for (let i = 0; i < 4; i++) {
      const door = this.mesh(new THREE.BoxGeometry(0.15, 0.004, 0.08), M.alu);
      const a = (i / 4) * Math.PI * 2;
      door.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0.06);
      door.rotation.z = a + Math.PI / 2;
      door.rotateX(0.5 * (i % 2 ? 1 : -1));
      door.layers.set(1);
      bg.add(door);
    }
    S.add(bg);
    // (the rim light hangs from the ceiling grid, high behind on the right, out of sight)
  }

  // ---------------------------------------------------------------- the camera

  private buildCamera() {
    const S = this.scene, M = this.M;
    const tri = new THREE.Group();
    tri.position.copy(TRIPOD);
    const top = LENS_H - 0.11;
    // three walnut legs in two sections with brass clamps, brass-shod feet
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3, foot = v3(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34), head = v3(Math.cos(a) * 0.045, top - 0.03, Math.sin(a) * 0.045);
      const d = foot.clone().sub(head), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(v3(0, -1, 0), d.clone().normalize());
      const upper = this.mesh(new THREE.CylinderGeometry(0.017, 0.015, len * 0.56, 10), M.walnutLeg);
      upper.quaternion.copy(q); upper.position.copy(head).addScaledVector(d, 0.28);
      const lower = this.mesh(new THREE.CylinderGeometry(0.012, 0.01, len * 0.5, 10), M.walnutLeg);
      lower.quaternion.copy(q); lower.position.copy(head).addScaledVector(d, 0.74);
      const clamp = this.mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.035, 12), M.brass);
      clamp.quaternion.copy(q); clamp.position.copy(head).addScaledVector(d, 0.555);
      const shoe = this.mesh(new THREE.ConeGeometry(0.012, 0.04, 10).rotateX(Math.PI), M.brass);
      shoe.quaternion.copy(q); shoe.position.copy(head).addScaledVector(d, 0.985);
      tri.add(upper, lower, clamp, shoe);
    }
    const plate = this.mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.035, 24), M.brass);
    plate.position.y = top;
    const pan = this.mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.05, 20), M.alu);
    pan.position.y = top + 0.04;
    tri.add(plate, pan);
    S.add(tri);
    // the camera: aimed at Pip's face from the top of the tripod
    const rig = this.camRig;
    rig.position.set(TRIPOD.x, LENS_H - 0.04, TRIPOD.z);
    rig.lookAt(v3(0, BOX.h + OWL_H * 0.72, 0));
    // the body: a walnut box with brass corners
    const body = this.mesh(new RoundedBoxGeometry(0.17, 0.15, 0.13, 3, 0.008), M.walnut);
    body.position.set(0, 0, -0.03);
    rig.add(body);
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const c = this.mesh(new THREE.BoxGeometry(0.024, 0.024, 0.134), M.brass);
      c.position.set(sx * 0.076, sy * 0.066, -0.03);
      rig.add(c);
    }
    // the bellows: square folds of black leather out to the front standard
    const folds = 7, b0 = 0.035, b1 = 0.115;
    for (let i = 0; i < folds; i++) {
      const s = i % 2 ? 0.1 : 0.118, z = b0 + (i / folds) * (b1 - b0);
      const f = this.mesh(new THREE.CylinderGeometry(s * 0.72, (i % 2 ? 0.118 : 0.1) * 0.72, (b1 - b0) / folds, 4, 1, true).rotateY(Math.PI / 4).rotateX(Math.PI / 2), M.bellows);
      f.position.z = z + (b1 - b0) / folds / 2;
      rig.add(f);
    }
    // the front standard and the brass lens
    const std = this.mesh(new RoundedBoxGeometry(0.15, 0.15, 0.014, 2, 0.004), M.walnut);
    std.position.z = b1 + 0.007;
    const barrel = this.mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.06, 28).rotateX(Math.PI / 2), M.brass);
    barrel.position.z = b1 + 0.044;
    const hood = this.mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.03, 28, 1, true).rotateX(Math.PI / 2), M.rubber);
    hood.position.z = b1 + 0.086;
    const glass = this.mesh(new THREE.SphereGeometry(0.031, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.3).rotateX(Math.PI / 2), M.lens);
    glass.position.z = b1 + 0.058;
    rig.add(std, barrel, hood, glass);
    this.lensAt.set(0, 0, b1 + 0.1);
    // the back: the ground glass showing the portrait, in a brass bezel, under a three-flap leather focusing hood
    const back = this.mesh(new THREE.PlaneGeometry(0.118, 0.118), this.glassMat, false, false);
    back.position.z = -0.0965; back.rotation.y = Math.PI;
    const bez = this.mesh(new THREE.BoxGeometry(0.136, 0.136, 0.006), M.brass);
    bez.position.z = -0.094;
    rig.add(back, bez);
    // (each flap hinges on an edge of the back and splays out towards you)
    const hoodTop = this.mesh(new THREE.BoxGeometry(0.13, 0.085, 0.003), M.leather);
    hoodTop.position.y = 0.0425;
    const topP = new THREE.Group(); topP.position.set(0, 0.066, -0.097); topP.rotation.x = -0.62; topP.add(hoodTop); rig.add(topP);
    for (const sx of [-1, 1]) {
      const sd = this.mesh(new THREE.BoxGeometry(0.07, 0.125, 0.003), M.leather);
      sd.position.x = sx * 0.035;
      const sp = new THREE.Group(); sp.position.set(sx * 0.066, 0, -0.097); sp.rotation.y = sx * 0.62; sp.add(sd); rig.add(sp);
    }
    // a cable release dangling from the shutter, in a lazy loop
    const curve = new THREE.CatmullRomCurve3([v3(0.07, 0.02, b1 + 0.03), v3(0.12, -0.08, b1 + 0.02), v3(0.1, -0.24, 0.02), v3(0.05, -0.2, -0.06), v3(0.04, -0.12, -0.1)]);
    const cable = this.mesh(new THREE.TubeGeometry(curve, 40, 0.0035, 6), M.rubber);
    rig.add(cable);
    const plunger = this.mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 10), M.chrome);
    plunger.position.set(0.04, -0.12, -0.1); plunger.rotation.x = 0.6;
    rig.add(plunger);
    rig.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    S.add(rig);
  }

  private buildProps() {
    const S = this.scene, M = this.M;
    // a gold reflector on a little stand, bouncing warmth up from the front left
    const refl = new THREE.Group();
    refl.position.set(-0.62, 0.32, 0.62);
    refl.lookAt(v3(0, BOX.h + OWL_H * 0.5, 0));
    const disc = this.mesh(new THREE.CircleGeometry(0.26, 40), M.gold, false, false);
    const rimT = this.mesh(new THREE.TorusGeometry(0.26, 0.008, 6, 48), M.rubber);
    const backD = this.mesh(new THREE.CircleGeometry(0.26, 40).rotateY(Math.PI), M.silver, false, false);
    refl.add(disc, rimT, backD);
    S.add(refl);
    this.stand(-0.66, 0.66, 0.1, 0.22);
    // cables snaking from the stands off towards the wall
    const cable = (pts: [number, number][]) => {
      const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => v3(x, 0.012, z)));
      S.add(this.mesh(new THREE.TubeGeometry(c, 60, 0.009, 6), M.rubber, false, true));
    };
    cable([[-1.25, 0.95], [-1.4, 0.3], [-1.9, -0.4], [-2.2, -1.6], [-2.5, -2.4]]);
    cable([[1.35, 1.05], [1.75, 0.5], [1.6, -0.3], [2.1, -1.3], [2.4, -2.4]]);
    cable([[0, -0.35], [0.5, -0.6], [1.6, -0.9], [2.3, -2.3]]);
    // a stack of apple crates by the wall with a folded red cloth on top
    const cr = (x: number, y: number, z: number, r: number) => { const c = this.mesh(new RoundedBoxGeometry(0.5, 0.3, 0.36, 2, 0.01), M.crate); c.position.set(x, y + 0.15, z); c.rotation.y = r; S.add(c); };
    cr(-2.2, 0, -1.6, 0.25); cr(-2.15, 0.3, -1.62, 0.1); cr(-1.62, 0, -1.9, -0.2);
    const cloth = this.mesh(new RoundedBoxGeometry(0.42, 0.06, 0.3, 3, 0.025), M.cloth);
    cloth.position.set(-2.16, 0.63, -1.6); cloth.rotation.y = 0.18;
    S.add(cloth);
  }

  // ---------------------------------------------------------------- what the player chooses

  setLook(look: OwlLook) { this.owl.rebuild(look); this.owl.node.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) m.castShadow = true; }); }
  setPose(id: string) {
    const p = POSE_BY_ID[id] ?? POSES[0];
    this.poseDef = p;
    const a = this.owl;
    a.pose = p.pose ?? 'stand';
    a.hold = p.hold ?? null;
    a.loop = p.loop ?? 'none';
    if (!p.loop) a.action = 'none';
    a.setMood(this.moodOver ?? p.mood);
    this.everyT = p.every ? 1.5 : 0;
  }
  /** an expression over the pose's own (null: the pose's) */
  setMood(m: OwlMood | null) { this.moodOver = m; this.owl.setMood(m ?? this.poseDef.mood); }
  setFraming(f: Framing) { this.framing = f; }
  setBackdrop(id: string, force = false) {
    if (id === this.backdrop && !force) return;
    this.backdrop = id;
    this.backTex.image = backdropCanvas(id);
    this.backTex.needsUpdate = true;
  }
  /** keep the subject clear of the interface: CSS px covered on the right, at the bottom and at the top */
  setInsets(right: number, bottom: number, top = 0) { this.inset = { right, bottom, top }; this.place(); }
  /** stop keying (e.g. while another tab is open) */
  pause(p: boolean) { this.paused = p; }
  poke() { this.owl.poke(); }

  // ---------------------------------------------------------------- the camera on screen

  resize(w: number, h: number) { this.w = w; this.h = h; this.camera.aspect = w / h; this.place(); }
  private place() {
    const { w, h } = this, cam = this.camera, ins = this.inset;
    const vw = Math.max(80, w - ins.right), vh = Math.max(80, h - ins.bottom - ins.top);
    cam.fov = 30;
    const t = Math.tan((cam.fov * Math.PI) / 360);
    // the set to fit: on a wide view the whole set (the screen and its stands, the key softbox, the camera); on a narrow
    // one, closer in on Pip, the box and the screen behind him
    const wide = vw >= 600 && vh >= 420;
    const target = wide ? v3(-0.22, 1.0, -0.05) : v3(0.0, 0.85, 0.1);
    const tw = wide ? 3.1 : 2.5, th = wide ? 2.15 : 1.75;
    const hv = t * (vh / h), hh = t * (w / h) * (vw / w);
    const d = Math.max(tw / 2 / hh, th / 2 / hv) * 1.02;
    const yaw = (wide ? 0.06 : 0.1) + this.yaw, pitch = wide ? 0.1 : 0.14;
    cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * d, target.y + Math.sin(pitch) * d, target.z + Math.cos(yaw) * Math.cos(pitch) * d);
    cam.lookAt(target);
    cam.near = 0.05; cam.far = 40;
    // shift the picture into the part of the screen the interface leaves free
    cam.setViewOffset(w, h, ins.right / 2, (ins.bottom - ins.top) / 2, w, h);
    cam.updateProjectionMatrix();
    this.look.focus = cam.position.distanceTo(v3(0, BOX.h + OWL_H * 0.6, 0));
  }

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray): boolean {
    if (type === 'down') { this.drag = { x, y, yaw: this.yawGoal, moved: false }; return true; }
    if (type === 'move' && this.drag) {
      const dx = x - this.drag.x;
      if (Math.abs(dx) > 6) this.drag.moved = true;
      this.yawGoal = Math.max(-0.55, Math.min(0.45, this.drag.yaw - dx / 500));
      return true;
    }
    if (type === 'up' && this.drag) {
      if (!this.drag.moved) {
        this.ray.ray.copy(ray);
        const hit = this.ray.intersectObject(this.owl.node, true);
        if (hit.length) { this.owl.poke(); this.onPoke?.(); }
      }
      this.drag = null;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number) {
    if (this.dead) return;
    this.time += dt;
    const a = this.owl, p = this.poseDef;
    // the owl: held pose, looking into the lens; flying lifts him off the box
    a.lookAt = this.lensWorld();
    const lift = (p.lift ?? 0) + (p.lift ? Math.sin(this.time * 2.2) * 0.012 : 0);
    a.node.position.y += (BOX.h + lift - a.node.position.y) * Math.min(1, dt * 5);
    if (p.every && (this.everyT -= dt) <= 0) { this.everyT = p.every[1]; if (a.action === 'none') a.play(p.every[0]); }
    const n = Math.max(1, Math.ceil(dt / (1 / 60)));
    for (let i = 0; i < n; i++) a.update(dt / n);
    // the viewer's camera eases to where it was dragged
    if (Math.abs(this.yaw - this.yawGoal) > 1e-4) { this.yaw += (this.yawGoal - this.yaw) * Math.min(1, dt * 6); this.place(); }
    // the flash: every light jumps, then dies away
    let f = 0;
    if (this.flashT >= 0) { this.flashT += dt; f = Math.max(0, 1 - this.flashT / 0.35); if (this.flashT > 0.4) this.flashT = -1; }
    const L = this.lights;
    L.key.intensity = this.base.key * (1 + f * 3); L.fill.intensity = this.base.fill * (1 + f * 3); L.rim.intensity = this.base.rim * (1 + f * 2);
    for (const m of this.diffusers) m.color.setScalar(1).multiplyScalar(1.5 + f * 5);
    this.glassMat.uniforms.glow.value = 1.15 + f;
    // the photo camera follows his face
    const fc = a.faceCentre(new THREE.Vector3());
    const want = this.framing === 'full' ? v3(0, BOX.h + OWL_H * 0.52 + (p.lift ?? 0), 0) : this.framing === 'bust' ? fc.clone().add(v3(0, -0.012, 0)) : fc.clone().add(v3(0, 0.012, 0));
    this.aim.lerp(want, Math.min(1, dt * 4));
    this.fov += (FOV[this.framing] - this.fov) * Math.min(1, dt * 5);
    // key and read back a few times a second (every frame would cost a sync read)
    if (!this.paused && this.R && this.frame++ % 3 === 0) this.key(PLATE, false);
  }

  private lensWorld(out = new THREE.Vector3()) { this.camRig.updateMatrixWorld(); return this.camRig.localToWorld(out.copy(this.lensAt)); }

  /** Render the plate from the lens and key it into `comp` (size n); read back into `view` unless `shot`. */
  private key(n: number, shot: boolean): HTMLCanvasElement | null {
    const R = this.R!;
    const pc = this.photoCam;
    pc.position.copy(this.lensWorld());
    pc.fov = this.fov; pc.aspect = 1; pc.near = 0.05; pc.far = 20;
    pc.lookAt(this.aim);
    pc.updateProjectionMatrix();
    const plate = shot ? new THREE.WebGLRenderTarget(n, n, { type: THREE.HalfFloatType, samples: 4 }) : this.plate;
    const comp = shot ? new THREE.WebGLRenderTarget(n, n, { type: THREE.UnsignedByteType }) : this.comp;
    const prevRT = R.getRenderTarget(), prevAuto = R.shadowMap.autoUpdate, prevClear = R.getClearColor(new THREE.Color()), prevA = R.getClearAlpha();
    const prevTone = R.toneMapping;
    R.shadowMap.autoUpdate = false; // the main view's shadows are fresh
    R.toneMapping = THREE.NoToneMapping;
    this.camRig.visible = false; // (the lens sees past its own hood)
    R.setRenderTarget(plate);
    R.setClearColor(0x000000, 1);
    R.clear();
    R.render(this.scene, pc);
    this.camRig.visible = true;
    this.keyMat.uniforms.tPlate.value = plate.texture;
    (this.keyMat.uniforms.texel.value as THREE.Vector2).set(1 / n, 1 / n);
    R.setRenderTarget(comp);
    R.render(this.quadScene, this.quadCam);
    const buf = shot ? new Uint8Array(n * n * 4) : this.buf;
    R.readRenderTargetPixels(comp, 0, 0, n, n, buf);
    R.setRenderTarget(prevRT);
    R.setClearColor(prevClear, prevA);
    R.shadowMap.autoUpdate = prevAuto;
    R.toneMapping = prevTone;
    this.keyMat.uniforms.tPlate.value = this.plate.texture;
    (this.keyMat.uniforms.texel.value as THREE.Vector2).set(1 / PLATE, 1 / PLATE);
    // rows come back bottom-up
    const c = shot ? document.createElement('canvas') : this.view;
    if (shot) c.width = c.height = n;
    const g = c.getContext('2d')!;
    const img = shot ? g.createImageData(n, n) : (this.img ??= g.createImageData(n, n));
    const row = n * 4;
    for (let y = 0; y < n; y++) img.data.set(buf.subarray((n - 1 - y) * row, (n - y) * row), y * row);
    g.putImageData(img, 0, 0);
    if (shot) { plate.dispose(); comp.dispose(); return c; }
    this.onView?.();
    return null;
  }

  /**
   * Take the picture: a 512 px exposure keyed onto the backdrop, scaled down to `out` px, as a data URL (WebP where it
   * can be encoded, else PNG). The strobes fire just after (the flash is for show: the exposure is balanced).
   */
  shoot(out = 256): string {
    if (!this.R) return '';
    const big = this.key(SHOT, true)!;
    this.flashT = 0;
    const c = document.createElement('canvas');
    c.width = c.height = out;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(big, 0, 0, out, out);
    let url = '';
    try { url = c.toDataURL('image/webp', 0.86); } catch { url = ''; }
    if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/png');
    return url;
  }
  /** the raw plate (green and all), for the dev page */
  showPlate(on: boolean) { this.keyMat.uniforms.mode.value = on ? 1 : 0; }

  dispose() {
    this.dead = true;
    this.owl.dispose();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.texs) t.dispose();
    this.plate.dispose(); this.comp.dispose();
    this.env?.dispose(); this.pmrem?.dispose();
    this.scene.clear();
  }
}

// ------------------------------------------------------------------ painted textures

/** the studio's walls: warm dark plaster, a little uneven */
function wallCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3b2e2a'; g.fillRect(0, 0, 512, 256);
  const im = g.getImageData(0, 0, 512, 256), d = im.data;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 512; x++) {
    const n = Math.sin(x * 0.05 + Math.sin(y * 0.07) * 2) * 0.5 + Math.sin(x * 0.013 + y * 0.021) * 0.5;
    const k = (n * 6 + (Math.random() - 0.5) * 8) | 0, i = (y * 512 + x) * 4;
    d[i] += k; d[i + 1] += k; d[i + 2] += k;
  }
  g.putImageData(im, 0, 0);
  return c;
}
/** a softbox's front: warm white muslin glowing brightest in the middle */
function diffuserCanvas(warm: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(64, 60, 4, 64, 64, 92);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, warm ? '#fff1dc' : '#f2f4ff'); gr.addColorStop(1, warm ? '#d9c2a0' : '#c8cee0');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(120,100,80,0.18)'; g.lineWidth = 1;
  for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, 128); g.stroke(); }
  return c;
}
