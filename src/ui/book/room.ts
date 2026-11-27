// The Book's 3D set: the Hollow & Co. office (src/onboard/office.ts) turned into a sleep briefing room. Added to the
// office, built in code with its materials:
//   - a rolling whiteboard (aluminium frame on castered feet, a glossy enamel board with ghosts of old meetings, this
//     week drawn on in marker that writes itself on, a marker tray with three markers and an eraser, sticky notes);
//   - a pull-down projection screen that rolls down from its case under the ceiling, and a cream-and-brass projector
//     on a walnut AV trolley throwing a soft, dusty cone of light onto it; slides change with a carousel's dip to
//     dark, and a laser dot wanders over the chart;
//   - a step stool by the board and a stack of ledgers by the screen for Pip to stand on, and Pip's leather diary on
//     the desk, whose cover swings open for the Diary.
// The camera is the office's (its `rig`): named spots framed inside the part of the screen the 2D panels leave free.
// Pip flies between the board, the screen and his chair. Taps on the board, the screen, the diary, the folder and
// Pip call onTap.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { sound } from '../../audio/sound.ts';
import { Office, PIP_AT, L, DESK_TOP, type WorldView } from '../../onboard/office.ts';
import type { OwlLook } from '../../owl/model.ts';
import { SPR } from '../../world/fx.ts';
import type { Scene } from '../../world/scene.ts';
import { paintBoardBase, paintBoardInk, paintSlide, paintSticky, type Brief, type SlideId } from './boards.ts';

export type Spot = 'room' | 'board' | 'screen' | 'desk' | 'diary';
export type Tap = 'board' | 'screen' | 'diary' | 'folder' | 'pip';
/** the part of the screen the 2D panels leave free (CSS px) */
export interface Free { x0: number; y0: number; x1: number; y1: number }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const sfx = (id: string, volume = 0.4, rate?: number) => { try { sound.play(id, { volume, rate, gap: 40 }); } catch { /* sound not ready */ } };
const ease = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));

// ------------------------------------------------------------------ the plan (metres, the office's frame)

const BOARD = { at: V(-2.1, 0, -2.28), ry: 0.42, w: 1.62, h: 1.08, y: 1.47 };
const SCREEN = { x: 2.16, z: -2.7, w: 1.6, h: 1.0, top: 2.28, caseY: 2.36 };
const CART = { at: V(1.66, 0, -0.32), ry: 0, top: 0.78 };
const STOOL = V(-1.16, 0, -1.93);
const LEDGERS = V(3.13, 0, -2.3);
const DIARY = { at: V(-0.22, DESK_TOP, -0.68), ry: 0.14 };

const boardRight = V(Math.cos(BOARD.ry), 0, -Math.sin(BOARD.ry));
const boardNormal = V(Math.sin(BOARD.ry), 0, Math.cos(BOARD.ry));
const boardCentre = BOARD.at.clone().setY(BOARD.y);
const screenCentre = V(SCREEN.x, SCREEN.top - 0.04 - SCREEN.h / 2, SCREEN.z + 0.012);

interface Shot { target: THREE.Vector3; yaw: number; pitch: number; fit: [number, number] }
function shotOf(spot: Spot, portrait: boolean): Shot {
  switch (spot) {
    case 'room': return { target: V(0.1, 1.36, -1.7), yaw: 0.02, pitch: 0.12, fit: portrait ? [4.2, 2.6] : [5.7, 2.7] };
    case 'board': return { target: boardCentre.clone().addScaledVector(boardRight, 0.2).add(V(0, -0.08, 0)), yaw: BOARD.ry - 0.04, pitch: 0.06, fit: [2.25, 1.5] };
    case 'screen': return { target: screenCentre.clone().add(V(0.22, -0.14, 0)), yaw: -0.24, pitch: 0.07, fit: [2.5, 1.6] };
    case 'desk': return { target: V(0.02, 1.0, -1.3), yaw: 0.0, pitch: 0.3, fit: [2.3, 1.4] };
    case 'diary': return { target: DIARY.at.clone().add(V(0.02, 0.06, 0.02)), yaw: 0.06, pitch: 0.95, fit: [0.66, 0.46] };
  }
}

// ------------------------------------------------------------------ small builders

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c: HTMLCanvasElement, aniso = 8) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  return t;
}
function glowTexture(col: string) {
  const c = canvas(128, 128), g = c.getContext('2d')!, gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, col); gr.addColorStop(0.25, col.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
const cyl = (r: number, len: number, m: THREE.Material, seg = 16) => mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
const rbox = (w: number, h: number, d: number, r: number, m: THREE.Material) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), m);

/** A plane that bends back along its lower edge (a sticky note's curl). */
function curlPlane(w: number, h: number, curl: number) {
  const g = new THREE.PlaneGeometry(w, h, 2, 8), p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const v = (h / 2 - p.getY(i)) / h; p.setZ(i, curl * v * v * v); }
  g.computeVertexNormals();
  return g;
}

