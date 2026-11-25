// [icons6] The three main buttons, live in 3D: a glass moon lamp on a turned brass base (Sleep), a twin-bell brass
// alarm clock showing the real time (Clock) and a tooled leather journal (Book), standing on a carved walnut shelf
// with brass name plates (models: props3d.ts). One small WebGL canvas behind the buttons draws the lot under warm
// studio light (a soft key from the top left with gentle shadows on the shelf, sky fill, a cool rim, studio
// reflections in the brass and glass; at night the moon lamp lights its neighbours), then pixel-finishes it to match
// the game: rendered at twice the art resolution, each art pixel takes the most representative of its samples (crisp
// colour clusters, no blur), a coloured outline, a little more colour, and the lamp's glow as a stepped pixel halo.
// Everything moves like an object: a press squashes it into the shelf, a release hops it up to land with a squash;
// hovering lifts it (and the journal's cover peeks open); the lamp clicks off and on as its chain is pulled, the clock
// rings with its hammer flying between the bells, the journal unbuckles its strap and swings its cover open; when the
// shelf comes back the objects drop onto it one by one. Idle: the moon breathes and bobs, the stars drift, the second
// hand ticks. It draws at 12 fps idle and 30 fps while something moves, and stops when the shelf is away or the page
// is hidden. The first paint never waits for it: the painted 2D objects show until the first 3D frame is in, and stay
// if WebGL is unavailable.
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'preact/hooks';
import { save } from '../../game/store.ts';
import { sceneRef } from '../state.ts';
import { acornProp, alarmClock, studioEnv, contactBlob, journal, moonLamp, oakLeafProp, setClockHands, shelf, type BookParts, type ClockParts, type LampParts } from './props3d.ts';
import { reducedMotion } from './swing.ts';

export type NavId = 'sleep' | 'clock' | 'book';

/** the canvas box in nav CSS px (the nav is 352 x 132; the canvas reaches 46 px above it for hops and the glow) */
const BOX = { w: 352, h: 178, top: -46 };
/** where the DOM puts things (nav CSS px): object centres, the name plates */
const CX: Record<NavId, number> = { sleep: 60, clock: 176, book: 292 };
const PLATE = { y: 108, h: 18, w: 88 };

