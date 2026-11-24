// Queen Neve's boutique: a snug winter shop seen from just in front of the counter. Worn oak
// floorboards, sage-painted panelling under a hand-striped oat wallpaper, dark beams, a deep bay
// window onto a moonlit snowy evening with frost on the panes and fairy lights along the pelmet. The
// furniture and props are real, hand-textured low-poly models borrowed from Poly Haven (CC0), the
// owner's lumberjack game BUSHED and Gacha Garage, restyled to the calm palette with a matte finish
// (public/models/shop/*.glb, credits in docs/credits/shop3.md): a glass shop counter with a till, a
// reception bell and an oil lamp, painted shelves and a hutch, a tiled stove, an armchair and floor
// lamp, a spinning wheel, a marble bust in a beret, a hat table, a grandfather clock, a potted fir.
// Today's three deals are on display: on round display tables either side, and on the counter.
// Queen Neve stands behind the counter. OWNED BY THE SHOP BUILDER.
import * as THREE from 'three';
import { box, buildProp, propMesh, type BoxSpec, type Texel } from '../../gfx/box.ts';
import { instanceGLB, modelUrl } from '../../gfx/glb.ts';
import { P } from '../../gfx/palette.ts';
import { ITEMS } from '../../assets/registry.ts';
import { OwlActor, type OwlAction, type OwlFx, type OwlMood } from '../../owl/actor.ts';
import type { OwlLook } from '../../owl/model.ts';
import { PIECE } from '../../owl/outfits.ts';
import { QUEEN_LOOK } from '../../owl/queen.ts';
import { sceneSound, sound } from '../../audio/sound.ts';
import { Fx, SPR } from '../fx.ts';
import type { Stage } from '../scene.ts';
import { bulbTexture, frostTexture, haloTexture, outdoorTexture, poolTexture } from './shopart.ts';
import { pottedFir, pottedMonstera, swayPlants, trailingPothos, type Plant } from './shopplants.ts';
import { HOUSE, groundY } from '../layout.ts';

/** The real world the window looks out on (the app's Scene: its scene graph and weather). */
export interface WorldView { scene: THREE.Scene; weather?: { vis: { snow: number } } }

// real public-domain paintings from the Art Institute of Chicago (credits in docs/credits/shop3.md)
interface Art { file: string; w: number; h: number; at: [number, number, number]; yaw: number }
const ART: Art[] = [
  { file: 'monet_sandvika', w: 1.0, h: 0.78, at: [-2.55, 2.98, -2.79], yaw: 0 },
  { file: 'hokusai_cranes', w: 0.4, h: 0.87, at: [3.3, 3.08, -2.79], yaw: 0 },
  { file: 'fantin_flowers', w: 0.85, h: 0.69, at: [-4.24, 2.12, -0.95], yaw: Math.PI / 2 },
  { file: 'twachtman_icebound', w: 0.95, h: 0.79, at: [4.24, 2.05, 0.55], yaw: -Math.PI / 2 },
];

export interface DisplayItem { kind: 'item' | 'piece' | 'species' | 'skin' | 'finish'; id: string }
export type BoutiqueLayout = 'side' | 'top';

// the room (world units = metres): back wall at z = -2.8, side walls at x = +-4.25, ceiling at 4.25
const ROOM = { w: 4.25, back: -2.8, front: 9, h: 4.25, dado: 1.0 };
// the window opening in the back wall and its glass, set back into a bay
const WIN = { x: 1.25, y0: 1.125, y1: 3.125, glass: -3.25 };
const COUNTER_TOP = 1.0;

// ------------------------------------------------------------------ model helpers

/** A borrowed shop model scaled to `height` metres (or `width`), standing on y = 0, centred on x/z. */
async function shopModel(id: string, height: number, o: { width?: number } = {}): Promise<THREE.Object3D> {
  const { root } = await instanceGLB(`shop/${id}.glb`);
  const g = new THREE.Group();
  g.add(root);
  root.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(root), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const k = o.width ? o.width / Math.max(0.001, s.x) : height / Math.max(0.001, s.y);
  root.scale.multiplyScalar(k);
  root.position.set(-c.x * k, -b.min.y * k, -c.z * k);
  root.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      // BUSHED's convention: crisp texels up close (nearest), mipmapped in the distance; a matte finish
      if (mat.map) { mat.map.magFilter = THREE.NearestFilter; mat.map.minFilter = THREE.LinearMipmapLinearFilter; mat.map.needsUpdate = true; }
      mat.roughness = Math.max(mat.roughness ?? 0.9, 0.82); mat.metalness = Math.min(mat.metalness ?? 0, 0.15);
    }
  });
  return g;
}

function boxMesh(boxes: BoxSpec[]): THREE.Mesh {
  const m = propMesh(buildProp(boxes, { wind: false }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Scale and lift an object so it fits a W x H x D box with its feet at y = 0. */
function fit(o: THREE.Object3D, W: number, H: number, D = W) {
  o.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(o), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const k = Math.min(W / Math.max(0.01, s.x), H / Math.max(0.01, s.y), D / Math.max(0.01, s.z));
  o.scale.multiplyScalar(k);
  o.position.x -= c.x * k; o.position.z -= c.z * k;
  o.position.y -= b.min.y * k;
}

/** Today's item: its hand-made GLB when it has one, else its built model. */
async function itemModel(id: string): Promise<THREE.Object3D | null> {
  const def = ITEMS[id];
  if (!def) return null;
  const g = new THREE.Group();
  if (def.model) {
    try {
      const { root, clips } = await instanceGLB(def.model);
      g.add(root);
      if (clips.length) {
        const mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(clips.find((c) => c.name === 'idle') ?? clips[0]).play();
        g.userData.animate = (_t: number, dt: number) => mixer.update(dt);
      }
      return g;
    } catch { /* fall back */ }
  }
  const m = boxMesh(def.build());
  for (const p of def.parts?.() ?? []) m.add(p);
  g.add(m);
  if (def.animate) g.userData.animate = (t: number, dt: number) => def.animate!(m, t, dt);
  g.userData.dispose = () => m.userData.dispose?.();
  return g;
}

// ------------------------------------------------------------------ the room's surfaces

const loader = new THREE.TextureLoader();
/** A room texture (BUSHED pixel-art PBR set, restyled): nearest magnification, mipmapped minification. */
function roomTex(name: string, srgb = true): THREE.Texture {
  const t = loader.load(modelUrl(`shop/tex/${name}.png`));
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 8;
  return t;
}
const pbr = (name: string, normal = true): THREE.MeshStandardMaterialParameters => ({ map: roomTex(name), ...(normal ? { normalMap: roomTex(name + '_n', false), normalScale: new THREE.Vector2(0.8, 0.8) } : {}) });
const pbrBeams = () => pbr('beams');
/** A flat rectangle whose texture tiles in world units (`tile` metres per repeat). */
function panel(w: number, h: number, mat: THREE.Material, tile: number, at: [number, number, number], rotY = 0, rotX = 0): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  const uv = geo.attributes.uv as THREE.BufferAttribute, pos = geo.attributes.position as THREE.BufferAttribute;
  const ox = rotY ? at[2] : at[0], oy = rotX ? at[2] : at[1];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + ox) / tile, (pos.getY(i) + oy) / tile);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.rotation.set(rotX, rotY, 0);
  m.receiveShadow = true;
  return m;
}
/** A beam, rail or bit of trim: a box whose texture runs along its length. */
function beam(size: [number, number, number], at: [number, number, number], mat: THREE.Material, tile = 1.2): THREE.Mesh {
  const geo = new THREE.BoxGeometry(...size);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const long = Math.max(...size);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (long / tile), uv.getY(i) * 0.25);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Linen for the curtains: a soft hand-painted weave with a berry hem, drawn once. */
function linenTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e6dcc2'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const v = ((x * 7 + y * 13) % 11) / 11;
    if ((x + (y >> 1)) % 3 === 0 || v > 0.86) { g.fillStyle = v > 0.5 ? 'rgba(201,183,141,0.35)' : 'rgba(255,250,238,0.35)'; g.fillRect(x, y, 1, 1); }
  }
  g.fillStyle = 'rgba(158,95,102,0.75)'; g.fillRect(0, 2, 64, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
/** A gathered curtain: a plane rippled into folds and caught in at the tie-back. */
function curtain(mat: THREE.Material, h: number, w: number, side: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h, 24, 20);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), v = (y + h / 2) / h, u = (x + w / 2) / w;
    const tie = Math.exp(-((v - 0.42) ** 2) / 0.02);
    const pinch = 1 - tie * 0.55;
    pos.setX(i, (x + side * tie * w * 0.25) * pinch);
    pos.setZ(i, Math.sin(u * Math.PI * 7) * 0.045 * (0.5 + v * 0.6) + Math.sin(u * Math.PI * 3 + 1) * 0.02);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ the props and where they stand

interface Place { id: string; h: number; at: [number, number, number]; yaw?: number; width?: number; tag?: string }
const PROPS: Place[] = [
  // the counter and what stands on it
  { id: 'gg_showcase', h: COUNTER_TOP, at: [0, 0, -0.78], width: 2.2 },
  { id: 'till', h: 0.4, at: [0.62, COUNTER_TOP, -0.9], yaw: -0.25 },
  { id: 'gg_call_bell_p', h: 0.09, at: [0.12, COUNTER_TOP, -0.6], tag: 'bell' },
  { id: 'oil_lamp', h: 0.55, at: [-0.98, COUNTER_TOP, -0.92] },
  // back wall, left of the window: painted shelves, a grandfather clock, a monstera, a hat table
  { id: 'gg_bookshelf', h: 2.2, at: [-2.55, 0, -2.5], width: 1.6, tag: 'stock' },
  { id: 'clock', h: 2.1, at: [-3.82, 0, -2.42] },
  { id: 'gg_table_round', h: 0.72, at: [-2.2, 0, -1.55], width: 0.95 },
  { id: 'gg_wear_boater', h: 0.11, at: [-2.42, 0.72, -1.62], yaw: 0.4 },
  { id: 'gg_wear_beanie_pom', h: 0.2, at: [-2.0, 0.72, -1.4], yaw: -0.3 },
  { id: 'gg_wear_fedora', h: 0.13, at: [-2.08, 0.72, -1.8], yaw: 1.2 },
  // left wall: a white cupboard with a marble bust in a beret, an ornate mirror, a spinning wheel, luggage
  { id: 'cupboard', h: 1.0, at: [-3.92, 0, -0.95], yaw: Math.PI / 2 },
  { id: 'bust', h: 0.62, at: [-3.92, 1.0, -0.95], yaw: Math.PI / 2 - 0.5 },
  { id: 'gg_wear_beret', h: 0.07, at: [-3.88, 1.58, -0.95], yaw: 0.6 },
  { id: 'mirror', h: 1.25, at: [-4.2, 1.15, 0.25], yaw: Math.PI / 2 },
  { id: 'spinning_wheel', h: 1.05, at: [-3.45, 0, 0.75], yaw: 0.7 },
  { id: 'suitcase', h: 0.5, at: [-2.75, 0, 1.55], yaw: 0.35 },
  { id: 'suitcase', h: 0.42, at: [-2.73, 0.5, 1.53], yaw: 0.6 },
  { id: 'lantern', h: 0.3, at: [-2.7, 0.92, 1.5], yaw: 0.3 },
  // back wall, right of the window: the vintage hutch, a pothos, a potted fir in the corner
  { id: 'gg_cabinet_vintage', h: 2.25, at: [2.6, 0, -2.45] },
  // right wall: the tiled stove, an armchair with a floor lamp, a tea table, a jar shelf
  { id: 'stove', h: 1.75, at: [3.85, 0, -1.25], yaw: -Math.PI / 2 },
  { id: 'gg_armchair', h: 1.0, at: [3.3, 0, 0.5], yaw: -0.85 },
  { id: 'gg_floor_lamp', h: 1.65, at: [3.85, 0, -0.25] },
  { id: 'gg_table_side', h: 0.55, at: [2.95, 0, 1.45], yaw: -0.3 },
  { id: 'tea_set', h: 0.2, at: [2.95, 0.55, 1.45], yaw: 0.4 },
  { id: 'gg_wall_shelf_jars', h: 0.5, at: [4.12, 1.75, 1.35], yaw: -Math.PI / 2 },
  // the window seat: pillows, a wooden lantern, the teddy
  { id: 'pillows', h: 0.32, at: [-0.55, WIN.y0 + 0.09, -2.62], width: 0.9 },
  { id: 'wood_lantern', h: 0.42, at: [0.95, WIN.y0 + 0.09, -2.66] },
  { id: 'gg_teddy', h: 0.36, at: [0.45, WIN.y0 + 0.09, -2.6], yaw: -0.3 },
  // hanging lights
  { id: 'lantern_chandelier', h: 0.85, at: [0, ROOM.h - 1.1, -0.35], tag: 'hang' },
  { id: 'gg_lamp_pendant', h: 0.45, at: [-1.9, 3.05, 0.1], tag: 'hang' },
  { id: 'gg_lamp_pendant', h: 0.45, at: [1.9, 3.05, 0.1], tag: 'hang' },
];

// display spots: two round display tables on the floor, one on the counter
interface SpotDef { x: number; y: number; z: number; floor: boolean }
const SPOTS: SpotDef[] = [
  { x: -1.86, y: 0, z: 0.16, floor: true },
  { x: -0.52, y: COUNTER_TOP, z: -0.74, floor: false },
  { x: 1.86, y: 0, z: 0.16, floor: true },
];
const TABLE_H = 0.62;

interface Stand {
  def: SpotDef;
  group: THREE.Group;
  base: THREE.Group;
  holder: THREE.Group;
  top: number;
  model: THREE.Object3D | null;
  owl: OwlActor | null;
  pool: THREE.Mesh;
  hit: THREE.Mesh;
  focus: number;
  bounce: number;
  sold: boolean;
}

interface Bulb { s: THREE.Sprite; h: THREE.Sprite; c: THREE.Color; phase: number }