/** The beam: a hollow pyramid from the lens to the picture's corners, glowing softly, fading along its length. */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uCol: { value: new THREE.Color(0.92, 0.95, 1.0) }, uAmt: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `attribute float along; attribute float side; varying float vA; varying float vS; varying vec3 vW;
      void main(){ vA = along; vS = side; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `uniform vec3 uCol; uniform float uAmt; uniform float uTime; varying float vA; varying float vS; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        float edge = smoothstep(0.0, 0.22, vS) * smoothstep(1.0, 0.78, vS);
        float along = smoothstep(0.0, 0.04, vA) * (0.35 + 0.65 * pow(1.0 - vA, 1.6)) * smoothstep(1.0, 0.96, vA);
        float dust = 0.65 + 0.55 * n3(vW * 7.0 + vec3(0.0, uTime * 0.05, uTime * 0.03)) * n3(vW * 2.3 - vec3(uTime * 0.02));
        float a = edge * along * dust * uAmt;
        gl_FragColor = vec4(uCol * a, a);
      }`,
  });
}

// ------------------------------------------------------------------ the stage

export class Briefing {
  readonly office: Office;
  readonly ready: Promise<void>;
  onTap: ((what: Tap) => void) | null = null;
  /** called once the opening flourish is done */
  onIntro: (() => void) | null = null;
  private sc: Scene;
  private postWas = true;
  private q: 'low' | 'high';
  private spot: Spot = 'room';
  private free: Free = { x0: 0, y0: 0, x1: innerWidth, y1: innerHeight };
  private cam: { pos: THREE.Vector3; look: THREE.Vector3; ax: number; ay: number } | null = null;
  private lastT = 0;
  private movedAt = 0;
  private disposers: (() => void)[] = [];
  private mats: THREE.Material[] = [];
  private brief: Brief | null = null;
  private slideId: SlideId = 'hours';

  // parts
  private boardGroup = new THREE.Group();
  private ink!: { tex: THREE.CanvasTexture; c: HTMLCanvasElement; reveal: { value: number } };
  private stickies: { tex: THREE.CanvasTexture; c: HTMLCanvasElement; m: THREE.Mesh }[] = [];
  private screenGroup = new THREE.Group();
  private fabric = new THREE.Group();
  private slideMat!: THREE.MeshBasicMaterial;
  private slideCv!: HTMLCanvasElement;
  private slideTex!: THREE.CanvasTexture;
  private poi: [number, number][] = [[0.5, 0.5]];
  private beam!: THREE.Mesh;
  private beamMat = beamMaterial();
  private lensGlow!: THREE.Sprite;
  private lensMat!: THREE.MeshStandardMaterial;
  private lens = new THREE.Vector3();
  private laser!: THREE.Sprite;
  private laserAt = new THREE.Vector2(0.5, 0.5);
  private laserTo = new THREE.Vector2(0.5, 0.5);
  private laserNext = 0;
  private diaryGroup = new THREE.Group();
  private diaryCover = new THREE.Group();
  private boardLight!: THREE.PointLight;
  private screenLight!: THREE.PointLight;

  // animation state
  private roll = 0; private rollWant = 0;
  private power = 0; private powerWant = 0;
  private dip = 0;
  private revealWant = 0;
  private coverK = 0; private coverWant = 0;
  private flight: { from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; ry: number } | null = null;
  private pipSpot: 'board' | 'screen' | 'chair' = 'chair';
  private moteT = 0;
  private down: { x: number; y: number } | null = null;

  constructor(sc: Scene, look: OwlLook) {
    this.sc = sc;
    this.q = sc.quality === 'low' ? 'low' : 'high';
    const world = typeof (sc as unknown as WorldView).renderView === 'function' ? (sc as unknown as WorldView) : null;
    this.office = new Office(look, sc.renderer, this.q, world);
    const o = this.office;
    this.postWas = sc.post.enabled;
    sc.post.enabled = false; // the office draws its own picture
    sc.setStage(o);
    o.pip.pose = 'stand';
    o.pip.setMood('happy');
    this.buildBoard();
    this.buildScreen();
    this.buildCart();
    this.buildPerches();
    this.buildDiary();
    // a little extra light where the talking happens (the office's lamps are by the desk and the clock)
    this.boardLight = new THREE.PointLight(0xffe2b8, 1.4, 3.4, 1.6);
    this.boardLight.position.copy(boardCentre).addScaledVector(boardNormal, 1.1).add(V(0, 0.5, 0));
    this.screenLight = new THREE.PointLight(0xdfe8ff, 0, 2.6, 1.8);
    this.screenLight.position.copy(screenCentre).add(V(-0.2, -0.3, 0.9));
    o.room.add(this.boardLight, this.screenLight);
    o.onPointer = (type, x, y, ray) => this.pointer(type, x, y, ray);
    o.rig = (t) => this.rig(t);
    o.tickers.add((dt, t) => this.tick(dt, t));
    this.ready = o.ready;
  }

  // ---------------------------------------------------------------- building

  private mat<T extends THREE.Material>(m: T): T { this.mats.push(m); return m; }

  private buildBoard() {
    const m = this.office.mats, g = this.boardGroup, { w, h } = BOARD;
    const alu = this.mat(new THREE.MeshStandardMaterial({ color: 0xc2c7cc, metalness: 0.85, roughness: 0.32 }));
    const plastic = this.mat(new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.6 }));
    const big = this.q === 'high';
    const base = canvas(big ? 1536 : 1024, big ? 1024 : 683);
    paintBoardBase(base);
    const baseTex = canvasTex(base);
    const face = mesh(new THREE.PlaneGeometry(w, h), this.mat(new THREE.MeshStandardMaterial({ map: baseTex, roughness: 0.2, metalness: 0.02, envMapIntensity: 0.9 })), false);
    face.position.set(0, BOARD.y, 0.011);
    const back = mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.018), this.mat(new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.4 })));
    back.position.set(0, BOARD.y, 0);
    // the ink, on its own layer, that writes itself on (a diagonal wipe)
    const inkC = canvas(base.width, base.height);
    const inkTex = canvasTex(inkC);
    const reveal = { value: 0 };
    const inkMat = this.mat(new THREE.MeshStandardMaterial({ map: inkTex, transparent: true, roughness: 0.35, depthWrite: false }));
    inkMat.onBeforeCompile = (sh) => {
      sh.uniforms.uReveal = reveal;
      sh.fragmentShader = 'uniform float uReveal;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  if (vMapUv.x * 0.9 + (1.0 - vMapUv.y) * 0.1 > uReveal) discard;');
    };
    inkMat.customProgramCacheKey = () => 'bk-ink';
    const ink = mesh(new THREE.PlaneGeometry(w, h), inkMat, false);
    ink.position.set(0, BOARD.y, 0.013);
    ink.renderOrder = 2;
    this.ink = { tex: inkTex, c: inkC, reveal };
    this.disposers.push(() => { baseTex.dispose(); inkTex.dispose(); });
    g.add(back, face, ink);
    // frame: four aluminium bars with dark corner caps
    const t = 0.034;
    for (const [bw, bh, x, y] of [[w + 2 * t, t, 0, BOARD.y + h / 2 + t / 2], [w + 2 * t, t, 0, BOARD.y - h / 2 - t / 2], [t, h, -w / 2 - t / 2, BOARD.y], [t, h, w / 2 + t / 2, BOARD.y]] as const) {
      const bar = rbox(bw, bh, 0.036, 0.008, alu);
      bar.position.set(x, y, 0.008);
      g.add(bar);
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cap = rbox(0.05, 0.05, 0.042, 0.012, plastic);
      cap.position.set(sx * (w / 2 + t / 2), BOARD.y + sy * (h / 2 + t / 2), 0.009);
      g.add(cap);
    }
    // the stand: posts, pivot knobs, a crossbar, splayed feet on casters
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 + 0.075);
      const post = cyl(0.016, 2.02, alu); post.position.set(x, 1.05, -0.02); g.add(post);
      const knob = mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.03, 20).rotateZ(Math.PI / 2), plastic); knob.position.set(x - sx * 0.03, BOARD.y, -0.02); g.add(knob);
      const foot = rbox(0.04, 0.035, 0.62, 0.012, alu); foot.position.set(x, 0.085, -0.02); g.add(foot);
      for (const sz of [-1, 1]) {
        const fork = rbox(0.03, 0.04, 0.03, 0.006, plastic); fork.position.set(x, 0.052, -0.02 + sz * 0.27); g.add(fork);
        const wheel = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.022, 18).rotateZ(Math.PI / 2), plastic); wheel.position.set(x, 0.03, -0.02 + sz * 0.27 + 0.012); g.add(wheel);
      }
    }
    const cross = cyl(0.013, w + 0.15, alu); cross.rotation.z = Math.PI / 2; cross.position.set(0, 0.34, -0.02); g.add(cross);
    // the marker tray with three markers and a felt eraser
    const trayY = BOARD.y - h / 2 - t - 0.012;
    const tray = rbox(w * 0.7, 0.012, 0.085, 0.004, alu); tray.position.set(0, trayY, 0.045); g.add(tray);
    const lip = rbox(w * 0.7, 0.03, 0.01, 0.004, alu); lip.position.set(0, trayY + 0.012, 0.086); g.add(lip);
    const caps = [0x1f4fa6, 0xc4302b, 0x1d7b45];
    caps.forEach((c, i) => {
      const mk = new THREE.Group();
      const body = cyl(0.0105, 0.12, this.mat(new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.35 })), 14); body.rotation.z = Math.PI / 2;
      const cap = cyl(0.012, 0.042, this.mat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.3 })), 14); cap.rotation.z = Math.PI / 2; cap.position.x = 0.074;
      const band = cyl(0.0108, 0.02, this.mat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.4 })), 14); band.rotation.z = Math.PI / 2; band.position.x = -0.045;
      mk.add(body, cap, band);
      mk.position.set(-0.32 + i * 0.16, trayY + 0.017, 0.05 + (i % 2) * 0.01);
      mk.rotation.y = (i - 1) * 0.12;
      g.add(mk);
    });
    const eraser = rbox(0.13, 0.034, 0.052, 0.008, this.mat(new THREE.MeshStandardMaterial({ color: 0x3b5f9e, roughness: 0.5 })));
    eraser.position.set(0.3, trayY + 0.024, 0.048); eraser.rotation.y = -0.08;
    const felt = mesh(new THREE.BoxGeometry(0.128, 0.008, 0.05), m.felt); felt.position.set(0.3, trayY + 0.006, 0.048); felt.rotation.y = -0.08;
    g.add(eraser, felt);
    // sticky notes in the top corner
    const notes: { at: [number, number]; rot: number; tint: 'yellow' | 'pink' | 'mint' }[] = [
      { at: [w / 2 - 0.13, BOARD.y + h / 2 - 0.14], rot: 0.07, tint: 'yellow' },
      { at: [w / 2 - 0.3, BOARD.y + h / 2 - 0.2], rot: -0.05, tint: 'pink' },
    ];
    for (const n of notes) {
      const c = canvas(256, 256), tex = canvasTex(c, 4);
      const sm = mesh(curlPlane(0.15, 0.15, 0.018), this.mat(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide })), false);
      sm.position.set(n.at[0], n.at[1], 0.016); sm.rotation.z = n.rot;
      g.add(sm);
      this.stickies.push({ tex, c, m: sm });
      this.disposers.push(() => tex.dispose());
    }
    g.position.copy(BOARD.at);
    g.rotation.y = BOARD.ry;
    g.name = 'bk-board';
    this.office.room.add(g);
  }

  private buildScreen() {
    const g = this.screenGroup, white = this.mat(new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.4, metalness: 0.2 }));
    const dark = this.mat(new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.5, metalness: 0.3 }));
    const W = SCREEN.w + 0.14;
    const caseM = cyl(0.05, W + 0.08, white, 24); caseM.rotation.z = Math.PI / 2; caseM.position.set(0, SCREEN.caseY, 0);
    for (const sx of [-1, 1]) {
      const end = cyl(0.056, 0.03, dark, 24); end.rotation.z = Math.PI / 2; end.position.set(sx * (W / 2 + 0.05), SCREEN.caseY, 0); g.add(end);
      const rod = cyl(0.008, L.H - SCREEN.caseY, dark, 8); rod.position.set(sx * (W / 2 - 0.12), (L.H + SCREEN.caseY) / 2, 0); g.add(rod);
    }
    g.add(caseM);
    // the fabric rolls down from the case: everything in `fabric` hangs from its top edge
    const H = SCREEN.h + 0.16;
    const border = mesh(new THREE.PlaneGeometry(W, H).translate(0, -H / 2, 0), this.mat(new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9 })), false);
    const white2 = mesh(new THREE.PlaneGeometry(SCREEN.w + 0.04, SCREEN.h + 0.04).translate(0, -(SCREEN.h + 0.04) / 2 - 0.05, 0.001), this.mat(new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.95 })), false);
    const big = this.q === 'high';
    this.slideCv = canvas(big ? 1600 : 1024, big ? 1000 : 640);
    this.slideTex = canvasTex(this.slideCv);
    this.slideMat = this.mat(new THREE.MeshBasicMaterial({ map: this.slideTex, toneMapped: false, transparent: true, opacity: 0 }));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN.w, SCREEN.h).translate(0, -SCREEN.h / 2 - 0.07, 0.002), this.slideMat);
    pic.renderOrder = 3;
    const bar = rbox(W + 0.02, 0.03, 0.03, 0.01, dark); bar.position.set(0, -H, 0.004);
    const ring = mesh(new THREE.TorusGeometry(0.022, 0.005, 8, 20), dark); ring.position.set(0, -H - 0.04, 0.006);
    this.fabric.add(border, white2, pic, bar, ring);
    this.fabric.position.set(0, SCREEN.top + 0.03, 0.01);
    this.fabric.scale.y = 0.001;
    g.add(this.fabric);
    g.position.set(SCREEN.x, 0, SCREEN.z);
    g.name = 'bk-screen';
    this.office.room.add(g);
    this.disposers.push(() => this.slideTex.dispose());
    // the laser pointer's dot
    const lt = glowTexture('rgba(255,60,50,1)');
    this.laser = new THREE.Sprite(this.mat(new THREE.SpriteMaterial({ map: lt, color: 0xff8a80, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })));
    this.laser.scale.setScalar(0.05);
    this.laser.renderOrder = 6;
    this.office.room.add(this.laser);
    this.disposers.push(() => lt.dispose());
  }

  private buildCart() {
    const m = this.office.mats, cart = new THREE.Group();
    const top = rbox(0.6, 0.035, 0.46, 0.01, m.walnut); top.position.y = CART.top;
    const low = rbox(0.6, 0.03, 0.46, 0.01, m.walnut); low.position.y = 0.22;
    cart.add(top, low);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = cyl(0.014, CART.top - 0.05, m.brass, 12); leg.position.set(sx * 0.27, (CART.top + 0.05) / 2, sz * 0.2); cart.add(leg);
      const wheel = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16).rotateZ(Math.PI / 2), m.rubber); wheel.position.set(sx * 0.27, 0.03, sz * 0.2); cart.add(wheel);
    }
    // a coil of cable and a slide carousel box on the lower shelf
    const coil = mesh(new THREE.TorusGeometry(0.075, 0.009, 8, 40).rotateX(Math.PI / 2), m.rubber); coil.position.set(-0.12, 0.245, 0.05); cart.add(coil);
    const tray = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 36), this.mat(new THREE.MeshStandardMaterial({ color: 0x2f3a52, roughness: 0.45 }))); tray.position.set(0.13, 0.27, -0.02); cart.add(tray);
    // the projector: cream enamel, walnut cheeks, a brass-ringed lens
    const pj = new THREE.Group();
    const cream = this.mat(new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.35, metalness: 0.05 }));
    const body = rbox(0.3, 0.12, 0.26, 0.03, cream); body.position.y = 0.06;
    pj.add(body);
    for (const sx of [-1, 1]) { const cheek = rbox(0.016, 0.1, 0.22, 0.006, m.walnut); cheek.position.set(sx * 0.152, 0.06, 0); pj.add(cheek); }
    for (let i = 0; i < 7; i++) { const slot = mesh(new THREE.BoxGeometry(0.17, 0.004, 0.008), m.blackLacquer, false); slot.position.set(0, 0.1205, -0.07 + i * 0.022); pj.add(slot); }
    const barrel = cyl(0.044, 0.09, m.blackLacquer, 28); barrel.rotation.x = Math.PI / 2; barrel.position.set(0.05, 0.062, 0.165); pj.add(barrel);
    const ring = cyl(0.049, 0.022, m.brass, 28); ring.rotation.x = Math.PI / 2; ring.position.set(0.05, 0.062, 0.15); pj.add(ring);
    this.lensMat = this.mat(new THREE.MeshStandardMaterial({ color: 0x223040, emissive: 0xfff4e0, emissiveIntensity: 0, roughness: 0.05, metalness: 0.3 }));
    const glass = mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 28).rotateX(Math.PI / 2), this.lensMat, false); glass.position.set(0.05, 0.062, 0.211); pj.add(glass);
    const knob = cyl(0.016, 0.02, m.brass, 16); knob.rotation.z = Math.PI / 2; knob.position.set(-0.165, 0.07, 0.06); pj.add(knob);
    const led = mesh(new THREE.SphereGeometry(0.006, 10, 8), this.mat(new THREE.MeshStandardMaterial({ color: 0x40ff80, emissive: 0x30ff70, emissiveIntensity: 1.6 })), false); led.position.set(-0.1, 0.09, 0.131); pj.add(led);
    for (const [x, z] of [[-0.12, -0.1], [0.12, -0.1], [-0.12, 0.1], [0.12, 0.1]] as const) { const foot = cyl(0.014, 0.012, m.rubber, 10); foot.position.set(x, -0.006, z); pj.add(foot); }
    pj.position.set(-0.04, CART.top + 0.024, 0);
    // aim at the screen (yaw), the front tipped up a little on its feet
    const lensLocal = V(0.05, 0.062, 0.215);
    const at = CART.at.clone().add(pj.position);
    pj.rotation.order = 'YXZ';
    pj.rotation.y = Math.atan2(screenCentre.x - at.x, screenCentre.z - at.z);
    pj.rotation.x = -0.06;
    cart.add(pj);
    cart.position.copy(CART.at); cart.rotation.y = CART.ry;
    cart.name = 'bk-cart';
    this.office.room.add(cart);
    cart.updateMatrixWorld(true);
    this.lens.copy(pj.localToWorld(lensLocal.clone()));
    // the cable from the projector down to the coil
    const cable = new THREE.CatmullRomCurve3([pj.localToWorld(V(-0.05, 0.04, -0.13)), cart.localToWorld(V(-0.05, CART.top - 0.05, -0.24)), cart.localToWorld(V(-0.1, 0.4, -0.2)), cart.localToWorld(V(-0.12, 0.25, -0.02))].map((p) => cart.worldToLocal(p.clone())));
    cart.add(mesh(new THREE.TubeGeometry(cable, 30, 0.006, 6), m.rubber));
    // the beam, the lens's glow
    const c = [V(-SCREEN.w / 2, SCREEN.h / 2, 0), V(SCREEN.w / 2, SCREEN.h / 2, 0), V(SCREEN.w / 2, -SCREEN.h / 2, 0), V(-SCREEN.w / 2, -SCREEN.h / 2, 0)].map((p) => p.add(screenCentre));
    const pos: number[] = [], along: number[] = [], side: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = c[i], b = c[(i + 1) % 4];
      pos.push(this.lens.x, this.lens.y, this.lens.z, a.x, a.y, a.z, b.x, b.y, b.z);
      along.push(0, 1, 1); side.push(0.5, 0, 1);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    bg.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
    this.beam = new THREE.Mesh(bg, this.beamMat);
    this.beam.frustumCulled = false; this.beam.renderOrder = 7;
    this.office.room.add(this.beam);
    this.mats.push(this.beamMat);
    const gt = glowTexture('rgba(255,246,228,1)');
    this.lensGlow = new THREE.Sprite(this.mat(new THREE.SpriteMaterial({ map: gt, color: 0xfff2dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })));
    this.lensGlow.position.copy(this.lens);
    this.lensGlow.scale.setScalar(0.2);
    this.office.room.add(this.lensGlow);
    this.disposers.push(() => gt.dispose());
  }

  private buildPerches() {
    const m = this.office.mats;
    // a little oak step stool by the board
    const st = new THREE.Group();
    const seat = rbox(0.38, 0.035, 0.27, 0.012, m.oak); seat.position.y = 0.33; st.add(seat);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const leg = rbox(0.035, 0.32, 0.035, 0.008, m.oak);
      leg.position.set(sx * 0.15, 0.16, sz * 0.1); leg.rotation.z = -sx * 0.08; leg.rotation.x = sz * 0.06;
      st.add(leg);
    }
    const rung = rbox(0.3, 0.025, 0.025, 0.006, m.oak); rung.position.set(0, 0.12, 0.1); st.add(rung);
    st.position.copy(STOOL); st.rotation.y = 0.3;
    this.office.room.add(st);
    // three fat ledgers by the screen
    const cols = [0x6e1c22, 0x1f4a35, 0x2b3f6e];
    let y = 0;
    cols.forEach((c, i) => {
      const hgt = 0.11 + i * 0.01, w = 0.44 - i * 0.04, d = 0.32 - i * 0.02;
      const bk = new THREE.Group();
      const cover = rbox(w, hgt, d, 0.008, this.mat(new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 })));
      const pages = mesh(new THREE.BoxGeometry(w - 0.02, hgt - 0.016, d - 0.012), m.paperStack); pages.position.set(0.012, 0, 0);
      const band = mesh(new THREE.BoxGeometry(0.012, hgt + 0.002, d * 0.6), m.gilt); band.position.set(-w / 2 + 0.03, 0, 0);
      bk.add(cover, pages, band);
      bk.position.set(LEDGERS.x, y + hgt / 2, LEDGERS.z); bk.rotation.y = 0.2 + (i - 1) * 0.18;
      y += hgt;
      this.office.room.add(bk);
    });
    LEDGERS.y = y;
    STOOL.y = 0.3475;
  }

  private buildDiary() {
    const m = this.office.mats, g = this.diaryGroup;
    const leather = this.mat(new THREE.MeshStandardMaterial({ color: 0x5a2418, roughness: 0.55 }));
    const W = 0.2, D = 0.27;
    const back = rbox(W, 0.008, D, 0.003, leather); back.position.set(0, 0.004, 0);
    const pages = mesh(new THREE.BoxGeometry(W - 0.012, 0.022, D - 0.012), m.paperStack); pages.position.set(0.003, 0.019, 0);
    // the right-hand page when open: ruled lines and a few written ones
    const pc = canvas(256, 340), pg = pc.getContext('2d')!;
    pg.fillStyle = '#f6eedb'; pg.fillRect(0, 0, 256, 340);
    pg.strokeStyle = 'rgba(70,110,170,0.35)'; pg.lineWidth = 2;
    for (let yy = 50; yy < 330; yy += 22) { pg.beginPath(); pg.moveTo(18, yy); pg.lineTo(238, yy); pg.stroke(); }
    pg.strokeStyle = 'rgba(60,40,90,0.75)'; pg.lineWidth = 2.4; pg.lineCap = 'round';
    for (let k = 0; k < 6; k++) { pg.beginPath(); const yy = 46 + k * 22, len = 120 + ((k * 53) % 90); for (let x = 24; x < 24 + len; x += 6) pg.lineTo(x, yy - 4 + Math.sin(x * 0.4 + k) * 3); pg.stroke(); }
    const ptex = canvasTex(pc, 4);
    this.disposers.push(() => ptex.dispose());
    const page = mesh(new THREE.PlaneGeometry(W - 0.016, D - 0.016).rotateX(-Math.PI / 2), this.mat(new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.9 })), false);
    page.position.set(0.003, 0.0302, 0);
    // the cover swings on the spine (left edge)
    const cover = rbox(W, 0.008, D, 0.003, leather); cover.position.set(W / 2, 0, 0);
    const lining = mesh(new THREE.PlaneGeometry(W - 0.02, D - 0.02).rotateX(Math.PI / 2), this.mat(new THREE.MeshStandardMaterial({ color: 0x8a2c22, roughness: 0.7 })), false); lining.position.set(W / 2, -0.0045, 0);
    const clasp = rbox(0.03, 0.012, 0.04, 0.003, m.brass); clasp.position.set(W - 0.008, 0.002, 0);
    const title = rbox(0.09, 0.001, 0.05, 0.0005, m.gilt); title.position.set(W / 2, 0.0045, -0.05);
    this.diaryCover.add(cover, lining, clasp, title);
    this.diaryCover.position.set(-W / 2, 0.034, 0);
    const ribbon = mesh(new THREE.PlaneGeometry(0.012, 0.09).rotateX(-Math.PI / 2), this.mat(new THREE.MeshStandardMaterial({ color: 0xa8242a, roughness: 0.6, side: THREE.DoubleSide })), false);
    ribbon.position.set(0.04, 0.002, D / 2 + 0.035); ribbon.rotation.y = 0.2;
    g.add(back, pages, page, this.diaryCover, ribbon);
    g.position.copy(DIARY.at); g.rotation.y = DIARY.ry;
    g.name = 'bk-diary';
    this.office.room.add(g);
  }

  // ---------------------------------------------------------------- data

  /** Paint the board, the sticky notes and the current slide from the numbers. */
  setBrief(b: Brief) {
    this.brief = b;
    paintBoardInk(this.ink.c, b);
    this.ink.tex.needsUpdate = true;
    const goalH = Math.floor(b.goalMin / 60), goalM = b.goalMin % 60;
    const notes: string[][] = [
      [`Goal ${goalH}h${goalM ? ` ${goalM}m` : ''}`, 'every night'],
      b.sample ? ['Sleep with Pip', 'to fill this in'] : b.wk && b.wk.latency <= 15 ? ['Quick to sleep', `${Math.round(b.wk.latency)} min`] : ['Same bedtime', 'every day'],
    ];
    this.stickies.forEach((s, i) => { paintSticky(s.c, notes[i], i ? 'pink' : 'yellow'); s.tex.needsUpdate = true; });
    this.poi = paintSlide(this.slideCv, this.slideId, b);
    this.slideTex.needsUpdate = true;
  }

  /** Change the projected slide: the carousel clacks, the picture dips to dark and the next one comes up. */
  slide(id: SlideId) {
    if (id === this.slideId || !this.brief) { this.slideId = id; return; }
    this.slideId = id;
    sfx('tick_brass', 0.4, 0.7);
    setTimeout(() => sfx('drawer_close', 0.18, 1.6), 90);
    this.dip = 1;
    const b = this.brief;
    setTimeout(() => {
      this.poi = paintSlide(this.slideCv, id, b);
      this.slideTex.needsUpdate = true;
      this.laserNext = 0;
    }, 170);
  }

  /** The part of the screen left for the room (CSS px). */
  setFree(f: Free) { this.free = f; }

  // ---------------------------------------------------------------- choreography

  /** The opening: the room at a glance, the screen rolls down, the projector lamp flickers on, the board writes itself. */
  intro(then: Spot) {
    this.spot = 'room';
    this.cam = null;
    setTimeout(() => { this.rollWant = 1; sfx('whoosh_cloth', 0.35, 0.9); sfx('drawer', 0.2, 0.7); }, 350);
    setTimeout(() => { this.powerWant = 1; sfx('ui_toggle', 0.4, 0.8); }, 1150);
    setTimeout(() => { this.revealWant = 1; sfx('scribble', 0.32, 0.95); }, 900);
    setTimeout(() => { this.go(then); this.onIntro?.(); }, 1700);
  }

  get at() { return this.spot; }

  /** Move to a spot: the camera glides there, Pip flies to his place for it, the diary opens or shuts. */
  go(spot: Spot) {
    if (spot === this.spot && this.cam) return;
    const was = this.spot;
    this.spot = spot;
    this.movedAt = this.office.time;
    const want: 'board' | 'screen' | 'chair' = spot === 'board' || spot === 'room' ? 'board' : spot === 'screen' ? 'screen' : 'chair';
    if (want !== this.pipSpot) this.flyPip(want);
    else this.gesture();
    this.coverWant = spot === 'diary' ? 1 : 0;
    if (spot === 'diary' || was === 'diary') setTimeout(() => sfx(spot === 'diary' ? 'book_open' : 'book_close', 0.4), 250);
    this.office.lampOn(spot !== 'screen');
  }

  private perch(p: 'board' | 'screen' | 'chair') {
    if (p === 'board') return { at: STOOL.clone(), ry: -0.25 };
    if (p === 'screen') return { at: LEDGERS.clone(), ry: -0.45 };
    return { at: PIP_AT.clone(), ry: 0 };
  }
  private flyPip(to: 'board' | 'screen' | 'chair') {
    const pip = this.office.pip, dest = this.perch(to);
    this.pipSpot = to;
    const from = pip.node.position.clone();
    const dist = from.distanceTo(dest.at);
    this.flight = { from, to: dest.at, t0: this.office.time, dur: Math.min(1.6, 0.7 + dist * 0.22), ry: dest.ry };
    pip.pose = 'fly';
    pip.setMood('excited', 1.2);
    sfx('wings_flutter', 0.35);
  }
  private gesture() {
    const pip = this.office.pip;
    if (this.spot === 'board' || this.spot === 'screen') { pip.play('present'); pip.setMood('proud', 2.4); sfx('owl_hoot', 0.12, 1.3); }
    else if (this.spot === 'diary') { pip.play('nod'); pip.setMood('happy', 2); }
    else if (this.spot === 'desk') { pip.play('nod'); pip.setMood('curious', 1.6); }
    else pip.setMood('happy');
    const look = this.spot === 'board' ? boardCentre : this.spot === 'screen' ? screenCentre : this.spot === 'diary' ? DIARY.at : null;
    pip.lookAt = look ? look.clone() : null;
    if (look) setTimeout(() => { if (this.office.pip.lookAt) this.office.pip.lookAt = null; }, 1800);
  }
  /** a happy little reaction (a tap on Pip) */
  poke() { this.office.pip.poke(); }

  // ---------------------------------------------------------------- frame

  private tick(dt: number, t: number) {
    const o = this.office, pip = o.pip;
    // Pip's flight: an arc with a soft take-off and landing, turning to face where he's going
    const f = this.flight;
    if (f) {
      const k = Math.min(1, (t - f.t0) / f.dur), e = ease(k);
      const p = f.from.clone().lerp(f.to, e);
      p.y += Math.sin(k * Math.PI) * (0.35 + f.from.distanceTo(f.to) * 0.08);
      pip.node.position.copy(p);
      const dir = Math.atan2(f.to.x - f.from.x, f.to.z - f.from.z);
      const want = k < 0.82 ? dir : f.ry;
      let d = want - pip.node.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      pip.node.rotation.y += d * Math.min(1, dt * 7);
      if (k >= 1) { this.flight = null; pip.pose = 'stand'; pip.node.rotation.y = f.ry; sfx('pet_land', 0.25); o.burst('dust', f.to.clone().add(V(0, 0.02, 0)), 4, 0.6); this.gesture(); }
    }
    // the screen rolls down, the lamp warms up (with a flicker), the board writes itself on
    this.roll += (this.rollWant - this.roll) * Math.min(1, dt * 2.6);
    this.fabric.scale.y = Math.max(0.001, ease(this.roll));
    const flick = this.power < 0.98 && this.powerWant > 0 ? (Math.sin(t * 61) > 0.2 ? 1 : 0.35) : 1;
    this.power += (this.powerWant - this.power) * Math.min(1, dt * 2.2);
    this.dip = Math.max(0, this.dip - dt * 3.2);
    const dipK = 1 - Math.sin(Math.min(1, this.dip) * Math.PI) * 0.92;
    const light = this.power * flick * dipK * (this.roll > 0.95 ? 1 : 0);
    this.slideMat.opacity = light;
    this.slideMat.color.setScalar(1.08);
    this.beamMat.uniforms.uAmt.value = (this.spot === 'screen' ? 0.2 : 0.15) * this.power * flick * (0.4 + 0.6 * dipK) * (this.q === 'high' ? 1 : 0.85);
    this.beamMat.uniforms.uTime.value = t;
    this.lensMat.emissiveIntensity = 2.4 * this.power * flick;
    (this.lensGlow.material as THREE.SpriteMaterial).opacity = 0.75 * this.power * flick;
    this.screenLight.intensity = 0.9 * light;
    this.ink.reveal.value += ((this.revealWant ? 1.02 : 0) - this.ink.reveal.value) * Math.min(1, dt * (this.revealWant ? 1.1 : 6));
    this.coverK += (this.coverWant - this.coverK) * Math.min(1, dt * 4);
    this.diaryCover.rotation.z = Math.PI * 0.97 * ease(this.coverK);
    // dust in the beam
    if (this.power > 0.5 && (this.moteT -= dt) <= 0) {
      this.moteT = this.q === 'high' ? 0.09 : 0.22;
      const k = 0.15 + Math.random() * 0.75, corner = V((Math.random() - 0.5) * SCREEN.w * 0.9, (Math.random() - 0.5) * SCREEN.h * 0.9, 0).add(screenCentre);
      const p = this.lens.clone().lerp(corner, k);
      o.fx.emit({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 0.02, vy: (Math.random() - 0.3) * 0.015, vz: (Math.random() - 0.5) * 0.02, life: 4 + Math.random() * 3, frame: SPR.mote, color: 0xe8f0ff, size: 0.012 + Math.random() * 0.012, add: true, fadeIn: 1, fadeOut: 1.6, flutter: 0.02 });
    }
    // the laser dot: wanders between the interesting bits of the slide, with a tiny tremble
    const lm = this.laser.material as THREE.SpriteMaterial;
    const showLaser = this.spot === 'screen' && !this.flight && light > 0.8 && t - this.movedAt > 1.2;
    lm.opacity += ((showLaser ? 1 : 0) - lm.opacity) * Math.min(1, dt * 6);
    if (showLaser && t >= this.laserNext) {
      const p = this.poi[Math.floor(Math.random() * this.poi.length)];
      this.laserTo.set(p[0], p[1]);
      this.laserNext = t + 2 + Math.random() * 1.6;
    }
    this.laserAt.lerp(this.laserTo, Math.min(1, dt * 5));
    this.laser.position.set(screenCentre.x + (this.laserAt.x - 0.5) * SCREEN.w + Math.sin(t * 23) * 0.002, screenCentre.y - (this.laserAt.y - 0.5) * SCREEN.h + Math.sin(t * 19 + 1) * 0.002, screenCentre.z + 0.01);
    this.laser.scale.setScalar(0.045 + Math.sin(t * 9) * 0.004);
  }

  /** The office's camera rig: glide to the spot's framing inside the free part of the screen. */
  private rig(t: number) {
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    const cam = this.office.camera, Wd = innerWidth, Ht = innerHeight;
    const portrait = Wd < Ht;
    const s = shotOf(this.spot, portrait);
    const fr = this.free;
    const fw = Math.max(0.2, (fr.x1 - fr.x0) / Wd), fh = Math.max(0.2, (fr.y1 - fr.y0) / Ht);
    const v = (cam.fov * Math.PI) / 360, hz = Math.atan(Math.tan(v) * cam.aspect);
    const dist = Math.max(s.fit[1] / 2 / Math.tan(v) / fh, s.fit[0] / 2 / Math.tan(hz) / fw);
    const cp = Math.cos(s.pitch);
    // a slow push-in after each move and a soft handheld drift
    const since = t - this.movedAt, push = 1 - 0.035 * Math.min(1, since / 9) ** 2;
    const yaw = s.yaw + Math.sin(t * 0.37) * 0.008 + Math.sin(t * 1.13 + 1) * 0.0025;
    const pitch = s.pitch + Math.sin(t * 0.51 + 2) * 0.005;
    const d = dist * push;
    const pos = V(s.target.x + Math.sin(yaw) * Math.cos(pitch) * d, s.target.y + Math.sin(pitch) * d, s.target.z + Math.cos(yaw) * Math.cos(pitch) * d);
    void cp;
    pos.set(THREE.MathUtils.clamp(pos.x, L.x0 + 0.2, L.x1 - 0.2), THREE.MathUtils.clamp(pos.y, 0.3, L.H - 0.15), THREE.MathUtils.clamp(pos.z, L.z0 + 0.3, L.z1 - 0.15));
    const ax = ((fr.x0 + fr.x1) / 2 / Wd) * 2 - 1, ay = -(((fr.y0 + fr.y1) / 2 / Ht) * 2 - 1);
    if (!this.cam) this.cam = { pos: pos.clone(), look: s.target.clone(), ax, ay };
    const c = this.cam, k = 1 - Math.exp(-dt * 2.3);
    c.pos.lerp(pos, k); c.look.lerp(s.target, k); c.ax += (ax - c.ax) * k; c.ay += (ay - c.ay) * k;
    return { pos: c.pos.clone(), look: c.look.clone(), ax: c.ax, ay: c.ay };
  }

  // ---------------------------------------------------------------- taps

  private pointer(type: 'down' | 'move' | 'up', x: number, y: number, ray: THREE.Ray) {
    if (type === 'down') { this.down = { x, y }; return false; }
    if (type !== 'up' || !this.down) return false;
    const moved = Math.hypot(x - this.down.x, y - this.down.y);
    this.down = null;
    if (moved > 10) return false;
    const rc = new THREE.Raycaster(ray.origin, ray.direction, 0.05, 20);
    const targets: [Tap, THREE.Object3D | undefined][] = [['pip', this.office.pip.node], ['diary', this.diaryGroup], ['board', this.boardGroup], ['screen', this.screenGroup], ['folder', this.office.folder?.group]];
    let best: { what: Tap; d: number } | null = null;
    for (const [what, obj] of targets) {
      if (!obj) continue;
      const hit = rc.intersectObject(obj, true)[0];
      if (hit && (!best || hit.distance < best.d)) best = { what, d: hit.distance };
    }
    if (!best) return false;
    this.onTap?.(best.what);
    return true;
  }

  dispose() {
    const o = this.office;
    o.rig = null;
    o.onPointer = null;
    for (const d of this.disposers) d();
    for (const m of this.mats) m.dispose();
    if (this.sc.stage === o) this.sc.setStage(null);
    this.sc.post.enabled = this.postWas;
  }
}