interface Phys { y: number; vy: number; ground: number; sq: number; vsq: number; tilt: number; vtilt: number; press: boolean; hover: boolean; act: number; drop: number }
const mkPhys = (): Phys => ({ y: 0, vy: 0, ground: 0, sq: 0, vsq: 0, tilt: 0, vtilt: 0, press: false, hover: false, act: -1, drop: -1 });

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) ** 3);
const back = (t: number) => { if (t <= 0) return 0; if (t >= 1) return 1; const c = 1.7; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const POST_FRAG = `
uniform sampler2D tex; uniform vec2 rt; uniform vec2 art; uniform float sat;
uniform vec2 glowPos; uniform float glowR; uniform vec3 glowCol; uniform float glowAmt;
varying vec2 vUv;
vec4 tap(vec2 p){ return texture2D(tex, p / rt); }
float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
vec3 grade(vec3 c){
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = max(vec3(0.0), mix(vec3(l), c, sat));
  // a pixel artist's ramp: lights lean gold, shadows lean violet-blue
  c += (l - 0.45) * vec3(0.05, 0.015, -0.05);
  return c;
}
void main(){
  vec2 ap = floor(vUv * art);
  vec2 c = (ap + 0.5) * 2.0;
  vec4 s0 = tap(c + vec2(-0.5, -0.5)), s1 = tap(c + vec2(0.5, -0.5)), s2 = tap(c + vec2(-0.5, 0.5)), s3 = tap(c + vec2(0.5, 0.5));
  float n = step(0.5, s0.a) + step(0.5, s1.a) + step(0.5, s2.a) + step(0.5, s3.a);
  vec4 outc = vec4(0.0);
  if (n >= 2.0) {
    // the most representative sample: the one nearest the mean of the opaque ones (crisp, never a blend)
    vec3 m = (s0.rgb * step(0.5, s0.a) + s1.rgb * step(0.5, s1.a) + s2.rgb * step(0.5, s2.a) + s3.rgb * step(0.5, s3.a)) / n;
    vec3 best = s0.rgb; float bd = s0.a > 0.5 ? dot(s0.rgb - m, s0.rgb - m) : 1e9;
    float d1 = s1.a > 0.5 ? dot(s1.rgb - m, s1.rgb - m) : 1e9; if (d1 < bd) { bd = d1; best = s1.rgb; }
    float d2 = s2.a > 0.5 ? dot(s2.rgb - m, s2.rgb - m) : 1e9; if (d2 < bd) { bd = d2; best = s2.rgb; }
    float d3 = s3.a > 0.5 ? dot(s3.rgb - m, s3.rgb - m) : 1e9; if (d3 < bd) { bd = d3; best = s3.rgb; }
    outc = vec4(best, 1.0);
  } else {
    // a coloured outline round the silhouette: the darkest neighbour, deepened towards plum
    vec4 nb[4];
    nb[0] = tap(c + vec2(2.0, 0.0)); nb[1] = tap(c - vec2(2.0, 0.0)); nb[2] = tap(c + vec2(0.0, 2.0)); nb[3] = tap(c - vec2(0.0, 2.0));
    vec3 o = vec3(0.0); float found = 0.0, ol = 1e9;
    for (int k = 0; k < 4; k++) if (nb[k].a >= 0.5) { vec3 cc = nb[k].rgb / nb[k].a; float l = dot(cc, vec3(1.0)); if (l < ol) { ol = l; o = cc; found = 1.0; } }
    if (found > 0.5) outc = vec4(o * vec3(0.3, 0.24, 0.34) + vec3(0.006, 0.002, 0.012), 1.0);
  }
  gl_FragColor = outc;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  if (outc.a > 0.5) gl_FragColor.rgb = grade(gl_FragColor.rgb);
  // the lamp's glow: a soft halo in pixel steps over the scene behind (premultiplied)
  float d = length(ap + 0.5 - glowPos) / glowR;
  float g = pow(clamp(1.0 - d, 0.0, 1.0), 1.5) * 1.3;
  g = floor(g * 5.0 + bayer4(ap) * 0.9) / 5.0;
  float ga = clamp(g * glowAmt, 0.0, 0.6);
  if (outc.a < 0.5) gl_FragColor = vec4(glowCol * ga, ga);
}`;

class ShelfStage {
  readonly canvas: HTMLCanvasElement;
  private R: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(16, BOX.w / BOX.h, 1, 60);
  private rt: THREE.WebGLRenderTarget;
  private postM: THREE.ShaderMaterial;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private hemi = new THREE.HemisphereLight(0xfff1dc, 0x6a3e24, 0.75);
  private key = new THREE.DirectionalLight(0xffe2b8, 3.3);
  private fill = new THREE.DirectionalLight(0xbcd2ff, 0.55);
  private rim = new THREE.DirectionalLight(0xdce8ff, 1.3);
  private lampLight = new THREE.PointLight(0xffd690, 2, 7, 2);
  private lamp: LampParts;
  private clock: ClockParts;
  private book: BookParts;
  private objs: Record<NavId, { root: THREE.Object3D; body: THREE.Object3D; blob: THREE.Mesh; p: Phys; x: number }>;
  private W = 0;
  private H = 0;
  private s = 0.75;
  private raf = 0;
  private last = 0;
  private t = 0;
  private shown = false;
  private hostEl: HTMLElement | null = null;
  private rec = false;
  private wake0 = 420;
  private moving = 0;
  onLive: (() => void) | null = null;
  live = false;

  constructor() {
    const c = (this.canvas = document.createElement('canvas'));
    c.className = 'hh-nav3d-c';
    this.R = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' });
    this.R.setPixelRatio(1);
    this.R.setClearColor(0x000000, 0);
    this.R.outputColorSpace = THREE.SRGBColorSpace;
    this.R.toneMapping = THREE.ACESFilmicToneMapping;
    this.R.toneMappingExposure = 1.08;
    this.R.shadowMap.enabled = true;
    this.R.shadowMap.type = THREE.PCFSoftShadowMap;
    this.R.shadowMap.autoUpdate = false;
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    this.scene.environment = studioEnv(this.R);
    this.scene.environmentIntensity = 0.9;
    // light: a warm key from the top left (soft shadows on the shelf), a cool fill, a rim from behind
    this.key.position.set(-4.5, 7, 7);
    this.key.castShadow = true;
    const sc = this.key.shadow;
    sc.mapSize.set(1024, 512);
    Object.assign(sc.camera, { left: -5, right: 5, top: 3.5, bottom: -1.5, near: 1, far: 22 });
    sc.camera.updateProjectionMatrix();
    sc.bias = -0.0008; sc.normalBias = 0.02;
    (sc as THREE.LightShadow & { intensity?: number }).intensity = 0.62;
    this.fill.position.set(6, 2, 5);
    this.rim.position.set(3, 5, -7);
    this.scene.add(this.hemi, this.key, this.key.target, this.fill, this.rim, this.lampLight);
    this.postM = new THREE.ShaderMaterial({
      uniforms: { tex: { value: this.rt.texture }, rt: { value: new THREE.Vector2(2, 2) }, art: { value: new THREE.Vector2(1, 1) }, sat: { value: 1.16 }, glowPos: { value: new THREE.Vector2() }, glowR: { value: 30 }, glowCol: { value: new THREE.Color(0xffd890) }, glowAmt: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: POST_FRAG, depthTest: false, depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postM));
    this.frameCamera();
    // the shelf and the objects
    const wAt = (z: number) => this.unitsPerCss(z);
    const front = 0.3;
    const k = wAt(front + 0.01);
    const plateY = this.worldYAt(BOX.top * -1 + PLATE.y + PLATE.h / 2, front + 0.01);
    const plates = (Object.keys(CX) as NavId[]).map((id) => ({ x: (CX[id] - BOX.w / 2) * k, y: plateY, w: PLATE.w * k, h: PLATE.h * k }));
    const gap = (CX.clock - CX.sleep) / 2;
    const bosses = [CX.sleep + gap, CX.clock + gap].map((x) => (x - BOX.w / 2) * k);
    const sh = shelf((BOX.w - 6) * k, { plates, bosses });
    this.scene.add(sh.root);
    this.lamp = moonLamp();
    this.clock = alarmClock({ caseColor: 0x2f9a6a });
    this.book = journal();
    const zObj = -0.16;
    const ko = wAt(zObj);
    const place = (id: NavId, root: THREE.Object3D, body: THREE.Object3D, blobW: number, blobD: number, ry = 0, s = 1) => {
      const x = (CX[id] - BOX.w / 2) * ko;
      root.position.set(x, 0, zObj);
      root.rotation.y = ry;
      root.scale.setScalar(s);
      const blob = contactBlob(blobW * s, blobD * s, 0.75);
      blob.position.set(x, 0.006, zObj);
      this.scene.add(root, blob);
      return { root, body, blob, p: mkPhys(), x };
    };
    this.objs = {
      sleep: place('sleep', this.lamp.root, this.lamp.body, 1.5, 0.9, 0, 1.1),
      clock: place('clock', this.clock.root, this.clock.body, 1.7, 0.8, -0.12, 1.1),
      book: place('book', this.book.root, this.book.body, 2.1, 0.95, 0.42, 1.12),
    };
    // a few things left on the shelf: acorns and a fallen oak leaf by the lamp
    const a1 = acornProp(0.62), a2 = acornProp(0.55), leaf = oakLeafProp(0.9);
    const gx = (CX.sleep + 56 - BOX.w / 2) * ko;
    a1.position.set(gx - 0.08, 0.13, 0.08); a1.rotation.set(0.2, 0.6, Math.PI / 2 - 0.15);
    a2.position.set(gx + 0.26, 0.17, -0.2); a2.rotation.set(0, -0.4, 0.1);
    leaf.position.set(gx + 0.1, 0.012, 0.02); leaf.rotation.set(-Math.PI / 2 + 0.06, 0, 0.9);
    const b1 = contactBlob(0.36, 0.22, 0.4); b1.position.set(gx - 0.05, 0.006, 0.07);
    this.scene.add(a1, a2, leaf, b1);
    document.addEventListener('visibilitychange', () => this.wake());
  }

  // ---------------------------------------------------------------- framing
  /** camera: a long lens looking a little down at the shelf, framed so the shelf's front top edge sits where the DOM expects */
  private frameCamera() {
    const pitch = (9 * Math.PI) / 180, D = (BOX.h / 40 / 2) / Math.tan((this.cam.fov * Math.PI) / 360);
    const target = new THREE.Vector3(0, 1.2, 0);
    for (let i = 0; i < 4; i++) {
      this.cam.position.set(0, target.y + D * Math.sin(pitch), D * Math.cos(pitch));
      this.cam.lookAt(target);
      this.cam.updateMatrixWorld(); this.cam.updateProjectionMatrix();
      const y = this.cssOf(new THREE.Vector3(0, 0, 0.3)).y, want = -BOX.top + 100; // the shelf top at the nav's y = 100
      target.y -= (y - want) * this.unitsPerCss(0.3);
    }
  }
  /** a world point in canvas CSS px */
  private cssOf(v: THREE.Vector3) { const p = v.clone().project(this.cam); return { x: (p.x * 0.5 + 0.5) * BOX.w, y: (-p.y * 0.5 + 0.5) * BOX.h }; }
  /** world units per CSS px at depth z (about the shelf's centre line) */
  private unitsPerCss(z: number) { const a = this.cssOf(new THREE.Vector3(0, 0.5, z)), b = this.cssOf(new THREE.Vector3(1, 0.5, z)); return 1 / (b.x - a.x); }
  /** the world y on the plane z that shows at canvas CSS y */
  private worldYAt(cssY: number, z: number) {
    let y = 0;
    for (let i = 0; i < 5; i++) { const c = this.cssOf(new THREE.Vector3(0, y, z)).y; y += (c - cssY) * this.unitsPerCss(z); }
    return y;
  }

  // ---------------------------------------------------------------- size
  setScale(s: number) {
    if (s === this.s && this.W) return;
    this.s = s;
    this.W = Math.round(BOX.w * s); this.H = Math.round(BOX.h * s);
    this.R.setSize(this.W, this.H, false);
    this.rt.setSize(this.W * 2, this.H * 2);
    this.postM.uniforms.rt.value.set(this.W * 2, this.H * 2);
    this.postM.uniforms.art.value.set(this.W, this.H);
    this.R.shadowMap.needsUpdate = true;
    this.wake();
  }

  // ---------------------------------------------------------------- input
  press(id: NavId, on: boolean) {
    const p = this.objs[id].p;
    if (p.press === on) return;
    p.press = on;
    if (!on && !reducedMotion()) { p.vy = Math.max(p.vy, 2.8); p.vtilt += (Math.random() - 0.5) * 2.4; }
    this.kick();
  }
  hover(id: NavId, on: boolean) {
    const p = this.objs[id].p;
    if (p.hover === on) return;
    p.hover = on;
    if (on && !reducedMotion()) p.vtilt += id === 'clock' ? 1.6 : -1.2;
    this.kick();
  }
  act(id: NavId) { this.objs[id].p.act = 0; this.kick(); }
  setRec(on: boolean) { if (on !== this.rec) { this.rec = on; this.kick(); } }
  setWake(min: number) { this.wake0 = min; }
  /** the shelf (re)appears: the objects drop onto it one by one */
  show(on: boolean) {
    if (on && !this.shown && !reducedMotion()) (['sleep', 'clock', 'book'] as NavId[]).forEach((id, i) => { const p = this.objs[id].p; p.y = 0.32; p.vy = 0; p.drop = i * 0.09; });
    this.shown = on;
    this.kick();
  }
  attach(el: HTMLElement | null) { this.hostEl = el; if (el && this.canvas.parentElement !== el) el.appendChild(this.canvas); this.wake(); }
  private kick() { this.moving = Math.max(this.moving, 1.2); this.wake(); }

  // ---------------------------------------------------------------- loop
  private wake() {
    if (this.raf || !this.hostEl || !this.shown || document.hidden) return;
    this.raf = requestAnimationFrame(this.loop);
  }
  private loop = (now: number) => {
    this.raf = 0;
    if (!this.hostEl || !this.shown || document.hidden) return;
    this.raf = requestAnimationFrame(this.loop);
    const calm = reducedMotion();
    const fps = this.moving > 0 ? 30 : calm ? 1 : 12;
    if (now - this.last < 1000 / fps - 3) return;
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 1 / 30);
    this.last = now;
    this.frame(dt, calm);
  };

  /** advance one object's spring-and-gravity body; returns how much it is still moving */
  private stepPhys(p: Phys, dt: number) {
    if (p.drop > 0) { p.drop -= dt; return 1; }
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    p.ground = p.hover ? 0.07 : 0;
    for (let i = 0; i < n; i++) {
      if (p.y > p.ground + 1e-4 || p.vy > 0) {
        p.vy -= 26 * h; p.y += p.vy * h;
        if (p.y <= p.ground && p.vy < 0) { p.vsq += p.vy * 0.55; p.vtilt += p.vy * (Math.random() - 0.5) * 0.4; p.y = p.ground; p.vy = 0; }
      } else p.y += (p.ground - p.y) * Math.min(1, h * 16);
      const sqT = p.press ? -0.11 : 0;
      p.vsq += ((sqT - p.sq) * 560 - p.vsq * 19) * h; p.sq += p.vsq * h;
      p.vtilt += (-p.tilt * 220 - p.vtilt * 9) * h; p.tilt += p.vtilt * h;
    }
    return Math.abs(p.vy) + Math.abs(p.vsq) + Math.abs(p.vtilt) + Math.abs(p.sq - (p.press ? -0.11 : 0)) * 10 + Math.abs(p.y - p.ground) * 10;
  }

  private frame(dt: number, calm: boolean) {
    this.t += dt;
    const t = this.t;
    let motion = 0;
    for (const id of ['sleep', 'clock', 'book'] as NavId[]) {
      const o = this.objs[id], p = o.p;
      motion += this.stepPhys(p, dt);
      if (p.act >= 0) { p.act += dt; if (p.act > 1.8) p.act = -1; else motion += 1; }
      o.body.position.y = p.y;
      o.body.scale.set(1 - p.sq * 0.55, 1 + p.sq, 1 - p.sq * 0.55);
      o.body.rotation.z = p.tilt * 0.35;
      const lift = Math.max(0, p.y);
      o.blob.scale.setScalar(Math.max(0.4, 1 - lift * 0.5));
      (o.blob.material as THREE.MeshBasicMaterial).opacity = 0.75 * Math.max(0.15, 1 - lift * 0.8);
    }
    // the lamp: the moon breathes and bobs, the stars drift; a press pulls the chain and clicks it off and on
    const L = this.lamp, lp = this.objs.sleep.p, la = lp.act;
    const breath = calm ? 0.6 : 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / 4.2);
    let glow = (0.72 + 0.28 * breath) * (this.rec ? 1.3 : 1) * (lp.hover ? 1.2 : 1);
    if (la >= 0) glow = la < 0.13 ? 0.08 : la < 0.22 ? 1.7 : lerp(1.7, glow, ease((la - 0.22) / 1.2));
    const night = this.nightness();
    L.setGlow(Math.min(1.4, glow));
    if (!calm) { L.moon.position.y = L.moonAt.y + Math.sin(t * 1.3) * 0.028; L.moon.rotation.z = Math.sin(t * 0.7) * 0.07; L.sky.rotation.y = t * 0.06; }
    L.moon.rotation.y = la >= 0 ? Math.PI * 2 * ease(la / 1.0) : (calm ? 0 : Math.sin(t * 0.5) * 0.25);
    L.chain.position.y = 0.72 - (la >= 0 ? 0.09 * Math.max(0, Math.sin(Math.min(1, la / 0.35) * Math.PI)) : 0) - (lp.press ? 0.05 : 0);
    // the clock: real time, the second hand ticks with a little overshoot; a press rings it
    const C = this.clock, cp = this.objs.clock.p, ca = cp.act;
    const now = new Date(), ms = now.getMilliseconds() / 1000;
    const over = calm ? 0 : ms < 0.25 ? -Math.sin((ms / 0.25) * Math.PI) * 0.045 : 0;
    setClockHands(C, now, this.wake0, -(now.getSeconds() / 60) * Math.PI * 2 + over);
    const ringing = ca >= 0 && ca < 0.95;
    C.hammer.rotation.z = ringing ? Math.sin(ca * Math.PI * 2 * 21) * 0.5 : 0;
    C.bells.forEach((b, i) => { b.position.x = (i ? 0.5 : -0.5) + (ringing ? Math.sin(ca * 140 + i) * 0.012 : 0); });
    if (ringing) {
      const env = 1 - ca / 0.95;
      C.body.rotation.z += Math.sin(ca * Math.PI * 2 * 17) * 0.07 * env;
      C.body.position.x = Math.sin(ca * Math.PI * 2 * 23) * 0.035 * env;
      C.body.position.y += Math.abs(Math.sin(ca * Math.PI * 2 * 8)) * 0.05 * env;
    } else C.body.position.x = 0;
    // the journal: hover peeks the cover open; a press unbuckles the strap and swings the cover open, then shut
    const B = this.book, bp = this.objs.book.p, ba = bp.act;
    let open = bp.hover ? 0.2 : 0, tab = bp.hover ? 0.25 : 0;
    if (ba >= 0) {
      tab = ba < 0.18 ? back(ba / 0.18) * 2.4 : ba < 1.3 ? 2.4 : ba < 1.6 ? lerp(2.4, 0, ease((ba - 1.3) / 0.3)) : 0;
      open = ba < 0.12 ? 0 : ba < 0.55 ? back((ba - 0.12) / 0.43) * 1.45 : ba < 1.05 ? 1.45 : ba < 1.4 ? lerp(1.45, 0, ease((ba - 1.05) / 0.35)) : 0;
    }
    const bk = B as BookParts & { _o?: number; _t?: number };
    bk._o = lerp(bk._o ?? 0, open, ba >= 0 ? 1 : Math.min(1, dt * 10));
    bk._t = lerp(bk._t ?? 0, tab, ba >= 0 ? 1 : Math.min(1, dt * 10));
    B.cover.rotation.y = -bk._o;
    B.tab.rotation.y = bk._t;
    if (Math.abs(bk._o - open) > 0.002 || Math.abs(bk._t - tab) > 0.002) motion += 1;
    // light: day studio, or a moonlit night lit by the lamp
    const nd = night;
    this.hemi.intensity = lerp(0.75, 0.62, nd);
    this.hemi.color.setHex(nd > 0.5 ? 0xc8d0f8 : 0xfff1dc);
    this.key.intensity = lerp(3.3, 2.3, nd);
    this.key.color.setHex(nd > 0.5 ? 0xd4dcff : 0xffe2b8);
    this.rim.intensity = lerp(1.3, 1.6, nd);
    this.scene.environmentIntensity = lerp(0.9, 0.72, nd);
    const moonW = L.moonAt.clone(); L.root.localToWorld(moonW.set(L.moonAt.x, L.moon.position.y, L.moonAt.z));
    this.lampLight.position.copy(moonW);
    this.lampLight.intensity = glow * lerp(1.6, 5, nd);
    // the glow halo, centred on the moon
    const mc = this.cssOf(moonW);
    this.postM.uniforms.glowPos.value.set(mc.x * this.s, (BOX.h - mc.y) * this.s);
    this.postM.uniforms.glowR.value = 56 * this.s;
    this.postM.uniforms.glowAmt.value = glow * lerp(0.24, 0.7, nd);
    // motion: keep drawing fast while anything moves; shadows only follow when something moved
    if (motion > 0.02) { this.moving = 0.4; this.R.shadowMap.needsUpdate = true; }
    else this.moving = Math.max(0, this.moving - dt);
    if (!this.live) this.R.shadowMap.needsUpdate = true;
    const R = this.R;
    R.setRenderTarget(this.rt);
    R.clear();
    R.render(this.scene, this.cam);
    R.setRenderTarget(null);
    R.clear();
    R.render(this.postScene, this.postCam);
    if (!this.live) { this.live = true; this.onLive?.(); }
  }
  private nightness() {
    const sc = sceneRef.current as unknown as { sky?: { night?: number } } | null;
    const n = sc?.sky?.night ?? (window as unknown as { __shelfNight?: number }).__shelfNight;
    if (typeof n === 'number') return Math.max(0, Math.min(1, (n - 0.15) / 0.6));
    const h = new Date().getHours();
    return h >= 20 || h < 6 ? 1 : 0;
  }
}