// ------------------------------------------------------------------ BUSHED-style picture: low internal resolution, graded, dithered, grain

const POST_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const POST_FS = /* glsl */ `
uniform sampler2D tColor; uniform vec2 uRes; uniform float uTime, uGrain, uQuant, uVig, uSat, uWarm, uContrast, uExposure;
varying vec2 vUv;
float bayer4(vec2 p) { vec2 q = mod(p, 4.0); int i = int(q.x) + int(q.y) * 4;
  float m[16]; m[0]=0.;m[1]=8.;m[2]=2.;m[3]=10.;m[4]=12.;m[5]=4.;m[6]=14.;m[7]=6.;m[8]=3.;m[9]=11.;m[10]=1.;m[11]=9.;m[12]=15.;m[13]=7.;m[14]=13.;m[15]=5.;
  for (int k = 0; k < 16; k++) if (k == i) return (m[k] + 0.5) / 16.0; return 0.5; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 px = floor(vUv * uRes);
  vec3 col = texture2D(tColor, (px + 0.5) / uRes).rgb * uExposure;
  col = toSRGB(col / (1.0 + col * 0.18));
  col = (col - 0.5) * uContrast + 0.5;
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(l), col, uSat);
  // split toning: lamp-warm highlights, slate-cool shadows
  col += uWarm * (vec3(0.045, 0.02, -0.03) * smoothstep(0.45, 1.0, l) + vec3(-0.02, 0.0, 0.025) * (1.0 - smoothstep(0.0, 0.45, l)));
  vec2 q = vUv - 0.5;
  col *= 1.0 - uVig * dot(q, q) * 1.5;
  col += (hash(px + fract(uTime) * 91.0) - 0.5) * uGrain;
  col = floor(col * uQuant + 0.5 + (bayer4(px) - 0.5) * 0.9) / uQuant;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export class Boutique implements Stage {
  /** the shop itself (rendered at a low internal resolution once a renderer is attached) */
  readonly room = new THREE.Scene();
  /** what the app draws: the graded low-res picture on a full-screen triangle (or the room, unattached) */
  get scene(): THREE.Scene { return this.gl ? this.screen : this.room; }
  private screen = new THREE.Scene();
  private gl: THREE.WebGLRenderer | null = null;
  private rt: THREE.WebGLRenderTarget | null = null;
  private post = new THREE.ShaderMaterial({
    vertexShader: POST_VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
    uniforms: { tColor: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uGrain: { value: 0.035 }, uQuant: { value: 48 }, uVig: { value: 0.32 }, uSat: { value: 0.92 }, uWarm: { value: 1.0 }, uContrast: { value: 1.05 }, uExposure: { value: 1.4 } },
  });
  /** screen (CSS) pixels per internal pixel */
  pixel = 1.6;
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.2, 80);
  readonly queen: OwlActor;
  readonly fx = new Fx(900);
  /** resolves when the room's models are in */
  readonly ready: Promise<void>;
  layout: BoutiqueLayout = 'side';
  /** where the boutique's centre sits on screen (fractions), set by resize() */
  focus = { x: 0.72, y: 0.5 };
  /** taps on a display (0..2) or the queen */
  onPick: ((i: number) => void) | null = null;
  onQueen: (() => void) | null = null;
  private queenRig = new THREE.Group();
  private stands: Stand[] = [];
  private bulbs: Bulb[] = [];
  private swingers: THREE.Object3D[] = [];
  private lampLights: THREE.PointLight[] = [];
  private stoveLight = new THREE.PointLight(0xefb85a, 2.2, 3.5, 1.6);
  private focusLight = new THREE.SpotLight(0xf9e9c4, 0, 7, 0.32, 0.6, 1.2);
  private bell: THREE.Object3D | null = null;
  private plants: Plant[] = [];
  private world: WorldView | null = null;
  private viewCam = new THREE.PerspectiveCamera(46, 1.4, 0.1, 400);
  private viewRT: THREE.WebGLRenderTarget | null = null;
  private viewFrame = 0;
  private outside: THREE.MeshBasicMaterial | null = null;
  private bellT = 0;
  private disposables: (() => void)[] = [];
  private time = 0;
  private snowT = 0;
  private moteT = 0;
  private curtsy = 0;
  private idleT = 4;
  private lookT = 0;
  private enter = 0;
  private cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(0, 1.5, -0.9) };
  private w = 1; private h = 1;
  private ray = new THREE.Raycaster();
  private downAt: { x: number; y: number; t: number } | null = null;
  private dealKey = '';
  private dealToken = 0;
  private dead = false;

  constructor(deals: DisplayItem[] = []) {
    const S = this.room;
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const quad = new THREE.Mesh(tri, this.post);
    quad.frustumCulled = false;
    this.screen.add(quad);
    this.disposables.push(() => { tri.dispose(); this.post.dispose(); this.rt?.dispose(); });
    S.background = new THREE.Color(P.night);
    S.fog = new THREE.Fog(P.night, 14, 40);

    // light: a soft warm fill, lamplight from the fittings, a cool breath from the window
    S.add(new THREE.HemisphereLight(0xe6dcc6, 0x4a392b, 1.3));
    const key = new THREE.DirectionalLight(0xf6e2b4, 1.15);
    key.position.set(-3.5, 6.5, 6); key.target.position.set(0.4, 0.8, -1.2);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    const sc = key.shadow.camera; sc.left = -5.5; sc.right = 5.5; sc.top = 5; sc.bottom = -3; sc.near = 1; sc.far = 20;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
    S.add(key, key.target);
    const moon = new THREE.DirectionalLight(0xaec8cc, 0.5);
    moon.position.set(0.6, 4, -8); moon.target.position.set(0, 1, 0);
    S.add(moon, moon.target);
    const winFill = new THREE.PointLight(0xaec8cc, 1.8, 5, 1.6);
    winFill.position.set(0, 2.2, -2.5);
    S.add(winFill);
    this.stoveLight.position.set(3.4, 0.9, -1.25);
    S.add(this.stoveLight);
    for (const [x, y, z, i] of [[0, 3.2, -0.35, 2.6], [-1.9, 2.75, 0.1, 1.6], [1.9, 2.75, 0.1, 1.6], [3.85, 1.55, -0.25, 1.4]] as const) {
      const l = new THREE.PointLight(0xf4dca6, i, 5, 1.5);
      l.position.set(x, y, z);
      l.userData.base = i;
      S.add(l);
      this.lampLights.push(l);
    }
    this.focusLight.position.set(0, 4.1, 1.2);
    S.add(this.focusLight, this.focusLight.target);

    // Queen Neve on a little step behind her counter
    this.queen = new OwlActor(QUEEN_LOOK, { fx: (k, at, n) => this.owlFx(k, at, n), sound: (id) => sceneSound('owl_' + id) });
    this.queen.node.scale.setScalar(1.28);
    this.queen.setMood('happy');
    this.queenRig.position.set(0.1, 0.42, -1.66);
    this.queenRig.add(this.queen.node);
    S.add(this.queenRig);
    S.add(this.fx.group);
    this.fx.setLight(new THREE.Color(0xf4ecd8));

    this.buildRoom();
    this.buildWindow();
    this.buildArt();
    this.buildPlants();
    this.buildBulbs();
    SPOTS.forEach((d, i) => this.stands.push(this.makeStand(i, d)));
    this.ready = this.loadProps();
    this.setDeals(deals);
    for (let i = 0; i < 30; i++) this.queen.update(1 / 30);
  }

  /** Draw through this renderer: the room goes to a low-resolution target, then is graded onto the screen. */
  attach(renderer: THREE.WebGLRenderer, world?: WorldView) {
    this.gl = renderer;
    if (world && !this.world) {
      this.world = world;
      // look out from the tree house porch across the clearing, at an owl's eye height
      const x = HOUSE.x + 1.5, z = HOUSE.z + 8.5;
      this.viewCam.position.set(x, groundY(x, z) + 1.7, z);
      this.viewCam.lookAt(x + 3, groundY(x, z) + 2.6, z + 12);
      this.viewRT = new THREE.WebGLRenderTarget(288, 208, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      if (this.outside) { this.outside.map = this.viewRT.texture; this.outside.needsUpdate = true; }
      this.disposables.push(() => this.viewRT?.dispose());
    }
  }

  private renderRoom(t: number) {
    const gl = this.gl;
    if (!gl) return;
    const cw = gl.domElement.clientWidth || this.w, ch = gl.domElement.clientHeight || this.h;
    const w = Math.max(64, Math.round(cw / this.pixel)), h = Math.max(64, Math.round(ch / this.pixel));
    if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
      this.rt?.dispose();
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    }
    const u = this.post.uniforms;
    u.tColor.value = this.rt.texture; u.uRes.value.set(w, h); u.uTime.value = t;
    const prev = gl.getRenderTarget();
    // the real forest outside the window, refreshed every few frames
    if (this.world && this.viewRT && this.viewFrame++ % 3 === 0) {
      gl.setRenderTarget(this.viewRT);
      gl.render(this.world.scene, this.viewCam);
    }
    gl.setRenderTarget(this.rt);
    gl.render(this.room, this.camera);
    gl.setRenderTarget(prev);
  }

  // ---------------------------------------------------------------- building the shop

  private mat(o: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...o });
    this.disposables.push(() => { m.map?.dispose(); m.normalMap?.dispose(); m.dispose(); });
    return m;
  }

  /** floorboards, papered walls over panelling, trim, a plaster ceiling on beams */
  private buildRoom() {
    const S = this.room, R = ROOM, D = R.front - R.back, mz = (R.front + R.back) / 2;
    const floor = this.mat(pbr('floor')), paper = this.mat(pbr('paper', false)), panels = this.mat(pbr('panels'));
    const ceil = this.mat({ ...pbr('walls'), color: 0xd8ccb4 }), dark = this.mat(pbr('beams')), trim = this.mat({ ...pbr('walls'), color: 0xe6dcc6 });
    const geoms: THREE.BufferGeometry[] = [];
    const add = (m: THREE.Mesh) => { S.add(m); geoms.push(m.geometry); return m; };
    add(panel(2 * R.w, D, floor, 2.0, [0, 0, mz], 0, -Math.PI / 2));
    // a woven runner in front of the counter
    const rug = add(new THREE.Mesh(new THREE.PlaneGeometry(1.15, 3.6), this.mat({ map: roomTex('rug'), roughness: 1 })));
    rug.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    rug.position.set(0, 0.006, 0.7);
    rug.receiveShadow = true;
    // back wall: wallpaper around the window, panelling below the dado
    const z = R.back, up = R.dado, sideW = R.w - WIN.x;
    add(panel(sideW, R.h - up, paper, 1.0, [-(WIN.x + sideW / 2), up + (R.h - up) / 2, z]));
    add(panel(sideW, R.h - up, paper, 1.0, [WIN.x + sideW / 2, up + (R.h - up) / 2, z]));
    add(panel(2 * WIN.x, R.h - WIN.y1, paper, 1.0, [0, (R.h + WIN.y1) / 2, z]));
    add(panel(2 * WIN.x, WIN.y0 - up, paper, 1.0, [0, (WIN.y0 + up) / 2, z]));
    add(panel(2 * R.w, up, panels, 2.0, [0, up / 2, z + 0.01]));
    // side walls with the same panelling, dado rail, skirting and cornice
    for (const sd of [-1, 1]) {
      add(panel(D, R.h - up, paper, 1.0, [sd * R.w, up + (R.h - up) / 2, mz], -sd * Math.PI / 2));
      add(panel(D, up, panels, 2.0, [sd * (R.w - 0.01), up / 2, mz], -sd * Math.PI / 2));
      add(beam([0.07, 0.08, D], [sd * (R.w - 0.035), up, mz], trim));
      add(beam([0.04, 0.16, D], [sd * (R.w - 0.02), 0.08, mz], dark));
      add(beam([0.12, 0.14, D], [sd * (R.w - 0.06), R.h - 0.07, mz], trim));
    }
    add(beam([2 * R.w, 0.08, 0.07], [0, up, z + 0.035], trim));
    add(beam([2 * R.w, 0.16, 0.04], [0, 0.08, z + 0.02], dark));
    add(beam([2 * R.w, 0.14, 0.12], [0, R.h - 0.07, z + 0.06], trim));
    // ceiling and beams
    add(panel(2 * R.w, D, ceil, 2.0, [0, R.h, mz], 0, Math.PI / 2));
    for (const bz of [-2.1, -0.4, 1.3, 3.0, 4.7, 6.4]) add(beam([2 * R.w, 0.2, 0.22], [0, R.h - 0.1, bz], dark, 1.6));
    this.disposables.push(() => { for (const g of geoms) g.dispose(); });
  }

  /** the bay window: casing, sash, a seat with a cushion, pelmet, curtains, the snowy evening outside */
  private buildWindow() {
    const S = this.room, z = ROOM.back;
    const wood = this.mat({ ...pbr('walls'), color: 0xf0e8d8 }), painted = this.mat(pbr('panels'));
    const geoms: THREE.BufferGeometry[] = [];
    const add = <T extends THREE.Mesh>(m: T) => { S.add(m); geoms.push(m.geometry); return m; };
    const b = (size: [number, number, number], at: [number, number, number], m: THREE.Material = wood) => add(beam(size, at, m, 0.9));
    const depth = z - WIN.glass, H = WIN.y1 - WIN.y0, g = WIN.glass;
    // the bay's panelled sides, head and floor
    for (const sd of [-1, 1]) b([0.06, H, depth], [sd * (WIN.x + 0.03), (WIN.y0 + WIN.y1) / 2, (z + g) / 2], painted);
    b([2 * WIN.x + 0.12, 0.06, depth], [0, WIN.y1 + 0.03, (z + g) / 2], painted);
    // sash and glazing bars
    b([2 * WIN.x, 0.08, 0.07], [0, WIN.y1 - 0.04, g]); b([2 * WIN.x, 0.1, 0.07], [0, WIN.y0 + 0.05, g]);
    for (const sd of [-1, 1]) b([0.08, H, 0.07], [sd * (WIN.x - 0.04), (WIN.y0 + WIN.y1) / 2, g]);
    for (const x of [-WIN.x / 3, WIN.x / 3]) b([0.05, H, 0.06], [x, (WIN.y0 + WIN.y1) / 2, g]);
    b([2 * WIN.x, 0.05, 0.06], [0, WIN.y0 + H * 0.62, g]);
    // casing on the wall
    for (const sd of [-1, 1]) b([0.18, H + 0.24, 0.06], [sd * (WIN.x + 0.09), (WIN.y0 + WIN.y1) / 2 + 0.06, z + 0.03]);
    // the window seat with a plum cushion
    b([2 * WIN.x + 0.5, 0.08, 0.6], [0, WIN.y0 - 0.04, z + 0.18]);
    b([2 * WIN.x + 0.4, WIN.y0 - 0.08 - ROOM.dado + 0.04, 0.05], [0, (WIN.y0 - 0.08 + ROOM.dado) / 2, z + 0.46], painted);
    const cushion = add(new THREE.Mesh(new THREE.BoxGeometry(2 * WIN.x - 0.05, 0.09, 0.44), this.mat({ color: 0x7b6079, roughness: 1 })));
    cushion.position.set(0, WIN.y0 + 0.045, z + 0.16);
    cushion.castShadow = cushion.receiveShadow = true;
    // pelmet and pole
    b([2 * WIN.x + 0.7, 0.26, 0.14], [0, WIN.y1 + 0.27, z + 0.08], painted);
    b([2 * WIN.x + 0.8, 0.04, 0.17], [0, WIN.y1 + 0.13, z + 0.09]);
    // linen curtains gathered at tie-backs
    const lt = linenTexture(), cm = this.mat({ map: lt, side: THREE.DoubleSide, roughness: 1 });
    for (const sd of [-1, 1]) {
      const c = add(curtain(cm, H + 0.35, 0.62, -sd));
      c.position.set(sd * (WIN.x + 0.26), (WIN.y0 + WIN.y1) / 2 + 0.12, z + 0.2);
    }
    // the snowy evening outside and frost on the glass
    const out = outdoorTexture();
    // outside: the real world once attached (a render of the forest), a painted stand-in until then
    this.outside = new THREE.MeshBasicMaterial({ map: this.viewRT?.texture ?? out, fog: false });
    const bg = add(new THREE.Mesh(new THREE.PlaneGeometry(4.2, 3.0), this.outside));
    bg.position.set(0, 2.05, g - 0.95);
    const fr = frostTexture([0, 1 / 3, 2 / 3, 1], [0, 0.38, 1]);
    const frost = add(new THREE.Mesh(new THREE.PlaneGeometry(2 * WIN.x, H), new THREE.MeshBasicMaterial({ map: fr, transparent: true, depthWrite: false })));
    frost.position.set(0, (WIN.y0 + WIN.y1) / 2, g + 0.045);
    frost.renderOrder = 2;
    this.disposables.push(() => { for (const gg of geoms) gg.dispose(); lt.dispose(); out.dispose(); fr.dispose(); (bg.material as THREE.Material).dispose(); (frost.material as THREE.Material).dispose(); });
  }

  /** real paintings in simple gilded oak frames */
  private buildArt() {
    const frameMat = this.mat({ ...pbrBeams(), color: 0xd9bf86 });
    for (const a of ART) {
      const g = new THREE.Group();
      const tex = loader.load(modelUrl(`shop/art/${a.file}.png`));
      tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
      const canvasMat = this.mat({ map: tex, roughness: 0.95 });
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(a.w, a.h), canvasMat);
      pic.position.z = 0.025;
      g.add(pic);
      const t = 0.06, d = 0.05;
      g.add(beam([a.w + 2 * t, t, d], [0, a.h / 2 + t / 2, d / 2], frameMat, 0.6), beam([a.w + 2 * t, t, d], [0, -a.h / 2 - t / 2, d / 2], frameMat, 0.6));
      g.add(beam([t, a.h, d], [-a.w / 2 - t / 2, 0, d / 2], frameMat, 0.6), beam([t, a.h, d], [a.w / 2 + t / 2, 0, d / 2], frameMat, 0.6));
      g.position.set(...a.at);
      g.rotation.y = a.yaw;
      this.room.add(g);
      this.disposables.push(() => g.traverse((n) => (n as THREE.Mesh).geometry?.dispose()));
    }
  }

  /** greenery built from pixel-art leaf cards */
  private buildPlants() {
    const put = (p: Plant, at: [number, number, number], yaw = 0) => { p.group.position.set(...at); p.group.rotation.y = yaw; this.room.add(p.group); this.plants.push(p); };
    put(pottedFir(1.9), [3.92, 0, -2.42], 0.3);
    put(pottedMonstera(1.25), [-1.46, 0, -2.4], 0.4);
    put(trailingPothos(0.75), [2.15, 2.25, -2.32]);
    this.disposables.push(() => this.plants.forEach((p) => p.dispose()));
  }

  private async loadProps() {
    await Promise.all(PROPS.map(async (p) => {
      let o: THREE.Object3D;
      try { o = await shopModel(p.id, p.h, { width: p.width }); } catch (e) { console.warn('shop model missing', p.id, e); return; }
      if (this.dead) return;
      o.position.set(...p.at);
      o.rotation.y = p.yaw ?? 0;
      if (p.tag === 'bell') this.bell = o;
      if (p.tag === 'stock') { this.room.add(o); o.updateMatrixWorld(true); void this.stock(o); }
      if (p.tag === 'hang') {
        // hung from the ceiling on a cord, swaying a little
        const top = p.at[1] + new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).y;
        const len = Math.max(0.05, ROOM.h - top);
        const geo = new THREE.CylinderGeometry(0.008, 0.008, len, 4);
        const cord = new THREE.Mesh(geo, this.mat({ color: 0x2e2b24 }));
        cord.position.set(0, top - p.at[1] + len / 2, 0);
        o.add(cord);
        this.disposables.push(() => geo.dispose());
        o.userData.phase = this.swingers.length * 1.7;
        this.swingers.push(o);
      }
      this.room.add(o);
    }));
  }

  /** Fill a shelf unit: find its boards by casting rays down through it, then set goods on each. */
  private async stock(unit: THREE.Object3D) {
    const b = new THREE.Box3().setFromObject(unit), ray = new THREE.Raycaster();
    const cz = (b.min.z + b.max.z) / 2 + 0.02, w = b.max.x - b.min.x;
    const goods = ['gg_books_stack', 'gg_wear_beanie_pom', 'mantel_clock', 'basket', 'gg_vase_ceramic', 'gg_wear_boater', 'candlestick', 'gg_books_stack', 'gg_wear_fedora', 'gg_teddy'];
    const height: Record<string, number> = { gg_books_stack: 0.16, gg_wear_beanie_pom: 0.18, mantel_clock: 0.2, basket: 0.12, gg_vase_ceramic: 0.26, gg_wear_boater: 0.09, candlestick: 0.24, gg_wear_fedora: 0.12, gg_teddy: 0.26 };
    let k = 0;
    for (const fx of [0.28, 0.72]) {
      const x = b.min.x + w * fx;
      ray.set(new THREE.Vector3(x, b.max.y + 0.5, cz), new THREE.Vector3(0, -1, 0));
      const ys = ray.intersectObject(unit, true).filter((h) => (h.face?.normal ? h.face.normal.clone().transformDirection(h.object.matrixWorld).y > 0.7 : true)).map((h) => h.point.y);
      const levels = ys.filter((y, i) => i === 0 || Math.abs(ys[i - 1] - y) > 0.18).filter((y) => y > b.min.y + 0.15 && y < b.max.y - 0.1);
      if (import.meta.env.DEV) console.debug('shelf levels', levels.map((y) => y.toFixed(2)).join(' '));
      for (const y of levels) {
        const id = goods[k++ % goods.length];
        try {
          const o = await shopModel(id, height[id] ?? 0.18);
          if (this.dead) return;
          o.position.set(x + (k % 2 ? 0.04 : -0.05), y, cz + 0.02);
          o.rotation.y = (k * 1.3) % 1 - 0.5;
          this.room.add(o);
        } catch { /* skip */ }
      }
    }
  }

  /** fairy lights strung along the pelmet */
  private buildBulbs() {
    const bt = bulbTexture(), ht = haloTexture();
    const cols = [P.lamp, P.honey, P.rose, P.sageLight, P.ice, P.blush];
    const wire = new THREE.LineBasicMaterial({ color: P.ink2 });
    this.disposables.push(() => { bt.dispose(); ht.dispose(); wire.dispose(); });
    const string = (x0: number, x1: number, y: number, z: number, hooks: number, sag: number, n: number) => {
      const pts: THREE.Vector3[] = [];
      const at = (t: number) => { const seg = t * hooks, f = seg - Math.floor(seg); return new THREE.Vector3(x0 + (x1 - x0) * t, y - Math.sin(f * Math.PI) * sag, z); };
      for (let i = 0; i <= 60; i++) pts.push(at(i / 60));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      this.room.add(new THREE.Line(geo, wire));
      this.disposables.push(() => geo.dispose());
      for (let i = 0; i < n; i++) {
        const p = at((i + 0.5) / n);
        const c = new THREE.Color(cols[(i * 7 + Math.round(x0 * 3)) % cols.length]);
        const sm = new THREE.SpriteMaterial({ map: bt, color: c, fog: false });
        const s = new THREE.Sprite(sm);
        s.scale.set(0.045, 0.058, 1);
        s.position.copy(p).add(new THREE.Vector3(0, -0.03, 0.01));
        const hm = new THREE.SpriteMaterial({ map: ht, color: c, transparent: true, opacity: 0.6, depthWrite: false, fog: false });
        const h = new THREE.Sprite(hm);
        h.scale.setScalar(0.16);
        h.position.copy(s.position);
        h.renderOrder = 4;
        this.room.add(s, h);
        this.bulbs.push({ s, h, c, phase: i * 0.9 + x0 });
        this.disposables.push(() => { sm.dispose(); hm.dispose(); });
      }
    };
    string(-1.7, 1.7, WIN.y1 + 0.13, ROOM.back + 0.2, 4, 0.1, 22);
  }

  private makeStand(i: number, d: SpotDef): Stand {
    const group = new THREE.Group();
    group.position.set(d.x, d.y, d.z);
    const base = new THREE.Group(), holder = new THREE.Group();
    group.add(base, holder);
    const pt = poolTexture();
    const pm = new THREE.MeshBasicMaterial({ map: pt, color: P.lamp, transparent: true, opacity: 0, depthWrite: false });
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(d.floor ? 1.5 : 0.6, d.floor ? 1.5 : 0.6), pm);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.012;
    pool.renderOrder = 1;
    group.add(pool);
    const hh = d.floor ? 1.9 : 0.7;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(d.floor ? 1.2 : 0.6, hh, d.floor ? 1.1 : 0.5), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = hh / 2;
    hit.userData.stand = i;
    group.add(hit);
    this.disposables.push(() => { pt.dispose(); pm.dispose(); pool.geometry.dispose(); hit.geometry.dispose(); (hit.material as THREE.Material).dispose(); });
    this.room.add(group);
    if (d.floor) void shopModel('gg_table_round', TABLE_H, { width: 0.72 }).then((t) => { if (!this.dead) base.add(t); }).catch(() => { /* no table */ });
    return { def: d, group, base, holder, top: d.floor ? TABLE_H : 0, model: null, owl: null, pool, hit, focus: 0, bounce: 0, sold: false };
  }

  /** Put today's deals on display (unknown ids show a wrapped parcel). */
  setDeals(deals: DisplayItem[]) {
    const key = deals.map((d) => d.kind + ':' + d.id).join('|');
    if (key === this.dealKey) return;
    this.dealKey = key;
    const token = ++this.dealToken;
    this.stands.forEach((s, i) => {
      this.clearStand(s);
      const d = deals[i];
      if (d) void this.dress(s, d, token);
    });
  }

  private clearStand(s: Stand) {
    for (const c of [...s.holder.children]) { s.holder.remove(c); c.userData.dispose?.(); }
    if (s.owl) { s.owl.model.dispose(); s.owl = null; }
    s.model = null;
  }

  private async dress(s: Stand, d: DisplayItem, token: number) {
    const floor = s.def.floor;
    try {
      if (d.kind === 'piece' || d.kind === 'species' || d.kind === 'skin') {
        // a model owl wearing the piece (or showing the plumage), standing on the display
        const look: OwlLook = d.kind === 'species' ? { skin: 'owl', species: d.id, palette: d.id, outfit: {} }
          : d.kind === 'skin' ? { skin: d.id, species: 'snowy', palette: 'snowy', outfit: {} }
          : { skin: 'owl', species: 'snowy', palette: 'snowy', outfit: PIECE[d.id] ? { [PIECE[d.id].slot]: d.id } : {} };
        const owl = new OwlActor(look, {});
        owl.setMood('happy');
        const g = new THREE.Group();
        g.add(owl.node);
        for (let k = 0; k < 20; k++) owl.update(1 / 30);
        fit(g, floor ? 0.8 : 0.42, floor ? 1.0 : 0.5, floor ? 0.8 : 0.42);
        if (token !== this.dealToken || this.dead) { owl.model.dispose(); return; }
        s.holder.add(g);
        s.owl = owl; s.model = g;
        return;
      }
      let m = d.kind === 'item' ? await itemModel(d.id) : null;
      if (token !== this.dealToken || this.dead) { m?.userData.dispose?.(); return; }
      if (!m) m = boxMesh(parcelBoxes());
      fit(m, floor ? 0.95 : 0.46, floor ? 0.95 : 0.46, floor ? 0.85 : 0.4);
      s.holder.add(m);
      s.model = m;
    } catch (e) { console.warn('display failed', d, e); }
  }

  /** Dim a display whose deal is sold. */
  setSold(i: number, sold: boolean) { const s = this.stands[i]; if (s) s.sold = sold; }

  // ---------------------------------------------------------------- the queen's moments

  /** She waves hello (call when the shop opens). */
  greet() { this.enter = 0; setTimeout(() => { this.queen.play('wave'); this.queen.setMood('joy', 1.6); }, 700); }
  /** She turns and presents a display; it lights up and bounces. */
  present(i: number) {
    const s = this.stands[i];
    if (!s) return;
    this.stands.forEach((x, k) => (x.focus = k === i ? 1 : 0));
    s.bounce = 1;
    const p = this.standTop(s);
    this.queen.lookAt = p.clone().add(new THREE.Vector3(0, 0.3, 0));
    this.lookT = 3.2;
    this.queen.play('present');
    this.fx.burst('sparkle', p.x, p.y + 0.4, p.z, 12);
  }
  clearFocus() { this.stands.forEach((x) => (x.focus = 0)); }
  /** A purchase: a curtsy, the bell dings, sparkles rain on the display. */
  celebrate(i?: number) {
    this.curtsy = 1;
    this.bellT = 1;
    this.queen.setMood('love', 2.2);
    setTimeout(() => this.queen.play('flap'), 650);
    const h = this.queen.headWorld;
    this.fx.burst('hearts', h.x, h.y + 0.1, h.z, 4);
    this.sparkleRain(h.x, h.y + 0.4, h.z, 16);
    if (i !== undefined && this.stands[i]) { const s = this.stands[i], p = this.standTop(s); s.bounce = 1; this.fx.burst('stars', p.x, p.y + 0.5, p.z, 12); this.sparkleRain(p.x, p.y + 1.0, p.z, 14); }
  }
  /** Any reaction by name (for lines that come with a gesture). */
  react(a: OwlAction, mood?: OwlMood) { this.queen.play(a); if (mood) this.queen.setMood(mood, 2); }
  /** Screen point (CSS px) above the queen's head, for her speech bubble. */
  queenScreen(): { x: number; y: number } {
    const p = this.queen.headWorld.clone().add(new THREE.Vector3(0, 0.5, 0)).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  standScreen(i: number): { x: number; y: number } {
    const p = this.standTop(this.stands[i]).add(new THREE.Vector3(0, 0.5, 0)).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  private standTop(s: Stand) { return s.group.position.clone().add(new THREE.Vector3(0, s.top + (s.def.floor ? 0.45 : 0.2), 0)); }

  private sparkleRain(x: number, y: number, z: number, n: number) {
    for (let k = 0; k < n; k++) this.fx.emit({ x: x + (Math.random() - 0.5) * 1.4, y: y + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.4, life: 1 + Math.random() * 0.8, frame: SPR.spark1, frames: 3, fps: 8, color: k % 3 ? P.frost : P.lamp, size: 0.16 + Math.random() * 0.12, add: true, delay: k * 0.03, flutter: 0.3 });
  }
  private owlFx(k: OwlFx, at: THREE.Vector3, n = 4) {
    if (k === 'heart') this.fx.burst('hearts', at.x, at.y, at.z, n);
    else if (k === 'note') this.fx.burst('notes', at.x, at.y, at.z, n);
    else if (k === 'sparkle') this.fx.burst('sparkle', at.x, at.y, at.z, n);
    else if (k === 'feather') for (let i = 0; i < n; i++) this.fx.emit({ x: at.x, y: at.y, z: at.z + 0.2, vx: (Math.random() - 0.5) * 1.2, vy: 0.4 + Math.random() * 0.6, vz: Math.random() * 0.5, life: 1.6, frame: SPR.feather1, frames: 3, fps: 4, color: P.snow, size: 0.24, gravity: 0.6, drag: 1.5, flutter: 0.4 });
  }

  // ---------------------------------------------------------------- framing

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    const side = w >= h * 1.05 && w >= 640;
    this.layout = side ? 'side' : 'top';
    const c = this.camera;
    // a natural lens across the part of the screen the shop shows in (the UI covers the rest), with the
    // camera's axis on the shop's centre: an off-centre window into a wider frustum
    const th = Math.tan(THREE.MathUtils.degToRad((side ? 50 : 54) / 2));
    if (side) {
      const fx = Math.min(0.75, 0.5 + Math.max(0.2, Math.min(0.25, 470 / w)));
      const dx = (fx - 0.5) * w, fullW = w + 2 * dx, free = 2 * (1 - fx) * w;
      c.aspect = fullW / h;
      c.setViewOffset(fullW, h, 0, 0, w, h);
      c.fov = THREE.MathUtils.radToDeg(2 * Math.atan((th * fullW) / free / c.aspect));
      this.focus = { x: fx, y: 0.5 };
      this.place(6.3 / (2 * th), 0.12, 1.68);
    } else {
      // portrait: the boutique fills the top of the screen above the shop sheet
      const fy = 0.235, dy = 0.3 * h, fullH = h + 2 * dy, y0 = h / 2 + dy - fy * h;
      c.aspect = w / fullH;
      c.setViewOffset(w, fullH, 0, Math.max(0, Math.min(2 * dy, y0)), w, h);
      c.fov = THREE.MathUtils.radToDeg(2 * Math.atan(th / c.aspect));
      this.focus = { x: 0.5, y: fy };
      this.place(6.0 / (2 * th), 0.08, 1.62);
    }
    c.updateProjectionMatrix();
  }
  private place(dist: number, pitch: number, ty: number) {
    const t = this.cam.target;
    t.set(0, ty, -0.9);
    this.cam.pos.set(t.x, t.y + Math.sin(pitch) * dist, t.z + Math.cos(pitch) * dist);
    this.camera.far = dist + 30;
    const f = this.room.fog as THREE.Fog;
    f.near = dist + 8; f.far = dist + 30;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number, t: number) {
    this.time += dt;
    this.enter = Math.min(1, this.enter + dt * 0.55);
    const e = 1 - Math.pow(1 - this.enter, 3);
    const drift = Math.sin(t * 0.13) * 0.12;
    this.camera.position.copy(this.cam.pos).add(new THREE.Vector3(drift, (1 - e) * 0.5, (1 - e) * 1.8));
    this.camera.lookAt(this.cam.target.x + drift * 0.4, this.cam.target.y, this.cam.target.z);

    // hanging lights sway, lamplight breathes, the stove flickers
    for (const l of this.swingers) { const ph = l.userData.phase as number; l.rotation.z = Math.sin(t * 0.8 + ph) * 0.02; l.rotation.x = Math.sin(t * 0.6 + ph * 1.3) * 0.015; }
    this.lampLights.forEach((l, i) => (l.intensity = (l.userData.base as number) * (1 + Math.sin(t * 2.1 + i * 2) * 0.05)));
    const fl = 0.75 + Math.sin(t * 9.3) * 0.12 + Math.sin(t * 13.7 + 1) * 0.1 + Math.sin(t * 3.1) * 0.08;
    this.stoveLight.intensity = 2.4 * fl;
    for (const b of this.bulbs) {
      const k = 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.6 + b.phase));
      (b.s.material as THREE.SpriteMaterial).color.copy(b.c).multiplyScalar(0.55 + k * 0.6);
      (b.h.material as THREE.SpriteMaterial).opacity = 0.12 + k * 0.45;
    }
    if (this.bell) { this.bellT = Math.max(0, this.bellT - dt * 1.6); this.bell.rotation.z = Math.sin(this.time * 38) * 0.12 * this.bellT; }

    // the queen: idle elegance, a curtsy on purchases, glances at her displays
    if (this.curtsy > 0) {
      this.curtsy = Math.max(0, this.curtsy - dt * 0.9);
      const p = 1 - this.curtsy, dip = Math.sin(Math.min(1, p * 1.4) * Math.PI);
      this.queen.node.position.y = -dip * 0.14;
      this.queen.node.rotation.x = dip * 0.16;
    } else { this.queen.node.position.y = 0; this.queen.node.rotation.x = 0; }
    this.queen.node.rotation.y = Math.sin(t * 0.35) * 0.08;
    if ((this.lookT -= dt) <= 0 && this.queen.lookAt) { this.queen.lookAt = null; this.clearFocus(); }
    if ((this.idleT -= dt) <= 0) {
      this.idleT = 7 + Math.random() * 8;
      const r = Math.random();
      if (r < 0.35) { const s = this.stands[Math.floor(Math.random() * 3)]; this.queen.lookAt = this.standTop(s); this.lookT = 2.4; }
      else if (r < 0.55) this.queen.play('ruffle');
      else if (r < 0.7) this.queen.play('nod');
      else if (r < 0.8) this.queen.setMood('proud', 2.5);
      else { const h = this.queen.headWorld; this.fx.burst('sparkle', h.x, h.y + 0.3, h.z, 6); }
    }
    this.queen.update(dt);

    // displays: a gentle turn, focus light, bounces
    let lit: Stand | null = null;
    for (const s of this.stands) {
      s.bounce = Math.max(0, s.bounce - dt * 1.6);
      const b = Math.sin((1 - s.bounce) * Math.PI * 3) * s.bounce * 0.14;
      s.holder.position.y = s.top + Math.max(0, b);
      if (s.model) s.model.rotation.y = Math.sin(t * 0.4 + s.def.x * 0.7) * (s.owl ? 0.35 : 0.5) + (s.def.floor ? -Math.sign(s.def.x) * 0.25 : 0.2);
      s.owl?.update(dt);
      (s.model?.userData.animate as ((t: number, dt: number) => void) | undefined)?.(t, dt);
      const pm = s.pool.material as THREE.MeshBasicMaterial;
      const want = s.sold ? 0 : s.focus ? 0.8 : 0.28 + Math.sin(t * 1.8 + s.def.x) * 0.06;
      pm.opacity += (want - pm.opacity) * Math.min(1, dt * 4);
      if (s.focus && !s.sold) lit = s;
    }
    const fwant = lit ? 22 : 0;
    this.focusLight.intensity += (fwant - this.focusLight.intensity) * Math.min(1, dt * 4);
    if (lit) { const p = this.standTop(lit); this.focusLight.position.set(p.x * 0.6, 4.1, p.z + 1.6); this.focusLight.target.position.copy(p); }

    swayPlants(t);
    // snow falling past the window (when it really snows outside), and warm motes drifting in the lamplight
    const snowing = !this.world || (this.world.weather?.vis.snow ?? 0) > 0.12;
    this.snowT -= dt;
    while (snowing && this.snowT <= 0) {
      this.snowT += 0.05;
      this.fx.emit({ x: (Math.random() - 0.5) * 3.2, y: 3.4 + Math.random() * 0.2, z: WIN.glass - 0.15 - Math.random() * 0.6, vx: 0.06 + Math.random() * 0.1, vy: -0.32 - Math.random() * 0.2, life: 8, frame: Math.random() < 0.2 ? SPR.flake : SPR.mote, color: P.snow, size: 0.05 + Math.random() * 0.05, flutter: 0.25, fadeIn: 0.4, fadeOut: 0.8 });
    }
    this.moteT -= dt;
    if (this.moteT <= 0) {
      this.moteT = 0.35;
      this.fx.emit({ x: (Math.random() - 0.5) * 5, y: 1.2 + Math.random() * 2, z: -1.8 + Math.random() * 2.4, vx: (Math.random() - 0.5) * 0.05, vy: 0.02 + Math.random() * 0.04, life: 6, frame: SPR.mote, color: P.lamp, size: 0.03 + Math.random() * 0.02, flutter: 0.15, fadeIn: 1.5, fadeOut: 2 });
    }
    this.fx.update(dt, t);
    this.renderRoom(t);
  }

  // ---------------------------------------------------------------- input

  pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray, e?: PointerEvent): boolean {
    // event timestamps, not the clock: a slow frame between down and up must not cancel the tap
    const at = e?.timeStamp ?? performance.now();
    if (type === 'down') { this.downAt = { x, y, t: at }; return true; }
    if (type !== 'up' || !this.downAt) return true;
    const d = this.downAt;
    this.downAt = null;
    if (Math.hypot(x - d.x, y - d.y) > 12 || at - d.t > 900) return true;
    this.ray.ray.copy(ray);
    const head = this.queen.headWorld;
    if (ray.distanceToPoint(head) < 0.6) { this.queen.poke(); this.onQueen?.(); return true; }
    const hit = this.ray.intersectObjects(this.stands.map((s) => s.hit), false)[0];
    if (hit) { this.onPick?.(hit.object.userData.stand as number); return true; }
    if (ray.distanceToPoint(this.queen.node.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.1, 0))) < 0.7) { this.queen.poke(); this.onQueen?.(); return true; }
    if (this.bell && ray.distanceToPoint(this.bell.getWorldPosition(new THREE.Vector3())) < 0.15) { this.bellT = 1; sound.play('ui_tap', { volume: 0.5, rate: 1.6 }); }
    return true;
  }

  dispose() {
    this.dead = true;
    for (const s of this.stands) this.clearStand(s);
    this.queen.model.dispose();
    for (const f of this.disposables) f();
  }
}

/** A wrapped parcel for a deal whose model has not arrived yet. */
function parcelBoxes(): BoxSpec[] {
  const paper = (t: Texel) => ((Math.floor(t.x) * 7 + Math.floor(t.y) * 3 + Math.floor(t.z) * 5) % 11 === 0 ? 0x96744f : (Math.floor(t.y) % 4 === 0 ? 0xa3825a : 0xab8a62));
  const ribbon = (t: Texel) => (Math.floor(t.x + t.z) % 3 === 0 ? P.berry : 0xb5797b);
  return [
    box(0, 0, 0, 14, 11, 12, paper), box(0, 0, 0, 3, 11.2, 12.2, ribbon), box(0, 0, 0, 14.2, 11.2, 3, ribbon),
    box(-2.4, 11, 0, 4, 3, 2, ribbon), box(2.4, 11, 0, 4, 3, 2, ribbon),
  ];
}