let stage: ShelfStage | null | undefined;
/** the one live shelf (null when WebGL isn't available) */
function getStage(): ShelfStage | null {
  if (stage === undefined) { try { stage = new ShelfStage(); } catch (e) { console.warn('live shelf unavailable', e); stage = null; } }
  return stage;
}

/** the buttons tell the shelf what's happening to their objects */
export const shelf3d = {
  press: (id: NavId, on: boolean) => stage?.press(id, on),
  hover: (id: NavId, on: boolean) => stage?.hover(id, on),
  act: (id: NavId) => stage?.act(id),
};

let styled = false;
function installStyles() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.id = 'hh-shelf3d';
  st.textContent = `
.hh-nav3d{position:absolute;left:0;top:${BOX.top}px;width:${BOX.w}px;height:${BOX.h}px;pointer-events:none;z-index:0}
.hh-nav3d>canvas{display:block;width:100%;height:100%;image-rendering:pixelated}
.hh-nav.live .hh-pic,.hh-nav.live .hh-cshadow,.hh-nav.live .hh-shelf{visibility:hidden}
.hh-nav.live .hh-plate{background-image:none!important;filter:none}
.hh-nav.live .hh-mobj,.hh-nav.live .hh-mobj.press,.hh-nav.live .hh-mobj.pop,.hh-nav.live .hh-mobj.rec,.hh-nav.live .hh-mobj.rec.pop{animation:none;scale:none;filter:none}
.hh-nav.live .hh-mobj.press .hh-plate{translate:0 1px}
`;
  document.head.appendChild(st);
}

/** art pixels per nav CSS px: about 1.33 CSS px per art pixel on screen (the nav is drawn 1.5x on big screens) */
const artScale = (big: boolean) => (window as unknown as { __shelfArt?: number }).__shelfArt ?? (big ? 1.0 : 0.66);

/**
 * The live 3D shelf behind the main buttons. Returns [host ref, live]: put the host span in the nav; `live` turns
 * true once the first 3D frame is drawn (then the painted stand-ins can hide).
 */
export function useShelf3D(away: boolean, rec: boolean, bigQuery: string): [(el: HTMLElement | null) => void, boolean] {
  installStyles();
  const [live, setLive] = useState(false);
  const host = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  // build it a moment after first paint
  useEffect(() => {
    const id = window.setTimeout(() => {
      const s = getStage();
      if (!s) return;
      s.onLive = () => setLive(true);
      if (s.live) setLive(true);
      setReady(true);
    }, 120);
    return () => clearTimeout(id);
  }, []);
  useEffect(() => {
    const s = ready ? stage : null;
    if (!s) return;
    let mq: MediaQueryList | null = null;
    const size = () => s.setScale(artScale(!!mq?.matches));
    try { mq = matchMedia(bigQuery); mq.addEventListener?.('change', size); } catch { mq = null; }
    size();
    s.attach(host.current);
    return () => mq?.removeEventListener?.('change', size);
  }, [ready]);
  useEffect(() => { if (ready) stage?.show(!away); }, [ready, away]);
  useEffect(() => { if (ready) stage?.setRec(rec); }, [ready, rec]);
  const wake = save.value.sleep.wake;
  useEffect(() => { const [h, m] = wake.split(':').map(Number); stage?.setWake(h * 60 + m); }, [ready, wake]);
  return [(el) => { host.current = el; if (ready) stage?.attach(el); }, live];
}

/** for the dev page and screenshots */
if (typeof window !== 'undefined') (window as unknown as { __shelf3d: unknown }).__shelf3d = { stage: () => stage, api: shelf3d };
